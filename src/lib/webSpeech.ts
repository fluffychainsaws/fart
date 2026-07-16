// The Web Speech API (SpeechRecognition) is non-standard and not in TS's DOM
// lib, so this declares just the shape used by the web self-tape and mic-test
// screens, and the (webkit-prefixed) constructor lookup they share.
export interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  abort(): void;
  onresult:
    | ((event: {
        results: { length: number } & { [i: number]: { [j: number]: { transcript: string } } };
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

export function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
