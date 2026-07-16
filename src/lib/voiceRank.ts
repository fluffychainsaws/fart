// Quality ranking for device/browser voices. On web every voice reports
// quality "Default", so the only signal is the voice's name and whether it's
// served locally — and the difference is huge: Edge ships free neural
// "(Natural)" voices that rival paid TTS, Chrome ships hosted Google voices,
// while macOS exposes dozens of novelty voices ("Bells", "Zarvox"…) and
// legacy robots ("Fred") that should never read a scene.

export interface RankableVoice {
  identifier: string;
  name?: string;
  quality?: string; // 'Enhanced' on iOS neural voices
  localService?: boolean;
}

// macOS/iOS novelty + legacy robotic voices, excluded outright.
const NOVELTY =
  /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|pipe organ|superstar|trinoids|whisper|wobble|zarvox|grandma|grandpa|rocko|shelley|eddy|flo|reed|sandy|junior|kathy|fred|ralph|agnes|bruce|vicki|victoria)\b/;

// Higher is better; -1 means never use this voice.
export function voiceScore(v: RankableVoice): number {
  const name = (v.name ?? v.identifier).toLowerCase();
  if (NOVELTY.test(name)) return -1;
  let score = 0;
  if (v.quality === 'Enhanced') score += 4; // iOS neural voices
  if (/\bnatural\b/.test(name)) score += 4; // Edge's free neural voices
  if (/\bneural\b/.test(name)) score += 4;
  if (/\b(premium|enhanced)\b/.test(name)) score += 3;
  if (/\bgoogle\b/.test(name)) score += 2; // Chrome's hosted voices
  if (/\bonline\b/.test(name)) score += 1;
  if (v.localService === false) score += 1; // hosted voices are usually neural
  return score;
}

export function isHighQualityVoice(v: RankableVoice): boolean {
  return voiceScore(v) >= 3;
}

// Best-first, deterministic pool: novelty voices dropped; when at least two
// high-quality voices exist, mediocre ones are dropped too so the automatic
// per-character assignment can only land on good voices.
export function rankVoices<T extends RankableVoice>(voices: T[]): T[] {
  const scored = voices
    .map((v) => ({ v, score: voiceScore(v) }))
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score || a.v.identifier.localeCompare(b.v.identifier));
  const best = scored.filter((s) => s.score >= 3);
  return (best.length >= 2 ? best : scored).map((s) => s.v);
}
