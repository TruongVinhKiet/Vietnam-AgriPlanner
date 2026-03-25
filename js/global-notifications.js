/*
 * AgriPlanner - Global Notification System
 * Handles real-time toast notifications + bell icon notification panel
 */

const NOTIF_API = (typeof API_BASE !== 'undefined' ? API_BASE : 'http://localhost:8080/api') + '/notifications';
const NOTIF_USER_ID = 1; // Default owner

// ==================== NOTIFICATION CATEGORIES ====================
const NOTIF_CATEGORIES = {
    cultivation: { label: 'Trồng trọt', icon: 'potted_plant', color: '#16a34a' },
    livestock:   { label: 'Chăn nuôi',  icon: 'egg',           color: '#ea580c' },
    labor:       { label: 'Nhân công',   icon: 'engineering',   color: '#0891b2' },
    inventory:   { label: 'Kho',         icon: 'warehouse',     color: '#7c3aed' },
    shop:        { label: 'Cửa hàng',    icon: 'store',         color: '#db2777' },
    cooperative: { label: 'Hợp tác xã',  icon: 'groups',        color: '#ca8a04' },
    community:   { label: 'Cộng đồng',   icon: 'forum',         color: '#2563eb' },
    finance:     { label: 'Tài sản',      icon: 'account_balance_wallet', color: '#059669' },
    system:      { label: 'Hệ thống',    icon: 'settings',      color: '#64748b' }
};

// ==================== GLOBAL STATE ====================
let _notifPanelOpen = false;
let _notifList = [];
let _notifToastQueue = [];
let _notifToastActive = false;
let _notifUnreadCount = 0;

