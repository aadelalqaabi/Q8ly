import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, KeyboardAvoidingView,
  Platform, ScrollView, Share,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { fetchRooms, fetchArchivedRooms, createRoom, addRoomRealtime, removeRoomRealtime } from '../../store/slices/hachiSlice';
import { getSocket } from '../../services/socket';
import { getDateLocale } from '../../i18n';
import { useTheme } from '../../context/ThemeContext';
import { useGuestGate } from '../../context/GuestGateContext';

const HACHI_REQUIRED = 50;

const CATEGORY_EMOJIS = {
  all: '🌐', general: '💬', food: '🍔', coffee: '☕', cars: '🚗', girls: '💅',
};
const CATEGORY_KEYS = ['all', 'general', 'food', 'coffee', 'cars', 'girls'];

const REACTION_EMOJIS = { fire: '🔥', eyes: '👀', skull: '💀' };

function dominantReaction(reactions) {
  if (!reactions) return null;
  const entries = Object.entries(reactions).filter(([, v]) => v > 0);
  if (!entries.length) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

// ── RoomCard ───────────────────────────────────────────────────────────────────
function RoomCard({ room, onPress, archived, isJoined }) {
  const { t } = useTranslation();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const created = room.createdAt
    ? formatDistanceToNow(new Date(room.createdAt), { addSuffix: true, locale: getDateLocale() })
    : '';
  const catEmoji = CATEGORY_EMOJIS[room.category] || '💬';
  const dom = dominantReaction(room.reactions);

  const handleShare = async (e) => {
    e.stopPropagation?.();
    const url = `kuwai://circle/${room._id}`;
    try {
      await Share.share(Platform.OS === 'ios' ? { url } : { message: url });
    } catch { /* silent */ }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardMain}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {room.title}
          </Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.cardBy}>
            {room.creator?.name || t('hachi.someoneDefault')} · {created}
          </Text>
          {isJoined && (
            <View style={styles.joinedPill}>
              <Text style={styles.joinedPillText}>Joined</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.cardRight}>
        {!archived && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>{t('hachi.liveBadge')}</Text>
          </View>
        )}
        {!archived && (
          <View style={styles.memberBadge}>
            <Ionicons name="person" size={11} color={COLORS.accent} />
            <Text style={styles.memberCount}>{room.memberCount || 1}</Text>
          </View>
        )}
        {archived && (
          <View style={styles.endedBadge}>
            <Text style={styles.endedBadgeText}>{t('hachi.endedBadge')}</Text>
          </View>
        )}
        {archived && room.summary?.messageCount > 0 && (
          <View style={styles.archiveMsgCount}>
            <Ionicons name="chatbubble-outline" size={11} color={COLORS.textMuted} />
            <Text style={styles.archiveMsgCountText}>{room.summary.messageCount}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── LockedOverlay ──────────────────────────────────────────────────────────────
function LockedOverlay({ points }) {
  const { t } = useTranslation();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const pct = Math.min((points / HACHI_REQUIRED) * 100, 100);

  const howToEarn = [
    { icon: 'create-outline',     label: t('hachi.lockEarnPost'),     pts: '+2' },
    { icon: 'heart-outline',      label: t('hachi.lockEarnLike'),     pts: '+1' },
    { icon: 'person-add-outline', label: t('hachi.lockEarnFollower'), pts: '+3' },
    { icon: 'chatbubble-outline', label: t('hachi.lockEarnComment'),  pts: '+1' },
  ];

  return (
    <View style={styles.lockedWrap}>
      <View style={styles.lockCircle}>
        <Ionicons name="lock-closed" size={28} color={COLORS.accent} />
      </View>
      <Text style={styles.lockTitle}>{t('hachi.lockTitle')}</Text>
      <Text style={styles.lockSub}>
        {t('hachi.lockDesc', { count: HACHI_REQUIRED })}
      </Text>
      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.progressLabel}>
          {t('hachi.lockProgress', { current: points, required: HACHI_REQUIRED })}
        </Text>
      </View>
      <View style={styles.earnCard}>
        <Text style={styles.earnTitle}>{t('hachi.lockHowTitle')}</Text>
        {howToEarn.map((item) => (
          <View key={item.label} style={styles.earnRow}>
            <View style={styles.earnIconWrap}>
              <Ionicons name={item.icon} size={16} color={COLORS.textMuted} />
            </View>
            <Text style={styles.earnLabel}>{item.label}</Text>
            <Text style={styles.earnPts}>{item.pts}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── HachiScreen ────────────────────────────────────────────────────────────────
export default function HachiScreen({ navigation }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { rooms, archivedRooms = [], isLoading, archivedLoading } = useSelector((s) => s.hachi);
  const { user: currentUser } = useSelector((s) => s.auth);
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { guestGate } = useGuestGate();

  const hachiPoints = currentUser?.hachiPoints || 0;
  const hasBadge = currentUser?.verifiedBadge && currentUser.verifiedBadge !== 'none';
  const canCreate = hasBadge || hachiPoints >= HACHI_REQUIRED;

  const CATEGORIES = CATEGORY_KEYS.map((key) => ({
    key,
    emoji: CATEGORY_EMOJIS[key],
    label: t(`hachi.cat${key.charAt(0).toUpperCase()}${key.slice(1)}`),
  }));

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showLocked, setShowLocked] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    dispatch(fetchRooms(activeCategory));
    dispatch(fetchArchivedRooms(activeCategory));
  }, [activeCategory]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onNewRoom = (room) => dispatch(addRoomRealtime(room));
    const onRemoveRoom = (data) => dispatch(removeRoomRealtime(data));
    socket.on('hachiNewRoom', onNewRoom);
    socket.on('hachiRoomRemoved', onRemoveRoom);
    return () => {
      socket.off('hachiNewRoom', onNewRoom);
      socket.off('hachiRoomRemoved', onRemoveRoom);
    };
  }, []);

  // Trending: categories with ≥2 active rooms, sorted by count
  const trending = useMemo(() => {
    const counts = {};
    rooms.forEach((r) => { counts[r.category] = (counts[r.category] || 0) + 1; });
    return Object.entries(counts)
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1]);
  }, [rooms]);

  const myId = currentUser?._id?.toString();

  const isRoomJoined = useCallback((room) =>
    myId && room.members?.some((m) => m?.toString() === myId),
  [myId]);

  // Active + archived merged: joined rooms first, then the rest, archived at end
  const filteredRooms = useMemo(() => {
    const applyFilters = (list) => {
      if (!searchQuery.trim()) return list;
      const q = searchQuery.trim().toLowerCase();
      return list.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        (r.creator?.name && r.creator.name.toLowerCase().includes(q)) ||
        (r.category && r.category.toLowerCase().includes(q))
      );
    };
    const activeFiltered = applyFilters(rooms);
    const sortedActive = [
      ...activeFiltered.filter((r) => isRoomJoined(r)),
      ...activeFiltered.filter((r) => !isRoomJoined(r)),
    ];
    return [...sortedActive, ...applyFilters(archivedRooms)];
  }, [rooms, archivedRooms, searchQuery, isRoomJoined]);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      const result = await dispatch(createRoom({ title: newTitle.trim(), category: newCategory, isPublic: true })).unwrap();
      setShowCreate(false);
      setNewTitle('');
      setNewCategory('general');
      navigation.navigate('HachiRoom', { roomId: result._id, title: result.title });
    } catch { /* silent */ }
    finally { setCreating(false); }
  }, [newTitle, newCategory, creating]);

  const handleAddPress = () => {
    if (canCreate) setShowCreate(true);
    else setShowLocked(true);
  };

  const renderEmpty = () => (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="chatbubbles-outline" size={28} color={COLORS.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>
        {searchQuery.trim() ? t('hachi.noResults') : t('hachi.noHachis')}
      </Text>
      <Text style={styles.emptySub}>
        {searchQuery.trim() ? t('hachi.tryAnother') : t('hachi.noHachisSub')}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('hachi.title')}</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={handleAddPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add" size={26} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('hachi.search')}
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsScroll}
      >
        {CATEGORIES.map((cat) => {
          const active = activeCategory === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setActiveCategory(cat.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Room list — joined rooms float to top */}
      {isLoading ? (
        <ActivityIndicator size="large" color={COLORS.accent} style={styles.loader} />
      ) : (
        <FlatList
          data={filteredRooms}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <RoomCard
              room={item}
              archived={!item.isActive}
              isJoined={isRoomJoined(item)}
              onPress={() => guestGate(() => navigation.navigate('HachiRoom', { roomId: item._id, title: item.title }))}
            />
          )}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}
          refreshing={isLoading}
          onRefresh={() => { dispatch(fetchRooms(activeCategory)); dispatch(fetchArchivedRooms(activeCategory)); }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Locked modal */}
      <Modal
        visible={showLocked}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLocked(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: 16 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowLocked(false)}>
              <Text style={styles.modalCancel}>{t('common.close')}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
          </View>
          <LockedOverlay points={hachiPoints} />
        </View>
      </Modal>

      {/* Create room modal */}
      <Modal
        visible={showCreate}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreate(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Modal header */}
          <View style={[styles.modalHeader, { paddingTop: 16 }]}>
            <TouchableOpacity onPress={() => { setShowCreate(false); setNewTitle(''); setNewCategory('general'); }}>
              <Text style={styles.modalCancel}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('hachi.newHachi')}</Text>
            <TouchableOpacity
              onPress={handleCreate}
              disabled={!newTitle.trim() || creating}
              style={[styles.startBtn, (!newTitle.trim() || creating) && styles.startBtnDisabled]}
            >
              {creating
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.startBtnText}>{t('hachi.start')}</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            {/* Title input */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>{t('hachi.topicPrompt')}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={t('hachi.topicPlaceholder')}
                placeholderTextColor={COLORS.textMuted}
                value={newTitle}
                onChangeText={setNewTitle}
                maxLength={80}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreate}
              />
              <Text style={styles.charCount}>{newTitle.length}/80</Text>
            </View>

            {/* Category picker */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>{t('hachi.catSelectLabel')}</Text>
              <View style={styles.catPillsRow}>
                {CATEGORIES.filter((c) => c.key !== 'all').map((cat) => {
                  const selected = newCategory === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[styles.catPill, selected && styles.catPillSelected]}
                      onPress={() => setNewCategory(cat.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.catPillLabel, selected && styles.catPillLabelSelected]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Community rules */}
            <View style={styles.rulesCard}>
              <View style={styles.rulesHeader}>
                <Ionicons name="shield-checkmark" size={16} color={COLORS.accent} />
                <Text style={styles.rulesTitle}>{t('hachi.rulesTitle')}</Text>
              </View>
              {[
                { icon: 'heart-outline',     text: t('hachi.rule1') },
                { icon: 'chatbubble-outline', text: t('hachi.rule2') },
                { icon: 'eye-off-outline',   text: t('hachi.rule3') },
                { icon: 'person-outline',    text: t('hachi.rule4') },
              ].map((rule) => (
                <View key={rule.text} style={styles.ruleRow}>
                  <Ionicons name={rule.icon} size={14} color={COLORS.textMuted} />
                  <Text style={styles.ruleText}>{rule.text}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.white },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: C.text },
  createBtn: { padding: 4 },
  lockedBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.fill,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  lockedBtnPts: { fontSize: 12, fontWeight: '600', color: C.textMuted },

  // Trending strip
  trendingScroll: { flexGrow: 0 },
  trendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  trendingLabel: { fontSize: 14, marginRight: 2 },
  trendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: C.fill,
  },
  trendingChipActive: { backgroundColor: C.accent },
  trendingEmoji: { fontSize: 13 },
  trendingText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  trendingTextActive: { fontSize: 13, fontWeight: '600', color: '#fff' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.fill,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 6,
    paddingHorizontal: 10,
    height: 38,
    gap: 6,
  },
  searchInput: { flex: 1, fontSize: 15, color: C.text, padding: 0 },

  // Category chips
  chipsScroll: { flexGrow: 0 },
  chipsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.fill,
  },
  chipActive: { backgroundColor: C.accent },
  chipEmoji: { fontSize: 14 },
  chipLabel: { fontSize: 14, fontWeight: '500', color: C.textMuted },
  chipLabelActive: { color: '#fff', fontWeight: '600' },

  loader: { marginTop: 60 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    gap: 12,
  },
  cardMain: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  cardEmoji: { fontSize: 16, lineHeight: 22 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: C.text, lineHeight: 22 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardBy: { fontSize: 13, color: C.textMuted },
  joinedPill: {
    backgroundColor: '#EEF2FA',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  joinedPillText: { fontSize: 11, fontWeight: '600', color: C.accent },
  cardRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: C.fill,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  memberCount: { fontSize: 12, fontWeight: '600', color: C.accent },
  domReaction: { fontSize: 16 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginLeft: 16 },

  // Live badge
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDFAF3',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  liveBadgeText: { fontSize: 11, fontWeight: '700', color: '#1A8C42' },

  // Archived card
  cardArchived: { opacity: 0.65 },
  cardTitleArchived: { color: C.textMuted },
  endedBadge: {
    backgroundColor: C.fill,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
    flexShrink: 0,
  },
  endedBadgeText: { fontSize: 11, fontWeight: '600', color: C.textMuted },
  archiveMsgCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: C.fill,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  archiveMsgCountText: { fontSize: 12, fontWeight: '600', color: C.textMuted },


  empty: { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.fill,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: C.text, marginBottom: 6 },
  emptySub: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 20 },

  // ── Lock overlay ──────────────────────────────────────────────────────────
  lockedWrap: { flex: 1, paddingHorizontal: 24, paddingTop: 16, alignItems: 'center' },
  lockCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.fill,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  lockTitle: { fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 10, textAlign: 'center' },
  lockSub: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  progressWrap: { width: '100%', marginBottom: 28 },
  progressTrack: { height: 8, backgroundColor: C.fill, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: 8, backgroundColor: C.accent, borderRadius: 4 },
  progressLabel: { fontSize: 13, color: C.textMuted, textAlign: 'center', fontWeight: '600' },
  earnCard: { width: '100%', backgroundColor: C.fill, borderRadius: 16, padding: 16 },
  earnTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 12 },
  earnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  earnIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: C.white, justifyContent: 'center', alignItems: 'center',
  },
  earnLabel: { flex: 1, fontSize: 14, color: C.text },
  earnPts: { fontSize: 14, fontWeight: '700', color: C.accent },

  // ── Modals ────────────────────────────────────────────────────────────────
  modalContainer: { flex: 1, backgroundColor: C.white },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  modalCancel: { fontSize: 17, color: C.accent, minWidth: 60 },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: C.text, textAlign: 'center' },
  startBtn: {
    backgroundColor: C.accent,
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  modalSection: { paddingHorizontal: 20, paddingTop: 22 },
  modalLabel: { fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 12 },
  modalInput: {
    fontSize: 17,
    color: C.text,
    backgroundColor: C.fill,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 52,
  },
  charCount: { fontSize: 12, color: C.textMuted, marginTop: 6 },

  // Visibility toggle
  visibilityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  visBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: C.fill,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  visBtnActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  visBtnLabel: { fontSize: 14, fontWeight: '600', color: C.textMuted },
  visBtnLabelActive: { color: '#fff' },
  visBtnSub: { fontSize: 11, color: C.textMuted },

  // Category pill picker
  catPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: C.fill,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  catPillSelected: {
    backgroundColor: '#EEF2FA',
    borderColor: C.accent,
  },
  catPillEmoji: { fontSize: 16 },
  catPillLabel: { fontSize: 14, fontWeight: '500', color: C.textMuted },
  catPillLabelSelected: { color: C.accent, fontWeight: '600' },

  // Community rules card
  rulesCard: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 32,
    backgroundColor: C.fill,
    borderRadius: 14,
    padding: 16,
  },
  rulesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 12,
  },
  rulesTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingVertical: 5,
  },
  ruleText: { flex: 1, fontSize: 13, color: C.textMuted, lineHeight: 19 },
});
