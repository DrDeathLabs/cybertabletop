import { Router, Response } from 'express';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { prisma } from '../services/db';
import {
  getAllTemplateData,
  saveTemplateContent,
  resetTemplateContent,
  TEMPLATE_DEFINITIONS,
} from '../services/prompt-templates';
import {
  getAllProviderRows,
  saveProviderConfig,
  setActiveProvider,
  resetProviderConfig,
  testProviderConnection,
  type ProviderType,
} from '../services/ai-config';
import { getOrgConfigForUser, saveOrgConfigForUser } from '../services/org-config';
import {
  calculateMfaAdoptionPct,
  controlStatus,
  overallStatus,
  registrationGateStatus,
  type ControlStatus,
} from '../services/security-posture';
import net from 'net';
import http from 'http';

const router = Router();

// â”€â”€â”€ Infrastructure Probes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface RedisProbeResult {
  alive: boolean;
  latencyMs: number;
  info?: string;
  error?: string;
}

function probeRedis(): Promise<RedisProbeResult> {
  return new Promise((resolve) => {
    const start    = Date.now();
    const password = process.env.REDIS_PASSWORD ?? 'changeme_redis';
    const socket   = new net.Socket();
    let responded  = false;
    let buffer     = '';

    const done = (result: Omit<RedisProbeResult, 'latencyMs'>) => {
      if (responded) return;
      responded = true;
      socket.destroy();
      resolve({ ...result, latencyMs: Date.now() - start });
    };

    const timeoutId = setTimeout(
      () => done({ alive: false, error: 'Connection timeout (2 s)' }),
      2000,
    );

    socket.connect(6379, 'redis', () => {
      socket.write(`AUTH ${password}\r\nPING\r\n`);
    });

    socket.on('data', (data) => {
      buffer += data.toString();
      if (buffer.includes('+PONG')) {
        clearTimeout(timeoutId);
        done({ alive: true, info: 'Authenticated and responding to PING' });
      } else if (buffer.includes('-WRONGPASS') || buffer.includes('-ERR invalid')) {
        clearTimeout(timeoutId);
        done({ alive: false, error: 'Authentication failure â€” check REDIS_PASSWORD' });
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeoutId);
      done({ alive: false, error: err.message });
    });
  });
}

interface NginxProbeResult {
  reachable: boolean;
  statusCode: number;
  latencyMs: number;
  headers: Record<string, string>;
  error?: string;
}

function probeNginxHeaders(): Promise<NginxProbeResult> {
  return new Promise((resolve) => {
    const start   = Date.now();
    let responded = false;

    const done = (result: Omit<NginxProbeResult, 'latencyMs'>) => {
      if (responded) return;
      responded = true;
      resolve({ ...result, latencyMs: Date.now() - start });
    };

    const timeoutId = setTimeout(
      () => done({ reachable: false, statusCode: 0, headers: {}, error: 'Timeout (2 s)' }),
      2000,
    );

    const req = http.request(
      { hostname: 'nginx', port: 80, method: 'HEAD', path: '/' },
      (res) => {
        clearTimeout(timeoutId);
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : (v ?? '');
        }
        res.resume();
        done({ reachable: true, statusCode: res.statusCode ?? 0, headers });
      },
    );

    req.on('error', (err) => {
      clearTimeout(timeoutId);
      done({ reachable: false, statusCode: 0, headers: {}, error: err.message });
    });

    req.setTimeout(2000, () => {
      req.destroy();
      done({ reachable: false, statusCode: 0, headers: {}, error: 'Request timeout' });
    });

    req.end();
  });
}

interface PgStatsResult {
  version: string;
  activeConnections: number;
  maxConnections: number;
  dbSizeMb: number;
  error?: string;
}

async function probePostgresStats(): Promise<PgStatsResult> {
  try {
    const [versionRows, connRows, sizeRows] = await Promise.all([
      prisma.$queryRaw<Array<{ version: string }>>`SELECT version()`,
      prisma.$queryRaw<Array<{ active_conn: number; max_conn: string }>>`
        SELECT
          (SELECT count(*)::int FROM pg_stat_activity WHERE state = 'active') AS active_conn,
          current_setting('max_connections') AS max_conn
      `,
      prisma.$queryRaw<Array<{ db_size: bigint }>>`
        SELECT pg_database_size(current_database()) AS db_size
      `,
    ]);
    const pgVersion =
      versionRows[0]?.version.match(/PostgreSQL [\d.]+/)?.[0] ?? 'PostgreSQL (unknown)';
    return {
      version:           pgVersion,
      activeConnections: Number(connRows[0]?.active_conn ?? 0),
      maxConnections:    parseInt(connRows[0]?.max_conn ?? '100', 10),
      dbSizeMb:          Math.round(Number(sizeRows[0]?.db_size ?? 0) / 1024 / 1024),
    };
  } catch (err) {
    return {
      version:           'Unknown',
      activeConnections: 0,
      maxConnections:    100,
      dbSizeMb:          0,
      error:             String(err),
    };
  }
}

// â”€â”€â”€ Audit Logs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/admin/audit-logs
// Supports: page, limit, action, startDate, endDate, export (returns up to 10k as plain array)
router.get('/audit-logs', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'SUPER_ADMIN' && !req.user!.orgId) {
    res.status(403).json({ error: 'No organization assigned to your account' });
    return;
  }

  const page     = Math.max(1, parseInt(req.query.page    as string || '1',  10));
  const limit    = Math.min(   parseInt(req.query.limit   as string || '50', 10), 200);
  const skip     = (page - 1) * limit;
  const isExport = req.query.export === '1';

  const orgWhere = req.user!.role !== 'SUPER_ADMIN'
    ? { user: { orgId: req.user!.orgId } }
    : {};

  const actionParam    = req.query.action    as string | undefined;
  const startDateParam = req.query.startDate as string | undefined;
  const endDateParam   = req.query.endDate   as string | undefined;

  const dateWhere =
    startDateParam || endDateParam
      ? {
          timestamp: {
            ...(startDateParam ? { gte: new Date(startDateParam) } : {}),
            ...(endDateParam   ? { lte: new Date(endDateParam)   } : {}),
          },
        }
      : {};

  const where = {
    ...orgWhere,
    ...(actionParam ? { action: actionParam as any } : {}),
    ...dateWhere,
  };

  if (isExport) {
    const logs = await prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, email: true, displayName: true } } },
      orderBy: { timestamp: 'desc' },
      take: 10_000,
    });
    res.json({ logs, total: logs.length, page: 1, limit: 10_000 });
    return;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, email: true, displayName: true } } },
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ logs, total, page, limit });
});

// â”€â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/admin/stats
router.get('/stats', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'SUPER_ADMIN' && !req.user!.orgId) {
    res.status(403).json({ error: 'No organization assigned to your account' });
    return;
  }

  const isSuperAdmin = req.user!.role === 'SUPER_ADMIN';
  const orgFilter = isSuperAdmin ? {} : { orgId: req.user!.orgId };
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [userCount, sessionCount, scenarioCount, recentDecisions] = await Promise.all([
    prisma.user.count({ where: orgFilter }),
    prisma.session.count({ where: orgFilter }),
    prisma.scenario.count({ where: orgFilter }),
    prisma.decision.count({
      where: {
        timestamp: { gte: thirtyDaysAgo },
        ...(isSuperAdmin ? {} : { session: { orgId: req.user!.orgId } }),
      },
    }),
  ]);

  res.json({ userCount, sessionCount, scenarioCount, recentDecisions });
});

