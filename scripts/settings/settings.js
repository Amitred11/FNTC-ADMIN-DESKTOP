document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // STATE & DOM ELEMENTS
    // =================================================================
    let state = {
        profile: {}
    };

    const settingsView = document.getElementById('settings-view');
    const editProfileView = document.getElementById('edit-profile-view');
    
    // Buttons
    const editProfileBtn = document.getElementById('edit-profile-btn');
    const backToSettingsBtn = document.getElementById('back-to-settings-btn');
    const changePhotoBtn = document.getElementById('change-photo-btn');
    const photoUploadInput = document.getElementById('photo-upload-input');
    const saveChangesBtn = document.getElementById('save-changes-btn');
    
    // Forms & Inputs
    const profileForm = document.getElementById('profile-form');
    const fullNameInput = document.getElementById('full-name');
    const uploadOverlay = document.getElementById('upload-overlay');
    const systemSettingsGroup = document.getElementById('system-settings-group');

    // Sidebar Elements
    const sidebar = document.getElementById('sidebar-container');
    const overlay = document.getElementById('sidebar-overlay');
    
    // =================================================================
    // RENDER FUNCTION - Updates the entire UI from state
    // =================================================================
    const renderProfileData = (profile) => {
        const photoUrl = profile.photoUrl ? `${profile.photoUrl}?_=${new Date().getTime()}` : '../../assets/images/default-avatar.jpg';
        const defaultAvatar = '../../assets/images/default-avatar.jpg';
        
        document.getElementById('settings-avatar-img').src = photoUrl || defaultAvatar;
        document.getElementById('settings-name').textContent = profile.displayName;
        document.getElementById('settings-email').textContent = profile.email;

        document.getElementById('edit-avatar-img').src = photoUrl || defaultAvatar;
        document.getElementById('edit-name').textContent = profile.displayName;
        document.getElementById('edit-email').textContent = profile.email;
        fullNameInput.value = profile.displayName;

        if (profile.role === 'admin') {
            systemSettingsGroup.classList.remove('hidden');
        } else {
            systemSettingsGroup.classList.add('hidden');
        }
        
        updateSaveButtonState();
    };

    // =================================================================
    // UI MANAGEMENT
    // =================================================================
    const showView = (viewToShow) => {
        settingsView.classList.add('hidden');
        editProfileView.classList.add('hidden');
        document.getElementById(viewToShow).classList.remove('hidden');
    };

    const updateSaveButtonState = () => {
        if (!state.profile) return;
        const isUnchanged = fullNameInput.value.trim() === state.profile.displayName;
        saveChangesBtn.disabled = isUnchanged;
    };
    
    const showUploadingState = (isUploading) => {
        uploadOverlay.classList.toggle('hidden', !isUploading);
    };

    const readFileAsArrayBuffer = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    };

    const setupMobileMenu = () => {
        const mobileMenuButton = document.getElementById('mobile-menu-button');

        if (mobileMenuButton && sidebar && overlay) {
            mobileMenuButton.addEventListener('click', () => {
                sidebar.classList.add('mobile-visible');
                overlay.classList.add('visible');
            });

            overlay.addEventListener('click', () => {
                sidebar.classList.remove('mobile-visible');
                overlay.classList.remove('visible');
            });
        }
    };

    editProfileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showView('edit-profile-view');
    });

    backToSettingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        renderProfileData(state.profile);
        showView('settings-view');
    });

    changePhotoBtn.addEventListener('click', () => photoUploadInput.click());
    
    fullNameInput.addEventListener('input', updateSaveButtonState);

    photoUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showUploadingState(true);
        try {
            const buffer = await readFileAsArrayBuffer(file);
            const fileData = { buffer, name: file.name, type: file.type };

            const response = await window.electronAPI.uploadFile({
                endpoint: '/me/photo',
                fieldName: 'profileImage',
                file: fileData
            });

            if (response.ok) {
                state.profile = response.data;
                renderProfileData(state.profile);
                AppAlert.notify({
                    type: 'success',
                    title: 'Success',
                    message: 'Photo updated successfully!'
                });
            } else {
                throw new Error(response.data.message || 'Server error');
            }
        } catch (error) {
            AppAlert.notify({
                type: 'error',
                title: 'Upload Failed',
                message: `Failed to upload photo: ${error.message}`
            });
        } finally {
            showUploadingState(false);
            e.target.value = '';
        }
    });

    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        saveChangesBtn.textContent = 'Saving...';
        saveChangesBtn.disabled = true;

        try {
            const response = await window.electronAPI.apiPut('/me', { 
                displayName: fullNameInput.value.trim() 
            });

            if (response.ok) {
                state.profile = response.data;
                renderProfileData(state.profile);
                AppAlert.notify({
                    type: 'success',
                    title: 'Profile Updated',
                    message: 'Your profile has been saved successfully!'
                });
                showView('settings-view');
            } else {
                throw new Error(response.data.message || 'Server error');
            }
        } catch (error) {
            AppAlert.notify({
                type: 'error',
                title: 'Update Failed',
                message: `Failed to save profile: ${error.message}`
            });
        } finally {
            saveChangesBtn.textContent = 'Save Changes';
            updateSaveButtonState();
        }
    });
    
    const handleLogout = async () => {
        try {
            await AppAlert.confirm({
                type: 'warning',
                title: 'Confirm Logout',
                message: 'Are you sure you want to log out of your account?',
                confirmText: 'Logout',
                cancelText: 'Cancel'
            });
            window.electronAPI.logout();
        } catch (error) {
            if (error.message !== "Confirmation cancelled by user.") {
               console.log('Logout cancelled by user.');
            }
        }
    };
    
    document.getElementById('logout-btn-main').addEventListener('click', handleLogout);
    document.getElementById('logout-btn-profile').addEventListener('click', handleLogout);

    const initializeApp = async () => {
        setTimeout(setupMobileMenu, 100);

        try {
            const response = await window.electronAPI.apiGet('/me'); 
            if (response.ok) {
                state.profile = response.data;
                renderProfileData(state.profile);
                showView('settings-view');
            } else {
                 throw new Error(response.data?.message || 'Failed to fetch profile');
            }
        } catch (error) {
            console.error("Initialization failed:", error);
            AppAlert.notify({
                type: 'error',
                title: 'Loading Error',
                message: `Could not load user settings: ${error.message}`
            });
        }
    };

    initializeApp();
});