export interface ScoringConfig {
  speedBonusEnabled: boolean;
  speedBonusMax: number;      // default 25
  speedBonusDecaySeconds: number; // default 60
}

export interface ScoreResult {
  baseScore: number;
  speedBonus: number;
  totalScore: number;
}

export function calculateScore(
  scoreWeight: number,
  decisionTimestampMs: number,
  injectStartMs: number,
  config: ScoringConfig
): ScoreResult {
  const baseScore = scoreWeight; // 0-100

  let speedBonus = 0;
  if (config.speedBonusEnabled) {
    const elapsedSeconds = (decisionTimestampMs - injectStartMs) / 1000;
    if (elapsedSeconds <= config.speedBonusDecaySeconds) {
      const decay = 1 - elapsedSeconds / config.speedBonusDecaySeconds;
      speedBonus = Math.round(config.speedBonusMax * decay);
    }
  }

  return {
    baseScore,
    speedBonus,
    totalScore: baseScore + speedBonus,
  };
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  role: string;
  totalScore: number;
  learningScore: number;
  rank: number;
}

export function buildLeaderboard(
  players: Array<{
    userId: string;
    displayName: string;
    role: string;
    totalScore: number;
    learningScore: number;
  }>
): LeaderboardEntry[] {
  return players
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((p, idx) => ({ ...p, rank: idx + 1 }));
}

export interface GapAnalysis {
  phase: string;
  nistCsfFunction: string;
  avgScore: number;
  decisionCount: number;
  strength: 'strong' | 'adequate' | 'gap' | 'critical-gap';
}

export function analyzeGaps(
  decisions: Array<{
    phase: string;
    nistCsfFunction: string;
    baseScore: number;
  }>
): GapAnalysis[] {
  const grouped = new Map<string, number[]>();

  for (const d of decisions) {
    const key = `${d.phase}||${d.nistCsfFunction}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(d.baseScore);
  }

  const result: GapAnalysis[] = [];

  for (const [key, scores] of grouped) {
    const [phase, nistCsfFunction] = key.split('||');
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    result.push({
      phase,
      nistCsfFunction,
      avgScore: Math.round(avgScore),
      decisionCount: scores.length,
      strength:
        avgScore >= 80
          ? 'strong'
          : avgScore >= 60
          ? 'adequate'
          : avgScore >= 40
          ? 'gap'
          : 'critical-gap',
    });
  }

  return result.sort((a, b) => a.avgScore - b.avgScore);
}
