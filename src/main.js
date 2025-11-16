// ============================================
// MAIN APPLICATION
// ============================================

import { CONFIG } from './config.js';
import { Utils } from './utils.js';
import { StorageManager } from './managers/storage.js';
import { HistoryManager } from './managers/history.js';
import { CanvasManager } from './managers/canvas.js';
import { createEmptyGrid, resizeGrid, resizeGridFromEdge } from './core/grid.js';
import { exportSvg, exportPng, exportJson, importJson, downloadFile } from './core/export.js';
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
import { setupPanelToggles, setupDropdowns } from './ui/panels.js';
import { setupKeyboardShortcuts } from './ui/keyboard.js';
import { setupCanvasInteractions } from './ui/interactions.js';

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

function createPatternColorButtons() {
    const container = document.getElementById('patternColorButtons');
    container.innerHTML = '';

    const colorCount = patternColors.length;
    const shouldShowAddButton = colorCount < CONFIG.MAX_PATTERN_COLORS;
    const showCount = shouldShowAddButton ? colorCount + 1 : colorCount;

    const mergeHint = document.getElementById('mergeHint');
    if (mergeHint) {
        mergeHint.style.display = colorCount >= 2 ? 'block' : 'none';
    }

    container.style.gridTemplateColumns = `repeat(2, 1fr)`;

    for (let index = 0; index < showCount; index++) {
        const btn = document.createElement('div');
        btn.className = 'pattern-btn';
        const isAddButton = shouldShowAddButton && index === colorCount;
        const color = isAddButton ? null : patternColors[index];

        if (isAddButton) {
            btn.classList.add('unused');
            btn.style.backgroundColor = '#e0e0e0';
            btn.style.color = '#999';
            btn.textContent = '+';
            btn.draggable = false;
        } else {
            btn.style.backgroundColor = color;
            btn.textContent = (index + 1);
            btn.draggable = true;

            if (index > 0) {
                const deleteBtn = document.createElement('span');
                deleteBtn.className = 'pattern-delete-btn';
                deleteBtn.innerHTML = `<img src="${deleteSvg}" alt="Delete" class="delete-icon">`;
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    showDeleteColorDialog(index);
                };
                btn.appendChild(deleteBtn);
            }
        }

        btn.setAttribute('data-index', index);

        if (index === activePatternIndex && !isAddButton) {
            btn.classList.add('active');
        }

        let dragStarted = false;

        btn.addEventListener('mousedown', () => {
            dragStarted = false;
        });

        if (!isAddButton) {
            btn.addEventListener('dragstart', (e) => {
                dragStarted = true;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', index.toString());

                const dragImage = document.createElement('div');
                dragImage.style.backgroundColor = color;
                dragImage.style.color = 'white';
                dragImage.style.textShadow = '0 1px 2px rgba(0,0,0,0.3)';
                dragImage.style.fontWeight = 'bold';
                dragImage.style.fontSize = '0.6rem';
                dragImage.style.width = '30px';
                dragImage.style.height = '30px';
                dragImage.style.display = 'flex';
                dragImage.style.alignItems = 'center';
                dragImage.style.justifyContent = 'center';
                dragImage.style.position = 'absolute';
                dragImage.style.top = '-1000px';
                dragImage.textContent = (index + 1);
                document.body.appendChild(dragImage);
                e.dataTransfer.setDragImage(dragImage, 15, 15);
                setTimeout(() => {
                    document.body.removeChild(dragImage);
                }, 0);

                setTimeout(() => {
                    btn.style.opacity = '0.5';
                }, 0);
            });

            btn.addEventListener('dragend', (e) => {
                btn.style.opacity = '1';
                const allButtons = container.querySelectorAll('.pattern-btn');
                allButtons.forEach((b, i) => {
                    const btnColor = patternColors[i];
                    if (btnColor) {
                        b.style.backgroundColor = btnColor;
                    }
                });
            });
        }

        btn.addEventListener('dragover', (e) => {
            if (!isAddButton) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
                if (!isNaN(draggedIndex) && draggedIndex !== index) {
                    btn.style.backgroundColor = patternColors[draggedIndex];
                    btn.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
                }
            }
        });

        btn.addEventListener('dragleave', (e) => {
            if (!isAddButton) {
                btn.style.backgroundColor = color;
                btn.style.boxShadow = '';
            }
        });

        btn.addEventListener('drop', (e) => {
            if (!isAddButton) {
                e.preventDefault();
                e.stopPropagation();
                btn.style.backgroundColor = color;
                btn.style.boxShadow = '';

                const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const targetIndex = index;

                if (draggedIndex !== targetIndex && !isNaN(draggedIndex)) {
                    mergePatternColors(draggedIndex, targetIndex);
                }
            }
        });

        btn.addEventListener('click', (e) => {
            if (!dragStarted) {
                if (isAddButton) {
                    patternColors.push(CONFIG.DEFAULT_ADD_COLOR);
                    activePatternIndex = patternColors.length - 1;
                    createPatternColorButtons();
                    updateActiveColorUI();
                    updateCanvas();
                    saveToLocalStorage();
                } else {
                    activePatternIndex = index;
                    updateActiveColorUI();
                    createPatternColorButtons();
                    saveToLocalStorage();
                }
            }
        });

        container.appendChild(btn);
    }
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
    createPatternColorButtons();
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
        createPatternColorButtons();
        createNavbarColorButtons();
        updateCanvas();
    });
}

