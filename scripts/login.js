// login.js (Correct and Final)

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const rememberMeCheckbox = document.getElementById('remember-me');
    const submitButton = document.getElementById('submit-btn');
    const errorModal = document.getElementById('error-modal');
    const errorMessageElement = document.getElementById('error-message');
    const closeModalButton = document.getElementById('close-modal-btn');

    const showErrorModal = (message) => {
        errorMessageElement.textContent = message || 'An unknown error occurred.';
        errorModal.classList.remove('hidden');
    };

    const hideErrorModal = () => {
        errorModal.classList.add('hidden');
    };

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        submitButton.disabled = true;
        submitButton.textContent = 'Signing In...';

        const loginData = {
            email: emailInput.value,
            password: passwordInput.value,
            rememberMe: rememberMeCheckbox.checked,
        };

        try {
            const response = await window.electronAPI.authLogin(loginData);

            if (!response.ok) {
                const errorMessage = (response.data && response.data.message) 
                                   || response.message 
                                   || `An unknown error occurred. Status: ${response.status}`;
                throw new Error(errorMessage);
            }

            const { accessToken, refreshToken } = response.data;

            if (!accessToken || !refreshToken) {
                throw new Error('Login successful, but server did not provide authentication tokens.');
            }

            await window.electronAPI.saveTokens({ 
                accessToken, 
                refreshToken, 
                rememberMe: rememberMeCheckbox.checked,
                user: response.data.user
            });

            await window.electronAPI.loadPage('main/dashboard.html');

        } catch (error) {
            console.error('[Login Error]', error.message);
            showErrorModal(error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Sign In';
        }
    });

    closeModalButton.addEventListener('click', hideErrorModal);
    errorModal.addEventListener('click', (event) => {
        if (event.target === errorModal) {
            hideErrorModal();
        }
    });
});