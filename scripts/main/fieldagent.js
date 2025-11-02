// fieldagent.js (Corrected)

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let allJobs = [];
    let showCompleted = false; // State for our filter
    let currentJobId = null;
    let currentJobDetails = null;
    let evidenceFiles = [];

    // --- DOM ELEMENT SELECTORS ---
    const headerContainer = document.getElementById('header-container');
    const jobListContainer = document.getElementById('job-list-container');
    const filterToggleButton = document.getElementById('filter-toggle-btn');
    const actionButtonsContainer = document.getElementById('action-buttons-container');
    const photoEvidenceInput = document.getElementById('photo-evidence');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const lightboxOverlay = document.getElementById('image-lightbox-overlay');
    const lightboxImage = document.getElementById('lightbox-image');

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
    const apiRequest = async (method, url, data = null, isFormData = false) => {
        try {
            if (!window.electronAPI) throw new Error('API provider is not available.');
            const response = await window.electronAPI[method](url, data, { isFormData });
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

    const openLightbox = (imageSrc) => {
        lightboxImage.src = imageSrc;
        lightboxOverlay.classList.remove('hidden');
    };

    const closeLightbox = () => {
        lightboxOverlay.classList.add('hidden');
        lightboxImage.src = ''; // Clear src
    };

    // --- RENDER FUNCTIONS (Updating the UI) ---
    const renderStats = (jobs) => {
        const today = new Date().toISOString().split('T')[0];
        document.querySelector('#stat-today .stat-value').textContent = jobs.filter(j => j.scheduledDate?.startsWith(today) && j.status !== 'Completed').length;
        document.querySelector('#stat-pending .stat-value').textContent = jobs.filter(j => ['Pending', 'Pending Acceptance', 'Assigned'].includes(j.status)).length;
        document.querySelector('#stat-in-progress .stat-value').textContent = jobs.filter(j => j.status === 'In Progress').length;
        document.querySelector('#stat-completed .stat-value').textContent = jobs.filter(j => j.status === 'Completed').length;
    };

    const renderJobList = (jobsToRender) => {
        if (!jobsToRender || jobsToRender.length === 0) {
            jobListContainer.innerHTML = `<div class="placeholder" style="color:white">No jobs match the current filter.</div>`;
            return;
        }
        jobListContainer.innerHTML = jobsToRender.map(job => {
            const customerName = job.userId ? job.userId.displayName : (job.customerDetails?.name || 'N/A');
            const status = job.status || '';
            const statusClass = status.replace(/\s+/g, '_').toLowerCase();
            const actionText = status === 'Pending Acceptance' ? 'Review & Accept' : 'View Details & Update';
            const actionsHtml = status === 'Completed'
                ? `<button class="action-btn secondary">View Details</button>`
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
                    </div>
                    <div class="job-card-actions">${actionsHtml}</div>
                </article>
            `;
        }).join('');
    };

    const renderFilteredJobList = () => {
        const jobsToRender = showCompleted 
            ? allJobs 
            : allJobs.filter(job => job.status !== 'Completed');
        renderJobList(jobsToRender);
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
        if (!container) return;
        if (!notes || notes.length === 0) {
            container.innerHTML = `<div class="placeholder">No notes available.</div>`;
            return;
        }
        const historyHtml = notes.slice().reverse().map(note => {
            const noteBlock = `
                <div class="note-item">
                    <p class="note-text">${note.text || 'Status Update'}</p>
                    <div class="note-meta">By ${note.author || 'System'} on ${new Date(note.timestamp).toLocaleString()}</div>
                </div>
            `;
            if (note.evidences && note.evidences.length > 0) {
                const evidencesHtml = note.evidences.map(evidence => `
                    <img src="${evidence.url}" alt="Evidence" class="note-evidence-thumbnail" data-lightbox-src="${evidence.url}">
                `).join('');
                const evidenceBlock = `
                    <div class="evidence-box">
                        <div class="evidence-box-header">
                            <i class="ph-fill ph-camera"></i>
                            <span>Evidence from this update</span>
                        </div>
                        <div class="note-evidences">
                            ${evidencesHtml}
                        </div>
                    </div>
                `;
                return noteBlock + evidenceBlock;
            }
            return noteBlock;
        }).join('');
        container.innerHTML = historyHtml;
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

    const renderImagePreviews = () => {
        imagePreviewContainer.innerHTML = '';
        evidenceFiles.forEach((file, index) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            const img = document.createElement('img');
            img.className = 'preview-image';
            img.src = URL.createObjectURL(file);
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-image-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.type = 'button';
            removeBtn.dataset.index = index;
            previewItem.appendChild(img);
            previewItem.appendChild(removeBtn);
            imagePreviewContainer.appendChild(previewItem);
        });
    };

    // --- EVENT HANDLERS ---
    const handleJobCardClick = async (jobId) => {
        currentJobId = jobId;
        toggleModal('detailsView', true);
        const result = await apiRequest('apiGet', `/job-orders/${jobId}`);
        if (result.ok) renderJobDetails(result.data);
        else toggleModal('detailsView', false);
    };

    const handleActionClick = async (e) => {
        const action = e.target.dataset.action;
        if (!action) return;

        let result;

        try {
            switch (action) {
                case 'accept':
                    result = await apiRequest('apiPut', `/job-orders/${currentJobId}/accept`, {});
                    if (result.ok) {
                        AppAlert.notify({ type: 'success', title: 'Job Accepted', message: 'The job is now in your active queue.' });
                        renderJobDetails(result.data);
                        fetchAllJobs();
                    }
                    break;
                case 'decline':
                    await AppAlert.confirm({ title: 'Decline Job?', message: 'This will return the job to the assignment queue. Are you sure?', type: 'danger', confirmText: 'Yes, Decline' });
                    result = await apiRequest('apiPut', `/job-orders/${currentJobId}/decline`, {});
                    if (result.ok) {
                        AppAlert.notify({ type: 'success', title: 'Job Declined' });
                        toggleModal('detailsView', false);
                        await fetchAllJobs();
                    }
                    break;
                
                case 'start_work':
                case 'resume_work': {
                    const isStarting = action === 'start_work';
                    const title = isStarting ? 'Start Work?' : 'Resume Work?';
                    const confirmMessage = `This will set the job status to "In Progress". Proceed?`;
                    const noteText = isStarting ? 'Work has been started by the field agent.' : 'Work has been resumed.';
                    
                    await AppAlert.confirm({ title, message: confirmMessage, type: 'info', confirmText: 'Yes, Proceed' });

                    const payload = {
                        status: 'In Progress',
                        note: noteText,
                    };
                    
                    result = await apiRequest('apiPut', `/job-orders/${currentJobId}/status`, payload, true);
                    
                    if (result.ok) {
                        AppAlert.notify({ type: 'success', title: 'Work Status Updated', message: 'The job is now "In Progress".' });
                        renderJobDetails(result.data);
                        await fetchAllJobs();
                    }
                    break;
                }
                case 'on_hold':
                case 'complete':
                    openStatusModal(action === 'on_hold' ? 'On Hold' : 'Completed');
                    break;
            }
        } catch (err) {
            if (err) console.log('Action cancelled or failed:', err);
        }
    };
    function arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    const handleStatusUpdateSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const targetStatus = form.dataset.targetStatus;
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        const payload = {
            status: targetStatus,
        };

        if (targetStatus === 'On Hold') {
            payload.note = evidenceFiles.length > 0 
                ? 'Job placed on hold with evidence.' 
                : 'Job placed on hold.';
        } else if (targetStatus === 'Completed') {
            if (evidenceFiles.length === 0) {
                AppAlert.notify({ type: 'error', title: 'Validation Error', message: 'Please upload at least one photo as evidence.' });
                submitBtn.disabled = false;
                submitBtn.textContent = 'Confirm Update';
                return;
            }
            payload.note = form.elements.completedNote.value || 'Job marked as completed.';
        }

        if (evidenceFiles.length > 0) {
            console.log(`[Renderer] Reading and encoding ${evidenceFiles.length} file(s) to Base64...`);
            
            try {
                payload.evidences = await Promise.all(
                    evidenceFiles.map(async (file) => {
                        const buffer = await file.arrayBuffer();
                        const base64String = arrayBufferToBase64(buffer); // Convert to Base64
                        console.log(`[Renderer] Encoded ${file.name} to Base64 string of length ${base64String.length}.`);
                        return {
                            name: file.name,
                            base64: base64String
                        };
                    })
                );
            } catch (error) {
                console.error('[Renderer] Error encoding files:', error);
                AppAlert.notify({ type: 'error', title: 'File Error', message: 'Could not process one of the selected files.' });
                submitBtn.disabled = false;
                submitBtn.textContent = 'Confirm Update';
                return;
            }
        }

        const result = await apiRequest('apiPut', `/job-orders/${currentJobId}/status`, payload, true);

        if (result.ok) {
            AppAlert.notify({ type: 'success', title: 'Status Updated', message: `Job status is now "${targetStatus}".` });
            toggleModal('statusUpdate', false);
            const updatedJobResult = await apiRequest('apiGet', `/job-orders/${currentJobId}`);
            if (updatedJobResult.ok) renderJobDetails(updatedJobResult.data);
            await fetchAllJobs();
        }

        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirm Update';
    };

    const openStatusModal = (targetStatus) => {
        const form = modals.statusUpdate.form;
        form.dataset.targetStatus = targetStatus;
        document.querySelector('#status-update-modal .modal-title').textContent = `Update Status to "${targetStatus}"`;
        form.reset();
        evidenceFiles = [];
        renderImagePreviews();

        // ================== START OF FIX ==================
        // Before trying to change the style of an element, first check if it exists.
        const onHoldGroup = document.getElementById('on-hold-reason-group');
        if (onHoldGroup) {
            onHoldGroup.style.display = targetStatus === 'On Hold' ? 'block' : 'none';
        }

        const evidenceGroup = document.getElementById('completed-evidence-group');
        if (evidenceGroup) {
            const showEvidence = (targetStatus === 'On Hold' || targetStatus === 'Completed');
            evidenceGroup.style.display = showEvidence ? 'block' : 'none';
        }
        // ================== END OF FIX ==================
        
        toggleModal('statusUpdate', true);
    };
    
    // --- INITIALIZATION ---
   const fetchAllJobs = async () => {
        const result = await apiRequest('apiGet', '/job-orders/my-tasks');
        if (result.ok) {
            allJobs = result.data;
            renderStats(allJobs);
            // MODIFIED: Initial render is now handled by the filter function
            renderFilteredJobList(); 
        } else {
            jobListContainer.innerHTML = `<div class="placeholder error">Could not load jobs. Please try again later.</div>`;
        }
    };
    const initializeApp = async () => {
        const headerResponse = await fetch('../../components/header.html');
        if (headerResponse.ok) {
            headerContainer.innerHTML = await headerResponse.text();
            if (window.initializeHeader) {
                window.initializeHeader();
                window.setHeader('Field Agent Dashboard', 'Manage your assigned job orders and track your progress.');
            }
        }
        await fetchAllJobs();

        document.getElementById('details-view-modal').addEventListener('click', (e) => {
            if (e.target.matches('.note-evidence-thumbnail')) {
                const imageUrl = e.target.dataset.lightboxSrc;
                if (imageUrl) openLightbox(imageUrl);
            }
        });

        jobListContainer.addEventListener('click', (e) => {
            const card = e.target.closest('.job-card');
            if (card) {
                // Check if the click was on a button inside the card actions
                const actionButton = e.target.closest('.action-btn');
                if (actionButton) {
                    handleJobCardClick(card.dataset.jobId);
                }
            }
        });
        filterToggleButton.addEventListener('click', () => {
            showCompleted = !showCompleted;
            filterToggleButton.classList.toggle('active', showCompleted);
            const buttonText = filterToggleButton.querySelector('span');
            buttonText.textContent = showCompleted ? 'Showing All' : 'Show Completed';
            renderFilteredJobList();
        });
        actionButtonsContainer.addEventListener('click', handleActionClick);
        modals.statusUpdate.form.addEventListener('submit', handleStatusUpdateSubmit);

        photoEvidenceInput.addEventListener('change', (e) => {
            evidenceFiles = Array.from(e.target.files);
            renderImagePreviews();
        });

        imagePreviewContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-image-btn')) {
                const indexToRemove = parseInt(e.target.dataset.index, 10);
                evidenceFiles.splice(indexToRemove, 1);
                const dataTransfer = new DataTransfer();
                evidenceFiles.forEach(file => dataTransfer.items.add(file));
                photoEvidenceInput.files = dataTransfer.files;
                renderImagePreviews();
            } else if (e.target.classList.contains('preview-image')) {
                openLightbox(e.target.src);
            }
        });

        lightboxOverlay.addEventListener('click', closeLightbox);
        document.querySelector('.lightbox-close-btn').addEventListener('click', closeLightbox);

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