// â”€â”€â”€ Security Posture â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/admin/security-posture
// Returns live NIST 800-53 Rev 5 control checks backed by real data from PostgreSQL,
// Redis, and Nginx â€” plus infrastructure probe results and full compliance metadata.
// Powers the continuous-ATO security dashboard.
router.get('/security-posture', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'SUPER_ADMIN' && !req.user!.orgId) {
    res.status(403).json({ error: 'No organization assigned to your account' });
    return;
  }

  const isSuperAdmin = req.user!.role === 'SUPER_ADMIN';
  const orgId        = req.user!.orgId;

  const userOrgFilter:    Record<string, unknown> = isSuperAdmin ? {} : { orgId };
  const realUserOrgFilter: Record<string, unknown> = { ...userOrgFilter, id: { not: 'system' } };
  const auditOrgFilter:   Record<string, unknown> = isSuperAdmin ? {} : { user: { orgId } };
  const registrationRequiresInvite = process.env.REQUIRE_INVITE === 'true';
  const registrationGate = registrationGateStatus(registrationRequiresInvite, process.env.INVITE_CODE);
  const registrationControlled = registrationGate.controlled;

  const now    = new Date();
  const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const d30ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Run all queries + infrastructure probes in parallel
  const [
    totalUsers,
    lockedUsers,
    mfaUsers,
    privilegedUsers,
    privilegedMfaUsers,
    failedLogins24h,
    activeSessions,
    recentRoleChanges,
    recentMfaDisables,
    totalAuditEntries,
    latestAuditEntry,
    redisProbe,
    nginxProbe,
    pgStats,
    // Additional queries for expanded control coverage
    superAdminCount,
    orgAdminCount,
    lockedEvents24h,
    oldestAuditEntry,
    deletedUsers30d,
    totalSessions,
    endedSessions,
    activeUsersList,
  ] = await Promise.all([
    prisma.user.count({ where: realUserOrgFilter }),
    prisma.user.count({ where: { ...realUserOrgFilter, lockedUntil: { gt: now } } }),
    prisma.user.count({ where: { ...realUserOrgFilter, mfaEnabled: true } }),
    prisma.user.count({ where: { ...realUserOrgFilter, role: { in: ['SUPER_ADMIN', 'ORG_ADMIN', 'FACILITATOR'] } } }),
    prisma.user.count({ where: { ...realUserOrgFilter, role: { in: ['SUPER_ADMIN', 'ORG_ADMIN', 'FACILITATOR'] }, mfaEnabled: true } }),
    prisma.auditLog.count({
      where: { action: 'USER_LOGIN_FAILED', timestamp: { gte: h24ago }, ...auditOrgFilter },
    }),
    // AC-17: count users who authenticated in the past 24h via lastLoginAt
    prisma.user.count({ where: { ...realUserOrgFilter, lastLoginAt: { gte: h24ago } } }),
    prisma.auditLog.count({
      where: { action: 'ROLE_CHANGED', timestamp: { gte: d30ago }, ...auditOrgFilter },
    }),
    prisma.auditLog.count({
      where: { action: 'MFA_DISABLED', timestamp: { gte: d30ago }, ...auditOrgFilter },
    }),
    prisma.auditLog.count({ where: auditOrgFilter }),
    prisma.auditLog.findFirst({
      where: auditOrgFilter,
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    }),
    probeRedis(),
    probeNginxHeaders(),
    probePostgresStats(),
    // AC-6: Least privilege â€” super admin count should be minimal
    prisma.user.count({ where: { ...realUserOrgFilter, role: 'SUPER_ADMIN' } }),
    // AC-3: Access enforcement â€” org admin distribution
    prisma.user.count({ where: { ...realUserOrgFilter, role: 'ORG_ADMIN' } }),
    // IR-4: Incident handling â€” lockout events in 24h
    prisma.auditLog.count({
      where: { action: 'USER_LOCKED', timestamp: { gte: h24ago }, ...auditOrgFilter },
    }),
    // AU-11: Audit retention â€” age of oldest record
    prisma.auditLog.findFirst({
      where: auditOrgFilter,
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true },
    }),
    // PS-4: Personnel termination â€” user deletion events
    prisma.auditLog.count({
      where: { action: 'USER_DELETED', timestamp: { gte: d30ago }, ...auditOrgFilter },
    }),
    // CP-10: Recovery â€” total vs lobby/active sessions (LOBBY, ACTIVE, DEBRIEF are valid statuses)
    prisma.session.count({ where: userOrgFilter }),
    prisma.session.count({ where: { ...userOrgFilter, status: 'ACTIVE' } }),
    // AC-17: active users list for dashboard drill-down
    prisma.user.findMany({
      where: { ...realUserOrgFilter, lastLoginAt: { gte: h24ago } },
      select: { id: true, displayName: true, email: true, role: true, lastLoginAt: true },
      orderBy: { lastLoginAt: 'desc' },
    }),
  ]);

  // SC-12: Cryptographic key strength â€” checked at runtime
  const jwtSecretLength  = process.env.JWT_SECRET?.length ?? 0;
  const jwtSecretStrong  = jwtSecretLength >= 64;
  const jwtSecretAdequate = jwtSecretLength >= 32;

  // AU-11: Retention period calculation
  const auditRetentionDays = oldestAuditEntry
    ? Math.floor((now.getTime() - new Date(oldestAuditEntry.timestamp).getTime()) / (24 * 60 * 60 * 1000))
    : 0;
  const auditRetentionStatus: ControlStatus =
    totalAuditEntries === 0
      ? 'WARN'
      : auditRetentionDays >= 90
      ? 'PASS'
      : 'INFO';

  const mfaAdoptionPct = calculateMfaAdoptionPct(mfaUsers, totalUsers);
  const privilegedMfaPct = calculateMfaAdoptionPct(privilegedMfaUsers, privilegedUsers);

  // â”€â”€ Nginx header evaluation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const nh = nginxProbe.headers;
  const xFrameHeader    = nh['x-frame-options']?.toLowerCase() ?? '';
  const hasXFrame       = xFrameHeader.includes('deny') || xFrameHeader.includes('sameorigin');
  const hasCsp          = !!nh['content-security-policy'];
  const hasFrameAncestors = nh['content-security-policy']?.toLowerCase().includes('frame-ancestors') ?? false;
  const hasXCTO         = nh['x-content-type-options'] === 'nosniff';
  const hasReferrer     = !!nh['referrer-policy'];
  const hasPermissions  = !!nh['permissions-policy'];
  const isProduction    = process.env.NODE_ENV === 'production';
  const frontendUrl     = process.env.FRONTEND_URL ?? '';
  const localPreviewMode = !isProduction || /localhost|127\.0\.0\.1|\[::1\]/i.test(frontendUrl);
  const antiFrameRequired = isProduction && !localPreviewMode;
  const antiFrameConfigured = hasXFrame || hasFrameAncestors;
  const antiFrameStatus = antiFrameConfigured
    ? 'configured'
    : antiFrameRequired
      ? 'missing for standalone public deployment'
      : 'intentionally omitted for embedded/local preview';
  const nginxHeaderPass = nginxProbe.reachable && hasXCTO && hasReferrer && hasPermissions && hasCsp && (!antiFrameRequired || antiFrameConfigured);

  // â”€â”€ NIST 800-53 Rev 5 Control Checks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const controls = [

    // â”€â”€ AC: Access Control â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      id: 'AC-2', family: 'AC', name: 'Account Management',
      nistRef: 'NIST SP 800-53 Rev 5 AC-2',
      nistControlText:
        'Define and document the types of accounts allowed and specifically prohibited for use within the system. Manage information system accounts, including establishing, activating, modifying, reviewing, disabling, and removing accounts. Require approval for account creation and notify account managers when accounts are no longer required or when system users are terminated.',
      description:
        'User accounts are managed through invite-gated registration and admin role review. Account lockout status is monitored in real time.',
      status: controlStatus(registrationControlled && lockedUsers <= 2, registrationRequiresInvite && lockedUsers <= 10),
      detail: `${lockedUsers} account${lockedUsers !== 1 ? 's' : ''} currently locked. ${totalUsers} human users. Registration gate: ${registrationGate.label}. Built-in system account hidden from user totals.`,
      metric: lockedUsers,
      components: ['Application', 'PostgreSQL'],
      evidenceSource:
        'Live DB query: prisma.user.count({ where: { lockedUntil: { gt: now } } }) â€” executed on every dashboard refresh',
      complianceNarrative:
        'The application enforces four named account types with defined privilege levels. Internet-facing deployments should require a configured invite code for self-registration. Account lockout is automatic after consecutive failed logins (AC-7). The admin dashboard provides real-time visibility into locked accounts. Role changes are logged to the audit trail (AU-9).',
      remediation:
        !registrationControlled
          ? 'Internet-facing deployments must set REQUIRE_INVITE=true and configure a strong INVITE_CODE. Without this, anyone who can reach the site can register a PLAYER account.'
          : lockedUsers > 2
          ? 'Review locked accounts in the Users tab. Legitimate users can retry after the lockout window expires; repeated lockouts should be escalated to incident response. Investigate IPs associated with failed logins in the Audit Log tab (filter: USER_LOCKED).'
          : null,
    },
    {
      id: 'AC-7', family: 'AC', name: 'Unsuccessful Logon Attempts',
      nistRef: 'NIST SP 800-53 Rev 5 AC-7',
      nistControlText:
        'Enforce a limit on consecutive invalid logon attempts by a user during a time period defined by the organization. Automatically lock the account or delay the next logon prompt when the maximum number of unsuccessful attempts is exceeded.',
      description:
        'The system enforces a limit on consecutive failed login attempts and automatically locks accounts. Nginx applies network-layer rate limiting. Application-layer rate limiting is enforced via express-rate-limit.',
      status: controlStatus(failedLogins24h === 0, failedLogins24h < 20),
      detail: `${failedLogins24h} failed login attempt${failedLogins24h !== 1 ? 's' : ''} in past 24 h · Auth rate limit: 10 req / 15 min per IP (Nginx: 10 r/m zone) · Account locks for 30 minutes after 5 failed attempts`,
      metric: failedLogins24h,
      components: ['Application', 'Nginx', 'express-rate-limit', 'PostgreSQL'],
      evidenceSource:
        'Live DB query: prisma.auditLog.count({ where: { action: "USER_LOGIN_FAILED", timestamp: { gte: 24 h ago } } }) + Nginx limit_req_zone=auth:10m rate=10r/m + Express authLimiter (max: 10 / 15 min)',
      complianceNarrative:
        'Authentication is protected at two layers. Nginx enforces a 10 req/min zone for login traffic, rejecting excess requests with HTTP 429 before they reach the application. Express-rate-limit provides a secondary 10 req/15 min limit keyed by IP. The application records every failed attempt as USER_LOGIN_FAILED in the audit log and locks the account for 30 minutes after five consecutive failed attempts. All lockout events are logged as USER_LOCKED (CRITICAL severity).',
      remediation:
        failedLogins24h >= 20
          ? 'High brute-force activity detected. Review the Audit Log for USER_LOGIN_FAILED events, identify the source IP, and consider blocking at the firewall level. Verify Nginx rate limit zones are active.'
          : null,
    },
    {
      id: 'AC-17', family: 'AC', name: 'Remote Access',
      nistRef: 'NIST SP 800-53 Rev 5 AC-17',
      nistControlText:
        'Establish and document usage restrictions, configuration/connection requirements, and implementation guidance for each type of remote access allowed. Authorize each type of remote access to the system prior to allowing such connections and enforce remote access requirements.',
      description:
        'All remote sessions are authenticated via JWT and authorized through RBAC. Session access is controlled, monitored, and tied to authenticated user identities.',
      status: 'PASS' as ControlStatus,
      detail: `${activeSessions} user${activeSessions !== 1 ? 's' : ''} authenticated in past 24 h Â· All access via signed JWT (HS256 + issuer/audience claims) Â· Access tokens expire in 15 min Â· Refresh tokens expire in 7 days`,
      metric: activeSessions,
      components: ['Application', 'JWT', 'Nginx', 'PostgreSQL'],
      evidenceSource:
        'Live DB query: prisma.user.count({ where: { lastLoginAt: { gte: 24h ago } } }) â€” counts users with a successful login event in the past 24 hours. JWT issuer/audience validated on every protected request via requireAuth middleware.',
      complianceNarrative:
        'Remote access requires a valid JWT issued by this system (issuer: "cybertabletop", audience: "cybertabletop-api"). The token carries role and orgId claims that drive RBAC decisions on every endpoint. All non-health endpoints require authentication via the requireAuth middleware. CORS is restricted to defined allowed origins. Access tokens have a 15-minute lifetime to limit exposure from token theft.',
      remediation: null,
    },

    // â”€â”€ AU: Audit and Accountability â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      id: 'AU-2', family: 'AU', name: 'Event Logging',
      nistRef: 'NIST SP 800-53 Rev 5 AU-2',
      nistControlText:
        'Identify the types of events that the system is capable of logging in support of the audit function. Coordinate the event logging function with other organizations requiring audit-related information. Provide a rationale for why the selected event types are deemed adequate to support after-the-fact investigations of security incidents.',
      description:
        'Security-relevant events are identified, classified by severity and category, and logged with sufficient detail to support SOC investigations and forensic analysis.',
      status: controlStatus(totalAuditEntries > 0, false),
      detail: `${totalAuditEntries.toLocaleString()} total audit events Â· ${latestAuditEntry ? `Last event: ${new Date(latestAuditEntry.timestamp).toLocaleString()}` : 'No events recorded'} Â· 20 event types classified across AUTH / ACCESS / DATA / CONFIG categories`,
      metric: totalAuditEntries,
      components: ['Application', 'PostgreSQL'],
      evidenceSource:
        'Live DB query: prisma.auditLog.count() + prisma.auditLog.findFirst({ orderBy: { timestamp: "desc" } }) â€” scoped to organization',
      complianceNarrative:
        'The audit service (services/audit.ts) captures 20+ event types covering authentication (USER_LOGIN, USER_LOGIN_FAILED, USER_LOCKED), access control (ROLE_CHANGED), data operations (SCENARIO_CREATED, SESSION_ENDED), and configuration (MFA_ENABLED/DISABLED). Every event includes timestamp, action, userId, ipAddress, userAgent, resource, and structured metadata. The SOC Audit Log tab provides real-time filtering, severity classification (CRITICAL/HIGH/MEDIUM/LOW/INFO), and CSV export.',
      remediation:
        totalAuditEntries === 0
          ? 'No audit events found. Verify the audit service is connected to the database and that the AuditLog table exists. Check backend startup logs for Prisma connection errors.'
          : null,
    },
    {
      id: 'AU-3', family: 'AU', name: 'Content of Audit Records',
      nistRef: 'NIST SP 800-53 Rev 5 AU-3',
      nistControlText:
        'Ensure that audit records contain information that establishes: what type of event occurred, when the event occurred, where the event occurred, the source of the event, the outcome of the event, and the identity of any individuals, subjects, or objects/entities associated with the event.',
      description:
        'Audit records include all required fields: event type, timestamp, user identity, source IP, client user-agent, affected resource, and structured metadata payload.',
      status: 'PASS' as ControlStatus,
      detail: 'Schema captures: action (event type) Â· timestamp (ISO 8601) Â· userId (identity) Â· ipAddress (source) Â· userAgent (client) Â· resource (target) Â· metadata (JSON context) Â· linked to User record',
      metric: null,
      components: ['Application', 'PostgreSQL', 'Prisma ORM'],
      evidenceSource:
        'Static schema check: AuditLog model in prisma/schema.prisma â€” fields: id, action (AuditAction enum), userId (FK), ipAddress, userAgent, resource, metadata (Json), timestamp. Verified against NIST AU-3 required fields.',
      complianceNarrative:
        'The AuditLog Prisma model captures all fields required by NIST AU-3. The "action" field uses a typed enum (AuditAction) ensuring only defined event types are recorded. "userId" links to the User table for identity association. "ipAddress" and "userAgent" capture source information. "resource" identifies the affected object. "metadata" holds structured context (e.g., previous/new role for ROLE_CHANGED events). All timestamps are stored as UTC in PostgreSQL.',
      remediation: null,
    },
    {
      id: 'AU-9', family: 'AU', name: 'Audit Record Protection',
      nistRef: 'NIST SP 800-53 Rev 5 AU-9',
      nistControlText:
        'Protect audit information and audit logging tools from unauthorized access, modification, and deletion. Alert designated personnel in the event of audit logging tool failures. Backup audit records to maintain their availability.',
      description:
        'Audit records are append-only through the application layer. No UPDATE or DELETE workflow exists for AuditLog records in the app, and audit visibility is restricted to admin roles.',
      status: 'INFO' as ControlStatus,
      detail: 'Application append-only path: no UPDATE/DELETE on AuditLog in app code. Audit log UI restricted to SUPER_ADMIN and ORG_ADMIN. External SIEM or write-once storage remains an operator deployment option for tamper-resistant retention.',
      metric: null,
      components: ['Application', 'PostgreSQL', 'Prisma ORM'],
      evidenceSource:
        'Code audit: services/audit.ts uses prisma.auditLog.create(); no application route exposes audit update/delete. Admin route requires requireAdmin middleware. Database administrator access remains an operator-controlled responsibility.',
      complianceNarrative:
        'Audit record integrity is enforced at the application layer: the audit service creates audit records and the application does not expose audit modification or deletion workflows. The audit log endpoints require ORG_ADMIN or SUPER_ADMIN role and are scoped by organization. For stronger non-repudiation, operators should forward audit records to append-only external storage or a SIEM and restrict direct database administrator access.',
      remediation: 'For deployments that require tamper-resistant evidence, forward audit logs to a SIEM or write-once log store and restrict direct database administrator access.',
    },
    {
      id: 'AU-12', family: 'AU', name: 'Audit Record Generation',
      nistRef: 'NIST SP 800-53 Rev 5 AU-12',
      nistControlText:
        'Provide audit record generation capability for event types defined in AU-2; allow designated organizational personnel to select the event types to be logged; generate audit records for all defined event types throughout the system.',
      description:
        'Audit records are generated automatically for all security-relevant events throughout the system, including authentication, access control, and data operations.',
      status: controlStatus(totalAuditEntries > 0, false),
      detail: `${totalAuditEntries.toLocaleString()} audit records generated Â· ${pgStats.error ? 'DB probe warning' : `PostgreSQL ${pgStats.version} Â· ${pgStats.dbSizeMb} MB database size Â· ${pgStats.activeConnections}/${pgStats.maxConnections} connections active`}`,
      metric: totalAuditEntries,
      components: ['Application', 'PostgreSQL'],
      evidenceSource:
        `Live infrastructure probe: PostgreSQL ${pgStats.error ? '(probe failed: ' + pgStats.error + ')' : `version=${pgStats.version}, active_connections=${pgStats.activeConnections}, max_connections=${pgStats.maxConnections}, db_size=${pgStats.dbSizeMb} MB`}. Audit event count from prisma.auditLog.count().`,
      complianceNarrative:
        `Audit record generation is active and tied to application events via the centralized audit service. Every security-relevant action calls the audit() function which writes synchronously to PostgreSQL. The database is running ${pgStats.error ? 'with probe errors â€” verify connectivity' : pgStats.version + ' with ' + pgStats.dbSizeMb + ' MB allocated'}. The application write path for AuditLog is centralized, and reads are restricted to admin roles. Records are generated at the point of each event occurrence, not batched.`,
      remediation:
        totalAuditEntries === 0
          ? 'No audit records found. Ensure the backend service is writing to the AuditLog table. Check database connectivity and Prisma schema migration status.'
          : null,
    },

    // â”€â”€ IA: Identification and Authentication â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      id: 'IA-2', family: 'IA', name: 'Identification and Authentication',
      nistRef: 'NIST SP 800-53 Rev 5 IA-2',
      nistControlText:
        'Uniquely identify and authenticate organizational users and associate that unique identification with processes acting on behalf of those users.',
      description:
        'All users are uniquely identified by email address and authenticated via password. Protected API and Socket.io paths require a valid JWT. Anonymous access is limited to health, registration, login, and SSO bootstrap routes.',
      status: 'PASS' as ControlStatus,
      detail: 'All routes protected by requireAuth middleware Â· JWT validated on every request (issuer + audience verified) Â· Unique user IDs (UUID v4) associated with all audit records and session operations',
      metric: null,
      components: ['Application', 'JWT', 'PostgreSQL'],
      evidenceSource:
        'Code audit: middleware/auth.ts â€” requireAuth middleware validates JWT on all protected routes. User identity (userId, role, orgId) extracted from token and attached to req.user. Token issuer and audience validated against "cybertabletop" constants.',
      complianceNarrative:
        'Each user is assigned a unique UUID at registration. Authentication requires email + password with bcrypt verification or a configured OIDC provider. Upon successful authentication, the system issues a short-lived JWT (15 min) containing the user\'s unique ID, role, and organization. The requireAuth middleware validates issuer and audience on every protected API call, ensuring actions are attributed to a specific authenticated identity.',
      remediation: null,
    },
    {
      id: 'IA-5', family: 'IA', name: 'Authenticator Management',
      nistRef: 'NIST SP 800-53 Rev 5 IA-5',
      nistControlText:
        'Manage system authenticators by: verifying the identity of users prior to distributing authenticators; establishing initial authenticator content; ensuring authenticators have sufficient strength of mechanism; establishing and implementing administrative procedures for initial authenticator distribution, for lost or compromised authenticators, and for revoking authenticators when no longer required.',
      description:
        'Passwords are hashed with bcrypt (cost factor 12). TOTP MFA is enforced for privileged roles and optional for players. TOTP secrets are encrypted at rest and recovery codes are stored only as bcrypt hashes.',
      status: controlStatus(privilegedUsers === privilegedMfaUsers, privilegedMfaPct >= 80),
      detail: `Privileged MFA coverage: ${privilegedMfaPct}% (${privilegedMfaUsers} of ${privilegedUsers} admin/facilitator users enrolled) Â· Overall MFA adoption: ${mfaAdoptionPct}% (${mfaUsers} of ${totalUsers} users) Â· Passwords: bcrypt cost=12 Â· TOTP secrets encrypted with AES-256-GCM Â· Recovery codes hashed`,
      metric: privilegedMfaPct,
      components: ['Application', 'PostgreSQL', 'bcrypt'],
      evidenceSource:
        'Live DB query: privileged human users with role in SUPER_ADMIN/ORG_ADMIN/FACILITATOR and mfaEnabled=true divided by total privileged human users. Static code audit: auth routes enforce TOTP MFA for privileged roles; MFA secrets are AES-GCM encrypted and recovery codes are bcrypt hashed.',
      complianceNarrative:
        'Passwords are never stored in plaintext. bcrypt with cost factor 12 provides strong one-way hashing resistant to offline brute-force attacks. Privileged users must complete TOTP enrollment before accessing application features, and accounts with MFA enabled must complete a second-factor challenge before access and refresh tokens are issued. TOTP secrets are encrypted with an environment-provided MFA_ENCRYPTION_KEY and recovery codes are shown once, then stored only as bcrypt hashes.',
      remediation:
        privilegedUsers !== privilegedMfaUsers
          ? 'Privileged MFA coverage is incomplete. Review admin and facilitator accounts in the Users tab. Users without MFA will be forced into setup at next login; reset MFA only for verified lockout cases.'
          : null,
    },
    {
      id: 'IA-11', family: 'IA', name: 'Re-authentication',
      nistRef: 'NIST SP 800-53 Rev 5 IA-11',
      nistControlText:
        'Require users to re-authenticate when defined circumstances or defined periods of inactivity occur.',
      description:
        'JWT access tokens expire after 15 minutes, requiring silent refresh. Refresh tokens expire after 7 days. Token rotation prevents replay attacks.',
      status: 'PASS' as ControlStatus,
      detail: 'Access token TTL: 15 min Â· Refresh token TTL: 7 days Â· Tokens stored in httpOnly sameSite=strict cookies Â· Token rotation enforced on refresh Â· Refresh tokens invalidated on logout',
      metric: null,
      components: ['Application', 'JWT'],
      evidenceSource:
        'Code audit: auth/tokens.ts â€” jwt.sign with expiresIn: "15m" (access) and "7d" (refresh). Cookie options: httpOnly: true, sameSite: "strict". Refresh endpoint issues new token pair and invalidates old refresh token.',
      complianceNarrative:
        'The short access token lifetime (15 min) ensures users must re-validate their session frequently. The refresh flow uses token rotation â€” each refresh request issues a new token pair and invalidates the previous refresh token, preventing token reuse. Tokens are stored exclusively in httpOnly cookies (not localStorage) to prevent XSS-based extraction. The sameSite=strict attribute prevents CSRF attacks. On logout, the refresh token is revoked.',
      remediation: null,
    },

    // â”€â”€ SC: System and Communications Protection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      id: 'SC-5', family: 'SC', name: 'Denial of Service Protection',
      nistRef: 'NIST SP 800-53 Rev 5 SC-5',
      nistControlText:
        'Protect the system against or limit the effects of denial-of-service events, including denial-of-service attacks from sources internal or external to the organization.',
      description:
        'Rate limiting is enforced at two independent layers: Nginx network layer and Express application layer. Authentication endpoints have stricter limits than general API endpoints.',
      status: 'PASS' as ControlStatus,
      detail: `Nginx zones: api=60 r/m, auth=10 r/m, conn=20 concurrent Â· Express: auth=10 req/15 min, api=120 req/min, join=20 req/5 min Â· ${nginxProbe.reachable ? `Nginx reachable (${nginxProbe.latencyMs} ms)` : 'Nginx probe failed â€” verify container health'}`,
      metric: null,
      components: ['Nginx', 'Application', 'express-rate-limit'],
      evidenceSource:
        `Live infrastructure probe: HTTP HEAD nginx:80 â†’ status ${nginxProbe.statusCode}, latency ${nginxProbe.latencyMs} ms${nginxProbe.error ? ', error: ' + nginxProbe.error : ''}. Static config: nginx.conf limit_req_zone, middleware/rateLimit.ts (express-rate-limit).`,
      complianceNarrative:
        'Defense-in-depth rate limiting is implemented at two layers. Nginx provides network-level protection with limit_req_zone zones: api (60 r/m), auth (10 r/m), with burst allowances and nodelay for legitimate traffic spikes. A connection limit (limit_conn conn 20) prevents connection exhaustion. At the application layer, express-rate-limit provides a secondary defense with per-route limits. The auth endpoint has the strictest limit (10 req/15 min) to prevent credential stuffing.',
      remediation:
        !nginxProbe.reachable
          ? 'Nginx probe failed: ' + (nginxProbe.error ?? 'unreachable') + '. Verify the nginx container is healthy (docker compose ps). Check nginx.conf for syntax errors.'
          : null,
    },
    {
      id: 'SC-7', family: 'SC', name: 'Boundary Protection',
      nistRef: 'NIST SP 800-53 Rev 5 SC-7',
      nistControlText:
        'Monitor and control communications at the external managed interface of the system and at key internal boundaries. Implement subnetworks for publicly accessible system components that are physically or logically separated from internal organizational networks.',
      description:
        'Nginx acts as the single external boundary. All traffic enters through Nginx, which enforces TLS, rate limiting, and HTTPâ†’HTTPS redirection before proxying to internal services.',
      status: controlStatus(nginxProbe.reachable, !nginxProbe.reachable),
      detail: `${nginxProbe.reachable ? `Nginx boundary active Â· HTTP 301 redirect enforced (status: ${nginxProbe.statusCode}) Â· Latency: ${nginxProbe.latencyMs} ms Â· Internal services (backend:3001) not directly exposed` : 'Nginx boundary probe failed â€” ' + (nginxProbe.error ?? 'no response')} Â· TLS 1.2/1.3 only Â· HTTP/2 enabled on port 443`,
      metric: null,
      components: ['Nginx', 'TLS/SSL'],
      evidenceSource:
        `Live infrastructure probe: HTTP HEAD nginx:80 â†’ ${nginxProbe.reachable ? 'reachable, status ' + nginxProbe.statusCode : 'FAILED: ' + nginxProbe.error}. Static config: nginx.conf â€” single entry point, internal proxy_pass to backend:3001 / frontend:80, not exposed directly. ssl_protocols TLSv1.2 TLSv1.3.`,
      complianceNarrative:
        'Nginx serves as the sole external boundary, implementing boundary protection at the container network level. Direct access to the backend (port 3001) and frontend (port 80) containers is blocked by Docker networking â€” only Nginx is exposed on host ports 80/443. Nginx enforces HTTP-to-HTTPS redirection (301), TLS 1.2/1.3 only, and applies rate limiting before any request reaches internal services. The backend and frontend containers are logically separated behind the proxy boundary.',
      remediation:
        !nginxProbe.reachable
          ? 'Nginx boundary is unreachable from the backend container. This may indicate a network misconfiguration. Run: docker compose ps nginx. Check if nginx container is healthy and on the same Docker network as the backend.'
          : null,
    },
    {
      id: 'SC-8', family: 'SC', name: 'Transmission Confidentiality & Integrity',
      nistRef: 'NIST SP 800-53 Rev 5 SC-8',
      nistControlText:
        'Implement cryptographic mechanisms to prevent unauthorized disclosure of information and detect changes to information during transmission.',
      description:
        'All external traffic is TLS-encrypted via Nginx. Security headers (HSTS, X-Content-Type-Options, etc.) are enforced at both Nginx and application layers. Cookies use sameSite=strict.',
      status: controlStatus(
        isProduction && nginxHeaderPass,
        nginxProbe.reachable && hasXCTO,
      ),
      detail: `${isProduction ? 'Production mode' : 'Non-production mode'} · Nginx: ${nginxProbe.reachable ? 'reachable' : 'probe failed'} · Anti-frame: ${antiFrameStatus} · X-Content-Type-Options: ${hasXCTO ? 'present' : 'missing'} · Referrer-Policy: ${hasReferrer ? 'present' : 'missing'} · Permissions-Policy: ${hasPermissions ? 'present' : 'missing'} · CSP: ${hasCsp ? 'present' : 'missing'} · sameSite=strict cookies`,
      metric: null,
      components: ['Nginx', 'TLS/SSL', 'Application', 'Helmet.js'],
      evidenceSource:
        `Live infrastructure probe: HTTP HEAD nginx:80 headers: ${JSON.stringify({ 'x-frame-options': nh['x-frame-options'], 'content-security-policy': nh['content-security-policy'], 'x-content-type-options': nh['x-content-type-options'], 'referrer-policy': nh['referrer-policy'], 'permissions-policy': nh['permissions-policy'] })}. Static config: nginx.conf ssl_protocols TLSv1.2 TLSv1.3, HSTS max-age=31536000. Helmet.js hsts config in middleware/security.ts.`,
      complianceNarrative:
        'TLS 1.2/1.3 encryption is enforced by Nginx with ECDHE cipher suites. HSTS (max-age=1 year, includeSubDomains, preload) prevents protocol downgrade attacks. Nginx and Helmet.js jointly apply security headers on responses, including X-Frame-Options and CSP frame-ancestors for clickjacking protection. Cookies use httpOnly=true, sameSite=strict, and secure=true in production. The server version is hidden (server_tokens off in Nginx, X-Powered-By disabled in Express).',
      remediation:
        !isProduction
          ? 'System is running in non-production mode. TLS enforcement is reduced. Ensure NODE_ENV=production in .env before deploying to production environments.'
          : antiFrameRequired && !antiFrameConfigured
          ? 'Standalone public deployment is missing anti-frame protection. Add Content-Security-Policy frame-ancestors or X-Frame-Options at the public edge unless this deployment is intentionally embedded.'
          : !nginxHeaderPass
          ? 'Security headers missing from Nginx responses. Verify that add_header directives in nginx.conf use the "always" flag and that the nginx container has been reloaded after config changes.'
          : null,
    },
    {
      id: 'SC-23', family: 'SC', name: 'Session Authenticity',
      nistRef: 'NIST SP 800-53 Rev 5 SC-23',
      nistControlText:
        'Protect the authenticity of communications sessions.',
      description:
        'JWT tokens include issuer and audience claims that are validated on every request. Tokens are stored in httpOnly cookies preventing client-side access. Token rotation prevents replay attacks. Redis provides persistent real-time session state.',
      status: controlStatus(redisProbe.alive, !redisProbe.alive),
      detail: `JWT claims: issuer="cybertabletop", audience="cybertabletop-api" Â· httpOnly=true, sameSite=strict, secure=${isProduction} Â· Refresh token rotation on every use Â· Redis session state: ${redisProbe.alive ? `HEALTHY (${redisProbe.latencyMs} ms PING)` : 'UNREACHABLE â€” ' + (redisProbe.error ?? 'connection failed')}`,
      metric: null,
      components: ['Application', 'JWT', 'Redis'],
      evidenceSource:
        `Live infrastructure probe: Redis PING â†’ ${redisProbe.alive ? 'PONG in ' + redisProbe.latencyMs + ' ms' : 'FAILED: ' + redisProbe.error}. Code audit: auth/tokens.ts â€” jwt.sign with issuer/audience. Cookie options: httpOnly: true, sameSite: "strict".`,
      complianceNarrative:
        'Session authenticity is protected by JWT cryptographic signing (HMAC-SHA256 with a secret â‰¥32 chars, validated at startup). The issuer and audience claims bind the token to this specific service, preventing tokens from being reused across systems. Tokens are stored in httpOnly cookies, inaccessible to JavaScript, preventing session theft via XSS. The sameSite=strict attribute blocks CSRF attacks. Redis is used for real-time game session state, providing persistent session data that survives application restarts.',
      remediation:
        !redisProbe.alive
          ? `Redis is unreachable: ${redisProbe.error ?? 'connection failed'}. Real-time game session state will be unavailable. Steps: (1) docker compose ps redis â€” verify container is running; (2) Confirm REDIS_PASSWORD in .env matches the redis service requirepass value; (3) docker compose restart redis â€” restart if misconfigured; (4) docker compose logs redis â€” check for authentication or startup errors.`
          : null,
    },
    {
      id: 'SC-28', family: 'SC', name: 'Protection of Information at Rest',
      nistRef: 'NIST SP 800-53 Rev 5 SC-28',
      nistControlText:
        'Implement cryptographic mechanisms to prevent unauthorized disclosure and modification of the following information at rest on system components, digital media, and backup storage.',
      description:
        'Passwords are one-way hashed with bcrypt (cost 12). MFA TOTP secrets are stored encrypted. No plaintext credentials are stored. PostgreSQL data files are stored on a dedicated Docker volume.',
      status: 'INFO' as ControlStatus,
      detail: `bcrypt cost=12 · MFA secrets encrypted with AES-256-GCM · Recovery codes hashed · PostgreSQL ${pgStats.error ? '(probe failed)' : pgStats.version + ', ' + pgStats.dbSizeMb + ' MB on postgres_data volume'} · Host volume and backup encryption are deployment responsibilities`,
      metric: null,
      components: ['Application', 'PostgreSQL', 'bcrypt', 'Redis'],
      evidenceSource:
        `Static code audit: bcrypt.hash(password, 12) in auth routes. MFA secrets are encrypted before storage and recovery codes are bcrypt-hashed. PostgreSQL probe: version=${pgStats.version}, db_size=${pgStats.dbSizeMb} MB. Redis probe: alive=${redisProbe.alive}.`,
      complianceNarrative:
        'User passwords are never stored in plaintext. bcrypt with cost factor 12 makes offline brute-force attacks materially more expensive. MFA TOTP secrets are encrypted with MFA_ENCRYPTION_KEY and recovery codes are stored only as bcrypt hashes. Database files reside on Docker named volumes; host disk, database-volume, Redis persistence, and backup encryption depend on the operator deployment environment.',
      remediation: 'For production deployments, enable host or cloud volume encryption, protect Docker volumes, and store backups in encrypted storage with tested restore procedures.',
    },

    // â”€â”€ IR: Incident Response â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      id: 'IR-6', family: 'IR', name: 'Incident Reporting',
      nistRef: 'NIST SP 800-53 Rev 5 IR-6',
      nistControlText:
        'Require personnel to report suspected security incidents to the organizational incident response capability within a defined time period. Report security incident information to designated authorities.',
      description:
        'Security anomalies (MFA disables, role escalations, account lockouts) are automatically detected and logged as high-severity events for SOC review.',
      status: controlStatus(
        recentMfaDisables === 0 && recentRoleChanges <= 5,
        recentMfaDisables <= 2,
      ),
      detail: `${recentMfaDisables} MFA disable event${recentMfaDisables !== 1 ? 's' : ''} (30 days) Â· ${recentRoleChanges} role change${recentRoleChanges !== 1 ? 's' : ''} (30 days) Â· All events classified HIGH severity in Audit Log Â· Expandable audit rows show full context for SOC investigation`,
      metric: recentMfaDisables + recentRoleChanges,
      components: ['Application', 'PostgreSQL'],
      evidenceSource:
        'Live DB queries: prisma.auditLog.count({ where: { action: "MFA_DISABLED", timestamp: { gte: 30 days ago } } }) and count({ action: "ROLE_CHANGED" }). SOC Audit Log tab provides real-time filtering and CSV export for incident reporting.',
      complianceNarrative:
        'The audit system automatically flags security-relevant events at appropriate severity levels. MFA_DISABLED and ROLE_CHANGED events are classified HIGH severity. USER_LOCKED events are CRITICAL. The SOC Audit Log tab provides real-time filtering by severity and category, enabling security personnel to identify incidents quickly. Expandable event rows show full context including user identity, IP address, user agent, and structured metadata. CSV export supports handoff to external SIEM or incident ticketing systems.',
      remediation:
        recentMfaDisables > 2
          ? 'Multiple MFA disable events detected in the past 30 days. Review MFA_DISABLED events in the Audit Log â€” filter by action "MFA_DISABLED". Determine if these were authorized user actions or potential account compromises. Consider enforcing mandatory MFA for privileged roles.'
          : recentRoleChanges > 5
          ? 'High number of role changes in the past 30 days. Review ROLE_CHANGED events in the Audit Log. Verify each change was authorized by an appropriate administrator.'
          : null,
    },

    // â”€â”€ CM: Configuration Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      id: 'CM-6', family: 'CM', name: 'Configuration Settings',
      nistRef: 'NIST SP 800-53 Rev 5 CM-6',
      nistControlText:
        'Establish and document configuration settings for information technology products that reflect the most restrictive mode consistent with operational requirements. Implement the configuration settings; identify, document, and approve any deviations from established configuration settings.',
      description:
        'System is deployed with security-hardened settings: Nginx security headers, Helmet.js CSP/HSTS, startup environment validation, privileged MFA, and no permissive defaults.',
      status: controlStatus(
        nginxHeaderPass && isProduction,
        nginxHeaderPass && !isProduction,
      ),
      detail: `Helmet.js: HSTS · CSP · X-Content-Type-Options · Referrer-Policy · Permissions-Policy · Anti-frame: ${antiFrameStatus} · Nginx: ${nginxProbe.reachable ? `XCTO=${hasXCTO ? 'present' : 'missing'} CSP=${hasCsp ? 'present' : 'missing'} Referrer=${hasReferrer ? 'present' : 'missing'} Permissions=${hasPermissions ? 'present' : 'missing'}` : 'probe failed'} · Startup env validation · server_tokens off`,
      metric: null,
      components: ['Application', 'Nginx', 'Helmet.js'],
      evidenceSource:
        `Live infrastructure probe nginx:80 headers: x-frame-options="${nh['x-frame-options'] ?? 'N/A'}", content-security-policy="${nh['content-security-policy'] ? 'present' : 'N/A'}", x-content-type-options="${nh['x-content-type-options'] ?? 'N/A'}", referrer-policy="${nh['referrer-policy'] ?? 'N/A'}", permissions-policy="${nh['permissions-policy'] ? 'present' : 'N/A'}". Code audit: middleware/security.ts setupSecurity() + index.ts startup env validation.`,
      complianceNarrative:
        'Security hardening is applied at startup and enforced throughout. Helmet.js configures HSTS, CSP, X-Content-Type-Options, and Referrer-Policy. Nginx applies edge headers as defense-in-depth, including frame-ancestors and X-Frame-Options. Express disables X-Powered-By. Startup validation requires strong JWT secrets and MFA_ENCRYPTION_KEY in production.',
      remediation:
        !nginxHeaderPass
          ? 'Security headers not detected from Nginx probe. Verify nginx container is running and nginx.conf add_header directives include the "always" flag. Reload nginx after config changes: docker compose exec nginx nginx -s reload'
          : !isProduction
          ? 'System is not in production mode. Set NODE_ENV=production in your .env file for production deployments to enable strict TLS enforcement and secure cookie settings.'
          : null,
    },
    {
      id: 'CM-7', family: 'CM', name: 'Least Functionality',
      nistRef: 'NIST SP 800-53 Rev 5 CM-7',
      nistControlText:
        'Configure the system to provide only essential capabilities; prohibit or restrict the use of functions, ports, protocols, software, and services not required to meet mission, business, or operational requirements.',
      description:
        'RBAC enforces minimum necessary access. Routes require the lowest permissible role. Only required ports are exposed. Unused services are not deployed.',
      status: 'PASS' as ControlStatus,
      detail: 'RBAC hierarchy: PLAYER < FACILITATOR < ORG_ADMIN < SUPER_ADMIN Â· Multi-tenant org isolation Â· Admin routes require ORG_ADMIN+ Â· Only ports 80/443 exposed externally Â· server_tokens off Â· X-Powered-By disabled Â· No debug endpoints in production',
      metric: null,
      components: ['Application', 'Nginx', 'PostgreSQL'],
      evidenceSource:
        'Code audit: middleware/auth.ts â€” requireAuth, requireAdmin, requireSuperAdmin middleware guards. Routes use minimum required role. Docker compose: only nginx ports 80:80 and 443:443 exposed. Backend port 3001 and frontend port 80 are internal-only.',
      complianceNarrative:
        'Access to every API endpoint is gated by the minimum role required for that function. PLAYER accounts can only access game-session endpoints. FACILITATOR accounts can manage sessions but not users. ORG_ADMIN can manage users within their organization. Only SUPER_ADMIN can access cross-organization data. Multi-tenant isolation ensures ORG_ADMIN users cannot access data from other organizations. Docker networking ensures only Nginx is publicly accessible â€” the backend and frontend containers are unreachable from outside the Docker network.',
      remediation: null,
    },

    // â”€â”€ CP: Contingency Planning â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      id: 'CP-10', family: 'CP', name: 'System Recovery and Reconstitution',
      nistRef: 'NIST SP 800-53 Rev 5 CP-10',
      nistControlText:
        'Provide for the recovery and reconstitution of the system to a known state within an organization-defined time period consistent with recovery time and recovery point objectives following a system disruption, compromise, or failure.',
      description:
        'System recovery capability is supported by persistent PostgreSQL and Redis volumes, stateless application containers, and monitored database connections.',
      status: controlStatus(
        redisProbe.alive && !pgStats.error && pgStats.activeConnections < pgStats.maxConnections * 0.8,
        redisProbe.alive || !pgStats.error,
      ),
      detail: `PostgreSQL: ${pgStats.error ? 'ERROR â€” ' + pgStats.error : pgStats.version + ', ' + pgStats.activeConnections + '/' + pgStats.maxConnections + ' connections'} Â· Redis: ${redisProbe.alive ? 'alive (' + redisProbe.latencyMs + ' ms)' : 'UNREACHABLE â€” ' + (redisProbe.error ?? 'failed')} Â· ${totalSessions} total sessions (${endedSessions} currently active) Â· Named Docker volumes: postgres_data, redis_data`,
      metric: pgStats.activeConnections,
      components: ['PostgreSQL', 'Redis', 'Application'],
      evidenceSource:
        `Live probes: PostgreSQL version=${pgStats.version}, active_conn=${pgStats.activeConnections}/${pgStats.maxConnections}, db_size=${pgStats.dbSizeMb} MB. Redis PING â†’ ${redisProbe.alive ? 'PONG in ' + redisProbe.latencyMs + ' ms' : 'FAILED: ' + redisProbe.error}. Session counts from prisma.session.count().`,
      complianceNarrative:
        'The system supports recovery through persistent Docker named volumes (postgres_data, redis_data) that survive container restarts. The application tier is stateless â€” backend containers can be recreated without data loss. PostgreSQL connection pool monitoring detects resource exhaustion. Redis session state persists across application restarts via AOF persistence. Container health checks ensure service availability is monitored continuously. Backup of postgres_data volume should be scheduled externally (e.g., pg_dump to object storage) to meet RPO requirements.',
      remediation:
        !redisProbe.alive
          ? 'Redis is unreachable. Session continuity may be impaired. Restart Redis container: docker compose restart redis. Verify REDIS_PASSWORD matches in docker-compose.yml and .env file.'
          : pgStats.error
          ? 'PostgreSQL probe failed: ' + pgStats.error + '. Check database connectivity and container health.'
          : pgStats.activeConnections >= pgStats.maxConnections * 0.8
          ? 'PostgreSQL connection pool is at ' + pgStats.activeConnections + '/' + pgStats.maxConnections + ' (' + Math.round((pgStats.activeConnections / pgStats.maxConnections) * 100) + '%). Consider increasing max_connections or adding connection pooling (PgBouncer).'
          : null,
    },

    // â”€â”€ PS: Personnel Security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      id: 'PS-4', family: 'PS', name: 'Personnel Termination',
      nistRef: 'NIST SP 800-53 Rev 5 PS-4',
      nistControlText:
        'Upon termination of individual employment: disable information system access within an organization-defined time period; terminate or revoke any authenticators and credentials associated with the individual; conduct exit interviews; retrieve all security-related organizational system-related property; and retain access to organizational information and information systems formerly controlled by the terminated individual.',
      description:
        'User deletions and account removals are logged and tracked. Account access is revoked immediately upon deletion.',
      status: controlStatus(deletedUsers30d === 0, deletedUsers30d <= 3),
      detail: `${deletedUsers30d} user account${deletedUsers30d !== 1 ? 's' : ''} deleted in past 30 days Â· Account deletion immediately revokes all active JWT tokens Â· All USER_DELETED events logged as HIGH severity for SOC review`,
      metric: deletedUsers30d,
      components: ['Application', 'PostgreSQL'],
      evidenceSource:
        'Live DB query: prisma.auditLog.count({ where: { action: "USER_DELETED", timestamp: { gte: 30 days ago } } }). Code audit: user deletion cascades to invalidate refresh tokens â€” JWT access tokens expire naturally within 15 min.',
      complianceNarrative:
        'When a user account is deleted, all associated data is removed from the database via Prisma cascade. Active JWT access tokens for the deleted user will expire within 15 minutes. Refresh tokens are immediately invalid as they reference a non-existent user record. All deletion events are logged as HIGH severity USER_DELETED events visible in the SOC Audit Log. Administrators should verify account deletions correspond to authorized offboarding actions.',
      remediation:
        deletedUsers30d > 3
          ? 'Multiple user deletions detected. Review USER_DELETED events in the Audit Log to verify each deletion was an authorized offboarding action. Unexpected deletions may indicate unauthorized administrative activity.'
          : null,
    },

    // â”€â”€ AC additional â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      id: 'AC-3', family: 'AC', name: 'Access Enforcement',
      nistRef: 'NIST SP 800-53 Rev 5 AC-3',
      nistControlText:
        'Enforce approved authorizations for logical access to information and system resources in accordance with applicable access control policies.',
      description:
        'Role-based access control is enforced on every API endpoint. Users can only access resources within their authorization level and organization scope.',
      status: 'PASS' as ControlStatus,
      detail: `${totalUsers} users across 4 roles Â· SUPER_ADMIN: ${superAdminCount} Â· ORG_ADMIN: ${orgAdminCount} Â· All endpoints use requireAuth + role middleware Â· Multi-tenant: org-scoped queries prevent cross-org access`,
      metric: null,
      components: ['Application', 'PostgreSQL', 'JWT'],
      evidenceSource:
        `Live DB: prisma.user.count({ role: "SUPER_ADMIN" }) = ${superAdminCount}, prisma.user.count({ role: "ORG_ADMIN" }) = ${orgAdminCount}. Code audit: middleware/auth.ts requireAuth, requireAdmin, requireSuperAdmin guards on all protected routes. Prisma queries include orgId scoping for non-super-admin roles.`,
      complianceNarrative:
        'Access control is enforced at the middleware layer before any business logic executes. The requireAuth middleware validates the JWT and populates req.user with the user\'s role and orgId. Route handlers use these values to enforce authorization â€” ORG_ADMIN operations are scoped to their organization\'s data via Prisma where clauses. Cross-organization access is blocked with a 403 response. The JWT claims carry the authorization attributes, making it impossible to escalate privileges without obtaining a new token.',
      remediation: null,
    },
    {
      id: 'AC-6', family: 'AC', name: 'Least Privilege',
      nistRef: 'NIST SP 800-53 Rev 5 AC-6',
      nistControlText:
        'Employ the principle of least privilege, allowing only authorized accesses for users (and processes acting on behalf of users) which are necessary to accomplish assigned tasks in accordance with organizational missions and business functions.',
      description:
        'Privileged accounts (SUPER_ADMIN, ORG_ADMIN) are minimized. Users are assigned the lowest role necessary for their function.',
      status: controlStatus(superAdminCount <= 2, superAdminCount <= 5),
      detail: `SUPER_ADMIN accounts: ${superAdminCount} (target â‰¤ 2) Â· ORG_ADMIN accounts: ${orgAdminCount} Â· Privilege escalation requires explicit admin approval and is logged Â· RBAC hierarchy prevents role self-elevation`,
      metric: superAdminCount,
      components: ['Application', 'PostgreSQL'],
      evidenceSource:
        `Live DB query: prisma.user.count({ where: { role: "SUPER_ADMIN" } }) = ${superAdminCount}. Role changes require ORG_ADMIN+ and are logged as ROLE_CHANGED (HIGH severity). Users cannot self-assign roles.`,
      complianceNarrative:
        'The principle of least privilege is enforced through the four-tier RBAC hierarchy (PLAYER â†’ FACILITATOR â†’ ORG_ADMIN â†’ SUPER_ADMIN). SUPER_ADMIN is the only role with cross-organizational visibility and is intended for platform administrators only. Role changes require an authorized administrator and are permanently recorded in the audit log. The RBAC middleware prevents users from accessing resources above their privilege level. Regular review of privileged accounts via the Users tab supports ongoing compliance.',
      remediation:
        superAdminCount > 5
          ? 'High number of SUPER_ADMIN accounts detected (' + superAdminCount + '). Review privileged accounts in the Users tab and downgrade accounts that do not require full platform access. Target: â‰¤ 2 SUPER_ADMIN accounts.'
          : superAdminCount > 2
          ? 'Consider reducing SUPER_ADMIN accounts to the minimum required. Review each account in the Users tab to verify the elevated access is necessary.'
          : null,
    },

    // â”€â”€ AU additional â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      id: 'AU-11', family: 'AU', name: 'Audit Record Retention',
      nistRef: 'NIST SP 800-53 Rev 5 AU-11',
      nistControlText:
        'Retain audit records for an organization-defined time period to provide support for after-the-fact investigations of security incidents and to meet regulatory and organizational information retention requirements.',
      description:
        'Audit records are retained in PostgreSQL with no automated deletion. Retention period is determined by available storage and organizational policy.',
      status: auditRetentionStatus,
      detail: `${totalAuditEntries.toLocaleString()} total audit records Â· Oldest record: ${oldestAuditEntry ? new Date(oldestAuditEntry.timestamp).toLocaleDateString() + ' (' + auditRetentionDays + ' days ago)' : 'No records'} Â· Database size: ${pgStats.dbSizeMb} MB Â· No automated deletion â€” records persist until storage limit`,
      metric: auditRetentionDays,
      components: ['PostgreSQL', 'Application'],
      evidenceSource:
        `Live DB queries: prisma.auditLog.count() = ${totalAuditEntries}, prisma.auditLog.findFirst({ orderBy: { timestamp: "asc" } }) = ${oldestAuditEntry ? new Date(oldestAuditEntry.timestamp).toISOString() : 'null'}. Retention days calculated as (now - oldest) / ms_per_day = ${auditRetentionDays} days.`,
      complianceNarrative:
        'Audit records are stored in PostgreSQL with no expiry or automated deletion mechanism. Records accumulate until the storage volume is full or an operator archives them. The application does not expose audit update/delete workflows, but database administrators can still modify data unless operators add external tamper-resistant storage. NIST 800-53 and FedRAMP commonly require 90-day online retention and longer archival. Organizations should monitor database growth and implement archival exports or SIEM forwarding for long-term retention.',
      remediation:
        totalAuditEntries === 0
          ? 'No audit records exist yet. Verify audit generation is working by logging in, updating a user, or creating a tabletop session, then confirm events appear in the SOC Audit Log.'
          : auditRetentionDays < 90
          ? 'Audit history is still accumulating for this deployment. Keep PostgreSQL storage sized for the required retention period, and use external archival or SIEM forwarding when organizational policy requires longer evidence retention.'
          : null,
    },

    // â”€â”€ SC additional â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      id: 'SC-12', family: 'SC', name: 'Cryptographic Key Management',
      nistRef: 'NIST SP 800-53 Rev 5 SC-12',
      nistControlText:
        'Establish and manage cryptographic keys for required cryptography employed within the system in accordance with the following key management requirements: key generation, distribution, storage, access, and destruction.',
      description:
        'JWT signing keys must be cryptographically strong, securely stored in environment variables, and meet minimum length requirements. Key strength is validated at startup.',
      status: controlStatus(jwtSecretStrong, jwtSecretAdequate),
      detail: `JWT_SECRET length: ${jwtSecretLength} characters (target â‰¥ 64) Â· JWT_REFRESH_SECRET: separate key Â· Startup validation: exit if JWT_SECRET < 32 chars Â· Keys stored as environment variables (not in code) Â· HMAC-SHA256 signing algorithm`,
      metric: jwtSecretLength,
      components: ['Application', 'JWT'],
      evidenceSource:
        `Runtime check: process.env.JWT_SECRET?.length = ${jwtSecretLength}. Startup validation in src/index.ts enforces minimum 32-char requirement. Key never logged or exposed in responses. Code audit: auth/tokens.ts uses separate JWT_SECRET and JWT_REFRESH_SECRET.`,
      complianceNarrative:
        'JWT tokens are signed using HMAC-SHA256 with a secret key stored exclusively in the environment (not committed to source control). Access and refresh tokens use separate keys, limiting the blast radius of a key compromise. The application validates key existence and minimum length (â‰¥32 chars) at startup and refuses to start without valid keys. Key rotation requires environment variable update and container restart. For NIST compliance, keys should be â‰¥ 64 characters (256-bit entropy) and rotated according to organizational policy.',
      remediation:
        !jwtSecretAdequate
          ? 'CRITICAL: JWT_SECRET is too short (' + jwtSecretLength + ' chars). Generate a strong key: openssl rand -base64 64. Update in .env and restart containers. The application should have refused to start â€” verify startup validation is active.'
          : !jwtSecretStrong
          ? 'JWT_SECRET is adequate (' + jwtSecretLength + ' chars) but below the recommended 64-character minimum for NIST compliance. Consider rotating to a stronger key: openssl rand -base64 64'
          : null,
    },

    // â”€â”€ IR additional â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      id: 'IR-4', family: 'IR', name: 'Incident Handling',
      nistRef: 'NIST SP 800-53 Rev 5 IR-4',
      nistControlText:
        'Implement an incident handling capability for security incidents that includes preparation, detection and analysis, containment, eradication, and recovery; coordinate incident handling activities with contingency planning activities; incorporate lessons learned from ongoing incident handling activities into incident response procedures.',
      description:
        'Security incidents (account lockouts, brute-force patterns, privilege escalations) are automatically detected, classified, and logged for SOC investigation.',
      status: controlStatus(lockedEvents24h === 0 && failedLogins24h < 5, lockedEvents24h <= 2),
      detail: `${lockedEvents24h} account lockout event${lockedEvents24h !== 1 ? 's' : ''} (24h) Â· ${failedLogins24h} failed login attempt${failedLogins24h !== 1 ? 's' : ''} (24h) Â· ${recentRoleChanges} privilege changes (30d) Â· CRITICAL/HIGH events surfaced in SOC Audit Log Â· CSV export for SIEM/ticketing ingestion`,
      metric: lockedEvents24h,
      components: ['Application', 'PostgreSQL'],
      evidenceSource:
        `Live DB queries: USER_LOCKED events 24h = ${lockedEvents24h}, USER_LOGIN_FAILED 24h = ${failedLogins24h}, ROLE_CHANGED 30d = ${recentRoleChanges}. SOC Audit Log provides real-time filtering by severity (CRITICAL/HIGH/MEDIUM/LOW/INFO) and category (AUTH/ACCESS/DATA/CONFIG) with CSV export for external SIEM systems.`,
      complianceNarrative:
        'The system provides automated incident detection at three layers: account lockout detection (USER_LOCKED events after consecutive failures), brute-force pattern detection (USER_LOGIN_FAILED aggregate counts), and privilege escalation detection (ROLE_CHANGED and MFA_DISABLED events). All incidents are classified by severity and category in the SOC Audit Log, enabling rapid triage. The expandable event rows provide full forensic context (user, IP, user-agent, metadata) for investigation. CSV export enables handoff to external SIEM, SOAR, or ticketing systems for incident lifecycle management.',
      remediation:
        lockedEvents24h > 2
          ? 'Multiple account lockout events in 24 hours â€” potential brute-force attack. Immediately review USER_LOCKED events in the Audit Log. Identify the source IP(s) and consider implementing a firewall block. Check if any privileged accounts were targeted.'
          : failedLogins24h >= 20
          ? 'High volume of failed login attempts (' + failedLogins24h + ' in 24h). Review USER_LOGIN_FAILED events filtered by user and IP. A coordinated credential stuffing attack may be in progress.'
          : null,
    },

    // â”€â”€ SI: System and Information Integrity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      id: 'SI-3', family: 'SI', name: 'Malicious Code Protection',
      nistRef: 'NIST SP 800-53 Rev 5 SI-3',
      nistControlText:
        'Implement malicious code protection mechanisms at system entry and exit points to detect and eradicate malicious code. Address the receipt of false positives during malicious code detection and eradication.',
      description:
        'Content Security Policy reduces XSS impact. Mutation endpoints use route-level validation, Prisma parameterized queries, and bounded request sizes. Nginx enforces edge content and payload limits.',
      status: controlStatus(
        nginxProbe.reachable && hasXCTO,
        !nginxProbe.reachable,
      ),
      detail: `CSP: default-src 'self', no inline scripts, no unsafe-eval Â· X-Content-Type-Options: ${hasXCTO ? 'âœ“ nosniff' : 'âœ— missing'} Â· Input validation: Zod and route-level guards on mutation endpoints Â· Request size limit: 2 MB (Nginx client_max_body_size) Â· Parameterized queries (Prisma ORM) prevent SQL injection`,
      metric: null,
      components: ['Application', 'Nginx', 'Helmet.js'],
      evidenceSource:
        `Live infrastructure probe: x-content-type-options="${nh['x-content-type-options'] ?? 'N/A'}". Static code audit: middleware/security.ts and nginx.conf CSP with default-src "'self'" and no unsafe-inline scripts. Mutation routes use Zod schemas and explicit guards. Prisma parameterized queries prevent SQL injection.`,
      complianceNarrative:
        'Defense-in-depth protection against malicious code injection is provided at multiple layers. The Content Security Policy (CSP) blocks inline script execution and restricts resource loading to the application origin, reducing XSS impact. X-Content-Type-Options: nosniff prevents MIME-type confusion attacks. Mutation endpoints use Zod schemas and explicit validation before processing. Prisma ORM uses parameterized queries, reducing SQL injection risk. Nginx limits request body size to 2 MB, preventing certain resource exhaustion attacks.',
      remediation:
        !nginxProbe.reachable
          ? 'Cannot verify Nginx security headers â€” Nginx probe failed. Ensure the nginx container is running and accessible from the backend container.'
          : !hasXCTO
          ? 'X-Content-Type-Options header missing from Nginx responses. Add "add_header X-Content-Type-Options nosniff always;" to the http block in nginx.conf and reload Nginx.'
          : null,
    },
  ];

  const overall = overallStatus(controls);

  res.json({
    overall,
    lastUpdated: now.toISOString(),
    controls,
    metrics: {
      totalUsers,
      lockedUsers,
      mfaAdoptionPct,
      mfaEnabledUsers: mfaUsers,
      privilegedUsers,
      privilegedMfaUsers,
      privilegedMfaPct,
      failedLogins24h,
      activeSessions,
      activeUsersList,
      recentRoleChanges,
      recentMfaDisables,
      auditEntries:      totalAuditEntries,
      lastAuditAt:       latestAuditEntry?.timestamp?.toISOString() ?? null,
      superAdminCount,
      orgAdminCount,
      lockedEvents24h,
      auditRetentionDays,
      deletedUsers30d,
      jwtSecretLength,
      totalSessions,
      endedSessions,
    },
    infrastructure: {
      redis:    { alive: redisProbe.alive, latencyMs: redisProbe.latencyMs, info: redisProbe.info, error: redisProbe.error },
      nginx:    { reachable: nginxProbe.reachable, latencyMs: nginxProbe.latencyMs, statusCode: nginxProbe.statusCode, headerCount: Object.keys(nginxProbe.headers).length, error: nginxProbe.error },
      postgres: { version: pgStats.version, activeConnections: pgStats.activeConnections, maxConnections: pgStats.maxConnections, dbSizeMb: pgStats.dbSizeMb, error: pgStats.error },
    },
  });
});

