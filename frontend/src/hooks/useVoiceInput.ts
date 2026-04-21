import { useState, useRef, useCallback } from 'react';

export interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  lang?: string;
}

export interface UseVoiceInputResult {
  isListening: boolean;
  isSupported: boolean;
  interimText: string;
  start: () => void;
  stop: () => void;
  error: string | null;
}

type AnyRecognition = any;

export function useVoiceInput({ onTranscript, lang = 'en-US' }: UseVoiceInputOptions): UseVoiceInputResult {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<AnyRecognition>(null);

  const SpeechRecognitionAPI: (new () => AnyRecognition) | undefined =
    typeof window !== 'undefined'
      ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition)
      : undefined;

  const isSupported = Boolean(SpeechRecognitionAPI);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimText('');
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognitionAPI) return;
    if (isListening) {
      stop();
      return;
    }

    setError(null);
    setInterimText('');

    const recognition: AnyRecognition = new SpeechRecognitionAPI();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      setInterimText(interim);
      if (final) {
        onTranscript(final);
        setInterimText('');
      }
    };

    recognition.onerror = (event: any) => {
      const msg =
        event.error === 'not-allowed'
          ? 'Microphone access denied. Please allow microphone access in your browser.'
          : event.error === 'no-speech'
          ? 'No speech detected. Please try again.'
          : `Voice input error: ${event.error}`;
      setError(msg);
      setIsListening(false);
      setInterimText('');
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText('');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [SpeechRecognitionAPI, isListening, lang, onTranscript, stop]);

  return { isListening, isSupported, interimText, start, stop, error };
}
