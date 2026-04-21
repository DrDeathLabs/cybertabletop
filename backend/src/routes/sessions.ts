import { Router, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requireAuth, requireFacilitator, AuthRequest } from '../middleware/auth';
import {
  createSession,
  getSessionWithPlayers,
  getSessionByJoinCode,
  addPlayerToSession,
  getSessionDebriefData,
} from '../services/session';
import { prisma } from '../services/db';
import { buildLeaderboard, analyzeGaps } from '../services/scoring';
import { canManageSession, canViewSession } from '../services/session-access';
import { audit } from '../services/audit';
import { AiScenarioType, AiDifficulty } from '../services/ai/generate-scenario';
import { getAISettings } from '../services/ai-config';
import { getTemplateContent, applyTemplate } from '../services/prompt-templates';
import {
  generateScenarioSetup,
  streamScenarioSetup,
  generateSingleInject,
  streamSingleInject,
  ScenarioSetup,
  InjectContext,
  OrgContext,
} from '../services/ai/generate-inject';
import {
  generateOpeningScript,
  generateRoundIntroScript,
  generateRoundScript,
  generateClosingScript,
} from '../services/ai/generate-script';
import {
  getFacilitatorScript,
  normalizeFacilitatorScript,
  startFacilitatorScriptPreload,
} from '../services/facilitator-script';
import { buildMergedAiContext } from '../services/org-config';
import { generateDebriefPdf, getDebriefPdfFilename } from '../services/reports/debrief-pdf';
import { generateDebriefDocx, getDebriefDocxFilename } from '../services/reports/debrief-docx';

const router = Router();

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim());
  return items.length ? items : undefined;
}

async function buildPromptOrgContext(
  orgId: string | null | undefined,
  base: {
    orgName?: string;
    industry?: string;
    crownJewels?: string[];
  },
): Promise<OrgContext | undefined> {
  const merged = await buildMergedAiContext(orgId, {
    orgName: base.orgName,
    industry: base.industry,
    crownJewels: base.crownJewels,
  });

  const context: OrgContext = {
    orgName: stringOrUndefined(merged.orgName),
    industry: stringOrUndefined(merged.industry),
    crownJewels: stringArray(merged.crownJewels),
    roleNames: stringArray(merged.rolesPresent),
    divisionNames: stringArray(merged.divisionNames),
    websiteUrl: stringOrUndefined(merged.orgWebsite),
    websiteSummary: stringOrUndefined(merged.websiteSummary),
    orgContextNotes: stringOrUndefined(merged.orgContextNotes),
  };

  return Object.values(context).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value))
    ? context
    : undefined;
}

type DebriefSessionData = NonNullable<Awaited<ReturnType<typeof getSessionDebriefData>>>;

function buildDebriefPayload(data: DebriefSessionData) {
  const leaderboard = buildLeaderboard(
    data.players.map((p) => ({
      userId: p.userId,
      displayName: p.user.displayName,
      role: p.assignedRole,
      totalScore: p.totalScore,
      learningScore: p.learningScore,
    })),
  ).map((entry) => {
    const player = data.players.find((p) => p.userId === entry.userId);
    return { ...entry, speedBonusTotal: player?.speedBonusTotal ?? 0 };
  });

  const fnGroups = new Map<string, number[]>();
  for (const d of data.decisions) {
    const fn = d.inject.nistCsfFunction;
    if (!fn) continue;
    if (!fnGroups.has(fn)) fnGroups.set(fn, []);
    fnGroups.get(fn)!.push(d.score);
  }
  const nistGaps = [...fnGroups.entries()]
    .map(([fn, scores]) => {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return {
        function: fn,
        avgScore: Math.round(avg),
        decisionCount: scores.length,
        strength: (avg >= 80 ? 'strong' : avg >= 60 ? 'adequate' : avg >= 40 ? 'gap' : 'critical-gap') as string,
      };
    })
    .sort((a, b) => a.avgScore - b.avgScore);

  const injectMap = new Map<string, {
    id: string;
    title: string;
    phase: string;
    narrative: string;
    mitreAttackId: string | null;
    mitreAttackName: string | null;
    nistCsfFunction: string | null;
    options: Array<{
      id: string;
      text: string;
      scoreWeight: number;
      isOptimal: boolean;
      scriptedFeedback: string;
      feedbackTags: string[];
      consequences: string | null;
    }>;
    decisions: Array<{
      playerId: string;
      playerName: string;
      playerRole: string;
      optionId: string;
      optionText: string;
      isOptimal: boolean;
      score: number;
      speedBonus: number;
      rationale: string | null;
      feedback: string;
      aiFeedback: string | null;
      feedbackTags: string[];
      consequences: string | null;
      timestamp: string;
    }>;
  }>();

  for (const d of data.decisions) {
    if (!injectMap.has(d.inject.id)) {
      injectMap.set(d.inject.id, {
        id: d.inject.id,
        title: d.inject.title,
        phase: d.inject.phase,
        narrative: d.inject.narrative ?? '',
        mitreAttackId: d.inject.mitreAttackId ?? null,
        mitreAttackName: d.inject.mitreAttackName ?? null,
        nistCsfFunction: d.inject.nistCsfFunction ?? null,
        options: [...d.inject.options]
          .sort((a, b) => {
            if (a.isOptimal === b.isOptimal) return b.scoreWeight - a.scoreWeight;
            return a.isOptimal ? -1 : 1;
          })
          .map((option) => ({
            id: option.id,
            text: option.text,
            scoreWeight: option.scoreWeight,
            isOptimal: option.isOptimal ?? false,
            scriptedFeedback: option.scriptedFeedback ?? '',
            feedbackTags: (option.feedbackTags as string[]) ?? [],
            consequences: option.consequences ?? null,
          })),
        decisions: [],
      });
    }
    const playerRecord = data.players.find((p) => p.userId === d.playerId);
    injectMap.get(d.inject.id)!.decisions.push({
      playerId: d.playerId,
      playerName: d.player.displayName,
      playerRole: playerRecord?.assignedRole ?? '',
      optionId: d.optionId,
      optionText: d.option.text,
      isOptimal: d.option.isOptimal ?? false,
      score: d.score,
      speedBonus: d.speedBonus ?? 0,
      rationale: d.rationale ?? null,
      feedback: d.aiFeedback || d.option.scriptedFeedback || '',
      aiFeedback: d.aiFeedback ?? null,
      feedbackTags: (d.option.feedbackTags as string[]) ?? [],
      consequences: d.option.consequences ?? null,
      timestamp: d.timestamp.toISOString(),
    });
  }

  const startedAt = data.startedAt ?? data.createdAt;
  const endedAt = data.endedAt ?? null;
  const durationMinutes = startedAt && endedAt
    ? Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)
    : null;

  const optimalCount = data.decisions.filter((d) => d.option.isOptimal).length;
  const optimalRate = data.decisions.length > 0
    ? Math.round((optimalCount / data.decisions.length) * 100)
    : 0;

  const participants = data.players.map((p) => {
    const pDecisions = data.decisions.filter((d) => d.playerId === p.userId);
    const pOptimal = pDecisions.filter((d) => d.option.isOptimal).length;
    return {
      userId: p.userId,
      displayName: p.user.displayName,
      assignedRole: p.assignedRole,
      totalScore: p.totalScore,
      learningScore: p.learningScore,
      optimalCount: pOptimal,
      decisionCount: pDecisions.length,
    };
  });

  const mitreMap = new Map<string, string | null>();
  for (const d of data.decisions) {
    if (d.inject.mitreAttackId && !mitreMap.has(d.inject.mitreAttackId)) {
      mitreMap.set(d.inject.mitreAttackId, d.inject.mitreAttackName ?? null);
    }
  }
  const mitreTechniques = [...mitreMap.entries()].map(([id, name]) => ({ id, name }));

  const payload = {
    sessionId: data.id,
    scenarioTitle: data.scenario.title,
    scenarioType: data.scenario.type,
    scenarioDescription: (data.scenario as any).description ?? '',
    scenarioObjectives: ((data.scenario as any).objectives ?? []) as string[],
    scenarioDifficulty: (data.scenario as any).difficulty ?? null,
    orgName: (data as any).org?.name ?? null,
    joinCode: data.joinCode,
    date: startedAt?.toISOString() ?? data.createdAt.toISOString(),
    endedAt: endedAt?.toISOString() ?? null,
    durationMinutes,
    facilitator: { displayName: data.facilitator?.displayName ?? 'Unknown' },
    playerCount: data.players.length,
    totalDecisions: data.decisions.length,
    optimalRate,
    leaderboard,
    participants,
    mitreTechniques,
    nistGaps,
    injectReplays: [...injectMap.values()],
    facilitatorScript: normalizeFacilitatorScript((data as any).facilitatorScript),
    hotWash: (data as any).hotWash ?? null,
    aiDebriefText: (data as any).aiDebriefText ?? null,
    scenarioMode: (data.scenario as any).mode ?? 'SCRIPTED',
  };

  const normalizedHotWash = normalizePostExerciseAnalysis(payload.hotWash ?? {});
  const hasStoredHotWash = Object.values(normalizedHotWash).some((value) => value.trim().length > 0);

  return {
    ...payload,
    hotWash: hasStoredHotWash ? normalizedHotWash : buildAlgorithmicPostExerciseAnalysis(payload),
  };
}

