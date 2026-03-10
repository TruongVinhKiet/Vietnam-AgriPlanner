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

// === WORKFLOW TASK SYSTEM ===
let livestockWorkers = []; // Cached approved workers

async function getLivestockUserId() {
    const email = localStorage.getItem('userEmail');
    if (!email) return null;
    try {
        const res = await fetch(`${API_BASE_URL}/user/profile?email=${encodeURIComponent(email)}`);
        if (res.ok) { const u = await res.json(); return u ? u.id : null; }
    } catch (e) { console.error('Error getting user ID:', e); }
    return null;
}

async function loadLivestockWorkers() {
    if (livestockWorkers.length > 0) return livestockWorkers;
    try {
        const farmId = currentFarmId || 1;
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE_URL}/user/list?role=WORKER&farmId=${farmId}`, { headers });
        if (res.ok) livestockWorkers = await res.json();
    } catch (e) { console.error('Error loading workers:', e); }
    return livestockWorkers;
}

function renderLivestockWorkerSelect(selectId) {
    let options = `<option value="">-- Chọn nhân công --</option>`;
    livestockWorkers.forEach(w => {
        const name = w.fullName || w.email || `Worker #${w.id}`;
        options += `<option value="${w.id}">${name}</option>`;
    });
    return `
        <div style="margin-top:16px; padding:16px; background:linear-gradient(135deg, #eff6ff, #dbeafe); border-radius:12px; border:1px solid #93c5fd;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                <span class="material-symbols-outlined" style="color:#2563eb; font-size:20px;">person_add</span>
                <span style="font-weight:600; color:#1e40af; font-size:14px;">Phân công nhân công</span>
            </div>
            <select id="${selectId}" class="modal-input" style="width:100%; padding:10px 14px; border-radius:8px; border:1px solid #93c5fd; font-size:14px;">
                ${options}
            </select>
            <p style="margin:8px 0 0; font-size:12px; color:#6b7280;">
                <span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle;">info</span>
                Nhân công sẽ nhận nhiệm vụ và báo cáo khi hoàn thành
            </p>
        </div>`;
}

async function createLivestockWorkflowTask({ taskType, penId, workerId, name, description, workflowData }) {
    const ownerId = await getLivestockUserId();
    if (!ownerId) throw new Error('Không xác định được chủ trang trại');
    if (!currentFarmId) await loadCurrentFarm();

    const payload = {
        farmId: currentFarmId || 1,
        ownerId: ownerId,
        workerId: workerId || null,
        penId: penId,
        name: name,
        description: description || '',
        priority: 'NORMAL',
        taskType: taskType,
        salary: 0,
        dueDate: null,
        workflowData: JSON.stringify(workflowData)
    };

    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE_URL}/tasks`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || 'Lỗi tạo công việc');
    }
    return await res.json();
}

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
        const itemName = item.effectiveName || item.itemName || item.name || '';
        const itemCategory = item.effectiveCategory || item.itemCategory || item.category || '';
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

async function checkFeedStockByDefinitionId(feedDefinitionId, requiredQuantity) {
    try {
        const userEmail = localStorage.getItem('userEmail');
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const url = `${API_BASE_URL}/shop/inventory/feed/${feedDefinitionId}?userEmail=${encodeURIComponent(userEmail || '')}`;
        const res = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
        if (res.ok) {
            const data = await res.json();
            const stock = parseFloat(data.stock) || 0;
            return {
                hasEnough: stock >= requiredQuantity,
                available: stock,
                needed: requiredQuantity,
                shortage: Math.max(0, requiredQuantity - stock)
            };
        }
    } catch (e) {
        console.error('Error checking feed stock:', e);
    }
    return { hasEnough: false, available: 0, needed: requiredQuantity, shortage: requiredQuantity };
}

function redirectToShopFromLivestock(category, productKeyword, quantity, message, feedDefinitionId) {
    const intent = {
        category: category,
        keyword: productKeyword,
        quantity: quantity,
        feedDefinitionId: feedDefinitionId || null,
        fromLivestock: true,
        returnUrl: window.location.href,
        timestamp: Date.now()
    };
    localStorage.setItem('agriplanner_purchase_intent', JSON.stringify(intent));

    // Save feeding context so we can reopen modal after purchase
    if (currentFeedingPenId && selectedFeedDefinitionId) {
        const feedingContext = {
            penId: currentFeedingPenId,
            feedDefinitionId: selectedFeedDefinitionId,
            amount: parseFloat(document.getElementById('feed-amount')?.value) || 0,
            timestamp: Date.now()
        };
        localStorage.setItem('agriplanner_feeding_return', JSON.stringify(feedingContext));
    }

    showNotification(message || `Cần mua thêm ${productKeyword}`, 'warning');

    let url = `shop.html?category=${category}&search=${encodeURIComponent(productKeyword)}&quantity=${quantity}`;
    if (feedDefinitionId) {
        url += `&feedDefinitionId=${feedDefinitionId}`;
    }

    setTimeout(() => {
        window.location.href = url;
    }, 1500);
}

function showLivestockInventoryShortageModal(itemName, available, needed, category, keyword, feedDefinitionId) {
    const shortage = needed - available;
    const unit = category === 'TIEM_PHONG' ? 'liều' : 'kg';
    const emoji = category === 'TIEM_PHONG' ? '💉' : '🥩';

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
                <div style="font-size:48px;margin-bottom:16px;">${emoji}</div>
                <h4 style="margin-bottom:8px;">${itemName}</h4>
                <p style="color:#64748b;margin-bottom:16px;">
                    Cần: <strong>${needed}</strong> ${unit} • Trong kho: <strong>${available}</strong> ${unit} • Thiếu: <strong style="color:#ef4444;">${shortage}</strong> ${unit}
                </p>
                <p style="font-size:14px;color:#475569;">Bạn có muốn chuyển đến cửa hàng để mua thêm?</p>
            </div>
            <div class="modal-footer" style="padding:20px;border-top:1px solid #e2e8f0;display:flex;justify-content:center;gap:12px;">
                <button class="btn btn--secondary" onclick="document.getElementById('livestock-inventory-modal').remove()">Để sau</button>
                <button class="btn btn--primary" id="livestock-buy-now-btn">
                    <span class="material-symbols-outlined">shopping_cart</span> Mua ngay
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Attach click handler with feedDefinitionId
    document.getElementById('livestock-buy-now-btn').addEventListener('click', () => {
        document.getElementById('livestock-inventory-modal').remove();
        const purchaseQuantity = Math.ceil(shortage);
        redirectToShopFromLivestock(category, keyword, purchaseQuantity, 'Đang chuyển tới cửa hàng...', feedDefinitionId || null);
    });
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

    // Restore saved view mode (canvas or grid)
    if (currentLivestockView === 'grid') {
        toggleLivestockView('grid');
    }

    // Check if returning from shop purchase — auto-reopen feeding modal
    await checkFeedingReturnIntent();

    // Fetch weather for simulation
    _fetchWeatherForSim();
});

// Check if user returned from shop after buying feed — auto-reopen feeding modal
async function checkFeedingReturnIntent() {
    const urlParams = new URLSearchParams(window.location.search);
    const autoFeed = urlParams.get('autoFeed');
    const penId = urlParams.get('penId');

    if (!autoFeed || !penId) return;

    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);

    const feedingReturn = localStorage.getItem('agriplanner_feeding_return');
    if (!feedingReturn) return;

    try {
        const ctx = JSON.parse(feedingReturn);
        localStorage.removeItem('agriplanner_feeding_return');

        // Expired check (10 min)
        if (ctx.timestamp && Date.now() - ctx.timestamp > 10 * 60 * 1000) return;

        // Select the pen
        const targetPenId = parseInt(penId) || ctx.penId;
        const pen = allPens.find(p => p.id === targetPenId);
        if (!pen) return;

        selectPen(targetPenId);

        // Wait for pen selection to complete, then open feeding modal
        setTimeout(async () => {
            await openFeedingModal();

            // Wait for feeds to load, then auto-select the feed and fill amount
            setTimeout(() => {
                if (ctx.feedDefinitionId) {
                    const feedItem = document.querySelector(`.feed-item[data-feed-id="${ctx.feedDefinitionId}"]`);
                    if (feedItem) {
                        feedItem.click(); // Triggers selectFeed()
                    }
                }
                if (ctx.amount > 0) {
                    const amountInput = document.getElementById('feed-amount');
                    if (amountInput) amountInput.value = ctx.amount;
                    updateFeedCostPreview();
                }
                showNotification('Đã mua thức ăn thành công! Bạn có thể xác nhận cho ăn.', 'success');
            }, 800);
        }, 500);
    } catch (e) {
        console.error('Error restoring feeding context:', e);
        localStorage.removeItem('agriplanner_feeding_return');
    }
}

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

            // Auto-generate initial weight record based on selected size
            if (result && result.id) {
                autoGenerateInitialWeight(result, penData);
            }

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

/**
 * Automatically generate an initial weight record when a new pen is created.
 * Uses the selected animal size to determine starting weight.
 */
async function autoGenerateInitialWeight(createdPen, penData) {
    try {
        // Find the animal definition from allAnimals (loaded on page init)
        const animalDef = allAnimals?.find(a => a.id === penData.animalDefinitionId);
        if (!animalDef || !animalDef.sizes) return;

        let sizes;
        try {
            sizes = typeof animalDef.sizes === 'string' ? JSON.parse(animalDef.sizes) : animalDef.sizes;
        } catch (e) { return; }

        const selectedSize = (penData.animalSize || 'MEDIUM').toLowerCase();
        const sizeData = sizes[selectedSize] || sizes['medium'] || sizes['small'];
        if (!sizeData || !sizeData.weight) return;

        // Parse weight range
        const match = String(sizeData.weight).match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
        if (!match) return;

        const minW = parseFloat(match[1]);
        const maxW = parseFloat(match[2]);
        const avgWeight = Math.round(((minW + maxW) / 2) * 100) / 100;

        if (avgWeight <= 0 || isNaN(avgWeight)) return;

        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/feeding/growth`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                penId: createdPen.id,
                weight: avgWeight,
                date: new Date().toISOString().split('T')[0],
                notes: `Cân nặng ban đầu (${selectedSize}, ước tính ~${avgWeight} kg)`
            })
        });

        if (response.ok) {
            console.log(`Auto-generated initial weight: ${avgWeight} kg for pen ${createdPen.id}`);
            // Reload growth chart if this pen is currently selected
            if (selectedPen && selectedPen.id === createdPen.id) {
                loadGrowthChart(createdPen.id);
            }
        }
    } catch (e) {
        console.warn('Could not auto-generate initial weight:', e);
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

// ==================== VIEW TOGGLE ====================

let currentLivestockView = localStorage.getItem('livestockView') || 'canvas';

function toggleLivestockView(mode) {
    currentLivestockView = mode;
    localStorage.setItem('livestockView', mode);

    const canvasEl = document.getElementById('pen-canvas-container');
    const gridEl = document.getElementById('pen-grid-container');
    const toggleBtns = document.querySelectorAll('#livestock-view-toggle .view-toggle-btn');

    // Also hide/show canvas overlays
    const vizInfo = document.getElementById('pen-viz-info');
    const vizLegend = document.getElementById('pen-viz-legend');
    const soundToggle = document.getElementById('pen-viz-sound-toggle');

    toggleBtns.forEach(btn => {
        btn.classList.toggle('view-toggle-btn--active', btn.dataset.view === mode);
    });

    if (mode === 'grid') {
        // Pause simulation BEFORE hiding canvas to prevent zero-dimension position reset
        if (penSimulation) penSimulation.stop?.();

        // Show grid, hide canvas
        canvasEl.style.display = 'none';
        canvasEl.classList.add('view-hidden');

        gridEl.style.display = '';
        gridEl.offsetHeight;
        gridEl.classList.remove('view-hidden');

        if (vizInfo) vizInfo.style.display = 'none';
        if (vizLegend) vizLegend.style.display = 'none';
        if (soundToggle) soundToggle.style.display = 'none';

        renderPenGridView();
    } else {
        // Show canvas, hide grid
        gridEl.classList.add('view-hidden');
        setTimeout(() => { gridEl.style.display = 'none'; }, 300);

        canvasEl.style.display = '';
        canvasEl.offsetHeight;
        canvasEl.classList.remove('view-hidden');

        if (vizInfo && selectedPen) vizInfo.style.display = '';
        if (vizLegend && selectedPen?.animalCount > 0) vizLegend.style.display = 'flex';
        if (soundToggle) soundToggle.style.display = '';

        // Resume simulation
        if (penSimulation && selectedPen) {
            penSimulation.start?.();
        }
    }
}

function renderPenGridView() {
    const grid = document.getElementById('pen-grid-inner');
    if (!grid) return;

    grid.innerHTML = '';

    allPens.forEach((pen, idx) => {
        const card = document.createElement('div');
        const status = String(pen.status || 'EMPTY').toUpperCase();
        const isSelected = selectedPen && selectedPen.id === pen.id;
        const isEmpty = status === 'EMPTY' || !pen.animalDefinition;

        // Build class list
        let cls = 'pen-grid-card';
        if (status === 'DIRTY') cls += ' pen-grid-card--dirty';
        if (status === 'SICK') cls += ' pen-grid-card--sick';
        if (isEmpty && status === 'EMPTY') cls += ' pen-grid-card--empty';
        if (isSelected) cls += ' pen-grid-card--selected';

        card.className = cls;
        card.setAttribute('data-pen-id', pen.id);
        card.style.animationDelay = `${idx * 40}ms`;

        // Build inner HTML
        let html = `<span class="pen-grid-card__code">${pen.code}</span>`;

        // Alert icon for dirty/sick
        if (status === 'DIRTY') {
            html += `<div class="pen-grid-card__alert pen-grid-card__alert--warn">
                <span class="material-symbols-outlined">warning</span>
            </div>`;
        } else if (status === 'SICK') {
            html += `<div class="pen-grid-card__alert pen-grid-card__alert--sick">
                <span class="material-symbols-outlined">health_and_safety</span>
            </div>`;
        }

        if (isEmpty && status === 'EMPTY') {
            html += `<div class="pen-grid-card__body">
                <span class="pen-grid-card__empty-text">Trống</span>
            </div>`;
        } else {
            const animalDef = pen.animalDefinition;
            const count = pen.animalCount || 0;
            const unit = animalDef?.unit || 'con';
            const name = animalDef?.name || '';
            const icon = getAnimalIcon(animalDef);
            const imageUrl = animalDef?.imageUrl;

            let bodyContent = '';
            if (imageUrl) {
                bodyContent = `<img class="pen-grid-card__img" src="${imageUrl}" alt="${name}" onerror="this.style.display='none';this.nextElementSibling.style.display=''">
                    <span class="material-symbols-outlined pen-grid-card__icon" style="display:none">${icon}</span>`;
            } else {
                bodyContent = `<span class="material-symbols-outlined pen-grid-card__icon">${icon}</span>`;
            }
            bodyContent += `<span class="pen-grid-card__label">${count} ${unit}</span>`;

            html += `<div class="pen-grid-card__body">${bodyContent}</div>`;

            // Feeding status indicator
            const feedingIcon = getFeedingStatusIcon(pen);
            const feedingClass = getFeedingStatusClass(pen).replace('pen-card__feeding-status--', '');
            if (feedingClass) {
                html += `<div class="pen-grid-card__feeding pen-grid-card__feeding--${feedingClass}">
                    <span class="material-symbols-outlined">${feedingIcon}</span>
                </div>`;
            }
        }

        card.innerHTML = html;

        card.addEventListener('click', () => {
            // Remove previous selection
            grid.querySelectorAll('.pen-grid-card--selected').forEach(c => c.classList.remove('pen-grid-card--selected'));
            card.classList.add('pen-grid-card--selected');
            selectPen(pen.id);
        });

        grid.appendChild(card);
    });

    // Add "new pen" card
    const addCard = document.createElement('div');
    addCard.className = 'pen-grid-card pen-grid-card--empty';
    addCard.style.animationDelay = `${allPens.length * 40}ms`;
    addCard.innerHTML = `<div class="pen-grid-card__body">
        <span class="material-symbols-outlined pen-grid-card__icon" style="color:var(--color-primary)">add_circle</span>
        <span class="pen-grid-card__label" style="color:var(--color-primary)">Thêm chuồng</span>
    </div>`;
    addCard.addEventListener('click', () => openAddCageModal());
    grid.appendChild(addCard);
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

    // Highlight selected card in grid view
    document.querySelectorAll('.pen-grid-card').forEach(c => c.classList.remove('pen-grid-card--selected'));
    const gridCard = document.querySelector(`.pen-grid-card[data-pen-id="${pen.id}"]`);
    if (gridCard) gridCard.classList.add('pen-grid-card--selected');

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
            const daysSinceStart = Math.floor((new Date() - new Date(pen.startDate)) / (1000 * 60 * 60 * 24));
            const ageAtPurchase = pen.animalAgeAtPurchaseDays || 0;
            const totalAge = daysSinceStart + ageAtPurchase;
            statAge.textContent = totalAge > 0 ? `${totalAge} ngày` : 'Mới';
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

    // Hide health section for animals that don't need it (bees, silkworms, aquatic)
    const healthSection = document.getElementById('health-section');
    if (healthSection) {
        const needsHealth = needsVaccination(pen.animalDefinition);
        healthSection.style.display = needsHealth ? 'block' : 'none';
    }

    // Load mortality stats for the pen
    loadMortalityStats(pen.id);

    // Load Health Records (only if animal needs it)
    if (needsVaccination(pen.animalDefinition)) {
        loadHealthRecords(pen.id);
    }

    // Determine harvest type and show/hide chart sections
    const harvestType = pen.animalDefinition?.harvestType || 'WEIGHT_ONLY';
    const byproductType = pen.animalDefinition?.byproductType || 'NONE';

    const weightSection = document.getElementById('weight-chart-section');
    const byproductSection = document.getElementById('byproduct-chart-section');

    if (harvestType === 'BYPRODUCT_ONLY') {
        // Hide weight chart, show byproduct chart only
        if (weightSection) weightSection.style.display = 'none';
        if (byproductSection) byproductSection.style.display = 'block';
        loadByproductChart(pen.id, pen.animalDefinition);
    } else if (harvestType === 'BOTH') {
        // Show both charts
        if (weightSection) weightSection.style.display = 'block';
        if (byproductSection) byproductSection.style.display = 'block';
        loadGrowthChart(pen.id);
        loadByproductChart(pen.id, pen.animalDefinition);
    } else {
        // WEIGHT_ONLY - show weight chart only
        if (weightSection) weightSection.style.display = 'block';
        if (byproductSection) byproductSection.style.display = 'none';
        loadGrowthChart(pen.id);
    }

    // Update byproduct section icons & titles
    if (byproductType !== 'NONE' && byproductSection) {
        const bpIcon = document.getElementById('byproduct-icon');
        const bpTitle = document.getElementById('byproduct-title');
        const iconMap = { 'EGGS': 'egg', 'MILK': 'water_drop', 'HONEY': 'hive', 'SILK': 'stroke_full' };
        const titleMap = {
            'EGGS': `Xu hướng sản lượng trứng`,
            'MILK': `Xu hướng sản lượng sữa`,
            'HONEY': `Xu hướng sản lượng mật ong`,
            'SILK': `Xu hướng sản lượng tơ tằm`
        };
        if (bpIcon) bpIcon.textContent = iconMap[byproductType] || 'eco';
        if (bpTitle) bpTitle.textContent = titleMap[byproductType] || 'Xu hướng sản phẩm phụ';
    }

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

            // Re-render grid view if active
            if (currentLivestockView === 'grid') renderPenGridView();

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
                    <div class="age-input" id="age-input-group">
                        <label>Tuổi lúc mua (ngày)</label>
                        <input type="number" id="animal-age" min="0" value="1" placeholder="VD: 30">
                        <div class="form-hint" style="margin-top:4px;font-size:12px;color:#9ca3af;">
                            <span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;">info</span>
                            Tuổi của vật nuôi khi mua về (ngày tuổi)
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
    const age = parseInt(document.getElementById('animal-age')?.value) || 0;

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
        animalSize: size,
        animalAgeAtPurchaseDays: age
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

    // Load workers for selection
    await loadLivestockWorkers();
    document.getElementById('feed-worker-select').innerHTML = renderLivestockWorkerSelect('feed-worker');
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
        item.classList.remove('feed-item--dimmed');
    });

    // Mark selected and dim others
    const allItems = document.querySelectorAll('.feed-item:not(.feed-item--disabled)');
    allItems.forEach(item => {
        if (item.getAttribute('data-feed-id') == feed.feedDefinitionId) {
            item.classList.add('feed-item--selected');
        } else {
            item.classList.add('feed-item--dimmed');
        }
    });

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
                item.classList.remove('feed-item--dimmed');
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

    const workerId = document.getElementById('feed-worker')?.value;
    if (!workerId) {
        showNotification("Vui lòng chọn nhân công thực hiện", "error");
        return;
    }

    // Get selected feed name for display
    const selectedFeedItem = document.querySelector(`.feed-item--selected[data-feed-id="${selectedFeedDefinitionId}"]`) 
        || document.querySelector(`.feed-item[data-feed-id="${selectedFeedDefinitionId}"]`);
    const feedName = selectedFeedItem ? selectedFeedItem.querySelector('.feed-item__name')?.textContent || 'thức ăn' : 'thức ăn';

    // Check inventory by feedDefinitionId (precise match via backend API)
    const invCheck = await checkFeedStockByDefinitionId(selectedFeedDefinitionId, amount);

    if (!invCheck.hasEnough) {
        closeFeedingModal();
        showLivestockInventoryShortageModal(
            feedName,
            invCheck.available,
            amount,
            'THUC_AN',
            feedName,
            selectedFeedDefinitionId
        );
        return;
    }

    try {
        const penName = selectedPen?.code || `Chuồng #${currentFeedingPenId}`;
        const animalName = selectedPen?.animalDefinition?.name || 'vật nuôi';

        await createLivestockWorkflowTask({
            taskType: 'FEED',
            penId: currentFeedingPenId,
            workerId: workerId,
            name: `Cho ăn ${animalName} - ${penName}`,
            description: `Cho ăn ${amount} kg ${feedName} tại ${penName}. ${notes ? 'Ghi chú: ' + notes : ''}`,
            workflowData: {
                feedDefinitionId: selectedFeedDefinitionId,
                feedName: feedName,
                amountKg: amount,
                notes: notes,
                userEmail: localStorage.getItem('userEmail')
            }
        });

        showNotification(`Đã giao việc cho ăn ${animalName}`, "success");
        closeFeedingModal();
    } catch (e) {
        console.error('Error creating feeding task:', e);
        showNotification(e.message || 'Lỗi tạo công việc', 'error');
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

// ==================== REMINDER BADGES ====================

/**
 * Update the reminder badge for weight or byproduct sections.
 * Shows a warning if the last record was too long ago.
 * @param {'weight'|'byproduct'} type - The section type
 * @param {Array} records - The records array (must have recordedDate field)
 * @param {number} intervalDays - How many days between records is expected
 */
function updateReminderBadge(type, records, intervalDays) {
    const badgeEl = document.getElementById(`${type}-reminder-badge`);
    if (!badgeEl) return;

    if (!records || records.length === 0) {
        // No records at all — show initial prompt
        badgeEl.innerHTML = `<span class="reminder-badge reminder-badge--warning">
            <span class="material-symbols-outlined">notification_important</span>
            Chưa có dữ liệu
        </span>`;
        return;
    }

    // Find the most recent record date
    const dates = records.map(r => new Date(r.recordedDate || r.date)).filter(d => !isNaN(d));
    if (dates.length === 0) { badgeEl.innerHTML = ''; return; }

    const lastDate = new Date(Math.max(...dates));
    const now = new Date();
    const daysSince = Math.floor((now - lastDate) / 86400000);

    if (daysSince <= intervalDays) {
        // Recent enough — no badge
        badgeEl.innerHTML = '';
    } else if (daysSince <= intervalDays * 3) {
        // Warning level
        badgeEl.innerHTML = `<span class="reminder-badge reminder-badge--warning">
            <span class="material-symbols-outlined">schedule</span>
            ${daysSince} ngày trước
        </span>`;
    } else {
        // Danger level — overdue
        badgeEl.innerHTML = `<span class="reminder-badge reminder-badge--danger">
            <span class="material-symbols-outlined">warning</span>
            ${daysSince} ngày chưa ghi
        </span>`;
    }
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

            // Update weight reminder badge
            updateReminderBadge('weight', data, 7);

            if (data.length === 0) {
                container.innerHTML = '<p class="text-muted" style="text-align:center; padding: 20px;">Chưa có dữ liệu cân nặng</p>';
                return;
            }

            // Sort by date
            data.sort((a, b) => new Date(a.recordedDate) - new Date(b.recordedDate));

            const labels = data.map(d => formatDate(d.recordedDate));
            const values = data.map(d => d.avgWeightKg);

            // Use ApexCharts for professional rendering
            if (typeof ApexCharts !== 'undefined' && Charts.createApexAreaChart) {
                Charts.createApexAreaChart(container, {
                    data: values,
                    labels: labels,
                    color: '#10b981',
                    height: 200,
                    seriesName: 'Cân nặng TB',
                    unit: 'kg',
                    yAxisLabel: 'kg'
                });
            } else {
                Charts.createLineChart(container, {
                    data: values,
                    labels: labels,
                    color: '#10b981',
                    height: 160,
                    showDots: true,
                    fill: true
                });
            }
        } else {
            container.innerHTML = '<p class="text-error">Không thể tải biểu đồ</p>';
        }
    } catch (e) {
        console.error("Chart error:", e);
        container.innerHTML = '<p class="text-error">Lỗi tải dữ liệu</p>';
    }
}

