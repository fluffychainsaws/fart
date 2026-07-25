#!/usr/bin/env bash
# Generate the 5 PREMIUM (ElevenLabs) voice-sample clips into public/voices/.
# Requires: an ElevenLabs API key and `jq`.
#
#   ELEVENLABS_API_KEY=sk_... ./scripts/voice-samples/gen-premium.sh
#
set -euo pipefail
: "${ELEVENLABS_API_KEY:?Set ELEVENLABS_API_KEY to your elevenlabs.io key}"

LINE="Hey! I'm the friend that doesn't suck! Let's audition and make you a star!"
OUT="$(cd "$(dirname "$0")/../../public/voices" 2>/dev/null && pwd || (mkdir -p "$(dirname "$0")/../../public/voices" && cd "$(dirname "$0")/../../public/voices" && pwd))"

# app slot name -> ElevenLabs voice id (from ELEVEN_VOICE_MAP in the
# synthesize-voice edge function).
names=(lily domi clyde adam antoni)
ids=(pFZP5JQG7iQjIQuC4Bku AZnzlk1XvdvUeBnXmlld 2EiwWnXFnvU5JabPnv8n pNInz6obpgDQGcFmaJgB ErXwobaYiN019PkySvjV)

for i in "${!names[@]}"; do
  name="${names[$i]}"
  vid="${ids[$i]}"
  curl -fsS -X POST \
    "https://api.elevenlabs.io/v1/text-to-speech/${vid}?output_format=mp3_44100_128" \
    -H "xi-api-key: ${ELEVENLABS_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg t "$LINE" '{text:$t, model_id:"eleven_multilingual_v2"}')" \
    -o "${OUT}/${name}.mp3"
  echo "wrote ${OUT}/${name}.mp3"
done
echo "Done — 5 premium clips in ${OUT}"
