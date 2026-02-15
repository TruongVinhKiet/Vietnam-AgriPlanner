/**
 * Cultivation Map Layers - WMS Land Parcels, Soil, and Suitability
 * Handles map overlay layers for the user cultivation page
 * 
 * Tabs: Quy hoạch (WMS land parcels) | Thổ nhưỡng (soil zones) | Thích nghi (combined)
 */

// ============ CONSTANTS ============
const GEOSERVER_WMS_URL = 'https://ilis-sdk.vnpt.vn/map/geoserver/iLIS_CMU/wms';
const GEOSERVER_WFS_URL = 'https://ilis-sdk.vnpt.vn/map/geoserver/iLIS_CMU/wfs';
// All district parcel layers joined for full-province WMS display
const WMS_LAND_PARCEL_LAYER = [
    'iLIS_CMU:cmu_thuadat_huyenthoibinh',
    'iLIS_CMU:cmu_thuadat_huyencainuoc',
    'iLIS_CMU:cmu_thuadat_huyendamdoi',
    'iLIS_CMU:cmu_thuadat_huyenphutan',
    'iLIS_CMU:cmu_thuadat_huyentranvanthoi',
    'iLIS_CMU:cmu_thuadat_huyenuminh',
    'iLIS_CMU:cmu_thuadat_tpcamau'
].join(',');

const CULTIVATION_LAND_USE_COLORS = {
    'LUK': '#FFD700', 'LUC': '#FFC107', 'ONT': '#FF6B6B', 'CLN': '#4CAF50',
    'NTS': '#2196F3', 'BHK': '#8BC34A', 'DGT': '#9E9E9E', 'DTL': '#00BCD4',
    'TMD': '#E91E63', 'SKC': '#FF5722', 'ODT': '#F44336', 'CQP': '#795548',
    'TSC': '#607D8B', 'DHT': '#3F51B5', 'DYT': '#E91E63', 'DGD': '#FF9800',
    'TIN': '#9C27B0', 'NTD': '#CDDC39', 'RSX': '#388E3C', 'RPH': '#1B5E20',
    'RDD': '#2E7D32', 'HNK': '#A1887F', 'MNC': '#81C784', 'SON': '#B0BEC5',
    'ONT+CLN': '#E8A838', 'default': '#90A4AE'
};

const CULTIVATION_LAND_USE_NAMES = {
    'LUC': 'Đất chuyên trồng lúa nước', 'LUK': 'Đất trồng lúa nước còn lại',
    'CLN': 'Đất trồng cây lâu năm', 'RSX': 'Đất rừng sản xuất',
    'RPH': 'Đất rừng phòng hộ', 'NTS': 'Đất nuôi trồng thủy sản',
    'ONT': 'Đất ở nông thôn', 'ODT': 'Đất ở đô thị', 'DGT': 'Đất giao thông',
    'DTL': 'Đất thủy lợi', 'TMD': 'Đất thương mại dịch vụ',
    'SKC': 'Đất cụm khu công nghiệp', 'BHK': 'Đất bằng trồng cây hàng năm khác',
    'HNK': 'Đất nương rẫy', 'TSC': 'Đất trụ sở cơ quan',
    'DGD': 'Đất cơ sở giáo dục', 'DYT': 'Đất cơ sở y tế',
    'TIN': 'Đất tôn giáo', 'CQP': 'Đất quốc phòng',
    'SON': 'Đất mặt nước sông ngòi', 'MNC': 'Đất mặt nước chuyên dùng',
    'NTD': 'Đất nghĩa trang', 'ONT+CLN': 'Đất ở + Cây lâu năm',
    'CLN+LUK': 'Đất cây lâu năm + Lúa', 'NTS+CLN': 'Đất thủy sản + Cây lâu năm',
};

const CROP_SUITABILITY_MAP = {
    'LUC': { crops: ['Lúa (2-3 vụ)', 'Lúa nếp', 'Lúa thơm'], animals: [] },
    'LUK': { crops: ['Lúa (1-2 vụ)', 'Lúa mùa'], animals: [] },
    'CLN': { crops: ['Dừa', 'Xoài', 'Bưởi', 'Cam', 'Chuối'], animals: [] },
    'NTS': { crops: [], animals: ['Tôm sú', 'Tôm thẻ', 'Cá tra', 'Cua'] },
    'BHK': { crops: ['Rau màu', 'Đậu', 'Bắp'], animals: [] },
    'HNK': { crops: ['Khoai lang', 'Rau ăn lá'], animals: [] },
    'RSX': { crops: ['Tràm', 'Keo'], animals: [] },
    'RPH': { crops: ['Đước', 'Mắm'], animals: ['Tôm sinh thái'] },
    'ONT+CLN': { crops: ['Dừa', 'Cây ăn trái'], animals: ['Gà', 'Vịt'] },
};

