export type ScriptElement =
  | { type: 'direction'; text: string }
  | { type: 'line'; character: string; text: string; mine?: boolean };

export interface FartScript {
  id: string;
  title: string;
  createdAt: number;
  myCharacter: string | null;
  elements: ScriptElement[];
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
