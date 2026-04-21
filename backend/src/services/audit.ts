// NIST SP 800-53 Rev 5:
// AU-2 (Event Logging)
// AU-3 (Content of Audit Records)
// AU-9 (Protection of Audit Information)

import { AuditAction, Prisma } from '@prisma/client';
import { prisma } from './db';
import { logger } from './logger';

interface AuditEntry {
  userId?: string;
  action: AuditAction;
  resource?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const data: Prisma.AuditLogCreateInput = {
      action: entry.action,
      resource: entry.resource,
      metadata: entry.metadata as Prisma.InputJsonValue | undefined,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      ...(entry.userId ? { user: { connect: { id: entry.userId } } } : {}),
    };
    await prisma.auditLog.create({ data });
  } catch (err) {
    // Audit log write failure must be logged but never crash the app
    logger.error('AUDIT LOG WRITE FAILURE', { error: err, entry });
  }
}
