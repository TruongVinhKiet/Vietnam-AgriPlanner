// =====================================================
// AgriPlanner - Shop Page JavaScript
// =====================================================

// API_BASE_URL is already defined in config.js

// State
let allProducts = [];
let filteredProducts = [];
let userInventory = [];
let currentCategory = 'ALL';
let selectedProduct = null;
let userBalance = 0;

// Category labels
const CATEGORY_LABELS = {
    'HAT_GIONG': 'Hạt giống',
    'CON_GIONG': 'Con giống',
    'PHAN_BON': 'Phân bón',
    'THUC_AN': 'Thức ăn',
    'THUOC_TRU_SAU': 'Thuốc BVTV',
    'MAY_MOC': 'Máy móc'
};

const CATEGORY_ICONS = {
    'HAT_GIONG': 'grass',
    'CON_GIONG': 'pets',
    'PHAN_BON': 'compost',
    'THUC_AN': 'set_meal',
    'THUOC_TRU_SAU': 'bug_report',
    'MAY_MOC': 'agriculture'
};

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initShop();
        setupEventListeners();
        animatePageLoad();
    } catch (error) {
        console.error('Shop initialization error:', error);
    }
});

async function initShop() {
    try {
        await loadUserBalance();
        await loadProducts();
        await loadFeaturedItems();
        await loadUserInventory();
        updateUserInfo();
        
        // Check for purchase intent from Smart Advisor or URL params
        handlePurchaseIntent();
    } catch (error) {
        console.error('Error initializing shop:', error);
        showToast('Lỗi', 'Không thể tải dữ liệu cửa hàng', 'error');
    }
}

// Handle purchase intent from Smart Advisor or URL parameters
function handlePurchaseIntent() {
    // Check URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get('category');
    const searchParam = urlParams.get('search');
    const productIdParam = urlParams.get('productId');
    const quantityParam = urlParams.get('quantity');
    
    // Check localStorage for purchase intent
    const intentStr = localStorage.getItem('agriplanner_purchase_intent');
    let intent = null;
    
    if (intentStr) {
        try {
            intent = JSON.parse(intentStr);
            // Clear if older than 5 minutes
            if (intent.timestamp && Date.now() - intent.timestamp > 5 * 60 * 1000) {
                localStorage.removeItem('agriplanner_purchase_intent');
                intent = null;
            }
        } catch (e) {
            localStorage.removeItem('agriplanner_purchase_intent');
        }
    }
    
    // Apply filters from URL or intent
    const category = categoryParam || (intent?.category);
    const search = searchParam || (intent?.keyword);
    const productId = productIdParam || (intent?.productId);
    const quantity = parseInt(quantityParam || intent?.quantity || 1);
    
    if (category && category !== 'ALL') {
        setTimeout(() => {
            selectCategory(category, false);
        }, 100);
    }
    
    if (search) {
        setTimeout(() => {
            const searchInput = document.getElementById('shop-search');
            if (searchInput) {
                searchInput.value = search;
                searchProducts(search);
            }
        }, 200);
    }
    
    // If specific product, open purchase modal
    if (productId) {
        setTimeout(() => {
            const product = allProducts.find(p => p.id == productId);
            if (product) {
                openPurchaseModal(product, quantity);
            }
        }, 300);
    }
    
    // Show advisor notification
    if (intent?.fromAdvisor) {
        setTimeout(() => {
            showToast('Cố vấn thông minh', `Đã lọc sản phẩm theo gợi ý: ${search || category}`, 'info');
        }, 500);
        // Clear intent after using
        localStorage.removeItem('agriplanner_purchase_intent');
    }
    
    // Clean up URL
    if (categoryParam || searchParam || productIdParam) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
    }
}

function setupEventListeners() {
    // Category tabs
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const category = tab.dataset.category;
            selectCategory(category);
        });
    });

    // Search
    const searchInput = document.getElementById('shop-search');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchProducts(e.target.value);
            }, 300);
        });
    }

    // Sort
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            sortProducts(e.target.value);
        });
    }

    // Quantity input - safely add listener
    const qtyInput = document.getElementById('purchase-quantity');
    if (qtyInput) {
        qtyInput.addEventListener('input', updatePurchaseSummary);
        qtyInput.addEventListener('change', updatePurchaseSummary);
    }
}

function animatePageLoad() {
    // Remove fade-in class after animation or add animated class
    const fadeElements = document.querySelectorAll('.fade-in');
    fadeElements.forEach(el => {
        el.classList.add('animated');
    });

    gsap.from('.page-header', { duration: 0.6, y: -20, opacity: 0, ease: 'power2.out' });
    gsap.from('.category-tabs', { duration: 0.6, y: 20, opacity: 0, delay: 0.1, ease: 'power2.out' });
    gsap.from('.featured-section', { duration: 0.6, y: 20, opacity: 0, delay: 0.2, ease: 'power2.out' });
    gsap.from('.products-section', { duration: 0.6, y: 20, opacity: 0, delay: 0.3, ease: 'power2.out' });
}

// ==================== DATA LOADING ====================

async function loadUserBalance() {
    try {
        const userEmail = localStorage.getItem('userEmail');
        if (!userEmail) return;

        const response = await fetch(`${API_BASE_URL}/user/balance?email=${encodeURIComponent(userEmail)}`);
        if (response.ok) {
            const data = await response.json();
            userBalance = data.balance || 0;
            document.getElementById('user-balance').textContent = formatCurrency(userBalance);
        }
    } catch (error) {
        console.error('Error loading balance:', error);
    }
}

