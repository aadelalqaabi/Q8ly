import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, RefreshControl, Keyboard, TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { usersAPI, postsAPI, hachiAPI, topicsAPI } from '../../services/api';
import UserCard from '../../components/profile/UserCard';
import PostCard from '../../components/post/PostCard';
import { useTheme } from '../../context/ThemeContext';

const CATEGORY_ICONS = {
  politics: 'megaphone-outline',
  society: 'people-outline',
  traffic: 'car-outline',
  jobs: 'briefcase-outline',
  realestate: 'home-outline',
  sports: 'football-outline',
  events: 'calendar-outline',
  offers: 'pricetag-outline',
  technology: 'hardware-chip-outline',
  health: 'medkit-outline',
  entertainment: 'film-outline',
  other: 'ellipsis-horizontal-outline',
};

const SEARCH_TABS = [
  { key: 'posts',    label: 'Posts'    },
  { key: 'accounts', label: 'Accounts' },
  { key: 'circles',  label: 'Circles'  },
];

// ── Trending topic row ────────────────────────────────────────────────────────
function TrendingRow({ topic, rank, onPress }) {
  const { t } = useTranslation();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const accent = topic.color || COLORS.accent;
  const displayName = topic.nameAr || topic.name;
  const iconName = CATEGORY_ICONS[topic.category] || 'ellipsis-horizontal-outline';

  return (
    <TouchableOpacity
      style={styles.trendRow}
      onPress={() => onPress(topic)}
      activeOpacity={0.72}
    >
      {/* Left color bar */}
      <View style={[styles.trendAccent, { backgroundColor: accent }]} />

      {/* Rank */}
      <Text style={[styles.trendRank, { color: accent }]}>{rank}</Text>

      {/* Body */}
      <View style={styles.trendBody}>
        <View style={styles.trendCatRow}>
          <Ionicons name={iconName} size={11} color={COLORS.textMuted} />
          <Text style={styles.trendCat}>{topic.category}</Text>
          {topic.isOfficial && (
            <View style={[styles.officialBadge, { backgroundColor: accent + '20' }]}>
              <Text style={[styles.officialText, { color: accent }]}>رسمي</Text>
            </View>
          )}
        </View>
        <Text style={styles.trendName} numberOfLines={1}>{displayName}</Text>
        {(topic.recentPosts || topic.postsCount) > 0 && (
          <Text style={styles.trendCount}>
            {(topic.recentPosts || topic.postsCount).toLocaleString()} {t('discover.posts')}{topic.recentPosts ? ` ${t('discover.today')}` : ''}
          </Text>
        )}
      </View>

      {/* Right icon */}
      <View style={[styles.trendIconWrap, { backgroundColor: accent + '12' }]}>
        <Ionicons name="trending-up" size={16} color={accent} />
      </View>
    </TouchableOpacity>
  );
}

export default function DiscoverScreen({ navigation }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const inputRef = useRef(null);

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('posts');
  const [accountResults, setAccountResults] = useState([]);
  const [postResults, setPostResults] = useState([]);
  const [circleResults, setCircleResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Trending state
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  const loadTrending = useCallback(async () => {
    setTrendingLoading(true);
    try {
      const topicsRes = await topicsAPI.getTrending({ limit: 15 });
      setTrendingTopics(topicsRes.topics || []);
    } catch { /* silent */ }
    finally { setTrendingLoading(false); }
  }, []);

  useEffect(() => { loadTrending(); }, []);

  // Long-press on the Discover tab icon → open keyboard and focus search
  useEffect(() => {
    const unsub = navigation.addListener('tabLongPress', () => {
      inputRef.current?.focus();
    });
    return unsub;
  }, [navigation]);

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
    if (tab === 'posts') return postResults;
    if (tab === 'accounts') return accountResults;
    return circleResults;
  }, [isSearchMode, tab, postResults, accountResults, circleResults]);

  const countFor = (key) => {
    if (key === 'posts') return postResults.length;
    if (key === 'accounts') return accountResults.length;
    return circleResults.length;
  };

  const handleTopicPress = (topic) => {
    setQuery(topic.nameAr || topic.name);
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

  const renderTrending = () => {
    if (trendingLoading) {
      return <ActivityIndicator size="small" color={COLORS.accent} style={{ marginTop: 40 }} />;
    }
    if (!trendingTopics.length) {
      return (
        <View style={styles.emptyTrend}>
          <Ionicons name="trending-up-outline" size={40} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTrendTitle}>{t('discover.noTrendingTitle')}</Text>
          <Text style={styles.emptyTrendSub}>{t('discover.noTrendingSub')}</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={trendingTopics}
        keyExtractor={(item) => item._id}
        renderItem={({ item, index }) => (
          <TrendingRow
            topic={item}
            rank={index + 1}
            onPress={handleTopicPress}
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl refreshing={trendingLoading} onRefresh={loadTrending} tintColor={COLORS.accent} />
        }
        ListHeaderComponent={
          <View style={styles.trendHeader}>
            <Text style={styles.trendHeaderTitle}>{t('discover.trendingTitle')}</Text>
            <Text style={styles.trendHeaderSub}>{t('discover.trendingSub')}</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.trendSep} />}
      />
    );
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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <TouchableOpacity
            onPress={() => { inputRef.current?.focus(); if (query.trim()) doSearch(query); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="search" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search accounts, posts, or circles…"
            placeholderTextColor={COLORS.textPlaceholder}
            returnKeyType="search"
            onSubmitEditing={() => { if (query.trim()) doSearch(query); }}
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
          {SEARCH_TABS.map((tb) => {
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

      {/* Content */}
      {!isSearchMode ? (
        renderTrending()
      ) : isSearching ? (
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
    </TouchableWithoutFeedback>
  );
}

const makeStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.white },
  header: {
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
  },
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

  // ── Trending header ─────────────────────────────────────────────────────────
  trendHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  trendHeaderTitle: {
    fontSize: 22, fontWeight: '800', color: C.text,
    letterSpacing: -0.3,
  },
  trendHeaderSub: {
    fontSize: 13, color: C.textMuted, marginTop: 2,
  },

  // ── Trending row ────────────────────────────────────────────────────────────
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingRight: 16,
    backgroundColor: C.white,
  },
  trendAccent: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 12,
  },
  trendRank: {
    fontSize: 28,
    fontWeight: '900',
    width: 38,
    textAlign: 'center',
    letterSpacing: -1,
    opacity: 0.85,
  },
  trendBody: {
    flex: 1,
    marginLeft: 8,
    gap: 3,
  },
  trendCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendCat: {
    fontSize: 11,
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '500',
  },
  officialBadge: {
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 4,
  },
  officialText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  trendName: {
    fontSize: 17,
    fontWeight: '700',
    color: C.text,
    letterSpacing: -0.2,
  },
  trendCount: {
    fontSize: 12,
    color: C.textMuted,
    fontWeight: '500',
  },
  trendIconWrap: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 10,
  },
  trendSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.separator,
    marginLeft: 71, // aligns with trendBody: 3 (bar) + 12 + 38 (rank) + 8 = 61 + 16 padding
  },

  // ── Empty trending ──────────────────────────────────────────────────────────
  emptyTrend: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTrendTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6 },
  emptyTrendSub: { fontSize: 14, color: C.textMuted },

  // ── Circle card ─────────────────────────────────────────────────────────────
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
