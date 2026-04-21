export interface FeedbackContext {
  scenarioTitle: string;
  scenarioType: string;
  injectTitle: string;
  injectNarrative: string;
  phase: string;
  chosenOption: string;
  isOptimal: boolean;
  scoreWeight: number;
  playerRole: string;
  mitreAttackId?: string;
  mitreAttackName?: string;
  nistCsfFunction?: string;
  allOptions: string[];
  optimalOptionText: string;
}

export interface FeedbackResult {
  feedback: string;
  provider: string;
}

export interface AIProvider {
  generateFeedback(ctx: FeedbackContext): Promise<FeedbackResult>;
  isAvailable(): Promise<boolean>;
  providerName(): string;
}
