// Cooperative Page JavaScript
// API_BASE_URL is already defined in config.js

// State
let currentCooperative = null;
let cooperatives = [];
let userBalance = 0;
let shopItems = [];
let userAddresses = [];
let currentTab = 'overview';

// ==================== Initialization ====================

document.addEventListener('DOMContentLoaded', async () => {
    await loadUserData();
    await loadCooperatives();
    await loadUserAssets();
    await loadUserAddresses();
});

// Store user info globally for forms
let currentUserInfo = null;

async function loadUserData() {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/user/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const user = await response.json();
            currentUserInfo = user; // Store for later use
            userBalance = user.balance || 0;

            const userBalanceEl = document.getElementById('user-balance');
            if (userBalanceEl) userBalanceEl.textContent = formatCurrency(userBalance);

            const personalBalanceEl = document.getElementById('personal-balance');
            if (personalBalanceEl) personalBalanceEl.textContent = formatCurrency(userBalance);

            // Pre-fill registration form
            const regLeaderName = document.getElementById('reg-leader-name');
            if (regLeaderName) regLeaderName.value = user.fullName || '';

            const regPhone = document.getElementById('reg-phone');
            if (regPhone) regPhone.value = user.phone || '';

            const regAddress = document.getElementById('reg-address');
            if (regAddress) regAddress.value = user.defaultAddress || '';

            // Pre-fill dissolution form
            const dissolutionPhone = document.getElementById('dissolution-phone');
            if (dissolutionPhone) dissolutionPhone.value = user.phone || '';

            const dissolutionEmail = document.getElementById('dissolution-email');
            if (dissolutionEmail) dissolutionEmail.value = user.email || '';
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

async function loadCooperatives() {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/cooperatives`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            cooperatives = await response.json();
            console.log('Cooperatives loaded:', cooperatives);

            // Filter out any null/undefined entries if any
            cooperatives = cooperatives.filter(c => c !== null);

            if (cooperatives.length > 0) {
                // User is member of at least one cooperative
                currentCooperative = cooperatives[0];
                if (currentCooperative) {
                    showCooperativeDashboard();
                } else {
                    console.warn('Cooperative data is null/undefined');
                    showNoCooperativeState();
                }
            } else {
                // User is not a member of any cooperative
                showNoCooperativeState();
            }
        } else {
            console.warn('Failed to load cooperatives, status:', response.status);
            showNoCooperativeState();
        }
    } catch (error) {
        console.error('Error loading cooperatives:', error);
        alert('Lỗi khi tải dữ liệu Hợp tác xã: ' + error.message);
        showNoCooperativeState();
    }
}

// Load user balance from the same endpoint as shop.js
async function loadUserAssets() {
    try {
        const userEmail = localStorage.getItem('userEmail');
        if (!userEmail) return 0;

        const response = await fetch(`${API_BASE_URL}/user/balance?email=${encodeURIComponent(userEmail)}`);

        if (response.ok) {
            const data = await response.json();
            const balance = data.balance || 0;

            // Update the header balance display
            const userBalanceEl = document.getElementById('user-balance');
            if (userBalanceEl) {
                userBalanceEl.textContent = formatCurrency(balance);
            }

            // Update personal balance display
            const personalBalance = document.getElementById('personal-balance');
            if (personalBalance) {
                personalBalance.textContent = formatCurrency(balance);
            }

            // Store globally
            userBalance = balance;

            return balance;
        }
    } catch (error) {
        console.error('Error loading balance:', error);
    }
    return 0;
}

// Load user addresses for group buy (placeholder - API not implemented)
async function loadUserAddresses() {
    // This endpoint doesn't exist yet, just initialize empty array
    userAddresses = [];
}

// ==================== UI State ====================

function showNoCooperativeState() {
    const noCoop = document.getElementById('no-coop-container');
    const dashboard = document.getElementById('coop-dashboard');

    if (noCoop) noCoop.style.display = 'flex';
    if (dashboard) dashboard.style.display = 'none';

    // Animate
    if (typeof gsap !== 'undefined') {
        gsap.from('#no-coop-container', {
            opacity: 0,
            y: 30,
            duration: 0.6,
            ease: 'power2.out',
            clearProps: 'all' // Clear props after animation to prevent conflicts
        });
    }
}

function showCooperativeDashboard() {
    const noCoop = document.getElementById('no-coop-container');
    const dashboard = document.getElementById('coop-dashboard');

    if (noCoop) noCoop.style.display = 'none';
    if (dashboard) dashboard.style.display = 'block';

    try {
        updateDashboard();
        loadGroupBuyCampaigns();
        loadMembers();
        loadTransactions();

        // Update leader-only visibility (dissolution tab, etc.)
        if (typeof updateLeaderOnlyVisibility === 'function') {
            updateLeaderOnlyVisibility();
        }

        // Animate
        if (typeof gsap !== 'undefined') {
            gsap.from('#coop-dashboard', {
                opacity: 0,
                y: 30,
                duration: 0.6,
                ease: 'power2.out',
                clearProps: 'all'
            });
        }
    } catch (e) {
        console.error('Error rendering dashboard:', e);
        alert('Lỗi hiển thị dashboard: ' + e.message);
    }
}

function updateDashboard() {
    if (!currentCooperative) return;

    try {
        const setMap = {
            'coop-name': currentCooperative.name,
            'coop-code': currentCooperative.code,
            'coop-invite-code': currentCooperative.inviteCode || '---',
            'members-invite-code': currentCooperative.inviteCode || '---'
        };

        for (const [id, value] of Object.entries(setMap)) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }

        const balanceEl = document.getElementById('coop-balance');
        if (balanceEl && typeof formatCurrency === 'function') {
            balanceEl.textContent = formatCurrency(currentCooperative.balance);
        }

        // KPIs
        const kpiMembers = document.getElementById('kpi-members');
        if (kpiMembers) kpiMembers.textContent = currentCooperative.memberCount || 0;

        const kpiBalance = document.getElementById('kpi-balance');
        if (kpiBalance && typeof formatCurrency === 'function') {
            kpiBalance.textContent = formatCurrency(currentCooperative.balance);
        }

        // Show/hide leader-only buttons
        const isLeader = currentCooperative.userRole === 'LEADER';
        document.querySelectorAll('#create-buy-btn, #create-sell-btn').forEach(btn => {
            btn.style.display = isLeader ? 'inline-flex' : 'none';
        });
    } catch (e) {
        console.error('Error in updateDashboard:', e);
        throw e; // Re-throw to be caught in showCooperativeDashboard
    }
}

// ==================== Tabs ====================

function switchTab(tab) {
    currentTab = tab;

    // Update tab buttons
    document.querySelectorAll('.coop-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });

    // Show/hide tab contents with animation
    document.querySelectorAll('.tab-content').forEach(content => {
        const isActive = content.id === `tab-${tab}`;

        if (isActive) {
            content.style.display = 'block';
            if (typeof gsap !== 'undefined') {
                gsap.fromTo(content,
                    { opacity: 0, y: 20 },
                    {
                        opacity: 1,
                        y: 0,
                        duration: 0.4,
                        ease: 'power2.out',
                        clearProps: 'all' // Important!
                    }
                );
            }
        } else {
            content.style.display = 'none';
        }
    });
}

// ==================== Registration ====================

function openRegisterModal() {
    document.getElementById('register-modal').classList.add('active');
    gsap.from('.register-modal-content', {
        scale: 0.9,
        opacity: 0,
        duration: 0.3,
        ease: 'back.out(1.5)'
    });
}

function closeRegisterModal() {
    document.getElementById('register-modal').classList.remove('active');
}

async function submitRegistration() {
    const name = document.getElementById('reg-coop-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const maxMembers = parseInt(document.getElementById('reg-max-members').value) || 20;
    const address = document.getElementById('reg-address').value.trim();
    const description = document.getElementById('reg-description').value.trim();

    if (!name) {
        showToast('Lỗi', 'Vui lòng nhập tên hợp tác xã', 'error');
        return;
    }

    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_BASE_URL}/cooperatives/register`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, phone, maxMembers, address, description })
        });

        if (response.ok) {
            closeRegisterModal();
            showToast('Thành công', 'Đơn đăng ký đã được gửi. Vui lòng chờ Admin duyệt.', 'success');

            // Show pending state
            document.querySelector('.no-coop-content h2').textContent = 'Đang chờ duyệt';
            document.querySelector('.no-coop-content > p').textContent =
                `Đơn đăng ký "${name}" đã được gửi. Admin sẽ xét duyệt sớm nhất có thể.`;
            document.querySelector('.no-coop-actions').style.display = 'none';
        } else {
            const error = await response.json();
            showToast('Lỗi', error.message || 'Không thể gửi đăng ký', 'error');
        }
    } catch (error) {
        console.error('Error submitting registration:', error);
        showToast('Lỗi', 'Không thể gửi đăng ký', 'error');
    }
}

