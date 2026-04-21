import { APIRequestContext, Browser, Page, expect, request as playwrightRequest } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const baseURL = process.env.E2E_BASE_URL ?? 'https://localhost';
const seededPassword = 'E2e!FixedPassphrase123';
const seededPasswordHash = '$2a$12$NXaKrXj1db0Ld1ozVZNfiOoFke0gXcn4RhOERmHCcdycS8xfORDRy';

export interface TestUser {
  id?: string;
  displayName: string;
  email: string;
  password: string;
  role?: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'FACILITATOR' | 'PLAYER';
  orgId?: string | null;
  mfaEnabled?: boolean;
}

interface CreateUserOptions {
  mfaEnabled?: boolean;
}

interface SsoStatus {
  enabled: boolean;
  registrationRequiresInvite?: boolean;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'FACILITATOR' | 'PLAYER';
  };
}

let cachedEnv: Record<string, string> | null = null;

function readLocalEnv(): Record<string, string> {
  if (cachedEnv) return cachedEnv;

  const envPath = path.resolve(process.cwd(), '..', '.env');
  const values: Record<string, string> = {};
  if (!existsSync(envPath)) {
    cachedEnv = values;
    return values;
  }

  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    values[key] = rawValue.trim().replace(/^['"]|['"]$/g, '');
  }

  cachedEnv = values;
  return values;
}

function envValue(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? readLocalEnv()[name] ?? fallback;
}

export function inviteCode(): string | undefined {
  return envValue('INVITE_CODE');
}

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function uniqueUser(label: string): TestUser {
  const suffix = uniqueSuffix();
  return {
    displayName: `E2E ${label} ${suffix}`,
    email: `e2e-${label.toLowerCase()}-${suffix}@cybertabletop.test`,
    password: `E2e!Passphrase-${suffix}A1`,
  };
}

export async function getSsoStatus(api: APIRequestContext): Promise<SsoStatus> {
  const response = await api.get('/api/auth/sso-status');
  expect(response.ok()).toBeTruthy();
  return response.json();
}

export async function registerUser(api: APIRequestContext, user: TestUser): Promise<AuthResponse> {
  const policy = await getSsoStatus(api);
  const inviteCode = envValue('INVITE_CODE');
  if (policy.registrationRequiresInvite && !inviteCode) {
    throw new Error('Registration requires INVITE_CODE, but none was available to the E2E runner.');
  }

  const response = await api.post('/api/auth/register', {
    data: {
      displayName: user.displayName,
      email: user.email,
      password: user.password,
      ...(policy.registrationRequiresInvite ? { inviteCode } : {}),
    },
  });

  expect(response.status(), await safeBody(response)).toBe(201);
  return response.json();
}

export async function loginApi(api: APIRequestContext, user: TestUser): Promise<AuthResponse> {
  const response = await api.post('/api/auth/login', {
    data: {
      email: user.email,
      password: user.password,
    },
  });

  expect(response.status(), await safeBody(response)).toBe(200);
  return response.json();
}

export async function loginPage(page: Page, user: TestUser): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: /Welcome back,/ })).toBeVisible();
}

export async function newAuthenticatedPage(browser: Browser, user: TestUser): Promise<Page> {
  const context = await browser.newContext({ baseURL, ignoreHTTPSErrors: true });
  const authUser = authStoreUser(user);

  await context.addCookies([{
    name: 'access_token',
    value: signAccessToken(user),
    url: baseURL,
    httpOnly: true,
    secure: baseURL.startsWith('https://'),
    sameSite: 'Strict',
    expires: Math.floor(Date.now() / 1000) + 15 * 60,
  }]);

  await context.addInitScript((storedUser) => {
    window.localStorage.setItem('cybertabletop-auth', JSON.stringify({
      state: { user: storedUser },
      version: 0,
    }));
  }, authUser);

  const page = await context.newPage();
  await page.goto('/dashboard');
  if (isPrivilegedRole(user.role) && user.mfaEnabled !== true) {
    await expect(page).toHaveURL(/\/mfa\/setup$/);
  } else {
    await expect(page.getByRole('heading', { name: /Welcome back,/ })).toBeVisible();
  }
  return page;
}

