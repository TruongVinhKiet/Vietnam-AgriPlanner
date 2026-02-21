/**
 * Livestock Management - livestock.js
 * Handles pen management, animal selection, and add cage functionality
 */

// Global state
let allAnimals = [];
let allPens = [];
let selectedPen = null;
let selectedAnimal = null;
let selectedFarmingType = null;
let selectedWaterType = null;
let penSimulation = null; // Canvas simulation instance

// Farm ID - dynamically loaded from user's farms
let currentFarmId = null;
// API_BASE_URL is defined in config.js (loaded before this script)

// User inventory cache for checking before activities
let livestockInventoryCache = [];

// ==================== INVENTORY HELPERS ====================

async function loadLivestockInventory() {
    try {
        const userEmail = localStorage.getItem('userEmail');
        if (!userEmail) return [];
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/shop/inventory?userEmail=${encodeURIComponent(userEmail)}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (response.ok) {
            const data = await response.json();
            livestockInventoryCache = data.items || [];
            return livestockInventoryCache;
        }
    } catch (e) {
        console.error('Error loading inventory:', e);
    }
    return [];
}

function checkLivestockInventory(category, productName, requiredQuantity) {
    const items = livestockInventoryCache.filter(item => {
        const itemName = item.effectiveName || item.name || item.itemName || '';
        const itemCategory = item.category || item.type || '';
        const matchCategory = !category || itemCategory === category;
        const matchName = !productName || itemName.toLowerCase().includes(productName.toLowerCase());
        return matchCategory && matchName;
    });

    const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    return {
        hasEnough: totalQuantity >= requiredQuantity,
        available: totalQuantity,
        needed: requiredQuantity,
        shortage: Math.max(0, requiredQuantity - totalQuantity),
        items: items
    };
}

function redirectToShopFromLivestock(category, productKeyword, quantity, message) {
    const intent = {
        category: category,
        keyword: productKeyword,
        quantity: quantity,
        fromLivestock: true,
        returnUrl: window.location.href,
        timestamp: Date.now()
    };
    localStorage.setItem('agriplanner_purchase_intent', JSON.stringify(intent));

    showNotification(message || `Cần mua thêm ${productKeyword}`, 'warning');

    setTimeout(() => {
        window.location.href = `shop.html?category=${category}&search=${encodeURIComponent(productKeyword)}&quantity=${quantity}`;
    }, 1500);
}

function showLivestockInventoryShortageModal(itemName, available, needed, category, keyword) {
    const shortage = needed - available;

    // Remove existing modal if any
    const existingModal = document.getElementById('livestock-inventory-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'livestock-inventory-modal';
    modal.style.cssText = 'display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;z-index:9999;';
    modal.innerHTML = `
        <div class="modal-content" style="background:white;border-radius:16px;max-width:450px;width:90%;padding:0;overflow:hidden;">
            <div class="modal-header" style="padding:20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;display:flex;align-items:center;gap:8px;">
                    <span class="material-symbols-outlined" style="color:#f59e0b;">inventory_2</span> 
                    Thiếu vật tư
                </h3>
                <button class="modal-close" style="border:none;background:none;cursor:pointer;font-size:24px;" onclick="document.getElementById('livestock-inventory-modal').remove()">&times;</button>
            </div>
            <div class="modal-body" style="text-align:center;padding:32px;">
                <div style="font-size:48px;margin-bottom:16px;">🥩</div>
                <h4 style="margin-bottom:8px;">${itemName}</h4>
                <p style="color:#64748b;margin-bottom:16px;">
                    Cần: <strong>${needed}</strong> kg • Trong kho: <strong>${available}</strong> kg • Thiếu: <strong style="color:#ef4444;">${shortage}</strong> kg
                </p>
                <p style="font-size:14px;color:#475569;">Bạn có muốn chuyển đến cửa hàng để mua thêm?</p>
            </div>
            <div class="modal-footer" style="padding:20px;border-top:1px solid #e2e8f0;display:flex;justify-content:center;gap:12px;">
                <button class="btn btn--secondary" onclick="document.getElementById('livestock-inventory-modal').remove()">Để sau</button>
                <button class="btn btn--primary" onclick="document.getElementById('livestock-inventory-modal').remove(); redirectToShopFromLivestock('THUC_AN', '${keyword}', ${shortage}, 'Đang chuyển tới cửa hàng...');">
                    <span class="material-symbols-outlined">shopping_cart</span> Mua ngay
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', async function () {
    console.log('Livestock page initialized');

    // Initialize Canvas simulation
    penSimulation = new PenSimulation('pen-canvas');

    // Sound toggle button
    const soundBtn = document.getElementById('pen-viz-sound-toggle');
    if (soundBtn && penSimulation) {
        soundBtn.addEventListener('click', () => {
            const on = penSimulation.toggleSound();
            const icon = document.getElementById('pen-viz-sound-icon');
            if (icon) icon.textContent = on ? 'volume_up' : 'volume_off';
        });
    }

    // Load user's farm first
    await loadCurrentFarm();

    // Load initial data
    await loadAnimals();
    await loadPens();
    await loadLivestockInventory(); // Load inventory for activity checks

    // Setup event listeners
    setupEventListeners();

    // Render pen selector bar
    renderPenSelectorBar();

    // Auto-select first pen if available
    if (allPens.length > 0) {
        selectPen(allPens[0].id);
    }

    // Fetch weather for simulation
    _fetchWeatherForSim();
});

// Fetch weather once for canvas simulation
async function _fetchWeatherForSim() {
    try {
        if (!penSimulation || !CONFIG?.OPENWEATHER_API_KEY) return;
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
        const { latitude: lat, longitude: lng } = pos.coords;
        const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${CONFIG.OPENWEATHER_API_KEY}`);
        if (r.ok) penSimulation.setWeather(await r.json());
    } catch (e) { /* silent — weather is optional */ }
}

async function loadCurrentFarm() {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        if (!token) {
            console.warn('No auth token, cannot load farm');
            return;
        }
        const headers = { 'Authorization': `Bearer ${token}` };

        const response = await fetch(`${API_BASE_URL}/farms/my-farms`, { headers });
        if (response.status === 401 || response.status === 403) {
            console.warn('Auth token invalid/expired, redirecting to login');
            localStorage.removeItem('authToken');
            localStorage.removeItem('token');
            window.location.href = 'login.html';
            return;
        }
        if (response.ok) {
            const farms = await response.json();
            if (farms.length > 0) {
                currentFarmId = farms[0].id;
                console.log('Loaded farm ID:', currentFarmId);
            } else {
                console.warn('No farms found for current user');
                showNotification('Bạn chưa có nông trại. Vui lòng tạo nông trại trước.', 'warning');
            }
        }
    } catch (error) {
        console.error('Error loading farm:', error);
    }
}

function setupEventListeners() {
    // Pen selector card clicks (delegated)
    const selectorBar = document.getElementById('pen-selector-bar');
    if (selectorBar) {
        selectorBar.addEventListener('click', function (e) {
            const card = e.target.closest('.pen-selector-card');
            if (card) {
                const penId = card.getAttribute('data-pen-id');
                if (penId === 'new') {
                    openAddCageModal();
                } else {
                    selectPen(parseInt(penId));
                }
            }
        });
    }

    // Modal close buttons
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    // Modal backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                closeModal();
            }
        });
    });

    // Setup delete modal
    setupDeleteModal();
}

// ==================== API CALLS ====================

async function loadAnimals() {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/animals`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            allAnimals = await response.json();
            console.log('Loaded animals:', allAnimals.length);
        }
    } catch (error) {
        console.error('Error loading animals:', error);
        showNotification('Không thể tải danh sách vật nuôi', 'error');
    }
}

async function loadPens() {
    if (!currentFarmId) {
        console.log('No farm ID available, skipping pen load');
        allPens = [];
        return;
    }

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/pens?farmId=${currentFarmId}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (response.ok) {
            allPens = await response.json();
            console.log('Loaded pens:', allPens.length);
        }
    } catch (error) {
        console.error('Error loading pens:', error);
        showNotification('Không thể tải danh sách chuồng', 'error');
    }
}

async function createPen(penData) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/pens`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(penData)
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Đã thêm chuồng mới thành công!', 'success');
            await loadPens();
            renderPenSelectorBar();
            closeModal();
            // Auto-select the newly created pen
            if (result && result.id) selectPen(result.id);
            return result;
        } else {
            if (result.warning) {
                showNotification(result.message, 'error');
            } else {
                showNotification(result.error || 'Lỗi khi tạo chuồng', 'error');
            }
            return null;
        }
    } catch (error) {
        console.error('Error creating pen:', error);
        showNotification('Lỗi kết nối server', 'error');
        return null;
    }
}