// Soil zone code → crop suitability (from soil/geology data)
const SOIL_CROP_SUITABILITY = {
    // === DB zone_codes (primary match from planning_zones table) ===
    'M': { crops: ['Lúa nước'], animals: ['Tôm sú', 'Tôm thẻ chân trắng', 'Cua biển'], description: 'Đất mặn - Chuyên tôm/cua' },
    'MIT': { crops: ['Lúa nước', 'Dưa hấu', 'Dừa'], animals: ['Tôm càng xanh', 'Cá tra'], description: 'Đất mặn ít - Lúa tôm kết hợp' },
    'MN': { crops: [], animals: ['Tôm sú', 'Cua biển', 'Sò huyết'], description: 'Đất mặn nhiều - Chuyên thủy sản' },
    'PH': { crops: ['Lúa nước', 'Mía', 'Khoai tây'], animals: ['Cá rô đồng'], description: 'Đất phèn - Cần cải tạo' },
    'PHH': { crops: ['Tràm'], animals: ['Cá rô đồng'], description: 'Đất phèn hoạt động - Hạn chế canh tác' },
    'TB': { crops: ['Tràm'], animals: [], description: 'Đất than bùn U Minh - Rừng tràm' },
    'Bb': { crops: ['Lúa nước', 'Bắp cải'], animals: ['Cá tra'], description: 'Bãi bồi, đất mới mầu mỡ' },
    // === Legacy/detailed soil codes ===
    'Cg': { crops: ['Dừa', 'Dưa hấu', 'Ớt'], animals: [], description: 'Đất cát giồng - Rau màu' },
    'M3': { crops: [], animals: ['Tôm sú', 'Cua biển'], description: 'Đất mặn nhiều' },
    'M2': { crops: ['Lúa nước'], animals: ['Tôm sú', 'Cá tra'], description: 'Đất mặn trung bình' },
    'M1': { crops: ['Lúa nước', 'Dưa hấu'], animals: ['Tôm càng xanh'], description: 'Đất mặn ít, đa canh' },
    'SP-tt-nn-RNM': { crops: [], animals: ['Tôm sú', 'Cua biển', 'Sò huyết'], description: 'Phèn tiềm tàng nông + Rừng ngập mặn' },
    'SP-tt-nn-M3': { crops: ['Lúa nước'], animals: ['Tôm sú', 'Cua biển'], description: 'Phèn tiềm tàng nông, mặn nhiều' },
    'SP-tt-nn-M2': { crops: ['Lúa nước', 'Mía'], animals: ['Tôm sú', 'Cá rô đồng'], description: 'Phèn tiềm tàng nông, mặn TB' },
    'SP-tt-nn-M1': { crops: ['Lúa nước', 'Cà chua'], animals: ['Cá tra', 'Tôm càng xanh'], description: 'Phèn tiềm tàng nông, mặn ít' },
    'SP-tt-s-RNM': { crops: [], animals: ['Tôm sú', 'Nghêu'], description: 'Phèn tiềm tàng sâu + Rừng ngập mặn' },
    'SP-tt-s-M3': { crops: ['Lúa nước'], animals: ['Tôm sú'], description: 'Phèn tiềm tàng sâu, mặn nhiều' },
    'SP-tt-s-M2': { crops: ['Lúa nước'], animals: ['Tôm sú'], description: 'Phèn tiềm tàng sâu, mặn TB' },
    'SP-tt-s-M1': { crops: ['Lúa nước', 'Xoài', 'Bưởi'], animals: ['Cá tra', 'Tôm càng xanh'], description: 'Phèn tiềm tàng sâu, mặn ít - đất tốt' },
    'SP-hd-nn-M3': { crops: ['Lúa nước'], animals: ['Tôm sú'], description: 'Phèn hoạt động nông, mặn nhiều' },
    'SP-hd-nn-M2': { crops: ['Lúa nước', 'Mía'], animals: ['Cá rô đồng'], description: 'Phèn hoạt động nông, mặn TB' },
    'SP-hd-nn-M1': { crops: ['Lúa nước', 'Khoai tây'], animals: ['Cá rô đồng'], description: 'Phèn hoạt động nông, mặn ít' },
    'SP-hd-s-M3': { crops: ['Lúa nước'], animals: ['Tôm sú', 'Cua biển'], description: 'Phèn hoạt động sâu, mặn nhiều' },
    'SP-hd-s-M2': { crops: ['Lúa nước'], animals: ['Tôm thẻ chân trắng'], description: 'Phèn hoạt động sâu, mặn TB' },
    'SP-hd-s-M1': { crops: ['Lúa nước', 'Cam', 'Bưởi'], animals: ['Cá tra'], description: 'Phèn hoạt động sâu, mặn ít' },
    'T-p-M': { crops: ['Tràm', 'Keo lá tràm'], animals: [], description: 'Đất than bùn U Minh - rừng tràm' },
    'Fa': { crops: ['Cao su', 'Cà phê', 'Hồ tiêu'], animals: [], description: 'Đất vùng đồi núi thấp' },
    'WATER': { crops: [], animals: ['Cá tra', 'Tôm sú', 'Nghêu'], description: 'Sông suối, mặt nước' },
};

// ============ STATE ============
let userMapCurrentLayer = null; // 'planning' | 'soil' | 'suitability'
let userWmsLayer = null;
let userLocalParcelsLayer = null;
let userSoilOverlay = null;
let userWmsActive = false;
let isAddFieldByParcelMode = false;
let addFieldByParcelHighlight = null;

// ============ LAYER MANAGEMENT ============

function getUserLandUseColor(code) {
    if (!code) return CULTIVATION_LAND_USE_COLORS['default'];
    return CULTIVATION_LAND_USE_COLORS[code.toUpperCase().trim()] || CULTIVATION_LAND_USE_COLORS['default'];
}

function getUserLandUseName(code) {
    if (!code) return 'Chưa phân loại';
    const c = code.trim();
    return CULTIVATION_LAND_USE_NAMES[c] || c;
}

/**
 * Activate WMS land parcels layer (Quy hoạch tab)
 */
function activateUserPlanningLayer() {
    if (userMapCurrentLayer === 'planning') return;
    deactivateAllUserMapLayers();
    userMapCurrentLayer = 'planning';

    if (!userWmsLayer) {
        userWmsLayer = L.tileLayer.wms(GEOSERVER_WMS_URL, {
            layers: WMS_LAND_PARCEL_LAYER,
            format: 'image/png',
            transparent: true,
            version: '1.1.1',
            srs: 'EPSG:4326',
            opacity: 0.75,
            minZoom: 13,
            maxZoom: 22,
            maxNativeZoom: 20,
            attribution: '© ilis.camau.gov.vn'
        });
    }
    userWmsLayer.addTo(map);
    userWmsActive = true;

    // Setup click handler for parcel info
    map.on('click', onUserMapClickParcelInfo);

    // Load local overlay at high zoom for tooltips
    loadUserLocalParcels();
    map.on('moveend', onUserMapMoveLoadParcels);

    // Show planning legend
    document.getElementById('planning-legend').style.display = 'block';
    document.getElementById('soil-legend').style.display = 'none';

    showToastMessage('Bản đồ Quy hoạch', 'Hiển thị thửa đất từ iLIS Cà Mau (WMS)');

    // NEW: Background load soil zones for cross-referencing popup info
    if (!userSoilOverlay) {
        loadUserSoilZones(false, false);
    }
}

/**
 * Activate soil zones layer (Thổ nhưỡng tab)
 */
function activateUserSoilLayer() {
    if (userMapCurrentLayer === 'soil') return;
    deactivateAllUserMapLayers();
    userMapCurrentLayer = 'soil';

    // Load soil zones from API
    loadUserSoilZones();

    document.getElementById('planning-legend').style.display = 'none';
    document.getElementById('soil-legend').style.display = 'block';

    showToastMessage('Bản đồ Thổ nhưỡng', 'Đang hiển thị lớp thổ nhưỡng');
}

/**
 * Activate suitability layer (Thích nghi tab) = WMS parcels + soil overlay
 */
function activateUserSuitabilityLayer() {
    if (userMapCurrentLayer === 'suitability') return;
    deactivateAllUserMapLayers();
    userMapCurrentLayer = 'suitability';

    // Add WMS parcels with lower opacity
    if (!userWmsLayer) {
        userWmsLayer = L.tileLayer.wms(GEOSERVER_WMS_URL, {
            layers: WMS_LAND_PARCEL_LAYER,
            format: 'image/png',
            transparent: true,
            version: '1.1.1',
            srs: 'EPSG:4326',
            opacity: 0.55,
            minZoom: 13,
            maxZoom: 22,
            maxNativeZoom: 20,
            attribution: '© ilis.camau.gov.vn'
        });
    } else {
        userWmsLayer.setOpacity(0.55);
    }
    userWmsLayer.addTo(map);
    userWmsActive = true;

    // Add soil overlay
    loadUserSoilZones(true);

    // Setup combined click handler
    map.on('click', onUserMapClickSuitabilityInfo);
    loadUserLocalParcels();
    map.on('moveend', onUserMapMoveLoadParcels);

    // Show suitability legend
    showUserSuitabilityLegend();

    showToastMessage('Bản đồ Thích nghi', 'Click vào thửa đất để xem cây trồng phù hợp');
}

