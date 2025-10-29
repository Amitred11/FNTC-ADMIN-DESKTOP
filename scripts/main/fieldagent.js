document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let allJobs = [];
    let currentJobId = null;
    let currentJobDetails = null;

    // --- DOM ELEMENT SELECTORS ---
    const headerContainer = document.getElementById('header-container');
    const jobListContainer = document.getElementById('job-list-container');
    const actionButtonsContainer = document.getElementById('action-buttons-container');

    // Centralized modal management object
    const modals = {
        statusUpdate: {
            overlay: document.getElementById('status-update-modal-overlay'),
            container: document.getElementById('status-update-modal'),
            form: document.getElementById('status-update-form')
        },
        detailsView: {
            overlay: document.getElementById('details-view-overlay'),
            container: document.getElementById('details-view-modal')
        }
    };

    // --- API HELPER ---
    const apiRequest = async (method, url, data = null) => {
        try {
            if (!window.electronAPI) throw new Error('API provider is not available.');
            const response = await window.electronAPI[method](url, data);
            if (!response || !response.ok) throw new Error(response.data?.message || `API call failed`);
            return { ok: true, data: response.data };
        } catch (error) {
            console.error(`API Error (${method} ${url}):`, error);
            AppAlert.notify({ type: 'error', title: 'API Error', message: error.message });
            return { ok: false, message: error.message };
        }
    };

    // --- VIEW & MODAL MANAGEMENT ---
    const toggleModal = (modalKey, show) => {
        const modal = modals[modalKey];
        if (!modal) return;
        modal.overlay.classList.toggle('hidden', !show);
        modal.container.classList.toggle('hidden', !show);
        if (!show && modal.form) modal.form.reset();
    };

    // --- RENDER FUNCTIONS (Updating the UI) ---
    const renderStats = (jobs) => {
        const today = new Date().toISOString().split('T')[0];
        document.querySelector('#stat-today .stat-value').textContent = jobs.filter(j => j.scheduledDate?.startsWith(today) && j.status !== 'Completed').length;
        document.querySelector('#stat-pending .stat-value').textContent = jobs.filter(j => ['Pending', 'Pending Acceptance', 'Assigned'].includes(j.status)).length;
        document.querySelector('#stat-in-progress .stat-value').textContent = jobs.filter(j => j.status === 'In Progress').length;
        document.querySelector('#stat-completed .stat-value').textContent = jobs.filter(j => j.completionDate?.startsWith(today)).length;
    };

    const renderJobList = (jobs) => {
        if (!jobs || jobs.length === 0) {
            jobListContainer.innerHTML = `<div class="placeholder">You have no active job orders.</div>`;
            return;
        }
        jobListContainer.innerHTML = jobs.map(job => {
            const customerName = job.userId ? job.userId.displayName : (job.customerDetails?.name || 'N/A');
            const address = job.userId?.profile?.address || job.customerDetails?.address || 'Address not available';
            
            const status = job.status || '';
            const statusClass = status.replace(/\s+/g, '_').toLowerCase();
            
            const actionText = status === 'Pending Acceptance' ? 'Review & Accept' : 'View Details & Update';
            const actionsHtml = status === 'Completed'
                ? `<div class="job-completed-indicator"><i class="ph-fill ph-check-circle"></i> Completed</div>`
                : `<button class="action-btn primary">${actionText}</button>`;

            return `
                <article class="job-card" data-job-id="${job._id}" data-status="${statusClass}">
                    <div class="job-card-header">
                        <div>
                            <div class="job-card-id">${job.jobId || `JO-${job._id.slice(-6)}`}</div>
                            <div class="job-card-customer">${customerName}</div>
                        </div>
                        <div class="status-badge status-${statusClass}">${status}</div>
                    </div>
                    <div class="job-card-body">
                        <div class="info-row"><i class="ph-fill ph-wrench"></i> <span>${job.type}</span></div>
                        <div class="info-row"><i class="ph-fill ph-map-pin"></i> <span>${address}</span></div>
                    </div>
                    <div class="job-card-actions">${actionsHtml}</div>
                </article>
            `;
        }).join('');
    };

    const renderJobDetails = (job) => {
        currentJobDetails = job;
        const customer = job.userId ? { name: job.userId.displayName, contact: job.userId.profile?.mobileNumber || 'N/A', address: `${job.userId.profile?.address || ''}, ${job.userId.profile?.city || ''}`.trim(), } : { name: job.customerDetails?.name || 'N/A', contact: job.customerDetails?.contactNumber || 'N/A', address: job.customerDetails?.address || 'N/A', };
        
        const status = job.status || '';
        const statusClass = status.replace(/\s+/g, '_').toLowerCase();
        const statusBadgeHtml = `<span class="status-badge status-${statusClass}">${status}</span>`;

        document.getElementById('modal-header-job-id').textContent = job.jobId || `JO-${job._id.slice(-6)}`;
        document.getElementById('modal-header-status').innerHTML = statusBadgeHtml;
        
        document.getElementById('detail-type').textContent = job.type;
        document.getElementById('detail-created').textContent = new Date(job.createdAt).toLocaleString();
        document.getElementById('detail-customer-name').textContent = customer.name;
        document.getElementById('detail-contact').textContent = customer.contact;
        document.getElementById('detail-address').textContent = customer.address;
        document.getElementById('detail-description').textContent = job.description;
        
        renderNotes(job.notes);
        renderActionButtons(job);
    };

    const renderNotes = (notes) => {
        const container = document.getElementById('notes-container');
        if (!notes || notes.length === 0) {
            container.innerHTML = `<div class="placeholder">No notes available.</div>`;
            return;
        }
        container.innerHTML = notes.slice().reverse().map(note => `
            <div class="note-item">
                <p class="note-text">${note.text}</p>
                <div class="note-meta">By ${note.author || 'System'} on ${new Date(note.timestamp).toLocaleString()}</div>
            </div>
        `).join('');
    };

    const renderActionButtons = (job) => {
        let buttonsHtml = '';
        const status = job.status || ''; 

        switch (status) {
            case 'Pending Acceptance':
                buttonsHtml = `<button class="action-btn danger" data-action="decline">Decline</button><button class="action-btn success" data-action="accept">Accept Job</button>`;
                break;
            case 'Assigned':
                buttonsHtml = `<button class="action-btn primary" data-action="start_work">Start Work</button>`;
                break;
            case 'In Progress':
                buttonsHtml = `<button class="action-btn secondary" data-action="on_hold">Place On Hold</button><button class="action-btn success" data-action="complete">Mark as Completed</button>`;
                break;
            case 'On Hold':
                buttonsHtml = `<button class="action-btn primary" data-action="resume_work">Resume Work</button>`;
                break;
            case 'Completed':
                buttonsHtml = `<div class="job-completed-indicator large"><i class="ph-fill ph-check-circle"></i> Job Completed</div>`;
                break;
            default:
                buttonsHtml = `<p class="text-muted">No actions available for status: ${status}</p>`;
        }
        actionButtonsContainer.innerHTML = buttonsHtml;
    };

    // --- EVENT HANDLERS ---

    const handleJobCardClick = async (jobId) => {
        currentJobId = jobId;
        toggleModal('detailsView', true);
        const result = await apiRequest('apiGet', `/job-orders/${jobId}`);
        if (result.ok) {
            renderJobDetails(result.data);
        } else {
            toggleModal('detailsView', false); 
        }
    };
    
    const handleActionClick = async (e) => {
    const action = e.target.dataset.action;
    if (!action) return;

    switch (action) {
        case 'accept':
            const acceptResult = await apiRequest('apiPut', `/job-orders/${currentJobId}/accept`, {}); 
            if (acceptResult.ok) {
                AppAlert.notify({ type: 'success', title: 'Job Accepted', message: 'The job is now in your active queue.' });
                renderJobDetails(acceptResult.data);
                fetchAllJobs();
            }
            break;
        case 'decline':
            try {
                await AppAlert.confirm({ title: 'Decline Job?', message: 'This will return the job to the assignment queue. Are you sure?', type: 'danger', confirmText: 'Yes, Decline' });
                const declineResult = await apiRequest('apiPut', `/job-orders/${currentJobId}/decline`, {}); 
                if (declineResult.ok) {
                    AppAlert.notify({ type: 'success', title: 'Job Declined' });
                    toggleModal('detailsView', false);
                    await fetchAllJobs();
                }
                } catch { /* User cancelled confirmation */ }
                break;
            
            case 'resume_work': openStatusModal('In Progress'); break;
            case 'start_work': openStatusModal('In Progress'); break;
            case 'on_hold': openStatusModal('On Hold'); break;
            case 'complete': openStatusModal('Completed'); break;
        }
    };
    
    const openStatusModal = (targetStatus) => {
        modals.statusUpdate.form.dataset.targetStatus = targetStatus;
        document.querySelector('#status-update-modal .modal-title').textContent = `Update Status to "${targetStatus}"`;
        toggleModal('statusUpdate', true);
    };

    const handleStatusUpdateSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const targetStatus = form.dataset.targetStatus;
        const note = form.elements.note.value;
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        const payload = { status: targetStatus, note };
        const result = await apiRequest('apiPut', `/job-orders/${currentJobId}/status`, payload);
        
        if (result.ok) {
            AppAlert.notify({ type: 'success', title: 'Status Updated', message: `Job status is now "${targetStatus}".` });
            toggleModal('statusUpdate', false);
            renderJobDetails(result.data); 
            fetchAllJobs(); 
        }
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirm Update';
    };

    // --- INITIALIZATION ---

    const fetchAllJobs = async () => {
        const result = await apiRequest('apiGet', '/job-orders/my-tasks');
        if (result.ok) {
            allJobs = result.data;
            renderStats(allJobs);
            renderJobList(allJobs);
        } else {
            jobListContainer.innerHTML = `<div class="placeholder error">Could not load jobs. Please try again later.</div>`;
        }
    };

    const initializeApp = async () => {
        const headerResponse = await fetch('../../components/header.html');
        if(headerResponse.ok) {
            headerContainer.innerHTML = await headerResponse.text();
            if (window.initializeHeader) {
                window.initializeHeader();
                window.setHeader('Field Agent Dashboard', 'Manage your assigned job orders and track your progress.');
            }
        }

        await fetchAllJobs();

        // --- GLOBAL EVENT LISTENERS ---
        jobListContainer.addEventListener('click', (e) => {
            const card = e.target.closest('.job-card');
            if (card) handleJobCardClick(card.dataset.jobId);
        });

        actionButtonsContainer.addEventListener('click', handleActionClick);
        modals.statusUpdate.form.addEventListener('submit', handleStatusUpdateSubmit);
        
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) { 
                    const modalKey = overlay.id.includes('status-update') ? 'statusUpdate' : 'detailsView';
                    toggleModal(modalKey, false);
                }
            });
        });

        document.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const overlay = btn.closest('.modal-overlay');
                if (overlay) {
                    const modalKey = overlay.id.includes('status-update') ? 'statusUpdate' : 'detailsView';
                    toggleModal(modalKey, false);
                }
            });
        });
    };

    initializeApp();
});