// ==================== Join by Invite Code ====================

async function joinByInviteCode() {
    const code = document.getElementById('invite-code-input').value.trim().toUpperCase();

    if (!code || code.length !== 6) {
        showToast('Lỗi', 'Mã mời phải có 6 ký tự', 'error');
        return;
    }

    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_BASE_URL}/cooperatives/join`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inviteCode: code })
        });

        if (response.ok) {
            const cooperative = await response.json();
            currentCooperative = cooperative;
            cooperatives = [cooperative];

            showToast('Thành công', `Đã tham gia ${cooperative.name}!`, 'success');
            showCooperativeDashboard();
        } else {
            const error = await response.json();
            showToast('Lỗi', error.message || 'Mã mời không hợp lệ', 'error');
        }
    } catch (error) {
        console.error('Error joining cooperative:', error);
        showToast('Lỗi', 'Không thể tham gia hợp tác xã', 'error');
    }
}

// ==================== Group Buy ====================

async function loadGroupBuyCampaigns() {
    if (!currentCooperative) return;

    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_BASE_URL}/cooperatives/${currentCooperative.id}/group-buys`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const campaigns = await response.json();
            renderGroupBuyCampaigns(campaigns);

            // Update KPI
            const openCount = campaigns.filter(c => c.status === 'OPEN').length;
            document.getElementById('kpi-buy-campaigns').textContent = openCount;
        }
    } catch (error) {
        console.error('Error loading group buy campaigns:', error);
    }
}

