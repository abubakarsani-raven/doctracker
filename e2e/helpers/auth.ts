import { Page, expect, APIRequestContext } from '@playwright/test';

export const E2E_EMAIL = process.env.E2E_EMAIL || 'aisha@example.com';
export const E2E_PASSWORD = process.env.E2E_PASSWORD || 'Password123!';
export const E2E_API_URL = process.env.E2E_API_URL || 'http://localhost:4003';

/** Fill the login form and wait until the dashboard shell is visible. */
export async function loginViaUi(
  page: Page,
  email = E2E_EMAIL,
  password = E2E_PASSWORD,
) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: /^email$/i }).fill(email);
  await page.getByRole('textbox', { name: /^password$/i }).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/(dashboard|documents)/, { timeout: 30_000 });
}

/**
 * Authenticate by calling the API from the browser context, then stash the
 * access token for Bearer fallback (cross-origin cookies are SameSite=Lax in
 * local dev and often do not attach on XHR from :3000 → :4003).
 */
export async function loginViaApiInBrowser(
  page: Page,
  email = E2E_EMAIL,
  password = E2E_PASSWORD,
  apiUrl = E2E_API_URL,
) {
  await page.goto('/login');
  const result = await page.evaluate(
    async ({ email, password, apiUrl }) => {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, rememberMe: true }),
      });
      const text = await res.text();
      let body: any = null;
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
      if (!res.ok) {
        return {
          ok: false as const,
          status: res.status,
          message: body?.message || text || res.statusText,
        };
      }
      if (body?.access_token) {
        localStorage.setItem('authToken', body.access_token);
        localStorage.setItem('access_token', body.access_token);
      }
      if (body?.csrfToken) {
        sessionStorage.setItem('dt_csrf_token', body.csrfToken);
      }
      return { ok: true as const, status: res.status };
    },
    { email, password, apiUrl },
  );

  if (!result.ok) {
    throw new Error(
      `API login failed (${result.status}): ${result.message}. Is ${apiUrl} up and seeded?`,
    );
  }

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/(dashboard|documents)/, { timeout: 30_000 });
}

/** Node-side login for smoke-checking the API before UI tests. */
export async function assertApiLoginWorks(
  request: APIRequestContext,
  email = E2E_EMAIL,
  password = E2E_PASSWORD,
  apiUrl = E2E_API_URL,
) {
  const res = await request.post(`${apiUrl}/auth/login`, {
    data: { email, password, rememberMe: true },
  });
  expect(
    res.ok(),
    `API login at ${apiUrl} failed: ${res.status()} ${await res.text()}`,
  ).toBeTruthy();
}
