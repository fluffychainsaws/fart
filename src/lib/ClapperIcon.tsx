import Svg, { Circle, G, Line, Rect } from 'react-native-svg';

const BOARD = '#1a1a1a';
const STRIPE = '#F5F0E6';
const HINGE = '#8a8a8a';

// Clapperboard icon for "New script" — replaces the camera emoji since
// scripts are uploaded as PDFs/photos of sides, not shot with the camera.
export function ClapperIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G transform="rotate(-18 25 45)">
        <Rect x={18} y={32} width={64} height={16} rx={4} fill={BOARD} stroke={STRIPE} strokeWidth={2} />
        <Rect x={30} y={32} width={8} height={16} fill={STRIPE} />
        <Rect x={48} y={32} width={8} height={16} fill={STRIPE} />
        <Rect x={66} y={32} width={8} height={16} fill={STRIPE} />
      </G>
      <Circle cx={25} cy={45} r={4} fill={HINGE} stroke={BOARD} strokeWidth={1.5} />
      <Rect x={15} y={45} width={70} height={40} rx={6} fill={BOARD} stroke={STRIPE} strokeWidth={2} />
      <Line x1={25} y1={58} x2={75} y2={58} stroke={STRIPE} strokeWidth={2.5} />
      <Line x1={25} y1={67} x2={75} y2={67} stroke={STRIPE} strokeWidth={2.5} />
      <Rect x={58} y={74} width={17} height={8} rx={1.5} fill="none" stroke={STRIPE} strokeWidth={2} />
    </Svg>
  );
}
