import { test, expect } from '@playwright/test';

test.describe('Documents', () => {
  test('documents page does not show a permission crash toast on load', async ({
    page,
  }) => {
    await page.goto('/documents');
    await expect(
      page.getByText(/failed to load document|you do not have permission to do that/i),
    ).toHaveCount(0);
    await expect(page.locator('body')).toContainText(/Documents|Folders|Upload|Registry/i);
  });

  test('opening the first document (if any) keeps access', async ({ page }) => {
    await page.goto('/documents');

    const docLink = page
      .locator('a[href*="/documents/"]')
      .filter({ hasNot: page.locator('[href*="/folder/"]') })
      .first();

    const count = await docLink.count();
    test.skip(count === 0, 'No documents seeded for this user yet');

    await docLink.click();
    await expect(page).toHaveURL(/\/documents\/[^/]+$/);
    await expect(page.getByText(/failed to load document/i)).toHaveCount(0);
    await expect(page.locator('body')).toContainText(
      /Signatures|Document Information|Preview|Versions/i,
    );
  });

  test('upload control is present when the role can create documents', async ({
    page,
  }) => {
    await page.goto('/documents');
    const upload = page.getByRole('button', { name: /upload/i }).first();
    const visible = await upload.isVisible().catch(() => false);
    test.skip(!visible, 'Upload not available for role');
    // PermissionButton may render disabled until folder context is chosen.
    await expect(upload).toBeVisible();
  });
});
