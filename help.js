// Desktop / Touch instructions choice
(function() {
    const STORAGE_KEY = 'motif-help-input-mode';
    const radios = document.querySelectorAll('input[name="input-mode"]');
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

    function readSavedMode() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch {
            return null;
        }
    }

    // Load saved preference or default based on device type
    const defaultMode = isTouchDevice() ? 'touch' : 'desktop';
    const savedMode = readSavedMode();
    setMode(savedMode === 'touch' || savedMode === 'desktop' ? savedMode : defaultMode);

    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (!radio.checked) return;
            setMode(radio.value);
            try {
                localStorage.setItem(STORAGE_KEY, radio.value);
            } catch {
                // Choice still applies for this visit
            }
        });
    });

    function setMode(mode) {
        radios.forEach(radio => {
            radio.checked = radio.value === mode;
        });

        // Set data attribute on body for CSS targeting
        body.dataset.inputMode = mode;
    }
})();
