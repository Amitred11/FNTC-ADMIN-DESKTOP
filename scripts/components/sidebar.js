// scripts/components/sidebar.js

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURATION & STATE ---

    const permissions = {
        // --- FIX: Added the 'admin' role to all permissions lists ---
        'dashboard': ['super_admin', 'admin', 'collector', 'field_agent'],
        'subscriptions': ['super_admin', 'admin'],
        'billing': ['super_admin', 'admin', 'collector'],
        'joborder': ['super_admin', 'admin', 'field_agent'],
        'support': ['super_admin', 'admin', 'field_agent'],
        'livechats': ['super_admin', 'admin'],
        'settings': ['super_admin', 'admin', 'collector', 'field_agent']
    };

    const sidebarStateKey = 'sidebarCollapsedState';

    // --- 2. HELPER FUNCTIONS ---

    /**
     * Applies the correct permissions to sidebar links based on the user's role.
     */
    const applyRolePermissions = async () => {
        try {
            const user = await window.electronAPI.getUserProfile();
            if (!user || !user.role) {
                console.error("Could not determine user role. Logging out for security.");
                await window.electronAPI.logout();
                return;
            }

            const userRole = user.role;
            console.log(`Applying permissions for role: ${userRole}`);

            document.querySelectorAll('.sidebar-btn').forEach(button => {
                const page = button.dataset.page;
                if (!page) return;

                const allowedRoles = permissions[page];
                if (allowedRoles && !allowedRoles.includes(userRole)) {
                    button.style.display = 'none'; // Hide button if role not allowed
                } else {
                    button.style.display = 'flex'; // Ensure button is visible
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

    /**
     * Highlights the sidebar link corresponding to the current page.
     */
    const setActiveLink = () => {
        const currentPage = document.body.getAttribute('data-page');
        if (!currentPage) return;

        const activeLink = document.querySelector(`.sidebar-btn[data-page="${currentPage}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    };

    /**
     * Attaches all necessary event listeners for sidebar interactions.
     */
    const attachEventListeners = () => {
        const hamburger = document.getElementById('hamburger');
        const layout = document.getElementById('layout');
        const logoutButton = document.querySelector('.logout');

        if (hamburger && layout) {
            hamburger.addEventListener('click', () => {
                const isCollapsed = layout.classList.toggle('sidebar-collapsed');
                localStorage.setItem(sidebarStateKey, isCollapsed ? 'true' : 'false');
            });
        }

        if (logoutButton) {
            logoutButton.addEventListener('click', async (event) => {
                event.preventDefault();
                if (confirm('Are you sure you want to log out?')) {
                    await window.electronAPI.logout();
                }
            });
        }
    };

    // --- 3. INITIALIZATION ---

    /**
     * The main function to set up the sidebar.
     */
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
            sidebarContainer.innerHTML = `<p style="color:red; padding:1rem;">Error: Could not load sidebar. Check file path.</p>`;
        }
    };

    initSidebar();
});