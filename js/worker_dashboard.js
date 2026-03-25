const API_BASE = CONFIG.API_BASE_URL || 'http://localhost:8080/api';

// ── Lightbox for media viewing ──
function openMediaLightbox(src, type) {
    const existing = document.getElementById('media-lightbox-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'media-lightbox-overlay';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; padding:20px; cursor:pointer; animation:lbFadeIn 0.2s ease;';

    if (!document.getElementById('lightbox-style')) {
        const style = document.createElement('style');
        style.id = 'lightbox-style';
        style.textContent = '@keyframes lbFadeIn{from{opacity:0}to{opacity:1}}';
        document.head.appendChild(style);
    }

    let mediaHtml;
    if (type === 'video') {
        mediaHtml = `<video src="${src}" controls autoplay style="max-width:90vw; max-height:85vh; border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,0.5); cursor:default;" onclick="event.stopPropagation()"></video>`;
    } else {
        mediaHtml = `<img src="${src}" style="max-width:90vw; max-height:85vh; border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,0.5); cursor:default; object-fit:contain;" onclick="event.stopPropagation()">`;
    }

    overlay.innerHTML = `
        <button onclick="event.stopPropagation(); this.parentElement.remove();" style="position:absolute; top:16px; right:16px; width:44px; height:44px; border-radius:50%; background:rgba(255,255,255,0.15); backdrop-filter:blur(8px); color:white; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:1; transition:background 0.2s;" onmouseenter="this.style.background='rgba(255,255,255,0.3)'" onmouseleave="this.style.background='rgba(255,255,255,0.15)'">
            <span class="material-icons-round" style="font-size:24px;">close</span>
        </button>
        ${mediaHtml}
    `;

    overlay.addEventListener('click', () => overlay.remove());
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); }
    });

    document.body.appendChild(overlay);
}

let workerId = null;
let currentTab = 'home';
let currentTaskType = 'CULTIVATION';

let workerFarmId = null;
let workerOwnerId = null;

let activeWorkLogsByTaskId = {};
let workerTasksById = {};

let taskCountdownIntervalId = null;

let allTransactions = [];
let incomeExpenseChart = null;
let expenseBreakdownChart = null;
let assetsInitialized = false;
let settingsInitialized = false;

let addressMap = null;
let addressMarker = null;
let userAddressLat = null;
let userAddressLng = null;

let pendingTopUpFileName = null;
let pendingTopUpAmount = 0;
let pendingTopUpPreviewUrl = null;

let selectedAvatarBase64 = null;
let currentNewEmail = null;
let inspectionModalContext = null;
let inspectionSelectedImageBase64 = null;
let inspectionSelectedFileName = null;
let inspectionAiSuggestedValue = null;
let inspectionAiSuggestionText = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Check
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    const role = localStorage.getItem('userRole');
    if (!token || role !== 'WORKER') {
        window.location.href = 'login.html';
        return;
    }

    // Store token consistently
    if (!localStorage.getItem('token') && localStorage.getItem('authToken')) {
        localStorage.setItem('token', localStorage.getItem('authToken'));
    }

    ensureDarkModeStyles();

    // 2. Fetch User Info
    await loadUserProfile();

    // 3. Load Weather
    loadWeather();

    // 4. Initial Load with animation
    switchTab('home');

    // 5. Event Listeners
    setupEventListeners();

    // 6. Page load animation
    animatePageLoad();
});

function setupEventListeners() {
    // Sidebar Tabs
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = item.dataset.tab;
            switchTab(tab);
        });
    });

    // Task Type Tabs
    hideTaskTypeTabs();

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });

    const helpForm = document.getElementById('help-request-form');
    if (helpForm) {
        helpForm.addEventListener('submit', submitHelpRequest);
    }

    const helpRefreshBtn = document.getElementById('help-refresh-btn');
    if (helpRefreshBtn) {
        helpRefreshBtn.addEventListener('click', () => loadHelpRequests());
    }

    const payrollRefreshBtn = document.getElementById('payroll-refresh-btn');
    if (payrollRefreshBtn) {
        payrollRefreshBtn.addEventListener('click', () => loadPayrollData(true));
    }
}

// Page Load Animation
function animatePageLoad() {
    if (typeof gsap !== 'undefined') {
        // Sidebar animation
        gsap.from('aside', {
            x: -50,
            opacity: 0,
            duration: 0.6,
            ease: 'power2.out'
        });

        // Header animation
        gsap.from('header', {
            y: -30,
            opacity: 0,
            duration: 0.5,
            delay: 0.2,
            ease: 'power2.out'
        });

        // Sidebar items stagger
        gsap.from('.sidebar-item', {
            x: -20,
            opacity: 0,
            duration: 0.4,
            stagger: 0.05,
            delay: 0.3,
            ease: 'power2.out'
        });
    }
}

function switchTab(tab) {
    currentTab = tab;

    if (tab !== 'tasks') {
        stopTaskCountdownTicker();
    }

    // Update Sidebar
    document.querySelectorAll('.sidebar-item').forEach(item => {
        if (item.dataset.tab === tab) {
            item.classList.add('active');
            item.classList.remove('text-white/80', 'hover:bg-white/10');
        } else {
            item.classList.remove('active');
            item.classList.add('text-white/80', 'hover:bg-white/10');
        }
    });

    // Toggle Views
    document.querySelectorAll('.view-section').forEach(view => view.classList.add('hidden'));
    const activeView = document.getElementById(`view-${tab}`);
    if (activeView) activeView.classList.remove('hidden');

    // Update Title
    const titles = {
        'home': 'Tổng quan',
        'tasks': 'Danh sách công việc',
        'assets': 'Tài sản',
        'settings': 'Cài đặt',
        'help': 'Trợ giúp'
    };
    document.getElementById('page-title').textContent = titles[tab] || 'AgriPlanner';

    // Tab transition animation
    animateViewTransition(`view-${tab}`);

    // Load Data
    if (tab === 'home') loadHomeData();
    if (tab === 'tasks') loadTasksList();
    if (tab === 'assets') loadAssets();
    if (tab === 'settings') initSettings();
    if (tab === 'help') { loadHelpRequests(); loadAdminHelpRequests(); }
}

// View Transition Animation
function animateViewTransition(viewId) {
    if (typeof gsap !== 'undefined') {
        const view = document.getElementById(viewId);
        if (view) {
            gsap.fromTo(view,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
            );

            // Animate child cards/sections
            const cards = view.querySelectorAll('.bg-white, .task-card');
            if (cards.length > 0) {
                gsap.fromTo(cards,
                    { opacity: 0, y: 15 },
                    { opacity: 1, y: 0, duration: 0.3, stagger: 0.05, delay: 0.1, ease: 'power2.out' }
                );
            }
        }
    }
}

// ================= API CALLS =================

async function fetchAPI(url, method = 'GET', body = null) {
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        throw new Error('No auth token');
    }
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    if (!res.ok) {
        let errMsg = 'API Error';
        try { const errData = await res.json(); errMsg = errData.error || errData.message || errMsg; } catch (_) { }
        throw new Error(errMsg);
    }
    return res.json();
}

async function loadUserProfile() {
    try {
        const email = localStorage.getItem('userEmail');
        if (!email) return;

        const res = await fetch(`${API_BASE}/user/profile?email=${encodeURIComponent(email)}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!res.ok) throw new Error('API Error');
        const user = await res.json();

        workerId = user.id;

        const nextFarmId = user.farmId != null ? user.farmId : null;
        if (workerFarmId !== nextFarmId) {
            workerFarmId = nextFarmId;
            workerOwnerId = null;
        }

        const fullName = (user.fullName || localStorage.getItem('userName') || '').trim();
        const displayName = fullName || 'Worker';
        const avatarChar = displayName.charAt(0).toUpperCase();

        const workerNameEl = document.getElementById('worker-name');
        if (workerNameEl) workerNameEl.textContent = displayName;

        const profileNameDisplayEl = document.getElementById('profile-name-display');
        if (profileNameDisplayEl) profileNameDisplayEl.textContent = displayName;

        if (user.avatarUrl != null) {
            localStorage.setItem('userAvatar', user.avatarUrl || '');
        }
        updateAvatarDisplay(localStorage.getItem('userAvatar'), avatarChar);

        const fullNameInput = document.getElementById('profile-fullname');
        if (fullNameInput) fullNameInput.value = user.fullName || '';

        const phoneInput = document.getElementById('profile-phone');
        if (phoneInput) phoneInput.value = user.phone || '';

        const emailInput = document.getElementById('profile-email');
        if (emailInput) emailInput.value = user.email || email;

        const darkModeToggle = document.getElementById('dark-mode-toggle');
        if (darkModeToggle) darkModeToggle.checked = Boolean(user.darkMode);
        applyDarkModePreference(Boolean(user.darkMode));

        const twoFactorToggle = document.getElementById('two-factor-toggle');
        if (twoFactorToggle) twoFactorToggle.checked = Boolean(user.twoFactorEnabled);

        const addrInput = document.getElementById('user-address-input');
        if (addrInput) addrInput.value = user.defaultAddress || '';

        if (user.addressLat != null && user.addressLng != null) {
            const lat = Number(user.addressLat);
            const lng = Number(user.addressLng);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                userAddressLat = lat;
                userAddressLng = lng;
                const latEl = document.getElementById('address-lat');
                const lngEl = document.getElementById('address-lng');
                if (latEl) latEl.textContent = lat.toFixed(6);
                if (lngEl) lngEl.textContent = lng.toFixed(6);
            }
        }

        await loadBalance();

        // === Gamification: EXP & Rank Display ===
        const avatarUrl = user.avatarUrl || localStorage.getItem('userAvatar') || null;
        updateRankDisplay(user.experiencePoints || 0, user.rankLevel || 'TRAINEE', avatarChar, avatarUrl);

    } catch (e) {
        console.error('Error loading profile', e);
    }
}

/** Gamification: Update rank borders, badges, and EXP progress bar */
function updateRankDisplay(exp, rank, avatarChar, avatarUrl) {
    const RANKS = {
        TRAINEE: { icon: '🥉', label: 'Nông dân Tập sự', bg: '#f7e8cd', color: '#b87333', min: 0, next: 100 },
        SKILLED: { icon: '🥈', label: 'Nông dân Thạo việc', bg: '#e8e8e8', color: '#6b6b6b', min: 100, next: 500 },
        VETERAN: { icon: '🥇', label: 'Lão nông Kinh nghiệm', bg: '#fff8e1', color: '#b8860b', min: 500, next: 1000 },
        MASTER:  { icon: '💎', label: 'Nghệ nhân Nông nghiệp', bg: '#e0f7fa', color: '#00838f', min: 1000, next: 9999 }
    };
    const info = RANKS[rank] || RANKS.TRAINEE;
    const progress = Math.min(100, Math.round(((exp - info.min) / (info.next - info.min)) * 100));

    // 1. Header Avatar Border
    const wrapper = document.getElementById('worker-avatar-wrapper');
    if (wrapper) {
        wrapper.className = 'rank-border rank-' + rank;
    }

    // 2. Header Rank Badge
    const badge = document.getElementById('worker-rank-badge');
    if (badge) {
        badge.style.background = info.bg;
        badge.style.color = info.color;
        badge.querySelector('.rank-icon').textContent = info.icon;
        badge.querySelector('.rank-label').textContent = info.label;
    }

    // 3. Home EXP Widget
    const widget = document.getElementById('exp-widget');
    if (widget) {
        widget.style.display = 'flex';
        const bigAvatar = document.getElementById('exp-avatar-big');
        if (bigAvatar) {
            bigAvatar.className = 'rank-border rank-' + rank + ' flex-shrink-0';
            // Update big avatar image too
            const bigAvatarInner = bigAvatar.querySelector('div');
            if (bigAvatarInner && avatarUrl) {
                bigAvatarInner.textContent = '';
                bigAvatarInner.style.backgroundImage = `url('${avatarUrl}')`;
                bigAvatarInner.style.backgroundSize = 'cover';
                bigAvatarInner.style.backgroundPosition = 'center';
            } else if (bigAvatarInner) {
                bigAvatarInner.textContent = avatarChar;
            }
        }
        const iconEl = document.getElementById('exp-rank-icon');
        if (iconEl) iconEl.textContent = info.icon;
        const nameEl = document.getElementById('exp-rank-name');
        if (nameEl) nameEl.textContent = info.label;
        const bar = document.getElementById('exp-bar');
        if (bar) {
            bar.className = 'exp-bar-fill exp-bar-' + rank;
            setTimeout(() => { bar.style.width = progress + '%'; }, 100);
        }
        const curEl = document.getElementById('exp-current');
        if (curEl) curEl.textContent = exp + ' EXP';
        const nextEl = document.getElementById('exp-next');
        if (rank === 'MASTER') {
            nextEl.textContent = '⭐ Cấp tối đa!';
        } else {
            nextEl.textContent = 'Tiếp: ' + info.next + ' EXP';
        }
    }
}

async function loadWeather() {
    try {
        // Use OpenWeather API Key from Config
        const apiKey = CONFIG.OPENWEATHER_API_KEY;
        const lat = CONFIG.DEFAULT_LOCATION.lat;
        const lng = CONFIG.DEFAULT_LOCATION.lng;

        if (!apiKey) return;

        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=vi`);
        if (!res.ok) {
            console.warn('Weather API returned', res.status);
            return;
        }
        const data = await res.json();

        if (!data || !data.weather || !data.weather[0] || !data.main) {
            console.warn('Weather data incomplete');
            return;
        }

        // Update Header Widget
        const icon = getWeatherIconIcon(data.weather[0].main);
        document.getElementById('weather-widget').innerHTML = `
            <span class="material-symbols-outlined text-base">${icon}</span>
            <span>${Math.round(data.main.temp)}°C, ${data.weather[0].description}</span>
        `;

        // Update Home Widget
        document.getElementById('home-weather-temp').textContent = Math.round(data.main.temp) + '°C';
        document.getElementById('home-weather-desc').textContent = data.weather[0].description;
    } catch (e) {
        console.warn('Weather load error:', e.message);
    }
}

async function loadHomeData() {
    if (!workerId) return;
    try {
        // Fetch tasks
        const tasks = await fetchAPI(`${API_BASE}/tasks/worker/${workerId}`);
        cacheWorkerTasks(tasks);
        const today = new Date().toISOString().split('T')[0];

        // Filter Today's Tasks (simplified check)
        const todaysTasks = sortWorkerTasks((Array.isArray(tasks) ? tasks : []).filter(t => {
            const status = t && t.status ? String(t.status).toUpperCase() : '';
            const active = status === 'PENDING' || status === 'IN_PROGRESS';
            const createdToday = t.createdAt ? String(t.createdAt).startsWith(today) : false;
            const completedToday = (status === 'COMPLETED' || status === 'APPROVED') && ((t.completedAt && String(t.completedAt).startsWith(today)) || (t.approvedAt && String(t.approvedAt).startsWith(today)));
            return active || createdToday || completedToday;
        })).slice(0, 5);

        document.getElementById('home-today-count').textContent = todaysTasks.length;

        const container = document.getElementById('home-tasks-list');
        container.innerHTML = '';

        if (todaysTasks.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">Chưa có công việc nào.</p>';
        } else {
            todaysTasks.forEach(task => {
                const icon = getTaskIcon(task.taskType);
                container.innerHTML += `
                    <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div class="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-primary">
                            <span class="material-icons-round text-sm">${icon}</span>
                        </div>
                        <div class="flex-1">
                            <div class="text-sm font-medium text-gray-800">${escapeHtml(fixUtf8(task.name))}</div>
                            <div class="text-xs text-gray-500">${getTaskTypeLabel(task.taskType)}</div>
                        </div>
                        ${task.status === 'COMPLETED' ?
                        '<span class="material-icons-round text-green-500">check_circle</span>' :
                        `<button onclick="completeTask(${task.id})" class="w-8 h-8 rounded-full hover:bg-green-100 text-gray-400 hover:text-green-600 flex items-center justify-center transition-colors">
                                <span class="material-icons-round">radio_button_unchecked</span>
                            </button>`
                    }
                    </div>
                `;
            });
        }

    } catch (e) { console.error(e); }
}