function deactivateAllUserMapLayers() {
    if (userWmsLayer) {
        map.removeLayer(userWmsLayer);
    }
    if (userLocalParcelsLayer) {
        map.removeLayer(userLocalParcelsLayer);
        userLocalParcelsLayer = null;
    }
    if (userSoilOverlay) {
        map.removeLayer(userSoilOverlay);
        userSoilOverlay = null;
    }
    userWmsActive = false;
    userMapCurrentLayer = null;

    map.off('click', onUserMapClickParcelInfo);
    map.off('click', onUserMapClickSuitabilityInfo);
    map.off('moveend', onUserMapMoveLoadParcels);

    document.getElementById('planning-legend').style.display = 'none';
    document.getElementById('soil-legend').style.display = 'none';

    // Remove suitability legend if exists
    const suitLegend = document.getElementById('user-suitability-legend');
    if (suitLegend) suitLegend.style.display = 'none';
}

// ============ WMS CLICK HANDLER ============

async function onUserMapClickParcelInfo(e) {
    if (!userWmsActive || isAddFieldByParcelMode) return;

    // 1. Get Parcel Info (WMS)
    const info = await getParcelInfoAtPoint(e.latlng);

    // 2. Get Soil Info (Local Overlay) - Cross-reference even on Planning Tab
    let soilInfo = null;
    if (userSoilOverlay) {
        soilInfo = findSoilZoneAtPoint(userSoilOverlay, e.latlng);
    }

    // 3. API fallback if client-side detection failed
    if (!soilInfo) {
        soilInfo = await fetchSoilZoneFromAPI(e.latlng);
    }

    if (info) showUserParcelPopup(info, soilInfo, e.latlng);
}

async function getParcelInfoAtPoint(latlng) {
    const mapSize = map.getSize();
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const point = map.latLngToContainerPoint(latlng);

    const bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
    const url = `${GEOSERVER_WMS_URL}?` +
        `SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo` +
        `&LAYERS=${WMS_LAND_PARCEL_LAYER}` +
        `&QUERY_LAYERS=${WMS_LAND_PARCEL_LAYER}` +
        `&SRS=EPSG:4326&BBOX=${bbox}` +
        `&WIDTH=${mapSize.x}&HEIGHT=${mapSize.y}` +
        `&X=${Math.round(point.x)}&Y=${Math.round(point.y)}` +
        `&INFO_FORMAT=application/json&FEATURE_COUNT=1`;

    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        const features = data.features || [];
        if (features.length === 0) return null;

        const props = features[0].properties || {};
        return {
            mapSheetNumber: props.tobandoso,
            parcelNumber: props.sothututhua,
            areaSqm: props.dientich,
            legalAreaSqm: props.dientichpl,
            landUseCode: props.loaidat,
            landUseName: getUserLandUseName(props.loaidat),
            address: props.diachithua,
            adminUnitName: props.tendvhc,
            adminUnitCode: props.madvhc,
            geometry: features[0].geometry || null
        };
    } catch (err) {
        console.warn('GetFeatureInfo error:', err);
        return null;
    }
}

function showUserParcelPopup(info, soilInfo, latlng) {
    const area = info.areaSqm ? (info.areaSqm / 10000).toFixed(4) : '—';
    const colorBox = `<span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${getUserLandUseColor(info.landUseCode)};margin-right:4px;vertical-align:middle;border:1px solid #666"></span>`;

    // Determine suitability
    // 1. Try Soil-based first (more accurate for crops)
    let soilSuit = null;
    let soilCode = '';
    if (soilInfo) {
        soilCode = soilInfo.zoneCode || '';
        soilSuit = SOIL_CROP_SUITABILITY[soilCode] || null;
        if (!soilSuit && soilInfo.zoneType) {
            soilSuit = SOIL_CROP_SUITABILITY[soilInfo.zoneType] || null;
        }
        if (!soilSuit && soilCode) {
            const matchKey = Object.keys(SOIL_CROP_SUITABILITY).find(k => soilCode.includes(k) || k.includes(soilCode));
            if (matchKey) soilSuit = SOIL_CROP_SUITABILITY[matchKey];
        }
    }

    // 2. Fallback to Land-Use based
    const landUseSuit = CROP_SUITABILITY_MAP[info.landUseCode?.toUpperCase()] || null;

    // Combine logic similar to suitability popup
    const suit = soilSuit || landUseSuit;
    const suitSource = soilSuit ? 'thổ nhưỡng' : 'mục đích SD';

    let cropHtml = '';
    if (suit) {
        if (suit.crops.length > 0) cropHtml += `<div style="margin-top:6px;"><b>🌾 Cây trồng (${suitSource}):</b> ${suit.crops.join(', ')}</div>`;
        if (suit.animals.length > 0) cropHtml += `<div><b>🐟 Vật nuôi (${suitSource}):</b> ${suit.animals.join(', ')}</div>`;
    }

    // Soil Info Section (New)
    let soilHtml = '';
    if (soilInfo) {
        soilHtml = `
        <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #e5e7eb;font-size:12px;">
            <div style="margin-bottom:2px;"><strong style="color:#d97706;">🏔️ Thổ nhưỡng:</strong> ${soilInfo.name || '—'}</div>
            <div style="color:#6b7280;">Mã: ${soilCode} | ${soilInfo.zoneType || ''}</div>
        </div>`;
    }

    const popupContent = `
        <div style="font-family:'Inter','Manrope',sans-serif;min-width:240px;font-size:13px;">
            <div style="padding:8px 10px;background:linear-gradient(135deg,#059669,#10b981);color:white;border-radius:8px 8px 0 0;margin:-13px -14px 10px -14px;">
                <div style="font-size:15px;font-weight:700;">Thửa ${info.parcelNumber || '—'}</div>
                <div style="font-size:11px;opacity:0.9;">Tờ BĐ: ${info.mapSheetNumber || '—'} | ${info.adminUnitName || ''}</div>
            </div>
            <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 8px;">
                <span style="color:#6b7280;">Diện tích:</span><span style="font-weight:600;">${area} ha</span>
                <span style="color:#6b7280;">Mục đích:</span><span>${colorBox}${info.landUseName || '—'}</span>
                <span style="color:#6b7280;">Địa chỉ:</span><span>${info.address || '—'}</span>
            </div>
            ${soilHtml}
            ${cropHtml}
        </div>`;

    L.popup({ maxWidth: 320 })
        .setLatLng(latlng)
        .setContent(popupContent)
        .openOn(map);
}

// ============ POINT-IN-POLYGON UTILITY ============

/**
 * Ray-casting point-in-polygon check
 */
