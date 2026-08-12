import { test, expect } from '@playwright/test';
import { E2E_EMAIL, E2E_PASSWORD, loginViaUi } from '../helpers/auth';

test.describe('Authentication', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('shows login page for guests', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Sign in').first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^email$/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^password$/i })).toBeVisible();
  });

  test('rejects bad credentials without entering the app', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: /^email$/i }).fill(E2E_EMAIL);
    await page.getByRole('textbox', { name: /^password$/i }).fill('WrongPassword!!!');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(
      page.getByText(/do not match an account|deactivated|cannot reach the api|invalid/i),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('logs in with a seeded account via the UI form', async ({ page }) => {
    test.setTimeout(90_000);
    await loginViaUi(page, E2E_EMAIL, E2E_PASSWORD);
    await expect(page.getByText(/DocTracker|Dashboard|Documents/i).first()).toBeVisible();
  });
});
