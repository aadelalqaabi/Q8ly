import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, ActivityIndicator,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usersAPI, eventsAPI } from '../../services/api';
import UserCard from '../../components/profile/UserCard';
import EventCard from '../../components/discover/EventCard';
import { COLORS } from '../../constants';

export default function DiscoverScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [usersRes, eventsRes] = await Promise.all([
          usersAPI.getSuggestions(),
          eventsAPI.getAll({ limit: 6 }),
        ]);
        setSuggestedUsers(usersRes.users || []);
        setUpcomingEvents(eventsRes.events || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Search')} style={styles.searchBtn}>
          <Ionicons name="search" size={20} color={COLORS.primary} />
          <Text style={styles.searchBtnText}>Search people, topics...</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        >
          {/* Suggested Users */}
          {suggestedUsers.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>👥 People to Follow</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Search')}>
                  <Text style={styles.seeAll}>See all</Text>
                </TouchableOpacity>
              </View>
              {suggestedUsers.map((user) => (
                <UserCard key={user._id} user={user} navigation={navigation} />
              ))}
            </View>
          )}

          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>📅 Upcoming Events</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Events')}>
                  <Text style={styles.seeAll}>See all</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {upcomingEvents.map((event) => (
                  <EventCard
                    key={event._id}
                    event={event}
                    onPress={() => navigation.navigate('EventDetail', { id: event._id })}
                    style={styles.eventCard}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Governorates quick links */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📍 Explore by Governorate</Text>
            <View style={styles.districtGrid}>
              {[
                { name: 'Al Asimah', nameAr: 'العاصمة', slug: 'asimah', color: '#C8102E' },
                { name: 'Hawalli', nameAr: 'حولي', slug: 'hawalli', color: '#007A3D' },
                { name: 'Farwaniyah', nameAr: 'الفروانية', slug: 'farwaniyah', color: '#FF6B35' },
                { name: 'Ahmadi', nameAr: 'الأحمدي', slug: 'ahmadi', color: '#2196F3' },
                { name: 'Jahra', nameAr: 'الجهراء', slug: 'jahra', color: '#9C27B0' },
                { name: 'Mubarak Al-Kabeer', nameAr: 'مبارك الكبير', slug: 'mubarak-kabeer', color: '#00BCD4' },
              ].map((g) => (
                <TouchableOpacity
                  key={g.slug}
                  style={[styles.districtCard, { borderLeftColor: g.color }]}
                  onPress={() => navigation.navigate('SpaceDetail', { slug: g.slug })}
                >
                  <Text style={styles.districtAr}>{g.nameAr}</Text>
                  <Text style={styles.districtEn}>{g.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.white, padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  searchBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FAFAFA',
  },
  searchBtnText: { marginLeft: 8, fontSize: 15, color: COLORS.textMuted },
  loader: { marginTop: 40 },
  section: { backgroundColor: COLORS.white, marginBottom: 8, padding: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  seeAll: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  eventCard: { marginRight: 12 },
  districtGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  districtCard: {
    width: '47%', backgroundColor: COLORS.background,
    borderRadius: 10, padding: 14,
    borderLeftWidth: 4, borderWidth: 1, borderColor: COLORS.border,
  },
  districtAr: { fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'right' },
  districtEn: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
});
