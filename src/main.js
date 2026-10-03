// ============================================
// MAIN APPLICATION
// ============================================

import { CONFIG, UI_CONSTANTS } from './config.js';
import { Utils } from './utils.js';
import { StorageManager } from './managers/storage.js';
import { HistoryManager } from './managers/history.js';
import { CanvasManager } from './managers/canvas.js';
import { createEmptyGrid, resizeGrid, resizeGridFromEdge } from './core/grid.js';
import { exportSvg, exportPng, exportPreviewSvg, exportPreviewPng, exportPatternWithContextSvg, exportPatternWithContextPng, exportJson, importJson, downloadFile, sanitizeGrid } from './core/export.js';
import { generateShareUrl, parseShareUrl, copyToClipboard, validateShareData } from './utils/sharing.js';
import {
    validateGridDimension,
    validateAspectRatio,
    validatePreviewRepeat,
    validateColor,
    validateImportData,
    validateFileSize,
    validateFileType
} from './utils/validation.js';
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
import { setupTooltips } from './ui/tooltip.js';
import { createKey } from './ui/key.js';

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
let key = null; // The key under the chart, created at initialisation

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
        const layout = CanvasManager.update(gridWidth, gridHeight, aspectRatio, previewRepeatX, previewRepeatY,
                            grid, patternColors, backgroundColor,
                            { outlineRepeat: !visualContextSelectionActive });
        applyPlateLayout(layout);
        updateButtons();
    } catch (error) {
        handleCanvasError(error, 'update canvas');
    }
}

/**
 * Arrange the plate for the layout the canvas manager chose, and keep the preview's
 * caption in step with it
 * @param {{stacked: boolean, previewWidth: number, outlined: boolean}} layout
 */
function applyPlateLayout(layout) {
    const plate = document.getElementById('plate');
    const wasStacked = plate.classList.contains('is-stacked');
    plate.classList.toggle('is-stacked', layout.stacked);
    // The key's row has one place fewer when stacked
    if (wasStacked !== layout.stacked) renderKey();
    document.getElementById('previewCaptionLine').style.setProperty('--preview-width', `${layout.previewWidth}px`);
    document.getElementById('previewTotal').textContent =
        `, ${gridWidth * previewRepeatX} stitches by ${gridHeight * previewRepeatY} rows in all.`;
    document.getElementById('previewOutlineNote').hidden = !layout.outlined;
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
    renderKey();
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
        renderKey();
        updateCanvas();
    });
}

/**
 * Redraw the key (colours, background, palette) and its hint line
 */
