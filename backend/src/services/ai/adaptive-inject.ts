import Anthropic from '@anthropic-ai/sdk';
import { jsonrepair } from 'jsonrepair';
import { logger } from '../logger';
import { getTemplateContent, applyTemplate } from '../prompt-templates';
import { getAISettings } from '../ai-config';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OnboardingAnswers {
  orgName?: string;
  industry?: string;
  orgSize?: string;
  maturity?: number;
  compliance?: string[];
  crownJewels?: string;
  focusArea?: string;
  experience?: string;
  recentIncident?: string;
  primaryThreat?: string;
  rolesPresent?: string[];
  divisionNames?: string[];
  orgWebsite?: string;
  websiteSummary?: string;
  orgContextNotes?: string;
}

export interface InjectHistoryEntry {
  roundNumber: number;
  injectTitle: string;
  narrative: string;
  phase: string;
  decisions: Array<{
    role: string;
    chosenOption: string;
    score: number;
    isOptimal: boolean;
  }>;
  avgScore: number;
}

export interface AdaptiveInjectContext {
  scenarioType: string;
  difficulty: string;
  objectives: string[];
  onboardingAnswers: OnboardingAnswers;
  history: InjectHistoryEntry[];
  roundNumber: number;
  totalRounds: number;      // 0 = unlimited
  isLastRound: boolean;     // true = force recovery/post-incident narrative
}

export interface GeneratedOption {
  text: string;
  scoreWeight: number;
  isOptimal: boolean;
  scriptedFeedback: string;
  feedbackTags: string[];
}

export interface GeneratedInject {
  title: string;
  narrative: string;
  phase: string;
  contextNote?: string;
  nistCsfFunction: string;
  mitreAttackId?: string;
  mitreAttackName?: string;
  timerSeconds?: number | null;
  options: GeneratedOption[];
}

