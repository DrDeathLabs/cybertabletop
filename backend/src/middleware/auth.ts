// NIST SP 800-53 Rev 5:
// AC-2 (Account Management)
// AC-3 (Access Enforcement)
// AC-6 (Least Privilege)

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { UserRole } from '@prisma/client';
import { verifyAccessToken } from '../auth/tokens';
import { prisma } from '../services/db';
import { isMfaRequiredForUser } from '../services/mfa';

// Alias for route handler typing convenience
export type AuthRequest = Request;

export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = req.cookies?.access_token || extractBearerToken(req);

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        orgId: true,
        displayName: true,
        mfaEnabled: true,
      },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      orgId: user.orgId ?? null,
      displayName: user.displayName,
      mfaEnabled: user.mfaEnabled,
      mfaVerified: payload.mfaVerified === true,
      mfaSetupPending: payload.mfaSetupPending === true,
    };

    if (isMfaRequiredForUser(user)) {
      if (user.mfaEnabled && payload.mfaVerified !== true) {
        res.status(403).json({ error: 'MFA verification required', code: 'MFA_REQUIRED' });
        return;
      }

      if (!user.mfaEnabled && !isMfaSetupAllowed(req)) {
        res.status(403).json({ error: 'MFA setup required', code: 'MFA_SETUP_REQUIRED' });
        return;
      }
    }

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

function isMfaSetupAllowed(req: Request): boolean {
  const path = req.originalUrl.split('?')[0];
  if (path === '/api/auth/me') return true;
  if (path === '/api/auth/logout') return true;
  if (path.startsWith('/api/auth/mfa/')) return true;
  if (req.method === 'GET' && path === '/api/users/profile') return true;
  return false;
}

export const requireFacilitator: RequestHandler = (req, res, next) => {
  requireRole(UserRole.FACILITATOR, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)(req, res, next);
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  requireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)(req, res, next);
};

function extractBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}
