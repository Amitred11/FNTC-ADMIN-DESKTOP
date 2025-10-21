document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIG & STATE ---
    const iconOptions = [
        { label: 'None', value: 'none', svg: '' },
        { label: 'Bronze', value: 'bronze', svg: '<svg fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#CD7F32"/><circle cx="12" cy="12" r="6" fill="#D2B48C"/></svg>' },
        { label: 'Silver', value: 'silver', svg: '<svg fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#C0C0C0"/><circle cx="12" cy="12" r="6" fill="#e5e7eb"/></svg>' },
        { label: 'Gold', value: 'gold', svg: '<svg fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#FFD700"/><circle cx="12" cy="12" r="6" fill="#fff200"/></svg>' },
        { label: 'Platinum', value: 'platinum', svg: '<svg fill="currentColor" viewBox="0 0 24 24" style="color: #E5E4E2;"><path d="M12 2L15 9l7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></svg>' },
        { label: 'Diamond', value: 'diamond', svg: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color: #56DEFC;"><polygon points="12 2 22 9 12 22 2 9 12 2" stroke-linejoin="round"/><polyline points="2 9 12 9 22 9" stroke-linejoin="round"/><polyline points="12 2 12 22" stroke-linejoin="round"/></svg>' },
    ];
    let allSubscribers = [], allPlans = [], currentSubscriberId = null, currentSubscriberDetails = null;

    // --- DOM SELECTORS ---
    const listView = document.getElementById('list-view');
    const detailsView = document.getElementById('details-view');
    const clientListEl = document.getElementById('client-list');
    const totalCountEl = document.getElementById('total-count');
    const searchInput = document.getElementById('search-input');
    const managePlansBtn = document.getElementById('manage-plans-btn');
    const addSubscriberBtn = document.getElementById('add-subscriber-btn');
    const messageBox = document.getElementById('message-box');
    const messageText = document.getElementById('message-text');

    const pendingStateView = document.getElementById('pending-state-view');
    const overviewContentView = document.getElementById('overview-content-view');
    const mainActionButtons = document.getElementById('main-action-buttons');
    
    const modals = {
        planList: { overlay: document.getElementById('plan-modal-overlay'), container: document.getElementById('plan-management-modal') },
        planUpsert: { overlay: document.getElementById('plan-upsert-modal-overlay'), container: document.getElementById('plan-upsert-modal'), form: document.getElementById('plan-upsert-form') },
        addSubscriber: { overlay: document.getElementById('add-subscriber-modal-overlay'), container: document.getElementById('add-subscriber-modal'), form: document.getElementById('add-subscriber-form') },
        updatePlan: { overlay: document.getElementById('update-plan-modal-overlay'), container: document.getElementById('update-plan-modal'), form: document.getElementById('update-plan-form') },
        cancelPlan: { overlay: document.getElementById('cancel-plan-modal-overlay'), container: document.getElementById('cancel-plan-modal'), form: document.getElementById('cancel-plan-form') },
        suspendPlan: { overlay: document.getElementById('suspend-plan-modal-overlay'), container: document.getElementById('suspend-plan-modal'), form: document.getElementById('suspend-plan-form') }
    };

    // --- API HELPER (WITH FIX) ---
    const apiRequest = async (method, url, data = null) => {
        try {
            if (!window.electronAPI) throw new Error('API provider is not available.');
            
            let payload = data;
            const methodKey = method.toLowerCase();
            if ((methodKey === 'apipost' || methodKey === 'apiput') && payload === null) {
                payload = {};
            }
            // =================================================================

            const response = await window.electronAPI[method](url, payload); // Use the corrected payload
            if (!response || !response.ok) throw new Error(response.data?.message || `API call failed`);
            return { ok: true, data: response.data };
        } catch (error) {
            console.error(`API Error (${method} ${url}):`, error);
            showMessageBox(error.message, 'error');
            return { ok: false, message: error.message };
        }
    };

    // --- UTILITY & VIEW MANAGEMENT ---
    const showMessageBox = (message, type = 'success') => {
        messageText.textContent = message;
        messageBox.className = `message-box ${type} show`;
        setTimeout(() => messageBox.classList.remove('show'), 3500);
    };

    const toggleModal = (modalKey, show) => {
        const modal = modals[modalKey];
        if (!modal) return;
        modal.overlay.classList.toggle('hidden', !show);
        modal.container.classList.toggle('hidden', !show);
        if (!show && modal.form) modal.form.reset();
    };

    // --- RENDER FUNCTIONS ---
    const renderSubscriberList = (subscribers) => {
        totalCountEl.textContent = subscribers.length;
        clientListEl.innerHTML = subscribers.length === 0 ? `<div class="placeholder">No subscribers found.</div>` :
            subscribers.map(user => `<article class="client-row" data-id="${user._id}" role="button"><div class="avatar-placeholder"></div><div class="client-meta"><div class="client-name">${user.displayName}</div><div class="client-plan">${user.activePlanName || 'No Plan'}</div></div><div class="client-status ${user.status?.toLowerCase() || 'inactive'}">${user.status || 'inactive'}</div></article>`).join('');
        clientListEl.querySelectorAll('.client-row').forEach(row => row.addEventListener('click', () => handleSubscriberSelect(row.dataset.id)));
    };

    const renderSubscriberDetails = (details) => {
        currentSubscriberDetails = details;
        const { user, activeSubscription } = details;

        document.getElementById('detail-name').textContent = user.displayName.toUpperCase();
        document.getElementById('detail-id-email').textContent = `ID: ${user._id} | Email: ${user.email}`;
        
        const sub = activeSubscription;
        const isPending = sub && ['pending_verification', 'pending_installation', 'pending_change'].includes(sub.status);

        pendingStateView.classList.toggle('hidden', !isPending);
        overviewContentView.classList.toggle('hidden', isPending);
        mainActionButtons.classList.toggle('hidden', isPending || !sub);

        if (isPending) {
            renderPendingStateUI(sub);
        } else if (sub) {
            renderOverviewUI(details);
        } else {
            overviewContentView.innerHTML = `<div style="text-align:center; padding: 4rem; color: var(--text-muted);">This user does not have an active or pending subscription.</div>`;
            mainActionButtons.innerHTML = '';
        }
    };
    
    const renderPendingStateUI = (subscription) => {
        const plan = subscription.planId;
        const pendingPlan = subscription.pendingPlanId;
        let title = '', description = '', actionsHtml = '';

        switch (subscription.status) {
            case 'pending_verification':
                title = "Pending Verification";
                description = `User has applied for the "${plan?.name}" plan. Please review their documents and approve or decline the application.`;
                actionsHtml = `
                    <button class="action-btn success btn-approve-verification" data-id="${subscription._id}"><span class="ph ph-check-circle"></span> Approve</button>
                    <button class="action-btn danger btn-decline-subscription" data-id="${subscription._id}"><span class="ph ph-x-circle"></span> Decline</button>
                `;
                break;

            case 'pending_installation':
                title = "Pending Installation";
                description = `Application for the "${plan?.name}" plan is approved. Awaiting confirmation of modem installation to activate the service.`;
                actionsHtml = `
                    <button class="action-btn success btn-activate-installation" data-id="${subscription._id}"><span class="ph ph-play-circle"></span> Activate Service</button>
                `;
                break;

            case 'pending_change':
                title = "Pending Plan Change";
                description = `User requested to change from "${plan?.name}" to "${pendingPlan?.name}". Approve to apply immediately or schedule it for the next renewal date.`;
                actionsHtml = `
                    <button class="action-btn primary btn-approve-change" data-id="${subscription._id}" data-schedule="false"><span class="ph ph-flash"></span> Apply Now</button>
                    <button class="action-btn secondary btn-approve-change" data-id="${subscription._id}" data-schedule="true"><span class="ph ph-calendar"></span> Schedule</button>
                    <button class="action-btn danger btn-decline-subscription" data-id="${subscription._id}"><span class="ph ph-x-circle"></span> Decline</button>
                `;
                break;
        }

        pendingStateView.innerHTML = `
            <div class="pending-card">
                <h3 class="pending-title">${title}</h3>
                <p class="pending-description">${description}</p>
                <div class="pending-actions">${actionsHtml}</div>
            </div>
        `;
    };

    const renderOverviewUI = (details) => {
        const { activeSubscription, billingHistory, currentBalance } = details;
        detailsView.dataset.subscriptionId = activeSubscription?._id || '';

        document.getElementById('card-balance').textContent = `₱${currentBalance.toFixed(2)}`;
        
        const plan = activeSubscription?.planId;
        document.getElementById('card-active-plan').textContent = plan?.name || '--';
        document.getElementById('card-active-plan-details').textContent = plan ? `${plan.speed || 'N/A'} Mbps | Unlimited` : 'No active plan';
        document.getElementById('card-billing').textContent = `₱${plan?.price.toLocaleString() || 0}`;

        const status = activeSubscription?.status || 'N/A';
        const statusEl = document.getElementById('card-status');
        statusEl.textContent = status.replace('_', ' ');
        statusEl.className = `value ${status === 'active' ? 'green' : (status === 'suspended' ? 'red' : 'orange')}`;

        const suspendBtnHtml = activeSubscription?.status === 'suspended'
            ? `<button id="unsuspend-plan-btn" class="btn-subtle green">Unsuspend Plan</button>`
            : `<button id="suspend-plan-btn" class="btn-subtle red">Suspend Plan</button>`;
        
        mainActionButtons.innerHTML = `
            <button id="update-plan-btn" class="btn-subtle blue">Update Plan</button>
            <button id="cancel-plan-btn" class="btn-subtle">Cancel Plan</button>
            ${suspendBtnHtml}
        `;

        document.getElementById('history-table-body').innerHTML = (!billingHistory || billingHistory.length === 0) ? `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No billing history.</td></tr>` :
            billingHistory.map(item => `<tr class="billing-row-link" data-bill-id="${item._id}"><td>${new Date(item.dueDate).toLocaleDateString()}</td><td>${item.planName || 'Manual Bill'}</td><td>₱${item.amount.toLocaleString()}</td><td class="red-text">₱${(['due', 'overdue'].includes(item.status.toLowerCase())) ? item.amount.toFixed(2) : '0.00'}</td><td>₱${item.amount.toLocaleString()}</td><td><span class="status-text ${item.status.toLowerCase()}">${item.status}</span></td></tr>`).join('');
    };

    const renderPlanCards = (plans) => {
        const container = document.getElementById('plan-cards-container');
        container.innerHTML = (!plans || plans.length === 0) ? '<p style="text-align: center;">No plans found.</p>' :
            plans.map(plan => `<div class="plan-card" data-plan-id="${plan._id}"><div class="plan-header"><div class="plan-title"><div class="plan-icon">${plan.iconSvg || ''}</div><div class="plan-name-wrapper"><span class="plan-name-prefix">PLAN</span><span class="plan-name">${plan.name.toUpperCase()}</span></div></div>${plan.isActive ? '<span class="plan-status">Active</span>' : ''}</div><p class="plan-price">₱${plan.price}<span class="plan-price-label">${plan.priceLabel || ''}</span></p><ul class="plan-features">${(plan.features || []).map(f => `<li><span class="ph-fill ph-check-circle"></span>${f}</li>`).join('')}</ul>${plan.note ? `<div class="plan-description">${plan.note}</div>` : ''}<div class="plan-actions"><button class="action-btn primary btn-edit-plan"><span class="ph ph-pencil-simple"></span> Edit</button><button class="action-btn danger btn-delete-plan"><span class="ph ph-trash"></span> Delete</button></div></div>`).join('');
    };
    
    const renderPlansDropdown = (selectEl, plans, currentPlanId = null) => {
        const filteredPlans = plans.filter(p => p.isActive && p._id !== currentPlanId);
        selectEl.innerHTML = filteredPlans.length === 0 ? `<option value="" disabled selected>No other plans</option>` :
            `<option value="" disabled selected>Select a plan</option>${filteredPlans.map(p => `<option value="${p._id}">${p.name} - ₱${p.price}/mo</option>`).join('')}`;
    };

    // --- API LOGIC & EVENT HANDLERS ---
    const handleSubscriberSelect = async (subscriberId) => {
        currentSubscriberId = subscriberId;
        listView.classList.add('hidden');
        detailsView.classList.remove('hidden');
        document.getElementById('detail-name').textContent = 'Loading...';
        document.getElementById('detail-id-email').textContent = 'Please wait...';
        
        const result = await apiRequest('apiGet', `/users/${subscriberId}/details`);
        if (result.ok) {
            renderSubscriberDetails(result.data);
        } else {
            showMessageBox(result.message || 'Could not fetch subscriber details.', 'error');
            listView.classList.remove('hidden');
            detailsView.classList.add('hidden');
        }
    };

    const submitAndRefresh = async (method, endpoint, data, modalKey, successMessage) => {
        const modal = modals[modalKey];
        const submitBtn = modal.container.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true; submitBtn.textContent = 'Saving...';

        const result = await apiRequest(method, endpoint, data);
        
        if (result.ok) {
            showMessageBox(result.data?.message || successMessage, 'success');
            toggleModal(modalKey, false);
            const listResult = await apiRequest('apiGet', '/subscribers/list');
            if(listResult.ok) { allSubscribers = listResult.data; renderSubscriberList(allSubscribers); }
            if (currentSubscriberId) await handleSubscriberSelect(currentSubscriberId);
        }
        
        submitBtn.disabled = false; submitBtn.textContent = originalText;
    };
    
    const openPlanUpsertModal = (planId = null) => {
        const plan = planId ? allPlans.find(p => p._id === planId) : null;
        if (planId && !plan) return showMessageBox('Plan not found.', 'error');
        
        modals.planUpsert.form.reset();
        document.getElementById('upsert-modal-title').textContent = plan ? 'Edit Plan' : 'Add New Plan';
        document.getElementById('planId').value = plan?._id || '';
        document.getElementById('planName').value = plan?.name || '';
        document.getElementById('planPrice').value = plan?.price || '';
        document.getElementById('priceLabel').value = plan?.priceLabel || '';
        document.getElementById('planFeatures').value = plan?.features?.join('\n') || '';
        document.getElementById('planNote').value = plan?.note || '';
        document.getElementById('planIsActive').checked = plan ? plan.isActive : true;

        const matchingIcon = iconOptions.find(opt => opt.svg === (plan?.iconSvg || ''));
        document.getElementById('planIconSelect').value = matchingIcon?.value || 'none';
        document.getElementById('icon-preview').innerHTML = matchingIcon?.svg || '';
        document.getElementById('iconSvg').value = matchingIcon?.svg || '';

        toggleModal('planUpsert', true);
    };

    const handleDeletePlan = async (planId) => {
        if (!confirm('Are you sure you want to permanently delete this plan?')) return;
        const result = await apiRequest('apiDelete', `/plans/${planId}`);
        if (result.ok) {
            showMessageBox(result.data?.message || 'Plan deleted', 'success');
            await loadAllPlans();
        }
    };

    const loadAllPlans = async () => {
        document.getElementById('plan-cards-container').innerHTML = `<p style="text-align: center;">Loading plans...</p>`;
        const result = await apiRequest('apiGet', '/plans');
        if (result.ok) { allPlans = result.data; renderPlanCards(allPlans); }
        else { document.getElementById('plan-cards-container').innerHTML = `<p style="text-align: center; color: red;">Could not load plans.</p>`; }
    };

    // --- INITIALIZATION ---
    const initializeApp = async () => {
        const result = await apiRequest('apiGet', '/subscribers/list');
        if (result.ok) { allSubscribers = result.data; renderSubscriberList(allSubscribers); }
        document.getElementById('planIconSelect').innerHTML = iconOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');

        searchInput.addEventListener('input', () => renderSubscriberList(allSubscribers.filter(u => u.displayName.toLowerCase().includes(searchInput.value.toLowerCase()))));
        managePlansBtn.addEventListener('click', () => { toggleModal('planList', true); loadAllPlans(); });
        addSubscriberBtn.addEventListener('click', async () => { 
            toggleModal('addSubscriber', true);
            const planResult = await apiRequest('apiGet', '/plans');
            if(planResult.ok) { allPlans = planResult.data; renderPlansDropdown(document.getElementById('plan'), allPlans); }
        });
        
        detailsView.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            if (!button) return; 

            const subId = currentSubscriberDetails?.activeSubscription?._id;

            if (button.matches('#back-to-list-btn')) {
                detailsView.classList.add('hidden');
                listView.classList.remove('hidden');
                currentSubscriberId = null; currentSubscriberDetails = null;
            } else if (button.matches('.btn-approve-verification')) {
                if (confirm("Approving this will create an installation job order. Proceed?")) {
                    const result = await apiRequest('apiPost', `/subscriptions/${button.dataset.id}/approve-verification`);
                    if(result.ok) await handleSubscriberSelect(currentSubscriberId);
                }
            } else if (button.matches('.btn-activate-installation')) {
                if (confirm("This will activate the user's subscription and generate their first bill. Are you sure?")) {
                    const result = await apiRequest('apiPost', `/subscriptions/${button.dataset.id}/activate`);
                    if(result.ok) await handleSubscriberSelect(currentSubscriberId);
                }
            } else if (button.matches('.btn-decline-subscription')) {
                const reason = prompt("Please provide a reason for declining this application/change:");
                if (reason) {
                    const result = await apiRequest('apiPost', `/subscriptions/${button.dataset.id}/decline`, { reason });
                    if(result.ok) await handleSubscriberSelect(currentSubscriberId);
                }
            } else if (button.matches('.btn-approve-change')) {
                const schedule = button.dataset.schedule === 'true';
                if (confirm(`Are you sure you want to approve this plan change? It will be ${schedule ? 'scheduled for the next renewal' : 'effective immediately'}.`)) {
                    const result = await apiRequest('apiPost', `/subscriptions/${button.dataset.id}/approve-change`, { scheduleForRenewal: schedule });
                    if(result.ok) await handleSubscriberSelect(currentSubscriberId);
                }
            } else if (button.matches('#update-plan-btn')) {
                toggleModal('updatePlan', true);
                const planResult = await apiRequest('apiGet', '/plans');
                if(planResult.ok) { 
                    allPlans = planResult.data;
                    renderPlansDropdown(document.getElementById('newPlanSelect'), allPlans, subId ? currentSubscriberDetails.activeSubscription.planId._id : null);
                }
            } else if (button.matches('#cancel-plan-btn')) {
                toggleModal('cancelPlan', true);
            } else if (button.matches('#suspend-plan-btn')) {
                toggleModal('suspendPlan', true);
            } else if (button.matches('#unsuspend-plan-btn')) {
                 if (confirm("Are you sure you want to reactivate this subscription?")) {
                    const result = await apiRequest('apiPost', `/subscriptions/${subId}/unsuspend`);
                    if(result.ok) {
                        showMessageBox('Subscription reactivated!', 'success');
                        await handleSubscriberSelect(currentSubscriberId);
                    }
                }
            }
        });

        document.getElementById('history-table-body').addEventListener('click', (e) => {
            const row = e.target.closest('.billing-row-link');
            if (row && row.dataset.billId) {
                window.location.href = `billing.html?billId=${row.dataset.billId}`;
            }
        });
        
        for (const key in modals) {
            const modal = modals[key];
            const closeBtn = modal.container.querySelector('.close-modal-btn');
            const cancelBtn = modal.container.querySelector('.action-btn.secondary');
            if (closeBtn) closeBtn.addEventListener('click', () => toggleModal(key, false));
            if (cancelBtn) cancelBtn.addEventListener('click', () => toggleModal(key, false));
            modal.overlay.addEventListener('click', () => toggleModal(key, false));
        }

        document.getElementById('add-new-plan-btn').addEventListener('click', () => openPlanUpsertModal());
        document.getElementById('plan-cards-container').addEventListener('click', (e) => {
            const planCard = e.target.closest('.plan-card');
            if (!planCard) return;
            if (e.target.closest('.btn-edit-plan')) openPlanUpsertModal(planCard.dataset.planId);
            if (e.target.closest('.btn-delete-plan')) handleDeletePlan(planCard.dataset.planId);
        });
        document.getElementById('planIconSelect').addEventListener('change', (e) => {
            const selectedIcon = iconOptions.find(opt => opt.value === e.target.value);
            document.getElementById('icon-preview').innerHTML = selectedIcon?.svg || '';
            document.getElementById('iconSvg').value = selectedIcon?.svg || '';
        });

        modals.addSubscriber.form.addEventListener('submit', (e) => {
            e.preventDefault();
            const data = new FormData(modals.addSubscriber.form);
            const addData = { planId: data.get('planId'), user: { displayName: data.get('fullName'), email: data.get('email'), password: data.get('password') }, installationAddress: {address: `${data.get('streetAddress')}, ${data.get('barangay')}`,city: 'Rodriguez', province: 'Rizal',zipCode: '1860' } };
            submitAndRefresh('apiPost', '/subscriptions/manual', addData, 'addSubscriber', 'Subscription created successfully!');
        });

        modals.planUpsert.form.addEventListener('submit', (e) => {
            e.preventDefault();
            const data = new FormData(modals.planUpsert.form);
            const planId = data.get('planId');
            const upsertData = { name: data.get('name'), price: parseFloat(data.get('price')), priceLabel: data.get('priceLabel'), iconSvg: data.get('iconSvg'), features: data.get('features').split('\n').filter(Boolean), note: data.get('note'), isActive: data.has('isActive') };
            submitAndRefresh(planId ? 'apiPut' : 'apiPost', planId ? `/plans/${planId}` : '/plans', upsertData, 'planUpsert', 'Plan saved successfully!').then(loadAllPlans);
        });
        
        modals.updatePlan.form.addEventListener('submit', (e) => {
            e.preventDefault();
            const subId = detailsView.dataset.subscriptionId;
            const data = { newPlanId: new FormData(modals.updatePlan.form).get('newPlanId') };
            submitAndRefresh('apiPost', `/subscriptions/${subId}/change-plan`, data, 'updatePlan', 'Plan change request submitted!');
        });

        modals.cancelPlan.form.addEventListener('submit', (e) => {
            e.preventDefault();
            const subId = detailsView.dataset.subscriptionId;
            const data = { reason: new FormData(modals.cancelPlan.form).get('reason') };
            submitAndRefresh('apiPost', `/subscriptions/${subId}/cancel`, data, 'cancelPlan', 'Subscription cancelled successfully.');
        });
        
        modals.suspendPlan.form.addEventListener('submit', (e) => {
            e.preventDefault();
            const subId = detailsView.dataset.subscriptionId;
            const data = { reason: new FormData(modals.suspendPlan.form).get('reason') };
            submitAndRefresh('apiPost', `/subscriptions/${subId}/suspend`, data, 'suspendPlan', 'Subscription suspended successfully.');
        });
    };

    initializeApp();
});