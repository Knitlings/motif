import { test, expect } from '@playwright/test';

async function openPicker(page) {
  await page.locator('#downloadBtn').click();
  await expect(page.locator('#downloadModal')).toBeVisible();
  await page.locator('label:has(input[name="source"][value="pattern-with-context"])').click({ force: true });
  await page.locator('#downloadModalSubmitBtn').click();
  await expect(page.locator('#pickerCaptionLine')).toBeVisible();
}

async function frameBox(page) {
  return page.locator('#pickerFrame').boundingBox();
}

test.describe('Choosing surrounding stitches', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#editCanvas');
  });

  test('replaces the preview caption and frames the centre repeat', async ({ page }) => {
    await openPicker(page);
    await expect(page.locator('#previewCaptionLine')).toBeHidden();
    await expect(page.locator('#pickerFrame')).toBeVisible();
    await expect(page.locator('#pickLeft')).toBeFocused();
    for (const id of ['#pickLeft', '#pickRight', '#pickTop', '#pickBottom']) {
      await expect(page.locator(id)).toHaveValue('0');
    }
    await expect(page.locator('#pickerFrame .edge-grip')).toHaveCount(4);
  });

  test('numbers in the caption move the frame, up to one short of a repeat', async ({ page }) => {
    await openPicker(page);
    const before = await frameBox(page);

    await page.locator('#pickLeft').fill('2');
    await page.locator('#pickLeft').press('Enter');
    const after = await frameBox(page);
    expect(after.x).toBeLessThan(before.x);
    expect(after.width).toBeGreaterThan(before.width);

    // The default chart is 5 stitches wide: at most 4 around it
    await page.locator('#pickRight').fill('9');
    await page.locator('#pickRight').press('Enter');
    await expect(page.locator('#pickRight')).toHaveValue('4');
  });

  test('arrow keys on a grip add or remove one at a time', async ({ page }) => {
    await openPicker(page);
    const top = page.locator('#pickerFrame .edge-grip-top');
    await top.focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#pickTop')).toHaveValue('1');
  });

  test('dragging a grip outward adds surrounding stitches', async ({ page }) => {
    await openPicker(page);
    const grip = await page.locator('#pickerFrame .edge-grip-right').boundingBox();
    const canvas = await page.locator('#previewCanvas').boundingBox();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width - 2, grip.y + grip.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect(page.locator('#pickRight')).toHaveValue('4');
  });

  test('Escape in a field cancels and returns focus to Download', async ({ page }) => {
    await openPicker(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#pickerCaptionLine')).toBeHidden();
    await expect(page.locator('#pickerFrame')).toBeHidden();
    await expect(page.locator('#previewCaptionLine')).toBeVisible();
    await expect(page.locator('#downloadBtn')).toBeFocused();
  });

  test('downloads the chosen surroundings', async ({ page }) => {
    await openPicker(page);
    await page.locator('#pickBottom').fill('3');
    await page.locator('#pickBottom').press('Enter');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#visualSelectionDownloadBtn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/motif-pattern-surroundings-5x5\.png/);
    await expect(page.locator('#pickerCaptionLine')).toBeHidden();
  });
});
