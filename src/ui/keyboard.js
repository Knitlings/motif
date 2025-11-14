// ============================================
// KEYBOARD SHORTCUTS MODULE
// ============================================

import { Utils } from '../utils.js';

/**
 * Setup keyboard shortcuts for the application
 * @param {Object} deps - Dependencies object
 * @param {Function} deps.getPatternColors - Function to get pattern colors
 * @param {Function} deps.getActivePatternIndex - Function to get active pattern index
 * @param {Function} deps.setActivePatternIndex - Function to set active pattern index
 * @param {Function} deps.updateActiveColorUI - Function to update active color UI
 * @param {Function} deps.createPatternColorButtons - Function to create pattern color buttons
 */
export function setupKeyboardShortcuts(deps) {
    const {
        getPatternColors,
        getActivePatternIndex,
        setActivePatternIndex,
        updateActiveColorUI,
        createPatternColorButtons
    } = deps;

    document.addEventListener('keydown', (e) => {
        // Ignore keyboard shortcuts when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }

        const ctrlKey = Utils.isMac() ? e.metaKey : e.ctrlKey;

        // Undo: Ctrl/Cmd + Z
        if (ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
            const undoBtn = document.getElementById('undoBtn');
            if (!undoBtn.disabled) {
                undoBtn.click();
                e.preventDefault();
            }
            return;
        }

        // Redo: Ctrl/Cmd + Y
        if (ctrlKey && e.key.toLowerCase() === 'y') {
            const redoBtn = document.getElementById('redoBtn');
            if (!redoBtn.disabled) {
                redoBtn.click();
                e.preventDefault();
            }
            return;
        }

        // Clear: Delete or Backspace
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const clearBtn = document.getElementById('clearBtn');
            if (!clearBtn.disabled) {
                clearBtn.click();
                e.preventDefault();
            }
            return;
        }

        // Number keys for pattern selection (1-0 for patterns 1-10, Shift+1-0 for patterns 11-20)
        const digitCodes = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];
        const codeIndex = digitCodes.indexOf(e.code);

        if (codeIndex !== -1) {
            let patternIndex;

            if (e.shiftKey) {
                patternIndex = codeIndex + 10;
            } else {
                patternIndex = codeIndex;
            }

            const patternColors = getPatternColors();
            if (patternIndex !== undefined && patternIndex < patternColors.length) {
                setActivePatternIndex(patternIndex);
                updateActiveColorUI();
                createPatternColorButtons();
                e.preventDefault();
            }
        }
    });
}
