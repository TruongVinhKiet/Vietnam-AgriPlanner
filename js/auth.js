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
    WORKER_PAGE: '/pages/worker_dashboard.html',
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
 * SYSTEM_ADMIN → admin page, OWNER → dashboard, WORKER → worker dashboard
 */
function redirectByRole() {
    const role = getUserRole();
    if (role === 'SYSTEM_ADMIN') {
        window.location.href = AUTH_CONFIG.ADMIN_PAGE;
    } else if (role === 'WORKER') {
        window.location.href = AUTH_CONFIG.WORKER_PAGE;
    } else {
        // OWNER and any other role → main dashboard
        window.location.href = AUTH_CONFIG.DASHBOARD_PAGE;
    }
}

/**
 * Get the home page URL for a given role
 * @param {string} role
 * @returns {string}
 */
function getHomePageForRole(role) {
    if (role === 'SYSTEM_ADMIN') return AUTH_CONFIG.ADMIN_PAGE;
    if (role === 'WORKER') return AUTH_CONFIG.WORKER_PAGE;
    return AUTH_CONFIG.DASHBOARD_PAGE;
}

/**
 * Guard a page to only allow specific roles.
 * If the current user's role is not in the allowed list,
 * they are redirected to their correct home page.
 * @param {string[]} allowedRoles - Array of role strings allowed on this page
 * @returns {boolean} true if user is allowed, false if redirected
 */
function requireRole(allowedRoles) {
    const role = getUserRole();
    if (!role || !allowedRoles.includes(role)) {
        const homePage = getHomePageForRole(role);
        window.location.href = homePage;
        return false;
    }
    return true;
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

/**
 * Page-to-role mapping for access control.
 * Pages listed here are restricted to the specified roles.
 * Pages NOT listed allow all authenticated users.
 * admin.html and worker_dashboard.html handle their own guards (don't include auth.js).
 */
const PAGE_ROLE_GUARDS = {
    'cultivation.html': ['OWNER'],
    'livestock.html': ['OWNER'],
    'labor.html': ['OWNER'],
    'analytics.html': ['OWNER'],
    'worker_detail.html': ['OWNER'],
    'index.html': ['OWNER']
    // settings.html, community.html, shop.html, cooperative.html, help.html, guide.html → all roles
};

/**
 * Check if current page has role restrictions and enforce them.
 * Returns true if user is allowed, false if redirected.
 */
function checkPageRoleGuard() {
    const currentPage = window.location.pathname;
    const role = getUserRole();

    for (const [page, allowedRoles] of Object.entries(PAGE_ROLE_GUARDS)) {
        if (currentPage.includes(page)) {
            if (!role || !allowedRoles.includes(role)) {
                // Redirect to the user's correct home page
                window.location.href = getHomePageForRole(role);
                return false;
            }
            break;
        }
    }
    return true;
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
            // Check role-based page access control
            if (!checkPageRoleGuard()) return;

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
