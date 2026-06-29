import { test, expect, Page } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// Full creator + buyer journey against the REAL backend (DB + API on :3000).
//
// Gated behind E2E_FULL so the default `npm run e2e` (smoke only) stays green
// without a running backend. Run the whole stack, then:
//   E2E_FULL=1 npm run e2e
//
// It registers a throwaway account, builds a free dummy "blueprint" tour
// (text + image placeholders, no audio — mirroring src/app/features/studio/
// demo-tour.ts), publishes it, acquires it for free, checks the library, then
// deletes it. The tour is intentionally disposable so this can run repeatedly.
//
// Selectors lean on visible text / labels; adjust if the UI copy changes.
// ─────────────────────────────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' });

const RUN = !!process.env.E2E_FULL;

// Unique per run so re-runs never collide.
const stamp = Date.now();
const account = {
  displayName: `E2E Tester ${stamp}`,
  username: `e2e_${stamp}`,
  email: `e2e_${stamp}@example.test`,
  password: 'Passw0rd!e2e',
};
const TOUR_TITLE = `E2E Demo · Atlantooga ${stamp}`;

async function openMenu(page: Page) {
  await page.getByRole('button', { name: /toggle menu/i }).click();
}

test.describe('creator + buyer journey', () => {
  test.skip(!RUN, 'Set E2E_FULL=1 and run the backend stack to execute the full journey.');

  test('register a fresh account', async ({ page }) => {
    await page.goto('/auth/register');
    await page.getByLabel('Display name').fill(account.displayName);
    await page.getByLabel('Username').fill(account.username);
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: /join|sign up|create account/i }).click();
    // Land somewhere authenticated (home or studio).
    await expect(page).not.toHaveURL(/\/auth\/register/);
  });

  test('inspect the demo blueprint in the Studio', async ({ page }) => {
    await page.goto('/studio/blueprint');
    // Dismiss the purpose reminder, then the itinerary is visible.
    await page.getByRole('button', { name: /show me the tour/i }).click();
    await expect(page.getByText(/the sunken city that never was/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /create a tour/i }).first()).toBeVisible();
  });

  test('create and publish a free dummy tour', async ({ page }) => {
    await page.goto('/studio/tours/new');

    // "Name your tour" prompt.
    await page.getByLabel('Tour title').fill(TOUR_TITLE);
    await page.getByRole('button', { name: /create tour/i }).click();

    // Description.
    await page.locator('#tour-desc').fill(
      'A throwaway e2e blueprint tour of a city that never existed. Text and images only.',
    );

    // Leave the price at 0 → free tour.
    const price = page.getByLabel('Price in euros');
    if (await price.count()) await price.fill('0');

    // Publish — adjust the button name if your publish control differs.
    await page.getByRole('button', { name: /publish|save/i }).first().click();

    await page.goto('/studio/tours');
    await expect(page.getByText(TOUR_TITLE)).toBeVisible();
  });

  test('acquire the free tour and see it in the library', async ({ page }) => {
    await page.goto('/explore');
    await page.getByText(TOUR_TITLE).first().click();
    await page.getByRole('button', { name: /get for free|start tour/i }).first().click();

    await page.goto('/library');
    await expect(page.getByText(TOUR_TITLE)).toBeVisible();
  });

  test('delete the dummy tour (always disposable via dev force-delete)', async ({ page }) => {
    await page.goto('/studio/tours');
    // Open the row actions (⋮) for the dummy tour, then Delete.
    await page.getByRole('button', { name: /more_vert|more|actions/i }).first().click();
    await page.getByRole('menuitem', { name: /delete/i }).click();
    // It was acquired, so the normal delete is blocked — use the dev-only
    // "Force delete" button; fall back to the standard delete otherwise.
    const force = page.getByRole('button', { name: /force delete/i });
    if (await force.count()) {
      await force.click();
    } else {
      await page.getByRole('button', { name: /delete (selected|entire)/i }).click();
    }
    await expect(page.getByText(TOUR_TITLE)).toBeHidden();
  });
});
