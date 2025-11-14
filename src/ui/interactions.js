// ============================================
// CANVAS INTERACTIONS MODULE
// ============================================

import { CONFIG } from '../config.js';

/**
 * Setup canvas interaction events
 * @param {Object} deps - Dependencies object
 * @param {Object} deps.canvasManager - Canvas manager instance
 * @param {Function} deps.getHasInteracted - Function to check if user has interacted
 * @param {Function} deps.setHasInteracted - Function to set has interacted flag
 * @param {Function} deps.getIsDrawing - Function to check if user is drawing
 * @param {Function} deps.setIsDrawing - Function to set drawing state
 * @param {Function} deps.getInitialCellState - Function to get initial cell state
 * @param {Function} deps.setInitialCellState - Function to set initial cell state
 * @param {Function} deps.getLastPaintedCell - Function to get last painted cell
 * @param {Function} deps.setLastPaintedCell - Function to set last painted cell
 * @param {Function} deps.getGridWidth - Function to get grid width
 * @param {Function} deps.getGridHeight - Function to get grid height
 * @param {Function} deps.getGrid - Function to get grid
 * @param {Function} deps.paintCell - Function to paint a cell
 * @param {Function} deps.saveToHistory - Function to save to history
 */
export function setupCanvasInteractions(deps) {
    const {
        canvasManager,
        getHasInteracted,
        setHasInteracted,
        getIsDrawing,
        setIsDrawing,
        getInitialCellState,
        setInitialCellState,
        getLastPaintedCell,
        setLastPaintedCell,
        getGridWidth,
        getGridHeight,
        getGrid,
        paintCell,
        saveToHistory
    } = deps;

    /**
     * Hide canvas instructions after first interaction
     */
    function hideCanvasInstructions() {
        if (!getHasInteracted()) {
            setHasInteracted(true);
            const instructions = document.getElementById('canvasInstructions');
            instructions.classList.add('fade-out');
            setTimeout(() => {
                instructions.style.display = 'none';
            }, CONFIG.INSTRUCTIONS_FADE_TIME);
        }
    }

    /**
     * Setup all canvas event listeners
     */
    function setupCanvasEvents() {
        canvasManager.editCanvas.addEventListener('mousedown', (e) => {
            hideCanvasInstructions();
            setIsDrawing(true);
            const { row, col } = canvasManager.getCellFromMouse(e, getGridWidth(), getGridHeight());

            const grid = getGrid();
            const gridHeight = getGridHeight();
            const gridWidth = getGridWidth();
            if (row >= 0 && row < gridHeight && col >= 0 && col < gridWidth) {
                setInitialCellState(grid[row][col]);
            }

            paintCell(row, col, e.shiftKey, true);
        });

        canvasManager.editCanvas.addEventListener('mousemove', (e) => {
            if (getIsDrawing()) {
                const { row, col } = canvasManager.getCellFromMouse(e, getGridWidth(), getGridHeight());
                paintCell(row, col, e.shiftKey, false);
            }
        });

        canvasManager.editCanvas.addEventListener('mouseup', () => {
            if (getIsDrawing()) {
                setIsDrawing(false);
                setInitialCellState(null);
                setLastPaintedCell({ row: -1, col: -1 });
                saveToHistory();
            }
        });

        canvasManager.editCanvas.addEventListener('mouseleave', () => {
            if (getIsDrawing()) {
                setIsDrawing(false);
                setInitialCellState(null);
                setLastPaintedCell({ row: -1, col: -1 });
                saveToHistory();
            }
        });
    }

    return {
        hideCanvasInstructions,
        setupCanvasEvents
    };
}
