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

    const chatListContainer = document.getElementById('chat-list-container');
    const chatWindow = document.getElementById('chat-window');
    const sidebarContainer = document.getElementById('sidebar-container');
    const searchInput = document.getElementById('search-chat-input');

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
                const userName = chat.userId ? chat.userId.displayName : 'Deleted User';
                const lastMessage = chat.messages.length > 0 ? chat.messages.slice(-1)[0].text : 'No messages yet.';
                const lastMessageTimestamp = chat.messages.length > 0 ? new Date(chat.messages.slice(-1)[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                const card = document.createElement('article');
                card.className = 'chat-card';
                card.dataset.chatId = chat._id;
                if (chat._id === state.activeChatId) {
                    card.classList.add('active');
                }

                card.innerHTML = `
                    <header>
                        <h3>${userName}</h3>
                        <time>${lastMessageTimestamp}</time>
                    </header>
                    <p>${lastMessage.substring(0, 50)}${lastMessage.length > 50 ? '...' : ''}</p>
                    <footer>
                        <div class="chat-card-actions">
                            <button class="end-chat-btn" data-chat-id="${chat._id}">End Chat</button>
                        </div>
                    </footer>
                `;
                chatListContainer.appendChild(card);
            });
        }
        
        // FIX: If the currently active chat is no longer in the filtered list, clear the chat window.
        const activeChatIsVisible = filteredChats.some(chat => chat._id === state.activeChatId);
        if (state.activeChatId && !activeChatIsVisible) {
            renderPlaceholder('The active chat is hidden by your search filter.');
        }
    };

    const renderChatWindow = (chat) => {
        state.activeChatId = chat._id;
        
        const userName = chat.userId ? chat.userId.displayName : 'Deleted User';
        const userPhoto = chat.userId ? chat.userId.photoUrl : '../../assets/default-avatar.png'; // Use a reliable relative path for a default image

        chatWindow.innerHTML = `
            <header class="chat-header">
                <div class="chat-header-info">
                     <img src="${userPhoto}" alt="User Avatar" class="avatar">
                    <h3>${userName}</h3>
                    <p class="status">${chat.status}</p>
                </div>
                <div class="chat-header-actions">
                    <button class="btn secondary" id="end-chat-window-btn">End Chat</button>
                    <button class="btn secondary" id="close-chat-window-btn">Close</button>
                </div>
            </header>
            <div class="chat-body" id="chat-body">
                ${chat.messages.map(msg => `
                    <div class="message ${msg.isAdmin ? 'admin' : 'user'}">
                        <p>${msg.text}</p>
                        <time>${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                    </div>
                `).join('')}
            </div>
            <footer class="chat-footer">
                <textarea id="chat-input" placeholder="Type a message..." rows="1"></textarea>
                <button class="btn primary" id="send-reply-btn"><i class="ph-fill ph-paper-plane-tilt"></i></button>
            </footer>
        `;
        const chatBody = document.getElementById('chat-body');
        chatBody.scrollTop = chatBody.scrollHeight;
    };

    const renderPlaceholder = (message = 'Select a chat from the left to start messaging.') => {
        state.activeChatId = null;
        chatWindow.innerHTML = `<div class="chat-placeholder"><p>${message}</p></div>`;
        document.querySelectorAll('.chat-card.active').forEach(card => card.classList.remove('active'));
    };

    // =================================================================
    // EVENT HANDLERS & INITIALIZATION
    // =================================================================
    
    searchInput.addEventListener('input', renderChatList);

    chatListContainer.addEventListener('click', async (e) => {
        const card = e.target.closest('.chat-card');
        if (!card) return;

        if (e.target.classList.contains('end-chat-btn')) {
            e.stopPropagation();
            const chatId = e.target.dataset.chatId;
            const response = await api.endChat(chatId);
            if (response.ok) {
                await initializeApp();
                renderPlaceholder('This chat has been closed.');
            } else {
                alert(`Error: ${response.data.message || 'Could not end chat.'}`);
            }
            return;
        }

        const chatId = card.dataset.chatId;
        const response = await api.getChatById(chatId);
        if (response.ok) {
            renderChatWindow(response.data);
            document.querySelectorAll('.chat-card.active').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        } else {
             renderPlaceholder(`Failed to load chat: ${response.data.message}`);
        }
    });
    
    chatWindow.addEventListener('click', async (e) => {
        const chatId = state.activeChatId;
        if (!chatId) return;

        const sendButton = e.target.closest('#send-reply-btn');
        const endButton = e.target.id === 'end-chat-window-btn';
        const closeButton = e.target.id === 'close-chat-window-btn';

        if (sendButton) {
            const input = document.getElementById('chat-input');
            const messageText = input.value.trim();
            if (messageText) {
                const response = await api.sendMessage(chatId, messageText);
                if (response.ok) {
                    const chatBody = document.getElementById('chat-body');
                    const newMessage = response.data;
                    const messageElement = document.createElement('div');
                    messageElement.className = `message ${newMessage.isAdmin ? 'admin' : 'user'}`;
                    messageElement.innerHTML = `<p>${newMessage.text}</p><time>${new Date(newMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>`;
                    chatBody.appendChild(messageElement);
                    chatBody.scrollTop = chatBody.scrollHeight;
                    input.value = '';
                    input.focus();
                } else {
                    alert(`Error sending message: ${response.data.message}`);
                }
            }
        } else if (endButton) {
            const response = await api.endChat(chatId);
            if (response.ok) {
                await initializeApp();
                renderPlaceholder('This chat has been closed.');
            } else {
                alert(`Error: ${response.data.message || 'Could not end chat.'}`);
            }
        } else if (closeButton) {
            renderPlaceholder();
        }
    });

    chatWindow.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('send-reply-btn')?.click();
        }
    });

    const initializeApp = async () => {
        chatListContainer.innerHTML = '<p>Loading chats...</p>';
        const response = await api.getActiveChats();
        if (response.ok) {
            state.chats = response.data;
            renderChatList();
            renderPlaceholder();
        } else {
            chatListContainer.innerHTML = `<p class="error">Failed to load chats: ${response.data.message || 'Please check your connection.'}</p>`;
            renderPlaceholder('Could not load chats.');
        }
    };
    
    initializeApp();
});