/* =====================================================
   AgriPlanner - Admin Dashboard JS
   ===================================================== */

// API_BASE_URL is already defined in config.js

// Activity log storage
let activityLog = JSON.parse(localStorage.getItem('adminActivityLog') || '[]');

document.addEventListener('DOMContentLoaded', () => {
    // Check auth
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    const role = localStorage.getItem('userRole');

    if (!token || role !== 'SYSTEM_ADMIN') {
        window.location.href = 'login.html';
        return;
    }

    // Update admin info
    const userName = localStorage.getItem('userName') || 'Admin';
    document.getElementById('admin-name').textContent = userName;
    const avatarUrl = localStorage.getItem('userAvatar');
    document.getElementById('admin-avatar').textContent = avatarUrl ? '' : userName.charAt(0).toUpperCase();
    if (avatarUrl) {
        document.getElementById('admin-avatar').style.backgroundImage = `url('${avatarUrl}')`;
        document.getElementById('admin-avatar').style.backgroundSize = 'cover';
        document.getElementById('admin-avatar').style.backgroundPosition = 'center';
    }

    // Initialize
    initNavigation();
    loadDashboard();
});

// ============ ANIMATION HELPERS ============
function animateContentTransition(callback) {
    const content = document.getElementById('main-content');
    gsap.to(content, {
        opacity: 0,
        y: 20,
        duration: 0.15,
        onComplete: () => {
            callback();
            gsap.fromTo(content,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
            );
        }
    });
}

function logActivity(action, entity, details) {
    const entry = {
        id: Date.now(),
        action,
        entity,
        details,
        user: localStorage.getItem('userName') || 'Admin',
        timestamp: new Date().toISOString()
    };
    activityLog.unshift(entry);
    if (activityLog.length > 100) activityLog = activityLog.slice(0, 100);
    localStorage.setItem('adminActivityLog', JSON.stringify(activityLog));
}

// ============ NAVIGATION ============
function initNavigation() {
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Allow navigation for real links (not just # or tabs)
            const href = item.getAttribute('href');
            if (href && href !== '#' && !href.startsWith('#')) {
                // Don't prevent default - let the browser navigate
                return;
            }

            e.preventDefault();
            const tab = item.dataset.tab;

            document.querySelectorAll('.sidebar-item').forEach(i => {
                i.classList.remove('active');
                i.classList.add('text-white/80');
            });
            item.classList.add('active');
            item.classList.remove('text-white/80');

            animateContentTransition(() => {
                switch (tab) {
                    case 'dashboard': loadDashboard(); break;
                    case 'users': loadUsers(); break;
                    case 'crops': loadCrops(); break;
                    case 'shop-items': loadShopItems(); break;
                    case 'animals': loadAnimals(); break;
                    case 'orders': loadOrders(); break;
                    case 'store-config': loadStoreConfig(); break;
                    case 'cooperatives': loadCooperatives(); break;
                    case 'group-buy':
                        loadCooperatives();
                        setTimeout(() => switchCooperativeTab('buy'), 500);
                        break;
                    case 'group-sell':
                        loadCooperatives();
                        setTimeout(() => switchCooperativeTab('sell'), 500);
                        break;
                    case 'community': loadCommunity(); break;
                    case 'price-analysis': loadPriceAnalysis(); break;
                    case 'recruitment': loadRecruitment(); break;
                    case 'tasks': loadTasks(); break;
                }
            });
        });
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });
}

// ============ DASHBOARD ============
async function loadDashboard() {
    document.getElementById('page-title').textContent = 'Tổng quan Hệ thống';

    const data = await fetchAllData();

    document.getElementById('main-content').innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                    <p class="text-sm text-gray-500 font-medium mb-1">Người dùng</p>
                    <h3 class="text-3xl font-bold text-gray-800">${data.users.length}</h3>
                </div>
                <div class="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500">
                    <span class="material-icons-round text-2xl">group</span>
                </div>
            </div>
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                    <p class="text-sm text-gray-500 font-medium mb-1">Cây trồng</p>
                    <h3 class="text-3xl font-bold text-gray-800">${data.crops.length}</h3>
                </div>
                <div class="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center text-green-500">
                    <span class="material-icons-round text-2xl">grass</span>
                </div>
            </div>
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                    <p class="text-sm text-gray-500 font-medium mb-1">Sản phẩm</p>
                    <h3 class="text-3xl font-bold text-gray-800">${data.items.length}</h3>
                </div>
                <div class="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center text-purple-500">
                    <span class="material-icons-round text-2xl">storefront</span>
                </div>
            </div>
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                    <p class="text-sm text-gray-500 font-medium mb-1">Vật nuôi</p>
                    <h3 class="text-3xl font-bold text-gray-800">${data.animals.length}</h3>
                </div>
                <div class="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center text-amber-500">
                    <span class="material-icons-round text-2xl">pets</span>
                </div>
            </div>
        </div>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h4 class="text-lg font-bold text-gray-800 mb-4">Cây trồng theo danh mục</h4>
                <div class="h-64"><canvas id="cropChart"></canvas></div>
            </div>
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h4 class="text-lg font-bold text-gray-800 mb-4">Sản phẩm theo danh mục</h4>
                <div class="h-64"><canvas id="itemChart"></canvas></div>
            </div>
        </div>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h4 class="text-lg font-bold text-gray-800 mb-4">Vật nuôi theo loại</h4>
                <div class="h-64"><canvas id="animalChart"></canvas></div>
            </div>
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h4 class="text-lg font-bold text-gray-800 mb-4">Người dùng theo vai trò</h4>
                <div class="h-64"><canvas id="userChart"></canvas></div>
            </div>
        </div>
    `;

    gsap.fromTo('#main-content > div', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 });

    // Render charts after DOM is ready
    setTimeout(() => renderCharts(data), 100);
}

async function fetchAllData() {
    try {
        const [users, crops, items, animals] = await Promise.all([
            fetchAPI(`${API_BASE_URL}/admin/users`),
            fetchAPI(`${API_BASE_URL}/admin/crops`),
            fetchAPI(`${API_BASE_URL}/admin/shop-items`),
            fetchAPI(`${API_BASE_URL}/admin/animals`)
        ]);
        return { users: users || [], crops: crops || [], items: items || [], animals: animals || [] };
    } catch (e) {
        console.error('Data fetch error:', e);
        return { users: [], crops: [], items: [], animals: [] };
    }
}

function renderCharts(data) {
    const chartColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

    // Crop by category - Pie chart
    const cropCategories = groupBy(data.crops, 'category');
    new Chart(document.getElementById('cropChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(cropCategories),
            datasets: [{
                data: Object.values(cropCategories).map(arr => arr.length),
                backgroundColor: chartColors
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });

    // Items by category - Bar chart
    const itemCategories = groupBy(data.items, 'category');
    new Chart(document.getElementById('itemChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(itemCategories),
            datasets: [{
                label: 'Số lượng',
                data: Object.values(itemCategories).map(arr => arr.length),
                backgroundColor: chartColors,
                borderRadius: 8
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    // Animals by category - Pie chart
    const animalCategories = groupBy(data.animals, 'category');
    new Chart(document.getElementById('animalChart'), {
        type: 'pie',
        data: {
            labels: Object.keys(animalCategories),
            datasets: [{
                data: Object.values(animalCategories).map(arr => arr.length),
                backgroundColor: chartColors
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });

    // Users by role - Bar chart
    const userRoles = groupBy(data.users, 'role');
    new Chart(document.getElementById('userChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(userRoles).map(r => getRoleLabel(r)),
            datasets: [{
                label: 'Số lượng',
                data: Object.values(userRoles).map(arr => arr.length),
                backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6'],
                borderRadius: 8
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }
    });
}

function groupBy(arr, key) {
    return arr.reduce((acc, item) => {
        const k = item[key] || 'Không xác định';
        acc[k] = acc[k] || [];
        acc[k].push(item);
        return acc;
    }, {});
}

// ============ USERS ============
async function loadUsers() {
    document.getElementById('page-title').textContent = 'Quản lý Người dùng';
    const users = await fetchAPI(`${API_BASE_URL}/admin/users`) || [];

    document.getElementById('main-content').innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <div class="relative w-72">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-gray-400">search</span>
                <input type="text" id="search-users" placeholder="Tìm kiếm..." class="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Người dùng</th>
                        <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Vai trò</th>
                        <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Trạng thái</th>
                        <th class="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Thao tác</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200" id="users-table-body"></tbody>
            </table>
        </div>
    `;

    renderUsersTable(users);
    document.getElementById('search-users').addEventListener('input', (e) => {
        const filtered = users.filter(u =>
            u.fullName?.toLowerCase().includes(e.target.value.toLowerCase()) ||
            u.email?.toLowerCase().includes(e.target.value.toLowerCase())
        );
        renderUsersTable(filtered);
    });
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = users.map(u => `
        <tr class="table-row hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center text-primary font-bold ${!u.avatarUrl ? 'bg-primary/10' : 'bg-gray-100'}" 
                        style="${u.avatarUrl ? `background-image: url('${u.avatarUrl}'); background-size: cover; background-position: center;` : ''}">
                        ${u.avatarUrl ? '' : (u.fullName || u.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p class="text-sm font-medium text-gray-900">${u.fullName || 'N/A'}</p>
                        <p class="text-sm text-gray-500">${u.email}</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="text-sm text-gray-700">${getRoleLabel(u.role)}</span>
            </td>
            <td class="px-6 py-4">
                <span class="px-3 py-1 text-xs font-semibold rounded-full ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}">
                    ${u.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
                </span>
            </td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2 action-btn">
                    <button onclick="toggleUserStatus(${u.id}, '${u.status}')" class="p-1.5 text-gray-400 hover:text-blue-500 rounded-md transition-colors" title="${u.status === 'active' ? 'Khóa' : 'Mở khóa'}">
                        <span class="material-icons-round text-lg">${u.status === 'active' ? 'lock' : 'lock_open'}</span>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function getRoleLabel(role) {
    const labels = { 'OWNER': 'Chủ trang trại', 'WORKER': 'Nhân công', 'SYSTEM_ADMIN': 'Quản trị viên' };
    return labels[role] || role;
}

async function toggleUserStatus(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'locked' : 'active';
    await fetchAPI(`${API_BASE_URL}/admin/users/${id}/status?status=${newStatus}`, 'PUT');
    loadUsers();
}

// ============ CROPS ============
let cropsData = [];

async function loadCrops() {
    document.getElementById('page-title').textContent = 'Quản lý Cây trồng';
    cropsData = await fetchAPI(`${API_BASE_URL}/admin/crops`) || [];

    document.getElementById('main-content').innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <div class="relative w-72">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-gray-400">search</span>
                <input type="text" id="search-crops" placeholder="Tìm kiếm..." class="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
            <div class="flex gap-3">
                <button onclick="exportCropsCSV()" class="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg transition-all font-medium">
                    <span class="material-icons-round text-lg">download</span> Xuất CSV
                </button>
                <button onclick="showCropModal()" class="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg shadow-md transition-all font-medium">
                    <span class="material-icons-round text-lg">add</span> Thêm mới
                </button>
            </div>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Tên cây trồng</th>
                        <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Danh mục</th>
                        <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Thời gian trưởng thành</th>
                        <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Mùa vụ</th>
                        <th class="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Thao tác</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200" id="crops-table-body"></tbody>
            </table>
        </div>
    `;

    renderCropsTable(cropsData);

    document.getElementById('search-crops').addEventListener('input', (e) => {
        const filtered = cropsData.filter(c =>
            c.name?.toLowerCase().includes(e.target.value.toLowerCase()) ||
            c.category?.toLowerCase().includes(e.target.value.toLowerCase())
        );
        renderCropsTable(filtered);
    });
}

function renderCropsTable(crops) {
    document.getElementById('crops-table-body').innerHTML = crops.map(c => `
        <tr class="table-row hover:bg-gray-50 transition-colors cursor-pointer" onclick="showCropDetail(${c.id})">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    ${c.imageUrl
            ? `<img src="${c.imageUrl}" alt="${c.name}" class="w-12 h-12 rounded-lg object-cover border border-gray-200" onerror="this.onerror=null;this.outerHTML='<div class=\\'w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center text-green-600\\'><span class=\\'material-icons-round\\'>grass</span></div>';">`
            : `<div class="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center text-green-600"><span class="material-icons-round">grass</span></div>`
        }
                    <p class="text-sm font-medium text-gray-900">${c.name}</p>
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-700">${c.category || '-'}</td>
            <td class="px-6 py-4 text-sm text-gray-700">${c.growthDurationDays || '-'} ngày</td>
            <td class="px-6 py-4 text-sm text-gray-700">${c.idealSeasons || '-'}</td>
            <td class="px-6 py-4 text-right" onclick="event.stopPropagation()">
                <div class="flex items-center justify-end gap-2 action-btn">
                    <button onclick="showCropDetail(${c.id})" class="p-1.5 text-gray-400 hover:text-primary rounded-md" title="Xem chi tiết"><span class="material-icons-round text-lg">visibility</span></button>
                    <button onclick="showCropModal(${c.id})" class="p-1.5 text-gray-400 hover:text-blue-500 rounded-md" title="Chỉnh sửa"><span class="material-icons-round text-lg">edit</span></button>
                    <button onclick="showDeleteModal('crop', ${c.id}, '${c.name}')" class="p-1.5 text-gray-400 hover:text-red-500 rounded-md" title="Xóa"><span class="material-icons-round text-lg">delete</span></button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function showCropModal(id = null) {
    let crop = {};
    if (id) {
        const crops = await fetchAPI(`${API_BASE_URL}/admin/crops`);
        crop = crops.find(c => c.id === id) || {};
    }

    document.getElementById('modal-container').innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
            <div class="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onclick="closeModal()"></div>
            <div class="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl modal-content max-h-[90vh] overflow-hidden flex flex-col">
                <div class="px-8 py-6 border-b border-gray-200 flex items-center justify-between">
                    <h3 class="text-xl font-bold text-gray-800">${id ? 'Chỉnh sửa' : 'Thêm'} Cây trồng</h3>
                    <button onclick="closeModal()" class="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <form id="crop-form" class="p-8 overflow-y-auto grid grid-cols-2 gap-6">
                    <!-- Image Upload -->
                    <div class="col-span-2">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Hình ảnh</label>
                        <div class="flex items-start gap-4">
                            <div id="crop-img-preview" class="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                                ${crop.imageUrl
            ? `<img src="${crop.imageUrl}" class="w-full h-full object-cover">`
            : `<span class="material-icons-round text-gray-400 text-3xl">image</span>`
        }
                            </div>
                            <div class="flex-1 space-y-2">
                                <input type="text" name="imageUrl" value="${crop.imageUrl || ''}" placeholder="Nhập URL hình ảnh..." class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary text-sm" onchange="previewImage(this.value, 'crop-img-preview')">
                                <div class="flex items-center gap-2">
                                    <span class="text-xs text-gray-500">hoặc</span>
                                    <label class="cursor-pointer text-sm text-primary hover:text-primary-dark font-medium">
                                        Chọn file
                                        <input type="file" accept="image/*" class="hidden" onchange="handleFileUpload(this, 'crop-img-preview', 'crop-form')">
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-span-2">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Tên cây trồng *</label>
                        <input type="text" name="name" value="${crop.name || ''}" required class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Danh mục</label>
                        <select name="category" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                            <option value="GRAIN" ${crop.category === 'GRAIN' ? 'selected' : ''}>Ngũ cốc</option>
                            <option value="VEGETABLE" ${crop.category === 'VEGETABLE' ? 'selected' : ''}>Rau củ</option>
                            <option value="FRUIT" ${crop.category === 'FRUIT' ? 'selected' : ''}>Trái cây</option>
                            <option value="LEGUME" ${crop.category === 'LEGUME' ? 'selected' : ''}>Đậu</option>
                            <option value="INDUSTRIAL" ${crop.category === 'INDUSTRIAL' ? 'selected' : ''}>Cây công nghiệp</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Thời gian trưởng thành (ngày)</label>
                        <input type="number" name="growthDurationDays" value="${crop.growthDurationDays || ''}" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Nhiệt độ tối thiểu (°C)</label>
                        <input type="number" name="minTemp" value="${crop.minTemp || ''}" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Nhiệt độ tối đa (°C)</label>
                        <input type="number" name="maxTemp" value="${crop.maxTemp || ''}" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Nhu cầu nước</label>
                        <select name="waterNeeds" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                            <option value="LOW" ${crop.waterNeeds === 'LOW' ? 'selected' : ''}>Thấp</option>
                            <option value="MEDIUM" ${crop.waterNeeds === 'MEDIUM' ? 'selected' : ''}>Trung bình</option>
                            <option value="HIGH" ${crop.waterNeeds === 'HIGH' ? 'selected' : ''}>Cao</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Mùa vụ lý tưởng</label>
                        <input type="text" name="idealSeasons" value="${crop.idealSeasons || ''}" placeholder="VD: Xuân, Hè" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                    </div>
                    <div class="col-span-2">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Mô tả</label>
                        <textarea name="description" rows="3" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">${crop.description || ''}</textarea>
                    </div>
                </form>
                <div class="px-8 py-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button onclick="closeModal()" class="px-5 py-2.5 rounded-lg border border-gray-300 font-medium text-gray-700 bg-white hover:bg-gray-50">Hủy</button>
                    <button onclick="saveCrop(${id})" class="px-5 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark flex items-center gap-2">
                        <span class="material-icons-round text-sm">save</span> Lưu
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function saveCrop(id) {
    const form = document.getElementById('crop-form');
    const data = Object.fromEntries(new FormData(form));

    if (id) {
        await fetchAPI(`${API_BASE_URL}/admin/crops/${id}`, 'PUT', data);
    } else {
        await fetchAPI(`${API_BASE_URL}/admin/crops`, 'POST', data);
    }
    closeModal();
    loadCrops();
}

// ============ SHOP ITEMS ============
let itemsData = [];

async function loadShopItems() {
    document.getElementById('page-title').textContent = 'Quản lý Sản phẩm';
    itemsData = await fetchAPI(`${API_BASE_URL}/admin/shop-items`) || [];

    document.getElementById('main-content').innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <div class="relative w-72">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-gray-400">search</span>
                <input type="text" id="search-items" placeholder="Tìm kiếm..." class="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
            <div class="flex gap-3">
                <button onclick="exportItemsCSV()" class="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg transition-all font-medium">
                    <span class="material-icons-round text-lg">download</span> Xuất CSV
                </button>
                <button onclick="loadStoreConfig()" class="flex items-center gap-2 bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2.5 rounded-lg transition-all font-medium">
                    <span class="material-icons-round text-lg">storefront</span> Cài đặt cửa hàng
                </button>
                <button onclick="showItemModal()" class="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg shadow-md transition-all font-medium">
                    <span class="material-icons-round text-lg">add</span> Thêm mới
                </button>
            </div>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Sản phẩm</th>
                        <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Danh mục</th>
                        <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Giá</th>
                        <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Kho</th>
                        <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Trạng thái</th>
                        <th class="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Thao tác</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200" id="items-table-body"></tbody>
            </table>
        </div>
    `;

    renderItemsTable(itemsData);

    document.getElementById('search-items').addEventListener('input', (e) => {
        const filtered = itemsData.filter(i =>
            i.name?.toLowerCase().includes(e.target.value.toLowerCase()) ||
            i.category?.toLowerCase().includes(e.target.value.toLowerCase())
        );
        renderItemsTable(filtered);
    });
}

function renderItemsTable(items) {
    document.getElementById('items-table-body').innerHTML = items.map(i => `
        <tr class="table-row hover:bg-gray-50 transition-colors cursor-pointer" onclick="showItemDetail(${i.id})">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    ${i.imageUrl
            ? `<img src="${i.imageUrl}" alt="${i.name}" class="w-12 h-12 rounded-lg object-cover border border-gray-200" onerror="this.onerror=null;this.outerHTML='<div class=\\'w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600\\'><span class=\\'material-icons-round\\'>inventory_2</span></div>';">`
            : `<div class="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600"><span class="material-icons-round">inventory_2</span></div>`
        }
                    <p class="text-sm font-medium text-gray-900">${i.name}</p>
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-700">${i.category || '-'}</td>
            <td class="px-6 py-4 text-sm text-gray-700">${formatCurrency(i.price)}</td>
            <td class="px-6 py-4 text-sm text-gray-700">${i.stockQuantity === -1 ? 'Không giới hạn' : i.stockQuantity}</td>
            <td class="px-6 py-4">
                <span class="px-3 py-1 text-xs font-semibold rounded-full ${i.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}">
                    ${i.isActive ? 'Đang bán' : 'Ngừng bán'}
                </span>
            </td>
            <td class="px-6 py-4 text-right" onclick="event.stopPropagation()">
                <div class="flex items-center justify-end gap-2 action-btn">
                    <button onclick="showItemDetail(${i.id})" class="p-1.5 text-gray-400 hover:text-primary rounded-md" title="Xem chi tiết"><span class="material-icons-round text-lg">visibility</span></button>
                    <button onclick="showItemModal(${i.id})" class="p-1.5 text-gray-400 hover:text-blue-500 rounded-md" title="Chỉnh sửa"><span class="material-icons-round text-lg">edit</span></button>
                    <button onclick="showDeleteModal('item', ${i.id}, '${i.name}')" class="p-1.5 text-gray-400 hover:text-red-500 rounded-md" title="Xóa"><span class="material-icons-round text-lg">delete</span></button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function showItemModal(id = null) {
    let item = {};
    if (id) {
        const items = await fetchAPI(`${API_BASE_URL}/admin/shop-items`);
        item = items.find(i => i.id === id) || {};
    }

    document.getElementById('modal-container').innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
            <div class="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onclick="closeModal()"></div>
            <div class="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl modal-content max-h-[90vh] overflow-hidden flex flex-col">
                <div class="px-8 py-6 border-b border-gray-200 flex items-center justify-between">
                    <h3 class="text-xl font-bold text-gray-800">${id ? 'Chỉnh sửa' : 'Thêm'} Sản phẩm</h3>
                    <button onclick="closeModal()" class="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <form id="item-form" class="p-8 overflow-y-auto grid grid-cols-2 gap-6">
                    <!-- Image Upload -->
                    <div class="col-span-2">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Hình ảnh</label>
                        <div class="flex items-start gap-4">
                            <div id="item-img-preview" class="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                                ${item.imageUrl
            ? `<img src="${item.imageUrl}" class="w-full h-full object-cover">`
            : `<span class="material-icons-round text-gray-400 text-3xl">image</span>`
        }
                            </div>
                            <div class="flex-1 space-y-2">
                                <input type="text" name="imageUrl" value="${item.imageUrl || ''}" placeholder="Nhập URL hình ảnh..." class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary text-sm" onchange="previewImage(this.value, 'item-img-preview')">
                                <div class="flex items-center gap-2">
                                    <span class="text-xs text-gray-500">hoặc</span>
                                    <label class="cursor-pointer text-sm text-primary hover:text-primary-dark font-medium">
                                        Chọn file
                                        <input type="file" accept="image/*" class="hidden" onchange="handleFileUpload(this, 'item-img-preview', 'item-form')">
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-span-2">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Tên sản phẩm *</label>
                        <input type="text" name="name" value="${item.name || ''}" required class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Danh mục *</label>
                        <select name="category" required class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                            <option value="HAT_GIONG" ${item.category === 'HAT_GIONG' ? 'selected' : ''}>Hạt giống</option>
                            <option value="PHAN_BON" ${item.category === 'PHAN_BON' ? 'selected' : ''}>Phân bón</option>
                            <option value="THUOC_TRU_SAU" ${item.category === 'THUOC_TRU_SAU' ? 'selected' : ''}>Thuốc trừ sâu</option>
                            <option value="DUNG_CU" ${item.category === 'DUNG_CU' ? 'selected' : ''}>Dụng cụ</option>
                            <option value="THUC_AN" ${item.category === 'THUC_AN' ? 'selected' : ''}>Thức ăn chăn nuôi</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Đơn vị</label>
                        <input type="text" name="unit" value="${item.unit || 'kg'}" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Giá (VNĐ) *</label>
                        <input type="number" name="price" value="${item.price || ''}" required class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Số lượng kho (-1 = không giới hạn)</label>
                        <input type="number" name="stockQuantity" value="${item.stockQuantity ?? -1}" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                    </div>
                    <div class="flex items-center gap-4 col-span-2">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" name="isActive" ${item.isActive !== false ? 'checked' : ''} class="rounded border-gray-300 text-primary focus:ring-primary">
                            <span class="text-sm text-gray-700">Đang bán</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" name="isFeatured" ${item.isFeatured ? 'checked' : ''} class="rounded border-gray-300 text-primary focus:ring-primary">
                            <span class="text-sm text-gray-700">Nổi bật</span>
                        </label>
                    </div>
                    <div class="col-span-2">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Mô tả</label>
                        <textarea name="description" rows="3" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">${item.description || ''}</textarea>
                    </div>
                </form>
                <div class="px-8 py-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button onclick="closeModal()" class="px-5 py-2.5 rounded-lg border border-gray-300 font-medium text-gray-700 bg-white hover:bg-gray-50">Hủy</button>
                    <button onclick="saveItem(${id})" class="px-5 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark flex items-center gap-2">
                        <span class="material-icons-round text-sm">save</span> Lưu
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function saveItem(id) {
    const form = document.getElementById('item-form');
    const formData = new FormData(form);
    const data = {
        name: formData.get('name'),
        category: formData.get('category'),
        unit: formData.get('unit'),
        price: parseFloat(formData.get('price')),
        stockQuantity: parseInt(formData.get('stockQuantity')),
        isActive: formData.has('isActive'),
        isFeatured: formData.has('isFeatured'),
        description: formData.get('description'),
        imageUrl: formData.get('imageUrl')
    };

    if (id) {
        await fetchAPI(`${API_BASE_URL}/admin/shop-items/${id}`, 'PUT', data);
    } else {
        await fetchAPI(`${API_BASE_URL}/admin/shop-items`, 'POST', data);
    }
    closeModal();
    loadShopItems();
}

// ============ ANIMALS ============
let animalsData = [];

async function loadAnimals() {
    document.getElementById('page-title').textContent = 'Quản lý Vật nuôi';
    animalsData = await fetchAPI(`${API_BASE_URL}/admin/animals`) || [];

    document.getElementById('main-content').innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <div class="relative w-72">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-gray-400">search</span>
                <input type="text" id="search-animals" placeholder="Tìm kiếm..." class="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
            <div class="flex gap-3">
                <button onclick="exportAnimalsCSV()" class="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg transition-all font-medium">
                    <span class="material-icons-round text-lg">download</span> Xuất CSV
                </button>
                <button onclick="showAnimalModal()" class="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg shadow-md transition-all font-medium">
                    <span class="material-icons-round text-lg">add</span> Thêm mới
                </button>
            </div>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Vật nuôi</th>
                        <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Loại</th>
                        <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Thời gian nuôi</th>
                        <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Giá mua/bán</th>
                        <th class="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Thao tác</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200" id="animals-table-body"></tbody>
            </table>
        </div>
    `;

    renderAnimalsTable(animalsData);

    document.getElementById('search-animals').addEventListener('input', (e) => {
        const filtered = animalsData.filter(a =>
            a.name?.toLowerCase().includes(e.target.value.toLowerCase()) ||
            a.category?.toLowerCase().includes(e.target.value.toLowerCase())
        );
        renderAnimalsTable(filtered);
    });
}

function renderAnimalsTable(animals) {
    document.getElementById('animals-table-body').innerHTML = animals.map(a => `
        <tr class="table-row hover:bg-gray-50 transition-colors cursor-pointer" onclick="showAnimalDetail(${a.id})">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    ${a.imageUrl
            ? `<img src="${a.imageUrl}" alt="${a.name}" class="w-12 h-12 rounded-lg object-cover border border-gray-200" onerror="this.onerror=null;this.outerHTML='<div class=\\'w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600\\'><span class=\\'material-icons-round\\'>${a.iconName || 'pets'}</span></div>';">`
            : `<div class="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600"><span class="material-icons-round">${a.iconName || 'pets'}</span></div>`
        }
                    <p class="text-sm font-medium text-gray-900">${a.name}</p>
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-700">${a.category || '-'}</td>
            <td class="px-6 py-4 text-sm text-gray-700">${a.growthDurationDays || '-'} ngày</td>
            <td class="px-6 py-4 text-sm text-gray-700">${formatCurrency(a.buyPricePerUnit)} / ${formatCurrency(a.sellPricePerUnit)}</td>
            <td class="px-6 py-4 text-right" onclick="event.stopPropagation()">
                <div class="flex items-center justify-end gap-2 action-btn">
                    <button onclick="showAnimalDetail(${a.id})" class="p-1.5 text-gray-400 hover:text-primary rounded-md" title="Xem chi tiết"><span class="material-icons-round text-lg">visibility</span></button>
                    <button onclick="showAnimalModal(${a.id})" class="p-1.5 text-gray-400 hover:text-blue-500 rounded-md" title="Chỉnh sửa"><span class="material-icons-round text-lg">edit</span></button>
                    <button onclick="showDeleteModal('animal', ${a.id}, '${a.name}')" class="p-1.5 text-gray-400 hover:text-red-500 rounded-md" title="Xóa"><span class="material-icons-round text-lg">delete</span></button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function showAnimalModal(id = null) {
    let animal = {};
    if (id) {
        const animals = await fetchAPI(`${API_BASE_URL}/admin/animals`);
        animal = animals?.find(a => a.id === id) || {};
    }

    document.getElementById('modal-container').innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
            <div class="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onclick="closeModal()"></div>
            <div class="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl modal-content max-h-[90vh] overflow-hidden flex flex-col">
                <div class="px-8 py-6 border-b border-gray-200 flex items-center justify-between">
                    <h3 class="text-xl font-bold text-gray-800">${id ? 'Chỉnh sửa' : 'Thêm'} Vật nuôi</h3>
                    <button onclick="closeModal()" class="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <form id="animal-form" class="p-8 overflow-y-auto grid grid-cols-2 gap-6">
                    <!-- Image Upload -->
                    <div class="col-span-2">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Hình ảnh</label>
                        <div class="flex items-start gap-4">
                            <div id="animal-img-preview" class="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                                ${animal.imageUrl
            ? `<img src="${animal.imageUrl}" class="w-full h-full object-cover">`
            : `<span class="material-icons-round text-gray-400 text-3xl">image</span>`
        }
                            </div>
                            <div class="flex-1 space-y-2">
                                <input type="text" name="imageUrl" value="${animal.imageUrl || ''}" placeholder="Nhập URL hình ảnh..." class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary text-sm" onchange="previewImage(this.value, 'animal-img-preview')">
                                <div class="flex items-center gap-2">
                                    <span class="text-xs text-gray-500">hoặc</span>
                                    <label class="cursor-pointer text-sm text-primary hover:text-primary-dark font-medium">
                                        Chọn file
                                        <input type="file" accept="image/*" class="hidden" onchange="handleFileUpload(this, 'animal-img-preview', 'animal-form')">
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-span-2">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Tên vật nuôi *</label>
                        <input type="text" name="name" value="${animal.name || ''}" required class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Loại</label>
                        <select name="category" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                            <option value="LAND" ${animal.category === 'LAND' ? 'selected' : ''}>Gia cầm/Gia súc</option>
                            <option value="FRESHWATER" ${animal.category === 'FRESHWATER' ? 'selected' : ''}>Thủy sản nước ngọt</option>
                            <option value="SALTWATER" ${animal.category === 'SALTWATER' ? 'selected' : ''}>Thủy sản nước mặn</option>
                            <option value="SPECIAL" ${animal.category === 'SPECIAL' ? 'selected' : ''}>Đặc biệt</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Icon (Material Icons)</label>
                        <input type="text" name="iconName" value="${animal.iconName || 'pets'}" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Thời gian nuôi (ngày)</label>
                        <input type="number" name="growthDurationDays" value="${animal.growthDurationDays || ''}" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Đơn vị</label>
                        <input type="text" name="unit" value="${animal.unit || 'con'}" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Giá mua (VNĐ)</label>
                        <input type="number" name="buyPricePerUnit" value="${animal.buyPricePerUnit || ''}" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Giá bán (VNĐ)</label>
                        <input type="number" name="sellPricePerUnit" value="${animal.sellPricePerUnit || ''}" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                    </div>
                    <div class="col-span-2">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Mô tả</label>
                        <textarea name="description" rows="3" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">${animal.description || ''}</textarea>
                    </div>
                </form>
                <div class="px-8 py-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button onclick="closeModal()" class="px-5 py-2.5 rounded-lg border border-gray-300 font-medium text-gray-700 bg-white hover:bg-gray-50">Hủy</button>
                    <button onclick="saveAnimal(${id})" class="px-5 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark flex items-center gap-2">
                        <span class="material-icons-round text-sm">save</span> Lưu
                    </button>
                </div>
            </div>
        </div >
    `;
}

async function saveAnimal(id) {
    const form = document.getElementById('animal-form');
    const data = Object.fromEntries(new FormData(form));

    if (id) {
        await fetchAPI(`${API_BASE_URL}/admin/animals/${id}`, 'PUT', data);
    } else {
        await fetchAPI(`${API_BASE_URL}/admin/animals`, 'POST', data);
    }
    closeModal();
    loadAnimals();
}

// ============ DELETE MODAL ============
function showDeleteModal(type, id, name) {
    document.getElementById('modal-container').innerHTML = `
    < div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay" >
            <div class="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onclick="closeModal()"></div>
            <div class="relative bg-white w-full max-w-md rounded-2xl shadow-2xl modal-content overflow-hidden">
                <div class="flex flex-col items-center pt-8 pb-4 px-6 text-center">
                    <div class="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-5 border-2 border-red-100">
                        <span class="material-icons-round text-3xl text-red-500">delete_forever</span>
                    </div>
                    <h2 class="text-xl font-bold text-gray-800">Xóa "${name}"?</h2>
                    <p class="text-gray-500 text-sm mt-3">Hành động này <span class="font-bold text-red-600">không thể hoàn tác</span>. Dữ liệu sẽ bị xóa vĩnh viễn.</p>
                </div>
                <div class="px-8 py-4">
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Nhập <span class="text-red-500 bg-red-50 px-1 rounded">DELETE</span> để xác nhận
                    </label>
                    <input type="text" id="delete-confirm-input" placeholder="Nhập DELETE..." class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-transparent font-medium">
                </div>
                <div class="flex gap-3 px-8 pb-8 mt-2">
                    <button onclick="closeModal()" class="flex-1 px-4 py-3 rounded-lg border border-gray-200 font-medium text-gray-700 hover:bg-gray-50">Hủy</button>
                    <button id="delete-btn" onclick="confirmDelete('${type}', ${id})" disabled class="flex-1 px-4 py-3 rounded-lg bg-red-500 text-white font-medium opacity-50 cursor-not-allowed">Xóa vĩnh viễn</button>
                </div>
            </div>
        </div >
    `;

    document.getElementById('delete-confirm-input').addEventListener('input', (e) => {
        const btn = document.getElementById('delete-btn');
        if (e.target.value === 'DELETE') {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
            btn.classList.add('hover:bg-red-600');
        } else {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
            btn.classList.remove('hover:bg-red-600');
        }
    });
}

async function confirmDelete(type, id) {
    const endpoints = { crop: 'crops', item: 'shop-items', animal: 'animals' };
    await fetchAPI(`${API_BASE_URL}/admin/${endpoints[type]}/${id}`, 'DELETE');
    closeModal();

    switch (type) {
        case 'crop': loadCrops(); break;
        case 'item': loadShopItems(); break;
        case 'animal': loadAnimals(); break;
    }
}

// ============ UTILS ============
function closeModal() {
    document.getElementById('modal-container').innerHTML = '';
    const modal = document.getElementById('modal');
    if (modal) {
        modal.classList.remove('active');
        modal.innerHTML = '';
    }
}

function showToast(title, message, type = 'success') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="material-icons-round text-${type === 'success' ? 'green' : 'red'}-500">${type === 'success' ? 'check_circle' : 'error'}</span>
        <div>
            <p class="font-semibold text-gray-800">${title}</p>
            <p class="text-sm text-gray-600">${message}</p>
        </div>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function formatCurrency(amount) {
    if (!amount) return '-';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Smart icon renderer - handles Material Icons, emojis, and URLs
function renderCategoryIcon(icon) {
    if (!icon) {
        return '<span class="material-icons-round text-primary text-2xl leading-none">category</span>';
    }

    // Check if it's a URL (image)
    if (icon.startsWith('http') || icon.startsWith('/')) {
        return `<img src="${icon}" alt="icon" class="w-6 h-6 object-cover rounded">`;
    }

    // Check if it's an emoji
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    if (emojiRegex.test(icon)) {
        return `<span class="text-2xl leading-none flex items-center justify-center h-full w-full">${icon}</span>`;
    }

    // Default: treat as Material Icons name
    // Add flex items-center justify-center to ensure perfect centering
    return `<span class="material-icons-round text-primary text-2xl leading-none flex items-center justify-center h-full w-full">${icon}</span>`;
}

async function fetchAPI(url, method = 'GET', body = null) {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');

    // Handle different URL formats:
    // 1. Relative URL starting with / → prepend API_BASE_URL
    // 2. Full URL already containing API_BASE_URL → use as-is
    // 3. Full URL with http(s):// → use as-is
    let fullUrl = url;
    if (url.startsWith('/')) {
        fullUrl = `${API_BASE_URL}${url}`;
    } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
        fullUrl = `${API_BASE_URL}/${url}`;
    }
    // If URL already starts with http(s)://, use as-is

    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(fullUrl, options);
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `API Error: ${response.status}`);
    }
    return response.json();
}

async function editGuide(id) {
    currentEditingGuideId = id;
    try {
        return res.status === 204 ? null : await res.json();
    } catch (e) {
        console.error('API Error:', e);
        return null;
    }
}

// ============ IMAGE HELPERS ============
function previewImage(url, previewId) {
    const preview = document.getElementById(previewId);
    if (!url) {
        preview.innerHTML = `<span class="material-icons-round text-gray-400 text-3xl">image</span>`;
        return;
    }
    preview.innerHTML = `<img src="${url}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<span class=\\'material-icons-round text-red-400 text-3xl\\'>broken_image</span>';">`;
}

function handleFileUpload(input, previewId, formId) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        // Update preview
        document.getElementById(previewId).innerHTML = `<img src="${dataUrl}" class="w-full h-full object-cover">`;
        // Update hidden input or URL input
        const form = document.getElementById(formId);
        const urlInput = form.querySelector('input[name="imageUrl"]');
        if (urlInput) urlInput.value = dataUrl;
    };
    reader.readAsDataURL(file);
}

