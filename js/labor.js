const LABOR_API_BASE = CONFIG.API_BASE_URL || 'http://localhost:8080/api';

// Kanban View State
let currentTaskView = 'list'; // 'list' or 'kanban'
let currentKanbanGroupBy = 'none'; // 'none' or 'worker'

// ── Lightbox for media viewing ──
function openMediaLightbox(src, type) {
    // Remove existing lightbox if any
    const existing = document.getElementById('media-lightbox-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'media-lightbox-overlay';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; padding:20px; cursor:pointer; animation:lbFadeIn 0.2s ease;';

    // Add animation style
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
            <span class="material-symbols-outlined" style="font-size:24px;">close</span>
        </button>
        ${mediaHtml}
    `;

    overlay.addEventListener('click', () => overlay.remove());
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); }
    });

    document.body.appendChild(overlay);
}

// Global variable for farm ID
let myFarmId = null;
let approvedWorkers = []; // List of approved workers
let payrollSettingsByWorkerId = {};
let payrollModalWorkerId = null;
let workerDetailWorkerId = null;
let workerDetailDailyChart = null;
let workerDetailMonthlyChart = null;
let ownerTasksById = {}; // Map for task detail lookup

document.addEventListener('DOMContentLoaded', async () => {
    const page = document && document.body && document.body.dataset ? document.body.dataset.page : null;
    if (page !== 'labor') return;

    // Handle #tasks hash — auto-switch to Giao việc tab
    if (window.location.hash === '#tasks') {
        setTimeout(() => { if (typeof switchTab === 'function') switchTab('tasks'); }, 100);
    }

    await loadTasks();
    loadRecruitmentInfo();
    initializeFarmId();

    // Handle ?taskDetail={id} deep-link from homepage
    const params = new URLSearchParams(window.location.search);
    const taskDetailId = params.get('taskDetail');
    if (taskDetailId) {
        // Switch to Giao việc tab and open detail
        if (typeof switchTab === 'function') switchTab('tasks');
        setTimeout(() => {
            if (typeof openOwnerTaskDetail === 'function' && ownerTasksById[Number(taskDetailId)]) {
                openOwnerTaskDetail(Number(taskDetailId));
            }
        }, 300);
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
    }
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
function normalizeApplicationPayload(rawMessage, rawCvProfile, rawCvPdfUrl) {
    let actualMessage = rawMessage;
    let actualCvProfile = rawCvProfile;
    let actualCvPdfUrl = rawCvPdfUrl;

    try {
        if (typeof actualMessage === 'string') {
            const trimmedMessage = actualMessage.trim();
            if (trimmedMessage.startsWith('{') || trimmedMessage.startsWith('[')) {
                const parsed = JSON.parse(trimmedMessage);
                const payload = Array.isArray(parsed) ? parsed[0] : parsed;

                if (payload && typeof payload === 'object') {
                    if (typeof payload.message === 'string') {
                        actualMessage = payload.message;
                    }

                    if (payload.isAdvancedCv) {
                        if (payload.cvType === 'pdf') {
                            actualCvPdfUrl = payload.cvPdfUrl || actualCvPdfUrl;
                            actualCvProfile = null;
                        } else if (payload.cvType === 'web') {
                            actualCvProfile = JSON.stringify(payload.cvData || {});
                            actualCvPdfUrl = null;
                        }
                    }
                }
            }
        }
    } catch (e) {
        // Keep original values if parsing fails.
    }

    return {
        actualMessage,
        actualCvProfile,
        actualCvPdfUrl
    };
}

function showCVDetailModal(application) {
    const existing = document.getElementById('cv-detail-modal');
    if (existing) existing.remove();

    const normalized = normalizeApplicationPayload(
        application.applyMessage,
        application.cvProfile,
        application.cvPdfUrl
    );
    let actualMessage = normalized.actualMessage;
    let actualCvProfile = normalized.actualCvProfile;
    let actualCvPdfUrl = normalized.actualCvPdfUrl;

    let cvData = null;
    try {
        if (actualCvProfile && (actualCvProfile.trim().startsWith('{') || actualCvProfile.trim().startsWith('['))) {
            const parsedCv = JSON.parse(actualCvProfile);
            if (Array.isArray(parsedCv) && parsedCv.length > 0) {
                cvData = parsedCv[0]; // fallback to first CV if an array is received
            } else if (!Array.isArray(parsedCv)) {
                cvData = parsedCv;
            }
        }
    } catch(e) {
        console.error('Error parsing CV:', e);
    }

    const safeHtml = (str) => {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    if (cvData && cvData.pdfUrl) {
        actualCvPdfUrl = cvData.pdfUrl;
    }

    let cvHtml = '';
    let hasTextContent = false;
    if (cvData) {
        if (cvData.objective || cvData.education || cvData.experience || cvData.skill || cvData.workHistory) hasTextContent = true;
        
        if (hasTextContent) {
            cvHtml = `
                <div style="font-size:14px; color:#374151; display:flex; flex-direction:column; gap:12px;">
                    ${cvData.objective ? `<div><strong style="color:#065f46;">Mục tiêu:</strong><br>${safeHtml(cvData.objective).replace(/\\n/g, '<br>')}</div>` : ''}
                    ${cvData.education ? `<div><strong style="color:#065f46;">Học vấn:</strong><br>${safeHtml(cvData.education).replace(/\\n/g, '<br>')}</div>` : ''}
                    ${cvData.experience ? `<div><strong style="color:#065f46;">Kinh nghiệm:</strong><br>${safeHtml(cvData.experience).replace(/\\n/g, '<br>')}</div>` : ''}
                    ${cvData.skill ? `<div><strong style="color:#065f46;">Kỹ năng:</strong><br>${safeHtml(cvData.skill).replace(/\\n/g, '<br>')}</div>` : ''}
                    ${cvData.workHistory ? `<div><strong style="color:#065f46;">Lịch sử làm việc:</strong><br>${safeHtml(cvData.workHistory).replace(/\\n/g, '<br>')}</div>` : ''}
                </div>
            `;
        }
    }
    
    if (!hasTextContent) {
        const fbMsg = actualCvProfile ? safeHtml(actualCvProfile) : (actualCvPdfUrl ? 'Ứng viên sử dụng Hồ sơ PDF đính kèm (không điền text form).' : 'Chưa có thông tin CV');
        cvHtml = `<p style="margin: 0; color: #374151; white-space: pre-wrap; line-height: 1.6;">${fbMsg}</p>`;
    }

    let extraBadges = '';
    if (application.isFormerWorker) {
        extraBadges += `<span style="background: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined" style="font-size: 14px;">history</span> Nhân công cũ</span> `;
    }
    if (actualCvPdfUrl) {
        extraBadges += `<a href="${safeHtml(actualCvPdfUrl)}" target="_blank" style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; text-decoration: none;"><span class="material-symbols-outlined" style="font-size: 14px;">picture_as_pdf</span> Xem CV PDF đính kèm</a>`;
    }

    const modalHtml = `
        <div id="cv-detail-modal" style="
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); display: flex; align-items: center;
            justify-content: center; z-index: 10000; animation: fadeIn 0.2s ease;
        ">
            <div style="
                background: white; padding: 0; border-radius: 16px;
                max-width: 600px; width: 90%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                animation: slideUp 0.2s ease; overflow: hidden;
            ">
                <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; color: white; flex-shrink: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <div style="width: 64px; height: 64px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                <span class="material-symbols-outlined" style="font-size: 32px;">person</span>
                            </div>
                            <div>
                                <h3 style="margin: 0; font-size: 20px;">${safeHtml(application.fullName || 'Ứng viên')}</h3>
                                <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 14px;">${safeHtml(application.email || '')}</p>
                                ${extraBadges ? `<div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px;">${extraBadges}</div>` : ''}
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
                <div style="padding: 24px; overflow-y: auto; flex: 1;">
                    <div style="margin-bottom: 20px;">
                        <label style="display: flex; align-items: center; gap: 8px; color: #6b7280; font-size: 13px; margin-bottom: 8px;">
                            <span class="material-symbols-outlined" style="font-size: 18px;">phone</span>
                            Số điện thoại
                        </label>
                        <p style="margin: 0; color: #1f2937; font-weight: 500;">${safeHtml(application.phone || 'Chưa cung cấp')}</p>
                    </div>
                    ${actualMessage ? `
                    <div style="margin-bottom: 20px;">
                        <label style="display: flex; align-items: center; gap: 8px; color: #6b7280; font-size: 13px; margin-bottom: 8px;">
                            <span class="material-symbols-outlined" style="font-size: 18px;">chat</span>
                            Lời nhắn ứng tuyển
                        </label>
                        <div style="background: #fdfbed; padding: 16px; border-radius: 8px; border: 1px solid #fef08a; color: #854d0e; font-style: italic;">
                            ${safeHtml(actualMessage)}
                        </div>
                    </div>
                    ` : ''}
                    <div style="margin-bottom: 20px;">
                        <label style="display: flex; align-items: center; gap: 8px; color: #6b7280; font-size: 13px; margin-bottom: 8px;">
                            <span class="material-symbols-outlined" style="font-size: 18px;">description</span>
                            Hồ sơ / Kinh nghiệm
                        </label>
                        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
                            ${cvHtml}
                        </div>
                    </div>
                    <div>
                        <label style="display: flex; align-items: center; gap: 8px; color: #6b7280; font-size: 13px; margin-bottom: 8px;">
                            <span class="material-symbols-outlined" style="font-size: 18px;">calendar_today</span>
                            Ngày nộp hồ sơ
                        </label>
                        <p style="margin: 0; color: #1f2937;">${application.appliedAt ? new Date(application.appliedAt).toLocaleDateString('vi-VN') : (application.createdAt ? new Date(application.createdAt).toLocaleDateString('vi-VN') : 'N/A')}</p>
                    </div>
                </div>
                <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; gap: 12px; justify-content: flex-end; flex-shrink: 0;">
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
        // Filter: show active tasks + tasks created/completed today (local timezone)
        const now = new Date();
        const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const todaysTasks = res.filter(t => {
            const active = !['COMPLETED', 'CANCELLED', 'APPROVED'].includes(t.status);
            if (active) return true;

            // For completed/cancelled/approved: show if created, completed, or approved today (local time)
            const createdLocal = t.createdAt ? new Date(t.createdAt).toLocaleDateString('sv-SE') : '';
            const completedLocal = t.completedAt ? new Date(t.completedAt).toLocaleDateString('sv-SE') : '';
            const approvedLocal = t.approvedAt ? new Date(t.approvedAt).toLocaleDateString('sv-SE') : '';
            return createdLocal === todayLocal || completedLocal === todayLocal || approvedLocal === todayLocal;
        });

        // Store tasks by ID for detail view
        ownerTasksById = {};
        todaysTasks.forEach(t => { if (t && t.id != null) ownerTasksById[t.id] = t; });
        renderTasks(todaysTasks);
    } catch (e) {
        console.error('Error loading tasks:', e);
        const container = document.querySelector('#tasks-tab .card__body');
        if (container) container.innerHTML = '<p style="text-align:center; color:red">Không thể tải danh sách công việc. Vui lòng thử lại sau.</p>';
    }
}

function renderTasks(tasks) {
    const listContainer = document.getElementById('tasks-list-view');
    const kanbanContainer = document.getElementById('tasks-kanban-view');
    const assignContainer = document.getElementById('tasks-assign-view');
    const ganttContainer = document.getElementById('tasks-gantt-view');
    if (!listContainer || !kanbanContainer || !assignContainer || !ganttContainer) return;

    if (!tasks || tasks.length === 0) {
        const emptyState = '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; color: #6b7280;"><span class="material-symbols-outlined" style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;">assignment_turned_in</span><p>Danh sách công việc đã giao sẽ hiển thị ở đây.</p></div>';
        listContainer.innerHTML = emptyState;
        kanbanContainer.innerHTML = emptyState;
        assignContainer.innerHTML = emptyState;
        ganttContainer.innerHTML = emptyState;
        return;
    }

    // Hide all views first
    listContainer.style.display = 'none';
    kanbanContainer.style.display = 'none';
    assignContainer.style.display = 'none';
    ganttContainer.style.display = 'none';

    if (currentTaskView === 'list') {
        listContainer.style.display = 'block';
        renderTaskListView(tasks, listContainer);
    } else if (currentTaskView === 'kanban') {
        if (currentKanbanSubView === 'progress') {
            kanbanContainer.style.display = 'block';
            renderKanbanBoard(tasks, kanbanContainer);
        } else {
            assignContainer.style.display = 'block';
            renderAssignKanban(tasks, assignContainer);
        }
    } else if (currentTaskView === 'gantt') {
        ganttContainer.style.display = 'block';
        renderGanttChart(tasks, ganttContainer);
    }
}

/** Global helper: generate avatar HTML with rank frame */
function getWorkerAvatarHtml(worker, size) {
    size = size || 28;
    const rank = (worker && worker.rankLevel) ? worker.rankLevel : 'TRAINEE';
    const avatarUrl = worker && worker.avatarUrl ? worker.avatarUrl : null;
    const name = worker ? (worker.fullName || worker.email || 'N') : '?';
    const char = name.charAt(0).toUpperCase();
    const inner = avatarUrl
        ? `<img src="${avatarUrl}" alt="" style="width:${size}px; height:${size}px; border-radius:50%; object-fit:cover;">`
        : `<div style="width:${size}px; height:${size}px; border-radius:50%; background:#dbeafe; color:#2563eb; display:flex; align-items:center; justify-content:center; font-size:${Math.round(size * 0.45)}px; font-weight:700;">${escapeHtml(char)}</div>`;
    return `<div class="rank-frame-mini rank-${rank}" title="${escapeHtml(name)}">${inner}</div>`;
}

