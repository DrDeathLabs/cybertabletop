/**
 * Prompt Template Service
 *
 * Stores editable AI prompt templates in PostgreSQL.
 * Falls back to built-in defaults when no custom version has been saved.
 * In-memory cache with 30-second TTL to avoid DB round-trips on every AI call.
 */

import { prisma } from './db';

// ─── Default prompt content ───────────────────────────────────────────────────

export const DEFAULT_SCENARIO_GENERATION_SYSTEM = `You are a cybersecurity training content creator. Return only valid JSON — no markdown, no prose.`;

export const DEFAULT_SCRIPTED_INJECT_SYSTEM = `You are a senior cybersecurity instructor and incident response expert. Return only valid JSON — no markdown, no prose.`;

export const DEFAULT_PIPELINE_SYSTEM = `You are a cybersecurity tabletop exercise AI. Respond only with valid JSON.`;

export const DEFAULT_TEXT_QUALITY_RATIONALE = `You are a professional editor reviewing a cybersecurity tabletop exercise participant's written rationale.
Your job is to assess whether the rationale is coherent, grammatically correct, contextually relevant to the incident, and suitable for inclusion in a published After Action Report (AAR).
Respond ONLY with valid JSON — no markdown, no explanation.`;

export const DEFAULT_TEXT_QUALITY_HOTWASH = `You are a professional editor reviewing a section of a cybersecurity After Action Report (AAR).
Your job is to assess whether the text is grammatically correct, professionally written, formally structured, and publication-ready for review by a CISO or federal ISSO.
Respond ONLY with valid JSON — no markdown, no explanation.`;

export const DEFAULT_TEXT_QUALITY_ONBOARDING = `You are a grammar and clarity editor.
Your job is to lightly check a short text field for obvious grammar issues and clarity.
Do not change meaning or style significantly — only fix clear errors.
Respond ONLY with valid JSON — no markdown, no explanation.`;

export const DEFAULT_ADAPTIVE_INJECT_SYSTEM = `You are an expert cybersecurity incident response coach writing the next chapter of a live, unfolding incident.
This is a continuous story — each inject directly continues from the previous one.
The attacker, threat actor, or incident progresses round by round: they move deeper into systems, exfiltrate more data, pivot to new targets, or cause new damage.
Every inject must reference specific details from prior rounds (systems named, data types mentioned, decisions made).
You are NOT writing isolated vignettes — you are writing one coherent incident narrative that escalates.
Respond with ONLY valid JSON — no explanation, no markdown fences, no additional text.`;

export const DEFAULT_AI_DEBRIEF_SYSTEM = `You are an expert cybersecurity incident response coach.
Write a professional after-action assessment of a tabletop exercise team's performance.
The assessment will be published in an official After Action Report (AAR).
Write in formal, third-person, professional prose suitable for a CISO or federal ISSO to review.`;

export const DEFAULT_FEEDBACK_SYSTEM = `You are an expert cybersecurity incident response coach facilitating a tabletop exercise.
Your role is to provide constructive, educational feedback on decisions made during simulated incidents.
Be specific, reference real frameworks (NIST CSF, MITRE ATT&CK, PICERL, NIST SP 800-61), and cite industry best practices.
Keep feedback to 3-5 sentences. Be encouraging but honest. Focus on what was done right, what could be improved, and the real-world consequence of the choice.
Never be condescending. Your goal is learning, not judgment.`;

export const DEFAULT_SETUP_PROMPT = `You are a senior cybersecurity instructor and incident response expert with 20 years of experience running realistic tabletop exercises.
{{ORG_BLOCK}}Generate a {{SCENARIO_LABEL}} tabletop exercise overview for {{DIFFICULTY}} participants with {{ROUNDS}} injects.

{{DIFFICULTY_GUIDANCE}}

Return ONLY a single valid JSON object — no markdown, no explanation, no trailing text. Keep all string values SHORT (title ≤12 words, description ≤2 sentences, each objective ≤15 words). The JSON must be complete and properly closed.
{
  "title": "<concise scenario title>",
  "description": "<1-2 sentence overview: attack vector and business impact>",
  "objectives": ["<objective>", "<objective>", "<objective>"],
  "phases": [{{PHASES_JSON}}]
}

The phases array must contain exactly {{ROUNDS}} strings in this order: {{PHASES_LIST}}. Do not add any text after the closing brace.`;

