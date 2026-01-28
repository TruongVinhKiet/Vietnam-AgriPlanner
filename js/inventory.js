/**
 * Inventory Management Logic - Enhanced with Catalog Selection
 */

// Use existing API_BASE if available from features.js, otherwise define from CONFIG
var INV_API_BASE = typeof API_BASE !== 'undefined' ? API_BASE : 
                   (typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : 'http://localhost:8080/api');
const INV_API_URL = `${INV_API_BASE}/inventory`;

// Cached catalog data
let catalogData = {
    FERTILIZER: [],
    PESTICIDE: [],
    SEED: []
};
let currentMode = 'catalog'; // 'catalog' or 'custom'

function openInventoryModal() {
    const modal = document.getElementById('inventory-modal');
    modal.style.display = 'block';
    setTimeout(() => modal.classList.add('show'), 10);
    fetchInventory();
}

function closeInventoryModal() {
    const modal = document.getElementById('inventory-modal');
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
}

// Fetch and Render
function fetchInventory() {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    fetch(INV_API_URL, { headers })
        .then(response => response.json())
        .then(data => renderInventoryTable(data))
        .catch(err => console.error('Error fetching inventory:', err));
}

function renderInventoryTable(items) {
    const tbody = document.getElementById('inventory-table-body');
    const searchInput = document.getElementById('inventory-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    tbody.innerHTML = '';

    const filtered = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm) ||
        item.type.toLowerCase().includes(searchTerm)
    );

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Kho trống. Hãy nhập hàng!</td></tr>';
        return;
    }

    filtered.forEach(item => {
        const isLow = item.minThreshold != null && item.quantity <= item.minThreshold;
        const statusBadge = isLow
            ? '<span class="status-badge status-low">⚠️ Sắp hết</span>'
            : '<span class="status-badge status-ok">✓ Còn hàng</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td>${translateType(item.type)}</td>
            <td class="${isLow ? 'text-danger' : ''}">${item.quantity} ${item.unit}</td>
            <td>${formatCurrency(item.costPerUnit || 0)} / ${item.unit}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn-icon" onclick="editInventoryItem(${item.id})" title="Sửa">
                    <span class="material-symbols-outlined">edit</span>
                </button>
                <button class="btn-icon" onclick="addToInventory(${item.id})" title="Nhập thêm">
                    <span class="material-symbols-outlined">add_circle</span>
                </button>
                <button class="btn-icon text-danger" onclick="deleteInventoryItem(${item.id})" title="Xóa">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Helper: Translate Type
function translateType(type) {
    const map = {
        'FERTILIZER': '🌱 Phân bón',
        'PESTICIDE': '🦟 Thuốc BVTV',
        'SEED': '🌾 Hạt giống',
        'OTHER': '📦 Khác'
    };
    return map[type] || type;
}

// ==================== CATALOG FUNCTIONS ====================

// Switch between catalog and custom tabs
function switchInventoryTab(mode) {
    currentMode = mode;

    // Update tab buttons
    document.getElementById('tab-catalog').classList.toggle('active', mode === 'catalog');
    document.getElementById('tab-custom').classList.toggle('active', mode === 'custom');

    // Show/hide modes
    document.getElementById('catalog-mode').style.display = mode === 'catalog' ? 'block' : 'none';
    document.getElementById('custom-mode').style.display = mode === 'custom' ? 'block' : 'none';

    // Load catalog if switching to catalog mode
    if (mode === 'catalog') {
        loadCatalogItems();
    }
}

// Load catalog items based on selected type
async function loadCatalogItems() {
    const type = document.getElementById('inv-catalog-type').value;
    const productSelect = document.getElementById('inv-catalog-product');

    productSelect.innerHTML = '<option value="">Đang tải...</option>';

    try {
        let endpoint = '';
        let items = [];

        if (type === 'FERTILIZER') {
            // Check cache first
            if (catalogData.FERTILIZER.length === 0) {
                const res = await fetch(`${CONFIG.API_BASE_URL}/fertilizers`);
                catalogData.FERTILIZER = await res.json();
            }
            items = catalogData.FERTILIZER;
        } else if (type === 'PESTICIDE') {
            if (catalogData.PESTICIDE.length === 0) {
                const res = await fetch(`${CONFIG.API_BASE_URL}/pests/pesticides`);
                catalogData.PESTICIDE = await res.json();
            }
            items = catalogData.PESTICIDE;
        } else if (type === 'SEED') {
            if (catalogData.SEED.length === 0) {
                const res = await fetch(`${CONFIG.API_BASE_URL}/crops`);
                catalogData.SEED = await res.json();
            }
            items = catalogData.SEED;
        }

        // Populate select
        productSelect.innerHTML = '<option value="">-- Chọn sản phẩm --</option>';
        items.forEach(item => {
            const name = item.name || item.pesticideName || item.cropName;
            const price = item.costPerKg || item.price || item.seedCostPerKg || 50000;
            const option = document.createElement('option');
            option.value = JSON.stringify({
                id: item.id,
                name: name,
                price: price,
                unit: type === 'SEED' ? 'kg' : (item.unit || 'kg'),
                description: item.description || ''
            });
            option.textContent = `${name} - ${formatCurrency(price)}/kg`;
            productSelect.appendChild(option);
        });

    } catch (err) {
        console.error('Error loading catalog:', err);
        productSelect.innerHTML = '<option value="">Lỗi tải dữ liệu</option>';
    }
}

// Fill product info when selected
function fillProductInfo() {
    const productSelect = document.getElementById('inv-catalog-product');
    const preview = document.getElementById('inv-product-preview');
    const costInput = document.getElementById('inv-catalog-cost');

    if (!productSelect.value) {
        preview.style.display = 'none';
        costInput.value = '';
        return;
    }

    try {
        const product = JSON.parse(productSelect.value);
        costInput.value = product.price;

        document.getElementById('preview-name').textContent = product.name;
        document.getElementById('preview-desc').textContent = product.description || 'Sản phẩm chất lượng cao';
        preview.style.display = 'block';
    } catch (e) {
        preview.style.display = 'none';
    }
}

// ==================== FORM HANDLING ====================

let currentEditId = null;

function showAddInventoryForm() {
    currentEditId = null;
    document.getElementById('inventory-form').reset();
    document.getElementById('inv-form-title').innerText = 'Nhập kho vật tư mới';
    document.getElementById('inventory-form-overlay').style.display = 'flex';

    // Reset to catalog mode
    switchInventoryTab('catalog');
    loadCatalogItems();
}

function hideAddInventoryForm() {
    document.getElementById('inventory-form-overlay').style.display = 'none';
}

// Quick add more to existing item
window.addToInventory = async function (id) {
    const quantity = prompt('Nhập số lượng cần thêm:');
    if (!quantity || isNaN(parseFloat(quantity))) return;

    try {
        const res = await fetch(`${INV_API_URL}/${id}/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: parseFloat(quantity) })
        });

        if (res.ok) {
            fetchInventory();
            if (typeof showNotification === 'function') {
                showNotification('success', 'Thành công', 'Đã thêm vào kho!');
            }
        }
    } catch (err) {
        console.error(err);
    }
};

// Edit Prep
window.editInventoryItem = function (id) {
    fetch(`${INV_API_URL}`)
        .then(res => res.json())
        .then(items => {
            const item = items.find(i => i.id === id);
            if (item) {
                currentEditId = item.id;

                // Switch to custom mode for editing
                switchInventoryTab('custom');

                document.getElementById('inv-id').value = item.id;
                document.getElementById('inv-name').value = item.name;
                document.getElementById('inv-type').value = item.type;
                document.getElementById('inv-quantity').value = item.quantity;
                document.getElementById('inv-unit').value = item.unit;
                document.getElementById('inv-cost').value = item.costPerUnit;
                document.getElementById('inv-threshold').value = item.minThreshold;

                document.getElementById('inv-form-title').innerText = 'Cập nhật kho';
                document.getElementById('inventory-form-overlay').style.display = 'flex';
            }
        });
};

// Submit
async function handleInventorySubmit(e) {
    e.preventDefault();

    let payload;

    if (currentMode === 'catalog' && !currentEditId) {
        // Catalog mode - new item from catalog
        const productSelect = document.getElementById('inv-catalog-product');
        if (!productSelect.value) {
            alert('Vui lòng chọn sản phẩm!');
            return;
        }

        const product = JSON.parse(productSelect.value);
        const type = document.getElementById('inv-catalog-type').value;
        const quantity = parseFloat(document.getElementById('inv-catalog-quantity').value);

        payload = {
            name: product.name,
            type: type,
            quantity: quantity,
            unit: product.unit || 'kg',
            costPerUnit: product.price,
            minThreshold: parseFloat(document.getElementById('inv-threshold').value)
        };
    } else {
        // Custom mode or editing
        payload = {
            name: document.getElementById('inv-name').value,
            type: document.getElementById('inv-type').value,
            quantity: parseFloat(document.getElementById('inv-quantity').value),
            unit: document.getElementById('inv-unit').value,
            costPerUnit: parseFloat(document.getElementById('inv-cost').value),
            minThreshold: parseFloat(document.getElementById('inv-threshold').value)
        };
    }

    try {
        let url = INV_API_URL;
        let method = 'POST';

        if (currentEditId) {
            url = `${INV_API_URL}/${currentEditId}`;
            method = 'PUT';
        }

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            hideAddInventoryForm();
            fetchInventory();
            if (typeof showNotification === 'function') {
                showNotification('success', 'Thành công', 'Lưu kho thành công!');
            } else {
                alert('Lưu kho thành công!');
            }
        } else {
            alert('Lỗi khi lưu!');
        }
    } catch (err) {
        console.error(err);
        alert('Có lỗi xảy ra.');
    }
}

// Delete
window.deleteInventoryItem = async function (id) {
    if (!confirm('Bạn chắc chắn muốn xóa vật tư này?')) return;

    try {
        await fetch(`${INV_API_URL}/${id}`, { method: 'DELETE' });
        fetchInventory();
    } catch (err) {
        console.error(err);
    }
};

// Search Listener
document.getElementById('inventory-search')?.addEventListener('input', () => {
    fetchInventory();
});
