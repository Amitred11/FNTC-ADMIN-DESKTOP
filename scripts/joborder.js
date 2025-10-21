document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // APPLICATION STATE & DOM ELEMENTS
    // =================================================================
    let state = {
        jobOrders: [],
        availableAgents: [],
        subscribers: [],
        filters: { search: '', type: 'All Types' }
    };

    const tableBody = document.querySelector('.jobs-table tbody');
    const searchInput = document.getElementById('job-search');
    const typeFilter = document.getElementById('job-filter');

    // Dialogs
    const createOrderDialog = document.getElementById('createOrderDialog');
    const viewDetailDialog = document.getElementById('viewDetailDialog');
    const assignDialog = document.getElementById('assignDialog');
    const archiveDialog = document.getElementById('archiveDialog');

    // Forms
    const createOrderForm = document.getElementById('createOrderForm');
    const assignForm = document.getElementById('assignForm');

    // Buttons
    const createOrderBtn = document.getElementById('createOrderBtn');
    const archiveBtn = document.getElementById('archiveBtn');

    // =================================================================
    // RENDER FUNCTIONS (Update the UI)
    // =================================================================
    const renderTable = () => {
        tableBody.innerHTML = ''; // Clear existing rows

        const { search, type } = state.filters;
        const lowerCaseSearch = search.toLowerCase().trim();

        const filteredData = state.jobOrders.filter(job => {
            const matchesType = type === 'All Types' || job.type === type;
            if (!matchesType) return false;
            if (!lowerCaseSearch) return true;

            const customerName = job.userId ? (job.userId.displayName || '') : (job.customerDetails?.name || 'Walk-in');
            const assignedTech = job.assignedTo ? (job.assignedTo.displayName || '') : 'Unassigned';
            const shortId = job._id.slice(-6).toUpperCase();

            const searchableText = [
                customerName, assignedTech, job._id, shortId, job.type, job.status
            ].join(' ').toLowerCase();

            return searchableText.includes(lowerCaseSearch);
        });

        if (filteredData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 3rem;">No job orders found matching your criteria.</td></tr>';
            return;
        }

        filteredData.forEach(job => {
            const row = document.createElement('tr');
            row.dataset.jobId = job._id;
            const statusClass = job.status.toLowerCase().replace(/[\s\/]/g, '');
            const customerName = job.userId ? job.userId.displayName : (job.customerDetails?.name || 'Walk-in');
            const assignedTech = job.assignedTo ? job.assignedTo.displayName : 'Unassigned';
            const isAssignable = job.status === 'Pending Assignment';

            row.innerHTML = `
                <td>${job._id.slice(-6).toUpperCase()}</td>
                <td>${customerName}</td>
                <td>${job.type}</td>
                <td><span class="status-badge ${statusClass}">${job.status}</span></td>
                <td>${assignedTech}</td>
                <td class="actions-cell">
                    <button class="btn sm view-detail">View Details</button>
                    <button class="btn sm outline assign-tech" ${isAssignable ? '' : 'disabled'}>Assign Tech</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    };

    const updateStats = () => {
        const jobs = state.jobOrders;
        document.querySelector('[data-key="active"]').querySelector('.card-value').textContent = jobs.filter(j => j.status !== 'Completed').length;
        document.querySelector('[data-key="pending"]').querySelector('.card-value').textContent = jobs.filter(j => j.status === 'Pending Assignment').length;
        document.querySelector('[data-key="overdue"]').querySelector('.card-value').textContent = jobs.filter(j => j.status === 'Over Due').length;
        document.querySelector('[data-key="completed"]').querySelector('.card-value').textContent = 'N/A';
    };

    const populateAgentSelects = (selectElementId) => {
        const select = document.getElementById(selectElementId);
        if (!select) return;
        select.innerHTML = '<option value="" disabled selected>Select a technician...</option>';
        state.availableAgents.forEach(agent => {
            const option = document.createElement('option');
            option.value = agent._id;
            option.textContent = `${agent.displayName} (${agent.isAvailable ? 'Available' : 'Busy'})`;
            option.disabled = !agent.isAvailable;
            select.appendChild(option);
        });
    };

    const populateSubscriberSelect = () => {
        const select = document.getElementById('subscriber-select');
        if (!select) return;
        select.innerHTML = '<option value="" disabled selected>Select an existing subscriber...</option>';
         state.subscribers.forEach(user => {
        // Check for the properties of the new "flattened" object structure.
        if (user && user._id && user.displayName && user.activePlanName) {
            const option = document.createElement('option');
            // The user ID is now at the top level: user._id
            option.value = user._id; 
            // The plan name is also at the top level: user.activePlanName
            option.textContent = `${user.displayName} (${user.activePlanName})`; 
            select.appendChild(option);
        } else {
            console.warn('Skipping malformed subscriber object from API:', user);
        }
    });
    };

    // =================================================================
    // DIALOG & FORM HANDLING
    // =================================================================
    const openViewDialog = (job) => {
        document.getElementById('detail_jobid').textContent = job._id;
        document.getElementById('detail_type').textContent = job.type;
        document.getElementById('detail_status').textContent = job.status;
        document.getElementById('detail_description').textContent = job.description;
        document.getElementById('detail_date').textContent = new Date(job.createdAt).toLocaleDateString();
        
        const customerName = job.userId ? job.userId.displayName : (job.customerDetails?.name || 'Walk-in');
        document.getElementById('detail_customer').textContent = customerName;

        // *** UPDATED: Logic to show/hide and populate walk-in contact details ***
        const contactWrapper = document.getElementById('detail_customer_contact_wrapper');
        const contactSpan = document.getElementById('detail_customer_contact');
        if (!job.userId && job.customerDetails) {
            const contactParts = [];
            if (job.customerDetails.phone) contactParts.push(job.customerDetails.phone);
            if (job.customerDetails.email) contactParts.push(job.customerDetails.email);
            
            if (contactParts.length > 0) {
                contactSpan.textContent = contactParts.join(' / ');
                contactWrapper.style.display = 'block';
            } else {
                contactWrapper.style.display = 'none';
            }
        } else {
            contactWrapper.style.display = 'none';
        }

        const assignedTech = job.assignedTo ? job.assignedTo.displayName : 'Not yet assigned';
        document.getElementById('detail_assign_status').textContent = `Assigned to: ${assignedTech}`;
        viewDetailDialog.showModal();
    };

    const openAssignDialog = (job) => {
        assignDialog.dataset.jobId = job._id;
        document.getElementById('assign-job-id').textContent = job._id.slice(-6).toUpperCase();
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
                listContainer.innerHTML = response.data.map(job => `
                    <li class="archive-list-item">
                        <span><strong>${job._id.slice(-6).toUpperCase()}</strong> — ${job.type} — Archived on ${new Date(job.archivedAt).toLocaleDateString()}</span>
                        <button class="btn sm delete-archive-btn" data-id="${job._id}">Delete</button>
                    </li>
                `).join('');
            } else {
                listContainer.innerHTML = '<li>No archived jobs found.</li>';
            }
        } catch (error) {
            listContainer.innerHTML = `<li>Error loading archives: ${error.message}</li>`;
        }
    };

    // =================================================================
    // EVENT LISTENERS
    // =================================================================
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

    archiveDialog.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-archive-btn')) {
            const jobId = e.target.dataset.id;
            if (confirm(`Are you sure you want to permanently delete archived job ${jobId.slice(-6).toUpperCase()}?`)) {
                const response = await window.electronAPI.apiDelete(`/job-orders/archive/${jobId}`);
                if (response.ok) await fetchAndRenderArchives();
                else alert(`Error: ${response.data ? response.data.message : 'Failed to delete job.'}`);
            }
        }
    });

    tableBody.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (!row) return;
        const job = state.jobOrders.find(j => j._id === row.dataset.jobId);
        if (!job) return;
        if (e.target.classList.contains('view-detail')) openViewDialog(job);
        else if (e.target.classList.contains('assign-tech') && !e.target.disabled) openAssignDialog(job);
    });

    if (createOrderForm) {
        createOrderForm.elements.customerType.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isSubscriber = e.target.value === 'subscriber';
                document.getElementById('subscriber-select-container').style.display = isSubscriber ? 'block' : 'none';
                document.getElementById('walk-in-container').style.display = isSubscriber ? 'none' : 'grid';
                document.getElementById('subscriber-select').required = isSubscriber;
                createOrderForm.querySelector('input[name="customerName"]').required = !isSubscriber;
            });
        });

        createOrderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(createOrderForm);
            const autoAssign = document.getElementById('autoAssignCreate').checked;
            const customerType = formData.get('customerType');
            const body = {
                type: formData.get('type'),
                description: formData.get('description'),
                autoAssign: autoAssign,
                agentId: autoAssign ? null : formData.get('agentId')
            };

            // *** UPDATED: Collect separate fields for walk-in customer ***
            if (customerType === 'subscriber') {
                body.userId = formData.get('userId');
            } else {
                body.customerDetails = {
                    name: formData.get('customerName'),
                    phone: formData.get('customerPhone'),
                    email: formData.get('customerEmail')
                };
            }

            const response = await window.electronAPI.apiPost('/job-orders', body);
            if (response.ok) {
                createOrderDialog.close();
                await initializeApp();
            } else {
                alert(`Error: ${response.data ? response.data.message : 'Failed to create job order.'}`);
            }
        });
    }

    if (assignForm) {
        assignForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const jobId = assignDialog.dataset.jobId;
            const agentId = document.getElementById('manualTechAssign').value;
            if (!agentId) { alert('Please select a technician.'); return; }
            const response = await window.electronAPI.apiPut(`/job-orders/${jobId}/assign`, { agentId });
            if (response.ok) {
                assignDialog.close();
                await initializeApp();
            } else {
                alert(`Error: ${response.data ? response.data.message : 'Failed to assign technician.'}`);
            }
        });
    }

    // =================================================================
    // INITIALIZATION
    // =================================================================
    const initializeApp = async () => {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 3rem;">Loading jobs...</td></tr>';
        try {
            const [jobsResponse, agentsResponse, subscribersResponse] = await Promise.all([
                window.electronAPI.apiGet('/job-orders'),
                window.electronAPI.apiGet('/field-agents'),
                window.electronAPI.apiGet('/subscribers/list')
            ]);

            state.jobOrders = (jobsResponse && jobsResponse.ok) ? jobsResponse.data : [];
            state.availableAgents = (agentsResponse && agentsResponse.ok) ? agentsResponse.data : [];
            state.subscribers = (subscribersResponse && subscribersResponse.ok) ? subscribersResponse.data : [];

            if (!jobsResponse.ok) throw new Error(`Failed to load job orders: ${jobsResponse?.data?.message || 'Network Error'}`);

            updateStats();
            renderTable();
        } catch (error) {
            // *** FIX: Corrected typo in this line from <tr<td to <tr><td ***
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 3rem; color: red;">${error.message}</td></tr>`;
            console.error("Initialization failed:", error);
        }
    };

    initializeApp();
});