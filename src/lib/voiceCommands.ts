// "FART start" / "FART restart" / "FART stop", with the recognizer's most
// common mishearings of "fart" accepted so the command still lands from across
// the room. Used by the rehearsal screen's hands-free voice commands.
//
// RESTART_CMD is checked before START_CMD; "restart" has no word boundary
// before "start", so START_CMD never matches it, but the ordering keeps intent
// obvious. "reset" and "start over" are accepted as natural synonyms.
export const START_CMD = /\b(fart|fart's|far|part|art|heart|bart|fort|fought)\W{0,3}(start|starts|go)\b/;
export const RESTART_CMD = /\b(fart|fart's|far|part|art|heart|bart|fort|fought)\W{0,3}(restart|restarts|reset|resets|start over|start again)\b/;
export const CUT_CMD = /\b(fart|fart's|far|part|art|heart|bart|fort|fought)\W{0,3}(cut|cuts|caught|stop)\b/;
