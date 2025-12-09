// ============================================
// MAIN APPLICATION
// ============================================

import { CONFIG, UI_CONSTANTS } from './config.js';
import { Utils } from './utils.js';
import { StorageManager } from './managers/storage.js';
import { HistoryManager } from './managers/history.js';
import { CanvasManager } from './managers/canvas.js';
import { createEmptyGrid, resizeGrid, resizeGridFromEdge } from './core/grid.js';
import { exportSvg, exportPng, exportPreviewSvg, exportPreviewPng, exportPatternWithContextSvg, exportPatternWithContextPng, exportJson, importJson, downloadFile } from './core/export.js';
import {
    validateGridDimension,
    validateAspectRatio,
    validatePreviewRepeat,
    validateColor,
    validateImportData,
    validateFileSize,
    validateFileType
} from './utils/validation.js';
import deleteSvg from './assets/delete.svg';
import editSvg from './assets/edit.svg';
import {
    showError,
    handleStorageError,
    handleFileError,
    handleCanvasError,
    handleJSONError,
    setupGlobalErrorHandler,
    ErrorType
} from './utils/errorHandler.js';
import { checkBrowserCompatibility } from './utils/featureDetection.js';
import { createPaletteManager } from './ui/palette.js';
import { setupDropdowns } from './ui/panels.js';
import { setupKeyboardShortcuts } from './ui/keyboard.js';
import { setupCanvasInteractions } from './ui/interactions.js';
import { applyDimensionInput } from './ui/handlers.js';

// ============================================
// TYPE DEFINITIONS
// See CONTRIBUTING.md "Application State Structure" for conceptual overview
// ============================================

/**
 * @typedef {Object} ApplicationState
 * @property {number[][]} grid - 2D array of cell values (0=background, 1-20=color index+1)
 * @property {number} gridWidth - Number of grid columns (2-100)
 * @property {number} gridHeight - Number of grid rows (2-100)
 * @property {number} aspectRatio - Cell aspect ratio as height/width
 * @property {string[]} patternColors - Array of hex color strings (max 20)
 * @property {number} activePatternIndex - Currently selected color index (0-19)
 * @property {string} backgroundColor - Hex color for empty cells (cellValue=0)
 * @property {number} previewRepeatX - Horizontal tile repeats in preview (1-10)
 * @property {number} previewRepeatY - Vertical tile repeats in preview (1-10)
 * @property {boolean} hasInteracted - Whether user has made any changes
 * @property {string} activePaletteId - ID of active palette ('motif', 'warm', 'cool', 'autumn', 'custom')
 * @property {string[]|null} customPalette - Custom palette colors array or null
 */

// ============================================
// STATE
// ============================================
let gridWidth = CONFIG.DEFAULT_GRID_WIDTH;
let gridHeight = CONFIG.DEFAULT_GRID_HEIGHT;
let aspectRatio = CONFIG.DEFAULT_ASPECT_RATIO;
let patternColors = [CONFIG.DEFAULT_PATTERN_COLOR];
let activePatternIndex = 0;
let backgroundColor = CONFIG.DEFAULT_BACKGROUND_COLOR;
let isBackgroundActive = false; // Track if background color is active for drawing (mobile long-press)
let isShiftKeyHeld = false; // Track if Shift key is held (desktop)
let previewRepeatX = CONFIG.DEFAULT_PREVIEW_REPEAT;
let previewRepeatY = CONFIG.DEFAULT_PREVIEW_REPEAT;
let grid = [];
let isDrawing = false;
let hasInteracted = false;
let initialCellState = null; // Tracks the cell state when stroke began
let canvasUpdateScheduled = false; // Flag for requestAnimationFrame
let lastPaintedCell = { row: -1, col: -1 }; // Track last painted cell to avoid redundant updates

// Palette state
let activePaletteId = CONFIG.DEFAULT_ACTIVE_PALETTE; // 'motif', 'warm', 'cool', or 'custom'
let customPalette = null; // Array of color strings when custom palette exists

// Browser capabilities (set during initialization)
let browserCapabilities = null;

// ============================================
// STATE HELPERS
// ============================================

/**
 * Get current application state
 * @returns {ApplicationState} Current state object
 */
function getState() {
    return {
        grid,
        gridWidth,
        gridHeight,
        aspectRatio,
        patternColors,
        activePatternIndex,
        backgroundColor,
        previewRepeatX,
        previewRepeatY,
        hasInteracted,
        activePaletteId,
        customPalette
    };
}

/**
 * Get the current palette colors
 * @returns {string[]} Array of hex color strings
 */
function getCurrentPaletteColors() {
    if (activePaletteId === 'custom' && customPalette) {
        return customPalette;
    }
    return CONFIG.BUILT_IN_PALETTES[activePaletteId]?.colors || CONFIG.BUILT_IN_PALETTES.motif.colors;
}

/**
 * Check if current palette is editable
 * @returns {boolean} True if current palette is custom (editable)
 */
function isCurrentPaletteEditable() {
    return activePaletteId === 'custom';
}

/**
 * Announce status to screen readers
 * @param {string} message - Message to announce
 */
function announceToScreenReader(message) {
    const statusEl = document.getElementById('statusAnnouncements');
    if (statusEl) {
        statusEl.textContent = message;
        // Clear after announcement to allow repeated announcements of the same message
        setTimeout(() => {
            statusEl.textContent = '';
        }, 1000);
    }
}

// Show loading overlay
function showLoading(message = 'Processing...') {
    const overlay = document.getElementById('loadingOverlay');
    const messageEl = document.getElementById('loadingMessage');
    if (overlay && messageEl) {
        messageEl.textContent = message;
        overlay.style.display = 'flex';
    }
}

// Hide loading overlay
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function saveToLocalStorage() {
    // Skip saving if localStorage is not available
    if (!browserCapabilities.localStorage) {
        return;
    }

    try {
        StorageManager.save(getState());
    } catch (error) {
        handleStorageError(error);
    }
}

function saveToHistory() {
    HistoryManager.save({
        grid: grid,
        gridWidth: gridWidth,
        gridHeight: gridHeight,
        colors: patternColors,
        backgroundColor: backgroundColor
    });
    updateButtons();
    saveToLocalStorage();
}

function updateButtons() {
    document.getElementById('undoBtn').disabled = !HistoryManager.canUndo();
    document.getElementById('redoBtn').disabled = !HistoryManager.canRedo();
}

function updateCanvas() {
    try {
        CanvasManager.update(gridWidth, gridHeight, aspectRatio, previewRepeatX, previewRepeatY,
                            grid, patternColors, backgroundColor);
        updateButtons();
    } catch (error) {
        handleCanvasError(error, 'update canvas');
    }
}

// Optimized canvas update using requestAnimationFrame
// This batches multiple updates into a single frame for better performance
function scheduleCanvasUpdate() {
    if (!canvasUpdateScheduled) {
        canvasUpdateScheduled = true;
        requestAnimationFrame(() => {
            updateCanvas();
            canvasUpdateScheduled = false;
        });
    }
}

// ============================================
// UI FUNCTIONS
// ============================================

function updateNavbarSvgs() {
    const activeSwatch = document.getElementById('navbarActiveColorSwatch');
    const bgSwatch = document.getElementById('navbarBgColorSwatch');

    if (activeSwatch && bgSwatch) {
        const activeColor = patternColors[activePatternIndex];
        activeSwatch.style.backgroundColor = activeColor;
        bgSwatch.style.backgroundColor = backgroundColor;
    }
}

function updateNavbarColorPreview() {
    const previewContainer = document.getElementById('navbarColorPreview');

    if (!previewContainer) return;

    if (patternColors.length >= 2) {
        previewContainer.innerHTML = '';

        patternColors.forEach((color, index) => {
            const circle = document.createElement('div');
            circle.className = 'navbar-color-circle';
            circle.style.backgroundColor = color;
            circle.title = `Pattern ${index + 1}: ${color}`;
            previewContainer.appendChild(circle);
        });

        previewContainer.classList.add('visible');
    } else {
        previewContainer.classList.remove('visible');
        previewContainer.innerHTML = '';
    }
}

function updateColorIndicators() {
    updateNavbarSvgs();
    updateNavbarColorPreview();
}


function showConfirmDialog(title, message, confirmText, onConfirm) {
    const dialog = document.getElementById('mergeDialog');
    const titleEl = document.getElementById('mergeDialogTitle');
    const text = document.getElementById('mergeDialogText');
    const confirmBtn = document.getElementById('mergeConfirmBtn');
    const cancelBtn = document.getElementById('mergeCancelBtn');

    titleEl.textContent = title;
    text.textContent = message;
    confirmBtn.textContent = confirmText;
    dialog.style.display = 'flex';

    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newConfirmBtn.addEventListener('click', () => {
        dialog.style.display = 'none';
        onConfirm(true);
    });

    newCancelBtn.addEventListener('click', () => {
        dialog.style.display = 'none';
        onConfirm(false);
    });
}

function showDeleteColorDialog(colorIndex) {
    // Check if this color is actually used in the grid
    let colorIsUsed = false;
    for (let row = 0; row < gridHeight; row++) {
        for (let col = 0; col < gridWidth; col++) {
            if (grid[row][col] === colorIndex + 1) {
                colorIsUsed = true;
                break;
            }
        }
        if (colorIsUsed) break;
    }

    const message = colorIsUsed
        ? `All cells using this color will be cleared to background.`
        : `This color will be removed from your palette.`;

    showConfirmDialog('Remove color?', message, 'Remove', (confirmed) => {
        if (confirmed) {
            deletePatternColor(colorIndex);
        }
    });
}

function deletePatternColor(colorIndex) {
    if (colorIndex === 0) return;

    for (let row = 0; row < gridHeight; row++) {
        for (let col = 0; col < gridWidth; col++) {
            if (grid[row][col] === colorIndex + 1) {
                grid[row][col] = 0;
            } else if (grid[row][col] > colorIndex + 1) {
                grid[row][col]--;
            }
        }
    }

    patternColors.splice(colorIndex, 1);

    if (activePatternIndex === colorIndex) {
        activePatternIndex = 0;
    } else if (activePatternIndex > colorIndex) {
        activePatternIndex--;
    }

    saveToHistory();
    updateActiveColorUI();
    createNavbarColorButtons();
    updateCanvas();
}

function mergePatternColors(sourceIndex, targetIndex) {
    const draggedPattern = sourceIndex + 1;  // The color being dragged
    const targetPattern = targetIndex + 1;   // The drop target

    const message = `Pattern colour ${targetPattern} will become pattern colour ${draggedPattern}, which will then be removed from the palette.`;

    showConfirmDialog('Merge these colours?', message, 'Merge', (confirmed) => {
        if (!confirmed) {
            return;
        }

        // All cells using the dragged color become the target color
        for (let row = 0; row < gridHeight; row++) {
            for (let col = 0; col < gridWidth; col++) {
                if (grid[row][col] === draggedPattern) {
                    grid[row][col] = targetPattern;
                }
            }
        }

        // Update the target slot to use the dragged color
        patternColors[targetIndex] = patternColors[sourceIndex];

        // Remove the dragged color from the palette
        patternColors.splice(sourceIndex, 1);

        // Update grid cell references: any cell with index > sourceIndex needs to be decremented
        for (let row = 0; row < gridHeight; row++) {
            for (let col = 0; col < gridWidth; col++) {
                if (grid[row][col] > draggedPattern) {
                    grid[row][col]--;
                }
            }
        }

        // Update active pattern index if needed
        if (activePatternIndex === sourceIndex) {
            activePatternIndex = targetIndex;
        } else if (activePatternIndex > sourceIndex) {
            activePatternIndex--;
        }

        saveToHistory();
        updateActiveColorUI();
            createNavbarColorButtons();
        updateCanvas();
    });
}

function updateActiveColorUI() {
    updateColorIndicators();
    updateNavbarButtonStates();
}

/**
 * Update navbar button visual states (active pattern color and background color)
 */
function updateNavbarButtonStates() {
    // Background is "active" if: mobile long-press active OR shift key held on desktop
    const backgroundIsCurrentlyActive = isBackgroundActive || isShiftKeyHeld;

    // Update pattern color buttons
    document.querySelectorAll('.navbar-color-btn.round').forEach((btn) => {
        const index = parseInt(btn.getAttribute('data-index'));
        if (!isNaN(index)) {
            // Remove active class if background is active, or if this isn't the active pattern
            if (backgroundIsCurrentlyActive || index !== activePatternIndex) {
                btn.classList.remove('active');
            } else {
                btn.classList.add('active');
            }
        }
    });

    // Update background button
    const bgBtn = document.querySelector('.navbar-color-btn.square');
    if (bgBtn) {
        if (backgroundIsCurrentlyActive) {
            bgBtn.classList.add('active');
        } else {
            bgBtn.classList.remove('active');
        }
    }
}

// ============================================
// GRID & PATTERN FUNCTIONS
// ============================================

