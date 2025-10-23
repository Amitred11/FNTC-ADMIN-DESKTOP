document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Element Selection ---
    const headerContainer = document.getElementById('header-container');
    const modalTriggers = document.querySelectorAll('[data-modal-target]');
    const overlay = document.querySelector('.modal-overlay');
    const billingTableBody = document.getElementById('billingTableBody');
    const searchInput = document.getElementById('searchInput');
    const tabs = document.getElementById('tabs');

    // Modal Elements
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
    const billingDetailsModal = document.getElementById('billingDetailsModal');
    const billingDetailsContent = document.getElementById('billingDetailsContent');
    const partialPaymentForm = document.getElementById('partialPaymentForm');
    const recordPartialModal = document.getElementById('recordPartialModal');

    // --- State Management ---
    let allBills = [];
    let allUsers = [];
    let selectedUser = null;
    let currentFilter = 'all';
    let currentBill = null;

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
        if (includeTime) { options.hour = '2-digit'; options.minute = '2-digit'; options.hour12 = true; }
        return new Date(dateString).toLocaleString('en-US', options);
    };

    const formatPeriod = (start, end) => {
        if (!start || !end) return 'N/A';
        const startDate = new Date(start).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        const endDate = new Date(end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        return `${startDate} - ${endDate}`;
    };

    const getStatusBadge = (status) => `<span class="status-badge status-badge--${status.toLowerCase().replace(/ /g, '_')}">${status.replace(/_/g, ' ')}</span>`;

    // --- Modal Handling ---
    const openModal = (modal) => { if (modal) { modal.classList.add('active'); overlay.classList.add('active'); }};
    const closeModal = () => { document.querySelectorAll('.modal.active').forEach(modal => modal.classList.remove('active')); overlay.classList.remove('active'); };

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
                <td>#${bill._id.slice(-6).toUpperCase()}</td>
                <td><div class="subscriber-cell"><div class="subscriber-avatar">${user.displayName.charAt(0)}</div><div><p>${user.displayName}</p><p class="text-muted">${user.email}</p></div></div></td>
                <td>${bill.planName || 'Manual Bill'}</td>
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
            allBills = await api.get('/bills');
            filterAndRender();
        } catch (error) {
            AppAlert.notify({ title: 'Error', message: `Error fetching bills: ${error.message}`, type: 'error' });
            billingTableBody.innerHTML = `<tr><td colspan="6" class="placeholder-cell">Failed to load bills. Please try again.</td></tr>`;
        }
    };

    const fetchUsers = async () => {
        try { allUsers = await api.get('/users/list'); } 
        catch (error) { AppAlert.notify({ title: 'Warning', message: 'Could not load user data for bill creation.', type: 'warning' }); }
    };

    const filterAndRender = () => {
        let filtered = allBills.filter(bill => currentFilter === 'all' || bill.status.toLowerCase() === currentFilter.replace(/_/g, ' '));
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
            const statusClass = bill.status.toLowerCase().replace(/ /g, '_');
            const statusIcons = { 'paid': 'ph-check-circle', 'due': 'ph-info', 'overdue': 'ph-warning-circle', 'partially_paid': 'ph-chart-pie-slice', 'upcoming': 'ph-calendar', 'pending_verification': 'ph-hourglass', 'voided': 'ph-x-circle' };

            const getActionButtons = () => {
                const status = bill.status.trim().toLowerCase().replace(/ /g, '_');
                let primaryBtn = '';
                let secondaryActions = [];

                if (status === 'paid') {
                    primaryBtn = `<button class="btn btn--primary" data-action="view-receipt"><i class="ph ph-receipt"></i> View Receipt</button>`;
                    secondaryActions.push(`<button class="btn btn--secondary btn--danger-outline" data-action="delete-bill"><i class="ph ph-trash"></i> Delete Bill</button>`);
                } else if (status === 'pending_verification') {
                    primaryBtn = `<button class="btn btn--success" data-action="approve-payment"><i class="ph ph-check"></i> Confirm Payment</button>`;
                    secondaryActions.push(`<button class="btn btn--secondary" data-action="edit-bill"><i class="ph ph-pencil-simple"></i> Edit Bill</button>`);
                    secondaryActions.push(`<button class="btn btn--secondary btn--danger-outline" data-action="delete-bill"><i class="ph ph-trash"></i> Delete Bill</button>`);
                } else {
                    primaryBtn = (status !== 'upcoming') 
                        ? `<button class="btn btn--success" data-action="mark-paid"><i class="ph ph-check-circle"></i> Mark as Paid</button>`
                        : `<button class="btn btn--primary" data-action="view-invoice"><i class="ph ph-file-text"></i> View Invoice</button>`;
                    
                    if (status !== 'upcoming' && status !== 'voided') {
                        secondaryActions.push(`<button class="btn btn--secondary" data-action="record-partial"><i class="ph ph-coins"></i> Record Partial Payment</button>`);
                    }
                    secondaryActions.push(`<button class="btn btn--secondary" data-action="edit-bill"><i class="ph ph-pencil-simple"></i> Edit Bill</button>`);
                    secondaryActions.push(`<button class="btn btn--secondary btn--danger-outline" data-action="delete-bill"><i class="ph ph-trash"></i> Delete Bill</button>`);
                }

                let secondaryActionsHtml = '';
                if (secondaryActions.length > 0) {
                    secondaryActionsHtml = `<div class="secondary-actions">${secondaryActions.join('')}</div>`;
                }
                return `${primaryBtn}${secondaryActionsHtml}`;
            };

            billingDetailsContent.innerHTML = `
                <div class="modal__header">
                    <h2 class="modal__title">Invoice #${bill._id.slice(-6).toUpperCase()}</h2>
                    <button class="modal__close" data-modal-close>&times;</button>
                </div>
                <div class="details-layout">
                    <main class="details-main">
                        <div class="details-card">
                            <h3 class="details-card__title">Billed To</h3>
                            <div class="details-item"><span class="details-item__label">Name</span><span class="details-item__value">${user.displayName}</span></div>
                            <div class="details-item"><span class="details-item__label">Email</span><span class="details-item__value">${user.email}</span></div>
                            <div class="details-item"><span class="details-item__label">Plan</span><span class="details-item__value">${bill.planName || 'Manual Bill'}</span></div>
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
                        <div class="details-status-banner status-banner--${statusClass}">
                            <i class="ph-fill ${statusIcons[statusClass] || 'ph-question'}"></i>
                            <div class="status-banner__text">
                                <p class="status-banner__label">${bill.status.replace(/_/g, ' ')}</p>
                                <p class="status-banner__amount">₱${balance.toFixed(2)}</p>
                                <p class="details-status-banner__note" style="margin-top: 8px; font-size: 0.9em; opacity: 0.85;">${bill.note || 'Thank you for checking your bill details.'}</p>
                            </div>
                        </div>
                        <div class="details-actions-panel">${getActionButtons()}</div>
                        <div class="details-card">
                            <h3 class="details-card__title">Key Dates</h3>
                            <div class="details-item"><span class="details-item__label">Statement</span><span class="details-item__value">${formatDate(bill.statementDate)}</span></div>
                            <div class="details-item"><span class="details-item__label">Due</span><span class="details-item__value">${formatDate(bill.dueDate)}</span></div>
                            ${bill.paymentDate ? `<div class="details-item"><span class="details-item__label">Paid</span><span class="details-item__value">${formatDate(bill.paymentDate, true)}</span></div>` : ''}
                        </div>
                        ${bill.proofOfPayment ? `<div class="details-card"><h3 class="details-card__title">Proof of Payment</h3><a href="${bill.proofOfPayment}" target="_blank"><img src="${bill.proofOfPayment}" alt="Proof" class="details-proof__image"/></a></div>` : ''}
                    </aside>
                </div>`;
            
            billingDetailsContent.addEventListener('click', handleDetailAction);
            openModal(billingDetailsModal);
        } catch (error) {
            AppAlert.notify({ title: 'Error', message: `Could not open details: ${error.message}`, type: 'error' });
        }
    };

    // --- Action Handling ---
    const handleDetailAction = async (e) => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;
        const action = button.dataset.action;
        
        closeModal();

        try {
            switch (action) {
                case 'mark-paid': case 'approve-payment':
                    await AppAlert.confirmOnDialog({ type: 'info', title: 'Confirm Payment', message: 'Mark this bill as fully paid?', confirmText: 'Yes, Mark as Paid' });
                    await api.post(`/bills/${currentBill._id}/mark-paid`, {});
                    AppAlert.notify({ title: 'Success', message: 'Bill marked as paid!', type: 'success' });
                    fetchDataAndRender();
                    break;
                case 'record-partial': setupAndOpenPartialPaymentModal(); break;
                case 'edit-bill': setupAndOpenEditForm(currentBill); break;
                case 'delete-bill':
                    await AppAlert.confirmOnDialog({ type: 'danger', title: 'Delete Bill?', message: 'Permanently delete this bill? This cannot be undone.', confirmText: 'Yes, Delete' });
                    await api.delete(`/bills/${currentBill._id}`);
                    AppAlert.notify({ title: 'Deleted', message: 'Bill deleted successfully.', type: 'success' });
                    fetchDataAndRender();
                    break;
                case 'view-invoice': setupAndOpenDocumentModal('invoice', currentBill); break;
                case 'view-receipt': setupAndOpenDocumentModal('receipt', currentBill); break;
            }
        } catch (error) {
            if (error) AppAlert.notify({ title: 'Action Failed', message: error.message, type: 'error' });
        }
    };
    
    // --- Form Functions ---
    const addLineItem = (item = { description: '', amount: '' }) => {
        const div = document.createElement('div');
        div.className = 'line-item';
        div.innerHTML = `<input type="text" name="description" placeholder="Service description..." required value="${item.description}"><input type="number" name="lineAmount" step="0.01" placeholder="0.00" required value="${item.amount}"><button type="button" class="remove-item-btn"><i class="ph ph-trash"></i></button>`;
        lineItemsContainer.appendChild(div);
        lineItemsContainer.querySelectorAll('.remove-item-btn').forEach((btn, index) => btn.disabled = (index === 0 && lineItemsContainer.children.length === 1));
        validateBillForm();
    };

    const calculateTotal = () => {
        const total = [...lineItemsContainer.querySelectorAll('input[name="lineAmount"]')]
            .reduce((sum, input) => sum + (parseFloat(input.value) || 0), 0);
        totalAmountDisplay.textContent = `$${total.toFixed(2)}`;
        return total;
    };

    const validateBillForm = () => {
        const isEditMode = billForm.dataset.editMode === 'true';
        const userType = document.querySelector('input[name="userType"]:checked')?.value;
        const isUserValid = isEditMode || (userType === 'existing' ? !!selectedUser : (billForm.fullName.value.trim() && billForm.email.value.trim()));
        const isDateValid = billForm.dueDate.value;
        const areItemsValid = [...lineItemsContainer.querySelectorAll('.line-item')].every(item => item.querySelector('[name="description"]').value.trim() && parseFloat(item.querySelector('[name="lineAmount"]').value) > 0);
        createBillSubmitBtn.disabled = !(isUserValid && isDateValid && areItemsValid && calculateTotal() > 0);
    };

    const renderUserSearchResults = (query) => {
        userSearchResults.innerHTML = '';
        if (!query) { userSearchResults.style.display = 'none'; return; }
        const filtered = allUsers.filter(u => u.displayName.toLowerCase().includes(query) || u.email.toLowerCase().includes(query));
        if (filtered.length) {
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
        Object.assign(billForm.dataset, { editMode: 'false', billId: '' });
        billModalTitle.textContent = 'Create Manual Bill';
        createBillSubmitBtn.textContent = 'Create Bill';
        customerCreateSection.style.display = 'block';
        customerEditSection.style.display = 'none';
        selectedUser = null;
        lineItemsContainer.innerHTML = '';
        clearUserSelection();
        addLineItem();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        billForm.dueDate.value = futureDate.toISOString().split('T')[0];
        billForm.userTypeExisting.checked = true;
        existingUserGroup.style.display = 'block';
        newUserGroup.style.display = 'none';
        validateBillForm();
    };

    const setupAndOpenEditForm = (bill) => {
        billForm.reset();
        Object.assign(billForm.dataset, { editMode: 'true', billId: bill._id });
        billModalTitle.textContent = `Edit Invoice #${bill._id.slice(-6).toUpperCase()}`;
        createBillSubmitBtn.textContent = 'Save Changes';
        customerCreateSection.style.display = 'none';
        customerEditSection.style.display = 'block';
        staticCustomerInfo.innerHTML = `<span class="user-info">${bill.userId.displayName} (${bill.userId.email})</span>`;
        billForm.dueDate.value = new Date(bill.dueDate).toISOString().split('T')[0];
        billForm.notes.value = bill.notes || '';
        lineItemsContainer.innerHTML = '';
        (bill.lineItems?.length ? bill.lineItems : [{ description: 'Service Charge', amount: bill.amount }])
            .forEach(addLineItem);
        validateBillForm();
        openModal(createBillModal);
    };

    const setupAndOpenPartialPaymentModal = () => {
        partialPaymentForm.reset();
        const billIdInput = document.getElementById('partialBillId');
        if (billIdInput) {
            billIdInput.value = currentBill._id;
        } else {
            return AppAlert.notify({ title: 'UI Error', message: 'Could not open payment form. Element missing.', type: 'error' });
        }
        openModal(recordPartialModal);
    };
    
    const setupAndOpenDocumentModal = (type, bill) => {
        const modal = document.getElementById(`${type}DetailModal`);
        const contentEl = document.getElementById(`${type}Content`);
        const user = bill.userId || { displayName: 'N/A', email: 'N/A' };
        
        const lineItems = bill.lineItems?.length ? bill.lineItems : [{ description: 'Service Charge', amount: bill.amount }];
        const totalAmount = lineItems.reduce((acc, item) => acc + item.amount, 0).toFixed(2);
        
        contentEl.innerHTML = (type === 'receipt') ? `
            <style>.receipt-body{font-family:'Poppins',sans-serif;color:#333;background-color:#f4f7fc;padding:2rem}.receipt-container{max-width:450px;margin:auto;background-color:#fff;border-radius:15px;box-shadow:0 8px 25px rgba(0,0,0,.1);overflow:hidden}.receipt-header{background-color:#2c3e50;color:#fff;padding:25px;text-align:center}.receipt-header h1{margin:0;font-size:24px;text-transform:uppercase;letter-spacing:1px}.receipt-header p{margin:5px 0 0;font-size:14px;color:#bdc3c7}.receipt-content{padding:25px}.success-section{text-align:center;margin-bottom:25px}.success-icon{width:50px;height:50px;border-radius:50%;background-color:#2ecc71;display:inline-flex;justify-content:center;align-items:center;margin-bottom:10px}.success-icon::after{content:'';display:block;width:12px;height:24px;border:solid #fff;border-width:0 5px 5px 0;transform:rotate(45deg)}.success-section h2{font-size:18px;color:#2c3e50;margin:0}.details-section{display:flex;justify-content:space-between;margin-bottom:12px;font-size:14px}.label{color:#7f8c8d}.value{font-weight:700;text-align:right}.separator{border:0;border-top:1px dashed #ccc;margin:20px 0}.total-section{display:flex;justify-content:space-between;align-items:center;background-color:#2ecc71;color:#fff;padding:15px;border-radius:10px;margin-top:10px}.total-label{font-size:16px;font-weight:700;text-transform:uppercase}.total-value{font-size:22px;font-weight:700}.footer{text-align:center;margin-top:25px;font-size:12px;color:#95a5a6}</style>
            <div class="receipt-body"><div class="receipt-container"><div class="receipt-header"><h1>Payment Receipt</h1><p>FiBear Network Technologies Corp.</p></div><div class="receipt-content"><div class="success-section"><div class="success-icon"></div><h2>Payment Confirmed</h2></div><div class="details-section"><span class="label">Receipt No:</span><span class="value">${bill._id.slice(-6).toUpperCase()}</span></div><div class="details-section"><span class="label">Payment Date:</span><span class="value">${formatDate(bill.paymentDate, true)}</span></div><div class="details-section"><span class="label">Customer:</span><span class="value">${user.displayName}</span></div><hr class="separator" /><div class="details-section"><span class="label">Service/Plan:</span><span class="value">${bill.planName||'N/A'}</span></div><div class="details-section"><span class="label">Period Covered:</span><span class="value">${formatPeriod(bill.statementDate, bill.dueDate)}</span></div><div class="total-section"><span class="total-label">Amount Paid</span><span class="total-value">$${totalAmount}</span></div><div class="footer">Thank you for your payment!</div></div></div></div>`
        : `
            <style>.invoice-wrapper{font-family:'Poppins',sans-serif;padding:2rem;color:#333;position:relative;background-color:#F4F7FC}.invoice-wrapper .invoice-container{max-width:800px;margin:auto;background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.07);overflow:hidden}.invoice-wrapper .invoice-header{display:flex;justify-content:space-between;align-items:flex-start;padding:2.5rem;background-color:#2c3e50;color:#fff}.invoice-wrapper .header-left h1{margin:0;font-size:2rem;text-transform:uppercase;letter-spacing:1.5px}.invoice-wrapper .header-left p{margin:5px 0 0;color:#bdc3c7}.invoice-wrapper .header-right{text-align:right}.invoice-wrapper .header-right h2{margin:0;font-size:1rem;text-transform:uppercase}.invoice-wrapper .header-right p{margin:5px 0 0;font-size:.9rem}.invoice-wrapper .invoice-details{display:flex;justify-content:space-between;padding:2rem 2.5rem;background-color:#F9FAFB;border-bottom:1px solid #E5E7EB}.invoice-wrapper .detail-box h3{margin:0 0 10px;font-size:.8rem;color:#6B7280;text-transform:uppercase;letter-spacing:.5px}.invoice-wrapper .detail-box p{margin:4px 0;font-size:.9rem}.invoice-wrapper .invoice-body{padding:2.5rem;position:relative}.invoice-wrapper .line-items-table{width:100%;border-collapse:collapse}.invoice-wrapper .line-items-table th,.invoice-wrapper .line-items-table td{padding:1rem;text-align:left;border-bottom:1px solid #E5E7EB}.invoice-wrapper .line-items-table th{font-size:.8rem;text-transform:uppercase;color:#6B7280;background-color:#F9FAFB}.invoice-wrapper .line-items-table .align-right{text-align:right}.invoice-wrapper .invoice-summary{display:flex;justify-content:flex-end;padding:0 2.5rem 2.5rem}.invoice-wrapper .summary-table{width:50%;max-width:300px}.invoice-wrapper .summary-table td{padding:.75rem 1rem}.invoice-wrapper .summary-table .total-row td{font-size:1.25rem;font-weight:700;background-color:#F9FAFB}.invoice-wrapper .invoice-footer{text-align:center;padding:2rem;font-size:.8rem;color:#6B7280;background-color:#F9FAFB;border-top:1px solid #E5E7EB}.invoice-wrapper .paid-stamp{position:absolute;top:20px;right:-25px;transform:rotate(15deg);border:3px solid #27AE60;color:#27AE60;font-size:1.5rem;font-weight:600;padding:5px 25px;text-transform:uppercase;letter-spacing:1px;opacity:.3}</style>
            <div class="invoice-wrapper"><div class="invoice-container">${bill.status.toLowerCase()==='paid'?'<div class="paid-stamp">Paid</div>':''}<div class="invoice-header"><div class="header-left"><h1>Invoice</h1><p>FiBear Network Technologies Corp.</p></div><div class="header-right"><h2>Invoice #${bill._id.slice(-6).toUpperCase()}</h2><p>${formatDate(bill.statementDate)}</p></div></div><div class="invoice-details"><div class="detail-box"><h3>Billed To</h3><p><strong>${user.displayName}</strong></p><p>${user.email}</p></div><div class="detail-box" style="text-align:right"><h3>Payment Details</h3><p><strong>Due Date:</strong> ${formatDate(bill.dueDate)}</p><p><strong>Period:</strong> ${formatPeriod(bill.statementDate,bill.dueDate)}</p></div></div><div class="invoice-body"><table class="line-items-table"><thead><tr><th>Description</th><th class="align-right">Amount</th></tr></thead><tbody>${lineItems.map(item=>`<tr><td>${item.description}</td><td class="align-right">$${item.amount.toFixed(2)}</td></tr>`).join('')}</tbody></table></div><div class="invoice-summary"><table class="summary-table"><tbody><tr class="total-row"><td>Total Due</td><td class="align-right">$${totalAmount}</td></tr></tbody></table></div><div class="invoice-footer"><p>Thank you for your business! For inquiries, please contact our support team.</p></div></div></div>`;
        
        openModal(modal);
    };

    const attachEventListeners = () => {
        document.addEventListener('click', (e) => { if (e.target.closest('[data-modal-close]')) closeModal(); });
        modalTriggers.forEach(trigger => trigger.addEventListener('click', () => {
            const modalId = trigger.dataset.modalTarget;
            if (modalId === 'createBillModal') setupCreateBillForm();
            openModal(document.getElementById(modalId));
        }));
        overlay.addEventListener('click', closeModal);
        searchInput.addEventListener('input', filterAndRender);
        tabs.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('tabs__item--active')) {
                tabs.querySelector('.tabs__item--active').classList.remove('tabs__item--active');
                e.target.classList.add('tabs__item--active');
                currentFilter = e.target.dataset.tab;
                filterAndRender();
            }
        });
        
        billForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (createBillSubmitBtn.disabled) return;
            const isEditMode = billForm.dataset.editMode === 'true';
            const lineItems = [...lineItemsContainer.querySelectorAll('.line-item')].map(item => ({ description: item.querySelector('[name="description"]').value, amount: parseFloat(item.querySelector('[name="lineAmount"]').value) }));
            const payload = { dueDate: billForm.dueDate.value, notes: billForm.notes.value, amount: calculateTotal(), lineItems };
            try {
                if (isEditMode) {
                    await api.put(`/bills/${billForm.dataset.billId}/edit`, payload);
                    AppAlert.notify({ title: 'Success', message: 'Bill updated!', type: 'success' });
                } else {
                    if (billForm.userType.value === 'existing') {
                        if (!selectedUser) throw new Error("Please select an existing user.");
                        payload.userId = selectedUser._id;
                    } else {
                        payload.customerDetails = { name: billForm.fullName.value, email: billForm.email.value };
                    }
                    await api.post('/bills/manual', payload);
                    AppAlert.notify({ title: 'Success', message: 'Bill created!', type: 'success' });
                }
                closeModal();
                fetchDataAndRender();
            } catch (error) {
                AppAlert.notify({ title: 'Error', message: error.message, type: 'error' });
            }
        });
        
        billForm.addEventListener('input', validateBillForm);
        userTypeRadios.forEach(radio => radio.addEventListener('change', () => {
            const isExisting = radio.value === 'existing';
            existingUserGroup.style.display = isExisting ? 'block' : 'none';
            newUserGroup.style.display = isExisting ? 'none' : 'block';
            validateBillForm();
        }));
        userSearchInput.addEventListener('input', () => renderUserSearchResults(userSearchInput.value.toLowerCase()));
        userSearchResults.addEventListener('click', (e) => { if (e.target.closest('.user-result-item')) handleUserSelect(e.target.closest('.user-result-item').dataset.userId); });
        selectedUserPill.addEventListener('click', (e) => { if (e.target.classList.contains('clear-selection-btn')) clearUserSelection(); });
        addItemBtn.addEventListener('click', () => addLineItem());
        lineItemsContainer.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-item-btn');
            if (removeBtn && !removeBtn.disabled) {
                removeBtn.closest('.line-item').remove();
                validateBillForm();
            }
        });
        
        partialPaymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const billId = partialPaymentForm.billId.value;
            const amountPaid = parseFloat(partialPaymentForm.amountPaid.value);
            if (!amountPaid || amountPaid <= 0) return AppAlert.notify({ title: 'Invalid Amount', message: 'Please enter a valid amount.', type: 'warning' });
            if (amountPaid > (currentBill.balance ?? currentBill.amount)) return AppAlert.notify({ title: 'Invalid Amount', message: 'Amount cannot be greater than the balance.', type: 'warning' });
            try {
                await api.post(`/bills/${billId}/record-partial-payment`, { amountPaid, notes: partialPaymentForm.notes.value });
                AppAlert.notify({ title: 'Success', message: 'Partial payment recorded.', type: 'success' });
                closeModal();
                fetchDataAndRender();
            } catch (error) {
                AppAlert.notify({ title: 'Error', message: `Recording payment failed: ${error.message}`, type: 'error' });
            }
        });
    };

    const initializePage = async () => {
        await loadHeader(); 
        if (window.setHeader) window.setHeader('Billing', 'Manage invoices, payments, and billing cycles.');
        attachEventListeners();
        fetchDataAndRender();
        fetchUsers();
    };

    initializePage();
});