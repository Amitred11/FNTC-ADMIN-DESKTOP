document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // API CONNECTOR
    // =================================================================
    const supportTicketAPI = {
        getTickets: async () => window.electronAPI.apiGet('/tickets'),
        getTicketById: async (id) => window.electronAPI.apiGet(`/tickets/${id}`),
        getTicketEvidence: async (id) => window.electronAPI.apiGet(`/tickets/${id}/evidence`),
        addReply: async (ticketId, messageText) => window.electronAPI.apiPost(`/tickets/${ticketId}/reply`, { text: messageText }),
        updateTicketStatus: async (ticketId, newStatus) => window.electronAPI.apiPost(`/tickets/${ticketId}/status`, { status: newStatus }),
        editReply: async (ticketId, messageId, newText) => window.electronAPI.apiPut(`/tickets/${ticketId}/reply/${messageId}`, { text: newText }),
        deleteReply: async (ticketId, messageId) => window.electronAPI.apiDelete(`/tickets/${ticketId}/reply/${messageId}`)
    };
    
    // =================================================================
    // STATE & DOM ELEMENTS
    // =================================================================
    let state = {
        tickets: [],
        currentFilter: 'All',
        currentTicketId: null,
        editingMessage: { ticketId: null, messageId: null }, 
    };
    
    const ticketsView = document.getElementById('tickets-view');
    const ticketDetailView = document.getElementById('ticket-detail-view');
    const ticketListContainer = document.getElementById('ticket-list-container');
    const searchInput = document.getElementById('ticket-search');
    const tabs = document.querySelectorAll('.tab');
    const editModal = document.getElementById('edit-reply-modal');
    const editModalTextarea = document.getElementById('edit-reply-textarea');
    
    // =================================================================
    // RENDER FUNCTIONS
    // =================================================================
    const renderTickets = () => {
        ticketListContainer.innerHTML = '';
        const searchQuery = searchInput.value.toLowerCase();
    
        const filteredTickets = state.tickets.filter(ticket => {
            const customerName = ticket.userId ? ticket.userId.displayName : 'Unknown User';
            const matchesFilter = state.currentFilter === 'All' || ticket.status === state.currentFilter;
            const matchesSearch = ticket._id.toLowerCase().includes(searchQuery) || customerName.toLowerCase().includes(searchQuery);
            return matchesFilter && matchesSearch;
        });
    
        if (filteredTickets.length === 0) {
            ticketListContainer.innerHTML = '<p class="no-tickets">No tickets found.</p>';
            return;
        }
    
        filteredTickets.forEach(ticket => {
            const statusClass = ticket.status.toLowerCase().replace(/ /g, '');
            const updatedDate = new Date(ticket.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const customerName = ticket.userId ? ticket.userId.displayName : 'Unknown User';
            const ticketId = ticket._id;
    
            const card = document.createElement('article');
            card.className = 'ticket-card';
            card.innerHTML = `
                <header class="ticket-header">
                    <h3>${ticket.subject}</h3>
                    <span class="status ${statusClass}">${ticket.status}</span>
                </header>
                <p class="ticket-from">From: ${customerName}</p>
                <p class="ticket-details">Ticket #${ticketId.slice(-6)} — Updated: ${updatedDate}</p>
                <footer class="ticket-footer">
                    <button class="btn primary view-btn" data-ticket-id="${ticketId}">View</button>
                </footer>
            `;
            ticketListContainer.appendChild(card);
        });
    };
    
    const renderTicketDetail = (ticket) => {
        state.currentTicketId = ticket._id;
    
        document.getElementById('detail-ticket-id-header').textContent = `Ticket #${ticket._id.slice(-6)}`;
        document.getElementById('detail-ticket-title').textContent = ticket.subject;
        document.getElementById('detail-ticket-description').textContent = ticket.description;
        
        const evidenceContainer = document.getElementById('detail-ticket-evidence');
        if (ticket.evidence?.fileName) {
            evidenceContainer.innerHTML = `<button class="btn-link" id="view-evidence-btn">${ticket.evidence.fileName}</button>`;
        } else {
            evidenceContainer.innerHTML = `<p class="text-muted">No evidence attached.</p>`;
        }

        document.getElementById('status-select').value = ticket.status;
    
        const repliesContainer = document.getElementById('detail-replies-container');
        repliesContainer.innerHTML = '';
        if (ticket.messages.length > 0) {
            ticket.messages.forEach(msg => {
                const msgDate = msg.createdAt ? new Date(msg.createdAt).toLocaleString() : 'Date not available';
                const replyEl = document.createElement('div');
                replyEl.className = 'reply-message';
                
                let messageActions = '';
                if (msg.isAdmin) {
                    messageActions = `
                        <div class="message-actions">
                            <button class="edit-reply-btn" data-ticket-id="${ticket._id}" data-message-id="${msg._id}" title="Edit Reply">
                                <i class="ph ph-pencil-simple"></i>
                            </button>
                            <button class="delete-reply-btn" data-ticket-id="${ticket._id}" data-message-id="${msg._id}" title="Delete Reply">
                                <i class="ph ph-trash"></i>
                            </button>
                        </div>
                    `;
                }
                
                replyEl.innerHTML = `
                    <div class="author">${msg.senderName} <span>${msgDate}</span></div>
                    <p>${msg.text}</p>
                    ${messageActions}
                `;
                repliesContainer.appendChild(replyEl);
            });
        } else {
            repliesContainer.innerHTML = '<p class="text-muted">No conversation history yet.</p>';
        }
        
        // **RE-IMPLEMENTED**: This logic enforces the "single reply" rule.
        const adminHasReplied = ticket.messages.some(msg => msg.isAdmin === true);
        document.getElementById('reply-action-form').classList.toggle('hidden', adminHasReplied);
        document.getElementById('reply-divider').classList.toggle('hidden', adminHasReplied);
    
        document.getElementById('reply-textarea').value = '';
        ticketsView.classList.add('hidden');
        ticketDetailView.classList.remove('hidden');
    };
    
    // =================================================================
    // EVENT HANDLERS & INITIALIZATION
    // =================================================================
    const showListView = async () => {
        ticketDetailView.classList.add('hidden');
        ticketsView.classList.remove('hidden');
        state.currentTicketId = null;
        await initializeApp();
    };
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.currentFilter = tab.dataset.tabFilter;
            renderTickets();
        });
    });
    
    searchInput.addEventListener('input', renderTickets);
    
    ticketListContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('view-btn')) {
            const ticketId = e.target.dataset.ticketId;
            const response = await supportTicketAPI.getTicketById(ticketId);
            if (response.ok) {
                renderTicketDetail(response.data);
            }
        }
    });
    
    document.getElementById('back-to-list-btn').addEventListener('click', showListView);
    
    document.getElementById('send-reply-btn').addEventListener('click', async () => {
        const replyText = document.getElementById('reply-textarea').value.trim();
        if (replyText && state.currentTicketId) {
            const response = await supportTicketAPI.addReply(state.currentTicketId, replyText);
            if(response.ok) {
               renderTicketDetail(response.data); 
            }
        }
    });
    
    document.getElementById('update-status-btn').addEventListener('click', async () => {
        const newStatus = document.getElementById('status-select').value;
        if(state.currentTicketId && newStatus) {
            const response = await supportTicketAPI.updateTicketStatus(state.currentTicketId, newStatus);
            if (response.ok) {
                 const updatedTicketResponse = await supportTicketAPI.getTicketById(state.currentTicketId);
                 if (updatedTicketResponse.ok) {
                    renderTicketDetail(updatedTicketResponse.data);
                 }
            }
        }
    });

    ticketDetailView.addEventListener('click', async (e) => {
        const viewEvidenceBtn = e.target.closest('#view-evidence-btn');
        const editBtn = e.target.closest('.edit-reply-btn');
        const deleteBtn = e.target.closest('.delete-reply-btn');

        if (viewEvidenceBtn) {
            e.preventDefault();
            if (state.currentTicketId) {
                const response = await supportTicketAPI.getTicketEvidence(state.currentTicketId);
                if (response.ok) {
                    const { contentType, data: base64Data } = response.data;
                    const dataUrl = `data:${contentType};base64,${base64Data}`;
                    const newWindow = window.open();
                    if (contentType.startsWith('image/')) {
                         newWindow.document.write(`<body style="margin:0;"><img src="${dataUrl}" style="max-width: 100%;"></body>`);
                    } else if (contentType === 'application/pdf') {
                         newWindow.document.write(`<body style="margin:0; height:100vh;"><iframe src="${dataUrl}" width="100%" height="100%" frameborder="0"></iframe></body>`);
                    } else {
                         newWindow.location.href = dataUrl;
                    }
                } else {
                    alert('Could not load the evidence file.');
                }
            }
        }

        if (editBtn) {
            const { ticketId, messageId } = editBtn.dataset;
            const response = await supportTicketAPI.getTicketById(ticketId);
            if (response.ok) {
                const message = response.data.messages.find(m => m._id === messageId);
                if (message) {
                    state.editingMessage = { ticketId, messageId };
                    editModalTextarea.value = message.text;
                    editModal.classList.remove('hidden');
                    editModalTextarea.focus();
                    editModalTextarea.select();

                }
            }
        }

        if (deleteBtn) {
            const { ticketId, messageId } = deleteBtn.dataset;
            if (confirm('Are you sure you want to delete this reply? This action cannot be undone.')) {
                const response = await supportTicketAPI.deleteReply(ticketId, messageId);
                if (response.ok) {
                    const updatedTicketResponse = await supportTicketAPI.getTicketById(ticketId);
                    if (updatedTicketResponse.ok) {
                        renderTicketDetail(updatedTicketResponse.data);
                    }
                } else {
                    alert('Failed to delete reply. Please try again.');
                }
            }
        }
    });

    document.getElementById('save-edit-btn').addEventListener('click', async () => {
        const { ticketId, messageId } = state.editingMessage;
        const newText = editModalTextarea.value.trim();
        if (newText && ticketId && messageId) {
            const response = await supportTicketAPI.editReply(ticketId, messageId, newText);
            if (response.ok) {
                editModal.classList.add('hidden');
                const updatedTicketResponse = await supportTicketAPI.getTicketById(ticketId);
                if (updatedTicketResponse.ok) {
                    renderTicketDetail(updatedTicketResponse.data);
                }
            } else {
                 alert('Failed to save changes. Please try again.');
            }
        }
    });

    document.getElementById('cancel-edit-btn').addEventListener('click', () => {
        editModal.classList.add('hidden');
        state.editingMessage = { ticketId: null, messageId: null };
    });

    const initializeApp = async () => {
        ticketListContainer.innerHTML = '<p>Loading tickets...</p>';
        const response = await supportTicketAPI.getTickets();
        if (response.ok) {
            state.tickets = response.data.data;
            renderTickets();
        } else {
             ticketListContainer.innerHTML = '<p class="no-tickets">Could not load tickets. Please try again later.</p>';
        }
    };
    
    initializeApp();
});