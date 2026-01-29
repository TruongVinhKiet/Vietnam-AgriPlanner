const LABOR_API_BASE = CONFIG.API_BASE_URL || 'http://localhost:8080/api';

// Global variable for farm ID
let myFarmId = null;
let approvedWorkers = []; // List of approved workers
let payrollSettingsByWorkerId = {};
let payrollModalWorkerId = null;
let workerDetailWorkerId = null;
let workerDetailDailyChart = null;
let workerDetailMonthlyChart = null;

document.addEventListener('DOMContentLoaded', () => {
    const page = document && document.body && document.body.dataset ? document.body.dataset.page : null;
    if (page !== 'labor') return;
    loadTasks();
    loadRecruitmentInfo();
    initializeFarmId();
});

// ==================== Toast Notification ====================
function showToast(title, message, type = 'info') {
    // Remove existing toast
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const colors = {
        success: { bg: '#ecfdf5', border: '#10b981', text: '#065f46', icon: 'check_circle' },
        error: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b', icon: 'error' },
        info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af', icon: 'info' },
        warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', icon: 'warning' }
    };
    const c = colors[type] || colors.info;

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10001;
        background: ${c.bg}; border: 1px solid ${c.border}; border-left: 4px solid ${c.border};
        padding: 16px 20px; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        display: flex; align-items: center; gap: 12px; max-width: 400px;
        animation: slideInRight 0.3s ease;
    `;
    toast.innerHTML = `
        <span class="material-symbols-outlined" style="color: ${c.border}; font-size: 24px;">${c.icon}</span>
        <div>
            <strong style="color: ${c.text}; display: block;">${title}</strong>
            <span style="color: ${c.text}; font-size: 14px; opacity: 0.9;">${message}</span>
        </div>
        <button onclick="this.parentElement.remove()" style="margin-left: auto; background: none; border: none; cursor: pointer; padding: 4px;">
            <span class="material-symbols-outlined" style="color: ${c.text}; font-size: 20px;">close</span>
        </button>
    `;
    
    // Add animation keyframes
    if (!document.getElementById('toast-animation-style')) {
        const style = document.createElement('style');
        style.id = 'toast-animation-style';
        style.textContent = `@keyframes slideInRight { from { opacity: 0; transform: translateX(100px); } to { opacity: 1; transform: translateX(0); } }`;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }
    }, 4000);
}

function openWorkerDetailPage(workerId) {
    if (workerId == null) {
        window.location.href = 'worker_detail.html';
        return;
    }
    const wid = Number(workerId);
    if (!Number.isFinite(wid)) {
        window.location.href = 'worker_detail.html';
        return;
    }
    window.location.href = `worker_detail.html?workerId=${encodeURIComponent(String(wid))}`;
}

// ==================== Confirm Modal Utility ====================
function showConfirmModal(title, message, onConfirm, confirmText = 'Xác nhận', cancelText = 'Hủy') {
    // Remove existing modal if any
    const existing = document.getElementById('confirm-modal-overlay');
    if (existing) existing.remove();

    const modalHtml = `
        <div id="confirm-modal-overlay" style="
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); display: flex; align-items: center;
            justify-content: center; z-index: 10000; animation: fadeIn 0.2s ease;
        ">
            <div style="
                background: white; padding: 28px; border-radius: 16px;
                max-width: 400px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                animation: slideUp 0.2s ease;
            ">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                    <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #fbbf24, #f59e0b); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                        <span class="material-symbols-outlined" style="color: white; font-size: 24px;">help</span>
                    </div>
                    <h3 style="margin: 0; color: #1f2937; font-size: 18px;">${title}</h3>
                </div>
                <p style="color: #6b7280; margin-bottom: 24px; line-height: 1.6;">${message}</p>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button id="confirm-modal-cancel" style="
                        padding: 10px 20px; border: 1px solid #e5e7eb; background: white;
                        border-radius: 8px; cursor: pointer; font-weight: 500; color: #6b7280;
                    ">${cancelText}</button>
                    <button id="confirm-modal-ok" style="
                        padding: 10px 20px; border: none; background: linear-gradient(135deg, #10b981, #059669);
                        color: white; border-radius: 8px; cursor: pointer; font-weight: 600;
                    ">${confirmText}</button>
                </div>
            </div>
        </div>
        <style>
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        </style>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('confirm-modal-cancel').onclick = () => {
        document.getElementById('confirm-modal-overlay').remove();
    };
    document.getElementById('confirm-modal-ok').onclick = () => {
        document.getElementById('confirm-modal-overlay').remove();
        if (onConfirm) onConfirm();
    };
}

