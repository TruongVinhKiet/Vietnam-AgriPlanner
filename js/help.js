/**
 * Help Page - Admin Support Request Form
 * Handles sending support requests to admin and viewing history
 */

// API_BASE_URL is already defined in config.js

let helpCurrentUser = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadHelpCurrentUser();
    initOwnerHelpForm();
});

async function loadHelpCurrentUser() {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/user/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            helpCurrentUser = await response.json();
            // Also store userId in localStorage for other pages
            if (helpCurrentUser.id) {
                localStorage.setItem('userId', String(helpCurrentUser.id));
            }
        }
    } catch (error) {
        console.error('Error loading user:', error);
    }
}

function initOwnerHelpForm() {
    const form = document.getElementById('owner-help-admin-form');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const type = document.getElementById('owner-help-type')?.value || 'other';
        const title = document.getElementById('owner-help-title')?.value?.trim();
        const message = document.getElementById('owner-help-message')?.value?.trim();
        const statusEl = document.getElementById('owner-help-status');

        if (!message) {
            showHelpStatus(statusEl, 'Vui lòng nhập nội dung chi tiết.', false);
            return;
        }

        const token = localStorage.getItem('authToken') || '';
        const userId = helpCurrentUser?.id || localStorage.getItem('userId');

        try {
            const res = await fetch(`${API_BASE_URL}/help/admin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    senderId: userId,
                    senderRole: 'OWNER',
                    requestType: type,
                    title: title || `[${type}] Yêu cầu hỗ trợ`,
                    message: message
                })
            });

            if (res.ok) {
                showHelpStatus(statusEl, '✓ Đã gửi yêu cầu tới quản trị viên!', true);
                document.getElementById('owner-help-title').value = '';
                document.getElementById('owner-help-message').value = '';
                loadOwnerHelpRequests();
            } else {
                const data = await res.json().catch(() => ({}));
                showHelpStatus(statusEl, data.error || 'Gửi yêu cầu thất bại. Vui lòng thử lại.', false);
            }
        } catch (err) {
            console.error('Owner help request error:', err);
            showHelpStatus(statusEl, 'Không thể kết nối đến máy chủ.', false);
        }
    });
}

function showHelpStatus(el, text, isSuccess) {
    if (!el) return;
    el.textContent = text;
    el.style.display = 'block';
    el.style.background = isSuccess ? '#f0fdf4' : '#fef2f2';
    el.style.color = isSuccess ? '#15803d' : '#dc2626';
    el.style.border = `1px solid ${isSuccess ? '#bbf7d0' : '#fecaca'}`;
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}

async function loadOwnerHelpRequests() {
    const token = localStorage.getItem('authToken') || '';
    const listEl = document.getElementById('owner-help-requests-list');
    const countEl = document.getElementById('owner-help-count');
    if (!listEl) return;

    try {
        // Use JWT-based my-requests endpoint
        const res = await fetch(`${API_BASE_URL}/help/admin/my-requests`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const requests = await res.json();
            const items = Array.isArray(requests) ? requests : (requests.content || []);
            if (countEl) countEl.textContent = items.length;

            if (items.length === 0) {
                listEl.innerHTML = `
                    <div style="text-align: center; color: #9ca3af; padding: 40px 20px;">
                        <span class="material-symbols-outlined" style="font-size: 40px; margin-bottom: 8px;">inbox</span>
                        <p style="margin: 0;">Chưa có yêu cầu nào</p>
                    </div>`;
                return;
            }

            listEl.innerHTML = items.map(req => {
                const statusColor = req.status === 'CLOSED' ? 'background: #f0fdf4; color: #15803d;' :
                                   req.status === 'RESPONDED' ? 'background: #eff6ff; color: #1d4ed8;' :
                                   'background: #fffbeb; color: #b45309;';
                const statusLabel = req.status === 'CLOSED' ? 'Đã đóng' :
                                   req.status === 'RESPONDED' ? 'Đã phản hồi' : 'Chờ xử lý';
                const date = req.createdAt ? new Date(req.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                const typeLabel = getRequestTypeLabel(req.requestType);

                return `
                    <div style="padding: 14px 20px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: flex-start; gap: 12px;">
                        <div style="width: 36px; height: 36px; border-radius: 10px; background: #f0fdf4; color: #16a34a; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
                            <span class="material-symbols-outlined" style="font-size: 18px;">admin_panel_settings</span>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                                <span style="font-weight: 600; font-size: 14px; color: #1f2937;">${escapeHelpHtml(req.title || 'Yêu cầu hỗ trợ')}</span>
                                <span style="padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; ${statusColor}">${statusLabel}</span>
                                ${typeLabel ? `<span style="padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 500; background: #f3f4f6; color: #6b7280;">${typeLabel}</span>` : ''}
                            </div>
                            <p style="font-size: 13px; color: #6b7280; margin: 0 0 4px; line-height: 1.5; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${escapeHelpHtml(req.message || '')}</p>
                            ${req.adminResponse ? `
                                <div style="margin-top: 8px; padding: 10px 14px; background: #eff6ff; border-radius: 10px; border-left: 3px solid #3b82f6;">
                                    <div style="font-size: 11px; font-weight: 600; color: #1d4ed8; margin-bottom: 4px;">
                                        <span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle; margin-right: 4px;">support_agent</span>
                                        Phản hồi từ quản trị viên
                                    </div>
                                    <p style="font-size: 13px; color: #374151; margin: 0; line-height: 1.5;">${escapeHelpHtml(req.adminResponse)}</p>
                                </div>
                            ` : ''}
                            <span style="font-size: 11px; color: #9ca3af; margin-top: 6px; display: block;">${date}</span>
                        </div>
                    </div>`;
            }).join('');
        }
    } catch (err) {
        console.error('Load owner help requests error:', err);
    }
}

function getRequestTypeLabel(type) {
    const map = {
        'technical': 'Kỹ thuật',
        'account': 'Tài khoản',
        'farm': 'Nông trại',
        'payment': 'Tài chính',
        'suggestion': 'Góp ý',
        'other': 'Khác'
    };
    return map[type] || '';
}

function escapeHelpHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
