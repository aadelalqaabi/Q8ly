import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { usersAPI } from '../../services/api';
import { logout } from '../../store/slices/authSlice';
import PostCard from '../../components/post/PostCard';
import { COLORS, VERIFIED_BADGE_LABELS } from '../../constants';

export default function ProfileScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const { user: currentUser } = useSelector((s) => s.auth);

  const username = route.params?.username || currentUser?.username;
  const isOwnProfile = username === currentUser?.username;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const res = await usersAPI.getProfile(username);
      setProfile(res.user);
      setIsFollowing(res.user.isFollowing || false);
    } catch (e) {
      console.error(e);
    }
  }, [username]);

  const loadPosts = useCallback(async (p = 1) => {
    if (p > 1) setPostsLoading(true);
    try {
      const res = await usersAPI.getUserPosts(username, { page: p, limit: 20 });
      if (p === 1) setPosts(res.posts);
      else setPosts((prev) => [...prev, ...res.posts]);
      setHasMore(p < res.pagination.pages);
      setPage(p);
    } catch (e) {
      console.error(e);
    } finally {
      setPostsLoading(false);
    }
  }, [username]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadProfile();
      await loadPosts(1);
      setIsLoading(false);
    };
    init();
    navigation.setOptions({ title: `@${username}` });
  }, [username]);

  const handleFollow = async () => {
    try {
      const res = await usersAPI.toggleFollow(profile._id);
      setIsFollowing(res.following);
      setProfile((p) => ({ ...p, followersCount: res.followersCount }));
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
  };

  const badge = profile && VERIFIED_BADGE_LABELS[profile.verifiedBadge];

  const renderHeader = () => (
    <View>
      {/* Cover Photo */}
      <View style={[styles.cover, { backgroundColor: COLORS.primary }]}>
        {profile?.coverPhoto && (
          <Image source={{ uri: profile.coverPhoto }} style={styles.coverImage} />
        )}
        {isOwnProfile && (
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        {isOwnProfile && (
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Avatar + actions */}
      <View style={styles.avatarRow}>
        <View style={styles.avatarWrapper}>
          {profile?.profilePic
            ? <Image source={{ uri: profile.profilePic }} style={styles.avatar} />
            : <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>{profile?.name?.[0] || '?'}</Text>
              </View>
          }
        </View>
        <View style={styles.actionBtns}>
          {!isOwnProfile ? (
            <>
              <TouchableOpacity
                style={[styles.followBtn, isFollowing && styles.followingBtn]}
                onPress={handleFollow}
              >
                <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Text style={styles.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Profile info */}
      <View style={styles.profileInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{profile?.name}</Text>
          {badge && (
            <View style={[styles.badge, { backgroundColor: badge.color + '20' }]}>
              <Text style={[styles.badgeText, { color: badge.color }]}>{badge.icon} {badge.label}</Text>
            </View>
          )}
        </View>
        <Text style={styles.username}>@{profile?.username}</Text>
        {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
        {profile?.district ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.location}>{profile.district}</Text>
          </View>
        ) : null}

        {/* Stats */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.stat} onPress={() => navigation.navigate('Followers', { username, type: 'following' })}>
            <Text style={styles.statNum}>{profile?.followingCount?.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.stat} onPress={() => navigation.navigate('Followers', { username, type: 'followers' })}>
            <Text style={styles.statNum}>{profile?.followersCount?.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{profile?.postsCount?.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
        </View>
      </View>

      {/* Posts header */}
      <View style={styles.postsHeader}>
        <Text style={styles.postsHeaderTitle}>Posts</Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <PostCard post={item} navigation={navigation} />}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={postsLoading ? <ActivityIndicator size="small" color={COLORS.primary} style={{ padding: 16 }} /> : null}
        ListEmptyComponent={
          !postsLoading && (
            <View style={styles.emptyPosts}>
              <Text style={styles.emptyPostsText}>No posts yet</Text>
            </View>
          )
        }
        onEndReached={() => { if (!postsLoading && hasMore) loadPosts(page + 1); }}
        onEndReachedThreshold={0.3}
        refreshing={isLoading}
        onRefresh={() => { loadProfile(); loadPosts(1); }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cover: { height: 140, position: 'relative' },
  coverImage: { ...StyleSheet.absoluteFillObject },
  settingsBtn: { position: 'absolute', top: 12, right: 48, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20, padding: 6 },
  logoutBtn: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20, padding: 6 },
  avatarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, marginTop: -40 },
  avatarWrapper: { borderWidth: 3, borderColor: COLORS.white, borderRadius: 46 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 32, fontWeight: '700', color: '#fff' },
  actionBtns: { flexDirection: 'row', gap: 8 },
  followBtn: { borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  followingBtn: { backgroundColor: COLORS.primary },
  followBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  followingBtnText: { color: '#fff' },
  editBtn: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  editBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  profileInfo: { backgroundColor: COLORS.white, padding: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  username: { fontSize: 14, color: COLORS.textLight, marginTop: 2 },
  bio: { fontSize: 14, color: COLORS.text, marginTop: 8, lineHeight: 20 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  location: { fontSize: 13, color: COLORS.textMuted },
  statsRow: { flexDirection: 'row', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  postsHeader: { backgroundColor: COLORS.white, padding: 14, borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 8 },
  postsHeaderTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  emptyPosts: { padding: 40, alignItems: 'center' },
  emptyPostsText: { fontSize: 16, color: COLORS.textMuted },
});
