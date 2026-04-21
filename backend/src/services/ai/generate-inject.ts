/**
 * AI Inject-by-Inject Generation Service
 *
 * Generates scenario setup and individual injects as separate requests so the
 * frontend can show real-time progress (one API call per round, ~20-30s each)
 * rather than one giant blocking call that times out.
 */

import Anthropic from '@anthropic-ai/sdk';
import { jsonrepair } from 'jsonrepair';
import { logger } from '../logger';
import {
  AiScenarioType,
  AiDifficulty,
  GeneratedInject,
  GeneratedOption,
  SCENARIO_LABELS,
  DIFFICULTY_GUIDANCE,
  NIST_FUNCTIONS,
  pickPhases,
} from './generate-scenario';
import { getTemplateContent, applyTemplate } from '../prompt-templates';
import { getAISettings } from '../ai-config';
import {
  generateNarrative,
  generateOptions,
  generateFeedback as generateOptionFeedback,
  AdaptiveInjectContext,
} from './adaptive-inject';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ScenarioSetup {
  title: string;
  description: string;
  objectives: string[];
  phases: string[]; // length === rounds
}

export interface InjectContext {
  phase: string;
  title: string;
  narrative: string; // included so subsequent injects can continue the story
}

export interface OrgContext {
  orgName?: string;   // e.g. "Acme Corp"
  industry?: string;  // e.g. "Healthcare", "Financial Services"
  crownJewels?: string[];
  roleNames?: string[];
  divisionNames?: string[];
  websiteUrl?: string;
  websiteSummary?: string;
  orgContextNotes?: string;
}

// ─── Prompt builders (async — fetch editable templates from DB) ───────────────

async function buildSetupPrompt(
  type: AiScenarioType,
  difficulty: AiDifficulty,
  rounds: number,
  orgContext?: OrgContext,
): Promise<string> {
  const phases = pickPhases(rounds);
  const template = await getTemplateContent('setup_prompt');

  const hasOrgContext = Boolean(
    orgContext?.orgName
    || orgContext?.industry
    || orgContext?.crownJewels?.length
    || orgContext?.roleNames?.length
    || orgContext?.divisionNames?.length
    || orgContext?.websiteSummary
    || orgContext?.orgContextNotes,
  );
  const orgLabel = orgContext?.orgName || 'the target organization';
  const industryLabel = orgContext?.industry || 'its sector';
  const crownJewelsList = orgContext?.crownJewels?.join(', ') || '';
  const roleNamesList = orgContext?.roleNames?.join(', ') || '';
  const divisionNamesList = orgContext?.divisionNames?.join(', ') || '';
  const websiteSummary = orgContext?.websiteSummary?.trim() || '';
  const orgNotes = orgContext?.orgContextNotes?.trim() || '';
  const orgBlock = hasOrgContext
    ? `Organization: ${orgContext?.orgName || 'Not specified'} | Industry: ${orgContext?.industry || 'Not specified'}${crownJewelsList ? ` | Crown Jewels: ${crownJewelsList}` : ''}\n` +
      `Tailor this scenario specifically for ${orgLabel}, a ${industryLabel} organization. ` +
      `Use your knowledge of ${orgLabel}'s business operations, realistic ${industryLabel} infrastructure, ` +
      `applicable regulatory requirements (e.g., HIPAA/HITECH for healthcare, PCI-DSS for retail/finance, ` +
      `NERC CIP for energy, FERPA for education, CMMC for defense), known threat actors targeting the ` +
      `${industryLabel} sector, and sector-specific data types, crown jewels, and business impact. ` +
      `${crownJewelsList ? `The most important assets/data types to protect are: ${crownJewelsList}. ` : ''}` +
      `${divisionNamesList ? `The organization's important business units or divisions include: ${divisionNamesList}. ` : ''}` +
      `${roleNamesList ? `The response team roles or teams to naturally reference include: ${roleNamesList}. ` : ''}` +
      `${websiteSummary ? `Website-derived organization context: ${websiteSummary}. ` : ''}` +
      `${orgNotes ? `Additional organization notes: ${orgNotes}. ` : ''}` +
      `Do not default to healthcare, EHR systems, or medical records unless the provided industry or crown-jewel assets explicitly support that.\n\n`
    : '';

  return applyTemplate(template, {
    SCENARIO_LABEL:      SCENARIO_LABELS[type],
    DIFFICULTY:          difficulty,
    ROUNDS:              String(rounds),
    DIFFICULTY_GUIDANCE: DIFFICULTY_GUIDANCE[difficulty],
    PHASES_JSON:         phases.map((p) => `"${p}"`).join(', '),
    PHASES_LIST:         phases.join(' → '),
    ORG_BLOCK:           orgBlock,
  });
}