function renderKey() {
    if (key) key.render();
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
        if (display) display.value = previewRepeatX;
        repeatReduced = true;
    }

    if (previewRepeatY > maxRepeat) {
        previewRepeatY = maxRepeat;
        const display = document.getElementById('previewRepeatYDisplay');
        if (display) display.value = previewRepeatY;
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
    if (inlineWidthDisplay) inlineWidthDisplay.value = gridWidth;
    if (inlineHeightDisplay) inlineHeightDisplay.value = gridHeight;

    // Check if preview repeats need to be reduced due to larger pattern
    const maxRepeat = getMaxPreviewRepeat(gridWidth, gridHeight);
    let repeatReduced = false;

    if (previewRepeatX > maxRepeat) {
        previewRepeatX = maxRepeat;
        const display = document.getElementById('previewRepeatXDisplay');
        if (display) display.value = previewRepeatX;
        repeatReduced = true;
    }

    if (previewRepeatY > maxRepeat) {
        previewRepeatY = maxRepeat;
        const display = document.getElementById('previewRepeatYDisplay');
        if (display) display.value = previewRepeatY;
        repeatReduced = true;
    }

    if (repeatReduced) {
        showPreviewToast(`Preview reduced to max for ${gridWidth}×${gridHeight} pattern (${maxRepeat}×${maxRepeat})`);
        saveToLocalStorage();
    }

    saveToHistory();
    updateCanvas();
    updatePreviewRepeatStatus();
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
        if (inlineWidthDisplay) inlineWidthDisplay.value = gridWidth;
        if (inlineHeightDisplay) inlineHeightDisplay.value = gridHeight;

        // Check if preview repeats need to be reduced due to larger pattern
        const maxRepeat = getMaxPreviewRepeat(gridWidth, gridHeight);
        let repeatReduced = false;

        if (previewRepeatX > maxRepeat) {
            previewRepeatX = maxRepeat;
            const display = document.getElementById('previewRepeatXDisplay');
            if (display) display.value = previewRepeatX;
            repeatReduced = true;
        }

        if (previewRepeatY > maxRepeat) {
            previewRepeatY = maxRepeat;
            const display = document.getElementById('previewRepeatYDisplay');
            if (display) display.value = previewRepeatY;
            repeatReduced = true;
        }

        if (repeatReduced) {
            showPreviewToast(`Preview reduced to max for ${gridWidth}×${gridHeight} pattern (${maxRepeat}×${maxRepeat})`);
            saveToLocalStorage();
        }

        renderKey();
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
        if (inlineWidthDisplay) inlineWidthDisplay.value = gridWidth;
        if (inlineHeightDisplay) inlineHeightDisplay.value = gridHeight;

        // Check if preview repeats need to be reduced due to larger pattern
        const maxRepeat = getMaxPreviewRepeat(gridWidth, gridHeight);
        let repeatReduced = false;

        if (previewRepeatX > maxRepeat) {
            previewRepeatX = maxRepeat;
            const display = document.getElementById('previewRepeatXDisplay');
            if (display) display.value = previewRepeatX;
            repeatReduced = true;
        }

        if (previewRepeatY > maxRepeat) {
            previewRepeatY = maxRepeat;
            const display = document.getElementById('previewRepeatYDisplay');
            if (display) display.value = previewRepeatY;
            repeatReduced = true;
        }

        if (repeatReduced) {
            showPreviewToast(`Preview reduced to max for ${gridWidth}×${gridHeight} pattern (${maxRepeat}×${maxRepeat})`);
            saveToLocalStorage();
        }

        renderKey();
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


// Share modal controls
const shareModal = document.getElementById('shareModal');
const shareBtn = document.getElementById('shareBtn');
const shareModalCancelBtn = document.getElementById('shareModalCancelBtn');
const shareUrlInput = document.getElementById('shareUrlInput');
const copyShareUrlBtn = document.getElementById('copyShareUrlBtn');
const shareWarning = document.getElementById('shareWarning');

// Open share modal and generate share URL
shareBtn.onclick = async () => {
    showLoading('Generating share link...');

    const result = await generateShareUrl(getState());

    hideLoading();

    if (!result.success) {
        showError(result.error || 'Failed to generate share URL');
        return;
    }

    // Show modal
    shareModal.style.display = 'flex';

    // Populate URL
    shareUrlInput.value = result.url;

    // Show warning if present
    if (result.warning) {
        shareWarning.textContent = result.warning;
        shareWarning.style.display = 'block';
    } else {
        shareWarning.style.display = 'none';
    }

    // Select URL for easy copying
    shareUrlInput.select();
    shareUrlInput.focus();
};

// Copy share URL to clipboard
copyShareUrlBtn.onclick = async () => {
    const url = shareUrlInput.value;
    const success = await copyToClipboard(url);

    if (success) {
        // Visual feedback
        copyShareUrlBtn.textContent = 'Copied!';
        copyShareUrlBtn.classList.add('btn-success');
        announceToScreenReader('Share URL copied to clipboard');

        // Reset button after delay
        setTimeout(() => {
            copyShareUrlBtn.textContent = 'Copy to clipboard';
            copyShareUrlBtn.classList.remove('btn-success');
        }, 2000);
    } else {
        showError('Failed to copy to clipboard. Please copy manually.');
    }
};

// Close share modal
shareModalCancelBtn.onclick = () => {
    shareModal.style.display = 'none';
};

// Close modal on backdrop click
shareModal.onclick = (e) => {
    if (e.target === shareModal) {
        shareModal.style.display = 'none';
    }
};

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
        updateSizePreview();
    });
});