async function calculateCapacity(data) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/calculate-capacity`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (error) {
        console.error('Error calculating capacity:', error);
        return null;
    }
}

// ==================== RENDER FUNCTIONS ====================

function renderPenSelectorBar() {
    const bar = document.getElementById('pen-selector-bar');
    if (!bar) return;

    bar.innerHTML = '';

    allPens.forEach(pen => {
        bar.appendChild(createSelectorCard(pen));
    });

    // Add "new pen" card
    const addCard = document.createElement('div');
    addCard.className = 'pen-selector-card pen-selector-card--add';
    addCard.setAttribute('data-pen-id', 'new');
    addCard.innerHTML = `
        <span class="material-symbols-outlined pen-selector-card__icon">add_circle</span>
        <span class="pen-selector-card__info">
            <span class="pen-selector-card__code">Thêm chuồng</span>
        </span>
    `;
    bar.appendChild(addCard);
}

function createSelectorCard(pen) {
    const card = document.createElement('div');
    const hasAlert = pen.status === 'SICK';
    const isSelected = selectedPen && selectedPen.id === pen.id;

    card.className = `pen-selector-card${isSelected ? ' pen-selector-card--active' : ''}${hasAlert ? ' pen-selector-card--alert' : ''}`;
    card.setAttribute('data-pen-id', pen.id);

    const animalName = pen.animalDefinition ? pen.animalDefinition.name : 'Trống';
    const animalIcon = getAnimalIcon(pen.animalDefinition);
    const count = pen.animalCount || 0;
    const statusBadge = getStatusBadge(pen.status);

    card.innerHTML = `
        <span class="material-symbols-outlined pen-selector-card__icon">${animalIcon}</span>
        <span class="pen-selector-card__info">
            <span class="pen-selector-card__code">${pen.code}</span>
            <span class="pen-selector-card__meta">${animalName}${count > 0 ? ' · ' + count : ''}</span>
        </span>
        <span class="pen-selector-card__status pen-selector-card__status--${String(pen.status || 'EMPTY').toLowerCase()}"></span>
    `;

    return card;
}

// Keep old getStatusClass for any legacy use
function getStatusClass(status) {
    switch (status) {
        case 'CLEAN': return 'pen-card--clean';
        case 'DIRTY': return 'pen-card--dirty';
        case 'EMPTY': return 'pen-card--empty';
        case 'SICK': return 'pen-card--clean';
        default: return 'pen-card--clean';
    }
}

function getFeedingStatusClass(pen) {
    if (!pen.feedingStatus) return '';

    // Check if overdue based on nextFeedingAt
    if (pen.nextFeedingAt && new Date(pen.nextFeedingAt) < new Date()) {
        return 'pen-card__feeding-status--overdue';
    }

    switch (pen.feedingStatus) {
        case 'FED': return 'pen-card__feeding-status--fed';
        case 'OVERDUE': return 'pen-card__feeding-status--overdue';
        case 'PENDING':
        default: return 'pen-card__feeding-status--pending';
    }
}

function getFeedingStatusIcon(pen) {
    if (!pen.feedingStatus) return 'restaurant';

    if (pen.nextFeedingAt && new Date(pen.nextFeedingAt) < new Date()) {
        return 'warning';
    }

    switch (pen.feedingStatus) {
        case 'FED': return 'check_circle';
        case 'OVERDUE': return 'warning';
        case 'PENDING':
        default: return 'schedule';
    }
}

function getFeedingStatusText(pen) {
    if (!pen.feedingStatus) return '';

    if (pen.nextFeedingAt && new Date(pen.nextFeedingAt) < new Date()) {
        return 'Quá giờ';
    }

    switch (pen.feedingStatus) {
        case 'FED': return 'Đã cho ăn';
        case 'OVERDUE': return 'Quá giờ';
        case 'PENDING':
        default: return 'Chờ cho ăn';
    }
}

function getAnimalIcon(animalDef) {
    if (!animalDef) return 'add';

    // Use icon from database or map by category
    if (animalDef.iconName) return animalDef.iconName;

    switch (animalDef.category) {
        case 'LAND': return 'cruelty_free';
        case 'FRESHWATER':
        case 'BRACKISH':
        case 'SALTWATER': return 'set_meal';
        case 'SPECIAL': return 'egg_alt';
        default: return 'pets';
    }
}

// ==================== PEN SELECTION & DETAILS ====================

function selectPen(penId) {
    const pen = allPens.find(p => p.id == penId);
    if (!pen) return;

    selectedPen = pen;

    // Highlight selected card in selector bar
    document.querySelectorAll('.pen-selector-card').forEach(c => c.classList.remove('pen-selector-card--active'));
    const card = document.querySelector(`.pen-selector-card[data-pen-id="${pen.id}"]`);
    if (card) {
        card.classList.add('pen-selector-card--active');
        // Scroll into view
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    // Compute daysOld for growth scaling
    if (pen.startDate) {
        const start = new Date(pen.startDate);
        pen.daysOld = Math.max(0, Math.floor((Date.now() - start) / 86400000));
    } else { pen.daysOld = 0; }

    // Update Canvas simulation — only reload if pen changed
    if (penSimulation) {
        if (!penSimulation.pen || penSimulation.pen.id !== pen.id) {
            penSimulation.loadPen(pen);
        }
    }

    // Update viz info overlay
    const vizInfoText = document.getElementById('pen-viz-info-text');
    if (vizInfoText) {
        const name = pen.animalDefinition ? pen.animalDefinition.name : 'Trống';
        vizInfoText.textContent = `${pen.code} — ${name} (${pen.animalCount || 0})`;
    }

    // Show legend if animals exist
    const legend = document.getElementById('pen-viz-legend');
    if (legend) legend.style.display = (pen.animalCount > 0) ? 'flex' : 'none';

    // Update sidebar details
    updatePenDetails(pen);
}

function updatePenDetails(pen) {
    // Toggle Empty State / Content
    const emptyState = document.getElementById('empty-pen-state');
    const content = document.getElementById('pen-detail-content');
    if (emptyState) emptyState.style.display = 'none';
    if (content) content.style.display = 'block';

    const animalName = pen.animalDefinition ? pen.animalDefinition.name : 'Chưa có vật nuôi';
    const statusBadge = getStatusBadge(pen.status);

    // Update pen info card
    const penInfoIcon = document.getElementById('pen-info-icon');
    if (penInfoIcon) penInfoIcon.textContent = getAnimalIcon(pen.animalDefinition);

    const penInfoName = document.getElementById('pen-info-name');
    if (penInfoName) penInfoName.textContent = `Chuồng ${pen.code} — ${animalName}`;

    const penInfoSub = document.getElementById('pen-info-sub');
    if (penInfoSub) {
        const unit = pen.animalDefinition?.unit || 'con';
        penInfoSub.textContent = `${pen.animalCount || 0} ${unit} · ${getFarmingTypeLabel(pen.farmingType)}`;
    }

    const penInfoBadge = document.getElementById('pen-info-badge');
    if (penInfoBadge) {
        const statusKey = String(pen.status || 'EMPTY').toLowerCase();
        penInfoBadge.className = `pen-info-card__badge pen-info-card__badge--${statusKey}`;
        penInfoBadge.textContent = statusBadge.text;
    }

    // Status control
    const statusControl = document.getElementById('pen-status-control');
    if (statusControl) statusControl.style.display = 'flex';

    const statusSelect = document.getElementById('pen-status-select');
    if (statusSelect) statusSelect.value = String(pen.status || 'EMPTY').toUpperCase();

    // Update stat cards
    const statFeeding = document.getElementById('stat-feeding');
    if (statFeeding) {
        statFeeding.textContent = getFeedingStatusText(pen) || 'N/A';
    }

    const statHealth = document.getElementById('stat-health');
    if (statHealth) {
        const healthMap = { 'CLEAN': 'Tốt', 'DIRTY': 'TB', 'SICK': 'Yếu', 'EMPTY': 'N/A' };
        statHealth.textContent = healthMap[String(pen.status || 'EMPTY').toUpperCase()] || 'N/A';
    }

    const statAge = document.getElementById('stat-age');
    if (statAge) {
        if (pen.startDate) {
            const days = Math.floor((new Date() - new Date(pen.startDate)) / (1000 * 60 * 60 * 24));
            statAge.textContent = days > 0 ? `${days} ngày` : 'Mới';
        } else {
            statAge.textContent = 'N/A';
        }
    }

    const statProgress = document.getElementById('stat-progress');
    if (statProgress) {
        if (pen.startDate && pen.expectedHarvestDate) {
            const total = new Date(pen.expectedHarvestDate) - new Date(pen.startDate);
            const elapsed = new Date() - new Date(pen.startDate);
            const pct = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
            statProgress.textContent = `${pct}%`;
        } else {
            statProgress.textContent = 'N/A';
        }
    }

    // Load Health Records
    loadHealthRecords(pen.id);

    // Load Growth Chart
    loadGrowthChart(pen.id);

    // Update Workflow Buttons State
    updateUIForWorkflow(pen);

    // Unlock Analysis Button
    const btnAnalysis = document.getElementById('btn-livestock-analysis');
    if (btnAnalysis) {
        btnAnalysis.disabled = false;
    }
}

async function handlePenStatusChange(status) {
    if (!selectedPen) return;

    const selectEl = document.getElementById('pen-status-select');
    const prevStatus = String(selectedPen.status || 'EMPTY').toUpperCase();
    const nextStatus = String(status || '').trim().toUpperCase();

    if (!nextStatus) {
        if (selectEl) selectEl.value = prevStatus;
        return;
    }

    if (selectEl) selectEl.disabled = true;

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE_URL}/livestock/pens/${selectedPen.id}/status`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({ status: nextStatus })
        });

        if (response.ok) {
            const updatedPen = await response.json();
            selectedPen.status = updatedPen.status;

            const idx = allPens.findIndex(p => p.id === selectedPen.id);
            if (idx !== -1) allPens[idx].status = updatedPen.status;

            renderPenSelectorBar();
            // Re-highlight selected card
            const selectedCard = document.querySelector(`.pen-selector-card[data-pen-id="${selectedPen.id}"]`);
            if (selectedCard) selectedCard.classList.add('pen-selector-card--active');

            updatePenDetails(selectedPen);
            showNotification('Đã cập nhật tình trạng chuồng', 'success');
        } else {
            let err = {};
            try { err = await response.json(); } catch (e) { }
            showNotification(err.error || 'Không thể cập nhật tình trạng chuồng', 'error');
            if (selectEl) selectEl.value = prevStatus;
        }
    } catch (error) {
        console.error('Error updating pen status:', error);
        showNotification('Lỗi kết nối', 'error');
        if (selectEl) selectEl.value = prevStatus;
    } finally {
        if (selectEl) selectEl.disabled = false;
    }
}

function getFarmingTypeLabel(type) {
    const map = {
        'CAGED': 'Nuôi nhốt',
        'POND': 'Nuôi ao/vuông',
        'FREE_RANGE': 'Thả rong',
        'SPECIAL': 'Đặc biệt'
    };
    return map[type] || type;
}

function getWaterTypeLabel(type) {
    const map = {
        'FRESHWATER': 'Nước ngọt',
        'BRACKISH': 'Nước lợ',
        'SALTWATER': 'Nước mặn'
    };
    return map[type] || type;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('vi-VN');
}

// ==================== DELETE MODAL LOGIC ====================

let pendingDeletePenId = null;

function confirmDeletePen(penId = null) {
    const id = penId || (selectedPen ? selectedPen.id : null);
    if (!id) return;
    pendingDeletePenId = id;

    const modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.add('modal--visible');
}

function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.remove('modal--visible');
    pendingDeletePenId = null;
}

// Bind modal action
function setupDeleteModal() {
    const btn = document.getElementById('confirm-modal-btn');
    if (btn) {
        // Remove old listeners to prevent duplicates (not easy without reference, but cloning works)
        const newBtn = btn.cloneNode(true);
        if (btn.parentNode) btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', async () => {
            if (pendingDeletePenId) {
                await executeDeletePen(pendingDeletePenId);
                closeConfirmModal();
            }
        });
    }
}

async function executeDeletePen(penId) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/pens/${penId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showNotification('Đã xóa chuồng thành công', 'success');
            selectedPen = null;

            // Toggle back to empty state
            const emptyState = document.getElementById('empty-pen-state');
            const content = document.getElementById('pen-detail-content');
            if (emptyState) emptyState.style.display = 'flex';
            if (content) content.style.display = 'none';

            // clear health timeline content
            const timeline = document.getElementById('health-timeline');
            if (timeline) timeline.innerHTML = '';

            // Clear canvas simulation
            if (penSimulation) penSimulation.stop();

            await loadPens();
            renderPenSelectorBar();
        } else {
            showNotification('Không thể xóa chuồng', 'error');
        }
    } catch (error) {
        console.error(error);
        showNotification('Lỗi kết nối', 'error');
    }
}

function getStatusBadge(status) {
    switch (String(status || 'EMPTY').toUpperCase()) {
        case 'SICK': return { class: 'badge--error', text: 'Ốm' };
        case 'DIRTY': return { class: 'badge--warning', text: 'Cần dọn' };
        case 'CLEAN': return { class: 'badge--success', text: 'Sạch' };
        case 'EMPTY':
        default: return { class: 'badge--neutral', text: 'Trống' };
    }
}

// ==================== ADD CAGE MODAL ====================

function openAddCageModal() {
    // Create or show modal
    let modal = document.getElementById('add-cage-modal');
    if (!modal) {
        modal = createAddCageModal();
        document.body.appendChild(modal);
    }

    // Reset form
    resetAddCageForm();

    // Show modal
    modal.classList.add('active');
}