async function loadTasksList() {
    if (!workerId) return;
    const container = document.getElementById('tasks-list-container');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-8 text-gray-500">Đang tải...</div>';

    try {
        const tasks = await fetchAPI(`${API_BASE}/tasks/worker/${workerId}`);
        cacheWorkerTasks(tasks);

        await refreshActiveWorkLogs();

        // Filter: show PENDING/IN_PROGRESS (any date), created today, or completed today
        const today = new Date().toISOString().split('T')[0];
        const filtered = (Array.isArray(tasks) ? tasks : []).filter(t => {
            const status = t && t.status ? String(t.status).toUpperCase() : '';
            const active = status === 'PENDING' || status === 'IN_PROGRESS';
            const createdToday = t.createdAt ? String(t.createdAt).split('T')[0] === today : false;
            const completedToday = (status === 'COMPLETED' || status === 'APPROVED') && ((t.completedAt && String(t.completedAt).startsWith(today)) || (t.approvedAt && String(t.approvedAt).startsWith(today)));
            return active || createdToday || completedToday;
        });

        const sorted = sortWorkerTasks(filtered);

        // Also feed the Kanban view
        _workerFilteredTasks = sorted;
        if (workerTaskViewMode === 'kanban') {
            renderWorkerKanban(sorted);
        }

        if (sorted.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                     <span class="material-icons-round text-4xl text-gray-300 mb-2">assignment_turned_in</span>
                     <p class="text-gray-500">Không có công việc nào trong hôm nay.</p>
                </div>
            `;
            stopTaskCountdownTicker();
            return;
        }

        container.innerHTML = '';

        sorted.forEach(task => {
            const icon = getTaskIcon(task.taskType);
            const status = task && task.status ? String(task.status).toUpperCase() : '';

            const createdAtDate = parseTaskDateTime(task && task.createdAt ? task.createdAt : null);
            const createdAtLabel = createdAtDate ? createdAtDate.toLocaleDateString('vi-VN') : '';

            const dueDateObj = parseTaskDateTime(task && task.dueDate ? task.dueDate : null);
            const dueMs = dueDateObj ? dueDateObj.getTime() : null;
            const dueLabel = dueMs != null ? formatTaskDueDate(dueMs) : '';

            const priorityTitle = getPriorityLabel(task && task.priority ? task.priority : null);
            const priorityBadgeClass = getPriorityBadgeClass(task && task.priority ? task.priority : null);
            const priorityShort = getPriorityShortLabel(task && task.priority ? task.priority : null);

            const taskName = fixUtf8(task.name || '');
            const taskDesc = fixUtf8(task.description || '');

            const countdownBlock = dueMs != null && status !== 'COMPLETED'
                ? `
                    <div class="task-countdown inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border" data-due-ms="${dueMs}">
                        <span class="material-icons-round text-sm">schedule</span>
                        <span class="task-countdown-text"></span>
                    </div>
                  `
                : '';

            container.innerHTML += `
                <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 items-start task-card" onclick="openTaskDetail(${task.id})" style="cursor:pointer;">
                    <div class="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                        <span class="material-icons-round text-2xl">${icon}</span>
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start">
                            <h4 class="font-bold text-gray-800 text-lg">${escapeHtml(taskName)}</h4>
                            <span class="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded font-medium">${getTaskTypeLabel(task.taskType)}</span>
                        </div>
                        <p class="text-gray-600 text-sm mt-1">${escapeHtml(taskDesc) || 'Không có mô tả'}</p>
                        
                        <div class="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-500">
                            <span class="flex items-center gap-1">
                                <span class="material-icons-round text-sm">event</span>
                                ${dueMs != null ? `Hạn: ${dueLabel}` : 'Chưa có hạn'}
                            </span>
                            ${createdAtLabel ? `
                                <span class="flex items-center gap-1">
                                    <span class="material-icons-round text-sm">calendar_today</span>
                                    ${createdAtLabel}
                                </span>
                            ` : ''}
                            ${task.quantityRequired ? `<span class="flex items-center gap-1"><span class="material-icons-round text-sm">inventory_2</span> ${task.quantityRequired}</span>` : ''}
                            <span class="text-xs font-semibold px-2.5 py-1 rounded-full border ${priorityBadgeClass}" title="${priorityTitle}">Ưu tiên: ${priorityShort}</span>
                            ${countdownBlock}
                        </div>
                    </div>
                    
                    <div class="self-center flex flex-col gap-2" onclick="event.stopPropagation()">
                        ${getWorkLogActionBlock(task)}
                        ${task.status === 'COMPLETED' ?
                    '<button disabled class="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed font-medium"><span class="material-icons-round">check</span> Đã xong</button>' :
                    `<button onclick="completeTask(${task.id})" class="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium shadow-sm shadow-primary/30">
                                <span class="material-icons-round">done</span> Hoàn thành
                            </button>`
                }
                    </div>
                </div>
             `;
        });

        if (currentTab === 'tasks') {
            startTaskCountdownTicker();
        } else {
            stopTaskCountdownTicker();
        }

    } catch (e) {
        console.error('Error loading tasks:', e);
        container.innerHTML = '<div class="text-center py-8 text-red-500">Lỗi tải dữ liệu</div>';
        stopTaskCountdownTicker();
    }
}

// ============ WORKER PERSONAL KANBAN ============
let workerTaskViewMode = 'list'; // 'list' or 'kanban'
let _workerFilteredTasks = []; // Cache filtered tasks for re-render

function toggleWorkerTaskView(mode) {
    workerTaskViewMode = mode;
    const listBtn = document.getElementById('worker-view-list');
    const kanbanBtn = document.getElementById('worker-view-kanban');
    if (listBtn) {
        listBtn.style.background = mode === 'list' ? 'white' : 'transparent';
        listBtn.style.color = mode === 'list' ? '#1e293b' : '#64748b';
        listBtn.style.boxShadow = mode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none';
    }
    if (kanbanBtn) {
        kanbanBtn.style.background = mode === 'kanban' ? 'white' : 'transparent';
        kanbanBtn.style.color = mode === 'kanban' ? '#1e293b' : '#64748b';
        kanbanBtn.style.boxShadow = mode === 'kanban' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none';
    }

    const listWrapper = document.getElementById('worker-tasks-list-wrapper');
    const kanbanWrapper = document.getElementById('worker-tasks-kanban-wrapper');
    if (listWrapper) listWrapper.style.display = mode === 'list' ? 'block' : 'none';
    if (kanbanWrapper) kanbanWrapper.style.display = mode === 'kanban' ? 'block' : 'none';

    if (mode === 'kanban' && _workerFilteredTasks.length > 0) {
        renderWorkerKanban(_workerFilteredTasks);
    } else if (mode === 'kanban') {
        loadTasksList();
    }
}

function renderWorkerKanban(tasks) {
    const container = document.getElementById('worker-tasks-kanban-wrapper');
    if (!container) return;

    _workerFilteredTasks = tasks;

    const columns = [
        { id: 'PENDING', title: 'Việc cần làm', color: '#d97706', bg: '#fffbeb' },
        { id: 'IN_PROGRESS', title: 'Đang thực hiện', color: '#2563eb', bg: '#eff6ff' },
        { id: 'COMPLETED', title: 'Đã hoàn thành', color: '#16a34a', bg: '#f0fdf4' }
    ];

    let html = '<div style="display:flex; gap:16px; overflow-x:auto; padding-bottom:8px; min-height:350px;">';

    columns.forEach(col => {
        const colTasks = tasks.filter(t => {
            const st = t.status ? String(t.status).toUpperCase() : 'PENDING';
            if (col.id === 'PENDING') return st === 'PENDING';
            if (col.id === 'IN_PROGRESS') return st === 'IN_PROGRESS';
            if (col.id === 'COMPLETED') return st === 'COMPLETED' || st === 'APPROVED';
            return false;
        });

        html += `
            <div style="flex:0 0 300px; background:#f8fafc; border-radius:12px; display:flex; flex-direction:column; border:1px solid #e2e8f0; max-height:65vh; transition: all 0.2s;"
                 ondragover="event.preventDefault(); this.classList.add('kanban-dropzone-active')"
                 ondragleave="this.classList.remove('kanban-dropzone-active')"
                 ondrop="workerKbDrop(event, '${col.id}')">
                <div style="padding:12px 16px; border-bottom:2px solid ${col.color}; font-weight:600; font-size:14px; display:flex; justify-content:space-between; align-items:center; color:${col.color};">
                    <span>${col.title}</span>
                    <span class="kanban-col-count" style="background:white; padding:2px 8px; border-radius:99px; font-size:12px; color:#64748b; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${colTasks.length}</span>
                </div>
                <div class="wk-cards" style="padding:12px; flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:10px; min-height:80px;">
        `;

        colTasks.forEach(task => {
            const typeLabel = getTaskTypeLabel(task.taskType);
            const taskName = fixUtf8(task.name || '');
            const dueText = task.dueDate ? new Date(task.dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '';
            const salaryText = task.salary ? new Intl.NumberFormat('vi-VN').format(Number(task.salary)) + ' đ' : '';
            const expHint = '+30 EXP';

            html += `
                <div id="worker-kanban-card-${task.id}" class="task-kanban-card" style="background:white; border-radius:8px; padding:12px; box-shadow:0 1px 3px rgba(0,0,0,0.1); border:1px solid #e2e8f0; cursor:grab; transition:box-shadow 0.2s, transform 0.2s, opacity 0.2s;"
                     draggable="true" 
                     ondragstart="event.dataTransfer.setData('text/plain', '${task.id}'); const el = this; setTimeout(() => el.classList.add('is-dragging'), 0);"
                     ondragend="this.classList.remove('is-dragging'); document.querySelectorAll('.kanban-dropzone-active').forEach(c => c.classList.remove('kanban-dropzone-active'));"
                     onclick="openTaskDetail(${task.id})">
                    <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:6px;">
                        <span style="font-size:10px; font-weight:500; padding:2px 6px; border-radius:4px; background:#f3f4f6; color:#6b7280;">${typeLabel}</span>
                        ${salaryText ? `<span style="font-size:10px; font-weight:600; padding:2px 6px; border-radius:4px; background:#ecfdf5; color:#059669;">💰 ${salaryText}</span>` : ''}
                        <span style="font-size:10px; font-weight:500; padding:2px 6px; border-radius:4px; background:#fef3c7; color:#92400e;">⭐ ${expHint}</span>
                    </div>
                    <div style="font-weight:600; font-size:14px; color:#1e293b; display:-webkit-box; -webkit-line-clamp:2; line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${escapeHtml(taskName)}</div>
                    ${dueText ? `<div style="font-size:11px; color:#64748b; margin-top:6px; display:flex; align-items:center; gap:4px;">
                        <span class="material-symbols-outlined" style="font-size:13px;">schedule</span>${dueText}
                    </div>` : ''}
                </div>
            `;
        });

        html += '</div></div>';
    });

    html += '</div>';
    container.innerHTML = html;
}

async function workerKbDrop(event, newStatus) {
    event.preventDefault();
    document.querySelectorAll('.kanban-dropzone-active').forEach(c => c.classList.remove('kanban-dropzone-active'));

    const taskIdStr = event.dataTransfer.getData('text/plain');
    if (!taskIdStr) return;
    const taskId = parseInt(taskIdStr);
    if (isNaN(taskId)) return;

    const task = workerTasksById && workerTasksById[taskId];
    if (!task) return;

    const currentStatus = task.status ? String(task.status).toUpperCase() : 'PENDING';
    if (currentStatus === newStatus) return;

    // Worker completing task
    if (newStatus === 'COMPLETED') {
        if (typeof showToast === 'function') showToast('Vui lòng báo cáo số liệu và minh chứng', 'info');
        else alert('Vui lòng báo cáo số liệu và minh chứng trước khi xác nhận hoàn thành.');
        openTaskDetail(taskId);
        // Do not reload task list instantly here, let the status update in the modal handle it
        return;
    }

    // Worker starting task (PENDING -> IN_PROGRESS)
    if (newStatus === 'IN_PROGRESS' && currentStatus === 'PENDING') {
        const cardElement = document.getElementById(`worker-kanban-card-${taskId}`);
        let dropzoneContainer = event.target.closest('div[ondrop]');
        const dropzoneCards = dropzoneContainer ? dropzoneContainer.querySelector('.wk-cards') : null;
        
        if (cardElement && dropzoneCards) {
            // Optimistic UI update
            dropzoneCards.appendChild(cardElement);
            cardElement.classList.add('kanban-card-dropped');
            setTimeout(() => cardElement.classList.remove('kanban-card-dropped'), 400);

            // Update local object
            task.status = 'IN_PROGRESS';
            
            // Update counts 
            if (dropzoneContainer) {
                const countBadge = dropzoneContainer.querySelector('.kanban-col-count');
                if (countBadge) countBadge.textContent = parseInt(countBadge.textContent || '0') + 1;
            }
        }

        try {
            if (typeof showToast === 'function') showToast('Đã bắt đầu thực hiện công việc!', 'success');
            
            // Execute fetching in background, then refresh both views to stay synced
            fetchAPI(`${API_BASE}/tasks/${taskId}/start`, 'POST').then(() => {
                // Refresh task list to sync List view with Kanban after successful start
                loadTasksList();
            }).catch(e => {
                console.error('Error starting task:', e);
                if (typeof showToast === 'function') showToast('Lỗi: ' + e.message, 'error');
                loadTasksList(); // Revert on error
            });
        } catch (e) {
            console.error('Error starting task:', e);
            if (typeof showToast === 'function') showToast('Lỗi: không thể bắt đầu', 'error');
            loadTasksList();
        }
        return;
    }

    // Other transitions not allowed for worker
    if (typeof showToast === 'function') showToast('Bạn không thể thay đổi trạng thái này', 'warning');
}

function cacheWorkerTasks(tasks) {
    workerTasksById = {};
    (Array.isArray(tasks) ? tasks : []).forEach(task => {
        if (task && task.id != null) {
            workerTasksById[task.id] = task;
        }
    });
}

async function completeTask(taskId) {
    const task = workerTasksById && workerTasksById[taskId] ? workerTasksById[taskId] : null;
    const hasPen = task && task.pen != null;
    const inspectionInfo = getInspectionTaskInfo(task);
    const errorEl = document.getElementById('inline-report-error');

    // Detect material-consuming tasks
    const materialTaskTypes = ['FEED', 'VACCINATE', 'FERTILIZE', 'SEED', 'PEST_CONTROL'];
    const taskType = task ? (task.taskType ? String(task.taskType).toUpperCase() : '') : '';
    const isMaterialTask = materialTaskTypes.includes(taskType);

    // For material-consuming tasks (pen or field): validate media only, no mortality
    if (isMaterialTask && (hasPen || (task && task.field != null))) {
        if (errorEl) errorEl.classList.add('hidden');
        const hasImage = !!_inlineImageBase64;
        const hasVideo = !!_inlineVideoBase64;

        if (!hasImage && !hasVideo) {
            if (errorEl) {
                errorEl.textContent = 'Vui lòng thêm ít nhất 1 ảnh hoặc 1 video minh chứng.';
                errorEl.classList.remove('hidden');
                errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        agriConfirm('Xác nhận hoàn thành', 'Bạn có chắc chắn muốn hoàn thành công việc này?', async () => {
        try {
            await stopActiveWorkLogIfNeeded(taskId);

            const payload = {};
            const infoLines = [];
            if (_inlineImageName) infoLines.push(`Ảnh: ${_inlineImageName}`);
            if (_inlineVideoName) infoLines.push(`Video: ${_inlineVideoName}`);
            payload.aiSuggestion = infoLines.join(' | ');

            // Upload media
            const authToken = getToken();
            if (_inlineImageBase64) {
                try {
                    const imageFile = document.getElementById('inline-image-input')?.files?.[0];
                    if (imageFile) {
                        const formData = new FormData();
                        formData.append('file', imageFile);
                        const uploadRes = await fetch(`${API_BASE}/tasks/${taskId}/upload-media`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${authToken}` },
                            body: formData
                        });
                        if (uploadRes.ok) {
                            const uploadData = await uploadRes.json();
                            payload.reportImageUrl = uploadData.url;
                        }
                    }
                } catch (uploadErr) { console.error('Image upload error:', uploadErr); }
            }
            if (_inlineVideoBase64) {
                try {
                    const videoFile = document.getElementById('inline-video-input')?.files?.[0];
                    if (videoFile) {
                        const formData = new FormData();
                        formData.append('file', videoFile);
                        const uploadRes = await fetch(`${API_BASE}/tasks/${taskId}/upload-media`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${authToken}` },
                            body: formData
                        });
                        if (uploadRes.ok) {
                            const uploadData = await uploadRes.json();
                            payload.reportVideoUrl = uploadData.url;
                        }
                    }
                } catch (uploadErr) { console.error('Video upload error:', uploadErr); }
            }

            await fetchAPI(`${API_BASE}/tasks/${taskId}/complete`, 'POST', payload);
            showNotification('success', 'Hoàn thành!', 'Công việc đã được ghi nhận. Chờ chủ trang trại duyệt.');
            _inlineImageBase64 = null; _inlineImageName = null;
            _inlineVideoBase64 = null; _inlineVideoName = null;
            await loadTasksList();
            openTaskDetail(taskId);
        } catch (err) {
            console.error('Complete task error:', err);
            showNotification('error', 'Lỗi', err.message || 'Không thể hoàn thành công việc.');
        }
        }, { confirmText: 'Hoàn thành', type: 'success' });
        return;
    }

    // For byproduct collection tasks (HARVEST with subType BYPRODUCT_COLLECTION)
    if (taskType === 'HARVEST' && task.workflowData) {
        try {
            const wfData = typeof task.workflowData === 'string' ? JSON.parse(task.workflowData) : task.workflowData;
            if (wfData.subType === 'BYPRODUCT_COLLECTION') {
                if (errorEl) errorEl.classList.add('hidden');

                const collectedQtyEl = document.getElementById('byproduct-collected-qty');
                const collectedQty = parseFloat(collectedQtyEl?.value);
                if (isNaN(collectedQty) || collectedQty < 0) {
                    if (errorEl) {
                        errorEl.textContent = 'Vui lòng nhập sản lượng thực tế thu được.';
                        errorEl.classList.remove('hidden');
                        errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    return;
                }

                agriConfirm('Xác nhận thu hoạch', `Xác nhận đã thu ${collectedQty} ${wfData.byproductUnit || ''}?`, async () => {

                try {
                    await stopActiveWorkLogIfNeeded(taskId);

                    // Update workflowData with collected quantity
                    const updatedWfData = { ...wfData, collectedQuantity: collectedQty };
                    const payload = {
                        aiSuggestion: `Thu ${wfData.byproductName || 'sản phẩm phụ'}: ${collectedQty} ${wfData.byproductUnit || ''}`
                    };

                    // Upload media if any
                    const authToken = getToken();
                    if (_inlineImageBase64) {
                        try {
                            const imageInput = document.querySelector('input[type="file"][accept="image/*"]');
                            const imageFile = imageInput?.files?.[0];
                            if (imageFile) {
                                const formData = new FormData();
                                formData.append('file', imageFile);
                                const uploadRes = await fetch(`${API_BASE}/tasks/${taskId}/upload-media`, {
                                    method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` }, body: formData
                                });
                                if (uploadRes.ok) { payload.reportImageUrl = (await uploadRes.json()).url; }
                            }
                        } catch (e) { console.error('Image upload error:', e); }
                    }
                    if (_inlineVideoBase64) {
                        try {
                            const videoInput = document.querySelector('input[type="file"][accept="video/*"]');
                            const videoFile = videoInput?.files?.[0];
                            if (videoFile) {
                                const formData = new FormData();
                                formData.append('file', videoFile);
                                const uploadRes = await fetch(`${API_BASE}/tasks/${taskId}/upload-media`, {
                                    method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` }, body: formData
                                });
                                if (uploadRes.ok) { payload.reportVideoUrl = (await uploadRes.json()).url; }
                            }
                        } catch (e) { console.error('Video upload error:', e); }
                    }

                    // Save collected quantity to workflowData on the task
                    try {
                        await fetchAPI(`${API_BASE}/tasks/${taskId}`, 'PUT', { workflowData: JSON.stringify(updatedWfData) });
                    } catch (e) { console.error('Workflow data update error:', e); }

                    await fetchAPI(`${API_BASE}/tasks/${taskId}/complete`, 'POST', payload);
                    showNotification('success', 'Hoàn thành!', `Đã ghi nhận thu ${collectedQty} ${wfData.byproductUnit || ''}. Chờ chủ trang trại duyệt.`);
                    _inlineImageBase64 = null; _inlineImageName = null;
                    _inlineVideoBase64 = null; _inlineVideoName = null;
                    await loadTasksList();
                    openTaskDetail(taskId);
                } catch (err) {
                    console.error('Complete byproduct task error:', err);
                    showNotification('error', 'Lỗi', err.message || 'Không thể hoàn thành công việc.');
                }
                }, { confirmText: 'Xác nhận', type: 'success' });
                return;
            }
        } catch (e) { /* not a byproduct collection task, continue */ }
    }

    // For pen tasks: validate inline media + mortality sections
    if (hasPen) {
        if (errorEl) errorEl.classList.add('hidden');
        const hasImage = !!_inlineImageBase64;
        const hasVideo = !!_inlineVideoBase64;

        if (!hasImage && !hasVideo) {
            if (errorEl) {
                errorEl.textContent = 'Vui lòng thêm ít nhất 1 ảnh hoặc 1 video minh chứng.';
                errorEl.classList.remove('hidden');
                errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        // Validate mortality section is acknowledged (qty field exists for pen tasks)
        const mortalityQtyEl = document.getElementById('inline-mortality-qty');
        if (mortalityQtyEl && mortalityQtyEl.value === '') {
            if (errorEl) {
                errorEl.textContent = 'Vui lòng nhập số lượng hao hụt (nhập 0 nếu không có).';
                errorEl.classList.remove('hidden');
                errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        const mortalityQty = parseInt(mortalityQtyEl?.value) || 0;
        if (mortalityQty > 0) {
            const cause = (document.getElementById('inline-mortality-cause')?.value || '').trim();
            if (!cause) {
                if (errorEl) {
                    errorEl.textContent = 'Vui lòng nhập nguyên nhân hao hụt.';
                    errorEl.classList.remove('hidden');
                    errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }
        }

        // For inspection tasks: validate condition
        if (inspectionInfo) {
            const condSelect = document.getElementById('inline-condition-select');
            if (condSelect && !condSelect.value) {
                if (errorEl) {
                    errorEl.textContent = 'Vui lòng chọn tình trạng đánh giá.';
                    errorEl.classList.remove('hidden');
                    errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }
        }

        agriConfirm('Xác nhận hoàn thành', 'Bạn có chắc chắn muốn hoàn thành công việc này?', async () => {

        try {
            await stopActiveWorkLogIfNeeded(taskId);

            const penId = task.pen.id;
            const mortalityQtyVal = parseInt(document.getElementById('inline-mortality-qty')?.value) || 0;

            // Record mortality if > 0
            if (mortalityQtyVal > 0 && penId) {
                const cause = (document.getElementById('inline-mortality-cause')?.value || '').trim();
                const causeType = document.getElementById('inline-mortality-type')?.value || 'DEATH';
                const estimatedLoss = parseFloat(document.getElementById('inline-mortality-loss')?.value) || 0;
                try {
                    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
                    await fetch(`${API_BASE}/livestock/pens/${penId}/mortality`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        },
                        body: JSON.stringify({
                            quantity: mortalityQtyVal,
                            cause: cause,
                            causeType: causeType,
                            eventDate: new Date().toISOString().split('T')[0],
                            estimatedLoss: estimatedLoss,
                            notes: 'Ghi nhận bởi nhân công qua báo cáo công việc',
                            animalName: 'Vật nuôi'
                        })
                    });
                } catch (mortalityErr) {
                    console.error('Mortality recording error:', mortalityErr);
                }
            }

            // Build payload
            const payload = {};
            if (inspectionInfo) {
                const condition = document.getElementById('inline-condition-select')?.value || '';
                payload.condition = condition.toUpperCase();
            }

            // Upload media files to server
            const authToken = getToken();
            let uploadedImageUrl = null;
            let uploadedVideoUrl = null;

            if (_inlineImageBase64) {
                try {
                    const imageFile = document.getElementById('inline-image-input')?.files?.[0];
                    if (imageFile) {
                        const formData = new FormData();
                        formData.append('file', imageFile);
                        const uploadRes = await fetch(`${API_BASE}/tasks/${taskId}/upload-media`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${authToken}` },
                            body: formData
                        });
                        if (uploadRes.ok) {
                            const uploadData = await uploadRes.json();
                            uploadedImageUrl = uploadData.url;
                            console.log('Image uploaded:', uploadedImageUrl);
                        } else {
                            console.error('Image upload failed:', uploadRes.status, await uploadRes.text());
                        }
                    } else {
                        console.warn('Image file input not found, using base64 fallback');
                    }
                } catch (uploadErr) {
                    console.error('Image upload error:', uploadErr);
                }
            }

            if (_inlineVideoBase64) {
                try {
                    const videoFile = document.getElementById('inline-video-input')?.files?.[0];
                    if (videoFile) {
                        const formData = new FormData();
                        formData.append('file', videoFile);
                        const uploadRes = await fetch(`${API_BASE}/tasks/${taskId}/upload-media`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${authToken}` },
                            body: formData
                        });
                        if (uploadRes.ok) {
                            const uploadData = await uploadRes.json();
                            uploadedVideoUrl = uploadData.url;
                            console.log('Video uploaded:', uploadedVideoUrl);
                        } else {
                            console.error('Video upload failed:', uploadRes.status, await uploadRes.text());
                        }
                    } else {
                        console.warn('Video file input not found, using base64 fallback');
                    }
                } catch (uploadErr) {
                    console.error('Video upload error:', uploadErr);
                }
            }

            // Build aiSuggestion with media + mortality info for owner
            const infoLines = [];
            if (_inlineImageName) infoLines.push(`Ảnh chuồng: ${_inlineImageName}`);
            if (_inlineVideoName) infoLines.push(`Video: ${_inlineVideoName}`);
            if (mortalityQtyVal > 0) {
                const cause = (document.getElementById('inline-mortality-cause')?.value || '').trim();
                const causeType = document.getElementById('inline-mortality-type')?.value || 'DEATH';
                infoLines.push(`Hao hụt: ${mortalityQtyVal} con (${causeType}) - ${cause}`);
            } else {
                infoLines.push('Hao hụt: 0 con');
            }
            if (inspectionInfo && payload.condition) {
                payload.aiSuggestion = `${payload.condition}: Báo cáo kiểm tra | ${infoLines.join(' | ')}`;
            } else {
                payload.aiSuggestion = infoLines.join(' | ');
            }

            // Include uploaded media URLs in payload
            if (uploadedImageUrl) payload.reportImageUrl = uploadedImageUrl;
            if (uploadedVideoUrl) payload.reportVideoUrl = uploadedVideoUrl;

            await fetchAPI(`${API_BASE}/tasks/${taskId}/complete`, 'POST', payload);

            // Store media in localStorage (fallback for same-browser viewing)
            const photoStore = JSON.parse(localStorage.getItem('inspectionPhotos') || '{}');
            if (_inlineImageBase64) {
                photoStore[`task_${taskId}_photo1`] = _inlineImageBase64;
            }
            if (_inlineVideoBase64) {
                photoStore[`task_${taskId}_video`] = _inlineVideoBase64;
            }
            const keys = Object.keys(photoStore);
            if (keys.length > 40) {
                keys.slice(0, keys.length - 40).forEach(k => delete photoStore[k]);
            }
            localStorage.setItem('inspectionPhotos', JSON.stringify(photoStore));

            // Reset inline state
            _inlineImageBase64 = null; _inlineImageName = null;
            _inlineVideoBase64 = null; _inlineVideoName = null;

            // Success notification
            const conditionLabels = { 'CLEAN': 'Sạch', 'DIRTY': 'Bẩn', 'SICK': 'Có dấu hiệu bệnh', 'GOOD': 'Tốt', 'FAIR': 'Trung bình', 'POOR': 'Kém' };
            let successMsg = 'Đã hoàn thành công việc.';
            if (inspectionInfo && payload.condition) {
                successMsg = `Đã hoàn thành kiểm tra. Tình trạng: ${conditionLabels[payload.condition] || payload.condition}`;
            }
            if (mortalityQtyVal > 0) {
                successMsg += `. Hao hụt: ${mortalityQtyVal} con`;
            }
            showNotification('success', 'Thành công', successMsg);

            loadHomeData();
            await loadTasksList();
            loadUserProfile();

            const detailView = document.getElementById('view-task-detail');
            if (detailView) {
                openTaskDetail(taskId);
            }
        } catch (e) {
            let msg = e.message;
            if (msg.includes('Không đủ vật tư')) {
                msg = 'Kho không đủ vật tư để thực hiện công việc này. Vui lòng liên hệ chủ trang trại.';
            }
            if (errorEl) {
                errorEl.textContent = 'Lỗi: ' + msg;
                errorEl.classList.remove('hidden');
            } else {
                agriAlert('Lỗi: ' + msg, 'error');
            }
        }
        }, { confirmText: 'Hoàn thành', type: 'success' });
        return;
    }

    // ── FIELD tasks: handle crop loss recording ──
    const hasField = task && task.field != null;
    if (hasField) {
        if (errorEl) errorEl.classList.add('hidden');

        // Validate condition for inspection
        if (inspectionInfo) {
            const condSelect = document.getElementById('inline-condition-select');
            if (condSelect && !condSelect.value) {
                if (errorEl) {
                    errorEl.textContent = 'Vui lòng chọn tình trạng đánh giá.';
                    errorEl.classList.remove('hidden');
                    errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }
        }

        // If "has loss" checkbox is checked, validate polygon was drawn
        const hasLoss = window._inlineFieldHasLoss;
        if (hasLoss) {
            if (!window._inlineFieldLossPolygon || window._inlineFieldLossPolygon.length < 3) {
                if (errorEl) {
                    errorEl.textContent = 'Vui lòng vẽ vùng bị hư hại trên bản đồ.';
                    errorEl.classList.remove('hidden');
                    errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }
        }

        agriConfirm('Xác nhận hoàn thành', 'Bạn có chắc chắn muốn hoàn thành công việc này?', async () => {

        try {
            await stopActiveWorkLogIfNeeded(taskId);

            // Upload media files if present
            const authToken = getToken();
            let uploadedImageUrl = null;
            let uploadedVideoUrl = null;

            if (_inlineImageBase64) {
                try {
                    const imageFile = document.getElementById('inline-image-input')?.files?.[0];
                    if (imageFile) {
                        const formData = new FormData();
                        formData.append('file', imageFile);
                        const uploadRes = await fetch(`${API_BASE}/tasks/${taskId}/upload-media`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${authToken}` },
                            body: formData
                        });
                        if (uploadRes.ok) {
                            const uploadData = await uploadRes.json();
                            uploadedImageUrl = uploadData.url;
                        }
                    }
                } catch (uploadErr) { console.error('Image upload error:', uploadErr); }
            }

            if (_inlineVideoBase64) {
                try {
                    const videoFile = document.getElementById('inline-video-input')?.files?.[0];
                    if (videoFile) {
                        const formData = new FormData();
                        formData.append('file', videoFile);
                        const uploadRes = await fetch(`${API_BASE}/tasks/${taskId}/upload-media`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${authToken}` },
                            body: formData
                        });
                        if (uploadRes.ok) {
                            const uploadData = await uploadRes.json();
                            uploadedVideoUrl = uploadData.url;
                        }
                    }
                } catch (uploadErr) { console.error('Video upload error:', uploadErr); }
            }

            // Record field loss if worker indicated damage
            if (hasLoss && window._inlineFieldLossPolygon && window._inlineFieldLossPolygon.length >= 3) {
                const cause = document.getElementById('inline-field-loss-cause')?.value || 'OTHER';
                const causeDetail = (document.getElementById('inline-field-loss-cause-detail')?.value || '').trim();
                const notes = (document.getElementById('inline-field-loss-notes')?.value || '').trim();
                const lossPayload = {
                    fieldId: task.field.id,
                    taskId: taskId,
                    lossAreaSqm: window._inlineFieldLossAreaSqm || 0,
                    lossPolygon: JSON.stringify(window._inlineFieldLossPolygon),
                    cause: cause,
                    causeDetail: causeDetail,
                    notes: notes,
                    reportDate: new Date().toISOString().split('T')[0],
                    reportedBy: localStorage.getItem('workerName') || localStorage.getItem('fullName') || 'Worker'
                };
                if (uploadedImageUrl) lossPayload.reportImageUrl = uploadedImageUrl;
                if (uploadedVideoUrl) lossPayload.reportVideoUrl = uploadedVideoUrl;

                try {
                    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
                    await fetch(`${API_BASE}/field-losses`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        },
                        body: JSON.stringify(lossPayload)
                    });
                } catch (lossErr) {
                    console.error('Field loss recording error:', lossErr);
                }
            }

            // Build payload for task completion
            const payload = {};
            if (inspectionInfo) {
                const condition = document.getElementById('inline-condition-select')?.value || '';
                payload.condition = condition.toUpperCase();
            }
            if (uploadedImageUrl) payload.reportImageUrl = uploadedImageUrl;
            if (uploadedVideoUrl) payload.reportVideoUrl = uploadedVideoUrl;

            // Build aiSuggestion text
            const infoLines = [];
            if (_inlineImageName) infoLines.push(`Ảnh ruộng: ${_inlineImageName}`);
            if (_inlineVideoName) infoLines.push(`Video: ${_inlineVideoName}`);
            if (hasLoss) {
                const areaSqm = window._inlineFieldLossAreaSqm || 0;
                const cause = document.getElementById('inline-field-loss-cause')?.value || 'OTHER';
                const causeLabels = { DISEASE: 'Dịch bệnh', PESTS: 'Sâu bệnh', WEATHER: 'Thời tiết', FLOOD: 'Ngập lụt', DROUGHT: 'Hạn hán', OTHER: 'Khác' };
                infoLines.push(`Hao hụt: ${areaSqm.toFixed(1)} m² (${causeLabels[cause] || cause})`);
            } else {
                infoLines.push('Hao hụt: Không có');
            }
            if (inspectionInfo && payload.condition) {
                payload.aiSuggestion = `${payload.condition}: Báo cáo kiểm tra ruộng | ${infoLines.join(' | ')}`;
            } else {
                payload.aiSuggestion = infoLines.join(' | ');
            }

            await fetchAPI(`${API_BASE}/tasks/${taskId}/complete`, 'POST', payload);

            // Store inline media in localStorage fallback
            const photoStore = JSON.parse(localStorage.getItem('inspectionPhotos') || '{}');
            if (_inlineImageBase64) photoStore[`task_${taskId}_photo1`] = _inlineImageBase64;
            if (_inlineVideoBase64) photoStore[`task_${taskId}_video`] = _inlineVideoBase64;
            const keys = Object.keys(photoStore);
            if (keys.length > 40) keys.slice(0, keys.length - 40).forEach(k => delete photoStore[k]);
            localStorage.setItem('inspectionPhotos', JSON.stringify(photoStore));

            // Reset inline state
            _inlineImageBase64 = null; _inlineImageName = null;
            _inlineVideoBase64 = null; _inlineVideoName = null;
            destroyFieldLossMap();

            // Success notification
            const conditionLabels = { 'GOOD': 'Tốt', 'FAIR': 'Trung bình', 'POOR': 'Kém' };
            let successMsg = 'Đã hoàn thành công việc.';
            if (inspectionInfo && payload.condition) {
                successMsg = `Đã hoàn thành kiểm tra ruộng. Tình trạng: ${conditionLabels[payload.condition] || payload.condition}`;
            }
            if (hasLoss) {
                successMsg += `. Ghi nhận hao hụt ${(window._inlineFieldLossAreaSqm || 0).toFixed(1)} m²`;
            }
            showNotification('success', 'Thành công', successMsg);

            loadHomeData();
            await loadTasksList();
            loadUserProfile();

            const detailView = document.getElementById('view-task-detail');
            if (detailView) openTaskDetail(taskId);
        } catch (e) {
            let msg = e.message;
            if (msg.includes('Không đủ vật tư')) {
                msg = 'Kho không đủ vật tư để thực hiện công việc này. Vui lòng liên hệ chủ trang trại.';
            }
            if (errorEl) {
                errorEl.textContent = 'Lỗi: ' + msg;
                errorEl.classList.remove('hidden');
            } else {
                agriAlert('Lỗi: ' + msg, 'error');
            }
        }
        }, { confirmText: 'Hoàn thành', type: 'success' });
        return;
    }

    // Non-pen, non-field tasks: simple confirmation
    agriConfirm('Xác nhận hoàn thành', 'Bạn có chắc chắn muốn hoàn thành công việc này?', async () => {
    try {
        await stopActiveWorkLogIfNeeded(taskId);
        await fetchAPI(`${API_BASE}/tasks/${taskId}/complete`, 'POST');

        // Refresh data silently
        loadHomeData();
        await loadTasksList();
        loadUserProfile();

        // Re-open detail view with updated data if still viewing detail
        const detailView = document.getElementById('view-task-detail');
        if (detailView && !detailView.classList.contains('hidden')) {
            openTaskDetail(taskId);
        }
    } catch (e) {
        let msg = e.message;
        if (msg.includes('Không đủ vật tư')) {
            msg = 'Kho không đủ vật tư để thực hiện công việc này. Vui lòng liên hệ chủ trang trại.';
        }
        agriAlert('Lỗi: ' + msg, 'error');
    }
    }, { confirmText: 'Hoàn thành', type: 'success' });
}

function getInspectionTaskInfo(task) {
    if (!task) return null;
    const taskType = task.taskType != null ? String(task.taskType).toUpperCase() : '';
    if (taskType !== 'OTHER' && taskType !== 'INSPECTION') return null;

    const name = task.name != null ? String(task.name).toLowerCase() : '';
    const isFieldName = name.startsWith('kiểm tra ruộng');
    const isPenName = name.startsWith('kiểm tra chuồng');

    const hasField = task.field != null;
    const hasPen = task.pen != null;

    if (hasField && (isFieldName || !hasPen)) return { kind: 'FIELD' };
    if (hasPen && (isPenName || !hasField)) return { kind: 'PEN' };
    return null;
}

function getInspectionValueLabel(kind, value) {
    const v = value != null ? String(value).toUpperCase() : '';
    if (kind === 'FIELD') {
        const map = { GOOD: 'Tốt', FAIR: 'Trung bình', POOR: 'Kém' };
        return map[v] || v;
    }
    if (kind === 'PEN') {
        const map = { CLEAN: 'Sạch', DIRTY: 'Bẩn', SICK: 'Có dấu hiệu bệnh' };
        return map[v] || v;
    }
    return v;
}

function getInspectionDefaultValue(task, info) {
    const kind = info && info.kind ? info.kind : null;
    if (kind === 'FIELD') {
        const current = task && task.field && task.field.condition != null ? String(task.field.condition).toUpperCase() : null;
        return current === 'GOOD' || current === 'FAIR' || current === 'POOR' ? current : 'GOOD';
    }
    if (kind === 'PEN') {
        const current = task && task.pen && task.pen.status != null ? String(task.pen.status).toUpperCase() : null;
        return current === 'CLEAN' || current === 'DIRTY' || current === 'SICK' ? current : 'CLEAN';
    }
    return '';
}

function openInspectionCompletionModal(task, info) {
    if (!task || !info) return;

    inspectionModalContext = { taskId: task.id, kind: info.kind, penId: task.pen ? task.pen.id : null, penAnimalCount: task.pen ? (task.pen.animalCount || 0) : 0 };
    inspectionSelectedImageBase64 = null;
    inspectionSelectedFileName = null;
    inspectionAiSuggestedValue = null;
    inspectionAiSuggestionText = null;
    // Second photo for pen inspections
    window._inspectionPhoto2Base64 = null;
    window._inspectionPhoto2FileName = null;

    const kind = info.kind;
    const label = kind === 'FIELD' ? 'Tình trạng ruộng' : 'Tình trạng chuồng';
    const defaultValue = getInspectionDefaultValue(task, info);

    const options = kind === 'FIELD'
        ? [
            { value: 'GOOD', label: 'Tốt' },
            { value: 'FAIR', label: 'Trung bình' },
            { value: 'POOR', label: 'Kém' }
        ]
        : [
            { value: 'CLEAN', label: 'Sạch' },
            { value: 'DIRTY', label: 'Bẩn' },
            { value: 'SICK', label: 'Có dấu hiệu bệnh' }
        ];

    const optionsHtml = options.map(opt => {
        const selected = opt.value === defaultValue ? 'selected' : '';
        return `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
    }).join('');

    const isPen = kind === 'PEN';
    const penAnimalCount = isPen && task.pen ? (task.pen.animalCount || 0) : 0;
    const animalUnit = isPen && task.pen && task.pen.animalDefinition ? (task.pen.animalDefinition.unit || 'con') : 'con';

    // Build mortality section for pen inspections
    const mortalitySectionHtml = isPen ? `
                <!-- Mortality / Loss Section -->
                <div style="border-top:1px solid #f3f4f6; padding-top:16px;">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:12px;">
                        <span class="material-symbols-outlined" style="font-size:20px; color:#ea580c;">heart_broken</span>
                        <span style="font-size:14px; font-weight:700; color:#374151;">Ghi nhận hao hụt (nếu có)</span>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
                        <div>
                            <label style="display:block; font-size:12px; font-weight:500; color:#6b7280; margin-bottom:4px;">Số lượng hao hụt</label>
                            <input type="number" id="inspection-mortality-qty" min="0" max="${penAnimalCount}" value="0"
                                style="width:100%; padding:8px 12px; border:1px solid #d1d5db; border-radius:8px; font-size:14px;" placeholder="0"
                                oninput="toggleInspectionMortalityDetail()">
                        </div>
                        <div>
                            <label style="display:block; font-size:12px; font-weight:500; color:#6b7280; margin-bottom:4px;">Loại hao hụt</label>
                            <select id="inspection-mortality-type" style="width:100%; padding:8px 12px; border:1px solid #d1d5db; border-radius:8px; font-size:14px;">
                                <option value="DEATH">Chết</option>
                                <option value="DISEASE">Bệnh</option>
                                <option value="ACCIDENT">Tai nạn</option>
                                <option value="CULL">Loại thải</option>
                            </select>
                        </div>
                    </div>

                    <div id="inspection-mortality-detail" style="display:none;">
                        <div style="margin-bottom:12px;">
                            <label style="display:block; font-size:12px; font-weight:500; color:#6b7280; margin-bottom:4px;">Nguyên nhân cụ thể <span style="color:#dc2626;">*</span></label>
                            <input type="text" id="inspection-mortality-cause" style="width:100%; padding:8px 12px; border:1px solid #d1d5db; border-radius:8px; font-size:14px;" placeholder="VD: Dịch tả, sốc nhiệt...">
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="display:block; font-size:12px; font-weight:500; color:#6b7280; margin-bottom:4px;">Ước tính thiệt hại (₫)</label>
                            <input type="number" id="inspection-mortality-loss" min="0" step="1000" value="0"
                                style="width:100%; padding:8px 12px; border:1px solid #d1d5db; border-radius:8px; font-size:14px;" placeholder="0">
                        </div>
                    </div>

                    <div style="font-size:11px; color:#9ca3af;">Số lượng hiện có: ${penAnimalCount} ${animalUnit}. Để 0 nếu không có hao hụt.</div>
                </div>
    ` : '';

    // For pen inspections: 2 required photos
    const photoSectionHtml = isPen ? `
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Ảnh chuồng (bắt buộc) <span style="color:#dc2626;">*</span></label>
                    <div class="bg-green-50 border-2 border-dashed border-primary rounded-xl p-6 text-center cursor-pointer" onclick="document.getElementById('inspection-image-input').click()">
                        <span class="material-symbols-outlined" style="font-size: 40px; color: #10b981;">photo_camera</span>
                        <p class="mt-1 text-sm font-medium text-green-800">Chụp ảnh tình trạng chuồng</p>
                        <p class="mt-1 text-xs text-green-700 opacity-80">JPG, PNG</p>
                    </div>
                    <input type="file" id="inspection-image-input" accept="image/*" class="hidden" onchange="onInspectionImageSelected(event)" />
                    <div id="inspection-image-preview" class="hidden mt-2 rounded-xl border border-gray-200 overflow-hidden">
                        <img id="inspection-image-preview-img" src="" class="w-full max-h-48 object-contain bg-gray-50" alt="preview" />
                        <div class="px-3 py-2 text-xs text-gray-500" id="inspection-image-file-name"></div>
                    </div>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Ảnh vật nuôi / đếm số (bắt buộc) <span style="color:#dc2626;">*</span></label>
                    <div class="bg-orange-50 border-2 border-dashed border-orange-300 rounded-xl p-6 text-center cursor-pointer" style="background:#fff7ed; border-color:#fdba74;" onclick="document.getElementById('inspection-image-input-2').click()">
                        <span class="material-symbols-outlined" style="font-size: 40px; color: #ea580c;">pets</span>
                        <p class="mt-1 text-sm font-medium" style="color:#9a3412;">Chụp ảnh vật nuôi / con chết</p>
                        <p class="mt-1 text-xs" style="color:#c2410c; opacity:0.8;">JPG, PNG</p>
                    </div>
                    <input type="file" id="inspection-image-input-2" accept="image/*" class="hidden" onchange="onInspectionImage2Selected(event)" />
                    <div id="inspection-image-preview-2" class="hidden mt-2 rounded-xl border border-gray-200 overflow-hidden">
                        <img id="inspection-image-preview-img-2" src="" class="w-full max-h-48 object-contain bg-gray-50" alt="preview 2" />
                        <div class="px-3 py-2 text-xs text-gray-500" id="inspection-image-file-name-2"></div>
                    </div>
                </div>
    ` : `
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Ảnh (tuỳ chọn)</label>
                    <div class="bg-green-50 border-2 border-dashed border-primary rounded-xl p-8 text-center cursor-pointer" onclick="document.getElementById('inspection-image-input').click()">
                        <span class="material-symbols-outlined" style="font-size: 48px; color: #10b981;">cloud_upload</span>
                        <p class="mt-2 text-sm font-medium text-green-800">Click để chọn hình ảnh</p>
                        <p class="mt-1 text-xs text-green-700 opacity-80">JPG, PNG...</p>
                    </div>
                    <input type="file" id="inspection-image-input" accept="image/*" class="hidden" onchange="onInspectionImageSelected(event)" />
                    <div id="inspection-image-preview" class="hidden mt-3 rounded-xl border border-gray-200 overflow-hidden">
                        <img id="inspection-image-preview-img" src="" class="w-full max-h-72 object-contain bg-gray-50" alt="preview" />
                        <div class="px-3 py-2 text-xs text-gray-500" id="inspection-image-file-name"></div>
                    </div>
                </div>
    `;

    openModal('inspection-complete-modal', `
        <div class="bg-white rounded-2xl p-6 w-[640px] max-w-full">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <h3 class="text-lg font-bold text-gray-800">Hoàn thành kiểm tra</h3>
                    <p class="text-sm text-gray-500 mt-1">${escapeHtml(task.name || '')}</p>
                </div>
                <button type="button" class="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center" onclick="closeModal('inspection-complete-modal')">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>

            <div class="mt-5 space-y-5">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">${label}</label>
                    <select id="inspection-condition-select" class="w-full rounded-lg border-gray-300 focus:border-primary focus:ring-primary">
                        ${optionsHtml}
                    </select>
                </div>

                ${photoSectionHtml}

                <div class="flex flex-col sm:flex-row gap-3">
                    <button id="inspection-ai-btn" type="button" class="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed" onclick="runInspectionAiSuggestion()" disabled>
                        <span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle; margin-right: 6px;">auto_awesome</span>
                        Gợi ý AI
                    </button>
                    <button id="inspection-ai-apply-btn" type="button" class="px-4 py-2 rounded-lg bg-green-50 text-primary font-medium hover:bg-green-100 disabled:opacity-60 disabled:cursor-not-allowed" onclick="applyInspectionAiSuggestion()" disabled>
                        Áp dụng gợi ý
                    </button>
                </div>

                <div id="inspection-ai-result" class="hidden p-4 rounded-xl border border-gray-200 bg-gray-50">
                    <div class="text-sm font-semibold text-gray-800">Gợi ý AI</div>
                    <div class="text-sm text-gray-600 mt-1" id="inspection-ai-result-text"></div>
                    <div class="text-xs text-gray-500 mt-2" id="inspection-ai-result-value"></div>
                </div>

                ${mortalitySectionHtml}

                <div id="inspection-complete-error" class="hidden p-3 rounded-lg bg-red-50 text-red-600 text-sm"></div>
            </div>

            <div class="mt-6 flex justify-end gap-3">
                <button type="button" class="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50" onclick="closeModal('inspection-complete-modal')">Hủy</button>
                <button id="inspection-complete-btn" type="button" class="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark" onclick="submitInspectionCompletion(${task.id})">Hoàn thành</button>
            </div>
        </div>
    `);
}

// Handle second photo for pen inspections
function onInspectionImage2Selected(event) {
    const file = event && event.target && event.target.files ? event.target.files[0] : null;
    const previewWrap = document.getElementById('inspection-image-preview-2');
    const previewImg = document.getElementById('inspection-image-preview-img-2');
    const fileNameEl = document.getElementById('inspection-image-file-name-2');

    window._inspectionPhoto2Base64 = null;
    window._inspectionPhoto2FileName = null;

    if (!file) {
        if (previewWrap) previewWrap.classList.add('hidden');
        if (previewImg) previewImg.src = '';
        if (fileNameEl) fileNameEl.textContent = '';
        return;
    }

    window._inspectionPhoto2FileName = file.name || '';
    if (fileNameEl) fileNameEl.textContent = window._inspectionPhoto2FileName;

    const reader = new FileReader();
    reader.onload = (e) => {
        window._inspectionPhoto2Base64 = e.target?.result;
        if (previewImg) previewImg.src = window._inspectionPhoto2Base64 || '';
        if (previewWrap) previewWrap.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

// Toggle mortality detail form based on quantity > 0
function toggleInspectionMortalityDetail() {
    const qty = parseInt(document.getElementById('inspection-mortality-qty')?.value) || 0;
    const detail = document.getElementById('inspection-mortality-detail');
    if (detail) {
        detail.style.display = qty > 0 ? 'block' : 'none';
    }
}

function onInspectionImageSelected(event) {
    const file = event && event.target && event.target.files ? event.target.files[0] : null;
    const previewWrap = document.getElementById('inspection-image-preview');
    const previewImg = document.getElementById('inspection-image-preview-img');
    const fileNameEl = document.getElementById('inspection-image-file-name');
    const aiBtn = document.getElementById('inspection-ai-btn');
    const applyBtn = document.getElementById('inspection-ai-apply-btn');
    const aiBox = document.getElementById('inspection-ai-result');
    const errorEl = document.getElementById('inspection-complete-error');

    if (errorEl) errorEl.classList.add('hidden');

    inspectionSelectedImageBase64 = null;
    inspectionSelectedFileName = null;
    inspectionAiSuggestedValue = null;
    inspectionAiSuggestionText = null;

    if (aiBox) aiBox.classList.add('hidden');
    if (applyBtn) applyBtn.disabled = true;

    if (!file) {
        if (previewWrap) previewWrap.classList.add('hidden');
        if (aiBtn) aiBtn.disabled = true;
        if (fileNameEl) fileNameEl.textContent = '';
        if (previewImg) previewImg.src = '';
        return;
    }

    inspectionSelectedFileName = file.name || '';
    if (fileNameEl) fileNameEl.textContent = inspectionSelectedFileName;

    const reader = new FileReader();
    reader.onload = (e) => {
        inspectionSelectedImageBase64 = e.target?.result;
        if (previewImg) previewImg.src = inspectionSelectedImageBase64 || '';
        if (previewWrap) previewWrap.classList.remove('hidden');
    };
    reader.readAsDataURL(file);

    if (aiBtn) aiBtn.disabled = false;
}

function runInspectionAiSuggestion() {
    const errorEl = document.getElementById('inspection-complete-error');
    const btn = document.getElementById('inspection-ai-btn');
    const applyBtn = document.getElementById('inspection-ai-apply-btn');

    if (errorEl) errorEl.classList.add('hidden');

    if (!inspectionSelectedFileName) {
        if (errorEl) {
            errorEl.textContent = 'Vui lòng chọn ảnh trước.';
            errorEl.classList.remove('hidden');
        }
        return;
    }

    const oldHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle; margin-right: 6px;">sync</span> Đang phân tích...';
    }
    if (applyBtn) applyBtn.disabled = true;

    setTimeout(() => {
        const kind = inspectionModalContext && inspectionModalContext.kind ? inspectionModalContext.kind : null;
        const name = String(inspectionSelectedFileName || '').toLowerCase();

        let suggestedValue = null;
        let text = 'Không thể xác định rõ từ ảnh. Vui lòng chọn thủ công.';

        if (kind === 'FIELD') {
            if (name.includes('cay_khoe') || name.includes('healthy') || name.includes('khoe')) {
                suggestedValue = 'GOOD';
                text = 'AI nhận định ruộng/cây trồng đang ở trạng thái tốt.';
            } else if (
                name.includes('ray') ||
                name.includes('sau') ||
                name.includes('pest') ||
                name.includes('benh') ||
                name.includes('dao_on') ||
                name.includes('nhen') ||
                name.includes('rep') ||
                name.includes('virus') ||
                name.includes('kham') ||
                name.includes('oc_')
            ) {
                suggestedValue = 'POOR';
                text = 'AI phát hiện dấu hiệu sâu bệnh/bất thường. Nên kiểm tra kỹ và xử lý kịp thời.';
            }
        } else if (kind === 'PEN') {
            if (name.includes('chuong_sach') || name.includes('clean') || name.includes('sach')) {
                suggestedValue = 'CLEAN';
                text = 'AI nhận định chuồng trại sạch sẽ.';
            } else if (name.includes('chuong_do') || name.includes('dirty') || name.includes('ban')) {
                suggestedValue = 'DIRTY';
                text = 'AI nhận định chuồng trại bẩn, cần vệ sinh.';
            } else if (name.includes('sick') || name.includes('benh') || name.includes('om')) {
                suggestedValue = 'SICK';
                text = 'AI phát hiện dấu hiệu bất thường về sức khỏe vật nuôi.';
            }
        }

        // Fallback Random Mockup if name doesn't match keys (For Demo Purpose)
        if (!suggestedValue) {
            const random = Math.random();
            if (kind === 'FIELD') {
                if (random > 0.7) { suggestedValue = 'GOOD'; text = 'AI nhận định ruộng tốt (Dự đoán).'; }
                else if (random > 0.4) { suggestedValue = 'FAIR'; text = 'AI nhận định ruộng bình thường (Dự đoán).'; }
                else { suggestedValue = 'POOR'; text = 'AI nghi ngờ có rủi ro sâu bệnh (Dự đoán).'; }
            } else {
                if (random > 0.7) { suggestedValue = 'CLEAN'; text = 'AI nhận định chuồng sạch (Dự đoán).'; }
                else if (random > 0.4) { suggestedValue = 'DIRTY'; text = 'AI nhận định chuồng cần vệ sinh (Dự đoán).'; }
                else { suggestedValue = 'SICK'; text = 'AI nghi ngờ vật nuôi có vấn đề (Dự đoán).'; }
            }
        }

        inspectionAiSuggestedValue = suggestedValue;
        inspectionAiSuggestionText = text;

        const aiBox = document.getElementById('inspection-ai-result');
        const aiTextEl = document.getElementById('inspection-ai-result-text');
        const aiValueEl = document.getElementById('inspection-ai-result-value');

        if (aiTextEl) aiTextEl.textContent = text || '';
        if (aiValueEl) {
            aiValueEl.textContent = suggestedValue
                ? `Đề xuất: ${getInspectionValueLabel(kind, suggestedValue)} (${suggestedValue})`
                : 'Không đưa ra đề xuất tự động.';
        }
        if (aiBox) aiBox.classList.remove('hidden');
        if (applyBtn) applyBtn.disabled = !suggestedValue;

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = oldHtml;
        }
    }, 900);
}

function applyInspectionAiSuggestion() {
    const select = document.getElementById('inspection-condition-select');
    if (!select || !inspectionAiSuggestedValue) return;
    select.value = inspectionAiSuggestedValue;
}

async function submitInspectionCompletion(taskId) {
    const select = document.getElementById('inspection-condition-select');
    const conditionRaw = select ? String(select.value || '').trim() : '';
    const condition = conditionRaw.toUpperCase();
    const btn = document.getElementById('inspection-complete-btn');
    const oldHtml = btn ? btn.innerHTML : '';
    const errorEl = document.getElementById('inspection-complete-error');
    const isPen = inspectionModalContext && inspectionModalContext.kind === 'PEN';

    if (errorEl) errorEl.classList.add('hidden');

    if (!condition) {
        if (errorEl) {
            errorEl.textContent = 'Vui lòng chọn tình trạng.';
            errorEl.classList.remove('hidden');
        }
        return;
    }

    // For pen inspections: validate 2 required photos
    if (isPen) {
        if (!inspectionSelectedImageBase64) {
            if (errorEl) {
                errorEl.textContent = 'Vui lòng chụp ảnh tình trạng chuồng (ảnh 1).';
                errorEl.classList.remove('hidden');
            }
            return;
        }
        if (!window._inspectionPhoto2Base64) {
            if (errorEl) {
                errorEl.textContent = 'Vui lòng chụp ảnh vật nuôi / đếm số lượng (ảnh 2).';
                errorEl.classList.remove('hidden');
            }
            return;
        }

        // If mortality quantity > 0, cause is required
        const mortalityQty = parseInt(document.getElementById('inspection-mortality-qty')?.value) || 0;
        if (mortalityQty > 0) {
            const cause = (document.getElementById('inspection-mortality-cause')?.value || '').trim();
            if (!cause) {
                if (errorEl) {
                    errorEl.textContent = 'Vui lòng nhập nguyên nhân hao hụt.';
                    errorEl.classList.remove('hidden');
                }
                return;
            }
        }
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle; margin-right: 6px;">sync</span> Đang lưu...';
    }

    try {
        await stopActiveWorkLogIfNeeded(taskId);

        const payload = { condition };
        if (inspectionAiSuggestionText) {
            payload.aiSuggestion = inspectionAiSuggestedValue
                ? `${inspectionAiSuggestedValue}: ${inspectionAiSuggestionText}`
                : inspectionAiSuggestionText;
        }

        // Record mortality if pen inspection has mortality data
        if (isPen) {
            const mortalityQty = parseInt(document.getElementById('inspection-mortality-qty')?.value) || 0;
            if (mortalityQty > 0 && inspectionModalContext.penId) {
                const cause = (document.getElementById('inspection-mortality-cause')?.value || '').trim();
                const causeType = document.getElementById('inspection-mortality-type')?.value || 'DEATH';
                const estimatedLoss = parseFloat(document.getElementById('inspection-mortality-loss')?.value) || 0;

                try {
                    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
                    await fetch(`${API_BASE}/livestock/pens/${inspectionModalContext.penId}/mortality`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        },
                        body: JSON.stringify({
                            quantity: mortalityQty,
                            cause: cause,
                            causeType: causeType,
                            eventDate: new Date().toISOString().split('T')[0],
                            estimatedLoss: estimatedLoss,
                            notes: `Ghi nhận bởi nhân công qua kiểm tra chuồng`,
                            animalName: 'Vật nuôi'
                        })
                    });
                } catch (mortalityErr) {
                    console.error('Mortality recording error:', mortalityErr);
                    // Continue with task completion even if mortality fails
                }
            }

            // Add photo info to AI suggestion field for owner to see
            const photoInfo = [];
            if (inspectionSelectedFileName) photoInfo.push(`Ảnh chuồng: ${inspectionSelectedFileName}`);
            if (window._inspectionPhoto2FileName) photoInfo.push(`Ảnh vật nuôi: ${window._inspectionPhoto2FileName}`);
            const mortalityQty2 = parseInt(document.getElementById('inspection-mortality-qty')?.value) || 0;
            if (mortalityQty2 > 0) {
                const cause2 = (document.getElementById('inspection-mortality-cause')?.value || '').trim();
                const causeType2 = document.getElementById('inspection-mortality-type')?.value || 'DEATH';
                photoInfo.push(`Hao hụt: ${mortalityQty2} con (${causeType2}) - ${cause2}`);
            }
            if (photoInfo.length > 0) {
                payload.aiSuggestion = (payload.aiSuggestion ? payload.aiSuggestion + '\n' : '') + photoInfo.join(' | ');
            }
        }

        await fetchAPI(`${API_BASE}/tasks/${taskId}/complete`, 'POST', payload);

        // Store photos in localStorage for later viewing
        if (isPen) {
            const photoStore = JSON.parse(localStorage.getItem('inspectionPhotos') || '{}');
            if (inspectionSelectedImageBase64) {
                photoStore[`task_${taskId}_photo1`] = inspectionSelectedImageBase64;
            }
            if (window._inspectionPhoto2Base64) {
                photoStore[`task_${taskId}_photo2`] = window._inspectionPhoto2Base64;
            }
            // Keep only last 20 photo entries to avoid storage bloat
            const keys = Object.keys(photoStore);
            if (keys.length > 40) {
                keys.slice(0, keys.length - 40).forEach(k => delete photoStore[k]);
            }
            localStorage.setItem('inspectionPhotos', JSON.stringify(photoStore));
        }

        closeModal('inspection-complete-modal');

        // Show detailed success notification with results
        const conditionLabels = { 'CLEAN': 'Sạch', 'DIRTY': 'Bẩn', 'SICK': 'Có dấu hiệu bệnh', 'GOOD': 'Tốt', 'FAIR': 'Trung bình', 'POOR': 'Kém' };
        const mortalityQtyFinal = isPen ? (parseInt(document.getElementById('inspection-mortality-qty')?.value) || 0) : 0;
        let successMsg = `Đã hoàn thành kiểm tra. Tình trạng: ${conditionLabels[condition] || condition}`;
        if (mortalityQtyFinal > 0) {
            successMsg += `. Hao hụt: ${mortalityQtyFinal} con`;
        }
        showNotification('success', 'Thành công', successMsg);

        loadHomeData();
        await loadTasksList();
        loadUserProfile();

        // Re-open task detail to show completed state with results
        const detailView = document.getElementById('view-task-detail');
        if (detailView) {
            openTaskDetail(taskId);
        }
    } catch (e) {
        if (errorEl) {
            errorEl.textContent = 'Không thể hoàn thành công việc.';
            errorEl.classList.remove('hidden');
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = oldHtml;
        }
    }
}