function renderGroupBuyCampaigns(campaigns) {
    const container = document.getElementById('group-buy-list');
    const overviewContainer = document.getElementById('overview-buy-campaigns');

    // Preserve admin sessions section if exists
    const adminSection = container.querySelector('.admin-sessions-section');
    const adminHtml = adminSection ? adminSection.outerHTML : '';

    if (campaigns.length === 0) {
        // Keep admin sessions, show empty state for cooperative campaigns only if no admin sessions
        if (adminBuySessions && adminBuySessions.length > 0) {
            container.innerHTML = adminHtml + `
                <div class="coop-campaigns-section">
                    <h4 class="section-title">
                        <span class="material-symbols-outlined">groups</span>
                        Đợt gom mua của HTX
                    </h4>
                    <div class="empty-state">
                        <span class="material-symbols-outlined">shopping_cart</span>
                        <p>Chưa có đợt gom mua nào từ HTX</p>
                        <small>Bấm "Tạo đợt gom mua" để bắt đầu</small>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined">shopping_cart</span>
                    <p>Chưa có đợt gom mua nào</p>
                    <small>Bấm "Tạo đợt gom mua" để bắt đầu</small>
                </div>
            `;
        }
        overviewContainer.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">inbox</span>
                <p>Chưa có đợt gom mua nào</p>
            </div>
        `;
        return;
    }

    // Full list - preserve admin section at top
    container.innerHTML = adminHtml + `
        <div class="coop-campaigns-section">
            <h4 class="section-title">
                <span class="material-symbols-outlined">groups</span>
                Đợt gom mua của HTX
            </h4>
            <div class="campaign-grid">
                ${campaigns.map(c => renderCampaignCard(c)).join('')}
            </div>
        </div>
    `;

    // Overview (only open, max 3)
    const openCampaigns = campaigns.filter(c => c.status === 'OPEN').slice(0, 3);
    if (openCampaigns.length > 0) {
        overviewContainer.innerHTML = openCampaigns.map(c => renderCampaignItem(c)).join('');
    }
}

function renderCampaignCard(campaign) {
    const hasImage = campaign.shopItemImage;
    const deadline = campaign.deadline ? new Date(campaign.deadline).toLocaleDateString('vi-VN') : 'Không giới hạn';

    return `
        <div class="campaign-card slide-up">
            <div class="campaign-card__image">
                ${hasImage ? `<img src="${campaign.shopItemImage}" alt="${campaign.shopItemName}">` :
            '<span class="material-symbols-outlined">inventory_2</span>'}
            </div>
            <div class="campaign-card__body">
                <h4 class="campaign-card__title">${campaign.title}</h4>
                <div class="campaign-card__meta">
                    <span class="meta-tag">
                        <span class="material-symbols-outlined">inventory_2</span>
                        ${campaign.shopItemName}
                    </span>
                    <span class="meta-tag">
                        <span class="material-symbols-outlined">event</span>
                        ${deadline}
                    </span>
                </div>
                <div class="campaign-item__progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${campaign.progressPercent}%"></div>
                    </div>
                    <div class="progress-text">
                        <span>${campaign.currentQuantity}/${campaign.targetQuantity} ${campaign.shopItemUnit || ''}</span>
                        <span>${campaign.progressPercent}%</span>
                    </div>
                </div>
                <div class="campaign-card__price">
                    <span class="price-wholesale">${formatCurrency(campaign.wholesalePrice)}</span>
                    <span class="price-retail">${formatCurrency(campaign.retailPrice)}</span>
                    <span class="discount-badge">-${campaign.discountPercent}%</span>
                </div>
                <div class="campaign-card__actions">
                    ${campaign.status === 'OPEN' ? `
                        <button class="btn btn--success" onclick="openContributeModal(${campaign.id})">
                            <span class="material-symbols-outlined icon-sm">add_shopping_cart</span>
                            Tham gia
                        </button>
                    ` : `
                        <button class="btn btn--outline" disabled>
                            ${getStatusText(campaign.status)}
                        </button>
                    `}
                </div>
            </div>
        </div>
    `;
}

function renderCampaignItem(campaign) {
    return `
        <div class="campaign-item" onclick="openContributeModal(${campaign.id})">
            <div class="campaign-item__header">
                <span class="campaign-item__title">${campaign.title}</span>
                <span class="campaign-item__status ${campaign.status.toLowerCase()}">${getStatusText(campaign.status)}</span>
            </div>
            <div class="campaign-item__progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${campaign.progressPercent}%"></div>
                </div>
                <div class="progress-text">
                    <span>${campaign.currentQuantity}/${campaign.targetQuantity}</span>
                    <span>${campaign.progressPercent}%</span>
                </div>
            </div>
            <div class="campaign-item__footer">
                <span class="campaign-item__price">
                    Giá sỉ: <span class="discount">${formatCurrency(campaign.wholesalePrice)}</span>
                </span>
            </div>
        </div>
    `;
}

function getStatusText(status) {
    const map = {
        'OPEN': 'Đang mở',
        'COMPLETED': 'Đạt mục tiêu',
        'ORDERED': 'Đã đặt hàng',
        'CANCELLED': 'Đã hủy',
        'EXPIRED': 'Hết hạn'
    };
    return map[status] || status;
}

// Create Group Buy Modal
function populateShopItemSelect() {
    const select = document.getElementById('buy-shop-item');
    select.innerHTML = '<option value="">-- Chọn sản phẩm --</option>' +
        shopItems.map(item => `<option value="${item.id}" data-price="${item.price}" data-image="${item.imageUrl || ''}">${item.name} - ${formatCurrency(item.price)}</option>`).join('');

    select.addEventListener('change', updateBuyPreview);
}

function updateBuyPreview() {
    const select = document.getElementById('buy-shop-item');
    const option = select.selectedOptions[0];
    const preview = document.getElementById('buy-preview');

    if (!option.value) {
        preview.style.display = 'none';
        return;
    }

    const item = shopItems.find(i => i.id == option.value);
    if (!item) return;

    document.getElementById('preview-item-name').textContent = item.name;
    document.getElementById('preview-retail-price').textContent = formatCurrency(item.price);

    const wholesaleInput = document.getElementById('buy-wholesale-price');
    if (wholesaleInput.value) {
        const discount = Math.round((1 - wholesaleInput.value / item.price) * 100);
        document.getElementById('preview-discount').textContent = discount + '%';
    }

    if (item.imageUrl) {
        document.getElementById('preview-item-image').src = item.imageUrl;
    }

    preview.style.display = 'block';
}

function openCreateBuyModal() {
    document.getElementById('create-buy-modal').classList.add('active');
    gsap.from('.modal__content', {
        scale: 0.9,
        opacity: 0,
        duration: 0.3,
        ease: 'back.out(1.5)'
    });
}

function closeCreateBuyModal() {
    document.getElementById('create-buy-modal').classList.remove('active');
}

async function createGroupBuy() {
    const shopItemId = document.getElementById('buy-shop-item').value;
    const title = document.getElementById('buy-title').value.trim();
    const targetQuantity = parseInt(document.getElementById('buy-target').value);
    const wholesalePrice = parseFloat(document.getElementById('buy-wholesale-price').value);
    const deadlineInput = document.getElementById('buy-deadline').value;

    if (!shopItemId || !title || !targetQuantity || !wholesalePrice) {
        showToast('Lỗi', 'Vui lòng điền đầy đủ thông tin', 'error');
        return;
    }

    const token = localStorage.getItem('authToken');
    const deadline = deadlineInput ? new Date(deadlineInput).toISOString() : null;

    try {
        const response = await fetch(`${API_BASE_URL}/cooperatives/${currentCooperative.id}/group-buys`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ shopItemId, title, targetQuantity, wholesalePrice, deadline })
        });

        if (response.ok) {
            closeCreateBuyModal();
            showToast('Thành công', 'Đã tạo đợt gom mua', 'success');
            loadGroupBuyCampaigns();

            // Reset form
            document.getElementById('buy-shop-item').value = '';
            document.getElementById('buy-title').value = '';
            document.getElementById('buy-target').value = '';
            document.getElementById('buy-wholesale-price').value = '';
            document.getElementById('buy-deadline').value = '';
            document.getElementById('buy-preview').style.display = 'none';
        } else {
            const error = await response.json();
            showToast('Lỗi', error.message || 'Không thể tạo đợt gom mua', 'error');
        }
    } catch (error) {
        console.error('Error creating group buy:', error);
        showToast('Lỗi', 'Không thể tạo đợt gom mua', 'error');
    }
}

// Contribute Modal
let currentCampaignId = null;

function openContributeModal(campaignId) {
    currentCampaignId = campaignId;
    document.getElementById('contribute-modal').classList.add('active');

    // Load campaign info
    // For simplicity, we'll just show basic info
    document.getElementById('contribute-info').innerHTML = `
        <p>Đang tải thông tin đợt gom...</p>
    `;

    gsap.from('.modal__content', {
        scale: 0.9,
        opacity: 0,
        duration: 0.3,
        ease: 'back.out(1.5)'
    });
}

function closeContributeModal() {
    document.getElementById('contribute-modal').classList.remove('active');
    currentCampaignId = null;
}

function populateAddressSelect() {
    const select = document.getElementById('contribute-address');
    select.innerHTML = '<option value="">-- Chọn địa chỉ --</option>' +
        userAddresses.map(addr => `<option value="${addr.id}">${addr.fullAddress}</option>`).join('');
}

async function submitContribution() {
    if (!currentCampaignId) return;

    const quantity = parseInt(document.getElementById('contribute-quantity').value);
    const shippingAddressId = document.getElementById('contribute-address').value || null;

    if (!quantity || quantity < 1) {
        showToast('Lỗi', 'Vui lòng nhập số lượng hợp lệ', 'error');
        return;
    }

    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_BASE_URL}/cooperatives/group-buys/${currentCampaignId}/contribute`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ quantity, shippingAddressId })
        });

        if (response.ok) {
            closeContributeModal();
            showToast('Thành công', 'Đã tham gia gom mua', 'success');
            loadGroupBuyCampaigns();
        } else {
            const error = await response.json();
            showToast('Lỗi', error.message || 'Không thể tham gia', 'error');
        }
    } catch (error) {
        console.error('Error contributing:', error);
        showToast('Lỗi', 'Không thể tham gia', 'error');
    }
}

