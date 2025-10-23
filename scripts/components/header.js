/**
This script creates a self-contained header component.
It is initialized by calling window.initializeHeader() from a page-specific script.
It manages the header UI, profile data, notification modal, and broadcast modal.
*/

window.initializeHeader = () => {
    // --- PART 1: STATE MANAGEMENT ---
    let selectedNotificationIds = new Set();
    let broadcastRecipientType = 'all';
    let broadcastSelectedUsers = new Map();

    // --- PART 2: API & HELPERS ---
    const api = {
        _request: async (method, ...args) => {
            if (!window.electronAPI) {
                console.error("Electron API is not available. Check preload script.");
                return { ok: false, message: "Electron API not found." };
            }
            const response = await window.electronAPI[method](...args);
            if (!response.ok) {
                const errorMessage = response.data?.message || response.message || `API Error: Status ${response.status}`;
                throw new Error(errorMessage);
            }
            return response.data;
        },
        get: (path) => api._request('apiGet', path),
        post: (path, body) => api._request('apiPost', path, body),
        put: (path, body) => api._request('apiPut', path, body),
        delete: (path, body = {}) => api._request('apiDelete', path, body),
    };

    // --- PART 3: DOM ELEMENT SELECTORS ---
    const headerTitle = document.getElementById('header-title');
    const headerSubtitle = document.getElementById('header-subtitle');
    const broadcastBtn = document.getElementById('broadcast-btn');
    const notificationBell = document.getElementById('notification-bell');
    const notificationBadge = document.getElementById('notification-badge');
    const adminPhoto = document.getElementById('header-admin-photo');
    const adminName = document.getElementById('header-admin-name');

    const notificationModal = document.getElementById('notification-modal');
    const broadcastModal = document.getElementById('broadcast-modal');
    const userSelectModal = document.getElementById('user-selection-modal');
    const modalOverlay = document.getElementById('modal-overlay');

    const notificationList = document.getElementById('notification-list');
    const markAllReadBtn = document.getElementById('mark-all-read-btn');
    const notificationActionHeader = document.getElementById('notification-action-header');
    const selectAllCheckbox = document.getElementById('select-all-notifications-checkbox');
    const selectionCountLabel = document.getElementById('selection-count-label');
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');
    const closeNotifModalBtn = document.getElementById('close-notification-modal-btn');

    const closeBroadcastModalBtn = document.getElementById('close-broadcast-modal-btn');
    const recipientToggle = document.getElementById('recipient-toggle');
    const userSelectionArea = document.getElementById('user-selection-area');
    const selectUsersBtn = document.getElementById('select-users-btn');
    const selectedUsersList = document.getElementById('selected-users-list');
    const broadcastTitleInput = document.getElementById('broadcast-title');
    const broadcastMessageInput = document.getElementById('broadcast-message');
    const sendBroadcastBtn = document.getElementById('send-broadcast-btn');

    const closeUserSelectModalBtn = document.getElementById('close-user-select-modal-btn');
    const userSearchInput = document.getElementById('user-search-input');
    const userSelectList = document.getElementById('user-select-list');
    const cancelUserSelectBtn = document.getElementById('cancel-user-select-btn');
    const confirmUserSelectBtn = document.getElementById('confirm-user-select-btn');

    if (!broadcastBtn || !notificationBell || !modalOverlay) {
        console.error("Header initialization failed: Critical elements (buttons or overlay) not found.");
        return;
    }

    // --- FIXED: This helper now uses .hidden instead of .active ---
    const AppCommon = {
        openModal: (modal) => {
            if (modal) {
                modalOverlay.classList.remove('hidden');
                modal.classList.remove('hidden');
            }
        },
        closeModal: (modal) => {
            if (modal) {
                modal.classList.add('hidden');
                // Check if any other modals are still open before hiding the overlay
                const anyModalVisible = document.querySelector('.fullscreen-modal:not(.hidden), .modal-dialog:not(.hidden)');
                if (!anyModalVisible) {
                    modalOverlay.classList.add('hidden');
                }
            }
        }
    };

    // --- PART 4: HEADER UI & PROFILE LOGIC ---
    const updateNotificationBadge = (count) => {
        if (!notificationBadge) return;
        notificationBadge.textContent = count > 9 ? '9+' : count;
        notificationBadge.classList.toggle('hidden', count === 0);
    };

    const loadAdminProfile = async () => {
        try {
            const data = await api.get('/me');
            if (adminName) adminName.textContent = data.displayName || 'Admin';
            if (adminPhoto && data.photoUrl) {
                adminPhoto.src = data.photoUrl;
            }
        } catch (error) {
            console.error("Failed to load admin profile:", error);
        }
    };

    const fetchInitialUnreadCount = async () => {
        try {
            const data = await api.get('/notifications/unread-count');
            updateNotificationBadge(data.unreadCount);
        } catch (error) {
            console.error("Failed to fetch unread count:", error);
        }
    };

    // --- PART 5: NOTIFICATION MODAL LOGIC ---
    const updateNotificationSelectionUI = () => {
        const selectionCount = selectedNotificationIds.size;
        notificationActionHeader.classList.toggle('hidden', selectionCount === 0);
        selectionCountLabel.textContent = `${selectionCount} selected`;
        deleteSelectedBtn.disabled = selectionCount === 0;
        const allCheckboxes = notificationList.querySelectorAll('.notification-select-checkbox');
        selectAllCheckbox.checked = allCheckboxes.length > 0 && selectionCount === allCheckboxes.length;
    };

    const fetchAndDisplayNotifications = async () => {
        try {
            const data = await api.get('/notifications?limit=50');
            updateNotificationBadge(data.totalUnread);
            if (data.notifications.length === 0) {
                notificationList.innerHTML = '<li class="notification-item-placeholder">You have no notifications.</li>';
                return;
            }
            notificationList.innerHTML = data.notifications.map(notif => `
                <li class="notification-item ${!notif.isRead ? 'is-unread' : ''}" data-id="${notif._id}">
                    <div class="select-col"><input type="checkbox" class="form-checkbox notification-select-checkbox" data-id="${notif._id}"></div>
                    <div class="icon-col"><span class="icon ph ph-info"></span></div>
                    <div class="content-col"><p class="title">${notif.title}</p><p class="message">${notif.message}</p><p class="timestamp">${new Date(notif.createdAt).toLocaleString()}</p></div>
                    <div class="actions-col"><button class="delete-btn" title="Delete notification"><span class="ph-fill ph-x-circle"></span></button></div>
                </li>`).join('');
        } catch (error) {
             notificationList.innerHTML = '<li class="notification-item-placeholder">Could not load notifications.</li>';
             updateNotificationBadge(0);
        }
    };

    const markAllAsRead = async () => {
        const unreadItems = notificationList.querySelectorAll('.notification-item.is-unread');
        if (unreadItems.length === 0) return;
        try {
            await api.post('/notifications/mark-all-read', {});
            unreadItems.forEach(item => item.classList.remove('is-unread'));
            updateNotificationBadge(0);
            selectedNotificationIds.clear();
            updateNotificationSelectionUI();
        } catch(error) {
            // Handle error
        }
    };

    const deleteSingleNotification = async (id) => {
        const item = notificationList.querySelector(`.notification-item[data-id="${id}"]`);
        if (!item) return;
        item.classList.add('is-deleting');
        try {
            await api.delete(`/notifications/${id}`);
            item.addEventListener('transitionend', () => item.remove());
            selectedNotificationIds.delete(id);
            updateNotificationSelectionUI();
            fetchInitialUnreadCount();
        } catch(error) {
            item.classList.remove('is-deleting');
        }
    };

    const deleteSelectedNotifications = async () => {
        const idsToDelete = Array.from(selectedNotificationIds);
        if (idsToDelete.length === 0) return;
        try {
            await api.delete('/notifications', { notificationIds: idsToDelete });
            idsToDelete.forEach(id => {
                const item = notificationList.querySelector(`.notification-item[data-id="${id}"]`);
                if (item) {
                    item.classList.add('is-deleting');
                    item.addEventListener('transitionend', () => item.remove());
                }
            });
            selectedNotificationIds.clear();
            updateNotificationSelectionUI();
            fetchInitialUnreadCount();
        } catch(error) {
            // Handle error
        }
    };

    // --- PART 6: BROADCAST MODAL LOGIC ---
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
        try {
            const users = await api.get(`/users/list?search=${encodeURIComponent(searchTerm)}`);
            userSelectList.innerHTML = users.map(user => `
                <li class="user-select-item" data-id="${user._id}" data-name="${user.displayName}">
                    <input type="checkbox" class="form-checkbox" ${broadcastSelectedUsers.has(user._id) ? 'checked' : ''}>
                    <img src="${user.photoUrl || '../../assets/images/default-avatar.jpg'}" class="avatar" alt="${user.displayName}">
                    <div><p class="name">${user.displayName}</p><p class="email">${user.email}</p></div>
                </li>`).join('');
        } catch(error) {
            userSelectList.innerHTML = '<li class="notice-item-placeholder">Could not load users.</li>';
        }
    };

    const sendBroadcast = async () => {
        const title = broadcastTitleInput.value.trim();
        const message = broadcastMessageInput.value.trim();
        if (!title || !message) return;
        const body = { title, message };
        if (broadcastRecipientType === 'specific') {
            if (broadcastSelectedUsers.size === 0) return;
            body.userIds = Array.from(broadcastSelectedUsers.keys());
        } else {
            body.status = 'all';
        }
        sendBroadcastBtn.disabled = true;
        sendBroadcastBtn.textContent = 'Sending...';
        try {
            await api.post('/broadcast', body);
            AppCommon.closeModal(broadcastModal);
            broadcastTitleInput.value = '';
            broadcastMessageInput.value = '';
            broadcastSelectedUsers.clear();
            renderSelectedUserPills();
        } catch(error) {
            // Handle error
        } finally {
            sendBroadcastBtn.disabled = false;
            sendBroadcastBtn.textContent = 'Send Broadcast';
        }
    };

    // --- PART 7: ATTACH ALL EVENT LISTENERS ---
    broadcastBtn.addEventListener('click', () => AppCommon.openModal(broadcastModal));
    notificationBell.addEventListener('click', () => {
        AppCommon.openModal(notificationModal);
        fetchAndDisplayNotifications();
    });

    closeNotifModalBtn.addEventListener('click', () => AppCommon.closeModal(notificationModal));
    markAllReadBtn.addEventListener('click', markAllAsRead);
    deleteSelectedBtn.addEventListener('click', deleteSelectedNotifications);
    selectAllCheckbox.addEventListener('change', () => {
        const isChecked = selectAllCheckbox.checked;
        notificationList.querySelectorAll('.notification-select-checkbox').forEach(cb => {
            const item = cb.closest('.notification-item');
            cb.checked = isChecked;
            item.classList.toggle('is-selected', isChecked);
            if (isChecked) selectedNotificationIds.add(item.dataset.id); else selectedNotificationIds.delete(item.dataset.id);
        });
        updateNotificationSelectionUI();
    });
    notificationList.addEventListener('click', (e) => {
        const item = e.target.closest('.notification-item');
        if (!item) return;
        const deleteBtn = e.target.closest('.delete-btn');
        const checkbox = item.querySelector('.notification-select-checkbox');
        if (deleteBtn) {
            deleteSingleNotification(item.dataset.id);
        } else if (checkbox && e.target !== checkbox) {
             checkbox.checked = !checkbox.checked;
             item.classList.toggle('is-selected', checkbox.checked);
             if (checkbox.checked) selectedNotificationIds.add(item.dataset.id); else selectedNotificationIds.delete(item.dataset.id);
             updateNotificationSelectionUI();
        }
    });

    closeBroadcastModalBtn.addEventListener('click', () => AppCommon.closeModal(broadcastModal));
    sendBroadcastBtn.addEventListener('click', sendBroadcast);
    recipientToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('.toggle-btn');
        if (!btn || btn.classList.contains('active')) return;
        recipientToggle.querySelector('.active').classList.remove('active');
        btn.classList.add('active');
        broadcastRecipientType = btn.dataset.type;
        userSelectionArea.classList.toggle('hidden', broadcastRecipientType !== 'specific');
    });
    selectUsersBtn.addEventListener('click', () => {
        AppCommon.openModal(userSelectModal);
        fetchAndRenderUsersForSelection();
    });
    selectedUsersList.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-user-btn');
        if (removeBtn) {
            broadcastSelectedUsers.delete(removeBtn.dataset.id);
            renderSelectedUserPills();
        }
    });

    closeUserSelectModalBtn.addEventListener('click', () => AppCommon.closeModal(userSelectModal));
    cancelUserSelectBtn.addEventListener('click', () => AppCommon.closeModal(userSelectModal));
    confirmUserSelectBtn.addEventListener('click', () => {
        renderSelectedUserPills();
        AppCommon.closeModal(userSelectModal);
    });
    userSelectList.addEventListener('click', (e) => {
        const item = e.target.closest('.user-select-item');
        if (!item) return;
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
        const userId = item.dataset.id;
        const userName = item.dataset.name;
        if (checkbox.checked) broadcastSelectedUsers.set(userId, { id: userId, name: userName }); else broadcastSelectedUsers.delete(userId);
    });
    userSearchInput.addEventListener('input', () => fetchAndRenderUsersForSelection(userSearchInput.value));

    modalOverlay.addEventListener('click', () => {
        AppCommon.closeModal(notificationModal);
        AppCommon.closeModal(broadcastModal);
        AppCommon.closeModal(userSelectModal);
    });
    
    // --- PART 8: INITIALIZATION & PUBLIC API ---
    loadAdminProfile();
    fetchInitialUnreadCount();

    window.setHeader = (title, subtitle) => {
        if (headerTitle) headerTitle.textContent = title;
        if (headerSubtitle) headerSubtitle.textContent = subtitle;
    };
};