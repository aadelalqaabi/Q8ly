import React, { memo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const PALETTE = [
  '#0033A0', '#007A3D', '#FF6B35', '#9C27B0',
  '#00BCD4', '#E91E63', '#FF9800', '#3F51B5',
  '#009688', '#795548', '#607D8B', '#F44336',
];

function hashColor(str) {
  if (!str) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function monogram(title) {
  if (!title) return '?';
  const words = title.trim().split(/\s+/).filter(
    (w) => !['the', 'a', 'an', 'al', 'ال'].includes(w.toLowerCase())
  );
  if (words.length === 0) return title.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function Artifact({ id, title = '', mapSnapshot = null, size = 64, locked = false }) {
  const radius    = size / 2;
  const color     = hashColor(id || title);
  const dotSize   = Math.max(6, Math.round(size * 0.11));
  const stemH     = Math.round(size * 0.09);
  const labelSize = Math.max(8, Math.round(size * 0.115));
  const label     = title.length > 16 ? title.slice(0, 15).trimEnd() + '…' : title;

  return (
    <View style={[styles.disc, { width: size, height: size, borderRadius: radius }]}>

      {mapSnapshot ? (
        // ── Map image ──────────────────────────────────────────────────────
        <>
          <Image
            source={{ uri: mapSnapshot }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />

          {/* Pin */}
          {!locked && (
            <View style={styles.pinWrap} pointerEvents="none">
              <View style={styles.labelBubble}>
                <Text style={[styles.labelText, { fontSize: labelSize }]} numberOfLines={1}>
                  {label}
                </Text>
              </View>
              <View style={[styles.stem, { height: stemH }]} />
              <View style={[styles.dot, { width: dotSize, height: dotSize, borderRadius: dotSize / 2 }]} />
            </View>
          )}

          {/* Dim for unvisited */}
          {locked && <View style={[StyleSheet.absoluteFill, styles.dim]} />}
        </>
      ) : (
        // ── Fallback monogram ───────────────────────────────────────────────
        <View style={[
          StyleSheet.absoluteFill,
          styles.fallback,
          { backgroundColor: locked ? `${color}28` : `${color}E0` },
        ]}>
          <Text style={[
            styles.mono,
            { fontSize: Math.round(size * 0.30), color: locked ? color : '#fff', opacity: locked ? 0.6 : 1 },
          ]}>
            {monogram(title)}
          </Text>
        </View>
      )}

      {/* Border ring */}
      <View style={[
        StyleSheet.absoluteFill, styles.ring,
        { borderRadius: radius, borderColor: locked ? 'rgba(0,0,0,0.07)' : 'rgba(0,0,0,0.18)' },
      ]} />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { overflow: 'hidden', backgroundColor: '#E8E8ED' },

  pinWrap: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: '18%',
    alignItems: 'center',
  },
  labelBubble: {
    backgroundColor: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  labelText: { fontWeight: '700', color: '#000' },
  stem: { width: 2, backgroundColor: '#0033A0' },
  dot: { backgroundColor: '#0033A0' },

  dim: { backgroundColor: 'rgba(255,255,255,0.52)' },
  ring: { borderWidth: 1.5 },

  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mono: { fontWeight: '800', letterSpacing: -0.5 },
});

export default memo(Artifact);