async function buildInjectPrompt(
  type: AiScenarioType,
  difficulty: AiDifficulty,
  rounds: number,
  injectIndex: number,
  phase: string,
  setup: { title: string; description: string },
  previousInjects: InjectContext[],
  orgContext?: OrgContext,
): Promise<string> {
  const template = await getTemplateContent('inject_prompt');

  const contextBlock =
    previousInjects.length > 0
      ? `Story so far — you MUST continue directly from the last event:\n${previousInjects
          .map(
            (inj, n) =>
              `  [${n + 1}] ${inj.phase}: "${inj.title}"\n      ${inj.narrative.slice(0, 300).replace(/\n/g, ' ')}`,
          )
          .join('\n')}\n\n`
      : '';

  const continuityInstruction =
    previousInjects.length > 0
      ? `This inject is inject ${injectIndex + 1} of ${rounds}. It MUST continue directly from inject ${injectIndex}. ` +
        `The situation should escalate and evolve — do NOT restart from initial detection. ` +
        `Reference the same systems, hostnames, IP addresses, attacker tools, and personnel established in prior injects.`
      : `This is inject 1 of ${rounds}. Set the scene with a highly specific initial indicator: ` +
        `include an exact timestamp, specific system or hostname, the precise alert or log entry that triggered awareness, ` +
        `and the business context of what was happening at the time.`;

  const orgLine = (
    orgContext?.orgName
    || orgContext?.industry
    || orgContext?.crownJewels?.length
    || orgContext?.roleNames?.length
    || orgContext?.divisionNames?.length
    || orgContext?.websiteSummary
    || orgContext?.orgContextNotes
  )
    ? `Organization: ${orgContext?.orgName || 'Not specified'} | Industry: ${orgContext?.industry || 'Not specified'}${orgContext?.crownJewels?.length ? ` | Crown Jewels: ${orgContext.crownJewels.join(', ')}` : ''}${orgContext?.divisionNames?.length ? ` | Divisions: ${orgContext.divisionNames.join(', ')}` : ''}${orgContext?.roleNames?.length ? ` | Roles: ${orgContext.roleNames.join(', ')}` : ''}\n${orgContext?.websiteSummary ? `Website Context: ${orgContext.websiteSummary}\n` : ''}${orgContext?.orgContextNotes ? `Org Notes: ${orgContext.orgContextNotes}\n` : ''}`
    : '';

  const orgQualityLine = (
    orgContext?.orgName
    || orgContext?.industry
    || orgContext?.crownJewels?.length
    || orgContext?.roleNames?.length
    || orgContext?.divisionNames?.length
    || orgContext?.websiteSummary
    || orgContext?.orgContextNotes
  )
    ? `- Ground the scenario in ${(orgContext?.orgName || 'the organization')}'s ${orgContext?.industry || 'sector'} context${orgContext?.crownJewels?.length ? ` and center the incident on these assets: ${orgContext.crownJewels.join(', ')}` : ''}${orgContext?.divisionNames?.length ? `. Work realistic business pressure from these divisions into the story: ${orgContext.divisionNames.join(', ')}` : ''}${orgContext?.roleNames?.length ? `. Use these response teams or role labels naturally in the scenario: ${orgContext.roleNames.join(', ')}` : ''}${orgContext?.websiteSummary ? `. Reflect the business model and mission implied by this website context: ${orgContext.websiteSummary}` : ''}${orgContext?.orgContextNotes ? `. Respect these additional organization notes: ${orgContext.orgContextNotes}` : ''}`
    : '';

  return applyTemplate(template, {
    SCENARIO_TITLE:         setup.title,
    SCENARIO_DESCRIPTION:   setup.description,
    SCENARIO_LABEL:         SCENARIO_LABELS[type],
    DIFFICULTY:             difficulty,
    ORG_LINE:               orgLine,
    CONTEXT_BLOCK:          contextBlock,
    CONTINUITY_INSTRUCTION: continuityInstruction,
    PHASE:                  phase,
    ORG_QUALITY_LINE:       orgQualityLine,
  });
}

