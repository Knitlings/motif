// Input mode toggle functionality
(function() {
    const STORAGE_KEY = 'motif-help-input-mode';
    const buttons = document.querySelectorAll('.input-mode-btn');
    const body = document.body;

    // Detect if device is primarily a touch device (mobile/tablet)
    function isTouchDevice() {
        // Check if it's a mobile/tablet device based on screen size and touch points
        const isMobileScreen = window.innerWidth <= 1024;
        const hasTouchPoints = navigator.maxTouchPoints > 0;

        // Consider it a touch device only if both conditions are met
        // This excludes laptops with touchscreens but includes phones/tablets
        return isMobileScreen && hasTouchPoints;
    }

    // Load saved preference or default based on device type
    const defaultMode = isTouchDevice() ? 'touch' : 'desktop';
    const savedMode = localStorage.getItem(STORAGE_KEY) || defaultMode;
    setMode(savedMode);

    // Add click handlers to toggle buttons
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const mode = button.dataset.mode;
            setMode(mode);
            localStorage.setItem(STORAGE_KEY, mode);
        });
    });

    function setMode(mode) {
        // Update button states
        buttons.forEach(btn => {
            const isActive = btn.dataset.mode === mode;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive);
        });

        // Set data attribute on body for CSS targeting
        body.dataset.inputMode = mode;
    }
})();
