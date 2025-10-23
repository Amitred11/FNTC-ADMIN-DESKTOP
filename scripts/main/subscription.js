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
    const headerContainer = document.getElementById('header-container');
    const listView = document.getElementById('list-view');
    const detailsView = document.getElementById('details-view');
    const clientListEl = document.getElementById('client-list');
    const totalCountEl = document.getElementById('total-count');
    const searchInput = document.getElementById('search-input');
    const managePlansBtn = document.getElementById('manage-plans-btn');
    const addSubscriberBtn = document.getElementById('add-subscriber-btn');
    
    const pendingStateView = document.getElementById('pending-state-view');
    const overviewContentView = document.getElementById('overview-content-view');
    const mainActionButtons = document.getElementById('main-action-buttons');
    
    const modals = {
        planList: { overlay: document.getElementById('plan-modal-overlay'), container: document.getElementById('plan-management-modal') },
        planUpsert: { overlay: document.getElementById('plan-upsert-modal-overlay'), container: document.getElementById('plan-upsert-modal'), form: document.getElementById('plan-upsert-form') },
        addSubscriber: { overlay: document.getElementById('add-subscriber-modal-overlay'), container: document.getElementById('add-subscriber-modal'), form: document.getElementById('add-subscriber-form') },
        updatePlan: { overlay: document.getElementById('update-plan-modal-overlay'), container: document.getElementById('update-plan-modal'), form: document.getElementById('update-plan-form') },
        cancelPlan: { overlay: document.getElementById('cancel-plan-modal-overlay'), container: document.getElementById('cancel-plan-modal'), form: document.getElementById('cancel-plan-form') },
        suspendPlan: { overlay: document.getElementById('suspend-plan-modal-overlay'), container: document.getElementById('suspend-plan-modal'), form: document.getElementById('suspend-plan-form') },
        declineReason: { overlay: document.getElementById('decline-reason-modal-overlay'), container: document.getElementById('decline-reason-modal'), form: document.getElementById('decline-reason-form') }
    };

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

    // --- API HELPER ---
    const apiRequest = async (method, url, data = null) => {
        try {
            if (!window.electronAPI) throw new Error('API provider is not available.');
            const response = await window.electronAPI[method](url, data);
            if (!response || !response.ok) throw new Error(response.data?.message || `API call failed`);
            return { ok: true, data: response.data };
        } catch (error) {
            console.error(`API Error (${method} ${url}):`, error);
            // UPDATED: Use AppAlert for error notifications
            AppAlert.notify({ type: 'error', title: 'API Error', message: error.message });
            return { ok: false, message: error.message };
        }
    };

    // --- UTILITY & VIEW MANAGEMENT ---
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
        if (subscribers.length === 0) {
            clientListEl.innerHTML = `<div class="placeholder">No subscribers found.</div>`;
            return;
        }
        clientListEl.innerHTML = subscribers.map(user => {
            const initials = user.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            const statusClass = (user.status || 'inactive').toLowerCase();
            const statusText = (user.status || 'inactive').replace(/_/g, ' ');
            const avatarHtml = user.photoUrl
                ? `<img src="${user.photoUrl}" alt="${user.displayName}" class="client-avatar">`
                : `<div class="client-avatar">${initials}</div>`;

            return `<article class="client-row" data-id="${user._id}" role="button">${avatarHtml}<div class="client-meta"><div class="client-name">${user.displayName}</div><div class="client-plan">${user.activePlanName || 'No Plan'}</div></div><div class="client-status ${statusClass}">${statusText}</div></article>`;
        }).join('');
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
                description = `User has applied for the "${plan?.name}" plan. Review their documents and approve or decline.`;
                actionsHtml = `<button class="action-btn success btn-approve-verification" data-id="${subscription._id}"><span class="ph ph-check-circle"></span> Approve</button><button class="action-btn danger btn-decline-subscription" data-id="${subscription._id}"><span class="ph ph-x-circle"></span> Decline</button>`;
                break;
            case 'pending_installation':
                title = "Pending Installation";
                description = `Application for the "${plan?.name}" plan is approved. Awaiting installation confirmation.`;
                actionsHtml = `<button class="action-btn success btn-activate-installation" data-id="${subscription._id}"><span class="ph ph-play-circle"></span> Activate Service</button>`;
                break;
            case 'pending_change':
                title = "Pending Plan Change";
                description = `User requested to change from "${plan?.name}" to "${pendingPlan?.name}".`;
                actionsHtml = `<button class="action-btn primary btn-approve-change" data-id="${subscription._id}" data-schedule="false"><span class="ph ph-flash"></span> Apply Now</button><button class="action-btn secondary btn-approve-change" data-id="${subscription._id}" data-schedule="true"><span class="ph ph-calendar"></span> Schedule</button><button class="action-btn danger btn-decline-subscription" data-id="${subscription._id}"><span class="ph ph-x-circle"></span> Decline</button>`;
                break;
        }
        pendingStateView.innerHTML = `<div class="pending-card"><h3 class="pending-title">${title}</h3><p class="pending-description">${description}</p><div class="pending-actions">${actionsHtml}</div></div>`;
    };

    const renderOverviewUI = (details) => {
        const { activeSubscription, billingHistory, currentBalance } = details;
        detailsView.dataset.subscriptionId = activeSubscription?._id || '';
        document.getElementById('card-balance').textContent = `₱${currentBalance.toFixed(2)}`;
        const plan = activeSubscription?.planId;
        document.getElementById('card-active-plan').textContent = plan?.name || '--';
        document.getElementById('card-active-plan-details').textContent = plan ? `Plan is ${plan.isActive ? 'active' : 'inactive'}` : 'No active plan';
        document.getElementById('card-billing').textContent = `₱${plan?.price.toLocaleString() || 0}`;
        const status = activeSubscription?.status || 'N/A';
        const statusEl = document.getElementById('card-status');
        statusEl.textContent = status.replace('_', ' ');
        statusEl.className = `value ${status === 'active' ? 'green' : (status === 'suspended' ? 'red' : 'orange')}`;
        const suspendBtnHtml = activeSubscription?.status === 'suspended' ? `<button id="unsuspend-plan-btn" class="btn-subtle green">Unsuspend Plan</button>` : `<button id="suspend-plan-btn" class="btn-subtle red">Suspend Plan</button>`;
        mainActionButtons.innerHTML = `<button id="update-plan-btn" class="btn-subtle blue">Update Plan</button><button id="cancel-plan-btn" class="btn-subtle">Cancel Plan</button>${suspendBtnHtml}`;
        document.getElementById('history-table-body').innerHTML = (!billingHistory || billingHistory.length === 0) ? `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No billing history.</td></tr>` : billingHistory.map(item => `<tr class="billing-row-link" data-bill-id="${item._id}"><td>${new Date(item.dueDate).toLocaleDateString()}</td><td>${item.planName || 'Manual Bill'}</td><td>₱${item.amount.toLocaleString()}</td><td class="red-text">₱${(['due', 'overdue'].includes(item.status.toLowerCase())) ? item.amount.toFixed(2) : '0.00'}</td><td>₱${item.amount.toLocaleString()}</td><td><span class="status-text ${item.status.toLowerCase()}">${item.status}</span></td></tr>`).join('');
    };

    const renderPlanCards = (plans) => {
        const container = document.getElementById('plan-cards-container');
        container.innerHTML = (!plans || plans.length === 0) ? '<p style="text-align: center;">No plans found.</p>' :
            plans.map(plan => `<div class="plan-card" data-plan-id="${plan._id}"><div class="plan-header"><div class="plan-title"><div class="plan-icon">${plan.iconSvg || '<span class="ph-fill ph-leaf"></span>'}</div><span class="plan-name">${plan.name.toUpperCase()}</span></div>${plan.isActive ? '<span class="plan-status">Active</span>' : ''}</div><p class="plan-price">₱${plan.price}<span class="plan-price-label">${plan.priceLabel || '/ month'}</span></p><ul class="plan-features">${(plan.features || []).map(f => `<li><span class="ph-fill ph-check-circle"></span>${f}</li>`).join('')}</ul>${plan.note ? `<div class="plan-description">${plan.note}</div>` : ''}<div class="plan-actions"><button class="action-btn secondary btn-edit-plan"><span class="ph ph-pencil-simple"></span> Edit</button><button class="action-btn danger btn-delete-plan"><span class="ph ph-trash"></span> Delete</button></div></div>`).join('');
    };
    
    const renderPlansDropdown = (selectEl, plans, currentPlanId = null) => {
        const filteredPlans = plans.filter(p => p.isActive && p._id !== currentPlanId);
        selectEl.innerHTML = filteredPlans.length === 0 ? `<option value="" disabled selected>No other plans</option>` : `<option value="" disabled selected>Select a plan</option>${filteredPlans.map(p => `<option value="${p._id}">${p.name} - ₱${p.price}/mo</option>`).join('')}`;
    };

    // --- API LOGIC & EVENT HANDLERS ---
    const handleSubscriberSelect = async (subscriberId) => {
        currentSubscriberId = subscriberId;
        listView.classList.add('hidden');
        detailsView.classList.remove('hidden');
        ['detail-name', 'detail-id-email'].forEach(id => document.getElementById(id).textContent = 'Loading...');
        
        const result = await apiRequest('apiGet', `/users/${subscriberId}/details`);
        if (result.ok) {
            renderSubscriberDetails(result.data);
        } else {
            listView.classList.remove('hidden');
            detailsView.classList.add('hidden');
        }
    };

    const submitAndRefresh = async (method, endpoint, data, modalKey, successMessage) => {
        const submitBtn = modals[modalKey].container.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true; submitBtn.textContent = 'Saving...';

        const result = await apiRequest(method, endpoint, data);
        
        if (result.ok) {
            const titleMap = {'created': 'Created Successfully', 'saved': 'Saved Successfully', 'submitted': 'Request Submitted', 'cancelled': 'Cancelled', 'suspended': 'Suspended'};
            const action = Object.keys(titleMap).find(key => successMessage.toLowerCase().includes(key)) || 'success';
            AppAlert.notify({ type: 'success', title: titleMap[action] || 'Success!', message: result.data?.message || successMessage });
            
            toggleModal(modalKey, false);
            const listResult = await apiRequest('apiGet', '/subscribers/list');
            if(listResult.ok) { allSubscribers = listResult.data; renderSubscriberList(allSubscribers); }
            if (currentSubscriberId) await handleSubscriberSelect(currentSubscriberId);
            if (modalKey.startsWith('plan')) await loadAllPlans();
        }
        
        submitBtn.disabled = false; submitBtn.textContent = originalText;
    };
    
    const openPlanUpsertModal = (planId = null) => {
        const plan = planId ? allPlans.find(p => p._id === planId) : null;
        if (planId && !plan) return AppAlert.notify({ type: 'error', title: 'Not Found', message: 'The selected plan could not be found.' });
        
        modals.planUpsert.form.reset();
        document.getElementById('upsert-modal-title').textContent = plan ? 'Edit Plan' : 'Add New Plan';
        ['planId', 'planName', 'planPrice', 'priceLabel', 'planFeatures', 'planNote'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.value = plan?.[id === 'planFeatures' ? 'features' : id] || '';
            if(id === 'planFeatures' && plan?.features) el.value = plan.features.join('\n');
        });
        document.getElementById('planIsActive').checked = plan ? plan.isActive : true;

        const matchingIcon = iconOptions.find(opt => opt.svg === (plan?.iconSvg || ''));
        document.getElementById('planIconSelect').value = matchingIcon?.value || 'none';
        document.getElementById('icon-preview').innerHTML = matchingIcon?.svg || '';
        document.getElementById('iconSvg').value = matchingIcon?.svg || '';

        toggleModal('planUpsert', true);
    };

    const handleDeletePlan = async (planId) => {
        try {
            await AppAlert.confirm({ title: 'Delete Plan', message: 'Are you sure you want to permanently delete this plan? This action cannot be undone.', type: 'danger', confirmText: 'Yes, Delete It' });
            const result = await apiRequest('apiDelete', `/plans/${planId}`);
            if (result.ok) {
                AppAlert.notify({ type: 'success', title: 'Plan Deleted', message: result.data?.message || 'The plan has been removed.' });
                await loadAllPlans();
            }
        } catch { console.log('Plan deletion cancelled.'); }
    };

    const loadAllPlans = async () => {
        const container = document.getElementById('plan-cards-container');
        container.innerHTML = `<p style="text-align: center;">Loading plans...</p>`;
        const result = await apiRequest('apiGet', '/plans');
        if (result.ok) { allPlans = result.data; renderPlanCards(allPlans); }
        else { container.innerHTML = `<p style="text-align: center; color: red;">Could not load plans.</p>`; }
    };

    // --- INITIALIZATION ---
    const initializeApp = async () => {
        await loadHeader(); 
        if (window.setHeader) { window.setHeader('Subscription Management', 'Manage user subscriptions, plans, and billing all in one place'); }
        
        const result = await apiRequest('apiGet', '/subscribers/list');
        if (result.ok) { allSubscribers = result.data; renderSubscriberList(allSubscribers); }
        
        document.getElementById('planIconSelect').innerHTML = iconOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');

        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            renderSubscriberList(allSubscribers.filter(u => u.displayName.toLowerCase().includes(searchTerm) || u._id.includes(searchTerm)));
        });
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

            const actions = {
                '#back-to-list-btn': () => {
                    detailsView.classList.add('hidden');
                    listView.classList.remove('hidden');
                    currentSubscriberId = null; currentSubscriberDetails = null;
                },
                '.btn-approve-verification': async () => {
                    try {
                        await AppAlert.confirm({ title: 'Approve Verification?', message: 'This will create an installation job order. Proceed?', type: 'info', confirmText: 'Approve' });
                        const result = await apiRequest('apiPost', `/subscriptions/${button.dataset.id}/approve-verification`);
                        if(result.ok) await handleSubscriberSelect(currentSubscriberId);
                    } catch {}
                },
                '.btn-activate-installation': async () => {
                    try {
                        await AppAlert.confirm({ title: 'Activate Subscription?', message: "This will activate the user's subscription and generate their first bill.", type: 'info', confirmText: 'Activate' });
                        const result = await apiRequest('apiPost', `/subscriptions/${button.dataset.id}/activate`);
                        if(result.ok) await handleSubscriberSelect(currentSubscriberId);
                    } catch {}
                },
                '.btn-decline-subscription': () => {
                    toggleModal('declineReason', true);
                    modals.declineReason.form.onsubmit = async (event) => {
                        event.preventDefault();
                        const reason = new FormData(modals.declineReason.form).get('reason');
                        if (reason) {
                            const result = await apiRequest('apiPost', `/subscriptions/${button.dataset.id}/decline`, { reason });
                            if(result.ok) {
                                toggleModal('declineReason', false);
                                await handleSubscriberSelect(currentSubscriberId);
                            }
                        }
                    };
                },
                '.btn-approve-change': async () => {
                    const schedule = button.dataset.schedule === 'true';
                    try {
                        await AppAlert.confirm({ title: 'Approve Plan Change?', message: `This will be ${schedule ? 'scheduled for the next renewal' : 'effective immediately'}.`, type: 'info', confirmText: 'Approve' });
                        const result = await apiRequest('apiPost', `/subscriptions/${button.dataset.id}/approve-change`, { scheduleForRenewal: schedule });
                        if(result.ok) await handleSubscriberSelect(currentSubscriberId);
                    } catch {}
                },
                '#update-plan-btn': async () => {
                    toggleModal('updatePlan', true);
                    const planResult = await apiRequest('apiGet', '/plans');
                    if(planResult.ok) { 
                        allPlans = planResult.data;
                        renderPlansDropdown(document.getElementById('newPlanSelect'), allPlans, subId ? currentSubscriberDetails.activeSubscription.planId._id : null);
                    }
                },
                '#cancel-plan-btn': () => toggleModal('cancelPlan', true),
                '#suspend-plan-btn': () => toggleModal('suspendPlan', true),
                '#unsuspend-plan-btn': async () => {
                    try {
                        await AppAlert.confirm({ title: 'Reactivate Subscription?', message: 'Are you sure you want to reactivate this subscription?', type: 'info', confirmText: 'Reactivate' });
                        const result = await apiRequest('apiPost', `/subscriptions/${subId}/unsuspend`);
                        if(result.ok) {
                            AppAlert.notify({ type: 'success', title: 'Subscription Reactivated', message: 'The user has been successfully reactivated.' });
                            await handleSubscriberSelect(currentSubscriberId);
                        }
                    } catch {}
                }
            };
            
            const actionKey = Object.keys(actions).find(key => button.matches(key));
            if (actionKey) actions[actionKey]();
        });

        document.getElementById('history-table-body').addEventListener('click', (e) => {
            const row = e.target.closest('.billing-row-link');
            if (row?.dataset.billId) window.location.href = `billing.html?billId=${row.dataset.billId}`;
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

        modals.addSubscriber.form.addEventListener('submit', e => { e.preventDefault(); const data = new FormData(e.target); const addData = { planId: data.get('planId'), user: { displayName: data.get('fullName'), email: data.get('email'), password: data.get('password') }, installationAddress: {address: `${data.get('streetAddress')}, ${data.get('barangay')}`,city: 'Rodriguez', province: 'Rizal',zipCode: '1860' } }; submitAndRefresh('apiPost', '/subscriptions/manual', addData, 'addSubscriber', 'Subscription created successfully!'); });
        modals.planUpsert.form.addEventListener('submit', e => { e.preventDefault(); const data = new FormData(e.target); const planId = data.get('planId'); const upsertData = { name: data.get('name'), price: parseFloat(data.get('price')), priceLabel: data.get('priceLabel'), iconSvg: data.get('iconSvg'), features: data.get('features').split('\n').filter(Boolean), note: data.get('note'), isActive: data.has('isActive') }; submitAndRefresh(planId ? 'apiPut' : 'apiPost', planId ? `/plans/${planId}` : '/plans', upsertData, 'planUpsert', 'Plan saved successfully!'); });
        modals.updatePlan.form.addEventListener('submit', e => { e.preventDefault(); const subId = detailsView.dataset.subscriptionId; const data = { newPlanId: new FormData(e.target).get('newPlanId') }; submitAndRefresh('apiPost', `/subscriptions/${subId}/change-plan`, data, 'updatePlan', 'Plan change request submitted!'); });
        modals.cancelPlan.form.addEventListener('submit', e => { e.preventDefault(); const subId = detailsView.dataset.subscriptionId; submitAndRefresh('apiPost', `/subscriptions/${subId}/cancel`, {}, 'cancelPlan', 'Subscription has been cancelled.'); });
        modals.suspendPlan.form.addEventListener('submit', e => { e.preventDefault(); const subId = detailsView.dataset.subscriptionId; const data = { reason: new FormData(e.target).get('reason') }; submitAndRefresh('apiPost', `/subscriptions/${subId}/suspend`, data, 'suspendPlan', 'Subscription has been suspended.'); });
    };

    initializeApp();
});