async function stopActiveWorkLogIfNeeded(taskId) {
    if (activeWorkLogsByTaskId[taskId] && !activeWorkLogsByTaskId[taskId].endedAt) {
        try {
            await fetchAPI(`${API_BASE}/worklogs/stop`, 'POST', { taskId, workerId });
        } catch (e) { }
        delete activeWorkLogsByTaskId[taskId];
    }
}

async function loadAssetData() {
    const userEmail = localStorage.getItem('userEmail');
    const container = document.getElementById('transactions-list');

    if (!userEmail) {
        if (container) {
            container.innerHTML = '<div class="p-10 text-center text-gray-500">Vui lòng đăng nhập để xem tài sản</div>';
        }
        return;
    }

    if (container) {
        container.innerHTML = '<div class="p-10 text-center text-gray-500">Đang tải...</div>';
    }

    try {
        await loadBalance();

        const transactions = await fetchAPI(`${API_BASE}/assets/transactions?email=${encodeURIComponent(userEmail)}`);
        allTransactions = Array.isArray(transactions) ? transactions : [];
        processTransactions(allTransactions);
        renderTransactions(allTransactions.slice(0, 10));
    } catch (e) {
        console.error('Error loading assets:', e);
        if (container) {
            container.innerHTML = '<div class="p-10 text-center text-red-500">Lỗi tải dữ liệu</div>';
        }
    }
}

