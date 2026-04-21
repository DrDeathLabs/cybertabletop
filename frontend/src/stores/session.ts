import { create } from 'zustand';

export interface GeneratedOption {
  text: string;
  scoreWeight: number;
  isOptimal: boolean;
  scriptedFeedback: string;
  feedbackTags?: string[];
}

export interface GeneratedInject {
  title: string;
  narrative: string;
  phase: string;
  contextNote?: string;
  nistCsfFunction: string;
  mitreAttackId?: string;
  mitreAttackName?: string;
  timerSeconds?: number;
  options: GeneratedOption[];
}

export interface SessionPlayer {
  userId: string;
  displayName: string;
  assignedRole: string;
  totalScore: number;
  isConnected: boolean;
}

export interface InjectOption {
  id: string;
  text: string;
  scoreWeight?: number;
  isOptimal?: boolean;
  scriptedFeedback?: string;
  feedbackTags?: string[];
  consequences?: string;
}

export interface Inject {
  id: string;
  phase: string;
  title: string;
  narrative: string;
  backgroundBrief?: string;
  roleVisibility: string[];
  mitreAttackId?: string;
  mitreAttackName?: string;
  nistCsfFunction?: string;
  timerSeconds?: number;
  options: InjectOption[];
}

export interface DecisionResult {
  playerId: string;
  playerName: string;
  optionId: string;
  score: number;
  feedback: string;
  aiProvider?: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  role: string;
  totalScore: number;
}

type SessionStatus = 'LOBBY' | 'ACTIVE' | 'DEBRIEF' | 'COMPLETE';
type GamePhase = 'lobby' | 'inject' | 'deciding' | 'reveal' | 'debrief';

interface SessionState {
  sessionId: string | null;
  status: SessionStatus;
  gamePhase: GamePhase;
  currentInject: Inject | null;
  injectStartTime: number | null;
  players: SessionPlayer[];
  // Injects that have been presented this session (tracked to remove from dropdown)
  usedInjectIds: string[];
  myDecision: string | null;  // optionId
  myDecisionAck: {
    score: number;
    speedBonus: number;
    feedback: string;
    isOptimal: boolean;
    feedbackTags: string[];
  } | null;
  revealData: {
    optionCounts: Record<string, number>;
    playerDecisions: DecisionResult[];
    leaderboard: LeaderboardEntry[];
  } | null;
  decidedCount: number;
  totalPlayerCount: number;
  scenarioMode: 'SCRIPTED' | 'AI_DRIVEN';
  aiPreviewMode: boolean;
  isGeneratingInject: boolean;
  pendingAiInject: GeneratedInject | null;
  currentRound: number;
  totalRounds: number;

  // Actions
  setSession: (id: string) => void;
  setStatus: (status: SessionStatus) => void;
  setGamePhase: (phase: GamePhase) => void;
  setCurrentInject: (inject: Inject, startTime: number) => void;
  /** Atomic inject transition — replaces setCurrentInject + setGamePhase.
   *  Single set() call eliminates intermediate-state renders and tracks the
   *  inject in usedInjectIds so the facilitator dropdown can filter it out. */
  presentInject: (inject: Inject, startTime: number) => void;
  /** Optimistic reveal clear — called immediately when the facilitator clicks
   *  "Next inject" so the UI transitions without waiting for the socket echo. */
  clearReveal: () => void;
  setPlayers: (players: SessionPlayer[]) => void;
  addPlayer: (player: Partial<SessionPlayer> & { userId: string; displayName: string }) => void;
  removePlayer: (userId: string) => void;
  setMyDecision: (optionId: string) => void;
  setMyDecisionAck: (ack: SessionState['myDecisionAck']) => void;
  setRevealData: (data: SessionState['revealData']) => void;
  setDecidedCount: (count: number) => void;
  setScenarioMode: (mode: 'SCRIPTED' | 'AI_DRIVEN') => void;
  setAiPreviewMode: (val: boolean) => void;
  setGeneratingInject: (val: boolean) => void;
  setPendingAiInject: (inject: GeneratedInject | null) => void;
  setCurrentRound: (round: number) => void;
  setTotalRounds: (total: number) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  status: 'LOBBY',
  gamePhase: 'lobby',
  currentInject: null,
  injectStartTime: null,
  players: [],
  usedInjectIds: [],
  myDecision: null,
  myDecisionAck: null,
  revealData: null,
  decidedCount: 0,
  totalPlayerCount: 0,
  scenarioMode: 'SCRIPTED',
  aiPreviewMode: true,
  isGeneratingInject: false,
  pendingAiInject: null,
  currentRound: 0,
  totalRounds: 0,

