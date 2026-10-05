import { test, expect } from '@playwright/test';

test.describe('Help page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/help.html');
  });

  test('shows instructions for the chosen way of working', async ({ page }) => {
    const touchText = page.getByText('Tap a cell to paint it');
    const desktopText = page.getByText('Click a cell to paint it');

    await page.getByRole('radio', { name: 'Touch' }).check();
    await expect(touchText).toBeVisible();
    await expect(desktopText).toBeHidden();
    await expect(page.getByRole('link', { name: 'Keyboard shortcuts' })).toBeHidden();

    await page.getByRole('radio', { name: 'Desktop' }).check();
    await expect(desktopText).toBeVisible();
    await expect(touchText).toBeHidden();
    await expect(page.getByRole('link', { name: 'Keyboard shortcuts' })).toBeVisible();
  });

  test('remembers the choice', async ({ page }) => {
    await page.getByRole('radio', { name: 'Touch' }).check();
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Touch' })).toBeChecked();
    await expect(page.getByText('Tap a cell to paint it')).toBeVisible();
  });

  test('links back to the editor', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Motif, back to the editor' })).toHaveAttribute('href', '/');
    await expect(page.getByRole('banner').getByRole('link', { name: '← Back to Motif' })).toHaveAttribute('href', '/');
  });
});

test.describe('About page', () => {
  test('has the top bar and its title', async ({ page }) => {
    await page.goto('/about.html');
    await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Motif, back to the editor' })).toHaveAttribute('href', '/');
  });
});