export interface AIDebriefContext {
  scenarioType: string;
  scenarioTitle: string;
  onboardingAnswers: OnboardingAnswers;
  history: InjectHistoryEntry[];
  nistGaps: Array<{ function: string; avgScore: number; strength: string }>;
  participants: Array<{
    displayName: string;
    assignedRole: string;
    totalScore: number;
    optimalCount: number;
    decisionCount: number;
  }>;
  overallOptimalRate: number;
  sessionDurationMinutes: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getClient(apiKey?: string): Anthropic {
  return new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
}

/** Call Ollama and return the raw response text. */
async function generateWithOllama(systemPrompt: string, userPrompt: string): Promise<string> {
  const cfg = await getAISettings();
  const { baseUrl, model, apiKey, temperature, numPredict, numCtx } = cfg.ollama;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      prompt: combinedPrompt,
      stream: false,
      options: { temperature, num_predict: numPredict, num_ctx: numCtx },
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Ollama request failed: ${response.status} ${response.statusText} — ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as { response: string; done_reason?: string; eval_count?: number };
  logger.info('Ollama raw response', {
    length: data.response?.length,
    done_reason: data.done_reason,
    eval_count: data.eval_count,
    preview: data.response?.slice(-300), // last 300 chars to see if truncated
  });
  return data.response.trim();
}

function maturityLabel(level: number): string {
  return ['', 'Ad hoc', 'Developing', 'Defined', 'Managed', 'Optimized'][level] ?? String(level);
}

function buildOrgContext(answers: OnboardingAnswers): string {
  const parts: string[] = [];
  if (answers.orgName) parts.push(`Organization: ${answers.orgName}`);
  if (answers.industry) parts.push(`Industry: ${answers.industry}`);
  if (answers.orgSize) parts.push(`Size: ${answers.orgSize}`);
  if (answers.maturity) parts.push(`Security Maturity: ${answers.maturity}/5 (${maturityLabel(answers.maturity)})`);
  if (answers.compliance?.length) parts.push(`Compliance: ${answers.compliance.join(', ')}`);
  if (answers.crownJewels) {
    const jewels = Array.isArray(answers.crownJewels) ? (answers.crownJewels as string[]).join(', ') : answers.crownJewels;
    if (jewels) parts.push(`Crown Jewels: ${jewels}`);
  }
  if (answers.primaryThreat) parts.push(`Primary Threat Concern: ${answers.primaryThreat}`);
  if (answers.focusArea) parts.push(`Learning Focus: ${answers.focusArea}`);
  if (answers.rolesPresent?.length) parts.push(`Response Roles / Teams: ${answers.rolesPresent.join(', ')}`);
  if (answers.divisionNames?.length) parts.push(`Business Divisions: ${answers.divisionNames.join(', ')}`);
  if (answers.orgWebsite) parts.push(`Organization Website: ${answers.orgWebsite}`);
  if (answers.websiteSummary) parts.push(`Website Context: ${answers.websiteSummary}`);
  if (answers.orgContextNotes) parts.push(`Additional Organization Notes: ${answers.orgContextNotes}`);
  return parts.join('\n');
}

/** Full history — used for debrief and single-call Claude path */
function buildHistoryBlock(history: InjectHistoryEntry[]): string {
  if (!history.length) return 'This is the first round — no prior decisions.';
  return history
    .map(h => {
      const decisionLines = h.decisions
        .map(d => `  - ${d.role}: "${d.chosenOption}" (${d.score}/100${d.isOptimal ? ', optimal' : ''})`)
        .join('\n');
      return `--- ROUND ${h.roundNumber} [${h.phase}] "${h.injectTitle}" | Team avg: ${h.avgScore}/100 ---
WHAT HAPPENED: ${h.narrative}
TEAM DECISIONS:
${decisionLines}`;
    })
    .join('\n\n');
}

/** Compact history — used in pipeline narrative prompt to keep input small and fast */
function buildCompactHistory(history: InjectHistoryEntry[]): string {
  if (!history.length) return 'Round 1 — no prior history.';
  return history
    .map(h => {
      const decisions = h.decisions.map(d => `"${d.chosenOption}" (${d.score}/100)`).join('; ');
      return `Round ${h.roundNumber} [${h.phase}] "${h.injectTitle}" — avg score: ${h.avgScore}/100. Team chose: ${decisions}.`;
    })
    .join('\n');
}

/** Apply post-processing to a fully assembled inject: strip markdown, fix truncation, ensure question ending. */
export function cleanInject(inject: GeneratedInject): GeneratedInject {
  const stripMd = (s: string) => s.replace(/\*\*(.+?)\*\*/gs, '$1').replace(/\*(.+?)\*/gs, '$1');

  inject.title = stripMd(inject.title);
  // Convert literal \n escape sequences that some LLMs emit as text (e.g. "para one\n\npara two")
  // into real newline characters so the UI renders actual paragraph breaks.
  inject.narrative = stripMd(inject.narrative.replace(/\\n/g, '\n').trim());
  if (!inject.narrative.endsWith('?')) {
    inject.narrative += ' What should the team do next?';
  }

  const hasOptimal = inject.options.some(o => o.isOptimal);
  if (!hasOptimal && inject.options.length) {
    const maxScore = Math.max(...inject.options.map(o => o.scoreWeight));
    const best = inject.options.find(o => o.scoreWeight === maxScore);
    if (best) best.isOptimal = true;
  }

  for (const opt of inject.options) {
    opt.text = stripMd(opt.text);
    if (opt.scriptedFeedback) {
      opt.scriptedFeedback = stripMd(opt.scriptedFeedback.trim());
      if (!/[.!?]$/.test(opt.scriptedFeedback)) {
        const lastComplete = opt.scriptedFeedback.match(/^(.*[.!?])/s);
        opt.scriptedFeedback = lastComplete ? lastComplete[1].trim() : opt.scriptedFeedback + '.';
      }
    }
  }

  // Shuffle options so the correct answer is never predictably in position 1
  for (let i = inject.options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [inject.options[i], inject.options[j]] = [inject.options[j], inject.options[i]];
  }

  return inject;
}

function parseGeneratedInject(raw: string): GeneratedInject {
  // Strip markdown code fences
  let cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();

  // Use jsonrepair for robust fixing of unescaped quotes, trailing commas, etc.
  try {
    cleaned = jsonrepair(cleaned);
  } catch {
    // Continue with original — JSON.parse will give a meaningful error if it fails
  }

  const parsed = JSON.parse(cleaned) as GeneratedInject;

  // Basic validation
  if (!parsed.title || !parsed.narrative || !parsed.options?.length) {
    throw new Error('Generated inject missing required fields');
  }
  if (parsed.options.length < 2 || parsed.options.length > 6) {
    throw new Error(`Expected 2-6 options, got ${parsed.options.length}`);
  }

  return cleanInject(parsed);
}

// ── Adaptive Inject Generation ───────────────────────────────────────────────

// Loaded from DB at call time (30 s cache) so admins can edit without redeploy

function buildInjectPrompt(ctx: AdaptiveInjectContext): string {
  const strongFunctions = ctx.history
    .flatMap(h => h.decisions)
    .filter(d => d.score >= 70)
    .map(d => d.role);

  const weakAreas = ctx.history
    .filter(h => h.avgScore < 50)
    .map(h => h.phase);

  const roundLabel = ctx.isLastRound
    ? `Round ${ctx.roundNumber} of ${ctx.totalRounds} (FINAL ROUND)`
    : ctx.totalRounds > 0
      ? `Round ${ctx.roundNumber} of ${ctx.totalRounds}`
      : `Round ${ctx.roundNumber}`;

  const isSecondToLastRound = ctx.totalRounds > 0 && ctx.roundNumber === ctx.totalRounds - 1;

  const firstRoundInstructions = ctx.roundNumber === 1 ? `
THIS IS THE FIRST ROUND — INITIAL DISCOVERY:
- phase MUST be "DETECT" or "IDENTIFY"
- nistCsfFunction MUST be "DETECT"
- The narrative must depict the very first moment the incident is discovered — an alert firing, an employee noticing something anomalous, a system behaving unexpectedly, or an external tip
- Set the scene: time of day, who discovered it, what they saw, and the immediate uncertainty about whether this is real
- Decision options must focus on: initial triage, who to notify first, whether to escalate immediately, and how to begin scoping the problem
- Do NOT assume containment, eradication, or any advanced IR steps have occurred yet — this is minute zero` : ctx.isLastRound ? `
THIS IS THE FINAL ROUND — RECOVERY & POST-INCIDENT:
- phase MUST be "RECOVER"
- nistCsfFunction MUST be "RECOVER"
- The active attack/threat is OVER. The attacker has been evicted or contained. Do NOT describe ongoing exfiltration, active attacker movement, or continued compromise.
- The narrative must be set AFTER the incident: systems are being restored, the team is exhausted but the immediate crisis has passed, and attention shifts to recovery and accountability
- Write about: bringing systems back online, validating backups, notifying leadership and regulators, scheduling a lessons-learned meeting, and hardening recommendations
- Decision options must focus on: post-incident review scheduling, evidence preservation for forensics, regulatory/legal notification completion, and long-term hardening recommendations
- Tone should be reflective and forward-looking, not urgent or crisis-driven` : isSecondToLastRound ? `
THIS IS THE SECOND-TO-LAST ROUND — DE-ESCALATION & ERADICATION:
- phase MUST be "ERADICATE" or "CONTAIN"
- nistCsfFunction MUST be "RESPOND"
- The team has gained the upper hand. The attacker's persistence mechanisms are being identified and removed.
- The narrative should show the tide turning: the threat actor's access is being cut off, affected systems are being isolated or rebuilt, and the immediate danger is subsiding
- Write about: completing eradication of malware/backdoors, validating that all persistence mechanisms are removed, preparing for restoration, and initial communication to leadership that the active threat is under control
- Decision options must focus on: final eradication steps, validating clean systems before restoration, forensic evidence preservation, and notifying stakeholders that the crisis phase is ending
- Tone should shift from urgent/crisis to controlled and methodical — the team is wrapping up the active response` : `
- Advance the incident narrative logically from the previous inject
- Escalate pressure on weak areas without being punitive`;

  return `ORGANIZATION CONTEXT:
${buildOrgContext(ctx.onboardingAnswers)}

SCENARIO: ${ctx.scenarioType} incident | Difficulty: ${ctx.difficulty}
OBJECTIVES: ${ctx.objectives.join('; ')}

EXERCISE HISTORY:
${buildHistoryBlock(ctx.history)}

PERFORMANCE NOTES:
- Rounds with weak performance (avg < 50): ${weakAreas.length ? weakAreas.join(', ') : 'None yet'}
- Overall trend: ${ctx.history.length === 0 ? 'Starting fresh' : `Avg score across ${ctx.history.length} rounds: ${Math.round(ctx.history.reduce((s, h) => s + h.avgScore, 0) / ctx.history.length)}/100`}

INSTRUCTIONS FOR ${roundLabel}:${firstRoundInstructions}
- CONTINUITY: Your narrative MUST directly continue from where round ${ctx.roundNumber - 1} left off. Name the same systems, threat actors, data types, and people mentioned in prior rounds.
- ESCALATION: The situation must be worse or more complex than the previous round. The attacker has moved, discovered something new, or the blast radius has grown. Something has changed since the last decision.
- CONSEQUENCES: If the team made poor decisions (low scores), the situation has gotten worse because of it. If they made good decisions, they may have contained one vector but a new one has emerged.
- VARIETY: Write the narrative with a fresh angle — different time of day, different people involved, different systems affected. Avoid repeating the same sentence patterns from prior rounds.
- QUESTION: The narrative MUST end with a direct question that the team must answer. This question should frame the decision the options respond to. Example endings: "What is the team's immediate priority?" / "How should the incident commander respond?" / "What does the team do next?" — make it specific to the situation, not generic.
- Keep the scenario realistic and specific to the organization's context
- Generate exactly 4 decision options with varied score weights (one optimal 85-95, one good 55-75, one poor 20-40, one bad 0-15)
- CRITICAL: Place the 4 options in a RANDOM order — do NOT put the optimal option first or in any predictable position
- Each option must use a DIFFERENT sentence structure and action verb — avoid starting multiple options with the same word or phrase
- Option wording styles to vary across: direct commands ("Isolate the affected systems"), questions reframed as decisions ("Notify legal and wait for guidance"), passive/reactive ("Continue monitoring while escalating"), institutional/bureaucratic ("Convene an emergency change advisory board")
- Each option's scriptedFeedback should be 3-5 sentences with detailed reasoning referencing NIST CSF, MITRE ATT&CK, or PICERL. Do NOT use markdown formatting (no **bold**, no *italics*). Plain text only. Every sentence must be complete — never end mid-thought.

Respond with ONLY this JSON structure (note: optimal is at position 3 in this EXAMPLE only — place yours randomly):
{
  "title": "Short inject title (5-10 words)",
  "narrative": "2-3 paragraph vivid situation description, specific to org context and prior decisions",
  "phase": "One of: PREPARE, IDENTIFY, DETECT, CONTAIN, ERADICATE, RECOVER, COMMUNICATE, LEGAL",
  "contextNote": "1 sentence: how the team's prior decisions directly led to this situation (omit if round 1)",
  "nistCsfFunction": "One of: IDENTIFY, PROTECT, DETECT, RESPOND, RECOVER",
  "mitreAttackId": "T#### format or null",
  "mitreAttackName": "MITRE technique name or null",
  "timerSeconds": null,
  "options": [
    { "text": "Option text", "scoreWeight": 25, "isOptimal": false, "scriptedFeedback": "...", "feedbackTags": ["common-mistake"] },
    { "text": "Option text", "scoreWeight": 5,  "isOptimal": false, "scriptedFeedback": "...", "feedbackTags": ["legal-risk"] },
    { "text": "Option text (concise action)", "scoreWeight": 90, "isOptimal": true, "scriptedFeedback": "...", "feedbackTags": ["best-practice"] },
    { "text": "Option text", "scoreWeight": 65, "isOptimal": false, "scriptedFeedback": "...", "feedbackTags": [] }
  ]
}`;
}

// ── Pipeline helpers ─────────────────────────────────────────────────────────

function extractJson(raw: string): string {
  // Strip markdown code fences
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  let s = fenced ? fenced[1].trim() : raw.trim();

  // Isolate outermost JSON object or array
  const firstBrace  = s.indexOf('{');
  const firstBracket = s.indexOf('[');
  let start = -1;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    const end = s.lastIndexOf('}');
    if (end > start) s = s.slice(start, end + 1);
  } else if (firstBracket !== -1) {
    start = firstBracket;
    const end = s.lastIndexOf(']');
    if (end > start) s = s.slice(start, end + 1);
  }

