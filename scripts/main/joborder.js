function renderAccessDenied() {
    const layout = document.getElementById('layout');
    if (layout) {
        layout.style.display = 'none';
    }

    document.body.style.backgroundColor = '#FFFFFF';
    document.body.innerHTML = '';

    if (!document.getElementById('access-denied-container')) {
        const deniedContainer = document.createElement('div');
        deniedContainer.id = 'access-denied-container';
        deniedContainer.style.cssText = `
            text-align: center;
            padding: 40px 20px;
            width: 100vw; /* Use viewport width */
            height: 100vh; /* Use viewport height */
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            background-color: #FFFFFF; /* White background */
            position: fixed;
            top: 0;
            left: 0;
            z-index: 99999; /* Higher z-index to be safe */
            font-family: 'Poppins', sans-serif; /* Ensure consistent font */
        `;

        deniedContainer.innerHTML = `
            <div style="font-size: 6rem; color: #E53935; margin-bottom: 1.5rem;">
                <i class="ph-fill ph-hand-palm"></i>
            </div>
            <h1 style="color: #333; font-size: 3rem; margin: 0; font-weight: 600;">Access Denied</h1>
            <p style="font-size: 1.25rem; color: #6c757d; max-width: 450px; margin-top: 1rem; line-height: 1.6;">
                You do not have the required permissions to access this page.
            </p>
            <button id="go-back-btn" style="margin-top: 2.5rem; padding: 14px 28px; font-size: 1.1rem; cursor: pointer; border: none; background-color: #0A3D62; color: white; border-radius: 8px; font-weight: 500; transition: background-color 0.2s ease;">
                Return to Previous Page
            </button>
        `;
        document.body.appendChild(deniedContainer);

        const goBackButton = document.getElementById('go-back-btn');
        goBackButton.addEventListener('click', () => {
            history.back();
        });
        goBackButton.onmouseover = () => { goBackButton.style.backgroundColor = '#08304f'; };
        goBackButton.onmouseout = () => { goBackButton.style.backgroundColor = '#0A3D62'; };
    }
}