export async function newAuthenticatedApi(user: TestUser): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    baseURL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      Authorization: `Bearer ${signAccessToken(user)}`,
    },
  });
}

export async function promoteUser(
  email: string,
  role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'FACILITATOR' | 'PLAYER',
): Promise<void> {
  const container = envValue('E2E_POSTGRES_CONTAINER', 'cybertabletop-postgres-1')!;
  const sql = `UPDATE "User" SET role='${role}' WHERE email='${sqlLiteral(email)}';`;
  runSql(sql, container);
}

export async function createUserWithRole(
  role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'FACILITATOR' | 'PLAYER',
  label = role,
  options: CreateUserOptions = {},
): Promise<TestUser> {
  const user = {
    ...uniqueUser(label),
    password: seededPassword,
    role,
    mfaEnabled: options.mfaEnabled ?? role !== 'PLAYER',
  };
  user.id = await insertUser(user, role);
  return user;
}

async function insertUser(
  user: TestUser,
  role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'FACILITATOR' | 'PLAYER',
): Promise<string> {
  const id = randomUUID();
  const mfaEnabled = user.mfaEnabled === true;
  const sql = `
    INSERT INTO "User" ("id", "email", "displayName", "role", "passwordHash", "mfaEnabled", "mfaVerifiedAt", "failedAttempts", "createdAt", "updatedAt")
    VALUES (
      '${sqlLiteral(id)}',
      '${sqlLiteral(user.email)}',
      '${sqlLiteral(user.displayName)}',
      '${role}',
      '${sqlLiteral(seededPasswordHash)}',
      ${mfaEnabled ? 'true' : 'false'},
      ${mfaEnabled ? 'NOW()' : 'NULL'},
      0,
      NOW(),
      NOW()
    );
  `;

  runSql(sql);
  return id;
}

async function safeBody(response: { text(): Promise<string> }): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function sqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function runSql(sql: string, container = envValue('E2E_POSTGRES_CONTAINER', 'cybertabletop-postgres-1')!): Buffer {
  const dbUser = envValue('POSTGRES_USER', 'cybertabletop')!;
  const dbName = envValue('POSTGRES_DB', 'cybertabletop')!;

  return execFileSync('docker', [
    'exec',
    container,
    'psql',
    '-U',
    dbUser,
    '-d',
    dbName,
    '-v',
    'ON_ERROR_STOP=1',
    '-tAc',
    sql,
  ]);
}

function authStoreUser(user: TestUser): Required<Pick<TestUser, 'id' | 'email' | 'displayName' | 'role'>> & { orgId?: string | null; mfaEnabled?: boolean } {
  if (!user.id || !user.role) {
    throw new Error('Seeded E2E users must include id and role before authentication.');
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    orgId: user.orgId ?? null,
    mfaEnabled: user.mfaEnabled === true,
  };
}

function signAccessToken(user: TestUser): string {
  const secret = envValue('JWT_SECRET');
  if (!secret) throw new Error('JWT_SECRET is required for authenticated E2E setup.');

  const authUser = authStoreUser(user);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: authUser.id,
    email: authUser.email,
    role: authUser.role,
    orgId: authUser.orgId ?? null,
    displayName: authUser.displayName,
    mfaVerified: user.mfaEnabled === true,
    mfaSetupPending: false,
    iat: now,
    exp: now + 15 * 60,
    iss: 'cybertabletop',
    aud: 'cybertabletop-api',
  };

  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function base64Url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

export function totpCode(secret: string, timestamp = Date.now()): string {
  const key = base32Decode(secret);
  const counter = Math.floor(timestamp / 30_000);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, '0');
}

function base32Decode(value: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = value.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let bitCount = 0;

  for (const char of normalized) {
    const index = alphabet.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid base32 character in TOTP secret: ${char}`);
    }

    bits = (bits << 5) | index;
    bitCount += 5;

    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((bits >> bitCount) & 0xff);
    }
  }

  return Buffer.from(bytes);
}

function isPrivilegedRole(role: TestUser['role']): boolean {
  return role === 'SUPER_ADMIN' || role === 'ORG_ADMIN' || role === 'FACILITATOR';
}
