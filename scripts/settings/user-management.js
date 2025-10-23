document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selection ---
    const userListContainer = document.querySelector('.user-list');
    const userDetailsPanel = document.querySelector('.user-details-panel');
    const searchInput = document.getElementById('user-search-input');
    const headerContainer = document.getElementById('header-container');

    // --- State Management ---
    let selectedUserId = null;
    let searchDebounceTimer;

    // --- API Interface ---
    const api = {
        get: (endpoint) => window.electronAPI.apiGet(endpoint),
        post: (endpoint, body) => window.electronAPI.apiPost(endpoint, body),
        delete: (endpoint) => window.electronAPI.apiDelete(endpoint)
    };
    
    // =================================================================
    // UI SETUP for Toggle Buttons
    // =================================================================
    const setupToggleButton = () => {
        const userListPanel = document.querySelector('.user-list-panel');
        const headerLeft = document.querySelector('.header-left');
        if (!userListPanel || !headerLeft) return;

        // --- Button to HIDE the list ---
        if (!document.getElementById('toggle-user-list-btn')) {
            const hideBtn = document.createElement('button');
            hideBtn.id = 'toggle-user-list-btn';
            hideBtn.title = 'Hide User List';
            hideBtn.innerHTML = `<i class="ph ph-list"></i>`;
            userListPanel.prepend(hideBtn);
            hideBtn.addEventListener('click', toggleUserListVisibility);
        }
        
        // --- Button to SHOW the list (in the header) ---
        if (!document.getElementById('show-user-list-btn')) {
            const showBtn = document.createElement('button');
            showBtn.id = 'show-user-list-btn';
            showBtn.title = 'Show User List';
            showBtn.innerHTML = `<i class="ph ph-list-dashes"></i>`;
            // Prepend to header-left to place it at the start
            headerLeft.prepend(showBtn);
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

    // --- Utility & Renderer Functions ---
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
        return `
            <table class="data-table">
                <thead><tr><th>Amount</th><th>Due Date</th><th>Status</th></tr></thead>
                <tbody>
                    ${bills.map(bill => `
                        <tr>
                            <td>₱${(bill.amount || 0).toFixed(2)}</td>
                            <td>${formatDate(bill.dueDate)}</td>
                            <td><span class="status-badge ${getStatusBadgeClass(bill.status)}">${bill.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    };

    const renderTicketsTable = (tickets) => {
        if (!tickets || tickets.length === 0) return '<div class="no-data"><i class="ph-fill ph-ticket"></i><p>No support tickets found.</p></div>';
        return `
            <table class="data-table">
                <thead><tr><th>Subject</th><th>Last Updated</th><th>Status</th></tr></thead>
                <tbody>
                    ${tickets.map(ticket => `
                        <tr>
                            <td>${ticket.subject}</td>
                            <td>${formatDate(ticket.updatedAt)}</td>
                            <td><span class="status-badge ${getStatusBadgeClass(ticket.status)}">${ticket.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    };

    // --- Core Data Functions ---
    const renderUserList = (users) => {
        userListContainer.innerHTML = '';
        if (!users || users.length === 0) {
            userListContainer.innerHTML = '<p class="no-data">No users found.</p>';
            return;
        }
        users.forEach(user => {
            const statusClass = getStatusBadgeClass(user.status);
            const avatarHtml = createAvatar(user);
            const userItem = document.createElement('li');
            userItem.className = 'user-item';
            userItem.dataset.userId = user._id;
            userItem.innerHTML = `
                ${avatarHtml}
                <div class="user-info">
                    <p class="user-name">${user.displayName}</p>
                    <p class="user-email">${user.email}</p>
                </div>
                <span class="status-badge ${statusClass}">${user.status.replace('_', ' ')}</span>
            `;
            userListContainer.appendChild(userItem);
        });
    };

    const fetchAndDisplayUserDetails = async (userId) => {
        if (!userId) {
            userDetailsPanel.innerHTML = `<div class="no-data"><i class="ph-fill ph-users"></i><p>Select a user to see their details.</p></div>`;
            return;
        }
        selectedUserId = userId;
        userDetailsPanel.innerHTML = `<div class="no-data"><p>Loading details...</p></div>`;

        try {
            const response = await api.get(`/users/${userId}/details`);
            if (!response.ok) throw new Error(response.data.message || 'Failed to fetch details');

            const { user, activeSubscription, billingHistory, tickets } = response.data;
            const avatarHtml = createAvatar(user, 'details-avatar-container');

            const suspendButtonHtml = user.status === 'suspended' || user.status === 'deactivated'
                ? `<button class="action-btn unsuspend" data-action="unsuspend"><i class="ph ph-check-circle"></i> Reactivate</button>`
                : `<button class="action-btn suspend" data-action="suspend"><i class="ph ph-warning-circle"></i> Suspend</button>`;

            const subscriptionCardHtml = activeSubscription
                ? `<div class="info-item"><span class="info-label">Plan</span><span class="info-value">${activeSubscription.planId.name}</span></div><div class="info-item"><span class="info-label">Status</span><span class="info-value"><span class="status-badge ${getStatusBadgeClass(activeSubscription.status)}">${activeSubscription.status}</span></span></div>`
                : '<div class="no-data" style="padding: 24px;"><p>No Active Subscription.</p></div>';

            // --- *** DATA FETCHING FIX IS HERE *** ---
            userDetailsPanel.innerHTML = `
                <div class="details-header">
                    ${avatarHtml}
                    <h2 class="details-name">${user.displayName}</h2>
                    <p class="details-email">${user.email}</p>
                </div>
                <nav class="details-tabs">
                    <a class="tab-item active" data-target="overview">Overview</a>
                    <a class="tab-item" data-target="billing">Billing</a>
                    <a class="tab-item" data-target="tickets">Tickets</a>
                </nav>
                <div id="overview" class="tab-content active">
                    <div class="details-section">
                        <h4>Quick Actions</h4>
                        <div class="quick-actions">
                            <button class="action-btn modem" data-action="modem"><i class="ph ph-wifi-high"></i> ${user.isModemInstalled ? 'Retrieve Modem' : 'Install Modem'}</button>
                            ${suspendButtonHtml}
                            <button class="action-btn delete" data-action="delete"><i class="ph ph-trash"></i> Delete</button>
                        </div>
                    </div>
                    <div class="details-section">
                        <h4>Current Subscription</h4>
                        <div class="info-card">${subscriptionCardHtml}</div>
                    </div>
                    <div class="details-section">
                        <h4>Contact Information</h4>
                        <div class="info-card">
                            <div class="info-item"><span class="info-label">Mobile No.</span><span class="info-value">${user.profile?.mobileNumber || 'N/A'}</span></div>
                            <div class="info-item"><span class="info-label">Address</span><span class="info-value">${user.profile?.address || 'N/A'} Rodriguez, Rizal</span></div>
                        </div>
                    </div>
                </div>
                <div id="billing" class="tab-content">${renderBillingTable(billingHistory)}</div>
                <div id="tickets" class="tab-content">${renderTicketsTable(tickets)}</div>
            `;
            initializeTabSwitching();
        } catch (error) {
            console.error('Error fetching user details:', error);
            userDetailsPanel.innerHTML = `<div class="no-data error"><p>Could not load user details.</p></div>`;
        }
    };

    const fetchUsers = async (query = '') => {
        try {
            const response = await api.get(`/users/search?query=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Failed to fetch users');
            const userList = response.data.data;
            renderUserList(userList);
            
            const isSelectedUserVisible = userList.some(user => user._id === selectedUserId);

            if (userList.length > 0 && !isSelectedUserVisible) {
                handleUserSelection(userList[0]._id);
            } else if (userList.length === 0) {
                 userDetailsPanel.innerHTML = `<div class="no-data"><i class="ph-fill ph-users"></i><p>No users match your search.</p></div>`;
            } else if (selectedUserId && isSelectedUserVisible) {
                document.querySelector(`.user-item[data-user-id="${selectedUserId}"]`).classList.add('active');
            }
        } catch (error) {
            console.error("Fetch users error:", error);
            userListContainer.innerHTML = `<p class="no-data error">Failed to load users.</p>`;
        }
    };

    // --- Event Handlers & Initializers ---
    const handleUserSelection = (userId) => {
        document.querySelectorAll('.user-item.active').forEach(item => item.classList.remove('active'));
        document.querySelector(`.user-item[data-user-id="${userId}"]`)?.classList.add('active');
        fetchAndDisplayUserDetails(userId);
    };

    const initializeTabSwitching = () => {
        const tabs = userDetailsPanel.querySelectorAll('.tab-item');
        const contents = userDetailsPanel.querySelectorAll('.tab-content');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = tab.dataset.target;
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                userDetailsPanel.querySelector(`#${targetId}`).classList.add('active');
            });
        });
    };
    
    const initializeActionListeners = () => {
        userDetailsPanel.addEventListener('click', async (event) => {
            const actionButton = event.target.closest('[data-action]');
            if (!actionButton || !selectedUserId) return;
            const action = actionButton.dataset.action;
            const actions = {
                'modem': handleToggleModem,
                'suspend': () => handleStatusChange('suspended', 'User suspended by administrator.'),
                'unsuspend': () => handleStatusChange('active', 'User reactivated by administrator.'),
                'delete': handleDeleteUser,
            };
            if (actions[action]) await actions[action]();
        });
    };

    const handleToggleModem = async () => {
        if (!await window.AppAlert.confirm({ title: "Confirm Action", message: "Are you sure you want to update the modem status?" })) return;
        try {
            const response = await api.post(`/users/${selectedUserId}/toggle-modem`);
            if (!response.ok) throw new Error(response.data.message);
            await fetchAndDisplayUserDetails(selectedUserId);
        } catch (error) {
            window.AppAlert.notify({ type: 'error', title: 'Error', message: error.message });
        }
    };

    const handleStatusChange = async (status, reason) => {
        const verb = status === 'suspended' ? 'suspend' : 'reactivate';
        if (!await window.AppAlert.confirm({ title: `Confirm ${verb}`, message: `Are you sure you want to ${verb} this user?` })) return;

        try {
            const response = await api.post(`/users/${selectedUserId}/status`, { status, reason });
            if (!response.ok) throw new Error(response.data.message);
            window.AppAlert.notify({ type: 'success', title: 'Success', message: `User has been ${status}.` });
            await Promise.all([
                fetchUsers(searchInput.value),
                fetchAndDisplayUserDetails(selectedUserId)
            ]);
        } catch (error) {
            window.AppAlert.notify({ type: 'error', title: 'Error', message: error.message });
        }
    };
    
    const handleDeleteUser = async () => {
        if (!await window.AppAlert.confirm({ type: 'danger', title: "Delete User", message: 'WARNING: This will permanently delete the user. This action cannot be undone.' })) return;
        try {
            const response = await api.delete(`/users/${selectedUserId}`);
            if (!response.ok) throw new Error(response.data.message);
            window.AppAlert.notify({ type: 'success', title: 'User Deleted', message: 'The user has been permanently removed.' });
            selectedUserId = null;
            await fetchUsers();
        } catch (error) {
            window.AppAlert.notify({ type: 'error', title: 'Error', message: error.message });
        }
    };

    const loadHeader = async () => {
        try {
            const response = await fetch('../../components/header.html');
            if (!response.ok) throw new Error('Header component not found');
            headerContainer.innerHTML = await response.text();
            if (window.initializeHeader) {
                window.initializeHeader();
                if (window.setHeader) {
                    window.setHeader('User Management', 'View, search, and manage system users.', true);
                }
            }
        } catch(error) {
            console.error("Failed to load header:", error);
            headerContainer.innerHTML = "<p>Error loading header</p>";
        }
    };

    const initializeApp = async () => {
        await loadHeader();
        setupToggleButton(); // Initialize the collapse/expand buttons
        userListContainer.addEventListener('click', (e) => {
            const userItem = e.target.closest('.user-item');
            if(userItem) handleUserSelection(userItem.dataset.userId);
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