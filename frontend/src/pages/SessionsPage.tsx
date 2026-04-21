import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  Loader2,
  AlertTriangle,
  Trash2,
  Play,
  FileText,
  ExternalLink,
  X,
  Filter,
  Plus,
  Copy,
  CheckCircle,
  ClipboardList,
} from 'lucide-react';
import Layout from '../components/shared/Layout';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/shared/Toaster';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Session {
  id: string;
  joinCode: string;
  status: 'LOBBY' | 'ACTIVE' | 'DEBRIEF' | 'COMPLETE';
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  scenario?: { id: string; title: string; type: string };
  _count?: { players: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  LOBBY:    'bg-yellow-500/15 text-yellow-400 border-yellow-500/40',
  ACTIVE:   'bg-green-500/15 text-green-400 border-green-500/40',
  DEBRIEF:  'bg-blue-500/15 text-blue-400 border-blue-500/40',
  COMPLETE: 'bg-slate-600/30 text-slate-400 border-slate-600',
};

const TYPE_STYLES: Record<string, string> = {
  RANSOMWARE:     'bg-purple-500/15 text-purple-400 border-purple-500/40',
  PHISHING:       'bg-blue-500/15 text-blue-400 border-blue-500/40',
  DATA_BREACH:    'bg-red-500/15 text-red-400 border-red-500/40',
  INSIDER_THREAT: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40',
  SUPPLY_CHAIN:   'bg-teal-500/15 text-teal-400 border-teal-500/40',
  APT:            'bg-pink-500/15 text-pink-400 border-pink-500/40',
  DDOS:           'bg-orange-500/15 text-orange-400 border-orange-500/40',
  CUSTOM:         'bg-slate-500/15 text-slate-400 border-slate-500/40',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function duration(start?: string, end?: string) {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

function DeleteModal({
  session,
  deleting,
  onConfirm,
  onClose,
}: {
  session: Session;
  deleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !deleting && onClose()}
      />
      <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <button
          onClick={onClose}
          disabled={deleting}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/30">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <h3 className="text-base font-semibold text-white">Delete Tabletop</h3>
        </div>
        <p className="text-sm text-slate-400 mb-1.5">
          Delete the tabletop{' '}
          <span className="text-white font-medium">
            "{session.scenario?.title ?? 'Unknown Scenario'}"
          </span>
          {' '}({session.joinCode})?
        </p>
        <p className="text-xs text-slate-500 mb-6">
          All player decisions, scores, and debrief data will be permanently removed.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = ['All', 'LOBBY', 'ACTIVE', 'DEBRIEF', 'COMPLETE'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export default function SessionsPage() {
  const navigate = useNavigate();
  const { get, del } = useApi();
  const toast = useToast();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    get<{ sessions: Session[] }>('/api/sessions')
      .then((data) => setSessions(data.sessions ?? []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [get]);

  const filtered = useMemo(
    () =>
      statusFilter === 'All'
        ? sessions
        : sessions.filter((s) => s.status === statusFilter),
    [sessions, statusFilter]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: sessions.length };
    for (const s of sessions) c[s.status] = (c[s.status] ?? 0) + 1;
    return c;
  }, [sessions]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await del(`/api/sessions/${deleteTarget.id}`);
      setSessions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast('Tabletop deleted', 'success');
      setDeleteTarget(null);
    } catch (err: unknown) {
      toast((err as Error).message ?? 'Failed to delete session', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyInvite = (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    const url = `${window.location.origin}/join/${session.joinCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(session.id);
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  const handleOpenSession = (session: Session) => {
    if (session.status === 'ACTIVE') navigate(`/game/${session.id}`);
    else if (session.status === 'DEBRIEF' || session.status === 'COMPLETE')
      navigate(`/debrief/${session.id}`);
    else navigate(`/sessions/${session.id}/lobby`);
  };

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/30">
              <Calendar className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Tabletop Exercises</h1>
              <p className="text-slate-400 text-sm mt-0.5">
                View and manage your tabletop sessions
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/sessions/new')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg px-4 py-2 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            New Tabletop
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-800 border border-slate-700/50 rounded-xl w-fit">
          <Filter className="w-4 h-4 text-slate-500 ml-2 mr-1 flex-shrink-0" />
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                statusFilter === f
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              {f === 'All' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              {counts[f] != null && counts[f] > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${
                    statusFilter === f
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {counts[f]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/40 border border-dashed border-slate-700 rounded-xl">
            <ClipboardList className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-base font-medium">
              {statusFilter === 'All' ? 'No tabletop sessions yet' : `No ${statusFilter.toLowerCase()} sessions`}
            </p>
            {statusFilter === 'All' && (
              <>
                <p className="text-slate-500 text-sm mt-1">
                  Create a new tabletop to get started.
                </p>
                <button
                  onClick={() => navigate('/sessions/new')}
                  className="mt-5 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg px-4 py-2 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  New Tabletop
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((session) => {
              const dur = duration(session.startedAt, session.endedAt);
              const canInvite = session.status === 'LOBBY' || session.status === 'ACTIVE';
              const wasCopied = copiedId === session.id;

              return (
                <div
                  key={session.id}
                  className="bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl p-4 transition-all"
                >
                  <div className="flex items-start gap-4">
                    {/* Clickable main area */}
                    <button
                      onClick={() => handleOpenSession(session)}
                      className="flex-1 text-left min-w-0 group"
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        {/* Status badge */}
                        <span
                          className={`inline-block text-xs px-2 py-0.5 rounded border font-medium ${
                            STATUS_STYLES[session.status] ?? STATUS_STYLES.COMPLETE
                          }`}
                        >
                          {session.status}
                        </span>

                        {/* Scenario type badge */}
                        {session.scenario?.type && (
                          <span
                            className={`inline-block text-xs px-2 py-0.5 rounded border font-medium ${
                              TYPE_STYLES[session.scenario.type] ??
                              'bg-slate-500/15 text-slate-400 border-slate-500/40'
                            }`}
                          >
                            {session.scenario.type.replace('_', ' ')}
                          </span>
                        )}

                        {/* Join code */}
                        <span className="font-mono text-xs text-slate-500 tracking-widest">
                          {session.joinCode}
                        </span>
                      </div>

                      <p className="text-base font-semibold text-white group-hover:text-blue-300 transition-colors truncate">
                        {session.scenario?.title ?? 'Unknown Scenario'}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {fmtDate(session.createdAt)}
                        </span>
                        {session._count?.players != null && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {session._count.players} player
                            {session._count.players !== 1 ? 's' : ''}
                          </span>
                        )}
                        {dur && (
                          <span className="text-slate-500">
                            Duration: {dur}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Open button */}
                      {(session.status === 'LOBBY' || session.status === 'ACTIVE') && (
                        <button
                          onClick={() => handleOpenSession(session)}
                          title="Open session"
                          className="flex items-center gap-1.5 bg-green-600/80 hover:bg-green-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Open
                        </button>
                      )}
                      {(session.status === 'DEBRIEF' || session.status === 'COMPLETE') && (
                        <button
                          onClick={() => navigate(`/debrief/${session.id}`)}
                          title="View debrief"
                          className="flex items-center gap-1.5 bg-blue-600/70 hover:bg-blue-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Debrief
                        </button>
                      )}

                      {/* Invite link copy */}
                      {canInvite && (
                        <button
                          onClick={(e) => handleCopyInvite(e, session)}
                          title={wasCopied ? 'Copied!' : 'Copy invite link'}
                          className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                            wasCopied
                              ? 'bg-green-500/15 border-green-500/40 text-green-400'
                              : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-blue-500/10 hover:border-blue-500/40 hover:text-blue-400'
                          }`}
                        >
                          {wasCopied ? (
                            <CheckCircle className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}

                      {/* Debrief external link */}
                      {(session.status === 'DEBRIEF' || session.status === 'COMPLETE') && (
                        <button
                          onClick={() => navigate(`/debrief/${session.id}`)}
                          title="Open debrief in full view"
                          className="flex items-center justify-center p-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteTarget(session)}
                        title="Delete session"
                        className="flex items-center justify-center p-1.5 bg-slate-700 hover:bg-red-600/70 border border-slate-600 hover:border-red-500/50 text-slate-500 hover:text-red-300 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteModal
          session={deleteTarget}
          deleting={deleting}
          onConfirm={handleDelete}
          onClose={() => !deleting && setDeleteTarget(null)}
        />
      )}
    </Layout>
  );
}
