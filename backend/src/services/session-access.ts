import { UserRole } from '@prisma/client';

export interface SessionAccessUser {
  id: string;
  role: UserRole;
  orgId?: string | null;
}

export interface SessionAccessTarget {
  facilitatorId: string;
  orgId?: string | null;
  players?: Array<{ userId: string }>;
}

export function canViewSession(user: SessionAccessUser, session: SessionAccessTarget): boolean {
  if (canManageSession(user, session)) return true;
  return Boolean(session.players?.some((player) => player.userId === user.id));
}

export function canManageSession(user: SessionAccessUser, session: SessionAccessTarget): boolean {
  if (user.role === UserRole.SUPER_ADMIN) return true;
  if (session.facilitatorId === user.id) return true;
  if (user.role === UserRole.ORG_ADMIN) {
    return Boolean(user.orgId && session.orgId && user.orgId === session.orgId);
  }
  return false;
}
