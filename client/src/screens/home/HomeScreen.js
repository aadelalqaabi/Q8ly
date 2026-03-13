import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator, Animated,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchFeed } from '../../store/slices/postsSlice';
import PostCard from '../../components/post/PostCard';
import AdCard from '../../components/ui/AdCard';
import { SHADOWS } from '../../constants';
import { useTheme } from '../../context/ThemeContext';
import { adsAPI } from '../../services/api';

// ── Deterministic-random helper ────────────────────────────────────────────────
// Given a seed, returns a pseudo-random sequence so injection positions
// vary between refreshes but are stable for the same seed.
function seededRand(seed, i) {
  return ((seed * 1103515245 + i * 22695477 + 12345) >>> 0) % 1000 / 1000;
}

// Build the display list by weaving hotPosts into regular posts at
// randomized intervals — the "variable reward" slot-machine pattern.
function buildFeed(posts, hotPosts, seed) {
  if (!hotPosts?.length || !posts?.length) return posts.map((p) => ({ ...p, _type: 'post' }));

  const result = [];
  let hotIdx = 0;
  // First injection: somewhere between position 4 and 7 (randomized per refresh)
  let nextInject = 4 + Math.floor(seededRand(seed, 0) * 4);

  for (let i = 0; i < posts.length; i++) {
    result.push({ ...posts[i], _type: 'post' });

    if (i + 1 === nextInject && hotIdx < hotPosts.length) {
      result.push({ ...hotPosts[hotIdx], _type: 'hot' });
      hotIdx++;
      // Next injection: 5–9 posts later — variable gap is the key
      nextInject += 5 + Math.floor(seededRand(seed, hotIdx) * 5);
    }
  }
  return result;
}

// ── Hot label pill ─────────────────────────────────────────────────────────────
function HotLabel() {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <View style={styles.hotLabel}>
      <Text style={styles.hotLabelText}>🔥 حالياً في الكويت</Text>
    </View>
  );
}

