import { test, expect } from '@playwright/test';

async function setSize(page, width, height) {
  await page.locator('#gridWidthDisplay').fill(String(width));
  await page.locator('#gridWidthDisplay').press('Enter');
  await page.locator('#gridHeightDisplay').fill(String(height));
  await page.locator('#gridHeightDisplay').press('Enter');
}

async function squareColour(page, x, y) {
  return page.locator('#editCanvas').evaluate((canvas, [px, py]) => {
    const [r, g, b] = canvas.getContext('2d').getImageData(px, py, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  }, [x, y]);
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

  test('a mid-size chart keeps its grips and fits the window', async ({ page }) => {
    await setSize(page, 40, 30);
    expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('#chartFrame .edge-grip-right')).toBeVisible();
    await expect(page.locator('#plate')).toHaveClass(/is-stacked/);
  });

  test('a chart too large for the window keeps its grips and scrolls the page', async ({ page }) => {
    await setSize(page, 100, 100);
    // Squares stay at least 20px, and the page widens to hold the chart and its grips
    const canvasWidth = await page.locator('#editCanvas').evaluate(c => c.width);
    expect(canvasWidth).toBeGreaterThanOrEqual(2000);
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeGreaterThan(canvasWidth);

    const grip = page.locator('#chartFrame .edge-grip-right');
    await grip.scrollIntoViewIfNeeded();
    await expect(grip).toBeInViewport();
    const left = page.locator('#chartFrame .edge-grip-left');
    await left.scrollIntoViewIfNeeded();
    await expect(left).toBeInViewport();
  });

  test('keeps the caption, key and preview in the window beside a wide chart', async ({ page }) => {
    await setSize(page, 100, 100);
    for (const selector of ['.caption-line-chart .caption-actions', '#key', '#previewCanvas']) {
      const box = await page.locator(selector).boundingBox();
      expect(box.x, selector).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, selector).toBeLessThanOrEqual(1440);
    }
  });

  test('stacks a chart too tall for the window', async ({ page }) => {
    await setSize(page, 20, 200);
    await expect(page.locator('#plate')).toHaveClass(/is-stacked/);
  });

  test('paints the right square on a scrolled page', async ({ page }) => {
    await setSize(page, 100, 100);
    await page.evaluate(() => { document.body.scrollLeft = 400; document.body.scrollTop = 300; });
    // The square at 410, 310 on the canvas: column 21, row 16
    const before = await squareColour(page, 410, 310);
    const box = await page.locator('#editCanvas').boundingBox();
    await page.mouse.click(box.x + 410, box.y + 310);
    await expect.poll(() => squareColour(page, 410, 310)).not.toBe(before);
    expect(await squareColour(page, 390, 310)).toBe(before);
  });
});