function updateActiveColorUI() {
    const activeColor = patternColors[activePatternIndex];
    if (activeColor) {
        document.getElementById('activePatternColor').value = activeColor;
        document.getElementById('activePatternText').value = activeColor;
    }

    const label = document.querySelector('.color-picker-label');
    if (label) {
        label.textContent = activePatternIndex + 1;
    }

    updateColorIndicators();
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
            colors: patternColors,
            backgroundColor: backgroundColor
        });
        // Add the current loaded state as second history entry
        HistoryManager.save({
            grid: grid,
            colors: patternColors,
            backgroundColor: backgroundColor
        });
    } else {
        HistoryManager.init({
            grid: grid,
            colors: patternColors,
            backgroundColor: backgroundColor
        });
    }
    updateCanvas();
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
    saveToHistory();
    updateCanvas();
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

    document.getElementById('widthDisplay2').textContent = gridWidth;
    document.getElementById('heightDisplay2').textContent = gridHeight;
    document.getElementById('gridWidth2').value = gridWidth;
    document.getElementById('gridHeight2').value = gridHeight;

    saveToHistory();
    updateCanvas();
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

        if (isShiftKey) {
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
        patternColors = state.colors;
        backgroundColor = state.backgroundColor;

        updateActiveColorUI();
        createPatternColorButtons();
        createNavbarColorButtons();
        document.getElementById('backgroundColor').value = backgroundColor;
        document.getElementById('backgroundText').value = backgroundColor;
        updateCanvas();
        announceToScreenReader('Undo successful');
    }
};

