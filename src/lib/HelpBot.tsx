import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/lib/AppText';
import { FALLBACK, GREETING, matchFaq, SUGGESTED } from '@/lib/helpFaq';
import { RobotMascot } from '@/lib/RobotMascot';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';

type Msg = { from: 'bot' | 'user'; text: string };

// Animated robot mascot that lives in the sidebar's blank space and opens a
// free, offline FAQ chat (see helpFaq.ts). `onOpen` lets the slide-out drawer
// close itself so the chat panel isn't stuck behind it.
export function HelpBot({ onOpen }: { onOpen?: () => void }) {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ from: 'bot', text: GREETING }]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const openChat = () => {
    onOpen?.();
    setOpen(true);
  };

  const ask = (text: string) => {
    const q = text.trim();
    if (!q) return;
    const entry = matchFaq(q);
    setMessages((m) => [...m, { from: 'user', text: q }, { from: 'bot', text: entry ? entry.a : FALLBACK }]);
    setInput('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  };

  return (
    <>
      <Pressable
        onPress={openChat}
        style={({ pressed }) => [styles.mascotBtn, pressed && { opacity: 0.85 }]}
        accessibilityLabel="Open the F.A.R.T. helper chat">
        <RobotMascot size={92} />
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>Need help? Ask me!</Text>
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.panelWrap} pointerEvents="box-none">
          <View style={styles.panel}>
            <View style={styles.header}>
              <RobotMascot size={42} float={false} />
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>F.A.R.T. Helper</Text>
                <Text style={styles.headerSub}>Quick answers to common questions</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} hitSlop={10} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView ref={scrollRef} style={styles.msgs} contentContainerStyle={styles.msgsContent}>
              {messages.map((m, i) => (
                <View
                  key={i}
                  style={[styles.msgRow, m.from === 'user' ? styles.rowRight : styles.rowLeft]}>
                  <View style={[styles.msg, m.from === 'user' ? styles.msgUser : styles.msgBot]}>
                    <Text style={m.from === 'user' ? styles.msgUserText : styles.msgBotText}>{m.text}</Text>
                  </View>
                </View>
              ))}

              <Text style={styles.chipsLabel}>Try asking:</Text>
              <View style={styles.chips}>
                {SUGGESTED.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => ask(s)}
                    style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}>
                    <Text style={styles.chipText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="Type a question…"
                placeholderTextColor={t.inkSoft}
                onSubmitEditing={() => ask(input)}
                returnKeyType="send"
              />
              <Pressable
                onPress={() => ask(input)}
                style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.8 }]}>
                <Text style={styles.sendText}>Send</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (t: Theme, shadow: ReturnType<typeof useCardShadow>) =>
  StyleSheet.create({
    mascotBtn: { alignItems: 'center', gap: 8, paddingVertical: 8 },
    bubble: {
      backgroundColor: t.accentSoft,
      borderColor: t.accent,
      borderWidth: 1,
      borderRadius: 14,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    bubbleText: { color: t.accent, fontSize: 12, fontWeight: '800' },

    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    panelWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
    panel: {
      width: '100%',
      maxWidth: 400,
      maxHeight: '80%',
      backgroundColor: t.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: t.border,
      overflow: 'hidden',
      ...shadow,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      backgroundColor: t.accentSoft,
    },
    headerTitle: { fontSize: 16, fontWeight: '800', color: t.ink },
    headerSub: { fontSize: 12, color: t.inkSoft, marginTop: 1 },
    closeBtn: { padding: 4 },
    closeText: { fontSize: 18, color: t.inkSoft, fontWeight: '700' },

    msgs: { flexGrow: 0 },
    msgsContent: { padding: 14, gap: 8 },
    msgRow: { flexDirection: 'row' },
    rowLeft: { justifyContent: 'flex-start' },
    rowRight: { justifyContent: 'flex-end' },
    msg: { maxWidth: '86%', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12 },
    msgBot: { backgroundColor: t.accentSoft, borderTopLeftRadius: 4 },
    msgUser: { backgroundColor: t.accent, borderTopRightRadius: 4 },
    msgBotText: { color: t.ink, fontSize: 14, lineHeight: 20 },
    msgUserText: { color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '600' },

    chipsLabel: { fontSize: 12, fontWeight: '700', color: t.inkSoft, marginTop: 6 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: t.accent,
      borderRadius: 16,
      paddingVertical: 7,
      paddingHorizontal: 12,
      backgroundColor: t.card,
    },
    chipText: { color: t.accent, fontSize: 13, fontWeight: '700' },

    inputRow: {
      flexDirection: 'row',
      gap: 8,
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: t.border,
      alignItems: 'center',
    },
    input: {
      flex: 1,
      backgroundColor: t.bg,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      fontSize: 14,
      color: t.ink,
      fontFamily: 'Inter_500Medium',
    },
    sendBtn: {
      backgroundColor: t.accent,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 16,
    },
    sendText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  });