async function loadPayrollData(notifyOnError = false) {
    if (!workerId) return;

    const summaryEl = document.getElementById('salary-settings-summary');
    const listEl = document.getElementById('salary-payments-list');
    const countEl = document.getElementById('salary-payments-count');

    if (summaryEl) summaryEl.textContent = 'Đang tải...';
    if (listEl) listEl.innerHTML = '<div class="p-10 text-center text-gray-500">Đang tải...</div>';
    if (countEl) countEl.textContent = '0';

    try {
        const [settingsRes, paymentsRes] = await Promise.all([
            fetchAPI(`${API_BASE}/payroll/settings/worker/${workerId}`),
            fetchAPI(`${API_BASE}/payroll/payments/worker/${workerId}`)
        ]);

        const settings = Array.isArray(settingsRes) ? settingsRes : [];
        const payments = Array.isArray(paymentsRes) ? paymentsRes : [];

        if (summaryEl) {
            if (settings.length === 0) {
                summaryEl.innerHTML = '<div class="text-gray-500">Chưa có cấu hình lương.</div>';
            } else {
                const activeSetting = settings.find(s => s && s.isActive !== false) || settings[0];
                const salaryAmount = activeSetting && activeSetting.salaryAmount != null ? Number(activeSetting.salaryAmount) : 0;
                const payFrequency = activeSetting && activeSetting.payFrequency ? String(activeSetting.payFrequency).toUpperCase() : 'MONTHLY';
                const payDay = activeSetting && activeSetting.payDayOfMonth != null ? activeSetting.payDayOfMonth : null;
                const payDayOfWeek = activeSetting && activeSetting.payDayOfWeek != null ? activeSetting.payDayOfWeek : null;
                const isActive = activeSetting && activeSetting.isActive !== false;
                const ownerName = activeSetting && activeSetting.owner && activeSetting.owner.fullName
                    ? activeSetting.owner.fullName
                    : (activeSetting && activeSetting.owner && activeSetting.owner.id ? `Owner#${activeSetting.owner.id}` : 'Chủ trang trại');
                const lastPaidAt = activeSetting && activeSetting.lastPaidAt ? new Date(activeSetting.lastPaidAt).toLocaleString('vi-VN') : null;

                const dowLabels = ['', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
                const dowLabel = payDayOfWeek != null && payDayOfWeek >= 1 && payDayOfWeek <= 7
                    ? dowLabels[payDayOfWeek]
                    : 'Thứ 2';

                const scheduleLabel = payFrequency === 'DAILY'
                    ? 'Hàng ngày'
                    : payFrequency === 'WEEKLY'
                        ? `Hàng tuần - ${dowLabel}`
                        : (payDay != null ? `Ngày ${payDay} hàng tháng` : 'N/A');

                summaryEl.innerHTML = `
                    <div class="space-y-2">
                        <div class="flex items-center justify-between gap-3">
                            <span class="text-gray-500">Chủ trang trại</span>
                            <span class="font-semibold text-gray-800">${escapeHtml(ownerName)}</span>
                        </div>
                        <div class="flex items-center justify-between gap-3">
                            <span class="text-gray-500">Mức lương</span>
                            <span class="font-semibold text-gray-800">${formatCurrency(salaryAmount)}</span>
                        </div>
                        <div class="flex items-center justify-between gap-3">
                            <span class="text-gray-500">Lịch trả</span>
                            <span class="font-semibold text-gray-800">${scheduleLabel}</span>
                        </div>
                        <div class="flex items-center justify-between gap-3">
                            <span class="text-gray-500">Trạng thái</span>
                            <span class="text-xs font-semibold px-2.5 py-1 rounded-full border ${isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}">
                                ${isActive ? 'Đang bật' : 'Tạm dừng'}
                            </span>
                        </div>
                        <div class="flex items-center justify-between gap-3">
                            <span class="text-gray-500">Lần trả gần nhất</span>
                            <span class="font-semibold text-gray-800">${lastPaidAt ? lastPaidAt : 'Chưa có'}</span>
                        </div>
                    </div>
                `;
            }
        }

        if (countEl) countEl.textContent = String(payments.length);

        if (listEl) {
            if (payments.length === 0) {
                listEl.innerHTML = '<div class="p-10 text-center text-gray-500">Chưa có lịch sử nhận lương</div>';
            } else {
                listEl.innerHTML = payments.slice(0, 10).map(p => {
                    const status = (p.status || 'PAID').toUpperCase();
                    const statusBadge = status === 'PAID'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : status === 'FAILED'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-gray-50 text-gray-600 border-gray-200';
                    const statusLabel = status === 'PAID' ? 'Đã trả' : status === 'FAILED' ? 'Thất bại' : status;
                    const amount = p.amount != null ? Number(p.amount) : 0;
                    const paidAt = p.paidAt ? new Date(p.paidAt).toLocaleString('vi-VN') : '';
                    const periodStart = p.payPeriodStart ? new Date(p.payPeriodStart).toLocaleDateString('vi-VN') : '';
                    const periodEnd = p.payPeriodEnd ? new Date(p.payPeriodEnd).toLocaleDateString('vi-VN') : '';
                    const periodText = periodStart && periodEnd ? `${periodStart} - ${periodEnd}` : '';
                    const desc = p.description ? escapeHtml(p.description) : '';

                    return `
                        <div class="p-4 flex items-start justify-between gap-4">
                            <div class="min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <div class="font-semibold text-gray-800">+${formatCurrency(amount)}</div>
                                    <span class="text-xs font-semibold px-2.5 py-1 rounded-full border ${statusBadge}">${statusLabel}</span>
                                </div>
                                <div class="text-xs text-gray-500 mt-1">${paidAt}</div>
                                ${periodText ? `<div class="text-xs text-gray-500 mt-1">Kỳ lương: ${periodText}</div>` : ''}
                                ${desc ? `<div class="text-sm text-gray-700 mt-2">${desc}</div>` : ''}
                            </div>
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-green-50 text-green-600 flex-shrink-0">
                                <span class="material-symbols-outlined" style="font-size: 20px;">payments</span>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        if (typeof gsap !== 'undefined') {
            gsap.fromTo('#salary-payments-list > div', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.04, ease: 'power2.out' });
        }
    } catch (e) {
        if (summaryEl) summaryEl.textContent = 'Không thể tải dữ liệu lương.';
        if (listEl) listEl.innerHTML = '<div class="p-10 text-center text-red-500">Không thể tải dữ liệu.</div>';
        if (countEl) countEl.textContent = '0';

        if (notifyOnError) {
            showNotification('error', 'Lỗi', 'Không thể tải dữ liệu lương.');
        }
    }
}

function processTransactions(transactions) {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    let totalIncome = 0;
    let totalExpense = 0;
    let monthIncome = 0;
    let monthExpense = 0;
    const categoryTotals = {};
    const dailyData = {};

    (transactions || []).forEach(tx => {
        const txDate = tx.createdAt ? new Date(tx.createdAt) : new Date();
        const amount = Math.abs(Number(tx.amount) || 0);
        const dateKey = txDate.toISOString().split('T')[0];
        const isIncome = tx.transactionType === 'INCOME';

        if (!dailyData[dateKey]) dailyData[dateKey] = { income: 0, expense: 0 };

        if (isIncome) {
            totalIncome += amount;
            if (txDate.getMonth() === thisMonth && txDate.getFullYear() === thisYear) {
                monthIncome += amount;
            }
            dailyData[dateKey].income += amount;
        } else {
            totalExpense += amount;
            if (txDate.getMonth() === thisMonth && txDate.getFullYear() === thisYear) {
                monthExpense += amount;
            }
            dailyData[dateKey].expense += amount;

            const cat = tx.category || 'OTHER';
            categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
        }
    });

    const monthIncomeEl = document.getElementById('month-income');
    if (monthIncomeEl) {
        monthIncomeEl.innerHTML = `
            <span class="material-symbols-outlined" style="font-size: 16px;">trending_up</span>
            +${formatCurrency(monthIncome)}
        `;
    }

    const monthExpenseEl = document.getElementById('month-expense');
    if (monthExpenseEl) {
        monthExpenseEl.innerHTML = `
            <span class="material-symbols-outlined" style="font-size: 16px;">trending_down</span>
            -${formatCurrency(monthExpense)}
        `;
    }

    const totalIncomeEl = document.getElementById('stat-total-income');
    if (totalIncomeEl) totalIncomeEl.textContent = formatCurrency(totalIncome);

    const totalExpenseEl = document.getElementById('stat-total-expense');
    if (totalExpenseEl) totalExpenseEl.textContent = formatCurrency(totalExpense);

    const netProfitEl = document.getElementById('stat-net-profit');
    if (netProfitEl) netProfitEl.textContent = formatCurrency(monthIncome - monthExpense);

    const txCountEl = document.getElementById('stat-tx-count');
    if (txCountEl) txCountEl.textContent = String((transactions || []).length);

    const homeIncomeEl = document.getElementById('home-income');
    if (homeIncomeEl) homeIncomeEl.textContent = formatCurrency(monthIncome);

    updateCharts(dailyData, categoryTotals);
}

function initCharts() {
    if (typeof Chart === 'undefined') return;
    if (incomeExpenseChart || expenseBreakdownChart) return;

    const lineCanvas = document.getElementById('incomeExpenseChart');
    const pieCanvas = document.getElementById('expenseBreakdownChart');
    if (!lineCanvas || !pieCanvas) return;

    const ctx1 = lineCanvas.getContext('2d');
    const ctx2 = pieCanvas.getContext('2d');
    if (!ctx1 || !ctx2) return;

    const formatCompact = (num) => {
        const n = Number(num) || 0;
        if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
        return String(n);
    };

    incomeExpenseChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Thu nhập',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6
                },
                {
                    label: 'Chi tiêu',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 7 } },
                y: { grid: { color: '#f3f4f6' }, ticks: { callback: v => formatCompact(v) } }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
    });

    expenseBreakdownChart = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [
                {
                    data: [],
                    backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'],
                    borderWidth: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 16, usePointStyle: true, pointStyle: 'circle' }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.label}: ${formatCurrency(ctx.raw)}`
                    }
                }
            }
        }
    });
}

function updateCharts(dailyData, categoryTotals) {
    if (!incomeExpenseChart || !expenseBreakdownChart) return;

    const labels = [];
    const incomeData = [];
    const expenseData = [];

    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        labels.push(d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }));
        incomeData.push(dailyData[key]?.income || 0);
        expenseData.push(dailyData[key]?.expense || 0);
    }

    incomeExpenseChart.data.labels = labels;
    incomeExpenseChart.data.datasets[0].data = incomeData;
    incomeExpenseChart.data.datasets[1].data = expenseData;
    incomeExpenseChart.update();

    const catNameMap = {
        HARVEST: 'Thu hoạch',
        SEED: 'Giống',
        SEEDING: 'Gieo hạt',
        FERTILIZER: 'Phân bón',
        PESTICIDE: 'Thuốc trừ sâu',
        MACHINERY: 'Máy móc',
        PAYROLL: 'Trả lương',
        SHOP_PURCHASE: 'Mua vật tư',
        TOPUP: 'Nạp tiền',
        WATERING: 'Tưới nước',
        ADJUSTMENT: 'Điều chỉnh',
        OTHER: 'Khác'
    };

    const catLabels = Object.keys(categoryTotals || {});
    const catData = Object.values(categoryTotals || {});

    expenseBreakdownChart.data.labels = catLabels.map(c => catNameMap[c] || c);
    expenseBreakdownChart.data.datasets[0].data = catData;
    expenseBreakdownChart.update();
}

function renderTransactions(transactions) {
    const container = document.getElementById('transactions-list');
    if (!container) return;

    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<div class="p-10 text-center text-gray-500">Chưa có giao dịch nào</div>';
        return;
    }

    const categoryIcons = {
        HARVEST: 'agriculture',
        SEED: 'grass',
        SEEDING: 'grass',
        FERTILIZER: 'compost',
        PESTICIDE: 'bug_report',
        MACHINERY: 'precision_manufacturing',
        PAYROLL: 'payments',
        SHOP_PURCHASE: 'shopping_bag',
        TOPUP: 'add_card',
        WATERING: 'water_drop',
        ADJUSTMENT: 'tune',
        OTHER: 'receipt_long'
    };

    container.innerHTML = transactions.map(tx => {
        const isIncome = tx.transactionType === 'INCOME';
        const date = tx.createdAt ? new Date(tx.createdAt) : new Date();
        const icon = categoryIcons[tx.category] || 'receipt_long';
        const desc = tx.description || tx.category || 'Giao dịch';
        const amount = Math.abs(Number(tx.amount) || 0);

        return `
            <div class="p-4 flex items-center justify-between gap-4">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center ${isIncome ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}">
                        <span class="material-symbols-outlined" style="font-size: 20px;">${icon}</span>
                    </div>
                    <div class="min-w-0">
                        <div class="font-medium text-gray-800 truncate">${desc}</div>
                        <div class="text-xs text-gray-500">${date.toLocaleString('vi-VN')}</div>
                    </div>
                </div>
                <div class="font-bold whitespace-nowrap ${isIncome ? 'text-green-600' : 'text-red-600'}">
                    ${isIncome ? '+' : '-'}${formatCurrency(amount)}
                </div>
            </div>
        `;
    }).join('');
}

function loadMoreTransactions() {
    renderTransactions(allTransactions);
}

function showNotification(type, title, message) {
    if (typeof showToast === 'function') {
        const toastType = type === 'error' ? 'error' : (type === 'success' ? 'success' : (type === 'warning' ? 'warning' : 'info'));
        
        // Handle if message is an object (error payload from server) to prevent [object Object]
        let msgStr = typeof message === 'string' ? message : '';
        if (typeof message === 'object' && message !== null) {
             msgStr = message.message || message.error || JSON.stringify(message);
        }
        
        const finalMessage = title && title !== msgStr ? `<strong>${title}</strong><br/>${msgStr}` : msgStr;
        showToast(finalMessage, toastType);
        return;
    }
    
    // Fallback if showToast is not available
    const bg = type === 'success' ? '#10b981' : (type === 'warning' ? '#f59e0b' : '#ef4444');
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        background: ${bg}; color: white; padding: 14px 16px; border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        max-width: 360px; width: calc(100% - 40px);
        opacity: 1; transform: translateY(0);
        transition: opacity 0.25s ease, transform 0.25s ease;
    `;
    
    let fmStr = typeof message === 'string' ? message : JSON.stringify(message);
    notif.innerHTML = `
        <div style="font-weight:700; margin-bottom:4px;">${title}</div>
        <div style="font-size:13px; opacity:0.95;">${fmStr}</div>
    `;
    document.body.appendChild(notif);

    setTimeout(() => {
        notif.style.opacity = '0';
        notif.style.transform = 'translateY(-8px)';
    }, 3200);
    setTimeout(() => notif.remove(), 3600);
}

function openModal(id, innerHtml) {
    closeModal(id);
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4';
    modal.innerHTML = innerHtml;
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(id);
    });
    document.body.appendChild(modal);
    return modal;
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function initSettings() {
    if (settingsInitialized) {
        if (addressMap) setTimeout(() => addressMap.invalidateSize(), 150);
        return;
    }
    settingsInitialized = true;

    document.querySelectorAll('.worker-settings-nav').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;

            document.querySelectorAll('.worker-settings-nav').forEach(b => {
                b.classList.remove('text-primary', 'bg-green-50');
                b.classList.add('text-gray-700');
                b.classList.remove('hover:bg-gray-50');
                b.classList.add('hover:bg-gray-50');
            });
            btn.classList.add('text-primary', 'bg-green-50');
            btn.classList.remove('text-gray-700');

            document.querySelectorAll('.worker-settings-section').forEach(sec => sec.classList.add('hidden'));
            const section = document.getElementById(target);
            if (section) section.classList.remove('hidden');

            if (target === 'worker-profile-settings') {
                setTimeout(() => {
                    initAddressMap();
                    if (addressMap) addressMap.invalidateSize();
                }, 150);
            }
        });
    });

    const saveProfileBtn = document.getElementById('save-profile-btn');
    if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfile);

    const changeAvatarBtn = document.getElementById('change-avatar-btn');
    if (changeAvatarBtn) changeAvatarBtn.addEventListener('click', initChangeAvatar);

    const changePasswordBtn = document.getElementById('change-password-btn');
    if (changePasswordBtn) changePasswordBtn.addEventListener('click', initChangePassword);

    const changeEmailBtn = document.getElementById('change-email-btn');
    if (changeEmailBtn) changeEmailBtn.addEventListener('click', initChangeEmail);

    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) darkModeToggle.addEventListener('change', onDarkModeToggle);

    const twoFactorToggle = document.getElementById('two-factor-toggle');
    if (twoFactorToggle) twoFactorToggle.addEventListener('change', onTwoFactorToggle);

    const searchAddressBtn = document.getElementById('search-address-btn');
    if (searchAddressBtn) searchAddressBtn.addEventListener('click', searchAddressOnMap);

    const currentLocationBtn = document.getElementById('current-location-btn');
    if (currentLocationBtn) currentLocationBtn.addEventListener('click', getCurrentLocation);

    const saveAddressBtn = document.getElementById('save-address-btn');
    if (saveAddressBtn) saveAddressBtn.addEventListener('click', saveUserAddress);

    setTimeout(initAddressMap, 250);
}

async function saveProfile() {
    const email = localStorage.getItem('userEmail');
    if (!email) return;

    const fullName = document.getElementById('profile-fullname')?.value?.trim() || '';
    const phone = document.getElementById('profile-phone')?.value?.trim() || '';
    const btn = document.getElementById('save-profile-btn');
    const oldHtml = btn ? btn.innerHTML : '';

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle; margin-right: 6px;">sync</span> Đang lưu...';
    }

    try {
        const res = await fetch(`${API_BASE}/user/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ email, fullName, phone })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showNotification('error', 'Lỗi', data.error || data.message || 'Không thể cập nhật hồ sơ');
            return;
        }

        if (fullName) localStorage.setItem('userName', fullName);
        showNotification('success', 'Thành công', data.message || 'Cập nhật thông tin thành công');
        await loadUserProfile();
    } catch (e) {
        console.error(e);
        showNotification('error', 'Lỗi', 'Không thể kết nối đến máy chủ');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = oldHtml;
        }
    }
}

function initChangeAvatar() {
    selectedAvatarBase64 = null;
    const currentAvatar = localStorage.getItem('userAvatar') || '';

    openModal('avatar-modal', `
        <div class="bg-white rounded-2xl p-6 w-[520px] max-w-full">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <h3 class="text-lg font-bold text-gray-800">Đổi ảnh đại diện</h3>
                    <p class="text-sm text-gray-500 mt-1">Chọn ảnh để cập nhật</p>
                </div>
                <button type="button" class="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center" onclick="closeModal('avatar-modal')">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>

            <div class="mt-5">
                <input type="file" id="avatar-file-input" accept="image/*" class="w-full" />
                <div class="mt-4 flex items-center gap-4">
                    <div class="w-20 h-20 rounded-2xl bg-gray-100 overflow-hidden border border-gray-200 flex items-center justify-center">
                        ${currentAvatar ? `<img id="avatar-preview-img" src="${currentAvatar}" class="w-full h-full object-cover" alt="avatar" />` : `<span class="material-symbols-outlined" style="font-size: 40px; color: #9ca3af;">person</span>`}
                    </div>
                    <div class="text-sm text-gray-600">
                        Ảnh sẽ được hiển thị trên hồ sơ và thanh điều hướng.
                    </div>
                </div>
                <div id="avatar-error" class="mt-3 hidden p-3 rounded-lg bg-red-50 text-red-600 text-sm"></div>
            </div>

            <div class="mt-6 flex justify-end gap-3">
                <button type="button" class="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50" onclick="closeModal('avatar-modal')">Hủy</button>
                <button id="save-avatar-btn" type="button" class="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed" onclick="saveAvatar()" disabled>Lưu ảnh</button>
            </div>
        </div>
    `);

    const input = document.getElementById('avatar-file-input');
    if (input) {
        input.addEventListener('change', handleAvatarFile);
    }
}

function handleAvatarFile(e) {
    const file = e.target.files?.[0];
    const errorEl = document.getElementById('avatar-error');
    const saveBtn = document.getElementById('save-avatar-btn');
    if (errorEl) errorEl.classList.add('hidden');

    if (!file) {
        selectedAvatarBase64 = null;
        if (saveBtn) saveBtn.disabled = true;
        return;
    }

    if (!file.type.startsWith('image/')) {
        if (errorEl) {
            errorEl.textContent = 'File không hợp lệ';
            errorEl.classList.remove('hidden');
        }
        selectedAvatarBase64 = null;
        if (saveBtn) saveBtn.disabled = true;
        return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
        selectedAvatarBase64 = ev.target?.result;

        const box = document.querySelector('#avatar-modal .w-20.h-20');
        if (box) {
            box.innerHTML = `<img src="${selectedAvatarBase64}" class="w-full h-full object-cover" alt="avatar" />`;
        }
        if (saveBtn) saveBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

async function saveAvatar() {
    const userEmail = localStorage.getItem('userEmail');
    const saveBtn = document.getElementById('save-avatar-btn');
    const errorEl = document.getElementById('avatar-error');

    if (!userEmail || !selectedAvatarBase64) {
        if (errorEl) {
            errorEl.textContent = 'Vui lòng chọn ảnh trước';
            errorEl.classList.remove('hidden');
        }
        return;
    }

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Đang lưu...';
    }
    if (errorEl) errorEl.classList.add('hidden');

    try {
        const res = await fetch(`${API_BASE}/user/avatar`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ email: userEmail, avatarUrl: selectedAvatarBase64 })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (errorEl) {
                errorEl.textContent = data.error || data.message || 'Không thể lưu ảnh';
                errorEl.classList.remove('hidden');
            }
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Lưu ảnh';
            }
            return;
        }

        const avatarUrl = data.avatarUrl || selectedAvatarBase64;
        localStorage.setItem('userAvatar', avatarUrl);

        const fallbackChar = (localStorage.getItem('userName') || 'W').trim().charAt(0).toUpperCase();
        updateAvatarDisplay(avatarUrl, fallbackChar);
        showNotification('success', 'Thành công', data.message || 'Cập nhật ảnh đại diện thành công');
        closeModal('avatar-modal');
    } catch (e) {
        console.error(e);
        if (errorEl) {
            errorEl.textContent = 'Không thể kết nối đến máy chủ';
            errorEl.classList.remove('hidden');
        }
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Lưu ảnh';
        }
    }
}

async function onDarkModeToggle(e) {
    const darkMode = Boolean(e.target.checked);
    const email = localStorage.getItem('userEmail');

    applyDarkModePreference(darkMode);

    if (!email) return;

    try {
        const res = await fetch(`${API_BASE}/user/dark-mode`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ email, darkMode })
        });
        if (!res.ok) {
            e.target.checked = !darkMode;
            applyDarkModePreference(!darkMode);
            showNotification('error', 'Lỗi', 'Không thể lưu chế độ tối');
            return;
        }
        showNotification('success', 'Thành công', 'Đã lưu chế độ tối');
    } catch (err) {
        console.error(err);
        e.target.checked = !darkMode;
        applyDarkModePreference(!darkMode);
        showNotification('error', 'Lỗi', 'Không thể kết nối đến máy chủ');
    }
}

async function onTwoFactorToggle(e) {
    const toggle = e.target;
    const isChecked = Boolean(toggle.checked);

    if (isChecked) {
        toggle.checked = false;
        try {
            const res = await fetch(`${API_BASE}/security/2fa/init`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                showNotification('error', 'Lỗi', data.message || 'Không thể khởi tạo 2FA');
                return;
            }
            showQrModal(data.otpAuthUri);
        } catch (err) {
            console.error(err);
            showNotification('error', 'Lỗi', 'Không thể kết nối đến máy chủ');
        }
    } else {
        showDisable2FaModal();
    }
}

function showDisable2FaModal() {
    openModal('disable-2fa-modal', `
        <div class="bg-white rounded-2xl p-6 w-[460px] max-w-full">
            <div>
                <h3 class="text-lg font-bold text-gray-800">Tắt xác thực 2 bước?</h3>
                <p class="text-sm text-gray-500 mt-1">Tài khoản của bạn sẽ kém an toàn hơn nếu tắt tính năng này.</p>
            </div>
            <div class="mt-6 flex justify-end gap-3">
                <button type="button" class="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50" onclick="closeModal('disable-2fa-modal'); document.getElementById('two-factor-toggle').checked = true;">Hủy</button>
                <button type="button" class="px-4 py-2 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600" onclick="processDisable2Fa()">Vẫn tắt</button>
            </div>
        </div>
    `);
}

async function processDisable2Fa() {
    const toggle = document.getElementById('two-factor-toggle');

    try {
        const res = await fetch(`${API_BASE}/security/2fa/disable`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!res.ok) {
            if (toggle) toggle.checked = true;
            showNotification('error', 'Lỗi', 'Không thể tắt 2FA');
        } else {
            if (toggle) toggle.checked = false;
            showNotification('success', 'Thành công', 'Đã tắt 2FA');
        }
    } catch (err) {
        console.error(err);
        if (toggle) toggle.checked = true;
        showNotification('error', 'Lỗi', 'Không thể kết nối đến máy chủ');
    } finally {
        closeModal('disable-2fa-modal');
    }
}

function showQrModal(uri) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri || '')}`;
    openModal('qr-modal', `
        <div class="bg-white rounded-2xl p-6 w-[520px] max-w-full">
            <div class="text-center">
                <h3 class="text-lg font-bold text-gray-800">Thiết lập Google Authenticator</h3>
                <p class="text-sm text-gray-500 mt-1">Quét mã QR bên dưới bằng ứng dụng xác thực của bạn</p>
            </div>
            <div class="mt-5 flex flex-col items-center gap-4">
                <div class="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <img src="${qrUrl}" class="block w-40 h-40" alt="qr" />
                </div>
                <input type="text" id="verify-2fa-code" class="w-48 text-center tracking-widest text-lg rounded-lg border-gray-300 focus:border-primary focus:ring-primary" placeholder="------" maxlength="6" />
                <div id="qr-error" class="hidden w-full p-3 rounded-lg bg-red-50 text-red-600 text-sm"></div>
            </div>
            <div class="mt-6 grid grid-cols-2 gap-3">
                <button type="button" class="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50" onclick="closeModal('qr-modal')">Hủy</button>
                <button type="button" class="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark" onclick="verifyAndEnable2fa()">Xác nhận & Bật</button>
            </div>
        </div>
    `);
}

async function verifyAndEnable2fa() {
    const code = document.getElementById('verify-2fa-code')?.value?.trim() || '';
    const errorEl = document.getElementById('qr-error');
    if (errorEl) errorEl.classList.add('hidden');

    if (!/^\d{6}$/.test(code)) {
        if (errorEl) {
            errorEl.textContent = 'Vui lòng nhập mã 6 chữ số';
            errorEl.classList.remove('hidden');
        }
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/security/2fa/enable`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ code })
        });
        if (res.ok) {
            showNotification('success', 'Thành công', 'Đã bật xác thực 2 lớp');
            const toggle = document.getElementById('two-factor-toggle');
            if (toggle) toggle.checked = true;
            closeModal('qr-modal');
        } else {
            if (errorEl) {
                errorEl.textContent = 'Mã xác thực không đúng';
                errorEl.classList.remove('hidden');
            }
        }
    } catch (err) {
        console.error(err);
        if (errorEl) {
            errorEl.textContent = 'Không thể kết nối đến máy chủ';
            errorEl.classList.remove('hidden');
        }
    }
}

function initChangePassword() {
    openModal('confirm-modal', `
        <div class="bg-white rounded-2xl p-6 w-[480px] max-w-full">
            <div>
                <h3 class="text-lg font-bold text-gray-800">Đổi mật khẩu?</h3>
                <p class="text-sm text-gray-500 mt-1">Hệ thống sẽ gửi OTP qua email của bạn để xác nhận.</p>
            </div>
            <div class="mt-6 flex justify-end gap-3">
                <button type="button" class="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50" onclick="closeModal('confirm-modal')">Hủy</button>
                <button type="button" class="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark" onclick="closeModal('confirm-modal'); requestOtp('PASSWORD_CHANGE')">Tiếp tục</button>
            </div>
        </div>
    `);
}

function initChangeEmail() {
    openModal('email-modal', `
        <div class="bg-white rounded-2xl p-6 w-[520px] max-w-full">
            <div>
                <h3 class="text-lg font-bold text-gray-800">Đổi email</h3>
                <p class="text-sm text-gray-500 mt-1">Nhập email mới và xác nhận bằng OTP.</p>
            </div>
            <div class="mt-5">
                <input type="email" id="new-email" class="w-full rounded-lg border-gray-300 focus:border-primary focus:ring-primary" placeholder="Email mới" />
                <div id="email-error" class="mt-3 hidden p-3 rounded-lg bg-red-50 text-red-600 text-sm"></div>
            </div>
            <div class="mt-6 flex justify-end gap-3">
                <button type="button" class="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50" onclick="closeModal('email-modal')">Hủy</button>
                <button type="button" class="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark" onclick="submitNewEmail()">Tiếp tục</button>
            </div>
        </div>
    `);
}