document.getElementById('redoBtn').onclick = () => {
    const state = HistoryManager.redo();
    if (state) {
        grid = state.grid;
        patternColors = state.colors;
        backgroundColor = state.backgroundColor;

        updateActiveColorUI();
        createPatternColorButtons();
        createNavbarColorButtons();
        document.getElementById('backgroundColor').value = backgroundColor;
        document.getElementById('backgroundText').value = backgroundColor;
        updateCanvas();
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

document.getElementById('invertBtn').onclick = (e) => {
    e.preventDefault();
    const temp = patternColors[activePatternIndex];
    patternColors[activePatternIndex] = backgroundColor;
    backgroundColor = temp;

    updateActiveColorUI();
    createPatternColorButtons();
    createNavbarColorButtons();
    document.getElementById('backgroundColor').value = backgroundColor;
    document.getElementById('backgroundText').value = backgroundColor;

    saveToHistory();
    updateCanvas();
    updateColorIndicators();
};

document.getElementById('loadPaletteBtn').onclick = (e) => {
    e.preventDefault();

    // Get current palette colors
    const paletteColors = getCurrentPaletteColors();

    // Save current state to history before making changes
    saveToHistory();

    // Replace pattern colors with palette colors
    patternColors = [...paletteColors];

    // Set active color to first color
    activePatternIndex = 0;

    // Update UI
    createPatternColorButtons();
    createNavbarColorButtons();
    updateActiveColorUI();
    updateCanvas();
    updateColorIndicators();
    saveToLocalStorage();

    announceToScreenReader(`Loaded ${paletteColors.length} colors from palette to pattern colors`);
};

document.getElementById('exportSvgBtn').onclick = (e) => {
    e.preventDefault();
    try {
        const blob = exportSvg(getState());
        downloadFile(blob, `motif-${gridWidth}x${gridHeight}.svg`);
        announceToScreenReader('Pattern exported as SVG');
    } catch (error) {
        handleFileError(error, 'SVG export');
    }
};

document.getElementById('exportPngBtn').onclick = async (e) => {
    e.preventDefault();
    try {
        showLoading('Exporting PNG...');
        // Give UI time to update
        await new Promise(resolve => setTimeout(resolve, 50));
        const blob = await exportPng();
        downloadFile(blob, `motif-${gridWidth}x${gridHeight}.png`);
        announceToScreenReader('Pattern exported as PNG');
    } catch (error) {
        handleFileError(error, 'PNG export');
    } finally {
        hideLoading();
    }
};

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

                    // Update all UI elements
                    document.getElementById('gridWidth2').value = gridWidth;
                    document.getElementById('gridHeight2').value = gridHeight;
                    document.getElementById('widthDisplay2').textContent = gridWidth;
                    document.getElementById('heightDisplay2').textContent = gridHeight;

                    aspectRatioSlider.value = aspectRatio;
                    document.getElementById('ratioDisplay2').textContent = Utils.aspectRatioToDisplay(aspectRatio);

                    previewRepeatXInput.value = previewRepeatX;
                    previewRepeatYInput.value = previewRepeatY;
                    document.getElementById('repeatXDisplay').textContent = previewRepeatX;
                    document.getElementById('repeatYDisplay').textContent = previewRepeatY;

                    document.getElementById('backgroundColor').value = backgroundColor;
                    document.getElementById('backgroundText').value = backgroundColor;

                    createPatternColorButtons();
                    createNavbarColorButtons();
                    updateActiveColorUI();
                    updatePaletteUI();
                    renderPalette();
                    updateNavbarPaletteName();

                    saveToHistory();
                    updateCanvas();
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
    }, 50);

    e.target.value = '';
};

// ============================================
// GRID DIMENSION HELPERS
// ============================================

function applyGridWidth(value) {
    const val = Utils.clampInt(value, CONFIG.MIN_GRID_SIZE, CONFIG.MAX_GRID_SIZE, CONFIG.MIN_GRID_SIZE);
    const input = document.getElementById('gridWidth2');
    const display = document.getElementById('widthDisplay2');

    const success = applyGridResize(val, gridHeight);
    if (success === false) {
        input.value = gridWidth;
        display.textContent = gridWidth;

        input.style.transition = 'none';
        input.style.borderColor = 'var(--color-danger)';
        setTimeout(() => {
            input.style.transition = 'border-color var(--transition-base)';
            input.style.borderColor = '';
        }, 300);
    } else {
        input.value = val;
        display.textContent = val;
    }
}

function applyGridHeight(value) {
    const val = Utils.clampInt(value, CONFIG.MIN_GRID_SIZE, CONFIG.MAX_GRID_SIZE, CONFIG.MIN_GRID_SIZE);
    const input = document.getElementById('gridHeight2');
    const display = document.getElementById('heightDisplay2');

    const success = applyGridResize(gridWidth, val);
    if (success === false) {
        input.value = gridHeight;
        display.textContent = gridHeight;

        input.style.transition = 'none';
        input.style.borderColor = 'var(--color-danger)';
        setTimeout(() => {
            input.style.transition = 'border-color var(--transition-base)';
            input.style.borderColor = '';
        }, 300);
    } else {
        input.value = val;
        display.textContent = val;
    }
}

function applyPreviewRepeatX(value) {
    const val = Utils.clampInt(value, CONFIG.MIN_PREVIEW_REPEAT, CONFIG.MAX_PREVIEW_REPEAT, CONFIG.MIN_PREVIEW_REPEAT);
    previewRepeatXInput.value = val;
    document.getElementById('repeatXDisplay').textContent = val;
    previewRepeatX = val;
    updateCanvas();
    saveToLocalStorage();
}

