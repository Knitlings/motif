import { CONFIG } from '../config.js';
import { Utils } from '../utils.js';

// ============================================
// EXPORT/IMPORT FUNCTIONS
// ============================================

/**
 * @typedef {import('../main.js').ApplicationState} ApplicationState
 */

/**
 * Sanitize imported grid data by converting null/undefined values to 0
 * @param {Array} grid - Grid data from imported file
 * @returns {Array} Sanitized grid with all null/undefined converted to 0
 */
function sanitizeGrid(grid) {
    if (!Array.isArray(grid)) {
        return grid;
    }

    return grid.map(row => {
        if (!Array.isArray(row)) {
            return row;
        }
        return row.map(cell => {
            // Convert null, undefined, or any non-numeric value to 0
            return (typeof cell === 'number' && cell >= 0) ? cell : 0;
        });
    });
}

/**
 * Export grid as SVG with grid lines
 * @param {ApplicationState} state - Application state containing grid, colors, dimensions
 * @param {boolean} includeRowCounts - Whether to include row count numbers
 * @returns {Blob} SVG blob for download
 */
export function exportSvg(state, includeRowCounts = false) {
    const { grid, gridWidth, gridHeight, patternColors, backgroundColor } = state;

    // Calculate cell dimensions from canvas
    const canvas = document.getElementById('editCanvas');
    const cellWidth = canvas.width / gridWidth;
    const cellHeight = canvas.height / gridHeight;

    // Calculate SVG dimensions
    const gridSvgWidth = gridWidth * cellWidth;
    const gridSvgHeight = gridHeight * cellHeight;

    // Add extra width for row counts if needed
    const rowCountMargin = includeRowCounts ? 40 : 0;
    const svgWidth = gridSvgWidth + rowCountMargin;
    const svgHeight = gridSvgHeight;

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
        svgContent += `  <line x1="0" y1="${y}" x2="${gridSvgWidth}" y2="${y}" stroke="#ddd" stroke-width="1"/>\n`;
    }

    // Draw row counts if enabled
    if (includeRowCounts) {
        // Add white background for row count area
        svgContent += `  <!-- Row count area background -->\n`;
        svgContent += `  <rect x="${gridSvgWidth}" y="0" width="${rowCountMargin}" height="${svgHeight}" fill="#ffffff"/>\n`;

        // Add black border around pattern
        svgContent += `  <!-- Pattern border -->\n`;
        svgContent += `  <rect x="0" y="0" width="${gridSvgWidth}" height="${gridSvgHeight}" fill="none" stroke="#000000" stroke-width="2"/>\n`;

        // Extend horizontal lines into row count area with dark color
        svgContent += `  <!-- Row count area grid lines -->\n`;
        for (let row = 0; row <= gridHeight; row++) {
            const y = row * cellHeight;
            svgContent += `  <line x1="${gridSvgWidth}" y1="${y}" x2="${svgWidth}" y2="${y}" stroke="#666" stroke-width="1"/>\n`;
        }

        svgContent += `  <!-- Row counts -->\n`;
        const fontSize = Math.min(cellHeight * 0.6, 20);
        for (let row = 0; row < gridHeight; row++) {
            // Row numbers start at 1 from the bottom
            const rowNumber = gridHeight - row;
            const x = gridSvgWidth + 10;
            const y = row * cellHeight + cellHeight / 2 + fontSize / 3;
            svgContent += `  <text x="${x}" y="${y}" font-family="monospace" font-size="${fontSize}" font-weight="500" fill="#666">${rowNumber}</text>\n`;
        }
    }

    svgContent += `</svg>`;

    return new Blob([svgContent], { type: 'image/svg+xml' });
}

/**
 * Export grid as PNG
 * @param {ApplicationState} state - Application state containing grid dimensions
 * @param {boolean} includeRowCounts - Whether to include row count numbers
 * @returns {Promise<Blob>} - PNG blob for download
 */