// ─── JSON extraction ──────────────────────────────────────────────────────────

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let raw = fenced ? fenced[1].trim() : text.trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) raw = raw.slice(start, end + 1);
  // Use jsonrepair to fix all LLM JSON issues: bad escapes, trailing commas,
  // truncated output, unquoted keys, single quotes, etc.
  return jsonrepair(raw);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateSetup(raw: unknown, rounds: number): ScenarioSetup {
  if (!raw || typeof raw !== 'object') throw new Error('AI returned invalid setup response');
  const obj = raw as Record<string, unknown>;

  if (typeof obj.title !== 'string' || !obj.title.trim()) throw new Error('Missing scenario title');
  if (typeof obj.description !== 'string' || !obj.description.trim())
    throw new Error('Missing scenario description');
  if (!Array.isArray(obj.objectives) || obj.objectives.length === 0)
    throw new Error('Missing objectives');

  // Use AI-provided phases if count matches, otherwise fall back to pickPhases
  const phases =
    Array.isArray(obj.phases) && obj.phases.length === rounds
      ? (obj.phases as unknown[]).map(String)
      : pickPhases(rounds);

  return {
    title: String(obj.title).slice(0, 200),
    description: String(obj.description).slice(0, 1000),
    objectives: (obj.objectives as unknown[]).map(String).slice(0, 10),
    phases: phases.slice(0, rounds),
  };
}

function validateInject(raw: unknown, injectIndex: number, phase: string): GeneratedInject {
  if (!raw || typeof raw !== 'object')
    throw new Error(`Inject ${injectIndex + 1}: invalid AI response`);
  const i = raw as Record<string, unknown>;

  if (!i.title || !i.narrative)
    throw new Error(`Inject ${injectIndex + 1}: missing title or narrative`);

  const rawOptions = Array.isArray(i.options)
    ? (i.options as Array<Record<string, unknown>>)
    : [];
  if (rawOptions.length < 2)
    throw new Error(`Inject ${injectIndex + 1}: fewer than 2 options returned`);

  // Guarantee at least one optimal option
  const hasOptimal = rawOptions.some((o) => o.isOptimal === true);
  if (!hasOptimal) rawOptions[0] = { ...rawOptions[0], isOptimal: true };

  // Shuffle so the optimal option isn't always in position 0 (Fisher-Yates)
  for (let i = rawOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rawOptions[i], rawOptions[j]] = [rawOptions[j], rawOptions[i]];
  }

  const options: GeneratedOption[] = rawOptions.slice(0, 6).map((opt) => ({
    text: String(opt.text ?? '').slice(0, 500),
    scoreWeight: Math.max(0, Math.min(100, Math.round(Number(opt.scoreWeight) || 0))),
    isOptimal: opt.isOptimal === true,
    scriptedFeedback: String(
      opt.scriptedFeedback ?? 'See the scenario debrief for feedback.',
    ).slice(0, 2000),
    feedbackTags: Array.isArray(opt.feedbackTags) ? opt.feedbackTags.map(String).slice(0, 10) : [],
    consequences: opt.consequences ? String(opt.consequences).slice(0, 500) : null,
  }));

  const nistRaw = String(i.nistCsfFunction ?? '').toUpperCase();
  const nistCsfFunction = (NIST_FUNCTIONS as readonly string[]).includes(nistRaw)
    ? (nistRaw as GeneratedInject['nistCsfFunction'])
    : null;

  return {
    phaseOrder: injectIndex + 1,
    injectOrder: injectIndex + 1,
    phase: String(i.phase ?? phase).slice(0, 100),
    title: String(i.title).slice(0, 200),
    narrative: String(i.narrative).slice(0, 3000),
    mitreAttackId: i.mitreAttackId ? String(i.mitreAttackId).slice(0, 20) : null,
    mitreAttackName: i.mitreAttackName ? String(i.mitreAttackName).slice(0, 200) : null,
    nistCsfFunction,
    options,
  };
}

