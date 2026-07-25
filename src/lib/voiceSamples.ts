// "Hear the voices of F.A.R.T." home-page demo. Each voice has a short
// pre-recorded clip served statically from /voices/<id>.mp3 — generated once
// (see scripts/voice-samples/README.md), so there's zero per-play cost.
//
// SAMPLES_READY gates the whole section: flip it to true once the 11 audio
// files are committed under public/voices/.
export const SAMPLES_READY = false;

// The line every voice reads, so visitors can compare them like-for-like.
export const SAMPLE_LINE =
  "Hey! I'm the friend that doesn't suck! Let's audition and make you a star!";

export interface VoiceSample {
  id: string; // also the audio filename: /voices/<id>.mp3
  name: string;
}

export interface VoiceGroup {
  female: VoiceSample[];
  male: VoiceSample[];
}

// Free = Kokoro (on-device) voice ids.
export const FREE_VOICES: VoiceGroup = {
  female: [
    { id: 'af_heart', name: 'Heart' },
    { id: 'af_sarah', name: 'Sarah' },
    { id: 'af_aoede', name: 'Aoede' },
  ],
  male: [
    { id: 'am_fenrir', name: 'Fenrir' },
    { id: 'am_eric', name: 'Eric' },
    { id: 'am_michael', name: 'Michael' },
  ],
};

// Premium = ElevenLabs voices.
export const PREMIUM_VOICES: VoiceGroup = {
  female: [
    { id: 'lily', name: 'Lily' },
    { id: 'domi', name: 'Domi' },
  ],
  male: [
    { id: 'clyde', name: 'Clyde' },
    { id: 'adam', name: 'Adam' },
    { id: 'antoni', name: 'Antoni' },
  ],
};

export const voiceSampleSrc = (id: string) => `/voices/${id}.mp3`;
