/* =====================================================
   Admin Advanced - Planning Zones Management JS
   ===================================================== */

// API_BASE_URL is already defined in config.js

// Global variables
let map;
let planningZonesLayer;
let zoneTypes = [];
let allZones = [];
let selectedFile = null;
let currentTab = 'map';

// Add global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', function (event) {
    console.error('Unhandled promise rejection:', event.reason);
    // Prevent default error handling to avoid console spam
    event.preventDefault();
});

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

    // Load uploads with retry for robustness
    try {
        await loadUploads();
    } catch (error) {
        console.warn('Failed to load uploads on first try, will retry on tab switch');
    }

    // Setup logout
    document.getElementById('logout-btn')?.addEventListener('click', logout);

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
        'image-analysis': 'Phân tích Ảnh Bản đồ AI',
        zones: 'Danh sách Vùng Quy hoạch',
        legend: 'Chú giải Màu sắc',
        snapshots: 'Lịch sử Phiên bản'
    };
    document.getElementById('page-title').textContent = titles[tab] || 'Quản lý Nâng cao';

    // Show/hide content
    document.getElementById('map-container').classList.toggle('hidden', tab !== 'map');
    document.getElementById('uploads-container').classList.toggle('hidden', tab !== 'uploads');
    document.getElementById('image-analysis-container')?.classList.toggle('hidden', tab !== 'image-analysis');
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
    if (tab === 'image-analysis') initImageAnalysisTab();
}

// ============ UPLOAD ============
let selectedAdditionalImages = [];

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

    // AI Analysis checkbox toggle
    const enableAI = document.getElementById('enable-ai-analysis');
    enableAI?.addEventListener('change', (e) => {
        const section = document.getElementById('additional-images-section');
        section?.classList.toggle('hidden', !e.target.checked);
    });

    // Use separate images checkbox
    const useSeparateImages = document.getElementById('use-separate-images');
    useSeparateImages?.addEventListener('change', (e) => {
        const uploadArea = document.getElementById('image-upload-area');
        uploadArea?.classList.toggle('hidden', !e.target.checked);
        if (!e.target.checked) {
            selectedAdditionalImages = [];
            updateImagePreview();
        }
    });

    // Additional images input
    const additionalImagesInput = document.getElementById('additional-images-input');
    additionalImagesInput?.addEventListener('change', handleAdditionalImagesSelect);
}

function handleAdditionalImagesSelect(e) {
    const files = Array.from(e.target.files);

    // Validate max 5 images
    if (files.length > 5) {
        showToast('Cảnh báo', 'Tối đa 5 ảnh. Chỉ lấy 5 ảnh đầu tiên.', 'warning');
        files.splice(5);
    }

    // Validate each file
    const validFiles = [];
    for (const file of files) {
        // Check file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
        if (!validTypes.includes(file.type)) {
            showToast('Cảnh báo', `File ${file.name} không đúng định dạng (JPG/PNG/PDF)`, 'warning');
            continue;
        }

        // Check file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            showToast('Cảnh báo', `File ${file.name} quá lớn (tối đa 10MB)`, 'warning');
            continue;
        }

        validFiles.push(file);
    }

    selectedAdditionalImages = validFiles;
    updateImagePreview();
}

function updateImagePreview() {
    const previewContainer = document.getElementById('selected-images-preview');
    if (!previewContainer) return;

    if (selectedAdditionalImages.length === 0) {
        previewContainer.innerHTML = '';
        return;
    }

    previewContainer.innerHTML = selectedAdditionalImages.map((file, idx) => `
        <div class="relative bg-white border border-purple-200 rounded-lg p-2">
            <div class="flex items-center gap-2">
                <span class="material-icons-round text-purple-500" style="font-size:20px">
                    ${file.type === 'application/pdf' ? 'picture_as_pdf' : 'image'}
                </span>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-medium truncate">${file.name}</p>
                    <p class="text-xs text-gray-500">${formatFileSize(file.size)}</p>
                </div>
                <button onclick="removeAdditionalImage(${idx})" class="text-gray-400 hover:text-red-500">
                    <span class="material-icons-round" style="font-size:18px">close</span>
                </button>
            </div>
        </div>
    `).join('');
}

