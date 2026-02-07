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
        'image-analysis': 'Phân tích Bản đồ Chuyên sâu',
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

    // Ensure edit/delete buttons are visible for planning zones
    const editBtn = document.getElementById('zone-edit-btn');
    const deleteBtn = document.getElementById('zone-delete-btn');
    if (editBtn) editBtn.style.display = '';
    if (deleteBtn) deleteBtn.style.display = '';

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
let landParcelsWmsLayer = null;
let landParcelsLocalLayer = null;
let landParcelsActive = false;

// GeoServer WMS/WFS endpoints for land parcels
const GEOSERVER_WMS_URL = 'https://ilis-sdk.vnpt.vn/map/geoserver/iLIS_CMU/wms';
const GEOSERVER_WFS_URL = 'https://ilis-sdk.vnpt.vn/map/geoserver/iLIS_CMU/wfs';
const LAND_PARCEL_LAYER = 'iLIS_CMU:cmu_thuadat_huyenthoibinh';

// Land use color mapping
const LAND_USE_COLORS = {
    'LUK': '#FFD700',     // Đất trồng lúa nước còn lại - Vàng gold
    'LUC': '#FFC107',     // Đất trồng lúa nước - Vàng amber
    'ONT': '#FF6B6B',     // Đất ở nông thôn - Đỏ nhạt
    'CLN': '#4CAF50',     // Đất trồng cây lâu năm - Xanh lá
    'NTS': '#2196F3',     // Đất nuôi trồng thủy sản - Xanh nước biển
    'BHK': '#8BC34A',     // Đất bằng chưa sử dụng - Xanh lá nhạt
    'DGT': '#9E9E9E',     // Đất giao thông - Xám
    'DTL': '#00BCD4',     // Đất thủy lợi - Cyan
    'TMD': '#E91E63',     // Đất thương mại dịch vụ - Hồng
    'SKC': '#FF5722',     // Đất sản xuất kinh doanh - Cam đỏ
    'ODT': '#F44336',     // Đất ở đô thị - Đỏ
    'CQP': '#795548',     // Đất quốc phòng - Nâu
    'TSC': '#607D8B',     // Đất cơ sở tín ngưỡng - Xám xanh
    'DHT': '#3F51B5',     // Đất hạ tầng - Xanh dương đậm
    'DYT': '#E91E63',     // Đất y tế - Hồng
    'DGD': '#FF9800',     // Đất giáo dục - Cam
    'TIN': '#9C27B0',     // Đất tôn giáo - Tím
    'NTD': '#CDDC39',     // Đất nông trại - Vàng xanh
    'RSX': '#388E3C',     // Đất rừng sản xuất - Xanh đậm
    'RPH': '#1B5E20',     // Đất rừng phòng hộ - Xanh rất đậm
    'RDD': '#2E7D32',     // Đất rừng đặc dụng - Xanh lá đậm
    'HNK': '#A1887F',     // Đất trồng cây hàng năm khác - Nâu nhạt
    'MNC': '#81C784',     // Đất mặt nước chuyên dùng - Xanh lá nhạt
    'SON': '#B0BEC5',     // Đất sông ngòi - Xám bạc
    'ONT+CLN': '#E8A838', // Đất ở + cây lâu năm - Cam vàng
    'default': '#90A4AE'  // Mặc định - Xám xanh
};

function getLandUseColor(code) {
    if (!code) return LAND_USE_COLORS['default'];
    const upper = code.toUpperCase().trim();
    return LAND_USE_COLORS[upper] || LAND_USE_COLORS['default'];
}

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

                if (mapType === 'land-parcels') {
                    // Hide planning zones, show land parcels
                    planningZonesLayer.clearLayers();
                    activateLandParcelsLayer();

                    // Update legend
                    loadLandParcelLegend();

                    // Update legend header
                    const legendHeader = document.querySelector('.legend-header');
                    if (legendHeader) {
                        legendHeader.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
                        legendHeader.querySelector('span:nth-child(2)').textContent = 'Chú giải Thửa đất';
                    }

                    showToast('Lớp Thửa đất', 'Hiển thị 129,000+ thửa đất Huyện Thới Bình (WMS)', 'success');
                } else {
                    // Remove land parcels layers
                    deactivateLandParcelsLayer();

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
                }
            });
        });
    }, 500);
});

// ============ LAND PARCELS LAYER (Hybrid: WMS Tiles + WFS Click) ============

/**
 * Activate land parcels using WMS tile overlay from GeoServer
 * This renders ALL 129,000+ parcels directly from the server (complete coverage)
 * On click, uses WFS GetFeatureInfo to show parcel details
 */
function activateLandParcelsLayer() {
    // Pan to Thới Bình if not already in view
    const center = map.getCenter();
    if (center.lat < 9.0 || center.lat > 9.6 || center.lng < 104.8 || center.lng > 105.5) {
        map.setView([9.30, 105.15], 13);
    }

    // Add WMS tile layer from GeoServer (renders ALL parcels with server-side styling)
    if (!landParcelsWmsLayer) {
        landParcelsWmsLayer = L.tileLayer.wms(GEOSERVER_WMS_URL, {
            layers: LAND_PARCEL_LAYER,
            format: 'image/png',
            transparent: true,
            version: '1.1.1',
            srs: 'EPSG:4326',
            opacity: 0.85,
            maxZoom: 22,
            attribution: '© ilis.camau.gov.vn'
        });
    }
    landParcelsWmsLayer.addTo(map);
    landParcelsActive = true;

    // Also load local DB parcels overlay (for hover tooltips at high zoom)
    loadLocalParcelsOverlay();

    // Setup click handler for WFS GetFeatureInfo
    map.on('click', onMapClickGetParcelInfo);

    // Update stats with total from API
    updateLandParcelStats();
}

function deactivateLandParcelsLayer() {
    if (landParcelsWmsLayer) {
        map.removeLayer(landParcelsWmsLayer);
    }
    if (landParcelsLocalLayer) {
        map.removeLayer(landParcelsLocalLayer);
        landParcelsLocalLayer = null;
    }
    landParcelsActive = false;
    map.off('click', onMapClickGetParcelInfo);
    map.off('moveend', onMapMoveLoadLocalParcels);
}

/**
 * On map click: query GeoServer WFS GetFeatureInfo for clicked parcel
 * This works even for parcels NOT in our local DB
 */
async function onMapClickGetParcelInfo(e) {
    if (!landParcelsActive) return;

    const latlng = e.latlng;
    const mapSize = map.getSize();
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    // Convert click position to pixel coordinates
    const point = map.latLngToContainerPoint(latlng);

    // Build WMS GetFeatureInfo URL
    const bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
    const url = `${GEOSERVER_WMS_URL}?` +
        `SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo` +
        `&LAYERS=${LAND_PARCEL_LAYER}` +
        `&QUERY_LAYERS=${LAND_PARCEL_LAYER}` +
        `&SRS=EPSG:4326` +
        `&BBOX=${bbox}` +
        `&WIDTH=${mapSize.x}` +
        `&HEIGHT=${mapSize.y}` +
        `&X=${Math.round(point.x)}` +
        `&Y=${Math.round(point.y)}` +
        `&INFO_FORMAT=application/json` +
        `&FEATURE_COUNT=1`;

    try {
        const response = await fetch(url);
        if (!response.ok) return;

        const data = await response.json();
        const features = data.features || [];

        if (features.length === 0) return;

        const f = features[0];
        const props = f.properties || {};

        // Map WFS properties to our display format
        const parcelInfo = {
            mapSheetNumber: props.tobandoso,
            parcelNumber: props.sothututhua,
            areaSqm: props.dientich,
            legalAreaSqm: props.dientichpl,
            landUseCode: props.loaidat,
            landUseName: lookupLandUseName(props.loaidat),
            address: props.diachithua,
            adminUnitName: props.tendvhc,
            adminUnitCode: props.madvhc,
            district: 'Thới Bình'
        };

        showLandParcelInfo(parcelInfo);
    } catch (error) {
        console.error('GetFeatureInfo error:', error);
    }
}