// ==================== CV Detail Modal ====================
function showCVDetailModal(application) {
    const existing = document.getElementById('cv-detail-modal');
    if (existing) existing.remove();

    const modalHtml = `
        <div id="cv-detail-modal" style="
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); display: flex; align-items: center;
            justify-content: center; z-index: 10000; animation: fadeIn 0.2s ease;
        ">
            <div style="
                background: white; padding: 0; border-radius: 16px;
                max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                animation: slideUp 0.2s ease; overflow: hidden;
            ">
                <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; color: white;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <div style="width: 64px; height: 64px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                <span class="material-symbols-outlined" style="font-size: 32px;">person</span>
                            </div>
                            <div>
                                <h3 style="margin: 0; font-size: 20px;">${application.fullName || 'Ứng viên'}</h3>
                                <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 14px;">${application.email || ''}</p>
                            </div>
                        </div>
                        <button onclick="document.getElementById('cv-detail-modal').remove()" style="
                            background: rgba(255,255,255,0.2); border: none; width: 32px; height: 32px;
                            border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;
                        ">
                            <span class="material-symbols-outlined" style="color: white; font-size: 20px;">close</span>
                        </button>
                    </div>
                </div>
                <div style="padding: 24px;">
                    <div style="margin-bottom: 20px;">
                        <label style="display: flex; align-items: center; gap: 8px; color: #6b7280; font-size: 13px; margin-bottom: 8px;">
                            <span class="material-symbols-outlined" style="font-size: 18px;">phone</span>
                            Số điện thoại
                        </label>
                        <p style="margin: 0; color: #1f2937; font-weight: 500;">${application.phone || 'Chưa cung cấp'}</p>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label style="display: flex; align-items: center; gap: 8px; color: #6b7280; font-size: 13px; margin-bottom: 8px;">
                            <span class="material-symbols-outlined" style="font-size: 18px;">description</span>
                            Hồ sơ / Kinh nghiệm
                        </label>
                        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
                            <p style="margin: 0; color: #374151; white-space: pre-wrap; line-height: 1.6;">${application.cvProfile || 'Chưa có thông tin CV'}</p>
                        </div>
                    </div>
                    <div>
                        <label style="display: flex; align-items: center; gap: 8px; color: #6b7280; font-size: 13px; margin-bottom: 8px;">
                            <span class="material-symbols-outlined" style="font-size: 18px;">calendar_today</span>
                            Ngày nộp hồ sơ
                        </label>
                        <p style="margin: 0; color: #1f2937;">${application.createdAt ? new Date(application.createdAt).toLocaleDateString('vi-VN') : 'N/A'}</p>
                    </div>
                </div>
                <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; gap: 12px; justify-content: flex-end;">
                    <button onclick="document.getElementById('cv-detail-modal').remove(); rejectApplication(${application.id})" style="
                        padding: 10px 20px; border: 1px solid #ef4444; background: white;
                        color: #ef4444; border-radius: 8px; cursor: pointer; font-weight: 500;
                    ">
                        <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle;">close</span>
                        Từ chối
                    </button>
                    <button onclick="document.getElementById('cv-detail-modal').remove(); approveApplication(${application.id})" style="
                        padding: 10px 20px; border: none; background: linear-gradient(135deg, #10b981, #059669);
                        color: white; border-radius: 8px; cursor: pointer; font-weight: 600;
                    ">
                        <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle;">check</span>
                        Duyệt nhân công
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Initialize farm ID for current user
async function initializeFarmId() {
    try {
        const farms = await fetchAPI(`${LABOR_API_BASE}/farms/my-farms`);
        if (farms && farms.length > 0) {
            myFarmId = farms[0].id;
        }
    } catch (e) {
        console.warn('Could not initialize farm ID:', e);
    }
}

// ============ TASKS LOGIC ============

async function loadTasks() {
    try {
        const ownerId = await getCurrentUserId();
        if (!ownerId) {
            console.warn("Cannot identify Owner ID");
            return;
        }

        await ensureFarmId();
        await ensureApprovedWorkersForAssignment();

        const res = await fetchAPI(`${LABOR_API_BASE}/tasks/owner/${ownerId}`);
        // Filter Tasks Created Today or Due Today
        const today = new Date().toISOString().split('T')[0];
        const todaysTasks = res.filter(t => {
            const created = t.createdAt ? t.createdAt.split('T')[0] : '';
            const active = t.status !== 'COMPLETED' && t.status !== 'CANCELLED';
            const completedToday = t.status === 'COMPLETED' && t.completedAt && t.completedAt.startsWith(today);

            // Show if created today OR active OR completed today
            return created === today || active || completedToday;
        });

        renderTasks(todaysTasks);
    } catch (e) {
        console.error('Error loading tasks:', e);
        const container = document.querySelector('#tasks-tab .card__body');
        if (container) container.innerHTML = '<p style="text-align:center; color:red">Không thể tải danh sách công việc. Vui lòng thử lại sau.</p>';
    }
}

function renderTasks(tasks) {
    const container = document.querySelector('#tasks-tab .card__body');
    if (!container) return;

    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; color: #6b7280;"><span class="material-symbols-outlined" style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;">assignment_turned_in</span><p>Không có công việc nào trong hôm nay.</p></div>';
        return;
    }

    let html = `
    <table class="w-full text-left border-collapse">
        <thead>
            <tr class="text-sm text-gray-500 border-b border-gray-200">
                <th class="py-3 font-medium">Tên công việc</th>
                <th class="py-3 font-medium">Người thực hiện</th>
                <th class="py-3 font-medium">Loại</th>
                <th class="py-3 font-medium">Hạn</th>
                <th class="py-3 font-medium">Trạng thái</th>
                <th class="py-3 font-medium">Hoàn thành lúc</th>
                <th class="py-3 font-medium">Phân công</th>
            </tr>
        </thead>
        <tbody class="text-sm text-gray-800 divide-y divide-gray-100">
    `;

    tasks.forEach(task => {
        let completedTime = '--';
        let statusBadge = getStatusBadge(task.status);

        const dueText = task.dueDate
            ? new Date(task.dueDate).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
            : '--';

        const isAutoCreated = task.isAutoCreated === true;
        const workerId = task.worker && task.worker.id != null ? Number(task.worker.id) : null;
        const ownerId = task.owner && task.owner.id != null ? Number(task.owner.id) : null;
        const isSelf = workerId != null && ownerId != null && workerId === ownerId;
        const displayWorkerName = task.worker
            ? (task.worker.fullName || task.worker.email || 'Nhân công')
            : (isAutoCreated ? 'Chưa phân công' : 'Tôi (Tự làm)');

        const avatarChar = task.worker
            ? (displayWorkerName || 'N').charAt(0)
            : (isAutoCreated ? '?' : 'T');

        if (task.status === 'COMPLETED') {
            statusBadge = `<div class="flex items-center gap-1 text-green-600 font-bold"><span class="material-symbols-outlined">check_circle</span> Hoàn thành</div>`;
            if (task.completedAt) {
                const date = new Date(task.completedAt);
                completedTime = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            }
        }

        let assignBlock = '--';
        if (task.status !== 'COMPLETED' && task.status !== 'CANCELLED') {
            let selected = '';
            if (isSelf) {
                selected = 'SELF';
            } else if (workerId != null) {
                selected = String(workerId);
            } else {
                selected = isAutoCreated ? '' : 'SELF';
            }

            let options = '';
            options += `<option value="" ${selected === '' ? 'selected' : ''}>-- Chưa phân công --</option>`;
            options += `<option value="SELF" ${selected === 'SELF' ? 'selected' : ''}>-- Tôi tự làm --</option>`;

            if (Array.isArray(approvedWorkers) && approvedWorkers.length > 0) {
                approvedWorkers.forEach(w => {
                    const wid = w && w.id != null ? String(w.id) : null;
                    if (!wid) return;
                    const label = escapeHtml(w.fullName || w.email || `Worker#${wid}`);
                    options += `<option value="${wid}" ${selected === wid ? 'selected' : ''}>${label}</option>`;
                });
            }

            assignBlock = `
                <div style="display:flex; gap:8px; align-items:center;">
                    <select id="assign-worker-${task.id}" class="modal-input" style="padding: 6px 10px; margin-top: 0; font-size: 12px; min-width: 170px;">
                        ${options}
                    </select>
                    <button class="btn btn--secondary" style="padding: 6px 12px; font-size: 12px;" onclick="quickAssignTask(${task.id})">
                        Lưu
                    </button>
                </div>
            `;
        }

        html += `
            <tr>
                <td class="py-3">
                    <p class="font-semibold" style="color: var(--color-text-primary);">${task.name}</p>
                    <p class="text-xs text-gray-500 truncate" style="max-width: 200px;">${task.description || ''}</p>
                </td>
                <td class="py-3">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-full ${task.worker ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'} flex items-center justify-center text-xs font-bold ring-2 ring-white">
                            ${escapeHtml(avatarChar)}
                        </div>
                        <span class="font-medium text-sm">${escapeHtml(displayWorkerName)}</span>
                    </div>
                </td>
                 <td class="py-3">
                    <span class="px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-600">
                        ${getTaskTypeLabel(task.taskType)}
                    </span>
                </td>
                <td class="py-3 text-gray-500 text-sm font-medium">
                    ${escapeHtml(dueText)}
                </td>
                <td class="py-3">
                    ${statusBadge}
                </td>
                <td class="py-3 text-gray-500 text-sm font-medium">
                    ${completedTime}
                </td>
                <td class="py-3">
                    ${assignBlock}
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// ... (Recruitment Logic omitted for brevity, keeping existing) ...

// ============ ASSIGN TASK MODAL LOGIC ============
let workersList = [];
let inventoryList = [];
let fieldsList = [];
let pensList = [];

async function openAssignTaskModal() {
    // 1. Fetch Workers
    try {
        const res = await fetchAPI(`${LABOR_API_BASE}/user/list?role=WORKER`);
        workersList = res || [];
    } catch (e) {
        workersList = [];
    }

    // 2. Fetch Shop Items
    try {
        const shopRes = await fetchAPI(`${LABOR_API_BASE}/shop/items`);
        inventoryList = shopRes;
    } catch (e) { }

    // 3. Fetch Locations (Cultivation/Livestock)
    try {
        if (myFarmId) {
            // Fetch Fields
            const fieldsRes = await fetchAPI(`${LABOR_API_BASE}/fields?farmId=${myFarmId}`);
            fieldsList = fieldsRes || [];

            // Fetch Pens
            const pensRes = await fetchAPI(`${LABOR_API_BASE}/livestock/pens?farmId=${myFarmId}`);
            pensList = pensRes || [];
        }
    } catch (e) {
        console.warn('Could not fetch locations', e);
    }

    // 4. Populate Modal
    populateWorkerSelect();
    populateItemSelect();
    populateLocationSelect();

    // 5. Show Modal
    const modal = document.getElementById('assign-task-modal');
    modal.classList.add('open');
    modal.style.display = 'flex';
}

function populateLocationSelect() {
    const select = document.getElementById('task-target-location');
    const fieldsGroup = document.getElementById('optgroup-fields');
    const pensGroup = document.getElementById('optgroup-pens');

    // Reset options but keep default and groups
    fieldsGroup.innerHTML = '';
    pensGroup.innerHTML = '';
    select.value = "";

    if (fieldsList.length === 0) {
        fieldsGroup.innerHTML = '<option disabled>Không có ruộng</option>';
    } else {
        fieldsList.forEach(f => {
            const option = document.createElement('option');
            option.value = `FIELD:${f.id}`;
            option.textContent = f.name;
            fieldsGroup.appendChild(option);
        });
    }

    if (pensList.length === 0) {
        pensGroup.innerHTML = '<option disabled>Không có chuồng</option>';
    } else {
        pensList.forEach(p => {
            const option = document.createElement('option');
            option.value = `PEN:${p.id}`;
            option.textContent = `${p.code} (${p.farmingType})`;
            pensGroup.appendChild(option);
        });
    }
}

function populateWorkerSelect() {
    const select = document.getElementById('task-worker');
    select.innerHTML = '<option value="">-- Chọn nhân công --</option>';

    // Add Self Option
    // We need current User ID.
    // Since getCurrentUserId is async, we might not have it instantly in sync rendering.
    // But we can fetch it. for now let's just add option value="SELF" and handle in submit.
    select.innerHTML += `<option value="SELF" style="font-weight:bold; color: var(--color-primary);">-- Chủ trang trại (Tôi tự làm) --</option>`;

    if (workersList.length > 0) {
        workersList.forEach(w => {
            select.innerHTML += `<option value="${w.id}">${w.fullName || w.email} (${w.email})</option>`;
        });
    }
}

// ... (Item Select Logic omitted for brevity, keeping existing) ...

async function submitAssignTask(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerText = 'Đang xử lý...';

    const ownerId = await getCurrentUserId();
    if (!myFarmId) {
        try {
            const farms = await fetchAPI(`${LABOR_API_BASE}/farms/my-farms`);
            if (farms && farms.length > 0) myFarmId = farms[0].id;
        } catch (e) { }
    }

    // Validation
    const workerId = document.getElementById('task-worker').value;
    if (!workerId) {
        alert("Vui lòng chọn người thực hiện!");
        submitBtn.disabled = false;
        submitBtn.innerText = 'Giao việc';
        return;
    }

    const locationValue = document.getElementById('task-target-location').value;
    let fieldId = null;
    let penId = null;
    if (locationValue) {
        const [type, id] = locationValue.split(':');
        if (type === 'FIELD') fieldId = parseInt(id);
        if (type === 'PEN') penId = parseInt(id);
    }

    const payload = {
        farmId: myFarmId || 1,
        ownerId: ownerId,
        workerId: workerId === 'SELF' ? null : workerId,
        name: document.getElementById('task-name').value,
        description: document.getElementById('task-desc').value,
        priority: document.getElementById('task-priority').value,
        taskType: document.getElementById('task-type').value,
        relatedShopItemId: document.getElementById('task-related-item').value || null,
        quantityRequired: document.getElementById('task-quantity').value || 0,
        salary: document.getElementById('task-salary').value || 0,
        dueDate: document.getElementById('task-due-date').value || null,
        fieldId: fieldId,
        penId: penId
    };

    try {
        await fetchAPI(`${LABOR_API_BASE}/tasks`, 'POST', payload);
        alert("Giao việc thành công!");
        closeAssignTaskModal();
        loadTasks(); // Reload list
        e.target.reset();
    } catch (error) {
        alert("Lỗi: " + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-symbols-outlined">check</span> Giao việc';
    }
}


// ============ UTILS ============

function getTaskTypeLabel(type) {
    const map = {
        'FEED': 'Cho ăn',
        'CLEAN': 'Vệ sinh',
        'HARVEST': 'Thu hoạch',
        'BUY_SUPPLIES': 'Mua vật tư',
        'PLANT': 'Gieo trồng',
        'SEED': 'Gieo giống',
        'FERTILIZE': 'Bón phân',
        'WATER': 'Tưới nước',
        'PEST_CONTROL': 'Trừ sâu',
        'VACCINATE': 'Tiêm phòng',
        'SELL': 'Bán',
        'OTHER': 'Khác'
    };
    return map[type] || type;
}

function getStatusBadge(status) {
    const styles = {
        'PENDING': 'bg-yellow-100 text-yellow-800',
        'IN_PROGRESS': 'bg-blue-100 text-blue-800',
        'APPROVED': 'bg-indigo-100 text-indigo-800',
        'COMPLETED': 'bg-green-100 text-green-800',
        'CANCELLED': 'bg-gray-100 text-gray-800'
    };
    const labels = {
        'PENDING': 'Chờ nhận việc',
        'IN_PROGRESS': 'Đang thực hiện',
        'APPROVED': 'Đã duyệt',
        'COMPLETED': 'Hoàn thành',
        'CANCELLED': 'Đã hủy'
    };
    return `<span class="px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles['PENDING']}">${labels[status] || status}</span>`;
}

async function getCurrentUserId() {
    const email = localStorage.getItem('userEmail');
    if (!email) return null;

    // CHANGED: Use /profile endpoint
    try {
        const res = await fetchAPI(`${LABOR_API_BASE}/user/profile?email=${encodeURIComponent(email)}`);
        return res ? res.id : null;
    } catch (e) {
        console.error("Error fetching user ID", e);
        return null;
    }
}

async function fetchAPI(url, method = 'GET', body = null) {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token'); // Try both keys
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch (e) {
        data = text ? { message: text } : null;
    }
    if (!res.ok) {
        throw new Error((data && (data.message || data.error)) || text || 'API Error');
    }
    return data;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

async function ensureFarmId() {
    if (myFarmId) return myFarmId;
    try {
        const farms = await fetchAPI(`${LABOR_API_BASE}/farms/my-farms`);
        if (farms && farms.length > 0) {
            myFarmId = farms[0].id;
            return myFarmId;
        }
    } catch (e) {
        console.warn('Could not ensure farm ID:', e);
    }
    return null;
}

async function ensureApprovedWorkersForAssignment() {
    if (Array.isArray(approvedWorkers) && approvedWorkers.length > 0) {
        return approvedWorkers;
    }
    const farmId = await ensureFarmId();
    if (!farmId) {
        approvedWorkers = [];
        return approvedWorkers;
    }
    try {
        const workers = await fetchAPI(`${LABOR_API_BASE}/user/list?role=WORKER&farmId=${farmId}`);
        approvedWorkers = workers || [];
    } catch (e) {
        approvedWorkers = [];
    }
    return approvedWorkers;
}

async function quickAssignTask(taskId) {
    try {
        const ownerId = await getCurrentUserId();
        if (!ownerId) {
            throw new Error('Không xác định được chủ trang trại');
        }

        const selectEl = document.getElementById(`assign-worker-${taskId}`);
        if (!selectEl) {
            throw new Error('Không tìm thấy lựa chọn nhân công');
        }

        const selected = selectEl.value;
        let workerId = null;
        if (selected === 'SELF') {
            workerId = ownerId;
        } else if (selected && selected.trim() !== '') {
            workerId = Number(selected);
        }

        await fetchAPI(`${LABOR_API_BASE}/tasks/${taskId}/assign`, 'PUT', {
            ownerId: ownerId,
            workerId: workerId
        });

        showToast && showToast('Thành công', 'Đã cập nhật phân công', 'success');
        loadTasks();
    } catch (e) {
        showToast && showToast('Lỗi', e.message || 'Không thể cập nhật phân công', 'error');
    }
}

async function loadOwnerHelpRequests() {
    const container = document.getElementById('owner-help-requests');
    if (!container) return;

    container.innerHTML = `
        <div class="loading-spinner" style="text-align: center; padding: 3rem;">
            <span class="material-symbols-outlined" style="font-size: 48px; color: #d1d5db; animation: pulse 2s infinite;">chat</span>
            <p style="color: #6b7280; margin-top: 12px;">Đang tải phản hồi...</p>
        </div>
    `;

    try {
        const ownerId = await getCurrentUserId();
        if (!ownerId) {
            throw new Error('Không xác định được chủ trang trại');
        }

        const items = await fetchAPI(`${LABOR_API_BASE}/help/owner/${ownerId}`);
        const list = Array.isArray(items) ? items : [];

        if (list.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #6b7280;">
                    <div style="width: 80px; height: 80px; background: #f3f4f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                        <span class="material-symbols-outlined" style="font-size: 40px; color: #9ca3af;">chat</span>
                    </div>
                    <h4 style="margin: 0 0 8px 0; color: #374151;">Chưa có phản hồi nào</h4>
                    <p style="margin: 0; font-size: 14px;">Khi nhân công gửi yêu cầu hỗ trợ, bạn sẽ thấy ở đây.</p>
                </div>
            `;
            return;
        }

        const statusBadge = (statusRaw) => {
            const status = (statusRaw || 'OPEN').toUpperCase();
            if (status === 'CLOSED') return { bg: '#f1f5f9', border: '#e2e8f0', text: '#475569', label: 'Đã đóng' };
            if (status === 'RESPONDED') return { bg: '#ecfdf5', border: '#bbf7d0', text: '#166534', label: 'Đã trả lời' };
            return { bg: '#fffbeb', border: '#fde68a', text: '#92400e', label: 'Mới' };
        };

        container.innerHTML = `
            <div style="display: grid; gap: 16px;">
                ${list.map(h => {
                    const badge = statusBadge(h.status);
                    const workerName = h.worker && (h.worker.fullName || h.worker.email) ? (h.worker.fullName || h.worker.email) : 'Nhân công';
                    const workerEmail = h.worker && h.worker.email ? h.worker.email : '';
                    const createdAt = h.createdAt ? new Date(h.createdAt).toLocaleString('vi-VN') : '';
                    const respondedAt = h.respondedAt ? new Date(h.respondedAt).toLocaleString('vi-VN') : '';
                    const closedAt = h.closedAt ? new Date(h.closedAt).toLocaleString('vi-VN') : '';
                    const title = h.title ? escapeHtml(h.title) : 'Yêu cầu hỗ trợ';
                    const message = h.message ? escapeHtml(h.message) : '';
                    const ownerResponse = h.ownerResponse ? escapeHtml(h.ownerResponse) : '';
                    const isClosed = String(h.status || '').toUpperCase() === 'CLOSED';

                    return `
                        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px;">
                            <div style="display:flex; justify-content: space-between; gap: 12px; align-items: flex-start;">
                                <div style="min-width: 0;">
                                    <div style="display:flex; align-items:center; gap:10px; flex-wrap: wrap;">
                                        <div style="font-weight: 700; color:#111827;">${title}</div>
                                        <span style="font-size: 12px; font-weight: 700; padding: 2px 10px; border-radius: 999px; background: ${badge.bg}; border: 1px solid ${badge.border}; color: ${badge.text};">${badge.label}</span>
                                    </div>
                                    <div style="margin-top: 6px; font-size: 13px; color:#6b7280; display:flex; gap: 14px; flex-wrap: wrap;">
                                        <span>${escapeHtml(workerName)}${workerEmail ? ` (${escapeHtml(workerEmail)})` : ''}</span>
                                        ${createdAt ? `<span>Gửi lúc: ${escapeHtml(createdAt)}</span>` : ''}
                                    </div>
                                </div>
                            </div>

                            <div style="margin-top: 12px; background:#f9fafb; border: 1px solid #e5e7eb; padding: 12px; border-radius: 10px; color:#374151; white-space: pre-wrap;">${message}</div>

                            ${ownerResponse ? `
                                <div style="margin-top: 12px; background:#eff6ff; border: 1px solid #bfdbfe; padding: 12px; border-radius: 10px; color:#1e40af; white-space: pre-wrap;">
                                    <div style="font-weight: 700; margin-bottom: 6px;">Phản hồi của bạn</div>
                                    <div>${ownerResponse}</div>
                                    ${respondedAt ? `<div style=\"margin-top: 8px; font-size: 12px; color:#64748b;\">Trả lời lúc: ${escapeHtml(respondedAt)}</div>` : ''}
                                </div>
                            ` : ''}

                            ${isClosed ? (closedAt ? `<div style="margin-top: 10px; font-size: 12px; color:#64748b;">Đóng lúc: ${escapeHtml(closedAt)}</div>` : '') : `
                                <div style="margin-top: 12px; display:flex; flex-direction: column; gap: 10px;">
                                    <textarea id="owner-help-response-${h.id}" class="modal-input" rows="3" placeholder="Nhập phản hồi cho nhân công..." style="margin-top: 0;">${h.ownerResponse ? escapeHtml(h.ownerResponse) : ''}</textarea>
                                    <div style="display:flex; gap: 10px; justify-content: flex-end;">
                                        <button class="btn btn--secondary" onclick="closeOwnerHelpRequest(${h.id})">
                                            <span class="material-symbols-outlined">close</span> Đóng
                                        </button>
                                        <button class="btn btn--primary" onclick="respondOwnerHelpRequest(${h.id})">
                                            <span class="material-symbols-outlined">send</span> Gửi phản hồi
                                        </button>
                                    </div>
                                </div>
                            `}
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        if (typeof gsap !== 'undefined') {
            gsap.fromTo('#owner-help-requests > div > div', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.04, ease: 'power2.out' });
        }
    } catch (e) {
        container.innerHTML = `<p style="text-align:center; color:red">${escapeHtml(e.message || 'Không thể tải phản hồi')}</p>`;
    }
}

async function respondOwnerHelpRequest(helpId) {
    try {
        const input = document.getElementById(`owner-help-response-${helpId}`);
        const text = input ? String(input.value || '').trim() : '';
        if (!text) {
            throw new Error('Vui lòng nhập phản hồi');
        }
        await fetchAPI(`${LABOR_API_BASE}/help/${helpId}/respond`, 'PUT', {
            ownerResponse: text,
            status: 'RESPONDED'
        });
        showToast && showToast('Thành công', 'Đã gửi phản hồi', 'success');
        loadOwnerHelpRequests();
    } catch (e) {
        showToast && showToast('Lỗi', e.message || 'Không thể gửi phản hồi', 'error');
    }
}

async function closeOwnerHelpRequest(helpId) {
    showConfirmModal('Đóng phản hồi', 'Bạn có chắc muốn đóng phản hồi này không?', async () => {
        try {
            await fetchAPI(`${LABOR_API_BASE}/help/${helpId}/close`, 'PUT');
            showToast && showToast('Thành công', 'Đã đóng phản hồi', 'success');
            loadOwnerHelpRequests();
        } catch (e) {
            showToast && showToast('Lỗi', e.message || 'Không thể đóng phản hồi', 'error');
        }
    }, 'Đóng', 'Hủy');
}

function getPayrollSummaryBlock(setting) {
    if (!setting) {
        return `
            <div style="background: #f3f4f6; border: 1px solid #e5e7eb; padding: 8px 12px; border-radius: 8px;">
                <span style="font-size: 12px; color: #6b7280;">Chưa có cấu hình lương</span>
            </div>
        `;
    }

    const salaryAmount = setting.salaryAmount != null ? Number(setting.salaryAmount) : 0;
    const payFrequency = setting.payFrequency ? String(setting.payFrequency).toUpperCase() : 'MONTHLY';
    const payDay = setting.payDayOfMonth != null ? Number(setting.payDayOfMonth) : null;
    const payDayOfWeek = setting.payDayOfWeek != null ? Number(setting.payDayOfWeek) : null;
    const isActive = setting.isActive !== false;
    const lastPaidAt = setting.lastPaidAt ? new Date(setting.lastPaidAt).toLocaleDateString('vi-VN') : null;

    const dowLabels = ['', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
    const dowLabel = payDayOfWeek != null && payDayOfWeek >= 1 && payDayOfWeek <= 7
        ? dowLabels[payDayOfWeek]
        : 'Thứ 2';

    const scheduleLabel = payFrequency === 'DAILY'
        ? 'Hàng ngày'
        : payFrequency === 'WEEKLY'
            ? `Hàng tuần - ${dowLabel}`
            : `Hàng tháng - ${payDay != null ? `Ngày ${payDay}` : 'N/A'}`;

    const statusBg = isActive ? '#dcfce7' : '#f1f5f9';
    const statusBorder = isActive ? '#bbf7d0' : '#e2e8f0';
    const statusText = isActive ? '#166534' : '#475569';
    const statusLabel = isActive ? 'Đang bật' : 'Tạm dừng';

    return `
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 8px 12px; border-radius: 8px;">
            <span style="font-size: 12px; color: #1e40af;">Lương: <strong>${formatCurrency(salaryAmount)}</strong></span>
        </div>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 8px 12px; border-radius: 8px;">
            <span style="font-size: 12px; color: #065f46;">Lịch trả: <strong>${scheduleLabel}</strong></span>
        </div>
        <div style="background: ${statusBg}; border: 1px solid ${statusBorder}; padding: 8px 12px; border-radius: 8px;">
            <span style="font-size: 12px; color: ${statusText};">Trạng thái: <strong>${statusLabel}</strong></span>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 8px;">
            <span style="font-size: 12px; color: #475569;">Gần nhất: <strong>${lastPaidAt ? lastPaidAt : 'Chưa có'}</strong></span>
        </div>
    `;
}

function updateWorkerPayrollSummary(workerId, setting) {
    if (workerId == null) return;
    payrollSettingsByWorkerId[workerId] = setting || null;

    const el = document.getElementById(`worker-payroll-${workerId}`);
    if (!el) return;
    el.innerHTML = getPayrollSummaryBlock(setting);

    if (typeof gsap !== 'undefined') {
        gsap.fromTo(`#worker-payroll-${workerId} > div`, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25, stagger: 0.04, ease: 'power2.out' });
    }
}