function renderTaskListView(tasks, container) {
    let html = '<div id="owner-tasks-list" style="display: flex; flex-direction: column; gap: 12px;">';

    tasks.forEach(task => {
        let statusBadge = getStatusBadge(task.status);
        // Workflow tasks that are COMPLETED but not yet approved show "Chờ duyệt"
        if (task.status === 'COMPLETED' && task.workflowData) {
            statusBadge = '<span class="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Chờ duyệt</span>';
        }

        const dueText = task.dueDate
            ? new Date(task.dueDate).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
            : 'Chưa đặt hạn';

        const isAutoCreated = task.isAutoCreated === true;
        const wId = task.worker && task.worker.id != null ? Number(task.worker.id) : null;
        const oId = task.owner && task.owner.id != null ? Number(task.owner.id) : null;
        const isSelf = wId != null && oId != null && wId === oId;
        const displayWorkerName = task.worker
            ? (task.worker.fullName || task.worker.email || 'Nhân công')
            : (isAutoCreated ? 'Chưa phân công' : 'Tôi (Tự làm)');

        // Avatar with rank frame
        const avatarHtml = getWorkerAvatarHtml(task.worker, 28);

        let completedTime = '';
        if (task.status === 'COMPLETED' && task.completedAt) {
            const date = new Date(task.completedAt);
            completedTime = date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
        }

        const typeLabel = getTaskTypeLabel(task.taskType);

        const priority = (task.priority || 'NORMAL').toUpperCase();
        let priorityStyle = 'background:#f3f4f6; color:#6b7280;';
        let priorityLabel = 'Bình thường';
        if (priority === 'HIGH' || priority === 'URGENT') {
            priorityStyle = 'background:#fef2f2; color:#dc2626;';
            priorityLabel = priority === 'URGENT' ? 'Khẩn cấp' : 'Cao';
        } else if (priority === 'LOW') {
            priorityStyle = 'background:#f0fdf4; color:#16a34a;';
            priorityLabel = 'Thấp';
        }

        // === ASSIGNEE LOCK LOGIC ===
        let assignBlock = '';
        const isApproved = task.status === 'APPROVED';
        const isLocked = task.status === 'IN_PROGRESS' || task.status === 'COMPLETED';

        if (isApproved) {
            // Premium approved lock block with glassmorphism feel inside the green card
            assignBlock = `
                <div style="display:flex; justify-content: space-between; align-items:center; margin-top:14px; padding: 12px 16px; background: rgba(255,255,255,0.6); border-radius: 10px; border: 1px solid rgba(134, 239, 172, 0.5);" onclick="event.stopPropagation()">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${avatarHtml}
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-size:11px; font-weight:600; color:#15803d; text-transform: uppercase; letter-spacing: 0.5px;">Người thực hiện</span>
                            <span style="font-size:14px; font-weight:700; color:#064e3b;">${escapeHtml(displayWorkerName)}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; color: #16a34a; background: #dcfce7; padding: 6px 14px; border-radius: 999px;">
                        <span class="material-symbols-outlined" style="font-size:18px;">verified</span>
                        <span style="font-size:13px; font-weight:700;">Đã hoàn thành</span>
                    </div>
                </div>
            `;
        } else if (isLocked) {
            // Modern locked block
            assignBlock = `
                <div style="display:flex; justify-content: space-between; align-items:center; margin-top:14px; padding: 12px 16px; background: #f8fafc; border-radius: 10px; border: 1px dashed #cbd5e1;" onclick="event.stopPropagation()">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${avatarHtml}
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-size:11px; font-weight:600; color:#64748b; text-transform: uppercase; letter-spacing: 0.5px;">Người thực hiện</span>
                            <span style="font-size:14px; font-weight:700; color:#334155;">${escapeHtml(displayWorkerName)}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; color: #b45309; background: #fef3c7; padding: 6px 14px; border-radius: 999px;">
                        <span class="material-symbols-outlined" style="font-size:16px;">lock</span>
                        <span style="font-size:13px; font-weight:700;">Đang thực hiện</span>
                    </div>
                </div>
            `;
        } else if (task.status !== 'CANCELLED') {
            // PENDING - allow assignment
            let selected = '';
            if (isSelf) selected = 'SELF';
            else if (wId != null) selected = String(wId);
            else selected = isAutoCreated ? '' : 'SELF';

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
                <div style="display:flex; gap:8px; align-items:center; margin-top:10px; padding-top:10px; border-top:1px solid #f3f4f6;" onclick="event.stopPropagation()">
                    <span class="material-symbols-outlined" style="font-size:18px; color:#9ca3af;">person_add</span>
                    <select id="assign-worker-${task.id}" class="modal-input" style="padding:6px 10px; margin:0; font-size:13px; flex:1; min-width:0; border-radius:8px;">
                        ${options}
                    </select>
                    <button class="btn btn--secondary" style="padding:6px 16px; font-size:13px; white-space:nowrap; border-radius:8px;" onclick="quickAssignTask(${task.id})">
                        <span class="material-symbols-outlined" style="font-size:16px; vertical-align:middle;">save</span> Lưu
                    </button>
                </div>
            `;
        }

        // Card class based on status
        const cardExtraClass = isApproved ? ' task-card-approved' : '';
        const isPending = (task.status || 'PENDING').toUpperCase() === 'PENDING';
        const deleteRedDot = isPending ? `
            <div class="task-delete-dot" onclick="event.stopPropagation(); showDeleteConfirmModal(${task.id}, '${escapeHtml(task.name).replace(/'/g, "\\'")}')"
                 title="Xóa công việc">
                <span class="material-symbols-outlined" style="font-size:14px;">close</span>
            </div>` : '';

        html += `
            <div style="position:relative; background:white; border:1px solid #e5e7eb; border-radius:12px; padding:16px; transition:box-shadow 0.2s, transform 0.2s; cursor:pointer;"
                 class="task-list-card ${cardExtraClass}"
                 onmouseenter="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'; this.style.transform='translateY(-1px)'"
                 onmouseleave="this.style.boxShadow='none'; this.style.transform='translateY(0)'"
                 onclick="openOwnerTaskDetail(${task.id})">
                ${deleteRedDot}
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <span style="font-weight:700; color:#111827; font-size:15px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:300px;">${escapeHtml(task.name)}</span>
                            <span style="font-size:12px; font-weight:600; padding:2px 10px; border-radius:999px; ${priorityStyle}; white-space:nowrap;">${priorityLabel}</span>
                            <span style="font-size:12px; font-weight:500; padding:2px 10px; border-radius:999px; background:#f3f4f6; color:#6b7280; white-space:nowrap;">${typeLabel}</span>
                        </div>
                        ${task.description ? `<p style="margin:6px 0 0; font-size:13px; color:#6b7280; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:400px;">${escapeHtml(task.description)}</p>` : ''}
                    </div>
                    <div style="flex-shrink:0;">
                        ${statusBadge}
                    </div>
                </div>

                <div style="display:flex; gap:20px; margin-top:12px; flex-wrap:wrap; font-size:13px; color:#6b7280;">
                    <div style="display:flex; align-items:center; gap:6px; white-space:nowrap;">
                        ${avatarHtml}
                        <span style="font-weight:500; color:#374151; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:150px;">${escapeHtml(displayWorkerName)}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:4px; white-space:nowrap;">
                        <span class="material-symbols-outlined" style="font-size:16px;">schedule</span>
                        <span>Hạn: ${escapeHtml(dueText)}</span>
                    </div>
                    ${completedTime ? `
                    <div style="display:flex; align-items:center; gap:4px; white-space:nowrap; color:#16a34a;">
                        <span class="material-symbols-outlined" style="font-size:16px;">check_circle</span>
                        <span>Xong: ${escapeHtml(completedTime)}</span>
                    </div>
                    ` : ''}
                </div>

                ${assignBlock}
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// ============ KANBAN BOARD VIEW ============

let currentKanbanSubView = 'progress';

function toggleTaskView(view) {
    currentTaskView = view;
    // Update main button states
    document.getElementById('view-toggle-list').classList.toggle('active', view === 'list');
    document.getElementById('view-toggle-kanban').classList.toggle('active', view === 'kanban');
    const ganttBtn = document.getElementById('view-toggle-gantt');
    if (ganttBtn) ganttBtn.classList.toggle('active', view === 'gantt');

    // Toggle kanban controls row when Kanban is active
    const controlsRow = document.getElementById('kanban-controls-row');
    if (controlsRow) {
        controlsRow.style.display = (view === 'kanban') ? 'flex' : 'none';
        
        // Ensure group control is only visible in 'progress' sub-view
        const groupControl = document.getElementById('kanban-group-control');
        if (groupControl) {
            groupControl.style.display = (currentKanbanSubView === 'progress') ? 'flex' : 'none';
        }
    }

    if (ownerTasksById) {
        renderTasks(Object.values(ownerTasksById));
    } else {
        loadTasks();
    }
}

function switchKanbanSubView(type) {
    currentKanbanSubView = type;
    const progBtn = document.getElementById('sub-toggle-progress');
    const assignBtn = document.getElementById('sub-toggle-assign');
    if (progBtn) progBtn.classList.toggle('active', type === 'progress');
    if (assignBtn) assignBtn.classList.toggle('active', type === 'assign');

    const groupControl = document.getElementById('kanban-group-control');
    if (groupControl) {
        groupControl.style.display = (type === 'progress') ? 'flex' : 'none';
    }

    if (ownerTasksById) {
        renderTasks(Object.values(ownerTasksById));
    } else {
        loadTasks();
    }
}

function toggleKanbanGroupBy(groupVal) {
    currentKanbanGroupBy = groupVal;
    if (ownerTasksById) {
        renderTasks(Object.values(ownerTasksById));
    } else {
        loadTasks();
    }
}

function renderKanbanBoard(tasks, container) {
    const columns = [
        { id: 'PENDING', title: 'Chờ thực hiện', color: 'PENDING' },
        { id: 'IN_PROGRESS', title: 'Đang thực hiện', color: 'IN_PROGRESS' },
        { id: 'COMPLETED', title: 'Chưa duyệt / Đã xong', color: 'COMPLETED' }
    ];

    let html = '';

    // Function to generate cards HTML for a specific column and task subset
    const generateColumnHTML = (col, subsetTasks) => {
        let colHtml = `
            <div class="kanban-column">
                <div class="kanban-column-header kanban-header-${col.color}">
                    <span>${col.title}</span>
                    <span class="kanban-count">${subsetTasks.length}</span>
                </div>
                <div class="kanban-cards" id="kanban-col-${col.id}">
        `;

        subsetTasks.forEach(task => {
            const isWorkflowPending = (task.status === 'COMPLETED' && task.workflowData);
            const dueText = task.dueDate ? new Date(task.dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : 'Chưa đặt hạn';
            const typeLabel = getTaskTypeLabel(task.taskType);
            const priority = (task.priority || 'NORMAL').toUpperCase();
            let priorityStyle = 'background:#f3f4f6; color:#6b7280;';
            let priorityLabel = 'BT';
            if (priority === 'HIGH' || priority === 'URGENT') {
                priorityStyle = 'background:#fef2f2; color:#dc2626;';
                priorityLabel = priority === 'URGENT' ? 'Khẩn' : 'Cao';
            } else if (priority === 'LOW') {
                priorityStyle = 'background:#f0fdf4; color:#16a34a;';
                priorityLabel = 'Thấp';
            }
            const avatarChar = task.worker ? (task.worker.fullName || task.worker.email || 'N').charAt(0).toUpperCase() : '?';
            const avatarHtml = getWorkerAvatarHtml(task.worker, 24);

            const kbIsPending = (task.status || 'PENDING').toUpperCase() === 'PENDING';
            const kbDeleteBtn = kbIsPending ? `<div class="kb-delete-btn" onclick="event.stopPropagation(); showDeleteConfirmModal(${task.id}, '${escapeHtml(task.name).replace(/'/g, "\\'")}')"
                 title="Xóa công việc"><span class="material-symbols-outlined" style="font-size:14px;">close</span></div>` : '';
            colHtml += `
                <div class="kanban-card" onclick="openOwnerTaskDetail(${task.id})" id="kb-card-${task.id}" style="position:relative;">
                    ${kbDeleteBtn}
                    <div class="kb-card-tags">
                        <span style="font-size:10px; font-weight:600; padding:2px 6px; border-radius:4px; ${priorityStyle};">${priorityLabel}</span>
                        <span style="font-size:10px; font-weight:500; padding:2px 6px; border-radius:4px; background:#f3f4f6; color:#6b7280;">${typeLabel}</span>
                        ${isWorkflowPending ? `<span style="font-size:10px; font-weight:600; padding:2px 6px; border-radius:4px; background:#fef08a; color:#854d0e;">Chờ duyệt</span>` : ''}
                    </div>
                    <div class="kb-card-title" title="${escapeHtml(task.name)}">${escapeHtml(task.name)}</div>
                    <div class="kb-card-footer">
                        <div style="display:flex; align-items:center; gap:4px;">
                            <span class="material-symbols-outlined" style="font-size:14px;">schedule</span>${dueText}
                        </div>
                        ${avatarHtml}
                    </div>
                </div>
            `;
        });
        colHtml += `</div></div>`;
        return colHtml;
    };

    if (currentKanbanGroupBy === 'none') {
        // Standard View
        html += '<div class="kanban-board">';
        columns.forEach(col => {
            const colTasks = tasks.filter(t => (col.id === 'PENDING' ? (t.status === 'PENDING' || !t.status) : t.status === col.id));
            html += generateColumnHTML(col, colTasks);
        });
        html += '</div>';
    } else if (currentKanbanGroupBy === 'worker') {
        // Group by Worker Swimlanes
        const groups = {};
        tasks.forEach(t => {
            const workerId = t.worker ? Number(t.worker.id) : 0; // 0 for unassigned
            const workerName = t.worker ? (t.worker.fullName || t.worker.email || 'Nhân công ' + workerId) : 'Chưa phân công';
            const workerAvatar = t.worker ? workerName.charAt(0).toUpperCase() : '?';

            if (!groups[workerId]) {
                groups[workerId] = { name: workerName, avatar: workerAvatar, tasks: [] };
            }
            groups[workerId].tasks.push(t);
        });

        const sortedWorkerIds = Object.keys(groups).sort((a, b) => {
            if (a == 0) return 1; // Unassigned at bottom
            if (b == 0) return -1;
            return groups[a].name.localeCompare(groups[b].name);
        });

        sortedWorkerIds.forEach(workerId => {
            const group = groups[workerId];
            html += `
                <div class="kanban-swimlane">
                    <div class="kanban-swimlane-header">
                        <div class="kb-avatar">${escapeHtml(group.avatar)}</div>
                        <span>${escapeHtml(group.name)}</span>
                        <span style="font-size:12px; font-weight:500; color:#64748b; background:#e2e8f0; padding:2px 8px; border-radius:99px;">${group.tasks.length} Việc</span>
                    </div>
                    <div class="kanban-swimlane-body">
            `;

            columns.forEach(col => {
                const colTasks = group.tasks.filter(t => (col.id === 'PENDING' ? (t.status === 'PENDING' || !t.status) : t.status === col.id));
                html += generateColumnHTML(col, colTasks);
            });

            html += `</div></div>`;
        });
    }

    container.innerHTML = html;
}

// ==== Kanban Drag & Drop ====
function kbDragStart(event, taskId) {
    event.dataTransfer.setData('text/plain', taskId);
    setTimeout(() => {
        event.target.classList.add('dragging');
    }, 0);
}

function kbDragOver(event) {
    event.preventDefault();
    const column = event.currentTarget.querySelector('.kanban-cards');
    if (!column.classList.contains('kanban-dropzone')) {
        column.classList.add('kanban-dropzone');
    }
}

async function kbDrop(event, newStatus) {
    event.preventDefault();
    document.querySelectorAll('.kanban-cards').forEach(c => c.classList.remove('kanban-dropzone'));

    const taskIdString = event.dataTransfer.getData('text/plain');
    if (!taskIdString) return;
    const taskId = parseInt(taskIdString);
    if (isNaN(taskId)) return;

    const task = ownerTasksById[taskId];
    if (!task) return;

    // Remove dragging class
    const cardEl = document.getElementById('kb-card-' + taskId);
    if (cardEl) cardEl.classList.remove('dragging');

    // Prevent changing to the same status
    if (task.status === newStatus || (!task.status && newStatus === 'PENDING')) return;

    // Cannot change COMPLETED back to PENDING/IN_PROGRESS without cancel/reject logic
    // But for a simple Kanban UI, we allow Owner to override statuses quickly if needed,
    // though the DB might reject it depending on state machine logic.
    // Let's call an update API.

    try {
        const token = localStorage.getItem('token');
        const updateParams = { status: newStatus };

        await fetchAPI(`${LABOR_API_BASE}/tasks/${taskId}/quick-update`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateParams)
        });

        agriAlert(`Đã chuyển công việc sang "${newStatus === 'PENDING' ? 'Chờ thực hiện' : (newStatus === 'IN_PROGRESS' ? 'Đang làm' : 'Đã hoàn thành')}"`, 'success');

        // Reload tasks to refresh the board UI
        loadTasks();

    } catch (e) {
        console.error('Error updating task status via Kanban:', e);
        agriAlert('Chưa thể cập nhật trạng thái: ' + e.message, 'error');
        // Reload to revert drag failure
        loadTasks();
    }
}

// Make sure to remove dragging visual if dropped outside
document.addEventListener('dragend', (e) => {
    if (e.target.classList && e.target.classList.contains('kanban-card')) {
        e.target.classList.remove('dragging');
    }
    document.querySelectorAll('.kanban-cards').forEach(c => c.classList.remove('kanban-dropzone'));
});

// ============ ASSIGNMENT KANBAN (Columns = Workers) ============

async function renderAssignKanban(tasks, container) {
    // Fetch worker list
    let workers = [];
    try {
        const res = await fetchAPI(`${LABOR_API_BASE}/user/list?role=WORKER&farmId=${myFarmId || 1}`);
        workers = Array.isArray(res) ? res : [];
    } catch (e) {
        workers = [];
    }

    // Group tasks by workerId
    const groups = { 0: { name: '- Chưa phân công / Tôi tự làm -', avatar: null, avatarChar: '?', rankLevel: 'TRAINEE', tasks: [] } };
    workers.forEach(w => {
        groups[w.id] = {
            name: w.fullName || w.email || 'Worker ' + w.id,
            avatar: w.avatarUrl || null,
            avatarChar: (w.fullName || w.email || 'W').charAt(0).toUpperCase(),
            rankLevel: w.rankLevel || 'TRAINEE',
            tasks: []
        };
    });

    tasks.forEach(t => {
        const wId = t.worker && t.worker.id != null ? Number(t.worker.id) : 0;
        if (!groups[wId]) {
            // Worker exists but wasn't in the list (e.g. owner self-assigned)
            const wName = t.worker ? (t.worker.fullName || t.worker.email || 'Worker') : 'Chưa phân công';
            groups[wId] = {
                name: wName,
                avatar: t.worker ? t.worker.avatarUrl : null,
                avatarChar: wName.charAt(0).toUpperCase(),
                rankLevel: t.worker ? (t.worker.rankLevel || 'TRAINEE') : 'TRAINEE',
                tasks: []
            };
        }
        groups[wId].tasks.push(t);
    });

    // Sort: unassigned first, then by worker name
    const sortedIds = Object.keys(groups).sort((a, b) => {
        if (a == 0) return -1;
        if (b == 0) return 1;
        return groups[a].name.localeCompare(groups[b].name);
    });

    let html = '<div class="assign-kanban-board">';

    sortedIds.forEach(wId => {
        const group = groups[wId];
        const isUnassigned = (wId == 0);
        const colClass = isUnassigned ? 'assign-kanban-col assign-kanban-col-unassigned' : 'assign-kanban-col';
        const rank = group.rankLevel || 'TRAINEE';

        const avatarInner = group.avatar
            ? `<img src="${group.avatar}" alt="" style="width:28px; height:28px; border-radius:50%; object-fit:cover;">`
            : `<div class="kb-avatar">${escapeHtml(group.avatarChar)}</div>`;
        const avatarHtml = `<div class="rank-frame-mini rank-${rank}">${avatarInner}</div>`;

        html += `
            <div class="${colClass}" ondragover="assignKbDragOver(event)" ondrop="assignKbDrop(event, '${wId}')">
                <div class="assign-kanban-col-header">
                    <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
                        ${avatarHtml}
                        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(group.name)}</span>
                    </div>
                    <span class="kanban-count">${group.tasks.length}</span>
                </div>
                <div class="kanban-cards" id="assign-col-${wId}">
        `;

        group.tasks.forEach(task => {
            const statusMap = {
                'COMPLETED': { label: 'Xong', color: '#16a34a', bg: '#f0fdf4' },
                'IN_PROGRESS': { label: 'Đang làm', color: '#2563eb', bg: '#eff6ff' },
                'PENDING': { label: 'Chờ', color: '#d97706', bg: '#fffbeb' },
                'APPROVED': { label: 'Duyệt', color: '#7c3aed', bg: '#f5f3ff' }
            };
            const st = task.status ? String(task.status).toUpperCase() : 'PENDING';
            const sc = statusMap[st] || statusMap['PENDING'];

            const typeLabel = getTaskTypeLabel(task.taskType);
            const dueText = task.dueDate
                ? new Date(task.dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
                : '';

            const isCompleted = (st === 'COMPLETED' || st === 'APPROVED');
            const draggableStr = isCompleted ? 'draggable="false"' : 'draggable="true" ondragstart="kbDragStart(event, ' + task.id + ')"';
            const cardStyle = isCompleted ? 'border-left: 4px solid #10b981; opacity: 0.85;' : '';

            const assignIsPending = (st === 'PENDING');
            const assignDeleteBtn = assignIsPending ? `<div class="kb-delete-btn" onclick="event.stopPropagation(); showDeleteConfirmModal(${task.id}, '${escapeHtml(task.name).replace(/'/g, "\\'")}')"
                 title="Xóa công việc"><span class="material-symbols-outlined" style="font-size:14px;">close</span></div>` : '';
            html += `
                <div class="kanban-card" style="position:relative; ${cardStyle}" ${draggableStr} onclick="openOwnerTaskDetail(${task.id})" id="assign-card-${task.id}">
                    ${assignDeleteBtn}
                    <div class="kb-card-tags">
                        <span style="font-size:10px; font-weight:600; padding:2px 6px; border-radius:4px; background:${sc.bg}; color:${sc.color}; display:flex; align-items:center; gap:2px;">
                            ${isCompleted ? '<span class="material-symbols-outlined" style="font-size:12px;">check_circle</span>' : ''} ${sc.label}
                        </span>
                        <span style="font-size:10px; font-weight:500; padding:2px 6px; border-radius:4px; background:#f3f4f6; color:#6b7280;">${typeLabel}</span>
                    </div>
                    <div class="kb-card-title" title="${escapeHtml(task.name)}">${escapeHtml(task.name)}</div>
                    ${dueText ? `<div style="font-size:11px; color:#64748b; margin-top:4px; display:flex; align-items:center; gap:4px;">
                        <span class="material-symbols-outlined" style="font-size:13px;">schedule</span>${dueText}
                    </div>` : ''}
                </div>
            `;
        });

        html += `</div></div>`;
    });

    html += '</div>';
    container.innerHTML = html;
}

function assignKbDragOver(event) {
    event.preventDefault();
    const column = event.currentTarget.querySelector('.kanban-cards');
    if (column && !column.classList.contains('kanban-dropzone')) {
        column.classList.add('kanban-dropzone');
    }
}

async function assignKbDrop(event, newWorkerIdStr) {
    event.preventDefault();
    document.querySelectorAll('.kanban-cards').forEach(c => c.classList.remove('kanban-dropzone'));

    const taskIdString = event.dataTransfer.getData('text/plain');
    if (!taskIdString) return;
    const taskId = parseInt(taskIdString);
    if (isNaN(taskId)) return;

    const task = ownerTasksById[taskId];
    if (!task) return;

    const cardEl = document.getElementById('assign-card-' + taskId);
    if (cardEl) cardEl.classList.remove('dragging');

    const currentWorkerId = task.worker && task.worker.id != null ? String(task.worker.id) : '0';
    if (currentWorkerId === newWorkerIdStr) return;

    const newWorkerId = newWorkerIdStr === '0' ? null : Number(newWorkerIdStr);

    try {
        const ownerId = await getCurrentUserId();
        if (!ownerId) throw new Error('Không xác định được chủ trang trại');

        await fetchAPI(`${LABOR_API_BASE}/tasks/${taskId}/assign`, 'PUT', {
            ownerId: ownerId,
            workerId: newWorkerId
        });

        const workerName = newWorkerId ? (ownerTasksById[taskId]?.worker?.fullName || 'nhân công') : 'chưa phân công';
        agriAlert(`Đã chuyển công việc cho "${newWorkerId ? workerName : 'Chưa phân công'}"`, 'success');
        loadTasks();
    } catch (e) {
        console.error('Error reassigning task via Assignment Kanban:', e);
        agriAlert('Chưa thể chuyển phân công: ' + e.message, 'error');
        loadTasks();
    }
}

// ============ GANTT CHART ============
let currentGanttMode = 'DAY'; // 'DAY' or 'HOUR'

function toggleGanttMode(mode) {
    currentGanttMode = mode;
    if (ownerTasksById) {
        renderGanttChart(Object.values(ownerTasksById), document.getElementById('tasks-gantt-view'));
    }
}

function renderGanttChart(tasks, container) {
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:2rem; color:#6b7280;">Không có công việc nào để hiển thị biểu đồ.</p>';
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let timelineStartMs, timelineEndMs, totalDurationMs;
    const cols = [];

    if (currentGanttMode === 'DAY') {
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 2);
        timelineStartMs = startDate.getTime();
        timelineEndMs = timelineStartMs + (14 * 24 * 60 * 60 * 1000) - 1;
        totalDurationMs = 14 * 24 * 60 * 60 * 1000;

        for (let i = 0; i < 14; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const isToday = d.getTime() === today.getTime();
            cols.push({ label: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }), isHighlight: isToday });
        }
    } else {
        // HOUR view
        timelineStartMs = today.getTime();
        timelineEndMs = timelineStartMs + (24 * 60 * 60 * 1000) - 1;
        totalDurationMs = 24 * 60 * 60 * 1000;

        const currentHour = new Date().getHours();
        for (let i = 0; i < 24; i++) {
            cols.push({ label: i + 'h', isHighlight: (i === currentHour) });
        }
    }

    let html = '<div class="gantt-container">';

    // Toggle
    html += `<div style="padding:10px 16px; border-bottom:1px solid #e2e8f0; display:flex; gap:8px;">
        <button onclick="toggleGanttMode('DAY')" style="padding:6px 12px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; background:${currentGanttMode === 'DAY' ? '#3b82f6' : '#f1f5f9'}; color:${currentGanttMode === 'DAY' ? 'white' : '#475569'}; border:none;">Theo Ngày</button>
        <button onclick="toggleGanttMode('HOUR')" style="padding:6px 12px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; background:${currentGanttMode === 'HOUR' ? '#3b82f6' : '#f1f5f9'}; color:${currentGanttMode === 'HOUR' ? 'white' : '#475569'}; border:none;">Theo Giờ (Hôm nay)</button>
    </div>`;

    // Header
    html += '<div class="gantt-header">';
    html += '<div class="gantt-task-name" style="border-bottom:none;">Tên công việc</div>';
    html += '<div style="display:flex; flex:1;">';
    cols.forEach(c => {
        html += `<div class="gantt-header-cell ${c.isHighlight ? 'today' : ''}">${c.label}</div>`;
    });
    html += '</div></div>';

    // Sort tasks
    const sortedTasks = [...tasks].sort((a, b) => {
        const ad = new Date(a.createdAt || a.dueDate || 0).getTime();
        const bd = new Date(b.createdAt || b.dueDate || 0).getTime();
        return ad - bd;
    });

    sortedTasks.forEach(task => {
        let taskStart = task.createdAt ? new Date(task.createdAt) : new Date();
        let taskEnd;
        if (task.completedAt) {
            taskEnd = new Date(task.completedAt);
        } else if (task.dueDate) {
            taskEnd = new Date(task.dueDate);
        } else {
            taskEnd = new Date(); // up to now if no due/complete
        }

        // Ensure end >= start
        if (taskEnd.getTime() < taskStart.getTime()) {
            taskEnd = new Date(taskStart.getTime() + 60 * 60 * 1000); // add 1h min
        }

        if (taskEnd.getTime() < timelineStartMs || taskStart.getTime() > timelineEndMs) {
            return;
        }

        const renderStart = Math.max(taskStart.getTime(), timelineStartMs);
        const renderEnd = Math.min(taskEnd.getTime(), timelineEndMs);

        const leftPercent = ((renderStart - timelineStartMs) / totalDurationMs) * 100;
        const widthPercent = ((renderEnd - renderStart) / totalDurationMs) * 100;

        const st = task.status ? String(task.status).toUpperCase() : 'PENDING';

        html += `<div class="gantt-row">`;
        html += `<div class="gantt-task-name">
                    <div style="width:8px; height:8px; flex-shrink:0; border-radius:50%; background:${st === 'COMPLETED' ? '#16a34a' : (st === 'IN_PROGRESS' ? '#2563eb' : '#d97706')};"></div>
                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(task.name)}">${escapeHtml(task.name)}</span>
                 </div>`;
        html += `<div class="gantt-grid">`;

        cols.forEach(c => {
            html += `<div class="gantt-grid-cell ${c.isHighlight ? 'today-col' : ''}"></div>`;
        });

        html += `<div class="gantt-bar status-${st}" 
                      style="left: ${leftPercent}%; width: ${Math.max(widthPercent, 1)}%;"
                      onclick="openOwnerTaskDetail(${task.id})"
                      title="${escapeHtml(task.name)}\nKhởi tạo: ${taskStart.toLocaleString('vi-VN')}\nKết thúc/Hạn: ${taskEnd.toLocaleString('vi-VN')}">
                    ${widthPercent > 5 ? escapeHtml(task.name) : ''}
                 </div>`;

        html += `</div></div>`;
    });

    html += '</div>';
    container.innerHTML = html;
}

