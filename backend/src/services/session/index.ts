import { customAlphabet } from 'nanoid';
import { prisma } from '../db';
import { logger } from '../logger';
import { extractStoredFacilitatorScript, extractStoredOrgContext } from '../../data/library-scenarios';

// 6-character alphanumeric join code (uppercase, no confusing chars)
const generateJoinCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

export interface CreateSessionParams {
  scenarioId: string;
  facilitatorId: string;
  orgId?: string;
  settings?: {
    speedBonusEnabled?: boolean;
    speedBonusMax?: number;
    speedBonusDecaySeconds?: number;
    timerEnabled?: boolean;
    showLeaderboard?: boolean;
    showFeedbackImmediately?: boolean;
    preloadFacilitatorScript?: boolean;
    sessionSource?: string;
  };
}

export async function createSession(params: CreateSessionParams) {
  // Generate unique join code
  let joinCode: string;
  let attempts = 0;
  do {
    joinCode = generateJoinCode();
    const existing = await prisma.session.findUnique({ where: { joinCode } });
    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  const defaultSettings = {
    speedBonusEnabled: false,
    speedBonusMax: 25,
    speedBonusDecaySeconds: 60,
    timerEnabled: false,
    showLeaderboard: true,
    showFeedbackImmediately: true,
    ...params.settings,
  };

  const scenario = await prisma.scenario.findUnique({
    where: { id: params.scenarioId },
    select: {
      onboardingSchema: true,
      injects: { select: { id: true } },
    },
  });

  if (!scenario) {
    throw new Error(`Scenario ${params.scenarioId} not found`);
  }

  const storedScript = extractStoredFacilitatorScript(scenario.onboardingSchema);
  const storedOrgContext = extractStoredOrgContext(scenario.onboardingSchema);

  const session = await prisma.session.create({
    data: {
      scenarioId: params.scenarioId,
      facilitatorId: params.facilitatorId,
      orgId: params.orgId,
      joinCode: joinCode!,
      status: 'LOBBY',
      settings: defaultSettings,
      totalRounds: scenario.injects.length,
      facilitatorScript: storedScript ? (storedScript as object) : undefined,
      onboardingAnswers: storedOrgContext ? {
        orgName: storedOrgContext.orgName,
        industry: storedOrgContext.industry,
        crownJewels: storedOrgContext.crownJewels,
        rolesPresent: storedOrgContext.rolesPresent,
      } : undefined,
    },
    include: {
      scenario: { select: { id: true, title: true, type: true, difficulty: true } },
      facilitator: { select: { id: true, displayName: true, email: true } },
    },
  });

  logger.info('Session created', { sessionId: session.id, joinCode: session.joinCode });
  return session;
}

export async function getSessionWithPlayers(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      scenario: {
        include: {
          injects: {
            include: { options: true },
            orderBy: [{ phaseOrder: 'asc' }, { injectOrder: 'asc' }],
          },
        },
      },
      players: {
        include: {
          user: { select: { id: true, displayName: true, email: true } },
        },
      },
      facilitator: { select: { id: true, displayName: true } },
    },
  });

  if (!session) return null;

  // Manually resolve currentInject so clients joining mid-session see the active inject
  let currentInject = null;
  if (session.currentInjectId) {
    currentInject = await prisma.inject.findUnique({
      where: { id: session.currentInjectId },
      include: { options: true },
    });
  }

  return { ...session, currentInject };
}

export async function getSessionByJoinCode(joinCode: string) {
  return prisma.session.findUnique({
    where: { joinCode: joinCode.toUpperCase() },
    include: {
      scenario: { select: { id: true, title: true, type: true, difficulty: true } },
      players: {
        include: { user: { select: { id: true, displayName: true } } },
      },
    },
  });
}

export async function addPlayerToSession(
  sessionId: string,
  userId: string,
  assignedRole: string
) {
  return prisma.sessionPlayer.upsert({
    where: { sessionId_userId: { sessionId, userId } },
    create: { sessionId, userId, assignedRole },
    update: { assignedRole },
  });
}

export async function getSessionDebriefData(sessionId: string) {
  return prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      scenario: { select: { id: true, title: true, type: true, description: true, objectives: true, difficulty: true } },
      facilitator: { select: { id: true, displayName: true } },
      org: { select: { id: true, name: true } },
      players: {
        include: { user: { select: { id: true, displayName: true } } },
        orderBy: { totalScore: 'desc' },
      },
      decisions: {
        include: {
          inject: {
            select: {
              id: true,
              title: true,
              phase: true,
              narrative: true,
              nistCsfFunction: true,
              mitreAttackId: true,
              mitreAttackName: true,
              phaseOrder: true,
              injectOrder: true,
              options: {
                select: {
                  id: true,
                  text: true,
                  scoreWeight: true,
                  isOptimal: true,
                  scriptedFeedback: true,
                  feedbackTags: true,
                  consequences: true,
                },
              },
            },
          },
          option: {
            select: {
              id: true,
              text: true,
              scoreWeight: true,
              isOptimal: true,
              scriptedFeedback: true,
              feedbackTags: true,
              consequences: true,
            },
          },
          player: { select: { id: true, displayName: true } },
        },
        // Order so inject replays appear in scenario sequence
        orderBy: [
          { inject: { phaseOrder: 'asc' } },
          { inject: { injectOrder: 'asc' } },
          { timestamp: 'asc' },
        ],
      },
    },
  });
}
