// scripts/inbox.js

document.addEventListener('DOMContentLoaded', () => {
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
        headerContainer: document.getElementById('header-container')
    };

    // --- 3. UTILITY FUNCTIONS ---
    const formatDate = (isoString, options = {}) => {
        const defaultOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(isoString).toLocaleDateString('en-US', { ...defaultOptions, ...options });
    };

    // --- 4. API CALLS (Using only the three available endpoints) ---
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
            dom.listContainer.innerHTML = ''; // Clear existing list
            dom.listContainer.appendChild(fragment); // Render all at once
        },
        renderMessageDetails: (message) => {
            if (!message) {
                dom.viewPanel.innerHTML = '<p class="no-data">Select a message to read.</p>';
                return;
            }

            // --- UPDATED: Create a link to open Gmail's compose window ---
            const replySubject = `Re: ${message.subject}`;
            const replyBody = `\n\n---\nOn ${formatDate(message.createdAt)}, ${message.name} <${message.email}> wrote:\n\n${message.message}`;

            // URL encode the components to handle special characters safely
            const encodedSubject = encodeURIComponent(replySubject);
            const encodedBody = encodeURIComponent(replyBody);

            // Construct the Gmail compose URL
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
        if (!messageId || !confirm('Are you sure you want to permanently delete this message?')) {
            return;
        }

        try {
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

        } catch (error) {
            console.error('Failed to delete message:', error);
            alert('Error: Could not delete the message.');
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
    const init = async () => { // <-- FIX: Added 'async' here
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