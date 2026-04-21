import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Shield, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import Layout from '../components/shared/Layout';
import { useAuthStore } from '../stores/auth';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/shared/Toaster';

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

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="text-blue-400">{icon}</div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();
  const { patch, post } = useApi();
  const toast = useToast();

  // Profile form
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !user) return;

    setProfileError('');
    setProfileSuccess(false);
    setProfileLoading(true);

    try {
      const updated = await patch<{ user: NonNullable<typeof user> }>('/api/users/profile', {
        displayName: displayName.trim(),
      });
      setUser(updated.user);
      setProfileSuccess(true);
      toast('Profile updated successfully', 'success');
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: unknown) {
      setProfileError((err as Error).message ?? 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleRegenerateRecoveryCodes = async (e: FormEvent) => {
    e.preventDefault();
    setMfaError('');
    setRecoveryCodes([]);
    setMfaLoading(true);
    try {
      const result = await post<{ recoveryCodes: string[] }>('/api/auth/mfa/recovery-codes/regenerate', {
        code: mfaCode.trim(),
      });
      setRecoveryCodes(result.recoveryCodes);
      setMfaCode('');
      toast('Recovery codes regenerated', 'success');
    } catch (err: unknown) {
      setMfaError((err as Error).message ?? 'Failed to regenerate recovery codes.');
    } finally {
      setMfaLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 12) {
      setPasswordError('New password must be at least 12 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      await patch('/api/users/change-password', {
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast('Password changed successfully', 'success');
    } catch (err: unknown) {
      setPasswordError((err as Error).message ?? 'Failed to change password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/30">
            <User className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Profile</h1>
            <p className="text-slate-400 text-sm mt-0.5">Manage your account settings</p>
          </div>
        </div>

        {/* Current info */}
        <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-500/20 border-2 border-blue-500/40 flex items-center justify-center flex-shrink-0">
              <User className="w-7 h-7 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{user?.displayName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-sm text-slate-400">{user?.email}</span>
              </div>
              {user?.role && (
                <span
                  className={`inline-block mt-2 text-xs px-2 py-0.5 rounded border font-medium ${
                    ROLE_COLORS[user.role] ?? 'bg-slate-700 text-slate-400 border-slate-600'
                  }`}
                >
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Update display name */}
        <SectionCard title="Update Display Name" icon={<User className="w-5 h-5" />}>
          {profileError && (
            <div className="mb-4 flex items-start gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-red-400 text-sm">{profileError}</span>
            </div>
          )}
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={profileLoading || !displayName.trim()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2 transition-colors text-sm"
            >
              {profileLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : profileSuccess ? (
                <CheckCircle className="w-4 h-4 text-green-300" />
              ) : null}
              {profileSuccess ? 'Saved!' : 'Save Changes'}
            </button>
          </form>
        </SectionCard>

        {/* Change password */}
        <SectionCard title="Change Password" icon={<Lock className="w-5 h-5" />}>
          {passwordError && (
            <div className="mb-4 flex items-start gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-red-400 text-sm">{passwordError}</span>
            </div>
          )}
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={12}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors text-sm"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Minimum 12 characters with uppercase, lowercase, number, and special character.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className={`w-full bg-slate-900 border rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:ring-1 transition-colors text-sm ${
                  confirmPassword && confirmPassword !== newPassword
                    ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/30'
                    : 'border-slate-600 focus:border-blue-500 focus:ring-blue-500/50'
                }`}
              />
            </div>
            <button
              type="submit"
              disabled={
                passwordLoading ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword ||
                newPassword !== confirmPassword
              }
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2 transition-colors text-sm"
            >
              {passwordLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Change Password
            </button>
          </form>
        </SectionCard>

        {/* MFA */}
        <SectionCard title="Multi-Factor Authentication" icon={<Shield className="w-5 h-5" />}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-slate-900/60 border border-slate-700 rounded-lg p-4">
              <Shield className={`w-5 h-5 flex-shrink-0 mt-0.5 ${user?.mfaEnabled ? 'text-green-400' : 'text-amber-400'}`} />
              <div>
                <p className="text-sm font-medium text-slate-300">
                  {user?.mfaEnabled ? 'MFA is enabled' : 'MFA is not enabled'}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  CyberTabletop supports TOTP codes from standard authenticator apps.
                  Facilitators and admins are required to use MFA.
                </p>
                {user?.mfaEnabled && (
                  <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-green-400">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Your account requires MFA at login
                  </span>
                )}
              </div>
            </div>

            {!user?.mfaEnabled ? (
              <button
                type="button"
                onClick={() => navigate('/mfa/setup')}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg px-4 py-2 transition-colors text-sm"
              >
                <Shield className="w-4 h-4" />
                Set Up MFA
              </button>
            ) : (
              <form onSubmit={handleRegenerateRecoveryCodes} className="space-y-3">
                {mfaError && (
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-red-400 text-sm">{mfaError}</span>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Authenticator Code
                  </label>
                  <input
                    type="text"
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value)}
                    placeholder="123456"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={mfaLoading || !mfaCode.trim()}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700/50 disabled:cursor-not-allowed text-slate-200 font-medium rounded-lg px-4 py-2 transition-colors text-sm"
                >
                  {mfaLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Regenerate Recovery Codes
                </button>
                {recoveryCodes.length > 0 && (
                  <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                    <p className="text-sm font-medium text-slate-300 mb-2">
                      New recovery codes. Store them now; they will not be shown again.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {recoveryCodes.map((code) => (
                        <code key={code} className="text-sm text-slate-200 font-mono">{code}</code>
                      ))}
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>
        </SectionCard>
      </div>
    </Layout>
  );
}
