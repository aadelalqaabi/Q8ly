import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
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

function fmt(n) {
  if (!n) return '0';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

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

  const flatListRef = useRef(null);
  const tabScrollRef = useRef(null);

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

  // Followers / Following modal
  const [listModal, setListModal] = useState(null);
  const [listData, setListData] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  const openList = useCallback(async (type) => {
    setListModal(type);
    setListLoading(true);
    setListData([]);
    try {
      const res = type === 'followers'
        ? await usersAPI.getFollowers(profile?.username)
        : await usersAPI.getFollowing(profile?.username);
      setListData(res.users || []);
    } catch { /* silent */ } finally {
      setListLoading(false);
    }
  }, [profile?.username]);

  const handleUnfollow = useCallback(async (userId) => {
    try {
      await usersAPI.toggleFollow(userId);
      setListData(prev => prev.filter(u => u._id !== userId));
      setProfile(prev => prev ? { ...prev, followingCount: Math.max(0, (prev.followingCount || 1) - 1) } : prev);
    } catch { /* silent */ }
  }, []);

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

  useEffect(() => {
    return navigation.addListener('tabPress', () => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
  }, [navigation]);

  const [activeTab, setActiveTab] = useState('circles');
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
    <View style={styles.headerWrap}>
      {/* Massive name — brutalist headline */}
      <Text
        style={[styles.brutName, { textAlign: isRTL ? 'right' : 'left' }]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {isRTL ? (profile?.name || '') : (profile?.name || '').toUpperCase()}
      </Text>
      {profile?.verifiedBadge && profile.verifiedBadge !== 'none' && (
        <Text style={[styles.brutVerifiedTag, { textAlign: isRTL ? 'right' : 'left' }]}>
          ● {t('profile.kuwaiVerified')}
        </Text>
      )}

      {/* Actions — brutalist typographic buttons (only for own profile) */}
      {isOwnProfile && (
        <View style={[styles.brutActionRow, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
          <TouchableOpacity onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.6} style={{ paddingVertical: 6 }}>
            <Text style={styles.brutAction}>
              {isRTL ? `← ${t('profile.editProfile')}` : `${t('profile.editProfile').toUpperCase()} →`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('RequestLocation', {})} activeOpacity={0.6} style={{ paddingVertical: 6 }}>
            <Text style={styles.brutAction}>
              {isRTL ? `← ${t('radar.requestTitle')}` : `${t('radar.requestTitle').toUpperCase()} →`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Hard rule */}
      <View style={styles.brutRule} />
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

  const TABS = [
    { key: 'circles',  label: t('profile.circles') },
    { key: 'activity', label: t('profile.activity') },
  ];

  const goToTab = (index) => {
    setActiveTab(TABS[index].key);
    tabScrollRef.current?.scrollTo({ x: SW * index, animated: true });
  };

  return (
    <View style={styles.container}>
      {/* Brutalist nav row — bare typographic links */}
      <View style={[styles.brutNavRow, { paddingTop: insets.top + 14, backgroundColor: COLORS.white }]}>
        <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.brutNavLink}>{isRTL ? `${t('common.back')} →` : `← ${t('common.back').toUpperCase()}`}</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 18 }}>
          {isOwnProfile && (
            <TouchableOpacity onPress={() => navigation.navigate('Notifications')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.brutNavLink}>
                {isRTL ? t('profile.inbox') : t('profile.inbox').toUpperCase()}{unreadCount > 0 ? ` · ${unreadCount > 99 ? '99+' : unreadCount}` : ''}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleShare} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.brutNavLink}>{isRTL ? t('common.share') : t('common.share').toUpperCase()}</Text>
          </TouchableOpacity>
          {isOwnProfile && (
            <TouchableOpacity onPress={() => navigation.navigate('Settings')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.brutNavLink}>{isRTL ? t('settings.title') : t('settings.title').toUpperCase()}</Text>
            </TouchableOpacity>
          )}
          {isPushed && !isOwnProfile && (
            <TouchableOpacity onPress={handleBlock} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.brutNavLink}>{isBlocked ? (isRTL ? t('profile.blocked') : t('profile.blocked').toUpperCase()) : '···'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Non-own profile: just the header, no vault */}
      {!isOwnProfile && (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {renderHeader()}
        </ScrollView>
      )}

      {/* Vault (header is rendered inside via ListHeaderComponent) */}
      {isOwnProfile && (
        <FlatList
          data={vault.items}
          keyExtractor={(item) => item._id}
          numColumns={4}
          columnWrapperStyle={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}
          ListHeaderComponent={
            <View>
              {renderHeader()}
              <View style={[styles.vaultHeader, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                <Text style={styles.vaultPercent}>{vault.percentage}%</Text>
                <Text style={[styles.vaultLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {isRTL ? t('profile.gridUnlocked') : t('profile.gridUnlocked').toUpperCase()}
                </Text>
                <Text style={[styles.vaultMeta, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {vault.visitedCount} / {vault.totalCircles} · {isRTL ? t('profile.theVault') : t('profile.theVault').toUpperCase()}
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.vaultCell}>
              <Artifact id={item._id} title={item.title} size={(SW - 32 - 18) / 4} locked={!item.visited} />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('profile.noVaultYet')}</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await Promise.all([loadProfile(), loadVault()]); setRefreshing(false); }}
              tintColor={COLORS.accent}
              colors={[COLORS.accent]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Followers / Following modal */}
      <Modal
        visible={!!listModal}
        transparent
        animationType="slide"
        onRequestClose={() => setListModal(null)}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setListModal(null)} />
        <View style={[styles.modalSheet, { backgroundColor: COLORS.white }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: COLORS.text }]}>
              {listModal === 'followers' ? t('profile.followers') : t('profile.followingPl')}
            </Text>
            <TouchableOpacity onPress={() => setListModal(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {listLoading ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={COLORS.accent} />
          ) : (
            <FlatList
              data={listData}
              keyExtractor={item => item._id}
              renderItem={({ item }) => (
                <View style={[styles.userRow, { borderBottomColor: COLORS.separator }]}>
                  <TouchableOpacity
                    style={styles.userRowLeft}
                    onPress={() => { setListModal(null); navigation.navigate('ProfileDetail', { username: item.username }); }}
                    activeOpacity={0.7}
                  >
                    {item.profilePic ? (
                      <Image source={{ uri: item.profilePic }} style={styles.userRowAvatar} />
                    ) : (
                      <View style={[styles.userRowAvatar, { backgroundColor: avatarBg(item.name) }]}>
                        <Text style={styles.userRowInitial}>{item.name?.[0]?.toUpperCase() || '?'}</Text>
                      </View>
                    )}
                    <View>
                      <Text style={[styles.userRowName, { color: COLORS.text }]} numberOfLines={1}>{item.name}</Text>
                      <Text style={[styles.userRowUsername, { color: COLORS.textMuted }]}>@{item.username}</Text>
                    </View>
                  </TouchableOpacity>
                  {listModal === 'following' && (
                    <TouchableOpacity
                      style={[styles.unfollowBtn, { borderColor: COLORS.separator }]}
                      onPress={() => handleUnfollow(item._id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.unfollowText, { color: COLORS.text }]}>{t('profile.following')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: COLORS.textMuted, marginTop: 32 }]}>
                  {listModal === 'followers' ? t('profile.noFollowers') : t('profile.noFollowing')}
                </Text>
              }
            />
          )}
        </View>
      </Modal>

      <ShareProfileCard
        visible={shareCardVisible}
        onClose={() => setShareCardVisible(false)}
        profile={profile}
      />
    </View>
  );
}

const makeStyles = (C, isRTL = false) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.white },
  loader: { flex: 1, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center' },

  navRow: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 4 },
  navBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  notifBadge: { position: 'absolute', top: 4, end: 4, backgroundColor: '#FF3B30', borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  notifBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  avatarSection: { alignItems: 'center', paddingTop: 8, paddingBottom: 16 },
  avatar: { width: 104, height: 104, borderRadius: 52, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 38, fontWeight: '700', color: '#fff' },

  identity: { alignItems: 'center', paddingHorizontal: 32, paddingBottom: 20, gap: 4 },
  name: { fontSize: 24, fontWeight: '800', color: C.text, textAlign: 'center' },
  bio: { fontSize: 14, color: C.text, lineHeight: 20, textAlign: 'center', marginTop: 6 },

  statsRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: 20, gap: 16 },
  stat: { alignItems: 'center', gap: 2, minWidth: 60 },
  statNum: { fontSize: 17, fontWeight: '700', color: C.text, textAlign: 'center' },
  statLabel: { fontSize: 11, color: C.textMuted, fontWeight: '400', textAlign: 'center' },
  statDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.separator, marginBottom: 10 },

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
    height: 2, borderRadius: 1, backgroundColor: C.text,
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
  vaultHeader: { paddingTop: 28, paddingBottom: 18, paddingHorizontal: 0, alignItems: 'flex-start' },
  vaultPercent: {
    fontSize: 96, fontWeight: '900', color: C.text,
    lineHeight: 96, letterSpacing: -4,
  },
  vaultLabel: {
    fontSize: 11, fontWeight: '800', color: C.textMuted,
    letterSpacing: isRTL ? 0 : 2, marginTop: 2,
  },
  vaultMeta: {
    fontSize: 11, fontWeight: '700', color: C.textMuted,
    letterSpacing: isRTL ? 0 : 1.5, marginTop: 18,
  },
  vaultCell: {
    margin: 3,
  },

  // ── Brutalist nav + header ─────────────────────────────────────────────────
  brutNavRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  brutNavLink: {
    fontSize: 11, fontWeight: '900',
    color: C.text, letterSpacing: isRTL ? 0 : 1.5,
  },

  headerWrap: { paddingHorizontal: 4, paddingTop: 8 },
  brutName: {
    fontSize: 56, fontWeight: '900', color: C.text,
    lineHeight: 64, letterSpacing: isRTL ? 0 : -2,
  },
  brutVerifiedTag: {
    fontSize: 10, fontWeight: '900', color: C.accent,
    letterSpacing: isRTL ? 0 : 2, marginTop: 8,
  },
  brutBio: {
    fontSize: 14, fontWeight: '500', color: C.textMuted,
    lineHeight: 20, marginTop: 14, maxWidth: '90%',
  },
  brutActionRow: { marginTop: 22 },
  brutAction: {
    fontSize: 13, fontWeight: '900', color: C.text,
    letterSpacing: isRTL ? 0 : 2,
  },
  brutRule: {
    height: 2, backgroundColor: C.text,
    marginTop: 24, marginBottom: 0,
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

  // ── Followers/Following modal ─────────────────────────────────────────────
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '75%', paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  userRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  userRowAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  userRowInitial: { fontSize: 17, fontWeight: '700', color: '#fff' },
  userRowName: { fontSize: 15, fontWeight: '600' },
  userRowUsername: { fontSize: 13, marginTop: 1 },
  unfollowBtn: {
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 7, marginLeft: 8,
  },
  unfollowText: { fontSize: 13, fontWeight: '600' },
});
