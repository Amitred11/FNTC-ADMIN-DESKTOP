document.addEventListener('DOMContentLoaded', async () => {

    const ALLOWED_ROLES = ['admin'];
    let currentUserRole = null;

    function renderAccessDenied() {
    const layout = document.getElementById('layout');
    if (layout) {
        layout.style.display = 'none';
    }

    document.body.style.backgroundColor = '#FFFFFF';
    document.body.innerHTML = ''; 

    if (!document.getElementById('access-denied-container')) {
        const deniedContainer = document.createElement('div');
        deniedContainer.id = 'access-denied-container';
        deniedContainer.style.cssText = `
            text-align: center;
            padding: 40px 20px;
            width: 100vw; /* Use viewport width */
            height: 100vh; /* Use viewport height */
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            background-color: #FFFFFF; /* White background */
            position: fixed;
            top: 0;
            left: 0;
            z-index: 99999; /* Higher z-index to be safe */
            font-family: 'Poppins', sans-serif; /* Ensure consistent font */
        `;

        deniedContainer.innerHTML = `
            <div style="font-size: 6rem; color: #E53935; margin-bottom: 1.5rem;">
                <i class="ph-fill ph-hand-palm"></i>
            </div>
            <h1 style="color: #333; font-size: 3rem; margin: 0; font-weight: 600;">Access Denied</h1>
            <p style="font-size: 1.25rem; color: #6c757d; max-width: 450px; margin-top: 1rem; line-height: 1.6;">
                You do not have the required permissions to access this page.
            </p>
            <button id="go-back-btn" style="margin-top: 2.5rem; padding: 14px 28px; font-size: 1.1rem; cursor: pointer; border: none; background-color: #0A3D62; color: white; border-radius: 8px; font-weight: 500; transition: background-color 0.2s ease;">
                Return to Previous Page
            </button>
        `;
        document.body.appendChild(deniedContainer);

        const goBackButton = document.getElementById('go-back-btn');
        goBackButton.addEventListener('click', () => {
            history.back(); 
        });
        goBackButton.onmouseover = () => { goBackButton.style.backgroundColor = '#08304f'; };
        goBackButton.onmouseout = () => { goBackButton.style.backgroundColor = '#0A3D62'; };
    }
}
    try {
        const response = await window.electronAPI.getUserProfile();
        if (response && response.role) {
            currentUserRole = response.role;
        } else {
            throw new Error("Role not found in profile.");
        }
    } catch (e) {
        console.error("Critical security error: Could not fetch user profile.", e);
        renderAccessDenied();
        return;
    }

    if (!ALLOWED_ROLES.includes(currentUserRole)) {
        console.warn(`SECURITY: User with role '${currentUserRole}' attempted to access the page without permission.`);
        renderAccessDenied();
        return;
    }

    // --- PART 2: Application Setup ---
    const userListContainer = document.querySelector('.user-list');
    const userDetailsPanel = document.querySelector('.user-details-panel');
    const searchInput = document.getElementById('user-search-input');
    const headerContainer = document.getElementById('header-container');
    let selectedUserId = null;
    let searchDebounceTimer;
    const sidebar = document.getElementById('sidebar-container');
    const overlay = document.getElementById('sidebar-overlay');

    const api = {
        get: (endpoint) => window.electronAPI.apiGet(endpoint),
        post: (endpoint, body) => window.electronAPI.apiPost(endpoint, body),
        delete: (endpoint) => window.electronAPI.apiDelete(endpoint)
    };

    // --- PART 3: UI & Utility Functions ---
    const setupToggleButton = () => {
        const userListPanel = document.querySelector('.user-list-panel');
        const managementContainer = document.querySelector('.management-container');
        if (!userListPanel || !managementContainer) return;

        // Create and place the HIDE button inside the user list panel
        if (!document.getElementById('toggle-user-list-btn')) {
            const hideBtn = document.createElement('button');
            hideBtn.id = 'toggle-user-list-btn';
            hideBtn.title = 'Hide User List';
            hideBtn.innerHTML = `<i class="ph ph-list"></i>`;
            userListPanel.prepend(hideBtn);
            hideBtn.addEventListener('click', toggleUserListVisibility);
        }

        // Create and place the SHOW button before the management container
        if (!document.getElementById('show-user-list-btn')) {
            const showBtn = document.createElement('button');
            showBtn.id = 'show-user-list-btn';
            showBtn.title = 'Show User List';
            showBtn.innerHTML = `<i class="ph ph-list-dashes"></i>`;
            managementContainer.parentNode.insertBefore(showBtn, managementContainer);
            showBtn.addEventListener('click', toggleUserListVisibility);
        }
    };

    const toggleUserListVisibility = () => {
        const container = document.querySelector('.management-container');
        const showBtn = document.getElementById('show-user-list-btn');
        if (!container || !showBtn) return;
        const isCollapsed = container.classList.toggle('user-list-collapsed');
        showBtn.classList.toggle('visible', isCollapsed);
    };

    const getStatusBadgeClass = (status) => (status ? status.toLowerCase().replace(/_/g, '-') : 'inactive');
    const formatDate = (isoString) => isoString ? new Date(isoString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

    const createAvatar = (user, sizeClass = '') => {
        const container = document.createElement('div');
        container.className = `avatar-container ${sizeClass}`;
        if (user.photoUrl) {
            const img = document.createElement('img');
            img.src = user.photoUrl;
            img.alt = user.displayName;
            container.appendChild(img);
        } else {
            const initial = user.displayName ? user.displayName.charAt(0).toUpperCase() : '?';
            const colors = ['#4A90E2', '#50E3C2', '#F5A623', '#E74C3C', '#7E57C2'];
            const colorIndex = (user.displayName || '').length % colors.length;
            container.style.backgroundColor = colors[colorIndex];
            container.textContent = initial;
        }
        return container.outerHTML;
    };

    const renderBillingTable = (bills) => {
        if (!bills || bills.length === 0) return '<div class="no-data"><i class="ph-fill ph-receipt"></i><p>No billing history found.</p></div>';
        return `<table class="data-table"><thead><tr><th>Amount</th><th>Due Date</th><th>Status</th></tr></thead><tbody>${bills.map(bill => `<tr><td>₱${(bill.amount || 0).toFixed(2)}</td><td>${formatDate(bill.dueDate)}</td><td><span class="status-badge ${getStatusBadgeClass(bill.status)}">${bill.status}</span></td></tr>`).join('')}</tbody></table>`;
    };

    const renderTicketsTable = (tickets) => {
        if (!tickets || tickets.length === 0) return '<div class="no-data"><i class="ph-fill ph-ticket"></i><p>No support tickets found.</p></div>';
        return `<table class="data-table"><thead><tr><th>Subject</th><th>Last Updated</th><th>Status</th></tr></thead><tbody>${tickets.map(ticket => `<tr><td>${ticket.subject}</td><td>${formatDate(ticket.updatedAt)}</td><td><span class="status-badge ${getStatusBadgeClass(ticket.status)}">${ticket.status}</span></td></tr>`).join('')}</tbody></table>`;
    };

    // --- PART 4: Core Data Functions ---
    const renderUserList = (users) => {
        userListContainer.innerHTML = '';
        if (!users || users.length === 0) {
            userListContainer.innerHTML = '<p class="no-data">No users found.</p>';
            return;
        }
        users.forEach(user => {
            const userItem = document.createElement('li');
            userItem.className = 'user-item';
            userItem.dataset.userId = user._id;
            userItem.innerHTML = `${createAvatar(user)}<div class="user-info"><p class="user-name">${user.displayName}</p><p class="user-email">${user.email}</p></div><span class="status-badge ${getStatusBadgeClass(user.status)}">${user.status.replace('_', ' ')}</span>`;
            userListContainer.appendChild(userItem);
        });
    };

    const fetchAndDisplayUserDetails = async (userId) => {
        if (!userId) {
            userDetailsPanel.innerHTML = `<div class="no-data"><i class="ph-fill ph-users"></i><p>Select a user to see their details.</p></div>`;
            return;
        }
        selectedUserId = userId;
        document.querySelectorAll('.user-item.active').forEach(item => item.classList.remove('active'));
        document.querySelector(`.user-item[data-user-id="${userId}"]`)?.classList.add('active');
        userDetailsPanel.innerHTML = `<div class="no-data"><p>Loading details...</p></div>`;

        try {
            const response = await api.get(`/users/${userId}/details`);
            if (!response.ok) throw new Error(response.data.message || 'Failed to fetch details');
            const { user, activeSubscription, billingHistory, tickets } = response.data;

            const suspendButtonHtml = user.status === 'suspended' || user.status === 'deactivated'
                ? `<button class="action-btn unsuspend" data-action="unsuspend"><i class="ph ph-check-circle"></i> Reactivate</button>`
                : `<button class="action-btn suspend" data-action="suspend"><i class="ph ph-warning-circle"></i> Suspend</button>`;
            
            const subscriptionCardHtml = activeSubscription
                ? `<div class="info-item"><span class="info-label">Plan</span><span class="info-value">${activeSubscription.planId.name}</span></div><div class="info-item"><span class="info-label">Status</span><span class="info-value"><span class="status-badge ${getStatusBadgeClass(activeSubscription.status)}">${activeSubscription.status}</span></span></div>`
                : '<div class="no-data" style="padding: 24px;"><p>No Active Subscription.</p></div>';

            let accountStatusSectionHtml = '';
            if (user.status === 'suspended' && user.suspensionReason) {
                accountStatusSectionHtml = `
                <div class="details-section">
                    <h4>Account Status</h4>
                    <div class="info-card">
                        <div class="info-item">
                            <span class="info-label">Current Status</span>
                            <span class="info-value">
                                <span class="status-badge ${getStatusBadgeClass(user.status)}">${user.status.replace('_', ' ')}</span>
                            </span>
                        </div>
                        <div class="info-item reason">
                            <span class="info-label">Reason for Suspension</span>
                            <span class="info-value">${user.suspensionReason}</span>
                        </div>
                    </div>
                </div>`;
            }

            userDetailsPanel.innerHTML = `
                <div class="details-header">${createAvatar(user, 'details-avatar-container')}<h2 class="details-name">${user.displayName}</h2><p class="details-email">${user.email}</p></div>
                <nav class="details-tabs"><a class="tab-item active" data-target="overview">Overview</a><a class="tab-item" data-target="billing">Billing</a><a class="tab-item" data-target="tickets">Tickets</a></nav>
                <div id="overview" class="tab-content active">
                    <div class="details-section">
                        <h4>Quick Actions</h4>
                        <div class="quick-actions">
                            <button class="action-btn modem" data-action="modem"><i class="ph ph-wifi-high"></i> ${user.isModemInstalled ? 'Retrieve Modem' : 'Install Modem'}</button>
                            ${suspendButtonHtml}
                            <button class="action-btn delete" data-action="delete"><i class="ph ph-trash"></i> Delete</button>
                        </div>
                    </div>
                    ${accountStatusSectionHtml}
                    <div class="details-section">
                        <h4>Current Subscription</h4>
                        <div class="info-card">${subscriptionCardHtml}</div>
                    </div>
                    <div class="details-section">
                        <h4>Contact Information</h4>
                        <div class="info-card">
                            <div class="info-item"><span class="info-label">Mobile No.</span><span class="info-value">${user.profile?.mobileNumber || 'N/A'}</span></div>
                            <div class="info-item"><span class="info-label">Address</span><span class="info-value">${user.profile?.address || 'N/A'}</span></div>
                        </div>
                    </div>
                </div>
                <div id="billing" class="tab-content">${renderBillingTable(billingHistory)}</div>
                <div id="tickets" class="tab-content">${renderTicketsTable(tickets)}</div>
            `;
            initializeTabSwitching();
        } catch (error) {
            AppAlert.notify({ type: 'error', title: 'Loading Error', message: `Could not load user details: ${error.message}`});
            userDetailsPanel.innerHTML = `<div class="no-data error"><i class="ph-fill ph-x-circle"></i><p>Could not load user details.</p><small>${error.message}</small></div>`;
        }
    };

    const fetchUsers = async (query = '') => {
        try {
            const response = await api.get(`/users/search?query=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error(response.data.message || 'Failed to fetch users');
            const userList = response.data.data;
            renderUserList(userList);
            const isSelectedUserVisible = userList.some(user => user._id === selectedUserId);
            if (userList.length > 0 && (!selectedUserId || !isSelectedUserVisible)) {
                fetchAndDisplayUserDetails(userList[0]._id);
            } else if (userList.length === 0) {
                selectedUserId = null;
                userDetailsPanel.innerHTML = `<div class="no-data"><i class="ph-fill ph-users"></i><p>No users match your search.</p></div>`;
            } else if (selectedUserId && isSelectedUserVisible) {
                document.querySelector(`.user-item[data-user-id="${selectedUserId}"]`).classList.add('active');
            }
        } catch (error) {
            AppAlert.notify({ type: 'error', title: 'Fetch Error', message: `Failed to load users: ${error.message}` });
            userListContainer.innerHTML = `<p class="no-data error">Failed to load users.</p>`;
        }
    };

    // --- PART 5: Event Handlers & Initializers ---
    const initializeTabSwitching = () => {
        userDetailsPanel.querySelectorAll('.tab-item').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = tab.dataset.target;
                userDetailsPanel.querySelectorAll('.tab-item.active').forEach(t => t.classList.remove('active'));
                userDetailsPanel.querySelectorAll('.tab-content.active').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                userDetailsPanel.querySelector(`#${targetId}`).classList.add('active');
            });
        });
    };

    const handleToggleModem = async () => {
        try {
            await AppAlert.confirm({ title: "Confirm Action", message: "Are you sure you want to update the modem status?" });
            const response = await api.post(`/users/${selectedUserId}/toggle-modem`);
            if (!response.ok) throw new Error(response.data.message);
            AppAlert.notify({ type: 'success', title: 'Success', message: 'Modem status updated!' });
            await fetchAndDisplayUserDetails(selectedUserId);
        } catch (error) {
            if (error.message !== 'Confirmation cancelled.') {
                 AppAlert.notify({ type: 'error', title: 'Error', message: error.message });
            }
        }
    };

    const handleStatusChange = async (status) => {
        const verb = status === 'suspended' ? 'suspend' : 'reactivate';
        const body = { status };

        try {
            if (status === 'suspended') {
                const reason = await AppAlert.prompt({
                    type: 'warning',
                    title: 'Suspend User',
                    message: 'Please provide a reason for suspending this user. This will be visible on their profile.',
                    confirmText: 'Suspend Account',
                    inputPlaceholder: 'e.g., Violation of terms of service...',
                    isRequired: true,
                    requiredMessage: 'A reason is required to suspend a user.'
                });
                body.reason = reason; 
            } else {
                await AppAlert.confirm({
                    type: 'info',
                    title: 'Confirm Reactivation',
                    message: 'Are you sure you want to reactivate this user?',
                    confirmText: 'Reactivate'
                });
            }
            
            const response = await api.post(`/users/${selectedUserId}/status`, body);
            if (!response.ok) throw new Error(response.data.message);
            
            AppAlert.notify({ type: 'success', title: 'Success', message: `User has been ${status}.` });
            
            await Promise.all([
                fetchUsers(searchInput.value),
                fetchAndDisplayUserDetails(selectedUserId)
            ]);

        } catch (error) {
            if (error.message !== 'Prompt cancelled.' && error.message !== 'Confirmation cancelled.') {
                AppAlert.notify({ type: 'error', title: 'Action Failed', message: error.message });
            } else {
                console.log('User cancelled the action.'); 
            }
        }
    };
    
    const handleDeleteUser = async () => {
        try {
            await AppAlert.confirm({ type: 'danger', title: "Delete User", message: 'WARNING: This will permanently delete the user and cannot be undone.' });
            const response = await api.delete(`/users/${selectedUserId}`);
            if (!response.ok) throw new Error(response.data.message);
            AppAlert.notify({ type: 'success', title: 'User Deleted', message: 'The user has been permanently removed.' });
            selectedUserId = null;
            await fetchUsers();
        } catch (error) {
             if (error.message !== 'Confirmation cancelled.') {
                AppAlert.notify({ type: 'error', title: 'Error', message: error.message });
            }
        }
    };

    const initializeActionListeners = () => {
        userDetailsPanel.addEventListener('click', async (event) => {
            const actionButton = event.target.closest('[data-action]');
            if (!actionButton || !selectedUserId) return;
            const action = actionButton.dataset.action;
            const actions = {
                'modem': handleToggleModem,
                'suspend': () => handleStatusChange('suspended'),
                'unsuspend': () => handleStatusChange('active'),
                'delete': handleDeleteUser,
            };
            if (actions[action]) await actions[action]();
        });
    };

    const loadHeader = async () => {
        try {
            const response = await fetch('../../components/header.html');
            if (!response.ok) throw new Error('Header component not found');
            headerContainer.innerHTML = await response.text();
            const mobileMenuButton = document.getElementById('mobile-menu-button');

            if (mobileMenuButton && sidebar && overlay) {
                mobileMenuButton.addEventListener('click', () => {
                    sidebar.classList.toggle('mobile-visible');
                });

                overlay.addEventListener('click', () => {
                    sidebar.classList.remove('mobile-visible');
                });
            }
            if (window.initializeHeader) {
                await window.initializeHeader();
                if (window.setHeader) {
                    window.setHeader('User Management', 'View, search, and manage system users.', true);
                }
            }
        } catch (error) {
            console.error("Failed to load header:", error);
            headerContainer.innerHTML = "<p>Error loading header</p>";
        }
    };

    const initializeApp = async () => {
        await loadHeader();
        setupToggleButton();
        userListContainer.addEventListener('click', (e) => {
            const userItem = e.target.closest('.user-item');
            if (userItem) fetchAndDisplayUserDetails(userItem.dataset.userId);
        });
        searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => fetchUsers(searchInput.value), 300);
        });
        initializeActionListeners();
        fetchUsers();
    };

    initializeApp();
});