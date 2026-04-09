import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { usersAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

const PALETTE = ['#0033A0', '#007A3D', '#FF6B35', '#2196F3', '#9C27B0', '#00BCD4', '#FF9800'];
function avatarBg(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export default function UserCard({ user, navigation, onFollowChange }) {
  const { t } = useTranslation();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [isFollowing, setIsFollowing] = useState(user.isFollowing || false);

  const handleFollow = async () => {
    try {
      const res = await usersAPI.toggleFollow(user._id);
      setIsFollowing(res.following);
      if (onFollowChange) onFollowChange(user._id, res.following);
    } catch { /* silent */ }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => navigation.navigate('ProfileDetail', { username: user.username })}
      activeOpacity={0.7}
    >
      {user.profilePic ? (
        <Image source={{ uri: user.profilePic }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: avatarBg(user.name) }]}>
          <Text style={styles.avatarInitial}>{user.name?.[0]?.toUpperCase() || '?'}</Text>
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{user.name}</Text>
        {!!user.username && (
          <Text style={styles.username} numberOfLines={1}>@{user.username}</Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.btn, isFollowing && styles.btnFollowing]}
        onPress={handleFollow}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.btnText, isFollowing && styles.btnTextFollowing]}>
          {isFollowing ? t('profile.following') : t('profile.follow')}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const makeStyles = (C) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
    gap: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  avatarInitial: { fontSize: 17, fontWeight: '700', color: '#fff' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: C.text },
  username: { fontSize: 13, color: C.textMuted, marginTop: 1 },
  btn: {
    backgroundColor: C.accent,
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  btnFollowing: { backgroundColor: C.fill },
  btnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  btnTextFollowing: { color: C.textMuted },
});