export const DEFAULT_INJECT_PROMPT = `You are a senior cybersecurity instructor and incident response expert writing a realistic tabletop exercise.
Scenario: "{{SCENARIO_TITLE}}"
{{SCENARIO_DESCRIPTION}}
{{ORG_LINE}}Type: {{SCENARIO_LABEL}} | Difficulty: {{DIFFICULTY}}

{{CONTEXT_BLOCK}}{{CONTINUITY_INSTRUCTION}}
Phase for this inject: "{{PHASE}}"

Write a highly realistic, technically detailed inject. Requirements:
- Use specific system names, realistic hostnames, IP addresses, log entries, and error messages
- Reference real tools and platforms (CrowdStrike, Splunk, PagerDuty, Slack, ServiceNow, etc.)
- Include concrete business impact (revenue, compliance, customer data, SLAs)
- Make decision options specific and actionable, not generic
- Scripted feedback must explain the IR principle, framework reference (NIST CSF, PICERL, MITRE), and consequence
{{ORG_QUALITY_LINE}}
Return ONLY valid JSON — no markdown fences, no explanation:
{
  "title": "<specific inject title reflecting the escalation>",
  "narrative": "<2-3 paragraphs: what happened, specific technical indicators, affected systems, and business pressure>",
  "mitreAttackId": "<real MITRE ATT&CK T1xxx ID matching the technique used, or null>",
  "mitreAttackName": "<technique name, or null>",
  "nistCsfFunction": "<IDENTIFY|PROTECT|DETECT|RESPOND|RECOVER>",
  "options": [
    { "text": "<best practice action — specific and actionable>", "scoreWeight": 92, "isOptimal": true, "scriptedFeedback": "<2-3 sentences: why this is best, the IR principle (e.g. PICERL containment), framework reference>", "feedbackTags": ["good-practice"], "consequences": null },
    { "text": "<acceptable but incomplete action>", "scoreWeight": 65, "isOptimal": false, "scriptedFeedback": "<2-3 sentences: what was good, what was missed, what risk remains>", "feedbackTags": ["acceptable"], "consequences": null },
    { "text": "<delayed or misaligned action>", "scoreWeight": 28, "isOptimal": false, "scriptedFeedback": "<2-3 sentences: what went wrong, what best practice was violated>", "feedbackTags": ["delayed-response"], "consequences": "<specific downstream impact if this choice is made>" },
    { "text": "<harmful or counterproductive action>", "scoreWeight": 8, "isOptimal": false, "scriptedFeedback": "<2-3 sentences: why this causes harm, what compliance/legal/operational risk it creates>", "feedbackTags": ["poor-practice"], "consequences": "<serious specific consequence>" }
  ]
}

Rules: exactly 4 options, exactly 1 isOptimal:true, scoreWeight: optimal 85-100, acceptable 50-75, suboptimal 20-45, poor 0-20`;

export const DEFAULT_HOT_WASH_PROMPT = `You are a senior cybersecurity incident response expert writing the Post-Exercise Analysis section of a formal After Action Report (AAR) for a tabletop exercise. Produce content equivalent to what a federal agency would include in an AAR filed with their ISSO/CISO.

EXERCISE DATA:
- Scenario: {{SCENARIO_TITLE}} (Type: {{SCENARIO_TYPE}}, Difficulty: {{SCENARIO_DIFFICULTY}})
- Organization: {{ORG_NAME}}
- Participants: {{PLAYER_COUNT}}
- Total decisions: {{TOTAL_DECISIONS}}
- Optimal decision rate: {{OPTIMAL_RATE}}%
- Average decision score: {{AVG_SCORE}}/100

NIST CSF FUNCTION PERFORMANCE (worst → best):
{{CSF_PERFORMANCE}}

PHASE PERFORMANCE (worst → best):
{{PHASE_PERFORMANCE}}

SCENARIO OBJECTIVES:
{{SCENARIO_OBJECTIVES}}

Generate exactly this JSON object. Each field: 3–5 sentences, specific (reference actual phase names, CSF functions, and scores above), professional IR language (reference NIST SP 800-61 Rev 2, NIST CSF, or MITRE ATT&CK where relevant). Focus on organizational corrective actions, governance, process maturity, staffing, tooling, and leadership follow-through. Do NOT frame recommendations around the facilitator, teaching approach, or classroom mechanics. Do NOT use placeholder text.

{
  "overallAssessment": "...",
  "strengthsObserved": "...",
  "gapsAndImprovementAreas": "...",
  "rootCauses": "...",
  "operationalImpact": "...",
  "priorityActions": "...",
  "nextTrainingSteps": "...",
  "leadershipConsiderations": "..."
}

Respond with ONLY the JSON object — no markdown fences, no preamble.`;