function validateEmail(email) {
    return String(email)
        .toLowerCase()
        .match(/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\\.,;:\s@\"]+\.)+[^<>()[\]\\.,;:\s@\"]{2,})$/);
}

function submitNewEmail() {
    const newEmail = document.getElementById('new-email')?.value?.trim() || '';
    const errorEl = document.getElementById('email-error');
    if (errorEl) errorEl.classList.add('hidden');

    if (!newEmail || !validateEmail(newEmail)) {
        if (errorEl) {
            errorEl.textContent = 'Email không hợp lệ';
            errorEl.classList.remove('hidden');
        }
        return;
    }

    currentNewEmail = newEmail;
    closeModal('email-modal');
    requestOtp('EMAIL_CHANGE');
}

async function requestOtp(type) {
    try {
        const res = await fetch(`${API_BASE}/security/otp/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ type })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showNotification('error', 'Lỗi', data.message || 'Không thể gửi OTP');
            return;
        }
        showNotification('success', 'Thành công', data.message || 'Mã OTP đã được gửi tới email của bạn');
        showInputOtpModal(type);
    } catch (err) {
        console.error(err);
        showNotification('error', 'Lỗi', 'Không thể kết nối đến máy chủ');
    }
}

function showInputOtpModal(type) {
    const extraFields = type === 'PASSWORD_CHANGE' ? `
        <div class="mt-3 grid grid-cols-1 gap-3">
            <input type="password" id="new-password" class="w-full rounded-lg border-gray-300 focus:border-primary focus:ring-primary" placeholder="Mật khẩu mới" />
            <input type="password" id="confirm-password" class="w-full rounded-lg border-gray-300 focus:border-primary focus:ring-primary" placeholder="Xác nhận mật khẩu mới" />
        </div>
    ` : '';

    openModal('otp-modal', `
        <div class="bg-white rounded-2xl p-6 w-[520px] max-w-full">
            <div>
                <h3 class="text-lg font-bold text-gray-800">Nhập mã OTP</h3>
                <p class="text-sm text-gray-500 mt-1">Vui lòng kiểm tra email để lấy mã xác nhận.</p>
            </div>
            <div class="mt-5">
                <input type="text" id="otp-input" class="w-full text-center tracking-widest text-lg rounded-lg border-gray-300 focus:border-primary focus:ring-primary" placeholder="------" maxlength="6" />
                ${extraFields}
                <div id="otp-error" class="mt-3 hidden p-3 rounded-lg bg-red-50 text-red-600 text-sm"></div>
            </div>
            <div class="mt-6 flex justify-end gap-3">
                <button type="button" class="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50" onclick="closeModal('otp-modal')">Hủy</button>
                <button type="button" class="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark" onclick="submitOtpAction('${type}')">Xác nhận</button>
            </div>
        </div>
    `);
}

async function submitOtpAction(type) {
    const otp = document.getElementById('otp-input')?.value?.trim() || '';
    const errorEl = document.getElementById('otp-error');
    if (errorEl) errorEl.classList.add('hidden');

    if (!/^\d{6}$/.test(otp)) {
        if (errorEl) {
            errorEl.textContent = 'Mã OTP không hợp lệ';
            errorEl.classList.remove('hidden');
        }
        return;
    }

    let endpoint = '';
    const body = { otp };

    if (type === 'PASSWORD_CHANGE') {
        const newPass = document.getElementById('new-password')?.value || '';
        const confirmPass = document.getElementById('confirm-password')?.value || '';
        if (!newPass || newPass.length < 6) {
            if (errorEl) {
                errorEl.textContent = 'Mật khẩu mới tối thiểu 6 ký tự';
                errorEl.classList.remove('hidden');
            }
            return;
        }
        if (newPass !== confirmPass) {
            if (errorEl) {
                errorEl.textContent = 'Mật khẩu không khớp';
                errorEl.classList.remove('hidden');
            }
            return;
        }
        endpoint = '/password/change';
        body.newPassword = newPass;
    } else if (type === 'EMAIL_CHANGE') {
        endpoint = '/email/change';
        body.newEmail = currentNewEmail;
    } else {
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/security${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify(body)
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showNotification('error', 'Lỗi', data.message || 'Cập nhật thất bại');
            return;
        }

        if (type === 'EMAIL_CHANGE') {
            if (data.token) {
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('token', data.token);
            }
            if (data.email) localStorage.setItem('userEmail', data.email);
            if (data.fullName) localStorage.setItem('userName', data.fullName);
            if (data.role) localStorage.setItem('userRole', data.role);
        }

        showNotification('success', 'Thành công', data.message || 'Cập nhật thành công');
        closeModal('otp-modal');
        await loadUserProfile();
    } catch (err) {
        console.error(err);
        showNotification('error', 'Lỗi', 'Có lỗi xảy ra');
    }
}

function initAddressMap() {
    const mapContainer = document.getElementById('settings-address-map');
    if (!mapContainer || addressMap) return;

    if (typeof L === 'undefined') {
        mapContainer.innerHTML = '<p class="text-gray-400 text-center p-10">Đang tải bản đồ...</p>';
        setTimeout(initAddressMap, 500);
        return;
    }

    const defaultLat = Number.isFinite(userAddressLat) ? userAddressLat : 10.8231;
    const defaultLng = Number.isFinite(userAddressLng) ? userAddressLng : 106.6297;

    addressMap = L.map('settings-address-map').setView([defaultLat, defaultLng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(addressMap);

    const customIcon = L.divIcon({
        html: '<span class="material-symbols-outlined" style="color: #ef4444; font-size: 36px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">location_on</span>',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        className: 'custom-location-marker'
    });

    if (Number.isFinite(userAddressLat) && Number.isFinite(userAddressLng)) {
        addressMarker = L.marker([userAddressLat, userAddressLng], { icon: customIcon, draggable: true }).addTo(addressMap);
        addressMarker.on('dragend', (ev) => {
            const pos = ev.target.getLatLng();
            updateAddressFromCoords(pos.lat, pos.lng);
        });
    }

    addressMap.on('click', (ev) => {
        const { lat, lng } = ev.latlng;
        placeMarkerOnMap(lat, lng);
        updateAddressFromCoords(lat, lng);
    });

    setTimeout(() => addressMap.invalidateSize(), 100);
}

function placeMarkerOnMap(lat, lng) {
    const customIcon = L.divIcon({
        html: '<span class="material-symbols-outlined" style="color: #ef4444; font-size: 36px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">location_on</span>',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        className: 'custom-location-marker'
    });

    if (addressMarker) {
        addressMarker.setLatLng([lat, lng]);
    } else if (addressMap) {
        addressMarker = L.marker([lat, lng], { icon: customIcon, draggable: true }).addTo(addressMap);
        addressMarker.on('dragend', (ev) => {
            const pos = ev.target.getLatLng();
            updateAddressFromCoords(pos.lat, pos.lng);
        });
    }

    userAddressLat = lat;
    userAddressLng = lng;

    const latEl = document.getElementById('address-lat');
    const lngEl = document.getElementById('address-lng');
    if (latEl) latEl.textContent = Number(lat).toFixed(6);
    if (lngEl) lngEl.textContent = Number(lng).toFixed(6);
}

async function updateAddressFromCoords(lat, lng) {
    userAddressLat = lat;
    userAddressLng = lng;

    const latEl = document.getElementById('address-lat');
    const lngEl = document.getElementById('address-lng');
    if (latEl) latEl.textContent = Number(lat).toFixed(6);
    if (lngEl) lngEl.textContent = Number(lng).toFixed(6);

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=vi`);
        const data = await response.json();
        if (data.display_name) {
            const input = document.getElementById('user-address-input');
            if (input) input.value = data.display_name;
        }
    } catch (e) {
        console.log('Geocoding failed:', e);
    }
}

async function searchAddressOnMap() {
    const address = document.getElementById('user-address-input')?.value?.trim() || '';
    if (!address) {
        showNotification('error', 'Lỗi', 'Vui lòng nhập địa chỉ để tìm kiếm');
        return;
    }

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&accept-language=vi&limit=1`);
        const data = await response.json();

        if (data && data.length > 0) {
            const { lat, lon, display_name } = data[0];
            const latNum = parseFloat(lat);
            const lngNum = parseFloat(lon);

            placeMarkerOnMap(latNum, lngNum);
            if (addressMap) addressMap.setView([latNum, lngNum], 16);
            const input = document.getElementById('user-address-input');
            if (input) input.value = display_name;

            showNotification('success', 'Đã tìm thấy', 'Vị trí đã được đánh dấu trên bản đồ');
        } else {
            showNotification('error', 'Không tìm thấy', 'Không tìm thấy địa chỉ này. Hãy thử lại hoặc chọn trực tiếp trên bản đồ.');
        }
    } catch (e) {
        console.error('Search error:', e);
        showNotification('error', 'Lỗi', 'Không thể tìm kiếm địa chỉ');
    }
}

function getCurrentLocation() {
    if (!navigator.geolocation) {
        showNotification('error', 'Lỗi', 'Trình duyệt không hỗ trợ định vị');
        return;
    }

    showNotification('success', 'Đang định vị...', 'Vui lòng chờ trong giây lát');

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            placeMarkerOnMap(latitude, longitude);
            if (addressMap) addressMap.setView([latitude, longitude], 16);
            await updateAddressFromCoords(latitude, longitude);
            showNotification('success', 'Thành công', 'Đã xác định vị trí của bạn');
        },
        (error) => {
            console.error('Geolocation error:', error);
            showNotification('error', 'Lỗi định vị', 'Không thể xác định vị trí. Vui lòng cho phép quyền truy cập vị trí.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

async function saveUserAddress() {
    const address = document.getElementById('user-address-input')?.value?.trim() || '';
    if (!Number.isFinite(userAddressLat) || !Number.isFinite(userAddressLng)) {
        showNotification('error', 'Lỗi', 'Vui lòng chọn vị trí trên bản đồ');
        return;
    }

    const userEmail = localStorage.getItem('userEmail');
    const btn = document.getElementById('save-address-btn');
    const oldHtml = btn ? btn.innerHTML : '';

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle; margin-right: 6px;">sync</span> Đang lưu...';
    }

    try {
        const res = await fetch(`${API_BASE}/user/address`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
                email: userEmail,
                defaultAddress: address,
                addressLat: userAddressLat,
                addressLng: userAddressLng
            })
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok || data.success) {
            showNotification('success', 'Thành công', 'Đã lưu địa chỉ của bạn');
            await loadUserProfile();
        } else {
            showNotification('error', 'Lỗi', data.message || 'Không thể lưu địa chỉ');
        }
    } catch (e) {
        console.error('Save address error:', e);
        showNotification('error', 'Lỗi kết nối', 'Không thể kết nối đến máy chủ');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = oldHtml;
        }
    }
}

function openTopUpModal() {
    closeTopUpModal();

    const modal = document.createElement('div');
    modal.id = 'topup-modal';
    modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 w-[460px] max-w-full">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <h3 class="text-lg font-bold text-gray-800">Nạp tiền vào tài khoản</h3>
                    <p class="text-sm text-gray-500 mt-1">Tải lên hình ảnh với tên là số tiền (VNĐ)</p>
                </div>
                <button type="button" class="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center" onclick="closeTopUpModal()">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>

            <div class="mt-5">
                <div class="bg-green-50 border-2 border-dashed border-primary rounded-xl p-8 text-center cursor-pointer" onclick="document.getElementById('topup-file-input').click()">
                    <span class="material-symbols-outlined" style="font-size: 48px; color: #10b981;">cloud_upload</span>
                    <p class="mt-2 text-sm font-medium text-green-800">Click để chọn hình ảnh</p>
                    <p class="mt-1 text-xs text-green-700 opacity-80">VD: 1000000.png</p>
                </div>

                <input type="file" id="topup-file-input" accept="image/*" class="hidden" onchange="handleTopUpFile(event)">

                <div id="topup-preview" class="mt-4 hidden"></div>
                <div id="topup-error" class="mt-3 hidden p-3 rounded-lg bg-red-50 text-red-600 text-sm"></div>
            </div>

            <div class="mt-6 flex justify-end gap-3">
                <button type="button" class="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50" onclick="closeTopUpModal()">Hủy</button>
                <button id="confirm-topup-btn" type="button" class="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed" onclick="confirmTopUp()" disabled>Xác nhận nạp tiền</button>
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeTopUpModal();
    });

    document.body.appendChild(modal);
}

function handleTopUpFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    const amount = Number(nameWithoutExt);

    const preview = document.getElementById('topup-preview');
    const errorEl = document.getElementById('topup-error');
    const confirmBtn = document.getElementById('confirm-topup-btn');

    if (!/^\d+$/.test(nameWithoutExt) || !Number.isFinite(amount) || amount <= 0) {
        pendingTopUpFileName = null;
        pendingTopUpAmount = 0;
        pendingTopUpPreviewUrl = null;

        if (errorEl) {
            errorEl.textContent = 'Tên file không hợp lệ. Vui lòng đặt tên file là số tiền (ví dụ: 1000000.png)';
            errorEl.classList.remove('hidden');
        }
        if (preview) preview.classList.add('hidden');
        if (confirmBtn) confirmBtn.disabled = true;
        return;
    }

    pendingTopUpFileName = file.name;
    pendingTopUpAmount = amount;

    if (errorEl) errorEl.classList.add('hidden');

    const reader = new FileReader();
    reader.onload = (e) => {
        pendingTopUpPreviewUrl = e.target?.result;
        if (preview) {
            preview.innerHTML = `
                <div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
                    <img src="${pendingTopUpPreviewUrl}" class="w-14 h-14 rounded-lg object-cover" alt="preview">
                    <div class="flex-1">
                        <div class="font-bold text-green-700">${formatCurrency(pendingTopUpAmount)}</div>
                        <div class="text-xs text-gray-500">Sẵn sàng nạp</div>
                    </div>
                </div>
            `;
            preview.classList.remove('hidden');
        }
        if (confirmBtn) confirmBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

async function confirmTopUp() {
    const userEmail = localStorage.getItem('userEmail');
    const confirmBtn = document.getElementById('confirm-topup-btn');
    const errorEl = document.getElementById('topup-error');

    if (!userEmail || !pendingTopUpFileName) return;

    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Đang xử lý...';
    }
    if (errorEl) errorEl.classList.add('hidden');

    try {
        const res = await fetch(`${API_BASE}/assets/topup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
                email: userEmail,
                imageName: pendingTopUpFileName
            })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = data.error || data.message || 'Có lỗi xảy ra';
            if (errorEl) {
                errorEl.textContent = msg;
                errorEl.classList.remove('hidden');
            }
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Xác nhận nạp tiền';
            }
            return;
        }

        showNotification('success', 'Thành công', `Đã nạp ${formatCurrency(pendingTopUpAmount)} thành công!`);
        closeTopUpModal();
        await loadAssetData();
    } catch (e) {
        console.error(e);
        if (errorEl) {
            errorEl.textContent = 'Lỗi kết nối server';
            errorEl.classList.remove('hidden');
        }
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Xác nhận nạp tiền';
        }
    }
}

function closeTopUpModal() {
    const modal = document.getElementById('topup-modal');
    if (modal) modal.remove();
    pendingTopUpFileName = null;
    pendingTopUpAmount = 0;
    pendingTopUpPreviewUrl = null;
}