function renderPayrollPaymentsList(payments) {
    if (!Array.isArray(payments) || payments.length === 0) {
        return '<div style="padding: 24px; text-align: center; color: #6b7280;">Chưa có lịch sử trả lương</div>';
    }

    return payments.slice(0, 10).map(p => {
        const status = (p && p.status ? String(p.status) : 'PAID').toUpperCase();
        const statusBadge = status === 'PAID'
            ? { bg: '#ecfdf5', border: '#bbf7d0', text: '#166534', label: 'Đã trả' }
            : status === 'FAILED'
                ? { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', label: 'Thất bại' }
                : { bg: '#f1f5f9', border: '#e2e8f0', text: '#475569', label: status };

        const amount = p && p.amount != null ? Number(p.amount) : 0;
        const paidAt = p && p.paidAt ? new Date(p.paidAt).toLocaleString('vi-VN') : '';
        const periodStart = p && p.payPeriodStart ? new Date(p.payPeriodStart).toLocaleDateString('vi-VN') : '';
        const periodEnd = p && p.payPeriodEnd ? new Date(p.payPeriodEnd).toLocaleDateString('vi-VN') : '';
        const periodText = periodStart && periodEnd ? `${periodStart} - ${periodEnd}` : '';
        const desc = p && p.description ? escapeHtml(p.description) : '';

        return `
            <div style="padding: 14px 16px; display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #e5e7eb;">
                <div style="min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <div style="font-weight: 700; color: #111827;">-${formatCurrency(amount)}</div>
                        <span style="font-size: 12px; font-weight: 700; padding: 2px 10px; border-radius: 999px; background: ${statusBadge.bg}; border: 1px solid ${statusBadge.border}; color: ${statusBadge.text};">${statusBadge.label}</span>
                    </div>
                    ${paidAt ? `<div style=\"font-size: 12px; color: #6b7280; margin-top: 4px;\">${paidAt}</div>` : ''}
                    ${periodText ? `<div style=\"font-size: 12px; color: #6b7280; margin-top: 4px;\">Kỳ lương: ${periodText}</div>` : ''}
                    ${desc ? `<div style=\"font-size: 13px; color: #374151; margin-top: 6px;\">${desc}</div>` : ''}
                </div>
                <div style="width: 40px; height: 40px; border-radius: 12px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <span class="material-symbols-outlined" style="font-size: 20px;">payments</span>
                </div>
            </div>
        `;
    }).join('');
}

async function loadPayrollModalData(workerId) {
    const overlay = document.getElementById('payroll-modal');
    if (!overlay) return;

    const amountInput = document.getElementById('payroll-salary-amount');
    const payFrequencyInput = document.getElementById('payroll-pay-frequency');
    const payDayInput = document.getElementById('payroll-pay-day');
    const payDayOfWeekInput = document.getElementById('payroll-pay-day-week');
    const activeInput = document.getElementById('payroll-active');
    const lastPaidEl = document.getElementById('payroll-last-paid');
    const settingStatusEl = document.getElementById('payroll-setting-status');
    const paymentsListEl = document.getElementById('payroll-payments-list');
    const paymentsCountEl = document.getElementById('payroll-payments-count');
    const payNowBtn = document.getElementById('payroll-pay-now-btn');

    if (paymentsListEl) {
        paymentsListEl.innerHTML = '<div style="padding: 24px; text-align: center; color: #6b7280;">Đang tải...</div>';
    }
    if (paymentsCountEl) paymentsCountEl.textContent = '0';

    try {
        const ownerId = await getCurrentUserId();
        const farmId = await ensureFarmId();

        if (!ownerId || !farmId) {
            throw new Error('Không xác định được thông tin chủ trang trại/nông trại');
        }

        const [settingsRes, paymentsRes] = await Promise.all([
            fetchAPI(`${LABOR_API_BASE}/payroll/settings/owner/${ownerId}`),
            fetchAPI(`${LABOR_API_BASE}/payroll/payments/owner/${ownerId}`)
        ]);

        const settings = Array.isArray(settingsRes) ? settingsRes : [];
        const allPayments = Array.isArray(paymentsRes) ? paymentsRes : [];

        const setting = settings.find(s => {
            const wid = s && s.worker && s.worker.id != null ? Number(s.worker.id) : null;
            const fid = s && s.farm && s.farm.id != null ? Number(s.farm.id) : null;
            return wid === Number(workerId) && (fid == null || fid === Number(farmId));
        }) || null;
        payrollSettingsByWorkerId[workerId] = setting;

        const payments = allPayments.filter(p => {
            const wid = p && p.worker && p.worker.id != null ? Number(p.worker.id) : null;
            const fid = p && p.farm && p.farm.id != null ? Number(p.farm.id) : null;
            return wid === Number(workerId) && (fid == null || fid === Number(farmId));
        });

        const normalizedFrequency = setting && setting.payFrequency ? String(setting.payFrequency).toUpperCase() : 'MONTHLY';

        if (amountInput) amountInput.value = setting && setting.salaryAmount != null ? String(setting.salaryAmount) : '';
        if (payFrequencyInput) {
            payFrequencyInput.value = ['DAILY', 'WEEKLY', 'MONTHLY'].includes(normalizedFrequency)
                ? normalizedFrequency
                : 'MONTHLY';
        }
        if (payDayInput) payDayInput.value = setting && setting.payDayOfMonth != null ? String(setting.payDayOfMonth) : '1';
        if (payDayOfWeekInput) payDayOfWeekInput.value = setting && setting.payDayOfWeek != null ? String(setting.payDayOfWeek) : '1';
        if (activeInput) activeInput.checked = setting ? (setting.isActive !== false) : true;

        updatePayrollFrequencyUI();

        const lastPaidAt = setting && setting.lastPaidAt ? new Date(setting.lastPaidAt).toLocaleString('vi-VN') : null;
        if (lastPaidEl) lastPaidEl.textContent = lastPaidAt ? lastPaidAt : 'Chưa có';
        if (settingStatusEl) settingStatusEl.textContent = setting && setting.id != null ? `ID #${setting.id}` : 'Chưa có';

        if (payNowBtn) {
            const amount = setting && setting.salaryAmount != null ? Number(setting.salaryAmount) : 0;
            payNowBtn.disabled = !(setting && setting.id != null && amount > 0);
            payNowBtn.style.opacity = payNowBtn.disabled ? '0.6' : '1';
            payNowBtn.style.cursor = payNowBtn.disabled ? 'not-allowed' : 'pointer';
        }

        if (paymentsCountEl) paymentsCountEl.textContent = String(payments.length);
        if (paymentsListEl) {
            paymentsListEl.innerHTML = renderPayrollPaymentsList(payments);
        }

        updateWorkerPayrollSummary(workerId, setting);

        if (typeof gsap !== 'undefined') {
            gsap.fromTo('#payroll-payments-list > div', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.04, ease: 'power2.out' });
        }
    } catch (e) {
        if (paymentsListEl) {
            paymentsListEl.innerHTML = '<div style="padding: 24px; text-align: center; color: #ef4444;">Không thể tải dữ liệu lương</div>';
        }
        if (paymentsCountEl) paymentsCountEl.textContent = '0';
        showToast('Lỗi', e.message || 'Không thể tải dữ liệu lương', 'error');
    }
}

function updatePayrollFrequencyUI() {
    const frequencyEl = document.getElementById('payroll-pay-frequency');
    if (!frequencyEl) return;

    const monthWrap = document.getElementById('payroll-pay-day-month-wrap');
    const weekWrap = document.getElementById('payroll-pay-day-week-wrap');

    const frequency = String(frequencyEl.value || 'MONTHLY').toUpperCase();

    if (monthWrap) monthWrap.style.display = frequency === 'MONTHLY' ? 'block' : 'none';
    if (weekWrap) weekWrap.style.display = frequency === 'WEEKLY' ? 'block' : 'none';
}

function ensurePayrollModal() {
    let overlay = document.getElementById('payroll-modal');
    if (overlay) return overlay;

    const modalHtml = `
        <div id="payroll-modal" class="modal-overlay" style="display: none;">
            <div class="modal-content" style="width: 760px; max-width: 95%; padding: 0; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #10b981, #3b82f6); padding: 24px; color: white;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                        <div>
                            <h3 style="margin: 0; font-size: 20px;">Quản lý lương</h3>
                            <p id="payroll-modal-subtitle" style="margin: 6px 0 0 0; opacity: 0.9; font-size: 13px;"></p>
                        </div>
                        <button type="button" onclick="closePayrollModal()" style="background: rgba(255,255,255,0.2); border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <span class="material-symbols-outlined" style="color: white; font-size: 22px;">close</span>
                        </button>
                    </div>
                </div>
                <div style="padding: 24px; max-height: 80vh; overflow-y: auto;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px;">
                        <h4 style="margin: 0; color: #111827; font-size: 16px;">Cấu hình lương</h4>
                        <button type="button" class="btn btn--secondary" style="padding: 8px 14px; font-size: 13px;" onclick="refreshPayrollModal()">
                            <span class="material-symbols-outlined" style="font-size: 16px;">refresh</span>
                            Tải lại
                        </button>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div>
                            <label style="display: block; font-size: 13px; color: #374151; font-weight: 600;">Mức lương (VNĐ)</label>
                            <input id="payroll-salary-amount" type="number" min="0" class="modal-input" placeholder="0">
                        </div>
                        <div>
                            <label style="display: block; font-size: 13px; color: #374151; font-weight: 600;">Chu kỳ trả</label>
                            <select id="payroll-pay-frequency" class="modal-input">
                                <option value="MONTHLY">Hàng tháng</option>
                                <option value="WEEKLY">Hàng tuần</option>
                                <option value="DAILY">Hàng ngày</option>
                            </select>
                        </div>
                        <div id="payroll-pay-day-month-wrap">
                            <label style="display: block; font-size: 13px; color: #374151; font-weight: 600;">Ngày trả (1-31)</label>
                            <input id="payroll-pay-day" type="number" min="1" max="31" class="modal-input" placeholder="1">
                        </div>
                        <div id="payroll-pay-day-week-wrap" style="display: none;">
                            <label style="display: block; font-size: 13px; color: #374151; font-weight: 600;">Thứ trả</label>
                            <select id="payroll-pay-day-week" class="modal-input">
                                <option value="1">Thứ 2</option>
                                <option value="2">Thứ 3</option>
                                <option value="3">Thứ 4</option>
                                <option value="4">Thứ 5</option>
                                <option value="5">Thứ 6</option>
                                <option value="6">Thứ 7</option>
                                <option value="7">Chủ nhật</option>
                            </select>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 10px; margin-top: 12px;">
                        <input id="payroll-active" type="checkbox" style="width: 18px; height: 18px;">
                        <label for="payroll-active" style="font-size: 14px; color: #374151;">Kích hoạt tự động trả lương</label>
                    </div>

                    <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px;">
                        <div style="background: #f1f5f9; border: 1px solid #e2e8f0; padding: 10px 12px; border-radius: 10px; flex: 1; min-width: 220px;">
                            <div style="font-size: 12px; color: #64748b;">Lần trả gần nhất</div>
                            <div style="font-weight: 700; color: #0f172a;" id="payroll-last-paid">Chưa có</div>
                        </div>
                        <div style="background: #f1f5f9; border: 1px solid #e2e8f0; padding: 10px 12px; border-radius: 10px; flex: 1; min-width: 220px;">
                            <div style="font-size: 12px; color: #64748b;">Trạng thái cấu hình</div>
                            <div style="font-weight: 700; color: #0f172a;" id="payroll-setting-status">Chưa có</div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 16px;">
                        <button type="button" class="btn btn--secondary" id="payroll-save-btn" onclick="savePayrollSetting()">
                            <span class="material-symbols-outlined">save</span>
                            Lưu cấu hình
                        </button>
                        <button type="button" class="btn btn--primary" id="payroll-pay-now-btn" onclick="payPayrollNow()">
                            <span class="material-symbols-outlined">payments</span>
                            Trả lương ngay
                        </button>
                    </div>

                    <div style="margin-top: 22px; border-top: 1px solid #e5e7eb; padding-top: 18px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                            <h4 style="margin: 0; color: #111827; font-size: 16px;">Lịch sử trả lương</h4>
                            <span style="font-size: 13px; color: #6b7280;">(<span id="payroll-payments-count">0</span>)</span>
                        </div>
                        <div id="payroll-payments-list" style="margin-top: 12px; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                            <div style="padding: 24px; text-align: center; color: #6b7280;">Chưa có dữ liệu</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    overlay = document.getElementById('payroll-modal');
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closePayrollModal();
    });

    const frequencyEl = document.getElementById('payroll-pay-frequency');
    if (frequencyEl) {
        frequencyEl.addEventListener('change', updatePayrollFrequencyUI);
    }
    updatePayrollFrequencyUI();
    return overlay;
}

function openPayrollModal(workerId) {
    payrollModalWorkerId = workerId;
    const overlay = ensurePayrollModal();

    const worker = approvedWorkers.find(w => Number(w.id) === Number(workerId));
    const subtitleEl = document.getElementById('payroll-modal-subtitle');
    if (subtitleEl) {
        subtitleEl.textContent = worker
            ? `${worker.fullName || worker.email || 'Nhân công'} (${worker.email || ''})`
            : `Worker#${workerId}`;
    }

    overlay.classList.add('open');
    overlay.style.display = 'flex';

    if (typeof gsap !== 'undefined') {
        gsap.fromTo('#payroll-modal .modal-content', { opacity: 0, y: 10, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: 'power2.out' });
    }

    refreshPayrollModal();
}

