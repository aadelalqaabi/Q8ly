import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Alert, Share, Platform, Modal, RefreshControl, Dimensions,
} from 'react-native';

const { width: SW } = Dimensions.get('window');
import { formatDistanceToNow } from 'date-fns';
import { getDateLocale } from '../../i18n';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { usersAPI, hachiAPI } from '../../services/api';
import ShareProfileCard from '../../components/ui/ShareProfileCard';
import Artifact from '../../components/Artifact';
import { useTheme } from '../../context/ThemeContext';
import { useGuestGate } from '../../context/GuestGateContext';

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

// Unified verified badge — one design for all verified account types
function VerifiedBadge({ badge, compact = false }) {
  if (!badge || badge === 'none') return null;
  if (compact) {
    // Inline checkmark circle used next to names in circles / chat
    return (
      <View style={{
        width: 15, height: 15, borderRadius: 8,
        backgroundColor: '#0033A0',
        justifyContent: 'center', alignItems: 'center', marginStart: 3,
      }}>
        <Ionicons name="checkmark" size={9} color="#fff" />
      </View>
    );
  }
  return (
    <View style={{
      backgroundColor: '#0033A0',
      borderRadius: 6,
      paddingHorizontal: 8, paddingVertical: 3,
      marginTop: 6, alignSelf: 'center',
      flexDirection: 'row', alignItems: 'center', gap: 4,
    }}>
      <Ionicons name="checkmark-circle" size={12} color="#fff" />
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
        KUWAI
      </Text>
    </View>
  );
}

