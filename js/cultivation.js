// Global variables
// API_BASE_URL is already defined in config.js
let map;
let drawnItems;
var currentFieldId = null; // Use var to allow sharing with pest-analysis.js
var currentFieldData = null;
let currentLocation = { lat: 10.0342, lng: 105.7805, name: "Cần Thơ, Việt Nam" }; // Default: Can Tho
let weatherInterval;
let selectedFertilizer = null;
let selectedMachinery = null;

// Initialize Map
function initMap() {
    map = L.map('leaflet-map').setView([currentLocation.lat, currentLocation.lng], 13);

    // Hybrid layer (Satellite + Labels)
    L.tileLayer('http://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(map);

    // Initialize FeatureGroup to store editable layers
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Initialize Draw Control
    const drawControl = new L.Control.Draw({
        draw: {
            polygon: {
                allowIntersection: false,
                showArea: true,
                drawError: { color: '#e1e100', message: '<strong>Lỗi:</strong> các đường không được cắt nhau!' },
                shapeOptions: { color: '#10b981' }
            },
            polyline: false, circle: false, rectangle: false, marker: false, circlemarker: false
        },
        edit: { featureGroup: drawnItems }
    });
    map.addControl(drawControl);

    // Handle Draw Events
    map.on(L.Draw.Event.CREATED, function (e) {
        const layer = e.layer;
        drawnItems.addLayer(layer);

        // Calculate area
        const latLngs = layer.getLatLngs()[0];
        const area = L.GeometryUtil.geodesicArea(latLngs); // sqm

        const coordinates = JSON.stringify(latLngs.map(ll => [ll.lat, ll.lng]));

        // Open modal to save field
        const name = prompt("Nhập tên cho mảnh ruộng mới:", "Ruộng mới");
        if (name) {
            saveField(name, coordinates, area, layer);
        } else {
            drawnItems.removeLayer(layer);
        }
    });

    // Load saved fields
    loadFields();

    // Map controls
    document.getElementById('zoom-in').onclick = () => map.setZoom(map.getZoom() + 1);
    document.getElementById('zoom-out').onclick = () => map.setZoom(map.getZoom() - 1);
    document.getElementById('current-location').onclick = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                updateLocation(lat, lng, "Vị trí của bạn");
            });
        }
    };

    // Load saved map position
    loadMapPosition();

    // Save map position on move
    map.on('moveend', debounce(saveMapPosition, 1000));
}

// Location Search
document.getElementById('search-location').onclick = () => {
    const query = document.getElementById('location-input').value;
    if (query) searchLocation(query);
};

document.getElementById('location-input').onkeypress = (e) => {
    if (e.key === 'Enter') {
        const query = e.target.value;
        if (query) searchLocation(query);
    }
};

async function searchLocation(query) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            updateLocation(lat, lng, data[0].display_name.split(',')[0]);
        } else {
            alert('Không tìm thấy địa điểm này');
        }
    } catch (error) {
        console.error('Search error:', error);
    }
}

function updateLocation(lat, lng, name) {
    currentLocation = { lat, lng, name };
    map.setView([lat, lng], 13);
    document.getElementById('location-input').value = name;
    fetchWeather();
    fetchForecast(5);

    // Save new location preference
    saveMapPosition();
}

async function loadMapPosition() {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/user/map-position`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.mapLat && data.mapLng) {
                map.setView([data.mapLat, data.mapLng], data.mapZoom || 13);
                currentLocation.lat = data.mapLat;
                currentLocation.lng = data.mapLng;
            }
        }
    } catch (error) {
        console.error('Error loading map position:', error);
    }
}

async function saveMapPosition() {
    try {
        const center = map.getCenter();
        const zoom = map.getZoom();
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        if (!token) return;

        await fetch(`${API_BASE_URL}/user/map-position`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                mapLat: center.lat,
                mapLng: center.lng,
                mapZoom: zoom
            })
        });
    } catch (error) {
        console.error('Error saving map position:', error);
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Field Management
async function saveField(name, coordinates, areaSqm, layer) {
    // Determine farmId (using 1 for demo or prompt user/select farm)
    // For now assuming user has at least one farm or we use a default
    // Ideally we should have a farm selection context. 
    // Let's assume farmId=1 for simplicity or fetch first farm.
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const farmsResponse = await fetch(`${API_BASE_URL}/farms/my-farms`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const farms = await farmsResponse.json();

        if (farms.length === 0) {
            alert("Bạn cần tạo nông trại trước khi vẽ ruộng!");
            drawnItems.removeLayer(layer);
            return;
        }

        const farmId = farms[0].id; // Use first farm for now

        const response = await fetch(`${API_BASE_URL}/fields`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                farmId: farmId,
                name: name,
                boundaryCoordinates: coordinates,
                areaSqm: areaSqm
            })
        });

        if (response.ok) {
            const field = await response.json();
            layer.feature = { properties: field }; // Store field data in layer
            layer.on('click', () => handleFieldClick(field));
            showNotification('Đã lưu mảnh ruộng thành công!', 'success');
        } else {
            throw new Error('Save failed');
        }
    } catch (error) {
        console.error('Save field error:', error);
        alert('Lỗi khi lưu mảnh ruộng');
        drawnItems.removeLayer(layer);
    }
}

async function loadFields() {
    console.log('loadFields() called');

    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    console.log('Token found:', token ? 'yes' : 'no');

    if (!token) {
        console.log('No auth token found, skipping field load');
        return;
    }

    try {
        // Load farms first
        const farmsResponse = await fetch(`${API_BASE_URL}/farms/my-farms`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!farmsResponse.ok) {
            console.log('Failed to fetch farms');
            return;
        }

        const farms = await farmsResponse.json();
        console.log('Loaded farms for cultivation:', farms.length);

        if (farms.length > 0) {
            const farmId = farms[0].id; // Load fields for first farm
            window._cultivationFarmId = farmId; // Store for field loss loading
            console.log('Loading fields for farmId:', farmId);

            const fieldsResponse = await fetch(`${API_BASE_URL}/fields?farmId=${farmId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (fieldsResponse.ok) {
                const fields = await fieldsResponse.json();
                console.log('Loaded fields:', fields.length);

                fields.forEach(field => {
                    const coords = JSON.parse(field.boundaryCoordinates);
                    const polygon = L.polygon(coords, { color: getFieldColor(field.status) });
                    polygon.feature = { properties: field };
                    polygon.addTo(drawnItems);
                    polygon.on('click', () => handleFieldClick(field));

                    // Popup with Pest Analysis Button
                    polygon.bindPopup(`
                    <div style="text-align:center;">
                        <h4 style="margin:0 0 8px 0;">${field.name}</h4>
                        <button onclick="openPestAnalysisModal(${field.id})" 
                                style="background:#10b981; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; display:flex; align-items:center; gap:4px; margin:0 auto;">
                            <span class="material-symbols-outlined" style="font-size:16px;">bug_report</span> 
                            Phân tích sâu bệnh
                        </button>
                    </div>
                `);
                });
            }

            // Load field losses after fields are rendered
            loadFieldLosses(farmId);
        } else {
            console.log('No farms found for current user');
        }
    } catch (error) {
        console.error('Error loading fields:', error);
    }
}

