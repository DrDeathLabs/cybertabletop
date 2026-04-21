import { prisma } from './db';
import { logger } from './logger';
import { buildMergedAiContext } from './org-config';
import {
  generateOpeningScript,
  generatePreSessionClosingScript,
  generateRoundIntroScript,
  generateRoundScript,
} from './ai/generate-script';

export type FacilitatorScriptData = {
  opening: string | null;
  roundIntros: Record<string, string>;
  rounds: Record<string, string>;
  closing: string | null;
};

type PreloadContext = {
  orgId: string | null;
  onboardingAnswers: Record<string, unknown>;
  facilitatorScript: FacilitatorScriptData;
  scenario: {
    title: string;
    type: string | null;
    difficulty: string | null;
    description: string | null;
    objectives: string[];
    injects: Array<{
      title: string;
      narrative: string;
      phase: string;
      phaseOrder: number;
      injectOrder: number;
    }>;
  };
  players: Array<{ assignedRole: string }>;
};

const preloadJobs = new Map<string, Promise<void>>();

export function normalizeFacilitatorScript(raw: unknown): FacilitatorScriptData {
  const data = (raw ?? {}) as Record<string, unknown>;

  return {
    opening: typeof data.opening === 'string' ? data.opening : null,
    roundIntros: (data.roundIntros as Record<string, string> | undefined) ?? {},
    rounds: (data.rounds as Record<string, string> | undefined) ?? {},
    closing: typeof data.closing === 'string' ? data.closing : null,
  };
}

export function hasCompleteFacilitatorScript(script: FacilitatorScriptData, totalRounds: number): boolean {
  if (!script.opening || !script.closing) return false;
  if (totalRounds <= 0) return true;

  return Object.keys(script.roundIntros).length >= totalRounds
    && Object.keys(script.rounds).length >= totalRounds;
}

async function loadPreloadContext(sessionId: string): Promise<PreloadContext> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      onboardingAnswers: true,
      orgId: true,
      facilitatorScript: true,
      scenario: {
        select: {
          title: true,
          type: true,
          difficulty: true,
          description: true,
          objectives: true,
          injects: {
            select: {
              title: true,
              narrative: true,
              phase: true,
              phaseOrder: true,
              injectOrder: true,
            },
            orderBy: [{ phaseOrder: 'asc' }, { injectOrder: 'asc' }],
          },
        },
      },
      players: {
        select: { assignedRole: true },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });

  if (!session) throw new Error('Session not found');

  return {
    orgId: session.orgId,
    onboardingAnswers: (session.onboardingAnswers ?? {}) as Record<string, unknown>,
    facilitatorScript: normalizeFacilitatorScript(session.facilitatorScript),
    scenario: {
      title: session.scenario.title,
      type: session.scenario.type ?? null,
      difficulty: session.scenario.difficulty ?? null,
      description: session.scenario.description ?? null,
      objectives: ((session.scenario.objectives as string[] | undefined) ?? []).filter(Boolean),
      injects: session.scenario.injects.map((inject) => ({
        title: inject.title,
        narrative: inject.narrative,
        phase: inject.phase,
        phaseOrder: inject.phaseOrder,
        injectOrder: inject.injectOrder,
      })),
    },
    players: session.players.map((player) => ({ assignedRole: player.assignedRole })),
  };
}

async function mergeAndSaveScript(
  sessionId: string,
  update: Partial<FacilitatorScriptData>,
): Promise<FacilitatorScriptData> {
  const latest = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { facilitatorScript: true },
  });

  const merged: FacilitatorScriptData = {
    ...normalizeFacilitatorScript(latest?.facilitatorScript),
    opening: update.opening !== undefined ? update.opening : normalizeFacilitatorScript(latest?.facilitatorScript).opening,
    roundIntros: {
      ...normalizeFacilitatorScript(latest?.facilitatorScript).roundIntros,
      ...(update.roundIntros ?? {}),
    },
    rounds: {
      ...normalizeFacilitatorScript(latest?.facilitatorScript).rounds,
      ...(update.rounds ?? {}),
    },
    closing: update.closing !== undefined ? update.closing : normalizeFacilitatorScript(latest?.facilitatorScript).closing,
  };

  await prisma.session.update({
    where: { id: sessionId },
    data: { facilitatorScript: merged as object },
  });

  return merged;
}