// ── New posts banner ──────────────────────────────────────────────────────────
function NewPostsBanner({ count, onPress, label }) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const slideAnim = useRef(new Animated.Value(-48)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: count > 0 ? 0 : -48,
      damping: 18,
      stiffness: 240,
      useNativeDriver: true,
    }).start();
  }, [count]);

  return (
    <Animated.View style={[styles.newBanner, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity style={styles.newBannerInner} onPress={onPress} activeOpacity={0.85}>
        <Ionicons name="arrow-up-circle" size={16} color="#fff" />
        <Text style={styles.newBannerText}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── HomeScreen ────────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { forYouPosts, hotPosts, isLoading, isLoadingMore, forYouHasMore, forYouPage, error } =
    useSelector((s) => s.posts);
  const { unreadCount } = useSelector((s) => s.notifications);

  const BADGE_FILTERS = useMemo(() => [
    { key: null,          label: t('home.filterAll')        },
    { key: 'government',  label: t('home.filterGovernment') },
    { key: 'media',       label: t('home.filterMedia')      },
    { key: 'influencer',  label: t('home.filterInfluencer') },
    { key: 'business',    label: t('home.filterBusiness')   },
  ], [t]);

  // Seed changes on every refresh → injection positions shift → slot machine
  const [seed, setSeed] = useState(() => Date.now());
  const [newPostCount, setNewPostCount] = useState(0);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [feedAds, setFeedAds] = useState([]);
  const flatRef = useRef(null);

  const loadFeed = useCallback(
    (p = 1) => dispatch(fetchFeed({ tab: 'for_you', page: p })),
    [dispatch]
  );

  const handleRefresh = useCallback(() => {
    setSeed(Date.now());
    setNewPostCount(0);
    loadFeed(1);
  }, [loadFeed]);

  useEffect(() => {
    loadFeed(1);
    adsAPI.getFeedAds().then((res) => setFeedAds(res.ads || [])).catch(() => {});
  }, []);

  // Tap the active Home tab → scroll to top + refresh
  useEffect(() => {
    const unsub = navigation.addListener('tabPress', (e) => {
      if (navigation.isFocused()) {
        e.preventDefault();
        flatRef.current?.scrollToOffset({ offset: 0, animated: true });
        handleRefresh();
      }
    });
    return unsub;
  }, [navigation, handleRefresh]);

  const displayData = useMemo(() => {
    let basePosts;
    if (selectedBadge) {
      basePosts = [...forYouPosts]
        .filter((p) => p.userId?.verifiedBadge === selectedBadge)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((p) => ({ ...p, _type: 'post' }));
    } else {
      basePosts = buildFeed(forYouPosts, hotPosts, seed);
    }

    // Weave ads in every 8 posts, cycling through available ads
    if (!feedAds.length) return basePosts;
    const result = [];
    let adIdx = 0;
    for (let i = 0; i < basePosts.length; i++) {
      result.push(basePosts[i]);
      if ((i + 1) % 8 === 0 && adIdx < feedAds.length) {
        result.push({ ...feedAds[adIdx % feedAds.length], _type: 'ad' });
        adIdx++;
      }
    }
    return result;
  }, [forYouPosts, hotPosts, seed, selectedBadge, feedAds]);

  const scrollToTop = () => {
    flatRef.current?.scrollToOffset({ offset: 0, animated: true });
    handleRefresh();
  };

  const renderItem = ({ item }) => {
    if (item._type === 'ad') return <AdCard ad={item} />;
    return (
      <View>
        {item._type === 'hot' && <HotLabel />}
        <PostCard post={item} navigation={navigation} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    if (error) {
      return (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="cloud-offline-outline" size={28} color={COLORS.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>{t('home.loadError')}</Text>
          <Text style={styles.emptySub}>{t('home.loadErrorSub')}</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => loadFeed(1)}>
            <Text style={styles.emptyBtnText}>{t('home.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (selectedBadge) {
      const label = BADGE_FILTERS.find((f) => f.key === selectedBadge)?.label || '';
      return (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="filter-outline" size={28} color={COLORS.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>{t('home.noFilterPosts')}</Text>
          <Text style={styles.emptySub}>{t('home.noFilterPostsSub', { label })}</Text>
        </View>
      );
    }
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Ionicons name="people-outline" size={28} color={COLORS.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>{t('home.noPostsYet')}</Text>
        <Text style={styles.emptySub}>{t('home.followHint')}</Text>
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => navigation.navigate('Discover')}
        >
          <Text style={styles.emptyBtnText}>{t('home.discoverBtn')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.wordmark}>KUWAI</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Discover')}
          style={styles.headerBtn}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Ionicons name="search-outline" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Badge filter tabs */}
      <View style={styles.filterTabsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.filterTabsContent}
        >
          {BADGE_FILTERS.map((f) => {
            const active = selectedBadge === f.key;
            return (
              <TouchableOpacity
                key={String(f.key)}
                style={styles.filterTab}
                onPress={() => setSelectedBadge(f.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterTabLabel, active && styles.filterTabLabelActive]}>
                  {f.label}
                </Text>
                <View style={[styles.filterTabDot, active && styles.filterTabDotActive]} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* New posts banner — slides down from header */}
      <NewPostsBanner count={newPostCount} onPress={scrollToTop} label={t('home.newPosts', { count: newPostCount })} />

      {isLoading && forYouPosts.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          ref={flatRef}
          data={displayData}
          keyExtractor={(item, i) => `${item._id}_${item._type}_${i}`}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator size="small" color={COLORS.accent} style={styles.footerSpinner} />
            ) : (
              <View style={{ height: 80 }} />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={isLoading && forYouPosts.length > 0}
              onRefresh={handleRefresh}
              tintColor={COLORS.accent}
            />
          }
          onEndReached={() => {
            if (!isLoadingMore && forYouHasMore) loadFeed(forYouPage + 1);
          }}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Compose FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 24 + insets.bottom }]}
        onPress={() => navigation.navigate('CreatePost')}
        activeOpacity={0.9}
      >
        <Text style={styles.fabPlus}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.white },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
    backgroundColor: C.white,
    zIndex: 10,
  },
  wordmark: { flex: 1, fontSize: 22, letterSpacing: -0.8, fontWeight: '800', color: C.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  badge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: C.accent, borderWidth: 1.5, borderColor: C.white,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800', lineHeight: 11 },

  // New posts banner
  newBanner: {
    position: 'absolute',
    top: 0, // sits just below the header; the header handles insets
    left: 0, right: 0,
    zIndex: 20,
    alignItems: 'center',
    paddingTop: 8,
    pointerEvents: 'box-none',
  },
  newBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.text,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
    ...SHADOWS.heavy,
  },
  newBannerText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  footerSpinner: { padding: 20 },

  // Hot Now bar
  hotNow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
    paddingTop: 14,
    paddingBottom: 6,
  },
  hotNowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 6,
  },
  liveDotLg: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: '#FF3B30',
  },
  hotNowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textMuted,
    letterSpacing: 0.2,
  },
  hotNowRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  hotNowCard: {
    width: 152,
    height: 82,
    backgroundColor: C.fill,
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  hotNowAccent: {
    width: 3,
    alignSelf: 'stretch',
  },
  hotNowCardInner: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: 'space-between',
  },
  hotNowCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hotNowEmoji: { fontSize: 17 },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveDotSm: { width: 5, height: 5, borderRadius: 2.5 },
  liveChipText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  hotNowCardTitle: { fontSize: 12, fontWeight: '600', color: C.text, lineHeight: 17, flex: 1, marginVertical: 3 },
  hotNowMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  hotNowCount: { fontSize: 10, fontWeight: '500', color: C.textMuted },

  // Hot label
  hotLabel: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  hotLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMuted,
    letterSpacing: 0.2,
  },

  // Badge filter tabs
  filterTabsWrap: {
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  filterTabsContent: {
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 8,
  },
  filterTab: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
  },
  filterTabLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: C.textMuted,
  },
  filterTabLabelActive: {
    color: C.text,
    fontWeight: '700',
  },
  filterTabDot: {
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  filterTabDotActive: {
    backgroundColor: C.accent,
  },

  // Empty state
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.fill, justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: C.text, marginBottom: 6 },
  emptySub: { fontSize: 15, color: C.textMuted, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  emptyBtn: { backgroundColor: C.accent, borderRadius: 22, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  fab: {
    position: 'absolute', right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center',
    ...SHADOWS.heavy,
  },
  fabPlus: {
    color: '#fff', fontSize: 30, fontWeight: '400',
    lineHeight: 34, marginTop: -1,
  },
});
