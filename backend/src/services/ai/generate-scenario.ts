/**
 * AI Scenario Generation Service
 *
 * Generates a complete tabletop exercise scenario (title, objectives, injects,
 * options, feedback, MITRE/NIST mappings) from a type + difficulty + round count.
 *
 * Supports both Ollama and Claude providers, matching whichever AI_PROVIDER is
 * configured in .env.  Claude produces more reliable JSON; Ollama works offline.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../logger';
import { getTemplateContent } from '../prompt-templates';
import { getAISettings } from '../ai-config';

// ─── Public types ─────────────────────────────────────────────────────────────

export type AiScenarioType =
  | 'RANSOMWARE'
  | 'DATA_BREACH'
  | 'INSIDER_THREAT'
  | 'BEC'
  | 'SUPPLY_CHAIN'
  | 'DDoS'
  | 'APT'
  | 'CUSTOM';

export type AiDifficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

export interface GeneratedOption {
  text: string;
  scoreWeight: number;
  isOptimal: boolean;
  scriptedFeedback: string;
  feedbackTags: string[];
  consequences: string | null;
}

export interface GeneratedInject {
  phaseOrder: number;
  injectOrder: number;
  phase: string;
  title: string;
  narrative: string;
  mitreAttackId: string | null;
  mitreAttackName: string | null;
  nistCsfFunction: 'IDENTIFY' | 'PROTECT' | 'DETECT' | 'RESPOND' | 'RECOVER' | null;
  options: GeneratedOption[];
}

export interface GeneratedScenario {
  title: string;
  description: string;
  objectives: string[];
  injects: GeneratedInject[];
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

export const SCENARIO_LABELS: Record<AiScenarioType, string> = {
  RANSOMWARE: 'Ransomware Attack',
  DATA_BREACH: 'Data Breach',
  INSIDER_THREAT: 'Insider Threat',
  BEC: 'Business Email Compromise',
  SUPPLY_CHAIN: 'Supply Chain Attack',
  DDoS: 'Distributed Denial of Service',
  APT: 'Advanced Persistent Threat',
  CUSTOM: 'Cybersecurity Incident',
};

export const DIFFICULTY_GUIDANCE: Record<AiDifficulty, string> = {
  BEGINNER:
    'Clear right/wrong choices, familiar concepts, obvious red flags. Suitable for IT staff with basic security awareness.',
  INTERMEDIATE:
    'Some nuance required, realistic time pressure, moderate technical depth. Some options appear valid but have hidden drawbacks.',
  ADVANCED:
    'Complex trade-offs, competing priorities, significant technical depth. Multiple defensible choices with different risk profiles.',
  EXPERT:
    'Nation-state / APT level, legal and regulatory complexity, board-level impact decisions. Deep technical expertise required.',
};

export const NIST_FUNCTIONS = ['IDENTIFY', 'PROTECT', 'DETECT', 'RESPOND', 'RECOVER'] as const;

// Pick phase labels that spread across the incident lifecycle.
// First round is always Discovery, second-to-last is Eradication, last is Recovery.
export function pickPhases(rounds: number): string[] {
  if (rounds === 1) return ['Recovery'];
  if (rounds === 2) return ['Discovery', 'Recovery'];
  if (rounds === 3) return ['Discovery', 'Eradication', 'Recovery'];

  // rounds >= 4: first = Discovery, last = Recovery, second-to-last = Eradication,
  // fill middle slots with the stages between.
  const middle = ['Investigation', 'Containment', 'Escalation', 'Remediation'];
  const middleCount = rounds - 3;
  return ['Discovery', ...middle.slice(0, middleCount), 'Eradication', 'Recovery'];
}

function buildPrompt(type: AiScenarioType, difficulty: AiDifficulty, rounds: number): string {
  const phases = pickPhases(rounds);

  return `You are a cybersecurity training content creator. Generate a ${SCENARIO_LABELS[type]} tabletop exercise with exactly ${rounds} injects for ${difficulty} participants.

${DIFFICULTY_GUIDANCE[difficulty]}

Return ONLY a valid JSON object — no markdown code fences, no explanation, no text outside the JSON.

{
  "title": "<concise scenario title>",
  "description": "<2-3 sentence overview of the incident>",
  "objectives": ["<learning objective>", "<learning objective>", "<learning objective>"],
  "injects": [
    {
      "phaseOrder": 1,
      "injectOrder": 1,
      "phase": "${phases[0]}",
      "title": "<inject title>",
      "narrative": "<2-4 paragraph situation briefing shown to players. Include specific technical indicators, timestamps, system names, and artefacts relevant to ${SCENARIO_LABELS[type]}.>",
      "mitreAttackId": "<e.g. T1486 — use a real ATT&CK ID appropriate for this phase, or null>",
      "mitreAttackName": "<matching ATT&CK technique name, or null>",
      "nistCsfFunction": "<one of: IDENTIFY PROTECT DETECT RESPOND RECOVER>",
      "options": [
        {
          "text": "<best action — 1-2 sentences>",
          "scoreWeight": 90,
          "isOptimal": true,
          "scriptedFeedback": "<2-3 sentences why this is best; cite NIST CSF / MITRE ATT&CK / IR best practice>",
          "feedbackTags": ["good-practice"],
          "consequences": "<positive consequence narrative or null>"
        },
        {
          "text": "<acceptable but not ideal action>",
          "scoreWeight": 60,
          "isOptimal": false,
          "scriptedFeedback": "<explain partial credit and what was missed>",
          "feedbackTags": ["acceptable"],
          "consequences": null
        },
        {
          "text": "<plausible but clearly suboptimal action>",
          "scoreWeight": 25,
          "isOptimal": false,
          "scriptedFeedback": "<explain why this causes delays or problems>",
          "feedbackTags": ["delayed-response"],
          "consequences": "<negative consequence>"
        },
        {
          "text": "<harmful or negligent action>",
          "scoreWeight": 5,
          "isOptimal": false,
          "scriptedFeedback": "<explain the serious risk created>",
          "feedbackTags": ["poor-practice"],
          "consequences": "<serious negative consequence>"
        }
      ]
    }
  ]
}

Rules:
- Generate exactly ${rounds} injects, progressing: ${phases.join(' → ')}
- Each inject must have EXACTLY 4 options
- Exactly ONE option per inject must be "isOptimal": true
- scoreWeight ranges: optimal 85-100, acceptable 50-75, suboptimal 20-45, poor 0-20
- Use real MITRE ATT&CK IDs (T1xxx) appropriate to ${SCENARIO_LABELS[type]}
- Spread across different NIST CSF functions where possible
- Make the scenario narratively coherent — early decisions affect the context of later injects`;
}

// ─── JSON extraction ───────────────────────────────────────────────────────────

function extractJSON(text: string): string {
  // Strip markdown fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  // Grab the outermost {...}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) return text.slice(start, end + 1);

  return text.trim();
}

// ─── Validation & normalisation ───────────────────────────────────────────────

function validateAndNormalise(raw: unknown, rounds: number): GeneratedScenario {
  if (!raw || typeof raw !== 'object') throw new Error('AI returned a non-object response');
  const obj = raw as Record<string, unknown>;

  if (typeof obj.title !== 'string' || !obj.title.trim()) throw new Error('Missing scenario title');
  if (typeof obj.description !== 'string' || !obj.description.trim())
    throw new Error('Missing scenario description');
  if (!Array.isArray(obj.objectives) || obj.objectives.length === 0)
    throw new Error('Missing learning objectives');
  if (!Array.isArray(obj.injects) || obj.injects.length === 0)
    throw new Error('AI returned no injects');

  const injects: GeneratedInject[] = obj.injects.slice(0, rounds).map((raw: unknown, idx: number) => {
    const i = raw as Record<string, unknown>;
    if (!i.title || !i.narrative || !i.phase)
      throw new Error(`Inject ${idx + 1} is missing required fields (title/narrative/phase)`);

    const rawOptions = Array.isArray(i.options) ? (i.options as Array<Record<string, unknown>>) : [];
    if (rawOptions.length < 2)
      throw new Error(`Inject ${idx + 1} has fewer than 2 options (got ${rawOptions.length})`);

    // Guarantee at least one optimal option
    const hasOptimal = rawOptions.some((o) => o.isOptimal === true);
    if (!hasOptimal) rawOptions[0] = { ...rawOptions[0], isOptimal: true };

    const options: GeneratedOption[] = rawOptions.slice(0, 6).map((opt) => ({
      text: String(opt.text ?? '').slice(0, 500),
      scoreWeight: Math.max(0, Math.min(100, Math.round(Number(opt.scoreWeight) || 0))),
      isOptimal: opt.isOptimal === true,
      scriptedFeedback: String(opt.scriptedFeedback ?? 'See the scenario debrief for feedback.').slice(0, 2000),
      feedbackTags: Array.isArray(opt.feedbackTags) ? opt.feedbackTags.map(String).slice(0, 10) : [],
      consequences: opt.consequences ? String(opt.consequences).slice(0, 500) : null,
    }));

    const nistRaw = String(i.nistCsfFunction ?? '').toUpperCase();
    const nistCsfFunction = (NIST_FUNCTIONS as readonly string[]).includes(nistRaw)
      ? (nistRaw as GeneratedInject['nistCsfFunction'])
      : null;

    return {
      phaseOrder: Math.max(1, Math.round(Number(i.phaseOrder) || idx + 1)),
      injectOrder: Math.max(1, Math.round(Number(i.injectOrder) || idx + 1)),
      phase: String(i.phase).slice(0, 100),
      title: String(i.title).slice(0, 200),
      narrative: String(i.narrative).slice(0, 3000),
      mitreAttackId: i.mitreAttackId ? String(i.mitreAttackId).slice(0, 20) : null,
      mitreAttackName: i.mitreAttackName ? String(i.mitreAttackName).slice(0, 200) : null,
      nistCsfFunction,
      options,
    };
  });

  return {
    title: String(obj.title).slice(0, 200),
    description: String(obj.description).slice(0, 1000),
    objectives: (obj.objectives as unknown[]).map(String).slice(0, 10),
    injects,
  };
}

// ─── Ollama generation ────────────────────────────────────────────────────────

async function generateWithOllama(
  type: AiScenarioType,
  difficulty: AiDifficulty,
  rounds: number,
): Promise<GeneratedScenario> {
  const cfg = await getAISettings();
  const { baseUrl, model, apiKey, temperature, numPredict } = cfg.ollama;
  const prompt = buildPrompt(type, difficulty, rounds);

  logger.info('Generating AI scenario via Ollama', { type, difficulty, rounds, model });

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature, num_predict: numPredict },
    }),
    signal: AbortSignal.timeout(120_000), // 2-minute hard limit
  });

  if (!response.ok) {
    throw new Error(`Ollama responded with HTTP ${response.status}`);
  }

  const data = (await response.json()) as { response?: string };
  const rawText = data.response?.trim() ?? '';
  if (!rawText) throw new Error('Ollama returned an empty response');

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJSON(rawText));
  } catch {
    logger.error('Failed to parse Ollama scenario JSON', { preview: rawText.slice(0, 400) });
    throw new Error('AI returned malformed JSON — please try again.');
  }

  return validateAndNormalise(parsed, rounds);
}

// ─── Claude generation ────────────────────────────────────────────────────────

async function generateWithClaude(
  type: AiScenarioType,
  difficulty: AiDifficulty,
  rounds: number,
): Promise<GeneratedScenario> {
  const cfg = await getAISettings();
  const { model, apiKey, maxTokens } = cfg.anthropic;
  const prompt = buildPrompt(type, difficulty, rounds);

  logger.info('Generating AI scenario via Claude', { type, difficulty, rounds, model });

  const systemPrompt = await getTemplateContent('scenario_generation_system');
  const client = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model,
    max_tokens: Math.max(maxTokens, 8192),
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText =
    message.content[0]?.type === 'text' ? (message.content[0] as { type: 'text'; text: string }).text.trim() : '';
  if (!rawText) throw new Error('Claude returned an empty response');

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJSON(rawText));
  } catch {
    logger.error('Failed to parse Claude scenario JSON', { preview: rawText.slice(0, 400) });
    throw new Error('AI returned malformed JSON — please try again.');
  }

  return validateAndNormalise(parsed, rounds);
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function generateAIScenario(
  type: AiScenarioType,
  difficulty: AiDifficulty,
  rounds: number,
): Promise<GeneratedScenario> {
  const { activeProvider, anthropic } = await getAISettings();
  if (activeProvider === 'anthropic' && anthropic.apiKey) return generateWithClaude(type, difficulty, rounds);
  if (activeProvider === 'ollama') return generateWithOllama(type, difficulty, rounds);
  throw new Error('AI scenario generation requires an active provider configured in Admin → AI Config.');
}
