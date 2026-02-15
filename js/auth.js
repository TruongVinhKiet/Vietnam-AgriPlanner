/*
 * watermark: AGRIPLANNER-TVK-2026-TNL-TK4L6
 * Copyright (c) 2026 Truong Vinh Kiet
 */
/* =====================================================
   AgriPlanner - Authentication Utilities
   Handles auth state, token management, route protection
   ===================================================== */

const AUTH_CONFIG = {
    API_URL: 'http://localhost:8080/api/auth',
    TOKEN_KEY: 'authToken',
    USER_KEY: 'userEmail',
    NAME_KEY: 'userName',
    ROLE_KEY: 'userRole',
    AVATAR_KEY: 'userAvatar',
    LOGIN_PAGE: '/pages/login.html',
    ADMIN_PAGE: '/pages/admin.html',
    DASHBOARD_PAGE: '/index.html'
};

/**
 * Check if user is authenticated (token exists AND not expired)
 * @returns {boolean}
 */
function isAuthenticated() {
    const token = localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
    if (!token || token === '') return false;
    
    // Check JWT expiration
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
            console.warn('Auth token expired, clearing session');
            localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
            return false;
        }
    } catch (e) {
        // Invalid token format
        localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
        return false;
    }
    return true;
}

/**
 * Get current user info
 * @returns {Object|null}
 */
function getCurrentUser() {
    if (!isAuthenticated()) return null;

    return {
        email: localStorage.getItem(AUTH_CONFIG.USER_KEY),
        fullName: localStorage.getItem(AUTH_CONFIG.NAME_KEY),
        role: localStorage.getItem(AUTH_CONFIG.ROLE_KEY),
        avatar: localStorage.getItem(AUTH_CONFIG.AVATAR_KEY),
        token: localStorage.getItem(AUTH_CONFIG.TOKEN_KEY)
    };
}

/**
 * Get user role
 * @returns {string|null}
 */
function getUserRole() {
    return localStorage.getItem(AUTH_CONFIG.ROLE_KEY);
}

/**
 * Logout user - clear all auth data
 */
function logout() {
    localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
    localStorage.removeItem(AUTH_CONFIG.USER_KEY);
    localStorage.removeItem(AUTH_CONFIG.NAME_KEY);
    localStorage.removeItem(AUTH_CONFIG.ROLE_KEY);
    localStorage.removeItem(AUTH_CONFIG.AVATAR_KEY);
    window.location.href = AUTH_CONFIG.LOGIN_PAGE;
}

/**
 * Redirect to login if not authenticated
 * Call this on protected pages
 */
function requireAuth() {
    if (!isAuthenticated()) {
        // Save current page for redirect after login
        sessionStorage.setItem('redirectAfterLogin', window.location.href);
        window.location.href = AUTH_CONFIG.LOGIN_PAGE;
        return false;
    }
    return true;
}

/**
 * Redirect based on role
 * SYSTEM_ADMIN goes to admin page, others to dashboard
 */
function redirectByRole() {
    const role = getUserRole();
    if (role === 'SYSTEM_ADMIN' || role === 'OWNER') {
        window.location.href = AUTH_CONFIG.ADMIN_PAGE;
    } else if (role === 'WORKER') {
        window.location.href = '/pages/worker_dashboard.html';
    } else {
        window.location.href = AUTH_CONFIG.DASHBOARD_PAGE;
    }
}

/**
 * Check if current user is admin
 * @returns {boolean}
 */
function isAdmin() {
    return getUserRole() === 'SYSTEM_ADMIN';
}

/**
 * Update UI with user info (e.g., sidebar user display)
 */