  // Use jsonrepair to fix all common LLM JSON mistakes:
  // - unescaped double quotes inside strings
  // - trailing commas
  // - missing commas between objects
  // - truncated JSON
  // - unescaped newlines and special characters
  try {
    return jsonrepair(s);
  } catch {
    // jsonrepair failed — return cleaned string and let JSON.parse give the real error
    return s;
  }
}

async function ollamaCall(prompt: string): Promise<string> {
  const systemPrompt = await getTemplateContent('pipeline_system');
  const raw = await generateWithOllama(systemPrompt, prompt);
  return extractJson(raw);
}

/** Call ollamaCall with up to maxAttempts retries on JSON parse failure. */
async function ollamaCallWithRetry(prompt: string, maxAttempts = 3): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ollamaCall(prompt);
    } catch (err) {
      lastError = err;
      logger.warn(`ollamaCall attempt ${attempt}/${maxAttempts} failed`, { error: String(err) });
      if (attempt < maxAttempts) {
        // Brief pause before retry
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
  }
  throw lastError;
}

// ── Round instructions block (shared by Step 1 template) ─────────────────────
function buildRoundInstructions(ctx: AdaptiveInjectContext): string {
  if (ctx.roundNumber === 1) {
    return '\nThis is the FIRST round — write the initial discovery of the incident. Phase must be DETECT.';
  }
  if (ctx.isLastRound) {
    return '\nThis is the FINAL round — write the post-incident recovery phase. Phase must be RECOVER.';
  }
  if (ctx.totalRounds > 0 && ctx.roundNumber === ctx.totalRounds - 1) {
    return '\nThis is the SECOND-TO-LAST round — the team is gaining the upper hand. Write the eradication/de-escalation phase.';
  }
  return '\nContinue the incident narrative from the prior round. Escalate the situation — the attacker advances or the blast radius grows.';
}

