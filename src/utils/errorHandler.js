/**
 * Error Handling Module
 * Centralized error handling and user-facing error messages
 */

/**
 * Error types for categorization
 */
export const ErrorType = {
    VALIDATION: 'validation',
    STORAGE: 'storage',
    FILE_IO: 'file_io',
    CANVAS: 'canvas',
    NETWORK: 'network',
    UNKNOWN: 'unknown'
};

/**
 * Display an error message to the user
 * @param {string} message - The error message to display
 * @param {string} type - The error type
 */
export function showError(message, type = ErrorType.UNKNOWN) {
    console.error(`[${type.toUpperCase()}]`, message);

    // Show error in the confirmation dialog
    const dialog = document.getElementById('mergeDialog');
    const titleEl = document.getElementById('mergeDialogTitle');
    const textEl = document.getElementById('mergeDialogText');
    const confirmBtn = document.getElementById('mergeConfirmBtn');
    const cancelBtn = document.getElementById('mergeCancelBtn');

    if (!dialog || !titleEl || !textEl || !confirmBtn || !cancelBtn) {
        // Fallback to alert if dialog elements aren't available
        alert(message);
        return;
    }

    titleEl.textContent = 'Error';
    textEl.textContent = message;
    confirmBtn.style.display = 'none';
    cancelBtn.textContent = 'OK';
    dialog.style.display = 'flex';

    // Focus the OK button for accessibility
    setTimeout(() => cancelBtn.focus(), 100);

    const closeHandler = () => {
        dialog.style.display = 'none';
        confirmBtn.style.display = '';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.removeEventListener('click', closeHandler);
    };

    cancelBtn.addEventListener('click', closeHandler);
}

/**
 * Handle localStorage quota exceeded error
 * @param {Error} error - The error object
 */
export function handleStorageError(error) {
    if (error.name === 'QuotaExceededError') {
        showError(
            'Unable to save: browser storage is full. Try clearing some browser data or exporting your pattern.',
            ErrorType.STORAGE
        );
    } else {
        showError(
            'Unable to save your work. Your pattern will not be restored if you close this page.',
            ErrorType.STORAGE
        );
    }
}

/**
 * Handle file reading errors
 * @param {Error} error - The error object
 * @param {string} fileName - The name of the file
 */
export function handleFileError(error, fileName = 'file') {
    let message = `Unable to read ${fileName}.`;

    if (error.name === 'NotReadableError') {
        message += ' The file may be locked or corrupted.';
    } else if (error.message) {
        message += ` ${error.message}`;
    }

    showError(message, ErrorType.FILE_IO);
}

/**
 * Handle canvas rendering errors
 * @param {Error} error - The error object
 * @param {string} operation - The operation that failed
 */
export function handleCanvasError(error, operation = 'render') {
    console.error('Canvas error during', operation, error);
    showError(
        `Unable to ${operation} the canvas. Try refreshing the page.`,
        ErrorType.CANVAS
    );
}

/**
 * Handle JSON parse errors
 * @param {Error} error - The error object
 */
export function handleJSONError(error) {
    showError(
        'The file is not valid JSON or is corrupted. Please check the file and try again.',
        ErrorType.FILE_IO
    );
}

/**
 * Safe wrapper for async functions with error handling
 * @param {Function} fn - The async function to wrap
 * @param {string} operation - Description of the operation for error messages
 * @returns {Function} - Wrapped function with error handling
 */
export function wrapAsync(fn, operation = 'operation') {
    return async function(...args) {
        try {
            return await fn.apply(this, args);
        } catch (error) {
            console.error(`Error during ${operation}:`, error);
            showError(
                `An error occurred during ${operation}. Please try again.`,
                ErrorType.UNKNOWN
            );
            return null;
        }
    };
}

/**
 * Safe wrapper for sync functions with error handling
 * @param {Function} fn - The function to wrap
 * @param {string} operation - Description of the operation for error messages
 * @param {*} defaultReturn - Default return value on error
 * @returns {Function} - Wrapped function with error handling
 */
export function wrapSync(fn, operation = 'operation', defaultReturn = null) {
    return function(...args) {
        try {
            return fn.apply(this, args);
        } catch (error) {
            console.error(`Error during ${operation}:`, error);
            showError(
                `An error occurred during ${operation}. Please try again.`,
                ErrorType.UNKNOWN
            );
            return defaultReturn;
        }
    };
}

/**
 * Log error for debugging while showing user-friendly message
 * @param {Error} error - The error object
 * @param {string} userMessage - User-friendly message
 * @param {string} type - Error type
 */
export function logAndShow(error, userMessage, type = ErrorType.UNKNOWN) {
    console.error(`[${type.toUpperCase()}]`, error);
    showError(userMessage, type);
}

/**
 * Global error handler for unhandled errors
 */
export function setupGlobalErrorHandler() {
    window.addEventListener('error', (event) => {
        console.error('Unhandled error:', event.error);
        showError(
            'An unexpected error occurred. The application may not function correctly. Try refreshing the page.',
            ErrorType.UNKNOWN
        );
    });

    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        showError(
            'An unexpected error occurred. Please try again or refresh the page.',
            ErrorType.UNKNOWN
        );
    });
}
