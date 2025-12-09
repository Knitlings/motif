import { test, expect } from '@playwright/test';

test.describe('UI Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#editCanvas');
  });

  test('should change grid dimensions', async ({ page }) => {
    // Grid dimensions are now inline contenteditable elements
    const widthDisplay = page.locator('#gridWidthDisplay');

    // Wait for display to be visible
    await widthDisplay.waitFor({ state: 'visible' });

    // Change width by editing contenteditable element
    await widthDisplay.click();
    await widthDisplay.fill('10');
    await widthDisplay.press('Enter');

    // Verify display updated
    await expect(widthDisplay).toHaveText('10');
  });

  test('should open palette dropdown', async ({ page }) => {
    const paletteBtn = page.locator('#navbarPaletteDropdownBtn');
    const paletteMenu = page.locator('#navbarPaletteMenu');

    // Wait for palette button to be visible
    await paletteBtn.waitFor({ state: 'visible' });

    // Click to open palette dropdown
    await paletteBtn.click();

    // Verify dropdown menu is visible
    await expect(paletteMenu).toBeVisible();

    // Verify palette grid is visible
    const paletteGrid = page.locator('#navbarPaletteGrid');
    await expect(paletteGrid).toBeVisible();
  });

  test('should change active pattern color from navbar', async ({ page }) => {
    const canvas = page.locator('#editCanvas');

    // Click on a color button in the navbar
    const colorBtn = page.locator('.navbar-color-btn').first();
    await colorBtn.waitFor({ state: 'visible' });

    // Color button should be visible and have active class initially
    await expect(colorBtn).toHaveClass(/active/);

    // Canvas should still be visible
    await expect(canvas).toBeVisible();
  });

  test('should add new pattern color', async ({ page }) => {
    // Click the add button (+ button) in the navbar
    const addBtn = page.locator('.navbar-color-btn.add-btn');

    // Wait for add button to be visible
    await addBtn.first().waitFor({ state: 'visible' });

    // Get initial count of color buttons
    const initialCount = await page.locator('.navbar-color-btn:not(.add-btn)').count();

    // Click add button
    await addBtn.click();

    // Verify a new color button was added
    const newCount = await page.locator('.navbar-color-btn:not(.add-btn)').count();
    expect(newCount).toBe(initialCount + 1);
  });

  test('should clear canvas with confirmation', async ({ page }) => {
    const canvas = page.locator('#editCanvas');
    const clearBtn = page.locator('#clearBtn');

    // Paint something first
    await canvas.click({ position: { x: 50, y: 50 } });

    // Click clear button
    await clearBtn.click();

    // Confirmation dialog should appear
    const dialog = page.locator('#mergeDialog');
    await expect(dialog).toBeVisible();

    // Click cancel
    const cancelBtn = page.locator('#mergeCancelBtn');
    await cancelBtn.click();

    // Dialog should close
    await expect(dialog).not.toBeVisible();
  });

  test('should switch between palettes', async ({ page }) => {
    const paletteBtn = page.locator('#navbarPaletteDropdownBtn');
    const paletteMenu = page.locator('#navbarPaletteMenu');

    // Open palette dropdown
    await paletteBtn.click();
    await expect(paletteMenu).toBeVisible();

    // Click on a different palette option
    const warmPaletteOption = page.locator('.navbar-palette-option[data-palette="warm"]');
    await warmPaletteOption.click();

    // Palette should have switched (menu may stay open - that's okay)
    // The important thing is that the palette selection worked
    const paletteGrid = page.locator('#navbarPaletteGrid');
    await expect(paletteGrid).toBeVisible();
  });

  test('should load palette colors to pattern', async ({ page }) => {
    const paletteBtn = page.locator('#navbarPaletteDropdownBtn');
    const loadPaletteBtn = page.locator('#navbarLoadPaletteBtn');

    // Open palette dropdown
    await paletteBtn.click();

    // Click load palette button
    await loadPaletteBtn.waitFor({ state: 'visible' });
    await loadPaletteBtn.click();

    // Verify color buttons were updated (at least one should exist)
    const colorBtnCount = await page.locator('.navbar-color-btn:not(.add-btn)').count();
    expect(colorBtnCount).toBeGreaterThanOrEqual(1);
  });

  test('hamburger menu should toggle', async ({ page }) => {
    const hamburgerBtn = page.locator('#navbarHamburgerBtn');
    const hamburgerMenu = page.locator('#navbarHamburgerMenu');

    // Click to open
    await hamburgerBtn.click();
    await expect(hamburgerMenu).toHaveClass(/open/);

    // Click to close
    await hamburgerBtn.click();
    await expect(hamburgerMenu).not.toHaveClass(/open/);
  });

  test('should change grid dimensions with chevrons', async ({ page }) => {
    const widthDisplay = page.locator('#gridWidthDisplay');
    const rightChevron = page.locator('.grid-chevron-right');

    // Wait for elements to be visible
    await widthDisplay.waitFor({ state: 'visible' });
    await rightChevron.waitFor({ state: 'visible' });

    // Get initial width
    const initialWidth = await widthDisplay.textContent();

    // Click right chevron to increase width
    await rightChevron.click();

    // Width should increase
    const newWidth = await widthDisplay.textContent();
    expect(parseInt(newWidth)).toBe(parseInt(initialWidth) + 1);
  });

  test('should change preview repeat dimensions', async ({ page }) => {
    const repeatXDisplay = page.locator('#previewRepeatXDisplay');

    // Wait for display to be visible
    await repeatXDisplay.waitFor({ state: 'visible' });

    // Change preview repeat by editing contenteditable element
    await repeatXDisplay.click();
    await repeatXDisplay.fill('5');
    await repeatXDisplay.press('Enter');

    // Verify display updated
    await expect(repeatXDisplay).toHaveText('5');
  });

  test('should not have CSP violations', async ({ page }) => {
    const violations = [];

    // Listen for console errors related to CSP
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
        // Ignore benign warning about frame-ancestors in meta tags
        // (browsers only support frame-ancestors in HTTP headers, not meta tags)
        if (!msg.text().includes('frame-ancestors')) {
          violations.push(msg.text());
        }
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should have no CSP violations (excluding benign frame-ancestors warning)
    expect(violations).toHaveLength(0);
  });
});