export function exportPng(state, includeRowCounts = false) {
    const canvas = document.getElementById('editCanvas');

    if (!includeRowCounts) {
        // Simple export without row counts
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png');
        });
    }

    const { gridHeight, backgroundColor } = state;

    // Create a temporary canvas with extra width for row counts
    const rowCountMargin = 40;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width + rowCountMargin;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext('2d');

    // Fill background color
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw the original canvas
    ctx.drawImage(canvas, 0, 0);

    const cellHeight = canvas.height / gridHeight;

    // Add white background for row count area
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(canvas.width, 0, rowCountMargin, tempCanvas.height);

    // Add black border around pattern
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // Extend horizontal lines into row count area with dark color
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    for (let row = 0; row <= gridHeight; row++) {
        const y = row * cellHeight;
        ctx.beginPath();
        ctx.moveTo(canvas.width, y);
        ctx.lineTo(tempCanvas.width, y);
        ctx.stroke();
    }

    // Draw row counts
    ctx.fillStyle = '#666';
    ctx.font = `500 ${Math.min(cellHeight * 0.6, 20)}px monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (let row = 0; row < gridHeight; row++) {
        // Row numbers start at 1 from the bottom
        const rowNumber = gridHeight - row;
        const x = canvas.width + 10;
        const y = row * cellHeight + cellHeight / 2;
        ctx.fillText(rowNumber.toString(), x, y);
    }

    // Export the temporary canvas
    return new Promise((resolve) => {
        tempCanvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/png');
    });
}

/**
 * Export pattern with context stitches as SVG
 * Shows center repeat from a 3×3 tile plus specified context stitches
 * @param {ApplicationState} state - Application state
 * @param {Object} context - Context stitches {left, right, top, bottom}
 * @param {boolean} includeRowCounts - Whether to include row count numbers
 * @returns {Blob} SVG blob for download
 */
export function exportPatternWithContextSvg(state, context, includeRowCounts = false) {
    const { grid, gridWidth, gridHeight, patternColors, backgroundColor } = state;
    const { left = 0, right = 0, top = 0, bottom = 0 } = context;

    // Clamp context values to pattern dimensions
    const leftContext = Math.min(left, gridWidth - 1);
    const rightContext = Math.min(right, gridWidth - 1);
    const topContext = Math.min(top, gridHeight - 1);
    const bottomContext = Math.min(bottom, gridHeight - 1);

    // Calculate total dimensions (center repeat + context from neighboring repeats)
    const totalWidth = leftContext + gridWidth + rightContext;
    const totalHeight = topContext + gridHeight + bottomContext;

    // Calculate cell dimensions from canvas
    const canvas = document.getElementById('editCanvas');
    const cellWidth = canvas.width / gridWidth;
    const cellHeight = canvas.height / gridHeight;

    // Calculate SVG dimensions
    const gridSvgWidth = totalWidth * cellWidth;
    const gridSvgHeight = totalHeight * cellHeight;

    // Add extra width for row counts if needed
    const rowCountMargin = includeRowCounts ? 40 : 0;
    const svgWidth = gridSvgWidth + rowCountMargin;
    const svgHeight = gridSvgHeight;

    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${svgWidth}" height="${svgHeight}" fill="${backgroundColor}"/>
`;

    // Draw cells from a 3×3 conceptual tile, extracting only the needed portion
    for (let row = 0; row < totalHeight; row++) {
        for (let col = 0; col < totalWidth; col++) {
            // Map to position in 3×3 tile (offset by context from top-left)
            const tileRow = row - topContext + gridHeight; // Start from middle tile
            const tileCol = col - leftContext + gridWidth;

            // Get cell value using modulo to wrap within pattern
            const gridRow = ((tileRow % gridHeight) + gridHeight) % gridHeight;
            const gridCol = ((tileCol % gridWidth) + gridWidth) % gridWidth;
            const cellValue = grid[gridRow][gridCol];

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
    for (let col = 0; col <= totalWidth; col++) {
        const x = col * cellWidth;
        svgContent += `  <line x1="${x}" y1="0" x2="${x}" y2="${gridSvgHeight}" stroke="#ddd" stroke-width="1"/>\n`;
    }
    // Horizontal lines
    for (let row = 0; row <= totalHeight; row++) {
        const y = row * cellHeight;
        svgContent += `  <line x1="0" y1="${y}" x2="${gridSvgWidth}" y2="${y}" stroke="#ddd" stroke-width="1"/>\n`;
    }

    // Draw red box around center repeat
    const boxX = leftContext * cellWidth;
    const boxY = topContext * cellHeight;
    const boxWidth = gridWidth * cellWidth;
    const boxHeight = gridHeight * cellHeight;
    svgContent += `  <!-- Pattern repeat box -->\n`;
    svgContent += `  <rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" fill="none" stroke="#d32f2f" stroke-width="4"/>\n`;

    // Draw row counts if enabled
    if (includeRowCounts) {
        // Add white background for row count area
        svgContent += `  <!-- Row count area background -->\n`;
        svgContent += `  <rect x="${gridSvgWidth}" y="0" width="${rowCountMargin}" height="${svgHeight}" fill="#ffffff"/>\n`;

        // Add black border around pattern
        svgContent += `  <!-- Pattern border -->\n`;
        svgContent += `  <rect x="0" y="0" width="${gridSvgWidth}" height="${gridSvgHeight}" fill="none" stroke="#000000" stroke-width="2"/>\n`;

        // Extend horizontal lines into row count area with dark color
        svgContent += `  <!-- Row count area grid lines -->\n`;
        for (let row = 0; row <= totalHeight; row++) {
            const y = row * cellHeight;
            svgContent += `  <line x1="${gridSvgWidth}" y1="${y}" x2="${svgWidth}" y2="${y}" stroke="#666" stroke-width="1"/>\n`;
        }

        svgContent += `  <!-- Row counts -->\n`;
        const fontSize = Math.min(cellHeight * 0.6, 20);
        for (let row = 0; row < totalHeight; row++) {
            // Row numbers start at 1 from the bottom
            const rowNumber = totalHeight - row;
            const x = gridSvgWidth + 10;
            const y = row * cellHeight + cellHeight / 2 + fontSize / 3;
            svgContent += `  <text x="${x}" y="${y}" font-family="monospace" font-size="${fontSize}" font-weight="500" fill="#666">${rowNumber}</text>\n`;
        }
    }

    svgContent += `</svg>`;

    return new Blob([svgContent], { type: 'image/svg+xml' });
}

/**
 * Export pattern with context stitches as PNG
 * Shows center repeat from a 3×3 tile plus specified context stitches
 * @param {ApplicationState} state - Application state
 * @param {Object} context - Context stitches {left, right, top, bottom}
 * @param {boolean} includeRowCounts - Whether to include row count numbers
 * @returns {Promise<Blob>} - PNG blob for download
 */
export async function exportPatternWithContextPng(state, context, includeRowCounts = false) {
    const { grid, gridWidth, gridHeight, patternColors, backgroundColor } = state;
    const { left = 0, right = 0, top = 0, bottom = 0 } = context;

    // Clamp context values to pattern dimensions
    const leftContext = Math.min(left, gridWidth - 1);
    const rightContext = Math.min(right, gridWidth - 1);
    const topContext = Math.min(top, gridHeight - 1);
    const bottomContext = Math.min(bottom, gridHeight - 1);

    // Calculate total dimensions
    const totalWidth = leftContext + gridWidth + rightContext;
    const totalHeight = topContext + gridHeight + bottomContext;

    // Get cell dimensions from canvas
    const sourceCanvas = document.getElementById('editCanvas');
    const cellWidth = sourceCanvas.width / gridWidth;
    const cellHeight = sourceCanvas.height / gridHeight;

    // Create temporary canvas
    const rowCountMargin = includeRowCounts ? 40 : 0;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = totalWidth * cellWidth + rowCountMargin;
    tempCanvas.height = totalHeight * cellHeight;
    const ctx = tempCanvas.getContext('2d');

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw cells
    for (let row = 0; row < totalHeight; row++) {
        for (let col = 0; col < totalWidth; col++) {
            // Map to position in 3×3 tile
            const tileRow = row - topContext + gridHeight;
            const tileCol = col - leftContext + gridWidth;

            // Get cell value using modulo
            const gridRow = ((tileRow % gridHeight) + gridHeight) % gridHeight;
            const gridCol = ((tileCol % gridWidth) + gridWidth) % gridWidth;
            const cellValue = grid[gridRow][gridCol];

            const x = col * cellWidth;
            const y = row * cellHeight;

            if (cellValue === 0) {
                ctx.fillStyle = backgroundColor;
            } else {
                ctx.fillStyle = patternColors[cellValue - 1] || backgroundColor;
            }
            ctx.fillRect(x, y, cellWidth, cellHeight);

            // Draw grid lines
            ctx.strokeStyle = '#ddd';
            ctx.strokeRect(x, y, cellWidth, cellHeight);
        }
    }

    // Draw red box around center repeat
    const boxX = leftContext * cellWidth;
    const boxY = topContext * cellHeight;
    const boxWidth = gridWidth * cellWidth;
    const boxHeight = gridHeight * cellHeight;
    ctx.strokeStyle = '#d32f2f';
    ctx.lineWidth = 4;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    // Draw row counts if enabled
    if (includeRowCounts) {
        // Add white background for row count area
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(totalWidth * cellWidth, 0, rowCountMargin, tempCanvas.height);

        // Add black border around pattern
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, totalWidth * cellWidth, totalHeight * cellHeight);

        // Extend horizontal lines into row count area with dark color
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        for (let row = 0; row <= totalHeight; row++) {
            const y = row * cellHeight;
            ctx.beginPath();
            ctx.moveTo(totalWidth * cellWidth, y);
            ctx.lineTo(tempCanvas.width, y);
            ctx.stroke();
        }

        ctx.fillStyle = '#666';
        ctx.font = `500 ${Math.min(cellHeight * 0.6, 20)}px monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        for (let row = 0; row < totalHeight; row++) {
            const rowNumber = totalHeight - row;
            const x = totalWidth * cellWidth + 10;
            const y = row * cellHeight + cellHeight / 2;
            ctx.fillText(rowNumber.toString(), x, y);
        }
    }

    // Export canvas as PNG
    return new Promise((resolve) => {
        tempCanvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/png');
    });
}

/**
 * Export preview as PNG
 * @param {ApplicationState} state - Application state containing grid dimensions
 * @param {boolean} includeRowCounts - Whether to include row count numbers
 * @returns {Promise<Blob>} - PNG blob for download
 */
export function exportPreviewPng(state, includeRowCounts = false) {
    const canvas = document.getElementById('previewCanvas');

    if (!includeRowCounts) {
        // Simple export without row counts
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png');
        });
    }

    const { gridHeight, previewRepeatX, previewRepeatY, backgroundColor } = state;
    const totalHeight = gridHeight * previewRepeatY;

    // Create a temporary canvas with extra width for row counts
    const rowCountMargin = 40;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width + rowCountMargin;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext('2d');

    // Fill background color
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw the original canvas
    ctx.drawImage(canvas, 0, 0);

    const cellHeight = canvas.height / totalHeight;

    // Add white background for row count area
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(canvas.width, 0, rowCountMargin, tempCanvas.height);

    // Add black border around pattern
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // Extend horizontal lines into row count area with dark color
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    for (let row = 0; row <= totalHeight; row++) {
        const y = row * cellHeight;
        ctx.beginPath();
        ctx.moveTo(canvas.width, y);
        ctx.lineTo(tempCanvas.width, y);
        ctx.stroke();
    }

    // Draw row counts
    ctx.fillStyle = '#666';
    ctx.font = `500 ${Math.min(cellHeight * 0.6, 20)}px monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (let row = 0; row < totalHeight; row++) {
        // Row numbers start at 1 from the bottom
        const rowNumber = totalHeight - row;
        const x = canvas.width + 10;
        const y = row * cellHeight + cellHeight / 2;
        ctx.fillText(rowNumber.toString(), x, y);
    }

    // Export the temporary canvas
    return new Promise((resolve) => {
        tempCanvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/png');
    });
}

/**
 * Export preview as SVG with grid lines
 * @param {ApplicationState} state - Application state containing grid, colors, dimensions
 * @param {boolean} includeRowCounts - Whether to include row count numbers
 * @returns {Blob} SVG blob for download
 */
export function exportPreviewSvg(state, includeRowCounts = false) {
    const { grid, gridWidth, gridHeight, patternColors, backgroundColor, previewRepeatX, previewRepeatY } = state;

    // Calculate cell dimensions from preview canvas
    const canvas = document.getElementById('previewCanvas');
    const totalWidth = gridWidth * previewRepeatX;
    const totalHeight = gridHeight * previewRepeatY;
    const cellWidth = canvas.width / totalWidth;
    const cellHeight = canvas.height / totalHeight;

    // Calculate SVG dimensions
    const gridSvgWidth = totalWidth * cellWidth;
    const gridSvgHeight = totalHeight * cellHeight;

    // Add extra width for row counts if needed
    const rowCountMargin = includeRowCounts ? 40 : 0;
    const svgWidth = gridSvgWidth + rowCountMargin;
    const svgHeight = gridSvgHeight;

    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${svgWidth}" height="${svgHeight}" fill="${backgroundColor}"/>
`;

    // Draw tiled pattern
    for (let repeatY = 0; repeatY < previewRepeatY; repeatY++) {
        for (let repeatX = 0; repeatX < previewRepeatX; repeatX++) {
            const offsetX = repeatX * gridWidth;
            const offsetY = repeatY * gridHeight;

            // Draw each cell in this tile
            for (let row = 0; row < gridHeight; row++) {
                for (let col = 0; col < gridWidth; col++) {
                    const cellValue = grid[row][col];
                    if (cellValue !== 0) {
                        const color = patternColors[cellValue - 1];
                        const x = (offsetX + col) * cellWidth;
                        const y = (offsetY + row) * cellHeight;
                        svgContent += `  <rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" fill="${color}"/>\n`;
                    }
                }
            }
        }
    }

    // Draw grid lines
    svgContent += `  <!-- Grid lines -->\n`;
    // Vertical lines
    for (let col = 0; col <= totalWidth; col++) {
        const x = col * cellWidth;
        svgContent += `  <line x1="${x}" y1="0" x2="${x}" y2="${svgHeight}" stroke="#ddd" stroke-width="1"/>\n`;
    }
    // Horizontal lines
    for (let row = 0; row <= totalHeight; row++) {
        const y = row * cellHeight;
        svgContent += `  <line x1="0" y1="${y}" x2="${gridSvgWidth}" y2="${y}" stroke="#ddd" stroke-width="1"/>\n`;
    }

    // Draw row counts if enabled
    if (includeRowCounts) {
        // Add white background for row count area
        svgContent += `  <!-- Row count area background -->\n`;
        svgContent += `  <rect x="${gridSvgWidth}" y="0" width="${rowCountMargin}" height="${svgHeight}" fill="#ffffff"/>\n`;

        // Add black border around pattern
        svgContent += `  <!-- Pattern border -->\n`;
        svgContent += `  <rect x="0" y="0" width="${gridSvgWidth}" height="${gridSvgHeight}" fill="none" stroke="#000000" stroke-width="2"/>\n`;

        // Extend horizontal lines into row count area with dark color
        svgContent += `  <!-- Row count area grid lines -->\n`;
        for (let row = 0; row <= totalHeight; row++) {
            const y = row * cellHeight;
            svgContent += `  <line x1="${gridSvgWidth}" y1="${y}" x2="${svgWidth}" y2="${y}" stroke="#666" stroke-width="1"/>\n`;
        }

        svgContent += `  <!-- Row counts -->\n`;
        const fontSize = Math.min(cellHeight * 0.6, 20);
        for (let row = 0; row < totalHeight; row++) {
            // Row numbers start at 1 from the bottom
            const rowNumber = totalHeight - row;
            const x = gridSvgWidth + 10;
            const y = row * cellHeight + cellHeight / 2 + fontSize / 3;
            svgContent += `  <text x="${x}" y="${y}" font-family="monospace" font-size="${fontSize}" font-weight="500" fill="#666">${rowNumber}</text>\n`;
        }
    }

    svgContent += `</svg>`;

    return new Blob([svgContent], { type: 'image/svg+xml' });
}

/**
 * Export pattern as JSON
 * @param {ApplicationState} state - Application state
 * @returns {Blob} JSON blob for download
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
                grid: sanitizeGrid(patternData.grid.cells),
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