// POST /api/sessions - create (facilitator+)
router.post('/', requireAuth, requireFacilitator, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    scenarioId: z.string().min(1).optional(),
    settings: z
      .object({
        speedBonusEnabled: z.boolean().optional(),
        speedBonusMax: z.number().min(0).max(100).optional(),
        speedBonusDecaySeconds: z.number().min(10).max(300).optional(),
        timerEnabled: z.boolean().optional(),
        showLeaderboard: z.boolean().optional(),
        showFeedbackImmediately: z.boolean().optional(),
      })
      .optional(),
    // AI-Driven mode fields
    aiDriven: z.boolean().optional(),
    aiPreviewMode: z.boolean().optional(),
    playerOnboarding: z.boolean().optional(),
    scenarioType: z.string().optional(),
    difficulty: z.string().optional(),
    objectives: z.string().optional(),
    approximateRounds: z.number().min(1).max(20).optional(),
    sessionName: z.string().max(100).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  let scenarioId = parsed.data.scenarioId;

  if (parsed.data.aiDriven) {
    // Create a minimal AI-driven scenario shell (no injects — generated at runtime)
    const scenarioTypeValue = parsed.data.scenarioType ?? 'CUSTOM';
    const difficultyValue = parsed.data.difficulty ?? 'INTERMEDIATE';
    const objectivesArray = parsed.data.objectives
      ? parsed.data.objectives.split('\n').map(s => s.trim()).filter(Boolean)
      : ['Assess team incident response capabilities'];

    const aiScenario = await prisma.scenario.create({
      data: {
        title: parsed.data.sessionName?.trim() || `AI-Driven ${scenarioTypeValue} Exercise`,
        description: 'Dynamically generated scenario — injects are created by AI in real time based on team responses.',
        type: scenarioTypeValue as any,
        difficulty: difficultyValue as any,
        mode: 'AI_DRIVEN',
        objectives: objectivesArray,
        isPublic: false,
        isBuiltIn: false,
        createdById: req.user!.id,
        orgId: req.user!.orgId ?? null,
      },
    });
    scenarioId = aiScenario.id;
  }

  if (!scenarioId) {
    res.status(400).json({ error: 'scenarioId is required for non-AI-driven sessions' });
    return;
  }

  // Verify the facilitator can access this scenario
  const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId } });
  if (!scenario) {
    res.status(404).json({ error: 'Scenario not found' });
    return;
  }
  const isSuperAdmin = req.user!.role === 'SUPER_ADMIN';
  const canAccess =
    isSuperAdmin ||
    scenario.isPublic ||
    scenario.isBuiltIn ||
    scenario.createdById === req.user!.id ||
    (req.user!.orgId !== null && scenario.orgId === req.user!.orgId);
  if (!canAccess) {
    res.status(403).json({ error: 'Access denied to this scenario' });
    return;
  }

  const session = await createSession({
    scenarioId,
    facilitatorId: req.user!.id,
    orgId: req.user!.orgId ?? undefined,
    settings: parsed.data.settings,
  });

  // Apply session flags
  if (parsed.data.aiDriven) {
    await prisma.session.update({
      where: { id: session.id },
      data: {
        name: parsed.data.sessionName?.trim() || null,
        aiPreviewMode: parsed.data.aiPreviewMode ?? true,
        playerOnboarding: parsed.data.playerOnboarding ?? false,
        totalRounds: parsed.data.approximateRounds ?? 5,
      },
    });
  } else if (parsed.data.sessionName?.trim()) {
    await prisma.session.update({
      where: { id: session.id },
      data: { name: parsed.data.sessionName.trim() },
    });
  }

  await audit({
    userId: req.user!.id,
    action: 'SESSION_CREATED',
    resource: session.id,
    metadata: { scenarioId, aiDriven: parsed.data.aiDriven ?? false },
  });

  res.status(201).json({ session, aiDriven: parsed.data.aiDriven ?? false });
});