// ==================== Members ====================

async function loadMembers() {
    if (!currentCooperative) return;

    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_BASE_URL}/cooperatives/${currentCooperative.id}/members`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const members = await response.json();
            renderMembers(members);
        }
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

function renderMembers(members) {
    const container = document.getElementById('members-list');

    container.innerHTML = members.map(m => `
        <div class="member-item slide-up">
            <div class="member-avatar" style="${m.avatarUrl ? `background-image: url('${m.avatarUrl}'); background-size: cover; background-position: center; color: transparent;` : ''}">
                ${m.avatarUrl ? '' : getInitials(m.userName)}
            </div>
            <div class="member-info">
                <div class="member-name">
                    ${m.userName}
                    <span class="member-role ${m.role.toLowerCase()}">${m.role === 'LEADER' ? 'Trưởng nhóm' : 'Thành viên'}</span>
                </div>
                <div class="member-contact">${m.userEmail} • ${m.userPhone || 'N/A'}</div>
            </div>
            <div class="member-contribution">
                <div class="member-contribution__label">Đóng góp</div>
                <div class="member-contribution__value">${formatCurrency(m.contribution)}</div>
            </div>
        </div>
    `).join('');
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

// ==================== Fund ====================

async function loadTransactions() {
    if (!currentCooperative) return;

    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_BASE_URL}/cooperatives/${currentCooperative.id}/transactions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const transactions = await response.json();
            renderTransactions(transactions);
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

function renderTransactions(transactions) {
    const container = document.getElementById('fund-transactions');
    const overviewContainer = document.getElementById('overview-transactions');

    if (transactions.length === 0) {
        const empty = `
            <div class="empty-state">
                <span class="material-symbols-outlined">receipt_long</span>
                <p>Chưa có giao dịch nào</p>
            </div>
        `;
        container.innerHTML = empty;
        overviewContainer.innerHTML = empty;
        return;
    }

    const renderItem = (tx) => `
        <div class="transaction-item">
            <div class="transaction-icon ${tx.type.toLowerCase()}">
                <span class="material-symbols-outlined">
                    ${tx.type === 'DEPOSIT' ? 'add' : tx.type === 'PURCHASE' ? 'shopping_cart' : 'swap_horiz'}
                </span>
            </div>
            <div class="transaction-info">
                <div class="transaction-desc">${tx.description}</div>
                <div class="transaction-meta">${tx.memberName} • ${formatDate(tx.createdAt)}</div>
            </div>
            <div class="transaction-amount ${tx.type === 'DEPOSIT' || tx.type === 'REVENUE' ? 'positive' : 'negative'}">
                ${tx.type === 'DEPOSIT' || tx.type === 'REVENUE' ? '+' : '-'}${formatCurrency(tx.amount)}
            </div>
        </div>
    `;

    container.innerHTML = transactions.map(renderItem).join('');
    overviewContainer.innerHTML = transactions.slice(0, 5).map(renderItem).join('');
}

async function depositToFund() {
    const amount = parseFloat(document.getElementById('deposit-amount').value);
    const description = document.getElementById('deposit-note').value.trim();

    if (!amount || amount < 10000) {
        showToast('Lỗi', 'Số tiền tối thiểu là 10,000 VNĐ', 'error');
        return;
    }

    if (amount > userBalance) {
        showToast('Lỗi', 'Số dư không đủ', 'error');
        return;
    }

    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_BASE_URL}/cooperatives/${currentCooperative.id}/deposit`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount, description })
        });

        if (response.ok) {
            showToast('Thành công', 'Đã nạp tiền vào quỹ', 'success');

            // Update balances
            userBalance -= amount;
            currentCooperative.balance = (parseFloat(currentCooperative.balance) || 0) + amount;

            document.getElementById('personal-balance').textContent = formatCurrency(userBalance);
            document.getElementById('user-balance').textContent = formatCurrency(userBalance);
            document.getElementById('coop-balance').textContent = formatCurrency(currentCooperative.balance);
            document.getElementById('kpi-balance').textContent = formatCurrency(currentCooperative.balance);

            // Clear form
            document.getElementById('deposit-amount').value = '';
            document.getElementById('deposit-note').value = '';

            // Reload transactions
            loadTransactions();
        } else {
            const error = await response.json();
            showToast('Lỗi', error.message || 'Không thể nạp tiền', 'error');
        }
    } catch (error) {
        console.error('Error depositing:', error);
        showToast('Lỗi', 'Không thể nạp tiền', 'error');
    }
}

