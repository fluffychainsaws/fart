# Home-page voice samples ("Hear the voices of F.A.R.T.")

The home page can show a "Hear the voices of F.A.R.T." section where each voice
plays a short **pre-recorded** clip. Pre-recording means **zero per-play cost** —
the files are served statically like images.

The section stays hidden until the clips exist: flip `SAMPLES_READY` to `true`
in `src/lib/voiceSamples.ts` once the 11 files are committed under
`public/voices/`.

The line every voice reads:

> Hey! I'm the friend that doesn't suck! Let's audition and make you a star!

## Files needed (in `public/voices/`)

| Tier    | Female                                   | Male                                     |
| ------- | ---------------------------------------- | ---------------------------------------- |
| Free    | `af_heart.mp3` `af_sarah.mp3` `af_aoede.mp3` | `am_fenrir.mp3` `am_eric.mp3` `am_michael.mp3` |
| Premium | `lily.mp3` `domi.mp3`                     | `clyde.mp3` `adam.mp3` `antoni.mp3`      |

## Generating them

**Premium (5, ElevenLabs — needs your key):**

```bash
ELEVENLABS_API_KEY=sk_xxx ./scripts/voice-samples/gen-premium.sh
```

Outputs `.mp3` straight into `public/voices/`. (Requires `jq`.)

**Free (6, Kokoro — no key, runs in your browser):**

1. Open `scripts/voice-samples/gen-free.html` in a normal browser (needs internet).
2. Click **Generate 6 clips** — it downloads six `.wav` files.
3. Convert to mp3 and move them in:

```bash
for f in af_heart af_sarah af_aoede am_fenrir am_eric am_michael; do
  ffmpeg -y -i "$f.wav" -codec:a libmp3lame -q:a 4 "public/voices/$f.mp3"
done
```

## Then

1. Confirm all 11 files are in `public/voices/`.
2. Set `SAMPLES_READY = true` in `src/lib/voiceSamples.ts`.
3. Commit and push.

_(Prefer not to run anything? Send the 11 audio files and they'll be wired in.)_
