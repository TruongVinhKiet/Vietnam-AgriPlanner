const API_BASE = CONFIG.API_BASE_URL || 'http://localhost:8080/api';
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
    if (tab === 'help') loadHelpRequests();
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
            gsap.fromTo(cards,
                { opacity: 0, y: 15 },
                { opacity: 1, y: 0, duration: 0.3, stagger: 0.05, delay: 0.1, ease: 'power2.out' }
            );
        }
    }
}

// ================= API CALLS =================

async function fetchAPI(url, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
    };
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    if (!res.ok) throw new Error('API Error');
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

    } catch (e) {
        console.error('Error loading profile', e);
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
        const data = await res.json();

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
        console.error('Weather error filter', e);
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
            const createdAt = t && t.createdAt ? String(t.createdAt) : '';
            const status = t && t.status ? String(t.status).toUpperCase() : '';
            return createdAt.startsWith(today) || status === 'PENDING' || status === 'IN_PROGRESS';
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
                            <div class="text-sm font-medium text-gray-800">${task.name}</div>
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

        const sorted = sortWorkerTasks(Array.isArray(tasks) ? tasks : []);

        if (sorted.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                     <span class="material-icons-round text-4xl text-gray-300 mb-2">assignment_turned_in</span>
                     <p class="text-gray-500">Không có công việc nào.</p>
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

            const countdownBlock = dueMs != null && status !== 'COMPLETED'
                ? `
                    <div class="task-countdown inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border" data-due-ms="${dueMs}">
                        <span class="material-icons-round text-sm">schedule</span>
                        <span class="task-countdown-text"></span>
                    </div>
                  `
                : '';

            container.innerHTML += `
                <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 items-start task-card">
                    <div class="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                        <span class="material-icons-round text-2xl">${icon}</span>
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start">
                            <h4 class="font-bold text-gray-800 text-lg">${task.name}</h4>
                            <span class="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded font-medium">${getTaskTypeLabel(task.taskType)}</span>
                        </div>
                        <p class="text-gray-600 text-sm mt-1">${task.description || 'Không có mô tả'}</p>
                        
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
                    
                    <div class="self-center flex flex-col gap-2">
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
        container.innerHTML = '<div class="text-center py-8 text-red-500">Lỗi tải dữ liệu</div>';
        stopTaskCountdownTicker();
    }
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
    const inspectionInfo = getInspectionTaskInfo(task);
    if (inspectionInfo) {
        openInspectionCompletionModal(task, inspectionInfo);
        return;
    }

    if (!confirm('Xác nhận hoàn thành công việc?')) return;

    // Optimistic UI update could happen here, but reloading for safety
    try {
        await stopActiveWorkLogIfNeeded(taskId);

        // We use existing Execute Endpoint or a simple status update
        // Current API has /api/tasks/{id}/execute for Shopping, but maybe we need generic complete
        // Use the existing complete endpoint
        await fetchAPI(`${API_BASE}/tasks/${taskId}/complete`, 'POST');

        // Refresh
        loadHomeData();
        loadTasksList();
        loadUserProfile(); // Update balance if salary paid? (Not yet implemented auto-pay on task complete, usually periodic)
    } catch (e) {
        alert('Lỗi: ' + e.message);
    }
}

function getInspectionTaskInfo(task) {
    if (!task) return null;
    const taskType = task.taskType != null ? String(task.taskType).toUpperCase() : '';
    if (taskType !== 'OTHER') return null;

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

    inspectionModalContext = { taskId: task.id, kind: info.kind };
    inspectionSelectedImageBase64 = null;
    inspectionSelectedFileName = null;
    inspectionAiSuggestedValue = null;
    inspectionAiSuggestionText = null;

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

                <div id="inspection-complete-error" class="hidden p-3 rounded-lg bg-red-50 text-red-600 text-sm"></div>
            </div>

            <div class="mt-6 flex justify-end gap-3">
                <button type="button" class="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50" onclick="closeModal('inspection-complete-modal')">Hủy</button>
                <button id="inspection-complete-btn" type="button" class="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark" onclick="submitInspectionCompletion(${task.id})">Hoàn thành</button>
            </div>
        </div>
    `);
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

    if (errorEl) errorEl.classList.add('hidden');

    if (!condition) {
        if (errorEl) {
            errorEl.textContent = 'Vui lòng chọn tình trạng.';
            errorEl.classList.remove('hidden');
        }
        return;
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

        await fetchAPI(`${API_BASE}/tasks/${taskId}/complete`, 'POST', payload);

        closeModal('inspection-complete-modal');
        showNotification('success', 'Thành công', 'Đã hoàn thành kiểm tra');

        loadHomeData();
        loadTasksList();
        loadUserProfile();
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
    notif.innerHTML = `
        <div style="font-weight:700; margin-bottom:4px;">${title}</div>
        <div style="font-size:13px; opacity:0.95;">${message}</div>
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
        'VACCINATE': 'Tiêm phòng', 'SELL': 'Bán', 'OTHER': 'Khác'
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
    if (task.status === 'COMPLETED') return '';

    const log = activeWorkLogsByTaskId[task.id];
    if (log && !log.endedAt) {
        const startedAt = log.startedAt ? new Date(log.startedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
        return `
            <div class="flex flex-col gap-1">
                <button onclick="stopWorkLog(${task.id})" class="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors font-medium">
                    <span class="material-icons-round">stop_circle</span> Dừng chấm công
                </button>
                ${startedAt ? `<div class="text-xs text-red-600 text-center">Bắt đầu: ${startedAt}</div>` : ''}
            </div>
        `;
    }

    return `
        <button onclick="startWorkLog(${task.id})" class="flex items-center gap-2 px-4 py-2 bg-white border border-primary text-primary rounded-lg hover:bg-green-50 transition-colors font-medium">
            <span class="material-icons-round">play_circle</span> Bắt đầu chấm công
        </button>
    `;
}

async function startWorkLog(taskId) {
    if (!workerId) return;
    try {
        const log = await fetchAPI(`${API_BASE}/worklogs/start`, 'POST', { taskId, workerId });
        activeWorkLogsByTaskId[taskId] = log;
        loadTasksList();
    } catch (e) {
        alert('Lỗi: ' + (e.message || 'Không thể bắt đầu chấm công'));
    }
}

async function stopWorkLog(taskId) {
    if (!workerId) return;
    try {
        const log = await fetchAPI(`${API_BASE}/worklogs/stop`, 'POST', { taskId, workerId });
        if (log && log.endedAt) {
            delete activeWorkLogsByTaskId[taskId];
        }
        loadTasksList();
    } catch (e) {
        alert('Lỗi: ' + (e.message || 'Không thể dừng chấm công'));
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
