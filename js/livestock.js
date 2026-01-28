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

// Farm ID - dynamically loaded from user's farms
let currentFarmId = null;
var API_BASE_URL = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL :
    (typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : 'http://localhost:8080/api');

// User inventory cache for checking before activities
let livestockInventoryCache = [];

// ==================== INVENTORY HELPERS ====================

async function loadLivestockInventory() {
    try {
        const userEmail = localStorage.getItem('userEmail');
        if (!userEmail) return [];

        const response = await fetch(`${API_BASE_URL}/shop/inventory?userEmail=${encodeURIComponent(userEmail)}`);
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
        const matchCategory = !category || item.category === category;
        const matchName = !productName || item.name.toLowerCase().includes(productName.toLowerCase());
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

    // Load user's farm first
    await loadCurrentFarm();

    // Load initial data
    await loadAnimals();
    await loadPens();
    await loadLivestockInventory(); // Load inventory for activity checks

    // Setup event listeners
    setupEventListeners();

    // Render pen grid
    renderPenGrid();
});

/**
 * Load the current user's farm from the backend
 */
async function loadCurrentFarm() {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const response = await fetch(`${API_BASE_URL}/farms/my-farms`, { headers });
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
    // Add cage button
    const addCageBtn = document.querySelector('.btn--primary');
    if (addCageBtn) {
        addCageBtn.addEventListener('click', openAddCageModal);
    }

    // Pen card clicks
    document.addEventListener('click', function (e) {
        const penCard = e.target.closest('.pen-card');
        if (penCard) {
            handlePenClick(penCard);
        }
    });

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
        const response = await fetch(`${API_BASE_URL}/livestock/pens?farmId=${currentFarmId}`);
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
            renderPenGrid();
            closeModal();
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

function renderPenGrid() {
    const penGrid = document.querySelector('.pen-grid');
    if (!penGrid) return;

    // Clear existing cards
    penGrid.innerHTML = '';

    // Render pens from database
    allPens.forEach(pen => {
        penGrid.appendChild(createPenCard(pen));
    });

    // Add empty slot for adding new pen
    const emptyCard = document.createElement('div');
    emptyCard.className = 'pen-card pen-card--empty';
    emptyCard.setAttribute('data-pen-id', 'new');
    emptyCard.innerHTML = `
        <span class="pen-card__id">Mới</span>
        <div class="pen-card__content">
            <span class="material-symbols-outlined pen-card__icon">add</span>
            <span class="pen-card__label">Thêm chuồng</span>
        </div>
    `;
    emptyCard.addEventListener('click', openAddCageModal);
    penGrid.appendChild(emptyCard);
}

function createPenCard(pen) {
    const card = document.createElement('div');
    const statusClass = getStatusClass(pen.status);
    const hasAlert = pen.status === 'SICK';

    card.className = `pen-card ${statusClass}${hasAlert ? ' pen-card--alert' : ''}`;
    card.setAttribute('data-pen-id', pen.id);

    const animalName = pen.animalDefinition ? pen.animalDefinition.name : 'Trống';
    const animalIcon = getAnimalIcon(pen.animalDefinition);
    const count = pen.animalCount || 0;

    // Feeding status badge
    let feedingStatusHtml = '';
    if (count > 0 && pen.feedingStatus) {
        const feedingStatusClass = getFeedingStatusClass(pen);
        const feedingStatusIcon = getFeedingStatusIcon(pen);
        const feedingStatusText = getFeedingStatusText(pen);
        feedingStatusHtml = `
            <span class="pen-card__feeding-status ${feedingStatusClass}">
                <span class="material-symbols-outlined">${feedingStatusIcon}</span>
                ${feedingStatusText}
            </span>
        `;
    }

    card.innerHTML = `
        <span class="pen-card__id">${pen.code}</span>
        ${hasAlert ? `<span class="pen-card__alert pen-card__alert--pulse">
            <span class="material-symbols-outlined">warning</span>
        </span>` : ''}
        <div class="pen-card__content">
            <span class="material-symbols-outlined pen-card__icon">${animalIcon}</span>
            <span class="pen-card__label">${animalName}${count > 0 ? ' • ' + count : ''}</span>
        </div>
        ${feedingStatusHtml}
    `;

    return card;
}

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

// ==================== PEN DETAILS ====================

function handlePenClick(penCard) {
    const penId = penCard.getAttribute('data-pen-id');
    if (penId === 'new') {
        openAddCageModal();
        return;
    }

    // Find pen data
    const pen = allPens.find(p => p.id == penId);
    if (!pen) return;

    selectedPen = pen;
    updatePenDetails(pen);

    // Highlight selected card
    document.querySelectorAll('.pen-card').forEach(c => c.classList.remove('pen-card--selected'));
    penCard.classList.add('pen-card--selected');
}

function updatePenDetails(pen) {
    const detailPanel = document.querySelector('.animal-detail');
    if (!detailPanel) return;

    // Toggle Empty State / Content
    const emptyState = document.getElementById('empty-pen-state');
    const content = document.getElementById('pen-detail-content');
    if (emptyState) emptyState.style.display = 'none';
    if (content) content.style.display = 'block';

    const animalName = pen.animalDefinition ? pen.animalDefinition.name : 'Chưa có vật nuôi';
    const statusBadge = getStatusBadge(pen.status);

    // Update header
    const titleEl = detailPanel.querySelector('.animal-detail__title');
    if (titleEl) titleEl.textContent = `Chuồng ${pen.code}`;

    const badgeEl = detailPanel.querySelector('.badge');
    if (badgeEl) {
        badgeEl.className = `badge ${statusBadge.class}`;
        badgeEl.textContent = statusBadge.text;
        badgeEl.style.display = 'inline-flex';
    }

    const statusControl = document.getElementById('pen-status-control');
    if (statusControl) statusControl.style.display = 'flex';

    const statusSelect = document.getElementById('pen-status-select');
    if (statusSelect) statusSelect.value = String(pen.status || 'EMPTY').toUpperCase();

    // Update stats
    const stats = detailPanel.querySelector('.animal-detail__stats');
    if (stats) {
        const unit = pen.animalDefinition?.unit || 'con';
        const typeLabel = getFarmingTypeLabel(pen.farmingType);
        const waterLabel = pen.waterType ? `(${getWaterTypeLabel(pen.waterType)})` : '';
        const startDate = formatDate(pen.startDate);
        const harvestDate = formatDate(pen.expectedHarvestDate);

        stats.innerHTML = `
            <div class="animal-stat-item">
                <span class="animal-stat__label">
                    <span class="material-symbols-outlined animal-stat__icon">pets</span>
                    Loại vật nuôi
                </span>
                <span class="animal-stat__value">${animalName}</span>
            </div>
            
            <div class="animal-stat-item">
                <span class="animal-stat__label">
                    <span class="material-symbols-outlined animal-stat__icon">tag</span>
                    Số lượng
                </span>
                <span class="animal-stat__value">${pen.animalCount || 0} ${unit}</span>
            </div>

            <div class="animal-stat-item">
                <span class="animal-stat__label">
                    <span class="material-symbols-outlined animal-stat__icon">landscape</span>
                    Môi trường
                </span>
                <span class="animal-stat__value">${typeLabel} ${waterLabel}</span>
            </div>

            <div class="animal-stat-item">
                <span class="animal-stat__label">
                    <span class="material-symbols-outlined animal-stat__icon">square_foot</span>
                    Diện tích
                </span>
                <span class="animal-stat__value">${pen.areaSqm || 0} m²</span>
            </div>

            <div class="animal-stat-item">
                <span class="animal-stat__label">
                    <span class="material-symbols-outlined animal-stat__icon">calendar_today</span>
                    Ngày bắt đầu
                </span>
                <span class="animal-stat__value">${startDate}</span>
            </div>

            <div class="animal-stat-item">
                <span class="animal-stat__label">
                    <span class="material-symbols-outlined animal-stat__icon">event</span>
                    Dự kiến
                </span>
                <span class="animal-stat__value">${harvestDate}</span>
            </div>
        `;
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
        btnAnalysis.classList.remove('field-action-btn--disabled');
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

            renderPenGrid();
            const selectedCard = document.querySelector(`.pen-card[data-pen-id="${selectedPen.id}"]`);
            if (selectedCard) selectedCard.classList.add('pen-card--selected');

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

            // clear content incase it's shown momentarily
            if (document.querySelector('.vaccine-list')) document.querySelector('.vaccine-list').innerHTML = '';

            await loadPens();
            renderPenGrid();
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
        quantityInput.addEventListener('input', validateCapacity);
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
        validateCapacity();
    }
}

// ==================== HEALTH & EVENTS ====================

async function loadHealthRecords(penId) {
    const container = document.querySelector('.vaccine-list');
    if (!container) return;

    container.innerHTML = '<div style="padding:10px;text-align:center;color:#666">Đang tải...</div>';

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/pens/${penId}/health`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const records = await response.json();
            renderHealthRecords(records);
        } else {
            container.innerHTML = '<div style="padding:10px;text-align:center;color:red">Lỗi tải dữ liệu</div>';
        }
    } catch (error) {
        console.error('Error loading health records:', error);
        container.innerHTML = '<div style="padding:10px;text-align:center;color:red">Lỗi kết nối</div>';
    }
}

function renderHealthRecords(records) {
    const container = document.querySelector('.vaccine-list');
    if (!container) return;
    container.innerHTML = '';

    if (records.length === 0) {
        container.innerHTML = '<div style="padding:10px;text-align:center;color:#999">Chưa có sự kiện nào</div>';
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    records.forEach(record => {
        const item = document.createElement('div');
        item.className = 'vaccine-item';

        let statusClass = 'vaccine-item__dot--upcoming';
        let statusText = 'Sắp tới';
        let statusBadgeClass = 'vaccine-item__status--upcoming';

        const eventDate = new Date(record.eventDate);
        eventDate.setHours(0, 0, 0, 0);

        if (record.status === 'COMPLETED') {
            statusClass = 'vaccine-item__dot--completed';
            statusText = 'Đã xong';
            statusBadgeClass = 'vaccine-item__status--completed';
        } else if (eventDate < today) {
            statusClass = 'vaccine-item__dot--overdue'; // Need CSS for this, or reuse Scheduled
            statusText = 'Quá hạn';
            statusBadgeClass = 'vaccine-item__status--scheduled'; // Reuse logic or add CSS
            // Let's use red color inline if needed or stick to existing classes
        }

        // Format date dd/MM/yyyy
        const dateStr = eventDate.toLocaleDateString('vi-VN');

        item.innerHTML = `
            <div class="vaccine-item__info">
                <span class="vaccine-item__dot ${statusClass}"></span>
                <div>
                    <p class="vaccine-item__name">${record.name}</p>
                    <p class="vaccine-item__date">${dateStr}</p>
                </div>
            </div>
            <span class="vaccine-item__status ${statusBadgeClass}">${statusText}</span>
        `;

        // Add click to toggle (simple implementation)
        item.addEventListener('click', () => toggleHealthStatus(record));

        container.appendChild(item);
    });
}

async function toggleHealthStatus(record) {
    if (record.status === 'COMPLETED') return; // Already done

    if (confirm(`Xác nhận đã hoàn thành: ${record.name}?`)) {
        try {
            const response = await fetch(`http://localhost:8080/api/livestock/health/${record.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
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

    // Filter animals based on farming type and water type
    let filteredAnimals = allAnimals.filter(animal => {
        const types = JSON.parse(animal.farmingTypes || '[]');
        const matchesFarmingType = types.includes(selectedFarmingType);

        if (selectedFarmingType === 'POND' && selectedWaterType) {
            return matchesFarmingType && animal.waterType === selectedWaterType;
        }

        return matchesFarmingType;
    });

    // Also show incompatible animals but greyed out
    allAnimals.forEach(animal => {
        const types = JSON.parse(animal.farmingTypes || '[]');
        const isCompatible = types.includes(selectedFarmingType);
        const matchesWater = selectedFarmingType !== 'POND' || !selectedWaterType || animal.waterType === selectedWaterType;

        const card = document.createElement('div');
        card.className = `animal-card ${(!isCompatible || !matchesWater) ? 'animal-card--disabled' : ''}`;
        card.dataset.animalId = animal.id;

        const icon = animal.iconName || 'pets';
        const price = formatCurrency(animal.buyPricePerUnit);

        card.innerHTML = `
            <span class="material-symbols-outlined animal-card__icon">${icon}</span>
            <span class="animal-card__name">${animal.name}</span>
            <small class="animal-card__price">${price}/${animal.unit || 'con'}</small>
        `;

        if (isCompatible && matchesWater) {
            card.addEventListener('click', () => selectAnimal(animal));
        }

        grid.appendChild(card);
    });

    document.getElementById('step-animal').classList.remove('hidden');
}

function selectAnimal(animal) {
    selectedAnimal = animal;

    // Update UI
    document.querySelectorAll('.animal-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.animalId == animal.id);
    });

    // Show quantity section
    document.getElementById('step-quantity').classList.remove('hidden');

    // Update size info
    updateSizeInfo(animal);

    // Update expected info
    updateExpectedInfo();

    // Validate capacity
    validateCapacity();
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

async function validateCapacity() {
    if (!selectedAnimal) return;

    const length = parseFloat(document.getElementById('pen-length').value) || 0;
    const width = parseFloat(document.getElementById('pen-width').value) || 0;
    const quantity = parseInt(document.getElementById('animal-quantity').value) || 0;

    if (length <= 0 || width <= 0 || quantity <= 0) return;

    const result = await calculateCapacity({
        lengthM: length,
        widthM: width,
        animalDefinitionId: selectedAnimal.id,
        animalCount: quantity
    });

    const warning = document.getElementById('capacity-warning');
    if (result && result.isOverCapacity) {
        warning.classList.remove('hidden');
        document.getElementById('capacity-warning-text').textContent = result.warning;
    } else {
        warning.classList.add('hidden');
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
        const response = await fetch(`${API_BASE_URL}/feeding/compatible/${animalDefinitionId}`);
        if (!response.ok) throw new Error("Failed to fetch compatible feeds");
        compatibleFeeds = await response.json();

        if (compatibleFeeds.length === 0) {
            grid.innerHTML = '<p style="grid-column: span 2; text-align: center; color: var(--color-text-secondary);">Không có thức ăn phù hợp. Vui lòng thêm dữ liệu thức ăn.</p>';
            return;
        }

        // Also fetch all feed definitions to show which are incompatible
        const allFeedsResponse = await fetch(`${API_BASE_URL}/feeding/definitions`);
        let allFeeds = [];
        if (allFeedsResponse.ok) {
            allFeeds = await allFeedsResponse.json();
        }

        // Get compatible feed IDs
        const compatibleFeedIds = new Set(compatibleFeeds.map(f => f.feedDefinitionId));

        // Render feed items
        grid.innerHTML = '';

        // First render compatible feeds
        compatibleFeeds.forEach(feed => {
            grid.appendChild(createFeedItem(feed, true));
        });

        // Then render incompatible feeds (greyed out)
        allFeeds.filter(f => !compatibleFeedIds.has(f.id)).slice(0, 6).forEach(feed => {
            grid.appendChild(createIncompatibleFeedItem(feed));
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
        const token = localStorage.getItem('authToken');
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
        closeFeedingModal();

        // Refresh inventory after use
        await loadLivestockInventory();

        // Refresh pen data to update feeding status
        await loadPens();
        renderPenGrid();

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
        const response = await fetch(`${API_BASE_URL}/feeding/items`);
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
        const response = await fetch(`${API_BASE_URL}/feeding/growth/${penId}`);
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

// Make global
window.openFeedingModal = openFeedingModal;
window.closeFeedingModal = closeFeedingModal;
window.submitFeeding = submitFeeding;
window.confirmDeletePen = confirmDeletePen;
window.fillRecommendedAmount = fillRecommendedAmount;

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
        const response = await fetch(`${API_BASE_URL}/livestock/pens/${harvestPenData.id}/harvest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
            renderPenGrid();

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
window.closeHarvestModal = closeHarvestModal;
window.submitHarvest = submitHarvest;

// ==================== WORKFLOW UI LOGIC ====================

function updateUIForWorkflow(pen) {
    // Buttons
    const btnSelect = document.getElementById('btn-select-animal');
    const btnFeed = document.getElementById('btn-feed');
    const btnClean = document.getElementById('btn-clean');
    const btnVaccine = document.getElementById('btn-vaccine');
    const btnHarvest = document.getElementById('btn-harvest');
    const btnDelete = document.getElementById('btn-delete-pen');

    // Stage indicators
    const stepAnimal = document.getElementById('step-animal');
    const workflowText = document.getElementById('workflow-stage-text');

    // Reset default
    [btnFeed, btnClean, btnVaccine, btnHarvest].forEach(btn => disableButton(btn));
    enableButton(btnDelete); // Always allow delete

    if (!pen.animalCount || pen.animalCount === 0) {
        // Empty State: Step 1 active
        enableButton(btnSelect);
        disableButton(btnDelete); // Can't delete empty? actually should be able to delete structure
        // If "Delete Pen" means delete the structure, it should be enabled.
        // If it means delete animals, disabled. The button says "Xóa chuồng" (Delete Pen).
        enableButton(btnDelete); // Allow deleting empty pen structure

        workflowText.textContent = "Bước 1: Chọn vật nuôi để bắt đầu";
    } else {
        // Occupied State
        disableButton(btnSelect); // Can't select new if occupied

        // Active steps
        enableButton(btnFeed);
        enableButton(btnClean);
        enableButton(btnVaccine);
        enableButton(btnHarvest);

        workflowText.textContent = "Đang nuôi dưỡng - Chăm sóc định kỳ";

        // Check alerts
        if (pen.status === 'DIRTY') {
            workflowText.innerHTML = '<span style="color:#f59e0b">⚠️ Cần vệ sinh chuồng!</span>';
        } else if (pen.status === 'SICK') {
            workflowText.innerHTML = '<span style="color:#ef4444">⚠️ Vật nuôi đang bị bệnh!</span>';
        }
    }
}

function enableButton(btn) {
    if (!btn) return;
    btn.disabled = false;
    btn.classList.remove('field-action-btn--disabled');
}

function disableButton(btn) {
    if (!btn) return;
    btn.disabled = true;
    btn.classList.add('field-action-btn--disabled');
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
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/pens/${selectedPen.id}/clean`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showNotification('🧹 Đã vệ sinh chuồng sạch sẽ!', 'success');
            await loadPens();
            renderPenGrid();
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

function toggleNotificationPanel() {
    // reusing sidebar.js if available or simple toggle
    const p = document.getElementById('notification-panel');
    if (p) p.classList.toggle('open');
    else showNotification('Panel not found', 'error');
}

function toggleMarketplacePanel() {
    const p = document.getElementById('marketplace-panel');
    if (p) p.classList.toggle('open');
    else showNotification('Marketplace panel not found', 'error');
}

function openAnalysisModal() {
    if (!selectedPen) {
        showNotification('Vui lòng chọn một chuồng nuôi!', 'warning');
        return;
    }
    openAnalysisModalGeneric('LIVESTOCK', selectedPen.id, selectedPen.code);
}

function openInventoryModal() {
    showNotification('Tính năng Kho vật tư đang phát triển', 'info');
}

// Make global
window.cleanPen = cleanPen;
window.openVaccineModal = openVaccineModal;
window.openVaccineScheduleModal = openVaccineScheduleModal;
window.toggleNotificationPanel = toggleNotificationPanel;
window.toggleMarketplacePanel = toggleMarketplacePanel;
window.openAnalysisModal = openAnalysisModal;
window.openInventoryModal = openInventoryModal;
window.handlePenStatusChange = handlePenStatusChange;

