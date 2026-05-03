/**
 * Abstract Passport — brutalist geometric artifact, deterministic from a circle ID.
 * Same ID always produces the same shape. Used in the Vault grid on profile.
 */
import React, { memo } from 'react';
import Svg, { Circle, Rect, Path, Polygon, Line, G } from 'react-native-svg';

// Deterministic hash from string (xfnv1a-like)
function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// 28 brutalist primitives — each takes (size, color, locked) and returns SVG children
const PRIMITIVES = [
  // 0: solid filled circle
  (s, c) => <Circle cx={s/2} cy={s/2} r={s*0.32} fill={c} />,
  // 1: hollow ring
  (s, c) => <Circle cx={s/2} cy={s/2} r={s*0.32} fill="none" stroke={c} strokeWidth={s*0.07} />,
  // 2: square
  (s, c) => <Rect x={s*0.22} y={s*0.22} width={s*0.56} height={s*0.56} fill={c} />,
  // 3: hollow square
  (s, c) => <Rect x={s*0.22} y={s*0.22} width={s*0.56} height={s*0.56} fill="none" stroke={c} strokeWidth={s*0.07} />,
  // 4: triangle up
  (s, c) => <Polygon points={`${s/2},${s*0.18} ${s*0.82},${s*0.78} ${s*0.18},${s*0.78}`} fill={c} />,
  // 5: triangle down
  (s, c) => <Polygon points={`${s*0.18},${s*0.22} ${s*0.82},${s*0.22} ${s/2},${s*0.82}`} fill={c} />,
  // 6: diamond
  (s, c) => <Polygon points={`${s/2},${s*0.16} ${s*0.84},${s/2} ${s/2},${s*0.84} ${s*0.16},${s/2}`} fill={c} />,
  // 7: cross/plus
  (s, c) => (
    <G>
      <Rect x={s*0.42} y={s*0.18} width={s*0.16} height={s*0.64} fill={c} />
      <Rect x={s*0.18} y={s*0.42} width={s*0.64} height={s*0.16} fill={c} />
    </G>
  ),
  // 8: X
  (s, c) => (
    <G stroke={c} strokeWidth={s*0.1} strokeLinecap="square">
      <Line x1={s*0.22} y1={s*0.22} x2={s*0.78} y2={s*0.78} />
      <Line x1={s*0.78} y1={s*0.22} x2={s*0.22} y2={s*0.78} />
    </G>
  ),
  // 9: half circle (top)
  (s, c) => <Path d={`M ${s*0.22} ${s/2} A ${s*0.28} ${s*0.28} 0 0 1 ${s*0.78} ${s/2} Z`} fill={c} />,
  // 10: half circle (bottom)
  (s, c) => <Path d={`M ${s*0.22} ${s/2} A ${s*0.28} ${s*0.28} 0 0 0 ${s*0.78} ${s/2} Z`} fill={c} />,
  // 11: concentric rings
  (s, c) => (
    <G fill="none" stroke={c} strokeWidth={s*0.05}>
      <Circle cx={s/2} cy={s/2} r={s*0.32} />
      <Circle cx={s/2} cy={s/2} r={s*0.18} />
    </G>
  ),
  // 12: dot inside square
  (s, c) => (
    <G>
      <Rect x={s*0.22} y={s*0.22} width={s*0.56} height={s*0.56} fill="none" stroke={c} strokeWidth={s*0.05} />
      <Circle cx={s/2} cy={s/2} r={s*0.12} fill={c} />
    </G>
  ),
  // 13: three vertical bars (sound wave)
  (s, c) => (
    <G fill={c}>
      <Rect x={s*0.30} y={s*0.30} width={s*0.08} height={s*0.40} />
      <Rect x={s*0.46} y={s*0.20} width={s*0.08} height={s*0.60} />
      <Rect x={s*0.62} y={s*0.35} width={s*0.08} height={s*0.30} />
    </G>
  ),
  // 14: arrow up
  (s, c) => (
    <G stroke={c} strokeWidth={s*0.08} strokeLinecap="square" fill="none">
      <Line x1={s/2} y1={s*0.18} x2={s/2} y2={s*0.82} />
      <Line x1={s*0.28} y1={s*0.40} x2={s/2} y2={s*0.18} />
      <Line x1={s*0.72} y1={s*0.40} x2={s/2} y2={s*0.18} />
    </G>
  ),
  // 15: hexagon
  (s, c) => (
    <Polygon
      points={`${s/2},${s*0.16} ${s*0.83},${s*0.32} ${s*0.83},${s*0.68} ${s/2},${s*0.84} ${s*0.17},${s*0.68} ${s*0.17},${s*0.32}`}
      fill={c}
    />
  ),
  // 16: hollow hexagon
  (s, c) => (
    <Polygon
      points={`${s/2},${s*0.16} ${s*0.83},${s*0.32} ${s*0.83},${s*0.68} ${s/2},${s*0.84} ${s*0.17},${s*0.68} ${s*0.17},${s*0.32}`}
      fill="none" stroke={c} strokeWidth={s*0.07}
    />
  ),
  // 17: dotted circle (grid of dots in circle pattern)
  (s, c) => (
    <G fill={c}>
      <Circle cx={s/2} cy={s*0.20} r={s*0.06} />
      <Circle cx={s*0.78} cy={s*0.36} r={s*0.06} />
      <Circle cx={s*0.78} cy={s*0.64} r={s*0.06} />
      <Circle cx={s/2} cy={s*0.80} r={s*0.06} />
      <Circle cx={s*0.22} cy={s*0.64} r={s*0.06} />
      <Circle cx={s*0.22} cy={s*0.36} r={s*0.06} />
    </G>
  ),
  // 18: 3x3 dot grid
  (s, c) => (
    <G fill={c}>
      {[0.25, 0.5, 0.75].flatMap((y, i) =>
        [0.25, 0.5, 0.75].map((x, j) => (
          <Circle key={`${i}-${j}`} cx={s*x} cy={s*y} r={s*0.06} />
        ))
      )}
    </G>
  ),
  // 19: vertical bar
  (s, c) => <Rect x={s*0.42} y={s*0.16} width={s*0.16} height={s*0.68} fill={c} />,
  // 20: horizontal bar
  (s, c) => <Rect x={s*0.16} y={s*0.42} width={s*0.68} height={s*0.16} fill={c} />,
  // 21: slash
  (s, c) => <Line x1={s*0.22} y1={s*0.78} x2={s*0.78} y2={s*0.22} stroke={c} strokeWidth={s*0.10} strokeLinecap="square" />,
  // 22: half-square (top)
  (s, c) => <Rect x={s*0.20} y={s*0.20} width={s*0.60} height={s*0.30} fill={c} />,
  // 23: half-square (bottom)
  (s, c) => <Rect x={s*0.20} y={s/2} width={s*0.60} height={s*0.30} fill={c} />,
  // 24: triangle outline
  (s, c) => (
    <Polygon
      points={`${s/2},${s*0.18} ${s*0.82},${s*0.78} ${s*0.18},${s*0.78}`}
      fill="none" stroke={c} strokeWidth={s*0.07}
    />
  ),
  // 25: octagon
  (s, c) => (
    <Polygon
      points={`${s*0.32},${s*0.18} ${s*0.68},${s*0.18} ${s*0.82},${s*0.32} ${s*0.82},${s*0.68} ${s*0.68},${s*0.82} ${s*0.32},${s*0.82} ${s*0.18},${s*0.68} ${s*0.18},${s*0.32}`}
      fill={c}
    />
  ),
  // 26: small square in corner
  (s, c) => (
    <G>
      <Rect x={s*0.18} y={s*0.18} width={s*0.64} height={s*0.64} fill="none" stroke={c} strokeWidth={s*0.05} />
      <Rect x={s*0.18} y={s*0.18} width={s*0.30} height={s*0.30} fill={c} />
    </G>
  ),
  // 27: target
  (s, c) => (
    <G>
      <Circle cx={s/2} cy={s/2} r={s*0.32} fill="none" stroke={c} strokeWidth={s*0.04} />
      <Circle cx={s/2} cy={s/2} r={s*0.20} fill="none" stroke={c} strokeWidth={s*0.04} />
      <Circle cx={s/2} cy={s/2} r={s*0.08} fill={c} />
    </G>
  ),
];

function Artifact({ id, size = 64, locked = false }) {
  const h = hash(String(id || ''));
  const idx = h % PRIMITIVES.length;
  const prim = PRIMITIVES[idx];

  // Unlocked: solid black tile with bright white shape (a "stamp")
  // Locked:   light gray tile with a faded outline-only shape (a placeholder)
  const bg = locked ? '#F2F2F7' : '#000000';
  const fg = locked ? '#D8D8DD' : '#FFFFFF';

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} fill={bg} />
      {prim(size, fg)}
    </Svg>
  );
}

export default memo(Artifact);
