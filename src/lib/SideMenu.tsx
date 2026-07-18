import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { router, usePathname } from 'expo-router';

import { Text } from '@/lib/AppText';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';

// Slide-out nav. On web, hovering the left edge reveals it (mouse-driven,
// like a native app's collapsed sidebar); on touch, tapping the edge tab
// toggles it since there's no hover to detect. A tap outside closes it.
//
// Two-layer structure: the outer layer spans the full screen (so the
// backdrop can catch a tap anywhere to close), while the inner hover
// layer is sized to exactly the edge tab / open drawer width, since a
// View with only absolutely-positioned children has no intrinsic size
// and needs an explicit width to be hoverable/tappable at all.
const DRAWER_WIDTH = 232;
const EDGE_WIDTH = 16;

const LINKS: { href: '/' | '/capture' | '/account' | '/mictest'; label: string; icon: string }[] = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/capture', label: 'New script', icon: '📸' },
  { href: '/account', label: 'Your plan', icon: '👤' },
  { href: '/mictest', label: 'Mic test', icon: '🎙' },
];

export function SideMenu() {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const edgeRef = useRef<View>(null);
  const backdropRef = useRef<View>(null);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [open, anim]);

  // Web: drive open/close from raw DOM events. react-native-web's press
  // system silently drops touches on these absolutely-positioned overlay
  // elements, but the underlying DOM events arrive fine — so we listen to
  // them directly. Native platforms use the Pressable handlers instead.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const edge = edgeRef.current as unknown as HTMLElement | null;
    const backdrop = backdropRef.current as unknown as HTMLElement | null;
    const openMenu = () => setOpen(true);
    const closeMenu = () => setOpen(false);
    edge?.addEventListener('touchstart', openMenu, { passive: true });
    edge?.addEventListener('mousedown', openMenu);
    backdrop?.addEventListener('touchstart', closeMenu, { passive: true });
    backdrop?.addEventListener('mousedown', closeMenu);
    return () => {
      edge?.removeEventListener('touchstart', openMenu);
      edge?.removeEventListener('mousedown', openMenu);
      backdrop?.removeEventListener('touchstart', closeMenu);
      backdrop?.removeEventListener('mousedown', closeMenu);
    };
  }, [open]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-DRAWER_WIDTH, 0] });
  const backdropOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.25] });

  // onMouseEnter/onMouseLeave aren't in RN's View prop types but are
  // forwarded to the DOM element by react-native-web. Attach them ONLY when
  // a real pointer exists ((hover: hover)): touch browsers treat elements
  // with hover handlers as "first tap hovers, second tap clicks", which
  // would make the edge tab need two taps on phones.
  const hasHover =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(hover: hover)').matches;
  const hoverProps = hasHover
    ? { onMouseEnter: () => setOpen(true), onMouseLeave: () => setOpen(false) }
    : {};

  return (
    <View style={styles.screen} pointerEvents="box-none">
      {open && (
        <Pressable
          ref={backdropRef}
          style={StyleSheet.absoluteFill}
          onPress={() => setOpen(false)}
          accessibilityLabel="Close menu">
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </Pressable>
      )}

      <View
        style={[styles.hoverZone, { width: open ? DRAWER_WIDTH : EDGE_WIDTH }]}
        pointerEvents="box-none"
        {...hoverProps}>
        {/* Edge handle: always present so touch users have something to tap. */}
        <Pressable
          ref={edgeRef}
          style={styles.edge}
          hitSlop={{ left: 10, right: 16, top: 0, bottom: 0 }}
          // Open-only (not a toggle): both touch and synthesized mouse events
          // can fire for one tap, and an idempotent open is immune to that.
          // Closing belongs to the backdrop, nav links, and mouse-leave.
          onPressIn={() => setOpen(true)}
          accessibilityLabel="Open menu">
          <View style={styles.edgeGrip} />
        </Pressable>

        <Animated.View style={[styles.drawer, shadow, { transform: [{ translateX }] }]}>
          <Text style={styles.brand}>F.A.R.T.</Text>
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Pressable
                key={link.href}
                style={({ pressed }) => [
                  styles.link,
                  active && styles.linkActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  setOpen(false);
                  router.push(link.href);
                }}>
                <Text style={styles.linkIcon}>{link.icon}</Text>
                <Text style={[styles.linkLabel, active && styles.linkLabelActive]}>{link.label}</Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </View>
    </View>
  );
}

// Home button used in place of the default header back arrow — always
// returns to the root screen regardless of navigation depth.
export function HomeHeaderButton() {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => router.push('/')}
      hitSlop={10}
      style={({ pressed }) => [{ paddingHorizontal: 4, opacity: pressed ? 0.6 : 1 }]}
      accessibilityLabel="Go home">
      <Text style={{ fontSize: 20, color: t.ink }}>🏠</Text>
    </Pressable>
  );
}

function makeStyles(t: Theme, shadow: ReturnType<typeof useCardShadow>) {
  return StyleSheet.create({
    screen: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
    },
    backdrop: { flex: 1, backgroundColor: '#000' },
    hoverZone: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
    },
    edge: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: EDGE_WIDTH,
      alignItems: 'center',
      justifyContent: 'center',
    },
    edgeGrip: {
      width: 4,
      height: 48,
      borderRadius: 2,
      backgroundColor: t.border,
    },
    drawer: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: DRAWER_WIDTH,
      backgroundColor: t.card,
      borderRightWidth: 1,
      borderRightColor: t.border,
      paddingTop: 56,
      paddingHorizontal: 12,
    },
    brand: {
      fontSize: 13,
      fontWeight: '800',
      color: t.accent,
      letterSpacing: 1.5,
      marginBottom: 16,
      paddingHorizontal: 10,
    },
    link: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 12,
      gap: 10,
    },
    linkActive: { backgroundColor: t.accentSoft },
    linkIcon: { fontSize: 18 },
    linkLabel: { fontSize: 15, fontWeight: '600', color: t.ink },
    linkLabelActive: { color: t.accent },
    pressed: { opacity: 0.7 },
  });
}
