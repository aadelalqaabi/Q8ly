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
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
        <Text style={styles.headerTitle}>Breaking</Text>
      </View>

      {/* Horizontally scrolling cards */}
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
              style={[styles.card, i === items.length - 1 && styles.cardLast]}
              onPress={() => item.topicSlug && navigation.navigate('TopicDetail', { slug: item.topicSlug })}
              activeOpacity={0.7}
            >
              <View style={[styles.cardIcon, { backgroundColor: iconConfig.color }]}>
                <Ionicons name={iconConfig.icon} size={16} color={COLORS.white} />
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
  container: {
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.separator,
    paddingVertical: 14,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.white },
  liveText: { fontSize: 11, fontWeight: '700', color: COLORS.white },
  headerTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginLeft: 8 },

  // Scroll cards
  scroll: { paddingLeft: 14 },
  card: {
    width: 160,
    marginLeft: 0,
    marginRight: 14,
  },
  cardLast: {
    marginRight: 14,
  },

  // Card icon
  cardIcon: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  cardText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
    lineHeight: 18,
    marginTop: 8,
  },
});
