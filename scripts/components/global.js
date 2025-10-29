// scripts/common/global.js (Updated)

document.addEventListener('DOMContentLoaded', () => {
    const handleInitialLoadAnimation = () => {
        const currentPage = document.body.getAttribute('data-page');

        if (currentPage === 'login') {
            console.log('ⓘ On login page, skipping entry animation.');
            return;
        }

        if (sessionStorage.getItem('hasInitialAnimationPlayed') !== 'true') {
            console.log('✅ First load detected. Playing entry animation.');
            document.body.classList.add('is-loading');

            sessionStorage.setItem('hasInitialAnimationPlayed', 'true');

            setTimeout(() => {
                document.body.classList.remove('is-loading');
            }, 1200);
        } else {
             console.log('ⓘ Subsequent page load. Skipping entry animation.');
        }
    };

    handleInitialLoadAnimation();
});