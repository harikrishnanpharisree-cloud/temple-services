import { test, expect } from '@playwright/test';

// These tests hit a real local Supabase stack (`npx supabase start`), not a
// mock — they're an integration check, not a unit test. Selectors are CSS
// classes / attributes rather than button text, since the UI language
// (English/Malayalam) can change independently of what these tests check.
//
// The admin test needs a signed-in user to exist locally. Create one once
// per local stack with:
//   curl -X POST 'http://127.0.0.1:54321/auth/v1/admin/users' \
//     -H "apikey: <local secret key from `npx supabase status`>" \
//     -H "Authorization: Bearer <same secret key>" \
//     -H "Content-Type: application/json" \
//     -d '{"email":"admin@local.test","password":"LocalTestAdmin123!","email_confirm":true}'
// (`npx supabase db reset` wipes auth.users too, so redo this after a reset.)
const ADMIN_EMAIL = 'admin@local.test';
const ADMIN_PASSWORD = 'LocalTestAdmin123!';

test('a devotee can complete a booking end to end', async ({ page }) => {
  await page.goto('/offerings');

  const day = page.locator('.pdp-day:not([disabled])').first();
  const iso = await day.getAttribute('data-date');
  await day.click();

  const devoteeName = `Playwright Test ${Date.now()}`;
  await page.locator('.devotee-block input[placeholder]').fill(devoteeName);
  await page.locator('.devotee-block select').selectOption('Ashwini');
  await page.locator('.mini-item').first().click();

  const addToCart = page.locator('.btn-add-cart');
  await expect(addToCart).toBeEnabled();
  await addToCart.click();

  await expect(page.locator('.cart-box')).toContainText(devoteeName);

  await page.locator('.btn-pay').click();

  const modal = page.locator('.modal-ov');
  await expect(modal).toBeVisible();
  const bookingIdText = await page.locator('.booking-id').textContent();
  expect(bookingIdText).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

  // Stash for the admin test below via test annotation isn't shared across
  // tests by design in Playwright — this test stands alone; the admin test
  // creates its own booking rather than depending on this one's data.
  void iso;
});

test('an admin can sign in and find a booking made for a given date', async ({ page }) => {
  // Create a booking first so there's something to find.
  await page.goto('/offerings');
  const day = page.locator('.pdp-day:not([disabled])').first();
  const iso = await day.getAttribute('data-date');
  await day.click();

  const devoteeName = `Admin Search Test ${Date.now()}`;
  await page.locator('.devotee-block input[placeholder]').fill(devoteeName);
  await page.locator('.devotee-block select').selectOption('Bharani');
  await page.locator('.mini-item').first().click();
  await page.locator('.btn-add-cart').click();
  await page.locator('.btn-pay').click();
  await expect(page.locator('.modal-ov')).toBeVisible();

  // Now log in as admin and search for that date.
  await page.goto('/admin');
  await expect(page.locator('.admin-login-form')).toBeVisible();
  await page.locator('.admin-login-form input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('.admin-login-form input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('.admin-login-form button[type="submit"]').click();

  await expect(page.locator('.admin-header')).toBeVisible({ timeout: 10_000 });

  await page.locator('input[type="date"]').fill(iso);
  await page.locator('.admin-search-row button').click();

  await expect(page.locator('.admin-results')).toContainText(devoteeName, { timeout: 10_000 });
});

test('changing the admin date picker updates results without clicking Search', async ({ page }) => {
  // Regression test for a bug where the date <input> updated but the
  // results panel kept showing whatever date was last explicitly searched,
  // until "Search" was clicked again — picking a new date silently did
  // nothing on screen.
  async function bookOnNthDay(n, star) {
    await page.goto('/offerings');
    const day = page.locator('.pdp-day:not([disabled])').nth(n);
    const iso = await day.getAttribute('data-date');
    await day.click();
    const devoteeName = `DatePicker Test ${n} ${Date.now()}`;
    await page.locator('.devotee-block input[placeholder]').fill(devoteeName);
    await page.locator('.devotee-block select').selectOption(star);
    await page.locator('.mini-item').first().click();
    await page.locator('.btn-add-cart').click();
    await page.locator('.btn-pay').click();
    await expect(page.locator('.modal-ov')).toBeVisible();
    return { iso, devoteeName };
  }

  const first = await bookOnNthDay(0, 'Krittika');
  const second = await bookOnNthDay(1, 'Rohini');

  await page.goto('/admin');
  if (await page.locator('.admin-login-form').isVisible().catch(() => false)) {
    await page.locator('.admin-login-form input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('.admin-login-form input[type="password"]').fill(ADMIN_PASSWORD);
    await page.locator('.admin-login-form button[type="submit"]').click();
  }
  await expect(page.locator('.admin-header')).toBeVisible({ timeout: 10_000 });

  // Land on the first date via the Search button (baseline)...
  await page.locator('input[type="date"]').fill(first.iso);
  await page.locator('.admin-search-row button').click();
  const results = page.locator('.admin-results, .empty-state');
  await expect(results).toContainText(first.devoteeName, { timeout: 10_000 });

  // ...then switch to the second date WITHOUT touching Search. Results
  // must follow the date picker on their own.
  await page.locator('input[type="date"]').fill(second.iso);
  await expect(results).toContainText(second.devoteeName, { timeout: 10_000 });
  await expect(results).not.toContainText(first.devoteeName);
});
