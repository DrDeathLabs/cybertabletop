// NIST SP 800-53 Rev 5:
// AC-2 (Account Management)
// AC-3 (Access Enforcement)
// AC-6 (Least Privilege)

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { UserRole } from '@prisma/client';
import { verifyAccessToken } from '../auth/tokens';

// Alias for route handler typing convenience
export type AuthRequest = Request;

export const requireAuth: RequestHandler = (req, res, next) => {
  const token = req.cookies?.access_token || extractBearerToken(req);

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      orgId: payload.orgId ?? null,
      displayName: payload.displayName ?? '',
    };
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