// ============ OWNER TASK DETAIL VIEW ============
function getTaskIconOwner(taskType) {
    const icons = { 'FEED': 'restaurant', 'CLEAN': 'cleaning_services', 'HARVEST': 'agriculture', 'BUY_SUPPLIES': 'shopping_cart', 'PLANT': 'park', 'SEED': 'grass', 'FERTILIZE': 'science', 'WATER': 'water_drop', 'PEST_CONTROL': 'bug_report', 'VACCINATE': 'vaccines', 'SELL': 'store', 'INSPECTION': 'search', 'OTHER': 'task' };
    return icons[taskType] || 'task';
}

function buildInspectionResultsHtml(task) {
    if (!task) return '';
    const status = task.status ? String(task.status).toUpperCase() : '';
    if (status !== 'COMPLETED' && status !== 'APPROVED') return '';

    // Material-consuming tasks: show material info instead of inspection results
    const materialTaskTypes = ['FEED', 'VACCINATE', 'FERTILIZE', 'SEED', 'PEST_CONTROL'];
    const taskType = task.taskType ? String(task.taskType).toUpperCase() : '';
    if (materialTaskTypes.includes(taskType)) {
        return buildOwnerMaterialResultsHtml(task);
    }

    // Byproduct collection tasks: show collected quantity info
    if (taskType === 'HARVEST' && task.workflowData) {
        try {
            const wfData = typeof task.workflowData === 'string' ? JSON.parse(task.workflowData) : task.workflowData;
            if (wfData.subType === 'BYPRODUCT_COLLECTION') {
                return buildOwnerByproductResultsHtml(task, wfData);
            }
        } catch (e) { }
    }

    // Parse inspection data from description (appended by worker)
    const desc = task.description || '';
    const aiLines = desc.split('\n').filter(l => l.startsWith('AI:'));
    if (aiLines.length === 0) return '';

    const aiData = aiLines.map(l => l.replace(/^AI:\s*/, '')).join('\n');

    // Extract condition assessment
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

    // Extract photo info
    const photoMatches = aiData.match(/Ảnh chuồng:\s*([^\|]+)/);
    const photo2Matches = aiData.match(/Ảnh vật nuôi:\s*([^\|]+)/);
    const photo1Name = photoMatches ? photoMatches[1].trim() : null;
    const photo2Name = photo2Matches ? photo2Matches[1].trim() : null;

    // Use server URLs first (task.reportImageUrl / task.reportVideoUrl), fallback to localStorage
    const _apiOrigin = new URL(LABOR_API_BASE).origin;
    const serverImageUrl = task.reportImageUrl ? (_apiOrigin + task.reportImageUrl) : null;
    const serverVideoUrl = task.reportVideoUrl ? (_apiOrigin + task.reportVideoUrl) : null;
    const photoStore = JSON.parse(localStorage.getItem('inspectionPhotos') || '{}');
    const photo1Data = serverImageUrl || photoStore[`task_${task.id}_photo1`] || null;
    const photo2Data = photoStore[`task_${task.id}_photo2`] || null;
    const videoData = serverVideoUrl || photoStore[`task_${task.id}_video`] || null;

    // Extract video info
    const videoMatch = aiData.match(/Video:\s*([^\|]+)/);
    const videoName = videoMatch ? videoMatch[1].trim() : null;

    // Extract mortality info
    const mortalityMatch = aiData.match(/Hao hụt:\s*(\d+)\s*con(?:\s*\((\w+)\)\s*-\s*(.+))?/);
    const mortalityQty = mortalityMatch ? mortalityMatch[1] : null;
    const mortalityCauseType = mortalityMatch ? (mortalityMatch[2] || null) : null;
    const mortalityCause = mortalityMatch ? (mortalityMatch[3] ? mortalityMatch[3].trim() : null) : null;

    const causeTypeLabels = { 'DEATH': 'Chết', 'DISEASE': 'Bệnh', 'ACCIDENT': 'Tai nạn', 'CULL': 'Loại thải' };

    let html = `<div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px; margin-bottom:16px;">
        <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:16px; display:flex; align-items:center; gap:6px;">
            <span class="material-symbols-outlined" style="font-size:18px; color:#2563eb;">assignment_turned_in</span>
            Báo cáo từ nhân công
        </div>`;

    // Condition assessment
    if (conditionLabel) {
        html += `<div style="display:flex; align-items:center; gap:12px; margin-bottom:14px; padding:12px 16px; border-radius:12px; background:${conditionColor}11; border:1px solid ${conditionColor}22;">
            <span class="material-symbols-outlined" style="font-size:28px; color:${conditionColor};">${conditionIcon}</span>
            <div>
                <div style="font-size:12px; color:#6b7280;">Đánh giá tình trạng</div>
                <div style="font-size:16px; font-weight:700; color:${conditionColor};">${conditionLabel}</div>
            </div>
        </div>`;
    }

    // Photos/Video media section
    const hasMedia = photo1Name || photo2Name || videoName || serverImageUrl || serverVideoUrl;
    if (hasMedia) {
        html += `<div style="margin-bottom:14px;">
            <div style="font-size:12px; font-weight:500; color:#6b7280; margin-bottom:8px;">Minh chứng đính kèm</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px;">`;
        if (photo1Name || serverImageUrl) {
            const imgSrc = photo1Data;
            html += `<div style="border-radius:10px; background:#f0fdf4; border:1px solid #bbf7d0; overflow:hidden;">
                ${imgSrc ? `<img src="${imgSrc}" style="width:100%; max-height:200px; object-fit:cover; cursor:pointer;" alt="Ảnh chuồng" onclick="openMediaLightbox(this.src, 'image')">` : `<div style="padding:20px; text-align:center; color:#9ca3af;"><span class="material-symbols-outlined" style="font-size:40px;">image</span><div style="font-size:12px; margin-top:4px;">Không tải được ảnh</div></div>`}
                <div style="padding:8px 12px; display:flex; align-items:center; gap:6px;">
                    <span class="material-symbols-outlined" style="font-size:18px; color:#16a34a;">photo_camera</span>
                    <div>
                        <div style="font-size:11px; font-weight:600; color:#15803d;">Ảnh</div>
                        <div style="font-size:10px; color:#6b7280; word-break:break-all;">${escapeHtml(photo1Name || 'Ảnh báo cáo')}</div>
                    </div>
                </div>
            </div>`;
        }
        if (photo2Name) {
            html += `<div style="border-radius:10px; background:#fff7ed; border:1px solid #fed7aa; overflow:hidden;">
                ${photo2Data ? `<img src="${photo2Data}" style="width:100%; max-height:200px; object-fit:cover; cursor:pointer;" alt="Ảnh vật nuôi" onclick="openMediaLightbox(this.src, 'image')">` : `<div style="padding:20px; text-align:center; color:#9ca3af;"><span class="material-symbols-outlined" style="font-size:40px;">image</span><div style="font-size:12px; margin-top:4px;">Không tải được ảnh</div></div>`}
                <div style="padding:8px 12px; display:flex; align-items:center; gap:6px;">
                    <span class="material-symbols-outlined" style="font-size:18px; color:#ea580c;">pets</span>
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
                ${vidSrc ? `<video src="${vidSrc}" style="width:100%; max-height:200px; object-fit:cover; cursor:pointer;" onclick="openMediaLightbox(this.src, 'video')" preload="metadata"></video>` : `<div style="padding:20px; text-align:center; color:#9ca3af;"><span class="material-symbols-outlined" style="font-size:40px;">videocam_off</span><div style="font-size:12px; margin-top:4px;">Không tải được video</div></div>`}
                <div style="padding:8px 12px; display:flex; align-items:center; gap:6px;">
                    <span class="material-symbols-outlined" style="font-size:18px; color:#2563eb;">videocam</span>
                    <div>
                        <div style="font-size:11px; font-weight:600; color:#1e40af;">Video</div>
                        <div style="font-size:10px; color:#6b7280; word-break:break-all;">${escapeHtml(videoName || 'Video báo cáo')}</div>
                    </div>
                </div>
            </div>`;
        }
        html += `</div></div>`;
    }

    // Mortality info
    if (mortalityQty && parseInt(mortalityQty) > 0) {
        const causeLabel = causeTypeLabels[mortalityCauseType] || mortalityCauseType || 'Không rõ';
        html += `<div style="padding:12px 16px; border-radius:12px; background:#fef2f2; border:1px solid #fecaca;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span class="material-symbols-outlined" style="font-size:20px; color:#dc2626;">heart_broken</span>
                <span style="font-size:13px; font-weight:700; color:#dc2626;">Hao hụt: ${mortalityQty} con</span>
            </div>
            ${mortalityCause ? `<div style="font-size:12px; color:#991b1b;">Loại: ${causeLabel} — ${escapeHtml(mortalityCause)}</div>` : ''}
        </div>`;
    } else if (mortalityQty === '0' || (mortalityMatch && mortalityMatch[1] === '0')) {
        html += `<div style="padding:12px 16px; border-radius:12px; background:#f0fdf4; border:1px solid #bbf7d0;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span class="material-symbols-outlined" style="font-size:20px; color:#16a34a;">check_circle</span>
                <span style="font-size:13px; font-weight:700; color:#16a34a;">Không có hao hụt</span>
            </div>
        </div>`;
    }

    html += `</div>`;
    return html;
}