// ==================== Utilities ====================

function copyInviteCode() {
    const code = currentCooperative?.inviteCode;
    if (!code) {
        showToast('Lỗi', 'Chưa có mã mời', 'error');
        return;
    }

    navigator.clipboard.writeText(code).then(() => {
        showToast('Đã sao chép', `Mã mời: ${code}`, 'success');
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount || 0) + ' VNĐ';
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;

    const icons = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };

    toast.innerHTML = `
        <span class="material-symbols-outlined toast__icon">${icons[type]}</span>
        <div class="toast__content">
            <p class="toast__title">${title}</p>
            <p class="toast__message">${message}</p>
        </div>
        <button class="toast__close" onclick="this.parentElement.remove()">
            <span class="material-symbols-outlined">close</span>
        </button>
    `;

    container.appendChild(toast);

    gsap.from(toast, {
        x: 100,
        opacity: 0,
        duration: 0.4,
        ease: 'power2.out'
    });

    setTimeout(() => {
        gsap.to(toast, {
            x: 100,
            opacity: 0,
            duration: 0.3,
            onComplete: () => toast.remove()
        });
    }, 4000);
}

// ==================== Group Sell (HTX Leader creates) ====================

let userCrops = []; // User's harvested crops for selling

async function loadUserCrops() {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
        // Load crop definitions for selection
        const response = await fetch(`${API_BASE_URL}/crop-definitions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            userCrops = await response.json();
            populateSellCropSelect();
        }
    } catch (error) {
        console.error('Error loading crops:', error);
    }
}

function populateSellCropSelect() {
    const select = document.getElementById('sell-crop-select');
    if (!select) return;

    select.innerHTML = '<option value="">-- Chọn nông sản --</option>' +
        userCrops.map(crop => `<option value="${crop.id}" data-price="${crop.marketPricePerKg || 0}">${crop.name} - Giá TT: ${formatCurrency(crop.marketPricePerKg || 0)}/kg</option>`).join('');
}

function openCreateSellModal() {
    // Load crops first
    loadUserCrops();

    const modal = document.getElementById('create-sell-modal');
    if (modal) {
        modal.classList.add('active');
        gsap.from('.modal__content', {
            scale: 0.9,
            opacity: 0,
            duration: 0.3,
            ease: 'back.out(1.5)'
        });
    }
}

function closeCreateSellModal() {
    const modal = document.getElementById('create-sell-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function updateSellPreview() {
    const select = document.getElementById('sell-crop-select');
    const option = select.options[select.selectedIndex];
    const preview = document.getElementById('sell-preview');

    if (!option.value) {
        if (preview) preview.style.display = 'none';
        return;
    }

    const marketPrice = parseFloat(option.dataset.price) || 0;
    document.getElementById('sell-market-price').textContent = formatCurrency(marketPrice);

    if (preview) preview.style.display = 'block';
}

async function createGroupSell() {
    const select = document.getElementById('sell-crop-select');
    const cropId = select.value;
    const cropName = select.options[select.selectedIndex]?.text.split(' - ')[0] || '';
    const title = document.getElementById('sell-title').value.trim();
    const targetQuantity = parseFloat(document.getElementById('sell-target-qty').value);
    const minPrice = parseFloat(document.getElementById('sell-min-price').value);
    const unit = document.getElementById('sell-unit').value || 'kg';
    const deadlineInput = document.getElementById('sell-deadline').value;
    const description = document.getElementById('sell-description')?.value.trim() || '';

    if (!cropId || !title || !targetQuantity || !minPrice) {
        showToast('Lỗi', 'Vui lòng điền đầy đủ thông tin bắt buộc', 'error');
        return;
    }

    const token = localStorage.getItem('authToken');
    const deadline = deadlineInput ? new Date(deadlineInput).toISOString() : null;

    try {
        const response = await fetch(`${API_BASE_URL}/cooperatives/${currentCooperative.id}/group-sells`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cropDefinitionId: parseInt(cropId),
                productName: cropName,
                title,
                targetQuantity,
                minPrice,
                unit,
                deadline,
                description
            })
        });

        if (response.ok) {
            closeCreateSellModal();
            showToast('Thành công', 'Đã tạo đợt gom bán', 'success');
            loadAdminSellSessions(); // Reload to show new campaign

            // Reset form
            select.value = '';
            document.getElementById('sell-title').value = '';
            document.getElementById('sell-target-qty').value = '';
            document.getElementById('sell-min-price').value = '';
            document.getElementById('sell-unit').value = 'kg';
            document.getElementById('sell-deadline').value = '';
            if (document.getElementById('sell-description')) {
                document.getElementById('sell-description').value = '';
            }
            document.getElementById('sell-preview').style.display = 'none';
        } else {
            const error = await response.json();
            showToast('Lỗi', error.message || 'Không thể tạo đợt gom bán', 'error');
        }
    } catch (error) {
        console.error('Error creating group sell:', error);
        showToast('Lỗi', 'Không thể tạo đợt gom bán', 'error');
    }
}

// ==================== Dissolution Request ====================

async function loadDissolutionStatus() {
    if (!currentCooperative) return;

    const token = localStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_BASE_URL}/cooperatives/${currentCooperative.id}/dissolution-status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            const statusDiv = document.getElementById('dissolution-status');
            const formDiv = document.getElementById('dissolution-form');

            if (data.hasPendingRequest) {
                if (statusDiv) statusDiv.style.display = 'block';
                if (formDiv) formDiv.style.display = 'none';

                const statusText = document.getElementById('dissolution-status-text');
                if (statusText) {
                    statusText.textContent = `Gửi ngày: ${new Date(data.createdAt).toLocaleDateString('vi-VN')}. Lý do: ${data.reason}`;
                }
            } else {
                if (statusDiv) statusDiv.style.display = 'none';
                if (formDiv) formDiv.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error loading dissolution status:', error);
    }
}

async function submitDissolutionRequest() {
    if (!currentCooperative) return;

    const reason = document.getElementById('dissolution-reason')?.value.trim();
    const phone = document.getElementById('dissolution-phone')?.value.trim();
    const email = document.getElementById('dissolution-email')?.value.trim();

    if (!reason) {
        showToast('Lỗi', 'Vui lòng nhập lý do giải thể', 'error');
        return;
    }

    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_BASE_URL}/cooperatives/${currentCooperative.id}/dissolution-request`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reason: reason,
                contactPhone: phone,
                contactEmail: email
            })
        });

        if (response.ok) {
            const data = await response.json();
            showToast('Thành công', data.message || 'Đã gửi yêu cầu giải thể', 'success');
            loadDissolutionStatus();
        } else {
            const error = await response.json();
            showToast('Lỗi', error.message || 'Không thể gửi yêu cầu', 'error');
        }
    } catch (error) {
        console.error('Error submitting dissolution request:', error);
        showToast('Lỗi', 'Không thể gửi yêu cầu giải thể', 'error');
    }
}

