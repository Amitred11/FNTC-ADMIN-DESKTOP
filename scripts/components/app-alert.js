/* =================================================================
   APP ALERT & NOTIFICATION MODULE (SCOPE-CORRECTED - NON-UNIFIED)
   - scripts/components/app-alert.js
   ================================================================= */

const AppAlert = (() => {
    // --- Phosphor Icon Mappings ---
    const ICONS = {
        success: 'ph-check-circle',
        error: 'ph-x-circle',
        danger: 'ph-warning-octagon',
        warning: 'ph-warning',
        info: 'ph-info'
    };

    // --- Toast Notification Logic ---
    const toastContainer = document.getElementById('app-alert-toast-container');

    function notify({ type = 'info', title, message, duration = 5000 }) {
        if (!toastContainer) {
            console.error('AppAlert Error: Toast container #app-alert-toast-container not found.');
            return;
        }

        const toast = document.createElement('div');
        toast.className = 'app-alert-toast';
        toast.dataset.type = type;
        toast.style.setProperty('--toast-duration', `${duration}ms`);
        const iconClass = ICONS[type] || ICONS.info;

        toast.innerHTML = `
            <i class="app-alert-toast-icon ph-fill ${iconClass}"></i>
            <div class="app-alert-toast-content">
                <p class="app-alert-toast-title">${title}</p>
                <p class="app-alert-toast-message">${message}</p>
            </div>
            <button class="app-alert-toast-close" aria-label="Close">&times;</button>
        `;

        toastContainer.appendChild(toast);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('show'));
        });

        const removeToast = () => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        };

        const timeoutId = setTimeout(removeToast, duration);

        toast.querySelector('.app-alert-toast-close').addEventListener('click', () => {
            clearTimeout(timeoutId);
            removeToast();
        });
    }

    // --- Standard Confirmation Logic (DIV-based) ---
    const alertBox = document.getElementById('app-alert-box');
    const overlay = document.getElementById('app-alert-overlay');

    // Hoist variables for Standard Confirmation
    let standardResolver = null;
    let showStandardConfirmation;
    let hideStandardConfirmation;

    // Hoist variables for Prompt-enabled 'show'
    let activeResolver = null;
    let showPromptModal; 
    let hidePromptModal;

    const alertElements = (alertBox && overlay) ? {
        icon: document.getElementById('app-alert-icon'),
        title: document.getElementById('app-alert-title'),
        message: document.getElementById('app-alert-message'),
        cancelBtn: document.getElementById('app-alert-cancel-btn'),
        confirmBtn: document.getElementById('app-alert-confirm-btn'),
        inputWrapper: document.getElementById('app-alert-input-wrapper'),
        input: document.getElementById('app-alert-input'),
        errorMessage: document.getElementById('app-alert-error-message')
    } : null; // Initialize to null if elements aren't found


    if (alertElements) { 
        showStandardConfirmation = (options) => {
            return new Promise((resolve) => {
                if (standardResolver) {
                    standardResolver(false);
                }
                standardResolver = resolve;

                const { type = 'info', title, message, confirmText = 'Confirm', cancelText = 'Cancel' } = options;

                alertBox.dataset.type = type;
                alertElements.icon.className = `ph-fill ${ICONS[type] || ICONS.info}`;
                alertElements.title.textContent = title;
                alertElements.message.innerHTML = message;
                alertElements.confirmBtn.textContent = confirmText;
                alertElements.cancelBtn.textContent = cancelText;

                if (alertElements.inputWrapper) alertElements.inputWrapper.style.display = 'none';

                overlay.classList.add('visible');
                alertBox.classList.add('visible');
            });
        };

        hideStandardConfirmation = (result) => {
            if (standardResolver) {
                standardResolver(result);
                standardResolver = null;
            }
            overlay.classList.remove('visible');
            alertBox.classList.remove('visible');
        };

        alertElements.cancelBtn.addEventListener('click', () => hideStandardConfirmation(false));
        alertElements.confirmBtn.addEventListener('click', () => hideStandardConfirmation(true));


        showPromptModal = (options) => { 
            return new Promise((resolve) => {
                if (activeResolver) { 
                    activeResolver({ confirmed: false }); 
                }
                activeResolver = resolve;

                const { type = 'info', title, message, confirmText = 'Confirm', cancelText = 'Cancel', isPrompt = false, inputOptions = {} } = options;

                alertBox.dataset.type = type;
                alertElements.icon.className = `ph-fill ${ICONS[type] || ICONS.info}`;
                alertElements.title.textContent = title;
                alertElements.message.innerHTML = message;
                alertElements.confirmBtn.textContent = confirmText;
                alertElements.cancelBtn.textContent = cancelText;

                if (isPrompt && alertElements.inputWrapper) {
                    alertElements.inputWrapper.style.display = 'block';
                    alertElements.input.value = '';
                    alertElements.input.placeholder = inputOptions.placeholder || '';
                    alertElements.input.dataset.isRequired = inputOptions.isRequired || false;
                    alertElements.input.dataset.requiredMessage = inputOptions.requiredMessage || 'This field is required.';
                    alertElements.input.classList.remove('invalid');
                    alertElements.errorMessage.style.display = 'none';
                } else if (alertElements.inputWrapper) {
                    alertElements.inputWrapper.style.display = 'none';
                }

                overlay.classList.add('visible');
                alertBox.classList.add('visible');
                if (isPrompt) setTimeout(() => alertElements.input.focus(), 100);
            });
        };

        hidePromptModal = (confirmed) => {
            if (!activeResolver) return;

            if (confirmed && alertElements.inputWrapper && alertElements.inputWrapper.style.display === 'block') {
                const isRequired = alertElements.input.dataset.isRequired === 'true';
                const value = alertElements.input.value.trim();

                if (isRequired && value === '') {
                    alertElements.input.classList.add('invalid');
                    alertElements.errorMessage.textContent = alertElements.input.dataset.requiredMessage;
                    alertElements.errorMessage.style.display = 'block';
                    return;
                }
                activeResolver({ confirmed: true, value });
            } else {
                activeResolver({ confirmed });
            }

            activeResolver = null;
            overlay.classList.remove('visible');
            alertBox.classList.remove('visible');
        };
    } else {
        console.error('AppAlert Fatal Error: Standard alert elements (#app-alert-box, #app-alert-overlay) not found. The DIV-based alert system will not work.');
    }

    const dialog = document.getElementById('app-alert-dialog-box');
    let currentDialogResolver = null;
    let showDialogConfirmation; 

    if (dialog) {
        const dialogElements = {
            icon: document.getElementById('app-alert-dialog-icon'),
            title: document.getElementById('app-alert-dialog-title'),
            message: document.getElementById('app-alert-dialog-message'),
            cancelBtn: document.getElementById('app-alert-dialog-cancel-btn'),
            confirmBtn: document.getElementById('app-alert-dialog-confirm-btn')
        };

        dialogElements.confirmBtn.addEventListener('click', () => {
            dialog.close('default');
        });

        dialogElements.cancelBtn.addEventListener('click', () => {
            dialog.close('cancel');
        });

        showDialogConfirmation = (options) => {
            return new Promise((resolve) => {
                if (currentDialogResolver) {
                    currentDialogResolver(false);
                }
                currentDialogResolver = resolve;

                const { type = 'info', title, message, confirmText = 'Confirm', cancelText = 'Cancel' } = options;

                dialog.dataset.type = type;
                dialogElements.icon.className = `ph-fill ${ICONS[type] || ICONS.info}`;
                dialogElements.title.textContent = title;
                dialogElements.message.innerHTML = message;
                dialogElements.confirmBtn.textContent = confirmText;
                dialogElements.cancelBtn.textContent = cancelText;

                if (!dialog.open) {
                    dialog.showModal();
                }
            });
        };

        dialog.addEventListener('close', () => {
            if (currentDialogResolver) {
                const result = dialog.returnValue === 'default';
                currentDialogResolver(result);
                currentDialogResolver = null;
            }
        });

    } else {
        console.error('AppAlert Warning: Dialog element #app-alert-dialog-box not found.');
    }

    // --- Public API ---
    return {
        notify,
        confirm: (options) => {
            if (!alertElements || typeof showStandardConfirmation !== 'function') {
                return Promise.reject(new Error('Standard alert elements not found or initialized in the DOM.'));
            }
            return new Promise((resolve, reject) => {
                alertElements.confirmBtn.onclick = () => hideStandardConfirmation(true);
                alertElements.cancelBtn.onclick = () => hideStandardConfirmation(false);

                showStandardConfirmation(options).then(confirmed => {
                    if (confirmed) {
                        resolve();
                    } else {
                        reject(new Error('Confirmation cancelled.'));
                    }
                });
            });
        },
        prompt: (options) => {
            if (!alertElements || typeof showPromptModal !== 'function') { 
                return Promise.reject(new Error('Standard alert elements (for prompt) not found or initialized in the DOM.'));
            }
            const promptOptions = { ...options, isPrompt: true, inputOptions: {
                placeholder: options.inputPlaceholder,
                isRequired: options.isRequired,
                requiredMessage: options.requiredMessage
            }};
            return new Promise((resolve, reject) => {
                alertElements.confirmBtn.onclick = () => hidePromptModal(true);
                alertElements.cancelBtn.onclick = () => hidePromptModal(false);

                showPromptModal(promptOptions).then(result => {
                    if (result.confirmed) {
                        resolve(result.value);
                    } else {
                        reject(new Error('Prompt cancelled.'));
                    }
                });
            });
        },
        confirmOnDialog: (options) => {
            if (!dialog || typeof showDialogConfirmation !== 'function') {
                return Promise.reject(new Error('Dialog alert element not found or initialized in the DOM.'));
            }
            return new Promise((resolve, reject) => {
                showDialogConfirmation(options).then(confirmed => {
                    if (confirmed) {
                        resolve();
                    } else {
                        reject(new Error('Confirmation cancelled.'));
                    }
                });
            });
        }
    };
})();