// "Buddy start" / "Buddy restart" / "Buddy stop", with the recognizer's most
// common mishearings of "buddy" accepted so the command still lands from across
// the room. Used by the rehearsal screen's hands-free voice commands.
//
// RESTART_CMD is checked before START_CMD; "restart" has no word boundary
// before "start", so START_CMD never matches it, but the ordering keeps intent
// obvious. "reset" and "start over" are accepted as natural synonyms.
//
// NOTE: "buddy" is a far more ordinary word in scene dialogue than the old wake
// word was, and "body" / "bud" are its likeliest mishearings. A line such as
// "Buddy, stop it!" will match CUT_CMD and pause the take. If that turns out to
// bite in real rehearsals, the fix is to require the wake word at the start of
// an utterance rather than anywhere in it.
export const START_CMD =
  /\b(buddy|buddy's|buddie|buddies|body|bodies|bud|butty|putty|bubby|buddha)\W{0,3}(start|starts|go)\b/;
export const RESTART_CMD =
  /\b(buddy|buddy's|buddie|buddies|body|bodies|bud|butty|putty|bubby|buddha)\W{0,3}(restart|restarts|reset|resets|start over|start again)\b/;
export const CUT_CMD =
  /\b(buddy|buddy's|buddie|buddies|body|bodies|bud|butty|putty|bubby|buddha)\W{0,3}(cut|cuts|caught|stop)\b/;
