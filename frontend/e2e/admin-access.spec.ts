import { test, expect } from '@playwright/test';
import { createUserWithRole, newAuthenticatedPage } from './support/helpers';

test('facilitators cannot open the admin panel', async ({ browser }) => {
  const facilitator = await createUserWithRole('FACILITATOR', 'facilitator-admin-deny');
  const page = await newAuthenticatedPage(browser, facilitator);

  try {
    await page.goto('/admin');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toHaveCount(0);
  } finally {
    await page.context().close();
  }
});

test('super admins can open the admin panel', async ({ browser }) => {
  const admin = await createUserWithRole('SUPER_ADMIN', 'super-admin');
  const page = await newAuthenticatedPage(browser, admin);

  try {
    await page.goto('/admin');

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();
  } finally {
    await page.context().close();
  }
});
