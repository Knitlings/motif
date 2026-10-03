// ============================================
// BROWSER FEATURE DETECTION
// ============================================

/**
 * @typedef {Object} BrowserCapabilities
 * @property {boolean} canvas - Canvas API support
 * @property {boolean} localStorage - localStorage availability
 * @property {boolean} fileReader - FileReader API support
 */

/**
 * Detect browser feature support
 * @returns {BrowserCapabilities} Object indicating which features are available
 */
export function detectBrowserFeatures() {
    return {
        canvas: detectCanvasSupport(),
        localStorage: detectLocalStorageSupport(),
        fileReader: detectFileReaderSupport()
    };
}

/**
 * Check if Canvas API is supported
 * @returns {boolean} True if Canvas is supported
 */
function detectCanvasSupport() {
    try {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext && canvas.getContext('2d'));
    } catch (e) {
        return false;
    }
}

/**
 * Check if localStorage is available and functional
 * Tests both existence and actual read/write capability (can be blocked in private browsing)
 * @returns {boolean} True if localStorage is available and working
 */
function detectLocalStorageSupport() {
    try {
        const testKey = '__motif_storage_test__';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Check if FileReader API is supported
 * @returns {boolean} True if FileReader is supported
 */
function detectFileReaderSupport() {
    try {
        return typeof FileReader !== 'undefined' && typeof FileReader.prototype.readAsDataURL !== 'undefined';
    } catch (e) {
        return false;
    }
}

/**
 * Replace the page with a plain explanation when Motif can't run at all
 * @param {string} feature - Name of the missing feature
 * @param {string} message - What is missing and what to do
 */
export function showCriticalError(feature, message) {
    const header = document.createElement('header');
    header.className = 'top-bar';
    const wordmark = document.createElement('span');
    wordmark.className = 'wordmark';
    wordmark.textContent = 'Motif';
    header.append(wordmark);

    const main = document.createElement('main');
    main.className = 'content-page';
    main.id = 'feature-error';
    main.dataset.feature = feature;
    const title = document.createElement('h1');
    title.textContent = "Motif can't run in this browser";
    const text = document.createElement('p');
    text.className = 'prose';
    text.textContent = message;
    main.append(title, text);

    document.body.replaceChildren(header, main);
}

/**
 * Check browser features and stop if Motif can't run.
 * Missing storage or file reading is reported by the editor itself (a warning note,
 * an unavailable Import JSON row).
 * @returns {BrowserCapabilities} Object indicating which features are available
 */
export function checkBrowserCompatibility() {
    const capabilities = detectBrowserFeatures();

    if (!capabilities.canvas) {
        showCriticalError(
            'canvas',
            "Motif draws patterns on a canvas, which this browser doesn't support. Try a recent version of Firefox, Chrome, Safari or Edge."
        );
    }

    return capabilities;
}