// Size controls
const sizeControls = document.getElementById('sizeControls');
const customSizeControls = document.getElementById('customSizeControls');
const cellSizeSlider = document.getElementById('cellSizeSlider');
const cellSizeInput = document.getElementById('cellSizeInput');
const sizePreview = document.getElementById('sizePreview');
const currentSizeLabel = document.getElementById('currentSizeLabel');

// Toggle size controls visibility based on format selection
const formatRadios = document.querySelectorAll('input[name="format"]');
formatRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        if (radio.value === 'png' && radio.checked) {
            sizeControls.style.display = 'block';
        } else {
            sizeControls.style.display = 'none';
        }
    });
});

// Toggle custom size controls based on size selection
const sizeRadios = document.querySelectorAll('input[name="size"]');
sizeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        if (radio.value === 'custom' && radio.checked) {
            customSizeControls.style.display = 'block';
            updateSizePreview();
        } else {
            customSizeControls.style.display = 'none';
        }
    });
});

// Sync slider and input
cellSizeSlider.addEventListener('input', () => {
    cellSizeInput.value = cellSizeSlider.value;
    updateSizePreview();
});

cellSizeInput.addEventListener('input', () => {
    const value = parseInt(cellSizeInput.value);
    if (!isNaN(value)) {
        cellSizeSlider.value = value;
        updateSizePreview();
    }
});

// Row counts checkbox changes affect dimensions
const rowCountsCheckbox = document.getElementById('rowCountsCheckbox');
rowCountsCheckbox.addEventListener('change', updateSizePreview);

// Calculate and display dimension preview
function updateSizePreview() {
    const source = document.querySelector('input[name="source"]:checked')?.value;
    const sizeMode = document.querySelector('input[name="size"]:checked')?.value;
    const includeRowCounts = rowCountsCheckbox.checked;

    if (sizeMode === 'custom') {
        const cellSize = parseInt(cellSizeInput.value);
        const dims = calculateExportDimensions(source, cellSize, includeRowCounts);
        if (dims === null) {
            sizePreview.textContent = 'Export size depends on selected surroundings';
        } else {
            const cellH = Math.round(cellSize * aspectRatio);
            const breakdown = cellSize === cellH
                ? `${dims.cols} × ${dims.rows} cells at ${cellSize}px`
                : `${dims.cols} × ${dims.rows} cells at ${cellSize}×${cellH}px`;
            sizePreview.textContent = `Export: ${dims.width}×${dims.height}px (${breakdown})`;
        }
    }
}

// Calculate export dimensions based on source, cell size, and options
function calculateExportDimensions(source, cellSize, includeRowCounts) {
    const cellHeight = cellSize * aspectRatio;
    const fontSize = cellHeight * 0.6;
    const rowCountMargin = includeRowCounts ? Math.max(40, Math.round(fontSize * 2.2)) : 0;
    const cellWidth = cellSize;
    let width, height, cols, rows;

    if (source === 'pattern') {
        cols = gridWidth;
        rows = gridHeight;
        width = Math.round(cols * cellWidth) + rowCountMargin;
        height = Math.round(rows * cellHeight);
    } else if (source === 'pattern-with-context') {
        const contextLeft = parseInt(document.getElementById('contextLeft')?.value) || 0;
        const contextRight = parseInt(document.getElementById('contextRight')?.value) || 0;
        const contextTop = parseInt(document.getElementById('contextTop')?.value) || 0;
        const contextBottom = parseInt(document.getElementById('contextBottom')?.value) || 0;

        // Only show dimensions if context values are set
        if (contextLeft === 0 && contextRight === 0 && contextTop === 0 && contextBottom === 0) {
            return null; // Signal that dimensions can't be determined yet
        }

        cols = Math.min(contextLeft, gridWidth - 1) + gridWidth + Math.min(contextRight, gridWidth - 1);
        rows = Math.min(contextTop, gridHeight - 1) + gridHeight + Math.min(contextBottom, gridHeight - 1);

        width = Math.round(cols * cellWidth) + rowCountMargin;
        height = Math.round(rows * cellHeight);
    } else if (source === 'preview') {
        cols = gridWidth * previewRepeatX;
        rows = gridHeight * previewRepeatY;

        width = Math.round(cols * cellWidth) + rowCountMargin;
        height = Math.round(rows * cellHeight);
    }

    return { width, height, cols, rows };
}

