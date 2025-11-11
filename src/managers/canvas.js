import { CONFIG } from '../config.js';

// ============================================
// CANVAS MANAGER
// ============================================
export const CanvasManager = {
    editCanvas: null,
    previewCanvas: null,
    editCtx: null,
    previewCtx: null,

    // Initialize canvas references
    init(editCanvasId, previewCanvasId) {
        this.editCanvas = document.getElementById(editCanvasId);
        this.previewCanvas = document.getElementById(previewCanvasId);
        this.editCtx = this.editCanvas.getContext('2d');
        this.previewCtx = this.previewCanvas.getContext('2d');
    },

    // Calculate cell size based on grid dimensions and available width
    calculateCellSize(gridWidth, gridHeight, aspectRatio, maxWidth) {
        // Calculate available height based on viewport
        const headerHeight = 64; // Navbar height from CSS
        const paddingVertical = 320; // Increased padding for smaller default canvas
        const availableHeight = window.innerHeight - headerHeight - paddingVertical;

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
        const maxCellWidth = CONFIG.MAX_CANVAS_SIZE / gridWidth;
        const maxCellHeight = CONFIG.MAX_CANVAS_SIZE / gridHeight;

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

    // Update canvas sizes and redraw
    update(gridWidth, gridHeight, aspectRatio, previewRepeatX, previewRepeatY, grid, patternColors, backgroundColor) {
        // Calculate viewport constraints
        const collapsedPanelWidth = 40;
        const paddingHorizontal = 480;
        const gap = 96; // var(--space-12) from CSS
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

    // Draw edit canvas
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

    // Draw preview canvas
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

    // Get cell coordinates from mouse event
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