// Step 1 — Generate narrative + metadata
export async function generateNarrative(ctx: AdaptiveInjectContext): Promise<{
  title: string; narrative: string; phase: string; contextNote?: string;
  nistCsfFunction: string; mitreAttackId?: string; mitreAttackName?: string; timerSeconds?: number | null;
}> {
  const template = await getTemplateContent('adaptive_narrative_prompt');
  const roundLabel = ctx.totalRounds > 0 ? `${ctx.roundNumber} of ${ctx.totalRounds}` : String(ctx.roundNumber);
  const prompt = applyTemplate(template, {
    ORG_CONTEXT:        buildOrgContext(ctx.onboardingAnswers) ? buildOrgContext(ctx.onboardingAnswers) + '\n\n' : '',
    SCENARIO_TYPE:      ctx.scenarioType,
    DIFFICULTY:         ctx.difficulty,
    HISTORY:            buildCompactHistory(ctx.history),
    ROUND_LABEL:        roundLabel,
    ROUND_INSTRUCTIONS: buildRoundInstructions(ctx),
  });

  const raw = await ollamaCallWithRetry(prompt);
  return JSON.parse(raw);
}

// Step 2 — Generate decision options (text + scores only, no feedback yet)
export async function generateOptions(narrative: string, phase: string, roundNumber: number): Promise<Array<{
  text: string; scoreWeight: number; isOptimal: boolean;
}>> {
  const template = await getTemplateContent('adaptive_options_prompt');
  const prompt = applyTemplate(template, {
    NARRATIVE: narrative,
    PHASE:     phase,
    ROUND:     String(roundNumber),
  });

  const raw = await ollamaCallWithRetry(prompt);
  const parsed = JSON.parse(raw) as { options: Array<{ text: string; scoreWeight: number; isOptimal: boolean }> };
  return parsed.options;
}

