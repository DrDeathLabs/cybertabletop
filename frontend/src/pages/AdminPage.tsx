import React, { useEffect, useState, useCallback, useRef, Fragment } from 'react';
import { createPortal } from 'react-dom';
import {
  Settings,
  Users,
  FileText,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Bot,
  Save,
  RotateCcw,
  Info,
  RefreshCw,
  Download,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronUp,
  Calendar,
  Lock,
  UserCheck,
  Activity,
  Eye,
  EyeOff,
  X,
  ExternalLink,
  Database,
  Server,
  Wifi,
  WifiOff,
} from 'lucide-react';
import Layout from '../components/shared/Layout';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/shared/Toaster';
import { useAuthStore } from '../stores/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'FACILITATOR' | 'PLAYER';

interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  mfaEnabled?: boolean;
  failedAttempts?: number;
  lockedUntil?: string | null;
  lastLoginAt?: string;
  createdAt: string;
}

interface AuditUser {
  id: string;
  email: string;
  displayName: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  userId: string | null;
  user: AuditUser | null;
  ipAddress: string | null;
  userAgent: string | null;
  resource: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: string;
}

interface ControlCheck {
  id: string;
  family: string;
  name: string;
  description: string;
  nistRef: string;
  nistControlText: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  detail: string;
  metric: number | null;
  components: string[];
  evidenceSource: string;
  complianceNarrative: string;
  remediation: string | null;
}

interface InfraProbe {
  redis:    { alive: boolean; latencyMs: number; info?: string; error?: string };
  nginx:    { reachable: boolean; latencyMs: number; statusCode: number; headerCount: number; error?: string };
  postgres: { version: string; activeConnections: number; maxConnections: number; dbSizeMb: number; error?: string };
}

interface ActiveUserEntry {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  lastLoginAt: string;
}

interface OrgConfigRecord {
  organizationName: string;
  websiteUrl: string;
  websiteSummary: string;
  websiteLastFetchedAt: string | null;
  websiteFetchError: string;
  roleNames: string[];
  divisionNames: string[];
  orgContextNotes: string;
  isConfigured: boolean;
}

interface SecurityPosture {
  overall: 'GREEN' | 'YELLOW' | 'RED';
  lastUpdated: string;
  controls: ControlCheck[];
  metrics: {
    totalUsers: number;
    lockedUsers: number;
    mfaAdoptionPct: number;
    mfaEnabledUsers: number;
    failedLogins24h: number;
    activeSessions: number;
    activeUsersList: ActiveUserEntry[];
    recentRoleChanges: number;
    recentMfaDisables: number;
    auditEntries: number;
    lastAuditAt: string | null;
    superAdminCount: number;
    orgAdminCount: number;
    lockedEvents24h: number;
    auditRetentionDays: number;
    deletedUsers30d: number;
    jwtSecretLength: number;
    totalSessions: number;
    endedSessions: number;
  };
  infrastructure: InfraProbe;
  nistCsfPerformance: Record<string, number | null>;
  nistCsfDecisionCounts: Record<string, number>;
  nistCsfTotalDecisions: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ORG_ADMIN:   'Org Admin',
  FACILITATOR: 'Facilitator',
  PLAYER:      'Player',
};

const ROLE_COLORS: Record<UserRole, string> = {
  SUPER_ADMIN: 'bg-red-500/20 text-red-400 border-red-500/40',
  ORG_ADMIN:   'bg-purple-500/20 text-purple-400 border-purple-500/40',
  FACILITATOR: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  PLAYER:      'bg-green-500/20 text-green-400 border-green-500/40',
};

const ALL_ROLES: UserRole[] = ['PLAYER', 'FACILITATOR', 'ORG_ADMIN', 'SUPER_ADMIN'];

// Severity classification for SOC audit log — aligned with NIST AU-2 event categories
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
type EventCategory = 'AUTH' | 'ACCESS' | 'DATA' | 'CONFIG';

const EVENT_SEVERITY: Record<string, Severity> = {
  USER_LOCKED:       'CRITICAL',
  USER_LOGIN_FAILED: 'HIGH',
  MFA_DISABLED:      'HIGH',
  ROLE_CHANGED:      'HIGH',
  USER_DELETED:      'HIGH',
  PASSWORD_CHANGED:  'MEDIUM',
  USER_CREATED:      'MEDIUM',
  SSO_LOGIN:         'MEDIUM',
  SCENARIO_DELETED:  'LOW',
  USER_LOGIN:        'LOW',
  USER_LOGOUT:       'LOW',
  MFA_ENABLED:       'LOW',
  USER_UPDATED:      'LOW',
  SESSION_CREATED:   'INFO',
  SESSION_STARTED:   'INFO',
  SESSION_ENDED:     'INFO',
  PLAYER_JOINED:     'INFO',
  DECISION_SUBMITTED:'INFO',
  SCENARIO_CREATED:  'INFO',
  SCENARIO_UPDATED:  'INFO',
};

const EVENT_CATEGORY: Record<string, EventCategory> = {
  USER_LOGIN_FAILED: 'AUTH',
  USER_LOCKED:       'AUTH',
  SSO_LOGIN:         'AUTH',
  USER_LOGIN:        'AUTH',
  USER_LOGOUT:       'AUTH',
  MFA_ENABLED:       'AUTH',
  MFA_DISABLED:      'AUTH',
  PASSWORD_CHANGED:  'AUTH',
  ROLE_CHANGED:      'ACCESS',
  USER_CREATED:      'ACCESS',
  USER_UPDATED:      'ACCESS',
  USER_DELETED:      'ACCESS',
  SCENARIO_CREATED:  'DATA',
  SCENARIO_UPDATED:  'DATA',
  SCENARIO_DELETED:  'DATA',
  SESSION_CREATED:   'DATA',
  SESSION_STARTED:   'DATA',
  SESSION_ENDED:     'DATA',
  PLAYER_JOINED:     'DATA',
  DECISION_SUBMITTED:'DATA',
};

const SEVERITY_COLORS: Record<Severity, string> = {
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/40',
  HIGH:     'bg-orange-500/20 text-orange-400 border-orange-500/40',
  MEDIUM:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  LOW:      'bg-blue-500/20 text-blue-400 border-blue-500/40',
  INFO:     'bg-slate-500/20 text-slate-400 border-slate-500/40',
};

const SEVERITY_DOT: Record<Severity, string> = {
  CRITICAL: 'bg-red-500',
  HIGH:     'bg-orange-500',
  MEDIUM:   'bg-yellow-500',
  LOW:      'bg-blue-500',
  INFO:     'bg-slate-500',
};

const CATEGORY_COLORS: Record<EventCategory, string> = {
  AUTH:   'bg-purple-500/15 text-purple-400',
  ACCESS: 'bg-red-500/15 text-red-400',
  DATA:   'bg-cyan-500/15 text-cyan-400',
  CONFIG: 'bg-amber-500/15 text-amber-400',
};

const CONTROL_FAMILY_LABELS: Record<string, string> = {
  AC: 'Access Control',
  AU: 'Audit & Accountability',
  CP: 'Contingency Planning',
  IA: 'Identification & Authentication',
  IR: 'Incident Response',
  CM: 'Configuration Management',
  PS: 'Personnel Security',
  SC: 'System & Communications',
  SI: 'System & Information Integrity',
};

// Component badge colors for infrastructure components in control detail panel
const COMPONENT_COLORS: Record<string, string> = {
  'Application':        'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  'PostgreSQL':         'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25',
  'Nginx':              'bg-green-500/15 text-green-400 border border-green-500/25',
  'Redis':              'bg-orange-500/15 text-orange-400 border border-orange-500/25',
  'JWT':                'bg-purple-500/15 text-purple-400 border border-purple-500/25',
  'bcrypt':             'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25',
  'Helmet.js':          'bg-pink-500/15 text-pink-400 border border-pink-500/25',
  'express-rate-limit': 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  'TLS/SSL':            'bg-teal-500/15 text-teal-400 border border-teal-500/25',
  'Prisma ORM':         'bg-violet-500/15 text-violet-400 border border-violet-500/25',
  'CORS':               'bg-rose-500/15 text-rose-400 border border-rose-500/25',
};

const CSF_META: Record<string, { label: string; description: string; color: string }> = {
  IDENTIFY: { label: 'Identify',  description: 'Asset management, risk assessment',         color: 'blue'   },
  PROTECT:  { label: 'Protect',   description: 'Safeguards, access control, training',       color: 'green'  },
  DETECT:   { label: 'Detect',    description: 'Anomalies, monitoring, detection processes', color: 'yellow' },
  RESPOND:  { label: 'Respond',   description: 'Response planning, communications',          color: 'orange' },
  RECOVER:  { label: 'Recover',   description: 'Recovery planning, improvements',            color: 'purple' },
};

