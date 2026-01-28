/**
 * AgriPlanner - Main Application Entry Point
 * This file handles common initialization across all pages
 */

// Ensure DOM is ready before initializing
document.addEventListener('DOMContentLoaded', function() {
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
