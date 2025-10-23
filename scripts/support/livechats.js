document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // API INTERFACE
    // =================================================================
    const api = {
        getActiveChats: () => window.electronAPI.apiGet('/chats'),
        getChatById: (chatId) => window.electronAPI.apiGet(`/chats/${chatId}`),
        sendMessage: (chatId, messageText) => window.electronAPI.apiPost(`/chats/${chatId}/message`, { text: messageText }),
        endChat: (chatId) => window.electronAPI.apiPost(`/chats/${chatId}/close`, {})
    };

    // =================================================================
    // STATE & DOM ELEMENTS
    // =================================================================
    let state = {
        chats: [],
        activeChatId: null,
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
                    return `
                        <div class="message ${msg.isAdmin ? 'admin' : 'user'}">
                            <p>${msg.text.replace(/\n/g, '<br>')}</p>
                            <time>${formattedTime}</time>
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
            } else {
                 renderPlaceholder(`Failed to load chat: ${response.data.message}`);
            }
        } catch (error) {
            window.AppAlert.notify({ type: 'error', title: 'Error', message: 'Could not connect to the server to load chat.' });
        }
    });
    
    const handleSendMessage = async () => {
        const chatId = state.activeChatId;
        if (!chatId) return;

        const input = document.getElementById('chat-input');
        const messageText = input.value.trim();
        if (messageText) {
            input.value = '';
            input.style.height = 'auto'; 
            input.focus();
            try {
                const response = await api.sendMessage(chatId, messageText);
                if (response.ok) {
                    const chatBody = document.getElementById('chat-body');
                    const newMessage = response.data;
                    const messageElement = document.createElement('div');
                    const formattedTime = new Date(newMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    messageElement.className = `message ${newMessage.isAdmin ? 'admin' : 'user'}`;
                    messageElement.innerHTML = `
                        <p>${newMessage.text.replace(/\n/g, '<br>')}</p>
                        <time>${formattedTime}</time>
                    `;
                    chatBody.appendChild(messageElement);
                    chatBody.scrollTop = chatBody.scrollHeight;
                } else {
                    window.AppAlert.notify({ type: 'error', title: 'Send Failed', message: `Could not send message: ${response.data.message}` });
                }
            } catch (error) {
                window.AppAlert.notify({ type: 'error', title: 'Connection Error', message: 'Could not send message. Please check your connection.' });
            }
        }
    };

    chatWindow.addEventListener('click', async (e) => {
        const sendButton = e.target.closest('#send-reply-btn');
        const endButton = e.target.closest('#end-chat-window-btn');

        if (sendButton) {
            handleSendMessage();
        } else if (endButton) {
            try {
                await window.AppAlert.confirm({
                    type: 'danger',
                    title: 'End This Chat?',
                    message: 'This will close the conversation for the user. This action cannot be undone.',
                    confirmText: 'Yes, End Chat'
                });
                
                const response = await api.endChat(state.activeChatId);
                if (response.ok) {
                    await initializeApp(false); 
                    renderPlaceholder('This chat has been closed.');
                } else {
                    window.AppAlert.notify({ type: 'error', title: 'Error', message: `Could not end chat: ${response.data.message}` });
                }
            } catch (error) {
                // User cancelled the action
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