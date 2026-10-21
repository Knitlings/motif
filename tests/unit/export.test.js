import { describe, it, expect, beforeEach, vi } from 'vitest';
import { exportJson, importJson, downloadFile, exportSvg, exportPng, exportPreviewSvg, exportPreviewPng, findLongRuns, runLengthInk } from '../../src/core/export.js';

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

    describe('findLongRuns()', () => {
        const fromRows = (rows) => (row, col) => rows[row][col];

        it('should find runs of one colour at least the minimum long', () => {
            const rows = [['#aaa', '#aaa', '#aaa', '#bbb', '#bbb', '#aaa']];
            expect(findLongRuns(fromRows(rows), 6, 1, 2)).toEqual([
                { row: 0, col: 0, length: 3, colour: '#aaa' },
                { row: 0, col: 3, length: 2, colour: '#bbb' }
            ]);
        });

        it('should skip runs shorter than the minimum', () => {
            const rows = [['#aaa', '#aaa', '#bbb', '#bbb', '#bbb', '#bbb', '#bbb']];
            expect(findLongRuns(fromRows(rows), 7, 1, 5)).toEqual([
                { row: 0, col: 2, length: 5, colour: '#bbb' }
            ]);
        });

        it('should count along rows, not down columns', () => {
            const rows = [['#aaa', '#bbb'], ['#aaa', '#bbb'], ['#aaa', '#bbb']];
            expect(findLongRuns(fromRows(rows), 2, 3, 2)).toEqual([]);
        });

        it('should treat the same colour in different cases as one run', () => {
            const rows = [['#AAAAAA', '#aaaaaa', '#aaaaaa', '#bbbbbb']];
            expect(findLongRuns(fromRows(rows), 4, 1, 3)).toHaveLength(1);
        });

        it('should skip a row that is all one colour', () => {
            const rows = [['#aaa', '#aaa', '#aaa'], ['#aaa', '#aaa', '#bbb']];
            expect(findLongRuns(fromRows(rows), 3, 2, 2)).toEqual([
                { row: 1, col: 0, length: 2, colour: '#aaa' }
            ]);
        });
    });

    describe('runLengthInk()', () => {
        it('should write white on dark stitches', () => {
            expect(runLengthInk('#8d2e3e')).toBe('#ffffff');
            expect(runLengthInk('#000')).toBe('#ffffff');
        });

        it('should write dark on light stitches', () => {
            expect(runLengthInk('#fdf9f8')).toBe('#1a1a18');
            expect(runLengthInk('#ffad33')).toBe('#1a1a18');
        });

        it('should fall back to dark for colours it cannot read', () => {
            expect(runLengthInk('red')).toBe('#1a1a18');
        });
    });

    describe('row count direction in SVG exports', () => {
        const state = {
            grid: [[0], [0], [0]],
            gridWidth: 1,
            gridHeight: 3,
            patternColors: ['#8d2e3e'],
            backgroundColor: '#fdf9f8',
            previewRepeatX: 1,
            previewRepeatY: 2
        };
        const rowNumbers = (svg) => [...svg.matchAll(/fill="#666">(\d+)<\/text>/g)].map(m => m[1]);

        it('should number rows from the bottom by default', async () => {
            expect(rowNumbers(await exportSvg(state, true).text())).toEqual(['3', '2', '1']);
        });

        it('should number rows from the top for knitting top down', async () => {
            expect(rowNumbers(await exportSvg(state, true, null, true).text())).toEqual(['1', '2', '3']);
        });

        it('should number the whole preview from the top', async () => {
            expect(rowNumbers(await exportPreviewSvg(state, true, null, true).text())).toEqual(['1', '2', '3', '4', '5', '6']);
        });
    });

    describe('run lengths in SVG exports', () => {
        const state = {
            grid: [[1, 1, 1, 1, 1, 0], [0, 0, 1, 0, 0, 0]],
            gridWidth: 6,
            gridHeight: 2,
            patternColors: ['#8d2e3e'],
            backgroundColor: '#fdf9f8',
            previewRepeatX: 2,
            previewRepeatY: 1
        };
        const runLengthTexts = (svg) => [...svg.matchAll(/<text[^>]*text-anchor="middle"[^>]*>(\d+)<\/text>/g)].map(m => m[1]);

        it('should number runs in the pattern, background included', async () => {
            const text = await exportSvg(state, false, 3).text();
            expect(runLengthTexts(text)).toEqual(['5', '3']);
        });

        it('should write each number inside one stitch, left of the middle for even runs', async () => {
            const evenState = { ...state, grid: [[1, 1, 1, 1, 0, 0], [1, 1, 1, 0, 0, 0]] };
            const cellWidth = document.getElementById('editCanvas').width / 6;
            const text = await exportSvg(evenState, false, 3).text();
            const xs = [...text.matchAll(/<text x="([\d.]+)"[^>]*text-anchor="middle"/g)].map(m => Number(m[1]));
            // Run of 4 in stitches 0–3: stitch 1; runs of 3 in stitches 0–2 and 3–5: stitches 1 and 4
            expect(xs).toEqual([1.5 * cellWidth, 1.5 * cellWidth, 4.5 * cellWidth]);
        });

        it('should leave them out when off', async () => {
            const text = await exportSvg(state, false).text();
            expect(runLengthTexts(text)).toEqual([]);
        });

        it('should count runs across repeats in the preview', async () => {
            // Row 2 tiled twice: 0 0 1 0 0 0 | 0 0 1 0 0 0 — three background stitches join two across the seam
            const text = await exportPreviewSvg(state, false, 5).text();
            expect(runLengthTexts(text)).toEqual(['5', '5', '5']);
        });
    });
});
