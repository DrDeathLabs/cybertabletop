import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../services/db';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { audit } from '../services/audit';

const router = Router();

// GET /api/users/me - already in auth, but keep here for profile
router.get('/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      orgId: true,
      mfaEnabled: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });
  res.json({ user });
});

// PATCH /api/users/profile
router.patch('/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    displayName: z.string().min(2).max(100).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: parsed.data,
    select: { id: true, email: true, displayName: true, role: true },
  });

  await audit({ userId: req.user!.id, action: 'USER_UPDATED' });
  res.json({ user });
});

// POST /api/users/change-password
router.post('/change-password', requireAuth, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    currentPassword: z.string(),
    newPassword: z
      .string()
      .min(12)
      .regex(/[A-Z]/)
      .regex(/[a-z]/)
      .regex(/[0-9]/)
      .regex(/[^A-Za-z0-9]/),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user?.passwordHash) {
    res.status(400).json({ error: 'Password change not supported for SSO accounts' });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Current password incorrect' });
    return;
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
  await audit({ userId: user.id, action: 'PASSWORD_CHANGED' });
  res.json({ ok: true });
});

// GET /api/users (admin only)
router.get('/', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  // ORG_ADMIN without an org cannot list any users (prevents cross-tenant data exposure)
  if (req.user!.role !== 'SUPER_ADMIN' && !req.user!.orgId) {
    res.status(403).json({ error: 'No organization assigned to your account' });
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      ...(req.user!.role !== 'SUPER_ADMIN' ? { orgId: req.user!.orgId } : {}),
      id: { not: 'system' },
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      orgId: true,
      mfaEnabled: true,
      failedAttempts: true,
      lockedUntil: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ users });
});

// PATCH /api/users/:id/role (admin only)
router.patch('/:id/role', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const schema = z.object({ role: z.enum(['SUPER_ADMIN', 'ORG_ADMIN', 'FACILITATOR', 'PLAYER']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid role' });
    return;
  }

  if (req.params.id === 'system') {
    res.status(403).json({ error: 'The built-in system account cannot be modified' });
    return;
  }

  if (req.params.id === req.user!.id) {
    res.status(403).json({ error: 'You cannot change your own role' });
    return;
  }

  if (req.user!.role !== 'SUPER_ADMIN' && ['SUPER_ADMIN', 'ORG_ADMIN'].includes(parsed.data.role)) {
    res.status(403).json({ error: 'Only super admins can assign admin roles' });
    return;
  }

  // Verify the target user exists and belongs to the admin's org (ORG_ADMIN cannot
  // modify users outside their own organization — SUPER_ADMIN can modify anyone)
  const targetUser = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, orgId: true },
  });

  if (!targetUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (req.user!.role === 'ORG_ADMIN' && targetUser.orgId !== req.user!.orgId) {
    res.status(403).json({ error: 'Cannot modify users outside your organization' });
    return;
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role: parsed.data.role },
    select: { id: true, email: true, role: true },
  });

  await audit({
    userId: req.user!.id,
    action: 'ROLE_CHANGED',
    resource: req.params.id,
    metadata: { newRole: parsed.data.role },
  });

  res.json({ user });
});

export default router;