function getFieldColor(status) {
    if (status === 'ACTIVE') return '#10b981'; // Green
    if (status === 'FALLOW') return '#f59e0b'; // Amber/Yellow
    return '#6b7280'; // Gray
}

// ── Field Losses overlay on cultivation map ──
let _fieldLossLayers = [];

async function loadFieldLosses(farmId) {
    if (!farmId) farmId = window._cultivationFarmId;
    if (!farmId) return;

    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (!token) return;

    // Clear previous loss layers
    _fieldLossLayers.forEach(l => { if (map.hasLayer(l)) map.removeLayer(l); });
    _fieldLossLayers = [];

    try {
        const res = await fetch(`${API_BASE_URL}/field-losses/farm/${farmId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const losses = await res.json();

        const causeLabels = { DISEASE: 'Dịch bệnh', PESTS: 'Sâu bệnh', WEATHER: 'Thời tiết', FLOOD: 'Ngập lụt', DROUGHT: 'Hạn hán', OTHER: 'Khác' };

        losses.forEach(loss => {
            if (!loss.lossPolygon) return;
            let coords;
            try {
                coords = typeof loss.lossPolygon === 'string' ? JSON.parse(loss.lossPolygon) : loss.lossPolygon;
            } catch (e) { return; }
            if (!Array.isArray(coords) || coords.length < 3) return;

            const polygon = L.polygon(coords, {
                color: '#dc2626', weight: 2, fillColor: '#dc2626', fillOpacity: 0.25, dashArray: '4,4'
            });

            const areaTxt = loss.lossAreaSqm < 10000
                ? `${Number(loss.lossAreaSqm).toFixed(1)} m²`
                : `${(Number(loss.lossAreaSqm) / 10000).toFixed(3)} ha`;
            const pct = loss.lossPercentage ? `${Number(loss.lossPercentage).toFixed(1)}%` : '';
            const valTxt = loss.estimatedLossValue ? new Intl.NumberFormat('vi-VN').format(Math.round(loss.estimatedLossValue)) + ' ₫' : '';
            const dateStr = loss.reportDate || '';
            const cause = causeLabels[loss.cause] || loss.cause || '';

            polygon.bindPopup(`
                <div style="min-width:180px;">
                    <div style="font-weight:700; color:#dc2626; margin-bottom:6px; display:flex; align-items:center; gap:4px;">
                        <span class="material-icons-round" style="font-size:16px;">warning</span>
                        Vùng thiệt hại
                    </div>
                    <div style="font-size:13px; color:#374151;">
                        <div><b>Diện tích:</b> ${areaTxt} ${pct ? `(${pct})` : ''}</div>
                        <div><b>Nguyên nhân:</b> ${cause}${loss.causeDetail ? ' — ' + loss.causeDetail : ''}</div>
                        ${valTxt ? `<div><b>Thiệt hại:</b> ${valTxt}</div>` : ''}
                        ${dateStr ? `<div><b>Ngày:</b> ${dateStr}</div>` : ''}
                        ${loss.reportedBy ? `<div><b>Báo cáo:</b> ${loss.reportedBy}</div>` : ''}
                        ${loss.notes ? `<div style="margin-top:4px; font-style:italic; color:#6b7280;">${loss.notes}</div>` : ''}
                    </div>
                </div>
            `);

            polygon.addTo(map);
            _fieldLossLayers.push(polygon);
        });

        // Store losses for analytics
        window._fieldLossesData = losses;
    } catch (err) {
        console.error('Error loading field losses:', err);
    }
}

// ── Field Loss Analytics Modal ──
async function openFieldLossAnalytics() {
    const farmId = window._cultivationFarmId;
    if (!farmId) {
        alert('Chưa có trang trại.');
        return;
    }

    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE_URL}/field-losses/farm/${farmId}/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Không thể tải dữ liệu thống kê');
        const stats = await res.json();

        const totalRecords = stats.totalRecords || 0;
        const totalLossArea = Number(stats.totalLossAreaSqm || stats.totalLossArea) || 0;
        const totalLossValue = Number(stats.totalLossValue) || 0;
        const causeDistribution = stats.causeDistribution || {};
        const fieldSummaries = stats.fieldSummaries || [];

        // Calculate average loss percentage from field summaries
        let avgLossPercentage = 0;
        if (fieldSummaries.length > 0) {
            const sumPct = fieldSummaries.reduce((sum, fs) => sum + (Number(fs.lossPercentage) || 0), 0);
            avgLossPercentage = sumPct / fieldSummaries.length;
        }

        const causeLabels = { DISEASE: 'Dịch bệnh', PESTS: 'Sâu bệnh', WEATHER: 'Thời tiết', FLOOD: 'Ngập lụt', DROUGHT: 'Hạn hán', OTHER: 'Khác' };
        const causeColors = { DISEASE: '#dc2626', PESTS: '#ea580c', WEATHER: '#2563eb', FLOOD: '#0891b2', DROUGHT: '#d97706', OTHER: '#6b7280' };

        // Build cause distribution rows
        let causeRows = '';
        let causeChartLabels = [];
        let causeChartData = [];
        let causeChartColors = [];
        for (const [key, count] of Object.entries(causeDistribution)) {
            causeRows += `<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f3f4f6;">
                <span style="display:flex; align-items:center; gap:6px;">
                    <span style="width:10px; height:10px; border-radius:50%; background:${causeColors[key] || '#6b7280'};"></span>
                    ${causeLabels[key] || key}
                </span>
                <span style="font-weight:600;">${count}</span>
            </div>`;
            causeChartLabels.push(causeLabels[key] || key);
            causeChartData.push(count);
            causeChartColors.push(causeColors[key] || '#6b7280');
        }

        // Build field summaries  
        let fieldRows = '';
        fieldSummaries.forEach(fs => {
            const fArea = Number(fs.lossAreaSqm || fs.totalLossArea) || 0;
            const fVal = Number(fs.lossValue || fs.totalLossValue) || 0;
            fieldRows += `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f3f4f6; font-size:13px;">
                <span>${fs.fieldName || `Ruộng #${fs.fieldId}`}</span>
                <span style="color:#dc2626; font-weight:600;">${fArea < 10000 ? fArea.toFixed(1) + ' m²' : (fArea / 10000).toFixed(3) + ' ha'} · ${fVal > 0 ? new Intl.NumberFormat('vi-VN').format(Math.round(fVal)) + ' ₫' : '--'}</span>
            </div>`;
        });

        // Create modal
        let modal = document.getElementById('field-loss-analytics-modal');
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = 'field-loss-analytics-modal';
        modal.style.cssText = 'position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.5); backdrop-filter:blur(4px);';
        modal.innerHTML = `
            <div style="background:white; border-radius:20px; width:90%; max-width:640px; max-height:85vh; overflow-y:auto; box-shadow:0 25px 50px rgba(0,0,0,0.25);">
                <div style="padding:24px 28px 0; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg, #dc2626, #991b1b); display:flex; align-items:center; justify-content:center;">
                            <span class="material-icons-round" style="color:white; font-size:22px;">warning</span>
                        </div>
                        <div>
                            <h3 style="margin:0; font-size:18px; font-weight:700; color:#111827;">Thống kê hao hụt trồng trọt</h3>
                            <p style="margin:2px 0 0; font-size:12px; color:#6b7280;">Tổng quan thiệt hại cây trồng</p>
                        </div>
                    </div>
                    <button onclick="document.getElementById('field-loss-analytics-modal').remove()" style="width:36px; height:36px; border-radius:50%; border:none; background:#f3f4f6; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                        <span class="material-icons-round" style="font-size:20px; color:#6b7280;">close</span>
                    </button>
                </div>

                <div style="padding:20px 28px 28px;">
                    <!-- Stat Cards -->
                    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:12px; margin-bottom:24px;">
                        <div style="padding:16px; border-radius:14px; background:linear-gradient(135deg, #fef2f2, #fee2e2); border:1px solid #fecaca;">
                            <div style="font-size:11px; font-weight:600; color:#991b1b; text-transform:uppercase; letter-spacing:0.5px;">Số lần báo cáo</div>
                            <div style="font-size:28px; font-weight:800; color:#dc2626; margin-top:4px;">${totalRecords}</div>
                        </div>
                        <div style="padding:16px; border-radius:14px; background:linear-gradient(135deg, #fff7ed, #ffedd5); border:1px solid #fed7aa;">
                            <div style="font-size:11px; font-weight:600; color:#9a3412; text-transform:uppercase; letter-spacing:0.5px;">Tổng diện tích hao hụt</div>
                            <div style="font-size:28px; font-weight:800; color:#ea580c; margin-top:4px;">${totalLossArea < 10000 ? totalLossArea.toFixed(0) + ' m²' : (totalLossArea / 10000).toFixed(2) + ' ha'}</div>
                        </div>
                        <div style="padding:16px; border-radius:14px; background:linear-gradient(135deg, #fdf2f8, #fce7f3); border:1px solid #f9a8d4;">
                            <div style="font-size:11px; font-weight:600; color:#9d174d; text-transform:uppercase; letter-spacing:0.5px;">Tổng thiệt hại</div>
                            <div style="font-size:28px; font-weight:800; color:#db2777; margin-top:4px;">${totalLossValue > 0 ? new Intl.NumberFormat('vi-VN').format(Math.round(totalLossValue)) + ' ₫' : '--'}</div>
                        </div>
                        <div style="padding:16px; border-radius:14px; background:linear-gradient(135deg, #eff6ff, #dbeafe); border:1px solid #93c5fd;">
                            <div style="font-size:11px; font-weight:600; color:#1e40af; text-transform:uppercase; letter-spacing:0.5px;">Tỷ lệ hao hụt TB</div>
                            <div style="font-size:28px; font-weight:800; color:#2563eb; margin-top:4px;">${avgLossPercentage.toFixed(1)}%</div>
                        </div>
                    </div>

                    <!-- Cause Distribution -->
                    ${Object.keys(causeDistribution).length > 0 ? `
                    <div style="margin-bottom:24px;">
                        <h4 style="font-size:14px; font-weight:700; color:#111827; margin:0 0 12px; display:flex; align-items:center; gap:6px;">
                            <span class="material-icons-round" style="font-size:18px; color:#dc2626;">donut_large</span>
                            Phân bố nguyên nhân
                        </h4>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                            <div><canvas id="field-loss-cause-chart" width="200" height="200"></canvas></div>
                            <div>${causeRows}</div>
                        </div>
                    </div>` : ''}

                    <!-- Field Summaries -->
                    ${fieldSummaries.length > 0 ? `
                    <div>
                        <h4 style="font-size:14px; font-weight:700; color:#111827; margin:0 0 12px; display:flex; align-items:center; gap:6px;">
                            <span class="material-icons-round" style="font-size:18px; color:#ea580c;">grass</span>
                            Thiệt hại theo ruộng
                        </h4>
                        <div style="background:#f9fafb; border-radius:12px; padding:12px 16px;">${fieldRows}</div>
                    </div>` : ''}

                    ${totalRecords === 0 ? `
                    <div style="text-align:center; padding:40px 20px; color:#9ca3af;">
                        <span class="material-icons-round" style="font-size:48px; color:#d1d5db; margin-bottom:8px;">sentiment_satisfied</span>
                        <p style="font-size:14px; margin:0;">Chưa có báo cáo hao hụt nào.</p>
                    </div>` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        // Render cause chart
        if (Object.keys(causeDistribution).length > 0) {
            setTimeout(() => {
                const ctx = document.getElementById('field-loss-cause-chart');
                if (ctx && typeof Chart !== 'undefined') {
                    new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: causeChartLabels,
                            datasets: [{ data: causeChartData, backgroundColor: causeChartColors, borderWidth: 2, borderColor: '#fff' }]
                        },
                        options: {
                            responsive: true,
                            plugins: { legend: { display: false } },
                            cutout: '60%'
                        }
                    });
                }
            }, 100);
        }
    } catch (err) {
        console.error('Error loading field loss stats:', err);
        alert('Không thể tải thống kê hao hụt: ' + err.message);
    }
}