// Step 3 — Generate feedback for all options
export async function generateFeedback(narrative: string, options: Array<{ text: string; scoreWeight: number; isOptimal: boolean }>): Promise<Array<{
  scriptedFeedback: string; feedbackTags: string[];
}>> {
  const optionList = options.map((o, i) => `Option ${i + 1}: "${o.text}" (score: ${o.scoreWeight}, optimal: ${o.isOptimal})`).join('\n');
  const template = await getTemplateContent('adaptive_feedback_prompt');
  const prompt = applyTemplate(template, {
    NARRATIVE: narrative,
    OPTIONS:   optionList,
  });

  const raw = await ollamaCallWithRetry(prompt);
  const parsed = JSON.parse(raw) as { feedback: Array<{ scriptedFeedback: string; feedbackTags: string[] }> };
  return parsed.feedback;
}

export async function generateAdaptiveInject(ctx: AdaptiveInjectContext): Promise<GeneratedInject> {
  logger.info('Generating adaptive inject', {
    round: ctx.roundNumber,
    scenarioType: ctx.scenarioType,
    historyLength: ctx.history.length,
  });

  const aiCfg = await getAISettings();
  if (aiCfg.activeProvider === 'ollama') {
    logger.info('Using Ollama pipeline for inject generation', {
      baseUrl: aiCfg.ollama.baseUrl,
      model: aiCfg.ollama.model,
    });

    // ── 3-step pipeline ────────────────────────────────────────────────────
    logger.info('Pipeline step 1: generating narrative');
    const narrativePart = await generateNarrative(ctx);

    logger.info('Pipeline step 2: generating options', { title: narrativePart.title });
    const options = await generateOptions(narrativePart.narrative, narrativePart.phase, ctx.roundNumber);

    logger.info('Pipeline step 3: generating feedback');
    const feedbackParts = await generateFeedback(narrativePart.narrative, options);

    // Merge all parts into final inject
    const merged: GeneratedInject = {
      ...narrativePart,
      options: options.map((opt, i) => ({
        ...opt,
        scriptedFeedback: feedbackParts[i]?.scriptedFeedback ?? '',
        feedbackTags: feedbackParts[i]?.feedbackTags ?? [],
      })),
    };

    const inject = parseGeneratedInject(JSON.stringify(merged));
    logger.info('Adaptive inject generated via pipeline', { title: inject.title, phase: inject.phase });
    return inject;

  } else if (aiCfg.activeProvider === 'anthropic' && aiCfg.anthropic.apiKey) {
    // ── Claude path (single call — Claude handles long JSON reliably) ──────
    const injectSystemPrompt = await getTemplateContent('adaptive_inject_system');
    const client = getClient(aiCfg.anthropic.apiKey);
    const model = aiCfg.anthropic.model;
    const message = await client.messages.create({
      model,
      max_tokens: aiCfg.anthropic.maxTokens,
      system: injectSystemPrompt,
      messages: [{ role: 'user', content: buildInjectPrompt(ctx) }],
    });
    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    try {
      const inject = parseGeneratedInject(raw);
      logger.info('Adaptive inject generated', { title: inject.title, phase: inject.phase });
      return inject;
    } catch (parseErr) {
      logger.error('Failed to parse generated inject', { error: String(parseErr), raw: raw.slice(0, 500) });
      throw new Error(`AI response could not be parsed as inject JSON: ${String(parseErr)}`);
    }
  } else {
    throw new Error('No AI provider configured. Set AI_PROVIDER=ollama or ANTHROPIC_API_KEY.');
  }
}

