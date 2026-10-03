import { test, expect } from '@playwright/test';

test.describe('Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#editCanvas');
  });

  test('moves between rows with the arrow keys and closes with Escape', async ({ page }) => {
    const menuBtn = page.locator('#navbarHamburgerBtn');
    await menuBtn.click();
    await expect(page.getByRole('button', { name: 'Import JSON' })).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('button', { name: 'Export JSON' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('link', { name: 'Help' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.locator('#navbarHamburgerMenu')).not.toHaveClass(/open/);
    await expect(menuBtn).toBeFocused();
    await expect(menuBtn).toHaveAttribute('aria-expanded', 'false');
  });

  test('shows and sets the cell aspect ratio', async ({ page }) => {
    await page.locator('#navbarHamburgerBtn').click();
    const row = page.locator('#cellAspectRatioToggle');
    await expect(row).toContainText('Square 1:1');

    await row.click();
    await page.getByRole('button', { name: 'Knit stitch 4:3', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Knit stitch 4:3', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(row).toContainText('Knit stitch 4:3');

    await page.getByRole('button', { name: 'Custom', exact: true }).click();
    const field = page.getByLabel('Ratio', { exact: true });
    await expect(field).toBeFocused();
    await field.fill('2');
    await field.press('Enter');
    await expect(row).toContainText('Custom');
  });
});

test.describe('Dialogs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#editCanvas');
  });

  test('a confirmation closes with Escape and returns focus to what opened it', async ({ page }) => {
    const clearBtn = page.locator('#clearBtn');
    await clearBtn.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Clear canvas?' });
    await expect(dialog).toBeVisible();
    await expect(page.locator('#mergeCancelBtn')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(clearBtn).toBeFocused();
  });

  test('the remove colour dialog uses the app\'s words', async ({ page }) => {
    await page.getByRole('button', { name: 'Add colour' }).click();
    await page.getByRole('button', { name: /^Colour 2,/ }).click();
    await page.getByRole('group', { name: 'Colour 2', exact: true }).getByRole('button', { name: 'Remove' }).click();
    const dialog = page.getByRole('dialog', { name: 'Remove colour?' });
    await expect(dialog).toContainText('This colour will be removed from your palette.');
    await expect(dialog.getByRole('button', { name: 'Remove' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('shortcuts leave the pattern alone while a dialog is open', async ({ page }) => {
    await page.getByRole('button', { name: 'Add colour' }).click();
    await page.locator('#downloadBtn').click();
    await page.keyboard.press('1');
    await expect(page.getByRole('button', { name: /^Colour 2,/ })).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('Notes', () => {
  test('an import error shows in the top bar until dismissed', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#editCanvas');

    await page.locator('#navbarImportJsonInput').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a pattern')
    });

    const note = page.locator('#noteSlot').getByRole('alert');
    await expect(note).toBeVisible();
    await note.getByRole('button', { name: 'Dismiss' }).click();
    await expect(note).toBeHidden();
  });
});