// ==================== BYPRODUCT CHART ====================

async function loadByproductChart(penId, animalDef) {
    const container = document.getElementById('byproduct-chart');
    if (!container) return;

    container.innerHTML = '<div class="loading-spinner"></div>';

    const byproductName = animalDef?.byproductName || 'Sản phẩm phụ';
    const byproductUnit = animalDef?.byproductUnit || '';

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/pens/${penId}/byproduct`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (response.ok) {
            const data = await response.json();

            // Update byproduct reminder badge (every 1 day for daily products)
            updateReminderBadge('byproduct', data, 1);

            if (data.length === 0) {
                container.innerHTML = `<p class="text-muted" style="text-align:center; padding: 20px;">Chưa có dữ liệu ${byproductName.toLowerCase()}</p>`;
                // Update stats
                const totalEl = document.getElementById('byproduct-total');
                const avgEl = document.getElementById('byproduct-avg-daily');
                if (totalEl) totalEl.textContent = `0 ${byproductUnit}`;
                if (avgEl) avgEl.textContent = `0 ${byproductUnit}`;
                return;
            }

            data.sort((a, b) => new Date(a.recordedDate) - new Date(b.recordedDate));

            const labels = data.map(d => formatDate(d.recordedDate));
            const values = data.map(d => parseFloat(d.quantity));

            // Calculate stats
            const totalProduced = values.reduce((sum, v) => sum + v, 0);
            const avgDaily = data.length > 0 ? (totalProduced / data.length) : 0;

            const totalEl = document.getElementById('byproduct-total');
            const avgEl = document.getElementById('byproduct-avg-daily');
            if (totalEl) totalEl.textContent = `${totalProduced.toFixed(1)} ${byproductUnit}`;
            if (avgEl) avgEl.textContent = `${avgDaily.toFixed(1)} ${byproductUnit}`;

            // Color based on type
            const colorMap = { 'EGGS': '#f59e0b', 'MILK': '#3b82f6', 'HONEY': '#eab308', 'SILK': '#8b5cf6' };
            const chartColor = colorMap[animalDef?.byproductType] || '#f59e0b';

            // Use ApexCharts for professional rendering
            const byproductNameMap = { 'EGGS': 'Trứng', 'MILK': 'Sữa', 'HONEY': 'Mật ong', 'SILK': 'Tơ tằm' };
            const chartSeriesName = byproductNameMap[animalDef?.byproductType] || byproductName;

            if (typeof ApexCharts !== 'undefined' && Charts.createApexAreaChart) {
                Charts.createApexAreaChart(container, {
                    data: values,
                    labels: labels,
                    color: chartColor,
                    height: 200,
                    seriesName: chartSeriesName,
                    unit: byproductUnit,
                    yAxisLabel: byproductUnit
                });
            } else {
                Charts.createLineChart(container, {
                    data: values,
                    labels: labels,
                    color: chartColor,
                    height: 160,
                    showDots: true,
                    fill: true
                });
            }
        } else {
            container.innerHTML = '<p class="text-error">Không thể tải biểu đồ</p>';
        }
    } catch (e) {
        console.error("Byproduct chart error:", e);
        container.innerHTML = '<p class="text-error">Lỗi tải dữ liệu</p>';
    }
}

// ==================== WEIGHT RECORD MODAL ====================

/**
 * Estimate the current average weight of animals based on age and size definitions.
 * Parses the sizes JSON from animalDefinition to interpolate weight by growth progress.
 * @param {Object} pen - The selected pen object
 * @returns {{ estimated: number|null, ageInDays: number, hint: string }}
 */
function estimateCurrentWeight(pen) {
    const animalDef = pen?.animalDefinition;
    if (!animalDef || !animalDef.sizes) return { estimated: null, ageInDays: 0, hint: '' };

    // Calculate total age in days
    let daysSinceStart = 0;
    if (pen.startDate) {
        daysSinceStart = Math.max(0, Math.floor((Date.now() - new Date(pen.startDate).getTime()) / 86400000));
    }
    const ageAtPurchase = pen.animalAgeAtPurchaseDays || 0;
    const totalAgeDays = daysSinceStart + ageAtPurchase;

    // Parse sizes JSON
    let sizes;
    try {
        sizes = typeof animalDef.sizes === 'string' ? JSON.parse(animalDef.sizes) : animalDef.sizes;
    } catch (e) {
        return { estimated: null, ageInDays: totalAgeDays, hint: '' };
    }

    if (!sizes) return { estimated: null, ageInDays: totalAgeDays, hint: '' };

    // Extract weight ranges from sizes (format: "20-40kg" or "0.5-1kg" or "1-2kg mật/năm")
    function parseWeightRange(weightStr) {
        if (!weightStr) return null;
        const match = String(weightStr).match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
        if (match) return { min: parseFloat(match[1]), max: parseFloat(match[2]) };
        // Single value like "5kg"
        const single = String(weightStr).match(/([\d.]+)\s*kg/i);
        if (single) return { min: parseFloat(single[1]), max: parseFloat(single[1]) };
        return null;
    }

    const sizeKeys = ['small', 'medium', 'large'];
    const weightRanges = [];
    for (const key of sizeKeys) {
        if (sizes[key] && sizes[key].weight) {
            const range = parseWeightRange(sizes[key].weight);
            if (range) weightRanges.push({ key, ...range });
        }
    }

    if (weightRanges.length === 0) return { estimated: null, ageInDays: totalAgeDays, hint: '' };

    // Growth duration (days to reach full size)
    const growthDuration = animalDef.growthDurationDays || 180;

    // Growth progress (0.0 to 1.0+)
    const progress = Math.min(totalAgeDays / growthDuration, 1.0);

    // Interpolate: from smallest min to largest max
    const globalMin = weightRanges[0].min;
    const globalMax = weightRanges[weightRanges.length - 1].max;
    const estimated = globalMin + (globalMax - globalMin) * progress;

    // Round appropriately
    const rounded = estimated >= 10 ? Math.round(estimated * 10) / 10 : Math.round(estimated * 100) / 100;

    const hint = `Gợi ý: ~${rounded} kg (tuổi ${totalAgeDays} ngày, tiến độ ${Math.round(progress * 100)}%)`;

    return { estimated: rounded, ageInDays: totalAgeDays, hint };
}

/**
 * Estimate daily byproduct production based on animalDefinition parameters.
 * @param {Object} pen - The selected pen object
 * @returns {{ estimated: number|null, hint: string, canProduce: boolean }}
 */
function estimateByproductQuantity(pen) {
    const animalDef = pen?.animalDefinition;
    if (!animalDef) return { estimated: null, hint: '', canProduce: false };

    const dailyAmount = animalDef.byproductDailyAmount || 0;
    const count = pen.animalCount || 0;

    if (dailyAmount <= 0 || count <= 0) return { estimated: null, hint: '', canProduce: false };

    // Always produce — use seeded random for daily variation
    const todayKey = new Date().toISOString().slice(0, 10);
    const [yr, mo, dy] = todayKey.split('-').map(Number);
    const seed = ((pen.id || 0) * 2053 + yr * 366 + mo * 31 + dy) & 0x7FFF;
    const rand = (Math.sin(seed * 9301 + 49297) % 1 + 1) / 2;
    const estimated = Math.max(1, Math.round(dailyAmount * count * (0.6 + rand * 0.8)));
    const unit = animalDef.byproductUnit || '';
    const productName = animalDef.byproductName || 'sản phẩm';

    const hint = `Gợi ý: ~${estimated} ${unit} ${productName}/ngày (${count} con × ${dailyAmount} ${unit})`;

    return { estimated, hint, canProduce: true };
}

function openWeightRecordModal() {
    if (!selectedPen || !selectedPen.id) {
        showNotification('Vui lòng chọn chuồng trước', 'warning');
        return;
    }
    if (!selectedPen.animalCount || selectedPen.animalCount <= 0) {
        showNotification('Chuồng không có vật nuôi', 'warning');
        return;
    }

    const penName = `Chuồng ${selectedPen.code} — ${selectedPen.animalDefinition?.name || ''}`;
    document.getElementById('weight-record-pen-name').textContent = penName;
    document.getElementById('weight-record-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('weight-record-notes').value = '';

    // Auto-suggest weight
    const suggestion = estimateCurrentWeight(selectedPen);
    const weightInput = document.getElementById('weight-record-value');
    const suggestionEl = document.getElementById('weight-suggestion');
    const suggestionText = document.getElementById('weight-suggestion-text');
    const suggestionApply = document.getElementById('weight-suggestion-apply');

    if (suggestion.estimated !== null && suggestionEl && suggestionText) {
        weightInput.value = '';
        weightInput.placeholder = suggestion.estimated;
        suggestionText.textContent = suggestion.hint;
        suggestionEl.style.display = 'flex';

        // Apply suggestion on click
        if (suggestionApply) {
            suggestionApply.onclick = () => {
                weightInput.value = suggestion.estimated;
                weightInput.focus();
            };
        }
    } else {
        weightInput.value = '';
        weightInput.placeholder = '0.00';
        if (suggestionEl) suggestionEl.style.display = 'none';
    }

    const modal = document.getElementById('weight-record-modal');
    modal.classList.add('modal--visible');
}

function closeWeightRecordModal() {
    const modal = document.getElementById('weight-record-modal');
    modal.classList.remove('modal--visible');
}

async function submitWeightRecord() {
    if (!selectedPen) return;

    const weight = parseFloat(document.getElementById('weight-record-value').value);
    const date = document.getElementById('weight-record-date').value;
    const notes = document.getElementById('weight-record-notes').value;

    if (!weight || weight <= 0) {
        showNotification('Vui lòng nhập cân nặng hợp lệ', 'error');
        return;
    }

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/feeding/growth`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                penId: selectedPen.id,
                weight: weight,
                date: date,
                notes: notes
            })
        });

        if (response.ok) {
            showNotification('✅ Đã ghi nhận cân nặng thành công!', 'success');
            closeWeightRecordModal();
            loadGrowthChart(selectedPen.id);
        } else {
            const txt = await response.text();
            showNotification('Lỗi: ' + txt, 'error');
        }
    } catch (e) {
        showNotification('Lỗi kết nối: ' + e.message, 'error');
    }
}

