(() => {
    if (window.setHeader) {
        return;
    }

// --- PART 1: Create the setHeader function SYNCHRONOUSLY ---
const setHeaderText = (title, subtitle) => {
    const headerTitle = document.getElementById('header-title');
    const headerSubtitle = document.getElementById('header-subtitle');
    if (headerTitle) headerTitle.textContent = title;
    if (headerSubtitle) headerSubtitle.textContent = subtitle;
};

// --- PART 2: Attach it to the window object IMMEDIATELY ---
window.setHeader = setHeaderText;

// --- PART 3: Define the main ASYNCHRONOUS initialization function ---
window.initializeHeader = async () => {
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
        console.error("Header initialization failed: Critical elements not found after HTML injection.");
        return;
    }
    
    const permissions = {
        'view_notifications': ['admin', 'collector', 'field_agent'],
        'delete_notifications': ['admin', 'collector', 'field_agent'], 
        'mark_all_read': ['admin', 'collector', 'field_agent'],
        'send_broadcast': ['admin'],
    };

    let currentUserRole = null;
    let selectedNotificationIds = new Set();
    let broadcastRecipientType = 'all';
    let broadcastSelectedUsers = new Map();

    // --- API & HELPERS ---
    const api = {
        _request: async (method, ...args) => {
            if (!window.electronAPI) {
                console.error("Electron API is not available. Check preload script.");
                if (AppAlert) {
                    AppAlert.notify({ type: 'error', title: 'Connection Error', message: 'Cannot connect to the main process.' });
                }
                throw new Error("Electron API not found.");
            }
            const response = await window.electronAPI[method](...args);
            if (!response.ok) {
                const errorMessage = response.data?.message || response.message || `API Error`;
                throw new Error(errorMessage);
            }
            return response.data;
        },
        get: (path) => api._request('apiGet', path),
        post: (path, body) => api._request('apiPost', path, body),
        put: (path, body) => api._request('apiPut', path, body),
        delete: (path, body = {}) => api._request('apiDelete', path, { data: body }),
    };

    const hasPermission = (action) => {
        if (!currentUserRole || !permissions[action]) {
            return false;
        }
        return permissions[action].includes(currentUserRole);
    };

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
                const anyModalVisible = document.querySelector('.fullscreen-modal:not(.hidden), .modal-dialog:not(.hidden)');
                if (!anyModalVisible) {
                    modalOverlay.classList.add('hidden');
                }
            }
        }
    };

    // --- PERMISSIONS & UI SETUP ---
    const fetchUserRole = async () => {
        try {
            const user = await api.get('/me');
            currentUserRole = user.role;
        } catch (error) {
            console.error("CRITICAL: Could not fetch user profile for permissions.", error.message);
            currentUserRole = 'guest';
            if (AppAlert) {
                AppAlert.notify({ type: 'error', title: 'Authentication Error', message: 'Could not verify user role. Access is restricted.' });
            }
        }
    };

    const applyUIPermissions = () => {
        if (!hasPermission('send_broadcast')) broadcastBtn.style.display = 'none';
        if (!hasPermission('view_notifications')) notificationBell.style.display = 'none';
        if (!hasPermission('mark_all_read')) markAllReadBtn.style.display = 'none';
    };

    // --- HEADER UI & PROFILE LOGIC ---
    const updateNotificationBadge = (count) => {
        if (!notificationBadge) return;
        notificationBadge.textContent = count > 9 ? '9+' : count;
        notificationBadge.classList.toggle('hidden', count === 0);
    };

    const loadAdminProfile = async () => {
        try {
            const data = await api.get('/me');
            if (adminName) adminName.textContent = data.displayName || 'Admin';
            if (adminPhoto && data.photoUrl) adminPhoto.src = data.photoUrl;
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

    // --- NOTIFICATION MODAL LOGIC ---
    const updateNotificationSelectionUI = () => {
        const selectionCount = selectedNotificationIds.size;
        const canDelete = hasPermission('delete_notifications');
        notificationActionHeader.classList.toggle('hidden', selectionCount === 0 || !canDelete);
        selectionCountLabel.textContent = `${selectionCount} selected`;
        deleteSelectedBtn.disabled = selectionCount === 0;
        const allCheckboxes = notificationList.querySelectorAll('.notification-select-checkbox');
        selectAllCheckbox.checked = allCheckboxes.length > 0 && selectionCount === allCheckboxes.length;
    };

    const createNotificationElement = (notif) => {
        const canDelete = hasPermission('delete_notifications');
        const li = document.createElement('li');
        li.className = `notification-item ${!notif.isRead ? 'is-unread' : ''}`;
        li.dataset.id = notif._id;
        li.innerHTML = `
            <div class="icon-col type-${notif.type || 'info'}"><span class="icon ph-fill ph-${notif.type || 'info'}"></span></div>
            <div class="content-col">
                <p class="title">${notif.title}</p>
                <p class="message">${notif.message}</p>
                <p class="timestamp">${new Date(notif.createdAt).toLocaleString()}</p>
            </div>
            <div class="actions-col">
                <input type="checkbox" class="form-checkbox notification-select-checkbox" data-id="${notif._id}">
                ${canDelete ? `<button class="delete-btn" title="Delete notification"><span class="ph-fill ph-x-circle"></span></button>` : ''}
            </div>
        `;
        return li;
    };

    const fetchAndDisplayNotifications = async () => {
        try {
            const data = await api.get('/notifications?limit=50');
            updateNotificationBadge(data.totalUnread);
            notificationList.innerHTML = '';
            if (data.notifications.length === 0) {
                notificationList.innerHTML = `<li class="empty-state"><i class="ph ph-bell-simple-slash icon"></i><h3>All Caught Up!</h3><p>You don't have any new notifications right now.</p></li>`;
                return;
            }
            data.notifications.forEach(notif => {
                const element = createNotificationElement(notif);
                notificationList.appendChild(element);
            });
        } catch (error) {
            notificationList.innerHTML = `<li class="empty-state"><i class="ph ph-wifi-slash icon"></i><h3>Oops!</h3><p>Could not load your notifications. Please try again later.</p></li>`;
            updateNotificationBadge(0);
        }
    };

    const markAllAsRead = async () => {
        const unreadItems = Array.from(notificationList.querySelectorAll('.notification-item.is-unread'));
        if (unreadItems.length === 0) {
            if(AppAlert) AppAlert.notify({type: 'info', title: 'Already Done', message: 'There are no unread notifications.'});
            return;
        }

        try {
            await AppAlert.confirm({
                type: 'info',
                title: 'Mark All as Read?',
                message: `Are you sure you want to mark ${unreadItems.length} notifications as read?`,
                confirmText: 'Yes, Mark All'
            });

            unreadItems.forEach(item => item.classList.remove('is-unread'));
            updateNotificationBadge(0);

            await api.post('/notifications/mark-all-read', {});
            
            if(AppAlert) AppAlert.notify({type: 'success', title: 'Success', message: 'All notifications marked as read.'});
            
            selectedNotificationIds.clear();
            updateNotificationSelectionUI();

        } catch(error) {
            if (error && error.message !== 'Confirmation cancelled.') {
                console.error("Failed to mark all as read:", error.message);
                unreadItems.forEach(item => item.classList.add('is-unread'));
                fetchInitialUnreadCount();
                if(AppAlert) AppAlert.notify({type: 'error', title: 'Error', message: 'Could not mark notifications as read.'});
            }
        }
    };

    const deleteSingleNotification = async (id) => {
        const item = notificationList.querySelector(`.notification-item[data-id="${id}"]`);
        if (!item) return;

        try {
            await AppAlert.confirm({
                type: 'danger',
                title: 'Delete Notification?',
                message: 'This action is permanent and cannot be undone. Are you sure?',
                confirmText: 'Delete'
            });
            
            item.classList.add('is-deleting');
            await api.delete(`/notifications/${id}`);
            
            item.addEventListener('transitionend', () => item.remove());
            selectedNotificationIds.delete(id);
            updateNotificationSelectionUI();
            fetchInitialUnreadCount();
            
            if(AppAlert) AppAlert.notify({type: 'success', title: 'Notification Deleted', message: 'The notification has been removed.'});

        } catch(error) {
            if (error && error.message !== 'Confirmation cancelled.') {
                console.error(`Failed to delete notification ${id}:`, error.message);
                item.classList.remove('is-deleting');
                if(AppAlert) AppAlert.notify({type: 'error', title: 'Error', message: `Could not delete notification: ${error.message}`});
            }
        }
    };

    const deleteSelectedNotifications = async () => {
        const idsToDelete = Array.from(selectedNotificationIds);
        if (idsToDelete.length === 0) return;

        try {
            await AppAlert.confirm({
                type: 'danger',
                title: `Delete ${idsToDelete.length} Notifications?`,
                message: 'This action is permanent. Are you sure?',
                confirmText: 'Delete Selected'
            });

            const itemsToDelete = idsToDelete.map(id => notificationList.querySelector(`.notification-item[data-id="${id}"]`)).filter(Boolean);
            itemsToDelete.forEach(item => item.classList.add('is-deleting'));
            
            await api.delete('/notifications', { notificationIds: idsToDelete });
            
            itemsToDelete.forEach(item => item.addEventListener('transitionend', () => item.remove()));
            selectedNotificationIds.clear();
            updateNotificationSelectionUI();
            fetchInitialUnreadCount();

            if(AppAlert) AppAlert.notify({type: 'success', title: 'Notifications Deleted', message: `${idsToDelete.length} notifications have been removed.`});

        } catch(error) {
            if (error && error.message !== 'Confirmation cancelled.') {
                console.error("Failed to delete selected notifications:", error.message);
                idsToDelete.forEach(id => {
                    const item = notificationList.querySelector(`.notification-item[data-id="${id}"]`);
                    if (item) item.classList.remove('is-deleting');
                });
                if(AppAlert) AppAlert.notify({type: 'error', title: 'Deletion Failed', message: `Could not delete notifications: ${error.message}`});
            }
        }
    };


// --- PART 7: BROADCAST MODAL LOGIC ---
const renderSelectedUserPills = () => {
    if (broadcastSelectedUsers.size === 0) {
        selectedUsersList.innerHTML = `<p class="placeholder-text">No users selected</p>`;
        return;
    }
    selectedUsersList.innerHTML = Array.from(broadcastSelectedUsers.values()).map(user => `
        <div class="selected-user-pill">
            <span>${user.name}</span>
            <button class="remove-user-btn ph ph-x" data-id="${user.id}" title="Remove ${user.name}"></button>
        </div>`).join('');
};

const fetchAndRenderUsersForSelection = async (searchTerm = '') => {
    try {
        const users = await api.get(`/users/list?search=${encodeURIComponent(searchTerm)}`);
        userSelectList.innerHTML = users.map(user => `
            <li class="user-select-item" data-id="${user._id}" data-name="${user.displayName}">
                 <input type="checkbox" class="form-checkbox" ${broadcastSelectedUsers.has(user._id) ? 'checked' : ''}>
                 <img src="${user.photoUrl || '../../assets/images/default-avatar.jpg'}" class="avatar" alt="${user.displayName}">
                 <div class="details"><p class="name">${user.displayName}</p><p class="email">${user.email}</p></div>
            </li>`).join('');
    } catch(error) {
        userSelectList.innerHTML = '<li class="empty-state" style="padding: 2rem 0">Could not load users.</li>';
    }
};

const sendBroadcast = async () => {
    const title = broadcastTitleInput.value.trim();
    const message = broadcastMessageInput.value.trim();
    if (!title || !message) {
         if(AppAlert) AppAlert.notify({type: 'warning', title: 'Missing Info', message: 'Please provide a title and message.'});
        return;
    }
    const body = { title, message };
    if (broadcastRecipientType === 'specific') {
        if (broadcastSelectedUsers.size === 0) {
            if(AppAlert) AppAlert.notify({type: 'warning', title: 'No Recipients', message: 'Please select at least one user.'});
            return;
        }
        body.userIds = Array.from(broadcastSelectedUsers.keys());
    } else {
        body.status = 'all';
    }
    sendBroadcastBtn.disabled = true;
    sendBroadcastBtn.innerHTML = '<span class="ph ph-spinner-gap animate-spin"></span>Sending...';
    try {
        await api.post('/broadcast', body);
        if(AppAlert) AppAlert.notify({type: 'success', title: 'Broadcast Sent!', message: 'Your message has been sent successfully.'});
        AppCommon.closeModal(broadcastModal);
        broadcastTitleInput.value = '';
        broadcastMessageInput.value = '';
        broadcastSelectedUsers.clear();
        renderSelectedUserPills();
    } catch(error) {
        if(AppAlert) AppAlert.notify({type: 'error', title: 'Send Failed', message: error.message});
    } finally {
        sendBroadcastBtn.disabled = false;
        sendBroadcastBtn.innerHTML = '<span class="ph ph-paper-plane-tilt"></span>Send Broadcast';
    }
};

// --- PART 8: ATTACH ALL EVENT LISTENERS ---
const attachEventListeners = () => {
    const showPermissionDeniedAlert = (feature) => {
        if (AppAlert) {
            AppAlert.notify({ type: 'error', title: 'Permission Denied', message: `You do not have the required permissions to ${feature}.` });
        } else {
            console.warn(`PERMISSION DENIED: Cannot ${feature}.`);
        }
    };

    broadcastBtn.addEventListener('click', () => {
        if (!hasPermission('send_broadcast')) { showPermissionDeniedAlert('send broadcasts'); return; }
        AppCommon.openModal(broadcastModal);
    });

    notificationBell.addEventListener('click', () => {
        if (!hasPermission('view_notifications')) { showPermissionDeniedAlert('view notifications'); return; }
        AppCommon.openModal(notificationModal);
        fetchAndDisplayNotifications();
    });

    markAllReadBtn.addEventListener('click', () => {
        if (!hasPermission('mark_all_read')) { showPermissionDeniedAlert('mark notifications as read'); return; }
        markAllReadBtn.disabled = true;
        markAllAsRead().finally(() => {
            markAllReadBtn.disabled = false;
        });
    });

    deleteSelectedBtn.addEventListener('click', () => {
        if (!hasPermission('delete_notifications')) { showPermissionDeniedAlert('delete notifications'); return; }
        deleteSelectedBtn.disabled = true;
        deleteSelectedNotifications().finally(() => {
            deleteSelectedBtn.disabled = false;
        });
    });

    notificationList.addEventListener('click', (e) => {
        const item = e.target.closest('.notification-item');
        if (!item) return;

        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            e.stopPropagation();
            if (!hasPermission('delete_notifications')) { showPermissionDeniedAlert('delete notifications'); return; }
            deleteSingleNotification(item.dataset.id);
        } else {
             const checkbox = item.querySelector('.notification-select-checkbox');
             const isChecked = e.target.type === 'checkbox' ? e.target.checked : !checkbox.checked;
             checkbox.checked = isChecked;
             item.classList.toggle('is-selected', isChecked);
             if (isChecked) selectedNotificationIds.add(item.dataset.id); else selectedNotificationIds.delete(item.dataset.id);
             updateNotificationSelectionUI();
        }
    });
    
    sendBroadcastBtn.addEventListener('click', () => {
         if (!hasPermission('send_broadcast')) { showPermissionDeniedAlert('send broadcasts'); return; }
        sendBroadcast();
    });

    closeNotifModalBtn.addEventListener('click', () => AppCommon.closeModal(notificationModal));
    
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

    closeBroadcastModalBtn.addEventListener('click', () => AppCommon.closeModal(broadcastModal));
    
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
        if (checkbox.checked) {
            broadcastSelectedUsers.set(userId, { id: userId, name: userName });
        } else {
            broadcastSelectedUsers.delete(userId);
        }
    });
    
    userSearchInput.addEventListener('input', () => fetchAndRenderUsersForSelection(userSearchInput.value));

    modalOverlay.addEventListener('click', () => {
        AppCommon.closeModal(notificationModal);
        AppCommon.closeModal(broadcastModal);
        AppCommon.closeModal(userSelectModal);
    });
};

