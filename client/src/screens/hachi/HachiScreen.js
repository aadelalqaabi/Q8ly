import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, KeyboardAvoidingView,
  Platform, ScrollView, Dimensions, Vibration, Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { fetchRooms, fetchMoments, createRoom, addRoomRealtime } from '../../store/slices/hachiSlice';
import { getSocket } from '../../services/socket';
import { getDateLocale } from '../../i18n';
import { useTheme } from '../../context/ThemeContext';
import { useGuestGate } from '../../context/GuestGateContext';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';

const haptic = {
  light:   () => Platform.OS === 'ios' ? Haptics.selectionAsync() : Vibration.vibrate(30),
  success: () => Platform.OS === 'ios' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Vibration.vibrate([0, 40, 60, 40]),
};

const { width: SW } = Dimensions.get('window');
const SCALE         = SW / 390; // 390 = iPhone 14 base; Pro Max ~430 → ~1.10
const HACHI_COST    = 50; // points deducted per circle created

const CATEGORY_ICONS = {
  all:           'globe-outline',
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
const CATEGORY_KEYS = ['all', 'general', 'food', 'coffee', 'cars', 'girls', 'sports', 'tech', 'finance', 'travel', 'entertainment', 'gaming', 'realestate'];

// ── Helpers ────────────────────────────────────────────────────────────────────


function relTime(date) {
  if (!date) return '';
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: getDateLocale() });
}

// ── FollowingInRoom pill ───────────────────────────────────────────────────────
// ── Verified badge (inline checkmark for badged circle creators) ──────────────
function CreatorBadge({ badge }) {
  if (!badge || badge === 'none') return null;
  return (
    <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: '#0033A0', justifyContent: 'center', alignItems: 'center', marginHorizontal: 4, flexShrink: 0 }}>
      <Ionicons name="checkmark" size={8} color="#fff" />
    </View>
  );
}

// ── ActiveRow (unified Most Active row — same style for all 5) ─────────────────

