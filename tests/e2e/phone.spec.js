import { test, expect } from '@playwright/test';

// The phone layout on a 390 × 844 touch screen (see the design system's Motif layout, "On a phone")
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

async function setSize(page, width, height) {
  await page.locator('#gridWidthDisplay').fill(String(width));
  await page.locator('#gridWidthDisplay').press('Enter');
  await page.locator('#gridHeightDisplay').fill(String(height));
  await page.locator('#gridHeightDisplay').press('Enter');
}

/** The colour of a square on the chart, read from the canvas */
async function squareColour(page, x, y) {
  return page.locator('#editCanvas').evaluate((canvas, [px, py]) => {
    const [r, g, b] = canvas.getContext('2d').getImageData(px, py, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  }, [x, y]);
}

test.describe('Phone', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Touch emulation is Chromium-only here');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#key .key-swatch');
  });

  test('shortens the captions and gives their fields 44px', async ({ page }) => {
    await expect(page.locator('.caption-line-chart .caption-long').first()).toBeHidden();
    await expect(page.locator('#previewTotal')).toBeHidden();
    await expect(page.locator('#gridWidthDisplay')).toHaveCSS('height', '44px');
    await expect(page.locator('#key .key-swatch').first()).toHaveCSS('width', '44px');
    await expect(page.locator('#undoBtn')).toHaveCSS('width', '44px');

    // Caption and icons share one line
    const field = await page.locator('#gridWidthDisplay').boundingBox();
    const clear = await page.locator('#clearBtn').boundingBox();
    expect(Math.abs(field.y - clear.y)).toBeLessThan(2);
  });

  test('lets the top bar scroll away', async ({ page }) => {
    await page.mouse.wheel(0, 400);
    await expect.poll(async () => (await page.locator('.editor-top-bar').boundingBox()).y).toBeLessThan(0);
  });

  test('paints the square that is tapped, and a second tap erases it', async ({ page }) => {
    const before = await squareColour(page, 20, 20);
    await page.locator('#editCanvas').tap({ position: { x: 20, y: 20 } });
    await expect.poll(() => squareColour(page, 20, 20)).not.toBe(before);
    await expect(page.locator('#undoBtn')).toBeEnabled();

    await page.locator('#editCanvas').tap({ position: { x: 20, y: 20 } });
    await expect.poll(() => squareColour(page, 20, 20)).toBe(before);
  });

  test('frames a chart too large for the phone, as wide as the page and as tall as the first screen allows', async ({ page }) => {
    await setSize(page, 100, 100);
    const frame = page.locator('#chartFrame');
    await expect(frame).toHaveClass(/is-framed/);
    const box = await frame.boundingBox();
    expect(box.width).toBe(358);
    expect(box.height).toBe(442);
    await expect(page.locator('#chartFrame .edge-grip').first()).toBeHidden();

    // The caption, key and hint (or the note in its place: the preview is cut to 1 × 1) still fit on the first screen
    const hint = await page.locator('#keyHint:visible, #noteSlotPhone:visible').boundingBox();
    expect(hint.y + hint.height).toBeLessThanOrEqual(844);
  });

  test('keeps a chart of 16 stitches unframed', async ({ page }) => {
    await setSize(page, 16, 16);
    await expect(page.locator('#chartFrame')).not.toHaveClass(/is-framed/);
  });

  test('shows the colours beyond the row in a second row beneath', async ({ page }) => {
    for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Add colour' }).click();
    const row = page.locator('#key .key-swatches');
    // Four colours, "+N" and add
    await expect(row.locator('.key-swatch')).toHaveCount(4);
    const more = page.getByRole('button', { name: '3 more colours' });
    await more.click();

    const second = page.getByRole('group', { name: 'More colours' });
    await expect(second).toHaveClass('key-more-row');
    const rowBox = await row.boundingBox();
    const secondBox = await second.boundingBox();
    expect(secondBox.y).toBeGreaterThanOrEqual(rowBox.y + rowBox.height - 1);

    await second.locator('.key-swatch').first().click();
    await expect(second).toBeHidden();
  });

  test('opens the palette as a section in the key', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Palette: Motif' });
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const section = page.locator('#keyPaletteSection');
    await expect(section.getByRole('button', { name: 'Make colour 1 #000000' })).toHaveCSS('height', '44px');

    // Giving a colour or choosing a palette leaves it open
    await section.getByRole('button', { name: 'Make colour 1 #000000' }).click();
    await section.getByRole('option', { name: /Warm/ }).click();
    await expect(page.getByRole('button', { name: 'Palette: Warm' })).toHaveAttribute('aria-expanded', 'true');

    // A custom colour's menu is a row under the strip
    await section.getByRole('option', { name: /Custom/ }).click();
    await section.locator('.key-chip').first().click();
    await expect(section.getByRole('group', { name: 'Custom palette colour 1' })).toHaveClass('key-chip-row');

    // Loading closes it
    await section.getByRole('button', { name: 'Load palette' }).click();
    await expect(section).toBeHidden();
  });

  test('closes the palette section with Escape', async ({ page }) => {
    await page.getByRole('button', { name: 'Palette: Motif' }).click();
    await page.locator('#keyPaletteSection .key-chip').first().focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#keyPaletteSection')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Palette: Motif' })).toBeFocused();
  });

  test('puts the surroundings picker\'s numbers on a line of their own', async ({ page }) => {
    await page.locator('#downloadBtn').click();
    await page.locator('input[name="source"][value="pattern-with-context"]').check();
    await page.locator('#downloadModalSubmitBtn').click();

    const caption = page.locator('#pickerCaptionLine');
    await expect(caption).toBeVisible();
    const title = await caption.locator('.picker-title').boundingBox();
    const download = await caption.getByRole('button', { name: 'Download' }).boundingBox();
    const left = await caption.getByLabel('Left').boundingBox();
    const bottom = await caption.getByLabel('Bottom').boundingBox();
    expect(Math.abs((title.y + title.height / 2) - (download.y + download.height / 2))).toBeLessThan(4);
    expect(left.y).toBeGreaterThan(title.y + title.height);
    expect(Math.abs(left.y - bottom.y)).toBeLessThan(2);
    await expect(caption.locator('.caption-long').first()).toBeHidden();
  });
});
