import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { eventsAPI } from '../../services/api';
import { COLORS } from '../../constants';
import { useSelector } from 'react-redux';

export default function EventDetailScreen({ navigation, route }) {
  const { id } = route.params;
  const { isAuthenticated } = useSelector((s) => s.auth);
  const [event, setEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRsvped, setIsRsvped] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await eventsAPI.getById(id);
        setEvent(res.event);
        setIsRsvped(res.event.isRsvped || false);
        navigation.setOptions({ title: res.event.title });
      } catch (e) {
        Alert.alert('Error', 'Failed to load event');
        navigation.goBack();
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  const handleRsvp = async () => {
    if (!isAuthenticated) {
      Alert.alert('Sign in required', 'Please sign in to RSVP to events.');
      return;
    }
    setRsvpLoading(true);
    try {
      const res = await eventsAPI.toggleRsvp(id);
      setIsRsvped(res.rsvped);
      setEvent((e) => ({ ...e, rsvpCount: res.rsvpCount }));
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setRsvpLoading(false);
    }
  };

  if (isLoading) return <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />;
  if (!event) return null;

  const startDate = new Date(event.startDate);
  const endDate = event.endDate ? new Date(event.endDate) : null;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Cover */}
      <View style={styles.coverWrapper}>
        {event.coverImage
          ? <Image source={{ uri: event.coverImage }} style={styles.cover} />
          : <View style={[styles.cover, styles.coverPlaceholder]}>
              <Text style={styles.coverEmoji}>📅</Text>
            </View>
        }
        <View style={[styles.categoryBadge, styles[`category_${event.category}`] || styles.category_other]}>
          <Text style={styles.categoryBadgeText}>{event.category}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title}>{event.title}</Text>
        {event.titleAr && <Text style={styles.titleAr}>{event.titleAr}</Text>}

        {/* Date */}
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}><Ionicons name="calendar" size={18} color={COLORS.primary} /></View>
          <View>
            <Text style={styles.infoMain}>{format(startDate, 'EEEE, MMMM d, yyyy')}</Text>
            <Text style={styles.infoSub}>
              {format(startDate, 'h:mm a')}
              {endDate ? ` – ${format(endDate, 'h:mm a')}` : ''}
            </Text>
          </View>
        </View>

        {/* Location */}
        {(event.venueName || event.district) && (
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}><Ionicons name="location" size={18} color={COLORS.primary} /></View>
            <View>
              {event.venueName && <Text style={styles.infoMain}>{event.venueName}</Text>}
              {event.district && <Text style={styles.infoSub}>{event.district}</Text>}
            </View>
          </View>
        )}

        {/* Price */}
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}><Ionicons name="ticket" size={18} color={COLORS.primary} /></View>
          <Text style={styles.infoMain}>{event.isFree ? 'Free Entry' : `${event.price} ${event.currency}`}</Text>
        </View>

        {/* Attendees */}
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}><Ionicons name="people" size={18} color={COLORS.primary} /></View>
          <Text style={styles.infoMain}>
            {event.rsvpCount} {event.rsvpCount === 1 ? 'person' : 'people'} attending
            {event.maxAttendees ? ` · ${event.maxAttendees} max` : ''}
          </Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Description */}
        {event.description && (
          <View>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>
        )}
      </View>

      {/* RSVP button */}
      {event.status !== 'past' && event.status !== 'cancelled' && (
        <TouchableOpacity
          style={[styles.rsvpBtn, isRsvped && styles.rsvpedBtn]}
          onPress={handleRsvp}
          disabled={rsvpLoading}
        >
          {rsvpLoading
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name={isRsvped ? 'checkmark-circle' : 'calendar-outline'} size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.rsvpBtnText}>{isRsvped ? "I'm going ✓" : "I'm going"}</Text>
              </>
          }
        </TouchableOpacity>
      )}

      {event.status === 'cancelled' && (
        <View style={styles.cancelledBanner}>
          <Text style={styles.cancelledText}>This event has been cancelled</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loader: { flex: 1, justifyContent: 'center' },
  coverWrapper: { position: 'relative' },
  cover: { width: '100%', height: 220 },
  coverPlaceholder: { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  coverEmoji: { fontSize: 60 },
  categoryBadge: { position: 'absolute', top: 12, left: 12, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  category_other: { backgroundColor: COLORS.textMuted },
  categoryBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  content: { backgroundColor: COLORS.white, padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  titleAr: { fontSize: 16, color: COLORS.textLight, textAlign: 'right', marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  infoIcon: { width: 32, alignItems: 'center', marginRight: 10, marginTop: 2 },
  infoMain: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  infoSub: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  description: { fontSize: 15, color: COLORS.text, lineHeight: 22 },
  rsvpBtn: { margin: 20, backgroundColor: COLORS.primary, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  rsvpedBtn: { backgroundColor: COLORS.secondary },
  rsvpBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cancelledBanner: { margin: 20, backgroundColor: '#FFEBEE', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelledText: { color: COLORS.error, fontWeight: '600' },
});
