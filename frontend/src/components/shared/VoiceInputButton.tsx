import { useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useVoiceInput } from '../../hooks/useVoiceInput';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  /** Optional callback that receives live interim (partial) transcript for display */
  onInterim?: (text: string) => void;
  className?: string;
  size?: 'sm' | 'md';
  lang?: string;
}

/**
 * Microphone button that activates browser-native speech recognition.
 * Appends the final transcript to whatever the caller wants to do with it.
 * Silently hidden when the browser doesn't support the Web Speech API.
 */
export function VoiceInputButton({
  onTranscript,
  onInterim,
  className = '',
  size = 'md',
  lang,
}: VoiceInputButtonProps) {
  const { isListening, isSupported, interimText, start, error } = useVoiceInput({
    onTranscript,
    lang,
  });

  // Surface interim text to parent if desired
  useEffect(() => {
    if (onInterim) onInterim(interimText);
  }, [interimText, onInterim]);

  if (!isSupported) return null;

  const iconSize = size === 'sm' ? 14 : 16;
  const btnClass =
    size === 'sm'
      ? 'p-1.5 rounded text-xs'
      : 'p-2 rounded-md text-sm';

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      <button
        type="button"
        onClick={start}
        title={isListening ? 'Click to stop recording' : 'Click to speak'}
        className={`${btnClass} transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
          isListening
            ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 animate-pulse'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white focus:ring-blue-500'
        }`}
      >
        {isListening ? (
          <MicOff size={iconSize} />
        ) : (
          <Mic size={iconSize} />
        )}
      </button>

      {isListening && (
        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
      )}

      {error && (
        <p className="mt-1 text-xs text-red-400 max-w-[180px] text-center">{error}</p>
      )}
    </div>
  );
}
