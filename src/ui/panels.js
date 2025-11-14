// ============================================
// PANEL TOGGLING MODULE
// ============================================

/**
 * Initialize panel toggling functionality
 * @param {Function} announceToScreenReader - Function to announce to screen readers
 * @param {Function} updateColorIndicators - Function to update color indicators
 */
export function setupPanelToggles(announceToScreenReader, updateColorIndicators) {
    /**
     * Toggle the color panel visibility
     */
    function toggleColorPanel() {
        const panel = document.getElementById('colorPanel');
        const isCollapsed = panel.classList.toggle('collapsed');

        // Update aria-expanded state
        panel.setAttribute('aria-expanded', !isCollapsed);

        if (isCollapsed) {
            updateColorIndicators();
            announceToScreenReader('Color panel collapsed');
        } else {
            announceToScreenReader('Color panel expanded');
        }
    }

    /**
     * Toggle the settings panel visibility
     */
    function toggleSettingsPanel() {
        const panel = document.getElementById('settingsPanel');
        const isCollapsed = panel.classList.toggle('collapsed');

        // Update aria-expanded state
        panel.setAttribute('aria-expanded', !isCollapsed);
        announceToScreenReader(isCollapsed ? 'Settings panel collapsed' : 'Settings panel expanded');
    }

    // Navbar toggle buttons
    const navbarColorToggle = document.getElementById('navbarColorToggle');
    const navbarSettingsToggle = document.getElementById('navbarSettingsToggle');

    if (navbarColorToggle) {
        navbarColorToggle.addEventListener('click', toggleColorPanel);
    }

    if (navbarSettingsToggle) {
        navbarSettingsToggle.addEventListener('click', toggleSettingsPanel);
    }

    // Panel close buttons (for mobile)
    const colorPanelClose = document.getElementById('colorPanelClose');
    const settingsPanelClose = document.getElementById('settingsPanelClose');

    if (colorPanelClose) {
        colorPanelClose.addEventListener('click', toggleColorPanel);
    }

    if (settingsPanelClose) {
        settingsPanelClose.addEventListener('click', toggleSettingsPanel);
    }

    return {
        toggleColorPanel,
        toggleSettingsPanel
    };
}

/**
 * Initialize dropdown menu functionality
 */
export function setupDropdowns() {
    const dropdownContainers = document.querySelectorAll('.dropdown-container, .navbar-dropdown-container');

    dropdownContainers.forEach(container => {
        const btn = container.querySelector('.dropdown-btn, .navbar-dropdown-btn');
        const menu = container.querySelector('.dropdown-menu, .navbar-dropdown-menu');

        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = container.classList.contains('open');

                // Close all other dropdowns
                dropdownContainers.forEach(otherContainer => {
                    if (otherContainer !== container) {
                        otherContainer.classList.remove('open');
                        const otherBtn = otherContainer.querySelector('.dropdown-btn, .navbar-dropdown-btn');
                        if (otherBtn) {
                            otherBtn.setAttribute('aria-expanded', 'false');
                        }
                    }
                });

                // Toggle current dropdown
                container.classList.toggle('open');
                btn.setAttribute('aria-expanded', !isOpen);
            });

            // Keyboard support for dropdowns
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    btn.click();
                } else if (e.key === 'Escape') {
                    container.classList.remove('open');
                    btn.setAttribute('aria-expanded', 'false');
                    btn.focus();
                }
            });
        }
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        dropdownContainers.forEach(container => {
            if (!container.contains(e.target)) {
                container.classList.remove('open');
                const btn = container.querySelector('.dropdown-btn, .navbar-dropdown-btn');
                if (btn) {
                    btn.setAttribute('aria-expanded', 'false');
                }
            }
        });
    });

    // Close dropdowns on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            dropdownContainers.forEach(container => {
                container.classList.remove('open');
                const btn = container.querySelector('.dropdown-btn, .navbar-dropdown-btn');
                if (btn) {
                    btn.setAttribute('aria-expanded', 'false');
                }
            });
        }
    });

    // Close dropdowns when selecting an item
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            dropdownContainers.forEach(container => {
                container.classList.remove('open');
                const btn = container.querySelector('.dropdown-btn, .navbar-dropdown-btn');
                if (btn) {
                    btn.setAttribute('aria-expanded', 'false');
                }
            });
        });
    });
}