document.addEventListener('DOMContentLoaded', async () => {
const ALLOWED_ROLES = ['admin', 'field_agent'];
let currentUserRole = null;

try {
    const response = await window.electronAPI.getUserProfile();
    const user = response;

    if (user && user.role) {
        currentUserRole = user.role;
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
const headerContainer = document.getElementById('header-container');
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


const formatJobId = (job) => {
        if (!job) return 'N/A';
        if (job.jobId) {
            return job.jobId;
        }
        if (job._id) {
            return `LEGACY-${job._id.slice(-6).toUpperCase()}`;
        }
        return 'Invalid ID';
    };

// =================================================================
// RENDER FUNCTIONS (Update the UI)
// =================================================================
const loadHeader = async () => {
    try {
        const response = await fetch('../../components/header.html');
        if (!response.ok) throw new Error(`Failed to fetch header: ${response.status}`);
        headerContainer.innerHTML = await response.text();
        if (window.initializeHeader) { window.initializeHeader(); } 
        else { console.error("Header script not loaded or initializeHeader function not found."); }
    } catch (error) {
        console.error('Failed to load header component:', error);
        headerContainer.innerHTML = `<p class="error-message" style="text-align: center; color: red;">Error: Header failed to load.</p>`;
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
        const searchableText = [customerName, assignedTech, job._id, formatJobId(job._id), job.type, job.status].join(' ').toLowerCase();
        return searchableText.includes(lowerCaseSearch);
    });

    if (filteredData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 3rem;">No job orders found.</td></tr>';
        return;
    }

    filteredData.forEach(job => {
        const row = document.createElement('tr');
        row.dataset.jobId = job._id;
        const statusClass = job.status.toLowerCase().replace(/[\s\/]/g, '');
        const customerName = job.userId ? job.userId.displayName : (job.customerDetails?.name || 'Walk-in');
        const assignedTech = job.assignedTo ? job.assignedTo.displayName : 'Unassigned';
        
        let actionButtons = '';
        const isCompleted = job.status === 'Completed';

        const viewBtn = `<button class="btn sm view-detail">View</button>`;
        const assignBtn = `<button class="btn sm outline assign-tech" ${job.status !== 'Pending Assignment' ? 'disabled' : ''}>Assign</button>`;
        const archiveBtn = `<button class="btn sm ghost archive-job-btn">Archive</button>`;
        const deleteBtn = (currentUserRole === 'admin' && !isCompleted) 
            ? `<button class="btn sm icon-only danger-hover delete-job-btn" title="Delete Job"><i class="ph ph-trash"></i></button>`
            : '';

        if (isCompleted) {
            actionButtons = `${viewBtn}${archiveBtn}${deleteBtn}`;
        } else {
            actionButtons = `${viewBtn}${assignBtn}${deleteBtn}`;
        }
        
        row.innerHTML = `
            <td>${formatJobId(job)}</td>
            <td>${customerName}</td>
            <td>${job.type}</td>
            <td><span class="status-badge ${statusClass}">${job.status}</span></td>
            <td>${assignedTech}</td>
            <td class="actions-cell">${actionButtons}</td>
        `;
        tableBody.appendChild(row);
    });
};

const updateStats = () => {
    const jobs = state.jobOrders;

    const totalCompleted = jobs.filter(j => j.status === 'Completed').length;

    document.querySelector('[data-key="active"]').querySelector('.card-value').textContent = jobs.filter(j => j.status !== 'Completed').length;
    document.querySelector('[data-key="pending"]').querySelector('.card-value').textContent = jobs.filter(j => j.status === 'Pending Assignment').length;
    document.querySelector('[data-key="overdue"]').querySelector('.card-value').textContent = jobs.filter(j => j.status === 'Over Due').length;
    document.querySelector('[data-key="completed"]').querySelector('.card-value').textContent = totalCompleted;
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
        if (user && user._id && user.displayName && user.activePlanName) {
            const option = document.createElement('option');
            option.value = user._id; 
            option.textContent = `${user.displayName} (${user.activePlanName})`; 
            select.appendChild(option);
        }
    });
};

const openViewDialog = (job) => {
    document.getElementById('detail_jobid').textContent = formatJobId(job._id);
    document.getElementById('detail_type').textContent = job.type;
    document.getElementById('detail_status').textContent = job.status;
    document.getElementById('detail_description').textContent = job.description;
    document.getElementById('detail_date').textContent = new Date(job.createdAt).toLocaleDateString();
    const customerName = job.userId ? job.userId.displayName : (job.customerDetails?.name || 'Walk-in');
    document.getElementById('detail_customer').textContent = customerName;
    const contactWrapper = document.getElementById('detail_customer_contact_wrapper');
    const contactSpan = document.getElementById('detail_customer_contact');
    if (!job.userId && job.customerDetails) {
        const contactParts = [job.customerDetails.phone, job.customerDetails.email].filter(Boolean);
        contactSpan.textContent = contactParts.length > 0 ? contactParts.join(' / ') : '';
        contactWrapper.style.display = contactParts.length > 0 ? 'block' : 'none';
    } else {
        contactWrapper.style.display = 'none';
    }
    const assignedTech = job.assignedTo ? job.assignedTo.displayName : 'Not yet assigned';
    document.getElementById('detail_assign_status').textContent = `Assigned to: ${assignedTech}`;
    viewDetailDialog.showModal();
};

const openAssignDialog = (job) => {
    assignDialog.dataset.jobId = job._id;
    document.getElementById('assign-job-id').textContent = formatJobId(job._id);
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
            listContainer.innerHTML = response.data.map(job => `<li class="archive-list-item"><span><strong>${formatJobId(job._id)}</strong> — ${job.type} — Archived on ${new Date(job.archivedAt).toLocaleDateString()}</span><button class="btn sm delete-archive-btn" data-id="${job._id}">Delete</button></li>`).join('');
        } else {
            listContainer.innerHTML = '<li>No archived jobs found.</li>';
        }
    } catch (error) {
        AppAlert.notify({ type: 'error', title: 'Error', message: `Could not load archives: ${error.message}`});
        listContainer.innerHTML = `<li>Error loading archives.</li>`;
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
        try {
            await AppAlert.confirmOnDialog({
                type: 'danger', 
                title: 'Delete Job?',
                message: `Are you sure you want to permanently delete archived job ${formatJobId(jobId)}? This cannot be undone.`,
                confirmText: 'Yes, Delete'
            });

            const response = await window.electronAPI.apiDelete(`/job-orders/archive/${jobId}`);
            if (response.ok) {
                AppAlert.notify({ type: 'success', title: 'Deleted', message: 'The archived job has been permanently deleted.' });
                await fetchAndRenderArchives(); 
            } else {
                throw new Error(response.data?.message || 'Failed to delete job.');
            }
        } catch (error) {
            if (error) {
                 AppAlert.notify({ type: 'error', title: 'Error', message: error.message });
            }
        }
    }
});

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
            await AppAlert.confirm({
                type: 'warning',
                title: 'Archive Job?',
                message: `Are you sure you want to archive job order ${formatJobId(job._id)}?`,
                confirmText: 'Yes, Archive'
            });
            const response = await window.electronAPI.apiPost(`/job-orders/${job._id}/archive`, {});
            if (response.ok) {
                AppAlert.notify({ type: 'success', title: 'Archived', message: 'The job order has been moved to the archive.' });
                await initializeApp();
            } else {
                throw new Error(response.data?.message || 'Failed to archive job.');
            }
        } catch (error) {
            if (error) AppAlert.notify({ type: 'error', title: 'Archive Failed', message: error.message });
        }
    } 
    else if (button.classList.contains('delete-job-btn')) {
        try {
            await AppAlert.confirmOnDialog({
                type: 'danger',
                title: 'Permanently Delete Job?',
                message: `You are about to permanently delete job order <strong>${formatJobId(job._id)}</strong>. This action cannot be undone.`,
                confirmText: 'Yes, Delete It'
            });

            const response = await window.electronAPI.apiDelete(`/job-orders/${job._id}`);
            
            if (response.ok) {
                AppAlert.notify({ type: 'success', title: 'Deleted', message: 'The job order was permanently deleted.' });
                await initializeApp();
            } else {
                throw new Error(response.data?.message || 'Failed to delete job.');
            }
        } catch (error) {
            if (error) AppAlert.notify({ type: 'error', title: 'Deletion Failed', message: error.message });
        }
    }
});

