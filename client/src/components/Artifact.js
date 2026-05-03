/**
 * Brutalist monogram tile — derives a 1–3 character mark from the venue name.
 *
 *   "The Avenues"  → "TA"
 *   "home"         → "HM"
 *   "Caribou Coffee" → "CC"
 *   "مطعم الفنر" → "مف"
 *
 * Locked:   light tile, muted glyph (placeholder)
 * Unlocked: solid black tile, bright white glyph (a real stamp)
 *
 * Includes a deterministic decorative bar derived from the id so identical
 * monograms (e.g. two cafés starting with "C") still feel distinct.
 */
import React, { memo } from 'react';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';

// --- Helpers ---------------------------------------------------------------

const ARTICLES = new Set([
  'the', 'a', 'an',
  'al', 'ال',                 // Arabic article (with the alif-lam attached)
]);

function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function isArabicChar(ch) {
  if (!ch) return false;
  const c = ch.charCodeAt(0);
  return (c >= 0x0600 && c <= 0x06FF) || (c >= 0x0750 && c <= 0x077F);
}

// Strip common articles (English + Arabic), then take 2 letters that read as
// a monogram. Single-word names take the first two letters; multi-word names
// take the first letter of the first two surviving words.
function monogramFor(name) {
  if (!name) return '?';
  const cleaned = String(name).trim();
  if (!cleaned) return '?';

  // Tokenize by whitespace, drop empty, lowercase, filter articles
  const words = cleaned
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]+/gu, '')) // strip punctuation
    .filter(Boolean)
    .filter((w) => !ARTICLES.has(w.toLowerCase()));

  if (words.length === 0) return cleaned.slice(0, 2);

  if (words.length === 1) {
    const w = words[0];
    return w.length >= 2 ? w.slice(0, 2) : w;
  }

  const first = words[0][0];
  const second = words[1][0];
  return `${first}${second}`;
}

// --- Component -------------------------------------------------------------

function Artifact({ id, title, size = 64, locked = false }) {
  const monogram = monogramFor(title);
  const ar = isArabicChar(monogram[0]);

  // Color tokens
  const bg = locked ? '#F2F2F7' : '#000000';
  const fg = locked ? '#A1A1AA' : '#FFFFFF';
  const accent = locked ? '#D8D8DD' : '#FFFFFF';

  // Deterministic bar position (0–3) so collisions feel distinct
  const variant = id ? hash(String(id)) % 4 : 0;

  // Sizing — bigger when single-letter / Arabic, smaller for 2-letter Latin
  const len = monogram.length;
  const sizeFactor = ar ? 0.62 : len >= 2 ? 0.50 : 0.66;
  const fontSize = Math.round(size * sizeFactor);

  // Decorative corner bar — small, doesn't fight the monogram
  const barW = size * 0.30;
  const barH = size * 0.04;
  const margin = size * 0.10;

  // Where to place the bar based on variant
  const barPositions = [
    { x: margin, y: margin },                          // top-left
    { x: size - margin - barW, y: margin },            // top-right
    { x: margin, y: size - margin - barH },            // bottom-left
    { x: size - margin - barW, y: size - margin - barH }, // bottom-right
  ];
  const bar = barPositions[variant];

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} fill={bg} />
      <Rect x={bar.x} y={bar.y} width={barW} height={barH} fill={accent} opacity={0.7} />
      <G>
        <SvgText
          x={size / 2}
          y={size / 2}
          fontSize={fontSize}
          fontWeight="900"
          fill={fg}
          textAnchor="middle"
          alignmentBaseline="central"
          // Slight kerning negative for tight stacking on Latin pairs
          letterSpacing={ar ? 0 : -1}
        >
          {ar ? monogram : monogram.toUpperCase()}
        </SvgText>
      </G>
    </Svg>
  );
}

export default memo(Artifact);
