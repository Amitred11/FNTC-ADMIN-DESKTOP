// scripts/components/sidebar.js

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURATION & STATE ---
    const permissions = {
        'dashboard': [ 'admin', 'collector', 'field_agent'],
        'subscriptions': ['admin'],
        'billing': ['admin', 'collector'],
        'joborder': ['admin'],
        'fieldagent': ['field_agent'],
        'support': ['admin', 'field_agent'],
        'livechats': ['admin'],
        'settings': ['admin','collector', 'field_agent']
    };
    const sidebarStateKey = 'sidebarCollapsedState';
    let currentUserRole = null;

    // --- 2. HELPER FUNCTIONS ---
    const applyRolePermissions = async () => {
        try {
            const user = await window.electronAPI.getUserProfile();
            if (!user || !user.role) {
                console.error("Could not determine user role. Logging out for security.");
                await window.electronAPI.logout();
                return;
            }
            currentUserRole = user.role;
            document.querySelectorAll('.sidebar-btn').forEach(button => {
                const page = button.dataset.page;
                if (!page) return;
                const allowedRoles = permissions[page];
                if (allowedRoles && !allowedRoles.includes(currentUserRole)) {
                    button.style.display = 'none';
                } else {
                    button.style.display = 'flex';
                }
            });
        } catch (error) {
            console.error('Failed to apply role permissions:', error);
            document.querySelectorAll('.sidebar-btn[data-page]').forEach(button => {
                if (permissions[button.dataset.page]) {
                    button.style.display = 'none';
                }
            });
        }
    };

    const setActiveLink = () => {
        const currentPage = document.body.getAttribute('data-page');
        if (!currentPage) return;
        const activeLink = document.querySelector(`.sidebar-btn[data-page="${currentPage}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    };

    const attachEventListeners = () => {
        // --- Get Element References ---
        const hamburger = document.getElementById('hamburger');
        const layout = document.getElementById('layout');
        const logoutButton = document.getElementById('logout-btn');

        // --- Hamburger Menu Listener ---
        if (hamburger && layout) {
            hamburger.addEventListener('click', () => {
                const isCollapsed = layout.classList.toggle('sidebar-collapsed');
                localStorage.setItem(sidebarStateKey, isCollapsed ? 'true' : 'false');
            });
        }

        // --- Navigation Link Click Handler ---
        document.querySelectorAll('.sidebar-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const page = button.dataset.page;
                if (!page) return;

                const requiredRoles = permissions[page];
                const isRestricted = requiredRoles && !requiredRoles.includes(currentUserRole);

                if (isRestricted) {
                    event.preventDefault();
                    if (AppAlert && AppAlert.notify) {
                        AppAlert.notify({
                            type: 'error',
                            title: 'Permission Denied',
                            message: `You do not have the necessary permissions to access this page.`
                        });
                    } else {
                        console.error(`Permission denied for ${page}. AppAlert.notify not available.`);
                    }
                }
            });
        });

        if (logoutButton) {
            logoutButton.addEventListener('click', async (event) => {
                event.preventDefault();
                
                try {
                    await AppAlert.confirm({
                        type: 'warning',
                        title: 'Confirm Logout',
                        message: 'Are you sure you want to log out of your account?',
                        confirmText: 'Log Out',
                        cancelText: 'Cancel'
                    });
                    try {
                        await window.electronAPI.logout();
                    } catch (apiError) {
                        console.error('Logout API call failed:', apiError);
                        AppAlert.notify({
                            type: 'error',
                            title: 'Logout Failed',
                            message: 'Could not log out. Please try again.'
                        });
                    }

                } catch (error) {
                    console.log("Logout was cancelled by the user.");
                }
            });
        }
    };

    // --- 3. INITIALIZATION ---
    const initSidebar = async () => {
        const sidebarContainer = document.getElementById('sidebar-container');
        if (!sidebarContainer) {
            console.error('Sidebar container not found!');
            return;
        }

        if (localStorage.getItem(sidebarStateKey) === 'true') {
            document.getElementById('layout')?.classList.add('sidebar-collapsed');
        }

        try {
            const response = await fetch('../../components/sidebar.html');
            if (!response.ok) {
                throw new Error(`Failed to fetch sidebar component. Status: ${response.status}`);
            }
            sidebarContainer.innerHTML = await response.text();
            await applyRolePermissions();
            setActiveLink();
            attachEventListeners();
        } catch (error) {
            console.error('Failed to initialize sidebar:', error);
            sidebarContainer.innerHTML = `<p style="color:red; padding:1rem;">Error: Could not load sidebar.</p>`;
        }
    };

    initSidebar();
});