// Input mode toggle functionality
(function() {
    const STORAGE_KEY = 'motif-help-input-mode';
    const buttons = document.querySelectorAll('.input-mode-btn');
    const body = document.body;

    // Load saved preference or default to desktop
    const savedMode = localStorage.getItem(STORAGE_KEY) || 'desktop';
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