function handleFieldClick(field) {
    currentFieldId = field.id;
    currentFieldData = field;

    // Show right sidebar
    document.querySelector('.sensor-sidebar').classList.add('active');

    // Update basic info
    document.getElementById('field-name-display').textContent = field.name;
    document.getElementById('field-meta-display').textContent = `${(field.areaSqm / 10000).toFixed(2)} ha • ${field.currentCrop ? field.currentCrop.name : 'Chưa trồng'}`;

    // Fetch detailed status
    fetchFieldStatus(field.id);
}

// =============== WORKFLOW LOGIC ====================

async function fetchFieldStatus(fieldId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/fields/${fieldId}/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        currentFieldData = data.field; // Update local data
        updateUIForWorkflow(data);
    } catch (error) {
        console.error('Error fetching field status:', error);
    }
}

function updateUIForWorkflow(statusData) {
    const field = statusData.field;
    const stage = field.workflowStage || 'EMPTY';

    // Update status text on card
    document.getElementById('field-meta-display').textContent = `${(field.areaSqm / 10000).toFixed(2)} ha • ${field.currentCrop ? field.currentCrop.name : 'Chưa trồng'}`;

    // Update timers
    document.getElementById('field-timers').style.display = 'flex';

    // Water Timer
    const hoursValues = statusData.hoursUntilWater;
    const waterTimer = document.getElementById('timer-water');
    if (stage === 'EMPTY' || stage === 'CROP_SELECTED') {
        waterTimer.textContent = 'Tưới nước: --';
        waterTimer.style.color = '#9ca3af';
    } else {
        if (hoursValues <= 0) {
            waterTimer.innerHTML = '<span style="color:red; font-weight:bold">Cần tưới ngay!</span>';
        } else {
            waterTimer.textContent = `Tưới nước: còn ${hoursValues} giờ`;
            waterTimer.style.color = '#4b5563';
        }
    }

    // Fertilizer Timer
    const fertilizerTimer = document.getElementById('timer-fertilize');
    if (stage === 'FERTILIZED' || stage === 'SEEDED' || stage === 'GROWING') {
        fertilizerTimer.textContent = `Bón phân: còn ${statusData.daysUntilFertilize} ngày`;
    } else {
        fertilizerTimer.textContent = 'Bón phân: --';
    }

    // Harvest Timer
    const harvestTimer = document.getElementById('timer-harvest');
    const revenueDisplay = document.getElementById('field-revenue');
    const estRevenue = document.getElementById('estimated-revenue');

    if (field.currentCrop) {
        if (statusData.readyToHarvest) {
            harvestTimer.innerHTML = '<span style="color:#f59e0b; font-weight:bold">Đã có thể thu hoạch!</span>';
        } else {
            harvestTimer.textContent = `Thu hoạch: còn ${statusData.daysUntilHarvest} ngày`;
        }

        if (statusData.estimatedRevenue) {
            revenueDisplay.style.display = 'flex';
            estRevenue.textContent = formatCurrency(statusData.estimatedRevenue);
        }
    } else {
        harvestTimer.textContent = 'Thu hoạch: --';
        revenueDisplay.style.display = 'none';
    }

    // Lock Buttons based on Workflow Stage
    const btnCrop = document.getElementById('btn-select-crop');
    const btnFertilize = document.getElementById('btn-fertilize');
    const btnSeed = document.getElementById('btn-seed');
    const btnWater = document.getElementById('btn-watering');
    const btnPesticide = document.getElementById('btn-pesticide');
    const btnHarvest = document.getElementById('btn-harvest');
    const btnDelete = document.getElementById('btn-delete-field');

    // Disable all
    [btnCrop, btnFertilize, btnSeed, btnWater, btnPesticide, btnHarvest].forEach(btn => btn.disabled = true);
    document.querySelectorAll('.field-action-btn').forEach(btn => btn.classList.add('field-action-btn--disabled'));

    // Logic: allow changing crop if empty or preparing (delete is handled separately)
    // Actually if crop is selected but not seeded, can we change? Let's assume strict flow.

    // Stage 1: Select Crop
    if (stage === 'EMPTY' || stage === 'HARVESTED') {
        enableButton(btnCrop);
        document.getElementById('workflow-stage-text').textContent = "Bước 1: Chọn giống cây trồng";
    }

    // Stage 2: Fertilize (Unlocked after crop selected)
    else if (stage === 'CROP_SELECTED') {
        enableButton(btnFertilize);
        document.getElementById('workflow-stage-text').textContent = "Bước 2: Bón lót trước khi gieo";
        // Also allow changing crop
        enableButton(btnCrop);
    }

    // Stage 3: Seed (Unlocked after fertilized)
    else if (stage === 'FERTILIZED') {
        enableButton(btnSeed);
        document.getElementById('workflow-stage-text').textContent = "Bước 3: Gieo hạt giống";
    }

    // Growing Stage (Unlocked after seeding)
    else if (stage === 'SEEDED' || stage === 'GROWING' || stage === 'READY_HARVEST') {
        enableButton(btnWater);
        enableButton(btnPesticide);
        document.getElementById('workflow-stage-text').textContent = "Đang sinh trưởng - Chăm sóc định kỳ";
    }

    // Harvest (Unlocked when ready)
    if (statusData.readyToHarvest) {
        enableButton(btnHarvest);
        document.getElementById('workflow-stage-text').textContent = "Đã đến mùa thu hoạch!";
    }

    // Always enable delete
    enableButton(btnDelete);
}

