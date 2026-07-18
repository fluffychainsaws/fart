import Svg, { Rect, Path, Circle } from 'react-native-svg';

import { useTheme } from '@/lib/theme';

// Logout icon: door stays white always; the exit arrow follows whatever
// palette/accent is currently selected.
export function LogoutIcon({ size = 22 }: { size?: number }) {
  const t = useTheme();

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Door frame */}
      <Rect x={30} y={8} width={34} height={84} rx={3} fill="#FFFFFF" />
      <Rect x={38} y={16} width={18} height={68} rx={2} fill="#B9BDC4" />
      {/* Door panel */}
      <Rect x={26} y={14} width={26} height={72} rx={2} fill="#FFFFFF" />
      <Circle cx={43} cy={50} r={4} fill="#8A8F98" />
      {/* Exit arrow */}
      <Path d="M58 32 L86 50 L58 68 Z" fill={t.accent} />
    </Svg>
  );
}
