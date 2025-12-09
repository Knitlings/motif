import { describe, it, expect, beforeEach, vi } from 'vitest';
import { exportJson, importJson, downloadFile, exportSvg, exportPng, exportPreviewSvg, exportPreviewPng } from '../../src/core/export.js';

describe('Export/Import Functions', () => {
    describe('exportJson()', () => {
        it('should export complete state to JSON blob', () => {
            const state = {
                grid: [[0, 1], [2, 0]],
                gridWidth: 2,
                gridHeight: 2,
                aspectRatio: 1,
                patternColors: ['#FF0000', '#00FF00', '#0000FF'],
                backgroundColor: '#FFFFFF',
                previewRepeatX: 3,
                previewRepeatY: 3,
                activePaletteId: 'motif',
                customPalette: null
            };

            const blob = exportJson(state);

            expect(blob).toBeInstanceOf(Blob);
            expect(blob.type).toBe('application/json');
        });

        it('should include version number in export', async () => {
            const state = {
                grid: [[0]],
                gridWidth: 1,
                gridHeight: 1,
                aspectRatio: 1,
                patternColors: ['#FF0000'],
                backgroundColor: '#FFFFFF',
                previewRepeatX: 3,
                previewRepeatY: 3,
                activePaletteId: 'motif',
                customPalette: null
            };

            const blob = exportJson(state);
            const text = await blob.text();
            const data = JSON.parse(text);

            expect(data.version).toBe(1);
        });

        it('should include timestamp in export', async () => {
            const state = {
                grid: [[0]],
                gridWidth: 1,
                gridHeight: 1,
                aspectRatio: 1,
                patternColors: ['#FF0000'],
                backgroundColor: '#FFFFFF',
                previewRepeatX: 3,
                previewRepeatY: 3,
                activePaletteId: 'motif',
                customPalette: null
            };

            const blob = exportJson(state);
            const text = await blob.text();
            const data = JSON.parse(text);

            expect(data.created).toBeTruthy();
            expect(new Date(data.created)).toBeInstanceOf(Date);
        });

        it('should structure grid data correctly', async () => {
            const state = {
                grid: [[0, 1], [2, 0]],
                gridWidth: 2,
                gridHeight: 2,
                aspectRatio: 1.5,
                patternColors: ['#FF0000', '#00FF00', '#0000FF'],
                backgroundColor: '#FFFFFF',
                previewRepeatX: 4,
                previewRepeatY: 5,
                activePaletteId: 'custom',
                customPalette: ['#AABBCC']
            };

            const blob = exportJson(state);
            const text = await blob.text();
            const data = JSON.parse(text);

            expect(data.grid.width).toBe(2);
            expect(data.grid.height).toBe(2);
            expect(data.grid.aspectRatio).toBe(1.5);
            expect(data.grid.cells).toEqual([[0, 1], [2, 0]]);
        });

        it('should include colors in export', async () => {
            const state = {
                grid: [[0]],
                gridWidth: 1,
                gridHeight: 1,
                aspectRatio: 1,
                patternColors: ['#FF0000', '#00FF00'],
                backgroundColor: '#FFFFFF',
                previewRepeatX: 3,
                previewRepeatY: 3,
                activePaletteId: 'motif',
                customPalette: null
            };

            const blob = exportJson(state);
            const text = await blob.text();
            const data = JSON.parse(text);

            expect(data.colors.background).toBe('#FFFFFF');
            expect(data.colors.pattern).toEqual(['#FF0000', '#00FF00']);
        });

        it('should include preview settings in export', async () => {
            const state = {
                grid: [[0]],
                gridWidth: 1,
                gridHeight: 1,
                aspectRatio: 1,
                patternColors: ['#FF0000'],
                backgroundColor: '#FFFFFF',
                previewRepeatX: 7,
                previewRepeatY: 8,
                activePaletteId: 'motif',
                customPalette: null
            };

            const blob = exportJson(state);
            const text = await blob.text();
            const data = JSON.parse(text);

            expect(data.preview.repeatX).toBe(7);
            expect(data.preview.repeatY).toBe(8);
        });

        it('should include palette settings in export', async () => {
            const state = {
                grid: [[0]],
                gridWidth: 1,
                gridHeight: 1,
                aspectRatio: 1,
                patternColors: ['#FF0000'],
                backgroundColor: '#FFFFFF',
                previewRepeatX: 3,
                previewRepeatY: 3,
                activePaletteId: 'custom',
                customPalette: ['#AABBCC', '#DDEEFF']
            };

            const blob = exportJson(state);
            const text = await blob.text();
            const data = JSON.parse(text);

            expect(data.palette.active).toBe('custom');
            expect(data.palette.custom).toEqual(['#AABBCC', '#DDEEFF']);
        });
    });

    describe('importJson()', () => {
        // Helper to wrap callback-based importJson in a promise
        const importJsonPromise = (file) => {
            return new Promise((resolve, reject) => {
                importJson(file, resolve, reject);
            });
        };

        it('should import valid JSON data', async () => {
            const validData = {
                version: 1,
                grid: {
                    width: 2,
                    height: 2,
                    aspectRatio: 1,
                    cells: [[0, 1], [2, 0]]
                },
                colors: {
                    background: '#FFFFFF',
                    pattern: ['#FF0000', '#00FF00', '#0000FF']
                }
            };

            const file = new File([JSON.stringify(validData)], 'test.json', { type: 'application/json' });
            const data = await importJsonPromise(file);

            expect(data.gridWidth).toBe(2);
            expect(data.gridHeight).toBe(2);
            expect(data.aspectRatio).toBe(1);
            expect(data.grid).toEqual([[0, 1], [2, 0]]);
            expect(data.backgroundColor).toBe('#FFFFFF');
            expect(data.patternColors).toEqual(['#FF0000', '#00FF00', '#0000FF']);
        });

        it('should reject invalid version', async () => {
            const invalidData = {
                version: 2,
                grid: { width: 2, height: 2, cells: [[0]] },
                colors: { background: '#FFF', pattern: ['#F00'] }
            };

            const file = new File([JSON.stringify(invalidData)], 'test.json');

            await expect(importJsonPromise(file)).rejects.toContain('version');
        });

        it('should reject missing version', async () => {
            const invalidData = {
                grid: { width: 2, height: 2, cells: [[0]] },
                colors: { background: '#FFF', pattern: ['#F00'] }
            };

            const file = new File([JSON.stringify(invalidData)], 'test.json');

            await expect(importJsonPromise(file)).rejects.toContain('version');
        });

        it('should reject missing grid data', async () => {
            const invalidData = {
                version: 1,
                colors: { background: '#FFF', pattern: ['#F00'] }
            };

            const file = new File([JSON.stringify(invalidData)], 'test.json');

            await expect(importJsonPromise(file)).rejects.toContain('Invalid pattern file format');
        });

        it('should reject missing colors', async () => {
            const invalidData = {
                version: 1,
                grid: { width: 2, height: 2, cells: [[0]] }
            };

            const file = new File([JSON.stringify(invalidData)], 'test.json');

            await expect(importJsonPromise(file)).rejects.toContain('Invalid pattern file format');
        });

        it('should reject invalid JSON', async () => {
            const file = new File(['invalid json{'], 'test.json');

            await expect(importJsonPromise(file)).rejects.toContain('corrupted');
        });

        it('should clamp grid dimensions to valid range', async () => {
            const data = {
                version: 1,
                grid: {
                    width: 200, // Exceeds max
                    height: 1, // Below min
                    aspectRatio: 1,
                    cells: [[0]]
                },
                colors: {
                    background: '#FFFFFF',
                    pattern: ['#FF0000']
                }
            };

            const file = new File([JSON.stringify(data)], 'test.json');
            const imported = await importJsonPromise(file);

            expect(imported.gridWidth).toBeLessThanOrEqual(100); // CONFIG.MAX_GRID_SIZE
            expect(imported.gridHeight).toBeGreaterThanOrEqual(2); // CONFIG.MIN_GRID_SIZE
        });

        it('should import preview settings if present', async () => {
            const data = {
                version: 1,
                grid: { width: 2, height: 2, aspectRatio: 1, cells: [[0]] },
                colors: { background: '#FFF', pattern: ['#F00'] },
                preview: { repeatX: 5, repeatY: 6 }
            };

            const file = new File([JSON.stringify(data)], 'test.json');
            const imported = await importJsonPromise(file);

            expect(imported.previewRepeatX).toBe(5);
            expect(imported.previewRepeatY).toBe(6);
        });

        it('should import palette settings if present', async () => {
            const data = {
                version: 1,
                grid: { width: 2, height: 2, aspectRatio: 1, cells: [[0]] },
                colors: { background: '#FFF', pattern: ['#F00'] },
                palette: { active: 'custom', custom: ['#AABBCC'] }
            };

            const file = new File([JSON.stringify(data)], 'test.json');
            const imported = await importJsonPromise(file);

            expect(imported.activePaletteId).toBe('custom');
            expect(imported.customPalette).toEqual(['#AABBCC']);
        });
    });

    describe('downloadFile()', () => {
        it('should create download link and trigger download', () => {
            // Mock DOM methods
            const createElementSpy = vi.spyOn(document, 'createElement');
            const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
            const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
            const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
            const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

            const mockLink = {
                href: '',
                download: '',
                click: vi.fn()
            };
            createElementSpy.mockReturnValue(mockLink);

            const blob = new Blob(['test'], { type: 'text/plain' });
            downloadFile(blob, 'test.txt');

            expect(createElementSpy).toHaveBeenCalledWith('a');
            expect(mockLink.href).toBe('blob:mock-url');
            expect(mockLink.download).toBe('test.txt');
            expect(mockLink.click).toHaveBeenCalled();
            expect(appendChildSpy).toHaveBeenCalled();
            expect(removeChildSpy).toHaveBeenCalled();
            expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');

            // Cleanup
            createElementSpy.mockRestore();
            appendChildSpy.mockRestore();
            removeChildSpy.mockRestore();
            createObjectURLSpy.mockRestore();
            revokeObjectURLSpy.mockRestore();
        });
    });

    describe('exportSvg()', () => {
        beforeEach(() => {
            // Mock canvas element
            const mockCanvas = document.createElement('canvas');
            mockCanvas.id = 'editCanvas';
            mockCanvas.width = 200;
            mockCanvas.height = 200;
            document.body.appendChild(mockCanvas);
        });

        it('should export pattern as SVG blob', () => {
            const state = {
                grid: [[0, 1], [2, 0]],
                gridWidth: 2,
                gridHeight: 2,
                patternColors: ['#FF0000', '#00FF00', '#0000FF'],
                backgroundColor: '#FFFFFF'
            };

            const blob = exportSvg(state);

            expect(blob).toBeInstanceOf(Blob);
            expect(blob.type).toBe('image/svg+xml');
        });

        it('should include grid dimensions in SVG', async () => {
            const state = {
                grid: [[0]],
                gridWidth: 1,
                gridHeight: 1,
                patternColors: ['#FF0000'],
                backgroundColor: '#FFFFFF'
            };

            const blob = exportSvg(state);
            const text = await blob.text();

            expect(text).toContain('<svg');
            expect(text).toContain('width=');
            expect(text).toContain('height=');
        });
    });

    describe('exportPng()', () => {
        it('should call canvas toBlob method', async () => {
            // Mock document.getElementById to return a canvas with toBlob
            const mockCanvas = {
                toBlob: vi.fn((callback) => {
                    callback(new Blob(['test'], { type: 'image/png' }));
                })
            };

            const getElementByIdSpy = vi.spyOn(document, 'getElementById').mockReturnValue(mockCanvas);

            const blob = await exportPng();

            expect(getElementByIdSpy).toHaveBeenCalledWith('editCanvas');
            expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
            expect(blob).toBeInstanceOf(Blob);

            getElementByIdSpy.mockRestore();
        });
    });

    describe('exportPreviewSvg()', () => {
        beforeEach(() => {
            // Mock canvas element
            const mockCanvas = document.createElement('canvas');
            mockCanvas.id = 'previewCanvas';
            mockCanvas.width = 300;
            mockCanvas.height = 300;
            document.body.appendChild(mockCanvas);
        });

        it('should export preview as SVG blob', () => {
            const state = {
                grid: [[0, 1], [2, 0]],
                gridWidth: 2,
                gridHeight: 2,
                previewRepeatX: 3,
                previewRepeatY: 3,
                patternColors: ['#FF0000', '#00FF00', '#0000FF'],
                backgroundColor: '#FFFFFF'
            };

            const blob = exportPreviewSvg(state);

            expect(blob).toBeInstanceOf(Blob);
            expect(blob.type).toBe('image/svg+xml');
        });

        it('should tile pattern according to repeat settings', async () => {
            const state = {
                grid: [[1]],
                gridWidth: 1,
                gridHeight: 1,
                previewRepeatX: 2,
                previewRepeatY: 2,
                patternColors: ['#FF0000'],
                backgroundColor: '#FFFFFF'
            };

            const blob = exportPreviewSvg(state);
            const text = await blob.text();

            // Should contain SVG markup
            expect(text).toContain('<svg');
            // Should contain grid lines
            expect(text).toContain('Grid lines');
        });

        it('should use preview canvas dimensions', async () => {
            const state = {
                grid: [[0]],
                gridWidth: 1,
                gridHeight: 1,
                previewRepeatX: 3,
                previewRepeatY: 3,
                patternColors: ['#FF0000'],
                backgroundColor: '#FFFFFF'
            };

            const blob = exportPreviewSvg(state);
            const text = await blob.text();

            // SVG should have width and height attributes
            expect(text).toContain('width=');
            expect(text).toContain('height=');
        });
    });

    describe('exportPreviewPng()', () => {
        it('should call preview canvas toBlob method', async () => {
            // Mock document.getElementById to return a canvas with toBlob
            const mockCanvas = {
                toBlob: vi.fn((callback) => {
                    callback(new Blob(['test'], { type: 'image/png' }));
                })
            };

            const getElementByIdSpy = vi.spyOn(document, 'getElementById').mockReturnValue(mockCanvas);

            const blob = await exportPreviewPng();

            expect(getElementByIdSpy).toHaveBeenCalledWith('previewCanvas');
            expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
            expect(blob).toBeInstanceOf(Blob);

            getElementByIdSpy.mockRestore();
        });
    });
});
