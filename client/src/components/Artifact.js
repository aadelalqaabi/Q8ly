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
 * Implemented as plain View + Text — react-native-svg's Text doesn't
 * center reliably across iOS/Android, so we keep it native.
 */
import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ARTICLES = new Set(['the', 'a', 'an', 'al', 'ال']);

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

function monogramFor(name) {
  if (!name) return '?';
  const cleaned = String(name).trim();
  if (!cleaned) return '?';
  const words = cleaned
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter(Boolean)
    .filter((w) => !ARTICLES.has(w.toLowerCase()));
  if (words.length === 0) return cleaned.slice(0, 2);
  if (words.length === 1) return words[0].slice(0, 2);
  return `${words[0][0]}${words[1][0]}`;
}

function Artifact({ id, title, size = 64, locked = false }) {
  const monogram = monogramFor(title);
  const ar = isArabicChar(monogram[0]);

  const bg = locked ? '#F2F2F7' : '#000000';
  const fg = locked ? '#A1A1AA' : '#FFFFFF';
  const accent = locked ? '#D8D8DD' : '#FFFFFF';

  // Deterministic decorative bar in one of four corners
  const variant = id ? hash(String(id)) % 4 : 0;
  const barW = Math.round(size * 0.30);
  const barH = Math.max(2, Math.round(size * 0.04));
  const margin = Math.round(size * 0.10);
  const barPos = (() => {
    switch (variant) {
      case 1: return { right: margin, top: margin };
      case 2: return { left: margin, bottom: margin };
      case 3: return { right: margin, bottom: margin };
      default: return { left: margin, top: margin };
    }
  })();

  // Sizing — bigger for single-letter or Arabic, smaller for 2-letter Latin
  const len = monogram.length;
  const sizeFactor = ar ? 0.50 : len >= 2 ? 0.42 : 0.58;
  const fontSize = Math.round(size * sizeFactor);

  const display = ar ? monogram : monogram.toUpperCase();

  return (
    <View style={[styles.tile, { width: size, height: size, backgroundColor: bg }]}>
      <View
        style={[
          styles.bar,
          { width: barW, height: barH, backgroundColor: accent, opacity: 0.7, ...barPos },
        ]}
      />
      <Text
        allowFontScaling={false}
        style={{
          fontSize,
          fontWeight: '900',
          color: fg,
          letterSpacing: ar ? 0 : -1,
          lineHeight: fontSize * 1.05,
          includeFontPadding: false,
        }}
      >
        {display}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bar: { position: 'absolute' },
});

export default memo(Artifact);
