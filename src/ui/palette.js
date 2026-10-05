// ============================================
// PALETTE MANAGEMENT MODULE
// ============================================

import { CONFIG } from '../config.js';

/**
 * Initialize and manage palette UI and interactions
 * @param {Object} deps - Dependencies object
 * @param {Function} deps.getCurrentPaletteColors - Function to get current palette colors
 * @param {Function} deps.isCurrentPaletteEditable - Function to check if current palette is editable
 * @param {Function} deps.getActivePaletteId - Function to get active palette ID
 * @param {Function} deps.setActivePaletteId - Function to set active palette ID
 * @param {Function} deps.getCustomPalette - Function to get custom palette
 * @param {Function} deps.setCustomPalette - Function to set custom palette
 * @param {Function} deps.getPatternColors - Function to get pattern colors
 * @param {Function} deps.setPatternColors - Function to set pattern colors
 * @param {Function} deps.getActivePatternIndex - Function to get active pattern index
 * @param {Function} deps.getBackgroundColor - Function to get background color
 * @param {Function} deps.setBackgroundColor - Function to set background color
 * @param {Function} deps.saveToLocalStorage - Function to save to localStorage
 * @param {Function} deps.updateCanvas - Function to update canvas
 * @param {Function} deps.updateColorIndicators - Function to update color indicators
 * @param {Function} deps.updateActiveColorUI - Function to update active color UI
 */
export function createPaletteManager(deps) {
    const {
        getCurrentPaletteColors,
        isCurrentPaletteEditable,
        getActivePaletteId,
        setActivePaletteId,
        getCustomPalette,
        setCustomPalette,
        getPatternColors,
        setPatternColors,
        getActivePatternIndex,
        getBackgroundColor,
        setBackgroundColor,
        saveToLocalStorage,
        updateCanvas,
        updateColorIndicators,
        updateActiveColorUI
    } = deps;

    /**
     * Switch to a different palette
     * @param {string} paletteId - ID of the palette to switch to
     * Note: Rendering is handled by the caller (the key)
     */
    function switchPalette(paletteId) {
        setActivePaletteId(paletteId);
        updatePaletteUI();
        saveToLocalStorage();
    }

    /**
     * Update the palette UI elements
     */
    function updatePaletteUI() {
        const paletteName = document.getElementById('paletteName');
        const activePaletteId = getActivePaletteId();

        // Update displayed palette name
        const paletteDisplayName = activePaletteId === 'custom' ? 'Custom' :
            CONFIG.BUILT_IN_PALETTES[activePaletteId]?.name || 'Motif';
        if (paletteName) {
            paletteName.textContent = paletteDisplayName;
        }

        // If custom was selected but doesn't exist, create it with single black color
        if (activePaletteId === 'custom' && !getCustomPalette()) {
            setCustomPalette(['#000000']);
        }
    }

    return {
        switchPalette,
        updatePaletteUI
    };
}
