import { test, expect } from '@playwright/test';

test.describe('UI Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#editCanvas');
  });

  test('should change grid dimensions', async ({ page }) => {
    // Grid dimensions are number fields in the chart's caption
    const widthDisplay = page.locator('#gridWidthDisplay');

    // Wait for display to be visible
    await widthDisplay.waitFor({ state: 'visible' });

    // Change width by typing in the caption
    await widthDisplay.click();
    await widthDisplay.fill('10');
    await widthDisplay.press('Enter');

    // Verify display updated
    await expect(widthDisplay).toHaveValue('10');
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

  test('should resize from an edge grip with the arrow keys', async ({ page }) => {
    const widthDisplay = page.locator('#gridWidthDisplay');
    const heightDisplay = page.locator('#gridHeightDisplay');
    const initialWidth = parseInt(await widthDisplay.inputValue());
    const initialHeight = parseInt(await heightDisplay.inputValue());

    // Outward adds a stitch at that edge, inward removes one
    const rightGrip = page.getByRole('button', { name: 'Add or remove stitches on the right' });
    await rightGrip.focus();
    await page.keyboard.press('ArrowRight');
    await expect(widthDisplay).toHaveValue(String(initialWidth + 1));
    await page.keyboard.press('ArrowLeft');
    await expect(widthDisplay).toHaveValue(String(initialWidth));

    const topGrip = page.getByRole('button', { name: 'Add or remove rows at the top' });
    await topGrip.focus();
    await page.keyboard.press('ArrowUp');
    await expect(heightDisplay).toHaveValue(String(initialHeight + 1));
  });

  test('should describe the whole preview in its caption', async ({ page }) => {
    await page.locator('#gridWidthDisplay').fill('8');
    await page.locator('#gridWidthDisplay').press('Enter');
    await page.locator('#previewRepeatXDisplay').fill('2');
    await page.locator('#previewRepeatXDisplay').press('Enter');

    // 8 stitches x 2 repeats across, 5 rows x 3 repeats up (the phone's short caption leaves these out)
    await expect(page.locator('#previewTotal')).toHaveText(', 16 stitches by 15 rows in all.');
    await expect(page.locator('#previewOutlineNote')).not.toHaveAttribute('hidden');

    await page.locator('#previewRepeatXDisplay').fill('1');
    await page.locator('#previewRepeatXDisplay').press('Enter');
    await page.locator('#previewRepeatYDisplay').fill('1');
    await page.locator('#previewRepeatYDisplay').press('Enter');
    await expect(page.locator('#previewOutlineNote')).toHaveAttribute('hidden');
  });

  test('should change preview repeat dimensions', async ({ page }) => {
    const repeatXDisplay = page.locator('#previewRepeatXDisplay');

    // Wait for display to be visible
    await repeatXDisplay.waitFor({ state: 'visible' });

    // Change preview repeat by typing in the caption
    await repeatXDisplay.click();
    await repeatXDisplay.fill('5');
    await repeatXDisplay.press('Enter');

    // Verify display updated
    await expect(repeatXDisplay).toHaveValue('5');
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
    const visualControls = page.locator('#pickerCaptionLine');
    await expect(visualControls).toBeVisible();

    // Preview should show 3x3
    const repeatXDisplay = page.locator('#previewRepeatXDisplay');
    await expect(repeatXDisplay).toHaveValue('3');
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
    const visualControls = page.locator('#pickerCaptionLine');
    await expect(visualControls).toBeVisible();

    // Click cancel
    await page.locator('#visualSelectionCancelBtn').click();

    // Visual controls should disappear
    await expect(visualControls).not.toBeVisible();

    // Preview should restore original repeat (default 3x3)
    const repeatXDisplay = page.locator('#previewRepeatXDisplay');
    await expect(repeatXDisplay).toHaveValue('3');
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
    const visualControls = page.locator('#pickerCaptionLine');
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