// ─── Ollama helpers ───────────────────────────────────────────────────────────

function ollamaHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  return headers;
}

const INJECT_TIMEOUT_MS  = 240_000; // 4 min — generous for large cloud models
const SETUP_TIMEOUT_MS   = 120_000; // 2 min

async function ollamaRequest(
  baseUrl: string,
  model: string,
  prompt: string,
  numPredict: number,
  temperature: number,
  timeoutMs: number,
  apiKey?: string,
  useJsonFormat = true,
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    prompt,
    stream: false,
    options: { temperature, num_predict: numPredict },
  };
  if (useJsonFormat) body.format = 'json';

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: ollamaHeaders(apiKey),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Ollama HTTP ${response.status}${errBody ? ': ' + errBody.slice(0, 200) : ''}`);
  }

  const data = (await response.json()) as { response?: string };
  const rawText = data.response?.trim() ?? '';
  if (!rawText) throw new Error('Ollama returned empty response');
  return rawText;
}

// ─── Ollama: setup ────────────────────────────────────────────────────────────

async function setupWithOllama(
  type: AiScenarioType,
  difficulty: AiDifficulty,
  rounds: number,
  orgContext?: OrgContext,
): Promise<ScenarioSetup> {
  const cfg = await getAISettings();
  const { baseUrl, model, apiKey, numPredict } = cfg.ollama;
  const prompt  = await buildSetupPrompt(type, difficulty, rounds, orgContext);

  logger.info('Generating scenario setup via Ollama', {
    type, difficulty, rounds, model,
    orgName: orgContext?.orgName, industry: orgContext?.industry,
  });

  const MAX_ATTEMPTS = 2;
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const rawText = await ollamaRequest(baseUrl, model, prompt, numPredict, 0.7, SETUP_TIMEOUT_MS, apiKey);
      const parsed = JSON.parse(extractJSON(rawText));
      return validateSetup(parsed, rounds);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn('Ollama setup attempt failed', { attempt, error: lastError.message });
    }
  }

  throw new Error(`AI setup generation failed after ${MAX_ATTEMPTS} attempts: ${lastError.message}`);
}

// ─── Ollama: inject (3-step pipeline, same code path as AI-Driven) ───────────

async function injectWithOllama(
  type: AiScenarioType,
  difficulty: AiDifficulty,
  rounds: number,
  injectIndex: number,
  phase: string,
  setup: { title: string; description: string },
  previousInjects: InjectContext[],
  orgContext?: OrgContext,
): Promise<GeneratedInject> {
  logger.info('Generating inject via Ollama (adaptive pipeline)', { type, difficulty, injectIndex, phase });

  // Build an AdaptiveInjectContext so we can reuse the exact same proven pipeline
  // that AI-Driven uses: generateNarrative → generateOptions → generateFeedback.
  // This avoids all custom Ollama calls with format:'json' that caused empty/malformed responses.
  const ctx: AdaptiveInjectContext = {
    scenarioType: SCENARIO_LABELS[type],
    difficulty,
    objectives: [],
    onboardingAnswers: {
      orgName: orgContext?.orgName,
      industry: orgContext?.industry,
      crownJewels: orgContext?.crownJewels?.join(', '),
      rolesPresent: orgContext?.roleNames,
      divisionNames: orgContext?.divisionNames,
      orgWebsite: orgContext?.websiteUrl,
      websiteSummary: orgContext?.websiteSummary,
      orgContextNotes: orgContext?.orgContextNotes,
    },
    history: previousInjects.map((inj, idx) => ({
      roundNumber: idx + 1,
      injectTitle: inj.title,
      narrative: inj.narrative,
      phase: inj.phase,
      decisions: [],
      avgScore: 75, // neutral — no player decisions yet during pre-generation
    })),
    roundNumber: injectIndex + 1,
    totalRounds: rounds,
    isLastRound: injectIndex === rounds - 1,
  };

  // Step 1 — Narrative (uses adaptive_narrative_prompt template, no format:'json')
  const narrativePart = await generateNarrative(ctx);

  // Step 2 — Decision options
  logger.info('Inject pipeline step 2: generating options', { injectIndex });
  const options = await generateOptions(narrativePart.narrative, narrativePart.phase, injectIndex + 1);

  // Step 3 — Feedback per option
  logger.info('Inject pipeline step 3: generating feedback', { injectIndex });
  const feedbackParts = await generateOptionFeedback(narrativePart.narrative, options);

  const assembled = {
    ...narrativePart,
    options: options.map((opt, i) => ({
      ...opt,
      scriptedFeedback: feedbackParts[i]?.scriptedFeedback ?? '',
      feedbackTags: feedbackParts[i]?.feedbackTags ?? [],
      consequences: null as string | null,
    })),
  };

  return validateInject(assembled, injectIndex, phase);
}

// ─── Ollama: setup (streaming) ────────────────────────────────────────────────

async function streamSetupWithOllama(
  type: AiScenarioType,
  difficulty: AiDifficulty,
  rounds: number,
  orgContext: OrgContext | undefined,
  onToken: (token: string) => void,
): Promise<ScenarioSetup> {
  const cfg = await getAISettings();
  const { baseUrl, model, apiKey, numPredict, numCtx } = cfg.ollama;
  const prompt  = await buildSetupPrompt(type, difficulty, rounds, orgContext);

  logger.info('Streaming scenario setup via Ollama', { type, difficulty, rounds, model });

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: ollamaHeaders(apiKey),
    body: JSON.stringify({
      model,
      prompt,
      stream: true,
      format: 'json',
      options: { temperature: 0.7, num_predict: numPredict, num_ctx: numCtx },
    }),
    signal: AbortSignal.timeout(SETUP_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Ollama HTTP ${response.status}${body ? ': ' + body.slice(0, 200) : ''}`);
  }
  if (!response.body) throw new Error('Ollama returned no response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let lineBuffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line) as { response?: string; done?: boolean };
          if (chunk.response) {
            fullText += chunk.response;
            onToken(chunk.response);
          }
        } catch { /* ignore partial line errors */ }
      }
    }
  } finally {
    reader.releaseLock();
  }

  try {
    const parsed = JSON.parse(extractJSON(fullText));
    return validateSetup(parsed, rounds);
  } catch (err) {
    logger.error('Failed to parse streamed setup JSON', { preview: fullText.slice(0, 300) });
    throw new Error(`Setup parse failed: ${(err as Error).message}`);
  }
}

