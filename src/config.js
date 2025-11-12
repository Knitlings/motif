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
    DEFAULT_ADD_COLOR: '#5a3d5e',

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
