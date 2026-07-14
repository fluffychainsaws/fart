# FART 💨 — Friendly AI Reader To-go

Your pocket scene partner. Snap a photo of your audition sides, highlight your lines, and FART reads everyone else's lines out loud while you rehearse yours.

Built with Expo (React Native) — one codebase for iOS and Android.

## How it works

1. **📸 New script** — take a photo of each page of your sides (or pick them from your photo library).
2. FART sends the photos to Claude, which transcribes them into a structured script (dialogue vs. stage directions).
3. **🎭 Pick your role** — tap your character to highlight all of their lines, or tap individual lines to highlight/un-highlight them.
4. **▶ Rehearse** — the AI reader speaks the other characters' lines (each role gets a slightly different voice) and pauses at yours. Tap "Said it — continue" when you've delivered your line, or turn on auto-continue.

There's a built-in demo scene so you can try the reader without any photos.

## Setup

```bash
npm install
```

Put your Anthropic API key in `.env` (copy from `.env.example`):

```
EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
```

Get a key at [console.anthropic.com](https://console.anthropic.com). Restart the dev server after changing `.env`.

## Run it

```bash
npx expo start
```

- **On your phone**: install the [Expo Go](https://expo.dev/go) app, then scan the QR code from the terminal (same Wi-Fi network).
- **In a browser**: press `w` (handy for quick testing; the camera button becomes a file picker).

## Good to know

- Script photos are parsed by `claude-opus-4-8` (see [src/lib/parser.ts](src/lib/parser.ts)). A scan costs a few cents; swap the `MODEL` constant for `claude-haiku-4-5` if you want cheaper scans.
- Speech uses the device's built-in text-to-speech (free, works offline once the script is parsed).
- **Before shipping publicly**: the API key is bundled into the app (`EXPO_PUBLIC_…`), which is fine for a personal dev build but not for distribution — move the Claude call behind a small server first.

## Roadmap ideas

- Assign your role by voice ("I'm reading Maya")
- Listen mode: detect when you've finished your line instead of tapping
- Premium cloud voices per character
- Line memorization mode (hide your lines, hint on demand)