// GET /api/sessions - list sessions for any authenticated user
// Facilitators see sessions they own; players see sessions they've joined.
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const isFacilitatorRole = ['FACILITATOR', 'ORG_ADMIN', 'SUPER_ADMIN'].includes(req.user!.role);

  if (isFacilitatorRole) {
    const sessions = await prisma.session.findMany({
      where: { facilitatorId: req.user!.id },
      include: {
        scenario: { select: { id: true, title: true, type: true } },
        _count: { select: { players: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ sessions });
  } else {
    // PLAYER: return the sessions they have joined
    const playerRecords = await prisma.sessionPlayer.findMany({
      where: { userId: req.user!.id },
      include: {
        session: {
          include: {
            scenario: { select: { id: true, title: true, type: true } },
            _count: { select: { players: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
      take: 50,
    });
    const sessions = playerRecords.map((p) => p.session);
    res.json({ sessions });
  }
});

// GET /api/sessions/:id - get session detail
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const session = await getSessionWithPlayers(req.params.id);

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (!canViewSession(req.user!, session)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.json({ session });
});

// POST /api/sessions/join - join by code
router.post('/join', requireAuth, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    joinCode: z.string().min(6).max(6).toUpperCase(),
    assignedRole: z.string().min(1).max(100),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid join code or role' });
    return;
  }

  const session = await getSessionByJoinCode(parsed.data.joinCode);

  if (!session) {
    res.status(404).json({ error: 'Session not found. Check your join code.' });
    return;
  }

  if (session.status === 'COMPLETE') {
    res.status(400).json({ error: 'This session has ended.' });
    return;
  }

  await addPlayerToSession(session.id, req.user!.id, parsed.data.assignedRole);

  res.json({
    session: {
      id: session.id,
      joinCode: session.joinCode,
      status: session.status,
      scenario: session.scenario,
    },
  });
});

// PATCH /api/sessions/:id/players/:userId/role - reassign role (facilitator only)
router.patch('/:id/players/:userId/role', requireAuth, requireFacilitator, async (req: AuthRequest, res: Response) => {
  const { role } = req.body;
  if (!role || typeof role !== 'string') {
    res.status(400).json({ error: 'Role required' });
    return;
  }

  const session = await prisma.session.findUnique({ where: { id: req.params.id } });
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (!canManageSession(req.user!, session)) {
    res.status(403).json({ error: 'Not authorized for this session' });
    return;
  }

  const updated = await prisma.sessionPlayer.updateMany({
    where: { sessionId: req.params.id, userId: req.params.userId },
    data: { assignedRole: role },
  });
  if (updated.count === 0) {
    res.status(404).json({ error: 'Player is not part of this session' });
    return;
  }

  res.json({ ok: true });
});

// GET /api/sessions/:id/injects - list injects for the session's scenario (facilitator)
// Injects that already have Decision records for this session are excluded — they've
// been presented and revealed so the facilitator cannot re-use them.
router.get('/:id/injects', requireAuth, requireFacilitator, async (req: AuthRequest, res: Response) => {
  const session = await prisma.session.findUnique({
    where: { id: req.params.id },
    select: { scenarioId: true, currentInjectId: true, facilitatorId: true, orgId: true },
  });
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (!canManageSession(req.user!, session)) {
    res.status(403).json({ error: 'Not authorized for this session' });
    return;
  }

  // Collect inject IDs that have already been scored/revealed (decisions recorded).
  // The currently-active inject may not have decisions yet, so it stays in the list
  // until it's revealed; the frontend tracks it client-side via usedInjectIds.
  const usedDecisions = await prisma.decision.findMany({
    where: { sessionId: req.params.id },
    select: { injectId: true },
    distinct: ['injectId'],
  });
  const usedIds = new Set(usedDecisions.map((d) => d.injectId));

  const injects = await prisma.inject.findMany({
    where: { scenarioId: session.scenarioId },
    select: { id: true, title: true, phase: true, phaseOrder: true, injectOrder: true },
    orderBy: [{ phaseOrder: 'asc' }, { injectOrder: 'asc' }],
  });

  // Return only injects that have not yet been used (plus expose used set so the
  // client can also seed its local usedInjectIds for injects presented before page load).
  const available = injects.filter((i) => !usedIds.has(i.id));
  res.json({ injects: available, usedInjectIds: [...usedIds] });
});

// GET /api/sessions/:id/debrief - full debrief data
// Returns a flat, comprehensive shape ready for the frontend to render and export.
router.get('/:id/debrief', requireAuth, async (req: AuthRequest, res: Response) => {
  const data = await getSessionDebriefData(req.params.id);

  if (!data) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  if (!canViewSession(req.user!, data)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.json(buildDebriefPayload(data));
  return;
  /*

  // ── Leaderboard ─────────────────────────────────────────────────────────────
  const leaderboard = buildLeaderboard(
    data.players.map((p) => ({
      userId: p.userId,
      displayName: p.user.displayName,
      role: p.assignedRole,
      totalScore: p.totalScore,
      learningScore: p.learningScore,
    }))
  ).map((entry) => {
    const player = data.players.find((p) => p.userId === entry.userId);
    return { ...entry, speedBonusTotal: player?.speedBonusTotal ?? 0 };
  });

  // ── NIST CSF gap analysis (aggregated by function) ───────────────────────────
  const fnGroups = new Map<string, number[]>();
  for (const d of data.decisions) {
    const fn = d.inject.nistCsfFunction;
    if (!fn) continue;
    if (!fnGroups.has(fn)) fnGroups.set(fn, []);
    fnGroups.get(fn)!.push(d.score);
  }
  const nistGaps = [...fnGroups.entries()]
    .map(([fn, scores]) => {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return {
        function: fn,
        avgScore: Math.round(avg),
        decisionCount: scores.length,
        strength: (avg >= 80 ? 'strong' : avg >= 60 ? 'adequate' : avg >= 40 ? 'gap' : 'critical-gap') as string,
      };
    })
    .sort((a, b) => a.avgScore - b.avgScore);

  // ── Inject replays (group decisions by inject, preserving scenario order) ───
  const injectMap = new Map<string, {
    id: string; title: string; phase: string; narrative: string;
    mitreAttackId: string | null; mitreAttackName: string | null;
    nistCsfFunction: string | null; options: object[]; decisions: object[];
  }>();

  for (const d of data.decisions) {
    if (!injectMap.has(d.inject.id)) {
      injectMap.set(d.inject.id, {
        id: d.inject.id,
        title: d.inject.title,
        phase: d.inject.phase,
        narrative: d.inject.narrative ?? '',
        mitreAttackId: d.inject.mitreAttackId ?? null,
        mitreAttackName: d.inject.mitreAttackName ?? null,
        nistCsfFunction: d.inject.nistCsfFunction ?? null,
        options: [...d.inject.options]
          .sort((a, b) => {
            if (a.isOptimal === b.isOptimal) return b.scoreWeight - a.scoreWeight;
            return a.isOptimal ? -1 : 1;
          })
          .map((option) => ({
            id: option.id,
            text: option.text,
            scoreWeight: option.scoreWeight,
            isOptimal: option.isOptimal ?? false,
            scriptedFeedback: option.scriptedFeedback ?? '',
            feedbackTags: (option.feedbackTags as string[]) ?? [],
            consequences: option.consequences ?? null,
          })),
        decisions: [],
      });
    }
    const playerRecord = data.players.find((p) => p.userId === d.playerId);
    injectMap.get(d.inject.id)!.decisions.push({
      playerId: d.playerId,
      playerName: d.player.displayName,
      playerRole: playerRecord?.assignedRole ?? '',
      optionId: d.optionId,
      optionText: d.option.text,
      isOptimal: d.option.isOptimal ?? false,
      score: d.score,
      speedBonus: d.speedBonus ?? 0,
      rationale: d.rationale ?? null,
      feedback: d.aiFeedback || d.option.scriptedFeedback || '',
      aiFeedback: d.aiFeedback ?? null,
      feedbackTags: (d.option.feedbackTags as string[]) ?? [],
      consequences: d.option.consequences ?? null,
      timestamp: d.timestamp.toISOString(),
    });
  }

  // ── Duration ─────────────────────────────────────────────────────────────────
  const startedAt = data.startedAt ?? data.createdAt;
  const endedAt = data.endedAt ?? null;
  const durationMinutes = startedAt && endedAt
    ? Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)
    : null;

  // ── Optimal rate ─────────────────────────────────────────────────────────────
  const optimalCount = data.decisions.filter((d) => d.option.isOptimal).length;
  const optimalRate = data.decisions.length > 0
    ? Math.round((optimalCount / data.decisions.length) * 100)
    : 0;

  // ── Participants roster ──────────────────────────────────────────────────────
  const participants = data.players.map((p) => {
    const pDecisions = data.decisions.filter((d) => d.playerId === p.userId);
    const pOptimal   = pDecisions.filter((d) => d.option.isOptimal).length;
    return {
      userId:       p.userId,
      displayName:  p.user.displayName,
      assignedRole: p.assignedRole,
      totalScore:   p.totalScore,
      learningScore: p.learningScore,
      optimalCount:  pOptimal,
      decisionCount: pDecisions.length,
    };
  });

  // ── MITRE ATT&CK techniques encountered ──────────────────────────────────────
  const mitreMap = new Map<string, string | null>();
  for (const d of data.decisions) {
    if (d.inject.mitreAttackId && !mitreMap.has(d.inject.mitreAttackId)) {
      mitreMap.set(d.inject.mitreAttackId, d.inject.mitreAttackName ?? null);
    }
  }
  const mitreTechniques = [...mitreMap.entries()].map(([id, name]) => ({ id, name }));

  res.json({
    sessionId: data.id,
    scenarioTitle:       data.scenario.title,
    scenarioType:        data.scenario.type,
    scenarioDescription: (data.scenario as any).description ?? '',
    scenarioObjectives:  ((data.scenario as any).objectives ?? []) as string[],
    scenarioDifficulty:  (data.scenario as any).difficulty ?? null,
    orgName:             (data as any).org?.name ?? null,
    joinCode: data.joinCode,
    date: startedAt?.toISOString() ?? data.createdAt.toISOString(),
    endedAt: endedAt?.toISOString() ?? null,
    durationMinutes,
    facilitator: { displayName: data.facilitator?.displayName ?? 'Unknown' },
    playerCount: data.players.length,
    totalDecisions: data.decisions.length,
    optimalRate,
    leaderboard,
    participants,
    mitreTechniques,
    nistGaps,
    injectReplays: [...injectMap.values()],
    facilitatorScript: normalizeFacilitatorScript((data as any).facilitatorScript),
    hotWash: (data as any).hotWash ?? null,
    aiDebriefText: (data as any).aiDebriefText ?? null,
    scenarioMode: (data.scenario as any).mode ?? 'SCRIPTED',
  });
  */
});

// ─── Hot Wash (AAR) ──────────────────────────────────────────────────────────

router.get('/:id/debrief/pdf', requireAuth, async (req: AuthRequest, res: Response) => {
  const data = await getSessionDebriefData(req.params.id);

  if (!data) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  if (!canViewSession(req.user!, data)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const payload = buildDebriefPayload(data);
  const pdf = await generateDebriefPdf(payload);
  const filename = getDebriefPdfFilename(payload);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(pdf);
});

router.get('/:id/debrief/docx', requireAuth, async (req: AuthRequest, res: Response) => {
  const data = await getSessionDebriefData(req.params.id);

  if (!data) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  if (!canViewSession(req.user!, data)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const payload = buildDebriefPayload(data);
  const docx = await generateDebriefDocx(payload);
  const filename = getDebriefDocxFilename(payload);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(docx);
});

type PostExerciseAnalysis = {
  overallAssessment: string;
  strengthsObserved: string;
  gapsAndImprovementAreas: string;
  rootCauses: string;
  operationalImpact: string;
  priorityActions: string;
  nextTrainingSteps: string;
  leadershipConsiderations: string;
};

function normalizePostExerciseAnalysis(input: any): PostExerciseAnalysis {
  return {
    overallAssessment: typeof input?.overallAssessment === 'string' ? input.overallAssessment : '',
    strengthsObserved: typeof input?.strengthsObserved === 'string'
      ? input.strengthsObserved
      : (typeof input?.strengths === 'string' ? input.strengths : ''),
    gapsAndImprovementAreas: typeof input?.gapsAndImprovementAreas === 'string'
      ? input.gapsAndImprovementAreas
      : [input?.weaknesses, input?.gaps].filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).join('\n\n'),
    rootCauses: typeof input?.rootCauses === 'string'
      ? input.rootCauses
      : (typeof input?.unexpectedIssues === 'string' ? input.unexpectedIssues : ''),
    operationalImpact: typeof input?.operationalImpact === 'string' ? input.operationalImpact : '',
    priorityActions: typeof input?.priorityActions === 'string'
      ? input.priorityActions
      : (typeof input?.priorities === 'string' ? input.priorities : ''),
    nextTrainingSteps: typeof input?.nextTrainingSteps === 'string'
      ? input.nextTrainingSteps
      : (typeof input?.recommendations === 'string' ? input.recommendations : ''),
    leadershipConsiderations: typeof input?.leadershipConsiderations === 'string' ? input.leadershipConsiderations : '',
  };
}

function buildAlgorithmicPostExerciseAnalysis(payload: {
  totalDecisions: number;
  optimalRate: number;
  nistGaps: Array<{ function: string; avgScore: number; strength: string }>;
  injectReplays: Array<{ title: string; phase: string; decisions: Array<{ score: number }> }>;
  participants: Array<{ displayName: string; assignedRole: string; totalScore: number }>;
}): PostExerciseAnalysis {
  const injectAverages = payload.injectReplays.map((inject) => {
    const scores = inject.decisions.map((decision) => decision.score);
    const avg = scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
    return { title: inject.title, phase: inject.phase, avg, count: scores.length };
  });

  const strongInjects = injectAverages.filter((inject) => inject.avg >= 75);
  const weakInjects = injectAverages.filter((inject) => inject.avg < 50);
  const adequateInjects = injectAverages.filter((inject) => inject.avg >= 50 && inject.avg < 75);
  const gapFunctions = payload.nistGaps.filter((gap) => gap.strength === 'gap' || gap.strength === 'critical-gap');
  const strongFunctions = payload.nistGaps.filter((gap) => gap.strength === 'strong');
  const criticalGaps = payload.nistGaps.filter((gap) => gap.strength === 'critical-gap');
  const topParticipant = payload.participants.length > 0
    ? [...payload.participants].sort((a, b) => b.totalScore - a.totalScore)[0]
    : null;
  const bestInjectNames = strongInjects.slice(0, 3).map((inject) => `"${inject.title}" (${inject.avg}%)`);
  const weakInjectNames = weakInjects.slice(0, 3).map((inject) => `"${inject.title}" (${inject.phase}, ${inject.avg}%)`);

  let overallAssessment = '';
  if (payload.totalDecisions === 0) {
    overallAssessment = 'No decision data was recorded for this session, so overall readiness could not be fully assessed. The exercise still provided useful scenario discussion and facilitation value, but future sessions should ensure player submissions are captured so readiness conclusions can be supported by evidence.';
  } else if (payload.optimalRate >= 80) {
    overallAssessment = `The exercise indicates a strong level of response readiness, with ${payload.optimalRate}% of decisions aligning to the optimal course of action across ${payload.totalDecisions} decisions. Participants demonstrated the ability to interpret evolving incident information, coordinate response actions, and sustain performance through multiple scenario phases with comparatively limited coaching.`;
  } else if (payload.optimalRate >= 60) {
    overallAssessment = `The exercise indicates a moderate but credible level of response readiness, with ${payload.optimalRate}% of decisions aligning to the optimal course of action across ${payload.totalDecisions} decisions. Core incident response capability is present, but the results show enough variation in judgment and execution to justify targeted follow-on training before the team can be considered consistently reliable under pressure.`;
  } else {
    overallAssessment = `The exercise indicates that incident response readiness needs improvement, with only ${payload.optimalRate}% of decisions aligning to the optimal course of action across ${payload.totalDecisions} decisions. The results suggest that key roles are not yet applying procedures consistently enough to support a confident real-world response without additional coaching, rehearsal, and playbook reinforcement.`;
  }

  const strengthsParts: string[] = [];
  if (strongFunctions.length > 0) {
    strengthsParts.push(`The team demonstrated comparatively strong capability in ${strongFunctions.map((gap) => gap.function).join('; ')}, indicating that these functions are better understood and more consistently executed than the rest of the response lifecycle.`);
  }
  if (bestInjectNames.length > 0) {
    strengthsParts.push(`The strongest inject performance was observed in ${bestInjectNames.join(', ')}, where participants showed clearer decision discipline and better alignment to expected response actions.`);
  }
  if (topParticipant) {
    strengthsParts.push(`Top individual performance came from ${topParticipant.displayName}${topParticipant.assignedRole ? ` (${topParticipant.assignedRole})` : ''}, whose results can be used as a positive benchmark when coaching the rest of the team.`);
  }
  if (strengthsParts.length === 0) {
    strengthsParts.push('Participants remained engaged throughout the exercise and completed the scenario flow, providing a usable foundation for follow-on coaching and process improvement.');
  }
  const strengthsObserved = strengthsParts.join(' ');

  const gapsParts: string[] = [];
  if (criticalGaps.length > 0) {
    gapsParts.push(`Critical performance gaps were identified in ${criticalGaps.map((gap) => gap.function).join('; ')}, where decision quality fell low enough to indicate material operational risk if the same behaviors occurred during a live incident.`);
  }
  if (gapFunctions.length > criticalGaps.length) {
    const nonCritical = gapFunctions.filter((gap) => gap.strength === 'gap');
    gapsParts.push(`Additional below-target performance was observed in ${nonCritical.map((gap) => gap.function).join('; ')}, showing that several supporting response functions remain underdeveloped even where outright failure was not observed.`);
  }
  if (weakInjectNames.length > 0) {
    gapsParts.push(`The clearest scenario-level difficulties appeared in ${weakInjectNames.join(', ')}, where participants either hesitated, selected riskier options, or missed stronger containment, communication, or recovery choices.`);
  }
  if (adequateInjects.length > 0 && weakInjects.length === 0) {
    gapsParts.push(`No inject collapsed into a severe failure mode, but ${adequateInjects.length} inject${adequateInjects.length !== 1 ? 's' : ''} remained only adequate, which means the team is still relying on baseline familiarity rather than polished execution.`);
  }
  if (gapsParts.length === 0) {
    gapsParts.push('No major improvement area clearly dominated this exercise, but maintaining and extending current performance will still require recurring scenario repetition and periodic procedure review.');
  }
  const gapsAndImprovementAreas = gapsParts.join(' ');

  const rootCauseParts: string[] = [];
  if (gapFunctions.length > 0) {
    rootCauseParts.push('The pattern of scoring suggests that the primary drivers were not isolated mistakes, but uneven procedure internalization across response functions. That usually points to stale playbooks, insufficient repetition, or unclear decision ownership during time-sensitive events.');
  }
  if (weakInjects.length > 0) {
    rootCauseParts.push('Lower-scoring injects also indicate that participants were less confident when the scenario shifted from recognition into coordinated response and consequence management, which is often a sign that cross-functional rehearsals are not happening often enough.');
  }
  if (payload.participants.length > 1) {
    rootCauseParts.push('Because performance varied across participants, the exercise also suggests that knowledge and expectations are not yet distributed evenly across the team, increasing the risk that execution quality depends too heavily on a few stronger individuals.');
  }
  if (rootCauseParts.length === 0) {
    rootCauseParts.push('No dominant root cause pattern was isolated from the available data, but the results still support continued repetition, documentation review, and reinforcement of role expectations.');
  }
  const rootCauses = rootCauseParts.join(' ');

  let operationalImpact = '';
  if (payload.totalDecisions === 0) {
    operationalImpact = 'Because no decision evidence was recorded, the exercise cannot support a strong operational impact estimate. In a live event, that same lack of documented decision flow would also make it harder to evaluate response quality, justify leadership actions, and improve future performance.';
  } else if (payload.optimalRate >= 75 && gapFunctions.length === 0) {
    operationalImpact = 'If this performance translated into a real incident, the organization would likely be able to stabilize the event with manageable disruption, though response speed and consistency could still be improved. The main residual risk would be uneven execution during more complex or longer-duration incidents.';
  } else {
    operationalImpact = `If the same performance pattern carried into a live incident, the organization could face delayed containment, uneven internal coordination, and a higher chance of avoidable business disruption. The combination of ${payload.optimalRate}% optimal decisions and the observed low-scoring areas suggests meaningful exposure to slower recovery timelines, leadership friction, and preventable escalation of operational impact.`;
  }

  const priorityItems: string[] = [];
  criticalGaps.forEach((gap, index) => {
    priorityItems.push(`${index + 1}. Conduct targeted remediation for ${gap.function} procedures, including role walkthroughs and playbook review. Owner: Incident Response Lead. Priority: Immediate.`);
  });
  weakInjects.slice(0, Math.max(0, 3 - criticalGaps.length)).forEach((inject, index) => {
    priorityItems.push(`${criticalGaps.length + index + 1}. Update the organization's response procedures, escalation criteria, and decision support guidance using lessons from "${inject.title}" so teams have clearer direction during similar incidents. Owner: Incident Response Lead.`);
  });
  if (priorityItems.length === 0) {
    priorityItems.push('1. Preserve current readiness by scheduling the next scenario at a slightly higher level of complexity and reviewing lessons learned with all participants.');
    priorityItems.push('2. Validate that current playbooks, contact trees, and decision authority references remain current and accessible.');
  }
  const priorityActions = priorityItems.join('\n');

  const trainingItems: string[] = [];
  if (gapFunctions.length > 0) {
    trainingItems.push(`Validate corrective actions for ${gapFunctions.map((gap) => gap.function).join('; ')} through a targeted readiness review or follow-on exercise once procedures, ownership, and supporting guidance have been updated.`);
  }
  trainingItems.push('Review the exercise findings with operational stakeholders within five business days so corrective actions, ownership, and decision expectations are clearly communicated while the scenario is still fresh.');
  if (payload.optimalRate < 70) {
    trainingItems.push('Use shorter validation drills after procedural updates are made so the organization can confirm improvement in the weakest decision areas before moving back into longer or more complex scenarios.');
  }
  if (trainingItems.length === 0) {
    trainingItems.push('Maintain a recurring exercise cadence and incrementally increase complexity to ensure current strengths remain durable.');
  }
  const nextTrainingSteps = trainingItems.join('\n');

  const leadershipItems: string[] = [];
  if (gapFunctions.length > 0) {
    leadershipItems.push('Leadership should treat the low-scoring response areas as capability development items, not just individual coaching issues, because the exercise evidence points to process and governance improvement needs.');
  }
  if (topParticipant && payload.participants.length > 1) {
    leadershipItems.push(`The variance between participants suggests an opportunity for leadership to standardize expectations, reinforce role accountability, and reduce over-reliance on stronger performers such as ${topParticipant.displayName}.`);
  }
  leadershipItems.push('Management review should confirm ownership, due dates, and follow-up validation for the priority actions captured in this report so the exercise produces measurable readiness improvement rather than only discussion.');
  const leadershipConsiderations = leadershipItems.join(' ');

  return {
    overallAssessment,
    strengthsObserved,
    gapsAndImprovementAreas,
    rootCauses,
    operationalImpact,
    priorityActions,
    nextTrainingSteps,
    leadershipConsiderations,
  };
}

// PUT /api/sessions/:id/hot-wash — facilitator saves after-action hot wash data
router.put('/:id/hot-wash', requireAuth, requireFacilitator, async (req: AuthRequest, res: Response) => {
  const session = await prisma.session.findUnique({ where: { id: req.params.id }, select: { facilitatorId: true, orgId: true } });
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  if (!canManageSession(req.user!, session)) {
    res.status(403).json({ error: 'Only the facilitator can save hot wash data' }); return;
  }
  await prisma.session.update({
    where: { id: req.params.id },
    data: {
      hotWash: normalizePostExerciseAnalysis(req.body),
    },
  });
  res.json({ ok: true });
});

// POST /api/sessions/:id/hot-wash/generate — AI-generate hot wash content from session data
router.post('/:id/hot-wash/generate', requireAuth, requireFacilitator, async (req: AuthRequest, res: Response) => {
  const sessionCheck = await prisma.session.findUnique({ where: { id: req.params.id }, select: { facilitatorId: true, orgId: true } });
  if (!sessionCheck) { res.status(404).json({ error: 'Session not found' }); return; }
  if (!canManageSession(req.user!, sessionCheck)) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }

  const data = await getSessionDebriefData(req.params.id);
  if (!data) { res.status(404).json({ error: 'Session not found' }); return; }

  // ── Compute summary stats ──────────────────────────────────────────────────
  const totalDecisions  = data.decisions.length;
  const optimalCount    = data.decisions.filter((d) => d.option.isOptimal).length;
  const optimalRate     = totalDecisions > 0 ? Math.round((optimalCount / totalDecisions) * 100) : 0;
  const avgScore        = totalDecisions > 0
    ? Math.round(data.decisions.reduce((s, d) => s + d.score, 0) / totalDecisions) : 0;

  // NIST CSF gap analysis per-function (aggregate across phases)
  const csfMap = new Map<string, number[]>();
  for (const d of data.decisions) {
    const fn = d.inject.nistCsfFunction ?? 'UNKNOWN';
    if (!csfMap.has(fn)) csfMap.set(fn, []);
    csfMap.get(fn)!.push(d.score);
  }
  const csfSummary = [...csfMap.entries()].map(([fn, scores]) => ({
    fn,
    avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    strength: scores.reduce((a, b) => a + b, 0) / scores.length >= 75 ? 'strong'
            : scores.reduce((a, b) => a + b, 0) / scores.length >= 55 ? 'adequate'
            : scores.reduce((a, b) => a + b, 0) / scores.length >= 35 ? 'gap'
            : 'critical-gap',
  })).sort((a, b) => a.avg - b.avg);

  // Phase performance
  const phaseMap = new Map<string, number[]>();
  for (const d of data.decisions) {
    const ph = d.inject.phase ?? 'Unknown';
    if (!phaseMap.has(ph)) phaseMap.set(ph, []);
    phaseMap.get(ph)!.push(d.score);
  }
  const phasePerf = [...phaseMap.entries()]
    .map(([phase, scores]) => ({ phase, avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) }))
    .sort((a, b) => a.avg - b.avg);

  const scenario = data.scenario as any;
  const orgName  = (data as any).org?.name ?? null;

  // ── Build AI prompt from editable template ─────────────────────────────────
  const templateContent = await getTemplateContent('hot_wash_prompt');
  const prompt = applyTemplate(templateContent, {
    SCENARIO_TITLE:      scenario.title ?? 'Unknown',
    SCENARIO_TYPE:       scenario.type  ?? 'Unknown',
    SCENARIO_DIFFICULTY: scenario.difficulty ?? 'Unknown',
    ORG_NAME:            orgName ?? 'N/A',
    PLAYER_COUNT:        String(data.players.length),
    TOTAL_DECISIONS:     String(totalDecisions),
    OPTIMAL_RATE:        String(optimalRate),
    AVG_SCORE:           String(avgScore),
    CSF_PERFORMANCE:     csfSummary.length
      ? csfSummary.map((g) => `  ${g.fn}: ${g.avg}% (${g.strength})`).join('\n')
      : '  No CSF-tagged decisions',
    PHASE_PERFORMANCE:   phasePerf.length
      ? phasePerf.map((p) => `  ${p.phase}: ${p.avg}% avg`).join('\n')
      : '  No phase data',
    SCENARIO_OBJECTIVES: (scenario.objectives ?? []).length
      ? (scenario.objectives as string[]).map((o) => `  - ${o}`).join('\n')
      : '  None listed',
  });

  // ── Call AI provider ───────────────────────────────────────────────────────
  interface HotWashResult extends PostExerciseAnalysis {}

  function algorithmicFallback(): HotWashResult {
    const strong = csfSummary.filter((g) => g.strength === 'strong');
    const gaps   = csfSummary.filter((g) => g.strength === 'gap' || g.strength === 'critical-gap');
    const worstPhase = phasePerf[0];
    const bestPhase  = phasePerf[phasePerf.length - 1];
    const overallAssessment = totalDecisions === 0
      ? 'No decision data was recorded for this session, so overall readiness could not be fully assessed. The exercise still provided useful discussion value, but future sessions should ensure participant decisions are captured so readiness conclusions can be supported by evidence.'
      : optimalRate >= 80
        ? `The exercise indicates a strong level of response readiness, with ${optimalRate}% of decisions aligning to the optimal course of action across ${totalDecisions} recorded decisions. Participants demonstrated comparatively mature judgment across the scenario lifecycle and were generally able to sustain decision quality as conditions evolved.`
        : optimalRate >= 60
          ? `The exercise indicates a moderate but credible level of response readiness, with ${optimalRate}% of decisions aligning to the optimal course of action across ${totalDecisions} recorded decisions. Core capability is present, but the results still show enough inconsistency to justify targeted follow-on training before the team can be considered reliably prepared under pressure.`
          : `The exercise indicates that incident response readiness needs improvement, with only ${optimalRate}% of decisions aligning to the optimal course of action across ${totalDecisions} recorded decisions. The evidence suggests that key procedures are not yet being applied consistently enough to support a confident real-world response.`;

    const strengthsObserved = strong.length > 0
      ? `The strongest performance was observed in ${strong.map((g) => g.fn).join(' and ')} function${strong.length > 1 ? 's' : ''} of the NIST Cybersecurity Framework, where participants demonstrated better alignment to expected response actions. `
        + (bestPhase ? `The "${bestPhase.phase}" phase also produced the highest average score of ${bestPhase.avg}%, indicating comparatively stronger execution in that part of the scenario. ` : '')
        + 'These areas should be treated as internal benchmarks for coaching and future scenario design.'
      : 'Participants remained engaged through the exercise and completed the scenario flow, providing usable evidence for coaching and improvement planning even where stronger response patterns were limited.';

    const gapsAndImprovementAreas = gaps.length > 0
      ? `The clearest improvement areas were observed in ${gaps.map((g) => `${g.fn} (${g.avg}%, ${g.strength})`).join('; ')}, where performance fell below the desired readiness threshold. `
        + (worstPhase ? `The "${worstPhase.phase}" phase also produced the lowest average score of ${worstPhase.avg}%, showing that response quality degraded most noticeably at that stage of the incident lifecycle. ` : '')
        + 'These results indicate that additional playbook reinforcement and targeted rehearsal are needed.'
      : `No single response function collapsed into a critical gap, but the team still left measurable room for improvement across several decisions. `
        + (worstPhase ? `The weakest phase was "${worstPhase.phase}" at ${worstPhase.avg}% average performance, which should be treated as the first candidate for follow-on improvement work. ` : '')
        + 'The exercise results support continued repetition before current performance should be considered fully durable.';

    const rootCauses = gaps.length > 0
      ? 'The scoring pattern suggests that the primary causes were uneven procedure internalization, inconsistent role confidence, and insufficient repetition of lower-performing response tasks. These are more likely to reflect process and rehearsal gaps than isolated individual errors.'
      : 'No single root cause dominated the exercise evidence, but the results still suggest that stronger repetition, clearer role expectations, and periodic procedure review would improve consistency.';

    const operationalImpact = totalDecisions === 0
      ? 'Because no decision evidence was captured, the exercise cannot support a strong operational impact estimate. In a real incident, that same lack of documented decision flow would also make it harder to evaluate response quality and justify leadership actions.'
      : optimalRate >= 75 && gaps.length === 0
        ? 'If this performance translated into a live incident, the organization would likely be able to stabilize the event with manageable disruption, though consistency and speed could still improve in more complex scenarios.'
        : `If the same performance pattern carried into a live incident, the organization could face delayed containment, uneven coordination, and a higher chance of avoidable business disruption. The observed low-scoring areas suggest meaningful exposure to slower recovery timelines and preventable escalation of operational impact.`;

    const priorityActions = [
      `1. Conduct targeted remediation for ${(gaps[0]?.fn ?? worstPhase?.phase ?? 'the lowest-scoring response area')} procedures, including playbook review and role walkthroughs. Owner: Incident Response Lead.`,
      `2. Update organizational response procedures, escalation criteria, and supporting decision guidance${worstPhase ? ` for the "${worstPhase.phase}" phase` : ''} so teams have clearer direction during similar incidents. Owner: Incident Response Lead.`,
      `3. Validate improvement in the identified weak areas after procedural changes are made, using a focused readiness review or follow-on exercise. Owner: Security Leadership.`,
    ].join('\n');

    const nextTrainingSteps = [
      `Validate the organization's updated response approach in ${(gaps[0]?.fn ?? worstPhase?.phase ?? 'the weakest response area')} after procedural and governance changes are implemented.`,
      'Review exercise findings and inject outcomes with operational and leadership stakeholders within five business days so required changes in ownership, escalation, and decision logic are clearly understood.',
      optimalRate < 70
        ? 'Use shorter, more frequent validation drills to confirm that recent organizational improvements are taking hold before moving back into longer or more complex scenarios.'
        : 'Maintain a recurring tabletop cadence and gradually increase scenario complexity so organizational strengths remain durable and measurable over time.',
    ].join('\n');

    const leadershipConsiderations = `Leadership should treat the findings in this section as capability development items rather than isolated player coaching notes. Management review should confirm ownership, due dates, and follow-up validation for the priority actions so the exercise produces measurable readiness improvement rather than only discussion.`;

    return {
      overallAssessment,
      strengthsObserved,
      gapsAndImprovementAreas,
      rootCauses,
      operationalImpact,
      priorityActions,
      nextTrainingSteps,
      leadershipConsiderations,
    };
  }

  try {
    let hotWash: HotWashResult | null = null;
    let provider = 'algorithmic';

    const aiCfg = await getAISettings();
    if (aiCfg.activeProvider === 'anthropic' && aiCfg.anthropic.apiKey) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: aiCfg.anthropic.apiKey });
      const msg = await client.messages.create({
        model: aiCfg.anthropic.model,
        max_tokens: aiCfg.anthropic.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
      hotWash  = normalizePostExerciseAnalysis(JSON.parse(text));
      provider = 'claude';
    } else if (aiCfg.activeProvider === 'ollama') {
      const { baseUrl, model, apiKey, numPredict, numCtx } = aiCfg.ollama;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      const r = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.7, num_predict: numPredict, num_ctx: numCtx } }),
        signal: AbortSignal.timeout(90_000),
      });
      const d = await r.json() as { response: string };
      hotWash  = normalizePostExerciseAnalysis(JSON.parse(d.response.trim()));
      provider = `ollama:${model}`;
    }

    res.json({ hotWash: hotWash ?? algorithmicFallback(), provider });
  } catch (err) {
    // AI call or JSON parse failed — fall back to algorithmic generation
    res.json({ hotWash: algorithmicFallback(), provider: 'algorithmic' });
  }
});

