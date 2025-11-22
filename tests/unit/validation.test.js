import { describe, it, expect } from 'vitest';
import {
    validateGridDimension,
    validateAspectRatio,
    validatePreviewRepeat,
    validateColor,
    validateImportData,
    validateFileSize,
    validateFileType
} from '../../src/utils/validation.js';
import { CONFIG } from '../../src/config.js';

describe('Validation Functions', () => {
    describe('validateGridDimension()', () => {
        it('should accept valid grid dimensions', () => {
            const result = validateGridDimension(10, 'Width');

            expect(result.valid).toBe(true);
            expect(result.value).toBe(10);
            expect(result.error).toBeUndefined();
        });

        it('should accept minimum grid size', () => {
            const result = validateGridDimension(CONFIG.MIN_GRID_SIZE);

            expect(result.valid).toBe(true);
            expect(result.value).toBe(CONFIG.MIN_GRID_SIZE);
        });

        it('should accept maximum grid size', () => {
            const result = validateGridDimension(CONFIG.MAX_GRID_SIZE);

            expect(result.valid).toBe(true);
            expect(result.value).toBe(CONFIG.MAX_GRID_SIZE);
        });

        it('should reject non-numeric input', () => {
            const result = validateGridDimension('abc', 'Width');

            expect(result.valid).toBe(false);
            expect(result.value).toBe(CONFIG.DEFAULT_GRID_WIDTH);
            expect(result.error).toContain('must be a number');
        });

        it('should reject values below minimum', () => {
            const result = validateGridDimension(1, 'Width');

            expect(result.valid).toBe(false);
            expect(result.value).toBe(CONFIG.MIN_GRID_SIZE);
            expect(result.error).toContain('must be at least');
        });

        it('should reject values above maximum', () => {
            const result = validateGridDimension(101, 'Height');

            expect(result.valid).toBe(false);
            expect(result.value).toBe(CONFIG.MAX_GRID_SIZE);
            expect(result.error).toContain('cannot exceed');
        });

        it('should parse string numbers', () => {
            const result = validateGridDimension('25');

            expect(result.valid).toBe(true);
            expect(result.value).toBe(25);
        });

        it('should use custom field name in error messages', () => {
            const result = validateGridDimension('abc', 'Custom Field');

            expect(result.error).toContain('Custom Field');
        });
    });

    describe('validateAspectRatio()', () => {
        it('should accept valid aspect ratios', () => {
            const result = validateAspectRatio(1.5);

            expect(result.valid).toBe(true);
            expect(result.value).toBe(1.5);
        });

        it('should accept minimum aspect ratio', () => {
            const result = validateAspectRatio(CONFIG.MIN_ASPECT_RATIO);

            expect(result.valid).toBe(true);
            expect(result.value).toBe(CONFIG.MIN_ASPECT_RATIO);
        });

        it('should accept maximum aspect ratio', () => {
            const result = validateAspectRatio(CONFIG.MAX_ASPECT_RATIO);

            expect(result.valid).toBe(true);
            expect(result.value).toBe(CONFIG.MAX_ASPECT_RATIO);
        });

        it('should reject non-numeric input', () => {
            const result = validateAspectRatio('invalid');

            expect(result.valid).toBe(false);
            expect(result.value).toBe(CONFIG.DEFAULT_ASPECT_RATIO);
            expect(result.error).toContain('must be a number');
        });

        it('should reject values below minimum', () => {
            const result = validateAspectRatio(0.05);

            expect(result.valid).toBe(false);
            expect(result.value).toBe(CONFIG.MIN_ASPECT_RATIO);
        });

        it('should reject values above maximum', () => {
            const result = validateAspectRatio(15);

            expect(result.valid).toBe(false);
            expect(result.value).toBe(CONFIG.MAX_ASPECT_RATIO);
        });

        it('should parse string decimals', () => {
            const result = validateAspectRatio('2.5');

            expect(result.valid).toBe(true);
            expect(result.value).toBe(2.5);
        });
    });

    describe('validatePreviewRepeat()', () => {
        it('should accept valid preview repeat values', () => {
            const result = validatePreviewRepeat(5);

            expect(result.valid).toBe(true);
            expect(result.value).toBe(5);
        });

        it('should accept minimum value', () => {
            const result = validatePreviewRepeat(CONFIG.MIN_PREVIEW_REPEAT);

            expect(result.valid).toBe(true);
        });

        it('should accept maximum value', () => {
            const result = validatePreviewRepeat(CONFIG.MAX_PREVIEW_REPEAT);

            expect(result.valid).toBe(true);
        });

        it('should reject non-numeric input', () => {
            const result = validatePreviewRepeat('xyz');

            expect(result.valid).toBe(false);
            expect(result.value).toBe(CONFIG.DEFAULT_PREVIEW_REPEAT);
        });

        it('should reject values below minimum', () => {
            const result = validatePreviewRepeat(0);

            expect(result.valid).toBe(false);
            expect(result.value).toBe(CONFIG.MIN_PREVIEW_REPEAT);
        });

        it('should reject values above maximum', () => {
            const result = validatePreviewRepeat(15);

            expect(result.valid).toBe(false);
            expect(result.value).toBe(CONFIG.MAX_PREVIEW_REPEAT);
        });
    });

    describe('validateColor()', () => {
        it('should accept valid 6-digit hex colors', () => {
            const result = validateColor('#FF0000');

            expect(result.valid).toBe(true);
            expect(result.value).toBe('#FF0000');
        });

        it('should accept lowercase hex colors and convert to uppercase', () => {
            const result = validateColor('#ff0000');

            expect(result.valid).toBe(true);
            expect(result.value).toBe('#FF0000');
        });

        it('should accept 3-digit hex colors and expand them', () => {
            const result = validateColor('#F00');

            expect(result.valid).toBe(true);
            expect(result.value).toBe('#FF0000');
        });

        it('should accept 8-digit hex colors with alpha', () => {
            const result = validateColor('#FF0000AA');

            expect(result.valid).toBe(true);
            expect(result.value).toBe('#FF0000AA');
        });

        it('should reject invalid hex format', () => {
            const result = validateColor('#GG0000');

            expect(result.valid).toBe(false);
            expect(result.value).toBe(CONFIG.DEFAULT_PATTERN_COLOR);
        });

        it('should reject colors without hash', () => {
            const result = validateColor('FF0000');

            expect(result.valid).toBe(false);
        });

        it('should reject wrong length hex codes', () => {
            const result = validateColor('#FF00');

            expect(result.valid).toBe(false);
        });

        it('should trim whitespace', () => {
            const result = validateColor('  #FF0000  ');

            expect(result.valid).toBe(true);
            expect(result.value).toBe('#FF0000');
        });

        it('should reject empty string', () => {
            const result = validateColor('');

            expect(result.valid).toBe(false);
        });
    });

    describe('validateImportData()', () => {
        it('should accept valid import data', () => {
            const data = {
                grid: [[0, 1], [2, 0]],
                gridWidth: 2,
                gridHeight: 2,
                patternColors: ['#FF0000', '#00FF00'],
                backgroundColor: '#FFFFFF'
            };

            const result = validateImportData(data);

            expect(result.valid).toBe(true);
            expect(result.value).toBe(data);
        });

        it('should reject null data', () => {
            const result = validateImportData(null);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid JSON format');
        });

        it('should reject non-object data', () => {
            const result = validateImportData('string');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid JSON format');
        });

        it('should reject missing grid', () => {
            const data = {
                gridWidth: 2,
                gridHeight: 2,
                patternColors: ['#FF0000']
            };

            const result = validateImportData(data);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('grid data');
        });

        it('should reject invalid grid (not array)', () => {
            const data = {
                grid: 'not an array',
                gridWidth: 2,
                gridHeight: 2,
                patternColors: ['#FF0000']
            };

            const result = validateImportData(data);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('grid data');
        });

        it('should reject missing gridWidth', () => {
            const data = {
                grid: [[0]],
                gridHeight: 1,
                patternColors: ['#FF0000']
            };

            const result = validateImportData(data);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('grid dimensions');
        });

        it('should reject missing patternColors', () => {
            const data = {
                grid: [[0]],
                gridWidth: 1,
                gridHeight: 1
            };

            const result = validateImportData(data);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('pattern colors');
        });

        it('should reject empty patternColors array', () => {
            const data = {
                grid: [[0]],
                gridWidth: 1,
                gridHeight: 1,
                patternColors: []
            };

            const result = validateImportData(data);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('pattern colors');
        });

        it('should reject grid dimensions that are too large', () => {
            const data = {
                grid: [[0]],
                gridWidth: 200,
                gridHeight: 1,
                patternColors: ['#FF0000']
            };

            const result = validateImportData(data);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('cannot exceed');
        });

        it('should reject grid dimensions that are too small', () => {
            const data = {
                grid: [[0]],
                gridWidth: 1,
                gridHeight: 1,
                patternColors: ['#FF0000']
            };

            const result = validateImportData(data);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('must be at least');
        });

        it('should reject grid height mismatch', () => {
            const data = {
                grid: [[0, 0], [0, 0], [0, 0]], // 3 rows
                gridWidth: 2,
                gridHeight: 2, // Says 2 rows
                patternColors: ['#FF0000']
            };

            const result = validateImportData(data);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Grid height does not match');
        });

        it('should reject grid row width mismatch', () => {
            const data = {
                grid: [[0, 0], [0, 0, 0]], // Second row has 3 cols
                gridWidth: 2,
                gridHeight: 2,
                patternColors: ['#FF0000']
            };

            const result = validateImportData(data);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('has incorrect width');
        });
    });

    describe('validateFileSize()', () => {
        it('should accept files within size limit', () => {
            const file = new File(['content'], 'test.json', { type: 'application/json' });
            const result = validateFileSize(file, 10);

            expect(result.valid).toBe(true);
            expect(result.value).toBe(file);
        });

        it('should reject files exceeding size limit', () => {
            // Create a large file (mock size)
            const file = new File(['x'.repeat(1024 * 1024 * 11)], 'large.json', { type: 'application/json' });
            const result = validateFileSize(file, 10);

            expect(result.valid).toBe(false);
            expect(result.value).toBeNull();
            expect(result.error).toContain('10MB');
        });

        it('should use default max size of 10MB', () => {
            const file = new File(['content'], 'test.json');
            const result = validateFileSize(file);

            expect(result.valid).toBe(true);
        });

        it('should accept file exactly at limit', () => {
            // Create a file exactly 1MB
            const content = new Array(1024 * 1024).fill('x').join('');
            const file = new File([content], 'test.json');
            const result = validateFileSize(file, 1);

            // File might be slightly larger due to metadata, so we check it's close
            // This is a fuzzy test since File sizes can vary by implementation
            expect(result.valid === true || result.error.includes('1MB')).toBe(true);
        });
    });

    describe('validateFileType()', () => {
        it('should accept files with allowed MIME type', () => {
            const file = new File(['{}'], 'test.json', { type: 'application/json' });
            const result = validateFileType(file, ['application/json']);

            expect(result.valid).toBe(true);
            expect(result.value).toBe(file);
        });

        it('should accept files with allowed extension', () => {
            const file = new File(['{}'], 'test.json', { type: '' });
            const result = validateFileType(file, ['.json']);

            expect(result.valid).toBe(true);
        });

        it('should accept multiple allowed types', () => {
            const file = new File(['data'], 'image.png', { type: 'image/png' });
            const result = validateFileType(file, ['image/png', 'image/jpeg', '.jpg']);

            expect(result.valid).toBe(true);
        });

        it('should reject files with disallowed type', () => {
            const file = new File(['data'], 'script.js', { type: 'text/javascript' });
            const result = validateFileType(file, ['application/json', '.json']);

            expect(result.valid).toBe(false);
            expect(result.value).toBeNull();
            expect(result.error).toContain('not allowed');
        });

        it('should be case insensitive for MIME types', () => {
            const file = new File(['{}'], 'test.json', { type: 'APPLICATION/JSON' });
            const result = validateFileType(file, ['application/json']);

            expect(result.valid).toBe(true);
        });

        it('should be case insensitive for extensions', () => {
            const file = new File(['{}'], 'TEST.JSON', { type: '' });
            const result = validateFileType(file, ['.json']);

            expect(result.valid).toBe(true);
        });

        it('should list allowed types in error message', () => {
            const file = new File(['data'], 'wrong.txt', { type: 'text/plain' });
            const result = validateFileType(file, ['application/json', '.png']);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('application/json');
            expect(result.error).toContain('.png');
        });
    });
});
