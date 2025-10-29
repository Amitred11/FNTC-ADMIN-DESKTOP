// scripts/activity-log.js

document.addEventListener('DOMContentLoaded', () => {
    const timelineList = document.getElementById('timeline-list');
    const backButton = document.querySelector('.back-button');

    if (!timelineList || !backButton) {
        console.error('A required element is missing from the page.');
        return;
    }

    const getLogTypeDetails = (logType) => {
        const details = { icon: 'ph-fill ph-info', markerClass: 'info' }; 
        switch (logType) {
            case 'admin_update':
                details.icon = 'ph-fill ph-user-gear';
                details.markerClass = 'warning';
                break;
            case 'payment_approved':
                details.icon = 'ph-fill ph-check-circle';
                details.markerClass = 'info';
                break;
            case 'subscription_activated':
                details.icon = 'ph-fill ph-rocket-launch';
                details.markerClass = 'info';
                break;
            case 'user_suspended':
            case 'decline':
                details.icon = 'ph-fill ph-warning-circle';
                details.markerClass = 'danger';
                break;
            default:
                break;
        }
        return details;
    };

    const formatTimestamp = (isoDate) => {
        const date = new Date(isoDate);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    };

    const fetchAndRenderLogs = async () => {
        try {
            const response = await window.electronAPI.apiGet('/activity-log');

            if (!response.ok) {
                throw new Error(response.data.message || 'Server error');
            }

            const logs = response.data.data;
            timelineList.innerHTML = '';

            if (!logs || logs.length === 0) {
                timelineList.innerHTML = '<li class="loading-placeholder">No activity logs found.</li>';
                return;
            }

            logs.forEach(log => {
                const { icon, markerClass } = getLogTypeDetails(log.type);
                const avatarInitial = log.user.displayName.charAt(0).toUpperCase();

                const logItem = document.createElement('li');
                logItem.className = 'timeline-item';
                logItem.innerHTML = `
                    <div class="timeline-marker ${markerClass}">
                        <i class="${icon}"></i>
                    </div>
                    <div class="log-content">
                        <p class="log-action">
                           ${log.details}
                        </p>
                        <div class="log-meta">
                            <div class="log-actor">
                                <div class="actor-avatar">${avatarInitial}</div>
                                <span class="actor-name">${log.user.displayName}</span>
                            </div>
                            <span class="log-timestamp">${formatTimestamp(log.date)}</span>
                        </div>
                    </div>
                `;
                timelineList.appendChild(logItem);
            });

        } catch (error) {
            console.error('Failed to fetch activity logs:', error);
            timelineList.innerHTML = `<li class="error-placeholder">Could not load activity logs. Please try again later.</li>`;
        }
    };

    // --- Event Listeners ---
    backButton.addEventListener('click', (e) => {
        e.preventDefault();
        window.history.back();
    });

    // --- Initial Load ---
    fetchAndRenderLogs();
});