// ==================== Leader-Only Visibility ====================

function updateLeaderOnlyVisibility() {
    const isLeader = currentCooperative?.userRole === 'LEADER';

    document.querySelectorAll('.leader-only').forEach(el => {
        // Don't override tab content visibility (managed by switchTab)
        if (el.classList.contains('tab-content')) return;
        el.style.display = isLeader ? '' : 'none';
    });

    // Load dissolution status if leader
    if (isLeader) {
        loadDissolutionStatus();
    }
}

// ==================== History Tab ====================

async function loadHistory() {
    if (!currentCooperative) return;

    const container = document.getElementById('history-list');
    if (!container) return;

    const token = localStorage.getItem('authToken');

    try {
        // Load transactions as history for now
        const response = await fetch(`${API_BASE_URL}/cooperatives/${currentCooperative.id}/transactions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const transactions = await response.json();

            if (transactions.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="material-symbols-outlined">history</span>
                        <p>Chưa có lịch sử hoạt động</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = transactions.map(tx => `
                <div class="history-item">
                    <div class="history-item__icon ${tx.type === 'DEPOSIT' ? 'deposit' : 'expense'}">
                        <span class="material-symbols-outlined">
                            ${tx.type === 'DEPOSIT' ? 'add_circle' : 'remove_circle'}
                        </span>
                    </div>
                    <div class="history-item__content">
                        <div class="history-item__title">${tx.description}</div>
                        <div class="history-item__meta">${tx.memberName} • ${new Date(tx.createdAt).toLocaleDateString('vi-VN')}</div>
                    </div>
                    <div class="history-item__amount ${tx.type === 'DEPOSIT' ? 'positive' : 'negative'}">
                        ${tx.type === 'DEPOSIT' ? '+' : '-'}${formatCurrency(tx.amount)}
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// Update switchTab to load history when switching to history tab
const originalSwitchTab = switchTab;
switchTab = function (tab) {
    originalSwitchTab(tab);

    if (tab === 'history') {
        loadHistory();
    } else if (tab === 'dissolution') {
        loadDissolutionStatus();
    } else if (tab === 'inventory') {
        loadInventory();
    } else if (tab === 'distribution') {
        loadDistribution();
    } else if (tab === 'group-buy') {
        loadAdminBuySessions();
    } else if (tab === 'group-sell') {
        loadAdminSellSessions();
    }
};

// ==================== Admin Buy Sessions (Gom mua từ Admin) ====================

let adminBuySessions = [];

async function loadAdminBuySessions() {
    const token = localStorage.getItem('authToken');
    if (!token || !currentCooperative) {
        adminBuySessions = [];
        return;
    }

    try {
        // Use cooperative endpoint for regular users to view admin-created sessions
        const response = await fetch(`${API_BASE_URL}/cooperatives/trading/buy-sessions/open`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            adminBuySessions = await response.json();
            renderAdminBuySessions();
        } else {
            // Silently fail - admin sessions are optional for regular users
            console.log('Note: Could not load admin buy sessions, status:', response.status);
            adminBuySessions = [];
            renderAdminBuySessions();
        }
    } catch (error) {
        // Silently fail - admin sessions are optional for regular users
        console.log('Note: Admin buy sessions not available:', error.message);
        adminBuySessions = [];
        renderAdminBuySessions();
    }
}

function renderAdminBuySessions() {
    // This function now renders ONLY admin sessions in a dedicated container
    // It's called after renderGroupBuyCampaigns to avoid duplication
    const container = document.getElementById('group-buy-list');
    if (!container) return;

    // Find or create admin sessions container at the top
    let adminContainer = container.querySelector('.admin-sessions-section');
    
    if (adminBuySessions.length === 0) {
        // Remove admin section if no sessions
        if (adminContainer) adminContainer.remove();
        return;
    }

    const adminHtml = `
        <div class="admin-sessions-section">
            <h4 class="section-title">
                <span class="material-symbols-outlined">store</span>
                Phiên gom mua từ hệ thống
            </h4>
            <div class="campaign-grid">
                ${adminBuySessions.map(s => renderAdminBuyCard(s)).join('')}
            </div>
        </div>
    `;

    if (adminContainer) {
        // Update existing
        adminContainer.outerHTML = adminHtml;
    } else {
        // Insert at the beginning
        container.insertAdjacentHTML('afterbegin', adminHtml);
    }
}

function renderAdminBuyCard(session) {
    return `
        <div class="campaign-card admin-session slide-up">
            <div class="campaign-card__badge">Từ Admin</div>
            <div class="campaign-card__image">
                ${session.shopItemImage ? `<img src="${session.shopItemImage}" alt="">` : '<span class="material-symbols-outlined">storefront</span>'}
            </div>
            <div class="campaign-card__body">
                <h4 class="campaign-card__title">${session.title}</h4>
                <p class="campaign-card__product">${session.shopItemName || 'Sản phẩm'}</p>
                <div class="campaign-card__price">
                    <span class="price-wholesale">${formatCurrency(session.wholesalePrice)}</span>
                    <span class="price-retail">${formatCurrency(session.retailPrice)}</span>
                    <span class="discount-badge">-${session.discountPercent}%</span>
                </div>
                <div class="campaign-item__progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${session.progressPercent}%"></div>
                    </div>
                    <div class="progress-text">
                        <span>${session.currentQuantity}/${session.targetQuantity}</span>
                        <span>${session.progressPercent}%</span>
                    </div>
                </div>
                ${session.note ? `<p class="campaign-card__note">${session.note}</p>` : ''}
                <div class="campaign-card__actions">
                    <button class="btn btn--success" onclick="participateInAdminBuy(${session.id})">
                        <span class="material-symbols-outlined icon-sm">add_shopping_cart</span>
                        Tham gia
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function participateInAdminBuy(sessionId) {
    const quantity = prompt('Nhập số lượng muốn đặt:');
    if (!quantity || parseInt(quantity) < 1) return;

    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_BASE_URL}/cooperatives/group-buys/${sessionId}/contribute`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ quantity: parseInt(quantity) })
        });

        if (response.ok) {
            showToast('Thành công', 'Đã tham gia gom mua', 'success');
            loadAdminBuySessions();
            loadGroupBuyCampaigns();
        } else {
            const error = await response.json();
            showToast('Lỗi', error.message || 'Không thể tham gia', 'error');
        }
    } catch (error) {
        console.error('Error participating:', error);
        showToast('Lỗi', 'Không thể tham gia', 'error');
    }
}

