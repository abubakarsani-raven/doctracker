import { test, expect } from '@playwright/test';

test.describe('Authenticated navigation', () => {
  test('dashboard loads without a fatal error boundary', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/something went wrong|application error/i)).toHaveCount(0);
    await expect(page.locator('body')).toContainText(/Dashboard|Documents|Workflows|DocTracker/i);
  });

  test('documents registry is reachable', async ({ page }) => {
    await page.goto('/documents');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).toContainText(/Documents|Folders|Upload|Registry/i);
  });

  test('workflows list is reachable', async ({ page }) => {
    await page.goto('/workflows');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).toContainText(/Workflow/i);
  });

  test('actions list is reachable', async ({ page }) => {
    await page.goto('/actions');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).toContainText(/Action/i);
  });

  test('documents remains reachable after visiting dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/\/login/);
    await page.goto('/documents');
    await expect(page).toHaveURL(/\/documents/);
    await expect(page).not.toHaveURL(/\/login/);
  });
});
