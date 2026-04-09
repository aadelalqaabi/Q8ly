import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TextInput, Dimensions,
  TouchableOpacity, ActivityIndicator, Keyboard, TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { usersAPI, hachiAPI } from '../../services/api';
import UserCard from '../../components/profile/UserCard';
import { useTheme } from '../../context/ThemeContext';

const { width: SW } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_PAD = 16;
const TILE_W = (SW - GRID_PAD * 2 - GRID_GAP) / 2;

const CATEGORY_KEYS = ['general', 'food', 'coffee', 'cars', 'girls', 'sports', 'tech', 'finance', 'travel', 'entertainment', 'gaming', 'realestate'];

const CATEGORY_ICONS = {
  general:       'chatbubbles-outline',
  food:          'restaurant-outline',
  coffee:        'cafe-outline',
  cars:          'car-outline',
  girls:         'sparkles-outline',
  sports:        'trophy-outline',
  tech:          'hardware-chip-outline',
  finance:       'trending-up-outline',
  travel:        'airplane-outline',
  entertainment: 'film-outline',
  gaming:        'game-controller-outline',
  realestate:    'home-outline',
};

const CATEGORY_COLORS = {
  general:       '#0033A0',
  food:          '#FF9500',
  coffee:        '#8B5E3C',
  cars:          '#FF3B30',
  girls:         '#AF52DE',
  sports:        '#34C759',
  tech:          '#5AC8FA',
  finance:       '#30D158',
  travel:        '#007AFF',
  entertainment: '#FF2D55',
  gaming:        '#5856D6',
  realestate:    '#A2845E',
};

const SEARCH_TAB_KEYS = ['circles', 'people'];