/**
 * Load local DB parcels as semi-transparent overlay at high zoom levels
 * for hover tooltips (WMS tiles don't support hover)
 */
async function loadLocalParcelsOverlay() {
    const zoom = map.getZoom();
    // Only load local overlay at zoom >= 14 for hover tooltips
    if (zoom < 14) {
        if (landParcelsLocalLayer) {
            map.removeLayer(landParcelsLocalLayer);
            landParcelsLocalLayer = null;
        }
        document.getElementById('zones-count').textContent = 'WMS';
        map.off('moveend', onMapMoveLoadLocalParcels);
        map.on('moveend', onMapMoveLoadLocalParcels);
        return;
    }

    try {
        const bounds = map.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();

        const parcels = await fetchAPI(
            `/land-parcels/bounds?swLat=${sw.lat}&swLng=${sw.lng}&neLat=${ne.lat}&neLng=${ne.lng}`
        );

        renderLocalParcelsOverlay(parcels || []);
    } catch (error) {
        console.error('Error loading local parcels overlay:', error);
    }

    map.off('moveend', onMapMoveLoadLocalParcels);
    map.on('moveend', onMapMoveLoadLocalParcels);
}

function renderLocalParcelsOverlay(parcels) {
    if (landParcelsLocalLayer) {
        map.removeLayer(landParcelsLocalLayer);
    }

    const geojsonFeatures = [];
    parcels.forEach(parcel => {
        if (!parcel.boundaryGeojson) return;
        try {
            const geometry = typeof parcel.boundaryGeojson === 'string'
                ? JSON.parse(parcel.boundaryGeojson)
                : parcel.boundaryGeojson;
            geojsonFeatures.push({
                type: 'Feature',
                geometry: geometry,
                properties: {
                    parcelNumber: parcel.parcelNumber,
                    mapSheetNumber: parcel.mapSheetNumber,
                    landUseCode: parcel.landUseCode,
                    landUseName: parcel.landUseName,
                    areaSqm: parcel.areaSqm,
                    legalAreaSqm: parcel.legalAreaSqm,
                    address: parcel.address,
                    adminUnitName: parcel.adminUnitName,
                    district: parcel.district
                }
            });
        } catch (e) { /* skip */ }
    });

    if (geojsonFeatures.length === 0) return;

    landParcelsLocalLayer = L.geoJSON({
        type: 'FeatureCollection',
        features: geojsonFeatures
    }, {
        style: {
            fillOpacity: 0,     // Transparent fill (WMS handles rendering)
            color: 'transparent',
            weight: 0
        },
        onEachFeature: function (feature, layer) {
            const p = feature.properties;
            const area = p.areaSqm ? (p.areaSqm / 10000).toFixed(4) : '—';
            layer.bindTooltip(
                `<b>Thửa ${p.parcelNumber || '—'}</b> | Tờ BĐ: ${p.mapSheetNumber || '—'}<br>` +
                `${p.landUseName || p.landUseCode || 'Chưa phân loại'} | ${area} ha`,
                { className: 'land-parcel-tooltip', sticky: true }
            );
        },
        coordsToLatLng: function (coords) {
            return L.latLng(coords[1], coords[0]);
        }
    });

    landParcelsLocalLayer.addTo(map);
    document.getElementById('zones-count').textContent = `${geojsonFeatures.length} (local)`;
}

async function onMapMoveLoadLocalParcels() {
    if (currentMapType !== 'land-parcels' || !landParcelsActive) {
        map.off('moveend', onMapMoveLoadLocalParcels);
        return;
    }
    clearTimeout(window._parcelLoadTimeout);
    window._parcelLoadTimeout = setTimeout(() => loadLocalParcelsOverlay(), 400);
}

async function updateLandParcelStats() {
    try {
        const stats = await fetchAPI('/land-parcels/stats?district=Th%E1%BB%9Bi%20B%C3%ACnh');
        if (stats) {
            document.getElementById('zones-count').textContent =
                `${stats.totalParcels.toLocaleString()} (DB) + WMS`;
        }
    } catch (e) {
        document.getElementById('zones-count').textContent = 'WMS';
    }
}

// Lookup land use name from code (client-side for WFS GetFeatureInfo results)
const LAND_USE_NAME_MAP = {
    'LUC': 'Đất chuyên trồng lúa nước',
    'LUK': 'Đất trồng lúa nước còn lại',
    'CLN': 'Đất trồng cây lâu năm',
    'RSX': 'Đất rừng sản xuất',
    'RPH': 'Đất rừng phòng hộ',
    'RDD': 'Đất rừng đặc dụng',
    'NTS': 'Đất nuôi trồng thủy sản',
    'ONT': 'Đất ở nông thôn',
    'ODT': 'Đất ở đô thị',
    'DGT': 'Đất giao thông',
    'DTL': 'Đất thủy lợi',
    'TMD': 'Đất thương mại dịch vụ',
    'SKC': 'Đất cụm khu công nghiệp',
    'BHK': 'Đất bằng trồng cây hàng năm khác',
    'HNK': 'Đất nương rẫy',
    'TSC': 'Đất trụ sở cơ quan',
    'DGD': 'Đất cơ sở giáo dục đào tạo',
    'DYT': 'Đất cơ sở y tế',
    'TIN': 'Đất tôn giáo',
    'CQP': 'Đất quốc phòng',
    'DNL': 'Đất công trình năng lượng',
    'SON': 'Đất mặt nước sông ngòi, kênh rạch',
    'MNC': 'Đất mặt nước chuyên dùng',
    'NTD': 'Đất cơ sở nghĩa trang, nhà tang lễ',
    'ONT+CLN': 'Đất ở + Cây lâu năm',
    'CLN+LUK': 'Đất cây lâu năm + Lúa',
    'NTS+CLN': 'Đất thủy sản + Cây lâu năm',
    'LUK+NTS': 'Đất lúa + Thủy sản',
    'ONT+NTS': 'Đất ở + Thủy sản',
};

function lookupLandUseName(code) {
    if (!code) return 'Chưa phân loại';
    const c = code.trim();
    if (LAND_USE_NAME_MAP[c]) return LAND_USE_NAME_MAP[c];
    // Try splitting compound codes
    const parts = c.replace('+', ',').split(',');
    const names = parts.map(p => LAND_USE_NAME_MAP[p.trim()] || p.trim());
    return names.join(' + ');
}

