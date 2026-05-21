import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Image, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { founderAPI } from '../../services/api';
import { useBrutColors, BrutNav } from '../../components/Brut';

function timeAgo(date) {
  const d = new Date(date);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function MessageRow({ msg, circleId, onDeleted }) {
  const { TEXT, MUTED, ACCENT, BG, SEPARATOR } = useBrutColors();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = () => {
    Alert.alert('Remove post?', msg.text?.slice(0, 60) || 'This post', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await founderAPI.deleteMessage(circleId, msg._id);
            onDeleted(msg._id);
          } catch (e) {
            Alert.alert('Error', e.message);
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const avatar = msg.anonymous ? null : msg.user?.profilePic;
  const name = msg.anonymous ? 'Anonymous' : (msg.user?.name || msg.user?.username || '?');

  return (
    <View style={[styles.msgRow, { borderBottomColor: SEPARATOR }]}>
      {avatar
        ? <Image source={{ uri: avatar }} style={styles.avatar} />
        : <View style={[styles.avatar, { backgroundColor: SEPARATOR, alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="person" size={14} color={MUTED} />
          </View>
      }
      <View style={styles.msgBody}>
        <View style={styles.msgMeta}>
          <Text style={[styles.msgName, { color: TEXT }]}>{name}</Text>
          <Text style={[styles.msgTime, { color: MUTED }]}>{timeAgo(msg.createdAt)}</Text>
        </View>
        {msg.type === 'image' || msg.image ? (
          <View style={styles.mediaRow}>
            <Ionicons name="image-outline" size={13} color={MUTED} />
            <Text style={[styles.msgText, { color: MUTED, marginLeft: 4 }]}>Image</Text>
          </View>
        ) : msg.type === 'video' || msg.video ? (
          <View style={styles.mediaRow}>
            <Ionicons name="videocam-outline" size={13} color={MUTED} />
            <Text style={[styles.msgText, { color: MUTED, marginLeft: 4 }]}>Video</Text>
          </View>
        ) : (
          <Text style={[styles.msgText, { color: TEXT }]} numberOfLines={3}>{msg.text}</Text>
        )}
      </View>
      <TouchableOpacity onPress={handleDelete} disabled={deleting} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        {deleting
          ? <ActivityIndicator size="small" color={MUTED} />
          : <Ionicons name="trash-outline" size={18} color="#FF3B30" />
        }
      </TouchableOpacity>
    </View>
  );
}

function CircleCard({ circle }) {
  const { TEXT, MUTED, ACCENT, BG, SEPARATOR } = useBrutColors();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState(null);

  const handleExpand = async () => {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (messages !== null) return;
    setLoading(true);
    try {
      const res = await founderAPI.getCircle(circle._id);
      setMessages(res.data.circle.messages || []);
    } catch (e) {
      Alert.alert('Error', e.message);
      setExpanded(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleted = (msgId) => {
    setMessages((prev) => prev.filter((m) => m._id !== msgId));
  };

  const title = circle.venueName || circle.title || 'Unnamed';
  const isActive = circle.isActive;
  const msgCount = circle.summary?.messageCount ?? 0;

  return (
    <View style={[styles.card, { backgroundColor: BG, borderColor: SEPARATOR }]}>
      <TouchableOpacity onPress={handleExpand} activeOpacity={0.7} style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <View style={styles.statusDot}>
            <View style={[styles.dot, { backgroundColor: isActive ? '#34C759' : MUTED }]} />
          </View>
          <View>
            <Text style={[styles.cardTitle, { color: TEXT }]} numberOfLines={1}>{title}</Text>
            <Text style={[styles.cardSub, { color: MUTED }]}>
              {circle.category} · {msgCount} posts · {circle.memberCount || 0} members
            </Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={MUTED}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.msgList, { borderTopColor: SEPARATOR }]}>
          {loading && (
            <ActivityIndicator size="small" color={MUTED} style={{ marginVertical: 16 }} />
          )}
          {!loading && messages?.length === 0 && (
            <Text style={[styles.empty, { color: MUTED }]}>No posts</Text>
          )}
          {!loading && messages?.map((msg) => (
            <MessageRow
              key={msg._id}
              msg={msg}
              circleId={circle._id}
              onDeleted={handleDeleted}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export default function AdminCirclesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { TEXT, MUTED, ACCENT, BG, SEPARATOR } = useBrutColors();
  const [circles, setCircles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchCircles = useCallback(async (p = 1, append = false) => {
    try {
      const res = await founderAPI.listCircles(p);
      const { circles: data, pages: totalPages } = res.data;
      setCircles((prev) => append ? [...prev, ...data] : data);
      setPage(p);
      setPages(totalPages);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }, []);

  const onMount = useCallback(async () => {
    setLoading(true);
    await fetchCircles(1);
    setLoading(false);
  }, [fetchCircles]);

  useEffect(() => { onMount(); }, [onMount]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCircles(1);
    setRefreshing(false);
  };

  const onLoadMore = async () => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    await fetchCircles(page + 1, true);
    setLoadingMore(false);
  };

  return (
    <View style={[styles.root, { backgroundColor: BG }]}>
      <BrutNav onBack={() => navigation.goBack()} />
      <View style={[styles.titleRow, { borderBottomColor: SEPARATOR }]}>
        <Text style={[styles.title, { color: TEXT }]}>Circles</Text>
        <Text style={[styles.badge, { color: MUTED }]}>{circles.length}</Text>
      </View>

      {loading
        ? <ActivityIndicator size="large" color={ACCENT} style={{ marginTop: 40 }} />
        : (
          <FlatList
            data={circles}
            keyExtractor={(c) => c._id}
            renderItem={({ item }) => <CircleCard circle={item} />}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MUTED} />}
            onEndReached={onLoadMore}
            onEndReachedThreshold={0.3}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={MUTED} style={{ marginTop: 12 }} /> : null}
          />
        )
      }
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  badge: { fontSize: 14, fontWeight: '500', marginLeft: 8 },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  statusDot: { marginRight: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardSub: { fontSize: 12, fontWeight: '400', marginTop: 2 },
  msgList: { borderTopWidth: StyleSheet.hairlineWidth },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 30, height: 30, borderRadius: 15, marginRight: 10 },
  msgBody: { flex: 1, marginRight: 10 },
  msgMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  msgName: { fontSize: 13, fontWeight: '600', marginRight: 6 },
  msgTime: { fontSize: 11 },
  msgText: { fontSize: 13, lineHeight: 18 },
  mediaRow: { flexDirection: 'row', alignItems: 'center' },
});