async function loadProducts() {
    try {
        const response = await fetch(`${API_BASE_URL}/shop/items`);
        if (response.ok) {
            allProducts = await response.json();
            filteredProducts = [...allProducts];
            renderProducts();
        }
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

async function loadFeaturedItems() {
    try {
        const response = await fetch(`${API_BASE_URL}/shop/items/featured`);
        if (response.ok) {
            const featured = await response.json();
            renderFeaturedItems(featured);
        }
    } catch (error) {
        console.error('Error loading featured items:', error);
    }
}

async function loadUserInventory() {
    try {
        const userEmail = localStorage.getItem('userEmail');
        if (!userEmail) return;

        const response = await fetch(`${API_BASE_URL}/shop/inventory?userEmail=${encodeURIComponent(userEmail)}`);
        if (response.ok) {
            const data = await response.json();
            userInventory = data.items || [];
            renderInventory(data);
            updateInventoryCount(data.totalItems || 0);
        }
    } catch (error) {
        console.error('Error loading inventory:', error);
    }
}

// ==================== RENDERING ====================

function renderProducts() {
    const grid = document.getElementById('products-grid');
    const empty = document.getElementById('products-empty');

    if (!grid) return;

    if (filteredProducts.length === 0) {
        grid.innerHTML = '';
        if (empty) empty.style.display = 'flex';
        return;
    }

    if (empty) empty.style.display = 'none';
    grid.innerHTML = filteredProducts.map(product => createProductCard(product)).join('');

    // Animate new cards
    gsap.from('.product-card', {
        duration: 0.4,
        y: 20,
        opacity: 0,
        stagger: 0.05,
        ease: 'power2.out'
    });
}

function createProductCard(product) {
    // Map FontAwesome icons to Material icons or render FontAwesome
    const materialIconMap = {
        'fa-seedling': 'grass',
        'fa-leaf': 'eco',
        'fa-recycle': 'recycling',
        'fa-flask': 'science',
        'fa-bug-slash': 'pest_control',
        'fa-spray-can': 'spray',
        'fa-virus-slash': 'coronavirus',
        'fa-cannabis': 'grass',
        'fa-bowl-food': 'restaurant',
        'fa-wheat-awn': 'grain',
        'fa-fish': 'set_meal',
        'fa-capsules': 'medication',
        'fa-hammer': 'hardware',
        'fa-digging': 'construction',
        'fa-rake': 'yard',
        'fa-spray-can-sparkles': 'spray',
        'fa-water': 'water_drop',
        'fa-scissors': 'content_cut',
        'fa-cut': 'content_cut',
        'fa-hand': 'pan_tool',
        'fa-hard-hat': 'engineering',
        'fa-tent': 'camping',
        'fa-film': 'layers',
        'fa-link': 'link',
        'fa-th-large': 'grid_view',
        'fa-layer-group': 'layers',
        'fa-tractor': 'agriculture',
        'fa-paw': 'pets'
    };

    const iconName = product.iconName || 'inventory_2';
    const materialIcon = materialIconMap[iconName] || 'inventory_2';

    const imageHtml = product.imageUrl
        ? `<img src="${product.imageUrl}" alt="${product.name}" onerror="this.parentElement.innerHTML='<span class=\\'material-symbols-outlined\\'>${materialIcon}</span>'">`
        : `<span class="material-symbols-outlined">${materialIcon}</span>`;

    const badgeHtml = product.isFeatured
        ? '<span class="product-card__badge">Nổi bật</span>'
        : '';

    const discountHtml = product.discountPercent > 0
        ? `<span class="product-card__discount">-${product.discountPercent}%</span>`
        : '';

    const originalPriceHtml = product.originalPrice && product.originalPrice > product.price
        ? `<span class="product-card__price-original">${formatCurrency(product.originalPrice)}</span>`
        : '';

    // Rating display
    const rating = product.rating || 5.0;
    const ratingStars = Math.round(rating);
    const ratingHtml = `
        <div class="product-card__rating" onclick="event.stopPropagation(); openProductReviewsModal(${product.id})">
            <span class="material-symbols-outlined">star</span>
            <span>${rating.toFixed(1)}</span>
        </div>
    `;

    return `
        <div class="product-card" onclick="openPurchaseModal(${product.id})">
            <div class="product-card__image">
                ${imageHtml}
                ${badgeHtml}
                ${discountHtml}
            </div>
            <div class="product-card__body">
                <div class="product-card__category">${CATEGORY_LABELS[product.category] || product.category}</div>
                <h4 class="product-card__name">${product.name}</h4>
                ${ratingHtml}
                <div class="product-card__price">
                    <span class="product-card__price-current">${formatCurrency(product.price)}</span>
                    ${originalPriceHtml}
                    <span class="product-card__price-unit">/${product.unit}</span>
                </div>
                <div class="product-card__footer">
                    <span class="product-card__sold">Đã bán ${product.soldCount || 0}</span>
                    <button class="product-card__btn product-card__btn--cart" onclick="event.stopPropagation(); addToCart(${product.id}, 1)" title="Thêm vào giỏ">
                        <span class="material-symbols-outlined">add_shopping_cart</span>
                    </button>
                    <button class="product-card__btn" onclick="event.stopPropagation(); openPurchaseModal(${product.id})">
                        <span class="material-symbols-outlined">shopping_cart</span>
                        Mua
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderFeaturedItems(items) {
    const grid = document.getElementById('featured-grid');
    if (items.length === 0) {
        document.getElementById('featured-section').style.display = 'none';
        return;
    }

    grid.innerHTML = items.slice(0, 4).map(product => createProductCard(product)).join('');
}

function renderInventory(data) {
    const container = document.getElementById('inventory-categories');
    const byCategory = data.byCategory || {};

    // Update summary
    document.getElementById('inv-total-items').textContent = data.totalItems || 0;
    document.getElementById('inv-total-value').textContent = formatCurrency(data.totalValue || 0);

    if (Object.keys(byCategory).length === 0) {
        container.innerHTML = `
            <div class="inventory-empty">
                <span class="material-symbols-outlined">inventory_2</span>
                <p>Kho hàng trống</p>
                <small>Mua sắm để thêm vật phẩm vào kho</small>
            </div>
        `;
        return;
    }

    container.innerHTML = Object.entries(byCategory).map(([category, items]) => `
        <div class="inventory-category">
            <div class="inventory-category__header">
                <span class="material-symbols-outlined">${CATEGORY_ICONS[category] || 'inventory_2'}</span>
                ${CATEGORY_LABELS[category] || category}
                <span style="margin-left: auto; font-weight: normal; color: var(--color-text-muted);">(${items.length})</span>
            </div>
            ${items.map(item => createInventoryItem(item)).join('')}
        </div>
    `).join('');
}

function createInventoryItem(item) {
    const imageHtml = item.imageUrl
        ? `<img src="${item.imageUrl}" alt="${item.effectiveName}">`
        : `<span class="material-symbols-outlined">${item.iconName || 'inventory_2'}</span>`;

    return `
        <div class="inventory-item">
            <div class="inventory-item__icon">${imageHtml}</div>
            <div class="inventory-item__info">
                <div class="inventory-item__name">${item.effectiveName}</div>
                <div class="inventory-item__qty">${formatNumber(item.quantity)} ${item.effectiveUnit}</div>
            </div>
            <div class="inventory-item__value">${formatCurrency(item.totalValue)}</div>
        </div>
    `;
}

function updateInventoryCount(count) {
    const badge = document.getElementById('inventory-count');
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
}

// ==================== FILTERING & SORTING ====================

function selectCategory(category) {
    currentCategory = category;

    // Update tabs
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.category === category);
    });

    // Filter products
    if (category === 'ALL') {
        filteredProducts = [...allProducts];
        document.getElementById('category-title').textContent = 'Tất cả sản phẩm';
    } else {
        filteredProducts = allProducts.filter(p => p.category === category);
        document.getElementById('category-title').textContent = CATEGORY_LABELS[category] || category;
    }

    renderProducts();

    // Hide featured when filtering
    document.getElementById('featured-section').style.display = category === 'ALL' ? 'block' : 'none';
}

async function searchProducts(keyword) {
    if (!keyword.trim()) {
        filteredProducts = currentCategory === 'ALL'
            ? [...allProducts]
            : allProducts.filter(p => p.category === currentCategory);
        renderProducts();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/shop/items/search?q=${encodeURIComponent(keyword)}`);
        if (response.ok) {
            const results = await response.json();
            filteredProducts = currentCategory === 'ALL'
                ? results
                : results.filter(p => p.category === currentCategory);
            renderProducts();
        }
    } catch (error) {
        console.error('Search error:', error);
    }
}

function sortProducts(sortBy) {
    switch (sortBy) {
        case 'price-low':
            filteredProducts.sort((a, b) => a.price - b.price);
            break;
        case 'price-high':
            filteredProducts.sort((a, b) => b.price - a.price);
            break;
        case 'name':
            filteredProducts.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
            break;
        case 'popular':
        default:
            filteredProducts.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
            break;
    }
    renderProducts();
}

// ==================== PURCHASE MODAL ====================

function openPurchaseModal(productId) {
    selectedProduct = allProducts.find(p => p.id === productId);
    if (!selectedProduct) return;

    const modal = document.getElementById('purchase-modal');
    if (!modal) return;

    // Update modal content
    const imageContainer = document.getElementById('purchase-item-image');
    if (selectedProduct.imageUrl) {
        imageContainer.innerHTML = `<img src="${selectedProduct.imageUrl}" alt="${selectedProduct.name}">`;
    } else {
        imageContainer.innerHTML = `<span class="material-symbols-outlined">${selectedProduct.iconName || 'inventory_2'}</span>`;
    }

    document.getElementById('purchase-item-name').textContent = selectedProduct.name;
    document.getElementById('purchase-item-desc').textContent = selectedProduct.description || 'Không có mô tả';
    document.getElementById('purchase-item-price').textContent = formatCurrency(selectedProduct.price);
    document.getElementById('purchase-item-unit').textContent = '/' + selectedProduct.unit;

    // Reset quantity
    document.getElementById('purchase-quantity').value = 1;

    // Check existing inventory
    checkExistingStock(productId);

    // Update summary
    updatePurchaseSummary();

    // Show modal with animation
    modal.classList.add('active');

    // Reset and animate - important to reset opacity first!
    const modalContent = modal.querySelector('.purchase-modal-content');
    if (modalContent) {
        modalContent.style.opacity = '1';
        modalContent.style.transform = 'scale(1)';
    }

    if (typeof gsap !== 'undefined') {
        gsap.fromTo('.purchase-modal-content',
            { scale: 0.9, opacity: 0 },
            { duration: 0.3, scale: 1, opacity: 1, ease: 'power2.out' }
        );
    }
}

