import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/lib/AppText';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';
import { getSpeechRecognitionCtor, type SpeechRecognitionLike } from '@/lib/webSpeech';

// Standalone diagnostic: shows a live mic-level meter (Web Audio API) so the
// user can see, independent of whether speech recognition works at all,
// whether the browser is actually receiving sound from their microphone.
// Recognition transcript is shown alongside as a second, separate signal.
type Status = 'idle' | 'requesting' | 'active' | 'denied' | 'nodevice' | 'error';

export default function MicTestScreen() {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);

  const [status, setStatus] = useState<Status>('idle');
  const [level, setLevel] = useState(0);
  const [quietHint, setQuietHint] = useState(false);
  const [transcript, setTranscript] = useState('');
  const speechSupported = Boolean(getSpeechRecognitionCtor());

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSoundAtRef = useRef(0);
  const recognizerRef = useRef<SpeechRecognitionLike | null>(null);

  const stopTest = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recognizerRef.current?.abort();
    recognizerRef.current = null;
    setLevel(0);
    setQuietHint(false);
    setStatus('idle');
  };

  useEffect(() => stopTest, []);

  const startTest = async () => {
    setStatus('requesting');
    setTranscript('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new Ctx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      const buffer = new Uint8Array(analyser.frequencyBinCount);

      lastSoundAtRef.current = Date.now();
      const tick = () => {
        analyser.getByteTimeDomainData(buffer);
        let sumSquares = 0;
        for (let i = 0; i < buffer.length; i++) {
          const v = (buffer[i] - 128) / 128;
          sumSquares += v * v;
        }
        const rms = Math.sqrt(sumSquares / buffer.length);
        const lvl = Math.min(1, rms * 5);
        setLevel(lvl);
        if (lvl > 0.04) lastSoundAtRef.current = Date.now();
        setQuietHint(Date.now() - lastSoundAtRef.current > 4000);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setStatus('active');

      const Ctor = getSpeechRecognitionCtor();
      if (Ctor) {
        const recognizer = new Ctor();
        recognizerRef.current = recognizer;
        recognizer.lang = 'en-US';
        recognizer.continuous = true;
        recognizer.interimResults = true;
        recognizer.onresult = (event) => {
          const text = event.results?.[0]?.[0]?.transcript ?? '';
          if (text) setTranscript(text);
        };
        recognizer.onend = () => {
          if (recognizerRef.current === recognizer) recognizer.start();
        };
        recognizer.onerror = () => {};
        try {
          recognizer.start();
        } catch {
          // already running
        }
      }
    } catch (e) {
      const name = e instanceof Error ? e.name : '';
      setStatus(name === 'NotFoundError' || name === 'OverconstrainedError' ? 'nodevice' : 'denied');
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>🎙 Mic test</Text>
        <Text style={styles.blurb}>
          Talk normally and watch the bar below. If it moves, your browser is hearing you — that's
          independent of whether the words get recognized correctly.
        </Text>

        <View style={styles.meterTrack}>
          <View style={[styles.meterFill, { width: `${Math.round(level * 100)}%` }]} />
        </View>

        {status === 'idle' && <Text style={styles.status}>Tap start and allow microphone access.</Text>}
        {status === 'requesting' && <Text style={styles.status}>Requesting microphone access…</Text>}
        {status === 'active' && !quietHint && <Text style={styles.status}>Listening — go ahead and talk.</Text>}
        {status === 'active' && quietHint && (
          <Text style={styles.warning}>
            Not hearing anything. Check your phone isn't muted or the mic is covered, that you picked
            the right microphone in your browser's site settings, and that no other app is using it.
          </Text>
        )}
        {status === 'denied' && (
          <Text style={styles.warning}>
            Microphone access is blocked. Allow it for this site (tap the lock/info icon next to the
            address bar → site settings → microphone), then try again.
          </Text>
        )}
        {status === 'nodevice' && <Text style={styles.warning}>No microphone was found on this device.</Text>}
        {status === 'error' && <Text style={styles.warning}>Something went wrong starting the test.</Text>}

        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={status === 'active' ? stopTest : startTest}>
          <Text style={styles.primaryButtonText}>{status === 'active' ? '■ Stop test' : '▶ Start test'}</Text>
        </Pressable>

        <View style={styles.transcriptCard}>
          <Text style={styles.transcriptLabel}>Live transcript</Text>
          {speechSupported ? (
            <Text style={styles.transcriptText}>
              {transcript || (status === 'active' ? 'Say something…' : '—')}
            </Text>
          ) : (
            <Text style={styles.transcriptText}>
              This browser doesn't support live transcription — the level meter above is still a valid
              test of whether your mic is being heard.
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (t: Theme, shadow: ReturnType<typeof useCardShadow>) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, maxWidth: 620, width: '100%', alignSelf: 'center', gap: 14 },
    title: { fontSize: 20, fontWeight: '800', color: t.ink },
    blurb: { fontSize: 14, color: t.inkSoft, lineHeight: 20 },
    meterTrack: {
      height: 20,
      borderRadius: 10,
      backgroundColor: t.accentSoft,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.border,
    },
    meterFill: { height: '100%', backgroundColor: t.accent, borderRadius: 10 },
    status: { fontSize: 13, color: t.inkSoft, fontWeight: '600' },
    warning: { fontSize: 13, color: t.danger, fontWeight: '600', lineHeight: 19 },
    primaryButton: {
      backgroundColor: t.accent,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      ...shadow,
    },
    primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    transcriptCard: {
      backgroundColor: t.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      padding: 16,
      ...shadow,
    },
    transcriptLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: t.inkSoft,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    transcriptText: { fontSize: 15, color: t.ink, marginTop: 6, lineHeight: 21 },
    pressed: { opacity: 0.7 },
  });