function createAddCageModal() {
    const modal = document.createElement('div');
    modal.id = 'add-cage-modal';
    modal.className = 'modal';

    modal.innerHTML = `
        <div class="modal__content modal__content--lg">
            <div class="modal__header">
                <h3 class="modal__title">
                    <span class="material-symbols-outlined">add_home</span>
                    Thêm chuồng mới
                </h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal__body">
                <!-- Step 1: Farming Type -->
                <div class="form-section" id="step-farming-type">
                    <h4 class="form-section__title">1. Chọn kiểu nuôi</h4>
                    <div class="farming-type-grid">
                        <div class="farming-type-card" data-type="CAGED">
                            <span class="material-symbols-outlined">fence</span>
                            <span>Nuôi nhốt</span>
                            <small>Gia súc, gia cầm</small>
                        </div>
                        <div class="farming-type-card" data-type="POND">
                            <span class="material-symbols-outlined">water</span>
                            <span>Nuôi vuông (ao)</span>
                            <small>Thủy sản</small>
                        </div>
                        <div class="farming-type-card" data-type="FREE_RANGE">
                            <span class="material-symbols-outlined">nature</span>
                            <span>Nuôi thả rong</span>
                            <small>Gia cầm tự do</small>
                        </div>
                        <div class="farming-type-card" data-type="SPECIAL">
                            <span class="material-symbols-outlined">hive</span>
                            <span>Môi trường đặc biệt</span>
                            <small>Ong, tằm, vịt...</small>
                        </div>
                    </div>
                </div>

                <!-- Step 1.5: Water Type (for POND) -->
                <div class="form-section hidden" id="step-water-type">
                    <h4 class="form-section__title">1.5. Chọn loại nước</h4>
                    <div class="water-type-grid">
                        <div class="water-type-card" data-water="FRESHWATER">
                            <span class="material-symbols-outlined">water_drop</span>
                            <span>Nước ngọt</span>
                        </div>
                        <div class="water-type-card" data-water="BRACKISH">
                            <span class="material-symbols-outlined">waves</span>
                            <span>Nước lợ</span>
                        </div>
                        <div class="water-type-card" data-water="SALTWATER">
                            <span class="material-symbols-outlined">sailing</span>
                            <span>Nước mặn</span>
                        </div>
                    </div>
                </div>

                <!-- Step 2: Dimensions -->
                <div class="form-section hidden" id="step-dimensions">
                    <h4 class="form-section__title">2. Kích thước chuồng</h4>
                    <div class="dimension-inputs">
                        <div class="form-group">
                            <label>Mã chuồng</label>
                            <input type="text" id="pen-code" placeholder="VD: A1, B2...">
                        </div>
                        <div class="form-group">
                            <label>Chiều dài (m)</label>
                            <input type="number" id="pen-length" min="1" step="0.1" placeholder="10">
                        </div>
                        <div class="form-group">
                            <label>Chiều rộng (m)</label>
                            <input type="number" id="pen-width" min="1" step="0.1" placeholder="5">
                        </div>
                        <div class="form-group">
                            <label>Diện tích</label>
                            <div class="calculated-area" id="calculated-area">0 m²</div>
                        </div>
                    </div>
                </div>

                <!-- Step 3: Animal Selection -->
                <div class="form-section hidden" id="step-animal">
                    <h4 class="form-section__title">3. Chọn vật nuôi</h4>
                    <div class="animal-grid" id="animal-grid">
                        <!-- Animals will be rendered here -->
                    </div>
                </div>

                <!-- Step 4: Size & Quantity -->
                <div class="form-section hidden" id="step-quantity">
                    <h4 class="form-section__title">4. Kích thước & Số lượng</h4>
                    <div class="size-selection">
                        <div class="size-card" data-size="SMALL">
                            <span>Nhỏ</span>
                            <small id="size-small-info">-</small>
                        </div>
                        <div class="size-card" data-size="MEDIUM">
                            <span>Vừa</span>
                            <small id="size-medium-info">-</small>
                        </div>
                        <div class="size-card" data-size="LARGE">
                            <span>Lớn</span>
                            <small id="size-large-info">-</small>
                        </div>
                    </div>
                    <div class="quantity-input">
                        <label>Số lượng</label>
                        <input type="number" id="animal-quantity" min="1" value="10">
                        <div class="capacity-warning hidden" id="capacity-warning">
                            <span class="material-symbols-outlined">warning</span>
                            <span id="capacity-warning-text">Số lượng vượt quá sức chứa!</span>
                        </div>
                    </div>
                    <div class="expected-info">
                        <div class="info-row">
                            <span>Thời gian nuôi dự kiến:</span>
                            <strong id="expected-duration">- ngày</strong>
                        </div>
                        <div class="info-row">
                            <span>Chi phí mua giống:</span>
                            <strong id="expected-cost">0 ₫</strong>
                        </div>
                        <div class="info-row">
                            <span>Doanh thu dự kiến:</span>
                            <strong id="expected-revenue">0 ₫</strong>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal__footer">
                <button class="btn btn--secondary modal-cancel">Hủy</button>
                <button class="btn btn--primary" id="confirm-add-cage" disabled>
                    <span class="material-symbols-outlined icon-sm">check</span>
                    Xác nhận thêm chuồng
                </button>
            </div>
        </div >
            `;

    // Setup event listeners for modal
    setupModalEventListeners(modal);

    return modal;
}

function setupModalEventListeners(modal) {
    // Farming type selection
    modal.querySelectorAll('.farming-type-card').forEach(card => {
        card.addEventListener('click', () => selectFarmingType(card.dataset.type));
    });

    // Water type selection
    modal.querySelectorAll('.water-type-card').forEach(card => {
        card.addEventListener('click', () => selectWaterType(card.dataset.water));
    });

    // Dimension inputs
    const lengthInput = modal.querySelector('#pen-length');
    const widthInput = modal.querySelector('#pen-width');
    if (lengthInput && widthInput) {
        lengthInput.addEventListener('input', updateCalculatedArea);
        widthInput.addEventListener('input', updateCalculatedArea);
    }

    // Size selection
    modal.querySelectorAll('.size-card').forEach(card => {
        card.addEventListener('click', () => selectAnimalSize(card.dataset.size));
    });

    // Quantity input
    const quantityInput = modal.querySelector('#animal-quantity');
    if (quantityInput) {
        quantityInput.addEventListener('input', () => validateCapacity(false));
    }

    // Confirm button
    const confirmBtn = modal.querySelector('#confirm-add-cage');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmAddCage);
    }

    // Close button
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.modal-cancel').addEventListener('click', closeModal);
}

// ==================== MODAL LOGIC ====================

function resetAddCageForm() {
    selectedFarmingType = null;
    selectedWaterType = null;
    selectedAnimal = null;

    // Reset all sections
    document.querySelectorAll('.form-section').forEach((section, index) => {
        if (index === 0) {
            section.classList.remove('hidden');
        } else {
            section.classList.add('hidden');
        }
    });

    // Reset selections
    document.querySelectorAll('.farming-type-card, .water-type-card, .animal-card, .size-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Reset inputs
    const penCode = document.getElementById('pen-code');
    const penLength = document.getElementById('pen-length');
    const penWidth = document.getElementById('pen-width');
    const quantity = document.getElementById('animal-quantity');

    if (penCode) penCode.value = '';
    if (penLength) penLength.value = '';
    if (penWidth) penWidth.value = '';
    if (quantity) quantity.value = '10';

    // Reset calculated values
    const calculatedArea = document.getElementById('calculated-area');
    if (calculatedArea) calculatedArea.textContent = '0 m²';

    // Hide warnings
    const warning = document.getElementById('capacity-warning');
    if (warning) warning.classList.add('hidden');

    // Disable confirm button
    const confirmBtn = document.getElementById('confirm-add-cage');
    if (confirmBtn) confirmBtn.disabled = true;
}

function selectFarmingType(type) {
    selectedFarmingType = type;
    selectedAnimal = null; // Reset selection
    document.getElementById('step-animal').classList.add('hidden');
    document.getElementById('step-quantity').classList.add('hidden');

    // Update UI
    document.querySelectorAll('.farming-type-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.type === type);
    });

    // Show water type for POND, otherwise show dimensions
    const waterStep = document.getElementById('step-water-type');
    const dimensionStep = document.getElementById('step-dimensions');

    if (type === 'POND') {
        waterStep.classList.remove('hidden');
        dimensionStep.classList.add('hidden');
    } else {
        waterStep.classList.add('hidden');
        dimensionStep.classList.remove('hidden');
        selectedWaterType = null;

        // Show animal selection after dimensions are shown
        renderAnimalGrid();
    }
}

function selectWaterType(waterType) {
    selectedWaterType = waterType;
    selectedAnimal = null; // Reset selection
    document.getElementById('step-animal').classList.add('hidden');
    document.getElementById('step-quantity').classList.add('hidden');

    // Update UI
    document.querySelectorAll('.water-type-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.water === waterType);
    });

    // Show dimensions
    document.getElementById('step-dimensions').classList.remove('hidden');

    // Render animals filtered by water type
    renderAnimalGrid();
}

function updateCalculatedArea() {
    const length = parseFloat(document.getElementById('pen-length').value) || 0;
    const width = parseFloat(document.getElementById('pen-width').value) || 0;
    const area = length * width;

    document.getElementById('calculated-area').textContent = `${area.toFixed(1)} m²`;

    // Show animal section if we have dimensions
    if (area > 0) {
        document.getElementById('step-animal').classList.remove('hidden');
    }

    // Recalculate capacity if animal is selected
    if (selectedAnimal) {
        validateCapacity(true);
    }
}

// ==================== HEALTH & EVENTS ====================

async function loadHealthRecords(penId) {
    const container = document.getElementById('health-timeline');
    if (!container) return;

    container.innerHTML = '<p class="health-timeline__empty">Đang tải...</p>';

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/pens/${penId}/health`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const records = await response.json();
            renderHealthRecords(records);
        } else {
            container.innerHTML = '<p class="health-timeline__empty" style="color:var(--color-error)">Lỗi tải dữ liệu</p>';
        }
    } catch (error) {
        console.error('Error loading health records:', error);
        container.innerHTML = '<p class="health-timeline__empty" style="color:var(--color-error)">Lỗi kết nối</p>';
    }
}

function renderHealthRecords(records) {
    const container = document.getElementById('health-timeline');
    if (!container) return;
    container.innerHTML = '';

    if (records.length === 0) {
        container.innerHTML = '<p class="health-timeline__empty">Chưa có dữ liệu sức khỏe</p>';
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    records.forEach(record => {
        const item = document.createElement('div');
        item.className = 'health-timeline__item';

        let dotClass = 'health-timeline__dot--upcoming';
        let statusText = 'Sắp tới';
        let badgeClass = 'health-timeline__badge--upcoming';

        const eventDate = new Date(record.eventDate);
        eventDate.setHours(0, 0, 0, 0);

        if (record.status === 'COMPLETED') {
            dotClass = 'health-timeline__dot--completed';
            statusText = 'Đã xong';
            badgeClass = 'health-timeline__badge--completed';
        } else if (eventDate < today) {
            dotClass = 'health-timeline__dot--overdue';
            statusText = 'Quá hạn';
            badgeClass = 'health-timeline__badge--overdue';
        }

        const dateStr = eventDate.toLocaleDateString('vi-VN');

        item.innerHTML = `
            <div class="health-timeline__item-info">
                <span class="health-timeline__dot ${dotClass}"></span>
                <div>
                    <p class="health-timeline__item-name">${record.name}</p>
                    <p class="health-timeline__item-date">${dateStr}</p>
                </div>
            </div>
            <span class="health-timeline__badge ${badgeClass}">${statusText}</span>
        `;

        item.addEventListener('click', () => toggleHealthStatus(record));
        container.appendChild(item);
    });
}

async function toggleHealthStatus(record) {
    if (record.status === 'COMPLETED') return; // Already done

    if (confirm(`Xác nhận đã hoàn thành: ${record.name}?`)) {
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            const response = await fetch(`${API_BASE_URL}/livestock/health/${record.id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ status: 'COMPLETED' })
            });

            if (response.ok) {
                // Reload
                loadHealthRecords(record.penId);
            }
        } catch (e) {
            console.error(e);
        }
    }
}

