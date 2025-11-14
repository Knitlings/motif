import { CONFIG } from '../config.js';

// ============================================
// CANVAS MANAGER
// ============================================

/**
 * Canvas manager for rendering and updating grid canvases
 * Handles both edit and preview canvas rendering with responsive sizing
 */
export const CanvasManager = {
    editCanvas: null,
    previewCanvas: null,
    editCtx: null,
    previewCtx: null,
    cachedViewportHeight: null, // Cache initial viewport height for mobile landscape

    /**
     * Initialize canvas references and setup viewport caching
     * @param {string} editCanvasId - ID of the edit canvas element
     * @param {string} previewCanvasId - ID of the preview canvas element
     */
    init(editCanvasId, previewCanvasId) {
        this.editCanvas = document.getElementById(editCanvasId);
        this.previewCanvas = document.getElementById(previewCanvasId);
        this.editCtx = this.editCanvas.getContext('2d');
        this.previewCtx = this.previewCanvas.getContext('2d');

        // Cache initial viewport height for mobile landscape stability
        const isLandscape = window.innerWidth > window.innerHeight;
        const isMobile = window.innerWidth <= 1024 || (isLandscape && window.innerHeight <= 500);
        if (isMobile && isLandscape) {
            this.cachedViewportHeight = window.innerHeight;
        }

        // Update cache if orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                const newIsLandscape = window.innerWidth > window.innerHeight;
                const newIsMobile = window.innerWidth <= 1024 || (newIsLandscape && window.innerHeight <= 500);
                if (newIsMobile && newIsLandscape) {
                    this.cachedViewportHeight = window.innerHeight;
                } else {
                    this.cachedViewportHeight = null;
                }
            }, 100); // Small delay to let orientation settle
        });
    },

    /**
     * Calculate optimal cell size based on grid dimensions, aspect ratio, and viewport constraints
     * Balances between width and height constraints while respecting min/max limits
     * @param {number} gridWidth - Number of columns in grid
     * @param {number} gridHeight - Number of rows in grid
     * @param {number} aspectRatio - Cell aspect ratio (height/width)
     * @param {number} maxWidth - Maximum available width for canvas
     * @returns {{width: number, height: number}} Cell dimensions in pixels
     */
    calculateCellSize(gridWidth, gridHeight, aspectRatio, maxWidth) {
        // Calculate available height based on viewport
        const isLandscape = window.innerWidth > window.innerHeight;
        const isMobile = window.innerWidth <= 1024 || (isLandscape && window.innerHeight <= 500);
        const headerHeight = isMobile ? 56 : 64; // Navbar height from CSS (smaller on mobile)

        // Reduce vertical padding significantly in landscape to use available height
        let paddingVertical;
        if (isMobile && isLandscape) {
            paddingVertical = 60; // Very minimal padding in mobile landscape - height is precious
        } else if (isMobile) {
            paddingVertical = 160; // Normal mobile portrait padding
        } else {
            paddingVertical = 320; // Desktop padding
        }

        // Use cached viewport height in mobile landscape to prevent jumping when browser bar appears/disappears
        let viewportHeight = window.innerHeight;
        if (isMobile && isLandscape && this.cachedViewportHeight) {
            // Use the cached height from initial load instead of current height
            // This keeps canvas size stable when browser bar slides in/out
            viewportHeight = this.cachedViewportHeight;
        }

        const availableHeight = viewportHeight - headerHeight - paddingVertical;

        // Calculate maximum cell size constrained by width
        const cellWidthByWidth = maxWidth / gridWidth;
        const cellHeightByWidth = cellWidthByWidth * aspectRatio;

        // Calculate maximum cell size constrained by height
        const cellHeightByHeight = availableHeight / gridHeight;
        const cellWidthByHeight = cellHeightByHeight / aspectRatio;

        // Use whichever constraint is more restrictive (gives smaller cells)
        let cellWidth, cellHeight;
        if (cellWidthByWidth <= cellWidthByHeight) {
            // Width is the limiting factor
            cellWidth = cellWidthByWidth;
            cellHeight = cellHeightByWidth;
        } else {
            // Height is the limiting factor
            cellWidth = cellWidthByHeight;
            cellHeight = cellHeightByHeight;
        }

        // Apply maximum canvas size constraint first
        // In mobile landscape, allow larger canvases to use available space
        const maxCanvasSize = (isMobile && isLandscape) ? 1200 : CONFIG.MAX_CANVAS_SIZE;
        const maxCellWidth = maxCanvasSize / gridWidth;
        const maxCellHeight = maxCanvasSize / gridHeight;

        if (cellWidth > maxCellWidth || cellHeight > maxCellHeight) {
            // Constrain by whichever dimension would exceed the max
            const scaleFactor = Math.min(
                maxCellWidth / cellWidth,
                maxCellHeight / cellHeight
            );
            cellWidth *= scaleFactor;
            cellHeight *= scaleFactor;
        }

        // Apply minimum cell size while maintaining aspect ratio
        // This is a hard floor - cells must never be smaller than this in either dimension
        if (cellWidth < CONFIG.MIN_CELL_SIZE || cellHeight < CONFIG.MIN_CELL_SIZE) {
            // Scale up based on whichever dimension is most constrained
            const widthScale = CONFIG.MIN_CELL_SIZE / cellWidth;
            const heightScale = CONFIG.MIN_CELL_SIZE / cellHeight;
            const scale = Math.max(widthScale, heightScale);

            cellWidth *= scale;
            cellHeight *= scale;
        }

        return {
            width: cellWidth,
            height: cellHeight
        };
    },

    /**
     * Update canvas sizes and redraw both edit and preview canvases
     * Handles responsive layout (side-by-side or stacked) based on available space
     * @param {number} gridWidth - Number of columns in grid
     * @param {number} gridHeight - Number of rows in grid
     * @param {number} aspectRatio - Cell aspect ratio (height/width)
     * @param {number} previewRepeatX - Horizontal tile repeats in preview
     * @param {number} previewRepeatY - Vertical tile repeats in preview
     * @param {number[][]} grid - 2D array of cell values (0=background, 1-20=color indices)
     * @param {string[]} patternColors - Array of hex color strings
     * @param {string} backgroundColor - Hex color for empty cells
     */
    update(gridWidth, gridHeight, aspectRatio, previewRepeatX, previewRepeatY, grid, patternColors, backgroundColor) {
        // Calculate viewport constraints - adjust for mobile vs desktop
        // Consider it mobile if width <= 1024px OR if in landscape with height <= 500px (catches phones in landscape)
        const isLandscape = window.innerWidth > window.innerHeight;
        const isMobile = window.innerWidth <= 1024 || (isLandscape && window.innerHeight <= 500);
        const isSmallMobile = window.innerWidth <= 480;

        // On mobile, panels are overlays (not side-by-side), so ignore panel width
        const collapsedPanelWidth = isMobile ? 0 : 40;

        // Adjust padding based on screen size and orientation
        let paddingHorizontal;
        if (isSmallMobile && !isLandscape) {
            paddingHorizontal = 32; // 16px on each side (var(--space-3) * 2) - portrait only
        } else if (isMobile) {
            // In landscape, use minimal padding to maximize canvas space (like mini-desktop)
            paddingHorizontal = isLandscape ? 32 : 64;
        } else {
            paddingHorizontal = 480; // Desktop padding
        }

        // Gap between canvases - smaller in landscape to encourage side-by-side layout
        const gap = (isMobile && isLandscape) ? 32 : (isMobile ? 64 : 96);
        const availableWidth = window.innerWidth - (collapsedPanelWidth * 2) - paddingHorizontal;

        // First, try to calculate cell sizes assuming side-by-side layout
        // Available width for each canvas when side-by-side
        const widthPerCanvas = (availableWidth - gap) / 2;

        // Calculate cell size for edit canvas with half the available width
        const cellSizeSideBySide = this.calculateCellSize(gridWidth, gridHeight, aspectRatio, widthPerCanvas);

        // Calculate what the canvas dimensions would be with these cell sizes
        const editCanvasWidthSideBySide = gridWidth * cellSizeSideBySide.width;
        const previewWidthSideBySide = gridWidth * cellSizeSideBySide.width * previewRepeatX * CONFIG.PREVIEW_SCALE;

        // Check if both canvases can actually fit side-by-side
        const totalWidthSideBySide = editCanvasWidthSideBySide + previewWidthSideBySide + gap;
        const canFitSideBySide = totalWidthSideBySide <= availableWidth;

        // Decide on final layout and calculate cell sizes accordingly
        let cellSize, shouldStack;
        if (canFitSideBySide) {
            // Use the side-by-side cell size
            cellSize = cellSizeSideBySide;
            shouldStack = false;
        } else {
            // Recalculate with full available width for stacked layout
            cellSize = this.calculateCellSize(gridWidth, gridHeight, aspectRatio, availableWidth);
            shouldStack = true;
        }

        // Calculate final canvas dimensions
        const editCanvasWidth = gridWidth * cellSize.width;
        const editCanvasHeight = gridHeight * cellSize.height;

        // Preview at its natural scale
        const previewNaturalWidth = gridWidth * cellSize.width * previewRepeatX * CONFIG.PREVIEW_SCALE;
        const previewNaturalHeight = gridHeight * cellSize.height * previewRepeatY * CONFIG.PREVIEW_SCALE;

        // Calculate final preview size
        let previewWidth, previewHeight;
        if (shouldStack) {
            // When stacked, preview should not exceed edit canvas width for alignment
            if (previewNaturalWidth > editCanvasWidth) {
                const scale = editCanvasWidth / previewNaturalWidth;
                previewWidth = editCanvasWidth;
                previewHeight = previewNaturalHeight * scale;
            } else {
                previewWidth = previewNaturalWidth;
                previewHeight = previewNaturalHeight;
            }
        } else {
            // When side-by-side, use natural size
            previewWidth = previewNaturalWidth;
            previewHeight = previewNaturalHeight;
        }

        // Set canvas sizes
        this.editCanvas.width = editCanvasWidth;
        this.editCanvas.height = editCanvasHeight;
        this.previewCanvas.width = previewWidth;
        this.previewCanvas.height = previewHeight;

        // Calculate actual cell sizes for drawing
        const previewCellWidth = previewWidth / (gridWidth * previewRepeatX);
        const previewCellHeight = previewHeight / (gridHeight * previewRepeatY);

        // Draw both canvases
        this.drawEdit(gridWidth, gridHeight, cellSize.width, cellSize.height, grid, patternColors, backgroundColor);
        this.drawPreview(gridWidth, gridHeight, previewCellWidth, previewCellHeight,
                        previewRepeatX, previewRepeatY, grid, patternColors, backgroundColor);
    },

    /**
     * Draw the edit canvas with grid lines
     * @param {number} gridWidth - Number of columns in grid
     * @param {number} gridHeight - Number of rows in grid
     * @param {number} cellWidth - Width of each cell in pixels
     * @param {number} cellHeight - Height of each cell in pixels
     * @param {number[][]} grid - 2D array of cell values (0=background, 1-20=color indices)
     * @param {string[]} patternColors - Array of hex color strings
     * @param {string} backgroundColor - Hex color for empty cells
     */
    drawEdit(gridWidth, gridHeight, cellWidth, cellHeight, grid, patternColors, backgroundColor) {
        this.editCtx.clearRect(0, 0, this.editCanvas.width, this.editCanvas.height);

        for (let row = 0; row < gridHeight; row++) {
            for (let col = 0; col < gridWidth; col++) {
                const cellValue = grid[row][col];
                // 0 = background, 1-N = pattern colors
                if (cellValue === 0) {
                    this.editCtx.fillStyle = backgroundColor;
                } else {
                    const color = patternColors[cellValue - 1];
                    this.editCtx.fillStyle = color || backgroundColor;
                }
                this.editCtx.fillRect(col * cellWidth, row * cellHeight, cellWidth, cellHeight);

                this.editCtx.strokeStyle = CONFIG.GRID_STROKE_COLOR;
                this.editCtx.strokeRect(col * cellWidth, row * cellHeight, cellWidth, cellHeight);
            }
        }
    },

    /**
     * Draw the preview canvas with tiled pattern
     * @param {number} gridWidth - Number of columns in grid
     * @param {number} gridHeight - Number of rows in grid
     * @param {number} cellWidth - Width of each cell in pixels
     * @param {number} cellHeight - Height of each cell in pixels
     * @param {number} repeatX - Horizontal tile repeats
     * @param {number} repeatY - Vertical tile repeats
     * @param {number[][]} grid - 2D array of cell values (0=background, 1-20=color indices)
     * @param {string[]} patternColors - Array of hex color strings
     * @param {string} backgroundColor - Hex color for empty cells
     */
    drawPreview(gridWidth, gridHeight, cellWidth, cellHeight, repeatX, repeatY, grid, patternColors, backgroundColor) {
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);

        for (let repeatRow = 0; repeatRow < repeatY; repeatRow++) {
            for (let repeatCol = 0; repeatCol < repeatX; repeatCol++) {
                for (let row = 0; row < gridHeight; row++) {
                    for (let col = 0; col < gridWidth; col++) {
                        const x = (repeatCol * gridWidth + col) * cellWidth;
                        const y = (repeatRow * gridHeight + row) * cellHeight;

                        const cellValue = grid[row][col];
                        if (cellValue === 0) {
                            this.previewCtx.fillStyle = backgroundColor;
                        } else {
                            const color = patternColors[cellValue - 1];
                            this.previewCtx.fillStyle = color || backgroundColor;
                        }
                        this.previewCtx.fillRect(x, y, cellWidth, cellHeight);

                        this.previewCtx.strokeStyle = CONFIG.PREVIEW_STROKE_COLOR;
                        this.previewCtx.strokeRect(x, y, cellWidth, cellHeight);
                    }
                }
            }
        }
    },

    /**
     * Get grid cell coordinates from mouse event
     * @param {MouseEvent} e - Mouse event
     * @param {number} gridWidth - Number of columns in grid
     * @param {number} gridHeight - Number of rows in grid
     * @returns {{row: number, col: number}} Cell coordinates
     */
    getCellFromMouse(e, gridWidth, gridHeight) {
        const rect = this.editCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cellWidth = this.editCanvas.width / gridWidth;
        const cellHeight = this.editCanvas.height / gridHeight;
        const col = Math.floor(x / cellWidth);
        const row = Math.floor(y / cellHeight);
        return { row, col };
    }
};
