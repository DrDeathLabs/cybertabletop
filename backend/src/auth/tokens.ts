import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';
import crypto from 'crypto';
import { prisma } from '../services/db';

const ISSUER = 'cybertabletop';
const AUDIENCE = 'cybertabletop-api';
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(user: User): string {
  const secret = process.env.JWT_SECRET!;

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
    },
    secret,
    { expiresIn: '15m', issuer: ISSUER, audience: AUDIENCE }
  );
}

function signRefreshToken(user: User, jti: string): string {
  const refreshSecret = process.env.JWT_REFRESH_SECRET!;

  return jwt.sign(
    { sub: user.id },
    refreshSecret,
    { expiresIn: '7d', issuer: ISSUER, audience: AUDIENCE, jwtid: jti }
  );
}

export async function issueTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signAccessToken(user);
  const jti = crypto.randomUUID();
  const refreshToken = signRefreshToken(user, jti);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      jti,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return { accessToken, refreshToken };
}

export async function rotateRefreshToken(token: string): Promise<{
  accessToken: string;
  refreshToken: string;
  user: User;
} | null> {
  const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!, {
    issuer: ISSUER,
    audience: AUDIENCE,
  }) as { sub: string; jti?: string };

  if (!payload.jti) return null;

  const stored = await prisma.refreshToken.findUnique({
    where: { jti: payload.jti },
    include: { user: true },
  });

  if (
    !stored
    || stored.userId !== payload.sub
    || stored.revokedAt
    || stored.expiresAt <= new Date()
    || stored.tokenHash !== hashToken(token)
  ) {
    if (stored && !stored.revokedAt) {
      await prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
    }
    return null;
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date(), rotatedAt: new Date() },
  });

  const next = await issueTokens(stored.user);
  return { ...next, user: stored.user };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!, {
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as { jti?: string };

    if (!payload.jti) return;
    await prisma.refreshToken.updateMany({
      where: { jti: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Invalid or expired tokens have no active server-side session to revoke.
  }
}

export function verifyAccessToken(token: string): {
  sub: string;
  email: string;
  role: User['role'];
  orgId: string | null;
  displayName?: string;
} {
  return jwt.verify(token, process.env.JWT_SECRET!, {
    issuer: ISSUER,
    audience: AUDIENCE,
  }) as {
    sub: string;
    email: string;
    role: User['role'];
    orgId: string | null;
    displayName?: string;
  };
}
