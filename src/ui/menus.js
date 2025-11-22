// ============================================
// MENU MANAGER
// ============================================

import { UI_CONSTANTS } from '../config.js';

/**
 * Manages color menu creation and lifecycle
 * Eliminates duplicate menu logic across the application
 */
export class ColorMenuManager {
    constructor() {
        this.currentMenu = null;
        this.closeHandler = this.close.bind(this);
    }

    /**
     * Creates and displays a menu with custom items
     * @param {Object} options - Menu configuration
     * @param {HTMLElement} options.triggerElement - Element that triggered the menu
     * @param {Array<Object>} options.items - Array of menu item configurations
     *   Each item: { label, onClick, className, disabled }
     * @param {string} [options.className='navbar-color-menu'] - Menu container class
     * @param {string} [options.itemClassName='navbar-color-menu-item'] - Menu item class
     * @param {Object} [options.position] - Custom positioning
     */
    show(options) {
        const {
            triggerElement,
            items,
            className = 'navbar-color-menu',
            itemClassName = 'navbar-color-menu-item',
            position
        } = options;

        // Close any existing menu
        this.close();

        // Create menu container
        const menu = document.createElement('div');
        menu.className = className;
        menu.setAttribute('role', 'menu');

        // Add menu items
        items.forEach(item => {
            if (!item) return; // Skip null/undefined items

            const button = document.createElement('button');
            button.className = item.className || itemClassName;
            button.textContent = item.label;
            button.setAttribute('role', 'menuitem');

            if (item.disabled) {
                button.disabled = true;
            }

            button.addEventListener('click', (e) => {
                e.stopPropagation();
                if (item.onClick) {
                    item.onClick(e);
                }
                this.close();
            });

            menu.appendChild(button);
        });

        // Position menu
        this.positionMenu(menu, triggerElement, position);

        // Add to DOM
        document.body.appendChild(menu);
        this.currentMenu = menu;

        // Set up click-outside listener (with slight delay to avoid immediate close)
        setTimeout(() => {
            document.addEventListener('click', this.closeHandler);
        }, 0);

        return menu;
    }

    /**
     * Positions the menu relative to the trigger element
     * @param {HTMLElement} menu - Menu element
     * @param {HTMLElement} triggerElement - Element that triggered the menu
     * @param {Object} [customPosition] - Custom positioning override
     */
    positionMenu(menu, triggerElement, customPosition) {
        const rect = triggerElement.getBoundingClientRect();

        menu.style.position = 'absolute';

        if (customPosition) {
            // Use custom positioning if provided
            Object.assign(menu.style, customPosition);
        } else {
            // Default: center below trigger element
            menu.style.top = `${rect.bottom + UI_CONSTANTS.MENU_OFFSET_Y}px`;
            menu.style.left = `${rect.left + rect.width / 2}px`;
            menu.style.transform = 'translateX(-50%)';
        }

        // Ensure menu stays within viewport
        this.adjustMenuPosition(menu);
    }

    /**
     * Adjusts menu position to keep it within viewport bounds
     * @param {HTMLElement} menu - Menu element
     */
    adjustMenuPosition(menu) {
        // Wait for next frame to ensure menu is rendered and has dimensions
        requestAnimationFrame(() => {
            const menuRect = menu.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const padding = UI_CONSTANTS.MENU_EDGE_PADDING;

            // Adjust horizontal position if menu extends beyond viewport
            if (menuRect.right > viewportWidth - padding) {
                const currentLeft = parseFloat(menu.style.left) || 0;
                const overflow = menuRect.right - (viewportWidth - padding);
                menu.style.left = `${currentLeft - overflow}px`;
            } else if (menuRect.left < padding) {
                const currentLeft = parseFloat(menu.style.left) || 0;
                const overflow = padding - menuRect.left;
                menu.style.left = `${currentLeft + overflow}px`;
            }

            // Adjust vertical position if menu extends beyond viewport
            if (menuRect.bottom > viewportHeight - padding) {
                // Try positioning above the trigger element instead
                const triggerRect = menu.parentElement?.getBoundingClientRect();
                if (triggerRect) {
                    menu.style.top = `${triggerRect.top - menuRect.height - UI_CONSTANTS.MENU_OFFSET_Y}px`;
                }
            }
        });
    }

    /**
     * Closes the current menu
     */
    close() {
        if (this.currentMenu) {
            document.removeEventListener('click', this.closeHandler);

            if (this.currentMenu.parentNode) {
                this.currentMenu.parentNode.removeChild(this.currentMenu);
            }

            this.currentMenu = null;
        }
    }

    /**
     * Checks if a menu is currently open
     * @returns {boolean}
     */
    isOpen() {
        return this.currentMenu !== null;
    }

    /**
     * Destroys the menu manager
     */
    destroy() {
        this.close();
        this.closeHandler = null;
    }
}

/**
 * Helper function to create a standard color menu with Select/Edit/Delete options
 * @param {ColorMenuManager} menuManager - The menu manager instance
 * @param {Object} options - Menu options
 * @param {HTMLElement} options.triggerElement - Element that triggered the menu
 * @param {number} options.colorIndex - Index of the color
 * @param {string} options.color - Hex color string
 * @param {number} options.activeIndex - Currently active color index
 * @param {Function} options.onSelect - Callback when select is clicked
 * @param {Function} options.onEdit - Callback when edit is clicked
 * @param {Function} options.onDelete - Callback when delete is clicked
 * @returns {HTMLElement} The created menu element
 */
export function createColorMenu(menuManager, options) {
    const {
        triggerElement,
        colorIndex,
        color,
        activeIndex,
        onSelect,
        onEdit,
        onDelete
    } = options;

    const items = [];

    // Select option (only if not already active)
    if (colorIndex !== activeIndex && onSelect) {
        items.push({
            label: 'Select',
            onClick: () => onSelect(colorIndex)
        });
    }

    // Edit option
    if (onEdit) {
        items.push({
            label: colorIndex === activeIndex ? 'Edit' : 'Edit and select',
            onClick: () => onEdit(colorIndex, color)
        });
    }

    // Delete option (only for non-first colors)
    if (colorIndex > 0 && onDelete) {
        items.push({
            label: 'Delete',
            className: 'navbar-color-menu-item navbar-color-menu-item-danger',
            onClick: () => onDelete(colorIndex)
        });
    }

    return menuManager.show({
        triggerElement,
        items
    });
}

/**
 * Helper function to create an overflow menu with multiple colors
 * @param {ColorMenuManager} menuManager - The menu manager instance
 * @param {Object} options - Menu options
 * @param {HTMLElement} options.triggerElement - Element that triggered the menu
 * @param {Array<string>} options.colors - Array of hex color strings
 * @param {number} options.startIndex - Starting index for colors
 * @param {number} options.activeIndex - Currently active color index
 * @param {Function} options.onColorClick - Callback when a color is clicked
 * @returns {HTMLElement} The created menu element
 */
export function createOverflowMenu(menuManager, options) {
    const {
        triggerElement,
        colors,
        startIndex,
        activeIndex,
        onColorClick
    } = options;

    const items = colors.map((color, offset) => {
        const index = startIndex + offset;
        const isActive = index === activeIndex;

        return {
            label: `${index + 1}`,
            className: isActive
                ? 'navbar-color-menu-item navbar-color-menu-item-active'
                : 'navbar-color-menu-item',
            onClick: () => onColorClick(index, color)
        };
    });

    return menuManager.show({
        triggerElement,
        items,
        className: 'navbar-overflow-menu'
    });
}
