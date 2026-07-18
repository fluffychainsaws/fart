import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname } from 'expo-router';

import { Text } from '@/lib/AppText';
import { signOut, useSession } from '@/lib/auth';
import { LogoutIcon } from '@/lib/LogoutIcon';
import { MicIcon } from '@/lib/MicIcon';
import { useProfilePhoto } from '@/lib/profilePhoto';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';

const HINT_SEEN_KEY = 'fart.sideMenuHintSeen.v1';

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

type Href = '/' | '/capture' | '/mictest' | '/profile' | '/settings' | '/account';

const LINKS: { href: Href; label: string; icon: string }[] = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/capture', label: 'New script', icon: '📸' },
  { href: '/mictest', label: 'Mic test', icon: '🎙' },
];

// Account-related actions, pinned to the bottom of the drawer and set off
// with a divider — Logout is an action, not a route, so it's handled
// separately from the plain nav links above. Profile lives up top instead,
// next to the avatar.
const BOTTOM_LINKS: { href: Href; label: string; icon: string }[] = [
  { href: '/settings', label: 'Settings', icon: '⚙️' },
  { href: '/account', label: 'Plan', icon: '🎫' },
];

export function SideMenu() {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const pathname = usePathname();
  const session = useSession();
  const photo = useProfilePhoto();
  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  const edgeRef = useRef<View>(null);
  const backdropRef = useRef<View>(null);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [open, anim]);

  // First-time discovery: a gentle pulse on the edge grip plus a callout,
  // then a brief auto-peek of the open drawer — so new visitors notice the
  // menu exists instead of never finding a hover/tap-only affordance. Once
  // shown (or the user opens the menu themselves), it never shows again.
  const dismissHint = useRef(() => {});
  useEffect(() => {
    let cancelled = false;
    let peekTimer: ReturnType<typeof setTimeout>;
    let closeTimer: ReturnType<typeof setTimeout>;
    let loop: Animated.CompositeAnimation | null = null;

    dismissHint.current = () => {
      cancelled = true;
      clearTimeout(peekTimer);
      clearTimeout(closeTimer);
      loop?.stop();
      pulse.setValue(0);
      setShowHint(false);
      AsyncStorage.setItem(HINT_SEEN_KEY, '1').catch(() => {});
    };

    AsyncStorage.getItem(HINT_SEEN_KEY).then((seen) => {
      if (seen || cancelled) return;
      setShowHint(true);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      loop.start();
      peekTimer = setTimeout(() => {
        if (cancelled) return;
        setOpen(true);
        closeTimer = setTimeout(() => {
          if (cancelled) return;
          setOpen(false);
          dismissHint.current();
        }, 1100);
      }, 700);
    });

    return () => {
      cancelled = true;
      clearTimeout(peekTimer);
      clearTimeout(closeTimer);
      loop?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  // Web: drive open/close from raw DOM events. react-native-web's press
  // system silently drops touches on these absolutely-positioned overlay
  // elements, but the underlying DOM events arrive fine — so we listen to
  // them directly. Native platforms use the Pressable handlers instead.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const edge = edgeRef.current as unknown as HTMLElement | null;
    const backdrop = backdropRef.current as unknown as HTMLElement | null;
    const openMenu = () => {
      dismissHint.current();
      setOpen(true);
    };
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
    ? {
        onMouseEnter: () => {
          dismissHint.current();
          setOpen(true);
        },
        onMouseLeave: () => setOpen(false),
      }
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
          onPressIn={() => {
            dismissHint.current();
            setOpen(true);
          }}
          accessibilityLabel="Open menu">
          {showHint && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pulseRing,
                { opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
              ]}
            />
          )}
          <View style={styles.edgeGrip} />
        </Pressable>

        {showHint && !open && (
          <View pointerEvents="none" style={styles.hintCallout}>
            <Text style={styles.hintText} numberOfLines={1}>
              {hasHover ? '← Menu' : '☰ Menu'}
            </Text>
          </View>
        )}

        <Animated.View style={[styles.drawer, shadow, { transform: [{ translateX }] }]}>
          <Pressable
            style={({ pressed }) => [
              styles.profileRow,
              pathname === '/profile' && styles.linkActive,
              pressed && styles.pressed,
            ]}
            onPress={() => {
              dismissHint.current();
              setOpen(false);
              router.push('/profile');
            }}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>👤</Text>
              </View>
            )}
            <Text style={[styles.linkLabel, pathname === '/profile' && styles.linkLabelActive]}>
              Profile
            </Text>
          </Pressable>

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
                  dismissHint.current();
                  setOpen(false);
                  router.push(link.href);
                }}>
                {link.href === '/mictest' ? (
                  <MicIcon size={18} />
                ) : (
                  <Text style={styles.linkIcon}>{link.icon}</Text>
                )}
                <Text style={[styles.linkLabel, active && styles.linkLabelActive]}>{link.label}</Text>
              </Pressable>
            );
          })}

          <View style={styles.spacer} />
          <View style={styles.divider} />

          {BOTTOM_LINKS.map((link) => {
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
                  dismissHint.current();
                  setOpen(false);
                  router.push(link.href);
                }}>
                <Text style={styles.linkIcon}>{link.icon}</Text>
                <Text style={[styles.linkLabel, active && styles.linkLabelActive]}>{link.label}</Text>
              </Pressable>
            );
          })}

          {session ? (
            <Pressable
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
              onPress={() => {
                dismissHint.current();
                setOpen(false);
                signOut();
              }}>
              <LogoutIcon size={18} />
              <Text style={styles.linkLabel}>Log out</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
              onPress={() => {
                dismissHint.current();
                setOpen(false);
                router.push('/login');
              }}>
              <Text style={styles.linkIcon}>🔑</Text>
              <Text style={styles.linkLabel}>Sign in</Text>
            </Pressable>
          )}
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
      width: 6,
      height: 64,
      borderRadius: 3,
      backgroundColor: t.accent + '80',
    },
    pulseRing: {
      position: 'absolute',
      width: 20,
      height: 76,
      borderRadius: 10,
      backgroundColor: t.accent,
    },
    hintCallout: {
      position: 'absolute',
      top: '38%',
      left: EDGE_WIDTH + 8,
      backgroundColor: t.ink,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    hintText: {
      color: t.bg,
      fontSize: 12,
      fontWeight: '700',
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
      paddingBottom: 20,
      paddingHorizontal: 12,
    },
    spacer: { flex: 1, minHeight: 12 },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.border,
      marginBottom: 8,
      marginHorizontal: 10,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 12,
      gap: 10,
      marginBottom: 10,
    },
    avatarImage: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: t.border,
    },
    avatarPlaceholder: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: t.accentSoft,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarPlaceholderText: { fontSize: 16 },
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