function removeAdditionalImage(index) {
    selectedAdditionalImages.splice(index, 1);
    updateImagePreview();

    // Reset file input
    const input = document.getElementById('additional-images-input');
    if (input) input.value = '';
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

    const province = document.getElementById('upload-province')?.value;
    const district = document.getElementById('upload-district')?.value;
    const notes = document.getElementById('upload-notes')?.value;
    const mapType = document.querySelector('input[name="map-type"]:checked')?.value || 'planning';

    if (!province) {
        showToast('Lỗi', 'Vui lòng chọn tỉnh/thành phố', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('province', province);
    formData.append('mapType', mapType);
    if (district) formData.append('district', district);
    if (notes) formData.append('notes', notes);

    const formContainer = document.getElementById('upload-form-container');
    const progressContainer = document.getElementById('upload-progress');

    if (!formContainer || !progressContainer) {
        console.error('Upload UI elements not found');
        showToast('Lỗi', 'Lỗi giao diện. Vui lòng tải lại trang.', 'error');
        return;
    }

    // Show progress
    formContainer.classList.add('hidden');
    progressContainer.classList.remove('hidden');

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');

        if (!token) {
            throw new Error('Bạn chưa đăng nhập. Vui lòng đăng nhập lại.');
        }

        console.log('Uploading KMZ file:', selectedFile.name);
        const response = await fetch(`${API_BASE_URL}/admin/kmz/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        console.log('Upload response status:', response.status);
        const data = await response.json();
        console.log('Upload response data:', data);

        if (response.ok && data.success) {
            showToast('Thành công', data.message || 'Đã upload và xử lý file', 'success');
            clearSelectedFile();

            // Reset form
            document.getElementById('upload-form-container').classList.remove('hidden');
            document.getElementById('upload-progress').classList.add('hidden');

            // Reload data
            await loadUploads();
            await loadPlanningZones();

            // Switch to map to see results
            setTimeout(() => switchTab('map'), 1500);
        } else {
            throw new Error(data.error || data.message || 'Upload failed');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Lỗi', error.message || 'Không thể upload file. Vui lòng kiểm tra kết nối.', 'error');

        // Show form again
        document.getElementById('upload-form-container').classList.remove('hidden');
        document.getElementById('upload-progress').classList.add('hidden');
    }
}

async function loadUploads() {
    try {
        console.log('Loading KMZ uploads...');
        const uploads = await fetchAPI('/admin/kmz/uploads');
        console.log('Uploads loaded:', uploads?.length || 0);
        renderUploadsList(uploads || []);
    } catch (error) {
        console.error('Error loading uploads:', error);
        // Show user-friendly error
        const container = document.getElementById('uploads-list');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-8 text-red-500">
                    <span class="material-icons-round text-4xl mb-2">error</span>
                    <p>Không thể tải danh sách upload</p>
                    <button onclick="loadUploads()" class="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        Thử lại
                    </button>
                </div>
            `;
        }
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

async function loadPlanningZones(mapType = null) {
    try {
        const type = mapType || currentMapType || 'planning';
        const zones = await fetchAPI(`/planning-zones?mapType=${type}`);
        allZones = zones || [];

        // Update stats
        document.getElementById('zones-count').textContent = allZones.length;

        // Render zones on map
        renderZonesOnMap(allZones);

        // Update legend
        if (type === 'soil') {
            loadSoilTypesLegend();
        } else {
            loadZoneTypesLegend();
        }
    } catch (error) {
        console.error('Error loading zones:', error);
    }
}

async function loadSoilTypesLegend() {
    try {
        const soilTypes = await fetchAPI('/planning-zones/soil-types');
        const legendContent = document.getElementById('legend-content');

        if (!soilTypes || soilTypes.length === 0) {
            legendContent.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Không có dữ liệu</p>';
            return;
        }

        legendContent.innerHTML = soilTypes.map(type => `
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${type.defaultColor || '#ccc'}"></div>
                <div class="legend-info">
                    <div class="legend-name">${type.name}</div>
                    <div class="legend-code">${type.code} - ${type.category || ''}</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading soil types legend:', error);
    }
}

async function loadZoneTypesLegend() {
    try {
        const types = await fetchAPI('/planning-zones/types');
        const legendContent = document.getElementById('legend-content');

        if (!types || types.length === 0) {
            legendContent.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Không có dữ liệu</p>';
            return;
        }

        legendContent.innerHTML = types.map(type => `
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${type.defaultColor || '#ccc'}"></div>
                <div class="legend-info">
                    <div class="legend-name">${type.name}</div>
                    <div class="legend-code">${type.code}</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading zone types legend:', error);
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
                    interactive: true,
                    className: 'map-image-overlay' // Add class for CSS styling
                });

                imageOverlay.on('click', () => showZoneInfo(zone));
                imageOverlay.addTo(planningZonesLayer);

                // Apply blend mode to remove white background effect
                setTimeout(() => {
                    const overlayElements = document.querySelectorAll('.map-image-overlay');
                    overlayElements.forEach(el => {
                        el.style.mixBlendMode = 'multiply';
                    });
                }, 100);

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

    // Format area for display
    const formatArea = (areaSqm) => {
        if (!areaSqm) return '-';
        const areaNum = parseFloat(areaSqm);
        if (areaNum >= 10000) {
            return `${(areaNum / 10000).toFixed(2)} ha`;
        }
        return `${areaNum.toFixed(0)} m²`;
    };

    // Determine map type for section headers
    const isSoilMap = zone.mapType === 'soil' || zone.soilCategory;
    const typeLabel = isSoilMap ? 'Loại đất' : 'Loại quy hoạch';

    content.innerHTML = `
        <!-- Zone Color & Code Header -->
        <div class="zone-info-header" style="display:flex;align-items:center;gap:12px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #eee;">
            <div style="width:40px;height:40px;border-radius:8px;background-color:${zone.fillColor || '#10B981'};border:2px solid #333;"></div>
            <div>
                <div style="font-size:14px;font-weight:600;color:#333;">${zone.zoneCode || 'Chưa có mã'}</div>
                <div style="font-size:12px;color:#666;">${zone.zoneType || typeLabel}</div>
            </div>
        </div>

        <!-- Basic Info -->
        <div class="zone-info-row">
            <span class="zone-info-label">Mã quy hoạch</span>
            <span class="zone-info-value">${zone.zoneCode || '-'}</span>
        </div>
        <div class="zone-info-row">
            <span class="zone-info-label">${typeLabel}</span>
            <span class="zone-info-value">${zone.zoneType || '-'}</span>
        </div>
        <div class="zone-info-row">
            <span class="zone-info-label">Mục đích sử dụng</span>
            <span class="zone-info-value">${zone.landUsePurpose || '-'}</span>
        </div>

        <!-- Area Information -->
        <div class="zone-info-row" style="background:#f0fdf4;padding:8px;border-radius:6px;margin:8px 0;">
            <span class="zone-info-label" style="color:#166534;">📐 Diện tích</span>
            <span class="zone-info-value" style="font-weight:600;color:#166534;">${formatArea(zone.areaSqm)}</span>
        </div>

        ${isSoilMap && zone.soilCategory ? `
        <!-- Soil Type Details -->
        <div style="margin:10px 0;padding:10px;background:#fef3c7;border-radius:8px;">
            <div style="font-size:11px;text-transform:uppercase;color:#92400e;font-weight:600;margin-bottom:6px;">🌱 Thông tin đất</div>
            <div class="zone-info-row" style="margin:0;">
                <span class="zone-info-label">Phân loại</span>
                <span class="zone-info-value">${zone.soilCategory || '-'}</span>
            </div>
            ${zone.phRange ? `<div class="zone-info-row" style="margin:0;"><span class="zone-info-label">pH</span><span class="zone-info-value">${zone.phRange}</span></div>` : ''}
            ${zone.fertility ? `<div class="zone-info-row" style="margin:0;"><span class="zone-info-label">Độ phì</span><span class="zone-info-value">${zone.fertility}</span></div>` : ''}
            ${zone.suitableCrops ? `<div class="zone-info-row" style="flex-direction:column;gap:4px;margin:0;"><span class="zone-info-label">Cây trồng phù hợp</span><span class="zone-info-value" style="max-width:100%;text-align:left;font-size:11px;color:#666;">${zone.suitableCrops}</span></div>` : ''}
        </div>
        ` : ''}

        ${!isSoilMap && zone.planningPeriod ? `
        <div class="zone-info-row">
            <span class="zone-info-label">Kỳ quy hoạch</span>
            <span class="zone-info-value">${zone.planningPeriod}</span>
        </div>
        ` : ''}

        <!-- Location -->
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid #eee;">
            <div class="zone-info-row">
                <span class="zone-info-label">Tỉnh/TP</span>
                <span class="zone-info-value">${zone.province || '-'}</span>
            </div>
            <div class="zone-info-row">
                <span class="zone-info-label">Quận/Huyện</span>
                <span class="zone-info-value">${zone.district || '-'}</span>
            </div>
            ${zone.commune ? `
            <div class="zone-info-row">
                <span class="zone-info-label">Xã/Phường</span>
                <span class="zone-info-value">${zone.commune}</span>
            </div>
            ` : ''}
        </div>

        ${zone.notes ? `
        <div class="zone-info-row" style="flex-direction: column; gap: 4px; margin-top:10px;">
            <span class="zone-info-label">📝 Ghi chú</span>
            <span class="zone-info-value" style="max-width: 100%; text-align: left; font-size: 12px; color: #555;">${zone.notes}</span>
        </div>
        ` : ''}

        ${zone.analysisId ? `
        <div style="margin-top:10px;padding:6px 8px;background:#eff6ff;border-radius:6px;font-size:11px;color:#1e40af;">
            🤖 Phân tích AI: ${zone.analysisId}
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
window.updateDistrictOptions = updateDistrictOptions;
window.closeAIAnalysisModal = closeAIAnalysisModal;
window.confirmAIAnalysis = confirmAIAnalysis;
window.removeAdditionalImage = removeAdditionalImage;

// ============ DISTRICT DATA BY PROVINCE ============
const DISTRICTS_BY_PROVINCE = {
    'Cần Thơ': [
        { value: 'Ninh Kiều', label: 'Quận Ninh Kiều' },
        { value: 'Bình Thủy', label: 'Quận Bình Thủy' },
        { value: 'Cái Răng', label: 'Quận Cái Răng' },
        { value: 'Ô Môn', label: 'Quận Ô Môn' },
        { value: 'Thốt Nốt', label: 'Quận Thốt Nốt' },
        { value: 'Phong Điền', label: 'Huyện Phong Điền' },
        { value: 'Cờ Đỏ', label: 'Huyện Cờ Đỏ' },
        { value: 'Vĩnh Thạnh', label: 'Huyện Vĩnh Thạnh' },
        { value: 'Thới Lai', label: 'Huyện Thới Lai' }
    ],
    'Cà Mau': [
        { value: 'TP Cà Mau', label: 'TP Cà Mau' },
        { value: 'Thới Bình', label: 'Huyện Thới Bình' },
        { value: 'U Minh', label: 'Huyện U Minh' },
        { value: 'Trần Văn Thời', label: 'Huyện Trần Văn Thời' },
        { value: 'Cái Nước', label: 'Huyện Cái Nước' },
        { value: 'Đầm Dơi', label: 'Huyện Đầm Dơi' },
        { value: 'Năm Căn', label: 'Huyện Năm Căn' },
        { value: 'Phú Tân', label: 'Huyện Phú Tân' },
        { value: 'Ngọc Hiển', label: 'Huyện Ngọc Hiển' }
    ],
    'Bạc Liêu': [
        { value: 'TP Bạc Liêu', label: 'TP Bạc Liêu' },
        { value: 'Hồng Dân', label: 'Huyện Hồng Dân' },
        { value: 'Phước Long', label: 'Huyện Phước Long' },
        { value: 'Vĩnh Lợi', label: 'Huyện Vĩnh Lợi' },
        { value: 'Giá Rai', label: 'TX Giá Rai' },
        { value: 'Đông Hải', label: 'Huyện Đông Hải' },
        { value: 'Hòa Bình', label: 'Huyện Hòa Bình' }
    ]
};

function updateDistrictOptions() {
    const province = document.getElementById('upload-province').value;
    const districtSelect = document.getElementById('upload-district');
    const districts = DISTRICTS_BY_PROVINCE[province] || [];

    districtSelect.innerHTML = '<option value="">-- Chọn quận/huyện --</option>';
    districts.forEach(d => {
        const option = document.createElement('option');
        option.value = d.value;
        option.textContent = d.label;
        districtSelect.appendChild(option);
    });
}

// Initialize district options on page load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(updateDistrictOptions, 100);
});

// ============ MAP TYPE TOGGLE ============
let currentMapType = 'planning';

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.querySelectorAll('.map-type-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const mapType = this.dataset.mapType;
                if (mapType === currentMapType) return;

                currentMapType = mapType;

                // Update button states
                document.querySelectorAll('.map-type-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                // Reload zones for this map type
                loadPlanningZones(mapType);

                // Update legend header
                const legendHeader = document.querySelector('.legend-header');
                if (legendHeader) {
                    if (mapType === 'soil') {
                        legendHeader.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
                        legendHeader.querySelector('span:nth-child(2)').textContent = 'Chú giải Thổ nhưỡng';
                    } else {
                        legendHeader.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
                        legendHeader.querySelector('span:nth-child(2)').textContent = 'Chú giải Màu sắc';
                    }
                }

                showToast(
                    mapType === 'soil' ? 'Bản đồ Thổ nhưỡng' : 'Bản đồ Quy hoạch',
                    `Đang hiển thị lớp ${mapType === 'soil' ? 'thổ nhưỡng' : 'quy hoạch'}`,
                    'success'
                );
            });
        });
    }, 500);
});

