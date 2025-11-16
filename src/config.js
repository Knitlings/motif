// ============================================
// CONFIGURATION
// ============================================

/**
 * @typedef {Object} PaletteDefinition
 * @property {string} name - Display name of the palette
 * @property {string[]} colors - Array of hex color strings
 */

/**
 * Application configuration constants
 * @type {Object}
 */
export const CONFIG = {
    // Grid limits
    MIN_GRID_SIZE: 2,
    MAX_GRID_SIZE: 100,
    DEFAULT_GRID_WIDTH: 5,
    DEFAULT_GRID_HEIGHT: 5,

    // Canvas rendering
    MIN_CELL_SIZE: 20,
    MAX_CANVAS_SIZE: 800,

    // Aspect ratio
    MIN_ASPECT_RATIO: 0.1,
    MAX_ASPECT_RATIO: 10,
    DEFAULT_ASPECT_RATIO: 1,

    // Preview
    MIN_PREVIEW_REPEAT: 1,
    MAX_PREVIEW_REPEAT: 10,
    DEFAULT_PREVIEW_REPEAT: 3,
    PREVIEW_SCALE: 0.5,

    // Colors
    MAX_PATTERN_COLORS: 20,
    DEFAULT_PATTERN_COLOR: '#8d2e3e',
    DEFAULT_BACKGROUND_COLOR: '#fdf9f8',
    DEFAULT_ADD_COLOR: '#5a3d5e',

    // UI
    GRID_STROKE_COLOR: '#ddd',
    PREVIEW_STROKE_COLOR: '#eee',
    CANVAS_BORDER_COLOR: '#666',
    INSTRUCTIONS_FADE_TIME: 400,

    // History
    MAX_HISTORY_STATES: 50,

    // Canvas layout and spacing
    HEADER_HEIGHT_MOBILE: 56,
    HEADER_HEIGHT_DESKTOP: 64,
    PADDING_VERTICAL_MOBILE_LANDSCAPE: 60,
    PADDING_VERTICAL_MOBILE_PORTRAIT: 100,
    PADDING_VERTICAL_DESKTOP: 320,
    PADDING_HORIZONTAL_SMALL_MOBILE: 24,
    PADDING_HORIZONTAL_MOBILE: 32,
    PADDING_HORIZONTAL_DESKTOP: 480,
    CANVAS_GAP_MOBILE_LANDSCAPE: 32,
    CANVAS_GAP_MOBILE: 64,
    CANVAS_GAP_DESKTOP: 96,
    COLLAPSED_PANEL_WIDTH: 40,
    MOBILE_BREAKPOINT: 1024,
    SMALL_MOBILE_BREAKPOINT: 480,
    LANDSCAPE_HEIGHT_THRESHOLD: 500,
    MAX_CANVAS_SIZE_MOBILE_LANDSCAPE: 1200,
    ORIENTATION_CHANGE_DELAY: 100,

    // Quick Palette configuration
    MIN_PALETTE_COLORS: 1,
    MAX_PALETTE_COLORS: 16,

    // Built-in palettes
    BUILT_IN_PALETTES: {
        motif: {
            name: 'Motif',
            colors: [
                '#000000', // black
                '#ffffff', // white
                '#8d2e3e', // deep crimson
                '#6f2331', // darker crimson
                '#c44f4f', // coral red
                '#2b0f2e', // very dark purple
                '#5a3d5e', // muted purple
                '#8f7891', // light purple-gray
                '#fdf9f8', // very light cream
                '#f7f0ee', // light cream
                '#d9c9c5', // darker beige
                '#a83d3d'  // dark red
            ]
        },
        warm: {
            name: 'Warm',
            colors: [
                '#ffad33', // light orange
                '#ff931f', // orange
                '#ff7e33', // medium orange
                '#fa5e1f', // deep orange
                '#ec3f13', // orange-red
                '#b81702', // red
                '#a50104', // deep red
                '#8e0103'  // dark red
            ]
        },
        cool: {
            name: 'Cool',
            colors: [
                '#b7094c', // magenta
                '#a01a58', // raspberry
                '#892b64', // purple-pink
                '#723c70', // purple
                '#5c4d7d', // deep purple
                '#455e89', // blue-purple
                '#2e6f95', // blue
                '#1780a1'  // teal blue
            ]
        },
        autumn: {
            name: 'Autumn',
            colors: [
                '#862906', // burnt sienna
                '#a04005', // rust
                '#b84f00', // burnt orange
                '#c46219', // terracotta
                '#ed862b', // golden orange
                '#875702', // olive brown
                '#5a380b', // dark brown
                '#411308'  // espresso
            ]
        }
    },

    // Default active palette
    DEFAULT_ACTIVE_PALETTE: 'motif'
};

/**
 * UI interaction timing and behavior constants
 * Centralized to avoid magic numbers throughout the codebase
 * @type {Object}
 */
export const UI_CONSTANTS = {
    // Timing
    LONG_PRESS_DURATION: 500,        // ms - Duration to trigger long-press
    HAPTIC_FEEDBACK_DURATION: 50,    // ms - Vibration feedback duration
    UI_UPDATE_DELAY: 50,             // ms - Delay for UI updates after actions
    DEBOUNCE_DELAY: 250,             // ms - Debounce delay for repeated actions
    ANIMATION_FRAME_DELAY: 16,       // ms - ~60fps for smooth animations

    // Touch/Drag thresholds
    DRAG_THRESHOLD: 10,              // px - Minimum movement to count as drag
    TOUCH_MOVE_THRESHOLD: 5,         // px - Touch movement tolerance

    // Color picker
    COLOR_PICKER_FADE_DELAY: 100,    // ms - Delay before removing color picker

    // Menu positioning
    MENU_OFFSET_Y: 5,                // px - Vertical offset for dropdown menus
    MENU_EDGE_PADDING: 10,           // px - Padding from viewport edges

    // Button sizing
    COLOR_BUTTON_SIZE: 36,           // px - Size of color buttons
    COLOR_BUTTON_FONT_SIZE: 14,      // px - Font size for color buttons
    OVERFLOW_BUTTON_SIZE: 36,        // px - Size of overflow menu button

    // Z-index layers
    Z_INDEX_MENU: 1000,              // Menu overlays
    Z_INDEX_COLOR_PICKER: 999,       // Color picker dialogs
    Z_INDEX_DROPDOWN: 100,           // Dropdown panels

    // Responsive breakpoints (duplicated from CONFIG for UI-specific use)
    MOBILE_BREAKPOINT: 1024,         // px - Mobile vs desktop threshold
    SMALL_MOBILE_BREAKPOINT: 480,    // px - Small mobile devices
    TABLET_BREAKPOINT: 768,          // px - Tablet breakpoint

    // Visual feedback
    ACTIVE_BUTTON_OPACITY: 1,        // Opacity for active state
    INACTIVE_BUTTON_OPACITY: 0.6,    // Opacity for inactive state
    HOVER_OPACITY: 0.8,              // Opacity for hover state
};