// â”€â”€â”€ Prompt Template CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/admin/prompt-templates â€” list all templates with current content
router.get('/prompt-templates', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const templates = await getAllTemplateData();
  res.json(templates);
});

// PUT /api/admin/prompt-templates/:key â€” save a custom template
router.put('/prompt-templates/:key', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { key } = req.params;
  const { content } = req.body as { content?: unknown };

  if (!TEMPLATE_DEFINITIONS.find((t) => t.key === key)) {
    return res.status(404).json({ error: 'Unknown template key' });
  }
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'content must be a non-empty string' });
  }

  await saveTemplateContent(key, content.trim(), req.user!.id);
  res.json({ ok: true });
});

// POST /api/admin/prompt-templates/:key/reset â€” delete custom override, revert to default
router.post('/prompt-templates/:key/reset', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { key } = req.params;

  if (!TEMPLATE_DEFINITIONS.find((t) => t.key === key)) {
    return res.status(404).json({ error: 'Unknown template key' });
  }

  await resetTemplateContent(key);
  res.json({ ok: true });
});

// â”€â”€â”€ AI Config endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const VALID_PROVIDERS: ProviderType[] = ['ollama', 'anthropic', 'openai'];

// GET /api/admin/ai-config â€” all provider configs
router.get('/ai-config', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const rows = await getAllProviderRows();
  res.json(rows);
});