function initGrid() {
    if (!grid || grid.length === 0) {
        grid = createEmptyGrid(gridWidth, gridHeight);
    }

    // If we have a saved grid with painted cells, initialize history
    // with both empty state and current state so undo works after reload
    if (hasInteracted && grid.some(row => row.some(cell => cell !== null))) {
        const emptyGrid = createEmptyGrid(gridWidth, gridHeight);
        HistoryManager.init({
            grid: emptyGrid,
            gridWidth: gridWidth,
            gridHeight: gridHeight,
            colors: patternColors,
            backgroundColor: backgroundColor
        });
        // Add the current loaded state as second history entry
        HistoryManager.save({
            grid: grid,
            gridWidth: gridWidth,
            gridHeight: gridHeight,
            colors: patternColors,
            backgroundColor: backgroundColor
        });
    } else {
        HistoryManager.init({
            grid: grid,
            gridWidth: gridWidth,
            gridHeight: gridHeight,
            colors: patternColors,
            backgroundColor: backgroundColor
        });
    }
    updateCanvas();
    updatePreviewRepeatStatus();
}

/**
 * Calculate maximum allowed preview repeats based on pattern size
 * Keeps total cells under ~25,000 for smooth performance
 * @param {number} width - Pattern width
 * @param {number} height - Pattern height
 * @returns {number} Maximum allowed repeats in either dimension
 */
function getMaxPreviewRepeat(width, height) {
    const maxDimension = Math.max(width, height);

    if (maxDimension >= 80) return 1;
    if (maxDimension >= 53) return 2;
    if (maxDimension >= 40) return 3;
    if (maxDimension >= 32) return 4;
    if (maxDimension >= 27) return 5;
    if (maxDimension >= 20) return 6;
    if (maxDimension >= 16) return 8;
    return 10; // 15×15 and smaller
}

/**
 * Show toast notification over preview canvas
 * @param {string} message - Message to display
 */
function showPreviewToast(message) {
    const toast = document.getElementById('previewToast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/**
 * Update the preview repeat status indicator
 * Shows a message when near or at maximum allowed repeats
 */
function updatePreviewRepeatStatus() {
    const statusElement = document.getElementById('previewRepeatStatus');
    if (!statusElement) return;

    const maxRepeat = getMaxPreviewRepeat(gridWidth, gridHeight);
    const nearMaxX = previewRepeatX >= maxRepeat - 1;
    const nearMaxY = previewRepeatY >= maxRepeat - 1;

    if (nearMaxX || nearMaxY) {
        statusElement.textContent = `Max preview for pattern size is ${maxRepeat}×${maxRepeat}`;
    } else {
        statusElement.textContent = '';
    }
}

function applyGridResize(newWidth, newHeight) {
    const result = resizeGrid({
        grid,
        gridWidth,
        gridHeight,
        newWidth,
        newHeight
    });

    if (result === false) {
        return false;
    }

    grid = result.grid;
    gridWidth = result.width;
    gridHeight = result.height;

    // Check if preview repeats need to be reduced due to larger pattern
    const maxRepeat = getMaxPreviewRepeat(gridWidth, gridHeight);
    let repeatReduced = false;

    if (previewRepeatX > maxRepeat) {
        previewRepeatX = maxRepeat;
        const display = document.getElementById('previewRepeatXDisplay');
        if (display) display.textContent = previewRepeatX;
        repeatReduced = true;
    }

    if (previewRepeatY > maxRepeat) {
        previewRepeatY = maxRepeat;
        const display = document.getElementById('previewRepeatYDisplay');
        if (display) display.textContent = previewRepeatY;
        repeatReduced = true;
    }

    if (repeatReduced) {
        showPreviewToast(`Preview reduced to max for ${gridWidth}×${gridHeight} pattern (${maxRepeat}×${maxRepeat})`);
        saveToLocalStorage();
    }

    saveToHistory();
    updateCanvas();
    updatePreviewRepeatStatus();
    return true;
}

function applyGridResizeFromEdge(direction, delta) {
    const result = resizeGridFromEdge({
        grid,
        gridWidth,
        gridHeight,
        direction,
        delta
    });

    if (result === null) {
        return;
    }

    grid = result.grid;
    gridWidth = result.width;
    gridHeight = result.height;

    const inlineWidthDisplay = document.getElementById('gridWidthDisplay');
    const inlineHeightDisplay = document.getElementById('gridHeightDisplay');
    if (inlineWidthDisplay) inlineWidthDisplay.textContent = gridWidth;
    if (inlineHeightDisplay) inlineHeightDisplay.textContent = gridHeight;

    // Check if preview repeats need to be reduced due to larger pattern
    const maxRepeat = getMaxPreviewRepeat(gridWidth, gridHeight);
    let repeatReduced = false;

    if (previewRepeatX > maxRepeat) {
        previewRepeatX = maxRepeat;
        const display = document.getElementById('previewRepeatXDisplay');
        if (display) display.textContent = previewRepeatX;
        repeatReduced = true;
    }

    if (previewRepeatY > maxRepeat) {
        previewRepeatY = maxRepeat;
        const display = document.getElementById('previewRepeatYDisplay');
        if (display) display.textContent = previewRepeatY;
        repeatReduced = true;
    }

    if (repeatReduced) {
        showPreviewToast(`Preview reduced to max for ${gridWidth}×${gridHeight} pattern (${maxRepeat}×${maxRepeat})`);
        saveToLocalStorage();
    }

    saveToHistory();
    updateCanvas();
    updatePreviewRepeatStatus();
    if (typeof updateChevronStates === 'function') updateChevronStates();
}

function paintCell(row, col, isShiftKey, useInitialState = false) {
    if (row >= 0 && row < gridHeight && col >= 0 && col < gridWidth) {
        // Avoid repainting the same cell during drag (optimization)
        if (!useInitialState && row === lastPaintedCell.row && col === lastPaintedCell.col) {
            return false;
        }

        const cellValue = grid[row][col];
        const activeColorValue = activePatternIndex + 1;
        let cellChanged = false;

        // Paint with background if shift is held OR if background is active (mobile long-press)
        if (isShiftKey || isBackgroundActive) {
            if (useInitialState && initialCellState !== 0) {
                grid[row][col] = 0;
                cellChanged = true;
            } else if (!useInitialState && cellValue !== 0) {
                grid[row][col] = 0;
                cellChanged = true;
            }
        } else if (cellValue === 0) {
            grid[row][col] = activeColorValue;
            cellChanged = true;
        } else if (cellValue === activeColorValue) {
            if (useInitialState && initialCellState === activeColorValue) {
                grid[row][col] = 0;
                cellChanged = true;
            }
        } else {
            grid[row][col] = activeColorValue;
            cellChanged = true;
        }

        if (cellChanged) {
            lastPaintedCell = { row, col };
            // Use scheduled update for better performance during continuous painting
            scheduleCanvasUpdate();
        }

        return cellChanged;
    }
    return false;
}

// ============================================
// CANVAS INTERACTION
// ============================================
// Moved to src/ui/interactions.js - see canvasInteractions initialization below

// ============================================
// PALETTE MANAGEMENT
// ============================================
// Moved to src/ui/palette.js - see paletteManager initialization below

// ============================================
// BUTTON EVENT HANDLERS
// ============================================

document.getElementById('undoBtn').onclick = () => {
    const state = HistoryManager.undo();
    if (state) {
        grid = state.grid;
        gridWidth = state.gridWidth;
        gridHeight = state.gridHeight;
        patternColors = state.colors;
        backgroundColor = state.backgroundColor;

        // Update grid dimension displays
        const inlineWidthDisplay = document.getElementById('gridWidthDisplay');
        const inlineHeightDisplay = document.getElementById('gridHeightDisplay');
        if (inlineWidthDisplay) inlineWidthDisplay.textContent = gridWidth;
        if (inlineHeightDisplay) inlineHeightDisplay.textContent = gridHeight;

        // Check if preview repeats need to be reduced due to larger pattern
        const maxRepeat = getMaxPreviewRepeat(gridWidth, gridHeight);
        let repeatReduced = false;

        if (previewRepeatX > maxRepeat) {
            previewRepeatX = maxRepeat;
            const display = document.getElementById('previewRepeatXDisplay');
            if (display) display.textContent = previewRepeatX;
            repeatReduced = true;
        }

        if (previewRepeatY > maxRepeat) {
            previewRepeatY = maxRepeat;
            const display = document.getElementById('previewRepeatYDisplay');
            if (display) display.textContent = previewRepeatY;
            repeatReduced = true;
        }

        if (repeatReduced) {
            showPreviewToast(`Preview reduced to max for ${gridWidth}×${gridHeight} pattern (${maxRepeat}×${maxRepeat})`);
            saveToLocalStorage();
        }

        updateActiveColorUI();
            createNavbarColorButtons();
        updateCanvas();
        updatePreviewRepeatStatus();
        announceToScreenReader('Undo successful');
    }
};

document.getElementById('redoBtn').onclick = () => {
    const state = HistoryManager.redo();
    if (state) {
        grid = state.grid;
        gridWidth = state.gridWidth;
        gridHeight = state.gridHeight;
        patternColors = state.colors;
        backgroundColor = state.backgroundColor;

        // Update grid dimension displays
        const inlineWidthDisplay = document.getElementById('gridWidthDisplay');
        const inlineHeightDisplay = document.getElementById('gridHeightDisplay');
        if (inlineWidthDisplay) inlineWidthDisplay.textContent = gridWidth;
        if (inlineHeightDisplay) inlineHeightDisplay.textContent = gridHeight;

        // Check if preview repeats need to be reduced due to larger pattern
        const maxRepeat = getMaxPreviewRepeat(gridWidth, gridHeight);
        let repeatReduced = false;

        if (previewRepeatX > maxRepeat) {
            previewRepeatX = maxRepeat;
            const display = document.getElementById('previewRepeatXDisplay');
            if (display) display.textContent = previewRepeatX;
            repeatReduced = true;
        }

        if (previewRepeatY > maxRepeat) {
            previewRepeatY = maxRepeat;
            const display = document.getElementById('previewRepeatYDisplay');
            if (display) display.textContent = previewRepeatY;
            repeatReduced = true;
        }

        if (repeatReduced) {
            showPreviewToast(`Preview reduced to max for ${gridWidth}×${gridHeight} pattern (${maxRepeat}×${maxRepeat})`);
            saveToLocalStorage();
        }

        updateActiveColorUI();
            createNavbarColorButtons();
        updateCanvas();
        updatePreviewRepeatStatus();
        announceToScreenReader('Redo successful');
    }
};

document.getElementById('clearBtn').onclick = () => {
    showConfirmDialog(
        'Clear canvas?',
        'This will erase all painted cells. This action can be undone.',
        'Clear',
        (confirmed) => {
            if (confirmed) {
                grid = createEmptyGrid(gridWidth, gridHeight);
                saveToHistory();
                updateCanvas();
                announceToScreenReader('Canvas cleared');
            }
        }
    );
};

// Palette controls - dropdown menu items
document.querySelectorAll('.palette-option').forEach(option => {
    option.addEventListener('click', (e) => {
        e.preventDefault();
        const paletteId = e.target.dataset.palette;
        switchPalette(paletteId);
    });
});


// Download modal controls
const downloadModal = document.getElementById('downloadModal');
const downloadBtn = document.getElementById('downloadBtn');
const downloadModalCancelBtn = document.getElementById('downloadModalCancelBtn');
const downloadForm = document.getElementById('downloadForm');
const contextControls = document.getElementById('contextControls');

// Toggle context controls visibility based on source selection
const sourceRadios = document.querySelectorAll('input[name="source"]');
sourceRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        if (radio.value === 'pattern-with-context' && radio.checked) {
            // Only show form controls if pattern is too large for visual selection (3x3 preview)
            const maxRepeat = getMaxPreviewRepeat(gridWidth, gridHeight);
            if (maxRepeat < 3) {
                contextControls.style.display = 'flex';
            } else {
                contextControls.style.display = 'none';
            }
        } else {
            contextControls.style.display = 'none';
        }
    });
});

// Open download modal
downloadBtn.onclick = () => {
    downloadModal.style.display = 'flex';

    // Update context input max values based on current pattern size
    const contextLeftInput = document.getElementById('contextLeft');
    const contextRightInput = document.getElementById('contextRight');
    const contextTopInput = document.getElementById('contextTop');
    const contextBottomInput = document.getElementById('contextBottom');

    if (contextLeftInput) contextLeftInput.max = gridWidth - 1;
    if (contextRightInput) contextRightInput.max = gridWidth - 1;
    if (contextTopInput) contextTopInput.max = gridHeight - 1;
    if (contextBottomInput) contextBottomInput.max = gridHeight - 1;

    // Update context controls visibility based on current pattern size
    const patternWithContextRadio = document.querySelector('input[name="source"][value="pattern-with-context"]');
    if (patternWithContextRadio && patternWithContextRadio.checked) {
        const maxRepeat = getMaxPreviewRepeat(gridWidth, gridHeight);
        if (maxRepeat < 3) {
            contextControls.style.display = 'flex';
        } else {
            contextControls.style.display = 'none';
        }
    }
};

// Close download modal
downloadModalCancelBtn.onclick = () => {
    downloadModal.style.display = 'none';
};

// Close modal on backdrop click
downloadModal.onclick = (e) => {
    if (e.target === downloadModal) {
        downloadModal.style.display = 'none';
    }
};

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && downloadModal.style.display === 'flex') {
        downloadModal.style.display = 'none';
    }
});

