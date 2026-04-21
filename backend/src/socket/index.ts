// Real-time game session management via Socket.io
// NIST SC-8: Transmission Confidentiality
// NIST AU-2: Audit Events

import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { Prisma } from '@prisma/client';
import { prisma } from '../services/db';
import { verifyAccessToken } from '../auth/tokens';
import { calculateScore } from '../services/scoring';
import { generateFeedback } from '../services/ai';
import { generateAdaptiveInject, generateNarrative, generateOptions, generateFeedback as generateOptionFeedback, cleanInject, generateAIDebrief, type GeneratedInject } from '../services/ai/adaptive-inject';
import { getAISettings } from '../services/ai-config';
import { logger } from '../services/logger';
import { audit } from '../services/audit';
import {
  startFacilitatorScriptPreload,
} from '../services/facilitator-script';
import { buildMergedAiContext } from '../services/org-config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userDisplayName?: string;
  userRole?: string;
  userOrgId?: string | null;
  sessionId?: string;
}

// Track active session state in memory (use Redis in production)
const sessionState = new Map<
  string,
  {
    currentInjectId: string | null;
    injectStartTime: number;
    decidedPlayerIds: Set<string>;
  }
>();

export function setupSocketIO(server: HTTPServer): void {
  const io = new Server(server, {
    cors: {
      origin: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 10000,
  });

  // JWT auth middleware for Socket.io
  io.use(async (socket: AuthenticatedSocket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.cookie?.match(/access_token=([^;]+)/)?.[1];

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = verifyAccessToken(token);
      socket.userId = payload.sub;
      socket.userRole = payload.role;
      socket.userOrgId = payload.orgId ?? null;

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { displayName: true },
      });
      socket.userDisplayName = user?.displayName || 'Unknown';
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info('Socket connected', { userId: socket.userId, socketId: socket.id });
    socket.onAny((event: string) => {
      logger.info('Socket event received', { event, userId: socket.userId, socketId: socket.id });
    });

    // ── Helper: join a session room ───────────────────────────────────────
    async function joinSessionRoom(sessionId: string) {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          players: { select: { userId: true, assignedRole: true } },
        },
      });

      if (!session || session.status === 'COMPLETE') {
        socket.emit('error', { message: session ? 'Session has ended' : 'Session not found' });
        return;
      }

      const isFacilitator = session.facilitatorId === socket.userId;
      const isOrgAdmin =
        socket.userRole === 'ORG_ADMIN'
        && !!socket.userOrgId
        && session.orgId === socket.userOrgId;
      const isSuperAdmin = socket.userRole === 'SUPER_ADMIN';
      const participant = session.players.find((p) => p.userId === socket.userId);

      if (!isFacilitator && !isOrgAdmin && !isSuperAdmin && !participant) {
        socket.emit('error', { message: 'Not authorized for this session' });
        return;
      }

      socket.join(`session:${sessionId}`);
      socket.sessionId = sessionId;
      // Facilitators also join a private room so preview/stage events survive socket reconnects
      if (isFacilitator || isOrgAdmin || isSuperAdmin) {
        socket.join(`facilitator:${sessionId}`);
      }

      if (participant && socket.userId) {
        await prisma.sessionPlayer.updateMany({
          where: { sessionId, userId: socket.userId },
          data: { isConnected: true },
        });

        socket.to(`session:${sessionId}`).emit('session:player-connected', {
          userId: socket.userId,
          displayName: socket.userDisplayName,
          assignedRole: participant.assignedRole,
        });
      }

      // Send the active inject to the joining socket.
      // Check in-memory state first (preserves accurate startTime).
      // Fall back to DB currentInjectId so that a backend restart doesn't
      // leave late-joining players permanently stuck on the waiting screen.
      const state = sessionState.get(sessionId);
      const activeInjectId = state?.currentInjectId ?? session.currentInjectId;
      if (activeInjectId) {
        const inject = await prisma.inject.findUnique({
          where: { id: activeInjectId },
          include: { options: true },
        });
        if (inject) {
          socket.emit('session:inject-presented', {
            inject,
            startTime: state?.injectStartTime ?? Date.now(),
          });
          // Re-hydrate sessionState from DB so that subsequent joins
          // and player:submit-decision also work after a backend restart.
          if (!state) {
            sessionState.set(sessionId, {
              currentInjectId: activeInjectId,
              injectStartTime: Date.now(),
              decidedPlayerIds: new Set(),
            });
          }
        }
      }

      if (participant) {
        await audit({ userId: socket.userId, action: 'PLAYER_JOINED', resource: sessionId });
      }
    }

    // Accept all join variants from frontend
    socket.on('session:join', ({ sessionId }: { sessionId: string }) => joinSessionRoom(sessionId));
    socket.on('player:join-game', ({ sessionId }: { sessionId: string }) => joinSessionRoom(sessionId));
    socket.on('facilitator:join-game', ({ sessionId }: { sessionId: string }) => joinSessionRoom(sessionId));
    socket.on('facilitator:join-lobby', ({ sessionId }: { sessionId: string }) => joinSessionRoom(sessionId));

    // ── FACILITATOR: Advance to next inject ────────────────────────────────
    socket.on('facilitator:next-inject', async ({ sessionId, injectId }: { sessionId: string; injectId: string }) => {
      const session = await prisma.session.findUnique({
        where: { id: sessionId, facilitatorId: socket.userId },
      });

      if (!session) {
        socket.emit('error', { message: 'Not authorized for this session' });
        return;
      }

      // Fetch full inject with options to broadcast to players
      const inject = await prisma.inject.findUnique({
        where: { id: injectId },
        include: { options: true },
      });

      if (!inject) {
        socket.emit('error', { message: 'Inject not found' });
        return;
      }

      const now = Date.now();
      sessionState.set(sessionId, {
        currentInjectId: injectId,
        injectStartTime: now,
        decidedPlayerIds: new Set(),
      });

      await prisma.session.update({
        where: { id: sessionId },
        data: { currentInjectId: injectId, status: 'ACTIVE' },
      });

      // Emit full inject object so players can render options immediately
      io.to(`session:${sessionId}`).emit('session:inject-presented', {
        inject,
        startTime: now,
      });

      logger.info('Inject presented', { sessionId, injectId });
    });

    // ── FACILITATOR: Start session ─────────────────────────────────────────
    socket.on('facilitator:start-session', async ({ sessionId }: { sessionId: string }) => {
      const session = await prisma.session.findUnique({
        where: { id: sessionId, facilitatorId: socket.userId },
        select: {
          settings: true,
          scenario: {
            select: {
              mode: true,
            },
          },
        },
      });

      if (!session) {
        socket.emit('error', { message: 'Not authorized' });
        return;
      }

      const settings = (session.settings ?? {}) as { preloadFacilitatorScript?: boolean };
      const shouldPreload = session.scenario.mode !== 'AI_DRIVEN' && settings.preloadFacilitatorScript === true;

      try {
        await prisma.session.update({
          where: { id: sessionId },
          data: { status: 'ACTIVE', startedAt: new Date() },
        });
      } catch (err) {
        logger.error('Failed to start session', {
          sessionId,
          userId: socket.userId,
          error: err instanceof Error ? err.message : String(err),
        });
        socket.emit('session:start-failed', {
          message: 'The session could not be started. Please try again.',
        });
        return;
      }

      io.to(`session:${sessionId}`).emit('session:started', { sessionId });
      await audit({ userId: socket.userId, action: 'SESSION_STARTED', resource: sessionId });

      if (shouldPreload) {
        void startFacilitatorScriptPreload(sessionId);
      }
    });

    // ── FACILITATOR: Lock decisions & reveal ──────────────────────────────
    socket.on('facilitator:reveal', async ({ sessionId }: { sessionId: string }) => {
      // Use current active inject from session state
      const injectId = sessionState.get(sessionId)?.currentInjectId;
      if (!injectId) {
        socket.emit('error', { message: 'No active inject to reveal' });
        return;
      }

      const session = await prisma.session.findUnique({
        where: { id: sessionId, facilitatorId: socket.userId },
        include: { scenario: { select: { mode: true, type: true, title: true } } },
      });

      if (!session) {
        socket.emit('error', { message: 'Not authorized' });
        return;
      }

      const decisions = await prisma.decision.findMany({
        where: { sessionId, injectId },
        include: {
          option: true,
          player: { select: { id: true, displayName: true } },
        },
      });

      for (const decision of decisions) {
        await prisma.sessionPlayer.updateMany({
          where: { sessionId, userId: decision.playerId },
          data: {
            totalScore: { increment: decision.score + decision.speedBonus },
            learningScore: { increment: decision.score },
          },
        });
      }

      const optionCounts: Record<string, number> = {};
      for (const d of decisions) {
        optionCounts[d.optionId] = (optionCounts[d.optionId] || 0) + 1;
      }

      const updatedPlayers = await prisma.sessionPlayer.findMany({
        where: { sessionId },
        include: { user: { select: { id: true, displayName: true } } },
        orderBy: { totalScore: 'desc' },
      });

      // Check if this is the last round for an AI-driven session
      const totalRounds = session.totalRounds ?? 0;
      const completedRounds = await prisma.decision.findMany({
        where: { sessionId },
        select: { injectId: true },
        distinct: ['injectId'],
      });
      const isLastRound = totalRounds > 0 && completedRounds.length >= totalRounds;

      io.to(`session:${sessionId}`).emit('session:inject-revealed', {
        injectId,
        optionCounts,
        playerDecisions: decisions.map((d) => ({
          playerId: d.playerId,
          playerName: d.player.displayName,
          optionId: d.optionId,
          score: d.score,
          feedback: d.aiFeedback || d.option.scriptedFeedback,
          aiProvider: d.aiProvider,
        })),
        leaderboard: updatedPlayers.map((p, idx) => ({
          rank: idx + 1,
          userId: p.userId,
          displayName: p.user.displayName,
          role: p.assignedRole,
          totalScore: p.totalScore,
        })),
        isLastRound,
        totalRounds,
      });

      // NOTE: We intentionally do NOT auto-end AI-driven sessions here.
      // The frontend receives `isLastRound: true` in the reveal payload and surfaces
      // a confirmation dialog so the facilitator can review the closing script and
      // debrief with participants before navigating to the After Action Report.
      // Session teardown happens via the explicit `facilitator:end-session` event.
    });

    // ── PLAYER: Submit decision (accepts both event names) ────────────────
    async function handleDecision({
      sessionId,
      optionId,
      rationale,
    }: {
      sessionId: string;
      optionId: string;
      rationale?: string;
    }) {
      try {
        if (!socket.userId) return;

        const state = sessionState.get(sessionId);
        if (!state?.currentInjectId) {
          socket.emit('error', { message: 'No active inject' });
          return;
        }

        const injectId = state.currentInjectId;

        const existingDecision = await prisma.decision.findUnique({
          where: {
            sessionId_playerId_injectId: {
              sessionId,
              playerId: socket.userId,
              injectId,
            },
          },
          include: {
            option: true,
          },
        });

        if (existingDecision) {
          state.decidedPlayerIds.add(socket.userId);
          socket.emit('player:decision-ack', {
            decisionId: existingDecision.id,
            score: existingDecision.score,
            speedBonus: existingDecision.speedBonus,
            feedback: existingDecision.aiFeedback || existingDecision.option.scriptedFeedback,
            isOptimal: existingDecision.option.isOptimal,
            feedbackTags: existingDecision.option.feedbackTags,
          });
          io.to(`session:${sessionId}`).emit('session:player-decided', {
            userId: socket.userId,
            displayName: socket.userDisplayName,
            count: state.decidedPlayerIds.size,
          });
          return;
        }

        // Prevent duplicate decisions within the active socket lifecycle
        if (state.decidedPlayerIds.has(socket.userId)) {
          socket.emit('error', { message: 'Decision already submitted' });
          return;
        }

        const option = await prisma.injectOption.findUnique({
          where: { id: optionId },
          include: {
            inject: {
              include: {
                scenario: { select: { title: true, type: true } },
              },
            },
          },
        });

        if (!option || option.injectId !== injectId) {
          socket.emit('error', { message: 'Invalid option' });
          return;
        }

        const player = await prisma.sessionPlayer.findUnique({
          where: { sessionId_userId: { sessionId, userId: socket.userId } },
          include: { session: { select: { status: true, currentInjectId: true } } },
        });

        if (!player) {
          socket.emit('error', { message: 'You are not a participant in this session' });
          return;
        }

        if (player.session.status !== 'ACTIVE') {
          socket.emit('error', { message: 'Session is not accepting decisions' });
          return;
        }

        if (player.session.currentInjectId && player.session.currentInjectId !== injectId) {
          socket.emit('error', { message: 'This inject is no longer active' });
          return;
        }

        const sessionSettings = await prisma.session.findUnique({
          where: { id: sessionId },
          select: { settings: true },
        });

        // session.settings is stored as an untyped JSON blob; cast to a typed interface
        // for safe field access rather than using 'as any'
        interface SessionSettings {
          speedBonusEnabled?: boolean;
          speedBonusMax?: number;
          speedBonusDecaySeconds?: number;
          timerEnabled?: boolean;
          showLeaderboard?: boolean;
          showFeedbackImmediately?: boolean;
        }
        const settings = (sessionSettings?.settings ?? {}) as SessionSettings;

        const { baseScore, speedBonus } = calculateScore(
          option.scoreWeight,
          Date.now(),
          state.injectStartTime,
          {
            speedBonusEnabled: settings.speedBonusEnabled ?? false,
            speedBonusMax: settings.speedBonusMax ?? 25,
            speedBonusDecaySeconds: settings.speedBonusDecaySeconds ?? 60,
          }
        );

        // Generate AI feedback
        const inject = option.inject;
        const { feedback, provider } = await generateFeedback(
          {
            scenarioTitle: inject.scenario.title,
            scenarioType: inject.scenario.type,
            injectTitle: inject.title,
            injectNarrative: inject.narrative,
            phase: inject.phase,
            chosenOption: option.text,
            isOptimal: option.isOptimal,
            scoreWeight: option.scoreWeight,
            playerRole: player?.assignedRole || 'Unknown',
            mitreAttackId: inject.mitreAttackId || undefined,
            mitreAttackName: inject.mitreAttackName || undefined,
            nistCsfFunction: inject.nistCsfFunction || undefined,
            allOptions: [],
            optimalOptionText: '',
          },
          option.scriptedFeedback
        );

        const decision = await prisma.decision.create({
          data: {
            sessionId,
            playerId: socket.userId,
            injectId,
            optionId,
            rationale: rationale?.slice(0, 500),
            score: baseScore,
            speedBonus,
            aiFeedback: feedback,
            aiProvider: provider,
          },
        });

        state.decidedPlayerIds.add(socket.userId);

        // Acknowledge to the player with their personal feedback
        socket.emit('player:decision-ack', {
          decisionId: decision.id,
          score: baseScore,
          speedBonus,
          feedback,
          isOptimal: option.isOptimal,
          feedbackTags: option.feedbackTags,
        });

        // Tell facilitator someone has decided (count matches frontend data.count)
        io.to(`session:${sessionId}`).emit('session:player-decided', {
          userId: socket.userId,
          displayName: socket.userDisplayName,
          count: state.decidedPlayerIds.size,
        });

        await audit({
          userId: socket.userId,
          action: 'DECISION_SUBMITTED',
          resource: sessionId,
          metadata: { injectId, optionId, score: baseScore },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          logger.warn('Duplicate decision submission ignored', { sessionId, userId: socket.userId });
          const injectId = sessionState.get(sessionId)?.currentInjectId;
          if (injectId && socket.userId) {
            const existingDecision = await prisma.decision.findUnique({
              where: {
                sessionId_playerId_injectId: {
                  sessionId,
                  playerId: socket.userId,
                  injectId,
                },
              },
              include: { option: true },
            });
            if (existingDecision) {
              socket.emit('player:decision-ack', {
                decisionId: existingDecision.id,
                score: existingDecision.score,
                speedBonus: existingDecision.speedBonus,
                feedback: existingDecision.aiFeedback || existingDecision.option.scriptedFeedback,
                isOptimal: existingDecision.option.isOptimal,
                feedbackTags: existingDecision.option.feedbackTags,
              });
              return;
            }
          }
          socket.emit('error', { message: 'Decision already submitted' });
          return;
        }

        logger.error('Decision submission failed', { error, sessionId, userId: socket.userId });
        socket.emit('error', { message: 'Unable to submit decision right now' });
      }
    }

    socket.on('player:decision', (data) => handleDecision(data));
    socket.on('player:submit-decision', (data) => handleDecision(data));

    // ── FACILITATOR: Generate AI-driven inject ────────────────────────────
    socket.on('facilitator:generate-ai-inject', async ({ sessionId }: { sessionId: string }) => {
      logger.info('facilitator:generate-ai-inject received', { sessionId, userId: socket.userId });
      const session = await prisma.session.findUnique({
        where: { id: sessionId, facilitatorId: socket.userId },
        include: {
          scenario: { select: { type: true, difficulty: true, objectives: true, mode: true } },
          decisions: {
            include: {
              inject: { select: { title: true, narrative: true, phase: true } },
              option: { select: { text: true, scoreWeight: true, isOptimal: true } },
              player: { select: { id: true } },
            },
            orderBy: { timestamp: 'asc' },
          },
        },
      });

      if (!session) {
        logger.warn('generate-ai-inject: session not found or not owned by facilitator', { sessionId, userId: socket.userId });
        socket.emit('error', { message: 'Not authorized or not an AI-driven session' });
        return;
      }
      if (session.scenario.mode !== 'AI_DRIVEN') {
        logger.warn('generate-ai-inject: session is not AI_DRIVEN', { sessionId, mode: session.scenario.mode });
        socket.emit('error', { message: 'Not authorized or not an AI-driven session' });
        return;
      }

      // Broadcast "generating" state to all participants
      const existingInjectIds = [...new Set(session.decisions.map(d => d.injectId))];
      const roundNumber = existingInjectIds.length + 1;
      const totalRounds = session.totalRounds ?? 0;

      // Enforce round limit for AI-driven sessions
      if (totalRounds > 0 && roundNumber > totalRounds) {
        socket.emit('error', { message: `Exercise complete — all ${totalRounds} rounds have been played.` });
        return;
      }

      const isLastRound = totalRounds > 0 && roundNumber === totalRounds;

      io.to(`session:${sessionId}`).emit('session:ai-inject-generating', { roundNumber, totalRounds, isLastRound });

      // Build history from decisions grouped by inject
      const historyMap = new Map<string, typeof session.decisions>();
      for (const d of session.decisions) {
        const arr = historyMap.get(d.injectId) ?? [];
        arr.push(d);
        historyMap.set(d.injectId, arr);
      }

      const history = Array.from(historyMap.entries()).map(([, decisions], idx) => {
        const first = decisions[0];
        const avgScore = decisions.length
          ? Math.round(decisions.reduce((s, d) => s + d.score, 0) / decisions.length)
          : 0;

        return {
          roundNumber: idx + 1,
          injectTitle: first.inject.title,
          narrative: first.inject.narrative,
          phase: first.inject.phase,
          avgScore,
          decisions: decisions.map(d => ({
            role: 'Player',
            chosenOption: d.option.text,
            score: d.score,
            isOptimal: d.option.isOptimal,
          })),
        };
      });

      const aiCtx = {
        scenarioType: session.scenario.type,
        difficulty: session.scenario.difficulty,
        objectives: session.scenario.objectives,
        onboardingAnswers: await buildMergedAiContext(
          session.orgId,
          (session.onboardingAnswers as Record<string, unknown>) ?? {},
        ),
        history,
        roundNumber,
        totalRounds,
        isLastRound,
      };

      const aiCfg = await getAISettings();
      const useOllama = aiCfg.activeProvider === 'ollama';
      const facilitatorRoom = `facilitator:${sessionId}`;

      const maxInjectAttempts = 2;
      let lastInjectError: unknown;
      let injectSucceeded = false;

      for (let injectAttempt = 1; injectAttempt <= maxInjectAttempts; injectAttempt++) {
        try {
          let generated: GeneratedInject;

          if (useOllama && session.aiPreviewMode) {
            // ── Staged pipeline for facilitator preview ──────────────────────
            // Step 1: narrative ready — facilitator can start reading
            logger.info('Pipeline step 1: generating narrative');
            const narrativePart = await generateNarrative(aiCtx);
            io.to(facilitatorRoom).emit('session:ai-inject-stage', { stage: 'narrative', data: narrativePart, roundNumber });

            // Step 2: options ready — facilitator sees the choices appear
            logger.info('Pipeline step 2: generating options');
            const options = await generateOptions(narrativePart.narrative, narrativePart.phase, roundNumber);
            io.to(facilitatorRoom).emit('session:ai-inject-stage', { stage: 'options', data: options, roundNumber });

            // Step 3: feedback ready — full inject assembled
            logger.info('Pipeline step 3: generating feedback');
            const feedbackParts = await generateOptionFeedback(narrativePart.narrative, options);
            generated = cleanInject({
              ...narrativePart,
              options: options.map((opt, i) => ({
                ...opt,
                scriptedFeedback: feedbackParts[i]?.scriptedFeedback ?? '',
                feedbackTags: feedbackParts[i]?.feedbackTags ?? [],
              })),
            });
            io.to(facilitatorRoom).emit('session:ai-inject-preview', { inject: generated, roundNumber, totalRounds, isLastRound });
          } else {
            // ── Single call (Anthropic or auto-present Ollama) ───────────────
            generated = await generateAdaptiveInject(aiCtx);
            if (session.aiPreviewMode) {
              io.to(facilitatorRoom).emit('session:ai-inject-preview', { inject: generated, roundNumber, totalRounds, isLastRound });
            } else {
              await persistAndPresentAiInject(io, socket, sessionId, session.scenarioId, generated, isLastRound, totalRounds);
            }
          }

          injectSucceeded = true;
          break;
        } catch (err) {
          lastInjectError = err;
          logger.warn(`AI inject generation attempt ${injectAttempt}/${maxInjectAttempts} failed`, { error: String(err), sessionId });
        }
      }

      if (!injectSucceeded) {
        logger.error('AI inject generation failed after all attempts', { error: String(lastInjectError), sessionId });
        io.to(`session:${sessionId}`).emit('session:ai-inject-generation-failed', { sessionId });
      }
    });

    // ── FACILITATOR: Present AI inject after preview/edit ─────────────────
    socket.on('facilitator:present-ai-inject', async ({
      sessionId,
      inject,
      isLastRound,
      totalRounds,
    }: {
      sessionId: string;
      inject: GeneratedInject;
      isLastRound?: boolean;
      totalRounds?: number;
    }) => {
      const session = await prisma.session.findUnique({
        where: { id: sessionId, facilitatorId: socket.userId },
        select: { scenarioId: true, scenario: { select: { mode: true } } },
      });

      if (!session || session.scenario.mode !== 'AI_DRIVEN') {
        socket.emit('error', { message: 'Not authorized or not an AI-driven session' });
        return;
      }

      try {
        await persistAndPresentAiInject(io, socket, sessionId, session.scenarioId, inject, isLastRound ?? false, totalRounds ?? 0);
      } catch (error) {
        logger.error('Failed to present AI inject', { error, sessionId, userId: socket.userId });
        socket.emit('error', { message: 'Unable to present this inject. Please regenerate or try again.' });
        io.to(`session:${sessionId}`).emit('session:ai-inject-generation-failed', { sessionId, message: 'Unable to present this inject. Please regenerate or try again.' });
      }
    });

    // ── FACILITATOR: End session / go to debrief ──────────────────────────
    socket.on('facilitator:end-session', async ({ sessionId }: { sessionId: string }) => {
      const session = await prisma.session.findUnique({
        where: { id: sessionId, facilitatorId: socket.userId },
        select: {
          id: true,
          orgId: true,
          onboardingAnswers: true,
          startedAt: true,
          endedAt: true,
          scenario: { select: { type: true, title: true, mode: true } },
          players: { include: { user: { select: { displayName: true } } } },
          decisions: {
            include: {
              inject: { select: { title: true, phase: true, nistCsfFunction: true } },
              option: { select: { scoreWeight: true, isOptimal: true, text: true } },
            },
          },
        },
      });

      if (!session) {
        socket.emit('error', { message: 'Not authorized' });
        return;
      }

      await prisma.session.update({
        where: { id: sessionId },
        data: { status: 'DEBRIEF', endedAt: new Date() },
      });

      sessionState.delete(sessionId);

      io.to(`session:${sessionId}`).emit('session:ended', { sessionId });
      await audit({ userId: socket.userId, action: 'SESSION_ENDED', resource: sessionId });

      // For AI-driven sessions, asynchronously generate the AI debrief narrative
      if (session.scenario.mode === 'AI_DRIVEN') {
        generateAndSaveAIDebrief(session, sessionId).catch(err =>
          logger.error('AI debrief generation failed', { error: err, sessionId })
        );
      }
    });

    // ── Disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      if (socket.userId && socket.sessionId) {
        await prisma.sessionPlayer.updateMany({
          where: { sessionId: socket.sessionId, userId: socket.userId },
          data: { isConnected: false },
        });

        socket
          .to(`session:${socket.sessionId}`)
          .emit('session:player-disconnected', {
            userId: socket.userId,
            displayName: socket.userDisplayName,
          });
      }
      logger.info('Socket disconnected', { userId: socket.userId, socketId: socket.id });
    });
  });

  logger.info('Socket.io initialized');
}

