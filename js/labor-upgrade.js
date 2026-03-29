/**
 * labor-upgrade.js
 * Enhances the owner labor management page with:
 * - 4-color Gantt chart (orange/blue/green/red/grey)
 * - Checklist (sub-tasks) in task creation & detail
 * - Task Comments (chat) in detail view
 * - Epic (Season) dropdown filter + task creation
 * - Pause/Resume status support
 * 
 * Loaded AFTER labor.js to override key functions.
 */

// ─────────── EPIC STATE ───────────
let _epicsCache = [];
let _currentEpicFilter = null; // null = all

async function loadEpicsForFarm() {
    try {
        const farmId = typeof myFarmId !== 'undefined' ? myFarmId : 1;
        const res = await fetchAPI(`${LABOR_API_BASE}/tasks/epics/farm/${farmId}`);
        _epicsCache = Array.isArray(res) ? res : [];
    } catch (e) {
        console.warn('Could not load epics:', e);
        _epicsCache = [];
    }
}

// ─────────── CHECKLIST DYNAMIC INPUT ───────────
let _checklistItems = [];
let _checklistCounter = 0;

function addChecklistItem() {
    _checklistCounter++;
    const id = `cl-item-${_checklistCounter}`;
    _checklistItems.push({ id, text: '' });
    renderChecklistInputs();
}

function removeChecklistItem(itemId) {
    _checklistItems = _checklistItems.filter(i => i.id !== itemId);
    renderChecklistInputs();
}

function renderChecklistInputs() {
    const container = document.getElementById('checklist-inputs-container');
    if (!container) return;

    if (_checklistItems.length === 0) {
        container.innerHTML = '<p style="color:#9ca3af; font-size:13px; text-align:center; padding:8px;">Chưa có mục kiểm tra nào</p>';
        return;
    }

    container.innerHTML = _checklistItems.map((item, idx) => `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; animation:fadeIn 0.2s ease;" id="row-${item.id}">
            <span style="color:#9ca3af; font-size:13px; min-width:20px;">${idx + 1}.</span>
            <input type="text" class="modal-input" style="flex:1; margin:0; padding:6px 10px; font-size:13px;"
                   placeholder="Mô tả bước kiểm tra..."
                   value="${escapeHtml(item.text)}"
                   oninput="_checklistItems.find(i=>i.id==='${item.id}').text=this.value">
            <button type="button" onclick="removeChecklistItem('${item.id}')"
                    style="width:28px; height:28px; border:none; background:#fef2f2; color:#ef4444; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <span class="material-symbols-outlined" style="font-size:16px;">close</span>
            </button>
        </div>
    `).join('');
}

// ─────────── INJECT EPIC + CHECKLIST INTO ASSIGN MODAL ───────────
function injectUpgradeFieldsToAssignModal() {
    const modalBody = document.querySelector('#assign-task-modal .modal-body');
    if (!modalBody || document.getElementById('epic-checklist-section')) return;

    // Find the notes textarea and insert before it
    const notesGroup = modalBody.querySelector('#task-notes')?.closest('.form-group');

    const section = document.createElement('div');
    section.id = 'epic-checklist-section';
    section.innerHTML = `
        <!-- Epic Dropdown -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:12px;">
            <div class="form-group">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                    <span class="material-symbols-outlined" style="font-size:16px; vertical-align:middle; color:#0369a1;">event_note</span>
                    Mùa vụ (tùy chọn)
                </label>
                <div style="display:flex; gap:8px; align-items:center;">
                    <select id="task-epic" class="modal-input" style="flex:1; margin:0; padding:10px 14px; font-size:14px; border-radius:8px; border:1px solid #d1d5db; outline:none; height:42px;">
                        <option value="">-- Không thuộc mùa vụ --</option>
                    </select>
                    <button type="button" onclick="openQuickEpicCreate()" title="Tạo mùa vụ mới"
                            style="width:42px; height:42px; border:1px solid #d1d5db; background:#f9fafb; color:#10B981; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <span class="material-symbols-outlined" style="font-size:20px;">add</span>
                    </button>
                </div>
            </div>
            <div class="form-group" style="display:flex; flex-direction:column; justify-content:flex-end;">
                <label class="block text-xs text-gray-600 mb-1" style="font-size:11px; color:#9ca3af;">
                    Ngày bắt đầu tự động = lúc giao việc<br>
                    Hạn mặc định = +2 giờ nếu chưa nhập
                </label>
            </div>
        </div>

        <!-- Checklist Section -->
        <div style="margin-top:12px; padding:12px; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <label style="font-size:13px; font-weight:600; color:#374151; display:flex; align-items:center; gap:4px;">
                    <span class="material-symbols-outlined" style="font-size:16px; color:#16a34a;">checklist</span>
                    Danh sách kiểm tra (Sub-tasks)
                </label>
                <button type="button" onclick="addChecklistItem()"
                        style="padding:4px 10px; font-size:12px; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; border-radius:6px; cursor:pointer; font-weight:600; display:flex; align-items:center; gap:4px;">
                    <span class="material-symbols-outlined" style="font-size:14px;">add</span> Thêm mục
                </button>
            </div>
            <div id="checklist-inputs-container">
                <p style="color:#9ca3af; font-size:13px; text-align:center; padding:8px;">Chưa có mục kiểm tra nào</p>
            </div>
        </div>
    `;

    if (notesGroup) {
        notesGroup.before(section);
    } else {
        modalBody.appendChild(section);
    }

    // Populate epic dropdown
    populateEpicDropdown();
}

