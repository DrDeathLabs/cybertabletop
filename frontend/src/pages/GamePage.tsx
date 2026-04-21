import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Inject } from '@/stores/session';
import {
  Clock,
  CheckCircle,
  XCircle,
  Trophy,
  Users,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Eye,
  SkipForward,
  StopCircle,
  Star,
  Tag,
  UserPlus,
  Bot,
  Sparkles,
  Send,
  RefreshCw,
} from 'lucide-react';
import { connectSocket, disconnectSocket, getSocket } from '../socket/client';
import { useSessionStore } from '../stores/session';
import type { GeneratedInject } from '../stores/session';
import { useAuthStore } from '../stores/auth';
import { VoiceInputButton } from '../components/shared/VoiceInputButton';
import { TextQualityIndicator } from '../components/shared/TextQualityIndicator';
import { useTextQuality } from '../hooks/useTextQuality';
import { FacilitatorScriptPanel } from '../components/facilitator/FacilitatorScriptPanel';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_ROLES = [
  'Incident Commander',
  'IR Lead',
  'Threat Analyst',
  'Communications/PR',
  'Legal/Compliance',
  'Executive/CISO',
  'IT/Sysadmin',
  'HR',
];

// ─── Timer ────────────────────────────────────────────────────────────────────

function useCountdown(seconds: number | null | undefined, startTime: number | null) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!seconds || !startTime) {
      setRemaining(null);
      return;
    }
    const tick = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const rem = Math.max(0, seconds - elapsed);
      setRemaining(Math.ceil(rem));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [seconds, startTime]);

  return remaining;
}

// ─── Rationale Field with voice + quality check ───────────────────────────────

function RationaleField({
  value,
  onChange,
  injectNarrative,
  playerRole,
}: {
  value: string;
  onChange: (v: string) => void;
  injectNarrative?: string;
  playerRole?: string;
}) {
  const { check, result, isChecking, clear } = useTextQuality();

  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
        Rationale (optional — will appear in After Action Report)
      </label>
      <div className="flex gap-2 items-start">
        <input
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); clear(); }}
          placeholder="Briefly explain your reasoning…"
          maxLength={300}
          className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 text-sm"
        />
        <VoiceInputButton
          size="sm"
          onTranscript={t => { onChange(value + (value ? ' ' : '') + t); clear(); }}
        />
      </div>
      {value.trim().length > 10 && (
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={() => check({
              text: value,
              fieldType: 'rationale',
              contextHint: injectNarrative,
              playerRole,
            })}
            disabled={isChecking}
            className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40 transition-colors"
          >
            Check quality
          </button>
        </div>
      )}
      <TextQualityIndicator
        result={result}
        isChecking={isChecking}
        onAcceptRevision={t => { onChange(t); clear(); }}
        onDismiss={clear}
      />
    </div>
  );
}

// ─── Player View ──────────────────────────────────────────────────────────────

