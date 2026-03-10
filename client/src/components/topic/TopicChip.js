import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants';

export default function TopicChip({ topic, onPress, isFollowing }) {
  const color = topic.color || COLORS.primary;

  const chipStyle = isFollowing
    ? { backgroundColor: color }
    : { backgroundColor: color + '15' };

  const textStyle = isFollowing
    ? { color: COLORS.white }
    : { color: color };

  return (
    <TouchableOpacity
      style={[styles.chip, chipStyle]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, textStyle]}>
        #{topic.slug || topic.name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