  setSession: (id) => set({ sessionId: id }),
  setStatus: (status) => set({ status }),
  setGamePhase: (gamePhase) => set({ gamePhase }),

  // Legacy action — kept for any remaining callers; prefer presentInject.
  setCurrentInject: (inject, startTime) =>
    set((s) => ({
      currentInject: inject,
      injectStartTime: startTime,
      gamePhase: 'inject' as GamePhase,
      myDecision: null,
      myDecisionAck: null,
      revealData: null,
      decidedCount: 0,
      usedInjectIds: s.usedInjectIds.includes(inject.id)
        ? s.usedInjectIds
        : [...s.usedInjectIds, inject.id],
    })),

  // Atomic single-set transition — no intermediate renders between clearing
  // revealData and setting gamePhase to 'inject'.
  // Also clears AI generation state so the Generate button becomes available again.
  presentInject: (inject, startTime) =>
    set((s) => ({
      currentInject: inject,
      injectStartTime: startTime,
      gamePhase: 'inject' as GamePhase,
      myDecision: null,
      myDecisionAck: null,
      revealData: null,
      decidedCount: 0,
      isGeneratingInject: false,
      pendingAiInject: null,
      usedInjectIds: s.usedInjectIds.includes(inject.id)
        ? s.usedInjectIds
        : [...s.usedInjectIds, inject.id],
    })),

  // Immediately transitions away from the reveal phase so the facilitator's
  // "Reveal Results" button reappears without waiting for the socket echo.
  clearReveal: () =>
    set({ revealData: null, gamePhase: 'inject', myDecision: null, myDecisionAck: null, decidedCount: 0 }),

  setPlayers: (players) => set({ players, totalPlayerCount: players.length }),
  addPlayer: (player) =>
    set((s) => {
      const exists = s.players.find((p) => p.userId === player.userId);
      const updated = exists
        ? s.players.map((p) => (p.userId === player.userId ? { ...p, isConnected: true } : p))
        : [...s.players, { assignedRole: '', totalScore: 0, isConnected: true, ...player }];
      return { players: updated, totalPlayerCount: updated.length };
    }),
  removePlayer: (userId) =>
    set((s) => ({
      players: s.players.map((p) => (p.userId === userId ? { ...p, isConnected: false } : p)),
    })),
  setMyDecision: (optionId) => set({ myDecision: optionId }),
  setMyDecisionAck: (myDecisionAck) => set({ myDecisionAck }),
  setRevealData: (revealData) => set({ revealData, gamePhase: 'reveal' }),
  setDecidedCount: (decidedCount) => set({ decidedCount }),
  setScenarioMode: (scenarioMode) => set({ scenarioMode }),
  setAiPreviewMode: (aiPreviewMode) => set({ aiPreviewMode }),
  setGeneratingInject: (isGeneratingInject) => set({ isGeneratingInject }),
  setPendingAiInject: (pendingAiInject) => set({ pendingAiInject }),
  setCurrentRound: (currentRound) => set({ currentRound }),
  setTotalRounds: (totalRounds) => set({ totalRounds }),
  reset: () =>
    set({
      sessionId: null,
      status: 'LOBBY',
      gamePhase: 'lobby',
      currentInject: null,
      injectStartTime: null,
      players: [],
      usedInjectIds: [],
      myDecision: null,
      myDecisionAck: null,
      revealData: null,
      decidedCount: 0,
      totalPlayerCount: 0,
      scenarioMode: 'SCRIPTED',
      aiPreviewMode: true,
      isGeneratingInject: false,
      pendingAiInject: null,
      currentRound: 0,
      totalRounds: 0,
    }),
}));