// Handle download form submission
downloadForm.onsubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData(downloadForm);
    const source = formData.get('source');
    const format = formData.get('format');
    const includeRowCounts = formData.get('rowCounts') === 'on';

    // Close modal
    downloadModal.style.display = 'none';

    // If pattern-with-context is selected, check if we can use visual selection
    if (source === 'pattern-with-context') {
        const maxRepeat = getMaxPreviewRepeat(gridWidth, gridHeight);

        // Use visual selection if pattern supports 3x3 preview
        if (maxRepeat >= 3) {
            enterVisualContextSelection(format, includeRowCounts);
            return;
        } else {
            // Pattern too large - use form values
            const context = {
                left: parseInt(formData.get('contextLeft')) || 0,
                right: parseInt(formData.get('contextRight')) || 0,
                top: parseInt(formData.get('contextTop')) || 0,
                bottom: parseInt(formData.get('contextBottom')) || 0
            };

            try {
                showLoading(`Exporting ${format.toUpperCase()}...`);
                await new Promise(resolve => setTimeout(resolve, 50));

                let blob, filename;
                if (format === 'svg') {
                    blob = exportPatternWithContextSvg(getState(), context, includeRowCounts);
                    filename = `motif-pattern-context-${gridWidth}x${gridHeight}.svg`;
                } else {
                    blob = await exportPatternWithContextPng(getState(), context, includeRowCounts);
                    filename = `motif-pattern-context-${gridWidth}x${gridHeight}.png`;
                }

                downloadFile(blob, filename);
                announceToScreenReader(`Pattern exported as ${format.toUpperCase()}`);
            } catch (error) {
                handleFileError(error, `${format.toUpperCase()} export`);
            } finally {
                hideLoading();
            }
            return;
        }
    }

    try {
        showLoading(`Exporting ${format.toUpperCase()}...`);
        await new Promise(resolve => setTimeout(resolve, 50));

        let blob;
        let filename;

        if (source === 'pattern') {
            if (format === 'svg') {
                blob = exportSvg(getState(), includeRowCounts);
                filename = `motif-pattern-${gridWidth}x${gridHeight}.svg`;
            } else {
                blob = await exportPng(getState(), includeRowCounts);
                filename = `motif-pattern-${gridWidth}x${gridHeight}.png`;
            }
        } else {
            // Preview export
            if (format === 'svg') {
                blob = exportPreviewSvg(getState(), includeRowCounts);
                filename = `motif-preview-${gridWidth}x${gridHeight}-${previewRepeatX}x${previewRepeatY}.svg`;
            } else {
                blob = await exportPreviewPng(getState(), includeRowCounts);
                filename = `motif-preview-${gridWidth}x${gridHeight}-${previewRepeatX}x${previewRepeatY}.png`;
            }
        }

        downloadFile(blob, filename);
        announceToScreenReader(`Pattern exported as ${format.toUpperCase()}`);
    } catch (error) {
        handleFileError(error, `${format.toUpperCase()} export`);
    } finally {
        hideLoading();
    }
};

// ============================================
// VISUAL CONTEXT SELECTION
// ============================================

// Visual context selection state
let visualContextSelectionActive = false;
let savedPreviewRepeatX = 3;
let savedPreviewRepeatY = 3;
let contextSelection = { left: 0, right: 0, top: 0, bottom: 0 };
let selectionFormat = 'png';
let selectionIncludeRowCounts = false;
let draggingEdge = null;
let dragStartPos = { x: 0, y: 0 };

/**
 * Enter visual context selection mode
 */
function enterVisualContextSelection(format, includeRowCounts) {
    // Save current state
    savedPreviewRepeatX = previewRepeatX;
    savedPreviewRepeatY = previewRepeatY;
    selectionFormat = format;
    selectionIncludeRowCounts = includeRowCounts;
    contextSelection = { left: 0, right: 0, top: 0, bottom: 0 };
    visualContextSelectionActive = true;

    // Switch to 3x3 preview
    previewRepeatX = 3;
    previewRepeatY = 3;

    // Update preview repeat displays
    const inlineRepeatXDisplay = document.getElementById('previewRepeatXDisplay');
    const inlineRepeatYDisplay = document.getElementById('previewRepeatYDisplay');
    if (inlineRepeatXDisplay) inlineRepeatXDisplay.textContent = previewRepeatX;
    if (inlineRepeatYDisplay) inlineRepeatYDisplay.textContent = previewRepeatY;

    // Show visual selection controls
    const controls = document.getElementById('visualSelectionControls');
    if (controls) controls.style.display = 'flex';

    // Re-render preview
    updateCanvas();

    // Add visual selection overlay to preview canvas
    renderVisualSelection();
}

/**
 * Exit visual context selection mode
 */
function exitVisualContextSelection() {
    visualContextSelectionActive = false;

    // Hide visual selection controls
    const controls = document.getElementById('visualSelectionControls');
    if (controls) controls.style.display = 'none';

    // Restore original preview repeat values
    previewRepeatX = savedPreviewRepeatX;
    previewRepeatY = savedPreviewRepeatY;

    // Update preview repeat displays
    const inlineRepeatXDisplay = document.getElementById('previewRepeatXDisplay');
    const inlineRepeatYDisplay = document.getElementById('previewRepeatYDisplay');
    if (inlineRepeatXDisplay) inlineRepeatXDisplay.textContent = previewRepeatX;
    if (inlineRepeatYDisplay) inlineRepeatYDisplay.textContent = previewRepeatY;

    // Re-render preview
    updateCanvas();
}

/**
 * Render visual selection overlay on preview canvas
 */
function renderVisualSelection() {
    if (!visualContextSelectionActive) return;

    const previewCanvas = document.getElementById('previewCanvas');
    const ctx = previewCanvas.getContext('2d');

    // Draw red box around the center repeat
    const cellWidth = previewCanvas.width / (gridWidth * 3);
    const cellHeight = previewCanvas.height / (gridHeight * 3);

    // Center repeat is the middle one in the 3x3 grid
    const centerStartX = gridWidth * cellWidth;
    const centerStartY = gridHeight * cellHeight;
    const centerWidth = gridWidth * cellWidth;
    const centerHeight = gridHeight * cellHeight;

    // Calculate context box dimensions
    const contextStartX = centerStartX - (contextSelection.left * cellWidth);
    const contextStartY = centerStartY - (contextSelection.top * cellHeight);
    const contextWidth = centerWidth + (contextSelection.left + contextSelection.right) * cellWidth;
    const contextHeight = centerHeight + (contextSelection.top + contextSelection.bottom) * cellHeight;

    // Draw grey overlay on areas outside the selection (like image crop tools)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';

    // Top rectangle
    ctx.fillRect(0, 0, previewCanvas.width, contextStartY);

    // Bottom rectangle
    ctx.fillRect(0, contextStartY + contextHeight, previewCanvas.width, previewCanvas.height - (contextStartY + contextHeight));

    // Left rectangle (between top and bottom)
    ctx.fillRect(0, contextStartY, contextStartX, contextHeight);

    // Right rectangle (between top and bottom)
    ctx.fillRect(contextStartX + contextWidth, contextStartY, previewCanvas.width - (contextStartX + contextWidth), contextHeight);

    // Draw the red box (thicker for visibility)
    ctx.strokeStyle = '#d32f2f';
    ctx.lineWidth = 4;
    ctx.strokeRect(centerStartX, centerStartY, centerWidth, centerHeight);

    // Draw context selection if any
    if (contextSelection.left > 0 || contextSelection.right > 0 ||
        contextSelection.top > 0 || contextSelection.bottom > 0) {

        // Draw amber box for context area (thicker for visibility)
        ctx.strokeStyle = '#FFA726';
        ctx.lineWidth = 4;
        ctx.strokeRect(contextStartX, contextStartY, contextWidth, contextHeight);
    }

    // Draw drag handles (triangles) on the edges
    const handleSize = 12;
    ctx.fillStyle = '#FFA726';

    // Left handle
    const leftX = contextStartX;
    const leftY = contextStartY + contextHeight / 2;
    ctx.beginPath();
    ctx.moveTo(leftX - handleSize, leftY);
    ctx.lineTo(leftX, leftY - handleSize / 2);
    ctx.lineTo(leftX, leftY + handleSize / 2);
    ctx.closePath();
    ctx.fill();

    // Right handle
    const rightX = contextStartX + contextWidth;
    const rightY = contextStartY + contextHeight / 2;
    ctx.beginPath();
    ctx.moveTo(rightX + handleSize, rightY);
    ctx.lineTo(rightX, rightY - handleSize / 2);
    ctx.lineTo(rightX, rightY + handleSize / 2);
    ctx.closePath();
    ctx.fill();

    // Top handle
    const topX = contextStartX + contextWidth / 2;
    const topY = contextStartY;
    ctx.beginPath();
    ctx.moveTo(topX, topY - handleSize);
    ctx.lineTo(topX - handleSize / 2, topY);
    ctx.lineTo(topX + handleSize / 2, topY);
    ctx.closePath();
    ctx.fill();

    // Bottom handle
    const bottomX = contextStartX + contextWidth / 2;
    const bottomY = contextStartY + contextHeight;
    ctx.beginPath();
    ctx.moveTo(bottomX, bottomY + handleSize);
    ctx.lineTo(bottomX - handleSize / 2, bottomY);
    ctx.lineTo(bottomX + handleSize / 2, bottomY);
    ctx.closePath();
    ctx.fill();
}

/**
 * Handle download with selected context
 */
async function downloadWithContext() {
    const format = selectionFormat;
    const includeRowCounts = selectionIncludeRowCounts;
    const context = { ...contextSelection };

    // Exit visual selection mode
    exitVisualContextSelection();

    try {
        showLoading(`Exporting ${format.toUpperCase()}...`);
        await new Promise(resolve => setTimeout(resolve, 50));

        let blob;
        let filename;

        if (format === 'svg') {
            blob = exportPatternWithContextSvg(getState(), context, includeRowCounts);
            filename = `motif-pattern-context-${gridWidth}x${gridHeight}.svg`;
        } else {
            blob = await exportPatternWithContextPng(getState(), context, includeRowCounts);
            filename = `motif-pattern-context-${gridWidth}x${gridHeight}.png`;
        }

        downloadFile(blob, filename);
        announceToScreenReader(`Pattern exported as ${format.toUpperCase()}`);
    } catch (error) {
        handleFileError(error, `${format.toUpperCase()} export`);
    } finally {
        hideLoading();
    }
}

/**
 * Handle mouse/touch events for dragging selection edges
 */
function handleSelectionMouseDown(e) {
    if (!visualContextSelectionActive) return;

    const previewCanvas = document.getElementById('previewCanvas');
    const rect = previewCanvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0].clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0].clientY) - rect.top;

    const cellWidth = previewCanvas.width / (gridWidth * 3);
    const cellHeight = previewCanvas.height / (gridHeight * 3);

    // Center repeat bounds
    const centerStartX = gridWidth * cellWidth;
    const centerStartY = gridHeight * cellHeight;
    const centerEndX = centerStartX + gridWidth * cellWidth;
    const centerEndY = centerStartY + gridHeight * cellHeight;

    // Check if clicking near an edge (within 10px threshold)
    const threshold = 10;

    // Check edges with context
    const leftEdge = centerStartX - (contextSelection.left * cellWidth);
    const rightEdge = centerEndX + (contextSelection.right * cellWidth);
    const topEdge = centerStartY - (contextSelection.top * cellHeight);
    const bottomEdge = centerEndY + (contextSelection.bottom * cellHeight);

    if (Math.abs(x - leftEdge) < threshold && y >= topEdge && y <= bottomEdge) {
        draggingEdge = 'left';
        dragStartPos = { x, y };
        e.preventDefault();
    } else if (Math.abs(x - rightEdge) < threshold && y >= topEdge && y <= bottomEdge) {
        draggingEdge = 'right';
        dragStartPos = { x, y };
        e.preventDefault();
    } else if (Math.abs(y - topEdge) < threshold && x >= leftEdge && x <= rightEdge) {
        draggingEdge = 'top';
        dragStartPos = { x, y };
        e.preventDefault();
    } else if (Math.abs(y - bottomEdge) < threshold && x >= leftEdge && x <= rightEdge) {
        draggingEdge = 'bottom';
        dragStartPos = { x, y };
        e.preventDefault();
    }
}

function handleSelectionMouseMove(e) {
    if (!visualContextSelectionActive || !draggingEdge) return;

    const previewCanvas = document.getElementById('previewCanvas');
    const rect = previewCanvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0].clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0].clientY) - rect.top;

    const cellWidth = previewCanvas.width / (gridWidth * 3);
    const cellHeight = previewCanvas.height / (gridHeight * 3);

    // Center repeat bounds
    const centerStartX = gridWidth * cellWidth;
    const centerStartY = gridHeight * cellHeight;
    const centerEndX = centerStartX + gridWidth * cellWidth;
    const centerEndY = centerStartY + gridHeight * cellHeight;

    // Calculate new context values based on drag
    if (draggingEdge === 'left') {
        const deltaStitches = Math.round((centerStartX - x) / cellWidth);
        contextSelection.left = Math.max(0, Math.min(gridWidth - 1, deltaStitches));
    } else if (draggingEdge === 'right') {
        const deltaStitches = Math.round((x - centerEndX) / cellWidth);
        contextSelection.right = Math.max(0, Math.min(gridWidth - 1, deltaStitches));
    } else if (draggingEdge === 'top') {
        const deltaStitches = Math.round((centerStartY - y) / cellHeight);
        contextSelection.top = Math.max(0, Math.min(gridHeight - 1, deltaStitches));
    } else if (draggingEdge === 'bottom') {
        const deltaStitches = Math.round((y - centerEndY) / cellHeight);
        contextSelection.bottom = Math.max(0, Math.min(gridHeight - 1, deltaStitches));
    }

    // Re-render
    updateCanvas();
    renderVisualSelection();

    e.preventDefault();
}

