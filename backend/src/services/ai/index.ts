import { AIProvider, FeedbackContext, FeedbackResult } from './types';
import { ScriptedProvider } from './scripted';
import { ClaudeProvider } from './claude';
import { OllamaProvider } from './ollama';
import { logger } from '../logger';

export { FeedbackContext, FeedbackResult };

// Provider chain with automatic fallback
// Configured provider → scripted fallback
let primaryProvider: AIProvider | null = null;

export function initAIProvider(): void {
  const configured = process.env.AI_PROVIDER || 'scripted';

  if (configured === 'claude' && process.env.ANTHROPIC_API_KEY) {
    primaryProvider = new ClaudeProvider();
    logger.info('AI provider: Claude');
  } else if (configured === 'ollama') {
    primaryProvider = new OllamaProvider();
    logger.info('AI provider: Ollama', { model: process.env.OLLAMA_MODEL });
  } else {
    logger.info('AI provider: Scripted (default)');
  }
}

export async function generateFeedback(
  ctx: FeedbackContext,
  scriptedFeedback: string
): Promise<FeedbackResult> {
  const scripted = new ScriptedProvider(scriptedFeedback);

  if (!primaryProvider) {
    return scripted.generateFeedback(ctx);
  }

  try {
    const available = await primaryProvider.isAvailable();
    if (!available) {
      logger.warn('Primary AI provider unavailable, falling back to scripted');
      return scripted.generateFeedback(ctx);
    }
    return await primaryProvider.generateFeedback(ctx);
  } catch (err) {
    logger.error('AI provider error, falling back to scripted', { error: err });
    return scripted.generateFeedback(ctx);
  }
}

// Initialize on import
initAIProvider();