function closePurchaseModal() {
    const modal = document.getElementById('purchase-modal');
    if (!modal) return;

    if (typeof gsap !== 'undefined') {
        gsap.to('.purchase-modal-content', {
            duration: 0.2,
            scale: 0.9,
            opacity: 0,
            ease: 'power2.in',
            onComplete: () => {
                modal.classList.remove('active');
                selectedProduct = null;
                // Reset styles after closing
                const modalContent = modal.querySelector('.purchase-modal-content');
                if (modalContent) {
                    modalContent.style.opacity = '';
                    modalContent.style.transform = '';
                }
            }
        });
    } else {
        modal.classList.remove('active');
        selectedProduct = null;
    }
}

async function checkExistingStock(shopItemId) {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;

    try {
        const response = await fetch(`${API_BASE_URL}/shop/inventory/check?shopItemId=${shopItemId}&userEmail=${encodeURIComponent(userEmail)}`);
        if (response.ok) {
            const data = await response.json();
            const noteEl = document.getElementById('inventory-note');
            const stockEl = document.getElementById('existing-stock');

            if (data.stock > 0) {
                stockEl.textContent = formatNumber(data.stock) + ' ' + (selectedProduct?.unit || 'đơn vị');
                noteEl.style.display = 'flex';
            } else {
                noteEl.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error checking stock:', error);
    }
}

function adjustQuantity(delta) {
    const input = document.getElementById('purchase-quantity');
    let value = parseInt(input.value) || 1;
    value = Math.max(1, value + delta);
    if (selectedProduct?.maxPurchase) {
        value = Math.min(value, selectedProduct.maxPurchase);
    }
    input.value = value;
    updatePurchaseSummary();
}

function updatePurchaseSummary() {
    if (!selectedProduct) return;

    const quantity = parseInt(document.getElementById('purchase-quantity').value) || 1;
    const unitPrice = selectedProduct.price;
    const total = unitPrice * quantity;
    const remaining = userBalance - total;

    document.getElementById('summary-unit-price').textContent = formatCurrency(unitPrice);
    document.getElementById('summary-quantity').textContent = quantity;
    document.getElementById('summary-total').textContent = formatCurrency(total);
    document.getElementById('summary-balance').textContent = formatCurrency(userBalance);
    document.getElementById('summary-remaining').textContent = formatCurrency(remaining);

    // Highlight if insufficient balance
    const remainingEl = document.getElementById('summary-remaining');
    if (remaining < 0) {
        remainingEl.style.color = 'var(--color-error)';
        document.getElementById('purchase-btn').disabled = true;
    } else {
        remainingEl.style.color = 'var(--color-success)';
        document.getElementById('purchase-btn').disabled = false;
    }
}

async function confirmPurchase() {
    if (!selectedProduct) return;

    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
        showToast('Lỗi', 'Vui lòng đăng nhập để mua hàng', 'error');
        return;
    }

    const quantity = parseInt(document.getElementById('purchase-quantity').value) || 1;
    const btn = document.getElementById('purchase-btn');

    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined rotating">sync</span> Đang xử lý...';

    try {
        const response = await fetch(`${API_BASE_URL}/shop/purchase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shopItemId: selectedProduct.id,
                quantity: quantity,
                userEmail: userEmail
            })
        });

        const result = await response.json();

        if (result.success) {
            showToast('Thành công!', `Đã mua ${selectedProduct.name} x${quantity}`, 'success');

            // Update balance
            userBalance = result.newBalance;
            document.getElementById('user-balance').textContent = formatCurrency(userBalance);

            // Reload inventory
            await loadUserInventory();

            // Close modal
            closePurchaseModal();

            // Animate balance change
            gsap.from('.balance-display', { duration: 0.3, scale: 1.1, ease: 'elastic.out' });
        } else {
            showToast('Lỗi', result.error || 'Không thể mua hàng', 'error');
        }
    } catch (error) {
        console.error('Purchase error:', error);
        showToast('Lỗi', 'Lỗi kết nối server', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined icon-sm">shopping_cart</span> Mua ngay';
    }
}

// ==================== INVENTORY PANEL ====================

function toggleInventoryPanel() {
    const panel = document.getElementById('inventory-panel');
    const isActive = panel.classList.contains('active');

    if (isActive) {
        gsap.to(panel, {
            duration: 0.3,
            x: '100%',
            ease: 'power2.in',
            onComplete: () => panel.classList.remove('active')
        });
    } else {
        panel.classList.add('active');
        gsap.fromTo(panel,
            { x: '100%' },
            { duration: 0.3, x: 0, ease: 'power2.out' }
        );
        // Reload inventory when opening
        loadUserInventory();
    }
}

// ==================== UTILITIES ====================

function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '0 VNĐ';
    return new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
}

function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return new Intl.NumberFormat('vi-VN').format(num);
}

function showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconMap = {
        'success': 'check_circle',
        'error': 'error',
        'warning': 'warning',
        'info': 'info'
    };

    toast.innerHTML = `
        <div class="toast__icon">
            <span class="material-symbols-outlined">${iconMap[type] || 'info'}</span>
        </div>
        <div class="toast__content">
            <div class="toast__title">${title}</div>
            <div class="toast__message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function updateUserInfo() {
    const name = localStorage.getItem('userName') || 'Người dùng';
    const email = localStorage.getItem('userEmail') || '';
    const avatar = localStorage.getItem('userAvatar') || '';

    document.getElementById('sidebar-name').textContent = name;
    document.getElementById('sidebar-email').textContent = email;

    if (avatar) {
        document.getElementById('sidebar-avatar').style.backgroundImage = `url('${avatar}')`;
    }
}

// ==================== CART FUNCTIONS ====================

let cartItems = [];
let cartPanelOpen = false;

async function loadCart() {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;

    try {
        const response = await fetch(`${API_BASE_URL}/cart?userEmail=${encodeURIComponent(userEmail)}`);
        if (response.ok) {
            const data = await response.json();
            cartItems = data.items || [];
            renderCart(data);
            updateCartCount(data.totalItems || 0);
        }
    } catch (error) {
        console.error('Error loading cart:', error);
    }
}

function renderCart(data) {
    const container = document.getElementById('cart-items');
    const footer = document.getElementById('cart-footer');
    const emptyEl = document.getElementById('cart-empty');

    if (!data.items || data.items.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        if (footer) footer.style.display = 'none';
        container.innerHTML = `
            <div class="cart-empty">
                <span class="material-symbols-outlined">remove_shopping_cart</span>
                <p>Giỏ hàng trống</p>
                <small>Thêm sản phẩm để bắt đầu mua sắm</small>
            </div>
        `;
        return;
    }

    if (footer) footer.style.display = 'flex';

    container.innerHTML = data.items.map(item => `
        <div class="cart-item" data-id="${item.id}">
            <div class="cart-item__image">
                ${item.imageUrl
            ? `<img src="${item.imageUrl}" alt="${item.itemName}">`
            : `<span class="material-symbols-outlined">${CATEGORY_ICONS[item.itemCategory] || 'inventory_2'}</span>`
        }
            </div>
            <div class="cart-item__details">
                <div class="cart-item__name">${item.itemName}</div>
                <div class="cart-item__price">${formatCurrency(item.unitPrice)}/${item.itemUnit}</div>
                <div class="cart-item__controls">
                    <button class="cart-item__qty-btn" onclick="updateCartQuantity(${item.id}, ${item.quantity - 1})">
                        <span class="material-symbols-outlined">remove</span>
                    </button>
                    <span class="cart-item__qty">${item.quantity}</span>
                    <button class="cart-item__qty-btn" onclick="updateCartQuantity(${item.id}, ${item.quantity + 1})">
                        <span class="material-symbols-outlined">add</span>
                    </button>
                    <button class="cart-item__remove" onclick="removeFromCart(${item.id})">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    // Update totals
    document.getElementById('cart-total-items').textContent = data.totalItems;
    document.getElementById('cart-total-value').textContent = formatCurrency(data.totalValue);
    document.getElementById('cart-checkout-total').textContent = formatCurrency(data.totalValue);
}

function updateCartCount(count) {
    const badge = document.getElementById('cart-count');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

function toggleCartPanel() {
    const panel = document.getElementById('cart-panel');
    const overlay = document.getElementById('cart-overlay');

    cartPanelOpen = !cartPanelOpen;

    if (cartPanelOpen) {
        panel.classList.add('open');
        overlay.classList.add('active');
        loadCart();
    } else {
        panel.classList.remove('open');
        overlay.classList.remove('active');
    }
}

async function addToCart(shopItemId, quantity = 1) {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
        showToast('Lỗi', 'Vui lòng đăng nhập để thêm vào giỏ hàng', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/cart/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shopItemId: shopItemId,
                quantity: quantity,
                userEmail: userEmail
            })
        });

        if (response.ok) {
            showToast('Thành công', 'Đã thêm vào giỏ hàng', 'success');
            await loadCart();
        } else {
            const error = await response.json();
            showToast('Lỗi', error.error || 'Không thể thêm vào giỏ hàng', 'error');
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        showToast('Lỗi', 'Không thể thêm vào giỏ hàng', 'error');
    }
}

async function addToCartFromModal() {
    if (!selectedProduct) return;
    const quantity = parseInt(document.getElementById('purchase-quantity').value) || 1;
    await addToCart(selectedProduct.id, quantity);
    closePurchaseModal();
}

async function updateCartQuantity(cartItemId, newQuantity) {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;

    try {
        if (newQuantity <= 0) {
            await removeFromCart(cartItemId);
            return;
        }

        const response = await fetch(`${API_BASE_URL}/cart/${cartItemId}/quantity?quantity=${newQuantity}&userEmail=${encodeURIComponent(userEmail)}`, {
            method: 'PUT'
        });

        if (response.ok) {
            await loadCart();
        }
    } catch (error) {
        console.error('Error updating cart quantity:', error);
    }
}

async function removeFromCart(cartItemId) {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;

    try {
        const response = await fetch(`${API_BASE_URL}/cart/${cartItemId}?userEmail=${encodeURIComponent(userEmail)}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Đã xóa', 'Sản phẩm đã được xóa khỏi giỏ hàng', 'info');
            await loadCart();
        }
    } catch (error) {
        console.error('Error removing from cart:', error);
    }
}

async function clearCart() {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;

    if (!confirm('Bạn có chắc muốn xóa tất cả sản phẩm trong giỏ hàng?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/cart/clear?userEmail=${encodeURIComponent(userEmail)}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Đã xóa', 'Giỏ hàng đã được làm trống', 'info');
            await loadCart();
        }
    } catch (error) {
        console.error('Error clearing cart:', error);
    }
}

async function checkoutCart() {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail || cartItems.length === 0) return;

    // Calculate total
    const totalValue = cartItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

    if (totalValue > userBalance) {
        showToast('Lỗi', 'Số dư không đủ để thanh toán', 'error');
        return;
    }

    if (!confirm(`Xác nhận thanh toán ${formatCurrency(totalValue)}?`)) return;

    try {
        // Purchase each item
        for (const item of cartItems) {
            const userId = localStorage.getItem('userId');
            await fetch(`${API_BASE_URL}/shop/purchase`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: parseInt(userId),
                    shopItemId: item.shopItemId,
                    quantity: item.quantity
                })
            });
        }

        // Clear cart after successful checkout
        await clearCartSilent();
        await loadUserBalance();
        await loadUserInventory();

        showToast('Thành công', 'Thanh toán thành công! Kiểm tra kho hàng của bạn.', 'success');
        toggleCartPanel();
    } catch (error) {
        console.error('Error during checkout:', error);
        showToast('Lỗi', 'Không thể hoàn tất thanh toán', 'error');
    }
}