// ── Helpers (module-level, shared by socket handlers) ────────────────────────

async function persistAndPresentAiInject(
  io: Server,
  socket: AuthenticatedSocket,
  sessionId: string,
  scenarioId: string,
  generated: GeneratedInject,
  isLastRound: boolean = false,
  totalRounds: number = 0
): Promise<void> {
  // Persist as real Inject + InjectOption records so debrief replay works unchanged
  const injectCount = await prisma.inject.count({ where: { scenarioId } });

  const inject = await prisma.inject.create({
    data: {
      scenarioId,
      phase: generated.phase,
      phaseOrder: injectCount + 1,
      injectOrder: injectCount + 1,
      title: generated.title,
      narrative: generated.narrative,
      backgroundBrief: generated.contextNote ?? null,
      roleVisibility: [],
      mitreAttackId: generated.mitreAttackId ?? null,
      mitreAttackName: generated.mitreAttackName ?? null,
      nistCsfFunction: generated.nistCsfFunction ?? null,
      timerSeconds: generated.timerSeconds ?? null,
      options: {
        create: generated.options.map(o => ({
          text: o.text,
          scoreWeight: o.scoreWeight,
          isOptimal: o.isOptimal,
          scriptedFeedback: typeof o.scriptedFeedback === 'string' ? o.scriptedFeedback : '',
          feedbackTags: Array.isArray(o.feedbackTags) ? o.feedbackTags : [],
        })),
      },
    },
    include: { options: true },
  });

  const now = Date.now();
  sessionState.set(sessionId, {
    currentInjectId: inject.id,
    injectStartTime: now,
    decidedPlayerIds: new Set(),
  });

  await prisma.session.update({
    where: { id: sessionId },
    data: { currentInjectId: inject.id, status: 'ACTIVE' },
  });

  io.to(`session:${sessionId}`).emit('session:inject-presented', {
    inject,
    startTime: now,
    isAiGenerated: true,
    contextNote: generated.contextNote,
    isLastRound,
    totalRounds,
  });

  logger.info('AI inject persisted and presented', { sessionId, injectId: inject.id, title: inject.title, isLastRound });
}

