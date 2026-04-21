import { useState, useEffect, useRef, FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Shield, Hash, Users, ChevronDown, Loader2, AlertTriangle, Edit3 } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useAuthStore } from '../stores/auth';

const DEFAULT_ROLES = [
  'Incident Commander',
  'IR Lead',
  'Threat Analyst',
  'Communications/PR',
  'Legal/Compliance',
  'Executive/CISO',
  'IT/Sysadmin',
  'HR',
  'Custom...',
];

export default function JoinPage() {
  const { code } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const { post } = useApi();
  const user = useAuthStore((s) => s.user);

  const [joinCode, setJoinCode] = useState(code?.toUpperCase() ?? '');
  const [selectedRole, setSelectedRole] = useState('IR Lead');
  const [customRole, setCustomRole] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!code && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [code]);

  const handleCodeChange = (val: string) => {
    const cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setJoinCode(cleaned);
  };

  const handleRoleSelect = (role: string) => {
    if (role === 'Custom...') {
      setIsCustom(true);
      setSelectedRole('');
    } else {
      setIsCustom(false);
      setSelectedRole(role);
    }
  };

  const effectiveRole = isCustom ? customRole.trim() : selectedRole;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!joinCode || !effectiveRole) return;

    if (!user) {
      navigate(`/login?redirect=/join/${joinCode}`);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const data = await post<{ session: { id: string } }>('/api/sessions/join', {
        joinCode: joinCode.trim(),
        assignedRole: effectiveRole,
      });
      navigate(`/game/${data.session.id}`);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to join session. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(59,130,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/10 rounded-2xl border border-blue-500/30 mb-4">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Join Session</h1>
          <p className="text-slate-400 mt-1 text-sm">Enter the code provided by your facilitator</p>
        </div>

        <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-8 shadow-2xl">
          {!user && (
            <div className="mb-6 bg-yellow-500/10 border border-yellow-500/40 rounded-lg px-4 py-3">
              <p className="text-yellow-400 text-sm">
                You need to be logged in to join a session.{' '}
                <Link to="/login" className="underline hover:no-underline">
                  Sign in here
                </Link>
              </p>
            </div>
          )}

          {error && (
            <div className="mb-5 flex items-start gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Join code */}
            <div>
              <label htmlFor="join-code" className="block text-sm font-medium text-slate-300 mb-2">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-blue-400" />
                  Session Code
                </div>
              </label>
              <input
                id="join-code"
                ref={codeInputRef}
                type="text"
                value={joinCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="ABCD12"
                maxLength={8}
                required
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-4 text-center text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors font-mono text-3xl tracking-[0.4em] uppercase"
                style={{ letterSpacing: '0.4em' }}
              />
            </div>

            {/* Role selector */}
            <div>
              <label htmlFor="join-role" className="block text-sm font-medium text-slate-300 mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  Your Role
                </div>
              </label>

              <div className="relative">
                <select
                  id="join-role"
                  value={isCustom ? 'Custom...' : selectedRole}
                  onChange={(e) => handleRoleSelect(e.target.value)}
                  className="w-full appearance-none bg-slate-900 border border-slate-600 rounded-lg pl-4 pr-10 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors text-sm cursor-pointer"
                >
                  {DEFAULT_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>

              {isCustom && (
                <div className="mt-3 relative">
                  <Edit3 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="join-custom-role"
                    aria-label="Custom role"
                    type="text"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    placeholder="Enter your custom role..."
                    required
                    autoFocus
                    maxLength={80}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors text-sm"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !joinCode || !effectiveRole || !user}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-green-600/40 disabled:cursor-not-allowed text-white font-bold rounded-lg py-3 transition-colors text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Joining...
                </>
              ) : (
                'Join Session'
              )}
            </button>
          </form>

          {user && (
            <p className="mt-5 text-center text-sm text-slate-500">
              Joining as{' '}
              <span className="text-slate-300 font-medium">{user.displayName}</span>
              {' · '}
              <Link to="/dashboard" className="text-blue-400 hover:text-blue-300 transition-colors">
                Dashboard
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