function showLandParcelInfo(props) {
    const panel = document.getElementById('zone-info-panel');
    const content = document.getElementById('zone-info-content');
    const title = document.getElementById('zone-info-title');

    title.textContent = `Thửa đất số ${props.parcelNumber || '—'}`;

    const area = props.areaSqm ? (props.areaSqm / 10000).toFixed(4) : '—';
    const legalArea = props.legalAreaSqm ? (props.legalAreaSqm / 10000).toFixed(4) : '—';
    const colorBox = `<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${getLandUseColor(props.landUseCode)};margin-right:6px;vertical-align:middle;border:1px solid #999"></span>`;

    content.innerHTML = `
        <div class="zone-info-grid" style="display:grid;grid-template-columns:auto 1fr;gap:8px 12px;font-size:14px;">
            <span style="color:#6b7280;font-weight:500">Tờ bản đồ số:</span>
            <span style="font-weight:600">${props.mapSheetNumber || '—'}</span>

            <span style="color:#6b7280;font-weight:500">Thửa số:</span>
            <span style="font-weight:600">${props.parcelNumber || '—'}</span>

            <span style="color:#6b7280;font-weight:500">Diện tích:</span>
            <span style="font-weight:600">${area} ha <span style="color:#9ca3af;font-size:12px">(${props.areaSqm ? Math.round(props.areaSqm) : '—'} m²)</span></span>

            <span style="color:#6b7280;font-weight:500">Diện tích pháp lý:</span>
            <span style="font-weight:600">${legalArea} ha</span>

            <span style="color:#6b7280;font-weight:500">Mục đích sử dụng:</span>
            <span style="font-weight:600">${colorBox}${props.landUseName || 'Chưa phân loại'} <span style="color:#3b82f6;font-size:12px">(${props.landUseCode || '—'})</span></span>

            <span style="color:#6b7280;font-weight:500">Địa chỉ:</span>
            <span>${props.address || '—'}</span>

            <span style="color:#6b7280;font-weight:500">Xã/Thị trấn:</span>
            <span>${props.adminUnitName || '—'}</span>

            <span style="color:#6b7280;font-weight:500">Huyện:</span>
            <span>${props.district || 'Thới Bình'}</span>

            <span style="color:#6b7280;font-weight:500">Tỉnh:</span>
            <span>Cà Mau</span>
        </div>
        <div style="margin-top:12px;padding:8px 12px;background:#f0f9ff;border-radius:8px;font-size:12px;color:#3b82f6">
            <span class="material-icons-round" style="font-size:14px;vertical-align:middle">info</span>
            Nguồn: ilis.camau.gov.vn — Hệ thống thông tin đất đai tỉnh Cà Mau
        </div>
    `;

    // Hide edit/delete buttons for land parcels (read-only data)
    const editBtn = document.getElementById('zone-edit-btn');
    const deleteBtn = document.getElementById('zone-delete-btn');
    if (editBtn) editBtn.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';

    panel.classList.remove('hidden');
}