// ─── AI Generation (stepped — one request per inject) ────────────────────────
//
// Instead of one giant 90-120s request the frontend makes three types of calls:
//   1. POST /generate/setup     → title, description, objectives, phase names (~10s)
//   2. POST /generate/inject    → one inject + options (~20-30s, called N times)
//   3. POST /generate/finalize  → persist to DB + create session (~1s)

const AI_TYPE_ENUM = ['RANSOMWARE', 'DATA_BREACH', 'INSIDER_THREAT', 'BEC', 'SUPPLY_CHAIN', 'DDoS', 'APT', 'CUSTOM'] as const;
const AI_DIFF_ENUM = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const;

// Step 1: generate scenario metadata (title, description, objectives, phase list)
router.post('/generate/setup', requireAuth, requireFacilitator, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    type: z.enum(AI_TYPE_ENUM),
    difficulty: z.enum(AI_DIFF_ENUM),
    rounds: z.number().int().min(2).max(10),
    orgName: z.string().optional().default(''),
    industry: z.string().optional().default(''),
    crownJewels: z.array(z.string()).optional().default([]),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const orgContext = await buildPromptOrgContext(req.user!.orgId, {
    orgName: parsed.data.orgName,
    industry: parsed.data.industry,
    crownJewels: parsed.data.crownJewels,
  });

  let setup: ScenarioSetup;
  try {
    setup = await generateScenarioSetup(
      parsed.data.type as AiScenarioType,
      parsed.data.difficulty as AiDifficulty,
      parsed.data.rounds,
      orgContext,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Setup generation failed';
    if (!res.headersSent) res.status(502).json({ error: msg });
    return;
  }

  if (!res.headersSent) res.json(setup);
});

