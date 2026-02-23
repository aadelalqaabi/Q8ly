import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants';

const NOW_ICONS = {
  breaking: { icon: 'flash', color: '#FF3B30' },
  traffic: { icon: 'car', color: '#FF9500' },
  weather: { icon: 'thunderstorm', color: '#5AC8FA' },
  parliament: { icon: 'business', color: '#007A3D' },
  default: { icon: 'radio', color: COLORS.primary },
};

export default function NowBar({ items, navigation }) {
  if (!items || items.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>NOW</Text>
        </View>
        <Text style={styles.headerTitle}>Kuwait Now</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {items.map((item, i) => {
          const iconConfig = NOW_ICONS[item.type] || NOW_ICONS.default;
          return (
            <TouchableOpacity
              key={i}
              style={styles.card}
              onPress={() => item.topicSlug && navigation.navigate('TopicDetail', { slug: item.topicSlug })}
            >
              <View style={[styles.cardIcon, { backgroundColor: iconConfig.color + '20' }]}>
                <Ionicons name={iconConfig.icon} size={16} color={iconConfig.color} />
              </View>
              <Text style={styles.cardText} numberOfLines={2}>{item.text}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.white, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, gap: 8 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  headerTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  scroll: { paddingHorizontal: 12, paddingBottom: 12, gap: 10 },
  card: { width: 180, backgroundColor: '#FAFAFA', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  cardText: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 17 },
});
