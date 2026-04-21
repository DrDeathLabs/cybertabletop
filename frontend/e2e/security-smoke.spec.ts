import { test, expect } from '@playwright/test';

test('deployment health endpoint is available', async ({ request }) => {
  const response = await request.get('/health');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/application\/json/);
  await expect(await response.json()).toMatchObject({ status: 'ok' });
});

test('public frontend responses include browser security headers', async ({ request }) => {
  const response = await request.get('/');
  expect(response.status()).toBe(200);

  const headers = response.headers();
  expect(headers['strict-transport-security']).toContain('max-age=31536000');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['cross-origin-opener-policy']).toBe('same-origin');
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['content-security-policy']).toContain("object-src 'none'");
  expect(headers['content-security-policy']).toContain("base-uri 'self'");
});
