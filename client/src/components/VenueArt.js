/**
 * Brutalist line-art illustration of a venue.
 *
 * Picks a hand-crafted drawing for known venues (matched by name) or falls
 * back to a generic illustration based on venueType.
 *
 * The art is single-stroke, black on transparent, full-width, and ~80pt tall.
 * SVG viewBox is 100×40 — every drawing fits the same canvas so they can be
 * swapped without layout shift.
 */
import React, { memo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Line, Polyline, Polygon, Circle, G, Rect } from 'react-native-svg';

const VB = { w: 100, h: 40 };

// Common stroke props
const STROKE = (extra = {}) => ({
  stroke: '#000000',
  strokeWidth: 1.2,
  fill: 'none',
  strokeLinecap: 'square',
  strokeLinejoin: 'miter',
  ...extra,
});

// ── Hand-crafted illustrations (by lowercase name) ─────────────────────────

const NAMED = {
  // The Avenues — long facade, central arched canopy (the Grand Avenue)
  'the avenues': () => (
    <G>
      <Line x1={2} y1={36} x2={98} y2={36} {...STROKE()} />
      <Polyline points="6,36 6,28 14,28 14,32 22,32 22,26 30,26 30,30" {...STROKE()} />
      <Path d="M 30 30 Q 32 12 50 12 Q 68 12 70 30" {...STROKE()} />
      <Polyline points="70,30 78,30 78,26 86,26 86,32 94,32 94,36" {...STROKE()} />
      <Line x1={48} y1={20} x2={52} y2={20} {...STROKE({ strokeWidth: 0.8 })} />
    </G>
  ),
  'avenues': () => NAMED['the avenues'](),

  // home — small house with chimney
  'home': () => (
    <G>
      <Polyline points="20,36 20,18 34,8 48,18 48,36" {...STROKE()} />
      <Rect x={42} y={4} width={4} height={10} {...STROKE()} />
      <Rect x={28} y={24} width={6} height={12} {...STROKE()} />
      <Line x1={20} y1={36} x2={48} y2={36} {...STROKE()} />
    </G>
  ),
};

// ── Type-based fallbacks ────────────────────────────────────────────────────

