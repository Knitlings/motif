// ============================================
// UTILITIES
// ============================================

/**
 * @typedef {Object} NumberInputConfig
 * @property {string} input - ID of the input element
 * @property {string} display - ID of the display element
 * @property {number} min - Minimum allowed value
 * @property {number} max - Maximum allowed value
 * @property {number} defaultVal - Default value if input is invalid
 * @property {Function} onApply - Callback function when value is applied
 */

/**
 * @typedef {Object} ColorInputConfig
 * @property {string} picker - ID of the color picker element
 * @property {string} text - ID of the text input element
 * @property {Function} onChange - Callback function when color changes
 */

export const Utils = {
    /**
     * Clamp a value between min and max
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Clamped value
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    /**
     * Validate and clamp an integer input
     * @param {string|number} value - Value to parse and clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @param {number} defaultValue - Default value if parsing fails
     * @returns {number} Clamped integer value
     */
    clampInt(value, min, max, defaultValue) {
        const parsed = parseInt(value);
        if (isNaN(parsed)) return defaultValue;
        return this.clamp(parsed, min, max);
    },

    /**
     * Validate and clamp a float input
     * @param {string|number} value - Value to parse and clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @param {number} defaultValue - Default value if parsing fails
     * @returns {number} Clamped float value
     */
    clampFloat(value, min, max, defaultValue) {
        const parsed = parseFloat(value);
        if (isNaN(parsed)) return defaultValue;
        return this.clamp(parsed, min, max);
    },

    /**
     * Deep clone an object using JSON serialization
     * @param {*} obj - Object to clone
     * @returns {*} Deep cloned object
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Check if platform is Mac
     * @returns {boolean} True if Mac platform
     */
    isMac() {
        return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    },

    /**
     * Create a number input handler with live preview and validation
     * Reduces duplication for grid width, height, repeat X, repeat Y inputs
     * @param {NumberInputConfig} config - Configuration object
     * @returns {HTMLElement} The input element
     */
    setupNumberInput(config) {
        const { input, display, min, max, defaultVal, onApply } = config;
        const inputEl = document.getElementById(input);
        const displayEl = document.getElementById(display);
        let lastValue = inputEl.value;

        // Update display as user types (if valid)
        inputEl.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            if (!isNaN(val) && val >= min && val <= max) {
                displayEl.textContent = val;
            }
            if (lastValue) {
                clearTimeout(lastValue);
            }
            const oldVal = parseInt(lastValue) || 0;
            const newVal = parseInt(e.target.value) || 0;
            const diff = Math.abs(newVal - oldVal);
            // Apply immediately if incrementing by 1 (arrow keys)
            if (diff === 1) {
                onApply(e.target.value);
            }
            lastValue = e.target.value;
        });

        // Apply on blur
        inputEl.addEventListener('blur', (e) => {
            onApply(e.target.value);
        });

        // Apply on Enter key
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                onApply(e.target.value);
                e.target.blur();
            }
        });

        return inputEl;
    },

    /**
     * Create color input handlers (picker + text field sync)
     * @param {ColorInputConfig} config - Configuration object
     * @returns {{pickerEl: HTMLElement, textEl: HTMLElement}} The picker and text input elements
     */
    setupColorInput(config) {
        const { picker, text, onChange } = config;
        const pickerEl = document.getElementById(picker);
        const textEl = document.getElementById(text);

        pickerEl.oninput = (e) => {
            textEl.value = e.target.value;
            onChange(e.target.value);
        };

        textEl.oninput = (e) => {
            pickerEl.value = e.target.value;
            onChange(e.target.value);
        };

        return { pickerEl, textEl };
    },

    /**
     * Convert decimal to simple fraction string (e.g., 1.33 → "4:3")
     * @param {number} decimal - Decimal value to convert
     * @param {number} [maxDenominator=100] - Maximum denominator to search
     * @returns {string} Fraction string in format "numerator:denominator"
     */
    decimalToFraction(decimal, maxDenominator = 100) {
        // Handle exact integers
        if (Math.abs(decimal - Math.round(decimal)) < 0.0001) {
            return `${Math.round(decimal)}:1`;
        }

        let bestNumerator = 1;
        let bestDenominator = 1;
        let minError = Math.abs(decimal - 1);

        // Search for the simplest fraction within tolerance
        for (let denominator = 1; denominator <= maxDenominator; denominator++) {
            const numerator = Math.round(decimal * denominator);
            const error = Math.abs(decimal - numerator / denominator);

            // If this is closer, or equally close but simpler, use it
            if (error < minError || (error === minError && denominator < bestDenominator)) {
                bestNumerator = numerator;
                bestDenominator = denominator;
                minError = error;

                // If we found an exact match, stop searching
                if (error < 0.0001) break;
            }
        }

        return `${bestNumerator}:${bestDenominator}`;
    },

    /**
     * Convert aspect ratio (height/width) to width:height display format
     * Note: aspectRatio is stored as height/width but displayed as width:height
     * e.g., aspectRatio 0.75 (height/width) → "4:3" (width:height)
     * @param {number} aspectRatio - Aspect ratio as height/width
     * @param {number} [maxDenominator=100] - Maximum denominator to search
     * @returns {string} Aspect ratio string in "width:height" format
     */
    aspectRatioToDisplay(aspectRatio, maxDenominator = 100) {
        // If aspectRatio is height/width, then width/height is the inverse
        const widthHeightRatio = 1 / aspectRatio;

        // Handle exact integers
        if (Math.abs(widthHeightRatio - Math.round(widthHeightRatio)) < 0.0001) {
            return `${Math.round(widthHeightRatio)}:1`;
        }

        let bestNumerator = 1;
        let bestDenominator = 1;
        let minError = Math.abs(widthHeightRatio - 1);

        // Search for the simplest fraction within tolerance
        for (let denominator = 1; denominator <= maxDenominator; denominator++) {
            const numerator = Math.round(widthHeightRatio * denominator);
            const error = Math.abs(widthHeightRatio - numerator / denominator);

            // If this is closer, or equally close but simpler, use it
            if (error < minError || (error === minError && denominator < bestDenominator)) {
                bestNumerator = numerator;
                bestDenominator = denominator;
                minError = error;

                // If we found an exact match, stop searching
                if (error < 0.0001) break;
            }
        }

        return `${bestNumerator}:${bestDenominator}`;
    },

    /**
     * Parse fraction string to decimal (e.g., "4:3" → 1.33, "16/9" → 1.78)
     * Also accepts plain decimals (e.g., "1.5" → 1.5)
     * @param {string} str - Fraction string to parse (supports ":", "/", or decimal)
     * @returns {number|null} Decimal value or null if invalid
     */
    fractionToDecimal(str) {
        str = str.trim();

        // Try colon separator first (4:3)
        if (str.includes(':')) {
            const parts = str.split(':');
            if (parts.length === 2) {
                const numerator = parseFloat(parts[0]);
                const denominator = parseFloat(parts[1]);
                if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
                    return numerator / denominator;
                }
            }
        }

        // Try slash separator (4/3)
        if (str.includes('/')) {
            const parts = str.split('/');
            if (parts.length === 2) {
                const numerator = parseFloat(parts[0]);
                const denominator = parseFloat(parts[1]);
                if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
                    return numerator / denominator;
                }
            }
        }

        // Try parsing as plain decimal
        const decimal = parseFloat(str);
        if (!isNaN(decimal)) {
            return decimal;
        }

        return null;
    },

    /**
     * Parse width:height format to aspectRatio (height/width)
     * e.g., "4:3" (width:height) → 0.75 (height/width aspect ratio)
     * @param {string} str - Width:height ratio string
     * @returns {number|null} Aspect ratio as height/width or null if invalid
     */
    displayToAspectRatio(str) {
        const widthHeightRatio = this.fractionToDecimal(str);
        if (widthHeightRatio === null || widthHeightRatio === 0) {
            return null;
        }
        // Convert width:height to height/width
        return 1 / widthHeightRatio;
    }
};
