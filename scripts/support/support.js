document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // API CONNECTOR
    // =================================================================
    const supportTicketAPI = {
        _request: async (method, ...args) => {
            if (!window.electronAPI) {
                console.error("Electron API is not available.");
                return { ok: false, message: "Electron API not found." };
            }
            try {
                const response = await window.electronAPI[method](...args);
                if (!response.ok) {
                    const errorMessage = response.data?.message || response.message || 'An unknown API error occurred.';
                    throw new Error(errorMessage);
                }
                return response;
            } catch (error) {
                throw error;
            }
        },
        getTickets: () => supportTicketAPI._request('apiGet', '/tickets'),
        getTicketById: (id) => supportTicketAPI._request('apiGet', `/tickets/${id}`),
        addReply: (ticketId, messageText) => supportTicketAPI._request('apiPost', `/tickets/${ticketId}/reply`, { text: messageText }),
        updateTicketStatus: (ticketId, newStatus) => supportTicketAPI._request('apiPost', `/tickets/${ticketId}/status`, { status: newStatus }),
        editReply: (ticketId, messageId, newText) => supportTicketAPI._request('apiPut', `/tickets/${ticketId}/reply/${messageId}`, { text: newText }),
        deleteReply: (ticketId, messageId) => supportTicketAPI._request('apiDelete', `/tickets/${ticketId}/reply/${messageId}`)
    };

    // =================================================================
    // STATE & DOM ELEMENTS
    // =================================================================
    const state = {
        tickets: [],
        currentFilter: 'All',
        currentTicketId: null,
        editingMessage: { ticketId: null, messageId: null },
    };

    const dom = {
        headerContainer: document.getElementById('header-container'),
        ticketsView: document.getElementById('tickets-view'),
        ticketDetailView: document.getElementById('ticket-detail-view'),
        ticketListContainer: document.getElementById('ticket-list-container'),
        searchInput: document.getElementById('ticket-search'),
        tabs: document.querySelectorAll('.tab'),
        editModal: document.getElementById('edit-reply-modal'),
        editModalTextarea: document.getElementById('edit-reply-textarea'),
        backToListBtn: document.getElementById('back-to-list-btn'),
        sendReplyBtn: document.getElementById('send-reply-btn'),
        updateStatusBtn: document.getElementById('update-status-btn'),
        saveEditBtn: document.getElementById('save-edit-btn'),
        cancelEditBtn: document.getElementById('cancel-edit-btn'),
        evidenceModal: document.getElementById('evidence-modal'),
        evidenceModalImage: document.getElementById('evidence-modal-image'),
        evidenceModalClose: document.getElementById('evidence-modal-close'),
    };

    // =================================================================
    // RENDER FUNCTIONS
    // =================================================================
    const renderTickets = () => {
        if (!Array.isArray(state.tickets)) return;
        const searchQuery = dom.searchInput.value.toLowerCase();
        const filteredTickets = state.tickets.filter(ticket => {
            const customerName = ticket.userId?.displayName.toLowerCase() || 'unknown user';
            const subject = ticket.subject.toLowerCase();
            const matchesFilter = state.currentFilter === 'All' || ticket.status === state.currentFilter;
            const matchesSearch = [ticket._id.slice(-6), customerName, subject].some(term => term.includes(searchQuery));
            return matchesFilter && matchesSearch;
        });
        dom.ticketListContainer.innerHTML = '';
        if (filteredTickets.length === 0) {
            dom.ticketListContainer.innerHTML = `<div class="no-tickets-placeholder"><i class="ph-fill ph-ticket"></i><p>No tickets found.</p></div>`;
            return;
        }
        const fragment = document.createDocumentFragment();
        filteredTickets.forEach(ticket => {
            const card = document.createElement('article');
            card.className = 'ticket-card';
            card.dataset.ticketId = ticket._id;
            card.innerHTML = `
                <div class="card-header">
                    <span class="ticket-id">#${ticket._id.slice(-6)}</span>
                    <span class="status ${ticket.status.toLowerCase().replace(/ /g, '')}">${ticket.status}</span>
                </div>
                <h3 class="ticket-subject">${ticket.subject}</h3>
                <div class="card-footer">
                    <span class="ticket-customer">${ticket.userId?.displayName || 'Unknown User'}</span>
                    <span class="ticket-date">Updated: ${new Date(ticket.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>`;
            fragment.appendChild(card);
        });
        dom.ticketListContainer.appendChild(fragment);
    };

    const renderTicketDetail = (ticket) => {
        state.currentTicketId = ticket._id;
        document.getElementById('detail-ticket-id').textContent = `#${ticket._id.slice(-6)}`;
        document.getElementById('detail-ticket-subject').textContent = ticket.subject;
        document.getElementById('detail-ticket-description').textContent = ticket.description;
        document.getElementById('detail-customer-name').textContent = ticket.userId?.displayName || 'N/A';
        document.getElementById('detail-customer-email').textContent = ticket.userId?.email || 'N/A';
        document.getElementById('detail-created-date').textContent = new Date(ticket.createdAt).toLocaleString();
        document.getElementById('status-select').value = ticket.status;
        const evidenceContainer = document.getElementById('detail-ticket-evidence');
        if (ticket.imageUrl) {
            evidenceContainer.innerHTML = `<button class="btn-link" id="view-evidence-btn" data-image-url="${ticket.imageUrl}"><i class="ph ph-image"></i> View Attached Image</button>`;
        } else {
            evidenceContainer.innerHTML = `<p class="text-muted">No evidence attached.</p>`;
        }
        const repliesContainer = document.getElementById('detail-replies-container');
        repliesContainer.innerHTML = '';
        if (ticket.messages.length > 0) {
            const fragment = document.createDocumentFragment();
            ticket.messages.forEach(msg => {
                const replyEl = document.createElement('div');
                replyEl.className = `reply-message ${msg.isAdmin ? 'admin-reply' : 'user-reply'}`;
                const messageActionsHTML = msg.isAdmin ? `<div class="message-actions"><button class="edit-reply-btn" data-message-id="${msg._id}" title="Edit"><i class="ph ph-pencil-simple"></i></button><button class="delete-reply-btn" data-message-id="${msg._id}" title="Delete"><i class="ph ph-trash"></i></button></div>` : '';
                replyEl.innerHTML = `${messageActionsHTML}<div class="message-bubble"><div class="author"><strong>${msg.senderName}</strong></div><div class="message-content"><p>${msg.text.replace(/\n/g, '<br>')}</p></div></div>`;
                fragment.appendChild(replyEl);
            });
            repliesContainer.appendChild(fragment);
        } else {
            repliesContainer.innerHTML = `<div class="no-replies-placeholder"><i class="ph ph-chats"></i><p>No conversation history yet.</p></div>`;
        }
        
        // --- FIX #1: Reply form is now hidden based on ticket status ---
        const isTicketClosed = ticket.status === 'Resolved' || ticket.status === 'Closed';
        document.getElementById('reply-action-form').classList.toggle('hidden', isTicketClosed);
        
        document.getElementById('reply-textarea').value = '';
        dom.ticketsView.classList.add('hidden');
        dom.ticketDetailView.classList.remove('hidden');
        repliesContainer.scrollTop = repliesContainer.scrollHeight;
    };

    // =================================================================
    // EVENT HANDLERS
    // =================================================================
    const notifyUser = (options) => {
        if (window.AppAlert && typeof window.AppAlert.notify === 'function') {
            window.AppAlert.notify(options);
        }
    };

    const handleTabClick = (e) => {
        dom.tabs.forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        state.currentFilter = e.currentTarget.dataset.tabFilter;
        renderTickets();
    };
    
    const handleTicketCardClick = async (e) => {
        const card = e.target.closest('.ticket-card');
        if (card) {
            try {
                const ticketId = card.dataset.ticketId;
                const response = await supportTicketAPI.getTicketById(ticketId);
                renderTicketDetail(response.data);
            } catch (error) {
                notifyUser({ type: 'error', title: 'Error', message: `Could not load ticket: ${error.message}` });
            }
        }
    };
    
    const handleReplySubmit = async () => {
        const replyText = document.getElementById('reply-textarea').value.trim();
        if (!replyText || !state.currentTicketId) return;

        // --- FIX #2: Add a loading state to prevent double clicks and give user feedback ---
        dom.sendReplyBtn.disabled = true;
        dom.sendReplyBtn.innerHTML = `<i class="ph ph-spinner-gap"></i> Sending...`;

        try {
            await supportTicketAPI.addReply(state.currentTicketId, replyText);
            const response = await supportTicketAPI.getTicketById(state.currentTicketId);
            renderTicketDetail(response.data);
            notifyUser({ type: 'success', title: 'Reply Sent!', message: 'Your message has been successfully sent to the user.' });
        } catch (error) {
            // --- FIX #3: Provide a more descriptive error message to the user ---
            notifyUser({ type: 'error', title: 'Send Failed', message: `Could not send reply: ${error.message}` });
        } finally {
            // Always re-enable the button and restore its text
            dom.sendReplyBtn.disabled = false;
            dom.sendReplyBtn.innerHTML = `<i class="ph ph-paper-plane-tilt"></i> Send Reply`;
        }
    };

    const handleStatusUpdate = async () => {
        const newStatus = document.getElementById('status-select').value;
        if (!state.currentTicketId || !newStatus) return;
        try {
            await window.AppAlert.confirm({ type: 'primary', title: 'Update Status?', message: `Are you sure you want to change the status to "${newStatus}"?`, confirmText: 'Yes, Update' });
            await supportTicketAPI.updateTicketStatus(state.currentTicketId, newStatus);
            const response = await supportTicketAPI.getTicketById(state.currentTicketId);
            renderTicketDetail(response.data);
            notifyUser({ type: 'success', title: 'Status Updated', message: `Ticket moved to "${newStatus}".` });
        } catch (error) {
            if (error && error.message.toLowerCase() !== 'user cancelled the action.') {
                notifyUser({ type: 'error', title: 'Update Failed', message: error.message });
            }
        }
    };
    
    const handleDetailViewClick = async (e) => {
        const target = e.target;
        const viewEvidenceBtn = target.closest('#view-evidence-btn');
        const editBtn = target.closest('.edit-reply-btn');
        const deleteBtn = target.closest('.delete-reply-btn');
        if (viewEvidenceBtn) handleViewEvidence(viewEvidenceBtn);
        if (editBtn) await handleEditReply(editBtn.dataset.messageId);
        if (deleteBtn) await handleDeleteReply(deleteBtn.dataset.messageId);
    };

    const handleViewEvidence = (buttonElement) => {
        const imageUrl = buttonElement.dataset.imageUrl;
        if (imageUrl && dom.evidenceModal && dom.evidenceModalImage) {
            dom.evidenceModalImage.src = imageUrl;
            dom.evidenceModal.classList.remove('hidden');
        } else {
            notifyUser({ type: 'error', title: 'Error', message: 'Could not display the image.' });
        }
    };

    const handleEditReply = async (messageId) => {
        try {
            const response = await supportTicketAPI.getTicketById(state.currentTicketId);
            const message = response.data.messages.find(m => m._id === messageId);
            if (message) {
                state.editingMessage = { ticketId: state.currentTicketId, messageId };
                dom.editModalTextarea.value = message.text;
                dom.editModal.classList.remove('hidden');
                dom.editModalTextarea.focus();
            }
        } catch (error) {
            notifyUser({ type: 'error', title: 'Error', message: 'Could not fetch message to edit.' });
        }
    };

    const handleDeleteReply = async (messageId) => {
        try {
            await window.AppAlert.confirm({ type: 'danger', title: 'Delete Reply?', message: 'This action is permanent and cannot be undone.', confirmText: 'Yes, Delete' });
            await supportTicketAPI.deleteReply(state.currentTicketId, messageId);
            const response = await supportTicketAPI.getTicketById(state.currentTicketId);
            renderTicketDetail(response.data);
            // --- FIX #4: Add a descriptive message for a consistent UI ---
            notifyUser({ type: 'success', title: 'Reply Deleted', message: 'The message has been permanently removed.' });
        } catch (error) {
            if (error && error.message.toLowerCase() !== 'user cancelled the action.') {
                notifyUser({ type: 'error', title: 'Delete Failed', message: error.message });
            }
        }
    };

    const handleSaveEdit = async () => {
        const { ticketId, messageId } = state.editingMessage;
        const newText = dom.editModalTextarea.value.trim();
        if (!newText || !ticketId || !messageId) return;
        try {
            await supportTicketAPI.editReply(ticketId, messageId, newText);
            closeEditModal();
            const response = await supportTicketAPI.getTicketById(ticketId);
            renderTicketDetail(response.data);
            notifyUser({ type: 'success', title: 'Reply Updated' });
        } catch(error) {
            notifyUser({ type: 'error', title: 'Save Failed', message: error.message });
        }
    };

    // =================================================================
    // HELPER FUNCTIONS & INITIALIZATION
    // =================================================================
    const showListView = () => {
        dom.ticketDetailView.classList.add('hidden');
        dom.ticketsView.classList.remove('hidden');
        state.currentTicketId = null;
        renderTickets();
    };

    const closeEditModal = () => {
        dom.editModal.classList.add('hidden');
        state.editingMessage = { ticketId: null, messageId: null };
    };
    
    const closeEvidenceModal = () => {
        if (dom.evidenceModal) {
            dom.evidenceModal.classList.add('hidden');
            dom.evidenceModalImage.src = ""; 
        }
    };
    
    const loadHeader = async () => {
        try {
            const response = await fetch('../../components/header.html');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            dom.headerContainer.innerHTML = await response.text();
            if (window.initializeHeader) {
                window.initializeHeader();
                if (window.setHeader) {
                    window.setHeader('Support Center', 'Manage and respond to customer inquiries.');
                }
            }
        } catch (error) {
            console.error('Failed to load header component:', error);
        }
    };
    
    const setupEventListeners = () => {
        dom.tabs.forEach(tab => tab.addEventListener('click', handleTabClick));
        dom.searchInput.addEventListener('input', renderTickets);
        dom.ticketListContainer.addEventListener('click', handleTicketCardClick);
        dom.ticketDetailView.addEventListener('click', handleDetailViewClick);
        dom.backToListBtn.addEventListener('click', showListView);
        dom.sendReplyBtn.addEventListener('click', handleReplySubmit);
        dom.updateStatusBtn.addEventListener('click', handleStatusUpdate);
        dom.saveEditBtn.addEventListener('click', handleSaveEdit);
        dom.cancelEditBtn.addEventListener('click', closeEditModal);
        if (dom.evidenceModalClose) dom.evidenceModalClose.addEventListener('click', closeEvidenceModal);
        if (dom.evidenceModal) dom.evidenceModal.addEventListener('click', (e) => { if (e.target === dom.evidenceModal) closeEvidenceModal(); });
        window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !dom.evidenceModal.classList.contains('hidden')) closeEvidenceModal(); });
    };

    const initializeApp = async (loadHeaderFlag = true) => {
        if (loadHeaderFlag) await loadHeader();
        dom.ticketListContainer.innerHTML = `<div class="loading-placeholder"><i class="ph-fill ph-spinner-gap"></i><p>Loading tickets...</p></div>`;
        try {
            const response = await supportTicketAPI.getTickets();
            state.tickets = response.data.data;
            renderTickets();
        } catch (error) {
            dom.ticketListContainer.innerHTML = `<div class="no-tickets-placeholder error"><i class="ph-fill ph-warning-circle"></i><p>Could not load tickets.</p><small>${error.message}</small></div>`;
        }
    };

    setupEventListeners();
    initializeApp();
});