/**
 * Worker Jobs Page - JavaScript Logic
 * Handles: job listing, CV management, applications, PDF upload
 */

const API_BASE = window.API_BASE_URL || 'http://localhost:8080/api';
let currentJobTab = 'jobs';
let selectedCvTemplate = 'classic';
let uploadedPdfFile = null;
let savedCvs = [];
let currentApplyGlobalPdfUrl = '';

// ============ HELPERS ============
function getToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
}

function getCurrentUserId() {
    return localStorage.getItem('userId') || sessionStorage.getItem('userId');
}

async function fetchAPI(url, method = 'GET', body = null) {
    const opts = {
        method,
        headers: {
            'Authorization': 'Bearer ' + getToken(),
            'Content-Type': 'application/json'
        }
    };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (!res.ok) {
        let errorMsg = 'Lỗi server';
        try {
            const errData = await res.json();
            errorMsg = errData.error || errData.message || errorMsg;
        } catch (e) { /* ignore */ }
        throw new Error(errorMsg);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function agriAlert(message, type = 'info') {
    const colors = {
        success: { bg: '#10b981', icon: 'check_circle' },
        error: { bg: '#ef4444', icon: 'error' },
        warning: { bg: '#f59e0b', icon: 'warning' },
        info: { bg: '#3b82f6', icon: 'info' }
    };
    const c = colors[type] || colors.info;
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed; top:24px; right:24px; z-index:99999; background:${c.bg}; color:white; padding:14px 20px; border-radius:12px; font-size:14px; font-weight:600; display:flex; align-items:center; gap:8px; box-shadow:0 8px 24px rgba(0,0,0,0.2); animation:slideUp 0.3s ease; max-width:400px;`;
    toast.innerHTML = `<span class="material-symbols-outlined" style="font-size:20px;">${c.icon}</span>${escapeHtml(message)}`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ============ TAB SWITCHING ============
function switchJobTab(tab) {
    currentJobTab = tab;
    document.getElementById('view-jobs').style.display = tab === 'jobs' ? 'block' : 'none';
    document.getElementById('view-myapps').style.display = tab === 'myapps' ? 'block' : 'none';

    const tabJobs = document.getElementById('tab-jobs');
    const tabMyapps = document.getElementById('tab-myapps');

    if (tab === 'jobs') {
        tabJobs.className = 'px-5 py-2 rounded-xl text-sm font-semibold transition-all bg-primary text-white shadow-md';
        tabMyapps.className = 'px-5 py-2 rounded-xl text-sm font-semibold transition-all bg-white text-gray-600 border border-gray-200 hover:bg-gray-50';
    } else {
        tabMyapps.className = 'px-5 py-2 rounded-xl text-sm font-semibold transition-all bg-primary text-white shadow-md';
        tabJobs.className = 'px-5 py-2 rounded-xl text-sm font-semibold transition-all bg-white text-gray-600 border border-gray-200 hover:bg-gray-50';
        loadMyApplications();
    }
}

// ============ LOAD OPEN JOBS ============
async function loadOpenJobs() {
    const container = document.getElementById('jobs-container');

    try {
        let posts = [];
        try {
            posts = await fetchAPI(`${API_BASE}/recruitment/posts/open`) || [];
        } catch (e) {
            // Try alternate endpoint
            try {
                posts = await fetchAPI(`${API_BASE}/recruitment-posts/open`) || [];
            } catch (e2) {
                console.warn('No recruitment posts endpoint found, showing empty state');
            }
        }

        // Filter open posts
        const openPosts = posts.filter(p => !p.status || p.status === 'OPEN');

        if (openPosts.length === 0) {
            container.innerHTML = `
                <div class="text-center py-20 col-span-full">
                    <div style="width:80px; height:80px; margin:0 auto 16px; background:linear-gradient(135deg, #f0fdf4, #dcfce7); border-radius:50%; display:flex; align-items:center; justify-content:center;">
                        <span class="material-symbols-outlined" style="font-size:40px; color:#10b981;">search_off</span>
                    </div>
                    <h3 style="font-size:18px; font-weight:700; color:#111827; margin:0 0 8px;">Chưa có việc làm mới</h3>
                    <p style="font-size:14px; color:#6b7280; max-width:360px; margin:0 auto;">Các nông trại chưa đăng tin tuyển dụng. Hãy quay lại sau hoặc chuẩn bị hồ sơ CV sẵn sàng!</p>
                </div>`;
            return;
        }

        container.innerHTML = openPosts.map((post, index) => {
            const farmName = post.farm ? (post.farm.name || 'Nông trại') : 'Nông trại';
            const title = escapeHtml(post.title || 'Tuyển nhân công');
            const desc = escapeHtml(post.description || '');
            const qty = post.quantityNeeded || '?';
            const salary = post.salaryOffer ? Number(post.salaryOffer).toLocaleString('vi-VN') + ' VNĐ' : 'Thỏa thuận';
            const createdAt = post.createdAt ? new Date(post.createdAt).toLocaleDateString('vi-VN') : '';

            return `
            <div class="job-card bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden fade-in-up" style="animation-delay:${index * 0.08}s;">
                <div style="height:6px; background:linear-gradient(90deg, #10b981, #059669);"></div>
                <div style="padding:22px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
                        <div>
                            <h3 style="margin:0 0 4px; font-size:17px; font-weight:700; color:#111827;">${title}</h3>
                            <div style="display:flex; align-items:center; gap:6px; font-size:13px; color:#6b7280;">
                                <span class="material-symbols-outlined" style="font-size:16px;">agriculture</span>
                                ${escapeHtml(farmName)}
                            </div>
                        </div>
                        <span style="background:#ecfdf5; color:#059669; padding:4px 10px; border-radius:8px; font-size:12px; font-weight:600;">Đang tuyển</span>
                    </div>
                    ${desc ? `<p style="font-size:13px; color:#6b7280; line-height:1.6; margin-bottom:14px; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">${desc}</p>` : ''}
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;">
                        <div style="display:flex; align-items:center; gap:6px; font-size:13px; color:#374151;">
                            <span class="material-symbols-outlined" style="font-size:16px; color:#10b981;">groups</span>
                            <span>Cần: <strong>${qty}</strong> người</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px; font-size:13px; color:#374151;">
                            <span class="material-symbols-outlined" style="font-size:16px; color:#f59e0b;">payments</span>
                            <span>${salary}</span>
                        </div>
                    </div>
                    ${createdAt ? `<div style="font-size:11px; color:#9ca3af; margin-bottom:14px;">Đăng ngày: ${createdAt}</div>` : ''}
                    <button onclick="openApplyModal(${post.id}, '${title.replace(/'/g, "\\'")}')"
                        style="width:100%; padding:11px; border:none; background:linear-gradient(135deg, #10b981, #059669); color:white; border-radius:12px; font-weight:700; font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.2s; box-shadow:0 4px 12px rgba(16,185,129,0.25);"
                        onmouseenter="this.style.transform='scale(1.02)'" onmouseleave="this.style.transform='scale(1)'">
                        <span class="material-symbols-outlined" style="font-size:18px;">send</span>
                        Ứng tuyển ngay
                    </button>
                </div>
            </div>`;
        }).join('');

    } catch (err) {
        console.error('Load jobs error:', err);
        container.innerHTML = `<div class="text-center py-16 col-span-full text-red-500">
            <span class="material-symbols-outlined" style="font-size:48px;">error</span>
            <p class="mt-3">Lỗi tải danh sách việc làm: ${escapeHtml(err.message)}</p>
        </div>`;
    }
}

// ============ APPLY FOR JOB ============
async function openApplyModal(postId, postTitle) {
    let globalUser = null;
    const userId = getCurrentUserId();
    if (userId) {
        try {
            globalUser = await fetchAPI(`${API_BASE}/user/profile`);
            parseSavedCvs(globalUser);

            if (savedCvs.length === 0 && !globalUser.cvPdfUrl) {
                agriAlert('Bạn cần tạo Hồ sơ CV (hoặc tải lên PDF) trước khi ứng tuyển!', 'warning');
                openCvBuilderModal();
                return;
            }
        } catch (e) {
            console.warn('Could not check user CV profile:', e);
            agriAlert('Không thể kiểm tra thông tin hồ sơ. Vui lòng thử lại.', 'error');
            return;
        }
    }

    const modal = document.getElementById('apply-modal');
    modal.style.display = 'flex';
    currentApplyGlobalPdfUrl = globalUser && globalUser.cvPdfUrl ? globalUser.cvPdfUrl : '';

    // Build CV Options
    let cvOptionsHtml = '<option value="">-- Chọn CV đính kèm --</option>';
    savedCvs.forEach((cv, idx) => {
        cvOptionsHtml += `<option value="web_${cv.id}">Hồ sơ Web: ${escapeHtml(cv.cvName || 'CV ' + (idx + 1))}</option>`;
    });
    
    if (globalUser && globalUser.cvPdfUrl) {
        cvOptionsHtml += `<option value="pdf_global">📄 File PDF đã tải lên</option>`;
    }

    modal.innerHTML = `
        <div style="background:white; width:90%; max-width:500px; border-radius:20px; box-shadow:0 25px 60px rgba(0,0,0,0.3); animation:slideUp 0.3s ease; overflow:hidden;">
            <div style="padding:24px; border-bottom:1px solid #e5e7eb; background:linear-gradient(135deg, #ecfdf5, #d1fae5);">
                <h2 style="margin:0; font-size:20px; font-weight:700; color:#065f46;">Ứng tuyển vị trí</h2>
                <p style="margin:4px 0 0; font-size:14px; color:#047857;">${escapeHtml(postTitle)}</p>
            </div>
            <div style="padding:24px;">
                <div style="margin-bottom: 20px;">
                    <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:6px;">Chọn Hồ sơ (CV) gửi đi</label>
                    <select id="apply-cv-select" style="width:100%; padding:12px; border:2px solid #e5e7eb; border-radius:10px; font-size:14px; outline:none;" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='#e5e7eb'">
                        ${cvOptionsHtml}
                    </select>
                </div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:6px;">Lời nhắn cho nhà tuyển dụng</label>
                <textarea id="apply-message" rows="4" placeholder="Giới thiệu ngắn về bản thân và lý do muốn ứng tuyển..."
                    style="width:100%; padding:12px; border:2px solid #e5e7eb; border-radius:10px; font-size:14px; resize:vertical; outline:none;"
                    onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='#e5e7eb'"></textarea>
                <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:20px;">
                    <button onclick="document.getElementById('apply-modal').style.display='none'"
                        style="padding:10px 24px; border-radius:10px; border:1px solid #d1d5db; background:white; color:#374151; font-weight:600; font-size:14px; cursor:pointer;">Hủy</button>
                    <button id="apply-submit-btn" onclick="submitApplication(${postId})"
                        style="padding:10px 24px; border-radius:10px; border:none; background:linear-gradient(135deg, #10b981, #059669); color:white; font-weight:600; font-size:14px; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 4px 12px rgba(16,185,129,0.3);">
                        <span class="material-symbols-outlined" style="font-size:18px;">send</span> Gửi hồ sơ
                    </button>
                </div>
            </div>
        </div>`;
}

async function submitApplication(postId) {
    const btn = document.getElementById('apply-submit-btn');
    const messageText = document.getElementById('apply-message')?.value || '';
    const selectedCvId = document.getElementById('apply-cv-select')?.value;

    if (!selectedCvId) {
        agriAlert('Vui lòng chọn một CV để ứng tuyển', 'warning');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px; animation:spin 1s linear infinite;">sync</span> Đang gửi...';
    }

    let payloadObj = {
        isAdvancedCv: true,
        message: messageText
    };

    if (selectedCvId === 'pdf_global') {
        payloadObj.cvType = 'pdf';
        payloadObj.cvPdfUrl = currentApplyGlobalPdfUrl;
    } else if (selectedCvId.startsWith('web_')) {
        const id = selectedCvId.replace('web_', '');
        const chosenCv = savedCvs.find(c => c.id == id);
        if (!chosenCv) {
            agriAlert('Không tìm thấy CV đã chọn. Vui lòng chọn lại.', 'warning');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">send</span> Gửi hồ sơ';
            }
            return;
        }
        payloadObj.cvType = 'web';
        payloadObj.cvData = chosenCv;
    }

    try {
        const workerId = getCurrentUserId();
        await fetchAPI(`${API_BASE}/recruitment/posts/${postId}/apply?workerId=${workerId}`, 'POST', {
            message: JSON.stringify(payloadObj)
        });
        document.getElementById('apply-modal').style.display = 'none';
        agriAlert('Đã gửi hồ sơ ứng tuyển thành công!', 'success');
        loadOpenJobs(); // Refresh
    } catch (err) {
        agriAlert('Lỗi gửi hồ sơ: ' + err.message, 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">send</span> Gửi hồ sơ';
        }
    }
}

// ============ MY APPLICATIONS ============
async function loadMyApplications() {
    const container = document.getElementById('myapps-container');
    const workerId = getCurrentUserId();
    if (!workerId) {
        container.innerHTML = '<p class="text-center py-16 text-gray-400">Không xác định được người dùng</p>';
        return;
    }

    try {
        let apps = [];
        try {
            apps = await fetchAPI(`${API_BASE}/recruitment/applications/worker/${workerId}`) || [];
        } catch (e) {
            try {
                apps = await fetchAPI(`${API_BASE}/job-applications/worker/${workerId}`) || [];
            } catch (e2) {
                console.warn('No applications endpoint found');
            }
        }

        if (apps.length === 0) {
            container.innerHTML = `
                <div class="text-center py-20 col-span-full">
                    <div style="width:80px; height:80px; margin:0 auto 16px; background:#f1f5f9; border-radius:50%; display:flex; align-items:center; justify-content:center;">
                        <span class="material-symbols-outlined" style="font-size:40px; color:#94a3b8;">folder_open</span>
                    </div>
                    <h3 style="font-size:18px; font-weight:700; color:#111827;">Chưa có đơn ứng tuyển</h3>
                    <p style="font-size:14px; color:#6b7280;">Hãy duyệt danh sách việc làm và gửi hồ sơ!</p>
                </div>`;
            return;
        }

        const statusMap = {
            'PENDING': { label: 'Chờ duyệt', bg: '#fef3c7', color: '#92400e', icon: 'schedule' },
            'ACCEPTED': { label: 'Đã được nhận', bg: '#dcfce7', color: '#166534', icon: 'check_circle' },
            'REJECTED': { label: 'Đã bị từ chối', bg: '#fecaca', color: '#991b1b', icon: 'cancel' }
        };

        container.innerHTML = apps.map(app => {
            const s = statusMap[app.status] || statusMap.PENDING;
            const postTitle = app.post ? (app.post.title || 'Vị trí') : 'Ứng tuyển';
            const farmName = app.post && app.post.farm ? app.post.farm.name : '';
            const appliedAt = app.appliedAt ? new Date(app.appliedAt).toLocaleDateString('vi-VN') : '';

            let displayMessage = app.message;
            try {
                if (displayMessage && displayMessage.startsWith('{')) {
                    const parsed = JSON.parse(displayMessage);
                    if (parsed.message !== undefined) displayMessage = parsed.message;
                }
            } catch(e) {}

            return `
            <div style="background:white; border-radius:16px; border:1px solid #e5e7eb; padding:20px; transition:all 0.2s;" onmouseenter="this.style.boxShadow='0 8px 24px rgba(0,0,0,0.08)'" onmouseleave="this.style.boxShadow='none'">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                    <div>
                        <h3 style="margin:0; font-size:16px; font-weight:700; color:#111827;">${escapeHtml(postTitle)}</h3>
                        ${farmName ? `<p style="margin:4px 0 0; font-size:13px; color:#6b7280;">${escapeHtml(farmName)}</p>` : ''}
                    </div>
                    <span style="background:${s.bg}; color:${s.color}; padding:4px 10px; border-radius:8px; font-size:12px; font-weight:600; display:flex; align-items:center; gap:4px;">
                        <span class="material-symbols-outlined" style="font-size:14px;">${s.icon}</span>
                        ${s.label}
                    </span>
                </div>
                ${displayMessage ? `<p style="font-size:13px; color:#6b7280; margin-bottom:10px; line-height:1.5;"><strong>Lời nhắn:</strong> ${escapeHtml(displayMessage)}</p>` : ''}
                ${appliedAt ? `<div style="font-size:12px; color:#9ca3af;">Ngày ứng tuyển: ${appliedAt}</div>` : ''}
            </div>`;
        }).join('');

    } catch (err) {
        console.error('Load applications error:', err);
        container.innerHTML = `<p class="text-center py-16 text-red-500">Lỗi tải danh sách: ${escapeHtml(err.message)}</p>`;
    }
}

// ============ CV BUILDER ============
function openCvBuilderModal() {
    document.getElementById('cv-builder-modal').style.display = 'flex';
    loadSavedCvData();

    // Animate in
    if (typeof gsap !== 'undefined') {
        gsap.fromTo('#cv-builder-modal > div', { opacity: 0, y: 30, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'power2.out' });
    }
}

function closeCvBuilderModal() {
    document.getElementById('cv-builder-modal').style.display = 'none';
}

function selectCvTemplate(template) {
    selectedCvTemplate = template;
    document.querySelectorAll('.cv-template').forEach(el => {
        el.classList.toggle('selected', el.dataset.template === template);
    });

    const fonts = {
        'classic': '"Times New Roman", Times, serif',
        'modern': 'Inter, system-ui, sans-serif',
        'creative': '"Comic Sans MS", "Chalkboard SE", cursive, "Segoe Print"'
    };
    
    let styleEl = document.getElementById('cv-dynamic-font');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'cv-dynamic-font';
        document.head.appendChild(styleEl);
    }
    
    styleEl.innerHTML = `
        #cv-fullname, #cv-phone, #cv-education, #cv-skill, #cv-experience, #cv-objective, #cv-work-history {
            font-family: ${fonts[template] || fonts['modern']} !important;
        }
    `;
}

function parseSavedCvs(user) {
    savedCvs = [];
    if (user.cvProfile) {
        try {
            const parsed = JSON.parse(user.cvProfile);
            if (Array.isArray(parsed)) {
                savedCvs = parsed.slice(0, 3).map((cv, idx) => ({
                    id: cv.id || `${Date.now()}_${idx}`,
                    cvName: cv.cvName || `CV ${idx + 1}`,
                    template: cv.template || 'modern',
                    education: cv.education || '',
                    skill: cv.skill || '',
                    experience: cv.experience || '',
                    objective: cv.objective || '',
                    workHistory: cv.workHistory || ''
                }));
            } else {
                parsed.id = Date.now().toString();
                parsed.cvName = parsed.cvName || 'CV Mặc định';
                savedCvs = [parsed];
            }
        } catch (e) {
            savedCvs = [{
                id: Date.now().toString(),
                cvName: 'Hồ sơ text cũ',
                template: 'modern',
                objective: user.cvProfile
            }];
        }
    }
}

async function loadSavedCvData() {
    const userId = getCurrentUserId();
    if (!userId) return;

    try {
        const user = await fetchAPI(`${API_BASE}/user/profile`);
        if (!user) return;

        document.getElementById('cv-fullname').value = user.fullName || '';
        document.getElementById('cv-phone').value = user.phone || '';

        parseSavedCvs(user);
        renderCvListView();
    } catch (err) {
        console.warn('Could not load saved CV:', err);
    }
}

function renderCvListView() {
    const listView = document.getElementById('cv-list-view');
    const formView = document.getElementById('cv-form-view');
    
    listView.style.display = 'block';
    formView.style.display = 'none';

    if (savedCvs.length === 0) {
        listView.innerHTML = `
            <div style="text-align:center; padding:40px 20px;">
                <span class="material-symbols-outlined" style="font-size:48px; color:#9ca3af; margin-bottom:16px;">description</span>
                <p style="color:#4b5563; margin-bottom:20px;">Bạn chưa có hồ sơ (CV) nào được lưu.</p>
                <button onclick="openCvForm()" style="background:#10b981; color:white; border:none; padding:10px 20px; border-radius:8px; font-weight:600; cursor:pointer;">+ Tạo Hồ Sơ Mới</button>
            </div>
        `;
        return;
    }

    let html = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:16px; margin-bottom:24px;">`;
    
    savedCvs.forEach((cv, idx) => {
        let templateIcon = cv.template === 'classic' ? 'article' : (cv.template === 'creative' ? 'brush' : 'dashboard');
        let templateName = cv.template === 'classic' ? 'Cổ điển' : (cv.template === 'creative' ? 'Sáng tạo' : 'Hiện đại');
        let iconColor = cv.template === 'classic' ? '#16a34a' : (cv.template === 'creative' ? '#9333ea' : '#2563eb');

        html += `
            <div style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; background:white; position:relative; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05); transition:transform 0.2s, box-shadow 0.2s; cursor:default;" onmouseenter="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 10px 15px -3px rgba(0,0,0,0.1)';" onmouseleave="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgba(0,0,0,0.05)';">
                <div style="height:140px; background:#f3f4f6; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; border-bottom:1px solid #e5e7eb; cursor:pointer;" onclick="previewCv('${cv.id}')">
                    <span class="material-symbols-outlined" style="font-size:48px; color:${iconColor}; opacity:0.8;">${templateIcon}</span>
                    <div style="position:absolute; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:center; gap:8px; justify-content:center; flex-direction:column; opacity:0; transition:opacity 0.2s;" onmouseenter="this.style.opacity='1';" onmouseleave="this.style.opacity='0';">
                        <span class="material-symbols-outlined" style="color:white; font-size:32px;">visibility</span>
                        <span style="color:white; font-size:13px; font-weight:600;">Xem trước</span>
                    </div>
                </div>
                <div style="padding:16px;">
                    <h3 style="margin:0 0 4px; font-size:15px; color:#111827; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(cv.cvName || 'CV ' + (idx + 1))}</h3>
                    <p style="margin:0 0 12px; font-size:12px; color:#6b7280; display:flex; align-items:center; gap:4px;">
                        <span class="material-symbols-outlined" style="font-size:14px;">palette</span> Mẫu: ${templateName}
                    </p>
                    <div style="display:flex; gap:8px;">
                        <button onclick="editCv('${cv.id}')" style="flex:1; background:#f3f4f6; color:#374151; border:1px solid #d1d5db; padding:6px 0; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s;" onmouseenter="this.style.background='#e5e7eb'" onmouseleave="this.style.background='#f3f4f6'">Sửa</button>
                        <button onclick="deleteCv('${cv.id}')" style="border:none; background:#fee2e2; color:#ef4444; width:32px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;" onmouseenter="this.style.background='#fecaca'" onmouseleave="this.style.background='#fee2e2'">
                            <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;

    if (savedCvs.length < 3) {
        html += `<button onclick="openCvForm()" style="background:#10b981; color:white; border:none; padding:10px 20px; border-radius:8px; font-weight:600; cursor:pointer;">+ Tạo Hồ Sơ Mới (${savedCvs.length}/3)</button>`;
    } else {
        html += `<p style="color:#ef4444; font-size:13px;">Bạn đã đạt tối đa giới hạn 3 CV.</p>`;
    }

    listView.innerHTML = html;
}

function openCvForm(cvId = null) {
    document.getElementById('cv-list-view').style.display = 'none';
    const formView = document.getElementById('cv-form-view');
    formView.style.display = 'block';

    uploadedPdfFile = null;
    window.currentEditPdfUrl = null;

    if (cvId) {
        const cv = savedCvs.find(c => c.id === cvId);
        if (cv) {
            document.getElementById('editing-cv-id').value = cv.id;
            document.getElementById('cv-name').value = cv.cvName || '';
            document.getElementById('cv-education').value = cv.education || '';
            document.getElementById('cv-skill').value = cv.skill || '';
            document.getElementById('cv-experience').value = cv.experience || '';
            document.getElementById('cv-objective').value = cv.objective || '';
            document.getElementById('cv-work-history').value = cv.workHistory || '';
            if (cv.template) selectCvTemplate(cv.template);
            if (cv.pdfUrl) window.currentEditPdfUrl = cv.pdfUrl;
        }
    } else {
        document.getElementById('editing-cv-id').value = '';
        document.getElementById('cv-name').value = '';
        document.getElementById('cv-education').value = '';
        document.getElementById('cv-skill').value = '';
        document.getElementById('cv-experience').value = '';
        document.getElementById('cv-objective').value = '';
        document.getElementById('cv-work-history').value = '';
        selectCvTemplate('modern');
    }
    window.updatePdfUploadUI();
}

function editCv(cvId) {
    openCvForm(cvId);
}

async function deleteCv(cvId) {
    if (!confirm('Bạn có chắc chắn muốn xóa CV này?')) return;
    savedCvs = savedCvs.filter(c => c.id !== cvId);
    await performSaveCvsArray('Đã xóa CV thành công!');
}

async function performSaveCvsArray(successMsg) {
    try {
        let userEmail = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail') || localStorage.getItem('email');
        if (!userEmail) {
            const tempUser = await fetchAPI(`${API_BASE}/user/profile`);
            userEmail = tempUser.email;
        }

        await fetchAPI(`${API_BASE}/user/profile`, 'PUT', {
            email: userEmail,
            cvProfile: JSON.stringify(savedCvs)
        });

        agriAlert(successMsg, 'success');
        renderCvListView();
    } catch (err) {
        agriAlert('Lỗi lưu CSDL CV: ' + err.message, 'error');
    }
}

async function saveCvProfile() {
    const userId = getCurrentUserId();
    if (!userId) { agriAlert('Không xác định được người dùng', 'error'); return; }

    const editingId = document.getElementById('editing-cv-id').value;
    const cvName = document.getElementById('cv-name').value.trim() || 'CV Mới';
    
    // First upload PDF if selected
    let finalPdfUrl = window.currentEditPdfUrl || null;
    if (uploadedPdfFile) {
        const btn = event.target || document.querySelector('button[onclick="saveCvProfile()"]');
        if (btn) btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px; animation:spin 1s linear infinite;">sync</span> Đang lưu...';
        
        const uploadedUrl = await uploadCvPdf(userId);
        if (uploadedUrl) {
            finalPdfUrl = uploadedUrl;
        }
    }

    const cvData = {
        id: editingId || Date.now().toString(),
        cvName: cvName,
        template: selectedCvTemplate,
        education: document.getElementById('cv-education')?.value || '',
        skill: document.getElementById('cv-skill')?.value || '',
        experience: document.getElementById('cv-experience')?.value || '',
        objective: document.getElementById('cv-objective')?.value || '',
        workHistory: document.getElementById('cv-work-history')?.value || '',
        pdfUrl: finalPdfUrl
    };

    if (editingId) {
        const idx = savedCvs.findIndex(c => c.id === editingId);
        if (idx !== -1) {
            savedCvs[idx] = cvData;
        }
    } else {
        if (savedCvs.length >= 3) {
            agriAlert('Bạn chỉ có thể lưu tối đa 3 CV.', 'warning');
            return;
        }
        savedCvs.push(cvData);
    }

    try {
        let userEmail = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail') || localStorage.getItem('email');
        if (!userEmail) {
            const tempUser = await fetchAPI(`${API_BASE}/user/profile`);
            userEmail = tempUser.email;
        }

        const payload = {
            email: userEmail,
            cvProfile: JSON.stringify(savedCvs)
        };
        
        // Also update name and phone if needed (but currently we don't bind those back per CV, they are global)
        const globalName = document.getElementById('cv-fullname')?.value;
        const globalPhone = document.getElementById('cv-phone')?.value;
        if (globalName) payload.fullName = globalName;
        if (globalPhone) payload.phone = globalPhone;

        await fetchAPI(`${API_BASE}/user/profile`, 'PUT', payload);

        agriAlert('Đã lưu hồ sơ thành công!', 'success');
        renderCvListView();
    } catch (err) {
        agriAlert('Lỗi lưu hồ sơ: ' + err.message, 'error');
    }
}

function cancelCvEdit() {
    renderCvListView();
}

function showCvList() {
    renderCvListView();
}

window.showCvList = showCvList;

function handleCvPdfUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
        agriAlert('Vui lòng chọn file PDF', 'warning');
        return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB max
        agriAlert('File quá lớn (tối đa 10MB)', 'warning');
        return;
    }

    uploadedPdfFile = file;
    window.currentEditPdfUrl = null;
    window.updatePdfUploadUI();
}

function removeCvPdf() {
    uploadedPdfFile = null;
    window.currentEditPdfUrl = null;
    document.getElementById('cv-pdf-upload').value = '';
    window.updatePdfUploadUI();
}
window.removeCvPdf = removeCvPdf;

function updatePdfUploadUI() {
    const filenameEl = document.getElementById('cv-pdf-filename');
    if (!filenameEl) return;
    
    if (uploadedPdfFile) {
        filenameEl.innerHTML = `📄 ${escapeHtml(uploadedPdfFile.name)} <button type="button" onclick="removeCvPdf()" style="margin-left:8px; color:#ef4444; border:none; background:none; cursor:pointer; font-weight:bold;" title="Xóa file">x</button>`;
    } else if (window.currentEditPdfUrl) {
        filenameEl.innerHTML = `<a href="${escapeHtml(window.currentEditPdfUrl)}" target="_blank" style="color:#2563eb; text-decoration:underline;">📄 Xem PDF hiện tại</a> <button type="button" onclick="removeCvPdf()" style="margin-left:8px; color:#ef4444; border:none; background:none; cursor:pointer; font-weight:bold;" title="Xóa file">x</button>`;
    } else {
        filenameEl.innerHTML = '';
    }
}
window.updatePdfUploadUI = updatePdfUploadUI;

async function uploadCvPdf(userId) {
    if (!uploadedPdfFile) return;

    const formData = new FormData();
    formData.append('file', uploadedPdfFile);

    try {
        const res = await fetch(`${API_BASE}/user/upload-cv/${userId}`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + getToken() },
            body: formData
        });
        const data = await res.json();
        uploadedPdfFile = null;
        return data.cvPdfUrl;
    } catch (err) {
        console.warn('CV PDF upload failed:', err);
        return null;
    }
}

// Make functions globally accessible
window.switchJobTab = switchJobTab;
window.loadOpenJobs = loadOpenJobs;
window.openApplyModal = openApplyModal;
window.submitApplication = submitApplication;
window.openCvBuilderModal = openCvBuilderModal;
window.closeCvBuilderModal = closeCvBuilderModal;
window.selectCvTemplate = selectCvTemplate;
window.saveCvProfile = saveCvProfile;
window.handleCvPdfUpload = handleCvPdfUpload;

// ============ CV PREVIEW (TOPCV STYLE) ============
function previewCv(cvId) {
    const cv = savedCvs.find(c => c.id === cvId);
    if (!cv) return;
    
    document.getElementById('cv-preview-title').textContent = cv.cvName || 'Bản xem trước CV';
    const editBtn = document.getElementById('cv-preview-edit-btn');
    if (editBtn) {
        editBtn.onclick = function() {
            closeCvPreviewModal();
            editCv(cvId);
        };
    }
    
    const fullName = document.getElementById('cv-fullname')?.value || localStorage.getItem('fullName') || 'Tên ứng viên';
    const phone = document.getElementById('cv-phone')?.value || '0xxx xxx xxx';
    const email = localStorage.getItem('userEmail') || localStorage.getItem('email') || 'email@example.com';
    
    let fontName = 'Inter, sans-serif';
    if(cv.template === 'classic') fontName = '"Times New Roman", Times, serif';
    else if(cv.template === 'creative') fontName = '"Comic Sans MS", "Chalkboard SE", cursive, "Segoe Print"';
    
    // If CV has a dedicated PDF, render iframe instead of HTML layout
    if (cv.pdfUrl) {
        document.getElementById('cv-preview-content').innerHTML = `
            <iframe src="${escapeHtml(cv.pdfUrl)}" style="width:100%; height:100%; border:none; min-height:800px; border-radius:12px;" title="CV PDF"></iframe>
        `;
        document.getElementById('cv-preview-modal').style.display = 'flex';
        return;
    }
    
    const sidebarBg = cv.template === 'classic' ? '#f3f4f6' : (cv.template === 'creative' ? '#fdf4ff' : '#1e3a8a');
    const sidebarText = cv.template === 'classic' ? '#111827' : (cv.template === 'creative' ? '#4a044e' : '#ffffff');
    const accentColor = cv.template === 'classic' ? '#374151' : (cv.template === 'creative' ? '#d946ef' : '#3b82f6');
    
    const html = `
        <div style="font-family:${fontName}; display:flex; width:100%; height:100%; color:#111827;">
            <!-- Left Sidebar -->
            <div style="width:35%; background:${sidebarBg}; color:${sidebarText}; padding:30px; display:flex; flex-direction:column; gap:24px; border-right:1px solid rgba(0,0,0,0.05);">
                <div style="text-align:center;">
                    <div style="width:130px; height:130px; border-radius:50%; background:rgba(255,255,255,0.2); border:4px solid rgba(255,255,255,0.3); margin:0 auto 16px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                        <span class="material-symbols-outlined" style="font-size:72px; opacity:0.8; color:${sidebarText};">person</span>
                    </div>
                    <h2 style="margin:0; font-size:24px; font-weight:700; text-transform:uppercase; letter-spacing:1px; line-height:1.3;">${escapeHtml(fullName)}</h2>
                    <p style="margin:8px 0 0; font-size:15px; opacity:0.9; font-weight:500;">Nhân sự Nông nghiệp</p>
                </div>
                
                <div style="margin-top:20px;">
                    <h3 style="margin:0 0 16px; font-size:16px; font-weight:700; border-bottom:2px solid ${accentColor}; padding-bottom:6px; display:inline-block; text-transform:uppercase;">THÔNG TIN LIÊN HỆ</h3>
                    <div style="display:flex; flex-direction:column; gap:12px; font-size:14px;">
                        <div style="display:flex; align-items:center; gap:10px;"><span class="material-symbols-outlined" style="font-size:20px;">phone</span> ${escapeHtml(phone)}</div>
                        <div style="display:flex; align-items:center; gap:10px; word-break:break-all;"><span class="material-symbols-outlined" style="font-size:20px;">mail</span> ${escapeHtml(email)}</div>
                    </div>
                </div>
                
                <div style="margin-top:20px;">
                    <h3 style="margin:0 0 16px; font-size:16px; font-weight:700; border-bottom:2px solid ${accentColor}; padding-bottom:6px; display:inline-block; text-transform:uppercase;">KỸ NĂNG</h3>
                    <div style="font-size:14px; line-height:1.6; background:rgba(0,0,0,0.05); padding:16px; border-radius:8px;">
                        ${escapeHtml(cv.skill || 'Chưa cập nhật kỹ năng')}
                    </div>
                </div>
                
                <div style="margin-top:20px;">
                    <h3 style="margin:0 0 16px; font-size:16px; font-weight:700; border-bottom:2px solid ${accentColor}; padding-bottom:6px; display:inline-block; text-transform:uppercase;">KINH NGHIỆM</h3>
                    <div style="font-size:16px; font-weight:700; display:flex; align-items:center; gap:8px;">
                        <span class="material-symbols-outlined" style="font-size:24px;">military_tech</span>
                        ${cv.experience > 0 ? cv.experience + ' năm kinh nghiệm' : 'Chưa có kinh nghiệm'}
                    </div>
                </div>
            </div>
            
            <!-- Right Main Content -->
            <div style="width:65%; background:white; padding:45px 40px; display:flex; flex-direction:column; gap:36px;">
                <div>
                    <h3 style="margin:0 0 16px; font-size:20px; font-weight:700; color:${accentColor}; display:flex; align-items:center; gap:10px; border-bottom:2px solid #e5e7eb; padding-bottom:10px;">
                        <span class="material-symbols-outlined" style="font-size:24px;">route</span> MỤC TIÊU NGHỀ NGHIỆP
                    </h3>
                    <div style="font-size:15px; line-height:1.7; color:#374151; white-space:pre-wrap;">${escapeHtml(cv.objective || 'Đang cập nhật mục tiêu nghề nghiệp...')}</div>
                </div>
                
                <div>
                    <h3 style="margin:0 0 16px; font-size:20px; font-weight:700; color:${accentColor}; display:flex; align-items:center; gap:10px; border-bottom:2px solid #e5e7eb; padding-bottom:10px;">
                        <span class="material-symbols-outlined" style="font-size:24px;">school</span> HỌC VẤN & BẰNG CẤP
                    </h3>
                    <div style="font-size:15px; line-height:1.7; color:#374151; white-space:pre-wrap;">${escapeHtml(cv.education || 'Đang cập nhật học vấn...')}</div>
                </div>
                
                <div>
                    <h3 style="margin:0 0 16px; font-size:20px; font-weight:700; color:${accentColor}; display:flex; align-items:center; gap:10px; border-bottom:2px solid #e5e7eb; padding-bottom:10px;">
                        <span class="material-symbols-outlined" style="font-size:24px;">work_history</span> LỊCH SỬ LÀM VIỆC
                    </h3>
                    <div style="font-size:15px; line-height:1.7; color:#374151; white-space:pre-wrap;">${escapeHtml(cv.workHistory || 'Đang cập nhật lịch sử làm việc...')}</div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('cv-preview-content').innerHTML = html;
    document.getElementById('cv-preview-modal').style.display = 'flex';
}

function closeCvPreviewModal() {
    document.getElementById('cv-preview-modal').style.display = 'none';
}

window.previewCv = previewCv;
window.closeCvPreviewModal = closeCvPreviewModal;