function loadLandParcelLegend() {
    const legendContent = document.getElementById('legend-content');
    if (!legendContent) return;

    const legendItems = [
        { code: 'LUK', name: 'Đất trồng lúa nước còn lại' },
        { code: 'LUC', name: 'Đất chuyên trồng lúa nước' },
        { code: 'ONT+CLN', name: 'Đất ở + cây lâu năm' },
        { code: 'NTS', name: 'Đất nuôi trồng thủy sản' },
        { code: 'CLN', name: 'Đất trồng cây lâu năm' },
        { code: 'DGT', name: 'Đất giao thông' },
        { code: 'BHK', name: 'Đất bằng chưa sử dụng' },
        { code: 'DTL', name: 'Đất thủy lợi' },
        { code: 'ONT', name: 'Đất ở nông thôn' },
        { code: 'TMD', name: 'Đất thương mại dịch vụ' },
        { code: 'SKC', name: 'Đất sản xuất kinh doanh' },
        { code: 'RSX', name: 'Đất rừng sản xuất' },
        { code: 'RPH', name: 'Đất rừng phòng hộ' },
        { code: 'HNK', name: 'Đất cây hàng năm khác' },
        { code: 'DGD', name: 'Đất giáo dục' },
        { code: 'DYT', name: 'Đất y tế' },
        { code: 'TIN', name: 'Đất tôn giáo' },
        { code: 'TSC', name: 'Đất cơ sở tín ngưỡng' },
        { code: 'CQP', name: 'Đất quốc phòng' },
        { code: 'MNC', name: 'Đất mặt nước chuyên dùng' },
    ];

    legendContent.innerHTML = `
        <div style="margin-bottom:8px;padding:6px 10px;background:#dbeafe;border-radius:6px;font-size:11px;color:#1e40af">
            <b>129,000+</b> thửa đất từ GeoServer WMS
        </div>
    ` + legendItems.map(item => `
        <div class="legend-item">
            <div class="legend-color" style="background-color: ${getLandUseColor(item.code)}"></div>
            <div class="legend-info">
                <div class="legend-name">${item.name}</div>
                <div class="legend-code">${item.code}</div>
            </div>
        </div>
    `).join('');
}

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

    // Setup start button - Use startGeorefAnalysis for 4-point georeferencing workflow
    const startBtn = document.getElementById('start-analysis-btn');
    if (startBtn && !startBtn.dataset.initialized) {
        startBtn.addEventListener('click', startGeorefAnalysis);
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
    updateAnalysisStep('step1', 'processing', 'Đang upload ảnh...');

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

        // Step 1 completed - upload succeeded
        updateAnalysisStep('step1_upload', 'completed', '✓ Đã nhận ảnh bản đồ');
        updateAnalysisStep('step2', 'processing', 'Đang xử lý georeferencing...');

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

// Note: updateAnalysisStep is defined below (single comprehensive version with step mappings)

/**
 * Reset analysis steps UI for new Offline 4-step workflow
 */
function resetAnalysisSteps() {
    // Reset all 4 step containers
    ['step1', 'step2', 'step3', 'step4'].forEach((step, idx) => {
        const container = document.getElementById(`${step}-container`);
        const check = document.getElementById(`${step}-check`);
        const details = document.getElementById(`${step}-details`);

        if (container) {
            container.classList.remove('border-green-500', 'border-red-500', 'border-blue-500', 'bg-green-50', 'bg-red-50', 'bg-blue-50');
            if (idx > 0) container.classList.add('opacity-50');
            else container.classList.remove('opacity-50');
        }
        if (check) check.classList.remove('text-green-500', 'text-blue-500', 'text-red-500');
        if (details) details.classList.add('hidden');
    });

    // Reset step statuses
    const stepIds = ['step1', 'step2', 'step3', 'step4'];
    const defaultMessages = [
        'Tối ưu hóa kích thước ảnh',
        'Áp dụng 4 điểm tham chiếu GPS',
        'Phát hiện polygon màu sắc',
        'Gán loại đất từ legend'
    ];

    stepIds.forEach((step, idx) => {
        const status = document.getElementById(`step-${step}-status`);
        if (status) status.textContent = defaultMessages[idx];
    });

    // Make step 1 active (processing style)
    const step1 = document.getElementById('step1-container');
    if (step1) {
        step1.classList.remove('opacity-50');
        step1.classList.add('border-blue-500', 'bg-blue-50');
    }

    // Reset title
    const title = document.getElementById('analysis-title');
    if (title) title.textContent = 'Đang xử lý Offline...';

    // Reset spinner
    const spinner = document.getElementById('analysis-spinner');
    if (spinner) {
        spinner.classList.add('animate-spin');
        spinner.classList.remove('text-green-500', 'text-red-500');
        spinner.classList.add('text-green-600');
        spinner.textContent = 'sync';
    }
}

/**
 * Update analysis step with enhanced UI for Offline 4-step workflow
 */
function updateAnalysisStep(step, status, message) {
    console.log(`[UI] Step: ${step}, Status: ${status}, Message: ${message}`);

    // Map backend step names to UI element IDs
    const stepMappings = {
        'step1_upload': { container: 'step1-container', statusEl: 'step-step1-status', check: 'step1-check', details: 'step1-details', next: 'step2' },
        'step2_georef': { container: 'step2-container', statusEl: 'step-step2-status', check: 'step2-check', details: 'step2-details', next: 'step3' },
        'step3_opencv': { container: 'step3-container', statusEl: 'step-step3-status', check: 'step3-check', details: 'step3-details', next: 'step4' },
        'step4_mapping': { container: 'step4-container', statusEl: 'step-step4-status', check: 'step4-check', details: 'step4-details', next: null },
        // Also support short names
        'step1': { container: 'step1-container', statusEl: 'step-step1-status', check: 'step1-check', details: 'step1-details', next: 'step2' },
        'step2': { container: 'step2-container', statusEl: 'step-step2-status', check: 'step2-check', details: 'step2-details', next: 'step3' },
        'step3': { container: 'step3-container', statusEl: 'step-step3-status', check: 'step3-check', details: 'step3-details', next: 'step4' },
        'step4': { container: 'step4-container', statusEl: 'step-step4-status', check: 'step4-check', details: 'step4-details', next: null },
        // Legacy support for old step names
        'step1_coords': { container: 'step1-container', statusEl: 'step-step1-status', check: 'step1-check', next: 'step2' },
        'step2_opencv': { container: 'step3-container', statusEl: 'step-step3-status', check: 'step3-check', next: 'step4' },
        'step3_labels': { container: 'step4-container', statusEl: 'step-step4-status', check: 'step4-check', next: null },
    };

    const mapping = stepMappings[step];
    if (!mapping) {
        console.warn(`Unknown step: ${step}`);
        return;
    }

    const container = document.getElementById(mapping.container);
    const statusEl = document.getElementById(mapping.statusEl);
    const checkEl = document.getElementById(mapping.check);
    const detailsEl = mapping.details ? document.getElementById(mapping.details) : null;

    if (container) {
        container.classList.remove('opacity-50', 'border-gray-200', 'border-blue-500', 'border-green-500', 'border-yellow-500', 'border-red-500');
        container.classList.remove('bg-blue-50', 'bg-green-50', 'bg-yellow-50', 'bg-red-50');

        if (status === 'running' || status === 'processing') {
            container.classList.add('border-blue-500', 'bg-blue-50');
            // Show spinning icon
            if (checkEl) {
                checkEl.classList.remove('text-gray-300', 'text-green-500', 'text-red-500');
                checkEl.classList.add('text-blue-500', 'animate-spin');
                checkEl.textContent = 'sync';
            }
        } else if (status === 'completed') {
            container.classList.add('border-green-500', 'bg-green-50');
            // Show green checkmark (stop spinning)
            if (checkEl) {
                checkEl.classList.remove('text-gray-300', 'text-blue-500', 'text-red-500', 'animate-spin');
                checkEl.classList.add('text-green-500');
                checkEl.textContent = 'check_circle';
            }
            // Show details if available
            if (detailsEl) detailsEl.classList.remove('hidden');
            // Activate next step
            if (mapping.next) {
                const nextContainer = document.getElementById(`${mapping.next}-container`);
                if (nextContainer) {
                    nextContainer.classList.remove('opacity-50');
                    nextContainer.classList.add('border-blue-500', 'bg-blue-50');
                }
            }
        } else if (status === 'warning') {
            container.classList.add('border-yellow-500', 'bg-yellow-50');
        } else if (status === 'error' || status === 'failed') {
            container.classList.add('border-red-500', 'bg-red-50');
            if (checkEl) {
                checkEl.classList.remove('text-gray-300', 'text-green-500', 'text-blue-500');
                checkEl.classList.add('text-red-500');
                checkEl.textContent = 'error';
            }
        }
    }

    // Update status text
    if (statusEl && message) {
        statusEl.textContent = message;
        statusEl.className = 'text-sm ' + (status === 'error' ? 'text-red-500' :
            status === 'completed' ? 'text-green-600' :
                status === 'warning' ? 'text-yellow-600' :
                    status === 'running' || status === 'processing' ? 'text-blue-600' : 'text-gray-500');
    }

    // Update title
    const title = document.getElementById('analysis-title');
    if (title && message) {
        title.textContent = message;
    }
}


function addAnalysisLog(source, message) {
    const logContainer = document.getElementById('analysis-log');
    const time = new Date().toLocaleTimeString('vi-VN');

    // Enhanced color mapping for 4-step offline workflow
    const colorClass = {
        'UPLOAD': 'text-blue-400',
        'GEOREF': 'text-purple-400',
        'OPENCV': 'text-green-400',
        'MAPPING': 'text-amber-400',
        'PYTHON': 'text-cyan-400',
        'STEP1_UPLOAD': 'text-blue-300',
        'STEP2_GEOREF': 'text-purple-300',
        'STEP3_OPENCV': 'text-green-300',
        'STEP4_MAPPING': 'text-amber-300',
        // Legacy support
        'GEMINI': 'text-purple-400',
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
        'UPLOAD': '📤',
        'GEOREF': '📍',
        'OPENCV': '🔷',
        'MAPPING': '🗺️',
        'PYTHON': '🐍',
        'GEMINI': '🌟',
        'GPT4O': '🤖',
        'SYSTEM': '⚙️',
        'ERROR': '❌',
        'FALLBACK': '🔄',
        'SUCCESS': '✅'
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

/**
 * Create zone popup content like guland.vn
 * @param {Object} zone - Zone data
 * @param {number} idx - Zone index
 * @returns {string} HTML content for popup
 */
function createZonePopupContent(zone, idx) {
    const areaPercent = zone.areaPercent || 0;
    // Estimate area in hectares (can be customized based on actual map size)
    const estimatedAreaHa = zone.areaHectares || (areaPercent * 100); // Rough estimate
    const areaDisplay = estimatedAreaHa >= 100
        ? `${(estimatedAreaHa / 100).toFixed(2)} km²`
        : `${estimatedAreaHa.toFixed(2)} ha`;

    return `
        <div style="font-family: 'Segoe UI', sans-serif; min-width: 280px;">
            <!-- Header with color and name -->
            <div style="display:flex;align-items:center;gap:12px;padding:12px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;border-radius:8px 8px 0 0;margin:-13px -14px 12px -14px;">
                <div style="width:48px;height:48px;border-radius:8px;background-color:${zone.fillColor || zone.color || '#ccc'};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2);"></div>
                <div>
                    <h3 style="font-size:16px;font-weight:600;margin:0;">${zone.zoneName || zone.name || 'Vùng ' + (idx + 1)}</h3>
                    <div style="font-size:12px;opacity:0.9;">${zone.zoneCode || ''}</div>
                </div>
            </div>
            
            <!-- Area highlight -->
            <div style="background:#f0fdf4;padding:10px;border-radius:6px;margin:8px 0;text-align:center;">
                <div style="font-size:20px;font-weight:700;color:#166534;">${areaDisplay}</div>
                <div style="font-size:11px;color:#666;margin-top:2px;">Diện tích (${areaPercent.toFixed(2)}%)</div>
            </div>

            <!-- Details -->
            <div style="border-top:1px solid #eee;padding-top:8px;">
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;">
                    <span style="color:#666;font-size:13px;">🌱 Loại đất</span>
                    <span style="font-weight:500;color:#333;font-size:13px;">${zone.zoneType || zone.soilType || '-'}</span>
                </div>
                
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;">
                    <span style="color:#666;font-size:13px;">📋 Mã code</span>
                    <span style="font-weight:500;color:#333;font-size:13px;">${zone.zoneCode || '-'}</span>
                </div>
                
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;">
                    <span style="color:#666;font-size:13px;">🎯 Mục đích</span>
                    <span style="font-weight:500;color:#333;font-size:13px;max-width:160px;text-align:right;">${zone.landUsePurpose || zone.zoneName || '-'}</span>
                </div>
                
                <div style="display:flex;justify-content:space-between;padding:6px 0;">
                    <span style="color:#666;font-size:13px;">🎨 Màu sắc</span>
                    <span style="font-weight:500;color:#333;font-size:13px;">
                        <span style="display:inline-block;width:14px;height:14px;background:${zone.fillColor || zone.color};border:1px solid #ccc;border-radius:3px;vertical-align:middle;margin-right:4px;"></span>
                        ${zone.fillColor || zone.color || '-'}
                    </span>
                </div>
            </div>
            
            <!-- Actions -->
            <div style="margin-top:12px;padding-top:10px;border-top:1px solid #eee;display:flex;gap:8px;">
                <button onclick="flyToZone(${idx})" style="flex:1;padding:8px;background:#eff6ff;color:#1e40af;border:none;border-radius:6px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">
                    <span class="material-icons-round" style="font-size:14px;">center_focus_strong</span> Focus
                </button>
                <button onclick="highlightZoneOnMap(${idx})" style="flex:1;padding:8px;background:#fef3c7;color:#92400e;border:none;border-radius:6px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">
                    <span class="material-icons-round" style="font-size:14px;">highlight</span> Highlight
                </button>
            </div>
        </div>
    `;
}

function displayAnalysisResults(results) {
    console.log('Displaying results:', results);
    currentAnalysisResult = results;

    // Auto-sync result-map-type radio with the map type used for analysis
    const currentMapType = document.getElementById('selected-map-type')?.value || 'planning';
    const matchingRadio = document.querySelector(`input[name="result-map-type"][value="${currentMapType}"]`);
    if (matchingRadio) matchingRadio.checked = true;

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

    // Compute 4 corners from SW and NE
    const nw = { lat: ne.lat, lng: sw.lng };
    const se = { lat: sw.lat, lng: ne.lng };

    coordsInfo.innerHTML = `
        <div>
            <span class="text-gray-500">🔵 Góc Tây-Bắc (NW):</span>
            <span class="font-medium">${nw.lat?.toFixed(4) || 'N/A'}, ${nw.lng?.toFixed(4) || 'N/A'}</span>
        </div>
        <div>
            <span class="text-gray-500">🔴 Góc Đông-Bắc (NE):</span>
            <span class="font-medium">${ne.lat?.toFixed(4) || 'N/A'}, ${ne.lng?.toFixed(4) || 'N/A'}</span>
        </div>
        <div>
            <span class="text-gray-500">🟢 Góc Tây-Nam (SW):</span>
            <span class="font-medium">${sw.lat?.toFixed(4) || 'N/A'}, ${sw.lng?.toFixed(4) || 'N/A'}</span>
        </div>
        <div>
            <span class="text-gray-500">🟡 Góc Đông-Nam (SE):</span>
            <span class="font-medium">${se.lat?.toFixed(4) || 'N/A'}, ${se.lng?.toFixed(4) || 'N/A'}</span>
        </div>
        ${coords.confidence ? `<div class="col-span-2"><span class="text-gray-500">Độ tin cậy:</span> <span class="font-medium text-${coords.confidence === 'high' ? 'green' : coords.confidence === 'medium' ? 'yellow' : 'red'}-600">${coords.confidence.toUpperCase()}</span></div>` : ''}
    `;

    // Clear existing layers on map (including previous image overlays)
    if (resultMapPreview) {
        resultMapPreview.eachLayer(layer => {
            if (layer instanceof L.Rectangle || layer instanceof L.Polygon ||
                layer instanceof L.Circle || layer instanceof L.ImageOverlay) {
                resultMapPreview.removeLayer(layer);
            }
        });
    }

    // Also clear tracked overlays
    if (window.currentMapOverlays) {
        window.currentMapOverlays = [];
    }

    // Update map preview
    if (resultMapPreview && center.lat && center.lng) {
        // Use fitBounds/flyToBounds if we have valid bounds
        if (sw.lat && ne.lat && sw.lng && ne.lng) {
            resultMapPreview.flyToBounds([
                [sw.lat, sw.lng],
                [ne.lat, ne.lng]
            ], { padding: [20, 20], duration: 1.5 });
        } else {
            resultMapPreview.setView([center.lat, center.lng], 10);
        }

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

            // NEW: Add the original map image as a georeferenced overlay
            // Get image from either the preview or the uploaded file
            const georefImage = document.getElementById('georef-preview-image');
            const mapImageInput = document.getElementById('map-image-input');

            if (georefImage && georefImage.src && georefImage.src.startsWith('data:')) {
                // Use the preview image directly
                const imageBounds = [[sw.lat, sw.lng], [ne.lat, ne.lng]];

                const mapImageOverlay = L.imageOverlay(georefImage.src, imageBounds, {
                    opacity: 0.8,
                    interactive: false,
                    className: 'georef-map-overlay'
                });

                mapImageOverlay.addTo(resultMapPreview);

                // Store reference for later removal
                if (!window.currentMapOverlays) window.currentMapOverlays = [];
                window.currentMapOverlays.push(mapImageOverlay);

                console.log('Added georeferenced image overlay with bounds:', imageBounds);
            } else if (mapImageInput && mapImageInput.files[0]) {
                // Read the file and create overlay
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageBounds = [[sw.lat, sw.lng], [ne.lat, ne.lng]];
                    const mapImageOverlay = L.imageOverlay(e.target.result, imageBounds, {
                        opacity: 0.8,
                        interactive: false,
                        className: 'georef-map-overlay'
                    });
                    mapImageOverlay.addTo(resultMapPreview);

                    if (!window.currentMapOverlays) window.currentMapOverlays = [];
                    window.currentMapOverlays.push(mapImageOverlay);
                };
                reader.readAsDataURL(mapImageInput.files[0]);
            }
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
                // Create popup content like guland.vn
                const popupContent = createZonePopupContent(zone, idx);

                // Draw polygon from boundaries
                const polygon = L.polygon(boundaries, {
                    color: '#333333',           // Black border
                    weight: 2,                  // Border thickness
                    fillColor: zone.fillColor || zone.color || '#808080',
                    fillOpacity: 0.3,           // More transparent by default
                    className: `zone-${idx}`
                });

                // Add popup and tooltip
                polygon.bindPopup(popupContent, { maxWidth: 320, className: 'zone-popup-wrapper' });
                polygon.bindTooltip(`${zone.zoneName || zone.name || zone.soilType || 'Vùng'}`, {
                    permanent: false,
                    direction: 'top',
                    className: 'zone-tooltip'
                });

                // Add hover interactions like guland.vn
                polygon.on('mouseover', function () {
                    this.setStyle({
                        color: '#00BCD4',   // Cyan border on hover
                        weight: 3,
                        fillOpacity: 0.4
                    });
                    this.bringToFront();
                });

                polygon.on('mouseout', function () {
                    this.setStyle({
                        color: '#333333',
                        weight: 2,
                        fillOpacity: 0.3
                    });
                });

                polygon.on('click', function () {
                    this.setStyle({
                        color: '#00BCD4',
                        weight: 4,
                        fillOpacity: 0.5,
                        dashArray: null
                    });
                });

                polygon.addTo(resultMapPreview);
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
                    Diện tích: ${zone.areaHectares ? zone.areaHectares.toFixed(2) + ' ha' : (zone.areaPercent ? zone.areaPercent + '%' : 'N/A')}
                `).bindTooltip(`${zone.name || zone.soilType || 'Vùng'}: ${zone.areaHectares ? zone.areaHectares.toFixed(2) + ' ha' : ''}`, { permanent: false, direction: 'top' }).addTo(resultMapPreview);
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

    // Display soil statistics table (NEW)
    const soilStats = results.soilStatistics || [];
    const soilStatsContainer = document.getElementById('soil-statistics-container');
    const soilStatsBody = document.getElementById('soil-statistics-body');
    const soilTypesCount = document.getElementById('soil-types-count');

    if (soilStats.length > 0 && soilStatsContainer && soilStatsBody) {
        soilStatsContainer.classList.remove('hidden');
        soilTypesCount.textContent = soilStats.length;

        // Sort by area descending
        soilStats.sort((a, b) => (b.totalAreaPercent || 0) - (a.totalAreaPercent || 0));

        soilStatsBody.innerHTML = soilStats.map(stat => `
            <tr class="hover:bg-gray-50">
                <td class="px-3 py-2">
                    <span class="inline-flex items-center px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded">
                        ${stat.zoneCode || '?'}
                    </span>
                </td>
                <td class="px-3 py-2 text-gray-700">${stat.zoneName || stat.zoneType || 'N/A'}</td>
                <td class="px-3 py-2 text-center font-medium">${stat.zoneCount || 0}</td>
                <td class="px-3 py-2 text-right">${(stat.totalAreaPercent || 0).toFixed(2)}%</td>
                <td class="px-3 py-2 text-right font-medium text-amber-700">
                    ${stat.totalAreaHa ? stat.totalAreaHa.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' ha' : 'N/A'}
                </td>
            </tr>
        `).join('');
    } else if (soilStatsContainer) {
        soilStatsContainer.classList.add('hidden');
    }

    // Display zones list with color indicator and border
    document.getElementById('total-zones-count').textContent = zones.length;
    const zonesList = document.getElementById('detected-zones-list');
    zonesList.innerHTML = zones.map((zone, idx) => `
        <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors cursor-pointer" 
             onclick="highlightZoneOnMap(${idx})"
             title="Click để highlight trên bản đồ">
            <div class="w-8 h-8 rounded border-2 border-gray-800" style="background-color: ${zone.fillColor || zone.color || '#ccc'}"></div>
            <div class="flex-1 min-w-0">
                <div class="font-medium truncate">${zone.zoneName || zone.name || `Vùng ${idx + 1}`}</div>
                <div class="text-sm text-gray-500">${zone.zoneCode ? `[${zone.zoneCode}]` : ''} ${zone.soilType || zone.zoneType || 'N/A'}</div>
            </div>
            <div class="text-right">
                <div class="text-sm font-medium text-gray-700">${zone.areaPercent ? zone.areaPercent.toFixed(2) + '%' : ''}</div>
                <div class="text-xs text-amber-600 font-medium">${zone.areaHectares ? zone.areaHectares.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' ha' : ''}</div>
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

// Helper function to fly/zoom to a specific zone
function flyToZone(zoneIndex) {
    if (!resultMapPreview || !currentAnalysisResult?.zones) return;

    const zone = currentAnalysisResult.zones[zoneIndex];
    if (!zone) return;

    // Parse boundaries to get center
    let boundaries = zone.boundaryCoordinates;
    if (typeof boundaries === 'string') {
        try {
            boundaries = JSON.parse(boundaries);
        } catch (e) {
            return;
        }
    }

    if (boundaries && boundaries.length > 0) {
        // Calculate center of polygon
        const lats = boundaries.map(b => b[0]);
        const lngs = boundaries.map(b => b[1]);
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

        // Fly to center with zoom
        resultMapPreview.flyTo([centerLat, centerLng], 14, { duration: 1 });

        // Highlight the zone after flying
        setTimeout(() => highlightZoneOnMap(zoneIndex), 1000);
    }
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
            const originalOpacity = layer.options.fillOpacity || 0.3;

            // Flash cyan then back
            layer.setStyle({
                color: '#00BCD4',
                weight: 4,
                fillColor: '#FFFF00',
                fillOpacity: 0.7
            });

            setTimeout(() => {
                layer.setStyle({
                    color: '#00BCD4',
                    weight: 3,
                    fillColor: originalColor,
                    fillOpacity: 0.5
                });
            }, 800);

            // Open popup
            layer.openPopup();
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
            discardAnalysis(true); // Skip backend DELETE - zones already saved to DB
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

function discardAnalysis(skipBackendDelete = false) {
    if (currentAnalysisId && !skipBackendDelete) {
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

    // Clear map layers (including image overlays)
    if (resultMapPreview) {
        resultMapPreview.eachLayer(layer => {
            if (layer instanceof L.Rectangle || layer instanceof L.Polygon ||
                layer instanceof L.Circle || layer instanceof L.ImageOverlay) {
                resultMapPreview.removeLayer(layer);
            }
        });
    }

    // Clear tracked image overlays
    if (window.currentMapOverlays) {
        window.currentMapOverlays.forEach(overlay => {
            if (resultMapPreview) resultMapPreview.removeLayer(overlay);
        });
        window.currentMapOverlays = [];
    }
}

// Export functions
window.clearMapImage = clearMapImage;
window.toggleAnalysisLog = toggleAnalysisLog;
window.discardAnalysis = discardAnalysis;
window.confirmAndSaveAnalysis = confirmAndSaveAnalysis;
window.highlightZoneOnMap = highlightZoneOnMap;

// ============ GEOREFERENCING CONTROL POINTS ============
/**
 * Georeferencing System for Advanced Map Analysis
 * Allows placing 4 control points on image to map pixel coordinates to lat/lng
 */

// State for control points
const controlPoints = {
    1: { px: null, py: null, lat: null, lng: null, set: false },
    2: { px: null, py: null, lat: null, lng: null, set: false },
    3: { px: null, py: null, lat: null, lng: null, set: false },
    4: { px: null, py: null, lat: null, lng: null, set: false }
};
let currentControlPointToSet = 1;
let georefImageLoaded = false;

// Control point colors for visual markers
const cpColors = {
    1: '#3B82F6', // Blue
    2: '#22C55E', // Green
    3: '#F59E0B', // Amber
    4: '#A855F7'  // Purple
};

/**
 * Handle click on georeferencing preview image to set control point pixel position
 */
function handleGeorefClick(event) {
    const img = document.getElementById('georef-preview-image');
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert to actual image pixel coordinates
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    const pixelX = Math.round(x * scaleX);
    const pixelY = Math.round(y * scaleY);

    // Set the next unset control point
    let pointToSet = currentControlPointToSet;
    for (let i = 1; i <= 4; i++) {
        if (!controlPoints[i].px && !controlPoints[i].py) {
            pointToSet = i;
            break;
        }
    }

    // Update control point
    controlPoints[pointToSet].px = pixelX;
    controlPoints[pointToSet].py = pixelY;
    document.getElementById(`cp-${pointToSet}-px`).value = pixelX;
    document.getElementById(`cp-${pointToSet}-py`).value = pixelY;

    // Update status
    updateControlPointStatus(pointToSet);

    // Render marker on image
    renderGeorefMarkers();

    // Move to next point
    currentControlPointToSet = (pointToSet % 4) + 1;

    console.log(`Control Point ${pointToSet}: Pixel(${pixelX}, ${pixelY})`);
}

/**
 * Update control point when lat/lng input changes
 */
function updateControlPoint(pointNum) {
    const lat = parseFloat(document.getElementById(`cp-${pointNum}-lat`).value);
    const lng = parseFloat(document.getElementById(`cp-${pointNum}-lng`).value);

    if (!isNaN(lat)) controlPoints[pointNum].lat = lat;
    if (!isNaN(lng)) controlPoints[pointNum].lng = lng;

    updateControlPointStatus(pointNum);
    checkGeorefComplete();
}

/**
 * Update visual status of a control point card
 */
function updateControlPointStatus(pointNum) {
    const cp = controlPoints[pointNum];
    const hasPixel = cp.px !== null && cp.py !== null;
    const hasGeo = cp.lat !== null && cp.lng !== null;
    const statusEl = document.getElementById(`cp-${pointNum}-status`);
    const container = document.getElementById(`cp-${pointNum}-container`);

    if (hasPixel && hasGeo) {
        cp.set = true;
        if (statusEl) {
            statusEl.textContent = '✓ Hoàn tất';
            statusEl.classList.remove('text-blue-500', 'text-green-500', 'text-amber-500', 'text-purple-500');
            statusEl.classList.add('text-green-600', 'font-semibold');
        }
        if (container) {
            container.classList.add('ring-2', 'ring-green-400');
        }
    } else if (hasPixel) {
        if (statusEl) {
            statusEl.textContent = `Pixel: (${cp.px}, ${cp.py})`;
        }
        if (container) {
            container.classList.remove('ring-2', 'ring-green-400');
        }
    } else {
        cp.set = false;
        if (statusEl) {
            statusEl.textContent = 'Chưa đặt';
        }
        if (container) {
            container.classList.remove('ring-2', 'ring-green-400');
        }
    }
}

/**
 * Render visual markers on the georef preview image
 */
function renderGeorefMarkers() {
    const markersLayer = document.getElementById('georef-markers-layer');
    const img = document.getElementById('georef-preview-image');
    if (!markersLayer || !img) return;

    // Clear existing markers
    markersLayer.innerHTML = '';

    const rect = img.getBoundingClientRect();
    const containerRect = document.getElementById('georef-preview-container').getBoundingClientRect();

    for (let i = 1; i <= 4; i++) {
        const cp = controlPoints[i];
        if (cp.px !== null && cp.py !== null) {
            // Convert image pixels to display position
            const scaleX = rect.width / img.naturalWidth;
            const scaleY = rect.height / img.naturalHeight;
            const displayX = cp.px * scaleX;
            const displayY = cp.py * scaleY;

            const marker = document.createElement('div');
            marker.className = 'absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none';
            marker.style.left = `${displayX}px`;
            marker.style.top = `${displayY}px`;
            marker.innerHTML = `
                <div class="relative">
                    <div class="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg"
                         style="background-color: ${cpColors[i]};">
                        ${i}
                    </div>
                    <div class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 
                                border-l-4 border-r-4 border-t-4 border-transparent"
                         style="border-top-color: ${cpColors[i]};"></div>
                </div>
            `;
            markersLayer.appendChild(marker);
        }
    }
}

/**
 * Fill GCP preset for Thới Bình district, Ca Mau province
 * Coordinates match Global Mapper: 9°15'-9°30'N, 105°00'-105°15'E
 */
function fillThoiBinhPreset() {
    const img = document.getElementById('georef-preview-image');
    if (!img || !img.naturalWidth) {
        showToast('Lỗi', 'Vui lòng upload ảnh trước', 'error');
        return;
    }

    const w = img.naturalWidth;
    const h = img.naturalHeight;

    // GCP pixel positions from Global Mapper (proportional to image size)
    // Original image: 3352x3566, GCP at content corners
    const presets = [
        { point: 1, px: Math.round(w * 0.1209), py: Math.round(h * 0.1627), lat: 9.5000, lng: 105.0000 },  // Top-left
        { point: 2, px: Math.round(w * 0.1191), py: Math.round(h * 0.8567), lat: 9.2500, lng: 105.0000 },  // Bottom-left
        { point: 3, px: Math.round(w * 0.8649), py: Math.round(h * 0.8567), lat: 9.2500, lng: 105.2500 },  // Bottom-right
        { point: 4, px: Math.round(w * 0.8617), py: Math.round(h * 0.1638), lat: 9.5000, lng: 105.2500 }   // Top-right
    ];

    presets.forEach(p => {
        controlPoints[p.point] = {
            px: p.px,
            py: p.py,
            lat: p.lat,
            lng: p.lng,
            set: true
        };

        document.getElementById(`cp-${p.point}-px`).value = p.px;
        document.getElementById(`cp-${p.point}-py`).value = p.py;
        document.getElementById(`cp-${p.point}-lat`).value = p.lat;
        document.getElementById(`cp-${p.point}-lng`).value = p.lng;

        updateControlPointStatus(p.point);
    });

    renderGeorefMarkers();
    checkGeorefComplete();

    showToast('Áp dụng preset', 'H. Thới Bình - Cà Mau (9°15\'-9°30\'N, 105°00\'-105°15\'E)', 'success');
}

/**
 * Fill with Ca Mau province preset coordinates (whole province)
 */
function fillCaMauPreset() {
    const img = document.getElementById('georef-preview-image');
    if (!img || !img.naturalWidth) {
        showToast('Lỗi', 'Vui lòng upload ảnh trước', 'error');
        return;
    }

    const w = img.naturalWidth;
    const h = img.naturalHeight;

    // Set pixel coordinates (corners)
    const presets = [
        { point: 1, px: 0, py: 0, lat: 9.55, lng: 104.75 },      // Top-left
        { point: 2, px: 0, py: h, lat: 8.55, lng: 104.75 },      // Bottom-left
        { point: 3, px: w, py: h, lat: 8.55, lng: 105.45 },      // Bottom-right
        { point: 4, px: w, py: 0, lat: 9.55, lng: 105.45 }       // Top-right
    ];

    presets.forEach(p => {
        controlPoints[p.point] = {
            px: p.px,
            py: p.py,
            lat: p.lat,
            lng: p.lng,
            set: true
        };

        document.getElementById(`cp-${p.point}-px`).value = p.px;
        document.getElementById(`cp-${p.point}-py`).value = p.py;
        document.getElementById(`cp-${p.point}-lat`).value = p.lat;
        document.getElementById(`cp-${p.point}-lng`).value = p.lng;

        updateControlPointStatus(p.point);
    });

    renderGeorefMarkers();
    checkGeorefComplete();

    showToast('Áp dụng preset', 'Toàn tỉnh Cà Mau (8.55°-9.55°N, 104.75°-105.45°E)', 'success');
}

/**
 * Check if all 4 control points are complete and enable analysis button
 */
function checkGeorefComplete() {
    const allComplete = Object.values(controlPoints).every(cp => cp.set);
    const analysisBtn = document.getElementById('start-analysis-btn');

    if (analysisBtn) {
        if (allComplete && georefImageLoaded) {
            analysisBtn.disabled = false;
        }
    }

    return allComplete;
}

/**
 * Get control points data for API submission
 */
function getControlPointsData() {
    return Object.entries(controlPoints).map(([id, cp]) => ({
        pointId: parseInt(id),
        pixelX: cp.px,
        pixelY: cp.py,
        lat: cp.lat,
        lng: cp.lng
    }));
}

/**
 * Reset all control points
 */
function resetControlPoints() {
    for (let i = 1; i <= 4; i++) {
        controlPoints[i] = { px: null, py: null, lat: null, lng: null, set: false };
        document.getElementById(`cp-${i}-px`).value = '';
        document.getElementById(`cp-${i}-py`).value = '';
        document.getElementById(`cp-${i}-lat`).value = '';
        document.getElementById(`cp-${i}-lng`).value = '';
        updateControlPointStatus(i);
    }
    currentControlPointToSet = 1;
    renderGeorefMarkers();
}

/**
 * Initialize georeferencing preview when image is uploaded
 */
function initGeorefPreview(imageSrc) {
    const georefSection = document.getElementById('georef-section');
    const georefImage = document.getElementById('georef-preview-image');

    if (georefSection && georefImage) {
        georefImage.src = imageSrc;
        georefImage.style.display = 'block';
        georefSection.classList.remove('hidden');
        georefImageLoaded = true;

        // Wait for image to load then render any existing markers
        georefImage.onload = () => {
            renderGeorefMarkers();
        };
    }
}

// Update the existing map-image-input handler to also initialize georef preview
document.addEventListener('DOMContentLoaded', () => {
    const mapImageInput = document.getElementById('map-image-input');
    if (mapImageInput) {
        mapImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    // Initialize georef preview with the uploaded image
                    initGeorefPreview(ev.target.result);

                    // Reset control points for new image
                    resetControlPoints();
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

// Export georeferencing functions
window.handleGeorefClick = handleGeorefClick;
window.updateControlPoint = updateControlPoint;
window.fillCaMauPreset = fillCaMauPreset;
window.resetControlPoints = resetControlPoints;
window.getControlPointsData = getControlPointsData;
window.checkGeorefComplete = checkGeorefComplete;

// ============ GEOREFERENCED ANALYSIS SUBMISSION ============

/**
 * Start georeferenced analysis with the new offline-only API
 * Collects control points and file, then calls /api/admin/map-image/analyze/georef
 */
async function startGeorefAnalysis() {
    const fileInput = document.getElementById('map-image-input');
    const file = fileInput?.files[0];

    if (!file) {
        showToast('Lỗi', 'Vui lòng chọn file ảnh bản đồ', 'error');
        return;
    }

    // Validate control points
    const controlPoints = getControlPointsData();
    const validPoints = controlPoints.filter(cp =>
        cp.pixelX !== null && cp.pixelY !== null &&
        cp.lat !== null && cp.lng !== null
    );

    if (validPoints.length !== 4) {
        showToast('Lỗi', 'Vui lòng đặt đủ 4 điểm tham chiếu GPS', 'error');
        return;
    }

    // Get province/district and map type from UI
    const province = document.getElementById('analysis-province')?.value || 'Cà Mau';
    const district = document.getElementById('analysis-district')?.value || '';
    const mapType = document.getElementById('selected-map-type')?.value || 'soil';

    // Disable button and show loading
    const btn = document.getElementById('start-analysis-btn');
    btn.disabled = true;
    btn.innerHTML = `
        <span class="material-icons-round animate-spin">sync</span>
        Đang phân tích...
    `;

    // Show progress container
    document.getElementById('analysis-progress-container')?.classList.remove('hidden');
    // Reset all steps to pending state first
    resetAnalysisSteps();
    updateAnalysisStep('step1', 'processing', 'Đang upload ảnh...');

    try {
        // Build FormData
        const formData = new FormData();
        formData.append('image', file);
        formData.append('controlPoints', JSON.stringify(controlPoints));
        formData.append('province', province);
        formData.append('district', district);
        formData.append('mapType', mapType);

        const token = localStorage.getItem('token') || localStorage.getItem('authToken');

        // Send to new georef endpoint
        const response = await fetch(`${API_BASE_URL}/admin/map-image/analyze/georef`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Lỗi khởi tạo phân tích');
        }

        console.log('Georef analysis started:', data);
        currentAnalysisId = data.analysisId;

        // Step 1 completed - upload succeeded
        updateAnalysisStep('step1_upload', 'completed', '✓ Đã nhận ảnh bản đồ');
        updateAnalysisStep('step2', 'processing', 'Đang xử lý georeferencing...');

        // Connect to SSE for progress updates
        connectToAnalysisProgress(data.analysisId);

        showToast('Đang phân tích', data.message, 'info');

    } catch (error) {
        console.error('Georef analysis error:', error);
        showToast('Lỗi', error.message, 'error');

        btn.disabled = false;
        btn.innerHTML = `
            <span class="material-icons-round">memory</span>
            Phân tích bằng OpenCV (Offline)
        `;
        document.getElementById('analysis-progress-container')?.classList.add('hidden');
    }
}

/**
 * Update analysis step UI — delegates to the comprehensive version above
 * (This wrapper exists for compatibility with the georef analysis flow)
 */
// Note: The main updateAnalysisStep function is defined earlier with full step mapping support.
// No duplicate needed here.

/**
 * Handle analysis completion
 */
function handleAnalysisComplete(result) {
    console.log('Analysis result:', result);

    // Store result for confirmation
    currentAnalysisResult = result;

    // Update UI
    const spinner = document.getElementById('analysis-spinner');
    if (spinner) {
        spinner.classList.remove('animate-spin');
        spinner.textContent = 'check_circle';
        spinner.classList.add('text-green-500');
    }

    const title = document.getElementById('analysis-title');
    if (title) {
        const zoneCount = result.zones?.length || 0;
        const totalHa = result.totalAreaHectares?.toFixed(2) || '0';
        title.textContent = `Hoàn tất! Phát hiện ${zoneCount} vùng, tổng ${totalHa} ha`;
    }

    // Reset button
    const btn = document.getElementById('start-analysis-btn');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
            <span class="material-icons-round">memory</span>
            Phân tích bằng OpenCV (Offline)
        `;
    }

    // Display results
    if (result.success && result.zones?.length > 0) {
        displayAnalysisResults(result);
        showToast('Thành công', `Phát hiện ${result.zones.length} vùng`, 'success');
    } else {
        showToast('Cảnh báo', result.error || 'Không phát hiện được vùng nào', 'warning');
    }
}

/**
 * Reset analysis UI to initial state
 */
function resetAnalysisUI() {
    const btn = document.getElementById('start-analysis-btn');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
            <span class="material-icons-round">memory</span>
            Phân tích bằng OpenCV (Offline)
        `;
    }
    document.getElementById('analysis-progress-container')?.classList.add('hidden');
}

// Wire up the analysis button on page load
document.addEventListener('DOMContentLoaded', () => {
    const analysisBtn = document.getElementById('start-analysis-btn');
    if (analysisBtn) {
        analysisBtn.addEventListener('click', startGeorefAnalysis);
    }
});


// ============ ANALYSIS HISTORY (Phase 6) ============

async function loadAnalysisHistory() {
    const container = document.getElementById('analysis-history-list');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-4 text-gray-500">Đang tải lịch sử...</div>';

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/admin/map-image/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!data.success || !data.history || data.history.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <span class="material-icons-round text-4xl mb-2">history</span>
                    <p>Chưa có lịch sử phân tích nào</p>
                </div>
            `;
            return;
        }

        container.innerHTML = data.history.map(item => `
            <div class="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow relative group">
                <div class="flex items-start justify-between">
                    <div class="flex gap-3">
                        <div class="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden border">
                            ${item.originalImagePath ?
                `<img src="/api/admin/map-image/uploads/${item.originalImagePath.split('/').pop()}" class="w-full h-full object-cover" onerror="this.src='/images/placeholder.png'">` :
                `<span class="material-icons-round text-gray-400">image</span>`
            }
                        </div>
                        <div>
                            <div class="font-medium text-gray-800">
                                ${item.mapType === 'planning' ? 'Bản đồ Quy hoạch' : 'Bản đồ Thổ nhưỡng'}
                            </div>
                            <div class="text-sm text-gray-500">
                                ${new Date(item.createdAt).toLocaleString('vi-VN')}
                            </div>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                    ${item.zoneCount || 0} vùng
                                </span>
                                ${item.totalAreaHectares ? `
                                    <span class="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                        ${item.totalAreaHectares} ha
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <button onclick="confirmRollbackAnalysis('${item.analysisId}')" 
                        class="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                        title="Xóa & Rollback">
                        <span class="material-icons-round">delete_forever</span>
                    </button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Load history error:', error);
        container.innerHTML = '<div class="text-center py-4 text-red-500">Lỗi tải lịch sử</div>';
    }
}

function confirmRollbackAnalysis(analysisId) {
    if (confirm('CẢNH BÁO: Hành động này sẽ xóa toàn bộ các vùng quy hoạch và dữ liệu liên quan đến lần phân tích này.\n\nBạn có chắc chắn muốn tiếp tục?')) {
        rollbackAnalysis(analysisId);
    }
}

async function rollbackAnalysis(analysisId) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        showToast('Đang xử lý...', 'Đang xóa lịch sử và zones...', 'info');

        const response = await fetch(`${API_BASE_URL}/admin/map-image/history/${analysisId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            showToast('Thành công', data.message, 'success');
            loadAnalysisHistory(); // Reload list
            loadPlanningZones(); // Reload map zones
        } else {
            showToast('Lỗi', data.error || 'Xóa thất bại', 'error');
        }
    } catch (error) {
        console.error('Rollback error:', error);
        showToast('Lỗi', 'Không thể kết nối đến server', 'error');
    }
}

// Ensure initImageAnalysisTab loads history
window.initImageAnalysisTab = function () {
    loadAnalysisHistory();
};


window.loadAnalysisHistory = loadAnalysisHistory;
window.confirmRollbackAnalysis = confirmRollbackAnalysis;
window.startGeorefAnalysis = startGeorefAnalysis;