function raycastPointInPolygon(lat, lng, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i].lat, yi = ring[i].lng;
        const xj = ring[j].lat, yj = ring[j].lng;
        const intersect = ((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * Find soil zone data at a given point by recursively traversing all layers
 * Uses bounding box for fast pre-filtering, then ray-casting for accuracy
 */
function findSoilZoneAtPoint(layerGroup, latlng) {
    let bestMatch = null;
    let bestMatchBbox = null;

    function checkAllRings(allLatLngs, lat, lng) {
        if (!allLatLngs || allLatLngs.length === 0) return false;
        // If first element has .lat, this is a ring of LatLngs
        if (allLatLngs[0] && allLatLngs[0].lat !== undefined) {
            return allLatLngs.length >= 3 && raycastPointInPolygon(lat, lng, allLatLngs);
        }
        // Otherwise, recurse into each sub-array (handles MultiPolygon)
        for (let i = 0; i < allLatLngs.length; i++) {
            if (Array.isArray(allLatLngs[i]) && checkAllRings(allLatLngs[i], lat, lng)) {
                return true;
            }
        }
        return false;
    }

    function traverse(layer, parentSoilData) {
        const soilData = layer.soilData || parentSoilData;

        if (layer.getLatLngs && soilData) {
            try {
                const bounds = layer.getBounds();
                if (bounds && bounds.isValid() && bounds.contains(latlng)) {
                    if (!bestMatchBbox) bestMatchBbox = soilData;

                    const allLatLngs = layer.getLatLngs();
                    if (checkAllRings(allLatLngs, latlng.lat, latlng.lng)) {
                        bestMatch = soilData;
                    }
                }
            } catch (e) { /* skip */ }
        }

        if (layer.eachLayer) {
            layer.eachLayer(child => traverse(child, soilData));
        }
    }

    traverse(layerGroup, null);
    return bestMatch || bestMatchBbox;
}

// ============ API FALLBACK FOR SOIL ZONE LOOKUP ============

/**
 * Fetch the nearest soil zone from the backend API when client-side detection fails.
 * Uses /planning-zones/near endpoint with mapType=soil filter.
 */
async function fetchSoilZoneFromAPI(latlng) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const url = `${API_BASE}/planning-zones/near?lat=${latlng.lat}&lng=${latlng.lng}&radius=0.01&mapType=soil`;
        const response = await fetch(url, { headers });
        if (!response.ok) return null;
        const zones = await response.json();
        if (zones && zones.length > 0) {
            // Return the closest soil zone
            console.log(`[SoilFallback] Found ${zones.length} soil zone(s) near ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)} via API`);
            return zones[0];
        }
    } catch (err) {
        console.warn('[SoilFallback] API lookup failed:', err);
    }
    return null;
}

// ============ SUITABILITY CLICK HANDLER ============

async function onUserMapClickSuitabilityInfo(e) {
    if (isAddFieldByParcelMode) return;
    const parcelInfo = await getParcelInfoAtPoint(e.latlng);

    // Find soil zone at click point using recursive traversal
    let soilInfo = null;
    if (userSoilOverlay) {
        soilInfo = findSoilZoneAtPoint(userSoilOverlay, e.latlng);
    }

    // API fallback: if client-side detection failed, query backend
    if (!soilInfo) {
        soilInfo = await fetchSoilZoneFromAPI(e.latlng);
    }

    showUserSuitabilityPopup(parcelInfo, soilInfo, e.latlng);
}

function showUserSuitabilityPopup(parcelInfo, soilInfo, latlng) {
    const landUseCode = parcelInfo?.landUseCode?.toUpperCase() || '';
    const area = parcelInfo?.areaSqm ? (parcelInfo.areaSqm / 10000).toFixed(4) : '—';
    const landUseSuit = CROP_SUITABILITY_MAP[landUseCode] || null;
    const soilCode = soilInfo?.zoneCode || '';
    let soilSuit = SOIL_CROP_SUITABILITY[soilCode] || null;
    if (!soilSuit && soilInfo?.zoneType) {
        soilSuit = SOIL_CROP_SUITABILITY[soilInfo.zoneType] || null;
    }
    if (!soilSuit && soilCode) {
        const matchKey = Object.keys(SOIL_CROP_SUITABILITY).find(k => soilCode.includes(k) || k.includes(soilCode));
        if (matchKey) soilSuit = SOIL_CROP_SUITABILITY[matchKey];
    }

    let html = `<div style="font-family:'Inter','Manrope',sans-serif;min-width:260px;font-size:13px;">`;
    html += `<div style="padding:8px 10px;background:linear-gradient(135deg,#7c3aed,#8b5cf6);color:white;border-radius:8px 8px 0 0;margin:-13px -14px 10px -14px;">
        <div style="font-size:15px;font-weight:700;">🌱 Thích nghi${parcelInfo ? ` - Thửa ${parcelInfo.parcelNumber || '—'}` : ''}</div>
    </div>`;

    if (parcelInfo) {
        const colorBox = `<span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${getUserLandUseColor(landUseCode)};margin-right:4px;vertical-align:middle;border:1px solid #666"></span>`;
        html += `<div style="display:grid;grid-template-columns:auto 1fr;gap:4px 8px;margin-bottom:8px;">
            <span style="color:#6b7280;">Diện tích:</span><span style="font-weight:600;">${area} ha</span>
            <span style="color:#6b7280;">Mục đích:</span><span>${colorBox}${parcelInfo.landUseName || '—'}</span>
            <span style="color:#6b7280;">Xã:</span><span>${parcelInfo.adminUnitName || '—'}</span>
        </div>`;
    }

    // Show soil zone info with full details
    if (soilInfo) {
        html += `<div style="padding:8px 10px;background:#fef3c7;border-radius:6px;margin-bottom:8px;">
            <div style="font-weight:700;color:#92400e;margin-bottom:4px;">🏔️ Thổ nhưỡng</div>
            <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 8px;font-size:12px;">
                <span style="color:#78350f;">Loại đất:</span><span style="font-weight:600;">${soilInfo.name || soilInfo.zoneType || '—'}</span>
                ${soilCode ? `<span style="color:#78350f;">Mã:</span><span>${soilCode}</span>` : ''}
                ${soilInfo.zoneType ? `<span style="color:#78350f;">Phân loại:</span><span>${soilInfo.zoneType}</span>` : ''}
                ${soilSuit?.description ? `<span style="color:#78350f;">Đặc điểm:</span><span>${soilSuit.description}</span>` : ''}
            </div>
        </div>`;
    }

    // Prefer soil-based crop suitability, fallback to land-use based
    const suit = soilSuit || landUseSuit;
    const suitSource = soilSuit ? 'thổ nhưỡng' : 'mục đích sử dụng đất';

    if (suit) {
        if (suit.crops && suit.crops.length > 0) {
            html += `<div style="margin-bottom:6px;"><b style="color:#166534;">🌾 Cây trồng phù hợp</b> <span style="font-size:10px;color:#9ca3af;">(theo ${suitSource})</span></div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">
                ${suit.crops.map(c => `<span style="padding:2px 8px;background:#dcfce7;color:#166534;border-radius:12px;font-size:11px;">${c}</span>`).join('')}
            </div>`;
        }
        if (suit.animals && suit.animals.length > 0) {
            html += `<div style="margin-bottom:6px;"><b style="color:#1d4ed8;">🐟 Vật nuôi phù hợp</b> <span style="font-size:10px;color:#9ca3af;">(theo ${suitSource})</span></div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">
                ${suit.animals.map(a => `<span style="padding:2px 8px;background:#dbeafe;color:#1d4ed8;border-radius:12px;font-size:11px;">${a}</span>`).join('')}
            </div>`;
        }
    }

    // Also show land-use suggestions if soil suit was used and land use has different info
    if (soilSuit && landUseSuit) {
        const extraCrops = landUseSuit.crops.filter(c => !soilSuit.crops.includes(c));
        const extraAnimals = landUseSuit.animals.filter(a => !soilSuit.animals.includes(a));
        if (extraCrops.length > 0 || extraAnimals.length > 0) {
            html += `<div style="margin-top:4px;padding:6px 8px;background:#f0fdf4;border-radius:6px;font-size:11px;">
                <b style="color:#166534;">Gợi ý thêm</b> <span style="color:#9ca3af;">(theo MĐSD: ${landUseCode})</span><br>`;
            if (extraCrops.length > 0) html += `🌾 ${extraCrops.join(', ')}<br>`;
            if (extraAnimals.length > 0) html += `🐟 ${extraAnimals.join(', ')}`;
            html += `</div>`;
        }
    }

    if (!parcelInfo && !soilInfo) {
        html += `<p style="color:#6b7280;text-align:center;padding:10px;">Không có dữ liệu tại vị trí này</p>`;
    }

    html += `<div style="margin-top:6px;font-size:10px;color:#9ca3af;text-align:center;">Dữ liệu: Thửa đất (iLIS) + Thổ nhưỡng (KMZ)</div>`;
    html += '</div>';
    L.popup({ maxWidth: 360 }).setLatLng(latlng).setContent(html).openOn(map);
}

