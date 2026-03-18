/**
 * Inventory Management Logic - Connected to Shop "Kho của tôi"
 * Pulls real data from /api/shop/inventory (same as shop page warehouse)
 * Light green theme, grid + table views, category filtering
 */

// Use existing API_BASE if available from features.js, otherwise define from CONFIG
var INV_API_BASE = typeof API_BASE !== 'undefined' ? API_BASE :
    (typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : 'http://localhost:8080/api');

// Category mappings (matching shop.js)
const INV_CATEGORY_LABELS = {
    'HAT_GIONG': '🌾 Hạt giống',
    'CON_GIONG': '🐣 Con giống',
    'PHAN_BON': '🌱 Phân bón',
    'THUC_AN': '🍚 Thức ăn',
    'THUOC_TRU_SAU': '🛡️ Thuốc BVTV',
    'MAY_MOC': '⚙️ Máy móc',
    'THU_HOACH_CHAN_NUOI': '🦢 Thu hoạch Chăn nuôi',
    'THU_HOACH_TRONG_TROT': '🌾 Thu hoạch Trồng trọt'
};

const INV_CATEGORY_ICONS = {
    'HAT_GIONG': 'grass',
    'CON_GIONG': 'pets',
    'PHAN_BON': 'compost',
    'THUC_AN': 'set_meal',
    'THUOC_TRU_SAU': 'bug_report',
    'MAY_MOC': 'agriculture',
    'THU_HOACH_CHAN_NUOI': 'agriculture',
    'THU_HOACH_TRONG_TROT': 'grass'
};

const INV_CATEGORY_EMOJI = {
    'HAT_GIONG': '🌾',
    'CON_GIONG': '🐣',
    'PHAN_BON': '🌱',
    'THUC_AN': '🍚',
    'THUOC_TRU_SAU': '🛡️',
    'MAY_MOC': '⚙️',
    'THU_HOACH_CHAN_NUOI': '🦢',
    'THU_HOACH_TRONG_TROT': '🌾'
};

// State
let inventoryData = { items: [], byCategory: {}, totalItems: 0, totalValue: 0 };
let inventoryFilter = 'ALL';
let inventorySearchTerm = '';
let inventoryViewMode = 'grid'; // 'grid' or 'table'

// ==================== MODAL OPEN/CLOSE ====================

function openInventoryModal() {
    const modal = document.getElementById('inventory-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
    fetchShopInventory();
}

function closeInventoryModal() {
    const modal = document.getElementById('inventory-modal');
    if (!modal) return;
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
}

// ==================== DATA FETCHING ====================

async function fetchShopInventory() {
    const tbody = document.getElementById('inventory-table-body');
    const gridContainer = document.getElementById('inventory-grid-view');

    try {
        const userEmail = localStorage.getItem('userEmail');
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let url = `${INV_API_BASE}/shop/inventory`;
        if (userEmail) url += `?userEmail=${encodeURIComponent(userEmail)}`;

        const response = await fetch(url, { headers });

        if (response.ok) {
            inventoryData = await response.json();
            inventoryData.items = inventoryData.items || [];
            inventoryData.byCategory = inventoryData.byCategory || {};
            inventoryData.totalItems = inventoryData.totalItems || 0;
            inventoryData.totalValue = inventoryData.totalValue || 0;
        } else {
            // Fallback to standalone inventory API
            console.warn('Shop inventory failed, trying standalone /api/inventory...');
            const fallbackRes = await fetch(`${INV_API_BASE}/inventory`, { headers });
            if (fallbackRes.ok) {
                const rawItems = await fallbackRes.json();
                inventoryData = convertLegacyItems(rawItems);
            }
        }
    } catch (err) {
        console.error('Error fetching inventory:', err);
        // Try fallback
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const fallbackRes = await fetch(`${INV_API_BASE}/inventory`, { headers });
            if (fallbackRes.ok) {
                const rawItems = await fallbackRes.json();
                inventoryData = convertLegacyItems(rawItems);
            }
        } catch (e2) {
            console.error('All inventory sources failed:', e2);
        }
    }

    renderInventoryModal();

    renderInventoryModal();
}

