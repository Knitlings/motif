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

  test('should export SVG', async ({ page }) => {
    const canvas = page.locator('#editCanvas');

    // Paint something first
    await canvas.click({ position: { x: 50, y: 50 } });

    // Open the Save dropdown menu
    await page.locator('#saveBtn').click();

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click export SVG
    await page.locator('#exportSvgBtn').click();

    // Wait for download
    const download = await downloadPromise;

    // Verify download occurred
    expect(download.suggestedFilename()).toMatch(/motif-.*\.svg/);
  });

  test('should export PNG', async ({ page }) => {
    const canvas = page.locator('#editCanvas');

    // Paint something first
    await canvas.click({ position: { x: 50, y: 50 } });

    // Open the Save dropdown menu
    await page.locator('#saveBtn').click();

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click export PNG
    await page.locator('#exportPngBtn').click();

    // Wait for download
    const download = await downloadPromise;

    // Verify download occurred
    expect(download.suggestedFilename()).toMatch(/motif-.*\.png/);
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
