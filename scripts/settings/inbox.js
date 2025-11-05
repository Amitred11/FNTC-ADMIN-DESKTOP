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

document.addEventListener('DOMContentLoaded', async () => {

    const ALLOWED_ROLES = ['admin'];
    let currentUserRole = null;

    try {
        const response = await window.electronAPI.getUserProfile();
        const user = response;

        if (user && user.role) {
            currentUserRole = user.role;
        } else {
            throw new Error("Role not found in profile.");
        }
    } catch (e) {
        console.error("Critical security error: Could not fetch user profile.", e);
        renderAccessDenied();
        return;
    }

    if (!ALLOWED_ROLES.includes(currentUserRole)) {
        console.warn(`SECURITY: User with role '${currentUserRole}' attempted to access the subscriptions page without permission.`);
        renderAccessDenied();
        return;
    }
    
    console.log("Permission granted. Initializing subscription management page.");


    // --- 1. STATE MANAGEMENT ---
    let state = {
        messages: [],
        selectedMessageId: null,
    };

    // --- 2. DOM ELEMENTS ---
    const dom = {
        listContainer: document.querySelector('.message-list'),
        viewPanel: document.querySelector('.message-view'),
        refreshButton: document.querySelector('.inbox-header .btn'),
        headerContainer: document.getElementById('header-container'),
        sidebar: document.getElementById('sidebar-container'),
        overlay: document.getElementById('sidebar-overlay')
    };
    
    // --- 3. UTILITY FUNCTIONS ---
    const formatDate = (isoString, options = {}) => {
        const defaultOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(isoString).toLocaleDateString('en-US', { ...defaultOptions, ...options });
    };

    // --- 4. API CALLS ---
    const api = {
        getMessages: () => window.electronAPI.apiGet('/contact-messages'),
        getMessageById: (id) => window.electronAPI.apiGet(`/contact-messages/${id}`),
        deleteMessage: (id) => window.electronAPI.apiDelete(`/contact-messages/${id}`),
    };

    const loadHeader = async () => {
        try {
            const response = await fetch('../../components/header.html');
            if (!response.ok) throw new Error(`Failed to fetch header: ${response.status}`);
            dom.headerContainer.innerHTML = await response.text();
            const mobileMenuButton = document.getElementById('mobile-menu-button');

            if (mobileMenuButton && dom.sidebar && dom.overlay) {
                mobileMenuButton.addEventListener('click', () => {
                    dom.sidebar.classList.toggle('mobile-visible');
                    dom.overlay.classList.toggle('visible'); // Assuming 'visible' class handles opacity
                });

                dom.overlay.addEventListener('click', () => {
                    dom.sidebar.classList.remove('mobile-visible');
                    dom.overlay.classList.remove('visible');
                });
            }
            if (window.initializeHeader) {
                window.initializeHeader();
            } else {
                console.error("Header script not loaded or initializeHeader function not found.");
            }
        } catch (error) {
            console.error('Failed to load header component:', error);
            dom.headerContainer.innerHTML = `<p class="error-message" style="text-align: center; color: red;">Error: Header failed to load.</p>`;
        }
    };

    // --- 5. UI RENDERING ---
    const ui = {
        renderMessageList: () => {
            const fragment = document.createDocumentFragment();
            if (!state.messages || state.messages.length === 0) {
                dom.listContainer.innerHTML = '<p class="no-data">No messages found.</p>';
                return;
            }
            state.messages.forEach(msg => {
                const item = document.createElement('a');
                item.href = '#';
                item.className = `message-item ${msg.isRead ? '' : 'unread'}`;
                item.dataset.messageId = msg._id;
                item.innerHTML = `
                    <p class="subject">${msg.subject}</p>
                    <p class="from">from: ${msg.name}</p>
                    <time class="timestamp">${formatDate(msg.createdAt, { year: 'numeric', month: 'short', day: 'numeric' })}</time>
                `;
                fragment.appendChild(item);
            });
            dom.listContainer.innerHTML = ''; 
            dom.listContainer.appendChild(fragment); 
        },
        renderMessageDetails: (message) => {
            if (!message) {
                dom.viewPanel.innerHTML = '<p class="no-data">Select a message to read.</p>';
                return;
            }

            const replySubject = `Re: ${message.subject}`;
            const replyBody = `\n\n---\nOn ${formatDate(message.createdAt)}, ${message.name} <${message.email}> wrote:\n\n${message.message}`;
            const encodedSubject = encodeURIComponent(replySubject);
            const encodedBody = encodeURIComponent(replyBody);
            const gmailComposeLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${message.email}&su=${encodedSubject}&body=${encodedBody}`;

            dom.viewPanel.innerHTML = `
                <header class="message-view-header">
                    <h3>${message.subject}</h3>
                    <div class="message-meta">
                        <p><strong>From:</strong> ${message.name}</p>
                        <p><strong>Email:</strong> <a href="mailto:${message.email}">${message.email}</a></p>
                        <p><strong>Received:</strong> ${formatDate(message.createdAt)}</p>
                    </div>
                </header>
                <div class="message-content">
                    <p>${message.message.replace(/\n/g, '<br>')}</p>
                </div>
                <footer class="message-footer">
                    <a href="${gmailComposeLink}" class="btn btn-primary" target="_blank">
                        <i class="ph ph-paper-plane-right"></i> Reply
                    </a>
                    <button class="btn btn-danger" data-action="delete" data-message-id="${message._id}">
                        <i class="ph ph-trash"></i> Delete
                    </button>
                </footer>
            `;
        },
        setActiveMessage: (messageId) => {
            document.querySelectorAll('.message-item').forEach(item => {
                item.classList.toggle('active', item.dataset.messageId === messageId);
            });
        },
        showLoading: (panel, message) => {
            panel.innerHTML = `<p class="no-data">${message}</p>`;
        },
        showError: (panel, message) => {
            panel.innerHTML = `<p class="no-data error">${message}</p>`;
        }
    };

    // --- 6. EVENT HANDLERS & LOGIC ---
    const handleMessageSelection = async (messageId) => {
        if (!messageId) return;

        state.selectedMessageId = messageId;
        ui.setActiveMessage(messageId);
        ui.showLoading(dom.viewPanel, 'Loading message...');

        try {
            const response = await api.getMessageById(messageId);
            if (!response.ok) throw new Error(response.data.message);

            ui.renderMessageDetails(response.data);

            const messageInState = state.messages.find(m => m._id === messageId);
            if (messageInState && !messageInState.isRead) {
                messageInState.isRead = true;
                const messageItemInList = dom.listContainer.querySelector(`.message-item[data-message-id="${messageId}"]`);
                if (messageItemInList) {
                    messageItemInList.classList.remove('unread');
                }
            }
        } catch (error) {
            console.error('Error fetching message details:', error);
            ui.showError(dom.viewPanel, 'Could not load message details.');
        }
    };

    const handleDeleteMessage = async (messageId) => {
        if (!messageId) return;

        try {
            await AppAlert.confirm({
                type: 'danger',
                title: 'Delete Message?',
                message: 'Are you sure you want to permanently delete this message? This action cannot be undone.',
                confirmText: 'Yes, Delete'
            });
            const response = await api.deleteMessage(messageId);
            if (!response.ok) throw new Error(response.data.message);

            state.messages = state.messages.filter(m => m._id !== messageId);
            state.selectedMessageId = null;

            ui.renderMessageList();

            if (state.messages.length > 0) {
                 handleMessageSelection(state.messages[0]._id);
            } else {
                ui.renderMessageDetails(null); 
            }
            AppAlert.notify({ type: 'success', title: 'Message Deleted', message:'the message has been deleted successfully.' });
            
        } catch (error) {
            if (error.message !== 'Confirmation cancelled by user.') {
                console.error('Failed to delete message:', error);
                AppAlert.notify({ type: 'error', title: 'Delete Failed', message: 'Could not delete the message.' });
            }
        }
    };

    const loadMessages = async () => {
        ui.showLoading(dom.listContainer, 'Loading messages...');
        try {
            const response = await api.getMessages();
            if (!response || typeof response.ok === 'undefined') {
                throw new Error('Received an invalid response from the main process. This is likely a backend API error.');
            }
            if (!response.ok) throw new Error(response.data.message || 'The API endpoint failed.');

            state.messages = response.data;
            ui.renderMessageList();

            if (state.messages.length > 0) {
                const idToSelect = state.selectedMessageId && state.messages.some(m => m._id === state.selectedMessageId)
                    ? state.selectedMessageId
                    : state.messages[0]._id;
                handleMessageSelection(idToSelect);
            } else {
                ui.renderMessageDetails(null);
            }
        } catch (error) {
            console.error("Fetch messages error:", error);
            ui.showError(dom.listContainer, 'Failed to load messages. Please check the backend connection and logs.');
        }
    };

    // --- 7. INITIALIZATION ---
    const init = async () => {
        await loadHeader();
        if (window.setHeader) {
            window.setHeader('Inbox', 'View and manage your system notifications.');
        }

        if (!dom.listContainer || !dom.viewPanel || !dom.refreshButton) {
            console.error("Inbox UI components are missing. Aborting script.");
            return;
        }

        dom.listContainer.addEventListener('click', (event) => {
            const messageItem = event.target.closest('.message-item');
            if (messageItem) {
                event.preventDefault();
                handleMessageSelection(messageItem.dataset.messageId);
            }
        });

        dom.viewPanel.addEventListener('click', (event) => {
            const deleteButton = event.target.closest('[data-action="delete"]');
            if (deleteButton) {
                handleDeleteMessage(deleteButton.dataset.messageId);
            }
        });

        dom.refreshButton.addEventListener('click', (e) => {
            e.preventDefault();
            loadMessages();
        });

        loadMessages();
    };

    init();
});