async function fetchHarvestItems() {
    // Deprecated: Harvest items are now returned by the main shop inventory API
}

// Convert legacy /api/inventory format to shop format
function convertLegacyItems(items) {
    const byCategory = {};
    let totalValue = 0;

    items.forEach(item => {
        const cat = mapLegacyType(item.type);
        if (!byCategory[cat]) byCategory[cat] = [];
        const totalItemValue = (item.costPerUnit || 0) * (item.quantity || 0);
        totalValue += totalItemValue;
        byCategory[cat].push({
            id: item.id,
            effectiveName: item.name,
            effectiveUnit: item.unit || 'kg',
            quantity: item.quantity || 0,
            totalValue: totalItemValue,
            imageUrl: null,
            iconName: INV_CATEGORY_ICONS[cat] || 'inventory_2',
            itemCategory: cat,
            costPerUnit: item.costPerUnit,
            minThreshold: item.minThreshold
        });
    });

    return {
        items: items.map(item => ({
            id: item.id,
            effectiveName: item.name,
            effectiveUnit: item.unit || 'kg',
            quantity: item.quantity || 0,
            totalValue: (item.costPerUnit || 0) * (item.quantity || 0),
            imageUrl: null,
            iconName: INV_CATEGORY_ICONS[mapLegacyType(item.type)] || 'inventory_2',
            itemCategory: mapLegacyType(item.type),
            costPerUnit: item.costPerUnit,
            minThreshold: item.minThreshold
        })),
        byCategory: byCategory,
        totalItems: items.length,
        totalValue: totalValue
    };
}

function mapLegacyType(type) {
    const map = { 'FERTILIZER': 'PHAN_BON', 'PESTICIDE': 'THUOC_TRU_SAU', 'SEED': 'HAT_GIONG', 'OTHER': 'MAY_MOC' };
    return map[type] || 'MAY_MOC';
}

// ==================== RENDERING ====================

function renderInventoryModal() {
    renderInventorySummary();
    renderCategoryTabs();
    renderInventoryItems();
}

function renderInventorySummary() {
    const summaryContainer = document.getElementById('inventory-summary');
    if (!summaryContainer) return;

    const { totalItems, totalValue, byCategory } = inventoryData;
    const categoryCount = Object.keys(byCategory || {}).length;

    summaryContainer.innerHTML = `
        <div class="inv-summary-card">
            <div class="inv-icon"><span class="material-symbols-outlined">inventory_2</span></div>
            <div class="inv-meta"><div class="label">Tổng vật tư</div><div class="value">${totalItems}</div></div>
        </div>
        <div class="inv-summary-card">
            <div class="inv-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);"><span class="material-symbols-outlined">payments</span></div>
            <div class="inv-meta"><div class="label">Tổng giá trị</div><div class="value">${formatInvCurrency(totalValue)}</div></div>
        </div>
        <div class="inv-summary-card">
            <div class="inv-icon" style="background: linear-gradient(135deg, #6366f1, #4f46e5);"><span class="material-symbols-outlined">category</span></div>
            <div class="inv-meta"><div class="label">Danh mục</div><div class="value">${categoryCount}</div></div>
        </div>
    `;
}