function closePayrollModal() {
    const overlay = document.getElementById('payroll-modal');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.style.display = 'none';
    payrollModalWorkerId = null;
}

async function refreshPayrollModal() {
    if (!payrollModalWorkerId) return;
    await loadPayrollModalData(payrollModalWorkerId);
}

async function savePayrollSetting() {
    if (!payrollModalWorkerId) return;

    const saveBtn = document.getElementById('payroll-save-btn');
    const amountInput = document.getElementById('payroll-salary-amount');
    const payFrequencyInput = document.getElementById('payroll-pay-frequency');
    const payDayInput = document.getElementById('payroll-pay-day');
    const payDayOfWeekInput = document.getElementById('payroll-pay-day-week');
    const activeInput = document.getElementById('payroll-active');

    const salaryAmount = amountInput && amountInput.value != null ? Number(amountInput.value) : 0;

    const rawFrequency = payFrequencyInput && payFrequencyInput.value != null
        ? String(payFrequencyInput.value)
        : 'MONTHLY';
    const payFrequency = ['DAILY', 'WEEKLY', 'MONTHLY'].includes(rawFrequency.toUpperCase())
        ? rawFrequency.toUpperCase()
        : 'MONTHLY';

    let payDayOfMonth = payDayInput && payDayInput.value != null ? parseInt(payDayInput.value, 10) : 1;
    if (!Number.isFinite(payDayOfMonth) || payDayOfMonth < 1) payDayOfMonth = 1;
    if (payDayOfMonth > 31) payDayOfMonth = 31;

    let payDayOfWeek = payDayOfWeekInput && payDayOfWeekInput.value != null
        ? parseInt(payDayOfWeekInput.value, 10)
        : 1;
    if (!Number.isFinite(payDayOfWeek) || payDayOfWeek < 1) payDayOfWeek = 1;
    if (payDayOfWeek > 7) payDayOfWeek = 7;

    if (payFrequency === 'MONTHLY') {
        payDayOfWeek = null;
    } else if (payFrequency === 'WEEKLY') {
        payDayOfMonth = 1;
    } else {
        payDayOfMonth = 1;
        payDayOfWeek = null;
    }
    const isActive = activeInput ? !!activeInput.checked : true;

    if (salaryAmount < 0) {
        showToast('Không hợp lệ', 'Mức lương phải lớn hơn hoặc bằng 0', 'warning');
        return;
    }

    try {
        const ownerId = await getCurrentUserId();
        const farmId = await ensureFarmId();
        if (!ownerId || !farmId) {
            throw new Error('Không xác định được thông tin chủ trang trại/nông trại');
        }

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.7';
            saveBtn.style.cursor = 'not-allowed';
        }

        const setting = await fetchAPI(`${LABOR_API_BASE}/payroll/settings`, 'POST', {
            farmId: farmId,
            ownerId: ownerId,
            workerId: payrollModalWorkerId,
            salaryAmount: salaryAmount,
            payFrequency: payFrequency,
            payDayOfMonth: payDayOfMonth,
            payDayOfWeek: payDayOfWeek,
            isActive: isActive
        });

        payrollSettingsByWorkerId[payrollModalWorkerId] = setting;
        updateWorkerPayrollSummary(payrollModalWorkerId, setting);

        showToast('Thành công', 'Đã lưu cấu hình lương', 'success');
        await loadPayrollModalData(payrollModalWorkerId);
    } catch (e) {
        showToast('Lỗi', e.message || 'Không thể lưu cấu hình lương', 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
            saveBtn.style.cursor = 'pointer';
        }
    }
}

