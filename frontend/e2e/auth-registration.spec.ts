import { test, expect } from '@playwright/test';
import { getSsoStatus, inviteCode, uniqueUser } from './support/helpers';

test('registration follows the configured invite policy and lands on the dashboard', async ({ page, request }) => {
  const policy = await getSsoStatus(request);
  const user = uniqueUser('registration');

  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible();

  if (policy.registrationRequiresInvite) {
    await expect(page.getByLabel('Invite Code')).toBeVisible();
  } else {
    await expect(page.getByLabel('Invite Code')).toHaveCount(0);
  }

  await page.getByLabel('Display Name').fill(user.displayName);
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByLabel('Confirm Password').fill(user.password);

  if (policy.registrationRequiresInvite) {
    const code = inviteCode();
    expect(code, 'Registration requires an invite code for this deployment').toBeTruthy();
    await page.getByLabel('Invite Code').fill(code!);
  }

  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: /Welcome back,/ })).toBeVisible();
});