async function exportReport() {
    if (!window.jspdf || typeof html2canvas === 'undefined') {
        showNotification('error', 'Lỗi', 'Thiếu thư viện xuất PDF');
        return;
    }

    const { jsPDF } = window.jspdf;

    const loadingModal = document.createElement('div');
    loadingModal.id = 'pdf-loading-modal';
    loadingModal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4';
    loadingModal.innerHTML = `
        <div class="bg-white rounded-2xl p-8 text-center w-[420px] max-w-full">
            <div class="text-4xl mb-3">📊</div>
            <h3 class="text-lg font-bold text-gray-800">Đang tạo báo cáo PDF...</h3>
            <p class="text-sm text-gray-500 mt-1">Vui lòng đợi trong giây lát</p>
        </div>
    `;
    document.body.appendChild(loadingModal);

    try {
        const now = new Date();
        const balance = document.getElementById('total-balance')?.textContent || '';
        const totalIncome = document.getElementById('stat-total-income')?.textContent || '';
        const totalExpense = document.getElementById('stat-total-expense')?.textContent || '';
        const netProfit = document.getElementById('stat-net-profit')?.textContent || '';
        const txCount = document.getElementById('stat-tx-count')?.textContent || '';

        const lineChartCanvas = document.getElementById('incomeExpenseChart');
        const pieChartCanvas = document.getElementById('expenseBreakdownChart');
        const lineChartImg = lineChartCanvas ? lineChartCanvas.toDataURL('image/png', 1.0) : '';
        const pieChartImg = pieChartCanvas ? pieChartCanvas.toDataURL('image/png', 1.0) : '';

        let txRows = '';
        const transactions = (allTransactions || []).slice(0, 10);
        transactions.forEach((tx, i) => {
            const isIncome = tx.transactionType === 'INCOME';
            const date = tx.createdAt ? new Date(tx.createdAt) : new Date();
            const bgColor = i % 2 === 0 ? '#f9fafb' : 'white';
            const typeColor = isIncome ? '#059669' : '#dc2626';
            const typeBg = isIncome ? '#d1fae5' : '#fee2e2';
            const desc = (tx.description || tx.category || '').toString();
            const amount = Math.abs(Number(tx.amount) || 0);
            txRows += `
                <tr style="background: ${bgColor};">
                    <td style="padding: 8px 12px; font-size: 12px; color: #6b7280;">${date.toLocaleDateString('vi-VN')}</td>
                    <td style="padding: 8px 12px; font-size: 12px; color: #111827;">${desc.substring(0, 40)}</td>
                    <td style="padding: 8px 12px;"><span style="background: ${typeBg}; color: ${typeColor}; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${isIncome ? 'Thu nhập' : 'Chi tiêu'}</span></td>
                    <td style="padding: 8px 12px; font-size: 12px; font-weight: 600; color: ${typeColor}; text-align: right;">${isIncome ? '+' : '-'}${formatCurrency(amount)}</td>
                </tr>
            `;
        });

        const reportEl = document.createElement('div');
        reportEl.id = 'pdf-report';
        reportEl.style.cssText = 'position: fixed; top: -9999px; left: 0; width: 794px; background: white; font-family: Arial, sans-serif;';
        reportEl.innerHTML = `
            <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Báo Cáo Tài Chính</h1>
                <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">AgriPlanner - Hệ thống quản lý nông trại</p>
                <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.8;">Ngày xuất: ${now.toLocaleDateString('vi-VN')} - ${now.toLocaleTimeString('vi-VN')}</p>
            </div>

            <div style="padding: 24px;">
                <h2 style="font-size: 18px; color: #111827; margin: 0 0 16px 0; font-weight: 600;">Tóm Tắt Tài Chính</h2>

                <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                    <p style="margin: 0 0 4px 0; font-size: 13px; color: #059669;">Số dư hiện tại</p>
                    <p style="margin: 0; font-size: 28px; font-weight: 700; color: #059669;">${balance}</p>
                </div>

                <div style="display: flex; gap: 16px; margin-bottom: 24px;">
                    <div style="flex: 1; background: #f9fafb; padding: 16px; border-radius: 8px;">
                        <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Tổng thu nhập</p>
                        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #059669;">${totalIncome}</p>
                    </div>
                    <div style="flex: 1; background: #f9fafb; padding: 16px; border-radius: 8px;">
                        <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Tổng chi tiêu</p>
                        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #dc2626;">${totalExpense}</p>
                    </div>
                    <div style="flex: 1; background: #f9fafb; padding: 16px; border-radius: 8px;">
                        <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Lợi nhuận ròng</p>
                        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #2563eb;">${netProfit}</p>
                    </div>
                    <div style="flex: 1; background: #f9fafb; padding: 16px; border-radius: 8px;">
                        <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Số giao dịch</p>
                        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #d97706;">${txCount} giao dịch</p>
                    </div>
                </div>

                <h2 style="font-size: 18px; color: #111827; margin: 0 0 16px 0; font-weight: 600;">Biểu Đồ Phân Tích</h2>
                <div style="display: flex; gap: 20px; margin-bottom: 24px;">
                    <div style="flex: 2;">
                        <p style="font-size: 13px; color: #6b7280; margin: 0 0 8px 0;">Thu nhập & Chi tiêu (30 ngày)</p>
                        <img src="${lineChartImg}" style="width: 100%; border-radius: 8px; border: 1px solid #e5e7eb;">
                    </div>
                    <div style="flex: 1;">
                        <p style="font-size: 13px; color: #6b7280; margin: 0 0 8px 0;">Phân bổ chi tiêu</p>
                        <img src="${pieChartImg}" style="width: 100%; border-radius: 8px; border: 1px solid #e5e7eb;">
                    </div>
                </div>

                <h2 style="font-size: 18px; color: #111827; margin: 0 0 16px 0; font-weight: 600;">Lịch Sử Giao Dịch Gần Đây</h2>
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                    <thead>
                        <tr style="background: #f3f4f6;">
                            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #4b5563;">Thời gian</th>
                            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #4b5563;">Mô tả</th>
                            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #4b5563;">Loại</th>
                            <th style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: 600; color: #4b5563;">Số tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${txRows}
                    </tbody>
                </table>

                <p style="text-align: center; font-size: 11px; color: #9ca3af; margin: 24px 0 0 0;">© 2024 AgriPlanner - Báo cáo được tạo tự động</p>
            </div>
        `;
        document.body.appendChild(reportEl);

        await new Promise(r => setTimeout(r, 300));

        const canvas = await html2canvas(reportEl, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        reportEl.remove();

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        const fileName = `BaoCaoTaiChinh_${now.toISOString().split('T')[0]}.pdf`;
        pdf.save(fileName);

        loadingModal.remove();
        showNotification('success', 'Thành công', 'Đã xuất báo cáo PDF thành công!');
    } catch (error) {
        console.error('Error generating PDF:', error);
        loadingModal.remove();
        document.getElementById('pdf-report')?.remove();
        showNotification('error', 'Lỗi', 'Không thể tạo báo cáo PDF. Vui lòng thử lại.');
    }
}

function loadAssets() {
    if (!assetsInitialized) {
        initCharts();
        assetsInitialized = true;
    }
    loadAssetData();
    loadPayrollData();
}

// ================= UTILS =================

// Fix UTF-8 double-encoded Vietnamese text (mojibake)
function fixUtf8(str) {
    if (!str || typeof str !== 'string') return str || '';
    // Detect mojibake pattern: Latin-1 interpretation of UTF-8 bytes
    // e.g. "Kiá»ƒm" instead of "Kiểm"
    try {
        // Check if string contains typical mojibake sequences
        if (/[\xC0-\xFF]/.test(str)) {
            // Try to decode: interpret each char as a byte, then decode as UTF-8
            const bytes = new Uint8Array(str.length);
            for (let i = 0; i < str.length; i++) {
                bytes[i] = str.charCodeAt(i) & 0xFF;
            }
            const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            // If decoding succeeded and result differs, and result looks like valid Vietnamese
            if (decoded && decoded !== str && /[\u00C0-\u024F\u1E00-\u1EFF]/.test(decoded)) {
                return decoded;
            }
        }
    } catch (e) {
        // Not double-encoded, return original
    }
    return str;
}

// ================= TASK DETAIL =================

function buildWorkerInspectionResultsHtml(task) {
    if (!task) return '';
    const status = task.status ? String(task.status).toUpperCase() : '';
    if (status !== 'COMPLETED' && status !== 'APPROVED') return '';

    // Material-consuming tasks: show material info instead of inspection results
    const materialTaskTypes = ['FEED', 'VACCINATE', 'FERTILIZE', 'SEED', 'PEST_CONTROL'];
    const taskType = task.taskType ? String(task.taskType).toUpperCase() : '';
    if (materialTaskTypes.includes(taskType)) {
        return buildCompletedMaterialTaskHtml(task);
    }

    // Byproduct collection tasks: show collected quantity info
    if (taskType === 'HARVEST' && task.workflowData) {
        try {
            const wfData = typeof task.workflowData === 'string' ? JSON.parse(task.workflowData) : task.workflowData;
            if (wfData.subType === 'BYPRODUCT_COLLECTION') {
                return buildCompletedByproductTaskHtml(task, wfData);
            }
        } catch (e) { }
    }

    const desc = task.description || '';
    const aiLines = desc.split('\n').filter(l => l.startsWith('AI:'));
    if (aiLines.length === 0) return '';

    const aiData = aiLines.map(l => l.replace(/^AI:\s*/, '')).join('\n');

    // Extract condition
    const conditionMatch = aiData.match(/^(CLEAN|DIRTY|SICK|GOOD|FAIR|POOR):/);
    let conditionLabel = '';
    let conditionColor = '#6b7280';
    let conditionIcon = 'help';
    if (conditionMatch) {
        const val = conditionMatch[1];
        const labelMap = { 'CLEAN': 'Sạch', 'DIRTY': 'Bẩn', 'SICK': 'Có dấu hiệu bệnh', 'GOOD': 'Tốt', 'FAIR': 'Trung bình', 'POOR': 'Kém' };
        const colorMap = { 'CLEAN': '#16a34a', 'GOOD': '#16a34a', 'DIRTY': '#d97706', 'FAIR': '#d97706', 'SICK': '#dc2626', 'POOR': '#dc2626' };
        const iconMap = { 'CLEAN': 'check_circle', 'GOOD': 'check_circle', 'DIRTY': 'warning', 'FAIR': 'info', 'SICK': 'coronavirus', 'POOR': 'error' };
        conditionLabel = labelMap[val] || val;
        conditionColor = colorMap[val] || '#6b7280';
        conditionIcon = iconMap[val] || 'help';
    }

    // Extract photos
    const photo1Match = aiData.match(/Ảnh chuồng:\s*([^\|]+)/);
    const photo2Match = aiData.match(/Ảnh vật nuôi:\s*([^\|]+)/);
    const photo1Name = photo1Match ? photo1Match[1].trim() : null;
    const photo2Name = photo2Match ? photo2Match[1].trim() : null;

    // Extract video
    const videoMatch = aiData.match(/Video:\s*([^\|]+)/);
    const videoName = videoMatch ? videoMatch[1].trim() : null;

    // Use server URLs first, fallback to localStorage
    const _apiOrigin = new URL(API_BASE).origin;
    const serverImageUrl = task.reportImageUrl ? (_apiOrigin + task.reportImageUrl) : null;
    const serverVideoUrl = task.reportVideoUrl ? (_apiOrigin + task.reportVideoUrl) : null;
    const photoStore = JSON.parse(localStorage.getItem('inspectionPhotos') || '{}');
    const photo1Data = serverImageUrl || photoStore[`task_${task.id}_photo1`] || null;
    const photo2Data = photoStore[`task_${task.id}_photo2`] || null;
    const videoData = serverVideoUrl || photoStore[`task_${task.id}_video`] || null;

    // Extract mortality
    const mortalityMatch = aiData.match(/Hao hụt:\s*(\d+)\s*con(?:\s*\((\w+)\)\s*-\s*(.+))?/);
    const mortalityQty = mortalityMatch ? mortalityMatch[1] : null;
    const mortalityCauseType = mortalityMatch ? (mortalityMatch[2] || null) : null;
    const mortalityCause = mortalityMatch ? (mortalityMatch[3] ? mortalityMatch[3].trim() : null) : null;
    const causeTypeLabels = { 'DEATH': 'Chết', 'DISEASE': 'Bệnh', 'ACCIDENT': 'Tai nạn', 'CULL': 'Loại thải' };

    let html = `<div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px; margin-bottom:16px;">
        <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:16px; display:flex; align-items:center; gap:6px;">
            <span class="material-icons-round" style="font-size:18px; color:#2563eb;">assignment_turned_in</span>
            Kết quả báo cáo đã ghi nhận
        </div>`;

    // Condition
    if (conditionLabel) {
        html += `<div style="display:flex; align-items:center; gap:12px; margin-bottom:14px; padding:12px 16px; border-radius:12px; background:${conditionColor}11; border:1px solid ${conditionColor}22;">
            <span class="material-icons-round" style="font-size:28px; color:${conditionColor};">${conditionIcon}</span>
            <div>
                <div style="font-size:12px; color:#6b7280;">Tình trạng đã đánh giá</div>
                <div style="font-size:16px; font-weight:700; color:${conditionColor};">${conditionLabel}</div>
            </div>
        </div>`;
    }

    // Media (photos + video)
    const hasMedia = photo1Name || photo2Name || videoName || serverImageUrl || serverVideoUrl;
    if (hasMedia) {
        html += `<div style="margin-bottom:14px;">
            <div style="font-size:12px; font-weight:500; color:#6b7280; margin-bottom:8px;">Minh chứng đã đính kèm</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">`;
        if (photo1Name || serverImageUrl) {
            const imgSrc = photo1Data;
            html += `<div style="border-radius:10px; background:#f0fdf4; border:1px solid #bbf7d0; overflow:hidden;">
                ${imgSrc ? `<img src="${imgSrc}" style="width:100%; max-height:160px; object-fit:cover; cursor:pointer;" alt="Ảnh chuồng" onclick="openMediaLightbox(this.src, 'image')">` : `<div style="padding:20px; text-align:center; color:#9ca3af;"><span class="material-icons-round" style="font-size:40px;">image</span><div style="font-size:12px; margin-top:4px;">Không tải được ảnh</div></div>`}
                <div style="padding:8px 12px; display:flex; align-items:center; gap:6px;">
                    <span class="material-icons-round" style="font-size:18px; color:#16a34a;">photo_camera</span>
                    <div>
                        <div style="font-size:11px; font-weight:600; color:#15803d;">Ảnh</div>
                        <div style="font-size:10px; color:#6b7280; word-break:break-all;">${escapeHtml(photo1Name || 'Ảnh báo cáo')}</div>
                    </div>
                </div>
            </div>`;
        }
        if (photo2Name) {
            html += `<div style="border-radius:10px; background:#fff7ed; border:1px solid #fed7aa; overflow:hidden;">
                ${photo2Data ? `<img src="${photo2Data}" style="width:100%; max-height:160px; object-fit:cover; cursor:pointer;" alt="Ảnh vật nuôi" onclick="openMediaLightbox(this.src, 'image')">` : `<div style="padding:20px; text-align:center; color:#9ca3af;"><span class="material-icons-round" style="font-size:40px;">image</span><div style="font-size:12px; margin-top:4px;">Không tải được ảnh</div></div>`}
                <div style="padding:8px 12px; display:flex; align-items:center; gap:6px;">
                    <span class="material-icons-round" style="font-size:18px; color:#ea580c;">pets</span>
                    <div>
                        <div style="font-size:11px; font-weight:600; color:#9a3412;">Ảnh vật nuôi</div>
                        <div style="font-size:10px; color:#6b7280; word-break:break-all;">${escapeHtml(photo2Name)}</div>
                    </div>
                </div>
            </div>`;
        }
        if (videoName || serverVideoUrl) {
            const vidSrc = videoData;
            html += `<div style="border-radius:10px; background:#eff6ff; border:1px solid #bfdbfe; overflow:hidden;">
                ${vidSrc ? `<video src="${vidSrc}" style="width:100%; max-height:160px; object-fit:cover; cursor:pointer;" onclick="openMediaLightbox(this.src, 'video')" preload="metadata"></video>` : `<div style="padding:20px; text-align:center; color:#9ca3af;"><span class="material-icons-round" style="font-size:40px;">videocam_off</span><div style="font-size:12px; margin-top:4px;">Không tải được video</div></div>`}
                <div style="padding:8px 12px; display:flex; align-items:center; gap:6px;">
                    <span class="material-icons-round" style="font-size:18px; color:#2563eb;">videocam</span>
                    <div>
                        <div style="font-size:11px; font-weight:600; color:#1e40af;">Video</div>
                        <div style="font-size:10px; color:#6b7280; word-break:break-all;">${escapeHtml(videoName || 'Video báo cáo')}</div>
                    </div>
                </div>
            </div>`;
        }
        html += `</div></div>`;
    }

    // Mortality
    if (mortalityQty && parseInt(mortalityQty) > 0) {
        const causeLabel = causeTypeLabels[mortalityCauseType] || mortalityCauseType || 'Không rõ';
        html += `<div style="padding:12px 16px; border-radius:12px; background:#fef2f2; border:1px solid #fecaca;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span class="material-icons-round" style="font-size:20px; color:#dc2626;">heart_broken</span>
                <span style="font-size:13px; font-weight:700; color:#dc2626;">Hao hụt: ${mortalityQty} con</span>
            </div>
            ${mortalityCause ? `<div style="font-size:12px; color:#991b1b;">Loại: ${causeLabel} — ${escapeHtml(mortalityCause)}</div>` : ''}
        </div>`;
    } else if (mortalityQty === '0' || (mortalityMatch && mortalityMatch[1] === '0')) {
        html += `<div style="padding:12px 16px; border-radius:12px; background:#f0fdf4; border:1px solid #bbf7d0;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span class="material-icons-round" style="font-size:20px; color:#16a34a;">check_circle</span>
                <span style="font-size:13px; font-weight:700; color:#16a34a;">Không có hao hụt</span>
            </div>
        </div>`;
    }

    html += `</div>`;
    return html;
}

// ── Completed material task view (shows material info + media, no mortality) ──
function buildCompletedMaterialTaskHtml(task) {
    const taskType = task.taskType ? String(task.taskType).toUpperCase() : '';
    const typeConfig = {
        'FEED': { icon: 'restaurant', color: '#16a34a', label: 'Thức ăn' },
        'VACCINATE': { icon: 'vaccines', color: '#7c3aed', label: 'Vắc-xin' },
        'FERTILIZE': { icon: 'science', color: '#d97706', label: 'Phân bón' },
        'SEED': { icon: 'grass', color: '#16a34a', label: 'Giống' },
        'PEST_CONTROL': { icon: 'bug_report', color: '#dc2626', label: 'Thuốc BVTV' }
    };
    const cfg = typeConfig[taskType] || { icon: 'inventory_2', color: '#6b7280', label: 'Vật tư' };

    // Try relatedItem first, then fall back to workflowData for livestock tasks
    let materialName = 'Không xác định';
    let qty = task.quantityRequired || 0;
    let unit = 'đơn vị';
    if (task.relatedItem) {
        materialName = task.relatedItem.name || 'Không rõ';
        unit = task.relatedItem.unit || 'đơn vị';
    } else if (task.workflowData) {
        try {
            const wf = typeof task.workflowData === 'string' ? JSON.parse(task.workflowData) : task.workflowData;
            if (wf.feedName) { materialName = wf.feedName; unit = 'kg'; qty = wf.amountKg || qty; }
            else if (wf.vaccineName) { materialName = wf.vaccineName; unit = 'liều'; }
            else if (wf.pesticideName) { materialName = wf.pesticideName; unit = 'đơn vị'; }
        } catch (e) { /* ignore parse errors */ }
    }

    // Media from server
    const _apiOrigin = new URL(API_BASE).origin;
    const serverImageUrl = task.reportImageUrl ? (_apiOrigin + task.reportImageUrl) : null;
    const serverVideoUrl = task.reportVideoUrl ? (_apiOrigin + task.reportVideoUrl) : null;

    let html = `<div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px; margin-bottom:16px;">
        <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:16px; display:flex; align-items:center; gap:6px;">
            <span class="material-icons-round" style="font-size:18px; color:${cfg.color};">inventory_2</span>
            Vật tư tiêu hao đã sử dụng
        </div>
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px; padding:12px 16px; border-radius:12px; background:${cfg.color}11; border:1px solid ${cfg.color}22;">
            <span class="material-icons-round" style="font-size:28px; color:${cfg.color};">${cfg.icon}</span>
            <div style="flex:1;">
                <div style="font-size:12px; color:#6b7280;">${cfg.label}</div>
                <div style="font-size:16px; font-weight:700; color:${cfg.color};">${escapeHtml(materialName)}</div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:12px; color:#6b7280;">Số lượng</div>
                <div style="font-size:16px; font-weight:700; color:#1f2937;">${qty} ${escapeHtml(unit)}</div>
            </div>
        </div>`;

    // Media
    if (serverImageUrl || serverVideoUrl) {
        html += `<div style="margin-bottom:14px;">
            <div style="font-size:12px; font-weight:500; color:#6b7280; margin-bottom:8px;">Minh chứng đã đính kèm</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">`;
        if (serverImageUrl) {
            html += `<div style="border-radius:10px; background:#f0fdf4; border:1px solid #bbf7d0; overflow:hidden;">
                <img src="${serverImageUrl}" style="width:100%; max-height:160px; object-fit:cover; cursor:pointer;" alt="Ảnh báo cáo" onclick="openMediaLightbox(this.src, 'image')">
                <div style="padding:8px 12px; display:flex; align-items:center; gap:6px;">
                    <span class="material-icons-round" style="font-size:18px; color:#16a34a;">photo_camera</span>
                    <span style="font-size:11px; font-weight:600; color:#15803d;">Ảnh báo cáo</span>
                </div>
            </div>`;
        }
        if (serverVideoUrl) {
            html += `<div style="border-radius:10px; background:#eff6ff; border:1px solid #bfdbfe; overflow:hidden;">
                <video src="${serverVideoUrl}" style="width:100%; max-height:160px; object-fit:cover; cursor:pointer;" onclick="openMediaLightbox(this.src, 'video')" preload="metadata"></video>
                <div style="padding:8px 12px; display:flex; align-items:center; gap:6px;">
                    <span class="material-icons-round" style="font-size:18px; color:#2563eb;">videocam</span>
                    <span style="font-size:11px; font-weight:600; color:#1e40af;">Video báo cáo</span>
                </div>
            </div>`;
        }
        html += `</div></div>`;
    }

    html += `</div>`;
    return html;
}

// ── Inline report sections for task detail (media upload + mortality) ──
function buildInlineReportSections(task) {
    if (!task) return '';
    const hasPen = task.pen != null;
    const hasField = task.field != null;
    if (!hasPen && !hasField) return ''; // Only for pen or field tasks

    // Detect material-consuming tasks (no mortality/loss report needed)
    const materialTaskTypes = ['FEED', 'VACCINATE', 'FERTILIZE', 'SEED', 'PEST_CONTROL'];
    const taskType = task.taskType ? String(task.taskType).toUpperCase() : '';
    const isMaterialTask = materialTaskTypes.includes(taskType);

    if (isMaterialTask) {
        return buildMaterialTaskReportSections(task);
    }

    // Detect byproduct collection tasks (HARVEST with subType BYPRODUCT_COLLECTION)
    if (taskType === 'HARVEST' && task.workflowData) {
        try {
            const wfData = typeof task.workflowData === 'string' ? JSON.parse(task.workflowData) : task.workflowData;
            if (wfData.subType === 'BYPRODUCT_COLLECTION') {
                return buildByproductCollectionReportSections(task, wfData);
            }
        } catch (e) { /* not byproduct collection */ }
    }

    const penAnimalCount = task.pen ? (task.pen.animalCount || 0) : 0;
    const animalUnit = task.pen && task.pen.animalDefinition ? (task.pen.animalDefinition.unit || 'con') : 'con';
    const sellPrice = task.pen && task.pen.animalDefinition ? (Number(task.pen.animalDefinition.sellPricePerUnit) || 0) : 0;
    window._inlineSellPrice = sellPrice;
    const inspectionInfo = getInspectionTaskInfo(task);
    const isInspection = !!inspectionInfo;

    // Condition selector for inspection tasks
    let conditionHtml = '';
    if (isInspection) {
        const kind = inspectionInfo.kind;
        const defaultValue = getInspectionDefaultValue(task, inspectionInfo);
        const options = kind === 'FIELD'
            ? [{ value: 'GOOD', label: 'Tốt' }, { value: 'FAIR', label: 'Trung bình' }, { value: 'POOR', label: 'Kém' }]
            : [{ value: 'CLEAN', label: 'Sạch' }, { value: 'DIRTY', label: 'Bẩn' }, { value: 'SICK', label: 'Có dấu hiệu bệnh' }];
        const optionsHtml = options.map(o => `<option value="${o.value}" ${o.value === defaultValue ? 'selected' : ''}>${o.label}</option>`).join('');
        conditionHtml = `
        <div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px; margin-top:16px;">
            <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                <span class="material-icons-round" style="font-size:18px; color:#7c3aed;">assignment</span>
                Đánh giá tình trạng <span style="color:#dc2626;">*</span>
            </div>
            <select id="inline-condition-select" style="width:100%; padding:10px 14px; border:1px solid #d1d5db; border-radius:10px; font-size:14px; background:white; color:#111827;">
                ${optionsHtml}
            </select>
        </div>`;
    }

    // Media upload section (shared for both pen and field)
    const mediaHtml = `
        <!-- Media Upload Section -->
        <div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px; margin-top:16px;">
            <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:16px; display:flex; align-items:center; gap:6px;">
                <span class="material-icons-round" style="font-size:18px; color:#2563eb;">attach_file</span>
                Hình ảnh / Video báo cáo ${hasPen ? '<span style="color:#dc2626;">*</span>' : ''}
            </div>
            <p style="font-size:12px; color:#9ca3af; margin:0 0 12px;">${hasPen ? 'Thêm ít nhất 1 ảnh hoặc 1 video minh chứng công việc' : 'Đính kèm ảnh/video (nếu có)'}</p>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <!-- Image upload -->
                <div>
                    <div id="inline-img-dropzone" style="background:#f0fdf4; border:2px dashed #86efac; border-radius:12px; padding:20px; text-align:center; cursor:pointer; transition:border-color 0.2s, background 0.2s;"
                         onclick="document.getElementById('inline-image-input').click()"
                         onmouseenter="this.style.borderColor='#10b981'; this.style.background='#ecfdf5'"
                         onmouseleave="this.style.borderColor='#86efac'; this.style.background='#f0fdf4'">
                        <span class="material-icons-round" style="font-size:36px; color:#10b981;">photo_camera</span>
                        <p style="margin:6px 0 0; font-size:13px; font-weight:600; color:#15803d;">Chọn ảnh</p>
                        <p style="margin:2px 0 0; font-size:11px; color:#6b7280;">JPG, PNG</p>
                    </div>
                    <input type="file" id="inline-image-input" accept="image/*" class="hidden" onchange="onInlineImageSelected(event)" />
                    <div id="inline-img-preview" style="display:none; margin-top:8px; border-radius:10px; overflow:hidden; border:1px solid #e5e7eb; position:relative;">
                        <img id="inline-img-preview-img" src="" style="width:100%; max-height:180px; object-fit:cover;" />
                        <button onclick="removeInlineImage()" style="position:absolute; top:6px; right:6px; width:28px; height:28px; border-radius:50%; background:rgba(0,0,0,0.5); color:white; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                            <span class="material-icons-round" style="font-size:18px;">close</span>
                        </button>
                        <div style="padding:6px 10px; font-size:11px; color:#6b7280; background:#f9fafb;" id="inline-img-filename"></div>
                    </div>
                </div>

                <!-- Video upload -->
                <div>
                    <div id="inline-vid-dropzone" style="background:#eff6ff; border:2px dashed #93c5fd; border-radius:12px; padding:20px; text-align:center; cursor:pointer; transition:border-color 0.2s, background 0.2s;"
                         onclick="document.getElementById('inline-video-input').click()"
                         onmouseenter="this.style.borderColor='#3b82f6'; this.style.background='#dbeafe'"
                         onmouseleave="this.style.borderColor='#93c5fd'; this.style.background='#eff6ff'">
                        <span class="material-icons-round" style="font-size:36px; color:#3b82f6;">videocam</span>
                        <p style="margin:6px 0 0; font-size:13px; font-weight:600; color:#1e40af;">Chọn video</p>
                        <p style="margin:2px 0 0; font-size:11px; color:#6b7280;">MP4, MOV (tối đa 50MB)</p>
                    </div>
                    <input type="file" id="inline-video-input" accept="video/*" class="hidden" onchange="onInlineVideoSelected(event)" />
                    <div id="inline-vid-preview" style="display:none; margin-top:8px; border-radius:10px; overflow:hidden; border:1px solid #e5e7eb; position:relative;">
                        <video id="inline-vid-preview-el" src="" style="width:100%; max-height:180px; object-fit:cover;" controls></video>
                        <button onclick="removeInlineVideo()" style="position:absolute; top:6px; right:6px; width:28px; height:28px; border-radius:50%; background:rgba(0,0,0,0.5); color:white; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                            <span class="material-icons-round" style="font-size:18px;">close</span>
                        </button>
                        <div style="padding:6px 10px; font-size:11px; color:#6b7280; background:#f9fafb;" id="inline-vid-filename"></div>
                    </div>
                </div>
            </div>
        </div>`;

    // ── PEN: Mortality Report Section ──
    if (hasPen) {
        return `
            ${conditionHtml}
            ${mediaHtml}

            <!-- Mortality Report Section -->
            <div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px; margin-top:16px;">
                <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                    <span class="material-icons-round" style="font-size:18px; color:#ea580c;">heart_broken</span>
                    Báo cáo hao hụt <span style="color:#dc2626;">*</span>
                </div>
                <p style="font-size:12px; color:#9ca3af; margin:0 0 12px;">Ghi nhận số lượng hao hụt (nhập 0 nếu không có hao hụt)</p>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
                    <div>
                        <label style="display:block; font-size:12px; font-weight:500; color:#6b7280; margin-bottom:4px;">Số lượng hao hụt</label>
                        <input type="number" id="inline-mortality-qty" min="0" max="${penAnimalCount}" value="0"
                            style="width:100%; padding:10px 14px; border:1px solid #d1d5db; border-radius:10px; font-size:14px;" placeholder="0"
                            oninput="toggleInlineMortalityDetail()">
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:500; color:#6b7280; margin-bottom:4px;">Loại hao hụt</label>
                        <select id="inline-mortality-type" style="width:100%; padding:10px 14px; border:1px solid #d1d5db; border-radius:10px; font-size:14px;">
                            <option value="DEATH">Chết</option>
                            <option value="DISEASE">Bệnh</option>
                            <option value="ACCIDENT">Tai nạn</option>
                            <option value="CULL">Loại thải</option>
                        </select>
                    </div>
                </div>

                <div id="inline-mortality-detail" style="display:none;">
                    <div style="margin-bottom:12px;">
                        <label style="display:block; font-size:12px; font-weight:500; color:#6b7280; margin-bottom:4px;">Nguyên nhân cụ thể <span style="color:#dc2626;">*</span></label>
                        <input type="text" id="inline-mortality-cause" style="width:100%; padding:10px 14px; border:1px solid #d1d5db; border-radius:10px; font-size:14px;" placeholder="VD: Dịch tả, sốc nhiệt...">
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="display:block; font-size:12px; font-weight:500; color:#6b7280; margin-bottom:4px;">Ước tính thiệt hại (₫) <span style="font-weight:400; color:#9ca3af;">(tự tính)</span></label>
                        <input type="number" id="inline-mortality-loss" min="0" step="1000" value="0"
                            style="width:100%; padding:10px 14px; border:1px solid #d1d5db; border-radius:10px; font-size:14px;" placeholder="0">
                        ${sellPrice > 0 ? `<div style="font-size:11px; color:#6b7280; margin-top:4px;">Giá bán: ${new Intl.NumberFormat('vi-VN').format(sellPrice)} ₫/${animalUnit} — Sẽ tự tính khi nhập số lượng</div>` : ''}
                    </div>
                </div>

                <div style="font-size:11px; color:#9ca3af; display:flex; align-items:center; gap:4px;">
                    <span class="material-icons-round" style="font-size:14px;">info</span>
                    Số lượng hiện có: ${penAnimalCount} ${animalUnit}. Nhập 0 nếu không có hao hụt.
                </div>
            </div>
        `;
    }

    // ── FIELD: Crop Loss Report Section ──
    const field = task.field;
    const fieldStage = field ? (field.workflowStage || '') : '';
    const isPlanted = ['SEEDED', 'GROWING', 'READY_HARVEST'].includes(fieldStage);
    const fieldAreaSqm = field ? (Number(field.areaSqm) || 0) : 0;
    const cropName = field && field.currentCrop ? field.currentCrop.name : '';

    // Store field data for later use in completeTask
    window._inlineFieldId = field ? field.id : null;
    window._inlineFieldLossPolygon = null;
    window._inlineFieldLossAreaSqm = 0;
    window._inlineFieldHasLoss = false;

    let cropLossHtml = '';
    if (isPlanted) {
        cropLossHtml = `
        <!-- Crop Loss Report Section -->
        <div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px; margin-top:16px;">
            <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                <span class="material-icons-round" style="font-size:18px; color:#dc2626;">warning</span>
                Báo cáo hao hụt trồng trọt
            </div>
            <p style="font-size:12px; color:#9ca3af; margin:0 0 12px;">Vẽ vùng bị hư hại trên bản đồ (nếu có). Bỏ trống nếu không có hao hụt.</p>

            <div style="margin-bottom:12px;">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; padding:10px 14px; border:1px solid #d1d5db; border-radius:10px; background:white;">
                    <input type="checkbox" id="inline-field-has-loss" onchange="toggleFieldLossSection()" style="width:18px; height:18px; accent-color:#dc2626;">
                    <span style="font-size:14px; color:#111827;">Có vùng bị hư hại / thiệt hại cây trồng</span>
                </label>
            </div>

            <div id="inline-field-loss-section" style="display:none;">
                <!-- Mini map for polygon drawing -->
                <div style="margin-bottom:12px;">
                    <div id="inline-field-loss-map" style="height:280px; border-radius:12px; border:1px solid #d1d5db; overflow:hidden;"></div>
                    <div style="font-size:11px; color:#6b7280; margin-top:6px; display:flex; align-items:center; gap:4px;">
                        <span class="material-icons-round" style="font-size:14px;">gesture</span>
                        Dùng công cụ vẽ trên bản đồ để đánh dấu vùng bị hư hại
                    </div>
                </div>

                <!-- Loss area info -->
                <div id="inline-field-loss-info" style="display:none; padding:12px 16px; border-radius:12px; background:#fef2f2; border:1px solid #fecaca; margin-bottom:12px;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                        <span class="material-icons-round" style="font-size:20px; color:#dc2626;">square_foot</span>
                        <span style="font-size:14px; font-weight:700; color:#dc2626;" id="inline-field-loss-area-text">0 m²</span>
                        <span style="font-size:12px; color:#991b1b; margin-left:8px;" id="inline-field-loss-pct-text"></span>
                    </div>
                    <div style="font-size:12px; color:#991b1b;" id="inline-field-loss-value-text"></div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
                    <div>
                        <label style="display:block; font-size:12px; font-weight:500; color:#6b7280; margin-bottom:4px;">Nguyên nhân</label>
                        <select id="inline-field-loss-cause" style="width:100%; padding:10px 14px; border:1px solid #d1d5db; border-radius:10px; font-size:14px;">
                            <option value="DISEASE">Dịch bệnh</option>
                            <option value="PESTS">Sâu bệnh</option>
                            <option value="WEATHER">Thời tiết</option>
                            <option value="FLOOD">Ngập lụt</option>
                            <option value="DROUGHT">Hạn hán</option>
                            <option value="OTHER">Khác</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:500; color:#6b7280; margin-bottom:4px;">Chi tiết nguyên nhân</label>
                        <input type="text" id="inline-field-loss-cause-detail" style="width:100%; padding:10px 14px; border:1px solid #d1d5db; border-radius:10px; font-size:14px;" placeholder="VD: Rầy nâu, đạo ôn...">
                    </div>
                </div>

                <div>
                    <label style="display:block; font-size:12px; font-weight:500; color:#6b7280; margin-bottom:4px;">Ghi chú thêm</label>
                    <textarea id="inline-field-loss-notes" rows="2" style="width:100%; padding:10px 14px; border:1px solid #d1d5db; border-radius:10px; font-size:14px; resize:vertical;" placeholder="Mô tả tình trạng thiệt hại..."></textarea>
                </div>
            </div>

            ${!isPlanted ? '' : `
            <div style="font-size:11px; color:#9ca3af; display:flex; align-items:center; gap:4px; margin-top:8px;">
                <span class="material-icons-round" style="font-size:14px;">info</span>
                ${cropName ? `Cây trồng: ${escapeHtml(cropName)}.` : ''} Diện tích: ${fieldAreaSqm > 0 ? (fieldAreaSqm / 10000).toFixed(2) + ' ha' : 'N/A'}.
            </div>`}
        </div>`;
    } else {
        cropLossHtml = `
        <div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px; margin-top:16px;">
            <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                <span class="material-icons-round" style="font-size:18px; color:#9ca3af;">info</span>
                Hao hụt trồng trọt
            </div>
            <p style="font-size:12px; color:#9ca3af; margin:0;">Ruộng chưa gieo trồng — không cần báo cáo hao hụt.</p>
        </div>`;
    }

    return `
        ${conditionHtml}
        ${mediaHtml}
        ${cropLossHtml}
    `;
}

// ── Material-consuming task report (no mortality/loss needed) ──
function buildMaterialTaskReportSections(task) {
    const relatedItemName = task.relatedItem ? fixUtf8(task.relatedItem.name || '') : null;
    const quantityLabel = task.quantityRequired ? String(task.quantityRequired) : null;
    const taskType = task.taskType ? String(task.taskType).toUpperCase() : '';
    const unit = task.relatedItem ? (task.relatedItem.effectiveUnit || task.relatedItem.unit || '') : '';

    const materialIcons = {
        'FEED': { icon: 'restaurant', color: '#059669', bg: '#ecfdf5', label: 'Thức ăn' },
        'VACCINATE': { icon: 'vaccines', color: '#7c3aed', bg: '#f5f3ff', label: 'Vắc xin' },
        'FERTILIZE': { icon: 'science', color: '#d97706', bg: '#fffbeb', label: 'Phân bón' },
        'SEED': { icon: 'grass', color: '#16a34a', bg: '#f0fdf4', label: 'Hạt giống' },
        'PEST_CONTROL': { icon: 'bug_report', color: '#dc2626', bg: '#fef2f2', label: 'Thuốc trừ sâu' }
    };
    const mi = materialIcons[taskType] || { icon: 'inventory_2', color: '#ca8a04', bg: '#fefce8', label: 'Vật tư' };

    const materialInfoHtml = relatedItemName ? `
        <div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px; margin-top:16px;">
            <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                <span class="material-icons-round" style="font-size:18px; color:${mi.color};">${mi.icon}</span>
                Vật tư tiêu hao
            </div>
            <div style="display:flex; align-items:center; gap:14px; padding:14px 16px; border-radius:12px; background:${mi.bg}; border:1px solid ${mi.color}22;">
                <div style="width:48px; height:48px; border-radius:12px; background:white; color:${mi.color}; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                    <span class="material-icons-round" style="font-size:26px;">${mi.icon}</span>
                </div>
                <div style="flex:1;">
                    <div style="font-weight:700; color:#111827; font-size:15px;">${escapeHtml(relatedItemName)}</div>
                    <div style="font-size:13px; color:#6b7280; margin-top:2px;">
                        ${mi.label} — Số lượng: <strong style="color:${mi.color};">${quantityLabel || '?'} ${escapeHtml(unit)}</strong>
                    </div>
                </div>
            </div>
            <div style="font-size:11px; color:#9ca3af; display:flex; align-items:center; gap:4px; margin-top:10px;">
                <span class="material-icons-round" style="font-size:14px;">info</span>
                Vật tư sẽ được trừ khỏi kho sau khi chủ trang trại duyệt công việc
            </div>
        </div>` : '';

    const mediaHtml = `
        <div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px; margin-top:16px;">
            <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:16px; display:flex; align-items:center; gap:6px;">
                <span class="material-icons-round" style="font-size:18px; color:#2563eb;">attach_file</span>
                Hình ảnh / Video báo cáo <span style="color:#dc2626;">*</span>
            </div>
            <p style="font-size:12px; color:#9ca3af; margin:0 0 12px;">Thêm ít nhất 1 ảnh hoặc 1 video minh chứng công việc</p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div>
                    <div id="inline-img-dropzone" style="background:#f0fdf4; border:2px dashed #86efac; border-radius:12px; padding:20px; text-align:center; cursor:pointer; transition:border-color 0.2s, background 0.2s;"
                         onclick="document.getElementById('inline-image-input').click()"
                         onmouseenter="this.style.borderColor='#10b981'; this.style.background='#ecfdf5'"
                         onmouseleave="this.style.borderColor='#86efac'; this.style.background='#f0fdf4'">
                        <span class="material-icons-round" style="font-size:36px; color:#10b981;">photo_camera</span>
                        <p style="margin:6px 0 0; font-size:13px; font-weight:600; color:#15803d;">Chọn ảnh</p>
                        <p style="margin:2px 0 0; font-size:11px; color:#6b7280;">JPG, PNG</p>
                    </div>
                    <input type="file" id="inline-image-input" accept="image/*" class="hidden" onchange="onInlineImageSelected(event)" />
                    <div id="inline-img-preview" style="display:none; margin-top:8px; border-radius:10px; overflow:hidden; border:1px solid #e5e7eb; position:relative;">
                        <img id="inline-img-preview-img" src="" style="width:100%; max-height:180px; object-fit:cover;" />
                        <button onclick="removeInlineImage()" style="position:absolute; top:6px; right:6px; width:28px; height:28px; border-radius:50%; background:rgba(0,0,0,0.5); color:white; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                            <span class="material-icons-round" style="font-size:18px;">close</span>
                        </button>
                        <div style="padding:6px 10px; font-size:11px; color:#6b7280; background:#f9fafb;" id="inline-img-filename"></div>
                    </div>
                </div>
                <div>
                    <div id="inline-vid-dropzone" style="background:#eff6ff; border:2px dashed #93c5fd; border-radius:12px; padding:20px; text-align:center; cursor:pointer; transition:border-color 0.2s, background 0.2s;"
                         onclick="document.getElementById('inline-video-input').click()"
                         onmouseenter="this.style.borderColor='#3b82f6'; this.style.background='#dbeafe'"
                         onmouseleave="this.style.borderColor='#93c5fd'; this.style.background='#eff6ff'">
                        <span class="material-icons-round" style="font-size:36px; color:#3b82f6;">videocam</span>
                        <p style="margin:6px 0 0; font-size:13px; font-weight:600; color:#1e40af;">Chọn video</p>
                        <p style="margin:2px 0 0; font-size:11px; color:#6b7280;">MP4, MOV (tối đa 50MB)</p>
                    </div>
                    <input type="file" id="inline-video-input" accept="video/*" class="hidden" onchange="onInlineVideoSelected(event)" />
                    <div id="inline-vid-preview" style="display:none; margin-top:8px; border-radius:10px; overflow:hidden; border:1px solid #e5e7eb; position:relative;">
                        <video id="inline-vid-preview-el" src="" style="width:100%; max-height:180px; object-fit:cover;" controls></video>
                        <button onclick="removeInlineVideo()" style="position:absolute; top:6px; right:6px; width:28px; height:28px; border-radius:50%; background:rgba(0,0,0,0.5); color:white; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                            <span class="material-icons-round" style="font-size:18px;">close</span>
                        </button>
                        <div style="padding:6px 10px; font-size:11px; color:#6b7280; background:#f9fafb;" id="inline-vid-filename"></div>
                    </div>
                </div>
            </div>
        </div>`;

    return `${materialInfoHtml}${mediaHtml}`;
}

// ── Completed byproduct collection task view ──
function buildCompletedByproductTaskHtml(task, wfData) {
    const byproductName = wfData.byproductName || 'Sản phẩm phụ';
    const byproductUnit = wfData.byproductUnit || '';
    const estimated = wfData.estimatedQuantity || 0;
    const collected = wfData.collectedQuantity || 0;
    const byproductType = wfData.byproductType || 'NONE';

    const iconMap = { 'EGGS': 'egg_alt', 'MILK': 'water_drop', 'HONEY': 'emoji_nature', 'SILK': 'gesture' };
    const colorMap = { 'EGGS': '#f59e0b', 'MILK': '#3b82f6', 'HONEY': '#eab308', 'SILK': '#8b5cf6' };
    const icon = iconMap[byproductType] || 'eco';
    const color = colorMap[byproductType] || '#f59e0b';

    let html = `<div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px; margin-bottom:16px;">
        <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:16px; display:flex; align-items:center; gap:6px;">
            <span class="material-icons-round" style="font-size:18px; color:${color};">${icon}</span>
            Kết quả thu ${byproductName.toLowerCase()}
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
            <div style="background:${color}11; border-radius:12px; padding:14px; text-align:center;">
                <div style="font-size:12px; color:#6b7280; margin-bottom:4px;">Ước tính</div>
                <div style="font-size:20px; font-weight:700; color:${color};">${estimated}</div>
                <div style="font-size:11px; color:#9ca3af;">${byproductUnit}</div>
            </div>
            <div style="background:#f0fdf4; border-radius:12px; padding:14px; text-align:center;">
                <div style="font-size:12px; color:#6b7280; margin-bottom:4px;">Thực tế</div>
                <div style="font-size:20px; font-weight:700; color:#16a34a;">${collected}</div>
                <div style="font-size:11px; color:#9ca3af;">${byproductUnit}</div>
            </div>
        </div>`;

    // Server media
    const _apiOrigin = new URL(API_BASE).origin;
    const serverImageUrl = task.reportImageUrl ? (_apiOrigin + task.reportImageUrl) : null;
    const serverVideoUrl = task.reportVideoUrl ? (_apiOrigin + task.reportVideoUrl) : null;

    if (serverImageUrl || serverVideoUrl) {
        html += `<div style="font-size:13px; font-weight:600; color:#374151; margin-bottom:8px;">
            <span class="material-icons-round" style="font-size:16px; vertical-align:middle; color:#2563eb;">photo_camera</span> Minh chứng
        </div><div style="display:grid; grid-template-columns:${serverImageUrl && serverVideoUrl ? '1fr 1fr' : '1fr'}; gap:10px;">`;
        if (serverImageUrl) {
            html += `<div style="border-radius:12px; overflow:hidden; border:1px solid #e5e7eb;">
                <img src="${serverImageUrl}" style="width:100%; max-height:200px; object-fit:cover; cursor:pointer;" onclick="window.open('${serverImageUrl}','_blank')">
            </div>`;
        }
        if (serverVideoUrl) {
            html += `<div style="border-radius:12px; overflow:hidden; border:1px solid #e5e7eb;">
                <video src="${serverVideoUrl}" controls style="width:100%; max-height:200px; object-fit:cover;"></video>
            </div>`;
        }
        html += '</div>';
    }

    html += '</div>';
    return html;
}

// ── Byproduct collection report sections (worker reports collected quantity) ──
function buildByproductCollectionReportSections(task, wfData) {
    const byproductName = wfData.byproductName || 'Sản phẩm phụ';
    const byproductUnit = wfData.byproductUnit || '';
    const estimated = wfData.estimatedQuantity || 0;
    const byproductType = wfData.byproductType || 'NONE';

    const iconMap = { 'EGGS': 'egg_alt', 'MILK': 'water_drop', 'HONEY': 'emoji_nature', 'SILK': 'gesture' };
    const colorMap = { 'EGGS': '#f59e0b', 'MILK': '#3b82f6', 'HONEY': '#eab308', 'SILK': '#8b5cf6' };
    const icon = iconMap[byproductType] || 'eco';
    const color = colorMap[byproductType] || '#f59e0b';

    let html = `
    <div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px; margin-bottom:16px;">
        <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:16px; display:flex; align-items:center; gap:6px;">
            <span class="material-icons-round" style="font-size:18px; color:${color};">${icon}</span>
            Báo cáo thu ${byproductName.toLowerCase()}
        </div>

        ${estimated > 0 ? `
        <div style="background:${color}11; border:1px solid ${color}22; border-radius:10px; padding:12px 16px; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
            <span class="material-icons-round" style="color:${color}; font-size:20px;">lightbulb</span>
            <span style="font-size:13px; color:#374151;">Ước tính: ~<strong>${estimated} ${byproductUnit}</strong></span>
        </div>` : ''}

        <div style="margin-bottom:16px;">
            <label style="font-size:13px; font-weight:600; color:#374151; margin-bottom:6px; display:block;">
                <span class="material-icons-round" style="font-size:16px; vertical-align:middle; color:${color};">scale</span>
                Sản lượng thực tế thu được
            </label>
            <div style="display:flex; align-items:center; gap:8px;">
                <input type="number" id="byproduct-collected-qty" min="0" step="0.1"
                    placeholder="${estimated || '0'}"
                    style="flex:1; padding:12px 14px; border-radius:10px; border:1px solid #d1d5db; font-size:16px; font-weight:600;">
                <span style="font-size:14px; font-weight:600; color:#6b7280;">${byproductUnit}</span>
            </div>
        </div>`;

    // Media upload section
    html += `
        <div style="font-size:13px; font-weight:600; color:#374151; margin-bottom:8px;">
            <span class="material-icons-round" style="font-size:16px; vertical-align:middle; color:#2563eb;">photo_camera</span>
            Minh chứng (tùy chọn)
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <label style="cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:16px; border-radius:12px; border:2px dashed #d1d5db; background:#f9fafb; transition:all 0.2s; min-height:80px;"
                onmouseenter="this.style.borderColor='${color}'; this.style.background='${color}11'" onmouseleave="this.style.borderColor='#d1d5db'; this.style.background='#f9fafb'">
                <span class="material-icons-round" style="font-size:28px; color:#9ca3af;">add_a_photo</span>
                <span style="font-size:12px; color:#6b7280; margin-top:4px;">Chụp ảnh</span>
                <span id="inline-photo-name" style="font-size:10px; color:#059669; margin-top:2px; display:none;"></span>
                <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="handleByproductPhotoSelect(event)">
            </label>
            <label style="cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:16px; border-radius:12px; border:2px dashed #d1d5db; background:#f9fafb; transition:all 0.2s; min-height:80px;"
                onmouseenter="this.style.borderColor='#2563eb'; this.style.background='#eff6ff'" onmouseleave="this.style.borderColor='#d1d5db'; this.style.background='#f9fafb'">
                <span class="material-icons-round" style="font-size:28px; color:#9ca3af;">videocam</span>
                <span style="font-size:12px; color:#6b7280; margin-top:4px;">Quay video</span>
                <span id="inline-video-name" style="font-size:10px; color:#059669; margin-top:2px; display:none;"></span>
                <input type="file" accept="video/*" capture="environment" style="display:none;" onchange="handleByproductVideoSelect(event)">
            </label>
        </div>
    </div>`;

    return html;
}

// ── Inline media handlers ──
let _inlineImageBase64 = null;
let _inlineImageName = null;
let _inlineVideoBase64 = null;
let _inlineVideoName = null;

// Simple handlers for byproduct collection form (lighter than the standard ones)
function handleByproductPhotoSelect(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    _inlineImageName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        _inlineImageBase64 = e.target?.result;
        const nameEl = document.getElementById('inline-photo-name');
        if (nameEl) { nameEl.textContent = file.name; nameEl.style.display = 'block'; }
    };
    reader.readAsDataURL(file);
}
function handleByproductVideoSelect(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { showNotification('error', 'Lỗi', 'Video không được lớn hơn 50MB'); return; }
    _inlineVideoName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        _inlineVideoBase64 = e.target?.result;
        const nameEl = document.getElementById('inline-video-name');
        if (nameEl) { nameEl.textContent = file.name; nameEl.style.display = 'block'; }
    };
    reader.readAsDataURL(file);
}

