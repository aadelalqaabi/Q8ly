import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
        {profile?.verifiedBadge && profile.verifiedBadge !== 'none' ? (
          // Badged profile: show the KUWAI badge instead of circle count
          <View style={styles.stat}>
            <VerifiedBadge badge={profile.verifiedBadge} />
          </View>
        ) : (
          <View style={styles.stat}>
            <Text style={styles.statNum}>{fmt(circles.length)}</Text>
            <Text style={styles.statLabel}>{t('profile.circles')}</Text>
          </View>
        )}
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
        style={styles.circleCard}
        onPress={() => navigation.navigate('HachiRoom', { roomId: room._id })}
        onLongPress={handleLongPress}
        delayLongPress={400}
        activeOpacity={0.75}
      >
        {/* Top: category icon + pin indicator */}
        <View style={styles.circleCardTop}>
          <View style={[styles.circleCardIcon, { backgroundColor: isActive ? COLORS.accent + '14' : COLORS.fill }]}>
            <Ionicons name={catIcon} size={16} color={isActive ? COLORS.accent : COLORS.textMuted} />
          </View>
          {isPinned && (
            <View style={styles.pinBadge}>
              <Ionicons name="pin" size={10} color={COLORS.accent} />
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.circleCardTitle} numberOfLines={2}>{room.title}</Text>

        {/* Footer: status + member count */}
        <View style={styles.circleCardFooter}>
          <View style={[styles.circleCardStatusDot, { backgroundColor: isActive ? '#34C759' : COLORS.separator }]} />
          <Text style={[styles.circleCardStatus, { color: isActive ? '#34C759' : COLORS.textMuted }]}>
            {isActive ? t('hachi.liveBadge') : t('hachi.endedBadge')}
          </Text>
          <Text style={styles.circleCardSep}>·</Text>
          <Ionicons name="people-outline" size={11} color={COLORS.textMuted} />
          <Text style={styles.circleCardFooterText}>{room.memberCount || 1}</Text>
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
        style={styles.activityCard}
        onPress={() => navigation.navigate('HachiRoom', { roomId: msg.roomId, title: msg.roomTitle })}
        activeOpacity={0.7}
      >
        <View style={styles.activityCardHeader}>
          <View style={styles.activityIconWrap}>
            <Ionicons name={catIcon} size={13} color={COLORS.accent} />
          </View>
          <Text style={styles.activityCircleName} numberOfLines={1}>{msg.roomTitle}</Text>
          <Text style={styles.activityTime}>{timeAgo}</Text>
        </View>
        {!!msg.text && <Text style={styles.activityText} numberOfLines={3}>{msg.text}</Text>}
        {!!msg.image && <Image source={{ uri: msg.image }} style={styles.activityImage} resizeMode="cover" />}
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
          {/* QR code button disabled for now */}
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

      {/* Profile info */}
      {renderHeader()}

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab, i) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity key={tab.key} style={styles.tabItem} onPress={() => goToTab(i)} activeOpacity={0.7}>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              {active && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Swipeable pages */}
      <ScrollView
        ref={tabScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const page = Math.round(e.nativeEvent.contentOffset.x / SW);
          setActiveTab(TABS[page]?.key || 'circles');
        }}
        style={[{ flex: 1 }, isRTL && { transform: [{ scaleX: -1 }] }]}
      >
        {/* Page 0: Circles */}
        <FlatList
          style={[{ width: SW }, isRTL && { transform: [{ scaleX: -1 }] }]}
          data={circles}
          keyExtractor={(item) => item._id}
          renderItem={renderCircleItem}
          numColumns={2}
          columnWrapperStyle={styles.circleGrid}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 24, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          ListEmptyComponent={
            !circlesLoading ? (
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={36} color={COLORS.textMuted} style={{ marginBottom: 8 }} />
                <Text style={styles.emptyText}>{t('profile.noCirclesYet')}</Text>
              </View>
            ) : <ActivityIndicator size="small" color={COLORS.accent} style={{ padding: 20 }} />
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await Promise.all([loadProfile(), loadCircles(), loadUserMessages()]); setRefreshing(false); }}
              tintColor={COLORS.accent}
              colors={[COLORS.accent]}
            />
          }
        />

        {/* Page 1: Activity */}
        <FlatList
          style={[{ width: SW }, isRTL && { transform: [{ scaleX: -1 }] }]}
          data={userMessages}
          keyExtractor={(item) => item._id}
          renderItem={renderActivityItem}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 24, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          ListEmptyComponent={
            !messagesLoading ? (
              <View style={styles.empty}>
                <Ionicons name="chatbubble-ellipses-outline" size={36} color={COLORS.textMuted} style={{ marginBottom: 8 }} />
                <Text style={styles.emptyText}>{t('profile.noActivity')}</Text>
              </View>
            ) : <ActivityIndicator size="small" color={COLORS.accent} style={{ padding: 20 }} />
          }
        />
      </ScrollView>

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

  // ── Circle grid ───────────────────────────────────────────────────────────
  circleGrid: { paddingHorizontal: 12, gap: 8 },
  circleCard: {
    flex: 1,
    backgroundColor: C.fill,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  circleCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  circleCardIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  pinBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.accent + '14', justifyContent: 'center', alignItems: 'center' },
  circleCardTitle: { fontSize: 13, fontWeight: '700', color: C.text, lineHeight: 18 },
  circleCardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, flexWrap: 'wrap' },
  circleCardStatusDot: { width: 6, height: 6, borderRadius: 3 },
  circleCardStatus: { fontSize: 11, fontWeight: '700' },
  circleCardSep: { fontSize: 11, color: C.textMuted },
  circleCardFooterText: { fontSize: 11, color: C.textMuted },

  empty: { paddingTop: 48, alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { fontSize: 15, color: C.textMuted, textAlign: 'center' },

  // ── Activity (user's circle messages) ────────────────────────────────────
  activityCard: {
    marginHorizontal: 12, marginTop: 8, marginBottom: 0,
    backgroundColor: C.fill,
    borderRadius: 14, padding: 14,
  },
  activityCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  activityIconWrap: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.accent + '14',
    justifyContent: 'center', alignItems: 'center',
  },
  activityCircleName: { flex: 1, fontSize: 12, fontWeight: '700', color: C.accent },
  activityText: { fontSize: 14, color: C.text, lineHeight: 20 },
  activityImage: { width: '100%', height: 160, borderRadius: 10, marginTop: 8 },
  activityTime: { fontSize: 11, color: C.textMuted },

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
