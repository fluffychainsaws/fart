import { newId } from './storage';
import type { FartScript } from './types';

// A short original two-hander so new users can try the reader
// before pointing a camera at real sides.
export function makeDemoScript(): FartScript {
  return {
    id: newId(),
    title: 'The Key (demo scene)',
    createdAt: Date.now(),
    myCharacter: null,
    elements: [
      { type: 'direction', text: 'INT. INTERROGATION ROOM — NIGHT' },
      {
        type: 'direction',
        text: 'A single lamp buzzes overhead. DETECTIVE REESE drops a folder on the steel table. The SUSPECT does not flinch.',
      },
      {
        type: 'line',
        character: 'REESE',
        text: 'You were seen leaving the building at 11:40. The call came in at 11:38.',
      },
      { type: 'line', character: 'SUSPECT', text: 'Then your witness needs glasses.' },
      { type: 'line', character: 'REESE', text: 'My witness is a security camera.' },
      { type: 'direction', text: 'Reese slides a photograph across the table.' },
      { type: 'line', character: 'SUSPECT', text: 'That could be anyone in a gray coat.' },
      { type: 'line', character: 'REESE', text: 'Anyone with your watch? Your walk?' },
      { type: 'direction', text: 'A long pause. The Suspect leans back, arms folded.' },
      { type: 'line', character: 'SUSPECT', text: 'I want a lawyer.' },
      {
        type: 'line',
        character: 'REESE',
        text: "You'll get one. Right after you tell me why you kept the key.",
      },
      {
        type: 'direction',
        text: 'Reese sets a single brass key on the table. The Suspect goes very still.',
      },
      { type: 'line', character: 'SUSPECT', text: 'Where did you get that?' },
      {
        type: 'line',
        character: 'REESE',
        text: 'Wrong question. The right one is how I knew to look.',
      },
      { type: 'line', character: 'SUSPECT', text: "You're bluffing." },
      { type: 'direction', text: 'Reese leans in, voice low.' },
      {
        type: 'line',
        character: 'REESE',
        text: "Maybe. But you've got a coat that matches, a watch that matches, and a key to a door you swore you'd never seen.",
      },
      { type: 'direction', text: "The Suspect's jaw tightens. Something breaks behind the eyes." },
      {
        type: 'line',
        character: 'SUSPECT',
        text: "...Okay. Okay. But it didn't happen the way you think.",
      },
      { type: 'line', character: 'REESE', text: 'They never do. Start talking.' },
    ],
  };
}
