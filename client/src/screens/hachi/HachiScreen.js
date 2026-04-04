import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, KeyboardAvoidingView,
  Platform, ScrollView, Dimensions,
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

const { width: SW } = Dimensions.get('window');
const HOT_CARD_W   = SW * 0.72;
const HACHI_REQUIRED = 50;

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

function heatColor(count) {
  if (count >= 25) return '#FF3B30';
  if (count >= 10) return '#FF9500';
  if (count >= 4)  return '#34C759';
  return null;
}

function relTime(date) {
  if (!date) return '';
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: getDateLocale() });
}

// ── HotCard ────────────────────────────────────────────────────────────────────

function HotCard({ room, onPress, styles, C, t }) {
  const heat   = heatColor(room.memberCount || 1);
  const heatBg = heat ? heat + '15' : C.fill;
  const catIcon = CATEGORY_ICONS[room.category] || 'chatbubbles-outline';
  const msgCount = room.messageCount || 0;

  return (
    <TouchableOpacity style={styles.hotCard} onPress={onPress} activeOpacity={0.78}>
      {/* Top row: category + member count */}
      <View style={styles.hotTop}>
        <View style={styles.hotCatBadge}>
          <Ionicons name={catIcon} size={12} color={C.textMuted} />
          <Text style={[styles.hotCatLabel, { color: C.textMuted }]}>
            {t(`hachi.cat${(room.category || 'general').charAt(0).toUpperCase()}${(room.category || 'general').slice(1)}`)}
          </Text>
        </View>
        <View style={[styles.hotCount, { backgroundColor: heatBg }]}>
          {heat && <View style={[styles.liveDot, { backgroundColor: heat }]} />}
          <Ionicons name="people" size={11} color={heat || C.textMuted} />
          <Text style={[styles.hotCountNum, { color: heat || C.textMuted }]}>
            {room.memberCount || 1}
          </Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.hotTitle} numberOfLines={2}>{room.title}</Text>

      {/* Last message preview or creator */}
      <View style={styles.hotPreviewRow}>
        {room.lastMessage?.text ? (
          <Text style={styles.hotPreview} numberOfLines={1}>{room.lastMessage.text}</Text>
        ) : (
          <>
            <Text style={styles.hotPreviewName} numberOfLines={1}>{room.creator?.name || ''}</Text>
            <Text style={styles.hotPreviewSep}> · </Text>
            <Text style={styles.hotPreviewTime} numberOfLines={1}>{relTime(room.createdAt)}</Text>
          </>
        )}
      </View>

      {/* Stats row */}
      <View style={styles.hotStats}>
        <View style={styles.hotStatItem}>
          <Ionicons name="chatbubble" size={10} color={C.textMuted} />
          <Text style={styles.hotStatText}>{msgCount}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── RoomRow ────────────────────────────────────────────────────────────────────

function RoomRow({ room, onPress, styles, C, t }) {
  const catIcon  = CATEGORY_ICONS[room.category] || 'chatbubbles-outline';
  const msgCount = room.messageCount || 0;
  const members  = room.memberCount || 1;
  const hasLastMsg = !!room.lastMessage?.text;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowIcon, { backgroundColor: C.fill }]}>
        <Ionicons name={catIcon} size={20} color={C.textMuted} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>{room.title}</Text>
        <View style={styles.rowSubRow}>
          {hasLastMsg ? (
            <>
              {msgCount > 0 && <Text style={styles.rowSubMuted}>{msgCount}</Text>}
              {msgCount > 0 && <Text style={styles.rowSubMuted}> · </Text>}
              <Text style={styles.rowSubText} numberOfLines={1}>{room.lastMessage.text}</Text>
            </>
          ) : (
            <>
              <Text style={styles.rowSubText} numberOfLines={1}>{room.creator?.name || ''}</Text>
              <Text style={styles.rowSubMuted}> · </Text>
              <Text style={styles.rowSubMuted} numberOfLines={1}>{relTime(room.updatedAt || room.createdAt)}</Text>
            </>
          )}
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
  const pct = Math.min((points / HACHI_REQUIRED) * 100, 100);
  const rows = [
    { icon: 'create-outline',     label: t('hachi.lockEarnPost'),     pts: '+2' },
    { icon: 'heart-outline',      label: t('hachi.lockEarnLike'),     pts: '+1' },
    { icon: 'person-add-outline', label: t('hachi.lockEarnFollower'), pts: '+3' },
    { icon: 'chatbubble-outline', label: t('hachi.lockEarnComment'),  pts: '+1' },
  ];
  return (
    <View style={styles.lockedWrap}>
      <View style={styles.lockCircle}>
        <Ionicons name="lock-closed" size={28} color={C.accent} />
      </View>
      <Text style={styles.lockTitle}>{t('hachi.lockTitle')}</Text>
      <Text style={styles.lockSub}>{t('hachi.lockDesc', { count: HACHI_REQUIRED })}</Text>
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
  const { rooms, moments, isLoading } = useSelector((s) => s.hachi);
  const { user: currentUser } = useSelector((s) => s.auth);
  const { unreadCount } = useSelector((s) => s.notifications);
  const { colors: C, isDark } = useTheme();
  const { guestGate } = useGuestGate();

  const styles = useMemo(() => makeStyles(C, isDark, isRTL), [C, isDark, isRTL]);

  const hachiPoints = currentUser?.hachiPoints || 0;
  const hasBadge    = currentUser?.verifiedBadge && currentUser.verifiedBadge !== 'none';
  const canCreate   = hasBadge || hachiPoints >= HACHI_REQUIRED;

  const CATEGORIES = CATEGORY_KEYS.map((key) => ({
    key,
    icon: CATEGORY_ICONS[key],
    label: t(`hachi.cat${key.charAt(0).toUpperCase()}${key.slice(1)}`),
  }));

  const [showCreate,  setShowCreate]  = useState(false);
  const [showLocked,  setShowLocked]  = useState(false);
  const [newTitle,    setNewTitle]    = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [creating,    setCreating]    = useState(false);

  useEffect(() => {
    dispatch(fetchRooms());
  }, []);

  useEffect(() => {
    dispatch(fetchMoments());
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onNewRoom = (room) => dispatch(addRoomRealtime(room));
    socket.on('hachiNewRoom', onNewRoom);
    return () => { socket.off('hachiNewRoom', onNewRoom); };
  }, []);

  // Hot circles: top 3 by memberCount ≥ 2
  const hotRooms = useMemo(
    () => rooms.filter((r) => (r.memberCount || 1) >= 2).slice(0, 3),
    [rooms]
  );

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      const result = await dispatch(
        createRoom({ title: newTitle.trim(), category: newCategory, isPublic: true })
      ).unwrap();
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

  const goToRoom = (room) =>
    guestGate(() => navigation.navigate('HachiRoom', { roomId: room._id, title: room.title }));

  // FlatList header: escaped moments + most active circles
  const ListHeader = useMemo(() => {
    const hasMoments = moments?.length > 0;
    const hasHot = hotRooms.length > 0;
    if (!hasMoments && !hasHot) return null;
    return (
      <View>
        {/* Escaped pinned moments */}
        {hasMoments && (
          <>
            <View style={styles.sectionHeader}>
              <Ionicons name="pin" size={14} color={C.accent} />
              <Text style={styles.sectionTitle}>{t('hachi.moments')}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hotScroll}
              decelerationRate="fast"
              snapToInterval={HOT_CARD_W + 12}
              snapToAlignment="start"
            >
              {moments.map((m) => (
                <MomentCard
                  key={m._id}
                  moment={m}
                  onPress={() => guestGate(() => navigation.navigate('HachiRoom', { roomId: m.roomId, title: m.roomTitle }))}
                  styles={styles}
                  C={C}
                  t={t}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* Hot circles */}
        {hasHot && (
          <>
            <View style={[styles.sectionHeader, hasMoments && { marginTop: 8 }]}>
              <Text style={styles.sectionEmoji}>🔥</Text>
              <Text style={styles.sectionTitle}>{t('hachi.mostActive')}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hotScroll}
              decelerationRate="fast"
              snapToInterval={HOT_CARD_W + 12}
              snapToAlignment="start"
            >
              {hotRooms.map((room) => (
                <HotCard
                  key={room._id}
                  room={room}
                  onPress={() => goToRoom(room)}
                  styles={styles}
                  C={C}
                  t={t}
                />
              ))}
            </ScrollView>
          </>
        )}

        {rooms.length > 0 && (
          <View style={[styles.sectionHeader, { marginTop: 8 }]}>
            <Text style={styles.sectionEmoji}>💬</Text>
            <Text style={styles.sectionTitle}>{t('hachi.allCircles')}</Text>
          </View>
        )}
      </View>
    );
  }, [moments, hotRooms, rooms.length, styles, C]);

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
          data={rooms}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <RoomRow room={item} onPress={() => goToRoom(item)} styles={styles} C={C} t={t} />
          )}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}
          refreshing={isLoading}
          onRefresh={() => { dispatch(fetchRooms()); dispatch(fetchMoments()); }}
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
        onRequestClose={() => setShowCreate(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
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
                : <Text style={styles.startBtnText}>{t('hachi.start')}</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>{t('hachi.topicPrompt')}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={t('hachi.topicPlaceholder')}
                placeholderTextColor={C.textMuted}
                value={newTitle}
                onChangeText={setNewTitle}
                maxLength={80}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreate}
                textAlign={isRTL ? 'right' : 'left'}
              />
              <Text style={styles.charCount}>{newTitle.length}/80</Text>
            </View>

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
                      <Ionicons name={cat.icon} size={16} color={selected ? C.accent : C.textMuted} />
                      <Text style={[styles.catPillLabel, selected && styles.catPillLabelSelected]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.rulesCard}>
              <View style={styles.rulesHeader}>
                <Ionicons name="shield-checkmark" size={16} color={C.accent} />
                <Text style={styles.rulesTitle}>{t('hachi.rulesTitle')}</Text>
              </View>
              {[
                { icon: 'heart-outline',      text: t('hachi.rule1') },
                { icon: 'chatbubble-outline', text: t('hachi.rule2') },
                { icon: 'eye-off-outline',    text: t('hachi.rule3') },
                { icon: 'person-outline',     text: t('hachi.rule4') },
              ].map((rule) => (
                <View key={rule.text} style={styles.ruleRow}>
                  <Ionicons name={rule.icon} size={14} color={C.textMuted} />
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  notifBadge: {
    position: 'absolute', top: 2, end: 2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: C.accent, borderWidth: 1.5, borderColor: C.white,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', lineHeight: 11 },

  // Section headers
  sectionHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10,
  },
  sectionEmoji: { fontSize: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, color: C.text },

  // Hot cards
  hotScroll: { paddingHorizontal: 16, gap: 12, paddingBottom: 6 },
  hotCard: {
    width: HOT_CARD_W,
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: isDark ? 0.45 : 0.06,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? C.separator : 'rgba(0,0,0,0.04)',
  },
  hotTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hotCatBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.fill, borderRadius: 12,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  hotCatLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  hotCount: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: C.fill,
  },
  hotCountNum: { fontSize: 14, fontWeight: '800' },
  hotCountLabel: { fontSize: 12, fontWeight: '500' },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  hotTitle: { fontSize: 17, fontWeight: '700', lineHeight: 23, letterSpacing: -0.3, color: C.text },
  hotPreviewRow: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  hotPreview: { fontSize: 13, color: C.textMuted, lineHeight: 18, flex: 1 },
  hotPreviewName: { fontSize: 13, color: C.text, fontWeight: '500', flexShrink: 1 },
  hotPreviewSep: { fontSize: 13, color: C.textMuted },
  hotPreviewTime: { fontSize: 13, color: C.textMuted, flexShrink: 0 },
  hotStats: { flexDirection: 'row', gap: 14, marginTop: 4 },
  hotStatItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hotStatText: { fontSize: 11, color: C.textMuted, fontWeight: '600' },

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
  rowMeta: { alignItems: 'flex-end', gap: 1, flexShrink: 0 },
  rowMetaNum: { fontSize: 15, fontWeight: '700', color: C.text },
  rowMetaLabel: { fontSize: 11, color: C.textMuted },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginStart: 72 },

  // Moment cards (escaped pinned messages)
  momentCard: {
    width: HOT_CARD_W,
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

  // Modals
  modalContainer: { flex: 1, backgroundColor: C.white },
  modalHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
  },
  modalCancel: { fontSize: 17, color: C.accent, minWidth: 60 },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: C.text, textAlign: 'center' },
  startBtn: {
    backgroundColor: C.accent, borderRadius: 20,
    paddingHorizontal: 16, height: 34,
    justifyContent: 'center', alignItems: 'center', minWidth: 60,
  },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  modalSection: { paddingHorizontal: 20, paddingTop: 22 },
  modalLabel: { fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 12 },
  modalInput: {
    fontSize: 17, color: C.text, backgroundColor: C.fill,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 52,
  },
  charCount: { fontSize: 12, color: C.textMuted, marginTop: 6 },
  catPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
    backgroundColor: C.fill, borderWidth: 1.5, borderColor: 'transparent',
  },
  catPillSelected: { backgroundColor: isDark ? '#1A2A4A' : '#EEF2FA', borderColor: C.accent },
  catPillLabel: { fontSize: 14, fontWeight: '500', color: C.textMuted },
  catPillLabelSelected: { color: C.accent, fontWeight: '600' },
  rulesCard: {
    marginHorizontal: 20, marginTop: 24, marginBottom: 32,
    backgroundColor: C.fill, borderRadius: 14, padding: 16,
  },
  rulesHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  rulesTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  ruleRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 5 },
  ruleText: { flex: 1, fontSize: 13, color: C.textMuted, lineHeight: 19 },
});
