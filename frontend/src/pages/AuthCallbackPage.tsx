import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Loader2, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../stores/auth';

interface MeResponse {
  id: string;
  email: string;
  displayName: string;
  role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'FACILITATOR' | 'PLAYER';
  orgId?: string;
  mfaEnabled?: boolean;
}

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    const errorMsg = params.get('message') ?? params.get('error_description');

    if (error || success === 'false') {
      const msg =
        errorMsg ??
        (error === 'access_denied'
          ? 'Access was denied. Please try again.'
          : error === 'account_disabled'
          ? 'Your account has been disabled. Contact support.'
          : 'SSO authentication failed. Please try again.');
      setErrorMessage(msg);
      setStatus('error');
      return;
    }

    // Success — fetch current user
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to retrieve user session.');
        }
        return res.json() as Promise<MeResponse>;
      })
      .then((user) => {
        setUser(user);
        navigate('/dashboard', { replace: true });
      })
      .catch((err: Error) => {
        setErrorMessage(err.message);
        setStatus('error');
      });
  }, [navigate, setUser]);

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

      <div className="w-full max-w-sm relative text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/10 rounded-2xl border border-blue-500/30 mb-6">
          <Shield className="w-8 h-8 text-blue-400" />
        </div>

        {status === 'loading' ? (
          <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-8 shadow-2xl">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">Completing Sign-In</h2>
            <p className="text-slate-400 text-sm">
              Please wait while we verify your credentials…
            </p>
          </div>
        ) : (
          <div className="bg-slate-800 border border-red-500/30 rounded-xl p-8 shadow-2xl">
            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Authentication Failed</h2>
            <p className="text-slate-400 text-sm mb-6">{errorMessage}</p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg px-5 py-2.5 transition-colors text-sm"
            >
              Back to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