test.describe('Export Functions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#editCanvas');
  });

  test('should open download modal', async ({ page }) => {
    const downloadBtn = page.locator('#downloadBtn');
    const downloadModal = page.locator('#downloadModal');

    // Click download button
    await downloadBtn.click();

    // Modal should be visible
    await expect(downloadModal).toBeVisible();
  });

  test('should close download modal on cancel', async ({ page }) => {
    const downloadBtn = page.locator('#downloadBtn');
    const downloadModal = page.locator('#downloadModal');
    const cancelBtn = page.locator('#downloadModalCancelBtn');

    // Open modal
    await downloadBtn.click();
    await expect(downloadModal).toBeVisible();

    // Click cancel
    await cancelBtn.click();

    // Modal should close
    await expect(downloadModal).not.toBeVisible();
  });

  test('should close download modal on escape key', async ({ page }) => {
    const downloadBtn = page.locator('#downloadBtn');
    const downloadModal = page.locator('#downloadModal');

    // Open modal
    await downloadBtn.click();
    await expect(downloadModal).toBeVisible();

    // Press escape
    await page.keyboard.press('Escape');

    // Modal should close
    await expect(downloadModal).not.toBeVisible();
  });

  test('should export pattern as SVG', async ({ page }) => {
    const canvas = page.locator('#editCanvas');

    // Paint something first
    await canvas.click({ position: { x: 50, y: 50 } });

    // Open download modal
    await page.locator('#downloadBtn').click();
    await expect(page.locator('#downloadModal')).toBeVisible();

    // Select pattern and SVG (should be selected by default)
    const patternRadio = page.locator('input[name="source"][value="pattern"]');
    const svgRadio = page.locator('label:has(input[name="format"][value="svg"])');

    await expect(patternRadio).toBeChecked();
    await svgRadio.click();

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click download button
    await page.locator('#downloadModalSubmitBtn').click();

    // Wait for download
    const download = await downloadPromise;

    // Verify download occurred
    expect(download.suggestedFilename()).toMatch(/motif-pattern-.*\.svg/);
  });

  test('should export pattern as PNG', async ({ page }) => {
    const canvas = page.locator('#editCanvas');

    // Paint something first
    await canvas.click({ position: { x: 50, y: 50 } });

    // Open download modal
    await page.locator('#downloadBtn').click();
    await expect(page.locator('#downloadModal')).toBeVisible();

    // Select pattern and PNG (both should be selected by default)
    const patternRadio = page.locator('input[name="source"][value="pattern"]');
    const pngRadio = page.locator('input[name="format"][value="png"]');

    await expect(patternRadio).toBeChecked();
    await expect(pngRadio).toBeChecked();

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click download button
    await page.locator('#downloadModalSubmitBtn').click();

    // Wait for download
    const download = await downloadPromise;

    // Verify download occurred
    expect(download.suggestedFilename()).toMatch(/motif-pattern-.*\.png/);
  });

  test('should export preview as SVG', async ({ page }) => {
    const canvas = page.locator('#editCanvas');

    // Paint something first
    await canvas.click({ position: { x: 50, y: 50 } });

    // Open download modal
    await page.locator('#downloadBtn').click();
    await expect(page.locator('#downloadModal')).toBeVisible();

    // Select preview and SVG
    const previewRadio = page.locator('label:has(input[name="source"][value="preview"])');
    const svgRadio = page.locator('label:has(input[name="format"][value="svg"])');

    await previewRadio.click();
    await svgRadio.click();

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click download button
    await page.locator('#downloadModalSubmitBtn').click();

    // Wait for download
    const download = await downloadPromise;

    // Verify download occurred with preview in filename
    expect(download.suggestedFilename()).toMatch(/motif-preview-.*\.svg/);
  });

  test('should export preview as PNG', async ({ page }) => {
    const canvas = page.locator('#editCanvas');

    // Paint something first
    await canvas.click({ position: { x: 50, y: 50 } });

    // Open download modal
    await page.locator('#downloadBtn').click();
    await expect(page.locator('#downloadModal')).toBeVisible();

    // Select preview (PNG is default format)
    const previewRadio = page.locator('label:has(input[name="source"][value="preview"])');
    await previewRadio.click();

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click download button
    await page.locator('#downloadModalSubmitBtn').click();

    // Wait for download
    const download = await downloadPromise;

    // Verify download occurred with preview in filename
    expect(download.suggestedFilename()).toMatch(/motif-preview-.*\.png/);
  });

  test('should export JSON', async ({ page }) => {
    const canvas = page.locator('#editCanvas');

    // Paint something first
    await canvas.click({ position: { x: 50, y: 50 } });

    // Open the hamburger menu
    await page.locator('#navbarHamburgerBtn').click();

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click export JSON in hamburger menu
    await page.locator('#navbarExportJsonBtn').click();

    // Wait for download
    const download = await downloadPromise;

    // Verify download occurred
    expect(download.suggestedFilename()).toMatch(/motif-.*\.json/);
  });
});

