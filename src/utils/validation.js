/**
 * Validation Module
 * Centralized validation functions for user inputs
 */

import { CONFIG } from '../config.js';

/**
 * Validation result object
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the input is valid
 * @property {*} value - The validated/sanitized value
 * @property {string} [error] - Error message if invalid
 */

/**
 * Validate grid dimension (width or height)
 * @param {*} input - The input value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {ValidationResult}
 */
export function validateGridDimension(input, fieldName = 'Grid dimension') {
    const value = parseInt(input);

    if (isNaN(value)) {
        return {
            valid: false,
            value: CONFIG.DEFAULT_GRID_WIDTH,
            error: `${fieldName} must be a number`
        };
    }

    if (value < CONFIG.MIN_GRID_SIZE) {
        return {
            valid: false,
            value: CONFIG.MIN_GRID_SIZE,
            error: `${fieldName} must be at least ${CONFIG.MIN_GRID_SIZE}`
        };
    }

    if (value > CONFIG.MAX_GRID_SIZE) {
        return {
            valid: false,
            value: CONFIG.MAX_GRID_SIZE,
            error: `${fieldName} cannot exceed ${CONFIG.MAX_GRID_SIZE}`
        };
    }

    return { valid: true, value };
}

/**
 * Validate aspect ratio
 * @param {*} input - The input value to validate
 * @returns {ValidationResult}
 */
export function validateAspectRatio(input) {
    const value = parseFloat(input);

    if (isNaN(value)) {
        return {
            valid: false,
            value: CONFIG.DEFAULT_ASPECT_RATIO,
            error: 'Aspect ratio must be a number'
        };
    }

    if (value < CONFIG.MIN_ASPECT_RATIO) {
        return {
            valid: false,
            value: CONFIG.MIN_ASPECT_RATIO,
            error: `Aspect ratio must be at least ${CONFIG.MIN_ASPECT_RATIO}`
        };
    }

    if (value > CONFIG.MAX_ASPECT_RATIO) {
        return {
            valid: false,
            value: CONFIG.MAX_ASPECT_RATIO,
            error: `Aspect ratio cannot exceed ${CONFIG.MAX_ASPECT_RATIO}`
        };
    }

    return { valid: true, value };
}

/**
 * Validate preview repeat count
 * @param {*} input - The input value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {ValidationResult}
 */
export function validatePreviewRepeat(input, fieldName = 'Preview repeat') {
    const value = parseInt(input);

    if (isNaN(value)) {
        return {
            valid: false,
            value: CONFIG.DEFAULT_PREVIEW_REPEAT,
            error: `${fieldName} must be a number`
        };
    }

    if (value < CONFIG.MIN_PREVIEW_REPEAT) {
        return {
            valid: false,
            value: CONFIG.MIN_PREVIEW_REPEAT,
            error: `${fieldName} must be at least ${CONFIG.MIN_PREVIEW_REPEAT}`
        };
    }

    if (value > CONFIG.MAX_PREVIEW_REPEAT) {
        return {
            valid: false,
            value: CONFIG.MAX_PREVIEW_REPEAT,
            error: `${fieldName} cannot exceed ${CONFIG.MAX_PREVIEW_REPEAT}`
        };
    }

    return { valid: true, value };
}

/**
 * Validate hex color
 * @param {string} input - The color value to validate
 * @returns {ValidationResult}
 */
export function validateColor(input) {
    const trimmed = input.trim();

    // Match #RGB, #RRGGBB, or #RRGGBBAA
    const hexPattern = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;

    if (!hexPattern.test(trimmed)) {
        return {
            valid: false,
            value: CONFIG.DEFAULT_PATTERN_COLOR,
            error: 'Color must be a valid hex code (e.g., #FF0000)'
        };
    }

    // Normalize 3-digit hex to 6-digit
    if (trimmed.length === 4) {
        const r = trimmed[1];
        const g = trimmed[2];
        const b = trimmed[3];
        return { valid: true, value: `#${r}${r}${g}${g}${b}${b}` };
    }

    return { valid: true, value: trimmed.toUpperCase() };
}

/**
 * Validate JSON import data
 * @param {Object} data - The parsed JSON data
 * @returns {ValidationResult}
 */
export function validateImportData(data) {
    if (!data || typeof data !== 'object') {
        return {
            valid: false,
            value: null,
            error: 'Invalid JSON format'
        };
    }

    // Check required fields
    if (!Array.isArray(data.grid)) {
        return {
            valid: false,
            value: null,
            error: 'Missing or invalid grid data'
        };
    }

    if (typeof data.gridWidth !== 'number' || typeof data.gridHeight !== 'number') {
        return {
            valid: false,
            value: null,
            error: 'Missing or invalid grid dimensions'
        };
    }

    if (!Array.isArray(data.patternColors) || data.patternColors.length === 0) {
        return {
            valid: false,
            value: null,
            error: 'Missing or invalid pattern colors'
        };
    }

    // Validate grid dimensions
    const widthValidation = validateGridDimension(data.gridWidth, 'Imported grid width');
    if (!widthValidation.valid) {
        return {
            valid: false,
            value: null,
            error: widthValidation.error
        };
    }

    const heightValidation = validateGridDimension(data.gridHeight, 'Imported grid height');
    if (!heightValidation.valid) {
        return {
            valid: false,
            value: null,
            error: heightValidation.error
        };
    }

    // Validate grid array structure
    if (data.grid.length !== data.gridHeight) {
        return {
            valid: false,
            value: null,
            error: 'Grid height does not match grid data'
        };
    }

    for (let i = 0; i < data.grid.length; i++) {
        if (!Array.isArray(data.grid[i]) || data.grid[i].length !== data.gridWidth) {
            return {
                valid: false,
                value: null,
                error: `Grid row ${i + 1} has incorrect width`
            };
        }
    }

    return { valid: true, value: data };
}

/**
 * Validate file size
 * @param {File} file - The file to validate
 * @param {number} maxSizeMB - Maximum file size in megabytes
 * @returns {ValidationResult}
 */
export function validateFileSize(file, maxSizeMB = 10) {
    const maxBytes = maxSizeMB * 1024 * 1024;

    if (file.size > maxBytes) {
        return {
            valid: false,
            value: null,
            error: `File size exceeds ${maxSizeMB}MB limit`
        };
    }

    return { valid: true, value: file };
}

/**
 * Validate file type
 * @param {File} file - The file to validate
 * @param {string[]} allowedTypes - Array of allowed MIME types or extensions
 * @returns {ValidationResult}
 */
export function validateFileType(file, allowedTypes) {
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    const mimeType = file.type.toLowerCase();

    const isValid = allowedTypes.some(type => {
        return type.toLowerCase() === mimeType || type.toLowerCase() === fileExt;
    });

    if (!isValid) {
        return {
            valid: false,
            value: null,
            error: `File type not allowed. Accepted types: ${allowedTypes.join(', ')}`
        };
    }

    return { valid: true, value: file };
}
