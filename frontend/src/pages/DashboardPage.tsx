import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Play,
  BookOpen,
  Plus,
  Users,
  Calendar,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Trophy,
  Hash,
  Link2,
  Copy,
  CheckCircle,
} from 'lucide-react';
import Layout from '../components/shared/Layout';
import { useAuthStore } from '../stores/auth';
import { useApi } from '../hooks/useApi';

interface SessionSummary {
  id: string;
  joinCode: string;
  status: string;
  createdAt: string;
  scenario?: { title: string };
  _count?: { players: number };
}

interface StatsResponse {
  sessionsPlayed: number;
  scenariosAvailable: number;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ORG_ADMIN: 'Org Admin',
  FACILITATOR: 'Facilitator',
  PLAYER: 'Player',
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-500/20 text-red-400 border-red-500/40',
  ORG_ADMIN: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
  FACILITATOR: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  PLAYER: 'bg-green-500/20 text-green-400 border-green-500/40',
};

const STATUS_COLORS: Record<string, string> = {
  LOBBY: 'text-yellow-400',
  ACTIVE: 'text-green-400',
  DEBRIEF: 'text-blue-400',
  COMPLETE: 'text-slate-400',
};

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { get, post } = useApi();

  const isFacilitator =
    user?.role === 'FACILITATOR' ||
    user?.role === 'ORG_ADMIN' ||
    user?.role === 'SUPER_ADMIN';

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState('');

  const [stats, setStats] = useState<StatsResponse>({ sessionsPlayed: 0, scenariosAvailable: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  const [joinCode, setJoinCode] = useState('');
  const [joinRole, setJoinRole] = useState('Player');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');

  // Track which session's invite link was just copied (for feedback)
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);

  useEffect(() => {
    get<{ sessions: SessionSummary[] }>('/api/sessions')
      .then((data) => setSessions(data.sessions ?? []))
      .catch((err: Error) => setSessionsError(err.message))
      .finally(() => setSessionsLoading(false));

    get<StatsResponse>('/api/admin/stats')
      .then((data) => setStats(data))
      .catch(() => setStats({ sessionsPlayed: 0, scenariosAvailable: 0 }))
      .finally(() => setStatsLoading(false));
  }, [get]);

  const handleQuickJoin = async () => {
    if (joinCode.trim().length < 4) {
      setJoinError('Please enter a valid join code.');
      return;
    }
    setJoinError('');
    setJoinLoading(true);
    try {
      const data = await post<{ session: { id: string } }>('/api/sessions/join', {
        joinCode: joinCode.trim().toUpperCase(),
        assignedRole: joinRole,
      });
      navigate(`/game/${data.session.id}`);
    } catch (err: unknown) {
      setJoinError((err as Error).message ?? 'Failed to join session.');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleCopyInvite = (e: React.MouseEvent, session: SessionSummary) => {
    e.stopPropagation(); // Don't navigate to session
    const url = `${window.location.origin}/join/${session.joinCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedSessionId(session.id);
      setTimeout(() => setCopiedSessionId(null), 2500);
    });
  };

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/30">
              <LayoutDashboard className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Welcome back, {user?.displayName}
              </h1>
              <div className="mt-1">
                {user?.role && (
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded border font-medium ${
                      ROLE_COLORS[user.role] ?? 'bg-slate-700 text-slate-400 border-slate-600'
                    }`}
                  >
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                )}
              </div>
            </div>
          </div>

          {isFacilitator && (
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/sessions/new')}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg px-4 py-2 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Create Session
              </button>
              <button
                onClick={() => navigate('/scenarios')}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg px-4 py-2 transition-colors text-sm border border-slate-600"
              >
                <BookOpen className="w-4 h-4" />
                Manage Scenarios
              </button>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-slate-400 font-medium">Sessions Played</span>
            </div>
            {statsLoading ? (
              <div className="h-8 w-16 bg-slate-700 rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-white">{stats.sessionsPlayed}</p>
            )}
          </div>
          <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-5 h-5 text-green-400" />
              <span className="text-sm text-slate-400 font-medium">Scenarios Available</span>
            </div>
            {statsLoading ? (
              <div className="h-8 w-16 bg-slate-700 rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-white">{stats.scenariosAvailable}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Join */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <Hash className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-semibold text-white">Quick Join</h2>
              </div>

              {joinError && (
                <div className="mb-4 flex items-start gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-red-400 text-sm">{joinError}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                    Join Code
                  </label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="ABCD12"
                    maxLength={8}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors text-sm font-mono tracking-widest uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                    Your Role
                  </label>
                  <input
                    type="text"
                    value={joinRole}
                    onChange={(e) => setJoinRole(e.target.value)}
                    placeholder="e.g. IR Lead"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors text-sm"
                  />
                </div>

                <button
                  onClick={handleQuickJoin}
                  disabled={joinLoading || !joinCode.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-green-600/40 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 transition-colors text-sm"
                >
                  {joinLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Join Session
                </button>
              </div>
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <h2 className="text-base font-semibold text-white">Recent Sessions</h2>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block">
                  Click a row to open · Click <Link2 className="inline w-3 h-3" /> to copy invite link
                </p>
              </div>

              {sessionsLoading ? (
                <Spinner />
              ) : sessionsError ? (
                <div className="flex items-center gap-2 text-red-400 text-sm py-4">
                  <AlertTriangle className="w-4 h-4" />
                  {sessionsError}
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-10">
                  <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No sessions yet.</p>
                  {isFacilitator && (
                    <button
                      onClick={() => navigate('/sessions/new')}
                      className="mt-3 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                    >
                      Create your first session
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.slice(0, 8).map((session) => {
                    const isInvitable = session.status === 'LOBBY' || session.status === 'ACTIVE';
                    const wasCopied = copiedSessionId === session.id;
                    return (
                      <div key={session.id} className="flex items-stretch gap-2">
                        {/* Main row — navigates to session */}
                        <button
                          onClick={() =>
                            session.status === 'ACTIVE'
                              ? navigate(`/game/${session.id}`)
                              : session.status === 'DEBRIEF' || session.status === 'COMPLETE'
                              ? navigate(`/debrief/${session.id}`)
                              : navigate(`/sessions/${session.id}/lobby`)
                          }
                          className="flex-1 flex items-center gap-4 bg-slate-900/50 hover:bg-slate-700/50 border border-slate-700/40 hover:border-slate-600 rounded-lg px-4 py-3 transition-all text-left group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">
                              {session.scenario?.title ?? 'Unknown Scenario'}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-slate-500 font-mono tracking-widest">
                                {session.joinCode}
                              </span>
                              <span
                                className={`text-xs font-medium ${
                                  STATUS_COLORS[session.status] ?? 'text-slate-400'
                                }`}
                              >
                                {session.status}
                              </span>
                              {session._count?.players != null && (
                                <span className="flex items-center gap-1 text-xs text-slate-500">
                                  <Users className="w-3 h-3" />
                                  {session._count.players}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-slate-500 flex-shrink-0 hidden sm:block">
                            {new Date(session.createdAt).toLocaleDateString()}
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0" />
                        </button>

                        {/* Invite link button — only for LOBBY / ACTIVE */}
                        {isInvitable && (
                          <button
                            onClick={(e) => handleCopyInvite(e, session)}
                            title={wasCopied ? 'Copied!' : 'Copy invite link for players'}
                            className={`flex flex-col items-center justify-center gap-1 px-3 rounded-lg border text-xs font-medium transition-all flex-shrink-0 ${
                              wasCopied
                                ? 'bg-green-500/15 border-green-500/40 text-green-400'
                                : 'bg-slate-900/50 border-slate-700/40 text-slate-400 hover:bg-blue-500/10 hover:border-blue-500/40 hover:text-blue-400'
                            }`}
                          >
                            {wasCopied ? (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                <span>Invite</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Invite explainer — shown when there are active/lobby sessions */}
            {sessions.some((s) => s.status === 'LOBBY' || s.status === 'ACTIVE') && (
              <div className="mt-3 flex items-start gap-3 bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3">
                <Link2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-blue-400 mb-0.5">Inviting players?</p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Click <span className="text-slate-300 font-medium">Invite</span> next to any active session to copy its join link. Share it with your team — they visit the link, enter their name, and land straight in the game.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
