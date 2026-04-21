import { AIProvider, FeedbackContext, FeedbackResult } from './types';
import { logger } from '../logger';
import { getTemplateContent } from '../prompt-templates';
import { getAISettings } from '../ai-config';

export class OllamaProvider implements AIProvider {
  async generateFeedback(ctx: FeedbackContext): Promise<FeedbackResult> {
    const cfg = await getAISettings();
    const { baseUrl, model, apiKey, temperature, numPredict } = cfg.ollama;
    const qualityLabel = ctx.isOptimal ? 'optimal' : ctx.scoreWeight >= 60 ? 'acceptable' : ctx.scoreWeight >= 30 ? 'suboptimal' : 'poor';
    const systemPrompt = await getTemplateContent('feedback_system');

    const prompt = `${systemPrompt}

Scenario: ${ctx.scenarioTitle}
Phase: ${ctx.phase}
Situation: ${ctx.injectNarrative}
Player role: ${ctx.playerRole}
Decision: "${ctx.chosenOption}" (quality: ${qualityLabel}, score: ${ctx.scoreWeight}/100)
${!ctx.isOptimal ? `Better choice was: "${ctx.optimalOptionText}"` : ''}

Provide constructive coaching feedback for this decision. Reference relevant frameworks and explain the real-world implications.`;

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
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }

    const data = (await response.json()) as { response: string };
    return { feedback: data.response.trim(), provider: `ollama:${model}` };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const cfg = await getAISettings();
      const res = await fetch(`${cfg.ollama.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch (err) {
      logger.debug('Ollama unavailable', { error: err });
      return false;
    }
  }

  providerName(): string {
    return 'ollama';
  }
}
