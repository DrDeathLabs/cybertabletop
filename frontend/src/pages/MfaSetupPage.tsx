import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Copy, KeyRound, Loader2, Shield } from 'lucide-react';
import Layout from '../components/shared/Layout';
import { useApi } from '../hooks/useApi';
import { useAuthStore } from '../stores/auth';
import { useToast } from '../components/shared/Toaster';

interface MfaSetupResponse {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

interface MfaVerifyResponse {
  recoveryCodes: string[];
  user: {
    id: string;
    email: string;
    displayName: string;
    role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'FACILITATOR' | 'PLAYER';
    orgId?: string | null;
    mfaEnabled?: boolean;
  };
}

const REQUIRED_ROLES = ['SUPER_ADMIN', 'ORG_ADMIN', 'FACILITATOR'];

export default function MfaSetupPage() {
  const navigate = useNavigate();
  const { post } = useApi();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  const [setup, setSetup] = useState<MfaSetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const mandatory = !!user && REQUIRED_ROLES.includes(user.role) && !user.mfaEnabled;

  useEffect(() => {
    if (user?.mfaEnabled) {
      setLoading(false);
      return;
    }

    post<MfaSetupResponse>('/api/auth/mfa/setup/start', {})
      .then(setSetup)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [post, user?.mfaEnabled]);

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;

    setError('');
    setVerifying(true);
    try {
      const result = await post<MfaVerifyResponse>('/api/auth/mfa/setup/verify', { code: code.trim() });
      setRecoveryCodes(result.recoveryCodes);
      setUser({ ...result.user, mfaEnabled: true });
      toast('MFA enabled successfully', 'success');
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to verify MFA code');
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      logout();
      navigate('/login', { replace: true });
    }
  };

  const copyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    toast('Recovery codes copied', 'success');
  };

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/30">
            <Shield className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Multi-Factor Authentication</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Secure your account with a time-based authenticator app.
            </p>
          </div>
        </div>

        {mandatory && recoveryCodes.length === 0 && (
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-300">MFA is required for your role</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Set up MFA before continuing to CyberTabletop.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : user?.mfaEnabled && recoveryCodes.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
              <div>
                <p className="text-white font-semibold">MFA is enabled</p>
                <p className="text-sm text-slate-400 mt-1">
                  Your account requires an authenticator code during login.
                </p>
              </div>
            </div>
          </div>
        ) : recoveryCodes.length > 0 ? (
          <div className="bg-slate-800 border border-green-500/30 rounded-xl p-6 space-y-5">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
              <div>
                <p className="text-white font-semibold">MFA is enabled</p>
                <p className="text-sm text-slate-400 mt-1">
                  Store these recovery codes somewhere safe. They are shown only once.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-900 border border-slate-700 rounded-lg p-4">
              {recoveryCodes.map((recoveryCode) => (
                <code key={recoveryCode} className="text-sm text-slate-200 font-mono">
                  {recoveryCode}
                </code>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={copyRecoveryCodes}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg px-4 py-2 transition-colors text-sm"
              >
                <Copy className="w-4 h-4" />
                Copy Codes
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard', { replace: true })}
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg px-4 py-2 transition-colors text-sm"
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[18rem_1fr] gap-6">
            <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6">
              {setup?.qrCodeDataUrl ? (
                <img
                  src={setup.qrCodeDataUrl}
                  alt="MFA QR code"
                  className="w-full rounded-lg bg-white p-3"
                />
              ) : (
                <div className="aspect-square rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                </div>
              )}
            </div>

            <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6 space-y-5">
              <div>
                <p className="text-sm font-semibold text-white">1. Scan the QR code</p>
                <p className="text-sm text-slate-400 mt-1">
                  Use Microsoft Authenticator, Google Authenticator, 1Password, Bitwarden, Authy, or Duo Mobile.
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-white">2. Manual setup key</p>
                <code className="mt-2 block bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 break-all">
                  {setup?.secret}
                </code>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label htmlFor="mfa-setup-code" className="block text-sm font-medium text-slate-300 mb-1.5">
                    3. Enter the 6-digit code
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      id="mfa-setup-code"
                      type="text"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      placeholder="123456"
                      autoComplete="one-time-code"
                      required
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors text-sm"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={verifying || !code.trim()}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2 transition-colors text-sm"
                  >
                    {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
                    Enable MFA
                  </button>
                  {mandatory && (
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="text-slate-400 hover:text-slate-200 font-medium rounded-lg px-4 py-2 transition-colors text-sm"
                    >
                      Logout
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
