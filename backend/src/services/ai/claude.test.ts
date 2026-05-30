import { beforeEach, describe, expect, it, vi } from 'vitest';

const { anthropicCtor, messagesCreate, modelsList } = vi.hoisted(() => ({
  anthropicCtor: vi.fn(),
  messagesCreate: vi.fn(),
  modelsList: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: anthropicCtor,
}));

vi.mock('../prompt-templates', () => ({
  getTemplateContent: vi.fn(async () => 'system prompt'),
}));

vi.mock('../ai-config', () => ({
  getAISettings: vi.fn(async () => ({
    activeProvider: 'anthropic',
    anthropic: {
      apiKey: 'test-api-key',
      model: 'claude-test-model',
      maxTokens: 1234,
    },
  })),
}));

import { ClaudeProvider } from './claude';

describe('ClaudeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    anthropicCtor.mockImplementation(function MockAnthropic() {
      return {
        messages: { create: messagesCreate },
        models: { list: modelsList },
      };
    });
  });

  it('generates feedback from the first text content block', async () => {
    messagesCreate.mockResolvedValue({
      content: [
        { type: 'text', text: 'Coach the player toward evidence-based containment.' },
      ],
    });

    const provider = new ClaudeProvider();
    const result = await provider.generateFeedback({
      scenarioTitle: 'Quiet Lab Leak',
      scenarioType: 'INSIDER_THREAT',
      phase: 'Containment',
      injectNarrative: 'A researcher copied restricted files to an external share.',
      playerRole: 'Facilitator',
      chosenOption: 'Disable the user and preserve the workstation.',
      scoreWeight: 85,
      isOptimal: true,
      optimalOptionText: 'Disable the user and preserve the workstation.',
      mitreAttackId: 'T1041',
      mitreAttackName: 'Exfiltration Over C2 Channel',
      nistCsfFunction: 'Protect',
    });

    expect(anthropicCtor).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    expect(messagesCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-test-model',
      max_tokens: 1234,
      system: 'system prompt',
      messages: [
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('Quiet Lab Leak'),
        }),
      ],
    }));
    expect(result).toEqual({
      feedback: 'Coach the player toward evidence-based containment.',
      provider: 'claude',
    });
  });

  it('reports availability when the Claude models endpoint responds', async () => {
    modelsList.mockResolvedValue({ data: [] });

    const provider = new ClaudeProvider();

    await expect(provider.isAvailable()).resolves.toBe(true);
    expect(modelsList).toHaveBeenCalledOnce();
  });
});