// Existing renderAnimalGrid function below...
function renderAnimalGrid() {
    const grid = document.getElementById('animal-grid');
    if (!grid) return;

    grid.innerHTML = '';
    grid.classList.remove('hidden');

    // Hide selected view if it exists
    const selectedView = document.getElementById('selected-animal-view');
    if (selectedView) selectedView.classList.add('hidden');

    // Strict filter: only compatible animals
    const compatibleAnimals = allAnimals.filter(animal => {
        const types = JSON.parse(animal.farmingTypes || '[]');
        const isCompatible = types.includes(selectedFarmingType);
        const matchesWater = selectedFarmingType !== 'POND' || !selectedWaterType || animal.waterType === selectedWaterType;
        return isCompatible && matchesWater;
    });

    if (compatibleAnimals.length === 0) {
        grid.innerHTML = '<div style="text-align: center; color: var(--color-text-secondary); padding: 20px;">Không có vật nuôi phù hợp với kiểu chuồng này</div>';
        return;
    }

    compatibleAnimals.forEach(animal => {
        const card = document.createElement('div');
        card.className = 'animal-card';
        card.dataset.animalId = animal.id;

        const icon = animal.iconName || 'pets';
        const price = formatCurrency(animal.buyPricePerUnit);

        card.innerHTML = `
            <span class="material-symbols-outlined animal-card__icon">${icon}</span>
            <span class="animal-card__name">${animal.name}</span>
            <small class="animal-card__price">${price}/${animal.unit || 'con'}</small>
        `;

        card.addEventListener('click', () => selectAnimal(animal));
        grid.appendChild(card);
    });

    document.getElementById('step-animal').classList.remove('hidden');
}

function selectAnimal(animal) {
    selectedAnimal = animal;

    // Hide grid
    const grid = document.getElementById('animal-grid');
    grid.classList.add('hidden');

    // Show selected view
    let selectedView = document.getElementById('selected-animal-view');
    if (!selectedView) {
        selectedView = document.createElement('div');
        selectedView.id = 'selected-animal-view';
        // Add basic styles directly or via class
        selectedView.style.display = 'flex';
        selectedView.style.flexDirection = 'column';
        selectedView.style.gap = '10px';
        grid.after(selectedView);
    }
    selectedView.classList.remove('hidden');

    const icon = animal.iconName || 'pets';
    const price = formatCurrency(animal.buyPricePerUnit);

    selectedView.innerHTML = `
        <div class="animal-card selected" style="cursor: default">
            <span class="material-symbols-outlined animal-card__icon" style="color: var(--color-primary);">${icon}</span>
            <span class="animal-card__name">${animal.name}</span>
            <small class="animal-card__price">${price}/${animal.unit || 'con'}</small>
            <span class="material-symbols-outlined" style="color: var(--color-primary);">check_circle</span>
        </div>
        <button class="btn btn--sm btn--secondary" id="reselect-animal-btn" style="align-self: flex-start;">
            <span class="material-symbols-outlined icon-sm">arrow_back</span> Chọn loài khác
        </button>
    `;

    document.getElementById('reselect-animal-btn').addEventListener('click', () => {
        selectedAnimal = null;
        document.getElementById('step-quantity').classList.add('hidden');
        document.getElementById('selected-animal-view').classList.add('hidden');
        renderAnimalGrid();
    });

    // Show quantity section
    document.getElementById('step-quantity').classList.remove('hidden');

    // Update size info
    updateSizeInfo(animal);

    // Update expected info
    updateExpectedInfo();

    // Validate capacity
    validateCapacity(true);
}

function updateSizeInfo(animal) {
    try {
        const sizes = JSON.parse(animal.sizes || '{}');

        ['small', 'medium', 'large'].forEach(size => {
            const el = document.getElementById(`size-${size}-info`);
            if (el && sizes[size]) {
                el.textContent = `${sizes[size].weight} - ${formatCurrency(sizes[size].buyPrice)}`;
            }
        });
    } catch (e) {
        console.error('Error parsing sizes:', e);
    }
}

function selectAnimalSize(size) {
    // Update UI
    document.querySelectorAll('.size-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.size === size);
    });

    updateExpectedInfo();
    validateCapacity();
}

function updateExpectedInfo() {
    if (!selectedAnimal) return;

    const quantity = parseInt(document.getElementById('animal-quantity').value) || 0;
    const duration = selectedAnimal.growthDurationDays || 0;

    // Get price based on size
    const size = document.querySelector('.size-card.selected')?.dataset.size.toLowerCase() || 'medium';
    let buyPrice = selectedAnimal.buyPricePerUnit || 0;
    let sellPrice = selectedAnimal.sellPricePerUnit || 0;

    try {
        const sizes = JSON.parse(selectedAnimal.sizes || '{}');
        if (sizes[size]) {
            buyPrice = sizes[size].buyPrice || buyPrice;
            sellPrice = sizes[size].sellPrice || sellPrice;
        }
    } catch (e) {
        console.error('Error parsing sizes for price:', e);
    }

    document.getElementById('expected-duration').textContent = `${duration} ngày`;
    document.getElementById('expected-cost').textContent = formatCurrency(buyPrice * quantity);
    document.getElementById('expected-revenue').textContent = formatCurrency(sellPrice * quantity);

    // Enable confirm button
    const confirmBtn = document.getElementById('confirm-add-cage');
    const isValid = selectedAnimal && quantity > 0 && document.getElementById('pen-code').value;
    confirmBtn.disabled = !isValid;
}

async function validateCapacity(autoFill = false) {
    if (!selectedAnimal) return;

    const length = parseFloat(document.getElementById('pen-length').value) || 0;
    const width = parseFloat(document.getElementById('pen-width').value) || 0;
    // If auto-filling, don't rely on current input for calculation
    let quantity = parseInt(document.getElementById('animal-quantity').value) || 0;

    if (length <= 0 || width <= 0) return;

    const result = await calculateCapacity({
        lengthM: length,
        widthM: width,
        animalDefinitionId: selectedAnimal.id,
        animalCount: quantity
    });

    if (result) {
        // Auto-fill quantity if requested
        if (autoFill && result.maxCapacity > 0) {
            document.getElementById('animal-quantity').value = result.maxCapacity;
            quantity = result.maxCapacity; // Update local var for validation

            // Also show info about density
            const warning = document.getElementById('capacity-warning');
            warning.classList.remove('hidden');
            warning.className = 'capacity-warning'; // Reset class (remove error styling)
            warning.style.background = 'rgba(16, 185, 129, 0.1)';
            warning.style.border = '1px solid rgba(16, 185, 129, 0.2)';
            warning.style.color = '#10b981';
            document.getElementById('capacity-warning-text').textContent = `Mật độ tối đa: ${result.maxCapacity} ${selectedAnimal.unit || 'con'}`;
        } else {
            // Validation mode
            const warning = document.getElementById('capacity-warning');
            if (result.isOverCapacity) {
                warning.classList.remove('hidden');
                warning.className = 'capacity-warning'; // Reset
                warning.removeAttribute('style'); // Use default error styles
                document.getElementById('capacity-warning-text').textContent = result.warning;
            } else {
                // If valid and not auto-filling, hide warning or show usage
                warning.classList.add('hidden');
            }
        }
    }

    updateExpectedInfo();
}

async function confirmAddCage() {
    const penCode = document.getElementById('pen-code').value;
    const length = parseFloat(document.getElementById('pen-length').value);
    const width = parseFloat(document.getElementById('pen-width').value);
    const quantity = parseInt(document.getElementById('animal-quantity').value);
    const size = document.querySelector('.size-card.selected')?.dataset.size || 'MEDIUM';

    if (!penCode || !length || !width || !selectedAnimal) {
        showNotification('Vui lòng điền đầy đủ thông tin', 'error');
        return;
    }

    const penData = {
        farmId: currentFarmId,
        code: penCode,
        farmingType: selectedFarmingType,
        waterType: selectedWaterType,
        lengthM: length,
        widthM: width,
        animalDefinitionId: selectedAnimal.id,
        animalCount: quantity,
        animalSize: size
    };

    await createPen(penData);
}

function closeModal() {
    const modal = document.getElementById('add-cage-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// ==================== UTILITY FUNCTIONS ====================

function formatCurrency(value) {
    if (!value) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0
    }).format(value);
}