function applyPreviewRepeatY(value) {
    const val = Utils.clampInt(value, CONFIG.MIN_PREVIEW_REPEAT, CONFIG.MAX_PREVIEW_REPEAT, CONFIG.MIN_PREVIEW_REPEAT);
    previewRepeatYInput.value = val;
    document.getElementById('repeatYDisplay').textContent = val;
    previewRepeatY = val;
    updateCanvas();
    saveToLocalStorage();
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

// Get input elements
const gridWidth2Input = document.getElementById('gridWidth2');
const gridHeight2Input = document.getElementById('gridHeight2');
const aspectRatioSlider = document.getElementById('aspectRatio2');
const previewRepeatXInput = document.getElementById('previewRepeatX');
const previewRepeatYInput = document.getElementById('previewRepeatY');
const backgroundColorPicker = document.getElementById('backgroundColor');
const backgroundColorText = document.getElementById('backgroundText');
const activePatternColorPicker = document.getElementById('activePatternColor');
const activePatternColorText = document.getElementById('activePatternText');

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
    const initialWidth = Utils.clampInt(gridWidth2Input.value, CONFIG.MIN_GRID_SIZE, CONFIG.MAX_GRID_SIZE, CONFIG.DEFAULT_GRID_WIDTH);
    const initialHeight = Utils.clampInt(gridHeight2Input.value, CONFIG.MIN_GRID_SIZE, CONFIG.MAX_GRID_SIZE, CONFIG.DEFAULT_GRID_HEIGHT);
    const initialAspectRatio = Utils.clampFloat(aspectRatioSlider.value, CONFIG.MIN_ASPECT_RATIO, CONFIG.MAX_ASPECT_RATIO, CONFIG.DEFAULT_ASPECT_RATIO);
    const initialPreviewRepeatX = Utils.clampInt(previewRepeatXInput.value, CONFIG.MIN_PREVIEW_REPEAT, CONFIG.MAX_PREVIEW_REPEAT, CONFIG.DEFAULT_PREVIEW_REPEAT);
    const initialPreviewRepeatY = Utils.clampInt(previewRepeatYInput.value, CONFIG.MIN_PREVIEW_REPEAT, CONFIG.MAX_PREVIEW_REPEAT, CONFIG.DEFAULT_PREVIEW_REPEAT);
    const initialBackgroundColor = backgroundColorPicker.value || CONFIG.DEFAULT_BACKGROUND_COLOR;
    const initialActivePatternColor = activePatternColorPicker.value || CONFIG.DEFAULT_PATTERN_COLOR;

    gridWidth = initialWidth;
    gridHeight = initialHeight;
    aspectRatio = initialAspectRatio;
    previewRepeatX = initialPreviewRepeatX;
    previewRepeatY = initialPreviewRepeatY;
    backgroundColor = initialBackgroundColor;
    patternColors[0] = initialActivePatternColor;
}

// Update all UI inputs to match loaded/initialized state
gridWidth2Input.value = gridWidth;
gridHeight2Input.value = gridHeight;
document.getElementById('widthDisplay2').textContent = gridWidth;
document.getElementById('heightDisplay2').textContent = gridHeight;

aspectRatioSlider.value = aspectRatio;
document.getElementById('ratioDisplay2').textContent = aspectRatio.toFixed(2);

previewRepeatXInput.value = previewRepeatX;
previewRepeatYInput.value = previewRepeatY;
document.getElementById('repeatXDisplay').textContent = previewRepeatX;
document.getElementById('repeatYDisplay').textContent = previewRepeatY;

backgroundColorPicker.value = backgroundColor;
backgroundColorText.value = backgroundColor;

activePatternColorPicker.value = patternColors[activePatternIndex];
activePatternColorText.value = patternColors[activePatternIndex];

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
    createPatternColorButtons,
    updateActiveColorUI
});

// Expose palette functions globally for button handlers
const renderPalette = paletteManager.renderPalette;
const switchPalette = paletteManager.switchPalette;
const updatePaletteUI = paletteManager.updatePaletteUI;

// Initialize panel toggles
const panelToggles = setupPanelToggles(announceToScreenReader, updateColorIndicators);

// Initialize dropdowns
setupDropdowns();