export async function getFacilitatorScript(sessionId: string): Promise<FacilitatorScriptData> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { facilitatorScript: true },
  });

  return normalizeFacilitatorScript(session?.facilitatorScript);
}

async function preloadFacilitatorScript(sessionId: string): Promise<void> {
  const context = await loadPreloadContext(sessionId);
  const totalRounds = context.scenario.injects.length;
  const mergedContext = await buildMergedAiContext(context.orgId, context.onboardingAnswers);
  const playerRoles = context.players.map((player) => player.assignedRole).filter(Boolean);
  const configuredRoles = Array.isArray(mergedContext.rolesPresent)
    ? mergedContext.rolesPresent.filter((role): role is string => typeof role === 'string' && role.trim().length > 0)
    : [];
  const rolesList = playerRoles.length ? playerRoles : configuredRoles;
  const orgName = typeof mergedContext.orgName === 'string' ? mergedContext.orgName : undefined;
  const industry = typeof mergedContext.industry === 'string' ? mergedContext.industry : undefined;

  let current = context.facilitatorScript;

  if (!current.opening) {
    const opening = await generateOpeningScript({
      scenarioTitle: context.scenario.title,
      scenarioType: context.scenario.type ?? 'Cybersecurity Incident',
      difficulty: context.scenario.difficulty ?? 'INTERMEDIATE',
      description: context.scenario.description ?? '',
      objectives: context.scenario.objectives,
      orgName,
      industry,
      rolesList,
      totalRounds,
    });
    current = await mergeAndSaveScript(sessionId, { opening });
  }

  for (const [index, inject] of context.scenario.injects.entries()) {
    const roundNumber = index + 1;
    const key = String(roundNumber);

    if (!current.roundIntros[key]) {
      const roundIntro = await generateRoundIntroScript({
        roundNumber,
        totalRounds,
        injectTitle: inject.title,
        narrative: inject.narrative,
        phase: inject.phase,
        rolesList,
        scenarioTitle: context.scenario.title,
        scenarioType: context.scenario.type ?? 'Cybersecurity Incident',
      });
      current = await mergeAndSaveScript(sessionId, {
        roundIntros: { [key]: roundIntro },
      });
    }

    if (!current.rounds[key]) {
      const roundScript = await generateRoundScript({
        roundNumber,
        totalRounds,
        injectTitle: inject.title,
        narrative: inject.narrative,
        phase: inject.phase,
        decisions: [],
        optimalOption: '',
        optimalFeedback: '',
        isLastRound: totalRounds > 0 && roundNumber >= totalRounds,
        scenarioTitle: context.scenario.title,
      });
      current = await mergeAndSaveScript(sessionId, {
        rounds: { [key]: roundScript },
      });
    }
  }

  if (!current.closing) {
    const closing = await generatePreSessionClosingScript({
      scenarioTitle: context.scenario.title,
      scenarioType: context.scenario.type ?? 'Cybersecurity Incident',
      orgName,
      industry,
      totalRounds,
      phases: context.scenario.injects.map((inject) => inject.phase),
      objectives: context.scenario.objectives,
    });
    await mergeAndSaveScript(sessionId, { closing });
  }
}

export function startFacilitatorScriptPreload(sessionId: string): Promise<void> {
  const existing = preloadJobs.get(sessionId);
  if (existing) return existing;

  const job = preloadFacilitatorScript(sessionId)
    .catch((error) => {
      logger.error('Facilitator script background preload failed', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    })
    .finally(() => {
      preloadJobs.delete(sessionId);
    });

  preloadJobs.set(sessionId, job);
  return job;
}
