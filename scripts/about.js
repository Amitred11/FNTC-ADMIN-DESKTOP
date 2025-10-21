// scripts/about.js
document.addEventListener('DOMContentLoaded', () => {
    const themeToggleButton = document.getElementById('theme-toggle-btn');
    const backButton = document.getElementById('back-btn');
    const body = document.body;

    // --- THEME SWITCHING LOGIC ---

    // Function to apply the saved theme or system preference
    const applyInitialTheme = () => {
        const savedTheme = localStorage.getItem('theme') || 'light';
        body.setAttribute('data-theme', savedTheme);
        updateToggleIcon(savedTheme);
    };

    // Function to update the icon in the toggle button
    const updateToggleIcon = (theme) => {
        if (themeToggleButton) {
            const icon = themeToggleButton.querySelector('i');
            if (theme === 'dark') {
                icon.classList.remove('ph-moon');
                icon.classList.add('ph-sun');
            } else {
                icon.classList.remove('ph-sun');
                icon.classList.add('ph-moon');
            }
        }
    };
    
    // Event listener for the theme toggle button
    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', () => {
            let newTheme = body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
            body.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateToggleIcon(newTheme);
        });
    }

    // --- NAVIGATION ---

    // Event listener for the back button
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.history.back(); // Go to the previous page in session history
        });
    }

    // Initialize the theme when the page loads
    applyInitialTheme();
});