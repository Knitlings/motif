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

        // Cache initial viewport dimensions for mobile stability (prevent jumping when browser chrome appears/disappears)
        const isLandscape = window.innerWidth > window.innerHeight;
        const isMobile = window.innerWidth <= CONFIG.MOBILE_BREAKPOINT || (isLandscape && window.innerHeight <= CONFIG.LANDSCAPE_HEIGHT_THRESHOLD);
        if (isMobile && isLandscape) {
            this.cachedViewportHeight = window.innerHeight;
        }
        if (isMobile && !isLandscape) {
            this.cachedViewportWidth = window.innerWidth;
        }

        // Update cache if orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                const newIsLandscape = window.innerWidth > window.innerHeight;
                const newIsMobile = window.innerWidth <= CONFIG.MOBILE_BREAKPOINT || (newIsLandscape && window.innerHeight <= CONFIG.LANDSCAPE_HEIGHT_THRESHOLD);
                if (newIsMobile && newIsLandscape) {
                    this.cachedViewportHeight = window.innerHeight;
                    this.cachedViewportWidth = null;
                } else if (newIsMobile && !newIsLandscape) {
                    this.cachedViewportHeight = null;
                    this.cachedViewportWidth = window.innerWidth;
                } else {
                    this.cachedViewportHeight = null;
                    this.cachedViewportWidth = null;
                }
            }, CONFIG.ORIENTATION_CHANGE_DELAY); // Small delay to let orientation settle
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
        const isMobile = window.innerWidth <= CONFIG.MOBILE_BREAKPOINT || (isLandscape && window.innerHeight <= CONFIG.LANDSCAPE_HEIGHT_THRESHOLD);
        const headerHeight = isMobile ? CONFIG.HEADER_HEIGHT_MOBILE : CONFIG.HEADER_HEIGHT_DESKTOP;

        // Reduce vertical padding significantly in landscape to use available height
        let paddingVertical;
        if (isMobile && isLandscape) {
            paddingVertical = CONFIG.PADDING_VERTICAL_MOBILE_LANDSCAPE;
        } else if (isMobile) {
            paddingVertical = CONFIG.PADDING_VERTICAL_MOBILE_PORTRAIT;
        } else {
            paddingVertical = CONFIG.PADDING_VERTICAL_DESKTOP;
        }

        // Use cached viewport height in mobile landscape to prevent jumping when browser bar appears/disappears
        let viewportHeight = window.innerHeight;
        if (isMobile && isLandscape && this.cachedViewportHeight) {
            // Use the cached height from initial load instead of current height
            // This keeps canvas size stable when browser bar slides in/out
            viewportHeight = this.cachedViewportHeight;
        }

        const availableHeight = viewportHeight - headerHeight - paddingVertical;

        // Try two approaches to determine optimal cell size:
        // 1. Width-constrained: Fit grid to available width, calculate height from aspect ratio
        // 2. Height-constrained: Fit grid to available height, calculate width from aspect ratio
        // Then use whichever produces smaller cells (both will fit on screen)

        // Approach 1: Start with maximum available width per cell
        const cellWidthByWidth = maxWidth / gridWidth;
        // Calculate corresponding height using the aspect ratio (aspectRatio = height/width)
        const cellHeightByWidth = cellWidthByWidth * aspectRatio;

        // Approach 2: Start with maximum available height per cell
        const cellHeightByHeight = availableHeight / gridHeight;
        // Calculate corresponding width using the aspect ratio
        const cellWidthByHeight = cellHeightByHeight / aspectRatio;

        // Choose the approach that gives smaller cells (ensures everything fits)
        // If width-constrained cells are smaller, the grid is too wide for the height
        // If height-constrained cells are smaller, the grid is too tall for the width
        let cellWidth, cellHeight;
        if (cellWidthByWidth <= cellWidthByHeight) {
            // Width is the limiting factor (grid is relatively wide)
            cellWidth = cellWidthByWidth;
            cellHeight = cellHeightByWidth;
        } else {
            // Height is the limiting factor (grid is relatively tall)
            cellWidth = cellWidthByHeight;
            cellHeight = cellHeightByHeight;
        }

        // Apply maximum canvas size constraint to prevent excessively large canvases
        // This limits total canvas dimensions (gridWidth * cellWidth and gridHeight * cellHeight)
        // In mobile landscape, allow larger canvases to use available space
        const maxCanvasSize = (isMobile && isLandscape) ? CONFIG.MAX_CANVAS_SIZE_MOBILE_LANDSCAPE : CONFIG.MAX_CANVAS_SIZE;
        const maxCellWidth = maxCanvasSize / gridWidth;
        const maxCellHeight = maxCanvasSize / gridHeight;

        if (cellWidth > maxCellWidth || cellHeight > maxCellHeight) {
            // Scale down proportionally to fit within max canvas size
            // Use the more restrictive constraint to ensure both dimensions fit
            const scaleFactor = Math.min(
                maxCellWidth / cellWidth,
                maxCellHeight / cellHeight
            );
            cellWidth *= scaleFactor;
            cellHeight *= scaleFactor;
        }

        // Apply minimum cell size constraint to ensure cells are always visible and clickable
        // This is a hard floor - cells must never be smaller than MIN_CELL_SIZE in either dimension
        if (cellWidth < CONFIG.MIN_CELL_SIZE || cellHeight < CONFIG.MIN_CELL_SIZE) {
            // Scale up proportionally based on whichever dimension is most constrained
            // This maintains the aspect ratio while ensuring minimum size
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
     * @param {Object} [options]
     * @param {boolean} [options.outlineRepeat=true] - Outline one repeat on the preview
     * @returns {{stacked: boolean, previewWidth: number, outlined: boolean, framed: boolean,
     *   frameWidth: number|null, frameHeight: number|null, cellWidth: number, cellHeight: number,
     *   stitchNumberEvery: number, rowNumberEvery: number}} The layout chosen
     */
    update(gridWidth, gridHeight, aspectRatio, previewRepeatX, previewRepeatY, grid, patternColors, backgroundColor, options = {}) {
        const { outlineRepeat = true } = options;
        // Calculate viewport constraints - adjust for mobile vs desktop
        // Use cached dimensions if available for consistency
        const currentWidth = window.innerWidth;
        const currentHeight = window.innerHeight;
        const currentIsLandscape = currentWidth > currentHeight;
        const currentIsMobile = currentWidth <= CONFIG.MOBILE_BREAKPOINT || (currentIsLandscape && currentHeight <= CONFIG.LANDSCAPE_HEIGHT_THRESHOLD);

        // Use cached width for mobile portrait if available
        const effectiveWidth = (currentIsMobile && !currentIsLandscape && this.cachedViewportWidth) ? this.cachedViewportWidth : currentWidth;

        const isLandscape = effectiveWidth > currentHeight;
        const isMobile = effectiveWidth <= CONFIG.MOBILE_BREAKPOINT || (isLandscape && currentHeight <= CONFIG.LANDSCAPE_HEIGHT_THRESHOLD);
        const isSmallMobile = effectiveWidth <= CONFIG.SMALL_MOBILE_BREAKPOINT;

        let cellSize, shouldStack;
        let framed = false;
        let frameWidth = null;
        let frameHeight = null;
        const plateWidth = effectiveWidth - 2 * CONFIG.PLATE_PADDING_DESKTOP;
        if (!isMobile) {
            // Desktop plate: the chart fills its column, as wide as the key. The column widens
            // with a chart held at the 20px floor; chart and preview stay side by side while
            // both fit at their natural sizes.
            cellSize = this.calculateCellSize(gridWidth, gridHeight, aspectRatio, CONFIG.CHART_COLUMN_WIDTH);
            const chartWidth = gridWidth * cellSize.width;
            const chartHeight = gridHeight * cellSize.height;
            const chartColumnWidth = Math.max(CONFIG.CHART_COLUMN_MIN_WIDTH, chartWidth + CONFIG.CHART_COLUMN_RESERVE);
            const previewNaturalWidth = chartWidth * previewRepeatX * CONFIG.PREVIEW_SCALE;
            shouldStack = chartColumnWidth + CONFIG.PREVIEW_COLUMN_PADDING + previewNaturalWidth > plateWidth;

            // Too large for the page at the 20px floor: the chart keeps its squares and
            // scrolls in a frame as wide as the page, leaving room for caption and key
            const pageHeight = window.innerHeight - CONFIG.HEADER_HEIGHT_DESKTOP - 2 * CONFIG.PLATE_PADDING_VERTICAL;
            const numbered = { width: chartWidth + CONFIG.CHART_NUMBERS_WIDTH + 2, height: chartHeight + CONFIG.CHART_NUMBERS_HEIGHT + 2 };
            if (numbered.width > plateWidth || numbered.height > pageHeight) {
                framed = true;
                shouldStack = true;
                // In the frame the numbers sit in 30px and 20px strips; leave room for a scrollbar
                const scrollbar = 16;
                frameWidth = Math.min(chartWidth + 30 + 2 + scrollbar, plateWidth);
                frameHeight = Math.min(
                    chartHeight + 20 + 2 + scrollbar,
                    Math.max(CONFIG.MIN_FRAME_HEIGHT, window.innerHeight - CONFIG.HEADER_HEIGHT_DESKTOP - CONFIG.CHART_FRAME_RESERVE)
                );
            }
        } else {
            // On mobile, panels are overlays (not side-by-side), so ignore panel width
            const collapsedPanelWidth = isMobile ? 0 : CONFIG.COLLAPSED_PANEL_WIDTH;

            // Adjust padding based on screen size and orientation
            let paddingHorizontal;
            if (isSmallMobile && !isLandscape) {
                paddingHorizontal = CONFIG.PADDING_HORIZONTAL_SMALL_MOBILE;
            } else if (isMobile) {
                // In landscape, use minimal padding to maximize canvas space (like mini-desktop)
                paddingHorizontal = isLandscape ? CONFIG.PADDING_HORIZONTAL_SMALL_MOBILE : CONFIG.PADDING_HORIZONTAL_MOBILE;
            } else {
                paddingHorizontal = CONFIG.PADDING_HORIZONTAL_DESKTOP;
            }

            // Gap between canvases - smaller in landscape to encourage side-by-side layout
            const gap = (isMobile && isLandscape) ? CONFIG.CANVAS_GAP_MOBILE_LANDSCAPE : (isMobile ? CONFIG.CANVAS_GAP_MOBILE : CONFIG.CANVAS_GAP_DESKTOP);

            // Calculate available width using effectiveWidth for consistency; the row numbers sit beside the chart
            const availableWidth = effectiveWidth - (collapsedPanelWidth * 2) - paddingHorizontal - CONFIG.CHART_NUMBERS_WIDTH;

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
            // Force stacking on mobile portrait to maximize grid size
            if (canFitSideBySide && !(isMobile && !isLandscape)) {
                // Use the side-by-side cell size
                cellSize = cellSizeSideBySide;
                shouldStack = false;
            } else {
                // Recalculate with full available width for stacked layout
                cellSize = this.calculateCellSize(gridWidth, gridHeight, aspectRatio, availableWidth);
                shouldStack = true;
            }
        }

        // Calculate final canvas dimensions
        const editCanvasWidth = gridWidth * cellSize.width;
        const editCanvasHeight = gridHeight * cellSize.height;

        // Preview at its natural scale
        const previewNaturalWidth = gridWidth * cellSize.width * previewRepeatX * CONFIG.PREVIEW_SCALE;
        const previewNaturalHeight = gridHeight * cellSize.height * previewRepeatY * CONFIG.PREVIEW_SCALE;

        // Calculate final preview size
        let previewWidth, previewHeight;
        if (framed) {
            // A framed chart's preview is scaled to fit the page instead
            const scale = Math.min(1, plateWidth / previewNaturalWidth);
            previewWidth = previewNaturalWidth * scale;
            previewHeight = previewNaturalHeight * scale;
        } else if (shouldStack) {
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

        // Outline one repeat: the centre one, or the one before the centre for even counts
        const outlined = outlineRepeat && (previewRepeatX > 1 || previewRepeatY > 1);
        if (outlined) {
            this.drawRepeatOutline(
                Math.floor((previewRepeatX - 1) / 2) * gridWidth * previewCellWidth,
                Math.floor((previewRepeatY - 1) / 2) * gridHeight * previewCellHeight,
                gridWidth * previewCellWidth,
                gridHeight * previewCellHeight
            );
        }

        return {
            stacked: shouldStack,
            previewWidth,
            outlined,
            framed,
            frameWidth,
            frameHeight,
            cellWidth: cellSize.width,
            cellHeight: cellSize.height,
            stitchNumberEvery: gridWidth > CONFIG.NUMBER_EVERY_UP_TO ? 5 : 1,
            rowNumberEvery: gridHeight > CONFIG.NUMBER_EVERY_UP_TO ? 5 : 1
        };
    },

    /**
     * Frame one repeat on the preview: a heavy ink line with a thin paper line around it,
     * so it reads on any colour
     */
    drawRepeatOutline(x, y, width, height) {
        const ctx = this.previewCtx;
        const heavy = CONFIG.REPEAT_OUTLINE_WIDTH;
        ctx.save();
        ctx.lineWidth = 1;
        ctx.strokeStyle = CONFIG.REPEAT_OUTLINE_HALO;
        ctx.strokeRect(x - 0.5, y - 0.5, width + 1, height + 1);
        ctx.lineWidth = heavy;
        ctx.strokeStyle = CONFIG.REPEAT_OUTLINE_COLOR;
        ctx.strokeRect(x + heavy / 2, y + heavy / 2, width - heavy, height - heavy);
        ctx.restore();
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

        // Larger charts: a darker rule every tenth stitch and row, counted from the right and bottom
        const ruleStitches = gridWidth > CONFIG.NUMBER_EVERY_UP_TO;
        const ruleRows = gridHeight > CONFIG.NUMBER_EVERY_UP_TO;
        if (ruleStitches || ruleRows) {
            const ctx = this.editCtx;
            ctx.save();
            ctx.strokeStyle = CONFIG.TENTH_RULE_COLOR;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let n = 10; ruleStitches && n < gridWidth; n += 10) {
                const x = Math.round((gridWidth - n) * cellWidth) + 0.5;
                ctx.moveTo(x, 0);
                ctx.lineTo(x, gridHeight * cellHeight);
            }
            for (let n = 10; ruleRows && n < gridHeight; n += 10) {
                const y = Math.round((gridHeight - n) * cellHeight) + 0.5;
                ctx.moveTo(0, y);
                ctx.lineTo(gridWidth * cellWidth, y);
            }
            ctx.stroke();
            ctx.restore();
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
