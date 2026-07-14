import * as Speech from 'expo-speech';

// Deterministic per-character pitch so each role sounds a little different.
export function pitchFor(character: string): number {
  let h = 0;
  for (let i = 0; i < character.length; i++) {
    h = (h * 31 + character.charCodeAt(i)) >>> 0;
  }
  return 0.85 + (h % 7) * 0.05; // 0.85 .. 1.15
}

// Resolves when the utterance ends, errors, or is stopped. A generous timeout
// backstops platforms where onDone never fires (some web browsers).
export function speakOnce(text: string, opts: { rate?: number; pitch?: number } = {}): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve();
      }
    };
    const words = text.trim().split(/\s+/).length;
    const timer = setTimeout(finish, 4000 + (words * 800) / (opts.rate ?? 1));
    try {
      Speech.speak(text, {
        rate: opts.rate,
        pitch: opts.pitch,
        onDone: finish,
        onStopped: finish,
        onError: finish,
      });
    } catch {
      finish();
    }
  });
}

export function stopSpeaking() {
  Speech.stop();
}
