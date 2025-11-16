// ============================================
// UI INTERACTION HANDLERS
// ============================================

import { UI_CONSTANTS } from '../config.js';

/**
 * Reusable long-press handler for touch and mouse events
 * Provides consistent long-press behavior across the application
 */
export class LongPressHandler {
    constructor(element, options = {}) {
        this.element = element;
        this.onLongPress = options.onLongPress || (() => {});
        this.onClick = options.onClick || (() => {});
        this.duration = options.duration || UI_CONSTANTS.LONG_PRESS_DURATION;
        this.hapticFeedback = options.hapticFeedback !== false; // Default true

        this.pressTimer = null;
        this.isLongPress = false;

        this.boundHandlers = {
            touchStart: this.handleTouchStart.bind(this),
            touchEnd: this.handleTouchEnd.bind(this),
            touchMove: this.handleTouchMove.bind(this),
            mouseDown: this.handleMouseDown.bind(this),
            mouseUp: this.handleMouseUp.bind(this),
            mouseLeave: this.handleMouseLeave.bind(this)
        };

        this.attach();
    }

    attach() {
        this.element.addEventListener('touchstart', this.boundHandlers.touchStart, { passive: true });
        this.element.addEventListener('touchend', this.boundHandlers.touchEnd);
        this.element.addEventListener('touchmove', this.boundHandlers.touchMove, { passive: true });
        this.element.addEventListener('mousedown', this.boundHandlers.mouseDown);
        this.element.addEventListener('mouseup', this.boundHandlers.mouseUp);
        this.element.addEventListener('mouseleave', this.boundHandlers.mouseLeave);
    }

    detach() {
        this.element.removeEventListener('touchstart', this.boundHandlers.touchStart);
        this.element.removeEventListener('touchend', this.boundHandlers.touchEnd);
        this.element.removeEventListener('touchmove', this.boundHandlers.touchMove);
        this.element.removeEventListener('mousedown', this.boundHandlers.mouseDown);
        this.element.removeEventListener('mouseup', this.boundHandlers.mouseUp);
        this.element.removeEventListener('mouseleave', this.boundHandlers.mouseLeave);
        this.clearTimer();
    }

    handleTouchStart(e) {
        this.isLongPress = false;
        this.pressTimer = setTimeout(() => {
            this.isLongPress = true;
            if (this.hapticFeedback && navigator.vibrate) {
                navigator.vibrate(UI_CONSTANTS.HAPTIC_FEEDBACK_DURATION);
            }
            this.onLongPress(e);
        }, this.duration);
    }

    handleTouchEnd(e) {
        this.clearTimer();
        if (!this.isLongPress) {
            this.onClick(e);
        }
        this.isLongPress = false;
    }

    handleTouchMove() {
        this.clearTimer();
    }

    handleMouseDown(e) {
        this.isLongPress = false;
        this.pressTimer = setTimeout(() => {
            this.isLongPress = true;
            this.onLongPress(e);
        }, this.duration);
    }

    handleMouseUp(e) {
        this.clearTimer();
        if (!this.isLongPress) {
            this.onClick(e);
        }
        this.isLongPress = false;
    }

    handleMouseLeave() {
        this.clearTimer();
    }

    clearTimer() {
        if (this.pressTimer) {
            clearTimeout(this.pressTimer);
            this.pressTimer = null;
        }
    }

    destroy() {
        this.detach();
        this.element = null;
        this.onLongPress = null;
        this.onClick = null;
    }
}

/**
 * Reusable touch drag handler for drag-and-drop functionality
 * Provides consistent drag behavior with visual feedback
 */
export class TouchDragHandler {
    constructor(element, options = {}) {
        this.element = element;
        this.onDragStart = options.onDragStart || (() => {});
        this.onDragMove = options.onDragMove || (() => {});
        this.onDragEnd = options.onDragEnd || (() => {});
        this.onDrop = options.onDrop || (() => {});
        this.dragThreshold = options.dragThreshold || UI_CONSTANTS.DRAG_THRESHOLD;
        this.hapticFeedback = options.hapticFeedback !== false; // Default true

        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.currentX = 0;
        this.currentY = 0;
        this.draggedElement = null;
        this.placeholder = null;

        this.boundHandlers = {
            touchStart: this.handleTouchStart.bind(this),
            touchMove: this.handleTouchMove.bind(this),
            touchEnd: this.handleTouchEnd.bind(this)
        };

        this.attach();
    }

    attach() {
        this.element.addEventListener('touchstart', this.boundHandlers.touchStart, { passive: false });
        this.element.addEventListener('touchmove', this.boundHandlers.touchMove, { passive: false });
        this.element.addEventListener('touchend', this.boundHandlers.touchEnd);
    }

    detach() {
        this.element.removeEventListener('touchstart', this.boundHandlers.touchStart);
        this.element.removeEventListener('touchmove', this.boundHandlers.touchMove);
        this.element.removeEventListener('touchend', this.boundHandlers.touchEnd);
    }

