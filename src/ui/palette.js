// ============================================
// PALETTE MANAGEMENT MODULE
// ============================================

import { CONFIG } from '../config.js';
import deleteSvg from '../assets/delete.svg';
import editSvg from '../assets/edit.svg';

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
     * Render the palette UI with all colors
     */
    function renderPalette() {
        const paletteGrid = document.getElementById('navbarPaletteGrid');
        if (!paletteGrid) return;
        paletteGrid.innerHTML = '';

        const colors = getCurrentPaletteColors();
        const isEditable = isCurrentPaletteEditable();

        colors.forEach((color, index) => {
            const btn = document.createElement('div');
            btn.className = 'palette-color';
            btn.style.backgroundColor = color;

            // Add edit button for custom palettes
            if (isEditable) {
                const editBtn = document.createElement('span');
                editBtn.className = 'palette-edit-btn';
                editBtn.innerHTML = `<img src="${editSvg}" alt="Edit" class="edit-icon">`;
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    editPaletteColor(index);
                });
                btn.appendChild(editBtn);
            }

            // Add delete button for custom palettes (if more than MIN colors)
            if (isEditable && colors.length > CONFIG.MIN_PALETTE_COLORS) {
                const deleteBtn = document.createElement('span');
                deleteBtn.className = 'palette-delete-btn';
                deleteBtn.innerHTML = `<img src="${deleteSvg}" alt="Delete" class="delete-icon">`;
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    removePaletteColor(index);
                });
                btn.appendChild(deleteBtn);
            }

            // Long-press detection variables
            let pressTimer = null;
            let isLongPress = false;

            // Function to set background color
            const setBackgroundColorValue = () => {
                setBackgroundColor(color);
                const bgColorInput = document.getElementById('backgroundColor');
                const bgTextInput = document.getElementById('backgroundText');
                if (bgColorInput) bgColorInput.value = color;
                if (bgTextInput) bgTextInput.value = color;
                updateCanvas();
                updateColorIndicators();
                saveToLocalStorage();
            };

            // Function to set active color
            const setActiveColor = () => {
                const patternColors = getPatternColors();
                const activePatternIndex = getActivePatternIndex();
                patternColors[activePatternIndex] = color;
                setPatternColors(patternColors);
                updateActiveColorUI();
                updateCanvas();
                updateColorIndicators();
                saveToLocalStorage();
            };

            // Handle click (desktop shift+click or regular click)
            btn.addEventListener('click', (e) => {
                // Ignore if this was a long press (already handled)
                if (isLongPress) {
                    isLongPress = false;
                    return;
                }

                // Check if click was on edit/delete button
                const target = e.target;
                const isChildButton = target.closest('.palette-edit-btn') || target.closest('.palette-delete-btn');

                // Only set color if click was NOT on a child button
                if (!isChildButton) {
                    if (e.shiftKey) {
                        setBackgroundColorValue();
                    } else {
                        setActiveColor();
                    }
                }
            });

            // Handle touch start (for long press detection)
            btn.addEventListener('touchstart', (e) => {
                isLongPress = false;
                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    setBackgroundColorValue();
                    // Provide haptic feedback if available
                    if (navigator.vibrate) {
                        navigator.vibrate(50);
                    }
                }, 500); // 500ms for long press
            }, { passive: true });

            // Handle touch end (cancel long press timer)
            btn.addEventListener('touchend', (e) => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
                // If it was a long press, prevent the click event
                if (isLongPress) {
                    e.preventDefault();
                    // Handle the regular tap for active color
                    setTimeout(() => {
                        isLongPress = false;
                    }, 100);
                } else {
                    // Short tap - check if tap was on edit/delete button
                    const target = e.target;
                    const isChildButton = target.closest('.palette-edit-btn') || target.closest('.palette-delete-btn');

                    // Only set active color if tap was NOT on a child button
                    if (!isChildButton) {
                        setActiveColor();
                    }
                }
            });

            // Handle touch cancel (user moved finger away)
            btn.addEventListener('touchcancel', () => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
                isLongPress = false;
            });

            paletteGrid.appendChild(btn);
        });

        // Add "add color" button for custom palettes (if not at max)
        if (isEditable && colors.length < CONFIG.MAX_PALETTE_COLORS) {
            const addBtn = document.createElement('div');
            addBtn.className = 'palette-color palette-add-btn';
            addBtn.textContent = '+';
            addBtn.onclick = () => addPaletteColor();
            paletteGrid.appendChild(addBtn);
        }
    }

    /**
     * Switch to a different palette
     * @param {string} paletteId - ID of the palette to switch to
     */
    function switchPalette(paletteId) {
        setActivePaletteId(paletteId);
        updatePaletteUI();
        renderPalette();
        saveToLocalStorage();
    }

    /**
     * Edit a color in the custom palette
     * @param {number} index - Index of the color to edit
     */
    function editPaletteColor(index) {
        if (!isCurrentPaletteEditable()) return;

        const customPalette = getCustomPalette();
        // Create a temporary color input
        const input = document.createElement('input');
        input.type = 'color';
        input.value = customPalette[index];
        input.style.position = 'absolute';
        input.style.opacity = '0';
        input.style.pointerEvents = 'none';
        document.body.appendChild(input);

        input.addEventListener('change', () => {
            customPalette[index] = input.value;
            setCustomPalette(customPalette);
            renderPalette();
            saveToLocalStorage();
            document.body.removeChild(input);
        });

        input.click();
    }

    /**
     * Add a new color to the custom palette
     */
    function addPaletteColor() {
        if (!isCurrentPaletteEditable()) return;

        const customPalette = getCustomPalette();
        if (customPalette.length >= CONFIG.MAX_PALETTE_COLORS) return;

        // Add a new color (default to black)
        customPalette.push('#000000');
        setCustomPalette(customPalette);
        renderPalette();
        saveToLocalStorage();
    }

    /**
     * Remove a color from the custom palette
     * @param {number} index - Index of the color to remove
     */
    function removePaletteColor(index) {
        if (!isCurrentPaletteEditable()) return;

        const customPalette = getCustomPalette();
        if (customPalette.length <= CONFIG.MIN_PALETTE_COLORS) return;

        customPalette.splice(index, 1);
        setCustomPalette(customPalette);
        renderPalette();
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
        renderPalette,
        switchPalette,
        editPaletteColor,
        addPaletteColor,
        removePaletteColor,
        updatePaletteUI
    };
}