function onInlineImageSelected(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    _inlineImageName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        _inlineImageBase64 = e.target?.result;
        const preview = document.getElementById('inline-img-preview');
        const img = document.getElementById('inline-img-preview-img');
        const fname = document.getElementById('inline-img-filename');
        if (img) img.src = _inlineImageBase64 || '';
        if (fname) fname.textContent = _inlineImageName;
        if (preview) preview.style.display = 'block';
        // Hide dropzone
        const dz = document.getElementById('inline-img-dropzone');
        if (dz) dz.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function removeInlineImage() {
    _inlineImageBase64 = null;
    _inlineImageName = null;
    const preview = document.getElementById('inline-img-preview');
    const input = document.getElementById('inline-image-input');
    const dz = document.getElementById('inline-img-dropzone');
    if (preview) preview.style.display = 'none';
    if (input) input.value = '';
    if (dz) dz.style.display = 'block';
}

function onInlineVideoSelected(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
        showNotification('error', 'Lỗi', 'Video không được lớn hơn 50MB');
        return;
    }
    _inlineVideoName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        _inlineVideoBase64 = e.target?.result;
        const preview = document.getElementById('inline-vid-preview');
        const vid = document.getElementById('inline-vid-preview-el');
        const fname = document.getElementById('inline-vid-filename');
        if (vid) vid.src = _inlineVideoBase64 || '';
        if (fname) fname.textContent = _inlineVideoName;
        if (preview) preview.style.display = 'block';
        const dz = document.getElementById('inline-vid-dropzone');
        if (dz) dz.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function removeInlineVideo() {
    _inlineVideoBase64 = null;
    _inlineVideoName = null;
    const preview = document.getElementById('inline-vid-preview');
    const input = document.getElementById('inline-video-input');
    const dz = document.getElementById('inline-vid-dropzone');
    if (preview) preview.style.display = 'none';
    if (input) input.value = '';
    if (dz) dz.style.display = 'block';
}

function toggleInlineMortalityDetail() {
    const qty = parseInt(document.getElementById('inline-mortality-qty')?.value) || 0;
    const detail = document.getElementById('inline-mortality-detail');
    if (detail) detail.style.display = qty > 0 ? 'block' : 'none';

    // Auto-calculate estimated loss from sell price
    if (qty > 0 && window._inlineSellPrice > 0) {
        const lossField = document.getElementById('inline-mortality-loss');
        if (lossField) {
            lossField.value = qty * window._inlineSellPrice;
        }
    }
}

// ── Field Crop Loss helpers ──
let _fieldLossMap = null;
let _fieldLossDrawnLayer = null;

function toggleFieldLossSection() {
    const cb = document.getElementById('inline-field-has-loss');
    const section = document.getElementById('inline-field-loss-section');
    if (!cb || !section) return;
    const show = cb.checked;
    section.style.display = show ? 'block' : 'none';
    window._inlineFieldHasLoss = show;
    if (show && !_fieldLossMap) {
        setTimeout(() => initFieldLossMap(), 200);
    }
}

function initFieldLossMap() {
    const container = document.getElementById('inline-field-loss-map');
    if (!container || _fieldLossMap) return;

    const fieldId = window._inlineFieldId;
    // Find the task to get field data
    let fieldData = null;
    if (workerTasksById) {
        for (const t of Object.values(workerTasksById)) {
            if (t.field && t.field.id === fieldId) { fieldData = t.field; break; }
        }
    }

    // Parse boundary coordinates
    let boundaryCoords = [];
    if (fieldData && fieldData.boundaryCoordinates) {
        try {
            const raw = typeof fieldData.boundaryCoordinates === 'string'
                ? JSON.parse(fieldData.boundaryCoordinates) : fieldData.boundaryCoordinates;
            if (Array.isArray(raw) && raw.length >= 3) {
                boundaryCoords = raw.map(c => Array.isArray(c) ? [c[0], c[1]] : [c.lat, c.lng]);
            }
        } catch (e) { console.error('Cannot parse field boundary:', e); }
    }

    // Default center (Ca Mau area)
    let center = [9.1767, 105.1524];
    let zoom = 16;
    if (boundaryCoords.length > 0) {
        const latSum = boundaryCoords.reduce((s, c) => s + c[0], 0);
        const lngSum = boundaryCoords.reduce((s, c) => s + c[1], 0);
        center = [latSum / boundaryCoords.length, lngSum / boundaryCoords.length];
    }

    _fieldLossMap = L.map(container, { zoomControl: true, attributionControl: false }).setView(center, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20 }).addTo(_fieldLossMap);

    // Draw field boundary polygon (green)
    if (boundaryCoords.length >= 3) {
        const fieldPoly = L.polygon(boundaryCoords, {
            color: '#16a34a', weight: 2, fillColor: '#86efac', fillOpacity: 0.15, dashArray: '6,4'
        }).addTo(_fieldLossMap);
        _fieldLossMap.fitBounds(fieldPoly.getBounds(), { padding: [20, 20] });
    }

    // Drawn items layer
    const drawnItems = new L.FeatureGroup();
    _fieldLossMap.addLayer(drawnItems);

    // Leaflet Draw control
    const drawControl = new L.Control.Draw({
        draw: {
            polygon: { allowIntersection: false, shapeOptions: { color: '#dc2626', weight: 2, fillColor: '#dc2626', fillOpacity: 0.3 } },
            polyline: false, circle: false, circlemarker: false, marker: false, rectangle: {
                shapeOptions: { color: '#dc2626', weight: 2, fillColor: '#dc2626', fillOpacity: 0.3 }
            }
        },
        edit: { featureGroup: drawnItems, remove: true }
    });
    _fieldLossMap.addControl(drawControl);

    // Handle drawn polygon
    _fieldLossMap.on(L.Draw.Event.CREATED, function (e) {
        // Remove previous drawn layer
        drawnItems.clearLayers();
        _fieldLossDrawnLayer = e.layer;
        drawnItems.addLayer(_fieldLossDrawnLayer);
        updateFieldLossArea(fieldData);
    });

    _fieldLossMap.on(L.Draw.Event.EDITED, function () {
        updateFieldLossArea(fieldData);
    });

    _fieldLossMap.on(L.Draw.Event.DELETED, function () {
        _fieldLossDrawnLayer = null;
        window._inlineFieldLossPolygon = null;
        window._inlineFieldLossAreaSqm = 0;
        const infoEl = document.getElementById('inline-field-loss-info');
        if (infoEl) infoEl.style.display = 'none';
    });

    // Fix map render after container visibility change
    setTimeout(() => _fieldLossMap.invalidateSize(), 300);
}

function calcPolygonAreaSqm(latlngs) {
    // Geodesic area calculation using the Shoelace formula with Haversine
    if (!latlngs || latlngs.length < 3) return 0;
    // Use L.GeometryUtil if available, otherwise manual calc
    if (L.GeometryUtil && L.GeometryUtil.geodesicArea) {
        return Math.abs(L.GeometryUtil.geodesicArea(latlngs));
    }
    // Manual spherical excess formula
    const RAD = Math.PI / 180;
    const R = 6378137; // Earth radius in meters
    let area = 0;
    const n = latlngs.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += (latlngs[j].lng - latlngs[i].lng) * RAD *
            (2 + Math.sin(latlngs[i].lat * RAD) + Math.sin(latlngs[j].lat * RAD));
    }
    area = Math.abs(area * R * R / 2);
    return area;
}

function updateFieldLossArea(fieldData) {
    if (!_fieldLossDrawnLayer) return;
    const latlngs = _fieldLossDrawnLayer.getLatLngs ? _fieldLossDrawnLayer.getLatLngs() : null;
    if (!latlngs) return;
    // Flatten for polygon (first ring)
    const ring = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
    const areaSqm = calcPolygonAreaSqm(ring);

    // Store polygon coordinates
    const polygonCoords = ring.map(ll => [ll.lat, ll.lng]);
    window._inlineFieldLossPolygon = polygonCoords;
    window._inlineFieldLossAreaSqm = areaSqm;

    // Calculate percentage and loss value
    const fieldAreaSqm = fieldData ? (Number(fieldData.areaSqm) || 0) : 0;
    const pct = fieldAreaSqm > 0 ? (areaSqm / fieldAreaSqm * 100) : 0;

    let lossValue = 0;
    if (fieldData && fieldData.currentCrop) {
        const yieldPerSqm = Number(fieldData.currentCrop.expectedYieldPerSqm) || 0;
        const pricePerKg = Number(fieldData.currentCrop.marketPricePerKg) || 0;
        lossValue = areaSqm * yieldPerSqm * pricePerKg;
    }

    // Update UI
    const infoEl = document.getElementById('inline-field-loss-info');
    const areaText = document.getElementById('inline-field-loss-area-text');
    const pctText = document.getElementById('inline-field-loss-pct-text');
    const valText = document.getElementById('inline-field-loss-value-text');

    if (infoEl) infoEl.style.display = 'flex';
    if (infoEl) infoEl.style.flexDirection = 'column';
    if (areaText) areaText.textContent = areaSqm < 10000
        ? `${areaSqm.toFixed(1)} m²`
        : `${(areaSqm / 10000).toFixed(3)} ha`;
    if (pctText) pctText.textContent = `(${pct.toFixed(1)}% diện tích)`;
    if (valText) valText.textContent = lossValue > 0
        ? `Ước tính thiệt hại: ${new Intl.NumberFormat('vi-VN').format(Math.round(lossValue))} ₫`
        : 'Chưa có thông tin giá cây trồng để tính thiệt hại';
}

function destroyFieldLossMap() {
    if (_fieldLossMap) {
        _fieldLossMap.remove();
        _fieldLossMap = null;
    }
    _fieldLossDrawnLayer = null;
    window._inlineFieldLossPolygon = null;
    window._inlineFieldLossAreaSqm = 0;
    window._inlineFieldHasLoss = false;
    window._inlineFieldId = null;
}

