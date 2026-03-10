import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { usersAPI, postsAPI, hachiAPI } from '../../services/api';
import UserCard from '../../components/profile/UserCard';
import PostCard from '../../components/post/PostCard';
import { useTheme } from '../../context/ThemeContext';

const TABS = [
  { key: 'accounts', label: 'Accounts' },
  { key: 'posts',    label: 'Posts'    },
  { key: 'circles',  label: 'Circles'  },
];

export default function DiscoverScreen({ navigation }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const inputRef = useRef(null);

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('accounts');
  const [accountResults, setAccountResults] = useState([]);
  const [postResults, setPostResults] = useState([]);
  const [circleResults, setCircleResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) {
      setAccountResults([]);
      setPostResults([]);
      setCircleResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const [usersRes, postsRes, circlesRes] = await Promise.all([
        usersAPI.searchUsers(q.trim()),
        postsAPI.search(q.trim()),
        hachiAPI.search(q.trim()),
      ]);
      setAccountResults(usersRes.users || []);
      setPostResults(postsRes.posts || []);
      setCircleResults(circlesRes.rooms || []);
    } catch {
      setAccountResults([]);
      setPostResults([]);
      setCircleResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const isSearchMode = query.trim().length > 0;

  const displayData = useMemo(() => {
    if (!isSearchMode) return [];
    if (tab === 'accounts') return accountResults;
    if (tab === 'posts') return postResults;
    return circleResults;
  }, [isSearchMode, tab, accountResults, postResults, circleResults]);

  const countFor = (key) => {
    if (key === 'accounts') return accountResults.length;
    if (key === 'posts') return postResults.length;
    return circleResults.length;
  };

  const renderCircleCard = (room) => (
    <TouchableOpacity
      style={styles.circleCard}
      onPress={() => navigation.navigate('HachiRoom', { roomId: room._id })}
      activeOpacity={0.75}
    >
      <View style={styles.circleIconWrap}>
        <Ionicons name="radio-outline" size={20} color={COLORS.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.circleTitle} numberOfLines={1}>{room.title}</Text>
        <Text style={styles.circleMeta}>
          {room.memberCount || 0} listening · {room.category}
        </Text>
      </View>
      <View style={[styles.liveChip, !room.isActive && styles.liveChipOff]}>
        <Text style={[styles.liveChipText, !room.isActive && styles.liveChipTextOff]}>
          {room.isActive ? 'LIVE' : 'ENDED'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => {
    if (tab === 'circles') return renderCircleCard(item);
    if (tab === 'posts') return <PostCard post={item} navigation={navigation} />;
    return <UserCard user={item} navigation={navigation} />;
  };

  const renderEmpty = () => {
    if (isSearching) return null;
    if (isSearchMode) {
      const labels = { accounts: 'accounts', posts: 'posts', circles: 'circles' };
      return (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={36} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>No {labels[tab]} found</Text>
          <Text style={styles.emptySub}>Try a different search term</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Search</Text>
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search accounts, posts, or circles…"
            placeholderTextColor={COLORS.textPlaceholder}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs — only visible in search mode */}
      {isSearchMode && (
        <View style={styles.tabRow}>
          {TABS.map((tb) => {
            const active = tab === tb.key;
            const count = countFor(tb.key);
            return (
              <TouchableOpacity
                key={tb.key}
                style={styles.tabItem}
                onPress={() => setTab(tb.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {tb.label}{count > 0 ? ` (${count})` : ''}
                </Text>
                <View style={[styles.tabDot, active && styles.tabDotActive]} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {isSearching ? (
        <ActivityIndicator size="large" color={COLORS.accent} style={styles.loader} />
      ) : (
        <FlatList
          data={displayData}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.white },
  header: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', color: C.text },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.fill, borderRadius: 10, height: 38, paddingHorizontal: 10, gap: 6,
  },
  searchInput: { flex: 1, fontSize: 15, color: C.text },

  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
    backgroundColor: C.white,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 8, gap: 6 },
  tabLabel: { fontSize: 13, fontWeight: '500', color: C.textMuted },
  tabLabelActive: { color: C.text, fontWeight: '700' },
  tabDot: { width: 24, height: 2, borderRadius: 1, backgroundColor: 'transparent' },
  tabDotActive: { backgroundColor: C.accent },

  // Circle card
  circleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
  },
  circleIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.accent + '12',
    justifyContent: 'center', alignItems: 'center',
  },
  circleTitle: { fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 2 },
  circleMeta: { fontSize: 12, color: C.textMuted },
  liveChip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: '#FF3B3020',
  },
  liveChipText: { fontSize: 10, fontWeight: '800', color: '#FF3B30', letterSpacing: 0.5 },
  liveChipOff: { backgroundColor: C.fill },
  liveChipTextOff: { color: C.textMuted },

  loader: { marginTop: 60 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: C.text, marginBottom: 6 },
  emptySub: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
});