async function payPayrollNow() {
    if (!payrollModalWorkerId) return;
    const setting = payrollSettingsByWorkerId[payrollModalWorkerId];
    if (!setting || setting.id == null) {
        showToast('Thiếu cấu hình', 'Vui lòng lưu cấu hình lương trước khi trả lương', 'warning');
        return;
    }

    showConfirmModal(
        'Trả lương ngay',
        'Bạn có chắc muốn trả lương ngay bây giờ? Hệ thống sẽ trừ tiền từ số dư của bạn.',
        async () => {
            const payBtn = document.getElementById('payroll-pay-now-btn');
            try {
                if (payBtn) {
                    payBtn.disabled = true;
                    payBtn.style.opacity = '0.7';
                    payBtn.style.cursor = 'not-allowed';
                }

                const payment = await fetchAPI(`${LABOR_API_BASE}/payroll/settings/${setting.id}/pay`, 'POST', {});
                const status = payment && payment.status ? String(payment.status).toUpperCase() : 'PAID';

                if (status === 'PAID') {
                    showToast('Đã trả lương', `Đã trả ${formatCurrency(payment.amount != null ? Number(payment.amount) : 0)} cho nhân công`, 'success');
                } else {
                    showToast('Không thể trả lương', payment && payment.description ? payment.description : 'Thanh toán không thành công', 'warning');
                }

                await refreshPayrollModal();
            } catch (e) {
                showToast('Lỗi', e.message || 'Không thể trả lương', 'error');
            } finally {
                if (payBtn) {
                    payBtn.disabled = false;
                    payBtn.style.opacity = '1';
                    payBtn.style.cursor = 'pointer';
                }
            }
        },
        'Trả lương',
        'Hủy'
    );
}

// ============ MISSING FUNCTIONS FIX ============

function populateItemSelect() {
    const select = document.getElementById('task-related-item');
    if (!select) return;

    select.innerHTML = '<option value="">-- Không có vật tư --</option>';

    // Using global inventoryList populated in openAssignTaskModal
    if (typeof inventoryList !== 'undefined' && inventoryList.length > 0) {
        inventoryList.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.name} (Tồn: ${item.quantity} ${item.unit || ''})`;
            select.appendChild(option);
        });
    }
}

async function loadRecruitmentInfo() {
    console.log("Loading recruitment info...");
    const container = document.getElementById('recruitment-quota-section');
    if (!container) return;

    try {
        // Get current farm
        const farms = await fetchAPI(`${LABOR_API_BASE}/farms/my-farms`);
        if (!farms || farms.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #6b7280;">
                    <span class="material-symbols-outlined" style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;">agriculture</span>
                    <p>Bạn chưa có nông trại. Vui lòng tạo nông trại trước.</p>
                </div>
            `;
            return;
        }

        const farm = farms[0];
        myFarmId = farm.id;
        const quota = farm.recruitmentQuota || 0;

        // Count current workers
        let currentWorkers = 0;
        try {
            const workers = await fetchAPI(`${LABOR_API_BASE}/user/list?role=WORKER&farmId=${farm.id}`);
            currentWorkers = workers ? workers.length : 0;
        } catch (e) {
            console.warn('Could not count workers:', e);
        }

        container.innerHTML = `
            <div class="recruitment-settings" style="display: flex; gap: 24px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 280px; background: linear-gradient(135deg, #ecfdf5, #d1fae5); padding: 20px; border-radius: 12px; border: 1px solid #a7f3d0;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <div style="width: 48px; height: 48px; background: #10b981; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <span class="material-symbols-outlined" style="color: white; font-size: 24px;">person_add</span>
                        </div>
                        <div>
                            <h4 style="margin: 0; color: #065f46; font-size: 18px;">Hạn mức tuyển dụng</h4>
                            <p style="margin: 0; color: #047857; font-size: 13px;">Số nhân công bạn muốn tuyển</p>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <input type="number" id="quota-input" value="${quota}" min="0" max="100" 
                            style="width: 80px; padding: 10px; font-size: 18px; font-weight: 700; text-align: center; border: 2px solid #10b981; border-radius: 8px; background: white; color: #065f46;">
                        <span style="color: #047857; font-weight: 500;">người</span>
                        <button onclick="updateRecruitmentQuota()" class="btn btn--primary" style="margin-left: auto;">
                            <span class="material-symbols-outlined">save</span> Cập nhật
                        </button>
                    </div>
                    <p style="margin-top: 12px; font-size: 12px; color: #059669;">
                        ${quota > 0 ? `✓ Trang trại đang mở tuyển ${quota} nhân công` : '⚠ Chưa mở tuyển dụng - Worker không thể đăng ký'}
                    </p>
                </div>
                
                <div style="flex: 1; min-width: 200px; background: #f1f5f9; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                        <div style="width: 48px; height: 48px; background: #3b82f6; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <span class="material-symbols-outlined" style="color: white; font-size: 24px;">groups</span>
                        </div>
                        <div>
                            <h4 style="margin: 0; color: #1e40af; font-size: 18px;">Nhân công hiện tại</h4>
                            <p style="margin: 0; color: #3b82f6; font-size: 13px;">Đã tuyển / Hạn mức</p>
                        </div>
                    </div>
                    <div style="font-size: 32px; font-weight: 700; color: #1e40af;">
                        ${currentWorkers} <span style="font-size: 18px; color: #64748b;">/ ${quota || '∞'}</span>
                    </div>
                </div>
            </div>
        `;

        // Load pending applications
        loadPendingApplications();

    } catch (e) {
        console.error('Error loading recruitment info:', e);
        container.innerHTML = '<p style="text-align: center; color: red;">Lỗi tải thông tin tuyển dụng</p>';
    }
}

async function updateRecruitmentQuota() {
    const quotaInput = document.getElementById('quota-input');
    const newQuota = parseInt(quotaInput.value) || 0;

    if (!myFarmId) {
        alert('Không xác định được nông trại');
        return;
    }

    try {
        await fetchAPI(`${LABOR_API_BASE}/farms/${myFarmId}/recruitment`, 'PUT', {
            quota: newQuota
        });
        alert('Đã cập nhật hạn mức tuyển dụng!');
        loadRecruitmentInfo(); // Reload
    } catch (e) {
        alert('Lỗi: ' + e.message);
    }
}

async function loadPendingApplications() {
    const section = document.getElementById('pending-applications-section');
    const listContainer = document.getElementById('applications-list');
    const countBadge = document.getElementById('pending-count');

    if (!section || !listContainer) return;
    if (!myFarmId) {
        section.style.display = 'none';
        return;
    }

    try {
        // Use correct endpoint: /api/labor/applications
        const applications = await fetchAPI(`${LABOR_API_BASE}/labor/applications?farmId=${myFarmId}`);

        if (!applications || applications.length === 0) {
            section.style.display = 'none';
            return;
        }

        // Store applications for CV modal
        window.pendingApplications = applications;

        section.style.display = 'block';
        if (countBadge) countBadge.textContent = applications.length;

        listContainer.innerHTML = applications.map(app => `
            <div class="application-card" onclick="showCVDetailModal(window.pendingApplications.find(a => a.id === ${app.id}))" style="display: flex; gap: 16px; padding: 16px; background: white; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 12px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#10b981'; this.style.boxShadow='0 4px 12px rgba(16,185,129,0.15)'" onmouseout="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
                <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #ecfdf5, #d1fae5); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <span class="material-symbols-outlined" style="color: #10b981; font-size: 28px;">person</span>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <h4 style="margin: 0; color: #111827; font-size: 16px;">${app.fullName || 'Ứng viên'}</h4>
                        <span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500;">Chờ duyệt</span>
                    </div>
                    <p style="margin: 0; font-size: 13px; color: #6b7280; display: flex; align-items: center; gap: 4px;">
                        <span class="material-symbols-outlined" style="font-size: 14px;">phone</span>
                        ${app.phone || 'Chưa có SĐT'}
                    </p>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 300px;" title="${app.cvProfile || ''}">
                        ${app.cvProfile ? app.cvProfile.substring(0, 50) + (app.cvProfile.length > 50 ? '...' : '') : 'Bấm để xem chi tiết'}
                    </p>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;" onclick="event.stopPropagation()">
                    <button onclick="event.stopPropagation(); approveApplication(${app.id})" class="btn btn--primary" style="padding: 8px 16px; font-size: 13px; border-radius: 8px;">
                        <span class="material-symbols-outlined" style="font-size: 16px;">check</span> Duyệt
                    </button>
                    <button onclick="event.stopPropagation(); rejectApplication(${app.id})" class="btn btn--secondary" style="padding: 8px 16px; font-size: 13px; border-radius: 8px; background: #fee2e2; color: #dc2626; border: none;">
                        <span class="material-symbols-outlined" style="font-size: 16px;">close</span> Từ chối
                    </button>
                </div>
            </div>
        `).join('');

    } catch (e) {
        console.warn('Could not load applications:', e);
        section.style.display = 'none';
    }
}

