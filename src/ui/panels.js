// ============================================
// DROPDOWN MENU MODULE
// ============================================

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
