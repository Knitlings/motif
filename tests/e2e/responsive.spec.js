import { test, expect } from '@playwright/test';

// Helper function to add a second pattern color
async function addSecondPatternColor(page) {
  const colorPanel = page.locator('#colorPanel');

  // Ensure color panel is expanded
  if (await colorPanel.evaluate(el => el.classList.contains('collapsed'))) {
    await page.locator('#navbarColorToggle').click();
  }

  // Click the add button (+ button)
  const addBtn = page.locator('.pattern-btn.unused').first();
  await addBtn.waitFor({ state: 'visible' });
  await addBtn.click();
}

test.describe('Desktop Layout (>768px)', () => {
  test.use({
    viewport: { width: 1280, height: 720 }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#editCanvas');
  });

  test('should show color preview circles when multiple colors exist', async ({ page }) => {
    const colorPreview = page.locator('#navbarColorPreview');

    // Initially should not be visible (only 1 color)
    await expect(colorPreview).not.toHaveClass(/visible/);

    // Add a second color
    await addSecondPatternColor(page);

    // Now should be visible with 2+ colors
    await expect(colorPreview).toHaveClass(/visible/);
    await expect(colorPreview).toBeVisible();
  });

  test('should show color panel as sidebar', async ({ page }) => {
    const colorPanel = page.locator('#colorPanel');

    // Open color panel
    await page.locator('#navbarColorToggle').click();

    // Panel should not have display: none
    await expect(colorPanel).not.toHaveCSS('display', 'none');

    // Panel should be positioned on the left
    await expect(colorPanel).toHaveCSS('left', '0px');

    // Panel should have specific width (not 100%)
    const width = await colorPanel.evaluate(el => {
      return window.getComputedStyle(el).width;
    });
    expect(width).not.toBe('100%');
  });

  test('should show settings panel as sidebar', async ({ page }) => {
    const settingsPanel = page.locator('#settingsPanel');

    // Open settings panel
    await page.locator('#navbarSettingsToggle').click();

    // Panel should not have display: none
    await expect(settingsPanel).not.toHaveCSS('display', 'none');

    // Panel should be positioned on the right
    await expect(settingsPanel).toHaveCSS('right', '0px');

    // Panel should have specific width (not 100%)
    const width = await settingsPanel.evaluate(el => {
      return window.getComputedStyle(el).width;
    });
    expect(width).not.toBe('100%');
  });

  test('should have navbar height of 64px', async ({ page }) => {
    const navbar = page.locator('.header-navbar');
    await expect(navbar).toHaveCSS('height', '64px');
  });

  test('should have smaller button sizes (36x36px)', async ({ page }) => {
    const colorToggle = page.locator('#navbarColorToggle');

    const box = await colorToggle.boundingBox();
    expect(box.width).toBe(36);
    expect(box.height).toBe(36);
  });
});

test.describe('Tablet Layout (768px)', () => {
  test.use({
    viewport: { width: 768, height: 1024 }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#editCanvas');
  });

  test('should hide color preview circles', async ({ page }) => {
    const colorPreview = page.locator('#navbarColorPreview');

    // Add a second color
    await addSecondPatternColor(page);

    // Color preview should be hidden on tablet
    await expect(colorPreview).toHaveCSS('display', 'none');
  });

  test('should show color panel as full-screen overlay', async ({ page }) => {
    const colorPanel = page.locator('#colorPanel');

    // Open color panel
    await page.locator('#navbarColorToggle').click();

    // Panel should be full-screen (check position properties)
    await expect(colorPanel).toHaveCSS('position', 'fixed');
    await expect(colorPanel).toHaveCSS('top', '0px');
    await expect(colorPanel).toHaveCSS('left', '0px');
    await expect(colorPanel).toHaveCSS('right', '0px');
  });

  test('should show close button in panels', async ({ page }) => {
    const colorPanel = page.locator('#colorPanel');
    const closeBtn = page.locator('#colorPanelClose');

    // Open color panel
    await page.locator('#navbarColorToggle').click();

    // Close button should be visible on tablet
    await expect(closeBtn).toBeVisible();

    // Should be able to close with button
    await closeBtn.click();
    await expect(colorPanel).toHaveClass(/collapsed/);
  });

  test('should have navbar height of 56px', async ({ page }) => {
    const navbar = page.locator('.header-navbar');
    await expect(navbar).toHaveCSS('height', '56px');
  });

  test('should have larger touch target buttons (44x44px)', async ({ page }) => {
    const colorToggle = page.locator('#navbarColorToggle');

    const box = await colorToggle.boundingBox();
    expect(box.width).toBe(44);
    expect(box.height).toBe(44);
  });
});