const TYPE_ART = {
  mall: () => (
    <G>
      <Line x1={2} y1={36} x2={98} y2={36} {...STROKE()} />
      <Polyline points="8,36 8,22 24,22 24,28 40,28 40,18 60,18 60,28 76,28 76,22 92,22 92,36" {...STROKE()} />
      <Line x1={40} y1={10} x2={60} y2={10} {...STROKE()} />
      <Line x1={50} y1={10} x2={50} y2={18} {...STROKE()} />
    </G>
  ),
  cafe: () => (
    <G>
      <Line x1={10} y1={36} x2={90} y2={36} {...STROKE()} />
      {/* Cup */}
      <Path d="M 38 24 H 60 V 32 Q 60 36 56 36 H 42 Q 38 36 38 32 Z" {...STROKE()} />
      {/* Handle */}
      <Path d="M 60 26 Q 66 26 66 30 Q 66 34 60 34" {...STROKE()} />
      {/* Steam */}
      <Path d="M 44 18 Q 46 14 44 10" {...STROKE({ strokeWidth: 0.9 })} />
      <Path d="M 50 18 Q 52 14 50 10" {...STROKE({ strokeWidth: 0.9 })} />
      <Path d="M 56 18 Q 58 14 56 10" {...STROKE({ strokeWidth: 0.9 })} />
    </G>
  ),
  coffee_shop: () => TYPE_ART.cafe(),
  restaurant: () => (
    <G>
      <Line x1={2} y1={36} x2={98} y2={36} {...STROKE()} />
      {/* Plate */}
      <Path d="M 30 30 Q 50 18 70 30" {...STROKE()} />
      <Line x1={30} y1={30} x2={70} y2={30} {...STROKE()} />
      {/* Fork */}
      <Line x1={20} y1={10} x2={20} y2={32} {...STROKE()} />
      <Line x1={17} y1={10} x2={17} y2={18} {...STROKE({ strokeWidth: 0.9 })} />
      <Line x1={23} y1={10} x2={23} y2={18} {...STROKE({ strokeWidth: 0.9 })} />
      {/* Knife */}
      <Polyline points="80,10 80,32 84,32 84,16 80,10" {...STROKE()} />
    </G>
  ),
  fast_food: () => TYPE_ART.restaurant(),
  food_court: () => TYPE_ART.restaurant(),
  bakery: () => TYPE_ART.cafe(),
  ice_cream: () => (
    <G>
      <Polygon points="50,10 40,30 60,30" {...STROKE()} />
      <Circle cx={50} cy={10} r={6} {...STROKE()} />
      <Line x1={36} y1={36} x2={64} y2={36} {...STROKE()} />
    </G>
  ),
  gym: () => (
    <G>
      <Line x1={20} y1={20} x2={80} y2={20} {...STROKE({ strokeWidth: 1.6 })} />
      <Rect x={14} y={14} width={4} height={12} {...STROKE()} />
      <Rect x={6} y={10} width={6} height={20} {...STROKE()} />
      <Rect x={82} y={14} width={4} height={12} {...STROKE()} />
      <Rect x={88} y={10} width={6} height={20} {...STROKE()} />
      <Line x1={2} y1={36} x2={98} y2={36} {...STROKE()} />
    </G>
  ),
  fitness_centre: () => TYPE_ART.gym(),
  sports_centre: () => TYPE_ART.gym(),
  swimming_pool: () => (
    <G>
      <Path d="M 0 24 Q 12 18 25 24 T 50 24 T 75 24 T 100 24" {...STROKE()} />
      <Path d="M 0 30 Q 12 24 25 30 T 50 30 T 75 30 T 100 30" {...STROKE()} />
      <Path d="M 0 36 Q 12 30 25 36 T 50 36 T 75 36 T 100 36" {...STROKE()} />
      <Circle cx={70} cy={12} r={5} {...STROKE()} />
    </G>
  ),
  cinema: () => (
    <G>
      <Rect x={10} y={10} width={80} height={20} {...STROKE()} />
      <Line x1={2} y1={36} x2={98} y2={36} {...STROKE()} />
      <Polyline points="40,18 56,20 40,22 40,18" {...STROKE()} />
      <Line x1={10} y1={30} x2={90} y2={30} {...STROKE()} />
      <Line x1={20} y1={10} x2={20} y2={6} {...STROKE({ strokeWidth: 0.8 })} />
      <Line x1={50} y1={10} x2={50} y2={6} {...STROKE({ strokeWidth: 0.8 })} />
      <Line x1={80} y1={10} x2={80} y2={6} {...STROKE({ strokeWidth: 0.8 })} />
    </G>
  ),
  theatre: () => TYPE_ART.cinema(),
  hotel: () => (
    <G>
      <Polyline points="20,36 20,8 80,8 80,36" {...STROKE()} />
      <Line x1={2} y1={36} x2={98} y2={36} {...STROKE()} />
      {[14, 20, 26].map((y) => (
        [30, 40, 50, 60, 70].map((x) => (
          <Rect key={`${x}-${y}`} x={x} y={y} width={4} height={3} {...STROKE({ strokeWidth: 0.8 })} />
        ))
      ))}
    </G>
  ),
  hospital: () => (
    <G>
      <Rect x={20} y={10} width={60} height={26} {...STROKE()} />
      <Line x1={2} y1={36} x2={98} y2={36} {...STROKE()} />
      <Line x1={50} y1={16} x2={50} y2={30} {...STROKE({ strokeWidth: 1.6 })} />
      <Line x1={43} y1={23} x2={57} y2={23} {...STROKE({ strokeWidth: 1.6 })} />
    </G>
  ),
  mosque: () => (
    <G>
      <Path d="M 30 30 Q 30 18 50 18 Q 70 18 70 30" {...STROKE()} />
      <Line x1={2} y1={36} x2={98} y2={36} {...STROKE()} />
      <Polyline points="14,36 14,8 18,8 18,36" {...STROKE()} />
      <Polyline points="82,36 82,8 86,8 86,36" {...STROKE()} />
      <Polygon points="14,8 16,4 18,8" {...STROKE()} />
      <Polygon points="82,8 84,4 86,8" {...STROKE()} />
      <Line x1={30} y1={30} x2={70} y2={30} {...STROKE()} />
      <Line x1={50} y1={12} x2={50} y2={6} {...STROKE({ strokeWidth: 0.8 })} />
    </G>
  ),
  beach: () => (
    <G>
      <Circle cx={20} cy={14} r={6} {...STROKE()} />
      <Path d="M 0 30 Q 15 26 30 30 T 60 30 T 100 30" {...STROKE()} />
      <Path d="M 0 34 Q 15 30 30 34 T 60 34 T 100 34" {...STROKE()} />
    </G>
  ),
  park: () => (
    <G>
      <Line x1={2} y1={36} x2={98} y2={36} {...STROKE()} />
      <Circle cx={30} cy={20} r={10} {...STROKE()} />
      <Line x1={30} y1={30} x2={30} y2={36} {...STROKE()} />
      <Polygon points="60,32 50,18 70,18" {...STROKE()} />
      <Line x1={60} y1={32} x2={60} y2={36} {...STROKE()} />
      <Polygon points="80,32 72,16 88,16" {...STROKE()} />
      <Line x1={80} y1={32} x2={80} y2={36} {...STROKE()} />
    </G>
  ),
  residence: () => NAMED.home(),

  // Generic / unknown — abstract horizontal city silhouette
  default: () => (
    <G>
      <Line x1={2} y1={36} x2={98} y2={36} {...STROKE()} />
      <Polyline points="6,36 6,24 14,24 14,30 24,30 24,18 36,18 36,28 48,28 48,12 60,12 60,28 72,28 72,22 82,22 82,30 92,30 92,36" {...STROKE()} />
    </G>
  ),
};

function pickArt(name, type) {
  if (name) {
    const key = String(name).toLowerCase().trim();
    if (NAMED[key]) return NAMED[key];
  }
  if (type && TYPE_ART[type]) return TYPE_ART[type];
  return TYPE_ART.default;
}

function VenueArt({ name, type, width = 320, height = 64, color = '#000000' }) {
  const draw = pickArt(name, type);
  return (
    <View pointerEvents="none" style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${VB.w} ${VB.h}`} preserveAspectRatio="xMidYMid meet">
        {draw({ color })}
      </Svg>
    </View>
  );
}

export default memo(VenueArt);