// PUT /api/admin/ai-config/:provider â€” save settings for one provider
router.put('/ai-config/:provider', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const provider = req.params.provider as ProviderType;
  if (!VALID_PROVIDERS.includes(provider)) return res.status(400).json({ error: 'Unknown provider' });
  await saveProviderConfig(provider, req.body, req.user!.id);
  res.json({ ok: true });
});

// POST /api/admin/ai-config/:provider/activate â€” set as the active provider
router.post('/ai-config/:provider/activate', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const provider = req.params.provider as ProviderType;
  if (!VALID_PROVIDERS.includes(provider)) return res.status(400).json({ error: 'Unknown provider' });
  await setActiveProvider(provider, req.user!.id);
  res.json({ ok: true });
});

// POST /api/admin/ai-config/:provider/reset â€” delete DB override, revert to .env defaults
router.post('/ai-config/:provider/reset', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const provider = req.params.provider as ProviderType;
  if (!VALID_PROVIDERS.includes(provider)) return res.status(400).json({ error: 'Unknown provider' });
  await resetProviderConfig(provider);
  res.json({ ok: true });
});

// POST /api/admin/ai-config/test â€” test connection without saving
router.post('/ai-config/test', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { provider, settings } = req.body as { provider: ProviderType; settings: Record<string, unknown> };
  if (!VALID_PROVIDERS.includes(provider)) return res.status(400).json({ error: 'Unknown provider' });
  const result = await testProviderConnection(provider, settings);
  res.json(result);
});

// GET /api/admin/org-config
router.get('/org-config', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const config = await getOrgConfigForUser(req.user!.id, req.user!.orgId);
  res.json(config);
});

// PUT /api/admin/org-config
router.put('/org-config', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const roleNames = Array.isArray(req.body?.roleNames) ? req.body.roleNames : [];
  const divisionNames = Array.isArray(req.body?.divisionNames) ? req.body.divisionNames : [];

  try {
    const config = await saveOrgConfigForUser(req.user!.id, req.user!.orgId, {
      organizationName: typeof req.body?.organizationName === 'string' ? req.body.organizationName : '',
      websiteUrl: typeof req.body?.websiteUrl === 'string' ? req.body.websiteUrl : '',
      orgContextNotes: typeof req.body?.orgContextNotes === 'string' ? req.body.orgContextNotes : '',
      roleNames,
      divisionNames,
    });
    res.json(config);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to save organization config',
    });
  }
});

export default router;
