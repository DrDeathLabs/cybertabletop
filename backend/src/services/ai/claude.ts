import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, FeedbackContext, FeedbackResult } from './types';
import { logger } from '../logger';
import { getTemplateContent } from '../prompt-templates';
import { getAISettings } from '../ai-config';

export class ClaudeProvider implements AIProvider {
  async generateFeedback(ctx: FeedbackContext): Promise<FeedbackResult> {
    const cfg = await getAISettings();
    const client = new Anthropic({ apiKey: cfg.anthropic.apiKey || process.env.ANTHROPIC_API_KEY });
    const prompt = buildFeedbackPrompt(ctx);
    const systemPrompt = await getTemplateContent('feedback_system');

    const message = await client.messages.create({
      model: cfg.anthropic.model,
      max_tokens: cfg.anthropic.maxTokens,
      messages: [{ role: 'user', content: prompt }],
      system: systemPrompt,
    });

    const content = message.content[0];
    const feedback = content.type === 'text' ? content.text : '';

    return { feedback, provider: 'claude' };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const cfg = await getAISettings();
      const apiKey = cfg.anthropic.apiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return false;
      const client = new Anthropic({ apiKey });
      await client.models.list();
      return true;
    } catch (err) {
      logger.warn('Claude API unavailable', { error: err });
      return false;
    }
  }

  providerName(): string {
    return 'claude';
  }
}

function buildFeedbackPrompt(ctx: FeedbackContext): string {
  const qualityLabel = ctx.isOptimal ? 'optimal' : ctx.scoreWeight >= 60 ? 'acceptable' : ctx.scoreWeight >= 30 ? 'suboptimal' : 'poor';

  return `Scenario: "${ctx.scenarioTitle}" (${ctx.scenarioType})
Phase: ${ctx.phase}
Incident Situation: ${ctx.injectNarrative}
Player Role: ${ctx.playerRole}
Decision Made: "${ctx.chosenOption}"
Decision Quality: ${qualityLabel} (score: ${ctx.scoreWeight}/100)
${ctx.mitreAttackId ? `MITRE ATT&CK: ${ctx.mitreAttackId} - ${ctx.mitreAttackName}` : ''}
${ctx.nistCsfFunction ? `NIST CSF Function: ${ctx.nistCsfFunction}` : ''}
${!ctx.isOptimal ? `The optimal choice was: "${ctx.optimalOptionText}"` : ''}

Provide constructive coaching feedback for this decision. Reference relevant frameworks and explain the real-world implications.`;
}