function PlayerView({ compact = false }: { compact?: boolean }) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const currentInject = useSessionStore((s) => s.currentInject);
  const injectStartTime = useSessionStore((s) => s.injectStartTime);
  const myDecision = useSessionStore((s) => s.myDecision);
  const myDecisionAck = useSessionStore((s) => s.myDecisionAck);
  const gamePhase = useSessionStore((s) => s.gamePhase);
  const setMyDecision = useSessionStore((s) => s.setMyDecision);

  const revealData = useSessionStore((s) => s.revealData);

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [rationale, setRationale] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const remaining = useCountdown(currentInject?.timerSeconds, injectStartTime);

  // Reset on new inject
  useEffect(() => {
    setSelectedOption(null);
    setRationale('');
    setSubmitting(false);
  }, [currentInject?.id]);

  const handleSubmit = () => {
    if (!selectedOption || !sessionId) return;
    setSubmitting(true);
    setMyDecision(selectedOption);
    const socket = getSocket();
    socket.emit('player:submit-decision', {
      sessionId,
      optionId: selectedOption,
      rationale: rationale.trim() || undefined,
    });
  };

  // Player reveal view — not shown in compact mode (facilitator already sees RevealPanel above)
  if (!compact && gamePhase === 'reveal' && revealData && currentInject) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 pb-10">
        <h2 className="text-xl font-bold text-white mb-6">Results</h2>
        <RevealPanel revealData={revealData} currentInject={currentInject} />
      </div>
    );
  }

  // Nothing to respond to — hide the waiting spinner entirely in compact mode
  if (!currentInject) {
    if (compact) return null;
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        <p className="text-slate-400">Waiting for the facilitator to present an inject…</p>
      </div>
    );
  }

  // Waiting state after submission (before reveal)
  if (myDecision && !myDecisionAck && gamePhase !== 'reveal') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <div className="bg-slate-800 border border-blue-500/30 rounded-2xl p-8">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Decision Submitted</h2>
          <p className="text-slate-400 text-sm">
            Waiting for other players and the facilitator to reveal results…
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Waiting for reveal
          </div>
        </div>
      </div>
    );
  }

  // Feedback shown (before reveal, if showFeedbackImmediately is on, ack is set)
  if (myDecisionAck && gamePhase !== 'reveal') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div
          className={`bg-slate-800 border rounded-2xl p-6 ${
            myDecisionAck.isOptimal ? 'border-green-500/40' : 'border-orange-500/40'
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            {myDecisionAck.isOptimal ? (
              <CheckCircle className="w-6 h-6 text-green-400" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-orange-400" />
            )}
            <span
              className={`text-lg font-bold ${
                myDecisionAck.isOptimal ? 'text-green-400' : 'text-orange-400'
              }`}
            >
              {myDecisionAck.isOptimal ? 'Optimal Choice' : 'Good Attempt'}
            </span>
            <span className="ml-auto text-2xl font-bold text-white">
              +{myDecisionAck.score + myDecisionAck.speedBonus}
            </span>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">{myDecisionAck.feedback}</p>
          {myDecisionAck.feedbackTags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {myDecisionAck.feedbackTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}
          <p className="text-slate-500 text-xs mt-4">Waiting for facilitator to reveal results…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Phase badge + timer — hidden in compact (facilitator) mode */}
      {!compact && (
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 uppercase tracking-wider">
            <AlertTriangle className="w-3.5 h-3.5" />
            {currentInject.phase}
          </span>
          {remaining !== null && (
            <div
              className={`flex items-center gap-2 text-sm font-mono font-bold px-3 py-1.5 rounded-full border ${
                remaining <= 10
                  ? 'bg-red-500/15 text-red-400 border-red-500/40'
                  : remaining <= 30
                  ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40'
                  : 'bg-slate-700 text-slate-300 border-slate-600'
              }`}
            >
              <Clock className="w-4 h-4" />
              {remaining}s
            </div>
          )}
        </div>
      )}

      {/* Inject title + narrative — hidden in compact (facilitator) mode */}
      {!compact && (
        <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">{currentInject.title}</h2>
          <p className="text-slate-300 leading-relaxed text-base whitespace-pre-wrap">
            {currentInject.narrative}
          </p>
          {currentInject.mitreAttackId && (
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                {currentInject.mitreAttackId}
              </span>
              {currentInject.mitreAttackName && (
                <span>{currentInject.mitreAttackName}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Decision options */}
      {!myDecision && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400 font-medium">Select your response:</p>
          {currentInject.options.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelectedOption(option.id)}
              className={`decision-option w-full text-left p-5 rounded-xl border-2 transition-all ${
                selectedOption === option.id
                  ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10'
                  : 'border-slate-700/50 bg-slate-800 hover:border-slate-500 hover:bg-slate-700/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors ${
                    selectedOption === option.id
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-slate-600'
                  }`}
                >
                  {selectedOption === option.id && (
                    <div className="w-full h-full rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  )}
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">{option.text}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Rationale */}
      {!myDecision && selectedOption && (
        <RationaleField
          value={rationale}
          onChange={setRationale}
          injectNarrative={currentInject?.narrative}
          playerRole={undefined}
        />
      )}

      {/* Submit */}
      {!myDecision && (
        <button
          onClick={handleSubmit}
          disabled={!selectedOption || submitting}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3.5 transition-colors"
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Submit Decision
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ─── Facilitator View ─────────────────────────────────────────────────────────

function FacilitatorView({ sessionId }: { sessionId: string }) {
  const currentInject = useSessionStore((s) => s.currentInject);
  const decidedCount = useSessionStore((s) => s.decidedCount);
  const totalPlayerCount = useSessionStore((s) => s.totalPlayerCount);
  const gamePhase = useSessionStore((s) => s.gamePhase);
  const revealData = useSessionStore((s) => s.revealData);
  const usedInjectIds = useSessionStore((s) => s.usedInjectIds);
  const clearReveal = useSessionStore((s) => s.clearReveal);
  const scenarioMode = useSessionStore((s) => s.scenarioMode);
  const aiPreviewMode = useSessionStore((s) => s.aiPreviewMode);
  const isGeneratingInject = useSessionStore((s) => s.isGeneratingInject);
  const pendingAiInject = useSessionStore((s) => s.pendingAiInject);
  const setPendingAiInject = useSessionStore((s) => s.setPendingAiInject);
  const currentRound = useSessionStore((s) => s.currentRound);
  const totalRounds = useSessionStore((s) => s.totalRounds);

  const [nextInjectId, setNextInjectId] = useState('');
  const [allInjects, setAllInjects] = useState<Array<{ id: string; title: string }>>([]);
  const [editedInject, setEditedInject] = useState<GeneratedInject | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showLastRoundConfirm, setShowLastRoundConfirm] = useState(false);

  // True only for AI-driven sessions on the final round
  const isLastRound = totalRounds > 0 && currentRound > 0 && currentRound === totalRounds;
  const canGenerateNextAiInject = !currentInject || gamePhase === 'reveal';
  const aiPreviewReady = !!editedInject
    && editedInject.options.length > 0
    && editedInject.options.every((opt) => typeof opt.scriptedFeedback === 'string' && Array.isArray(opt.feedbackTags));

  useEffect(() => {
    if (scenarioMode === 'AI_DRIVEN') return; // no pre-loaded inject list for AI mode
    fetch(`/api/sessions/${sessionId}/injects`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { injects: Array<{ id: string; title: string }>; usedInjectIds: string[] }) => {
        setAllInjects(data.injects ?? []);
      })
      .catch(() => {});
  }, [sessionId, scenarioMode]);

  // Socket listeners for AI-driven events (facilitator-specific)
  // Sync local editedInject from pendingAiInject whenever a preview arrives (set by main GamePage socket handler)
  useEffect(() => {
    if (pendingAiInject) {
      setEditedInject(pendingAiInject);
      setGenerateError(null);
    } else {
      setEditedInject(null);
    }
  }, [pendingAiInject]);

  // Listen for generation failure to show error message
  useEffect(() => {
    const socket = getSocket();
    const onFailed = ({ message }: { message?: string }) => {
      setGenerateError(message ?? 'AI generation failed. Please try again.');
    };
    socket.on('session:ai-inject-generation-failed', onFailed);
    return () => {
      socket.off('session:ai-inject-generation-failed', onFailed);
    };
  }, []);

  // Merge server-side used list with client-side tracked list so injects disappear
  // from the dropdown the moment they are presented, not just after page reload.
  const availableInjects = allInjects.filter((i) => !usedInjectIds.includes(i.id));

  const handleReveal = () => {
    getSocket().emit('facilitator:reveal', { sessionId });
  };

  const handleNextInject = () => {
    if (!nextInjectId) return;
    // Optimistically clear the reveal state so the Reveal Results button reappears
    // immediately — don't block on the socket round-trip.
    clearReveal();
    getSocket().emit('facilitator:next-inject', { sessionId, injectId: nextInjectId });
    setNextInjectId('');
  };

  const handleGenerateInject = () => {
    setEditedInject(null);
    setGenerateError(null);
    setPendingAiInject(null);
    getSocket().emit('facilitator:generate-ai-inject', { sessionId });
  };

  const handlePresentAiInject = () => {
    if (!editedInject) return;
    const isLastRound = totalRounds > 0 && currentRound === totalRounds;
    getSocket().emit('facilitator:present-ai-inject', { sessionId, inject: editedInject, isLastRound, totalRounds });
    setPendingAiInject(null);
    setEditedInject(null);
    clearReveal();
  };

  const handleEndSession = () => {
    getSocket().emit('facilitator:end-session', { sessionId });
  };

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Facilitator control bar */}
      <div className="bg-slate-800 border border-blue-500/30 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">
              Facilitator Controls
              {scenarioMode === 'AI_DRIVEN' && (
                <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs normal-case">
                  AI-Driven
                </span>
              )}
              {scenarioMode === 'AI_DRIVEN' && totalRounds > 0 && currentRound > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs normal-case font-semibold border ${currentRound === totalRounds ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                  Round {currentRound} of {totalRounds}{currentRound === totalRounds ? ' · Final' : ''}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-slate-300">
                <span className="text-white font-bold">{decidedCount}</span>
                <span className="text-slate-500"> / {totalPlayerCount}</span>
                <span className="text-slate-400 ml-1">players responded</span>
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Reveal button: on the final round shows a confirmation dialog first. */}
            <button
              onClick={isLastRound && gamePhase !== 'reveal'
                ? () => setShowLastRoundConfirm(true)
                : handleReveal}
              disabled={gamePhase === 'reveal' || !currentInject}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
            >
              <Eye className="w-4 h-4" />
              Reveal Results
            </button>

            {scenarioMode === 'AI_DRIVEN' ? (
              // AI-driven: Generate inject button replaces the dropdown
              <button
                onClick={handleGenerateInject}
                disabled={isGeneratingInject || !!pendingAiInject || !canGenerateNextAiInject || (totalRounds > 0 && currentRound >= totalRounds)}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
              >
                {isGeneratingInject ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                ) : (
                  <><Bot className="w-4 h-4" /> Generate Next Inject</>
                )}
              </button>
            ) : (
              // Scripted mode: inject dropdown
              <div className="flex items-center gap-2">
                <select
                  value={nextInjectId}
                  onChange={(e) => setNextInjectId(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 max-w-[180px]"
                >
                  <option value="">Next inject…</option>
                  {availableInjects.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleNextInject}
                  disabled={!nextInjectId}
                  className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-medium rounded-lg px-3 py-2 text-sm transition-colors"
                >
                  <SkipForward className="w-4 h-4" />
                  Next
                </button>
              </div>
            )}

            <button
              onClick={handleEndSession}
              disabled={
                // For the final round of AI-driven sessions: only enable AFTER results
                // have been revealed so the facilitator sees scores before ending.
                isLastRound ? gamePhase !== 'reveal' : false
              }
              className={`flex items-center gap-1.5 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors ${
                isLastRound && gamePhase === 'reveal'
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-red-600/80 hover:bg-red-600'
              }`}
            >
              <StopCircle className="w-4 h-4" />
              {isLastRound && gamePhase === 'reveal' ? 'End Session & View AAR' : 'End Session'}
            </button>
          </div>
        </div>
      </div>

      {/* AI generating skeleton */}
      {scenarioMode === 'AI_DRIVEN' && isGeneratingInject && (
        <div className="bg-slate-800 border border-emerald-500/30 rounded-xl p-6 animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="w-5 h-5 text-emerald-400 animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">AI is crafting the next inject…</p>
              <p className="text-xs text-slate-500 mt-0.5">Analyzing team performance and adapting the scenario</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-slate-700 rounded w-3/4" />
            <div className="h-3 bg-slate-700 rounded w-full" />
            <div className="h-3 bg-slate-700 rounded w-5/6" />
          </div>
        </div>
      )}

      {/* AI generation error */}
      {scenarioMode === 'AI_DRIVEN' && generateError && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-300">Inject generation failed</p>
            <p className="text-xs text-slate-400 mt-0.5">The AI had trouble generating this round. Click Try Again to retry.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => { setGenerateError(null); handleGenerateInject(); }}
              className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
            >
              Try Again
            </button>
            <button onClick={() => setGenerateError(null)} className="text-slate-600 hover:text-slate-400 text-xs">✕</button>
          </div>
        </div>
      )}

      {/* AI inject preview panel (preview mode only) */}
      {scenarioMode === 'AI_DRIVEN' && editedInject && pendingAiInject && aiPreviewMode && (
        <div className="bg-slate-800 border border-emerald-500/40 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-300">AI-Generated Inject — Review Before Presenting</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400 border border-slate-600 font-mono">
              {editedInject.phase}
            </span>
          </div>

          {/* Adaptive context note */}
          {editedInject.contextNote && (
            <div className="flex items-start gap-2 bg-emerald-950/40 border border-emerald-500/30 rounded-lg px-4 py-3">
              <Bot className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-200/80 leading-relaxed italic">{editedInject.contextNote}</p>
            </div>
          )}

          {/* Editable title */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Title</label>
            <input
              type="text"
              value={editedInject.title}
              onChange={(e) => setEditedInject({ ...editedInject, title: e.target.value })}
              className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          {/* Editable narrative */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Narrative</label>
            <div className="relative">
              <textarea
                value={editedInject.narrative}
                onChange={(e) => setEditedInject({ ...editedInject, narrative: e.target.value })}
                rows={5}
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2.5 pr-10 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/60 resize-y leading-relaxed"
              />
              <div className="absolute right-2 bottom-2">
                <VoiceInputButton
                  size="sm"
                  onTranscript={t => setEditedInject({ ...editedInject, narrative: editedInject.narrative + (editedInject.narrative ? ' ' : '') + t })}
                />
              </div>
            </div>
          </div>

          {/* Options preview */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Decision Options</p>
            <div className="space-y-2">
              {editedInject.options.map((opt, i) => (
                <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs border ${opt.isOptimal ? 'bg-green-500/5 border-green-500/20 text-green-200' : 'bg-slate-900/40 border-slate-700/40 text-slate-300'}`}>
                  {opt.isOptimal && <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />}
                  <span className="leading-relaxed">{opt.text}</span>
                  <span className="ml-auto text-slate-500 flex-shrink-0">{opt.scoreWeight}pts</span>
                </div>
              ))}
            </div>
          </div>

          {/* NIST / MITRE tags */}
          <div className="flex flex-wrap gap-2 text-xs">
            {editedInject.nistCsfFunction && (
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                NIST: {editedInject.nistCsfFunction}
              </span>
            )}
            {editedInject.mitreAttackId && (
              <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono">
                {editedInject.mitreAttackId}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handlePresentAiInject}
              disabled={!aiPreviewReady || isGeneratingInject}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-medium rounded-lg px-5 py-2.5 text-sm transition-colors"
            >
              {isGeneratingInject ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {aiPreviewReady ? 'Present to Players' : 'Finalizing Preview...'}
            </button>
            <button
              onClick={handleGenerateInject}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg px-4 py-2.5 text-sm transition-colors border border-slate-600"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate
            </button>
          </div>
          {!aiPreviewReady && (
            <p className="text-xs text-slate-500">
              Narrative and options are ready. Waiting for AI feedback to finish before this inject can be presented.
            </p>
          )}
        </div>
      )}

      {/* Current inject */}
      {currentInject && (
        <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 uppercase tracking-wider">
              {currentInject.phase}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white mb-3">{currentInject.title}</h2>
          <p className="text-slate-300 leading-relaxed">{currentInject.narrative}</p>
        </div>
      )}

      {/* Reveal: results */}
      {gamePhase === 'reveal' && revealData && (
        <RevealPanel revealData={revealData} currentInject={currentInject} />
      )}

      {/* Final-round confirmation dialog — appears when facilitator clicks Reveal Results on the last round */}
      {showLastRoundConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-amber-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                <Star className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Final Round</h3>
                <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                  This is the last inject of the exercise. Revealing results will show team scores
                  and trigger generation of your closing facilitator script. When you're ready to
                  wrap up with the group, click <span className="text-amber-300 font-medium">End Session &amp; View AAR</span> to
                  navigate to the full After Action Report.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLastRoundConfirm(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowLastRoundConfirm(false); handleReveal(); }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                <Eye className="w-4 h-4" />
                Reveal Results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reveal Panel ─────────────────────────────────────────────────────────────

interface RevealData {
  optionCounts: Record<string, number>;
  playerDecisions: Array<{
    playerId: string;
    playerName: string;
    optionId: string;
    score: number;
    feedback: string;
  }>;
  leaderboard: Array<{
    rank: number;
    userId: string;
    displayName: string;
    role: string;
    totalScore: number;
  }>;
}

function RevealPanel({
  revealData,
  currentInject,
}: {
  revealData: RevealData;
  currentInject: Inject | null;
}) {
  const totalVotes = Object.values(revealData.optionCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Option distribution */}
      <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-base font-semibold text-white mb-4">Response Distribution</h3>
        <div className="space-y-3">
          {currentInject?.options.map((option) => {
            const count = revealData.optionCounts[option.id] ?? 0;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            return (
              <div key={option.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span
                    className={`text-sm truncate flex-1 mr-3 ${
                      option.isOptimal ? 'text-green-400 font-medium' : 'text-slate-300'
                    }`}
                  >
                    {option.isOptimal && <Star className="w-3.5 h-3.5 inline mr-1" />}
                    {option.text}
                  </span>
                  <span className="text-slate-400 text-xs flex-shrink-0">
                    {count} ({pct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-700 ${
                      option.isOptimal ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Optimal feedback */}
      {currentInject?.options.find((o) => o.isOptimal)?.scriptedFeedback && (
        <div className="bg-green-500/5 border border-green-500/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <h3 className="text-sm font-semibold text-green-400">Optimal Response Feedback</h3>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">
            {currentInject.options.find((o) => o.isOptimal)!.scriptedFeedback}
          </p>
        </div>
      )}

      {/* Player decisions */}
      <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-base font-semibold text-white mb-4">Player Choices</h3>
        <div className="space-y-2">
          {revealData.playerDecisions.map((pd) => {
            const optionText =
              currentInject?.options.find((o) => o.id === pd.optionId)?.text ?? pd.optionId;
            const isOptimal = currentInject?.options.find((o) => o.id === pd.optionId)?.isOptimal;
            return (
              <div
                key={pd.playerId}
                className="flex items-start gap-3 bg-slate-900/50 rounded-lg px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{pd.playerName}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{optionText}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isOptimal ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-slate-600" />
                  )}
                  <span className="text-sm font-bold text-white">+{pd.score}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <h3 className="text-base font-semibold text-white">Leaderboard</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-700">
              <th className="text-left pb-2 pr-3">Rank</th>
              <th className="text-left pb-2 pr-3">Name</th>
              <th className="text-left pb-2 pr-3 hidden sm:table-cell">Role</th>
              <th className="text-right pb-2">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {revealData.leaderboard.map((entry) => (
              <tr key={entry.userId} className="hover:bg-slate-700/30 transition-colors">
                <td className="py-2.5 pr-3">
                  <span
                    className={`text-sm font-bold ${
                      entry.rank === 1
                        ? 'text-yellow-400'
                        : entry.rank === 2
                        ? 'text-slate-300'
                        : entry.rank === 3
                        ? 'text-orange-400'
                        : 'text-slate-500'
                    }`}
                  >
                    #{entry.rank}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-slate-200 font-medium">{entry.displayName}</td>
                <td className="py-2.5 pr-3 text-slate-500 hidden sm:table-cell">{entry.role}</td>
                <td className="py-2.5 text-right font-bold text-white">{entry.totalScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Facilitator Response Panel ───────────────────────────────────────────────
// Shown below FacilitatorView. If the facilitator has chosen a player role they
// can respond to the inject; otherwise an opt-in role picker is displayed.

function FacilitatorResponsePanel({ joinCode }: { joinCode: string }) {
  const user = useAuthStore((s) => s.user);
  const players = useSessionStore((s) => s.players);
  const addPlayer = useSessionStore((s) => s.addPlayer);
  const currentInject = useSessionStore((s) => s.currentInject);
  const gamePhase = useSessionStore((s) => s.gamePhase);

  const [selectedRole, setSelectedRole] = useState('IR Lead');
  const [customRole, setCustomRole] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  // Is the facilitator already participating as a player?
  const myPlayerRecord = players.find((p) => p.userId === user?.id);
  const myRole = myPlayerRecord?.assignedRole ?? null;

  // Only relevant during an active inject (not lobby, not reveal)
  if (!currentInject || gamePhase === 'lobby' || gamePhase === 'reveal') return null;

  const handleJoinAsRole = async () => {
    const role = isCustom ? customRole.trim() : selectedRole;
    if (!role || !joinCode) return;
    setJoining(true);
    setJoinError('');
    try {
      const res = await fetch('/api/sessions/join', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode, assignedRole: role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error ?? 'Failed to join');
        return;
      }
      // socket.to() skips the sender, so update the players store optimistically
      if (user) {
        addPlayer({ userId: user.id, displayName: user.displayName, assignedRole: role });
      }
    } catch {
      setJoinError('Network error. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pb-10">
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-slate-700/60" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-2">
          Your Response (Facilitator)
        </span>
        <div className="flex-1 h-px bg-slate-700/60" />
      </div>

      {myRole ? (
        /* Already joined as a player role — show compact decision panel */
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-slate-500">Responding as:</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
              {myRole}
            </span>
          </div>
          <PlayerView compact />
        </div>
      ) : (
        /* Role picker — facilitator has not yet opted into a role */
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-200">Participate as a role?</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Optionally take on a player role to submit your own decision for this inject.
              Leave this blank if you prefer to facilitate without responding.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={isCustom ? 'custom' : selectedRole}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setIsCustom(true);
                } else {
                  setIsCustom(false);
                  setSelectedRole(e.target.value);
                }
              }}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
            >
              {DEFAULT_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
              <option value="custom">Custom…</option>
            </select>

            {isCustom && (
              <input
                type="text"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                placeholder="Enter role name…"
                maxLength={100}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 w-44"
              />
            )}

            <button
              onClick={handleJoinAsRole}
              disabled={joining || (isCustom && !customRole.trim())}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
            >
              {joining ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Play as {isCustom ? (customRole.trim() || '…') : selectedRole}
            </button>
          </div>

          {joinError && (
            <p className="text-red-400 text-xs mt-3">{joinError}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main GamePage ────────────────────────────────────────────────────────────

export default function GamePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const setSession = useSessionStore((s) => s.setSession);
  const presentInject = useSessionStore((s) => s.presentInject);
  const setMyDecisionAck = useSessionStore((s) => s.setMyDecisionAck);
  const setRevealData = useSessionStore((s) => s.setRevealData);
  const setDecidedCount = useSessionStore((s) => s.setDecidedCount);
  const addPlayer = useSessionStore((s) => s.addPlayer);
  const removePlayer = useSessionStore((s) => s.removePlayer);
  const setPlayers = useSessionStore((s) => s.setPlayers);
  const reset = useSessionStore((s) => s.reset);
  const gamePhase = useSessionStore((s) => s.gamePhase);
  const setScenarioMode = useSessionStore((s) => s.setScenarioMode);
  const setAiPreviewMode = useSessionStore((s) => s.setAiPreviewMode);
  const setGeneratingInject = useSessionStore((s) => s.setGeneratingInject);
  const setPendingAiInject = useSessionStore((s) => s.setPendingAiInject);
  const setCurrentRound = useSessionStore((s) => s.setCurrentRound);
  const setTotalRounds = useSessionStore((s) => s.setTotalRounds);

  const currentRound = useSessionStore((s) => s.currentRound);
  const totalRounds = useSessionStore((s) => s.totalRounds);
  const usedInjectIds = useSessionStore((s) => s.usedInjectIds);

  // For scripted sessions, currentRound is never explicitly set (it's only driven by
  // session:ai-inject-generating for AI-driven sessions).  Fall back to usedInjectIds.length
  // which naturally tracks how many injects have been presented so far.
  const effectiveRound = currentRound > 0 ? currentRound : usedInjectIds.length;

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  // Populated from REST response — the user who is the actual facilitator of this session
  const [sessionFacilitatorId, setSessionFacilitatorId] = useState<string | null>(null);
  // Join code for this session — lets the facilitator join as a player role
  const [sessionJoinCode, setSessionJoinCode] = useState<string>('');
  const [preloadFacilitatorScript, setPreloadFacilitatorScript] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const initialized = useRef(false);

  // Role-based: used only to pick the socket join event name (both are equivalent server-side)
  const hasElevatedRole =
    user?.role === 'FACILITATOR' ||
    user?.role === 'ORG_ADMIN' ||
    user?.role === 'SUPER_ADMIN';

  // Session-based: only true when this user IS the facilitator of *this* session.
  // Falls back to role-check while the REST call is in flight to avoid flashing the wrong view.
  const isFacilitatorOfSession =
    sessionFacilitatorId === null ? hasElevatedRole : user?.id === sessionFacilitatorId;

  const loadInitialState = useCallback(async () => {
    if (!sessionId) return;
    try {
      setSessionLoaded(false);
      let res = await fetch(`/api/sessions/${sessionId}`, { credentials: 'include' });
      if (res.status === 401) {
        // Token may have expired during page transition — refresh and retry once
        await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
        res = await fetch(`/api/sessions/${sessionId}`, { credentials: 'include' });
      }
      if (!res.ok) throw new Error('Failed to load session');
      const { session: s } = await res.json();
      setSession(s.id);
      const settings = (s.settings ?? {}) as { preloadFacilitatorScript?: boolean };
      // Capture session metadata for the facilitator role-join feature
      if (s.facilitatorId) setSessionFacilitatorId(s.facilitatorId);
      if (s.joinCode) setSessionJoinCode(s.joinCode);
      setPreloadFacilitatorScript(settings.preloadFacilitatorScript === true);
      if (s.scenario?.mode) setScenarioMode(s.scenario.mode as 'SCRIPTED' | 'AI_DRIVEN');
      if (typeof s.aiPreviewMode === 'boolean') setAiPreviewMode(s.aiPreviewMode);
      const scriptedRoundCount = Array.isArray(s.scenario?.injects) ? s.scenario.injects.length : 0;
      if (typeof s.totalRounds === 'number' && s.totalRounds > 0) {
        setTotalRounds(s.totalRounds);
      } else if (scriptedRoundCount > 0) {
        setTotalRounds(scriptedRoundCount);
      }
      if (s.players) {
        setPlayers(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          s.players.map((p: any) => ({
            userId: p.userId,
            // Prisma include nests displayName under p.user
            displayName: p.user?.displayName ?? p.displayName ?? 'Player',
            assignedRole: p.assignedRole,
            totalScore: p.totalScore ?? 0,
            isConnected: p.isConnected ?? false,
          }))
        );
      }
      // currentInject is resolved by getSessionWithPlayers if an inject is active
      if (s.currentInject) {
        presentInject(s.currentInject, Date.now());
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSessionLoaded(true);
    }
  }, [sessionId, setSession, setPlayers, presentInject, setScenarioMode, setAiPreviewMode]);

  useEffect(() => {
    if (!sessionId || initialized.current) return;
    initialized.current = true;

    reset();
    loadInitialState();

    const socket = connectSocket();

    socket.on('connect', () => { setConnected(true); setGeneratingInject(false); });
    socket.on('disconnect', () => setConnected(false));

    socket.emit(hasElevatedRole ? 'facilitator:join-game' : 'player:join-game', { sessionId });

    socket.on('session:inject-presented', (data: { inject: Parameters<typeof presentInject>[0]; startTime: number }) => {
      setGeneratingInject(false);
      presentInject(data.inject, data.startTime ?? Date.now());
    });

    socket.on('player:decision-ack', (ack: Parameters<typeof setMyDecisionAck>[0]) => {
      setMyDecisionAck(ack);
    });

    socket.on('session:inject-revealed', (data: Parameters<typeof setRevealData>[0]) => {
      setRevealData(data);
    });

    socket.on('session:player-decided', (data: { count: number }) => {
      setDecidedCount(data.count);
    });

    socket.on('session:player-connected', (data: { userId: string; displayName: string; assignedRole: string }) => {
      addPlayer({ userId: data.userId, displayName: data.displayName, assignedRole: data.assignedRole });
    });

    socket.on('session:player-disconnected', (data: { userId: string }) => {
      removePlayer(data.userId);
    });

    socket.on('session:ended', () => {
      navigate(`/debrief/${sessionId}`);
    });

    socket.on('session:ai-inject-generating', ({ roundNumber, totalRounds: tr }: { roundNumber: number; totalRounds: number; isLastRound: boolean }) => {
      setGeneratingInject(true);
      setCurrentRound(roundNumber);
      if (tr > 0) setTotalRounds(tr);
    });

    // Staged pipeline events — update pending inject progressively as each step completes
    socket.on('session:ai-inject-stage', ({ stage, data }: { stage: 'narrative' | 'options'; data: unknown }) => {
      if (stage === 'narrative') {
        // Narrative is ready — show it immediately with a loading state for options
        const partial = data as { title: string; narrative: string; phase: string; nistCsfFunction: string; mitreAttackId?: string; mitreAttackName?: string; timerSeconds?: number | null; contextNote?: string };
        setPendingAiInject({ ...partial, options: [] } as GeneratedInject);
      } else if (stage === 'options') {
        // Options are ready — merge into existing narrative
        const options = data as GeneratedInject['options'];
        const current = useSessionStore.getState().pendingAiInject;
        if (current) setPendingAiInject({ ...current, options });
      }
    });

    socket.on('session:ai-inject-preview', ({ inject }: { inject: GeneratedInject }) => {
      // Full inject ready — replace partial with complete version
      setGeneratingInject(false);
      setPendingAiInject(inject);
    });

    socket.on('session:ai-inject-generation-failed', () => {
      setGeneratingInject(false);
    });

    return () => {
      // Reset guard so React Strict Mode's remount (or genuine unmount+remount)
      // can re-run socket setup cleanly on the next mount.
      initialized.current = false;
      socket.off('connect');
      socket.off('disconnect');
      socket.off('session:inject-presented');
      socket.off('player:decision-ack');
      socket.off('session:inject-revealed');
      socket.off('session:player-decided');
      socket.off('session:player-connected');
      socket.off('session:player-disconnected');
      socket.off('session:ended');
      socket.off('session:ai-inject-generating');
      socket.off('session:ai-inject-stage');
      socket.off('session:ai-inject-preview');
      socket.off('session:ai-inject-generation-failed');
      disconnectSocket();
    };
  }, [sessionId, hasElevatedRole, reset, loadInitialState, presentInject, setMyDecisionAck, setRevealData, setDecidedCount, addPlayer, removePlayer, navigate, setGeneratingInject, setPendingAiInject, setCurrentRound, setTotalRounds]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Mini top bar */}
      <div className="h-12 bg-slate-800/80 border-b border-slate-700/50 flex items-center px-4 gap-3">
        <Link
          to="/dashboard"
          className="text-sm font-semibold text-white hover:text-blue-400 transition-colors"
        >
          CyberTabletop
        </Link>
        <span className="text-slate-600">·</span>
        <span className="text-xs text-slate-500 font-mono">{sessionId}</span>
        {isFacilitatorOfSession && (
          <Link
            to="/profile"
            className="text-xs px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition-colors"
          >
            Facilitator
          </Link>
        )}
        <div className="flex-1" />
        <div
          className={`flex items-center gap-1.5 text-xs ${
            connected ? 'text-green-400' : 'text-slate-500'
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              connected ? 'bg-green-400' : 'bg-slate-600'
            }`}
          />
          {connected ? 'Live' : 'Connecting…'}
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded border font-medium ${
            gamePhase === 'inject'
              ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
              : gamePhase === 'reveal'
              ? 'bg-green-500/15 text-green-400 border-green-500/30'
              : 'bg-slate-700 text-slate-400 border-slate-600'
          }`}
        >
          {gamePhase.toUpperCase()}
        </span>
      </div>

      {error ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-5 py-4">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      ) : isFacilitatorOfSession ? (
        // Two-pane facilitator layout: left = IR training, right = facilitator script
        <div className="flex h-[calc(100vh-3rem)] overflow-hidden">
          {/* Left pane — IR training controls + inject content */}
          <div className="w-1/2 overflow-y-auto border-r border-slate-700">
            {sessionId && <FacilitatorView sessionId={sessionId} />}
            <FacilitatorResponsePanel joinCode={sessionJoinCode} />
          </div>
          {/* Right pane — facilitator script panel (manages its own scroll) */}
          <div className="w-1/2 flex flex-col min-h-0">
            {!sessionLoaded ? (
              <div className="flex-1 flex items-center justify-center text-slate-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading facilitator script…</span>
              </div>
            ) : sessionId && (
              <FacilitatorScriptPanel
                sessionId={sessionId}
                currentRound={effectiveRound}
                totalRounds={totalRounds}
                gamePhase={gamePhase}
                preloadAllOnOpen={preloadFacilitatorScript}
                // Trigger closing-script generation when the final round is revealed so
                // the facilitator can read it before clicking "End Session & View AAR".
                // gamePhase never reaches 'debrief' on this page — navigation happens first.
                isSessionEnded={
                  gamePhase === 'debrief' ||
                  (gamePhase === 'reveal' && totalRounds > 0 && effectiveRound >= totalRounds)
                }
              />
            )}
          </div>
        </div>
      ) : (
        <PlayerView />
      )}

    </div>
  );
}