// ==================== INJECT CSS ====================
(function injectNotifStyles() {
    if (document.getElementById('global-notif-styles')) return;
    const style = document.createElement('style');
    style.id = 'global-notif-styles';
    style.textContent = `
        /* ===== NOTIFICATION TOAST (bottom-right) ===== */
        .gn-toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            min-width: 340px;
            max-width: 420px;
            background: white;
            border-radius: 16px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04);
            z-index: 100000;
            overflow: hidden;
            animation: gnToastIn 0.45s cubic-bezier(.21,1.02,.73,1);
            font-family: 'Manrope', sans-serif;
        }
        .gn-toast--out {
            animation: gnToastOut 0.35s ease forwards;
        }
        .gn-toast__accent {
            height: 4px;
            border-radius: 16px 16px 0 0;
        }
        .gn-toast__body {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 14px 16px;
        }
        .gn-toast__icon-wrap {
            width: 42px; height: 42px;
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
        }
        .gn-toast__icon-wrap .material-symbols-outlined {
            font-size: 22px; color: white;
        }
        .gn-toast__content { flex: 1; min-width: 0; }
        .gn-toast__title {
            font-weight: 700; font-size: 13px; color: #1e293b;
            margin-bottom: 3px; display: flex; align-items: center; gap: 6px;
        }
        .gn-toast__title-tag {
            font-size: 10px; font-weight: 600; padding: 1px 7px;
            border-radius: 6px; color: white; text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .gn-toast__message {
            font-size: 12.5px; color: #64748b; line-height: 1.5;
            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .gn-toast__time {
            font-size: 11px; color: #94a3b8; margin-top: 4px;
        }
        .gn-toast__close {
            position: absolute; top: 10px; right: 10px;
            background: none; border: none; cursor: pointer;
            color: #94a3b8; padding: 2px;
            transition: color 0.2s;
        }
        .gn-toast__close:hover { color: #475569; }
        .gn-toast__close .material-symbols-outlined { font-size: 18px; }
        .gn-toast__progress {
            height: 3px; background: #e2e8f0;
        }
        .gn-toast__progress-bar {
            height: 100%; border-radius: 0 0 0 3px;
            animation: gnProgressShrink var(--gn-duration, 5s) linear forwards;
        }

        @keyframes gnToastIn {
            from { transform: translateX(110%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes gnToastOut {
            from { transform: translateX(0);    opacity: 1; }
            to   { transform: translateX(110%); opacity: 0; }
        }
        @keyframes gnProgressShrink {
            from { width: 100%; }
            to   { width: 0%; }
        }

        /* ===== NOTIFICATION PANEL (right sidebar) ===== */
        .gn-panel-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.3); backdrop-filter: blur(2px);
            z-index: 99998;
            animation: gnFadeIn 0.2s ease;
        }
        .gn-panel-overlay--out { animation: gnFadeOut 0.25s ease forwards; }

        .gn-panel {
            position: fixed; top: 0; right: 0; bottom: 0;
            width: 420px; max-width: 92vw;
            background: white;
            box-shadow: -8px 0 40px rgba(0,0,0,0.15);
            z-index: 99999;
            display: flex; flex-direction: column;
            animation: gnSlideIn 0.3s cubic-bezier(.21,1.02,.73,1);
            font-family: 'Manrope', sans-serif;
        }
        .gn-panel--out { animation: gnSlideOut 0.25s ease forwards; }

        .gn-panel__header {
            padding: 20px; display: flex; align-items: center;
            justify-content: space-between;
            background: linear-gradient(135deg, #16a34a, #15803d);
            color: white; flex-shrink: 0;
        }
        .gn-panel__header-left {
            display: flex; align-items: center; gap: 10px;
        }
        .gn-panel__header-left .material-symbols-outlined {
            font-size: 26px;
        }
        .gn-panel__header h3 {
            margin: 0; font-size: 17px; font-weight: 700;
        }
        .gn-panel__header-count {
            font-size: 12px; opacity: 0.85; font-weight: 400;
        }
        .gn-panel__header-actions {
            display: flex; align-items: center; gap: 8px;
        }
        .gn-panel__header-btn {
            background: rgba(255,255,255,0.2); border: none;
            color: white; border-radius: 8px; padding: 6px 10px;
            font-size: 12px; cursor: pointer; display: flex;
            align-items: center; gap: 4px; font-family: inherit;
            transition: background 0.2s;
        }
        .gn-panel__header-btn:hover { background: rgba(255,255,255,0.35); }
        .gn-panel__header-btn .material-symbols-outlined { font-size: 16px; }
        .gn-panel__close {
            background: rgba(255,255,255,0.2); border: none;
            width: 34px; height: 34px; border-radius: 50%;
            cursor: pointer; display: flex; align-items: center;
            justify-content: center; color: white; transition: background 0.2s;
        }
        .gn-panel__close:hover { background: rgba(255,255,255,0.35); }
        .gn-panel__close .material-symbols-outlined { font-size: 20px; }

        /* Tabs */
        .gn-panel__tabs {
            display: flex; overflow-x: auto; gap: 0;
            border-bottom: 2px solid #f1f5f9;
            padding: 0 12px; flex-shrink: 0;
            scrollbar-width: none;
        }
        .gn-panel__tabs::-webkit-scrollbar { display: none; }
        .gn-panel__tab {
            padding: 10px 14px; font-size: 12.5px; font-weight: 600;
            color: #94a3b8; border: none; background: none;
            cursor: pointer; white-space: nowrap;
            border-bottom: 2.5px solid transparent;
            transition: color 0.2s, border-color 0.2s;
            display: flex; align-items: center; gap: 5px;
            font-family: inherit; position: relative;
        }
        .gn-panel__tab:hover { color: #475569; }
        .gn-panel__tab--active {
            color: #16a34a; border-bottom-color: #16a34a;
        }
        .gn-panel__tab .material-symbols-outlined { font-size: 16px; }
        .gn-panel__tab-badge {
            background: #ef4444; color: white; font-size: 9px;
            min-width: 16px; height: 16px; border-radius: 8px;
            display: inline-flex; align-items: center; justify-content: center;
            font-weight: 700; padding: 0 4px;
        }

        /* Body */
        .gn-panel__body {
            flex: 1; overflow-y: auto; padding: 12px;
        }

        /* Day grouping */
        .gn-day-group { margin-bottom: 16px; }
        .gn-day-label {
            font-size: 11px; font-weight: 700; color: #94a3b8;
            text-transform: uppercase; letter-spacing: 0.8px;
            padding: 4px 8px; margin-bottom: 6px;
        }

        /* Notification item */
        .gn-item {
            display: flex; align-items: flex-start; gap: 12px;
            padding: 14px 12px; border-radius: 12px;
            cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative; border: 1px solid transparent;
            margin-bottom: 6px;
        }
        .gn-item:hover { background: #fbfcfd; border-color: #e2e8f0; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
        .gn-item--unread { background: #f0fdf4; border-color: #dcfce7; }
        .gn-item--unread:hover { background: #dcfce7; border-color: #bbf7d0; box-shadow: 0 4px 12px rgba(22,163,74,0.08); }
        .gn-item__dot {
            position: absolute; top: 18px; left: 6px;
            width: 8px; height: 8px; border-radius: 50%;
            background: #16a34a; box-shadow: 0 0 0 3px rgba(22,163,74,0.2);
        }
        .gn-item--unread .gn-item__dot { display: block; }
        .gn-item:not(.gn-item--unread) .gn-item__dot { display: none; }
        .gn-item--unread .gn-item__icon { margin-left: 10px; }
        .gn-item__icon {
            width: 36px; height: 36px; border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
        }
        .gn-item__icon .material-symbols-outlined {
            font-size: 18px; color: white;
        }
        .gn-item__content { flex: 1; min-width: 0; }
        .gn-item__title {
            font-size: 13px; font-weight: 600; color: #1e293b;
            margin-bottom: 2px;
            display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .gn-item__message {
            font-size: 12px; color: #64748b; line-height: 1.45;
            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .gn-item__time {
            font-size: 11px; color: #94a3b8; margin-top: 3px;
            display: flex; align-items: center; gap: 4px;
        }

        /* Empty state */
        .gn-empty {
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; padding: 60px 20px;
            text-align: center; color: #94a3b8;
        }
        .gn-empty .material-symbols-outlined {
            font-size: 56px; margin-bottom: 12px; opacity: 0.4;
        }
        .gn-empty p { font-size: 14px; margin: 0; }

        /* Bell Badge */
        .gn-bell-badge {
            background: #ef4444; color: white; font-size: 10px;
            min-width: 18px; height: 18px; border-radius: 9px;
            display: none; align-items: center; justify-content: center;
            font-weight: 700; padding: 0 4px;
            position: absolute; top: -4px; right: -4px;
            border: 2px solid white;
            animation: gnBadgePop 0.3s ease;
        }
        .gn-bell-badge--visible { display: flex; }

        @keyframes gnBadgePop {
            0%   { transform: scale(0); }
            60%  { transform: scale(1.3); }
            100% { transform: scale(1); }
        }
        @keyframes gnFadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gnFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes gnSlideIn {
            from { transform: translateX(100%); }
            to   { transform: translateX(0); }
        }
        @keyframes gnSlideOut {
            from { transform: translateX(0); }
            to   { transform: translateX(100%); }
        }
        @keyframes gnItemIn {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        /* Drag-to-scroll tabs */
        .gn-panel__tabs { cursor: grab; user-select: none; }
        .gn-panel__tabs.dragging { cursor: grabbing; scroll-behavior: auto; }
        .gn-panel__tabs:not(.dragging) { scroll-behavior: smooth; }
    `;
    document.head.appendChild(style);
})();