async function populateEpicDropdown() {
    await loadEpicsForFarm();
    const select = document.getElementById('task-epic');
    if (!select) return;
    select.innerHTML = '<option value="">-- Không thuộc mùa vụ --</option>';
    _epicsCache.filter(e => e.status === 'ACTIVE').forEach(epic => {
        select.innerHTML += `<option value="${epic.id}">${escapeHtml(epic.name)}</option>`;
    });
}

async function openQuickEpicCreate() {
    const existing = document.getElementById('epic-create-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'epic-create-overlay';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:999999; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; padding:20px; animation:fadeInUpgrade 0.2s ease;';

    overlay.innerHTML = `
        <div style="background:white; border-radius:12px; max-width:400px; width:100%; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); overflow:hidden; animation:slideUpUpgrade 0.3s ease;">
            <div style="padding:16px 20px; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="font-size:16px; font-weight:700; color:#111827; margin:0;">Tạo mùa vụ mới</h3>
                <button onclick="document.getElementById('epic-create-overlay').remove()" style="background:none; border:none; color:#9ca3af; cursor:pointer; padding:4px;">
                    <span class="material-symbols-outlined" style="font-size:20px;">close</span>
                </button>
            </div>
            <div style="padding:20px;">
                <label style="display:block; font-size:13px; font-weight:600; color:#374151; margin-bottom:8px;">Tên mùa vụ</label>
                <input type="text" id="epic-create-input" class="modal-input" style="width:100%; margin:0; padding:10px 14px; font-size:14px; border-radius:8px; border:1px solid #d1d5db; outline:none;" placeholder="VD: Vụ Xuân Hè 2026...">
            </div>
            <div style="padding:16px 20px; background:#f9fafb; display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #e5e7eb;">
                <button onclick="document.getElementById('epic-create-overlay').remove()" style="padding:8px 16px; border:1px solid #d1d5db; background:white; color:#374151; border-radius:8px; cursor:pointer; font-weight:500; font-size:13px;">Hủy</button>
                <button id="epic-create-submit" style="padding:8px 16px; border:none; background:#10B981; color:white; border-radius:8px; cursor:pointer; font-weight:600; font-size:13px; display:flex; align-items:center; gap:6px;">
                    <span class="material-symbols-outlined" style="font-size:16px;">save</span> Lưu mùa vụ
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const input = document.getElementById('epic-create-input');
    input.focus();

    document.getElementById('epic-create-submit').onclick = async () => {
        const name = input.value;
        if (!name || !name.trim()) return;

        try {
            document.getElementById('epic-create-submit').disabled = true;
            document.getElementById('epic-create-submit').innerText = 'Đang lưu...';
            const farmId = typeof myFarmId !== 'undefined' ? myFarmId : 1;
            await fetchAPI(`${LABOR_API_BASE}/tasks/epics`, 'POST', {
                farmId: farmId,
                name: name.trim()
            });
            if (typeof agriAlert === 'function') agriAlert('Đã tạo mùa vụ: ' + name.trim(), 'success');
            await populateEpicDropdown();
            overlay.remove();
        } catch (e) {
            if (typeof agriAlert === 'function') agriAlert('Lỗi tạo mùa vụ: ' + e.message, 'error');
            document.getElementById('epic-create-submit').disabled = false;
            document.getElementById('epic-create-submit').innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">save</span> Lưu mùa vụ';
        }
    };
}

// ─────────── OVERRIDE: openAssignTaskModal ───────────
const _originalOpenAssignTaskModal = typeof openAssignTaskModal === 'function' ? openAssignTaskModal : null;
window.openAssignTaskModal = function () {
    if (_originalOpenAssignTaskModal) _originalOpenAssignTaskModal();
    else {
        const modal = document.getElementById('assign-task-modal');
        if (modal) modal.style.display = 'flex';
    }

    // Reset checklist state
    _checklistItems = [];
    _checklistCounter = 0;

    // Inject upgrade fields if not already
    setTimeout(() => {
        injectUpgradeFieldsToAssignModal();
    }, 100);
};

// ─────────── OVERRIDE: submitAssignTask ───────────
const _originalSubmitAssignTask = window.submitAssignTask;
window.submitAssignTask = async function (e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerText = 'Đang xử lý...';

    const ownerId = await getCurrentUserId();
    if (!myFarmId) {
        try {
            const farms = await fetchAPI(`${LABOR_API_BASE}/farms/my-farms`);
            if (farms && farms.length > 0) myFarmId = farms[0].id;
        } catch (ex) { }
    }

    const workerId = document.getElementById('task-worker').value;
    if (!workerId) {
        agriAlert("Vui lòng chọn người thực hiện!", 'warning');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-symbols-outlined">check</span> Giao việc';
        return;
    }

    const locationValue = document.getElementById('task-target-location').value;
    let fieldId = null, penId = null;
    if (locationValue) {
        const [type, id] = locationValue.split(':');
        if (type === 'FIELD') fieldId = parseInt(id);
        if (type === 'PEN') penId = parseInt(id);
    }

    const rawDesc = document.getElementById('task-desc').value || '';
    const notesEl = document.getElementById('task-notes');
    const notes = notesEl ? notesEl.value.trim() : '';
    const fullDescription = notes ? (rawDesc ? rawDesc + '\n\n📝 Ghi chú: ' + notes : '📝 Ghi chú: ' + notes) : rawDesc;

    // Get epic
    const epicSelect = document.getElementById('task-epic');
    const epicId = epicSelect && epicSelect.value ? parseInt(epicSelect.value) : null;

    // Get checklist items
    const checklistItems = _checklistItems
        .map(i => i.text.trim())
        .filter(t => t.length > 0);

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
        penId: penId,
        epicId: epicId,
        checklistItems: checklistItems
    };

    try {
        await fetchAPI(`${LABOR_API_BASE}/tasks`, 'POST', payload);
        agriAlert("Giao việc thành công!", 'success');
        closeAssignTaskModal();
        loadTasks();
        e.target.reset();
        // Reset checklist
        _checklistItems = [];
        _checklistCounter = 0;
    } catch (error) {
        agriAlert("Lỗi: " + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-symbols-outlined">check</span> Giao việc';
    }
};


window.renderGanttChart = function (tasks, container) {
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:2rem; color:#6b7280;">Không có công việc nào để hiển thị biểu đồ.</p>';
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Default currentGanttMode if not set
    if (typeof currentGanttMode === 'undefined') window.currentGanttMode = 'DAY';
    // Save tasks for re-rendering when toggling modes
    window.lastLoadedTasks = tasks;

    let timelineStartMs, timelineEndMs, totalDurationMs;
    const cols = [];

    const nowMs = Date.now();

    if (currentGanttMode === 'DAY') {
        const sd = new Date(today);
        sd.setDate(today.getDate() - 2);
        timelineStartMs = sd.getTime();
        timelineEndMs = timelineStartMs + (14 * 24 * 60 * 60 * 1000) - 1;
        totalDurationMs = 14 * 24 * 60 * 60 * 1000;
        for (let i = 0; i < 14; i++) {
            const d = new Date(sd);
            d.setDate(sd.getDate() + i);
            cols.push({ label: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }), isHighlight: d.getTime() === today.getTime() });
        }
    } else if (currentGanttMode === 'HOUR') {
        timelineStartMs = today.getTime();
        timelineEndMs = timelineStartMs + (24 * 60 * 60 * 1000) - 1;
        totalDurationMs = 24 * 60 * 60 * 1000;
        const ch = new Date().getHours();
        for (let i = 0; i < 24; i++) cols.push({ label: i + 'h', isHighlight: i === ch });
    } else if (currentGanttMode === 'MINUTE') {
        // Mode Theo Phút: 6 hour window (From now-2h to now+4h), marked every 30 mins
        timelineStartMs = nowMs - (2 * 60 * 60 * 1000);
        timelineEndMs = nowMs + (4 * 60 * 60 * 1000);
        totalDurationMs = timelineEndMs - timelineStartMs;
        for (let t = timelineStartMs; t < timelineEndMs; t += 30 * 60 * 1000) {
            const d = new Date(t);
            const label = d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
            const isHighlight = (nowMs >= t && nowMs < t + 1800000); // the current 30-min block
            cols.push({ label, isHighlight });
        }
    }

    const legendHtml = `<div style="display:flex; gap:16px; flex-wrap:wrap; padding:8px 16px; font-size:12px; color:#6b7280; border-bottom:1px solid #f1f5f9;">
        <div style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;border-radius:3px;background:#f59e0b;"></span> Chờ xử lý</div>
        <div style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;border-radius:3px;background:#3b82f6;"></span> Đang thực hiện</div>
        <div style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;border-radius:3px;background:#16a34a;"></span> Hoàn thành</div>
        <div style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;border-radius:3px;background:#ef4444;"></span> Trễ hạn</div>
        <div style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;border-radius:3px;background:#94a3b8;"></span> Tạm dừng</div>
        <div style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:50%;background:white;border:2px solid #111827;"></span> Mốc T.Gian</div>
    </div>`;

    let html = '<div class="gantt-container">';
    html += `<div style="padding:10px 16px; border-bottom:1px solid #e2e8f0; display:flex; gap:8px;">
        <button onclick="currentGanttMode='DAY'; renderGanttChart(window.lastLoadedTasks, document.getElementById('tasks-gantt-view'))" style="padding:6px 12px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; background:${currentGanttMode === 'DAY' ? '#3b82f6' : '#f1f5f9'}; color:${currentGanttMode === 'DAY' ? 'white' : '#475569'}; border:none;">Theo Ngày</button>
        <button onclick="currentGanttMode='HOUR'; renderGanttChart(window.lastLoadedTasks, document.getElementById('tasks-gantt-view'))" style="padding:6px 12px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; background:${currentGanttMode === 'HOUR' ? '#3b82f6' : '#f1f5f9'}; color:${currentGanttMode === 'HOUR' ? 'white' : '#475569'}; border:none;">Theo Giờ (Hôm nay)</button>
        <button onclick="currentGanttMode='MINUTE'; renderGanttChart(window.lastLoadedTasks, document.getElementById('tasks-gantt-view'))" style="padding:6px 12px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; background:${currentGanttMode === 'MINUTE' ? '#3b82f6' : '#f1f5f9'}; color:${currentGanttMode === 'MINUTE' ? 'white' : '#475569'}; border:none;">Theo Phút</button>
    </div>`;
    html += legendHtml;

    html += '<div class="gantt-header">';
    html += '<div class="gantt-task-name" style="border-bottom:none;">Tên công việc</div>';
    html += '<div style="display:flex; flex:1; position:relative;">';
    cols.forEach(c => { html += `<div class="gantt-header-cell ${c.isHighlight ? 'today' : ''}" style="${currentGanttMode === 'MINUTE' ? 'min-width:60px;flex:1;' : ''}">${c.label}</div>`; });

    html += '</div></div>';

    const sorted = [...tasks].sort((a, b) => {
        return new Date(a.startDate || a.createdAt || 0).getTime() - new Date(b.startDate || b.createdAt || 0).getTime();
    });

    sorted.forEach(task => {
        const taskCreatedMs = new Date(task.startDate || task.createdAt || Date.now()).getTime();
        const taskDueDateMs = task.dueDate ? new Date(task.dueDate).getTime() : null;
        const taskCompletedAtMs = task.completedAt ? new Date(task.completedAt).getTime() : null;

        let segments = [];
        let t = taskCreatedMs;

        // Render segments from backend TaskWorkLog
        if (task.workLogs && task.workLogs.length > 0) {
            const firstLogStart = new Date(task.workLogs[0].startedAt).getTime();
            if (firstLogStart > t) {
                segments.push({ start: t, end: firstLogStart, type: 'PENDING' });
            }
            task.workLogs.forEach(log => {
                const ls = new Date(log.startedAt).getTime();
                const le = log.endedAt ? new Date(log.endedAt).getTime() : nowMs;
                if (le > ls) segments.push({ start: ls, end: le, type: log.status });
            });
            t = segments.length > 0 ? segments[segments.length - 1].end : t;
        } else {
            let endMs = nowMs;
            if (task.completedAt && task.status !== 'PENDING') endMs = taskCompletedAtMs;
            segments.push({ start: taskCreatedMs, end: endMs, type: task.status === 'PENDING' ? 'PENDING' : task.status });
            t = endMs;
        }

        // Fill green if finished EARLY before due date
        if (taskCompletedAtMs) {
            if (taskDueDateMs && taskDueDateMs > taskCompletedAtMs) {
                segments.push({ start: taskCompletedAtMs, end: taskDueDateMs, type: 'COMPLETED' });
            }
        }

        // Apply Overdue logic for any segment piece strictly AFTER dueDate
        let finalSegments = [];
        segments.forEach(seg => {
            if (seg.type === 'COMPLETED' || seg.type === 'APPROVED') {
                finalSegments.push(seg);
                return;
            }

            if (taskDueDateMs) {
                if (seg.start < taskDueDateMs && seg.end > taskDueDateMs) {
                    finalSegments.push({ start: seg.start, end: taskDueDateMs, type: seg.type });
                    finalSegments.push({ start: taskDueDateMs, end: seg.end, type: 'OVERDUE' });
                } else if (seg.start >= taskDueDateMs) {
                    finalSegments.push({ start: seg.start, end: seg.end, type: 'OVERDUE' });
                } else {
                    finalSegments.push(seg);
                }
            } else {
                finalSegments.push(seg);
            }
        });

        const st = task.status ? String(task.status).toUpperCase() : 'PENDING';
        const isOverdueOverall = taskDueDateMs && !taskCompletedAtMs && nowMs > taskDueDateMs;
        const dotMap = { 'COMPLETED': '#16a34a', 'APPROVED': '#16a34a', 'IN_PROGRESS': '#3b82f6', 'PAUSED': '#94a3b8', 'CANCELLED': '#d1d5db' };
        const circleColor = dotMap[st] || (isOverdueOverall ? '#ef4444' : '#f59e0b');

        const epicTag = task.epic ? `<span style="font-size:10px;background:#f0f9ff;color:#0369a1;padding:1px 6px;border-radius:4px;margin-left:4px;font-weight:500;">${escapeHtml(task.epic.name)}</span>` : '';
        let clBadge = '';
        if (task.checklists && task.checklists.length > 0) {
            const done = task.checklists.filter(c => c.isCompleted || c.completed).length;
            const total = task.checklists.length;
            clBadge = `<span style="font-size:10px;background:${done === total ? '#f0fdf4' : '#fefce8'};color:${done === total ? '#16a34a' : '#b45309'};padding:1px 6px;border-radius:4px;margin-left:2px;font-weight:600;">✓${done}/${total}</span>`;
        }

        html += `<div class="gantt-row">`;
        html += `<div class="gantt-task-name">
                    <div style="width:8px;height:8px;flex-shrink:0;border-radius:50%;background:${circleColor};"></div>
                    <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(task.name)}">${escapeHtml(task.name)}</span>
                    ${epicTag}${clBadge}
                 </div>`;
        html += `<div class="gantt-grid" style="position:relative; overflow:hidden; cursor:pointer;" onclick="openOwnerTaskDetail(${task.id})" title="${escapeHtml(task.name)}\nBấm để xem chi tiết!">`;
        cols.forEach(c => { html += `<div class="gantt-grid-cell ${c.isHighlight ? 'today-col' : ''}" style="${currentGanttMode === 'MINUTE' ? 'min-width:60px;flex:1;' : ''}"></div>`; });

        // Draw bars
        let hasRenderedText = false;
        finalSegments.forEach(seg => {
            if (seg.end < timelineStartMs || seg.start > timelineEndMs) return;
            const drawStart = Math.max(seg.start, timelineStartMs);
            const drawEnd = Math.min(seg.end, timelineEndMs);
            const leftPct = ((drawStart - timelineStartMs) / totalDurationMs) * 100;
            const widthPct = Math.max(((drawEnd - drawStart) / totalDurationMs) * 100, 0.4);

            let color = '#f59e0b';
            if (seg.type === 'IN_PROGRESS') color = '#3b82f6';
            else if (seg.type === 'PAUSED') color = '#94a3b8';
            else if (seg.type === 'COMPLETED' || seg.type === 'APPROVED') color = '#22c55e';
            else if (seg.type === 'OVERDUE') color = '#ef4444';

            html += `<div style="position:absolute; height:24px; top:12px; left:${leftPct}%; width:${widthPct}%; background:${color}; box-shadow:0 1px 3px rgba(0,0,0,0.15); border-radius:3px;">`;
            if (!hasRenderedText && widthPct > 5) {
                html += `<div style="padding-left:8px; padding-top:4px; font-size:11px; color:white; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; font-weight:600;">${escapeHtml(task.name)}</div>`;
                hasRenderedText = true;
            }
            html += `</div>`;

            // Render points
            html += `<div style="position:absolute; top:24px; left:${leftPct}%; width:8px; height:8px; background:white; border:2px solid ${color}; border-radius:50%; transform:translate(-50%, -50%); z-index:10; box-shadow:0 1px 2px rgba(0,0,0,0.2);" title="Mốc: ${new Date(drawStart).toLocaleTimeString('vi-VN')}"></div>`;
        });

        if (finalSegments.length > 0) {
            const lastSeg = finalSegments[finalSegments.length - 1];
            if (lastSeg.end >= timelineStartMs && lastSeg.end <= timelineEndMs && lastSeg.end < nowMs) {
                const endPct = ((lastSeg.end - timelineStartMs) / totalDurationMs) * 100;
                let color = '#ef4444';
                if (lastSeg.type === 'COMPLETED' || lastSeg.type === 'APPROVED') color = '#22c55e';
                else if (lastSeg.type === 'PAUSED') color = '#94a3b8';
                else if (lastSeg.type === 'IN_PROGRESS') color = '#3b82f6';
                html += `<div style="position:absolute; top:24px; left:${endPct}%; width:8px; height:8px; background:white; border:2px solid ${color}; border-radius:50%; transform:translate(-50%, -50%); z-index:10; box-shadow:0 1px 2px rgba(0,0,0,0.2);" title="Kết thúc/Cập nhật: ${new Date(lastSeg.end).toLocaleTimeString('vi-VN')}"></div>`;
            }
        }

        html += `</div></div>`;
    });

    html += '</div>';
    container.innerHTML = html;
};


// ─────────── TASK DETAIL: CHECKLIST & COMMENTS SECTION ───────────

async function renderChecklistSection(taskId) {
    try {
        const items = await fetchAPI(`${LABOR_API_BASE}/tasks/${taskId}/checklists`);
        if (!items || items.length === 0) return '';

        const done = items.filter(i => i.isCompleted || i.completed).length;
        const total = items.length;
        const pct = Math.round((done / total) * 100);

        let html = `<div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:6px;">
                    <span class="material-symbols-outlined" style="font-size:18px; color:#16a34a;">checklist</span>
                    Danh sách kiểm tra
                </div>
                <span style="font-size:12px; font-weight:700; color:${done === total ? '#16a34a' : '#b45309'};">${done}/${total} (${pct}%)</span>
            </div>
            <div style="height:4px; background:#f3f4f6; border-radius:99px; margin-bottom:12px; overflow:hidden;">
                <div style="height:100%; width:${pct}%; background:${done === total ? '#16a34a' : '#3b82f6'}; border-radius:99px; transition:width 0.3s;"></div>
            </div>`;

        items.forEach(item => {
            const checked = item.isCompleted || item.completed;
            html += `<div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #f3f4f6;">
                <div style="width:20px; height:20px; border-radius:6px; border:2px solid ${checked ? '#16a34a' : '#d1d5db'}; background:${checked ? '#16a34a' : 'white'}; display:flex; align-items:center; justify-content:center; flex-shrink:0; cursor:pointer;"
                     onclick="toggleChecklistOwner(${item.id}, ${taskId})">
                    ${checked ? '<span class="material-symbols-outlined" style="font-size:14px; color:white;">check</span>' : ''}
                </div>
                <span style="font-size:14px; color:${checked ? '#9ca3af' : '#374151'}; ${checked ? 'text-decoration:line-through;' : ''}">${escapeHtml(item.description)}</span>
            </div>`;
        });

        html += `</div>`;
        return html;
    } catch (e) {
        console.warn('Checklist load error:', e);
        return '';
    }
}

async function toggleChecklistOwner(checklistId, taskId) {
    try {
        await fetchAPI(`${LABOR_API_BASE}/tasks/checklists/${checklistId}`, 'PUT');
        // Refresh the task detail
        if (typeof openOwnerTaskDetail === 'function') openOwnerTaskDetail(taskId);
    } catch (e) {
        agriAlert('Lỗi cập nhật: ' + e.message, 'error');
    }
}

async function renderCommentsSection(taskId) {
    try {
        const comments = await fetchAPI(`${LABOR_API_BASE}/tasks/${taskId}/comments`);
        if (!comments) return '';

        let html = `<div style="background:white; border-radius:12px; border:1px solid #e5e7eb; padding:16px; margin-bottom:12px;">
            <div style="font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                <span class="material-symbols-outlined" style="font-size:18px; color:#3b82f6;">chat</span>
                Thảo luận (${comments.length})
            </div>`;

        if (comments.length > 0) {
            html += '<div style="max-height:180px; overflow-y:auto; margin-bottom:12px; display:flex; flex-direction:column; gap:8px; padding-right:4px;">';
            comments.forEach(c => {
                const authorName = c.author ? (c.author.fullName || c.author.email || 'Ẩn danh') : 'Ẩn danh';
                const time = c.createdAt ? new Date(c.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';
                const isOwner = c.author && c.author.role === 'OWNER';
                html += `<div style="display:flex; gap:8px; ${isOwner ? 'flex-direction:row-reverse;' : ''}">
                    <div style="width:28px; height:28px; border-radius:50%; background:${isOwner ? '#dbeafe' : '#f3f4f6'}; color:${isOwner ? '#2563eb' : '#6b7280'}; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; flex-shrink:0;">${authorName.charAt(0).toUpperCase()}</div>
                    <div style="max-width:70%; padding:8px 12px; border-radius:12px; background:${isOwner ? '#eff6ff' : '#f3f4f6'}; ${isOwner ? 'border-bottom-right-radius:4px;' : 'border-bottom-left-radius:4px;'}">
                        <div style="font-size:11px; font-weight:600; color:${isOwner ? '#2563eb' : '#6b7280'}; margin-bottom:2px;">${escapeHtml(authorName)}</div>
                        <div style="font-size:13px; color:#374151; white-space:pre-wrap;">${escapeHtml(c.content)}</div>
                        <div style="font-size:10px; color:#9ca3af; margin-top:4px; text-align:right;">${time}</div>
                    </div>
                </div>`;
            });
            html += '</div>';
        } else {
            html += '<p style="color:#9ca3af; font-size:13px; text-align:center; padding:12px;">Chưa có tin nhắn nào</p>';
        }

        // Chat input
        html += `<div style="display:flex; gap:8px; align-items:flex-end; border-top:1px solid #f3f4f6; padding-top:12px;">
            <textarea id="comment-input-${taskId}" class="modal-input" rows="1" style="flex:1; margin:0; padding:8px 12px; font-size:13px; resize:none; border-radius:12px;" placeholder="Nhập tin nhắn..."></textarea>
            <button onclick="sendTaskComment(${taskId})" style="width:36px; height:36px; border:none; background:#3b82f6; color:white; border-radius:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <span class="material-symbols-outlined" style="font-size:18px;">send</span>
            </button>
        </div>`;

        html += `</div>`;
        return html;
    } catch (e) {
        console.warn('Comments load error:', e);
        return '';
    }
}

async function sendTaskComment(taskId) {
    const input = document.getElementById(`comment-input-${taskId}`);
    if (!input || !input.value.trim()) return;

    try {
        const authorId = await getCurrentUserId();
        await fetchAPI(`${LABOR_API_BASE}/tasks/${taskId}/comments`, 'POST', {
            authorId: authorId,
            content: input.value.trim()
        });
        input.value = '';
        if (typeof openOwnerTaskDetail === 'function') openOwnerTaskDetail(taskId);
    } catch (e) {
        agriAlert('Lỗi gửi: ' + e.message, 'error');
    }
}


// ─────────── HOOK: Inject checklist & comments into Owner Task Detail ───────────
// This hooks into the existing openOwnerTaskDetail to add sections
const _origOpenOwnerTaskDetail = window.openOwnerTaskDetail;

if (typeof _origOpenOwnerTaskDetail === 'function') {
    window.openOwnerTaskDetail = async function (taskId) {
        // Call original
        _origOpenOwnerTaskDetail(taskId);

        // Wait for DOM update, then inject new sections
        await new Promise(r => setTimeout(r, 200));

        const detailContainer = document.getElementById('task-detail-container');
        if (!detailContainer) return;

        // Check if sections already injected
        if (detailContainer.querySelector('#upgrade-sections-' + taskId)) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'upgrade-sections-' + taskId;

        const [checklistHtml, commentsHtml] = await Promise.all([
            renderChecklistSection(taskId),
            renderCommentsSection(taskId)
        ]);

        wrapper.innerHTML = checklistHtml + commentsHtml;

        // Insert inside the centered 900px wrapper
        if (wrapper.innerHTML.trim()) {
            const innerWrapper = detailContainer.querySelector('div[style*="max-width:900px"]') || detailContainer.firstElementChild || detailContainer;
            innerWrapper.appendChild(wrapper);
        }
    };
}

// ─────────── INIT ───────────
document.addEventListener('DOMContentLoaded', () => {
    const page = document?.body?.dataset?.page;
    if (page !== 'labor') return;
    // Pre-load epics
    setTimeout(() => loadEpicsForFarm(), 500);
});

console.log('✅ labor-upgrade.js loaded — Checklist, Comments, Epic, Enhanced Gantt');

// ═══════════════════════════════════════════════════════════════
//  STATISTICS TAB — Epic Progress, Workload, Leaderboard
// ═══════════════════════════════════════════════════════════════

let _epicChartInstance = null;
let _workloadChartInstance = null;
let _currentEpicChartType = 'bar'; // 'bar' or 'line'
let _currentLeaderboardView = 'top5'; // 'top5' or 'all'

const OVERLOAD_THRESHOLD = 5;

const RANK_CONFIG = {
    TRAINEE:  { label: 'Tân binh',    color: '#d4a76a', bg: 'linear-gradient(135deg, #fef3c7, #fde68a)', icon: '🌱', next: 100 },
    SKILLED:  { label: 'Thạo việc',   color: '#94a3b8', bg: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)', icon: '🥈', next: 500 },
    VETERAN:  { label: 'Lão nông',    color: '#eab308', bg: 'linear-gradient(135deg, #fefce8, #fef08a)', icon: '🥇', next: 2000 },
    MASTER:   { label: 'Bậc thầy',   color: '#06b6d4', bg: 'linear-gradient(135deg, #ecfeff, #a5f3fc)', icon: '💎', next: 10000 },
};

function getRankInfo(rankLevel) {
    return RANK_CONFIG[rankLevel] || RANK_CONFIG.TRAINEE;
}

// ─────── MAIN ENTRY POINT ───────

async function renderStatisticsTab() {
    // Ensure tasks & workers are loaded
    if (!ownerTasksById || Object.keys(ownerTasksById).length === 0) {
        if (typeof loadTasks === 'function') await loadTasks();
    }
    if (!Array.isArray(approvedWorkers) || approvedWorkers.length === 0) {
        if (typeof loadApprovedWorkers === 'function') await loadApprovedWorkers();
    }

    const tasks = ownerTasksById ? Object.values(ownerTasksById) : [];

    // Summary cards
    const activeTasks = tasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'PENDING' || t.status === 'PAUSED');
    const workerTaskCounts = {};
    tasks.forEach(t => {
        if (t.status === 'COMPLETED' || t.status === 'APPROVED' || t.status === 'CANCELLED') return;
        const wId = t.worker?.id || t.workerId;
        if (!wId) return;
        workerTaskCounts[wId] = (workerTaskCounts[wId] || 0) + 1;
    });
    const overloadedCount = Object.values(workerTaskCounts).filter(c => c > OVERLOAD_THRESHOLD).length;

    // Animate summary cards
    animateCounter('stats-total-workers', approvedWorkers.length);
    animateCounter('stats-active-tasks', activeTasks.length);
    animateCounter('stats-overloaded', overloadedCount);

    // Render charts & leaderboard
    renderEpicProgressChart(tasks, _currentEpicChartType);
    renderWorkloadChart(tasks);
    renderLeaderboard(_currentLeaderboardView);

    // GSAP entrance animation
    if (typeof gsap !== 'undefined') {
        gsap.fromTo('#stats-summary-cards > .card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1, duration: 0.5, ease: 'power2.out' });
        gsap.fromTo('#statistics-tab .card', { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, duration: 0.6, ease: 'power2.out', delay: 0.2 });
    }
}

function animateCounter(elementId, targetValue) {
    const el = document.getElementById(elementId);
    if (!el) return;
    let current = 0;
    const step = Math.max(1, Math.ceil(targetValue / 30));
    const interval = setInterval(() => {
        current = Math.min(current + step, targetValue);
        el.textContent = current;
        if (current >= targetValue) clearInterval(interval);
    }, 30);
}

// ─────── EPIC PROGRESS CHART ───────

function switchEpicChartType(type) {
    _currentEpicChartType = type;
    // Toggle button styles
    const barBtn = document.getElementById('epic-chart-bar-btn');
    const lineBtn = document.getElementById('epic-chart-line-btn');
    if (barBtn && lineBtn) {
        barBtn.style.background = type === 'bar' ? '#10b981' : 'transparent';
        barBtn.style.color = type === 'bar' ? 'white' : '#6b7280';
        lineBtn.style.background = type === 'line' ? '#10b981' : 'transparent';
        lineBtn.style.color = type === 'line' ? 'white' : '#6b7280';
    }
    const tasks = ownerTasksById ? Object.values(ownerTasksById) : [];
    renderEpicProgressChart(tasks, type);
}

function renderEpicProgressChart(tasks, chartType) {
    const canvas = document.getElementById('epic-progress-chart');
    const emptyState = document.getElementById('epic-empty-state');
    if (!canvas) return;

    // Group tasks by epic
    const epicMap = {};
    tasks.forEach(t => {
        const epicId = t.epic?.id;
        const epicName = t.epic?.name;
        if (!epicId) return;
        if (!epicMap[epicId]) epicMap[epicId] = { name: epicName || `Mùa vụ #${epicId}`, total: 0, completed: 0, tasks: [] };
        epicMap[epicId].total++;
        if (t.status === 'COMPLETED' || t.status === 'APPROVED') epicMap[epicId].completed++;
        epicMap[epicId].tasks.push(t);
    });

    const epics = Object.values(epicMap);

    if (epics.length === 0) {
        canvas.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    canvas.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    if (_epicChartInstance) {
        _epicChartInstance.destroy();
        _epicChartInstance = null;
    }

    const labels = epics.map(e => e.name);

    if (chartType === 'bar') {
        const completedData = epics.map(e => e.completed);
        const remainingData = epics.map(e => e.total - e.completed);

        _epicChartInstance = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Hoàn thành', data: completedData, backgroundColor: '#10b981', borderRadius: 6 },
                    { label: 'Còn lại', data: remainingData, backgroundColor: '#e5e7eb', borderRadius: 6 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 800, easing: 'easeOutQuart' },
                plugins: { legend: { position: 'top', labels: { font: { family: 'Manrope', weight: '600' }, usePointStyle: true, boxWidth: 8 } } },
                scales: {
                    x: { stacked: true, grid: { display: false }, ticks: { font: { family: 'Manrope', size: 11 } } },
                    y: { stacked: true, beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { font: { family: 'Manrope', size: 11 }, stepSize: 1 } }
                }
            }
        });
    } else {
        // Burn-down style line chart
        const percentData = epics.map(e => e.total > 0 ? Math.round((e.completed / e.total) * 100) : 0);

        _epicChartInstance = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: '% Hoàn thành',
                    data: percentData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    borderWidth: 3
                }, {
                    label: 'Mục tiêu 100%',
                    data: epics.map(() => 100),
                    borderColor: '#ef4444',
                    borderDash: [8, 4],
                    pointRadius: 0,
                    borderWidth: 2,
                    fill: false
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 800, easing: 'easeOutQuart' },
                plugins: { legend: { position: 'top', labels: { font: { family: 'Manrope', weight: '600' }, usePointStyle: true, boxWidth: 8 } } },
                scales: {
                    y: { beginAtZero: true, max: 110, grid: { color: '#f3f4f6' }, ticks: { callback: v => v + '%', font: { family: 'Manrope', size: 11 } } },
                    x: { grid: { display: false }, ticks: { font: { family: 'Manrope', size: 11 } } }
                }
            }
        });
    }
}