function openTaskDetail(taskId) {
    const task = workerTasksById && workerTasksById[taskId] ? workerTasksById[taskId] : null;
    if (!task) {
        showNotification('error', 'Lỗi', 'Không tìm thấy công việc.');
        return;
    }

    stopTaskCountdownTicker();

    document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
    const detailView = document.getElementById('view-task-detail');
    if (!detailView) return;
    detailView.classList.remove('hidden');

    document.getElementById('page-title').textContent = 'Chi tiết công việc';

    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
        item.classList.add('text-white/80', 'hover:bg-white/10');
    });

    const taskName = fixUtf8(task.name || '');
    const taskDesc = fixUtf8(task.description || '');
    const status = task.status ? String(task.status).toUpperCase() : 'PENDING';
    const priority = task.priority ? String(task.priority).toUpperCase() : 'NORMAL';

    const createdAtDate = parseTaskDateTime(task.createdAt);
    const createdAtLabel = createdAtDate ? createdAtDate.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

    const dueDateObj = parseTaskDateTime(task.dueDate);
    const dueLabel = dueDateObj ? dueDateObj.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Chưa đặt hạn';
    const dueMs = dueDateObj ? dueDateObj.getTime() : null;

    const ownerName = task.owner ? fixUtf8(task.owner.fullName || task.owner.email || 'Chủ trang trại') : 'N/A';
    const ownerAvatar = task.owner && task.owner.avatarUrl ? task.owner.avatarUrl : null;

    const locationLabel = task.field ? fixUtf8(task.field.name || 'Ruộng') : (task.pen ? fixUtf8(task.pen.name || 'Chuồng') : null);
    const locationType = task.field ? 'Ruộng' : (task.pen ? 'Chuồng' : null);
    const locationIcon = task.field ? 'grass' : (task.pen ? 'pets' : 'location_on');

    const completedAtDate = parseTaskDateTime(task.completedAt);
    const completedAtLabel = completedAtDate ? completedAtDate.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

    const salaryLabel = task.salary ? formatCurrency(Number(task.salary)) : null;
    let relatedItemName = task.relatedItem ? fixUtf8(task.relatedItem.name || '') : null;
    let quantityLabel = task.quantityRequired ? String(task.quantityRequired) : null;
    let quantityUnit = task.relatedItem ? (task.relatedItem.unit || '') : '';

    // Fall back to workflowData for livestock tasks
    if (!relatedItemName && task.workflowData) {
        try {
            const wf = typeof task.workflowData === 'string' ? JSON.parse(task.workflowData) : task.workflowData;
            if (wf.feedName) { relatedItemName = wf.feedName; quantityLabel = wf.amountKg ? String(wf.amountKg) : quantityLabel; quantityUnit = 'kg'; }
            else if (wf.vaccineName) { relatedItemName = wf.vaccineName; quantityUnit = 'liều'; }
            else if (wf.pesticideName) { relatedItemName = wf.pesticideName; }
        } catch (e) { /* ignore */ }
    }

    // Status config
    const statusConfig = {
        'COMPLETED': { icon: 'check_circle', label: 'Hoàn thành', color: '#16a34a', bg: '#f0fdf4' },
        'IN_PROGRESS': { icon: 'autorenew', label: 'Đang thực hiện', color: '#2563eb', bg: '#eff6ff' },
        'CANCELLED': { icon: 'cancel', label: 'Đã hủy', color: '#dc2626', bg: '#fef2f2' },
        'PENDING': { icon: 'pending', label: 'Chờ xử lý', color: '#d97706', bg: '#fffbeb' }
    };
    const sc = statusConfig[status] || statusConfig['PENDING'];

    // Priority config
    const priorityConfig = {
        'HIGH': { icon: 'priority_high', label: 'Cao', color: '#dc2626', bg: '#fef2f2' },
        'URGENT': { icon: 'warning', label: 'Khẩn cấp', color: '#dc2626', bg: '#fef2f2' },
        'LOW': { icon: 'low_priority', label: 'Thấp', color: '#16a34a', bg: '#f0fdf4' },
        'NORMAL': { icon: 'drag_handle', label: 'Bình thường', color: '#6b7280', bg: '#f3f4f6' }
    };
    const pc = priorityConfig[priority] || priorityConfig['NORMAL'];

    // Countdown
    let countdownHtml = '';
    if (dueMs && status !== 'COMPLETED' && status !== 'APPROVED') {
        const remaining = dueMs - Date.now();
        const countdownText = formatTaskCountdown(remaining);
        const isOverdue = remaining < 0;
        const isUrgent = remaining < 3600000;
        const cdColor = isOverdue ? '#dc2626' : (isUrgent ? '#d97706' : '#2563eb');
        const cdBg = isOverdue ? '#fef2f2' : (isUrgent ? '#fffbeb' : '#eff6ff');
        countdownHtml = `
            <div style="background:${cdBg}; border-radius:16px; padding:20px; margin-top:16px; border:1px solid ${cdColor}22;">
                <div style="display:flex; align-items:center; gap:8px; color:${cdColor}; font-weight:600; font-size:14px;">
                    <span class="material-icons-round" style="font-size:20px;">timer</span>
                    ${isOverdue ? 'Đã quá hạn' : 'Thời gian còn lại'}
                </div>
                <div class="task-countdown" data-due-ms="${dueMs}" style="font-size:28px; font-weight:800; color:${cdColor}; margin-top:4px;">
                    <span class="task-countdown-text">${countdownText}</span>
                </div>
            </div>
        `;
    }

    // Owner avatar HTML
    const ownerAvatarHtml = ownerAvatar
        ? `<img src="${ownerAvatar}" alt="" style="width:44px; height:44px; border-radius:50%; object-fit:cover; border:2px solid #e5e7eb;">`
        : `<div style="width:44px; height:44px; border-radius:50%; background:#dbeafe; color:#2563eb; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:16px; border:2px solid #e5e7eb;">${escapeHtml((ownerName || 'O').charAt(0).toUpperCase())}</div>`;

    detailView.innerHTML = `
        <div style="max-width:900px; margin:0 auto;">
            <!-- Breadcrumb -->
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:20px; font-size:14px; color:#6b7280;">
                <button onclick="closeTaskDetail()" style="display:flex; align-items:center; gap:4px; background:none; border:none; cursor:pointer; color:#6b7280; font-size:14px; padding:0; transition:color 0.2s;"
                        onmouseenter="this.style.color='#059669'" onmouseleave="this.style.color='#6b7280'">
                    <span class="material-icons-round" style="font-size:18px;">arrow_back</span> Công việc
                </button>
                <span style="color:#d1d5db;">›</span>
                <span style="color:#111827; font-weight:600;">${escapeHtml(taskName)}</span>
            </div>

            <!-- Header Card -->
            <div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:24px; margin-bottom:16px;">
                <div style="display:flex; align-items:flex-start; gap:16px;">
                    <div style="width:56px; height:56px; border-radius:14px; background:linear-gradient(135deg, #ecfdf5, #d1fae5); color:#059669; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <span class="material-icons-round" style="font-size:28px;">${getTaskIcon(task.taskType)}</span>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <h2 style="margin:0 0 4px; font-size:22px; font-weight:800; color:#111827;">${escapeHtml(taskName)}</h2>
                        <span style="font-size:13px; color:#6b7280;">${getTaskTypeLabel(task.taskType)}</span>
                    </div>
                </div>
            </div>

            <!-- Stat Cards Row -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; margin-bottom:16px;">
                <div style="background:white; border-radius:12px; border:1px solid #e5e7eb; padding:16px; text-align:center;">
                    <span class="material-icons-round" style="font-size:24px; color:${sc.color};">${sc.icon}</span>
                    <div style="font-size:16px; font-weight:700; color:${sc.color}; margin-top:4px;">${sc.label}</div>
                    <div style="font-size:11px; color:#9ca3af; margin-top:2px;">Trạng thái</div>
                </div>
                <div style="background:white; border-radius:12px; border:1px solid #e5e7eb; padding:16px; text-align:center;">
                    <span class="material-icons-round" style="font-size:24px; color:${pc.color};">${pc.icon}</span>
                    <div style="font-size:16px; font-weight:700; color:${pc.color}; margin-top:4px;">${pc.label}</div>
                    <div style="font-size:11px; color:#9ca3af; margin-top:2px;">Ưu tiên</div>
                </div>
                <div style="background:white; border-radius:12px; border:1px solid #e5e7eb; padding:16px; text-align:center;">
                    <span class="material-icons-round" style="font-size:24px; color:#d97706;">schedule</span>
                    <div style="font-size:14px; font-weight:700; color:#111827; margin-top:4px;">${dueLabel}</div>
                    <div style="font-size:11px; color:#9ca3af; margin-top:2px;">Hạn hoàn thành</div>
                </div>
                ${salaryLabel ? `
                <div style="background:white; border-radius:12px; border:1px solid #e5e7eb; padding:16px; text-align:center;">
                    <span class="material-icons-round" style="font-size:24px; color:#059669;">payments</span>
                    <div style="font-size:16px; font-weight:700; color:#059669; margin-top:4px;">${salaryLabel}</div>
                    <div style="font-size:11px; color:#9ca3af; margin-top:2px;">Thù lao</div>
                </div>
                ` : ''}
                ${completedAtLabel ? `
                <div style="background:white; border-radius:12px; border:1px solid #e5e7eb; padding:16px; text-align:center;">
                    <span class="material-icons-round" style="font-size:24px; color:#16a34a;">verified</span>
                    <div style="font-size:14px; font-weight:700; color:#16a34a; margin-top:4px;">${completedAtLabel}</div>
                    <div style="font-size:11px; color:#9ca3af; margin-top:2px;">Hoàn thành lúc</div>
                </div>
                ` : ''}
            </div>

            <!-- Info Grid -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
                <!-- Người giao việc -->
                <div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px;">
                    <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">Người giao việc</div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        ${ownerAvatarHtml}
                        <div>
                            <div style="font-weight:700; color:#111827; font-size:15px;">${escapeHtml(ownerName)}</div>
                            <div style="font-size:13px; color:#6b7280;">Giao lúc ${createdAtLabel}</div>
                        </div>
                    </div>
                </div>

                <!-- Khu vực -->
                <div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px;">
                    <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">Khu vực thực hiện</div>
                    ${locationLabel ? `
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:44px; height:44px; border-radius:12px; background:#f5f3ff; color:#7c3aed; display:flex; align-items:center; justify-content:center;">
                            <span class="material-icons-round" style="font-size:22px;">${locationIcon}</span>
                        </div>
                        <div>
                            <div style="font-weight:700; color:#111827; font-size:15px;">${escapeHtml(locationLabel)}</div>
                            <div style="font-size:13px; color:#6b7280;">${locationType}</div>
                        </div>
                    </div>
                    ` : `<div style="color:#9ca3af; font-size:14px;">Không chỉ định</div>`}
                </div>
            </div>

            <!-- Description (filter AI: lines) -->
            ${(() => {
            const cleanDesc = (taskDesc || '').split('\n').filter(l => !l.startsWith('AI:')).join('\n').trim();
            return cleanDesc ? `
                <div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px; margin-bottom:16px;">
                    <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">Mô tả công việc</div>
                    <p style="margin:0; color:#374151; line-height:1.7; white-space:pre-wrap;">${escapeHtml(cleanDesc)}</p>
                </div>` : '';
        })()}

            <!-- Related Item & Additional Info -->
            ${relatedItemName || quantityLabel ? `
            <div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px; margin-bottom:16px;">
                <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">Vật tư liên quan</div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:44px; height:44px; border-radius:12px; background:#fefce8; color:#ca8a04; display:flex; align-items:center; justify-content:center;">
                        <span class="material-icons-round" style="font-size:22px;">inventory_2</span>
                    </div>
                    <div>
                        <div style="font-weight:700; color:#111827; font-size:15px;">${escapeHtml(relatedItemName || '')}</div>
                        ${quantityLabel ? `<div style="font-size:13px; color:#6b7280;">Số lượng: ${quantityLabel}${quantityUnit ? ' ' + escapeHtml(quantityUnit) : ''}</div>` : ''}
                    </div>
                </div>
            </div>
            ` : ''}

            ${buildWorkerInspectionResultsHtml(task)}

            ${countdownHtml}

            ${status !== 'COMPLETED' && status !== 'APPROVED' ? buildInlineReportSections(task) : ''}

            <!-- Action Buttons -->
            ${status !== 'COMPLETED' && status !== 'APPROVED' ? `
            <div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px; margin-top:16px;">
                <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:16px;">Hành động</div>
                <div id="inline-report-error" class="hidden" style="margin-bottom:12px; padding:10px 14px; border-radius:10px; background:#fef2f2; border:1px solid #fecaca; color:#dc2626; font-size:13px; font-weight:500;"></div>
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;" onclick="event.stopPropagation()">
                    ${getWorkLogActionBlock(task)}
                    <button onclick="completeTask(${task.id})" style="display:flex; align-items:center; gap:8px; padding:10px 24px; background:linear-gradient(135deg, #10b981, #059669); color:white; border:none; border-radius:12px; cursor:pointer; font-weight:600; font-size:14px; box-shadow:0 4px 12px rgba(16,185,129,0.3); transition:transform 0.2s, box-shadow 0.2s;"
                            onmouseenter="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 16px rgba(16,185,129,0.4)'"
                            onmouseleave="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(16,185,129,0.3)'">
                        <span class="material-icons-round" style="font-size:20px;">done</span> Hoàn thành công việc
                    </button>
                </div>
            </div>
            ` : `
            <div style="background:${status === 'APPROVED' ? '#f5f3ff' : '#f0fdf4'}; border-radius:16px; border:1px solid ${status === 'APPROVED' ? '#e9d5ff' : '#bbf7d0'}; padding:20px; margin-top:16px; text-align:center;">
                <span class="material-icons-round" style="font-size:48px; color:${status === 'APPROVED' ? '#9333ea' : '#16a34a'};">${status === 'APPROVED' ? 'verified' : 'task_alt'}</span>
                <div style="font-size:18px; font-weight:700; color:${status === 'APPROVED' ? '#9333ea' : '#16a34a'}; margin-top:8px;">${status === 'APPROVED' ? 'Công việc đã được duyệt' : 'Công việc đã báo cáo hoàn thành'}</div>
                ${completedAtLabel ? `<div style="font-size:14px; color:${status === 'APPROVED' ? '#7e22ce' : '#15803d'}; margin-top:4px;">Lúc ${completedAtLabel}</div>` : ''}
            </div>
            `}
        </div>
    `;

    animateViewTransition('view-task-detail');
    if (dueMs && status !== 'COMPLETED') startTaskCountdownTicker();
}

function getStatusBadgeWorker(status) {
    const s = status ? String(status).toUpperCase() : '';
    if (s === 'COMPLETED') return '<span class="inline-flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-full bg-green-100 text-green-700"><span class="material-icons-round text-sm">check_circle</span>Hoàn thành</span>';
    if (s === 'IN_PROGRESS') return '<span class="inline-flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-full bg-blue-100 text-blue-700"><span class="material-icons-round text-sm">autorenew</span>Đang làm</span>';
    if (s === 'CANCELLED') return '<span class="inline-flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-full bg-red-100 text-red-700"><span class="material-icons-round text-sm">cancel</span>Đã hủy</span>';
    return '<span class="inline-flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-700"><span class="material-icons-round text-sm">pending</span>Chờ xử lý</span>';
}

function closeTaskDetail() {
    switchTab('tasks');
}

function formatCurrency(amount) {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('vi-VN').format(num) + ' VNĐ';
}

function getWeatherIconIcon(main) {
    const icons = {
        'Clear': 'sunny', 'Clouds': 'cloud', 'Rain': 'rainy',
        'Drizzle': 'grain', 'Thunderstorm': 'thunderstorm',
        'Snow': 'ac_unit', 'Mist': 'mist', 'Fog': 'foggy'
    };
    return icons[main] || 'sunny';
}

function hideTaskTypeTabs() {
    const tabs = Array.from(document.querySelectorAll('.task-tab'));
    if (tabs.length === 0) return;

    tabs.forEach(t => {
        t.style.display = 'none';
        t.disabled = true;
    });

    const wrapper = tabs[0] ? tabs[0].parentElement : null;
    if (wrapper) {
        wrapper.style.display = 'none';
    }

    currentTaskType = 'ALL';
}

function parseTaskDateTime(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

function getTaskPriorityRank(priority) {
    const p = priority != null ? String(priority).toUpperCase() : 'NORMAL';
    if (p === 'HIGH') return 3;
    if (p === 'NORMAL') return 2;
    if (p === 'LOW') return 1;
    return 0;
}

function getPriorityShortLabel(priority) {
    const p = priority != null ? String(priority).toUpperCase() : 'NORMAL';
    if (p === 'HIGH') return 'CAO';
    if (p === 'LOW') return 'THẤP';
    return 'THƯỜNG';
}

function getPriorityLabel(priority) {
    const p = priority != null ? String(priority).toUpperCase() : 'NORMAL';
    if (p === 'HIGH') return 'Ưu tiên cao';
    if (p === 'LOW') return 'Ưu tiên thấp';
    return 'Ưu tiên thường';
}

function getPriorityBadgeClass(priority) {
    const p = priority != null ? String(priority).toUpperCase() : 'NORMAL';
    if (p === 'HIGH') return 'bg-red-50 text-red-700 border-red-200';
    if (p === 'LOW') return 'bg-gray-50 text-gray-600 border-gray-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
}

function formatTaskDueDate(dueMs) {
    if (dueMs == null) return '';
    const d = new Date(Number(dueMs));
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatTaskCountdown(msRemaining) {
    if (msRemaining == null || Number.isNaN(msRemaining)) return '';
    const overdue = msRemaining < 0;
    const absSeconds = Math.max(0, Math.floor(Math.abs(msRemaining) / 1000));
    const days = Math.floor(absSeconds / 86400);
    const hours = Math.floor((absSeconds % 86400) / 3600);
    const minutes = Math.floor((absSeconds % 3600) / 60);
    const seconds = absSeconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days} ngày`);
    if (hours > 0) parts.push(`${hours} giờ`);

    if (minutes > 0 || (days === 0 && hours === 0)) {
        parts.push(`${minutes} phút`);
    }

    if (days === 0 && hours === 0) {
        parts.push(`${seconds} giây`);
    }

    const text = parts.join(' ');
    return overdue ? `Quá hạn ${text}` : `Còn ${text}`;
}

function updateTaskCountdownElements() {
    const elements = document.querySelectorAll('.task-countdown');
    if (!elements.length) return;

    const now = Date.now();
    const classesToClear = [
        'bg-red-50', 'text-red-700', 'border-red-200',
        'bg-yellow-50', 'text-yellow-700', 'border-yellow-200',
        'bg-green-50', 'text-green-700', 'border-green-200'
    ];

    elements.forEach(el => {
        const dueMs = el && el.dataset ? Number(el.dataset.dueMs) : NaN;
        if (!dueMs || Number.isNaN(dueMs)) return;

        const remaining = dueMs - now;
        const textEl = el.querySelector('.task-countdown-text');
        if (textEl) {
            textEl.textContent = formatTaskCountdown(remaining);
        }

        el.classList.remove(...classesToClear);
        if (remaining < 0) {
            el.classList.add('bg-red-50', 'text-red-700', 'border-red-200');
            return;
        }

        if (remaining <= 2 * 60 * 60 * 1000) {
            el.classList.add('bg-yellow-50', 'text-yellow-700', 'border-yellow-200');
            return;
        }

        el.classList.add('bg-green-50', 'text-green-700', 'border-green-200');
    });
}

function startTaskCountdownTicker() {
    stopTaskCountdownTicker();
    updateTaskCountdownElements();
    taskCountdownIntervalId = window.setInterval(updateTaskCountdownElements, 1000);
}

function stopTaskCountdownTicker() {
    if (taskCountdownIntervalId == null) return;
    clearInterval(taskCountdownIntervalId);
    taskCountdownIntervalId = null;
}

function sortWorkerTasks(tasks) {
    const list = Array.isArray(tasks) ? [...tasks] : [];
    list.sort((a, b) => {
        const aStatus = a && a.status ? String(a.status).toUpperCase() : '';
        const bStatus = b && b.status ? String(b.status).toUpperCase() : '';

        const aCompleted = aStatus === 'COMPLETED';
        const bCompleted = bStatus === 'COMPLETED';
        if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;

        const aDue = parseTaskDateTime(a && a.dueDate ? a.dueDate : null);
        const bDue = parseTaskDateTime(b && b.dueDate ? b.dueDate : null);
        const aDueMs = aDue ? aDue.getTime() : null;
        const bDueMs = bDue ? bDue.getTime() : null;
        const aHasDue = aDueMs != null;
        const bHasDue = bDueMs != null;

        if (aHasDue !== bHasDue) return aHasDue ? -1 : 1;
        if (aHasDue && bHasDue && aDueMs !== bDueMs) return aDueMs - bDueMs;

        const aPriority = getTaskPriorityRank(a && a.priority ? a.priority : null);
        const bPriority = getTaskPriorityRank(b && b.priority ? b.priority : null);
        if (aPriority !== bPriority) return bPriority - aPriority;

        const statusRank = s => {
            if (s === 'IN_PROGRESS') return 3;
            if (s === 'PENDING') return 2;
            if (s === 'APPROVED') return 1;
            if (s === 'CANCELLED') return 0;
            return 0;
        };
        const aStatusRank = statusRank(aStatus);
        const bStatusRank = statusRank(bStatus);
        if (aStatusRank !== bStatusRank) return bStatusRank - aStatusRank;

        const aCreated = parseTaskDateTime(a && a.createdAt ? a.createdAt : null);
        const bCreated = parseTaskDateTime(b && b.createdAt ? b.createdAt : null);
        const aCreatedMs = aCreated ? aCreated.getTime() : null;
        const bCreatedMs = bCreated ? bCreated.getTime() : null;
        if (aCreatedMs != null && bCreatedMs != null && aCreatedMs !== bCreatedMs) return aCreatedMs - bCreatedMs;

        return 0;
    });
    return list;
}

function getTaskTypeLabel(type) {
    const map = {
        'FEED': 'Cho ăn', 'CLEAN': 'Vệ sinh', 'HARVEST': 'Thu hoạch',
        'BUY_SUPPLIES': 'Mua vật tư', 'PLANT': 'Gieo trồng', 'SEED': 'Gieo trồng',
        'FERTILIZE': 'Bón phân', 'WATER': 'Tưới nước', 'PEST_CONTROL': 'Phòng trừ sâu',
        'VACCINATE': 'Tiêm phòng', 'SELL': 'Bán', 'INSPECTION': 'Kiểm tra', 'OTHER': 'Khác'
    };
    return map[type] || type;
}

function getTaskIcon(type) {
    const map = {
        FEED: 'restaurant',
        CLEAN: 'cleaning_services',
        HARVEST: 'agriculture',
        BUY_SUPPLIES: 'shopping_cart',
        PLANT: 'grass',
        SEED: 'grass',
        FERTILIZE: 'science',
        WATER: 'water_drop',
        PEST_CONTROL: 'bug_report',
        VACCINATE: 'vaccines',
        SELL: 'sell',
        INSPECTION: 'search',
        OTHER: 'assignment'
    };
    return map[type] || 'assignment';
}

async function ensureWorkerOwnerId() {
    if (workerOwnerId != null) return workerOwnerId;
    if (workerFarmId == null) return null;
    try {
        const farms = await fetchAPI(`${API_BASE}/farms`);
        const farm = (farms || []).find(f => String(f.id) === String(workerFarmId));
        workerOwnerId = farm ? farm.ownerId : null;
    } catch (e) {
        workerOwnerId = null;
    }
    return workerOwnerId;
}

async function loadHelpRequests() {
    if (!workerId) return;

    const listEl = document.getElementById('help-requests-list');
    const countEl = document.getElementById('help-requests-count');
    if (listEl) {
        listEl.innerHTML = '<div class="p-10 text-center text-gray-500">Đang tải...</div>';
    }

    try {
        const data = await fetchAPI(`${API_BASE}/help/worker/${workerId}`);
        const requests = Array.isArray(data) ? data : [];

        if (countEl) countEl.textContent = String(requests.length);

        if (!listEl) return;
        if (requests.length === 0) {
            listEl.innerHTML = '<div class="p-10 text-center text-gray-500">Chưa có yêu cầu nào.</div>';
            return;
        }

        listEl.innerHTML = requests.map(r => {
            const status = (r.status || 'OPEN').toUpperCase();
            const badge = status === 'RESPONDED'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : status === 'CLOSED'
                    ? 'bg-gray-50 text-gray-600 border-gray-200'
                    : 'bg-yellow-50 text-yellow-700 border-yellow-200';
            const statusLabel = status === 'RESPONDED' ? 'Đã phản hồi' : status === 'CLOSED' ? 'Đã đóng' : 'Đang mở';
            const createdAt = r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '';
            const title = r.title ? escapeHtml(r.title) : 'Yêu cầu hỗ trợ';
            const message = r.message ? escapeHtml(r.message) : '';
            const ownerResponse = r.ownerResponse ? escapeHtml(r.ownerResponse) : '';

            return `
                <div class="p-5">
                    <div class="flex items-start justify-between gap-4">
                        <div class="min-w-0">
                            <div class="font-semibold text-gray-800 truncate">${title}</div>
                            <div class="text-xs text-gray-500 mt-1">${createdAt}</div>
                        </div>
                        <span class="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${badge}">${statusLabel}</span>
                    </div>
                    <div class="mt-3 text-sm text-gray-700 whitespace-pre-wrap">${message}</div>
                    ${ownerResponse ? `
                        <div class="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
                            <div class="text-xs font-semibold text-green-700 mb-1">Phản hồi từ chủ trang trại</div>
                            <div class="text-sm text-green-900 whitespace-pre-wrap">${ownerResponse}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        if (typeof gsap !== 'undefined') {
            gsap.fromTo('#help-requests-list > div', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.05, ease: 'power2.out' });
        }
    } catch (e) {
        if (countEl) countEl.textContent = '0';
        if (listEl) {
            listEl.innerHTML = '<div class="p-10 text-center text-red-500">Không thể tải dữ liệu.</div>';
        }
    }
}

async function submitHelpRequest(e) {
    e.preventDefault();
    if (!workerId) return;

    const statusEl = document.getElementById('help-form-status');
    const titleEl = document.getElementById('help-title');
    const messageEl = document.getElementById('help-message');

    const title = titleEl ? titleEl.value.trim() : '';
    const message = messageEl ? messageEl.value.trim() : '';

    if (!message) {
        if (statusEl) {
            statusEl.textContent = 'Vui lòng nhập nội dung.';
            statusEl.classList.remove('hidden');
        }
        return;
    }

    if (statusEl) {
        statusEl.textContent = 'Đang gửi...';
        statusEl.classList.remove('hidden');
    }

    const ownerId = await ensureWorkerOwnerId();
    if (!ownerId) {
        if (statusEl) statusEl.textContent = 'Không xác định được chủ trang trại.';
        return;
    }

    try {
        await fetchAPI(`${API_BASE}/help`, 'POST', {
            ownerId,
            workerId,
            farmId: workerFarmId,
            title: title || null,
            message
        });

        if (titleEl) titleEl.value = '';
        if (messageEl) messageEl.value = '';

        if (statusEl) statusEl.textContent = 'Đã gửi yêu cầu.';

        loadHelpRequests();

        if (typeof gsap !== 'undefined' && statusEl) {
            gsap.fromTo(statusEl, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' });
        }
    } catch (err) {
        if (statusEl) statusEl.textContent = 'Gửi thất bại. Vui lòng thử lại.';
    }
}

async function refreshActiveWorkLogs() {
    if (!workerId) {
        activeWorkLogsByTaskId = {};
        return;
    }
    try {
        const logs = await fetchAPI(`${API_BASE}/worklogs/worker/${workerId}`);
        const active = {};
        (Array.isArray(logs) ? logs : []).forEach(l => {
            if (!l || l.endedAt) return;
            const taskId = l.task && l.task.id ? l.task.id : null;
            if (taskId != null) {
                active[taskId] = l;
            }
        });
        activeWorkLogsByTaskId = active;
    } catch (e) {
        activeWorkLogsByTaskId = {};
    }
}

function getWorkLogActionBlock(task) {
    if (!task || task.id == null) return '';
    if (task.status === 'COMPLETED' || task.status === 'APPROVED' || task.status === 'CANCELLED') return '';

    // If task is already IN_PROGRESS, show it's active
    if (task.status === 'IN_PROGRESS') {
        return `
            <div class="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-medium cursor-default">
                <span class="material-icons-round">motion_photos_on</span> Đang thực hiện
            </div>
        `;
    }

    // For PENDING status, allow worker to start
    return `
        <button onclick="startTaskProgress(${task.id})" class="flex items-center gap-2 px-4 py-2 bg-white border border-primary text-primary rounded-lg hover:bg-green-50 transition-colors font-medium">
            <span class="material-icons-round">play_circle</span> Đang tiến hành
        </button>
    `;
}

async function startTaskProgress(taskId) {
    if (!workerId) return;
    try {
        await fetchAPI(`${API_BASE}/tasks/${taskId}/start`, 'POST');
        if (typeof agriAlert === 'function') agriAlert('Đã bắt đầu thực hiện công việc!', 'success');
        await loadTasksList();
        
        // Re-open detail view if viewing it
        const detailView = document.getElementById('view-task-detail');
        if (detailView && !detailView.classList.contains('hidden')) {
            openTaskDetail(taskId);
        }
    } catch (e) {
        if (typeof agriAlert === 'function') {
            agriAlert('Lỗi: ' + (e.message || 'Không thể bắt đầu công việc'), 'error');
        } else {
            alert('Lỗi: ' + (e.message || 'Không thể bắt đầu công việc'));
        }
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getToken() {
    return localStorage.getItem('token') || localStorage.getItem('authToken') || '';
}

function applyDarkModePreference(enabled) {
    document.documentElement.classList.toggle('dark', Boolean(enabled));
    document.documentElement.setAttribute('data-theme', enabled ? 'dark' : 'light');
    localStorage.setItem('darkMode', Boolean(enabled));
}

function ensureDarkModeStyles() {
    if (document.getElementById('worker-dark-mode-styles')) return;

    const style = document.createElement('style');
    style.id = 'worker-dark-mode-styles';
    style.textContent = `
html.dark body{background-color:#111827 !important;color:#f3f4f6;}
html.dark main{background-color:#111827 !important;}
html.dark header{background-color:#111827 !important;border-color:#374151 !important;}
html.dark .bg-white{background-color:#1f2937 !important;}
html.dark .bg-gray-50{background-color:#111827 !important;}
html.dark .bg-gray-100{background-color:#374151 !important;}
html.dark .border-gray-100{border-color:#374151 !important;}
html.dark .border-gray-200{border-color:#4b5563 !important;}
html.dark .divide-gray-100 > :not([hidden]) ~ :not([hidden]){border-color:#374151 !important;}
html.dark .text-gray-800{color:#f3f4f6 !important;}
html.dark .text-gray-700{color:#e5e7eb !important;}
html.dark .text-gray-600{color:#d1d5db !important;}
html.dark .text-gray-500{color:#9ca3af !important;}
`;
    document.head.appendChild(style);
}

function updateAvatarDisplay(avatarUrl, fallbackChar = 'W') {
    const workerAvatarEl = document.getElementById('worker-avatar');
    const profileAvatarEl = document.getElementById('profile-avatar');

    [workerAvatarEl, profileAvatarEl].forEach(el => {
        if (!el) return;
        if (avatarUrl) {
            el.textContent = '';
            el.style.backgroundImage = `url('${avatarUrl}')`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.style.backgroundRepeat = 'no-repeat';
        } else {
            el.style.backgroundImage = '';
            el.textContent = fallbackChar;
        }
    });
}

async function loadBalance() {
    const email = localStorage.getItem('userEmail');
    if (!email) return;

    try {
        const res = await fetch(`${API_BASE}/assets/balance?email=${encodeURIComponent(email)}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        const balance = data.balance != null ? Number(data.balance) : 0;

        const headerBalanceEl = document.getElementById('worker-balance');
        if (headerBalanceEl) headerBalanceEl.textContent = formatCurrency(balance);

        const totalBalanceEl = document.getElementById('total-balance');
        if (totalBalanceEl) totalBalanceEl.textContent = formatCurrency(balance);
    } catch (e) {
        console.error('Error loading balance', e);
    }
}
