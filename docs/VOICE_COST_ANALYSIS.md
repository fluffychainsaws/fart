# Voice Provider Cost Analysis & ElevenLabs Plan

Notes from working through whether/when to move premium voices from ChatGPT
(OpenAI) to ElevenLabs, and what it would cost. Numbers are guesstimates with
wide error bars — verify current pricing at platform.openai.com,
console.anthropic.com, and elevenlabs.io/pricing before committing.

## TL;DR

- **Today:** premium voices run on **ChatGPT (OpenAI)** — pay-as-you-go, pennies.
  Real usage in the first test month was **7,161 characters ≈ $0.12**.
- **ChatGPT can't do custom voices** (fixed ~11 voices only). Custom voices
  (e.g. Samantha, Carl, cloned voices) require **ElevenLabs**.
- **Plan:** make ElevenLabs a **premium-tier perk**, routed by plan on the
  server, dormant until an ElevenLabs API key is set. Scope (SHART STAR only vs
  also FART Pro) = **decide at switch time**.
- **Use ElevenLabs' cheaper Flash model** when switching (~half the per-character
  cost).
- **Keep the server spend caps** — they're what stop an unlimited tier from ever
  losing unbounded money.

## Cost model inputs (approx)

- **ChatGPT TTS (gpt-4o-mini-tts):** ~$0.015/min ≈ 900 chars/min → ~$0.017 per
  1,000 characters.
- **ElevenLabs:** monthly subscription with a character quota (not pure
  pay-as-you-go). Rough tiers: Free ~10k chars ($0, non-commercial), Starter ~30k
  (~$5), Creator ~100k (~$22), Pro ~500k (~$99), Scale ~2M (~$330), Business ~11M
  (~$1,320). `eleven_multilingual_v2` ≈ 1 credit/char; **Flash/Turbo ≈ 0.5
  credit/char** (half cost).
- **Claude script parsing:** Haiku 4.5, ~$0.007/page ballpark.
- **Claude director notes:** Opus 4.8, ~$0.02–0.023 per note (the quiet cost).

## Server spend caps already in the code (the safety net)

- **Voice:** 200,000 characters/user/month (`TTS_MONTHLY_CHAR_LIMIT` in
  `supabase/functions/synthesize-voice/index.ts`).
- **Director notes:** 300/user/month (`DIRECTION_MONTHLY_LIMIT` in
  `supabase/functions/parse-script/index.ts`).
- **Script parsing:** no monthly cap for SHART STAR (unlimited auditions) — the
  one open-ended cost.

## Worst-case stress test (everyone maxes every limit)

### 100 maxed FART Pro users ($10/mo)
Maxed = 14 scripts × 12 pages, ~280 notes, ElevenLabs on every line (~180k chars).

| Cost | × 100/mo |
|------|----------|
| ElevenLabs voice | ~$1,200 (Flash) – $2,400 (premium model) |
| Opus director notes | ~$500–600 |
| Haiku parsing | ~$100–150 |
| Supabase / infra | ~$25–75 |
| "Other" padding | ~$200–400 |
| **TOTAL** | **~$2,000 – 3,600 / month** |

Revenue: 100 × $10 = **$1,000/month** → **LOSS of ~$1,500–2,500/mo at max.**
=> ElevenLabs on the $10 tier at heavy usage is upside-down.

### 100 maxed SHART STAR users ($25/mo)
Maxed = hits the 200k voice cap + 300-note cap + heavy parsing.

| Cost | × 100/mo |
|------|----------|
| ElevenLabs voice | ~$1,200 (Flash) – $2,400 (premium model) |
| Opus director notes | ~$700 |
| Haiku parsing | ~$500–800 |
| Supabase / infra | ~$50 |
| "Other" padding | ~$300 |
| **TOTAL** | **~$2,750 (Flash) – $4,200 (premium model)** |

Revenue: 100 × $25 = **$2,500/month** → break-even to slightly negative *at the
theoretical max*, profitable only with the Flash model. The caps are what keep
it bounded.

## Realistic usage (what actually happens)

Industry data + a working actor's real experience: a hustling represented actor
averages ~50–100 auditions/**year** (~4–8/month); peak weeks ~5–6, slow weeks
~0–1. Self-tape sides: film/TV ~2–4 pages, commercials ~1 page.

Realistic paying user, per month:

| Metric | Realistic | vs cap |
|--------|-----------|--------|
| Voice characters | ~15,000–35,000 | 200k cap → 8–18% |
| Director notes | ~40–70 | 300 cap |
| Pages parsed | ~18–40 | — |

Realistic cost per user/month (ElevenLabs Flash):

| | Busy (~15k chars) | Heavy (~35k chars) |
|---|---|---|
| ElevenLabs voice | ~$0.90 | ~$2.10 |
| Opus notes | ~$0.90 | ~$1.60 |
| Haiku parsing | ~$0.12 | ~$0.27 |
| **Total** | **~$2/mo** | **~$4/mo** |
| **Margin on $25** | **~92%** | **~84%** |

**100 realistic SHART STAR users ≈ ~$400/mo cost vs $2,500 revenue → ~$2,100
profit (~84% margin).** Even FART Pro + ElevenLabs pencils to ~$8 margin on $10
at realistic usage — the "loss" only appears at the rare max-out outlier, which
the caps contain.

## Recommendations

1. **ElevenLabs → premium tier only** (SHART STAR $25; decide later whether FART
   Pro also gets it). Keeps it exclusive, costs contained, gives a real reason to
   upgrade.
2. **Use the Flash model** — roughly half the voice cost; the difference between
   profit and loss at scale.
3. **Keep (or even lower) the server caps** — 200k voice chars is ~28× a real
   user's usage; could drop to 100k with no one noticing.
4. **Watch the Opus director notes** (~$500–700 at max on both tiers) — moving
   note interpretation to a cheaper model is the best margin win if volume grows.

## How the switch would work (for later)

Small change to `supabase/functions/synthesize-voice/index.ts`: look up the
caller's `profiles.tier` (the function already has a service-role client) and
route premium-tier users to ElevenLabs, everyone else to ChatGPT. Stays dormant
(everyone on ChatGPT) until `ELEVENLABS_API_KEY` is set. Then:

1. Add ElevenLabs voice slots + labels in `src/lib/cloudVoice.ts` and the
   `ELEVEN_VOICE_MAP` in `synthesize-voice`.
2. Set Supabase Edge Function secrets: `ELEVENLABS_API_KEY` (and provider/model
   config).
3. Redeploy `synthesize-voice`.

Sources for realistic-usage figures:
- https://bonniegillespie.com/average-number-of-auditions/
- https://actingmagazine.com/2025/01/how-often-do-actors-get-auditions/
- https://www.confidenceoncamera.com/how-many-auditions-is-normal/
- https://variety.com/2023/film/features/self-tape-controversy-cost-sag-actors-1235617672/
