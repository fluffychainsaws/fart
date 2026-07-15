import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  cloudVoiceActive,
  hasCloudVoice,
  OPENAI_VOICES,
  setCloudVoiceEnabled,
  speakCloud,
} from '@/lib/cloudVoice';
import { interpretDirection } from '@/lib/director';
import { getVoicePool, loadVoices, speakOnce, stopSpeaking, voiceOptsFor } from '@/lib/speech';
import { getScript, saveScript } from '@/lib/storage';
import { getTier } from '@/lib/subscription';
import { useTheme, type Theme } from '@/lib/theme';
import type { FartScript } from '@/lib/types';
import { useRehearsal } from '@/lib/useRehearsal';
import { directorNoteCount, getUsageStatus, type UsageStatus } from '@/lib/usage';

const prettyVoice = (id: string | undefined, deviceNames: Record<string, string>): string => {
  if (!id) return 'Auto';
  if (id.startsWith('openai:')) {
    const name = id.slice('openai:'.length);
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  if (id.startsWith('device:')) {
    return deviceNames[id.slice('device:'.length)] ?? 'Device voice';
  }
  return 'Auto';
};

export default function RehearseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [script, setScript] = useState<FartScript | null>(null);
  const [noteTarget, setNoteTarget] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [cloudOn, setCloudOn] = useState(cloudVoiceActive());
  const [pickerChar, setPickerChar] = useState<string | null>(null);
  const [deviceVoices, setDeviceVoices] = useState<{ identifier: string; name: string; quality?: string }[]>([]);
  const [usage, setUsage] = useState<UsageStatus | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<number, number>>({});

  const tier = usage ? getTier(usage.tier) : null;
  const aiVoicesAllowed = tier ? tier.aiVoiceCount > 0 : false;
  const allowedOpenAiVoices = tier ? OPENAI_VOICES.slice(0, tier.aiVoiceCount) : [];

  const engine = useRehearsal(script?.elements ?? [], {
    voices: script?.voices,
    cloudVoiceAllowed: aiVoicesAllowed,
  });
  const { idx, status } = engine;

  useEffect(() => {
    getScript(id).then(setScript);
    loadVoices().then(() => setDeviceVoices(getVoicePool()));
    getUsageStatus().then(setUsage);
  }, [id]);

  // Characters the reader performs (anyone with a line that isn't yours).
  const readerChars = useMemo(() => {
    const seen: string[] = [];
    for (const el of script?.elements ?? []) {
      if (el.type === 'line' && !el.mine && !seen.includes(el.character)) seen.push(el.character);
    }
    return seen;
  }, [script?.elements]);

  const deviceNames = useMemo(
    () => Object.fromEntries(deviceVoices.map((v) => [v.identifier, v.name])),
    [deviceVoices],
  );

  const previewVoice = (character: string, voiceId: string | null) => {
    const firstLine = script?.elements.find(
      (el) => el.type === 'line' && el.character === character,
    );
    const sample =
      firstLine?.type === 'line' ? firstLine.text.slice(0, 120) : "Hello! I'm your reader.";
    stopSpeaking();
    if (cloudVoiceActive() && aiVoicesAllowed && (voiceId == null || voiceId.startsWith('openai:'))) {
      speakCloud({
        text: sample,
        character,
        voice: voiceId?.startsWith('openai:') ? voiceId.slice('openai:'.length) : undefined,
      }).then((ok) => {
        if (!ok) speakOnce(sample, voiceOptsFor(character));
      });
      return;
    }
    const override = voiceId?.startsWith('device:') ? voiceId.slice('device:'.length) : undefined;
    speakOnce(sample, voiceOptsFor(character, override));
  };

  const chooseVoice = (character: string, voiceId: string | null) => {
    if (!script) return;
    const voices = { ...(script.voices ?? {}) };
    if (voiceId) voices[character] = voiceId;
    else delete voices[character];
    const next = { ...script, voices };
    setScript(next);
    saveScript(next);
    previewVoice(character, voiceId);
  };

  const warnNoteLimit = (message: string) => {
    if (Platform.OS === 'web') {
      window.alert(message);
      return;
    }
    Alert.alert('Director notes', message);
  };

  const openNote = (i: number) => {
    if (!script || !tier) return;
    const el = script.elements[i];
    if (el.type !== 'line' || el.mine) return;
    const hasExistingNote = Boolean(el.delivery?.note);
    if (!hasExistingNote && directorNoteCount(script) >= tier.directorNotesPerAudition) {
      warnNoteLimit(
        tier.directorNotesPerAudition === 0
          ? "Director notes aren't included in your plan — upgrade to direct the reader."
          : `Your plan allows ${tier.directorNotesPerAudition} director note${tier.directorNotesPerAudition === 1 ? '' : 's'} per script. Remove one or upgrade for more.`,
      );
      return;
    }
    engine.pause();
    setNoteText(el.delivery?.note ?? '');
    setNoteTarget(i);
  };

  const applyNote = async (raw: string) => {
    if (!script || noteTarget == null) return;
    const el = script.elements[noteTarget];
    if (el.type !== 'line') return;
    const trimmed = raw.trim();
    setNoteBusy(true);
    try {
      const delivery = trimmed ? await interpretDirection(trimmed, el) : undefined;
      const next = {
        ...script,
        elements: script.elements.map((e, i) => {
          if (i !== noteTarget || e.type !== 'line') return e;
          const { delivery: _drop, ...rest } = e;
          return delivery ? { ...rest, delivery } : rest;
        }),
      };
      setScript(next);
      await saveScript(next);
      setNoteTarget(null);
    } finally {
      setNoteBusy(false);
    }
  };

  useEffect(() => {
    const y = positions.current[idx];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 160), animated: true });
  }, [idx]);

  if (!script) return <View style={styles.screen} />;

  const current = script.elements[idx];
  const playing = status === 'playing' || status === 'waiting';

  return (
    <View style={styles.screen}>
      {readerChars.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.castRow}
          contentContainerStyle={styles.castRowContent}>
          {readerChars.map((name) => (
            <Pressable
              key={name}
              style={styles.castChip}
              onPress={() => {
                engine.pause();
                setPickerChar(name);
              }}>
              <Text style={styles.castChipName}>{name}</Text>
              <Text style={styles.castChipVoice}>
                🔊 {prettyVoice(script.voices?.[name], deviceNames)} ▾
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <View style={styles.controls}>
        <Pressable
          style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
          onPress={() => (playing ? engine.pause() : engine.play(status === 'done' ? 0 : undefined))}>
          <Text style={styles.playButtonText}>
            {playing ? '⏸ Pause' : status === 'done' ? '↻ Run it back' : '▶ Play'}
          </Text>
        </Pressable>
        <Pressable style={styles.smallButton} onPress={engine.restart}>
          <Text style={styles.smallButtonText}>⏮</Text>
        </Pressable>
        <Pressable style={styles.smallButton} onPress={engine.cycleRate}>
          <Text style={styles.smallButtonText}>{engine.rate}x</Text>
        </Pressable>
      </View>
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggle, engine.readDirections && styles.toggleOn]}
          onPress={engine.toggleDirections}>
          <Text style={[styles.toggleText, engine.readDirections && styles.toggleTextOn]}>
            🎬 Read directions
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggle, engine.autoAdvance && styles.toggleOn]}
          onPress={engine.toggleAuto}>
          <Text style={[styles.toggleText, engine.autoAdvance && styles.toggleTextOn]}>
            ⏱ Auto-continue my lines
          </Text>
        </Pressable>
        {hasCloudVoice() && aiVoicesAllowed && (
          <Pressable
            style={[styles.toggle, cloudOn && styles.toggleOn]}
            onPress={() => {
              const next = !cloudOn;
              setCloudVoiceEnabled(next);
              setCloudOn(next);
            }}>
            <Text style={[styles.toggleText, cloudOn && styles.toggleTextOn]}>✨ ChatGPT voice</Text>
          </Pressable>
        )}
      </View>

      <ScrollView ref={scrollRef} style={styles.script} contentContainerStyle={styles.scriptContent}>
        {script.elements.map((el, i) => {
          const isCurrent = i === idx && status !== 'idle';
          return (
            <Pressable
              key={i}
              onLayout={(e) => {
                positions.current[i] = e.nativeEvent.layout.y;
              }}
              onPress={() => engine.play(i)}
              onLongPress={() => openNote(i)}
              delayLongPress={350}>
              {el.type === 'direction' ? (
                <Text style={[styles.direction, isCurrent && styles.currentDirection]}>{el.text}</Text>
              ) : (
                <View style={[styles.line, el.mine && styles.lineMine, isCurrent && styles.currentLine]}>
                  <Text style={styles.lineCharacter}>
                    {el.character}
                    {el.mine ? '  ← you' : ''}
                  </Text>
                  <Text style={styles.lineText}>{el.text}</Text>
                  {el.delivery && <Text style={styles.noteBadge}>🎬 {el.delivery.note}</Text>}
                </View>
              )}
            </Pressable>
          );
        })}
        <Text style={styles.tapHint}>
          Tap any line to play from there. Hold a reader&apos;s line to direct it.
        </Text>
      </ScrollView>

      {status === 'waiting' && current?.type === 'line' && (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>🫵 Your line, {current.character}!</Text>
          <Pressable
            style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}
            onPress={engine.continueMyLine}>
            <Text style={styles.continueButtonText}>Said it — continue ▶</Text>
          </Pressable>
        </View>
      )}

      {status === 'done' && (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>🎉 Scene complete!</Text>
          <Pressable
            style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}
            onPress={() => engine.play(0)}>
            <Text style={styles.continueButtonText}>↻ Run it back</Text>
          </Pressable>
        </View>
      )}

      {/* Conditionally mounted like the note modal below (react-native-web
          fading modals can linger in the DOM). */}
      {pickerChar != null && (
        <Modal visible transparent animationType="none" onRequestClose={() => setPickerChar(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>🔊 Voice for {pickerChar}</Text>
              <Text style={styles.modalLine}>
                {cloudVoiceActive() && aiVoicesAllowed
                  ? 'ChatGPT voices — tap one to hear it'
                  : 'Device voices — tap one to hear it'}
              </Text>
              {cloudVoiceActive() && !aiVoicesAllowed && (
                <Pressable onPress={() => router.push('/account')}>
                  <Text style={styles.upgradeHint}>
                    Your plan doesn&apos;t include AI voices — upgrade to unlock them ›
                  </Text>
                </Pressable>
              )}
              <ScrollView style={styles.voiceList}>
                {[
                  { id: null as string | null, label: '✨ Auto (pick for me)' },
                  ...(cloudVoiceActive() && aiVoicesAllowed
                    ? allowedOpenAiVoices.map((v) => ({
                        id: `openai:${v}` as string | null,
                        label: v.charAt(0).toUpperCase() + v.slice(1),
                      }))
                    : deviceVoices.map((v) => ({
                        id: `device:${v.identifier}` as string | null,
                        label: v.quality === 'Enhanced' ? `${v.name} ★` : v.name,
                      }))),
                ].map((option) => {
                  const selected = (script.voices?.[pickerChar] ?? null) === option.id;
                  return (
                    <Pressable
                      key={option.id ?? 'auto'}
                      style={[styles.voiceRow, selected && styles.voiceRowSelected]}
                      onPress={() => chooseVoice(pickerChar, option.id)}>
                      <Text style={[styles.voiceRowText, selected && styles.voiceRowTextSelected]}>
                        {option.label}
                        {selected ? '  ✓' : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={styles.modalButtons}>
                <Pressable
                  style={({ pressed }) => [styles.modalSaveButton, pressed && styles.pressed]}
                  onPress={() => {
                    stopSpeaking();
                    setPickerChar(null);
                  }}>
                  <Text style={styles.modalSaveText}>Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Conditionally mounted: react-native-web's fading Modal can linger in
          the DOM after visible flips false, so we unmount it outright. */}
      {noteTarget != null && (
      <Modal
        visible
        transparent
        animationType="none"
        onRequestClose={() => setNoteTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🎬 Direct this line</Text>
            {noteTarget != null && script.elements[noteTarget]?.type === 'line' && (
              <Text style={styles.modalLine} numberOfLines={3}>
                {(script.elements[noteTarget] as { character: string; text: string }).character}:{' '}
                {(script.elements[noteTarget] as { character: string; text: string }).text}
              </Text>
            )}
            <TextInput
              style={styles.modalInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="angrier · pause 2 seconds first · cut me off"
              placeholderTextColor={t.inkSoft}
              multiline
              autoFocus
              editable={!noteBusy}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalGhostButton}
                disabled={noteBusy}
                onPress={() => setNoteTarget(null)}>
                <Text style={styles.modalGhostText}>Cancel</Text>
              </Pressable>
              {noteTarget != null &&
                script.elements[noteTarget]?.type === 'line' &&
                (script.elements[noteTarget] as { delivery?: unknown }).delivery != null && (
                  <Pressable
                    style={styles.modalGhostButton}
                    disabled={noteBusy}
                    onPress={() => applyNote('')}>
                    <Text style={styles.modalGhostText}>Remove note</Text>
                  </Pressable>
                )}
              <Pressable
                style={({ pressed }) => [
                  styles.modalSaveButton,
                  (pressed || noteBusy) && styles.pressed,
                ]}
                disabled={noteBusy || noteText.trim().length === 0}
                onPress={() => applyNote(noteText)}>
                <Text style={styles.modalSaveText}>{noteBusy ? 'Directing…' : 'Save note'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      )}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    controls: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 20,
      paddingTop: 8,
      maxWidth: 700,
      width: '100%',
      alignSelf: 'center',
    },
    playButton: {
      flex: 1,
      backgroundColor: t.accent,
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: 'center',
    },
    playButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    smallButton: {
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      justifyContent: 'center',
    },
    smallButtonText: { fontSize: 15, fontWeight: '700', color: t.ink },
    toggleRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 4,
      maxWidth: 700,
      width: '100%',
      alignSelf: 'center',
    },
    toggle: {
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    toggleOn: { backgroundColor: t.accentSoft, borderColor: t.accent },
    toggleText: { fontSize: 12, fontWeight: '700', color: t.inkSoft },
    toggleTextOn: { color: t.accent },
    script: { flex: 1, marginTop: 6 },
    scriptContent: { padding: 20, paddingBottom: 160, maxWidth: 700, width: '100%', alignSelf: 'center' },
    direction: {
      fontSize: 13,
      fontStyle: 'italic',
      color: t.inkSoft,
      marginVertical: 8,
      lineHeight: 19,
      paddingHorizontal: 10,
    },
    currentDirection: { color: t.accent },
    line: {
      borderRadius: 12,
      padding: 12,
      marginVertical: 3,
      borderWidth: 2,
      borderColor: 'transparent',
      backgroundColor: t.card,
    },
    lineMine: { backgroundColor: t.highlight },
    currentLine: { borderColor: t.accent },
    lineCharacter: { fontSize: 12, fontWeight: '800', color: t.accent, letterSpacing: 0.5 },
    lineText: { fontSize: 15, color: t.ink, marginTop: 2, lineHeight: 21 },
    tapHint: { fontSize: 12, color: t.inkSoft, textAlign: 'center', marginTop: 16 },
    banner: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: t.card,
      borderTopWidth: 1,
      borderTopColor: t.border,
      padding: 16,
      paddingBottom: 28,
      alignItems: 'center',
    },
    bannerTitle: { fontSize: 17, fontWeight: '800', color: t.ink },
    continueButton: {
      backgroundColor: t.accent,
      borderRadius: 14,
      paddingVertical: 13,
      paddingHorizontal: 32,
      marginTop: 10,
    },
    continueButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    noteBadge: { fontSize: 12, color: t.inkSoft, fontStyle: 'italic', marginTop: 6 },
    castRow: { flexGrow: 0, marginTop: 8 },
    castRowContent: { paddingHorizontal: 20, gap: 8 },
    castChip: {
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    castChipName: { fontSize: 12, fontWeight: '800', color: t.accent, letterSpacing: 0.5 },
    castChipVoice: { fontSize: 12, fontWeight: '600', color: t.inkSoft, marginTop: 2 },
    voiceList: { maxHeight: 320, marginTop: 12 },
    voiceRow: {
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    voiceRowSelected: { backgroundColor: t.accentSoft, borderColor: t.accent },
    voiceRowText: { fontSize: 15, color: t.ink, fontWeight: '600' },
    voiceRowTextSelected: { color: t.accent },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    modalCard: {
      backgroundColor: t.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: t.border,
      padding: 18,
      width: '100%',
      maxWidth: 480,
    },
    modalTitle: { fontSize: 17, fontWeight: '800', color: t.ink },
    modalLine: { fontSize: 13, color: t.inkSoft, marginTop: 8, lineHeight: 19 },
    upgradeHint: { fontSize: 13, color: t.accent, fontWeight: '700', marginTop: 8 },
    modalInput: {
      backgroundColor: t.bg,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      padding: 12,
      minHeight: 72,
      marginTop: 12,
      fontSize: 15,
      color: t.ink,
      textAlignVertical: 'top',
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      marginTop: 14,
      flexWrap: 'wrap',
    },
    modalGhostButton: {
      paddingVertical: 11,
      paddingHorizontal: 14,
      borderRadius: 12,
    },
    modalGhostText: { color: t.inkSoft, fontSize: 14, fontWeight: '700' },
    modalSaveButton: {
      backgroundColor: t.accent,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 20,
    },
    modalSaveText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    pressed: { opacity: 0.7 },
  });
