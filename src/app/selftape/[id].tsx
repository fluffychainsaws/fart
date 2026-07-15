import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { router, useLocalSearchParams } from 'expo-router';

import { getScript } from '@/lib/storage';
import { getTier } from '@/lib/subscription';
import { useTheme, type Theme } from '@/lib/theme';
import type { FartScript } from '@/lib/types';
import { useRehearsal } from '@/lib/useRehearsal';
import { getUsageStatus, recordAuditionCompleted, type UsageStatus } from '@/lib/usage';

// Voice commands need a native speech-recognition module that Expo Go doesn't
// ship. Lazy require: present in dev builds, null in Expo Go (buttons only).
let SpeechRec: typeof import('expo-speech-recognition') | null = null;
try {
  SpeechRec = require('expo-speech-recognition');
} catch {
  SpeechRec = null;
}

// "FART start" / "FART cut", with the recognizer's most common mishearings of
// "fart" accepted so the command still lands from across the room.
const START_CMD = /\b(fart|fart's|far|part|art|heart|bart|fort|fought)\W{0,3}(start|starts|go)\b/;
const CUT_CMD = /\b(fart|fart's|far|part|art|heart|bart|fort|fought)\W{0,3}(cut|cuts|caught|stop)\b/;

type RecState = 'idle' | 'countdown' | 'recording' | 'saving' | 'saved';

export default function SelfTapeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const themed = useMemo(() => makeThemedStyles(t), [t]);
  const [script, setScript] = useState<FartScript | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [recState, setRecState] = useState<RecState>('idle');
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStatus | null>(null);

  const refreshUsage = () => getUsageStatus().then(setUsage);

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const [libPerm, requestLibPerm] = MediaLibrary.usePermissions({ writeOnly: true });

  // Auto-continue defaults ON here: when you're on camera you don't want to
  // reach over and tap the phone after every line.
  const engine = useRehearsal(script?.elements ?? [], {
    defaultAutoAdvance: true,
    voices: script?.voices,
    cloudVoiceAllowed: Boolean(usage && getTier(usage.tier).aiVoiceCount > 0),
    onDone: () => {
      // Leave a beat of air after the last line, then stop the take.
      setTimeout(() => cameraRef.current?.stopRecording(), 1200);
    },
  });

  const voiceCommandsAllowed = Boolean(usage && getTier(usage.tier).voiceCommands);
  const [voiceOn, setVoiceOn] = useState(Boolean(SpeechRec));
  const recStateRef = useRef<RecState>('idle');
  recStateRef.current = recState;
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceCooldownUntil = useRef(0);
  const voiceErrors = useRef(0);

  useEffect(() => {
    getScript(id).then(setScript);
    refreshUsage();
  }, [id]);

  useEffect(() => {
    if (recState !== 'recording') return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recState]);

  const startTake = (seconds: number) => {
    if (usage && usage.auditionsRemaining <= 0) {
      setSaveError("You're out of auditions this month — upgrade your plan to keep recording.");
      return;
    }
    setSaveError(null);
    setRecState('countdown');
    setCountdown(seconds);
    let n = seconds;
    countdownTimer.current = setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCountdown(n);
        return;
      }
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      countdownTimer.current = null;
      setRecState('recording');
      cameraRef.current
        ?.recordAsync()
        .then(async (video) => {
          engine.pause();
          if (!video?.uri) {
            setRecState('idle');
            return;
          }
          setRecState('saving');
          try {
            await MediaLibrary.saveToLibraryAsync(video.uri);
            await recordAuditionCompleted();
            refreshUsage();
            setRecState('saved');
          } catch {
            setSaveError("Couldn't save to your camera roll.");
            setRecState('idle');
          }
        })
        .catch(() => {
          engine.pause();
          setSaveError('Recording failed. Try again.');
          setRecState('idle');
        });
      engine.play(0);
    }, 1000);
  };

  const cancelTake = () => {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    countdownTimer.current = null;
    setRecState('idle');
  };

  const stopTake = () => {
    engine.pause();
    cameraRef.current?.stopRecording();
  };

  const newTake = () => {
    engine.restart();
    setRecState('idle');
  };

  // The recognition listener lives across renders; give it fresh handlers.
  const actionsRef = useRef({ startTake, cancelTake, stopTake });
  actionsRef.current = { startTake, cancelTake, stopTake };

  const permsGranted = Boolean(camPerm?.granted && micPerm?.granted && libPerm?.granted);

  useEffect(() => {
    if (!SpeechRec || !voiceOn || !permsGranted || !voiceCommandsAllowed) return;
    const Module = SpeechRec.ExpoSpeechRecognitionModule;
    let cancelled = false;

    const startListening = async () => {
      try {
        const perm = await Module.requestPermissionsAsync();
        if (!perm.granted || cancelled) return;
        Module.start({
          lang: 'en-US',
          interimResults: true,
          continuous: true,
          contextualStrings: ['FART', 'FART start', 'FART cut'],
        });
      } catch {
        voiceErrors.current = 99;
      }
    };

    const resultSub = Module.addListener('result', (event) => {
      const transcript = (event.results?.[0]?.transcript ?? '').toLowerCase();
      if (!transcript) return;
      voiceErrors.current = 0;
      if (Date.now() < voiceCooldownUntil.current) return;
      const state = recStateRef.current;
      if (state === 'idle' && START_CMD.test(transcript)) {
        voiceCooldownUntil.current = Date.now() + 4000;
        actionsRef.current.startTake(5);
      } else if ((state === 'recording' || state === 'countdown') && CUT_CMD.test(transcript)) {
        voiceCooldownUntil.current = Date.now() + 4000;
        if (state === 'countdown') actionsRef.current.cancelTake();
        else actionsRef.current.stopTake();
      }
    });
    // Native sessions end on their own (Android segments them); reopen the ear
    // unless errors say the service is unavailable on this device.
    const endSub = Module.addListener('end', () => {
      if (cancelled || voiceErrors.current > 4) return;
      setTimeout(() => {
        if (!cancelled) startListening();
      }, 600);
    });
    const errSub = Module.addListener('error', (event) => {
      voiceErrors.current += 1;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        voiceErrors.current = 99;
      }
    });

    startListening();
    return () => {
      cancelled = true;
      resultSub.remove();
      endSub.remove();
      errSub.remove();
      try {
        Module.abort();
      } catch {
        // recognizer was not running
      }
    };
  }, [voiceOn, permsGranted, voiceCommandsAllowed]);

  const needsPermissions = !permsGranted;
  if (needsPermissions) {
    return (
      <View style={themed.infoScreen}>
        <Text style={themed.infoEmoji}>🎬</Text>
        <Text style={themed.infoTitle}>Lights, camera…</Text>
        <Text style={themed.infoText}>
          Self-tape mode records video with sound and saves takes to your camera roll, so FART needs
          the camera, the microphone, and photo-library access.
        </Text>
        <Pressable
          style={({ pressed }) => [themed.infoButton, pressed && styles.pressed]}
          onPress={async () => {
            if (!camPerm?.granted) await requestCamPerm();
            if (!micPerm?.granted) await requestMicPerm();
            if (!libPerm?.granted) await requestLibPerm();
            if (SpeechRec) {
              await SpeechRec.ExpoSpeechRecognitionModule.requestPermissionsAsync().catch(() => {});
            }
          }}>
          <Text style={themed.infoButtonText}>Allow access</Text>
        </Pressable>
      </View>
    );
  }

  if (!script) return <View style={themed.infoScreen} />;

  const current = script.elements[engine.idx];

  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <View style={styles.screen}>
      <CameraView ref={cameraRef} style={styles.camera} mode="video" facing={facing} videoQuality="1080p" />

      {/* Teleprompter overlay */}
      <View style={styles.overlay} pointerEvents="box-none">
        {usage && recState === 'idle' && (
          <Pressable style={styles.quotaPill} onPress={() => router.push('/account')}>
            <Text style={styles.quotaPillText}>
              {usage.auditionsRemaining} of {usage.auditionsPerMonth} auditions left
            </Text>
          </Pressable>
        )}
        {current && recState !== 'saved' && (
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
            {engine.status === 'waiting' && !engine.autoAdvance && (
              <Pressable style={styles.promptContinue} onPress={engine.continueMyLine}>
                <Text style={styles.promptContinueText}>Said it — continue ▶</Text>
              </Pressable>
            )}
          </View>
        )}

        {recState === 'countdown' && (
          <View style={styles.countdownWrap} pointerEvents="none">
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
        )}

        {recState === 'saved' && (
          <View style={styles.savedCard}>
            <Text style={styles.savedTitle}>🎬 That&apos;s a take!</Text>
            <Text style={styles.savedText}>Saved to your camera roll.</Text>
          </View>
        )}

        {/* Bottom controls */}
        <View style={styles.bottomBar}>
          {recState === 'recording' && (
            <View style={styles.recPill}>
              <View style={styles.recDot} />
              <Text style={styles.recTime}>{mmss}</Text>
            </View>
          )}
          {saveError && <Text style={styles.error}>{saveError}</Text>}
          {SpeechRec != null && voiceOn && voiceCommandsAllowed && (recState === 'idle' || recState === 'recording') && (
            <Text style={styles.voiceHint}>
              {recState === 'idle' ? 'Say “FART start” to roll' : 'Say “FART cut” to end the take'}
            </Text>
          )}
          <View style={styles.controlsRow}>
            <Pressable
              style={[styles.autoToggle, engine.autoAdvance && styles.autoToggleOn]}
              onPress={engine.toggleAuto}>
              <Text style={styles.autoToggleText}>⏱ Auto</Text>
            </Pressable>
            {SpeechRec != null && voiceCommandsAllowed && (
              <Pressable
                style={[styles.autoToggle, voiceOn && styles.autoToggleOn]}
                onPress={() => setVoiceOn((v) => !v)}>
                <Text style={styles.autoToggleText}>🎙 Voice</Text>
              </Pressable>
            )}

            {recState === 'idle' && usage && usage.auditionsRemaining <= 0 && (
              <Pressable style={styles.newTakeButton} onPress={() => router.push('/account')}>
                <Text style={styles.newTakeText}>⭐ Upgrade to keep recording</Text>
              </Pressable>
            )}
            {recState === 'idle' && (!usage || usage.auditionsRemaining > 0) && (
              <Pressable style={styles.recordButton} onPress={() => startTake(3)}>
                <View style={styles.recordButtonInner} />
              </Pressable>
            )}
            {recState === 'recording' && (
              <Pressable style={styles.recordButton} onPress={stopTake}>
                <View style={styles.stopButtonInner} />
              </Pressable>
            )}
            {(recState === 'countdown' || recState === 'saving') && (
              <View style={[styles.recordButton, styles.recordButtonBusy]}>
                <View style={styles.recordButtonInner} />
              </View>
            )}
            {recState === 'saved' && (
              <Pressable style={styles.newTakeButton} onPress={newTake}>
                <Text style={styles.newTakeText}>↻ New take</Text>
              </Pressable>
            )}

            <Pressable
              style={styles.flipButton}
              onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}>
              <Text style={styles.flipText}>🔄</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