function enableButton(btn) {
    btn.disabled = false;
    btn.classList.remove('field-action-btn--disabled');
}

// --- Modals & Actions ---

// CROP SELECTION
function openCropSelectionModal() {
    document.getElementById('crop-selection-modal').classList.add('open');
    loadCrops();
}

// Assuming loadCrops and selectCrop assumed to be in existing code or need implementation.
// Adding minimal loadCrops if not exists.
async function loadCrops() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/crops`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const crops = await response.json();
        const grid = document.getElementById('crop-grid');
        grid.innerHTML = crops.map(crop => `
            <div class="crop-card" onclick="plantCrop(${crop.id})">
                <div style="font-size:24px">🌱</div>
                <h4>${crop.name}</h4>
                <p>${crop.category}</p>
            </div>
        `).join('');
    } catch (e) {
        console.error(e);
    }
}

async function plantCrop(cropId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/fields/${currentFieldId}/plant`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ cropId })
        });
        if (response.ok) {
            closeModal('crop-selection-modal');
            fetchFieldStatus(currentFieldId);
            showNotification('Đã chọn cây trồng thành công', 'success');
        }
    } catch (e) {
        alert('Lỗi khi chọn cây trồng');
    }
}

// FERTILIZER
function openFertilizerModal() {
    // Safety check: Field must be selected
    if (!currentFieldData) {
        alert("Vui lòng chọn mảnh ruộng trước!");
        return;
    }

    document.getElementById('fertilizer-modal').classList.add('open');
    const container = document.getElementById('fertilizer-list');
    container.innerHTML = '<div style="text-align:center; padding:20px; grid-column:1/-1;">Đang tải danh sách phân bón...</div>';

    // Switch to Grid layout class
    container.className = 'fertilizer-grid';

    (async () => {
        const token = localStorage.getItem('token');
        // Filter by current crop if valid
        const cropName = (currentFieldData.currentCrop && currentFieldData.currentCrop.name) ? currentFieldData.currentCrop.name : '';
        const url = cropName ? `${API_BASE_URL}/fertilizers/suitable?cropName=${encodeURIComponent(cropName)}` : `${API_BASE_URL}/fertilizers`;

        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });

        let fertilizers = [];
        if (response.ok) {
            fertilizers = await response.json();
        } else {
            // Fallback mock
            fertilizers = [
                { id: 1, name: "Phân Urea Đạm Phú Mỹ", description: "Hàm lượng đạm cao, giúp cây phát triển lá xanh tốt.", price: 15000, ingredients: "Nitrogen 46%", usageInstructions: "Bón thúc", imageUrl: "https://cdn-icons-png.flaticon.com/512/10432/10432857.png" },
                { id: 2, name: "Phân NPK 20-20-15", description: "Cung cấp đầy đủ N-P-K cho mọi giai đoạn phát triển.", price: 18000, ingredients: "NPK 20-20-15", usageInstructions: "Bón lót/thúc", imageUrl: "https://cdn-icons-png.flaticon.com/512/10003/10003757.png" },
                { id: 3, name: "Phân Hữu Cơ Vi Sinh", description: "Cải tạo đất, thân thiện môi trường, bổ sung vi sinh vật.", price: 8000, ingredients: "Hữu cơ 15%", usageInstructions: "Bón lót", imageUrl: "https://cdn-icons-png.flaticon.com/512/3596/3596160.png" },
                { id: 4, name: "Phân Kali Clorua", description: "Tăng cường sức đề kháng, chống chịu sâu bệnh.", price: 12000, ingredients: "Kali 61%", usageInstructions: "Bón nuôi trái", imageUrl: "https://cdn-icons-png.flaticon.com/512/10609/10609653.png" }
            ];
        }

        // Store for details lookup
        window.currentFertilizerList = fertilizers;

        container.innerHTML = fertilizers.map(f => {
            const price = f.price || f.costPerKg || 0;
            // Use image from DB if available, else helper
            const img = f.imageUrl || getFertilizerImage(f.name);

            return `
            <div class="fertilizer-card"
                 onclick="selectFertilizer(this, ${f.id}, ${price}, '${f.name}')"
                 ondblclick="showFertilizerDetails(${f.id})">
                <div class="fertilizer-card__image-container">
                    <img src="${img}" alt="${f.name}">
                </div>
                <div class="fertilizer-card__content">
                    <h4>${f.name}</h4>
                    <p>${f.description || 'Không có mô tả'}</p>
                    <div class="fertilizer-card__footer">
                        <span class="fertilizer-card__badge">Double-click xem chi tiết</span>
                        <div class="fertilizer-card__price">${formatCurrency(price)}/kg</div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    })().catch(e => {
        console.error("Fertilizer load error", e);
        container.innerHTML = '<div style="color:red; text-align:center; padding:20px;">Lỗi tải dữ liệu. Vui lòng thử lại.</div>';
    });
}

// Details Modal
function showFertilizerDetails(id) {
    const fertilizer = window.currentFertilizerList.find(f => f.id === id);
    if (!fertilizer) return;

    const modal = document.getElementById('fertilizer-detail-modal');
    const content = document.getElementById('fertilizer-detail-content');
    const img = fertilizer.imageUrl || getFertilizerImage(fertilizer.name);
    const price = fertilizer.price || fertilizer.costPerKg || 0;

    content.innerHTML = `
        <div style="display:flex; gap:20px; flex-wrap:wrap;">
            <div style="flex:1; min-width:200px; display:flex; justify-content:center; align-items:center; background:#f8fafc; border-radius:12px;">
                <img src="${img}" style="max-width:100%; max-height:200px; object-fit:contain;" />
            </div>
            <div style="flex:1.5; min-width:250px;">
                <h2 style="color:#0f172a; margin-top:0;">${fertilizer.name}</h2>
                <div style="font-size:18px; font-weight:bold; color:#10b981; margin-bottom:12px;">${formatCurrency(price)} / kg</div>

                <div class="detail-section">
                    <label style="font-weight:bold; color:#475569; display:block; margin-bottom:4px;">Thành phần:</label>
                    <p style="background:#f1f5f9; padding:8px; border-radius:6px;">${fertilizer.ingredients || 'Chưa cập nhật'}</p>
                </div>

                <div class="detail-section" style="margin-top:12px;">
                    <label style="font-weight:bold; color:#475569; display:block; margin-bottom:4px;">Công dụng / Cách dùng:</label>
                    <p style="background:#f1f5f9; padding:8px; border-radius:6px;">${fertilizer.usageInstructions || fertilizer.description || 'Chưa cập nhật'}</p>
                </div>

                <div class="detail-section" style="margin-top:12px;">
                     <label style="font-weight:bold; color:#475569; display:block; margin-bottom:4px;">Cây trồng thích hợp:</label>
                     <div style="display:flex; flex-wrap:wrap; gap:8px;">
                        ${parseSuitableCrops(fertilizer.suitableCrops)}
                     </div>
                </div>
            </div>
        </div>
    `;

    // Configure "Select this" button
    const btnSelect = document.getElementById('btn-select-from-detail');
    btnSelect.onclick = () => {
        // Find the card element to trigger click or just call select manually
        // Since we need the DOM element for visual selection style, let's close and call logic
        closeModal('fertilizer-detail-modal');
        // Find card
        // We can just call selectFertilizer directly but we need the element 'el' to add class.
        // We can simulate click or just iterate.
        const cards = document.querySelectorAll('.fertilizer-card');
        // Simple hack: find by text or store ID in DOM
        // Open main modal first if closed? No, details is on top. Main modal is open.

        // Call selection
        selectFertilizerFromId(id, price, fertilizer.name);
    };

    modal.classList.add('open');
}

function parseSuitableCrops(jsonStr) {
    try {
        if (!jsonStr) return '<span>Tất cả loại cây</span>';
        const crops = JSON.parse(jsonStr);
        if (Array.isArray(crops)) {
            return crops.map(c => `<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:12px; font-size:12px;">${c}</span>`).join('');
        }
        return jsonStr;
    } catch (e) { return jsonStr || '---'; }
}

