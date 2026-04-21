import { describe, expect, it } from 'vitest';
import { UserRole } from '@prisma/client';
import { canManageSession, canViewSession } from './session-access';

const session = {
  facilitatorId: 'facilitator-1',
  orgId: 'org-1',
  players: [{ userId: 'player-1' }],
};

describe('session access', () => {
  it('allows facilitators, participants, and same-org admins to view sessions', () => {
    expect(canViewSession({ id: 'facilitator-1', role: UserRole.FACILITATOR }, session)).toBe(true);
    expect(canViewSession({ id: 'player-1', role: UserRole.PLAYER }, session)).toBe(true);
    expect(canViewSession({ id: 'admin-1', role: UserRole.ORG_ADMIN, orgId: 'org-1' }, session)).toBe(true);
  });

  it('prevents cross-org admins and unrelated users from viewing sessions', () => {
    expect(canViewSession({ id: 'admin-2', role: UserRole.ORG_ADMIN, orgId: 'org-2' }, session)).toBe(false);
    expect(canViewSession({ id: 'player-2', role: UserRole.PLAYER }, session)).toBe(false);
  });

  it('limits management to session facilitators, super admins, and same-org org admins', () => {
    expect(canManageSession({ id: 'facilitator-1', role: UserRole.FACILITATOR }, session)).toBe(true);
    expect(canManageSession({ id: 'super-1', role: UserRole.SUPER_ADMIN }, session)).toBe(true);
    expect(canManageSession({ id: 'admin-1', role: UserRole.ORG_ADMIN, orgId: 'org-1' }, session)).toBe(true);
    expect(canManageSession({ id: 'admin-2', role: UserRole.ORG_ADMIN, orgId: 'org-2' }, session)).toBe(false);
    expect(canManageSession({ id: 'player-1', role: UserRole.PLAYER }, session)).toBe(false);
  });
});