// Update cell size constraints based on current pattern
function updateCellSizeConstraints() {
    const source = document.querySelector('input[name="source"]:checked')?.value;
    let totalCols, totalRows;

    if (source === 'pattern') {
        totalCols = gridWidth;
        totalRows = gridHeight;
    } else if (source === 'pattern-with-context') {
        const contextLeft = parseInt(document.getElementById('contextLeft')?.value) || 0;
        const contextRight = parseInt(document.getElementById('contextRight')?.value) || 0;
        const contextTop = parseInt(document.getElementById('contextTop')?.value) || 0;
        const contextBottom = parseInt(document.getElementById('contextBottom')?.value) || 0;

        totalCols = Math.min(contextLeft, gridWidth - 1) + gridWidth + Math.min(contextRight, gridWidth - 1);
        totalRows = Math.min(contextTop, gridHeight - 1) + gridHeight + Math.min(contextBottom, gridHeight - 1);
    } else if (source === 'preview') {
        totalCols = gridWidth * previewRepeatX;
        totalRows = gridHeight * previewRepeatY;
    }

    // Cap so neither pixel dimension exceeds 4000px, accounting for aspect ratio
    const maxFromWidth = 4000 / totalCols;
    const maxFromHeight = 4000 / (totalRows * aspectRatio);
    const maxCellSize = Math.floor(Math.min(maxFromWidth, maxFromHeight));
    cellSizeSlider.max = maxCellSize;
    cellSizeInput.max = maxCellSize;

    // Adjust current value if it exceeds new max
    if (parseInt(cellSizeInput.value) > maxCellSize) {
        cellSizeInput.value = maxCellSize;
        cellSizeSlider.value = maxCellSize;
    }

    updateSizePreview();
}

// Update current display label with actual dimensions
function updateCurrentDisplayLabel() {
    const source = document.querySelector('input[name="source"]:checked')?.value;
    let canvas;

    if (source === 'preview') {
        canvas = document.getElementById('previewCanvas');
    } else {
        // For both 'pattern' and 'pattern-with-context', show editCanvas dimensions
        // (pattern-with-context will be different after visual/form selection, but we show base pattern size here)
        canvas = document.getElementById('editCanvas');
    }

    const displayWidth = Math.round(canvas.width);
    const displayHeight = Math.round(canvas.height);

    currentSizeLabel.textContent = `Current display (${displayWidth}×${displayHeight}px)`;
}

// Context input event listeners for updating size constraints
const contextInputs = ['contextLeft', 'contextRight', 'contextTop', 'contextBottom'];
contextInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
        input.addEventListener('input', () => {
            updateCellSizeConstraints();
        });
    }
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

    // Update size controls
    updateCellSizeConstraints();
    updateCurrentDisplayLabel();
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

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (shareModal.style.display === 'flex') {
            shareModal.style.display = 'none';
        }
        if (downloadModal.style.display === 'flex') {
            downloadModal.style.display = 'none';
        }
    }
});

