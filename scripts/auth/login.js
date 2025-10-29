document.addEventListener('DOMContentLoaded', () => {
    const welcomeScreen = document.getElementById('welcome-screen');
    const loginContainer = document.getElementById('login-container');
    const welcomeDuration = 3000;

    setTimeout(() => {
        if (welcomeScreen) {
            welcomeScreen.style.display = 'none';
        }

        if (loginContainer) {
            loginContainer.classList.remove('hidden');
        }
    }, welcomeDuration);


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
    const loadingLogo = document.getElementById('loading-logo');

    // --- Initial Setup: Check for pre-fill data ---
    (async () => {
        const prefillData = await window.electronAPI.getPrefillCredentials();
        if (prefillData) {
            emailInput.value = prefillData.email;
            passwordInput.value = prefillData.password;
            rememberMeCheckbox.checked = true;
        }
    })();

    // --- Password Visibility Toggle ---
    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            eyeIcon.classList.toggle('fa-eye', !isPassword);
            eyeIcon.classList.toggle('fa-eye-slash', isPassword);
        });
    }
    
    // --- UI State Management Functions ---
    const showLoadingState = () => {
        submitButton.disabled = true;
        submitButton.querySelector('span').textContent = 'Signing In...';
        loadingOverlay.classList.add('visible');
        loadingLogo.classList.add('launching');
        loginContainer.classList.add('disappearing');
    };

    const hideLoadingState = () => {
        submitButton.disabled = false;
        submitButton.querySelector('span').textContent = 'Sign In';
        loadingOverlay.classList.remove('visible');
        loadingLogo.classList.remove('launching');
        loginContainer.classList.remove('disappearing');
    };

    // --- Error Modal Functions ---
    const showErrorModal = (message) => {
        errorMessageElement.textContent = message || 'An unknown error occurred.';
        errorModal.classList.remove('hidden');
    };

    const hideErrorModal = () => errorModal.classList.add('hidden');

    // --- Main Login Submission Handler ---
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        showLoadingState();

        try {
            const loginCredentials = {
                email: emailInput.value,
                password: passwordInput.value,
            };

            const response = await window.electronAPI.authLogin(loginCredentials);

            if (!response.ok || !response.data) {
                const errorMessage = response.data?.message || 'Invalid credentials or a server error occurred.';
                throw new Error(errorMessage);
            }

            const { accessToken, refreshToken, user } = response.data;
            if (!accessToken || !user) {
                throw new Error('Authentication response was incomplete.');
            }

            await window.electronAPI.saveTokens({ 
                accessToken, 
                refreshToken, 
                rememberMe: rememberMeCheckbox.checked,
                user,
                credentials: loginCredentials
            });

            await window.electronAPI.loadPage('main/dashboard.html');

        } catch (error) {
            console.error('[Login Error]', error.message);
            showErrorModal(error.message);
            setTimeout(hideLoadingState, 500);
        }
    });

    // --- Modal Event Listeners ---
    closeModalButton.addEventListener('click', hideErrorModal);
    errorModal.addEventListener('click', (e) => {
        if (e.target === errorModal) hideErrorModal();
    });
});