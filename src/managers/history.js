import { Utils } from '../utils.js';

// ============================================
// HISTORY MANAGER
// ============================================
export const HistoryManager = {
    history: [],
    index: -1,

    // Initialize with a state
    init(state) {
        this.history = [Utils.deepClone(state)];
        this.index = 0;
    },

    // Save a new state
    save(state) {
        // Remove any future history if we're not at the end
        this.history = this.history.slice(0, this.index + 1);
        this.history.push(Utils.deepClone(state));
        this.index = this.history.length - 1;
    },

    // Undo - return previous state or null if can't undo
    undo() {
        if (this.canUndo()) {
            this.index--;
            return Utils.deepClone(this.history[this.index]);
        }
        return null;
    },

    // Redo - return next state or null if can't redo
    redo() {
        if (this.canRedo()) {
            this.index++;
            return Utils.deepClone(this.history[this.index]);
        }
        return null;
    },

    // Check if we can undo
    canUndo() {
        return this.index > 0;
    },

    // Check if we can redo
    canRedo() {
        return this.index < this.history.length - 1;
    },

    // Get current state
    current() {
        return Utils.deepClone(this.history[this.index]);
    }
};