function updateUserDisplay() {
    const user = getCurrentUser();
    if (!user) return;

    // Update sidebar user name if element exists
    const userNameEl = document.querySelector('.sidebar__user-name');
    if (userNameEl) {
        userNameEl.textContent = user.fullName || user.email;
    }

    // Update sidebar user email if element exists
    const userEmailEl = document.querySelector('.sidebar__user-email');
    if (userEmailEl) {
        userEmailEl.textContent = user.email;
    }

    // Update sidebar avatar if element exists
    const sidebarAvatarEl = document.querySelector('.sidebar__user-avatar');
    if (sidebarAvatarEl && user.avatar) {
        sidebarAvatarEl.style.backgroundImage = `url('${user.avatar}')`;
        sidebarAvatarEl.style.backgroundSize = 'cover';
        sidebarAvatarEl.style.backgroundPosition = 'center';
    }
}

/**
 * Make authenticated API request
 * @param {string} url 
 * @param {Object} options 
 * @returns {Promise<Response>}
 */
async function authFetch(url, options = {}) {
    const token = localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    return fetch(url, {
        ...options,
        headers
    });
}

// Export for module usage
window.Auth = {
    isAuthenticated,
    getCurrentUser,
    getUserRole,
    logout,
    requireAuth,
    redirectByRole,
    isAdmin,
    updateUserDisplay,
    authFetch,
    CONFIG: AUTH_CONFIG
};

// Apply dark mode from localStorage on every page load
function applyDarkMode() {
    const darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'true') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
    }
}

// Update header with user info
function updateHeaderDisplay() {
    const user = getCurrentUser();
    if (!user) return;

    const roleLabels = {
        'OWNER': 'Chủ trang trại',
        'WORKER': 'Nhân công',
        'SYSTEM_ADMIN': 'Quản trị viên'
    };

    // Update header user name
    const headerNameEl = document.querySelector('.header__user-name');
    if (headerNameEl) {
        headerNameEl.textContent = user.fullName || user.email;
    }

    // Update header role
    const headerRoleEl = document.querySelector('.header__user-role');
    if (headerRoleEl) {
        headerRoleEl.textContent = roleLabels[user.role] || user.role;
    }

    // Update header avatar
    const headerAvatarEl = document.querySelector('.header__user-avatar');
    if (headerAvatarEl && user.avatar) {
        headerAvatarEl.style.backgroundImage = `url('${user.avatar}')`;
        headerAvatarEl.style.backgroundSize = 'cover';
        headerAvatarEl.style.backgroundPosition = 'center';
    }
}

// Auto-check authentication on page load for protected pages
document.addEventListener('DOMContentLoaded', async () => {
    const currentPage = window.location.pathname;

    // Apply dark mode first (for all pages)
    applyDarkMode();

    // Skip auth check for login and register pages
    if (currentPage.includes('login.html') || currentPage.includes('register.html')) {
        // If already logged in, redirect to appropriate page
        if (isAuthenticated()) {
            redirectByRole();
        }
        return;
    }

    // For all other pages, require authentication
    if (!currentPage.includes('login.html') && !currentPage.includes('register.html')) {
        if (requireAuth()) {
            // Sync user profile from API to ensure avatar is up-to-date
            await syncUserProfile();
            // Update user display after successful auth check
            updateUserDisplay();
            updateHeaderDisplay();
        }
    }
});

/**
 * Sync user profile from API to update localStorage with latest data
 * This fixes avatar not showing after backend restart
 */
async function syncUserProfile() {
    const token = localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
    if (!token) return;

    try {
        const response = await fetch('http://localhost:8080/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const profile = await response.json();
            // Update localStorage with latest user data
            if (profile.fullName) localStorage.setItem(AUTH_CONFIG.NAME_KEY, profile.fullName);
            if (profile.email) localStorage.setItem(AUTH_CONFIG.USER_KEY, profile.email);
            if (profile.role) localStorage.setItem(AUTH_CONFIG.ROLE_KEY, profile.role);
            if (profile.avatarUrl) {
                localStorage.setItem(AUTH_CONFIG.AVATAR_KEY, profile.avatarUrl);
            }
        }
    } catch (error) {
        console.error('Error syncing user profile:', error);
    }
}