// Handle download form submission
downloadForm.onsubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData(downloadForm);
    const source = formData.get('source');
    const format = formData.get('format');
    const includeRowCounts = formData.get('rowCounts') === 'on';
    const sizeMode = formData.get('size');
    const customCellSize = sizeMode === 'custom' ? parseInt(cellSizeInput.value) : null;

    // Close modal
    downloadModal.style.display = 'none';

    // If pattern-with-context is selected, check if we can use visual selection
    if (source === 'pattern-with-context') {
        const maxRepeat = getMaxPreviewRepeat(gridWidth, gridHeight);

        // Use visual selection if pattern supports 3x3 preview
        if (maxRepeat >= 3) {
            enterVisualContextSelection(format, includeRowCounts, customCellSize);
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
                    filename = `motif-pattern-surroundings-${gridWidth}x${gridHeight}.svg`;
                } else {
                    blob = await exportPatternWithContextPng(getState(), context, includeRowCounts, customCellSize);
                    filename = `motif-pattern-surroundings-${gridWidth}x${gridHeight}.png`;
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
                blob = await exportPng(getState(), includeRowCounts, customCellSize);
                filename = `motif-pattern-${gridWidth}x${gridHeight}.png`;
            }
        } else {
            // Preview export
            if (format === 'svg') {
                blob = exportPreviewSvg(getState(), includeRowCounts);
                filename = `motif-preview-${gridWidth}x${gridHeight}-${previewRepeatX}x${previewRepeatY}.svg`;
            } else {
                blob = await exportPreviewPng(getState(), includeRowCounts, customCellSize);
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
let selectionCustomCellSize = null;
let draggingEdge = null;
let dragStartPos = { x: 0, y: 0 };

/**
 * Enter visual context selection mode
 */
function enterVisualContextSelection(format, includeRowCounts, customCellSize = null) {
    // Save current state
    savedPreviewRepeatX = previewRepeatX;
    savedPreviewRepeatY = previewRepeatY;
    selectionFormat = format;
    selectionIncludeRowCounts = includeRowCounts;
    selectionCustomCellSize = customCellSize;
    contextSelection = { left: 0, right: 0, top: 0, bottom: 0 };
    visualContextSelectionActive = true;

    // Switch to 3x3 preview
    previewRepeatX = 3;
    previewRepeatY = 3;

    // Update preview repeat displays
    const inlineRepeatXDisplay = document.getElementById('previewRepeatXDisplay');
    const inlineRepeatYDisplay = document.getElementById('previewRepeatYDisplay');
    if (inlineRepeatXDisplay) inlineRepeatXDisplay.value = previewRepeatX;
    if (inlineRepeatYDisplay) inlineRepeatYDisplay.value = previewRepeatY;

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
    if (inlineRepeatXDisplay) inlineRepeatXDisplay.value = previewRepeatX;
    if (inlineRepeatYDisplay) inlineRepeatYDisplay.value = previewRepeatY;

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

    // Draw black box around center repeat
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 6;
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
    const customCellSize = selectionCustomCellSize;
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
            filename = `motif-pattern-surroundings-${gridWidth}x${gridHeight}.svg`;
        } else {
            blob = await exportPatternWithContextPng(getState(), context, includeRowCounts, customCellSize);
            filename = `motif-pattern-surroundings-${gridWidth}x${gridHeight}.png`;
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

    // Use larger touch target for touch events (30px) vs mouse (10px)
    const threshold = e.touches ? 30 : 10;

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
                    if (inlineWidthDisplay) inlineWidthDisplay.value = gridWidth;
                    if (inlineHeightDisplay) inlineHeightDisplay.value = gridHeight;

                    const inlineRepeatXDisplay = document.getElementById('previewRepeatXDisplay');
                    const inlineRepeatYDisplay = document.getElementById('previewRepeatYDisplay');
                    if (inlineRepeatXDisplay) inlineRepeatXDisplay.value = previewRepeatX;
                    if (inlineRepeatYDisplay) inlineRepeatYDisplay.value = previewRepeatY;

                                    renderKey();
                    updatePaletteUI();
                    renderKey();

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
        getCurrentValue: () => gridWidth
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
        getCurrentValue: () => gridHeight
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
        }
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
        }
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

// Helper function to update UI displays after data changes
function updateUIDisplaysForSharedPattern() {
    // Update inline displays
    const inlineWidthDisplay = document.getElementById('gridWidthDisplay');
    const inlineHeightDisplay = document.getElementById('gridHeightDisplay');
    if (inlineWidthDisplay) inlineWidthDisplay.value = gridWidth;
    if (inlineHeightDisplay) inlineHeightDisplay.value = gridHeight;

    const inlineRepeatXDisplay = document.getElementById('previewRepeatXDisplay');
    const inlineRepeatYDisplay = document.getElementById('previewRepeatYDisplay');
    if (inlineRepeatXDisplay) inlineRepeatXDisplay.value = previewRepeatX;
    if (inlineRepeatYDisplay) inlineRepeatYDisplay.value = previewRepeatY;

    // Re-render UI with shared pattern data
    updatePaletteUI();
    renderKey();

    // Re-initialize grid with shared data
    initGrid();
}

// Check for shared pattern in URL (takes priority over localStorage)
const shareUrlResult = parseShareUrl();
if (!shareUrlResult.success) {
    // Show error to user if parsing failed
    showError(shareUrlResult.userMessage);
} else if (shareUrlResult.data && validateShareData(shareUrlResult.data)) {
    try {
        // Apply shared pattern data directly (we already have the parsed JSON)
        const patternData = shareUrlResult.data;

        // Validate and apply the data
        if (patternData.grid && patternData.colors) {
            gridWidth = Utils.clampInt(
                patternData.grid.width,
                CONFIG.MIN_GRID_SIZE,
                CONFIG.MAX_GRID_SIZE,
                CONFIG.DEFAULT_GRID_WIDTH
            );
            gridHeight = Utils.clampInt(
                patternData.grid.height,
                CONFIG.MIN_GRID_SIZE,
                CONFIG.MAX_GRID_SIZE,
                CONFIG.DEFAULT_GRID_HEIGHT
            );
            aspectRatio = Utils.clampFloat(
                patternData.grid.aspectRatio,
                CONFIG.MIN_ASPECT_RATIO,
                CONFIG.MAX_ASPECT_RATIO,
                CONFIG.DEFAULT_ASPECT_RATIO
            );
            grid = patternData.grid.cells
                ? sanitizeGrid(patternData.grid.cells)
                : createEmptyGrid(gridWidth, gridHeight);
            backgroundColor = patternData.colors.background || CONFIG.DEFAULT_BACKGROUND_COLOR;
            patternColors = patternData.colors.pattern || [CONFIG.DEFAULT_PATTERN_COLOR];
            activePatternIndex = 0;

            // Import preview settings if available
            if (patternData.preview) {
                previewRepeatX = Utils.clampInt(
                    patternData.preview.repeatX,
                    CONFIG.MIN_PREVIEW_REPEAT,
                    CONFIG.MAX_PREVIEW_REPEAT,
                    CONFIG.DEFAULT_PREVIEW_REPEAT
                );
                previewRepeatY = Utils.clampInt(
                    patternData.preview.repeatY,
                    CONFIG.MIN_PREVIEW_REPEAT,
                    CONFIG.MAX_PREVIEW_REPEAT,
                    CONFIG.DEFAULT_PREVIEW_REPEAT
                );
            }

            // Import palette settings if available
            if (patternData.palette) {
                activePaletteId = patternData.palette.active || CONFIG.DEFAULT_ACTIVE_PALETTE;
                customPalette = patternData.palette.custom || null;
            }

            hasInteracted = true; // Mark as interacted since pattern was loaded
        }
    } catch (error) {
        console.error('Failed to load shared pattern:', error);
        showError('Failed to load shared pattern from URL. Loading saved pattern instead.');
    }
} else if (shareUrlResult.data && !validateShareData(shareUrlResult.data)) {
    // Data parsed successfully but failed validation
    showError('Unable to load shared pattern. The pattern data is invalid or incompatible with this version.');
}

// Update all UI display elements to match loaded/initialized state

const inlineWidthDisplay = document.getElementById('gridWidthDisplay');
const inlineHeightDisplay = document.getElementById('gridHeightDisplay');
if (inlineWidthDisplay) inlineWidthDisplay.value = gridWidth;
if (inlineHeightDisplay) inlineHeightDisplay.value = gridHeight;

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

if (inlineRepeatXDisplay) inlineRepeatXDisplay.value = previewRepeatX;
if (inlineRepeatYDisplay) inlineRepeatYDisplay.value = previewRepeatY;

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
    updateColorIndicators: renderKey,
    updateActiveColorUI: renderKey
});