function renderCategoryTabs() {
    const tabsContainer = document.getElementById('inventory-category-tabs');
    if (!tabsContainer) return;

    const { byCategory } = inventoryData;
    const categories = Object.keys(byCategory || {});

    let html = `<button class="inv-cat-tab ${inventoryFilter === 'ALL' ? 'active' : ''}" onclick="filterInventoryCategory('ALL')">
        <span class="material-symbols-outlined">apps</span> Tất cả
        <span class="count">${inventoryData.totalItems || 0}</span>
    </button>`;

    categories.forEach(cat => {
        const items = byCategory[cat] || [];
        const label = (INV_CATEGORY_LABELS[cat] || cat).replace(/^[^\s]+\s/, ''); // Remove emoji prefix
        const icon = INV_CATEGORY_ICONS[cat] || 'inventory_2';
        html += `<button class="inv-cat-tab ${inventoryFilter === cat ? 'active' : ''}" onclick="filterInventoryCategory('${cat}')">
            <span class="material-symbols-outlined">${icon}</span> ${label}
            <span class="count">${items.length}</span>
        </button>`;
    });

    tabsContainer.innerHTML = html;
}

function renderInventoryItems() {
    const gridView = document.getElementById('inventory-grid-view');
    const tableBody = document.getElementById('inventory-table-body');
    const listContainer = document.querySelector('.inventory-list-container');
    const gridContainer = document.querySelector('.inventory-grid-container');

    // Get filtered items
    let items = [];
    const { byCategory } = inventoryData;

    if (inventoryFilter === 'ALL') {
        Object.values(byCategory || {}).forEach(catItems => {
            items.push(...catItems);
        });
    } else if (byCategory && byCategory[inventoryFilter]) {
        items = [...byCategory[inventoryFilter]];
    }

    // Apply search filter
    if (inventorySearchTerm) {
        const term = inventorySearchTerm.toLowerCase();
        items = items.filter(item =>
            (item.effectiveName || '').toLowerCase().includes(term) ||
            (item.itemCategory || '').toLowerCase().includes(term)
        );
    }

    // Render grid view
    if (gridView) {
        if (items.length === 0) {
            gridView.innerHTML = `
                <div class="inv-empty-state" style="grid-column: 1 / -1;">
                    <span class="material-symbols-outlined">inventory_2</span>
                    <p>Kho hàng trống</p>
                    <p>Hãy ghé <span class="highlight">Cửa hàng</span> để mua sắm!</p>
                </div>`;
        } else {
            gridView.innerHTML = items.map(item => createInventoryCard(item)).join('');
        }
    }

    // Render table view
    if (tableBody) {
        if (items.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:#9ca3af;">
                <span class="material-symbols-outlined" style="font-size:36px; display:block; margin-bottom:8px;">inventory_2</span>
                Kho trống — Ghé cửa hàng để mua sắm!
            </td></tr>`;
        } else {
            tableBody.innerHTML = items.map(item => createInventoryRow(item)).join('');
        }
    }

    // Show/hide containers based on view mode
    if (listContainer) listContainer.style.display = inventoryViewMode === 'table' ? 'block' : 'none';
    if (gridContainer) gridContainer.style.display = inventoryViewMode === 'grid' ? 'block' : 'none';
}

function createInventoryCard(item) {
    const emoji = INV_CATEGORY_EMOJI[item.itemCategory] || '📦';
    const iconHtml = item.imageUrl
        ? `<img src="${item.imageUrl}" alt="${item.effectiveName}">`
        : `<span style="font-size:28px;">${emoji}</span>`;

    const isLow = item.minThreshold != null && item.quantity <= item.minThreshold;

    const isHarvest = item.itemCategory === 'THU_HOACH_CHAN_NUOI' || item.itemCategory === 'THU_HOACH_TRONG_TROT';
    const sellBtnHtml = isHarvest
        ? `<button class="inv-sell-btn" onclick="openSellHarvestModal(${item.id}, '${String(item.effectiveName || '').replace(/'/g, "\\'")}', ${item.quantity}, '${String(item.effectiveUnit || '').replace(/'/g, "\\'")}', ${item.costPerUnit || 0}); event.stopPropagation();">
            <span class="material-symbols-outlined" style="font-size:14px">storefront</span> Bán cho đối tác
           </button>`
        : '';

    return `
        <div class="inv-item-card">
            <div class="item-icon">${iconHtml}</div>
            <div class="item-name">${item.effectiveName || 'N/A'}</div>
            <div class="item-category">${(INV_CATEGORY_LABELS[item.itemCategory] || item.itemCategory || '').replace(/^[^\s]+\s/, '')}</div>
            <div class="item-details">
                <div>
                    <div class="item-qty" style="${isLow ? 'color:#dc2626;' : ''}">${formatInvNumber(item.quantity)} ${item.effectiveUnit || ''}</div>
                    ${isLow ? '<span class="status-badge status-low">⚠️ Sắp hết</span>' : ''}
                </div>
                <div class="item-value">${formatInvCurrency(item.totalValue || 0)}</div>
            </div>
            ${sellBtnHtml}
        </div>
    `;
}

function createInventoryRow(item) {
    const emoji = INV_CATEGORY_EMOJI[item.itemCategory] || '📦';
    const isLow = item.minThreshold != null && item.quantity <= item.minThreshold;
    const statusBadge = isLow
        ? '<span class="status-badge status-low">⚠️ Sắp hết</span>'
        : '<span class="status-badge status-ok">✓ Còn hàng</span>';

    const catLabel = (INV_CATEGORY_LABELS[item.itemCategory] || item.itemCategory || '').replace(/^[^\s]+\s/, '');

    const isHarvest = item.itemCategory === 'THU_HOACH_CHAN_NUOI' || item.itemCategory === 'THU_HOACH_TRONG_TROT';
    const sellBtnHtml = isHarvest
        ? `<div style="margin-top: 8px;"><button class="inv-sell-btn" style="padding: 4px 8px; font-size: 12px; border-radius: 4px;" onclick="openSellHarvestModal(${item.id}, '${String(item.effectiveName || '').replace(/'/g, "\\'")}', ${item.quantity}, '${String(item.effectiveUnit || '').replace(/'/g, "\\'")}', ${item.costPerUnit || 0}); event.stopPropagation();">
            <span class="material-symbols-outlined" style="font-size:12px">storefront</span> Bán
           </button></div>`
        : '';

    return `<tr>
        <td><strong>${emoji} ${item.effectiveName || 'N/A'}</strong></td>
        <td>${catLabel}</td>
        <td class="${isLow ? 'text-danger' : ''}" style="font-weight:600;">${formatInvNumber(item.quantity)} ${item.effectiveUnit || ''}</td>
        <td>${formatInvCurrency(item.costPerUnit || 0)} / ${item.effectiveUnit || 'đơn vị'}</td>
        <td>${statusBadge}</td>
        <td>
            ${formatInvCurrency(item.totalValue || 0)}
            ${sellBtnHtml}
        </td>
    </tr>`;
}

// ==================== FILTERS & SEARCH ====================

function filterInventoryCategory(category) {
    inventoryFilter = category;
    renderCategoryTabs();
    renderInventoryItems();
}

function searchInventory(value) {
    inventorySearchTerm = value || '';
    renderInventoryItems();
}

function toggleInventoryView(mode) {
    inventoryViewMode = mode;
    // Update toggle buttons
    document.querySelectorAll('.inv-view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === mode);
    });
    renderInventoryItems();
}

// ==================== LEGACY COMPATIBILITY ====================
// Keep old functions for pages that still use the old inventory API

let catalogData = { FERTILIZER: [], PESTICIDE: [], SEED: [] };
let currentMode = 'catalog';
let currentEditId = null;

function switchInventoryTab(mode) {
    currentMode = mode;
    const tabCatalog = document.getElementById('tab-catalog');
    const tabCustom = document.getElementById('tab-custom');
    const catalogMode = document.getElementById('catalog-mode');
    const customMode = document.getElementById('custom-mode');

    if (tabCatalog) tabCatalog.classList.toggle('active', mode === 'catalog');
    if (tabCustom) tabCustom.classList.toggle('active', mode === 'custom');
    if (catalogMode) catalogMode.style.display = mode === 'catalog' ? 'block' : 'none';
    if (customMode) customMode.style.display = mode === 'custom' ? 'block' : 'none';

    if (mode === 'catalog') loadCatalogItems();
}

async function loadCatalogItems() {
    const type = document.getElementById('inv-catalog-type')?.value;
    const productSelect = document.getElementById('inv-catalog-product');
    if (!productSelect) return;

    productSelect.innerHTML = '<option value="">Đang tải...</option>';

    try {
        let items = [];
        if (type === 'FERTILIZER') {
            if (catalogData.FERTILIZER.length === 0) {
                const res = await fetch(`${INV_API_BASE}/fertilizers`);
                if (res.ok) catalogData.FERTILIZER = await res.json();
            }
            items = catalogData.FERTILIZER;
        } else if (type === 'PESTICIDE') {
            if (catalogData.PESTICIDE.length === 0) {
                const res = await fetch(`${INV_API_BASE}/pests/pesticides`);
                if (res.ok) catalogData.PESTICIDE = await res.json();
            }
            items = catalogData.PESTICIDE;
        } else if (type === 'SEED') {
            if (catalogData.SEED.length === 0) {
                const res = await fetch(`${INV_API_BASE}/crops`);
                if (res.ok) catalogData.SEED = await res.json();
            }
            items = catalogData.SEED;
        }

        productSelect.innerHTML = '<option value="">-- Chọn sản phẩm --</option>';
        items.forEach(item => {
            const name = item.name || item.pesticideName || item.cropName;
            const price = item.costPerKg || item.price || item.seedCostPerKg || 50000;
            const option = document.createElement('option');
            option.value = JSON.stringify({ id: item.id, name, price, unit: type === 'SEED' ? 'kg' : (item.unit || 'kg'), description: item.description || '' });
            option.textContent = `${name} - ${formatInvCurrency(price)}/kg`;
            productSelect.appendChild(option);
        });
    } catch (err) {
        console.error('Error loading catalog:', err);
        if (productSelect) productSelect.innerHTML = '<option value="">Lỗi tải dữ liệu</option>';
    }
}

function fillProductInfo() {
    const productSelect = document.getElementById('inv-catalog-product');
    const preview = document.getElementById('inv-product-preview');
    const costInput = document.getElementById('inv-catalog-cost');
    if (!productSelect || !preview) return;

    if (!productSelect.value) {
        preview.style.display = 'none';
        if (costInput) costInput.value = '';
        return;
    }

    try {
        const product = JSON.parse(productSelect.value);
        if (costInput) costInput.value = product.price;
        const previewName = document.getElementById('preview-name');
        const previewDesc = document.getElementById('preview-desc');
        if (previewName) previewName.textContent = product.name;
        if (previewDesc) previewDesc.textContent = product.description || 'Sản phẩm chất lượng cao';
        preview.style.display = 'block';
    } catch (e) {
        preview.style.display = 'none';
    }
}

function showAddInventoryForm() {
    currentEditId = null;
    const form = document.getElementById('inventory-form');
    if (form) form.reset();
    const title = document.getElementById('inv-form-title');
    if (title) title.innerText = 'Nhập kho vật tư mới';
    const overlay = document.getElementById('inventory-form-overlay');
    if (overlay) overlay.style.display = 'flex';
    switchInventoryTab('catalog');
    loadCatalogItems();
}

function hideAddInventoryForm() {
    const overlay = document.getElementById('inventory-form-overlay');
    if (overlay) overlay.style.display = 'none';
}

async function handleInventorySubmit(e) {
    e.preventDefault();

    let payload;
    if (currentMode === 'catalog' && !currentEditId) {
        const productSelect = document.getElementById('inv-catalog-product');
        if (!productSelect?.value) { agriAlert('Vui lòng chọn sản phẩm!', 'warning'); return; }
        const product = JSON.parse(productSelect.value);
        payload = {
            name: product.name,
            type: document.getElementById('inv-catalog-type')?.value || 'FERTILIZER',
            quantity: parseFloat(document.getElementById('inv-catalog-quantity')?.value || 1),
            unit: product.unit || 'kg',
            costPerUnit: product.price,
            minThreshold: parseFloat(document.getElementById('inv-threshold')?.value || 10)
        };
    } else {
        payload = {
            name: document.getElementById('inv-name')?.value,
            type: document.getElementById('inv-type')?.value,
            quantity: parseFloat(document.getElementById('inv-quantity')?.value || 0),
            unit: document.getElementById('inv-unit')?.value,
            costPerUnit: parseFloat(document.getElementById('inv-cost')?.value || 0),
            minThreshold: parseFloat(document.getElementById('inv-threshold')?.value || 10)
        };
    }

    try {
        const url = currentEditId ? `${INV_API_BASE}/inventory/${currentEditId}` : `${INV_API_BASE}/inventory`;
        const method = currentEditId ? 'PUT' : 'POST';
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

        if (res.ok) {
            hideAddInventoryForm();
            fetchShopInventory();
            if (typeof showNotification === 'function') showNotification('success', 'Thành công', 'Lưu kho thành công!');
            else agriAlert('Lưu kho thành công!', 'success');
        } else { agriAlert('Lỗi khi lưu!', 'error'); }
    } catch (err) { console.error(err); agriAlert('Có lỗi xảy ra.', 'error'); }
}

window.addToInventory = async function (id) {
    const quantity = prompt('Nhập số lượng cần thêm:');
    if (!quantity || isNaN(parseFloat(quantity))) return;
    try {
        const res = await fetch(`${INV_API_BASE}/inventory/${id}/add`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: parseFloat(quantity) })
        });
        if (res.ok) { fetchShopInventory(); if (typeof showNotification === 'function') showNotification('success', 'Thành công', 'Đã thêm vào kho!'); }
    } catch (err) { console.error(err); }
};

window.editInventoryItem = function (id) {
    fetch(`${INV_API_BASE}/inventory`)
        .then(res => res.json())
        .then(items => {
            const item = items.find(i => i.id === id);
            if (!item) return;
            currentEditId = item.id;
            switchInventoryTab('custom');
            const getId = (sel) => document.getElementById(sel);
            if (getId('inv-id')) getId('inv-id').value = item.id;
            if (getId('inv-name')) getId('inv-name').value = item.name;
            if (getId('inv-type')) getId('inv-type').value = item.type;
            if (getId('inv-quantity')) getId('inv-quantity').value = item.quantity;
            if (getId('inv-unit')) getId('inv-unit').value = item.unit;
            if (getId('inv-cost')) getId('inv-cost').value = item.costPerUnit;
            if (getId('inv-threshold')) getId('inv-threshold').value = item.minThreshold;
            if (getId('inv-form-title')) getId('inv-form-title').innerText = 'Cập nhật kho';
            const overlay = document.getElementById('inventory-form-overlay');
            if (overlay) overlay.style.display = 'flex';
        });
};

window.deleteInventoryItem = async function (id) {
    agriConfirm('Xóa vật tư', 'Bạn chắc chắn muốn xóa vật tư này?', async () => {
        try {
            await fetch(`${INV_API_BASE}/inventory/${id}`, { method: 'DELETE' });
            fetchShopInventory();
        } catch (err) { console.error(err); }
    }, { confirmText: 'Xóa', type: 'danger' });
};

// ==================== UTILITY FUNCTIONS ====================

function formatInvCurrency(val) {
    if (typeof formatCurrency === 'function') return formatCurrency(val);
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val || 0);
}

function formatInvNumber(val) {
    if (typeof formatNumber === 'function') return formatNumber(val);
    return new Intl.NumberFormat('vi-VN').format(val || 0);
}

// ==================== SEARCH LISTENER ====================
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('inventory-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchInventory(e.target.value);
        });
    }
});

// ==================== SELL HARVEST TO PARTNER ====================

function openSellHarvestModal(itemId, itemName, maxQty, unit, refPrice) {
    // Remove existing modal if any
    let existingModal = document.getElementById('sell-harvest-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'modal modal--visible';
    modal.id = 'sell-harvest-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);animation:modalBgFade 0.2s ease;';
    modal.innerHTML = `
        <div style="background:white; border-radius:16px; max-width:500px; width:90%; box-shadow:0 20px 60px rgba(0,0,0,0.3); overflow:hidden; animation:modalSlideIn 0.3s ease;">
            <div style="background:linear-gradient(135deg,#10b981,#059669); color:white; padding:20px 24px; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; display:flex; align-items:center; gap:8px;">
                    <span class="material-symbols-outlined">storefront</span>
                    Bán cho đối tác
                </h3>
                <button onclick="document.getElementById('sell-harvest-modal').remove()" style="background:none; border:none; color:white; cursor:pointer; font-size:24px;">&times;</button>
            </div>
            <div style="padding:24px;">
                <div style="background:#ecfdf5; border-radius:12px; padding:14px; margin-bottom:16px; border:1px solid #a7f3d0;">
                    <div style="font-weight:700; color:#065f46;">${itemName}</div>
                    <div style="font-size:13px; color:#047857;">Tồn kho: ${formatInvNumber(maxQty)} ${unit} • Giá tham khảo: ${formatInvCurrency(refPrice)}/${unit}</div>
                </div>
                <div style="margin-bottom:14px;">
                    <label style="font-weight:600; color:#374151; display:block; margin-bottom:4px;">Tên đối tác</label>
                    <input type="text" id="sell-harvest-partner" style="width:100%; padding:10px 12px; border:1px solid #d1d5db; border-radius:8px; font-size:14px;" placeholder="VD: Công ty ABC">
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
                    <div>
                        <label style="font-weight:600; color:#374151; display:block; margin-bottom:4px;">Số lượng bán <span style="color:red">*</span></label>
                        <div style="display:flex; align-items:center; border:1px solid #d1d5db; border-radius:8px; overflow:hidden;">
                            <input type="number" id="sell-harvest-qty" style="flex:1; padding:10px 12px; border:none; font-size:14px;" min="0.01" max="${maxQty}" step="0.01" placeholder="0" oninput="updateSellHarvestPreview(${refPrice}, '${unit}')">
                            <span style="padding:10px 12px; background:#f3f4f6; color:#6b7280; font-size:13px;">${unit}</span>
                        </div>
                    </div>
                    <div>
                        <label style="font-weight:600; color:#374151; display:block; margin-bottom:4px;">Giá bán/đơn vị <span style="color:red">*</span></label>
                        <div style="display:flex; align-items:center; border:1px solid #d1d5db; border-radius:8px; overflow:hidden;">
                            <input type="number" id="sell-harvest-price" style="flex:1; padding:10px 12px; border:none; font-size:14px;" min="0" step="100" placeholder="${refPrice}" value="${refPrice}" oninput="updateSellHarvestPreview(${refPrice}, '${unit}')">
                            <span style="padding:10px 12px; background:#f3f4f6; color:#6b7280; font-size:13px;">₫/${unit}</span>
                        </div>
                        <div style="font-size:11px; color:#9ca3af; margin-top:4px;">Giá tham khảo: ${formatInvCurrency(refPrice)}</div>
                    </div>
                </div>
                <div style="margin-bottom:14px;">
                    <label style="font-weight:600; color:#374151; display:block; margin-bottom:4px;">Ghi chú</label>
                    <textarea id="sell-harvest-notes" style="width:100%; padding:10px 12px; border:1px solid #d1d5db; border-radius:8px; font-size:14px; resize:vertical;" rows="2" placeholder="Ghi chú thêm..."></textarea>
                </div>
                <div id="sell-harvest-preview" style="background:#f0fdf4; border-radius:10px; padding:14px; border:1px solid #bbf7d0;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                        <span style="color:#6b7280;">Tổng thu:</span>
                        <span id="sell-harvest-total" style="font-weight:700; color:#059669; font-size:18px;">0 ₫</span>
                    </div>
                    <div style="font-size:12px; color:#6b7280; display:flex; align-items:center; gap:4px;">
                        <span class="material-symbols-outlined" style="font-size:14px;">info</span>
                        Tiền sẽ được cộng vào số dư tài khoản
                    </div>
                </div>
            </div>
            <div style="padding:16px 24px; border-top:1px solid #e5e7eb; display:flex; justify-content:flex-end; gap:10px;">
                <button onclick="document.getElementById('sell-harvest-modal').remove()" style="padding:10px 20px; border:1px solid #d1d5db; border-radius:8px; background:white; cursor:pointer; font-size:14px;">Hủy</button>
                <button id="sell-harvest-submit-btn" onclick="submitSellHarvest(${itemId})" style="padding:10px 20px; border:none; border-radius:8px; background:linear-gradient(135deg,#10b981,#059669); color:white; cursor:pointer; font-size:14px; font-weight:600;">
                    <span class="material-symbols-outlined" style="font-size:16px; vertical-align:middle;">check_circle</span>
                    Xác nhận bán
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function updateSellHarvestPreview(refPrice, unit) {
    const qty = parseFloat(document.getElementById('sell-harvest-qty')?.value) || 0;
    const price = parseFloat(document.getElementById('sell-harvest-price')?.value) || 0;
    const total = qty * price;
    const totalEl = document.getElementById('sell-harvest-total');
    if (totalEl) totalEl.textContent = formatInvCurrency(total);
}

