/* =====================================================
   AgriPlanner - Sidebar Component
   Handles sidebar state and navigation
   ===================================================== */

class Sidebar {
    constructor() {
        this.sidebar = document.querySelector('.sidebar');
        this.navLinks = document.querySelectorAll('.sidebar__nav-link');
        this.toggleBtn = document.querySelector('.sidebar-toggle');
        this.isOpen = true;

        this.init();
    }

    init() {
        this.setActiveLink();
        this.bindEvents();
        this.checkMobile();
    }

    /**
     * Set active state based on current URL
     */
    setActiveLink() {
        const currentPath = window.location.pathname;
        const currentPage = currentPath.split('/').pop() || 'index.html';

        this.navLinks.forEach(link => {
            link.classList.remove('active');

            const href = link.getAttribute('href');
            if (!href) return;

            const linkPage = href.split('/').pop();

            // Check for exact match or if on dashboard
            if (linkPage === currentPage ||
                (currentPage === 'index.html' && href.includes('dashboard')) ||
                (currentPage === '' && href.includes('dashboard'))) {
                link.classList.add('active');
            }
        });
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Toggle button click
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggle());
        }

        // Navigation link clicks
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => this.handleNavClick(e, link));
        });

        // Close on outside click (mobile)
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 1024 &&
                this.isOpen &&
                !this.sidebar.contains(e.target) &&
                !this.toggleBtn?.contains(e.target)) {
                this.close();
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => this.checkMobile());
    }

    /**
     * Handle navigation link click
     */
    handleNavClick(e, link) {
        // Update active state immediately for better UX
        this.navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // Close sidebar on mobile after navigation
        if (window.innerWidth <= 1024) {
            setTimeout(() => this.close(), 150);
        }
    }

    /**
     * Toggle sidebar open/closed
     */
    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    /**
     * Open sidebar
     */
    open() {
        this.isOpen = true;
        this.sidebar?.classList.add('open');
        document.body.classList.add('sidebar-open');

        // Animate with GSAP if available
        if (window.Animations?.isGsapLoaded()) {
            gsap.to(this.sidebar, {
                x: 0,
                duration: 0.3,
                ease: 'power2.out'
            });
        }
    }

    /**
     * Close sidebar
     */
    close() {
        this.isOpen = false;
        this.sidebar?.classList.remove('open');
        document.body.classList.remove('sidebar-open');

        // Animate with GSAP if available
        if (window.Animations?.isGsapLoaded()) {
            gsap.to(this.sidebar, {
                x: -260,
                duration: 0.3,
                ease: 'power2.in'
            });
        }
    }

    /**
     * Check if mobile and adjust sidebar
     */
    checkMobile() {
        if (window.innerWidth <= 1024) {
            this.close();
        } else {
            this.open();
        }
    }
}

// Initialize sidebar when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.sidebarInstance = new Sidebar();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Sidebar;
}