// ── AI Debrief Narrative ──────────────────────────────────────────────────────

function buildDebriefPrompt(ctx: AIDebriefContext): string {
  const participantLines = ctx.participants
    .map(p => `  - ${p.displayName} (${p.assignedRole}): ${p.totalScore} pts, ${p.optimalCount}/${p.decisionCount} optimal decisions`)
    .join('\n');

  const gapLines = ctx.nistGaps
    .map(g => `  - ${g.function}: ${Math.round(g.avgScore)}/100 (${g.strength})`)
    .join('\n');

  const historyLines = ctx.history
    .map(h => `  Round ${h.roundNumber} "${h.injectTitle}": avg ${h.avgScore}/100`)
    .join('\n');

  return `EXERCISE OVERVIEW:
- Organization: ${ctx.onboardingAnswers.orgName || 'Unnamed Organization'}
- Industry: ${ctx.onboardingAnswers.industry || 'Not specified'}
- Website Context: ${ctx.onboardingAnswers.websiteSummary || 'Not provided'}
- Business Divisions: ${ctx.onboardingAnswers.divisionNames?.join(', ') || 'Not specified'}
- Response Roles / Teams: ${ctx.onboardingAnswers.rolesPresent?.join(', ') || 'Not specified'}
- Scenario: ${ctx.scenarioTitle} (${ctx.scenarioType})
- Duration: ${ctx.sessionDurationMinutes} minutes
- Overall Optimal Decision Rate: ${Math.round(ctx.overallOptimalRate)}%

PARTICIPANTS:
${participantLines}

INJECT PERFORMANCE SUMMARY:
${historyLines}

NIST CSF FUNCTION SCORES:
${gapLines}

Write a 4-6 paragraph After Action Assessment covering:
1. Overall team performance and exercise summary (1 paragraph)
2. Demonstrated strengths — specific rounds or decisions where the team excelled (1-2 paragraphs)
3. Identified gaps and improvement areas — specific NIST CSF functions or IR phases that need work, with evidence from the exercise (1-2 paragraphs)
4. Prioritized recommendations — top 3-5 specific, actionable next steps tied to the gaps (1 paragraph)

Reference NIST SP 800-61r2, NIST CSF, and PICERL where applicable.
Be specific — mention actual inject names, decision patterns, and scores.
Do not use bullet points — write in formal paragraph prose only.`;
}