function handleSelectionMouseUp(e) {
    draggingEdge = null;
    dragStartPos = { x: 0, y: 0 };
}

// Add event listeners for visual selection
const previewCanvas = document.getElementById('previewCanvas');
previewCanvas.addEventListener('mousedown', handleSelectionMouseDown);
previewCanvas.addEventListener('touchstart', handleSelectionMouseDown, { passive: false });
document.addEventListener('mousemove', handleSelectionMouseMove);
document.addEventListener('touchmove', handleSelectionMouseMove, { passive: false });
document.addEventListener('mouseup', handleSelectionMouseUp);
document.addEventListener('touchend', handleSelectionMouseUp);

// Modify updateCanvas to call renderVisualSelection after rendering preview
const originalUpdateCanvas = updateCanvas;
function updateCanvasWithSelection() {
    originalUpdateCanvas();
    if (visualContextSelectionActive) {
        renderVisualSelection();
    }
}
// Replace updateCanvas reference
updateCanvas = updateCanvasWithSelection;

// Wire up visual selection control buttons
const visualSelectionCancelBtn = document.getElementById('visualSelectionCancelBtn');
const visualSelectionDownloadBtn = document.getElementById('visualSelectionDownloadBtn');

if (visualSelectionCancelBtn) {
    visualSelectionCancelBtn.onclick = () => {
        exitVisualContextSelection();
    };
}

if (visualSelectionDownloadBtn) {
    visualSelectionDownloadBtn.onclick = () => {
        downloadWithContext();
    };
}

// Handle Escape key to exit visual selection mode
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && visualContextSelectionActive) {
        exitVisualContextSelection();
    }
});

// ============================================
// END VISUAL CONTEXT SELECTION
// ============================================

document.getElementById('navbarExportJsonBtn').onclick = (e) => {
    e.preventDefault();
    try {
        const blob = exportJson(getState());
        downloadFile(blob, `motif-${gridWidth}x${gridHeight}.json`);
        announceToScreenReader('Pattern exported as JSON');
    } catch (error) {
        handleFileError(error, 'JSON export');
    }
};

document.getElementById('navbarImportJsonInput').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const fileTypeValidation = validateFileType(file, ['.json', 'application/json']);
    if (!fileTypeValidation.valid) {
        showError(fileTypeValidation.error, ErrorType.FILE_IO);
        e.target.value = '';
        return;
    }

    // Validate file size (10MB limit)
    const fileSizeValidation = validateFileSize(file, 10);
    if (!fileSizeValidation.valid) {
        showError(fileSizeValidation.error, ErrorType.FILE_IO);
        e.target.value = '';
        return;
    }

    showLoading('Importing pattern...');

    // Use setTimeout to allow loading UI to render
    setTimeout(() => {
        importJson(
            file,
            (importedData) => {
                try {
                    // Validate imported data
                    const dataValidation = validateImportData(importedData);
                    if (!dataValidation.valid) {
                        showError(dataValidation.error, ErrorType.VALIDATION);
                        return;
                    }

                    gridWidth = importedData.gridWidth;
                    gridHeight = importedData.gridHeight;
                    aspectRatio = importedData.aspectRatio;
                    grid = importedData.grid;
                    backgroundColor = importedData.backgroundColor;
                    patternColors = importedData.patternColors;

                    if (importedData.previewRepeatX) {
                        previewRepeatX = importedData.previewRepeatX;
                    }
                    if (importedData.previewRepeatY) {
                        previewRepeatY = importedData.previewRepeatY;
                    }

                    // Import palette settings
                    if (importedData.activePaletteId) {
                        activePaletteId = importedData.activePaletteId;
                    }
                    if (importedData.customPalette) {
                        customPalette = importedData.customPalette;
                    }

                    if (activePatternIndex >= patternColors.length) {
                        activePatternIndex = 0;
                    }

                    // Ensure preview repeats don't exceed max for imported pattern size
                    const maxRepeatImport = getMaxPreviewRepeat(gridWidth, gridHeight);
                    if (previewRepeatX > maxRepeatImport) {
                        previewRepeatX = maxRepeatImport;
                    }
                    if (previewRepeatY > maxRepeatImport) {
                        previewRepeatY = maxRepeatImport;
                    }

                    // Update all UI elements
                    const inlineWidthDisplay = document.getElementById('gridWidthDisplay');
                    const inlineHeightDisplay = document.getElementById('gridHeightDisplay');
                    if (inlineWidthDisplay) inlineWidthDisplay.textContent = gridWidth;
                    if (inlineHeightDisplay) inlineHeightDisplay.textContent = gridHeight;

                    const inlineRepeatXDisplay = document.getElementById('previewRepeatXDisplay');
                    const inlineRepeatYDisplay = document.getElementById('previewRepeatYDisplay');
                    if (inlineRepeatXDisplay) inlineRepeatXDisplay.textContent = previewRepeatX;
                    if (inlineRepeatYDisplay) inlineRepeatYDisplay.textContent = previewRepeatY;

                                    createNavbarColorButtons();
                    updateActiveColorUI();
                    updatePaletteUI();
                    updateNavbarPaletteName();

                    saveToHistory();
                    updateCanvas();
                    updatePreviewRepeatStatus();
                    announceToScreenReader('Pattern imported successfully');
                } finally {
                    hideLoading();
                }
            },
            (errorMessage) => {
                hideLoading();
                showError(errorMessage, ErrorType.FILE_IO);
            }
        );
    }, UI_CONSTANTS.UI_UPDATE_DELAY);

    e.target.value = '';
};

// ============================================
// GRID DIMENSION HELPERS
// ============================================

function applyGridWidth(value) {
    applyDimensionInput({
        value,
        min: CONFIG.MIN_GRID_SIZE,
        max: CONFIG.MAX_GRID_SIZE,
        defaultValue: CONFIG.MIN_GRID_SIZE,
        displayElementId: 'gridWidthDisplay',
        applyFunction: (val) => applyGridResize(val, gridHeight),
        getCurrentValue: () => gridWidth,
        updateChevronStates: typeof updateChevronStates === 'function' ? updateChevronStates : null
    });
}

function applyGridHeight(value) {
    applyDimensionInput({
        value,
        min: CONFIG.MIN_GRID_SIZE,
        max: CONFIG.MAX_GRID_SIZE,
        defaultValue: CONFIG.MIN_GRID_SIZE,
        displayElementId: 'gridHeightDisplay',
        applyFunction: (val) => applyGridResize(gridWidth, val),
        getCurrentValue: () => gridHeight,
        updateChevronStates: typeof updateChevronStates === 'function' ? updateChevronStates : null
    });
}

function applyPreviewRepeatX(value) {
    const maxRepeat = getMaxPreviewRepeat(gridWidth, gridHeight);
    applyDimensionInput({
        value,
        min: CONFIG.MIN_PREVIEW_REPEAT,
        max: maxRepeat,
        defaultValue: CONFIG.MIN_PREVIEW_REPEAT,
        displayElementId: 'previewRepeatXDisplay',
        applyFunction: (val) => {
            previewRepeatX = val;
            updateCanvas();
            updatePreviewRepeatStatus();
            saveToLocalStorage();
        },
        updateChevronStates: typeof updateChevronStates === 'function' ? updateChevronStates : null
    });
}

function applyPreviewRepeatY(value) {
    const maxRepeat = getMaxPreviewRepeat(gridWidth, gridHeight);
    applyDimensionInput({
        value,
        min: CONFIG.MIN_PREVIEW_REPEAT,
        max: maxRepeat,
        defaultValue: CONFIG.MIN_PREVIEW_REPEAT,
        displayElementId: 'previewRepeatYDisplay',
        applyFunction: (val) => {
            previewRepeatY = val;
            updateCanvas();
            updatePreviewRepeatStatus();
            saveToLocalStorage();
        },
        updateChevronStates: typeof updateChevronStates === 'function' ? updateChevronStates : null
    });
}

// ============================================
// INITIALIZATION
// ============================================

// Check browser compatibility first
browserCapabilities = checkBrowserCompatibility();

// If canvas is not supported, the app cannot run - error overlay will be shown
// and we should stop initialization
if (!browserCapabilities.canvas) {
    throw new Error('Canvas API not supported - application cannot initialize');
}

// Try to load saved state from localStorage (will be null if localStorage unavailable)
const savedState = browserCapabilities.localStorage ? StorageManager.load() : null;

// Initialize from saved state or defaults
if (savedState) {
    gridWidth = Utils.clampInt(savedState.gridWidth, CONFIG.MIN_GRID_SIZE, CONFIG.MAX_GRID_SIZE, CONFIG.DEFAULT_GRID_WIDTH);
    gridHeight = Utils.clampInt(savedState.gridHeight, CONFIG.MIN_GRID_SIZE, CONFIG.MAX_GRID_SIZE, CONFIG.DEFAULT_GRID_HEIGHT);
    aspectRatio = Utils.clampFloat(savedState.aspectRatio, CONFIG.MIN_ASPECT_RATIO, CONFIG.MAX_ASPECT_RATIO, CONFIG.DEFAULT_ASPECT_RATIO);
    previewRepeatX = Utils.clampInt(savedState.previewRepeatX, CONFIG.MIN_PREVIEW_REPEAT, CONFIG.MAX_PREVIEW_REPEAT, CONFIG.DEFAULT_PREVIEW_REPEAT);
    previewRepeatY = Utils.clampInt(savedState.previewRepeatY, CONFIG.MIN_PREVIEW_REPEAT, CONFIG.MAX_PREVIEW_REPEAT, CONFIG.DEFAULT_PREVIEW_REPEAT);
    backgroundColor = savedState.backgroundColor || CONFIG.DEFAULT_BACKGROUND_COLOR;
    patternColors = savedState.patternColors || [CONFIG.DEFAULT_PATTERN_COLOR];
    activePatternIndex = savedState.activePatternIndex || 0;
    grid = savedState.grid || [];
    hasInteracted = savedState.hasInteracted || false;
    activePaletteId = savedState.activePaletteId || CONFIG.DEFAULT_ACTIVE_PALETTE;
    customPalette = savedState.customPalette || null;

    if (activePatternIndex >= patternColors.length) {
        activePatternIndex = 0;
    }
} else {
    gridWidth = CONFIG.DEFAULT_GRID_WIDTH;
    gridHeight = CONFIG.DEFAULT_GRID_HEIGHT;
    aspectRatio = CONFIG.DEFAULT_ASPECT_RATIO;
    previewRepeatX = CONFIG.DEFAULT_PREVIEW_REPEAT;
    previewRepeatY = CONFIG.DEFAULT_PREVIEW_REPEAT;
    backgroundColor = CONFIG.DEFAULT_BACKGROUND_COLOR;
    patternColors[0] = CONFIG.DEFAULT_PATTERN_COLOR;
}

// Update all UI display elements to match loaded/initialized state

const inlineWidthDisplay = document.getElementById('gridWidthDisplay');
const inlineHeightDisplay = document.getElementById('gridHeightDisplay');
if (inlineWidthDisplay) inlineWidthDisplay.textContent = gridWidth;
if (inlineHeightDisplay) inlineHeightDisplay.textContent = gridHeight;

const inlineRepeatXDisplay = document.getElementById('previewRepeatXDisplay');
const inlineRepeatYDisplay = document.getElementById('previewRepeatYDisplay');

// Ensure preview repeats don't exceed max for current pattern size
const maxRepeatOnLoad = getMaxPreviewRepeat(gridWidth, gridHeight);
if (previewRepeatX > maxRepeatOnLoad) {
    previewRepeatX = maxRepeatOnLoad;
}
if (previewRepeatY > maxRepeatOnLoad) {
    previewRepeatY = maxRepeatOnLoad;
}

if (inlineRepeatXDisplay) inlineRepeatXDisplay.textContent = previewRepeatX;
if (inlineRepeatYDisplay) inlineRepeatYDisplay.textContent = previewRepeatY;

// Initialize canvas manager
CanvasManager.init('editCanvas', 'previewCanvas');

// ============================================
// INITIALIZE UI MODULES
// ============================================

// Initialize palette manager
const paletteManager = createPaletteManager({
    getCurrentPaletteColors,
    isCurrentPaletteEditable,
    getActivePaletteId: () => activePaletteId,
    setActivePaletteId: (id) => { activePaletteId = id; },
    getCustomPalette: () => customPalette,
    setCustomPalette: (palette) => { customPalette = palette; },
    getPatternColors: () => patternColors,
    setPatternColors: (colors) => { patternColors = colors; },
    getActivePatternIndex: () => activePatternIndex,
    getBackgroundColor: () => backgroundColor,
    setBackgroundColor: (color) => { backgroundColor = color; },
    saveToLocalStorage,
    updateCanvas,
    updateColorIndicators,
    updateActiveColorUI
});

// Expose palette functions globally for button handlers
const renderPalette = paletteManager.renderPalette;
const switchPalette = paletteManager.switchPalette;
const updatePaletteUI = paletteManager.updatePaletteUI;

