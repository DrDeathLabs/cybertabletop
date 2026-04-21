import { useState, useCallback } from 'react';

export type FieldType = 'rationale' | 'hot-wash' | 'onboarding';

export interface TextQualityContext {
  text: string;
  fieldType: FieldType;
  contextHint?: string;
  scenarioType?: string;
  playerRole?: string;
}

export interface TextQualityResult {
  isReady: boolean;
  issues: string[];
  revisedText: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface UseTextQualityResult {
  check: (ctx: TextQualityContext) => Promise<TextQualityResult | null>;
  result: TextQualityResult | null;
  isChecking: boolean;
  clear: () => void;
}

export function useTextQuality(): UseTextQualityResult {
  const [result, setResult] = useState<TextQualityResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const check = useCallback(async (ctx: TextQualityContext): Promise<TextQualityResult | null> => {
    if (!ctx.text?.trim()) return null;

    setIsChecking(true);
    setResult(null);

    try {
      const res = await fetch('/api/ai/check-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(ctx),
      });

      if (!res.ok) {
        // Fail open — don't block the user
        return null;
      }

      const data = (await res.json()) as TextQualityResult;
      setResult(data);
      return data;
    } catch {
      return null;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
  }, []);

  return { check, result, isChecking, clear };
}