const handleIncomingNotification = (notification) => {
    const currentCount = parseInt(notificationBadge.textContent.replace('+', ''), 10) || 0;
    updateNotificationBadge(currentCount + 1);

    const ALERT_WORTHY_TYPES = ['billing', 'subscription', 'support', 'chat', 'system', 'contact', 'user', 'feedback'];
    if (ALERT_WORTHY_TYPES.includes(notification.type) && window.AppAlert) {
        const alertTypeMap = {
            'system': 'warning',
            'billing': 'info',
            'support': 'info',
            'subscription': 'success',
            'feedback': 'success'
        };
        const alertType = alertTypeMap[notification.type] || 'info';

        AppAlert.notify({
            type: alertType,
            title: notification.title,
            message: notification.message
        });
    }

    if (!notificationModal.classList.contains('hidden')) {
        const notificationElement = createNotificationElement(notification);
        const emptyState = notificationList.querySelector('.empty-state');
        if (emptyState) {
            emptyState.parentElement.innerHTML = ''; 
        }
        notificationList.prepend(notificationElement);
    }
};

// --- PART 9: INITIALIZATION ---
await fetchUserRole(); 
applyUIPermissions();
attachEventListeners();

if (hasPermission('view_notifications')) {
    fetchInitialUnreadCount();
}
loadAdminProfile();

// --- PART 10: REAL-TIME NOTIFICATION LISTENER ---
if (window.electronAPI && typeof window.electronAPI.on === 'function') {
    window.electronAPI.on('new-notification', (notification) => {
        if (notification && notification.title && notification.message) {
             handleIncomingNotification(notification);
        }
    });
} else {
    console.warn("Could not set up real-time notification listener: `window.electronAPI.on` is not a function.");
}

window.setHeader = (title, subtitle) => {
    if (headerTitle) headerTitle.textContent = title;
    if (headerSubtitle) headerSubtitle.textContent = subtitle;
};
};
})();