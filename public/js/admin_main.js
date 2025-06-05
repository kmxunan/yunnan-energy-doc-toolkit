// public/js/admin_main.js

let currentUserForAdmin = null;
let currentAdminSectionId = 'dashboardSection';
const initializedModules = {
    'dashboardSection': true, // Dashboard is simple, consider it initialized by default or has no specific JS init.
    'documentManagementSection': false,
    'documentUploadSection': false,
    'classificationManagementSection': false,
    'userManagementSection': false
};

function setupAdminNavigation() {
    const navLinks = document.querySelectorAll('#adminSidebar .nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(event) {
            if (this.getAttribute('href') && this.getAttribute('href').startsWith('#')) {
                event.preventDefault();
                const sectionId = this.getAttribute('href').substring(1);
                // console.log(`[admin_main.js] Nav link clicked for section: ${sectionId}`);
                showAdminSection(sectionId);

                navLinks.forEach(l => l.classList.remove('active'));
                this.classList.add('active');

                const adminSidebar = document.getElementById('adminSidebar');
                if (adminSidebar && window.innerWidth < 768 && adminSidebar.classList.contains('active')) {
                    adminSidebar.classList.remove('active');
                }
            }
        });
    });
}

function showAdminSection(sectionId) {
    // console.log(`[admin_main.js] Attempting to show section: ${sectionId}`);
    const sections = document.querySelectorAll('#adminDashboard .main-content .section');
    let sectionFound = false;
    sections.forEach(section => {
        if (section.id === sectionId) {
            section.classList.add('active');
            section.classList.remove('d-none');
            sectionFound = true;
            // console.log(`[admin_main.js] Section ${section.id} is now active.`);
        } else {
            section.classList.remove('active');
            section.classList.add('d-none');
        }
    });

    if (sectionFound) {
        currentAdminSectionId = sectionId;
        // console.log(`[admin_main.js] Checking initialization for section: ${sectionId}. Initialized: ${initializedModules[sectionId]}`);
        if (!initializedModules[sectionId]) {
            // console.log(`[admin_main.js] Module for section ${sectionId} not yet initialized. Attempting init.`);
            if (sectionId === 'documentManagementSection') {
                if (typeof AdminDocuments !== 'undefined' && typeof AdminDocuments.init === 'function') {
                    // console.log('[admin_main.js] Initializing AdminDocuments module (for listing).');
                    AdminDocuments.init();
                    initializedModules[sectionId] = true;
                } else { console.warn(`[admin_main.js] AdminDocuments.init not found for ${sectionId}`); }
            } else if (sectionId === 'classificationManagementSection') {
                if (typeof AdminClassifications !== 'undefined' && typeof AdminClassifications.init === 'function') {
                    // console.log('[admin_main.js] Initializing AdminClassifications module.');
                    AdminClassifications.init();
                    initializedModules[sectionId] = true;
                } else { console.warn(`[admin_main.js] AdminClassifications.init not found for ${sectionId}`); }
            } else if (sectionId === 'userManagementSection') {
                if (typeof AdminUsers !== 'undefined' && typeof AdminUsers.init === 'function') {
                    // console.log('[admin_main.js] Initializing AdminUsers module.');
                    AdminUsers.init();
                    initializedModules[sectionId] = true;
                } else { console.warn(`[admin_main.js] AdminUsers.init not found for ${sectionId}`); }
            } else if (sectionId === 'documentUploadSection') {
                if (typeof AdminDocuments !== 'undefined' && typeof AdminDocuments.initUploadForm === 'function') {
                    // console.log('[admin_main.js] Initializing Document Upload Form in AdminDocuments module.');
                    AdminDocuments.initUploadForm();
                    initializedModules[sectionId] = true;
                } else { console.warn(`[admin_main.js] AdminDocuments.initUploadForm not found for ${sectionId}`); }
            } else if (sectionId === 'dashboardSection') {
                // console.log('[admin_main.js] Dashboard section shown. No specific module init or already handled.');
                initializedModules[sectionId] = true;
            } else {
                // console.warn(`[admin_main.js] No specific init logic for section ${sectionId} or module not found.`);
            }
        } else {
            // console.log(`[admin_main.js] Module for section ${sectionId} already initialized. May need refresh logic.`);
            // Example: if already initialized, call a refresh function if it exists
            if (sectionId === 'documentManagementSection' && typeof AdminDocuments !== 'undefined' && typeof AdminDocuments.loadDocuments === 'function') {
                // AdminDocuments.loadDocuments(); // Or a more specific refresh function
            }
        }
    } else {
        console.warn(`[admin_main.js] Admin section with ID ${sectionId} not found. Defaulting to dashboard.`);
        const dashboard = document.getElementById('dashboardSection');
        if (dashboard) {
            dashboard.classList.add('active');
            dashboard.classList.remove('d-none');
            currentAdminSectionId = 'dashboardSection';
            initializedModules['dashboardSection'] = true; // Mark dashboard as handled
        }
    }
}

