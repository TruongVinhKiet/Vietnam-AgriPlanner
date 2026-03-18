/*
 * watermark: AGRIPLANNER-TVK-2026-TNL-TK4L6
 * Copyright (c) 2026 Truong Vinh Kiet
 */
/**
 * AgriPlanner - Main Application Entry Point
 * This file handles common initialization across all pages
 */

// Ensure DOM is ready before initializing
document.addEventListener('DOMContentLoaded', function () {
    console.log('AgriPlanner initialized');

    // Initialize common features
    initializeApp();
});

/**
 * Initialize common application features
 */
function initializeApp() {
    // Add fade-in animation to cards
    const fadeElements = document.querySelectorAll('.fade-in');
    fadeElements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        setTimeout(() => {
            el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, index * 100);
    });

    // Initialize tooltips if any
    initTooltips();

    // Handle responsive sidebar
    handleResponsiveSidebar();
}

/**
 * Initialize tooltips
 */
function initTooltips() {
    const tooltips = document.querySelectorAll('[data-tooltip]');
    tooltips.forEach(el => {
        el.addEventListener('mouseenter', showTooltip);
        el.addEventListener('mouseleave', hideTooltip);
    });
}

function showTooltip(e) {
    const text = e.target.getAttribute('data-tooltip');
    if (!text) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    tooltip.style.cssText = `
        position: absolute;
        background: #1f2937;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        z-index: 9999;
        white-space: nowrap;
    `;

    document.body.appendChild(tooltip);

    const rect = e.target.getBoundingClientRect();
    tooltip.style.top = (rect.bottom + 8) + 'px';
    tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';

    e.target._tooltip = tooltip;
}

function hideTooltip(e) {
    if (e.target._tooltip) {
        e.target._tooltip.remove();
        delete e.target._tooltip;
    }
}

/**
 * Handle responsive sidebar
 */
function handleResponsiveSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mainWrapper = document.querySelector('.main-wrapper');

    // Check if mobile
    if (window.innerWidth <= 768 && sidebar) {
        sidebar.classList.add('collapsed');
    }

    // Listen for resize
    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768 && sidebar) {
            sidebar.classList.add('collapsed');
        }
    });
}

/**
 * Utility: Format Vietnamese currency
 */
function formatVNCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
}

/**
 * Utility: Format date in Vietnamese
 */
function formatVietnameseDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

/**
 * Utility: Show toast notification
 */
function showToast(message, type = 'info', duration = 3000) {
    // Remove existing toast
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <span class="material-symbols-outlined">${getToastIcon(type)}</span>
        <span>${message}</span>
    `;

    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        z-index: 99999;
        animation: slideInRight 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function getToastIcon(type) {
    switch (type) {
        case 'success': return 'check_circle';
        case 'error': return 'error';
        case 'warning': return 'warning';
        default: return 'info';
    }
}

// Add CSS animations for toast
const toastStyles = document.createElement('style');
toastStyles.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(toastStyles);

// ==================== GLOBAL agriAlert / agriConfirm ====================

/**
 * Styled alert replacement. Shows a beautiful modal instead of browser alert.
 * @param {string} message - The message to display
 * @param {string} type - 'success' | 'error' | 'warning' | 'info' (default: 'info')
 * @param {string} [title] - Optional title override
 */
function agriAlert(message, type = 'info', title) {
    const existing = document.getElementById('agri-alert-overlay');
    if (existing) existing.remove();

    const styles = {
        success: { gradient: 'linear-gradient(135deg, #10b981, #059669)', icon: 'check_circle', defaultTitle: 'Thành công', bg: '#ecfdf5', border: '#a7f3d0', textColor: '#065f46' },
        error:   { gradient: 'linear-gradient(135deg, #ef4444, #dc2626)', icon: 'error',        defaultTitle: 'Lỗi',        bg: '#fef2f2', border: '#fecaca', textColor: '#991b1b' },
        warning: { gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', icon: 'warning',      defaultTitle: 'Cảnh báo',    bg: '#fffbeb', border: '#fde68a', textColor: '#92400e' },
        info:    { gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', icon: 'info',          defaultTitle: 'Thông báo',   bg: '#eff6ff', border: '#bfdbfe', textColor: '#1e40af' }
    };
    const s = styles[type] || styles.info;
    const displayTitle = title || s.defaultTitle;

    const overlay = document.createElement('div');
    overlay.id = 'agri-alert-overlay';
    overlay.className = 'agri-modal-overlay';
    overlay.innerHTML = `
        <div class="agri-modal-box" style="max-width:420px;">
            <div class="agri-modal-header" style="background:${s.gradient};">
                <div style="display:flex;align-items:center;gap:10px;">
                    <span class="material-symbols-outlined" style="font-size:28px;">${s.icon}</span>
                    <h3 style="margin:0;color:white;font-size:17px;font-weight:700;">${displayTitle}</h3>
                </div>
                <button class="agri-modal-close" onclick="document.getElementById('agri-alert-overlay')?.remove()">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="agri-modal-body">
                <div style="background:${s.bg};border:1px solid ${s.border};border-radius:12px;padding:16px;color:${s.textColor};font-size:14px;line-height:1.6;">
                    ${message}
                </div>
            </div>
            <div class="agri-modal-footer">
                <button class="agri-btn-primary" style="background:${s.gradient};" onclick="document.getElementById('agri-alert-overlay')?.remove()">
                    <span class="material-symbols-outlined" style="font-size:18px;">check</span>
                    Đã hiểu
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    // Focus the OK button
    overlay.querySelector('.agri-btn-primary')?.focus();
}

