import { CONFIG } from '../config.js';
import { Utils } from '../utils.js';

// ============================================
// GRID OPERATIONS
// ============================================

/**
 * Calculate the bounding box of all painted cells
 * @param {Array} grid - 2D grid array
 * @param {number} gridWidth - Grid width
 * @param {number} gridHeight - Grid height
 * @returns {Object|null} - Bounding box or null if empty
 */
export function getContentBounds(grid, gridWidth, gridHeight) {
    let minRow = gridHeight;
    let maxRow = -1;
    let minCol = gridWidth;
    let maxCol = -1;

    for (let row = 0; row < gridHeight; row++) {
        for (let col = 0; col < gridWidth; col++) {
            if (grid[row][col] !== 0) {
                minRow = Math.min(minRow, row);
                maxRow = Math.max(maxRow, row);
                minCol = Math.min(minCol, col);
                maxCol = Math.max(maxCol, col);
            }
        }
    }

    // If no content, return null
    if (maxRow === -1) {
        return null;
    }

    return {
        minRow,
        maxRow,
        minCol,
        maxCol,
        width: maxCol - minCol + 1,
        height: maxRow - minRow + 1
    };
}

/**
 * Show visual feedback when resize is blocked
 * @param {string} direction - Direction that was blocked (optional)
 */
export function showResizeBlocked(direction) {
    const canvas = document.getElementById('editCanvas');
    const container = canvas.parentElement;

    // Flash the border red
    container.style.transition = 'none';
    container.style.outline = '3px solid var(--color-danger)';
    container.style.outlineOffset = '-3px';

    setTimeout(() => {
        container.style.transition = 'outline 300ms ease';
        container.style.outline = 'none';
    }, 100);

    // Flash the specific handle if it's an edge resize
    if (direction) {
        const handle = document.querySelector(`.resize-handle-${direction}`);
        if (handle) {
            handle.style.background = 'var(--color-danger)';
            setTimeout(() => {
                handle.style.background = '';
            }, 300);
        }
    }
}

/**
 * Create a new empty grid
 * @param {number} width - Grid width
 * @param {number} height - Grid height
 * @returns {Array} - New 2D grid array filled with zeros
 */
export function createEmptyGrid(width, height) {
    return Array(height).fill(null).map(() =>
        Array(width).fill(0)
    );
}

/**
 * Resize grid while preserving pattern position relative to center
 * @param {Object} params - Parameters object
 * @param {number[][]} params.grid - Current grid array
 * @param {number} params.gridWidth - Current grid width
 * @param {number} params.gridHeight - Current grid height
 * @param {number} params.newWidth - Target grid width
 * @param {number} params.newHeight - Target grid height
 * @returns {{grid: number[][], width: number, height: number}|false} New grid data or false if resize would crop content
 */
export function resizeGrid(params) {
    const { grid, gridWidth, gridHeight, newWidth, newHeight } = params;

    // Prevent resize if it would crop painted content
    // Find the bounding box of all non-empty cells
    const bounds = getContentBounds(grid, gridWidth, gridHeight);
    if (bounds) {
        // If the new dimensions are smaller than the content bounds, reject the resize
        if (newWidth < bounds.width || newHeight < bounds.height) {
            showResizeBlocked();
            return false;
        }
    }

    // Create new grid filled with background (all cells = 0)
    const newGrid = createEmptyGrid(newWidth, newHeight);

    // Calculate how much to shift content to keep it centered
    // When resizing, we want the pattern to stay centered relative to the grid
    // Example: 5x5 grid (center at 2,2) → 7x7 grid (center at 3,3) = shift by (1,1)
    const oldGridCenterX = Math.floor(gridWidth / 2);
    const oldGridCenterY = Math.floor(gridHeight / 2);
    const newGridCenterX = Math.floor(newWidth / 2);
    const newGridCenterY = Math.floor(newHeight / 2);

    const shiftX = newGridCenterX - oldGridCenterX;
    const shiftY = newGridCenterY - oldGridCenterY;

    // Copy all cells from old grid to new grid, applying the centering shift
    for (let row = 0; row < gridHeight; row++) {
        for (let col = 0; col < gridWidth; col++) {
            const newCol = col + shiftX;
            const newRow = row + shiftY;

            // Only copy if the shifted position is within the new grid bounds
            // Cells that shift outside the bounds are discarded (though this shouldn't
            // happen since we already checked content bounds above)
            if (newRow >= 0 && newRow < newHeight && newCol >= 0 && newCol < newWidth) {
                newGrid[newRow][newCol] = grid[row][col];
            }
        }
    }

    return {
        grid: newGrid,
        width: newWidth,
        height: newHeight
    };
}

