/**
 * worker-upgrade.js
 * Enhances the Worker Dashboard with:
 * - Start-before-complete constraint (must press "Đang tiến hành" before "Hoàn thành")
 * - Pause/Resume button
 * - Checklist (sub-tasks) toggle in task detail
 * - Task Comments (chat) in detail view
 * 
 * Loaded AFTER worker_dashboard.js to override key functions.
 */

// ─────────── OVERRIDE: completeTask — add start-before-complete constraint ───────────
const _origCompleteTask = window.completeTask;
window.completeTask = async function (taskId) {
    const task = workerTasksById && workerTasksById[taskId] ? workerTasksById[taskId] : null;
    if (!task) {
        if (_origCompleteTask) return _origCompleteTask(taskId);
        return;
    }

    const status = task.status ? String(task.status).toUpperCase() : '';

    // HARD CONSTRAINT: Must start task (Đang tiến hành) before completing
    if (status === 'PENDING') {
        // Show styled warning dialog instead of default alert
        showWorkerConstraintWarning(taskId);
        return;
    }

    // Call original completeTask
    if (_origCompleteTask) return _origCompleteTask(taskId);
};

function showWorkerConstraintWarning(taskId) {
    // Remove any existing
    const existing = document.getElementById('worker-constraint-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'worker-constraint-overlay';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; padding:20px; animation:fadeInUpgrade 0.2s ease;';

    overlay.innerHTML = `
        <div style="background:white; border-radius:16px; max-width:420px; width:100%; box-shadow:0 20px 60px rgba(0,0,0,0.3); overflow:hidden; animation:slideUpUpgrade 0.3s ease;">
            <div style="background:linear-gradient(135deg, #f59e0b, #d97706); padding:20px 24px; color:white;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="material-symbols-outlined" style="font-size:28px;">warning</span>
                    <div>
                        <div style="font-size:16px; font-weight:700;">Yêu cầu bắt đầu trước!</div>
                        <div style="font-size:12px; opacity:0.9; margin-top:2px;">Quy trình làm việc</div>
                    </div>
                </div>
            </div>
            <div style="padding:24px;">
                <p style="font-size:14px; color:#374151; margin:0 0 16px; line-height:1.6;">
                    Bạn cần bấm <strong style="color:#2563eb;">"Đang tiến hành"</strong> trước khi có thể hoàn thành công việc này.
                </p>
                <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:12px; margin-bottom:16px;">
                    <div style="font-size:12px; font-weight:600; color:#1e40af; margin-bottom:4px;">📋 Quy trình:</div>
                    <div style="font-size:13px; color:#3b82f6; line-height:1.8;">
                        1. Bấm <strong>"Đang tiến hành"</strong> để bắt đầu<br>
                        2. Thực hiện công việc<br>
                        3. Bấm <strong>"Hoàn thành"</strong> khi xong
                    </div>
                </div>
                <div style="display:flex; gap:8px; justify-content:flex-end;">
                    <button onclick="document.getElementById('worker-constraint-overlay').remove()"
                            style="padding:8px 16px; border:1px solid #d1d5db; background:white; color:#374151; border-radius:8px; cursor:pointer; font-weight:500; font-size:13px;">
                        Đã hiểu
                    </button>
                    <button onclick="startTaskFromWarning(${taskId})"
                            style="padding:8px 16px; border:none; background:linear-gradient(135deg, #3b82f6, #2563eb); color:white; border-radius:8px; cursor:pointer; font-weight:600; font-size:13px;">
                        <span class="material-symbols-outlined" style="font-size:16px; vertical-align:middle;">play_arrow</span>
                        Bắt đầu ngay
                    </button>
                </div>
            </div>
        </div>
    `;

    // Add animation styles
    if (!document.getElementById('worker-upgrade-style')) {
        const style = document.createElement('style');
        style.id = 'worker-upgrade-style';
        style.textContent = `
            @keyframes fadeInUpgrade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUpUpgrade { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        `;
        document.head.appendChild(style);
    }

    overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
}

async function startTaskFromWarning(taskId) {
    const overlay = document.getElementById('worker-constraint-overlay');
    if (overlay) overlay.remove();

    try {
        await fetchAPI(`${API_BASE}/tasks/${taskId}/start`, 'POST');
        if (workerTasksById[taskId]) workerTasksById[taskId].status = 'IN_PROGRESS';
        if (typeof showToast === 'function') showToast('Đã bắt đầu thực hiện công việc!', 'success');
        else if (typeof showNotification === 'function') showNotification('success', 'Đã bắt đầu!', 'Bạn có thể hoàn thành khi xong.');
        loadTasksList();
    } catch (e) {
        console.error('Error starting task:', e);
        if (typeof showToast === 'function') showToast('Lỗi: ' + e.message, 'error');
        else alert('Lỗi: ' + e.message);
    }
}


// ─────────── PAUSE / RESUME TASK ───────────
async function pauseWorkerTask(taskId) {
    try {
        await fetchAPI(`${API_BASE}/tasks/${taskId}/pause`, 'POST', { reason: 'Worker tạm dừng' });
        if (workerTasksById[taskId]) workerTasksById[taskId].status = 'PAUSED';
        if (typeof showToast === 'function') showToast('Đã tạm dừng công việc', 'info');
        loadTasksList();
    } catch (e) {
        console.error('Error pausing task:', e);
        if (typeof showToast === 'function') showToast('Lỗi: ' + e.message, 'error');
    }
}

async function resumeWorkerTask(taskId) {
    try {
        // Resume = start again
        await fetchAPI(`${API_BASE}/tasks/${taskId}/start`, 'POST');
        if (workerTasksById[taskId]) workerTasksById[taskId].status = 'IN_PROGRESS';
        if (typeof showToast === 'function') showToast('Đã tiếp tục thực hiện!', 'success');
        loadTasksList();
    } catch (e) {
        console.error('Error resuming task:', e);
        if (typeof showToast === 'function') showToast('Lỗi: ' + e.message, 'error');
    }
}


// ─────────── OVERRIDE: getWorkLogActionBlock — add pause/resume UI ───────────
const _origGetWorkLogActionBlock = window.getWorkLogActionBlock;
window.getWorkLogActionBlock = function (task) {
    if (!task) return _origGetWorkLogActionBlock ? _origGetWorkLogActionBlock(task) : '';

    const status = task.status ? String(task.status).toUpperCase() : 'PENDING';

    // If task is IN_PROGRESS, show Pause button
    if (status === 'IN_PROGRESS') {
        return `
            <button onclick="event.stopPropagation(); pauseWorkerTask(${task.id})"
                    class="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors font-medium border border-amber-200"
                    style="font-size:13px;">
                <span class="material-icons-round" style="font-size:18px;">pause</span> Tạm dừng
            </button>
        `;
    }

    // If task is PAUSED, show Resume button
    if (status === 'PAUSED') {
        return `
            <button onclick="event.stopPropagation(); resumeWorkerTask(${task.id})"
                    class="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium border border-blue-200"
                    style="font-size:13px;">
                <span class="material-icons-round" style="font-size:18px;">play_arrow</span> Tiếp tục
            </button>
        `;
    }

    // Default: use original
    return _origGetWorkLogActionBlock ? _origGetWorkLogActionBlock(task) : '';
};


// ─────────── WORKER CHECKLIST TOGGLE ───────────
async function renderWorkerChecklistSection(taskId) {
    try {
        const items = await fetchAPI(`${API_BASE}/tasks/${taskId}/checklists`);
        if (!items || items.length === 0) return '';

        const done = items.filter(i => i.isCompleted || i.completed).length;
        const total = items.length;
        const pct = Math.round((done / total) * 100);

        let html = `<div style="background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; padding:16px; margin-top:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="font-size:14px; font-weight:700; color:#1e293b; display:flex; align-items:center; gap:6px;">
                    <span class="material-symbols-outlined" style="font-size:18px; color:#16a34a;">checklist</span>
                    Danh sách kiểm tra
                </div>
                <span style="font-size:12px; font-weight:700; color:${done === total ? '#16a34a' : '#b45309'}; background:${done === total ? '#f0fdf4' : '#fef3c7'}; padding:2px 10px; border-radius:999px;">${done}/${total}</span>
            </div>
            <div style="height:4px; background:#e2e8f0; border-radius:99px; margin-bottom:12px; overflow:hidden;">
                <div style="height:100%; width:${pct}%; background:${done === total ? '#16a34a' : '#3b82f6'}; border-radius:99px; transition:width 0.3s;"></div>
            </div>`;

        items.forEach(item => {
            const checked = item.isCompleted || item.completed;
            html += `<div style="display:flex; align-items:center; gap:10px; padding:8px 4px; border-bottom:1px solid #f1f5f9; cursor:pointer;"
                         onclick="toggleWorkerChecklist(${item.id}, ${taskId})">
                <div style="width:22px; height:22px; border-radius:6px; border:2px solid ${checked ? '#16a34a' : '#d1d5db'}; background:${checked ? '#16a34a' : 'white'}; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all 0.2s;">
                    ${checked ? '<span class="material-symbols-outlined" style="font-size:14px; color:white;">check</span>' : ''}
                </div>
                <span style="font-size:14px; color:${checked ? '#9ca3af' : '#374151'}; ${checked ? 'text-decoration:line-through;' : ''} flex:1;">${escapeHtml(item.description)}</span>
            </div>`;
        });

        html += `</div>`;
        return html;
    } catch (e) {
        console.warn('Worker checklist load error:', e);
        return '';
    }
}

async function toggleWorkerChecklist(checklistId, taskId) {
    try {
        await fetchAPI(`${API_BASE}/tasks/checklists/${checklistId}`, 'PUT');
        // Refresh task detail if open
        if (typeof openTaskDetail === 'function') openTaskDetail(taskId);
    } catch (e) {
        if (typeof showToast === 'function') showToast('Lỗi: ' + e.message, 'error');
    }
}


// ─────────── WORKER COMMENT CHAT ───────────
async function renderWorkerCommentsSection(taskId) {
    try {
        const comments = await fetchAPI(`${API_BASE}/tasks/${taskId}/comments`);
        if (!comments) return '';

        let html = `<div style="background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; padding:16px; margin-top:16px;">
            <div style="font-size:14px; font-weight:700; color:#1e293b; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
                <span class="material-symbols-outlined" style="font-size:18px; color:#3b82f6;">chat</span>
                Trao đổi (${comments.length})
            </div>`;

        if (comments.length > 0) {
            html += '<div style="max-height:250px; overflow-y:auto; margin-bottom:12px; display:flex; flex-direction:column; gap:8px;">';
            comments.forEach(c => {
                const authorName = c.author ? (c.author.fullName || c.author.email || 'Ẩn danh') : 'Ẩn danh';
                const time = c.createdAt ? new Date(c.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';
                const isWorker = c.author && c.author.role === 'WORKER';
                html += `<div style="display:flex; gap:8px; ${isWorker ? 'flex-direction:row-reverse;' : ''}">
                    <div style="width:28px; height:28px; border-radius:50%; background:${isWorker ? '#ecfdf5' : '#f3f4f6'}; color:${isWorker ? '#16a34a' : '#6b7280'}; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; flex-shrink:0;">${authorName.charAt(0).toUpperCase()}</div>
                    <div style="max-width:70%; padding:8px 12px; border-radius:12px; background:${isWorker ? '#ecfdf5' : '#f3f4f6'}; ${isWorker ? 'border-bottom-right-radius:4px;' : 'border-bottom-left-radius:4px;'}">
                        <div style="font-size:11px; font-weight:600; color:${isWorker ? '#16a34a' : '#6b7280'}; margin-bottom:2px;">${escapeHtml(authorName)}</div>
                        <div style="font-size:13px; color:#374151; white-space:pre-wrap;">${escapeHtml(c.content)}</div>
                        <div style="font-size:10px; color:#9ca3af; margin-top:4px; text-align:right;">${time}</div>
                    </div>
                </div>`;
            });
            html += '</div>';
        } else {
            html += '<p style="color:#9ca3af; font-size:13px; text-align:center; padding:8px;">Chưa có tin nhắn</p>';
        }

        html += `<div style="display:flex; gap:8px; align-items:flex-end; border-top:1px solid #e2e8f0; padding-top:10px;">
            <textarea id="worker-comment-input-${taskId}" rows="1" style="flex:1; padding:8px 12px; font-size:13px; resize:none; border:1px solid #d1d5db; border-radius:12px; outline:none;" placeholder="Nhập tin nhắn..."></textarea>
            <button onclick="sendWorkerComment(${taskId})" style="width:36px; height:36px; border:none; background:#16a34a; color:white; border-radius:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <span class="material-symbols-outlined" style="font-size:18px;">send</span>
            </button>
        </div>`;

        html += `</div>`;
        return html;
    } catch (e) {
        console.warn('Worker comments load error:', e);
        return '';
    }
}

async function sendWorkerComment(taskId) {
    const input = document.getElementById(`worker-comment-input-${taskId}`);
    if (!input || !input.value.trim()) return;

    try {
        await fetchAPI(`${API_BASE}/tasks/${taskId}/comments`, 'POST', {
            authorId: workerId,
            content: input.value.trim()
        });
        input.value = '';
        if (typeof openTaskDetail === 'function') openTaskDetail(taskId);
    } catch (e) {
        if (typeof showToast === 'function') showToast('Lỗi gửi: ' + e.message, 'error');
    }
}


// ─────────── HOOK: Inject checklist & comments into Worker Task Detail ───────────
const _origOpenTaskDetail = window.openTaskDetail;
if (typeof _origOpenTaskDetail === 'function') {
    window.openTaskDetail = async function (taskId) {
        // Call original
        _origOpenTaskDetail(taskId);

        // Wait for DOM, then inject
        await new Promise(r => setTimeout(r, 300));

        // Try to find the task detail container (varies by worker_dashboard.html)
        const detailModal = document.querySelector('[id*="task-detail"]') || document.querySelector('.task-detail-modal');
        if (!detailModal) return;

        // Check if already injected
        if (detailModal.querySelector('#worker-upgrade-sections-' + taskId)) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'worker-upgrade-sections-' + taskId;
        wrapper.style.marginTop = '8px';

        const [checklistHtml, commentsHtml] = await Promise.all([
            renderWorkerChecklistSection(taskId),
            renderWorkerCommentsSection(taskId)
        ]);

        wrapper.innerHTML = checklistHtml + commentsHtml;

        if (wrapper.innerHTML.trim()) {
            // Find content area
            const contentArea = detailModal.querySelector('.modal-body, .space-y-5, .task-detail-content') || detailModal;
            contentArea.appendChild(wrapper);
        }
    };
}


console.log('✅ worker-upgrade.js loaded — Start-before-Complete, Pause/Resume, Checklist, Comments');
