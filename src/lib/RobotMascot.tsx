import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';

const AEllipse = Animated.createAnimatedComponent(Ellipse);
const ARect = Animated.createAnimatedComponent(Rect);

// A little robot mascot, drawn to match the app's helper-bot art: blue disc,
// silver rounded head with a dark visor, glowing cyan eyes, and a dark body
// with a teal chest light. It's "alive" — it bobs, its eyes blink at random
// intervals, and the eyes/chest light pulse. `float={false}` freezes the bob
// (used for the small header avatar inside the chat panel).
export function RobotMascot({ size = 96, float = true }: { size?: number; float?: boolean }) {
  const bob = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(0)).current; // 0 = open, 1 = closed
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!float) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, float]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const doBlink = () => {
      Animated.sequence([
        Animated.timing(blink, { toValue: 1, duration: 80, useNativeDriver: false }),
        Animated.timing(blink, { toValue: 0, duration: 90, useNativeDriver: false }),
      ]).start(() => {
        if (cancelled) return;
        timer = setTimeout(doBlink, 2200 + Math.random() * 2800);
      });
    };
    timer = setTimeout(doBlink, 1400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [blink]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const eyeRy = blink.interpolate({ inputRange: [0, 1], outputRange: [5.2, 0.5] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ translateY }] }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Blue disc background */}
        <Circle cx={50} cy={50} r={50} fill="#4F86D6" />
        <Circle cx={50} cy={44} r={44} fill="#5B92DE" opacity={0.55} />

        {/* Antenna */}
        <Line x1={50} y1={21} x2={50} y2={13} stroke="#CBD5DF" strokeWidth={2.4} strokeLinecap="round" />
        <Circle cx={50} cy={11} r={2.7} fill="#7FE7FF" />

        {/* Body / shoulders */}
        <Path d="M31 76 q0 -13 19 -13 q19 0 19 13 v4 q0 3 -3 3 H34 q-3 0 -3 -3 z" fill="#3A414C" />
        <Path d="M31 76 q0 -13 19 -13 q19 0 19 13 v2 H31 z" fill="#454E5A" />
        {/* Chest light */}
        <ARect x={44} y={69} width={12} height={9} rx={2.5} fill="#37C2B1" opacity={glowOpacity} />

        {/* Neck */}
        <Rect x={45} y={57} width={10} height={7} rx={2} fill="#2E343D" />

        {/* Head */}
        <Rect x={24} y={22} width={52} height={42} rx={19} fill="#EAEFF4" />
        {/* Subtle right-side shading + center seam for a molded look */}
        <Path d="M50 22 h7 a19 19 0 0 1 19 19 v4 a19 19 0 0 1 -19 19 H50 z" fill="#DBE3EB" opacity={0.7} />
        <Line x1={50} y1={24} x2={50} y2={62} stroke="#CBD4DD" strokeWidth={1.4} />
        {/* Little cheek circuit line, like the reference art */}
        <Path d="M31 50 l4 0 l2 2 l4 0" stroke="#B7C2CE" strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Ears */}
        <Circle cx={25} cy={43} r={6.6} fill="#C2CCD6" />
        <Circle cx={25} cy={43} r={3} fill="#8B98A6" />
        <Circle cx={75} cy={43} r={6.6} fill="#C2CCD6" />
        <Circle cx={75} cy={43} r={3} fill="#8B98A6" />

        {/* Visor */}
        <Rect x={33} y={31} width={34} height={23} rx={11} fill="#1E2750" />
        <Rect x={35} y={33} width={30} height={8} rx={4} fill="#28336A" opacity={0.6} />

        {/* Glowing eyes (blink + pulse) */}
        <AEllipse cx={44} cy={43} rx={5.2} ry={eyeRy} fill="#8FEAFF" opacity={glowOpacity} />
        <AEllipse cx={57} cy={43} rx={5.2} ry={eyeRy} fill="#8FEAFF" opacity={glowOpacity} />
      </Svg>
    </Animated.View>
  );
}
