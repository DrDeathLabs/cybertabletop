import { describe, expect, it } from 'vitest';
import {
  calculateCsfPerformance,
  calculateMfaAdoptionPct,
  controlStatus,
  overallStatus,
  registrationGateStatus,
} from './security-posture';

describe('security posture helpers', () => {
  it('calculates control and overall posture statuses deterministically', () => {
    expect(controlStatus(true, false)).toBe('PASS');
    expect(controlStatus(false, true)).toBe('WARN');
    expect(controlStatus(false, false)).toBe('FAIL');

    expect(overallStatus([{ status: 'PASS' }, { status: 'WARN' }])).toBe('YELLOW');
    expect(overallStatus([{ status: 'PASS' }, { status: 'FAIL' }])).toBe('RED');
    expect(overallStatus([{ status: 'PASS' }])).toBe('GREEN');
  });

  it('labels registration gate state without overstating protection', () => {
    expect(registrationGateStatus(true, 'invite')).toEqual({
      controlled: true,
      label: 'invite code enforced',
    });
    expect(registrationGateStatus(true, '')).toEqual({
      controlled: false,
      label: 'invite required but INVITE_CODE missing',
    });
    expect(registrationGateStatus(false, 'invite')).toEqual({
      controlled: false,
      label: 'open self-registration',
    });
  });

  it('calculates MFA adoption and NIST CSF averages from measured decisions only', () => {
    expect(calculateMfaAdoptionPct(2, 3)).toBe(67);
    expect(calculateMfaAdoptionPct(2, 0)).toBe(0);

    const { performance, counts } = calculateCsfPerformance([
      { score: 50, inject: { nistCsfFunction: 'DETECT' } },
      { score: 90, inject: { nistCsfFunction: 'DETECT' } },
      { score: 100, inject: { nistCsfFunction: 'RECOVER' } },
      { score: 10, inject: { nistCsfFunction: null } },
    ]);

    expect(performance).toMatchObject({
      IDENTIFY: null,
      PROTECT: null,
      DETECT: 70,
      RESPOND: null,
      RECOVER: 100,
    });
    expect(counts).toMatchObject({
      IDENTIFY: 0,
      PROTECT: 0,
      DETECT: 2,
      RESPOND: 0,
      RECOVER: 1,
    });
  });
});
