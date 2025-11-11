import { test, expect } from '@playwright/test';

test.describe('UI Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#editCanvas');
  });

  test('should change grid dimensions', async ({ page }) => {
    const settingsPanel = page.locator('#settingsPanel');

    // Ensure settings panel is expanded using navbar toggle
    if (await settingsPanel.evaluate(el => el.classList.contains('collapsed'))) {
      await page.locator('#navbarSettingsToggle').click();
    }

    const widthInput = page.locator('#gridWidth2');
    const widthDisplay = page.locator('#widthDisplay2');

    // Wait for input to be visible
    await widthInput.waitFor({ state: 'visible' });

    // Change width
    await widthInput.fill('10');
    await widthInput.press('Enter');

    // Verify display updated
    await expect(widthDisplay).toHaveText('10');
  });

  test('should change background color', async ({ page }) => {
    const colorPanel = page.locator('#colorPanel');

    // Ensure color panel is expanded using navbar toggle
    if (await colorPanel.evaluate(el => el.classList.contains('collapsed'))) {
      await page.locator('#navbarColorToggle').click();
    }

    const colorPicker = page.locator('#backgroundColor');
    const canvas = page.locator('#editCanvas');

    // Wait for color picker to be visible
    await colorPicker.waitFor({ state: 'visible' });

    // Change background color
    await colorPicker.fill('#ff0000');

    // Canvas should still be visible
    await expect(canvas).toBeVisible();
  });

  test('should change active pattern color', async ({ page }) => {
    const colorPanel = page.locator('#colorPanel');

    // Ensure color panel is expanded using navbar toggle
    if (await colorPanel.evaluate(el => el.classList.contains('collapsed'))) {
      await page.locator('#navbarColorToggle').click();
    }

    const colorPicker = page.locator('#activePatternColor');

    // Wait for color picker to be visible
    await colorPicker.waitFor({ state: 'visible' });

    // Change pattern color
    await colorPicker.fill('#00ff00');

    // Color picker should reflect new value
    await expect(colorPicker).toHaveValue('#00ff00');
  });

  test('should add new pattern color', async ({ page }) => {
    const colorPanel = page.locator('#colorPanel');

    // Ensure color panel is expanded using navbar toggle
    if (await colorPanel.evaluate(el => el.classList.contains('collapsed'))) {
      await page.locator('#navbarColorToggle').click();
    }

    // Click the add button (+ button)
    const addBtn = page.locator('.pattern-btn.unused');

    // Wait for add button to be visible
    await addBtn.first().waitFor({ state: 'visible' });

    // Check if add button exists (may not if at max colors)
    const count = await addBtn.count();
    if (count > 0) {
      await addBtn.click();

      // Verify a new pattern button was added
      const patternButtons = page.locator('.pattern-btn:not(.unused)');
      await expect(patternButtons).toHaveCount(2);
    }
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

  test('should invert colors', async ({ page }) => {
    const colorPanel = page.locator('#colorPanel');

    // Ensure color panel is expanded using navbar toggle
    if (await colorPanel.evaluate(el => el.classList.contains('collapsed'))) {
      await page.locator('#navbarColorToggle').click();
    }

    const invertBtn = page.locator('#invertBtn');
    const bgColorPicker = page.locator('#backgroundColor');
    const patternColorPicker = page.locator('#activePatternColor');

    // Wait for invert button to be visible
    await invertBtn.waitFor({ state: 'visible' });

    // Get initial colors
    const initialBg = await bgColorPicker.inputValue();
    const initialPattern = await patternColorPicker.inputValue();

    // Click invert
    await invertBtn.click();

    // Colors should be swapped
    await expect(bgColorPicker).toHaveValue(initialPattern);
    await expect(patternColorPicker).toHaveValue(initialBg);
  });

  test('should toggle color panel', async ({ page }) => {
    const panel = page.locator('#colorPanel');
    const toggle = page.locator('#navbarColorToggle');

    // Panel should start collapsed or expanded (depends on default)
    const initialState = await panel.evaluate(el => el.classList.contains('collapsed'));

    // Toggle panel
    await toggle.click();

    // State should change
    const newState = await panel.evaluate(el => el.classList.contains('collapsed'));
    expect(newState).toBe(!initialState);
  });

  test('should toggle settings panel', async ({ page }) => {
    const panel = page.locator('#settingsPanel');
    const toggle = page.locator('#navbarSettingsToggle');

    // Panel should start collapsed or expanded
    const initialState = await panel.evaluate(el => el.classList.contains('collapsed'));

    // Toggle panel
    await toggle.click();

    // State should change
    const newState = await panel.evaluate(el => el.classList.contains('collapsed'));
    expect(newState).toBe(!initialState);
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

    // Open the Import/Export dropdown menu in navbar
    await page.locator('#navbarImportExportBtn').click();

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click export JSON
    await page.locator('#navbarExportJsonBtn').click();

    // Wait for download
    const download = await downloadPromise;

    // Verify download occurred
    expect(download.suggestedFilename()).toMatch(/motif-.*\.json/);
  });
});
