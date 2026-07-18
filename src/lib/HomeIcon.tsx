import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/lib/theme';

const WALL = '#F5EFE0';
const WINDOW = '#BFE0F2';
const OUTLINE = '#2b3a4a';

// Home button icon — roof, chimney, and door track the selected accent
// color; walls/windows/outline stay fixed like the reference art.
export function HomeIcon({ size = 22 }: { size?: number }) {
  const t = useTheme();

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Chimney (behind roof) */}
      <Rect x={68} y={20} width={11} height={18} rx={1.5} fill={t.accent} stroke={OUTLINE} strokeWidth={2.5} />
      {/* Roof */}
      <Path
        d="M50 16 L89 51c2.5 2.3 0.8 6.3 -2.5 6.3H13.5c-3.3 0-5-4-2.5-6.3L50 16z"
        fill={t.accent}
        stroke={OUTLINE}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {/* Walls */}
      <Rect x={25} y={46} width={50} height={38} rx={4} fill={WALL} stroke={OUTLINE} strokeWidth={3} />
      {/* Windows */}
      <Rect x={31} y={55} width={15} height={15} rx={1.5} fill={WINDOW} stroke={OUTLINE} strokeWidth={2.5} />
      <Line x1={38.5} y1={55} x2={38.5} y2={70} stroke={OUTLINE} strokeWidth={2} />
      <Line x1={31} y1={62.5} x2={46} y2={62.5} stroke={OUTLINE} strokeWidth={2} />
      <Rect x={54} y={55} width={15} height={15} rx={1.5} fill={WINDOW} stroke={OUTLINE} strokeWidth={2.5} />
      <Line x1={61.5} y1={55} x2={61.5} y2={70} stroke={OUTLINE} strokeWidth={2} />
      <Line x1={54} y1={62.5} x2={69} y2={62.5} stroke={OUTLINE} strokeWidth={2} />
      {/* Door */}
      <Rect x={43} y={63} width={14} height={21} rx={1.5} fill={t.accent} stroke={OUTLINE} strokeWidth={2.5} />
      <Circle cx={53.5} cy={73.5} r={1.3} fill={OUTLINE} />
    </Svg>
  );
}
