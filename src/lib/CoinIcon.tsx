import Svg, { Circle, Path } from 'react-native-svg';

// Audition Credit balance icon — a flat gold coin with an embossed star,
// fixed colors (not accent-tracking) since it represents real purchased
// currency, not a themeable UI element.
export function CoinIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={46} fill="#F2B705" stroke="#C98A0B" strokeWidth={3} />
      <Circle cx={50} cy={50} r={38} fill="#FFC93C" stroke="#D99A1B" strokeWidth={2} />
      <Path
        d="M50,28 L55.29,41.28 L70.92,43.20 L58.56,52.78 L62.93,67.80 L50,59 L37.07,67.80 L41.44,52.78 L29.08,43.20 L44.71,41.28 Z"
        fill="#FFE9A8"
        stroke="#C98A0B"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
