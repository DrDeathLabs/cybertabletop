import { describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { requireAuth, requireRole } from './auth';

const JWT_SECRET = 'test-jwt-secret-with-more-than-thirty-two-characters';

function mockResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

describe('requireAuth', () => {
  it('accepts a valid bearer access token and populates req.user', () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const token = jwt.sign(
      {
        sub: 'user-1',
        email: 'facilitator@example.com',
        role: UserRole.FACILITATOR,
        orgId: 'org-1',
      },
      JWT_SECRET,
      { issuer: 'cybertabletop', audience: 'cybertabletop-api', expiresIn: '15m' },
    );
    const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} } as any;
    const res = mockResponse() as any;
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject({
      id: 'user-1',
      email: 'facilitator@example.com',
      role: UserRole.FACILITATOR,
      orgId: 'org-1',
    });
  });

  it('rejects missing and invalid tokens', () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const missingReq = { headers: {}, cookies: {} } as any;
    const invalidReq = {
      headers: { authorization: 'Bearer invalid-token' },
      cookies: {},
    } as any;
    const missingRes = mockResponse() as any;
    const invalidRes = mockResponse() as any;

    requireAuth(missingReq, missingRes, vi.fn());
    requireAuth(invalidReq, invalidRes, vi.fn());

    expect(missingRes.status).toHaveBeenCalledWith(401);
    expect(missingRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(invalidRes.status).toHaveBeenCalledWith(401);
    expect(invalidRes.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
  });
});

describe('requireRole', () => {
  it('allows matching roles and rejects lower-privilege roles', () => {
    const allowedReq = { user: { role: UserRole.ORG_ADMIN } } as any;
    const deniedReq = { user: { role: UserRole.PLAYER } } as any;
    const allowedRes = mockResponse() as any;
    const deniedRes = mockResponse() as any;
    const next = vi.fn();

    requireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)(allowedReq, allowedRes, next);
    requireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)(deniedReq, deniedRes, vi.fn());

    expect(next).toHaveBeenCalledOnce();
    expect(deniedRes.status).toHaveBeenCalledWith(403);
    expect(deniedRes.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
  });
});