function selectFertilizerFromId(id, price, name) {
    const cards = document.querySelectorAll('.fertilizer-card');
    cards.forEach(card => {
        // check onclick attribute or dirty check
        if (card.getAttribute('onclick').includes(`, ${id},`)) {
            selectFertilizer(card, id, price, name);
        }
    });
}

function getFertilizerImage(name) {
    if (!name) return 'https://cdn-icons-png.flaticon.com/512/2674/2674486.png';
    const n = name.toLowerCase();
    if (n.includes('npk')) return 'https://cdn-icons-png.flaticon.com/512/10003/10003757.png';
    if (n.includes('urea') || n.includes('u-rê') || n.includes('đạm')) return 'https://cdn-icons-png.flaticon.com/512/10432/10432857.png';
    if (n.includes('hữu cơ') || n.includes('organic')) return 'https://cdn-icons-png.flaticon.com/512/3596/3596160.png';
    if (n.includes('kali') || n.includes('lân')) return 'https://cdn-icons-png.flaticon.com/512/10609/10609653.png';
    return 'https://cdn-icons-png.flaticon.com/512/2674/2674486.png'; // Falback
}

function selectFertilizer(el, id, price, name) {
    document.querySelectorAll('.fertilizer-card').forEach(i => i.classList.remove('selected'));
    el.classList.add('selected');
    selectedFertilizer = { id, price, name };

    // Estimate cost (assume 0.05kg/sqm default app rate if not provided, just simple math for demo)
    const rate = 0.05;
    const area = (currentFieldData && currentFieldData.areaSqm) ? currentFieldData.areaSqm : 1000;
    const estCost = area * rate * price;

    document.getElementById('fertilizer-cost').textContent = formatCurrency(estCost);
}