// Step 1b: stream scenario setup via SSE — sends tokens then {done, setup}
router.post('/generate/setup/stream', requireAuth, requireFacilitator, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    type: z.enum(AI_TYPE_ENUM),
    difficulty: z.enum(AI_DIFF_ENUM),
    rounds: z.number().int().min(2).max(10),
    orgName: z.string().optional().default(''),
    industry: z.string().optional().default(''),
    crownJewels: z.array(z.string()).optional().default([]),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const orgContext = await buildPromptOrgContext(req.user!.orgId, {
    orgName: parsed.data.orgName,
    industry: parsed.data.industry,
    crownJewels: parsed.data.crownJewels,
  });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (payload: object) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const setup = await streamScenarioSetup(
      parsed.data.type as AiScenarioType,
      parsed.data.difficulty as AiDifficulty,
      parsed.data.rounds,
      orgContext,
      (token: string) => send({ t: token }),
    );
    send({ done: true, setup });
  } catch (err: unknown) {
    send({ error: err instanceof Error ? err.message : 'Setup generation failed' });
  } finally {
    if (!res.writableEnded) res.end();
  }
});

// Shared inject context schema — narrative is optional to stay backwards-compatible
const injectContextSchema = z.object({
  phase: z.string(),
  title: z.string(),
  narrative: z.string().optional().default(''),
});

