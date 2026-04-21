import { expect, test } from '@playwright/test';
import { createUserWithRole, newAuthenticatedPage, totpCode } from './support/helpers';

test('privileged users are forced to enroll TOTP MFA before using the app', async ({ browser }) => {
  const facilitator = await createUserWithRole('FACILITATOR', 'facilitator-mfa-setup', { mfaEnabled: false });
  const page = await newAuthenticatedPage(browser, facilitator);

  try {
    await expect(page).toHaveURL(/\/mfa\/setup$/);
    await expect(page.getByText('MFA is required for your role')).toBeVisible();

    const secret = (await page.locator('code').first().innerText()).trim();
    await page.getByLabel('3. Enter the 6-digit code').fill(totpCode(secret));
    await page.getByRole('button', { name: 'Enable MFA' }).click();

    await expect(page.getByText('MFA is enabled')).toBeVisible();
    await expect(page.getByText('Store these recovery codes somewhere safe')).toBeVisible();
    await expect(page.locator('code')).toHaveCount(10);
  } finally {
    await page.context().close();
  }
});