// Initialize keyboard shortcuts
setupKeyboardShortcuts({
    getPatternColors: () => patternColors,
    getActivePatternIndex: () => activePatternIndex,
    setActivePatternIndex: (index) => { activePatternIndex = index; },
    updateActiveColorUI,
    createPatternColorButtons,
    createNavbarColorButtons
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
renderPalette();
updatePaletteUI();
createPatternColorButtons();
createNavbarColorButtons();
updateActiveColorUI();
initGrid();

// Initialize navbar components
setupHamburgerMenu();
setupNavbarPaletteDropdown();
setupGridSettingsLink();
updateNavbarPaletteName();
updateNavbarPalettePreview();

// Initialize color toggle on page load
updateColorIndicators();

// Hide canvas instructions if user has already interacted
if (hasInteracted) {
    const instructions = document.getElementById('canvasInstructions');
    instructions.style.display = 'none';
}

// Color input controls using utility functions
Utils.setupColorInput({
    picker: 'activePatternColor',
    text: 'activePatternText',
    onChange: (color) => {
        patternColors[activePatternIndex] = color;
        createPatternColorButtons();
        createNavbarColorButtons();
        updateCanvas();
        updateColorIndicators();
        saveToLocalStorage();
    }
});

Utils.setupColorInput({
    picker: 'backgroundColor',
    text: 'backgroundText',
    onChange: (color) => {
        backgroundColor = color;
        createNavbarColorButtons();
        updateCanvas();
        updateColorIndicators();
        saveToLocalStorage();
    }
});

// Grid dimension controls
Utils.setupNumberInput({
    input: 'gridWidth2',
    display: 'widthDisplay2',
    min: CONFIG.MIN_GRID_SIZE,
    max: CONFIG.MAX_GRID_SIZE,
    defaultVal: CONFIG.DEFAULT_GRID_WIDTH,
    onApply: applyGridWidth
});

Utils.setupNumberInput({
    input: 'gridHeight2',
    display: 'heightDisplay2',
    min: CONFIG.MIN_GRID_SIZE,
    max: CONFIG.MAX_GRID_SIZE,
    defaultVal: CONFIG.DEFAULT_GRID_HEIGHT,
    onApply: applyGridHeight
});

// Preview repeat controls
Utils.setupNumberInput({
    input: 'previewRepeatX',
    display: 'repeatXDisplay',
    min: CONFIG.MIN_PREVIEW_REPEAT,
    max: CONFIG.MAX_PREVIEW_REPEAT,
    defaultVal: CONFIG.DEFAULT_PREVIEW_REPEAT,
    onApply: applyPreviewRepeatX
});

Utils.setupNumberInput({
    input: 'previewRepeatY',
    display: 'repeatYDisplay',
    min: CONFIG.MIN_PREVIEW_REPEAT,
    max: CONFIG.MAX_PREVIEW_REPEAT,
    defaultVal: CONFIG.DEFAULT_PREVIEW_REPEAT,
    onApply: applyPreviewRepeatY
});

// Aspect Ratio controls
const ratioDisplay2 = document.getElementById('ratioDisplay2');
const ratioPresetButtons = document.querySelectorAll('.ratio-preset-btn');
const customRatioControls = document.getElementById('customRatioControls');

const switchToCustomRatio = () => {
    ratioPresetButtons.forEach(b => b.classList.remove('active'));
    const customBtn = document.querySelector('.ratio-preset-btn[data-ratio="custom"]');
    if (customBtn) {
        customBtn.classList.add('active');
        customRatioControls.style.display = 'block';
    }
};

ratioPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const ratio = btn.getAttribute('data-ratio');

        ratioPresetButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (ratio === 'custom') {
            customRatioControls.style.display = 'block';
        } else {
            customRatioControls.style.display = 'none';
            const ratioValue = parseFloat(ratio);
            aspectRatio = ratioValue;
            aspectRatioSlider.value = ratioValue;
            ratioDisplay2.textContent = Utils.decimalToFraction(ratioValue);
            updateCanvas();
            saveToLocalStorage();
        }
    });
});

aspectRatioSlider.oninput = (e) => {
    switchToCustomRatio();
    aspectRatio = parseFloat(e.target.value);
    ratioDisplay2.textContent = Utils.aspectRatioToDisplay(aspectRatio);
    updateCanvas();
    saveToLocalStorage();
};