async function clearCartSilent() {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;
    await fetch(`${API_BASE_URL}/cart/clear?userEmail=${encodeURIComponent(userEmail)}`, { method: 'DELETE' });
    await loadCart();
}

// ==================== REVIEW FUNCTIONS ====================

let currentReviewPurchase = null;
let currentReviewRating = 0;

async function loadProductReviews(shopItemId) {
    try {
        const response = await fetch(`${API_BASE_URL}/reviews/product/${shopItemId}`);
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Error loading reviews:', error);
    }
    return null;
}

function openProductReviewsModal(shopItemId) {
    const modal = document.getElementById('product-reviews-modal');
    if (!modal) return;

    loadProductReviews(shopItemId).then(data => {
        if (!data) return;

        renderReviewsSummary(data);
        renderReviewsList(data.recentReviews);
        modal.classList.add('active');
    });
}

function closeProductReviewsModal() {
    const modal = document.getElementById('product-reviews-modal');
    if (modal) modal.classList.remove('active');
}

function renderReviewsSummary(data) {
    const container = document.getElementById('reviews-summary');
    if (!container) return;

    const stars = Array(5).fill(0).map((_, i) =>
        i < Math.round(data.averageRating)
            ? '<span class="material-symbols-outlined">star</span>'
            : '<span class="material-symbols-outlined empty">star</span>'
    ).join('');

    const totalReviews = data.totalReviews || 0;
    const distribution = data.ratingDistribution || {};

    container.innerHTML = `
        <div class="reviews-avg">
            <div class="reviews-avg__score">${data.averageRating?.toFixed(1) || '5.0'}</div>
            <div class="reviews-avg__stars">${stars}</div>
            <div class="reviews-avg__count">${totalReviews} đánh giá</div>
        </div>
        <div class="reviews-bars">
            ${[5, 4, 3, 2, 1].map(rating => {
        const count = distribution[rating] || 0;
        const percent = totalReviews > 0 ? (count / totalReviews * 100) : 0;
        return `
                    <div class="rating-bar">
                        <span class="rating-bar__label">${rating} <span class="material-symbols-outlined">star</span></span>
                        <div class="rating-bar__track">
                            <div class="rating-bar__fill" style="width: ${percent}%"></div>
                        </div>
                        <span class="rating-bar__count">${count}</span>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

function renderReviewsList(reviews) {
    const container = document.getElementById('reviews-list');
    if (!container) return;

    if (!reviews || reviews.length === 0) {
        container.innerHTML = `
            <div class="reviews-empty">
                <span class="material-symbols-outlined">rate_review</span>
                <p>Chưa có đánh giá nào</p>
            </div>
        `;
        return;
    }

    container.innerHTML = reviews.map(review => {
        const stars = Array(5).fill(0).map((_, i) =>
            `<span class="material-symbols-outlined ${i >= review.rating ? 'empty' : ''}">star</span>`
        ).join('');

        const initial = review.userName?.charAt(0)?.toUpperCase() || 'U';
        const date = new Date(review.createdAt).toLocaleDateString('vi-VN');

        return `
            <div class="review-card">
                <div class="review-card__header">
                    <div class="review-card__avatar">
                        ${review.userAvatar
                ? `<img src="${review.userAvatar}" alt="${review.userName}">`
                : initial
            }
                    </div>
                    <div class="review-card__info">
                        <div class="review-card__name">${review.userName || 'Người dùng'}</div>
                        <div class="review-card__meta">
                            <div class="review-card__stars">${stars}</div>
                            <span>${date}</span>
                            ${review.isVerifiedPurchase ? `
                                <span class="review-card__verified">
                                    <span class="material-symbols-outlined">verified</span>
                                    Đã mua hàng
                                </span>
                            ` : ''}
                        </div>
                    </div>
                </div>
                ${review.comment ? `<p class="review-card__comment">${review.comment}</p>` : ''}
            </div>
        `;
    }).join('');
}

function openReviewModal(purchaseId, itemName, imageUrl, iconName, quantity, unit) {
    const modal = document.getElementById('review-modal');
    if (!modal) return;

    currentReviewPurchase = purchaseId;
    currentReviewRating = 0;

    // Update item info
    const imageContainer = document.getElementById('review-item-image');
    if (imageUrl) {
        imageContainer.innerHTML = `<img src="${imageUrl}" alt="${itemName}">`;
    } else {
        imageContainer.innerHTML = `<span class="material-symbols-outlined">${iconName || 'inventory_2'}</span>`;
    }

    document.getElementById('review-item-name').textContent = itemName;
    document.getElementById('review-item-purchase').textContent = `Đã mua: ${quantity} ${unit}`;
    document.getElementById('review-comment').value = '';

    // Reset stars
    document.querySelectorAll('.star-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('rating-text').textContent = 'Chọn số sao';

    // Setup star click handlers
    document.querySelectorAll('.star-btn').forEach(btn => {
        btn.onclick = () => {
            currentReviewRating = parseInt(btn.dataset.rating);
            updateStarDisplay(currentReviewRating);
        };
    });

    modal.classList.add('active');
}

function closeReviewModal() {
    const modal = document.getElementById('review-modal');
    if (modal) modal.classList.remove('active');
    currentReviewPurchase = null;
    currentReviewRating = 0;
}

function updateStarDisplay(rating) {
    const ratingTexts = {
        1: 'Rất không hài lòng',
        2: 'Không hài lòng',
        3: 'Bình thường',
        4: 'Hài lòng',
        5: 'Rất hài lòng'
    };

    document.querySelectorAll('.star-btn').forEach((btn, index) => {
        if (index < rating) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.getElementById('rating-text').textContent = ratingTexts[rating] || 'Chọn số sao';
}

async function submitReview() {
    if (!currentReviewPurchase) return;
    if (currentReviewRating < 1 || currentReviewRating > 5) {
        showToast('Lỗi', 'Vui lòng chọn số sao đánh giá', 'error');
        return;
    }

    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;

    const comment = document.getElementById('review-comment').value.trim();

    try {
        const response = await fetch(`${API_BASE_URL}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                purchaseId: currentReviewPurchase,
                rating: currentReviewRating,
                comment: comment,
                userEmail: userEmail
            })
        });

        if (response.ok) {
            showToast('Thành công', 'Cảm ơn bạn đã đánh giá sản phẩm!', 'success');
            closeReviewModal();
        } else {
            const error = await response.json();
            showToast('Lỗi', error.error || 'Không thể gửi đánh giá', 'error');
        }
    } catch (error) {
        console.error('Error submitting review:', error);
        showToast('Lỗi', 'Không thể gửi đánh giá', 'error');
    }
}

// Make functions globally accessible
window.openPurchaseModal = openPurchaseModal;
window.closePurchaseModal = closePurchaseModal;
window.confirmPurchase = confirmPurchase;
window.adjustQuantity = adjustQuantity;
window.toggleInventoryPanel = toggleInventoryPanel;
window.toggleCartPanel = toggleCartPanel;
window.addToCart = addToCart;
window.addToCartFromModal = addToCartFromModal;
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.checkoutCart = checkoutCart;
window.openProductReviewsModal = openProductReviewsModal;
window.closeProductReviewsModal = closeProductReviewsModal;
window.openReviewModal = openReviewModal;
window.closeReviewModal = closeReviewModal;
window.submitReview = submitReview;
// Order system exports
window.toggleOrdersPanel = toggleOrdersPanel;
window.filterOrders = filterOrders;
window.openCheckoutModal = openCheckoutModal;
window.closeCheckoutModal = closeCheckoutModal;
window.selectPurchaseType = selectPurchaseType;
window.selectShippingOption = selectShippingOption;
window.selectPaymentMethod = selectPaymentMethod;
window.openAddressSelector = openAddressSelector;
window.closeAddressSelector = closeAddressSelector;
window.selectAddress = selectAddress;
window.openNewAddressForm = openNewAddressForm;
window.closeNewAddressForm = closeNewAddressForm;
window.saveNewAddress = saveNewAddress;
window.placeOrder = placeOrder;
window.openTrackingModal = openTrackingModal;
window.closeTrackingModal = closeTrackingModal;
window.confirmOrderReceived = confirmOrderReceived;

// Load cart on init
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(loadCart, 500);
    setTimeout(loadOrders, 600);
    setTimeout(loadAddresses, 700);
});

// ==================== ORDER SYSTEM ====================

let orders = [];
let currentOrderFilter = 'ALL';
let addresses = [];
let selectedAddress = null;
let selectedShipping = 'EXPRESS';
let selectedPayment = 'PAY_NOW';
let selectedPurchaseType = 'WEBSITE_ORDER';
let shippingOptions = [];
let trackingMap = null;
let trackingMarker = null;
let trackingInterval = null;
let currentTrackingOrder = null;

// Orders Panel
function toggleOrdersPanel() {
    const panel = document.getElementById('orders-panel');
    const overlay = document.getElementById('orders-overlay');

    if (panel.classList.contains('open')) {
        panel.classList.remove('open');
        overlay.classList.remove('active');
    } else {
        panel.classList.add('open');
        overlay.classList.add('active');
        loadOrders();
    }
}

async function loadOrders() {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/orders`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            orders = await response.json();
            renderOrders();
            updateOrdersCount();
        }
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

function renderOrders() {
    const container = document.getElementById('orders-list');
    const emptyEl = document.getElementById('orders-empty');

    let filtered = orders;
    if (currentOrderFilter !== 'ALL') {
        filtered = orders.filter(o => o.status === currentOrderFilter);
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="orders-empty">
                <span class="material-symbols-outlined">receipt_long</span>
                <p>Không có đơn hàng</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(order => createOrderCard(order)).join('');
}

function createOrderCard(order) {
    const statusLabels = {
        'PENDING': { text: 'Chờ xử lý', class: 'pending' },
        'PROCESSING': { text: 'Đang xử lý', class: 'processing' },
        'SHIPPING': { text: 'Đang giao', class: 'shipping' },
        'DELIVERED': { text: 'Đã giao', class: 'delivered' },
        'CANCELLED': { text: 'Đã hủy', class: 'cancelled' }
    };

    const status = statusLabels[order.status] || { text: order.status, class: '' };
    const date = new Date(order.createdAt).toLocaleDateString('vi-VN');
    const itemsText = order.items?.map(i => `${i.itemName} x${i.quantity}`).join(', ') || 'N/A';
    const purchaseTypeText = order.purchaseType === 'SELF_PURCHASE' ? '(Tự mua)' : '';

    const onclick = order.status === 'SHIPPING'
        ? `openTrackingModal(${order.id})`
        : order.status === 'DELIVERED' && !order.items?.[0]?.hasReview
            ? `openReviewFromOrder(${order.id})`
            : '';

    return `
        <div class="order-card" onclick="${onclick}">
            <div class="order-card__header">
                <span class="order-card__code">${order.orderCode} ${purchaseTypeText}</span>
                <span class="order-card__date">${date}</span>
            </div>
            <div class="order-card__items">${itemsText.substring(0, 50)}${itemsText.length > 50 ? '...' : ''}</div>
            <div class="order-card__footer">
                <span class="order-card__total">${formatCurrency(order.totalAmount)}</span>
                <span class="order-card__status ${status.class}">
                    <span class="material-symbols-outlined">${getStatusIcon(order.status)}</span>
                    ${status.text}
                </span>
            </div>
        </div>
    `;
}

function getStatusIcon(status) {
    const icons = {
        'PENDING': 'schedule',
        'PROCESSING': 'inventory',
        'SHIPPING': 'local_shipping',
        'DELIVERED': 'check_circle',
        'CANCELLED': 'cancel'
    };
    return icons[status] || 'help';
}

function filterOrders(status) {
    currentOrderFilter = status;
    document.querySelectorAll('.orders-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.status === status);
    });
    renderOrders();
}

function updateOrdersCount() {
    const badge = document.getElementById('orders-count');
    const pending = orders.filter(o => ['PENDING', 'PROCESSING', 'SHIPPING'].includes(o.status)).length;
    if (badge) {
        badge.textContent = pending;
        badge.style.display = pending > 0 ? 'flex' : 'none';
    }
}

// Checkout Modal
function openCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    if (!modal) return;

    // Reset state
    selectedPurchaseType = 'WEBSITE_ORDER';
    selectedPayment = 'PAY_NOW';
    selectedShipping = 'EXPRESS';

    // Update UI
    document.querySelectorAll('.purchase-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === 'WEBSITE_ORDER');
    });

    // Render checkout items
    renderCheckoutItems();

    // Load shipping options
    if (selectedAddress) {
        calculateShipping();
    }

    // Update summary
    updateCheckoutSummary();

    // Show modal
    modal.classList.add('active');

    // Show/hide sections
    document.getElementById('website-order-form').style.display = 'block';
    document.getElementById('self-purchase-form').style.display = 'none';
    document.getElementById('shipping-fee-row').style.display = 'flex';
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    if (modal) modal.classList.remove('active');
}

function selectPurchaseType(type) {
    selectedPurchaseType = type;

    document.querySelectorAll('.purchase-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });

    const websiteForm = document.getElementById('website-order-form');
    const selfForm = document.getElementById('self-purchase-form');
    const shippingRow = document.getElementById('shipping-fee-row');
    const discountRow = document.getElementById('discount-row');

    if (type === 'SELF_PURCHASE') {
        websiteForm.style.display = 'none';
        selfForm.style.display = 'block';
        shippingRow.style.display = 'none';
        discountRow.style.display = 'none';
    } else {
        websiteForm.style.display = 'block';
        selfForm.style.display = 'none';
        shippingRow.style.display = 'flex';
    }

    updateCheckoutSummary();
}

function renderCheckoutItems() {
    const container = document.getElementById('checkout-items');
    if (!container || !cartItems || cartItems.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--color-text-muted);">Giỏ hàng trống</p>';
        return;
    }

    container.innerHTML = cartItems.map(item => `
        <div class="checkout-item">
            <div class="checkout-item__image">
                ${item.imageUrl
            ? `<img src="${item.imageUrl}" alt="${item.itemName}">`
            : `<span class="material-symbols-outlined">inventory_2</span>`
        }
            </div>
            <div class="checkout-item__info">
                <div class="checkout-item__name">${item.itemName}</div>
                <div class="checkout-item__qty">${item.quantity} x ${formatCurrency(item.unitPrice)}</div>
            </div>
            <div class="checkout-item__price">${formatCurrency(item.unitPrice * item.quantity)}</div>
        </div>
    `).join('');
}

async function calculateShipping() {
    if (!selectedAddress || cartItems.length === 0) return;

    const token = localStorage.getItem('authToken');

    try {
        // Build request body - handle both database addresses and profile addresses
        const requestBody = {
            items: cartItems.map(item => ({
                shopItemId: item.shopItemId,
                quantity: item.quantity,
                unitPrice: item.unitPrice
            }))
        };

        if (selectedAddress.isFromProfile) {
            // Address from user profile - send coordinates directly
            requestBody.latitude = selectedAddress.latitude;
            requestBody.longitude = selectedAddress.longitude;
        } else {
            // Address from database - send addressId
            requestBody.addressId = selectedAddress.id;
        }

        const response = await fetch(`${API_BASE_URL}/orders/calculate-shipping`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (response.ok) {
            const data = await response.json();
            shippingOptions = data.options;
            renderShippingOptions(data);
            updateCheckoutSummary();
        }
    } catch (error) {
        console.error('Error calculating shipping:', error);
    }
}

function renderShippingOptions(data) {
    const container = document.getElementById('shipping-options');
    if (!container) return;

    container.innerHTML = data.options.map((option, index) => `
        <div class="shipping-option ${option.type === selectedShipping ? 'active' : ''}" 
             onclick="selectShippingOption('${option.type}')">
            <input type="radio" name="shipping" value="${option.type}" ${option.type === selectedShipping ? 'checked' : ''}>
            <div class="shipping-option__icon">
                <span class="material-symbols-outlined">
                    ${option.type === 'EXPRESS' ? 'rocket_launch' : option.type === 'INSTANT' ? 'bolt' : 'local_shipping'}
                </span>
            </div>
            <div class="shipping-option__info">
                <div class="shipping-option__name">${option.displayName}</div>
                <div class="shipping-option__eta">${option.estimatedDays}</div>
            </div>
            <div class="shipping-option__fee ${option.fee === 0 ? 'free' : ''}">
                ${option.fee === 0 ? 'Miễn phí' : formatCurrency(option.fee)}
            </div>
        </div>
    `).join('');
}

function selectShippingOption(type) {
    selectedShipping = type;
    document.querySelectorAll('.shipping-option').forEach(opt => {
        opt.classList.toggle('active', opt.querySelector('input').value === type);
    });
    updateCheckoutSummary();
}

function selectPaymentMethod(method) {
    selectedPayment = method;
    document.querySelectorAll('.payment-option').forEach(opt => {
        opt.classList.toggle('active', opt.querySelector('input').value === method);
    });
    updateCheckoutSummary();
}

function updateCheckoutSummary() {
    // Calculate subtotal
    const subtotal = cartItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    document.getElementById('checkout-subtotal').textContent = formatCurrency(subtotal);

    // Get shipping fee
    let shippingFee = 0;
    if (selectedPurchaseType === 'WEBSITE_ORDER') {
        const option = shippingOptions.find(o => o.type === selectedShipping);
        shippingFee = option ? option.fee : 0;
    }
    document.getElementById('checkout-shipping').textContent = formatCurrency(shippingFee);

    // Calculate discount (5% for PAY_NOW)
    let discount = 0;
    const discountRow = document.getElementById('discount-row');
    if (selectedPurchaseType === 'WEBSITE_ORDER' && selectedPayment === 'PAY_NOW') {
        discount = (subtotal + shippingFee) * 0.05;
        discountRow.style.display = 'flex';
        document.getElementById('checkout-discount').textContent = `-${formatCurrency(discount)}`;
    } else {
        discountRow.style.display = 'none';
    }

    // Calculate total
    let total = subtotal;
    if (selectedPurchaseType === 'WEBSITE_ORDER') {
        total = subtotal + shippingFee - discount;
    } else if (selectedPurchaseType === 'SELF_PURCHASE') {
        const selfPrice = parseFloat(document.getElementById('self-purchase-price')?.value) || 0;
        total = selfPrice;
    }
    document.getElementById('checkout-total').textContent = formatCurrency(total);

    // Balance
    document.getElementById('checkout-balance').textContent = formatCurrency(userBalance);
    const remaining = userBalance - total;
    const remainingEl = document.getElementById('checkout-remaining');
    remainingEl.textContent = formatCurrency(remaining);
    remainingEl.style.color = remaining < 0 ? 'var(--color-error)' : 'var(--color-success)';

    // Disable place order button if insufficient balance
    const placeOrderBtn = document.getElementById('place-order-btn');
    if (placeOrderBtn) {
        placeOrderBtn.disabled = remaining < 0 || (selectedPurchaseType === 'WEBSITE_ORDER' && !selectedAddress);
    }
}

// Address Management
async function loadAddresses() {
    const token = localStorage.getItem('authToken');
    const userEmail = localStorage.getItem('userEmail');
    if (!token) return;

    try {
        // First try to load from addresses API
        const response = await fetch(`${API_BASE_URL}/addresses`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            addresses = await response.json();
            selectedAddress = addresses.find(a => a.isDefault) || addresses[0] || null;
        }

        // If no addresses, fallback to user profile address
        if ((!addresses || addresses.length === 0) && userEmail) {
            const profileResponse = await fetch(`${API_BASE_URL}/user/profile?email=${encodeURIComponent(userEmail)}`);
            if (profileResponse.ok) {
                const profile = await profileResponse.json();
                if (profile.defaultAddress && profile.addressLat && profile.addressLng) {
                    // Create a virtual address object from profile
                    selectedAddress = {
                        id: 'profile',
                        fullAddress: profile.defaultAddress,
                        latitude: profile.addressLat,
                        longitude: profile.addressLng,
                        receiverName: profile.fullName || 'Người nhận',
                        receiverPhone: profile.phone || '',
                        isDefault: true,
                        isFromProfile: true // Flag to identify this is from user profile
                    };
                    addresses = [selectedAddress];
                }
            }
        }

        updateSelectedAddressDisplay();
    } catch (error) {
        console.error('Error loading addresses:', error);
    }
}

function updateSelectedAddressDisplay() {
    const container = document.getElementById('selected-address');
    if (!container) return;

    if (!selectedAddress) {
        container.innerHTML = `<p>Chưa có địa chỉ. <a href="settings.html">Thêm địa chỉ</a></p>`;
        return;
    }

    container.innerHTML = `
        <div class="address-name">${selectedAddress.receiverName || 'Người nhận'}</div>
        <div class="address-text">${selectedAddress.fullAddress}</div>
        ${selectedAddress.receiverPhone ? `<div class="address-phone">${selectedAddress.receiverPhone}</div>` : ''}
    `;

    // Recalculate shipping when address changes
    calculateShipping();
}

function openAddressSelector() {
    const modal = document.getElementById('address-selector-modal');
    if (!modal) return;

    renderAddressList();
    modal.classList.add('active');
}

function closeAddressSelector() {
    const modal = document.getElementById('address-selector-modal');
    if (modal) modal.classList.remove('active');
}

function renderAddressList() {
    const container = document.getElementById('addresses-list');
    if (!container) return;

    if (addresses.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--color-text-muted); padding: 20px;">Chưa có địa chỉ nào</p>';
        return;
    }

    container.innerHTML = addresses.map(addr => `
        <div class="address-item ${addr.id === selectedAddress?.id ? 'selected' : ''}" 
             onclick="selectAddress(${addr.id})">
            <input type="radio" name="address" class="address-item__radio" 
                   ${addr.id === selectedAddress?.id ? 'checked' : ''}>
            <div class="address-item__info">
                ${addr.label ? `<span class="address-item__label">${addr.label}</span>` : ''}
                <div class="address-item__name">${addr.receiverName || 'Người nhận'}</div>
                <div class="address-item__address">${addr.fullAddress}</div>
                ${addr.receiverPhone ? `<div class="address-item__phone">${addr.receiverPhone}</div>` : ''}
                ${addr.isDefault ? `<div class="address-item__default"><span class="material-symbols-outlined">check_circle</span> Mặc định</div>` : ''}
            </div>
        </div>
    `).join('');
}

function selectAddress(addressId) {
    selectedAddress = addresses.find(a => a.id === addressId);
    updateSelectedAddressDisplay();
    closeAddressSelector();
}

function openNewAddressForm() {
    closeAddressSelector();
    const modal = document.getElementById('new-address-modal');
    if (modal) modal.classList.add('active');
}

function closeNewAddressForm() {
    const modal = document.getElementById('new-address-modal');
    if (modal) modal.classList.remove('active');
}

async function saveNewAddress() {
    const fullAddress = document.getElementById('new-address-input').value.trim();
    if (!fullAddress) {
        showToast('Lỗi', 'Vui lòng nhập địa chỉ', 'error');
        return;
    }

    const token = localStorage.getItem('authToken');

    try {
        // Geocode address using Nominatim
        let latitude = null, longitude = null;
        try {
            const geoResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`);
            const geoData = await geoResponse.json();
            if (geoData && geoData.length > 0) {
                latitude = parseFloat(geoData[0].lat);
                longitude = parseFloat(geoData[0].lon);
            }
        } catch (e) {
            console.log('Geocoding failed, continuing without coordinates');
        }

        const response = await fetch(`${API_BASE_URL}/addresses`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fullAddress: fullAddress,
                latitude: latitude,
                longitude: longitude,
                receiverName: document.getElementById('new-address-name').value.trim(),
                receiverPhone: document.getElementById('new-address-phone').value.trim(),
                label: document.getElementById('new-address-label').value.trim(),
                isDefault: document.getElementById('new-address-default').checked
            })
        });

        if (response.ok) {
            showToast('Thành công', 'Đã thêm địa chỉ mới', 'success');
            closeNewAddressForm();
            await loadAddresses();
            openAddressSelector();
        } else {
            const error = await response.json();
            showToast('Lỗi', error.message || 'Không thể thêm địa chỉ', 'error');
        }
    } catch (error) {
        console.error('Error saving address:', error);
        showToast('Lỗi', 'Không thể thêm địa chỉ', 'error');
    }
}

// Place Order
async function placeOrder() {
    if (cartItems.length === 0) {
        showToast('Lỗi', 'Giỏ hàng trống', 'error');
        return;
    }

    const token = localStorage.getItem('authToken');

    // Check if user is logged in with valid token
    if (!token || token === 'null' || token === 'undefined' || !token.includes('.')) {
        showToast('Lỗi', 'Vui lòng đăng nhập để đặt hàng', 'error');
        setTimeout(() => {
            window.location.href = 'login.html?redirect=shop.html';
        }, 1500);
        return;
    }

    const btn = document.getElementById('place-order-btn');

    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined rotating">sync</span> Đang xử lý...';

    try {
        let orderData = {
            purchaseType: selectedPurchaseType,
            items: cartItems.map(item => ({
                shopItemId: item.shopItemId,
                quantity: item.quantity,
                unitPrice: item.unitPrice
            }))
        };

        if (selectedPurchaseType === 'SELF_PURCHASE') {
            const selfPrice = parseFloat(document.getElementById('self-purchase-price').value);
            if (!selfPrice || selfPrice <= 0) {
                showToast('Lỗi', 'Vui lòng nhập giá đã mua', 'error');
                return;
            }
            orderData.selfPurchasePrice = selfPrice;
            orderData.notes = document.getElementById('self-purchase-notes').value;
        } else {
            if (!selectedAddress) {
                showToast('Lỗi', 'Vui lòng chọn địa chỉ giao hàng', 'error');
                return;
            }
            orderData.shippingType = selectedShipping;
            orderData.paymentMethod = selectedPayment;

            if (selectedAddress.isFromProfile) {
                // Address from user profile - send address text and coordinates
                orderData.shippingAddressText = selectedAddress.fullAddress;
                orderData.destLat = selectedAddress.latitude;
                orderData.destLng = selectedAddress.longitude;
            } else {
                // Address from database
                orderData.shippingAddressId = selectedAddress.id;
            }
        }

        const response = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (response.ok) {
            const order = await response.json();
            showToast('Thành công', `Đã đặt hàng ${order.orderCode}`, 'success');

            // Clear cart
            await clearCartSilent();

            // Reload data
            await loadUserBalance();
            await loadOrders();
            if (selectedPurchaseType === 'SELF_PURCHASE') {
                await loadUserInventory();
            }

            closeCheckoutModal();
            toggleCartPanel();
        } else {
            const error = await response.json();
            showToast('Lỗi', error.message || 'Không thể đặt hàng', 'error');
        }
    } catch (error) {
        console.error('Error placing order:', error);
        showToast('Lỗi', 'Không thể đặt hàng', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined icon-sm">shopping_cart_checkout</span> Đặt hàng';
    }
}

// Tracking Modal
function openTrackingModal(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status !== 'SHIPPING') return;

    currentTrackingOrder = order;

    const modal = document.getElementById('tracking-modal');
    if (!modal) return;

    // Update info
    document.getElementById('tracking-order-code').textContent = order.orderCode;
    document.getElementById('tracking-origin').textContent = '165c Linh Trung, Thủ Đức (Kho)';
    document.getElementById('tracking-destination').textContent = order.shippingAddressText || 'Địa chỉ nhận';

    modal.classList.add('active');

    // Initialize or update map
    setTimeout(() => {
        initTrackingMap(order);
        updateTrackingProgress(order);

        // Start real-time updates
        if (trackingInterval) clearInterval(trackingInterval);
        trackingInterval = setInterval(() => updateTrackingProgress(order), 5000);
    }, 300);
}

function closeTrackingModal() {
    const modal = document.getElementById('tracking-modal');
    if (modal) modal.classList.remove('active');

    if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
    }
    currentTrackingOrder = null;
}

function initTrackingMap(order) {
    const container = document.getElementById('tracking-map');
    if (!container) return;

    // Default coordinates (warehouse)
    const originLat = order.tracking?.originLat || 10.8589;
    const originLng = order.tracking?.originLng || 106.7839;
    const destLat = order.tracking?.destLat || originLat + 0.05;
    const destLng = order.tracking?.destLng || originLng + 0.05;
    const currentLat = order.tracking?.currentLat || originLat;
    const currentLng = order.tracking?.currentLng || originLng;

    if (!trackingMap) {
        trackingMap = L.map('tracking-map').setView([currentLat, currentLng], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(trackingMap);
    } else {
        trackingMap.setView([currentLat, currentLng], 12);
    }

    // Clear existing markers
    trackingMap.eachLayer(layer => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) {
            trackingMap.removeLayer(layer);
        }
    });

    // Add origin marker (warehouse)
    const warehouseIcon = L.divIcon({
        html: '<span class="material-symbols-outlined" style="color: #22c55e; font-size: 32px;">warehouse</span>',
        iconSize: [32, 32],
        className: 'custom-marker'
    });
    L.marker([originLat, originLng], { icon: warehouseIcon }).addTo(trackingMap)
        .bindPopup('Kho hàng');

    // Add destination marker
    const destIcon = L.divIcon({
        html: '<span class="material-symbols-outlined" style="color: #dc2626; font-size: 32px;">home</span>',
        iconSize: [32, 32],
        className: 'custom-marker'
    });
    L.marker([destLat, destLng], { icon: destIcon }).addTo(trackingMap)
        .bindPopup('Điểm giao hàng');

    // Add vehicle marker
    const vehicleIcon = L.divIcon({
        html: '<span class="material-symbols-outlined" style="color: #2563eb; font-size: 36px;">local_shipping</span>',
        iconSize: [36, 36],
        className: 'custom-marker'
    });
    trackingMarker = L.marker([currentLat, currentLng], { icon: vehicleIcon }).addTo(trackingMap)
        .bindPopup('Xe giao hàng');

    // Draw route using OSRM API for road-based routing
    drawOSRMRoute(originLat, originLng, destLat, destLng);

    // Fit bounds to show all markers
    const bounds = L.latLngBounds([[originLat, originLng], [destLat, destLng]]);
    trackingMap.fitBounds(bounds, { padding: [50, 50] });
}

// OSRM Road-Based Routing
async function drawOSRMRoute(lat1, lng1, lat2, lng2) {
    try {
        // OSRM expects coordinates as lng,lat
        const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?geometries=geojson&overview=full`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('OSRM API request failed');
        }

        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const coordinates = route.geometry.coordinates;

            // Convert [lng, lat] to [lat, lng] for Leaflet
            const latLngs = coordinates.map(coord => [coord[1], coord[0]]);

            // Draw the road route
            const routeLine = L.polyline(latLngs, {
                color: '#22c55e',
                weight: 4,
                opacity: 0.8
            }).addTo(trackingMap);

            // Store route for vehicle animation
            window.currentRoute = latLngs;
            window.routeDistance = route.distance; // in meters
            window.routeDuration = route.duration; // in seconds

            console.log(`[OSRM] Route loaded: ${(route.distance / 1000).toFixed(1)} km, ${Math.round(route.duration / 60)} mins`);
        } else {
            // Fallback to straight line if no route found
            drawStraightLine(lat1, lng1, lat2, lng2);
        }
    } catch (error) {
        console.error('Error fetching OSRM route:', error);
        // Fallback to straight line
        drawStraightLine(lat1, lng1, lat2, lng2);
    }
}

function drawStraightLine(lat1, lng1, lat2, lng2) {
    L.polyline([[lat1, lng1], [lat2, lng2]], {
        color: '#22c55e',
        weight: 3,
        dashArray: '10, 10',
        opacity: 0.7
    }).addTo(trackingMap);
}

async function updateTrackingProgress(order) {
    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_BASE_URL}/orders/${order.id}/tracking`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const tracking = await response.json();

            // Update progress bar
            const progress = tracking.progressPercent || 0;
            document.getElementById('tracking-progress-bar').style.width = `${progress}%`;
            document.getElementById('tracking-progress-percent').textContent = `${progress.toFixed(0)}%`;
            document.getElementById('tracking-eta').textContent = `Dự kiến: ${tracking.estimatedTimeRemaining || '--'}`;

            // Update marker position
            if (trackingMarker && tracking.currentLat && tracking.currentLng) {
                trackingMarker.setLatLng([tracking.currentLat, tracking.currentLng]);
            }

            // If delivered, close tracking
            if (progress >= 100) {
                showToast('Thông báo', 'Đơn hàng đã đến nơi!', 'success');
            }
        }
    } catch (error) {
        console.error('Error updating tracking:', error);
    }
}

async function confirmOrderReceived() {
    if (!currentTrackingOrder) return;

    const token = localStorage.getItem('authToken');
    const btn = document.getElementById('confirm-received-btn');

    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined rotating">sync</span> Đang xử lý...';

    try {
        const response = await fetch(`${API_BASE_URL}/orders/${currentTrackingOrder.id}/confirm-delivery`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            showToast('Thành công', 'Đã xác nhận nhận hàng!', 'success');
            closeTrackingModal();
            await loadOrders();
            await loadUserBalance();
            await loadUserInventory();
        } else {
            const error = await response.json();
            showToast('Lỗi', error.message || 'Không thể xác nhận', 'error');
        }
    } catch (error) {
        console.error('Error confirming delivery:', error);
        showToast('Lỗi', 'Không thể xác nhận', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined icon-sm">check_circle</span> Đã nhận hàng';
    }
}

// Update checkout button in cart
async function checkoutCart() {
    if (!cartItems || cartItems.length === 0) {
        showToast('Lỗi', 'Giỏ hàng trống', 'error');
        return;
    }

    // Open checkout modal instead of direct purchase
    openCheckoutModal();
}

// Listen for self purchase price changes
document.addEventListener('DOMContentLoaded', () => {
    const selfPriceInput = document.getElementById('self-purchase-price');
    if (selfPriceInput) {
        selfPriceInput.addEventListener('input', updateCheckoutSummary);
    }
});