/**
 * Styled confirm replacement. Shows a beautiful confirmation modal.
 * @param {string} title - Modal title
 * @param {string} message - Confirmation message
 * @param {Function} onConfirm - Callback when user confirms
 * @param {Object} [options] - Optional: { confirmText, cancelText, type, onCancel }
 */
function agriConfirm(title, message, onConfirm, options = {}) {
    const existing = document.getElementById('agri-confirm-overlay');
    if (existing) existing.remove();

    const {
        confirmText = 'Xác nhận',
        cancelText = 'Hủy',
        type = 'warning',
        onCancel = null
    } = options;

    const gradients = {
        warning: 'linear-gradient(135deg, #f59e0b, #d97706)',
        danger:  'linear-gradient(135deg, #ef4444, #dc2626)',
        success: 'linear-gradient(135deg, #10b981, #059669)',
        info:    'linear-gradient(135deg, #3b82f6, #2563eb)'
    };
    const icons = {
        warning: 'help',
        danger: 'warning',
        success: 'check_circle',
        info: 'info'
    };
    const gradient = gradients[type] || gradients.warning;
    const icon = icons[type] || icons.warning;

    const overlay = document.createElement('div');
    overlay.id = 'agri-confirm-overlay';
    overlay.className = 'agri-modal-overlay';
    overlay.innerHTML = `
        <div class="agri-modal-box" style="max-width:440px;">
            <div class="agri-modal-header" style="background:${gradient};">
                <div style="display:flex;align-items:center;gap:10px;">
                    <span class="material-symbols-outlined" style="font-size:28px;">${icon}</span>
                    <h3 style="margin:0;color:white;font-size:17px;font-weight:700;">${title}</h3>
                </div>
                <button class="agri-modal-close" id="agri-confirm-close-x">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="agri-modal-body">
                <p style="color:#374151;font-size:14px;line-height:1.7;margin:0;">${message}</p>
            </div>
            <div class="agri-modal-footer" style="justify-content:flex-end;gap:12px;">
                <button class="agri-btn-cancel" id="agri-confirm-cancel-btn">${cancelText}</button>
                <button class="agri-btn-primary" id="agri-confirm-ok-btn" style="background:${gradient};">
                    <span class="material-symbols-outlined" style="font-size:18px;">check_circle</span>
                    ${confirmText}
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const closeModal = () => { document.getElementById('agri-confirm-overlay')?.remove(); };

    document.getElementById('agri-confirm-cancel-btn').onclick = () => { closeModal(); if (onCancel) onCancel(); };
    document.getElementById('agri-confirm-close-x').onclick = () => { closeModal(); if (onCancel) onCancel(); };
    document.getElementById('agri-confirm-ok-btn').onclick = () => { closeModal(); if (onConfirm) onConfirm(); };
}

// ==================== agriAlert/agriConfirm CSS ====================
const agriModalStyles = document.createElement('style');
agriModalStyles.textContent = `
    .agri-modal-overlay {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        z-index: 99999; animation: agriFadeIn 0.2s ease;
    }
    .agri-modal-box {
        background: white; border-radius: 16px; width: 90%;
        box-shadow: 0 25px 60px rgba(0,0,0,0.25);
        animation: agriSlideUp 0.25s ease;
        overflow: hidden;
    }
    .agri-modal-header {
        padding: 18px 24px; display: flex; align-items: center;
        justify-content: space-between; color: white;
    }
    .agri-modal-close {
        background: rgba(255,255,255,0.2); border: none; width: 34px; height: 34px;
        border-radius: 50%; cursor: pointer; display: flex; align-items: center;
        justify-content: center; color: white; transition: background 0.2s;
    }
    .agri-modal-close:hover { background: rgba(255,255,255,0.35); }
    .agri-modal-body { padding: 20px 24px; }
    .agri-modal-footer {
        padding: 14px 24px 20px; display: flex; align-items: center;
        justify-content: flex-end; gap: 10px;
    }
    .agri-btn-primary {
        padding: 10px 22px; border: none; color: white; border-radius: 10px;
        cursor: pointer; font-weight: 600; font-size: 14px;
        display: flex; align-items: center; gap: 6px;
        transition: opacity 0.2s, transform 0.1s;
        font-family: inherit;
    }
    .agri-btn-primary:hover { opacity: 0.9; }
    .agri-btn-primary:active { transform: scale(0.97); }
    .agri-btn-cancel {
        padding: 10px 22px; border: 1px solid #d1d5db; background: white;
        border-radius: 10px; cursor: pointer; font-weight: 500; color: #6b7280;
        font-size: 14px; transition: background 0.2s; font-family: inherit;
    }
    .agri-btn-cancel:hover { background: #f9fafb; }
    @keyframes agriFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes agriSlideUp { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
`;
document.head.appendChild(agriModalStyles);
