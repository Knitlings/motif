import { Utils } from '../utils.js';
import { CONFIG } from '../config.js';

// ============================================
// HISTORY MANAGER
// ============================================

/**
 * @typedef {import('../main.js').ApplicationState} ApplicationState
 */

/**
 * History manager for undo/redo functionality
 * Maintains a history of application states using deep cloning
 */
export const HistoryManager = {
    history: [],
    index: -1,

    /**
     * Initialize history with an initial state
     * @param {ApplicationState} state - Initial application state
     */
    init(state) {
        this.history = [Utils.deepClone(state)];
        this.index = 0;
    },

    /**
     * Save a new state to history
     * Truncates any future history if not at the end
     * Enforces MAX_HISTORY_STATES limit by removing oldest states
     * @param {ApplicationState} state - Application state to save
     */
    save(state) {
        // Remove any future history if we're not at the end
        this.history = this.history.slice(0, this.index + 1);

        // Add new state
        this.history.push(Utils.deepClone(state));

        // Enforce history size limit
        if (this.history.length > CONFIG.MAX_HISTORY_STATES) {
            const excess = this.history.length - CONFIG.MAX_HISTORY_STATES;
            this.history = this.history.slice(excess);
            this.index = this.history.length - 1;
        } else {
            this.index = this.history.length - 1;
        }
    },

    /**
     * Undo to previous state
     * @returns {ApplicationState|null} Previous state or null if can't undo
     */
    undo() {
        if (this.canUndo()) {
            this.index--;
            return Utils.deepClone(this.history[this.index]);
        }
        return null;
    },

    /**
     * Redo to next state
     * @returns {ApplicationState|null} Next state or null if can't redo
     */
    redo() {
        if (this.canRedo()) {
            this.index++;
            return Utils.deepClone(this.history[this.index]);
        }
        return null;
    },

    /**
     * Check if undo is available
     * @returns {boolean} True if can undo
     */
    canUndo() {
        return this.index > 0;
    },

    /**
     * Check if redo is available
     * @returns {boolean} True if can redo
     */
    canRedo() {
        return this.index < this.history.length - 1;
    },

    /**
     * Get current state from history
     * @returns {ApplicationState} Current application state
     */
    current() {
        return Utils.deepClone(this.history[this.index]);
    }
};