async function generateAndSaveAIDebrief(
  session: {
    id: string;
    orgId: string | null;
    scenario: { type: string; title: string };
    onboardingAnswers: unknown;
    players: Array<{
      userId: string;
      assignedRole: string;
      totalScore: number;
      user: { displayName: string };
    }>;
    decisions: Array<{
      score: number;
      inject: { title: string; phase: string; nistCsfFunction: string | null };
      option: { scoreWeight: number; isOptimal: boolean; text: string };
    }>;
    startedAt: Date | null;
    endedAt: Date | null;
  },
  sessionId: string
): Promise<void> {
  // Build NIST gaps
  const functionScores: Record<string, number[]> = {};
  for (const d of session.decisions) {
    const fn = d.inject.nistCsfFunction;
    if (fn) {
      if (!functionScores[fn]) functionScores[fn] = [];
      functionScores[fn].push(d.score);
    }
  }

  const nistGaps = Object.entries(functionScores).map(([fn, scores]) => {
    const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    const strength = avg >= 75 ? 'strong' : avg >= 50 ? 'adequate' : avg >= 25 ? 'gap' : 'critical-gap';
    return { function: fn, avgScore: avg, strength };
  });

  // Optimal rate
  const totalDecisions = session.decisions.length;
  const optimalDecisions = session.decisions.filter(d => d.option.isOptimal).length;
  const optimalRate = totalDecisions > 0 ? (optimalDecisions / totalDecisions) * 100 : 0;

  // Duration
  const durationMs = session.endedAt && session.startedAt
    ? session.endedAt.getTime() - session.startedAt.getTime()
    : 0;
  const durationMinutes = Math.round(durationMs / 60000);

  // Participants
  const participants = session.players.map(p => {
    const playerDecisions = session.decisions.filter(() => true); // we don't have playerId here; use overall
    return {
      displayName: p.user.displayName,
      assignedRole: p.assignedRole,
      totalScore: p.totalScore,
      optimalCount: 0,
      decisionCount: 0,
    };
  });

  // History (one entry per unique inject)
  const injectMap = new Map<string, typeof session.decisions>();
  for (const d of session.decisions) {
    const key = d.inject.title;
    if (!injectMap.has(key)) injectMap.set(key, []);
    injectMap.get(key)!.push(d);
  }

  const history = Array.from(injectMap.entries()).map(([title, decisions], idx) => ({
    roundNumber: idx + 1,
    injectTitle: title,
    narrative: '',
    phase: decisions[0].inject.phase,
    avgScore: Math.round(decisions.reduce((s, d) => s + d.score, 0) / decisions.length),
    decisions: [],
  }));

  const aiDebriefText = await generateAIDebrief({
    scenarioType: session.scenario.type,
    scenarioTitle: session.scenario.title,
    onboardingAnswers: await buildMergedAiContext(
      session.orgId,
      (session.onboardingAnswers as Record<string, unknown>) ?? {},
    ),
    history,
    nistGaps,
    participants,
    overallOptimalRate: optimalRate,
    sessionDurationMinutes: durationMinutes,
  });

  if (aiDebriefText) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { aiDebriefText },
    });
    logger.info('AI debrief saved', { sessionId, length: aiDebriefText.length });
  }
}
