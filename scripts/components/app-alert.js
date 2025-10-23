/**
 * ========================================================================
 * ||                     APP ALERT COMPONENT SCRIPT                     ||
 * ========================================================================
 */
const AppAlert = (() => {
    // --- DOM ELEMENT REFERENCES ---
    const container = document.getElementById('app-alert-container');
    const toastContainer = document.getElementById('app-alert-toast-container');
    
    // Original Modal (DIV-based)
    const modal = {
        overlay: document.getElementById('app-alert-overlay'),
        box: document.getElementById('app-alert-box'),
        icon: document.getElementById('app-alert-icon'),
        title: document.getElementById('app-alert-title'),
        message: document.getElementById('app-alert-message'),
        confirmBtn: document.getElementById('app-alert-confirm-btn'),
        cancelBtn: document.getElementById('app-alert-cancel-btn')
    };
    
    // Dialog Modal (<dialog>-based)
    const dialog = {
        box: document.getElementById('app-alert-dialog-box'),
        icon: document.getElementById('app-alert-dialog-icon'),
        title: document.getElementById('app-alert-dialog-title'),
        message: document.getElementById('app-alert-dialog-message'),
        confirmBtn: document.getElementById('app-alert-dialog-confirm-btn'),
        cancelBtn: document.getElementById('app-alert-dialog-cancel-btn')
    };

    // --- CONFIGURATION ---
    const icons = {
        success: 'ph-check-circle',
        error: 'ph-x-circle',
        danger: 'ph-warning-octagon',
        warning: 'ph-warning',
        info: 'ph-info',
        primary: 'ph-question'
    };

    /**
     * Creates and displays a non-blocking toast notification.
     */
    const notify = ({ type = 'info', title, message, duration = 5000 }) => {
        const toast = document.createElement('div');
        toast.className = `app-alert-toast ${type}`;
        toast.innerHTML = `
            <i class="app-alert-toast-icon ph-fill ${icons[type]}"></i>
            <div>
                <strong class="app-alert-toast-title">${title}</strong>
                <p class="app-alert-toast-message">${message}</p>
            </div>
            <button class="app-alert-toast-close">&times;</button>
        `;
        toastContainer.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);
        
        const removeToast = () => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        };
        
        const timer = setTimeout(removeToast, duration);
        
        toast.querySelector('.app-alert-toast-close').addEventListener('click', () => {
            clearTimeout(timer);
            removeToast();
        });
    };

    /**
     * Displays a blocking confirmation modal.
     * This version uses a standard DIV overlay, which may not appear over <dialog> elements.
     */
    const confirm = (options) => {
        return new Promise((resolve, reject) => {
            if (!modal.box) return reject(new Error("Standard modal element not found."));

            // Set up modal content
            const { type = 'warning', title, message, confirmText = 'Confirm', cancelText = 'Cancel' } = options;
            modal.title.textContent = title;
            modal.message.textContent = message;
            modal.confirmBtn.textContent = confirmText;
            modal.cancelBtn.textContent = cancelText;
            modal.box.className = `app-alert-box ${type}`;
            modal.icon.className = `ph-fill ${icons[type]}`;

            // Show modal
            container.classList.add('show');
            
            const cleanup = (result) => {
                container.classList.remove('show');
                modal.confirmBtn.removeEventListener('click', onConfirm);
                modal.cancelBtn.removeEventListener('click', onCancel);
                modal.overlay.removeEventListener('click', onCancel);
                result ? resolve() : reject(new Error('User cancelled the action.'));
            };
            
            const onConfirm = () => cleanup(true);
            const onCancel = () => cleanup(false);
            
            modal.confirmBtn.addEventListener('click', onConfirm);
            modal.cancelBtn.addEventListener('click', onCancel);
            modal.overlay.addEventListener('click', onCancel);
        });
    };
    
    /**
     * Displays a confirmation modal using a <dialog> element.
     * This is preferred when you need a modal that can appear over other dialogs.
     */
    const confirmOnDialog = (options) => {
        return new Promise((resolve, reject) => {
            if (!dialog.box) return reject(new Error("<dialog> element not found."));
            
            const { type = 'warning', title, message, confirmText = 'Confirm', cancelText = 'Cancel' } = options;
            dialog.title.textContent = title;
            dialog.message.textContent = message;
            dialog.confirmBtn.textContent = confirmText;
            dialog.cancelBtn.textContent = cancelText;
            dialog.box.className = `app-alert-dialog ${type}`;
            dialog.icon.className = `ph-fill ${icons[type]}`;

            const handleClose = () => {
                // 'confirm' is our custom value for the confirmation button
                dialog.box.returnValue === 'confirm' ? resolve() : reject(new Error('User cancelled the action.'));
            };

            dialog.box.addEventListener('close', handleClose, { once: true });
            dialog.box.showModal();
        });
    };

    // Setup event listeners for the dialog's buttons
    if (dialog.confirmBtn) {
        dialog.confirmBtn.addEventListener('click', (e) => {
            e.preventDefault();
            dialog.box.close('confirm');
        });
    }
    if (dialog.cancelBtn) {
        dialog.cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            dialog.box.close('cancel');
        });
    }

    // Expose public API
    window.AppAlert = {
        notify,
        confirm,
        confirmOnDialog 
    };
})();