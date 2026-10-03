// ============================================
// CANVAS INTERACTIONS MODULE
// ============================================

import { UI_CONSTANTS } from '../config.js';

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
     * Remember that the pattern has been painted (restores undo history after a reload)
     */
    function markInteracted() {
        if (!getHasInteracted()) {
            setHasInteracted(true);
        }
    }

    /**
     * Start painting at the pointer: the first square decides whether the stroke paints or erases
     */
    function beginStroke(e) {
        markInteracted();
        setIsDrawing(true);
        const { row, col } = canvasManager.getCellFromMouse(e, getGridWidth(), getGridHeight());
        if (row >= 0 && row < getGridHeight() && col >= 0 && col < getGridWidth()) {
            setInitialCellState(getGrid()[row][col]);
        }
        paintCell(row, col, e.shiftKey, true);
    }

    function endStroke() {
        if (getIsDrawing()) {
            setIsDrawing(false);
            setInitialCellState(null);
            setLastPaintedCell({ row: -1, col: -1 });
            saveToHistory();
        }
    }

    /**
     * Setup all canvas event listeners. A mouse paints as it drags. A finger or pen paints the
     * square it taps; a drag is left to the browser, so it moves a framed chart in its frame
     * and moves the page anywhere else.
     */
    function setupCanvasEvents() {
        const canvas = canvasManager.editCanvas;
        let tap = null; // { id, x, y } while a touch may still be a tap

        canvas.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse') {
                if (e.button === 0) beginStroke(e);
                return;
            }
            tap = e.isPrimary ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null;
        });

        canvas.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'mouse') {
                if (getIsDrawing()) {
                    const { row, col } = canvasManager.getCellFromMouse(e, getGridWidth(), getGridHeight());
                    paintCell(row, col, e.shiftKey, false);
                }
                return;
            }
            if (tap && e.pointerId === tap.id &&
                Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > UI_CONSTANTS.DRAG_THRESHOLD) {
                tap = null;
            }
        });

        canvas.addEventListener('pointerup', (e) => {
            if (e.pointerType === 'mouse') {
                endStroke();
                return;
            }
            if (tap && e.pointerId === tap.id) {
                tap = null;
                beginStroke(e);
                endStroke();
            }
        });

        // The browser took the touch over to scroll
        canvas.addEventListener('pointercancel', () => {
            tap = null;
        });

        canvas.addEventListener('pointerleave', (e) => {
            if (e.pointerType === 'mouse') endStroke();
        });
    }

    return {
        markInteracted,
        setupCanvasEvents
    };
}
