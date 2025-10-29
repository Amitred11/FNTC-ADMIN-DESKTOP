document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // API INTERFACE
    // =================================================================
    const api = {
        getActiveChats: () => window.electronAPI.apiGet('/chats'),
        getChatById: (chatId) => window.electronAPI.apiGet(`/chats/${chatId}`),
        sendMessage: (chatId, messageText) => window.electronAPI.apiPost(`/chats/${chatId}/message`, { text: messageText }),
        endChat: (chatId) => window.electronAPI.apiPost(`/chats/${chatId}/close`, {}),
        deleteMessage: (chatId, messageId) => window.electronAPI.apiDelete(`/chats/${chatId}/message/${messageId}`),
    };

    // =================================================================
    // STATE & DOM ELEMENTS
    // =================================================================
    let state = {
        chats: [],
        activeChatId: null,
        pollingIntervalId: null,
    };
    const headerContainer = document.getElementById('header-container');
    const chatListContainer = document.getElementById('chat-list-container');
    const chatWindow = document.getElementById('chat-window');
    const searchInput = document.getElementById('search-chat-input');
    
    const loadHeader = async () => {
        try {
            const response = await fetch('../../components/header.html');
            if (!response.ok) throw new Error(`Failed to fetch header: ${response.status}`);
            headerContainer.innerHTML = await response.text();
            if (window.initializeHeader) window.initializeHeader();
            else console.error("Header script not loaded or initializeHeader function not found.");
        } catch (error) {
            console.error('Failed to load header component:', error);
            headerContainer.innerHTML = `<p style="text-align: center; color: red;">Error: Header failed to load.</p>`;
        }
    };
    
    // =================================================================
    // UI SETUP
    // =================================================================
    const setupToggleButton = () => {
        const activeChatsList = document.getElementById('active-chats-list');
        const mainSection = document.querySelector('.main-section');
        if (!activeChatsList || !mainSection) return;

        if (!document.getElementById('toggle-sidebar-btn')) {
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'toggle-sidebar-btn';
            toggleBtn.title = 'Hide Chat List';
            toggleBtn.innerHTML = `<i class="ph ph-list"></i>`;
            activeChatsList.prepend(toggleBtn);
            toggleBtn.addEventListener('click', toggleSidebarVisibility);
        }
        
        if (!document.getElementById('show-sidebar-btn')) {
            const showBtn = document.createElement('button');
            showBtn.id = 'show-sidebar-btn';
            showBtn.title = 'Show Chat List';
            showBtn.innerHTML = `<i class="ph ph-list-dashes"></i>`;
            mainSection.prepend(showBtn);
            showBtn.addEventListener('click', toggleSidebarVisibility);
        }
    };

    const toggleSidebarVisibility = () => {
        const grid = document.getElementById('livechats-grid');
        const showBtn = document.getElementById('show-sidebar-btn');
        if (!grid || !showBtn) return;
        
        const isCollapsed = grid.classList.toggle('sidebar-collapsed');
        showBtn.classList.toggle('visible', isCollapsed);
    };

    // =================================================================
    // REAL-TIME POLLING LOGIC
    // =================================================================
    const stopChatPolling = () => {
        if (state.pollingIntervalId) {
            clearInterval(state.pollingIntervalId);
            state.pollingIntervalId = null;
        }
    };

    const startChatPolling = (chatId) => {
        stopChatPolling(); 

        state.pollingIntervalId = setInterval(async () => {
            if (state.activeChatId !== chatId) {
                stopChatPolling();
                return;
            }

            try {
                const response = await api.getChatById(chatId);
                if (response.ok) {
                    const chat = response.data;
                    const chatBody = document.getElementById('chat-body');
                    if (!chatBody) return;

                    const currentMessageCount = chatBody.querySelectorAll('.message-wrapper, .system-note').length;
                    
                    if (chat.messages.length > currentMessageCount) {
                        const isScrolledToBottom = chatBody.scrollHeight - chatBody.clientHeight <= chatBody.scrollTop + 100;
                        
                        const newMessages = chat.messages.slice(currentMessageCount);
                        newMessages.forEach(msg => {
                            const wrapper = document.createElement('div');
                            const isSystemMessage = msg.senderId === 'system';

                            if(isSystemMessage) {
                                wrapper.className = 'message system-note';
                                wrapper.innerHTML = `<p><em>${msg.text}</em></p>`;
                            } else {
                                wrapper.className = `message-wrapper ${msg.isAdmin ? 'admin' : 'user'}`;
                                wrapper.dataset.messageId = msg._id;
                                const formattedTime = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                const actions = msg.isAdmin ? `<div class="message-actions"><button class="btn-icon delete-message-btn" title="Delete Message"><i class="ph ph-trash"></i></button></div>` : '';
                                const messageBubble = `<div class="message"><p>${msg.text.replace(/\n/g, '<br>')}</p><time>${formattedTime}</time></div>`;
                                wrapper.innerHTML = actions + messageBubble;
                            }
                            chatBody.appendChild(wrapper);
                        });

                        if (isScrolledToBottom) {
                            chatBody.scrollTop = chatBody.scrollHeight;
                        }
                    }
                }
            } catch (error) {
                console.warn('Polling failed:', error.message);
            }
        }, 3000);
    };
    
    // =================================================================
    // RENDER FUNCTIONS
    // =================================================================
    const renderChatList = () => {
        const searchTerm = searchInput.value.toLowerCase();
        
        const filteredChats = state.chats.filter(chat => {
            const userName = chat.userId ? chat.userId.displayName : 'Deleted User';
            return userName.toLowerCase().includes(searchTerm);
        });

        chatListContainer.innerHTML = '';
        if (filteredChats.length === 0) {
            chatListContainer.innerHTML = '<p>No matching chats found.</p>';
        } else {
            filteredChats.forEach(chat => {
                const userName = chat.userId ? chat.userId.displayName.slice(0, 20) + '...'  : 'Deleted User';
                const userPhoto = chat.userId ? chat.userId.photoUrl : '../../assets/default-avatar.png';
                const lastMessage = chat.messages.length > 0 ? chat.messages.slice(-1)[0].text : 'No messages yet.';
                const lastMessageTimestamp = chat.messages.length > 0 ? new Date(chat.messages.slice(-1)[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                const card = document.createElement('article');
                card.className = 'chat-card';
                card.dataset.chatId = chat._id;
                if (chat._id === state.activeChatId) {
                    card.classList.add('active');
                }

                card.innerHTML = `
                    <img src="${userPhoto}" alt="${userName}" class="avatar">
                    <div class="chat-card-content">
                        <div class="chat-card-header">
                            <h3>${userName}</h3>
                            <time>${lastMessageTimestamp}</time>
                        </div>
                        <p>${lastMessage.substring(0, 50)}${lastMessage.length > 50 ? '...' : ''}</p>
                    </div>
                `;
                chatListContainer.appendChild(card);
            });
        }
        
        const activeChatIsVisible = filteredChats.some(chat => chat._id === state.activeChatId);
        if (state.activeChatId && !activeChatIsVisible) {
            renderPlaceholder('The active chat is hidden by your search filter.');
        }
    };

    const renderChatWindow = (chat) => {
        state.activeChatId = chat._id;
        
        const userName = chat.userId ? chat.userId.displayName : 'Deleted User';
        const userPhoto = chat.userId ? chat.userId.photoUrl : '../../assets/default-avatar.png'; 

        chatWindow.innerHTML = `
            <header class="chat-header">
                <img src="${userPhoto}" alt="${userName}" class="avatar">
                <div class="chat-header-info">
                    <h3>${userName}</h3>
                    <p class="status">● Active Now</p>
                </div>
                <div class="chat-header-actions">
                    <button class="btn danger" id="end-chat-window-btn"><i class="ph ph-x-circle"></i> End Chat</button>
                </div>
            </header>
            <div class="chat-body" id="chat-body">
                ${chat.messages.map(msg => {
                    const formattedTime = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const isSystemMessage = msg.senderId === 'system';

                    if (isSystemMessage) {
                        return `<div class="message system-note"><p><em>${msg.text}</em></p></div>`;
                    }
                    
                    return `
                        <div class="message-wrapper ${msg.isAdmin ? 'admin' : 'user'}" data-message-id="${msg._id}">
                            ${msg.isAdmin ? `
                                <div class="message-actions">
                                    <button class="btn-icon delete-message-btn" title="Delete Message">
                                        <i class="ph ph-trash"></i>
                                    </button>
                                </div>
                            ` : ''}
                            <div class="message">
                                <p>${msg.text.replace(/\n/g, '<br>')}</p>
                                <time>${formattedTime}</time>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            <footer class="chat-footer">
                <textarea id="chat-input" placeholder="Type your message..." rows="1"></textarea>
                <button class="btn primary" id="send-reply-btn"><i class="ph-fill ph-paper-plane-tilt"></i></button>
            </footer>
        `;
        const chatBody = document.getElementById('chat-body');
        chatBody.scrollTop = chatBody.scrollHeight;

        const chatInput = document.getElementById('chat-input');
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = `${chatInput.scrollHeight}px`;
        });
    };

    const renderPlaceholder = (message = 'Select a conversation from the list to view messages.') => {
        state.activeChatId = null;
        stopChatPolling();
        chatWindow.innerHTML = `<div class="chat-placeholder"><i class="ph-fill ph-chats-teardrop"></i><p>${message}</p></div>`;
        document.querySelectorAll('.chat-card.active').forEach(card => card.classList.remove('active'));
    };

    // =================================================================
    // EVENT HANDLERS & INITIALIZATION
    // =================================================================
    
    searchInput.addEventListener('input', renderChatList);

    chatListContainer.addEventListener('click', async (e) => {
        const card = e.target.closest('.chat-card');
        if (!card) return;

        const chatId = card.dataset.chatId;
        if (chatId === state.activeChatId) return;

        try {
            const response = await api.getChatById(chatId);
            if (response.ok) {
                renderChatWindow(response.data);
                document.querySelectorAll('.chat-card.active').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                startChatPolling(chatId);
            } else {
                 renderPlaceholder(`Failed to load chat: ${response.data.message}`);
            }
        } catch (error) {
            AppAlert.notify({ type: 'error', title: 'Error', message: 'Could not connect to the server to load chat.' });
        }
    });
    
    const handleSendMessage = async () => {
        const chatId = state.activeChatId;
        if (!chatId) return;

        const input = document.getElementById('chat-input');
        const sendButton = document.getElementById('send-reply-btn');
        const messageText = input.value.trim();

        if (messageText && sendButton && !sendButton.disabled) {
            input.value = '';
            input.style.height = 'auto'; 
            input.focus();

            sendButton.disabled = true;
            sendButton.innerHTML = '<i class="ph ph-spinner-gap"></i>';

            try {
                const response = await api.sendMessage(chatId, messageText);
                if (response.ok) {
                    const chatBody = document.getElementById('chat-body');
                    const newMessage = response.data;
                    const wrapper = document.createElement('div');
                    wrapper.className = `message-wrapper ${newMessage.isAdmin ? 'admin' : 'user'}`;
                    wrapper.dataset.messageId = newMessage._id;

                    const actions = newMessage.isAdmin ? `<div class="message-actions"><button class="btn-icon delete-message-btn" title="Delete Message"><i class="ph ph-trash"></i></button></div>` : '';
                    const messageBubble = `<div class="message"><p>${newMessage.text.replace(/\n/g, '<br>')}</p><time>${new Date(newMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>`;
                    
                    wrapper.innerHTML = actions + messageBubble;
                    chatBody.appendChild(wrapper);
                    chatBody.scrollTop = chatBody.scrollHeight;

                } else {
                    AppAlert.notify({ type: 'error', title: 'Send Failed', message: `Could not send message: ${response.data.message}` });
                    input.value = messageText;
                }
            } catch (error) {
                AppAlert.notify({ type: 'error', title: 'Connection Error', message: 'Could not send message. Please check your connection.' });
                input.value = messageText;
            } finally {
                sendButton.disabled = false;
                sendButton.innerHTML = '<i class="ph-fill ph-paper-plane-tilt"></i>';
            }
        }
    };

    const handleDeleteMessage = async (chatId, messageId) => {
        if (!chatId || !messageId) return;

        try {
            await AppAlert.confirmOnDialog({
                type: 'danger',
                title: 'Delete Message?',
                message: 'This message will be permanently deleted and replaced with a system note. This cannot be undone.',
                confirmText: 'Yes, Delete'
            });

            const response = await api.deleteMessage(chatId, messageId);
            if (response.ok) {
                const messageWrapper = document.querySelector(`.message-wrapper[data-message-id="${messageId}"]`);
                if (messageWrapper) {
                    const systemNote = document.createElement('div');
                    systemNote.className = 'message system-note';
                    systemNote.innerHTML = `<p><em>A message was deleted by the administrator.</em></p>`;
                    messageWrapper.parentNode.replaceChild(systemNote, messageWrapper);
                }
                 AppAlert.notify({ type: 'success', title: 'Message Deleted' });
            } else {
                AppAlert.notify({ type: 'error', title: 'Error', message: `Could not delete message: ${response.data.message}` });
            }
        } catch (error) {
            if (error && error.message !== 'Confirmation cancelled.') {
                AppAlert.notify({ type: 'error', title: 'Action Failed', message: error.message });
            }
        }
    };

    chatWindow.addEventListener('click', async (e) => {
        const sendButton = e.target.closest('#send-reply-btn');
        const endButton = e.target.closest('#end-chat-window-btn');
        const deleteButton = e.target.closest('.delete-message-btn');

        if (sendButton) {
            handleSendMessage();
        } else if (endButton) {
            try {
                await AppAlert.confirmOnDialog({
                    type: 'danger',
                    title: 'End This Chat?',
                    message: 'This will close the conversation for the user. This action cannot be undone.',
                    confirmText: 'Yes, End Chat'
                });
                
                const response = await api.endChat(state.activeChatId);
                if (response.ok) {
                    await initializeApp(false); 
                    renderPlaceholder('This chat has been closed.');
                    AppAlert.notify({ type: 'success', title: 'Chat Ended', message: 'The conversation has been successfully closed.' });
                } else {
                    AppAlert.notify({ type: 'error', title: 'Error', message: `Could not end chat: ${response.data.message}` });
                }
            } catch (error) {
                if (error && error.message !== 'Confirmation cancelled.') {
                    AppAlert.notify({ type: 'error', title: 'Action Failed', message: error.message });
                }
            }
        } else if (deleteButton) {
            const messageWrapper = e.target.closest('.message-wrapper');
            if (messageWrapper) {
                const messageId = messageWrapper.dataset.messageId;
                handleDeleteMessage(state.activeChatId, messageId);
            }
        }
    });

    chatWindow.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    const initializeApp = async (loadHeaderFlag = true) => {
        if (loadHeaderFlag) await loadHeader();
        setupToggleButton();

        if (window.setHeader) {
            window.setHeader('Live Chat Center', 'Engage directly with customers and provide instant help.');
        }
        chatListContainer.innerHTML = '<p>Loading chats...</p>';
        try {
            const response = await api.getActiveChats();
            if (response.ok) {
                state.chats = response.data;
                renderChatList();
                renderPlaceholder();
            } else {
                const errorMsg = `Failed to load chats: ${response.data.message || 'Please check your connection.'}`;
                chatListContainer.innerHTML = `<p class="error">${errorMsg}</p>`;
                renderPlaceholder('Could not load chats.');
            }
        } catch (error) {
            chatListContainer.innerHTML = `<p class="error">A connection error occurred.</p>`;
            renderPlaceholder('Could not connect to the server.');
        }
    };
    
    initializeApp();
});