const CSF_BAR_COLORS: Record<string, string> = {
  blue:   'bg-blue-500',
  green:  'bg-green-500',
  yellow: 'bg-yellow-500',
  orange: 'bg-orange-500',
  purple: 'bg-purple-500',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtShort(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function getSeverity(action: string): Severity {
  return EVENT_SEVERITY[action] ?? 'INFO';
}

function getCategory(action: string): EventCategory {
  return EVENT_CATEGORY[action] ?? 'DATA';
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-slate-500';
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

function scoreBarColor(score: number | null): string {
  if (score === null) return 'bg-slate-700';
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
}

function exportCsv(logs: AuditLogEntry[], filename: string) {
  const headers = ['Timestamp', 'Severity', 'Category', 'Action', 'User Email', 'User ID', 'IP Address', 'Resource', 'Metadata'];
  const rows = logs.map((log) => [
    log.timestamp,
    getSeverity(log.action),
    getCategory(log.action),
    log.action,
    log.user?.email ?? '',
    log.userId ?? '',
    log.ipAddress ?? '',
    log.resource ?? '',
    log.metadata ? JSON.stringify(log.metadata) : '',
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function arrayToLines(values: string[]) {
  return (values ?? []).join('\n');
}

function linesToArray(value: string) {
  const seen = new Set<string>();
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => {
      if (!entry) return false;
      const key = entry.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// ─── Control Detail Panel ─────────────────────────────────────────────────────

// Maps control ID → primary audit log action to filter by when investigating
const CONTROL_AUDIT_LINK: Record<string, { action: string; label: string }> = {
  'AC-7':  { action: 'USER_LOGIN_FAILED', label: 'View failed login events' },
  'AC-2':  { action: 'USER_LOCKED',       label: 'View account lockout events' },
  'IA-5':  { action: 'MFA_DISABLED',      label: 'View MFA disable events' },
  'IR-4':  { action: 'USER_LOCKED',       label: 'View incident events' },
  'IR-6':  { action: 'MFA_DISABLED',      label: 'View security anomaly events' },
  'PS-4':  { action: 'USER_DELETED',      label: 'View user deletion events' },
  'AC-3':  { action: 'ROLE_CHANGED',      label: 'View role change events' },
  'AC-6':  { action: 'ROLE_CHANGED',      label: 'View privilege change events' },
  'AU-2':  { action: 'USER_LOGIN',        label: 'View authentication events' },
  'AU-12': { action: 'USER_LOGIN',        label: 'View recent audit records' },
};

function ControlDetailPanel({
  control,
  onClose,
  onSwitchToAudit,
}: {
  control: ControlCheck;
  onClose: () => void;
  onSwitchToAudit?: (action: string) => void;
}) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const statusColor =
    control.status === 'PASS'
      ? { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', icon: <CheckCircle2 className="w-5 h-5 text-green-400" />, badge: 'bg-green-500/15 text-green-400 border-green-500/30' }
      : control.status === 'WARN'
      ? { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: <AlertCircle className="w-5 h-5 text-yellow-400" />, badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' }
      : { bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-400',    icon: <XCircle    className="w-5 h-5 text-red-400"    />, badge: 'bg-red-500/15 text-red-400 border-red-500/30' };

  const nistUrl = `https://csrc.nist.gov/projects/cprt/catalog#/cprt/framework/version/SP_800_53_5_1_0/home?element=${control.id}`;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div className="fixed right-0 top-0 h-screen w-[560px] max-w-[95vw] bg-slate-900 border-l border-slate-700 z-[201] flex flex-col shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className={`px-6 py-5 border-b border-slate-700/60 flex items-start justify-between flex-shrink-0 ${statusColor.bg}`}>
          <div className="flex items-start gap-3 min-w-0">
            <div className={`p-2 rounded-lg flex-shrink-0 ${statusColor.bg} border ${statusColor.border}`}>
              {statusColor.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-mono font-bold text-slate-400 bg-slate-700/80 px-2 py-0.5 rounded">
                  {control.id}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${statusColor.badge}`}>
                  {control.status}
                </span>
                <span className="text-xs text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded font-mono">
                  {control.family} family
                </span>
              </div>
              <p className="text-base font-semibold text-white leading-snug">{control.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{control.nistRef}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-700/60 rounded-lg transition-colors flex-shrink-0 ml-3"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Current Assessment */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
              Current Assessment
            </p>
            <div className={`p-3.5 rounded-lg border text-sm leading-relaxed ${
              control.status === 'PASS'
                ? 'bg-green-500/5 border-green-500/20 text-green-300'
                : control.status === 'WARN'
                ? 'bg-yellow-500/5 border-yellow-500/20 text-yellow-300'
                : 'bg-red-500/5 border-red-500/20 text-red-300'
            }`}>
              {control.detail}
            </div>
          </div>

          {/* Infrastructure Components */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
              Infrastructure Components
            </p>
            <div className="flex flex-wrap gap-2">
              {control.components.map((c) => (
                <span
                  key={c}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    COMPONENT_COLORS[c] ?? 'bg-slate-600/30 text-slate-400 border border-slate-600/40'
                  }`}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>

          {/* Official NIST 800-53 Rev 5 Control Text */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
              NIST SP 800-53 Rev 5 — Official Control Text
            </p>
            <blockquote className="border-l-2 border-blue-500/50 pl-4 bg-slate-800/50 py-3 pr-4 rounded-r-lg">
              <p className="text-sm text-slate-400 italic leading-relaxed">
                {control.nistControlText}
              </p>
            </blockquote>
          </div>

          {/* How this system satisfies the control */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
              How This System Satisfies the Control
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">
              {control.complianceNarrative}
            </p>
          </div>

          {/* Evidence Source */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
              Evidence Source
            </p>
            <div className="flex items-start gap-2.5 p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
              <Database className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-400 font-mono leading-relaxed break-all">
                {control.evidenceSource}
              </p>
            </div>
          </div>

          {/* Remediation — only shown when WARN or FAIL */}
          {control.remediation && control.status !== 'PASS' && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                Remediation Steps
              </p>
              <div className={`p-3.5 rounded-lg border ${
                control.status === 'FAIL'
                  ? 'bg-red-500/5 border-red-500/20'
                  : 'bg-amber-500/5 border-amber-500/20'
              }`}>
                <p className={`text-sm leading-relaxed ${
                  control.status === 'FAIL' ? 'text-red-300' : 'text-amber-300'
                }`}>
                  {control.remediation}
                </p>
              </div>
            </div>
          )}

          {/* Investigate in Audit Log — shown for controls with linked audit events */}
          {onSwitchToAudit && CONTROL_AUDIT_LINK[control.id] && (
            <div className="pt-1">
              <button
                onClick={() => { onClose(); onSwitchToAudit(CONTROL_AUDIT_LINK[control.id].action); }}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-slate-800/80 border border-slate-700/60 hover:border-blue-500/40 hover:bg-blue-500/5 rounded-lg transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <Search className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 flex-shrink-0" />
                  <span className="text-sm text-slate-400 group-hover:text-blue-300">
                    {CONTROL_AUDIT_LINK[control.id].label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-slate-500 bg-slate-700/60 px-1.5 py-0.5 rounded">
                    {CONTROL_AUDIT_LINK[control.id].action}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400" />
                </div>
              </button>
              <p className="text-[10px] text-slate-600 mt-1.5 px-1">
                Opens SOC Audit Log filtered to this event type
              </p>
            </div>
          )}

          {/* Divider + External NIST reference */}
          <div className="pt-2 border-t border-slate-700/50">
            <a
              href={nistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              View full control at NIST CSRC — {control.nistRef}
            </a>
            <p className="text-xs text-slate-600 mt-1">
              Source: NIST Special Publication 800-53 Revision 5, September 2020
            </p>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Security Dashboard Tab ───────────────────────────────────────────────────

const REFRESH_INTERVAL_S = 60;

function SecurityDashboardTab({ onSwitchToAudit }: { onSwitchToAudit?: (action: string) => void }) {
  const { get } = useApi();
  const [posture, setPosture]           = useState<SecurityPosture | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [refreshing, setRefreshing]     = useState(false);
  const [selectedControl, setSelectedControl] = useState<ControlCheck | null>(null);
  const [issuesExpanded, setIssuesExpanded]   = useState(false);
  const [countdown, setCountdown]       = useState(REFRESH_INTERVAL_S);
  const [showActiveUsers, setShowActiveUsers] = useState(false);
  const countdownRef                    = useRef(REFRESH_INTERVAL_S);

  // Count down every second
  useEffect(() => {
    const t = setInterval(() => {
      countdownRef.current = Math.max(0, countdownRef.current - 1);
      setCountdown(countdownRef.current);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    // Reset countdown on every load
    countdownRef.current = REFRESH_INTERVAL_S;
    setCountdown(REFRESH_INTERVAL_S);
    try {
      const data = await get<SecurityPosture>('/api/admin/security-posture');
      setPosture(data);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [get]);

  useEffect(() => {
    load();
    // Auto-refresh every 60 seconds for continuous ATO monitoring
    const interval = setInterval(() => load(true), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3 text-red-400 text-sm">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        {error}
      </div>
    );
  }

  if (!posture) return null;

  const { overall, controls, metrics, infrastructure, nistCsfPerformance, nistCsfDecisionCounts } = posture;

  // Group controls by family for display (alphabetical by family code)
  const families = ['AC', 'AU', 'CM', 'CP', 'IA', 'IR', 'PS', 'SC', 'SI'];
  const controlsByFamily = families.map((fam) => ({
    family: fam,
    label: CONTROL_FAMILY_LABELS[fam],
    controls: controls.filter((c) => c.family === fam),
  }));

  const passCount = controls.filter((c) => c.status === 'PASS').length;
  const warnCount = controls.filter((c) => c.status === 'WARN').length;
  const failCount = controls.filter((c) => c.status === 'FAIL').length;

  return (
    <div className="space-y-6">

      {/* ── Control Detail Panel (right drawer) ──────────────────────────────── */}
      {selectedControl && (
        <ControlDetailPanel
          control={selectedControl}
          onClose={() => setSelectedControl(null)}
          onSwitchToAudit={onSwitchToAudit}
        />
      )}

      {/* ── Overall Posture Banner — click to expand/collapse full issues list ── */}
      {(() => {
        const issueControls = [
          ...controls.filter(c => c.status === 'FAIL'),
          ...controls.filter(c => c.status === 'WARN'),
        ];
        const hasIssues = issueControls.length > 0;
        const bannerConfig = overall === 'GREEN'
          ? { bg: 'bg-green-500/10', border: 'border-green-500/40', text: 'text-green-400', subtext: 'text-green-400/70', icon: <ShieldCheck className="w-7 h-7 text-green-400" />, iconBg: 'bg-green-500/20 border-green-500/40', title: 'SYSTEM SECURE', sub: `All ${controls.length} NIST 800-53 controls passing · Continuous ATO posture is green` }
          : overall === 'YELLOW'
          ? { bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', text: 'text-yellow-400', subtext: 'text-yellow-400/70', icon: <ShieldAlert className="w-7 h-7 text-yellow-400" />, iconBg: 'bg-yellow-500/20 border-yellow-500/40', title: 'ATTENTION REQUIRED', sub: `${warnCount} control${warnCount !== 1 ? 's' : ''} require review · ${failCount > 0 ? failCount + ' failing' : 'No failures detected'} · Click to expand all issues` }
          : { bg: 'bg-red-500/10', border: 'border-red-500/40', text: 'text-red-400', subtext: 'text-red-400/70', icon: <ShieldX className="w-7 h-7 text-red-400" />, iconBg: 'bg-red-500/20 border-red-500/40', title: 'SECURITY ALERT', sub: `${failCount} control${failCount !== 1 ? 's' : ''} failing${warnCount > 0 ? ` · ${warnCount} warning${warnCount > 1 ? 's' : ''}` : ''} · Click to expand all issues` };
        return (
          <div className={`rounded-xl border overflow-hidden ${bannerConfig.bg} ${bannerConfig.border}`}>
            {/* Banner row */}
            <button
              onClick={() => hasIssues && setIssuesExpanded(prev => !prev)}
              className={`w-full flex items-center justify-between gap-4 p-5 transition-all ${hasIssues ? 'hover:brightness-110 cursor-pointer' : 'cursor-default'}`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl border ${bannerConfig.iconBg}`}>
                  {bannerConfig.icon}
                </div>
                <div className="text-left">
                  <p className={`text-lg font-bold ${bannerConfig.text}`}>{bannerConfig.title}</p>
                  <p className={`text-sm mt-0.5 ${bannerConfig.subtext}`}>{bannerConfig.sub}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-right flex-shrink-0">
                <div className="text-xs text-slate-500 text-right">
                  <p>Last assessed</p>
                  <p className="text-slate-400">{fmtShort(posture.lastUpdated)}</p>
                </div>
                {hasIssues && (
                  <div className={`p-2 rounded-lg border transition-transform ${bannerConfig.iconBg} ${issuesExpanded ? 'rotate-180' : ''}`}>
                    <ChevronDown className={`w-4 h-4 ${bannerConfig.text}`} />
                  </div>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); load(true); }}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 rounded-lg text-xs transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </button>

            {/* Expanded issues list — all FAIL then WARN controls */}
            {issuesExpanded && hasIssues && (
              <div className="border-t border-slate-700/40 divide-y divide-slate-700/30">
                {issueControls.map(ctrl => (
                  <button
                    key={ctrl.id}
                    onClick={() => { setSelectedControl(ctrl); setIssuesExpanded(false); }}
                    className="w-full flex items-start gap-4 px-5 py-3.5 text-left hover:bg-slate-800/50 transition-colors group"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {ctrl.status === 'FAIL'
                        ? <XCircle    className="w-4 h-4 text-red-400" />
                        : <AlertCircle className="w-4 h-4 text-yellow-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono font-bold text-slate-400 bg-slate-700/60 px-1.5 py-0.5 rounded">
                          {ctrl.id}
                        </span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${ctrl.status === 'FAIL' ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'}`}>
                          {ctrl.status}
                        </span>
                        <span className="text-xs font-medium text-slate-300">{ctrl.name}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{ctrl.detail}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 flex-shrink-0 mt-0.5" />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Key Metrics (each metric card is clickable → linked NIST control) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Failed Logins → click navigates to Audit Log filtered by USER_LOGIN_FAILED */}
        <button
          onClick={() => metrics.failedLogins24h > 0 ? onSwitchToAudit?.('USER_LOGIN_FAILED') : setSelectedControl(controls.find(c => c.id === 'AC-7') ?? null)}
          className={`rounded-xl p-4 border text-left transition-all hover:brightness-110 group ${metrics.failedLogins24h === 0 ? 'bg-slate-900/60 border-slate-700/50' : metrics.failedLogins24h < 20 ? 'bg-yellow-500/5 border-yellow-500/30' : 'bg-red-500/5 border-red-500/30'}`}
        >
          <div className="flex items-start justify-between">
            <Shield className="w-5 h-5 text-slate-500 mt-0.5" />
            <div className="flex items-center gap-1">
              {metrics.failedLogins24h >= 20 && <AlertCircle className="w-4 h-4 text-red-400" />}
              {metrics.failedLogins24h > 0 && metrics.failedLogins24h < 20 && <AlertCircle className="w-4 h-4 text-yellow-400" />}
              <span className={`text-[10px] font-mono ${metrics.failedLogins24h > 0 ? 'text-slate-400' : 'text-slate-600 group-hover:text-slate-400'}`}>
                {metrics.failedLogins24h > 0 ? 'View logs ›' : 'AC-7 ›'}
              </span>
            </div>
          </div>
          <p className={`text-2xl font-bold mt-2 ${metrics.failedLogins24h === 0 ? 'text-white' : metrics.failedLogins24h < 20 ? 'text-yellow-400' : 'text-red-400'}`}>
            {metrics.failedLogins24h}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Failed Logins (24h)</p>
        </button>

        {/* Locked Accounts → AC-2 */}
        <button
          onClick={() => setSelectedControl(controls.find(c => c.id === 'AC-2') ?? null)}
          className={`rounded-xl p-4 border text-left transition-all hover:brightness-110 group ${metrics.lockedUsers === 0 ? 'bg-slate-900/60 border-slate-700/50' : 'bg-orange-500/5 border-orange-500/30'}`}
        >
          <div className="flex items-start justify-between">
            <Lock className="w-5 h-5 text-slate-500 mt-0.5" />
            <div className="flex items-center gap-1">
              {metrics.lockedUsers > 0 && <AlertCircle className="w-4 h-4 text-orange-400" />}
              <span className="text-[10px] text-slate-600 group-hover:text-slate-400 font-mono">AC-2 ›</span>
            </div>
          </div>
          <p className={`text-2xl font-bold mt-2 ${metrics.lockedUsers === 0 ? 'text-white' : 'text-orange-400'}`}>
            {metrics.lockedUsers}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Locked Accounts</p>
        </button>

        {/* MFA Adoption → IA-5 */}
        <button
          onClick={() => setSelectedControl(controls.find(c => c.id === 'IA-5') ?? null)}
          className={`rounded-xl p-4 border text-left transition-all hover:brightness-110 group ${metrics.mfaAdoptionPct >= 80 ? 'bg-slate-900/60 border-slate-700/50' : metrics.mfaAdoptionPct >= 40 ? 'bg-yellow-500/5 border-yellow-500/30' : 'bg-red-500/5 border-red-500/30'}`}
        >
          <div className="flex items-start justify-between">
            <UserCheck className="w-5 h-5 text-slate-500 mt-0.5" />
            <span className={`text-[10px] font-mono group-hover:text-slate-400 ${metrics.mfaAdoptionPct >= 80 ? 'text-slate-600' : metrics.mfaAdoptionPct >= 40 ? 'text-yellow-500/70' : 'text-red-500/70'}`}>
              IA-5 ›
            </span>
          </div>
          <p className={`text-2xl font-bold mt-2 ${metrics.mfaAdoptionPct >= 80 ? 'text-white' : metrics.mfaAdoptionPct >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
            {metrics.mfaAdoptionPct}%
          </p>
          <p className="text-xs text-slate-500 mt-0.5">MFA Adoption ({metrics.mfaEnabledUsers}/{metrics.totalUsers})</p>
        </button>

        {/* Active Users (24h) → modal list */}
        <button
          onClick={() => setShowActiveUsers(true)}
          className="rounded-xl p-4 border bg-slate-900/60 border-slate-700/50 text-left transition-all hover:brightness-110 group"
        >
          <div className="flex items-start justify-between">
            <Activity className="w-5 h-5 text-slate-500 mt-0.5" />
            <span className="text-[10px] text-slate-600 group-hover:text-slate-400 font-mono">View ›</span>
          </div>
          <p className="text-2xl font-bold mt-2 text-white">{metrics.activeSessions}</p>
          <p className="text-xs text-slate-500 mt-0.5">Active Users (24h)</p>
        </button>
      </div>

      {/* ── Infrastructure Health (each card → linked NIST control) ─────────── */}
      {infrastructure && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* PostgreSQL → AU-12 */}
          <button
            onClick={() => setSelectedControl(controls.find(c => c.id === 'AU-12') ?? null)}
            className={`rounded-xl p-4 border flex items-start gap-3 text-left transition-all hover:brightness-110 group ${
              infrastructure.postgres.error
                ? 'bg-red-500/5 border-red-500/30'
                : 'bg-slate-900/60 border-slate-700/50'
            }`}
          >
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg flex-shrink-0">
              <Database className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-slate-300">PostgreSQL</p>
                  {infrastructure.postgres.error
                    ? <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded px-1.5 py-0.5">Error</span>
                    : <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded px-1.5 py-0.5">Healthy</span>
                  }
                </div>
                <span className="text-[10px] text-slate-600 group-hover:text-slate-400 font-mono flex-shrink-0">AU-12 ›</span>
              </div>
              <p className="text-xs text-slate-500 truncate">
                {infrastructure.postgres.error ?? infrastructure.postgres.version}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                {infrastructure.postgres.activeConnections}/{infrastructure.postgres.maxConnections} conns · {infrastructure.postgres.dbSizeMb} MB
              </p>
            </div>
          </button>

          {/* Redis → SC-23 */}
          <button
            onClick={() => setSelectedControl(controls.find(c => c.id === 'SC-23') ?? null)}
            className={`rounded-xl p-4 border flex items-start gap-3 text-left transition-all hover:brightness-110 group ${
              !infrastructure.redis.alive
                ? 'bg-red-500/5 border-red-500/30'
                : 'bg-slate-900/60 border-slate-700/50'
            }`}
          >
            <div className={`p-2 border rounded-lg flex-shrink-0 ${
              infrastructure.redis.alive
                ? 'bg-orange-500/10 border-orange-500/20'
                : 'bg-red-500/10 border-red-500/20'
            }`}>
              <Server className={`w-4 h-4 ${infrastructure.redis.alive ? 'text-orange-400' : 'text-red-400'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-slate-300">Redis</p>
                  {infrastructure.redis.alive
                    ? <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded px-1.5 py-0.5">Healthy</span>
                    : <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded px-1.5 py-0.5">Unreachable</span>
                  }
                </div>
                <span className="text-[10px] text-slate-600 group-hover:text-slate-400 font-mono flex-shrink-0">SC-23 ›</span>
              </div>
              <p className="text-xs text-slate-500 truncate">
                {infrastructure.redis.error ?? infrastructure.redis.info ?? 'Redis 7 · Session store'}
              </p>
              {infrastructure.redis.alive && (
                <p className="text-xs text-slate-600 mt-0.5">{infrastructure.redis.latencyMs} ms PING latency</p>
              )}
            </div>
          </button>

          {/* Nginx → SC-7 */}
          <button
            onClick={() => setSelectedControl(controls.find(c => c.id === 'SC-7') ?? null)}
            className={`rounded-xl p-4 border flex items-start gap-3 text-left transition-all hover:brightness-110 group ${
              !infrastructure.nginx.reachable
                ? 'bg-red-500/5 border-red-500/30'
                : 'bg-slate-900/60 border-slate-700/50'
            }`}
          >
            <div className={`p-2 border rounded-lg flex-shrink-0 ${
              infrastructure.nginx.reachable
                ? 'bg-green-500/10 border-green-500/20'
                : 'bg-red-500/10 border-red-500/20'
            }`}>
              {infrastructure.nginx.reachable
                ? <Wifi className="w-4 h-4 text-green-400" />
                : <WifiOff className="w-4 h-4 text-red-400" />
              }
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-slate-300">Nginx</p>
                  {infrastructure.nginx.reachable
                    ? <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded px-1.5 py-0.5">Healthy</span>
                    : <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded px-1.5 py-0.5">Unreachable</span>
                  }
                </div>
                <span className="text-[10px] text-slate-600 group-hover:text-slate-400 font-mono flex-shrink-0">SC-7 ›</span>
              </div>
              <p className="text-xs text-slate-500 truncate">
                {infrastructure.nginx.error ?? `HTTP ${infrastructure.nginx.statusCode} · ${infrastructure.nginx.headerCount} headers`}
              </p>
              {infrastructure.nginx.reachable && (
                <p className="text-xs text-slate-600 mt-0.5">{infrastructure.nginx.latencyMs} ms response</p>
              )}
            </div>
          </button>
        </div>
      )}

      {/* ── Control Summary + Live Update Schedule ───────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl overflow-hidden">
        {/* Counts + countdown */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-slate-700/30">
          <p className="text-slate-400 font-medium text-xs uppercase tracking-wider">Controls</p>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            <span className="text-green-400 font-semibold text-sm">{passCount}</span>
            <span className="text-slate-500 text-xs">PASS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-yellow-400 font-semibold text-sm">{warnCount}</span>
            <span className="text-slate-500 text-xs">WARN</span>
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-red-400 font-semibold text-sm">{failCount}</span>
            <span className="text-slate-500 text-xs">FAIL</span>
          </div>
          <div className="flex-1" />
          {/* Countdown ring */}
          <div className="flex items-center gap-2.5">
            <div className="relative w-7 h-7 flex-shrink-0">
              <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
                <circle cx="14" cy="14" r="11" fill="none" stroke="#1e293b" strokeWidth="3" />
                <circle
                  cx="14" cy="14" r="11" fill="none"
                  stroke={countdown < 10 ? '#f59e0b' : '#3b82f6'}
                  strokeWidth="3"
                  strokeDasharray={String(2 * Math.PI * 11)}
                  strokeDashoffset={String(2 * Math.PI * 11 * (1 - countdown / REFRESH_INTERVAL_S))}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-slate-400">
                {countdown}
              </span>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-300 font-medium">Next refresh in {countdown}s</p>
              <p className="text-xs text-slate-600">Auto every {REFRESH_INTERVAL_S}s</p>
            </div>
          </div>
        </div>
        {/* Data schedule legend */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-5 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            <span className="text-[11px] text-slate-500">
              <span className="text-slate-400 font-medium">DB metrics</span> — live on refresh · prisma.user / auditLog / session counts
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
            <span className="text-[11px] text-slate-500">
              <span className="text-slate-400 font-medium">Infra probes</span> — live on refresh · PostgreSQL · Redis PING · Nginx HTTP HEAD
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
            <span className="text-[11px] text-slate-500">
              <span className="text-slate-400 font-medium">NIST CSF scores</span> — exercise decisions · refreshed on demand
            </span>
          </div>
          <div className="flex-1" />
          <span className="text-[11px] text-slate-600">{controls.length} controls · 9 families · NIST SP 800-53 Rev 5 · Click any row for detail</span>
        </div>
      </div>

      {/* ── NIST 800-53 Control Matrix ────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          NIST SP 800-53 Rev 5 — Control Matrix
        </h2>
        {controlsByFamily.map(({ family, label, controls: familyControls }) => (
          <div key={family} className="bg-slate-900/60 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-700/50 bg-slate-800/40">
              <span className="text-xs font-bold text-slate-400 font-mono bg-slate-700/60 px-2 py-0.5 rounded">
                {family}
              </span>
              <span className="text-sm font-medium text-slate-300">{label}</span>
              <div className="flex-1" />
              <div className="flex gap-1.5">
                {familyControls.map((c) => (
                  <span
                    key={c.id}
                    className={`w-2.5 h-2.5 rounded-full ${c.status === 'PASS' ? 'bg-green-500' : c.status === 'WARN' ? 'bg-yellow-500' : 'bg-red-500'}`}
                    title={`${c.id}: ${c.status}`}
                  />
                ))}
              </div>
            </div>
            <div className="divide-y divide-slate-700/30">
              {familyControls.map((control) => (
                <button
                  key={control.id}
                  onClick={() => setSelectedControl(control)}
                  className={`w-full flex items-start gap-4 px-5 py-3.5 text-left transition-colors group ${
                    selectedControl?.id === control.id
                      ? 'bg-blue-500/10 border-l-2 border-l-blue-500'
                      : 'hover:bg-slate-800/40 border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-shrink-0 w-36">
                    {control.status === 'PASS' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    ) : control.status === 'WARN' ? (
                      <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    )}
                    <span className="text-xs font-mono font-bold text-slate-400">{control.id}</span>
                    <span
                      className={`text-xs font-bold px-1.5 py-0.5 rounded border ${
                        control.status === 'PASS'
                          ? 'bg-green-500/15 text-green-400 border-green-500/30'
                          : control.status === 'WARN'
                          ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                          : 'bg-red-500/15 text-red-400 border-red-500/30'
                      }`}
                    >
                      {control.status}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                      {control.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{control.description}</p>
                    {/* Component badges — compact row */}
                    {control.components && control.components.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {control.components.map((c) => (
                          <span
                            key={c}
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              COMPONENT_COLORS[c] ?? 'bg-slate-600/30 text-slate-500 border border-slate-600/40'
                            }`}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right max-w-[200px] hidden lg:block">
                      <p className="text-xs text-slate-400 line-clamp-2">{control.detail}</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── NIST CSF Exercise Performance ────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/50">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-300">NIST Cybersecurity Framework — Exercise Performance</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Aggregated decision scores from tabletop exercises mapped to CSF functions
                {posture.nistCsfTotalDecisions > 0 && ` · ${posture.nistCsfTotalDecisions} total decisions analyzed`}
              </p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-5">
          {Object.entries(CSF_META).map(([fn, meta]) => {
            const score = nistCsfPerformance[fn];
            const count = nistCsfDecisionCounts[fn] ?? 0;
            const barColor = score !== null ? scoreBarColor(score) : 'bg-slate-700';
            const barWidth = score !== null ? `${score}%` : '0%';

            return (
              <div key={fn}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${CSF_BAR_COLORS[meta.color]}`} />
                    <span className="text-sm font-medium text-slate-200">{meta.label}</span>
                    <span className="text-xs text-slate-500">{meta.description}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {score !== null ? (
                      <>
                        <span className={`text-sm font-bold ${scoreColor(score)}`}>{score}%</span>
                        {score < 60 && (
                          <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/30 rounded px-1.5 py-0.5 font-medium">
                            Training Gap
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 italic">No exercise data</span>
                    )}
                    <span className="text-xs text-slate-600 w-20 text-right">
                      {count > 0 ? `${count} decision${count !== 1 ? 's' : ''}` : 'No data'}
                    </span>
                  </div>
                </div>
                <div className="h-2.5 bg-slate-700/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                    style={{ width: barWidth }}
                  />
                </div>
              </div>
            );
          })}

          {posture.nistCsfTotalDecisions === 0 && (
            <div className="text-center py-4 text-slate-500 text-sm">
              Run tabletop exercises to populate CSF performance data. Exercises with NIST CSF-tagged injects will appear here.
            </div>
          )}
        </div>
      </div>

      {/* ── Active Users Modal ───────────────────────────────────────────────── */}
      {showActiveUsers && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowActiveUsers(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-semibold text-white">Active Users (Last 24 h)</h2>
                <span className="ml-1 text-xs font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-full px-2 py-0.5">
                  {metrics.activeSessions}
                </span>
              </div>
              <button
                onClick={() => setShowActiveUsers(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User list */}
            <div className="overflow-y-auto max-h-[60vh]">
              {(metrics.activeUsersList ?? []).length === 0 ? (
                <div className="px-5 py-10 text-center text-slate-500 text-sm">
                  No users have authenticated in the last 24 hours.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 border-b border-slate-700/50">
                      <th className="px-5 py-2.5 text-left font-medium">User</th>
                      <th className="px-4 py-2.5 text-left font-medium">Role</th>
                      <th className="px-4 py-2.5 text-right font-medium">Last Login</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {(metrics.activeUsersList ?? []).map((u) => {
                      const loginDate = new Date(u.lastLoginAt);
                      const minutesAgo = Math.floor((Date.now() - loginDate.getTime()) / 60_000);
                      const timeLabel =
                        minutesAgo < 2   ? 'just now'
                        : minutesAgo < 60  ? `${minutesAgo}m ago`
                        : minutesAgo < 1440 ? `${Math.floor(minutesAgo / 60)}h ago`
                        : loginDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                      return (
                        <tr key={u.id} className="hover:bg-slate-700/20 transition-colors">
                          <td className="px-5 py-3">
                            <div className="font-medium text-white">{u.displayName}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[200px]">{u.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${ROLE_COLORS[u.role]}`}>
                              {ROLE_LABELS[u.role]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-400 text-xs tabular-nums whitespace-nowrap">
                            {timeLabel}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-700/60 text-[11px] text-slate-600">
              NIST SP 800-53 Rev 5 AC-17 · Users with a successful login event within the past 24 hours
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

// ─── SOC Audit Log Tab ────────────────────────────────────────────────────────

const AUDIT_PAGE_SIZE = 50;

type SeverityFilter   = 'ALL' | Severity;
type CategoryFilter   = 'ALL' | EventCategory;

function AuditLogTab({ initialAction = '' }: { initialAction?: string }) {
  const { get } = useApi();
  const toast = useToast();

  const [logs, setLogs]         = useState<AuditLogEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const [exporting, setExporting] = useState(false);

  // Filters — initialAction pre-populates action search (e.g. when navigating from Security Dashboard)
  const [severityFilter, setSeverityFilter]   = useState<SeverityFilter>('ALL');
  const [categoryFilter, setCategoryFilter]   = useState<CategoryFilter>('ALL');
  const [actionSearch, setActionSearch]       = useState(initialAction);
  const [startDate, setStartDate]             = useState('');
  const [endDate, setEndDate]                 = useState('');

  // Expanded rows
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(
    async (p: number) => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({
          page: String(p),
          limit: String(AUDIT_PAGE_SIZE),
        });
        if (actionSearch.trim()) params.set('action', actionSearch.trim().toUpperCase());
        if (startDate) params.set('startDate', new Date(startDate).toISOString());
        if (endDate)   params.set('endDate',   new Date(endDate + 'T23:59:59').toISOString());

        const data = await get<{ logs: AuditLogEntry[]; total: number }>(
          `/api/admin/audit-logs?${params.toString()}`,
        );

        // Client-side severity/category filter (no re-fetch needed)
        let filtered = data.logs ?? [];
        if (severityFilter !== 'ALL') {
          filtered = filtered.filter((log) => getSeverity(log.action) === severityFilter);
        }
        if (categoryFilter !== 'ALL') {
          filtered = filtered.filter((log) => getCategory(log.action) === categoryFilter);
        }

        setLogs(filtered);
        setTotal(data.total ?? 0);
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [get, severityFilter, categoryFilter, actionSearch, startDate, endDate],
  );

  useEffect(() => {
    fetchLogs(page);
  }, [fetchLogs, page]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [severityFilter, categoryFilter, actionSearch, startDate, endDate]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ export: '1' });
      if (actionSearch.trim()) params.set('action', actionSearch.trim().toUpperCase());
      if (startDate) params.set('startDate', new Date(startDate).toISOString());
      if (endDate)   params.set('endDate',   new Date(endDate + 'T23:59:59').toISOString());

      const data = await get<{ logs: AuditLogEntry[] }>(
        `/api/admin/audit-logs?${params.toString()}`,
      );

      let toExport = data.logs ?? [];
      if (severityFilter !== 'ALL') {
        toExport = toExport.filter((log) => getSeverity(log.action) === severityFilter);
      }
      if (categoryFilter !== 'ALL') {
        toExport = toExport.filter((log) => getCategory(log.action) === categoryFilter);
      }

      const ts = new Date().toISOString().slice(0, 10);
      exportCsv(toExport, `audit-log-${ts}.csv`);
      toast(`Exported ${toExport.length} events`, 'success');
    } catch (err: unknown) {
      toast((err as Error).message ?? 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(total / AUDIT_PAGE_SIZE);

  return (
    <div className="space-y-4">

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Severity */}
        <div className="relative">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
            className="appearance-none bg-slate-700 border border-slate-600 rounded-lg pl-3 pr-7 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">All Severities</option>
            {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as Severity[]).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <Filter className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
        </div>

        {/* Category */}
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
            className="appearance-none bg-slate-700 border border-slate-600 rounded-lg pl-3 pr-7 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {(['AUTH', 'ACCESS', 'DATA', 'CONFIG'] as EventCategory[]).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Filter className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
        </div>

        {/* Action search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={actionSearch}
            onChange={(e) => setActionSearch(e.target.value)}
            placeholder="Filter by action…"
            className="bg-slate-700 border border-slate-600 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 w-48"
          />
        </div>

        {/* Date range */}
        <div className="relative">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          />
        </div>
        <span className="text-slate-600 text-xs">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
        />

        <div className="flex-1" />

        {/* Export */}
        <button
          onClick={handleExportCsv}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 rounded-lg text-xs transition-colors"
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Export CSV
        </button>
      </div>

      {/* ── Severity legend ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 px-1">
        {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as Severity[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${SEVERITY_DOT[s]}`} />
            <span className="text-xs text-slate-500">{s}</span>
          </div>
        ))}
        <div className="flex-1" />
        <span className="text-xs text-slate-600">{total.toLocaleString()} events</span>
      </div>

      {/* ── Error / Loading ──────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Log Table ───────────────────────────────────────────────────── */}
          <div className="overflow-x-auto rounded-xl border border-slate-700/50">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/60 border-b border-slate-700/50">
                  <th className="text-left px-4 py-3 text-slate-500 font-medium uppercase tracking-wider whitespace-nowrap">Timestamp</th>
                  <th className="text-left px-3 py-3 text-slate-500 font-medium uppercase tracking-wider">Sev</th>
                  <th className="text-left px-3 py-3 text-slate-500 font-medium uppercase tracking-wider hidden md:table-cell">Cat</th>
                  <th className="text-left px-3 py-3 text-slate-500 font-medium uppercase tracking-wider">Action</th>
                  <th className="text-left px-3 py-3 text-slate-500 font-medium uppercase tracking-wider hidden lg:table-cell">User</th>
                  <th className="text-left px-3 py-3 text-slate-500 font-medium uppercase tracking-wider hidden xl:table-cell">IP Address</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {logs.map((log) => {
                  const sev = getSeverity(log.action);
                  const cat = getCategory(log.action);
                  const isExpanded = expandedId === log.id;
                  return (
                    <Fragment key={log.id}>
                      <tr
                        className={`hover:bg-slate-700/20 transition-colors cursor-pointer ${
                          sev === 'CRITICAL' ? 'bg-red-500/5' : sev === 'HIGH' ? 'bg-orange-500/5' : ''
                        }`}
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      >
                        <td className="px-4 py-2.5 font-mono text-slate-400 whitespace-nowrap">
                          {fmtShort(log.timestamp)}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SEVERITY_DOT[sev]}`} />
                            <span className={`font-medium ${SEVERITY_COLORS[sev].split(' ')[1]}`}>{sev}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[cat]}`}>
                            {cat}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-slate-200">{log.action}</span>
                          {log.resource && (
                            <span className="text-slate-600 ml-1.5 text-xs">
                              {log.resource.slice(0, 12)}…
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-400 hidden lg:table-cell">
                          {log.user?.email ?? log.userId ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-500 hidden xl:table-cell">
                          {log.ipAddress ?? '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          {isExpanded
                            ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                            : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr className="bg-slate-900/80 border-b border-slate-700/50">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-3">
                              <div>
                                <p className="text-slate-500 uppercase tracking-wider mb-1">Event ID</p>
                                <p className="font-mono text-slate-300">{log.id}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 uppercase tracking-wider mb-1">User</p>
                                <p className="text-slate-300">{log.user?.displayName ?? '—'}</p>
                                <p className="text-slate-500">{log.user?.email ?? log.userId ?? '—'}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 uppercase tracking-wider mb-1">Network</p>
                                <p className="font-mono text-slate-300">{log.ipAddress ?? '—'}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 uppercase tracking-wider mb-1">Resource</p>
                                <p className="font-mono text-slate-300 break-all">{log.resource ?? '—'}</p>
                              </div>
                            </div>
                            {log.userAgent && (
                              <div className="mb-3">
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">User Agent</p>
                                <p className="text-xs text-slate-400 font-mono break-all">{log.userAgent}</p>
                              </div>
                            )}
                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                              <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Metadata</p>
                                <pre className="text-xs text-slate-300 bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 overflow-x-auto">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            {logs.length === 0 && !loading && (
              <div className="text-center py-12 text-slate-500 text-sm">
                No audit events match the current filters.
              </div>
            )}
          </div>

          {/* ── Pagination ──────────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-500">
                Page {page} of {totalPages} · {total.toLocaleString()} events
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 rounded-lg text-xs transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 rounded-lg text-xs transition-colors"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const { get, patch } = useApi();
  const toast = useToast();

  const [users, setUsers]         = useState<UserRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  useEffect(() => {
    get<{ users: UserRecord[] }>('/api/users')
      .then((data) => setUsers(data.users ?? []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [get]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingRole(userId);
    try {
      const updated = await patch<{ user: { id: string; email: string; role: UserRole } }>(
        `/api/users/${userId}/role`,
        { role: newRole },
      );
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: updated.user.role } : u)));
      toast(`Role updated to ${ROLE_LABELS[newRole]}`, 'success');
    } catch (err: unknown) {
      toast((err as Error).message ?? 'Failed to update role', 'error');
    } finally {
      setUpdatingRole(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3 text-red-400 text-sm">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        {error}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-700">
            <th className="text-left pb-3 pr-4">Name</th>
            <th className="text-left pb-3 pr-4">Email</th>
            <th className="text-left pb-3 pr-4">Role</th>
            <th className="text-left pb-3 pr-4 hidden sm:table-cell">MFA</th>
            <th className="text-left pb-3 pr-4 hidden lg:table-cell">Last Login</th>
            <th className="text-left pb-3 hidden md:table-cell">Joined</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {users.map((user) => {
            const isLocked = user.lockedUntil && new Date(user.lockedUntil) > new Date();
            return (
              <tr key={user.id} className="hover:bg-slate-700/20 transition-colors">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-200 font-medium">{user.displayName}</span>
                    {isLocked && (
                      <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/40 rounded px-1.5 py-0.5">
                        Locked
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 pr-4 text-slate-400">{user.email}</td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded border font-medium ${
                        ROLE_COLORS[user.role] ?? 'bg-slate-700 text-slate-400 border-slate-600'
                      }`}
                    >
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                    <div className="relative">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                        disabled={updatingRole === user.id}
                        className="appearance-none bg-slate-700 border border-slate-600 rounded-md pl-2 pr-6 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {ALL_ROLES.map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                      {updatingRole === user.id ? (
                        <Loader2 className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-400 animate-spin pointer-events-none" />
                      ) : (
                        <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-4 hidden sm:table-cell">
                  {user.mfaEnabled ? (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <Eye className="w-3 h-3" /> On
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <EyeOff className="w-3 h-3" /> Off
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 text-slate-500 hidden lg:table-cell">
                  {fmt(user.lastLoginAt)}
                </td>
                <td className="py-3 text-slate-500 hidden md:table-cell">
                  {fmt(user.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {users.length === 0 && (
        <div className="text-center py-10 text-slate-500 text-sm">No users found.</div>
      )}
    </div>
  );
}

// ─── AI Config Tab ────────────────────────────────────────────────────────────

function OrgConfigTab() {
  const { get, put } = useApi();
  const toast = useToast();
  const setUser = useAuthStore((s) => s.setUser);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<OrgConfigRecord | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [roleNamesText, setRoleNamesText] = useState('');
  const [divisionNamesText, setDivisionNamesText] = useState('');
  const [orgContextNotes, setOrgContextNotes] = useState('');

  const applyConfig = (next: OrgConfigRecord) => {
    setConfig(next);
    setOrganizationName(next.organizationName ?? '');
    setWebsiteUrl(next.websiteUrl ?? '');
    setRoleNamesText(arrayToLines(next.roleNames ?? []));
    setDivisionNamesText(arrayToLines(next.divisionNames ?? []));
    setOrgContextNotes(next.orgContextNotes ?? '');
  };

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await get<OrgConfigRecord>('/api/admin/org-config');
      applyConfig(data);
    } catch (err) {
      setError((err as Error).message ?? 'Failed to load organization settings');
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const saved = await put<OrgConfigRecord>('/api/admin/org-config', {
        organizationName,
        websiteUrl,
        roleNames: linesToArray(roleNamesText),
        divisionNames: linesToArray(divisionNamesText),
        orgContextNotes,
      });
      await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      const me = await fetch('/api/auth/me', { credentials: 'include' });
      if (me.ok) {
        const data = await me.json() as { user: { id: string; email: string; displayName: string; role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'FACILITATOR' | 'PLAYER'; orgId?: string; mfaEnabled?: boolean } };
        setUser(data.user);
      }
      applyConfig(saved);
      toast('Organization settings saved', 'success');
    } catch (err) {
      const message = (err as Error).message ?? 'Failed to save organization settings';
      setError(message);
      toast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Organization Config</h2>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Add optional organization context that the AI can reuse across sessions. Leave any field blank to keep the current default behavior for that item.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Config
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-6">
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Core Context</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                  Organization Name <span className="text-slate-600 normal-case font-normal">(optional)</span>
                </label>
                <input
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="Leave blank to use the app's normal naming logic"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Optional AI override only. Leave it blank to keep the existing naming behavior. If you save other org settings before your account has an organization, the app can still create an internal org record automatically without using this as the public org name.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                  Website URL <span className="text-slate-600 normal-case font-normal">(optional)</span>
                </label>
                <input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://www.example.org"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Saving refreshes a short website-derived summary that the AI can use as company context.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                  Additional Org Notes <span className="text-slate-600 normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  value={orgContextNotes}
                  onChange={(e) => setOrgContextNotes(e.target.value)}
                  rows={5}
                  placeholder="Mission, internal naming, sensitive programs, special constraints, or any stable context the AI should respect."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-y"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Preferred Roles / Teams</h3>
              </div>
              <textarea
                value={roleNamesText}
                onChange={(e) => setRoleNamesText(e.target.value)}
                rows={9}
                placeholder={'Incident Commander\nIR Lead / SOC Analyst\nLegal / Compliance\nExecutive Team'}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-y"
              />
              <p className="text-xs text-slate-500 mt-2">
                One role per line. These labels will take priority in AI-generated session language when they are present.
              </p>
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Server className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">Division Names</h3>
              </div>
              <textarea
                value={divisionNamesText}
                onChange={(e) => setDivisionNamesText(e.target.value)}
                rows={9}
                placeholder={'Operations\nFinance\nMember Services\nField Engineering'}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500 resize-y"
              />
              <p className="text-xs text-slate-500 mt-2">
                One division per line. The AI can use these names when it describes business impact and who gets pulled into the response.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-5">
            <div className="flex items-center gap-2 mb-3">
              <ExternalLink className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Website Context</h3>
            </div>

            {config?.websiteUrl ? (
              <div className="space-y-3">
                <a
                  href={config.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                >
                  Open website
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <div className="text-xs text-slate-500">
                  Last fetched: {fmt(config.websiteLastFetchedAt)}
                </div>
                {config.websiteFetchError && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                    Website fetch issue: {config.websiteFetchError}
                  </div>
                )}
                <div className="rounded-lg border border-slate-700 bg-slate-950/80 p-3 text-sm text-slate-300 whitespace-pre-wrap leading-6 max-h-[340px] overflow-y-auto">
                  {config.websiteSummary || 'No website summary captured yet.'}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">
                No website configured. The AI will continue using only the normal session context.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-white">Priority Rules</h3>
            </div>
            <div className="space-y-2 text-sm text-slate-400">
              <p>When org settings exist, they become the preferred context for AI-generated sessions, AI-driven injects, facilitator scripts, and AI debriefs.</p>
              <p>Blank org-config fields stay out of the prompt, so those parts of the app still behave the same way they do now.</p>
              <p>Saving again refreshes the website-derived company context.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type ProviderType = 'ollama' | 'anthropic' | 'openai';

interface OllamaSettings  { baseUrl: string; model: string; apiKey: string; temperature: number; numPredict: number; numCtx: number; }
interface AnthropicSettings { apiKey: string; model: string; maxTokens: number; temperature: number; }
interface OpenAISettings  { baseUrl: string; apiKey: string; model: string; maxTokens: number; temperature: number; }
type ProviderSettings = OllamaSettings | AnthropicSettings | OpenAISettings;

interface ProviderRow {
  provider: ProviderType;
  isActive: boolean;
  settings: ProviderSettings;
  updatedAt?: string;
  updatedByEmail?: string;
}

interface TestResult { success: boolean; latencyMs: number; message: string; models?: string[]; }

const PROVIDER_META: Record<ProviderType, { label: string; icon: string; color: string }> = {
  ollama:     { label: 'Ollama',              icon: '🦙', color: 'text-green-400'  },
  anthropic:  { label: 'Anthropic / Claude',  icon: '🤖', color: 'text-purple-400' },
  openai:     { label: 'OpenAI-compatible',   icon: '⚡', color: 'text-yellow-400' },
};

const CLAUDE_MODELS = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];

function SettingsForm({
  provider,
  settings,
  onChange,
}: {
  provider: ProviderType;
  settings: ProviderSettings;
  onChange: (s: ProviderSettings) => void;
}) {
  const set = settings as unknown as Record<string, unknown>;
  const update = (key: string, value: unknown) => onChange({ ...set, [key]: value } as unknown as ProviderSettings);

  const inputCls = 'w-full bg-slate-900/80 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500';
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1';
  const [showKey, setShowKey] = useState(false);

  if (provider === 'ollama') {
    const s = settings as OllamaSettings;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Base URL</label>
            <input className={inputCls} value={s.baseUrl} onChange={e => update('baseUrl', e.target.value)} placeholder="http://host.docker.internal:11434" />
          </div>
          <div>
            <label className={labelCls}>Model Name</label>
            <input className={inputCls} value={s.model} onChange={e => update('model', e.target.value)} placeholder="llama3" />
          </div>
        </div>
        <div>
          <label className={labelCls}>API Key <span className="text-slate-600">(optional — leave blank for unauthenticated)</span></label>
          <div className="relative">
            <input className={inputCls + ' pr-10'} type={showKey ? 'text' : 'password'} value={s.apiKey} onChange={e => update('apiKey', e.target.value)} placeholder="Bearer token if required" />
            <button onClick={() => setShowKey(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs">{showKey ? 'Hide' : 'Show'}</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Temperature <span className="text-slate-500">({s.temperature})</span></label>
            <input type="range" min="0" max="1" step="0.05" value={s.temperature} onChange={e => update('temperature', parseFloat(e.target.value))} className="w-full accent-blue-500" />
          </div>
          <div>
            <label className={labelCls}>Max Output Tokens (num_predict)</label>
            <input className={inputCls} type="number" min="512" max="32768" step="512" value={s.numPredict} onChange={e => update('numPredict', parseInt(e.target.value))} />
          </div>
          <div>
            <label className={labelCls}>Context Window (num_ctx)</label>
            <input className={inputCls} type="number" min="2048" max="131072" step="1024" value={s.numCtx} onChange={e => update('numCtx', parseInt(e.target.value))} />
          </div>
        </div>
      </div>
    );
  }

  if (provider === 'anthropic') {
    const s = settings as AnthropicSettings;
    return (
      <div className="space-y-4">
        <div>
          <label className={labelCls}>API Key</label>
          <div className="relative">
            <input className={inputCls + ' pr-10'} type={showKey ? 'text' : 'password'} value={s.apiKey} onChange={e => update('apiKey', e.target.value)} placeholder="sk-ant-..." />
            <button onClick={() => setShowKey(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs">{showKey ? 'Hide' : 'Show'}</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Model</label>
            <select className={inputCls} value={s.model} onChange={e => update('model', e.target.value)}>
              {CLAUDE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Max Tokens</label>
            <input className={inputCls} type="number" min="256" max="16384" step="256" value={s.maxTokens} onChange={e => update('maxTokens', parseInt(e.target.value))} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Temperature <span className="text-slate-500">({s.temperature})</span></label>
          <input type="range" min="0" max="1" step="0.05" value={s.temperature} onChange={e => update('temperature', parseFloat(e.target.value))} className="w-full accent-purple-500" />
        </div>
      </div>
    );
  }

  // openai
  const s = settings as OpenAISettings;
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Base URL <span className="text-slate-600">(e.g. http://localhost:11434 for Ollama OpenAI-compat, or https://api.openai.com)</span></label>
        <input className={inputCls} value={s.baseUrl} onChange={e => update('baseUrl', e.target.value)} placeholder="https://api.openai.com" />
      </div>
      <div>
        <label className={labelCls}>API Key</label>
        <div className="relative">
          <input className={inputCls + ' pr-10'} type={showKey ? 'text' : 'password'} value={s.apiKey} onChange={e => update('apiKey', e.target.value)} placeholder="sk-..." />
          <button onClick={() => setShowKey(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs">{showKey ? 'Hide' : 'Show'}</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Model Name</label>
          <input className={inputCls} value={s.model} onChange={e => update('model', e.target.value)} placeholder="gpt-4o" />
        </div>
        <div>
          <label className={labelCls}>Max Tokens</label>
          <input className={inputCls} type="number" min="256" max="16384" step="256" value={s.maxTokens} onChange={e => update('maxTokens', parseInt(e.target.value))} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Temperature <span className="text-slate-500">({s.temperature})</span></label>
        <input type="range" min="0" max="1" step="0.05" value={s.temperature} onChange={e => update('temperature', parseFloat(e.target.value))} className="w-full accent-yellow-500" />
      </div>
    </div>
  );
}

function AiConfigTab() {
  const { get, put, post } = useApi();
  const toast = useToast();

  const [rows, setRows]                 = useState<ProviderRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState<ProviderType>('ollama');
  const [editSettings, setEditSettings] = useState<ProviderSettings | null>(null);
  const [dirty, setDirty]               = useState(false);
  const [saving, setSaving]             = useState(false);
  const [activating, setActivating]     = useState(false);
  const [testing, setTesting]           = useState(false);
  const [testResult, setTestResult]     = useState<TestResult | null>(null);

  const loadRows = useCallback(async () => {
    try {
      const data = await get<ProviderRow[]>('/api/admin/ai-config');
      setRows(data);
      const row = data.find(r => r.provider === selected);
      if (row) setEditSettings(row.settings);
    } catch (err: unknown) {
      toast((err as Error).message ?? 'Failed to load AI config', 'error');
    } finally {
      setLoading(false);
    }
  }, [get, selected, toast]);

  useEffect(() => { loadRows(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectRow = (provider: ProviderType) => {
    setSelected(provider);
    const row = rows.find(r => r.provider === provider);
    if (row) setEditSettings(row.settings);
    setDirty(false);
    setTestResult(null);
  };

  const handleChange = (s: ProviderSettings) => {
    setEditSettings(s);
    setDirty(true);
    setTestResult(null);
  };

  const handleSave = async () => {
    if (!editSettings) return;
    setSaving(true);
    try {
      await put(`/api/admin/ai-config/${selected}`, editSettings as unknown as Record<string, unknown>);
      setDirty(false);
      toast('Settings saved', 'success');
      await loadRows();
    } catch (err: unknown) {
      toast((err as Error).message ?? 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    setActivating(true);
    try {
      await post(`/api/admin/ai-config/${selected}/activate`, {});
      toast(`${PROVIDER_META[selected].label} set as active provider`, 'success');
      await loadRows();
    } catch (err: unknown) {
      toast((err as Error).message ?? 'Activation failed', 'error');
    } finally {
      setActivating(false);
    }
  };

  const handleTest = async () => {
    if (!editSettings) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await post<TestResult>('/api/admin/ai-config/test', { provider: selected, settings: editSettings });
      setTestResult(result);
    } catch (err: unknown) {
      setTestResult({ success: false, latencyMs: 0, message: (err as Error).message ?? 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const currentRow = rows.find(r => r.provider === selected);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">
            Configure AI providers. One provider is active at a time across all features.
            DB settings override <code className="text-xs bg-slate-800 px-1 rounded">.env</code> values — changes take effect within 30 seconds.
          </p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Provider sidebar */}
        <div className="w-52 flex-shrink-0 space-y-2">
          {rows.map(row => {
            const meta = PROVIDER_META[row.provider];
            const isSel = selected === row.provider;
            return (
              <button
                key={row.provider}
                onClick={() => selectRow(row.provider)}
                className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-colors border ${
                  isSel
                    ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                    : 'text-slate-400 hover:bg-slate-700/40 hover:text-slate-200 border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-medium">
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                  </span>
                  {row.isActive && (
                    <span className="flex-shrink-0 text-xs bg-green-500/20 text-green-400 border border-green-500/40 rounded px-1.5 py-0.5">
                      active
                    </span>
                  )}
                </div>
                {row.updatedAt && (
                  <p className="text-xs text-slate-600 mt-1 truncate">
                    Updated {fmt(row.updatedAt)}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Settings panel */}
        <div className="flex-1 min-w-0 space-y-4">
          {currentRow && editSettings && (
            <>
              {/* Title + action buttons */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <span>{PROVIDER_META[selected].icon}</span>
                    <span>{PROVIDER_META[selected].label}</span>
                    {currentRow.isActive && (
                      <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/40 rounded px-2 py-0.5">Active Provider</span>
                    )}
                  </h3>
                  {currentRow.updatedByEmail && currentRow.updatedAt && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Last saved {fmt(currentRow.updatedAt)} by {currentRow.updatedByEmail}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={handleTest}
                    disabled={testing}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                    Test Connection
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !dirty}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save
                  </button>
                  {!currentRow.isActive && (
                    <button
                      onClick={handleActivate}
                      disabled={activating || dirty}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded-lg transition-colors"
                      title={dirty ? 'Save first before activating' : ''}
                    >
                      {activating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Set Active
                    </button>
                  )}
                </div>
              </div>

              {/* Dirty warning */}
              {dirty && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-amber-400 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  Unsaved changes — save before setting as active
                </div>
              )}

              {/* Test result */}
              {testResult && (
                <div className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm border ${
                  testResult.success
                    ? 'bg-green-500/10 border-green-500/30 text-green-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}>
                  {testResult.success
                    ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <p className="font-medium">{testResult.success ? 'Connected' : 'Connection failed'}</p>
                    <p className="text-xs opacity-80 mt-0.5">{testResult.message}{testResult.latencyMs > 0 ? ` · ${testResult.latencyMs}ms` : ''}</p>
                    {testResult.models && testResult.models.length > 0 && (
                      <p className="text-xs opacity-60 mt-1 truncate">Models: {testResult.models.slice(0, 5).join(', ')}{testResult.models.length > 5 ? ` +${testResult.models.length - 5} more` : ''}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Settings form */}
              <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-5">
                <SettingsForm provider={selected} settings={editSettings} onChange={handleChange} />
              </div>

              {/* Info note */}
              <div className="flex items-start gap-2 bg-slate-900/40 border border-slate-700/40 rounded-lg px-4 py-3 text-xs text-slate-500">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  Settings override <code className="bg-slate-800 px-1 rounded">.env</code> variables.
                  Only the <strong className="text-slate-400">active provider</strong> is used for AI generation.
                  The active provider takes effect within 30 seconds — no restart required.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AI Prompts Tab ───────────────────────────────────────────────────────────

interface PlaceholderDef {
  name: string;
  description: string;
  computed: boolean;
}

interface PromptTemplate {
  key: string;
  label: string;
  description: string;
  content: string;
  isCustom: boolean;
  placeholders: PlaceholderDef[];
  updatedAt?: string;
  updatedByEmail?: string;
}

function AiPromptsTab() {
  const { get, put, post } = useApi();
  const toast = useToast();

  const [templates, setTemplates]           = useState<PromptTemplate[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [selectedKey, setSelectedKey]       = useState<string | null>(null);
  const [editContent, setEditContent]       = useState('');
  const [saving, setSaving]                 = useState(false);
  const [resetting, setResetting]           = useState(false);
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [dirty, setDirty]                   = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    get<PromptTemplate[]>('/api/admin/prompt-templates')
      .then((data) => {
        setTemplates(data);
        if (data.length > 0 && !selectedKey) {
          setSelectedKey(data[0].key);
          setEditContent(data[0].content);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [get]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = templates.find((t) => t.key === selectedKey) ?? null;

  const handleSelect = (key: string) => {
    const tmpl = templates.find((t) => t.key === key);
    if (!tmpl) return;
    setSelectedKey(key);
    setEditContent(tmpl.content);
    setDirty(false);
    setShowPlaceholders(false);
  };

  const handleChange = (value: string) => {
    setEditContent(value);
    setDirty(value !== (selected?.content ?? ''));
  };

  const handleSave = async () => {
    if (!selectedKey || !editContent.trim()) return;
    setSaving(true);
    try {
      await put(`/api/admin/prompt-templates/${selectedKey}`, { content: editContent });
      setTemplates((prev) =>
        prev.map((t) =>
          t.key === selectedKey
            ? { ...t, content: editContent, isCustom: true, updatedAt: new Date().toISOString() }
            : t,
        ),
      );
      setDirty(false);
      toast('Prompt saved — will be used on the next generation', 'success');
    } catch (err: unknown) {
      toast((err as Error).message ?? 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selectedKey) return;
    const tmpl = templates.find((t) => t.key === selectedKey);
    if (!tmpl?.isCustom) return;
    setResetting(true);
    try {
      await post(`/api/admin/prompt-templates/${selectedKey}/reset`, {});
      const fresh = await get<PromptTemplate[]>('/api/admin/prompt-templates');
      setTemplates(fresh);
      const freshSelected = fresh.find((t) => t.key === selectedKey);
      if (freshSelected) setEditContent(freshSelected.content);
      setDirty(false);
      toast('Reset to default prompt', 'success');
    } catch (err: unknown) {
      toast((err as Error).message ?? 'Failed to reset', 'error');
    } finally {
      setResetting(false);
    }
  };

  const insertPlaceholder = (name: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const inserted = `{{${name}}}`;
    const next = editContent.slice(0, start) + inserted + editContent.slice(end);
    setEditContent(next);
    setDirty(next !== (selected?.content ?? ''));
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + inserted.length;
    }, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3 text-red-400 text-sm">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        {error}
      </div>
    );
  }

  return (
    <div className="flex gap-6 min-h-[600px]">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 space-y-1">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider px-2 mb-3">
          Templates
        </p>
        {templates.map((tmpl) => (
          <button
            key={tmpl.key}
            onClick={() => handleSelect(tmpl.key)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
              selectedKey === tmpl.key
                ? 'bg-blue-500/15 border border-blue-500/40 text-blue-300'
                : 'text-slate-400 hover:bg-slate-700/40 hover:text-slate-200 border border-transparent'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium truncate">{tmpl.label}</span>
              {tmpl.isCustom && (
                <span className="ml-2 flex-shrink-0 text-xs bg-purple-500/20 text-purple-400 border border-purple-500/40 rounded px-1.5 py-0.5">
                  custom
                </span>
              )}
            </div>
          </button>
        ))}
        <div className="mt-4 rounded-lg bg-slate-900/60 border border-slate-700/50 p-3 text-xs text-slate-500 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 font-medium">
            <Info className="w-3.5 h-3.5" />
            About
          </div>
          <p>Edits take effect immediately for new scenario generations. Existing scenarios are not affected.</p>
        </div>
      </div>

      {/* Editor panel */}
      <div className="flex-1 min-w-0 space-y-4">
        {selected ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-white">{selected.label}</h3>
                <p className="text-sm text-slate-400 mt-0.5">{selected.description}</p>
                {selected.isCustom && selected.updatedAt && (
                  <p className="text-xs text-slate-500 mt-1">
                    Last saved {fmt(selected.updatedAt)}
                    {selected.updatedByEmail ? ` by ${selected.updatedByEmail}` : ''}
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {selected.isCustom && (
                  <button
                    onClick={handleReset}
                    disabled={resetting || saving}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    Reset to Default
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || resetting || !dirty}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Changes
                </button>
              </div>
            </div>

            {dirty && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-amber-400 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                Unsaved changes
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => handleChange(e.target.value)}
              spellCheck={false}
              className="w-full h-80 bg-slate-900/80 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-200 font-mono resize-y focus:outline-none focus:border-blue-500 leading-relaxed"
              placeholder="Enter prompt template…"
            />

            <div className="border border-slate-700/60 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowPlaceholders((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/30 transition-colors"
              >
                <span className="font-medium">Available Placeholders ({selected.placeholders.length})</span>
                <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${showPlaceholders ? 'rotate-90' : ''}`} />
              </button>
              {showPlaceholders && (
                <div className="border-t border-slate-700/60 divide-y divide-slate-700/40">
                  {selected.placeholders.map((ph) => (
                    <div
                      key={ph.name}
                      className="flex items-start justify-between gap-4 px-4 py-2.5 hover:bg-slate-700/20 group"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-blue-300 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                            {`{{${ph.name}}}`}
                          </code>
                          <span className="text-xs text-slate-500">{ph.description}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => insertPlaceholder(ph.name)}
                        className="flex-shrink-0 text-xs text-blue-400 hover:text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                      >
                        Insert
                      </button>
                    </div>
                  ))}
                  <div className="px-4 py-2.5 bg-slate-900/40">
                    <p className="text-xs text-slate-500">
                      All placeholders are computed at runtime and replaced automatically.
                      Click <strong className="text-slate-400">Insert</strong> to add at cursor position.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Select a template from the sidebar.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AdminPage ────────────────────────────────────────────────────────────────

type Tab = 'security' | 'audit' | 'users' | 'org' | 'prompts' | 'ai';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'security', label: 'Security Dashboard', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'audit',    label: 'SOC Audit Log',       icon: <FileText className="w-4 h-4" /> },
  { id: 'users',    label: 'Users',               icon: <Users className="w-4 h-4" /> },
  { id: 'org',      label: 'Org Config',          icon: <Settings className="w-4 h-4" /> },
  { id: 'prompts',  label: 'AI Prompts',           icon: <Bot className="w-4 h-4" /> },
  { id: 'ai',       label: 'AI Config',            icon: <Wifi className="w-4 h-4" /> },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('security');
  const [auditInitialAction, setAuditInitialAction] = useState('');

  const handleSwitchToAudit = useCallback((action: string) => {
    setAuditInitialAction(action);
    setActiveTab('audit');
  }, []);

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/30">
            <Settings className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Security posture monitoring · SOC audit log · User management · AI prompts
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="flex border-b border-slate-700/50 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <div className="p-6">
            {activeTab === 'security' && <SecurityDashboardTab onSwitchToAudit={handleSwitchToAudit} />}
            {activeTab === 'audit'    && <AuditLogTab initialAction={auditInitialAction} />}
            {activeTab === 'users'    && <UsersTab />}
            {activeTab === 'org'      && <OrgConfigTab />}
            {activeTab === 'prompts'  && <AiPromptsTab />}
            {activeTab === 'ai'       && <AiConfigTab />}
          </div>
        </div>
      </div>
    </Layout>
  );
}
