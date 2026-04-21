import { Router, Request, Response } from 'express';
import passport from 'passport';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../services/db';
import {
  issueMfaChallengeToken,
  issueTokens,
  rotateRefreshToken,
  revokeRefreshToken,
  verifyMfaChallengeToken,
} from '../auth/tokens';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { audit } from '../services/audit';
import { logger } from '../services/logger';
import {
  consumeRecoveryCode,
  createRecoveryCodes,
  createTotpSetup,
  isMfaRequiredForUser,
  verifyTotpCode,
} from '../services/mfa';

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email().max(255),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  displayName: z.string().min(2).max(100),
  inviteCode: z.string().optional(),
});

const MfaChallengeSchema = z.object({
  challengeToken: z.string().min(20),
  code: z.string().min(6).max(32).optional(),
  recoveryCode: z.string().min(6).max(32).optional(),
}).refine((value) => value.code || value.recoveryCode, {
  message: 'MFA code or recovery code required',
});

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { email, password, displayName } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  // Check invite requirement in production
  const requireInvite = process.env.REQUIRE_INVITE === 'true';
  if (requireInvite) {
    const configuredInviteCode = process.env.INVITE_CODE ?? '';
    if (!configuredInviteCode) {
      res.status(503).json({ error: 'Registration is disabled until an invite code is configured' });
      return;
    }
    if (!parsed.data.inviteCode || !constantTimeEqual(parsed.data.inviteCode, configuredInviteCode)) {
      res.status(403).json({ error: 'Invalid invite code' });
      return;
    }
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    // Don't reveal whether email exists (NIST IA-5)
    res.status(400).json({ error: 'Registration failed. Please check your details.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // First real user becomes SUPER_ADMIN (exclude system seed user)
  const userCount = await prisma.user.count({ where: { id: { not: 'system' } } });
  const role = userCount === 0 ? 'SUPER_ADMIN' : 'PLAYER';

  const user = await prisma.user.create({
    data: { email: normalizedEmail, displayName, passwordHash, role },
  });

  await audit({
    userId: user.id,
    action: 'USER_CREATED',
    ipAddress: req.headers['x-forwarded-for']?.toString() || req.ip,
  });

  const mfaSetupRequired = isMfaRequiredForUser(user);
  const { accessToken, refreshToken } = await issueTokens(user, {
    mfaSetupPending: mfaSetupRequired,
  });

  res
    .status(201)
    .cookie('access_token', accessToken, cookieOptions(15 * 60 * 1000))
    .cookie('refresh_token', refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000))
    .json({
      mfaSetupRequired,
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, mfaEnabled: user.mfaEnabled },
    });
});

// POST /api/auth/login
router.post('/login', (req: Request, res: Response, next) => {
  passport.authenticate('local', { session: false }, async (err: Error | null, user: any, info: any) => {
    if (err) {
      logger.error('Login error', { error: err });
      return res.status(500).json({ error: 'Authentication error' });
    }

    if (!user) {
      return res.status(401).json({ error: info?.message || 'Invalid credentials' });
    }

    try {
      if (user.mfaEnabled) {
        return res.json({
          mfaRequired: true,
          challengeToken: issueMfaChallengeToken(user),
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            mfaEnabled: user.mfaEnabled,
          },
        });
      }

      const mfaSetupRequired = isMfaRequiredForUser(user);
      const { accessToken, refreshToken } = await issueTokens(user, {
        mfaSetupPending: mfaSetupRequired,
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      await audit({
        userId: user.id,
        action: 'USER_LOGIN',
        metadata: { method: 'local', mfaSetupRequired },
        ipAddress: req.headers['x-forwarded-for']?.toString() || req.ip,
      });

      return res
        .cookie('access_token', accessToken, cookieOptions(15 * 60 * 1000))
        .cookie('refresh_token', refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000))
        .json({
          mfaSetupRequired,
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            mfaEnabled: user.mfaEnabled,
          },
        });
    } catch (tokenError) {
      logger.error('Token issue error', { error: tokenError });
      return res.status(500).json({ error: 'Authentication error' });
    }
  })(req, res, next);
});

// POST /api/auth/mfa/verify-login
router.post('/mfa/verify-login', async (req: Request, res: Response) => {
  const parsed = MfaChallengeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'MFA code or recovery code required' });
    return;
  }

  let payload: { sub: string };
  try {
    payload = verifyMfaChallengeToken(parsed.data.challengeToken);
  } catch {
    res.status(401).json({ error: 'Invalid or expired MFA challenge' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user?.mfaEnabled || !user.mfaSecret) {
    res.status(401).json({ error: 'MFA is not enabled for this account' });
    return;
  }

  let valid = false;
  let usedRecoveryCode = false;
  let remainingRecoveryCodes = user.mfaRecoveryCodes;

  if (parsed.data.code) {
    valid = verifyTotpCode(user.mfaSecret, parsed.data.code);
  } else if (parsed.data.recoveryCode) {
    const recoveryResult = await consumeRecoveryCode(user.mfaRecoveryCodes, parsed.data.recoveryCode);
    valid = recoveryResult.valid;
    usedRecoveryCode = recoveryResult.valid;
    remainingRecoveryCodes = recoveryResult.remainingHashes;
  }

  if (!valid) {
    await audit({
      userId: user.id,
      action: 'USER_LOGIN_FAILED',
      metadata: { reason: 'invalid_mfa' },
      ipAddress: req.headers['x-forwarded-for']?.toString() || req.ip,
    });
    res.status(401).json({ error: 'Invalid MFA code' });
    return;
  }

  const { accessToken, refreshToken } = await issueTokens(user, { mfaVerified: true });
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      ...(usedRecoveryCode ? { mfaRecoveryCodes: remainingRecoveryCodes } : {}),
    },
  });

  await audit({
    userId: user.id,
    action: 'USER_LOGIN',
    metadata: { method: usedRecoveryCode ? 'mfa_recovery_code' : 'local_mfa' },
    ipAddress: req.headers['x-forwarded-for']?.toString() || req.ip,
  });

  res
    .cookie('access_token', accessToken, cookieOptions(15 * 60 * 1000))
    .cookie('refresh_token', refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000))
    .json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        orgId: user.orgId,
        mfaEnabled: user.mfaEnabled,
      },
      recoveryCodesRemaining: remainingRecoveryCodes.length,
    });
});