// ============ AI ANALYSIS ============
let aiAnalysisData = null;

async function submitUploadWithAI() {
    if (!selectedFile) {
        showToast('Lỗi', 'Vui lòng chọn file', 'error');
        return;
    }

    const enableAI = document.getElementById('enable-ai-analysis')?.checked;

    if (!enableAI) {
        // Normal upload
        return submitUpload();
    }

    // AI Analysis flow
    const province = document.getElementById('upload-province').value;
    const district = document.getElementById('upload-district').value;
    const mapType = document.querySelector('input[name="map-type"]:checked')?.value || 'planning';
    const useSeparateImages = document.getElementById('use-separate-images')?.checked;

    // Show AI modal
    document.getElementById('ai-analysis-modal').classList.remove('hidden');
    document.getElementById('ai-analysis-progress').classList.remove('hidden');
    document.getElementById('ai-analysis-results').classList.add('hidden');
    document.getElementById('confirm-ai-btn').disabled = true;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('province', province);
    formData.append('mapType', mapType);
    if (district) formData.append('district', district);

    // Add separate images if provided
    if (useSeparateImages && selectedAdditionalImages.length > 0) {
        formData.append('useSeparateImages', 'true');
        selectedAdditionalImages.forEach((img, idx) => {
            formData.append('additionalImages', img);
        });
        updateAIProgress(`Đang tải lên KMZ + ${selectedAdditionalImages.length} ảnh bổ sung...`);
    } else {
        updateAIProgress('Đang tải file lên server...');
    }

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');

        // Step 1: Upload and trigger AI analysis
        const response = await fetch(`${API_BASE_URL}/admin/kmz/analyze`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Phân tích thất bại');
        }

        updateAIProgress('Đang phân tích màu sắc ảnh...');

        // Step 2: Poll for results or use returned data
        if (data.analysisId) {
            // Need to poll for results
            await pollAnalysisResults(data.analysisId);
        } else if (data.results) {
            // Results returned directly
            displayAIResults(data.results);
        }

    } catch (error) {
        console.error('AI Analysis error:', error);
        showToast('Lỗi', error.message || 'Không thể phân tích file', 'error');
        closeAIAnalysisModal();
    }
}

function updateAIProgress(status) {
    const statusEl = document.getElementById('ai-progress-status');
    if (statusEl) statusEl.textContent = status;
}