// Expose palette functions globally for button handlers
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
    updateActiveColorUI: renderKey,
    createNavbarColorButtons: renderKey,
    setShiftKeyState: (isHeld) => {
        if (isShiftKeyHeld === isHeld) return;
        isShiftKeyHeld = isHeld;
        if (key) key.refreshSelection();
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

// What the key's controls do to the pattern
const keyActions = {
    selectColor(index) {
        activePatternIndex = index;
        isBackgroundActive = false;
        renderKey();
        saveToLocalStorage();
    },

    addColor() {
        if (patternColors.length >= CONFIG.MAX_PATTERN_COLORS) return;
        patternColors.push(CONFIG.DEFAULT_ADD_COLOR);
        activePatternIndex = patternColors.length - 1;
        isBackgroundActive = false;
        renderKey();
        updateCanvas();
        saveToLocalStorage();
        announceToScreenReader(`Colour ${patternColors.length} added`);
    },

    changeColor(index, hex) {
        if (!validateColor(hex)) return;
        patternColors[index] = hex;
        renderKey();
        updateCanvas();
        saveToHistory();
    },

    removeColor(index) {
        showDeleteColorDialog(index);
    },

    mergeColors(sourceIndex, targetIndex) {
        mergePatternColors(sourceIndex, targetIndex);
    },

    swapWithBackground(index) {
        if (index < 0 || index >= patternColors.length) return;
        const previousBackground = backgroundColor;
        backgroundColor = patternColors[index];
        patternColors[index] = previousBackground;
        saveToHistory();
        renderKey();
        updateCanvas();
        announceToScreenReader(`Swapped colour ${index + 1} with the background`);
    },

    setBackground(hex) {
        if (!validateColor(hex)) return;
        backgroundColor = hex;
        renderKey();
        updateCanvas();
        saveToHistory();
    },

    toggleBackgroundActive() {
        isBackgroundActive = !isBackgroundActive;
        renderKey();
    },

    giveActiveColour(hex) {
        patternColors[activePatternIndex] = hex;
        renderKey();
        updateCanvas();
        saveToHistory();
    },

    switchPalette(paletteId) {
        switchPalette(paletteId);
        renderKey();
    },

    loadPalette() {
        const palette = getCurrentPaletteColors();
        if (!palette || palette.length === 0) return;
        patternColors = palette.slice(0, CONFIG.MAX_PATTERN_COLORS);
        if (activePatternIndex >= patternColors.length) {
            activePatternIndex = 0;
        }
        renderKey();
        updateCanvas();
        saveToHistory();
        announceToScreenReader(`Loaded the ${activePaletteId} palette into the key`);
    },

    addCustomColour() {
        if (!customPalette) {
            customPalette = ['#000000'];
        } else if (customPalette.length < CONFIG.MAX_PALETTE_COLORS) {
            customPalette.push('#000000');
        }
        renderKey();
        saveToLocalStorage();
    },

    editCustomColour(index, hex) {
        if (!customPalette || !validateColor(hex)) return;
        customPalette[index] = hex;
        renderKey();
        saveToLocalStorage();
    },

    deleteCustomColour(index) {
        if (!customPalette || customPalette.length <= CONFIG.MIN_PALETTE_COLORS) return;
        customPalette.splice(index, 1);
        renderKey();
        saveToLocalStorage();
    }
};

// The key under the chart
key = createKey({
    getState: () => ({
        patternColors,
        activePatternIndex,
        backgroundColor,
        activePaletteId,
        customPalette,
        isBackgroundActive,
        isShiftKeyHeld
    }),
    actions: keyActions,
    isStacked: () => document.getElementById('plate').classList.contains('is-stacked'),
    isTouch: () => window.matchMedia('(hover: none) and (pointer: coarse)').matches
});

// Initialize UI
updatePaletteUI();
initGrid();
renderKey();

setupHamburgerMenu();
setupTooltips();

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

// Caption fields: numbers typed into the caption sentences, applied on Enter or leaving the field
function setupCaptionField(element, applyFunc, min, max) {
    if (!element) return;

    element.addEventListener('focus', () => {
        element.dataset.lastValid = element.value;
    });

    element.addEventListener('change', () => {
        let val = parseInt(element.value.trim(), 10);

        if (isNaN(val)) {
            val = element.dataset.lastValid ? parseInt(element.dataset.lastValid, 10) : min;
        }

        val = Utils.clampInt(val, min, max, min);
        element.value = val;
        element.dataset.lastValid = val;
        applyFunc(val);
    });

    element.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            // Leaving the field applies it
            e.preventDefault();
            element.blur();
        } else if (e.key === 'Escape') {
            element.value = element.dataset.lastValid ?? element.value;
            element.blur();
        } else if (e.key.length === 1 && !/[0-9]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
            // Digits only
            e.preventDefault();
        }
    });
}

