export type ControlStatus = 'PASS' | 'WARN' | 'FAIL';
export type OverallPosture = 'GREEN' | 'YELLOW' | 'RED';

export function controlStatus(passCondition: boolean, warnCondition: boolean): ControlStatus {
  if (passCondition) return 'PASS';
  if (warnCondition) return 'WARN';
  return 'FAIL';
}

export function overallStatus(controls: Array<{ status: ControlStatus }>): OverallPosture {
  if (controls.some((control) => control.status === 'FAIL')) return 'RED';
  if (controls.some((control) => control.status === 'WARN')) return 'YELLOW';
  return 'GREEN';
}

export function calculateMfaAdoptionPct(mfaUsers: number, totalUsers: number): number {
  if (totalUsers <= 0) return 0;
  return Math.round((Math.max(0, mfaUsers) / totalUsers) * 100);
}

export function registrationGateStatus(requireInvite: boolean, inviteCode: string | undefined): {
  controlled: boolean;
  label: string;
} {
  if (requireInvite && inviteCode) return { controlled: true, label: 'invite code enforced' };
  if (requireInvite) return { controlled: false, label: 'invite required but INVITE_CODE missing' };
  return { controlled: false, label: 'open self-registration' };
}
