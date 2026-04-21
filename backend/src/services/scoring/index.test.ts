import { describe, expect, it } from 'vitest';
import { analyzeGaps, buildLeaderboard, calculateScore } from './index';

describe('calculateScore', () => {
  it('uses the option score as the base score and applies linear speed bonus decay', () => {
    const result = calculateScore(80, 30_000, 0, {
      speedBonusEnabled: true,
      speedBonusMax: 20,
      speedBonusDecaySeconds: 60,
    });

    expect(result).toEqual({ baseScore: 80, speedBonus: 10, totalScore: 90 });
  });

  it('does not award a speed bonus after the decay window', () => {
    const result = calculateScore(80, 61_000, 0, {
      speedBonusEnabled: true,
      speedBonusMax: 20,
      speedBonusDecaySeconds: 60,
    });

    expect(result).toEqual({ baseScore: 80, speedBonus: 0, totalScore: 80 });
  });

  it('clamps malformed scores and timing values to stable bounds', () => {
    const earlyDecision = calculateScore(150, -5_000, 0, {
      speedBonusEnabled: true,
      speedBonusMax: 25,
      speedBonusDecaySeconds: 60,
    });

    const invalidScore = calculateScore(Number.NaN, 0, 0, {
      speedBonusEnabled: false,
      speedBonusMax: 25,
      speedBonusDecaySeconds: 60,
    });

    expect(earlyDecision).toEqual({ baseScore: 100, speedBonus: 25, totalScore: 125 });
    expect(invalidScore).toEqual({ baseScore: 0, speedBonus: 0, totalScore: 0 });
  });
});

describe('buildLeaderboard', () => {
  it('ranks players by total score without mutating the caller input', () => {
    const players = [
      { userId: 'a', displayName: 'A', role: 'Legal', totalScore: 10, learningScore: 10 },
      { userId: 'b', displayName: 'B', role: 'IR', totalScore: 30, learningScore: 20 },
      { userId: 'c', displayName: 'C', role: 'Comms', totalScore: 20, learningScore: 30 },
    ];

    const ranked = buildLeaderboard(players);

    expect(ranked.map((p) => [p.userId, p.rank])).toEqual([
      ['b', 1],
      ['c', 2],
      ['a', 3],
    ]);
    expect(players.map((p) => p.userId)).toEqual(['a', 'b', 'c']);
  });
});

describe('analyzeGaps', () => {
  it('groups decisions by phase and NIST CSF function and returns weakest areas first', () => {
    const gaps = analyzeGaps([
      { phase: 'Detect', nistCsfFunction: 'DETECT', baseScore: 20 },
      { phase: 'Detect', nistCsfFunction: 'DETECT', baseScore: 60 },
      { phase: 'Recover', nistCsfFunction: 'RECOVER', baseScore: 90 },
    ]);

    expect(gaps).toEqual([
      {
        phase: 'Detect',
        nistCsfFunction: 'DETECT',
        avgScore: 40,
        decisionCount: 2,
        strength: 'gap',
      },
      {
        phase: 'Recover',
        nistCsfFunction: 'RECOVER',
        avgScore: 90,
        decisionCount: 1,
        strength: 'strong',
      },
    ]);
  });
});
