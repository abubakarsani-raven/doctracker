import { test, expect } from '@playwright/test';

test.describe('Signatures panel', () => {
  test('document detail shows signatures card when a document is open', async ({
    page,
  }) => {
    await page.goto('/documents');
    const docLink = page
      .locator('a[href*="/documents/"]')
      .filter({ hasNot: page.locator('[href*="/folder/"]') })
      .first();

    const count = await docLink.count();
    test.skip(count === 0, 'No documents available');

    await docLink.click();
    await expect(page).toHaveURL(/\/documents\/[^/]+$/);

    await expect(page.getByText(/^signatures$/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('body')).toContainText(
      /No signature requests yet|Request|Pending|Signed|Complete/i,
    );
  });

  test('request signature dialog opens from the panel when allowed', async ({
    page,
  }) => {
    await page.goto('/documents');
    const docLink = page
      .locator('a[href*="/documents/"]')
      .filter({ hasNot: page.locator('[href*="/folder/"]') })
      .first();
    test.skip((await docLink.count()) === 0, 'No documents available');

    await docLink.click();
    const requestBtn = page.getByRole('button', { name: /^request$/i }).first();
    const visible = await requestBtn.isVisible().catch(() => false);
    test.skip(!visible, 'Request signature not available for this role');

    await requestBtn.click();
    await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 15_000 });
  });
});
