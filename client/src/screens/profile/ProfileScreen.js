import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Alert, Share, Platform, Modal,
} from 'react-native';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { usersAPI, hachiAPI } from '../../services/api';
import PostCard from '../../components/post/PostCard';
import BottomMenu from '../../components/ui/BottomMenu';
import ShareProfileCard from '../../components/ui/ShareProfileCard';
import { useTheme } from '../../context/ThemeContext';
import { useGuestGate } from '../../context/GuestGateContext';

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


const TABS = ['posts', 'bookmarks', 'circles'];
const TAB_ICONS = {
  posts: 'grid-outline',
  bookmarks: 'bookmark-outline',
  circles: 'chatbubbles-outline',
};

export default function ProfileScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useSelector((s) => s.auth);
  const unreadCount = useSelector((s) => s.notifications?.unreadCount || 0);
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { guestGate } = useGuestGate();

  const username = route.params?.username || currentUser?.username;
  const isOwnProfile = username === currentUser?.username;
  const isPushed = !!route.params?.username;


  const flatListRef = useRef(null);

  const [profile, setProfile] = useState(isOwnProfile ? currentUser : null);
  const [posts, setPosts] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [circles, setCircles] = useState([]);
  const [pinnedIds, setPinnedIds] = useState([]);
  const [activeTab, setActiveTab] = useState('posts');
  const [isLoading, setIsLoading] = useState(!isOwnProfile);
  const [postsLoading, setPostsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isNotifyEnabled, setIsNotifyEnabled] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  // Followers / Following modal
  const [listModal, setListModal] = useState(null); // 'followers' | 'following' | null
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

  const loadPosts = useCallback(async (p = 1) => {
    if (p > 1) setPostsLoading(true);
    try {
      const res = await usersAPI.getUserPosts(username, { page: p, limit: 20 });
      if (p === 1) setPosts(res.posts);
      else setPosts((prev) => [...prev, ...res.posts]);
      setHasMore(p < res.pagination.pages);
      setPage(p);
    } catch (e) { console.error(e); }
    finally { setPostsLoading(false); }
  }, [username]);

  const loadBookmarks = useCallback(async () => {
    if (!isOwnProfile) return;
    setPostsLoading(true);
    try {
      const res = await usersAPI.getBookmarks({ page: 1, limit: 30 });
      setBookmarks(res.posts || []);
    } catch (e) { console.error(e); }
    finally { setPostsLoading(false); }
  }, [isOwnProfile]);

  const loadCircles = useCallback(async () => {
    if (!profile?._id) return;
    setPostsLoading(true);
    try {
      const res = await hachiAPI.getMyCircles();
      const rooms = res.rooms || [];
      // Pinned IDs come from the auth user's profile
      const pinned = (currentUser?.pinnedCircles || []).map(String);
      setPinnedIds(pinned);
      // Sort: pinned first
      rooms.sort((a, b) => {
        const ap = pinned.includes(String(a._id)) ? 0 : 1;
        const bp = pinned.includes(String(b._id)) ? 0 : 1;
        return ap - bp;
      });
      setCircles(rooms);
    } catch (e) { console.error(e); }
    finally { setPostsLoading(false); }
  }, [profile?._id, currentUser?.pinnedCircles]);

  useEffect(() => {
    const init = async () => {
      if (!isOwnProfile) setIsLoading(true);
      await Promise.all([loadProfile(), loadPosts(1)]);
      setIsLoading(false);
    };
    init();
    navigation.setOptions({ headerShown: false });
  }, [username]);

  useEffect(() => {
    return navigation.addListener('tabPress', () => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
  }, [navigation]);

  useEffect(() => {
    if (activeTab === 'bookmarks' && isOwnProfile && bookmarks.length === 0) {
      loadBookmarks();
    }
    if (activeTab === 'circles' && circles.length === 0) {
      loadCircles();
    }
  }, [activeTab]);

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

  const renderHeader = () => (
    <View>
      {/* Nav row */}
      <View style={[styles.navRow, { paddingTop: insets.top + 6 }]}>
        {isPushed ? (
          <TouchableOpacity style={styles.navBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={26} color={COLORS.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.navBtn} />
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
        {!!profile?.district && (
          <View style={styles.location}>
            <Ionicons name="location-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.locationText}>{profile.district}</Text>
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{fmt(profile?.postsCount)}</Text>
          <Text style={styles.statLabel}>{t('profile.posts')}</Text>
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
            {/* DM button hidden — future feature */}
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

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.filter((tab) => (tab === 'posts') || isOwnProfile).map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)} activeOpacity={0.7}>
            <Ionicons
              name={TAB_ICONS[tab]}
              size={20}
              color={activeTab === tab ? COLORS.accent : COLORS.textMuted}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const feedData = activeTab === 'circles' ? circles : activeTab === 'bookmarks' ? bookmarks : posts;

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

  const renderCircleItem = useCallback(({ item: room }) => {
    const isPinned = pinnedIds.includes(String(room._id));
    return (
    <View style={styles.circleRow}>
      <TouchableOpacity
        style={styles.circleRowMain}
        onPress={() => navigation.navigate('HachiRoom', { roomId: room._id })}
        activeOpacity={0.7}
      >
        <View style={[styles.circleDot, { backgroundColor: room.isActive ? '#34C759' : COLORS.separator }]} />
        <View style={styles.circleInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {isPinned && <Ionicons name="pin" size={11} color={COLORS.accent} />}
            <Text style={styles.circleTitle} numberOfLines={1}>{room.title}</Text>
          </View>
          <Text style={styles.circleMeta}>{room.memberCount || 1} {t('profile.membersLabel')} · {room.category}</Text>
        </View>
        {room.isActive ? (
          <View style={[styles.circleLiveBadge, { backgroundColor: '#34C75918' }]}>
            <Text style={styles.circleLiveText}>{t('hachi.liveBadge')}</Text>
          </View>
        ) : (
          <Text style={styles.circleEndedText}>{t('hachi.endedBadge')}</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={() => handleTogglePin(room._id)}
        activeOpacity={0.7}
        style={{ paddingHorizontal: 6 }}
      >
        <Ionicons name={isPinned ? 'pin' : 'pin-outline'} size={18} color={isPinned ? COLORS.accent : COLORS.textMuted} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.circleDeleteBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
      </TouchableOpacity>
    </View>
  );
  }, [pinnedIds, handleTogglePin, t, COLORS, navigation]);

  const renderPostItem = useCallback(({ item }) => (
    <PostCard post={item} navigation={navigation} />
  ), [navigation]);

  if (isLoading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={feedData}
        keyExtractor={(item) => item._id}
        renderItem={activeTab === 'circles' ? renderCircleItem : renderPostItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={
          postsLoading
            ? <ActivityIndicator size="small" color={COLORS.accent} style={{ padding: 20 }} />
            : <View style={{ height: insets.bottom + 24 }} />
        }
        ListEmptyComponent={
          !postsLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {activeTab === 'circles' ? t('profile.noCirclesYet') : activeTab === 'bookmarks' ? t('profile.noBookmarksYet') : t('profile.noPostsYet')}
              </Text>
            </View>
          ) : null
        }
        onEndReached={() => { if (!postsLoading && hasMore && activeTab === 'posts') loadPosts(page + 1); }}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await Promise.all([
            loadProfile(),
            activeTab === 'posts' ? loadPosts(1)
              : activeTab === 'bookmarks' ? loadBookmarks()
              : loadCircles(),
          ]);
          setRefreshing(false);
        }}
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
          {/* Header */}
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

      {/* DM confirm menu removed — future feature */}
      <ShareProfileCard
        visible={shareCardVisible}
        onClose={() => setShareCardVisible(false)}
        profile={profile}
      />
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.white },
  loader: { flex: 1, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center' },

  navRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 4 },
  navBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  notifBadge: { position: 'absolute', top: -4, right: -6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  notifBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', lineHeight: 12 },

  avatarSection: { alignItems: 'center', paddingTop: 8, paddingBottom: 16 },
  avatar: { width: 104, height: 104, borderRadius: 52, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 38, fontWeight: '700', color: '#fff' },

  identity: { alignItems: 'center', paddingHorizontal: 32, paddingBottom: 20, gap: 4 },
  name: { fontSize: 24, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -0.5 },
  bio: { fontSize: 14, color: C.text, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  locationText: { fontSize: 12, color: C.textMuted },

  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: 20, gap: 16 },
  stat: { alignItems: 'center', gap: 2, minWidth: 60 },
  statNum: { fontSize: 17, fontWeight: '700', color: C.text, textAlign: 'center' },
  statLabel: { fontSize: 11, color: C.textMuted, fontWeight: '400', textAlign: 'center' },
  statDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.separator, marginBottom: 10 },

  actionRow: { alignItems: 'center', paddingBottom: 20 },
  editChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: C.separator, backgroundColor: C.fill },
  editChipText: { fontSize: 13, fontWeight: '500', color: C.textMuted },
  followRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  messageBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.separator, backgroundColor: C.fill },
  followChip: { paddingHorizontal: 36, paddingVertical: 10, borderRadius: 22, backgroundColor: C.accent },
  followChipText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  followingChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: C.separator, backgroundColor: C.fill },
  followingChipText: { fontSize: 13, fontWeight: '500', color: C.textMuted },

  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: C.accent },
  tabText: { fontSize: 14, fontWeight: '500', color: C.textMuted },
  tabTextActive: { color: C.accent, fontWeight: '700' },

  postsHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 2, gap: 12 },
  postsHeaderLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.separator },
  postsHeaderText: { fontSize: 11, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1 },

  empty: { paddingTop: 48, alignItems: 'center' },
  emptyText: { fontSize: 15, color: C.textMuted, textAlign: 'center' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  userRowAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  userRowInitial: { fontSize: 17, fontWeight: '700', color: '#fff' },
  userRowName: { fontSize: 15, fontWeight: '600' },
  userRowUsername: { fontSize: 13, marginTop: 1 },
  unfollowBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginLeft: 8,
  },
  unfollowText: { fontSize: 13, fontWeight: '600' },

  circleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingEnd: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  circleRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingStart: 16,
    paddingVertical: 14,
    gap: 12,
  },
  circleDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  circleInfo: { flex: 1 },
  circleTitle: { fontSize: 15, fontWeight: '600', color: C.text },
  circleMeta: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  circleLiveBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  circleLiveText: { fontSize: 12, fontWeight: '700', color: '#34C759' },
  circleEndedText: { fontSize: 12, color: C.textMuted },
  circleDeleteBtn: { paddingStart: 12, paddingVertical: 14 },
});