async function pollAnalysisResults(analysisId, maxAttempts = 30) {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

        try {
            const response = await fetch(`${API_BASE_URL}/admin/kmz/analyze/${analysisId}/status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.status === 'completed') {
                displayAIResults(data.results);
                return;
            } else if (data.status === 'failed') {
                throw new Error(data.error || 'Phân tích thất bại');
            }

            updateAIProgress(data.message || `Đang xử lý... (${Math.round((i / maxAttempts) * 100)}%)`);
        } catch (e) {
            console.error('Poll error:', e);
        }
    }

    throw new Error('Phân tích quá thời gian');
}

function displayAIResults(results) {
    aiAnalysisData = results;

    document.getElementById('ai-analysis-progress').classList.add('hidden');
    document.getElementById('ai-analysis-results').classList.remove('hidden');
    document.getElementById('confirm-ai-btn').disabled = false;

    // Update summary
    const zones = results.zones || [];
    const types = [...new Set(zones.map(z => z.soilType || z.zoneType))];

    document.getElementById('ai-analysis-summary').textContent =
        `Đã phát hiện ${zones.length} vùng từ ${types.length} loại đất khác nhau`;
    document.getElementById('ai-zones-count').textContent = `${zones.length} vùng`;
    document.getElementById('ai-types-count').textContent = `${types.length} loại đất`;

    // Render color mapping
    const colorMapping = document.getElementById('ai-color-mapping');
    // P2 FIX: Correctly access colorToSoil or colorToCode property
    const colorMap = (results.colorMapping && results.colorMapping.colorToSoil)
        ? results.colorMapping.colorToSoil
        : (results.colorToCode || {});
    const hasColorToSoil = !!(results.colorMapping && results.colorMapping.colorToSoil);
    const colorToCode = results.colorToCode || {};

    // P2 FIX: Handle if colorMap is string (JSON) or object
    let mapEntries = [];
    try {
        if (typeof colorMap === 'string') {
            mapEntries = Object.entries(JSON.parse(colorMap));
        } else {
            mapEntries = Object.entries(colorMap);
        }
    } catch (e) {
        console.warn('Error parsing color map:', e);
        mapEntries = [];
    }

    if (mapEntries.length === 0) {
        colorMapping.innerHTML = '<div class="col-span-3 text-center text-gray-500 py-2">Không có dữ liệu ánh xạ màu</div>';
    } else {
        colorMapping.innerHTML = mapEntries.map(([color, info]) => {
            // Handle if info is just a string code (old format) or object (new format)
            const name = typeof info === 'object' ? (info.name || 'Chưa xác định') : (info || 'Chưa xác định');
            const code = typeof info === 'object'
                ? (info.code || 'N/A')
                : (hasColorToSoil ? (colorToCode[color] || 'N/A') : (info || 'N/A'));
            const count = typeof info === 'object' ? (info.count || 0) : '?';

            return `
            <div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                <div class="w-6 h-6 rounded border shadow-sm" style="background-color: ${color}"></div>
                <div class="text-sm truncate">
                    <div class="font-medium truncate" title="${name}">${name}</div>
                    <div class="text-xs text-gray-500">${code}</div>
                </div>
            </div>
            `;
        }).join('');
    }

    // Render zones preview
    const zonesPreview = document.getElementById('ai-zones-preview');
    zonesPreview.innerHTML = zones.slice(0, 20).map((zone, idx) => `
        <div class="p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 cursor-pointer" 
             onclick="previewZoneOnMap(${idx})">
            <div class="flex items-center gap-2">
                <!-- P2 FIX: Use fillColor with zone.color fallback -->
                <div class="w-4 h-4 rounded border shadow-sm" style="background-color: ${zone.fillColor || zone.color || '#ccc'}"></div>
                <span class="font-medium text-sm truncate flex-1">${zone.name || `Vùng ${idx + 1}`}</span>
            </div>
            <div class="text-xs text-gray-500 mt-1">
                <span>Loại: ${zone.soilType || zone.zoneType || 'N/A'}</span>
                ${zone.areaSqm ? `<span class="ml-2">Diện tích: ${formatArea(zone.areaSqm)}</span>` : ''}
            </div>
        </div>
    `).join('');

    if (zones.length > 20) {
        zonesPreview.innerHTML += `<div class="text-center text-sm text-gray-500 py-2">... và ${zones.length - 20} vùng khác</div>`;
    }

    // Show preview on map
    showAIZonesOnMap(zones);
}

// Preview a single zone on map (center on it)
function previewZoneOnMap(zoneIndex) {
    if (!aiAnalysisData || !aiAnalysisData.zones) return;

    const zone = aiAnalysisData.zones[zoneIndex];
    if (!zone) return;

    // Center map on zone
    if (zone.centerLat && zone.centerLng) {
        map.setView([zone.centerLat, zone.centerLng], 14);
    } else if (zone.coordinates && zone.coordinates.length > 0) {
        const firstCoord = zone.coordinates[0];
        map.setView([firstCoord[0], firstCoord[1]], 14);
    }
}

// Show all AI zones on map as preview
let aiPreviewLayer = null;

function showAIZonesOnMap(zones) {
    // Clear previous preview
    if (aiPreviewLayer) {
        map.removeLayer(aiPreviewLayer);
    }

    aiPreviewLayer = L.layerGroup();

    zones.forEach((zone, idx) => {
        if (!zone.coordinates || zone.coordinates.length < 3) return;

        try {
            // Coordinates từ AI analysis là [[lat, lng], ...]
            const latLngs = zone.coordinates.map(coord => {
                // Handle both [lat, lng] and [lng, lat] formats
                if (Array.isArray(coord)) {
                    // Check if first value looks like latitude (< 90) or longitude (> 90 for VN)
                    if (Math.abs(coord[0]) <= 90) {
                        return [coord[0], coord[1]]; // Already [lat, lng]
                    } else {
                        return [coord[1], coord[0]]; // Convert [lng, lat] to [lat, lng]
                    }
                }
                return coord;
            });

            const polygon = L.polygon(latLngs, {
                fillColor: zone.fillColor || '#10B981',
                fillOpacity: 0.4,
                color: zone.strokeColor || '#333',
                weight: 2,
                dashArray: '5, 5' // Dashed border to indicate preview
            });

            const tooltipContent = `
                <strong>${zone.name || 'Vùng ' + (idx + 1)}</strong><br>
                <small>${zone.soilType || zone.zoneType || 'Chưa xác định'}</small>
                ${zone.areaSqm ? `<br><small>~${formatArea(zone.areaSqm)}</small>` : ''}
            `;
            polygon.bindTooltip(tooltipContent, { className: 'planning-popup' });

            polygon.addTo(aiPreviewLayer);
        } catch (e) {
            console.warn(`Could not add zone ${idx} to preview:`, e);
        }
    });

    aiPreviewLayer.addTo(map);

    // Fit map to show all preview zones
    if (zones.length > 0) {
        try {
            const bounds = aiPreviewLayer.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        } catch (e) {
            console.warn('Could not fit bounds:', e);
        }
    }
}

// Clear AI preview when modal closes
function clearAIPreview() {
    if (aiPreviewLayer) {
        map.removeLayer(aiPreviewLayer);
        aiPreviewLayer = null;
    }
}

function formatArea(sqm) {
    if (sqm >= 10000) {
        return (sqm / 10000).toFixed(2) + ' ha';
    }
    return sqm.toFixed(0) + ' m²';
}

function closeAIAnalysisModal() {
    document.getElementById('ai-analysis-modal').classList.add('hidden');
    aiAnalysisData = null;
    clearAIPreview(); // Clear preview polygons from map
}

async function confirmAIAnalysis() {
    if (!aiAnalysisData) {
        showToast('Lỗi', 'Không có dữ liệu phân tích', 'error');
        return;
    }

    const token = localStorage.getItem('token') || localStorage.getItem('authToken');

    try {
        document.getElementById('confirm-ai-btn').disabled = true;
        document.getElementById('confirm-ai-btn').innerHTML = `
            <span class="material-icons-round animate-spin">sync</span>
            Đang lưu...
        `;

        const response = await fetch(`${API_BASE_URL}/admin/kmz/analyze/confirm`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                analysisId: aiAnalysisData.analysisId,
                zones: aiAnalysisData.zones
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showToast('Thành công', `Đã lưu ${data.zonesCount || 0} vùng vào database`, 'success');
            closeAIAnalysisModal();
            clearSelectedFile();
            await loadPlanningZones();
            await loadUploads();
            setTimeout(() => switchTab('map'), 1000);
        } else {
            throw new Error(data.error || 'Lưu thất bại');
        }
    } catch (error) {
        console.error('Confirm error:', error);
        showToast('Lỗi', error.message, 'error');
        document.getElementById('confirm-ai-btn').disabled = false;
        document.getElementById('confirm-ai-btn').innerHTML = `
            <span class="material-icons-round">check_circle</span>
            Xác nhận và Lưu vào DB
        `;
    }
}

// ============ IMAGE ANALYSIS TAB - MULTI-AI ============
let selectedMapImage = null;
let currentAnalysisId = null;
let analysisEventSource = null;
let resultMapPreview = null;
let currentAnalysisResult = null;

/**
 * Switch map type between 'planning' (Quy hoạch) and 'soil' (Thổ nhưỡng)
 */
function switchMapType(mapType) {
    console.log('Switching map type to:', mapType);

    // Update hidden input
    const hiddenInput = document.getElementById('selected-map-type');
    if (hiddenInput) hiddenInput.value = mapType;

    // Update tabs style
    const planningTab = document.getElementById('tab-planning');
    const soilTab = document.getElementById('tab-soil');

    if (mapType === 'planning') {
        planningTab.classList.add('border-blue-500', 'text-blue-600', 'bg-blue-50');
        planningTab.classList.remove('border-transparent', 'text-gray-500');
        soilTab.classList.remove('border-blue-500', 'text-blue-600', 'bg-blue-50');
        soilTab.classList.add('border-transparent', 'text-gray-500');
    } else {
        soilTab.classList.add('border-blue-500', 'text-blue-600', 'bg-blue-50');
        soilTab.classList.remove('border-transparent', 'text-gray-500');
        planningTab.classList.remove('border-blue-500', 'text-blue-600', 'bg-blue-50');
        planningTab.classList.add('border-transparent', 'text-gray-500');
    }

    // Update description
    const descContent = document.getElementById('map-type-desc-content');
    const descBox = document.getElementById('map-type-desc');
    const uploadLabel = document.getElementById('upload-map-type-label');
    const aiTargetType = document.getElementById('ai-target-type');

    if (mapType === 'planning') {
        descBox.classList.remove('bg-amber-50', 'border-amber-200');
        descBox.classList.add('bg-blue-50', 'border-blue-200');
        descContent.innerHTML = `
            <strong class="text-blue-800">Bản đồ Quy hoạch:</strong>
            <span class="text-blue-700">Phân loại đất theo mục đích sử dụng (LUC - Đất trồng lúa, ONT - Đất ở nông thôn, RSX - Rừng sản xuất, CLN - Cây lâu năm, ...)</span>
        `;
        if (uploadLabel) uploadLabel.textContent = '(Quy hoạch)';
        if (aiTargetType) aiTargetType.textContent = 'loại quy hoạch';
    } else {
        descBox.classList.remove('bg-blue-50', 'border-blue-200');
        descBox.classList.add('bg-amber-50', 'border-amber-200');
        descContent.innerHTML = `
            <strong class="text-amber-800">Bản đồ Thổ nhưỡng:</strong>
            <span class="text-amber-700">Phân loại đất theo đặc tính thổ nhưỡng (Đất phèn, Đất mặn, Đất phù sa, Đất cát, ...)</span>
        `;
        if (uploadLabel) uploadLabel.textContent = '(Thổ nhưỡng)';
        if (aiTargetType) aiTargetType.textContent = 'loại đất';
    }
}

function initImageAnalysisTab() {
    console.log('Initializing Image Analysis Tab');

    // Setup dropzone
    const dropzone = document.getElementById('map-image-dropzone');
    const fileInput = document.getElementById('map-image-input');

    if (fileInput && !fileInput.dataset.initialized) {
        fileInput.addEventListener('change', handleMapImageSelect);
        fileInput.dataset.initialized = 'true';
    }

    if (dropzone && !dropzone.dataset.initialized) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('border-primary', 'bg-primary/10');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('border-primary', 'bg-primary/10');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('border-primary', 'bg-primary/10');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleMapImageFile(files[0]);
            }
        });

        dropzone.dataset.initialized = 'true';
    }

    // Setup start button
    const startBtn = document.getElementById('start-analysis-btn');
    if (startBtn && !startBtn.dataset.initialized) {
        startBtn.addEventListener('click', startMultiAIAnalysis);
        startBtn.dataset.initialized = 'true';
    }

    // Initialize result map
    if (!resultMapPreview) {
        const mapContainer = document.getElementById('result-map-preview');
        if (mapContainer && !mapContainer._leaflet_id) {
            resultMapPreview = L.map(mapContainer).setView([9.1, 105.1], 10);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(resultMapPreview);
        }
    }

    // Load analysis history
    loadAnalysisHistory();
}

/**
 * Load analysis history from server
 */
async function loadAnalysisHistory() {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/admin/map-image/analyze/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            // Handle both formats: direct array and {success, history} object
            const historyList = data.history || data || [];
            renderAnalysisHistory(historyList);
        }
    } catch (error) {
        console.log('Could not load analysis history:', error);
    }
}

/**
 * Render analysis history list with comprehensive info
 */
function renderAnalysisHistory(history) {
    const container = document.getElementById('analysis-history-list');
    if (!container) return;

    if (!history || history.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <span class="material-icons-round text-4xl mb-2">history</span>
                <p>Chưa có lịch sử phân tích</p>
                <p class="text-sm mt-2">Tải ảnh bản đồ lên để bắt đầu phân tích AI</p>
            </div>
        `;
        return;
    }

    container.innerHTML = history.map(item => {
        const mapTypeLabel = item.mapType === 'soil' ? 'Thổ nhưỡng' : 'Quy hoạch';
        const mapTypeIcon = item.mapType === 'soil' ? 'landscape' : 'map';
        const mapTypeColor = item.mapType === 'soil' ? 'amber' : 'green';

        // Determine status
        const isPersisted = item.persisted !== false; // Default true for DB entries
        const statusLabel = isPersisted ? (item.status || 'completed') : 'pending';
        const statusIcon = statusLabel === 'completed' ? 'check_circle' :
            statusLabel === 'pending' ? 'pending' : 'error';
        const statusColor = statusLabel === 'completed' ? 'green' :
            statusLabel === 'pending' ? 'yellow' : 'red';

        // Format date
        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            const date = new Date(dateStr);
            return date.toLocaleDateString('vi-VN', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        };

        return `
            <div class="flex items-center justify-between p-4 bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg flex items-center justify-center bg-${mapTypeColor}-100">
                        <span class="material-icons-round text-${mapTypeColor}-600">${mapTypeIcon}</span>
                    </div>
                    <div>
                        <div class="font-medium flex items-center gap-2">
                            Phân tích #${item.analysisId}
                            <span class="material-icons-round text-${statusColor}-500 text-sm">${statusIcon}</span>
                        </div>
                        <div class="text-sm text-gray-500 flex flex-wrap items-center gap-2">
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-${mapTypeColor}-100 text-${mapTypeColor}-700">
                                ${mapTypeLabel}
                            </span>
                            <span>• ${item.zoneCount || 0} vùng</span>
                            ${item.province ? `<span>• ${item.province}</span>` : ''}
                            <span class="text-xs text-gray-400">${formatDate(item.timestamp)}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-1">
                    ${isPersisted && item.zoneCount > 0 ? `
                    <button onclick="viewAnalysisZones('${item.analysisId}')" 
                            class="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Xem trên bản đồ">
                        <span class="material-icons-round">visibility</span>
                    </button>
                    ` : ''}
                    <button onclick="deleteAnalysisHistory('${item.analysisId}')" 
                            class="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Xóa kết quả phân tích và ${item.zoneCount || 0} vùng liên quan">
                        <span class="material-icons-round">delete</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * View zones from a specific analysis on map
 */
async function viewAnalysisZones(analysisId) {
    try {
        const zones = await fetchAPI(`/planning-zones?analysisId=${analysisId}`);
        if (zones && zones.length > 0) {
            // Clear existing and add zones
            planningZonesLayer.clearLayers();
            zones.forEach(zone => addZoneToMap(zone));

            // Fit map to zones
            if (planningZonesLayer.getLayers().length > 0) {
                const bounds = planningZonesLayer.getBounds();
                map.fitBounds(bounds, { padding: [50, 50] });
            }

            switchTab('map');
            showToast('Thành công', `Đang hiển thị ${zones.length} vùng từ phân tích #${analysisId}`, 'success');
        } else {
            showToast('Thông báo', 'Không tìm thấy vùng nào từ phân tích này', 'error');
        }
    } catch (error) {
        console.error('Error loading analysis zones:', error);
        showToast('Lỗi', 'Không thể tải vùng từ phân tích này', 'error');
    }
}

/**
 * Delete analysis from history and associated zones
 */
async function deleteAnalysisHistory(analysisId) {
    if (!confirm(`Xóa kết quả phân tích #${analysisId}?\n\nLưu ý: Tất cả các vùng đất được tạo từ phân tích này cũng sẽ bị xóa.`)) return;

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/admin/map-image/analyze/${analysisId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const result = await response.json();
            const deletedZones = result.deletedZones || 0;
            showToast('Thành công', `Đã xóa phân tích${deletedZones > 0 ? ` và ${deletedZones} vùng liên quan` : ''}`, 'success');
            loadAnalysisHistory();
            // Reload zones on map if any were deleted
            if (deletedZones > 0) {
                await loadPlanningZones();
            }
        } else {
            throw new Error('Không thể xóa');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showToast('Lỗi', 'Không thể xóa kết quả phân tích', 'error');
    }
}

// Export functions
window.deleteAnalysisHistory = deleteAnalysisHistory;
window.viewAnalysisZones = viewAnalysisZones;

function handleMapImageSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleMapImageFile(file);
    }
}