// ==================== Admin Sell Sessions (Gom bán cho Admin) ====================

let adminSellSessions = [];

async function loadAdminSellSessions() {
    const token = localStorage.getItem('authToken');
    if (!token || !currentCooperative) {
        adminSellSessions = [];
        renderAdminSellSessions();
        return;
    }

    try {
        // Use cooperative endpoint for regular users to view admin-created sessions
        const response = await fetch(`${API_BASE_URL}/cooperatives/trading/sell-sessions/open`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            adminSellSessions = await response.json();
            renderAdminSellSessions();
        } else {
            // Silently fail - admin sessions are optional for regular users
            console.log('Note: Could not load admin sell sessions, status:', response.status);
            adminSellSessions = [];
            renderAdminSellSessions();
        }
    } catch (error) {
        // Silently fail - admin sessions are optional for regular users
        console.log('Note: Admin sell sessions not available:', error.message);
        adminSellSessions = [];
        renderAdminSellSessions();
    }
}

function renderAdminSellSessions() {
    const container = document.getElementById('group-sell-list');
    if (!container) return;

    if (adminSellSessions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">sell</span>
                <p>Chưa có phiên gom bán nào</p>
                <small>Admin sẽ tạo phiên khi cần thu mua nông sản</small>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="admin-sessions-section">
            <h4 class="section-title">
                <span class="material-symbols-outlined">agriculture</span>
                Admin đang thu mua
            </h4>
            <div class="campaign-grid">
                ${adminSellSessions.map(s => renderAdminSellCard(s)).join('')}
            </div>
        </div>
    `;
}

function renderAdminSellCard(session) {
    return `
        <div class="campaign-card admin-session sell-session slide-up">
            <div class="campaign-card__badge sell">Admin thu mua</div>
            <div class="campaign-card__image">
                <span class="material-symbols-outlined">grass</span>
            </div>
            <div class="campaign-card__body">
                <h4 class="campaign-card__title">${session.productName}</h4>
                <p class="campaign-card__product">${session.description || ''}</p>
                <div class="campaign-card__price sell">
                    <span class="price-buy">Giá thu: ${formatCurrency(session.minPrice)}/${session.unit}</span>
                    ${session.marketPrice ? `<span class="price-market">(Thị trường: ${formatCurrency(session.marketPrice)})</span>` : ''}
                </div>
                <div class="campaign-item__progress">
                    <div class="progress-bar sell">
                        <div class="progress-fill" style="width: ${session.progressPercent}%"></div>
                    </div>
                    <div class="progress-text">
                        <span>${session.currentQuantity}/${session.targetQuantity} ${session.unit}</span>
                        <span>${session.progressPercent}%</span>
                    </div>
                </div>
                <div class="campaign-card__actions">
                    <button class="btn btn--primary" onclick="contributeToSellSession(${session.id}, '${session.productName}', '${session.unit}')">
                        <span class="material-symbols-outlined icon-sm">add</span>
                        Góp sản phẩm
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function contributeToSellSession(sessionId, productName, unit) {
    const quantity = prompt(`Nhập số lượng ${productName} muốn góp (${unit}):`);
    if (!quantity || parseFloat(quantity) <= 0) return;

    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_BASE_URL}/cooperatives/group-sells/${sessionId}/contribute`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ quantity: parseFloat(quantity) })
        });

        if (response.ok) {
            showToast('Thành công', `Đã góp ${quantity} ${unit} ${productName}`, 'success');
            loadAdminSellSessions();
        } else {
            const error = await response.json();
            showToast('Lỗi', error.message || 'Không thể góp sản phẩm', 'error');
        }
    } catch (error) {
        console.error('Error contributing:', error);
        showToast('Lỗi', 'Không thể góp sản phẩm', 'error');
    }
}

// ==================== Inventory Tab (Kho HTX) ====================

let coopInventory = [];

async function loadInventory() {
    if (!currentCooperative) return;

    const token = localStorage.getItem('authToken');
    const container = document.getElementById('inventory-list');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE_URL}/cooperatives/${currentCooperative.id}/inventory`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            coopInventory = await response.json();
            renderInventory();
        } else {
            // API might not exist yet - silently show empty state
            coopInventory = [];
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined">inventory_2</span>
                    <p>Kho HTX chưa có sản phẩm</p>
                    <small>Sản phẩm sẽ xuất hiện sau khi hoàn thành gom mua/bán</small>
                </div>
            `;
        }
    } catch (error) {
        // Silently handle - inventory feature may not be implemented yet
        coopInventory = [];
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">inventory_2</span>
                <p>Kho HTX chưa có sản phẩm</p>
                <small>Sản phẩm sẽ xuất hiện sau khi hoàn thành gom mua/bán</small>
            </div>
        `;
    }
}

