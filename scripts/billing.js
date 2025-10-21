document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Element Selection ---
    const modalTriggers = document.querySelectorAll('[data-modal-target]');
    const overlay = document.querySelector('.modal-overlay');
    const billingTableBody = document.getElementById('billingTableBody');
    const searchInput = document.getElementById('searchInput');
    const tabs = document.getElementById('tabs');

    // Create/Edit Bill Modal Elements
    const createBillModal = document.getElementById('createBillModal');
    const billForm = document.getElementById('billForm');
    const billModalTitle = document.getElementById('billModalTitle');
    const userTypeRadios = document.querySelectorAll('input[name="userType"]');
    const existingUserGroup = document.getElementById('existingUser-group');
    const newUserGroup = document.getElementById('newUser-group');
    const userSearchInput = document.getElementById('userSearch');
    const userSearchResults = document.getElementById('userSearchResults');
    const selectedUserPill = document.getElementById('selectedUserPill');
    const lineItemsContainer = document.getElementById('lineItemsContainer');
    const addItemBtn = document.getElementById('addItemBtn');
    const totalAmountDisplay = document.getElementById('totalAmountDisplay');
    const createBillSubmitBtn = document.getElementById('createBillSubmitBtn');
    const customerCreateSection = document.getElementById('customer-section-create');
    const customerEditSection = document.getElementById('customer-section-edit');
    const staticCustomerInfo = document.getElementById('static-customer-info');


    // Details Modal Elements
    const billingDetailsModal = document.getElementById('billingDetailsModal');
    const billingDetailsContent = document.getElementById('billingDetailsContent');

    // Partial Payment Modal Elements
    const partialPaymentForm = document.getElementById('partialPaymentForm');
    const recordPartialModal = document.getElementById('recordPartialModal');

    // --- State Management ---
    let allBills = [];
    let allUsers = [];
    let selectedUser = null;
    let currentFilter = 'all';
    let currentBill = null;

    const api = {
        _request: async (method, ...args) => {
            if (!window.electronAPI) {
                console.error("Electron API is not available. Check preload script.");
                return { ok: false, message: "Electron API not found." };
            }
            const response = await window.electronAPI[method](...args);
            if (!response.ok) {
                const errorMessage = response.data?.message || response.message || `API Error: Status ${response.status}`;
                throw new Error(errorMessage);
            }
            return response.data;
        },
        get: (path) => api._request('apiGet', path),
        post: (path, body) => api._request('apiPost', path, body),
        put: (path, body) => api._request('apiPut', path, body),
        delete: (path, body = {}) => api._request('apiDelete', path, body),
    };

    // --- Helper Functions ---
    const formatDate = (dateString, includeTime = false) => {
        if (!dateString) return 'N/A';
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
            options.hour12 = true;
        }
        return new Date(dateString).toLocaleString('en-US', options);
    };

    const formatPeriod = (start, end) => {
        if (!start || !end) return 'N/A';
        const startDate = new Date(start).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        const endDate = new Date(end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        return `${startDate} - ${endDate}`;
    };

    const getStatusBadge = (status) => {
        const displayStatus = status.replace(/_/g, ' ');
        const statusClass = status.toLowerCase().replace(/ /g, '_');
        return `<span class="status-badge status-badge--${statusClass}">${displayStatus}</span>`;
    };

    const showToast = (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('active'), 10);
        setTimeout(() => {
            toast.classList.remove('active');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
    };

    // --- Modal Handling ---
    const openModal = (modal) => {
        if (modal) {
            modal.classList.add('active');
            overlay.classList.add('active');
        }
    };

    const closeModal = () => {
        document.querySelectorAll('.modal.active').forEach(modal => modal.classList.remove('active'));
        overlay.classList.remove('active');
    };

    // --- Data Rendering ---
    const renderTable = (billsToRender) => {
        billingTableBody.innerHTML = '';
        if (billsToRender.length === 0) {
            billingTableBody.innerHTML = `<tr><td colspan="6" class="placeholder-cell">No bills found.</td></tr>`;
            return;
        }
        billsToRender.forEach(bill => {
            const user = bill.userId || { displayName: 'N/A', email: 'N/A' };
            const tr = document.createElement('tr');
            tr.dataset.billId = bill._id;
            tr.innerHTML = `
                <td>${bill._id}</td>
                <td>
                    <div class="subscriber-cell">
                        <div class="subscriber-avatar">${user.displayName.charAt(0)}</div>
                        <div>
                            <p>${user.displayName}</p>
                            <p class="text-muted">${user.email}</p>
                        </div>
                    </div>
                </td>
                <td>${bill.planName || 'N/A'}</td>
                <td>$${bill.amount.toFixed(2)}</td>
                <td>${formatDate(bill.dueDate)}</td>
                <td>${getStatusBadge(bill.status)}</td>
            `;
            tr.addEventListener('click', () => openBillingDetails(bill._id));
            billingTableBody.appendChild(tr);
        });
    };

    // --- Data Fetching and Filtering ---
    const fetchDataAndRender = async () => {
        try {
            const data = await api.get('/bills');
            allBills = data;
            filterAndRender();
        } catch (error) {
            showToast(`Error fetching bills: ${error.message}`, 'error');
            billingTableBody.innerHTML = `<tr><td colspan="6" class="placeholder-cell">Failed to load bills. Please try again.</td></tr>`;
        }
    };

    const fetchUsers = async () => {
        try {
            const users = await api.get('/users/list');
            allUsers = users;
        } catch (error) {
            showToast('Could not load user data for bill creation.', 'error');
        }
    };

    const filterAndRender = () => {
        let filtered = [...allBills];
        if (currentFilter !== 'all') {
            const filterValue = currentFilter.replace(/_/g, ' ');
            filtered = filtered.filter(bill => bill.status.toLowerCase() === filterValue);
        }
        const searchTerm = searchInput.value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(bill =>
                (bill.userId?.displayName || '').toLowerCase().includes(searchTerm) ||
                (bill.planName || '').toLowerCase().includes(searchTerm) ||
                bill._id.toLowerCase().includes(searchTerm)
            );
        }
        renderTable(filtered);
    };

    // --- Billing Details Modal ---
    const openBillingDetails = async (billId) => {
        try {
            const bill = await api.get(`/bills/${billId}`);
            currentBill = bill;
            const user = bill.userId || { displayName: 'N/A', email: 'N/A' };
            const balance = bill.balance ?? bill.amount;
            const statusColors = { 'paid': 'var(--accent-green)', 'due': 'var(--accent-orange)', 'overdue': 'var(--accent-red)', 'partially paid': 'var(--accent-red)', 'upcoming': 'var(--text-muted)', 'pending verification': 'var(--accent-purple)', 'voided': '#6B7280' };
            const statusIcons = { 'paid': 'ph-check-circle', 'due': 'ph-info', 'overdue': 'ph-warning-circle', 'partially paid': 'ph-chart-pie-slice', 'upcoming': 'ph-calendar', 'pending verification': 'ph-hourglass', 'voided': 'ph-x-circle' };

            const getActionButtons = () => {
                const status = bill.status ? bill.status.trim().toLowerCase() : '';
                let primaryActions = '', secondaryActions = '';
                switch (status) {
                    case 'paid':
                        primaryActions = `<button class="btn btn--primary" data-action="view-receipt"><i class="ph ph-receipt"></i> View Receipt</button>`;
                        secondaryActions = `<button class="btn btn--danger-outline" data-action="delete-bill"><i class="ph ph-trash"></i> Delete Bill</button>`;
                        break;
                    case 'pending verification':
                        primaryActions = `<button class="btn btn--success" data-action="approve-payment"><i class="ph ph-check"></i> Confirm Cash Received</button>`;
                        secondaryActions = `<button class="btn btn--danger-outline" data-action="delete-bill"><i class="ph ph-trash"></i> Delete Bill</button>`;
                        break;
                    case 'due':
                    case 'overdue':
                    case 'partially paid':
                    case 'upcoming':
                        primaryActions = status !== 'upcoming' ? `<button class="btn btn--success" data-action="mark-paid"><i class="ph ph-check-circle"></i> Mark as Paid</button>` : `<button class="btn btn--secondary" data-action="view-invoice"><i class="ph ph-file-text"></i> View Invoice</button>`;
                        if (status !== 'upcoming') primaryActions += `<button class="btn btn--secondary" data-action="record-partial"><i class="ph ph-coins"></i> Record Partial Payment</button>`;
                        secondaryActions = `
                            <button class="btn btn--secondary" data-action="edit-bill"><i class="ph ph-pencil-simple"></i> Edit Bill</button>
                            <button class="btn btn--danger-outline" data-action="delete-bill"><i class="ph ph-trash"></i> Delete Bill</button>`;
                        break;
                }
                return `<div class="primary-actions">${primaryActions}</div>${secondaryActions ? `<div class="secondary-actions">${secondaryActions}</div>` : ''}`;
            };

            billingDetailsContent.innerHTML = `
                <button class="details-close-btn" data-modal-close>&times;</button>
                <div class="details-layout">
                    <main class="details-main">
                        <div class="details-header"><h2 class="details-title">Invoice ${bill._id}</h2></div>
                        <div class="details-card">
                            <h3 class="details-card__title">Billed To</h3>
                            <div class="details-item"><span class="details-item__label">Name</span><span class="details-item__value">${user.displayName}</span></div>
                            <div class="details-item"><span class="details-item__label">Email</span><span class="details-item__value">${user.email}</span></div>
                            <div class="details-item"><span class="details-item__label">Plan</span><span class="details-item__value">${bill.planName || 'N/A'}</span></div>
                        </div>
                        <div class="details-card details-summary">
                            <h3 class="details-card__title">Summary</h3>
                            <table>
                               <tbody>${(bill.lineItems || [{description: 'Service Charge', amount: bill.amount}]).map(item => `<tr><td>${item.description}</td><td class="text-right">$${item.amount.toFixed(2)}</td></tr>`).join('')}</tbody>
                               <tfoot><tr><td>Total Amount</td><td class="text-right">$${bill.amount.toFixed(2)}</td></tr></tfoot>
                            </table>
                        </div>
                    </main>
                    <aside class="details-sidebar">
                        <div class="details-status-banner" style="background-color: ${statusColors[bill.status.toLowerCase()] || '#6B7280'}">
                            <div class="details-status-banner__content">
                                <i class="ph ${statusIcons[bill.status.toLowerCase()] || 'ph-question'}"></i>
                                <div>
                                    <p class="details-status-banner__label">${bill.status}</p>
                                    <p class="details-status-banner__amount">$${balance.toFixed(2)} ${bill.status.toLowerCase() === 'paid' ? 'Paid' : 'Due'}</p>
                                </div>
                            </div>
                        </div>
                        <div class="details-card">
                            <h3 class="details-card__title">Key Dates</h3>
                            <div class="details-item"><span class="details-item__label">Statement Date</span><span class="details-item__value">${formatDate(bill.statementDate)}</span></div>
                            <div class="details-item"><span class="details-item__label">Due Date</span><span class="details-item__value">${formatDate(bill.dueDate)}</span></div>
                            ${bill.paymentDate ? `<div class="details-item"><span class="details-item__label">Payment Date</span><span class="details-item__value">${formatDate(bill.paymentDate, true)}</span></div>` : ''}
                        </div>
                        ${bill.proofOfPayment ? `<div class="details-card"><h3 class="details-card__title">Proof of Payment</h3><img src="${bill.proofOfPayment}" alt="Proof of payment" class="details-proof__image"/></div>` : ''}
                        <div class="details-actions-panel">${getActionButtons()}</div>
                    </aside>
                </div>`;
            
            billingDetailsContent.querySelector('.details-actions-panel').addEventListener('click', handleDetailAction);
            openModal(billingDetailsModal);
        } catch (error) {
            showToast(`Error opening details: ${error.message}`, 'error');
        }
    };

    // --- Action Handling ---
    const handleDetailAction = (e) => {
        const button = e.target.closest('button');
        if (!button || button.disabled) return;
        const action = button.dataset.action;

        closeModal();

        setTimeout(async () => {
            try {
                switch (action) {
                    case 'mark-paid': case 'approve-payment':
                        if (confirm('Are you sure you want to mark this bill as fully paid?')) {
                            await api.post(`/bills/${currentBill._id}/mark-paid`, {});
                            showToast('Bill marked as paid!', 'success');
                            await fetchDataAndRender();
                        }
                        break;
                    case 'record-partial':
                        setupAndOpenPartialPaymentModal();
                        break;
                    case 'edit-bill':
                        setupAndOpenEditForm(currentBill);
                        break;
                    case 'delete-bill':
                        if (confirm('Are you sure you want to permanently delete this bill? This cannot be undone.')) {
                            await api.delete(`/bills/${currentBill._id}`);
                            showToast('Bill deleted successfully.', 'success');
                            await fetchDataAndRender();
                        }
                        break;
                    case 'view-invoice':
                        setupAndOpenDocumentModal('invoice', currentBill);
                        break;
                    case 'view-receipt':
                        setupAndOpenDocumentModal('receipt', currentBill);
                        break;
                }
            } catch (error) {
                showToast(`Action failed: ${error.message}`, 'error');
            }
        }, 100);
    };

    // --- Form Functions ---
    const addLineItem = (item = { description: '', amount: '' }) => {
        const div = document.createElement('div');
        div.className = 'line-item';
        div.innerHTML = `<input type="text" name="description" placeholder="Service description..." required class="form-control" value="${item.description}"><input type="number" name="lineAmount" step="0.01" placeholder="0.00" required class="form-control" value="${item.amount}"><button type="button" class="btn remove-item-btn"><i class="ph ph-trash"></i></button>`;
        lineItemsContainer.appendChild(div);
        lineItemsContainer.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.disabled = lineItemsContainer.children.length <= 1;
        });
        validateBillForm();
    };
    const calculateTotal = () => {
        const amounts = lineItemsContainer.querySelectorAll('input[name="lineAmount"]');
        const total = Array.from(amounts).reduce((sum, input) => sum + (parseFloat(input.value) || 0), 0);
        totalAmountDisplay.textContent = `$${total.toFixed(2)}`;
        return total;
    };
    const validateBillForm = () => {
        const isEditMode = billForm.dataset.editMode === 'true';
        let isUserValid = isEditMode || (document.querySelector('input[name="userType"]:checked').value === 'existing' ? !!selectedUser : (document.getElementById('fullName').value.trim() && document.getElementById('email').value.trim()));
        const isDateValid = document.getElementById('dueDate').value;
        const total = calculateTotal();
        const areItemsValid = Array.from(lineItemsContainer.querySelectorAll('.line-item')).every(item => item.querySelector('[name="description"]').value.trim() && parseFloat(item.querySelector('[name="lineAmount"]').value) > 0);
        createBillSubmitBtn.disabled = !(isUserValid && isDateValid && total > 0 && areItemsValid);
    };
    const renderUserSearchResults = (query) => {
        userSearchResults.innerHTML = '';
        if (!query) { userSearchResults.style.display = 'none'; return; }
        const filtered = allUsers.filter(u => u.displayName.toLowerCase().includes(query) || u.email.toLowerCase().includes(query));
        if (filtered.length > 0) {
            filtered.forEach(user => {
                const item = document.createElement('div');
                item.className = 'user-result-item';
                item.dataset.userId = user._id;
                item.innerHTML = `<div class="avatar">${user.displayName.charAt(0)}</div><div class="user-info"><p class="name">${user.displayName}</p><p class="email">${user.email}</p></div>`;
                userSearchResults.appendChild(item);
            });
            userSearchResults.style.display = 'block';
        } else {
            userSearchResults.style.display = 'none';
        }
    };
    const handleUserSelect = (userId) => {
        selectedUser = allUsers.find(u => u._id === userId);
        if (!selectedUser) return;
        selectedUserPill.innerHTML = `<span class="user-info">${selectedUser.displayName}</span><button type="button" class="clear-selection-btn">&times;</button>`;
        selectedUserPill.style.display = 'flex';
        userSearchInput.style.display = 'none';
        userSearchResults.style.display = 'none';
        userSearchInput.value = '';
        validateBillForm();
    };
    const clearUserSelection = () => {
        selectedUser = null;
        selectedUserPill.style.display = 'none';
        userSearchInput.style.display = 'block';
        userSearchInput.focus();
        validateBillForm();
    };
    const setupCreateBillForm = () => {
        billForm.reset();
        billForm.dataset.editMode = 'false'; billForm.dataset.billId = '';
        billModalTitle.textContent = 'Create Manual Bill';
        createBillSubmitBtn.textContent = 'Create Bill';
        customerCreateSection.style.display = 'block';
        customerEditSection.style.display = 'none';
        selectedUser = null;
        lineItemsContainer.innerHTML = '';
        clearUserSelection();
        addLineItem();
        const today = new Date();
        today.setDate(today.getDate() + 7);
        document.getElementById('dueDate').value = today.toISOString().split('T')[0];
        document.getElementById('userTypeExisting').checked = true;
        existingUserGroup.style.display = 'block'; newUserGroup.style.display = 'none';
        validateBillForm();
    };
    const setupAndOpenEditForm = (bill) => {
        billForm.reset();
        billForm.dataset.editMode = 'true'; billForm.dataset.billId = bill._id;
        billModalTitle.textContent = `Edit Invoice ${bill._id}`;
        createBillSubmitBtn.textContent = 'Save Changes';
        customerCreateSection.style.display = 'none'; customerEditSection.style.display = 'block';
        staticCustomerInfo.innerHTML = `<span class="user-info">${bill.userId.displayName} (${bill.userId.email})</span>`;
        document.getElementById('dueDate').value = new Date(bill.dueDate).toISOString().split('T')[0];
        document.getElementById('notes').value = bill.notes || '';
        lineItemsContainer.innerHTML = '';
        const items = bill.lineItems && bill.lineItems.length > 0 ? bill.lineItems : [{ description: 'Service Charge', amount: bill.amount }];
        items.forEach(item => addLineItem(item));
        validateBillForm();
        openModal(createBillModal);
    };
    billForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (createBillSubmitBtn.disabled) return;
        const isEditMode = billForm.dataset.editMode === 'true';
        const billId = billForm.dataset.billId;
        const formData = new FormData(billForm);
        const lineItems = Array.from(lineItemsContainer.querySelectorAll('.line-item')).map(item => ({
            description: item.querySelector('[name="description"]').value,
            amount: parseFloat(item.querySelector('[name="lineAmount"]').value)
        }));
        const payload = { dueDate: formData.get('dueDate'), notes: formData.get('notes'), amount: calculateTotal(), lineItems };
        try {
            if (isEditMode) {
                await api.put(`/bills/${billId}/edit`, payload);
                showToast('Bill updated successfully!', 'success');
            } else {
                if (formData.get('userType') === 'existing') {
                    payload.userId = selectedUser._id;
                } else {
                    payload.customerDetails = { name: formData.get('fullName'), email: formData.get('email') };
                }
                await api.post('/bills/manual', payload);
                showToast('Bill created successfully!', 'success');
            }
            closeModal();
            await fetchDataAndRender();
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        }
    });

    // --- Other Modals ---
    function setupAndOpenPartialPaymentModal() {
        partialPaymentForm.reset();
        document.getElementById('partialBillId').value = currentBill._id;
        openModal(recordPartialModal);
    }
    partialPaymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(partialPaymentForm);
        const billId = formData.get('billId');
        const amountPaid = parseFloat(formData.get('amountPaid'));
        if (!amountPaid || amountPaid <= 0) { return showToast('Please enter a valid amount.', 'error'); }
        if (amountPaid > (currentBill.balance ?? currentBill.amount)) { return showToast('Paid amount cannot be greater than the current balance.', 'error'); }
        const data = { amountPaid, notes: formData.get('notes') };
        try {
            await api.post(`/bills/${billId}/record-partial-payment`, data);
            showToast('Partial payment recorded.', 'success');
            closeModal();
            await fetchDataAndRender();
        } catch (error) {
            showToast(`Recording payment failed: ${error.message}`, 'error');
        }
    });

    // --- [FINAL] Invoice & Receipt Modal ---
    function setupAndOpenDocumentModal(type, bill) {
        const modal = document.getElementById(`${type}DetailModal`);
        const contentEl = document.getElementById(`${type}Content`);
        const user = bill.userId || { displayName: 'N/A', email: 'N/A' };
        let htmlContent = '';

        if (type === 'receipt') {
            // FIX: More defensive check for payment date.
            const formattedPaymentDate = bill.paymentDate ? formatDate(bill.paymentDate, true) : (bill.status.toLowerCase() === 'paid' ? 'Paid (Date N/A)' : 'N/A');
            const formattedBillingPeriod = formatPeriod(bill.statementDate, bill.dueDate);
            const totalAmount = bill.amount?.toFixed(2) || '0.00';
            htmlContent = `
                <style>.receipt-body{font-family:'Poppins',sans-serif;color:#333;background-color:#f4f7fc;padding:2rem}.receipt-container{max-width:450px;margin:auto;background-color:#fff;border-radius:15px;box-shadow:0 8px 25px rgba(0,0,0,.1);overflow:hidden}.receipt-header{background-color:#2c3e50;color:#fff;padding:25px;text-align:center}.receipt-header h1{margin:0;font-size:24px;text-transform:uppercase;letter-spacing:1px}.receipt-header p{margin:5px 0 0;font-size:14px;color:#bdc3c7}.receipt-content{padding:25px}.success-section{text-align:center;margin-bottom:25px}.success-icon{width:50px;height:50px;border-radius:50%;background-color:#2ecc71;display:inline-flex;justify-content:center;align-items:center;margin-bottom:10px}.success-icon::after{content:'';display:block;width:12px;height:24px;border:solid #fff;border-width:0 5px 5px 0;transform:rotate(45deg)}.success-section h2{font-size:18px;color:#2c3e50;margin:0}.details-section{display:flex;justify-content:space-between;margin-bottom:12px;font-size:14px}.label{color:#7f8c8d}.value{font-weight:700;text-align:right}.separator{border:0;border-top:1px dashed #ccc;margin:20px 0}.total-section{display:flex;justify-content:space-between;align-items:center;background-color:#2ecc71;color:#fff;padding:15px;border-radius:10px;margin-top:10px}.total-label{font-size:16px;font-weight:700;text-transform:uppercase}.total-value{font-size:22px;font-weight:700}.footer{text-align:center;margin-top:25px;font-size:12px;color:#95a5a6}</style>
                <div class="receipt-body"><div class="receipt-container"><div class="receipt-header"><h1>Payment Receipt</h1><p>FiBear Network Technologies Corp.</p></div><div class="receipt-content"><div class="success-section"><div class="success-icon"></div><h2>Payment Confirmed</h2></div><div class="details-section"><span class="label">Receipt No:</span><span class="value">${bill._id}</span></div><div class="details-section"><span class="label">Payment Date:</span><span class="value">${formattedPaymentDate}</span></div><div class="details-section"><span class="label">Customer:</span><span class="value">${user.displayName}</span></div><hr class="separator" /><div class="details-section"><span class="label">Service/Plan:</span><span class="value">${bill.planName||'N/A'}</span></div><div class="details-section"><span class="label">Period Covered:</span><span class="value">${formattedBillingPeriod}</span></div><div class="total-section"><span class="total-label">Amount Paid</span><span class="total-value">$${totalAmount}</span></div><div class="footer">Thank you for your payment!</div></div></div></div>`;
        } else { // [REDESIGNED] Invoice
            const lineItems = bill.lineItems && bill.lineItems.length > 0 ? bill.lineItems : [{ description: 'Service Charge', amount: bill.amount }];
            const totalAmount = lineItems.reduce((acc, item) => acc + item.amount, 0).toFixed(2);
            const lineItemsHtml = lineItems.map(item => `<tr><td>${item.description}</td><td class="align-right">$${item.amount.toFixed(2)}</td></tr>`).join('');
            const paidStampHtml = bill.status.toLowerCase() === 'paid' ? `<div class="paid-stamp">Paid</div>` : '';
            
            htmlContent = `
                <style>
                    /* FIX: Styles are now scoped to .invoice-wrapper to prevent affecting the main page. */
                    .invoice-wrapper { font-family: 'Poppins', sans-serif; padding: 2rem; color: #333; position: relative; background-color: #F4F7FC; }
                    .invoice-wrapper .invoice-container { max-width: 800px; margin: auto; background: #fff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.07); overflow: hidden; }
                    .invoice-wrapper .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 2.5rem; background-color: #2c3e50; color: #fff; }
                    .invoice-wrapper .header-left h1 { margin: 0; font-size: 2rem; text-transform: uppercase; letter-spacing: 1.5px; }
                    .invoice-wrapper .header-left p { margin: 5px 0 0; color: #bdc3c7; }
                    .invoice-wrapper .header-right { text-align: right; }
                    .invoice-wrapper .header-right h2 { margin: 0; font-size: 1rem; text-transform: uppercase; }
                    .invoice-wrapper .header-right p { margin: 5px 0 0; font-size: 0.9rem; }
                    .invoice-wrapper .invoice-details { display: flex; justify-content: space-between; padding: 1rem; background-color: #F9FAFB; border-bottom: 1px solid #E5E7EB; }
                    .invoice-wrapper .detail-box h3 { margin: 0 0 10px; font-size: 0.8rem; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; }
                    .invoice-wrapper .detail-box p { margin: 4px 0; font-size: 0.9rem; }
                    .invoice-wrapper .invoice-body { padding: 0.1rem; position: relative; }
                    .invoice-wrapper .line-items-table { width: 100%; border-collapse: collapse; }
                    .invoice-wrapper .line-items-table th, .invoice-wrapper .line-items-table td { padding: 1rem; text-align: left; border-bottom: 1px solid #E5E7EB; }
                    .invoice-wrapper .line-items-table th { font-size: 0.8rem; text-transform: uppercase; color: #6B7280; background-color: #F9FAFB; }
                    .invoice-wrapper .line-items-table .align-right { text-align: right; }
                    .invoice-wrapper .invoice-summary { display: flex; justify-content: flex-end; padding: 2.5rem; }
                    .invoice-wrapper .summary-table { width: 50%; max-width: 300px; }
                    .invoice-wrapper .summary-table td { padding: 0.75rem 1rem; }
                    .invoice-wrapper .summary-table .total-row td { font-size: 1.25rem; font-weight: bold; background-color: #F9FAFB; }
                    .invoice-wrapper .invoice-footer { text-align: center; padding: 2rem; font-size: 0.8rem; color: #6B7280; background-color: #F9FAFB; border-top: 1px solid #E5E7EB; }
                    .invoice-wrapper .paid-stamp { position: absolute; top: 20px; right: -25px; transform: rotate(15deg); border: 3px solid #27AE60; color: #27AE60; font-size: 1.5rem; font-weight: 600; padding: 5px 25px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.3; }
                </style>
                <div class="invoice-wrapper">
                    <div class="invoice-container">
                        ${paidStampHtml}
                        <div class="invoice-header">
                            <div class="header-left"><h1>Invoice</h1><p>FiBear Network Technologies Corp.</p></div>
                            <div class="header-right"><h2>Invoice #${bill._id}</h2><p>${formatDate(bill.statementDate)}</p></div>
                        </div>
                        <div class="invoice-details">
                            <div class="detail-box"><h3>Billed To</h3><p><strong>${user.displayName}</strong></p><p>${user.email}</p></div>
                            <div class="detail-box" style="text-align: right;"><h3>Payment Details</h3><p><strong>Due Date:</strong> ${formatDate(bill.dueDate)}</p><p><strong>Period:</strong> ${formatPeriod(bill.statementDate, bill.dueDate)}</p></div>
                        </div>
                        <div class="invoice-body">
                            <table class="line-items-table">
                                <thead><tr><th>Description</th><th class="align-right">Amount</th></tr></thead>
                                <tbody>${lineItemsHtml}</tbody>
                            </table>
                        </div>
                        <div class="invoice-summary">
                            <table class="summary-table">
                                <tbody><tr class="total-row"><td>Total Due</td><td class="align-right">$${totalAmount}</td></tr></tbody>
                            </table>
                        </div>
                        <div class="invoice-footer"><p>Thank you for your business! For inquiries, please contact our support team.</p></div>
                    </div>
                </div>
            `;
        }
        
        contentEl.innerHTML = htmlContent;
        openModal(modal);
    }


    // --- EVENT LISTENERS ---
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-modal-close]')) closeModal();
    });
    modalTriggers.forEach(trigger => trigger.addEventListener('click', () => {
        const modalId = trigger.dataset.modalTarget;
        if (modalId === 'createBillModal') setupCreateBillForm();
        openModal(document.getElementById(modalId));
    }));
    overlay.addEventListener('click', closeModal);
    searchInput.addEventListener('input', filterAndRender);
    tabs.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            document.querySelector('.tabs__item--active').classList.remove('tabs__item--active');
            e.target.classList.add('tabs__item--active');
            currentFilter = e.target.dataset.tab;
            filterAndRender();
        }
    });
    userTypeRadios.forEach(radio => radio.addEventListener('change', () => {
        const isExisting = document.querySelector('input[name="userType"]:checked').value === 'existing';
        existingUserGroup.style.display = isExisting ? 'block' : 'none';
        newUserGroup.style.display = isExisting ? 'none' : 'block';
        validateBillForm();
    }));
    userSearchInput.addEventListener('input', () => renderUserSearchResults(userSearchInput.value.toLowerCase()));
    userSearchResults.addEventListener('click', (e) => {
        const target = e.target.closest('.user-result-item');
        if (target) handleUserSelect(target.dataset.userId);
    });
    selectedUserPill.addEventListener('click', (e) => {
        if (e.target.classList.contains('clear-selection-btn')) clearUserSelection();
    });
    addItemBtn.addEventListener('click', () => addLineItem());
    lineItemsContainer.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-item-btn');
        if (removeBtn && !removeBtn.disabled) {
            removeBtn.closest('.line-item').remove();
            const remainingBtns = lineItemsContainer.querySelectorAll('.remove-item-btn');
            if (remainingBtns.length === 1) remainingBtns[0].disabled = true;
            validateBillForm();
        }
    });
    billForm.addEventListener('input', validateBillForm);
    // --- Initial Load ---
    fetchDataAndRender();
    fetchUsers();
});