function ActiveRow({ room, rank, isFirst, onPress, styles, C, isRTL, isLast }) {
  const catIcon = CATEGORY_ICONS[room.category] || 'chatbubbles-outline';
  const members = room.memberCount || 1;

  return (
    <TouchableOpacity
      style={[styles.activeRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }, isFirst && { backgroundColor: '#EEF2FA' }, isLast && styles.activeRowLast]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.activeRank, isFirst && { color: C.accent }]}>{rank}</Text>

      <View style={[styles.activeIcon, { backgroundColor: isFirst ? '#DDE7F5' : C.fill }]}>
        <Ionicons name={catIcon} size={Math.round(18 * SCALE)} color={isFirst ? C.accent : C.textMuted} />
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.activeTitle, { textAlign: isRTL ? 'right' : 'left' }, isFirst && { fontWeight: '700' }]} numberOfLines={1}>
          {room.title}
        </Text>
        <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 }]}>
          <Text style={styles.activeCreator} numberOfLines={1}>{room.creator?.name || ''}</Text>
          <CreatorBadge badge={room.creator?.verifiedBadge} />
        </View>
      </View>

      <View style={[styles.activeMeta, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name="people" size={12} color={C.textMuted} />
        <Text style={styles.activeMembers}>{members}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── RoomRow ────────────────────────────────────────────────────────────────────

function RoomRow({ room, onPress, styles, C, t }) {
  const catIcon = CATEGORY_ICONS[room.category] || 'chatbubbles-outline';
  const members = room.memberCount || 1;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowIcon, { backgroundColor: C.fill }]}>
        <Ionicons name={catIcon} size={20} color={C.textMuted} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>{room.title}</Text>
        <View style={styles.rowSubRow}>
          <Text style={styles.rowSubText} numberOfLines={1}>{room.creator?.name || ''}</Text>
          <CreatorBadge badge={room.creator?.verifiedBadge} />
          <Text style={styles.rowSubMuted}> · </Text>
          <Text style={styles.rowSubMuted} numberOfLines={1}>{relTime(room.updatedAt || room.createdAt)}</Text>
        </View>
      </View>
      <View style={styles.rowMeta}>
        <Text style={styles.rowMetaNum}>{members}</Text>
        <Text style={styles.rowMetaLabel}>{t('hachi.inChat')}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── LockedOverlay ──────────────────────────────────────────────────────────────

function LockedOverlay({ points, styles, C }) {
  const { t } = useTranslation();
  const pct = Math.min((points / HACHI_COST) * 100, 100);
  const rows = [
    { icon: 'create-outline',     label: t('hachi.lockEarnPost'),             pts: '+2' },
    { icon: 'heart-outline',      label: t('hachi.lockEarnLike'),             pts: '+1' },
    { icon: 'person-add-outline', label: t('hachi.lockEarnFollower'),         pts: '+3' },
    { icon: 'chatbubble-outline', label: t('hachi.lockEarnComment'),          pts: '+1' },
    { icon: 'chatbubbles-outline',label: t('hachi.lockEarnCommentReceived'),  pts: '+1' },
    { icon: 'happy-outline',      label: t('hachi.lockEarnReactionReceived'), pts: '+1' },
  ];
  return (
    <View style={styles.lockedWrap}>
      <View style={styles.lockCircle}>
        <Ionicons name="lock-closed" size={28} color={C.accent} />
      </View>
      <Text style={styles.lockTitle}>{t('hachi.lockTitle')}</Text>
      <Text style={styles.lockSub}>{t('hachi.lockDesc', { count: HACHI_COST })}</Text>
      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.progressLabel}>
          {t('hachi.lockProgress', { current: points, required: HACHI_COST })}
        </Text>
      </View>
      <View style={styles.earnCard}>
        <Text style={styles.earnTitle}>{t('hachi.lockHowTitle')}</Text>
        {rows.map((r) => (
          <View key={r.label} style={styles.earnRow}>
            <View style={styles.earnIconWrap}>
              <Ionicons name={r.icon} size={16} color={C.textMuted} />
            </View>
            <Text style={styles.earnLabel}>{r.label}</Text>
            <Text style={styles.earnPts}>{r.pts}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── MomentCard (escaped pinned message) ────────────────────────────────────────

function MomentCard({ moment, onPress, styles, C, t }) {
  return (
    <TouchableOpacity style={styles.momentCard} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.momentTop}>
        <Ionicons name="pin" size={11} color={C.accent} />
        <Text style={styles.momentRoom} numberOfLines={1}>{moment.roomTitle}</Text>
        <View style={styles.momentCountBadge}>
          <Text style={styles.momentCountText}>{moment.memberCount || 0}</Text>
          <Ionicons name="person" size={10} color={C.textMuted} />
        </View>
      </View>
      <Text style={styles.momentText} numberOfLines={3}>
        "{moment.message?.text}"
      </Text>
      <View style={styles.momentBottom}>
        <Text style={styles.momentAuthor}>{moment.message?.user?.name || ''}</Text>
        {moment.replyCount > 0 && (
          <Text style={styles.momentReplies}>
            {moment.replyCount} {t('hachi.summaryMessages')} →
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── HachiScreen ────────────────────────────────────────────────────────────────

export default function HachiScreen({ navigation }) {
  const dispatch    = useDispatch();
  const insets      = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isRTL       = i18n.language === 'ar';
  const { rooms, isLoading } = useSelector((s) => s.hachi);
  const { user: currentUser } = useSelector((s) => s.auth);
  const { unreadCount } = useSelector((s) => s.notifications);
  const { colors: C, isDark } = useTheme();
  const { guestGate } = useGuestGate();

  const styles = useMemo(() => makeStyles(C, isDark, isRTL), [C, isDark, isRTL]);

  const hachiPoints = currentUser?.hachiPoints || 0;
  const hasBadge    = currentUser?.verifiedBadge && currentUser.verifiedBadge !== 'none';
  const canCreate   = hasBadge || hachiPoints >= HACHI_COST;

  const CATEGORIES = CATEGORY_KEYS.map((key) => ({
    key,
    icon: CATEGORY_ICONS[key],
    label: t(`hachi.cat${key.charAt(0).toUpperCase()}${key.slice(1)}`),
  }));

  const [showCreate,    setShowCreate]    = useState(false);
  const [showLocked,    setShowLocked]    = useState(false);
  const [newTitle,      setNewTitle]      = useState('');
  const [newCategory,   setNewCategory]   = useState('general');
  const [creating,      setCreating]      = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [userLocation,  setUserLocation]  = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          dispatch(fetchRooms({ location: loc }));
        } else {
          dispatch(fetchRooms({}));
        }
      } catch {
        dispatch(fetchRooms({}));
      }
    })();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onNewRoom = (room) => dispatch(addRoomRealtime(room));
    socket.on('hachiNewRoom', onNewRoom);
    return () => { socket.off('hachiNewRoom', onNewRoom); };
  }, []);

  // Hot circles: top 5 by velocity score (already sorted server-side)
  const hotRooms = useMemo(() => rooms.slice(0, 5), [rooms]);

  // Filtered rooms by category
  const filteredRooms = useMemo(
    () => activeCategory === 'all' ? rooms : rooms.filter((r) => r.category === activeCategory),
    [rooms, activeCategory]
  );

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      const result = await dispatch(
        createRoom({ title: newTitle.trim(), category: newCategory, isPublic: true, ...(userLocation || {}) })
      ).unwrap();
      haptic.success();
      setShowCreate(false);
      setNewTitle('');
      setNewCategory('general');
      navigation.navigate('HachiRoom', { roomId: result._id, title: result.title });
    } catch (err) {
      Alert.alert(t('common.error'), err?.message || t('common.tryAgain'));
    } finally { setCreating(false); }
  }, [newTitle, newCategory, creating]);

  const handleAddPress = () => {
    if (canCreate) setShowCreate(true);
    else setShowLocked(true);
  };

  const goToRoom = (room) =>
    guestGate(() => navigation.navigate('HachiRoom', { roomId: room._id, title: room.title }));

  // Category chips header
  const chipKeys = CATEGORY_KEYS; // already includes 'all' as first item
  const ListHeader = useMemo(() => (
    <View style={{ backgroundColor: C.white, paddingBottom: 4 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={isRTL ? { transform: [{ scaleX: -1 }] } : null}
        contentContainerStyle={{ paddingHorizontal: 8, gap: 0, paddingVertical: 0 }}
      >
        {chipKeys.map((key) => {
          const active = activeCategory === key;
          const label = key === 'all' ? t('hachi.catAll') : t(`hachi.cat${key.charAt(0).toUpperCase()}${key.slice(1)}`);
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setActiveCategory(key)}
              style={[styles.chip, active && styles.chipActive, isRTL ? { transform: [{ scaleX: -1 }] } : null]}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.sep} />
    </View>
  ), [activeCategory, styles, C, isRTL]);

  const renderEmpty = () => (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="chatbubbles-outline" size={28} color={C.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>{t('hachi.noHachis')}</Text>
      <Text style={styles.emptySub}>{t('hachi.noHachisSub')}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.wordmark}>{isRTL ? 'كواي' : 'KUWAI'}</Text>
        <View style={styles.headerRight}>
          {currentUser && (
            <View style={styles.pointsChip}>
              <Ionicons name="star" size={12} color={C.accent} />
              <Text style={styles.pointsChipText}>{hachiPoints}</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={handleAddPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerBtn}
          >
            <Ionicons name="add-circle-outline" size={27} color={C.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Room list ── */}
      {isLoading && !rooms.length ? (
        <ActivityIndicator size="large" color={C.accent} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filteredRooms}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <RoomRow room={item} onPress={() => goToRoom(item)} styles={styles} C={C} t={t} />
          )}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: C.white }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24, backgroundColor: C.white }}
          refreshing={isLoading}
          onRefresh={() => { dispatch(fetchRooms({ location: userLocation })); }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}

      {/* ── Locked modal ── */}
      <Modal
        visible={showLocked}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLocked(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowLocked(false)}>
              <Text style={styles.modalCancel}>{t('common.close')}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
          </View>
          <LockedOverlay points={hachiPoints} styles={styles} C={C} />
        </View>
      </Modal>

      {/* ── Create circle modal ── */}
      <Modal
        visible={showCreate}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowCreate(false); setNewTitle(''); setNewCategory('general'); }}
      >
        <KeyboardAvoidingView
          style={styles.createContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={[styles.createHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity
              style={styles.createCloseBtn}
              onPress={() => { setShowCreate(false); setNewTitle(''); setNewCategory('general'); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={C.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCreate}
              disabled={!newTitle.trim() || creating}
              style={[styles.createStartBtn, (!newTitle.trim() || creating) && styles.createStartBtnDisabled]}
            >
              {creating
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.createStartBtnText}>{t('hachi.start')}</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Big text input area */}
            <View style={styles.createInputSection}>
              <TextInput
                style={[styles.createInput, { textAlign: isRTL ? 'right' : 'left' }]}
                placeholder={t('hachi.topicPlaceholder')}
                placeholderTextColor={C.textMuted}
                value={newTitle}
                onChangeText={setNewTitle}
                maxLength={80}
                autoFocus
                multiline
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={handleCreate}
              />
              <View style={[styles.createInputFooter, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {!hasBadge && (
                  <View style={[styles.createCostBadge, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Ionicons name="star" size={11} color={C.accent} />
                    <Text style={styles.createCostText}>{t('hachi.createCost', { cost: HACHI_COST })}</Text>
                  </View>
                )}
                <Text style={styles.createCharCount}>{newTitle.length}/80</Text>
              </View>
            </View>

            {/* Category selector */}
            <View style={styles.createCatSection}>
              <Text style={[styles.createCatHeading, { textAlign: isRTL ? 'right' : 'left' }]}>
                {t('hachi.catSelectLabel')}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.createCatScroll}
                style={isRTL && { transform: [{ scaleX: -1 }] }}
              >
                {CATEGORIES.filter((c) => c.key !== 'all').map((cat) => {
                  const selected = newCategory === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[styles.createCatTile, selected && styles.createCatTileSelected, isRTL && { transform: [{ scaleX: -1 }] }]}
                      onPress={() => { haptic.light(); setNewCategory(cat.key); }}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={cat.icon} size={22} color={selected ? C.accent : C.textMuted} />
                      <Text style={[styles.createCatTileLabel, selected && styles.createCatTileLabelSelected]} numberOfLines={2}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Rules */}
            <View style={styles.createRulesCard}>
              <View style={[styles.createRulesHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Ionicons name="shield-checkmark" size={15} color={C.accent} />
                <Text style={styles.createRulesTitle}>{t('hachi.rulesTitle')}</Text>
              </View>
              {[
                { icon: 'heart-outline',      text: t('hachi.rule1') },
                { icon: 'chatbubble-outline', text: t('hachi.rule2') },
                { icon: 'eye-off-outline',    text: t('hachi.rule3') },
                { icon: 'person-outline',     text: t('hachi.rule4') },
              ].map((rule) => (
                <View key={rule.text} style={[styles.createRuleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Ionicons name={rule.icon} size={13} color={C.textMuted} />
                  <Text style={[styles.createRuleText, { textAlign: isRTL ? 'right' : 'left' }]}>{rule.text}</Text>
                </View>
              ))}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── makeStyles ─────────────────────────────────────────────────────────────────

const makeStyles = (C, isDark, isRTL = false) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.white },

  // Header
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  wordmark: { flex: 1, fontSize: 28, letterSpacing: -1, fontWeight: '800', color: C.text, textAlign: isRTL ? 'right' : 'left' },
  headerRight: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  pointsChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: isDark ? '#1A2A4A' : '#EEF2FA',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  pointsChipText: { fontSize: 13, fontWeight: '700', color: C.accent },
  notifBadge: {
    position: 'absolute', top: 2, end: 2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: C.accent, borderWidth: 1.5, borderColor: C.white,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', lineHeight: 11 },

  // Trending subjects bar
  subjectsWrap: {
    paddingTop: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  subjectsScroll: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  subjectPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: isDark ? '#1A2A4A' : '#EEF2FA',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
  },
  subjectLabel: { fontSize: 13, fontWeight: '600', color: C.accent },
  subjectCount: {
    backgroundColor: C.accent, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: 'center',
  },
  subjectCountText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  // Section headers
  sectionHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10,
  },
  sectionEmoji: { fontSize: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, color: C.text },

  // Category chips
  chip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  chipActive: { borderBottomColor: C.accent },
  chipText: { fontSize: 14, fontWeight: '400', color: C.textMuted },
  chipTextActive: { color: C.text, fontWeight: '700' },

  // Most active section — unified list
  activeList: {
    marginHorizontal: Math.round(16 * SCALE),
    backgroundColor: C.fill,
    borderRadius: Math.round(16 * SCALE),
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.separator,
  },
  activeRow: {
    alignItems: 'center',
    gap: Math.round(11 * SCALE),
    paddingHorizontal: Math.round(14 * SCALE),
    paddingVertical: Math.round(13 * SCALE),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  activeRowLast: { borderBottomWidth: 0 },
  activeRank: {
    fontSize: Math.round(13 * SCALE), fontWeight: '700',
    color: C.textMuted, width: Math.round(18 * SCALE),
    textAlign: 'center', flexShrink: 0,
  },
  activeIcon: {
    width: Math.round(36 * SCALE), height: Math.round(36 * SCALE),
    borderRadius: Math.round(11 * SCALE),
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  activeTitle: {
    fontSize: Math.round(14 * SCALE), fontWeight: '600',
    color: C.text, letterSpacing: -0.1,
  },
  activeCreator: {
    fontSize: Math.round(12 * SCALE), fontWeight: '400',
    color: C.textMuted, flexShrink: 1,
  },
  activeMeta: { alignItems: 'center', gap: 3, flexShrink: 0 },
  activeMembers: { fontSize: Math.round(12 * SCALE), fontWeight: '600', color: C.textMuted },

  // Room rows
  row: {
    flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  rowIcon: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2, color: C.text, textAlign: isRTL ? 'right' : 'left' },
  rowSubRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', overflow: 'hidden' },
  rowSubText: { fontSize: 13, color: C.textMuted, lineHeight: 17, flexShrink: 1 },
  rowSubMuted: { fontSize: 13, color: C.textMuted, lineHeight: 17, flexShrink: 0 },
  rowMeta: { alignItems: 'flex-start', gap: 1, flexShrink: 0 },
  rowMetaNum: { fontSize: 15, fontWeight: '700', color: C.text },
  rowMetaLabel: { fontSize: 11, color: C.textMuted },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginStart: 72 },

  // Moment cards (escaped pinned messages)
  momentCard: {
    width: SW * 0.72,
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: isDark ? 0.45 : 0.06,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? C.separator : 'rgba(0,0,0,0.04)',
    borderStartWidth: 3,
    borderStartColor: C.accent,
  },
  momentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  momentRoom: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: C.accent,
  },
  momentCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: C.fill,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  momentCountText: { fontSize: 12, fontWeight: '700', color: C.textMuted },
  momentText: {
    fontSize: 15,
    fontWeight: '500',
    color: C.text,
    lineHeight: 21,
    fontStyle: 'italic',
  },
  momentBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  momentAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMuted,
  },
  momentReplies: {
    fontSize: 12,
    fontWeight: '600',
    color: C.accent,
  },

  // Empty state
  empty: { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.fill,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: C.text, marginBottom: 6 },
  emptySub: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 20 },

  // Lock overlay
  lockedWrap: { flex: 1, paddingHorizontal: 24, paddingTop: 16, alignItems: 'center' },
  lockCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.fill,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  lockTitle: { fontSize: 24, fontWeight: '700', color: C.text, marginBottom: 10, textAlign: 'center' },
  lockSub: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  progressWrap: { width: '100%', marginBottom: 28 },
  progressTrack: { height: 8, backgroundColor: C.fill, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: 8, backgroundColor: C.accent, borderRadius: 4 },
  progressLabel: { fontSize: 13, color: C.textMuted, textAlign: 'center', fontWeight: '600' },
  earnCard: { width: '100%', backgroundColor: C.fill, borderRadius: 16, padding: 16 },
  earnTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 12 },
  earnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  earnIconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center' },
  earnLabel: { flex: 1, fontSize: 14, color: C.text },
  earnPts: { fontSize: 14, fontWeight: '700', color: C.accent },

  // Modals (locked overlay)
  modalContainer: { flex: 1, backgroundColor: C.white },
  modalHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
  },
  modalCancel: { fontSize: 17, color: C.accent, minWidth: 60 },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: C.text, textAlign: 'center' },

  // Create circle modal
  createContainer: { flex: 1, backgroundColor: C.white },
  createHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  createCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.fill, justifyContent: 'center', alignItems: 'center' },
  createStartBtn: {
    backgroundColor: C.accent, borderRadius: 22,
    paddingHorizontal: 22, height: 38,
    justifyContent: 'center', alignItems: 'center',
  },
  createStartBtnDisabled: { opacity: 0.35 },
  createStartBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  createInputSection: {
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
  },
  createInput: {
    fontSize: 22, fontWeight: '600', color: C.text,
    minHeight: 80, lineHeight: 30,
  },
  createInputFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 10, paddingBottom: 4,
  },
  createCostBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  createCostText: { fontSize: 12, color: C.accent, fontWeight: '600' },
  createCharCount: { fontSize: 12, color: C.textMuted },
  createCatSection: { paddingTop: 24 },
  createCatHeading: {
    fontSize: 13, fontWeight: '600', color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: 20, marginBottom: 14,
  },
  createCatScroll: { paddingHorizontal: 16, gap: 10 },
  createCatTile: {
    width: 76, alignItems: 'center', gap: 7,
    backgroundColor: C.fill, borderRadius: 18,
    paddingVertical: 14, paddingHorizontal: 8,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  createCatTileSelected: { backgroundColor: '#EEF2FA', borderColor: C.accent },
  createCatTileLabel: { fontSize: 11, fontWeight: '500', color: C.textMuted, textAlign: 'center', lineHeight: 14 },
  createCatTileLabelSelected: { color: C.accent, fontWeight: '700' },
  createRulesCard: {
    marginHorizontal: 20, marginTop: 28,
    backgroundColor: C.fill, borderRadius: 16, padding: 16,
  },
  createRulesHeader: { alignItems: 'center', gap: 6, marginBottom: 12 },
  createRulesTitle: { fontSize: 13, fontWeight: '700', color: C.text },
  createRuleRow: { alignItems: 'flex-start', gap: 8, paddingVertical: 5 },
  createRuleText: { flex: 1, fontSize: 13, color: C.textMuted, lineHeight: 19 },
});
