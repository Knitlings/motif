import { test, expect } from '@playwright/test';

// Helper function to add a second pattern color
async function addSecondPatternColor(page) {
  // Click the add button (+ button) in the navbar
  const addBtn = page.locator('.navbar-color-btn.add-btn').first();
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

  test('should show color buttons in navbar center', async ({ page }) => {
    const navbarCenter = page.locator('.navbar-center');
    const colorButtons = page.locator('.navbar-color-buttons');

    // Navbar center should be visible
    await expect(navbarCenter).toBeVisible();
    await expect(colorButtons).toBeVisible();

    // Should have at least one color button initially
    const colorBtnCount = await page.locator('.navbar-color-btn:not(.add-btn)').count();
    expect(colorBtnCount).toBeGreaterThanOrEqual(1);

    // Add a second color
    await addSecondPatternColor(page);

    // Now should have 2 color buttons
    const newColorBtnCount = await page.locator('.navbar-color-btn:not(.add-btn)').count();
    expect(newColorBtnCount).toBe(2);
  });

  test('should show palette dropdown in navbar', async ({ page }) => {
    const paletteDropdown = page.locator('.navbar-palette-dropdown-container');
    const paletteBtn = page.locator('#navbarPaletteDropdownBtn');

    // Palette dropdown should be visible
    await expect(paletteDropdown).toBeVisible();
    await expect(paletteBtn).toBeVisible();

    // Click to open dropdown
    await paletteBtn.click();

    // Dropdown menu should be visible
    const paletteMenu = page.locator('.navbar-palette-dropdown-menu');
    await expect(paletteMenu).toBeVisible();
  });

  test('should show hamburger menu in navbar', async ({ page }) => {
    const hamburgerBtn = page.locator('#navbarHamburgerBtn');
    const hamburgerMenu = page.locator('#navbarHamburgerMenu');

    // Hamburger button should be visible
    await expect(hamburgerBtn).toBeVisible();

    // Click to open menu
    await hamburgerBtn.click();

    // Menu should be visible
    await expect(hamburgerMenu).toHaveClass(/open/);
    await expect(hamburgerMenu).toBeVisible();
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

  test('should show color buttons in navbar center', async ({ page }) => {
    const navbarCenter = page.locator('.navbar-center');
    const colorButtons = page.locator('.navbar-color-buttons');

    // Navbar center should be visible on tablet
    await expect(navbarCenter).toBeVisible();
    await expect(colorButtons).toBeVisible();

    // Color buttons should be visible
    const colorBtn = page.locator('.navbar-color-btn').first();
    await expect(colorBtn).toBeVisible();
  });

  test('should have smaller color buttons (32x32px)', async ({ page }) => {
    const colorBtn = page.locator('.navbar-color-btn').first();

    const box = await colorBtn.boundingBox();
    expect(box.width).toBe(32);
    expect(box.height).toBe(32);
  });

  test('should show palette dropdown', async ({ page }) => {
    const paletteBtn = page.locator('#navbarPaletteDropdownBtn');

    // Palette dropdown button should be visible
    await expect(paletteBtn).toBeVisible();

    const box = await paletteBtn.boundingBox();
    expect(box.width).toBe(32);
    expect(box.height).toBe(32);
  });

  test('should have navbar height of 56px', async ({ page }) => {
    const navbar = page.locator('.header-navbar');
    await expect(navbar).toHaveCSS('height', '56px');
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

  test('should show color buttons in navbar center', async ({ page }) => {
    const navbarCenter = page.locator('.navbar-center');
    const colorButtons = page.locator('.navbar-color-buttons');

    // Navbar center should be visible on mobile
    await expect(navbarCenter).toBeVisible();
    await expect(colorButtons).toBeVisible();

    // Color buttons should be visible
    const colorBtn = page.locator('.navbar-color-btn').first();
    await expect(colorBtn).toBeVisible();
  });

  test('should have even smaller color buttons (28x28px)', async ({ page }) => {
    const colorBtn = page.locator('.navbar-color-btn').first();

    const box = await colorBtn.boundingBox();
    expect(box.width).toBe(28);
    expect(box.height).toBe(28);
  });

  test('should show palette dropdown', async ({ page }) => {
    const paletteBtn = page.locator('#navbarPaletteDropdownBtn');

    // Palette dropdown button should be visible
    await expect(paletteBtn).toBeVisible();

    const box = await paletteBtn.boundingBox();
    expect(box.width).toBe(28);
    expect(box.height).toBe(28);
  });

  test('should have navbar height of 56px', async ({ page }) => {
    const navbar = page.locator('.header-navbar');
    await expect(navbar).toHaveCSS('height', '56px');
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

  test('should show color buttons in navbar center', async ({ page }) => {
    const navbarCenter = page.locator('.navbar-center');
    const colorButtons = page.locator('.navbar-color-buttons');

    // Navbar center should be visible on small mobile
    await expect(navbarCenter).toBeVisible();
    await expect(colorButtons).toBeVisible();
  });

  test('should have smallest color buttons (26x26px)', async ({ page }) => {
    const colorBtn = page.locator('.navbar-color-btn').first();

    const box = await colorBtn.boundingBox();
    expect(box.width).toBe(26);
    expect(box.height).toBe(26);
  });

  test('should show palette dropdown', async ({ page }) => {
    const paletteBtn = page.locator('#navbarPaletteDropdownBtn');

    // Palette dropdown button should be visible
    await expect(paletteBtn).toBeVisible();

    const box = await paletteBtn.boundingBox();
    expect(box.width).toBe(26);
    expect(box.height).toBe(26);
  });

  test('should have 3-column palette grid in dropdown', async ({ page }) => {
    const paletteBtn = page.locator('#navbarPaletteDropdownBtn');

    // Open dropdown
    await paletteBtn.click();

    const paletteGrid = page.locator('.navbar-palette-grid');

    // Check grid has 3 columns on very small screens
    const gridColumns = await paletteGrid.evaluate(el => {
      return window.getComputedStyle(el).gridTemplateColumns;
    });

    // Should have 3 equal columns
    expect(gridColumns.split(' ').length).toBe(3);
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
