import { CONFIG } from '../config.js';
import { Utils } from '../utils.js';

// ============================================
// EXPORT/IMPORT FUNCTIONS
// ============================================

/**
 * Export grid as SVG
 * @param {Object} state - Application state containing grid, colors, dimensions
 * @returns {Blob} - SVG blob for download
 */
export function exportSvg(state) {
    const { grid, gridWidth, gridHeight, patternColors, backgroundColor } = state;

    // Calculate cell dimensions from canvas
    const canvas = document.getElementById('editCanvas');
    const cellWidth = canvas.width / gridWidth;
    const cellHeight = canvas.height / gridHeight;

    // Create SVG
    const svgWidth = gridWidth * cellWidth;
    const svgHeight = gridHeight * cellHeight;

    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${svgWidth}" height="${svgHeight}" fill="${backgroundColor}"/>
`;

    // Draw each cell
    for (let row = 0; row < gridHeight; row++) {
        for (let col = 0; col < gridWidth; col++) {
            const cellValue = grid[row][col];
            if (cellValue !== 0) {
                const color = patternColors[cellValue - 1];
                const x = col * cellWidth;
                const y = row * cellHeight;
                svgContent += `  <rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" fill="${color}"/>\n`;
            }
        }
    }

    // Draw grid lines
    svgContent += `  <!-- Grid lines -->\n`;
    // Vertical lines
    for (let col = 0; col <= gridWidth; col++) {
        const x = col * cellWidth;
        svgContent += `  <line x1="${x}" y1="0" x2="${x}" y2="${svgHeight}" stroke="#ddd" stroke-width="1"/>\n`;
    }
    // Horizontal lines
    for (let row = 0; row <= gridHeight; row++) {
        const y = row * cellHeight;
        svgContent += `  <line x1="0" y1="${y}" x2="${svgWidth}" y2="${y}" stroke="#ddd" stroke-width="1"/>\n`;
    }

    svgContent += `</svg>`;

    return new Blob([svgContent], { type: 'image/svg+xml' });
}

/**
 * Export grid as PNG
 * @returns {Promise<Blob>} - PNG blob for download
 */
export function exportPng() {
    const canvas = document.getElementById('editCanvas');
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/png');
    });
}

/**
 * Export pattern as JSON
 * @param {Object} state - Application state
 * @returns {Blob} - JSON blob for download
 */
export function exportJson(state) {
    const {
        grid,
        gridWidth,
        gridHeight,
        aspectRatio,
        patternColors,
        backgroundColor,
        previewRepeatX,
        previewRepeatY,
        activePaletteId,
        customPalette
    } = state;

    const patternData = {
        version: 1,
        created: new Date().toISOString(),
        grid: {
            width: gridWidth,
            height: gridHeight,
            aspectRatio: aspectRatio,
            cells: grid
        },
        colors: {
            background: backgroundColor,
            pattern: patternColors
        },
        preview: {
            repeatX: previewRepeatX,
            repeatY: previewRepeatY
        },
        palette: {
            active: activePaletteId,
            custom: customPalette
        }
    };

    const jsonString = JSON.stringify(patternData, null, 2);
    return new Blob([jsonString], { type: 'application/json' });
}

/**
 * Import pattern from JSON file
 * @param {File} file - JSON file to import
 * @param {Function} onSuccess - Callback with imported data
 * @param {Function} onError - Callback with error message
 */
export function importJson(file, onSuccess, onError) {
    const reader = new FileReader();

    reader.onload = (event) => {
        try {
            const patternData = JSON.parse(event.target.result);

            // Validate the data structure
            if (!patternData.version || patternData.version !== 1) {
                onError('Invalid or unsupported pattern file version.');
                return;
            }

            if (!patternData.grid || !patternData.colors) {
                onError('Invalid pattern file format.');
                return;
            }

            // Validate and clamp grid dimensions
            const importedData = {
                gridWidth: Utils.clampInt(
                    patternData.grid.width,
                    CONFIG.MIN_GRID_SIZE,
                    CONFIG.MAX_GRID_SIZE,
                    CONFIG.DEFAULT_GRID_WIDTH
                ),
                gridHeight: Utils.clampInt(
                    patternData.grid.height,
                    CONFIG.MIN_GRID_SIZE,
                    CONFIG.MAX_GRID_SIZE,
                    CONFIG.DEFAULT_GRID_HEIGHT
                ),
                aspectRatio: Utils.clampFloat(
                    patternData.grid.aspectRatio,
                    CONFIG.MIN_ASPECT_RATIO,
                    CONFIG.MAX_ASPECT_RATIO,
                    CONFIG.DEFAULT_ASPECT_RATIO
                ),
                grid: patternData.grid.cells,
                backgroundColor: patternData.colors.background || CONFIG.DEFAULT_BACKGROUND_COLOR,
                patternColors: patternData.colors.pattern || [CONFIG.DEFAULT_PATTERN_COLOR]
            };

            // Import preview settings if available
            if (patternData.preview) {
                importedData.previewRepeatX = Utils.clampInt(
                    patternData.preview.repeatX,
                    CONFIG.MIN_PREVIEW_REPEAT,
                    CONFIG.MAX_PREVIEW_REPEAT,
                    CONFIG.DEFAULT_PREVIEW_REPEAT
                );
                importedData.previewRepeatY = Utils.clampInt(
                    patternData.preview.repeatY,
                    CONFIG.MIN_PREVIEW_REPEAT,
                    CONFIG.MAX_PREVIEW_REPEAT,
                    CONFIG.DEFAULT_PREVIEW_REPEAT
                );
            }

            // Import palette settings if available
            if (patternData.palette) {
                importedData.activePaletteId = patternData.palette.active || CONFIG.DEFAULT_ACTIVE_PALETTE;
                importedData.customPalette = patternData.palette.custom || null;
            }

            onSuccess(importedData);
        } catch (error) {
            console.error('Import error:', error);
            onError('Failed to import pattern. The file may be corrupted or invalid.');
        }
    };

    reader.readAsText(file);
}

/**
 * Trigger file download
 * @param {Blob} blob - File data
 * @param {string} filename - Name for downloaded file
 */
export function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
