// "FART start" / "FART cut", with the recognizer's most common mishearings of
// "fart" accepted so the command still lands from across the room. Shared by
// the native (expo-speech-recognition) and web (Web Speech API) self-tape
// screens so the phrase list only lives in one place.
export const START_CMD = /\b(fart|fart's|far|part|art|heart|bart|fort|fought)\W{0,3}(start|starts|go)\b/;
export const CUT_CMD = /\b(fart|fart's|far|part|art|heart|bart|fort|fought)\W{0,3}(cut|cuts|caught|stop)\b/;
