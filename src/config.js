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

    // Quick Palette configuration
    MIN_PALETTE_COLORS: 1,
    MAX_PALETTE_COLORS: 16,

    // Built-in palettes
    BUILT_IN_PALETTES: {
        motif: {
            name: 'Motif',
            colors: [
                '#8d2e3e', // primary
                '#6f2331', // primary-hover
                '#c44f4f', // danger
                '#2b0f2e', // text-primary
                '#5a3d5e', // text-secondary
                '#8f7891', // text-tertiary
                '#fdf9f8', // bg-primary
                '#f7f0ee', // bg-secondary
                '#f0e7e4', // bg-tertiary
                '#e8dbd8', // border-primary
                '#d9c9c5', // border-secondary
                '#a83d3d'  // danger-hover
            ]
        },
        warm: {
            name: 'Warm',
            colors: [
                '#8d2e3e', // deep crimson
                '#c44f4f', // coral red
                '#FF6B6B', // bright coral
                '#F7DC6F', // warm yellow
                '#E67E22', // orange
                '#D35400', // dark orange
                '#E74C3C', // red
                '#EC7063', // salmon
                '#F8B500', // golden yellow
                '#DC7633', // burnt orange
                '#CB4335', // brick red
                '#F39C12'  // amber
            ]
        },
        cool: {
            name: 'Cool',
            colors: [
                '#4ECDC4', // turquoise
                '#45B7D1', // sky blue
                '#98D8C8', // mint
                '#BB8FCE', // lavender
                '#5DADE2', // light blue
                '#48C9B0', // sea green
                '#85C1E2', // powder blue
                '#7FB3D5', // steel blue
                '#A569BD', // purple
                '#5499C7', // ocean blue
                '#76D7C4', // aqua
                '#AF7AC5'  // violet
            ]
        }
    },

    // Default active palette
    DEFAULT_ACTIVE_PALETTE: 'motif'
};
