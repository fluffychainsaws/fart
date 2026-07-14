import { newId } from './storage';
import type { FartScript } from './types';

// A short original two-hander so new users can try the reader
// before pointing a camera at real sides.
export function makeDemoScript(): FartScript {
  return {
    id: newId(),
    title: 'Coffee First (demo scene)',
    createdAt: Date.now(),
    myCharacter: null,
    elements: [
      { type: 'direction', text: 'INT. APARTMENT KITCHEN — MORNING' },
      {
        type: 'direction',
        text: 'MAYA, half-awake, stares into an empty coffee bag. Her roommate JORDAN bounces in, way too cheerful.',
      },
      { type: 'line', character: 'JORDAN', text: 'Morning, sunshine! Big day. Big, big day.' },
      { type: 'line', character: 'MAYA', text: 'The bag is empty, Jordan.' },
      {
        type: 'line',
        character: 'JORDAN',
        text: 'Correct! Because today we switch to my new blend. Roasted it myself.',
      },
      { type: 'direction', text: 'Jordan slides a mug across the counter like a bartender.' },
      { type: 'line', character: 'MAYA', text: 'It smells like a campfire lost a fight.' },
      { type: 'line', character: 'JORDAN', text: "That's the oak finish. Sip it." },
      { type: 'direction', text: 'Maya sips. A long pause.' },
      { type: 'line', character: 'MAYA', text: 'Okay. Wow. What is this?' },
      { type: 'line', character: 'JORDAN', text: 'Victory. In a mug.' },
      { type: 'line', character: 'MAYA', text: 'I hate that I love it.' },
      { type: 'direction', text: 'Maya drains the mug and holds it out.' },
      {
        type: 'line',
        character: 'MAYA',
        text: 'Make me another one. And Jordan? Never speak before nine again.',
      },
    ],
  };
}
