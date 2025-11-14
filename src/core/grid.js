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

    // Check if resize would crop content
    const bounds = getContentBounds(grid, gridWidth, gridHeight);
    if (bounds) {
        if (newWidth < bounds.width || newHeight < bounds.height) {
            showResizeBlocked();
            return false;
        }
    }

    // Create new grid filled with background
    const newGrid = createEmptyGrid(newWidth, newHeight);

    // Calculate shift needed: how much the center moves
    const oldGridCenterX = Math.floor(gridWidth / 2);
    const oldGridCenterY = Math.floor(gridHeight / 2);
    const newGridCenterX = Math.floor(newWidth / 2);
    const newGridCenterY = Math.floor(newHeight / 2);

    const shiftX = newGridCenterX - oldGridCenterX;
    const shiftY = newGridCenterY - oldGridCenterY;

    // Copy each cell, shifting by the same amount the center shifted
    for (let row = 0; row < gridHeight; row++) {
        for (let col = 0; col < gridWidth; col++) {
            const newCol = col + shiftX;
            const newRow = row + shiftY;

            // Only copy if the position is within the new grid bounds
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

    // Calculate new dimensions based on direction
    if (direction === 'right' || direction === 'left') {
        newWidth = gridWidth + delta;
    } else if (direction === 'bottom' || direction === 'top') {
        newHeight = gridHeight + delta;
    }

    // Clamp to valid range
    newWidth = Utils.clamp(newWidth, CONFIG.MIN_GRID_SIZE, CONFIG.MAX_GRID_SIZE);
    newHeight = Utils.clamp(newHeight, CONFIG.MIN_GRID_SIZE, CONFIG.MAX_GRID_SIZE);

    // Check if resize would crop content based on which edge we're resizing
    const bounds = getContentBounds(grid, gridWidth, gridHeight);
    if (bounds && delta < 0) { // Only check when shrinking
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

    // If no change, return null
    if (newWidth === gridWidth && newHeight === gridHeight) {
        return null;
    }

    // Create new grid filled with background
    const newGrid = createEmptyGrid(newWidth, newHeight);

    // Copy old grid data based on which edge is being dragged
    for (let row = 0; row < Math.min(gridHeight, newHeight); row++) {
        for (let col = 0; col < Math.min(gridWidth, newWidth); col++) {
            let sourceRow = row;
            let sourceCol = col;
            let targetRow = row;
            let targetCol = col;

            // Adjust offsets based on which edge we're dragging
            if (direction === 'top') {
                // Adding to top: shift existing content down
                targetRow = row + (newHeight - gridHeight);
                if (targetRow >= 0 && targetRow < newHeight) {
                    newGrid[targetRow][targetCol] = grid[sourceRow][sourceCol];
                }
                continue;
            } else if (direction === 'left') {
                // Adding to left: shift existing content right
                targetCol = col + (newWidth - gridWidth);
                if (targetCol >= 0 && targetCol < newWidth) {
                    newGrid[targetRow][targetCol] = grid[sourceRow][sourceCol];
                }
                continue;
            }

            // For right and bottom, just copy directly
            newGrid[targetRow][targetCol] = grid[sourceRow][sourceCol];
        }
    }

    return {
        grid: newGrid,
        width: newWidth,
        height: newHeight
    };
}
