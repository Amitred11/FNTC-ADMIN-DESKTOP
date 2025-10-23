// scripts/system-config.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selections ---
    const form = document.getElementById('system-config-form');
    const toastContainer = document.getElementById('toast-container');
    const passwordToggles = document.querySelectorAll('.password-toggle-icon');

    // Ensure essential elements exist
    if (!form || !toastContainer ) {
        console.error('A required element is missing from the DOM.');
        return;
    }

    const fromNameInput = document.getElementById('from-name');
    const fromAddressInput = document.getElementById('from-address');
    const sendgridKeyInput = document.getElementById('sendgrid-key');
    const xenditKeyInput = document.getElementById('xendit-key');
    const xenditTokenInput = document.getElementById('xendit-token');
    const xenditFeeInput = document.getElementById('xendit-fee');

    /**
     * [NEW] Displays a toast notification.
     * @param {string} message The message to display.
     * @param {'success'|'error'} type The type of notification.
     */
    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const iconClass = type === 'success' ? 'ph-fill ph-check-circle' : 'ph-fill ph-x-circle';
        toast.innerHTML = `<i class="toast-icon ${iconClass}"></i><p>${message}</p>`;

        toastContainer.appendChild(toast);

        // Remove the toast after the animation ends
        setTimeout(() => {
            toast.remove();
        }, 5000); // Duration matches CSS animation
    };
    
    /**
     * Fetches configuration from the backend and populates the form.
     */
    const loadAndDisplayConfig = async () => {
        try {
            const response = await window.electronAPI.apiGet('/config');
            if (!response.ok) {
                showToast(`Failed to load settings: ${response.data?.message || 'Server error'}`, 'error');
                return;
            }

            const config = response.data;
            fromNameInput.value = config.emailFromName || '';
            fromAddressInput.value = config.emailFromAddress || '';
            xenditFeeInput.value = config.xenditTransactionFee || '0.00';

            sendgridKeyInput.placeholder = config.sendgridApiKey || 'Enter new SendGrid key';
            xenditKeyInput.placeholder = config.xenditApiKey || 'Enter new Xendit key';
            xenditTokenInput.placeholder = config.xenditCallbackToken || 'Enter new Xendit callback token';
            
            sendgridKeyInput.value = '';
            xenditKeyInput.value = '';
            xenditTokenInput.value = '';

        } catch (error) {
            console.error('An error occurred while loading configuration:', error);
            showToast('A client-side error occurred while loading settings.', 'error');
        }
    };

    /**
     * Handles the form submission to update the configuration.
     * @param {Event} event The form submission event.
     */
    const handleFormSubmit = async (event) => {
        event.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.textContent = 'Saving...';
        submitButton.disabled = true;

        const dataToSend = {
            emailFromName: fromNameInput.value.trim(),
            emailFromAddress: fromAddressInput.value.trim(),
            xenditTransactionFee: parseFloat(xenditFeeInput.value) || 0,
        };

        if (sendgridKeyInput.value) dataToSend.sendgridApiKey = sendgridKeyInput.value;
        if (xenditKeyInput.value) dataToSend.xenditApiKey = xenditKeyInput.value;
        if (xenditTokenInput.value) dataToSend.xenditCallbackToken = xenditTokenInput.value;

        try {
            const response = await window.electronAPI.apiPut('/config', dataToSend);

            if (response.ok) {
                 showToast('Configuration updated successfully!', 'success');
                 loadAndDisplayConfig(); 
            } else {
                const errorDetails = response.data?.errors ? Object.values(response.data.errors).join(' ') : '';
                const message = response.data?.message || 'Update failed.';
                showToast(`${message} ${errorDetails}`, 'error');
            }
        } catch (error) {
            console.error('An error occurred during submission:', error);
            showToast('A client-side error occurred during submission.', 'error');
        } finally {
            submitButton.textContent = 'Save Configuration';
            submitButton.disabled = false;
        }
    };
    
    /**
     * [NEW] Toggles the visibility of a password input field.
     * @param {Event} event The click event.
     */
    const togglePasswordVisibility = (event) => {
        const icon = event.currentTarget;
        const input = icon.previousElementSibling;
        if (input && input.tagName === 'INPUT') {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            icon.classList.toggle('ph-eye', !isPassword);
            icon.classList.toggle('ph-eye-slash', isPassword);
        }
    };


    // --- Event Listeners ---
    form.addEventListener('submit', handleFormSubmit);
    passwordToggles.forEach(toggle => toggle.addEventListener('click', togglePasswordVisibility));

    // Load initial data
    loadAndDisplayConfig();
});