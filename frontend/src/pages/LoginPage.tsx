import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Mail, Lock, Loader2, ExternalLink } from 'lucide-react';
import { useAuthStore } from '../stores/auth';

interface LoginResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'FACILITATOR' | 'PLAYER';
    orgId?: string;
    mfaEnabled?: boolean;
  };
}

interface SsoStatusResponse {
  enabled: boolean;
  providerName?: string;
  ssoUrl?: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const existingUser = useAuthStore((s) => s.user);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ssoStatus, setSsoStatus] = useState<SsoStatusResponse | null>(null);

  useEffect(() => {
    if (existingUser) {
      navigate('/dashboard', { replace: true });
      return;
    }
    fetch('/api/auth/sso-status', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: SsoStatusResponse) => setSsoStatus(data))
      .catch(() => setSsoStatus({ enabled: false }));
  }, [existingUser, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Login failed. Please check your credentials.');
        return;
      }

      const typed = data as LoginResponse;
      setUser(typed.user);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSsoLogin = () => {
    if (ssoStatus?.ssoUrl) {
      window.location.href = ssoStatus.ssoUrl;
    } else {
      window.location.href = '/api/auth/sso';
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {/* Background grid effect */}
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
          <h1 className="text-3xl font-bold text-white tracking-tight">CyberTabletop</h1>
          <p className="text-slate-400 mt-1 text-sm">Incident Response Training Platform</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-5 flex items-start gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3">
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 transition-colors text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>

          {ssoStatus?.enabled && (
            <>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-slate-800 px-3 text-xs text-slate-500">or</span>
                </div>
              </div>
              <button
                onClick={handleSsoLogin}
                className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg py-2.5 transition-colors text-sm border border-slate-600"
              >
                <ExternalLink className="w-4 h-4" />
                Login with {ssoStatus.providerName ?? 'SSO'}
              </button>
            </>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
