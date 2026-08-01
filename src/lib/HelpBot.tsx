import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/lib/AppText';
import { submitFeedback, type FeedbackKind } from '@/lib/feedback';
import { FALLBACK, GREETING, matchFaq, SUGGESTED } from '@/lib/helpFaq';
import {
  APP_NAME_OPTIONS,
  APP_NAME_POLL,
  castVote,
  pollResults,
  votedOptionFor,
  type PollResults,
} from '@/lib/poll';
import { RobotMascot } from '@/lib/RobotMascot';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';

type Msg = { from: 'bot' | 'user'; text: string };
type Mode = 'chat' | 'report' | 'poll';

const KINDS: { key: FeedbackKind; label: string }[] = [
  { key: 'bug', label: '🐞 Something’s broken' },
  { key: 'idea', label: '💡 Idea / request' },
  { key: 'feedback', label: '💬 Other feedback' },
];

// Animated robot mascot that lives in the sidebar's blank space and opens a
// free, offline FAQ chat (see helpFaq.ts), plus a "Report an issue" form that
// saves feedback to Supabase (see feedback.ts). `onOpen` lets the slide-out
// drawer close itself so the chat panel isn't stuck behind it.
export function HelpBot({ onOpen }: { onOpen?: () => void }) {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('chat');
  const [messages, setMessages] = useState<Msg[]>([{ from: 'bot', text: GREETING }]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Report-an-issue form state.
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [reportText, setReportText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [reportErr, setReportErr] = useState(false);

  // "Help name the app" poll state.
  const [results, setResults] = useState<PollResults>({});
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);

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

  const openReport = () => {
    setReportErr(false);
    setSent(false);
    setMode('report');
  };

  const backToChat = () => setMode('chat');

  const openPoll = async () => {
    setMode('poll');
    const [voted, res] = await Promise.all([votedOptionFor(APP_NAME_POLL), pollResults(APP_NAME_POLL)]);
    setVotedFor(voted);
    setResults(res);
  };

  const vote = async (optionId: string) => {
    if (votedFor || voting) return;
    setVoting(true);
    const ok = await castVote(APP_NAME_POLL, optionId);
    if (ok) {
      setVotedFor(optionId);
      setResults(await pollResults(APP_NAME_POLL));
    }
    setVoting(false);
  };

  const totalVotes = Object.values(results).reduce((sum, n) => sum + n, 0);

  const sendReport = async () => {
    const msg = reportText.trim();
    if (!msg || sending) return;
    setSending(true);
    setReportErr(false);
    const ok = await submitFeedback(kind, msg, 'from:helpbot');
    setSending(false);
    if (ok) {
      setSent(true);
      setReportText('');
    } else {
      setReportErr(true);
    }
  };

  const headerTitle =
    mode === 'report' ? 'Report an issue' : mode === 'poll' ? 'Help name the app' : 'F.A.R.T. Helper';
  const headerSub =
    mode === 'report'
      ? 'Tell us what’s wrong — we read every one'
      : mode === 'poll'
        ? 'Your vote helps us pick 💛'
        : 'Quick answers to common questions';

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
                <Text style={styles.headerTitle}>{headerTitle}</Text>
                <Text style={styles.headerSub}>{headerSub}</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} hitSlop={10} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            {mode === 'chat' ? (
              <>
                <Pressable
                  onPress={openPoll}
                  style={({ pressed }) => [styles.pollBanner, pressed && { opacity: 0.85 }]}>
                  <Text style={styles.pollBannerText}>📊 Help name the app — cast your vote!</Text>
                </Pressable>
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

                <Pressable onPress={openReport} style={({ pressed }) => [styles.reportLink, pressed && { opacity: 0.7 }]}>
                  <Text style={styles.reportLinkText}>Something wrong? Report it →</Text>
                </Pressable>

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
              </>
            ) : mode === 'report' ? (
              <ScrollView style={styles.msgs} contentContainerStyle={styles.reportBody}>
                {sent ? (
                  <View style={styles.thanks}>
                    <Text style={styles.thanksTitle}>Thank you! 💛</Text>
                    <Text style={styles.thanksText}>
                      We read every single report — this is exactly how F.A.R.T. gets better. 🙌
                    </Text>
                    <Pressable onPress={backToChat} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}>
                      <Text style={styles.primaryBtnText}>Back to help</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Text style={styles.reportIntro}>
                      Found a bug or something off? Tell us what happened — the more detail, the faster we can fix it.
                    </Text>
                    <View style={styles.chips}>
                      {KINDS.map((k) => {
                        const selected = k.key === kind;
                        return (
                          <Pressable
                            key={k.key}
                            onPress={() => setKind(k.key)}
                            style={[styles.chip, selected && styles.chipSelected]}>
                            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{k.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <TextInput
                      style={styles.reportInput}
                      value={reportText}
                      onChangeText={setReportText}
                      placeholder="What happened? What were you doing when it went wrong?"
                      placeholderTextColor={t.inkSoft}
                      multiline
                      maxLength={4000}
                      textAlignVertical="top"
                    />
                    {reportErr && (
                      <Text style={styles.errText}>Couldn’t send that — check your connection and try again.</Text>
                    )}
                    <View style={styles.reportActions}>
                      <Pressable onPress={backToChat} style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}>
                        <Text style={styles.secondaryBtnText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={sendReport}
                        disabled={!reportText.trim() || sending}
                        style={({ pressed }) => [
                          styles.primaryBtn,
                          (!reportText.trim() || sending) && { opacity: 0.5 },
                          pressed && { opacity: 0.85 },
                        ]}>
                        <Text style={styles.primaryBtnText}>{sending ? 'Sending…' : 'Send report'}</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </ScrollView>
            ) : (
              <ScrollView style={styles.msgs} contentContainerStyle={styles.reportBody}>
                <Text style={styles.reportIntro}>🎭 Help us name the app! Which do you like best?</Text>
                {APP_NAME_OPTIONS.map((opt) => {
                  const votes = results[opt.id] ?? 0;
                  const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                  const mine = votedFor === opt.id;
                  if (votedFor) {
                    return (
                      <View key={opt.id} style={styles.pollResultRow}>
                        <View style={[styles.pollBar, { width: `${pct}%` }, mine && styles.pollBarMine]} />
                        <View style={styles.pollResultContent}>
                          <Text style={styles.pollResultLabel}>
                            {opt.label}
                            {mine ? '  ✓' : ''}
                          </Text>
                          <Text style={styles.pollResultPct}>{pct}%</Text>
                        </View>
                      </View>
                    );
                  }
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => vote(opt.id)}
                      disabled={voting}
                      style={({ pressed }) => [styles.pollOption, pressed && { opacity: 0.7 }]}>
                      <Text style={styles.pollOptionText}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
                {votedFor ? (
                  <Text style={styles.pollTally}>
                    Thanks for voting! 💛 {totalVotes} vote{totalVotes === 1 ? '' : 's'} so far.
                  </Text>
                ) : (
                  <Text style={styles.pollTally}>Tap your favorite — you’ll see the results after you vote.</Text>
                )}
                <Pressable
                  onPress={backToChat}
                  style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}>
                  <Text style={styles.secondaryBtnText}>Back to help</Text>
                </Pressable>
              </ScrollView>
            )}
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
    chipSelected: { backgroundColor: t.accent },
    chipTextSelected: { color: '#fff' },

    reportLink: {
      alignItems: 'center',
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: t.border,
    },
    reportLinkText: { color: t.accent, fontSize: 13, fontWeight: '800' },

    pollBanner: {
      backgroundColor: t.accentSoft,
      paddingVertical: 10,
      paddingHorizontal: 14,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    pollBannerText: { color: t.accent, fontSize: 13, fontWeight: '800' },

    pollOption: {
      borderWidth: 1,
      borderColor: t.accent,
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 14,
      backgroundColor: t.card,
    },
    pollOptionText: { color: t.ink, fontSize: 15, fontWeight: '700' },
    pollResultRow: {
      position: 'relative',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.bg,
      overflow: 'hidden',
      height: 46,
      justifyContent: 'center',
    },
    pollBar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      backgroundColor: t.accentSoft,
    },
    pollBarMine: { backgroundColor: t.accent, opacity: 0.35 },
    pollResultContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 14,
    },
    pollResultLabel: { color: t.ink, fontSize: 14, fontWeight: '700', flexShrink: 1 },
    pollResultPct: { color: t.ink, fontSize: 14, fontWeight: '800', marginLeft: 8 },
    pollTally: { color: t.inkSoft, fontSize: 13, textAlign: 'center', marginTop: 2 },

    reportBody: { padding: 14, gap: 12 },
    reportIntro: { color: t.ink, fontSize: 14, lineHeight: 20 },
    reportInput: {
      minHeight: 120,
      backgroundColor: t.bg,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      padding: 12,
      fontSize: 14,
      color: t.ink,
      fontFamily: 'Inter_500Medium',
    },
    errText: { color: '#d33', fontSize: 13, fontWeight: '600' },
    reportActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, alignItems: 'center' },
    primaryBtn: {
      backgroundColor: t.accent,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 18,
    },
    primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    secondaryBtn: { paddingVertical: 11, paddingHorizontal: 14 },
    secondaryBtnText: { color: t.inkSoft, fontSize: 14, fontWeight: '700' },

    thanks: { alignItems: 'center', gap: 10, paddingVertical: 16 },
    thanksTitle: { fontSize: 18, fontWeight: '800', color: t.ink },
    thanksText: { fontSize: 14, color: t.inkSoft, textAlign: 'center', lineHeight: 20 },

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