// Step 2a: generate one inject (non-streaming, kept for compatibility)
router.post('/generate/inject', requireAuth, requireFacilitator, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    type: z.enum(AI_TYPE_ENUM),
    difficulty: z.enum(AI_DIFF_ENUM),
    rounds: z.number().int().min(2).max(10),
    injectIndex: z.number().int().min(0).max(9),
    phase: z.string().min(1).max(100),
    scenarioSetup: z.object({ title: z.string(), description: z.string() }),
    previousInjects: z.array(injectContextSchema).optional().default([]),
    orgName: z.string().optional().default(''),
    industry: z.string().optional().default(''),
    crownJewels: z.array(z.string()).optional().default([]),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { type, difficulty, rounds, injectIndex, phase, scenarioSetup, previousInjects } = parsed.data;
  const orgContext = await buildPromptOrgContext(req.user!.orgId, {
    orgName: parsed.data.orgName,
    industry: parsed.data.industry,
    crownJewels: parsed.data.crownJewels,
  });

  let inject;
  try {
    inject = await generateSingleInject(
      type as AiScenarioType,
      difficulty as AiDifficulty,
      rounds,
      injectIndex,
      phase,
      scenarioSetup,
      previousInjects as InjectContext[],
      orgContext,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Inject generation failed';
    if (!res.headersSent) res.status(502).json({ error: msg });
    return;
  }

  if (!res.headersSent) res.json(inject);
});

// Step 2b: stream one inject via SSE — sends raw tokens then a final {done,inject} event
router.post('/generate/inject/stream', requireAuth, requireFacilitator, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    type: z.enum(AI_TYPE_ENUM),
    difficulty: z.enum(AI_DIFF_ENUM),
    rounds: z.number().int().min(2).max(10),
    injectIndex: z.number().int().min(0).max(9),
    phase: z.string().min(1).max(100),
    scenarioSetup: z.object({ title: z.string(), description: z.string() }),
    previousInjects: z.array(injectContextSchema).optional().default([]),
    orgName: z.string().optional().default(''),
    industry: z.string().optional().default(''),
    crownJewels: z.array(z.string()).optional().default([]),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { type, difficulty, rounds, injectIndex, phase, scenarioSetup, previousInjects } = parsed.data;
  const orgContext = await buildPromptOrgContext(req.user!.orgId, {
    orgName: parsed.data.orgName,
    industry: parsed.data.industry,
    crownJewels: parsed.data.crownJewels,
  });

  // SSE headers — tell nginx not to buffer this response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (payload: object) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const inject = await streamSingleInject(
      type as AiScenarioType,
      difficulty as AiDifficulty,
      rounds,
      injectIndex,
      phase,
      scenarioSetup,
      previousInjects as InjectContext[],
      (token: string) => send({ t: token }),
      orgContext,
    );
    send({ done: true, inject });
  } catch (err: unknown) {
    send({ error: err instanceof Error ? err.message : 'Inject generation failed' });
  } finally {
    if (!res.writableEnded) res.end();
  }
});

