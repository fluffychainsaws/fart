import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/lib/AppText';
import { RobotMascot } from '@/lib/RobotMascot';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';

type Rect = { x: number; y: number; w: number; h: number };

// A guided coach-mark tour for the New Script page: the helper robot slides in
// from the sidebar side, moves to each numbered step, rings it, and narrates
// from a bottom card. Non-blocking (pointerEvents box-none) so the page stays
// usable while the tour runs. Web-only — the numbered steps only exist there.
export function CaptureTour({
  stepRefs,
  texts,
  visible,
  onDone,
}: {
  stepRefs: React.RefObject<View | null>[];
  texts: string[];
  visible: boolean;
  onDone: () => void;
}) {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const overlayRef = useRef<View>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [index, setIndex] = useState(0);
  const [ring, setRing] = useState<Rect | null>(null);
  const pos = useRef(new Animated.ValueXY({ x: -110, y: 40 })).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const ROBOT = 74;

  // Position of a step relative to this overlay's own top-left, so the robot
  // and ring line up regardless of the sidebar/header offset.
  const measure = useCallback(
    (node: View | null) =>
      new Promise<Rect | null>((resolve) => {
        const overlay = overlayRef.current;
        if (!node || !overlay) return resolve(null);
        overlay.measureInWindow((ox, oy) => {
          node.measureInWindow((x, y, w, h) => resolve({ x: x - ox, y: y - oy, w, h }));
        });
      }),
    [],
  );

  // Restart from step one each time the tour opens (robot enters from the left).
  useEffect(() => {
    if (visible) {
      setIndex(0);
      pos.setValue({ x: -110, y: 40 });
      ringOpacity.setValue(0);
    }
  }, [visible, pos, ringOpacity]);

  // Move the robot + ring onto the current step.
  useEffect(() => {
    if (!visible || size.w === 0) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      const r = await measure(stepRefs[index]?.current ?? null);
      if (cancelled || !r) return;
      setRing(r);
      // Prefer sitting to the LEFT of the step (pointing right at it); if there's
      // no room, tuck in on the right instead. Always clamp on-screen.
      let tx = r.x - ROBOT - 6;
      if (tx < 6) tx = r.x + r.w + 6;
      tx = Math.max(6, Math.min(tx, size.w - ROBOT - 6));
      const ty = Math.max(6, Math.min(r.y + r.h / 2 - ROBOT / 2, size.h - ROBOT - 6));
      Animated.parallel([
        Animated.spring(pos, { toValue: { x: tx, y: ty }, useNativeDriver: true, friction: 7, tension: 55 }),
        Animated.timing(ringOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [visible, index, size, measure, stepRefs, pos, ringOpacity]);

  if (!visible) return null;
  const last = index >= texts.length - 1;

  return (
    <View
      ref={overlayRef}
      style={styles.overlay}
      pointerEvents="box-none"
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {ring && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            { left: ring.x - 6, top: ring.y - 6, width: ring.w + 12, height: ring.h + 12, opacity: ringOpacity },
          ]}
        />
      )}

      <Animated.View
        pointerEvents="none"
        style={[styles.robot, { transform: [{ translateX: pos.x }, { translateY: pos.y }] }]}>
        <RobotMascot size={ROBOT} />
      </Animated.View>

      <View style={styles.barWrap} pointerEvents="box-none">
        <View style={styles.bar}>
          <Text style={styles.barText}>{texts[index]}</Text>
          <View style={styles.barControls}>
            <View style={styles.dots}>
              {texts.map((_, i) => (
                <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
              ))}
            </View>
            <View style={styles.barBtns}>
              <Pressable onPress={onDone} hitSlop={8} style={styles.skipBtn}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
              <Pressable
                onPress={() => (last ? onDone() : setIndex((i) => i + 1))}
                style={({ pressed }) => [styles.nextBtn, pressed && { opacity: 0.8 }]}>
                <Text style={styles.nextText}>{last ? 'Got it!' : 'Next'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (t: Theme, shadow: ReturnType<typeof useCardShadow>) =>
  StyleSheet.create({
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },
    ring: {
      position: 'absolute',
      borderWidth: 3,
      borderColor: t.accent,
      borderRadius: 16,
      backgroundColor: 'transparent',
    },
    robot: { position: 'absolute', top: 0, left: 0 },
    barWrap: { position: 'absolute', left: 0, right: 0, bottom: 20, alignItems: 'center', paddingHorizontal: 16 },
    bar: {
      width: '100%',
      maxWidth: 460,
      backgroundColor: t.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.accent,
      padding: 16,
      ...shadow,
    },
    barText: { fontSize: 15, lineHeight: 21, color: t.ink, fontWeight: '600' },
    barControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
    dots: { flexDirection: 'row', gap: 6 },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.border },
    dotOn: { backgroundColor: t.accent, width: 18 },
    barBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    skipBtn: { paddingVertical: 8, paddingHorizontal: 12 },
    skipText: { color: t.inkSoft, fontSize: 14, fontWeight: '700' },
    nextBtn: { backgroundColor: t.accent, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 18 },
    nextText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  });