async function confirmFertilizer() {
    if (!selectedFertilizer) { alert('Vui lòng chọn loại phân bón'); return; }

    try {
        const costStr = document.getElementById('fertilizer-cost').textContent.replace(/[^\d]/g, '');
        const cost = parseFloat(costStr);
        const token = localStorage.getItem('token');

        const response = await fetch(`${API_BASE_URL}/fields/${currentFieldId}/fertilize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                fertilizerId: selectedFertilizer.id,
                cost: cost
            })
        });

        if (response.ok) {
            closeModal('fertilizer-modal');
            fetchFieldStatus(currentFieldId);
            showNotification('Đã bón phân thành công', 'success');
        }
    } catch (e) { alert('Lỗi xử lý'); }
}


// SEED
function openSeedModal() {
    document.getElementById('seed-modal').classList.add('open');
    // Get seed price from crop def if available
    const seedPrice = currentFieldData.currentCrop && currentFieldData.currentCrop.seedCostPerKg ? currentFieldData.currentCrop.seedCostPerKg : 50000;
    document.getElementById('seed-price').textContent = formatCurrency(seedPrice) + '/kg';
    document.getElementById('seed-quantity').value = '';
    document.getElementById('seed-total-cost').textContent = '0 VNĐ';
}

function calculateSeedCost() {
    const qty = parseFloat(document.getElementById('seed-quantity').value) || 0;
    const priceStr = document.getElementById('seed-price').textContent.replace(/[^\d]/g, '');
    const price = parseFloat(priceStr);
    document.getElementById('seed-total-cost').textContent = formatCurrency(qty * price);
}

async function confirmSeed() {
    const qty = parseFloat(document.getElementById('seed-quantity').value);
    const costStr = document.getElementById('seed-total-cost').textContent.replace(/[^\d]/g, '');
    const cost = parseFloat(costStr);

    if (!qty || qty <= 0) { alert('Nhập số lượng hạt giống'); return; }

    try {
        const token = localStorage.getItem('token');

        const response = await fetch(`${API_BASE_URL}/fields/${currentFieldId}/seed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ quantity: qty, cost: cost })
        });

        if (response.ok) {
            closeModal('seed-modal');
            fetchFieldStatus(currentFieldId);
            showNotification('Gieo hạt thành công', 'success');
        }
    } catch (e) { alert('Lỗi xử lý'); }
}