ratioDisplay2.addEventListener('focus', () => {
    switchToCustomRatio();
});

ratioDisplay2.addEventListener('input', (e) => {
    const inputText = e.target.textContent.trim();
    const val = Utils.displayToAspectRatio(inputText);
    if (val !== null && val >= CONFIG.MIN_ASPECT_RATIO && val <= CONFIG.MAX_ASPECT_RATIO) {
        aspectRatio = val;
        aspectRatioSlider.value = val;
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
    aspectRatioSlider.value = val;
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
                customRatioControls.style.display = 'none';
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
            customRatioControls.style.display = 'block';
        }
    }

    ratioDisplay2.textContent = Utils.aspectRatioToDisplay(aspectRatio);
})();

// Window resize handler
window.addEventListener('resize', () => {
    updateCanvas();
});

// Canvas edge resize handlers
const resizeHandles = document.querySelectorAll('.resize-handle');
let isResizing = false;
let resizeDirection = null;
let resizeStartSize = null;
let resizeStartPos = null;

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

    // Touch events
    handle.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const touch = e.touches[0];
        startResize(handle, touch.clientX, touch.clientY);
    }, { passive: false });
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
    }
}, { passive: false });

document.addEventListener('touchend', () => {
    endResize();
});

document.addEventListener('touchcancel', () => {
    endResize();
});

// Keyboard shortcuts - Moved to src/ui/keyboard.js

// Panel toggle functionality - Moved to src/ui/panels.js

// ============================================
// NAVBAR UI COMPONENTS
// ============================================

// Track currently open color menu
let currentColorMenu = null;

/**
 * Show menu for color button with Set Active, Edit, Delete options
 */
function showColorButtonMenu(buttonElement, colorIndex, color) {
    // Close any existing menu
    closeColorButtonMenu();

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
            updateActiveColorUI();
            createNavbarColorButtons();
            saveToLocalStorage();
            closeColorButtonMenu();
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
            updateActiveColorUI();
            createNavbarColorButtons();
            saveToLocalStorage();
        }
        // Then open color picker
        openColorPicker(colorIndex, color);
        closeColorButtonMenu();
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
            closeColorButtonMenu();
        });
        menu.appendChild(deleteBtn);
    }

    // Position menu below button
    const rect = buttonElement.getBoundingClientRect();
    menu.style.position = 'absolute';
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.left = `${rect.left + rect.width / 2}px`;
    menu.style.transform = 'translateX(-50%)';

    document.body.appendChild(menu);
    currentColorMenu = menu;

    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', closeColorButtonMenu);
    }, 0);
}

/**
 * Close the color button menu
 */
function closeColorButtonMenu() {
    if (currentColorMenu) {
        document.removeEventListener('click', closeColorButtonMenu);
        currentColorMenu.remove();
        currentColorMenu = null;
    }
}

/**
 * Create color buttons in navbar
 * Includes pattern colors, add button, and background color button
 */