// ─────── WORKLOAD CHART ───────

function renderWorkloadChart(tasks) {
    const canvas = document.getElementById('workload-chart');
    const emptyState = document.getElementById('workload-empty-state');
    if (!canvas) return;

    const workerMap = {};
    (approvedWorkers || []).forEach(w => {
        workerMap[w.id] = { name: w.fullName || w.email || `Worker#${w.id}`, pending: 0, inProgress: 0 };
    });

    tasks.forEach(t => {
        const wId = t.worker?.id || t.workerId;
        if (!wId || !workerMap[wId]) return;
        if (t.status === 'PENDING') workerMap[wId].pending++;
        if (t.status === 'IN_PROGRESS' || t.status === 'PAUSED') workerMap[wId].inProgress++;
    });

    const workers = Object.values(workerMap).filter(w => w.pending + w.inProgress > 0);

    if (workers.length === 0) {
        canvas.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    canvas.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    // Sort by total workload descending
    workers.sort((a, b) => (b.pending + b.inProgress) - (a.pending + a.inProgress));

    if (_workloadChartInstance) {
        _workloadChartInstance.destroy();
        _workloadChartInstance = null;
    }

    const labels = workers.map(w => w.name);
    const bgColors = workers.map(w => (w.pending + w.inProgress) > OVERLOAD_THRESHOLD ? '#ef4444' : '#3b82f6');

    _workloadChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Đang làm', data: workers.map(w => w.inProgress), backgroundColor: bgColors.map(c => c === '#ef4444' ? '#ef4444' : '#3b82f6'), borderRadius: 4 },
                { label: 'Chờ xử lý', data: workers.map(w => w.pending), backgroundColor: bgColors.map(c => c === '#ef4444' ? '#fca5a5' : '#93c5fd'), borderRadius: 4 }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 800, easing: 'easeOutQuart' },
            plugins: {
                legend: { position: 'top', labels: { font: { family: 'Manrope', weight: '600' }, usePointStyle: true, boxWidth: 8 } },
                annotation: undefined
            },
            scales: {
                x: { stacked: true, beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { stepSize: 1, font: { family: 'Manrope', size: 11 } } },
                y: { stacked: true, grid: { display: false }, ticks: { font: { family: 'Manrope', size: 12, weight: '600' } } }
            }
        }
    });
}