function showNotification(message, type = 'info') {
    // Use existing notification system or create simple one
    if (window.showToast) {
        window.showToast(message, type);
    } else {
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.innerHTML = `
            <span class="material-symbols-outlined">${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}</span>
            <span>${message}</span>
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast--visible');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('toast--visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// ==================== ENHANCED FEEDING & GROWTH LOGIC ====================

let currentFeedItems = [];           // Old system - from inventory
let compatibleFeeds = [];            // New system - from feed definitions
let selectedFeedDefinitionId = null;
let currentFeedingPenId = null;
let recommendedAmount = 0;

async function openFeedingModal() {
    if (!selectedPen || !selectedPen.id) {
        showNotification('Vui lòng chọn chuồng trước', 'warning');
        return;
    }

    if (!selectedPen.animalCount || selectedPen.animalCount <= 0) {
        showNotification('Chuồng không có vật nuôi để cho ăn', 'warning');
        return;
    }

    currentFeedingPenId = selectedPen.id;
    selectedFeedDefinitionId = null;
    recommendedAmount = 0;

    const modal = document.getElementById('feeding-modal');
    modal.classList.add('modal--visible');

    // Update pen info display
    document.getElementById('feed-pen-code').textContent = selectedPen.code || '--';
    document.getElementById('feed-animal-name').textContent = selectedPen.animalDefinition?.name || '--';
    document.getElementById('feed-animal-count').textContent = `${selectedPen.animalCount || 0} ${selectedPen.animalDefinition?.unit || 'con'}`;

    // Load compatible feeds
    await loadCompatibleFeeds(selectedPen.animalDefinition?.id);
}

function closeFeedingModal() {
    document.getElementById('feeding-modal').classList.remove('modal--visible');
    // Reset form
    selectedFeedDefinitionId = null;
    recommendedAmount = 0;
    const amount = document.getElementById('feed-amount');
    if (amount) amount.value = "";
    const notes = document.getElementById('feed-notes');
    if (notes) notes.value = "";

    // Remove "choose another" button if present
    const chooseAnotherBtn = document.getElementById('feed-choose-another-btn');
    if (chooseAnotherBtn) chooseAnotherBtn.remove();

    // Reset cost preview
    document.getElementById('feed-unit-price').textContent = '0 ₫/kg';
    document.getElementById('feed-total-cost').textContent = '0 ₫';
    document.getElementById('feed-recommended-text').textContent = 'Chọn thức ăn để xem đề xuất';
}

async function loadCompatibleFeeds(animalDefinitionId) {
    const grid = document.getElementById('feed-selection-grid');
    grid.innerHTML = `
        <div class="feed-loading">
            <span class="material-symbols-outlined rotating">sync</span>
            Đang tải...
        </div>
    `;

    if (!animalDefinitionId) {
        grid.innerHTML = '<p style="grid-column: span 2; text-align: center; color: var(--color-text-secondary);">Không xác định được loại vật nuôi</p>';
        return;
    }

    try {
        // Load compatible feeds from new API
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(`${API_BASE_URL}/feeding/compatible/${animalDefinitionId}`, { headers });
        if (!response.ok) throw new Error("Failed to fetch compatible feeds");
        compatibleFeeds = await response.json();

        if (compatibleFeeds.length === 0) {
            grid.innerHTML = '<p style="grid-column: span 2; text-align: center; color: var(--color-text-secondary);">Không có thức ăn phù hợp. Vui lòng thêm dữ liệu thức ăn.</p>';
            return;
        }

        // Also fetch all feed definitions to show which are incompatible
        const allFeedsResponse = await fetch(`${API_BASE_URL}/feeding/definitions`, { headers });
        let allFeeds = [];
        if (allFeedsResponse.ok) {
            allFeeds = await allFeedsResponse.json();
        }

        // Get compatible feed IDs
        const compatibleFeedIds = new Set(compatibleFeeds.map(f => f.feedDefinitionId));

        // Render only compatible feed items (hide incompatible ones)
        grid.innerHTML = '';

        if (compatibleFeeds.length === 0) {
            grid.innerHTML = '<p style="grid-column: span 2; text-align: center; color: var(--color-text-secondary);">Không có thức ăn phù hợp với loại vật nuôi này</p>';
            return;
        }

        compatibleFeeds.forEach(feed => {
            grid.appendChild(createFeedItem(feed, true));
        });

    } catch (e) {
        console.error("Error loading feeds:", e);
        grid.innerHTML = '<p style="grid-column: span 2; text-align: center; color: var(--color-error);">Lỗi tải danh sách thức ăn</p>';

        // Fallback to old system
        await fetchFeedItemsFallback();
    }
}

function createFeedItem(feed, isCompatible) {
    const div = document.createElement('div');
    div.className = `feed-item${feed.isPrimary ? ' feed-item--primary' : ''}`;
    div.setAttribute('data-feed-id', feed.feedDefinitionId);
    div.setAttribute('data-price', feed.pricePerUnit || 0);
    div.setAttribute('data-daily-amount', feed.dailyAmountPerUnit || 0);
    div.setAttribute('data-frequency', feed.feedingFrequency || 2);

    const iconName = feed.iconName || 'restaurant';
    const priceFormatted = formatCurrency(feed.pricePerUnit || 0);
    const protein = feed.proteinPercent ? `${feed.proteinPercent}% đạm` : '';

    div.innerHTML = `
        <div class="feed-item__header">
            <div class="feed-item__icon">
                <span class="material-symbols-outlined">${iconName}</span>
            </div>
            <span class="feed-item__name">${feed.feedName}</span>
        </div>
        <div class="feed-item__details">
            <span class="feed-item__tag">
                <span class="material-symbols-outlined">payments</span>
                ${priceFormatted}/${feed.unit || 'kg'}
            </span>
            ${protein ? `<span class="feed-item__tag">${protein}</span>` : ''}
            <span class="feed-item__tag">
                <span class="material-symbols-outlined">schedule</span>
                ${feed.feedingFrequency || 2}x/ngày
            </span>
        </div>
    `;

    div.addEventListener('click', () => selectFeed(feed));
    return div;
}

function createIncompatibleFeedItem(feed) {
    const div = document.createElement('div');
    div.className = 'feed-item feed-item--disabled';

    const iconName = feed.iconName || 'restaurant';
    const priceFormatted = formatCurrency(feed.pricePerUnit || 0);

    div.innerHTML = `
        <div class="feed-item__header">
            <div class="feed-item__icon">
                <span class="material-symbols-outlined">${iconName}</span>
            </div>
            <span class="feed-item__name">${feed.name}</span>
        </div>
        <div class="feed-item__details">
            <span class="feed-item__tag">
                <span class="material-symbols-outlined">block</span>
                Không phù hợp
            </span>
        </div>
    `;

    div.addEventListener('click', () => {
        showNotification('Thức ăn này không phù hợp với loại vật nuôi đang chọn', 'warning');
    });

    return div;
}

function selectFeed(feed) {
    // Clear previous selection
    document.querySelectorAll('.feed-item').forEach(item => {
        item.classList.remove('feed-item--selected');
    });

    // Mark selected
    const selectedItem = document.querySelector(`[data-feed-id="${feed.feedDefinitionId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('feed-item--selected');
    }

    selectedFeedDefinitionId = feed.feedDefinitionId;

    // Calculate recommended amount
    const animalCount = selectedPen?.animalCount || 0;
    const dailyAmount = parseFloat(feed.dailyAmountPerUnit) || 0;
    const frequency = parseInt(feed.feedingFrequency) || 2;

    recommendedAmount = (dailyAmount * animalCount / frequency).toFixed(3);

    // Update hints
    const hintText = `Đề xuất: ${recommendedAmount} kg/lần (${dailyAmount} kg/con/ngày × ${animalCount} con ÷ ${frequency} lần)`;
    document.getElementById('feed-recommended-text').textContent = hintText;

    // Update price display
    const pricePerUnit = parseFloat(feed.pricePerUnit) || 0;
    document.getElementById('feed-unit-price').textContent = formatCurrency(pricePerUnit) + '/kg';

    // Show "choose another" button
    let chooseAnotherBtn = document.getElementById('feed-choose-another-btn');
    if (!chooseAnotherBtn) {
        chooseAnotherBtn = document.createElement('button');
        chooseAnotherBtn.id = 'feed-choose-another-btn';
        chooseAnotherBtn.type = 'button';
        chooseAnotherBtn.className = 'btn btn--outline btn--sm feed-choose-another';
        chooseAnotherBtn.innerHTML = '<span class="material-symbols-outlined">swap_horiz</span> Chọn lại';
        chooseAnotherBtn.addEventListener('click', () => {
            // Deselect current feed
            selectedFeedDefinitionId = null;
            recommendedAmount = 0;
            document.querySelectorAll('.feed-item').forEach(item => {
                item.classList.remove('feed-item--selected');
                item.style.display = '';
            });
            chooseAnotherBtn.remove();
            document.getElementById('feed-recommended-text').textContent = 'Chọn thức ăn để xem đề xuất';
            document.getElementById('feed-unit-price').textContent = '0 ₫/kg';
            document.getElementById('feed-total-cost').textContent = '0 ₫';
            document.getElementById('feed-amount').value = '';
        });
        const grid = document.getElementById('feed-selection-grid');
        grid.parentElement.insertBefore(chooseAnotherBtn, grid.nextSibling);
    }

    // Update total cost preview
    updateFeedCostPreview();
}

function fillRecommendedAmount() {
    if (!selectedFeedDefinitionId) {
        showNotification('Vui lòng chọn loại thức ăn trước', 'warning');
        return;
    }

    document.getElementById('feed-amount').value = recommendedAmount;
    updateFeedCostPreview();
}

function updateFeedCostPreview() {
    const amount = parseFloat(document.getElementById('feed-amount').value) || 0;

    if (!selectedFeedDefinitionId) {
        document.getElementById('feed-total-cost').textContent = '0 ₫';
        return;
    }

    const selectedItem = document.querySelector(`[data-feed-id="${selectedFeedDefinitionId}"]`);
    const pricePerUnit = parseFloat(selectedItem?.dataset?.price) || 0;
    const totalCost = amount * pricePerUnit;

    document.getElementById('feed-total-cost').textContent = formatCurrency(totalCost);
}

// Add event listener for amount input
document.addEventListener('DOMContentLoaded', () => {
    const feedAmountInput = document.getElementById('feed-amount');
    if (feedAmountInput) {
        feedAmountInput.addEventListener('input', updateFeedCostPreview);
    }
});

async function submitFeeding() {
    const amount = parseFloat(document.getElementById('feed-amount').value);
    const notes = document.getElementById('feed-notes').value;

    if (!selectedFeedDefinitionId) {
        showNotification("Vui lòng chọn loại thức ăn", "error");
        return;
    }

    if (!amount || amount <= 0) {
        showNotification("Vui lòng nhập số lượng hợp lệ", "error");
        return;
    }

    // Get selected feed name for inventory check
    const selectedFeedItem = document.querySelector('.feed-def-item.selected');
    const feedName = selectedFeedItem ? selectedFeedItem.querySelector('.feed-def__name')?.textContent || 'thức ăn' : 'thức ăn';

    // Check inventory first
    await loadLivestockInventory();
    const invCheck = checkLivestockInventory('THUC_AN', feedName, amount);

    if (!invCheck.hasEnough) {
        closeFeedingModal();
        showLivestockInventoryShortageModal(
            feedName,
            invCheck.available,
            amount,
            'THUC_AN',
            feedName
        );
        return;
    }

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const userEmail = localStorage.getItem('userEmail');
        const response = await fetch(`${API_BASE_URL}/feeding/feed`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                penId: currentFeedingPenId,
                feedDefinitionId: selectedFeedDefinitionId,
                amountKg: amount,
                notes: notes,
                userEmail: userEmail
            })
        });

        if (!response.ok) {
            const txt = await response.text();
            throw new Error(txt);
        }

        const result = await response.json();
        const costText = result.cost ? ` - Chi phí: ${formatCurrency(result.cost)}` : '';
        showNotification(`Đã ghi nhận cho ăn thành công!${costText}`, "success");
        // Trigger feeding animation on canvas
        if (penSimulation) penSimulation.triggerFeeding();
        closeFeedingModal();

        // Refresh inventory after use
        await loadLivestockInventory();

        // Refresh pen data to update feeding status
        await loadPens();
        renderPenSelectorBar();

        // Reload pen details if still viewing
        if (selectedPen && selectedPen.id === currentFeedingPenId) {
            updatePenDetails(allPens.find(p => p.id === currentFeedingPenId));
        }

        // Refresh growth chart / details
        loadGrowthChart(currentFeedingPenId);
    } catch (e) {
        showNotification("Lỗi: " + e.message, "error");
    }
}