function createNavbarColorButtons() {
    const container = document.getElementById('navbarColorButtons');
    if (!container) return;

    container.innerHTML = '';

    // Create pattern color buttons
    patternColors.forEach((color, index) => {
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
        btn.addEventListener('mousedown', () => {
            dragStarted = false;
        });

        btn.addEventListener('click', (e) => {
            if (!dragStarted) {
                e.stopPropagation();
                showColorButtonMenu(btn, index, color);
            }
        });

        // Drag and drop for merging
        btn.addEventListener('dragstart', (e) => {
            dragStarted = true;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index.toString());

            // Create custom drag image
            const dragImage = document.createElement('div');
            dragImage.style.backgroundColor = color;
            dragImage.style.width = '36px';
            dragImage.style.height = '36px';
            dragImage.style.borderRadius = '50%';
            dragImage.style.border = '2px solid var(--color-border-dark)';
            dragImage.style.position = 'absolute';
            dragImage.style.top = '-1000px';
            dragImage.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
            document.body.appendChild(dragImage);
            e.dataTransfer.setDragImage(dragImage, 18, 18);
            setTimeout(() => {
                document.body.removeChild(dragImage);
            }, 0);

            setTimeout(() => {
                btn.style.opacity = '0.5';
            }, 0);
        });

        btn.addEventListener('dragend', () => {
            btn.style.opacity = '1';
        });

        btn.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
            if (!isNaN(draggedIndex) && draggedIndex !== index) {
                btn.style.backgroundColor = patternColors[draggedIndex];
                btn.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
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

            const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const targetIndex = index;

            if (draggedIndex !== targetIndex && !isNaN(draggedIndex)) {
                mergePatternColors(draggedIndex, targetIndex);
            }
        });

        container.appendChild(btn);
    });

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
    bgBtn.addEventListener('click', () => {
        openBackgroundColorPicker();
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
            createPatternColorButtons();
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

    // Close menu when clicking menu items
    const menuItems = hamburgerMenu.querySelectorAll('.navbar-hamburger-item');
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
                createPatternColorButtons();
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

        // For custom palette, clicking shows menu. For built-in, clicking applies color
        // Shift-click always sets background color
        if (isCustomPalette) {
            colorDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.shiftKey) {
                    // Shift-click sets background color
                    backgroundColor = color;
                    createNavbarColorButtons();
                    updateCanvas();
                    updateColorIndicators();
                    saveToHistory();
                    saveToLocalStorage();
                } else {
                    // Regular click shows menu
                    showPaletteColorMenu(colorDiv, index, color);
                }
            });
        } else {
            colorDiv.addEventListener('click', (e) => {
                if (e.shiftKey) {
                    // Shift-click sets background color
                    backgroundColor = color;
                    createNavbarColorButtons();
                    updateCanvas();
                    updateColorIndicators();
                    saveToHistory();
                    saveToLocalStorage();
                } else {
                    // Regular click sets active pattern color
                    patternColors[activePatternIndex] = color;
                    createNavbarColorButtons();
                    createPatternColorButtons();
                    updateActiveColorUI();
                    updateCanvas();
                    saveToHistory();
                    saveToLocalStorage();
                }
            });
        }

        paletteGrid.appendChild(colorDiv);
    });

    // Add "+" button for custom palette (if not at max)
    if (isCustomPalette && currentPalette.length < CONFIG.MAX_PALETTE_COLORS) {
        const addBtn = document.createElement('div');
        addBtn.className = 'navbar-palette-color navbar-palette-add-btn';
        addBtn.textContent = '+';
        addBtn.setAttribute('aria-label', 'Add palette color');
        addBtn.addEventListener('click', () => {
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
        createPatternColorButtons();
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
        closePaletteColorMenu();
        // Close the palette dropdown
        const dropdownContainer = document.querySelector('.navbar-palette-dropdown-container');
        const dropdownBtn = document.getElementById('navbarPaletteDropdownBtn');
        if (dropdownContainer) {
            dropdownContainer.classList.remove('open');
        }
        if (dropdownBtn) {
            dropdownBtn.setAttribute('aria-expanded', 'false');
        }
        // Edit the color, passing a callback to reopen the dropdown
        editCustomPaletteColor(colorIndex, color, () => {
            // Reopen dropdown after color picker closes
            if (dropdownContainer) {
                dropdownContainer.classList.add('open');
            }
            if (dropdownBtn) {
                dropdownBtn.setAttribute('aria-expanded', 'true');
            }
        });
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
    renderPalette();
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
            renderPalette();
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
    renderPalette();
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

/**
 * Set up grid settings link
 */
function setupGridSettingsLink() {
    const gridSettingsLink = document.getElementById('gridSettingsLink');
    const settingsPanel = document.getElementById('settingsPanel');

    if (!gridSettingsLink || !settingsPanel) return;

    gridSettingsLink.addEventListener('click', (e) => {
        e.preventDefault();

        // Toggle settings panel
        const isCollapsed = settingsPanel.classList.contains('collapsed');
        if (isCollapsed) {
            settingsPanel.classList.remove('collapsed');
            settingsPanel.setAttribute('aria-expanded', 'true');
        } else {
            settingsPanel.classList.add('collapsed');
            settingsPanel.setAttribute('aria-expanded', 'false');
        }
    });
}

// ============================================
// GLOBAL ERROR HANDLING
// ============================================

// Set up global error handlers for unhandled errors
setupGlobalErrorHandler();