// ─── Claude: setup ────────────────────────────────────────────────────────────

async function setupWithClaude(
  type: AiScenarioType,
  difficulty: AiDifficulty,
  rounds: number,
  orgContext?: OrgContext,
): Promise<ScenarioSetup> {
  const model = process.env.CLAUDE_MODEL ?? 'claude-opus-4-6';
  const prompt = await buildSetupPrompt(type, difficulty, rounds, orgContext);

  logger.info('Generating scenario setup via Claude', { type, difficulty, rounds, model });

  const cfg = await getAISettings();
  const systemPrompt = await getTemplateContent('scripted_inject_system');
  const client = new Anthropic({ apiKey: cfg.anthropic.apiKey || process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: cfg.anthropic.model,
    max_tokens: 768,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText =
    message.content[0]?.type === 'text'
      ? (message.content[0] as { type: 'text'; text: string }).text.trim()
      : '';
  if (!rawText) throw new Error('Claude returned empty setup response');

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJSON(rawText));
  } catch {
    throw new Error('AI returned malformed setup JSON — please try again.');
  }

  return validateSetup(parsed, rounds);
}

// ─── Claude: inject ───────────────────────────────────────────────────────────

async function injectWithClaude(
  type: AiScenarioType,
  difficulty: AiDifficulty,
  rounds: number,
  injectIndex: number,
  phase: string,
  setup: { title: string; description: string },
  previousInjects: InjectContext[],
  orgContext?: OrgContext,
): Promise<GeneratedInject> {
  const model = process.env.CLAUDE_MODEL ?? 'claude-opus-4-6';
  const prompt = await buildInjectPrompt(
    type,
    difficulty,
    rounds,
    injectIndex,
    phase,
    setup,
    previousInjects,
    orgContext,
  );

  logger.info('Generating inject via Claude', { type, difficulty, injectIndex, phase, model });

  const cfg = await getAISettings();
  const systemPrompt = await getTemplateContent('scripted_inject_system');
  const client = new Anthropic({ apiKey: cfg.anthropic.apiKey || process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: cfg.anthropic.model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText =
    message.content[0]?.type === 'text'
      ? (message.content[0] as { type: 'text'; text: string }).text.trim()
      : '';
  if (!rawText) throw new Error(`Claude returned empty response for inject ${injectIndex + 1}`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJSON(rawText));
  } catch {
    throw new Error(
      `AI returned malformed JSON for inject ${injectIndex + 1} — please try again.`,
    );
  }

  return validateInject(parsed, injectIndex, phase);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateScenarioSetup(
  type: AiScenarioType,
  difficulty: AiDifficulty,
  rounds: number,
  orgContext?: OrgContext,
): Promise<ScenarioSetup> {
  const { activeProvider, anthropic } = await getAISettings();
  if (activeProvider === 'anthropic' && anthropic.apiKey) return setupWithClaude(type, difficulty, rounds, orgContext);
  if (activeProvider === 'ollama') return setupWithOllama(type, difficulty, rounds, orgContext);
  throw new Error('AI scenario generation requires an active AI provider configured in the Admin → AI Config panel.');
}

export async function streamScenarioSetup(
  type: AiScenarioType,
  difficulty: AiDifficulty,
  rounds: number,
  orgContext: OrgContext | undefined,
  onToken: (token: string) => void,
): Promise<ScenarioSetup> {
  const { activeProvider, anthropic } = await getAISettings();
  if (activeProvider === 'ollama') return streamSetupWithOllama(type, difficulty, rounds, orgContext, onToken);
  if (activeProvider === 'anthropic' && anthropic.apiKey) {
    const setup = await setupWithClaude(type, difficulty, rounds, orgContext);
    for (const word of (setup.title + '\n' + setup.description).split(/(?<=\s)/)) onToken(word);
    return setup;
  }
  throw new Error('AI scenario generation requires an active AI provider configured in the Admin → AI Config panel.');
}

export async function streamSingleInject(
  type: AiScenarioType,
  difficulty: AiDifficulty,
  rounds: number,
  injectIndex: number,
  phase: string,
  setup: { title: string; description: string },
  previousInjects: InjectContext[],
  onToken: (token: string) => void,
  orgContext?: OrgContext,
): Promise<GeneratedInject> {
  const { activeProvider, anthropic } = await getAISettings();
  if (activeProvider === 'ollama') {
    const inject = await injectWithOllama(type, difficulty, rounds, injectIndex, phase, setup, previousInjects, orgContext);
    for (const word of inject.narrative.split(/(?<=\s)/)) onToken(word);
    return inject;
  }
  if (activeProvider === 'anthropic' && anthropic.apiKey) {
    const inject = await injectWithClaude(type, difficulty, rounds, injectIndex, phase, setup, previousInjects, orgContext);
    for (const word of inject.narrative.split(/(?<=\s)/)) onToken(word);
    return inject;
  }
  throw new Error('AI scenario generation requires an active AI provider configured in the Admin → AI Config panel.');
}

export async function generateSingleInject(
  type: AiScenarioType,
  difficulty: AiDifficulty,
  rounds: number,
  injectIndex: number,
  phase: string,
  setup: { title: string; description: string },
  previousInjects: InjectContext[],
  orgContext?: OrgContext,
): Promise<GeneratedInject> {
  const { activeProvider, anthropic } = await getAISettings();
  if (activeProvider === 'anthropic' && anthropic.apiKey)
    return injectWithClaude(type, difficulty, rounds, injectIndex, phase, setup, previousInjects, orgContext);
  if (activeProvider === 'ollama')
    return injectWithOllama(type, difficulty, rounds, injectIndex, phase, setup, previousInjects, orgContext);
  throw new Error('AI scenario generation requires an active AI provider configured in the Admin → AI Config panel.');
}
