import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator, Animated, Image, PanResponder, Dimensions,
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
import { useGuestGate } from '../../context/GuestGateContext';
import { adsAPI, hachiAPI } from '../../services/api';

// ── Avatar helpers ─────────────────────────────────────────────────────────────
const PALETTE = ['#0033A0', '#007A3D', '#FF6B35', '#2196F3', '#9C27B0', '#00BCD4', '#FF9800'];
function avatarBg(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}
function cdnUrl(url, px) {
  if (!url) return null;
  return url.replace('/upload/', `/upload/w_${px},h_${px},c_fit,f_webp,q_auto:good/`);
}

// ── Vault stamp strip ──────────────────────────────────────────────────────────
function VaultStrip({ stamps, onPress }) {
  const { colors: C } = useTheme();
  if (!stamps.length) return null;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 10 }}
        style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator }}
      >
        {stamps.map(v => (
          <View key={v._id} style={{
            width: 46, height: 46, borderRadius: 23,
            borderWidth: 1.5, borderColor: C.separator,
            overflow: 'hidden', backgroundColor: C.fill,
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Image
              source={{ uri: cdnUrl(v.stampUrl, 46) }}
              style={{ width: 40, height: 40 }}
              resizeMode="contain"
            />
          </View>
        ))}
      </ScrollView>
    </TouchableOpacity>
  );
}

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
  const { t } = useTranslation();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <View style={styles.hotLabel}>
      <Text style={styles.hotLabelText}>{t('home.trending')}</Text>
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
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS, isRTL), [COLORS, isRTL]);
  const { guestGate } = useGuestGate();
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

  const user = useSelector(s => s.auth.user);

  // Seed changes on every refresh → injection positions shift → slot machine
  const [seed, setSeed] = useState(() => Date.now());
  const [newPostCount, setNewPostCount] = useState(0);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [feedAds, setFeedAds] = useState([]);
  const [collectedStamps, setCollectedStamps] = useState([]);
  const flatRef = useRef(null);
  const filterScrollRef = useRef(null);
  const SW = Dimensions.get('window').width;

  // Slide animation for feed content
  const slideX = useRef(new Animated.Value(0)).current;
  const slideOpacity = useRef(new Animated.Value(1)).current;
  const prevBadgeIdxRef = useRef(0);

  const animateToCategory = useCallback((newKey) => {
    const prevIdx = prevBadgeIdxRef.current;
    const nextIdx = BADGE_FILTERS.findIndex((f) => f.key === newKey);
    if (nextIdx === prevIdx) return;
    prevBadgeIdxRef.current = nextIdx;
    const dir = nextIdx > prevIdx ? -1 : 1; // next→slide left, prev→slide right

    // Scroll filter chips to show active tab
    filterScrollRef.current?.scrollTo({ x: Math.max(0, nextIdx * 90 - 40), animated: true });

    // Slide + fade out
    Animated.parallel([
      Animated.timing(slideOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(slideX, { toValue: dir * SW * 0.25, duration: 100, useNativeDriver: true }),
    ]).start(() => {
      setSelectedBadge(newKey);
      flatRef.current?.scrollToOffset({ offset: 0, animated: false });
      slideX.setValue(-dir * SW * 0.25);
      // Slide + fade in
      Animated.parallel([
        Animated.timing(slideOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(slideX, { toValue: 0, damping: 18, stiffness: 220, useNativeDriver: true }),
      ]).start();
    });
  }, [BADGE_FILTERS, slideX, slideOpacity, SW]);

  // PanResponder for swipe gesture
  const swipeHandlerRef = useRef(null);
  swipeHandlerRef.current = (dx) => {
    const currentIdx = BADGE_FILTERS.findIndex((f) => f.key === selectedBadge);
    if (dx < 0) {
      const next = BADGE_FILTERS[Math.min(currentIdx + 1, BADGE_FILTERS.length - 1)];
      if (next.key !== selectedBadge) animateToCategory(next.key);
    } else {
      const prev = BADGE_FILTERS[Math.max(currentIdx - 1, 0)];
      if (prev.key !== selectedBadge) animateToCategory(prev.key);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < 50) return;
        swipeHandlerRef.current(g.dx);
      },
    })
  ).current;

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
    hachiAPI.getVault()
      .then(data => setCollectedStamps((data || []).filter(v => v.visited && v.stampUrl)))
      .catch(() => {});
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

  const keyExtractor = useCallback((item, i) => `${item._id}_${item._type}_${i}`, []);

  const renderItem = useCallback(({ item }) => {
    if (item._type === 'ad') return <AdCard ad={item} />;
    return (
      <View>
        {item._type === 'hot' && <HotLabel />}
        <PostCard post={item} navigation={navigation} />
      </View>
    );
  }, [navigation]);

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
        {/* Profile avatar — left (or right in RTL) */}
        <TouchableOpacity
          style={styles.avatarBtn}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.75}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          {user?.profilePic ? (
            <Image source={{ uri: cdnUrl(user.profilePic, 68) }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarImg, { backgroundColor: avatarBg(user?.name) }]}>
              <Text style={styles.avatarInitial}>{user?.name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Wordmark — center */}
        <Text style={styles.wordmark}>KUWAI</Text>

        {/* Notifications bell — right (or left in RTL) */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={styles.headerBtn}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Ionicons name={unreadCount > 0 ? 'notifications' : 'notifications-outline'} size={27} color={COLORS.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Collected stamps strip */}
      <VaultStrip
        stamps={collectedStamps}
        onPress={() => navigation.navigate('Profile')}
      />

      {/* Badge filter tabs */}
      <View style={styles.filterTabsWrap}>
        <ScrollView
          ref={filterScrollRef}
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
                onPress={() => animateToCategory(f.key)}
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

      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <Animated.View style={{ flex: 1, opacity: slideOpacity, transform: [{ translateX: slideX }] }}>
      {isLoading && forYouPosts.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          ref={flatRef}
          data={displayData}
          keyExtractor={keyExtractor}
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
            if (!isLoadingMore && forYouHasMore && forYouPosts.length > 0) loadFeed(forYouPage + 1);
          }}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
        />
      )}
      </Animated.View>
      </View>

      {/* Compose FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 20 }]}
        onPress={() => guestGate(() => navigation.navigate('CreatePost'))}
        activeOpacity={0.9}
      >
        <Text style={styles.fabPlus}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (C, isRTL) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
    backgroundColor: C.background,
    zIndex: 10,
  },
  avatarBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  avatarImg: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { fontSize: 14, fontWeight: '700', color: '#fff' },
  wordmark: {
    flex: 1, fontSize: 26, fontWeight: '800',
    color: C.text, textAlign: 'center',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  badge: {
    position: 'absolute', top: 0, end: 0,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: C.accent, borderWidth: 1.5, borderColor: C.background,
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
  liveChipText: { fontSize: 9, fontWeight: '700' },
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
  },

  // Badge filter tabs
  filterTabsWrap: {
    backgroundColor: C.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  filterTabsContent: {
    paddingHorizontal: 8,
    paddingTop: 11,
    paddingBottom: 9,
  },
  filterTab: {
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 7,
  },
  filterTabLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: C.textMuted,
  },
  filterTabLabelActive: {
    color: C.text,
    fontWeight: '700',
  },
  filterTabDot: {
    width: 22,
    height: 2.5,
    borderRadius: 1.5,
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
    position: 'absolute', end: 20,
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center',
    ...SHADOWS.heavy,
  },
  fabPlus: {
    color: '#fff', fontSize: 36, fontWeight: '400',
    lineHeight: 40, marginTop: -1,
  },
});