// POST /api/auth/mfa/setup/start
router.post('/mfa/setup/start', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (user.mfaEnabled) {
    res.status(400).json({ error: 'MFA is already enabled' });
    return;
  }

  const setup = await createTotpSetup(user);
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaSecret: setup.encryptedSecret },
  });

  res.json({
    secret: setup.base32,
    otpauthUrl: setup.otpauthUrl,
    qrCodeDataUrl: setup.qrCodeDataUrl,
  });
});

// POST /api/auth/mfa/setup/verify
router.post('/mfa/setup/verify', requireAuth, async (req: AuthRequest, res: Response) => {
  const schema = z.object({ code: z.string().min(6).max(12) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Verification code required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user?.mfaSecret) {
    res.status(400).json({ error: 'Start MFA setup before verifying a code' });
    return;
  }

  if (!verifyTotpCode(user.mfaSecret, parsed.data.code)) {
    await audit({
      userId: user.id,
      action: 'USER_LOGIN_FAILED',
      metadata: { reason: 'invalid_mfa_setup_code' },
      ipAddress: req.headers['x-forwarded-for']?.toString() || req.ip,
    });
    res.status(400).json({ error: 'Invalid verification code' });
    return;
  }

  const recoveryCodes = await createRecoveryCodes();
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      mfaEnabled: true,
      mfaVerifiedAt: new Date(),
      mfaRecoveryCodes: recoveryCodes.hashes,
      lastLoginAt: new Date(),
    },
  });

  await audit({
    userId: user.id,
    action: 'MFA_ENABLED',
    ipAddress: req.headers['x-forwarded-for']?.toString() || req.ip,
  });

  const { accessToken, refreshToken } = await issueTokens(updated, { mfaVerified: true });

  res
    .cookie('access_token', accessToken, cookieOptions(15 * 60 * 1000))
    .cookie('refresh_token', refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000))
    .json({
      recoveryCodes: recoveryCodes.plain,
      user: {
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        role: updated.role,
        orgId: updated.orgId,
        mfaEnabled: updated.mfaEnabled,
      },
    });
});

// POST /api/auth/mfa/recovery-codes/regenerate
router.post('/mfa/recovery-codes/regenerate', requireAuth, async (req: AuthRequest, res: Response) => {
  const schema = z.object({ code: z.string().min(6).max(12) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Current MFA code required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user?.mfaEnabled || !user.mfaSecret) {
    res.status(400).json({ error: 'MFA is not enabled' });
    return;
  }

  if (!verifyTotpCode(user.mfaSecret, parsed.data.code)) {
    res.status(400).json({ error: 'Invalid MFA code' });
    return;
  }

  const recoveryCodes = await createRecoveryCodes();
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaRecoveryCodes: recoveryCodes.hashes },
  });

  res.json({ recoveryCodes: recoveryCodes.plain });
});

// POST /api/auth/mfa/disable
router.post('/mfa/disable', requireAuth, async (req: AuthRequest, res: Response) => {
  const schema = z.object({ code: z.string().min(6).max(12) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Current MFA code required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user?.mfaEnabled || !user.mfaSecret) {
    res.status(400).json({ error: 'MFA is not enabled' });
    return;
  }

  if (isMfaRequiredForUser(user)) {
    res.status(403).json({ error: 'MFA is required for privileged accounts' });
    return;
  }

  if (!verifyTotpCode(user.mfaSecret, parsed.data.code)) {
    res.status(400).json({ error: 'Invalid MFA code' });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: false, mfaSecret: null, mfaVerifiedAt: null, mfaRecoveryCodes: [] },
  });

  await audit({
    userId: user.id,
    action: 'MFA_DISABLED',
    ipAddress: req.headers['x-forwarded-for']?.toString() || req.ip,
  });

  res.json({ ok: true });
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const token = req.cookies?.refresh_token;
  if (!token) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }

  try {
    const rotated = await rotateRefreshToken(token);
    if (!rotated) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    res
      .cookie('access_token', rotated.accessToken, cookieOptions(15 * 60 * 1000))
      .cookie('refresh_token', rotated.refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000))
      .json({ ok: true });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req: AuthRequest, res: Response) => {
  const refreshToken = req.cookies?.refresh_token;
  if (refreshToken) await revokeRefreshToken(refreshToken);

  await audit({
    userId: req.user!.id,
    action: 'USER_LOGOUT',
    ipAddress: req.headers['x-forwarded-for']?.toString() || req.ip,
  });

  res
    .clearCookie('access_token')
    .clearCookie('refresh_token')
    .json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, displayName: true, role: true, orgId: true, mfaEnabled: true },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user });
});

// GET /api/auth/sso-status
router.get('/sso-status', (_req, res) => {
  res.json({
    enabled: !!process.env.OIDC_ISSUER_URL,
    registrationRequiresInvite: process.env.REQUIRE_INVITE === 'true',
  });
});

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge,
  };
}

export default router;
