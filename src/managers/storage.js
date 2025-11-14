// ============================================
// STORAGE MANAGER
// ============================================

/**
 * @typedef {import('../main.js').ApplicationState} ApplicationState
 */

/**
 * Storage manager for persisting application state to localStorage
 */
export const StorageManager = {
    STORAGE_KEY: 'motif_pattern_state',

    /**
     * Save current state to localStorage
     * @param {ApplicationState} state - Application state to persist
     */
    save(state) {
        try {
            const dataToSave = {
                grid: state.grid,
                patternColors: state.patternColors,
                activePatternIndex: state.activePatternIndex,
                backgroundColor: state.backgroundColor,
                gridWidth: state.gridWidth,
                gridHeight: state.gridHeight,
                aspectRatio: state.aspectRatio,
                previewRepeatX: state.previewRepeatX,
                previewRepeatY: state.previewRepeatY,
                hasInteracted: state.hasInteracted,
                activePaletteId: state.activePaletteId,
                customPalette: state.customPalette
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToSave));
        } catch (e) {
            // Gracefully handle localStorage errors (quota exceeded, private browsing, etc.)
            console.warn('Failed to save to localStorage:', e);
        }
    },

    /**
     * Load state from localStorage
     * @returns {Partial<ApplicationState>|null} Saved state or null if none exists
     */
    load() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.warn('Failed to load from localStorage:', e);
        }
        return null;
    },

    /**
     * Clear saved state from localStorage
     */
    clear() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
        } catch (e) {
            console.warn('Failed to clear localStorage:', e);
        }
    }
};
