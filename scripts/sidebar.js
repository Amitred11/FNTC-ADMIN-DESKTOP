document.addEventListener('DOMContentLoaded', () => {
    const sidebarPlaceholder = document.getElementById('sidebar-container');
    if (!sidebarPlaceholder) {
        console.error('Sidebar container not found!');
        return;
    }

    const currentPagePath = window.location.pathname;
    let pathPrefix = '.'; 

    if (currentPagePath.includes('/main/')) {
        pathPrefix = '..';
    } else if (currentPagePath.includes('/settings/') || currentPagePath.includes('/support/')) {
        pathPrefix = '..';
    }

    const sidebarPath = `${pathPrefix}/../components/sidebar.html`;

    const applyRolePermissions = async () => {
        try {
            const user = await window.electronAPI.getUserProfile();

            if (!user || !user.role) {
                console.error("Could not determine user role. Logging out.");
                window.electronAPI.logout(); 
                return;
            }

            const userRole = user.role;
            console.log(`Applying permissions for role: ${userRole}`);

            const sidebarButtons = document.querySelectorAll('.sidebar-btn');
            
            sidebarButtons.forEach(button => {
                const page = button.dataset.page;
                if (!page) return;

                const allowedRoles = permissions[page];

                if (allowedRoles && !allowedRoles.includes(userRole)) {
                    button.style.display = 'none'; // Hide button if role not allowed
                } else {
                    button.style.display = 'flex'; // Ensure button is visible otherwise
                }
            });

        } catch (error) {
            console.error('Failed to apply role permissions:', error);
            // Hide all restricted links as a fallback
            document.querySelectorAll('.sidebar-btn').forEach(btn => {
                const page = btn.dataset.page;
                if (page && permissions[page]) {
                    btn.style.display = 'none';
                }
            });
        }
    };

    fetch(sidebarPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch sidebar from: ${sidebarPath}`);
            }
            return response.text();
        })
        .then(data => {
            sidebarPlaceholder.innerHTML = data;

            // --- Path Correction Logic (No changes here) ---
            const sidebarLinks = sidebarPlaceholder.querySelectorAll('a.sidebar-btn');
            sidebarLinks.forEach(link => {
                const originalHref = link.getAttribute('href');
                if (originalHref && originalHref !== '#') {
                    link.setAttribute('href', `${pathPrefix}/../${originalHref}`);
                }
            });

            const logo = sidebarPlaceholder.querySelector('.logo');
            if (logo) {
                const originalSrc = logo.getAttribute('src');
                if (originalSrc) {
                    logo.setAttribute('src', `${pathPrefix}/../${originalSrc}`);
                }
            }

            // --- UPDATED: Logout button with confirmation ---
            const logoutButton = sidebarPlaceholder.querySelector('.logout');
            if (logoutButton) {
                logoutButton.addEventListener('click', async (event) => {
                    event.preventDefault(); 
                    
                    // Show a confirmation dialog before logging out
                    if (confirm('Are you sure you want to log out?')) {
                        console.log('Logout confirmed. Calling main process...');
                        try {
                            const result = await window.electronAPI.logout();
                            if (result.ok) {
                                console.log('Logout successful, redirected to login page.');
                            } else {
                                console.error('Logout failed:', result.message);
                            }
                        } catch (error) {
                            console.error('Error during logout:', error);
                        }
                    } else {
                        console.log('Logout cancelled by user.');
                    }
                });
            }

            // --- Hamburger menu logic (remains the same and should work with the CSS changes) ---
            const hamburger = document.getElementById('hamburger');
            const layout = document.getElementById('layout');
            if (hamburger && layout) {
                hamburger.addEventListener('click', () => {
                    layout.classList.toggle('sidebar-collapsed');
                });
            }

            const currentPage = document.body.getAttribute('data-page');
            const navLinks = document.querySelectorAll('.sidebar-btn');
            navLinks.forEach(link => {
                if (link.getAttribute('data-page') === currentPage) {
                    link.classList.add('active');
                }
            });
        })
        .catch(error => {
            console.error('Error loading the sidebar:', error);
            sidebarPlaceholder.innerHTML = `<p style="color: red;">${error.message}</p>`;
        });
});

// scripts/sidebar.js

document.addEventListener('DOMContentLoaded', () => {
    const permissions = {
        'dashboard': ['super_admin', 'collector', 'field_agent'],
        'subscriptions': ['super_admin'],
        'billing': ['super_admin', 'collector'],
        'joborder': ['super_admin', 'field_agent'],
        'support': ['super_admin', 'field_agent'],
        'livechats': ['super_admin'],
        'settings': ['super_admin', 'collector', 'field_agent'] // All can see settings, page itself can hide sections
    };

    // --- 2. LOGIC TO APPLY PERMISSIONS ---
    const applyRolePermissions = async () => {
        try {
            const user = await window.electronAPI.getUserProfile();

            if (!user || !user.role) {
                console.error("Could not determine user role. Hiding all protected links.");
                window.electronAPI.logout(); 
                return;
            }

            const userRole = user.role;
            console.log(`Applying permissions for role: ${userRole}`);

            const sidebarButtons = document.querySelectorAll('.sidebar-btn');
            
            sidebarButtons.forEach(button => {
                const page = button.dataset.page;
                if (!page) return;

                const allowedRoles = permissions[page];

                if (allowedRoles && !allowedRoles.includes(userRole)) {
                    button.style.display = 'none';
                } else {
                    button.style.display = 'flex';
                }
            });

        } catch (error) {
            console.error('Failed to apply role permissions:', error);
        }
    };

    // --- 3. INITIALIZATION ---
    const initSidebar = async () => {
        const sidebarContainer = document.getElementById('sidebar-container');
        if (!sidebarContainer) {
            console.error('Sidebar container not found.');
            return;
        }

        try {
            const response = await fetch('/components/sidebar.html');
            if (!response.ok) throw new Error('Sidebar component not found');
            
            const sidebarHTML = await response.text();
            sidebarContainer.innerHTML = sidebarHTML;

            await applyRolePermissions();

            const logoutButton = document.querySelector('.logout');
            if (logoutButton) {
                logoutButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.electronAPI.logout();
                });
            }

        } catch (error) {
            console.error('Failed to initialize sidebar:', error);
            sidebarContainer.innerHTML = '<p style="color:red; padding: 1rem;">Error loading sidebar.</p>';
        }
    };

    initSidebar();
});