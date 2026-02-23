import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { usersAPI } from '../../services/api';
import { COLORS, VERIFIED_BADGE_LABELS } from '../../constants';

export default function UserCard({ user, navigation, onFollowChange }) {
  const [isFollowing, setIsFollowing] = useState(user.isFollowing || false);
  const [followersCount, setFollowersCount] = useState(user.followersCount);

  const badge = user.verifiedBadge && VERIFIED_BADGE_LABELS[user.verifiedBadge];

  const handleFollow = async () => {
    try {
      const res = await usersAPI.toggleFollow(user._id);
      setIsFollowing(res.following);
      setFollowersCount(res.followersCount);
      if (onFollowChange) onFollowChange(user._id, res.following);
    } catch (e) { /* silent */ }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => navigation.navigate('ProfileDetail', { username: user.username })}
    >
      {user.profilePic
        ? <Image source={{ uri: user.profilePic }} style={styles.avatar} />
        : <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>{user.name?.[0] || '?'}</Text>
          </View>
      }

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{user.name}</Text>
          {badge && <Text style={[styles.badge, { color: badge.color }]}>{badge.icon}</Text>}
        </View>
        <Text style={styles.username}>@{user.username}</Text>
        {user.bio ? <Text style={styles.bio} numberOfLines={1}>{user.bio}</Text> : null}
        <Text style={styles.followers}>{followersCount?.toLocaleString()} followers</Text>
      </View>

      <TouchableOpacity
        style={[styles.followBtn, isFollowing && styles.followingBtn]}
        onPress={handleFollow}
      >
        <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
          {isFollowing ? 'Following' : 'Follow'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  avatarPlaceholder: { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 20, fontWeight: '700', color: '#fff' },
  info: { flex: 1, marginRight: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  badge: { fontSize: 13 },
  username: { fontSize: 13, color: COLORS.textMuted, marginTop: 1 },
  bio: { fontSize: 13, color: COLORS.textLight, marginTop: 3 },
  followers: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  followBtn: { borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6 },
  followingBtn: { backgroundColor: COLORS.primary },
  followBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  followingBtnText: { color: '#fff' },
});