// ─── Template metadata ────────────────────────────────────────────────────────

export interface PlaceholderDef {
  name: string;
  description: string;
  computed: boolean; // true = auto-computed at runtime, cannot be removed
}

export interface TemplateDefinition {
  key: string;
  label: string;
  description: string;
  defaultContent: string;
  placeholders: PlaceholderDef[];
}

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    key: 'setup_prompt',
    label: 'Scenario Setup Prompt',
    description:
      'Sent to the AI model once at the start of scenario generation. Produces the title, description, learning objectives, and phase list.',
    defaultContent: DEFAULT_SETUP_PROMPT,
    placeholders: [
      { name: 'SCENARIO_LABEL',     description: 'Scenario type label (e.g. "Ransomware", "Data Breach")',                                  computed: true },
      { name: 'DIFFICULTY',         description: 'Difficulty level (BEGINNER / INTERMEDIATE / ADVANCED / EXPERT)',                          computed: true },
      { name: 'ROUNDS',             description: 'Number of injects / rounds chosen by the facilitator',                                    computed: true },
      { name: 'DIFFICULTY_GUIDANCE',description: 'Built-in difficulty guidance paragraph injected automatically',                           computed: true },
      { name: 'PHASES_JSON',        description: 'Phase names as JSON array items, e.g. "Detection", "Triage", "Containment"',             computed: true },
      { name: 'PHASES_LIST',        description: 'Phase names joined with " → " arrows for human-readable display',                         computed: true },
      { name: 'ORG_BLOCK',          description: 'Multi-line org & industry context block. Empty string when no org is provided.',          computed: true },
    ],
  },
  {
    key: 'inject_prompt',
    label: 'Inject Generation Prompt',
    description:
      'Sent to the AI model once per inject (decision point). Produces the inject title, narrative, MITRE/NIST tags, and four scored response options.',
    defaultContent: DEFAULT_INJECT_PROMPT,
    placeholders: [
      { name: 'SCENARIO_TITLE',        description: 'Title of the generated scenario',                                                         computed: true },
      { name: 'SCENARIO_DESCRIPTION',  description: 'Two-to-three sentence scenario description',                                              computed: true },
      { name: 'SCENARIO_LABEL',        description: 'Scenario type label (e.g. "Ransomware")',                                                 computed: true },
      { name: 'DIFFICULTY',            description: 'Difficulty level',                                                                        computed: true },
      { name: 'ORG_LINE',              description: 'Single-line "Organization: X | Industry: Y" prefix. Empty when no org provided.',         computed: true },
      { name: 'CONTEXT_BLOCK',         description: 'Story-so-far summary of previous injects for continuity. Empty on inject 1.',             computed: true },
      { name: 'CONTINUITY_INSTRUCTION',description: 'First-inject setup instruction vs. continuation instruction for subsequent injects.',      computed: true },
      { name: 'PHASE',                 description: 'Name of the current phase (e.g. "Containment", "Executive Notification")',                computed: true },
      { name: 'ORG_QUALITY_LINE',      description: 'Quality bullet asking the model to ground content in the org context. Empty if no org.',  computed: true },
    ],
  },
  {
    key: 'hot_wash_prompt',
    label: 'Post-Exercise Analysis Prompt',
    description:
      'Sent to the AI model when a facilitator clicks "AI Generate" on the debrief Post-Exercise Analysis section. Produces the full eight-part readiness analysis: overall assessment, strengths, gaps, root causes, operational impact, priority actions, next training steps, and leadership considerations.',
    defaultContent: DEFAULT_HOT_WASH_PROMPT,
    placeholders: [
      { name: 'SCENARIO_TITLE',      description: 'Title of the completed scenario',                                                         computed: true },
      { name: 'SCENARIO_TYPE',       description: 'Scenario type (e.g. "Ransomware", "Data Breach")',                                        computed: true },
      { name: 'SCENARIO_DIFFICULTY', description: 'Difficulty level (BEGINNER / INTERMEDIATE / ADVANCED / EXPERT)',                          computed: true },
      { name: 'ORG_NAME',            description: 'Organization name, or "N/A" if not set',                                                  computed: true },
      { name: 'PLAYER_COUNT',        description: 'Number of participants in the session',                                                    computed: true },
      { name: 'TOTAL_DECISIONS',     description: 'Total number of decisions recorded across all players and injects',                        computed: true },
      { name: 'OPTIMAL_RATE',        description: 'Percentage of decisions that were the optimal choice (0–100)',                             computed: true },
      { name: 'AVG_SCORE',           description: 'Average decision score across all players (0–100)',                                        computed: true },
      { name: 'CSF_PERFORMANCE',     description: 'NIST CSF function performance summary, sorted worst → best, one line per function',       computed: true },
      { name: 'PHASE_PERFORMANCE',   description: 'Phase performance summary, sorted worst → best, one line per phase',                      computed: true },
      { name: 'SCENARIO_OBJECTIVES', description: 'Bullet list of scenario learning objectives (empty string if none)',                       computed: true },
    ],
  },
  {
    key: 'scenario_generation_system',
    label: 'Scenario Generation System Prompt',
    description:
      'System-level persona used when generating a full scripted scenario (title, description, phases, and all injects in one call) via the scenario builder. Claude only.',
    defaultContent: DEFAULT_SCENARIO_GENERATION_SYSTEM,
    placeholders: [],
  },
  {
    key: 'scripted_inject_system',
    label: 'Scripted Inject System Prompt',
    description:
      'System-level persona used in the two-step scripted scenario generation process: once for the setup phase (title/phases) and once per inject. Shared by both calls. Claude only.',
    defaultContent: DEFAULT_SCRIPTED_INJECT_SYSTEM,
    placeholders: [],
  },
  {
    key: 'pipeline_system',
    label: 'Adaptive Pipeline System Prompt',
    description:
      'System-level instruction prepended to all three Ollama pipeline steps (narrative, options, feedback) for AI-driven sessions. Tells the model to respond with valid JSON only.',
    defaultContent: DEFAULT_PIPELINE_SYSTEM,
    placeholders: [],
  },
  {
    key: 'text_quality_rationale',
    label: 'Text Quality — Decision Rationale',
    description:
      'System prompt used when checking a player\'s written decision rationale for grammar, coherence, and AAR publication readiness. Used by the "Check" button on the rationale field during gameplay.',
    defaultContent: DEFAULT_TEXT_QUALITY_RATIONALE,
    placeholders: [],
  },
  {
    key: 'text_quality_hotwash',
    label: 'Text Quality — Hot Wash Section',
    description:
      'System prompt used when checking a Hot Wash AAR section for grammar, professional tone, and publication readiness. Triggered when the facilitator saves the Hot Wash in the debrief.',
    defaultContent: DEFAULT_TEXT_QUALITY_HOTWASH,
    placeholders: [],
  },
  {
    key: 'text_quality_onboarding',
    label: 'Text Quality — Onboarding Fields',
    description:
      'System prompt used for light grammar and clarity checks on free-text fields in the onboarding wizard (e.g., crown jewels description, recent incident notes).',
    defaultContent: DEFAULT_TEXT_QUALITY_ONBOARDING,
    placeholders: [],
  },
  {
    key: 'adaptive_narrative_prompt',
    label: 'Adaptive Inject — Step 1: Narrative',
    description:
      'Step 1 of the 3-step Ollama pipeline for AI-driven sessions. Asks the model to write the incident narrative, phase, and MITRE/NIST tags for the current round. Dynamic values (org context, history, round instructions) are injected at runtime.',
    defaultContent: `{{ORG_CONTEXT}}SCENARIO: {{SCENARIO_TYPE}} | Difficulty: {{DIFFICULTY}}
EXERCISE HISTORY:
{{HISTORY}}

ROUND: {{ROUND_LABEL}}{{ROUND_INSTRUCTIONS}}

Write a detailed incident narrative for this round. The narrative must end with a direct question the team must answer.
CRITICAL JSON RULE: never use double-quote characters (") inside any text value — use single quotes or parentheses instead.

Respond with JSON only:
{
  "title": "Short inject title (5-8 words)",
  "narrative": "3-4 paragraph detailed narrative ending with a question",
  "phase": "DETECT|CONTAIN|ERADICATE|RECOVER|IDENTIFY",
  "contextNote": "optional brief technical context note",
  "nistCsfFunction": "IDENTIFY|PROTECT|DETECT|RESPOND|RECOVER",
  "mitreAttackId": "T#### or null",
  "mitreAttackName": "technique name or null",
  "timerSeconds": null
}`,
    placeholders: [
      { name: 'ORG_CONTEXT',         description: 'Multi-line org profile block (name, industry, maturity, compliance, crown jewels). Empty when no onboarding was done.', computed: true },
      { name: 'SCENARIO_TYPE',       description: 'Incident type (e.g. "RANSOMWARE", "APT")',                                                                              computed: true },
      { name: 'DIFFICULTY',          description: 'Difficulty level (BEGINNER / INTERMEDIATE / ADVANCED / EXPERT)',                                                        computed: true },
      { name: 'HISTORY',             description: 'Compact one-liner per prior round: title, phase, avg score, team decisions',                                            computed: true },
      { name: 'ROUND_LABEL',         description: 'e.g. "3 of 5" or just "3" for unlimited sessions',                                                                     computed: true },
      { name: 'ROUND_INSTRUCTIONS',  description: 'Round-specific guidance block: first round = discovery, second-to-last = eradication, last = recovery, others = escalate', computed: true },
    ],
  },
  {
    key: 'adaptive_options_prompt',
    label: 'Adaptive Inject — Step 2: Options',
    description:
      'Step 2 of the 3-step Ollama pipeline. Given the narrative from Step 1, asks the model to generate exactly 4 decision options with score weights and optimal flag. Feedback is NOT generated here — that is Step 3.',
    defaultContent: `You are writing decision options for a cybersecurity tabletop exercise inject.

INJECT NARRATIVE:
{{NARRATIVE}}

PHASE: {{PHASE}} | ROUND: {{ROUND}}

Generate exactly 4 decision options the team can choose from. One must be optimal, one good-but-not-best, one poor, one clearly wrong.
Place them in RANDOM order — do NOT put the optimal option first.
Each option must use a different sentence structure and action verb.
CRITICAL JSON RULE: never use double-quote characters (") inside any text value — use single quotes or parentheses instead.

Respond with JSON only:
{
  "options": [
    { "text": "Option text", "scoreWeight": 90, "isOptimal": true },
    { "text": "Option text", "scoreWeight": 60, "isOptimal": false },
    { "text": "Option text", "scoreWeight": 25, "isOptimal": false },
    { "text": "Option text", "scoreWeight": 5,  "isOptimal": false }
  ]
}`,
    placeholders: [
      { name: 'NARRATIVE', description: 'The full narrative text generated in Step 1',    computed: true },
      { name: 'PHASE',     description: 'Phase from Step 1 (e.g. "DETECT", "ERADICATE")', computed: true },
      { name: 'ROUND',     description: 'Current round number',                            computed: true },
    ],
  },
  {
    key: 'adaptive_feedback_prompt',
    label: 'Adaptive Inject — Step 3: Feedback',
    description:
      'Step 3 of the 3-step Ollama pipeline. Given the narrative and all 4 options from Steps 1–2, asks the model to write plain-text coaching feedback for each option referencing NIST CSF, MITRE ATT&CK, or PICERL.',
    defaultContent: `You are writing post-decision feedback for a cybersecurity tabletop exercise.

INJECT NARRATIVE:
{{NARRATIVE}}

OPTIONS:
{{OPTIONS}}

For each option, write feedback explaining WHY it is correct or incorrect, referencing NIST CSF, MITRE ATT&CK, or PICERL. Write in plain text only. CRITICAL JSON RULES: never use double-quote characters (") inside any text value — use single quotes or parentheses instead. No markdown, no **bold**, no *italics*, no asterisks. Write 3 short complete sentences, each ending with a period.

Respond with JSON only:
{
  "feedback": [
    { "scriptedFeedback": "Feedback for option 1.", "feedbackTags": ["best-practice"] },
    { "scriptedFeedback": "Feedback for option 2.", "feedbackTags": ["common-mistake"] },
    { "scriptedFeedback": "Feedback for option 3.", "feedbackTags": ["legal-risk"] },
    { "scriptedFeedback": "Feedback for option 4.", "feedbackTags": [] }
  ]
}`,
    placeholders: [
      { name: 'NARRATIVE', description: 'The full narrative text generated in Step 1',                              computed: true },
      { name: 'OPTIONS',   description: 'Numbered list of the 4 options generated in Step 2 with score and optimal flag', computed: true },
    ],
  },
  {
    key: 'adaptive_inject_system',
    label: 'Adaptive Inject System Prompt',
    description:
      'System-level persona sent to the AI at the start of every AI-driven inject generation call. Defines the coach\'s role, continuity requirements, and JSON-only output constraint. Used for both Claude and Ollama providers.',
    defaultContent: DEFAULT_ADAPTIVE_INJECT_SYSTEM,
    placeholders: [],
  },
  {
    key: 'ai_debrief_system',
    label: 'AI Debrief System Prompt',
    description:
      'System-level persona sent to the AI when generating the After Action Report performance narrative at the end of an AI-driven session. Sets the formal, professional writing style expected in a published AAR.',
    defaultContent: DEFAULT_AI_DEBRIEF_SYSTEM,
    placeholders: [],
  },
  {
    key: 'feedback_system',
    label: 'Decision Feedback System Prompt',
    description:
      'System-level persona sent to the AI when generating real-time coaching feedback after a player submits a decision. Used by both Claude and Ollama providers for every decision in every session.',
    defaultContent: DEFAULT_FEEDBACK_SYSTEM,
    placeholders: [],
  },
];