// Initialize dropdowns
setupDropdowns();

// Initialize keyboard shortcuts
setupKeyboardShortcuts({
    getPatternColors: () => patternColors,
    getActivePatternIndex: () => activePatternIndex,
    setActivePatternIndex: (index) => {
        activePatternIndex = index;
        isBackgroundActive = false; // Deactivate background when selecting pattern color via keyboard
    },
    updateActiveColorUI,
    createNavbarColorButtons,
    setShiftKeyState: (isHeld) => {
        isShiftKeyHeld = isHeld;
        updateNavbarButtonStates();
    }
});

// Initialize canvas interactions
const canvasInteractions = setupCanvasInteractions({
    canvasManager: CanvasManager,
    getHasInteracted: () => hasInteracted,
    setHasInteracted: (value) => { hasInteracted = value; },
    getIsDrawing: () => isDrawing,
    setIsDrawing: (value) => { isDrawing = value; },
    getInitialCellState: () => initialCellState,
    setInitialCellState: (value) => { initialCellState = value; },
    getLastPaintedCell: () => lastPaintedCell,
    setLastPaintedCell: (value) => { lastPaintedCell = value; },
    getGridWidth: () => gridWidth,
    getGridHeight: () => gridHeight,
    getGrid: () => grid,
    paintCell,
    saveToHistory
});

// Set up canvas event listeners
canvasInteractions.setupCanvasEvents();

// Initialize UI
updatePaletteUI();
createNavbarColorButtons();
updateActiveColorUI();
initGrid();

// Initialize navbar components
setupHamburgerMenu();
setupNavbarPaletteDropdown();
updateNavbarPaletteName();
updateNavbarPalettePreview();

// Initialize color toggle on page load
updateColorIndicators();

// Hide canvas instructions if user has already interacted
if (hasInteracted) {
    const instructions = document.getElementById('canvasInstructions');
    instructions.style.display = 'none';
}

// Grid dimension controls - now handled by contenteditable spans
// (gridWidthDisplay and gridHeightDisplay elements)

// Aspect Ratio controls
const ratioDisplay2 = document.getElementById('ratioDisplay2');
const ratioPresetButtons = document.querySelectorAll('.ratio-preset-btn');
const customRatioControls = document.getElementById('customRatioControls');
const aspectRatioSlider = document.getElementById('aspectRatio2');

const switchToCustomRatio = () => {
    ratioPresetButtons.forEach(b => b.classList.remove('active'));
    const customBtn = document.querySelector('.ratio-preset-btn[data-ratio="custom"]');
    if (customBtn) {
        customBtn.classList.add('active');
        if (customRatioControls) customRatioControls.style.display = 'block';
    }
};

ratioPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const ratio = btn.getAttribute('data-ratio');

        ratioPresetButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (ratio !== 'custom') {
            const ratioValue = parseFloat(ratio);
            aspectRatio = ratioValue;
            if (aspectRatioSlider) aspectRatioSlider.value = ratioValue;
            if (ratioDisplay2) ratioDisplay2.textContent = Utils.decimalToFraction(ratioValue);
            if (customRatioControls) customRatioControls.style.display = 'none';
            updateCanvas();
            saveToLocalStorage();
        } else {
            if (customRatioControls) customRatioControls.style.display = 'block';
        }
    });
});

if (aspectRatioSlider) {
    aspectRatioSlider.oninput = (e) => {
        switchToCustomRatio();
        aspectRatio = parseFloat(e.target.value);
        if (ratioDisplay2) ratioDisplay2.textContent = Utils.aspectRatioToDisplay(aspectRatio);
        updateCanvas();
        saveToLocalStorage();
    };
}

if (ratioDisplay2) {
    ratioDisplay2.addEventListener('focus', () => {
        switchToCustomRatio();
    });

    ratioDisplay2.addEventListener('input', (e) => {
        const inputText = e.target.textContent.trim();
        const val = Utils.displayToAspectRatio(inputText);
        if (val !== null && val >= CONFIG.MIN_ASPECT_RATIO && val <= CONFIG.MAX_ASPECT_RATIO) {
            aspectRatio = val;
            if (aspectRatioSlider) aspectRatioSlider.value = val;
            updateCanvas();
            saveToLocalStorage();
        }
    });

    ratioDisplay2.addEventListener('blur', (e) => {
        const inputText = e.target.textContent.trim();
        let val = Utils.displayToAspectRatio(inputText);

        if (val === null) {
            val = CONFIG.DEFAULT_ASPECT_RATIO;
        }

        val = Utils.clamp(val, CONFIG.MIN_ASPECT_RATIO, CONFIG.MAX_ASPECT_RATIO);

        aspectRatio = val;
        e.target.textContent = Utils.aspectRatioToDisplay(val);
        if (aspectRatioSlider) aspectRatioSlider.value = val;
        updateCanvas();
        saveToLocalStorage();
    });

    ratioDisplay2.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
        }
    });

    // Initialize button state and display based on current aspect ratio
    (() => {
        const currentRatio = aspectRatio;
        let matchedPreset = false;

        ratioPresetButtons.forEach(btn => {
            const ratio = btn.getAttribute('data-ratio');
            if (ratio !== 'custom') {
                const ratioValue = parseFloat(ratio);
                if (Math.abs(currentRatio - ratioValue) < 0.01) {
                    btn.classList.add('active');
                    if (customRatioControls) customRatioControls.style.display = 'none';
                    matchedPreset = true;
                } else {
                    btn.classList.remove('active');
                }
            }
        });

        if (!matchedPreset) {
            const customBtn = document.querySelector('.ratio-preset-btn[data-ratio="custom"]');
            if (customBtn) {
                customBtn.classList.add('active');
                if (customRatioControls) customRatioControls.style.display = 'block';
            }
        }

        ratioDisplay2.textContent = Utils.aspectRatioToDisplay(aspectRatio);
    })();
}

// Inline Grid Dimension Controls
const gridWidthDisplay = document.getElementById('gridWidthDisplay');
const gridHeightDisplay = document.getElementById('gridHeightDisplay');
const previewRepeatXDisplay = document.getElementById('previewRepeatXDisplay');
const previewRepeatYDisplay = document.getElementById('previewRepeatYDisplay');

// Helper function to setup contenteditable dimension displays
function setupContenteditableDimension(element, applyFunc, min, max) {
    if (!element) return;

    element.addEventListener('input', (e) => {
        const text = e.target.textContent.trim();
        const val = parseInt(text, 10);
        if (!isNaN(val) && val >= min && val <= max) {
            // Valid value, update immediately
            element.dataset.lastValid = text;
        }
    });

    element.addEventListener('blur', (e) => {
        const text = e.target.textContent.trim();
        let val = parseInt(text, 10);

        if (isNaN(val)) {
            val = element.dataset.lastValid ? parseInt(element.dataset.lastValid, 10) : min;
        }

        val = Utils.clampInt(val, min, max, min);
        e.target.textContent = val;
        element.dataset.lastValid = val;
        applyFunc(val);
    });

    element.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
        }
        // Prevent non-numeric input
        if (e.key.length === 1 && !/[0-9]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
        }
    });

    // Initialize
    element.dataset.lastValid = element.textContent.trim();
}

// Setup grid dimension displays
setupContenteditableDimension(gridWidthDisplay, applyGridWidth, CONFIG.MIN_GRID_SIZE, CONFIG.MAX_GRID_SIZE);
setupContenteditableDimension(gridHeightDisplay, applyGridHeight, CONFIG.MIN_GRID_SIZE, CONFIG.MAX_GRID_SIZE);
setupContenteditableDimension(previewRepeatXDisplay, applyPreviewRepeatX, CONFIG.MIN_PREVIEW_REPEAT, CONFIG.MAX_PREVIEW_REPEAT);
setupContenteditableDimension(previewRepeatYDisplay, applyPreviewRepeatY, CONFIG.MIN_PREVIEW_REPEAT, CONFIG.MAX_PREVIEW_REPEAT);

// Grid chevron buttons
const gridChevrons = document.querySelectorAll('.grid-chevron');
gridChevrons.forEach(btn => {
    let pressTimer = null;
    let isLongPress = false;

    btn.addEventListener('click', (e) => {
        // Ignore if this was a long press (already handled)
        if (isLongPress) {
            isLongPress = false;
            return;
        }

        const dimension = btn.getAttribute('data-dimension');
        const direction = btn.getAttribute('data-direction');

        // Grid arrows: add/remove from specific edge
        // Normal click adds (+1), shift+click removes (-1)
        const delta = e.shiftKey ? -1 : 1;

        // Map data-direction to edge direction
        let edgeDirection;
        if (dimension === 'width') {
            edgeDirection = direction === 'decrease' ? 'left' : 'right';
        } else if (dimension === 'height') {
            edgeDirection = direction === 'decrease' ? 'top' : 'bottom';
        }

        applyGridResizeFromEdge(edgeDirection, delta);
    });

    // Touch long press for remove (same as shift+click)
    btn.addEventListener('touchstart', (e) => {
        isLongPress = false;
        pressTimer = setTimeout(() => {
            isLongPress = true;
            const dimension = btn.getAttribute('data-dimension');
            const direction = btn.getAttribute('data-direction');

            // Map data-direction to edge direction
            let edgeDirection;
            if (dimension === 'width') {
                edgeDirection = direction === 'decrease' ? 'left' : 'right';
            } else if (dimension === 'height') {
                edgeDirection = direction === 'decrease' ? 'top' : 'bottom';
            }

            applyGridResizeFromEdge(edgeDirection, -1); // Remove row/column

            // Haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(UI_CONSTANTS.HAPTIC_FEEDBACK_DURATION);
            }
        }, UI_CONSTANTS.LONG_PRESS_DURATION);
    }, { passive: true });

    btn.addEventListener('touchend', (e) => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    });

    btn.addEventListener('touchcancel', (e) => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        isLongPress = false;
    });
});

// Function to update chevron disabled states
function updateChevronStates() {
    gridChevrons.forEach(btn => {
        const dimension = btn.getAttribute('data-dimension');
        let shouldDisable = false;

        // All arrows add in their direction, so disable when at max size
        if (dimension === 'width') {
            shouldDisable = gridWidth >= CONFIG.MAX_GRID_SIZE;
        } else if (dimension === 'height') {
            shouldDisable = gridHeight >= CONFIG.MAX_GRID_SIZE;
        }

        btn.disabled = shouldDisable;
        btn.classList.toggle('disabled', shouldDisable);
    });
}

// Helper functions to check if grid can shrink
function canShrinkWidth() {
    const result = resizeGrid({
        grid,
        gridWidth,
        gridHeight,
        newWidth: gridWidth - 1,
        newHeight: gridHeight
    });
    return result !== false;
}

function canShrinkHeight() {
    const result = resizeGrid({
        grid,
        gridWidth,
        gridHeight,
        newWidth: gridWidth,
        newHeight: gridHeight - 1
    });
    return result !== false;
}

// Setup toggle for cell aspect ratio section
const cellAspectRatioSection = document.getElementById('cellAspectRatioSection');
const cellAspectRatioToggle = document.getElementById('cellAspectRatioToggle');
if (cellAspectRatioToggle && cellAspectRatioSection) {
    cellAspectRatioToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent hamburger menu from closing
        const isExpanded = cellAspectRatioToggle.getAttribute('aria-expanded') === 'true';
        cellAspectRatioToggle.setAttribute('aria-expanded', !isExpanded);
        cellAspectRatioSection.style.display = isExpanded ? 'none' : 'block';
    });

    // Prevent clicks inside the section from closing the hamburger menu
    cellAspectRatioSection.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// Initialize chevron states
updateChevronStates();

// Window resize handler
// Debounced resize handler to recreate navbar buttons when viewport changes
let resizeTimeout;
let lastKnownWidth = window.innerWidth;
let lastKnownHeight = window.innerHeight;

window.addEventListener('resize', () => {
    const currentWidth = window.innerWidth;
    const currentHeight = window.innerHeight;

    // On mobile, ignore resize events that are likely just browser chrome showing/hiding
    // Only update if both dimensions changed significantly (orientation change or actual window resize)
    const isLandscape = currentWidth > currentHeight;
    const isMobile = currentWidth <= 1024 || (isLandscape && currentHeight <= 500);
    const widthChanged = Math.abs(currentWidth - lastKnownWidth) > 10;
    const heightChanged = Math.abs(currentHeight - lastKnownHeight) > 10;

    // Update canvas only if:
    // - Not on mobile, OR
    // - Both dimensions changed (orientation change), OR
    // - Width changed significantly (not just chrome)
    if (!isMobile || (widthChanged && heightChanged) || (!isLandscape && widthChanged && Math.abs(currentWidth - lastKnownWidth) > 50)) {
        lastKnownWidth = currentWidth;
        lastKnownHeight = currentHeight;
        updateCanvas();
    }

    // Debounce navbar button recreation
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        createNavbarColorButtons();
    }, UI_CONSTANTS.DEBOUNCE_DELAY);
});

// Canvas edge resize handlers
const resizeHandles = document.querySelectorAll('.resize-handle');
let isResizing = false;
let resizeDirection = null;
let resizeStartSize = null;
let resizeStartPos = null;
let touchStartPos = null;
let currentHandle = null;
let resizeInitiated = false;

