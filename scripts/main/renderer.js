document.addEventListener('DOMContentLoaded', () => {
    // --- PART 1: DOM Element Selectors (Unchanged) ---
    const headerContainer = document.getElementById('header-container');
    const totalSubscribersEl = document.getElementById('total-subscribers');
    const newSubscribersEl = document.getElementById('new-subscribers');
    const overduePaymentsEl = document.getElementById('overdue-payments');
    const totalUsersEl = document.getElementById('total-users');
    const openTicketsEl = document.getElementById('open-tickets');
    const noticeListEl = document.getElementById('subscriber-list');
    const barChartEl = document.getElementById('bar-chart-body');
    const donutChartEl = document.getElementById('donut-chart-figure');

    // --- PART 2: Dashboard-Specific Functions (Unchanged) ---
    const loadHeader = async () => {
        try {
            const response = await fetch('../../components/header.html');
            if (!response.ok) throw new Error(`Failed to fetch header: ${response.status}`);
            headerContainer.innerHTML = await response.text();
            
            if (window.initializeHeader) {
                window.initializeHeader();
            } else {
                console.error("Header script not loaded or initializeHeader function not found.");
            }
        } catch (error) {
            console.error('Failed to load header component:', error);
            headerContainer.innerHTML = `<p class="error-message" style="text-align: center; color: red;">Error: Header failed to load.</p>`;
        }
    };

    // --- PART 5: Dashboard Analytics & Charts ---
    const renderDonutChart = (distributionData) => {
        if (!distributionData || distributionData.length === 0) {
            donutChartEl.innerHTML = '<p class="chart-placeholder">No subscription data.</p>'; return;
        }
        const series = distributionData.map(item => item.count);
        const labels = distributionData.map(item => item.name);
        const totalSubscribers = series.reduce((a, b) => a + b, 0);
        const options = {
            series, labels,
            chart: { type: 'donut', height: '70%', foreColor: '#333333' },
            colors: ['#0A3D62', '#3C8CE7', '#A5D6A7', '#64B5F6', '#81D4FA'],
            plotOptions: { pie: { donut: { labels: { show: true, total: { show: true, label: '', fontSize: '1.75rem', fontWeight: '700', color: '#E53935', formatter: () => totalSubscribers } } } } },
            legend: { position: 'bottom' }
        };
        donutChartEl.innerHTML = '';
        new ApexCharts(donutChartEl, options).render();
    };

    const renderBarChart = (monthlyData) => {
        if (!monthlyData || monthlyData.length === 0) {
            barChartEl.innerHTML = '<p class="chart-placeholder">No monthly subscriber data.</p>';
            return;
        }
        const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const allPlanNames = [...new Set(monthlyData.flatMap(month => month.plans.map(plan => plan.name)))];
        const seriesDataMap = new Map();
        allPlanNames.forEach(name => seriesDataMap.set(name, { name: name, data: new Array(12).fill(0) }));
        monthlyData.forEach(month => {
            const monthIndex = month.month - 1;
            if (monthIndex >= 0 && monthIndex < 12) {
                month.plans.forEach(plan => {
                    if (seriesDataMap.has(plan.name)) seriesDataMap.get(plan.name).data[monthIndex] = plan.count;
                });
            }
        });
        const options = {
            series: Array.from(seriesDataMap.values()),
            chart: { type: 'bar', height: '89%', toolbar: { show: false }, stacked: false, foreColor: '#333333' },
            plotOptions: { bar: { horizontal: false, columnWidth: '60%', borderRadius: 4 } },
            dataLabels: { enabled: false },
            xaxis: { categories: monthLabels },
            yaxis: { labels: { style: { colors: '#333333' } } },
            fill: { opacity: 1 },
            colors: ['#0A3D62', '#3C8CE7', '#A5D6A7', '#64B5F6', '#81D4FA'],
            tooltip: { y: { formatter: (val) => val + " subscribers" }, theme: 'dark' },
            legend: { position: 'top', horizontalAlign: 'left' }
        };
        barChartEl.innerHTML = '';
        new ApexCharts(barChartEl, options).render();
    };

    const fetchDashboardAnalytics = async () => {
        const data = await AppCommon.fetchData('/dashboard-analytics');
        if (!data) { 
            barChartEl.innerHTML = '<p class="chart-placeholder">Could not load dashboard data.</p>';
            AppAlert.notify({ type: 'error', title: 'Load Failed', message: 'Could not fetch dashboard analytics data.' });
            return; 
        };
        totalSubscribersEl.textContent = data.quickAccess?.totalSubscribers || 0;
        newSubscribersEl.textContent = `+${data.quickAccess?.newSubscribersThisMonth || 0}`;
        overduePaymentsEl.textContent = data.quickAccess?.overduePayments || 0;
        renderDonutChart(data.subscriptionDistribution);
        renderBarChart(data.monthlySubscribersByPlan);
    };

    const fetchDashboardUserList = async () => {
        const users = await AppCommon.fetchData('/dashboard-user-list?limit=6');
        if (!users) {
            noticeListEl.innerHTML = '<li class="notice-item-placeholder">Could not load user data.</li>';
            // UPDATED: Show an alert on failure
            AppAlert.notify({ type: 'error', title: 'Load Failed', message: 'Could not fetch the subscriber status list.' });
            return;
        }
        noticeListEl.innerHTML = users.length === 0 
            ? '<li class="notice-item-placeholder">No users with active issues.</li>'
            : users.map(user => {
                const userAvatar = user.photoUrl ? `<img src="${user.photoUrl}" class="avatar" alt="${user.name}">` : `<img src="https://via.placeholder.com/40" class="avatar" alt="Default avatar">`;
                const amountMatch = user.detailText.match(/₱[\d,]+\.\d{2}/);
                const amount = amountMatch ? amountMatch[0] : '';
                const detailText = amount ? user.detailText.split(amount)[0].trim() : user.detailText;
                
                return `
                    <li class="notice-item">
                        <a href="../settings/user-management.html?userId=${user.id || ''}">
                            <div class="notice-info">
                                ${userAvatar}
                                <div>
                                    <p class="name">${user.name}</p>
                                    <p class="detail">${detailText || 'Status'}</p>
                                </div>
                            </div>
                            <div class="notice-details">
                                <p class="amount">${amount}</p><span class="status-badge ${user.status}">${user.status}</span>
                            </div>
                        </a>
                    </li>`;
            }).join('');
    };

    const fetchStats = async () => {
        const data = await AppCommon.fetchData('/stats');
        if (data) {
            if (totalUsersEl) totalUsersEl.textContent = data.totalUsers || 0;
            if (openTicketsEl) openTicketsEl.textContent = data.openTickets || 0;
        } else {
            // UPDATED: Show an alert on failure
            AppAlert.notify({ type: 'warning', title: 'Warning', message: 'Could not fetch secondary stats like total users.' });
        }
    };

    // --- PART 3: Initialization ---
    const initializeDashboard = async () => {
        await loadHeader(); 
        
        if (window.setHeader) {
            window.setHeader('Dashboard', 'Here’s a quick overview of Active subscriptions.');
        }
        
        fetchDashboardAnalytics();
        fetchDashboardUserList();
        fetchStats();
    };

    // --- SCRIPT EXECUTION ---
    initializeDashboard();
});

window.addEventListener('load', () => {
    document.body.classList.remove('is-loading');
});