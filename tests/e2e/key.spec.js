import { test, expect } from '@playwright/test';

const swatch = (page, number) => page.getByRole('button', { name: new RegExp(`^Colour ${number},`) }).first();

async function addColours(page, count) {
  for (let i = 0; i < count; i++) {
    await page.getByRole('button', { name: 'Add colour' }).click();
  }
}

async function setColourInput(locator, hex) {
  await locator.evaluate((el, value) => {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, hex);
}

// The phone layout (CONFIG.PHONE_BREAKPOINT): the palette's colours are in a section opened from its row
const isPhone = (page) => page.viewportSize().width <= 600;

async function showPaletteColours(page) {
  if (isPhone(page)) await page.getByRole('button', { name: /^Palette:? / }).click();
}

async function drag(page, from, to) {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

test.describe('Key', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#key .key-swatch');
  });

  test('selects a colour by clicking it or with its number key', async ({ page }) => {
    await addColours(page, 1);
    await expect(swatch(page, 2)).toHaveAttribute('aria-pressed', 'true');

    await swatch(page, 1).click();
    await expect(swatch(page, 1)).toHaveAttribute('aria-pressed', 'true');
    await expect(swatch(page, 2)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#keyHint')).toContainText('Painting with 1');

    await page.keyboard.press('2');
    await expect(swatch(page, 2)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#keyHint')).toContainText('Painting with 2');
  });

  test('opens a menu on the selected swatch to change or remove it', async ({ page }) => {
    await addColours(page, 1);
    const second = swatch(page, 2);

    // Clicking the selected swatch again opens its menu
    await second.click();
    await expect(second).toHaveAttribute('aria-expanded', 'true');
    const menu = page.getByRole('group', { name: 'Colour 2', exact: true });
    await expect(menu.getByText('Change colour')).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Remove' })).toBeVisible();

    // Escape closes it and returns to the swatch
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(second).toBeFocused();

    // Change colour
    await second.click();
    await setColourInput(page.getByLabel('Change colour 2'), '#123456');
    await expect(swatch(page, 2)).toHaveAccessibleName('Colour 2, #123456');

    // Remove asks first
    await swatch(page, 2).click();
    await page.getByRole('group', { name: 'Colour 2', exact: true }).getByRole('button', { name: 'Remove' }).click();
    await page.locator('#mergeConfirmBtn').click();
    await expect(page.locator('.key-swatch')).toHaveCount(1);
  });

  test('the first colour cannot be removed', async ({ page }) => {
    await swatch(page, 1).click();
    const menu = page.getByRole('group', { name: 'Colour 1', exact: true });
    await expect(menu.getByText('Change colour')).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Remove' })).toHaveCount(0);
  });

  test('puts colours that do not fit behind "+N"', async ({ page }) => {
    await addColours(page, 6);
    const more = page.getByRole('button', { name: /more colours/ });
    await expect(more).toBeVisible();

    // The selected colour (7) takes the row's last place
    const row = page.locator('.key-swatches');
    await expect(row.getByRole('button', { name: /^Colour 7,/ })).toBeVisible();

    // Choosing a hidden colour selects it, closes the panel and shows it in the row
    await more.click();
    const panel = page.getByRole('group', { name: 'More colours' });
    await expect(panel).toBeVisible();
    const hiddenName = await panel.locator('.key-swatch').first().getAttribute('aria-label');
    await panel.locator('.key-swatch').first().click();
    await expect(panel).toBeHidden();
    await expect(row.getByRole('button', { name: hiddenName })).toHaveAttribute('aria-pressed', 'true');
  });

  test('stops offering to add at 20 colours', async ({ page }) => {
    await addColours(page, 19);
    await expect(page.getByRole('button', { name: 'Add colour' })).toHaveCount(0);
  });

  test('gives the selected colour a palette colour, or the background with Shift', async ({ page }) => {
    await showPaletteColours(page);
    await page.getByRole('button', { name: 'Make colour 1 #000000' }).click();
    await expect(swatch(page, 1)).toHaveAccessibleName('Colour 1, #000000');

    await page.getByRole('button', { name: 'Make colour 1 #ffffff' }).click({ modifiers: ['Shift'] });
    await expect(page.getByLabel(/^Background colour/)).toHaveAttribute('aria-label', 'Background colour, #ffffff');
  });

  test('switches palette from the list with the keyboard', async ({ page }) => {
    test.skip(isPhone(page), 'On a phone the list is part of the palette section (tests/e2e/phone.spec.js)');
    const trigger = page.getByRole('button', { name: 'Palette: Motif' });
    await trigger.click();
    const listbox = page.getByRole('listbox', { name: 'Palette' });
    await expect(listbox.getByRole('option', { name: /Motif/ })).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(listbox).toBeHidden();
    await expect(page.getByRole('button', { name: 'Palette: Warm' })).toBeFocused();
  });

  test('loads the palette into the key', async ({ page }) => {
    await page.getByRole('button', { name: /^Palette:? Motif/ }).click();
    await page.getByRole('button', { name: 'Load palette' }).click();
    // Twelve colours: some go behind "+N"
    await expect(page.getByRole('button', { name: /more colours/ })).toBeVisible();
    await expect(swatch(page, 1)).toHaveAccessibleName('Colour 1, #000000');
  });

  test('edits the custom palette', async ({ page }) => {
    await page.getByRole('button', { name: /^Palette:? Motif/ }).click();
    await page.getByRole('option', { name: /Custom/ }).click();
    // On a phone the section stays open on choosing a palette
    if (!isPhone(page)) await expect(page.getByRole('listbox', { name: 'Palette' })).toBeHidden();
    await page.getByRole('button', { name: 'Add a colour to the custom palette' }).click();
    await expect(page.locator('.key-chip')).toHaveCount(2);

    await page.locator('.key-chip').nth(1).click();
    const menu = page.getByRole('group', { name: 'Custom palette colour 2', exact: true });
    await setColourInput(menu.getByLabel('Edit custom palette colour 2'), '#abcdef');
    await expect(page.locator('.key-chip').nth(1)).toHaveAccessibleName('Custom palette colour 2, #abcdef');

    await page.locator('.key-chip').nth(1).click();
    await page.getByRole('button', { name: 'Use for colour 1' }).click();
    await expect(swatch(page, 1)).toHaveAccessibleName('Colour 1, #abcdef');

    await page.locator('.key-chip').nth(1).click();
    await page.getByRole('group', { name: 'Custom palette colour 2', exact: true }).getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('.key-chip')).toHaveCount(1);
  });

  test('merges colours by dragging one swatch onto another', async ({ page }) => {
    await addColours(page, 1);
    await drag(page, swatch(page, 2), swatch(page, 1));
    await expect(page.locator('#mergeDialog')).toBeVisible();
    await page.locator('#mergeConfirmBtn').click();
    await expect(page.locator('.key-swatch')).toHaveCount(1);
  });

  test('swaps a colour with the background by dragging', async ({ page }) => {
    const background = page.getByLabel(/^Background colour/);
    const before = await background.getAttribute('aria-label');
    const colour = (await swatch(page, 1).getAttribute('aria-label')).split(', ')[1];

    await drag(page, swatch(page, 1), background);
    await expect(background).toHaveAttribute('aria-label', `Background colour, ${colour}`);
    await expect(swatch(page, 1)).toHaveAccessibleName(`Colour 1, ${before.split(', ')[1]}`);
  });
});