// WATER & PESTICIDE
async function waterField() {
    if (!confirm('Xác nhận tưới nước cho ruộng này?')) return;
    try {
        const token = localStorage.getItem('token');
        await fetch(`${API_BASE_URL}/fields/${currentFieldId}/water`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchFieldStatus(currentFieldId);
        showNotification('Đã tưới nước', 'success');
    } catch (e) { alert('Lỗi'); }
}

function openPesticideModal() {
    document.getElementById('pesticide-modal').classList.add('open');
}

async function confirmPesticide() {
    const name = document.getElementById('pesticide-name').value;
    const cost = parseFloat(document.getElementById('pesticide-cost').value) || 0;
    if (!name) { alert('Nhập tên thuốc'); return; }

    try {
        const token = localStorage.getItem('token');
        await fetch(`${API_BASE_URL}/fields/${currentFieldId}/pesticide`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ pesticideName: name, cost: cost })
        });
        closeModal('pesticide-modal');
        fetchFieldStatus(currentFieldId);
        showNotification('Đã phun thuốc', 'success');
    } catch (e) { alert('Lỗi'); }
}

// HARVEST
function openHarvestModal() {
    document.getElementById('harvest-modal').classList.add('open');
    const container = document.getElementById('machinery-list');
    container.innerHTML = '<p>Đang tải máy móc...</p>';

    (async () => {
        try {
            const token = localStorage.getItem('token');
            const cropName = currentFieldData.currentCrop ? currentFieldData.currentCrop.name : '';
            const url = cropName ? `${API_BASE_URL}/machinery/harvest?cropName=${encodeURIComponent(cropName)}` : `${API_BASE_URL}/machinery`;

            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            const machinery = await response.json();

            container.innerHTML = machinery.map(m => `
            <div class="list-item" onclick="selectMachinery(this, ${m.id}, ${m.rentalCostPerHour}, '${m.name}')">
                <div class="list-item__info">
                    <h4>${m.name}</h4>
                    <p>${m.description}</p>
                </div>
                <div class="list-item__price">${formatCurrency(m.rentalCostPerHour)}/giờ</div>
            </div>
        `).join('');
        } catch (e) {
            container.innerHTML = '<p>Lỗi tải danh sách máy móc</p>';
        }
    })();
}

function selectMachinery(el, id, price, name) {
    document.querySelectorAll('#machinery-list .list-item').forEach(i => i.classList.remove('selected'));
    el.classList.add('selected');
    selectedMachinery = { id, price, name };

    // Estimate cost (assume 2 hours for now)
    const estCost = price * 2;
    document.getElementById('harvest-cost').textContent = formatCurrency(estCost);
}

