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

function Artifact({ id, title = '', stampUrl = null, size = 64, locked = false }) {
  const color = hashColor(id || title);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {stampUrl ? (
        <>
          <Image
            source={{ uri: stampUrl }}
            style={[styles.stamp, locked && styles.stampLocked]}
            resizeMode="contain"
          />
          {locked && <View style={styles.dim} />}
        </>
      ) : (
        // Fallback monogram if no stamp yet
        <View style={[styles.fallback, { backgroundColor: locked ? `${color}28` : `${color}E0` }]}>
          <Text style={[styles.mono, { fontSize: Math.round(size * 0.30), color: locked ? color : '#fff', opacity: locked ? 0.5 : 1 }]}>
            {monogram(title)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },

  stamp: {
    width: '100%',
    height: '100%',
  },
  stampLocked: {
    opacity: 0.18,
    tintColor: '#888',
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
  },

  fallback: {
    width: '100%', height: '100%',
    borderRadius: 99,
    justifyContent: 'center', alignItems: 'center',
  },
  mono: { fontWeight: '800', letterSpacing: -0.5 },
});

export default memo(Artifact);
