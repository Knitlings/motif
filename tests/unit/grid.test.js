import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    getContentBounds,
    createEmptyGrid,
    resizeGrid,
    resizeGridFromEdge,
    showResizeBlocked
} from '../../src/core/grid.js';

describe('Grid Operations', () => {
    describe('getContentBounds()', () => {
        it('should return bounds for a grid with content', () => {
            const grid = [
                [0, 0, 0, 0],
                [0, 1, 2, 0],
                [0, 3, 0, 0],
                [0, 0, 0, 0]
            ];

            const bounds = getContentBounds(grid, 4, 4);

            expect(bounds).toEqual({
                minRow: 1,
                maxRow: 2,
                minCol: 1,
                maxCol: 2,
                width: 2,
                height: 2
            });
        });

        it('should return null for empty grid', () => {
            const grid = [
                [0, 0, 0],
                [0, 0, 0],
                [0, 0, 0]
            ];

            const bounds = getContentBounds(grid, 3, 3);

            expect(bounds).toBeNull();
        });

        it('should handle content at grid edges', () => {
            const grid = [
                [1, 0, 0, 2],
                [0, 0, 0, 0],
                [3, 0, 0, 4]
            ];

            const bounds = getContentBounds(grid, 4, 3);

            expect(bounds).toEqual({
                minRow: 0,
                maxRow: 2,
                minCol: 0,
                maxCol: 3,
                width: 4,
                height: 3
            });
        });

        it('should handle single cell content', () => {
            const grid = [
                [0, 0, 0],
                [0, 5, 0],
                [0, 0, 0]
            ];

            const bounds = getContentBounds(grid, 3, 3);

            expect(bounds).toEqual({
                minRow: 1,
                maxRow: 1,
                minCol: 1,
                maxCol: 1,
                width: 1,
                height: 1
            });
        });
    });

    describe('createEmptyGrid()', () => {
        it('should create grid with correct dimensions', () => {
            const grid = createEmptyGrid(3, 2);

            expect(grid.length).toBe(2); // height (rows)
            expect(grid[0].length).toBe(3); // width (cols)
        });

        it('should fill grid with zeros', () => {
            const grid = createEmptyGrid(2, 2);

            expect(grid).toEqual([
                [0, 0],
                [0, 0]
            ]);
        });

        it('should handle 1x1 grid', () => {
            const grid = createEmptyGrid(1, 1);

            expect(grid).toEqual([[0]]);
        });

        it('should handle large grids', () => {
            const grid = createEmptyGrid(100, 100);

            expect(grid.length).toBe(100);
            expect(grid[0].length).toBe(100);
            expect(grid[50][50]).toBe(0);
        });
    });

    describe('resizeGrid()', () => {
        it('should resize grid while preserving center content', () => {
            const grid = [
                [0, 0, 0],
                [0, 1, 0],
                [0, 0, 0]
            ];

            const result = resizeGrid({
                grid,
                gridWidth: 3,
                gridHeight: 3,
                newWidth: 5,
                newHeight: 5
            });

            expect(result).toBeTruthy();
            expect(result.width).toBe(5);
            expect(result.height).toBe(5);

            // Center cell (1) should still be at center
            expect(result.grid[2][2]).toBe(1); // Center of 5x5 is (2,2)
        });

        it('should shrink grid without cropping content', () => {
            const grid = [
                [0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0],
                [0, 0, 1, 0, 0],
                [0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0]
            ];

            const result = resizeGrid({
                grid,
                gridWidth: 5,
                gridHeight: 5,
                newWidth: 3,
                newHeight: 3
            });

            expect(result).toBeTruthy();
            expect(result.width).toBe(3);
            expect(result.height).toBe(3);
            expect(result.grid[1][1]).toBe(1); // Center preserved
        });

        it('should block resize if content would be cropped', () => {
            // Mock DOM elements for showResizeBlocked
            const mockCanvas = document.createElement('canvas');
            mockCanvas.id = 'editCanvas';
            const mockContainer = document.createElement('div');
            mockContainer.appendChild(mockCanvas);
            document.body.appendChild(mockContainer);

            const grid = [
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9]
            ];

            const result = resizeGrid({
                grid,
                gridWidth: 3,
                gridHeight: 3,
                newWidth: 2,
                newHeight: 2
            });

            expect(result).toBe(false);

            // Cleanup
            document.body.removeChild(mockContainer);
        });

        it('should handle expanding empty grid', () => {
            const grid = [
                [0, 0],
                [0, 0]
            ];

            const result = resizeGrid({
                grid,
                gridWidth: 2,
                gridHeight: 2,
                newWidth: 4,
                newHeight: 4
            });

            expect(result).toBeTruthy();
            expect(result.width).toBe(4);
            expect(result.height).toBe(4);
            // All cells should be 0
            expect(result.grid.flat().every(cell => cell === 0)).toBe(true);
        });
    });

    describe('resizeGridFromEdge()', () => {
        it('should add columns to the right', () => {
            const grid = [
                [1, 2],
                [3, 4]
            ];

            const result = resizeGridFromEdge({
                grid,
                gridWidth: 2,
                gridHeight: 2,
                direction: 'right',
                delta: 1
            });

            expect(result).toBeTruthy();
            expect(result.width).toBe(3);
            expect(result.height).toBe(2);
            expect(result.grid).toEqual([
                [1, 2, 0],
                [3, 4, 0]
            ]);
        });

        it('should add rows to the bottom', () => {
            const grid = [
                [1, 2],
                [3, 4]
            ];

            const result = resizeGridFromEdge({
                grid,
                gridWidth: 2,
                gridHeight: 2,
                direction: 'bottom',
                delta: 1
            });

            expect(result).toBeTruthy();
            expect(result.width).toBe(2);
            expect(result.height).toBe(3);
            expect(result.grid).toEqual([
                [1, 2],
                [3, 4],
                [0, 0]
            ]);
        });

        it('should add columns to the left (shifting content right)', () => {
            const grid = [
                [1, 2],
                [3, 4]
            ];

            const result = resizeGridFromEdge({
                grid,
                gridWidth: 2,
                gridHeight: 2,
                direction: 'left',
                delta: 1
            });

            expect(result).toBeTruthy();
            expect(result.width).toBe(3);
            expect(result.grid).toEqual([
                [0, 1, 2],
                [0, 3, 4]
            ]);
        });

        it('should add rows to the top (shifting content down)', () => {
            const grid = [
                [1, 2],
                [3, 4]
            ];

            const result = resizeGridFromEdge({
                grid,
                gridWidth: 2,
                gridHeight: 2,
                direction: 'top',
                delta: 1
            });

            expect(result).toBeTruthy();
            expect(result.height).toBe(3);
            expect(result.grid).toEqual([
                [0, 0],
                [1, 2],
                [3, 4]
            ]);
        });

        it('should remove columns from the right', () => {
            const grid = [
                [1, 2, 0],
                [3, 4, 0]
            ];

            const result = resizeGridFromEdge({
                grid,
                gridWidth: 3,
                gridHeight: 2,
                direction: 'right',
                delta: -1
            });

            expect(result).toBeTruthy();
            expect(result.width).toBe(2);
            expect(result.grid).toEqual([
                [1, 2],
                [3, 4]
            ]);
        });

        it('should block removal if content would be cropped (right edge)', () => {
            // Mock DOM elements for showResizeBlocked
            const mockCanvas = document.createElement('canvas');
            mockCanvas.id = 'editCanvas';
            const mockContainer = document.createElement('div');
            mockContainer.appendChild(mockCanvas);
            document.body.appendChild(mockContainer);

            const grid = [
                [1, 2, 3],
                [4, 5, 6]
            ];

            const result = resizeGridFromEdge({
                grid,
                gridWidth: 3,
                gridHeight: 2,
                direction: 'right',
                delta: -1
            });

            expect(result).toBeNull();

            // Cleanup
            document.body.removeChild(mockContainer);
        });

        it('should block removal if content would be cropped (left edge)', () => {
            // Mock DOM elements for showResizeBlocked
            const mockCanvas = document.createElement('canvas');
            mockCanvas.id = 'editCanvas';
            const mockContainer = document.createElement('div');
            mockContainer.appendChild(mockCanvas);
            document.body.appendChild(mockContainer);

            const grid = [
                [1, 0, 0],
                [2, 0, 0]
            ];

            const result = resizeGridFromEdge({
                grid,
                gridWidth: 3,
                gridHeight: 2,
                direction: 'left',
                delta: -1
            });

            expect(result).toBeNull();

            // Cleanup
            document.body.removeChild(mockContainer);
        });

        it('should return null if no change in size', () => {
            // Mock DOM elements for showResizeBlocked (might be called during clamping)
            const mockCanvas = document.createElement('canvas');
            mockCanvas.id = 'editCanvas';
            const mockContainer = document.createElement('div');
            mockContainer.appendChild(mockCanvas);
            document.body.appendChild(mockContainer);

            const grid = [[0, 0], [0, 0]];

            // Try to resize but clamp to same size (already at min)
            const result = resizeGridFromEdge({
                grid,
                gridWidth: 2,
                gridHeight: 2,
                direction: 'right',
                delta: -10 // Try to shrink below min, will clamp to 2 (no change)
            });

            // After clamping to min (2), if already at 2, it returns null
            expect(result).toBeNull();

            // Cleanup
            document.body.removeChild(mockContainer);
        });

        it('should clamp to max grid size', () => {
            const grid = createEmptyGrid(99, 99);

            const result = resizeGridFromEdge({
                grid,
                gridWidth: 99,
                gridHeight: 99,
                direction: 'right',
                delta: 10 // Try to add 10, but should clamp to max (100)
            });

            expect(result).toBeTruthy();
            expect(result.width).toBe(100); // Should be clamped to CONFIG.MAX_GRID_SIZE
        });

        it('should clamp to min grid size', () => {
            const grid = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

            const result = resizeGridFromEdge({
                grid,
                gridWidth: 3,
                gridHeight: 3,
                direction: 'right',
                delta: -10 // Try to remove 10, but should clamp to min (2)
            });

            expect(result).toBeTruthy();
            expect(result.width).toBe(2); // Should be clamped to CONFIG.MIN_GRID_SIZE
        });
    });

    describe('showResizeBlocked()', () => {
        it('should not throw when DOM elements exist', () => {
            // Mock DOM elements
            const mockCanvas = document.createElement('canvas');
            mockCanvas.id = 'editCanvas';
            const mockContainer = document.createElement('div');
            mockContainer.appendChild(mockCanvas);
            document.body.appendChild(mockContainer);

            expect(() => showResizeBlocked()).not.toThrow();
            expect(() => showResizeBlocked('right')).not.toThrow();

            // Cleanup
            document.body.removeChild(mockContainer);
        });
    });
});
