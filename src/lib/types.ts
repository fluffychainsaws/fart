// A director's note on an AI-read line, compiled into delivery parameters.
// rate/pitch are multipliers on the line's base delivery; pauses are ms;
// cutoff makes this line barge in before the user finishes their previous line.
export interface Delivery {
  note: string;
  rate: number;
  pitch: number;
  pauseBeforeMs: number;
  pauseAfterMs: number;
  cutoff: boolean;
  // When the note asks to change the words (e.g. change line to "…"), the new
  // line text. The original element text is left untouched, so removing the
  // note restores it. Absent for ordinary tone/pacing notes.
  rewrite?: string;
}

export type ScriptElement =
  | { type: 'direction'; text: string }
  | { type: 'line'; character: string; text: string; mine?: boolean; delivery?: Delivery };

export interface FartScript {
  id: string;
  title: string;
  createdAt: number;
  // Set on every save; account sync uses it for last-write-wins merging.
  // Older local scripts may lack it — fall back to createdAt.
  updatedAt?: number;
  myCharacter: string | null;
  elements: ScriptElement[];
  // Per-character voice choices: "openai:coral" or "device:<identifier>".
  // Characters not in the map get an automatic voice.
  voices?: Record<string, string>;
  // Set when this script was created by spending an Audition Credit — grants
  // it SHART STAR-level features (voices, voice commands) for its own
  // rehearsals regardless of the account's actual subscription tier, with
  // director notes capped like the 'daypass' tier rather than unlimited.
  premiumCredit?: boolean;
}

export function charactersIn(elements: ScriptElement[]): string[] {
  const seen: string[] = [];
  for (const el of elements) {
    if (el.type === 'line' && !seen.includes(el.character)) {
      seen.push(el.character);
    }
  }
  return seen;
}

export function myLineCount(elements: ScriptElement[]): number {
  return elements.filter((el) => el.type === 'line' && el.mine).length;
}
