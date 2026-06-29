import { test, expect, Page } from '@playwright/test';

// The navbar uses a hamburger overlay at every breakpoint, so navigation goes
// through it rather than inline links.
async function openMenu(page: Page) {
  await page.getByRole('button', { name: /toggle menu/i }).click();
}

test.describe('public smoke', () => {
  test('homepage renders the navbar and a hero heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('app-navbar')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });

  test('menu navigates to Explore', async ({ page }) => {
    await page.goto('/');
    await openMenu(page);
    await page.getByRole('link', { name: 'Explore' }).click();
    await expect(page).toHaveURL(/\/explore/);
    await expect(page.getByRole('heading', { name: /explore tours/i })).toBeVisible();
  });

  test('menu navigates to Requested tours', async ({ page }) => {
    await page.goto('/');
    await openMenu(page);
    await page.getByRole('link', { name: 'Requested tours' }).click();
    await expect(page).toHaveURL(/\/tour-requests/);
    await expect(page.getByRole('heading', { name: /tour requests/i })).toBeVisible();
  });

  test('menu navigates to Badges and shows 100 badges', async ({ page }) => {
    await page.goto('/');
    await openMenu(page);
    await page.getByRole('link', { name: 'Badges' }).click();
    await expect(page).toHaveURL(/\/badges/);
    await expect(page.getByText(/of 100 badges/i)).toBeVisible();
  });

  test('clicking a badge name opens the historical-figure popup', async ({ page }) => {
    await page.goto('/badges');
    await page.getByRole('button', { name: /about marco polo/i }).first().click();
    await expect(page.getByText(/behind the badge/i)).toBeVisible();
    // Closes on backdrop click.
    await page.locator('.badge-info-backdrop').click({ position: { x: 5, y: 5 } });
    await expect(page.getByText(/behind the badge/i)).toBeHidden();
  });
});