// ==================== BYPRODUCT MANAGEMENT PANEL ====================

async function openByproductPanel() {
    if (!selectedPen || !selectedPen.id) {
        showNotification('Vui lòng chọn chuồng trước', 'warning');
        return;
    }

    const animalDef = selectedPen.animalDefinition;
    if (!animalDef || animalDef.byproductType === 'NONE') {
        showNotification('Vật nuôi này không có sản phẩm phụ', 'warning');
        return;
    }

    const byproductName = animalDef.byproductName || 'Sản phẩm phụ';
    const byproductUnit = animalDef.byproductUnit || '';
    const byproductType = animalDef.byproductType || 'NONE';
    const penName = `Chuồng ${selectedPen.code} — ${animalDef.name || ''}`;

    const iconMap = { 'EGGS': 'egg_alt', 'MILK': 'water_drop', 'HONEY': 'emoji_nature', 'SILK': 'gesture' };
    const colorMap = { 'EGGS': '#f59e0b', 'MILK': '#3b82f6', 'HONEY': '#eab308', 'SILK': '#8b5cf6' };
    const icon = iconMap[byproductType] || 'eco';
    const color = colorMap[byproductType] || '#f59e0b';

    // Estimate daily production
    const estimate = estimateByproductQuantity(selectedPen);

    // Remove existing panel
    let existing = document.getElementById('byproduct-panel-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'byproduct-panel-modal';
    modal.className = 'modal modal--visible';
    modal.innerHTML = `
        <div class="modal__content" style="max-width:650px;">
            <div class="modal__header" style="background:linear-gradient(135deg, ${color}22, ${color}11); border-bottom:1px solid ${color}33;">
                <h3 class="modal__title" style="display:flex; align-items:center; gap:8px;">
                    <span class="material-symbols-outlined" style="color:${color}; font-size:28px;">${icon}</span>
                    Quản lý ${byproductName}
                </h3>
                <button class="modal__close" onclick="document.getElementById('byproduct-panel-modal').remove()">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="modal__body" style="padding:20px;">
                <div style="text-align:center; color:#6b7280; font-size:14px; margin-bottom:16px;">${penName}</div>

                <!-- Stats Row -->
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:20px;">
                    <div style="background:${color}11; border:1px solid ${color}22; border-radius:12px; padding:14px; text-align:center;">
                        <div style="font-size:11px; color:#6b7280; margin-bottom:4px;">Tổng sản lượng</div>
                        <div style="font-size:20px; font-weight:800; color:${color};" id="bp-panel-total">
                            <span class="material-symbols-outlined rotating" style="font-size:18px;">sync</span>
                        </div>
                    </div>
                    <div style="background:#f0fdf411; border:1px solid #bbf7d033; border-radius:12px; padding:14px; text-align:center;">
                        <div style="font-size:11px; color:#6b7280; margin-bottom:4px;">TB/ngày</div>
                        <div style="font-size:20px; font-weight:800; color:#16a34a;" id="bp-panel-avg">—</div>
                    </div>
                    <div style="background:#eff6ff; border:1px solid #bfdbfe33; border-radius:12px; padding:14px; text-align:center;">
                        <div style="font-size:11px; color:#6b7280; margin-bottom:4px;">Ước tính/ngày</div>
                        <div style="font-size:20px; font-weight:800; color:#2563eb;">${estimate.canProduce ? estimate.estimated + ' ' + byproductUnit : '—'}</div>
                    </div>
                </div>

                ${!estimate.canProduce && estimate.hint ? `
                <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:12px 16px; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
                    <span class="material-symbols-outlined" style="color:#d97706; font-size:20px;">schedule</span>
                    <span style="font-size:13px; color:#92400e;">${estimate.hint}</span>
                </div>` : ''}

                <!-- Recent logs -->
                <div style="margin-bottom:20px;">
                    <div style="font-size:13px; font-weight:600; color:#374151; margin-bottom:8px;">Lịch sử ghi nhận gần đây</div>
                    <div id="bp-panel-logs" style="max-height:200px; overflow-y:auto;">
                        <div style="text-align:center; padding:20px; color:#9ca3af;">
                            <span class="material-symbols-outlined rotating" style="font-size:24px;">sync</span>
                        </div>
                    </div>
                </div>

                <!-- Action buttons -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
                    <button onclick="document.getElementById('byproduct-panel-modal').remove(); openByproductRecordModal();"
                        style="background:linear-gradient(135deg, ${color}, ${color}dd); color:white; border:none; border-radius:12px; padding:14px; font-size:14px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.2s;"
                        onmouseenter="this.style.transform='translateY(-1px)'" onmouseleave="this.style.transform=''">
                        <span class="material-symbols-outlined" style="font-size:20px;">add_circle</span>
                        Ghi nhận sản lượng
                    </button>
                    <button onclick="document.getElementById('byproduct-panel-modal').remove(); openSellByproductModal();"
                        style="background:linear-gradient(135deg, #059669, #10b981); color:white; border:none; border-radius:12px; padding:14px; font-size:14px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.2s;"
                        onmouseenter="this.style.transform='translateY(-1px)'" onmouseleave="this.style.transform=''">
                        <span class="material-symbols-outlined" style="font-size:20px;">storefront</span>
                        Bán ${byproductName}
                    </button>
                </div>
                <button onclick="document.getElementById('byproduct-panel-modal').remove(); openByproductCollectionTask();"
                    style="background:linear-gradient(135deg, #2563eb, #3b82f6); color:white; border:none; border-radius:12px; padding:14px; font-size:14px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; width:100%; transition:all 0.2s;"
                    onmouseenter="this.style.transform='translateY(-1px)'" onmouseleave="this.style.transform=''">
                    <span class="material-symbols-outlined" style="font-size:20px;">assignment_ind</span>
                    Giao việc thu ${byproductName.toLowerCase()}
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // Load data
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/pens/${selectedPen.id}/byproduct`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (response.ok) {
            const data = await response.json();

            // Update total
            const totalQty = data.reduce((sum, d) => sum + parseFloat(d.quantity || 0), 0);
            const avgDaily = data.length > 0 ? (totalQty / data.length) : 0;
            document.getElementById('bp-panel-total').textContent = `${totalQty.toFixed(1)} ${byproductUnit}`;
            document.getElementById('bp-panel-avg').textContent = `${avgDaily.toFixed(1)} ${byproductUnit}`;

            // Show recent logs (last 10)
            const logsContainer = document.getElementById('bp-panel-logs');
            const recentLogs = data.slice(-10).reverse();

            if (recentLogs.length === 0) {
                logsContainer.innerHTML = `<div style="text-align:center; padding:20px; color:#9ca3af; font-size:13px;">
                    <span class="material-symbols-outlined" style="font-size:32px; display:block; margin-bottom:4px;">inbox</span>
                    Chưa có dữ liệu ghi nhận
                </div>`;
            } else {
                logsContainer.innerHTML = recentLogs.map(log => {
                    const date = log.recordedDate ? new Date(log.recordedDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
                    return `<div style="display:flex; align-items:center; gap:10px; padding:10px 12px; border-bottom:1px solid #f3f4f6;">
                        <span class="material-symbols-outlined" style="font-size:18px; color:${color};">${icon}</span>
                        <div style="flex:1;">
                            <div style="font-size:13px; font-weight:600; color:#111827;">${parseFloat(log.quantity).toFixed(1)} ${log.unit || byproductUnit}</div>
                            ${log.notes ? `<div style="font-size:11px; color:#6b7280; margin-top:2px;">${log.notes}</div>` : ''}
                        </div>
                        <div style="font-size:12px; color:#9ca3af;">${date}</div>
                    </div>`;
                }).join('');
            }
        }
    } catch (e) {
        console.error('Error loading byproduct panel data:', e);
    }
}

// ==================== BYPRODUCT COLLECTION TASK ====================

async function openByproductCollectionTask() {
    if (!selectedPen || !selectedPen.id) {
        showNotification('Vui lòng chọn chuồng trước', 'warning');
        return;
    }
    const animalDef = selectedPen.animalDefinition;
    if (!animalDef || animalDef.byproductType === 'NONE') {
        showNotification('Vật nuôi này không có sản phẩm phụ', 'warning');
        return;
    }

    const byproductName = animalDef.byproductName || 'Sản phẩm phụ';
    const byproductUnit = animalDef.byproductUnit || '';
    const estimate = estimateByproductQuantity(selectedPen);
    const penName = `Chuồng ${selectedPen.code} — ${animalDef.name || ''}`;

    await loadLivestockWorkers();

    let modal = document.getElementById('byproduct-collection-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'byproduct-collection-modal';
    modal.className = 'modal modal--visible';
    modal.innerHTML = `
        <div class="modal__content" style="max-width:500px;">
            <div class="modal__header">
                <h3 class="modal__title" style="display:flex; align-items:center; gap:8px;">
                    <span class="material-symbols-outlined" style="color:#2563eb;">assignment_ind</span>
                    Giao việc thu ${byproductName.toLowerCase()}
                </h3>
                <button class="modal__close" onclick="document.getElementById('byproduct-collection-modal').remove()">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="modal__body" style="padding:20px;">
                <div style="text-align:center; color:#6b7280; font-size:14px; margin-bottom:16px;">${penName}</div>

                ${estimate.canProduce ? `
                <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:12px 16px; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
                    <span class="material-symbols-outlined" style="color:#2563eb; font-size:20px;">lightbulb</span>
                    <span style="font-size:13px; color:#1e40af;">${estimate.hint}</span>
                </div>` : ''}

                <div style="margin-bottom:16px;">
                    <label style="font-size:13px; font-weight:600; color:#374151; margin-bottom:6px; display:block;">Ghi chú (tùy chọn)</label>
                    <textarea id="bp-collection-notes" class="modal-input" rows="2" placeholder="VD: Thu toàn bộ sản phẩm buổi sáng..." style="width:100%; padding:10px 14px; border-radius:8px; border:1px solid #d1d5db; font-size:14px; resize:vertical;"></textarea>
                </div>

                ${renderLivestockWorkerSelect('bp-collection-worker')}

                <div style="margin-top:16px;">
                    <button onclick="submitByproductCollectionTask()" id="bp-collection-submit"
                        style="background:linear-gradient(135deg, #2563eb, #3b82f6); color:white; border:none; border-radius:12px; padding:14px; font-size:15px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; width:100%; transition:all 0.2s;"
                        onmouseenter="this.style.transform='translateY(-1px)'" onmouseleave="this.style.transform=''">
                        <span class="material-symbols-outlined" style="font-size:20px;">send</span>
                        Giao việc
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

async function submitByproductCollectionTask() {
    if (!selectedPen) return;

    const workerId = document.getElementById('bp-collection-worker')?.value;
    if (!workerId) {
        showNotification('Vui lòng chọn nhân công', 'error');
        return;
    }

    const notes = document.getElementById('bp-collection-notes')?.value || '';
    const animalDef = selectedPen.animalDefinition;
    const byproductName = animalDef?.byproductName || 'Sản phẩm phụ';
    const penName = selectedPen.code || `Chuồng #${selectedPen.id}`;
    const estimate = estimateByproductQuantity(selectedPen);

    const submitBtn = document.getElementById('bp-collection-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-symbols-outlined rotating" style="font-size:18px;">sync</span> Đang xử lý...';

    try {
        await createLivestockWorkflowTask({
            taskType: 'HARVEST',
            penId: selectedPen.id,
            workerId: workerId,
            name: `Thu ${byproductName.toLowerCase()} - ${penName}`,
            description: `Thu ${byproductName.toLowerCase()} tại ${penName} (${animalDef?.name || ''}).${estimate.canProduce ? ' Ước tính: ~' + estimate.estimated + ' ' + (animalDef?.byproductUnit || '') : ''}${notes ? ' Ghi chú: ' + notes : ''}`,
            workflowData: {
                subType: 'BYPRODUCT_COLLECTION',
                byproductType: animalDef?.byproductType || 'NONE',
                byproductName: byproductName,
                byproductUnit: animalDef?.byproductUnit || '',
                estimatedQuantity: estimate.estimated || 0,
                notes: notes
            }
        });

        showNotification(`Đã giao việc thu ${byproductName.toLowerCase()}`, 'success');
        document.getElementById('byproduct-collection-modal')?.remove();
    } catch (error) {
        console.error('Byproduct collection task error:', error);
        showNotification(error.message || 'Lỗi tạo công việc', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px;">send</span> Giao việc';
    }
}

// ==================== BYPRODUCT RECORD MODAL ====================

function openByproductRecordModal() {
    if (!selectedPen || !selectedPen.id) {
        showNotification('Vui lòng chọn chuồng trước', 'warning');
        return;
    }
    if (!selectedPen.animalCount || selectedPen.animalCount <= 0) {
        showNotification('Chuồng không có vật nuôi', 'warning');
        return;
    }

    const animalDef = selectedPen.animalDefinition;
    const byproductName = animalDef?.byproductName || 'Sản phẩm phụ';
    const byproductUnit = animalDef?.byproductUnit || 'đơn vị';
    const byproductType = animalDef?.byproductType || 'NONE';

    const penName = `Chuồng ${selectedPen.code} — ${animalDef?.name || ''}`;
    document.getElementById('byproduct-record-pen-name').textContent = penName;
    document.getElementById('byproduct-record-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('byproduct-record-notes').value = '';
    document.getElementById('byproduct-record-unit').textContent = byproductUnit;
    document.getElementById('byproduct-record-hint').textContent = `Sản lượng ${byproductName.toLowerCase()} thu được`;

    // Update modal title icon
    const iconMap = { 'EGGS': 'egg', 'MILK': 'water_drop', 'HONEY': 'hive', 'SILK': 'stroke_full' };
    const modalIcon = document.getElementById('byproduct-modal-icon');
    const modalTitle = document.getElementById('byproduct-modal-title');
    if (modalIcon) modalIcon.textContent = iconMap[byproductType] || 'eco';
    if (modalTitle) modalTitle.textContent = `Ghi nhận ${byproductName}`;

    // Auto-suggest byproduct quantity
    const suggestion = estimateByproductQuantity(selectedPen);
    const quantityInput = document.getElementById('byproduct-record-value');
    const suggestionEl = document.getElementById('byproduct-suggestion');
    const suggestionText = document.getElementById('byproduct-suggestion-text');
    const suggestionApply = document.getElementById('byproduct-suggestion-apply');

    if (suggestion.estimated !== null && suggestionEl && suggestionText) {
        quantityInput.value = '';
        quantityInput.placeholder = suggestion.estimated;
        suggestionText.textContent = suggestion.hint;
        suggestionEl.style.display = 'flex';

        if (suggestionApply) {
            suggestionApply.onclick = () => {
                quantityInput.value = suggestion.estimated;
                quantityInput.focus();
            };
        }
    } else {
        quantityInput.value = '';
        quantityInput.placeholder = '0';
        if (suggestionEl) {
            if (suggestion.hint) {
                // Show "not old enough" message
                suggestionText.textContent = suggestion.hint;
                suggestionEl.style.display = 'flex';
                if (suggestionApply) suggestionApply.style.display = 'none';
            } else {
                suggestionEl.style.display = 'none';
            }
        }
    }

    const modal = document.getElementById('byproduct-record-modal');
    modal.classList.add('modal--visible');
}

function closeByproductRecordModal() {
    const modal = document.getElementById('byproduct-record-modal');
    modal.classList.remove('modal--visible');
}

async function submitByproductRecord() {
    if (!selectedPen) return;

    const quantity = parseFloat(document.getElementById('byproduct-record-value').value);
    const date = document.getElementById('byproduct-record-date').value;
    const notes = document.getElementById('byproduct-record-notes').value;
    const animalDef = selectedPen.animalDefinition;

    if (!quantity || quantity <= 0) {
        showNotification('Vui lòng nhập sản lượng hợp lệ', 'error');
        return;
    }

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/pens/${selectedPen.id}/byproduct`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                productType: animalDef?.byproductType || 'NONE',
                quantity: quantity,
                unit: animalDef?.byproductUnit || '',
                date: date,
                notes: notes
            })
        });

        if (response.ok) {
            const productName = animalDef?.byproductName || 'sản phẩm';
            showNotification(`✅ Đã ghi nhận ${productName} thành công!`, 'success');
            // Mark today's byproduct as collected on the canvas
            if (penSimulation) penSimulation.markCollected(selectedPen.id);
            closeByproductRecordModal();
            loadByproductChart(selectedPen.id, animalDef);
        } else {
            const txt = await response.text();
            showNotification('Lỗi: ' + txt, 'error');
        }
    } catch (e) {
        showNotification('Lỗi kết nối: ' + e.message, 'error');
    }
}

// ==================== SELL BYPRODUCT MODAL ====================

let sellByproductPenData = null;

function openSellByproductModal() {
    if (!selectedPen || !selectedPen.id) {
        showNotification('Vui lòng chọn chuồng trước', 'warning');
        return;
    }

    const animalDef = selectedPen.animalDefinition;
    if (!animalDef || animalDef.byproductType === 'NONE') {
        showNotification('Vật nuôi này không có sản phẩm phụ', 'warning');
        return;
    }

    sellByproductPenData = selectedPen;
    const byproductName = animalDef.byproductName || 'Sản phẩm phụ';
    const byproductUnit = animalDef.byproductUnit || '';

    document.getElementById('sell-byproduct-title').textContent = `Bán ${byproductName}`;
    document.getElementById('sell-bp-product-name').textContent = byproductName;
    document.getElementById('sell-bp-unit').textContent = byproductUnit;
    document.getElementById('sell-bp-price-unit').textContent = `₫/${byproductUnit}`;
    document.getElementById('sell-bp-quantity').value = '';
    document.getElementById('sell-bp-price').value = '';
    document.getElementById('sell-bp-notes').value = '';

    // Load total produced
    loadByproductTotalForSell(selectedPen.id);

    // Reset preview
    updateSellByproductPreview();

    const modal = document.getElementById('sell-byproduct-modal');
    modal.classList.add('modal--visible');

    // Live preview listeners
    document.getElementById('sell-bp-quantity').addEventListener('input', updateSellByproductPreview);
    document.getElementById('sell-bp-price').addEventListener('input', updateSellByproductPreview);
}

function closeSellByproductModal() {
    const modal = document.getElementById('sell-byproduct-modal');
    modal.classList.remove('modal--visible');
    sellByproductPenData = null;
    document.getElementById('sell-bp-quantity').removeEventListener('input', updateSellByproductPreview);
    document.getElementById('sell-bp-price').removeEventListener('input', updateSellByproductPreview);
}

async function loadByproductTotalForSell(penId) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/pens/${penId}/byproduct/total`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (response.ok) {
            const data = await response.json();
            const unit = data.unit || '';
            document.getElementById('sell-bp-total-produced').textContent = `${parseFloat(data.total || 0).toFixed(1)} ${unit}`;
        }
    } catch (e) {
        console.error('Error loading byproduct total:', e);
    }
}

function updateSellByproductPreview() {
    const quantity = parseFloat(document.getElementById('sell-bp-quantity').value) || 0;
    const price = parseFloat(document.getElementById('sell-bp-price').value) || 0;
    const total = quantity * price;
    const unit = sellByproductPenData?.animalDefinition?.byproductUnit || '';

    document.getElementById('sell-bp-preview-qty').textContent = `${quantity} ${unit}`;
    document.getElementById('sell-bp-preview-price').textContent = formatCurrency(price);
    document.getElementById('sell-bp-preview-total').textContent = formatCurrency(total);

    const submitBtn = document.getElementById('sell-bp-submit-btn');
    submitBtn.disabled = !(quantity > 0 && price > 0);
}

async function submitSellByproduct() {
    if (!sellByproductPenData) return;

    const quantity = parseFloat(document.getElementById('sell-bp-quantity').value);
    const price = parseFloat(document.getElementById('sell-bp-price').value);
    const notes = document.getElementById('sell-bp-notes').value;
    const animalDef = sellByproductPenData.animalDefinition;

    if (!quantity || quantity <= 0 || !price || price <= 0) {
        showNotification('Vui lòng nhập số lượng và giá hợp lệ', 'error');
        return;
    }

    const submitBtn = document.getElementById('sell-bp-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-symbols-outlined icon-sm rotating">sync</span> Đang xử lý...';

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/pens/${sellByproductPenData.id}/sell-byproduct`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                quantity: quantity,
                pricePerUnit: price,
                notes: notes,
                productName: animalDef?.byproductName || 'Sản phẩm phụ'
            })
        });

        const result = await response.json();

        if (response.ok) {
            const totalRevenue = quantity * price;
            showNotification(`🎉 Bán ${animalDef?.byproductName || 'sản phẩm'} thành công! +${formatCurrency(totalRevenue)}`, 'success');
            closeSellByproductModal();
        } else {
            showNotification(result.error || 'Lỗi khi bán sản phẩm', 'error');
        }
    } catch (error) {
        console.error('Sell byproduct error:', error);
        showNotification('Lỗi kết nối server', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-symbols-outlined icon-sm">check_circle</span> Xác nhận bán';
    }
}

// Window exports consolidated at end of file

// ==================== HARVEST/SELL LOGIC ====================

let harvestPenData = null;
let currentHarvestMode = 'animal'; // 'animal' | 'byproduct'

async function openHarvestModal() {
    if (!selectedPen || !selectedPen.id) {
        showNotification('Vui lòng chọn chuồng trước', 'warning');
        return;
    }

    const harvestType = selectedPen.animalDefinition?.harvestType || 'WEIGHT_ONLY';

    // BYPRODUCT_ONLY animals (bees, silkworms): go straight to sell byproduct modal
    if (harvestType === 'BYPRODUCT_ONLY') {
        openSellByproductModal();
        return;
    }

    if (!selectedPen.animalCount || selectedPen.animalCount <= 0) {
        showNotification('Chuồng không có vật nuôi để bán', 'warning');
        return;
    }

    harvestPenData = selectedPen;
    currentHarvestMode = 'animal';

    const animalDef = selectedPen.animalDefinition || {};
    const animalName = animalDef.name || 'Không xác định';
    const unit = animalDef.unit || 'con';
    const currentCount = selectedPen.animalCount || 0;
    const refPrice = animalDef.sellPricePerUnit || 0;

    // Update modal icon/title
    document.getElementById('harvest-modal-icon').textContent = harvestType === 'BOTH' ? 'payments' : 'agriculture';
    document.getElementById('harvest-modal-title').textContent = 'Thu hoạch / Bán vật nuôi';

    // Populate info cards
    document.getElementById('harvest-animal-name').textContent = animalName;
    document.getElementById('harvest-current-count').textContent = `${currentCount} ${unit}`;
    document.getElementById('harvest-start-date').textContent = formatDate(selectedPen.startDate);
    document.getElementById('harvest-ref-price').textContent = formatCurrency(refPrice) + `/${unit}`;

    // Show/hide toggle & configure for BOTH
    const toggleContainer = document.getElementById('harvest-type-toggle');
    if (toggleContainer) {
        if (harvestType === 'BOTH') {
            const iconMap = { 'EGGS': 'egg', 'MILK': 'water_drop', 'HONEY': 'hive', 'SILK': 'stroke_full' };
            const labelMap = { 'EGGS': 'Bán trứng', 'MILK': 'Bán sữa', 'HONEY': 'Bán mật ong', 'SILK': 'Bán tơ tằm' };
            const bt = animalDef.byproductType || 'EGGS';
            const bpIcon = document.getElementById('harvest-toggle-bp-icon');
            const bpLabel = document.getElementById('harvest-toggle-bp-label');
            if (bpIcon) bpIcon.textContent = iconMap[bt] || 'eco';
            if (bpLabel) bpLabel.textContent = labelMap[bt] || 'Bán sản phẩm phụ';
            toggleContainer.style.display = 'flex';
            // Initialise byproduct icon in info section
            const bpIconDisplay = document.getElementById('harvest-bp-icon-display');
            if (bpIconDisplay) bpIconDisplay.textContent = iconMap[bt] || 'eco';
            const bpUnitEl = document.getElementById('harvest-bp-unit');
            const bpPriceUnitEl = document.getElementById('harvest-bp-price-unit');
            if (bpUnitEl) bpUnitEl.textContent = animalDef.byproductUnit || 'đơn vị';
            if (bpPriceUnitEl) bpPriceUnitEl.textContent = `₫/${animalDef.byproductUnit || 'đơn vị'}`;
        } else {
            toggleContainer.style.display = 'none';
        }
    }

    // Reset forms
    document.getElementById('harvest-quantity').value = '';
    document.getElementById('harvest-quantity').max = currentCount;
    document.getElementById('harvest-qty-unit').textContent = unit;
    document.getElementById('harvest-price-unit').textContent = `₫/${unit}`;
    document.getElementById('harvest-price').value = refPrice;
    document.getElementById('harvest-notes').value = '';
    document.getElementById('harvest-quantity-hint').textContent = `Tối đa: ${currentCount} ${unit}`;

    if (document.getElementById('harvest-bp-quantity')) document.getElementById('harvest-bp-quantity').value = '';
    if (document.getElementById('harvest-bp-price')) document.getElementById('harvest-bp-price').value = '';
    if (document.getElementById('harvest-bp-notes')) document.getElementById('harvest-bp-notes').value = '';
    document.getElementById('harvest-bp-total-produced').textContent = '--';

    // Switch to animal tab first
    switchHarvestTab('animal');

    // Load workers
    await loadLivestockWorkers();
    document.getElementById('harvest-worker-select').innerHTML = renderLivestockWorkerSelect('harvest-worker');

    // Show modal
    document.getElementById('harvest-modal').classList.add('modal--visible');

    // Live preview listeners
    document.getElementById('harvest-quantity').addEventListener('input', updateHarvestPreview);
    document.getElementById('harvest-price').addEventListener('input', updateHarvestPreview);
    if (document.getElementById('harvest-bp-quantity')) {
        document.getElementById('harvest-bp-quantity').addEventListener('input', updateHarvestByproductPreview);
        document.getElementById('harvest-bp-price').addEventListener('input', updateHarvestByproductPreview);
    }
}

function closeHarvestModal() {
    document.getElementById('harvest-modal').classList.remove('modal--visible');
    harvestPenData = null;
    document.getElementById('harvest-quantity').removeEventListener('input', updateHarvestPreview);
    document.getElementById('harvest-price').removeEventListener('input', updateHarvestPreview);
    if (document.getElementById('harvest-bp-quantity')) {
        document.getElementById('harvest-bp-quantity').removeEventListener('input', updateHarvestByproductPreview);
        document.getElementById('harvest-bp-price').removeEventListener('input', updateHarvestByproductPreview);
    }
}

function switchHarvestTab(type) {
    const btnAnimal = document.getElementById('harvest-toggle-animal');
    const btnByproduct = document.getElementById('harvest-toggle-byproduct');
    const animalSection = document.getElementById('harvest-animal-section');
    const bpSection = document.getElementById('harvest-bp-section');
    const submitLabel = document.getElementById('harvest-submit-label');
    const submitBtn = document.getElementById('harvest-submit-btn');

    currentHarvestMode = type;

    if (type === 'byproduct') {
        if (btnAnimal) btnAnimal.classList.remove('active');
        if (btnByproduct) btnByproduct.classList.add('active');
        if (animalSection) animalSection.style.display = 'none';
        if (bpSection) bpSection.style.display = 'block';
        if (submitLabel) {
            const bpNameMap = { 'EGGS': 'trứng', 'MILK': 'sữa', 'HONEY': 'mật ong', 'SILK': 'tơ tằm' };
            const bt = harvestPenData?.animalDefinition?.byproductType || 'EGGS';
            submitLabel.textContent = `Bán ${bpNameMap[bt] || 'sản phẩm'}`;
        }
        if (submitBtn) submitBtn.disabled = true;
        // Load total byproduct produced for this pen
        if (harvestPenData) loadByproductTotalForHarvest(harvestPenData.id);
        updateHarvestByproductPreview();
    } else {
        if (btnAnimal) btnAnimal.classList.add('active');
        if (btnByproduct) btnByproduct.classList.remove('active');
        if (animalSection) animalSection.style.display = 'block';
        if (bpSection) bpSection.style.display = 'none';
        if (submitLabel) submitLabel.textContent = 'Giao việc thu hoạch';
        updateHarvestPreview();
    }
}

// Keep old name as alias for any existing HTML references
function switchHarvestType(type) { switchHarvestTab(type); }

async function loadByproductTotalForHarvest(penId) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/pens/${penId}/byproduct/total`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (response.ok) {
            const data = await response.json();
            const unit = harvestPenData?.animalDefinition?.byproductUnit || data.unit || '';
            document.getElementById('harvest-bp-total-produced').textContent = `${parseFloat(data.total || 0).toFixed(1)} ${unit}`;
        }
    } catch (e) { /* silence */ }
}

function updateHarvestPreview() {
    const quantity = parseInt(document.getElementById('harvest-quantity').value) || 0;
    const price = parseFloat(document.getElementById('harvest-price').value) || 0;
    const total = quantity * price;
    const maxCount = harvestPenData?.animalCount || 0;
    const unit = harvestPenData?.animalDefinition?.unit || 'con';

    document.getElementById('preview-quantity').textContent = `${quantity} ${unit}`;
    document.getElementById('preview-price').textContent = formatCurrency(price);
    document.getElementById('preview-total').textContent = formatCurrency(total);

    const submitBtn = document.getElementById('harvest-submit-btn');
    const isValid = quantity > 0 && quantity <= maxCount && price > 0;
    submitBtn.disabled = !isValid;

    const hint = document.getElementById('harvest-quantity-hint');
    if (quantity > maxCount && maxCount > 0) {
        hint.textContent = `⚠️ Vượt quá số lượng! Tối đa: ${maxCount}`;
        hint.style.color = '#dc2626';
    } else {
        hint.textContent = `Tối đa: ${maxCount} ${unit}`;
        hint.style.color = '';
    }
}

function updateHarvestByproductPreview() {
    const qtyEl = document.getElementById('harvest-bp-quantity');
    const priceEl = document.getElementById('harvest-bp-price');
    if (!qtyEl || !priceEl) return;
    const quantity = parseFloat(qtyEl.value) || 0;
    const price = parseFloat(priceEl.value) || 0;
    const total = quantity * price;
    const unit = harvestPenData?.animalDefinition?.byproductUnit || '';

    const previewQtyEl = document.getElementById('harvest-bp-preview-qty');
    const previewPriceEl = document.getElementById('harvest-bp-preview-price');
    const previewTotalEl = document.getElementById('harvest-bp-preview-total');
    if (previewQtyEl) previewQtyEl.textContent = `${quantity} ${unit}`;
    if (previewPriceEl) previewPriceEl.textContent = formatCurrency(price);
    if (previewTotalEl) previewTotalEl.textContent = formatCurrency(total);

    const submitBtn = document.getElementById('harvest-submit-btn');
    if (submitBtn) submitBtn.disabled = !(quantity > 0 && price > 0);
}

async function submitHarvest() {
    if (!harvestPenData) return;

    // Byproduct tab: sell byproduct directly
    if (currentHarvestMode === 'byproduct') {
        await _submitHarvestByproduct();
        return;
    }

    // Animal tab: create harvest task
    const quantity = parseInt(document.getElementById('harvest-quantity').value);
    const price = parseFloat(document.getElementById('harvest-price').value);
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
    const workerId = document.getElementById('harvest-worker')?.value;
    if (!workerId) {
        showNotification('Vui lòng chọn nhân công thực hiện', 'error');
        return;
    }

    const submitBtn = document.getElementById('harvest-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-symbols-outlined icon-sm rotating">sync</span> Đang xử lý...';

    try {
        const animalName = harvestPenData.animalDefinition?.name || 'Vật nuôi';
        const unit = harvestPenData.animalDefinition?.unit || 'con';
        const penName = harvestPenData.code || `Chuồng #${harvestPenData.id}`;

        await createLivestockWorkflowTask({
            taskType: 'HARVEST',
            penId: harvestPenData.id,
            workerId: workerId,
            name: `Thu hoạch ${animalName} - ${penName}`,
            description: `Bán ${quantity} ${unit} ${animalName} tại ${penName}. Giá: ${formatCurrency(price)}/${unit}. Tổng: ${formatCurrency(quantity * price)}.${notes ? ' Ghi chú: ' + notes : ''}`,
            workflowData: { quantity, pricePerUnit: price, notes, animalName }
        });

        showNotification(`Đã giao việc thu hoạch ${animalName}`, 'success');
        closeHarvestModal();
    } catch (error) {
        console.error('Harvest error:', error);
        showNotification(error.message || 'Lỗi tạo công việc', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-symbols-outlined icon-sm">assignment_ind</span><span id="harvest-submit-label">Giao việc thu hoạch</span>';
    }
}

async function _submitHarvestByproduct() {
    const quantity = parseFloat(document.getElementById('harvest-bp-quantity').value);
    const price = parseFloat(document.getElementById('harvest-bp-price').value);
    const notes = document.getElementById('harvest-bp-notes').value;
    const animalDef = harvestPenData.animalDefinition;

    if (!quantity || quantity <= 0 || !price || price <= 0) {
        showNotification('Vui lòng nhập số lượng và giá hợp lệ', 'error');
        return;
    }

    const submitBtn = document.getElementById('harvest-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-symbols-outlined icon-sm rotating">sync</span> Đang xử lý...';

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/pens/${harvestPenData.id}/sell-byproduct`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
            body: JSON.stringify({
                quantity, pricePerUnit: price, notes,
                productName: animalDef?.byproductName || 'Sản phẩm phụ'
            })
        });

        const result = await response.json();
        if (response.ok) {
            showNotification(`🎉 Bán ${animalDef?.byproductName || 'sản phẩm'} thành công! +${formatCurrency(quantity * price)}`, 'success');
            closeHarvestModal();
        } else {
            showNotification(result.error || 'Lỗi khi bán sản phẩm', 'error');
        }
    } catch (error) {
        console.error('Sell byproduct via harvest modal error:', error);
        showNotification('Lỗi kết nối server', 'error');
    } finally {
        submitBtn.disabled = false;
        const bpNameMap = { 'EGGS': 'trứng', 'MILK': 'sữa', 'HONEY': 'mật ong', 'SILK': 'tơ tằm' };
        const bt = harvestPenData?.animalDefinition?.byproductType || 'EGGS';
        submitBtn.innerHTML = `<span class="material-symbols-outlined icon-sm">check_circle</span><span id="harvest-submit-label">Bán ${bpNameMap[bt] || 'sản phẩm'}</span>`;
    }
}

// Make harvest functions global
// Window exports consolidated at end of file

// ==================== WORKFLOW UI LOGIC ====================

/**
 * Determines if an animal type needs vaccination based on category.
 * Land animals and poultry need vaccination.
 * Aquatic animals, bees, and silkworms don't get traditional vaccines.
 */
function needsVaccination(animalDef) {
    if (!animalDef) return false;
    const category = (animalDef.category || '').toUpperCase();
    const name = (animalDef.name || '').toLowerCase();

    // Land animals (cattle, buffalo, pigs, goats, sheep) always need vaccination
    if (category === 'LAND') return true;

    // SPECIAL category: poultry needs vaccination, but bees/silkworms don't
    if (category === 'SPECIAL') {
        if (name.includes('ong') || name.includes('tằm')) return false;
        return true; // Gà, Vịt, Ngan, Ngỗng, Chim cút
    }

    // Aquatic animals (FRESHWATER, BRACKISH, SALTWATER) don't get vaccinated
    return false;
}

function updateUIForWorkflow(pen) {
    // Buttons
    const btnSelect = document.getElementById('btn-select-animal');
    const btnFeed = document.getElementById('btn-feed');
    const btnClean = document.getElementById('btn-clean');
    const btnVaccine = document.getElementById('btn-vaccine');
    const btnMortality = document.getElementById('btn-mortality');
    const btnHarvest = document.getElementById('btn-harvest');
    const btnByproduct = document.getElementById('btn-byproduct');
    const btnDelete = document.getElementById('btn-delete-pen');
    const btnUtility = document.getElementById('btn-utility');

    // Reset default
    [btnFeed, btnClean, btnVaccine, btnMortality, btnHarvest, btnByproduct, btnUtility].forEach(btn => disableButton(btn));
    enableButton(btnDelete); // Always allow delete

    // Remove vaccine tooltip class
    if (btnVaccine) btnVaccine.classList.remove('action-btn--no-vaccine');

    if (!pen.animalCount || pen.animalCount === 0) {
        // Empty State: Step 1 active
        enableButton(btnSelect);
        enableButton(btnDelete);
        enableButton(btnUtility); // Allow utility setup even for empty pens
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

        // Mortality button: enabled for normal animals, disabled for bees/silkworms
        if (name.includes('ong') || name.includes('tằm')) {
            disableButton(btnMortality);
        } else {
            enableButton(btnMortality);
        }

        // Vaccine button: only for animals that need vaccination
        if (needsVaccination(pen.animalDefinition)) {
            enableButton(btnVaccine);
        } else {
            disableButton(btnVaccine);
            if (btnVaccine) btnVaccine.classList.add('action-btn--no-vaccine');
            // Change label to indicate why it's disabled
            const btnLabel = btnVaccine?.querySelector('.action-btn__label');
            if (btnLabel) btnLabel.textContent = 'Tiêm phòng';
        }

        enableButton(btnHarvest);
        enableButton(btnUtility);

        // Update harvest button label based on harvest type
        if (btnHarvest) {
            const harvestType = pen.animalDefinition?.harvestType || 'WEIGHT_ONLY';
            const btnLabel = btnHarvest.querySelector('.action-btn__label');
            const btnIcon = btnHarvest.querySelector('.material-symbols-outlined');
            if (harvestType === 'BYPRODUCT_ONLY') {
                if (btnLabel) btnLabel.textContent = 'Bán sản phẩm';
                if (btnIcon) btnIcon.textContent = 'storefront';
            } else if (harvestType === 'BOTH') {
                if (btnLabel) btnLabel.textContent = 'Thu hoạch';
                if (btnIcon) btnIcon.textContent = 'payments';
            } else {
                if (btnLabel) btnLabel.textContent = 'Thu hoạch';
                if (btnIcon) btnIcon.textContent = 'agriculture';
            }
        }

        // Byproduct button: only for animals that produce byproducts
        const byproductType = pen.animalDefinition?.byproductType || 'NONE';
        if (byproductType && byproductType !== 'NONE' && btnByproduct) {
            enableButton(btnByproduct);
            const bpLabel = btnByproduct.querySelector('.action-btn__label');
            const bpIcon = btnByproduct.querySelector('.material-symbols-outlined');
            const bpIconMap = { 'EGGS': 'egg_alt', 'MILK': 'water_drop', 'HONEY': 'emoji_nature', 'SILK': 'gesture' };
            const bpLabelMap = { 'EGGS': 'Thu trứng', 'MILK': 'Vắt sữa', 'HONEY': 'Thu mật', 'SILK': 'Thu tơ' };
            if (bpIcon) bpIcon.textContent = bpIconMap[byproductType] || 'egg_alt';
            if (bpLabel) bpLabel.textContent = bpLabelMap[byproductType] || 'Sản phẩm phụ';
        }
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

    // Load workers and show selection modal
    await loadLivestockWorkers();

    // Create a dynamic modal for worker selection
    let modal = document.getElementById('clean-workflow-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.className = 'modal modal--visible';
    modal.id = 'clean-workflow-modal';
    modal.innerHTML = `
        <div class="modal__content" style="max-width:480px;">
            <div class="modal__header" style="background:linear-gradient(135deg,#10b981,#059669); color:white; border-radius:16px 16px 0 0; padding:20px 24px;">
                <h3 class="modal__title" style="color:white; margin:0; display:flex; align-items:center; gap:10px;">
                    <span class="material-symbols-outlined">cleaning_services</span>
                    Vệ sinh chuồng
                </h3>
                <button class="modal__close" onclick="document.getElementById('clean-workflow-modal').remove()" style="color:white;"><span class="material-symbols-outlined">close</span></button>
            </div>
            <div class="modal__body" style="padding:24px;">
                <div style="padding:16px; background:#ecfdf5; border-radius:12px; border:1px solid #a7f3d0; margin-bottom:16px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="material-symbols-outlined" style="font-size:32px; color:#059669;">home</span>
                        <div>
                            <div style="font-weight:700; color:#065f46; font-size:15px;">${selectedPen.code || 'Chuồng'}</div>
                            <div style="font-size:13px; color:#6b7280;">${selectedPen.animalDefinition?.name || 'Vật nuôi'} - ${selectedPen.animalCount || 0} ${selectedPen.animalDefinition?.unit || 'con'}</div>
                        </div>
                    </div>
                </div>
                ${renderLivestockWorkerSelect('clean-worker')}
            </div>
            <div class="modal__footer" style="padding:16px 24px; border-top:1px solid #e5e7eb;">
                <button class="btn btn--secondary" onclick="document.getElementById('clean-workflow-modal').remove()">Hủy</button>
                <button class="btn btn--primary" onclick="confirmCleanPen()" style="background:linear-gradient(135deg,#10b981,#059669);">
                    <span class="material-symbols-outlined icon-sm">assignment</span>
                    Giao việc vệ sinh
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function confirmCleanPen() {
    const workerId = document.getElementById('clean-worker')?.value;
    if (!workerId) {
        showNotification('Vui lòng chọn nhân công thực hiện', 'error');
        return;
    }

    try {
        const penName = selectedPen.code || `Chuồng #${selectedPen.id}`;
        await createLivestockWorkflowTask({
            taskType: 'CLEAN',
            penId: selectedPen.id,
            workerId: workerId,
            name: `Vệ sinh chuồng - ${penName}`,
            description: `Vệ sinh ${penName} (${selectedPen.animalDefinition?.name || 'vật nuôi'})`,
            workflowData: {}
        });

        document.getElementById('clean-workflow-modal')?.remove();
        showNotification(`Đã giao việc vệ sinh ${penName}`, 'success');
    } catch (e) {
        console.error(e);
        showNotification(e.message || 'Lỗi tạo công việc', 'error');
    }
}

// ==================== VACCINATION SYSTEM (Comprehensive) ====================

let cachedVaccineSchedules = [];
let cachedHealthRecords = [];
let currentVaccineFilter = 'all';
let vaccineModalPenId = null; // Track which pen the vaccine modal is showing

// Vaccine cost estimates per animal type (VND per dose per animal)
const VACCINE_COST_MAP = {
    // Gia súc lớn (Trâu, Bò)
    'Lở mồm long móng': { cost: 15000, unit: 'liều' },
    'Tụ huyết trùng': { cost: 12000, unit: 'liều' },
    'Ký sinh trùng đường máu': { cost: 8000, unit: 'liều' },
    'Viêm phổi': { cost: 10000, unit: 'liều' },
    'Viêm vú': { cost: 20000, unit: 'liều' },
    'Sốt sữa': { cost: 25000, unit: 'liều' },
    'Giun sán': { cost: 5000, unit: 'liều' },
    // Lợn
    'Dịch tả lợn': { cost: 8000, unit: 'liều' },
    'Tai xanh (PRRS)': { cost: 12000, unit: 'liều' },
    'Suyễn lợn': { cost: 6000, unit: 'liều' },
    'Tiêu chảy phân trắng': { cost: 5000, unit: 'liều' },
    'Phó thương hàn': { cost: 7000, unit: 'liều' },
    'E.coli': { cost: 6000, unit: 'liều' },
    // Gia cầm
    'Newcastle': { cost: 500, unit: 'liều' },
    'Cúm gia cầm (H5N1)': { cost: 800, unit: 'liều' },
    'Gumboro': { cost: 400, unit: 'liều' },
    'Cầu trùng': { cost: 300, unit: 'liều' },
    'Dịch tả vịt': { cost: 600, unit: 'liều' },
    'Viêm gan virus': { cost: 700, unit: 'liều' },
    'Marek': { cost: 500, unit: 'liều' },
    // Dê/Cừu
    'Đậu dê': { cost: 5000, unit: 'liều' },
    'Tẩy giun định kỳ': { cost: 3000, unit: 'liều' },
    'Viêm ruột hoại tử': { cost: 8000, unit: 'liều' },
};

async function openVaccineModal() {
    if (!selectedPen || !selectedPen.animalDefinition) {
        showNotification('Vui lòng chọn chuồng có vật nuôi', 'warning');
        return;
    }

    const modal = document.getElementById('vaccination-modal');
    if (!modal) return;

    // Show modal
    modal.classList.add('modal--visible');

    // Render pen selector bar (all pens that need vaccination)
    renderVaccinePenSelector();

    // Load data for the selected pen
    await loadVaccineDataForPen(selectedPen);
}

function renderVaccinePenSelector() {
    const container = document.getElementById('vaccine-pen-selector');
    if (!container) return;

    // Filter pens that have animals and need vaccination
    const vaccinePens = allPens.filter(p => p.animalCount > 0 && needsVaccination(p.animalDefinition));

    if (vaccinePens.length <= 1) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';
    container.innerHTML = vaccinePens.map(pen => {
        const isActive = pen.id === (vaccineModalPenId || selectedPen?.id);
        const animalName = pen.animalDefinition?.name || '?';
        return `
            <button class="vaccine-pen-chip ${isActive ? 'vaccine-pen-chip--active' : ''}"
                    onclick="switchVaccinePen(${pen.id})">
                <span class="material-symbols-outlined" style="font-size: 16px;">${getAnimalIcon(pen.animalDefinition)}</span>
                <span>${pen.code}</span>
                <span class="vaccine-pen-chip__count">${animalName} · ${pen.animalCount}</span>
            </button>
        `;
    }).join('');
}

async function switchVaccinePen(penId) {
    const pen = allPens.find(p => p.id === penId);
    if (!pen) return;
    await loadVaccineDataForPen(pen);
    renderVaccinePenSelector();
}

async function loadVaccineDataForPen(pen) {
    vaccineModalPenId = pen.id;
    const animalDef = pen.animalDefinition;

    // Update title
    const titleEl = document.getElementById('vaccine-modal-title');
    if (titleEl) titleEl.textContent = `Tiêm phòng - ${pen.code} (${animalDef.name})`;

    // Render pen info card
    renderVaccinePenInfo(pen);

    // Show loading
    const listEl = document.getElementById('vaccine-list');
    if (listEl) {
        listEl.innerHTML = '<div class="vaccine-list__loading"><span class="material-symbols-outlined spin">progress_activity</span><span>Đang tải lịch tiêm phòng...</span></div>';
    }

    // Reset filter
    currentVaccineFilter = 'all';
    document.querySelectorAll('.vaccine-filter-tab').forEach(tab => {
        tab.classList.toggle('vaccine-filter-tab--active', tab.dataset.filter === 'all');
    });

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const [schedulesRes, healthRes] = await Promise.all([
            fetch(`${API_BASE_URL}/livestock/vaccination-schedules/${animalDef.id}`, { headers }),
            fetch(`${API_BASE_URL}/livestock/pens/${pen.id}/health`, { headers })
        ]);

        cachedVaccineSchedules = schedulesRes.ok ? await schedulesRes.json() : [];
        const allHealth = healthRes.ok ? await healthRes.json() : [];
        cachedHealthRecords = allHealth.filter(h => h.eventType === 'VACCINE');

        renderVaccineList(pen);
        renderVaccineCostEstimate(pen);
        populateVaccineSelect();
    } catch (error) {
        console.error('Error loading vaccination data:', error);
        if (listEl) {
            listEl.innerHTML = '<div class="vaccine-list__empty"><span class="material-symbols-outlined">error</span>Lỗi tải dữ liệu tiêm phòng</div>';
        }
    }
}

function renderVaccinePenInfo(pen) {
    const container = document.getElementById('vaccine-pen-info');
    if (!container) return;

    const animalDef = pen.animalDefinition;
    const startDate = pen.startDate ? new Date(pen.startDate) : new Date();
    const ageAtPurchase = pen.ageAtPurchase || 0;
    const daysSinceStart = Math.floor((new Date() - startDate) / (1000 * 60 * 60 * 24));
    const currentAge = daysSinceStart + ageAtPurchase;

    container.innerHTML = `
        <div class="vaccine-pen-info__grid">
            <div class="vaccine-pen-info__item">
                <span class="material-symbols-outlined">pets</span>
                <div>
                    <div class="vaccine-pen-info__label">Vật nuôi</div>
                    <div class="vaccine-pen-info__value">${animalDef.name} × ${pen.animalCount} ${animalDef.unit || 'con'}</div>
                </div>
            </div>
            <div class="vaccine-pen-info__item">
                <span class="material-symbols-outlined">calendar_month</span>
                <div>
                    <div class="vaccine-pen-info__label">Tuổi hiện tại</div>
                    <div class="vaccine-pen-info__value">${currentAge} ngày</div>
                </div>
            </div>
            <div class="vaccine-pen-info__item">
                <span class="material-symbols-outlined">event_available</span>
                <div>
                    <div class="vaccine-pen-info__label">Ngày nhập chuồng</div>
                    <div class="vaccine-pen-info__value">${startDate.toLocaleDateString('vi-VN')}</div>
                </div>
            </div>
            <div class="vaccine-pen-info__item">
                <span class="material-symbols-outlined">health_and_safety</span>
                <div>
                    <div class="vaccine-pen-info__label">Tình trạng</div>
                    <div class="vaccine-pen-info__value" style="color: var(--color-success);">Đang nuôi</div>
                </div>
            </div>
        </div>
    `;
}

function renderVaccineCostEstimate(pen) {
    const container = document.getElementById('vaccine-cost-estimate');
    if (!container) return;

    const animalCount = pen.animalCount || 1;
    const startDate = pen.startDate ? new Date(pen.startDate) : new Date();
    const ageAtPurchase = pen.ageAtPurchase || 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items = buildVaccineItems(startDate, ageAtPurchase, today);
    const pending = items.filter(i => i.status !== 'completed');

    if (pending.length === 0) {
        container.innerHTML = `
            <div class="vaccine-cost-card vaccine-cost-card--done">
                <span class="material-symbols-outlined">verified</span>
                <span>Tất cả vaccine đã hoàn thành! Không có chi phí phát sinh.</span>
            </div>
        `;
        return;
    }

    let totalCost = 0;
    let nextVaccine = null;
    let nextDate = null;

    pending.forEach(item => {
        const costEntry = findVaccineCost(item.name);
        const itemCost = costEntry ? costEntry.cost * animalCount : 0;
        totalCost += itemCost;
        if (!nextDate || item.targetDate < nextDate) {
            nextDate = item.targetDate;
            nextVaccine = item;
        }
    });

    const nextCostEntry = nextVaccine ? findVaccineCost(nextVaccine.name) : null;
    const nextCost = nextCostEntry ? nextCostEntry.cost * animalCount : 0;

    container.innerHTML = `
        <div class="vaccine-cost-grid">
            <div class="vaccine-cost-card">
                <div class="vaccine-cost-card__icon" style="background: rgba(239,68,68,0.1); color: var(--color-error);">
                    <span class="material-symbols-outlined">payments</span>
                </div>
                <div>
                    <div class="vaccine-cost-card__label">Tổng chi phí dự kiến</div>
                    <div class="vaccine-cost-card__value">${totalCost > 0 ? formatMoney(totalCost) : 'Liên hệ thú y'}</div>
                    <div class="vaccine-cost-card__sub">${pending.length} mũi × ${animalCount} ${pen.animalDefinition?.unit || 'con'}</div>
                </div>
            </div>
            <div class="vaccine-cost-card">
                <div class="vaccine-cost-card__icon" style="background: rgba(59,130,246,0.1); color: var(--color-primary);">
                    <span class="material-symbols-outlined">event_upcoming</span>
                </div>
                <div>
                    <div class="vaccine-cost-card__label">Mũi tiêm tiếp theo</div>
                    <div class="vaccine-cost-card__value">${nextVaccine ? nextVaccine.name : '--'}</div>
                    <div class="vaccine-cost-card__sub">${nextDate ? nextDate.toLocaleDateString('vi-VN') : '--'}${nextCost > 0 ? ' · ~' + formatMoney(nextCost) : ''}</div>
                </div>
            </div>
        </div>
    `;
}

function findVaccineCost(name) {
    // Try exact match first
    if (VACCINE_COST_MAP[name]) return VACCINE_COST_MAP[name];
    // Try partial match
    const lowerName = name.toLowerCase();
    for (const [key, val] of Object.entries(VACCINE_COST_MAP)) {
        if (lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName)) {
            return val;
        }
    }
    return null;
}

function formatMoney(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

function closeVaccineModal() {
    const modal = document.getElementById('vaccination-modal');
    if (modal) modal.classList.remove('modal--visible');
    vaccineModalPenId = null;
}

function renderVaccineList(pen) {
    const listEl = document.getElementById('vaccine-list');
    if (!listEl) return;

    const activePen = pen || allPens.find(p => p.id === vaccineModalPenId) || selectedPen;
    if (!activePen) return;

    const startDate = activePen.startDate ? new Date(activePen.startDate) : new Date();
    const ageAtPurchase = activePen.ageAtPurchase || 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items = buildVaccineItems(startDate, ageAtPurchase, today);
    updateVaccineSummary(items);

    const filtered = currentVaccineFilter === 'all'
        ? items
        : items.filter(item => item.status === currentVaccineFilter);

    if (filtered.length === 0) {
        const filterLabels = { all: 'tiêm phòng', completed: 'đã hoàn thành', overdue: 'quá hạn', upcoming: 'sắp tới' };
        listEl.innerHTML = `<div class="vaccine-list__empty"><span class="material-symbols-outlined">vaccines</span>Không có mục ${filterLabels[currentVaccineFilter] || ''} nào</div>`;
        return;
    }

    listEl.innerHTML = '';
    filtered.sort((a, b) => {
        const order = { overdue: 0, upcoming: 1, completed: 2 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return (a.targetDate || 0) - (b.targetDate || 0);
    });

    const animalCount = activePen.animalCount || 1;
    filtered.forEach(item => {
        const el = createVaccineItemElement(item, animalCount);
        listEl.appendChild(el);
    });
}

function buildVaccineItems(startDate, ageAtPurchase, today) {
    const items = [];

    const healthByName = {};
    cachedHealthRecords.forEach(hr => {
        const key = hr.name.toLowerCase().trim();
        if (!healthByName[key]) healthByName[key] = [];
        healthByName[key].push(hr);
    });

    cachedVaccineSchedules.forEach(schedule => {
        const daysOffset = schedule.ageDays - ageAtPurchase;
        const targetDate = new Date(startDate);
        targetDate.setDate(targetDate.getDate() + Math.max(0, daysOffset));
        targetDate.setHours(0, 0, 0, 0);

        const key = schedule.name.toLowerCase().trim();
        const matchedRecords = healthByName[key] || [];
        const completedRecord = matchedRecords.find(r => r.status === 'COMPLETED');
        const plannedRecord = matchedRecords.find(r => r.status === 'PLANNED');

        let status = 'upcoming';
        let healthRecord = completedRecord || plannedRecord || null;

        if (completedRecord) {
            status = 'completed';
            healthRecord = completedRecord;
        } else if (targetDate < today) {
            status = 'overdue';
        }

        items.push({
            schedule,
            healthRecord,
            targetDate,
            status,
            name: schedule.name,
            description: schedule.description || '',
            isMandatory: schedule.isMandatory || schedule.mandatory,
            ageDays: schedule.ageDays,
        });
    });

    return items;
}

function updateVaccineSummary(items) {
    const total = items.length;
    const completed = items.filter(i => i.status === 'completed').length;
    const overdue = items.filter(i => i.status === 'overdue').length;
    const upcoming = items.filter(i => i.status === 'upcoming').length;

    const setCount = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setCount('vaccine-total-count', total);
    setCount('vaccine-completed-count', completed);
    setCount('vaccine-overdue-count', overdue);
    setCount('vaccine-upcoming-count', upcoming);
}

function createVaccineItemElement(item, animalCount) {
    const el = document.createElement('div');
    el.className = `vaccine-item vaccine-item--${item.status}`;

    const iconClass = `vaccine-item__icon--${item.status}`;
    const iconName = item.status === 'completed' ? 'check_circle'
        : item.status === 'overdue' ? 'warning' : 'schedule';

    const statusLabel = item.status === 'completed' ? 'Đã tiêm'
        : item.status === 'overdue' ? 'Quá hạn' : 'Sắp tới';

    const dateStr = item.targetDate ? item.targetDate.toLocaleDateString('vi-VN') : '--';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((item.targetDate - today) / (1000 * 60 * 60 * 24));
    let timeLabel = '';
    if (item.status === 'overdue') {
        timeLabel = `Quá hạn ${Math.abs(diffDays)} ngày`;
    } else if (item.status === 'upcoming') {
        timeLabel = diffDays === 0 ? 'Hôm nay' : `Còn ${diffDays} ngày`;
    } else if (item.healthRecord) {
        const completedDate = new Date(item.healthRecord.eventDate);
        timeLabel = `Hoàn thành: ${completedDate.toLocaleDateString('vi-VN')}`;
    }

    const mandatoryBadge = item.isMandatory
        ? '<span class="vaccine-item__mandatory">Bắt buộc</span>'
        : '<span class="vaccine-item__optional">Tùy chọn</span>';

    // Cost estimate for this vaccine
    const costEntry = findVaccineCost(item.name);
    const itemCost = costEntry ? costEntry.cost * (animalCount || 1) : 0;
    const costLabel = itemCost > 0 ? `~${formatMoney(itemCost)}` : '';

    const actionBtn = item.status !== 'completed'
        ? `<button class="vaccine-item__action-btn" onclick="event.stopPropagation(); confirmVaccineComplete(${item.healthRecord ? item.healthRecord.id : 'null'}, '${item.name.replace(/'/g, "\\'")}')">
              <span class="material-symbols-outlined">check</span>
              Hoàn thành
           </button>`
        : '';

    el.innerHTML = `
        <div class="vaccine-item__icon ${iconClass}">
            <span class="material-symbols-outlined">${iconName}</span>
        </div>
        <div class="vaccine-item__info">
            <div class="vaccine-item__name">
                ${item.name}
                ${mandatoryBadge}
            </div>
            ${item.description ? `<div class="vaccine-item__desc">${item.description}</div>` : ''}
            <div class="vaccine-item__meta">
                <span class="vaccine-item__meta-item">
                    <span class="material-symbols-outlined">event</span>
                    ${dateStr}
                </span>
                <span class="vaccine-item__meta-item">
                    <span class="material-symbols-outlined">timer</span>
                    Ngày tuổi: ${item.ageDays}
                </span>
                ${costLabel ? `<span class="vaccine-item__meta-item" style="color: var(--color-warning);">
                    <span class="material-symbols-outlined">payments</span>
                    ${costLabel}
                </span>` : ''}
                ${timeLabel ? `<span class="vaccine-item__meta-item" style="color: ${item.status === 'overdue' ? 'var(--color-error)' : 'inherit'}">
                    <span class="material-symbols-outlined">${item.status === 'overdue' ? 'error' : 'info'}</span>
                    ${timeLabel}
                </span>` : ''}
            </div>
        </div>
        <div class="vaccine-item__actions">
            <span class="vaccine-item__status-badge vaccine-item__status-badge--${item.status}">${statusLabel}</span>
            ${actionBtn}
        </div>
    `;

    if (item.healthRecord && item.healthRecord.notes) {
        el.title = `Ghi chú: ${item.healthRecord.notes}`;
    }

    return el;
}

function filterVaccineList(filter) {
    currentVaccineFilter = filter;
    document.querySelectorAll('.vaccine-filter-tab').forEach(tab => {
        tab.classList.toggle('vaccine-filter-tab--active', tab.dataset.filter === filter);
    });
    renderVaccineList();
}

async function confirmVaccineComplete(healthRecordId, vaccineName) {
    const penId = vaccineModalPenId || selectedPen?.id;
    if (!penId) return;

    const confirmed = confirm(`Xác nhận đã hoàn thành tiêm: ${vaccineName}?`);
    if (!confirmed) return;

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };

        if (healthRecordId) {
            const res = await fetch(`${API_BASE_URL}/livestock/health/${healthRecordId}/status`, {
                method: 'PUT', headers,
                body: JSON.stringify({ status: 'COMPLETED' })
            });
            if (!res.ok) throw new Error('Failed to update');
        } else {
            const res = await fetch(`${API_BASE_URL}/livestock/pens/${penId}/health`, {
                method: 'POST', headers,
                body: JSON.stringify({
                    eventType: 'VACCINE', name: vaccineName,
                    eventDate: new Date().toISOString().split('T')[0],
                    status: 'COMPLETED', notes: 'Hoàn thành từ lịch tiêm phòng'
                })
            });
            if (!res.ok) throw new Error('Failed to create');
        }

        showNotification(`✅ Đã ghi nhận tiêm: ${vaccineName}`, 'success');

        // Reload
        const healthRes = await fetch(`${API_BASE_URL}/livestock/pens/${penId}/health`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (healthRes.ok) {
            const allHealth = await healthRes.json();
            cachedHealthRecords = allHealth.filter(h => h.eventType === 'VACCINE');
        }

        const activePen = allPens.find(p => p.id === penId);
        renderVaccineList(activePen);
        renderVaccineCostEstimate(activePen);

        // If it's the currently selected pen, reload sidebar health timeline too
        if (selectedPen && selectedPen.id === penId) {
            loadHealthRecords(penId);
        }
    } catch (error) {
        console.error('Error completing vaccine:', error);
        showNotification('Lỗi khi cập nhật tiêm phòng', 'error');
    }
}

function populateVaccineSelect() {
    const select = document.getElementById('vaccine-record-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- Chọn loại vaccine --</option>';

    cachedVaccineSchedules.forEach(schedule => {
        const option = document.createElement('option');
        option.value = schedule.name;
        const mandatoryText = (schedule.isMandatory || schedule.mandatory) ? ' [Bắt buộc]' : '';
        option.textContent = `${schedule.name} (ngày ${schedule.ageDays})${mandatoryText}`;
        select.appendChild(option);
    });
}

function openAddVaccineRecord() {
    const modal = document.getElementById('add-vaccine-record-modal');
    if (!modal) return;

    const dateInput = document.getElementById('vaccine-record-date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    const statusSelect = document.getElementById('vaccine-record-status');
    if (statusSelect) statusSelect.value = 'COMPLETED';

    const notesInput = document.getElementById('vaccine-record-notes');
    if (notesInput) notesInput.value = '';

    const selectInput = document.getElementById('vaccine-record-select');
    if (selectInput) selectInput.value = '';

    // Load workers for selection
    loadLivestockWorkers().then(() => {
        const workerDiv = document.getElementById('vaccine-worker-select');
        if (workerDiv) workerDiv.innerHTML = renderLivestockWorkerSelect('vaccine-worker');
    });

    modal.classList.add('modal--visible');
}

function closeAddVaccineRecord() {
    const modal = document.getElementById('add-vaccine-record-modal');
    if (modal) modal.classList.remove('modal--visible');
}

async function submitVaccineRecord() {
    const penId = vaccineModalPenId || selectedPen?.id;
    if (!penId) return;

    const name = document.getElementById('vaccine-record-select')?.value;
    const date = document.getElementById('vaccine-record-date')?.value;
    const notes = document.getElementById('vaccine-record-notes')?.value || '';

    if (!name) { showNotification('Vui lòng chọn loại vaccine', 'warning'); return; }
    if (!date) { showNotification('Vui lòng chọn ngày tiêm', 'warning'); return; }

    const workerId = document.getElementById('vaccine-worker')?.value;
    if (!workerId) {
        showNotification('Vui lòng chọn nhân công thực hiện', 'error');
        return;
    }

    // Check vaccine inventory
    await loadLivestockInventory();
    const pen = allPens.find(p => p.id === penId);
    const animalCount = pen?.animalCount || 1;
    const invCheck = checkLivestockInventory('TIEM_PHONG', name, animalCount);

    if (!invCheck.hasEnough) {
        closeAddVaccineRecord();
        showLivestockInventoryShortageModal(
            `Vaccine ${name}`,
            invCheck.available,
            animalCount,
            'TIEM_PHONG',
            name,
            null
        );
        return;
    }

    try {
        const penName = pen?.code || `Chuồng #${penId}`;
        const animalName = pen?.animalDefinition?.name || 'vật nuôi';

        await createLivestockWorkflowTask({
            taskType: 'VACCINATE',
            penId: penId,
            workerId: workerId,
            name: `Tiêm phòng ${name} - ${penName}`,
            description: `Tiêm phòng ${name} cho ${animalName} tại ${penName}. Ngày: ${date}. ${notes ? 'Ghi chú: ' + notes : ''}`,
            workflowData: { vaccineName: name, eventDate: date, notes: notes }
        });

        showNotification(`Đã giao việc tiêm phòng ${name}`, 'success');
        closeAddVaccineRecord();
    } catch (error) {
        console.error('Error creating vaccine task:', error);
        showNotification(error.message || 'Lỗi tạo công việc', 'error');
    }
}

function openVaccineScheduleModal() {
    openVaccineModal();
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
        'MARKET_UPDATE': 'trending_up',
        'PEN_MORTALITY': 'heart_broken',
        'PEN_STATUS_CHANGE': 'pets'
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
        'MARKET_UPDATE': 'icon--green',
        'PEN_MORTALITY': 'icon--red',
        'PEN_STATUS_CHANGE': 'icon--orange'
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
        }).catch(() => { });
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

// Track last known pen notification count to detect new pen changes
let _lastPenNotifCount = 0;

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

    // Auto-refresh pen data when new pen-related notifications arrive
    const penNotifs = cachedNotifications.filter(n =>
        (n.type === 'PEN_MORTALITY' || n.type === 'PEN_STATUS_CHANGE') && !n.isRead && !readIds.includes(n.id)
    );
    if (penNotifs.length > _lastPenNotifCount) {
        // New pen notifications detected — refresh pen data
        try {
            await refreshPensData();
        } catch (e) {
            console.error('Auto-refresh pens failed:', e);
        }
    }
    _lastPenNotifCount = penNotifs.length;
}, 30000);

/**
 * Refresh pen data from server and update the UI immediately
 * Called when pen-related notifications are detected
 */
async function refreshPensData() {
    if (!currentFarmId) return;
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('accessToken');
        const response = await fetch(`${API_BASE_URL}/livestock/pens?farmId=${currentFarmId}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (!response.ok) return;
        const pens = await response.json();

        // Update pens array
        allPens = pens;

        // Re-render pen selector bar to show updated status dots
        renderPenSelectorBar();

        // Update selected pen if it exists
        if (selectedPen && selectedPen.id) {
            const updatedPen = pens.find(p => p.id === selectedPen.id);
            if (updatedPen) {
                const oldCount = selectedPen.animalCount;
                const oldStatus = selectedPen.status;
                selectedPen = updatedPen;

                // Re-render pen detail if count or status changed
                if (updatedPen.animalCount !== oldCount || updatedPen.status !== oldStatus) {
                    updatePenDetails(selectedPen);

                    // Update canvas simulation
                    if (penSimulation) {
                        penSimulation.loadPen(selectedPen);
                    }

                    // Show toast about changes
                    let changeMsg = `Chuồng ${updatedPen.code} đã cập nhật`;
                    if (updatedPen.animalCount !== oldCount) {
                        changeMsg += `: ${updatedPen.animalCount} con`;
                    }
                    showNotification(changeMsg, 'info');
                }
            }
        }
    } catch (e) {
        console.error('refreshPensData error:', e);
    }
}

window.refreshPensData = refreshPensData;

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

// ==================== MORTALITY / LOSS MANAGEMENT ====================

let mortalityPenData = null;
let selectedMortalityCauseType = 'DEATH';

async function loadMortalityStats(penId) {
    const statHealth = document.getElementById('stat-health');
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/pens/${penId}/mortality-history`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (!response.ok) return;
        const records = await response.json();

        if (records && records.length > 0) {
            // Sum total lost from notes (format: "X con - notes")
            let totalLost = 0;
            records.forEach(r => {
                const match = r.notes?.match(/^(\d+)\s*con/);
                if (match) totalLost += parseInt(match[1]);
            });

            if (totalLost > 0 && statHealth) {
                const currentPen = allPens.find(p => p.id === penId);
                if (currentPen) {
                    const originalCount = (currentPen.animalCount || 0) + totalLost;
                    const survivalRate = originalCount > 0 ? Math.round(((originalCount - totalLost) / originalCount) * 100) : 100;
                    statHealth.innerHTML = `<span style="font-size:11px; color:#dc2626;">-${totalLost}</span>`;
                    statHealth.title = `Đã mất ${totalLost} con · Tỷ lệ sống: ${survivalRate}%`;
                }
            }
        }
    } catch (e) {
        // Silently fail - stats are optional
    }
}

function openMortalityModal() {
    if (!selectedPen || !selectedPen.id) {
        showNotification('Vui lòng chọn chuồng trước', 'warning');
        return;
    }

    if (!selectedPen.animalCount || selectedPen.animalCount <= 0) {
        showNotification('Chuồng không có vật nuôi', 'warning');
        return;
    }

    mortalityPenData = selectedPen;
    selectedMortalityCauseType = 'DEATH';

    // Populate summary
    const animalName = selectedPen.animalDefinition?.name || 'Không xác định';
    const currentCount = selectedPen.animalCount || 0;
    const unit = selectedPen.animalDefinition?.unit || 'con';

    document.getElementById('mortality-animal-name').textContent = animalName;
    document.getElementById('mortality-current-count').textContent = `${currentCount} ${unit}`;
    document.getElementById('mortality-quantity-hint').textContent = `Tối đa: ${currentCount} ${unit}`;

    // Reset form
    document.getElementById('mortality-quantity').value = '';
    document.getElementById('mortality-quantity').max = currentCount;
    document.getElementById('mortality-cause').value = '';
    document.getElementById('mortality-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('mortality-loss').value = '';
    document.getElementById('mortality-notes').value = '';

    // Reset cause type tabs
    document.querySelectorAll('.mortality-cause-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector('.mortality-cause-tab[data-cause="DEATH"]').classList.add('active');

    // Reset preview
    updateMortalityPreview();

    // Load mortality history
    loadMortalityHistory(selectedPen.id);

    // Show modal
    const modal = document.getElementById('mortality-modal');
    modal.classList.add('modal--visible');

    // Event listeners for live preview
    document.getElementById('mortality-quantity').addEventListener('input', updateMortalityPreview);
    document.getElementById('mortality-loss').addEventListener('input', updateMortalityPreview);
    document.getElementById('mortality-cause').addEventListener('input', updateMortalityPreview);
}

function closeMortalityModal() {
    const modal = document.getElementById('mortality-modal');
    modal.classList.remove('modal--visible');
    mortalityPenData = null;

    document.getElementById('mortality-quantity').removeEventListener('input', updateMortalityPreview);
    document.getElementById('mortality-loss').removeEventListener('input', updateMortalityPreview);
    document.getElementById('mortality-cause').removeEventListener('input', updateMortalityPreview);
}

function selectMortalityCauseType(type) {
    selectedMortalityCauseType = type;
    document.querySelectorAll('.mortality-cause-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`.mortality-cause-tab[data-cause="${type}"]`).classList.add('active');

    // Auto-fill cause placeholder based on type
    const causeInput = document.getElementById('mortality-cause');
    const placeholders = {
        'DEATH': 'VD: Già yếu, sốc nhiệt, không rõ...',
        'DISEASE': 'VD: Dịch tả, cúm gia cầm, lở mồm long móng...',
        'ACCIDENT': 'VD: Chết đuối, chuồng sập, thú hoang...',
        'CULL': 'VD: Không đạt tiêu chuẩn, dị tật, chậm lớn...'
    };
    causeInput.placeholder = placeholders[type] || 'Nhập nguyên nhân...';
}

function updateMortalityPreview() {
    const quantity = parseInt(document.getElementById('mortality-quantity').value) || 0;
    const loss = parseFloat(document.getElementById('mortality-loss').value) || 0;
    const maxCount = mortalityPenData?.animalCount || 0;
    const unit = mortalityPenData?.animalDefinition?.unit || 'con';

    document.getElementById('mortality-preview-quantity').textContent = `${quantity} ${unit}`;
    document.getElementById('mortality-preview-remaining').textContent = `${Math.max(0, maxCount - quantity)} ${unit}`;
    document.getElementById('mortality-preview-loss').textContent = formatCurrency(loss);

    // Enable/disable submit
    const submitBtn = document.getElementById('mortality-submit-btn');
    const cause = document.getElementById('mortality-cause').value.trim();
    const isValid = quantity > 0 && quantity <= maxCount && cause.length > 0;
    submitBtn.disabled = !isValid;

    // Warning if exceeds
    const hint = document.getElementById('mortality-quantity-hint');
    if (quantity > maxCount) {
        hint.textContent = `⚠️ Vượt quá số lượng! Tối đa: ${maxCount}`;
        hint.style.color = '#dc2626';
    } else {
        hint.textContent = `Tối đa: ${maxCount} ${unit}`;
        hint.style.color = '';
    }
}

async function submitMortality() {
    if (!mortalityPenData) return;

    const quantity = parseInt(document.getElementById('mortality-quantity').value);
    const cause = document.getElementById('mortality-cause').value.trim();
    const eventDate = document.getElementById('mortality-date').value;
    const estimatedLoss = parseFloat(document.getElementById('mortality-loss').value) || 0;
    const notes = document.getElementById('mortality-notes').value;

    if (!quantity || quantity <= 0) {
        showNotification('Vui lòng nhập số lượng hợp lệ', 'error');
        return;
    }
    if (quantity > mortalityPenData.animalCount) {
        showNotification('Số lượng vượt quá số con hiện có', 'error');
        return;
    }
    if (!cause) {
        showNotification('Vui lòng nhập nguyên nhân', 'error');
        return;
    }

    const submitBtn = document.getElementById('mortality-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-symbols-outlined icon-sm rotating">sync</span> Đang xử lý...';

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/pens/${mortalityPenData.id}/mortality`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                quantity: quantity,
                cause: cause,
                causeType: selectedMortalityCauseType,
                eventDate: eventDate,
                estimatedLoss: estimatedLoss,
                notes: notes,
                animalName: mortalityPenData.animalDefinition?.name || 'Vật nuôi'
            })
        });

        const result = await response.json();

        if (response.ok) {
            const causeLabels = { 'DEATH': 'chết', 'DISEASE': 'bệnh', 'ACCIDENT': 'tai nạn', 'CULL': 'loại thải' };
            const causeLabel = causeLabels[selectedMortalityCauseType] || 'hao hụt';
            showNotification(`⚠️ Đã ghi nhận ${quantity} con ${causeLabel} (${cause})`, 'warning');

            closeMortalityModal();

            // Reload pen data
            await loadPens();
            renderPenSelectorBar();

            // Update detail panel
            if (selectedPen && selectedPen.id === mortalityPenData.id) {
                const updatedPen = allPens.find(p => p.id === mortalityPenData.id);
                if (updatedPen) {
                    selectedPen = updatedPen;
                    updatePenDetails(updatedPen);
                } else {
                    const emptyState = document.getElementById('empty-pen-state');
                    const content = document.getElementById('pen-detail-content');
                    if (emptyState) emptyState.style.display = 'flex';
                    if (content) content.style.display = 'none';
                    selectedPen = null;
                }
            }
        } else {
            showNotification(result.error || 'Lỗi khi ghi nhận hao hụt', 'error');
        }
    } catch (error) {
        console.error('Mortality error:', error);
        showNotification('Lỗi kết nối server', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-symbols-outlined icon-sm">check_circle</span> Xác nhận ghi nhận';
    }
}

async function loadMortalityHistory(penId) {
    const listEl = document.getElementById('mortality-history-list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="mortality-history__loading"><span class="material-symbols-outlined rotating">sync</span> Đang tải...</div>';

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/pens/${penId}/mortality-history`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!response.ok) throw new Error('Failed to load');
        const records = await response.json();

        if (!records || records.length === 0) {
            listEl.innerHTML = '<div class="mortality-history__empty"><span class="material-symbols-outlined">check_circle</span> Chưa có dữ liệu hao hụt</div>';
            return;
        }

        const causeTypeIcons = {
            'Chết': 'skull',
            'Bệnh': 'coronavirus',
            'Tai nạn': 'warning',
            'Loại thải': 'remove_circle'
        };

        listEl.innerHTML = records.slice(0, 10).map(record => {
            // Parse quantity from notes (format: "X con - notes")
            const quantityMatch = record.notes?.match(/^(\d+)\s*con/);
            const quantity = quantityMatch ? quantityMatch[1] : '?';
            const noteText = record.notes?.replace(/^\d+\s*con\s*-\s*/, '') || '';

            // Determine icon from record name prefix
            let icon = 'skull';
            for (const [prefix, iconName] of Object.entries(causeTypeIcons)) {
                if (record.name?.startsWith(prefix)) {
                    icon = iconName;
                    break;
                }
            }

            const date = record.eventDate ? new Date(record.eventDate).toLocaleDateString('vi-VN') : '--';

            return `
                <div class="mortality-history__item">
                    <div class="mortality-history__icon">
                        <span class="material-symbols-outlined">${icon}</span>
                    </div>
                    <div class="mortality-history__content">
                        <div class="mortality-history__title">${record.name || 'Không xác định'}</div>
                        <div class="mortality-history__meta">
                            <span>${date}</span> · <span>${quantity} con</span>
                            ${noteText ? ` · <span>${noteText}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading mortality history:', error);
        listEl.innerHTML = '<div class="mortality-history__empty">Lỗi tải dữ liệu</div>';
    }
}

// ==================== MORTALITY REPORT / ANALYTICS ====================

async function openMortalityReport() {
    if (!selectedPen || !selectedPen.id) {
        showNotification('Vui lòng chọn chuồng trước', 'warning');
        return;
    }

    const modal = document.getElementById('mortality-report-modal');
    modal.classList.add('modal--visible');

    // Show loading state
    document.getElementById('mr-total-lost').textContent = '...';
    document.getElementById('mr-survival-rate').textContent = '...';
    document.getElementById('mr-total-loss').textContent = '...';
    document.getElementById('mr-event-count').textContent = '...';
    document.getElementById('mr-timeline-chart').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:180px;color:#9ca3af;font-size:13px;"><span class="material-symbols-outlined rotating" style="margin-right:6px;">sync</span>Đang tải...</div>';
    document.getElementById('mr-cause-chart').innerHTML = '';
    document.getElementById('mortality-report-history-list').innerHTML = '<div class="mortality-history__loading"><span class="material-symbols-outlined rotating">sync</span> Đang tải...</div>';

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/livestock/pens/${selectedPen.id}/mortality-history`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!response.ok) throw new Error('Failed to load');
        const records = await response.json();

        renderMortalityReport(records, selectedPen);
    } catch (error) {
        console.error('Error loading mortality report:', error);
        document.getElementById('mr-timeline-chart').innerHTML = '<div class="mortality-report__empty"><span class="material-symbols-outlined">error</span>Lỗi tải dữ liệu</div>';
    }
}

function closeMortalityReport() {
    const modal = document.getElementById('mortality-report-modal');
    modal.classList.remove('modal--visible');
}

function renderMortalityReport(records, pen) {
    if (!records || records.length === 0) {
        // Empty state
        document.getElementById('mr-total-lost').textContent = '0';
        document.getElementById('mr-survival-rate').textContent = '100%';
        document.getElementById('mr-total-loss').textContent = '0₫';
        document.getElementById('mr-event-count').textContent = '0';
        document.getElementById('mr-timeline-chart').innerHTML = '<div class="mortality-report__empty"><span class="material-symbols-outlined">check_circle</span>Chưa có sự kiện hao hụt nào — tuyệt vời!</div>';
        document.getElementById('mr-cause-chart').innerHTML = '<div class="mortality-report__empty"><span class="material-symbols-outlined">pie_chart</span>Không có dữ liệu</div>';
        document.getElementById('mortality-report-history-list').innerHTML = '<div class="mortality-history__empty"><span class="material-symbols-outlined">check_circle</span> Không có lịch sử</div>';
        return;
    }

    // Parse data from records
    let totalLost = 0;
    let totalLoss = 0;
    const causeMap = {};
    const monthMap = {};

    records.forEach(record => {
        // Parse quantity from notes: "X con - notes"
        const qMatch = record.notes?.match(/^(\d+)\s*con/);
        const qty = qMatch ? parseInt(qMatch[1]) : 1;
        totalLost += qty;

        // Parse estimated loss from notes if available
        const lossMatch = record.notes?.match(/thiệt hại[:\s]*([0-9,.]+)/i);
        if (lossMatch) {
            totalLoss += parseFloat(lossMatch[1].replace(/,/g, '')) || 0;
        }

        // Cause breakdown from record name prefix
        const causeType = record.name?.split(' - ')[0] || 'Không rõ';
        causeMap[causeType] = (causeMap[causeType] || 0) + qty;

        // Timeline by month
        const date = record.eventDate ? new Date(record.eventDate) : new Date(record.createdAt);
        const monthKey = `${date.getMonth() + 1}/${date.getFullYear()}`;
        monthMap[monthKey] = (monthMap[monthKey] || 0) + qty;
    });

    // Calculate survival rate
    const currentCount = pen.animalCount || 0;
    const originalCount = currentCount + totalLost;
    const survivalRate = originalCount > 0 ? ((currentCount / originalCount) * 100).toFixed(1) : 100;

    // Update stat cards
    document.getElementById('mr-total-lost').textContent = totalLost;
    document.getElementById('mr-survival-rate').textContent = `${survivalRate}%`;
    document.getElementById('mr-total-loss').textContent = formatCurrency(totalLoss);
    document.getElementById('mr-event-count').textContent = records.length;

    // ---- Timeline Bar Chart ----
    const months = Object.keys(monthMap);
    const maxVal = Math.max(...Object.values(monthMap), 1);
    const chartHeight = 150;

    if (months.length > 0) {
        const barsHtml = months.map(m => {
            const val = monthMap[m];
            const barH = Math.max((val / maxVal) * chartHeight, 8);
            return `<div class="mr-bar-group">
                <div class="mr-bar-value">${val}</div>
                <div class="mr-bar" style="height:${barH}px;"></div>
                <div class="mr-bar-label">${m}</div>
            </div>`;
        }).join('');
        document.getElementById('mr-timeline-chart').innerHTML = barsHtml;
    } else {
        document.getElementById('mr-timeline-chart').innerHTML = '<div class="mortality-report__empty">Không đủ dữ liệu</div>';
    }

    // ---- Cause Donut Chart ----
    const causeEntries = Object.entries(causeMap).sort((a, b) => b[1] - a[1]);
    const colors = ['#ea580c', '#dc2626', '#d97706', '#7c3aed', '#2563eb', '#0d9488'];
    const total = causeEntries.reduce((s, [_, v]) => s + v, 0);

    if (causeEntries.length > 0) {
        // Build SVG donut
        let cumulativePercent = 0;
        const segments = causeEntries.map(([name, val], i) => {
            const percent = (val / total) * 100;
            const color = colors[i % colors.length];
            const dashArray = `${percent} ${100 - percent}`;
            const dashOffset = 25 - cumulativePercent;
            cumulativePercent += percent;
            return `<circle cx="50" cy="50" r="35" fill="none" stroke="${color}" stroke-width="18" stroke-dasharray="${dashArray}" stroke-dashoffset="${dashOffset}" />`;
        }).join('');

        const legendItems = causeEntries.map(([name, val], i) => {
            const color = colors[i % colors.length];
            const pct = ((val / total) * 100).toFixed(0);
            return `<div class="mr-donut-legend-item"><span class="mr-donut-dot" style="background:${color};"></span>${name} (${val}, ${pct}%)</div>`;
        }).join('');

        document.getElementById('mr-cause-chart').innerHTML = `
            <div class="mr-donut-wrap">
                <svg class="mr-donut-svg" viewBox="0 0 100 100">
                    ${segments}
                    <text x="50" y="48" text-anchor="middle" font-size="12" font-weight="800" fill="#111827">${total}</text>
                    <text x="50" y="58" text-anchor="middle" font-size="5" fill="#9ca3af">tổng</text>
                </svg>
                <div class="mr-donut-legend">${legendItems}</div>
            </div>
        `;
    } else {
        document.getElementById('mr-cause-chart').innerHTML = '<div class="mortality-report__empty">Không có dữ liệu</div>';
    }

    // ---- Recent History List ----
    const causeTypeIcons = {
        'Chết': 'skull',
        'Bệnh': 'coronavirus',
        'Tai nạn': 'warning',
        'Loại thải': 'remove_circle'
    };

    const historyHtml = records.slice(0, 10).map(record => {
        const qMatch = record.notes?.match(/^(\d+)\s*con/);
        const quantity = qMatch ? qMatch[1] : '?';
        const noteText = record.notes?.replace(/^\d+\s*con\s*-\s*/, '') || '';
        let icon = 'skull';
        for (const [prefix, iconName] of Object.entries(causeTypeIcons)) {
            if (record.name?.startsWith(prefix)) {
                icon = iconName;
                break;
            }
        }
        const date = record.eventDate ? new Date(record.eventDate).toLocaleDateString('vi-VN') : '--';
        return `<div class="mortality-history__item">
            <div class="mortality-history__icon"><span class="material-symbols-outlined">${icon}</span></div>
            <div class="mortality-history__content">
                <div class="mortality-history__title">${record.name || 'Không xác định'}</div>
                <div class="mortality-history__meta"><span>${date}</span> · <span>${quantity} con</span>${noteText ? ` · <span>${noteText}</span>` : ''}</div>
            </div>
        </div>`;
    }).join('');

    document.getElementById('mortality-report-history-list').innerHTML = historyHtml || '<div class="mortality-history__empty">Không có lịch sử</div>';
}

// ==================== UTILITY SETTINGS ====================

function openUtilityModal() {
    if (!selectedPen) {
        showNotification('Vui lòng chọn chuồng trước', 'warning');
        return;
    }
    const modal = document.getElementById('utilityModal');
    if (!modal) return;

    // Set pen info
    document.getElementById('utility-pen-name').textContent = `Chuồng ${selectedPen.code || selectedPen.id}`;
    document.getElementById('utility-pen-type').textContent = selectedPen.animalDefinition?.name || 'Chưa chọn vật nuôi';

    // Load existing utility settings
    loadUtilitySetting(selectedPen.id);

    modal.style.display = 'flex';
    if (typeof gsap !== 'undefined') {
        gsap.fromTo(modal.querySelector('.modal__content'), {
            opacity: 0, scale: 0.9, y: 30
        }, {
            opacity: 1, scale: 1, y: 0,
            duration: 0.35, ease: 'power2.out'
        });
    }
}

function closeUtilityModal() {
    const modal = document.getElementById('utilityModal');
    if (modal) modal.style.display = 'none';
}

async function loadUtilitySetting(penId) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/utility-settings/pen/${penId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const setting = await res.json();
            document.getElementById('utility-power-kw').value = setting.powerKw || 0;
            document.getElementById('utility-elec-rate').value = setting.electricityRate || 3000;
            document.getElementById('utility-water-m3').value = setting.waterM3PerDay || 0;
            document.getElementById('utility-water-rate').value = setting.waterRate || 12000;
            document.getElementById('utility-hours').value = setting.hoursPerDay || 12;
        } else {
            // Reset to defaults
            document.getElementById('utility-power-kw').value = 0;
            document.getElementById('utility-elec-rate').value = 3000;
            document.getElementById('utility-water-m3').value = 0;
            document.getElementById('utility-water-rate').value = 12000;
            document.getElementById('utility-hours').value = 12;
        }
        updateUtilityPreview();
    } catch (e) {
        console.error('Error loading utility setting:', e);
    }
}

function updateUtilityPreview() {
    const powerKw = parseFloat(document.getElementById('utility-power-kw').value) || 0;
    const elecRate = parseFloat(document.getElementById('utility-elec-rate').value) || 0;
    const waterM3 = parseFloat(document.getElementById('utility-water-m3').value) || 0;
    const waterRate = parseFloat(document.getElementById('utility-water-rate').value) || 0;
    const hours = parseInt(document.getElementById('utility-hours').value) || 12;

    document.getElementById('utility-hours-label').textContent = `${hours} giờ`;

    // Monthly calculations (30 days)
    const monthlyElec = powerKw * hours * 30 * elecRate;
    const monthlyWater = waterM3 * 30 * waterRate;
    const total = monthlyElec + monthlyWater;

    const fmt = (v) => new Intl.NumberFormat('vi-VN').format(Math.round(v)) + ' VNĐ';
    document.getElementById('utility-elec-cost').textContent = fmt(monthlyElec);
    document.getElementById('utility-water-cost').textContent = fmt(monthlyWater);
    document.getElementById('utility-total-cost').textContent = fmt(total);
}

async function saveUtilitySetting() {
    if (!selectedPen) {
        showNotification('Không tìm thấy chuồng', 'error');
        return;
    }

    const powerKw = parseFloat(document.getElementById('utility-power-kw').value) || 0;
    const elecRate = parseFloat(document.getElementById('utility-elec-rate').value) || 0;
    const waterM3 = parseFloat(document.getElementById('utility-water-m3').value) || 0;
    const waterRate = parseFloat(document.getElementById('utility-water-rate').value) || 0;
    const hours = parseInt(document.getElementById('utility-hours').value) || 12;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/utility-settings/pen/${selectedPen.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                penId: selectedPen.id,
                powerKw,
                electricityRate: elecRate,
                waterM3PerDay: waterM3,
                waterRate,
                hoursPerDay: hours
            })
        });

        if (res.ok) {
            showNotification('Đã lưu cài đặt điện nước thành công!', 'success');
            closeUtilityModal();
        } else {
            const err = await res.text();
            showNotification('Lỗi: ' + err, 'error');
        }
    } catch (e) {
        console.error('Error saving utility setting:', e);
        showNotification('Lỗi kết nối server', 'error');
    }
}

// Add event listeners for live preview
document.addEventListener('DOMContentLoaded', () => {
    ['utility-power-kw', 'utility-elec-rate', 'utility-water-m3', 'utility-water-rate', 'utility-hours'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateUtilityPreview);
    });
});

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
window.confirmCleanPen = confirmCleanPen;
window.openVaccineModal = openVaccineModal;
window.closeVaccineModal = closeVaccineModal;
window.openVaccineScheduleModal = openVaccineScheduleModal;
window.filterVaccineList = filterVaccineList;
window.confirmVaccineComplete = confirmVaccineComplete;
window.openAddVaccineRecord = openAddVaccineRecord;
window.closeAddVaccineRecord = closeAddVaccineRecord;
window.submitVaccineRecord = submitVaccineRecord;
window.switchVaccinePen = switchVaccinePen;
window.openAnalysisModal = openAnalysisModal;
window.handlePenStatusChange = handlePenStatusChange;
window.toggleMarketplacePanel = toggleMarketplacePanel;
window.selectAnimalMarketItem = selectAnimalMarketItem;
window.filterAnimalTickers = filterAnimalTickers;
window.toggleNotificationPanel = toggleNotificationPanel;
window.markAllNotificationsRead = markAllNotificationsRead;
window.filterNotifications = filterNotifications;
window.handleNotificationClick = handleNotificationClick;
// New: Weight & Byproduct functions
window.openWeightRecordModal = openWeightRecordModal;
window.closeWeightRecordModal = closeWeightRecordModal;
window.submitWeightRecord = submitWeightRecord;
window.openByproductRecordModal = openByproductRecordModal;
window.closeByproductRecordModal = closeByproductRecordModal;
window.submitByproductRecord = submitByproductRecord;
window.openByproductPanel = openByproductPanel;
window.openByproductCollectionTask = openByproductCollectionTask;
window.submitByproductCollectionTask = submitByproductCollectionTask;
window.openSellByproductModal = openSellByproductModal;
window.closeSellByproductModal = closeSellByproductModal;
window.submitSellByproduct = submitSellByproduct;
window.switchHarvestType = switchHarvestType;
window.switchHarvestTab = switchHarvestTab;
// Mortality functions
window.openMortalityModal = openMortalityModal;
window.closeMortalityModal = closeMortalityModal;
window.submitMortality = submitMortality;
window.selectMortalityCauseType = selectMortalityCauseType;
// Mortality Report / Analytics
window.openMortalityReport = openMortalityReport;
window.closeMortalityReport = closeMortalityReport;
// Utility functions
window.openUtilityModal = openUtilityModal;
window.closeUtilityModal = closeUtilityModal;
window.saveUtilitySetting = saveUtilitySetting;
window.updateUtilityPreview = updateUtilityPreview;
// openInventoryModal from inventory.js
// closeAllFeaturePanels redefined above to also stop market polling
