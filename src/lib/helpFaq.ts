// Offline FAQ "brain" for the helper bot. No API, no per-message cost — answers
// are matched from this list by keyword overlap. Keep answers short, friendly,
// and specific to F.A.R.T. Add entries here to teach the bot new topics.

export interface FaqEntry {
  id: string;
  /** Display question (also used as a suggestion chip when listed in SUGGESTED). */
  q: string;
  /** Lowercase trigger words/phrases. Longer phrases score higher. */
  keywords: string[];
  a: string;
}

export const GREETING =
  "Hi! I'm F.A.R.T.'s helper bot 🤖 Ask me anything about how the app works — or tap a question below to get started.";

export const FALLBACK =
  "Hmm, I don't have an answer for that one yet. Try tapping a suggested question, or ask me about pricing, voices, hands-free commands, importing your script, or getting started.";

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: 'what-is',
    q: 'What is F.A.R.T.?',
    keywords: ['what is', 'what does', 'about', 'what can you do', 'fart mean', 'purpose'],
    a: 'F.A.R.T. (Friendly AI Reader To-Go) is your pocket scene partner. It reads every other character’s lines out loud in a natural voice and waits for your cue, so you can rehearse your sides anywhere — no human reader needed.',
  },
  {
    id: 'how-works',
    q: 'How does it work?',
    keywords: ['how does it work', 'how do i use', 'how to use', 'get started', 'getting started', 'begin', 'steps'],
    a: 'Three steps: 1) Tap “New Script” and snap a photo or upload a PDF of your sides. 2) Highlight which lines are yours. 3) Hit Play — F.A.R.T. reads the other characters and pauses for your lines.',
  },
  {
    id: 'import',
    q: 'How do I add my script?',
    keywords: ['add script', 'import', 'upload', 'photo', 'pdf', 'scan', 'my sides', 'new script', 'picture'],
    a: 'Tap “New Script,” then take photos of your pages or drop in a PDF. F.A.R.T. reads the text automatically and lets you mark which lines are yours — no retyping.',
  },
  {
    id: 'voices',
    q: 'How good are the voices?',
    keywords: ['voice', 'voices', 'natural', 'quality', 'sound', 'realistic', 'robotic', 'accent'],
    a: 'Very natural — each character gets a distinct, lifelike voice, not a robotic monotone. You can also download premium neural voices to use offline.',
  },
  {
    id: 'handsfree',
    q: 'Can I go hands-free?',
    keywords: ['hands free', 'hands-free', 'voice command', 'commands', 'say start', 'without touching', 'mic control'],
    a: 'Yes! Say “F.A.R.T. start” to roll, “F.A.R.T. stop” to stop, and “F.A.R.T. restart” to run it back — you never have to touch your phone mid-take.',
  },
  {
    id: 'improv',
    q: 'Does it handle improv?',
    keywords: ['improv', 'improvise', 'off script', 'off-script', 'mistake', 'flub', 'mess up', 'go off'],
    a: 'It does. If you improvise or go off-script, the reader still responds naturally and waits for your real cue instead of racing ahead on a timer.',
  },
  {
    id: 'listen',
    q: 'Will it wait for my cue?',
    keywords: ['wait for', 'my cue', 'cue', 'listen for my lines', 'listen', 'follow along', 'timing', 'pace'],
    a: 'Turn on “Listen for my lines” and F.A.R.T. listens for you to finish your line, then delivers the next one right on cue — just like a real scene partner.',
  },
  {
    id: 'directions',
    q: 'Can I direct the delivery?',
    keywords: ['direct', 'direction', 'directions', 'note', 'notes', 'angrier', 'pause', 'emotion', 'tone', 'delivery'],
    a: 'Yes — add notes like “angrier,” “pause here,” or “cut me off,” and the reader adapts its delivery to match.',
  },
  {
    id: 'pricing',
    q: 'How much does it cost?',
    keywords: ['price', 'pricing', 'cost', 'how much', 'plan', 'plans', 'subscription', 'pay', 'free', 'expensive'],
    a: 'You can start free — your first audition is on us. After that, plans and Audition Credits live on the Plan page. Tap “Plan” in the menu to see the options.',
  },
  {
    id: 'credits',
    q: 'What are Audition Credits?',
    keywords: ['credit', 'credits', 'audition credit', 'token', 'run out', 'top up', 'refill'],
    a: 'Audition Credits let you prep new sides with the premium AI features. You get some free to start, and you can top up or subscribe on the Plan page.',
  },
  {
    id: 'devices',
    q: 'What devices does it work on?',
    keywords: ['device', 'devices', 'phone', 'iphone', 'android', 'install', 'download', 'browser', 'computer', 'app store'],
    a: 'Any device with a browser — iPhone, Android, tablet, or computer. No app install needed; you can add it to your home screen in one tap.',
  },
  {
    id: 'account',
    q: 'Do I need an account?',
    keywords: ['account', 'sign up', 'signup', 'sign in', 'log in', 'login', 'register'],
    a: 'You can try the demo with no sign-up. To save your scripts and credits across devices, create a free account from the menu.',
  },
  {
    id: 'privacy',
    q: 'Is my script private?',
    keywords: ['privacy', 'private', 'data', 'secure', 'safe', 'store', 'confidential'],
    a: 'Your sides are yours. Check the Privacy and Terms links at the bottom of the menu for the details on how your data is handled.',
  },
  {
    id: 'contact',
    q: 'How do I get more help?',
    keywords: ['help', 'support', 'contact', 'human', 'email', 'problem', 'bug', 'issue', 'broken', 'not working'],
    a: 'I can answer the common questions right here! For anything I can’t cover, check the Settings page or reach out through the contact details on our site.',
  },
];

/** Questions surfaced as tappable chips in the chat panel. */
export const SUGGESTED: string[] = [
  'How does it work?',
  'How much does it cost?',
  'How good are the voices?',
  'Can I go hands-free?',
];

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Best-effort match: score each entry by how many of its keywords appear in the
// question (longer keywords weigh more). Returns the top scorer, or null so the
// caller can show the fallback.
export function matchFaq(text: string): FaqEntry | null {
  const q = normalize(text);
  if (!q) return null;
  let best: FaqEntry | null = null;
  let bestScore = 0;
  for (const entry of FAQ_ENTRIES) {
    let score = 0;
    for (const kw of entry.keywords) {
      const k = normalize(kw);
      if (k && q.includes(k)) score += 1 + k.length / 12; // longer phrase = stronger signal
    }
    // A direct hit on the question text itself is a strong signal.
    if (q.includes(normalize(entry.q)) || normalize(entry.q).includes(q)) score += 3;
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return bestScore > 0 ? best : null;
}
