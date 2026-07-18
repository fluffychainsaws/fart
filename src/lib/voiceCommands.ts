// "FART start" / "FART cut", with the recognizer's most common mishearings of
// "fart" accepted so the command still lands from across the room. Used by
// the rehearsal screen's hands-free voice commands.
export const START_CMD = /\b(fart|fart's|far|part|art|heart|bart|fort|fought)\W{0,3}(start|starts|go)\b/;
export const CUT_CMD = /\b(fart|fart's|far|part|art|heart|bart|fort|fought)\W{0,3}(cut|cuts|caught|stop)\b/;
