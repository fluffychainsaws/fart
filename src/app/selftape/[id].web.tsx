import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Text } from '@/lib/AppText';
import { getScript } from '@/lib/storage';
import { getTier } from '@/lib/subscription';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';
import type { FartScript } from '@/lib/types';
import { useRehearsal } from '@/lib/useRehearsal';
import { getUsageStatus, recordAuditionCompleted, type UsageStatus } from '@/lib/usage';
import { CUT_CMD, START_CMD } from '@/lib/voiceCommands';
import { getSpeechRecognitionCtor, type SpeechRecognitionLike } from '@/lib/webSpeech';

// Web self-tape: there's no camera recording here (expo-camera can't record
// video in a browser and there's no web camera roll) — the actor records on
// their own phone, and this page just plays the reader's lines out loud, with
// optional hands-free control so they don't have to touch the laptop.
type RunState = 'idle' | 'countdown' | 'running' | 'done';

export default function SelfTapeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const [script, setScript] = useState<FartScript | null>(null);
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const [runState, setRunState] = useState<RunState>('idle');
  const [countdown, setCountdown] = useState(3);
  // Off by default: mic access has to be requested from a direct tap (a real
  // user gesture), not automatically on mount, or the browser's permission
  // prompt may never reliably appear and recognition just silently fails.
  const [voiceOn, setVoiceOn] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);

  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const runStateRef = useRef<RunState>('idle');
  runStateRef.current = runState;
  const voiceCooldownUntil = useRef(0);

  const refreshUsage = () => getUsageStatus().then(setUsage);

  useEffect(() => {
    getScript(id).then(setScript);
    refreshUsage();
  }, [id]);

  const tier = usage ? getTier(usage.tier) : null;
  const cloudVoiceAllowed = Boolean(tier && tier.aiVoiceCount > 0);
  const voiceCommandsAllowed = Boolean(tier?.voiceCommands);
  const speechSupported = Boolean(getSpeechRecognitionCtor());

  const engine = useRehearsal(script?.elements ?? [], {
    defaultAutoAdvance: true,
    voices: script?.voices,
    cloudVoiceAllowed,
    onDone: () => {
      runStateRef.current = 'done';
      setRunState('done');
      recordAuditionCompleted().then(refreshUsage);
    },
  });

  const startRun = () => {
    if (usage && usage.auditionsRemaining <= 0) {
      setBlockedMsg("You're out of auditions this month — upgrade your plan to keep going.");
      return;
    }
    setBlockedMsg(null);
    setRunState('countdown');
    setCountdown(3);
    let n = 3;
    countdownTimer.current = setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCountdown(n);
        return;
      }
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      countdownTimer.current = null;
      setRunState('running');
      engine.play(0);
    }, 1000);
  };

  const cancelCountdown = () => {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    countdownTimer.current = null;
    setRunState('idle');
  };

  const stopRun = () => {
    engine.pause();
    setRunState('done');
    recordAuditionCompleted().then(refreshUsage);
  };

  const newRun = () => {
    engine.restart();
    setRunState('idle');
  };

  // The recognition listener lives across renders; give it fresh handlers.
  const actionsRef = useRef({ startRun, cancelCountdown, stopRun });
  actionsRef.current = { startRun, cancelCountdown, stopRun };

  // Requesting mic access from this direct tap is what makes the browser's
  // permission prompt reliably appear (and lets us tell the user clearly if
  // they deny or already blocked it, instead of failing silently).
  const toggleVoice = async () => {
    if (voiceOn) {
      setVoiceOn(false);
      return;
    }
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setVoiceOn(true);
    } catch (e) {
      const name = e instanceof Error ? e.name : '';
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setMicError("No microphone found on this device.");
      } else {
        setMicError(
          "Microphone access is blocked. Allow it for this site in your browser's settings, then try again.",
        );
      }
    }
  };

  // Hands-free control via the browser's Web Speech API — gated to the tier
  // that includes voice commands, and only where the browser implements it
  // (solid in Chrome/Edge; Safari and Firefox largely don't).
  useEffect(() => {
    if (!voiceOn || !voiceCommandsAllowed || !speechSupported) return;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    let cancelled = false;
    let recognizer: SpeechRecognitionLike | null = null;
    let consecutiveErrors = 0;

    const startListening = () => {
      recognizer = new Ctor();
      recognizer.lang = 'en-US';
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.onresult = (event) => {
        const transcript = (event.results?.[0]?.[0]?.transcript ?? '').toLowerCase();
        if (!transcript || Date.now() < voiceCooldownUntil.current) return;
        consecutiveErrors = 0;
        const state = runStateRef.current;
        if (state === 'idle' && START_CMD.test(transcript)) {
          voiceCooldownUntil.current = Date.now() + 4000;
          actionsRef.current.startRun();
        } else if ((state === 'running' || state === 'countdown') && CUT_CMD.test(transcript)) {
          voiceCooldownUntil.current = Date.now() + 4000;
          if (state === 'countdown') actionsRef.current.cancelCountdown();
          else actionsRef.current.stopRun();
        }
      };
      recognizer.onend = () => {
        if (cancelled || consecutiveErrors > 4) return;
        setTimeout(startListening, 600);
      };
      recognizer.onerror = (event) => {
        consecutiveErrors += 1;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          cancelled = true;
          setVoiceOn(false);
          setMicError(
            "Microphone access is blocked. Allow it for this site in your browser's settings, then try again.",
          );
        } else if (event.error !== 'no-speech' && consecutiveErrors > 4) {
          cancelled = true;
          setVoiceOn(false);
          setMicError("Voice commands stopped working — try again, or use the buttons here instead.");
        }
      };
      try {
        recognizer.start();
      } catch {
        // already running
      }
    };

    startListening();
    return () => {
      cancelled = true;
      recognizer?.abort();
    };
  }, [voiceOn, voiceCommandsAllowed, speechSupported]);

  if (!script) return <View style={styles.screen} />;

  const current = script.elements[engine.idx];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {usage && (
          <Pressable style={styles.quotaPill} onPress={() => router.push('/account')}>
            <Text style={styles.quotaPillText}>
              {usage.unlimited
                ? 'Unlimited auditions'
                : `${usage.auditionsRemaining} of ${usage.auditionsPerMonth} auditions left`}
            </Text>
          </Pressable>
        )}

        <View style={styles.phoneReminder}>
          <Text style={styles.phoneReminderEmoji}>📱</Text>
          <Text style={styles.phoneReminderText}>
            Prop up your phone and hit record over there — this page just reads your scene
            partner&apos;s lines out loud.
          </Text>
        </View>

        {current && runState !== 'idle' && (
          <View style={[styles.prompt, current.type === 'line' && current.mine && styles.promptMine]}>
            {current.type === 'direction' ? (
              <Text style={styles.promptDirection}>{current.text}</Text>
            ) : (
              <>
                <Text style={styles.promptCharacter}>
                  {current.character}
                  {current.mine ? ' — YOUR LINE' : ''}
                </Text>
                <Text style={styles.promptText}>{current.text}</Text>
              </>
            )}
          </View>
        )}

        {runState === 'countdown' && <Text style={styles.countdownText}>{countdown}</Text>}

        {runState === 'done' && (
          <View style={styles.doneCard}>
            <Text style={styles.doneTitle}>🎬 Scene complete</Text>
            <Text style={styles.doneText}>Stop recording on your phone and save the take there.</Text>
          </View>
        )}

        {blockedMsg && <Text style={styles.error}>{blockedMsg}</Text>}
        {micError && (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={styles.error}>{micError}</Text>
            <Pressable onPress={() => router.push('/mictest')}>
              <Text style={styles.upgradeHint}>Run a mic test ›</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.controlsRow}>
          {voiceCommandsAllowed && speechSupported && (
            <Pressable style={[styles.toggle, voiceOn && styles.toggleOn]} onPress={toggleVoice}>
              <Text style={[styles.toggleText, voiceOn && styles.toggleTextOn]}>🎙 Voice</Text>
            </Pressable>
          )}
          {runState === 'idle' && usage && usage.auditionsRemaining <= 0 ? (
            <Pressable style={styles.primaryButton} onPress={() => router.push('/account')}>
              <Text style={styles.primaryButtonText}>⭐ Upgrade to keep going</Text>
            </Pressable>
          ) : runState === 'idle' ? (
            <Pressable style={styles.primaryButton} onPress={startRun}>
              <Text style={styles.primaryButtonText}>▶ Start scene</Text>
            </Pressable>
          ) : null}
          {runState === 'countdown' && (
            <Pressable style={styles.ghostButton} onPress={cancelCountdown}>
              <Text style={styles.ghostButtonText}>Cancel</Text>
            </Pressable>
          )}
          {runState === 'running' && (
            <Pressable style={styles.primaryButton} onPress={stopRun}>
              <Text style={styles.primaryButtonText}>■ Cut</Text>
            </Pressable>
          )}
          {runState === 'done' && (
            <Pressable style={styles.primaryButton} onPress={newRun}>
              <Text style={styles.primaryButtonText}>↻ Run it again</Text>
            </Pressable>
          )}
        </View>

        {voiceCommandsAllowed && speechSupported && voiceOn && (runState === 'idle' || runState === 'running') && (
          <Text style={styles.voiceHint}>
            {runState === 'idle' ? 'Say "FART start" to roll' : 'Say "FART cut" to end the take'}
          </Text>
        )}
        {voiceCommandsAllowed && !speechSupported && (
          <Text style={styles.voiceHint}>
            Voice commands need Chrome or Edge on this device — use the buttons here instead.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: Theme, shadow: ReturnType<typeof useCardShadow>) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, paddingBottom: 48, maxWidth: 620, width: '100%', alignSelf: 'center', gap: 14 },
    quotaPill: {
      alignSelf: 'flex-start',
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    quotaPillText: { fontSize: 12, fontWeight: '700', color: t.ink },
    phoneReminder: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: t.accentSoft,
      borderRadius: 14,
      padding: 14,
    },
    phoneReminderEmoji: { fontSize: 22 },
    phoneReminderText: { flex: 1, fontSize: 13, color: t.ink, lineHeight: 19 },
    prompt: {
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      padding: 18,
      minHeight: 140,
      justifyContent: 'center',
      ...shadow,
    },
    promptMine: { backgroundColor: t.highlight, borderColor: t.highlightBorder },
    promptDirection: { color: t.inkSoft, fontSize: 15, fontStyle: 'italic', lineHeight: 22 },
    promptCharacter: { color: t.accent, fontSize: 13, fontWeight: '800', letterSpacing: 0.6 },
    promptText: { color: t.ink, fontSize: 20, lineHeight: 28, marginTop: 6, fontWeight: '600' },
    countdownText: { fontSize: 72, fontWeight: '800', color: t.accent, textAlign: 'center' },
    doneCard: { backgroundColor: t.card, borderRadius: 16, padding: 20, alignItems: 'center', ...shadow },
    doneTitle: { fontSize: 19, fontWeight: '800', color: t.ink },
    doneText: { fontSize: 14, color: t.inkSoft, marginTop: 4, textAlign: 'center' },
    error: { color: t.danger, fontSize: 13, fontWeight: '600', textAlign: 'center' },
    upgradeHint: { color: t.accent, fontSize: 13, fontWeight: '700' },
    controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
    toggle: {
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    toggleOn: { backgroundColor: t.accentSoft, borderColor: t.accent },
    toggleText: { fontSize: 13, fontWeight: '700', color: t.inkSoft },
    toggleTextOn: { color: t.accent },
    primaryButton: {
      backgroundColor: t.accent,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 28,
      ...shadow,
    },
    primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    ghostButton: { paddingVertical: 14, paddingHorizontal: 20 },
    ghostButtonText: { color: t.inkSoft, fontSize: 15, fontWeight: '700' },
    voiceHint: { fontSize: 12, color: t.inkSoft, textAlign: 'center', fontWeight: '600' },
  });