// ============ LOCAL PARCELS OVERLAY (for tooltips) ============

async function loadUserLocalParcels() {
    const zoom = map.getZoom();
    if (zoom < 14) {
        if (userLocalParcelsLayer) {
            map.removeLayer(userLocalParcelsLayer);
            userLocalParcelsLayer = null;
        }
        return;
    }

    try {
        const bounds = map.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        const parcels = await fetch(`${API_BASE}/land-parcels/bounds?swLat=${sw.lat}&swLng=${sw.lng}&neLat=${ne.lat}&neLng=${ne.lng}`)
            .then(r => r.ok ? r.json() : []);

        if (userLocalParcelsLayer) map.removeLayer(userLocalParcelsLayer);

        const features = [];
        parcels.forEach(p => {
            if (!p.boundaryGeojson) return;
            try {
                const geom = typeof p.boundaryGeojson === 'string' ? JSON.parse(p.boundaryGeojson) : p.boundaryGeojson;
                features.push({
                    type: 'Feature', geometry: geom,
                    properties: { parcelNumber: p.parcelNumber, mapSheetNumber: p.mapSheetNumber, landUseCode: p.landUseCode, landUseName: p.landUseName, areaSqm: p.areaSqm, adminUnitName: p.adminUnitName }
                });
            } catch (e) { }
        });

        if (features.length === 0) return;

        userLocalParcelsLayer = L.geoJSON({ type: 'FeatureCollection', features }, {
            style: { fillOpacity: 0, color: 'transparent', weight: 0 },
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                const area = p.areaSqm ? (p.areaSqm / 10000).toFixed(4) : '—';
                layer.bindTooltip(
                    `<b>Thửa ${p.parcelNumber || '—'}</b> | Tờ: ${p.mapSheetNumber || '—'}<br>${p.landUseName || p.landUseCode || '?'} | ${area} ha`,
                    { className: 'land-parcel-tooltip', sticky: true }
                );
            },
            coordsToLatLng: coords => L.latLng(coords[1], coords[0])
        });
        userLocalParcelsLayer.addTo(map);
    } catch (e) {
        console.warn('Error loading local parcels:', e);
    }
}

function onUserMapMoveLoadParcels() {
    if (!userWmsActive) return;
    clearTimeout(window._userParcelLoadTimeout);
    window._userParcelLoadTimeout = setTimeout(() => loadUserLocalParcels(), 400);
}

// ============ SOIL ZONES ============

async function loadUserSoilZones(asSuitabilityOverlay = false, addToMap = true) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(`${API_BASE}/planning-zones?mapType=soil`, { headers });
        if (!response.ok) return;
        const zones = await response.json();
        if (!zones || zones.length === 0) return;

        if (userSoilOverlay) map.removeLayer(userSoilOverlay);
        userSoilOverlay = L.layerGroup();

        zones.forEach(zone => {
            try {
                let layer = null;

                // 1. Try image overlay first (like admin does)
                if (zone.imageUrl && zone.boundaryCoordinates && !asSuitabilityOverlay) {
                    try {
                        const coords = typeof zone.boundaryCoordinates === 'string'
                            ? JSON.parse(zone.boundaryCoordinates) : zone.boundaryCoordinates;
                        if (coords && coords.length > 2) {
                            const lats = coords.map(c => c[0]);
                            const lngs = coords.map(c => c[1]);
                            const imgBounds = [
                                [Math.min(...lats), Math.min(...lngs)],
                                [Math.max(...lats), Math.max(...lngs)]
                            ];
                            const imageUrl = zone.imageUrl.startsWith('/')
                                ? API_BASE.replace('/api', '') + zone.imageUrl : zone.imageUrl;
                            const imageOverlay = L.imageOverlay(imageUrl, imgBounds, {
                                opacity: 0.85,
                                interactive: true,
                                className: 'soil-image-overlay'
                            });
                            imageOverlay.soilData = zone;
                            imageOverlay.on('click', (e) => {
                                L.DomEvent.stopPropagation(e);
                                showSoilZonePopup(zone, e.latlng);
                            });
                            userSoilOverlay.addLayer(imageOverlay);
                            // Apply blend mode after adding
                            setTimeout(() => {
                                document.querySelectorAll('.soil-image-overlay').forEach(el => {
                                    el.style.mixBlendMode = 'multiply';
                                });
                            }, 100);
                        }
                    } catch (imgErr) { /* fallback to geojson/coords below */ }
                }

                // 2. Try GeoJSON polygon
                if (zone.geojson) {
                    const geojson = typeof zone.geojson === 'string' ? JSON.parse(zone.geojson) : zone.geojson;
                    layer = L.geoJSON(geojson, {
                        style: {
                            fillColor: zone.fillColor || '#ccc',
                            fillOpacity: asSuitabilityOverlay ? 0.2 : 0.35,
                            color: zone.fillColor || '#999',
                            weight: asSuitabilityOverlay ? 1 : 2,
                            opacity: asSuitabilityOverlay ? 0.4 : 0.7,
                            dashArray: asSuitabilityOverlay ? '4 4' : null
                        },
                        onEachFeature: (feature, lyr) => {
                            lyr.soilData = zone;
                            const tooltipText = `<b>${zone.name || zone.zoneType || 'Thổ nhưỡng'}</b>${zone.zoneType ? '<br>' + zone.zoneType : ''}`;
                            lyr.bindTooltip(tooltipText, { className: 'soil-tooltip', sticky: true, opacity: 0.9 });
                            if (!asSuitabilityOverlay) {
                                lyr.on('click', (e) => {
                                    L.DomEvent.stopPropagation(e);
                                    showSoilZonePopup(zone, e.latlng);
                                });
                            }
                        },
                        coordsToLatLng: coords => L.latLng(coords[1], coords[0])
                    });
                }

                // 3. Fallback to boundaryCoordinates
                if (!layer && zone.boundaryCoordinates) {
                    const coords = typeof zone.boundaryCoordinates === 'string'
                        ? JSON.parse(zone.boundaryCoordinates) : zone.boundaryCoordinates;
                    if (coords && coords.length > 2) {
                        layer = L.polygon(coords, {
                            fillColor: zone.fillColor || '#ccc',
                            fillOpacity: asSuitabilityOverlay ? 0.2 : 0.35,
                            color: zone.fillColor || '#999',
                            weight: asSuitabilityOverlay ? 1 : 2,
                            opacity: asSuitabilityOverlay ? 0.4 : 0.7,
                            dashArray: asSuitabilityOverlay ? '4 4' : null
                        });
                        layer.soilData = zone;
                        const tooltipText = `<b>${zone.name || zone.zoneType || 'Thổ nhưỡng'}</b>${zone.zoneType ? '<br>' + zone.zoneType : ''}`;
                        layer.bindTooltip(tooltipText, { className: 'soil-tooltip', sticky: true, opacity: 0.9 });
                        if (!asSuitabilityOverlay) {
                            layer.on('click', (e) => {
                                L.DomEvent.stopPropagation(e);
                                showSoilZonePopup(zone, e.latlng);
                            });
                        }
                    }
                }

                if (layer) userSoilOverlay.addLayer(layer);
            } catch (e) { console.warn('Error loading soil zone:', zone.name, e); }
        });

        if (addToMap) userSoilOverlay.addTo(map);

        // Fit to soil zones bounds if direct soil view
        if (!asSuitabilityOverlay && zones.length > 0) {
            try {
                const allBounds = userSoilOverlay.getBounds();
                if (allBounds.isValid()) map.fitBounds(allBounds, { padding: [30, 30] });
            } catch (e) { }
        }
    } catch (error) {
        console.error('Error loading soil zones:', error);
    }
}

