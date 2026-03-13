import React, { useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDistanceToNowStrict } from 'date-fns';
import { fetchConversations } from '../../store/slices/dmSlice';
import { useTheme } from '../../context/ThemeContext';

const PALETTE = ['#0033A0', '#007A3D', '#FF6B35', '#2196F3', '#9C27B0', '#00BCD4', '#FF9800'];
function avatarBg(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export default function DMListScreen({ navigation }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { conversations, loading } = useSelector((s) => s.dm);

  useEffect(() => {
    dispatch(fetchConversations());
  }, []);

  const renderItem = ({ item }) => {
    const other = item.other;
    const timeAgo = item.lastMessageAt
      ? formatDistanceToNowStrict(new Date(item.lastMessageAt), { addSuffix: false })
      : '';

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('DMConversation', { userId: other._id, username: other.username, name: other.name })}
        activeOpacity={0.8}
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {other.profilePic ? (
            <Image source={{ uri: other.profilePic }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: avatarBg(other.name) }]}>
              <Text style={styles.avatarInitial}>{other.name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
          )}
          {(item.unread || 0) > 0 && <View style={styles.unreadDot} />}
        </View>

        {/* Text */}
        <View style={styles.info}>
          <View style={styles.topRow}>
            <Text style={[styles.name, item.unread > 0 && styles.nameBold]} numberOfLines={1}>
              {other.name}
            </Text>
            <Text style={styles.time}>{timeAgo}</Text>
          </View>
          <Text style={[styles.preview, item.unread > 0 && styles.previewBold]} numberOfLines={1}>
            {item.lastMessage || 'Start a conversation'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading && conversations.length === 0 ? (
        <ActivityIndicator style={{ flex: 1 }} color={COLORS.accent} />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color={COLORS.separator} />
              <Text style={styles.emptyText}>No messages yet</Text>
            </View>
          }
          refreshing={loading}
          onRefresh={() => dispatch(fetchConversations())}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
    gap: 12,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { fontSize: 18, fontWeight: '700', color: '#fff' },
  unreadDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#0033A0',
    borderWidth: 2, borderColor: C.white,
  },
  info: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  name: { fontSize: 15, fontWeight: '500', color: C.text, flex: 1 },
  nameBold: { fontWeight: '700' },
  time: { fontSize: 12, color: C.textMuted, marginLeft: 8 },
  preview: { fontSize: 13, color: C.textMuted },
  previewBold: { color: C.text, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: C.textMuted },
});
