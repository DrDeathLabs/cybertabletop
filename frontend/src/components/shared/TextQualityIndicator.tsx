import { CheckCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import type { TextQualityResult } from '../../hooks/useTextQuality';

interface TextQualityIndicatorProps {
  result: TextQualityResult | null;
  isChecking: boolean;
  onAcceptRevision: (text: string) => void;
  onDismiss: () => void;
}

/**
 * Displays the result of an AI text quality check.
 * - Checking: spinner
 * - Ready: green badge
 * - Not ready: yellow card with issues + suggested revision + Accept/Dismiss
 */
export function TextQualityIndicator({
  result,
  isChecking,
  onAcceptRevision,
  onDismiss,
}: TextQualityIndicatorProps) {
  if (isChecking) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 mt-2">
        <Loader2 size={14} className="animate-spin" />
        <span>Checking quality…</span>
      </div>
    );
  }

  if (!result) return null;

  if (result.isReady) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-400 mt-2">
        <CheckCircle size={14} />
        <span>Publication ready</span>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-950/40 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle size={15} className="text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-300">Review suggested before publishing</p>
          {result.issues.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {result.issues.map((issue, i) => (
                <li key={i} className="text-xs text-amber-200/80">• {issue}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {result.revisedText && (
        <div className="rounded border border-amber-500/20 bg-black/20 p-2">
          <p className="text-xs text-gray-400 mb-1">Suggested revision:</p>
          <p className="text-sm text-gray-200 italic">{result.revisedText}</p>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {result.revisedText && (
          <button
            type="button"
            onClick={() => onAcceptRevision(result.revisedText!)}
            className="flex items-center gap-1.5 px-3 py-1 text-xs rounded bg-amber-600 hover:bg-amber-500 text-white transition-colors"
          >
            <RefreshCw size={11} />
            Accept revision
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
        >
          Keep original
        </button>
      </div>
    </div>
  );
}
