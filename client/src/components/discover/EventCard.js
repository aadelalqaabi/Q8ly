import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { COLORS, SHADOWS } from '../../constants';

export default function EventCard({ event, onPress, style }) {
  const startDate = new Date(event.startDate);

  return (
    <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.8}>
      {/* Image section */}
      <View style={styles.imageWrapper}>
        {event.coverImage ? (
          <Image source={{ uri: event.coverImage }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="calendar" size={32} color={COLORS.textMuted} />
          </View>
        )}
        {event.isFree && (
          <View style={styles.freeBadge}>
            <Text style={styles.freeBadgeText}>Free</Text>
          </View>
        )}
      </View>

      {/* Info section */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={13} color={COLORS.textMuted} />
          <Text style={styles.metaText}>{format(startDate, 'MMM d, h:mm a')}</Text>
        </View>
        {event.district && (
          <View style={[styles.metaRow, { marginTop: 4 }]}>
            <Ionicons name="location-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.metaText}>{event.district}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 180,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
    ...SHADOWS.card,
  },
  imageWrapper: {
    height: 100,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.fill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  freeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: COLORS.success,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  freeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  info: {
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 19,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
