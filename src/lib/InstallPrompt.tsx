import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/lib/AppText';
import { useTheme, type Theme } from '@/lib/theme';

// A dismissible "Add to Home Screen" nudge, web-only. Two flavors:
//   • Chrome/Android/desktop: fires `beforeinstallprompt`, so we show an
//     Install button that triggers the real prompt.
//   • iOS Safari: no such event exists — installing is Share → Add to Home
//     Screen — so we show that instruction instead.
// Hidden when already installed (standalone) or previously dismissed.

const DISMISS_KEY = 'fart.installHintDismissed.v1';

type BipEvent = Event & { prompt: () => void; userChoice: Promise<unknown> };

export function InstallPrompt() {
  const t = useTheme();
  const styles = makeStyles(t);
  const [deferred, setDeferred] = useState<BipEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const w = window as unknown as { __bipEvent?: BipEvent };
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // storage blocked — fall through and still offer install
    }

    // Chrome may have captured the event before this mounted (see +html.tsx).
    if (w.__bipEvent) {
      setDeferred(w.__bipEvent);
      setVisible(true);
    }
    const onReady = () => {
      if (w.__bipEvent) {
        setDeferred(w.__bipEvent);
        setVisible(true);
      }
    };
    const onInstalled = () => setVisible(false);
    window.addEventListener('__bipReady', onReady);
    window.addEventListener('appinstalled', onInstalled);

    // iOS Safari: no beforeinstallprompt — offer the manual instruction.
    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    if (isIOS && isSafari) {
      setIosHint(true);
      setVisible(true);
    }

    return () => {
      window.removeEventListener('__bipReady', onReady);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      // ignore
    }
    setDeferred(null);
    setVisible(false);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.emoji}>📲</Text>
      <View style={styles.body}>
        {iosHint ? (
          <Text style={styles.text}>
            Install this app: tap Share, then <Text style={styles.bold}>Add to Home Screen</Text>.
          </Text>
        ) : (
          <Text style={styles.text}>Add Self Tape Buddy to your home screen for one-tap access.</Text>
        )}
      </View>
      {!iosHint && (
        <Pressable style={({ pressed }) => [styles.installBtn, pressed && styles.pressed]} onPress={install}>
          <Text style={styles.installText}>Install</Text>
        </Pressable>
      )}
      <Pressable hitSlop={8} onPress={dismiss} style={styles.close}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: t.accentSoft,
      borderWidth: 1,
      borderColor: t.accent,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 14,
    },
    emoji: { fontSize: 20 },
    body: { flex: 1 },
    text: { fontSize: 13, color: t.ink, lineHeight: 18, fontWeight: '600' },
    bold: { fontWeight: '800' },
    installBtn: {
      backgroundColor: t.accent,
      borderRadius: 10,
      paddingVertical: 7,
      paddingHorizontal: 14,
    },
    installText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    close: { paddingHorizontal: 4 },
    closeText: { fontSize: 14, color: t.inkSoft, fontWeight: '700' },
    pressed: { opacity: 0.7 },
  });
