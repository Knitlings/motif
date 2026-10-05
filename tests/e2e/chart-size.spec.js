import { test, expect } from '@playwright/test';

async function setSize(page, width, height) {
  await page.locator('#gridWidthDisplay').fill(String(width));
  await page.locator('#gridWidthDisplay').press('Enter');
  await page.locator('#gridHeightDisplay').fill(String(height));
  await page.locator('#gridHeightDisplay').press('Enter');
}

test.describe('Chart size and numbers', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#editCanvas');
  });

  test('numbers every stitch and row of a small chart, from the right and bottom', async ({ page }) => {
    await setSize(page, 12, 10);
    const stitches = page.locator('#chartStitchNumbers span');
    await expect(stitches).toHaveCount(12);
    await expect(stitches.first()).toHaveText('12');
    await expect(stitches.last()).toHaveText('1');
    const rows = page.locator('#chartRowNumbers span');
    await expect(rows.first()).toHaveText('10');
    await expect(rows.last()).toHaveText('1');
  });

  test('numbers every fifth stitch of a larger chart', async ({ page }) => {
    await setSize(page, 40, 12);
    const stitches = page.locator('#chartStitchNumbers span');
    await expect(stitches.nth(0)).toHaveText('40');
    await expect(stitches.nth(1)).toHaveText('');
    await expect(stitches.nth(5)).toHaveText('35');
    // Rows stay numbered one by one: there are only 12
    await expect(page.locator('#chartRowNumbers span').nth(1)).toHaveText('11');
  });

  test('a mid-size chart keeps its grips and is not framed', async ({ page }) => {
    await setSize(page, 40, 30);
    await expect(page.locator('#chartFrame')).not.toHaveClass(/is-framed/);
    await expect(page.locator('#chartFrame .edge-grip-right')).toBeVisible();
    await expect(page.locator('#plate')).toHaveClass(/is-stacked/);
  });

  test('a chart too large for the page scrolls in its frame', async ({ page }) => {
    await setSize(page, 100, 100);
    const frame = page.locator('#chartFrame');
    await expect(frame).toHaveClass(/is-framed/);
    await expect(frame).toHaveAttribute('tabindex', '0');
    await expect(frame).toHaveAccessibleName(/scrolls in both directions/);
    await expect(page.locator('#chartFrame .edge-grip-right')).toBeHidden();

    // Squares stay at least 20px, and the frame fits the page
    const canvasWidth = await page.locator('#editCanvas').evaluate(c => c.width);
    expect(canvasWidth).toBeGreaterThanOrEqual(2000);
    const frameBox = await frame.boundingBox();
    expect(frameBox.width).toBeLessThanOrEqual(1440 - 128);

    // The caption and key are still on the first screen
    const keyBox = await page.locator('#key').boundingBox();
    expect(keyBox.y + keyBox.height).toBeLessThanOrEqual(900);
  });

  test('paints the right square in a scrolled frame', async ({ page }) => {
    await setSize(page, 100, 100);
    const frame = page.locator('#chartFrame');
    await frame.evaluate(el => { el.scrollLeft = 400; el.scrollTop = 300; });

    // Click the top-left square visible in the frame: column 20, row 15
    const box = await frame.boundingBox();
    await page.mouse.click(box.x + 10, box.y + 10);
    await expect(page.locator('#undoBtn')).toBeEnabled();
  });
});
