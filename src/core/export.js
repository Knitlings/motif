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
export function sanitizeGrid(grid) {
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

// ============================================
// RUN LENGTHS
// The number of stitches written on each long run of one colour along a row
// ============================================

const RUN_LENGTH_DARK = '#1a1a18';
const RUN_LENGTH_LIGHT = '#ffffff';

/**
 * Find the runs of one colour along each row that are long enough to be numbered. A row of one
 * colour isn't numbered, so no run is longer than the chart's width less one (99 stitches): every
 * row of a preview or surroundings repeats at the chart's width
 * @param {(row: number, col: number) => string} colourAt - Colour shown at a stitch of the image
 * @param {number} cols - Stitches across the image
 * @param {number} rows - Rows down the image
 * @param {number} minLength - Shortest run to number
 * @param {{cutLeft?: boolean, cutRight?: boolean}} [cuts] - Sides of the image that cut through the
 *   pattern (surroundings): a run touching one may carry on past it, so it isn't numbered
 * @returns {{row: number, col: number, length: number, colour: string}[]} Runs, by first stitch
 */
export function findLongRuns(colourAt, cols, rows, minLength, { cutLeft = false, cutRight = false } = {}) {
    const runs = [];
    for (let row = 0; row < rows; row++) {
        let start = 0;
        let colour = colourAt(row, 0);
        for (let col = 1; col <= cols; col++) {
            const next = col < cols ? colourAt(row, col) : null;
            if (next !== null && next.toLowerCase() === colour.toLowerCase()) continue;
            const length = col - start;
            const cut = (cutLeft && start === 0) || (cutRight && col === cols);
            if (length >= minLength && length < cols && !cut) runs.push({ row, col: start, length, colour });
            start = col;
            colour = next;
        }
    }
    return runs;
}

/**
 * Relative luminance of a hex colour (#rgb or #rrggbb)
 * @param {string} hex
 * @returns {number|null} 0–1, or null if the colour can't be read
 */
function luminance(hex) {
    let digits = String(hex).replace('#', '');
    if (digits.length === 3) digits = digits.split('').map(d => d + d).join('');
    if (!/^[0-9a-f]{6}$/i.test(digits)) return null;
    const [r, g, b] = [0, 2, 4].map(i => {
        const c = parseInt(digits.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Ink for a run length: whichever of dark or white contrasts more with the stitches
 * @param {string} colour - The run's colour
 * @returns {string}
 */
export function runLengthInk(colour) {
    const l = luminance(colour);
    if (l === null) return RUN_LENGTH_DARK;
    const onWhite = 1.05 / (l + 0.05);
    const onDark = (l + 0.05) / (luminance(RUN_LENGTH_DARK) + 0.05);
    return onWhite > onDark ? RUN_LENGTH_LIGHT : RUN_LENGTH_DARK;
}

/**
 * Font size for a run length: the row counts' size, smaller if the number would overflow its stitch
 * @param {number} length - Stitches in the run
 * @param {number} cellWidth
 * @param {number} cellHeight
 * @returns {number}
 */
function runLengthFontSize(length, cellWidth, cellHeight) {
    // Monospace digits are about 0.6em wide; leave a little room at the stitch's sides
    const fitsWidth = (cellWidth * 0.9) / (String(length).length * 0.6);
    return Math.min(cellHeight * 0.6, fitsWidth);
}

/**
 * Centre of the stitch a run length is written in: the middle one, or left of the middle two
 * @param {{col: number, length: number}} run
 * @param {number} cellWidth
 * @returns {number}
 */
function runLengthX(run, cellWidth) {
    return (run.col + Math.floor((run.length - 1) / 2) + 0.5) * cellWidth;
}

/**
 * Write run lengths onto a canvas export
 * @param {CanvasRenderingContext2D} ctx
 * @param {ReturnType<typeof findLongRuns>} runs
 * @param {number} cellWidth
 * @param {number} cellHeight
 */
function drawRunLengths(ctx, runs, cellWidth, cellHeight) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const run of runs) {
        ctx.font = `600 ${runLengthFontSize(run.length, cellWidth, cellHeight)}px monospace`;
        ctx.fillStyle = runLengthInk(run.colour);
        ctx.fillText(String(run.length), runLengthX(run, cellWidth), (run.row + 0.5) * cellHeight);
    }
}

/**
 * Run lengths as SVG text
 * @param {ReturnType<typeof findLongRuns>} runs
 * @param {number} cellWidth
 * @param {number} cellHeight
 * @returns {string}
 */
function svgRunLengths(runs, cellWidth, cellHeight) {
    if (runs.length === 0) return '';
    let svg = `  <!-- Run lengths -->\n`;
    for (const run of runs) {
        const fontSize = runLengthFontSize(run.length, cellWidth, cellHeight);
        const x = runLengthX(run, cellWidth);
        const y = run.row * cellHeight + cellHeight / 2 + fontSize / 3;
        svg += `  <text x="${x}" y="${y}" text-anchor="middle" font-family="monospace" font-size="${fontSize}" font-weight="600" fill="${runLengthInk(run.colour)}">${run.length}</text>\n`;
    }
    return svg;
}

/**
 * Colour shown for a cell value
 * @param {number} value - 0 for the background, 1–N for pattern colours
 * @param {string[]} patternColors
 * @param {string} backgroundColor
 * @returns {string}
 */
function cellColour(value, patternColors, backgroundColor) {
    return value === 0 ? backgroundColor : (patternColors[value - 1] || backgroundColor);
}

/**
 * The runs to number in a download
 * @param {ApplicationState} state
 * @param {(row: number, col: number) => number} valueAt - Cell value at a stitch of the image
 * @param {number} cols - Stitches across the image
 * @param {number} rows - Rows down the image
 * @param {number|null} minRunLength - Shortest run to number; null for none
 * @param {{cutLeft?: boolean, cutRight?: boolean}} [cuts] - See findLongRuns
 * @returns {ReturnType<typeof findLongRuns>}
 */
function runsToNumber(state, valueAt, cols, rows, minRunLength, cuts) {
    if (minRunLength === null) return [];
    const { patternColors, backgroundColor } = state;
    return findLongRuns((row, col) => cellColour(valueAt(row, col), patternColors, backgroundColor),
        cols, rows, minRunLength, cuts);
}

/**
 * Row count for a row of the image: 1 at the bottom, or at the top for knitting top down
 * @param {number} row - From the top, starting at 0
 * @param {number} rows - Rows down the image
 * @param {boolean} fromTop
 * @returns {number}
 */
function rowNumber(row, rows, fromTop) {
    return fromTop ? row + 1 : rows - row;
}

/**
 * Cell value at a stitch of a surroundings download: one repeat after the left and top
 * surroundings, which come from the neighbouring repeats
 * @param {number[][]} grid
 * @param {number} leftContext - Stitches of surroundings at the left
 * @param {number} topContext - Rows of surroundings at the top
 * @param {number} row - Row of the image
 * @param {number} col - Stitch of the image
 * @returns {number}
 */
function contextCellValue(grid, leftContext, topContext, row, col) {
    const gridHeight = grid.length;
    const gridWidth = grid[0].length;
    const gridRow = (((row - topContext) % gridHeight) + gridHeight) % gridHeight;
    const gridCol = (((col - leftContext) % gridWidth) + gridWidth) % gridWidth;
    return grid[gridRow][gridCol];
}

/**
 * Export grid as SVG with grid lines
 * @param {ApplicationState} state - Application state containing grid, colors, dimensions
 * @param {boolean} includeRowCounts - Whether to include row count numbers
 * @param {number|null} minRunLength - Number runs of one colour at least this long; null for none
 * @param {boolean} rowCountsFromTop - Number the rows from the top (for knitting top down)
 * @returns {Blob} SVG blob for download
 */
export function exportSvg(state, includeRowCounts = false, minRunLength = null, rowCountsFromTop = false) {
    const { grid, gridWidth, gridHeight, patternColors, backgroundColor } = state;

    // Calculate cell dimensions from canvas
    const canvas = document.getElementById('editCanvas');
    const cellWidth = canvas.width / gridWidth;
    const cellHeight = canvas.height / gridHeight;

    // Calculate SVG dimensions
    const gridSvgWidth = gridWidth * cellWidth;
    const gridSvgHeight = gridHeight * cellHeight;

    // Add extra width for row counts if needed (scales with cell size)
    const fontSize = cellHeight * 0.6;
    const rowCountMargin = includeRowCounts ? Math.max(40, Math.round(fontSize * 2.2)) : 0;
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
        const textPadding = Math.round(fontSize * 0.4);
        for (let row = 0; row < gridHeight; row++) {
            const number = rowNumber(row, gridHeight, rowCountsFromTop);
            const x = gridSvgWidth + textPadding;
            const y = row * cellHeight + cellHeight / 2 + fontSize / 3;
            svgContent += `  <text x="${x}" y="${y}" font-family="monospace" font-size="${fontSize}" font-weight="500" fill="#666">${number}</text>\n`;
        }
    }

    const runs = runsToNumber(state, (row, col) => grid[row][col], gridWidth, gridHeight, minRunLength);
    svgContent += svgRunLengths(runs, cellWidth, cellHeight);

    svgContent += `</svg>`;

    return new Blob([svgContent], { type: 'image/svg+xml' });
}

/**
 * Export grid as PNG
 * @param {ApplicationState} state - Application state containing grid dimensions
 * @param {boolean} includeRowCounts - Whether to include row count numbers
 * @param {number} customCellSize - Optional custom cell size in pixels (overrides canvas size)
 * @param {number|null} minRunLength - Number runs of one colour at least this long; null for none
 * @param {boolean} rowCountsFromTop - Number the rows from the top (for knitting top down)
 * @returns {Promise<Blob>} - PNG blob for download
 */
export function exportPng(state, includeRowCounts = false, customCellSize = null, minRunLength = null, rowCountsFromTop = false) {
    const canvas = document.getElementById('editCanvas');

    // Fast path: no numbers and no custom size — just export the existing canvas
    if (!includeRowCounts && customCellSize === null && minRunLength === null) {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png');
        });
    }

    const { grid, gridWidth, gridHeight, patternColors, backgroundColor, aspectRatio } = state;

    // Determine cell dimensions
    let cellWidth, cellHeight, sourceCanvas;

    if (customCellSize !== null) {
        // Use custom cell size
        cellWidth = customCellSize;
        cellHeight = customCellSize * aspectRatio;
        sourceCanvas = null; // Will render manually
    } else {
        // Use current canvas dimensions
        cellWidth = canvas.width / gridWidth;
        cellHeight = canvas.height / gridHeight;
        sourceCanvas = canvas;
    }

    // Create a temporary canvas with extra width for row counts if needed (scales with cell size)
    const fontSize = cellHeight * 0.6;
    const rowCountMargin = includeRowCounts ? Math.max(40, Math.round(fontSize * 2.2)) : 0;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = gridWidth * cellWidth + rowCountMargin;
    tempCanvas.height = gridHeight * cellHeight;
    const ctx = tempCanvas.getContext('2d');

    // Fill background color
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw the grid
    if (sourceCanvas) {
        // Use existing canvas
        ctx.drawImage(sourceCanvas, 0, 0);
    } else {
        // Render grid manually at custom size
        for (let row = 0; row < gridHeight; row++) {
            for (let col = 0; col < gridWidth; col++) {
                const cellValue = grid[row][col];
                // 0 = background, 1-N = pattern colors
                if (cellValue === 0) {
                    ctx.fillStyle = backgroundColor;
                } else {
                    const color = patternColors[cellValue - 1];
                    ctx.fillStyle = color || backgroundColor;
                }
                ctx.fillRect(col * cellWidth, row * cellHeight, cellWidth, cellHeight);

                // Draw grid lines
                ctx.strokeStyle = '#ddd';
                ctx.lineWidth = 1;
                ctx.strokeRect(col * cellWidth, row * cellHeight, cellWidth, cellHeight);
            }
        }
    }

    if (includeRowCounts) {
        const gridPixelWidth = gridWidth * cellWidth;
        const gridPixelHeight = gridHeight * cellHeight;

        // Add white background for row count area
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(gridPixelWidth, 0, rowCountMargin, tempCanvas.height);

        // Add black border around pattern
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, gridPixelWidth, gridPixelHeight);

        // Extend horizontal lines into row count area with dark color
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        for (let row = 0; row <= gridHeight; row++) {
            const y = row * cellHeight;
            ctx.beginPath();
            ctx.moveTo(gridPixelWidth, y);
            ctx.lineTo(tempCanvas.width, y);
            ctx.stroke();
        }

        // Draw row counts
        const textPadding = Math.round(fontSize * 0.4);
        ctx.fillStyle = '#666';
        ctx.font = `500 ${fontSize}px monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        for (let row = 0; row < gridHeight; row++) {
            const number = rowNumber(row, gridHeight, rowCountsFromTop);
            const x = gridPixelWidth + textPadding;
            const y = row * cellHeight + cellHeight / 2;
            ctx.fillText(number.toString(), x, y);
        }
    }

    const runs = runsToNumber(state, (row, col) => grid[row][col], gridWidth, gridHeight, minRunLength);
    drawRunLengths(ctx, runs, cellWidth, cellHeight);

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
 * @param {number|null} minRunLength - Number runs of one colour at least this long; null for none
 * @param {boolean} rowCountsFromTop - Number the rows from the top (for knitting top down)
 * @returns {Blob} SVG blob for download
 */
export function exportPatternWithContextSvg(state, context, includeRowCounts = false, minRunLength = null, rowCountsFromTop = false) {
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

    // Add extra width for row counts if needed (scales with cell size)
    const fontSize = cellHeight * 0.6;
    const rowCountMargin = includeRowCounts ? Math.max(40, Math.round(fontSize * 2.2)) : 0;
    const svgWidth = gridSvgWidth + rowCountMargin;
    const svgHeight = gridSvgHeight;

    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${svgWidth}" height="${svgHeight}" fill="${backgroundColor}"/>
`;

    // Draw cells from a 3×3 conceptual tile, extracting only the needed portion
    for (let row = 0; row < totalHeight; row++) {
        for (let col = 0; col < totalWidth; col++) {
            const cellValue = contextCellValue(grid, leftContext, topContext, row, col);

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
    svgContent += `  <rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" fill="none" stroke="#000000" stroke-width="6"/>\n`;

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
        const textPadding = Math.round(fontSize * 0.4);
        for (let row = 0; row < totalHeight; row++) {
            const number = rowNumber(row, totalHeight, rowCountsFromTop);
            const x = gridSvgWidth + textPadding;
            const y = row * cellHeight + cellHeight / 2 + fontSize / 3;
            svgContent += `  <text x="${x}" y="${y}" font-family="monospace" font-size="${fontSize}" font-weight="500" fill="#666">${number}</text>\n`;
        }
    }

    // The sides cut through the pattern wherever there are surroundings
    const runs = runsToNumber(state, (row, col) => contextCellValue(grid, leftContext, topContext, row, col),
        totalWidth, totalHeight, minRunLength, { cutLeft: leftContext > 0, cutRight: rightContext > 0 });
    svgContent += svgRunLengths(runs, cellWidth, cellHeight);

    svgContent += `</svg>`;

    return new Blob([svgContent], { type: 'image/svg+xml' });
}

/**
 * Export pattern with context stitches as PNG
 * Shows center repeat from a 3×3 tile plus specified context stitches
 * @param {ApplicationState} state - Application state
 * @param {Object} context - Context stitches {left, right, top, bottom}
 * @param {boolean} includeRowCounts - Whether to include row count numbers
 * @param {number} customCellSize - Optional custom cell size in pixels (overrides canvas size)
 * @param {number|null} minRunLength - Number runs of one colour at least this long; null for none
 * @param {boolean} rowCountsFromTop - Number the rows from the top (for knitting top down)
 * @returns {Promise<Blob>} - PNG blob for download
 */
export async function exportPatternWithContextPng(state, context, includeRowCounts = false, customCellSize = null, minRunLength = null, rowCountsFromTop = false) {
    const { grid, gridWidth, gridHeight, patternColors, backgroundColor, aspectRatio } = state;
    const { left = 0, right = 0, top = 0, bottom = 0 } = context;

    // Clamp context values to pattern dimensions
    const leftContext = Math.min(left, gridWidth - 1);
    const rightContext = Math.min(right, gridWidth - 1);
    const topContext = Math.min(top, gridHeight - 1);
    const bottomContext = Math.min(bottom, gridHeight - 1);

    // Calculate total dimensions
    const totalWidth = leftContext + gridWidth + rightContext;
    const totalHeight = topContext + gridHeight + bottomContext;

    // Get cell dimensions
    let cellWidth, cellHeight;
    if (customCellSize !== null) {
        cellWidth = customCellSize;
        cellHeight = customCellSize * aspectRatio;
    } else {
        const sourceCanvas = document.getElementById('editCanvas');
        cellWidth = sourceCanvas.width / gridWidth;
        cellHeight = sourceCanvas.height / gridHeight;
    }

    // Create temporary canvas (row count margin scales with cell size)
    const fontSize = cellHeight * 0.6;
    const rowCountMargin = includeRowCounts ? Math.max(40, Math.round(fontSize * 2.2)) : 0;
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
            const cellValue = contextCellValue(grid, leftContext, topContext, row, col);

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
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 6;
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

        const textPadding = Math.round(fontSize * 0.4);
        ctx.fillStyle = '#666';
        ctx.font = `500 ${fontSize}px monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        for (let row = 0; row < totalHeight; row++) {
            const number = rowNumber(row, totalHeight, rowCountsFromTop);
            const x = totalWidth * cellWidth + textPadding;
            const y = row * cellHeight + cellHeight / 2;
            ctx.fillText(number.toString(), x, y);
        }
    }

    // The sides cut through the pattern wherever there are surroundings
    const runs = runsToNumber(state, (row, col) => contextCellValue(grid, leftContext, topContext, row, col),
        totalWidth, totalHeight, minRunLength, { cutLeft: leftContext > 0, cutRight: rightContext > 0 });
    drawRunLengths(ctx, runs, cellWidth, cellHeight);

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
 * @param {number} customCellSize - Optional custom cell size in pixels (overrides canvas size)
 * @param {number|null} minRunLength - Number runs of one colour at least this long; null for none
 * @param {boolean} rowCountsFromTop - Number the rows from the top (for knitting top down)
 * @returns {Promise<Blob>} - PNG blob for download
 */
export function exportPreviewPng(state, includeRowCounts = false, customCellSize = null, minRunLength = null, rowCountsFromTop = false) {
    const canvas = document.getElementById('previewCanvas');

    // Fast path: no numbers and no custom size — just export the existing canvas
    if (!includeRowCounts && customCellSize === null && minRunLength === null) {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png');
        });
    }

    const { grid, gridWidth, gridHeight, previewRepeatX, previewRepeatY, patternColors, backgroundColor, aspectRatio } = state;

    const totalWidth = gridWidth * previewRepeatX;
    const totalHeight = gridHeight * previewRepeatY;

    // Determine cell dimensions
    let cellWidth, cellHeight, sourceCanvas;

    if (customCellSize !== null) {
        // Use custom cell size
        cellWidth = customCellSize;
        cellHeight = customCellSize * aspectRatio;
        sourceCanvas = null; // Will render manually
    } else {
        // Use current canvas dimensions
        cellWidth = canvas.width / totalWidth;
        cellHeight = canvas.height / totalHeight;
        sourceCanvas = canvas;
    }

    // Create a temporary canvas with extra width for row counts if needed (scales with cell size)
    const fontSize = cellHeight * 0.6;
    const rowCountMargin = includeRowCounts ? Math.max(40, Math.round(fontSize * 2.2)) : 0;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = totalWidth * cellWidth + rowCountMargin;
    tempCanvas.height = totalHeight * cellHeight;
    const ctx = tempCanvas.getContext('2d');

    // Fill background color
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw the preview
    if (sourceCanvas) {
        // Use existing canvas
        ctx.drawImage(sourceCanvas, 0, 0);
    } else {
        // Render tiled preview manually at custom size
        for (let repeatY = 0; repeatY < previewRepeatY; repeatY++) {
            for (let repeatX = 0; repeatX < previewRepeatX; repeatX++) {
                const offsetX = repeatX * gridWidth;
                const offsetY = repeatY * gridHeight;

                for (let row = 0; row < gridHeight; row++) {
                    for (let col = 0; col < gridWidth; col++) {
                        const x = (offsetX + col) * cellWidth;
                        const y = (offsetY + row) * cellHeight;

                        const cellValue = grid[row][col];
                        if (cellValue === 0) {
                            ctx.fillStyle = backgroundColor;
                        } else {
                            const color = patternColors[cellValue - 1];
                            ctx.fillStyle = color || backgroundColor;
                        }
                        ctx.fillRect(x, y, cellWidth, cellHeight);

                        // Draw grid lines
                        ctx.strokeStyle = '#eee';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(x, y, cellWidth, cellHeight);
                    }
                }
            }
        }
    }

    if (includeRowCounts) {
        const gridPixelWidth = totalWidth * cellWidth;
        const gridPixelHeight = totalHeight * cellHeight;

        // Add white background for row count area
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(gridPixelWidth, 0, rowCountMargin, tempCanvas.height);

        // Add black border around pattern
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, gridPixelWidth, gridPixelHeight);

        // Extend horizontal lines into row count area with dark color
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        for (let row = 0; row <= totalHeight; row++) {
            const y = row * cellHeight;
            ctx.beginPath();
            ctx.moveTo(gridPixelWidth, y);
            ctx.lineTo(tempCanvas.width, y);
            ctx.stroke();
        }

        // Draw row counts
        const textPadding = Math.round(fontSize * 0.4);
        ctx.fillStyle = '#666';
        ctx.font = `500 ${fontSize}px monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        for (let row = 0; row < totalHeight; row++) {
            const number = rowNumber(row, totalHeight, rowCountsFromTop);
            const x = gridPixelWidth + textPadding;
            const y = row * cellHeight + cellHeight / 2;
            ctx.fillText(number.toString(), x, y);
        }
    }

    const runs = runsToNumber(state, (row, col) => grid[row % gridHeight][col % gridWidth],
        totalWidth, totalHeight, minRunLength);
    drawRunLengths(ctx, runs, cellWidth, cellHeight);

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
 * @param {number|null} minRunLength - Number runs of one colour at least this long; null for none
 * @param {boolean} rowCountsFromTop - Number the rows from the top (for knitting top down)
 * @returns {Blob} SVG blob for download
 */
export function exportPreviewSvg(state, includeRowCounts = false, minRunLength = null, rowCountsFromTop = false) {
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

    // Add extra width for row counts if needed (scales with cell size)
    const fontSize = cellHeight * 0.6;
    const rowCountMargin = includeRowCounts ? Math.max(40, Math.round(fontSize * 2.2)) : 0;
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
        const textPadding = Math.round(fontSize * 0.4);
        for (let row = 0; row < totalHeight; row++) {
            const number = rowNumber(row, totalHeight, rowCountsFromTop);
            const x = gridSvgWidth + textPadding;
            const y = row * cellHeight + cellHeight / 2 + fontSize / 3;
            svgContent += `  <text x="${x}" y="${y}" font-family="monospace" font-size="${fontSize}" font-weight="500" fill="#666">${number}</text>\n`;
        }
    }

    const runs = runsToNumber(state, (row, col) => grid[row % gridHeight][col % gridWidth],
        totalWidth, totalHeight, minRunLength);
    svgContent += svgRunLengths(runs, cellWidth, cellHeight);

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
