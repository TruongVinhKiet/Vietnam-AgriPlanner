/* =====================================================
   Admin Advanced - Planning Zones Management JS
   ===================================================== */

var API_BASE_URL = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL :
    (typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : 'http://localhost:8080/api');

// Global variables
let map;
let planningZonesLayer;
let zoneTypes = [];
let allZones = [];
let selectedFile = null;
let currentTab = 'map';

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async function () {
    // Check authentication
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    let role = localStorage.getItem('userRole');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // If role is not in localStorage, try to fetch from API
    if (!role) {
        try {
            const response = await fetch(`${API_BASE_URL}/user/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const profile = await response.json();
                role = profile.role;
                if (role) localStorage.setItem('userRole', role);
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
        }
    }

    // Allow SYSTEM_ADMIN and OWNER to access
    if (role && role !== 'SYSTEM_ADMIN' && role !== 'OWNER') {
        alert('Bạn không có quyền truy cập trang này');
        window.location.href = 'login.html';
        return;
    }

    // Load user info
    await loadUserInfo();

    // Initialize map
    initMap();

    // Initialize navigation
    initNavigation();

    // Initialize upload
    initUpload();

    // Load data
    await loadZoneTypes();
    await loadPlanningZones();
    await loadUploads();

    // Setup logout
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Setup create snapshot button
    const createSnapshotBtn = document.getElementById('create-snapshot-btn');
    if (createSnapshotBtn) {
        createSnapshotBtn.addEventListener('click', openCreateSnapshotModal);
    }
});

// ============ USER INFO ============
async function loadUserInfo() {
    try {
        const response = await fetchAPI('/user/profile');
        if (response) {
            document.getElementById('admin-name').textContent = response.fullName || response.username;
            const avatar = document.getElementById('admin-avatar');
            if (response.avatarUrl) {
                avatar.style.backgroundImage = `url(${response.avatarUrl})`;
                avatar.style.backgroundSize = 'cover';
                avatar.textContent = '';
            } else {
                avatar.textContent = (response.fullName || response.username || 'A').charAt(0).toUpperCase();
            }
        }
    } catch (e) {
        console.log('Could not load user info');
    }
}

// ============ MAP INITIALIZATION ============
function initMap() {
    // Initialize Leaflet map centered on Can Tho
    map = L.map('leaflet-map', {
        center: [10.0452, 105.7469],
        zoom: 12,
        zoomControl: false
    });

    // Tile layers
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri'
    });

    const terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap'
    });

    // Default to street layer
    streetLayer.addTo(map);

    // Layer control
    const layers = { street: streetLayer, satellite: satelliteLayer, terrain: terrainLayer };
    document.querySelectorAll('.layer-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const layerName = this.dataset.layer;
            document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            Object.values(layers).forEach(l => map.removeLayer(l));
            layers[layerName].addTo(map);
        });
    });

    // Create layer group for planning zones
    planningZonesLayer = L.layerGroup().addTo(map);

    // Map controls
    document.getElementById('zoom-in-btn').addEventListener('click', () => map.zoomIn());
    document.getElementById('zoom-out-btn').addEventListener('click', () => map.zoomOut());
    document.getElementById('locate-btn').addEventListener('click', locateUser);
    document.getElementById('refresh-btn').addEventListener('click', () => {
        loadPlanningZones();
        showToast('Đã làm mới', 'Dữ liệu được cập nhật', 'success');
    });

    // Legend close
    document.getElementById('legend-close').addEventListener('click', () => {
        document.getElementById('legend-panel').style.display = 'none';
    });

    // Zone info close
    document.getElementById('zone-info-close').addEventListener('click', closeZoneInfo);

    // Upload button in header
    document.getElementById('upload-btn').addEventListener('click', () => {
        switchTab('uploads');
    });
}

function locateUser() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;
                map.setView([latitude, longitude], 15);
                L.marker([latitude, longitude]).addTo(map)
                    .bindPopup('Vị trí của bạn').openPopup();
            },
            error => {
                showToast('Lỗi', 'Không thể lấy vị trí', 'error');
            }
        );
    }
}

// ============ NAVIGATION ============
function initNavigation() {
    document.querySelectorAll('.sidebar-item[data-tab]').forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            const tab = this.dataset.tab;
            switchTab(tab);
        });
    });
}

function switchTab(tab) {
    currentTab = tab;

    // Update sidebar
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.tab === tab) {
            item.classList.add('active');
        }
    });

    // Update title
    const titles = {
        map: 'Bản đồ Quy hoạch Đất đai',
        uploads: 'Quản lý File KMZ',
        zones: 'Danh sách Vùng Quy hoạch',
        legend: 'Chú giải Màu sắc',
        snapshots: 'Lịch sử Phiên bản'
    };
    document.getElementById('page-title').textContent = titles[tab] || 'Quản lý Nâng cao';

    // Show/hide content
    document.getElementById('map-container').classList.toggle('hidden', tab !== 'map');
    document.getElementById('uploads-container').classList.toggle('hidden', tab !== 'uploads');
    document.getElementById('zones-container').classList.toggle('hidden', tab !== 'zones');
    document.getElementById('legend-container').classList.toggle('hidden', tab !== 'legend');
    document.getElementById('snapshots-container').classList.toggle('hidden', tab !== 'snapshots');

    // Refresh map size if switching to map
    if (tab === 'map' && map) {
        setTimeout(() => map.invalidateSize(), 100);
    }

    // Load data for specific tabs
    if (tab === 'uploads') loadUploads();
    if (tab === 'zones') renderZonesList();
    if (tab === 'legend') renderZoneTypesList();
    if (tab === 'snapshots') loadSnapshots();
}

// ============ UPLOAD ============
function initUpload() {
    const dropzone = document.getElementById('upload-dropzone');
    const fileInput = document.getElementById('file-input');

    // Click to select file
    dropzone.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // Clear file button
    document.getElementById('clear-file').addEventListener('click', clearSelectedFile);

    // Submit upload
    document.getElementById('submit-upload').addEventListener('click', submitUpload);
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleFile(file) {
    // Validate file type
    const validTypes = ['.kmz', '.kml'];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!validTypes.includes(ext)) {
        showToast('Lỗi', 'Chỉ chấp nhận file KMZ hoặc KML', 'error');
        return;
    }

    // Validate file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
        showToast('Lỗi', 'File quá lớn (tối đa 100MB)', 'error');
        return;
    }

    selectedFile = file;
    document.getElementById('selected-filename').textContent = file.name;
    document.getElementById('selected-filesize').textContent = formatFileSize(file.size);
    document.getElementById('upload-form-container').classList.remove('hidden');
}

function clearSelectedFile() {
    selectedFile = null;
    document.getElementById('file-input').value = '';
    document.getElementById('upload-form-container').classList.add('hidden');
}

async function submitUpload() {
    if (!selectedFile) {
        showToast('Lỗi', 'Vui lòng chọn file', 'error');
        return;
    }

    const province = document.getElementById('upload-province').value;
    const district = document.getElementById('upload-district').value;
    const notes = document.getElementById('upload-notes').value;
    const mapType = document.querySelector('input[name="map-type"]:checked')?.value || 'planning';

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('province', province);
    formData.append('mapType', mapType);
    if (district) formData.append('district', district);
    if (notes) formData.append('notes', notes);

    // Show progress
    document.getElementById('upload-form-container').classList.add('hidden');
    document.getElementById('upload-progress').classList.remove('hidden');

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/admin/kmz/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showToast('Thành công', data.message || 'Đã upload và xử lý file', 'success');
            clearSelectedFile();
            await loadUploads();
            await loadPlanningZones();

            // Switch to map to see results
            setTimeout(() => switchTab('map'), 1500);
        } else {
            throw new Error(data.error || 'Upload failed');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Lỗi', error.message || 'Không thể upload file', 'error');
    } finally {
        document.getElementById('upload-progress').classList.add('hidden');
    }
}

async function loadUploads() {
    try {
        const uploads = await fetchAPI('/admin/kmz/uploads');
        renderUploadsList(uploads || []);
    } catch (error) {
        console.error('Error loading uploads:', error);
    }
}

function renderUploadsList(uploads) {
    const container = document.getElementById('uploads-list');

    if (!uploads || uploads.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <span class="material-icons-round text-4xl mb-2">cloud_off</span>
                <p>Chưa có file nào được upload</p>
            </div>
        `;
        return;
    }

    container.innerHTML = uploads.map(upload => {
        const mapTypeLabel = upload.mapType === 'soil' ? 'Thổ nhưỡng' : 'Quy hoạch';
        const mapTypeIcon = upload.mapType === 'soil' ? 'landscape' : 'map';
        const mapTypeColor = upload.mapType === 'soil' ? 'amber' : 'green';
        
        return `
        <div class="upload-item">
            <div class="upload-item-icon ${upload.status === 'COMPLETED' ? 'success' : upload.status === 'FAILED' ? 'failed' : 'processing'}">
                <span class="material-icons-round">
                    ${upload.status === 'COMPLETED' ? 'check_circle' : upload.status === 'FAILED' ? 'error' : 'sync'}
                </span>
            </div>
            <div class="upload-item-info">
                <div class="upload-item-name">${upload.originalName || upload.filename}</div>
                <div class="upload-item-meta">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-${mapTypeColor}-100 text-${mapTypeColor}-700">
                        <span class="material-icons-round" style="font-size:12px">${mapTypeIcon}</span>
                        ${mapTypeLabel}
                    </span>
                    ${upload.province || ''} ${upload.district ? '- ' + upload.district : ''} 
                    | ${upload.zonesCount || 0} vùng 
                    | ${formatDate(upload.uploadedAt)}
                </div>
            </div>
            <span class="upload-item-badge ${upload.status === 'COMPLETED' ? 'success' : 'failed'}">
                ${upload.status === 'COMPLETED' ? 'Hoàn thành' : upload.status === 'FAILED' ? 'Thất bại' : 'Đang xử lý'}
            </span>
            <div class="upload-item-actions">
                <button class="btn btn-sm btn-outline" onclick="viewUploadZones(${upload.id})">
                    <span class="material-icons-round" style="font-size:16px">visibility</span>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteUpload(${upload.id})">
                    <span class="material-icons-round" style="font-size:16px">delete</span>
                </button>
            </div>
        </div>
    `}).join('');
}

async function viewUploadZones(uploadId) {
    try {
        const zones = await fetchAPI(`/admin/kmz/uploads/${uploadId}/zones`);
        if (zones && zones.length > 0) {
            // Clear existing zones
            planningZonesLayer.clearLayers();

            // Add zones to map
            zones.forEach(zone => addZoneToMap(zone));

            // Fit bounds to zones
            if (planningZonesLayer.getLayers().length > 0) {
                const bounds = planningZonesLayer.getBounds();
                map.fitBounds(bounds, { padding: [50, 50] });
            }

            switchTab('map');
            showToast('Thành công', `Đang hiển thị ${zones.length} vùng`, 'success');
        } else {
            showToast('Thông báo', 'Không có vùng nào trong file này', 'error');
        }
    } catch (error) {
        console.error('Error loading zones:', error);
        showToast('Lỗi', 'Không thể tải vùng quy hoạch', 'error');
    }
}

async function deleteUpload(uploadId) {
    if (!confirm('Xóa file upload này và tất cả vùng quy hoạch liên quan?')) return;

    try {
        const response = await fetchAPI(`/admin/kmz/uploads/${uploadId}`, 'DELETE');
        showToast('Thành công', 'Đã xóa upload', 'success');
        await loadUploads();
        await loadPlanningZones();
    } catch (error) {
        console.error('Error deleting upload:', error);
        showToast('Lỗi', 'Không thể xóa upload', 'error');
    }
}

// ============ PLANNING ZONES ============
async function loadZoneTypes() {
    try {
        const types = await fetchAPI('/planning-zones/types');
        zoneTypes = types || [];
        renderLegend();
    } catch (error) {
        console.error('Error loading zone types:', error);
    }
}

async function loadPlanningZones() {
    try {
        const zones = await fetchAPI('/planning-zones');
        allZones = zones || [];

        // Update stats
        document.getElementById('zones-count').textContent = allZones.length;

        // Render zones on map
        renderZonesOnMap(allZones);
    } catch (error) {
        console.error('Error loading zones:', error);
    }
}

function renderZonesOnMap(zones) {
    planningZonesLayer.clearLayers();

    zones.forEach(zone => addZoneToMap(zone));
}

function addZoneToMap(zone) {
    let coordinates;

    // Check if zone has an image overlay
    if (zone.imageUrl && zone.boundaryCoordinates) {
        try {
            coordinates = typeof zone.boundaryCoordinates === 'string'
                ? JSON.parse(zone.boundaryCoordinates)
                : zone.boundaryCoordinates;

            if (coordinates && coordinates.length > 2) {
                // Get bounds from coordinates (find min/max lat/lng)
                const lats = coordinates.map(c => c[0]);
                const lngs = coordinates.map(c => c[1]);
                const bounds = [
                    [Math.min(...lats), Math.min(...lngs)],
                    [Math.max(...lats), Math.max(...lngs)]
                ];

                // Add image overlay
                const imageUrl = zone.imageUrl.startsWith('/')
                    ? API_BASE_URL.replace('/api', '') + zone.imageUrl
                    : zone.imageUrl;

                const imageOverlay = L.imageOverlay(imageUrl, bounds, {
                    opacity: 0.9,
                    interactive: true
                });

                imageOverlay.on('click', () => showZoneInfo(zone));
                imageOverlay.addTo(planningZonesLayer);

                // Also add a thin border for visibility
                const polygon = L.polygon(coordinates, {
                    fill: false,
                    color: zone.strokeColor || '#333',
                    weight: 1,
                    dashArray: '5, 5'
                });
                polygon.bindTooltip(zone.name || 'Vùng quy hoạch', { className: 'planning-popup' });
                polygon.addTo(planningZonesLayer);
                return;
            }
        } catch (e) {
            console.warn('Could not create image overlay:', e);
        }
    }

    // Try to parse GeoJSON first
    if (zone.geojson) {
        try {
            const geojson = typeof zone.geojson === 'string' ? JSON.parse(zone.geojson) : zone.geojson;
            const layer = L.geoJSON(geojson, {
                style: {
                    fillColor: zone.fillColor || '#10B981',
                    fillOpacity: parseFloat(zone.fillOpacity) || 0.5,
                    color: zone.strokeColor || '#333',
                    weight: 2
                }
            });

            layer.on('click', () => showZoneInfo(zone));
            layer.bindTooltip(zone.name || 'Vùng quy hoạch', { className: 'planning-popup' });
            layer.addTo(planningZonesLayer);
            return;
        } catch (e) {
            console.warn('Could not parse GeoJSON', e);
        }
    }

    // Fallback to boundary coordinates
    if (zone.boundaryCoordinates) {
        try {
            coordinates = typeof zone.boundaryCoordinates === 'string'
                ? JSON.parse(zone.boundaryCoordinates)
                : zone.boundaryCoordinates;

            if (coordinates && coordinates.length > 0) {
                const polygon = L.polygon(coordinates, {
                    fillColor: zone.fillColor || '#10B981',
                    fillOpacity: parseFloat(zone.fillOpacity) || 0.5,
                    color: zone.strokeColor || '#333',
                    weight: 2
                });

                polygon.on('click', () => showZoneInfo(zone));
                polygon.bindTooltip(zone.name || 'Vùng quy hoạch', { className: 'planning-popup' });
                polygon.addTo(planningZonesLayer);
            }
        } catch (e) {
            console.warn('Could not parse coordinates', e);
        }
    }
}

function showZoneInfo(zone) {
    const panel = document.getElementById('zone-info-panel');
    const content = document.getElementById('zone-info-content');
    const title = document.getElementById('zone-info-title');

    title.textContent = zone.name || 'Thông tin Vùng';

    content.innerHTML = `
        <div class="zone-info-row">
            <span class="zone-info-label">Mã quy hoạch</span>
            <span class="zone-info-value">${zone.zoneCode || '-'}</span>
        </div>
        <div class="zone-info-row">
            <span class="zone-info-label">Loại đất</span>
            <span class="zone-info-value">${zone.zoneType || '-'}</span>
        </div>
        <div class="zone-info-row">
            <span class="zone-info-label">Mục đích sử dụng</span>
            <span class="zone-info-value">${zone.landUsePurpose || '-'}</span>
        </div>
        <div class="zone-info-row">
            <span class="zone-info-label">Kỳ quy hoạch</span>
            <span class="zone-info-value">${zone.planningPeriod || '-'}</span>
        </div>
        <div class="zone-info-row">
            <span class="zone-info-label">Tỉnh/TP</span>
            <span class="zone-info-value">${zone.province || '-'}</span>
        </div>
        <div class="zone-info-row">
            <span class="zone-info-label">Quận/Huyện</span>
            <span class="zone-info-value">${zone.district || '-'}</span>
        </div>
        ${zone.notes ? `
        <div class="zone-info-row" style="flex-direction: column; gap: 4px;">
            <span class="zone-info-label">Ghi chú</span>
            <span class="zone-info-value" style="max-width: 100%; text-align: left;">${zone.notes}</span>
        </div>
        ` : ''}
    `;

    // Store zone ID for edit/delete
    panel.dataset.zoneId = zone.id;

    // Setup edit button
    document.getElementById('zone-edit-btn').onclick = () => openEditModal(zone);
    document.getElementById('zone-delete-btn').onclick = () => deleteZone(zone.id);

    panel.classList.remove('hidden');
}

function closeZoneInfo() {
    document.getElementById('zone-info-panel').classList.add('hidden');
}

// ============ ZONE EDIT ============
function openEditModal(zone) {
    document.getElementById('edit-zone-id').value = zone.id;
    document.getElementById('edit-zone-name').value = zone.name || '';
    document.getElementById('edit-zone-code').value = zone.zoneCode || '';
    document.getElementById('edit-zone-purpose').value = zone.landUsePurpose || '';
    document.getElementById('edit-zone-notes').value = zone.notes || '';
    document.getElementById('edit-zone-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-zone-modal').classList.add('hidden');
}

async function saveZoneEdit() {
    const id = document.getElementById('edit-zone-id').value;
    const data = {
        name: document.getElementById('edit-zone-name').value,
        zoneCode: document.getElementById('edit-zone-code').value,
        landUsePurpose: document.getElementById('edit-zone-purpose').value,
        notes: document.getElementById('edit-zone-notes').value
    };

    try {
        await fetchAPI(`/planning-zones/${id}`, 'PUT', data);
        showToast('Thành công', 'Đã cập nhật thông tin vùng', 'success');
        closeEditModal();
        closeZoneInfo();
        await loadPlanningZones();
    } catch (error) {
        console.error('Error updating zone:', error);
        showToast('Lỗi', 'Không thể cập nhật', 'error');
    }
}

async function deleteZone(zoneId) {
    if (!confirm('Xác nhận xóa vùng quy hoạch này?')) return;

    try {
        await fetchAPI(`/planning-zones/${zoneId}`, 'DELETE');
        showToast('Thành công', 'Đã xóa vùng quy hoạch', 'success');
        closeZoneInfo();
        await loadPlanningZones();
    } catch (error) {
        console.error('Error deleting zone:', error);
        showToast('Lỗi', 'Không thể xóa', 'error');
    }
}

// ============ LEGEND ============
function renderLegend() {
    const content = document.getElementById('legend-content');

    if (!zoneTypes || zoneTypes.length === 0) {
        content.innerHTML = '<p class="text-gray-500 text-sm">Không có dữ liệu</p>';
        return;
    }

    // Group by category
    const categories = {};
    zoneTypes.forEach(type => {
        const cat = type.category || 'Khác';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(type);
    });

    let html = '';
    for (const [category, types] of Object.entries(categories)) {
        html += `<div class="mb-3">
            <div class="text-xs font-semibold text-gray-500 uppercase mb-2">${category}</div>
            ${types.map(type => `
                <div class="legend-item">
                    <div class="legend-color" style="background-color: ${type.defaultColor}"></div>
                    <span class="legend-label">${type.name}</span>
                    <span class="legend-code">${type.code}</span>
                </div>
            `).join('')}
        </div>`;
    }

    content.innerHTML = html;
}

function renderZoneTypesList() {
    const container = document.getElementById('zone-types-list');

    if (!zoneTypes || zoneTypes.length === 0) {
        container.innerHTML = '<p class="text-gray-500">Không có dữ liệu</p>';
        return;
    }

    container.innerHTML = zoneTypes.map(type => `
        <div class="zone-type-item">
            <div class="zone-type-color" style="background-color: ${type.defaultColor}"></div>
            <div class="zone-type-info">
                <h4>${type.name}</h4>
                <p>${type.category} - ${type.description || ''}</p>
            </div>
            <span class="zone-type-code">${type.code}</span>
        </div>
    `).join('');
}

// ============ ZONES LIST ============
function renderZonesList() {
    const container = document.getElementById('zones-list');

    if (!allZones || allZones.length === 0) {
        container.innerHTML = `
            <div class="col-span-3 text-center py-8 text-gray-500">
                <span class="material-icons-round text-4xl mb-2">layers</span>
                <p>Chưa có vùng quy hoạch nào</p>
            </div>
        `;
        return;
    }

    container.innerHTML = allZones.map(zone => `
        <div class="zone-card" onclick="focusOnZone(${zone.id})">
            <div class="zone-card-header">
                <div class="zone-card-color" style="background-color: ${zone.fillColor || '#10B981'}"></div>
                <div class="zone-card-title">
                    <h4>${zone.name || 'Chưa đặt tên'}</h4>
                    <p>${zone.zoneCode || ''} - ${zone.zoneType || ''}</p>
                </div>
            </div>
            <div class="zone-card-meta">
                <div class="zone-card-meta-item">
                    <span class="zone-card-meta-label">Tỉnh/TP</span>
                    <span class="zone-card-meta-value">${zone.province || '-'}</span>
                </div>
                <div class="zone-card-meta-item">
                    <span class="zone-card-meta-label">Quận/Huyện</span>
                    <span class="zone-card-meta-value">${zone.district || '-'}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function focusOnZone(zoneId) {
    const zone = allZones.find(z => z.id === zoneId);
    if (!zone) return;

    switchTab('map');

    setTimeout(() => {
        if (zone.centerLat && zone.centerLng) {
            map.setView([zone.centerLat, zone.centerLng], 16);
        }
        showZoneInfo(zone);
    }, 200);
}

// ============ UTILITIES ============
async function fetchAPI(url, method = 'GET', body = null) {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    // Only add Authorization header if token exists
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${url}`, options);

    if (!response.ok) {
        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }
        throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showToast(title, message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <div class="toast-icon ${type}">
            <span class="material-icons-round">${type === 'success' ? 'check_circle' : 'error'}</span>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// ============ SNAPSHOTS ============

async function loadSnapshots() {
    try {
        const response = await fetchAPI('/planning-zones/snapshots');
        renderSnapshotsList(response);
    } catch (error) {
        console.error('Error loading snapshots:', error);
    }
}

function renderSnapshotsList(snapshots) {
    const container = document.getElementById('snapshots-list');
    if (!container) return;

    if (!snapshots || snapshots.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <span class="material-icons-round text-4xl">photo_camera</span>
                <p class="mt-2">Chưa có snapshot nào</p>
                <p class="text-sm">Tạo snapshot đầu tiên để bắt đầu theo dõi lịch sử</p>
            </div>
        `;
        return;
    }

    container.innerHTML = snapshots.map((s, index) => `
        <div class="snapshot-item bg-white rounded-xl p-4 shadow-sm border border-gray-100 
                    hover:shadow-md transition-all transform hover:-translate-y-1"
             style="animation: fadeSlideIn 0.3s ease-out ${index * 0.05}s both">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span class="material-icons-round text-blue-600">photo_camera</span>
                    </div>
                    <div>
                        <h4 class="font-semibold text-gray-800">${s.name}</h4>
                        <p class="text-sm text-gray-500">${s.description || 'Không có mô tả'}</p>
                        <div class="flex items-center gap-4 mt-1 text-xs text-gray-400">
                            <span><span class="material-icons-round text-xs align-middle">layers</span> ${s.zonesCount} zones</span>
                            <span><span class="material-icons-round text-xs align-middle">schedule</span> ${formatDate(s.createdAt)}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="openRollbackModal(${s.id}, '${s.name}')"
                        class="flex items-center gap-1 px-3 py-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                        <span class="material-icons-round text-lg">restore</span>
                        <span class="text-sm font-medium">Rollback</span>
                    </button>
                    <button onclick="deleteSnapshot(${s.id})"
                        class="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <span class="material-icons-round">delete</span>
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    // Animate items
    if (typeof gsap !== 'undefined') {
        gsap.from('.snapshot-item', {
            opacity: 0,
            y: 20,
            stagger: 0.05,
            duration: 0.3,
            ease: 'power2.out'
        });
    }
}

function openCreateSnapshotModal() {
    document.getElementById('create-snapshot-modal').classList.remove('hidden');
    document.getElementById('snapshot-name').value = 'Snapshot ' + new Date().toLocaleDateString('vi-VN');
    document.getElementById('snapshot-description').value = '';

    if (typeof gsap !== 'undefined') {
        gsap.from('#create-snapshot-modal .modal-content', {
            scale: 0.9,
            opacity: 0,
            duration: 0.3,
            ease: 'back.out(1.7)'
        });
    }
}

function closeCreateSnapshotModal() {
    if (typeof gsap !== 'undefined') {
        gsap.to('#create-snapshot-modal .modal-content', {
            scale: 0.9,
            opacity: 0,
            duration: 0.2,
            onComplete: () => {
                document.getElementById('create-snapshot-modal').classList.add('hidden');
            }
        });
    } else {
        document.getElementById('create-snapshot-modal').classList.add('hidden');
    }
}

async function submitCreateSnapshot() {
    const name = document.getElementById('snapshot-name').value.trim();
    const description = document.getElementById('snapshot-description').value.trim();

    if (!name) {
        showToast('Lỗi', 'Vui lòng nhập tên snapshot', 'error');
        return;
    }

    try {
        showToast('Đang xử lý...', 'Đang tạo snapshot, vui lòng chờ...', 'info');

        const response = await fetchAPI('/planning-zones/snapshots', 'POST', {
            name,
            description
        });

        if (response.success) {
            showToast('Thành công', response.message, 'success');
            closeCreateSnapshotModal();
            await loadSnapshots();
        } else {
            showToast('Lỗi', response.error || 'Không thể tạo snapshot', 'error');
        }
    } catch (error) {
        showToast('Lỗi', error.message, 'error');
    }
}

function openRollbackModal(snapshotId, snapshotName) {
    document.getElementById('rollback-snapshot-id').value = snapshotId;
    document.getElementById('rollback-snapshot-name').textContent = snapshotName;
    document.getElementById('rollback-modal').classList.remove('hidden');

    if (typeof gsap !== 'undefined') {
        gsap.from('#rollback-modal .modal-content', {
            scale: 0.9,
            opacity: 0,
            duration: 0.3,
            ease: 'back.out(1.7)'
        });
    }
}

function closeRollbackModal() {
    if (typeof gsap !== 'undefined') {
        gsap.to('#rollback-modal .modal-content', {
            scale: 0.9,
            opacity: 0,
            duration: 0.2,
            onComplete: () => {
                document.getElementById('rollback-modal').classList.add('hidden');
            }
        });
    } else {
        document.getElementById('rollback-modal').classList.add('hidden');
    }
}

async function confirmRollback() {
    const snapshotId = document.getElementById('rollback-snapshot-id').value;

    try {
        showToast('Đang xử lý...', 'Đang rollback, vui lòng chờ...', 'info');

        const response = await fetchAPI(`/planning-zones/rollback/${snapshotId}`, 'POST');

        if (response.success) {
            showToast('Thành công', response.message, 'success');
            closeRollbackModal();

            // Reload zones on map
            await loadPlanningZones();
            renderZonesList();
        } else {
            showToast('Lỗi', response.error || 'Không thể rollback', 'error');
        }
    } catch (error) {
        showToast('Lỗi', error.message, 'error');
    }
}

async function deleteSnapshot(snapshotId) {
    if (!confirm('Bạn có chắc muốn xóa snapshot này?')) return;

    try {
        const response = await fetchAPI(`/planning-zones/snapshots/${snapshotId}`, 'DELETE');

        if (response.success) {
            showToast('Thành công', 'Đã xóa snapshot', 'success');
            await loadSnapshots();
        } else {
            showToast('Lỗi', response.error || 'Không thể xóa snapshot', 'error');
        }
    } catch (error) {
        showToast('Lỗi', error.message, 'error');
    }
}

// ============ POLYGON EDITING ============

let editableLayer = null;
let editingZoneId = null;

function enablePolygonEdit(zoneId, layer) {
    if (!layer) {
        showToast('Lỗi', 'Không thể sửa zone này', 'error');
        return;
    }

    editingZoneId = zoneId;
    editableLayer = layer;

    // Enable editing on the layer
    if (layer.editing) {
        layer.editing.enable();
        showToast('Chế độ sửa', 'Kéo các điểm để chỉnh sửa hình dạng. Click "Lưu" khi hoàn tất.', 'info');

        // Show save button overlay
        showEditControls();
    }
}

function showEditControls() {
    // Create floating edit controls
    let controls = document.getElementById('edit-polygon-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.id = 'edit-polygon-controls';
        controls.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-white shadow-xl rounded-xl p-4 flex gap-3 z-50';
        controls.innerHTML = `
            <button onclick="savePolygonEdit()" class="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
                <span class="material-icons-round">save</span>
                Lưu thay đổi
            </button>
            <button onclick="cancelPolygonEdit()" class="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                <span class="material-icons-round">close</span>
                Hủy
            </button>
        `;
        document.body.appendChild(controls);

        if (typeof gsap !== 'undefined') {
            gsap.from(controls, {
                y: 50,
                opacity: 0,
                duration: 0.3,
                ease: 'power2.out'
            });
        }
    }
}

function hideEditControls() {
    const controls = document.getElementById('edit-polygon-controls');
    if (controls) {
        if (typeof gsap !== 'undefined') {
            gsap.to(controls, {
                y: 50,
                opacity: 0,
                duration: 0.2,
                onComplete: () => controls.remove()
            });
        } else {
            controls.remove();
        }
    }
}

async function savePolygonEdit() {
    if (!editableLayer || !editingZoneId) {
        showToast('Lỗi', 'Không có polygon đang chỉnh sửa', 'error');
        return;
    }

    try {
        // Get new coordinates
        const latlngs = editableLayer.getLatLngs()[0];
        const coordinates = latlngs.map(ll => [ll.lat, ll.lng]);

        // Calculate center
        const bounds = editableLayer.getBounds();
        const center = bounds.getCenter();

        const response = await fetchAPI(`/planning-zones/${editingZoneId}/geometry`, 'PUT', {
            boundaryCoordinates: JSON.stringify(coordinates),
            centerLat: center.lat,
            centerLng: center.lng
        });

        if (response.success) {
            showToast('Thành công', 'Đã lưu hình dạng mới', 'success');
            editableLayer.editing.disable();
            hideEditControls();
            editableLayer = null;
            editingZoneId = null;
        } else {
            showToast('Lỗi', response.error || 'Không thể lưu', 'error');
        }
    } catch (error) {
        showToast('Lỗi', error.message, 'error');
    }
}

function cancelPolygonEdit() {
    if (editableLayer && editableLayer.editing) {
        editableLayer.editing.disable();
    }
    hideEditControls();
    editableLayer = null;
    editingZoneId = null;

    // Reload to reset positions
    loadPlanningZones();
}

// ============ DELETE BY UPLOAD ============

async function deleteZonesByUpload(uploadId) {
    if (!confirm('Bạn có chắc muốn xóa TẤT CẢ zones từ upload này?')) return;

    try {
        const response = await fetchAPI(`/planning-zones/by-upload/${uploadId}`, 'DELETE');

        if (response.success) {
            showToast('Thành công', response.message, 'success');
            await loadPlanningZones();
            await loadUploads();
            renderZonesList();
        } else {
            showToast('Lỗi', response.error || 'Không thể xóa', 'error');
        }
    } catch (error) {
        showToast('Lỗi', error.message, 'error');
    }
}

// Make functions global
window.viewUploadZones = viewUploadZones;
window.deleteUpload = deleteUpload;
window.focusOnZone = focusOnZone;
window.closeEditModal = closeEditModal;
window.saveZoneEdit = saveZoneEdit;
window.loadSnapshots = loadSnapshots;
window.openCreateSnapshotModal = openCreateSnapshotModal;
window.closeCreateSnapshotModal = closeCreateSnapshotModal;
window.submitCreateSnapshot = submitCreateSnapshot;
window.openRollbackModal = openRollbackModal;
window.closeRollbackModal = closeRollbackModal;
window.confirmRollback = confirmRollback;
window.deleteSnapshot = deleteSnapshot;
window.enablePolygonEdit = enablePolygonEdit;
window.savePolygonEdit = savePolygonEdit;
window.cancelPolygonEdit = cancelPolygonEdit;
window.deleteZonesByUpload = deleteZonesByUpload;
