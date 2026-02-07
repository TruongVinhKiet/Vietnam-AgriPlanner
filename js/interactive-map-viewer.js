/**
 * Interactive Map Viewer for AgriPlanner
 * Displays analyzed map with clickable zones like guland.vn
 * 
 * Features:
 * - Image overlay on Leaflet map
 * - Clickable zones with highlight
 * - Popup with zone details (soil type, area, code)
 * - Legend display
 */

class InteractiveMapViewer {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.options = {
            center: [9.1769, 105.1524], // Default: Ca Mau center
            zoom: 10,
            ...options
        };
        
        this.map = null;
        this.imageOverlay = null;
        this.zonesLayer = null;
        this.selectedZone = null;
        this.zones = [];
        this.colorSummary = [];
        this.geoBounds = null;
    }

    /**
     * Initialize the map
     */
    init() {
        // Create map
        this.map = L.map(this.containerId, {
            center: this.options.center,
            zoom: this.options.zoom,
            zoomControl: true
        });

        // Add base tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(this.map);

        // Create layer for zones
        this.zonesLayer = L.layerGroup().addTo(this.map);

        // Add custom CSS for highlighted zones
        this.addCustomStyles();

        return this;
    }

    /**
     * Add custom CSS styles
     */
    addCustomStyles() {
        if (document.getElementById('interactive-map-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'interactive-map-styles';
        style.textContent = `
            .zone-popup {
                min-width: 280px;
                font-family: 'Segoe UI', sans-serif;
            }
            .zone-popup-header {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 8px 8px 0 0;
                margin: -13px -14px 12px -14px;
            }
            .zone-color-box {
                width: 48px;
                height: 48px;
                border-radius: 8px;
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            .zone-popup-title {
                font-size: 16px;
                font-weight: 600;
                margin: 0;
            }
            .zone-popup-code {
                font-size: 12px;
                opacity: 0.9;
            }
            .zone-popup-row {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #eee;
            }
            .zone-popup-row:last-child {
                border-bottom: none;
            }
            .zone-popup-label {
                color: #666;
                font-size: 13px;
            }
            .zone-popup-value {
                font-weight: 500;
                color: #333;
                font-size: 13px;
            }
            .zone-popup-area {
                background: #f0fdf4;
                padding: 10px;
                border-radius: 6px;
                margin: 8px 0;
                text-align: center;
            }
            .zone-popup-area-value {
                font-size: 20px;
                font-weight: 700;
                color: #166534;
            }
            .zone-popup-area-label {
                font-size: 11px;
                color: #666;
                margin-top: 2px;
            }
            .zone-highlight {
                animation: zone-pulse 1s ease-in-out infinite;
            }
            @keyframes zone-pulse {
                0%, 100% { stroke-opacity: 1; }
                50% { stroke-opacity: 0.5; }
            }
            .leaflet-popup-content-wrapper {
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            }
            .leaflet-popup-content {
                margin: 0;
                padding: 0;
            }
            .leaflet-popup-tip {
                background: white;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Load analysis result from JSON
     * @param {Object} analysisResult - JSON from map_polygon_extractor.py
     * @param {Object} geoBounds - Geo bounds {sw: {lat, lng}, ne: {lat, lng}}
     */
    loadAnalysisResult(analysisResult, geoBounds) {
        this.zones = analysisResult.zones || [];
        this.colorSummary = analysisResult.colorSummary || [];
        this.geoBounds = geoBounds;
        this.imageSize = analysisResult.imageSize;

        // Convert normalized coordinates to geo coordinates
        this.convertCoordinates();

        // Render zones on map
        this.renderZones();

        // Fit map to bounds
        if (geoBounds) {
            const bounds = L.latLngBounds(
                [geoBounds.sw.lat, geoBounds.sw.lng],
                [geoBounds.ne.lat, geoBounds.ne.lng]
            );
            this.map.fitBounds(bounds);
        }

        return this;
    }

    /**
     * Convert normalized (0-1) coordinates to geo coordinates
     */
    convertCoordinates() {
        if (!this.geoBounds) return;

        const { sw, ne } = this.geoBounds;
        const latRange = ne.lat - sw.lat;
        const lngRange = ne.lng - sw.lng;

        this.zones.forEach(zone => {
            // Parse boundary coordinates
            let coords = zone.boundaryCoordinates;
            if (typeof coords === 'string') {
                try {
                    coords = JSON.parse(coords);
                } catch (e) {
                    console.warn('Could not parse coordinates for zone', zone.id);
                    return;
                }
            }

            // Convert each point
            zone.geoCoordinates = coords.map(point => {
                // Input format: [x, y] normalized 0-1
                const nx = point[0];
                const ny = point[1];
                
                // Convert to lat/lng
                // Note: y goes down in image, lat goes up in geo
                const lat = ne.lat - (ny * latRange);
                const lng = sw.lng + (nx * lngRange);
                
                return [lat, lng];
            });

            // Convert center
            if (Array.isArray(zone.center)) {
                const cx = zone.center[0];
                const cy = zone.center[1];
                zone.geoCenter = {
                    lat: ne.lat - (cy * latRange),
                    lng: sw.lng + (cx * lngRange)
                };
            }
        });
    }

    /**
     * Load image overlay
     * @param {string} imageUrl - URL of the analyzed map image
     */
    loadImageOverlay(imageUrl) {
        if (!this.geoBounds) {
            console.error('Geo bounds required for image overlay');
            return this;
        }

        const { sw, ne } = this.geoBounds;
        const bounds = [[sw.lat, sw.lng], [ne.lat, ne.lng]];

        // Remove existing overlay
        if (this.imageOverlay) {
            this.map.removeLayer(this.imageOverlay);
        }

        // Add new overlay
        this.imageOverlay = L.imageOverlay(imageUrl, bounds, {
            opacity: 0.9,
            interactive: false
        }).addTo(this.map);

        // Bring zones to front
        this.zonesLayer.bringToFront();

        return this;
    }

    /**
     * Render zones as interactive polygons
     */
    renderZones() {
        this.zonesLayer.clearLayers();

        this.zones.forEach(zone => {
            if (!zone.geoCoordinates || zone.geoCoordinates.length < 3) return;

            // Create polygon with transparent fill
            const polygon = L.polygon(zone.geoCoordinates, {
                fillColor: zone.fillColor || '#10B981',
                fillOpacity: 0.0, // Transparent - only show on hover/click
                color: 'transparent', // No border by default
                weight: 0
            });

            // Store zone data
            polygon.zoneData = zone;

            // Event handlers
            polygon.on('mouseover', (e) => this.onZoneHover(e, zone));
            polygon.on('mouseout', (e) => this.onZoneLeave(e, zone));
            polygon.on('click', (e) => this.onZoneClick(e, zone));

            polygon.addTo(this.zonesLayer);
        });
    }

    /**
     * Handle zone hover
     */
    onZoneHover(e, zone) {
        const layer = e.target;
        layer.setStyle({
            fillOpacity: 0.2,
            color: '#00BCD4', // Cyan border like guland
            weight: 2,
            opacity: 1
        });
        layer.bringToFront();
    }

    /**
     * Handle zone mouse leave
     */
    onZoneLeave(e, zone) {
        const layer = e.target;
        if (this.selectedZone !== zone) {
            layer.setStyle({
                fillOpacity: 0,
                color: 'transparent',
                weight: 0
            });
        }
    }

    /**
     * Handle zone click - show popup like guland
     */
    onZoneClick(e, zone) {
        const layer = e.target;
        
        // Deselect previous
        if (this.selectedZone && this.selectedZone !== zone) {
            this.zonesLayer.eachLayer(l => {
                if (l.zoneData === this.selectedZone) {
                    l.setStyle({
                        fillOpacity: 0,
                        color: 'transparent',
                        weight: 0
                    });
                }
            });
        }

        // Select new
        this.selectedZone = zone;
        layer.setStyle({
            fillOpacity: 0.3,
            color: '#00BCD4',
            weight: 3,
            opacity: 1,
            dashArray: null
        });

        // Create popup content
        const popupContent = this.createPopupContent(zone);
        
        // Show popup
        L.popup({
            maxWidth: 320,
            className: 'zone-popup-wrapper'
        })
        .setLatLng(e.latlng)
        .setContent(popupContent)
        .openOn(this.map);
    }

    /**
     * Create popup content HTML
     */
    createPopupContent(zone) {
        // Calculate area in ha/km²
        const areaPercent = zone.areaPercent || 0;
        const totalAreaHa = this.options.totalAreaHa || 0;
        const zoneAreaHa = (areaPercent / 100) * totalAreaHa;
        const areaDisplay = zoneAreaHa >= 100 
            ? `${(zoneAreaHa / 100).toFixed(2)} km²`
            : `${zoneAreaHa.toFixed(2)} ha`;

        return `
            <div class="zone-popup">
                <div class="zone-popup-header">
                    <div class="zone-color-box" style="background-color: ${zone.fillColor || '#ccc'}"></div>
                    <div>
                        <h3 class="zone-popup-title">${zone.zoneName || zone.name || 'Vùng ' + zone.id}</h3>
                        <div class="zone-popup-code">${zone.zoneCode || ''}</div>
                    </div>
                </div>
                
                <div class="zone-popup-area">
                    <div class="zone-popup-area-value">${areaDisplay}</div>
                    <div class="zone-popup-area-label">Diện tích ước tính (${areaPercent.toFixed(2)}%)</div>
                </div>

                <div class="zone-popup-row">
                    <span class="zone-popup-label">Loại đất</span>
                    <span class="zone-popup-value">${zone.zoneType || '-'}</span>
                </div>
                
                <div class="zone-popup-row">
                    <span class="zone-popup-label">Mã code</span>
                    <span class="zone-popup-value">${zone.zoneCode || '-'}</span>
                </div>
                
                <div class="zone-popup-row">
                    <span class="zone-popup-label">Mục đích sử dụng</span>
                    <span class="zone-popup-value">${zone.landUsePurpose || '-'}</span>
                </div>
                
                <div class="zone-popup-row">
                    <span class="zone-popup-label">Màu sắc</span>
                    <span class="zone-popup-value">
                        <span style="display:inline-block;width:14px;height:14px;background:${zone.fillColor};border:1px solid #ccc;border-radius:3px;vertical-align:middle;margin-right:4px;"></span>
                        ${zone.fillColor}
                    </span>
                </div>
                
                ${zone.geoCenter ? `
                <div class="zone-popup-row">
                    <span class="zone-popup-label">Tọa độ tâm</span>
                    <span class="zone-popup-value">${zone.geoCenter.lat.toFixed(5)}, ${zone.geoCenter.lng.toFixed(5)}</span>
                </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Show all zone boundaries (toggle)
     */
    toggleAllBoundaries(show) {
        this.zonesLayer.eachLayer(layer => {
            if (show) {
                layer.setStyle({
                    color: layer.zoneData.fillColor || '#333',
                    weight: 1,
                    opacity: 0.7,
                    fillOpacity: 0
                });
            } else {
                layer.setStyle({
                    color: 'transparent',
                    weight: 0,
                    fillOpacity: 0
                });
            }
        });
    }

    /**
     * Get legend data for display
     */
    getLegendData() {
        // Group by soil type
        const grouped = {};
        this.colorSummary.forEach(item => {
            const type = item.soilType || 'UNKNOWN';
            if (!grouped[type]) {
                grouped[type] = {
                    type: type,
                    name: item.soilName || item.soilType,
                    code: item.soilCode,
                    colors: [],
                    totalPercent: 0,
                    totalPolygons: 0
                };
            }
            grouped[type].colors.push(item.color);
            grouped[type].totalPercent += item.percentage || 0;
            grouped[type].totalPolygons += item.polygonCount || 0;
        });

        return Object.values(grouped);
    }

    /**
     * Highlight zones by type
     */
    highlightByType(soilType) {
        this.zonesLayer.eachLayer(layer => {
            const zone = layer.zoneData;
            if (zone.zoneType === soilType) {
                layer.setStyle({
                    fillOpacity: 0.4,
                    color: '#FF5722',
                    weight: 2
                });
            } else {
                layer.setStyle({
                    fillOpacity: 0,
                    color: 'transparent',
                    weight: 0
                });
            }
        });
    }

    /**
     * Reset all highlights
     */
    resetHighlights() {
        this.selectedZone = null;
        this.zonesLayer.eachLayer(layer => {
            layer.setStyle({
                fillOpacity: 0,
                color: 'transparent',
                weight: 0
            });
        });
        this.map.closePopup();
    }

    /**
     * Fly to specific zone
     */
    flyToZone(zoneId) {
        const zone = this.zones.find(z => z.id === zoneId);
        if (zone && zone.geoCenter) {
            this.map.flyTo([zone.geoCenter.lat, zone.geoCenter.lng], 14);
            
            // Trigger click on zone
            this.zonesLayer.eachLayer(layer => {
                if (layer.zoneData.id === zoneId) {
                    layer.fire('click');
                }
            });
        }
    }

    /**
     * Export zones to GeoJSON
     */
    exportToGeoJSON() {
        const features = this.zones.map(zone => ({
            type: 'Feature',
            properties: {
                id: zone.id,
                name: zone.zoneName || zone.name,
                zoneType: zone.zoneType,
                zoneCode: zone.zoneCode,
                fillColor: zone.fillColor,
                areaPercent: zone.areaPercent,
                landUsePurpose: zone.landUsePurpose
            },
            geometry: {
                type: 'Polygon',
                coordinates: [zone.geoCoordinates.map(c => [c[1], c[0]])] // GeoJSON uses [lng, lat]
            }
        }));

        return {
            type: 'FeatureCollection',
            features: features
        };
    }
}

// Export for use
window.InteractiveMapViewer = InteractiveMapViewer;
