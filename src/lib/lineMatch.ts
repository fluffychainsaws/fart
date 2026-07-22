// Fuzzy matching between a script line and what speech recognition heard,
// used by voice follow to decide when the actor has finished their line.

export function lineWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// Greedy in-order match: each spoken word may advance the line pointer if it
// matches one of the next 3 expected words, so recognition dropping or
// mangling the odd word doesn't stall progress, while out-of-order noise
// (background chatter, filler words) is ignored.
export function matchedWordCount(line: string[], spoken: string[]): number {
  let li = 0;
  for (const word of spoken) {
    if (li >= line.length) break;
    const windowEnd = Math.min(li + 3, line.length);
    for (let j = li; j < windowEnd; j++) {
      if (line[j] === word) {
        li = j + 1;
        break;
      }
    }
  }
  return li;
}

// The tail allowance scales with line length: recognition routinely misses a
// final word or two, and waiting for a perfect match would add exactly the
// kind of dead air voice follow exists to remove. (Used for strict matching
// only — Improv mode ignores word matching and continues purely on a pause.)
export function isLineComplete(line: string[], matched: number): boolean {
  if (line.length === 0) return true;
  const missing = line.length - matched;
  if (line.length <= 3) return missing <= 0;
  if (line.length <= 8) return missing <= 1;
  return missing <= 2;
}
