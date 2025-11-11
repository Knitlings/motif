// ============================================
// CONFIGURATION
// ============================================
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
    DEFAULT_ADD_COLOR: '#FF6B6B',

    // UI
    GRID_STROKE_COLOR: '#ddd',
    PREVIEW_STROKE_COLOR: '#eee',
    CANVAS_BORDER_COLOR: '#666',
    INSTRUCTIONS_FADE_TIME: 400,

    // Default palette
    PALETTE: [
        '#000000', '#FFFFFF', '#FF6B6B', '#4ECDC4',
        '#45B7D1', '#F7DC6F', '#98D8C8', '#BB8FCE'
    ]
};