// Helper function to start resize (works for both mouse and touch)
function startResize(handle, clientX, clientY) {
    isResizing = true;
    resizeDirection = handle.dataset.direction;
    resizeStartSize = { width: gridWidth, height: gridHeight };
    resizeStartPos = { x: clientX, y: clientY };

    const canvas = document.getElementById('editCanvas');
    const cellWidth = canvas.width / gridWidth;
    const cellHeight = canvas.height / gridHeight;
    resizeStartSize.cellWidth = cellWidth;
    resizeStartSize.cellHeight = cellHeight;

    document.body.style.cursor = handle.style.cursor;

    // Add visual feedback class (especially useful for touch devices)
    const container = document.querySelector('.canvas-resize-container');
    if (container) {
        container.classList.add('is-resizing');
    }
}

resizeHandles.forEach(handle => {
    // Mouse events
    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startResize(handle, e.clientX, e.clientY);
    });

    // Touch events - delay resize start until we detect intentional drag
    handle.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        touchStartPos = { x: touch.clientX, y: touch.clientY };
        currentHandle = handle;
        resizeInitiated = false;
    }, { passive: true });
});

// Helper function to handle resize movement (works for both mouse and touch)
function handleResizeMove(clientX, clientY) {
    if (!isResizing) return;

    const deltaX = clientX - resizeStartPos.x;
    const deltaY = clientY - resizeStartPos.y;

    let cellDelta = 0;

    if (resizeDirection === 'right') {
        cellDelta = Math.round(deltaX / resizeStartSize.cellWidth);
    } else if (resizeDirection === 'left') {
        cellDelta = Math.round(-deltaX / resizeStartSize.cellWidth);
    } else if (resizeDirection === 'bottom') {
        cellDelta = Math.round(deltaY / resizeStartSize.cellHeight);
    } else if (resizeDirection === 'top') {
        cellDelta = Math.round(-deltaY / resizeStartSize.cellHeight);
    }

    if (cellDelta !== 0) {
        const targetWidth = (resizeDirection === 'left' || resizeDirection === 'right')
            ? resizeStartSize.width + cellDelta
            : gridWidth;
        const targetHeight = (resizeDirection === 'top' || resizeDirection === 'bottom')
            ? resizeStartSize.height + cellDelta
            : gridHeight;

        if ((targetWidth !== gridWidth || targetHeight !== gridHeight) &&
            targetWidth >= CONFIG.MIN_GRID_SIZE && targetWidth <= CONFIG.MAX_GRID_SIZE &&
            targetHeight >= CONFIG.MIN_GRID_SIZE && targetHeight <= CONFIG.MAX_GRID_SIZE) {

            applyGridResizeFromEdge(resizeDirection, cellDelta);

            resizeStartPos = { x: clientX, y: clientY };
            resizeStartSize.width = gridWidth;
            resizeStartSize.height = gridHeight;
        }
    }
}

// Helper function to end resize (works for both mouse and touch)
function endResize() {
    if (isResizing) {
        isResizing = false;
        resizeDirection = null;
        resizeStartSize = null;
        resizeStartPos = null;
        document.body.style.cursor = '';

        // Remove visual feedback class
        const container = document.querySelector('.canvas-resize-container');
        if (container) {
            container.classList.remove('is-resizing');
        }
    }
}

// Mouse events
document.addEventListener('mousemove', (e) => {
    handleResizeMove(e.clientX, e.clientY);
});

document.addEventListener('mouseup', () => {
    endResize();
});

// Touch events
document.addEventListener('touchmove', (e) => {
    if (isResizing) {
        e.preventDefault();
        const touch = e.touches[0];
        handleResizeMove(touch.clientX, touch.clientY);
    } else if (touchStartPos && currentHandle && !resizeInitiated) {
        // Check if user is intentionally dragging the handle (not just scrolling)
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - touchStartPos.x);
        const deltaY = Math.abs(touch.clientY - touchStartPos.y);
        const direction = currentHandle.dataset.direction;

        // Require threshold and directional intent
        const threshold = UI_CONSTANTS.DRAG_THRESHOLD;
        let shouldStartResize = false;

        if ((direction === 'left' || direction === 'right') && deltaX > threshold) {
            // For horizontal handles, horizontal movement should dominate
            shouldStartResize = deltaX > deltaY * 1.5;
        } else if ((direction === 'top' || direction === 'bottom') && deltaY > threshold) {
            // For vertical handles, vertical movement should dominate
            shouldStartResize = deltaY > deltaX * 1.5;
        }

        if (shouldStartResize) {
            e.preventDefault();
            resizeInitiated = true;
            startResize(currentHandle, touchStartPos.x, touchStartPos.y);
        }
    }
}, { passive: false });

document.addEventListener('touchend', () => {
    endResize();
    touchStartPos = null;
    currentHandle = null;
    resizeInitiated = false;
});

document.addEventListener('touchcancel', () => {
    endResize();
    touchStartPos = null;
    currentHandle = null;
    resizeInitiated = false;
});

// Keyboard shortcuts - Moved to src/ui/keyboard.js

// ============================================
// NAVBAR UI COMPONENTS
// ============================================

// Track currently open color menus
let currentColorMenu = null; // For overflow menu (grid of color buttons)
let currentColorActionMenu = null; // For edit/delete menu

/**
 * Show menu for color button with Set Active, Edit, Delete options
 */
function showColorButtonMenu(buttonElement, colorIndex, color) {
    // Close any existing action menu (but keep overflow menu open if it exists)
    closeColorActionMenu();

    // Create menu
    const menu = document.createElement('div');
    menu.className = 'navbar-color-menu';
    menu.setAttribute('role', 'menu');

    // Select option (if not already active)
    if (colorIndex !== activePatternIndex) {
        const selectBtn = document.createElement('button');
        selectBtn.className = 'navbar-color-menu-item';
        selectBtn.textContent = 'Select';
        selectBtn.setAttribute('role', 'menuitem');
        selectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            activePatternIndex = colorIndex;
            isBackgroundActive = false; // Deactivate background when selecting pattern color
            updateActiveColorUI();
            createNavbarColorButtons();
            saveToLocalStorage();
            closeColorActionMenu();
        });
        menu.appendChild(selectBtn);
    }

    // Edit option (text changes based on whether it's already active)
    const editBtn = document.createElement('button');
    editBtn.className = 'navbar-color-menu-item';
    editBtn.textContent = colorIndex === activePatternIndex ? 'Edit' : 'Edit and select';
    editBtn.setAttribute('role', 'menuitem');
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Set as active first (if not already)
        if (colorIndex !== activePatternIndex) {
            activePatternIndex = colorIndex;
            isBackgroundActive = false; // Deactivate background when selecting pattern color
            updateActiveColorUI();
            createNavbarColorButtons();
            saveToLocalStorage();
        }
        // Then open color picker
        openColorPicker(colorIndex, color);
        closeColorActionMenu();
    });
    menu.appendChild(editBtn);

    // Delete option (only for colors beyond the first one)
    if (colorIndex > 0) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'navbar-color-menu-item navbar-color-menu-item-danger';
        deleteBtn.textContent = 'Delete';
        deleteBtn.setAttribute('role', 'menuitem');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showDeleteColorDialog(colorIndex);
            closeColorActionMenu();
        });
        menu.appendChild(deleteBtn);
    }

    // Position menu below button
    const rect = buttonElement.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 8}px`;

    // Calculate horizontal position, ensuring menu stays within viewport
    document.body.appendChild(menu);
    const menuWidth = menu.offsetWidth;
    let leftPos = rect.left + rect.width / 2;

    // Check if menu would overflow on the right
    if (leftPos + menuWidth / 2 > window.innerWidth) {
        leftPos = window.innerWidth - menuWidth / 2 - 8;
    }
    // Check if menu would overflow on the left
    if (leftPos - menuWidth / 2 < 0) {
        leftPos = menuWidth / 2 + 8;
    }

    menu.style.left = `${leftPos}px`;
    menu.style.transform = 'translateX(-50%)';
    currentColorActionMenu = menu;

    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', closeColorActionMenu);
    }, 0);
}

/**
 * Close the color action menu (edit/delete menu)
 */
function closeColorActionMenu() {
    if (currentColorActionMenu) {
        document.removeEventListener('click', closeColorActionMenu);
        currentColorActionMenu.remove();
        currentColorActionMenu = null;
    }
}

/**
 * Close the color button menu (overflow menu and action menu)
 */
function closeColorButtonMenu() {
    closeColorActionMenu();
    if (currentColorMenu) {
        document.removeEventListener('click', closeColorButtonMenu);
        currentColorMenu.remove();
        currentColorMenu = null;
    }
}

/**
 * Show overflow menu with hidden colors on mobile
 */
function showOverflowColorsMenu(buttonElement, startIndex) {
    // Close any existing menu
    closeColorButtonMenu();

    // Create menu container
    const menu = document.createElement('div');
    menu.className = 'navbar-color-menu navbar-overflow-menu';
    menu.setAttribute('role', 'menu');

    // Add color buttons for overflow colors
    for (let i = startIndex; i < patternColors.length; i++) {
        const color = patternColors[i];
        const colorBtn = document.createElement('button');
        colorBtn.className = 'navbar-overflow-color-btn';
        colorBtn.style.backgroundColor = color;
        colorBtn.setAttribute('role', 'menuitem');
        colorBtn.setAttribute('aria-label', `Pattern color ${i + 1}: ${color}`);

        if (i === activePatternIndex) {
            colorBtn.style.border = '3px solid var(--color-primary)';
        }

        colorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Show the regular color menu for this color
            // Don't close the overflow menu - just show the edit/delete menu on top
            showColorButtonMenu(colorBtn, i, color);
        });

        menu.appendChild(colorBtn);
    }

    // Position menu below navbar (navbar is fixed at top, so menu should be too)
    // Get the navbar element to calculate its height
    const navbar = document.querySelector('.header-navbar');
    const navbarHeight = navbar ? navbar.offsetHeight : 64;
    const rect = buttonElement.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${navbarHeight + 8}px`;

    // Calculate horizontal position, ensuring menu stays within viewport
    document.body.appendChild(menu);
    const menuWidth = menu.offsetWidth;
    let leftPos = rect.left + rect.width / 2;

    // Check if menu would overflow on the right
    if (leftPos + menuWidth / 2 > window.innerWidth) {
        leftPos = window.innerWidth - menuWidth / 2 - 8;
    }
    // Check if menu would overflow on the left
    if (leftPos - menuWidth / 2 < 0) {
        leftPos = menuWidth / 2 + 8;
    }

    menu.style.left = `${leftPos}px`;
    menu.style.transform = 'translateX(-50%)';
    currentColorMenu = menu;

    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', closeColorButtonMenu);
    }, 0);
}

/**
 * Calculate how many color buttons can fit in the navbar
 * Uses viewport-based estimates for reliability
 */
function calculateMaxVisibleColors() {
    const viewportWidth = window.innerWidth;

    // Conservative estimates based on viewport size
    // These account for: navbar padding, branding (desktop), palette dropdown,
    // background button, add button, and gaps
    let maxVisible;

    if (viewportWidth <= 370) {
        // Very small mobile: ~320-370px viewport
        maxVisible = 4;
    } else if (viewportWidth <= 480) {
        // Small mobile: ~375-480px viewport
        maxVisible = 5;
    } else if (viewportWidth <= 768) {
        // Tablet portrait: ~600-768px viewport
        maxVisible = 8;
    } else if (viewportWidth <= 1024) {
        // Tablet landscape / small desktop
        maxVisible = 12;
    } else {
        // Desktop: 1024px+ (no overflow needed - max 20 colors can fit)
        maxVisible = 20;
    }

    // Return the calculated max, but don't exceed actual color count
    return Math.min(maxVisible, patternColors.length);
}

/**
 * Create color buttons in navbar
 * Includes pattern colors, add button, and background color button
 */
