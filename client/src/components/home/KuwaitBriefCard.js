import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants';

const BRIEF_ICONS = {
  news: '📰',
  decision: '⚖️',
  incident: '🚨',
  trend: '🔥',
  offer: '🏷️',
  event: '📅',
};

export default function KuwaitBriefCard({ brief, navigation }) {
  const [expanded, setExpanded] = useState(false);

  if (!brief) return null;

  const visibleItems = expanded ? brief.items : brief.items?.slice(0, 3);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.flagEmoji}>🇰🇼</Text>
          <View>
            <Text style={styles.title}>Kuwait Brief</Text>
            <Text style={styles.subtitle}>{brief.period === 'morning' ? 'Morning' : 'Evening'} Edition</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.expandBtn}>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.items}>
        {visibleItems?.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={styles.item}
            onPress={() => item.linkedPost && navigation.navigate('PostDetail', { postId: item.linkedPost })}
          >
            <Text style={styles.itemEmoji}>
              {BRIEF_ICONS[item.category] || '•'}
            </Text>
            <Text style={styles.itemText}>{item.content}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!expanded && brief.items?.length > 3 && (
        <TouchableOpacity style={styles.showMore} onPress={() => setExpanded(true)}>
          <Text style={styles.showMoreText}>Show {brief.items.length - 3} more items</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.white, marginBottom: 8, borderRadius: 0, borderTopWidth: 3, borderTopColor: COLORS.primary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flagEmoji: { fontSize: 28 },
  title: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 12, color: COLORS.textMuted },
  expandBtn: { padding: 4 },
  items: { padding: 12, gap: 8 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemEmoji: { fontSize: 16, marginTop: 1 },
  itemText: { flex: 1, fontSize: 14, color: COLORS.text, lineHeight: 19 },
  showMore: { paddingHorizontal: 14, paddingBottom: 12 },
  showMoreText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
});