// Camera overlay styles are intentionally fixed dark glass — they sit on live
// video, not on the app background, so they don't follow light/dark theme.
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  camera: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  overlay: { flex: 1, justifyContent: 'space-between', padding: 16 },
  quotaPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(12, 12, 16, 0.7)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quotaPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  prompt: {
    backgroundColor: 'rgba(12, 12, 16, 0.78)',
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
  },
  promptMine: {
    backgroundColor: 'rgba(58, 48, 8, 0.85)',
    borderWidth: 1,
    borderColor: '#F0CE5A',
  },
  promptDirection: { color: '#C9C4B8', fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  promptCharacter: { color: '#7FE0C0', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  promptText: { color: '#FFFFFF', fontSize: 17, lineHeight: 24, marginTop: 4, fontWeight: '600' },
  promptContinue: {
    backgroundColor: '#0FA47A',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  promptContinueText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  countdownWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: { fontSize: 120, fontWeight: '800', color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 16 },
  savedCard: {
    backgroundColor: 'rgba(12, 12, 16, 0.85)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginTop: 4,
  },
  savedTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  savedText: { color: '#C9C4B8', fontSize: 14, marginTop: 4 },
  bottomBar: { alignItems: 'center', gap: 10 },
  recPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(12, 12, 16, 0.7)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#FF4B3E' },
  recTime: { color: '#fff', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  error: { color: '#FFB4A8', fontSize: 13, fontWeight: '600' },
  voiceHint: {
    color: '#E8E4DA',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(12, 12, 16, 0.6)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 24, paddingBottom: 12 },
  autoToggle: {
    backgroundColor: 'rgba(12, 12, 16, 0.7)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  autoToggleOn: { borderColor: '#7FE0C0' },
  autoToggleText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  recordButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonBusy: { opacity: 0.5 },
  recordButtonInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FF4B3E' },
  stopButtonInner: { width: 30, height: 30, borderRadius: 6, backgroundColor: '#FF4B3E' },
  newTakeButton: {
    backgroundColor: '#0FA47A',
    borderRadius: 34,
    paddingHorizontal: 26,
    paddingVertical: 20,
  },
  newTakeText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  flipButton: {
    backgroundColor: 'rgba(12, 12, 16, 0.7)',
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipText: { fontSize: 20 },
  pressed: { opacity: 0.7 },
});

const makeThemedStyles = (t: Theme) =>
  StyleSheet.create({
    infoScreen: {
      flex: 1,
      backgroundColor: t.bg,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    infoEmoji: { fontSize: 44 },
    infoTitle: { fontSize: 20, fontWeight: '800', color: t.ink, marginTop: 12 },
    infoText: {
      fontSize: 15,
      color: t.inkSoft,
      textAlign: 'center',
      lineHeight: 22,
      marginTop: 8,
      maxWidth: 420,
    },
    infoButton: {
      backgroundColor: t.accent,
      borderRadius: 14,
      paddingVertical: 13,
      paddingHorizontal: 28,
      marginTop: 20,
    },
    infoButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  });
