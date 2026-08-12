import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import {
  E2E_API_URL,
  E2E_EMAIL,
  E2E_PASSWORD,
  assertApiLoginWorks,
} from '../helpers/auth';

const authDir = path.resolve(__dirname, '../.auth');
const staffFile = path.join(authDir, 'staff.json');

setup('authenticate staff user', async ({ page, request }) => {
  fs.mkdirSync(authDir, { recursive: true });

  await assertApiLoginWorks(request, E2E_EMAIL, E2E_PASSWORD);

  const res = await request.post(`${E2E_API_URL}/auth/login`, {
    data: { email: E2E_EMAIL, password: E2E_PASSWORD, rememberMe: true },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.access_token).toBeTruthy();

  // Seed Bearer token on the frontend origin (cookie auth is cross-port and
  // often blocked by SameSite=Lax in local split frontend/API setups).
  await page.goto('/login');
  await page.evaluate(
    ({ token, csrf }) => {
      localStorage.setItem('authToken', token);
      localStorage.setItem('access_token', token);
      if (csrf) sessionStorage.setItem('dt_csrf_token', csrf);
    },
    { token: body.access_token as string, csrf: body.csrfToken as string | undefined },
  );

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/(dashboard|documents)/, { timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: staffFile });
});