async function approveApplication(applicationId) {
    showConfirmModal(
        'Duyệt nhân công',
        'Bạn có chắc muốn duyệt hồ sơ này? Nhân công sẽ được thêm vào trang trại của bạn.',
        async () => {
            try {
                await fetchAPI(`${LABOR_API_BASE}/labor/approve/${applicationId}`, 'POST', { ownerId: myFarmId });
                showToast && showToast('Thành công', 'Đã duyệt hồ sơ nhân công!', 'success');
                loadRecruitmentInfo();
                loadApprovedWorkers();
            } catch (e) {
                alert('Lỗi: ' + e.message);
            }
        },
        'Duyệt'
    );
}

async function rejectApplication(applicationId) {
    showConfirmModal(
        'Từ chối hồ sơ',
        'Bạn có chắc muốn từ chối hồ sơ này? Hành động này không thể hoàn tác.',
        async () => {
            try {
                await fetchAPI(`${LABOR_API_BASE}/labor/reject/${applicationId}`, 'POST', {});
                showToast && showToast('Đã từ chối', 'Hồ sơ đã bị từ chối', 'info');
                loadRecruitmentInfo();
            } catch (e) {
                alert('Lỗi: ' + e.message);
            }
        },
        'Từ chối',
        'Hủy'
    );
}

function openCreatePostModal() {
    alert("Tính năng Đăng tuyển đang phát triển");
}

// Toggle shop options visibility based on task type
function toggleShopOptions(taskType) {
    const shopOptions = document.getElementById('shop-options');
    if (!shopOptions) return;

    // Show shop options for tasks that may need supplies
    const showForTypes = ['BUY_SUPPLIES', 'FERTILIZE', 'FEED', 'CLEAN'];
    if (showForTypes.includes(taskType)) {
        shopOptions.style.display = 'block';
    } else {
        shopOptions.style.display = 'none';
    }
}

// Close assign task modal
function closeAssignTaskModal() {
    const modal = document.getElementById('assign-task-modal');
    if (modal) {
        modal.classList.remove('open');
        modal.style.display = 'none';
    }
    // Reset form
    const form = document.getElementById('assign-task-form');
    if (form) form.reset();
    
    // Reset shop options visibility
    const shopOptions = document.getElementById('shop-options');
    if (shopOptions) shopOptions.style.display = 'block';
}

window.openCreatePostModal = openCreatePostModal;
window.toggleShopOptions = toggleShopOptions;
window.closeAssignTaskModal = closeAssignTaskModal;
window.openAssignTaskModal = openAssignTaskModal;
window.submitAssignTask = submitAssignTask;
window.updateRecruitmentQuota = updateRecruitmentQuota;
window.approveApplication = approveApplication;
window.rejectApplication = rejectApplication;
window.loadRecruitmentInfo = loadRecruitmentInfo;
window.showCVDetailModal = showCVDetailModal;
window.showConfirmModal = showConfirmModal;
window.loadApprovedWorkers = loadApprovedWorkers;
window.openWorkerDetailPage = openWorkerDetailPage;
window.openPayrollModal = openPayrollModal;
window.closePayrollModal = closePayrollModal;
window.refreshPayrollModal = refreshPayrollModal;
window.savePayrollSetting = savePayrollSetting;
window.payPayrollNow = payPayrollNow;
window.loadOwnerHelpRequests = loadOwnerHelpRequests;
window.respondOwnerHelpRequest = respondOwnerHelpRequest;
window.closeOwnerHelpRequest = closeOwnerHelpRequest;
window.quickAssignTask = quickAssignTask;
window.loadWorkerDetailTab = loadWorkerDetailTab;
window.refreshWorkerDetailTab = refreshWorkerDetailTab;
window.onWorkerDetailSelectChange = onWorkerDetailSelectChange;

// ==================== Approved Workers Tab ====================