// ─────── LEADERBOARD ───────

function switchLeaderboardView(view) {
    _currentLeaderboardView = view;
    const top5Btn = document.getElementById('lb-top5-btn');
    const allBtn = document.getElementById('lb-all-btn');
    if (top5Btn && allBtn) {
        top5Btn.style.background = view === 'top5' ? '#10b981' : 'transparent';
        top5Btn.style.color = view === 'top5' ? 'white' : '#6b7280';
        allBtn.style.background = view === 'all' ? '#10b981' : 'transparent';
        allBtn.style.color = view === 'all' ? 'white' : '#6b7280';
    }
    renderLeaderboard(view);
}

function renderLeaderboard(view) {
    const container = document.getElementById('leaderboard-container');
    if (!container) return;

    const workers = [...(approvedWorkers || [])].sort((a, b) => {
        const aExp = a.experiencePoints || 0;
        const bExp = b.experiencePoints || 0;
        return bExp - aExp;
    });

    const displayWorkers = view === 'top5' ? workers.slice(0, 5) : workers;

    if (displayWorkers.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px; color:#9ca3af;">
                <span class="material-symbols-outlined" style="font-size:48px; opacity:0.4;">person_off</span>
                <p style="margin-top:8px;">Chưa có nhân công nào</p>
            </div>`;
        return;
    }

    const medalIcons = ['🥇', '🥈', '🥉'];

    container.innerHTML = displayWorkers.map((w, idx) => {
        const exp = w.experiencePoints || 0;
        const rank = getRankInfo(w.rankLevel || 'TRAINEE');
        const nextExp = rank.next;
        const progressPct = Math.min(100, Math.round((exp / nextExp) * 100));
        const medal = idx < 3 ? medalIcons[idx] : `<span style="font-size:14px; color:#9ca3af; font-weight:700;">${idx + 1}</span>`;

        const avatarHtml = w.avatarUrl
            ? `<img src="${w.avatarUrl}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid ${rank.color};">`
            : `<div style="width:40px; height:40px; border-radius:50%; background:${rank.bg}; display:flex; align-items:center; justify-content:center; font-weight:700; color:${rank.color}; border:2px solid ${rank.color}; font-size:16px;">${(w.fullName || 'W')[0].toUpperCase()}</div>`;

        const isTop3 = idx < 3;
        const cardBg = isTop3 ? rank.bg : 'white';
        const borderColor = isTop3 ? rank.color : '#e5e7eb';

        return `
            <div class="lb-card" style="
                display:flex; align-items:center; gap:14px; padding:14px 18px;
                background:${cardBg}; border:1px solid ${borderColor}; border-radius:12px;
                margin-bottom:8px; transition:all 0.3s ease; opacity:0; transform:translateY(15px);
            "
            onmouseenter="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)'; this.style.transform='translateY(-2px)'"
            onmouseleave="this.style.boxShadow='none'; this.style.transform='translateY(0)'"
            >
                <div style="width:28px; text-align:center; font-size:20px; flex-shrink:0;">${medal}</div>
                ${avatarHtml}
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                        <span style="font-weight:700; color:#111827; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(w.fullName || w.email || 'Nhân công')}</span>
                        <span style="font-size:11px; padding:2px 8px; border-radius:999px; background:rgba(0,0,0,0.06); color:${rank.color}; font-weight:700;">${rank.icon} ${rank.label}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="flex:1; background:#e5e7eb; border-radius:999px; height:6px; overflow:hidden;">
                            <div style="height:100%; border-radius:999px; background:${rank.color}; width:${progressPct}%; transition:width 1s ease;"></div>
                        </div>
                        <span style="font-size:11px; color:#6b7280; font-weight:600; white-space:nowrap;">${exp} EXP</span>
                    </div>
                </div>
            </div>`;
    }).join('');

    // GSAP animate cards appearing
    requestAnimationFrame(() => {
        const cards = container.querySelectorAll('.lb-card');
        if (typeof gsap !== 'undefined') {
            gsap.to(cards, { opacity: 1, y: 0, stagger: 0.07, duration: 0.45, ease: 'power2.out' });
        } else {
            cards.forEach(c => { c.style.opacity = '1'; c.style.transform = 'translateY(0)'; });
        }
    });
}
