// /scripts/common.js

const AppCommon = {

    fetchData: async (endpoint) => {
        try {
            if (!window.electronAPI) {
                console.warn("Electron API not found. Running in mock mode.");
                return null;
            }
            const response = await window.electronAPI.apiGet(endpoint);
            if (!response || !response.ok) {
                if (response.status === 401 || response.status === 403) {
                    window.electronAPI.loadPage('auth/login.html'); 
                }
                throw new Error(response.message || `API request failed: ${response.status}`);
            }
            return response.data;
        } catch (error) {
            console.error(`[Common API Error] GET ${endpoint} failed:`, error);
            return null; 
        }
    },

    postData: async (endpoint, body) => {
        try {
            if (!window.electronAPI) { return { ok: true, message: "Mocked POST" }; }
            return await window.electronAPI.apiPost(endpoint, body);
        } catch (error) {
            console.error(`[Common API Error] POST ${endpoint} failed:`, error);
            return { ok: false, message: error.message };
        }
    },


    deleteData: async (endpoint, body) => {
        try {
            if (!window.electronAPI) { return { ok: true, message: "Mocked DELETE" }; }
            return await window.electronAPI.apiDelete(endpoint, body);
        } catch (error) {
            console.error(`[Common API Error] DELETE ${endpoint} failed:`, error);
            return { ok: false, message: error.message };
        }
    },


    showToast: (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        if (!container) {
            console.error('Toast container not found in the DOM.');
            return;
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 100);

        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
    },

    formatRelativeTime: (dateString) => {
        const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    },

    openModal: (modal) => {
        const modalOverlay = document.getElementById('modal-overlay');
        if (modal && modalOverlay) {
            modal.classList.remove('hidden');
            modalOverlay.classList.remove('hidden');
        }
    },

    closeModal: (modal) => {
        const modalOverlay = document.getElementById('modal-overlay');
        if (modal) {
            modal.classList.add('hidden');
        }
        
        const isAnyModalOpen = document.querySelector('.fullscreen-modal:not(.hidden), .modal-dialog:not(.hidden)');
        
        if (!isAnyModalOpen && modalOverlay) {
            modalOverlay.classList.add('hidden');
        }
    },
};