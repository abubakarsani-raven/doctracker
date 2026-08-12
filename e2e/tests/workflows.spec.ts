import { test, expect } from '@playwright/test';

test.describe('Workflows', () => {
  test('workflows page loads without error boundary', async ({ page }) => {
    await page.goto('/workflows');
    await expect(page.getByText(/something went wrong|application error/i)).toHaveCount(0);
    await expect(page.locator('body')).toContainText(/Workflow/i);
  });

  test('opening a workflow detail (if any) shows routing controls or status', async ({
    page,
  }) => {
    await page.goto('/workflows');
    const link = page.locator('a[href*="/workflows/"]').first();
    const count = await link.count();
    test.skip(count === 0, 'No workflows available for this user');

    await link.click();
    await expect(page).toHaveURL(/\/workflows\/[^/]+$/);
    await expect(page.getByText(/failed to load/i)).toHaveCount(0);
    await expect(page.locator('body')).toContainText(
      /Route|Status|Actions|Files|Complete|Filed|Assigned/i,
    );
  });
});