export async function generateAIDebrief(ctx: AIDebriefContext): Promise<string> {
  logger.info('Generating AI debrief narrative', { sessionType: ctx.scenarioType });

  try {
    let text = '';

    const debriefSystemPrompt = await getTemplateContent('ai_debrief_system');
    const debriefCfg = await getAISettings();
    if (debriefCfg.activeProvider === 'ollama') {
      text = await generateWithOllama(debriefSystemPrompt, buildDebriefPrompt(ctx));
    } else if (debriefCfg.activeProvider === 'anthropic' && debriefCfg.anthropic.apiKey) {
      const client = getClient(debriefCfg.anthropic.apiKey);
      const model = debriefCfg.anthropic.model;
      const message = await client.messages.create({
        model,
        max_tokens: debriefCfg.anthropic.maxTokens,
        system: debriefSystemPrompt,
        messages: [{ role: 'user', content: buildDebriefPrompt(ctx) }],
      });
      text = message.content[0].type === 'text' ? message.content[0].text : '';
    } else {
      logger.warn('No AI provider configured — skipping AI debrief generation');
      return '';
    }

    logger.info('AI debrief generated', { length: text.length });
    return text;
  } catch (err) {
    logger.error('Failed to generate AI debrief', { error: String(err) });
    return ''; // fail gracefully — debrief still works without AI narrative
  }
}