// ==================== TOAST NOTIFICATION ====================
/**
 * Show a toast notification at bottom-right corner
 * @param {string} title
 * @param {string} message
 * @param {string} category - key from NOTIF_CATEGORIES
 * @param {string} [icon] - material icon override
 * @param {number} [duration=5000] - ms
 */
function showNotificationToast(title, message, category = 'system', icon, duration = 5000) {
    const cat = NOTIF_CATEGORIES[category] || NOTIF_CATEGORIES.system;
    const displayIcon = icon || cat.icon;

    // Queue system: only show one toast at a time
    _notifToastQueue.push({ title, message, category, displayIcon, duration, cat });
    if (!_notifToastActive) _processToastQueue();
}

function _processToastQueue() {
    if (_notifToastQueue.length === 0) { _notifToastActive = false; return; }
    _notifToastActive = true;

    const { title, message, category, displayIcon, duration, cat } = _notifToastQueue.shift();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    // Remove any existing toast
    document.querySelectorAll('.gn-toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'gn-toast';
    toast.style.setProperty('--gn-duration', duration + 'ms');
    toast.innerHTML = `
        <div class="gn-toast__accent" style="background:${cat.color};"></div>
        <div class="gn-toast__body">
            <div class="gn-toast__icon-wrap" style="background:${cat.color};">
                <span class="material-symbols-outlined">${displayIcon}</span>
            </div>
            <div class="gn-toast__content">
                <div class="gn-toast__title">
                    ${title}
                    <span class="gn-toast__title-tag" style="background:${cat.color};">${cat.label}</span>
                </div>
                <div class="gn-toast__message">${message}</div>
                <div class="gn-toast__time">
                    <span class="material-symbols-outlined" style="font-size:13px;">schedule</span>
                    ${timeStr}
                </div>
            </div>
            <button class="gn-toast__close" onclick="this.closest('.gn-toast').classList.add('gn-toast--out');setTimeout(()=>this.closest('.gn-toast')?.remove(),350);">
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>
        <div class="gn-toast__progress">
            <div class="gn-toast__progress-bar" style="background:${cat.color};"></div>
        </div>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('gn-toast--out');
            setTimeout(() => { toast.remove(); _processToastQueue(); }, 350);
        }
    }, duration);
}

// ==================== SEND & PERSIST NOTIFICATION ====================
/**
 * Send a global notification: saves to backend + shows toast + updates badge
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} opts.type - backend notification type
 * @param {string} opts.category - NOTIF_CATEGORIES key
 * @param {string} [opts.icon] - icon override
 * @param {boolean} [opts.showToast=true]
 */
async function sendGlobalNotification(opts) {
    const { title, message, type = 'GENERAL', category = 'system', icon, showToast = true } = opts;

    // Show toast immediately
    if (showToast) {
        showNotificationToast(title, message, category, icon);
    }

    // Persist to backend
    try {
        await fetch(NOTIF_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: NOTIF_USER_ID,
                type: type,
                title: title,
                message: `[${category}] ${message}`,
                isRead: false
            })
        });
    } catch (e) {
        console.warn('[GN] Failed to persist notification:', e);
    }

    // Update badge count
    _notifUnreadCount++;
    _updateBellBadge();

    // If panel is open, refresh it
    if (_notifPanelOpen) {
        await _loadNotifications();
        _renderPanelItems();
    }
}

// ==================== BELL BADGE ====================
function _updateBellBadge() {
    document.querySelectorAll('.gn-bell-badge').forEach(badge => {
        if (_notifUnreadCount > 0) {
            badge.textContent = _notifUnreadCount > 99 ? '99+' : _notifUnreadCount;
            badge.classList.add('gn-bell-badge--visible');
        } else {
            badge.classList.remove('gn-bell-badge--visible');
        }
    });
    // Also update old-style badge if exists
    const oldBadge = document.getElementById('notification-badge');
    if (oldBadge) {
        oldBadge.textContent = _notifUnreadCount > 0 ? (_notifUnreadCount > 99 ? '99+' : _notifUnreadCount) : '';
    }
}

async function _fetchUnreadCount() {
    try {
        const resp = await fetch(`${NOTIF_API}/user/${NOTIF_USER_ID}/count`);
        if (resp.ok) {
            const data = await resp.json();
            _notifUnreadCount = data.unreadCount || 0;
            _updateBellBadge();
        }
    } catch (e) { /* silent */ }
}

// ==================== NOTIFICATION PANEL ====================
function toggleGlobalNotifPanel() {
    if (_notifPanelOpen) {
        _closeNotifPanel();
    } else {
        _openNotifPanel();
    }
}

async function _openNotifPanel() {
    _notifPanelOpen = true;
    await _loadNotifications();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'gn-panel-overlay';
    overlay.id = 'gn-panel-overlay';
    overlay.onclick = () => _closeNotifPanel();
    document.body.appendChild(overlay);

    // Create panel
    const panel = document.createElement('div');
    panel.className = 'gn-panel';
    panel.id = 'gn-panel';
    panel.innerHTML = `
        <div class="gn-panel__header" style="background: linear-gradient(135deg, #2A9358, #16643B);">
            <div class="gn-panel__header-left">
                <span class="material-symbols-outlined">notifications_active</span>
                <div>
                    <h3>Thông báo</h3>
                    <div class="gn-panel__header-count" id="gn-panel-count">${_notifUnreadCount} chưa đọc</div>
                </div>
            </div>
            <div class="gn-panel__header-actions">
                <button class="gn-panel__header-btn" onclick="_markAllRead()" style="background: rgba(255,255,255,0.15);">
                    <span class="material-symbols-outlined" style="font-size: 16px;">done_all</span>
                    Đọc hết
                </button>
                <button class="gn-panel__header-btn" onclick="_deleteAllNotifs()" style="background: rgba(239, 68, 68, 0.45); color: #fff;" onmouseover="this.style.background='rgba(239, 68, 68, 0.65)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.45)'">
                    <span class="material-symbols-outlined" style="font-size: 16px;">delete_sweep</span>
                    Xóa hết
                </button>
                <button class="gn-panel__close" onclick="_closeNotifPanel()">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
        </div>
        <div class="gn-panel__tabs" id="gn-panel-tabs"></div>
        <div class="gn-panel__body" id="gn-panel-body"></div>
    `;
    document.body.appendChild(panel);

    _renderPanelTabs();
    _renderPanelItems();
    _setupTabsDragScroll();
}

// ==================== DRAG-TO-SCROLL FOR TABS ====================
function _setupTabsDragScroll() {
    const tabs = document.getElementById('gn-panel-tabs');
    if (!tabs) return;
    let isDown = false, startX, scrollLeft;
    tabs.addEventListener('mousedown', (e) => {
        if (e.target.closest('.gn-panel__tab')) return; // let tab clicks through
        isDown = true; tabs.classList.add('dragging');
        startX = e.pageX - tabs.offsetLeft; scrollLeft = tabs.scrollLeft;
    });
    tabs.addEventListener('mouseleave', () => { isDown = false; tabs.classList.remove('dragging'); });
    tabs.addEventListener('mouseup', () => { isDown = false; tabs.classList.remove('dragging'); });
    tabs.addEventListener('mousemove', (e) => {
        if (!isDown) return; e.preventDefault();
        const x = e.pageX - tabs.offsetLeft;
        tabs.scrollLeft = scrollLeft - (x - startX) * 1.5;
    });
    // Touch support
    tabs.addEventListener('touchstart', (e) => { startX = e.touches[0].pageX; scrollLeft = tabs.scrollLeft; }, { passive: true });
    tabs.addEventListener('touchmove', (e) => {
        const x = e.touches[0].pageX;
        tabs.scrollLeft = scrollLeft - (x - startX);
    }, { passive: true });
}

function _closeNotifPanel() {
    _notifPanelOpen = false;
    const panel = document.getElementById('gn-panel');
    const overlay = document.getElementById('gn-panel-overlay');
    if (panel) { panel.classList.add('gn-panel--out'); setTimeout(() => panel.remove(), 250); }
    if (overlay) { overlay.classList.add('gn-panel-overlay--out'); setTimeout(() => overlay.remove(), 250); }
}

let _currentNotifTab = 'all';

function _renderPanelTabs() {
    const tabsContainer = document.getElementById('gn-panel-tabs');
    if (!tabsContainer) return;

    // Count per category
    const counts = {};
    _notifList.forEach(n => {
        const cat = _extractCategory(n.message);
        counts[cat] = (counts[cat] || 0) + (n.isRead ? 0 : 1);
    });

    let html = `<button class="gn-panel__tab ${_currentNotifTab === 'all' ? 'gn-panel__tab--active' : ''}"
        onclick="_switchNotifTab('all')">
        <span class="material-symbols-outlined">inbox</span>
        Tất cả
        ${_notifUnreadCount > 0 ? `<span class="gn-panel__tab-badge">${_notifUnreadCount}</span>` : ''}
    </button>`;

    for (const [key, cat] of Object.entries(NOTIF_CATEGORIES)) {
        if (key === 'system') continue;
        const catCount = counts[key] || 0;
        html += `<button class="gn-panel__tab ${_currentNotifTab === key ? 'gn-panel__tab--active' : ''}"
            onclick="_switchNotifTab('${key}')">
            <span class="material-symbols-outlined" style="color:${cat.color};">${cat.icon}</span>
            ${cat.label}
            ${catCount > 0 ? `<span class="gn-panel__tab-badge">${catCount}</span>` : ''}
        </button>`;
    }

    tabsContainer.innerHTML = html;
}

function _switchNotifTab(tab) {
    _currentNotifTab = tab;
    _renderPanelTabs();
    _renderPanelItems();
}

function _renderPanelItems() {
    const body = document.getElementById('gn-panel-body');
    if (!body) return;

    let filtered = _notifList;
    if (_currentNotifTab !== 'all') {
        filtered = _notifList.filter(n => _extractCategory(n.message) === _currentNotifTab);
    }

    if (filtered.length === 0) {
        body.innerHTML = `
            <div class="gn-empty">
                <span class="material-symbols-outlined">notifications_off</span>
                <p>Không có thông báo nào</p>
            </div>`;
        return;
    }

    // Group by date
    const groups = {};
    filtered.forEach(n => {
        const dateKey = _formatDateGroup(n.createdAt);
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(n);
    });

    let html = '';
    let idx = 0;
    for (const [label, items] of Object.entries(groups)) {
        html += `<div class="gn-day-group">
            <div class="gn-day-label">${label}</div>`;
        items.forEach(n => {
            const cat = _extractCategory(n.message);
            const catInfo = NOTIF_CATEGORIES[cat] || NOTIF_CATEGORIES.system;
            const cleanMsg = n.message.replace(/^\[.*?\]\s*/, '');
            const timeStr = _formatTime(n.createdAt);
            html += `
                <div class="gn-item ${n.isRead ? '' : 'gn-item--unread'}"
                     style="animation: gnItemIn 0.3s ease ${idx * 0.04}s both;"
                     onclick="_markNotifRead(${n.id})">
                    <span class="gn-item__dot"></span>
                    <div class="gn-item__icon" style="background:${catInfo.color};">
                        <span class="material-symbols-outlined">${_getNotifIcon(n.type, catInfo.icon)}</span>
                    </div>
                    <div class="gn-item__content">
                        <div class="gn-item__title">${n.title}</div>
                        <div class="gn-item__message">${cleanMsg}</div>
                        <div class="gn-item__time">
                            <span class="material-symbols-outlined" style="font-size:12px;">schedule</span>
                            ${timeStr}
                        </div>
                    </div>
                </div>`;
            idx++;
        });
        html += `</div>`;
    }
    body.innerHTML = html;
}

// ==================== HELPERS ====================
function _extractCategory(message) {
    const match = message?.match(/^\[(\w+)\]/);
    if (match && NOTIF_CATEGORIES[match[1]]) return match[1];
    return 'system';
}

function _getNotifIcon(type, fallback) {
    const map = {
        'TASK_ASSIGNED': 'assignment_ind',
        'FIELD_ADDED': 'add_location_alt',
        'FIELD_DELETED': 'location_off',
        'PEN_ADDED': 'add_home',
        'PEN_DELETED': 'delete',
        'UTILITY_UPDATED': 'electrical_services',
        'REPORT_EXPORTED': 'summarize',
        'SALARY_UPDATED': 'payments',
        'TASK_CREATED': 'add_task',
        'TASK_STATUS_CHANGED': 'published_with_changes',
        'CV_RECEIVED': 'person_add',
        'INVENTORY_IN': 'inventory',
        'INVENTORY_OUT': 'move_to_inbox',
        'ORDER_PLACED': 'shopping_cart_checkout',
        'ORDER_DELIVERED': 'local_shipping',
        'ORDER_RECEIVED': 'check_circle',
        'LOYALTY_EARNED': 'stars',
        'COOP_SESSION': 'storefront',
        'COOP_MEMBER': 'group_add',
        'POST_CREATED': 'edit_note',
        'MESSAGE_RECEIVED': 'chat',
        'REACTION_RECEIVED': 'favorite',
        'BALANCE_CHANGE': 'trending_up',
        'GENERAL': 'info'
    };
    return map[type] || fallback || 'notifications';
}

function _formatDateGroup(dateStr) {
    if (!dateStr) return 'Khác';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return 'Hôm nay';
    if (diff === 1) return 'Hôm qua';
    if (diff < 7) return `${diff} ngày trước`;
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function _formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} giờ trước`;
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' +
           d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

async function _loadNotifications() {
    try {
        const resp = await fetch(`${NOTIF_API}/user/${NOTIF_USER_ID}`);
        if (resp.ok) {
            _notifList = await resp.json();
        }
    } catch (e) {
        console.warn('[GN] Failed to load notifications:', e);
    }
}

async function _markNotifRead(id) {
    try {
        await fetch(`${NOTIF_API}/${id}/read`, { method: 'POST' });
        const item = _notifList.find(n => n.id === id);
        if (item && !item.isRead) {
            item.isRead = true;
            _notifUnreadCount = Math.max(0, _notifUnreadCount - 1);
            _updateBellBadge();
        }
        _renderPanelItems();
        _renderPanelTabs();
        const countEl = document.getElementById('gn-panel-count');
        if (countEl) countEl.textContent = `${_notifUnreadCount} chưa đọc`;
    } catch (e) { /* silent */ }
}

async function _markAllRead() {
    try {
        await fetch(`${NOTIF_API}/user/${NOTIF_USER_ID}/read-all`, { method: 'POST' });
        _notifList.forEach(n => n.isRead = true);
        _notifUnreadCount = 0;
        _updateBellBadge();
        _renderPanelItems();
        _renderPanelTabs();
        const countEl = document.getElementById('gn-panel-count');
        if (countEl) countEl.textContent = '0 chưa đọc';
    } catch (e) { /* silent */ }
}

async function _deleteAllNotifs() {
    if (typeof agriConfirm === 'function') {
        agriConfirm('Xóa toàn bộ?', 'Bạn có chắc chắn muốn xóa tất cả lịch sử thông báo không?', async function() {
            try {
                await fetch(`${NOTIF_API}/user/${NOTIF_USER_ID}/all`, { method: 'DELETE' });
                _notifList = [];
                _notifUnreadCount = 0;
                _updateBellBadge();
                _renderPanelItems();
                _renderPanelTabs();
                const countEl = document.getElementById('gn-panel-count');
                if (countEl) countEl.textContent = '0 chưa đọc';
                showNotificationToast('Thành công', 'Đã xóa toàn bộ lịch sử thông báo.', 'system', 'delete_sweep', 4000);
            } catch (e) {
                console.error('Lỗi khi xóa thông báo:', e);
            }
        });
    } else {
        if (!confirm('Bạn có chắc chắn muốn xóa tất cả lịch sử thông báo không?')) return;
        try {
            await fetch(`${NOTIF_API}/user/${NOTIF_USER_ID}/all`, { method: 'DELETE' });
            _notifList = [];
            _notifUnreadCount = 0;
            _updateBellBadge();
            _renderPanelItems();
            _renderPanelTabs();
            const countEl = document.getElementById('gn-panel-count');
            if (countEl) countEl.textContent = '0 chưa đọc';
            showNotificationToast('Thành công', 'Đã xóa toàn bộ lịch sử thông báo.', 'system', 'delete_sweep', 4000);
        } catch (e) {
            console.error('Lỗi khi xóa thông báo:', e);
        }
    }
}

// ==================== AUTO-SETUP BELL ICONS ====================
document.addEventListener('DOMContentLoaded', function () {
    // Attach click handlers to existing bell icons
    document.querySelectorAll('.header__notification').forEach(btn => {
        // Check if it already contains the 'notifications' icon
        const iconEl = btn.querySelector('.material-symbols-outlined');
        if (iconEl && iconEl.textContent.trim() === 'notifications') {
            // Replace onclick to use global panel
            btn.onclick = function (e) {
                e.preventDefault();
                e.stopPropagation();
                toggleGlobalNotifPanel();
            };
            // Add badge if not already present
            if (!btn.querySelector('.gn-bell-badge')) {
                btn.style.position = 'relative';
                const badge = document.createElement('span');
                badge.className = 'gn-bell-badge';
                btn.appendChild(badge);
            }
        }
    });

    // Initial badge fetch
    _fetchUnreadCount();

    // Poll every 30s
    setInterval(_fetchUnreadCount, 30000);
});