// Setup grid dimension displays
setupCaptionField(gridWidthDisplay, applyGridWidth, CONFIG.MIN_GRID_SIZE, CONFIG.MAX_GRID_SIZE);
setupCaptionField(gridHeightDisplay, applyGridHeight, CONFIG.MIN_GRID_SIZE, CONFIG.MAX_GRID_SIZE);
setupCaptionField(previewRepeatXDisplay, applyPreviewRepeatX, CONFIG.MIN_PREVIEW_REPEAT, CONFIG.MAX_PREVIEW_REPEAT);
setupCaptionField(previewRepeatYDisplay, applyPreviewRepeatY, CONFIG.MIN_PREVIEW_REPEAT, CONFIG.MAX_PREVIEW_REPEAT);

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

// Window resize handler
// Debounced resize handler to recreate navbar buttons when viewport changes
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

    document.body.style.cursor = getComputedStyle(handle).cursor;

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

    // Arrow keys add (outward) or remove (inward) one row or stitch at this edge
    handle.addEventListener('keydown', (e) => {
        const direction = handle.dataset.direction;
        const outward = { top: 'ArrowUp', bottom: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[direction];
        const inward = { top: 'ArrowDown', bottom: 'ArrowUp', left: 'ArrowRight', right: 'ArrowLeft' }[direction];
        if (e.key !== outward && e.key !== inward) return;
        e.preventDefault();
        applyGridResizeFromEdge(direction, e.key === outward ? 1 : -1);
        announceToScreenReader(`${gridWidth} stitches by ${gridHeight} rows`);
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

// ============================================
// URL HASH CHANGE HANDLING
// ============================================

// Listen for hash changes to support dynamic share URL loading
// Track if we're currently loading a shared pattern to avoid duplicate error messages
let isLoadingSharedPattern = false;

window.addEventListener('hashchange', () => {
    const shareUrlResult = parseShareUrl();

    // Handle parse errors
    if (!shareUrlResult.success) {
        showError(shareUrlResult.userMessage);
        return;
    }

    // If no share data, nothing to do
    if (!shareUrlResult.data) {
        return;
    }

    // Validate the share data
    if (!validateShareData(shareUrlResult.data)) {
        showError('Unable to load shared pattern. The pattern data is invalid or incompatible with this version.');
        return;
    }

    isLoadingSharedPattern = true;

    // Create a temporary blob for importJson validation
    const jsonString = JSON.stringify(shareUrlResult.data);
    const tempBlob = new Blob([jsonString], { type: 'application/json' });

    // Use importJson to validate and apply the shared pattern
    importJson(
        tempBlob,
        (importedData) => {
            // Apply imported data
            gridWidth = importedData.gridWidth;
            gridHeight = importedData.gridHeight;
            aspectRatio = importedData.aspectRatio;
            grid = importedData.grid;
            backgroundColor = importedData.backgroundColor;
            patternColors = importedData.patternColors;
            activePatternIndex = 0;
            previewRepeatX = importedData.previewRepeatX || CONFIG.DEFAULT_PREVIEW_REPEAT;
            previewRepeatY = importedData.previewRepeatY || CONFIG.DEFAULT_PREVIEW_REPEAT;
            activePaletteId = importedData.activePaletteId || CONFIG.DEFAULT_ACTIVE_PALETTE;
            customPalette = importedData.customPalette || null;
            hasInteracted = true;

            // Update UI displays after loading shared data
            updateUIDisplaysForSharedPattern();

            // Re-initialize history with new pattern
            HistoryManager.init({
                grid: grid,
                gridWidth: gridWidth,
                gridHeight: gridHeight,
                colors: patternColors,
                backgroundColor: backgroundColor
            });

            isLoadingSharedPattern = false;
            announceToScreenReader('Shared pattern loaded successfully');
        },
        (errorMessage) => {
            isLoadingSharedPattern = false;
            console.error('Failed to load shared pattern from hash change:', errorMessage);
            showError('Failed to load shared pattern from URL.');
        }
    );
});

// ============================================
// GLOBAL ERROR HANDLING
// ============================================

// Set up global error handlers for unhandled errors
setupGlobalErrorHandler();
