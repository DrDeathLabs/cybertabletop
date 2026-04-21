import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../logger';
import { getTemplateContent } from '../prompt-templates';

export type FieldType = 'rationale' | 'hot-wash' | 'onboarding';

export interface TextQualityContext {
  text: string;
  fieldType: FieldType;
  contextHint?: string; // inject narrative for rationale; section name for hot-wash
  scenarioType?: string;
  playerRole?: string;
}

export interface TextQualityResult {
  isReady: boolean;
  issues: string[];
  revisedText: string | null;
  confidence: 'high' | 'medium' | 'low';
}

// ── System prompt keys per field type (loaded from DB template system) ────────

const SYSTEM_PROMPT_KEYS: Record<FieldType, string> = {
  rationale:  'text_quality_rationale',
  'hot-wash': 'text_quality_hotwash',
  onboarding: 'text_quality_onboarding',
};

// ── Prompt builders ──────────────────────────────────────────────────────────

function buildRationalePrompt(ctx: TextQualityContext): string {
  return `${ctx.contextHint ? `INCIDENT CONTEXT:\n${ctx.contextHint}\n\n` : ''}${ctx.playerRole ? `PLAYER ROLE: ${ctx.playerRole}\n\n` : ''}SUBMITTED RATIONALE:
"${ctx.text}"

Assess this rationale and respond with JSON:
{
  "isReady": true/false,
  "issues": ["issue 1", "issue 2"],
  "revisedText": "improved version if needed, or null if already good",
  "confidence": "high/medium/low"
}

isReady = true only if: grammatically correct, contextually relevant to the incident, professional enough for an AAR, and at least 10 characters.
issues: list specific problems (grammar, irrelevance, too vague, inappropriate language).
revisedText: null if isReady is true; otherwise provide a polished version that preserves the player's intent.`;
}

function buildHotWashPrompt(ctx: TextQualityContext): string {
  return `AAR SECTION: ${ctx.contextHint || 'Post-Exercise Analysis'}

SUBMITTED TEXT:
"${ctx.text}"

Assess this AAR section and respond with JSON:
{
  "isReady": true/false,
  "issues": ["issue 1", "issue 2"],
  "revisedText": "improved version if needed, or null if already good",
  "confidence": "high/medium/low"
}

isReady = true only if: grammatically correct, formal professional tone, complete sentences, no slang or informal language, no placeholder text like "TODO" or "N/A", and at least 20 characters.
issues: list specific problems.
revisedText: null if isReady is true; otherwise provide a publication-ready version that preserves the facilitator's meaning.`;
}

function buildOnboardingPrompt(ctx: TextQualityContext): string {
  return `SHORT FORM FIELD TEXT:
"${ctx.text}"

Lightly check for grammar and clarity. Respond with JSON:
{
  "isReady": true/false,
  "issues": ["issue 1"],
  "revisedText": "corrected version if needed, or null if fine",
  "confidence": "high/medium/low"
}

isReady = false only if there are clear grammar errors or the text is gibberish. Minor style differences are fine.`;
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function checkTextQuality(ctx: TextQualityContext): Promise<TextQualityResult> {
  // If text is empty or very short, return a sensible default
  if (!ctx.text || ctx.text.trim().length < 5) {
    return {
      isReady: false,
      issues: ['Text is too short or empty.'],
      revisedText: null,
      confidence: 'high',
    };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    // Graceful fallback: just approve it if no AI available
    logger.warn('ANTHROPIC_API_KEY not set — skipping text quality check, auto-approving');
    return { isReady: true, issues: [], revisedText: null, confidence: 'low' };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.CLAUDE_MODEL || 'claude-opus-4-6';

  const promptBuilders: Record<FieldType, (c: TextQualityContext) => string> = {
    rationale: buildRationalePrompt,
    'hot-wash': buildHotWashPrompt,
    onboarding: buildOnboardingPrompt,
  };

  const prompt = promptBuilders[ctx.fieldType](ctx);
  const systemPrompt = await getTemplateContent(SYSTEM_PROMPT_KEYS[ctx.fieldType]);

  try {
    const message = await client.messages.create({
      model,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
    const result = JSON.parse(cleaned) as TextQualityResult;

    return {
      isReady: Boolean(result.isReady),
      issues: Array.isArray(result.issues) ? result.issues : [],
      revisedText: result.revisedText ?? null,
      confidence: result.confidence ?? 'medium',
    };
  } catch (err) {
    logger.error('Text quality check failed', { error: err, fieldType: ctx.fieldType });
    // Fail open — don't block the user if AI is having issues
    return { isReady: true, issues: [], revisedText: null, confidence: 'low' };
  }
}
