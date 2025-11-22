import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageManager } from '../../src/managers/storage.js';

describe('StorageManager', () => {
    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
        // Clear any mocks
        vi.clearAllMocks();
    });

    describe('save()', () => {
        it('should save state to localStorage', () => {
            const state = {
                grid: [[0, 1], [2, 0]],
                gridWidth: 2,
                gridHeight: 2,
                patternColors: ['#ff0000', '#00ff00'],
                activePatternIndex: 0,
                backgroundColor: '#ffffff',
                aspectRatio: 1,
                previewRepeatX: 3,
                previewRepeatY: 3,
                hasInteracted: true,
                activePaletteId: 'motif',
                customPalette: null
            };

            StorageManager.save(state);

            const saved = localStorage.getItem(StorageManager.STORAGE_KEY);
            expect(saved).toBeTruthy();

            const parsed = JSON.parse(saved);
            expect(parsed.grid).toEqual([[0, 1], [2, 0]]);
            expect(parsed.gridWidth).toBe(2);
            expect(parsed.gridHeight).toBe(2);
            expect(parsed.patternColors).toEqual(['#ff0000', '#00ff00']);
            expect(parsed.backgroundColor).toBe('#ffffff');
        });

        it('should handle other storage errors gracefully', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            // Mock localStorage.setItem to throw generic error
            vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('Storage disabled');
            });

            const state = { grid: [[0]], gridWidth: 1 };

            // Should not throw
            expect(() => StorageManager.save(state)).not.toThrow();

            consoleWarnSpy.mockRestore();
        });
    });

    describe('load()', () => {
        it('should load state from localStorage', () => {
            const state = {
                grid: [[0, 1], [2, 0]],
                gridWidth: 2,
                gridHeight: 2,
                patternColors: ['#ff0000', '#00ff00'],
                activePatternIndex: 0,
                backgroundColor: '#ffffff',
                aspectRatio: 1,
                previewRepeatX: 3,
                previewRepeatY: 3,
                hasInteracted: true,
                activePaletteId: 'motif',
                customPalette: null
            };

            // Save first
            StorageManager.save(state);

            // Load
            const loaded = StorageManager.load();

            expect(loaded).toBeTruthy();
            expect(loaded.grid).toEqual([[0, 1], [2, 0]]);
            expect(loaded.gridWidth).toBe(2);
            expect(loaded.gridHeight).toBe(2);
            expect(loaded.patternColors).toEqual(['#ff0000', '#00ff00']);
        });

        it('should return null if no data exists', () => {
            const loaded = StorageManager.load();
            expect(loaded).toBeNull();
        });

        it('should handle corrupted data gracefully', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            // Store invalid JSON
            localStorage.setItem(StorageManager.STORAGE_KEY, 'invalid json{');

            const loaded = StorageManager.load();

            expect(loaded).toBeNull();
            expect(consoleWarnSpy).toHaveBeenCalled();

            consoleWarnSpy.mockRestore();
        });

        it('should handle localStorage access errors', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            // Mock localStorage.getItem to throw
            vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw new Error('Storage disabled');
            });

            const loaded = StorageManager.load();

            expect(loaded).toBeNull();

            consoleWarnSpy.mockRestore();
        });
    });

    describe('clear()', () => {
        it('should clear state from localStorage', () => {
            const state = {
                grid: [[0, 1]],
                gridWidth: 2,
                gridHeight: 1,
                patternColors: ['#ff0000'],
                backgroundColor: '#ffffff'
            };

            // Save first
            StorageManager.save(state);
            expect(localStorage.getItem(StorageManager.STORAGE_KEY)).toBeTruthy();

            // Clear
            StorageManager.clear();
            expect(localStorage.getItem(StorageManager.STORAGE_KEY)).toBeNull();
        });

        it('should handle clear errors gracefully', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            // Mock localStorage.removeItem to throw
            vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
                throw new Error('Storage disabled');
            });

            // Should not throw
            expect(() => StorageManager.clear()).not.toThrow();

            consoleWarnSpy.mockRestore();
        });
    });
});
