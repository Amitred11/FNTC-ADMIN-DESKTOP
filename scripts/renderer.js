// renderer.js (Refactored to use common.js)

document.addEventListener('DOMContentLoaded', () => {
    // --- PART 1: DOM Element Selectors ---
    const totalSubscribersEl = document.getElementById('total-subscribers');
    const newSubscribersEl = document.getElementById('new-subscribers');
    const overduePaymentsEl = document.getElementById('overdue-payments');
    const totalUsersEl = document.getElementById('total-users');
    const noticeListEl = document.getElementById('subscriber-list');
    const openTicketsEl = document.getElementById('open-tickets');
    const barChartEl = document.getElementById('bar-chart-body');
    const donutChartEl = document.getElementById('donut-chart-figure');

    // Modals & Overlay
    const modalOverlay = document.getElementById('modal-overlay');
    const notificationModal = document.getElementById('notification-modal');
    const broadcastModal = document.getElementById('broadcast-modal');
    const userSelectModal = document.getElementById('user-selection-modal');

    // Notifications
    const notificationBell = document.getElementById('notification-bell');
    const notificationBadge = document.getElementById('notification-badge');
    const notificationList = document.getElementById('notification-list');
    const markAllReadBtn = document.getElementById('mark-all-read-btn');
    const closeNotifModalBtn = document.getElementById('close-notification-modal-btn');
    const notificationActionHeader = document.getElementById('notification-action-header');
    const selectAllCheckbox = document.getElementById('select-all-notifications-checkbox');
    const selectionCountLabel = document.getElementById('selection-count-label');
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');

    // Broadcast
    const broadcastBtn = document.getElementById('broadcast-btn');
    const closeBroadcastModalBtn = document.getElementById('close-broadcast-modal-btn');
    const recipientToggle = document.getElementById('recipient-toggle');
    const userSelectionArea = document.getElementById('user-selection-area');
    const selectUsersBtn = document.getElementById('select-users-btn');
    const selectedUsersList = document.getElementById('selected-users-list');
    const broadcastTitleInput = document.getElementById('broadcast-title');
    const broadcastMessageInput = document.getElementById('broadcast-message');
    const sendBroadcastBtn = document.getElementById('send-broadcast-btn');

    // User Selection Modal
    const closeUserSelectModalBtn = document.getElementById('close-user-select-modal-btn');
    const userSearchInput = document.getElementById('user-search-input');
    const userSelectList = document.getElementById('user-select-list');
    const cancelUserSelectBtn = document.getElementById('cancel-user-select-btn');
    const confirmUserSelectBtn = document.getElementById('confirm-user-select-btn');

    // --- PART 2: State Management ---
    let selectedNotificationIds = new Set();
    let broadcastRecipientType = 'all';
    let broadcastSelectedUsers = new Map();

    // --- PART 3: Modal & UI Logic ---
    // This function closes all known modals on the page.
    const closeAllModals = () => {
        AppCommon.closeModal(notificationModal);
        AppCommon.closeModal(broadcastModal);
        AppCommon.closeModal(userSelectModal);
    };

    // --- PART 4: Notification Logic ---
    const updateNotificationBadge = (count) => {
        notificationBadge.textContent = count > 9 ? '9+' : count;
        notificationBadge.classList.toggle('hidden', count === 0);
    };

    const updateNotificationSelectionUI = () => {
        const selectionCount = selectedNotificationIds.size;
        notificationActionHeader.classList.toggle('hidden', selectionCount === 0);
        selectionCountLabel.textContent = `${selectionCount} selected`;
        deleteSelectedBtn.disabled = selectionCount === 0;
        const allCheckboxes = notificationList.querySelectorAll('.notification-select-checkbox');
        const totalItems = allCheckboxes.length;
        selectAllCheckbox.checked = totalItems > 0 && selectionCount === totalItems;
    };

    const fetchAndDisplayNotifications = async () => {
        const data = await AppCommon.fetchData('/notifications?limit=50');
        if (!data || !data.notifications) {
            notificationList.innerHTML = '<li class="notification-item-placeholder">Could not load notifications.</li>';
            return;
        }
        updateNotificationBadge(data.totalUnread);
        if (data.notifications.length === 0) {
            notificationList.innerHTML = '<li class="notification-item-placeholder">You have no notifications.</li>';
            return;
        }
        notificationList.innerHTML = data.notifications.map(notif => `
            <li class="notification-item ${!notif.isRead ? 'is-unread' : ''}" data-id="${notif._id}">
                <div class="select-col"><input type="checkbox" class="form-checkbox notification-select-checkbox" data-id="${notif._id}"></div>
                <div class="icon-col"><span class="icon ph ph-info"></span></div>
                <div class="content-col">
                    <p class="title">${notif.title}</p>
                    <p class="message">${notif.message}</p>
                    <p class="timestamp">${AppCommon.formatRelativeTime(notif.createdAt)}</p>
                </div>
                <div class="actions-col"><button class="delete-btn" title="Delete notification"><span class="ph-fill ph-x-circle"></span></button></div>
            </li>`).join('');
    };

    const markAllAsRead = async () => {
        const unreadItems = notificationList.querySelectorAll('.notification-item.is-unread');
        if (unreadItems.length === 0) return;
        unreadItems.forEach(item => item.classList.remove('is-unread'));
        updateNotificationBadge(0);
        const response = await AppCommon.postData('/notifications/mark-all-read', {});
        if (response && response.ok) {
            selectedNotificationIds.clear();
            AppCommon.showToast('Read All Successfully!');
            updateNotificationSelectionUI();
        } else {
            AppCommon.showToast(`Failed to mark all as read: ${response?.message || 'Unknown error'}`, 'error');
            unreadItems.forEach(item => item.classList.add('is-unread'));
            AppCommon.fetchData('/notifications/unread-count').then(data => data && updateNotificationBadge(data.unreadCount));
        }
    };

    const deleteSingleNotification = async (id) => {
        const item = notificationList.querySelector(`.notification-item[data-id="${id}"]`);
        if (!item) return;
        item.classList.add('is-deleting');
        const response = await AppCommon.deleteData(`/notifications/${id}`);
        if (response && response.ok) {
            item.addEventListener('transitionend', () => item.remove());
            selectedNotificationIds.delete(id);
            updateNotificationSelectionUI();
            AppCommon.fetchData('/notifications/unread-count').then(data => data && updateNotificationBadge(data.unreadCount));
        } else {
            item.classList.remove('is-deleting');
            AppCommon.showToast(`Failed to delete notification: ${response?.message || 'Unknown error'}`, 'error');
        }
    };

    const deleteSelectedNotifications = async () => {
        const idsToDelete = Array.from(selectedNotificationIds);
        if (idsToDelete.length === 0) return;
        const response = await AppCommon.deleteData('/notifications', { notificationIds: idsToDelete });
        if (response && response.ok) {
            idsToDelete.forEach(id => {
                const item = notificationList.querySelector(`.notification-item[data-id="${id}"]`);
                if (item) {
                    item.classList.add('is-deleting');
                    item.addEventListener('transitionend', () => item.remove());
                }
            });
            selectedNotificationIds.clear();
            AppCommon.showToast('Deleted all notifications successfully!');
            updateNotificationSelectionUI();
            AppCommon.fetchData('/notifications/unread-count').then(data => data && updateNotificationBadge(data.unreadCount));
        } else {
            AppCommon.showToast(`Failed to delete notifications: ${response?.message || 'Unknown error'}`, 'error');
        }
    };

    // --- PART 5: Broadcast Logic ---
    const renderSelectedUserPills = () => {
        if (broadcastSelectedUsers.size === 0) {
            selectedUsersList.innerHTML = `<p class="placeholder-text"><span class="ph-fill ph-info"></span> No users selected</p>`;
            return;
        }
        selectedUsersList.innerHTML = Array.from(broadcastSelectedUsers.values()).map(user => `
            <div class="selected-user-pill">
                <span>${user.name}</span>
                <button class="remove-user-btn ph ph-x" data-id="${user.id}"></button>
            </div>`).join('');
    };
    
    const fetchAndRenderUsersForSelection = async (searchTerm = '') => {
        const usersData = await AppCommon.fetchData(`/users/search?search=${encodeURIComponent(searchTerm)}&limit=50`);
        const users = usersData?.data || (Array.isArray(usersData) ? usersData : []);
        if (!Array.isArray(users)) {
            console.error("Could not load users or response was not an array.", usersData);
            userSelectList.innerHTML = '<li class="notice-item-placeholder">Could not load users.</li>';
            return;
        }
        userSelectList.innerHTML = users.map(user => {
            const userId = user._id || user.id;
            const userName = user.displayName || user.name;
            const userEmail = user.email || 'No email provided';
            const userAvatar = user.photoUrl || 'https://via.placeholder.com/40';
            return `
            <li class="user-select-item" data-id="${userId}" data-name="${userName}">
                <input type="checkbox" class="form-checkbox" ${broadcastSelectedUsers.has(userId) ? 'checked' : ''}>
                <img src="${userAvatar}" class="avatar" alt="${userName}">
                <div>
                    <p class="name">${userName}</p>
                    <p class="email">${userEmail}</p>
                </div>
            </li>`;
        }).join('');
    };
    
    const sendBroadcast = async () => {
        const title = broadcastTitleInput.value.trim();
        const message = broadcastMessageInput.value.trim();
        if (!title || !message) {
            AppCommon.showToast('Title and message are required.', 'error');
            return;
        }

        const body = { title, message };
        if (broadcastRecipientType === 'specific') {
            if (broadcastSelectedUsers.size === 0) {
                AppCommon.showToast('Please select at least one user.', 'error');
                return;
            }
            body.userIds = Array.from(broadcastSelectedUsers.keys());
        } else {
            body.status = 'all';
        }

        sendBroadcastBtn.disabled = true;
        sendBroadcastBtn.textContent = 'Sending...';
        
        try {
            const response = await AppCommon.postData('/broadcast', body);
            if (response && response.ok) {
                AppCommon.showToast('Broadcast sent successfully!');
                AppCommon.closeModal(broadcastModal);
                
                broadcastTitleInput.value = '';
                broadcastMessageInput.value = '';
                broadcastSelectedUsers.clear();
                renderSelectedUserPills();
                recipientToggle.querySelector('.toggle-btn.active').classList.remove('active');
                recipientToggle.querySelector('.toggle-btn[data-type="all"]').classList.add('active');
                broadcastRecipientType = 'all';
                userSelectionArea.classList.add('hidden');
            } else {
                AppCommon.showToast(`Failed to send broadcast: ${response?.message || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('An unexpected error occurred during broadcast:', error);
            AppCommon.showToast('An unexpected error occurred.', 'error');
        } finally {
            sendBroadcastBtn.disabled = false;
            sendBroadcastBtn.textContent = 'Send Broadcast';
        }
    };

    // --- PART 6: Dashboard Analytics & Charts ---
    const renderDonutChart = (distributionData) => {
        if (!distributionData || distributionData.length === 0) {
            donutChartEl.innerHTML = '<p class="chart-placeholder">No data.</p>'; return;
        }
        const series = distributionData.map(item => item.count);
        const labels = distributionData.map(item => item.name);
        const totalSubscribers = series.reduce((a, b) => a + b, 0);
        const options = {
            series, labels,
            chart: { type: 'donut', height: '60%', foreColor: '#333333' },
            colors: ['#0A3D62', '#3C8CE7', '#A5D6A7', '#64B5F6', '#81D4FA'],
            plotOptions: { pie: { donut: { labels: { show: true, total: { show: true, label: '', fontSize: '2rem', fontWeight: '700', color: '#E53935', formatter: () => totalSubscribers } } } } },
            legend: { position: 'bottom' }
        };
        donutChartEl.innerHTML = '';
        new ApexCharts(donutChartEl, options).render();
    };

    const renderBarChart = (monthlyData) => {
        if (!monthlyData || monthlyData.length === 0) {
            barChartEl.innerHTML = '<p class="chart-placeholder">No monthly subscriber data available.</p>';
            return;
        }

        const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const allPlanNames = [...new Set(monthlyData.flatMap(month => month.plans.map(plan => plan.name)))];
        const seriesDataMap = new Map();
        allPlanNames.forEach(name => {
            seriesDataMap.set(name, { name: name, data: new Array(12).fill(0) });
        });

        monthlyData.forEach(month => {
            const monthIndex = month.month - 1;
            if (monthIndex >= 0 && monthIndex < 12) {
                month.plans.forEach(plan => {
                    if (seriesDataMap.has(plan.name)) {
                        seriesDataMap.get(plan.name).data[monthIndex] = plan.count;
                    }
                });
            }
        });

        const options = {
            series: Array.from(seriesDataMap.values()),
            chart: { type: 'bar', height: '89%', toolbar: { show: false }, stacked: false, foreColor: '#333333' },
            plotOptions: { bar: { horizontal: false, columnWidth: '60%', endingShape: 'rounded' } },
            dataLabels: { enabled: false },
            xaxis: { categories: monthLabels, labels: { style: { colors: '#333333' } } },
            yaxis: { labels: { style: { colors: '#333333' } } },
            fill: { opacity: 1 },
            colors: ['#0A3D62', '#3C8CE7', '#A5D6A7', '#64B5F6', '#81D4FA'],
            tooltip: { y: { formatter: (val) => val + " subscribers" }, theme: 'dark' },
            legend: { position: 'top', horizontalAlign: 'left' }
        };
        
        barChartEl.innerHTML = '';
        new ApexCharts(barChartEl, options).render();
    };

    const fetchDashboardAnalytics = async () => {
        const data = await AppCommon.fetchData('/dashboard-analytics');
        if (!data) { 
            barChartEl.innerHTML = '<p class="chart-placeholder">Could not load dashboard data.</p>';
            return; 
        };

        totalSubscribersEl.textContent = data.quickAccess?.totalSubscribers || 0;
        newSubscribersEl.textContent = `+${data.quickAccess?.newSubscribersThisMonth || 0}`;
        overduePaymentsEl.textContent = data.quickAccess?.overduePayments || 0;
        renderDonutChart(data.subscriptionDistribution);
        renderBarChart(data.monthlySubscribersByPlan);
    };

    const fetchDashboardUserList = async () => {
        const users = await AppCommon.fetchData('/dashboard-user-list?limit=6');
        if (!users) {
            noticeListEl.innerHTML = '<li class="notice-item-placeholder">Could not load user data.</li>';
            return;
        }
        noticeListEl.innerHTML = users.length === 0 
            ? '<li class="notice-item-placeholder">No users with active issues.</li>'
            : users.map(user => {
                const userAvatar = user.photoUrl ? `<img src="${user.photoUrl}" class="avatar" alt="${user.name}">` : `<img src="https://via.placeholder.com/40" class="avatar" alt="Default avatar">`;
                const amountMatch = user.detailText.match(/₱[\d,]+\.\d{2}/);
                const amount = amountMatch ? amountMatch[0] : '';
                const detailText = amount ? user.detailText.split(amount)[0].trim() : user.detailText;
                return `
                    <li class="notice-item">
                        <div class="notice-info">
                            ${userAvatar}
                            <div><p class="name">${user.name}</p><p class="detail">${detailText || 'Status'}</p></div>
                        </div>
                        <div class="notice-details">
                            <p class="amount">${amount}</p><span class="status-badge ${user.status}">${user.status}</span>
                        </div>
                    </li>`;
            }).join('');
    };

    const fetchStats = async () => {
        const data = await AppCommon.fetchData('/stats');
        if (data) {
            if (totalUsersEl) totalUsersEl.textContent = data.totalUsers || 0;
            if (openTicketsEl) openTicketsEl.textContent = data.openTickets || 0;
        }
    };
    
    // --- PART 7: Initialization & Event Listeners ---
    const initializeDashboard = () => {
        fetchDashboardAnalytics();
        fetchDashboardUserList();
        fetchStats();
        AppCommon.fetchData('/notifications/unread-count').then(data => data && updateNotificationBadge(data.unreadCount));
    };

    // --- Assign Event Listeners ---
    modalOverlay.addEventListener('click', closeAllModals);

    // Notifications
    notificationBell.addEventListener('click', () => { AppCommon.openModal(notificationModal); fetchAndDisplayNotifications(); });
    closeNotifModalBtn.addEventListener('click', () => AppCommon.closeModal(notificationModal));
    markAllReadBtn.addEventListener('click', markAllAsRead);
    deleteSelectedBtn.addEventListener('click', deleteSelectedNotifications);
    notificationList.addEventListener('click', (e) => { const item = e.target.closest('.notification-item'); if (!item) return; const checkbox = e.target.closest('.notification-select-checkbox'); const deleteBtn = e.target.closest('.delete-btn'); if (deleteBtn) { deleteSingleNotification(item.dataset.id); } else if (checkbox) { item.classList.toggle('is-selected', checkbox.checked); if (checkbox.checked) selectedNotificationIds.add(item.dataset.id); else selectedNotificationIds.delete(item.dataset.id); } else { const innerCheckbox = item.querySelector('.notification-select-checkbox'); if(innerCheckbox) { innerCheckbox.checked = !innerCheckbox.checked; item.classList.toggle('is-selected', innerCheckbox.checked); if (innerCheckbox.checked) selectedNotificationIds.add(item.dataset.id); else selectedNotificationIds.delete(item.dataset.id); } } updateNotificationSelectionUI(); });
    selectAllCheckbox.addEventListener('change', () => { const checkboxes = notificationList.querySelectorAll('.notification-select-checkbox'); checkboxes.forEach(cb => { const item = cb.closest('.notification-item'); const id = item.dataset.id; cb.checked = selectAllCheckbox.checked; item.classList.toggle('is-selected', cb.checked); if (cb.checked) selectedNotificationIds.add(id); else selectedNotificationIds.delete(id); }); updateNotificationSelectionUI(); });

    // Broadcast
    broadcastBtn.addEventListener('click', () => AppCommon.openModal(broadcastModal));
    closeBroadcastModalBtn.addEventListener('click', () => AppCommon.closeModal(broadcastModal));
    sendBroadcastBtn.addEventListener('click', sendBroadcast);
    recipientToggle.addEventListener('click', (e) => { const btn = e.target.closest('.toggle-btn'); if (!btn || btn.classList.contains('active')) return; recipientToggle.querySelector('.active').classList.remove('active'); btn.classList.add('active'); broadcastRecipientType = btn.dataset.type; userSelectionArea.classList.toggle('hidden', broadcastRecipientType !== 'specific'); });
    selectUsersBtn.addEventListener('click', () => { AppCommon.openModal(userSelectModal); fetchAndRenderUsersForSelection(); });
    selectedUsersList.addEventListener('click', (e) => { const removeBtn = e.target.closest('.remove-user-btn'); if (removeBtn) { broadcastSelectedUsers.delete(removeBtn.dataset.id); renderSelectedUserPills(); } });

    // User Selection Modal
    closeUserSelectModalBtn.addEventListener('click', () => AppCommon.closeModal(userSelectModal));
    cancelUserSelectBtn.addEventListener('click', () => AppCommon.closeModal(userSelectModal));
    confirmUserSelectBtn.addEventListener('click', () => { renderSelectedUserPills(); AppCommon.closeModal(userSelectModal); });
    userSelectList.addEventListener('click', (e) => { const item = e.target.closest('.user-select-item'); if (!item) return; const checkbox = item.querySelector('input[type="checkbox"]'); if (e.target !== checkbox) checkbox.checked = !checkbox.checked; const userId = item.dataset.id; const userName = item.dataset.name; if (checkbox.checked) broadcastSelectedUsers.set(userId, { id: userId, name: userName }); else broadcastSelectedUsers.delete(userId); });
    userSearchInput.addEventListener('input', () => fetchAndRenderUsersForSelection(userSearchInput.value));

    // --- SCRIPT EXECUTION ---
    initializeDashboard();
});