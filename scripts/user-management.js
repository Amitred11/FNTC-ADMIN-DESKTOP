// scripts/user-management.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selection ---
    const userListContainer = document.querySelector('.user-list');
    const userDetailsPanel = document.querySelector('.user-details-panel');
    const searchInput = document.querySelector('.search-box input');
    const backButton = document.querySelector('.back-btn');

    if (!userListContainer || !userDetailsPanel || !searchInput) {
        console.error("Essential UI components are missing. Aborting script.");
        return;
    }
    
    // --- State Management ---
    let selectedUserId = null;
    let searchDebounceTimer;

    // --- Utility & Renderer Functions ---
    const getAvatarInitial = (name) => (name ? name.charAt(0).toUpperCase() : '?');

    const getStatusBadge = (status) => {
        const statusMap = {
            'active': { className: 'active', text: 'Active' },
            'pending_verification': { className: 'pending', text: 'Pending' },
            'suspended': { className: 'suspended', text: 'Suspended' },
            'deactivated': { className: 'suspended', text: 'Deactivated' }
        };
        return statusMap[status] || { className: 'inactive', text: 'Inactive' };
    };

    const formatDate = (isoString) => new Date(isoString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    const renderBillingTable = (bills) => {
        if (!bills || bills.length === 0) return '<p class="no-data">No billing history found.</p>';
        return `
            <table class="data-table">
                <thead><tr><th>Amount</th><th>Due Date</th><th>Status</th></tr></thead>
                <tbody>
                    ${bills.map(bill => `
                        <tr>
                            <td>₱${bill.amount.toFixed(2)}</td>
                            <td>${formatDate(bill.dueDate)}</td>
                            <td><span class="status-badge ${bill.status.replace(' ', '-')}">${bill.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    };

    const renderTicketsTable = (tickets) => {
        if (!tickets || tickets.length === 0) return '<p class="no-data">No support tickets found.</p>';
        return `
            <table class="data-table">
                <thead><tr><th>Subject</th><th>Last Updated</th><th>Status</th></tr></thead>
                <tbody>
                    ${tickets.map(ticket => `
                        <tr>
                            <td>${ticket.subject}</td>
                            <td>${formatDate(ticket.updatedAt)}</td>
                            <td><span class="status-badge ${ticket.status.replace(' ', '-')}">${ticket.status}</span></td>
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
            userListContainer.innerHTML = '<p class="no-users">No users found.</p>';
            return;
        }
        users.forEach(user => {
            const badge = getStatusBadge(user.status);
            const avatar = getAvatarInitial(user.displayName);
            const userItem = document.createElement('li');
            userItem.className = 'user-item';
            userItem.dataset.userId = user._id;
            userItem.innerHTML = `
                <div class="user-avatar" style="background-color: #7E57C2;">${avatar}</div>
                <div class="user-info">
                    <p class="user-name">${user.displayName}</p>
                    <p class="user-email">${user.email}</p>
                </div>
                <span class="status-badge ${badge.className}">${badge.text}</span>
            `;
            userListContainer.appendChild(userItem);
        });
        userListContainer.querySelectorAll('.user-item').forEach(item => {
            item.addEventListener('click', () => handleUserSelection(item.dataset.userId));
        });
    };

    const fetchAndDisplayUserDetails = async (userId) => {
        if (!userId) {
            userDetailsPanel.innerHTML = '<p class="no-data">Select a user to see details.</p>';
            return;
        }
        selectedUserId = userId;
        userDetailsPanel.innerHTML = '<p class="no-data">Loading details...</p>';

        try {
            const response = await window.electronAPI.apiGet(`/users/${userId}/details`);
            if (!response.ok) throw new Error(response.data.message || 'Failed to fetch details');

            const { user, activeSubscription, billingHistory, tickets } = response.data;
            const avatar = getAvatarInitial(user.displayName);

            const suspendButtonHtml = user.status === 'suspended' || user.status === 'deactivated'
                ? `<button class="action-btn unsuspend" data-action="unsuspend"><i class="ph ph-check-circle"></i> Unsuspend</button>`
                : `<button class="action-btn suspend" data-action="suspend"><i class="ph ph-warning-circle"></i> Suspend</button>`;

            const subscriptionCardHtml = activeSubscription
                ? `<div class="info-item"><span class="info-label">Plan</span><span class="info-value">${activeSubscription.planId.name}</span></div><div class="info-item"><span class="info-label">Status</span><span class="info-value"><span class="status-badge ${activeSubscription.status}">${activeSubscription.status}</span></span></div>`
                : '<p class="no-data">No Active Subscription.</p>';

            userDetailsPanel.innerHTML = `
                <div class="details-header">
                    <div class="details-avatar">${avatar}</div>
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
                            <button class="action-btn modem" data-action="modem"><i class="ph ph-wifi-high"></i> ${user.isModemInstalled ? 'Retrieve' : 'Install'} Modem</button>
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
                            <div class="info-item"><span class="info-label">Mobile No.</span><span class="info-value">${user.mobileNumber || 'N/A'}</span></div>
                            <div class="info-item"><span class="info-label">Address</span><span class="info-value">${user.address?.fullAddress || 'N/A'}</span></div>
                        </div>
                    </div>
                </div>
                <div id="billing" class="tab-content">${renderBillingTable(billingHistory)}</div>
                <div id="tickets" class="tab-content">${renderTicketsTable(tickets)}</div>
            `;
            initializeTabSwitching();
        } catch (error) {
            console.error('Error fetching user details:', error);
            userDetailsPanel.innerHTML = `<p class="no-data error">Could not load user details.</p>`;
        }
    };

    const fetchUsers = async (query = '') => {
        try {
            const endpoint = `/users/search?query=${encodeURIComponent(query)}`;
            const response = await window.electronAPI.apiGet(endpoint);
            if (!response.ok) throw new Error('Failed to fetch users');
            const userList = response.data.data;
            renderUserList(userList);
            
            const isSelectedUserVisible = userList.some(user => user._id === selectedUserId);

            if (userList.length > 0 && !isSelectedUserVisible) {
                handleUserSelection(userList[0]._id);
            } else if (userList.length === 0) {
                userDetailsPanel.innerHTML = '<p class="no-data">No users match your search.</p>';
            }
        } catch (error) {
            console.error("Fetch users error:", error);
            userListContainer.innerHTML = `<p class="no-users error">Failed to load users.</p>`;
        }
    };

    // --- Event Handlers & Initializers ---
    const handleUserSelection = (userId) => {
        document.querySelectorAll('.user-item').forEach(item => {
            item.classList.toggle('active', item.dataset.userId === userId);
        });
        fetchAndDisplayUserDetails(userId);
    };

    const initializeTabSwitching = () => {
        const tabs = document.querySelectorAll('.tab-item');
        const contents = document.querySelectorAll('.tab-content');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = tab.dataset.target;
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(targetId).classList.add('active');
            });
        });
    };
    
    const initializeActionListeners = () => {
        userDetailsPanel.addEventListener('click', (event) => {
            const actionButton = event.target.closest('[data-action]');
            if (!actionButton) return;

            const action = actionButton.dataset.action;
            switch (action) {
                case 'modem': handleToggleModem(); break;
                case 'suspend': handleSuspendUser(); break;
                case 'unsuspend': handleUnsuspendUser(); break;
                case 'delete': handleDeleteUser(); break;
            }
        });
    };

    const handleToggleModem = async () => {
        if (!confirm('Are you sure you want to update the modem status?')) return;
        try {
            const response = await window.electronAPI.apiPost(`/users/${selectedUserId}/toggle-modem`);
            if (!response.ok) throw new Error(response.data.message);
            alert('Modem status updated!');
            fetchAndDisplayUserDetails(selectedUserId);
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    };

    // --- MODIFIED FUNCTION ---
    const handleSuspendUser = async () => {
        // The 'prompt' function can be silently blocked by browsers.
        // Using 'confirm' is more reliable for simple yes/no actions.
        if (!confirm('Are you sure you want to suspend this user?')) {
            return;
        }
        
        // Since the backend requires a reason, we can provide a default one.
        // For a more advanced solution, you would build a custom HTML modal to ask for input.
        const reason = 'User suspended by administrator.'; 

        try {
            const response = await window.electronAPI.apiPost(`/users/${selectedUserId}/status`, { status: 'suspended', reason });
            if (!response.ok) throw new Error(response.data.message);
            alert('User has been suspended.');
            fetchUsers(searchInput.value);
            fetchAndDisplayUserDetails(selectedUserId);
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    };
    
    const handleUnsuspendUser = async () => {
        if (!confirm('Are you sure you want to reactivate this user?')) return;
        try {
            const response = await window.electronAPI.apiPost(`/users/${selectedUserId}/status`, { status: 'active', reason: 'Reactivated by admin' });
            if (!response.ok) throw new Error(response.data.message);
            alert('User has been reactivated.');
            fetchUsers(searchInput.value);
            fetchAndDisplayUserDetails(selectedUserId);
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    };

    const handleDeleteUser = async () => {
        if (!confirm('WARNING: This will permanently delete the user and all associated data. Are you absolutely sure?')) return;
        try {
            const response = await window.electronAPI.apiDelete(`/users/${selectedUserId}`);
            if (!response.ok) throw new Error(response.data.message);
            alert('User permanently deleted.');
            fetchUsers();
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    };

    searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => fetchUsers(searchInput.value), 300);
    });
    backButton.addEventListener('click', () => window.history.back());

    // --- Initial Load ---
    initializeActionListeners();
    fetchUsers();
});