function createNavbarColorButtons() {
    const container = document.getElementById('navbarColorButtons');
    if (!container) return;

    container.innerHTML = '';

    // Calculate how many colors can fit dynamically
    const maxVisibleColors = calculateMaxVisibleColors();
    const needsOverflow = patternColors.length > maxVisibleColors;

    // Create pattern color buttons
    patternColors.forEach((color, index) => {
        // Skip colors beyond max visible if overflow is needed
        if (needsOverflow && index >= maxVisibleColors) {
            return;
        }
        const btn = document.createElement('div');
        btn.className = 'navbar-color-btn round';
        btn.style.backgroundColor = color;
        btn.setAttribute('data-index', index);
        btn.setAttribute('draggable', 'true');
        btn.setAttribute('aria-label', `Pattern color ${index + 1}`);

        if (index === activePatternIndex) {
            btn.classList.add('active');
        }

        // Click to show menu
        let dragStarted = false;
        let touchDragInProgress = false;
        let touchStartX = 0;
        let touchStartY = 0;

        btn.addEventListener('mousedown', () => {
            dragStarted = false;
        });

        btn.addEventListener('click', (e) => {
            if (!dragStarted && !touchDragInProgress) {
                e.stopPropagation();
                showColorButtonMenu(btn, index, color);
            }
        });

        // Drag and drop for merging
        btn.addEventListener('dragstart', (e) => {
            dragStarted = true;

            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index.toString());

            // Add visual feedback to the dragged button
            btn.classList.add('dragging');
        });

        btn.addEventListener('dragend', () => {
            btn.classList.remove('dragging');
        });

        btn.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const draggedData = e.dataTransfer.getData('text/plain');

            if (draggedData === 'background') {
                // Dragging background to pattern color - show swap indicator
                btn.style.boxShadow = '0 0 0 3px var(--color-primary)';
            } else {
                const draggedIndex = parseInt(draggedData);
                if (!isNaN(draggedIndex) && draggedIndex !== index) {
                    // Dragging pattern color to pattern color - show merge indicator
                    btn.style.backgroundColor = patternColors[draggedIndex];
                    btn.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
                }
            }
        });

        btn.addEventListener('dragleave', () => {
            btn.style.backgroundColor = color;
            btn.style.boxShadow = '';
        });

        btn.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            btn.style.backgroundColor = color;
            btn.style.boxShadow = '';

            const draggedData = e.dataTransfer.getData('text/plain');

            if (draggedData === 'background') {
                // Swap pattern color with background
                const temp = backgroundColor;
                backgroundColor = patternColors[index];
                patternColors[index] = temp;

                saveToHistory();
                createNavbarColorButtons();
                updateCanvas();
                updateColorIndicators();
                saveToLocalStorage();
                announceToScreenReader(`Swapped background color with pattern color ${index + 1}`);
            } else {
                // Merge pattern colors
                const draggedIndex = parseInt(draggedData);
                const targetIndex = index;

                if (draggedIndex !== targetIndex && !isNaN(draggedIndex)) {
                    mergePatternColors(draggedIndex, targetIndex);
                }
            }
        });

        // Touch drag support
        let touchDraggedIndex = null;

        btn.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchDragInProgress = false;
        }, { passive: true });

        btn.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            const deltaX = Math.abs(touch.clientX - touchStartX);
            const deltaY = Math.abs(touch.clientY - touchStartY);

            // If moved more than 5px, start drag
            if (deltaX > 5 || deltaY > 5) {
                if (!touchDragInProgress) {
                    touchDragInProgress = true;
                    touchDraggedIndex = index;
                    btn.style.opacity = '0.5';
                }

                // Find element under touch point
                const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
                if (elementUnder && elementUnder.classList.contains('navbar-color-btn') &&
                    elementUnder !== btn && !elementUnder.classList.contains('add-btn')) {
                    const isBackground = elementUnder.classList.contains('square');
                    if (isBackground) {
                        // Dragging to background - show swap indicator
                        elementUnder.style.boxShadow = '0 0 0 3px var(--color-primary)';
                    } else {
                        const targetIndex = parseInt(elementUnder.getAttribute('data-index'));
                        if (!isNaN(targetIndex)) {
                            // Dragging to pattern color - show merge indicator
                            elementUnder.style.backgroundColor = patternColors[index];
                            elementUnder.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
                        }
                    }
                } else {
                    // Reset all buttons
                    document.querySelectorAll('.navbar-color-btn').forEach(b => {
                        const btnIndex = parseInt(b.getAttribute('data-index'));
                        if (!isNaN(btnIndex) && b !== btn) {
                            b.style.backgroundColor = patternColors[btnIndex];
                            b.style.boxShadow = '';
                        }
                        if (b.classList.contains('square')) {
                            b.style.boxShadow = '';
                        }
                    });
                }
            }
        }, { passive: true });

        btn.addEventListener('touchend', (e) => {
            if (touchDragInProgress) {
                e.preventDefault(); // Prevent click event
                btn.style.opacity = '1';

                const touch = e.changedTouches[0];
                const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);

                if (elementUnder && elementUnder.classList.contains('navbar-color-btn') &&
                    elementUnder !== btn && !elementUnder.classList.contains('add-btn')) {
                    const isBackground = elementUnder.classList.contains('square');
                    if (isBackground) {
                        // Swap with background
                        const temp = backgroundColor;
                        backgroundColor = patternColors[index];
                        patternColors[index] = temp;

                        saveToHistory();
                        createNavbarColorButtons();
                        updateCanvas();
                        updateColorIndicators();
                        saveToLocalStorage();
                        announceToScreenReader(`Swapped pattern color ${index + 1} with background color`);
                    } else {
                        const targetIndex = parseInt(elementUnder.getAttribute('data-index'));
                        if (!isNaN(targetIndex) && targetIndex !== index) {
                            mergePatternColors(index, targetIndex);
                        }
                    }
                }

                // Reset all buttons
                document.querySelectorAll('.navbar-color-btn').forEach(b => {
                    const btnIndex = parseInt(b.getAttribute('data-index'));
                    if (!isNaN(btnIndex)) {
                        b.style.backgroundColor = patternColors[btnIndex];
                        b.style.boxShadow = '';
                    }
                });

                // Reset flag after a short delay to prevent accidental menu opening
                setTimeout(() => {
                    touchDragInProgress = false;
                }, UI_CONSTANTS.COLOR_PICKER_FADE_DELAY);
            }
        });

        btn.addEventListener('touchcancel', () => {
            btn.style.opacity = '1';
            touchDragInProgress = false;
            // Reset all buttons
            document.querySelectorAll('.navbar-color-btn').forEach(b => {
                const btnIndex = parseInt(b.getAttribute('data-index'));
                if (!isNaN(btnIndex)) {
                    b.style.backgroundColor = patternColors[btnIndex];
                    b.style.boxShadow = '';
                }
            });
        });

        container.appendChild(btn);
    });

    // Overflow button (...) for hidden colors on mobile
    if (needsOverflow) {
        const overflowBtn = document.createElement('div');
        overflowBtn.className = 'navbar-color-btn round overflow-btn';
        overflowBtn.textContent = '•••';
        overflowBtn.setAttribute('aria-label', `${patternColors.length - maxVisibleColors} more colors`);
        overflowBtn.style.fontSize = '14px';
        overflowBtn.style.fontWeight = 'bold';
        overflowBtn.style.display = 'flex';
        overflowBtn.style.alignItems = 'center';
        overflowBtn.style.justifyContent = 'center';
        overflowBtn.style.background = 'var(--color-bg-secondary)';
        overflowBtn.style.border = '2px solid var(--color-border-dark)';
        overflowBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showOverflowColorsMenu(overflowBtn, maxVisibleColors);
        });
        container.appendChild(overflowBtn);
    }

    // Add button (+)
    if (patternColors.length < CONFIG.MAX_PATTERN_COLORS) {
        const addBtn = document.createElement('div');
        addBtn.className = 'navbar-color-btn round add-btn';
        addBtn.textContent = '+';
        addBtn.setAttribute('aria-label', 'Add new pattern color');
        addBtn.addEventListener('click', () => {
            patternColors.push(CONFIG.DEFAULT_ADD_COLOR);
            activePatternIndex = patternColors.length - 1;
            createNavbarColorButtons();
            updateActiveColorUI();
            updateCanvas();
            saveToLocalStorage();
        });
        container.appendChild(addBtn);
    }

    // Background color button (square)
    const bgBtn = document.createElement('div');
    bgBtn.className = 'navbar-color-btn square';
    bgBtn.style.backgroundColor = backgroundColor;
    bgBtn.setAttribute('aria-label', 'Background color');
    bgBtn.setAttribute('draggable', 'true');
    bgBtn.setAttribute('data-type', 'background');

    let bgDragStarted = false;

    bgBtn.addEventListener('mousedown', () => {
        bgDragStarted = false;
    });

    bgBtn.addEventListener('click', () => {
        if (!bgDragStarted) {
            openBackgroundColorPicker();
        }
    });

    // Make background draggable
    bgBtn.addEventListener('dragstart', (e) => {
        bgDragStarted = true;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', 'background');
        bgBtn.classList.add('dragging');
    });

    bgBtn.addEventListener('dragend', () => {
        bgBtn.classList.remove('dragging');
    });

    // Accept pattern color drops to swap
    bgBtn.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const draggedData = e.dataTransfer.getData('text/plain');
        if (draggedData !== 'background') {
            bgBtn.style.boxShadow = '0 0 0 3px var(--color-primary)';
        }
    });

    bgBtn.addEventListener('dragleave', () => {
        bgBtn.style.boxShadow = '';
    });

    bgBtn.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        bgBtn.style.boxShadow = '';

        const draggedData = e.dataTransfer.getData('text/plain');
        if (draggedData !== 'background') {
            // Swapping pattern color with background
            const patternIndex = parseInt(draggedData);
            if (!isNaN(patternIndex) && patternIndex >= 0 && patternIndex < patternColors.length) {
                const temp = backgroundColor;
                backgroundColor = patternColors[patternIndex];
                patternColors[patternIndex] = temp;

                saveToHistory();
                createNavbarColorButtons();
                updateCanvas();
                updateColorIndicators();
                saveToLocalStorage();
                announceToScreenReader(`Swapped pattern color ${patternIndex + 1} with background color`);
            }
        }
    });

    // Touch drag support and long-press for background button
    let bgTouchDragInProgress = false;
    let bgTouchStartX = 0;
    let bgTouchStartY = 0;
    let bgLongPressTimer = null;
    let bgIsLongPress = false;

    bgBtn.addEventListener('touchstart', (e) => {
        bgTouchStartX = e.touches[0].clientX;
        bgTouchStartY = e.touches[0].clientY;
        bgTouchDragInProgress = false;
        bgIsLongPress = false;

        // Start long-press timer
        bgLongPressTimer = setTimeout(() => {
            bgIsLongPress = true;
            // Toggle background as active drawing color
            isBackgroundActive = !isBackgroundActive;
            updateActiveColorUI();
            // Provide haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }, 500); // 500ms for long press
    }, { passive: true });

    bgBtn.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - bgTouchStartX);
        const deltaY = Math.abs(touch.clientY - bgTouchStartY);

        if (deltaX > 5 || deltaY > 5) {
            // Cancel long-press if user starts dragging
            if (bgLongPressTimer) {
                clearTimeout(bgLongPressTimer);
                bgLongPressTimer = null;
            }

            if (!bgTouchDragInProgress) {
                bgTouchDragInProgress = true;
                bgBtn.style.opacity = '0.5';
            }

            // Find element under touch point
            const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
            if (elementUnder && elementUnder.classList.contains('navbar-color-btn') &&
                elementUnder !== bgBtn && !elementUnder.classList.contains('add-btn') &&
                !elementUnder.classList.contains('square')) {
                // Highlight pattern color button for swap
                elementUnder.style.boxShadow = '0 0 0 3px var(--color-primary)';
            } else {
                // Reset all pattern buttons
                document.querySelectorAll('.navbar-color-btn').forEach(b => {
                    if (!b.classList.contains('square') && !b.classList.contains('add-btn')) {
                        b.style.boxShadow = '';
                    }
                });
            }
        }
    }, { passive: true });

    bgBtn.addEventListener('touchend', (e) => {
        // Clear long-press timer
        if (bgLongPressTimer) {
            clearTimeout(bgLongPressTimer);
            bgLongPressTimer = null;
        }

        // If it was a long press, prevent normal click behavior
        if (bgIsLongPress) {
            e.preventDefault();
            bgIsLongPress = false;
            return;
        }

        if (bgTouchDragInProgress) {
            e.preventDefault();
            bgBtn.style.opacity = '1';

            const touch = e.changedTouches[0];
            const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);

            if (elementUnder && elementUnder.classList.contains('navbar-color-btn') &&
                !elementUnder.classList.contains('add-btn') && !elementUnder.classList.contains('square')) {
                const targetIndex = parseInt(elementUnder.getAttribute('data-index'));
                if (!isNaN(targetIndex)) {
                    // Swap background with pattern color
                    const temp = backgroundColor;
                    backgroundColor = patternColors[targetIndex];
                    patternColors[targetIndex] = temp;

                    saveToHistory();
                    createNavbarColorButtons();
                    updateCanvas();
                    updateColorIndicators();
                    saveToLocalStorage();
                    announceToScreenReader(`Swapped background color with pattern color ${targetIndex + 1}`);
                }
            }

            // Reset all buttons
            document.querySelectorAll('.navbar-color-btn').forEach(b => {
                b.style.boxShadow = '';
            });

            bgTouchDragInProgress = false;
        }
    });

    container.appendChild(bgBtn);
}

/**
 * Open color picker for a specific pattern color
 */
function openColorPicker(colorIndex, currentColor) {
    // Create a temporary color input
    const input = document.createElement('input');
    input.type = 'color';
    input.value = currentColor;
    input.style.position = 'absolute';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', (e) => {
        const newColor = e.target.value;
        if (validateColor(newColor)) {
            patternColors[colorIndex] = newColor;
            createNavbarColorButtons();
                    updateCanvas();
            updateColorIndicators();
            saveToHistory();
            saveToLocalStorage();
        }
        document.body.removeChild(input);
    });

    input.click();
}

/**
 * Open color picker for background color
 */
function openBackgroundColorPicker() {
    const input = document.createElement('input');
    input.type = 'color';
    input.value = backgroundColor;
    input.style.position = 'absolute';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', (e) => {
        const newColor = e.target.value;
        if (validateColor(newColor)) {
            backgroundColor = newColor;
            createNavbarColorButtons();
            updateCanvas();
            updateColorIndicators();
            saveToHistory();
            saveToLocalStorage();
        }
        document.body.removeChild(input);
    });

    input.click();
}

/**
 * Set up hamburger menu toggle
 */
