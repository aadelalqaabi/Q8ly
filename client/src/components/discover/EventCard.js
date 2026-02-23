import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { COLORS } from '../../constants';

export default function EventCard({ event, onPress, style }) {
  const startDate = new Date(event.startDate);

  return (
    <TouchableOpacity style={[styles.card, style]} onPress={onPress}>
      <View style={styles.imageWrapper}>
        {event.coverImage
          ? <Image source={{ uri: event.coverImage }} style={styles.image} />
          : <View style={[styles.image, styles.imagePlaceholder]}>
              <Text style={styles.imagePlaceholderEmoji}>📅</Text>
            </View>
        }
        {event.isFree && (
          <View style={styles.freeBadge}><Text style={styles.freeBadgeText}>Free</Text></View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
        <View style={styles.row}>
          <Ionicons name="calendar-outline" size={12} color={COLORS.textMuted} />
          <Text style={styles.meta}>{format(startDate, 'MMM d, h:mm a')}</Text>
        </View>
        {event.district && (
          <View style={styles.row}>
            <Ionicons name="location-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.meta}>{event.district}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Ionicons name="people-outline" size={12} color={COLORS.textMuted} />
          <Text style={styles.meta}>{event.rsvpCount} going</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { width: 200, backgroundColor: COLORS.white, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  imageWrapper: { position: 'relative' },
  image: { width: '100%', height: 110 },
  imagePlaceholder: { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  imagePlaceholderEmoji: { fontSize: 36 },
  freeBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: COLORS.secondary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  freeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  info: { padding: 10 },
  title: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  meta: { fontSize: 12, color: COLORS.textMuted },
});