function updateUIBasedOnAuthState(user) {
    // console.log('[admin_main.js] updateUIBasedOnAuthState called. User data received (raw):', user);
    // if(user && typeof user === 'object') console.log('[admin_main.js] updateUIBasedOnAuthState user keys:', Object.keys(user).join(', '));

    const loginSection = document.getElementById('loginSection');
    const adminDashboard = document.getElementById('adminDashboard');
    const adminUsernameDisplay = document.getElementById('adminUsernameDisplay');
    const adminAuthStatusTopEl = document.getElementById('adminAuthStatus');
    const mobileLogoutButton = document.getElementById('mobileLogoutButton');
    const adminSidebarLogoutButton = document.getElementById('adminLogoutButton');
    const adminSidebar = document.getElementById('adminSidebar');

    if (user && typeof user === 'object' && user.id !== undefined && user.username && user.role === 'admin') {
        currentUserForAdmin = { ...user };
        // console.log('[admin_main.js] Admin user confirmed:', currentUserForAdmin.username, 'Role:', currentUserForAdmin.role);
        if (loginSection) {
            loginSection.classList.remove('active');
            loginSection.classList.add('d-none');
        }
        if (adminDashboard) {
            adminDashboard.classList.remove('d-none');
            adminDashboard.classList.add('active');
        }
        if (adminSidebar) {
            adminSidebar.classList.remove('d-none'); // Make sure sidebar is visible
        }

        const welcomeText = `欢迎, ${window.escapeHTML(user.username)}`;
        if (adminUsernameDisplay) {
            adminUsernameDisplay.textContent = window.escapeHTML(user.username);
        }
        if (adminAuthStatusTopEl) {
            adminAuthStatusTopEl.textContent = welcomeText;
        }
        const mobileAuthStatusEl = document.getElementById('mobileAuthStatus');
        if (mobileAuthStatusEl) mobileAuthStatusEl.textContent = welcomeText;

        if (mobileLogoutButton) mobileLogoutButton.classList.remove('d-none');
        if(adminSidebarLogoutButton) adminSidebarLogoutButton.classList.remove('d-none');

        // Determine which section to show. If currentAdminSectionId is still default or invalid, show dashboard.
        const activeNavLink = document.querySelector('#adminSidebar .nav-link.active');
        let sectionToDisplay = currentAdminSectionId || 'dashboardSection';
        if (activeNavLink && activeNavLink.getAttribute('href') && activeNavLink.getAttribute('href').startsWith('#')) {
            sectionToDisplay = activeNavLink.getAttribute('href').substring(1);
        }
        // console.log(`[admin_main.js] updateUI: Attempting to show section: ${sectionToDisplay}`);
        showAdminSection(sectionToDisplay);

    } else {
        // console.log('[admin_main.js] User not admin or not logged in, or user data invalid. Showing login section.');
        // console.log('[admin_main.js] Invalid user object for UI update:', user);
        currentUserForAdmin = null;
        if (loginSection) {
            loginSection.classList.add('active');
            loginSection.classList.remove('d-none');
        }
        if (adminDashboard) {
            adminDashboard.classList.add('d-none');
            adminDashboard.classList.remove('active');
        }
        if (adminSidebar) {
            adminSidebar.classList.add('d-none'); // Hide sidebar
            adminSidebar.classList.remove('active');
        }
        if (adminUsernameDisplay) adminUsernameDisplay.textContent = '';
        if (adminAuthStatusTopEl) adminAuthStatusTopEl.textContent = '未登录';
        const mobileAuthStatusEl = document.getElementById('mobileAuthStatus');
        if (mobileAuthStatusEl) mobileAuthStatusEl.textContent = '请登录';

        const logoutButtons = document.querySelectorAll('#logoutButton, #adminLogoutButton, #mobileLogoutButton');
        logoutButtons.forEach(btn => { if(btn) btn.classList.add('d-none'); });

        for (const key in initializedModules) {
            initializedModules[key] = false;
        }
        initializedModules['dashboardSection'] = true; // Dashboard doesn't need re-init
    }
}

