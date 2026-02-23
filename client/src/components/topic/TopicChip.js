import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants';

export default function TopicChip({ topic, onPress, isFollowing }) {
  return (
    <TouchableOpacity
      style={[styles.chip, { borderColor: topic.color || COLORS.primary }, isFollowing && { backgroundColor: topic.color || COLORS.primary }]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, { color: isFollowing ? '#fff' : (topic.color || COLORS.primary) }]}>
        #{topic.slug || topic.name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 },
  chipText: { fontSize: 13, fontWeight: '600' },
});
