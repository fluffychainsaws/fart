import Svg, { Rect, Path, Line } from 'react-native-svg';

import { useTheme } from '@/lib/theme';

// Mic test icon: rounded-square badge whose background follows whatever
// palette/accent is currently selected, in place of a fixed color.
export function MicIcon({ size = 28 }: { size?: number }) {
  const t = useTheme();
  const s = size;

  return (
    <Svg width={s} height={s} viewBox="0 0 100 100">
      <Rect x={0} y={0} width={100} height={100} rx={22} fill={t.accent} />
      {/* Mic capsule */}
      <Path
        d="M50 14c-8 0-14 6-14 14v24c0 8 6 14 14 14s14-6 14-14V28c0-8-6-14-14-14z"
        fill="#F5F0E6"
        stroke="#243447"
        strokeWidth={3.5}
      />
      {/* Grille lines */}
      <Line x1={36.5} y1={30} x2={63.5} y2={30} stroke="#243447" strokeWidth={3} />
      <Line x1={36} y1={38.5} x2={64} y2={38.5} stroke="#243447" strokeWidth={3} />
      <Line x1={36} y1={47} x2={64} y2={47} stroke="#243447" strokeWidth={3} />
      {/* Stand */}
      <Path
        d="M42 66v10c0 3 3 5 8 5s8-2 8-5V66"
        fill="#F5F0E6"
        stroke="#243447"
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      {/* Base foot */}
      <Path
        d="M38 81h24c2 0 3 2 1.5 3.5-2 2-6.5 3.5-13.5 3.5s-11.5-1.5-13.5-3.5C35 83 36 81 38 81z"
        fill="#F5F0E6"
        stroke="#243447"
        strokeWidth={3.5}
      />
    </Svg>
  );
}