// ============ MODAL ANIMATION ============
function animateModalOpen() {
    gsap.fromTo('.modal-overlay', { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo('.modal-content', { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(1.2)' });
}

function animateModalClose(callback) {
    gsap.to('.modal-overlay', { opacity: 0, duration: 0.15 });
    gsap.to('.modal-content', { scale: 0.9, opacity: 0, duration: 0.15, onComplete: callback });
}

// ============ EXPORT CSV FUNCTIONS ============
function exportToCSV(data, filename, columns) {
    const header = columns.map(c => c.label).join(',');
    const rows = data.map(row =>
        columns.map(c => {
            let val = row[c.key] ?? '';
            if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
                val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    logActivity('EXPORT', filename.replace('.csv', ''), `Xuất ${data.length} bản ghi`);
}

function exportCropsCSV() {
    const columns = [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Tên cây trồng' },
        { key: 'category', label: 'Danh mục' },
        { key: 'growthDurationDays', label: 'Thời gian trưởng thành (ngày)' },
        { key: 'idealSeasons', label: 'Mùa vụ' },
        { key: 'minTemp', label: 'Nhiệt độ tối thiểu' },
        { key: 'maxTemp', label: 'Nhiệt độ tối đa' },
        { key: 'waterNeeds', label: 'Nhu cầu nước' },
        { key: 'description', label: 'Mô tả' }
    ];
    exportToCSV(cropsData, 'caytrong_export.csv', columns);
}

function exportItemsCSV() {
    const columns = [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Tên sản phẩm' },
        { key: 'category', label: 'Danh mục' },
        { key: 'price', label: 'Giá' },
        { key: 'stockQuantity', label: 'Tồn kho' },
        { key: 'unit', label: 'Đơn vị' },
        { key: 'isActive', label: 'Trạng thái' },
        { key: 'description', label: 'Mô tả' }
    ];
    exportToCSV(itemsData, 'sanpham_export.csv', columns);
}

function exportAnimalsCSV() {
    const columns = [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Tên vật nuôi' },
        { key: 'category', label: 'Loại' },
        { key: 'growthDurationDays', label: 'Thời gian nuôi (ngày)' },
        { key: 'buyPricePerUnit', label: 'Giá mua' },
        { key: 'sellPricePerUnit', label: 'Giá bán' },
        { key: 'unit', label: 'Đơn vị' },
        { key: 'description', label: 'Mô tả' }
    ];
    exportToCSV(animalsData, 'vatnuoi_export.csv', columns);
}

// ============ CROP DETAIL VIEW ============
async function showCropDetail(id) {
    const crop = cropsData.find(c => c.id === id) || await fetchAPI(`${API_BASE_URL}/admin/crops/${id}`);
    if (!crop) return;

    // Parse JSON fields safely
    const commonPests = (() => { try { return typeof crop.commonPests === 'string' ? JSON.parse(crop.commonPests) : (crop.commonPests || []); } catch { return []; } })();
    const idealSeasons = (() => { try { return typeof crop.idealSeasons === 'string' ? JSON.parse(crop.idealSeasons) : (crop.idealSeasons || []); } catch { return crop.idealSeasons ? [crop.idealSeasons] : []; } })();
    const avoidWeather = (() => { try { return typeof crop.avoidWeather === 'string' ? JSON.parse(crop.avoidWeather) : (crop.avoidWeather || []); } catch { return []; } })();
    const idealHumidity = (() => { try { return typeof crop.idealHumidityRange === 'string' ? JSON.parse(crop.idealHumidityRange) : (crop.idealHumidityRange || null); } catch { return null; } })();

    // Calculate resource allocation from costs
    const seedCost = crop.seedCostPerKg || 0;
    const careCost = crop.careCostPerSqm || 0;
    const totalCost = seedCost + careCost;
    const seedPct = totalCost > 0 ? Math.round((seedCost / totalCost) * 100) : 50;
    const carePct = totalCost > 0 ? Math.round((careCost / totalCost) * 100) : 50;

    // Category label map
    const categoryLabels = { 'GRAIN': 'Ngũ cốc', 'FRUIT': 'Trái cây', 'VEGETABLE': 'Rau củ', 'LEGUME': 'Đậu', 'INDUSTRIAL': 'Công nghiệp' };
    const seasonLabels = { 'SPRING': 'Xuân', 'SUMMER': 'Hè', 'FALL': 'Thu', 'WINTER': 'Đông', 'ALL': 'Quanh năm' };

    document.getElementById('page-title').innerHTML = `
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <a onclick="loadCrops()" class="hover:text-emerald-600 cursor-pointer transition-colors">Cây trồng</a>
            <span class="material-icons-round text-base">chevron_right</span>
            <span class="text-gray-800 font-medium">${crop.name}</span>
        </div>
        <h2 class="text-2xl font-bold text-gray-800">Chi tiết Cây trồng</h2>
    `;

    document.getElementById('main-content').innerHTML = `
        <div class="max-w-7xl mx-auto space-y-6">
            <!-- Header Card -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div class="flex items-center gap-5">
                    <div class="w-16 h-16 ${crop.imageUrl ? '' : 'bg-yellow-100'} rounded-xl flex items-center justify-center text-yellow-600 overflow-hidden flex-shrink-0">
                        ${crop.imageUrl
            ? `<img src="${crop.imageUrl}" alt="${crop.name}" class="w-full h-full object-cover">`
            : `<span class="material-icons-round text-3xl">agriculture</span>`
        }
                    </div>
                    <div>
                        <div class="flex items-center gap-3">
                            <h3 class="text-xl font-bold text-gray-800">${crop.name}</h3>
                            <span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                ${categoryLabels[crop.category] || crop.category || 'N/A'}
                            </span>
                        </div>
                        <p class="text-gray-500 italic mt-1">${crop.description || 'Không có mô tả'}</p>
                    </div>
                </div>
                <div class="flex gap-3">
                    <button onclick="loadCrops()" class="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors bg-white">
                        Quay lại
                    </button>
                    <button onclick="showCropModal(${crop.id})" class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2">
                        <span class="material-icons-round text-sm">edit</span> Chỉnh sửa
                    </button>
                </div>
            </div>

            <!-- Main Content Grid: 2/3 + 1/3 -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Left Column (2/3) -->
                <div class="lg:col-span-2 space-y-6">
                    <!-- Growth Analytics Chart -->
                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div class="flex items-center justify-between mb-6">
                            <h4 class="text-lg font-bold text-gray-800">Phân tích Sinh trưởng</h4>
                        </div>
                        <div class="h-64 w-full">
                            <canvas id="cropGrowthChart"></canvas>
                        </div>
                    </div>

                    <!-- Technical Specifications -->
                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div class="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                            <h4 class="text-base font-semibold text-gray-800">Thông số kỹ thuật</h4>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
                            <div class="p-6 space-y-4">
                                <div class="flex justify-between items-center">
                                    <span class="text-sm text-gray-500">Danh mục</span>
                                    <span class="text-sm font-medium text-gray-800">${categoryLabels[crop.category] || crop.category || '-'}</span>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-sm text-gray-500">Thời gian sinh trưởng</span>
                                    <span class="text-sm font-medium text-gray-800 flex items-center gap-1">
                                        <span class="material-icons-round text-base text-gray-400">schedule</span>
                                        ${crop.growthDurationDays || '-'} ngày
                                    </span>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-sm text-gray-500">Thời gian nảy mầm</span>
                                    <span class="text-sm font-medium text-gray-800">${crop.germinationDays || '-'} ngày</span>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-sm text-gray-500">Mùa vụ lý tưởng</span>
                                    <span class="text-sm font-medium text-gray-800">${Array.isArray(idealSeasons) ? idealSeasons.map(s => seasonLabels[s] || s).join(', ') : (idealSeasons || '-')}</span>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-sm text-gray-500">Loại đất phù hợp</span>
                                    <span class="text-sm font-medium text-gray-800">${crop.soilTypePreferred || '-'}</span>
                                </div>
                            </div>
                            <div class="p-6 space-y-4">
                                <div class="flex justify-between items-center">
                                    <span class="text-sm text-gray-500">Nhiệt độ lý tưởng</span>
                                    <span class="text-sm font-medium text-gray-800">${crop.minTemp || '-'}°C - ${crop.maxTemp || '-'}°C</span>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-sm text-gray-500">Độ ẩm lý tưởng</span>
                                    <span class="text-sm font-medium text-gray-800">${idealHumidity ? `${idealHumidity.min || idealHumidity[0] || '-'}% - ${idealHumidity.max || idealHumidity[1] || '-'}%` : '-'}</span>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-sm text-gray-500">Mật độ gieo</span>
                                    <span class="text-sm font-medium text-gray-800">${crop.seedsPerSqm || '-'} hạt/m²</span>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-sm text-gray-500">Nhu cầu nước</span>
                                    <div class="flex gap-1">
                                        ${[1, 2, 3].map(i => `<span class="material-icons-round text-base ${i <= (crop.waterNeeds || 0) ? 'text-blue-500' : 'text-gray-300'}">water_drop</span>`).join('')}
                                    </div>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-sm text-gray-500">Tránh thời tiết</span>
                                    <span class="text-sm font-medium text-gray-800">${Array.isArray(avoidWeather) && avoidWeather.length > 0 ? avoidWeather.join(', ') : '-'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Care Intervals -->
                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div class="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                            <h4 class="text-base font-semibold text-gray-800">Chu kỳ chăm sóc</h4>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
                            <div class="p-6 text-center">
                                <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                                    <span class="material-icons-round text-xl">grass</span>
                                </div>
                                <p class="text-2xl font-bold text-gray-800">${crop.fertilizerIntervalDays || '-'}</p>
                                <p class="text-sm text-gray-500">ngày/lần bón phân</p>
                            </div>
                            <div class="p-6 text-center">
                                <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                    <span class="material-icons-round text-xl">water_drop</span>
                                </div>
                                <p class="text-2xl font-bold text-gray-800">${crop.wateringIntervalDays || '-'}</p>
                                <p class="text-sm text-gray-500">ngày/lần tưới nước</p>
                            </div>
                            <div class="p-6 text-center">
                                <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                                    <span class="material-icons-round text-xl">bug_report</span>
                                </div>
                                <p class="text-2xl font-bold text-gray-800">${crop.pesticideIntervalDays || '-'}</p>
                                <p class="text-sm text-gray-500">ngày/lần phun thuốc</p>
                            </div>
                        </div>
                    </div>

                    <!-- Common Pests -->
                    ${commonPests.length > 0 ? `
                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div class="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                            <h4 class="text-base font-semibold text-gray-800">Sâu bệnh thường gặp</h4>
                        </div>
                        <div class="p-6">
                            <div class="flex flex-wrap gap-2">
                                ${commonPests.map(pest => `
                                    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-red-50 text-red-700 border border-red-200">
                                        <span class="material-icons-round text-sm">bug_report</span>
                                        ${pest}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>

                <!-- Right Column (1/3) -->
                <div class="lg:col-span-1 space-y-6">
                    <!-- Resource Allocation (Cost Breakdown) -->
                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h4 class="text-base font-bold text-gray-800 mb-4">Phân bổ Chi phí</h4>
                        <div class="relative h-48 flex justify-center items-center">
                            <canvas id="cropResourceChart"></canvas>
                        </div>
                        <div class="mt-4 space-y-2">
                            <div class="flex items-center justify-between text-sm">
                                <div class="flex items-center gap-2">
                                    <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
                                    <span class="text-gray-500">Chi phí hạt giống</span>
                                </div>
                                <span class="font-medium text-gray-800">${formatCurrency(seedCost)}/kg</span>
                            </div>
                            <div class="flex items-center justify-between text-sm">
                                <div class="flex items-center gap-2">
                                    <span class="w-3 h-3 rounded-full bg-blue-500"></span>
                                    <span class="text-gray-500">Chi phí chăm sóc</span>
                                </div>
                                <span class="font-medium text-gray-800">${formatCurrency(careCost)}/m²</span>
                            </div>
                        </div>
                    </div>

                    <!-- Yield Economics -->
                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h4 class="text-base font-bold text-gray-800 mb-4">Kinh tế Thu hoạch</h4>
                        <div class="space-y-4">
                            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div class="flex items-center gap-3">
                                    <div class="text-gray-400"><span class="material-icons-round">trending_up</span></div>
                                    <span class="text-sm font-medium text-gray-700">Sản lượng dự kiến</span>
                                </div>
                                <span class="text-sm font-bold text-gray-900">${crop.expectedYieldPerSqm || '-'} kg/m²</span>
                            </div>
                            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div class="flex items-center gap-3">
                                    <div class="text-gray-400"><span class="material-icons-round">sell</span></div>
                                    <span class="text-sm font-medium text-gray-700">Giá thị trường</span>
                                </div>
                                <span class="text-sm font-bold text-emerald-600">${formatCurrency(crop.marketPricePerKg)}/kg</span>
                            </div>
                            <div class="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                <div class="flex items-center gap-3">
                                    <div class="text-emerald-500"><span class="material-icons-round">payments</span></div>
                                    <span class="text-sm font-medium text-emerald-700">Doanh thu/m²</span>
                                </div>
                                <span class="text-sm font-bold text-emerald-700">${formatCurrency((crop.expectedYieldPerSqm || 0) * (crop.marketPricePerKg || 0))}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Recent Activities -->
                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h4 class="text-base font-bold text-gray-800 mb-4">Hoạt động gần đây</h4>
                        <div class="space-y-6 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                            ${(() => {
            const activities = getActivityForEntity('crop', id).slice(0, 4);
            if (activities.length === 0) {
                return `<p class="text-gray-400 text-sm pl-8">Chưa có hoạt động</p>`;
            }
            const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-yellow-500', 'bg-purple-500'];
            return activities.map((a, idx) => `
                                <div class="relative flex items-start group">
                                    <div class="absolute left-0 h-5 w-5 rounded-full border-2 border-white ${colors[idx % colors.length]} shadow-sm z-10"></div>
                                    <div class="pl-8 w-full">
                                        <p class="text-xs text-gray-400 mb-0.5">${formatDateTime(a.timestamp)}</p>
                                        <p class="text-sm font-medium text-gray-800">${a.action === 'CREATE' ? 'Tạo mới' : a.action === 'UPDATE' ? 'Cập nhật' : 'Xóa'}</p>
                                        <p class="text-xs text-gray-500 mt-1">${a.details}</p>
                                    </div>
                                </div>
                            `).join('');
        })()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Initialize Growth Analytics Chart
    setTimeout(() => {
        const ctxGrowth = document.getElementById('cropGrowthChart');
        if (ctxGrowth) {
            const ctx = ctxGrowth.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
            gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
            // Simulate growth stages based on actual crop data
            const totalDays = crop.growthDurationDays || 90;
            const germDays = crop.germinationDays || Math.round(totalDays * 0.1);
            const stages = ['Gieo hạt', `Nảy mầm (${germDays}d)`, 'Phát triển', 'Ra hoa', 'Kết trái', 'Thu hoạch'];
            const growthData = [0, 10, 35, 60, 85, 100];
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: stages,
                    datasets: [{
                        label: 'Tiến trình (%)',
                        data: growthData,
                        borderColor: '#10b981',
                        backgroundColor: gradient,
                        borderWidth: 2,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#10b981',
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1f2937', titleColor: '#f9fafb', bodyColor: '#f9fafb', padding: 10, cornerRadius: 8, displayColors: false } },
                    scales: {
                        y: { beginAtZero: true, max: 100, grid: { color: 'rgba(107,114,128,0.1)', drawBorder: false }, ticks: { color: '#9ca3af', callback: v => v + '%' } },
                        x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 11 } } }
                    }
                }
            });
        }

        // Initialize Resource Allocation Donut Chart
        const ctxResource = document.getElementById('cropResourceChart');
        if (ctxResource) {
            new Chart(ctxResource, {
                type: 'doughnut',
                data: {
                    labels: ['Hạt giống', 'Chăm sóc'],
                    datasets: [{
                        data: [seedPct || 50, carePct || 50],
                        backgroundColor: ['#10b981', '#3b82f6'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: { legend: { display: false } }
                }
            });
        }
    }, 100);

    gsap.fromTo('#main-content .max-w-7xl > *', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 });
}

// ============ SHOP ITEM DETAIL VIEW ============
async function showItemDetail(id) {
    const item = itemsData.find(i => i.id === id) || await fetchAPI(`${API_BASE_URL}/admin/shop-items/${id}`);
    if (!item) return;

    // Category labels
    const categoryLabels = { 'THUC_AN': 'Thức ăn', 'CON_GIONG': 'Con giống', 'HAT_GIONG': 'Hạt giống', 'THUOC_TRU_SAU': 'Thuốc trừ sâu', 'PHAN_BON': 'Phân bón', 'MAY_MOC': 'Máy móc' };

    // Stock status
    const stockQty = item.stockQuantity || 0;
    const stockPct = Math.min(100, stockQty * 2);
    const stockStatus = stockQty <= 0 ? { label: 'Hết hàng', color: 'red' } : stockQty < 20 ? { label: 'Sắp hết', color: 'yellow' } : { label: 'Còn hàng', color: 'green' };

    // Rating stars
    const rating = item.rating || 0;
    const starsHtml = [1, 2, 3, 4, 5].map(i => `<span class="material-icons-round text-sm ${i <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-300'}">star</span>`).join('');

    // Discount calculation
    const hasDiscount = item.discountPercent && item.discountPercent > 0;
    const originalPrice = item.originalPrice || item.price;

    document.getElementById('page-title').innerHTML = `
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <a onclick="loadShopItems()" class="hover:text-emerald-600 cursor-pointer transition-colors">Cửa hàng</a>
            <span class="material-icons-round text-base">chevron_right</span>
            <span class="text-gray-800 font-medium">${item.name}</span>
        </div>
        <h2 class="text-2xl font-bold text-gray-800">Chi tiết Sản phẩm</h2>
    `;

    document.getElementById('main-content').innerHTML = `
        <div class="max-w-7xl mx-auto space-y-6">
            <!-- Main Grid: Image/Stock (1/3) + Info/Chart (2/3) -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Left: Image & Stock -->
                <div class="bg-white rounded-xl shadow-sm p-6 col-span-1 border border-gray-200">
                    <div class="aspect-w-4 aspect-h-3 bg-gray-50 rounded-lg overflow-hidden mb-6 flex items-center justify-center relative group" style="min-height: 200px;">
                        ${item.imageUrl
            ? `<img src="${item.imageUrl}" alt="${item.name}" class="object-cover w-full h-full transform transition hover:scale-105 duration-500">`
            : `<span class="material-icons-round text-gray-300 text-6xl">inventory_2</span>`
        }
                        <span class="absolute top-3 left-3 bg-${stockStatus.color}-100 text-${stockStatus.color}-800 text-xs font-medium px-2.5 py-0.5 rounded border border-${stockStatus.color}-200">
                            ${stockStatus.label}
                        </span>
                    </div>
                    <div class="space-y-3">
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-gray-500 font-medium">Tồn kho hiện tại</span>
                            <span class="text-sm font-bold text-${stockStatus.color}-600">${stockQty} ${item.unit || 'đơn vị'}</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2.5">
                            <div class="bg-${stockStatus.color}-400 h-2.5 rounded-full transition-all" style="width: ${stockPct}%"></div>
                        </div>
                    </div>
                    <div class="mt-6 pt-6 border-t border-gray-100">
                        <div class="grid grid-cols-2 gap-4">
                            <button onclick="showItemModal(${item.id})" class="w-full bg-white border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2">
                                <span class="material-icons-round text-sm">edit</span> Sửa
                            </button>
                            <button onclick="loadShopItems()" class="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-4 rounded-lg shadow-sm transition flex items-center justify-center gap-2">
                                <span class="material-icons-round text-sm">arrow_back</span> Quay lại
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Right: Info + Sales -->
                <div class="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Product Info -->
                    <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200 flex flex-col justify-between">
                        <div>
                            <div class="flex justify-between items-start mb-4">
                                <div>
                                    <h3 class="text-2xl font-bold text-gray-900">${item.name}</h3>
                                    <p class="text-sm text-gray-500">SKU: ${item.sku || `SP-${String(item.id).padStart(4, '0')}`}</p>
                                </div>
                                <div class="text-right">
                                    <span class="text-3xl font-bold text-emerald-600">${formatCurrency(item.price)}</span>
                                    ${hasDiscount ? `<div class="text-sm"><span class="line-through text-gray-400">${formatCurrency(originalPrice)}</span> <span class="text-red-500 font-medium">-${item.discountPercent}%</span></div>` : ''}
                                </div>
                            </div>
                            <div class="space-y-3 mt-6">
                                <div class="flex justify-between border-b border-gray-100 pb-2">
                                    <span class="text-gray-500 text-sm">Danh mục</span>
                                    <span class="font-medium text-gray-900 text-sm">${categoryLabels[item.category] || item.category || '-'}</span>
                                </div>
                                ${item.subCategory ? `
                                <div class="flex justify-between border-b border-gray-100 pb-2">
                                    <span class="text-gray-500 text-sm">Phân loại</span>
                                    <span class="font-medium text-gray-900 text-sm">${item.subCategory}</span>
                                </div>` : ''}
                                <div class="flex justify-between border-b border-gray-100 pb-2">
                                    <span class="text-gray-500 text-sm">Đơn vị</span>
                                    <span class="font-medium text-gray-900 text-sm">${item.unit || '-'}</span>
                                </div>
                                ${item.weightKg ? `
                                <div class="flex justify-between border-b border-gray-100 pb-2">
                                    <span class="text-gray-500 text-sm">Trọng lượng</span>
                                    <span class="font-medium text-gray-900 text-sm">${item.weightKg} kg</span>
                                </div>` : ''}
                                <div class="flex justify-between pt-1">
                                    <span class="text-gray-500 text-sm">Đánh giá</span>
                                    <div class="flex items-center gap-1">${starsHtml}<span class="text-sm text-gray-500 ml-1">(${rating.toFixed(1)})</span></div>
                                </div>
                            </div>
                        </div>
                        <div class="mt-6 flex gap-2">
                            ${item.isActive ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Đang bán</span>` : `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Ngừng bán</span>`}
                            ${item.isFeatured ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Nổi bật</span>` : ''}
                            ${item.soldCount > 50 ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Bán chạy</span>` : ''}
                        </div>
                    </div>

                    <!-- Sales Volume Chart -->
                    <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                        <div class="flex justify-between items-center mb-4">
                            <h4 class="font-semibold text-gray-900">Thống kê bán hàng</h4>
                        </div>
                        <div class="h-40">
                            <canvas id="shopSalesChart"></canvas>
                        </div>
                        <div class="mt-4 flex items-center justify-between">
                            <div>
                                <p class="text-xs text-gray-500">Đã bán</p>
                                <p class="font-bold text-lg text-gray-900">${item.soldCount || 0} ${item.unit || 'sp'}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-xs text-gray-500">Doanh thu</p>
                                <p class="font-bold text-lg text-emerald-600">${formatCurrency((item.soldCount || 0) * (item.price || 0))}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Description -->
                    <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200 md:col-span-2">
                        <h4 class="font-semibold text-gray-900 mb-2">Mô tả sản phẩm</h4>
                        <p class="text-sm text-gray-600 leading-relaxed">${item.description || 'Không có mô tả chi tiết.'}</p>
                    </div>
                </div>
            </div>

            <!-- Stock History (Recent Activities) -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div class="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
                    <h3 class="font-bold text-lg text-gray-900">Lịch sử hoạt động</h3>
                </div>
                <div class="divide-y divide-gray-100">
                    ${(() => {
            const activities = getActivityForEntity('shop', id).slice(0, 5);
            if (activities.length === 0) {
                return '<p class="p-6 text-gray-400 text-center">Chưa có hoạt động nào</p>';
            }
            return activities.map(a => `
                        <div class="px-6 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                            <div class="w-10 h-10 rounded-full ${a.action === 'CREATE' ? 'bg-green-100 text-green-600' : a.action === 'UPDATE' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'} flex items-center justify-center flex-shrink-0">
                                <span class="material-icons-round">${a.action === 'CREATE' ? 'add' : a.action === 'UPDATE' ? 'edit' : 'delete'}</span>
                            </div>
                            <div class="flex-1">
                                <h4 class="text-sm font-semibold text-gray-900">${a.action === 'CREATE' ? 'Tạo mới' : a.action === 'UPDATE' ? 'Cập nhật' : 'Xóa'}</h4>
                                <p class="text-xs text-gray-500 mt-0.5">${a.details}</p>
                            </div>
                            <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">${formatDateTime(a.timestamp)}</span>
                        </div>
                    `).join('');
        })()}
                </div>
            </div>
        </div>
    `;

    // Initialize Sales Chart
    setTimeout(() => {
        const ctxSales = document.getElementById('shopSalesChart');
        if (ctxSales) {
            const soldCount = item.soldCount || 0;
            // Simulate weekly distribution from soldCount
            const weekData = [];
            const weeks = 4;
            let remaining = soldCount;
            for (let i = 0; i < weeks; i++) {
                const portion = i < weeks - 1 ? Math.round(remaining * (0.15 + Math.random() * 0.3)) : remaining;
                weekData.push(portion);
                remaining -= portion;
                if (remaining < 0) remaining = 0;
            }

            new Chart(ctxSales, {
                type: 'bar',
                data: {
                    labels: ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4'],
                    datasets: [{
                        label: 'Số lượng bán',
                        data: weekData,
                        backgroundColor: ['rgba(16,185,129,0.2)', 'rgba(16,185,129,0.35)', 'rgba(16,185,129,0.5)', 'rgba(16,185,129,0.8)'],
                        borderColor: '#10b981',
                        borderWidth: 1,
                        borderRadius: 4,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1f2937', titleColor: '#f9fafb', bodyColor: '#f9fafb', padding: 8, cornerRadius: 6, displayColors: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(107,114,128,0.1)', drawBorder: false }, ticks: { color: '#9ca3af', font: { size: 11 } } },
                        x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 11 } } }
                    }
                }
            });
        }
    }, 100);

    gsap.fromTo('#main-content .max-w-7xl > *', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 });
}

// ============ ANIMAL DETAIL VIEW ============
async function showAnimalDetail(id) {
    const animal = animalsData.find(a => a.id === id) || await fetchAPI(`${API_BASE_URL}/admin/animals/${id}`);
    if (!animal) return;

    // Fetch related data in parallel
    const [vaccinations, feedCompat] = await Promise.all([
        fetchAPI(`${API_BASE_URL}/admin/animals/${id}/vaccinations`).catch(() => []),
        fetchAPI(`${API_BASE_URL}/admin/animals/${id}/feed-compatibility`).catch(() => [])
    ]);
    const vaccinationList = vaccinations || [];
    const feedList = feedCompat || [];

    // Parse JSON fields
    const sizes = (() => { try { return typeof animal.sizes === 'string' ? JSON.parse(animal.sizes) : (animal.sizes || null); } catch { return null; } })();
    const farmingTypes = (() => { try { return typeof animal.farmingTypes === 'string' ? JSON.parse(animal.farmingTypes) : (animal.farmingTypes || []); } catch { return []; } })();

    // Category labels
    const categoryLabels = { 'LAND': 'Trên cạn', 'FRESHWATER': 'Nước ngọt', 'BRACKISH': 'Nước lợ', 'SALTWATER': 'Nước mặn', 'SPECIAL': 'Đặc biệt' };
    const categoryIcons = { 'LAND': 'terrain', 'FRESHWATER': 'water_drop', 'BRACKISH': 'waves', 'SALTWATER': 'sailing', 'SPECIAL': 'star' };
    const categoryColors = { 'LAND': 'amber', 'FRESHWATER': 'blue', 'BRACKISH': 'teal', 'SALTWATER': 'indigo', 'SPECIAL': 'purple' };
    const catColor = categoryColors[animal.category] || 'blue';
    const catIcon = categoryIcons[animal.category] || 'pets';

    document.getElementById('page-title').innerHTML = `
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <a onclick="loadAnimals()" class="hover:text-emerald-600 cursor-pointer transition-colors">Vật nuôi</a>
            <span class="material-icons-round text-base">chevron_right</span>
            <span class="text-gray-800 font-medium">${animal.name}</span>
        </div>
        <h2 class="text-2xl font-bold text-gray-800">Chi tiết Vật nuôi</h2>
    `;

    document.getElementById('main-content').innerHTML = `
        <div class="max-w-7xl mx-auto space-y-6">
            <!-- Header Card -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div class="flex items-center gap-6">
                        <div class="w-20 h-20 rounded-full bg-${catColor}-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            ${animal.imageUrl
            ? `<img src="${animal.imageUrl}" alt="${animal.name}" class="w-full h-full object-cover">`
            : `<span class="material-icons-round text-4xl text-${catColor}-500">${catIcon}</span>`
        }
                        </div>
                        <div>
                            <div class="flex items-center gap-3 mb-1">
                                <h1 class="text-2xl font-bold text-gray-900">${animal.name}</h1>
                                <span class="px-3 py-1 bg-${catColor}-100 text-${catColor}-700 text-xs font-semibold rounded-full border border-${catColor}-200 flex items-center gap-1">
                                    <span class="w-1.5 h-1.5 rounded-full bg-${catColor}-500"></span>
                                    ${categoryLabels[animal.category] || animal.category || 'N/A'}
                                </span>
                            </div>
                            <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                <span class="flex items-center gap-1.5">
                                    <span class="material-icons-round text-lg">tag</span>
                                    ID: #${String(animal.id).padStart(4, '0')}
                                </span>
                                ${animal.waterType ? `
                                <span class="w-1 h-1 rounded-full bg-gray-300"></span>
                                <span class="flex items-center gap-1.5">
                                    <span class="material-icons-round text-lg">water</span>
                                    ${animal.waterType}
                                </span>` : ''}
                                ${animal.spacePerUnitSqm ? `
                                <span class="w-1 h-1 rounded-full bg-gray-300"></span>
                                <span class="flex items-center gap-1.5">
                                    <span class="material-icons-round text-lg">square_foot</span>
                                    ${animal.spacePerUnitSqm} m²/con
                                </span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 w-full md:w-auto">
                        <button onclick="loadAnimals()" class="flex-1 md:flex-none items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium flex gap-2">
                            <span class="material-icons-round">arrow_back</span> Quay lại
                        </button>
                        <button onclick="showAnimalModal(${animal.id})" class="flex-1 md:flex-none items-center justify-center px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium flex gap-2 shadow-sm">
                            <span class="material-icons-round">edit</span> Chỉnh sửa
                        </button>
                    </div>
                </div>
            </div>

            <!-- Main Content Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Left Column (2/3) -->
                <div class="lg:col-span-2 space-y-6">
                    <!-- Stat Cards -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                            <div class="flex items-center gap-3 mb-2">
                                <div class="p-2 bg-green-50 rounded-lg text-green-500">
                                    <span class="material-icons-round">schedule</span>
                                </div>
                                <span class="text-sm font-medium text-gray-500">Thời gian nuôi</span>
                            </div>
                            <div class="flex items-end gap-2">
                                <span class="text-2xl font-bold text-gray-900">${animal.growthDurationDays || '-'}</span>
                                <span class="text-sm text-gray-500 mb-1">ngày</span>
                            </div>
                        </div>
                        <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                            <div class="flex items-center gap-3 mb-2">
                                <div class="p-2 bg-red-50 rounded-lg text-red-500">
                                    <span class="material-icons-round">sell</span>
                                </div>
                                <span class="text-sm font-medium text-gray-500">Giá mua</span>
                            </div>
                            <div class="flex items-end gap-2">
                                <span class="text-2xl font-bold text-gray-900">${formatCurrency(animal.buyPricePerUnit)}</span>
                            </div>
                            <div class="mt-1 text-xs text-gray-400">/ con</div>
                        </div>
                        <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                            <div class="flex items-center gap-3 mb-2">
                                <div class="p-2 bg-emerald-50 rounded-lg text-emerald-500">
                                    <span class="material-icons-round">monetization_on</span>
                                </div>
                                <span class="text-sm font-medium text-gray-500">Giá bán</span>
                            </div>
                            <div class="flex items-end gap-2">
                                <span class="text-2xl font-bold text-emerald-600">${formatCurrency(animal.sellPricePerUnit)}</span>
                            </div>
                            <div class="mt-1 text-xs text-green-600 flex items-center">
                                <span class="material-icons-round text-sm mr-1">trending_up</span>
                                Lợi nhuận: ${formatCurrency((animal.sellPricePerUnit || 0) - (animal.buyPricePerUnit || 0))}
                            </div>
                        </div>
                    </div>

                    <!-- Weight/Size Chart -->
                    ${sizes ? `
                    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <div class="flex items-center justify-between mb-6">
                            <h3 class="text-lg font-bold text-gray-900">Phân loại Kích cỡ</h3>
                        </div>
                        <div class="relative h-64 w-full">
                            <canvas id="animalSizeChart"></canvas>
                        </div>
                    </div>
                    ` : ''}

                    <!-- Vaccination Schedule -->
                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div class="p-6 border-b border-gray-200 flex justify-between items-center">
                            <h3 class="text-lg font-bold text-gray-900">Lịch tiêm phòng</h3>
                            <span class="text-sm text-gray-500">${vaccinationList.length} lịch trình</span>
                        </div>
                        <div class="divide-y divide-gray-200">
                            ${vaccinationList.length > 0 ? vaccinationList.slice(0, 6).map((v, idx) => {
            const vColors = ['green', 'blue', 'yellow', 'purple', 'orange', 'red'];
            const vc = vColors[idx % vColors.length];
            return `
                                <div class="p-4 hover:bg-gray-50 transition-colors">
                                    <div class="flex items-start gap-4">
                                        <div class="w-10 h-10 rounded-full bg-${vc}-100 flex items-center justify-center flex-shrink-0 text-${vc}-600">
                                            <span class="material-icons-round">vaccines</span>
                                        </div>
                                        <div class="flex-1">
                                            <div class="flex justify-between items-start">
                                                <div>
                                                    <h4 class="text-sm font-semibold text-gray-900">${v.vaccineName || 'Vaccine'}</h4>
                                                    <p class="text-xs text-gray-500 mt-0.5">${v.description || v.notes || ''}</p>
                                                </div>
                                                <div class="text-right">
                                                    <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Ngày ${v.dayNumber || v.ageInDays || '-'}</span>
                                                    ${v.repeatIntervalDays ? `<p class="text-xs text-blue-500 mt-1">Lặp lại: ${v.repeatIntervalDays} ngày</p>` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
        }).join('') : '<p class="p-6 text-gray-400 text-center">Chưa có lịch tiêm phòng</p>'}
                        </div>
                    </div>
                </div>

                <!-- Right Column (1/3) -->
                <div class="lg:col-span-1 space-y-6">
                    <!-- Farming Types & Info -->
                    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 class="text-lg font-bold text-gray-900 mb-4">Thông tin chăn nuôi</h3>
                        <div class="space-y-4">
                            ${animal.description ? `
                            <div class="p-3 bg-gray-50 rounded-lg">
                                <p class="text-sm text-gray-600 leading-relaxed">${animal.description}</p>
                            </div>` : ''}
                            
                            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div class="flex items-center gap-3">
                                    <div class="text-gray-400"><span class="material-icons-round">category</span></div>
                                    <span class="text-sm font-medium text-gray-700">Phân loại</span>
                                </div>
                                <span class="text-sm font-bold text-gray-900">${categoryLabels[animal.category] || animal.category || '-'}</span>
                            </div>
                            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div class="flex items-center gap-3">
                                    <div class="text-gray-400"><span class="material-icons-round">square_foot</span></div>
                                    <span class="text-sm font-medium text-gray-700">Diện tích/con</span>
                                </div>
                                <span class="text-sm font-bold text-gray-900">${animal.spacePerUnitSqm || '-'} m²</span>
                            </div>
                            ${animal.waterType ? `
                            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div class="flex items-center gap-3">
                                    <div class="text-gray-400"><span class="material-icons-round">water</span></div>
                                    <span class="text-sm font-medium text-gray-700">Loại nước</span>
                                </div>
                                <span class="text-sm font-bold text-gray-900">${animal.waterType}</span>
                            </div>` : ''}
                            ${farmingTypes.length > 0 ? `
                            <div>
                                <p class="text-sm font-medium text-gray-700 mb-2">Hình thức nuôi</p>
                                <div class="flex flex-wrap gap-2">
                                    ${farmingTypes.map(ft => `<span class="px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">${ft}</span>`).join('')}
                                </div>
                            </div>` : ''}
                        </div>
                    </div>

                    <!-- Feed Compatibility -->
                    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 class="text-lg font-bold text-gray-900 mb-4">Thức ăn tương thích</h3>
                        <div class="space-y-3">
                            ${feedList.length > 0 ? feedList.slice(0, 8).map(f => {
            const eff = f.effectiveness || 0;
            const effColor = eff >= 80 ? 'green' : eff >= 50 ? 'yellow' : 'gray';
            return `
                                <div class="flex gap-3 items-start p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                    <span class="material-icons-round text-${effColor}-500 text-xl mt-0.5">restaurant</span>
                                    <div class="flex-1">
                                        <p class="text-sm font-semibold text-gray-900">${f.feedDefinition?.name || f.feedName || 'Thức ăn'}</p>
                                        <div class="flex items-center gap-2 mt-1">
                                            <div class="flex-1 h-1.5 bg-gray-200 rounded-full">
                                                <div class="h-1.5 bg-${effColor}-500 rounded-full" style="width: ${eff}%"></div>
                                            </div>
                                            <span class="text-xs text-gray-500">${eff}%</span>
                                        </div>
                                    </div>
                                </div>
                            `;
        }).join('') : '<p class="text-gray-400 text-sm text-center">Chưa có dữ liệu</p>'}
                        </div>
                    </div>

                    <!-- Activities -->
                    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 class="text-lg font-bold text-gray-900 mb-4">Hoạt động gần đây</h3>
                        <div class="space-y-3">
                            ${(() => {
            const activities = getActivityForEntity('animal', id).slice(0, 3);
            if (activities.length === 0) return '<p class="text-gray-400 text-sm text-center">Chưa có hoạt động</p>';
            return activities.map(a => `
                                <div class="flex gap-3 items-start p-3 border border-gray-200 rounded-lg">
                                    <span class="material-icons-round text-gray-400 text-xl mt-0.5">${a.action === 'CREATE' ? 'add_circle' : a.action === 'UPDATE' ? 'edit' : 'delete'}</span>
                                    <div>
                                        <p class="text-sm font-semibold text-gray-900">${a.action === 'CREATE' ? 'Tạo mới' : a.action === 'UPDATE' ? 'Cập nhật' : 'Xóa'}</p>
                                        <p class="text-xs text-gray-500 mt-1">${formatDateTime(a.timestamp)}</p>
                                    </div>
                                </div>
                            `).join('');
        })()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Initialize Size/Weight Chart if sizes data exists
    setTimeout(() => {
        if (sizes) {
            const ctxSize = document.getElementById('animalSizeChart');
            if (ctxSize) {
                // sizes can be an array of {label, minWeight, maxWeight} or {size, weight} etc.
                let labels = [];
                let minData = [];
                let maxData = [];

                if (Array.isArray(sizes)) {
                    sizes.forEach(s => {
                        labels.push(s.label || s.size || s.name || 'N/A');
                        minData.push(s.minWeight || s.min || 0);
                        maxData.push(s.maxWeight || s.max || s.weight || 0);
                    });
                } else if (typeof sizes === 'object') {
                    Object.entries(sizes).forEach(([key, val]) => {
                        labels.push(key);
                        if (typeof val === 'object') {
                            minData.push(val.minWeight || val.min || 0);
                            maxData.push(val.maxWeight || val.max || 0);
                        } else {
                            minData.push(0);
                            maxData.push(val);
                        }
                    });
                }

                new Chart(ctxSize, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Min (kg)',
                                data: minData,
                                backgroundColor: 'rgba(16, 185, 129, 0.3)',
                                borderColor: '#10b981',
                                borderWidth: 1,
                                borderRadius: 4,
                            },
                            {
                                label: 'Max (kg)',
                                data: maxData,
                                backgroundColor: 'rgba(16, 185, 129, 0.7)',
                                borderColor: '#059669',
                                borderWidth: 1,
                                borderRadius: 4,
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, font: { size: 11 } } },
                            tooltip: { backgroundColor: '#1f2937', titleColor: '#f9fafb', bodyColor: '#f9fafb', padding: 10, cornerRadius: 8 }
                        },
                        scales: {
                            y: { beginAtZero: true, grid: { color: 'rgba(107,114,128,0.1)', drawBorder: false }, ticks: { color: '#9ca3af', callback: v => v + ' kg' } },
                            x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 11 } } }
                        }
                    }
                });
            }
        }
    }, 100);

    gsap.fromTo('#main-content .max-w-7xl > *', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 });
}

// ============ ACTIVITY LOG HELPERS ============
function getActivityForEntity(entity, id) {
    return activityLog.filter(a => a.entity === entity && a.details?.includes(String(id)));
}

function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// ============ SHOW ACTIVITY LOG PAGE ============
function showActivityLog() {
    document.getElementById('page-title').textContent = 'Lịch sử hoạt động';

    document.getElementById('main-content').innerHTML = `
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div class="p-4 border-b border-gray-100 flex justify-between items-center">
                <h3 class="font-bold text-gray-800">Hoạt động gần đây</h3>
                <button onclick="clearActivityLog()" class="text-sm text-red-500 hover:text-red-600">Xóa tất cả</button>
            </div>
            <div class="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                ${activityLog.length ? activityLog.map(a => `
                    <div class="px-6 py-4 flex items-start gap-4 hover:bg-gray-50">
                        <div class="w-10 h-10 rounded-full ${a.action === 'CREATE' ? 'bg-green-100 text-green-600' : a.action === 'UPDATE' ? 'bg-blue-100 text-blue-600' : a.action === 'DELETE' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'} flex items-center justify-center">
                            <span class="material-icons-round">${a.action === 'CREATE' ? 'add' : a.action === 'UPDATE' ? 'edit' : a.action === 'DELETE' ? 'delete' : 'download'}</span>
                        </div>
                        <div class="flex-1">
                            <p class="font-medium text-gray-800">${a.action === 'EXPORT' ? 'Xuất dữ liệu' : a.action === 'CREATE' ? 'Tạo mới' : a.action === 'UPDATE' ? 'Cập nhật' : 'Xóa'} - ${a.entity}</p>
                            <p class="text-sm text-gray-500">${a.details}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-sm text-gray-400">${formatDateTime(a.timestamp)}</p>
                            <p class="text-xs text-gray-400">${a.user}</p>
                        </div>
                    </div>
                `).join('') : '<p class="p-6 text-gray-400 text-center">Chưa có hoạt động nào</p>'}
            </div>
        </div>
    `;
}

function clearActivityLog() {
    if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử hoạt động?')) {
        activityLog = [];
        localStorage.setItem('adminActivityLog', '[]');
        showActivityLog();
    }
}

// ============ ORDERS MANAGEMENT ============
let ordersData = [];
let orderStatusFilter = '';

async function loadOrders() {
    document.getElementById('page-title').textContent = 'Quản lý Đơn hàng';

    // Load stats
    const stats = await fetchAPI(`${API_BASE_URL}/admin/orders/stats`);

    // Load orders
    const url = orderStatusFilter
        ? `${API_BASE_URL}/admin/orders?status=${orderStatusFilter}`
        : `${API_BASE_URL}/admin/orders`;
    ordersData = await fetchAPI(url) || [];

    document.getElementById('main-content').innerHTML = `
        <div class="space-y-6">
            <!-- Stats Cards -->
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                    <p class="text-2xl font-bold text-gray-800">${stats?.total || 0}</p>
                    <p class="text-sm text-gray-500">Tổng đơn</p>
                </div>
                <div class="bg-yellow-50 rounded-xl p-4 shadow-sm border border-yellow-100 text-center">
                    <p class="text-2xl font-bold text-yellow-600">${stats?.pending || 0}</p>
                    <p class="text-sm text-yellow-600">Chờ xử lý</p>
                </div>
                <div class="bg-blue-50 rounded-xl p-4 shadow-sm border border-blue-100 text-center">
                    <p class="text-2xl font-bold text-blue-600">${stats?.shipping || 0}</p>
                    <p class="text-sm text-blue-600">Đang giao</p>
                </div>
                <div class="bg-green-50 rounded-xl p-4 shadow-sm border border-green-100 text-center">
                    <p class="text-2xl font-bold text-green-600">${stats?.delivered || 0}</p>
                    <p class="text-sm text-green-600">Đã giao</p>
                </div>
                <div class="bg-primary/10 rounded-xl p-4 shadow-sm border border-primary/20 text-center">
                    <p class="text-xl font-bold text-primary">${formatCurrency(stats?.totalRevenue || 0)}</p>
                    <p class="text-sm text-primary">Doanh thu</p>
                </div>
            </div>
            
            <!-- Filter Tabs & Export -->
            <div class="flex justify-between items-center">
                <div class="flex gap-2">
                    <button onclick="filterOrders('')" class="px-4 py-2 rounded-lg text-sm font-medium ${!orderStatusFilter ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">Tất cả</button>
                    <button onclick="filterOrders('PENDING')" class="px-4 py-2 rounded-lg text-sm font-medium ${orderStatusFilter === 'PENDING' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">Chờ xử lý</button>
                    <button onclick="filterOrders('PROCESSING')" class="px-4 py-2 rounded-lg text-sm font-medium ${orderStatusFilter === 'PROCESSING' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">Đang xử lý</button>
                    <button onclick="filterOrders('SHIPPING')" class="px-4 py-2 rounded-lg text-sm font-medium ${orderStatusFilter === 'SHIPPING' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">Đang giao</button>
                    <button onclick="filterOrders('DELIVERED')" class="px-4 py-2 rounded-lg text-sm font-medium ${orderStatusFilter === 'DELIVERED' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">Đã giao</button>
                </div>
                <button onclick="exportOrdersCSV()" class="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium">
                    <span class="material-icons-round text-sm">download</span> Xuất CSV
                </button>
            </div>
            
            <!-- Orders Table -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table class="w-full">
                    <thead class="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Mã đơn</th>
                            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Khách hàng</th>
                            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Loại</th>
                            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Tổng tiền</th>
                            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Trạng thái</th>
                            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Ngày tạo</th>
                            <th class="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody id="orders-table-body">
                        ${renderOrdersTableBody(ordersData)}
                    </tbody>
                </table>
                ${ordersData.length === 0 ? '<p class="p-8 text-center text-gray-400">Không có đơn hàng nào</p>' : ''}
            </div>
        </div>
    `;

    gsap.fromTo('#main-content > div > *', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 });
}

function renderOrdersTableBody(orders) {
    return orders.map(o => `
        <tr class="table-row border-b border-gray-50 cursor-pointer" onclick="showOrderDetail(${o.id})">
            <td class="px-6 py-4">
                <span class="font-mono text-sm font-medium text-gray-800">${o.orderCode || '-'}</span>
            </td>
            <td class="px-6 py-4">
                <p class="font-medium text-gray-800">${o.userName || 'N/A'}</p>
                <p class="text-xs text-gray-400">${o.userEmail || ''}</p>
            </td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${o.purchaseType === 'WEBSITE_ORDER' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}">
                    ${o.purchaseType === 'WEBSITE_ORDER' ? 'Website' : 'Tự mua'}
                </span>
            </td>
            <td class="px-6 py-4 font-medium text-gray-800">${formatCurrency(o.totalAmount)}</td>
            <td class="px-6 py-4">${getOrderStatusBadge(o.status)}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${formatDateTime(o.createdAt)}</td>
            <td class="px-6 py-4 text-right">
                <button onclick="event.stopPropagation(); showOrderDetail(${o.id})" class="p-2 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-50">
                    <span class="material-icons-round text-sm">visibility</span>
                </button>
            </td>
        </tr>
    `).join('');
}

function getOrderStatusBadge(status) {
    const badges = {
        'PENDING': '<span class="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Chờ xử lý</span>',
        'PROCESSING': '<span class="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Đang xử lý</span>',
        'SHIPPING': '<span class="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Đang giao</span>',
        'DELIVERED': '<span class="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Đã giao</span>',
        'CANCELLED': '<span class="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Đã hủy</span>'
    };
    return badges[status] || status;
}

function filterOrders(status) {
    orderStatusFilter = status;
    loadOrders();
}

async function showOrderDetail(id) {
    const order = await fetchAPI(`${API_BASE_URL}/admin/orders/${id}`);
    if (!order) return;

    document.getElementById('modal-container').innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
            <div class="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onclick="closeModal()"></div>
            <div class="relative bg-white w-full max-w-3xl rounded-2xl shadow-2xl modal-content max-h-[90vh] overflow-hidden flex flex-col">
                <div class="px-8 py-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-primary to-primary-dark text-white rounded-t-2xl">
                    <div>
                        <h3 class="text-xl font-bold">Đơn hàng ${order.orderCode}</h3>
                        <p class="text-sm text-white/80">${formatDateTime(order.createdAt)}</p>
                    </div>
                    <button onclick="closeModal()" class="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/10">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                
                <div class="p-8 overflow-y-auto space-y-6">
                    <!-- Status & Actions -->
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <span class="text-gray-600">Trạng thái:</span>
                            ${getOrderStatusBadge(order.status)}
                        </div>
                        ${order.purchaseType === 'WEBSITE_ORDER' && order.status !== 'DELIVERED' && order.status !== 'CANCELLED' ? `
                        <div class="flex gap-2">
                            ${order.status === 'PENDING' ? `<button onclick="updateOrderStatus(${order.id}, 'PROCESSING')" class="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">Xử lý</button>` : ''}
                            ${order.status === 'PROCESSING' ? `<button onclick="updateOrderStatus(${order.id}, 'SHIPPING')" class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600">Bắt đầu giao</button>` : ''}
                            ${order.status === 'SHIPPING' ? `<button onclick="updateOrderStatus(${order.id}, 'DELIVERED')" class="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600">Hoàn thành</button>` : ''}
                        </div>
                        ` : ''}
                    </div>
                    
                    <!-- Order Info -->
                    <div class="grid grid-cols-2 gap-6">
                        <div class="bg-gray-50 rounded-xl p-4">
                            <h4 class="font-semibold text-gray-800 mb-3">Thông tin đơn</h4>
                            <div class="space-y-2 text-sm">
                                <div class="flex justify-between"><span class="text-gray-500">Loại:</span><span class="font-medium">${order.purchaseType === 'WEBSITE_ORDER' ? 'Đặt qua website' : 'Tự mua'}</span></div>
                                <div class="flex justify-between"><span class="text-gray-500">Thanh toán:</span><span class="font-medium">${order.paymentMethod === 'PAY_NOW' ? 'Đã thanh toán' : 'Khi nhận hàng'}</span></div>
                                <div class="flex justify-between"><span class="text-gray-500">Vận chuyển:</span><span class="font-medium">${order.shippingType || '-'}</span></div>
                                <div class="flex justify-between"><span class="text-gray-500">Phí ship:</span><span class="font-medium">${formatCurrency(order.shippingFee || 0)}</span></div>
                            </div>
                        </div>
                        <div class="bg-gray-50 rounded-xl p-4">
                            <h4 class="font-semibold text-gray-800 mb-3">Khách hàng</h4>
                            <div class="space-y-2 text-sm">
                                <div class="flex justify-between"><span class="text-gray-500">Tên:</span><span class="font-medium">${order.user?.fullName || '-'}</span></div>
                                <div class="flex justify-between"><span class="text-gray-500">Email:</span><span class="font-medium">${order.user?.email || '-'}</span></div>
                                <div class="flex justify-between"><span class="text-gray-500">Địa chỉ:</span><span class="font-medium text-right max-w-[200px] truncate">${order.shippingAddressText || '-'}</span></div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Order Items -->
                    <div>
                        <h4 class="font-semibold text-gray-800 mb-3">Sản phẩm</h4>
                        <div class="bg-gray-50 rounded-xl overflow-hidden">
                            <table class="w-full">
                                <thead class="bg-gray-100">
                                    <tr>
                                        <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">Sản phẩm</th>
                                        <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500">SL</th>
                                        <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500">Đơn giá</th>
                                        <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500">Thành tiền</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(order.items || []).map(item => `
                                        <tr class="border-t border-gray-100">
                                            <td class="px-4 py-3 text-sm font-medium text-gray-800">${item.shopItem?.name || 'N/A'}</td>
                                            <td class="px-4 py-3 text-sm text-center text-gray-600">${item.quantity}</td>
                                            <td class="px-4 py-3 text-sm text-right text-gray-600">${formatCurrency(item.unitPrice)}</td>
                                            <td class="px-4 py-3 text-sm text-right font-medium text-gray-800">${formatCurrency(item.totalPrice)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <!-- Total -->
                    <div class="bg-primary/5 rounded-xl p-4 flex justify-between items-center">
                        <span class="text-lg font-semibold text-gray-800">Tổng cộng</span>
                        <span class="text-2xl font-bold text-primary">${formatCurrency(order.totalAmount)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    animateModalOpen();
}

async function updateOrderStatus(orderId, newStatus) {
    await fetchAPI(`${API_BASE_URL}/admin/orders/${orderId}/status`, 'PUT', { status: newStatus });
    closeModal();
    loadOrders();
    logActivity('UPDATE', 'order', `Cập nhật trạng thái đơn #${orderId} → ${newStatus}`);
}

function exportOrdersCSV() {
    const columns = [
        { key: 'orderCode', label: 'Mã đơn' },
        { key: 'userName', label: 'Khách hàng' },
        { key: 'purchaseType', label: 'Loại' },
        { key: 'totalAmount', label: 'Tổng tiền' },
        { key: 'status', label: 'Trạng thái' },
        { key: 'paymentMethod', label: 'Thanh toán' },
        { key: 'createdAt', label: 'Ngày tạo' }
    ];
    exportToCSV(ordersData, 'donhang_export.csv', columns);
}

// ============ STORE CONFIG ============
async function loadStoreConfig() {
    document.getElementById('page-title').textContent = 'Cài đặt Cửa hàng';

    const config = await fetchAPI(`${API_BASE_URL}/admin/store-config`);

    document.getElementById('main-content').innerHTML = `
        <div class="max-w-4xl space-y-6">
            <button onclick="loadShopItems()" class="flex items-center gap-2 text-gray-600 hover:text-primary transition-colors mb-4">
                <span class="material-icons-round">arrow_back</span>
                <span class="font-medium">Quay lại Sản phẩm</span>
            </button>
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                <h3 class="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <span class="material-icons-round text-primary">store</span>
                    Thông tin cửa hàng
                </h3>
                
                <form id="store-config-form" class="space-y-6">
                    <div class="grid grid-cols-2 gap-6">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Tên cửa hàng</label>
                            <input type="text" name="storeName" value="${config?.storeName || ''}" 
                                class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                            <input type="email" name="email" value="${config?.email || ''}" 
                                class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary">
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-6">
                        <div class="col-span-2">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Địa chỉ đầy đủ</label>
                            <input type="text" name="address" value="${config?.address || ''}" 
                                class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                placeholder="VD: 165C Linh Trung, Thủ Đức, TP.HCM">
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-3 gap-6">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Điện thoại</label>
                            <input type="text" name="phone" value="${config?.phone || ''}" 
                                class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Vĩ độ (Latitude)</label>
                            <input type="number" step="0.000001" name="latitude" value="${config?.latitude || 10.87}" 
                                class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Kinh độ (Longitude)</label>
                            <input type="number" step="0.000001" name="longitude" value="${config?.longitude || 106.80}" 
                                class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary">
                        </div>
                    </div>
                    
                    <div class="pt-4 border-t border-gray-100 flex justify-end">
                        <button type="submit" class="px-6 py-3 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg flex items-center gap-2">
                            <span class="material-icons-round text-sm">save</span> Lưu thay đổi
                        </button>
                    </div>
                </form>
            </div>
            
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                <h3 class="text-lg font-bold text-gray-800 mb-4">Vị trí trên bản đồ</h3>
                <div id="store-map" class="w-full h-80 rounded-xl bg-gray-100 flex items-center justify-center">
                    <p class="text-gray-400">Bản đồ sẽ hiển thị khi có Leaflet</p>
                </div>
                <p class="text-sm text-gray-500 mt-3">📍 Tọa độ hiện tại: ${config?.latitude || '-'}, ${config?.longitude || '-'}</p>
            </div>
        </div>
    `;

    // Form submit handler
    document.getElementById('store-config-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const data = {
            storeName: form.storeName.value,
            address: form.address.value,
            phone: form.phone.value,
            email: form.email.value,
            latitude: parseFloat(form.latitude.value),
            longitude: parseFloat(form.longitude.value)
        };

        await fetchAPI(`${API_BASE_URL}/admin/store-config`, 'PUT', data);
        alert('Đã lưu cấu hình cửa hàng!');
        logActivity('UPDATE', 'store-config', `Cập nhật vị trí cửa hàng: ${data.address}`);
    });

    // Initialize Leaflet map
    setTimeout(() => {
        const mapContainer = document.getElementById('store-map');
        if (mapContainer && typeof L !== 'undefined') {
            mapContainer.innerHTML = ''; // Clear placeholder text

            const lat = config?.latitude || 10.87;
            const lng = config?.longitude || 106.80;

            const storeMap = L.map('store-map').setView([lat, lng], 15);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(storeMap);

            // Add marker
            let marker = L.marker([lat, lng], { draggable: true }).addTo(storeMap);
            marker.bindPopup('Vị trí cửa hàng').openPopup();

            // Click on map to update location
            storeMap.on('click', function (e) {
                const { lat, lng } = e.latlng;
                marker.setLatLng([lat, lng]);
                document.querySelector('input[name="latitude"]').value = lat.toFixed(6);
                document.querySelector('input[name="longitude"]').value = lng.toFixed(6);
            });

            // Drag marker to update location
            marker.on('dragend', function (e) {
                const pos = e.target.getLatLng();
                document.querySelector('input[name="latitude"]').value = pos.lat.toFixed(6);
                document.querySelector('input[name="longitude"]').value = pos.lng.toFixed(6);
            });
        }
    }, 100);

    gsap.fromTo('#main-content > div > *', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 });
}

// ============ PRICE ANALYSIS ============
let priceAnalysisData = [];

async function loadPriceAnalysis() {
    document.getElementById('page-title').textContent = 'Phân tích Giá Thị trường';

    priceAnalysisData = await fetchAPI(`${API_BASE_URL}/admin/price-analysis`) || [];
    const marketPrices = await fetchAPI(`${API_BASE_URL}/admin/market-prices`) || [];

    // Calculate summary stats
    const totalReports = marketPrices.length;
    const itemsTracked = new Set(marketPrices.map(p => p.shopItem?.id)).size;
    const avgDiff = priceAnalysisData.length > 0
        ? priceAnalysisData.reduce((sum, p) => sum + parseFloat(p.priceDiffPercent || 0), 0) / priceAnalysisData.length
        : 0;
    const needsAttention = priceAnalysisData.filter(p => p.recommendation).length;

    document.getElementById('main-content').innerHTML = `
        <div class="space-y-6">
            <!-- Stats Cards -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center">
                    <span class="material-icons-round text-3xl text-blue-500 mb-2">receipt_long</span>
                    <p class="text-2xl font-bold text-gray-800">${totalReports}</p>
                    <p class="text-sm text-gray-500">Báo cáo giá</p>
                </div>
                <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center">
                    <span class="material-icons-round text-3xl text-green-500 mb-2">inventory_2</span>
                    <p class="text-2xl font-bold text-gray-800">${itemsTracked}</p>
                    <p class="text-sm text-gray-500">Sản phẩm theo dõi</p>
                </div>
                <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center">
                    <span class="material-icons-round text-3xl ${avgDiff > 0 ? 'text-red-500' : 'text-green-500'} mb-2">trending_${avgDiff > 0 ? 'up' : 'down'}</span>
                    <p class="text-2xl font-bold ${avgDiff > 0 ? 'text-red-600' : 'text-green-600'}">${avgDiff > 0 ? '+' : ''}${avgDiff.toFixed(1)}%</p>
                    <p class="text-sm text-gray-500">Chênh lệch TB</p>
                </div>
                <div class="bg-yellow-50 rounded-xl p-5 shadow-sm border border-yellow-200 text-center">
                    <span class="material-icons-round text-3xl text-yellow-600 mb-2">warning</span>
                    <p class="text-2xl font-bold text-yellow-700">${needsAttention}</p>
                    <p class="text-sm text-yellow-600">Cần điều chỉnh</p>
                </div>
            </div>
            
            <!-- Recommendations -->
            ${needsAttention > 0 ? `
            <div class="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200">
                <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span class="material-icons-round text-yellow-600">lightbulb</span>
                    Khuyến nghị điều chỉnh giá
                </h3>
                <div class="space-y-3">
                    ${priceAnalysisData.filter(p => p.recommendation).slice(0, 5).map(p => `
                        <div class="bg-white rounded-lg p-4 flex justify-between items-center shadow-sm">
                            <div>
                                <p class="font-medium text-gray-800">${p.itemName}</p>
                                <p class="text-sm text-gray-500">Website: ${formatCurrency(p.websitePrice)} | Thị trường: ${formatCurrency(p.avgMarketPrice)}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-sm ${p.priceDiffPercent > 0 ? 'text-red-600' : 'text-green-600'} font-medium">${p.priceDiffPercent > 0 ? '+' : ''}${parseFloat(p.priceDiffPercent).toFixed(1)}%</p>
                                ${p.suggestedPrice ? `<p class="text-xs text-gray-500">Đề xuất: ${formatCurrency(p.suggestedPrice)}</p>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : '<div class="bg-green-50 rounded-xl p-6 border border-green-200 text-center"><span class="material-icons-round text-green-500 text-4xl">check_circle</span><p class="mt-2 text-green-700 font-medium">Giá website đang cạnh tranh tốt!</p></div>'}
            
            <!-- Full Analysis Table -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 class="font-bold text-gray-800">Chi tiết phân tích</h3>
                </div>
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Sản phẩm</th>
                            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Danh mục</th>
                            <th class="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Giá Website</th>
                            <th class="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Giá TT (TB)</th>
                            <th class="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Chênh lệch</th>
                            <th class="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase">Báo cáo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${priceAnalysisData.map(p => `
                            <tr class="border-t border-gray-50 hover:bg-gray-50">
                                <td class="px-6 py-4 font-medium text-gray-800">${p.itemName}</td>
                                <td class="px-6 py-4 text-sm text-gray-500">${p.category || '-'}</td>
                                <td class="px-6 py-4 text-right font-medium text-gray-800">${formatCurrency(p.websitePrice)}</td>
                                <td class="px-6 py-4 text-right text-gray-600">${formatCurrency(p.avgMarketPrice)}</td>
                                <td class="px-6 py-4 text-right">
                                    <span class="font-medium ${parseFloat(p.priceDiffPercent) > 5 ? 'text-red-600' : parseFloat(p.priceDiffPercent) < -5 ? 'text-green-600' : 'text-gray-600'}">
                                        ${parseFloat(p.priceDiffPercent) > 0 ? '+' : ''}${parseFloat(p.priceDiffPercent).toFixed(1)}%
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-center text-gray-500">${p.reportCount}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${priceAnalysisData.length === 0 ? '<p class="p-8 text-center text-gray-400">Chưa có dữ liệu phân tích. User cần thực hiện "Tự mua" để hệ thống thu thập giá thị trường.</p>' : ''}
            </div>
        </div>
    `;

    gsap.fromTo('#main-content > div > *', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 });
}

// ============ COOPERATIVES ============
let cooperativesData = [];
let groupBuySessions = [];
let groupSellSessions = [];
let pendingCooperatives = [];
let dissolutionRequests = [];

async function loadCooperatives() {
    document.getElementById('page-title').textContent = 'Quản lý Hợp tác xã';

    try {
        // Load all data in parallel
        const [pendingRes, allRes, dissolutionRes, buyRes, sellRes] = await Promise.all([
            fetchAPI('/cooperatives/admin/pending'),
            fetchAPI('/cooperatives/admin/all'),
            loadDissolutionRequests(),
            fetchAPI('/admin/trading/buy-sessions'),
            fetchAPI('/admin/trading/sell-sessions')
        ]);

        pendingCooperatives = pendingRes || [];
        cooperativesData = allRes || [];
        dissolutionRequests = dissolutionRes || [];
        groupBuySessions = buyRes || [];
        groupSellSessions = sellRes || [];

        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `
            <div class="space-y-6">
                <!-- Tab Navigation -->
                <div class="flex gap-2 border-b border-gray-200 bg-white rounded-t-xl px-6">
                    <button class="tab-button active" data-tab="cooperatives" onclick="switchCooperativeTab('cooperatives')">
                        <span class="material-icons-round text-sm">groups</span>
                        <span>Danh sách HTX</span>
                    </button>
                    <button class="tab-button" data-tab="buy" onclick="switchCooperativeTab('buy')">
                        <span class="material-icons-round text-sm">shopping_cart</span>
                        <span>Phiên Gom Mua</span>
                    </button>
                    <button class="tab-button" data-tab="sell" onclick="switchCooperativeTab('sell')">
                        <span class="material-icons-round text-sm">sell</span>
                        <span>Phiên Gom Bán</span>
                    </button>
                </div>

                <!-- Tab Content -->
                <div id="coop-tab-content"></div>
            </div>
        `;

        // Render initial tab
        switchCooperativeTab('cooperatives');
        gsap.fromTo('#main-content > div > *', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 });

    } catch (error) {
        console.error('Error loading cooperatives:', error);
        document.getElementById('main-content').innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
                <span class="material-icons-round text-4xl text-red-400">error</span>
                <p class="text-red-600 mt-2">Không thể tải dữ liệu: ${error.message}</p>
            </div>
        `;
    }
}

function switchCooperativeTab(tabName) {
    // Update button states
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Render appropriate content
    const contentDiv = document.getElementById('coop-tab-content');

    switch (tabName) {
        case 'cooperatives':
            renderCooperativesTab(contentDiv);
            break;
        case 'buy':
            renderBuySessionsTab(contentDiv);
            break;
        case 'sell':
            renderSellSessionsTab(contentDiv);
            break;
    }
}

function renderCooperativesTab(contentDiv) {
    const pending = pendingCooperatives;
    const all = cooperativesData;
    const dissolved = dissolutionRequests;

    contentDiv.innerHTML = `
            <div class="space-y-6">
                <!-- Stats -->
                <div class="grid grid-cols-5 gap-4">
                    <div class="bg-white rounded-xl p-6 shadow-sm border border-emerald-100">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                                <span class="material-icons-round text-amber-600">pending</span>
                            </div>
                            <div>
                                <p class="text-2xl font-bold text-gray-800">${pending.length}</p>
                                <p class="text-sm text-gray-500">Chờ duyệt</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-xl p-6 shadow-sm border border-emerald-100">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                                <span class="material-icons-round text-red-600">delete_forever</span>
                            </div>
                            <div>
                                <p class="text-2xl font-bold text-gray-800">${dissolved.length}</p>
                                <p class="text-sm text-gray-500">Yêu cầu giải thể</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-xl p-6 shadow-sm border border-emerald-100">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <span class="material-icons-round text-emerald-600">check_circle</span>
                            </div>
                            <div>
                                <p class="text-2xl font-bold text-emerald-600">${all.filter(c => c.status === 'APPROVED').length}</p>
                                <p class="text-sm text-gray-500">Đang hoạt động</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-xl p-6 shadow-sm border border-emerald-100">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <span class="material-icons-round text-emerald-600">groups</span>
                            </div>
                            <div>
                                <p class="text-2xl font-bold text-gray-800">${all.reduce((sum, c) => sum + (c.memberCount || 0), 0)}</p>
                                <p class="text-sm text-gray-500">Tổng thành viên</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-xl p-6 shadow-sm border border-emerald-100">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <span class="material-icons-round text-emerald-600">savings</span>
                            </div>
                            <div>
                                <p class="text-2xl font-bold text-emerald-600">${formatCurrency(all.reduce((sum, c) => sum + (c.balance || 0), 0))}</p>
                                <p class="text-sm text-gray-500">Tổng quỹ</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Pending Registrations -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-100">
                    <div class="flex items-center justify-between p-6 border-b border-gray-100">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-800">Đơn đăng ký chờ duyệt</h3>
                            <p class="text-sm text-gray-500 mt-1">Duyệt hoặc từ chối các đơn đăng ký hợp tác xã mới</p>
                        </div>
                    </div>
                    <div id="pending-list">
                        ${pending.length === 0 ? `
                            <div class="p-12 text-center">
                                <span class="material-icons-round text-5xl text-gray-300 mb-3">inbox</span>
                                <p class="text-gray-500">Không có đơn đăng ký nào đang chờ duyệt</p>
                            </div>
                        ` : pending.map(coop => `
                            <div class="p-6 border-b border-gray-50 hover:bg-gray-50 transition-colors" id="pending-${coop.id}">
                                <div class="flex items-start justify-between">
                                    <div class="flex items-start gap-4">
                                        <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-lg">
                                            ${coop.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 class="font-semibold text-gray-800">${coop.name}</h4>
                                            <p class="text-sm text-gray-500">Mã: ${coop.code}</p>
                                            <div class="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                                                <span class="flex items-center gap-1">
                                                    <span class="material-icons-round text-sm">person</span>
                                                    ${coop.leaderName || 'N/A'}
                                                </span>
                                                <span class="flex items-center gap-1">
                                                    <span class="material-icons-round text-sm">phone</span>
                                                    ${coop.leaderPhone || 'N/A'}
                                                </span>
                                                <span class="flex items-center gap-1">
                                                    <span class="material-icons-round text-sm">email</span>
                                                    ${coop.leaderEmail || 'N/A'}
                                                </span>
                                            </div>
                                            ${coop.address ? `<p class="mt-2 text-sm text-gray-500"><span class="material-icons-round text-sm align-middle">location_on</span> ${coop.address}</p>` : ''}
                                            ${coop.description ? `<p class="mt-2 text-sm text-gray-600">${coop.description}</p>` : ''}
                                            <p class="mt-2 text-xs text-gray-400">Số TV dự kiến: ${coop.maxMembers} • Đăng ký: ${new Date(coop.createdAt).toLocaleDateString('vi-VN')}</p>
                                        </div>
                                    </div>
                                    <div class="flex gap-2">
                                        <button onclick="approveCooperative(${coop.id})" 
                                            class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1">
                                            <span class="material-icons-round text-sm">check</span>
                                            Duyệt
                                        </button>
                                        <button onclick="rejectCooperative(${coop.id})"
                                            class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1">
                                            <span class="material-icons-round text-sm">close</span>
                                            Từ chối
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Dissolution Requests -->
                <div class="bg-white rounded-xl shadow-sm border border-red-100" style="display: ${dissolved.length > 0 ? 'block' : 'none'};">
                    <div class="flex items-center justify-between p-6 border-b border-red-100">
                        <div>
                            <h3 class="text-lg font-semibold text-red-600">Yêu cầu giải thể HTX</h3>
                            <p class="text-sm text-gray-500 mt-1">Phê duyệt để giải thể hoặc từ chối yêu cầu</p>
                        </div>
                    </div>
                    <div class="p-4 space-y-3" id="dissolution-list">
                        ${renderDissolutionRequests(dissolved)}
                    </div>
                </div>

                <!-- All Cooperatives -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div class="flex items-center justify-between p-6 border-b border-gray-100">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-800">Danh sách Hợp tác xã</h3>
                            <p class="text-sm text-gray-500 mt-1">Tất cả hợp tác xã đã được đăng ký trong hệ thống</p>
                        </div>
                    </div>
                    <table class="w-full">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">HTX</th>
                                <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Trưởng nhóm</th>
                                <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Thành viên</th>
                                <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Quỹ</th>
                                <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Trạng thái</th>
                                <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Ngày tạo</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            ${all.length === 0 ? `
                                <tr><td colspan="6" class="px-6 py-12 text-center text-gray-400">Chưa có hợp tác xã nào</td></tr>
                            ` : all.map(coop => `
                                <tr class="table-row hover:bg-gray-50">
                                    <td class="px-6 py-4">
                                        <div class="flex items-center gap-3">
                                            <div class="w-10 h-10 rounded-lg flex items-center justify-center text-primary font-bold ${!coop.leaderAvatarUrl ? 'bg-primary/10' : 'bg-gray-100'}" 
                                                style="${coop.leaderAvatarUrl ? `background-image: url('${coop.leaderAvatarUrl}'); background-size: cover; background-position: center;` : ''}">
                                                ${coop.leaderAvatarUrl ? '' : coop.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p class="font-medium text-gray-800">${coop.name}</p>
                                                <p class="text-xs text-gray-500">${coop.code}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4">
                                        <p class="text-sm text-gray-700">${coop.leaderName || 'N/A'}</p>
                                        <p class="text-xs text-gray-500">${coop.leaderEmail || ''}</p>
                                    </td>
                                    <td class="px-6 py-4">
                                        <span class="text-sm font-medium text-gray-700">${coop.memberCount || 0}</span>
                                        <span class="text-xs text-gray-400">/ ${coop.maxMembers}</span>
                                    </td>
                                    <td class="px-6 py-4 text-sm font-medium text-green-600">${formatCurrency(coop.balance || 0)}</td>
                                    <td class="px-6 py-4">
                                        <span class="px-2 py-1 rounded-full text-xs font-medium ${getCoopStatusClass(coop.status)}">
                                            ${getCoopStatusLabel(coop.status)}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-500">${new Date(coop.createdAt).toLocaleDateString('vi-VN')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

    gsap.fromTo('#coop-tab-content > div > *', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 });
}

function renderBuySessionsTab(contentDiv) {
    const buyCount = groupBuySessions.length;
    const openCount = groupBuySessions.filter(s => s.status === 'OPEN').length;
    const completedCount = groupBuySessions.filter(s => s.status === 'COMPLETED' || s.status === 'ORDERED').length;
    const closedCount = groupBuySessions.filter(s => s.status === 'CANCELLED' || s.status === 'EXPIRED').length;

    contentDiv.innerHTML = `
        <div class="space-y-6">
            <!-- Stats -->
            <div class="grid grid-cols-4 gap-4">
                <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span class="material-icons-round text-blue-600">shopping_cart</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-gray-800">${buyCount}</p>
                            <p class="text-sm text-gray-500">Tổng phiên</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                            <span class="material-icons-round text-yellow-600">pending</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-gray-800">${openCount}</p>
                            <p class="text-sm text-gray-500">Đang mở</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                            <span class="material-icons-round text-green-600">check_circle</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-gray-800">${completedCount}</p>
                            <p class="text-sm text-gray-500">Hoàn thành</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                            <span class="material-icons-round text-red-600">cancel</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-gray-800">${closedCount}</p>
                            <p class="text-sm text-gray-500">Đã đóng</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Create Button & List -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-100">
                <div class="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800">Phiên Gom Mua</h3>
                        <p class="text-sm text-gray-500">Admin bán sản phẩm cho HTX với giá ưu đãi</p>
                    </div>
                    <button onclick="showCreateBuySessionModal()" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark flex items-center gap-2">
                        <span class="material-icons-round text-sm">add</span>
                        Tạo phiên mua
                    </button>
                </div>
                <div id="buy-sessions-list" class="divide-y divide-gray-100">
                    ${renderBuySessionsList()}
                </div>
            </div>
        </div>
    `;

    gsap.fromTo('#coop-tab-content > div > *', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 });
}

function renderBuySessionsList() {
    if (groupBuySessions.length === 0) {
        return `
            <div class="p-12 text-center">
                <span class="material-icons-round text-5xl text-gray-300 mb-3">shopping_cart</span>
                <p class="text-gray-500">Chưa có phiên gom mua nào</p>
                <button onclick="showCreateBuySessionModal()" class="mt-4 text-primary hover:underline">Tạo phiên đầu tiên</button>
            </div>
        `;
    }

    return groupBuySessions.map(session => {
        const isCompleted = session.closedReason === 'AUTO_COMPLETED';
        const isForceClosed = session.closedReason === 'ADMIN_FORCED';
        const isOpen = session.status === 'OPEN';
        let borderClass = 'border-l-4 border-gray-200';
        let badge = '';

        if (isCompleted) {
            borderClass = 'border-l-4 border-green-500 bg-green-50';
            badge = '<span class="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium"><span class="material-icons-round text-sm">check_circle</span> Tự đóng</span>';
        } else if (isForceClosed) {
            borderClass = 'border-l-4 border-red-500 bg-red-50';
            badge = '<span class="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium"><span class="material-icons-round text-sm">cancel</span> Đóng cưỡng chế</span>';
        }

        return `
            <div class="p-6 ${borderClass} hover:bg-gray-50 transition-colors">
                <div class="flex justify-between items-start mb-3">
                    <h4 class="font-semibold text-gray-800">${session.title}</h4>
                    ${badge}
                </div>
                <p class="text-sm text-gray-600 mb-4">${session.shopItemName || 'Sản phẩm'}</p>
                <div class="grid grid-cols-3 gap-4 mb-4">
                    <div>
                        <p class="text-xs text-gray-500">Giá bán sỉ</p>
                        <p class="text-lg font-bold text-primary">${formatCurrency(session.wholesalePrice)}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Giá bán lẻ</p>
                        <p class="text-lg font-bold text-gray-700">${formatCurrency(session.retailPrice)}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Tiết kiệm</p>
                        <p class="text-lg font-bold text-green-600">-${session.discountPercent}%</p>
                    </div>
                </div>
                <div class="mb-4">
                    <div class="flex justify-between items-center mb-2">
                        <p class="text-sm font-medium text-gray-600">Tiến độ</p>
                        <p class="text-sm font-bold text-gray-700">${session.currentQuantity}/${session.targetQuantity} (${Math.round(session.progressPercent)}%)</p>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-primary rounded-full h-2" style="width: ${Math.min(session.progressPercent, 100)}%"></div>
                    </div>
                </div>
                ${session.note ? `<p class="text-xs text-gray-500 mb-4">📝 ${session.note}</p>` : ''}
                <div class="flex gap-2">
                    ${isOpen ? `<button onclick="showForceCloseModal('buy', ${session.id}, '${session.title}')" class="px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 text-sm font-medium flex items-center gap-1">
                        <span class="material-icons-round text-sm">block</span>
                        Đóng phiên
                    </button>` : `<span class="text-xs text-gray-500">${session.closedAt ? 'Đóng: ' + new Date(session.closedAt).toLocaleDateString('vi-VN') : ''}</span>`}
                </div>
            </div>
        `;
    }).join('');
}

function renderSellSessionsTab(contentDiv) {
    const sellCount = groupSellSessions.length;
    const openCount = groupSellSessions.filter(s => s.status === 'OPEN').length;
    const readyCount = groupSellSessions.filter(s => s.status === 'READY' || s.status === 'SOLD').length;
    const closedCount = groupSellSessions.filter(s => s.status === 'CANCELLED' || s.status === 'EXPIRED').length;

    contentDiv.innerHTML = `
        <div class="space-y-6">
            <!-- Stats -->
            <div class="grid grid-cols-4 gap-4">
                <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <span class="material-icons-round text-emerald-600">sell</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-gray-800">${sellCount}</p>
                            <p class="text-sm text-gray-500">Tổng phiên</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span class="material-icons-round text-blue-600">pending</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-gray-800">${openCount}</p>
                            <p class="text-sm text-gray-500">Đang thu gom</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                            <span class="material-icons-round text-amber-600">inventory</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-gray-800">${readyCount}</p>
                            <p class="text-sm text-gray-500">Sẵn sàng mua</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                            <span class="material-icons-round text-red-600">cancel</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-gray-800">${closedCount}</p>
                            <p class="text-sm text-gray-500">Đã đóng</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Create Button & List -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-100">
                <div class="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800">Phiên Gom Bán</h3>
                        <p class="text-sm text-gray-500">Admin mua nông sản từ HTX với giá cao hơn thị trường</p>
                    </div>
                    <button onclick="showCreateSellSessionModal()" class="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 flex items-center gap-2">
                        <span class="material-icons-round text-sm">add</span>
                        Tạo phiên bán
                    </button>
                </div>
                <div id="sell-sessions-list" class="divide-y divide-gray-100">
                    ${renderSellSessionsList()}
                </div>
            </div>
        </div>
    `;

    gsap.fromTo('#coop-tab-content > div > *', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 });
}

function renderSellSessionsList() {
    if (groupSellSessions.length === 0) {
        return `
            <div class="p-12 text-center">
                <span class="material-icons-round text-5xl text-gray-300 mb-3">sell</span>
                <p class="text-gray-500">Chưa có phiên gom bán nào</p>
                <button onclick="showCreateSellSessionModal()" class="mt-4 text-emerald-600 hover:underline">Tạo phiên đầu tiên</button>
            </div>
        `;
    }

    return groupSellSessions.map(session => {
        const isCompleted = session.closedReason === 'AUTO_COMPLETED';
        const isForceClosed = session.closedReason === 'ADMIN_FORCED';
        const isOpen = session.status === 'OPEN';
        let borderClass = 'border-l-4 border-gray-200';
        let badge = '';

        if (isCompleted) {
            borderClass = 'border-l-4 border-green-500 bg-green-50';
            badge = '<span class="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium"><span class="material-icons-round text-sm">check_circle</span> Tự đóng</span>';
        } else if (isForceClosed) {
            borderClass = 'border-l-4 border-red-500 bg-red-50';
            badge = '<span class="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium"><span class="material-icons-round text-sm">cancel</span> Đóng cưỡng chế</span>';
        }

        return `
            <div class="p-6 ${borderClass} hover:bg-gray-50 transition-colors">
                <div class="flex justify-between items-start mb-3">
                    <h4 class="font-semibold text-gray-800">${session.productName || session.title}</h4>
                    ${badge}
                </div>
                <p class="text-sm text-gray-600 mb-4">${session.description || 'Nông sản'}</p>
                <div class="grid grid-cols-3 gap-4 mb-4">
                    <div>
                        <p class="text-xs text-gray-500">Giá mua dự kiến</p>
                        <p class="text-lg font-bold text-emerald-600">${formatCurrency(session.targetPrice)}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Giá thị trường</p>
                        <p class="text-lg font-bold text-gray-700">${formatCurrency(session.marketPrice)}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Lợi thế</p>
                        <p class="text-lg font-bold text-green-600">+${session.pricePercent}%</p>
                    </div>
                </div>
                <div class="mb-4">
                    <div class="flex justify-between items-center mb-2">
                        <p class="text-sm font-medium text-gray-600">Tiến độ</p>
                        <p class="text-sm font-bold text-gray-700">${session.currentQuantity}/${session.targetQuantity} (${Math.round(session.progressPercent)}%)</p>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-emerald-500 rounded-full h-2" style="width: ${Math.min(session.progressPercent, 100)}%"></div>
                    </div>
                </div>
                ${session.note ? `<p class="text-xs text-gray-500 mb-4">📝 ${session.note}</p>` : ''}
                <div class="flex gap-2">
                    ${isOpen ? `<button onclick="showForceCloseModal('sell', ${session.id}, '${session.productName || session.title}')" class="px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 text-sm font-medium flex items-center gap-1">
                        <span class="material-icons-round text-sm">block</span>
                        Đóng phiên
                    </button>` : `<span class="text-xs text-gray-500">${session.closedAt ? 'Đóng: ' + new Date(session.closedAt).toLocaleDateString('vi-VN') : ''}</span>`}
                </div>
            </div>
        `;
    }).join('');
}

function getCoopStatusClass(status) {
    const classes = {
        'PENDING': 'bg-yellow-100 text-yellow-700',
        'APPROVED': 'bg-green-100 text-green-700',
        'REJECTED': 'bg-red-100 text-red-700',
        'SUSPENDED': 'bg-gray-100 text-gray-700'
    };
    return classes[status] || 'bg-gray-100 text-gray-700';
}

function getCoopStatusLabel(status) {
    const labels = {
        'PENDING': 'Chờ duyệt',
        'APPROVED': 'Hoạt động',
        'REJECTED': 'Từ chối',
        'SUSPENDED': 'Tạm ngưng'
    };
    return labels[status] || status;
}

// ============ CONFIRMATION MODAL ============
function showConfirmModal({ title, message, confirmText = 'Xác nhận', confirmType = 'primary', onConfirm }) {
    const colors = {
        primary: { bg: 'background-color: #3B82F6;', hover: 'hover:bg-blue-600', text: 'color: #3B82F6;', iconBg: 'background-color: #EFF6FF;', icon: 'check_circle', btnBg: 'background-color: #3B82F6;' },
        danger: { bg: 'background-color: #EF4444;', hover: 'hover:bg-red-600', text: 'color: #EF4444;', iconBg: 'background-color: #FEF2F2;', icon: 'warning', btnBg: 'background-color: #EF4444;' },
        warning: { bg: 'background-color: #F59E0B;', hover: 'hover:bg-yellow-600', text: 'color: #D97706;', iconBg: 'background-color: #FFFBEB;', icon: 'warning', btnBg: 'background-color: #F59E0B;' },
        success: { bg: 'background-color: #10B981;', hover: 'hover:bg-green-600', text: 'color: #10B981;', iconBg: 'background-color: #ECFDF5;', icon: 'check_circle', btnBg: 'background-color: #10B981;' }
    };

    const color = colors[confirmType] || colors.primary;

    // Use inline styles to avoid Tailwind compilation issues
    document.getElementById('modal-container').innerHTML = `
        <div style="position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; background-color: rgba(17, 24, 39, 0.5); backdrop-filter: blur(4px);" class="modal-overlay">
            <div style="position: absolute; inset: 0;" onclick="closeModal()"></div>
            <div style="position: relative; background-color: white; width: 100%; max-width: 24rem; border-radius: 1rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); overflow: hidden;" class="modal-content">
                <div style="padding: 1.5rem; text-align: center;">
                    <div style="width: 4rem; height: 4rem; border-radius: 9999px; ${color.iconBg} display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto;">
                        <span class="material-icons-round" style="font-size: 1.875rem; ${color.text}">${color.icon}</span>
                    </div>
                    <h3 style="font-size: 1.25rem; font-weight: 700; color: #1F2937; margin-bottom: 0.5rem;">${title}</h3>
                    <p style="color: #6B7280; font-size: 0.875rem;">${message}</p>
                </div>
                <div style="display: flex; border-top: 1px solid #F3F4F6;">
                    <button onclick="closeModal()" style="flex: 1; padding: 0.75rem 1rem; color: #4B5563; font-weight: 500; background: white; border: none; border-right: 1px solid #F3F4F6; cursor: pointer; transition: background 0.2s;">
                        Hủy
                    </button>
                    <button id="modal-confirm-btn" style="flex: 1; padding: 0.75rem 1rem; color: white; font-weight: 700; ${color.btnBg} border: none; cursor: pointer; transition: background 0.2s;">
                        ${confirmText}
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modal-confirm-btn').onclick = () => {
        onConfirm();
        closeModal();
    };

    animateModalOpen();
}

async function approveCooperative(id) {
    showConfirmModal({
        title: 'Duyệt Hợp tác xã?',
        message: 'Bạn có chắc chắn muốn phê duyệt yêu cầu đăng ký hợp tác xã này không?',
        confirmText: 'Duyệt ngay',
        confirmType: 'primary',
        onConfirm: async () => {
            try {
                const result = await fetchAPI(`${API_BASE_URL}/cooperatives/admin/${id}/approve`, 'POST');
                if (result) {
                    // Remove from pending list with animation
                    const element = document.getElementById(`pending-${id}`);
                    if (element) {
                        gsap.to(element, {
                            opacity: 0,
                            x: 50,
                            duration: 0.3,
                            onComplete: () => {
                                element.remove();
                                loadCooperatives(); // Reload to update stats
                            }
                        });
                    }
                    logActivity('approve', 'cooperative', `Approved cooperative ID: ${id}`);
                }
            } catch (error) {
                console.error('Error approving cooperative:', error);
                // Simple toast or alert fallback for error
                alert('Không thể duyệt hợp tác xã [' + error.message + ']');
            }
        }
    });
}

async function rejectCooperative(id) {
    showConfirmModal({
        title: 'Từ chối Hợp tác xã?',
        message: 'Hành động này sẽ từ chối đơn đăng ký. Bạn có chắc chắn không?',
        confirmText: 'Từ chối',
        confirmType: 'danger',
        onConfirm: async () => {
            try {
                const result = await fetchAPI(`${API_BASE_URL}/cooperatives/admin/${id}/reject`, 'POST');
                if (result) {
                    const element = document.getElementById(`pending-${id}`);
                    if (element) {
                        gsap.to(element, {
                            opacity: 0,
                            x: -50,
                            duration: 0.3,
                            onComplete: () => {
                                element.remove();
                                loadCooperatives();
                            }
                        });
                    }
                    logActivity('reject', 'cooperative', `Rejected cooperative ID: ${id}`);
                }
            } catch (error) {
                console.error('Error rejecting cooperative:', error);
                alert('Không thể từ chối hợp tác xã [' + error.message + ']');
            }
        }
    });
}

// ==================== Dissolution Request Management ====================

async function loadDissolutionRequests() {
    try {
        const response = await fetchAPI(`${API_BASE_URL}/cooperatives/admin/dissolution-requests`);
        return response || [];
    } catch (error) {
        console.error('Error loading dissolution requests:', error);
        return [];
    }
}

function renderDissolutionRequests(requests) {
    if (!requests || requests.length === 0) {
        return `
            <div class="flex flex-col items-center justify-center py-12 text-gray-400">
                <span class="material-icons-round text-5xl mb-3">check_circle</span>
                <p>Không có đơn giải thể nào đang chờ duyệt</p>
            </div>
        `;
    }

    return requests.map(req => `
        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors" id="dissolution-${req.id}">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <span class="material-icons-round text-red-500">delete_forever</span>
                </div>
                <div>
                    <h4 class="font-semibold text-gray-800">${req.cooperativeName}</h4>
                    <p class="text-sm text-gray-500">${req.cooperativeCode} • ${req.requestedByName}</p>
                    <p class="text-xs text-gray-400 mt-1">Lý do: ${req.reason.substring(0, 100)}${req.reason.length > 100 ? '...' : ''}</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="approveDissolution(${req.id}, '${req.cooperativeName}')" 
                        class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1">
                    <span class="material-icons-round text-sm">check</span>
                    Duyệt giải thể
                </button>
                <button onclick="rejectDissolution(${req.id})" 
                        class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-1">
                    <span class="material-icons-round text-sm">close</span>
                    Từ chối
                </button>
            </div>
        </div>
    `).join('');
}

async function approveDissolution(id, name) {
    showConfirmModal({
        title: 'Phê duyệt giải thể HTX?',
        message: `Xác nhận giải thể "${name}"? Tất cả thành viên sẽ bị loại khỏi HTX.`,
        confirmText: 'Giải thể ngay',
        confirmType: 'danger',
        onConfirm: async () => {
            try {
                const result = await fetchAPI(`${API_BASE_URL}/cooperatives/admin/dissolution/${id}/approve`, 'POST', {});
                if (result) {
                    const element = document.getElementById(`dissolution-${id}`);
                    if (element) {
                        gsap.to(element, {
                            opacity: 0,
                            x: 50,
                            duration: 0.3,
                            onComplete: () => {
                                element.remove();
                                loadCooperatives();
                            }
                        });
                    }
                    logActivity('dissolution', 'cooperative', `Approved dissolution for: ${name}`);
                }
            } catch (error) {
                console.error('Error approving dissolution:', error);
                alert('Không thể phê duyệt giải thể: ' + error.message);
            }
        }
    });
}

async function rejectDissolution(id) {
    showConfirmModal({
        title: 'Từ chối yêu cầu giải thể?',
        message: 'HTX sẽ tiếp tục hoạt động bình thường.',
        confirmText: 'Từ chối',
        confirmType: 'warning',
        onConfirm: async () => {
            try {
                const result = await fetchAPI(`${API_BASE_URL}/cooperatives/admin/dissolution/${id}/reject`, 'POST', {});
                if (result) {
                    const element = document.getElementById(`dissolution-${id}`);
                    if (element) {
                        gsap.to(element, {
                            opacity: 0,
                            x: -50,
                            duration: 0.3,
                            onComplete: () => {
                                element.remove();
                                loadCooperatives();
                            }
                        });
                    }
                    logActivity('dissolution', 'cooperative', `Rejected dissolution ID: ${id}`);
                }
            } catch (error) {
                console.error('Error rejecting dissolution:', error);
                alert('Không thể từ chối yêu cầu: ' + error.message);
            }
        }
    });
}

// ============ COMMUNITY MANAGEMENT ============
let communityGuides = [];
let communityCategories = [];
let communityPosts = [];

async function loadCommunity() {
    document.getElementById('page-title').textContent = 'Quản lý Cộng đồng';

    // Load stats
    let stats = { totalGuides: 0, publishedGuides: 0, totalPosts: 0, pendingPosts: 0, totalCategories: 0 };
    try {
        stats = await fetchAPI(`${API_BASE_URL}/admin/community/stats`) || stats;
    } catch (error) {
        console.error('Error loading community stats:', error);
    }

    document.getElementById('main-content').innerHTML = `
        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div class="bg-white rounded-xl shadow-sm p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Tổng hướng dẫn</p>
                        <p class="text-3xl font-bold text-gray-800 mt-1">${stats.totalGuides}</p>
                    </div>
                    <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <span class="material-icons-round text-blue-600">menu_book</span>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-xl shadow-sm p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Đã xuất bản</p>
                        <p class="text-3xl font-bold text-green-600 mt-1">${stats.publishedGuides}</p>
                    </div>
                    <div class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <span class="material-icons-round text-green-600">check_circle</span>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-xl shadow-sm p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Tổng bài đăng</p>
                        <p class="text-3xl font-bold text-gray-800 mt-1">${stats.totalPosts}</p>
                    </div>
                    <div class="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                        <span class="material-icons-round text-purple-600">article</span>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-xl shadow-sm p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm font-medium">Danh mục</p>
                        <p class="text-3xl font-bold text-gray-800 mt-1">${stats.totalCategories}</p>
                    </div>
                    <div class="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                        <span class="material-icons-round text-orange-600">category</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Tabs -->
        <div class="bg-white rounded-xl shadow-sm mb-6">
            <div class="flex border-b border-gray-200">
                <button class="community-tab px-6 py-4 text-sm font-semibold text-primary border-b-2 border-primary" data-tab="guides">
                    <span class="material-icons-round mr-2 align-middle">menu_book</span>
                    Hướng dẫn
                </button>
                <button class="community-tab px-6 py-4 text-sm font-semibold text-gray-500 hover:text-gray-700" data-tab="categories">
                    <span class="material-icons-round mr-2 align-middle">category</span>
                    Danh mục
                </button>
                <button class="community-tab px-6 py-4 text-sm font-semibold text-gray-500 hover:text-gray-700" data-tab="posts">
                    <span class="material-icons-round mr-2 align-middle">article</span>
                    Bài đăng
                </button>
                <button class="community-tab px-6 py-4 text-sm font-semibold text-gray-500 hover:text-gray-700" data-tab="money-verification" id="money-tab">
                    <span class="material-icons-round mr-2 align-middle">account_balance_wallet</span>
                    Kiểm duyệt tiền
                    <span id="pending-money-count" class="ml-2 px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full hidden">0</span>
                </button>
            </div>
        </div>

        <!-- Tab Content -->
        <div id="community-tab-content">
            <!-- Loaded dynamically -->
        </div>
    `;

    // Tab navigation
    document.querySelectorAll('.community-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.community-tab').forEach(t => {
                t.classList.remove('text-primary', 'border-b-2', 'border-primary');
                t.classList.add('text-gray-500');
            });
            tab.classList.add('text-primary', 'border-b-2', 'border-primary');
            tab.classList.remove('text-gray-500');

            const tabName = tab.dataset.tab;
            switch (tabName) {
                case 'guides': loadCommunityGuides(); break;
                case 'categories': loadCommunityCategories(); break;
                case 'posts': loadCommunityPosts(); break;
                case 'money-verification': loadMoneyVerification(); break;
            }
        });
    });

    // Load initial tab
    loadCommunityGuides();
}

async function loadCommunityGuides() {
    const container = document.getElementById('community-tab-content');

    try {
        const data = await fetchAPI(`${API_BASE_URL}/admin/community/guides?page=0&size=20`);
        communityGuides = data?.content || [];

        container.innerHTML = `
            <div class="bg-white rounded-xl shadow-sm">
                <div class="p-6 border-b border-gray-200 flex justify-between items-center">
                    <h3 class="text-lg font-semibold">Danh sách hướng dẫn</h3>
                    <button onclick="showCreateGuideModal()" class="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-dark transition">
                        <span class="material-icons-round mr-1 align-middle text-sm">add</span>
                        Tạo hướng dẫn
                    </button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead>
                            <tr class="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <th class="px-6 py-3">Tiêu đề</th>
                                <th class="px-6 py-3">Danh mục</th>
                                <th class="px-6 py-3">Trạng thái</th>
                                <th class="px-6 py-3">Lượt xem</th>
                                <th class="px-6 py-3">Ngày tạo</th>
                                <th class="px-6 py-3">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            ${communityGuides.length === 0 ? `
                                <tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Chưa có hướng dẫn nào</td></tr>
                            ` : communityGuides.map(guide => `
                                <tr class="table-row hover:bg-gray-50">
                                    <td class="px-6 py-4">
                                        <div class="flex items-center gap-3">
                                            <div class="w-12 h-8 bg-gray-200 rounded overflow-hidden">
                                                ${guide.coverImage ? `<img src="${guide.coverImage}" class="w-full h-full object-cover">` : ''}
                                            </div>
                                            <div>
                                                <p class="font-medium text-gray-800">${guide.title}</p>
                                                <p class="text-xs text-gray-500">${guide.slug}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-600">${guide.category?.name || 'Chưa phân loại'}</td>
                                    <td class="px-6 py-4">
                                        ${guide.isPublished
                ? '<span class="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Đã xuất bản</span>'
                : '<span class="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">Bản nháp</span>'}
                                        ${guide.isFeatured ? '<span class="ml-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">Nổi bật</span>' : ''}
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-600">${guide.viewCount || 0}</td>
                                    <td class="px-6 py-4 text-sm text-gray-500">${new Date(guide.createdAt).toLocaleDateString('vi-VN')}</td>
                                    <td class="px-6 py-4">
                                        <div class="flex gap-2">
                                            <button onclick="editGuide(${guide.id})" class="p-2 text-gray-400 hover:text-blue-600 transition">
                                                <span class="material-icons-round text-sm">edit</span>
                                            </button>
                                            ${!guide.isPublished ? `
                                                <button onclick="publishGuide(${guide.id})" class="p-2 text-gray-400 hover:text-green-600 transition">
                                                    <span class="material-icons-round text-sm">publish</span>
                                                </button>
                                            ` : `
                                                <button onclick="unpublishGuide(${guide.id})" class="p-2 text-gray-400 hover:text-yellow-600 transition">
                                                    <span class="material-icons-round text-sm">unpublished</span>
                                                </button>
                                            `}
                                            <button onclick="deleteGuide(${guide.id})" class="p-2 text-gray-400 hover:text-red-600 transition">
                                                <span class="material-icons-round text-sm">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading guides:', error);
        container.innerHTML = '<div class="text-center py-8 text-gray-500">Không thể tải danh sách hướng dẫn</div>';
    }
}

async function loadCommunityCategories() {
    const container = document.getElementById('community-tab-content');

    try {
        communityCategories = await fetchAPI(`${API_BASE_URL}/admin/community/categories`) || [];

        container.innerHTML = `
            <div class="bg-white rounded-xl shadow-sm">
                <div class="p-6 border-b border-gray-200 flex justify-between items-center">
                    <h3 class="text-lg font-semibold">Danh mục hướng dẫn</h3>
                    <button onclick="showCreateCategoryModal()" class="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-dark transition">
                        <span class="material-icons-round mr-1 align-middle text-sm">add</span>
                        Tạo danh mục
                    </button>
                </div>
                <div class="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${communityCategories.length === 0 ? `
                        <p class="col-span-full text-center text-gray-500 py-8">Chưa có danh mục nào</p>
                    ` : communityCategories.map(cat => `
                        <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                            <div class="flex items-center gap-3 mb-3">
                                <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                    ${renderCategoryIcon(cat.icon)}
                                </div>
                                <div class="flex-1">
                                    <h4 class="font-semibold text-gray-800">${cat.name}</h4>
                                    <p class="text-xs text-gray-500">/${cat.slug}</p>
                                </div>
                            </div>
                            <p class="text-sm text-gray-600 mb-3 line-clamp-2">${cat.description || 'Không có mô tả'}</p>
                            <div class="flex justify-end gap-2">
                                <button onclick="openEditCategoryDialog(${cat.id})" class="p-2 text-gray-400 hover:text-blue-600 transition">
                                    <span class="material-icons-round text-sm">edit</span>
                                </button>
                                <button onclick="confirmDeleteCategory(${cat.id})" class="p-2 text-gray-400 hover:text-red-600 transition">
                                    <span class="material-icons-round text-sm">delete</span>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading categories:', error);
        container.innerHTML = '<div class="text-center py-8 text-gray-500">Không thể tải danh mục</div>';
    }
}

async function loadCommunityPosts() {
    const container = document.getElementById('community-tab-content');

    try {
        const data = await fetchAPI(`${API_BASE_URL}/admin/community/posts?page=0&size=20`);
        communityPosts = data?.content || [];

        container.innerHTML = `
            <div class="bg-white rounded-xl shadow-sm">
                <div class="p-6 border-b border-gray-200">
                    <h3 class="text-lg font-semibold">Quản lý bài đăng</h3>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead>
                            <tr class="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <th class="px-6 py-3">Tác giả</th>
                                <th class="px-6 py-3">Nội dung</th>
                                <th class="px-6 py-3">Trạng thái</th>
                                <th class="px-6 py-3">Tương tác</th>
                                <th class="px-6 py-3">Ngày đăng</th>
                                <th class="px-6 py-3">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            ${communityPosts.length === 0 ? `
                                <tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Chưa có bài đăng nào</td></tr>
                            ` : communityPosts.map(post => `
                                <tr class="table-row hover:bg-gray-50 cursor-pointer" onclick="showPostDetail(${post.id})">
                                    <td class="px-6 py-4">
                                        <div class="flex items-center gap-2">
                                            <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${!post.author?.avatarUrl ? 'bg-primary' : 'bg-gray-200'}" 
                                                style="${post.author?.avatarUrl ? `background-image: url('${post.author.avatarUrl}'); background-size: cover; background-position: center;` : ''}">
                                                ${post.author?.avatarUrl ? '' : (post.author?.fullName || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <span class="text-sm font-medium">${post.author?.fullName || 'Người dùng'}</span>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4">
                                        <p class="text-sm text-gray-800 line-clamp-2 max-w-xs">${post.content}</p>
                                        ${post.images && JSON.parse(post.images).length > 0 ?
                `<span class="inline-flex items-center gap-1 text-xs text-blue-600 mt-1 bg-blue-50 px-2 py-0.5 rounded-full">
                                                <span class="material-icons-round text-[14px]">image</span> ${JSON.parse(post.images).length} ảnh
                                            </span>` : ''}
                                        ${post.videos && JSON.parse(post.videos).length > 0 ?
                `<span class="inline-flex items-center gap-1 text-xs text-red-600 mt-1 bg-red-50 px-2 py-0.5 rounded-full ml-1">
                                                <span class="material-icons-round text-[14px]">videocam</span> ${JSON.parse(post.videos).length} video
                                            </span>` : ''}
                                    </td>
                                    <td class="px-6 py-4">
                                        ${post.isHidden
                ? '<span class="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Đã ẩn</span>'
                : post.isApproved
                    ? '<span class="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Hiển thị</span>'
                    : '<span class="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">Chờ duyệt</span>'}
                                    </td>
                                    <td class="px-6 py-4">
                                        <div class="flex gap-3 text-sm text-gray-500">
                                            <span>👍 ${post.likeCount || 0}</span>
                                            <span>💬 ${post.commentCount || 0}</span>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-500">${new Date(post.createdAt).toLocaleDateString('vi-VN')}</td>
                                    <td class="px-6 py-4">
                                        <div class="flex gap-2" onclick="event.stopPropagation()">
                                            ${!post.isApproved ? `
                                                <button onclick="approvePost(${post.id})" class="p-2 text-gray-400 hover:text-green-600 transition" title="Duyệt bài">
                                                    <span class="material-icons-round text-sm">check_circle</span>
                                                </button>
                                            ` : ''}
                                            ${post.isHidden ? `
                                                <button onclick="unhidePost(${post.id})" class="p-2 text-gray-400 hover:text-green-600 transition" title="Hiện bài">
                                                    <span class="material-icons-round text-sm">visibility</span>
                                                </button>
                                            ` : `
                                                <button onclick="hidePost(${post.id})" class="p-2 text-gray-400 hover:text-yellow-600 transition" title="Ẩn bài">
                                                    <span class="material-icons-round text-sm">visibility_off</span>
                                                </button>
                                            `}
                                            <button onclick="deletePost(${post.id})" class="p-2 text-gray-400 hover:text-red-600 transition" title="Xóa">
                                                <span class="material-icons-round text-sm">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading posts:', error);
        container.innerHTML = '<div class="text-center py-8 text-gray-500">Không thể tải bài đăng</div>';
    }
}

// Post Actions
// Post Actions
function deleteComment(id) {
    showConfirmModal({
        title: 'Xác nhận xóa bình luận',
        message: 'Bạn có chắc muốn xóa bình luận này? Hành động này không thể hoàn tác.',
        confirmText: 'Xóa',
        confirmType: 'danger',
        onConfirm: async () => {
            try {
                await fetchAPI(`${API_BASE_URL}/admin/community/comments/${id}`, 'DELETE');
                const commentEl = document.getElementById(`comment-${id}`);
                if (commentEl) {
                    // Animate removal
                    gsap.to(commentEl, {
                        opacity: 0,
                        height: 0,
                        marginBottom: 0,
                        duration: 0.3,
                        onComplete: () => commentEl.remove()
                    });
                }
                showToast('Thành công', 'Đã xóa bình luận', 'success');
            } catch (error) {
                console.error('Error deleting comment:', error);
                showToast('Lỗi', 'Không thể xóa bình luận', 'error');
            }
        }
    });
}

async function showPostDetail(id) {
    let post = communityPosts.find(p => p.id === id);
    if (!post) {
        try {
            post = await fetchAPI(`${API_BASE_URL}/posts/${id}`);
        } catch (e) {
            console.error('Error fetching post:', e);
            return;
        }
    }
    if (!post) return;

    // Fetch comments
    let comments = [];
    try {
        comments = await fetchAPI(`${API_BASE_URL}/admin/community/posts/${id}/comments`) || [];
    } catch (e) {
        console.error('Error fetching comments:', e);
    }

    const images = post.images ? JSON.parse(post.images) : [];
    const videos = post.videos ? JSON.parse(post.videos) : [];

    const renderComment = (comment, isReply = false) => `
        <div id="comment-${comment.id}" class="flex gap-3 mb-4 ${isReply ? 'ml-10' : ''}">
            <div class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${!comment.author?.avatarUrl ? 'bg-primary' : 'bg-gray-200'}" 
                 style="${comment.author?.avatarUrl ? `background-image: url('${comment.author.avatarUrl}'); background-size: cover; background-position: center;` : ''}">
                ${comment.author?.avatarUrl ? '' : (comment.author?.fullName || 'U').charAt(0).toUpperCase()}
            </div>
            <div class="flex-1">
                <div class="bg-gray-100 rounded-2xl px-4 py-2 inline-block">
                    <p class="font-bold text-sm text-gray-800">${comment.author?.fullName || 'Người dùng'}</p>
                    <p class="text-sm text-gray-800">${comment.content}</p>
                </div>
                <div class="flex items-center gap-3 mt-1 ml-2">
                    <span class="text-xs text-gray-500">${new Date(comment.createdAt).toLocaleString('vi-VN')}</span>
                     <button onclick="deleteComment(${comment.id})" class="text-xs text-red-500 hover:underline">Xóa</button>
                </div>
                <!-- Replies -->
                ${comment.replies && comment.replies.length > 0 ?
            `<div class="mt-2 text-sm">
                        ${comment.replies.map(reply => renderComment(reply, true)).join('')}
                    </div>`
            : ''}
            </div>
        </div>
    `;

    document.getElementById('modal-container').innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
            <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onclick="closeModal()"></div>
            <div class="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl modal-content max-h-[90vh] overflow-hidden flex flex-col">
                <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${!post.author?.avatarUrl ? 'bg-primary' : 'bg-gray-200'}" 
                             style="${post.author?.avatarUrl ? `background-image: url('${post.author.avatarUrl}'); background-size: cover; background-position: center;` : ''}">
                            ${post.author?.avatarUrl ? '' : (post.author?.fullName || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 class="font-bold text-gray-800">${post.author?.fullName || 'Người dùng'}</h3>
                            <p class="text-xs text-gray-500">${new Date(post.createdAt).toLocaleString('vi-VN')}</p>
                        </div>
                    </div>
                    <button onclick="closeModal()" class="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                
                <div class="p-6 overflow-y-auto custom-scrollbar">
                    <div class="mb-6">
                        <p class="text-gray-800 whitespace-pre-wrap leading-relaxed text-base">${post.content}</p>
                    </div>
                    
                    ${images.length > 0 ? `
                        <div class="grid ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-2 rounded-xl overflow-hidden mb-6">
                            ${images.map(img => `
                                <div class="aspect-video bg-gray-100 relative group overflow-hidden">
                                    <img src="${img}" class="w-full h-full object-cover transition duration-300 group-hover:scale-105">
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    ${videos.length > 0 ? (() => {
            const origin = new URL(API_BASE_URL).origin;
            return `
                        <div class="grid ${videos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-2 rounded-xl overflow-hidden mb-6">
                            ${videos.map(video => {
                const fullUrl = video.startsWith('http') ? video : `${origin}${video.startsWith('/') ? '' : '/'}${video}`;
                return `
                                <div class="aspect-video bg-black rounded-xl overflow-hidden relative group" style="aspect-ratio: 16/9;">
                                    <video src="${fullUrl}" 
                                        controls 
                                        controlsList="nodownload" 
                                        preload="metadata"
                                        class="w-full h-full object-contain bg-black"
                                    ></video>
                                </div>
                                `;
            }).join('')}
                        </div>
                        `;
        })() : ''}

                    <div class="flex items-center gap-6 py-4 border-t border-b border-gray-100 mb-4">
                        <div class="flex items-center gap-2 text-gray-600">
                            <span class="material-icons-round text-blue-500">thumb_up</span>
                            <span class="font-medium">${post.likeCount || 0}</span> lượt thích
                        </div>
                        <div class="flex items-center gap-2 text-gray-600">
                            <span class="material-icons-round text-gray-500">chat_bubble</span>
                            <span class="font-medium">${comments.length}</span> bình luận
                        </div>
                    </div>

                    <!-- Comments Section -->
                    <div>
                        <h4 class="font-bold text-gray-700 mb-4">Bình luận</h4>
                        ${comments.length === 0 ? '<p class="text-gray-500 text-sm">Chưa có bình luận nào</p>' :
            `<div class="space-y-4">
                                ${comments.map(c => renderComment(c)).join('')}
                            </div>`
        }
                    </div>
                </div>

                <div class="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    ${!post.isApproved ? `
                        <button onclick="approvePost(${post.id}); closeModal()" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center gap-2">
                            <span class="material-icons-round text-sm">check</span> Duyệt bài
                        </button>
                    ` : ''}
                    <button onclick="deletePost(${post.id}); closeModal()" class="px-4 py-2 bg-white border border-gray-300 hover:bg-red-50 text-red-600 rounded-lg font-medium flex items-center gap-2">
                        <span class="material-icons-round text-sm">delete</span> Xóa bài
                    </button>
                    <button onclick="closeModal()" class="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium">
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    `;

    // Animate
    gsap.fromTo('.modal-overlay', { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo('.modal-content', { scale: 0.95, opacity: 0, y: 10 }, { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: 'back.out(1.1)' });
}


// Guide Actions
async function publishGuide(id) {
    try {
        await fetchAPI(`${API_BASE_URL}/admin/community/guides/${id}/publish`, 'POST');
        logActivity('publish', 'guide', `Published guide ID: ${id}`);
        loadCommunityGuides();
    } catch (error) {
        console.error('Error publishing guide:', error);
        alert('Không thể xuất bản hướng dẫn');
    }
}

async function unpublishGuide(id) {
    try {
        await fetchAPI(`${API_BASE_URL}/admin/community/guides/${id}/unpublish`, 'POST');
        logActivity('unpublish', 'guide', `Unpublished guide ID: ${id}`);
        loadCommunityGuides();
    } catch (error) {
        console.error('Error unpublishing guide:', error);
        alert('Không thể bỏ xuất bản');
    }
}

async function deleteGuide(id) {
    showConfirmModal({
        title: 'Xác nhận xóa',
        message: 'Bạn có chắc muốn xóa hướng dẫn này? Hành động này không thể hoàn tác.',
        confirmText: 'Xóa',
        confirmType: 'danger',
        onConfirm: async () => {
            try {
                await fetchAPI(`${API_BASE_URL}/admin/community/guides/${id}`, 'DELETE');
                logActivity('delete', 'guide', `Deleted guide ID: ${id}`);
                loadCommunityGuides();
            } catch (error) {
                console.error('Error deleting guide:', error);
                alert('Không thể xóa hướng dẫn');
            }
        }
    });
}

// Category Actions
async function deleteCategory(id) {
    showConfirmModal({
        title: 'Xác nhận xóa danh mục',
        message: 'Bạn có chắc muốn xóa danh mục này? Tất cả hướng dẫn trong danh mục này cũng sẽ bị ảnh hưởng.',
        confirmText: 'Xóa',
        confirmType: 'danger',
        onConfirm: async () => {
            try {
                await fetchAPI(`${API_BASE_URL}/admin/community/categories/${id}`, 'DELETE');
                logActivity('delete', 'category', `Deleted category ID: ${id}`);
                loadCommunityCategories();
            } catch (error) {
                console.error('Error deleting category:', error);
                alert('Không thể xóa danh mục');
            }
        }
    });
}

// Post Actions
async function approvePost(id) {
    try {
        await fetchAPI(`${API_BASE_URL}/admin/community/posts/${id}/approve`, 'POST');
        logActivity('approve', 'post', `Approved post ID: ${id}`);
        loadCommunityPosts();
        showToast('Thành công', 'Đã duyệt bài đăng', 'success');
    } catch (error) {
        console.error('Error approving post:', error);
        showToast('Lỗi', 'Không thể duyệt bài đăng', 'error');
    }
}

async function hidePost(id) {
    try {
        await fetchAPI(`${API_BASE_URL}/admin/community/posts/${id}/hide`, 'POST');
        logActivity('hide', 'post', `Hidden post ID: ${id}`);
        loadCommunityPosts();
    } catch (error) {
        console.error('Error hiding post:', error);
        alert('Không thể ẩn bài đăng');
    }
}

async function unhidePost(id) {
    try {
        await fetchAPI(`${API_BASE_URL}/admin/community/posts/${id}/unhide`, 'POST');
        logActivity('unhide', 'post', `Unhidden post ID: ${id}`);
        loadCommunityPosts();
    } catch (error) {
        console.error('Error unhiding post:', error);
        alert('Không thể hiện bài đăng');
    }
}

async function deletePost(id) {
    if (!confirm('Bạn có chắc muốn xóa bài đăng này?')) return;
    try {
        await fetchAPI(`${API_BASE_URL}/admin/community/posts/${id}`, 'DELETE');
        logActivity('delete', 'post', `Deleted post ID: ${id}`);
        loadCommunityPosts();
    } catch (error) {
        console.error('Error deleting post:', error);
        alert('Không thể xóa bài đăng');
    }
}

// Create Guide Modal
function showCreateGuideModal() {
    const adminId = localStorage.getItem('userId') || '1';

    document.getElementById('modal-container').innerHTML = `
        <div class="modal-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div class="modal-content bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div class="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
                    <h3 class="text-xl font-bold">Tạo hướng dẫn mới</h3>
                    <button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-lg">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <div class="p-6 space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Tiêu đề *</label>
                        <input type="text" id="guide-title" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="Nhập tiêu đề">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                        <input type="text" id="guide-slug" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="url-friendly-slug">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Danh mục</label>
                        <select id="guide-category" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
                            <option value="">Chọn danh mục</option>
                            ${communityCategories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Mô tả ngắn</label>
                        <input type="text" id="guide-excerpt" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="Mô tả ngắn gọn">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Nội dung *</label>
                        <textarea id="guide-content" rows="10" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="Nội dung hướng dẫn chi tiết..."></textarea>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Ảnh bìa (URL)</label>
                        <input type="text" id="guide-cover" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="https://...">
                    </div>
                    <div class="flex gap-4">
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="guide-published" class="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary">
                            <span class="text-sm text-gray-700">Xuất bản ngay</span>
                        </label>
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="guide-featured" class="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary">
                            <span class="text-sm text-gray-700">Nổi bật</span>
                        </label>
                    </div>
                </div>
                <div class="p-6 border-t border-gray-200 flex justify-end gap-3">
                    <button onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Hủy</button>
                    <button onclick="createGuide(${adminId})" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">Tạo hướng dẫn</button>
                </div>
            </div>
        </div>
    `;
}

async function createGuide(authorId) {
    const title = document.getElementById('guide-title').value.trim();
    const slug = document.getElementById('guide-slug').value.trim();
    const content = document.getElementById('guide-content').value.trim();
    const excerpt = document.getElementById('guide-excerpt').value.trim();
    const coverImage = document.getElementById('guide-cover').value.trim();
    const categoryId = document.getElementById('guide-category').value;
    const isPublished = document.getElementById('guide-published').checked;
    const isFeatured = document.getElementById('guide-featured').checked;

    if (!title || !slug || !content) {
        alert('Vui lòng điền đầy đủ thông tin bắt buộc');
        return;
    }

    try {
        const data = {
            authorId,
            title,
            slug,
            content,
            excerpt,
            coverImage,
            isPublished,
            isFeatured
        };
        if (categoryId) data.categoryId = parseInt(categoryId);

        await fetchAPI(`${API_BASE_URL}/admin/community/guides`, 'POST', data);
        logActivity('create', 'guide', `Created guide: ${title}`);
        closeModal();
        loadCommunityGuides();
    } catch (error) {
        console.error('Error creating guide:', error);
        alert('Không thể tạo hướng dẫn: ' + error.message);
    }
}

// Edit Guide Modal with TinyMCE
async function editGuide(id) {
    // Find guide data
    const guide = communityGuides.find(g => g.id === id);
    if (!guide) {
        alert('Không tìm thấy hướng dẫn');
        return;
    }

    document.getElementById('modal-container').innerHTML = `
        <div class="modal-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div class="modal-content bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[95vh] overflow-y-auto">
                <div class="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
                    <h3 class="text-xl font-bold">Chỉnh sửa hướng dẫn</h3>
                    <button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-lg">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <div class="p-6 space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Tiêu đề *</label>
                            <input type="text" id="edit-guide-title" value="${guide.title || ''}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                            <input type="text" id="edit-guide-slug" value="${guide.slug || ''}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Danh mục</label>
                            <select id="edit-guide-category" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
                                <option value="">Chọn danh mục</option>
                                ${communityCategories.map(cat => `<option value="${cat.id}" ${guide.category?.id === cat.id ? 'selected' : ''}>${cat.name}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Ảnh bìa (URL)</label>
                            <input type="text" id="edit-guide-cover" value="${guide.coverImage || ''}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Mô tả ngắn</label>
                        <input type="text" id="edit-guide-excerpt" value="${guide.excerpt || ''}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Nội dung *</label>
                        <textarea id="edit-guide-content" class="tinymce-editor">${guide.content || ''}</textarea>
                    </div>
                    <div class="flex gap-4">
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="edit-guide-published" ${guide.isPublished ? 'checked' : ''} class="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary">
                            <span class="text-sm text-gray-700">Đã xuất bản</span>
                        </label>
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="edit-guide-featured" ${guide.isFeatured ? 'checked' : ''} class="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary">
                            <span class="text-sm text-gray-700">Nổi bật</span>
                        </label>
                    </div>
                </div>
                <div class="p-6 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
                    <button onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Hủy</button>
                    <button onclick="saveGuide(${id})" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">Lưu thay đổi</button>
                </div>
            </div>
        </div>
    `;

    // Initialize TinyMCE
    if (typeof tinymce !== 'undefined') {
        tinymce.init({
            selector: '#edit-guide-content',
            height: 400,
            menubar: false,
            plugins: 'lists link image table code fullscreen',
            toolbar: 'undo redo | formatselect | bold italic | alignleft aligncenter alignright | bullist numlist | link image table | code fullscreen',
            content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 14px; }',
            language: 'vi'
        });
    }
}

async function saveGuide(id) {
    // Get TinyMCE content
    let content = document.getElementById('edit-guide-content').value;
    if (typeof tinymce !== 'undefined' && tinymce.get('edit-guide-content')) {
        content = tinymce.get('edit-guide-content').getContent();
    }

    const title = document.getElementById('edit-guide-title').value.trim();
    const slug = document.getElementById('edit-guide-slug').value.trim();
    const excerpt = document.getElementById('edit-guide-excerpt').value.trim();
    const coverImage = document.getElementById('edit-guide-cover').value.trim();
    const categoryId = document.getElementById('edit-guide-category').value;
    const isPublished = document.getElementById('edit-guide-published').checked;
    const isFeatured = document.getElementById('edit-guide-featured').checked;

    if (!title || !content) {
        alert('Vui lòng điền tiêu đề và nội dung');
        return;
    }

    try {
        const data = { title, slug, content, excerpt, coverImage, isPublished, isFeatured };
        if (categoryId) data.categoryId = parseInt(categoryId);

        await fetchAPI(`${API_BASE_URL}/admin/community/guides/${id}`, 'PUT', data);
        logActivity('update', 'guide', `Updated guide: ${title}`);

        // Destroy TinyMCE instance before closing
        if (typeof tinymce !== 'undefined' && tinymce.get('edit-guide-content')) {
            tinymce.get('edit-guide-content').destroy();
        }

        closeModal();
        loadCommunityGuides();
    } catch (error) {
        console.error('Error saving guide:', error);
        alert('Không thể lưu hướng dẫn: ' + error.message);
    }
}

// Create Category Modal
function showCreateCategoryModal() {
    document.getElementById('modal-container').innerHTML = `
        <div class="modal-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div class="modal-content bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
                <div class="p-6 border-b border-gray-200 flex justify-between items-center">
                    <h3 class="text-xl font-bold">Tạo danh mục mới</h3>
                    <button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-lg">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <div class="p-6 space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Tên danh mục *</label>
                        <input type="text" id="cat-name" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="Ví dụ: Trồng trọt">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                        <input type="text" id="cat-slug" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="trong-trot">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Icon (Material Icons)</label>
                        <input type="text" id="cat-icon" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="potted_plant">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                        <textarea id="cat-description" rows="3" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="Mô tả danh mục"></textarea>
                    </div>
                </div>
                <div class="p-6 border-t border-gray-200 flex justify-end gap-3">
                    <button onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Hủy</button>
                    <button onclick="createCategory()" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">Tạo danh mục</button>
                </div>
            </div>
        </div>
    `;
}

async function createCategory() {
    const name = document.getElementById('cat-name').value.trim();
    const slug = document.getElementById('cat-slug').value.trim();
    const icon = document.getElementById('cat-icon').value.trim();
    const description = document.getElementById('cat-description').value.trim();

    if (!name || !slug) {
        alert('Vui lòng điền tên và slug');
        return;
    }

    try {
        await fetchAPI(`${API_BASE_URL}/admin/community/categories`, 'POST', {
            name,
            slug,
            icon: icon || 'category',
            description
        });
        logActivity('create', 'category', `Created category: ${name}`);
        closeModal();
        loadCommunityCategories();
    } catch (error) {
        console.error('Error creating category:', error);
        alert('Không thể tạo danh mục: ' + error.message);
    }
}

// Edit Category Modal
function openEditCategoryDialog(id) {
    const category = communityCategories.find(c => c.id === id);
    if (!category) {
        alert('Không tìm thấy danh mục');
        return;
    }

    document.getElementById('modal-container').innerHTML = `
        <div class="modal-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div class="modal-content bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
                <div class="p-6 border-b border-gray-200 flex justify-between items-center">
                    <h3 class="text-xl font-bold">Chỉnh sửa danh mục</h3>
                    <button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-lg">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <div class="p-6 space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Tên danh mục *</label>
                        <input type="text" id="edit-cat-name" value="${category.name || ''}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                        <input type="text" id="edit-cat-slug" value="${category.slug || ''}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Icon (Material Icons)</label>
                        <input type="text" id="edit-cat-icon" value="${category.icon || ''}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="potted_plant, pets, science, trending_up...">
                        <p class="text-xs text-gray-500 mt-1">Tìm icon tại: <a href="https://fonts.google.com/icons" target="_blank" class="text-primary">Google Material Icons</a></p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                        <textarea id="edit-cat-description" rows="3" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">${category.description || ''}</textarea>
                    </div>
                </div>
                <div class="p-6 border-t border-gray-200 flex justify-end gap-3">
                    <button onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Hủy</button>
                    <button onclick="updateCategory(${id})" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">Lưu thay đổi</button>
                </div>
            </div>
        </div>
    `;
    animateModalOpen();
}

async function updateCategory(id) {
    const name = document.getElementById('edit-cat-name').value.trim();
    const slug = document.getElementById('edit-cat-slug').value.trim();
    const icon = document.getElementById('edit-cat-icon').value.trim();
    const description = document.getElementById('edit-cat-description').value.trim();

    if (!name || !slug) {
        alert('Vui lòng điền tên và slug');
        return;
    }

    try {
        await fetchAPI(`${API_BASE_URL}/admin/community/categories/${id}`, 'PUT', {
            name,
            slug,
            icon: icon || 'category',
            description
        });
        logActivity('update', 'category', `Updated category: ${name}`);
        closeModal();
        loadCommunityCategories();
    } catch (error) {
        console.error('Error updating category:', error);
        alert('Không thể cập nhật danh mục: ' + error.message);
    }
}

// ============ GUIDE EDITOR WITH TINYMCE ============

let currentEditingGuideId = null;

function showCreateGuideModal() {
    currentEditingGuideId = null;
    openGuideEditor(null);
}

async function editGuide(id) {
    currentEditingGuideId = id;
    try {
        // Fix: Use correct Admin API endpoint
        const guide = await fetchAPI(`${API_BASE_URL}/admin/community/guides/${id}`);
        openGuideEditor(guide);
    } catch (error) {
        console.error('Error loading guide:', error);
        alert('Không thể tải hướng dẫn: ' + error.message);
    }
}

async function openGuideEditor(guide) {
    // Load categories for dropdown
    const categories = await fetchAPI(`${API_BASE_URL}/guides/categories`) || [];

    document.getElementById('main-content').innerHTML = `
        <div class="max-w-5xl mx-auto">
            <div class="flex items-center justify-between mb-6">
                <div class="flex items-center gap-4">
                    <button onclick="loadCommunity()" class="p-2 hover:bg-gray-100 rounded-lg transition">
                        <span class="material-icons-round text-gray-600">arrow_back</span>
                    </button>
                    <h2 class="text-xl font-bold text-gray-800">
                        ${guide ? 'Chỉnh sửa hướng dẫn' : 'Tạo hướng dẫn mới'}
                    </h2>
                </div>
                <div class="flex gap-3">
                    <button onclick="loadCommunity()" class="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition">
                        Hủy
                    </button>
                    <button onclick="saveGuideFromEditor(false)" class="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition">
                        Lưu nháp
                    </button>
                    <button onclick="saveGuideFromEditor(true)" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition">
                        Xuất bản
                    </button>
                </div>
            </div>
            
            <div class="bg-white rounded-xl shadow-sm p-6 space-y-6">
                <div class="grid grid-cols-2 gap-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Tiêu đề *</label>
                        <input type="text" id="guide-title" value="${guide?.title || ''}" 
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="Nhập tiêu đề hướng dẫn">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Slug *</label>
                        <input type="text" id="guide-slug" value="${guide?.slug || ''}" 
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="url-friendly-slug">
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Danh mục</label>
                        <select id="guide-category" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
                            <option value="">Chọn danh mục</option>
                            ${categories.map(cat => `
                                <option value="${cat.id}" ${guide?.category?.id === cat.id ? 'selected' : ''}>${cat.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Ảnh bìa (URL)</label>
                        <input type="text" id="guide-cover" value="${guide?.coverImage || ''}" 
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="https://example.com/image.jpg">
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Mô tả ngắn</label>
                    <textarea id="guide-excerpt" rows="2" 
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Mô tả ngắn gọn về hướng dẫn">${guide?.excerpt || ''}</textarea>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Nội dung *</label>
                    <textarea id="guide-content">${guide?.content || ''}</textarea>
                </div>
                
                <div class="flex items-center gap-4 pt-4 border-t">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="guide-featured" ${guide?.isFeatured ? 'checked' : ''} 
                            class="w-5 h-5 rounded text-primary focus:ring-primary">
                        <span class="text-gray-700">Đánh dấu là bài viết nổi bật</span>
                    </label>
                </div>
            </div>
        </div>
    `;

    // Auto-generate slug from title
    document.getElementById('guide-title').addEventListener('input', (e) => {
        if (!currentEditingGuideId) {
            const slug = e.target.value
                .toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/g, 'd').replace(/Đ/g, 'd')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
            document.getElementById('guide-slug').value = slug;
        }
    });

    // Initialize TinyMCE
    initTinyMCE();
}

function initTinyMCE() {
    if (typeof tinymce !== 'undefined') {
        tinymce.remove('#guide-content');
        tinymce.init({
            selector: '#guide-content',
            height: 500,
            menubar: true,
            plugins: [
                'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                'insertdatetime', 'media', 'table', 'help', 'wordcount'
            ],
            toolbar: 'undo redo | blocks | ' +
                'bold italic forecolor backcolor | alignleft aligncenter ' +
                'alignright alignjustify | bullist numlist outdent indent | ' +
                'link image media table | removeformat | fullscreen code help',
            content_style: 'body { font-family: Inter, sans-serif; font-size: 14px; line-height: 1.6; }',
            language: 'vi',
            image_advtab: true,
            image_caption: true,
            automatic_uploads: false,
            file_picker_types: 'image',
            images_upload_handler: (blobInfo, progress) => new Promise((resolve, reject) => {
                // For now, just use base64 - could integrate with cloud storage later
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject('Failed to read file');
                reader.readAsDataURL(blobInfo.blob());
            })
        });
    } else {
        console.warn('TinyMCE not loaded, using plain textarea');
    }
}

async function saveGuideFromEditor(publish = false) {
    const title = document.getElementById('guide-title').value.trim();
    const slug = document.getElementById('guide-slug').value.trim();
    const categoryId = document.getElementById('guide-category').value;
    const coverImage = document.getElementById('guide-cover').value.trim();
    const excerpt = document.getElementById('guide-excerpt').value.trim();
    const isFeatured = document.getElementById('guide-featured').checked;

    // Get content from TinyMCE or textarea
    let content = '';
    if (typeof tinymce !== 'undefined' && tinymce.get('guide-content')) {
        content = tinymce.get('guide-content').getContent();
    } else {
        content = document.getElementById('guide-content').value;
    }

    if (!title || !slug || !content) {
        alert('Vui lòng điền đầy đủ tiêu đề, slug và nội dung');
        return;
    }

    const guideData = {
        title,
        slug,
        content,
        excerpt,
        coverImage,
        categoryId: categoryId ? parseInt(categoryId) : null,
        isFeatured,
        isPublished: publish
    };

    try {
        if (currentEditingGuideId) {
            await fetchAPI(`${API_BASE_URL}/admin/community/guides/${currentEditingGuideId}`, 'PUT', guideData);
            logActivity('update', 'guide', `Updated guide: ${title}`);
        } else {
            await fetchAPI(`${API_BASE_URL}/admin/community/guides`, 'POST', guideData);
            logActivity('create', 'guide', `Created guide: ${title}`);
        }

        // Cleanup TinyMCE
        if (typeof tinymce !== 'undefined') {
            tinymce.remove('#guide-content');
        }

        loadCommunity();
        setTimeout(() => loadCommunityGuides(), 100);
    } catch (error) {
        console.error('Error saving guide:', error);
        alert('Không thể lưu hướng dẫn: ' + error.message);
    }
}

function editCategory(id) {
    // TODO: Implement category editing modal
    alert('Tính năng chỉnh sửa danh mục đang được phát triển');
}

// ============ MONEY VERIFICATION ============
let pendingMoneyRequests = [];

async function loadMoneyVerification() {
    const container = document.getElementById('community-tab-content');

    try {
        pendingMoneyRequests = await fetchAPI(`${API_BASE_URL}/money/pending`) || [];

        // Update badge
        const badge = document.getElementById('pending-money-count');
        if (badge) {
            if (pendingMoneyRequests.length > 0) {
                badge.textContent = pendingMoneyRequests.length;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        container.innerHTML = `
            <div class="bg-white rounded-xl shadow-sm">
                <div class="p-6 border-b border-gray-200">
                    <h3 class="text-lg font-semibold">Yêu cầu xác minh chuyển tiền</h3>
                    <p class="text-sm text-gray-500 mt-1">Duyệt các yêu cầu chuyển tiền từ người dùng</p>
                </div>
                <div class="p-6">
                    ${pendingMoneyRequests.length === 0 ? `
                        <div class="text-center py-12 text-gray-500">
                            <span class="material-icons-round text-5xl text-gray-300 mb-4">check_circle</span>
                            <p>Không có yêu cầu nào đang chờ duyệt</p>
                        </div>
                    ` : `
                        <div class="space-y-4">
                            ${pendingMoneyRequests.map(req => `
                                <div id="money-req-${req.id}" class="border border-gray-200 rounded-xl p-5 hover:shadow-md transition">
                                    <div class="flex items-start justify-between">
                                        <div class="flex-1">
                                            <div class="flex items-center gap-3 mb-3">
                                                <div class="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                                                    ${(req.sender?.fullName || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p class="font-semibold text-gray-800">${req.sender?.fullName || 'Người gửi'}</p>
                                                    <p class="text-xs text-gray-500">${req.sender?.email || ''}</p>
                                                </div>
                                                <span class="material-icons-round text-gray-400">arrow_forward</span>
                                                <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                                    ${(req.receiver?.fullName || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p class="font-semibold text-gray-800">${req.receiver?.fullName || 'Người nhận'}</p>
                                                    <p class="text-xs text-gray-500">${req.receiver?.email || ''}</p>
                                                </div>
                                            </div>
                                            <div class="bg-green-50 inline-block px-4 py-2 rounded-lg">
                                                <span class="text-2xl font-bold text-green-600">${formatCurrency(req.amount)}</span>
                                            </div>
                                            <p class="text-xs text-gray-400 mt-2">
                                                Yêu cầu lúc: ${new Date(req.createdAt).toLocaleString('vi-VN')}
                                            </p>
                                        </div>
                                        <div class="flex gap-2">
                                            <button onclick="approveMoneyRequest(${req.id}, '${req.sender?.fullName}', '${req.receiver?.fullName}', ${req.amount})" 
                                                class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center gap-2 transition">
                                                <span class="material-icons-round text-sm">check</span>
                                                Duyệt
                                            </button>
                                            <button onclick="showRejectModal(${req.id}, '${req.sender?.fullName}')" 
                                                class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium flex items-center gap-2 transition">
                                                <span class="material-icons-round text-sm">close</span>
                                                Từ chối
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading money requests:', error);
        container.innerHTML = '<div class="text-center py-8 text-gray-500">Không thể tải danh sách yêu cầu</div>';
    }
}

async function approveMoneyRequest(id, senderName, receiverName, amount) {
    const adminId = localStorage.getItem('userId') || 1;

    showConfirmModal({
        title: 'Xác nhận duyệt chuyển tiền',
        message: `Duyệt chuyển ${formatCurrency(amount)} từ <strong>${senderName}</strong> đến <strong>${receiverName}</strong>?<br><br>Tiền sẽ được trừ từ người gửi và cộng vào người nhận.`,
        confirmText: 'Duyệt ngay',
        confirmType: 'success',
        onConfirm: async () => {
            try {
                const result = await fetchAPI(`${API_BASE_URL}/money/approve/${id}?adminId=${adminId}`, 'POST', {});
                if (result && result.success) {
                    const element = document.getElementById(`money-req-${id}`);
                    if (element) {
                        gsap.to(element, {
                            opacity: 0,
                            x: 50,
                            duration: 0.3,
                            onComplete: () => {
                                element.remove();
                                loadMoneyVerification();
                            }
                        });
                    }
                    logActivity('approve', 'money-transfer', `Approved transfer ${formatCurrency(amount)} from ${senderName} to ${receiverName}`);
                }
            } catch (error) {
                console.error('Error approving:', error);
                alert('Không thể duyệt yêu cầu: ' + error.message);
            }
        }
    });
}

function showRejectModal(id, senderName) {
    document.getElementById('modal-container').innerHTML = `
        <div class="modal-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div class="modal-content bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
                <div class="p-6 border-b border-gray-200 flex justify-between items-center">
                    <h3 class="text-xl font-bold text-red-600">Từ chối yêu cầu</h3>
                    <button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-lg">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <div class="p-6">
                    <p class="text-gray-600 mb-4">Nhập lý do từ chối yêu cầu chuyển tiền của <strong>${senderName}</strong>:</p>
                    <textarea id="reject-reason" rows="3" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" placeholder="Nhập lý do từ chối..."></textarea>
                </div>
                <div class="p-6 border-t border-gray-200 flex justify-end gap-3">
                    <button onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Hủy</button>
                    <button onclick="rejectMoneyRequest(${id}, '${senderName}')" class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">Từ chối</button>
                </div>
            </div>
        </div>
    `;
}

async function rejectMoneyRequest(id, senderName) {
    const reason = document.getElementById('reject-reason')?.value?.trim();
    if (!reason) {
        alert('Vui lòng nhập lý do từ chối');
        return;
    }

    const adminId = localStorage.getItem('userId') || 1;

    try {
        const result = await fetchAPI(`${API_BASE_URL}/money/reject/${id}?adminId=${adminId}`, 'POST', { reason });
        if (result && result.success) {
            closeModal();
            const element = document.getElementById(`money-req-${id}`);
            if (element) {
                gsap.to(element, {
                    opacity: 0,
                    x: -50,
                    duration: 0.3,
                    onComplete: () => {
                        element.remove();
                        loadMoneyVerification();
                    }
                });
            }
            logActivity('reject', 'money-transfer', `Rejected transfer from ${senderName}: ${reason}`);
        }
    } catch (error) {
        console.error('Error rejecting:', error);
        alert('Không thể từ chối yêu cầu: ' + error.message);
    }
}

// Load pending count on community load
async function loadPendingMoneyCount() {
    try {
        const count = await fetchAPI(`${API_BASE_URL}/money/pending/count`);
        const badge = document.getElementById('pending-money-count');
        if (badge && count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error loading pending count:', error);
    }
}

// ============ ADMIN GROUP BUY (Gom mua) ============
let marketPricesForBuy = [];
let filteredMarketPricesForBuy = [];
let currentBuyCategory = 'ALL';

// Shop category constants for filtering (matches shop.js)
const SHOP_CATEGORY_LABELS = {
    'HAT_GIONG': 'Hạt giống',
    'CON_GIONG': 'Con giống',
    'PHAN_BON': 'Phân bón',
    'THUC_AN': 'Thức ăn',
    'THUOC_TRU_SAU': 'Thuốc BVTV',
    'MAY_MOC': 'Máy móc'
};

const SHOP_CATEGORY_ICONS = {
    'HAT_GIONG': 'grass',
    'CON_GIONG': 'pets',
    'PHAN_BON': 'compost',
    'THUC_AN': 'set_meal',
    'THUOC_TRU_SAU': 'bug_report',
    'MAY_MOC': 'agriculture'
};

async function loadAdminGroupBuy() {
    document.getElementById('page-title').textContent = 'Quản lý Gom Mua';

    try {
        const [sessions, marketPrices] = await Promise.all([
            fetchAPI(`${API_BASE_URL}/admin/trading/buy-sessions`),
            fetchAPI(`${API_BASE_URL}/admin/trading/market-prices/buy`)
        ]);

        groupBuySessions = sessions || [];
        marketPricesForBuy = marketPrices || [];
        filteredMarketPricesForBuy = [...marketPricesForBuy];
        currentBuyCategory = 'ALL';

        renderGroupBuyPage();
    } catch (error) {
        console.error('Error loading group buy:', error);
        document.getElementById('main-content').innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
                <span class="material-icons-round text-4xl text-red-400">error</span>
                <p class="text-red-600 mt-2">Không thể tải dữ liệu: ${error.message}</p>
            </div>
        `;
    }
}

function renderGroupBuyPage() {
    const openCount = groupBuySessions.filter(s => s.status === 'OPEN').length;
    const completedCount = groupBuySessions.filter(s => s.status === 'COMPLETED').length;

    document.getElementById('main-content').innerHTML = `
        <div class="space-y-6">
            <!-- Stats -->
            <div class="grid grid-cols-4 gap-4">
                <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span class="material-icons-round text-blue-600">shopping_cart</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-gray-800">${groupBuySessions.length}</p>
                            <p class="text-sm text-gray-500">Tổng phiên</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                            <span class="material-icons-round text-green-600">pending</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-gray-800">${openCount}</p>
                            <p class="text-sm text-gray-500">Đang mở</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                            <span class="material-icons-round text-purple-600">check_circle</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-gray-800">${completedCount}</p>
                            <p class="text-sm text-gray-500">Hoàn thành</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                            <span class="material-icons-round text-amber-600">inventory_2</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-gray-800">${marketPricesForBuy.length}</p>
                            <p class="text-sm text-gray-500">Sản phẩm có sẵn</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Create Button & List -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-100">
                <div class="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800">Phiên Gom Mua</h3>
                        <p class="text-sm text-gray-500">Admin bán sản phẩm cho HTX với giá ưu đãi</p>
                    </div>
                    <button onclick="showCreateBuySessionModal()" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark flex items-center gap-2">
                        <span class="material-icons-round text-sm">add</span>
                        Tạo phiên mua
                    </button>
                </div>
                <div class="divide-y divide-gray-100" id="buy-sessions-list">
                    ${renderBuySessionsList()}
                </div>
            </div>
        </div>
    `;

    gsap.fromTo('#main-content > div > *', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 });
}

function renderBuySessionsList() {
    if (groupBuySessions.length === 0) {
        return `
            <div class="p-12 text-center">
                <span class="material-icons-round text-5xl text-gray-300 mb-3">shopping_cart</span>
                <p class="text-gray-500">Chưa có phiên gom mua nào</p>
                <button onclick="showCreateBuySessionModal()" class="mt-4 text-primary hover:underline">Tạo phiên đầu tiên</button>
            </div>
        `;
    }

    return groupBuySessions.map(s => `
        <div class="p-6 hover:bg-gray-50 transition-colors">
            <div class="flex items-start justify-between">
                <div class="flex items-start gap-4">
                    <div class="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                        ${s.shopItemImage ? `<img src="${s.shopItemImage}" alt="" class="w-full h-full object-cover">` : '<span class="material-icons-round text-3xl text-gray-400">inventory_2</span>'}
                    </div>
                    <div>
                        <h4 class="font-semibold text-gray-800">${s.title}</h4>
                        <p class="text-sm text-gray-500">${s.shopItemName || 'N/A'}</p>
                        <div class="flex items-center gap-4 mt-2 text-sm">
                            <span class="text-green-600 font-medium">${formatCurrency(s.wholesalePrice)}</span>
                            <span class="text-gray-400 line-through">${formatCurrency(s.retailPrice)}</span>
                            <span class="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-medium">-${s.discountPercent}%</span>
                        </div>
                    </div>
                </div>
                <div class="text-right">
                    <span class="px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(s.status)}">${getStatusLabel(s.status)}</span>
                    <div class="mt-2">
                        <div class="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div class="h-full bg-primary rounded-full" style="width: ${s.progressPercent}%"></div>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">${s.currentQuantity}/${s.targetQuantity} (${s.progressPercent}%)</p>
                    </div>
                    ${s.participatingCoops?.length > 0 ? `<p class="text-xs text-gray-400 mt-2">${s.participatingCoops.length} HTX tham gia</p>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

async function showCreateBuySessionModal() {
    // Fetch shop items if not already loaded
    if (marketPricesForBuy.length === 0) {
        try {
            const shopItems = await fetchAPI('/shop/items');
            marketPricesForBuy = (shopItems || []).map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                unit: item.unit || 'đơn vị',
                stock: item.stockQuantity || 9999,
                imageUrl: item.imageUrl,
                category: item.category
            }));
        } catch (e) {
            console.error('Error fetching shop items:', e);
        }
    }

    // Reset filter on modal open
    currentBuyCategory = 'ALL';
    filteredMarketPricesForBuy = [...marketPricesForBuy];

    const productOptions = filteredMarketPricesForBuy.map(p =>
        `<option value="${p.id}" data-price="${p.price}" data-stock="${p.stock || 'Không giới hạn'}" data-image="${p.imageUrl || ''}">${p.name} - ${formatCurrency(p.price)}/${p.unit} (Kho: ${p.stock || '∞'})</option>`
    ).join('');

    // Build category dropdown options
    const categoryOptions = Object.entries(SHOP_CATEGORY_LABELS).map(([key, label]) => {
        const count = marketPricesForBuy.filter(p => p.category === key).length;
        if (count === 0) return '';
        return `<option value="${key}">${label} (${count})</option>`;
    }).join('');

    document.getElementById('modal-container').innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm modal-overlay">
            <div class="absolute inset-0" onclick="closeModal()"></div>
            <div class="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden modal-content">
                <div class="modal-header p-6 border-b border-gray-100 flex items-center justify-between">
                    <h3 class="modal-title text-xl font-bold flex items-center gap-2">
                        <span class="material-symbols-outlined text-emerald-500">add_shopping_cart</span>
                        Tạo phiên gom mua mới
                    </h3>
                    <button class="modal-close" onclick="closeModal()">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="p-6 space-y-4 max-h-[60vh] overflow-y-auto modal-body">
                    <div class="form-group">
                        <label class="form-label block text-sm font-medium text-gray-700 mb-2">Loại sản phẩm</label>
                        <select id="category-filter" class="form-select w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary" onchange="filterBuyProductsByCategory(this.value)">
                            <option value="ALL">Tất cả (${marketPricesForBuy.length})</option>
                            ${categoryOptions}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label block text-sm font-medium text-gray-700 mb-2" id="product-label">Sản phẩm vật tư * <span class="text-xs text-gray-500">(${filteredMarketPricesForBuy.length} sản phẩm)</span></label>
                        <select id="buy-session-item" class="form-select w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary" onchange="updateBuyProductInfo()">
                            <option value="">-- Chọn sản phẩm từ kho --</option>
                            ${productOptions}
                        </select>
                    </div>

                    <div id="product-info-box" class="hidden bg-blue-50 rounded-lg p-4">
                        <div class="flex items-center gap-3">
                            <img id="product-preview-img" src="" alt="" class="w-12 h-12 rounded-lg object-cover">
                            <div>
                                <p class="text-sm text-gray-600">Giá thị trường: <strong id="market-price-display">0đ</strong></p>
                                <p class="text-sm text-gray-600">Tồn kho: <strong id="stock-display">0</strong></p>
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label block text-sm font-medium text-gray-700 mb-2">Tiêu đề phiên *</label>
                        <input type="text" id="buy-session-title" class="form-input w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="VD: Gom mua phân bón NPK tháng 1">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label block text-sm font-medium text-gray-700 mb-2">Mục tiêu số lượng *</label>
                            <input type="number" id="buy-session-target" class="form-input w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary" min="1" value="10" oninput="updateBuyPriceCalculation()">
                        </div>
                        <div class="form-group">
                            <label class="form-label block text-sm font-medium text-gray-700 mb-2">Giá gom (VNĐ/đơn vị) *</label>
                            <input type="number" id="buy-session-price" class="form-input w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary" min="0" placeholder="Giá ưu đãi cho HTX" oninput="updateBuyPriceCalculation()">
                            <p id="price-warning" class="text-xs text-red-500 mt-1 hidden">Giá gom phải nhỏ hơn giá thị trường!</p>
                        </div>
                    </div>
                
                    <!-- Price Calculation Preview -->
                    <div id="buy-price-preview" class="hidden bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl p-4 border border-emerald-200">
                        <h4 class="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <span class="material-symbols-outlined text-emerald-600">calculate</span>
                            Tính toán giá trị phiên
                        </h4>
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p class="text-gray-500">Giá thị trường:</p>
                                <p class="font-semibold text-gray-800" id="calc-market-price">0đ</p>
                            </div>
                            <div>
                                <p class="text-gray-500">Giá gom đề xuất:</p>
                                <p class="font-semibold text-emerald-600" id="calc-wholesale-price">0đ</p>
                            </div>
                            <div>
                                <p class="text-gray-500">Tổng giá trị (thị trường):</p>
                                <p class="font-semibold text-gray-800" id="calc-total-market">0đ</p>
                            </div>
                            <div>
                                <p class="text-gray-500">Tổng giá trị (gom):</p>
                                <p class="font-semibold text-emerald-600" id="calc-total-wholesale">0đ</p>
                            </div>
                        </div>
                        <div class="mt-3 pt-3 border-t border-emerald-200 flex justify-between items-center">
                            <span class="text-gray-600">HTX tiết kiệm:</span>
                            <span class="text-lg font-bold text-green-600" id="calc-savings">0đ (0%)</span>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label block text-sm font-medium text-gray-700 mb-2">Hạn chót</label>
                        <input type="datetime-local" id="buy-session-deadline" class="form-input w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary">
                    </div>

                    <div class="form-group">
                        <label class="form-label block text-sm font-medium text-gray-700 mb-2">Ghi chú</label>
                        <textarea id="buy-session-note" class="form-input w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary" rows="2" placeholder="Ghi chú thêm cho HTX..."></textarea>
                    </div>
                </div>
                <div class="modal-footer p-6 border-t border-gray-100 flex justify-end gap-3">
                    <button onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Hủy</button>
                    <button onclick="createBuySession()" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">Tạo phiên</button>
                </div>
            </div>
        </div>
    `;

    animateModalOpen();
}


function filterBuyProductsByCategory(category) {
    currentBuyCategory = category;

    // Filter products
    if (category === 'ALL') {
        filteredMarketPricesForBuy = [...marketPricesForBuy];
    } else {
        filteredMarketPricesForBuy = marketPricesForBuy.filter(p => p.category === category);
    }

    // Update product dropdown in place (don't re-render entire modal)
    const productSelect = document.getElementById('buy-session-item');
    if (productSelect) {
        const productOptions = filteredMarketPricesForBuy.map(p =>
            `<option value="${p.id}" data-price="${p.price}" data-stock="${p.stock || 'Không giới hạn'}" data-image="${p.imageUrl || ''}">${p.name} - ${formatCurrency(p.price)}/${p.unit} (Kho: ${p.stock || '∞'})</option>`
        ).join('');

        productSelect.innerHTML = `<option value="">-- Chọn sản phẩm từ kho --</option>${productOptions}`;

        // Update count in label
        const label = document.getElementById('product-label');
        if (label) {
            label.innerHTML = `Sản phẩm vật tư * <span class="text-xs text-gray-500">(${filteredMarketPricesForBuy.length} sản phẩm)</span>`;
        }

        // Hide product info box
        const infoBox = document.getElementById('product-info-box');
        if (infoBox) {
            infoBox.classList.add('hidden');
        }

        // Hide price preview box
        const pricePreview = document.getElementById('buy-price-preview');
        if (pricePreview) {
            pricePreview.classList.add('hidden');
        }
    }
}

function updateBuyProductInfo() {
    const select = document.getElementById('buy-session-item');
    const option = select.options[select.selectedIndex];
    const infoBox = document.getElementById('product-info-box');

    if (option.value) {
        document.getElementById('market-price-display').textContent = formatCurrency(option.dataset.price);
        document.getElementById('stock-display').textContent = option.dataset.stock;
        const img = document.getElementById('product-preview-img');
        if (option.dataset.image) {
            img.src = option.dataset.image;
            img.classList.remove('hidden');
        } else {
            img.classList.add('hidden');
        }
        infoBox.classList.remove('hidden');
    } else {
        infoBox.classList.add('hidden');
    }

    // Trigger price calculation
    updateBuyPriceCalculation();
}

function updateBuyPriceCalculation() {
    const select = document.getElementById('buy-session-item');
    if (!select) return;

    const option = select.options[select.selectedIndex];
    const preview = document.getElementById('buy-price-preview');
    const targetQty = parseInt(document.getElementById('buy-session-target')?.value) || 0;
    const wholesalePrice = parseFloat(document.getElementById('buy-session-price')?.value) || 0;
    const warning = document.getElementById('price-warning');

    if (!option || !option.value) {
        if (preview) preview.classList.add('hidden');
        return;
    }

    const marketPrice = parseFloat(option.dataset.price) || 0;
    const unit = option.textContent.split('/')[1]?.split(' ')[0] || 'đơn vị';

    // Show preview when product is selected
    if (preview) {
        preview.classList.remove('hidden');
    }

    // Calculate values
    const totalMarketValue = marketPrice * targetQty;
    const totalWholesaleValue = wholesalePrice * targetQty;
    const savings = totalMarketValue - totalWholesaleValue;
    const savingsPercent = totalMarketValue > 0 ? ((savings / totalMarketValue) * 100).toFixed(1) : 0;

    // Update display
    const calcMarketPrice = document.getElementById('calc-market-price');
    const calcWholesalePrice = document.getElementById('calc-wholesale-price');
    const calcTotalMarket = document.getElementById('calc-total-market');
    const calcTotalWholesale = document.getElementById('calc-total-wholesale');
    const calcSavings = document.getElementById('calc-savings');

    if (calcMarketPrice) calcMarketPrice.textContent = `${formatCurrency(marketPrice)}/${unit}`;
    if (calcWholesalePrice) calcWholesalePrice.textContent = wholesalePrice > 0 ? `${formatCurrency(wholesalePrice)}/${unit}` : 'Chưa nhập';
    if (calcTotalMarket) calcTotalMarket.textContent = formatCurrency(totalMarketValue);
    if (calcTotalWholesale) calcTotalWholesale.textContent = wholesalePrice > 0 ? formatCurrency(totalWholesaleValue) : 'Chưa tính';

    // Update savings and validate price
    if (calcSavings) {
        if (wholesalePrice > 0 && wholesalePrice < marketPrice) {
            calcSavings.textContent = `${formatCurrency(savings)} (${savingsPercent}%)`;
            calcSavings.className = 'text-lg font-bold text-green-600';
            if (warning) warning.classList.add('hidden');
        } else if (wholesalePrice >= marketPrice) {
            calcSavings.textContent = 'Giá gom phải thấp hơn giá thị trường!';
            calcSavings.className = 'text-lg font-bold text-red-600';
            if (warning) warning.classList.remove('hidden');
        } else {
            calcSavings.textContent = '---';
            calcSavings.className = 'text-lg font-bold text-gray-400';
            if (warning) warning.classList.add('hidden');
        }
    }
}

function validateBuyPrice() {
    const select = document.getElementById('buy-session-item');
    const option = select.options[select.selectedIndex];
    const priceInput = document.getElementById('buy-session-price');
    const warning = document.getElementById('price-warning');

    if (option.value && parseFloat(priceInput.value) >= parseFloat(option.dataset.price)) {
        warning.classList.remove('hidden');
        return false;
    }
    warning.classList.add('hidden');
    return true;
}

async function createBuySession() {
    if (!validateBuyPrice()) {
        alert('Giá gom phải nhỏ hơn giá thị trường!');
        return;
    }

    const data = {
        shopItemId: parseInt(document.getElementById('buy-session-item').value),
        title: document.getElementById('buy-session-title').value,
        targetQuantity: parseInt(document.getElementById('buy-session-target').value),
        wholesalePrice: parseFloat(document.getElementById('buy-session-price').value),
        deadline: document.getElementById('buy-session-deadline').value ? new Date(document.getElementById('buy-session-deadline').value).toISOString() : null,
        note: document.getElementById('buy-session-note').value
    };

    if (!data.shopItemId || !data.title || !data.targetQuantity || !data.wholesalePrice) {
        alert('Vui lòng điền đầy đủ thông tin bắt buộc!');
        return;
    }

    try {
        await fetchAPI(`${API_BASE_URL}/admin/trading/buy-sessions`, 'POST', data);
        closeModal();

        // Reload cooperatives page and go to buy tab
        if (typeof loadCooperatives === 'function') {
            await loadCooperatives();
            setTimeout(() => {
                if (typeof switchCooperativeTab === 'function') {
                    switchCooperativeTab('buy');
                }
            }, 100);
        } else {
            // Fallback for standalone page if exists
            loadAdminGroupBuy();
        }

        logActivity('CREATE', 'group-buy', `Created buy session: ${data.title}`);
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

// ============ ADMIN GROUP SELL (Gom bán) ============
let marketPricesForSell = [];

async function loadAdminGroupSell() {
    document.getElementById('page-title').textContent = 'Quản lý Gom Bán';

    try {
        const [sessions, marketPrices] = await Promise.all([
            fetchAPI(`${API_BASE_URL}/admin/trading/sell-sessions`),
            fetchAPI(`${API_BASE_URL}/admin/trading/market-prices/sell`)
        ]);

        groupSellSessions = sessions || [];
        marketPricesForSell = marketPrices || [];

        renderGroupSellPage();
    } catch (error) {
        console.error('Error loading group sell:', error);
        document.getElementById('main-content').innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
                <span class="material-icons-round text-4xl text-red-400">error</span>
                <p class="text-red-600 mt-2">Không thể tải dữ liệu: ${error.message}</p>
            </div>
        `;
    }
}

function renderGroupSellPage() {
    const openCount = groupSellSessions.filter(s => s.status === 'OPEN').length;
    const readyCount = groupSellSessions.filter(s => s.status === 'READY').length;

    document.getElementById('main-content').innerHTML = `
        <div class="space-y-6">
            <!-- Stats -->
            <div class="grid grid-cols-4 gap-4">
                <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <span class="material-icons-round text-emerald-600">sell</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-gray-800">${groupSellSessions.length}</p>
                            <p class="text-sm text-gray-500">Tổng phiên</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span class="material-icons-round text-blue-600">pending</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-gray-800">${openCount}</p>
                            <p class="text-sm text-gray-500">Đang thu gom</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                            <span class="material-icons-round text-amber-600">inventory</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-gray-800">${readyCount}</p>
                            <p class="text-sm text-gray-500">Sẵn sàng mua</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                            <span class="material-icons-round text-purple-600">grass</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-gray-800">${marketPricesForSell.length}</p>
                            <p class="text-sm text-gray-500">Loại nông sản</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Create Button & List -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-100">
                <div class="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800">Phiên Gom Bán</h3>
                        <p class="text-sm text-gray-500">Admin mua nông sản từ HTX với giá cao hơn thị trường</p>
                    </div>
                    <button onclick="showCreateSellSessionModal()" class="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 flex items-center gap-2">
                        <span class="material-icons-round text-sm">add</span>
                        Tạo phiên bán
                    </button>
                </div>
                <div class="divide-y divide-gray-100" id="sell-sessions-list">
                    ${renderSellSessionsList()}
                </div>
            </div>
        </div>
    `;

    gsap.fromTo('#main-content > div > *', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 });
}

function renderSellSessionsList() {
    if (groupSellSessions.length === 0) {
        return `
            <div class="p-12 text-center">
                <span class="material-icons-round text-5xl text-gray-300 mb-3">sell</span>
                <p class="text-gray-500">Chưa có phiên gom bán nào</p>
                <button onclick="showCreateSellSessionModal()" class="mt-4 text-emerald-600 hover:underline">Tạo phiên đầu tiên</button>
            </div>
        `;
    }

    return groupSellSessions.map(s => `
        <div class="p-6 hover:bg-gray-50 transition-colors">
            <div class="flex items-start justify-between">
                <div class="flex items-start gap-4">
                    <div class="w-16 h-16 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <span class="material-icons-round text-3xl text-emerald-600">grass</span>
                    </div>
                    <div>
                        <h4 class="font-semibold text-gray-800">${s.productName}</h4>
                        <p class="text-sm text-gray-500">${s.description || 'Không có mô tả'}</p>
                        <div class="flex items-center gap-4 mt-2 text-sm">
                            <span class="text-emerald-600 font-medium">Giá thu: ${formatCurrency(s.minPrice)}/${s.unit}</span>
                            ${s.marketPrice ? `<span class="text-gray-400">(Thị trường: ${formatCurrency(s.marketPrice)})</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="text-right">
                    <span class="px-3 py-1 rounded-full text-xs font-medium ${getSellStatusClass(s.status)}">${getSellStatusLabel(s.status)}</span>
                    <div class="mt-2">
                        <div class="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div class="h-full bg-emerald-500 rounded-full" style="width: ${s.progressPercent}%"></div>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">${s.currentQuantity}/${s.targetQuantity} ${s.unit} (${s.progressPercent}%)</p>
                    </div>
                    ${s.participatingCoops?.length > 0 ? `<p class="text-xs text-gray-400 mt-2">${s.participatingCoops.length} HTX góp sản phẩm</p>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function showCreateSellSessionModal() {
    const cropOptions = marketPricesForSell.filter(p => p.productType === 'CROP').map(p =>
        `<option value="crop-${p.id}" data-price="${p.price || 0}" data-type="crop">${p.name} - ${formatCurrency(p.price || 0)}/kg</option>`
    ).join('');

    const animalOptions = marketPricesForSell.filter(p => p.productType === 'ANIMAL').map(p =>
        `<option value="animal-${p.id}" data-price="${p.price || 0}" data-type="animal">${p.name} - ${formatCurrency(p.price || 0)}/${p.unit}</option>`
    ).join('');

    document.getElementById('modal-container').innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm modal-overlay">
            <div class="absolute inset-0" onclick="closeModal()"></div>
            <div class="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden modal-content">
                <div class="p-6 border-b border-gray-100">
                    <h3 class="text-xl font-bold text-gray-800">Tạo Phiên Gom Bán</h3>
                    <p class="text-sm text-gray-500 mt-1">Mua nông sản từ HTX với giá cao hơn thị trường</p>
                </div>
                <div class="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Loại nông sản *</label>
                        <select id="sell-product" class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" onchange="updateSellProductInfo()">
                            <option value="">-- Chọn nông sản --</option>
                            <optgroup label="Cây trồng">${cropOptions}</optgroup>
                            <optgroup label="Vật nuôi">${animalOptions}</optgroup>
                        </select>
                    </div>
                    <div id="sell-product-info" class="hidden bg-emerald-50 rounded-lg p-4">
                        <p class="text-sm text-gray-600">Giá thị trường: <strong id="sell-market-price">0đ</strong></p>
                        <p class="text-xs text-gray-500 mt-1">Giá thu mua cần cao hơn giá này để hấp dẫn HTX</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Mô tả</label>
                        <textarea id="sell-description" rows="2" class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" placeholder="Mô tả chi tiết về yêu cầu chất lượng..."></textarea>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Số lượng cần *</label>
                            <input type="number" id="sell-target" class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" placeholder="1000" min="1">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Đơn vị</label>
                            <input type="text" id="sell-unit" class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" placeholder="kg">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Giá thu mua (VNĐ/đơn vị) *</label>
                        <input type="number" id="sell-min-price" class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" placeholder="Phải cao hơn giá thị trường" min="0" onchange="validateSellPrice()">
                        <p id="sell-price-warning" class="text-xs text-red-500 mt-1 hidden">Giá thu mua nên cao hơn giá thị trường!</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Hạn chót</label>
                        <input type="datetime-local" id="sell-deadline" class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    </div>
                </div>
                <div class="p-6 border-t border-gray-100 flex justify-end gap-3">
                    <button onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Hủy</button>
                    <button onclick="createSellSession()" class="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">Tạo phiên</button>
                </div>
            </div>
        </div>
    `;

    animateModalOpen();
}

function updateSellProductInfo() {
    const select = document.getElementById('sell-product');
    const option = select.options[select.selectedIndex];
    const infoBox = document.getElementById('sell-product-info');

    if (option.value) {
        document.getElementById('sell-market-price').textContent = formatCurrency(option.dataset.price);
        infoBox.classList.remove('hidden');
    } else {
        infoBox.classList.add('hidden');
    }
}

function validateSellPrice() {
    const select = document.getElementById('sell-product');
    const option = select.options[select.selectedIndex];
    const priceInput = document.getElementById('sell-min-price');
    const warning = document.getElementById('sell-price-warning');

    if (option.value && parseFloat(priceInput.value) <= parseFloat(option.dataset.price)) {
        warning.classList.remove('hidden');
        return false;
    }
    warning.classList.add('hidden');
    return true;
}

async function createSellSession() {
    const productSelect = document.getElementById('sell-product');
    const option = productSelect.options[productSelect.selectedIndex];
    const productValue = option.value;
    const productType = option.dataset.type;

    const data = {
        productName: option.text.split(' - ')[0],
        description: document.getElementById('sell-description').value,
        targetQuantity: parseInt(document.getElementById('sell-target').value),
        minPrice: parseFloat(document.getElementById('sell-min-price').value),
        unit: document.getElementById('sell-unit').value || 'kg',
        marketPrice: parseFloat(option.dataset.price) || null,
        deadline: document.getElementById('sell-deadline').value ? new Date(document.getElementById('sell-deadline').value).toISOString() : null
    };

    if (productType === 'crop') {
        data.cropDefinitionId = parseInt(productValue.replace('crop-', ''));
    } else if (productType === 'animal') {
        data.animalDefinitionId = parseInt(productValue.replace('animal-', ''));
    }

    if (!productValue || !data.targetQuantity || !data.minPrice) {
        alert('Vui lòng điền đầy đủ thông tin bắt buộc!');
        return;
    }

    try {
        await fetchAPI(`${API_BASE_URL}/admin/trading/sell-sessions`, 'POST', data);
        closeModal();
        loadAdminGroupSell();
        logActivity('CREATE', 'group-sell', `Created sell session: ${data.productName}`);
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

// Helper functions for status
function getStatusClass(status) {
    const classes = {
        'OPEN': 'bg-blue-100 text-blue-700',
        'COMPLETED': 'bg-green-100 text-green-700',
        'ORDERED': 'bg-purple-100 text-purple-700',
        'CANCELLED': 'bg-red-100 text-red-700',
        'EXPIRED': 'bg-gray-100 text-gray-700'
    };
    return classes[status] || 'bg-gray-100 text-gray-700';
}

function getStatusLabel(status) {
    const labels = {
        'OPEN': 'Đang mở',
        'COMPLETED': 'Đã đủ',
        'ORDERED': 'Đã đặt hàng',
        'CANCELLED': 'Đã hủy',
        'EXPIRED': 'Hết hạn'
    };
    return labels[status] || status;
}

function getSellStatusClass(status) {
    const classes = {
        'OPEN': 'bg-blue-100 text-blue-700',
        'READY': 'bg-amber-100 text-amber-700',
        'SOLD': 'bg-green-100 text-green-700',
        'CANCELLED': 'bg-red-100 text-red-700',
        'EXPIRED': 'bg-gray-100 text-gray-700'
    };
    return classes[status] || 'bg-gray-100 text-gray-700';
}

function getSellStatusLabel(status) {
    const labels = {
        'OPEN': 'Đang thu gom',
        'READY': 'Sẵn sàng mua',
        'SOLD': 'Đã bán',
        'CANCELLED': 'Đã hủy',
        'EXPIRED': 'Hết hạn'
    };
    return labels[status] || status;
}

// ============ ADMIN GROUP BUY (Gom mua) ============

let adminBuySessions = [];

async function loadAdminGroupBuy() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="page-header">
            <div class="page-header__left">
                <h1 class="page-title">
                    <span class="material-symbols-outlined text-emerald-500">shopping_cart</span>
                    Quản lý Gom Mua
                </h1>
                <p class="page-subtitle">Tạo và quản lý phiên gom mua cho HTX</p>
            </div>
            <div class="page-header__actions">
                <button class="btn-primary" onclick="showCreateBuySessionModal()">
                    <span class="material-symbols-outlined">add</span>
                    Tạo phiên mới
                </button>
            </div>
        </div>
        
        <div class="stats-grid mb-6">
            <div class="stat-card">
                <div class="stat-icon bg-emerald-100"><span class="material-symbols-outlined text-emerald-600">pending</span></div>
                <div class="stat-content">
                    <p class="stat-label">Đang mở</p>
                    <p class="stat-value" id="buy-open-count">0</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon bg-green-100"><span class="material-symbols-outlined text-green-600">check_circle</span></div>
                <div class="stat-content">
                    <p class="stat-label">Hoàn thành</p>
                    <p class="stat-value" id="buy-completed-count">0</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon bg-red-100"><span class="material-symbols-outlined text-red-600">cancel</span></div>
                <div class="stat-content">
                    <p class="stat-label">Đã đóng</p>
                    <p class="stat-value" id="buy-closed-count">0</p>
                </div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h3>Tất cả phiên gom mua</h3>
            </div>
            <div class="card-body">
                <div id="buy-sessions-grid" class="sessions-grid">
                    <div class="loading-spinner">Đang tải...</div>
                </div>
            </div>
        </div>
    `;

    await fetchBuySessions();
}

async function fetchBuySessions() {
    try {
        const response = await fetchAPI('/admin/trading/buy-sessions');
        adminBuySessions = response;
        renderBuySessions();
        updateBuyStats();
    } catch (error) {
        console.error('Error fetching buy sessions:', error);
        document.getElementById('buy-sessions-grid').innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">error</span>
                <p>Không thể tải dữ liệu</p>
            </div>
        `;
    }
}

function updateBuyStats() {
    const open = adminBuySessions.filter(s => s.status === 'OPEN').length;
    const completed = adminBuySessions.filter(s => s.status === 'COMPLETED' || s.status === 'ORDERED').length;
    const closed = adminBuySessions.filter(s => s.status === 'CANCELLED' || s.status === 'EXPIRED').length;

    document.getElementById('buy-open-count').textContent = open;
    document.getElementById('buy-completed-count').textContent = completed;
    document.getElementById('buy-closed-count').textContent = closed;
}

function renderBuySessions() {
    const container = document.getElementById('buy-sessions-grid');

    if (adminBuySessions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">shopping_cart</span>
                <p>Chưa có phiên gom mua nào</p>
                <button class="btn-primary mt-4" onclick="showCreateBuySessionModal()">Tạo phiên mới</button>
            </div>
        `;
        return;
    }

    container.innerHTML = adminBuySessions.map(session => renderBuySessionCard(session)).join('');
}

function renderBuySessionCard(session) {
    const isCompleted = session.closedReason === 'AUTO_COMPLETED';
    const isForceClosed = session.closedReason === 'ADMIN_FORCED';
    const isOpen = session.status === 'OPEN';

    let borderClass = 'border-gray-200';
    let tickIcon = '';

    if (isCompleted) {
        borderClass = 'border-green-500 border-2';
        tickIcon = '<div class="session-tick tick-green"><span class="material-symbols-outlined">check_circle</span></div>';
    } else if (isForceClosed) {
        borderClass = 'border-red-500 border-2';
        tickIcon = '<div class="session-tick tick-red"><span class="material-symbols-outlined">cancel</span></div>';
    }

    return `
        <div class="session-card ${borderClass}" data-id="${session.id}">
            ${tickIcon}
            <div class="session-card__header">
                <h4 class="session-card__title">${session.title}</h4>
                <span class="status-badge ${getBuyStatusClass(session.status)}">${getBuyStatusLabel(session.status)}</span>
            </div>
            <div class="session-card__body">
                <p class="session-card__product">${session.shopItemName || 'Sản phẩm'}</p>
                <div class="session-card__prices">
                    <span class="price-wholesale">${formatCurrency(session.wholesalePrice)}</span>
                    <span class="price-retail">${formatCurrency(session.retailPrice)}</span>
                    <span class="discount-badge">-${session.discountPercent}%</span>
                </div>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill ${session.progressPercent >= 100 ? 'bg-green-500' : ''}" style="width: ${session.progressPercent}%"></div>
                    </div>
                    <div class="progress-text">
                        <span>${session.currentQuantity}/${session.targetQuantity}</span>
                        <span>${session.progressPercent}%</span>
                    </div>
                </div>
                ${session.note ? `<p class="session-card__note">${session.note}</p>` : ''}
            </div>
            <div class="session-card__footer">
                ${isOpen ? `
                    <button class="btn-danger-outline btn-sm" onclick="showForceCloseModal('buy', ${session.id}, '${session.title}')">
                        <span class="material-symbols-outlined">block</span>
                        Đóng phiên
                    </button>
                ` : `
                    <span class="text-gray-500 text-sm">
                        ${session.closedAt ? 'Đóng: ' + new Date(session.closedAt).toLocaleDateString('vi-VN') : ''}
                    </span>
                `}
            </div>
        </div>
    `;
}

// ============ ADMIN GROUP SELL (Gom bán) ============

let adminSellSessions = [];

async function loadAdminGroupSell() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="page-header">
            <div class="page-header__left">
                <h1 class="page-title">
                    <span class="material-symbols-outlined text-orange-500">sell</span>
                    Quản lý Gom Bán
                </h1>
                <p class="page-subtitle">Tạo phiên thu mua nông sản từ HTX</p>
            </div>
            <div class="page-header__actions">
                <button class="btn-primary" onclick="showCreateSellSessionModal()">
                    <span class="material-symbols-outlined">add</span>
                    Tạo phiên mới
                </button>
            </div>
        </div>
        
        <div class="stats-grid mb-6">
            <div class="stat-card">
                <div class="stat-icon bg-orange-100"><span class="material-symbols-outlined text-orange-600">pending</span></div>
                <div class="stat-content">
                    <p class="stat-label">Đang thu gom</p>
                    <p class="stat-value" id="sell-open-count">0</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon bg-green-100"><span class="material-symbols-outlined text-green-600">check_circle</span></div>
                <div class="stat-content">
                    <p class="stat-label">Sẵn sàng mua</p>
                    <p class="stat-value" id="sell-ready-count">0</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon bg-red-100"><span class="material-symbols-outlined text-red-600">cancel</span></div>
                <div class="stat-content">
                    <p class="stat-label">Đã đóng</p>
                    <p class="stat-value" id="sell-closed-count">0</p>
                </div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h3>Tất cả phiên gom bán</h3>
            </div>
            <div class="card-body">
                <div id="sell-sessions-grid" class="sessions-grid">
                    <div class="loading-spinner">Đang tải...</div>
                </div>
            </div>
        </div>
    `;

    await fetchSellSessions();
}

async function fetchSellSessions() {
    try {
        const response = await fetchAPI('/admin/trading/sell-sessions');
        adminSellSessions = response;
        renderSellSessions();
        updateSellStats();
    } catch (error) {
        console.error('Error fetching sell sessions:', error);
        document.getElementById('sell-sessions-grid').innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">error</span>
                <p>Không thể tải dữ liệu</p>
            </div>
        `;
    }
}

function updateSellStats() {
    const open = adminSellSessions.filter(s => s.status === 'OPEN').length;
    const ready = adminSellSessions.filter(s => s.status === 'READY' || s.status === 'SOLD').length;
    const closed = adminSellSessions.filter(s => s.status === 'CANCELLED' || s.status === 'EXPIRED').length;

    document.getElementById('sell-open-count').textContent = open;
    document.getElementById('sell-ready-count').textContent = ready;
    document.getElementById('sell-closed-count').textContent = closed;
}

function renderSellSessions() {
    const container = document.getElementById('sell-sessions-grid');

    if (adminSellSessions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">agriculture</span>
                <p>Chưa có phiên gom bán nào</p>
                <button class="btn-primary mt-4" onclick="showCreateSellSessionModal()">Tạo phiên mới</button>
            </div>
        `;
        return;
    }

    container.innerHTML = adminSellSessions.map(session => renderSellSessionCard(session)).join('');
}

function renderSellSessionCard(session) {
    const isCompleted = session.closedReason === 'AUTO_COMPLETED';
    const isForceClosed = session.closedReason === 'ADMIN_FORCED';
    const isOpen = session.status === 'OPEN';

    let borderClass = 'border-gray-200';
    let tickIcon = '';

    if (isCompleted) {
        borderClass = 'border-green-500 border-2';
        tickIcon = '<div class="session-tick tick-green"><span class="material-symbols-outlined">check_circle</span></div>';
    } else if (isForceClosed) {
        borderClass = 'border-red-500 border-2';
        tickIcon = '<div class="session-tick tick-red"><span class="material-symbols-outlined">cancel</span></div>';
    }

    return `
        <div class="session-card ${borderClass}" data-id="${session.id}">
            ${tickIcon}
            <div class="session-card__header">
                <h4 class="session-card__title">${session.productName}</h4>
                <span class="status-badge ${getSellStatusClass(session.status)}">${getSellStatusLabel(session.status)}</span>
            </div>
            <div class="session-card__body">
                <p class="session-card__description">${session.description || ''}</p>
                <div class="session-card__price-info">
                    <span class="price-buy">Giá thu: ${formatCurrency(session.minPrice)}/${session.unit}</span>
                    ${session.marketPrice ? `<span class="price-market">(Thị trường: ${formatCurrency(session.marketPrice)})</span>` : ''}
                </div>
                <div class="progress-container">
                    <div class="progress-bar progress-bar--sell">
                        <div class="progress-fill ${session.progressPercent >= 100 ? 'bg-green-500' : 'bg-orange-500'}" style="width: ${session.progressPercent}%"></div>
                    </div>
                    <div class="progress-text">
                        <span>${session.currentQuantity}/${session.targetQuantity} ${session.unit}</span>
                        <span>${session.progressPercent}%</span>
                    </div>
                </div>
            </div>
            <div class="session-card__footer">
                ${isOpen ? `
                    <button class="btn-danger-outline btn-sm" onclick="showForceCloseModal('sell', ${session.id}, '${session.productName}')">
                        <span class="material-symbols-outlined">block</span>
                        Đóng phiên
                    </button>
                ` : `
                    <span class="text-gray-500 text-sm">
                        ${session.closedAt ? 'Đóng: ' + new Date(session.closedAt).toLocaleDateString('vi-VN') : ''}
                    </span>
                `}
            </div>
        </div>
    `;
}

// ============ FORCE CLOSE MODAL ============

function showForceCloseModal(type, sessionId, sessionTitle) {
    const modal = document.getElementById('modal');
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeModal()"></div>
        <div class="modal-container modal-danger">
            <div class="modal-header bg-red-50 border-b border-red-200">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <span class="material-symbols-outlined text-red-600">warning</span>
                    </div>
                    <div>
                        <h3 class="modal-title text-red-700">⚠️ Cảnh báo nghiêm trọng</h3>
                        <p class="text-red-600 text-sm">Hành động này KHÔNG THỂ hoàn tác</p>
                    </div>
                </div>
                <button class="modal-close" onclick="closeModal()">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="modal-body">
                <div class="alert alert-danger mb-4">
                    <span class="material-symbols-outlined">gavel</span>
                    <div>
                        <p class="font-semibold">Hành động này có thể:</p>
                        <ul class="list-disc ml-4 mt-2 text-sm">
                            <li>Ảnh hưởng đến người dùng đã đóng góp vào phiên</li>
                            <li>Gây mất niềm tin từ cộng đồng HTX</li>
                            <li><strong>Vi phạm pháp luật</strong> nếu không có lý do chính đáng</li>
                        </ul>
                    </div>
                </div>
                
                <div class="session-info-box mb-4">
                    <p class="text-sm text-gray-500">Phiên sẽ bị đóng:</p>
                    <p class="font-semibold text-lg">${sessionTitle}</p>
                </div>
                
                <div class="form-group">
                    <label class="form-label required">Lý do đóng phiên</label>
                    <textarea id="force-close-reason" class="form-input" rows="3" 
                        placeholder="Nhập lý do chi tiết tại sao phải đóng phiên này..." required></textarea>
                    <p class="form-hint text-red-500">Lý do này sẽ được lưu lại và hiển thị cho người dùng</p>
                </div>
                
                <div class="form-group">
                    <label class="flex items-center gap-2">
                        <input type="checkbox" id="force-close-confirm" class="form-checkbox">
                        <span class="text-sm">Tôi hiểu rằng hành động này có thể ảnh hưởng đến người dùng và chịu trách nhiệm về quyết định này</span>
                    </label>
                </div>
            </div>
            <div class="modal-footer bg-red-50 border-t border-red-200">
                <button class="btn-secondary" onclick="closeModal()">Hủy</button>
                <button class="btn-danger" id="force-close-btn" onclick="confirmForceClose('${type}', ${sessionId})" disabled>
                    <span class="material-symbols-outlined">block</span>
                    Xác nhận đóng phiên
                </button>
            </div>
        </div>
    `;

    modal.classList.add('active');

    // Enable button only when checkbox is checked and reason is provided
    const checkbox = document.getElementById('force-close-confirm');
    const reason = document.getElementById('force-close-reason');
    const btn = document.getElementById('force-close-btn');

    function checkValid() {
        btn.disabled = !(checkbox.checked && reason.value.trim().length > 10);
    }

    checkbox.addEventListener('change', checkValid);
    reason.addEventListener('input', checkValid);
}

async function confirmForceClose(type, sessionId) {
    const reason = document.getElementById('force-close-reason').value.trim();

    if (!reason || reason.length < 10) {
        alert('Vui lòng nhập lý do chi tiết (ít nhất 10 ký tự)');
        return;
    }

    const endpoint = type === 'buy'
        ? `/admin/trading/buy-sessions/${sessionId}/force-close`
        : `/admin/trading/sell-sessions/${sessionId}/force-close`;

    try {
        await fetchAPI(endpoint, 'POST', { reason });
        closeModal();
        showToast('Thành công', 'Phiên đã được đóng', 'success');

        // Reload the cooperatives page
        loadCooperatives();
        setTimeout(() => switchCooperativeTab(type === 'buy' ? 'buy' : 'sell'), 500);
    } catch (error) {
        console.error('Error force closing session:', error);
        showToast('Lỗi', 'Không thể đóng phiên: ' + (error.message || 'Unknown error'), 'error');
    }
}

// ============ CREATE SESSION MODALS ============
// Note: showCreateBuySessionModal is defined earlier in the file with category filter support


function updateBuyCalculation() {
    const select = document.getElementById('buy-session-item');
    const preview = document.getElementById('buy-price-preview');
    const selected = select.options[select.selectedIndex];
    const targetQty = parseInt(document.getElementById('buy-session-target').value) || 0;
    const wholesalePrice = parseFloat(document.getElementById('buy-session-price').value) || 0;

    if (selected && selected.dataset.price) {
        const marketPrice = parseFloat(selected.dataset.price);
        const unit = selected.dataset.unit || 'đơn vị';

        // Calculate values
        const totalMarketValue = marketPrice * targetQty;
        const totalWholesaleValue = wholesalePrice * targetQty;
        const savings = totalMarketValue - totalWholesaleValue;
        const savingsPercent = totalMarketValue > 0 ? ((savings / totalMarketValue) * 100).toFixed(1) : 0;

        // Update display
        document.getElementById('market-price-per-unit').textContent = `${formatCurrency(marketPrice)}/${unit}`;
        document.getElementById('wholesale-price-per-unit').textContent = wholesalePrice > 0 ? `${formatCurrency(wholesalePrice)}/${unit}` : 'Chưa nhập';
        document.getElementById('total-market-value').textContent = formatCurrency(totalMarketValue);
        document.getElementById('total-wholesale-value').textContent = wholesalePrice > 0 ? formatCurrency(totalWholesaleValue) : 'Chưa tính';

        if (wholesalePrice > 0 && wholesalePrice < marketPrice) {
            document.getElementById('total-savings').textContent = `${formatCurrency(savings)} (${savingsPercent}%)`;
            document.getElementById('total-savings').className = 'text-lg font-bold text-green-600';
        } else if (wholesalePrice >= marketPrice) {
            document.getElementById('total-savings').textContent = 'Giá gom phải thấp hơn giá thị trường!';
            document.getElementById('total-savings').className = 'text-lg font-bold text-red-600';
        } else {
            document.getElementById('total-savings').textContent = '---';
            document.getElementById('total-savings').className = 'text-lg font-bold text-gray-400';
        }

        preview.classList.remove('hidden');
    } else {
        preview.classList.add('hidden');
    }
}

async function createBuySession() {
    const title = document.getElementById('buy-session-title').value.trim();
    const shopItemId = document.getElementById('buy-session-item').value;
    const targetQuantity = parseInt(document.getElementById('buy-session-target').value);
    const wholesalePrice = parseFloat(document.getElementById('buy-session-price').value);
    const note = document.getElementById('buy-session-note').value.trim();

    if (!title || !shopItemId || !targetQuantity || !wholesalePrice) {
        alert('Vui lòng điền đầy đủ thông tin');
        return;
    }

    try {
        await fetchAPI('/admin/trading/buy-sessions', 'POST', {
            title,
            shopItemId: parseInt(shopItemId),
            targetQuantity,
            wholesalePrice,
            note
        });

        closeModal();
        showToast('Thành công', 'Đã tạo phiên gom mua', 'success');
        // Reload cooperatives page and go to buy tab
        loadCooperatives();
        setTimeout(() => switchCooperativeTab('buy'), 500);
    } catch (error) {
        console.error('Error creating buy session:', error);
        showToast('Lỗi', error.message || 'Không thể tạo phiên', 'error');
    }
}

async function showCreateSellSessionModal() {
    // Fetch crop and animal definitions for selection (products from user's harvest)
    let crops = [];
    let animals = [];
    try {
        [crops, animals] = await Promise.all([
            fetchAPI('/crops'),
            fetchAPI('/livestock/animals')
        ]);
    } catch (e) {
        console.error('Error fetching definitions:', e);
    }

    const modal = document.getElementById('modal');
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeModal()"></div>
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title">
                    <span class="material-symbols-outlined text-orange-500">agriculture</span>
                    Tạo phiên thu mua nông sản
                </h3>
                <button class="modal-close" onclick="closeModal()">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="modal-body">
                <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
                    <span class="material-symbols-outlined text-amber-600 align-middle mr-1">info</span>
                    Thu mua nông sản từ HTX (sản phẩm user thu hoạch từ trồng trọt/chăn nuôi)
                </div>
                
                <div class="form-group">
                    <label class="form-label required">Loại nông sản</label>
                    <select id="sell-session-type" class="form-select" onchange="toggleSellProductSelect()">
                        <option value="crop">🌾 Cây trồng (thu hoạch từ ruộng)</option>
                        <option value="animal">🐄 Vật nuôi (từ chuồng trại)</option>
                    </select>
                </div>
                <div class="form-group" id="crop-select-group">
                    <label class="form-label required">Chọn cây trồng</label>
                    <select id="sell-session-crop" class="form-select" onchange="updateSellCalculation()">
                        <option value="">-- Chọn cây trồng --</option>
                        ${crops.map(c => `<option value="${c.id}" data-price="${c.marketPricePerKg || 0}" data-name="${c.name}">${c.name} - Giá thị trường: ${formatCurrency(c.marketPricePerKg || 0)}/kg</option>`).join('')}
                    </select>
                </div>
                <div class="form-group hidden" id="animal-select-group">
                    <label class="form-label required">Chọn vật nuôi</label>
                    <select id="sell-session-animal" class="form-select" onchange="updateSellCalculation()">
                        <option value="">-- Chọn vật nuôi --</option>
                        ${animals.map(a => `<option value="${a.id}" data-price="${a.sellPricePerUnit || 0}" data-name="${a.name}" data-unit="${a.unit || 'con'}">${a.name} - Giá thị trường: ${formatCurrency(a.sellPricePerUnit || 0)}/${a.unit || 'con'}</option>`).join('')}
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label required">Số lượng cần thu</label>
                        <input type="number" id="sell-session-target" class="form-input" min="1" value="100" oninput="updateSellCalculation()">
                    </div>
                    <div class="form-group">
                        <label class="form-label required">Đơn vị</label>
                        <input type="text" id="sell-session-unit" class="form-input" value="kg">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label required">Giá thu mua (VNĐ/đơn vị)</label>
                    <input type="number" id="sell-session-price" class="form-input" min="0" placeholder="Giá Admin trả cho HTX" oninput="updateSellCalculation()">
                    <p class="text-xs text-gray-500 mt-1">Nên cao hơn giá thị trường để hấp dẫn HTX tham gia</p>
                </div>
                
                <!-- Price Calculation Preview -->
                <div id="sell-price-preview" class="hidden bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200">
                    <h4 class="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <span class="material-symbols-outlined text-orange-600">calculate</span>
                        Tính toán giá trị phiên thu mua
                    </h4>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p class="text-gray-500">Giá thị trường hiện tại:</p>
                            <p class="font-semibold text-gray-800" id="sell-market-price-display">0đ</p>
                        </div>
                        <div>
                            <p class="text-gray-500">Giá Admin thu mua:</p>
                            <p class="font-semibold text-orange-600" id="sell-buy-price-display">0đ</p>
                        </div>
                        <div>
                            <p class="text-gray-500">Tổng giá trị (thị trường):</p>
                            <p class="font-semibold text-gray-800" id="sell-total-market">0đ</p>
                        </div>
                        <div>
                            <p class="text-gray-500">Tổng Admin chi trả:</p>
                            <p class="font-semibold text-orange-600" id="sell-total-pay">0đ</p>
                        </div>
                    </div>
                    <div class="mt-3 pt-3 border-t border-orange-200 flex justify-between items-center">
                        <span class="text-gray-600">HTX được hưởng thêm:</span>
                        <span class="text-lg font-bold text-green-600" id="sell-bonus">0đ (0%)</span>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Mô tả yêu cầu chất lượng</label>
                    <textarea id="sell-session-desc" class="form-input" rows="2" placeholder="VD: Nông sản sạch, không thuốc trừ sâu..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="closeModal()">Hủy</button>
                <button class="btn-primary bg-orange-500 hover:bg-orange-600" onclick="createSellSession()">
                    <span class="material-symbols-outlined">add</span>
                    Tạo phiên thu mua
                </button>
            </div>
        </div>
    `;

    modal.classList.add('active');
}

function toggleSellProductSelect() {
    const type = document.getElementById('sell-session-type').value;
    document.getElementById('crop-select-group').classList.toggle('hidden', type !== 'crop');
    document.getElementById('animal-select-group').classList.toggle('hidden', type !== 'animal');

    // Update unit based on type
    const unitInput = document.getElementById('sell-session-unit');
    if (type === 'crop') {
        unitInput.value = 'kg';
    } else {
        const animalSelect = document.getElementById('sell-session-animal');
        const selected = animalSelect.options[animalSelect.selectedIndex];
        unitInput.value = selected?.dataset?.unit || 'con';
    }

    updateSellCalculation();
}

function updateSellCalculation() {
    const type = document.getElementById('sell-session-type').value;
    const preview = document.getElementById('sell-price-preview');
    const targetQty = parseInt(document.getElementById('sell-session-target').value) || 0;
    const buyPrice = parseFloat(document.getElementById('sell-session-price').value) || 0;
    const unit = document.getElementById('sell-session-unit').value || 'đơn vị';

    let marketPrice = 0;
    let productName = '';

    if (type === 'crop') {
        const select = document.getElementById('sell-session-crop');
        const selected = select.options[select.selectedIndex];
        if (selected && selected.dataset.price) {
            marketPrice = parseFloat(selected.dataset.price);
            productName = selected.dataset.name || '';
        }
    } else {
        const select = document.getElementById('sell-session-animal');
        const selected = select.options[select.selectedIndex];
        if (selected && selected.dataset.price) {
            marketPrice = parseFloat(selected.dataset.price);
            productName = selected.dataset.name || '';
        }
    }

    if (marketPrice > 0 || buyPrice > 0) {
        // Calculate values
        const totalMarketValue = marketPrice * targetQty;
        const totalBuyValue = buyPrice * targetQty;
        const bonus = totalBuyValue - totalMarketValue;
        const bonusPercent = totalMarketValue > 0 ? ((bonus / totalMarketValue) * 100).toFixed(1) : 0;

        // Update display
        document.getElementById('sell-market-price-display').textContent = `${formatCurrency(marketPrice)}/${unit}`;
        document.getElementById('sell-buy-price-display').textContent = buyPrice > 0 ? `${formatCurrency(buyPrice)}/${unit}` : 'Chưa nhập';
        document.getElementById('sell-total-market').textContent = formatCurrency(totalMarketValue);
        document.getElementById('sell-total-pay').textContent = buyPrice > 0 ? formatCurrency(totalBuyValue) : 'Chưa tính';

        if (buyPrice > 0 && buyPrice > marketPrice) {
            document.getElementById('sell-bonus').textContent = `+${formatCurrency(bonus)} (+${bonusPercent}%)`;
            document.getElementById('sell-bonus').className = 'text-lg font-bold text-green-600';
        } else if (buyPrice > 0 && buyPrice <= marketPrice) {
            document.getElementById('sell-bonus').textContent = 'Nên cao hơn giá thị trường để hấp dẫn HTX!';
            document.getElementById('sell-bonus').className = 'text-lg font-bold text-amber-600';
        } else {
            document.getElementById('sell-bonus').textContent = '---';
            document.getElementById('sell-bonus').className = 'text-lg font-bold text-gray-400';
        }

        preview.classList.remove('hidden');
    } else {
        preview.classList.add('hidden');
    }
}

async function createSellSession() {
    const type = document.getElementById('sell-session-type').value;
    const cropId = document.getElementById('sell-session-crop').value;
    const animalId = document.getElementById('sell-session-animal').value;
    const targetQuantity = parseInt(document.getElementById('sell-session-target').value);
    const unit = document.getElementById('sell-session-unit').value.trim();
    const minPrice = parseFloat(document.getElementById('sell-session-price').value);
    const description = document.getElementById('sell-session-desc').value.trim();

    if (!targetQuantity || !unit || !minPrice) {
        alert('Vui lòng điền đầy đủ thông tin');
        return;
    }

    if (type === 'crop' && !cropId) {
        alert('Vui lòng chọn cây trồng');
        return;
    }

    if (type === 'animal' && !animalId) {
        alert('Vui lòng chọn vật nuôi');
        return;
    }

    try {
        await fetchAPI('/admin/trading/sell-sessions', 'POST', {
            cropDefinitionId: type === 'crop' ? parseInt(cropId) : null,
            animalDefinitionId: type === 'animal' ? parseInt(animalId) : null,
            targetQuantity,
            unit,
            minPrice,
            description
        });

        closeModal();
        showToast('Thành công', 'Đã tạo phiên thu mua', 'success');
        // Reload cooperatives page and go to sell tab
        loadCooperatives();
        setTimeout(() => switchCooperativeTab('sell'), 500);
    } catch (error) {
        console.error('Error creating sell session:', error);
        showToast('Lỗi', error.message || 'Không thể tạo phiên', 'error');
    }
}


// ============ RECRUITMENT ============
async function loadRecruitment() {
    document.getElementById('page-title').textContent = 'Tuyển dụng nhân sự';
    // Fetch data
    const farmId = 1; // Default Farm ID or fetch from user context
    const [posts, applications] = await Promise.all([
        fetchAPI(`${API_BASE_URL}/recruitment/posts/farm/${farmId}`),
        fetchAPI(`${API_BASE_URL}/recruitment/applications/post/all`) // Need API to get all apps or by post
        // Actually my API was /recruitment/applications/post/{id}, I might need to iterate posts or add new API
        // For now let's just show Posts and when clicking Post -> Show Applications
    ]);

    document.getElementById('main-content').innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold text-gray-800">Tin tuyển dụng</h3>
            <button onclick="showRecruitmentModal()" class="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg shadow-md transition-all font-medium">
                <span class="material-icons-round text-lg">add</span> Đăng tin mới
            </button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="recruitment-list">
            <!-- Posts injected here -->
        </div>
    `;

    renderRecruitmentList(posts || []);
}

function renderRecruitmentList(posts) {
    const container = document.getElementById('recruitment-list');
    if (!posts.length) {
        container.innerHTML = '<p class="col-span-full text-center text-gray-500 py-10">Chưa có tin tuyển dụng nào.</p>';
        return;
    }

    container.innerHTML = posts.map(p => `
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer" onclick="showApplications(${p.id}, '${p.title}')">
            <div class="flex justify-between items-start mb-4">
                <h4 class="text-lg font-bold text-gray-800">${p.title}</h4>
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${p.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}">
                    ${p.status === 'OPEN' ? 'Đang tuyển' : 'Đã đóng'}
                </span>
            </div>
            <p class="text-gray-600 text-sm mb-4 line-clamp-2">${p.description}</p>
            <div class="flex justify-between items-center text-sm text-gray-500">
                <span class="flex items-center gap-1"><span class="material-icons-round text-base">people</span> ${p.quantityNeeded} người</span>
                <span class="flex items-center gap-1"><span class="material-icons-round text-base">payments</span> ${formatCurrency(p.salaryOffer)}</span>
            </div>
        </div>
    `).join('');
}

async function showRecruitmentModal() {
    document.getElementById('modal-container').innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
            <div class="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onclick="closeModal()"></div>
            <div class="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl modal-content flex flex-col">
                <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 class="text-xl font-bold text-gray-800">Đăng tin tuyển dụng</h3>
                    <button onclick="closeModal()" class="text-gray-400 hover:text-red-500"><span class="material-icons-round">close</span></button>
                </div>
                <form id="recruitment-form" class="p-6 space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Tiêu đề *</label>
                        <input type="text" name="title" required class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Mô tả công việc</label>
                        <textarea name="description" rows="3" class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary"></textarea>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Số lượng cần</label>
                            <input type="number" name="quantityNeeded" value="1" min="1" class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Mức lương (VNĐ)</label>
                            <input type="number" name="salaryOffer" required class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                        </div>
                    </div>
                </form>
                <div class="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button onclick="closeModal()" class="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50">Hủy</button>
                    <button onclick="saveRecruitmentPost()" class="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-dark">Đăng tin</button>
                </div>
            </div>
        </div>
    `;
}

async function saveRecruitmentPost() {
    const form = document.getElementById('recruitment-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    // Hardcoded Farm ID for now (Owner's farm)
    data.farm = { id: 1 };

    try {
        await fetchAPI(`${API_BASE_URL}/recruitment/posts`, 'POST', data);
        closeModal();
        loadRecruitment();
        showToast('Thành công', 'Đã đăng tin tuyển dụng', 'success');
    } catch (e) {
        showToast('Lỗi', e.message, 'error');
    }
}

async function showApplications(postId, postTitle) {
    const apps = await fetchAPI(`${API_BASE_URL}/recruitment/applications/post/${postId}`) || [];

    document.getElementById('modal-container').innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
            <div class="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onclick="closeModal()"></div>
            <div class="relative bg-white w-full max-w-3xl rounded-2xl shadow-2xl modal-content flex flex-col max-h-[90vh]">
                <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 class="text-xl font-bold text-gray-800">Ứng viên: ${postTitle}</h3>
                    <button onclick="closeModal()" class="text-gray-400 hover:text-red-500"><span class="material-icons-round">close</span></button>
                </div>
                <div class="p-6 overflow-y-auto">
                    ${apps.length === 0 ? '<p class="text-center text-gray-500">Chưa có ứng viên nào.</p>' : `
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ứng viên</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày nộp</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tin nhắn</th>
                                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
                            ${apps.map(a => `
                                <tr>
                                    <td class="px-4 py-3 text-sm font-medium text-gray-900">${a.worker ? a.worker.fullName : 'Unknown'}</td>
                                    <td class="px-4 py-3 text-sm text-gray-500">${new Date(a.appliedAt).toLocaleDateString('vi-VN')}</td>
                                    <td class="px-4 py-3 text-sm text-gray-500 truncate max-w-xs">${a.message || '-'}</td>
                                    <td class="px-4 py-3 text-right space-x-2">
                                        ${a.status === 'PENDING' ? `
                                        <button onclick="reviewApplication(${a.id}, 'ACCEPTED')" class="text-green-600 hover:text-green-800 font-medium text-sm">Duyệt</button>
                                        <button onclick="reviewApplication(${a.id}, 'REJECTED')" class="text-red-600 hover:text-red-800 font-medium text-sm">Từ chối</button>
                                        ` : `
                                        <span class="px-2 py-1 text-xs rounded-full ${a.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${a.status}</span>
                                        `}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    `}
                </div>
            </div>
        </div>
    `;
}

async function reviewApplication(id, status) {
    try {
        await fetchAPI(`${API_BASE_URL}/recruitment/applications/${id}/status?status=${status}`, 'PUT');
        // Refresh modal is hard, close and notify
        closeModal();
        showToast('Thành công', `Đã ${status === 'ACCEPTED' ? 'duyệt' : 'từ chối'} hồ sơ`, 'success');
    } catch (e) {
        showToast('Lỗi', e.message, 'error');
    }
}

// ============ TASKS ============
async function loadTasks() {
    document.getElementById('page-title').textContent = 'Quản lý Công việc';
    const ownerId = 1; // Need actual ID from auth
    const tasks = await fetchAPI(`${API_BASE_URL}/tasks/owner/${ownerId}`) || [];

    document.getElementById('main-content').innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold text-gray-800">Danh sách công việc</h3>
            <button onclick="showTaskAssignmentModal()" class="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg shadow-md transition-all font-medium">
                <span class="material-icons-round text-lg">assignment_add</span> Giao việc mới
            </button>
        </div>
        
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
             <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Công việc</th>
                        <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Người thực hiện</th>
                        <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Khu vực</th>
                         <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Ưu tiên</th>
                        <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Trạng thái</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200" id="tasks-table-body">
                    ${tasks.map(t => `
                        <tr class="hover:bg-gray-50">
                            <td class="px-6 py-4">
                                <span class="font-medium text-gray-900">${t.name}</span>
                                <p class="text-xs text-gray-500">${t.description || ''}</p>
                            </td>
                            <td class="px-6 py-4 text-sm text-gray-700">${t.worker ? t.worker.fullName : 'Chưa giao'}</td>
                            <td class="px-6 py-4 text-sm text-gray-700">
                                ${t.field ? `Ruộng: ${t.field.name}` : (t.pen ? `Chuồng: ${t.pen.name}` : '-')}
                            </td>
                            <td class="px-6 py-4">
                                <span class="px-2 py-0.5 text-xs font-bold rounded ${t.priority === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'}">${t.priority}</span>
                            </td>
                            <td class="px-6 py-4">
                                <span class="px-3 py-1 text-xs font-semibold rounded-full 
                                    ${t.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
            (t.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700')}">
                                    ${t.status}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function showTaskAssignmentModal() {
    // Fetch dependencies
    const [workers, shopItems, fields, pens] = await Promise.all([
        fetchAPI(`${API_BASE_URL}/admin/users`), // Should filter by role=WORKER in backend or here
        fetchAPI(`${API_BASE_URL}/admin/shop-items`),
        fetchAPI(`${API_BASE_URL}/admin/fields`), // Assuming endpoints exist
        fetchAPI(`${API_BASE_URL}/admin/pens`)    // Assuming endpoints exist
    ]);

    const workerList = (workers || []).filter(u => u.role === 'WORKER');

    document.getElementById('modal-container').innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
            <div class="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onclick="closeModal()"></div>
            <div class="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl modal-content flex flex-col max-h-[90vh]">
                <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 class="text-xl font-bold text-gray-800">Giao việc mới</h3>
                    <button onclick="closeModal()" class="text-gray-400 hover:text-red-500"><span class="material-icons-round">close</span></button>
                </div>
                <form id="task-form" class="p-6 overflow-y-auto space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="col-span-2">
                             <label class="block text-sm font-medium text-gray-700 mb-1">Tên công việc *</label>
                             <input type="text" name="name" required class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                        </div>
                        
                        <div>
                             <label class="block text-sm font-medium text-gray-700 mb-1">Người thực hiện *</label>
                             <select name="workerId" required class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                                <option value="">Chọn nhân công</option>
                                ${workerList.map(w => `<option value="${w.id}">${w.fullName} (${w.email})</option>`).join('')}
                             </select>
                        </div>
                        
                        <div>
                             <label class="block text-sm font-medium text-gray-700 mb-1">Độ ưu tiên</label>
                             <select name="priority" class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                                <option value="NORMAL">Bình thường</option>
                                <option value="HIGH">Cao (Gấp)</option>
                                <option value="LOW">Thấp</option>
                             </select>
                        </div>
                        
                        <div>
                             <label class="block text-sm font-medium text-gray-700 mb-1">Khu vực làm việc</label>
                             <select name="contextId" id="task-context" onchange="toggleContextType()" class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                                <option value="">-- Chọn khu vực --</option>
                                <optgroup label="Ruộng (Cây trồng)">
                                    ${(fields || []).map(f => `<option value="FIELD_${f.id}">${f.name}</option>`).join('')}
                                </optgroup>
                                <optgroup label="Chuồng (Vật nuôi)">
                                    ${(pens || []).map(p => `<option value="PEN_${p.id}">${p.name}</option>`).join('')}
                                </optgroup>
                             </select>
                        </div>
                        
                        <div>
                             <label class="block text-sm font-medium text-gray-700 mb-1">Loại công việc</label>
                             <select name="taskType" id="task-type" onchange="toggleTaskInputs()" class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary">
                                <option value="OTHER">Khác</option>
                                <option value="WATER">Tưới nước</option>
                                <option value="FERTILIZE">Bón phân</option>
                                <option value="FEED">Cho ăn</option>
                                <option value="BUY_SUPPLIES">Mua vật tư</option>
                                <option value="HARVEST">Thu hoạch</option>
                             </select>
                        </div>
                        
                        <!-- Dynamic Fields -->
                        <div class="col-span-2 hidden p-4 bg-gray-50 rounded-lg" id="supply-fields">
                             <div class="grid grid-cols-2 gap-4">
                                <div>
                                     <label class="block text-sm font-medium text-gray-700 mb-1">Vật tư liên quan</label>
                                     <select name="relatedShopItemId" class="w-full px-4 py-2 rounded-lg border border-gray-300">
                                        <option value="">Chọn vật tư...</option>
                                        ${(shopItems || []).map(i => `<option value="${i.id}">${i.name} (${formatCurrency(i.price)}/${i.unit})</option>`).join('')}
                                     </select>
                                </div>
                                <div>
                                     <label class="block text-sm font-medium text-gray-700 mb-1">Số lượng</label>
                                     <input type="number" name="quantityRequired" placeholder="0" class="w-full px-4 py-2 rounded-lg border border-gray-300">
                                </div>
                                <div class="col-span-2 text-xs text-blue-600 flex items-center gap-1">
                                    <span class="material-icons-round text-sm">info</span>
                                    <span>Hệ thống sẽ tự động tạo nhiệm vụ "Mua vật tư" nếu kho không đủ.</span>
                                </div>
                             </div>
                        </div>

                        <div class="col-span-2">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Mô tả chi tiết</label>
                            <textarea name="description" rows="3" class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary"></textarea>
                        </div>
                    </div>
                </form>
                <div class="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button onclick="closeModal()" class="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50">Hủy</button>
                    <button onclick="saveTask()" class="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-dark">Giao việc</button>
                </div>
            </div>
        </div>
    `;

    // Add helpers to global scope if needed or defined inline
}

window.toggleTaskInputs = function () {
    const type = document.getElementById('task-type').value;
    const supplyDiv = document.getElementById('supply-fields');
    if (['FERTILIZE', 'FEED', 'BUY_SUPPLIES', 'SEED', 'PEST_CONTROL'].includes(type)) {
        supplyDiv.classList.remove('hidden');
    } else {
        supplyDiv.classList.add('hidden');
    }
}

async function saveTask() {
    const form = document.getElementById('task-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    data.farmId = 1; // Default Farm
    data.ownerId = 1; // Default Owner

    // Parse Context
    const context = data.contextId;
    if (context && context.startsWith('FIELD_')) data.fieldId = context.replace('FIELD_', '');
    if (context && context.startsWith('PEN_')) data.penId = context.replace('PEN_', '');
    delete data.contextId;

    try {
        await fetchAPI(`${API_BASE_URL}/tasks`, 'POST', data);
        closeModal();
        loadTasks();
        showToast('Thành công', 'Đã giao việc cho nhân công (Hệ thống đang kiểm tra kho...)', 'success');
    } catch (e) {
        showToast('Lỗi', e.message, 'error');
    }
}
