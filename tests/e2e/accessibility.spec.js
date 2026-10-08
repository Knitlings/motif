import { test, expect } from '@playwright/test';

// Keyboard and focus behaviour from the accessibility pass. Keyboard-only paths, so
// desktop projects only.
test.skip(({ isMobile }) => isMobile, 'Keyboard paths');

const swatch = (page, number) => page.getByRole('button', { name: new RegExp(`^Colour ${number},`) }).first();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#editCanvas');
});

test('the page has one level-one heading', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Motif');
});

test('the skip link moves focus to the chart', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to pattern' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#chartHeading')).toBeFocused();
});

test('the chart is named with its size', async ({ page }) => {
  await expect(page.locator('#editCanvas')).toHaveAccessibleName(/^Pattern chart, \d+ stitches by \d+ rows$/);
});

test.describe('Removing a colour', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole('button', { name: 'Add colour' }).click();
    await page.getByRole('button', { name: 'Add colour' }).click();
    await swatch(page, 2).click();
    await swatch(page, 2).click();
    await page.getByRole('group', { name: 'Colour 2', exact: true }).getByRole('button', { name: 'Remove' }).click();
  });

  test('cancelling returns focus to the swatch', async ({ page }) => {
    await page.getByRole('dialog', { name: 'Remove colour?' }).getByRole('button', { name: 'Cancel' }).click();
    await expect(swatch(page, 2)).toBeFocused();
  });

  test('removing moves focus to the swatch that took its place', async ({ page }) => {
    await page.getByRole('dialog', { name: 'Remove colour?' }).getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByRole('button', { name: /^Colour 3,/ })).toHaveCount(0);
    await expect(swatch(page, 2)).toBeFocused();
  });
});

test('a row of colours is one tab stop, walked with the arrow keys', async ({ page }) => {
  await page.getByRole('button', { name: 'Add colour' }).click();
  await swatch(page, 1).click();
  await expect(swatch(page, 2)).toHaveAttribute('tabindex', '-1');

  await page.keyboard.press('ArrowRight');
  await expect(swatch(page, 2)).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('button', { name: 'Add colour' })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(swatch(page, 1)).toBeFocused();

  // Tab leaves the row for the background
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /^Background colour/ }).or(page.getByLabel(/^Background colour/))).toBeFocused();
});

test('tabbing out of the swatch menu closes it', async ({ page }) => {
  // Colour 1 starts selected, so one click opens its menu
  await swatch(page, 1).click();
  const menu = page.getByRole('group', { name: 'Colour 1', exact: true });
  await expect(menu).toBeVisible();
  // Colour 1 has no Remove: its menu holds only the colour well
  await page.keyboard.press('Tab');
  await expect(menu).toBeHidden();
});

test('clicking another colour while the swatch menu is open selects it', async ({ page }) => {
  await page.getByRole('button', { name: 'Add colour' }).click();
  await swatch(page, 1).click();
  await swatch(page, 1).click();
  await expect(page.getByRole('group', { name: 'Colour 1', exact: true })).toBeVisible();
  await page.getByRole('group', { name: 'Colour 1', exact: true }).getByLabel('Change colour 1').focus();
  await swatch(page, 2).click();
  await expect(swatch(page, 2)).toHaveAttribute('aria-pressed', 'true');
});

test('Tab goes from "+N" into its panel and Shift+Tab comes back', async ({ page }) => {
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Add colour' }).click();
  await swatch(page, 1).click();
  const more = page.getByRole('button', { name: /more colours/ });
  await more.click();
  const panel = page.getByRole('group', { name: 'More colours' });
  await more.focus();
  await page.keyboard.press('Tab');
  await expect(panel.getByRole('button').first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(more).toBeFocused();
  await expect(panel).toBeVisible();
});

test('dismissing a note returns focus to where it came from', async ({ page }) => {
  await page.locator('#navbarImportJsonInput').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not a pattern')
  });
  const dismiss = page.locator('#noteSlot').getByRole('button', { name: 'Dismiss' });
  await page.getByRole('button', { name: 'Menu' }).focus();
  await dismiss.focus();
  await page.keyboard.press('Enter');
  await expect(dismiss).toBeHidden();
  await expect(page.getByRole('button', { name: 'Menu' })).toBeFocused();
});