/**
 * Resize grid by adding/removing cells at a specific edge
 * @param {Object} params - Parameters object
 * @param {number[][]} params.grid - Current grid array
 * @param {number} params.gridWidth - Current grid width
 * @param {number} params.gridHeight - Current grid height
 * @param {string} params.direction - Edge to resize ('top', 'right', 'bottom', 'left')
 * @param {number} params.delta - Amount to change size (positive or negative)
 * @returns {{grid: number[][], width: number, height: number}|null} New grid data or null if blocked/no change
 */
export function resizeGridFromEdge(params) {
    const { grid, gridWidth, gridHeight, direction, delta } = params;

    let newWidth = gridWidth;
    let newHeight = gridHeight;

    // Calculate new dimensions based on which edge is being dragged
    // delta can be positive (growing) or negative (shrinking)
    if (direction === 'right' || direction === 'left') {
        newWidth = gridWidth + delta;
    } else if (direction === 'bottom' || direction === 'top') {
        newHeight = gridHeight + delta;
    }

    // Enforce grid size limits
    newWidth = Utils.clamp(newWidth, CONFIG.MIN_GRID_SIZE, CONFIG.MAX_GRID_SIZE);
    newHeight = Utils.clamp(newHeight, CONFIG.MIN_GRID_SIZE, CONFIG.MAX_GRID_SIZE);

    // Prevent shrinking if it would crop painted content
    // Only check when delta < 0 (shrinking) to avoid unnecessary checks when growing
    const bounds = getContentBounds(grid, gridWidth, gridHeight);
    if (bounds && delta < 0) {
        // Check each edge based on the direction to see if content would be cropped
        // For right edge: ensure new width includes rightmost painted cell (maxCol + 1)
        // For left edge: ensure we don't remove columns that contain painted cells (minCol)
        // Similar logic for top and bottom edges
        if (direction === 'right' && newWidth < bounds.maxCol + 1) {
            showResizeBlocked(direction);
            return null;
        } else if (direction === 'left' && gridWidth - newWidth > bounds.minCol) {
            showResizeBlocked(direction);
            return null;
        } else if (direction === 'bottom' && newHeight < bounds.maxRow + 1) {
            showResizeBlocked(direction);
            return null;
        } else if (direction === 'top' && gridHeight - newHeight > bounds.minRow) {
            showResizeBlocked(direction);
            return null;
        }
    }

    // If no actual change in dimensions (e.g., already at max/min), return null
    if (newWidth === gridWidth && newHeight === gridHeight) {
        return null;
    }

    // Create new grid filled with background (all cells = 0)
    const newGrid = createEmptyGrid(newWidth, newHeight);

    // Copy cells from old grid to new grid
    // The copy strategy depends on which edge is being dragged:
    // - right/bottom: content stays anchored to top-left, new cells added on right/bottom
    // - left/top: content shifts right/down, new cells added on left/top
    for (let row = 0; row < Math.min(gridHeight, newHeight); row++) {
        for (let col = 0; col < Math.min(gridWidth, newWidth); col++) {
            let sourceRow = row;
            let sourceCol = col;
            let targetRow = row;
            let targetCol = col;

            // Adjust copy offsets based on which edge is being dragged
            if (direction === 'top') {
                // When adding/removing from top, shift existing content down/up
                // Example: 5x5 → 7x5 from top means shift content down by 2 rows
                targetRow = row + (newHeight - gridHeight);
                if (targetRow >= 0 && targetRow < newHeight) {
                    newGrid[targetRow][targetCol] = grid[sourceRow][sourceCol];
                }
                continue;
            } else if (direction === 'left') {
                // When adding/removing from left, shift existing content right/left
                // Example: 5x5 → 5x7 from left means shift content right by 2 columns
                targetCol = col + (newWidth - gridWidth);
                if (targetCol >= 0 && targetCol < newWidth) {
                    newGrid[targetRow][targetCol] = grid[sourceRow][sourceCol];
                }
                continue;
            }

            // For right and bottom edges, content stays anchored to origin
            // Just copy directly without offset
            newGrid[targetRow][targetCol] = grid[sourceRow][sourceCol];
        }
    }

    return {
        grid: newGrid,
        width: newWidth,
        height: newHeight
    };
}