// Step 3: persist everything to DB and create the game session
router.post('/generate/finalize', requireAuth, requireFacilitator, async (req: AuthRequest, res: Response) => {
  const optionSchema = z.object({
    text: z.string(),
    scoreWeight: z.number(),
    isOptimal: z.boolean(),
    scriptedFeedback: z.string(),
    feedbackTags: z.array(z.string()),
    consequences: z.string().nullable().optional(),
  });
  const injectSchema = z.object({
    phaseOrder: z.number(),
    injectOrder: z.number(),
    phase: z.string(),
    title: z.string(),
    narrative: z.string(),
    mitreAttackId: z.string().nullable().optional(),
    mitreAttackName: z.string().nullable().optional(),
    nistCsfFunction: z.string().nullable().optional(),
    options: z.array(optionSchema).min(2),
  });
  const schema = z.object({
    type: z.enum(AI_TYPE_ENUM),
    difficulty: z.enum(AI_DIFF_ENUM),
    orgName: z.string().optional().default(''),
    industry: z.string().optional().default(''),
    crownJewels: z.array(z.string()).optional().default([]),
    settings: z
      .object({
        speedBonusEnabled: z.boolean().optional(),
        speedBonusMax: z.number().min(0).max(100).optional(),
        speedBonusDecaySeconds: z.number().min(10).max(300).optional(),
        timerEnabled: z.boolean().optional(),
        showLeaderboard: z.boolean().optional(),
        showFeedbackImmediately: z.boolean().optional(),
      })
      .optional(),
    scenarioSetup: z.object({
      title: z.string(),
      description: z.string(),
      objectives: z.array(z.string()),
    }),
    injects: z.array(injectSchema).min(1),
    sessionName: z.string().max(100).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { type, difficulty, settings, scenarioSetup, injects } = parsed.data;

  const scenario = await prisma.scenario.create({
    data: {
      title: scenarioSetup.title,
      description: scenarioSetup.description,
      type: type as any,
      difficulty: difficulty as any,
      objectives: scenarioSetup.objectives,
      isPublic: false,
      isBuiltIn: false,
      createdById: req.user!.id,
      orgId: req.user!.orgId ?? null,
      injects: {
        create: injects.map((inj) => ({
          phase: inj.phase,
          phaseOrder: inj.phaseOrder,
          injectOrder: inj.injectOrder,
          title: inj.title,
          narrative: inj.narrative,
          roleVisibility: [] as string[],
          mitreAttackId: inj.mitreAttackId ?? null,
          mitreAttackName: inj.mitreAttackName ?? null,
          nistCsfFunction: inj.nistCsfFunction ?? null,
          options: {
            create: inj.options.map((opt) => ({
              text: opt.text,
              scoreWeight: opt.scoreWeight,
              isOptimal: opt.isOptimal,
              scriptedFeedback: opt.scriptedFeedback,
              feedbackTags: opt.feedbackTags,
              consequences: opt.consequences ?? null,
            })),
          },
        })),
      },
    },
  });

  const session = await createSession({
    scenarioId: scenario.id,
    facilitatorId: req.user!.id,
    orgId: req.user!.orgId ?? undefined,
    settings: {
      ...settings,
      preloadFacilitatorScript: true,
      sessionSource: 'AI_GENERATED',
    },
  });

  const mergedOnboardingAnswers = await buildMergedAiContext(req.user!.orgId, {
    orgName: parsed.data.orgName || undefined,
    industry: parsed.data.industry || undefined,
    crownJewels: parsed.data.crownJewels,
  });

  await prisma.session.update({
    where: { id: session.id },
    data: {
      onboardingAnswers: mergedOnboardingAnswers as Prisma.InputJsonValue,
    },
  });

  if (parsed.data.sessionName?.trim()) {
    await prisma.session.update({
      where: { id: session.id },
      data: { name: parsed.data.sessionName.trim() },
    });
  }

  await audit({
    userId: req.user!.id,
    action: 'SCENARIO_CREATED',
    resource: scenario.id,
    metadata: { aiGenerated: true, type, difficulty, rounds: injects.length },
  });

  await audit({
    userId: req.user!.id,
    action: 'SESSION_CREATED',
    resource: session.id,
    metadata: { scenarioId: scenario.id, aiGenerated: true },
  });

  res.status(201).json({
    session: { id: session.id, joinCode: session.joinCode },
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
  });
});

// DELETE /api/sessions/:id - delete a session (facilitator who owns it, or admin)
router.delete('/:id', requireAuth, requireFacilitator, async (req: AuthRequest, res: Response) => {
  const session = await prisma.session.findUnique({
    where: { id: req.params.id },
    select: { id: true, facilitatorId: true, status: true },
  });

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const isAdmin = req.user!.role === 'SUPER_ADMIN' || req.user!.role === 'ORG_ADMIN';
  if (session.facilitatorId !== req.user!.id && !isAdmin) {
    res.status(403).json({ error: 'Cannot delete this session' });
    return;
  }

  // Manually delete child records in dependency order (Decision has no DB-level cascade)
  await prisma.$transaction([
    prisma.decision.deleteMany({ where: { sessionId: req.params.id } }),
    prisma.sessionPlayer.deleteMany({ where: { sessionId: req.params.id } }),
    prisma.session.delete({ where: { id: req.params.id } }),
  ]);

  await audit({
    userId: req.user!.id,
    action: 'SESSION_ENDED',
    resource: req.params.id,
    metadata: { action: 'deleted' },
  });

  res.json({ ok: true });
});

// ─── AI-Driven Session Endpoints ─────────────────────────────────────────────

// POST /api/sessions/:id/onboarding — facilitator saves org/context answers
router.post('/:id/onboarding', requireAuth, requireFacilitator, async (req: AuthRequest, res: Response) => {
  const session = await prisma.session.findUnique({
    where: { id: req.params.id },
    select: { facilitatorId: true, orgId: true },
  });
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  if (!canManageSession(req.user!, session)) {
    res.status(403).json({ error: 'Only the facilitator can save onboarding data' }); return;
  }

  const schema = z.object({
    orgName: z.string().max(200).optional(),
    industry: z.string().max(100).optional(),
    orgSize: z.string().max(100).optional(),
    maturity: z.number().min(1).max(5).optional(),
    compliance: z.array(z.string()).optional(),
    crownJewels: z.union([z.string().max(500), z.array(z.string())]).optional(),
    focusArea: z.string().max(200).optional(),
    experience: z.string().max(100).optional(),
    recentIncident: z.string().max(500).optional(),
    primaryThreat: z.string().max(200).optional(),
    rolesPresent: z.array(z.string()).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  await prisma.session.update({
    where: { id: req.params.id },
    data: { onboardingAnswers: parsed.data },
  });

  res.json({ ok: true });
});

// PUT /api/sessions/:id/player-onboarding — player saves their own profile
router.put('/:id/player-onboarding', requireAuth, async (req: AuthRequest, res: Response) => {
  const session = await prisma.session.findUnique({
    where: { id: req.params.id },
    select: { id: true, playerOnboarding: true },
  });
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  if (!session.playerOnboarding) {
    res.status(400).json({ error: 'Player onboarding is not enabled for this session' }); return;
  }

  const schema = z.object({
    experience: z.string().max(100).optional(),
    learningGoal: z.string().max(200).optional(),
    topConcern: z.string().max(300).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed' }); return;
  }

  const updated = await prisma.sessionPlayer.updateMany({
    where: { sessionId: req.params.id, userId: req.user!.id },
    data: { profileAnswers: parsed.data },
  });
  if (updated.count === 0) {
    res.status(403).json({ error: 'Join this session before saving onboarding responses' });
    return;
  }

  res.json({ ok: true });
});

// POST /api/sessions/:id/ai-debrief — trigger AI debrief narrative generation
router.post('/:id/ai-debrief', requireAuth, requireFacilitator, async (req: AuthRequest, res: Response) => {
  const session = await prisma.session.findUnique({
    where: { id: req.params.id },
    select: { facilitatorId: true, orgId: true, status: true },
  });
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  if (!canManageSession(req.user!, session)) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  if (session.status === 'LOBBY' || session.status === 'ACTIVE') {
    res.status(400).json({ error: 'Session must be in DEBRIEF or COMPLETE status' }); return;
  }

  // Trigger generation via the adaptive-inject service
  const { generateAIDebrief } = await import('../services/ai/adaptive-inject');
  const data = await getSessionDebriefData(req.params.id);
  if (!data) { res.status(404).json({ error: 'Session data not found' }); return; }

  const fnGroups = new Map<string, number[]>();
  for (const d of data.decisions) {
    const fn = d.inject.nistCsfFunction;
    if (fn) {
      if (!fnGroups.has(fn)) fnGroups.set(fn, []);
      fnGroups.get(fn)!.push(d.score);
    }
  }
  const nistGaps = [...fnGroups.entries()].map(([fn, scores]) => {
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    return {
      function: fn,
      avgScore: avg,
      strength: avg >= 75 ? 'strong' : avg >= 50 ? 'adequate' : avg >= 25 ? 'gap' : 'critical-gap',
    };
  });

  const participants = data.players.map(p => {
    const pDecisions = data.decisions.filter(d => d.playerId === p.userId);
    return {
      displayName: p.user.displayName,
      assignedRole: p.assignedRole,
      totalScore: p.totalScore,
      optimalCount: pDecisions.filter(d => d.option.isOptimal).length,
      decisionCount: pDecisions.length,
    };
  });

  const injectMap = new Map<string, { title: string; phase: string; decisions: typeof data.decisions }>();
  for (const d of data.decisions) {
    if (!injectMap.has(d.injectId)) injectMap.set(d.injectId, { title: d.inject.title, phase: d.inject.phase, decisions: [] });
    injectMap.get(d.injectId)!.decisions.push(d);
  }
  const history = [...injectMap.values()].map((entry, idx) => ({
    roundNumber: idx + 1,
    injectTitle: entry.title,
    narrative: '',
    phase: entry.phase,
    avgScore: Math.round(entry.decisions.reduce((s, d) => s + d.score, 0) / entry.decisions.length),
    decisions: [],
  }));

  const optimalRate = data.decisions.length
    ? (data.decisions.filter(d => d.option.isOptimal).length / data.decisions.length) * 100
    : 0;
  const durationMinutes = data.startedAt && data.endedAt
    ? Math.round((data.endedAt.getTime() - data.startedAt.getTime()) / 60000)
    : 0;

  try {
    const aiDebriefText = await generateAIDebrief({
      scenarioType: data.scenario.type,
      scenarioTitle: data.scenario.title,
      onboardingAnswers: await buildMergedAiContext(
        (data as any).orgId ?? null,
        ((data as any).onboardingAnswers ?? {}) as Record<string, unknown>,
      ),
      history,
      nistGaps,
      participants,
      overallOptimalRate: optimalRate,
      sessionDurationMinutes: durationMinutes,
    });

    await prisma.session.update({
      where: { id: req.params.id },
      data: { aiDebriefText },
    });

    res.json({ aiDebriefText });
  } catch (err) {
    res.status(500).json({ error: 'AI debrief generation failed' });
  }
});

// ─── POST /api/sessions/:id/facilitator-script/preload ─────────────────────────
// Preloads the full opening + per-round facilitator script for fixed AI-generated sessions.
router.post('/:id/facilitator-script/preload', requireAuth, requireFacilitator, async (req: AuthRequest, res: Response) => {
  const session = await prisma.session.findUnique({
    where: { id: req.params.id },
    select: {
      facilitatorId: true,
      settings: true,
      scenario: { select: { mode: true } },
    },
  });

  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  if (session.facilitatorId !== req.user!.id) { res.status(403).json({ error: 'Forbidden' }); return; }

  const settings = (session.settings ?? {}) as { preloadFacilitatorScript?: boolean };
  if (session.scenario.mode === 'AI_DRIVEN' || settings.preloadFacilitatorScript !== true) {
    res.status(400).json({ error: 'Facilitator script preloading is only enabled for AI-generated scripted sessions' });
    return;
  }

  try {
    void startFacilitatorScriptPreload(req.params.id);
    const current = await getFacilitatorScript(req.params.id);
    res.json(current);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Script preload failed: ${msg}` });
  }
});

// ─── GET /api/sessions/:id/facilitator-script ─────────────────────────────────
router.get('/:id/facilitator-script', requireAuth, requireFacilitator, async (req: AuthRequest, res: Response) => {
  const session = await prisma.session.findUnique({
    where: { id: req.params.id },
    select: { facilitatorId: true, facilitatorScript: true },
  });
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  if (session.facilitatorId !== req.user!.id) { res.status(403).json({ error: 'Forbidden' }); return; }
  res.json(normalizeFacilitatorScript(session.facilitatorScript));
});

// ─── POST /api/sessions/:id/facilitator-script/generate ───────────────────────
// Body: { section: 'opening' | 'round-intro' | 'round' | 'closing', roundNumber?: number,
//         injectTitle?: string, injectNarrative?: string, injectPhase?: string }
router.post('/:id/facilitator-script/generate', requireAuth, requireFacilitator, async (req: AuthRequest, res: Response) => {
  const { section, roundNumber, injectTitle, injectNarrative, injectPhase, injectId } = req.body as {
    section: string; roundNumber?: number;
    injectTitle?: string; injectNarrative?: string; injectPhase?: string;
    injectId?: string;
  };

  // Use getSessionDebriefData for the fully typed, consistent include pattern
  const session = await getSessionDebriefData(req.params.id);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  if (session.facilitatorId !== req.user!.id) { res.status(403).json({ error: 'Forbidden' }); return; }

  const onboarding = (session.onboardingAnswers ?? {}) as Record<string, unknown>;
  const orgName = (onboarding.orgName as string | undefined) ?? undefined;
  const industry = (onboarding.industry as string | undefined) ?? undefined;

  // Existing script blob to merge updates into
  const existing = (session.facilitatorScript ?? { opening: null, roundIntros: {}, rounds: {}, closing: null }) as {
    opening: string | null;
    roundIntros: Record<string, string>;
    rounds: Record<string, string>;
    closing: string | null;
  };
  if (!existing.roundIntros) existing.roundIntros = {};
  if (!existing.rounds) existing.rounds = {};

  try {
    let generated = '';

    if (section === 'opening') {
      generated = await generateOpeningScript({
        scenarioTitle: session.scenario.title,
        scenarioType: session.scenario.type ?? 'Cybersecurity Incident',
        difficulty: session.scenario.difficulty ?? 'INTERMEDIATE',
        description: session.scenario.description ?? '',
        objectives: (session.scenario.objectives as string[] | undefined) ?? [],
        orgName,
        industry,
        rolesList: session.players.map(p => p.assignedRole).filter(Boolean),
        totalRounds: session.totalRounds,
      });
      existing.opening = generated;

    } else if (section === 'round-intro' && roundNumber != null) {
      if (!injectTitle || !injectNarrative || !injectPhase) {
        res.status(400).json({ error: 'round-intro requires injectTitle, injectNarrative, injectPhase' }); return;
      }
      generated = await generateRoundIntroScript({
        roundNumber,
        totalRounds: session.totalRounds,
        injectTitle,
        narrative: injectNarrative,
        phase: injectPhase,
        rolesList: session.players.map(p => p.assignedRole).filter(Boolean),
        scenarioTitle: session.scenario.title,
        scenarioType: session.scenario.type ?? 'Cybersecurity Incident',
      });
      existing.roundIntros = { ...existing.roundIntros, [String(roundNumber)]: generated };

    } else if (section === 'round' && roundNumber != null) {
      // Strategy 1: direct injectId lookup (AI-driven sessions pass this explicitly)
      let roundDecisions = injectId
        ? session.decisions.filter(d => d.injectId === injectId)
        : [];

      // Strategy 2: phaseOrder-based mapping (scripted sessions — injects have sequential phaseOrders)
      if (!roundDecisions.length) {
        const phaseOrders = [...new Set(session.decisions.map(d => d.inject.phaseOrder))].sort((a, b) => a - b);
        const targetPhaseOrder = phaseOrders[roundNumber - 1];
        if (targetPhaseOrder !== undefined) {
          roundDecisions = session.decisions.filter(d => d.inject.phaseOrder === targetPhaseOrder);
        }
      }

      // Strategy 3: temporal ordering — for AI-driven sessions where strategies 1 & 2 fail.
      // Group decisions by the order each unique inject first appeared (decisions are already
      // ordered by timestamp in getSessionDebriefData). Round N = decisions for the Nth unique inject.
      if (!roundDecisions.length) {
        const seen = new Set<string>();
        const orderedInjectIds: string[] = [];
        for (const d of session.decisions) {
          if (!seen.has(d.injectId)) {
            seen.add(d.injectId);
            orderedInjectIds.push(d.injectId);
          }
        }
        const targetInjectId = orderedInjectIds[roundNumber - 1];
        if (targetInjectId) {
          roundDecisions = session.decisions.filter(d => d.injectId === targetInjectId);
        }
      }

      const roleByUserId = new Map(session.players.map(p => [p.userId, p.assignedRole]));

      if (roundDecisions.length > 0) {
        // Normal path — generate with full decision data
        const inject = roundDecisions[0].inject;
        const optimalDecision = roundDecisions.find(d => d.option.isOptimal);

        generated = await generateRoundScript({
          roundNumber,
          totalRounds: session.totalRounds,
          injectTitle: inject.title,
          narrative: inject.narrative,
          phase: inject.phase,
          decisions: roundDecisions.map(d => ({
            playerName: d.player.displayName,
            role: roleByUserId.get(d.playerId) ?? 'Participant',
            chosenOption: d.option.text,
            score: d.score,
            isOptimal: d.option.isOptimal,
          })),
          optimalOption: optimalDecision?.option.text ?? roundDecisions[0].option.text,
          optimalFeedback: optimalDecision?.option.scriptedFeedback ?? '',
          isLastRound: session.totalRounds > 0 && roundNumber >= session.totalRounds,
          scenarioTitle: session.scenario.title,
        });
      } else if (injectTitle && injectNarrative && injectPhase) {
        // Fallback — generate from inject info only (decisions not yet available or session just started)
        generated = await generateRoundScript({
          roundNumber,
          totalRounds: session.totalRounds,
          injectTitle,
          narrative: injectNarrative,
          phase: injectPhase,
          decisions: [],
          optimalOption: '',
          optimalFeedback: '',
          isLastRound: session.totalRounds > 0 && roundNumber >= session.totalRounds,
          scenarioTitle: session.scenario.title,
        });
      } else {
        res.status(400).json({ error: `No decisions or inject data available for round ${roundNumber}` }); return;
      }
      existing.rounds = { ...existing.rounds, [String(roundNumber)]: generated };

    } else if (section === 'closing') {
      const phaseOrders = [...new Set(session.decisions.map(d => d.inject.phaseOrder))].sort((a, b) => a - b);
      const rounds = phaseOrders.map((phaseOrder, idx) => {
        const decs = session.decisions.filter(d => d.inject.phaseOrder === phaseOrder);
        const inj = decs[0]?.inject;
        const avg = decs.length ? Math.round(decs.reduce((s, d) => s + d.score, 0) / decs.length) : 0;
        return { roundNumber: idx + 1, injectTitle: inj?.title ?? '', phase: inj?.phase ?? '', avgScore: avg };
      });
      const allScores = session.decisions.map(d => d.score);
      const overallAvg = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
      const topPerformers = [...session.players].sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);

      generated = await generateClosingScript({
        scenarioTitle: session.scenario.title,
        scenarioType: session.scenario.type ?? 'Cybersecurity Incident',
        orgName,
        industry,
        rounds,
        overallAvgScore: overallAvg,
        topPerformers: topPerformers.map(p => ({ name: p.user.displayName, role: p.assignedRole })),
        totalParticipants: session.players.length,
      });
      existing.closing = generated;

    } else {
      res.status(400).json({ error: 'Invalid section. Use: opening, round-intro, round, closing' }); return;
    }

    // Re-read the current script immediately before writing so concurrent generate
    // calls (intro + after-action firing together) don't overwrite each other's section.
    const latestRaw = await prisma.session.findUnique({
      where: { id: req.params.id },
      select: { facilitatorScript: true },
    });
    const latest = (latestRaw?.facilitatorScript ?? { opening: null, roundIntros: {}, rounds: {}, closing: null }) as typeof existing;
    if (!latest.roundIntros) latest.roundIntros = {};
    if (!latest.rounds) latest.rounds = {};
    // Merge only the section we just generated into the freshest DB state
    const merged = {
      ...latest,
      opening:     section === 'opening'    ? generated : (latest.opening ?? existing.opening),
      roundIntros: section === 'round-intro' && roundNumber != null
        ? { ...latest.roundIntros, [String(roundNumber)]: generated }
        : latest.roundIntros,
      rounds: section === 'round' && roundNumber != null
        ? { ...latest.rounds, [String(roundNumber)]: generated }
        : latest.rounds,
      closing: section === 'closing' ? generated : (latest.closing ?? existing.closing),
    };

    await prisma.session.update({
      where: { id: req.params.id },
      data: { facilitatorScript: merged as object },
    });

    res.json({ script: generated, full: merged });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Script generation failed: ${msg}` });
  }
});

export default router;