function buildOwnerMaterialResultsHtml(task) {
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
            else if (wf.pesticideName) { materialName = wf.pesticideName; }
        } catch (e) { /* ignore parse errors */ }
    }

    const _apiOrigin = new URL(LABOR_API_BASE).origin;
    const serverImageUrl = task.reportImageUrl ? (_apiOrigin + task.reportImageUrl) : null;
    const serverVideoUrl = task.reportVideoUrl ? (_apiOrigin + task.reportVideoUrl) : null;

    let html = `<div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px; margin-bottom:16px;">
        <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:16px; display:flex; align-items:center; gap:6px;">
            <span class="material-symbols-outlined" style="font-size:18px; color:${cfg.color};">inventory_2</span>
            Vật tư tiêu hao đã sử dụng
        </div>
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px; padding:12px 16px; border-radius:12px; background:${cfg.color}11; border:1px solid ${cfg.color}22;">
            <span class="material-symbols-outlined" style="font-size:28px; color:${cfg.color};">${cfg.icon}</span>
            <div style="flex:1;">
                <div style="font-size:12px; color:#6b7280;">${cfg.label}</div>
                <div style="font-size:16px; font-weight:700; color:${cfg.color};">${escapeHtml(materialName)}</div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:12px; color:#6b7280;">Số lượng</div>
                <div style="font-size:16px; font-weight:700; color:#1f2937;">${qty} ${escapeHtml(unit)}</div>
            </div>
        </div>`;

    if (serverImageUrl || serverVideoUrl) {
        html += `<div style="margin-bottom:14px;">
            <div style="font-size:12px; font-weight:500; color:#6b7280; margin-bottom:8px;">Minh chứng đính kèm</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px;">`;
        if (serverImageUrl) {
            html += `<div style="border-radius:10px; background:#f0fdf4; border:1px solid #bbf7d0; overflow:hidden;">
                <img src="${serverImageUrl}" style="width:100%; max-height:200px; object-fit:cover; cursor:pointer;" alt="Ảnh báo cáo" onclick="openMediaLightbox(this.src, 'image')">
                <div style="padding:8px 12px; display:flex; align-items:center; gap:6px;">
                    <span class="material-symbols-outlined" style="font-size:18px; color:#16a34a;">photo_camera</span>
                    <span style="font-size:11px; font-weight:600; color:#15803d;">Ảnh báo cáo</span>
                </div>
            </div>`;
        }
        if (serverVideoUrl) {
            html += `<div style="border-radius:10px; background:#eff6ff; border:1px solid #bfdbfe; overflow:hidden;">
                <video src="${serverVideoUrl}" style="width:100%; max-height:200px; object-fit:cover; cursor:pointer;" onclick="openMediaLightbox(this.src, 'video')" preload="metadata"></video>
                <div style="padding:8px 12px; display:flex; align-items:center; gap:6px;">
                    <span class="material-symbols-outlined" style="font-size:18px; color:#2563eb;">videocam</span>
                    <span style="font-size:11px; font-weight:600; color:#1e40af;">Video báo cáo</span>
                </div>
            </div>`;
        }
        html += `</div></div>`;
    }

    html += `</div>`;
    return html;
}

// ── Owner completed view for byproduct collection tasks ──
function buildOwnerByproductResultsHtml(task, wfData) {
    const byproductName = wfData.byproductName || 'Sản phẩm phụ';
    const byproductUnit = wfData.byproductUnit || '';
    const estimated = wfData.estimatedQuantity || 0;
    const collected = wfData.collectedQuantity || 0;
    const byproductType = wfData.byproductType || 'NONE';

    const iconMap = { 'EGGS': 'egg_alt', 'MILK': 'water_drop', 'HONEY': 'emoji_nature', 'SILK': 'gesture' };
    const colorMap = { 'EGGS': '#f59e0b', 'MILK': '#3b82f6', 'HONEY': '#eab308', 'SILK': '#8b5cf6' };
    const icon = iconMap[byproductType] || 'eco';
    const color = colorMap[byproductType] || '#f59e0b';

    const _apiOrigin = new URL(LABOR_API_BASE).origin;
    const serverImageUrl = task.reportImageUrl ? (_apiOrigin + task.reportImageUrl) : null;
    const serverVideoUrl = task.reportVideoUrl ? (_apiOrigin + task.reportVideoUrl) : null;

    let html = `<div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px; margin-bottom:16px;">
        <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:16px; display:flex; align-items:center; gap:6px;">
            <span class="material-symbols-outlined" style="font-size:18px; color:${color};">${icon}</span>
            Kết quả thu ${escapeHtml(byproductName.toLowerCase())}
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
            <div style="background:${color}11; border-radius:12px; padding:14px; text-align:center;">
                <div style="font-size:12px; color:#6b7280; margin-bottom:4px;">Ước tính</div>
                <div style="font-size:20px; font-weight:700; color:${color};">${estimated}</div>
                <div style="font-size:11px; color:#9ca3af;">${escapeHtml(byproductUnit)}</div>
            </div>
            <div style="background:#f0fdf4; border-radius:12px; padding:14px; text-align:center;">
                <div style="font-size:12px; color:#6b7280; margin-bottom:4px;">Thực tế</div>
                <div style="font-size:20px; font-weight:700; color:#16a34a;">${collected}</div>
                <div style="font-size:11px; color:#9ca3af;">${escapeHtml(byproductUnit)}</div>
            </div>
        </div>`;

    if (serverImageUrl || serverVideoUrl) {
        html += `<div style="margin-bottom:14px;">
            <div style="font-size:12px; font-weight:500; color:#6b7280; margin-bottom:8px;">Minh chứng đính kèm</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px;">`;
        if (serverImageUrl) {
            html += `<div style="border-radius:10px; background:#fffbeb; border:1px solid ${color}33; overflow:hidden;">
                <img src="${serverImageUrl}" style="width:100%; max-height:200px; object-fit:cover; cursor:pointer;" alt="Ảnh" onclick="openMediaLightbox(this.src, 'image')">
                <div style="padding:8px 12px; display:flex; align-items:center; gap:6px;">
                    <span class="material-symbols-outlined" style="font-size:18px; color:${color};">photo_camera</span>
                    <span style="font-size:11px; font-weight:600; color:#92400e;">Ảnh minh chứng</span>
                </div>
            </div>`;
        }
        if (serverVideoUrl) {
            html += `<div style="border-radius:10px; background:#eff6ff; border:1px solid #bfdbfe; overflow:hidden;">
                <video src="${serverVideoUrl}" style="width:100%; max-height:200px; object-fit:cover;" controls preload="metadata"></video>
                <div style="padding:8px 12px; display:flex; align-items:center; gap:6px;">
                    <span class="material-symbols-outlined" style="font-size:18px; color:#2563eb;">videocam</span>
                    <span style="font-size:11px; font-weight:600; color:#1e40af;">Video minh chứng</span>
                </div>
            </div>`;
        }
        html += `</div></div>`;
    }

    html += `</div>`;
    return html;
}

