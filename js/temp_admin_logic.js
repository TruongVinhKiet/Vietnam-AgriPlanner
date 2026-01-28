
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
