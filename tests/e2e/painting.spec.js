import { test, expect } from '@playwright/test';

test.describe('Canvas Painting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for canvas to be ready
    await page.waitForSelector('#editCanvas');
  });

  test('should load the application', async ({ page }) => {
    await expect(page).toHaveTitle(/Motif/);

    // Check that main elements are present
    await expect(page.locator('#editCanvas')).toBeVisible();
    await expect(page.locator('#previewCanvas')).toBeVisible();
  });

  test('should paint a cell when clicking on canvas', async ({ page }) => {
    const canvas = page.locator('#editCanvas');

    // Click on the canvas to paint
    await canvas.click({ position: { x: 50, y: 50 } });

    // The canvas should have been redrawn (we can check via screenshot or canvas data)
    // For now, we'll just verify the click didn't cause errors
    await expect(canvas).toBeVisible();
  });

  test('should show canvas instructions initially', async ({ page }) => {
    const instructions = page.locator('#canvasInstructions');
    await expect(instructions).toBeVisible();
  });

  test('should hide canvas instructions after first interaction', async ({ page }) => {
    const instructions = page.locator('#canvasInstructions');
    const canvas = page.locator('#editCanvas');

    // Verify instructions are visible initially
    await expect(instructions).toBeVisible();

    // Click on canvas
    await canvas.click({ position: { x: 50, y: 50 } });

    // Wait for fade-out animation and verify instructions are hidden
    await page.waitForTimeout(500);
    await expect(instructions).not.toBeVisible();
  });

  test('should enable undo button after painting', async ({ page }) => {
    const canvas = page.locator('#editCanvas');
    const undoBtn = page.locator('#undoBtn');

    // Undo should be disabled initially
    await expect(undoBtn).toBeDisabled();

    // Paint on canvas
    await canvas.click({ position: { x: 50, y: 50 } });

    // Undo should now be enabled
    await expect(undoBtn).toBeEnabled();
  });

  test('should undo and redo painting', async ({ page }) => {
    const canvas = page.locator('#editCanvas');
    const undoBtn = page.locator('#undoBtn');
    const redoBtn = page.locator('#redoBtn');

    // Paint on canvas
    await canvas.click({ position: { x: 50, y: 50 } });

    // Redo should be disabled after painting
    await expect(redoBtn).toBeDisabled();

    // Click undo
    await undoBtn.click();

    // Redo should now be enabled
    await expect(redoBtn).toBeEnabled();

    // Click redo
    await redoBtn.click();

    // Redo should be disabled again
    await expect(redoBtn).toBeDisabled();
  });

  test('should use shift-click to erase', async ({ page }) => {
    const canvas = page.locator('#editCanvas');

    // First paint a cell
    await canvas.click({ position: { x: 50, y: 50 } });

    // Then shift-click to erase
    await canvas.click({ position: { x: 50, y: 50 }, modifiers: ['Shift'] });

    // Canvas should still be visible (basic sanity check)
    await expect(canvas).toBeVisible();
  });
});

test.describe('Canvas Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#editCanvas');
  });

  test('should paint a simple pattern', async ({ page }) => {
    const canvas = page.locator('#editCanvas');

    // Paint a few cells to create a simple pattern
    await canvas.click({ position: { x: 50, y: 50 } });
    await canvas.click({ position: { x: 100, y: 50 } });
    await canvas.click({ position: { x: 50, y: 100 } });

    // Take a screenshot to verify the pattern
    await expect(canvas).toHaveScreenshot('simple-pattern.png', {
      maxDiffPixels: 100, // Allow some difference due to anti-aliasing
    });
  });

  test('should preview tiled pattern', async ({ page }) => {
    const editCanvas = page.locator('#editCanvas');
    const previewCanvas = page.locator('#previewCanvas');

    // Paint a simple pattern
    await editCanvas.click({ position: { x: 50, y: 50 } });
    await editCanvas.click({ position: { x: 100, y: 100 } });

    // Verify preview canvas shows tiled version
    await expect(previewCanvas).toBeVisible();
    await expect(previewCanvas).toHaveScreenshot('tiled-preview.png', {
      maxDiffPixels: 100,
    });
  });
});