function openOwnerTaskDetail(taskId) {
    const task = ownerTasksById && ownerTasksById[taskId] ? ownerTasksById[taskId] : null;
    if (!task) return;

    const container = document.getElementById('task-detail-container');
    if (!container) return;

    // Hide main lists wrapper
    const tasksContainer = document.getElementById('tasks-container');
    if (tasksContainer) tasksContainer.style.display = 'none';

    container.style.display = 'block';

    const taskName = task.name || '';
    const taskDesc = task.description || '';
    const status = task.status ? String(task.status).toUpperCase() : 'PENDING';
    const priority = task.priority ? String(task.priority).toUpperCase() : 'NORMAL';

    const createdAt = task.createdAt ? new Date(task.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
    const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Chưa đặt hạn';
    const completedAt = task.completedAt ? new Date(task.completedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

    // Worker info
    const workerName = task.worker ? (task.worker.fullName || task.worker.email || 'Nhân công') : (task.isAutoCreated ? 'Chưa phân công' : 'Tôi (Tự làm)');
    const workerEmail = task.worker ? (task.worker.email || '') : '';
    const workerAvatar = task.worker && task.worker.avatarUrl ? task.worker.avatarUrl : null;
    const workerAvatarHtml = workerAvatar
        ? `<img src="${workerAvatar}" alt="" style="width:48px; height:48px; border-radius:50%; object-fit:cover; border:2px solid #e5e7eb;">`
        : `<div style="width:48px; height:48px; border-radius:50%; background:#dbeafe; color:#2563eb; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:18px; border:2px solid #e5e7eb;">${escapeHtml((workerName || 'W').charAt(0).toUpperCase())}</div>`;

    // Location
    const locationLabel = task.field ? (task.field.name || 'Ruộng') : (task.pen ? (task.pen.name || task.pen.code || 'Chuồng') : null);
    const locationType = task.field ? 'Ruộng' : (task.pen ? 'Chuồng' : null);
    const locationIcon = task.field ? 'grass' : (task.pen ? 'pets' : 'location_on');

    const salaryLabel = task.salary ? (new Intl.NumberFormat('vi-VN').format(Number(task.salary)) + ' VNĐ') : null;
    let relatedItemName = task.relatedItem ? (task.relatedItem.name || '') : null;
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
    const typeLabel = getTaskTypeLabel(task.taskType);

    // Status config
    const statusCfg = {
        'COMPLETED': { icon: 'check_circle', label: 'Hoàn thành', color: '#16a34a', bg: '#f0fdf4' },
        'APPROVED': { icon: 'verified', label: 'Đã duyệt', color: '#7c3aed', bg: '#f5f3ff' },
        'IN_PROGRESS': { icon: 'autorenew', label: 'Đang thực hiện', color: '#2563eb', bg: '#eff6ff' },
        'CANCELLED': { icon: 'cancel', label: 'Đã hủy', color: '#dc2626', bg: '#fef2f2' },
        'PENDING': { icon: 'pending', label: 'Chờ xử lý', color: '#d97706', bg: '#fffbeb' }
    };
    const sc = statusCfg[status] || statusCfg['PENDING'];

    const priCfg = {
        'HIGH': { icon: 'priority_high', label: 'Cao', color: '#dc2626' },
        'URGENT': { icon: 'warning', label: 'Khẩn cấp', color: '#dc2626' },
        'LOW': { icon: 'low_priority', label: 'Thấp', color: '#16a34a' },
        'NORMAL': { icon: 'drag_handle', label: 'Bình thường', color: '#6b7280' }
    };
    const pc = priCfg[priority] || priCfg['NORMAL'];

    // Countdown
    let countdownHtml = '';
    if (task.dueDate && status !== 'COMPLETED') {
        const remaining = new Date(task.dueDate).getTime() - Date.now();
        const isOverdue = remaining < 0;
        const cdColor = isOverdue ? '#dc2626' : '#2563eb';
        const cdBg = isOverdue ? '#fef2f2' : '#eff6ff';
        const abs = Math.abs(remaining);
        const h = Math.floor(abs / 3600000);
        const m = Math.floor((abs % 3600000) / 60000);
        const cdText = h > 0 ? `${h} giờ ${m} phút` : `${m} phút`;
        countdownHtml = `
            <div style="background:${cdBg}; border-radius:16px; padding:20px; margin-bottom:16px; border:1px solid ${cdColor}22;">
                <div style="display:flex; align-items:center; gap:8px; color:${cdColor}; font-weight:600; font-size:14px;">
                    <span class="material-symbols-outlined" style="font-size:20px;">timer</span>
                    ${isOverdue ? 'Đã quá hạn' : 'Thời gian còn lại'}
                </div>
                <div style="font-size:28px; font-weight:800; color:${cdColor}; margin-top:4px;">${cdText}</div>
            </div>
        `;
    }

    container.innerHTML = `
        <div style="max-width:900px; margin:0 auto;">
            <!-- Breadcrumb -->
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:20px; font-size:14px; color:#6b7280;">
                <button onclick="closeOwnerTaskDetail()" style="display:flex; align-items:center; gap:4px; background:none; border:none; cursor:pointer; color:#6b7280; font-size:14px; padding:0; transition:color 0.2s;"
                        onmouseenter="this.style.color='#059669'" onmouseleave="this.style.color='#6b7280'">
                    <span class="material-symbols-outlined" style="font-size:18px;">arrow_back</span> Giao việc
                </button>
                <span style="color:#d1d5db;">›</span>
                <span style="color:#111827; font-weight:600;">${escapeHtml(taskName)}</span>
            </div>

            <!-- Header Card -->
            <div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:24px; margin-bottom:16px;">
                <div style="display:flex; align-items:flex-start; gap:16px;">
                    <div style="width:56px; height:56px; border-radius:14px; background:linear-gradient(135deg, #ecfdf5, #d1fae5); color:#059669; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <span class="material-symbols-outlined" style="font-size:28px;">${getTaskIconOwner(task.taskType)}</span>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <h2 style="margin:0 0 4px; font-size:22px; font-weight:800; color:#111827;">${escapeHtml(taskName)}</h2>
                        <span style="font-size:13px; color:#6b7280;">${typeLabel}</span>
                    </div>
                </div>
            </div>

            <!-- Stat Cards Row -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; margin-bottom:16px;">
                <div style="background:white; border-radius:12px; border:1px solid #e5e7eb; padding:16px; text-align:center;">
                    <span class="material-symbols-outlined" style="font-size:24px; color:${sc.color};">${sc.icon}</span>
                    <div style="font-size:16px; font-weight:700; color:${sc.color}; margin-top:4px;">${sc.label}</div>
                    <div style="font-size:11px; color:#9ca3af; margin-top:2px;">Trạng thái</div>
                </div>
                <div style="background:white; border-radius:12px; border:1px solid #e5e7eb; padding:16px; text-align:center;">
                    <span class="material-symbols-outlined" style="font-size:24px; color:${pc.color};">${pc.icon}</span>
                    <div style="font-size:16px; font-weight:700; color:${pc.color}; margin-top:4px;">${pc.label}</div>
                    <div style="font-size:11px; color:#9ca3af; margin-top:2px;">Ưu tiên</div>
                </div>
                <div style="background:white; border-radius:12px; border:1px solid #e5e7eb; padding:16px; text-align:center;">
                    <span class="material-symbols-outlined" style="font-size:24px; color:#d97706;">schedule</span>
                    <div style="font-size:14px; font-weight:700; color:#111827; margin-top:4px;">${dueDate}</div>
                    <div style="font-size:11px; color:#9ca3af; margin-top:2px;">Hạn hoàn thành</div>
                </div>
                ${salaryLabel ? `
                <div style="background:white; border-radius:12px; border:1px solid #e5e7eb; padding:16px; text-align:center;">
                    <span class="material-symbols-outlined" style="font-size:24px; color:#059669;">payments</span>
                    <div style="font-size:16px; font-weight:700; color:#059669; margin-top:4px;">${salaryLabel}</div>
                    <div style="font-size:11px; color:#9ca3af; margin-top:2px;">Thù lao</div>
                </div>
                ` : ''}
                ${completedAt ? `
                <div style="background:white; border-radius:12px; border:1px solid #e5e7eb; padding:16px; text-align:center;">
                    <span class="material-symbols-outlined" style="font-size:24px; color:#16a34a;">verified</span>
                    <div style="font-size:14px; font-weight:700; color:#16a34a; margin-top:4px;">${completedAt}</div>
                    <div style="font-size:11px; color:#9ca3af; margin-top:2px;">Hoàn thành lúc</div>
                </div>
                ` : ''}
            </div>

            <!-- Info Grid -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
                <!-- Người thực hiện -->
                <div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px;">
                    <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">Người thực hiện</div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        ${workerAvatarHtml}
                        <div>
                            <div style="font-weight:700; color:#111827; font-size:15px;">${escapeHtml(workerName)}</div>
                            ${workerEmail ? `<div style="font-size:13px; color:#6b7280;">${escapeHtml(workerEmail)}</div>` : ''}
                        </div>
                    </div>
                </div>

                <!-- Khu vực -->
                <div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px;">
                    <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">Khu vực thực hiện</div>
                    ${locationLabel ? `
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:44px; height:44px; border-radius:12px; background:#f5f3ff; color:#7c3aed; display:flex; align-items:center; justify-content:center;">
                            <span class="material-symbols-outlined" style="font-size:22px;">${locationIcon}</span>
                        </div>
                        <div>
                            <div style="font-weight:700; color:#111827; font-size:15px;">${escapeHtml(locationLabel)}</div>
                            <div style="font-size:13px; color:#6b7280;">${locationType}</div>
                        </div>
                    </div>
                    ` : `<div style="color:#9ca3af; font-size:14px;">Không chỉ định</div>`}
                </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
                <!-- Ngày tạo -->
                <div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px;">
                    <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">Thông tin giao việc</div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:44px; height:44px; border-radius:12px; background:#ecfdf5; color:#059669; display:flex; align-items:center; justify-content:center;">
                            <span class="material-symbols-outlined" style="font-size:22px;">event_available</span>
                        </div>
                        <div>
                            <div style="font-weight:700; color:#111827; font-size:15px;">${createdAt}</div>
                            <div style="font-size:13px; color:#6b7280;">Ngày tạo công việc</div>
                        </div>
                    </div>
                </div>

                <!-- Vật tư -->
                <div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px;">
                    <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">Vật tư liên quan</div>
                    ${relatedItemName ? `
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:44px; height:44px; border-radius:12px; background:#fefce8; color:#ca8a04; display:flex; align-items:center; justify-content:center;">
                            <span class="material-symbols-outlined" style="font-size:22px;">inventory_2</span>
                        </div>
                        <div>
                            <div style="font-weight:700; color:#111827; font-size:15px;">${escapeHtml(relatedItemName)}</div>
                            ${quantityLabel ? `<div style="font-size:13px; color:#6b7280;">Số lượng: ${quantityLabel}${quantityUnit ? ' ' + escapeHtml(quantityUnit) : ''}</div>` : ''}
                        </div>
                    </div>
                    ` : `<div style="color:#9ca3af; font-size:14px;">Không có</div>`}
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

            ${buildInspectionResultsHtml(task)}

            ${countdownHtml}

            <!-- Completion / Status Banner -->
            ${status === 'COMPLETED' ? `
            <div style="background:#fffbeb; border-radius:16px; border:1px solid #fde68a; padding:20px; margin-bottom:16px; text-align:center;">
                <span class="material-symbols-outlined" style="font-size:48px; color:#d97706;">hourglass_top</span>
                <div style="font-size:18px; font-weight:700; color:#d97706; margin-top:8px;">Chờ duyệt kết quả</div>
                <div style="font-size:14px; color:#92400e; margin-top:4px;">Nhân công đã hoàn thành. Vui lòng xem xét và duyệt.</div>
                ${completedAt ? `<div style="font-size:13px; color:#a16207; margin-top:4px;">Hoàn thành lúc: ${completedAt}</div>` : ''}
            </div>
            <div style="text-align:center; margin-bottom:16px;">
                <button onclick="approveWorkflowTask(${task.id})" id="approve-btn-${task.id}"
                    style="background:linear-gradient(135deg, #059669, #10b981); color:white; border:none; border-radius:12px; padding:14px 40px; font-size:16px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:8px; box-shadow:0 4px 14px rgba(5,150,105,0.3); transition:all 0.3s ease;"
                    onmouseenter="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(5,150,105,0.4)'"
                    onmouseleave="this.style.transform=''; this.style.boxShadow='0 4px 14px rgba(5,150,105,0.3)'">
                    <span class="material-symbols-outlined" style="font-size:22px;">verified</span>
                    Duyệt công việc
                </button>
            </div>
            ` : status === 'APPROVED' ? `
            <div style="background:#f5f3ff; border-radius:16px; border:1px solid #c4b5fd; padding:20px; margin-bottom:16px; text-align:center;">
                <span class="material-symbols-outlined" style="font-size:48px; color:#7c3aed;">verified</span>
                <div style="font-size:18px; font-weight:700; color:#7c3aed; margin-top:8px;">Đã duyệt và thực thi</div>
                ${task.approvedAt ? `<div style="font-size:14px; color:#6d28d9; margin-top:4px;">Duyệt lúc ${new Date(task.approvedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>` : ''}
            </div>
            ` : ''}
        </div>
    `;
}

function closeOwnerTaskDetail() {
    // Hide detail and show main wrappers
    const detailContainer = document.getElementById('task-detail-container');
    if (detailContainer) detailContainer.style.display = 'none';

    const tasksContainer = document.getElementById('tasks-container');
    if (tasksContainer) tasksContainer.style.display = 'block';

    const calHeader = document.getElementById('calendar-header');
    if (calHeader) calHeader.style.display = 'flex';

    // Restore the correct sub-view
    const listContainer = document.getElementById('tasks-list-view');
    const kanbanContainer = document.getElementById('tasks-kanban-view');
    const assignContainer = document.getElementById('tasks-assign-view');
    const ganttContainer = document.getElementById('tasks-gantt-view');

    if (listContainer) listContainer.style.display = currentTaskView === 'list' ? 'block' : 'none';
    if (kanbanContainer) kanbanContainer.style.display = currentTaskView === 'kanban' ? 'block' : 'none';
    if (assignContainer) assignContainer.style.display = currentTaskView === 'assign' ? 'block' : 'none';
    if (ganttContainer) ganttContainer.style.display = currentTaskView === 'gantt' ? 'block' : 'none';

    loadTasks();
}

async function approveWorkflowTask(taskId) {
    const btn = document.getElementById(`approve-btn-${taskId}`);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined rotating" style="font-size:22px;">sync</span> Đang duyệt...';
    }
    try {
        await fetchAPI(`${LABOR_API_BASE}/tasks/${taskId}/approve`, 'POST');
        showToast('Thành công', 'Đã duyệt và thực thi công việc thành công!', 'success');
        // Refresh task list and reopen detail
        await loadTasks();
        openOwnerTaskDetail(taskId);
    } catch (error) {
        console.error('Approve error:', error);
        showToast('Lỗi', error.message || 'Lỗi khi duyệt công việc', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:22px;">verified</span> Duyệt và thực thi';
        }
    }
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
        const res = await fetchAPI(`${LABOR_API_BASE}/user/list?role=WORKER&farmId=${myFarmId || 1}`);
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
        const penLabels = {
            'CAGED': 'Gia cầm (Gà/Vịt)', 
            'POND': 'Thủy sản (Cá/Tôm)', 
            'SPECIAL': 'Đặc biệt (Ong...)',
            'BARN': 'Gia súc (Lợn/Bò)',
            'FREE_RANGE': 'Thả vườn',
            'TANK': 'Bể nuôi',
            'NET_CAGE': 'Lồng lưới',
            'RAFT': 'Bè nổi',
            'HIVE': 'Tổ ong',
            'TRAY': 'Khay nuôi'
        };
        pensList.forEach(p => {
            const option = document.createElement('option');
            option.value = `PEN:${p.id}`;
            const label = p.animalDefinition && p.animalDefinition.name 
                ? p.animalDefinition.name 
                : (penLabels[p.farmingType] || p.farmingType);
            option.textContent = `${p.code} - ${label}`;
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
        agriAlert("Vui lòng chọn người thực hiện!", 'warning');
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

    const rawDesc = document.getElementById('task-desc').value || '';
    const notesEl = document.getElementById('task-notes');
    const notes = notesEl ? notesEl.value.trim() : '';
    const fullDescription = notes ? (rawDesc ? rawDesc + '\n\n📝 Ghi chú: ' + notes : '📝 Ghi chú: ' + notes) : rawDesc;

    const payload = {
        farmId: myFarmId || 1,
        ownerId: ownerId,
        workerId: workerId === 'SELF' ? null : workerId,
        name: document.getElementById('task-name').value,
        description: fullDescription,
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
        agriAlert("Giao việc thành công!", 'success');
        closeAssignTaskModal();
        loadTasks(); // Reload list
        e.target.reset();
    } catch (error) {
        agriAlert("Lỗi: " + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-symbols-outlined">check</span> Giao việc';
    }
}


// ============ QUICK ADD TASKS ============

let quickAddTasksData = []; // Holds generated task objects

function openQuickAddModal() {
    const overlay = document.getElementById('quick-add-overlay');
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    loadQuickAddData();
}

function closeQuickAddModal() {
    const overlay = document.getElementById('quick-add-overlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
}

async function loadQuickAddData() {
    const body = document.getElementById('quick-add-body');
    if (!body) return;

    // Show loading skeleton
    body.innerHTML = `<div class="qa-skeleton">
        <div class="qa-skeleton-row"></div>
        <div class="qa-skeleton-row" style="animation-delay:.15s"></div>
        <div class="qa-skeleton-row" style="animation-delay:.3s"></div>
        <div class="qa-skeleton-row" style="animation-delay:.45s"></div>
    </div>`;

    try {
        await ensureFarmId();
        await ensureApprovedWorkersForAssignment();
        const farmId = myFarmId || 1;

        // Fetch fields and pens in parallel using fetchAPI (proper auth)
        const [fieldsRes, pensRes] = await Promise.allSettled([
            fetchAPI(`${LABOR_API_BASE}/fields?farmId=${farmId}`).catch(() => []),
            fetchAPI(`${LABOR_API_BASE}/livestock/pens?farmId=${farmId}`).catch(() => [])
        ]);

        const fields = fieldsRes.status === 'fulfilled' ? (Array.isArray(fieldsRes.value) ? fieldsRes.value : []) : [];
        const pens = pensRes.status === 'fulfilled' ? (Array.isArray(pensRes.value) ? pensRes.value : []) : [];

        // Fetch irrigation schedules for each field using fetchAPI
        const irrigationPromises = fields.map(f =>
            fetchAPI(`${LABOR_API_BASE}/irrigation/field/${f.id}`).catch(() => [])
        );
        const irrigationResults = await Promise.allSettled(irrigationPromises);

        // Build task list
        quickAddTasksData = [];
        let taskIndex = 0;

        // --- Category 1: Field Inspections ---
        fields.forEach(field => {
            const fieldName = field.name || field.fieldName || `Ruộng #${field.id}`;
            // currentCrop is an object {id, name, ...} — extract .name
            const cropLabel = (field.currentCrop && typeof field.currentCrop === 'object')
                ? field.currentCrop.name
                : (field.currentCrop || field.cropName || '');
            quickAddTasksData.push({
                idx: taskIndex++,
                category: 'inspect',
                type: 'INSPECTION',
                name: `Kiểm tra ${fieldName}`,
                description: `Kiểm tra tình trạng mảnh ruộng "${fieldName}"${cropLabel ? ' - ' + cropLabel : ''}. Chụp ảnh minh chứng để cập nhật tình trạng.`,
                fieldId: field.id,
                penId: null,
                timeEditable: true,
                fixedTime: null,
                workerId: null,
                checked: true
            });
        });

        // --- Category 2: Pen Inspections ---
        pens.filter(p => p.animalCount > 0).forEach(pen => {
            const animalName = pen.animalDefinition ? pen.animalDefinition.name : 'Vật nuôi';
            const penCode = pen.code || `Chuồng #${pen.id}`;
            quickAddTasksData.push({
                idx: taskIndex++,
                category: 'inspect',
                type: 'INSPECTION',
                name: `Kiểm tra chuồng ${penCode} - ${animalName}`,
                description: `Kiểm tra chuồng ${penCode} (${animalName}, ${pen.animalCount} con). Chụp ảnh tình trạng chuồng và vật nuôi.`,
                fieldId: null,
                penId: pen.id,
                timeEditable: true,
                fixedTime: null,
                workerId: null,
                checked: true
            });
        });

        // --- Category 3: Watering tasks ---
        fields.forEach((field, fIdx) => {
            let schedules = irrigationResults[fIdx]?.status === 'fulfilled'
                ? irrigationResults[fIdx].value
                : [];
            if (!Array.isArray(schedules)) schedules = [];
            const activeSchedules = schedules.filter(s => s.isActive === true || s.active === true);
            const fieldName = field.name || field.fieldName || `Ruộng #${field.id}`;
            const schedulesToUse = activeSchedules.length > 0 ? activeSchedules : (schedules.length > 0 ? schedules : []);

            if (schedulesToUse.length > 0) {
                schedulesToUse.forEach(sched => {
                    let time = sched.timeOfDay || '06:00';
                    if (typeof time === 'string' && time.length > 5) time = time.substring(0, 5);
                    const duration = sched.durationMinutes || 30;
                    quickAddTasksData.push({
                        idx: taskIndex++,
                        category: 'water',
                        type: 'WATER',
                        name: `Tưới nước ${fieldName}`,
                        description: `Tưới nước mảnh ruộng "${fieldName}" lúc ${time} (${duration} phút). Lịch: ${formatScheduleTypeQA(sched.scheduleType)}.`,
                        fieldId: field.id,
                        penId: null,
                        timeEditable: false,
                        fixedTime: time,
                        workerId: null,
                        checked: true
                    });
                });
            } else if (field.currentCrop && field.workflowStage && field.workflowStage !== 'EMPTY' && field.workflowStage !== 'HARVESTED') {
                // No irrigation schedule in DB but field is actively growing — add default watering task
                const cropObj = typeof field.currentCrop === 'object' ? field.currentCrop : null;
                const waterInterval = cropObj?.wateringIntervalDays || 1;
                const defaultTime = '06:00';
                if (waterInterval <= 2) {
                    quickAddTasksData.push({
                        idx: taskIndex++,
                        category: 'water',
                        type: 'WATER',
                        name: `Tưới nước ${fieldName}`,
                        description: `Tưới nước mảnh ruộng "${fieldName}" (${cropObj?.name || 'Cây trồng'}). Tần suất: ${waterInterval === 1 ? 'hàng ngày' : 'cách ' + waterInterval + ' ngày'}.`,
                        fieldId: field.id,
                        penId: null,
                        timeEditable: true,
                        fixedTime: defaultTime,
                        workerId: null,
                        checked: true
                    });
                }
            }
        });

        // --- Category 4: Feeding tasks ---
        // Exclude non-feedable animals (bees, silkworms)
        const NON_FEEDABLE_KEYWORDS = ['ong', 'tằm'];
        const DEFAULT_FEED_TIMES = ['07:00', '17:00'];

        pens.filter(p => p.animalCount > 0).forEach(pen => {
            const animalName = pen.animalDefinition ? pen.animalDefinition.name : 'Vật nuôi';
            const nameLower = animalName.toLowerCase();

            // Skip non-feedable animals (bees, silkworms)
            if (NON_FEEDABLE_KEYWORDS.some(kw => nameLower.includes(kw))) return;

            const penCode = pen.code || `Chuồng #${pen.id}`;

            // Determine feeding times
            let feedTimes = [];
            if (pen.nextFeedingAt) {
                const dt = new Date(pen.nextFeedingAt);
                const t = dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
                feedTimes = [t];
            } else {
                feedTimes = [...DEFAULT_FEED_TIMES];
            }

            feedTimes.forEach(feedTime => {
                quickAddTasksData.push({
                    idx: taskIndex++,
                    category: 'feed',
                    type: 'FEED',
                    name: `Cho ăn chuồng ${penCode} - ${animalName}`,
                    description: `Cho ăn chuồng ${penCode} (${animalName}, ${pen.animalCount} con). Giờ cho ăn: ${feedTime}.`,
                    fieldId: null,
                    penId: pen.id,
                    timeEditable: false,
                    fixedTime: feedTime,
                    workerId: null,
                    checked: true
                });
            });
        });

        renderQuickAddBody();

    } catch (err) {
        console.error('Quick Add load error:', err);
        body.innerHTML = `<div class="qa-empty">
            <span class="material-symbols-outlined">error</span>
            <p>Không thể tải dữ liệu. Vui lòng thử lại.</p>
        </div>`;
    }
}

function renderQuickAddBody() {
    const body = document.getElementById('quick-add-body');
    if (!body) return;

    if (quickAddTasksData.length === 0) {
        body.innerHTML = `<div class="qa-empty">
            <span class="material-symbols-outlined">task_alt</span>
            <p>Không có công việc nào cần thêm hôm nay.</p>
        </div>`;
        return;
    }

    // Build worker options
    const workerOpts = buildWorkerOptionsHTML();

    // Build epic options from cache
    let epicOpts = '<option value="">-- Không --</option>';
    if (Array.isArray(_epicsCache)) {
        _epicsCache.forEach(ep => {
            epicOpts += `<option value="${ep.id}">${escapeHtml(ep.name)}</option>`;
        });
    }

    // Group by category
    const categories = [
        { key: 'inspect', label: 'Kiểm tra tình trạng', icon: 'search', cssClass: 'inspect' },
        { key: 'water', label: 'Tưới nước', icon: 'water_drop', cssClass: 'water' },
        { key: 'feed', label: 'Cho ăn', icon: 'restaurant', cssClass: 'feed' }
    ];

    let html = `<label class="qa-select-all">
        <input type="checkbox" checked onchange="toggleAllQuickAdd(this.checked)"> Chọn tất cả
    </label>`;

    categories.forEach(cat => {
        const items = quickAddTasksData.filter(t => t.category === cat.key);
        if (items.length === 0) return;

        html += `<div class="qa-category">
            <div class="qa-category-title">
                <span class="cat-icon ${cat.cssClass}"><span class="material-symbols-outlined" style="font-size:14px;">${cat.icon}</span></span>
                ${cat.label} (${items.length})
            </div>`;

        items.forEach((task, i) => {
            // Initialize new fields if not set
            if (!task.subtasks) task.subtasks = [];
            if (!task.epicId) task.epicId = null;

            const delay = i * 0.05;
            const timeValue = task.fixedTime || '08:00';

            html += `<div class="qa-task-row" style="animation-delay:${delay}s; flex-direction:column; align-items:stretch;" id="qa-row-${task.idx}">
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" ${task.checked ? 'checked' : ''} onchange="onQuickAddCheckChange(${task.idx}, this.checked)">
                    <div class="qa-task-info" style="flex:1;">
                        <div class="qa-task-name">${escapeHtml(task.name)}</div>
                        <div class="qa-task-desc">${escapeHtml(task.description).substring(0, 80)}...</div>
                    </div>
                    <div class="qa-task-controls">
                        <input type="time" value="${timeValue}" onchange="quickAddTasksData[${task.idx}].fixedTime=this.value" title="Thời gian mặc định" style="font-size:13px; padding:4px 6px; border:1px solid #d1d5db; border-radius:6px; color:#374151;">
                        <select onchange="quickAddTasksData[${task.idx}].workerId=this.value?Number(this.value):null" title="Chọn người làm">
                            ${workerOpts}
                        </select>
                    </div>
                </div>
                <!-- Epic + Sub-tasks row -->
                <div style="display:flex; gap:8px; margin-top:6px; margin-left:28px; align-items:center; flex-wrap:wrap;">
                    <select onchange="quickAddTasksData[${task.idx}].epicId=this.value?Number(this.value):null" title="Mùa vụ" style="font-size:12px; padding:4px 8px; border:1px solid #e5e7eb; border-radius:6px; color:#6b7280; max-width:160px;">
                        ${epicOpts}
                    </select>
                    <button type="button" onclick="addQASubtask(${task.idx})" style="font-size:11px; padding:3px 8px; border:1px dashed #d1d5db; border-radius:6px; background:#f9fafb; color:#6b7280; cursor:pointer; display:flex; align-items:center; gap:3px; white-space:nowrap;">
                        <span class="material-symbols-outlined" style="font-size:14px;">add</span> Sub-task
                    </button>
                </div>
                <div id="qa-subtasks-${task.idx}" style="margin-left:28px; margin-top:4px;">
                    ${renderQASubtasks(task.idx)}
                </div>
            </div>`;
        });

        html += `</div>`;
    });

    body.innerHTML = html;
    updateQuickAddCount();
}

function buildWorkerOptionsHTML() {
    let opts = '<option value="">-- Chọn worker --</option>';
    if (approvedWorkers && approvedWorkers.length > 0) {
        approvedWorkers.forEach(w => {
            const name = w.fullName || w.email || `Worker #${w.id}`;
            opts += `<option value="${w.id}">${escapeHtml(name)}</option>`;
        });
    }
    return opts;
}

// ──── QA Sub-task helpers ────
function renderQASubtasks(taskIdx) {
    const task = quickAddTasksData[taskIdx];
    if (!task || !task.subtasks || task.subtasks.length === 0) return '';
    return task.subtasks.map((st, i) => `
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            <span style="font-size:11px; color:#9ca3af; min-width:16px;">${i + 1}.</span>
            <input type="text" value="${escapeHtml(st)}" placeholder="Mô tả sub-task..."
                oninput="quickAddTasksData[${taskIdx}].subtasks[${i}]=this.value"
                style="flex:1; font-size:12px; padding:4px 8px; border:1px solid #e5e7eb; border-radius:6px; outline:none;">
            <button type="button" onclick="removeQASubtask(${taskIdx}, ${i})"
                style="width:20px; height:20px; border:none; background:#fef2f2; color:#ef4444; border-radius:4px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <span class="material-symbols-outlined" style="font-size:13px;">close</span>
            </button>
        </div>
    `).join('');
}

function addQASubtask(taskIdx) {
    const task = quickAddTasksData[taskIdx];
    if (!task) return;
    if (!task.subtasks) task.subtasks = [];
    task.subtasks.push('');
    const container = document.getElementById(`qa-subtasks-${taskIdx}`);
    if (container) container.innerHTML = renderQASubtasks(taskIdx);
}

function removeQASubtask(taskIdx, subIdx) {
    const task = quickAddTasksData[taskIdx];
    if (!task || !task.subtasks) return;
    task.subtasks.splice(subIdx, 1);
    const container = document.getElementById(`qa-subtasks-${taskIdx}`);
    if (container) container.innerHTML = renderQASubtasks(taskIdx);
}
function onQuickAddCheckChange(idx, checked) {
    if (quickAddTasksData[idx]) quickAddTasksData[idx].checked = checked;
    updateQuickAddCount();
}

function toggleAllQuickAdd(checked) {
    quickAddTasksData.forEach(t => t.checked = checked);
    document.querySelectorAll('#quick-add-body .qa-task-row input[type="checkbox"]').forEach(cb => cb.checked = checked);
    updateQuickAddCount();
}

function updateQuickAddCount() {
    const count = quickAddTasksData.filter(t => t.checked).length;
    const el = document.getElementById('qa-count');
    if (el) el.textContent = count;
    const btn = document.getElementById('qa-submit-btn');
    if (btn) btn.disabled = count === 0;
}

async function submitQuickAddTasks() {
    const selected = quickAddTasksData.filter(t => t.checked);
    if (selected.length === 0) return;

    const btn = document.getElementById('qa-submit-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;animation:spin 1s linear infinite;">sync</span> Đang giao...';
    }

    try {
        const ownerId = await getCurrentUserId();
        const farmId = myFarmId || 1;
        let success = 0, fail = 0;

        for (const task of selected) {
            try {
                // Build dueDate from fixedTime
                let dueDate = null;
                if (task.fixedTime) {
                    const today = new Date();
                    const [h, m] = task.fixedTime.split(':');
                    today.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
                    // Use local date format to avoid timezone shift (toISOString converts to UTC, which can shift the date back 1 day in GMT+7)
                    const yyyy = today.getFullYear();
                    const mm = String(today.getMonth() + 1).padStart(2, '0');
                    const dd = String(today.getDate()).padStart(2, '0');
                    const hh = String(today.getHours()).padStart(2, '0');
                    const mi = String(today.getMinutes()).padStart(2, '0');
                    dueDate = `${yyyy}-${mm}-${dd}T${hh}:${mi}:00`;
                }

                const payload = {
                    farmId: farmId,
                    ownerId: ownerId,
                    workerId: task.workerId || null,
                    name: task.name,
                    description: task.description,
                    priority: 'NORMAL',
                    taskType: task.type,
                    fieldId: task.fieldId,
                    penId: task.penId,
                    dueDate: dueDate,
                    salary: 0, quantityRequired: 0,
                    epicId: task.epicId || null,
                    checklistItems: (task.subtasks || []).filter(s => s && s.trim())
                };

                await fetchAPI(`${LABOR_API_BASE}/tasks`, 'POST', payload);
                success++;
            } catch (err) {
                console.error('Quick add task error:', err);
                fail++;
            }
        }

        closeQuickAddModal();
        loadTasks(); // Refresh task list

        const msg = fail === 0
            ? `✅ Đã giao ${success} công việc thành công!`
            : `⚠️ Giao ${success} thành công, ${fail} thất bại.`;
        agriAlert(msg, fail === 0 ? 'success' : 'warning');

    } catch (err) {
        console.error('Submit quick add error:', err);
        agriAlert('Lỗi: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">send</span> Giao tất cả';
        }
    }
}

function formatScheduleTypeQA(type) {
    const map = { 'DAILY': 'Hàng ngày', 'EVERY_OTHER_DAY': 'Cách ngày', 'WEEKLY': 'Hàng tuần', 'CUSTOM': 'Tùy chỉnh' };
    return map[type] || type || 'Hàng ngày';
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
        'INSPECTION': 'Kiểm tra',
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
        agriAlert('Không xác định được nông trại', 'warning');
        return;
    }

    try {
        await fetchAPI(`${LABOR_API_BASE}/farms/${myFarmId}/recruitment`, 'PUT', {
            quota: newQuota
        });
        agriAlert('Đã cập nhật hạn mức tuyển dụng!', 'success');
        loadRecruitmentInfo(); // Reload
    } catch (e) {
        agriAlert('Lỗi: ' + e.message, 'error');
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

        listContainer.innerHTML = applications.map(app => {
            let displayMsg = 'Bấm để xem chi tiết';
            if (app.applyMessage) {
                const normalized = normalizeApplicationPayload(app.applyMessage, app.cvProfile, app.cvPdfUrl);
                if (typeof normalized.actualMessage === 'string' && normalized.actualMessage.trim()) {
                    displayMsg = normalized.actualMessage;
                } else {
                    displayMsg = app.applyMessage;
                }
            } else if (app.cvProfile) {
                displayMsg = app.cvProfile.substring(0, 50) + (app.cvProfile.length > 50 ? '...' : '');
                if (displayMsg.startsWith('[') || displayMsg.startsWith('{')) displayMsg = 'Đã gửi hồ sơ web';
            }
            
            return `
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
                        <p style="margin: 4px 0 0 0; font-size: 13px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 300px;">
                            ${escapeHtml(displayMsg)}
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
            `;
        }).join('');

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

                // Ask to create contract
                const app = window.pendingApplications
                    ? window.pendingApplications.find(a => a.id === applicationId)
                    : null;
                const workerName = app ? (app.fullName || 'Nhân công') : 'Nhân công';
                let farmName = '';
                try {
                    const farms = await fetchAPI(`${LABOR_API_BASE}/farms/my-farms`);
                    if (farms && farms.length > 0) farmName = farms[0].name || '';
                } catch(e) {}

                setTimeout(() => {
                    showConfirmModal(
                        'Tạo hợp đồng',
                        `Bạn có muốn tạo hợp đồng lao động cho ${escapeHtml(workerName)} ngay bây giờ?`,
                        () => {
                            if (typeof openContractModal === 'function') {
                                openContractModal(applicationId, workerName, farmName);
                            }
                        },
                        'Tạo hợp đồng',
                        'Để sau'
                    );
                }, 500);
            } catch (e) {
                agriAlert('Lỗi: ' + e.message, 'error');
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
                agriAlert('Lỗi: ' + e.message, 'error');
            }
        },
        'Từ chối',
        'Hủy'
    );
}

function openCreatePostModal() {
    agriAlert("Tính năng Đăng tuyển đang phát triển", 'info');
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
window.approveWorkflowTask = approveWorkflowTask;
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
                            <div style="flex-shrink: 0; padding-top: 4px;">
                                ${getWorkerAvatarHtml(worker, 64)}
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

    const rankInfo = {
        'TRAINEE': { icon: '🥉', label: 'Nông dân Tập sự', bg: '#f7e8cd', color: '#b87333' },
        'SKILLED': { icon: '🥈', label: 'Nông dân Thạo việc', bg: '#e8e8e8', color: '#6b6b6b' },
        'VETERAN': { icon: '🥇', label: 'Lão nông Kinh nghiệm', bg: '#fff8e1', color: '#b8860b' },
        'MASTER': { icon: '💎', label: 'Nghệ nhân Nông nghiệp', bg: '#e0f7fa', color: '#00838f' }
    };
    const rLvl = worker && worker.rankLevel ? worker.rankLevel : 'TRAINEE';
    const rData = rankInfo[rLvl] || rankInfo.TRAINEE;

    return `
        <div style="display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap;">
            <div style="flex-shrink: 0; padding-top: 4px;">
                ${getWorkerAvatarHtml(worker, 80)}
            </div>
            <div style="flex: 1; min-width: 240px;">
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 6px;">
                    <h4 style="margin: 0; font-size: 22px; font-weight: 700; color: #111827;">${name}</h4>
                    <div style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; background: ${rData.bg}; color: ${rData.color};">
                        <span>${rData.icon}</span> <span>${rData.label}</span>
                    </div>
                    ${worker && worker.id != null ? `<span style=\"font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 999px; background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569;\">ID #${escapeHtml(worker.id)}</span>` : ''}
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
        ? '<div style="position: relative; height: 200px; width: 100%;"><canvas id="worker-detail-daily-chart"></canvas></div>'
        : '<div style="padding: 24px; text-align: center; color: #6b7280;">Chart.js chưa sẵn sàng</div>';

    const monthlyInner = hasChartJs
        ? '<div style="position: relative; height: 200px; width: 100%;"><canvas id="worker-detail-monthly-chart"></canvas></div>'
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
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                    <div style="font-weight: 900; color: #111827;">Thông tin cơ bản</div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="openViewContractModal(${workerId})"
                            style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);"
                            onmouseenter="this.style.transform='scale(1.03)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.4)'"
                            onmouseleave="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 8px rgba(16, 185, 129, 0.3)'">
                            <span class="material-symbols-outlined" style="font-size: 18px;">description</span>
                            Xem Hợp đồng
                        </button>
                        <button onclick="confirmDismissWorker(${workerId}, '${(worker.fullName || 'Nhân công').replace(/'/g, "\\'")}')"
                            style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);"
                            onmouseenter="this.style.transform='scale(1.03)'; this.style.boxShadow='0 4px 12px rgba(239, 68, 68, 0.4)'"
                            onmouseleave="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 8px rgba(239, 68, 68, 0.3)'">
                            <span class="material-symbols-outlined" style="font-size: 18px;">person_remove</span>
                            Đuổi việc
                        </button>
                    </div>
                </div>
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

