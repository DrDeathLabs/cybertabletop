import { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollText, Loader2, RefreshCw, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useSessionStore } from '../../stores/session';

interface ScriptData {
  opening: string | null;
  roundIntros: Record<string, string>;
  rounds: Record<string, string>;
  closing: string | null;
}

interface Props {
  sessionId: string;
  currentRound: number;
  totalRounds: number;
  gamePhase: string;        // 'lobby'|'inject'|'deciding'|'reveal'|'debrief'
  isSessionEnded: boolean;
  preloadAllOnOpen?: boolean;
}

// ─── Single script section card ───────────────────────────────────────────────

function ScriptCard({
  title,
  subtitle,
  content,
  isGenerating,
  onRegenerate,
  accentColor,
  defaultExpanded = false,
  emptyMessage = 'Will generate automatically when this round becomes active.',
}: {
  title: string;
  subtitle: string;
  content: string | null;
  isGenerating: boolean;
  onRegenerate: () => void;
  accentColor: string;
  defaultExpanded?: boolean;
  emptyMessage?: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  // Auto-expand when content arrives for the first time
  const prevContent = useRef<string | null>(null);
  useEffect(() => {
    if (content && !prevContent.current) setExpanded(true);
    prevContent.current = content;
  }, [content]);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`border rounded-xl overflow-hidden ${accentColor}`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-slate-400 truncate">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {isGenerating && (
            <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin flex-shrink-0" />
          )}
          {content && !isGenerating && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onRegenerate(); }}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Regenerate script"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/50 px-4 py-3">
          {isGenerating ? (
            <div className="flex items-center gap-2 py-4 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating script… this takes 20–40 seconds
            </div>
          ) : content ? (
            // Render as pre-wrap plain text — scripts are recitation-ready prose,
            // not markdown. This preserves line breaks and [pause] stage directions
            // without any accidental markdown interpretation.
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-normal">
              {content}
            </p>
          ) : (
            <p className="text-sm text-slate-500 italic py-2">
              {emptyMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function FacilitatorScriptPanel({
  sessionId, currentRound, totalRounds, gamePhase, isSessionEnded, preloadAllOnOpen = false,
}: Props) {
  const currentInject = useSessionStore((s) => s.currentInject);
  const pendingAiInject = useSessionStore((s) => s.pendingAiInject);

  const [script, setScript] = useState<ScriptData>({ opening: null, roundIntros: {}, rounds: {}, closing: null });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const preloadRequested = useRef(false);

  // Use a ref to track in-flight requests — avoids stale closure bugs with useState
  const generatingRef = useRef<Record<string, boolean>>({});
  // Separate display state so UI shows spinners
  const [generatingKeys, setGeneratingKeys] = useState<Record<string, boolean>>({});
  const isFullyPreloaded = preloadAllOnOpen
    && !!script.opening
    && (totalRounds <= 0 || (
      Object.keys(script.roundIntros ?? {}).length >= totalRounds
      && Object.keys(script.rounds ?? {}).length >= totalRounds
    ))
    && !!script.closing;
  const preloadingAll = preloadAllOnOpen && loaded && !isFullyPreloaded;

  // Load existing script on mount
  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/facilitator-script`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((data: ScriptData | null) => {
        if (data) setScript(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [sessionId]);

  useEffect(() => {
    if (!loaded || !preloadAllOnOpen || isFullyPreloaded || preloadRequested.current) return;

    let cancelled = false;

    const doPreload = async () => {
      setError(null);

      const doPost = () => fetch(`/api/sessions/${sessionId}/facilitator-script/preload`, {
        method: 'POST',
        credentials: 'include',
      });

      try {
        preloadRequested.current = true;
        let res = await doPost();
        if (res.status === 401) {
          await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
          res = await doPost();
        }

        const data = await res.json() as ScriptData & { error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Script preload failed');
        if (!cancelled) setScript(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    };

    doPreload();

    return () => {
      cancelled = true;
    };
  }, [isFullyPreloaded, loaded, preloadAllOnOpen, sessionId]);

  useEffect(() => {
    if (!preloadingAll) return;

    let cancelled = false;
    const timer = setInterval(async () => {
      if (cancelled) return;

      const doGet = () => fetch(`/api/sessions/${sessionId}/facilitator-script`, {
        credentials: 'include',
      });

      try {
        let res = await doGet();
        if (res.status === 401) {
          await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
          res = await doGet();
        }
        if (!res.ok) return;

        const data = await res.json() as ScriptData;
        if (!cancelled) setScript(data);
      } catch {
        // Keep polling; the next interval can recover.
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [preloadingAll, sessionId]);

  const generate = useCallback(async (
    section: string,
    roundNumber?: number,
    injectDetails?: { injectTitle: string; injectNarrative: string; injectPhase: string },
    injectId?: string,
  ) => {
    const key = section === 'round-intro' && roundNumber != null
      ? `intro-${roundNumber}`
      : roundNumber != null
        ? `round-${roundNumber}`
        : section;

    // Guard: already in-flight
    if (generatingRef.current[key]) return;
    generatingRef.current[key] = true;
    setGeneratingKeys(g => ({ ...g, [key]: true }));
    setError(null);

    const body = JSON.stringify({ section, roundNumber, injectId, ...injectDetails });

    const doPost = () => fetch(`/api/sessions/${sessionId}/facilitator-script/generate`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    try {
      let res = await doPost();

      // Access tokens expire after 15 min. On 401 refresh once and retry —
      // mirrors the same pattern used in loadInitialState (GamePage).
      if (res.status === 401) {
        await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
        res = await doPost();
      }

      const data = await res.json() as { script: string; full: ScriptData; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      setScript(data.full);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      generatingRef.current[key] = false;
      setGeneratingKeys(g => ({ ...g, [key]: false }));
    }
  }, [sessionId]);

  // ── Auto-generation: runs whenever any relevant state changes ──────────────
  // Using script fields directly in deps so we re-check after each update.
  // generatingRef (not state) prevents duplicate in-flight calls without stale closures.

  const introKey = `intro-${currentRound}`;
  const debriefKey = `round-${currentRound}`;
  const inject = currentInject ?? pendingAiInject;

  // Opening
  useEffect(() => {
    if (preloadAllOnOpen) return;
    if (!loaded || script.opening || generatingRef.current['opening']) return;
    generate('opening');
  }, [loaded, preloadAllOnOpen, script.opening, generate]);

  // Round intro: fires as soon as inject data arrives for the current round.
  useEffect(() => {
    if (preloadAllOnOpen) return;
    if (!loaded || currentRound <= 0 || !inject) return;
    if (script.roundIntros?.[String(currentRound)] || generatingRef.current[introKey]) return;
    generate('round-intro', currentRound, {
      injectTitle: inject.title,
      injectNarrative: inject.narrative,
      injectPhase: inject.phase,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, preloadAllOnOpen, currentRound, inject?.title, script.roundIntros]);

  // Round after-action: fires as soon as inject data arrives — same trigger as the intro
  // (both start generating when the round begins, not gated on the reveal phase).
  useEffect(() => {
    if (preloadAllOnOpen) return;
    if (!loaded || currentRound <= 0 || !inject) return;
    if (script.rounds?.[String(currentRound)] || generatingRef.current[debriefKey]) return;
    generate('round', currentRound, {
      injectTitle: inject.title,
      injectNarrative: inject.narrative,
      injectPhase: inject.phase,
    }, currentInject?.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, preloadAllOnOpen, currentRound, inject?.title, script.rounds, currentInject?.id]);

  // Closing — fires when the final round becomes active so the script is ready
  // before the facilitator clicks "End Session". Also fires if isSessionEnded is
  // true (fallback for any edge-case where the round count isn't set).
  const isLastRound = totalRounds > 0 && currentRound > 0 && currentRound >= totalRounds;
  useEffect(() => {
    if (!loaded || (!isLastRound && !isSessionEnded) || script.closing || generatingRef.current['closing']) return;
    generate('closing');
  }, [loaded, isLastRound, isSessionEnded, script.closing, generate]);

  // Determine which rounds to show cards for
  const preloadRoundNums = preloadAllOnOpen && totalRounds > 0
    ? Array.from({ length: totalRounds }, (_, index) => index + 1)
    : [];
  const allRoundNums = new Set([
    ...preloadRoundNums,
    ...Object.keys(script.roundIntros ?? {}).map(Number),
    ...Object.keys(script.rounds ?? {}).map(Number),
    ...(currentRound > 0 ? [currentRound] : []),
  ].filter(Boolean));
  const roundCards = Array.from(allRoundNums).sort((a, b) => a - b);

  return (
    <div className="flex-1 flex flex-col bg-slate-900 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 shrink-0">
        <ScrollText className="w-4 h-4 text-amber-400" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-white">Facilitator Script</h2>
          <p className="text-xs text-slate-500 truncate">AI talking points — auto-updates each round</p>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          {error}
        </div>
      )}

      {preloadingAll && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
          Building the facilitator script in order so you can begin immediately: opening, rounds, then closing…
        </div>
      )}

      <div className="overflow-y-auto flex-1 px-4 py-4 space-y-3">
        {!loaded ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading script…</span>
          </div>
        ) : (
          <>
            {/* Opening */}
            <ScriptCard
              title="Opening Script"
              subtitle="Welcome, ground rules, and scenario introduction"
              content={script.opening}
              isGenerating={(preloadingAll && !script.opening) || !!generatingKeys['opening']}
              onRegenerate={() => generate('opening')}
              accentColor="bg-slate-800 border-blue-500/30"
              defaultExpanded={true}
              emptyMessage={preloadAllOnOpen
                ? 'Opening script is being prepared first so the facilitator can begin right away.'
                : undefined}
            />

            {roundCards.length === 0 && (
              <div className="text-xs text-slate-600 text-center py-3 border border-slate-700/50 rounded-xl">
                {preloadAllOnOpen
                  ? 'Round scripts will appear here progressively as background generation reaches each section'
                  : 'Round scripts will appear here automatically as each round starts'}
              </div>
            )}

            {/* Two cards per round: intro + debrief */}
            {roundCards.map(roundNum => (
              <div key={roundNum} className="space-y-2">
                {/* Round intro — auto-generates when inject is presented */}
                <ScriptCard
                  title={`Round ${roundNum} — Introduction`}
                  subtitle="Set the scene and open discussion before players decide"
                  content={script.roundIntros?.[String(roundNum)] ?? null}
                  isGenerating={(preloadingAll && !script.roundIntros?.[String(roundNum)]) || !!generatingKeys[`intro-${roundNum}`]}
                  onRegenerate={() => {
                    // Use current inject data if this is the active round; otherwise
                    // we can't regenerate without inject context (no-op for past rounds).
                    const activeInject = currentRound === roundNum
                      ? (currentInject ?? pendingAiInject)
                      : null;
                    if (activeInject) {
                      generate('round-intro', roundNum, {
                        injectTitle: activeInject.title,
                        injectNarrative: activeInject.narrative,
                        injectPhase: activeInject.phase,
                      });
                    }
                  }}
                  accentColor="bg-slate-800 border-sky-500/30"
                  defaultExpanded={roundNum === currentRound && gamePhase === 'inject'}
                  emptyMessage={preloadAllOnOpen
                    ? 'This round introduction will appear automatically as background generation reaches it.'
                    : undefined}
                />

                {/* Round debrief — auto-generates after reveal */}
                <ScriptCard
                  title={`Round ${roundNum} — After Action`}
                  subtitle="Best answer, team scores, and teaching points after reveal"
                  content={script.rounds?.[String(roundNum)] ?? null}
                  isGenerating={(preloadingAll && !script.rounds?.[String(roundNum)]) || !!generatingKeys[`round-${roundNum}`]}
                  onRegenerate={() => {
                    // Pass inject details when this is the active/revealed round so
                    // the backend can fall back to no-decisions generation if needed.
                    const activeInject = roundNum === currentRound
                      ? (currentInject ?? pendingAiInject)
                      : null;
                    if (activeInject) {
                      generate('round', roundNum, {
                        injectTitle: activeInject.title,
                        injectNarrative: activeInject.narrative,
                        injectPhase: activeInject.phase,
                      }, currentInject?.id);
                    } else {
                      // Past round — rely on backend strategy (decisions lookup by inject order)
                      generate('round', roundNum);
                    }
                  }}
                  accentColor="bg-slate-800 border-emerald-500/30"
                  defaultExpanded={roundNum === currentRound && gamePhase === 'reveal'}
                  emptyMessage={preloadAllOnOpen
                    ? 'This after-action script will appear automatically after the introduction for this round is prepared.'
                    : undefined}
                />
              </div>
            ))}

            {/* Closing */}
            <ScriptCard
              title="Closing Script"
              subtitle="Exercise wrap-up, lessons learned, and next steps"
              content={script.closing}
              isGenerating={(preloadingAll && !script.closing) || !!generatingKeys['closing']}
              onRegenerate={() => generate('closing')}
              accentColor="bg-slate-800 border-amber-500/30"
              defaultExpanded={isSessionEnded}
              emptyMessage={preloadAllOnOpen
                ? 'Closing script will appear after the opening and round scripts finish populating.'
                : undefined}
            />
          </>
        )}
      </div>
    </div>
  );
}