document.addEventListener('userLoggedIn', (event) => {
    // console.log('[admin_main.js] 捕获到 userLoggedIn 事件。 Event detail (raw):', event.detail);
    // if (event.detail && typeof event.detail === 'object') {
    //     console.log('[admin_main.js] event.detail keys:', Object.keys(event.detail).join(', '));
    //     console.log('[admin_main.js] event.detail.id:', event.detail.id, 'typeof:', typeof event.detail.id);
    //     console.log('[admin_main.js] event.detail.username:', event.detail.username, 'typeof:', typeof event.detail.username);
    //     console.log('[admin_main.js] event.detail.role:', event.detail.role, 'typeof:', typeof event.detail.role);
    // }

    if (event.detail && typeof event.detail === 'object' &&
        event.detail.id !== undefined && event.detail.username && event.detail.role) {
        if (event.detail.role === 'admin') {
            // console.log('[admin_main.js] userLoggedIn: Admin user confirmed. Updating UI with user:', JSON.stringify(event.detail));
            updateUIBasedOnAuthState(event.detail);
        } else {
            // console.warn('[admin_main.js] userLoggedIn: 用户已登录但不是管理员。Role:', event.detail.role, '将显示错误并尝试登出。');
            if (typeof window.showToast === 'function') {
                window.showToast('您没有管理员权限访问此页面。即将登出...', 'error', 4000);
            }
            setTimeout(() => {
                if (typeof handleLogout === 'function') {
                    handleLogout();
                } else {
                    console.error("[admin_main.js] handleLogout function not found for automatic logout of non-admin.");
                    localStorage.removeItem('token');
                    updateUIBasedOnAuthState(null);
                }
            }, 3000);
            updateUIBasedOnAuthState(null);
        }
    } else {
        console.warn('[admin_main.js] userLoggedIn 事件的 detail 无效或缺少关键字段, event.detail:', event.detail, '将显示登录页。');
        updateUIBasedOnAuthState(null);
    }
});

document.addEventListener('userLoggedOut', () => {
    // console.log('[admin_main.js] 捕获到 userLoggedOut 事件。更新UI以显示登录界面。');
    for (const key in initializedModules) {
        initializedModules[key] = false;
    }
    initializedModules['dashboardSection'] = true;
    currentAdminSectionId = 'dashboardSection';
    updateUIBasedOnAuthState(null);
});


document.addEventListener('DOMContentLoaded', () => {
    // console.log("Admin Main JS: DOMContentLoaded");
    setupAdminNavigation();

    // auth.js's DOMContentLoaded listener now calls checkAuthState and sets window.authStateCheckedByAuthCheck.
    // So, admin_main.js relies on the events dispatched by checkAuthState.

    const sidebarToggle = document.getElementById('sidebarToggle');
    const adminSidebar = document.getElementById('adminSidebar');
    if (sidebarToggle && adminSidebar) {
        sidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            adminSidebar.classList.toggle('active');
        });
    }
    // console.log("[admin_main.js] DOMContentLoaded: Event listeners set up. Initial UI state will be set by auth events.");
});
