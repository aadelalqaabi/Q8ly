import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { formatDistanceToNowStrict } from 'date-fns';
import { fetchConversations, acceptDmRequest, denyDmRequest, clearNeedsRefresh } from '../../store/slices/dmSlice';
import { useTheme } from '../../context/ThemeContext';

const PALETTE = ['#0033A0', '#007A3D', '#FF6B35', '#2196F3', '#9C27B0', '#00BCD4', '#FF9800'];
function avatarBg(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function Avatar({ user, size = 48 }) {
  const r = size / 2;
  if (user?.profilePic) {
    return <Image source={{ uri: user.profilePic }} style={{ width: size, height: size, borderRadius: r }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: avatarBg(user?.name), justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.37, fontWeight: '700' }}>{user?.name?.[0]?.toUpperCase() || '?'}</Text>
    </View>
  );
}

export default function DMListScreen({ navigation }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { conversations, requests, loading, needsRefresh } = useSelector((s) => s.dm);
  const [actionLoading, setActionLoading] = useState(null); // convId being accepted/denied

  useFocusEffect(
    React.useCallback(() => {
      dispatch(fetchConversations());
    }, [dispatch])
  );

  useEffect(() => {
    if (needsRefresh) {
      dispatch(fetchConversations());
      dispatch(clearNeedsRefresh());
    }
  }, [needsRefresh, dispatch]);

  const goToConversation = (other) => {
    navigation.navigate('DMConversation', { userId: other._id, username: other.username, name: other.name });
  };

  const handleAccept = async (item) => {
    setActionLoading(item._id);
    await dispatch(acceptDmRequest(item._id));
    setActionLoading(null);
    goToConversation(item.other);
  };

  const handleDeny = (convId) => {
    Alert.alert('Decline request?', 'This will delete the conversation.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline', style: 'destructive', onPress: async () => {
          setActionLoading(convId);
          await dispatch(denyDmRequest(convId));
          setActionLoading(null);
        },
      },
    ]);
  };

  const renderConvRow = (item) => {
    const other = item.other;
    const timeAgo = item.lastMessageAt
      ? formatDistanceToNowStrict(new Date(item.lastMessageAt), { addSuffix: false })
      : '';
    const isPending = item.status === 'pending';

    return (
      <TouchableOpacity
        key={item._id}
        style={styles.row}
        onPress={() => goToConversation(other)}
        activeOpacity={0.8}
      >
        <View style={styles.avatarWrap}>
          <Avatar user={other} size={48} />
          {(item.unread || 0) > 0 && <View style={[styles.unreadDot, { backgroundColor: COLORS.accent }]} />}
        </View>
        <View style={styles.info}>
          <View style={styles.topRow}>
            <Text style={[styles.name, item.unread > 0 && styles.nameBold]} numberOfLines={1}>
              {other.name}
            </Text>
            {isPending ? (
              <Text style={[styles.time, { color: COLORS.accent }]}>Pending</Text>
            ) : (
              <Text style={styles.time}>{timeAgo}</Text>
            )}
          </View>
          <Text style={[styles.preview, item.unread > 0 && styles.previewBold]} numberOfLines={1}>
            {item.lastMessage || 'Start a conversation'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderRequestRow = (item) => {
    const other = item.other;
    return (
      <TouchableOpacity
        key={item._id}
        style={styles.requestRow}
        onPress={() => goToConversation(other)}
        activeOpacity={0.8}
      >
        <Avatar user={other} size={44} />
        <View style={styles.requestInfo}>
          <Text style={styles.requestName} numberOfLines={1}>{other.name}</Text>
          <Text style={styles.requestPreview} numberOfLines={1}>{item.lastMessage || 'Wants to message you'}</Text>
        </View>
        <View style={styles.requestActions}>
          {actionLoading === item._id ? (
            <ActivityIndicator size="small" color={COLORS.accent} style={{ paddingHorizontal: 12 }} />
          ) : (
            <>
              <TouchableOpacity
                style={[styles.requestBtn, { backgroundColor: COLORS.accent }]}
                onPress={(e) => { e.stopPropagation?.(); handleAccept(item); }}
                activeOpacity={0.8}
              >
                <Text style={styles.requestBtnAcceptText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.requestBtn, { backgroundColor: COLORS.fill }]}
                onPress={(e) => { e.stopPropagation?.(); handleDeny(item._id); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.requestBtnText, { color: COLORS.textMuted }]}>Decline</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const isEmpty = conversations.length === 0 && requests.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {loading && isEmpty ? (
        <ActivityIndicator style={{ flex: 1 }} color={COLORS.accent} />
      ) : (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={
            <>
              {/* Message Requests */}
              {requests.length > 0 && (
                <View>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Message Requests</Text>
                    <View style={[styles.badge, { backgroundColor: COLORS.accent }]}>
                      <Text style={styles.badgeText}>{requests.length}</Text>
                    </View>
                  </View>
                  {requests.map((item) => renderRequestRow(item))}
                  {conversations.length > 0 && <View style={styles.sectionDivider} />}
                </View>
              )}

              {/* Conversations */}
              {conversations.length > 0 && (
                <View>
                  {requests.length > 0 && (
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>Messages</Text>
                    </View>
                  )}
                  {conversations.map((item) => renderConvRow(item))}
                </View>
              )}

              {isEmpty && (
                <View style={styles.empty}>
                  <Ionicons name="chatbubble-ellipses-outline" size={48} color={COLORS.separator} />
                  <Text style={styles.emptyText}>No messages yet</Text>
                </View>
              )}
            </>
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
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: C.text },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  badge: { borderRadius: 10, minWidth: 20, height: 20, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  sectionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginTop: 4 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
    gap: 12,
  },
  avatarWrap: { position: 'relative' },
  unreadDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: C.white,
  },
  info: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  name: { fontSize: 15, fontWeight: '500', color: C.text, flex: 1 },
  nameBold: { fontWeight: '700' },
  time: { fontSize: 12, color: C.textMuted, marginLeft: 8 },
  preview: { fontSize: 13, color: C.textMuted },
  previewBold: { color: C.text, fontWeight: '600' },

  requestRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
    gap: 12,
  },
  requestInfo: { flex: 1 },
  requestName: { fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 2 },
  requestPreview: { fontSize: 13, color: C.textMuted },
  requestActions: { flexDirection: 'row', gap: 8 },
  requestBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  requestBtnAcceptText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  requestBtnText: { fontSize: 13, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: C.textMuted },
});