async function submitSellHarvest(itemId) {
    const qty = parseFloat(document.getElementById('sell-harvest-qty')?.value);
    const price = parseFloat(document.getElementById('sell-harvest-price')?.value);
    const partner = document.getElementById('sell-harvest-partner')?.value || '';
    const notes = document.getElementById('sell-harvest-notes')?.value || '';

    if (!qty || qty <= 0) { agriAlert('Vui lòng nhập số lượng hợp lệ', 'warning'); return; }
    if (!price || price <= 0) { agriAlert('Vui lòng nhập giá bán hợp lệ', 'warning'); return; }

    const submitBtn = document.getElementById('sell-harvest-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang xử lý...';
    }

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${INV_API_BASE}/inventory/harvest-items/${itemId}/sell`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                quantity: qty,
                pricePerUnit: price,
                partnerName: partner,
                notes: notes
            })
        });

        const result = await response.json();

        if (response.ok) {
            document.getElementById('sell-harvest-modal')?.remove();
            if (typeof showNotification === 'function') {
                showNotification(`🎉 Bán thành công! +${formatInvCurrency(result.totalRevenue || qty * price)}`, 'success');
            } else {
                agriAlert(`Bán thành công! Tổng thu: ${formatInvCurrency(result.totalRevenue || qty * price)}`, 'success');
            }
            // Refresh inventory
            fetchShopInventory();
        } else {
            agriAlert(result.error || 'Lỗi khi bán sản phẩm', 'error');
        }
    } catch (err) {
        console.error('Sell harvest error:', err);
        agriAlert('Lỗi kết nối server', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px; vertical-align:middle;">check_circle</span> Xác nhận bán';
        }
    }
}

// Make sell functions global
window.openSellHarvestModal = openSellHarvestModal;
window.updateSellHarvestPreview = updateSellHarvestPreview;
window.submitSellHarvest = submitSellHarvest;