    handleTouchStart(e) {
        const touch = e.touches[0];
        this.dragStartX = touch.clientX;
        this.dragStartY = touch.clientY;
        this.currentX = touch.clientX;
        this.currentY = touch.clientY;
    }

    handleTouchMove(e) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - this.dragStartX;
        const deltaY = touch.clientY - this.dragStartY;

        // Check if movement exceeds threshold
        if (!this.isDragging && (Math.abs(deltaX) > this.dragThreshold || Math.abs(deltaY) > this.dragThreshold)) {
            this.isDragging = true;
            if (this.hapticFeedback && navigator.vibrate) {
                navigator.vibrate(UI_CONSTANTS.HAPTIC_FEEDBACK_DURATION);
            }
            this.onDragStart(e, { x: this.dragStartX, y: this.dragStartY });
        }

        if (this.isDragging) {
            e.preventDefault();
            this.currentX = touch.clientX;
            this.currentY = touch.clientY;
            this.onDragMove(e, {
                x: this.currentX,
                y: this.currentY,
                deltaX,
                deltaY
            });
        }
    }

    handleTouchEnd(e) {
        if (this.isDragging) {
            this.onDragEnd(e, { x: this.currentX, y: this.currentY });

            // Find drop target
            const dropTarget = document.elementFromPoint(this.currentX, this.currentY);
            if (dropTarget) {
                this.onDrop(e, dropTarget, { x: this.currentX, y: this.currentY });
            }
        }

        this.isDragging = false;
        this.draggedElement = null;
        this.placeholder = null;
    }

    destroy() {
        this.detach();
        this.element = null;
        this.onDragStart = null;
        this.onDragMove = null;
        this.onDragEnd = null;
        this.onDrop = null;
    }
}

/**
 * Creates a visual drag ghost element for drag operations
 * @param {HTMLElement} original - Original element to copy
 * @param {number} x - X position
 * @param {number} y - Y position
 * @returns {HTMLElement} The ghost element
 */
export function createDragGhost(original, x, y) {
    const ghost = original.cloneNode(true);
    ghost.style.position = 'fixed';
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
    ghost.style.pointerEvents = 'none';
    ghost.style.opacity = '0.8';
    ghost.style.zIndex = '9999';
    ghost.style.transform = 'scale(1.1)';
    document.body.appendChild(ghost);
    return ghost;
}

/**
 * Updates the position of a drag ghost element
 * @param {HTMLElement} ghost - The ghost element
 * @param {number} x - X position
 * @param {number} y - Y position
 */
export function updateDragGhost(ghost, x, y) {
    if (ghost) {
        ghost.style.left = `${x - ghost.offsetWidth / 2}px`;
        ghost.style.top = `${y - ghost.offsetHeight / 2}px`;
    }
}

/**
 * Removes a drag ghost element
 * @param {HTMLElement} ghost - The ghost element to remove
 */
export function removeDragGhost(ghost) {
    if (ghost && ghost.parentNode) {
        ghost.parentNode.removeChild(ghost);
    }
}

/**
 * Helper function for dimension input controls with inline display
 * Eliminates duplicate code for grid width/height and preview repeat controls
 *
 * @param {Object} options - Configuration options
 * @param {number} options.value - The new value to apply
 * @param {number} options.min - Minimum allowed value
 * @param {number} options.max - Maximum allowed value
 * @param {number} options.defaultValue - Default value if clamping fails
 * @param {string} options.displayElementId - ID of the inline display element
 * @param {Function} options.applyFunction - Function to apply the value (returns success boolean or void)
 * @param {Function} [options.getCurrentValue] - Function to get current value (for error display)
 * @param {Function} [options.updateChevronStates] - Optional function to update chevron states
 * @param {number} [options.errorFlashDuration=300] - Duration to flash error outline (ms)
 * @returns {boolean|void} Success status if applicable
 */
export function applyDimensionInput(options) {
    const {
        value,
        min,
        max,
        defaultValue,
        displayElementId,
        applyFunction,
        getCurrentValue,
        updateChevronStates,
        errorFlashDuration = 300
    } = options;

    // Import Utils for clampInt - this needs to be passed or imported
    const clampedValue = Math.max(min, Math.min(max, Math.floor(value) || defaultValue));
    const inlineDisplay = document.getElementById(displayElementId);

    // Apply the function (may return success boolean or void)
    const result = applyFunction(clampedValue);

    // Handle error feedback for functions that return success boolean
    if (result === false && inlineDisplay && getCurrentValue) {
        // Restore previous value in display
        inlineDisplay.textContent = getCurrentValue();

        // Flash red border on error
        inlineDisplay.style.transition = 'none';
        inlineDisplay.style.outline = '2px solid var(--color-danger)';
        setTimeout(() => {
            inlineDisplay.style.transition = 'outline var(--transition-base)';
            inlineDisplay.style.outline = '';
        }, errorFlashDuration);
    } else if (result !== false && inlineDisplay) {
        // Update display with new value on success
        inlineDisplay.textContent = clampedValue;
    }

    // Update chevron states if function provided
    if (updateChevronStates && typeof updateChevronStates === 'function') {
        updateChevronStates();
    }

    return result;
}