export default function DiscoverScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS, isRTL), [COLORS, isRTL]);
  const inputRef = useRef(null);

  const { rooms } = useSelector((s) => s.hachi);
  const hotRooms = useMemo(() => rooms.slice(0, 10), [rooms]);

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('circles');
  const [accountResults, setAccountResults] = useState([]);
  const [circleResults, setCircleResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Category drill-down state
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryRooms, setCategoryRooms] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(false);

  // Count active circles per category (loaded once)
  const [categoryCounts, setCategoryCounts] = useState({});
  const [countsLoaded, setCountsLoaded] = useState(false);

  const loadCategoryCounts = useCallback(async () => {
    try {
      const res = await hachiAPI.getRooms();
      const counts = {};
      (res.rooms || []).forEach((r) => {
        if (r.category) counts[r.category] = (counts[r.category] || 0) + 1;
      });
      setCategoryCounts(counts);
    } catch { /* silent */ }
    finally { setCountsLoaded(true); }
  }, []);

  useEffect(() => { loadCategoryCounts(); }, []);

  // Long-press on the Discover tab icon → focus search
  useEffect(() => {
    const unsub = navigation.addListener('tabLongPress', () => {
      setTimeout(() => inputRef.current?.focus(), 150);
    });
    return unsub;
  }, [navigation]);

  const loadCategoryRooms = useCallback(async (cat) => {
    setCategoryLoading(true);
    try {
      const res = await hachiAPI.getRooms(cat);
      setCategoryRooms(res.rooms || []);
    } catch { setCategoryRooms([]); }
    finally { setCategoryLoading(false); }
  }, []);

  const handleCategoryPress = (cat) => {
    setSelectedCategory(cat);
    loadCategoryRooms(cat);
  };

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) {
      setAccountResults([]);
      setCircleResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const [usersRes, circlesRes] = await Promise.all([
        usersAPI.searchUsers(q.trim()),
        hachiAPI.search(q.trim()),
      ]);
      setAccountResults(usersRes.users || []);
      setCircleResults(circlesRes.rooms || []);
    } catch {
      setAccountResults([]);
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
    if (tab === 'circles') return circleResults;
    return accountResults;
  }, [isSearchMode, tab, circleResults, accountResults]);

  const countFor = (key) => {
    if (key === 'circles') return circleResults.length;
    return accountResults.length;
  };

  const renderCircleCard = (room) => (
    <TouchableOpacity
      style={styles.circleCard}
      onPress={() => navigation.navigate('HachiRoom', { roomId: room._id })}
      activeOpacity={0.75}
    >
      <View style={styles.circleIconWrap}>
        <Ionicons name={CATEGORY_ICONS[room.category] || 'chatbubbles-outline'} size={20} color={COLORS.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.circleTitle} numberOfLines={1}>{room.title}</Text>
        <Text style={styles.circleMeta}>
          {room.memberCount || 0} {t('discover.listening')} · {t(`hachi.cat${room.category?.charAt(0).toUpperCase()}${room.category?.slice(1)}`)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => {
    if (tab === 'circles') return renderCircleCard(item);
    return <UserCard user={item} navigation={navigation} />;
  };

  // ── Category grid (default view) ────────────────────────────────────────────
  const renderCategoryGrid = () => {
    if (!countsLoaded) {
      return <ActivityIndicator size="small" color={COLORS.accent} style={{ marginTop: 40 }} />;
    }
    return (
      <FlatList
        key="category-grid"
        data={CATEGORY_KEYS}
        keyExtractor={(item) => item}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={{ padding: GRID_PAD, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {hotRooms.length > 0 && (
              <View style={styles.mostActiveSection}>
                <Text style={styles.mostActiveTitle}>{t('hachi.mostActive')}</Text>
                <View style={styles.mostActiveList}>
                  {hotRooms.map((room, i) => (
                    <TouchableOpacity
                      key={room._id}
                      style={[styles.activeRow, i === 0 && styles.activeRowFirst, i === hotRooms.length - 1 && styles.activeRowLast, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                      onPress={() => navigation.navigate('HachiRoom', { roomId: room._id, title: room.title })}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.activeRank, i === 0 && { color: COLORS.accent }]}>{i + 1}</Text>
                      <View style={[styles.activeIcon, { backgroundColor: i === 0 ? '#DDE7F5' : COLORS.fill }]}>
                        <Ionicons name={CATEGORY_ICONS[room.category] || 'chatbubbles-outline'} size={17} color={i === 0 ? COLORS.accent : COLORS.textMuted} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[styles.activeRowTitle, { textAlign: isRTL ? 'right' : 'left' }, i === 0 && { fontWeight: '700' }]} numberOfLines={1}>{room.title}</Text>
                        <Text style={styles.activeRowSub} numberOfLines={1}>{room.creator?.name || ''}</Text>
                      </View>
                      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name="people" size={12} color={COLORS.textMuted} />
                        <Text style={styles.activeRowMembers}>{room.memberCount || 1}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            <View style={styles.gridHeader}>
              <Text style={styles.gridTitle}>{t('discover.categoriesTitle')}</Text>
              <Text style={styles.gridSub}>{t('discover.categoriesSub')}</Text>
            </View>
          </View>
        }
        renderItem={({ item: cat }) => {
          const color = CATEGORY_COLORS[cat] || COLORS.accent;
          const icon = CATEGORY_ICONS[cat] || 'chatbubbles-outline';
          const count = categoryCounts[cat] || 0;
          const label = t(`hachi.cat${cat.charAt(0).toUpperCase()}${cat.slice(1)}`);
          return (
            <TouchableOpacity
              style={[styles.catTile, { borderColor: color + '25' }]}
              onPress={() => handleCategoryPress(cat)}
              activeOpacity={0.7}
            >
              <View style={[styles.catIconWrap, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={24} color={color} />
              </View>
              <Text style={styles.catLabel}>{label}</Text>
            </TouchableOpacity>
          );
        }}
      />
    );
  };

  // ── Category drill-down (circles in a category) ────────────────────────────
  const renderCategoryDetail = () => (
    <FlatList
      data={categoryRooms}
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => renderCircleCard(item)}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24, flexGrow: 1 }}
      ListHeaderComponent={
        <View style={styles.catDetailHeader}>
          <TouchableOpacity onPress={() => setSelectedCategory(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={24} color={COLORS.accent} />
          </TouchableOpacity>
          <Ionicons name={CATEGORY_ICONS[selectedCategory] || 'chatbubbles-outline'} size={22} color={CATEGORY_COLORS[selectedCategory] || COLORS.accent} style={{ marginHorizontal: 8 }} />
          <Text style={styles.catDetailTitle}>
            {t(`hachi.cat${selectedCategory?.charAt(0).toUpperCase()}${selectedCategory?.slice(1)}`)}
          </Text>
        </View>
      }
      ListEmptyComponent={
        categoryLoading ? (
          <ActivityIndicator size="small" color={COLORS.accent} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.emptyCategory}>
            <Ionicons name="chatbubbles-outline" size={36} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyCatTitle}>{t('discover.noCirclesInCategory')}</Text>
            <Text style={styles.emptyCatSub}>{t('discover.noCirclesInCategorySub')}</Text>
          </View>
        )
      }
    />
  );

  const renderEmpty = () => {
    if (isSearching) return null;
    if (isSearchMode) {
      return (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={36} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>{t('discover.noSearchResults')}</Text>
          <Text style={styles.emptySub}>{t('discover.noSearchResultsSub')}</Text>
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
            <Ionicons name="search" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              if (text.trim() && selectedCategory) setSelectedCategory(null);
            }}
            placeholder={t('discover.searchPlaceholder')}
            placeholderTextColor={COLORS.textPlaceholder}
            returnKeyType="search"
            onSubmitEditing={() => { if (query.trim()) doSearch(query); }}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs — only visible in search mode */}
      {isSearchMode && (
        <View style={styles.tabRow}>
          {SEARCH_TAB_KEYS.map((key) => {
            const active = tab === key;
            const count = countFor(key);
            const tabLabel = t(`discover.tab${key.charAt(0).toUpperCase()}${key.slice(1)}`);
            return (
              <TouchableOpacity
                key={key}
                style={styles.tabItem}
                onPress={() => setTab(key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {tabLabel}{count > 0 ? ` (${count})` : ''}
                </Text>
                <View style={[styles.tabDot, active && styles.tabDotActive]} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Content */}
      {!isSearchMode ? (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          {hotRooms.length > 0 && (
            <View style={styles.mostActiveSection}>
              <Text style={styles.mostActiveTitle}>{t('hachi.mostActive')}</Text>
              <View style={styles.mostActiveList}>
                {hotRooms.map((room, i) => (
                  <TouchableOpacity
                    key={room._id}
                    style={[styles.activeRow, i === 0 && styles.activeRowFirst, i === hotRooms.length - 1 && styles.activeRowLast, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                    onPress={() => navigation.navigate('HachiRoom', { roomId: room._id, title: room.title })}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.activeRank}>{i + 1}</Text>
                    <View style={[styles.activeIcon, { backgroundColor: COLORS.fill }]}>
                      <Ionicons name={CATEGORY_ICONS[room.category] || 'chatbubbles-outline'} size={17} color={COLORS.textMuted} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.activeRowTitle, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>{room.title}</Text>
                      <Text style={styles.activeRowSub} numberOfLines={1}>{room.creator?.name || ''}</Text>
                    </View>
                    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="people" size={12} color={COLORS.textMuted} />
                      <Text style={styles.activeRowMembers}>{room.memberCount || 1}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
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

const makeStyles = (C, isRTL) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.white },
  header: {
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.fill, borderRadius: 10, height: 38, paddingHorizontal: 10, gap: 6,
  },
  searchInput: { flex: 1, fontSize: 15, color: C.text, textAlign: isRTL ? 'right' : 'left' },

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

  // ── Category grid ─────────────────────────────────────────────────────────
  gridHeader: { marginBottom: 16 },

  // Most active in discover
  mostActiveSection: { paddingTop: 16 },
  mostActiveTitle: { fontSize: 15, fontWeight: '700', color: C.text, letterSpacing: -0.2, paddingHorizontal: 16, marginBottom: 4, textAlign: isRTL ? 'right' : 'left' },
  mostActiveList: { overflow: 'hidden' },
  activeRow: {
    alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
    backgroundColor: C.white,
  },
  activeRowFirst: {},
  activeRowLast: { borderBottomWidth: 0 },
  activeRank: { fontSize: 15, fontWeight: '700', color: C.textMuted, width: 22, textAlign: 'center', flexShrink: 0 },
  activeIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  activeRowTitle: { fontSize: 17, fontWeight: '700', color: C.text, letterSpacing: -0.2 },
  activeRowSub: { fontSize: 13, color: C.textMuted, marginTop: 1 },
  activeRowMembers: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  gridTitle: {
    fontSize: 22, fontWeight: '800', color: C.text,
    letterSpacing: -0.3, textAlign: isRTL ? 'right' : 'left',
  },
  gridSub: {
    fontSize: 13, color: C.textMuted, marginTop: 2, textAlign: isRTL ? 'right' : 'left',
  },
  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
  catTile: {
    width: TILE_W, borderRadius: 14, padding: 16,
    backgroundColor: C.white,
    borderWidth: 1,
  },
  catIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  catLabel: { fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 2 },
  catCount: { fontSize: 12, fontWeight: '500' },

  // ── Category detail ───────────────────────────────────────────────────────
  catDetailHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
  },
  catDetailTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  emptyCategory: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyCatTitle: { fontSize: 17, fontWeight: '600', color: C.text, marginBottom: 6 },
  emptyCatSub: { fontSize: 14, color: C.textMuted, textAlign: 'center' },

  // ── Circle card ─────────────────────────────────────────────────────────────
  circleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
  },
  circleIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.accent + '12',
    justifyContent: 'center', alignItems: 'center',
  },
  circleTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 2, letterSpacing: -0.2 },
  circleMeta: { fontSize: 13, color: C.textMuted },
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