async function confirmHarvest() {
    if (!selectedMachinery) { alert('Vui lòng chọn máy thu hoạch'); return; }

    try {
        const costStr = document.getElementById('harvest-cost').textContent.replace(/[^\d]/g, '');
        const cost = parseFloat(costStr);
        const token = localStorage.getItem('token');

        const response = await fetch(`${API_BASE_URL}/fields/${currentFieldId}/harvest-complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ machineryId: selectedMachinery.id, machineCost: cost })
        });

        if (response.ok) {
            const result = await response.json();
            closeModal('harvest-modal');
            showHarvestResult(result);
            fetchFieldStatus(currentFieldId);
        }
    } catch (e) { alert('Lỗi xử lý thu hoạch'); }
}

function showHarvestResult(data) {
    document.getElementById('result-crop-name').textContent = data.cropName;
    document.getElementById('result-yield').textContent = data.yieldKg.toLocaleString('vi-VN') + ' kg';
    document.getElementById('result-revenue').textContent = formatCurrency(data.revenue);
    document.getElementById('result-profit').textContent = formatCurrency(data.profit);
    document.getElementById('harvest-result-modal').classList.add('open');
}

// DELETE FIELD
function openDeleteFieldModal() {
    document.getElementById('delete-confirm-modal').classList.add('open');
    if (currentFieldData.currentCrop && currentFieldData.workflowStage !== 'EMPTY') {
        document.getElementById('delete-warning').style.display = 'block';
    } else {
        document.getElementById('delete-warning').style.display = 'none';
    }
}

async function confirmDeleteField() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/fields/${currentFieldId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            closeModal('delete-confirm-modal');

            // Remove from map
            drawnItems.eachLayer(layer => {
                if (layer.feature && layer.feature.properties.id === currentFieldId) {
                    drawnItems.removeLayer(layer);
                }
            });

            // Reset UI
            document.querySelector('.sensor-sidebar').classList.remove('active');
            showNotification('Đã xóa mảnh ruộng', 'success');
        }
    } catch (e) { alert('Lỗi xóa ruộng'); }
}

// Helpers
function formatCurrency(val) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

function showNotification(msg, type) {
    // Try to use showToast if available (defined in cultivation.html)
    if (typeof showToast === 'function') {
        const title = type === 'success' ? 'Thành công' : (type === 'error' ? 'Lỗi' : 'Thông báo');
        showToast(title, msg, type);
    } else {
        // Fallback to alert
        alert(msg);
    }
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}

// WEATHER LOGIC
const WEATHER_API_KEY = '9d3fb6ba097657b494602f3060761352';

async function fetchWeather() {
    try {
        const { lat, lng } = currentLocation;
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&lang=vi&appid=${WEATHER_API_KEY}`);
        const data = await response.json();
        renderWeather(data);
        updateSensors(data);
    } catch (error) {
        console.error('Weather error:', error);
    }
}

async function fetchForecast(days) {
    try {
        const { lat, lng } = currentLocation;
        const response = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=metric&lang=vi&appid=${WEATHER_API_KEY}`);
        if (!response.ok) throw new Error('API error');
        const data = await response.json();
        const forecastData = processForecast(data.list, days);
        renderForecast(forecastData);
    } catch (error) {
        console.error('Forecast error:', error);
        const list = document.getElementById('forecast-list');
        if (list) list.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);">Không thể tải dự báo</p>';
    }
}

function processForecast(list, days) {
    const daily = {};
    list.forEach(item => {
        const date = item.dt_txt.split(' ')[0];
        if (!daily[date]) daily[date] = { temps: [], icons: [], descs: [] };
        daily[date].temps.push(item.main.temp);
        daily[date].icons.push(item.weather[0].icon);
        daily[date].descs.push(item.weather[0].description);
    });

    return Object.entries(daily).slice(0, days).map(([date, d]) => ({
        date: new Date(date).toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' }),
        temp: Math.round(d.temps.reduce((a, b) => a + b) / d.temps.length),
        icon: d.icons[Math.floor(d.icons.length / 2)],
        desc: d.descs[Math.floor(d.descs.length / 2)]
    }));
}

function renderWeather(data) {
    const widget = document.getElementById('weather-widget');
    if (!widget) return;
    const locationName = data.name || currentLocation.name;
    widget.innerHTML = `
        <div class="weather-widget__header">
            <div class="weather-widget__location"><span class="material-symbols-outlined">location_on</span>${locationName}</div>
        </div>
        <div class="weather-widget__body">
            <div class="weather-widget__current">
                <img class="weather-widget__icon" src="https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png" alt="">
                <div><div class="weather-widget__temp">${Math.round(data.main.temp)}°C</div><div class="weather-widget__desc">${data.weather[0].description}</div></div>
            </div>
            <div class="weather-widget__details">
                <div class="weather-detail"><div class="weather-detail__label">Ẩm</div><div class="weather-detail__value">${data.main.humidity}%</div></div>
                <div class="weather-detail"><div class="weather-detail__label">Gió</div><div class="weather-detail__value">${data.wind.speed}m/s</div></div>
            </div>
        </div>
    `;
    if (typeof gsap !== 'undefined') gsap.fromTo(widget, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3 });
}

function renderForecast(forecast) {
    const list = document.getElementById('forecast-list');
    if (!list) return;
    const title = document.getElementById('forecast-title');
    if (title) title.textContent = `Dự báo thời tiết - ${currentLocation.name}`;

    list.innerHTML = forecast.map(day => `
        <div class="forecast-item">
            <span class="forecast-item__date">${day.date}</span>
            <img class="forecast-item__icon" src="https://openweathermap.org/img/wn/${day.icon}@2x.png" alt="">
            <span class="forecast-item__temp">${day.temp}°C</span>
            <span class="forecast-item__desc">${day.desc}</span>
        </div>
    `).join('');
    if (typeof gsap !== 'undefined') gsap.fromTo('.forecast-item', { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.2, stagger: 0.05 });
}

function updateSensors(data) {
    const tempEl = document.getElementById('temperature');
    if (tempEl) tempEl.textContent = `${Math.round(data.main.temp)}°C`;
    const tempSource = document.getElementById('temp-source');
    if (tempSource) tempSource.textContent = 'OpenWeather';
    const humEl = document.getElementById('humidity');
    if (humEl) humEl.textContent = `${data.main.humidity}%`;
    const humSource = document.getElementById('humidity-source');
    if (humSource) humSource.textContent = 'OpenWeather';
}

function openForecastModal() {
    document.getElementById('forecast-modal').classList.add('open');
    fetchForecast(5);
    if (typeof gsap !== 'undefined') gsap.fromTo('.forecast-modal__content', { opacity: 0, scale: 0.9, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 0.3 });
}


// Close modals when clicking outside
window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('open');
    }
}


document.addEventListener('DOMContentLoaded', function () {
    initMap();
    fetchWeather();
    fetchForecast(5);
});