function renderInventory() {
    const container = document.getElementById('inventory-list');

    if (coopInventory.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">inventory_2</span>
                <p>Kho HTX chưa có sản phẩm</p>
            </div>
        `;
        return;
    }

    // Update summary
    const totalProducts = coopInventory.length;
    const totalValue = coopInventory.reduce((sum, item) => sum + (item.totalValue || 0), 0);
    document.getElementById('inv-total-products').textContent = totalProducts;
    document.getElementById('inv-total-value').textContent = formatCurrency(totalValue);

    container.innerHTML = coopInventory.map(item => `
        <div class="inventory-item slide-up">
            <div class="inventory-item__icon ${item.productType?.toLowerCase() || 'crop'}">
                <span class="material-symbols-outlined">
                    ${item.productType === 'SHOP_ITEM' ? 'inventory_2' : item.productType === 'ANIMAL' ? 'pets' : 'grass'}
                </span>
            </div>
            <div class="inventory-item__info">
                <h4>${item.productName}</h4>
                <p>Số lượng: ${item.quantity} ${item.unit}</p>
                <p>Người góp: ${item.contributorCount || 0} thành viên</p>
            </div>
            <div class="inventory-item__value">
                <span class="value">${formatCurrency(item.totalValue || 0)}</span>
                <span class="updated">Cập nhật: ${new Date(item.updatedAt).toLocaleDateString('vi-VN')}</span>
            </div>
        </div>
    `).join('');
}

// ==================== Distribution Tab (Phân chia) ====================

let contributionPieChart = null;
let earningsBarChart = null;

async function loadDistribution() {
    if (!currentCooperative) return;

    const token = localStorage.getItem('authToken');

    try {
        // Load contribution summary
        const response = await fetch(`${API_BASE_URL}/cooperatives/${currentCooperative.id}/members`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const members = await response.json();
            renderDistributionCharts(members);
            renderContributionTable(members);
        }
    } catch (error) {
        console.error('Error loading distribution:', error);
    }
}

function renderDistributionCharts(members) {
    const colors = [
        '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6',
        '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
    ];

    // Pie chart for contributions
    const pieCtx = document.getElementById('contributionPieChart')?.getContext('2d');
    if (pieCtx) {
        if (contributionPieChart) contributionPieChart.destroy();

        const contributions = members.map(m => m.contribution || 0);
        const labels = members.map(m => m.userName);

        contributionPieChart = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: contributions,
                    backgroundColor: colors.slice(0, members.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { boxWidth: 12, font: { size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percent = ((context.raw / total) * 100).toFixed(1);
                                return `${context.label}: ${formatCurrency(context.raw)} (${percent}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Bar chart for earnings (using contributions as proxy)
    const barCtx = document.getElementById('earningsBarChart')?.getContext('2d');
    if (barCtx) {
        if (earningsBarChart) earningsBarChart.destroy();

        earningsBarChart = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: members.map(m => m.userName),
                datasets: [{
                    label: 'Đóng góp (VNĐ)',
                    data: members.map(m => m.contribution || 0),
                    backgroundColor: colors.slice(0, members.length),
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => formatCurrency(ctx.raw)
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            callback: value => formatCurrency(value)
                        }
                    }
                }
            }
        });
    }
}

function renderContributionTable(members) {
    const tbody = document.getElementById('contribution-table-body');
    if (!tbody) return;

    const total = members.reduce((sum, m) => sum + (m.contribution || 0), 0);

    if (members.length === 0 || total === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Chưa có dữ liệu đóng góp</td></tr>';
        return;
    }

    tbody.innerHTML = members.map(m => {
        const percent = total > 0 ? ((m.contribution / total) * 100).toFixed(1) : 0;
        return `
            <tr>
                <td>${m.userName}</td>
                <td>${formatCurrency(m.contribution || 0)}</td>
                <td>${percent}%</td>
                <td>${formatCurrency(0)}</td>
                <td><span class="status-badge pending">Chưa nhận</span></td>
            </tr>
        `;
    }).join('');
}

// ==================== Claim Earnings ====================

async function claimEarnings() {
    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_BASE_URL}/cooperatives/earnings/claim`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const result = await response.json();
            showToast('Thành công', `Đã nhận ${formatCurrency(result.amount)} thu nhập`, 'success');
            loadDistribution();
            loadUserAssets();
        } else {
            const error = await response.json();
            showToast('Lỗi', error.message || 'Không thể nhận thu nhập', 'error');
        }
    } catch (error) {
        console.error('Error claiming earnings:', error);
        showToast('Lỗi', 'Không thể nhận thu nhập', 'error');
    }
}