// --- FORM LISTENERS ---
if (createOrderForm) {
    createOrderForm.elements.customerType.forEach(radio => radio.addEventListener('change', (e) => {
        const isSubscriber = e.target.value === 'subscriber';
        document.getElementById('subscriber-select-container').style.display = isSubscriber ? 'block' : 'none';
        document.getElementById('walk-in-container').style.display = isSubscriber ? 'none' : 'grid';
        document.getElementById('subscriber-select').required = isSubscriber;
        createOrderForm.querySelector('input[name="customerName"]').required = !isSubscriber;
    }));

    createOrderForm.addEventListener('submit', async (e) => {
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
            AppAlert.notify({ type: 'success', title: 'Success', message: 'New job order has been created.' });
            createOrderDialog.close();
            await initializeApp();
        } else {
            AppAlert.notify({ type: 'error', title: 'Creation Failed', message: response.data?.message || 'Could not create job order.' });
        }
    });
}

if (assignForm) {
    assignForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const jobId = assignDialog.dataset.jobId;
        const agentId = document.getElementById('manualTechAssign').value;
        if (!agentId) {
            AppAlert.notify({ type: 'warning', title: 'Selection Required', message: 'Please select a technician to assign.' });
            return;
        }
        const response = await window.electronAPI.apiPut(`/job-orders/${jobId}/assign`, { agentId });
        if (response.ok) {
            AppAlert.notify({ type: 'success', title: 'Technician Assigned', message: 'The job has been assigned successfully.' });
            assignDialog.close();
            await initializeApp();
        } else {
            AppAlert.notify({ type: 'error', title: 'Assignment Failed', message: response.data?.message || 'Could not assign technician.' });
        }
    });
}

// =================================================================
// INITIALIZATION
// =================================================================
const initializeApp = async () => {
    await loadHeader(); 
    if (window.setHeader) {
        window.setHeader('Job Order', 'Overview of all service requests and current assignments.');
    }
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 3rem;">Loading jobs...</td></tr>';
    try {
        const [jobsResponse, agentsResponse, subscribersResponse] = await Promise.all([
            window.electronAPI.apiGet('/job-orders'),
            window.electronAPI.apiGet('/field-agents'),
            window.electronAPI.apiGet('/subscribers/list')
        ]);
        state.jobOrders = (jobsResponse?.ok) ? jobsResponse.data : [];
        state.availableAgents = (agentsResponse?.ok) ? agentsResponse.data : [];
        state.subscribers = (subscribersResponse?.ok) ? subscribersResponse.data : [];
        if (!jobsResponse.ok) throw new Error(jobsResponse?.data?.message || 'Network Error');
        updateStats();
        renderTable();
    } catch (error) {
        AppAlert.notify({ type: 'error', title: 'Initialization Failed', message: `Could not load page data: ${error.message}`});
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 3rem; color: red;">Failed to load data.</td></tr>`;
        console.error("Initialization failed:", error);
    }
};

initializeApp();

});