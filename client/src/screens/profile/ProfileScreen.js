import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Alert, Share, Platform, Modal, RefreshControl,
} from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { getDateLocale } from '../../i18n';
import { Swipeable } from 'react-native-gesture-handler';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { usersAPI, hachiAPI } from '../../services/api';
import ShareProfileCard from '../../components/ui/ShareProfileCard';
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

const BADGE_COLORS = {
  government: '#0033A0',
  media:      '#D97706',
  business:   '#16A34A',
  influencer: '#7C3AED',
  founder:    '#0033A0',
};
const BADGE_KEYS = {
  government: 'badge.official',
  media:      'badge.media',
  business:   'badge.business',
  influencer: 'badge.influencer',
  founder:    'badge.founder',
};

function VerifiedBadge({ badge }) {
  const { t } = useTranslation();
  if (!badge || badge === 'none') return null;
  const color = BADGE_COLORS[badge];
  const key = BADGE_KEYS[badge];
  if (!color || !key) return null;
  const isFounder = badge === 'founder';
  return (
    <View style={{
      backgroundColor: color,
      borderRadius: 4,
      paddingHorizontal: isFounder ? 6 : 5,
      paddingVertical: 2,
      marginTop: 6,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: isFounder ? 3 : 0,
    }}>
      {isFounder && <Text style={{ color: '#FFD700', fontSize: 8, lineHeight: 10 }}>★</Text>}
      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>
        {t(key).toUpperCase()}
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

      {/* Identity */}
      <View style={styles.identity}>
        <Text style={styles.name}>{profile?.name}</Text>
        <VerifiedBadge badge={profile?.verifiedBadge} />
        {!!profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{fmt(circles.length)}</Text>
          <Text style={styles.statLabel}>{t('profile.circles')}</Text>
        </View>
        <View style={styles.statDot} />
        <TouchableOpacity
          style={styles.stat}
          onPress={isOwnProfile ? () => openList('followers') : undefined}
          activeOpacity={isOwnProfile ? 0.7 : 1}
        >
          <Text style={styles.statNum}>{fmt(profile?.followersCount)}</Text>
          <Text style={[styles.statLabel, isOwnProfile && { color: COLORS.accent }]}>{t('profile.followers')}</Text>
        </TouchableOpacity>
        <View style={styles.statDot} />
        <TouchableOpacity
          style={styles.stat}
          onPress={isOwnProfile ? () => openList('following') : undefined}
          activeOpacity={isOwnProfile ? 0.7 : 1}
        >
          <Text style={styles.statNum}>{fmt(profile?.followingCount)}</Text>
          <Text style={[styles.statLabel, isOwnProfile && { color: COLORS.accent }]}>{t('profile.followingPl')}</Text>
        </TouchableOpacity>
      </View>

      {/* Action row */}
      <View style={styles.actionRow}>
        {isOwnProfile ? (
          <TouchableOpacity style={styles.editChip} onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.editChipText}>{t('profile.editProfile')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.followRow}>
            {!isBlocked && (
              isFollowing ? (
                <TouchableOpacity style={[styles.followingChip, followLoading && { opacity: 0.5 }]} onPress={() => guestGate(handleFollow)} activeOpacity={0.7} disabled={followLoading}>
                  <Ionicons name="checkmark" size={14} color={COLORS.textMuted} />
                  <Text style={styles.followingChipText}>{t('profile.following')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.followChip, followLoading && { opacity: 0.5 }]} onPress={() => guestGate(handleFollow)} activeOpacity={0.85} disabled={followLoading}>
                  <Text style={styles.followChipText}>{t('profile.follow')}</Text>
                </TouchableOpacity>
              )
            )}
            {!isBlocked && (
              <TouchableOpacity style={styles.notifyBtn} onPress={handleToggleNotify} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
                <Ionicons
                  name={isNotifyEnabled ? 'notifications' : 'notifications-outline'}
                  size={20}
                  color={isNotifyEnabled ? COLORS.accent : COLORS.textMuted}
                />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Circles section header */}
      {circles.length > 0 && (
        <View style={styles.sectionHeader}>
          <Ionicons name="chatbubbles-outline" size={15} color={COLORS.textMuted} />
          <Text style={styles.sectionLabel}>{t('profile.circles')}</Text>
        </View>
      )}
    </View>
  );

  // ── Circle row ──────────────────────────────────────────────────────────────
  const renderCircleItem = useCallback(({ item: room }) => {
    const isPinned = pinnedIds.includes(String(room._id));
    const catIcon = CATEGORY_ICONS[room.category] || 'chatbubbles-outline';
    const isActive = room.isActive !== false;

    const renderRightActions = isOwnProfile ? () => (
      <View style={styles.swipeActions}>
        <TouchableOpacity
          style={[styles.swipeAction, { backgroundColor: COLORS.accent }]}
          onPress={() => handleTogglePin(room._id)}
          activeOpacity={0.85}
        >
          <Ionicons name={isPinned ? 'pin' : 'pin-outline'} size={20} color="#fff" />
          <Text style={styles.swipeActionText}>{isPinned ? t('profile.unpin') : t('profile.pin')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.swipeAction, { backgroundColor: '#FF3B30' }]}
          onPress={() => {
            Alert.alert(
              t('profile.deleteCircle'),
              t('profile.deleteCircleMsg'),
              [
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
              ]
            );
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.swipeActionText}>{t('common.delete')}</Text>
        </TouchableOpacity>
      </View>
    ) : undefined;

    const row = (
      <TouchableOpacity
        style={styles.circleRow}
        onPress={() => navigation.navigate('HachiRoom', { roomId: room._id })}
        activeOpacity={0.7}
      >
        <View style={[styles.circleIconWrap, !isActive && { opacity: 0.4 }]}>
          <Ionicons name={catIcon} size={20} color={COLORS.accent} />
        </View>
        <View style={styles.circleInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {isPinned && <Ionicons name="pin" size={11} color={COLORS.accent} />}
            <Text style={[styles.circleTitle, !isActive && { color: COLORS.textMuted }]} numberOfLines={1}>{room.title}</Text>
          </View>
          <Text style={styles.circleMeta}>
            {room.memberCount || 1} {t('profile.membersLabel')} · {t(`hachi.cat${room.category?.charAt(0).toUpperCase()}${room.category?.slice(1)}`)}
          </Text>
        </View>
        <View style={[styles.statusChip, isActive ? styles.statusLive : styles.statusEnded]}>
          <Text style={[styles.statusText, isActive ? styles.statusLiveText : styles.statusEndedText]}>
            {isActive ? t('hachi.liveBadge') : t('hachi.endedBadge')}
          </Text>
        </View>
      </TouchableOpacity>
    );

    if (isOwnProfile) {
      return (
        <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
          {row}
        </Swipeable>
      );
    }
    return row;
  }, [pinnedIds, handleTogglePin, t, COLORS, navigation, isOwnProfile]);

  if (isLoading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Nav bar */}
      <View style={[styles.navRow, { paddingTop: insets.top + 6, backgroundColor: COLORS.white }]}>
        {isPushed ? (
          <TouchableOpacity style={styles.navBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={26} color={COLORS.text} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('Notifications')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={unreadCount > 0 ? 'notifications' : 'notifications-outline'} size={24} color={COLORS.text} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity style={styles.navBtn} onPress={handleShare} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-redo-outline" size={23} color={COLORS.textMuted} />
          </TouchableOpacity>
          {isOwnProfile && (
            <TouchableOpacity style={styles.navBtn} onPress={() => setShareCardVisible(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="qr-code-outline" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
          {isOwnProfile && (
            <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('Settings')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="settings-outline" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
          {isPushed && !isOwnProfile && (
            <TouchableOpacity style={styles.navBtn} onPress={handleBlock} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name={isBlocked ? 'ban' : 'ellipsis-horizontal'} size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={circles}
        keyExtractor={(item) => item._id}
        renderItem={renderCircleItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={
          <>
            {circlesLoading && <ActivityIndicator size="small" color={COLORS.accent} style={{ padding: 20 }} />}

            {/* User's circle messages */}
            {(userMessages.length > 0 || messagesLoading) && (
              <View style={styles.activitySection}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="chatbubble-ellipses-outline" size={15} color={COLORS.textMuted} />
                  <Text style={styles.sectionLabel}>{t('profile.activity')}</Text>
                </View>

                {messagesLoading ? (
                  <ActivityIndicator size="small" color={COLORS.accent} style={{ padding: 20 }} />
                ) : (
                  userMessages.map((msg) => {
                    const timeAgo = msg.createdAt
                      ? formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: getDateLocale() })
                      : '';
                    return (
                      <TouchableOpacity
                        key={msg._id}
                        style={styles.activityRow}
                        onPress={() => navigation.navigate('HachiRoom', { roomId: msg.roomId, title: msg.roomTitle })}
                        activeOpacity={0.7}
                      >
                        <View style={styles.activityDot} />
                        <View style={styles.activityBody}>
                          <Text style={styles.activityCircle} numberOfLines={1}>{msg.roomTitle}</Text>
                          {!!msg.text && <Text style={styles.activityText} numberOfLines={2}>{msg.text}</Text>}
                          {!!msg.image && (
                            <Image source={{ uri: msg.image }} style={styles.activityImage} resizeMode="cover" />
                          )}
                          <Text style={styles.activityTime}>{timeAgo}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}
            <View style={{ height: insets.bottom + 24 }} />
          </>
        }
        ListEmptyComponent={
          !circlesLoading ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={36} color={COLORS.textMuted} style={{ marginBottom: 8 }} />
              <Text style={styles.emptyText}>{t('profile.noCirclesYet')}</Text>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([loadProfile(), loadCircles(), loadUserMessages()]);
              setRefreshing(false);
            }}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
      />

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
  name: { fontSize: 24, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -0.5 },
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

  // ── Section header ────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.separator,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
  },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Circle row ────────────────────────────────────────────────────────────
  circleRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
  },
  circleIconWrap: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.accent + '12',
    justifyContent: 'center', alignItems: 'center',
  },
  circleInfo: { flex: 1 },
  circleTitle: { fontSize: 15, fontWeight: '600', color: C.text, textAlign: isRTL ? 'right' : 'left' },
  circleMeta: { fontSize: 12, color: C.textMuted, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusLive: { backgroundColor: '#34C75920' },
  statusEnded: { backgroundColor: C.fill },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  statusLiveText: { color: '#34C759' },
  statusEndedText: { color: C.textMuted },

  swipeActions: { flexDirection: 'row' },
  swipeAction: { width: 72, justifyContent: 'center', alignItems: 'center', gap: 4 },
  swipeActionText: { fontSize: 11, fontWeight: '600', color: '#fff' },

  empty: { paddingTop: 48, alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { fontSize: 15, color: C.textMuted, textAlign: 'center' },

  // ── Activity (user's circle messages) ────────────────────────────────────
  activitySection: { marginTop: 8 },
  activityRow: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
  },
  activityDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.accent + '40',
    marginTop: 6, flexShrink: 0,
  },
  activityBody: { flex: 1 },
  activityCircle: { fontSize: 12, fontWeight: '700', color: C.accent, marginBottom: 3 },
  activityText: { fontSize: 15, color: C.text, lineHeight: 21 },
  activityImage: { width: 160, height: 120, borderRadius: 12, marginTop: 6 },
  activityTime: { fontSize: 11, color: C.textMuted, marginTop: 4 },

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
