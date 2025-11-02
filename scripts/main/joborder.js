// src/views/main/joborder.js (Updated)

document.addEventListener('DOMContentLoaded', async () => {
    // --- STATE & ROLE MANAGEMENT (No Changes) ---
    const ALLOWED_ROLES = ['admin', 'field_agent'];
    let currentUserRole = null;

    try {
        const response = await window.electronAPI.getUserProfile();
        if (response && response.role) {
            currentUserRole = response.role;
        } else {
            throw new Error("Role not found in profile.");
        }
    } catch (e) {
        console.error("Critical security error: Could not fetch user profile.", e);
        renderAccessDenied();
        return;
    }

    if (!ALLOWED_ROLES.includes(currentUserRole)) {
        console.warn(`SECURITY: User with role '${currentUserRole}' attempted to access the job order page without permission.`);
        renderAccessDenied();
        return;
    }

    console.log("Permission granted. Initializing job order management page.");

    let state = {
        jobOrders: [],
        availableAgents: [],
        subscribers: [],
        filters: { search: '', type: 'All Types' }
    };
    
    // --- DOM ELEMENT SELECTORS (No Changes) ---
    const headerContainer = document.getElementById('header-container');
    const tableBody = document.querySelector('.jobs-table tbody');
    const searchInput = document.getElementById('job-search');
    const typeFilter = document.getElementById('job-filter');
    const createOrderDialog = document.getElementById('createOrderDialog');
    const viewDetailDialog = document.getElementById('viewDetailDialog');
    const assignDialog = document.getElementById('assignDialog');
    const archiveDialog = document.getElementById('archiveDialog');
    const createOrderForm = document.getElementById('createOrderForm');
    const assignForm = document.getElementById('assignForm');
    const createOrderBtn = document.getElementById('createOrderBtn');
    const archiveBtn = document.getElementById('archiveBtn');

    // --- HELPER FUNCTIONS (No Changes) ---
    const formatJobId = (job) => {
        if (!job) return 'N/A';
        if (job.jobId) return job.jobId;
        if (job._id) return `LEGACY-${job._id.slice(-6).toUpperCase()}`;
        return 'Invalid ID';
    };

    // =================================================================
    // RENDER FUNCTIONS (UI Updates)
    // =================================================================
    const loadHeader = async () => {
        try {
            const response = await fetch('../../components/header.html');
            if (!response.ok) throw new Error(`Failed to fetch header: ${response.status}`);
            headerContainer.innerHTML = await response.text();
            if (window.initializeHeader) { window.initializeHeader(); }
        } catch (error) {
            console.error('Failed to load header component:', error);
            headerContainer.innerHTML = `<p class="error-message">Error: Header failed to load.</p>`;
        }
    };

    const renderTable = () => {
        tableBody.innerHTML = '';
        const { search, type } = state.filters;
        const lowerCaseSearch = search.toLowerCase().trim();

        const filteredData = state.jobOrders.filter(job => {
            const matchesType = type === 'All Types' || job.type === type;
            if (!matchesType) return false;
            if (!lowerCaseSearch) return true;
            const customerName = job.userId ? (job.userId.displayName || '') : (job.customerDetails?.name || 'Walk-in');
            const assignedTech = job.assignedTo ? (job.assignedTo.displayName || '') : 'Unassigned';
            const searchableText = [customerName, assignedTech, job._id, formatJobId(job), job.type, job.status].join(' ').toLowerCase();
            return searchableText.includes(lowerCaseSearch);
        });

        if (filteredData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-12">No job orders found.</td></tr>';
            return;
        }

        filteredData.forEach(job => {
            const row = document.createElement('tr');
            row.dataset.jobId = job._id;
            const statusClass = job.status.toLowerCase().replace(/[\s\/]/g, '');
            const customerName = job.userId ? job.userId.displayName : (job.customerDetails?.name || 'Walk-in');
            const assignedTech = job.assignedTo ? job.assignedTo.displayName : 'Unassigned';
            
            const isCompleted = job.status === 'Completed';
            const viewBtn = `<button class="btn sm view-detail">View</button>`;
            const assignBtn = `<button class="btn sm outline assign-tech" ${job.status !== 'Pending Assignment' ? 'disabled' : ''}>Assign</button>`;
            const archiveBtn = `<button class="btn sm ghost archive-job-btn">Archive</button>`;
            const deleteBtn = (currentUserRole === 'admin' && !isCompleted) 
                ? `<button class="btn sm icon-only danger-hover delete-job-btn" title="Delete Job"><i class="ph ph-trash"></i></button>`
                : '';
            
            row.innerHTML = `
                <td>${formatJobId(job)}</td>
                <td>${customerName}</td>
                <td>${job.type}</td>
                <td><span class="status-badge ${statusClass}">${job.status}</span></td>
                <td>${assignedTech}</td>
                <td class="actions-cell">${isCompleted ? viewBtn + archiveBtn : viewBtn + assignBtn}${deleteBtn}</td>
            `;
            tableBody.appendChild(row);
        });
    };

    const updateStats = () => {
        const jobs = state.jobOrders;
        document.querySelector('[data-key="active"]').querySelector('.card-value').textContent = jobs.filter(j => j.status !== 'Completed').length;
        document.querySelector('[data-key="pending"]').querySelector('.card-value').textContent = jobs.filter(j => j.status === 'Pending Assignment').length;
        document.querySelector('[data-key="overdue"]').querySelector('.card-value').textContent = jobs.filter(j => j.status === 'Over Due').length;
        document.querySelector('[data-key="completed"]').querySelector('.card-value').textContent = jobs.filter(j => j.status === 'Completed').length;
    };
    
    // --- NEW: Renders job notes and evidence, adapted from fieldagent.js ---
    const renderNotes = (notes) => {
        const container = document.getElementById('detail-notes-container');
        if (!container) return; // Fail gracefully if the element doesn't exist

        if (!notes || notes.length === 0) {
            container.innerHTML = `<div class="placeholder">No notes or history available for this job.</div>`;
            return;
        }

        // Display notes from most recent to oldest
        container.innerHTML = notes.slice().reverse().map(note => {
            const noteTextHtml = `<p class="note-text">${note.text || 'System Update'}</p>`;
            const noteMetaHtml = `<div class="note-meta">By ${note.author || 'System'} on ${new Date(note.timestamp).toLocaleString()}</div>`;
            
            let evidenceHtml = '';
            if (note.evidences && note.evidences.length > 0) {
                const evidenceThumbnails = note.evidences.map(evidence => `
                    <img src="${evidence.url}" alt="Evidence" class="note-evidence-thumbnail" data-lightbox-src="${evidence.url}">
                `).join('');

                evidenceHtml = `
                    <div class="evidence-box">
                        <div class="evidence-box-header">
                            <i class="ph-fill ph-camera"></i>
                            <span>Evidence from this update</span>
                        </div>
                        <div class="note-evidences">${evidenceThumbnails}</div>
                    </div>`;
            }

            return `<div class="note-item">${noteTextHtml}${noteMetaHtml}</div>${evidenceHtml}`;
        }).join('');
    };

    // --- MODIFIED: Upgraded with detailed rendering from fieldagent.js ---
    const openViewDialog = (job) => {
        // --- Job Info ---
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
        viewDetailDialog.showModal();
    };

    // --- Other Dialog Functions (No Changes) ---
    const populateAgentSelects = (selectElementId) => {
        const select = document.getElementById(selectElementId);
        if (!select) return;
        select.innerHTML = '<option value="" disabled selected>Select a technician...</option>';
        state.availableAgents.forEach(agent => {
            const option = document.createElement('option');
            option.value = agent._id;
            option.textContent = `${agent.displayName} (Pending: ${agent.pendingJobs}, In Progress: ${agent.inProgressJobs})`;
            select.appendChild(option);
        });
    };

    const populateSubscriberSelect = () => {
        const select = document.getElementById('subscriber-select');
        if (!select) return;
        select.innerHTML = '<option value="" disabled selected>Select an existing subscriber...</option>';
        state.subscribers.forEach(user => {
            if (user && user._id && user.displayName && user.activePlanName) {
                const option = document.createElement('option');
                option.value = user._id; 
                option.textContent = `${user.displayName} (${user.activePlanName})`; 
                select.appendChild(option);
            }
        });
    };

    const openAssignDialog = (job) => {
        assignDialog.dataset.jobId = job._id;
        document.getElementById('assign-job-id').textContent = formatJobId(job);
        populateAgentSelects('manualTechAssign');
        assignForm.reset();
        assignDialog.showModal();
    };

    const fetchAndRenderArchives = async () => {
        const listContainer = document.getElementById('archive-list-container');
        listContainer.innerHTML = '<li>Loading archives...</li>';
        try {
            const response = await window.electronAPI.apiGet('/job-orders/archive');
            if (response.ok && response.data.length > 0) {
                listContainer.innerHTML = response.data.map(job => `<li class="archive-list-item"><span><strong>${formatJobId(job)}</strong> — ${job.type} — Archived on ${new Date(job.archivedAt).toLocaleDateString()}</span><button class="btn sm delete-archive-btn" data-id="${job._id}">Delete</button></li>`).join('');
            } else {
                listContainer.innerHTML = '<li>No archived jobs found.</li>';
            }
        } catch (error) {
            AppAlert.notify({ type: 'error', title: 'Error', message: `Could not load archives: ${error.message}`});
        }
    };
    
    // --- EVENT LISTENERS (Largely Unchanged) ---
    const setupEventListeners = () => {
        searchInput.addEventListener('input', (e) => { state.filters.search = e.target.value; renderTable(); });
        typeFilter.addEventListener('change', (e) => { state.filters.type = e.target.value; renderTable(); });

        createOrderBtn.addEventListener('click', () => {
            createOrderForm.reset();
            populateSubscriberSelect();
            populateAgentSelects('manualTechCreate');
            document.querySelector('input[name="customerType"][value="subscriber"]').checked = true;
            document.getElementById('subscriber-select-container').style.display = 'block';
            document.getElementById('walk-in-container').style.display = 'none';
            document.getElementById('subscriber-select').required = true;
            createOrderForm.querySelector('input[name="customerName"]').required = false;
            createOrderDialog.showModal();
        });

        archiveBtn.addEventListener('click', () => { fetchAndRenderArchives(); archiveDialog.showModal(); });

        // Table actions
        tableBody.addEventListener('click', async (e) => {
            const button = e.target.closest('button'); 
            if (!button) return;
            const row = button.closest('tr');
            if (!row) return;
            const job = state.jobOrders.find(j => j._id === row.dataset.jobId);
            if (!job) return;

            if (button.classList.contains('view-detail')) {
                openViewDialog(job);
            } else if (button.classList.contains('assign-tech') && !button.disabled) {
                openAssignDialog(job);
            } else if (button.classList.contains('archive-job-btn')) {
                try {
                    await AppAlert.confirm({ title: 'Archive Job?', message: `Archive job order ${formatJobId(job)}?`, confirmText: 'Yes, Archive' });
                    const response = await window.electronAPI.apiPost(`/job-orders/${job._id}/archive`, {});
                    if (response.ok) {
                        AppAlert.notify({ type: 'success', title: 'Archived', message: 'Job order moved to archive.' });
                        await initializeApp();
                    } else throw new Error(response.data?.message);
                } catch (error) {
                    if (error) AppAlert.notify({ type: 'error', title: 'Archive Failed', message: error.message });
                }
            } else if (button.classList.contains('delete-job-btn')) {
                try {
                    await AppAlert.confirmOnDialog({ title: 'Permanently Delete?', message: `Permanently delete job <strong>${formatJobId(job)}</strong>? This cannot be undone.`, confirmText: 'Yes, Delete It', type: 'danger' });
                    const response = await window.electronAPI.apiDelete(`/job-orders/${job._id}`);
                    if (response.ok) {
                        AppAlert.notify({ type: 'success', title: 'Deleted', message: 'The job order was deleted.' });
                        await initializeApp();
                    } else throw new Error(response.data?.message);
                } catch (error) {
                    if (error) AppAlert.notify({ type: 'error', title: 'Deletion Failed', message: error.message });
                }
            }
        });

        // Form submissions
        createOrderForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(createOrderForm);
            const body = {
                type: formData.get('type'),
                description: formData.get('description'),
                autoAssign: document.getElementById('autoAssignCreate').checked,
                agentId: !document.getElementById('autoAssignCreate').checked ? formData.get('agentId') : null
            };
            if (formData.get('customerType') === 'subscriber') {
                body.userId = formData.get('userId');
            } else {
                body.customerDetails = { name: formData.get('customerName'), phone: formData.get('customerPhone'), email: formData.get('customerEmail') };
            }
            const response = await window.electronAPI.apiPost('/job-orders', body);
            if (response.ok) {
                AppAlert.notify({ type: 'success', title: 'Success', message: 'New job order created.' });
                createOrderDialog.close();
                await initializeApp();
            } else {
                AppAlert.notify({ type: 'error', title: 'Creation Failed', message: response.data?.message });
            }
        });

        assignForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const jobId = assignDialog.dataset.jobId;
            const agentId = document.getElementById('manualTechAssign').value;
            if (!agentId) return AppAlert.notify({ type: 'warning', title: 'Selection Required', message: 'Please select a technician.' });
            
            const response = await window.electronAPI.apiPut(`/job-orders/${jobId}/assign`, { agentId });
            if (response.ok) {
                AppAlert.notify({ type: 'success', title: 'Technician Assigned' });
                assignDialog.close();
                await initializeApp();
            } else {
                AppAlert.notify({ type: 'error', title: 'Assignment Failed', message: response.data?.message });
            }
        });
    };

    // =================================================================
    // INITIALIZATION
    // =================================================================
    const initializeApp = async () => {
        await loadHeader(); 
        if (window.setHeader) {
            window.setHeader('Job Order', 'Overview of all service requests and current assignments.');
        }
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-12">Loading jobs...</td></tr>';
        try {
            const [jobsResponse, agentsResponse, subscribersResponse] = await Promise.all([
                window.electronAPI.apiGet('/job-orders'),
                window.electronAPI.apiGet('/field-agents'),
                window.electronAPI.apiGet('/subscribers/list')
            ]);
            state.jobOrders = jobsResponse?.ok ? jobsResponse.data : [];
            state.availableAgents = agentsResponse?.ok ? agentsResponse.data : [];
            state.subscribers = subscribersResponse?.ok ? subscribersResponse.data : [];
            if (!jobsResponse.ok) throw new Error(jobsResponse?.data?.message || 'Network Error');
            updateStats();
            renderTable();
        } catch (error) {
            AppAlert.notify({ type: 'error', title: 'Initialization Failed', message: `Could not load page data: ${error.message}`});
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-12 text-red-600">Failed to load data.</td></tr>`;
        }
    };

    setupEventListeners();
    initializeApp();
});