function handleMapImageFile(file) {
    // Validate
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
        showToast('Lỗi', 'Chỉ hỗ trợ file JPG và PNG', 'error');
        return;
    }

    if (file.size > 50 * 1024 * 1024) {
        showToast('Lỗi', 'File quá lớn (tối đa 50MB)', 'error');
        return;
    }

    selectedMapImage = file;

    // Show preview
    const preview = document.getElementById('map-image-preview');
    const thumb = document.getElementById('preview-image-thumb');
    const name = document.getElementById('preview-image-name');
    const size = document.getElementById('preview-image-size');
    const dimensions = document.getElementById('preview-image-dimensions');
    const resizeInfo = document.getElementById('resize-info');

    // Create thumbnail and get image dimensions
    const reader = new FileReader();
    reader.onload = (e) => {
        thumb.src = e.target.result;

        // Get actual image dimensions
        const img = new Image();
        img.onload = () => {
            const w = img.width;
            const h = img.height;
            dimensions.textContent = `Kích thước gốc: ${w} × ${h} px`;

            // Check if resize is needed (max 2000px)
            const maxDim = 2000;
            if (w > maxDim || h > maxDim) {
                const scale = maxDim / Math.max(w, h);
                const newW = Math.round(w * scale);
                const newH = Math.round(h * scale);
                resizeInfo.classList.remove('hidden');
                resizeInfo.innerHTML = `
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                        <span class="material-icons-round" style="font-size:12px">photo_size_select_large</span>
                        Sẽ resize: ${w}×${h} → ${newW}×${newH} px
                    </span>
                `;
            } else {
                resizeInfo.classList.add('hidden');
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    name.textContent = file.name;
    size.textContent = formatFileSize(file.size);
    preview.classList.remove('hidden');

    // Enable start button
    document.getElementById('start-analysis-btn').disabled = false;

    // Hide dropzone
    document.getElementById('map-image-dropzone').classList.add('hidden');
}

function clearMapImage() {
    selectedMapImage = null;
    document.getElementById('map-image-input').value = '';
    document.getElementById('map-image-preview').classList.add('hidden');
    document.getElementById('map-image-dropzone').classList.remove('hidden');
    document.getElementById('start-analysis-btn').disabled = true;
}

async function startMultiAIAnalysis() {
    if (!selectedMapImage) {
        showToast('Lỗi', 'Vui lòng chọn ảnh bản đồ', 'error');
        return;
    }

    const province = document.getElementById('analysis-province').value;
    const district = document.getElementById('analysis-district').value;
    // P2 FIX: Default mapType to 'planning' to match UI default
    const mapType = document.getElementById('selected-map-type')?.value || 'planning';

    console.log('Starting Multi-AI analysis for:', selectedMapImage.name, 'mapType:', mapType);

    // Show progress container
    document.getElementById('analysis-progress-container').classList.remove('hidden');
    document.getElementById('analysis-results-container').classList.add('hidden');

    // Reset progress steps
    resetAnalysisSteps();

    // Clear log
    document.getElementById('analysis-log').innerHTML = '';
    addAnalysisLog('System', `Bắt đầu phân tích Multi-AI (${mapType === 'planning' ? 'Quy hoạch' : 'Thổ nhưỡng'})...`);

    // Disable start button
    document.getElementById('start-analysis-btn').disabled = true;
    document.getElementById('start-analysis-btn').innerHTML = `
        <span class="material-icons-round animate-spin">sync</span>
        Đang phân tích...
    `;

    try {
        // Upload and start analysis
        const formData = new FormData();
        formData.append('image', selectedMapImage);
        formData.append('province', province);
        formData.append('mapType', mapType);
        if (district) formData.append('district', district);

        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/admin/map-image/analyze`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Không thể bắt đầu phân tích');
        }

        currentAnalysisId = data.analysisId;
        addAnalysisLog('System', `Analysis ID: ${currentAnalysisId}`);

        // Connect to SSE for progress updates
        connectToAnalysisProgress(currentAnalysisId);

    } catch (error) {
        console.error('Analysis error:', error);
        showToast('Lỗi', error.message, 'error');
        resetAnalysisUI();
    }
}

function connectToAnalysisProgress(analysisId) {
    addAnalysisLog('System', 'Kết nối SSE để nhận cập nhật...');

    // Close existing connection
    if (analysisEventSource) {
        analysisEventSource.close();
    }

    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    // EventSource doesn't support custom headers, so we pass token as query parameter
    analysisEventSource = new EventSource(
        `${API_BASE_URL}/admin/map-image/analyze/${analysisId}/progress?token=${encodeURIComponent(token)}`
    );

    analysisEventSource.onopen = () => {
        addAnalysisLog('System', 'SSE connected');
    };

    analysisEventSource.addEventListener('connected', (e) => {
        addAnalysisLog('System', 'Đã kết nối, đang chờ kết quả...');
    });

    analysisEventSource.addEventListener('progress', (e) => {
        const data = JSON.parse(e.data);
        updateAnalysisStep(data.step, data.status, data.message);
        addAnalysisLog(data.step.toUpperCase(), data.message);
    });

    analysisEventSource.addEventListener('complete', (e) => {
        const data = JSON.parse(e.data);
        addAnalysisLog('System', 'Phân tích hoàn tất!');
        displayAnalysisResults(data);
        analysisEventSource.close();
    });

    analysisEventSource.onerror = (e) => {
        console.error('SSE error:', e);
        addAnalysisLog('System', 'SSE bị ngắt, chuyển sang polling...');
        // Try polling instead
        pollAnalysisStatus(analysisId);
        analysisEventSource.close();
    };

    // Fallback: poll status after 15 seconds if no results yet
    setTimeout(() => {
        if (!currentAnalysisResult) {
            addAnalysisLog('System', 'SSE không phản hồi, chuyển sang polling...');
            if (analysisEventSource) analysisEventSource.close();
            pollAnalysisStatus(analysisId);
        }
    }, 15000);
}

async function pollAnalysisStatus(analysisId, maxAttempts = 120) {
    addAnalysisLog('System', 'Chuyển sang polling mode...');

    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    let connectionErrors = 0;
    const maxConnectionErrors = 5;

    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(
                `${API_BASE_URL}/admin/map-image/analyze/${analysisId}/status`,
                {
                    headers: { 'Authorization': `Bearer ${token}` },
                    signal: AbortSignal.timeout(10000) // 10 second timeout per request
                }
            );

            // Reset connection error count on successful response
            connectionErrors = 0;

            const data = await response.json();

            if (data.status === 'completed') {
                displayAnalysisResults(data.results);
                return;
            } else if (data.status === 'failed') {
                throw new Error(data.error || 'Phân tích thất bại');
            }

            // Update progress message
            if (data.message) {
                addAnalysisLog('System', data.message);
            }

        } catch (error) {
            console.error('Poll error:', error);

            // Check if it's a connection error
            if (error.name === 'TypeError' || error.message.includes('fetch') || error.message.includes('network')) {
                connectionErrors++;
                addAnalysisLog('System', `Lỗi kết nối (${connectionErrors}/${maxConnectionErrors}), đang thử lại...`);

                if (connectionErrors >= maxConnectionErrors) {
                    showToast('Lỗi', 'Mất kết nối đến server. Vui lòng kiểm tra backend.', 'error');
                    resetAnalysisUI();
                    return;
                }
            }
        }

        await new Promise(r => setTimeout(r, 3000)); // Wait 3s
    }

    showToast('Lỗi', 'Phân tích quá thời gian (6 phút). Vui lòng thử lại với ảnh nhỏ hơn.', 'error');
    resetAnalysisUI();
}

function updateAnalysisStep(step, status, message) {
    const icon = document.getElementById(`step-${step}-icon`);
    const statusEl = document.getElementById(`step-${step}-status`);

    if (!icon || !statusEl) return;

    statusEl.textContent = message;

    if (status === 'running') {
        icon.className = 'w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center';
        icon.innerHTML = '<span class="material-icons-round text-white animate-spin" style="font-size:18px">sync</span>';
    } else if (status === 'completed') {
        icon.className = 'w-8 h-8 rounded-full bg-green-500 flex items-center justify-center';
        icon.innerHTML = '<span class="material-icons-round text-white" style="font-size:18px">check</span>';
    } else if (status === 'warning') {
        icon.className = 'w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center';
        icon.innerHTML = '<span class="material-icons-round text-white" style="font-size:18px">warning</span>';
    } else if (status === 'error') {
        icon.className = 'w-8 h-8 rounded-full bg-red-500 flex items-center justify-center';
        icon.innerHTML = '<span class="material-icons-round text-white" style="font-size:18px">error</span>';
    }
}

/**
 * Reset analysis steps UI for Hybrid mode (3 main steps)
 */
function resetAnalysisSteps() {
    // Reset main step containers
    ['step1', 'step2', 'step3'].forEach((step, idx) => {
        const container = document.getElementById(`${step}-container`);
        if (container) {
            container.classList.remove('border-green-500', 'border-red-500', 'border-blue-500', 'bg-green-50', 'bg-red-50', 'bg-blue-50');
            container.classList.add('opacity-50');
        }
    });

    // Reset main step statuses
    const mainSteps = ['step1_coords', 'step2_opencv', 'step3_labels'];
    mainSteps.forEach(step => {
        const status = document.getElementById(`step-${step}-status`);
        if (status) status.textContent = 'Đang chờ...';
    });

    // Reset substeps
    const subSteps = ['gemini', 'gpt4o_coords', 'fallback'];
    subSteps.forEach(step => {
        const icon = document.getElementById(`step-${step}-icon`);
        const status = document.getElementById(`step-${step}-status`);
        if (icon) {
            icon.className = 'w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center';
            icon.innerHTML = '<span class="material-icons-round text-gray-400" style="font-size:14px">hourglass_empty</span>';
        }
        if (status) status.textContent = '—';
    });

    // Hide GPT-4o fallback substep initially
    const gpt4oSubstep = document.getElementById('gpt4o-coords-substep');
    if (gpt4oSubstep) gpt4oSubstep.classList.add('hidden');

    // Hide AI usage summary
    document.getElementById('ai-usage-summary')?.classList.add('hidden');

    // Make step 1 active
    const step1 = document.getElementById('step1-container');
    if (step1) {
        step1.classList.remove('opacity-50');
        step1.classList.add('border-blue-500', 'bg-blue-50');
    }
}

/**
 * Update analysis step with enhanced UI for Hybrid mode
 */
function updateAnalysisStep(step, status, message) {
    console.log(`[UI] Step: ${step}, Status: ${status}, Message: ${message}`);

    // Map step names to UI elements
    const stepMappings = {
        'step1_coords': { container: 'step1-container', mainStep: true },
        'step2_opencv': { container: 'step2-container', mainStep: true },
        'step3_labels': { container: 'step3-container', mainStep: true },
        'gemini': { substep: true, parent: 'step1' },
        'gpt4o_coords': { substep: true, parent: 'step1' },
        'fallback': { substep: true, parent: 'step1' },
        'legend': { substep: true, parent: 'step2' }
    };

    const mapping = stepMappings[step];

    // Handle main steps
    if (mapping?.mainStep) {
        const container = document.getElementById(mapping.container);
        const statusEl = document.getElementById(`step-${step}-status`);

        if (container) {
            container.classList.remove('opacity-50', 'border-gray-200', 'border-blue-500', 'border-green-500', 'border-yellow-500', 'border-red-500');
            container.classList.remove('bg-blue-50', 'bg-green-50', 'bg-yellow-50', 'bg-red-50');

            if (status === 'running') {
                container.classList.add('border-blue-500', 'bg-blue-50');
            } else if (status === 'completed') {
                container.classList.add('border-green-500', 'bg-green-50');
                // Activate next step
                const nextStep = step === 'step1_coords' ? 'step2' : step === 'step2_opencv' ? 'step3' : null;
                if (nextStep) {
                    const nextContainer = document.getElementById(`${nextStep}-container`);
                    if (nextContainer) {
                        nextContainer.classList.remove('opacity-50');
                        nextContainer.classList.add('border-blue-500', 'bg-blue-50');
                    }
                }
            } else if (status === 'warning') {
                container.classList.add('border-yellow-500', 'bg-yellow-50');
            } else if (status === 'error' || status === 'failed') {
                container.classList.add('border-red-500', 'bg-red-50');
            }
        }

        if (statusEl) statusEl.textContent = message;
    }

    // Handle substeps (Gemini, GPT-4o fallback, etc.)
    const icon = document.getElementById(`step-${step}-icon`);
    const statusEl = document.getElementById(`step-${step}-status`);

    if (icon) {
        icon.classList.remove('bg-gray-200', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500');

        if (status === 'running') {
            icon.className = 'w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center';
            icon.innerHTML = '<span class="material-icons-round text-white animate-spin" style="font-size:14px">sync</span>';
        } else if (status === 'completed') {
            icon.className = 'w-6 h-6 rounded-full bg-green-500 flex items-center justify-center';
            icon.innerHTML = '<span class="material-icons-round text-white" style="font-size:14px">check</span>';
        } else if (status === 'warning') {
            icon.className = 'w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center';
            icon.innerHTML = '<span class="material-icons-round text-white" style="font-size:14px">warning</span>';
        } else if (status === 'error') {
            icon.className = 'w-6 h-6 rounded-full bg-red-500 flex items-center justify-center';
            icon.innerHTML = '<span class="material-icons-round text-white" style="font-size:14px">close</span>';
        } else if (status === 'skipped') {
            icon.className = 'w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center';
            icon.innerHTML = '<span class="material-icons-round text-white" style="font-size:14px">skip_next</span>';
        }
    }

    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = status === 'error' ? 'text-red-500' :
            status === 'completed' ? 'text-green-600' :
                status === 'warning' ? 'text-yellow-600' : 'text-gray-400';
    }

    // Show GPT-4o fallback substep when needed
    if (step === 'fallback' || step === 'gpt4o_coords') {
        const gpt4oSubstep = document.getElementById('gpt4o-coords-substep');
        if (gpt4oSubstep) gpt4oSubstep.classList.remove('hidden');
    }
}

function addAnalysisLog(source, message) {
    const logContainer = document.getElementById('analysis-log');
    const time = new Date().toLocaleTimeString('vi-VN');

    // Enhanced color mapping
    const colorClass = {
        'GEMINI': 'text-purple-400',
        'OPENCV': 'text-green-400',
        'GPT4O': 'text-blue-400',
        'GPT4O_COORDS': 'text-blue-300',
        'STEP1_COORDS': 'text-purple-300',
        'STEP2_OPENCV': 'text-green-300',
        'STEP3_LABELS': 'text-amber-300',
        'FALLBACK': 'text-yellow-400',
        'LEGEND': 'text-cyan-400',
        'SYSTEM': 'text-gray-400',
        'ERROR': 'text-red-400'
    }[source.toUpperCase()] || 'text-green-400';

    // Icon mapping
    const icons = {
        'GEMINI': '🌟',
        'OPENCV': '🔷',
        'GPT4O': '🤖',
        'SYSTEM': '⚙️',
        'ERROR': '❌',
        'FALLBACK': '🔄'
    };
    const icon = icons[source.toUpperCase()] || '📋';

    logContainer.innerHTML += `<div class="py-0.5"><span class="text-gray-500">[${time}]</span> ${icon} <span class="${colorClass}">[${source}]</span> ${message}</div>`;
    logContainer.scrollTop = logContainer.scrollHeight;
}

function toggleAnalysisLog() {
    const log = document.getElementById('analysis-log');
    const chevron = document.getElementById('log-chevron');
    log.classList.toggle('hidden');
    if (chevron) {
        chevron.style.transform = log.classList.contains('hidden') ? '' : 'rotate(180deg)';
    }
}

/**
 * Display AI usage summary
 */
function displayAIUsageSummary(aiUsage) {
    const container = document.getElementById('ai-usage-summary');
    const details = document.getElementById('ai-usage-details');

    if (!aiUsage || !container || !details) return;

    const usageText = [];
    if (aiUsage.coordinates) usageText.push(`Tọa độ: ${aiUsage.coordinates.toUpperCase()}`);
    if (aiUsage.polygons) usageText.push(`Polygon: ${aiUsage.polygons.toUpperCase()}`);
    if (aiUsage.labeling) usageText.push(`Gán nhãn: ${aiUsage.labeling.toUpperCase()}`);

    details.textContent = usageText.join(' • ');
    container.classList.remove('hidden');
}

/**
 * Display image processing info (Smart Resize)
 */
function displayProcessingInfo(results) {
    const container = document.getElementById('processing-info');
    const details = document.getElementById('processing-details');

    if (!container || !details) return;

    // Get resize and size info
    const resizeInfo = results.resizeInfo || {};
    const originalSize = results.originalSize || {};
    const processedSize = results.processedSize || results.imageSize || {};
    const wasResized = resizeInfo.resized || false;

    // Build info HTML
    let html = '';

    if (originalSize.width && originalSize.height) {
        html += `
            <div>
                <span class="text-gray-500">Kích thước gốc:</span>
                <span class="font-medium">${originalSize.width} × ${originalSize.height} px</span>
            </div>
        `;
    }

    if (wasResized && processedSize.width && processedSize.height) {
        html += `
            <div>
                <span class="text-gray-500">Sau resize:</span>
                <span class="font-medium text-blue-600">${processedSize.width} × ${processedSize.height} px</span>
            </div>
            <div>
                <span class="text-gray-500">Tỷ lệ:</span>
                <span class="font-medium">${(resizeInfo.scale_factor || 1).toFixed(2)}</span>
            </div>
            <div>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                    <span class="material-icons-round" style="font-size:12px">bolt</span>
                    Đã tối ưu
                </span>
            </div>
        `;
    } else if (processedSize.width && processedSize.height) {
        html += `
            <div>
                <span class="text-gray-500">Kích thước xử lý:</span>
                <span class="font-medium">${processedSize.width} × ${processedSize.height} px</span>
            </div>
            <div>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                    Không cần resize
                </span>
            </div>
        `;
    }

    if (html) {
        details.innerHTML = html;
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}

function displayAnalysisResults(results) {
    console.log('Displaying results:', results);
    currentAnalysisResult = results;

    // Show AI usage summary if available
    if (results.aiUsage) {
        displayAIUsageSummary(results.aiUsage);
    }

    // Display image processing info (Smart Resize)
    displayProcessingInfo(results);

    // Update spinner to complete
    const spinner = document.getElementById('analysis-spinner');
    const title = document.getElementById('analysis-title');
    if (spinner) {
        spinner.classList.remove('animate-spin');
        spinner.textContent = 'check_circle';
        spinner.classList.remove('text-blue-600');
        spinner.classList.add('text-green-600');
    }
    if (title) title.textContent = 'Phân tích hoàn tất!';

    // Short delay to show completion state
    setTimeout(() => {
        // Hide progress, show results
        document.getElementById('analysis-progress-container').classList.add('hidden');
        document.getElementById('analysis-results-container').classList.remove('hidden');

        // Reset start button
        document.getElementById('start-analysis-btn').disabled = false;
        document.getElementById('start-analysis-btn').innerHTML = `
            <span class="material-icons-round">auto_awesome</span>
            Phân tích bằng AI (Hybrid Mode)
        `;
    }, 1500);

    // Display coordinates
    const coordsInfo = document.getElementById('coordinates-info');
    const coords = results.coordinates || {};

    // Support both sw/ne and topLeft/bottomRight formats
    const sw = coords.sw || coords.topLeft || {};
    const ne = coords.ne || coords.bottomRight || {};
    const center = coords.center || {};

    coordsInfo.innerHTML = `
        <div>
            <span class="text-gray-500">Tâm bản đồ:</span>
            <span class="font-medium">${center.lat?.toFixed(4) || 'N/A'}, ${center.lng?.toFixed(4) || 'N/A'}</span>
        </div>
        <div>
            <span class="text-gray-500">Tỉ lệ:</span>
            <span class="font-medium">${coords.scale || 'N/A'}</span>
        </div>
        <div>
            <span class="text-gray-500">Góc Tây-Nam:</span>
            <span class="font-medium">${sw.lat?.toFixed(4) || 'N/A'}, ${sw.lng?.toFixed(4) || 'N/A'}</span>
        </div>
        <div>
            <span class="text-gray-500">Góc Đông-Bắc:</span>
            <span class="font-medium">${ne.lat?.toFixed(4) || 'N/A'}, ${ne.lng?.toFixed(4) || 'N/A'}</span>
        </div>
        ${coords.confidence ? `<div class="col-span-2"><span class="text-gray-500">Độ tin cậy:</span> <span class="font-medium text-${coords.confidence === 'high' ? 'green' : coords.confidence === 'medium' ? 'yellow' : 'red'}-600">${coords.confidence.toUpperCase()}</span></div>` : ''}
    `;

    // Clear existing layers on map
    if (resultMapPreview) {
        resultMapPreview.eachLayer(layer => {
            if (layer instanceof L.Rectangle || layer instanceof L.Polygon || layer instanceof L.Circle) {
                resultMapPreview.removeLayer(layer);
            }
        });
    }

    // Update map preview
    if (resultMapPreview && center.lat && center.lng) {
        resultMapPreview.setView([center.lat, center.lng], 10);

        // Add bounding box with dashed line
        if (sw.lat && ne.lat) {
            L.rectangle([
                [sw.lat, sw.lng],
                [ne.lat, ne.lng]
            ], {
                color: '#333333',
                weight: 2,
                dashArray: '5, 5',
                fillOpacity: 0.05,
                fillColor: '#8B5CF6'
            }).addTo(resultMapPreview);
        }

        // Display zones on map with black borders
        const zones = results.zones || [];
        zones.forEach((zone, idx) => {
            // Try to parse boundary coordinates if available
            let boundaries = zone.boundaryCoordinates;
            if (typeof boundaries === 'string') {
                try {
                    boundaries = JSON.parse(boundaries);
                } catch (e) {
                    boundaries = null;
                }
            }

            if (boundaries && Array.isArray(boundaries) && boundaries.length >= 3) {
                // Draw polygon from boundaries
                L.polygon(boundaries, {
                    color: '#333333',           // Black border
                    weight: 2,                  // Border thickness
                    fillColor: zone.fillColor || zone.color || '#808080',
                    fillOpacity: 0.5,
                    className: `zone-${idx}`
                }).bindPopup(`
                    <b>${zone.name || 'Vùng ' + (idx + 1)}</b><br>
                    Loại đất: ${zone.soilType || zone.zoneType || 'N/A'}<br>
                    Mã: ${zone.zoneCode || 'N/A'}<br>
                    Diện tích: ${zone.areaPercent ? zone.areaPercent + '%' : 'N/A'}
                `).addTo(resultMapPreview);
            } else if (coords.center) {
                // Create approximate zones as circles if no boundaries
                const offsetLat = (Math.random() - 0.5) * 0.1;
                const offsetLng = (Math.random() - 0.5) * 0.1;
                const radius = (zone.areaPercent || 5) * 500; // Rough radius estimate

                L.circle([coords.center.lat + offsetLat, coords.center.lng + offsetLng], {
                    radius: radius,
                    color: '#333333',           // Black border
                    weight: 2,
                    fillColor: zone.fillColor || zone.color || '#808080',
                    fillOpacity: 0.5
                }).bindPopup(`
                    <b>${zone.name || 'Vùng ' + (idx + 1)}</b><br>
                    Loại đất: ${zone.soilType || zone.zoneType || 'N/A'}<br>
                    Mã: ${zone.zoneCode || 'N/A'}<br>
                    Diện tích: ${zone.areaPercent ? zone.areaPercent + '%' : 'N/A'}
                `).addTo(resultMapPreview);
            }
        });
    }

    // Display zones summary by soil type
    const zones = results.zones || [];
    const typeCount = {};
    const typeColors = {};
    zones.forEach(z => {
        const type = z.soilType || z.zoneType || 'Unknown';
        typeCount[type] = (typeCount[type] || 0) + 1;
        if (!typeColors[type]) typeColors[type] = z.fillColor || z.color || '#808080';
    });

    const summaryContainer = document.getElementById('zones-summary');
    summaryContainer.innerHTML = Object.entries(typeCount).slice(0, 8).map(([type, count]) => `
        <div class="bg-gray-50 p-3 rounded-lg border-l-4" style="border-left-color: ${typeColors[type]}">
            <div class="text-2xl font-bold text-primary">${count}</div>
            <div class="text-sm text-gray-600 truncate" title="${type}">${type}</div>
        </div>
    `).join('');

    // Display zones list with color indicator and border
    document.getElementById('total-zones-count').textContent = zones.length;
    const zonesList = document.getElementById('detected-zones-list');
    zonesList.innerHTML = zones.map((zone, idx) => `
        <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors cursor-pointer" 
             onclick="highlightZoneOnMap(${idx})"
             title="Click để highlight trên bản đồ">
            <div class="w-8 h-8 rounded border-2 border-gray-800" style="background-color: ${zone.fillColor || zone.color || '#ccc'}"></div>
            <div class="flex-1 min-w-0">
                <div class="font-medium truncate">${zone.name || `Vùng ${idx + 1}`}</div>
                <div class="text-sm text-gray-500">${zone.soilType || zone.zoneType || 'N/A'}</div>
                <div class="text-xs text-gray-400">${zone.zoneCode ? `Mã: ${zone.zoneCode}` : ''}</div>
            </div>
            <div class="text-right">
                <div class="text-sm font-medium text-gray-700">${zone.areaPercent ? zone.areaPercent + '%' : ''}</div>
                <div class="text-xs text-gray-400">${zone.areaPercent ? '~' + Math.round(zone.areaPercent * 100) + ' ha' : ''}</div>
            </div>
        </div>
    `).join('');

    // Show color mapping legend
    const colorMapping = results.colorMapping || {};
    if (Object.keys(colorMapping).length > 0) {
        const legendHtml = Object.entries(colorMapping).map(([color, info]) => `
            <div class="flex items-center gap-2 text-sm">
                <div class="w-4 h-4 rounded border border-gray-800" style="background-color: ${color}"></div>
                <span>${info.name || 'Unknown'}</span>
                <span class="text-gray-400">(${info.count || 0})</span>
            </div>
        `).join('');

        // Add legend after zones summary
        const existingLegend = document.getElementById('color-legend');
        if (existingLegend) {
            existingLegend.innerHTML = legendHtml;
        }
    }

    showToast('Thành công', `Đã phân tích ${zones.length} vùng`, 'success');
}

// Helper function to highlight zone on map
function highlightZoneOnMap(zoneIndex) {
    if (!resultMapPreview || !currentAnalysisResult?.zones) return;

    const zone = currentAnalysisResult.zones[zoneIndex];
    if (!zone) return;

    // Flash effect on the zone
    resultMapPreview.eachLayer(layer => {
        if (layer.options?.className === `zone-${zoneIndex}`) {
            const originalColor = layer.options.fillColor;
            layer.setStyle({ fillColor: '#FFFF00', fillOpacity: 0.8 });
            setTimeout(() => {
                layer.setStyle({ fillColor: originalColor, fillOpacity: 0.5 });
            }, 500);
        }
    });
}

function resetAnalysisUI() {
    document.getElementById('analysis-progress-container').classList.add('hidden');
    document.getElementById('start-analysis-btn').disabled = false;
    document.getElementById('start-analysis-btn').innerHTML = `
        <span class="material-icons-round">auto_awesome</span>
        Bắt đầu Phân tích Multi-AI
    `;
}

async function confirmAndSaveAnalysis() {
    if (!currentAnalysisId || !currentAnalysisResult) {
        showToast('Lỗi', 'Không có kết quả để lưu', 'error');
        return;
    }

    const mapType = document.querySelector('input[name="result-map-type"]:checked')?.value || 'planning';

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(
            `${API_BASE_URL}/admin/map-image/analyze/${currentAnalysisId}/confirm`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ mapType })
            }
        );

        const data = await response.json();

        if (data.success) {
            showToast('Thành công', data.message, 'success');
            discardAnalysis();
            await loadPlanningZones();
            setTimeout(() => switchTab('map'), 1000);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Save error:', error);
        showToast('Lỗi', error.message, 'error');
    }
}

function discardAnalysis() {
    if (currentAnalysisId) {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        fetch(`${API_BASE_URL}/admin/map-image/analyze/${currentAnalysisId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        }).catch(e => console.log('Discard cleanup:', e));
    }

    currentAnalysisId = null;
    currentAnalysisResult = null;
    clearMapImage();
    document.getElementById('analysis-results-container').classList.add('hidden');

    // Clear map layers
    if (resultMapPreview) {
        resultMapPreview.eachLayer(layer => {
            if (layer instanceof L.Rectangle || layer instanceof L.Polygon) {
                resultMapPreview.removeLayer(layer);
            }
        });
    }
}

// Export functions
window.clearMapImage = clearMapImage;
window.toggleAnalysisLog = toggleAnalysisLog;
window.discardAnalysis = discardAnalysis;
window.confirmAndSaveAnalysis = confirmAndSaveAnalysis;
window.highlightZoneOnMap = highlightZoneOnMap;