// Fallback to old inventory-based system if new system fails
async function fetchFeedItemsFallback() {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/feeding/items`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (!response.ok) throw new Error("Failed to fetch feed");
        currentFeedItems = await response.json();

        const grid = document.getElementById('feed-selection-grid');
        grid.innerHTML = '';

        if (currentFeedItems.length === 0) {
            grid.innerHTML = '<p style="grid-column: span 2; text-align: center;">Không có thức ăn trong kho</p>';
            return;
        }

        currentFeedItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'feed-item';
            div.setAttribute('data-feed-item-id', item.id);
            div.setAttribute('data-stock', item.quantity);
            div.innerHTML = `
                <div class="feed-item__header">
                    <div class="feed-item__icon">
                        <span class="material-symbols-outlined">inventory_2</span>
                    </div>
                    <span class="feed-item__name">${item.name}</span>
                </div>
                <div class="feed-item__details">
                    <span class="feed-item__tag">Tồn: ${item.quantity} ${item.unit || 'kg'}</span>
                </div>
            `;
            div.addEventListener('click', () => selectFeedItemFromInventory(item));
            grid.appendChild(div);
        });
    } catch (e) {
        showNotification("Lỗi tải danh sách thức ăn: " + e.message, "error");
    }
}

function selectFeedItemFromInventory(item) {
    // For fallback inventory system
    document.querySelectorAll('.feed-item').forEach(el => el.classList.remove('feed-item--selected'));
    const selected = document.querySelector(`[data-feed-item-id="${item.id}"]`);
    if (selected) selected.classList.add('feed-item--selected');

    // Store for submission
    selectedFeedDefinitionId = null; // Clear new system
    window.selectedFeedItemId = item.id;
}

async function loadGrowthChart(penId) {
    const container = document.getElementById('weight-chart');
    if (!container) return;

    // Clear previous
    container.innerHTML = '<div class="loading-spinner"></div>';

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/feeding/growth/${penId}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (response.ok) {
            const data = await response.json();

            // If data is empty, maybe create fake data for demo if requested? 
            // Or just check feeding logs to show something?
            // For now, if empty, show placeholder.

            if (data.length === 0) {
                container.innerHTML = '<p class="text-muted" style="text-align:center; padding: 20px;">Chưa có dữ liệu cân nặng</p>';
                return;
            }

            // Sort by date
            data.sort((a, b) => new Date(a.recordedDate) - new Date(b.recordedDate));

            const labels = data.map(d => formatDate(d.recordedDate));
            const values = data.map(d => d.avgWeightKg);

            Charts.createLineChart(container, {
                data: values,
                labels: labels,
                color: '#10b981', // Emerald 500
                height: 160,
                showDots: true,
                fill: true
            });
        } else {
            container.innerHTML = '<p class="text-error">Không thể tải biểu đồ</p>';
        }
    } catch (e) {
        console.error("Chart error:", e);
        container.innerHTML = '<p class="text-error">Lỗi tải dữ liệu</p>';
    }
}

// Window exports consolidated at end of file

// ==================== HARVEST/SELL LOGIC ====================

let harvestPenData = null;

function openHarvestModal() {
    if (!selectedPen || !selectedPen.id) {
        showNotification('Vui lòng chọn chuồng trước', 'warning');
        return;
    }

    if (!selectedPen.animalCount || selectedPen.animalCount <= 0) {
        showNotification('Chuồng không có vật nuôi để bán', 'warning');
        return;
    }

    harvestPenData = selectedPen;

    // Populate summary
    const animalName = selectedPen.animalDefinition?.name || 'Không xác định';
    const currentCount = selectedPen.animalCount || 0;
    const startDate = formatDate(selectedPen.startDate);
    const refPrice = selectedPen.animalDefinition?.sellPricePerUnit || 0;

    document.getElementById('harvest-animal-name').textContent = animalName;
    document.getElementById('harvest-current-count').textContent = `${currentCount} ${selectedPen.animalDefinition?.unit || 'con'}`;
    document.getElementById('harvest-start-date').textContent = startDate;
    document.getElementById('harvest-ref-price').textContent = formatCurrency(refPrice) + `/${selectedPen.animalDefinition?.unit || 'con'}`;

    // Set max quantity hint
    document.getElementById('harvest-quantity-hint').textContent = `Tối đa: ${currentCount} ${selectedPen.animalDefinition?.unit || 'con'}`;

    // Pre-fill price with reference price
    document.getElementById('harvest-price').value = refPrice;
    document.getElementById('harvest-quantity').value = '';
    document.getElementById('harvest-quantity').max = currentCount;
    document.getElementById('harvest-buyer').value = '';
    document.getElementById('harvest-notes').value = '';

    // Reset preview
    updateHarvestPreview();

    // Show modal
    const modal = document.getElementById('harvest-modal');
    modal.classList.add('modal--visible');

    // Setup event listeners for live preview
    document.getElementById('harvest-quantity').addEventListener('input', updateHarvestPreview);
    document.getElementById('harvest-price').addEventListener('input', updateHarvestPreview);
}

function closeHarvestModal() {
    const modal = document.getElementById('harvest-modal');
    modal.classList.remove('modal--visible');
    harvestPenData = null;

    // Remove listeners
    document.getElementById('harvest-quantity').removeEventListener('input', updateHarvestPreview);
    document.getElementById('harvest-price').removeEventListener('input', updateHarvestPreview);
}

function updateHarvestPreview() {
    const quantity = parseInt(document.getElementById('harvest-quantity').value) || 0;
    const price = parseFloat(document.getElementById('harvest-price').value) || 0;
    const total = quantity * price;
    const maxCount = harvestPenData?.animalCount || 0;

    document.getElementById('preview-quantity').textContent = `${quantity} ${harvestPenData?.animalDefinition?.unit || 'con'}`;
    document.getElementById('preview-price').textContent = formatCurrency(price);
    document.getElementById('preview-total').textContent = formatCurrency(total);

    // Enable/disable submit button
    const submitBtn = document.getElementById('harvest-submit-btn');
    const isValid = quantity > 0 && quantity <= maxCount && price > 0;
    submitBtn.disabled = !isValid;

    // Show warning if exceeds
    const hint = document.getElementById('harvest-quantity-hint');
    if (quantity > maxCount) {
        hint.textContent = `⚠️ Vượt quá số lượng! Tối đa: ${maxCount}`;
        hint.style.color = '#dc2626';
    } else {
        hint.textContent = `Tối đa: ${maxCount} ${harvestPenData?.animalDefinition?.unit || 'con'}`;
        hint.style.color = '';
    }
}

async function submitHarvest() {
    if (!harvestPenData) return;

    const quantity = parseInt(document.getElementById('harvest-quantity').value);
    const price = parseFloat(document.getElementById('harvest-price').value);
    const buyer = document.getElementById('harvest-buyer').value;
    const notes = document.getElementById('harvest-notes').value;

    if (!quantity || quantity <= 0) {
        showNotification('Vui lòng nhập số lượng hợp lệ', 'error');
        return;
    }

    if (quantity > harvestPenData.animalCount) {
        showNotification('Số lượng vượt quá số con hiện có', 'error');
        return;
    }

    if (!price || price <= 0) {
        showNotification('Vui lòng nhập giá bán hợp lệ', 'error');
        return;
    }

    const submitBtn = document.getElementById('harvest-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-symbols-outlined icon-sm rotating">sync</span> Đang xử lý...';

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/pens/${harvestPenData.id}/harvest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                quantity: quantity,
                pricePerUnit: price,
                buyer: buyer,
                notes: notes,
                animalName: harvestPenData.animalDefinition?.name || 'Vật nuôi'
            })
        });

        const result = await response.json();

        if (response.ok) {
            const totalRevenue = quantity * price;
            showNotification(`🎉 Bán thành công! +${formatCurrency(totalRevenue)} đã được cộng vào tài khoản`, 'success');

            closeHarvestModal();

            // Reload pen data
            await loadPens();
            renderPenSelectorBar();

            // Update detail panel if still viewing same pen
            if (selectedPen && selectedPen.id === harvestPenData.id) {
                const updatedPen = allPens.find(p => p.id === harvestPenData.id);
                if (updatedPen) {
                    selectedPen = updatedPen;
                    updatePenDetails(updatedPen);
                } else {
                    // Pen might be empty now, reset view
                    const emptyState = document.getElementById('empty-pen-state');
                    const content = document.getElementById('pen-detail-content');
                    if (emptyState) emptyState.style.display = 'flex';
                    if (content) content.style.display = 'none';
                    selectedPen = null;
                }
            }
        } else {
            showNotification(result.error || 'Lỗi khi bán vật nuôi', 'error');
        }
    } catch (error) {
        console.error('Harvest error:', error);
        showNotification('Lỗi kết nối server', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-symbols-outlined icon-sm">check_circle</span> Xác nhận bán';
    }
}

// Make harvest functions global
// Window exports consolidated at end of file

// ==================== WORKFLOW UI LOGIC ====================

function updateUIForWorkflow(pen) {
    // Buttons
    const btnSelect = document.getElementById('btn-select-animal');
    const btnFeed = document.getElementById('btn-feed');
    const btnClean = document.getElementById('btn-clean');
    const btnVaccine = document.getElementById('btn-vaccine');
    const btnHarvest = document.getElementById('btn-harvest');
    const btnDelete = document.getElementById('btn-delete-pen');

    // Reset default
    [btnFeed, btnClean, btnVaccine, btnHarvest].forEach(btn => disableButton(btn));
    enableButton(btnDelete); // Always allow delete

    if (!pen.animalCount || pen.animalCount === 0) {
        // Empty State: Step 1 active
        enableButton(btnSelect);
        enableButton(btnDelete);
    } else {
        // Occupied State
        disableButton(btnSelect);

        // Feeing button restriction (bees, silkworms)
        const name = (pen.animalDefinition?.name || '').toLowerCase();
        if (name.includes('ong') || name.includes('tằm')) {
            disableButton(btnFeed);
        } else {
            enableButton(btnFeed);
        }

        enableButton(btnClean);
        enableButton(btnVaccine);
        enableButton(btnHarvest);
    }
}

function enableButton(btn) {
    if (!btn) return;
    btn.disabled = false;
    btn.classList.remove('action-btn--disabled');
}

function disableButton(btn) {
    if (!btn) return;
    btn.disabled = true;
    btn.classList.add('action-btn--disabled');
}

// ==================== NEW ACTIONS ====================

async function cleanPen() {
    if (!selectedPen) return;
    if (selectedPen.status === 'CLEAN') {
        showNotification('Chuồng đang sạch sẽ', 'info');
        return;
    }

    if (!confirm('Xác nhận vệ sinh chuồng này?')) return;

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/pens/${selectedPen.id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'CLEAN' })
        });

        if (response.ok) {
            showNotification('🧹 Đã vệ sinh chuồng sạch sẽ!', 'success');
            // Trigger cleaning animation on canvas
            if (penSimulation) penSimulation.triggerCleaning();
            await loadPens();
            renderPenSelectorBar();
            if (selectedPen) updatePenDetails(allPens.find(p => p.id === selectedPen.id));
        } else {
            showNotification('Lỗi khi vệ sinh', 'error');
        }
    } catch (e) {
        console.error(e);
        showNotification('Lỗi kết nối', 'error');
    }
}

function openVaccineModal() {
    showNotification('Tính năng Tiêm phòng đang phát triển', 'info');
}

function openVaccineScheduleModal() {
    showNotification('Tính năng Lịch tiêm đang phát triển', 'info');
}

// ==================== NOTIFICATION SYSTEM (Upgraded) ====================
// Overrides features.js notification functions for livestock page

let currentNotifFilter = 'all';
let cachedNotifications = [];

function toggleNotificationPanel() {
    const panel = document.getElementById('notification-panel');
    if (panel) {
        closeOtherPanels('notification-panel');
        panel.classList.toggle('open');
        updateFeatureOverlay();
        if (panel.classList.contains('open')) {
            renderNotifications();
            // Mark that user has seen notifications — clear badge
            markNotificationsSeen();
        }
    }
}

async function renderNotifications() {
    const container = document.getElementById('notification-list');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;padding:32px;color:#9ca3af;"><span class="material-symbols-outlined" style="font-size:28px;animation:spin 1s linear infinite;">progress_activity</span></div>';

    cachedNotifications = await fetchAllNotifications();

    renderNotificationItems();
}

async function fetchAllNotifications(userId = 1) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('accessToken');
        const response = await fetch(`${API_BASE}/notifications/user/${userId}/unread`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed');
        const notifications = await response.json();

        // Update badge based on truly unread (not seen by user)
        const readIds = getReadNotificationIds();
        const unreadCount = notifications.filter(n => !n.isRead && !readIds.includes(n.id)).length;
        updateNotificationBadgeUpgraded(unreadCount);

        return notifications;
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }
}

function renderNotificationItems() {
    const container = document.getElementById('notification-list');
    if (!container) return;

    const readIds = getReadNotificationIds();
    let items = cachedNotifications.map(n => ({
        ...n,
        _isRead: n.isRead || readIds.includes(n.id)
    }));

    // Apply filter
    if (currentNotifFilter === 'unread') {
        items = items.filter(i => !i._isRead);
    }

    // Update header count
    const countEl = document.getElementById('notif-header-count');
    const totalUnread = cachedNotifications.filter(n => !n.isRead && !readIds.includes(n.id)).length;
    if (countEl) {
        countEl.textContent = totalUnread;
        countEl.classList.toggle('visible', totalUnread > 0);
    }

    if (items.length === 0) {
        container.innerHTML = `
            <div class="notif-empty">
                <div class="notif-empty__icon">
                    <span class="material-symbols-outlined" style="font-size:48px">notifications_off</span>
                </div>
                <p class="notif-empty__text">${currentNotifFilter === 'unread' ? 'Không có thông báo chưa đọc' : 'Không có thông báo nào'}</p>
                <p class="notif-empty__sub">Các thông báo mới sẽ xuất hiện ở đây</p>
            </div>`;
        return;
    }

    container.innerHTML = items.map(n => {
        const iconClass = getNotifIconClass(n.type);
        const icon = getNotifIcon(n.type);
        const readClass = n._isRead ? 'read' : 'unread';
        const timeStr = formatNotifTime(n.createdAt);

        return `
        <div class="notif-item ${readClass}" onclick="handleNotificationClick(${n.id})">
            <div class="notif-item__icon ${iconClass}">
                <span class="material-symbols-outlined">${icon}</span>
            </div>
            <div class="notif-item__body">
                <p class="notif-item__title">${escapeHtml(n.title || '')}</p>
                <p class="notif-item__message">${escapeHtml(n.message || '')}</p>
                <span class="notif-item__time">
                    <span class="material-symbols-outlined">schedule</span>
                    ${timeStr}
                </span>
            </div>
        </div>`;
    }).join('');
}

function getNotifIcon(type) {
    const icons = {
        'WATER_REMINDER': 'water_drop',
        'FERTILIZE_REMINDER': 'eco',
        'HARVEST_READY': 'agriculture',
        'PEST_ALERT': 'bug_report',
        'WEATHER_WARNING': 'thunderstorm',
        'FEEDING_REMINDER': 'restaurant',
        'VACCINE_REMINDER': 'vaccines',
        'HEALTH_ALERT': 'health_and_safety',
        'MARKET_UPDATE': 'trending_up'
    };
    return icons[type] || 'notifications';
}

function getNotifIconClass(type) {
    const classes = {
        'WATER_REMINDER': 'icon--blue',
        'FERTILIZE_REMINDER': 'icon--green',
        'HARVEST_READY': 'icon--amber',
        'PEST_ALERT': 'icon--red',
        'WEATHER_WARNING': 'icon--purple',
        'FEEDING_REMINDER': 'icon--amber',
        'VACCINE_REMINDER': 'icon--blue',
        'HEALTH_ALERT': 'icon--red',
        'MARKET_UPDATE': 'icon--green'
    };
    return classes[type] || 'icon--default';
}

function formatNotifTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHr < 24) return `${diffHr} giờ trước`;
    if (diffDay < 7) return `${diffDay} ngày trước`;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ---- Read/Unread Tracking with localStorage ----

function getReadNotificationIds() {
    try {
        return JSON.parse(localStorage.getItem('readNotificationIds') || '[]');
    } catch { return []; }
}

function saveReadNotificationId(id) {
    const ids = getReadNotificationIds();
    if (!ids.includes(id)) {
        ids.push(id);
        // Keep only last 200 to avoid bloat
        if (ids.length > 200) ids.splice(0, ids.length - 200);
        localStorage.setItem('readNotificationIds', JSON.stringify(ids));
    }
}

function markNotificationsSeen() {
    // When user opens the panel, mark current notifications as "seen"
    // This clears the badge, but items still show as unread until clicked
    localStorage.setItem('lastNotifSeenTime', Date.now().toString());
    updateNotificationBadgeUpgraded(0);
}

function handleNotificationClick(id) {
    // Mark as read locally
    saveReadNotificationId(id);

    // Also tell the server
    const token = localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('accessToken');
    fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    }).catch(e => console.error('Error marking notification read:', e));

    // Re-render immediately
    renderNotificationItems();
}

function markAllNotificationsRead() {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('accessToken');
    cachedNotifications.forEach(n => {
        saveReadNotificationId(n.id);
        // Also tell server
        fetch(`${API_BASE}/notifications/${n.id}/read`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => {});
    });
    renderNotificationItems();
}

function filterNotifications(tab) {
    currentNotifFilter = tab;
    // Update tab UI
    document.querySelectorAll('.notif-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });
    renderNotificationItems();
}

function updateNotificationBadgeUpgraded(count) {
    const badge = document.getElementById('notification-badge');
    if (badge) {
        badge.textContent = count > 0 ? count : '';
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
    // Also override the features.js notificationCount
    if (typeof notificationCount !== 'undefined') {
        notificationCount = count;
    }
}

// Override features.js updateNotificationBadge
function updateNotificationBadge() {
    // Delegate to upgraded version — recalculate from cached data
    const readIds = getReadNotificationIds();
    const lastSeen = parseInt(localStorage.getItem('lastNotifSeenTime') || '0');
    const unreadCount = cachedNotifications.filter(n => {
        if (n.isRead || readIds.includes(n.id)) return false;
        // Only show badge for notifications newer than last seen time
        const createdTime = new Date(n.createdAt).getTime();
        return createdTime > lastSeen;
    }).length;
    updateNotificationBadgeUpgraded(unreadCount);
}

// Periodically check for new notifications (every 30s)
setInterval(async () => {
    const oldCount = cachedNotifications.length;
    cachedNotifications = await fetchAllNotifications();
    // If new notifications arrived since last seen, show badge
    const lastSeen = parseInt(localStorage.getItem('lastNotifSeenTime') || '0');
    const readIds = getReadNotificationIds();
    const newUnread = cachedNotifications.filter(n => {
        if (n.isRead || readIds.includes(n.id)) return false;
        const createdTime = new Date(n.createdAt).getTime();
        return createdTime > lastSeen;
    }).length;
    updateNotificationBadgeUpgraded(newUnread);
}, 30000);

// openInventoryModal is provided by inventory.js.
// Marketplace is OVERRIDDEN below for livestock-specific animal prices.

// ==================== LIVESTOCK MARKETPLACE (Animal Prices) ====================

let livestockMarketChart = null;
let activeAnimalId = null;
let livestockMarketPollingInterval = null;
let animalPriceHistory = {}; // { animalId: [{date, price}] }

function toggleMarketplacePanel() {
    const panel = document.getElementById('marketplace-panel');
    if (panel) {
        const isOpening = !panel.classList.contains('open');
        closeOtherPanels('marketplace-panel');
        panel.classList.toggle('open');
        updateFeatureOverlay();

        if (isOpening) {
            renderLivestockMarketList();
            startLivestockMarketPolling();
        } else {
            stopLivestockMarketPolling();
        }
    }
}

function startLivestockMarketPolling() {
    stopLivestockMarketPolling();
    livestockMarketPollingInterval = setInterval(() => {
        if (activeAnimalId) updateLivestockMarketChart(activeAnimalId);
    }, 6000);
}

function stopLivestockMarketPolling() {
    if (livestockMarketPollingInterval) {
        clearInterval(livestockMarketPollingInterval);
        livestockMarketPollingInterval = null;
    }
}
// Alias for features.js reference
window.stopMarketplacePolling = stopLivestockMarketPolling;

function getAnimalMarketIcon(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('gà')) return '🐔';
    if (n.includes('vịt')) return '🦆';
    if (n.includes('ngan')) return '🦆';
    if (n.includes('ngỗng')) return '🪿';
    if (n.includes('cút')) return '🐦';
    if (n.includes('bò sữa')) return '🐄';
    if (n.includes('bò')) return '🐂';
    if (n.includes('trâu')) return '🐃';
    if (n.includes('lợn') || n.includes('heo')) return '🐷';
    if (n.includes('dê')) return '🐐';
    if (n.includes('cừu')) return '🐑';
    if (n.includes('tôm hùm')) return '🦞';
    if (n.includes('tôm')) return '🦐';
    if (n.includes('cua')) return '🦀';
    if (n.includes('ếch')) return '🐸';
    if (n.includes('lươn')) return '🐍';
    if (n.includes('ong')) return '🐝';
    if (n.includes('tằm')) return '🐛';
    if (n.includes('ốc')) return '🐌';
    if (n.includes('hàu')) return '🦪';
    if (n.includes('nghêu') || n.includes('sò')) return '🐚';
    if (n.includes('cá')) return '🐟';
    return '🐾';
}

function getAnimalCategoryLabel(cat) {
    const labels = {
        'LAND': 'Gia súc/gia cầm',
        'FRESHWATER': 'Nước ngọt',
        'BRACKISH': 'Nước lợ',
        'SALTWATER': 'Nước mặn',
        'SPECIAL': 'Đặc biệt'
    };
    return labels[cat] || cat;
}

function renderLivestockMarketList() {
    const container = document.getElementById('market-ticker-list');
    if (!container) return;

    if (!allAnimals || allAnimals.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#64748b;">Đang tải dữ liệu...</div>';
        return;
    }

    // Sort by category, then name
    const sorted = [...allAnimals].filter(a => a.sellPricePerUnit > 0).sort((a, b) => {
        if (a.category !== b.category) return (a.category || '').localeCompare(b.category || '');
        return (a.name || '').localeCompare(b.name || '');
    });

    if (!activeAnimalId && sorted.length > 0) {
        selectAnimalMarketItem(sorted[0]);
    }

    container.innerHTML = sorted.map(animal => {
        const isActive = activeAnimalId === animal.id ? 'active' : '';
        // Simulate small price fluctuation for market feel
        const change = getAnimalPriceChange(animal.id);
        const isUp = change > 0;
        const changeColor = isUp ? 'text-green' : (change < 0 ? 'text-red' : '');

        return `
        <div class="ticker-item ${isActive}" onclick='selectAnimalMarketItem(${JSON.stringify({ id: animal.id, name: animal.name, category: animal.category, sellPricePerUnit: animal.sellPricePerUnit, buyPricePerUnit: animal.buyPricePerUnit, unit: animal.unit })})'>
            <div class="ticker-info">
                <h4>${animal.name}</h4>
                <span>${getAnimalCategoryLabel(animal.category)}</span>
            </div>
            <div class="ticker-price">
                <span class="current">${formatLivestockPrice(animal.sellPricePerUnit)} đ</span>
                <span class="change ${changeColor}">
                    ${isUp ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%
                </span>
            </div>
        </div>
        `;
    }).join('');
}

// Track simulated price changes
let animalPriceChanges = {};
function getAnimalPriceChange(animalId) {
    if (!animalPriceChanges[animalId]) {
        animalPriceChanges[animalId] = (Math.random() - 0.45) * 5; // slight upward bias
    }
    // Slowly drift
    animalPriceChanges[animalId] += (Math.random() - 0.5) * 0.3;
    animalPriceChanges[animalId] = Math.max(-10, Math.min(10, animalPriceChanges[animalId]));
    return animalPriceChanges[animalId];
}

function selectAnimalMarketItem(animal) {
    if (typeof animal === 'string') animal = JSON.parse(animal);
    activeAnimalId = animal.id;

    // Update active state in list
    document.querySelectorAll('.ticker-item').forEach(el => el.classList.remove('active'));
    // Re-render would be cleaner but just toggle for performance

    // Update header
    const iconEl = document.getElementById('detail-icon');
    const nameEl = document.getElementById('detail-name');
    const catEl = document.getElementById('detail-category');
    const priceEl = document.getElementById('detail-price');
    const changeEl = document.getElementById('detail-change');
    const highEl = document.getElementById('detail-high');
    const lowEl = document.getElementById('detail-low');

    if (iconEl) iconEl.textContent = getAnimalMarketIcon(animal.name);
    if (nameEl) nameEl.textContent = animal.name;
    if (catEl) catEl.textContent = getAnimalCategoryLabel(animal.category);
    if (priceEl) priceEl.textContent = formatLivestockPrice(animal.sellPricePerUnit) + ' đ';

    const change = getAnimalPriceChange(animal.id);
    const isUp = change > 0;
    if (changeEl) {
        changeEl.textContent = `${isUp ? '+' : ''}${change.toFixed(2)}%`;
        changeEl.className = `stat-value ${isUp ? 'text-green' : 'text-red'}`;
    }

    // High/Low based on sell price
    const sellPrice = animal.sellPricePerUnit || 0;
    if (highEl) highEl.textContent = formatLivestockPrice(sellPrice * (1 + Math.random() * 0.08)) + ' đ';
    if (lowEl) lowEl.textContent = formatLivestockPrice(sellPrice * (1 - Math.random() * 0.05)) + ' đ';

    // Show chart, hide empty state
    const emptyState = document.getElementById('market-empty-state');
    const detailContainer = document.getElementById('market-detail-container');
    if (emptyState) emptyState.style.display = 'none';
    if (detailContainer) detailContainer.style.display = 'flex';

    // Update stat labels for livestock context
    updateLivestockMarketLabels(animal);

    // Init chart
    initLivestockMarketChart(animal);
}

function updateLivestockMarketLabels(animal) {
    // Update the stat box labels for livestock context
    const statBoxes = document.querySelectorAll('#marketplace-panel .stat-box');
    if (statBoxes.length >= 4) {
        statBoxes[0].querySelector('.stat-label').textContent = `Giá bán/${animal.unit || 'con'}`;
        statBoxes[1].querySelector('.stat-label').textContent = 'Biến động (7 ngày)';
        statBoxes[2].querySelector('.stat-label').textContent = `Cao nhất (30 ngày)`;
        statBoxes[3].querySelector('.stat-label').textContent = `Thấp nhất (30 ngày)`;
    }
}

function initLivestockMarketChart(animal) {
    const chartDiv = document.querySelector('#price-chart');
    if (!chartDiv) return;

    const basePrice = animal.sellPricePerUnit || 0;
    const history = generateAnimalPriceHistory(animal.id, basePrice);

    const dataSeries = history.map(h => ({
        x: h.date,
        y: h.price
    }));

    const options = {
        series: [{ name: `Giá ${animal.name} (VNĐ)`, data: dataSeries }],
        chart: {
            type: 'area', height: 400, background: 'transparent',
            animations: { enabled: true, easing: 'easeinout', dynamicAnimation: { speed: 800 } },
            toolbar: { show: false }
        },
        theme: { mode: 'dark' },
        stroke: { curve: 'smooth', width: 2.5 },
        fill: {
            type: 'gradient',
            gradient: { shadeIntensity: 1, opacityFrom: 0.6, opacityTo: 0.15, stops: [0, 100] }
        },
        colors: ['#10b981'],
        dataLabels: { enabled: false },
        grid: { borderColor: '#334155', strokeDashArray: 4 },
        xaxis: {
            type: 'datetime',
            tooltip: { enabled: false },
            axisBorder: { show: false }, axisTicks: { show: false },
            labels: { datetimeUTC: false, format: 'dd/MM', style: { colors: '#94a3b8' } }
        },
        yaxis: {
            labels: {
                formatter: (v) => new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(v),
                style: { colors: '#94a3b8' }
            }
        },
        tooltip: {
            theme: 'dark',
            y: { formatter: (v) => new Intl.NumberFormat('vi-VN').format(Math.round(v)) + ` đ/${animal.unit || 'con'}` },
            x: { format: 'dd/MM/yyyy' }
        }
    };

    if (livestockMarketChart) livestockMarketChart.destroy();
    livestockMarketChart = new ApexCharts(chartDiv, options);
    livestockMarketChart.render();
}

function generateAnimalPriceHistory(animalId, basePrice) {
    if (animalPriceHistory[animalId] && animalPriceHistory[animalId].length > 5) {
        // Add a new point
        const last = animalPriceHistory[animalId];
        const lastPrice = last[last.length - 1].price;
        const change = (Math.random() - 0.48) * (basePrice * 0.015);
        last.push({
            date: new Date().getTime(),
            price: Math.max(basePrice * 0.7, lastPrice + change)
        });
        // Keep last 40 points
        if (last.length > 40) last.shift();
        return last;
    }

    // Generate initial 30-day history
    const data = [];
    let price = basePrice;
    const now = Date.now();
    for (let i = 30; i >= 0; i--) {
        const date = now - i * 86400000; // 1 day intervals
        const change = (Math.random() - 0.48) * (basePrice * 0.02);
        price = Math.max(basePrice * 0.7, price + change);
        data.push({ date, price: Math.round(price) });
    }
    animalPriceHistory[animalId] = data;
    return data;
}

function updateLivestockMarketChart(animalId) {
    if (!livestockMarketChart) return;
    const animal = allAnimals.find(a => a.id === animalId);
    if (!animal) return;

    const history = generateAnimalPriceHistory(animalId, animal.sellPricePerUnit || 0);
    const dataSeries = history.map(h => ({ x: h.date, y: h.price }));

    livestockMarketChart.updateSeries([{ data: dataSeries }]);

    // Update current price display
    const latestPrice = history[history.length - 1]?.price || animal.sellPricePerUnit;
    const priceEl = document.getElementById('detail-price');
    if (priceEl) {
        priceEl.textContent = formatLivestockPrice(latestPrice) + ' đ';
        priceEl.style.color = '#fff';
        setTimeout(() => { if (priceEl) priceEl.style.color = '#10b981'; }, 150);
    }

    // Update change
    const changeEl = document.getElementById('detail-change');
    if (changeEl) {
        const change = getAnimalPriceChange(animalId);
        const isUp = change > 0;
        changeEl.textContent = `${isUp ? '+' : ''}${change.toFixed(2)}%`;
        changeEl.className = `stat-value ${isUp ? 'text-green' : 'text-red'}`;
    }
}

function formatLivestockPrice(value) {
    if (!value) return '0';
    return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

function filterAnimalTickers(query) {
    const q = (query || '').toLowerCase().trim();
    const items = document.querySelectorAll('.market-ticker-list .ticker-item');
    items.forEach(item => {
        const name = (item.querySelector('.ticker-name')?.textContent || '').toLowerCase();
        item.style.display = (!q || name.includes(q)) ? '' : 'none';
    });
}

function openAnalysisModal() {
    if (!selectedPen) {
        showNotification('Vui lòng chọn một chuồng nuôi!', 'warning');
        return;
    }
    openAnalysisModalGeneric('LIVESTOCK', selectedPen.id, selectedPen.code);
}

// openInventoryModal is now provided by inventory.js

function closeAllFeaturePanels() {
    // Use features.js version if available (it handles all panels)
    const panels = document.querySelectorAll('.feature-panel');
    panels.forEach(p => p.classList.remove('open'));
    const overlay = document.getElementById('feature-overlay');
    if (overlay) overlay.classList.remove('open');
    if (typeof stopMarketplacePolling === 'function') stopMarketplacePolling();
}

// Make global — all functions referenced in HTML onclick handlers
window.openAddCageModal = openAddCageModal;
window.openFeedingModal = openFeedingModal;
window.closeFeedingModal = closeFeedingModal;
window.submitFeeding = submitFeeding;
window.confirmDeletePen = confirmDeletePen;
window.fillRecommendedAmount = fillRecommendedAmount;
window.closeConfirmModal = closeConfirmModal;
window.openHarvestModal = openHarvestModal;
window.closeHarvestModal = closeHarvestModal;
window.submitHarvest = submitHarvest;
window.cleanPen = cleanPen;
window.openVaccineModal = openVaccineModal;
window.openVaccineScheduleModal = openVaccineScheduleModal;
window.openAnalysisModal = openAnalysisModal;
window.handlePenStatusChange = handlePenStatusChange;
window.toggleMarketplacePanel = toggleMarketplacePanel;
window.selectAnimalMarketItem = selectAnimalMarketItem;
window.filterAnimalTickers = filterAnimalTickers;
window.toggleNotificationPanel = toggleNotificationPanel;
window.markAllNotificationsRead = markAllNotificationsRead;
window.filterNotifications = filterNotifications;
window.handleNotificationClick = handleNotificationClick;
// openInventoryModal from inventory.js
// closeAllFeaturePanels redefined above to also stop market polling
