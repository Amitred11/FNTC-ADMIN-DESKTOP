// login.js (Corrected and Final)

document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selectors ---
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const rememberMeCheckbox = document.getElementById('remember-me');
    const submitButton = document.getElementById('submit-btn');
    const errorModal = document.getElementById('error-modal');
    const errorMessageElement = document.getElementById('error-message');
    const closeModalButton = document.getElementById('close-modal-btn');
    const togglePassword = document.querySelector('#toggle-password');
    const eyeIcon = document.querySelector('#eye-icon');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loginContainer = document.getElementById('login-container');
    const loadingLogo = document.getElementById('loading-logo');

    // --- Password Visibility Toggle ---
    if (togglePassword && passwordInput && eyeIcon) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            eyeIcon.classList.toggle('fa-eye-slash');
            eyeIcon.classList.toggle('fa-eye');
        });
    }

    // --- Error Modal Functions ---
    const showErrorModal = (message) => {
        errorMessageElement.textContent = message || 'An unknown error occurred.';
        errorModal.classList.remove('hidden');
    };

    const hideErrorModal = () => {
        errorModal.classList.add('hidden');
    };

    // --- Main Login Submission Handler ---
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        submitButton.disabled = true;
        const buttonText = submitButton.querySelector('span');
        if (buttonText) buttonText.textContent = 'Signing In...';
        loadingOverlay.classList.add('visible');
        loadingLogo.classList.add('launching');
        loginContainer.classList.add('disappearing');

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

            const { accessToken, refreshToken, user } = response.data; // Destructure user here

            if (!accessToken || !refreshToken) {
                throw new Error('Login successful, but server did not provide authentication tokens.');
            }

            // If successful, save tokens AND the user profile
            await window.electronAPI.saveTokens({ 
                accessToken, 
                refreshToken, 
                rememberMe: rememberMeCheckbox.checked,
                user // Pass the user object
            });

            // --- FIX #3: Use the correct path to the dashboard file ---
            await window.electronAPI.loadPage('main/dashboard.html');

        } catch (error) {
            console.error('[Login Error]', error.message);
            showErrorModal(error.message);

            setTimeout(() => {
                submitButton.disabled = false;
                if (buttonText) buttonText.textContent = 'Sign In'; 
                
                loadingOverlay.classList.remove('visible');
                loadingLogo.classList.remove('launching');
                loginContainer.classList.remove('disappearing');
            }, 500);
        }
    });

    // --- Modal Event Listeners ---
    closeModalButton.addEventListener('click', hideErrorModal);
    errorModal.addEventListener('click', (event) => {
        if (event.target === errorModal) {
            hideErrorModal();
        }
    });
});