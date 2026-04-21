import { AIProvider, FeedbackContext, FeedbackResult } from './types';

// Scripted provider: returns the pre-authored feedback from the scenario data
// This is the fallback and default. Feedback is authored with full depth
// at scenario creation time, covering IR principles, framework refs, and consequences.
export class ScriptedProvider implements AIProvider {
  private scenarioFeedback: string;

  constructor(scriptedFeedback: string) {
    this.scenarioFeedback = scriptedFeedback;
  }

  async generateFeedback(_ctx: FeedbackContext): Promise<FeedbackResult> {
    return {
      feedback: this.scenarioFeedback,
      provider: 'scripted',
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  providerName(): string {
    return 'scripted';
  }
}