// ============ DISMISS WORKER ============
function confirmDismissWorker(workerId, workerName) {
    const existing = document.getElementById('dismiss-confirm-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dismiss-confirm-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:9999; animation:fadeIn 0.3s ease;';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div style="background:white; padding:32px; border-radius:16px; text-align:center; max-width:420px; box-shadow:0 20px 60px rgba(0,0,0,0.3); animation:slideUp 0.3s ease;">
            <div style="width:64px; height:64px; border-radius:50%; background:#fef2f2; display:flex; align-items:center; justify-content:center; margin:0 auto 16px;">
                <span class="material-symbols-outlined" style="font-size:32px; color:#ef4444;">person_remove</span>
            </div>
            <h3 style="margin:0 0 8px; font-size:20px; font-weight:700; color:#111827;">Đuổi việc nhân công?</h3>
            <p style="margin:0 0 20px; font-size:14px; color:#6b7280; line-height:1.6;">
                Bạn có chắc muốn đuổi nhân công<br><strong style="color:#111827;">${workerName}</strong> khỏi nông trại?<br>
                <span style="font-size:12px; color:#9ca3af;">Hạn mức tuyển dụng sẽ được cộng lại +1</span>
            </p>
            <div style="display:flex; gap:10px; justify-content:center;">
                <button onclick="document.getElementById('dismiss-confirm-overlay').remove()"
                    style="padding:10px 24px; border-radius:10px; border:1px solid #d1d5db; background:white; color:#374151; font-weight:600; font-size:14px; cursor:pointer; transition:all 0.2s;"
                    onmouseenter="this.style.background='#f3f4f6'" onmouseleave="this.style.background='white'">
                    Hủy
                </button>
                <button id="dismiss-confirm-btn" onclick="executeDismissWorker(${workerId})"
                    style="padding:10px 24px; border-radius:10px; border:none; background:#ef4444; color:white; font-weight:600; font-size:14px; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:6px;"
                    onmouseenter="this.style.background='#dc2626'" onmouseleave="this.style.background='#ef4444'">
                    <span class="material-symbols-outlined" style="font-size:18px;">person_remove</span> Đuổi việc
                </button>
            </div>
        </div>`;

    document.body.appendChild(overlay);
}

async function executeDismissWorker(workerId) {
    const overlay = document.getElementById('dismiss-confirm-overlay');
    const btn = document.getElementById('dismiss-confirm-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px; animation:spin 1s linear infinite;">sync</span> Đang xử lý...';
    }

    try {
        await fetchAPI(`${LABOR_API_BASE}/labor/dismiss/${workerId}`, 'POST');
        if (overlay) overlay.remove();
        if (typeof agriAlert === 'function') {
            agriAlert('Đã đuổi nhân công thành công. Hạn mức tuyển dụng đã cập nhật.', 'success');
        }
        // Go back to worker list
        if (window.location.pathname.includes('worker_detail.html')) {
            window.location.href = 'labor.html';
        } else {
            // Fallback: reload the section
            window.location.reload();
        }
    } catch (err) {
        console.error('Dismiss worker error:', err);
        if (overlay) overlay.remove();
        const errMsg = err && err.message ? err.message : (typeof err === 'string' ? err : 'Lỗi không xác định');
        if (typeof agriAlert === 'function') {
            agriAlert(errMsg, 'error');
        }
    }
}

window.confirmDismissWorker = confirmDismissWorker;
window.executeDismissWorker = executeDismissWorker;

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

// ============ TASK HISTORY WITH CALENDAR ============
let _historyAllTasks = [];
let _historyCalendarDate = new Date();
let _historySelectedDate = null;

async function openTaskHistoryModal() {
    const modal = document.getElementById('task-history-modal');
    if (!modal) return;
    modal.style.display = 'flex';

    // Load all tasks from API
    try {
        const ownerId = await getCurrentUserId();
        if (!ownerId) return;
        _historyAllTasks = await fetchAPI(`${LABOR_API_BASE}/tasks/owner/${ownerId}`) || [];
    } catch (e) {
        console.error('Error loading task history:', e);
        _historyAllTasks = [];
    }

    _historyCalendarDate = new Date();
    _historySelectedDate = null;
    renderHistoryCalendar();
    // Show today's tasks by default
    const today = new Date();
    _historySelectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    renderHistoryCalendar();
    renderHistoryTasksForDate(_historySelectedDate);
}

function closeTaskHistoryModal() {
    const modal = document.getElementById('task-history-modal');
    if (modal) modal.style.display = 'none';
}

function historyCalendarPrev() {
    _historyCalendarDate.setMonth(_historyCalendarDate.getMonth() - 1);
    renderHistoryCalendar();
}

function historyCalendarNext() {
    _historyCalendarDate.setMonth(_historyCalendarDate.getMonth() + 1);
    renderHistoryCalendar();
}

function _toLocalDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _getTaskDateKeys(task) {
    const keys = new Set();
    if (task.createdAt) keys.add(new Date(task.createdAt).toLocaleDateString('sv-SE'));
    if (task.completedAt) keys.add(new Date(task.completedAt).toLocaleDateString('sv-SE'));
    if (task.approvedAt) keys.add(new Date(task.approvedAt).toLocaleDateString('sv-SE'));
    return keys;
}

function renderHistoryCalendar() {
    const titleEl = document.getElementById('history-calendar-title');
    const gridEl = document.getElementById('history-calendar-grid');
    if (!titleEl || !gridEl) return;

    const year = _historyCalendarDate.getFullYear();
    const month = _historyCalendarDate.getMonth();
    const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
        'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
    titleEl.textContent = `${monthNames[month]} ${year}`;

    // Count tasks per day for this month
    const taskCountByDay = {};
    _historyAllTasks.forEach(t => {
        _getTaskDateKeys(t).forEach(key => {
            if (key.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) {
                taskCountByDay[key] = (taskCountByDay[key] || 0) + 1;
            }
        });
    });

    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = _toLocalDateStr(new Date());

    let html = '';
    // Day headers
    const dayHeaders = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    dayHeaders.forEach(d => {
        html += `<div style="font-size:11px; font-weight:700; color:#9ca3af; padding:6px 0;">${d}</div>`;
    });

    // Empty slots
    for (let i = 0; i < firstDay; i++) {
        html += '<div></div>';
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const count = taskCountByDay[dateStr] || 0;
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === _historySelectedDate;

        let bgStyle = 'background:transparent;';
        let textColor = 'color:#374151;';
        let dotHtml = '';

        if (isSelected) {
            bgStyle = 'background:#2563eb;';
            textColor = 'color:white;';
        } else if (isToday) {
            bgStyle = 'background:#dbeafe;';
            textColor = 'color:#2563eb;';
        }

        if (count > 0 && !isSelected) {
            dotHtml = `<div style="width:5px; height:5px; border-radius:50%; background:#10b981; margin:1px auto 0;"></div>`;
        } else if (count > 0 && isSelected) {
            dotHtml = `<div style="width:5px; height:5px; border-radius:50%; background:white; margin:1px auto 0;"></div>`;
        }

        html += `<div onclick="selectHistoryDate('${dateStr}')" style="cursor:pointer; padding:4px 0; border-radius:8px; ${bgStyle} ${textColor} font-size:13px; font-weight:600; transition:background 0.15s;"
            onmouseenter="if(!this.classList.contains('selected'))this.style.background='#f3f4f6'"
            onmouseleave="if(!this.classList.contains('selected'))this.style.background='${isSelected ? '#2563eb' : isToday ? '#dbeafe' : 'transparent'}'">
            ${day}${dotHtml}</div>`;
    }

    gridEl.innerHTML = html;

    // Update summary
    renderHistorySummary();
}

function renderHistorySummary() {
    const el = document.getElementById('history-summary');
    if (!el) return;

    const total = _historyAllTasks.length;
    const completed = _historyAllTasks.filter(t => t.status === 'COMPLETED' || t.status === 'APPROVED').length;
    const pending = _historyAllTasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length;
    const cancelled = _historyAllTasks.filter(t => t.status === 'CANCELLED').length;

    el.innerHTML = `
        <div style="font-weight:700; color:#111827; margin-bottom:8px; font-size:14px;">Tổng quan</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            <div style="display:flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:#2563eb;"></span> Tổng: <strong>${total}</strong></div>
            <div style="display:flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:#10b981;"></span> Xong: <strong>${completed}</strong></div>
            <div style="display:flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:#f59e0b;"></span> Đang làm: <strong>${pending}</strong></div>
            <div style="display:flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:#ef4444;"></span> Đã hủy: <strong>${cancelled}</strong></div>
        </div>
    `;
}

function selectHistoryDate(dateStr) {
    _historySelectedDate = dateStr;
    renderHistoryCalendar();
    renderHistoryTasksForDate(dateStr);
}

function renderHistoryTasksForDate(dateStr) {
    const container = document.getElementById('history-task-list');
    if (!container) return;

    // Filter tasks for this date
    const tasksForDate = _historyAllTasks.filter(t => {
        return _getTaskDateKeys(t).has(dateStr);
    });

    // Merge history tasks into ownerTasksById so openOwnerTaskDetail can find them
    if (!ownerTasksById) ownerTasksById = {};
    tasksForDate.forEach(t => {
        if (t.id && !ownerTasksById[t.id]) {
            ownerTasksById[t.id] = t;
        }
    });

    // Sort: active first, then by createdAt desc
    tasksForDate.sort((a, b) => {
        const aActive = a.status !== 'COMPLETED' && a.status !== 'CANCELLED' && a.status !== 'APPROVED';
        const bActive = b.status !== 'COMPLETED' && b.status !== 'CANCELLED' && b.status !== 'APPROVED';
        if (aActive !== bActive) return aActive ? -1 : 1;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    const dateDisplay = new Date(dateStr + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

    if (tasksForDate.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:3rem; color:#9ca3af;">
                <span class="material-symbols-outlined" style="font-size:48px; opacity:0.5;">event_busy</span>
                <p style="margin-top:8px; font-size:14px;">Không có công việc ngày ${escapeHtml(dateDisplay)}</p>
            </div>`;
        return;
    }

    const completedCount = tasksForDate.filter(t => t.status === 'COMPLETED' || t.status === 'APPROVED').length;

    let html = `<div style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <div>
            <div style="font-weight:700; color:#111827; font-size:15px;">${escapeHtml(dateDisplay)}</div>
            <div style="font-size:13px; color:#6b7280; margin-top:2px;">${tasksForDate.length} công việc · ${completedCount} hoàn thành</div>
        </div>
    </div>`;

    tasksForDate.forEach(task => {
        const statusCfg = {
            'COMPLETED': { icon: 'check_circle', label: 'Hoàn thành', color: '#16a34a', bg: '#f0fdf4' },
            'APPROVED': { icon: 'verified', label: 'Đã duyệt', color: '#7c3aed', bg: '#f5f3ff' },
            'IN_PROGRESS': { icon: 'autorenew', label: 'Đang thực hiện', color: '#2563eb', bg: '#eff6ff' },
            'CANCELLED': { icon: 'cancel', label: 'Đã hủy', color: '#dc2626', bg: '#fef2f2' },
            'PENDING': { icon: 'pending', label: 'Chờ xử lý', color: '#d97706', bg: '#fffbeb' }
        };
        const status = task.status ? String(task.status).toUpperCase() : 'PENDING';
        const sc = statusCfg[status] || statusCfg['PENDING'];

        const workerName = task.worker
            ? (task.worker.fullName || task.worker.email || 'Nhân công')
            : (task.isAutoCreated ? 'Chưa phân công' : 'Tôi (Tự làm)');

        const createdTime = task.createdAt
            ? new Date(task.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
            : '--';

        const completedTime = task.completedAt
            ? new Date(task.completedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
            : null;

        const typeLabel = getTaskTypeLabel(task.taskType);

        const priority = (task.priority || 'NORMAL').toUpperCase();
        let priLabel = 'Bình thường';
        let priColor = '#6b7280';
        if (priority === 'HIGH' || priority === 'URGENT') { priLabel = priority === 'URGENT' ? 'Khẩn cấp' : 'Cao'; priColor = '#dc2626'; }
        else if (priority === 'LOW') { priLabel = 'Thấp'; priColor = '#16a34a'; }

        const locationLabel = task.field ? (task.field.name || 'Ruộng') : (task.pen ? (task.pen.name || task.pen.code || 'Chuồng') : null);

        html += `
        <div style="background:white; border:1px solid #e5e7eb; border-radius:12px; padding:14px; cursor:pointer; transition:box-shadow 0.2s;"
             onmouseenter="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'"
             onmouseleave="this.style.boxShadow='none'"
             onclick="closeTaskHistoryModal(); setTimeout(()=>openOwnerTaskDetail(${task.id}), 200)">
            <!-- Header -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <span style="font-weight:700; color:#111827; font-size:14px;">${escapeHtml(task.name)}</span>
                        <span style="font-size:11px; padding:2px 8px; border-radius:999px; background:${sc.bg}; color:${sc.color}; font-weight:600;">${sc.label}</span>
                    </div>
                    ${task.description ? `<p style="margin:4px 0 0; font-size:12px; color:#6b7280; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:350px;">${escapeHtml(task.description)}</p>` : ''}
                </div>
            </div>
            <!-- Info grid -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:10px; font-size:12px; color:#6b7280;">
                <div style="display:flex; align-items:center; gap:4px;">
                    <span class="material-symbols-outlined" style="font-size:15px; color:#9ca3af;">person</span>
                    <span>${escapeHtml(workerName)}</span>
                </div>
                <div style="display:flex; align-items:center; gap:4px;">
                    <span class="material-symbols-outlined" style="font-size:15px; color:#9ca3af;">category</span>
                    <span>${typeLabel}</span>
                </div>
                <div style="display:flex; align-items:center; gap:4px;">
                    <span class="material-symbols-outlined" style="font-size:15px; color:#9ca3af;">schedule</span>
                    <span>Giao: ${escapeHtml(createdTime)}</span>
                </div>
                ${completedTime ? `
                <div style="display:flex; align-items:center; gap:4px;">
                    <span class="material-symbols-outlined" style="font-size:15px; color:#16a34a;">check_circle</span>
                    <span style="color:#16a34a;">Xong: ${escapeHtml(completedTime)}</span>
                </div>` : `
                <div style="display:flex; align-items:center; gap:4px;">
                    <span class="material-symbols-outlined" style="font-size:15px; color:${priColor};">flag</span>
                    <span style="color:${priColor};">${priLabel}</span>
                </div>`}
                ${locationLabel ? `
                <div style="display:flex; align-items:center; gap:4px;">
                    <span class="material-symbols-outlined" style="font-size:15px; color:#9ca3af;">location_on</span>
                    <span>${escapeHtml(locationLabel)}</span>
                </div>` : ''}
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

// ============ DELETE PENDING TASK ============

function showDeleteConfirmModal(taskId, taskName) {
    // Remove any existing modal
    const existing = document.getElementById('delete-confirm-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'delete-confirm-overlay';
    overlay.className = 'delete-confirm-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div class="delete-confirm-box">
            <div style="text-align:center; margin-bottom:20px;">
                <div style="width:56px; height:56px; border-radius:50%; background:#fef2f2; display:flex; align-items:center; justify-content:center; margin:0 auto 12px;">
                    <span class="material-symbols-outlined" style="font-size:28px; color:#ef4444;">delete_forever</span>
                </div>
                <h3 style="margin:0; font-size:18px; font-weight:700; color:#111827;">Xóa công việc?</h3>
                <p style="margin:8px 0 0; font-size:14px; color:#6b7280; line-height:1.5;">
                    Bạn có chắc muốn xóa công việc<br>
                    <strong style="color:#111827;">"${taskName}"</strong>?
                </p>
                <p style="margin:6px 0 0; font-size:12px; color:#9ca3af;">Hành động này không thể hoàn tác.</p>
            </div>
            <div style="display:flex; gap:10px; justify-content:center;">
                <button onclick="document.getElementById('delete-confirm-overlay').remove()"
                    style="padding:10px 24px; border-radius:10px; border:1px solid #d1d5db; background:white; color:#374151; font-weight:600; font-size:14px; cursor:pointer; transition:all 0.2s;"
                    onmouseenter="this.style.background='#f3f4f6'" onmouseleave="this.style.background='white'">
                    Hủy
                </button>
                <button onclick="deletePendingTask(${taskId})"
                    style="padding:10px 24px; border-radius:10px; border:none; background:#ef4444; color:white; font-weight:600; font-size:14px; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:6px;"
                    onmouseenter="this.style.background='#dc2626'" onmouseleave="this.style.background='#ef4444'">
                    <span class="material-symbols-outlined" style="font-size:18px;">delete</span> Xóa
                </button>
            </div>
        </div>`;

    document.body.appendChild(overlay);
}

async function deletePendingTask(taskId) {
    const overlay = document.getElementById('delete-confirm-overlay');
    const deleteBtn = overlay?.querySelector('button:last-child');
    if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px; animation:spin 1s linear infinite;">sync</span> Đang xóa...';
    }

    try {
        await fetchAPI(`${LABOR_API_BASE}/tasks/${taskId}`, 'DELETE');
        if (overlay) overlay.remove();

        // Remove from local cache
        if (ownerTasksById && ownerTasksById[taskId]) {
            delete ownerTasksById[taskId];
        }

        // Refresh the view
        if (ownerTasksById) {
            renderTasks(Object.values(ownerTasksById));
        }

        if (typeof agriAlert === 'function') {
            agriAlert('Đã xóa công việc thành công', 'success');
        }
    } catch (err) {
        console.error('Delete task error:', err);
        if (overlay) overlay.remove();
        if (typeof agriAlert === 'function') {
            agriAlert('Không thể xóa công việc: ' + (err.message || 'Lỗi không xác định'), 'error');
        }
    }
}

// =====================================================================
// ========== VIEW CONTRACT MODAL (Auto-inject, works on any page) =====
// =====================================================================

/**
 * Opens a modal to view a worker's contract.
 * - Auto-injects modal HTML into document.body (works on labor.html, worker_detail.html, etc.)
 * - If no contract found → shows a prompt to create a new one
 * - If contract found → displays readonly contract content with signatures
 */
async function openViewContractModal(workerId) {
    if (!workerId) {
        if (typeof agriAlert === 'function') agriAlert('Không xác định được nhân công', 'warning');
        return;
    }

    // Show loading indicator
    _showViewContractLoading();

    try {
        // Fetch contracts for this worker
        const contracts = await fetchAPI(`${LABOR_API_BASE}/contracts/worker/${workerId}`);

        // Remove loading
        _removeViewContractLoading();

        if (!contracts || !Array.isArray(contracts) || contracts.length === 0) {
            // ── No contract found → Prompt to create ──
            _showNoContractPrompt(workerId);
            return;
        }

        // Use the latest contract (last in array or most recent)
        const contract = contracts[contracts.length - 1];
        _renderViewContractModal(contract);

    } catch (err) {
        _removeViewContractLoading();
        console.error('Error fetching contracts:', err);
        if (typeof agriAlert === 'function') {
            agriAlert('Không thể tải hợp đồng: ' + (err.message || 'Lỗi không xác định'), 'error');
        }
    }
}

/** Show a small loading overlay */
function _showViewContractLoading() {
    _removeViewContractLoading();
    const loader = document.createElement('div');
    loader.id = 'vc-loading-overlay';
    loader.style.cssText = 'position:fixed; inset:0; z-index:10002; background:rgba(0,0,0,0.35); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; animation:fadeIn 0.2s ease;';
    loader.innerHTML = `
        <div style="background:white; padding:28px 36px; border-radius:16px; display:flex; align-items:center; gap:14px; box-shadow:0 20px 60px rgba(0,0,0,0.2);">
            <span class="material-symbols-outlined" style="font-size:28px; color:#10b981; animation:spin 1s linear infinite;">sync</span>
            <span style="font-size:15px; font-weight:600; color:#374151;">Đang tải hợp đồng...</span>
        </div>`;
    document.body.appendChild(loader);
}

function _removeViewContractLoading() {
    const el = document.getElementById('vc-loading-overlay');
    if (el) el.remove();
}

/** Prompt user when no contract exists */
function _showNoContractPrompt(workerId) {
    const existing = document.getElementById('vc-no-contract-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'vc-no-contract-overlay';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:10002; background:rgba(0,0,0,0.5); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; animation:fadeIn 0.2s ease;';

    overlay.innerHTML = `
        <div style="background:white; border-radius:20px; max-width:460px; width:92%; box-shadow:0 25px 60px rgba(0,0,0,0.3); overflow:hidden; animation:slideUp 0.25s ease;">
            <div style="padding:28px 28px 0; text-align:center;">
                <div style="width:72px; height:72px; margin:0 auto 16px; background:linear-gradient(135deg,#fef3c7,#fde68a); border-radius:50%; display:flex; align-items:center; justify-content:center;">
                    <span class="material-symbols-outlined" style="font-size:36px; color:#d97706;">description_off</span>
                </div>
                <h3 style="margin:0 0 8px; font-size:19px; font-weight:800; color:#111827;">Chưa có Hợp đồng</h3>
                <p style="margin:0; color:#6b7280; font-size:14px; line-height:1.6;">Nhân công này chưa được tạo hợp đồng lao động. Bạn có muốn tạo mới ngay bây giờ không?</p>
            </div>
            <div style="padding:20px 28px 28px; display:flex; gap:12px; justify-content:center;">
                <button id="vc-no-contract-cancel" style="padding:11px 24px; border:1px solid #e5e7eb; background:white; color:#6b7280; border-radius:10px; cursor:pointer; font-weight:600; font-size:14px; transition:all 0.15s;"
                    onmouseenter="this.style.background='#f9fafb'" onmouseleave="this.style.background='white'">
                    Để sau
                </button>
                <button id="vc-no-contract-create" style="padding:11px 24px; border:none; background:linear-gradient(135deg,#10b981,#059669); color:white; border-radius:10px; cursor:pointer; font-weight:700; font-size:14px; display:flex; align-items:center; gap:6px; box-shadow:0 4px 14px rgba(16,185,129,0.35); transition:all 0.15s;"
                    onmouseenter="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 16px rgba(16,185,129,0.4)'"
                    onmouseleave="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 14px rgba(16,185,129,0.35)'">
                    <span class="material-symbols-outlined" style="font-size:18px;">add_circle</span>
                    Tạo hợp đồng
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Cancel
    document.getElementById('vc-no-contract-cancel').onclick = () => overlay.remove();

    // Create → find applicationId for this worker, then open the create modal
    document.getElementById('vc-no-contract-create').onclick = async () => {
        overlay.remove();
        await _openCreateContractForWorker(workerId);
    };
}

/** Find the ACCEPTED application for a worker and open the contract creation modal */
async function _openCreateContractForWorker(workerId) {
    try {
        // Fetch applications for this worker
        const apps = await fetchAPI(`${LABOR_API_BASE}/recruitment/applications/worker/${workerId}`);
        // Find the ACCEPTED application
        const acceptedApp = (apps || []).find(a => a.status === 'ACCEPTED');

        if (!acceptedApp) {
            if (typeof agriAlert === 'function') {
                agriAlert('Không tìm thấy đơn ứng tuyển đã duyệt cho nhân công này. Không thể tạo hợp đồng.', 'warning');
            }
            return;
        }

        const workerName = acceptedApp.worker
            ? (acceptedApp.worker.fullName || acceptedApp.worker.email || 'Nhân công')
            : 'Nhân công';
        let farmName = '';
        if (acceptedApp.post && acceptedApp.post.farm) {
            farmName = acceptedApp.post.farm.name || '';
        }
        if (!farmName) {
            try {
                const farms = await fetchAPI(`${LABOR_API_BASE}/farms/my-farms`);
                if (farms && farms.length > 0) farmName = farms[0].name || '';
            } catch(e) {}
        }

        // Ensure the contract creation modal exists in DOM (auto-inject if not on labor.html)
        _ensureCreateContractModalExists();

        if (typeof openContractModal === 'function') {
            openContractModal(acceptedApp.id, workerName, farmName);
        } else {
            if (typeof agriAlert === 'function') {
                agriAlert('Không thể mở form tạo hợp đồng. Vui lòng thử từ trang Nhân công.', 'warning');
            }
        }
    } catch(err) {
        console.error('Error finding application for worker:', err);
        if (typeof agriAlert === 'function') {
            agriAlert('Lỗi khi tìm đơn ứng tuyển: ' + (err.message || ''), 'error');
        }
    }
}

/**
 * Auto-inject the Contract Creation Modal + its JS logic into document.body
 * if not already on a page that has it (e.g. worker_detail.html).
 */
function _ensureCreateContractModalExists() {
    if (document.getElementById('contract-modal')) return; // Already exists

    // Need to also add SignaturePad if not loaded
    if (typeof SignaturePad === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/signature_pad@4.1.7/dist/signature_pad.umd.min.js';
        document.head.appendChild(script);
    }

    const modalHTML = `
    <div id="contract-modal" style="display:none; position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,0.55); backdrop-filter:blur(6px); align-items:center; justify-content:center;">
        <div style="background:white; border-radius:20px; width:95%; max-width:820px; max-height:95vh; overflow:hidden; box-shadow:0 25px 60px rgba(0,0,0,0.3); display:flex; flex-direction:column; animation:fadeIn 0.3s ease;">
            <div style="padding:20px 28px; background:linear-gradient(135deg,#ecfdf5,#d1fae5); border-bottom:1px solid #a7f3d0; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h2 style="margin:0; font-size:20px; font-weight:700; color:#065f46;">📝 Tạo Hợp đồng lao động</h2>
                    <p id="contract-modal-subtitle" style="margin:4px 0 0; font-size:13px; color:#047857;"></p>
                </div>
                <button onclick="closeContractModal()" style="width:36px; height:36px; border-radius:50%; border:none; background:white; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                    <span class="material-symbols-outlined" style="font-size:20px; color:#6b7280;">close</span>
                </button>
            </div>
            <div style="flex:1; overflow-y:auto; padding:24px 28px;">
                <div style="margin-bottom:20px; display:flex; gap:16px; flex-wrap:wrap;">
                    <div style="flex:1; min-width:180px;">
                        <label style="font-size:13px; font-weight:600; color:#374151; display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                            <span class="material-symbols-outlined" style="font-size:16px; color:#10b981;">event</span> Ngày bắt đầu
                        </label>
                        <input type="date" id="contract-start-date" style="width:100%; padding:10px 14px; border:2px solid #e5e7eb; border-radius:10px; font-size:14px; outline:none; font-family:inherit;" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='#e5e7eb'">
                    </div>
                    <div style="flex:1; min-width:180px;">
                        <label style="font-size:13px; font-weight:600; color:#374151; display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                            <span class="material-symbols-outlined" style="font-size:16px; color:#ef4444;">event_busy</span> Ngày kết thúc
                        </label>
                        <input type="date" id="contract-end-date" style="width:100%; padding:10px 14px; border:2px solid #e5e7eb; border-radius:10px; font-size:14px; outline:none; font-family:inherit;" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='#e5e7eb'">
                    </div>
                    <div style="width:100%;">
                        <button type="button" onclick="regenerateContractContent()" style="padding:8px 16px; border-radius:8px; border:1px solid #10b981; background:#ecfdf5; color:#065f46; font-size:13px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                            <span class="material-symbols-outlined" style="font-size:16px;">refresh</span> Cập nhật vào hợp đồng
                        </button>
                    </div>
                </div>
                <div style="margin-bottom:20px;">
                    <label style="font-size:13px; font-weight:600; color:#374151; display:flex; justify-content:space-between; margin-bottom:8px;">
                        <span>Chi tiết hợp đồng (Có thể chỉnh sửa)</span>
                    </label>
                    <div id="contract-content" contenteditable="true" style="width:100%; padding:24px; border:2px solid #e5e7eb; border-radius:12px; background:#fff; font-size:14px; line-height:1.7; outline:none; font-family:'Times New Roman', serif; max-height:400px; overflow-y:auto; box-shadow:inset 0 2px 4px rgba(0,0,0,0.02);" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='#e5e7eb'"></div>
                </div>
                <div style="margin-bottom:20px;">
                    <label style="font-size:13px; font-weight:600; color:#374151; display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                        <span class="material-symbols-outlined" style="font-size:16px; color:#10b981;">draw</span> Chữ ký Chủ trang trại
                    </label>
                    <div style="border:2px solid #e5e7eb; border-radius:12px; overflow:hidden; background:#fafafa; position:relative;">
                        <canvas id="owner-signature-pad" style="width:100%; height:180px; display:block;"></canvas>
                        <button onclick="clearOwnerSignature()" style="position:absolute; top:8px; right:8px; background:rgba(239,68,68,0.1); border:1px solid #fca5a5; color:#ef4444; padding:4px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:4px;">
                            <span class="material-symbols-outlined" style="font-size:14px;">refresh</span> Xóa
                        </button>
                    </div>
                    <p style="margin:6px 0 0; font-size:12px; color:#9ca3af;">Dùng chuột hoặc ngón tay để ký trên khung trên</p>
                </div>
            </div>
            <div style="padding:16px 28px; border-top:1px solid #e5e7eb; display:flex; justify-content:flex-end; gap:12px; background:#f9fafb;">
                <button onclick="closeContractModal()" style="padding:10px 24px; border-radius:10px; border:1px solid #d1d5db; background:white; color:#374151; font-weight:600; font-size:14px; cursor:pointer;">Hủy</button>
                <button id="contract-submit-btn" onclick="submitContract()" style="padding:10px 24px; border-radius:10px; border:none; background:linear-gradient(135deg,#10b981,#059669); color:white; font-weight:600; font-size:14px; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 4px 12px rgba(16,185,129,0.3);">
                    <span class="material-symbols-outlined" style="font-size:18px;">send</span> Gửi hợp đồng
                </button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // ── Inject the contract modal JS logic if functions don't exist yet ──
    if (typeof window.openContractModal !== 'function') {
        let _ownerSignaturePad = null;
        let _contractApplicationId = null;
        let _cWorkerName = '';
        let _cFarmName = '';

        window.openContractModal = function(applicationId, workerName, farmName) {
            _contractApplicationId = applicationId;
            _cWorkerName = workerName || 'Nhân công';
            _cFarmName = farmName || 'AgriPlanner';
            const modal = document.getElementById('contract-modal');
            modal.style.display = 'flex';
            document.getElementById('contract-modal-subtitle').textContent = `Nhân công: ${_cWorkerName}`;

            const today = new Date();
            const endDate = new Date(today);
            endDate.setMonth(endDate.getMonth() + 6);
            document.getElementById('contract-start-date').value = today.toISOString().split('T')[0];
            document.getElementById('contract-end-date').value = endDate.toISOString().split('T')[0];

            window.regenerateContractContent();

            setTimeout(() => {
                const canvas = document.getElementById('owner-signature-pad');
                canvas.width = canvas.offsetWidth;
                canvas.height = 180;
                if (typeof SignaturePad !== 'undefined') {
                    _ownerSignaturePad = new SignaturePad(canvas, { penColor: '#1e3a5f', backgroundColor: 'rgba(255,255,255,0)' });
                }
            }, 200);
        };

        window.regenerateContractContent = function() {
            const startVal = document.getElementById('contract-start-date').value;
            const endVal = document.getElementById('contract-end-date').value;
            const today = new Date();
            const formattedDate = `ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;
            const ownerName = localStorage.getItem('fullName') || sessionStorage.getItem('fullName') || 'Chủ trang trại';
            const safeHtml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

            let durationText = 'Theo thỏa thuận giữa hai bên';
            if (startVal && endVal) {
                const s = new Date(startVal);
                const e = new Date(endVal);
                durationText = `Từ ngày <b>${s.getDate()}/${s.getMonth()+1}/${s.getFullYear()}</b> đến ngày <b>${e.getDate()}/${e.getMonth()+1}/${e.getFullYear()}</b>`;
            }

            document.getElementById('contract-content').innerHTML =
`<div style="text-align: center; margin-bottom: 20px;">
    <h3 style="margin:0; font-weight:bold; font-size: 16px;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h3>
    <h4 style="margin:4px 0 0; font-weight:bold; font-size: 14px; text-decoration: underline;">Độc lập - Tự do - Hạnh phúc</h4>
</div>
<div style="text-align: center; margin-bottom: 24px;">
    <h2 style="margin:0; font-weight:bold; font-size: 20px; color: #111827;">HỢP ĐỒNG LAO ĐỘNG NÔNG NGHIỆP</h2>
    <p style="margin:4px 0 0; font-style: italic; color: #4b5563;">Hôm nay, ${formattedDate}, chúng tôi gồm:</p>
</div>
<div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
    <strong>BÊN A (NGƯỜI SỬ DỤNG LAO ĐỘNG):</strong>
    <ul style="margin: 8px 0 0; padding-left: 20px;">
        <li>Ông/Bà: <b>${safeHtml(ownerName)}</b></li>
        <li>Đại diện cho: <b>Nông trại ${safeHtml(_cFarmName)}</b></li>
    </ul>
</div>
<div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
    <strong>BÊN B (NGƯỜI LAO ĐỘNG):</strong>
    <ul style="margin: 8px 0 0; padding-left: 20px;">
        <li>Ông/Bà: <b>${safeHtml(_cWorkerName)}</b></li>
    </ul>
</div>
<div style="margin-bottom: 16px;">
    <h4 style="margin:0 0 8px; font-weight:bold; font-size: 15px;">ĐIỀU 1: NỘI DUNG CÔNG VIỆC</h4>
    <p style="margin:0; padding-left: 10px;">Bên B đồng ý làm việc tại nông trại của Bên A theo sự phân công trên hệ thống điện tử AgriPlanner.</p>
</div>
<div style="margin-bottom: 16px; background:#fffbeb; padding:12px; border-radius:8px; border-left:4px solid #f59e0b;">
    <h4 style="margin:0 0 8px; font-weight:bold; font-size: 15px;">ĐIỀU 2: THỜI HẠN HỢP ĐỒNG</h4>
    <p style="margin:0; padding-left: 10px;">${durationText}. Sau khi hết hạn, hai bên có thể gia hạn thêm bằng hợp đồng mới trên hệ thống.</p>
</div>
<div style="margin-bottom: 16px;">
    <h4 style="margin:0 0 8px; font-weight:bold; font-size: 15px;">ĐIỀU 3: LƯƠNG VÀ PHỤ CẤP</h4>
    <p style="margin:0; padding-left: 10px;">Mức lương và chu kỳ thanh toán sẽ được tự động thỏa thuận và quyết toán thông qua Module Trả lương của hệ thống.</p>
</div>
<div style="margin-bottom: 16px;">
    <h4 style="margin:0 0 8px; font-weight:bold; font-size: 15px;">ĐIỀU 4: CHẤM DỨT HỢP ĐỒNG</h4>
    <p style="margin:0; padding-left: 10px;">Hợp đồng có thể chấm dứt trước thời hạn khi hai bên thỏa thuận hoặc theo quy định pháp luật. Khi chấm dứt, Bên A phải trả đủ số tiền còn nợ Bên B theo hệ thống ghi nhận.</p>
</div>
<p style="font-style: italic; text-align: center; margin-top: 30px; font-weight: bold; color: #1e3a8a;">Hai bên đã đọc, hiểu và đồng ý ký xác nhận bằng Chữ ký Số.</p>`;
        };

        window.closeContractModal = function() {
            document.getElementById('contract-modal').style.display = 'none';
            _ownerSignaturePad = null;
            _contractApplicationId = null;
        };

        window.clearOwnerSignature = function() {
            if (_ownerSignaturePad) _ownerSignaturePad.clear();
        };

        window.submitContract = async function() {
            if (!_contractApplicationId) return;
            const content = document.getElementById('contract-content').innerHTML.trim();
            if (!content || content.length < 50) {
                if (typeof agriAlert === 'function') agriAlert('Vui lòng nhập nội dung hợp đồng', 'warning');
                return;
            }
            if (!_ownerSignaturePad || _ownerSignaturePad.isEmpty()) {
                if (typeof agriAlert === 'function') agriAlert('Vui lòng ký tên trước khi gửi', 'warning');
                return;
            }

            const btn = document.getElementById('contract-submit-btn');
            btn.disabled = true;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px; animation: spin 1s linear infinite;">sync</span> Đang gửi...';

            try {
                const signatureData = _ownerSignaturePad.toDataURL('image/png');
                await fetchAPI(`${LABOR_API_BASE}/contracts`, 'POST', {
                    applicationId: _contractApplicationId,
                    contractContent: content,
                    ownerSignature: signatureData
                });
                if (typeof showToast === 'function') showToast('Thành công', 'Đã tạo và gửi hợp đồng cho nhân công!', 'success');
                window.closeContractModal();
            } catch (e) {
                if (typeof agriAlert === 'function') agriAlert('Lỗi: ' + e.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">send</span> Gửi hợp đồng';
            }
        };

        // CSS for spin animation
        if (!document.getElementById('spin-style')) {
            const s = document.createElement('style');
            s.id = 'spin-style';
            s.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
            document.head.appendChild(s);
        }
    }
}

/** Render the View Contract modal with contract content and signatures */
function _renderViewContractModal(contract) {
    const existing = document.getElementById('vc-view-overlay');
    if (existing) existing.remove();

    const statusLabels = {
        'PENDING_WORKER_SIGN': { text: 'Chờ nhân công ký', color: '#d97706', bg: '#fef3c7', icon: 'hourglass_top' },
        'COMPLETED': { text: 'Đã hoàn tất', color: '#059669', bg: '#d1fae5', icon: 'verified' },
        'CANCELLED': { text: 'Đã hủy', color: '#dc2626', bg: '#fee2e2', icon: 'cancel' }
    };
    const st = statusLabels[contract.status] || statusLabels['PENDING_WORKER_SIGN'];

    // Extract worker/farm info from contract
    const workerName = (contract.application && contract.application.worker)
        ? (contract.application.worker.fullName || contract.application.worker.email || 'Nhân công')
        : 'Nhân công';
    const farmName = (contract.application && contract.application.post)
        ? (contract.application.post.farmName || '')
        : '';
    const ownerName = localStorage.getItem('fullName') || sessionStorage.getItem('fullName') || 'Chủ trang trại';

    const createdDate = contract.createdAt
        ? new Date(contract.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';
    const ownerSignedDate = contract.ownerSignedAt
        ? new Date(contract.ownerSignedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';
    const workerSignedDate = contract.workerSignedAt
        ? new Date(contract.workerSignedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';

    const overlay = document.createElement('div');
    overlay.id = 'vc-view-overlay';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:10001; background:rgba(0,0,0,0.55); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; animation:fadeIn 0.2s ease;';

    overlay.innerHTML = `
        <div style="background:white; border-radius:20px; width:95%; max-width:860px; max-height:95vh; overflow:hidden; box-shadow:0 25px 60px rgba(0,0,0,0.3); display:flex; flex-direction:column; animation:slideUp 0.25s ease;">
            <!-- Header -->
            <div style="padding:20px 28px; background:linear-gradient(135deg,#ecfdf5,#d1fae5); border-bottom:1px solid #a7f3d0; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
                <div style="display:flex; align-items:center; gap:16px;">
                    <div style="width:48px; height:48px; background:linear-gradient(135deg,#10b981,#059669); border-radius:14px; display:flex; align-items:center; justify-content:center;">
                        <span class="material-symbols-outlined" style="font-size:26px; color:white;">description</span>
                    </div>
                    <div>
                        <h2 style="margin:0; font-size:20px; font-weight:800; color:#065f46;">Hợp đồng lao động</h2>
                        <div style="display:flex; gap:10px; align-items:center; margin-top:4px; flex-wrap:wrap;">
                            <span style="font-size:13px; color:#047857; font-weight:500;">Nhân công: <b>${_escHtml(workerName)}</b></span>
                            ${farmName ? `<span style="font-size:12px; color:#6b7280;">• Nông trại: ${_escHtml(farmName)}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="display:flex; align-items:center; gap:6px; padding:6px 14px; border-radius:999px; background:${st.bg}; color:${st.color}; font-size:13px; font-weight:700;">
                        <span class="material-symbols-outlined" style="font-size:16px;">${st.icon}</span>
                        ${st.text}
                    </div>
                    <button onclick="document.getElementById('vc-view-overlay').remove()" style="width:36px; height:36px; border-radius:50%; border:none; background:white; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.1); transition:all 0.15s;"
                        onmouseenter="this.style.background='#f3f4f6'" onmouseleave="this.style.background='white'">
                        <span class="material-symbols-outlined" style="font-size:20px; color:#6b7280;">close</span>
                    </button>
                </div>
            </div>

            <!-- Body -->
            <div style="flex:1; overflow-y:auto; padding:24px 28px;">
                <!-- Info badges -->
                <div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:20px;">
                    ${createdDate ? `<div style="display:flex; align-items:center; gap:6px; font-size:13px; color:#6b7280;"><span class="material-symbols-outlined" style="font-size:16px;">calendar_today</span> Tạo: <b>${createdDate}</b></div>` : ''}
                    ${ownerSignedDate ? `<div style="display:flex; align-items:center; gap:6px; font-size:13px; color:#059669;"><span class="material-symbols-outlined" style="font-size:16px;">draw</span> Chủ ký: <b>${ownerSignedDate}</b></div>` : ''}
                    ${workerSignedDate ? `<div style="display:flex; align-items:center; gap:6px; font-size:13px; color:#2563eb;"><span class="material-symbols-outlined" style="font-size:16px;">draw</span> Nhân công ký: <b>${workerSignedDate}</b></div>` : ''}
                </div>

                <!-- Contract Content -->
                <div style="border:2px solid #e5e7eb; border-radius:14px; padding:24px; background:#fefefe; font-family:'Times New Roman', serif; font-size:14px; line-height:1.8; max-height:400px; overflow-y:auto; box-shadow:inset 0 2px 4px rgba(0,0,0,0.02);">
                    ${contract.contractContent || '<p style="text-align:center; color:#9ca3af;">Không có nội dung hợp đồng</p>'}
                </div>

                <!-- Signatures Section -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:24px;">
                    <!-- Owner Signature -->
                    <div style="border:1px solid #e5e7eb; border-radius:14px; padding:16px; background:#f9fafb;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                            <span class="material-symbols-outlined" style="font-size:20px; color:#10b981;">verified_user</span>
                            <div>
                                <div style="font-size:13px; font-weight:700; color:#111827;">BÊN A - Chủ trang trại</div>
                                <div style="font-size:12px; color:#6b7280;">${_escHtml(ownerName)}</div>
                            </div>
                        </div>
                        ${contract.ownerSignature
                            ? `<img src="${contract.ownerSignature}" alt="Chữ ký Chủ" style="width:100%; max-height:120px; object-fit:contain; border-radius:8px; background:white; border:1px dashed #d1d5db; padding:8px;">`
                            : `<div style="width:100%; height:80px; display:flex; align-items:center; justify-content:center; border:1px dashed #d1d5db; border-radius:8px; color:#9ca3af; font-size:13px;">Chưa ký</div>`
                        }
                    </div>

                    <!-- Worker Signature -->
                    <div style="border:1px solid #e5e7eb; border-radius:14px; padding:16px; background:#f9fafb;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                            <span class="material-symbols-outlined" style="font-size:20px; color:#2563eb;">person</span>
                            <div>
                                <div style="font-size:13px; font-weight:700; color:#111827;">BÊN B - Nhân công</div>
                                <div style="font-size:12px; color:#6b7280;">${_escHtml(workerName)}</div>
                            </div>
                        </div>
                        ${contract.workerSignature
                            ? `<img src="${contract.workerSignature}" alt="Chữ ký Nhân công" style="width:100%; max-height:120px; object-fit:contain; border-radius:8px; background:white; border:1px dashed #d1d5db; padding:8px;">`
                            : `<div style="width:100%; height:80px; display:flex; align-items:center; justify-content:center; border:1px dashed #d1d5db; border-radius:8px; color:#9ca3af; font-size:13px; font-style:italic;">
                                ${contract.status === 'PENDING_WORKER_SIGN' ? '⏳ Đang chờ nhân công ký...' : 'Chưa ký'}
                              </div>`
                        }
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div style="padding:16px 28px; border-top:1px solid #e5e7eb; display:flex; justify-content:flex-end; gap:12px; background:#f9fafb; flex-shrink:0;">
                <button onclick="document.getElementById('vc-view-overlay').remove()" style="padding:10px 24px; border-radius:10px; border:1px solid #d1d5db; background:white; color:#374151; font-weight:600; font-size:14px; cursor:pointer; transition:all 0.15s;"
                    onmouseenter="this.style.background='#f3f4f6'" onmouseleave="this.style.background='white'">
                    Đóng
                </button>
            </div>
        </div>
    `;

    // Add animations if needed
    if (!document.getElementById('vc-modal-anim-style')) {
        const style = document.createElement('style');
        style.id = 'vc-modal-anim-style';
        style.textContent = `
            @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(overlay);

    // Close on overlay click (but not content click)
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

/** Safe HTML escape helper for view contract */
function _escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
