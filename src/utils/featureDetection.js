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
 * Show critical error overlay when essential features are missing
 * @param {string} feature - Name of the missing feature
 * @param {string} message - Error message to display
 */
export function showCriticalError(feature, message) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'feature-error-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Create error content
    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 3rem;
        border-radius: 8px;
        max-width: 500px;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    `;

    content.innerHTML = `
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
        <h1 style="margin: 0 0 1rem 0; font-size: 1.5rem; color: #333;">Browser Not Supported</h1>
        <p style="margin: 0 0 1.5rem 0; color: #666; line-height: 1.6;">${message}</p>
        <p style="margin: 0; color: #999; font-size: 0.9rem;">
            Please try using a modern browser like Chrome, Firefox, Safari, or Edge.
        </p>
    `;

    overlay.appendChild(content);
    document.body.appendChild(overlay);
}

/**
 * Show warning banner for non-critical missing features
 * @param {string} feature - Name of the missing feature
 * @param {string} message - Warning message to display
 */
export function showWarningBanner(feature, message) {
    // Create banner
    const banner = document.createElement('div');
    banner.id = `feature-warning-${feature}`;
    banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #ff9800;
        color: white;
        padding: 1rem;
        text-align: center;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
    `;

    banner.innerHTML = `
        <span style="flex: 1; max-width: 800px;">⚠️ ${message}</span>
        <button
            onclick="this.parentElement.remove()"
            style="
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid white;
                color: white;
                padding: 0.5rem 1rem;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.9rem;
            "
        >Dismiss</button>
    `;

    document.body.insertBefore(banner, document.body.firstChild);

    // Adjust main content to account for banner
    if (document.body.style.paddingTop === '') {
        document.body.style.paddingTop = '60px';
    }
}

/**
 * Disable UI elements that depend on missing features
 * @param {string} selector - CSS selector for elements to disable
 * @param {string} reason - Tooltip text explaining why it's disabled
 */
export function disableFeatureDependentUI(selector, reason) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
        element.disabled = true;
        element.style.opacity = '0.5';
        element.style.cursor = 'not-allowed';
        element.title = reason;

        // Prevent click events
        element.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, true);
    });
}

/**
 * Check browser features and handle missing capabilities
 * Call this function on app startup
 * @returns {BrowserCapabilities} Object indicating which features are available
 */
export function checkBrowserCompatibility() {
    const capabilities = detectBrowserFeatures();

    // Critical: Canvas API is required
    if (!capabilities.canvas) {
        showCriticalError(
            'canvas',
            'This application requires Canvas support to function. Your browser does not support the HTML5 Canvas API, which is essential for drawing and editing patterns.'
        );
        return capabilities; // Stop here - app cannot function
    }

    // Important: localStorage for persistence
    if (!capabilities.localStorage) {
        showWarningBanner(
            'localStorage',
            'Storage is disabled in your browser. Your work will not be saved between sessions. Use the Export button to save your patterns manually.'
        );
    }

    // Optional: FileReader for importing
    if (!capabilities.fileReader) {
        // Wait for DOM to be ready before trying to disable elements
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                disableImportUI();
            });
        } else {
            disableImportUI();
        }
    }

    return capabilities;
}

/**
 * Disable import-related UI when FileReader is not available
 */
function disableImportUI() {
    disableFeatureDependentUI(
        '#importJson, #importPng',
        'File import is not supported in your browser'
    );
}