test.describe('Mobile Layout (375px)', () => {
  test.use({
    viewport: { width: 375, height: 667 }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#editCanvas');
  });

  test('should hide color preview circles', async ({ page }) => {
    const colorPreview = page.locator('#navbarColorPreview');

    // Add a second color
    await addSecondPatternColor(page);

    // Color preview should be hidden on mobile
    await expect(colorPreview).toHaveCSS('display', 'none');
  });

  test('should show color panel as full-screen overlay', async ({ page }) => {
    const colorPanel = page.locator('#colorPanel');

    // Open color panel
    await page.locator('#navbarColorToggle').click();

    // Panel should be full-screen (check position properties)
    await expect(colorPanel).toHaveCSS('position', 'fixed');
    await expect(colorPanel).toHaveCSS('top', '0px');
    await expect(colorPanel).toHaveCSS('left', '0px');
    await expect(colorPanel).toHaveCSS('right', '0px');
  });

  test('should show settings panel as full-screen overlay', async ({ page }) => {
    const settingsPanel = page.locator('#settingsPanel');

    // Open settings panel
    await page.locator('#navbarSettingsToggle').click();

    // Panel should be full-screen (check position properties)
    await expect(settingsPanel).toHaveCSS('position', 'fixed');
    await expect(settingsPanel).toHaveCSS('top', '0px');
    await expect(settingsPanel).toHaveCSS('left', '0px');
    await expect(settingsPanel).toHaveCSS('right', '0px');
  });

  test('should have navbar height of 56px', async ({ page }) => {
    const navbar = page.locator('.header-navbar');
    await expect(navbar).toHaveCSS('height', '56px');
  });

  test('should have larger touch target buttons (44x44px)', async ({ page }) => {
    const colorToggle = page.locator('#navbarColorToggle');

    const box = await colorToggle.boundingBox();
    expect(box.width).toBe(44);
    expect(box.height).toBe(44);
  });

  test('should show close button in color panel', async ({ page }) => {
    const closeBtn = page.locator('#colorPanelClose');

    // Open color panel
    await page.locator('#navbarColorToggle').click();

    // Close button should be visible on mobile
    await expect(closeBtn).toBeVisible();
  });

  test('should show close button in settings panel', async ({ page }) => {
    const closeBtn = page.locator('#settingsPanelClose');

    // Open settings panel
    await page.locator('#navbarSettingsToggle').click();

    // Close button should be visible on mobile
    await expect(closeBtn).toBeVisible();
  });

  test('should have working grid resize handles', async ({ page }) => {
    // Grid resize handles should be visible and larger on mobile
    const resizeHandle = page.locator('.resize-handle').first();

    if (await resizeHandle.count() > 0) {
      await expect(resizeHandle).toBeVisible();

      // Handle should be at least 20px wide on mobile (vs 8px desktop)
      const width = await resizeHandle.evaluate(el => {
        return window.getComputedStyle(el).width;
      });
      expect(parseInt(width)).toBeGreaterThanOrEqual(20);
    }
  });
});

test.describe('Small Mobile Layout (360px)', () => {
  test.use({
    viewport: { width: 360, height: 640 }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#editCanvas');
  });

  test('should hide color preview circles', async ({ page }) => {
    const colorPreview = page.locator('#navbarColorPreview');

    // Add a second color
    await addSecondPatternColor(page);

    // Color preview should be hidden on small mobile
    await expect(colorPreview).toHaveCSS('display', 'none');
  });

  test('should have slightly smaller buttons (40x40px)', async ({ page }) => {
    const colorToggle = page.locator('#navbarColorToggle');

    const box = await colorToggle.boundingBox();
    expect(box.width).toBe(40);
    expect(box.height).toBe(40);
  });

  test('should show panels as full-screen overlay', async ({ page }) => {
    const colorPanel = page.locator('#colorPanel');

    // Open color panel
    await page.locator('#navbarColorToggle').click();

    // Panel should be full-screen even on small devices (check position properties)
    await expect(colorPanel).toHaveCSS('position', 'fixed');
    await expect(colorPanel).toHaveCSS('top', '0px');
    await expect(colorPanel).toHaveCSS('left', '0px');
    await expect(colorPanel).toHaveCSS('right', '0px');
  });

  test('should have navbar height of 56px', async ({ page }) => {
    const navbar = page.locator('.header-navbar');
    await expect(navbar).toHaveCSS('height', '56px');
  });

  test('should show smaller navbar title', async ({ page }) => {
    const title = page.locator('.navbar-title');

    // Title should have reduced font size on very small screens
    const fontSize = await title.evaluate(el => {
      return window.getComputedStyle(el).fontSize;
    });
    expect(parseInt(fontSize)).toBeLessThanOrEqual(20);
  });
});

test.describe('Cross-viewport Consistency', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#editCanvas');
  });

  test('should paint cells consistently across viewports', async ({ page }) => {
    const canvas = page.locator('#editCanvas');

    // Paint a cell
    await canvas.click({ position: { x: 50, y: 50 } });

    // Canvas should be painted regardless of viewport
    // (This is more of a sanity check that basic functionality works)
    const undoBtn = page.locator('#undoBtn');
    await expect(undoBtn).not.toBeDisabled();
  });

  test('should save and load state consistently', async ({ page }) => {
    const canvas = page.locator('#editCanvas');

    // Paint something
    await canvas.click({ position: { x: 50, y: 50 } });

    // State should auto-save (localStorage)
    // Reload page
    await page.reload();
    await page.waitForSelector('#editCanvas');

    // Undo button should still be enabled (painted state persisted)
    const undoBtn = page.locator('#undoBtn');
    await expect(undoBtn).not.toBeDisabled();
  });
});