function setupHamburgerMenu() {
    const hamburgerBtn = document.getElementById('navbarHamburgerBtn');
    const hamburgerMenu = document.getElementById('navbarHamburgerMenu');

    if (!hamburgerBtn || !hamburgerMenu) return;

    hamburgerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = hamburgerMenu.classList.toggle('open');
        hamburgerBtn.setAttribute('aria-expanded', isOpen);
    });

    // Close menu when clicking menu items (but not expandable ones)
    const menuItems = hamburgerMenu.querySelectorAll('.navbar-hamburger-item:not(.navbar-hamburger-expandable)');
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            hamburgerMenu.classList.remove('open');
            hamburgerBtn.setAttribute('aria-expanded', 'false');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!hamburgerMenu.contains(e.target) && !hamburgerBtn.contains(e.target)) {
            hamburgerMenu.classList.remove('open');
            hamburgerBtn.setAttribute('aria-expanded', 'false');
        }
    });
}

/**
 * Set up navbar palette dropdown
 */
function setupNavbarPaletteDropdown() {
    const dropdownBtn = document.getElementById('navbarPaletteDropdownBtn');
    const dropdownContainer = document.querySelector('.navbar-palette-dropdown-container');
    const paletteGrid = document.getElementById('navbarPaletteGrid');
    const loadBtn = document.getElementById('navbarLoadPaletteBtn');
    const paletteOptions = document.querySelectorAll('.navbar-palette-option');

    if (!dropdownBtn || !dropdownContainer) return;

    // Toggle dropdown
    dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdownContainer.classList.toggle('open');
        dropdownBtn.setAttribute('aria-expanded', isOpen);
        if (isOpen) {
            renderNavbarPalette();
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdownContainer.contains(e.target)) {
            dropdownContainer.classList.remove('open');
            dropdownBtn.setAttribute('aria-expanded', 'false');
        }
    });

    // Load palette button
    if (loadBtn) {
        loadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const builtInPalette = CONFIG.BUILT_IN_PALETTES[activePaletteId];
            const currentPalette = builtInPalette ? builtInPalette.colors : customPalette;
            if (currentPalette) {
                patternColors = [...currentPalette];
                if (activePatternIndex >= patternColors.length) {
                    activePatternIndex = 0;
                }
                createNavbarColorButtons();
                            updateActiveColorUI();
                updateCanvas();
                saveToHistory();
                saveToLocalStorage();
                announceToScreenReader(`Loaded ${activePaletteId} palette to pattern colors`);
            }
        });
    }

    // Palette selector options
    paletteOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            const paletteId = option.getAttribute('data-palette');
            switchPalette(paletteId);
            renderNavbarPalette();
            updateNavbarPaletteName();
            updateNavbarPalettePreview();

            // Update active state
            paletteOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
        });
    });
}

/**
 * Render palette grid in navbar dropdown
 */
function renderNavbarPalette() {
    const paletteGrid = document.getElementById('navbarPaletteGrid');
    if (!paletteGrid) return;

    paletteGrid.innerHTML = '';
    const builtInPalette = CONFIG.BUILT_IN_PALETTES[activePaletteId];
    const currentPalette = builtInPalette ? builtInPalette.colors : (customPalette || []);
    const isCustomPalette = !builtInPalette;

    currentPalette.forEach((color, index) => {
        const colorDiv = document.createElement('div');
        colorDiv.className = 'navbar-palette-color';
        colorDiv.style.backgroundColor = color;
        colorDiv.setAttribute('aria-label', `Palette color ${index + 1}: ${color}`);

        // Long press support for touch devices
        let pressTimer = null;
        let isLongPress = false;

        const setBackgroundColorValue = () => {
            backgroundColor = color;
            createNavbarColorButtons();
            updateCanvas();
            updateColorIndicators();
            saveToHistory();
            saveToLocalStorage();
        };

        // For custom palette, clicking shows menu. For built-in, clicking applies color
        // Shift-click or long press sets background color
        if (isCustomPalette) {
            colorDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                // Ignore if this was a long press (already handled)
                if (isLongPress) {
                    isLongPress = false;
                    return;
                }

                if (e.shiftKey) {
                    // Shift-click sets background color
                    setBackgroundColorValue();
                } else {
                    // Regular click shows menu
                    showPaletteColorMenu(colorDiv, index, color);
                }
            });

            // Touch long press for background color
            colorDiv.addEventListener('touchstart', (e) => {
                isLongPress = false;
                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    setBackgroundColorValue();
                    // Haptic feedback if available
                    if (navigator.vibrate) {
                        navigator.vibrate(UI_CONSTANTS.HAPTIC_FEEDBACK_DURATION);
                    }
                }, UI_CONSTANTS.LONG_PRESS_DURATION);
            }, { passive: true });

            colorDiv.addEventListener('touchend', (e) => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
                // If it was a long press, prevent the click event
                if (isLongPress) {
                    e.preventDefault();
                    setTimeout(() => {
                        isLongPress = false;
                    }, UI_CONSTANTS.COLOR_PICKER_FADE_DELAY);
                }
            });

            colorDiv.addEventListener('touchmove', () => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
                isLongPress = false;
            }, { passive: true });
        } else {
            colorDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                // Ignore if this was a long press (already handled)
                if (isLongPress) {
                    isLongPress = false;
                    return;
                }

                if (e.shiftKey) {
                    // Shift-click sets background color
                    setBackgroundColorValue();
                } else {
                    // Regular click sets active pattern color
                    patternColors[activePatternIndex] = color;
                    createNavbarColorButtons();
                                    updateActiveColorUI();
                    updateCanvas();
                    saveToHistory();
                    saveToLocalStorage();
                }
            });

            // Touch long press for background color (built-in palettes)
            colorDiv.addEventListener('touchstart', (e) => {
                isLongPress = false;
                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    setBackgroundColorValue();
                    // Haptic feedback if available
                    if (navigator.vibrate) {
                        navigator.vibrate(UI_CONSTANTS.HAPTIC_FEEDBACK_DURATION);
                    }
                }, UI_CONSTANTS.LONG_PRESS_DURATION);
            }, { passive: true });

            colorDiv.addEventListener('touchend', (e) => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
                // If it was a long press, prevent the click event
                if (isLongPress) {
                    e.preventDefault();
                    setTimeout(() => {
                        isLongPress = false;
                    }, UI_CONSTANTS.COLOR_PICKER_FADE_DELAY);
                }
            });

            colorDiv.addEventListener('touchmove', () => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
                isLongPress = false;
            }, { passive: true });
        }

        paletteGrid.appendChild(colorDiv);
    });

    // Add "+" button for custom palette (if not at max)
    if (isCustomPalette && currentPalette.length < CONFIG.MAX_PALETTE_COLORS) {
        const addBtn = document.createElement('div');
        addBtn.className = 'navbar-palette-color navbar-palette-add-btn';
        addBtn.textContent = '+';
        addBtn.setAttribute('aria-label', 'Add palette color');
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addCustomPaletteColor();
        });
        paletteGrid.appendChild(addBtn);
    }
}

/**
 * Show menu for custom palette color with Select/Edit/Delete options
 */
function showPaletteColorMenu(colorElement, colorIndex, color) {
    // Close any existing menu
    closePaletteColorMenu();

    const menu = document.createElement('div');
    menu.className = 'navbar-palette-color-menu';
    menu.setAttribute('role', 'menu');

    // Select option - apply this color to active pattern color
    const selectBtn = document.createElement('button');
    selectBtn.className = 'navbar-color-menu-item';
    selectBtn.textContent = 'Select';
    selectBtn.setAttribute('role', 'menuitem');
    selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        patternColors[activePatternIndex] = color;
        createNavbarColorButtons();
            updateActiveColorUI();
        updateCanvas();
        saveToHistory();
        saveToLocalStorage();
        closePaletteColorMenu();
    });
    menu.appendChild(selectBtn);

    // Edit option
    const editBtn = document.createElement('button');
    editBtn.className = 'navbar-color-menu-item';
    editBtn.textContent = 'Edit';
    editBtn.setAttribute('role', 'menuitem');
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Get dropdown elements before opening picker
        const dropdownContainer = document.querySelector('.navbar-palette-dropdown-container');
        const dropdownBtn = document.getElementById('navbarPaletteDropdownBtn');

        // Open color picker FIRST (while user gesture is active)
        editCustomPaletteColor(colorIndex, color, () => {
            // Reopen dropdown after color picker closes
            if (dropdownContainer) {
                dropdownContainer.classList.add('open');
            }
            if (dropdownBtn) {
                dropdownBtn.setAttribute('aria-expanded', 'true');
            }
        });

        // THEN close menu and dropdown
        closePaletteColorMenu();
        if (dropdownContainer) {
            dropdownContainer.classList.remove('open');
        }
        if (dropdownBtn) {
            dropdownBtn.setAttribute('aria-expanded', 'false');
        }
    });
    menu.appendChild(editBtn);

    // Delete option (only if not the last color)
    if (customPalette && customPalette.length > 1) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'navbar-color-menu-item navbar-color-menu-item-danger';
        deleteBtn.textContent = 'Delete';
        deleteBtn.setAttribute('role', 'menuitem');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteCustomPaletteColor(colorIndex);
            closePaletteColorMenu();
            // Keep the palette dropdown open after delete
        });
        menu.appendChild(deleteBtn);
    }

    // Position menu below color
    const rect = colorElement.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.left = `${rect.left + rect.width / 2}px`;
    menu.style.transform = 'translateX(-50%)';

    document.body.appendChild(menu);
    currentPaletteColorMenu = menu;

    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', closePaletteColorMenu);
    }, 0);
}

// Track currently open palette color menu
let currentPaletteColorMenu = null;

/**
 * Close the palette color menu
 */
function closePaletteColorMenu() {
    if (currentPaletteColorMenu) {
        document.removeEventListener('click', closePaletteColorMenu);
        currentPaletteColorMenu.remove();
        currentPaletteColorMenu = null;
    }
}

/**
 * Add a new color to custom palette
 */
function addCustomPaletteColor() {
    if (!customPalette) {
        customPalette = ['#000000'];
    } else if (customPalette.length < CONFIG.MAX_PALETTE_COLORS) {
        customPalette.push('#000000');
    }
    renderNavbarPalette();
    updateNavbarPalettePreview();
    saveToLocalStorage();
}

/**
 * Edit a custom palette color
 * @param {number} colorIndex - Index of the color to edit
 * @param {string} currentColor - Current color value
 * @param {Function} onComplete - Optional callback when color picker closes
 */
function editCustomPaletteColor(colorIndex, currentColor, onComplete) {
    if (!customPalette) return;

    const input = document.createElement('input');
    input.type = 'color';
    input.value = currentColor;
    input.style.position = 'absolute';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    document.body.appendChild(input);

    const cleanup = () => {
        document.body.removeChild(input);
        if (onComplete) {
            onComplete();
        }
    };

    input.addEventListener('change', (e) => {
        const newColor = e.target.value;
        if (validateColor(newColor)) {
            customPalette[colorIndex] = newColor;
            renderNavbarPalette();
            updateNavbarPalettePreview();
            saveToLocalStorage();
        }
        cleanup();
    });

    // Handle cancel (when user closes picker without selecting)
    input.addEventListener('cancel', () => {
        cleanup();
    });

    input.click();
}

/**
 * Delete a custom palette color
 */
function deleteCustomPaletteColor(colorIndex) {
    if (!customPalette || customPalette.length <= 1) return;

    customPalette.splice(colorIndex, 1);
    renderNavbarPalette();
    updateNavbarPalettePreview();
    saveToLocalStorage();
}

/**
 * Update navbar palette name display and preview
 */
function updateNavbarPaletteName() {
    const paletteNameEl = document.getElementById('navbarPaletteName');
    if (paletteNameEl) {
        const capitalizedName = activePaletteId.charAt(0).toUpperCase() + activePaletteId.slice(1);
        paletteNameEl.textContent = capitalizedName;
    }

    // Update active state of palette options
    const paletteOptions = document.querySelectorAll('.navbar-palette-option');
    paletteOptions.forEach(option => {
        if (option.getAttribute('data-palette') === activePaletteId) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });

    // Update 2x2 palette preview
    updateNavbarPalettePreview();
}

/**
 * Update the 2x2 palette preview in the navbar
 */
function updateNavbarPalettePreview() {
    const previewContainer = document.getElementById('navbarPalettePreview');
    if (!previewContainer) return;

    previewContainer.innerHTML = '';

    // Get current palette colors
    const builtInPalette = CONFIG.BUILT_IN_PALETTES[activePaletteId];
    const currentPalette = builtInPalette ? builtInPalette.colors : (customPalette || []);

    // Show first 4 colors (or defaults if fewer)
    const defaultColor = '#cccccc';
    const previewColors = [
        currentPalette[0] || defaultColor,
        currentPalette[1] || defaultColor,
        currentPalette[2] || defaultColor,
        currentPalette[3] || defaultColor
    ];

    // Create 2x2 grid
    previewColors.forEach(color => {
        const colorDiv = document.createElement('div');
        colorDiv.className = 'navbar-palette-preview-color';
        colorDiv.style.backgroundColor = color;
        previewContainer.appendChild(colorDiv);
    });
}

// ============================================
// GLOBAL ERROR HANDLING
// ============================================

// Set up global error handlers for unhandled errors
setupGlobalErrorHandler();