async function loadApprovedWorkers() {
    const container = document.getElementById('workers-list');
    const countBadge = document.getElementById('workers-count');
    
    if (!container) return;

    if (!myFarmId) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6b7280;">
                <span class="material-symbols-outlined" style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;">groups</span>
                <p>Đang tải thông tin nông trại...</p>
            </div>
        `;
        await ensureFarmId();
        if (!myFarmId) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #6b7280;">
                    <span class="material-symbols-outlined" style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;">groups</span>
                    <p>Không xác định được nông trại</p>
                </div>
            `;
            return;
        }
    }

    try {
        // Fetch approved workers for this farm
        const workers = await fetchAPI(`${LABOR_API_BASE}/user/list?role=WORKER&farmId=${myFarmId}`);
        approvedWorkers = workers || [];

        if (countBadge) {
            countBadge.textContent = `${approvedWorkers.length} nhân công`;
        }

        if (approvedWorkers.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #6b7280;">
                    <div style="width: 80px; height: 80px; background: #f3f4f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                        <span class="material-symbols-outlined" style="font-size: 40px; color: #9ca3af;">person_off</span>
                    </div>
                    <h4 style="margin: 0 0 8px 0; color: #374151;">Chưa có nhân công nào</h4>
                    <p style="margin: 0; font-size: 14px;">Duyệt hồ sơ ứng tuyển trong tab "Tuyển dụng" để thêm nhân công</p>
                </div>
            `;
            return;
        }

        // Fetch tasks to check which workers have been assigned tasks
        let tasksMap = {};
        try {
            const ownerId = await getCurrentUserId();
            if (ownerId) {
                const tasks = await fetchAPI(`${LABOR_API_BASE}/tasks/owner/${ownerId}`);
                tasks.forEach(task => {
                    if (task.worker && task.worker.id) {
                        if (!tasksMap[task.worker.id]) {
                            tasksMap[task.worker.id] = [];
                        }
                        tasksMap[task.worker.id].push(task);
                    }
                });
            }
        } catch (e) {
            console.warn('Could not fetch tasks:', e);
        }

        try {
            const ownerId = await getCurrentUserId();
            if (ownerId) {
                const settingsRes = await fetchAPI(`${LABOR_API_BASE}/payroll/settings/owner/${ownerId}`);
                const settings = Array.isArray(settingsRes) ? settingsRes : [];
                const map = {};
                settings.forEach(s => {
                    const wid = s && s.worker && s.worker.id != null ? s.worker.id : null;
                    if (wid != null) map[wid] = s;
                });
                payrollSettingsByWorkerId = map;
            } else {
                payrollSettingsByWorkerId = {};
            }
        } catch (e) {
            console.warn('Could not fetch payroll settings:', e);
            payrollSettingsByWorkerId = {};
        }

        container.innerHTML = `
            <div style="display: grid; gap: 16px;">
                ${approvedWorkers.map(worker => {
                    const workerTasks = tasksMap[worker.id] || [];
                    const activeTasks = workerTasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
                    const completedTasks = workerTasks.filter(t => t.status === 'COMPLETED');
                    const joinDate = worker.approvedAt || worker.createdAt;
                    const payrollSetting = payrollSettingsByWorkerId[worker.id] || null;
                    const payrollSummary = getPayrollSummaryBlock(payrollSetting);
                    
                    return `
                        <div class="worker-card" style="display: flex; gap: 20px; padding: 20px; background: white; border: 1px solid #e5e7eb; border-radius: 12px; transition: all 0.2s; cursor: pointer;" onclick="openWorkerDetailPage(${worker.id})" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'" onmouseout="this.style.boxShadow='none'">
                            <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #ecfdf5, #d1fae5); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <span class="material-symbols-outlined" style="color: #10b981; font-size: 32px;">person</span>
                            </div>
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                                    <h4 style="margin: 0; color: #111827; font-size: 18px;">${worker.fullName || 'Nhân công'}</h4>
                                    <span style="background: #dcfce7; color: #166534; padding: 2px 10px; border-radius: 4px; font-size: 12px; font-weight: 500;">
                                        Đang làm việc
                                    </span>
                                </div>
                                <div style="display: flex; flex-wrap: wrap; gap: 16px; color: #6b7280; font-size: 14px;">
                                    <span style="display: flex; align-items: center; gap: 4px;">
                                        <span class="material-symbols-outlined" style="font-size: 16px;">mail</span>
                                        ${worker.email}
                                    </span>
                                    ${worker.phone ? `
                                        <span style="display: flex; align-items: center; gap: 4px;">
                                            <span class="material-symbols-outlined" style="font-size: 16px;">phone</span>
                                            ${worker.phone}
                                        </span>
                                    ` : ''}
                                    <span style="display: flex; align-items: center; gap: 4px;">
                                        <span class="material-symbols-outlined" style="font-size: 16px;">calendar_today</span>
                                        Vào làm: ${joinDate ? new Date(joinDate).toLocaleDateString('vi-VN') : 'N/A'}
                                    </span>
                                </div>
                                <div style="display: flex; gap: 16px; margin-top: 12px;">
                                    <div style="background: ${activeTasks.length > 0 ? '#fef3c7' : '#f3f4f6'}; padding: 8px 12px; border-radius: 8px;">
                                        <span style="font-size: 12px; color: ${activeTasks.length > 0 ? '#92400e' : '#6b7280'};">
                                            Đang làm: <strong>${activeTasks.length}</strong> việc
                                        </span>
                                    </div>
                                    <div style="background: #ecfdf5; padding: 8px 12px; border-radius: 8px;">
                                        <span style="font-size: 12px; color: #065f46;">
                                            Hoàn thành: <strong>${completedTasks.length}</strong> việc
                                        </span>
                                    </div>
                                </div>
                                <div id="worker-payroll-${worker.id}" style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px;">
                                    ${payrollSummary}
                                </div>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <button onclick="event.stopPropagation(); assignTaskToWorker(${worker.id}, '${worker.fullName}')" class="btn btn--primary" style="padding: 8px 16px; font-size: 13px;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">add_task</span>
                                    Giao việc
                                </button>
                                <button onclick="event.stopPropagation(); openPayrollModal(${worker.id})" class="btn btn--secondary" style="padding: 8px 16px; font-size: 13px;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">payments</span>
                                    Lương
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        if (typeof gsap !== 'undefined') {
            gsap.fromTo('.worker-card', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.05, ease: 'power2.out' });
        }

    } catch (e) {
        console.error('Error loading workers:', e);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <span class="material-symbols-outlined" style="font-size: 48px; margin-bottom: 12px;">error</span>
                <p>Lỗi tải danh sách nhân công</p>
            </div>
        `;
    }
}

async function loadWorkerDetailTab() {
    const selectEl = document.getElementById('worker-detail-select');
    const contentEl = document.getElementById('worker-detail-content');
    if (!selectEl || !contentEl) return;

    await ensureFarmId();
    await ensureApprovedWorkersForAssignment();

    const previous = workerDetailWorkerId != null ? String(workerDetailWorkerId) : (selectEl.value != null ? String(selectEl.value) : '');

    selectEl.innerHTML = '<option value="">-- Chọn nhân công --</option>';
    if (Array.isArray(approvedWorkers) && approvedWorkers.length > 0) {
        approvedWorkers.forEach(w => {
            if (!w || w.id == null) return;
            const name = escapeHtml(w.fullName || w.email || `Worker#${w.id}`);
            const email = w.email ? ` (${escapeHtml(w.email)})` : '';
            selectEl.innerHTML += `<option value="${w.id}">${name}${email}</option>`;
        });
    }

    if (previous && previous.trim() !== '') {
        selectEl.value = previous;
    }

    const value = selectEl.value != null ? String(selectEl.value) : '';
    if (value.trim() === '') {
        workerDetailWorkerId = null;
        destroyWorkerDetailCharts();
        contentEl.innerHTML = `<div style="text-align: center; padding: 3rem; color: #6b7280;">Chọn nhân công để xem chi tiết.</div>`;
        return;
    }

    await onWorkerDetailSelectChange(value);
}

async function refreshWorkerDetailTab() {
    if (!workerDetailWorkerId) {
        await loadWorkerDetailTab();
        return;
    }
    await loadWorkerDetailContent(workerDetailWorkerId);
}

async function onWorkerDetailSelectChange(workerIdRaw) {
    const contentEl = document.getElementById('worker-detail-content');
    const value = workerIdRaw != null ? String(workerIdRaw) : '';

    if (!value || value.trim() === '') {
        workerDetailWorkerId = null;
        destroyWorkerDetailCharts();
        if (contentEl) {
            contentEl.innerHTML = `<div style="text-align: center; padding: 3rem; color: #6b7280;">Chọn nhân công để xem chi tiết.</div>`;
        }
        return;
    }

    const wid = Number(value);
    if (!Number.isFinite(wid)) {
        workerDetailWorkerId = null;
        destroyWorkerDetailCharts();
        if (contentEl) {
            contentEl.innerHTML = `<div style="text-align: center; padding: 3rem; color: #ef4444;">Nhân công không hợp lệ</div>`;
        }
        return;
    }

    workerDetailWorkerId = wid;
    await loadWorkerDetailContent(workerDetailWorkerId);
}

function findApprovedWorkerById(workerId) {
    if (!Array.isArray(approvedWorkers)) return null;
    return approvedWorkers.find(w => w && w.id != null && Number(w.id) === Number(workerId)) || null;
}

function resolveWorkerDetailSetting(settings) {
    const list = Array.isArray(settings) ? settings : [];
    if (list.length === 0) return null;
    const farmId = myFarmId != null ? Number(myFarmId) : null;
    if (farmId != null) {
        const match = list.find(s => {
            const fid = s && s.farm && s.farm.id != null ? Number(s.farm.id) : null;
            return fid != null && fid === farmId;
        });
        if (match) return match;
    }
    return list[0] || null;
}

function filterWorkerDetailPayments(payments) {
    const list = Array.isArray(payments) ? payments : [];
    const farmId = myFarmId != null ? Number(myFarmId) : null;
    if (farmId == null) return list;
    return list.filter(p => {
        const fid = p && p.farm && p.farm.id != null ? Number(p.farm.id) : null;
        return fid == null || fid === farmId;
    });
}

function sortWorkerDetailTasks(tasks) {
    const list = Array.isArray(tasks) ? tasks.slice() : [];
    const priorityRank = { HIGH: 0, NORMAL: 1, LOW: 2 };
    return list.sort((a, b) => {
        const aStatus = a && a.status ? String(a.status).toUpperCase() : '';
        const bStatus = b && b.status ? String(b.status).toUpperCase() : '';
        const aDone = aStatus === 'COMPLETED' || aStatus === 'CANCELLED';
        const bDone = bStatus === 'COMPLETED' || bStatus === 'CANCELLED';
        if (aDone !== bDone) return aDone ? 1 : -1;

        const aDue = a && a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
        const bDue = b && b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
        if (Number.isFinite(aDue) && Number.isFinite(bDue) && aDue !== bDue) return aDue - bDue;

        const aPr = a && a.priority ? String(a.priority).toUpperCase() : 'NORMAL';
        const bPr = b && b.priority ? String(b.priority).toUpperCase() : 'NORMAL';
        const aRank = priorityRank[aPr] != null ? priorityRank[aPr] : priorityRank.NORMAL;
        const bRank = priorityRank[bPr] != null ? priorityRank[bPr] : priorityRank.NORMAL;
        if (aRank !== bRank) return aRank - bRank;

        const aCreated = a && a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bCreated = b && b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (Number.isFinite(aCreated) && Number.isFinite(bCreated) && aCreated !== bCreated) return bCreated - aCreated;
        return 0;
    });
}

function renderWorkerDetailInfoBlock(worker) {
    const name = escapeHtml(worker && worker.fullName ? worker.fullName : 'Nhân công');
    const email = escapeHtml(worker && worker.email ? worker.email : '--');
    const phone = escapeHtml(worker && worker.phone ? worker.phone : '--');
    const createdAt = worker && worker.createdAt ? formatDateTime(worker.createdAt) : '--';
    const cv = worker && worker.cvProfile ? escapeHtml(worker.cvProfile) : '';

    return `
        <div style="display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap;">
            <div style="width: 72px; height: 72px; border-radius: 18px; background: linear-gradient(135deg, #ecfdf5, #d1fae5); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <span class="material-symbols-outlined" style="font-size: 34px; color: #10b981;">person</span>
            </div>
            <div style="flex: 1; min-width: 240px;">
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <h4 style="margin: 0; font-size: 20px; color: #111827;">${name}</h4>
                    ${worker && worker.id != null ? `<span style=\"font-size: 12px; font-weight: 700; padding: 2px 10px; border-radius: 999px; background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569;\">ID #${escapeHtml(worker.id)}</span>` : ''}
                </div>
                <div style="margin-top: 10px; display: grid; gap: 8px; color: #6b7280; font-size: 14px;">
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span class="material-symbols-outlined" style="font-size: 18px;">mail</span>
                        <span>${email}</span>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span class="material-symbols-outlined" style="font-size: 18px;">phone</span>
                        <span>${phone}</span>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span class="material-symbols-outlined" style="font-size: 18px;">calendar_today</span>
                        <span>Ngày tham gia: ${escapeHtml(createdAt)}</span>
                    </div>
                </div>
                ${cv ? `<div style=\"margin-top: 12px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 12px; color: #374151; white-space: pre-wrap;\">${cv}</div>` : ''}
            </div>
        </div>
    `;
}

function renderWorkerDetailTasksTable(tasks, errorMsg) {
    if (errorMsg) {
        return `<div style="padding: 24px; text-align: center; color: #ef4444;">${escapeHtml(errorMsg)}</div>`;
    }

    const list = sortWorkerDetailTasks(Array.isArray(tasks) ? tasks : []);
    if (list.length === 0) {
        return `<div style="padding: 24px; text-align: center; color: #6b7280;">Chưa có công việc</div>`;
    }

    const rows = list.slice(0, 40).map(t => {
        const name = escapeHtml(t && t.name ? t.name : `Task#${t && t.id != null ? t.id : ''}`);
        const type = escapeHtml(getTaskTypeLabel(t && t.taskType ? t.taskType : 'OTHER'));
        const status = getStatusBadge(t && t.status ? t.status : 'PENDING');
        const priority = getPriorityBadge(t && t.priority ? t.priority : 'NORMAL');
        const due = t && t.dueDate ? formatDateTime(t.dueDate) : '--';
        const salary = t && t.salary != null ? Number(t.salary) : null;
        const salaryText = salary != null && Number.isFinite(salary) && salary > 0 ? formatCurrency(salary) : '--';

        return `
            <tr>
                <td style="padding: 12px 14px; border-bottom: 1px solid #e5e7eb;">
                    <div style="font-weight: 700; color: #111827;">${name}</div>
                    <div style="margin-top: 4px; font-size: 12px; color: #6b7280;">${type}</div>
                </td>
                <td style="padding: 12px 14px; border-bottom: 1px solid #e5e7eb;">${status}</td>
                <td style="padding: 12px 14px; border-bottom: 1px solid #e5e7eb;">${priority}</td>
                <td style="padding: 12px 14px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151;">${escapeHtml(due)}</td>
                <td style="padding: 12px 14px; border-bottom: 1px solid #e5e7eb; font-weight: 700; color: #111827; text-align: right;">${escapeHtml(salaryText)}</td>
            </tr>
        `;
    }).join('');

    return `
        <div style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: auto;">
            <table style="width: 100%; border-collapse: collapse; min-width: 760px;">
                <thead>
                    <tr style="background: #f8fafc;">
                        <th style="text-align: left; padding: 12px 14px; font-size: 12px; color: #475569;">Công việc</th>
                        <th style="text-align: left; padding: 12px 14px; font-size: 12px; color: #475569;">Trạng thái</th>
                        <th style="text-align: left; padding: 12px 14px; font-size: 12px; color: #475569;">Ưu tiên</th>
                        <th style="text-align: left; padding: 12px 14px; font-size: 12px; color: #475569;">Hạn</th>
                        <th style="text-align: right; padding: 12px 14px; font-size: 12px; color: #475569;">Lương</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

function renderWorkerDetailWorklogsTable(worklogs, errorMsg) {
    if (errorMsg) {
        return `<div style="padding: 24px; text-align: center; color: #ef4444;">${escapeHtml(errorMsg)}</div>`;
    }

    const list = Array.isArray(worklogs) ? worklogs : [];
    if (list.length === 0) {
        return `<div style="padding: 24px; text-align: center; color: #6b7280;">Chưa có chấm công</div>`;
    }

    const rows = list.slice(0, 40).map(log => {
        const taskName = escapeHtml(log && log.task && log.task.name ? log.task.name : (log && log.task && log.task.id != null ? `Task#${log.task.id}` : '--'));
        const startedAt = formatDateTime(log && log.startedAt ? log.startedAt : (log && log.createdAt ? log.createdAt : null));
        const endedAt = formatDateTime(log && log.endedAt ? log.endedAt : null);
        const minutes = getDurationMinutes(log);
        const durationText = formatDuration(minutes);
        const note = escapeHtml(log && log.note ? log.note : '');

        return `
            <tr>
                <td style="padding: 12px 14px; border-bottom: 1px solid #e5e7eb; font-weight: 700; color: #111827;">${taskName}</td>
                <td style="padding: 12px 14px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151;">${escapeHtml(startedAt)}</td>
                <td style="padding: 12px 14px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151;">${escapeHtml(endedAt)}</td>
                <td style="padding: 12px 14px; border-bottom: 1px solid #e5e7eb; font-weight: 700; color: #111827;">${escapeHtml(durationText)}</td>
                <td style="padding: 12px 14px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151;">${note || '--'}</td>
            </tr>
        `;
    }).join('');

    return `
        <div style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: auto;">
            <table style="width: 100%; border-collapse: collapse; min-width: 820px;">
                <thead>
                    <tr style="background: #f8fafc;">
                        <th style="text-align: left; padding: 12px 14px; font-size: 12px; color: #475569;">Công việc</th>
                        <th style="text-align: left; padding: 12px 14px; font-size: 12px; color: #475569;">Bắt đầu</th>
                        <th style="text-align: left; padding: 12px 14px; font-size: 12px; color: #475569;">Kết thúc</th>
                        <th style="text-align: left; padding: 12px 14px; font-size: 12px; color: #475569;">Thời lượng</th>
                        <th style="text-align: left; padding: 12px 14px; font-size: 12px; color: #475569;">Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

function renderWorkerDetailChartsBlock() {
    const hasChartJs = typeof Chart !== 'undefined';

    const dailyInner = hasChartJs
        ? '<canvas id="worker-detail-daily-chart" height="140"></canvas>'
        : '<div style="padding: 24px; text-align: center; color: #6b7280;">Chart.js chưa sẵn sàng</div>';

    const monthlyInner = hasChartJs
        ? '<canvas id="worker-detail-monthly-chart" height="140"></canvas>'
        : '<div style="padding: 24px; text-align: center; color: #6b7280;">Chart.js chưa sẵn sàng</div>';

    return `
        <div style="display: flex; flex-wrap: wrap; gap: 16px;">
            <div style="flex: 1; min-width: 280px; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px;">
                <div style="font-weight: 800; color: #111827; margin-bottom: 8px;">Theo ngày</div>
                ${dailyInner}
            </div>
            <div style="flex: 1; min-width: 280px; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px;">
                <div style="font-weight: 800; color: #111827; margin-bottom: 8px;">Theo tháng</div>
                ${monthlyInner}
            </div>
        </div>
    `;
}

function buildWorkerDetailCharts(tasks, worklogs) {
    if (typeof Chart === 'undefined') return;

    const dailyCanvas = document.getElementById('worker-detail-daily-chart');
    const monthlyCanvas = document.getElementById('worker-detail-monthly-chart');
    if (!dailyCanvas || !monthlyCanvas) return;

    destroyWorkerDetailCharts();

    const taskList = Array.isArray(tasks) ? tasks : [];
    const logList = Array.isArray(worklogs) ? worklogs : [];

    const minutesByDay = {};
    const minutesByMonth = {};

    logList.forEach(log => {
        const rawTime = log && (log.startedAt || log.createdAt || log.endedAt);
        const dayKey = rawTime ? toDateKey(rawTime) : null;
        const monthKey = rawTime ? toMonthKey(rawTime) : null;
        const minutes = getDurationMinutes(log);

        if (dayKey) {
            minutesByDay[dayKey] = (minutesByDay[dayKey] || 0) + minutes;
        }
        if (monthKey) {
            minutesByMonth[monthKey] = (minutesByMonth[monthKey] || 0) + minutes;
        }
    });

    const doneCountByDay = {};
    const doneCountByMonth = {};

    taskList.forEach(t => {
        const status = t && t.status ? String(t.status).toUpperCase() : '';
        const isDone = status === 'COMPLETED' || status === 'APPROVED';
        if (!isDone) return;

        const rawTime = t && (t.completedAt || t.updatedAt || t.dueDate || t.createdAt);
        const dayKey = rawTime ? toDateKey(rawTime) : null;
        const monthKey = rawTime ? toMonthKey(rawTime) : null;

        if (dayKey) {
            doneCountByDay[dayKey] = (doneCountByDay[dayKey] || 0) + 1;
        }
        if (monthKey) {
            doneCountByMonth[monthKey] = (doneCountByMonth[monthKey] || 0) + 1;
        }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayCount = 14;
    const dailyLabels = [];
    const dailyHours = [];
    const dailyDone = [];

    for (let i = dayCount - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = toDateKey(d);
        dailyLabels.push(d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }));

        const minutes = key && minutesByDay[key] != null ? Number(minutesByDay[key]) : 0;
        const hours = Number.isFinite(minutes) ? Math.round((minutes / 60) * 10) / 10 : 0;
        dailyHours.push(hours);

        const doneCount = key && doneCountByDay[key] != null ? Number(doneCountByDay[key]) : 0;
        dailyDone.push(Number.isFinite(doneCount) ? doneCount : 0);
    }

    const monthCount = 6;
    const monthStart = new Date(today);
    monthStart.setDate(1);
    monthStart.setMonth(today.getMonth() - (monthCount - 1));

    const monthlyLabels = [];
    const monthlyHours = [];
    const monthlyDone = [];

    for (let i = 0; i < monthCount; i++) {
        const d = new Date(monthStart);
        d.setMonth(monthStart.getMonth() + i);
        const key = toMonthKey(d);
        monthlyLabels.push(d.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }));

        const minutes = key && minutesByMonth[key] != null ? Number(minutesByMonth[key]) : 0;
        const hours = Number.isFinite(minutes) ? Math.round((minutes / 60) * 10) / 10 : 0;
        monthlyHours.push(hours);

        const doneCount = key && doneCountByMonth[key] != null ? Number(doneCountByMonth[key]) : 0;
        monthlyDone.push(Number.isFinite(doneCount) ? doneCount : 0);
    }

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom'
            }
        },
        scales: {
            y: {
                beginAtZero: true
            },
            y1: {
                beginAtZero: true,
                position: 'right',
                grid: {
                    drawOnChartArea: false
                }
            }
        }
    };

    workerDetailDailyChart = new Chart(dailyCanvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: dailyLabels,
            datasets: [
                {
                    label: 'Giờ làm (h)',
                    data: dailyHours,
                    backgroundColor: 'rgba(59, 130, 246, 0.35)',
                    borderColor: 'rgba(37, 99, 235, 1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: 'Việc hoàn thành',
                    data: dailyDone,
                    type: 'line',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    tension: 0.3,
                    fill: true,
                    yAxisID: 'y1'
                }
            ]
        },
        options: commonOptions
    });

    workerDetailMonthlyChart = new Chart(monthlyCanvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: monthlyLabels,
            datasets: [
                {
                    label: 'Giờ làm (h)',
                    data: monthlyHours,
                    backgroundColor: 'rgba(99, 102, 241, 0.35)',
                    borderColor: 'rgba(79, 70, 229, 1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: 'Việc hoàn thành',
                    data: monthlyDone,
                    type: 'line',
                    borderColor: 'rgba(245, 158, 11, 1)',
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    tension: 0.3,
                    fill: true,
                    yAxisID: 'y1'
                }
            ]
        },
        options: commonOptions
    });
}

function renderWorkerDetailPayrollBlock(setting, payments, workerId, errorMsg) {
    if (errorMsg) {
        return `<div style="padding: 24px; text-align: center; color: #ef4444;">${escapeHtml(errorMsg)}</div>`;
    }

    const summaryBlocks = getPayrollSummaryBlock(setting);
    const paymentsList = renderPayrollPaymentsList(payments);

    return `
        <div style="display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
            <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
                ${summaryBlocks}
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
                <button class="btn btn--secondary" onclick="openPayrollModal(${workerId})">
                    <span class="material-symbols-outlined">settings</span>
                    Cấu hình lương
                </button>
            </div>
        </div>
        <div style="margin-top: 12px; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
            ${paymentsList}
        </div>
    `;
}

async function loadWorkerDetailContent(workerId) {
    const contentEl = document.getElementById('worker-detail-content');
    if (!contentEl) return;

    await ensureFarmId();
    await ensureApprovedWorkersForAssignment();

    const worker = findApprovedWorkerById(workerId) || { id: workerId };

    destroyWorkerDetailCharts();
    contentEl.innerHTML = `<div style="text-align: center; padding: 3rem; color: #6b7280;">Đang tải...</div>`;

    const results = await Promise.allSettled([
        fetchAPI(`${LABOR_API_BASE}/tasks/worker/${workerId}`),
        fetchAPI(`${LABOR_API_BASE}/worklogs/worker/${workerId}`),
        fetchAPI(`${LABOR_API_BASE}/payroll/settings/worker/${workerId}`),
        fetchAPI(`${LABOR_API_BASE}/payroll/payments/worker/${workerId}`)
    ]);

    const tasksRes = results[0];
    const logsRes = results[1];
    const settingsRes = results[2];
    const paymentsRes = results[3];

    const tasks = tasksRes.status === 'fulfilled' ? (Array.isArray(tasksRes.value) ? tasksRes.value : []) : [];
    const worklogs = logsRes.status === 'fulfilled' ? (Array.isArray(logsRes.value) ? logsRes.value : []) : [];
    const settingsList = settingsRes.status === 'fulfilled' ? (Array.isArray(settingsRes.value) ? settingsRes.value : []) : [];
    const paymentsListRaw = paymentsRes.status === 'fulfilled' ? (Array.isArray(paymentsRes.value) ? paymentsRes.value : []) : [];

    const tasksError = tasksRes.status === 'rejected' ? (tasksRes.reason && tasksRes.reason.message ? tasksRes.reason.message : 'Không thể tải công việc') : null;
    const logsError = logsRes.status === 'rejected' ? (logsRes.reason && logsRes.reason.message ? logsRes.reason.message : 'Không thể tải chấm công') : null;
    const payrollError = (settingsRes.status === 'rejected' || paymentsRes.status === 'rejected')
        ? ((settingsRes.reason && settingsRes.reason.message) || (paymentsRes.reason && paymentsRes.reason.message) || 'Không thể tải thông tin lương')
        : null;

    const setting = resolveWorkerDetailSetting(settingsList);
    const payments = filterWorkerDetailPayments(paymentsListRaw);

    contentEl.innerHTML = `
        <div style="display: grid; gap: 18px;">

            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 14px; padding: 18px;">
                <div style="font-weight: 900; color: #111827; margin-bottom: 14px;">Thông tin cơ bản</div>
                ${renderWorkerDetailInfoBlock(worker)}
            </div>

            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 14px; padding: 18px;">
                <div style="display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: baseline; margin-bottom: 14px;">
                    <div style="font-weight: 900; color: #111827;">Lịch sử công việc</div>
                    <div style="font-size: 13px; color: #6b7280;">Tổng: <strong>${tasks.length}</strong></div>
                </div>
                ${renderWorkerDetailTasksTable(tasks, tasksError)}
            </div>

            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 14px; padding: 18px;">
                <div style="display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: baseline; margin-bottom: 14px;">
                    <div style="font-weight: 900; color: #111827;">Lịch sử chấm công</div>
                    <div style="font-size: 13px; color: #6b7280;">Tổng: <strong>${worklogs.length}</strong></div>
                </div>
                ${renderWorkerDetailWorklogsTable(worklogs, logsError)}
            </div>

            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 14px; padding: 18px;">
                <div style="font-weight: 900; color: #111827; margin-bottom: 14px;">Biểu đồ</div>
                ${renderWorkerDetailChartsBlock()}
            </div>

            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 14px; padding: 18px;">
                <div style="font-weight: 900; color: #111827; margin-bottom: 14px;">Lương</div>
                ${renderWorkerDetailPayrollBlock(setting, payments, workerId, payrollError)}
            </div>

        </div>
    `;

    if (typeof buildWorkerDetailCharts === 'function') {
        buildWorkerDetailCharts(tasks, worklogs);
    }
}

// Assign task to specific worker - pre-select worker in modal
function assignTaskToWorker(workerId, workerName) {
    openAssignTaskModal();
    // Wait for modal to load workers list, then select the worker
    setTimeout(() => {
        const workerSelect = document.getElementById('task-worker');
        if (workerSelect) {
            workerSelect.value = workerId;
        }
    }, 500);
}

window.assignTaskToWorker = assignTaskToWorker;

function destroyWorkerDetailCharts() {
    if (workerDetailDailyChart && typeof workerDetailDailyChart.destroy === 'function') {
        workerDetailDailyChart.destroy();
    }
    if (workerDetailMonthlyChart && typeof workerDetailMonthlyChart.destroy === 'function') {
        workerDetailMonthlyChart.destroy();
    }
    workerDetailDailyChart = null;
    workerDetailMonthlyChart = null;
}

function toDateKey(value) {
    const d = value instanceof Date ? value : new Date(value);
    if (!d || Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function toMonthKey(value) {
    const d = value instanceof Date ? value : new Date(value);
    if (!d || Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function formatDateTime(value) {
    if (!value) return '--';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleString('vi-VN');
}

function formatDateOnly(value) {
    if (!value) return '--';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleDateString('vi-VN');
}

function getDurationMinutes(log) {
    if (!log) return 0;
    if (log.durationMinutes != null) {
        const minutes = Number(log.durationMinutes);
        return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
    }
    const startedAt = log.startedAt ? new Date(log.startedAt) : null;
    const endedAt = log.endedAt ? new Date(log.endedAt) : null;
    if (!startedAt || Number.isNaN(startedAt.getTime())) return 0;
    const end = endedAt && !Number.isNaN(endedAt.getTime()) ? endedAt : new Date();
    const diffMs = end.getTime() - startedAt.getTime();
    if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
    return Math.floor(diffMs / 60000);
}

function formatDuration(minutes) {
    const m = Number(minutes);
    if (!Number.isFinite(m) || m <= 0) return '0 phút';
    const h = Math.floor(m / 60);
    const mm = Math.floor(m % 60);
    if (h <= 0) return `${mm} phút`;
    if (mm <= 0) return `${h} giờ`;
    return `${h} giờ ${mm} phút`;
}

function getPriorityBadge(priorityRaw) {
    const priority = (priorityRaw || 'NORMAL').toString().toUpperCase();
    if (priority === 'HIGH') {
        return `<span style='font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 999px; background: #fee2e2; border: 1px solid #fecaca; color: #b91c1c;'>Cao</span>`;
    }
    if (priority === 'LOW') {
        return `<span style='font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 999px; background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569;'>Thấp</span>`;
    }
    return `<span style='font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 999px; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af;'>Bình thường</span>`;
}
