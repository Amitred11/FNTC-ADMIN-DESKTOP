// scripts/settings/change-password.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. DOM Element Selection ---
    const dom = {
        form: document.querySelector('.change-password-form'),
        currentPasswordInput: document.getElementById('current-password'),
        newPasswordInput: document.getElementById('new-password'),
        confirmPasswordInput: document.getElementById('confirm-password'),
        passwordToggles: document.querySelectorAll('.toggle-password'),
        submitButton: document.querySelector('.change-password-form button[type="submit"]'),
        headerContainer: document.getElementById('header-container')
    };

    // --- 2. Validation: Ensure critical elements exist ---
    if (!dom.form || !dom.headerContainer || !dom.submitButton) {
        console.error('A critical element is missing from the page. Script cannot initialize.');
        return;
    }

    // --- 3. Helper Functions ---

    const showToast = (message, isError = false) => {
        const container = document.getElementById('toast-container') || document.createElement('div');
        if (!container.id) {
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${isError ? 'error' : 'success'}`;
        const iconClass = isError ? 'ph-fill ph-warning-circle' : 'ph-fill ph-check-circle';
        toast.innerHTML = `<i class="toast-icon ${iconClass}"></i> ${message}`;
        
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    };
    
    const updatePasswordAPI = async (currentPassword, newPassword) => {
        const endpoint = '/auth/change-password';
        const body = { currentPassword, newPassword };

        const result = await window.electronAPI.apiPut(endpoint, body);

        if (!result.ok) {
            throw new Error(result.data.message || 'An unknown API error occurred.');
        }

        return result.data;
    };

    const loadComponent = async (url, container) => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch component: ${response.status}`);
            container.innerHTML = await response.text();
        } catch (error) {
            console.error(`Failed to load component from ${url}:`, error);
            container.innerHTML = `<p style="text-align: center; color: red;">Error: Component failed to load.</p>`;
        }
    };

    // --- 4. Event Handlers ---

    const handlePasswordToggle = (event) => {
        const toggle = event.currentTarget;
        const passwordInput = toggle.previousElementSibling;
        const isPassword = passwordInput.type === 'password';
        
        passwordInput.type = isPassword ? 'text' : 'password';
        toggle.classList.toggle('ph-eye-slash');
        toggle.classList.toggle('ph-eye');
    };

    const handleFormSubmit = async (event) => {
        event.preventDefault();

        const currentPassword = dom.currentPasswordInput.value;
        const newPassword = dom.newPasswordInput.value;
        const confirmPassword = dom.confirmPasswordInput.value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            showToast('Please fill out all fields.', true);
            return;
        }
        if (newPassword !== confirmPassword) {
            showToast('New passwords do not match.', true);
            return;
        }
        if (newPassword.length < 8) {
            showToast('New password must be at least 8 characters long.', true);
            return;
        }

        dom.submitButton.disabled = true;
        dom.submitButton.textContent = 'Updating...';

        try {
            const response = await updatePasswordAPI(currentPassword, newPassword);
            showToast(response.message, false);
            dom.form.reset();
        } catch (error) {
            showToast(error.message || 'An unknown error occurred.', true);
        } finally {
            dom.submitButton.disabled = false;
            dom.submitButton.textContent = 'Update Password';
        }
    };

    // --- 5. Initialization ---
    
    await loadComponent('../../components/header.html', dom.headerContainer);

    if (window.initializeHeader) window.initializeHeader();
    if (window.setHeader) {
        window.setHeader('Change Password', 'Update your password for enhanced security.');
    }
    
    dom.passwordToggles.forEach(toggle => toggle.addEventListener('click', handlePasswordToggle));
    dom.form.addEventListener('submit', handleFormSubmit);
});