function showSoilZonePopup(zone, latlng) {
    const soilCode = zone.zoneCode || '';
    const suitData = SOIL_CROP_SUITABILITY[soilCode] || null;

    let html = `
        <div style="font-family:'Inter','Manrope',sans-serif;min-width:260px;font-size:13px;">
            <div style="padding:8px 10px;background:linear-gradient(135deg,#92400e,#d97706);color:white;border-radius:8px 8px 0 0;margin:-13px -14px 10px -14px;">
                <div style="font-size:15px;font-weight:700;">🏔️ ${zone.name || zone.zoneType || 'Thổ nhưỡng'}</div>
                <div style="font-size:11px;opacity:0.9;">${soilCode}</div>
            </div>
            <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 8px;margin-bottom:8px;">
                ${zone.zoneType ? `<span style="color:#6b7280;">Phân loại:</span><span style="font-weight:600;">${zone.zoneType}</span>` : ''}
                ${soilCode ? `<span style="color:#6b7280;">Mã:</span><span>${soilCode}</span>` : ''}
                ${suitData?.description ? `<span style="color:#6b7280;">Đặc điểm:</span><span>${suitData.description}</span>` : ''}
                ${zone.notes ? `<span style="color:#6b7280;">Ghi chú:</span><span>${zone.notes}</span>` : ''}
                ${zone.landUsePurpose ? `<span style="color:#6b7280;">Mục đích:</span><span style="color:#166534;">${zone.landUsePurpose}</span>` : ''}
            </div>`;

    // Show crop suitability from SOIL_CROP_SUITABILITY mapping
    if (suitData) {
        if (suitData.crops && suitData.crops.length > 0) {
            html += `<div style="margin-bottom:6px;"><b style="color:#166534;">🌾 Cây trồng phù hợp</b></div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">
                ${suitData.crops.map(c => `<span style="padding:2px 8px;background:#dcfce7;color:#166534;border-radius:12px;font-size:11px;">${c}</span>`).join('')}
            </div>`;
        }
        if (suitData.animals && suitData.animals.length > 0) {
            html += `<div style="margin-bottom:6px;"><b style="color:#1d4ed8;">🐟 Vật nuôi phù hợp</b></div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">
                ${suitData.animals.map(a => `<span style="padding:2px 8px;background:#dbeafe;color:#1d4ed8;border-radius:12px;font-size:11px;">${a}</span>`).join('')}
            </div>`;
        }
    }

    html += `<div style="margin-top:4px;font-size:10px;color:#9ca3af;text-align:center;">Dữ liệu: Thổ nhưỡng (KMZ)</div>`;
    html += '</div>';
    L.popup({ maxWidth: 340 }).setLatLng(latlng).setContent(html).openOn(map);
}

// ============ SUITABILITY LEGEND ============

function showUserSuitabilityLegend() {
    let legend = document.getElementById('user-suitability-legend');
    if (!legend) {
        legend = document.createElement('div');
        legend.id = 'user-suitability-legend';
        legend.className = 'planning-legend';
        legend.innerHTML = `
            <div class="planning-legend__header" style="background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%);">
                <span class="material-symbols-outlined">eco</span>
                <span>Bản đồ Thích nghi</span>
                <button class="planning-legend__close" onclick="toggleUserMapLayer('suitability')" title="Đóng">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="planning-legend__items" style="max-height:180px;overflow-y:auto;">
                <div class="planning-legend__item">
                    <span class="planning-legend__dot" style="background: #22c55e;"></span>
                    <span>Rất phù hợp nông nghiệp</span>
                </div>
                <div class="planning-legend__item">
                    <span class="planning-legend__dot" style="background: #f59e0b;"></span>
                    <span>Phù hợp trung bình</span>
                </div>
                <div class="planning-legend__item">
                    <span class="planning-legend__dot" style="background: #3b82f6;"></span>
                    <span>Nuôi trồng thủy sản</span>
                </div>
                <div class="planning-legend__item">
                    <span class="planning-legend__dot" style="background: #166534;"></span>
                    <span>Đất rừng</span>
                </div>
                <div class="planning-legend__item">
                    <span class="planning-legend__dot" style="background: #6b7280;"></span>
                    <span>Đất phi nông nghiệp</span>
                </div>
            </div>
            <div class="planning-legend__info" style="padding:8px 12px;font-size:11px;color:#5b21b6;background:#ede9fe;border-radius:0 0 8px 8px;">
                <span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;">lightbulb</span>
                Click vào thửa đất để xem cây trồng/vật nuôi phù hợp
            </div>`;
        document.getElementById('map-container').appendChild(legend);
    }
    legend.style.display = 'block';
}

// ============ LAYER TOGGLE FOR BUTTONS ============

function toggleUserMapLayer(layerType) {
    // If clicking the same active layer, deactivate it
    if (userMapCurrentLayer === layerType) {
        deactivateAllUserMapLayers();
        // Deactivate button
        document.querySelectorAll('.map-layer-btn--planning, .map-layer-btn--soil, .map-layer-btn--suitability')
            .forEach(b => b.classList.remove('active'));
        return;
    }

    // Activate selected layer
    switch (layerType) {
        case 'planning': activateUserPlanningLayer(); break;
        case 'soil': activateUserSoilLayer(); break;
        case 'suitability': activateUserSuitabilityLayer(); break;
    }
}

// ============ ADD FIELD BY PARCEL (NEW LOGIC) ============

/**
 * Start "add field by parcel" mode:
 * 1. Switch to suitability tab
 * 2. Zoom into Cà Mau area
 * 3. User clicks a parcel → system opens confirmation form
 */
