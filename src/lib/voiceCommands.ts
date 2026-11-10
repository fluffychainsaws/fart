// "Buddy start" / "Buddy restart" / "Buddy stop" — the hands-free commands on
// the rehearsal screen, with the recognizer's most common mishearings of
// "buddy" accepted so a command still lands from across the room.
//
// Each pattern must match the WHOLE utterance rather than merely appear inside
// it. "buddy" is ordinary scene dialogue in a way the old wake word was not, so
// a line like "Buddy, stop it!" would otherwise pause the take. Requiring the
// utterance to be nothing but the command — allowing only a leading "hey"/"ok"
// and a trailing "please"/"now" — means a delivered line has to be a bare
// "buddy stop" to count.
//
// Anchoring alone is not enough: with interim results on, "Buddy, stop it!"
// passes through an interim transcript of exactly "buddy stop". The rehearsal
// screen therefore acts on FINAL segments only, and the two halves together are
// what make this safe. Changing one without the other reopens the hole.
//
// The cost is that commands must now be said on their own: "buddy start the
// scene" no longer rolls. That is the trade for not stopping mid-take.
//
// RESTART_CMD is checked before START_CMD; "restart" has no word boundary
// before "start", so START_CMD never matches it, but the ordering keeps intent
// obvious. "reset" and "start over" are accepted as natural synonyms.

const WAKE = "(?:buddy|buddy's|buddie|buddies|body|bodies|bud|butty|putty|bubby|buddha)";
const LEAD = String.raw`^\W*(?:hey|ok|okay|yo)?\W*`;
const TAIL = String.raw`\W*(?:please|now)?\W*$`;

const command = (verbs: string) => new RegExp(`${LEAD}${WAKE}\\W{0,3}(?:${verbs})${TAIL}`);

export const START_CMD = command('start|starts|go');
export const RESTART_CMD = command('restart|restarts|reset|resets|start over|start again');
export const CUT_CMD = command('cut|cuts|caught|stop');
