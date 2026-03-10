import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, ScrollView,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchSpaces, toggleJoinSpace } from '../../store/slices/spacesSlice';
import { COLORS, SHADOWS } from '../../constants';

const TYPES = [
  { key: '', label: 'All' },
  { key: 'location', label: 'Locations' },
  { key: 'interest', label: 'Interests' },
  { key: 'institution', label: 'Institutions' },
];

export default function SpacesScreen({ navigation }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { spaces, joinedSpaces, isLoading } = useSelector((s) => s.spaces);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    dispatch(fetchSpaces({ type: typeFilter || undefined }));
  }, [typeFilter]);

  const filtered = search.trim()
    ? spaces.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.nameAr && s.nameAr.includes(search))
      )
    : spaces;

  const renderSpaceCard = ({ item }) => {
    const isJoined = joinedSpaces.includes(item._id);
    const initial = item.name ? item.name[0].toUpperCase() : '?';
    const bgColor = item.color || COLORS.fill;

    return (
      <TouchableOpacity
        style={styles.spaceCard}
        onPress={() => navigation.navigate('SpaceDetail', { slug: item.slug, space: item })}
        activeOpacity={0.7}
      >
        {/* Icon circle */}
        <View style={[styles.spaceIcon, { backgroundColor: bgColor }]}>
          <Text style={styles.spaceIconText}>{initial}</Text>
        </View>

        {/* Info */}
        <View style={styles.spaceInfo}>
          <Text style={styles.spaceName}>{item.name}</Text>
          <Text style={styles.spaceMeta}>
            {item.type}{item.membersCount ? ` · ${item.membersCount.toLocaleString()} members` : ''}
          </Text>
          {item.description ? (
            <Text style={styles.spaceDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}
        </View>

        {/* Join button */}
        <TouchableOpacity
          style={[styles.joinBtn, isJoined && styles.joinedBtn]}
          onPress={() => dispatch(toggleJoinSpace(item._id))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.joinBtnText, isJoined && styles.joinedBtnText]}>
            {isJoined ? 'Joined' : 'Join'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Spaces</Text>
        <Text style={styles.headerSub}>Communities around Kuwait</Text>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search spaces..."
            placeholderTextColor={COLORS.textMuted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContent}
        style={styles.filtersWrap}
      >
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.filterChip, typeFilter === t.key && styles.activeFilterChip]}
            onPress={() => setTypeFilter(t.key)}
          >
            <Text style={[styles.filterChipText, typeFilter === t.key && styles.activeFilterChipText]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={renderSpaceCard}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 8 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="people-outline" size={32} color={COLORS.textMuted} />
              </View>
              <Text style={styles.emptyText}>No spaces found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.sheet },

  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSub: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  searchBar: {
    marginHorizontal: -4,
    marginTop: 12,
    backgroundColor: COLORS.fill,
    borderRadius: 12,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },

  filtersWrap: {
    backgroundColor: COLORS.white,
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.fill,
  },
  activeFilterChip: {
    backgroundColor: COLORS.accent,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.textSecondary,
  },
  activeFilterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.white,
  },

  loader: { marginTop: 60 },

  spaceCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.card,
  },

  spaceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spaceIconText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },

  spaceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  spaceName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  spaceMeta: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  spaceDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },

  joinBtn: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: COLORS.accent,
  },
  joinedBtn: {
    backgroundColor: COLORS.fill,
  },
  joinBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.white,
  },
  joinedBtnText: {
    color: COLORS.textSecondary,
  },

  emptyState: { padding: 60, alignItems: 'center' },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.fill,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyText: { fontSize: 16, color: COLORS.textMuted, fontWeight: '500' },
});
