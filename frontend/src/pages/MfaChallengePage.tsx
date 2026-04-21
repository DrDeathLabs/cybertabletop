import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, Shield, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../stores/auth';

interface MfaVerifyResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'FACILITATOR' | 'PLAYER';
    orgId?: string | null;
    mfaEnabled?: boolean;
  };
  recoveryCodesRemaining?: number;
}

export default function MfaChallengePage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const challengeToken = sessionStorage.getItem('cybertabletop-mfa-challenge');

  useEffect(() => {
    if (!challengeToken) navigate('/login', { replace: true });
  }, [challengeToken, navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!challengeToken || !code.trim()) return;

    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/mfa/verify-login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeToken,
          ...(useRecovery ? { recoveryCode: code.trim() } : { code: code.trim() }),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Invalid MFA code');
        return;
      }

      const typed = data as MfaVerifyResponse;
      sessionStorage.removeItem('cybertabletop-mfa-challenge');
      setUser({ ...typed.user, mfaEnabled: true });
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/10 rounded-2xl border border-blue-500/30 mb-4">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Verify MFA</h1>
          <p className="text-slate-400 mt-1 text-sm">Enter your authenticator code to continue</p>
        </div>

        <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-8 shadow-2xl">
          {error && (
            <div className="mb-5 flex items-start gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="mfa-code" className="block text-sm font-medium text-slate-300 mb-1.5">
                {useRecovery ? 'Recovery Code' : 'Authenticator Code'}
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="mfa-code"
                  type="text"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder={useRecovery ? 'ABCDE-12345' : '123456'}
                  autoComplete="one-time-code"
                  required
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 transition-colors text-sm"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Verify
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setUseRecovery((value) => !value);
              setCode('');
              setError('');
            }}
            className="mt-5 w-full text-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            {useRecovery ? 'Use authenticator code instead' : 'Use a recovery code'}
          </button>
        </div>
      </div>
    </div>
  );
}
