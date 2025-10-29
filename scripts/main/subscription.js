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
            font-family: 'Inter', sans-serif; /* Ensure consistent font */
        `;

        deniedContainer.innerHTML = `
            <div style="font-size: 6rem; color: #DC2626; margin-bottom: 1.5rem;">
                <i class="ph-fill ph-hand-palm"></i>
            </div>
            <h1 style="color: #121212; font-size: 3rem; margin: 0; font-weight: 600;">Access Denied</h1>
            <p style="font-size: 1.25rem; color: #5A6474; max-width: 450px; margin-top: 1rem; line-height: 1.6;">
                You do not have the required permissions to access this page.
            </p>
            <button id="go-back-btn" style="margin-top: 2.5rem; padding: 14px 28px; font-size: 1.1rem; cursor: pointer; border: none; background-color: #3553E4; color: white; border-radius: 10px; font-weight: 500; transition: background-color 0.2s ease;">
                Return to Previous Page
            </button>
        `;
        document.body.appendChild(deniedContainer);

        const goBackButton = document.getElementById('go-back-btn');
        goBackButton.addEventListener('click', () => {
            history.back();
        });
        goBackButton.onmouseover = () => { goBackButton.style.backgroundColor = '#4A6CFD'; };
        goBackButton.onmouseout = () => { goBackButton.style.backgroundColor = '#3553E4'; };
    }
}


document.addEventListener('DOMContentLoaded', async () => {

    const ALLOWED_ROLES = ['admin'];
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
        console.warn(`SECURITY: User with role '${currentUserRole}' attempted to access the subscriptions page without permission.`);
        renderAccessDenied();
        return;
    }
    
    console.log("Permission granted. Initializing subscription management page.");
    // --- CONFIG & STATE ---
    let allSubscribers = [], allPlans = [], currentSubscriberId = null, currentSubscriberDetails = null;

    const iconOptions = [
        { label: 'Bronze', id: 'bronze', svg: '<svg class="w-10 h-10 mb-2 text-yellow-700 animate-bounce" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6" fill="#fbbf24"/></svg>' },
        { label: 'Silver', id: 'silver', svg: '<svg class="w-10 h-10 mb-2 text-gray-300 animate-bounce" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6" fill="#e5e7eb"/></svg>' },
        { label: 'Gold', id: 'gold', svg: '<svg class="w-10 h-10 mb-2 text-yellow-400 animate-bounce" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6" fill="#fff200"/></svg>' },
        { label: 'Platinum', id: 'platinum', svg: '<svg class="w-10 h-10 mb-2 text-gray-200 drop-shadow-lg animate-bounce" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L15 9l7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></svg>' },
        { label: 'Diamond', id: 'diamond', svg: '<svg class="w-10 h-10 mb-2 text-[#56DEFC] animate-bounce" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="12 2 22 9 12 22 2 9 12 2" stroke-linejoin="round"/><polyline points="2 9 12 9 22 9" stroke-linejoin="round"/><polyline points="12 2 12 22" stroke-linejoin="round"/></svg>' },
        { label: 'None', id: 'none', svg: '' } 
    ];

    // --- DOM SELECTORS ---
    const headerContainer = document.getElementById('header-container');
    const listView = document.getElementById('list-view');
    const detailsView = document.getElementById('details-view');
    const clientListEl = document.getElementById('client-list');
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
        }
    };

    // --- API HELPER ---
    const apiRequest = async (method, url, data = null) => {
        try {
            const response = (method === 'apiGet' || method === 'apiDelete')
                ? await window.electronAPI[method](url)
                : await window.electronAPI[method](url, data);

            if (!response || !response.ok) {
                const errorMessage = response.data?.message || `API call failed with status ${response.status}`;
                throw new Error(errorMessage);
            }
            return { ok: true, data: response.data };
        } catch (error) {
            console.error(`[API ERROR] An exception occurred for ${method} ${url}:`, error);
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

            return `<article class="client-row" data-id="${user._id}" role="button">${avatarHtml}<div class="client-meta"><div class="client-name">${user.displayName}</div><div class="client-plan">${user.activePlanName || 'No Plan'}</div></div><div class="status-badge ${statusClass}">${statusText}</div></article>`;
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
            overviewContentView.innerHTML = `<div style="text-align:center; padding: 4rem; color: var(--text-secondary);">This user has no active subscription.</div>`;
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
                actionsHtml = `<button class="btn success btn-approve-verification" data-id="${subscription._id}"><span class="ph ph-check-circle"></span> Approve</button><button class="btn danger btn-decline-subscription" data-id="${subscription._id}"><span class="ph ph-x-circle"></span> Decline</button>`;
                break;
            case 'pending_installation':
                title = "Pending Installation";
                description = `Application for "${plan?.name}" is approved. Awaiting installation confirmation.`;
                actionsHtml = `<button class="btn success btn-activate-installation" data-id="${subscription._id}"><span class="ph ph-play-circle"></span> Activate Service</button>`;
                break;
            case 'pending_change':
                title = "Pending Plan Change";
                description = `User requested to change from "${plan?.name}" to "${pendingPlan?.name}".`;
                actionsHtml = `<button class="btn primary btn-approve-change" data-id="${subscription._id}" data-schedule="false"><span class="ph ph-flash"></span> Apply Now</button><button class="btn secondary btn-approve-change" data-id="${subscription._id}" data-schedule="true"><span class="ph ph-calendar"></span> Schedule</button><button class="btn danger btn-decline-subscription" data-id="${subscription._id}"><span class="ph ph-x-circle"></span> Decline</button>`;
                break;
        }
        pendingStateView.innerHTML = `<div class="pending-card"><h3 class="pending-title">${title}</h3><p class="pending-description">${description}</p><div class="pending-actions">${actionsHtml}</div></div>`;
    };

    const renderOverviewUI = (details) => {
        const { activeSubscription, billingHistory, currentBalance } = details;
        detailsView.dataset.subscriptionId = activeSubscription?._id || '';
        document.getElementById('card-balance').textContent = `₱${currentBalance.toFixed(2)}`;
        document.getElementById('card-active-plan').textContent = activeSubscription?.planId?.name || '--';
        const status = activeSubscription?.status || 'N/A';
        const statusEl = document.getElementById('card-status');
        statusEl.textContent = status.replace('_', ' ');
        statusEl.className = `value ${status === 'active' ? 'green' : (status === 'suspended' ? 'red' : 'orange')}`;
        
        const suspendBtnHtml = activeSubscription?.status === 'suspended' 
            ? `<button id="unsuspend-plan-btn" class="btn-subtle green">Unsuspend</button>` 
            : `<button id="suspend-plan-btn" class="btn-subtle red">Suspend</button>`;
        mainActionButtons.innerHTML = `<button id="update-plan-btn" class="btn-subtle">Update Plan</button><button id="cancel-plan-btn" class="btn-subtle">Cancel Plan</button>${suspendBtnHtml}`;
        
        document.getElementById('history-table-body').innerHTML = (!billingHistory || billingHistory.length === 0) 
            ? `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No billing history.</td></tr>` 
            : billingHistory.map(item => 
                `<tr class="billing-row-link" data-bill-id="${item._id}">
                    <td>${new Date(item.dueDate).toLocaleDateString()}</td>
                    <td>${item.planName || 'Manual Bill'}</td>
                    <td>₱${item.amount.toLocaleString()}</td>
                    <td class="red-text">₱${(['due', 'overdue'].includes(item.status.toLowerCase())) ? item.amount.toFixed(2) : '0.00'}</td>
                    <td>₱${item.amount.toLocaleString()}</td>
                    <td><span class="status-badge ${item.status.toLowerCase()}">${item.status}</span></td>
                </tr>`
            ).join('');
    };

    const renderPlanCards = (plans) => {
        const container = document.getElementById('plan-cards-container');
        container.innerHTML = (!plans || plans.length === 0) ? '<p style="text-align: center;">No plans found.</p>' :
            plans.map(plan => {
                const iconData = iconOptions.find(opt => opt.svg === plan.iconSvg) || iconOptions.find(opt => opt.id === plan.iconSvg);
                const iconHtml = iconData ? iconData.svg : ''; 
                return `
                <div class="plan-card" data-plan-id="${plan._id}">
                    <div class="plan-header">
                        ${iconHtml ? `<span class="plan-icon-display">${iconHtml}</span>` : ''} <!-- Display looked-up SVG -->
                        <span class="plan-name">${plan.name.toUpperCase()}</span>
                        ${plan.isActive ? '<span class="status-badge active">Active</span>' : ''}
                    </div>
                    <p class="plan-price">₱${plan.price}<span class="plan-price-label">${plan.priceLabel || '/ month'}</span></p>
                    <ul class="plan-features">${(plan.features || []).map(f => `<li><span class="ph-fill ph-check-circle"></span>${f}</li>`).join('')}</ul>
                    ${plan.note ? `<div class="plan-description">${plan.note}</div>` : ''}
                    <div class="plan-actions">
                        <button class="btn secondary btn-edit-plan"><span class="ph ph-pencil-simple"></span> Edit</button>
                    </div>
                </div>`;
            }).join('');
    };
    
    const renderPlansDropdown = (selectEl, plans, currentPlanId = null) => {
        const filteredPlans = plans.filter(p => p.isActive && p._id !== currentPlanId);
        selectEl.innerHTML = filteredPlans.length === 0 ? `<option value="" disabled selected>No other plans available</option>` : `<option value="" disabled selected>Select a new plan...</option>${filteredPlans.map(p => `<option value="${p._id}">${p.name} - ₱${p.price}/mo</option>`).join('')}`;
    };

    // --- API & EVENT HANDLERS ---
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
        if (!submitBtn) return;
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true; submitBtn.innerHTML = 'Saving...';

        const result = await apiRequest(method, endpoint, data);
        
        if (result.ok) {
            AppAlert.notify({ type: 'success', title: 'Success', message: result.data?.message || successMessage });
            toggleModal(modalKey, false);
            const listResult = await apiRequest('apiGet', '/subscribers/list');
            if(listResult.ok) { allSubscribers = listResult.data; renderSubscriberList(allSubscribers); }
            if (currentSubscriberId) await handleSubscriberSelect(currentSubscriberId);
            if (modalKey.startsWith('plan')) await loadAllPlans();
        }
        
        submitBtn.disabled = false; submitBtn.innerHTML = originalText;
    };
    
    const openPlanUpsertModal = (planId = null) => {
        const plan = planId ? allPlans.find(p => p._id === planId) : null;
        if (planId && !plan) return AppAlert.notify({ type: 'error', title: 'Not Found', message: 'The selected plan could not be found.' });

        modals.planUpsert.form.reset();
        document.getElementById('upsert-modal-title').textContent = plan ? 'Edit Plan' : 'Add New Plan';
        document.getElementById('delete-plan-btn-modal').classList.toggle('hidden', !plan);
        document.getElementById('delete-plan-btn-modal').dataset.planId = planId || '';

        document.getElementById('planId').value = planId || '';
        document.getElementById('planName').value = plan?.name || '';
        document.getElementById('planPrice').value = plan?.price || '';
        document.getElementById('priceLabel').value = plan?.priceLabel || '';
        document.getElementById('planFeatures').value = plan?.features?.join('\n') || '';
        document.getElementById('planNote').value = plan?.note || '';
        
        const planIconSelect = document.getElementById('planIcon');
        planIconSelect.innerHTML = iconOptions.map(opt => {
            const isSelected = plan?.iconSvg === opt.svg; 
            return `<option value="${opt.id}" ${isSelected ? 'selected' : ''}>${opt.label}</option>`;
        }).join('');

        const currentIconDisplay = document.getElementById('currentIconDisplay');
        if (currentIconDisplay) {
            const selectedIconData = iconOptions.find(opt => opt.svg === plan?.iconSvg);
            currentIconDisplay.innerHTML = selectedIconData?.svg || '';
            currentIconDisplay.classList.toggle('hidden', !selectedIconData?.svg);
        }


        toggleModal('planUpsert', true);
    };

    const handleDeletePlan = async (planId, options = {}) => {
        try {
            await (options.useDialog ? AppAlert.confirmOnDialog : AppAlert.confirm)({
                title: 'Delete Plan?',
                message: 'This action cannot be undone. Are you sure?',
                type: 'danger',
                confirmText: 'Yes, Delete It'
            });
            const result = await apiRequest('apiDelete', `/plans/${planId}`);
            if (result.ok) {
                AppAlert.notify({ type: 'success', title: 'Plan Deleted', message: result.data?.message });
                if (options.modalToClose) toggleModal(options.modalToClose, false);
                await loadAllPlans();
            }
        } catch (err) { /* User cancelled */ }
    };

    const loadAllPlans = async () => {
        const container = document.getElementById('plan-cards-container');
        container.innerHTML = `<p style="text-align: center;">Loading plans...</p>`;
        const result = await apiRequest('apiGet', '/plans');
        if (result.ok) { allPlans = result.data; renderPlanCards(allPlans); }
        else { container.innerHTML = `<p style="text-align: center; color: var(--status-suspended-text);">Could not load plans.</p>`; }
    };

    // --- INITIALIZATION ---
    const initializeApp = async () => {
        await loadHeader(); 
        if (window.setHeader) { window.setHeader('Subscription Management', 'Manage user subscriptions, plans, and billing.'); }
        
        const result = await apiRequest('apiGet', '/subscribers/list');
        if (result.ok) { allSubscribers = result.data; renderSubscriberList(allSubscribers); }
        
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
                '#back-to-list-btn': () => { detailsView.classList.add('hidden'); listView.classList.remove('hidden'); currentSubscriberId = null; },
                '.btn-approve-verification': async () => {
                    await AppAlert.confirm({ title: 'Approve Verification?', message: 'This will create an installation job order.', type: 'info', confirmText: 'Approve' });
                    const res = await apiRequest('apiPost', `/subscriptions/${button.dataset.id}/approve-verification`, {});
                    if(res.ok) await handleSubscriberSelect(currentSubscriberId);
                },
                '.btn-activate-installation': async () => {
                    await AppAlert.confirm({ title: 'Activate Subscription?', message: "This will activate the subscription and generate the first bill.", type: 'info', confirmText: 'Activate' });
                    const res = await apiRequest('apiPost', `/subscriptions/${button.dataset.id}/activate`, {});
                    if(res.ok) await handleSubscriberSelect(currentSubscriberId);
                },
                '.btn-decline-subscription': () => {
                    toggleModal('declineReason', true);
                    modals.declineReason.form.onsubmit = async (event) => {
                        event.preventDefault();
                        const reason = new FormData(modals.declineReason.form).get('reason');
                        const result = await apiRequest('apiPost', `/subscriptions/${button.dataset.id}/decline`, { reason });
                        if(result.ok) {
                            toggleModal('declineReason', false);
                            await handleSubscriberSelect(currentSubscriberId);
                        }
                    };
                },
                '#update-plan-btn': async () => {
                    toggleModal('updatePlan', true);
                    const res = await apiRequest('apiGet', '/plans');
                    if(res.ok) { allPlans = res.data; renderPlansDropdown(document.getElementById('newPlanSelect'), allPlans, subId ? currentSubscriberDetails.activeSubscription.planId._id : null); }
                },
                '#cancel-plan-btn': () => toggleModal('cancelPlan', true),
                '#suspend-plan-btn': () => toggleModal('suspendPlan', true),
                '#unsuspend-plan-btn': async () => {
                    await AppAlert.confirm({ title: 'Reactivate Subscription?', type: 'info', confirmText: 'Reactivate' });
                    const res = await apiRequest('apiPost', `/subscriptions/${subId}/unsuspend`, {});
                    if(res.ok) await handleSubscriberSelect(currentSubscriberId);
                }
            };
            try {
                const actionKey = Object.keys(actions).find(key => button.matches(key));
                if (actionKey) await actions[actionKey]();
            } catch (err) { /* User cancelled confirmation */ }
        });

        document.getElementById('history-table-body').addEventListener('click', (e) => {
            const row = e.target.closest('.billing-row-link');
            if (row?.dataset.billId) window.location.href = `billing.html?billId=${row.dataset.billId}`;
        });
        
        for (const key in modals) {
            const modal = modals[key];
            if (!modal.container) continue;

            const closeButtons = modal.container.querySelectorAll('.close-modal-btn, .btn.secondary');
            
            closeButtons.forEach(btn => {
                btn.addEventListener('click', () => toggleModal(key, false));
            });
            
            modal.overlay.addEventListener('click', () => toggleModal(key, false));
        }

        document.getElementById('add-new-plan-btn').addEventListener('click', () => openPlanUpsertModal());
        document.getElementById('plan-cards-container').addEventListener('click', (e) => {
            const planCard = e.target.closest('.plan-card');
            if (!planCard) return;
            if (e.target.closest('.btn-edit-plan')) openPlanUpsertModal(planCard.dataset.planId);
        });
        document.getElementById('delete-plan-btn-modal').addEventListener('click', (e) => {
            if(e.target.dataset.planId) handleDeletePlan(e.target.dataset.planId, { useDialog: true, modalToClose: 'planUpsert' });
        });

        modals.addSubscriber.form.addEventListener('submit', e => { e.preventDefault(); const data = new FormData(e.target); const addData = { planId: data.get('planId'), user: { displayName: data.get('fullName'), email: data.get('email'), password: data.get('password') }, installationAddress: {address: `${data.get('streetAddress')}, ${data.get('barangay')}`, city: 'Rodriguez', province: 'Rizal' } }; submitAndRefresh('apiPost', '/subscriptions/manual', addData, 'addSubscriber', 'Subscription created!'); });
        modals.planUpsert.form.addEventListener('submit', e => { 
            e.preventDefault(); 
            const data = new FormData(e.target); 
            const planId = data.get('planId'); 
            
            const selectedIconId = data.get('planIcon');
            const selectedIconData = iconOptions.find(opt => opt.id === selectedIconId);
            const iconSvgToSend = selectedIconData ? selectedIconData.svg : ''; 

            const upsertData = { 
                name: data.get('name'), 
                price: parseFloat(data.get('price')), 
                priceLabel: data.get('priceLabel'), 
                features: data.get('features').split('\n').filter(Boolean), 
                note: data.get('note'), 
                isActive: true, 
                iconSvg: iconSvgToSend
            }; 
            submitAndRefresh(planId ? 'apiPut' : 'apiPost', planId ? `/plans/${planId}` : '/plans', upsertData, 'planUpsert', 'Plan saved!'); 
        });
        modals.updatePlan.form.addEventListener('submit', e => { e.preventDefault(); const subId = detailsView.dataset.subscriptionId; const data = { newPlanId: new FormData(e.target).get('newPlanId') }; submitAndRefresh('apiPost', `/subscriptions/${subId}/change-plan`, data, 'updatePlan', 'Plan change submitted!'); });
        modals.cancelPlan.form.addEventListener('submit', e => { e.preventDefault(); const subId = detailsView.dataset.subscriptionId; const data = { reason: new FormData(e.target).get('reason') }; submitAndRefresh('apiPost', `/subscriptions/${subId}/cancel`, data, 'cancelPlan', 'Subscription cancelled.'); });
        modals.suspendPlan.form.addEventListener('submit', e => { e.preventDefault(); const subId = detailsView.dataset.subscriptionId; const data = { reason: new FormData(e.target).get('reason') }; submitAndRefresh('apiPost', `/subscriptions/${subId}/suspend`, data, 'suspendPlan', 'Subscription suspended.'); });
    };

    initializeApp();
});