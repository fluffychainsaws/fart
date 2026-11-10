# Adaptive pacing — scoping

Status: **proposal, nothing built.** Decisions needed from the owner are in
[Open decisions](#open-decisions). Everything else is a recommendation.

## The problem

When auto-continue is on, the engine guesses how long your line takes and waits
that long before the reader comes back. The guess is a constant —
`src/lib/useRehearsal.ts:142`:

```js
const estimate = Math.max(1800, el.text.trim().split(/\s+/).length * 380);
```

380 ms per word is about 158 words a minute. That is a fair conversational
rate, but audition delivery is usually slower — dramatic readings commonly sit
nearer 100–130 wpm. So the default probably errs **fast**, which is the bad
direction: the reader talks over you. The next line can also deliberately barge
in at 45% of the estimate (`:143`), so an estimate that is too short makes the
cutoff feature cut in even earlier than intended.

Nothing about that number is personal to you, and the app already has the
information to replace it.

## The key insight

**"Listen for my lines" and the estimate are alternatives, not partners.**

When line-follow is on, `useLineFollow` fires `onComplete` the moment it matches
the end of your line, so the engine doesn't need an estimate at all — it waits
for the real thing. The estimate only matters when line-follow is **off**, or
unsupported on the device.

That gives the whole feature its shape:

> Line-follow teaches the timer. You rehearse with it on; it measures your real
> pace; the timer then uses what it learned on the sessions you run with it off.

No new input from you, no labelling, no new permissions beyond the mic you
already grant for line-follow.

## What we measure

One quantity, defined precisely so it stays honest:

**Wall-clock milliseconds from `setStatus('waiting')` (`useRehearsal.ts:136`) to
`onComplete` firing, divided by the word count of your line.**

That deliberately *includes* the beat before you start speaking. It should: the
timer's job is to decide how long to wait in total, not how fast you articulate.
Thinking time is part of the answer.

A sample is only recorded when:

- line-follow was on and it completed by **matching the script**, not by the
  improv silence fallback (`IMPROV_SILENCE_DEFAULT_MS`, 750 ms) — an improvised
  line has no reliable word count to divide by;
- the line is at least 3 words, so one-word lines don't dominate;
- the resulting ms/word lands inside a sane clamp (see below).

Nothing else is recorded. No audio, no transcript, no line text.

## What changes

The constant becomes a learned value, with the same shape and the same floor:

```js
const perWord = learnedMsPerWord ?? 380;   // same default when we know nothing
const estimate = Math.max(learnedFloor ?? 1800, words * perWord);
```

That is the entire behavioural change in slice 1. The cutoff fraction (0.45)
and the floor (1800) stay constant until there is evidence they should not.

## The maths, kept deliberately boring

- **Median, not mean**, over the last N samples (N ≈ 30). One interrupted take
  shouldn't move it; a median shrugs that off without any outlier cleverness.
- **Clamp each sample to 200–1200 ms/word** before it is stored. Outside that
  range it is not a line reading — it is a phone call, a cough, or the mic
  hearing a television.
- **Shrink toward 380 until there is enough data.** With `k` samples, use
  `(k·median + 5·380) / (k + 5)`. At 5 samples you are halfway to your own
  pace; by 30 you are essentially all the way there. No cliff, no "now it
  activates" moment.
- **Require ≥ 5 samples** before the learned value is used at all.

All integer arithmetic on a handful of numbers. No model, no training, no
inference cost.

## Storage and privacy

Slice 1 is device-local: one AsyncStorage key alongside the existing ones,
`fart.pacing.v1`:

```json
{ "samples": [412, 455, 390], "msPerWord": 421, "updatedAt": 1763000000000 }
```

Worth stating plainly because it is a selling point rather than a caveat: this
stores **aggregate numbers only**. There is no recording, no transcript, and
nothing identifying. It never leaves the device in slice 1.

Note `src/lib/sync.ts` currently syncs **scripts only** (`pushScript`,
`pushDelete`, `syncScripts`) — there is no profile-preferences sync to hang this
on. Cross-device pacing therefore needs new plumbing, which is why it is slice 3
and not slice 1.

## UX — the part most likely to go wrong

A system that silently changes its timing **feels like a bug**. If the reader
starts coming back later than it used to and nothing explains why, the rational
conclusion is that the app broke.

So the recommendation is: visible, attributable, revertible.

- The Delay Start / auto-continue area shows the learned pace once it is in use
  — e.g. `⏱ Paced to you · ~2.4s per line` — with a **Reset** that clears the
  samples.
- A one-time note the first time it takes effect: "Buddy has learned your
  reading pace and will wait accordingly."
- An explicit off switch, so a user who dislikes it is never stuck with it.

## Failure modes

| Failure | Why it happens | Handling |
|---|---|---|
| Overfits one piece | You run the same monologue 40 times | Median over a rolling window; it re-adapts as new material arrives |
| Someone else uses your phone | Different rhythm, same device | Reset button; the shrink means a few foreign samples barely move it |
| Mic hears a TV | Line-follow completes early or late | Per-sample clamp discards it |
| Measured pace runs long | With follow on you know it waits, so you take your time | Bias is toward **waiting too long**, which is the forgiving direction. Accept it rather than correct it |
| Improv lines | No meaningful word count | Excluded at collection |
| Short lines | "What?" is 1 word but takes a beat | Excluded below 3 words; the floor covers them |

## Slices

**Slice 1 — the whole useful feature.** Measure, learn, use, show, reset.
Local only. Small: a new `pacing.ts`, a few lines in `useRehearsal.ts`, one
timestamp in the rehearse screen, one UI affordance.

**Slice 2 — robustness.** Learn the floor for short lines; consider whether
high variance should widen the wait rather than just average it.

**Slice 3 — follows you.** Sync to Supabase so pacing survives a new device.
Needs the profile-prefs plumbing that does not exist yet.

**Slice 4 — per script.** A frantic comedy and a slow drama are different
rhythms; a per-script override on top of your global pace.

Stop after slice 1 if it is enough. It probably is.

## What this is NOT

Tone and delivery learning is a **separate feature**, and worth keeping
separate because its economics are different. The plumbing already exists —
`buildInstructions()` in `src/lib/cloudVoice.ts:88` composes delivery
instructions, and `synthesize-voice` passes them to `gpt-4o-mini-tts` — but:

1. The audio cache key includes `hash(instructions)`
   (`src/lib/cloudVoice.ts:138`). Changing a character's tone preference
   invalidates every cached line for that character, so the next run
   re-synthesises the whole scene **at full price**. Pacing costs nothing per
   use; tone costs real money per adjustment.
2. ElevenLabs' `eleven_multilingual_v2` has no instructions field — your own
   code documents this in `supabase/functions/synthesize-voice/index.ts:100`.
   So any tone learning silently stops working if `VOICE_PROVIDER` is ever
   switched to ElevenLabs. That belongs in the ElevenLabs decision.

## Also found while reading

`inputAbility` is declared on every tier in `src/lib/subscription.ts`
(`false` for free, `true` for paid) and **read nowhere in the codebase**. So
line-follow is currently gated only by platform support, not by subscription.

That matters here: if `inputAbility` was ever meant to gate line-follow and
gets wired up, free users stop producing pacing samples entirely — the feature
would quietly become paid-only. Worth deciding what that flag is for before
building on top of the signal it governs.

## Open decisions

1. **Automatic or opt-in?** Recommend automatic once ≥ 5 samples, with the
   visible indicator and an off switch. The alternative is a toggle nobody
   finds.
2. **Is "waiting too long" acceptable?** The measurement is biased toward
   patience. I think that is correct for rehearsal — being cut off is worse
   than a slightly late cue — but it is your product call.
3. **One pace or per script?** Recommend one global pace for slice 1.
4. **What is `inputAbility` for?** See above.
5. **Does pacing need to follow you across devices?** Recommend no for now;
   it costs new sync plumbing for a number that re-learns itself in a few
   takes anyway.