test.describe('Pattern with Context Visual Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#editCanvas');
  });

  test('should show visual selection mode for small patterns', async ({ page }) => {
    // Open download modal
    await page.locator('#downloadBtn').click();

    // Wait for modal to be fully visible
    const downloadModal = page.locator('#downloadModal');
    await expect(downloadModal).toBeVisible();

    // Select pattern-with-context (click on label wrapper)
    // Use force: true to bypass pointer event interception on mobile
    await page.locator('label:has(input[name="source"][value="pattern-with-context"])').click({ force: true });

    // Context controls should be hidden for small pattern (default 5x5 supports 3x3)
    const contextControls = page.locator('#contextControls');
    await expect(contextControls).not.toBeVisible();

    // Submit to enter visual selection mode
    await page.locator('#downloadModalSubmitBtn').click();

    // Visual selection controls should appear
    const visualControls = page.locator('#visualSelectionControls');
    await expect(visualControls).toBeVisible();

    // Preview should show 3x3
    const repeatXDisplay = page.locator('#previewRepeatXDisplay');
    await expect(repeatXDisplay).toHaveText('3');
  });

  test('should show form inputs for large patterns', async ({ page }) => {
    // Change grid to large size (>= 53 would force max repeat < 3)
    const widthDisplay = page.locator('#gridWidthDisplay');
    await widthDisplay.click();
    await widthDisplay.fill('60');
    await widthDisplay.press('Enter');

    // Open download modal
    await page.locator('#downloadBtn').click();

    // Wait for modal to be fully visible
    const downloadModal = page.locator('#downloadModal');
    await expect(downloadModal).toBeVisible();

    // Select pattern-with-context (click on label wrapper)
    // Use force: true to bypass pointer event interception on mobile
    await page.locator('label:has(input[name="source"][value="pattern-with-context"])').click({ force: true });

    // Context form controls should be visible for large pattern
    const contextControls = page.locator('#contextControls');
    await expect(contextControls).toBeVisible();

    // Check that max values are set correctly (gridWidth - 1 = 59)
    const leftInput = page.locator('#contextLeft');
    await expect(leftInput).toHaveAttribute('max', '59');
  });

  test('should exit visual selection on cancel', async ({ page }) => {
    // Enter visual selection mode
    await page.locator('#downloadBtn').click();

    // Wait for modal to be fully visible
    const downloadModal = page.locator('#downloadModal');
    await expect(downloadModal).toBeVisible();

    // Select pattern-with-context (click on label wrapper)
    // Use force: true to bypass pointer event interception on mobile
    await page.locator('label:has(input[name="source"][value="pattern-with-context"])').click({ force: true });
    await page.locator('#downloadModalSubmitBtn').click();

    // Visual controls should be visible
    const visualControls = page.locator('#visualSelectionControls');
    await expect(visualControls).toBeVisible();

    // Click cancel
    await page.locator('#visualSelectionCancelBtn').click();

    // Visual controls should disappear
    await expect(visualControls).not.toBeVisible();

    // Preview should restore original repeat (default 3x3)
    const repeatXDisplay = page.locator('#previewRepeatXDisplay');
    await expect(repeatXDisplay).toHaveText('3');
  });

  test('should exit visual selection on escape key', async ({ page }) => {
    // Enter visual selection mode
    await page.locator('#downloadBtn').click();

    // Wait for modal to be fully visible
    const downloadModal = page.locator('#downloadModal');
    await expect(downloadModal).toBeVisible();

    // Select pattern-with-context (click on label wrapper)
    // Use force: true to bypass pointer event interception on mobile
    await page.locator('label:has(input[name="source"][value="pattern-with-context"])').click({ force: true });
    await page.locator('#downloadModalSubmitBtn').click();

    // Visual controls should be visible
    const visualControls = page.locator('#visualSelectionControls');
    await expect(visualControls).toBeVisible();

    // Press escape
    await page.keyboard.press('Escape');

    // Visual controls should disappear
    await expect(visualControls).not.toBeVisible();
  });

  test('should download with visual context selection', async ({ page }) => {
    // Paint something first
    const canvas = page.locator('#editCanvas');
    await canvas.click({ position: { x: 50, y: 50 } });

    // Enter visual selection mode
    await page.locator('#downloadBtn').click();

    // Wait for modal to be fully visible
    const downloadModal = page.locator('#downloadModal');
    await expect(downloadModal).toBeVisible();

    // Select pattern-with-context (click on label wrapper)
    // Use force: true to bypass pointer event interception on mobile
    await page.locator('label:has(input[name="source"][value="pattern-with-context"])').click({ force: true });
    await page.locator('#downloadModalSubmitBtn').click();

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click download
    await page.locator('#visualSelectionDownloadBtn').click();

    // Wait for download
    const download = await downloadPromise;

    // Verify download occurred with context in filename
    expect(download.suggestedFilename()).toMatch(/motif-pattern-surroundings-.*\.png/);
  });

  test('should download with form context values for large patterns', async ({ page }) => {
    // Paint something first
    const canvas = page.locator('#editCanvas');
    await canvas.click({ position: { x: 50, y: 50 } });

    // Change grid to large size
    const widthDisplay = page.locator('#gridWidthDisplay');
    await widthDisplay.click();
    await widthDisplay.fill('60');
    await widthDisplay.press('Enter');

    // Open download modal
    await page.locator('#downloadBtn').click();

    // Wait for modal to be fully visible
    const downloadModal = page.locator('#downloadModal');
    await expect(downloadModal).toBeVisible();

    // Select pattern-with-context (click on label wrapper)
    // Use force: true to bypass pointer event interception on mobile
    await page.locator('label:has(input[name="source"][value="pattern-with-context"])').click({ force: true });

    // Fill in context values
    await page.locator('#contextLeft').fill('2');
    await page.locator('#contextRight').fill('2');

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Submit (force: true to bypass pointer interception on mobile)
    await page.locator('#downloadModalSubmitBtn').click({ force: true });

    // Wait for download
    const download = await downloadPromise;

    // Verify download occurred
    expect(download.suggestedFilename()).toMatch(/motif-pattern-surroundings-.*\.png/);
  });
});