const PALETTE = ['#0033A0', '#007A3D', '#FF6B35', '#2196F3', '#9C27B0', '#00BCD4', '#FF9800'];
function avatarBg(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// ── Artifact fullscreen modal ─────────────────────────────────────────────
function ArtifactModal({ item, onClose, isRTL, t }) {
  if (!item) return null;
  const visited = !!item.visited;
  const bg = visited ? '#000000' : '#F2F2F7';
  const fg = visited ? '#FFFFFF' : '#000000';
  const tag = visited
    ? (isRTL ? 'تم الفتح' : 'UNLOCKED')
    : (isRTL ? 'مغلق' : 'LOCKED');
  return (
    <Modal visible animationType="fade" presentationStyle="overFullScreen" transparent={false} onRequestClose={onClose}>
      <View style={[am.root, { backgroundColor: bg }]}>
        <View style={[am.topBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={[am.tagWrap, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={[am.tagDot, { backgroundColor: fg }]} />
            <Text style={[am.tag, { color: fg, letterSpacing: isRTL ? 0 : 2 }]}>{tag}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
            <Text style={[am.close, { color: fg, letterSpacing: isRTL ? 0 : 2 }]}>
              {isRTL ? 'إغلاق ←' : '× CLOSE'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={am.body}>
          <Text
            style={[
              am.name,
              { color: fg, textAlign: isRTL ? 'right' : 'left', letterSpacing: isRTL ? 0 : -3 },
            ]}
            numberOfLines={4}
            adjustsFontSizeToFit
            minimumFontScale={0.4}
          >
            {isRTL ? item.title : (item.title || '').toUpperCase()}
          </Text>
          <View style={[am.rule, { backgroundColor: fg }]} />
        </View>
      </View>
    </Modal>
  );
}

const am = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 40 },
  topBar: { justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  tagWrap: { alignItems: 'center', gap: 8 },
  tagDot: { width: 8, height: 8, borderRadius: 4 },
  tag: { fontSize: 11, fontWeight: '900' },
  close: { fontSize: 12, fontWeight: '900' },
  body: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 96, fontWeight: '900', lineHeight: 96 },
  rule: { height: 4, marginTop: 32, alignSelf: 'stretch' },
});

export default function ProfileScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useSelector((s) => s.auth);
  const unreadCount = useSelector((s) => s.notifications?.unreadCount || 0);
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS, isRTL), [COLORS, isRTL]);
  const { guestGate } = useGuestGate();

  const username = route.params?.username || currentUser?.username;
  const isOwnProfile = username === currentUser?.username;
  const isPushed = !!route.params?.username;


  const [profile, setProfile] = useState(isOwnProfile ? currentUser : null);
  const [circles, setCircles] = useState([]);
  const [pinnedIds, setPinnedIds] = useState([]);
  const [isLoading, setIsLoading] = useState(!isOwnProfile);
  const [circlesLoading, setCirclesLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isNotifyEnabled, setIsNotifyEnabled] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  // User's circle messages (activity)
  const [userMessages, setUserMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Vault — list of all venue circles + which ones the user has visited
  const [vault, setVault] = useState({ items: [], visitedCount: 0, totalCircles: 0, percentage: 0 });
  const [selectedArtifact, setSelectedArtifact] = useState(null);
  const loadVault = useCallback(async () => {
    if (!isOwnProfile) return;
    try {
      const res = await hachiAPI.getVault();
      setVault({
        items: res.items || [],
        visitedCount: res.visitedCount || 0,
        totalCircles: res.totalCircles || 0,
        percentage: res.percentage || 0,
      });
    } catch {}
  }, [isOwnProfile]);
  useEffect(() => { loadVault(); }, [loadVault]);

  // Refresh the vault every time the profile comes into focus — picks up
  // visits + new venues seeded by the admin without needing pull-to-refresh.
  useFocusEffect(useCallback(() => { loadVault(); }, [loadVault]));

  const loadUserMessages = useCallback(async () => {
    if (!username) return;
    setMessagesLoading(true);
    try {
      const res = await hachiAPI.getUserMessages(username);
      setUserMessages(res.messages || []);
    } catch { /* silent */ }
    finally { setMessagesLoading(false); }
  }, [username]);


  const loadProfile = useCallback(async () => {
    try {
      const res = await usersAPI.getProfile(username);
      setProfile(res.user);
      setIsFollowing(res.user.isFollowing || false);
      setIsNotifyEnabled(res.user.isNotifyEnabled || false);
      setIsBlocked(res.user.isBlocked || false);
    } catch (e) { console.error(e); }
  }, [username]);

  const loadCircles = useCallback(async () => {
    if (!profile?._id && !isOwnProfile) return;
    setCirclesLoading(true);
    try {
      // Own profile → authenticated endpoint (includes private circles).
      // Other profile → public endpoint filtered by creator ID.
      const res = isOwnProfile
        ? await hachiAPI.getMyCircles()
        : await hachiAPI.getRoomsByCreator(profile._id);
      const rooms = res.rooms || [];
      const pinned = (profile?.pinnedCircles || currentUser?.pinnedCircles || []).map(String);
      setPinnedIds(pinned);
      rooms.sort((a, b) => {
        const ap = pinned.includes(String(a._id)) ? 0 : 1;
        const bp = pinned.includes(String(b._id)) ? 0 : 1;
        return ap - bp;
      });
      setCircles(rooms);
    } catch (e) { console.error(e); }
    finally { setCirclesLoading(false); }
  }, [profile?._id, profile?.pinnedCircles, currentUser?.pinnedCircles, isOwnProfile]);

  useEffect(() => {
    const init = async () => {
      if (!isOwnProfile) setIsLoading(true);
      await loadProfile();
      setIsLoading(false);
    };
    init();
    navigation.setOptions({ headerShown: false });
  }, [username]);

  // Load circles and user messages once profile is ready
  useEffect(() => {
    if (profile?._id || isOwnProfile) {
      loadCircles();
      loadUserMessages();
    }
  }, [profile?._id]);


  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const doFollow = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setProfile((p) => ({ ...p, followersCount: (p.followersCount || 0) + (wasFollowing ? -1 : 1) }));
    try {
      const res = await usersAPI.toggleFollow(profile._id);
      setIsFollowing(res.following);
      setProfile((p) => ({ ...p, followersCount: res.followersCount }));
    } catch {
      setIsFollowing(wasFollowing);
      setProfile((p) => ({ ...p, followersCount: (p.followersCount || 0) + (wasFollowing ? 1 : -1) }));
    } finally {
      setFollowLoading(false);
    }
  };

  const handleToggleNotify = async () => {
    setIsNotifyEnabled((prev) => !prev);
    try {
      const res = await usersAPI.toggleNotifyPosts(profile._id);
      setIsNotifyEnabled(res.enabled);
    } catch {
      setIsNotifyEnabled((prev) => !prev);
    }
  };

  const handleFollow = () => {
    if (followLoading) return;
    if (isFollowing) {
      Alert.alert(t('profile.unfollowTitle', { username: profile?.username }), undefined,
        [{ text: t('common.cancel'), style: 'cancel' }, { text: t('profile.unfollow'), style: 'destructive', onPress: doFollow }],
        { cancelable: true }
      );
    } else {
      doFollow();
    }
  };

  const [shareCardVisible, setShareCardVisible] = useState(false);

  const handleShare = async () => {
    const url = `https://kuwai.app/profile/${profile?.username}`;
    try {
      await Share.share(Platform.OS === 'ios' ? { url } : { message: url });
    } catch { /* silent */ }
  };

  const handleBlock = () => {
    const actionKey = isBlocked ? 'profile.unblock' : 'profile.block';
    const action = t(actionKey);
    Alert.alert(
      t('profile.blockTitle', { action, username: profile?.username }),
      isBlocked ? undefined : t('profile.blockMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: action,
          style: isBlocked ? 'default' : 'destructive',
          onPress: async () => {
            try {
              const res = await usersAPI.toggleBlock(profile._id);
              setIsBlocked(res.blocked);
              if (res.blocked) setIsFollowing(false);
            } catch (e) {
              Alert.alert(t('common.error'), e.message || t('common.somethingWrong'));
            }
          },
        },
      ]
    );
  };

  const handleTogglePin = useCallback(async (roomId) => {
    const isPinned = pinnedIds.includes(String(roomId));
    if (!isPinned && pinnedIds.length >= 3) {
      Alert.alert(t('profile.pinLimitTitle'), t('profile.pinLimitMsg'));
      return;
    }
    try {
      if (isPinned) {
        await hachiAPI.unpinRoom(roomId);
        setPinnedIds(prev => prev.filter(id => id !== String(roomId)));
      } else {
        await hachiAPI.pinRoom(roomId);
        setPinnedIds(prev => [...prev, String(roomId)]);
      }
    } catch { /* silent */ }
  }, [pinnedIds]);

  // ── Header ──────────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <View>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        {profile?.profilePic ? (
          <Image source={{ uri: profile.profilePic }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: avatarBg(profile?.name) }]}>
            <Text style={styles.avatarInitial}>{profile?.name?.[0]?.toUpperCase() || '?'}</Text>
          </View>
        )}
      </View>

      {/* Name + username + verified */}
      <View style={styles.identity}>
        <Text style={styles.name} numberOfLines={1}>{profile?.name || ''}</Text>
        {profile?.verifiedBadge && profile.verifiedBadge !== 'none' && (
          <VerifiedBadge badge={profile.verifiedBadge} />
        )}
        {!!profile?.bio && (
          <Text style={styles.bio} numberOfLines={3}>{profile.bio}</Text>
        )}
      </View>

      {/* Vault stat — own profile only */}
      {isOwnProfile && vault.totalCircles > 0 && (
        <View style={styles.vaultStat}>
          <Text style={[styles.vaultStatNum, { color: COLORS.text }]}>{vault.percentage}%</Text>
          <Text style={[styles.vaultStatLabel, { color: COLORS.textMuted }]}>
            {t('profile.gridUnlocked')} · {vault.visitedCount}/{vault.totalCircles}
          </Text>
        </View>
      )}

      {/* Action */}
      <View style={styles.actionRow}>
        {isOwnProfile ? (
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.7} style={styles.editChip}>
              <Text style={styles.editChipText}>{t('profile.editProfile')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('RequestLocation', {})} activeOpacity={0.7} style={styles.editChip}>
              <Text style={styles.editChipText}>{t('radar.requestTitle')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.followRow}>
            <TouchableOpacity onPress={handleFollow} activeOpacity={0.75}
              style={isFollowing ? styles.followingChip : styles.followChip}>
              <Text style={isFollowing ? styles.followingChipText : styles.followChipText}>
                {followLoading ? '...' : isFollowing ? t('profile.following') : t('profile.follow')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleToggleNotify} style={styles.notifyBtn} activeOpacity={0.7}>
              <Ionicons name={isNotifyEnabled ? 'notifications' : 'notifications-outline'} size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  // ── Circle card (2-column grid) ───────────────────────────────────────────────
  const renderCircleItem = useCallback(({ item: room }) => {
    const isPinned = pinnedIds.includes(String(room._id));
    const catIcon = CATEGORY_ICONS[room.category] || 'chatbubbles-outline';
    const isActive = room.isActive !== false;

    const handleLongPress = isOwnProfile ? () => {
      Alert.alert(room.title, undefined, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: isPinned ? t('profile.unpin') : t('profile.pin'),
          onPress: () => handleTogglePin(room._id),
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(t('profile.deleteCircle'), t('profile.deleteCircleMsg'), [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('common.delete'),
                style: 'destructive',
                onPress: async () => {
                  try {
                    await hachiAPI.deleteRoom(room._id);
                    setCircles((prev) => prev.filter((r) => r._id !== room._id));
                  } catch (e) {
                    Alert.alert(t('common.error'), e.message || t('common.somethingWrong'));
                  }
                },
              },
            ]);
          },
        },
      ]);
    } : undefined;

    return (
      <TouchableOpacity
        style={styles.circleRow}
        onPress={() => navigation.navigate('HachiRoom', { roomId: room._id })}
        onLongPress={handleLongPress}
        delayLongPress={400}
        activeOpacity={0.7}
      >
        <View style={[styles.circleRowIcon, { backgroundColor: COLORS.fill }]}>
          <Ionicons name={catIcon} size={18} color={COLORS.textMuted} />
        </View>
        <View style={styles.circleRowBody}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={[styles.circleRowTitle, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>{room.title}</Text>
            {isPinned && <Ionicons name="pin" size={11} color={COLORS.accent} />}
          </View>
          <View style={styles.circleRowMeta}>
            <View style={[styles.circleRowDot, { backgroundColor: isActive ? '#34C759' : COLORS.separator }]} />
            <Text style={[styles.circleRowStatus, { color: isActive ? '#34C759' : COLORS.textMuted }]}>
              {isActive ? t('hachi.liveBadge') : t('hachi.endedBadge')}
            </Text>
            <Text style={styles.circleRowSep}>·</Text>
            <Text style={styles.circleRowCount}>{room.memberCount || 1} {t('profile.membersLabel')}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [pinnedIds, handleTogglePin, t, COLORS, navigation, isOwnProfile]);

  const renderActivityItem = useCallback(({ item: msg }) => {
    const timeAgo = msg.createdAt
      ? formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: getDateLocale() })
      : '';
    const catIcon = CATEGORY_ICONS[msg.roomCategory] || 'chatbubbles-outline';
    return (
      <TouchableOpacity
        style={styles.activityRow}
        onPress={() => navigation.navigate('HachiRoom', { roomId: msg.roomId, title: msg.roomTitle })}
        activeOpacity={0.7}
      >
        <View style={[styles.activityRowIcon, { backgroundColor: COLORS.fill }]}>
          <Ionicons name={catIcon} size={18} color={COLORS.textMuted} />
        </View>
        <View style={styles.activityRowBody}>
          {!!msg.text && <Text style={styles.activityRowText} numberOfLines={2}>{msg.text}</Text>}
          {!!msg.image && !msg.text && <Text style={styles.activityRowText} numberOfLines={1}>📷 Photo</Text>}
          <View style={styles.activityRowMeta}>
            <Text style={styles.activityRowCircle} numberOfLines={1}>{msg.roomTitle}</Text>
            <Text style={styles.activityRowSep}>·</Text>
            <Text style={styles.activityRowTime}>{timeAgo}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [COLORS, navigation]);

  if (isLoading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  const renderVaultGrid = () => {
    const cellSize = (SW - 32 - 18) / 4;
    const rows = [];
    for (let i = 0; i < vault.items.length; i += 4) {
      rows.push(vault.items.slice(i, i + 4));
    }
    return (
      <View style={{ paddingHorizontal: 16 }}>
        <Text style={[styles.vaultSectionTitle, { color: COLORS.textMuted, textAlign: isRTL ? 'right' : 'left' }]}>
          {t('profile.theVault')}
        </Text>
        {vault.items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: COLORS.textMuted }]}>{t('profile.noVaultYet')}</Text>
          </View>
        ) : (
          rows.map((row, ri) => (
            <View key={ri} style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              {row.map((item) => (
                <TouchableOpacity
                  key={item._id}
                  style={styles.vaultCell}
                  activeOpacity={0.75}
                  onPress={() => setSelectedArtifact(item)}
                >
                  <Artifact id={item._id} title={item.title} stampUrl={item.stampUrl} size={cellSize} locked={!item.visited} />
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Nav */}
      <View style={[styles.navRow, { paddingTop: insets.top + 12, backgroundColor: COLORS.background, borderBottomColor: COLORS.separator }]}>
        <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={[styles.navLink, { color: COLORS.text }]}>{isRTL ? `${t('common.back')} ›` : `‹ ${t('common.back')}`}</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 16 }}>
          {isOwnProfile && (
            <TouchableOpacity onPress={() => navigation.navigate('Notifications')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={[styles.navLink, { color: COLORS.accent }]}>
                {t('profile.inbox')}{unreadCount > 0 ? ` · ${unreadCount > 99 ? '99+' : unreadCount}` : ''}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleShare} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.navLink, { color: COLORS.textMuted }]}>{t('common.share')}</Text>
          </TouchableOpacity>
          {isOwnProfile && (
            <TouchableOpacity onPress={() => navigation.navigate('Settings')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={[styles.navLink, { color: COLORS.textMuted }]}>{t('settings.title')}</Text>
            </TouchableOpacity>
          )}
          {isPushed && !isOwnProfile && (
            <TouchableOpacity onPress={handleBlock} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={[styles.navLink, { color: COLORS.error }]}>{isBlocked ? t('profile.blocked') : '···'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Non-own profile: header only */}
      {!isOwnProfile && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          {renderHeader()}
        </ScrollView>
      )}

      {/* Own profile: header + vault grid */}
      {isOwnProfile && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await Promise.all([loadProfile(), loadVault()]); setRefreshing(false); }}
              tintColor={COLORS.accent}
              colors={[COLORS.accent]}
            />
          }
        >
          {renderHeader()}
          {renderVaultGrid()}
        </ScrollView>
      )}

      {/* Artifact detail — fullscreen brutalist expand */}
      <ArtifactModal
        item={selectedArtifact}
        onClose={() => setSelectedArtifact(null)}
        isRTL={isRTL}
        t={t}
      />


      <ShareProfileCard
        visible={shareCardVisible}
        onClose={() => setShareCardVisible(false)}
        profile={profile}
      />
    </View>
  );
}

const makeStyles = (C, isRTL = false) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  loader: { flex: 1, backgroundColor: C.background, justifyContent: 'center', alignItems: 'center' },

  navRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navLink: { fontSize: 15, fontWeight: '600' },
  navBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  notifBadge: { position: 'absolute', top: 4, end: 4, backgroundColor: '#FF3B30', borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  notifBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  avatarSection: { alignItems: 'center', paddingTop: 8, paddingBottom: 16 },
  avatar: { width: 104, height: 104, borderRadius: 52, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 38, fontWeight: '700', color: '#fff' },

  identity: { alignItems: 'center', paddingHorizontal: 32, paddingBottom: 20, gap: 4 },
  name: { fontSize: 22, fontWeight: '700', color: C.text, textAlign: 'center' },
  username: { fontSize: 14, fontWeight: '400', textAlign: 'center' },
  bio: { fontSize: 14, color: C.textMuted, lineHeight: 20, textAlign: 'center', marginTop: 4 },

  vaultStat: { alignItems: 'center', paddingBottom: 20, gap: 2 },
  vaultStatNum: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
  vaultStatLabel: { fontSize: 12, fontWeight: '400' },

  actionRow: { alignItems: 'center', paddingBottom: 20 },
  editChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: C.separator, backgroundColor: C.fill },
  editChipText: { fontSize: 13, fontWeight: '500', color: C.textMuted },
  followRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  followChip: { paddingHorizontal: 36, paddingVertical: 10, borderRadius: 22, backgroundColor: C.accent },
  followChipText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  followingChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: C.separator, backgroundColor: C.fill },
  followingChipText: { fontSize: 13, fontWeight: '500', color: C.textMuted },

  // ── Tab bar ───────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.separator,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
  },
  tabItem: {
    flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative',
  },
  tabLabel: { fontSize: 14, fontWeight: '600', color: C.textMuted },
  tabLabelActive: { color: C.text },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: '20%', right: '20%',
    height: 2, borderRadius: 1, backgroundColor: C.accent,
  },

  // ── Circle rows ──────────────────────────────────────────────────────────
  circleRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  circleRowIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  circleRowBody: { flex: 1 },
  circleRowTitle: { fontSize: 15, fontWeight: '600', color: C.text },
  circleRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  circleRowDot: { width: 5, height: 5, borderRadius: 2.5 },
  circleRowStatus: { fontSize: 12, fontWeight: '600' },
  circleRowSep: { fontSize: 12, color: C.textMuted },
  circleRowCount: { fontSize: 12, color: C.textMuted },

  empty: { paddingTop: 48, alignItems: 'center', paddingHorizontal: 40 },

  // Vault
  vaultSectionTitle: { fontSize: 13, fontWeight: '500', paddingTop: 8, paddingBottom: 12 },
  vaultCell: {
    margin: 3,
  },

  emptyText: { fontSize: 15, color: C.textMuted, textAlign: 'center' },

  // ── Activity rows ──────────────────────────────────────────────────────
  activityRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  activityRowIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  activityRowBody: { flex: 1 },
  activityRowText: { fontSize: 15, fontWeight: '400', color: C.text, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' },
  activityRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  activityRowCircle: { fontSize: 13, fontWeight: '500', color: C.textMuted, flexShrink: 1 },
  activityRowSep: { fontSize: 12, color: C.textMuted },
  activityRowTime: { fontSize: 12, color: C.textMuted },

});