function startAddFieldByParcel() {
    isAddFieldByParcelMode = true;

    // Switch to suitability layer
    const suitBtn = document.querySelector('.map-layer-btn--suitability');
    if (suitBtn && !suitBtn.classList.contains('active')) {
        suitBtn.click();
    }

    // Pan to Cà Mau area if not already
    const center = map.getCenter();
    if (center.lat < 9.0 || center.lat > 9.6 || center.lng < 104.8 || center.lng > 105.5) {
        map.setView([9.30, 105.15], 14);
    } else {
        map.setZoom(Math.max(map.getZoom(), 14));
    }

    // Show instruction banner
    const banner = document.createElement('div');
    banner.id = 'add-field-parcel-banner';
    banner.style.cssText = 'position:absolute;top:60px;left:50%;transform:translateX(-50%);z-index:1100;background:linear-gradient(135deg,#7c3aed,#8b5cf6);color:white;padding:10px 20px;border-radius:12px;box-shadow:0 4px 20px rgba(124,58,237,0.4);display:flex;align-items:center;gap:12px;font-size:14px;font-family:Inter,sans-serif;';
    banner.innerHTML = `
        <span class="material-symbols-outlined" style="font-size:22px;">touch_app</span>
        <span><b>Chế độ thêm ruộng:</b> Click vào thửa đất trên bản đồ để chọn</span>
        <button onclick="cancelAddFieldByParcel()" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:13px;margin-left:8px;">Hủy</button>
    `;
    document.getElementById('map-container').appendChild(banner);

    // Change cursor
    document.getElementById('leaflet-map').style.cursor = 'crosshair';

    // Override click handler
    map.off('click', onUserMapClickParcelInfo);
    map.off('click', onUserMapClickSuitabilityInfo);
    map.on('click', onAddFieldByParcelClick);
}

function cancelAddFieldByParcel() {
    isAddFieldByParcelMode = false;
    const banner = document.getElementById('add-field-parcel-banner');
    if (banner) banner.remove();
    document.getElementById('leaflet-map').style.cursor = '';

    map.off('click', onAddFieldByParcelClick);

    // Restore normal click handler based on current layer
    if (userMapCurrentLayer === 'planning') {
        map.on('click', onUserMapClickParcelInfo);
    } else if (userMapCurrentLayer === 'suitability') {
        map.on('click', onUserMapClickSuitabilityInfo);
    }

    // Remove highlight
    if (addFieldByParcelHighlight) {
        map.removeLayer(addFieldByParcelHighlight);
        addFieldByParcelHighlight = null;
    }
}

async function onAddFieldByParcelClick(e) {
    if (!isAddFieldByParcelMode) return;

    const latlng = e.latlng;

    // Get parcel info from WMS
    const parcelInfo = await getParcelInfoAtPoint(latlng);
    if (!parcelInfo) {
        showToastMessage('Không tìm thấy', 'Không có thửa đất tại vị trí này. Thử click vào vùng khác.');
        return;
    }

    // Try to get geometry from local DB for accurate boundary
    let parcelGeometry = null;
    try {
        const localParcels = await fetch(`${API_BASE}/land-parcels/bounds?swLat=${latlng.lat - 0.002}&swLng=${latlng.lng - 0.002}&neLat=${latlng.lat + 0.002}&neLng=${latlng.lng + 0.002}`)
            .then(r => r.ok ? r.json() : []);

        // Find matching parcel
        const match = localParcels.find(p =>
            p.parcelNumber == parcelInfo.parcelNumber &&
            p.mapSheetNumber == parcelInfo.mapSheetNumber
        );
        if (match && match.boundaryGeojson) {
            parcelGeometry = typeof match.boundaryGeojson === 'string' ? JSON.parse(match.boundaryGeojson) : match.boundaryGeojson;
        }
    } catch (e) { console.warn('Could not fetch local parcel geometry:', e); }

    // Highlight the selected parcel
    if (addFieldByParcelHighlight) {
        map.removeLayer(addFieldByParcelHighlight);
    }

    if (parcelGeometry) {
        addFieldByParcelHighlight = L.geoJSON(parcelGeometry, {
            style: {
                fillColor: '#8b5cf6',
                fillOpacity: 0.3,
                color: '#7c3aed',
                weight: 3,
                dashArray: '5 5'
            },
            coordsToLatLng: coords => L.latLng(coords[1], coords[0])
        }).addTo(map);
    } else {
        // Fallback: circle marker at click point
        addFieldByParcelHighlight = L.circleMarker(latlng, {
            radius: 20,
            fillColor: '#8b5cf6',
            fillOpacity: 0.3,
            color: '#7c3aed',
            weight: 3
        }).addTo(map);
    }

    // Show field creation modal with parcel info pre-filled
    showParcelFieldCreationModal(parcelInfo, parcelGeometry, latlng);
}

