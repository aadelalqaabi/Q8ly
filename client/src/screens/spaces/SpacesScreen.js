import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, ScrollView,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchSpaces, toggleJoinSpace } from '../../store/slices/spacesSlice';
import { COLORS, DISTRICTS } from '../../constants';

const TYPES = [
  { key: '', label: 'All' },
  { key: 'location', label: '📍 Locations' },
  { key: 'interest', label: '🎯 Interests' },
  { key: 'institution', label: '🏫 Institutions' },
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
    ? spaces.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || (s.nameAr && s.nameAr.includes(search)))
    : spaces;

  const renderSpaceCard = ({ item }) => {
    const isJoined = joinedSpaces.includes(item._id);
    return (
      <TouchableOpacity
        style={styles.spaceCard}
        onPress={() => navigation.navigate('SpaceDetail', { slug: item.slug, space: item })}
      >
        <View style={[styles.spaceColorBar, { backgroundColor: item.color || COLORS.secondary }]} />
        <View style={styles.spaceContent}>
          <View style={styles.spaceRow}>
            <View style={styles.spaceHeader}>
              <Text style={styles.spaceName}>{item.name}</Text>
              {item.nameAr && <Text style={styles.spaceNameAr}>{item.nameAr}</Text>}
              <View style={styles.spaceMeta}>
                <Ionicons
                  name={item.type === 'location' ? 'location' : item.type === 'interest' ? 'heart' : 'school'}
                  size={12} color={COLORS.textMuted} style={{ marginRight: 4 }}
                />
                <Text style={styles.spaceMetaText}>
                  {item.type} · {item.membersCount?.toLocaleString()} members
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.joinBtn, isJoined && styles.joinedBtn]}
              onPress={() => dispatch(toggleJoinSpace(item._id))}
            >
              <Text style={[styles.joinBtnText, isJoined && styles.joinedBtnText]}>
                {isJoined ? 'Joined' : 'Join'}
              </Text>
            </TouchableOpacity>
          </View>
          {item.description ? (
            <Text style={styles.spaceDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Spaces</Text>
        <Text style={styles.headerSubtitle}>Communities around Kuwait</Text>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search spaces..."
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Type filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeFilters} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.typeChip, typeFilter === t.key && styles.activeTypeChip]}
            onPress={() => setTypeFilter(t.key)}
          >
            <Text style={[styles.typeChipText, typeFilter === t.key && styles.activeTypeChipText]}>{t.label}</Text>
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
          contentContainerStyle={{ paddingBottom: insets.bottom + 16, paddingTop: 8 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No spaces found</Text>
            </View>
          }
        />
      )}

      {/* Create space FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 80 }]}
        onPress={() => navigation.navigate('CreateSpace')}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.white, padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  headerSubtitle: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', margin: 12,
    backgroundColor: COLORS.white, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: COLORS.text },
  typeFilters: { marginBottom: 8 },
  typeChip: { backgroundColor: COLORS.white, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: COLORS.border },
  activeTypeChip: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText: { fontSize: 13, fontWeight: '500', color: COLORS.text },
  activeTypeChipText: { color: '#fff' },
  loader: { marginTop: 40 },
  spaceCard: { flexDirection: 'row', backgroundColor: COLORS.white, marginHorizontal: 12, marginBottom: 8, borderRadius: 12, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  spaceColorBar: { width: 5 },
  spaceContent: { flex: 1, padding: 14 },
  spaceRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  spaceHeader: { flex: 1, marginRight: 12 },
  spaceName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  spaceNameAr: { fontSize: 14, color: COLORS.textLight, marginTop: 2, textAlign: 'right' },
  spaceMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  spaceMetaText: { fontSize: 12, color: COLORS.textMuted },
  joinBtn: { borderWidth: 1.5, borderColor: COLORS.secondary, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6 },
  joinedBtn: { backgroundColor: COLORS.secondary },
  joinBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.secondary },
  joinedBtnText: { color: '#fff' },
  spaceDesc: { fontSize: 13, color: COLORS.textLight, marginTop: 8, lineHeight: 18 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: COLORS.textMuted },
  fab: { position: 'absolute', right: 20, backgroundColor: COLORS.secondary, borderRadius: 28, width: 56, height: 56, justifyContent: 'center', alignItems: 'center', elevation: 5 },
});
