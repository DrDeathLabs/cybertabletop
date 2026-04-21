import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users,
  Copy,
  CheckCircle,
  Play,
  Loader2,
  AlertTriangle,
  Wifi,
  WifiOff,
  ChevronDown,
  Link2,
} from 'lucide-react';
import Layout from '../components/shared/Layout';
import { useApi } from '../hooks/useApi';
import { connectSocket, disconnectSocket, getSocket } from '../socket/client';
import { useSessionStore } from '../stores/session';

const DEFAULT_ROLES = [
  'Incident Commander',
  'IR Lead',
  'Threat Analyst',
  'Communications/PR',
  'Legal/Compliance',
  'Executive/CISO',
  'IT/Sysadmin',
  'HR',
];

interface SessionData {
  id: string;
  joinCode: string;
  status: string;
  playerOnboarding?: boolean;
  scenario?: { title: string };
  players: Array<{
    userId: string;
    // Prisma include nests displayName under player.user
    user?: { displayName: string };
    displayName?: string; // fallback
    assignedRole: string;
    isConnected: boolean;
    totalScore: number;
    profileAnswers?: Record<string, unknown> | null;
  }>;
}

export default function SessionLobbyPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { get, patch } = useApi();

  const setSession = useSessionStore((s) => s.setSession);
  const setPlayers = useSessionStore((s) => s.setPlayers);
  const addPlayer = useSessionStore((s) => s.addPlayer);
  const removePlayer = useSessionStore((s) => s.removePlayer);
  const players = useSessionStore((s) => s.players);

  const [session, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [starting, setStarting] = useState(false);

  const joinUrl = `${window.location.origin}/join/${session?.joinCode ?? ''}`;

  const loadSession = useCallback(() => {
    if (!sessionId) return;
    get<{ session: SessionData }>(`/api/sessions/${sessionId}`)
      .then(({ session: s }) => {
        setSessionData(s);
        setSession(s.id);
        setPlayers(
          (s.players ?? []).map((p) => ({
            userId: p.userId,
            displayName: p.user?.displayName ?? p.displayName ?? 'Player',
            assignedRole: p.assignedRole,
            totalScore: p.totalScore,
            isConnected: p.isConnected,
          }))
        );
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [sessionId, get, setSession, setPlayers]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!sessionId) return;

    const socket = connectSocket();

    socket.emit('facilitator:join-lobby', { sessionId });

    socket.on('session:player-connected', (data: { userId: string; displayName: string; assignedRole: string }) => {
      addPlayer({ userId: data.userId, displayName: data.displayName, assignedRole: data.assignedRole });
    });

    socket.on('session:player-disconnected', (data: { userId: string }) => {
      removePlayer(data.userId);
    });

    socket.on('session:started', () => {
      navigate(`/game/${sessionId}`);
    });

    socket.on('session:start-failed', ({ message }: { message?: string }) => {
      setStarting(false);
      setError(message ?? 'Failed to start session');
    });

    return () => {
      socket.off('session:player-connected');
      socket.off('session:player-disconnected');
      socket.off('session:started');
      socket.off('session:start-failed');
      disconnectSocket();
    };
  }, [sessionId, navigate, addPlayer, removePlayer]);

  useEffect(() => {
    if (!starting || !sessionId) return;

    let cancelled = false;
    let attempts = 0;

    const pollStatus = async () => {
      if (cancelled) return;
      attempts += 1;

      try {
        const { session: latest } = await get<{ session: SessionData }>(`/api/sessions/${sessionId}`);
        if (cancelled) return;

        if (latest.status && latest.status !== 'LOBBY') {
          navigate(`/game/${sessionId}`);
          return;
        }

        if (attempts >= 60) {
          setStarting(false);
          setError('Session start is taking longer than expected. Please try again.');
          return;
        }

        setTimeout(pollStatus, 2000);
      } catch (err) {
        if (cancelled) return;
        setStarting(false);
        setError((err as Error).message || 'Failed to confirm session start');
      }
    };

    const timer = setTimeout(pollStatus, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [starting, sessionId, get, navigate]);

  const handleCopyCode = () => {
    if (session?.joinCode) {
      navigator.clipboard.writeText(session.joinCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(joinUrl);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  };

  const handleStartSession = () => {
    if (!sessionId) return;
    setError('');
    setStarting(true);
    const socket = getSocket();
    socket.emit('facilitator:start-session', { sessionId });
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!sessionId) return;
    try {
      await patch(`/api/sessions/${sessionId}/players/${userId}/role`, { role: newRole });
      setPlayers(
        players.map((p) => (p.userId === userId ? { ...p, assignedRole: newRole } : p))
      );
    } catch {
      // silently fail — could show a toast here
    }
  };

  const connectedCount = players.filter((p) => p.isConnected).length;

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white">Session Lobby</h1>
                {session?.scenario?.title && (
                  <p className="text-slate-400 text-sm mt-0.5">{session.scenario.title}</p>
                )}
              </div>
              <button
                onClick={handleStartSession}
                disabled={starting || players.length === 0}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-green-600/40 disabled:cursor-not-allowed text-white font-bold rounded-lg px-6 py-3 transition-colors text-sm"
              >
                {starting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Start Session
              </button>
            </div>

            {/* Player onboarding banner */}
            {session?.playerOnboarding && (
              <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-emerald-300">Player self-onboarding enabled</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Players should complete their profile at{' '}
                    <span className="font-mono text-slate-300">{joinUrl}</span> before the session starts.
                    The ✓ indicator next to each player shows profile submission status.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Join code card */}
              <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                  Join Code
                </h2>

                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-4 bg-slate-900 border border-slate-700 rounded-xl px-8 py-5">
                    <span className="font-mono text-4xl font-bold text-white tracking-[0.3em]">
                      {session?.joinCode ?? '------'}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="text-slate-500 hover:text-blue-400 transition-colors"
                      title="Copy code"
                    >
                      {codeCopied ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* URL hint */}
                <div className="bg-slate-900/60 border border-slate-700 rounded-lg px-4 py-3">
                  <p className="text-xs text-slate-500 mb-1.5 font-medium">Join URL</p>
                  <div className="flex items-center gap-2">
                    <Link2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <p className="text-xs text-slate-400 font-mono truncate flex-1">{joinUrl}</p>
                    <button
                      onClick={handleCopyUrl}
                      className="text-slate-500 hover:text-blue-400 transition-colors flex-shrink-0"
                      title="Copy URL"
                    >
                      {urlCopied ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 mt-2">
                    Share this URL or scan a QR code generated from it
                  </p>
                </div>
              </div>

              {/* Player list */}
              <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                    Players
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-400 font-medium">
                      {connectedCount} connected
                    </span>
                    <span className="text-slate-600 text-xs">/ {players.length} joined</span>
                  </div>
                </div>

                {players.length === 0 ? (
                  <div className="text-center py-10">
                    <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Waiting for players to join…</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {players.map((player) => {
                      const sessionPlayer = session?.players.find(p => p.userId === player.userId);
                      const hasProfile = !!sessionPlayer?.profileAnswers;
                      return (
                        <div
                          key={player.userId}
                          className="flex items-center gap-3 bg-slate-900/60 rounded-lg px-3 py-2.5"
                        >
                          {/* Connection dot */}
                          <div
                            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                              player.isConnected ? 'bg-green-400' : 'bg-slate-600'
                            }`}
                            title={player.isConnected ? 'Connected' : 'Disconnected'}
                          />

                          {/* Name */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-200 font-medium truncate">
                              {player.displayName}
                            </p>
                          </div>

                          {/* Role selector */}
                          <div className="relative flex-shrink-0">
                            <select
                              value={DEFAULT_ROLES.includes(player.assignedRole) ? player.assignedRole : 'custom'}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val !== 'custom') handleRoleChange(player.userId, val);
                              }}
                              className="appearance-none bg-slate-800 border border-slate-600 rounded-md pl-2 pr-6 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer max-w-[140px] truncate"
                            >
                              {DEFAULT_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                              {!DEFAULT_ROLES.includes(player.assignedRole) && (
                                <option value="custom">{player.assignedRole || 'Custom'}</option>
                              )}
                            </select>
                            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
                          </div>

                          {/* Profile status (player-onboarding mode only) */}
                          {session?.playerOnboarding && (
                            <div title={hasProfile ? 'Profile submitted' : 'Profile pending'} className="flex-shrink-0">
                              {hasProfile
                                ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                                : <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-600" />}
                            </div>
                          )}

                          {/* Connected icon */}
                          {player.isConnected ? (
                            <Wifi className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                          ) : (
                            <WifiOff className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