function showParcelFieldCreationModal(parcelInfo, geometry, latlng) {
    const area = parcelInfo.areaSqm ? (parcelInfo.areaSqm / 10000).toFixed(2) : '—';
    const colorBox = `<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${getUserLandUseColor(parcelInfo.landUseCode)};margin-right:6px;vertical-align:middle;border:1px solid #999"></span>`;

    const suit = CROP_SUITABILITY_MAP[parcelInfo.landUseCode?.toUpperCase()] || null;
    let cropHtml = '';
    if (suit && suit.crops.length > 0) {
        cropHtml = `<div style="margin-top:8px;"><b style="color:#166534;font-size:12px;">🌾 Cây trồng phù hợp:</b>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
                ${suit.crops.map(c => `<span style="padding:2px 8px;background:#dcfce7;color:#166534;border-radius:12px;font-size:11px;">${c}</span>`).join('')}
            </div>
        </div>`;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'parcel-field-modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:480px;font-family:'Inter','Manrope',sans-serif;">
            <div class="modal-header" style="background:linear-gradient(135deg,#7c3aed,#8b5cf6);color:white;">
                <div>
                    <h3 style="margin:0;font-size:18px;">
                        <span class="material-symbols-outlined" style="vertical-align:middle;">add_location_alt</span>
                        Thêm mảnh ruộng từ thửa đất
                    </h3>
                    <p style="margin:4px 0 0;font-size:12px;opacity:0.9;">Thửa ${parcelInfo.parcelNumber || '—'} | Tờ BĐ ${parcelInfo.mapSheetNumber || '—'}</p>
                </div>
                <span class="close-modal" onclick="cancelParcelFieldCreation()" style="color:white;cursor:pointer;font-size:24px;">&times;</span>
            </div>
            <div class="modal-body" style="padding:20px;">
                <!-- Parcel info summary -->
                <div style="padding:12px;background:#f5f3ff;border-radius:10px;margin-bottom:16px;border-left:4px solid #7c3aed;">
                    <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:13px;">
                        <span style="color:#6b7280;">Diện tích:</span>
                        <span style="font-weight:600;">${area} ha (${parcelInfo.areaSqm ? Math.round(parcelInfo.areaSqm).toLocaleString() : '—'} m²)</span>
                        <span style="color:#6b7280;">Mục đích SD:</span>
                        <span>${colorBox}${parcelInfo.landUseName || '—'}</span>
                        <span style="color:#6b7280;">Xã:</span>
                        <span>${parcelInfo.adminUnitName || '—'}</span>
                        <span style="color:#6b7280;">Địa chỉ:</span>
                        <span>${parcelInfo.address || '—'}</span>
                    </div>
                    ${cropHtml}
                </div>

                <!-- Field name input -->
                <div class="form-group" style="margin-bottom:16px;">
                    <label style="display:block;margin-bottom:6px;font-weight:600;font-size:14px;">Tên mảnh ruộng</label>
                    <input type="text" id="parcel-field-name" placeholder="VD: Ruộng lúa Thới Bình" 
                        style="width:100%;padding:10px 14px;border:2px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;transition:border-color 0.2s;"
                        onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='#e5e7eb'"
                        value="Thửa ${parcelInfo.parcelNumber || ''} - ${parcelInfo.adminUnitName || ''}">
                </div>

                <!-- Certificate upload -->
                <div class="form-group" style="margin-bottom:16px;">
                    <label style="display:block;margin-bottom:6px;font-weight:600;font-size:14px;">Giấy chứng nhận QSDĐ (tùy chọn)</label>
                    <p style="font-size:12px;color:#6b7280;margin-bottom:8px;">Upload ảnh giấy tờ để xác minh quyền sở hữu</p>
                    <input type="file" id="parcel-certificate-input" accept="image/*" style="display:none;">
                    <div id="parcel-certificate-preview" 
                        style="width:100%;min-height:80px;border:2px dashed #d1d5db;border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color 0.2s;background:#fafafa;"
                        onclick="document.getElementById('parcel-certificate-input').click()">
                        <div style="text-align:center;color:#9ca3af;">
                            <span class="material-symbols-outlined" style="font-size:32px;">upload_file</span>
                            <p style="margin:4px 0 0;font-size:12px;">Click để upload ảnh giấy tờ</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="padding:12px 20px;display:flex;gap:10px;justify-content:flex-end;border-top:1px solid #e5e7eb;">
                <button onclick="cancelParcelFieldCreation()" class="btn btn--secondary" style="padding:8px 20px;border-radius:10px;">Hủy</button>
                <button onclick="confirmParcelFieldCreation()" class="btn btn--primary" style="padding:8px 20px;border-radius:10px;background:#7c3aed;">
                    <span class="material-symbols-outlined" style="font-size:18px;vertical-align:middle;">check</span> Xác nhận thêm ruộng
                </button>
            </div>
        </div>`;
    document.body.appendChild(modal);

    // Store data in DOM for later use
    modal.dataset.parcelInfo = JSON.stringify(parcelInfo);
    modal.dataset.geometry = geometry ? JSON.stringify(geometry) : '';
    modal.dataset.lat = latlng.lat;
    modal.dataset.lng = latlng.lng;

    // Certificate preview handler
    document.getElementById('parcel-certificate-input').onchange = function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (ev) {
                document.getElementById('parcel-certificate-preview').innerHTML = `
                    <img src="${ev.target.result}" style="max-width:100%;max-height:150px;border-radius:8px;">`;
            };
            reader.readAsDataURL(file);
        }
    };
}

function cancelParcelFieldCreation() {
    const modal = document.getElementById('parcel-field-modal');
    if (modal) modal.remove();
    cancelAddFieldByParcel();
}

async function confirmParcelFieldCreation() {
    const modal = document.getElementById('parcel-field-modal');
    if (!modal) return;

    const name = document.getElementById('parcel-field-name').value.trim();
    if (!name) {
        alert('Vui lòng nhập tên mảnh ruộng');
        return;
    }

    const parcelInfo = JSON.parse(modal.dataset.parcelInfo);
    const geometryStr = modal.dataset.geometry;
    const lat = parseFloat(modal.dataset.lat);
    const lng = parseFloat(modal.dataset.lng);

    // Build coordinates from geometry or click point
    let coordinates;
    let areaSqm = parcelInfo.areaSqm || 0;

    if (geometryStr) {
        try {
            const geom = JSON.parse(geometryStr);
            // Extract first polygon ring
            let coords = geom.coordinates;
            if (geom.type === 'MultiPolygon') coords = coords[0];
            if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') coords = coords[0];
            coordinates = JSON.stringify(coords.map(c => [c[1], c[0]])); // [lng,lat] → [lat,lng]
        } catch (e) {
            coordinates = JSON.stringify([[lat, lng], [lat + 0.001, lng], [lat + 0.001, lng + 0.001], [lat, lng + 0.001], [lat, lng]]);
        }
    } else {
        // Create small polygon around click point
        const d = 0.001;
        coordinates = JSON.stringify([[lat - d, lng - d], [lat + d, lng - d], [lat + d, lng + d], [lat - d, lng + d], [lat - d, lng - d]]);
        if (!areaSqm) areaSqm = 5000; // Default ~0.5 ha
    }

    // Get user's farm - reuse currentFarmId if already loaded, otherwise fetch
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    try {
        let farmId = (typeof currentFarmId !== 'undefined' && currentFarmId) ? currentFarmId : null;
        if (!farmId) {
            // Fallback: try loadCurrentFarm() if available, otherwise fetch directly
            if (typeof loadCurrentFarm === 'function') {
                const hasFarm = await loadCurrentFarm();
                farmId = hasFarm ? currentFarmId : null;
            } else {
                const farmsRes = await fetch(`${API_BASE}/farms/my-farms`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const farms = await farmsRes.json();
                farmId = (farms && farms.length > 0) ? farms[0].id : null;
            }
        }
        if (!farmId) {
            showToastMessage('Lỗi', 'Không tìm thấy nông trại. Vui lòng tạo nông trại trước.');
            return;
        }

        // Save field
        const res = await fetch(`${API_BASE}/fields`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                farmId,
                name,
                boundaryCoordinates: coordinates,
                areaSqm: Math.round(areaSqm)
            })
        });

        if (res.ok) {
            const field = await res.json();
            showToastMessage('Thành công!', `Đã thêm ruộng "${name}" (${(areaSqm / 10000).toFixed(2)} ha)`);

            // Close modal and clean up
            modal.remove();
            cancelAddFieldByParcel();

            // Reload fields on map
            if (typeof loadFieldsFromAPI === 'function') loadFieldsFromAPI();
            else if (typeof loadFields === 'function') loadFields();
        } else {
            const err = await res.text();
            showToastMessage('Lỗi', 'Không thể tạo ruộng: ' + err);
        }
    } catch (error) {
        console.error('Error creating field from parcel:', error);
        showToastMessage('Lỗi', 'Đã xảy ra lỗi khi tạo ruộng');
    }
}

// ============ TOAST HELPER ============
function showToastMessage(title, message) {
    // Use existing showToast if available, otherwise create simple notification
    if (typeof showToast === 'function') {
        showToast(title, message, 'success');
        return;
    }

    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;background:#10b981;color:white;padding:12px 20px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.2);font-family:Inter,sans-serif;font-size:14px;animation:slideIn 0.3s ease;';
    toast.innerHTML = `<b>${title}</b><br><span style="font-size:12px;opacity:0.9;">${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ============ INIT LAYER BUTTONS ============
// Note: Button click handlers are set in the inline script's setupControls() function
// in cultivation.html. Do NOT add duplicate handlers here — they conflict and cause
// double-toggle (layer activates then immediately deactivates = nothing visible).
