import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'Desktop (1280px)', viewport: { width: 1280, height: 720 }, topBar: '64px' },
  { name: 'Tablet (768px)', viewport: { width: 768, height: 1024 }, topBar: '56px' },
  { name: 'Mobile (390px)', viewport: { width: 390, height: 844 }, topBar: '56px' },
  { name: 'Small mobile (360px)', viewport: { width: 360, height: 640 }, topBar: '56px' },
];

for (const { name, viewport, topBar } of VIEWPORTS) {
  test.describe(`${name} layout`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#editCanvas');
    });

    test('shows the key under the chart', async ({ page }) => {
      const key = page.locator('#key');
      await expect(key).toBeVisible();
      await expect(page.getByRole('button', { name: /^Colour 1,/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add colour' })).toBeVisible();
      await expect(page.getByLabel(/^Background colour/)).toBeVisible();

      // The key sits below the chart
      const chartBox = await page.locator('#editCanvas').boundingBox();
      const keyBox = await key.boundingBox();
      expect(keyBox.y).toBeGreaterThan(chartBox.y + chartBox.height);
    });

    test('adds a colour to the key', async ({ page }) => {
      await page.getByRole('button', { name: 'Add colour' }).click();
      await expect(page.getByRole('button', { name: /^Colour 2,/ })).toHaveAttribute('aria-pressed', 'true');
    });

    test('opens the palette list', async ({ page }) => {
      await page.getByRole('button', { name: /^Palette:/ }).click();
      await expect(page.getByRole('listbox', { name: 'Palette' })).toBeVisible();
    });

    test('opens the menu', async ({ page }) => {
      const hamburgerMenu = page.locator('#navbarHamburgerMenu');
      await page.locator('#navbarHamburgerBtn').click();
      await expect(hamburgerMenu).toHaveClass(/open/);
      await expect(hamburgerMenu).toBeVisible();
    });

    test(`has a top bar ${topBar} tall`, async ({ page }) => {
      await expect(page.locator('.editor-top-bar')).toHaveCSS('height', topBar);
    });

    test('keeps the page within the window width', async ({ page }) => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}

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
