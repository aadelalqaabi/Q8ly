import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants';

const BRIEF_ICONS = {
  news: 'newspaper-outline',
  decision: 'scale-outline',
  incident: 'warning-outline',
  trend: 'trending-up-outline',
  offer: 'pricetag-outline',
  event: 'calendar-outline',
};

const BRIEF_COLORS = {
  news: '#0033A0',
  decision: '#9C27B0',
  incident: '#FF3B30',
  trend: COLORS.primary,
  offer: COLORS.secondary,
  event: '#FF9500',
};

export default function KuwaitBriefCard({ brief, navigation }) {
  const [expanded, setExpanded] = useState(false);
  if (!brief) return null;

  const visibleItems = expanded ? brief.items : brief.items?.slice(0, 3);

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.flagEmoji}>🇰🇼</Text>
        <Text style={styles.title}>Kuwait Brief</Text>
        <Text style={styles.periodText}>
          {brief.period === 'morning' ? 'Morning' : 'Evening'} Edition
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={COLORS.textMuted}
        />
      </TouchableOpacity>

      {/* Item rows */}
      {visibleItems?.map((item, i) => {
        const iconName = BRIEF_ICONS[item.category] || 'ellipse';
        const iconColor = BRIEF_COLORS[item.category] || COLORS.textMuted;
        return (
          <TouchableOpacity
            key={i}
            style={[styles.item, i > 0 && styles.itemDivider]}
            onPress={() =>
              item.linkedPost && navigation.navigate('PostDetail', { postId: item.linkedPost })
            }
            activeOpacity={item.linkedPost ? 0.7 : 1}
          >
            <View style={[styles.itemIcon, { backgroundColor: iconColor }]}>
              <Ionicons name={iconName} size={14} color={COLORS.white} />
            </View>
            <Text style={styles.itemText}>{item.content}</Text>
            {item.linkedPost && (
              <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
            )}
          </TouchableOpacity>
        );
      })}

      {/* Show more */}
      {!expanded && brief.items?.length > 3 && (
        <TouchableOpacity style={styles.showMore} onPress={() => setExpanded(true)}>
          <Text style={styles.showMoreText}>Show {brief.items.length - 3} more</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.separator,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  flagEmoji: { fontSize: 18 },
  title: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginLeft: 8, flex: 1 },
  periodText: { fontSize: 12, color: COLORS.textMuted },

  // Item rows
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.separator,
  },
  itemIcon: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  itemText: { fontSize: 14, fontWeight: '400', color: COLORS.text, marginLeft: 12, flex: 1, lineHeight: 20 },

  // Show more
  showMore: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.separator,
    alignItems: 'center',
  },
  showMoreText: { fontSize: 14, fontWeight: '600', color: COLORS.accent },
});