// ─── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  content: string;
  ts: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000; // 30 s — fast enough for near-real-time edits

function invalidate(key: string) {
  cache.delete(key);
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

/** Replace {{UPPER_CASE}} placeholders with values from vars map. */
export function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_match, key: string) => vars[key] ?? '');
}

/** Get the current template content for a key (DB custom → hardcoded default). */
export async function getTemplateContent(key: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.ts < CACHE_TTL_MS) return cached.content;

  const row = await prisma.promptTemplate.findUnique({ where: { key } });
  const def = TEMPLATE_DEFINITIONS.find((t) => t.key === key);
  const content = row?.content ?? def?.defaultContent ?? '';
  cache.set(key, { content, ts: now });
  return content;
}

// ─── Admin CRUD ───────────────────────────────────────────────────────────────

export interface TemplateWithMeta {
  key: string;
  label: string;
  description: string;
  content: string;
  isCustom: boolean;
  placeholders: PlaceholderDef[];
  updatedAt?: string;
  updatedByEmail?: string;
}

/** Return all templates (with current content + metadata) for the admin panel. */
export async function getAllTemplateData(): Promise<TemplateWithMeta[]> {
  const rows = await prisma.promptTemplate.findMany({
    include: { updatedBy: { select: { email: true } } },
  });
  const rowMap = new Map(rows.map((r) => [r.key, r]));

  return TEMPLATE_DEFINITIONS.map((def) => {
    const row = rowMap.get(def.key);
    return {
      key: def.key,
      label: def.label,
      description: def.description,
      placeholders: def.placeholders,
      content: row?.content ?? def.defaultContent,
      isCustom: !!row,
      updatedAt: row?.updatedAt?.toISOString(),
      updatedByEmail: row?.updatedBy?.email ?? undefined,
    };
  });
}

/** Save (create or update) a custom template. Invalidates cache. */
export async function saveTemplateContent(
  key: string,
  content: string,
  userId: string,
): Promise<void> {
  const def = TEMPLATE_DEFINITIONS.find((t) => t.key === key);
  if (!def) throw new Error(`Unknown template key: ${key}`);

  await prisma.promptTemplate.upsert({
    where: { key },
    create: {
      key,
      label: def.label,
      description: def.description,
      content,
      updatedById: userId,
    },
    update: {
      content,
      label: def.label,
      description: def.description,
      updatedById: userId,
    },
  });

  invalidate(key);
}

/** Delete the custom override, reverting to the hardcoded default. Invalidates cache. */
export async function resetTemplateContent(key: string): Promise<void> {
  await prisma.promptTemplate.deleteMany({ where: { key } });
  invalidate(key);
}
