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
  scrollTick = 0,
}: {
  stepRefs: React.RefObject<View | null>[];
  texts: string[];
  visible: boolean;
  onDone: () => void;
  // Bumped by the page's ScrollView on every scroll so the highlight can
  // re-measure and stay glued to its step.
  scrollTick?: number;
}) {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const overlayRef = useRef<View>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [index, setIndex] = useState(0);
  const [ring, setRing] = useState<Rect | null>(null);
  const [robot, setRobot] = useState({ x: -110, y: 40 });
  const pos = useRef(new Animated.ValueXY({ x: -110, y: 40 })).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const bubbleAnim = useRef(new Animated.Value(0)).current; // pop-in per step
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
      setRobot({ x: -110, y: 40 });
      ringOpacity.setValue(0);
      bubbleAnim.setValue(0);
    }
  }, [visible, pos, ringOpacity, bubbleAnim]);

  // Measure the current step and put the ring + robot + bubble on it. When
  // `animate` is true (advancing to a step) the robot springs over and the
  // bubble pops; when false (scrolling) everything snaps so it stays glued.
  const place = useCallback(
    async (animate: boolean) => {
      if (!visible || size.w === 0) return;
      const r = await measure(stepRefs[index]?.current ?? null);
      if (!r) return;
      setRing(r);
      // Prefer sitting to the LEFT of the step (pointing right at it); if there's
      // no room, tuck in on the right instead. Always clamp on-screen.
      let tx = r.x - ROBOT - 6;
      if (tx < 6) tx = r.x + r.w + 6;
      tx = Math.max(6, Math.min(tx, size.w - ROBOT - 6));
      const ty = Math.max(6, Math.min(r.y + r.h / 2 - ROBOT / 2, size.h - ROBOT - 6));
      setRobot({ x: tx, y: ty });
      if (animate) {
        bubbleAnim.setValue(0);
        Animated.parallel([
          Animated.spring(pos, { toValue: { x: tx, y: ty }, useNativeDriver: true, friction: 7, tension: 55 }),
          Animated.timing(ringOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(200),
            Animated.spring(bubbleAnim, { toValue: 1, useNativeDriver: true, friction: 6, tension: 90 }),
          ]),
        ]).start();
      } else {
        pos.setValue({ x: tx, y: ty });
        ringOpacity.setValue(1);
        bubbleAnim.setValue(1);
      }
    },
    [visible, size, index, measure, stepRefs, pos, ringOpacity, bubbleAnim],
  );
  // Always call the latest `place` without making the effects below re-run on
  // every dependency change.
  const placeRef = useRef(place);
  placeRef.current = place;

  // Advance: animate onto the step when the tour opens or the step changes.
  useEffect(() => {
    if (!visible || size.w === 0) return;
    const id = setTimeout(() => placeRef.current(true), 60);
    return () => clearTimeout(id);
  }, [visible, index, size]);

  // Scroll: snap the highlight back onto its step as the page scrolls.
  useEffect(() => {
    if (!visible || scrollTick === 0) return;
    placeRef.current(false);
  }, [scrollTick, visible]);

  if (!visible) return null;
  const last = index >= texts.length - 1;

  // Speech-bubble geometry, tethered to the robot. Sits below the robot when
  // it's in the upper part of the screen, above it when it's lower, and its
  // tail points back at the robot's center.
  const bubbleW = Math.min(340, Math.max(200, size.w - 24));
  const robotCx = robot.x + ROBOT / 2;
  const below = robot.y < size.h * 0.55;
  const bubbleLeft = Math.max(12, Math.min(robotCx - bubbleW / 2, size.w - bubbleW - 12));
  const tailX = Math.max(22, Math.min(robotCx - bubbleLeft, bubbleW - 22));
  const bubbleScale = bubbleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });

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

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.bubbleWrap,
          { left: bubbleLeft, width: bubbleW },
          below ? { top: robot.y + ROBOT + 12 } : { bottom: size.h - robot.y + 12 },
          { opacity: bubbleAnim, transform: [{ scale: bubbleScale }] },
        ]}>
        <View
          pointerEvents="none"
          style={[styles.tail, { left: tailX - 8 }, below ? styles.tailUp : styles.tailDown]}
        />
        <View style={styles.bubble}>
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
      </Animated.View>
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
    bubbleWrap: { position: 'absolute' },
    // Rotated square that forms the bubble's tail; only the two outward-facing
    // edges are colored, and the bubble body paints over its inner half.
    tail: {
      position: 'absolute',
      width: 16,
      height: 16,
      backgroundColor: t.card,
      transform: [{ rotate: '45deg' }],
    },
    tailUp: { top: -7, borderTopWidth: 1, borderLeftWidth: 1, borderColor: t.accent },
    tailDown: { bottom: -7, borderBottomWidth: 1, borderRightWidth: 1, borderColor: t.accent },
    bubble: {
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
