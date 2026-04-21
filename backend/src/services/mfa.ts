import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { User } from '@prisma/client';

const APP_NAME = 'CyberTabletop';
const RECOVERY_CODE_COUNT = 10;

export function isPrivilegedRole(role: User['role']): boolean {
  return ['SUPER_ADMIN', 'ORG_ADMIN', 'FACILITATOR'].includes(role);
}

export function isMfaRequiredForUser(user: Pick<User, 'role'>): boolean {
  return isPrivilegedRole(user.role);
}

export async function createTotpSetup(user: Pick<User, 'email' | 'displayName'>): Promise<{
  base32: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
  encryptedSecret: string;
}> {
  const secret = speakeasy.generateSecret({
    name: `${APP_NAME}:${user.email}`,
    issuer: APP_NAME,
    length: 32,
  });

  if (!secret.base32 || !secret.otpauth_url) {
    throw new Error('Failed to generate MFA secret');
  }

  return {
    base32: secret.base32,
    otpauthUrl: secret.otpauth_url,
    qrCodeDataUrl: await QRCode.toDataURL(secret.otpauth_url),
    encryptedSecret: encryptSecret(secret.base32),
  };
}

export function verifyTotpCode(encryptedSecret: string | null | undefined, code: string): boolean {
  if (!encryptedSecret || !normalizeCode(code)) return false;

  return speakeasy.totp.verify({
    secret: decryptSecret(encryptedSecret),
    encoding: 'base32',
    token: normalizeCode(code),
    window: 1,
  });
}

export async function createRecoveryCodes(): Promise<{ plain: string[]; hashes: string[] }> {
  const plain = Array.from({ length: RECOVERY_CODE_COUNT }, () => formatRecoveryCode());
  const hashes = await Promise.all(plain.map((code) => bcrypt.hash(normalizeRecoveryCode(code), 12)));
  return { plain, hashes };
}

export async function consumeRecoveryCode(
  hashes: string[],
  submittedCode: string,
): Promise<{ valid: boolean; remainingHashes: string[] }> {
  const normalized = normalizeRecoveryCode(submittedCode);
  if (!normalized) return { valid: false, remainingHashes: hashes };

  for (let i = 0; i < hashes.length; i += 1) {
    if (await bcrypt.compare(normalized, hashes[i])) {
      return {
        valid: true,
        remainingHashes: hashes.filter((_, index) => index !== i),
      };
    }
  }

  return { valid: false, remainingHashes: hashes };
}

export function getMfaEncryptionKey(): Buffer {
  const raw = process.env.MFA_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MFA_ENCRYPTION_KEY is required in production');
    }
    return crypto.createHash('sha256').update(process.env.JWT_SECRET ?? 'cybertabletop-dev-mfa-key').digest();
  }

  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length === 32) return decoded;

  if (raw.length >= 32) return crypto.createHash('sha256').update(raw).digest();

  throw new Error('MFA_ENCRYPTION_KEY must be a 32-byte base64 value or a 32+ character secret');
}

function encryptSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getMfaEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function decryptSecret(encrypted: string): string {
  const [version, ivValue, tagValue, ciphertextValue] = encrypted.split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error('Invalid MFA secret format');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getMfaEncryptionKey(),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function normalizeCode(code: string): string {
  return code.replace(/\s+/g, '').trim();
}

function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function formatRecoveryCode(): string {
  const value = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `${value.slice(0, 5)}-${value.slice(5)}`;
}
