// ============================================
// FOCUS
// ============================================
//
// Moving focus along a list with the keyboard: the key's rows of colours, the palette
// list and the Menu.

const STEPS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * Where an arrow key, Home or End moves to in a list that wraps
 * @param {KeyboardEvent} e
 * @param {number} at - The focused item's index (-1 if none)
 * @param {number} length
 * @param {string[]} [arrows] - The arrow keys the list answers to
 * @returns {number|null} The index to focus, or null if the key isn't the list's
 */
export function listStep(e, at, length, arrows = ['ArrowUp', 'ArrowDown']) {
    // Modified keys belong to the browser and the screen reader (Alt+Left goes back)
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !length) return null;
    if (arrows.includes(e.key)) return (at + STEPS[e.key] + length) % length;
    if (e.key === 'Home') return 0;
    if (e.key === 'End') return length - 1;
    return null;
}

/** Whether focus can land on an element: on the page, shown and enabled */
export function canTakeFocus(element) {
    return Boolean(element?.isConnected && !element.disabled && !element.hidden
        && element.getClientRects().length);
}
