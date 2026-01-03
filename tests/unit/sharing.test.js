import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateShareUrl, parseShareUrl, validateShareData, copyToClipboard } from '../../src/utils/sharing.js';

describe('Sharing Utilities', () => {
	beforeEach(() => {
		// Reset window.location.hash before each test
		if (typeof window !== 'undefined') {
			window.location.hash = '';
		}
		vi.clearAllMocks();
	});

	describe('generateShareUrl()', () => {
		it('should generate valid share URL from state', async () => {
			const state = {
				grid: [[0, 1], [2, 0]],
				gridWidth: 2,
				gridHeight: 2,
				aspectRatio: 1,
				patternColors: ['#ff0000', '#00ff00'],
				backgroundColor: '#ffffff',
				previewRepeatX: 3,
				previewRepeatY: 3,
				activePatternIndex: 0,
				hasInteracted: true,
				activePaletteId: 'motif',
				customPalette: null
			};

			const result = await generateShareUrl(state);

			expect(result.success).toBe(true);
			expect(result.url).toBeDefined();
			expect(result.url).toContain('#p=');
		});

		it('should warn for very large patterns', async () => {
			// Create a large grid
			const largeGrid = Array(80).fill(null).map(() => Array(80).fill(0));
			const state = {
				grid: largeGrid,
				gridWidth: 80,
				gridHeight: 80,
				aspectRatio: 1,
				patternColors: Array(20).fill('#000000'),
				backgroundColor: '#ffffff',
				previewRepeatX: 3,
				previewRepeatY: 3,
				activePatternIndex: 0,
				hasInteracted: true,
				activePaletteId: 'motif',
				customPalette: null
			};

			const result = await generateShareUrl(state);

			expect(result.success).toBe(true);
			// Large patterns may trigger warning
			if (result.url.length > 2048) {
				expect(result.warning).toBeDefined();
			}
		});

		it('should handle errors gracefully', async () => {
			// Pass invalid state
			const result = await generateShareUrl(null);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});
	});

	describe('parseShareUrl()', () => {
		it('should return success with null data for URLs without share hash', () => {
			window.location.hash = '';
			const result = parseShareUrl();
			expect(result.success).toBe(true);
			expect(result.data).toBeNull();

			window.location.hash = '#other';
			const result2 = parseShareUrl();
			expect(result2.success).toBe(true);
			expect(result2.data).toBeNull();
		});

		it('should return error for corrupted share data', () => {
			window.location.hash = '#p=corrupted!!data';
			const result = parseShareUrl();
			expect(result.success).toBe(false);
			expect(result.error).toBe('DECOMPRESSION_FAILED');
			expect(result.userMessage).toBeDefined();
		});

		it('should return error for empty share data', () => {
			window.location.hash = '#p=';
			const result = parseShareUrl();
			expect(result.success).toBe(false);
			expect(result.error).toBe('EMPTY_SHARE_DATA');
			expect(result.userMessage).toBeDefined();
		});

		it('should parse valid share URL correctly', async () => {
			const originalState = {
				grid: [[0, 1], [2, 0]],
				gridWidth: 2,
				gridHeight: 2,
				aspectRatio: 0.75,
				patternColors: ['#ff0000', '#00ff00', '#0000ff'],
				backgroundColor: '#ffffff',
				previewRepeatX: 3,
				previewRepeatY: 3,
				activePatternIndex: 0,
				hasInteracted: true,
				activePaletteId: 'warm',
				customPalette: ['#123456']
			};

			// Generate URL
			const generated = await generateShareUrl(originalState);
			expect(generated.success).toBe(true);

			// Extract hash from URL
			const url = new URL(generated.url);
			window.location.hash = url.hash;

			// Parse back
			const result = parseShareUrl();

			expect(result.success).toBe(true);
			expect(result.data).not.toBeNull();
			expect(result.data.version).toBe(1);
			expect(result.data.grid).toBeDefined();
			expect(result.data.grid.cells).toEqual(originalState.grid);
			expect(result.data.grid.width).toBe(originalState.gridWidth);
			expect(result.data.grid.height).toBe(originalState.gridHeight);
			expect(result.data.colors.pattern).toEqual(originalState.patternColors);
			expect(result.data.colors.background).toBe(originalState.backgroundColor);
		});
	});

	describe('validateShareData()', () => {
		it('should validate correct share data', () => {
			const validData = {
				version: 1,
				grid: { width: 5, height: 5, cells: [[0]] },
				colors: { background: '#ffffff', pattern: ['#000000'] }
			};

			expect(validateShareData(validData)).toBe(true);
		});

		it('should reject invalid version', () => {
			const invalidData = {
				version: 2,
				grid: { width: 5, height: 5, cells: [[0]] },
				colors: { background: '#ffffff', pattern: ['#000000'] }
			};

			expect(validateShareData(invalidData)).toBe(false);
		});

		it('should reject missing required fields', () => {
			expect(validateShareData({ version: 1 })).toBe(false);
			expect(validateShareData({ version: 1, grid: {} })).toBe(false);
			expect(validateShareData(null)).toBe(false);
			expect(validateShareData(undefined)).toBe(false);
			expect(validateShareData({})).toBe(false);
		});

		it('should reject invalid data types', () => {
			expect(validateShareData('string')).toBe(false);
			expect(validateShareData(123)).toBe(false);
			expect(validateShareData([])).toBe(false);
		});
	});

	describe('copyToClipboard()', () => {
		it('should use navigator.clipboard when available', async () => {
			const mockWriteText = vi.fn().mockResolvedValue(undefined);
			const originalClipboard = navigator.clipboard;
			Object.defineProperty(navigator, 'clipboard', {
				value: { writeText: mockWriteText },
				configurable: true,
				writable: true
			});

			const success = await copyToClipboard('test text');

			expect(success).toBe(true);
			expect(mockWriteText).toHaveBeenCalledWith('test text');

			// Restore
			Object.defineProperty(navigator, 'clipboard', {
				value: originalClipboard,
				configurable: true
			});
		});

		it('should fallback to execCommand when clipboard API unavailable', async () => {
			// Remove clipboard API
			const originalClipboard = navigator.clipboard;
			Object.defineProperty(navigator, 'clipboard', {
				value: undefined,
				configurable: true
			});

			// Mock execCommand
			const mockExecCommand = vi.fn().mockReturnValue(true);
			document.execCommand = mockExecCommand;

			const success = await copyToClipboard('test text');

			expect(success).toBe(true);
			expect(mockExecCommand).toHaveBeenCalledWith('copy');

			// Restore
			Object.defineProperty(navigator, 'clipboard', {
				value: originalClipboard,
				configurable: true
			});
		});

		it('should handle errors gracefully', async () => {
			// Mock clipboard API to fail
			const mockWriteText = vi.fn().mockRejectedValue(new Error('Permission denied'));
			const originalClipboard = navigator.clipboard;
			Object.defineProperty(navigator, 'clipboard', {
				value: { writeText: mockWriteText },
				configurable: true,
				writable: true
			});

			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const success = await copyToClipboard('test text');

			expect(success).toBe(false);
			expect(consoleErrorSpy).toHaveBeenCalled();

			consoleErrorSpy.mockRestore();

			// Restore
			Object.defineProperty(navigator, 'clipboard', {
				value: originalClipboard,
				configurable: true
			});
		});
	});

	describe('Round-trip compression', () => {
		it('should preserve pattern data through compression and decompression', async () => {
			const state = {
				grid: [[0, 1, 2], [1, 2, 0], [2, 0, 1]],
				gridWidth: 3,
				gridHeight: 3,
				aspectRatio: 0.8,
				patternColors: ['#ff0000', '#00ff00', '#0000ff'],
				backgroundColor: '#ffffff',
				previewRepeatX: 5,
				previewRepeatY: 5,
				activePatternIndex: 1,
				hasInteracted: true,
				activePaletteId: 'custom',
				customPalette: ['#123456', '#654321']
			};

			// Generate URL
			const generated = await generateShareUrl(state);
			expect(generated.success).toBe(true);

			// Parse back
			const url = new URL(generated.url);
			window.location.hash = url.hash;
			const result = parseShareUrl();

			// Validate result
			expect(result.success).toBe(true);
			expect(result.data).not.toBeNull();

			// Validate structure
			expect(validateShareData(result.data)).toBe(true);

			// Verify all data preserved
			expect(result.data.grid.cells).toEqual(state.grid);
			expect(result.data.grid.width).toBe(state.gridWidth);
			expect(result.data.grid.height).toBe(state.gridHeight);
			expect(result.data.grid.aspectRatio).toBe(state.aspectRatio);
			expect(result.data.colors.pattern).toEqual(state.patternColors);
			expect(result.data.colors.background).toBe(state.backgroundColor);
			expect(result.data.preview.repeatX).toBe(state.previewRepeatX);
			expect(result.data.preview.repeatY).toBe(state.previewRepeatY);
			expect(result.data.palette.active).toBe(state.activePaletteId);
			expect(result.data.palette.custom).toEqual(state.customPalette);
		});
	});
});
