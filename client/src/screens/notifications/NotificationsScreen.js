import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDistanceToNow } from 'date-fns';
import { fetchNotifications, markAsRead } from '../../store/slices/notificationsSlice';
import { COLORS } from '../../constants';

const NOTIFICATION_ICONS = {
  like: { icon: 'heart', color: COLORS.primary },
  comment: { icon: 'chatbubble', color: COLORS.info },
  reply: { icon: 'return-up-back', color: COLORS.info },
  follow: { icon: 'person-add', color: COLORS.secondary },
  repost: { icon: 'repeat', color: COLORS.warning },
  mention: { icon: 'at', color: COLORS.primary },
  system: { icon: 'information-circle', color: COLORS.textMuted },
  kuwait_brief: { icon: 'newspaper', color: COLORS.primary },
};

const NOTIFICATION_MESSAGES = {
  like: (name) => `${name} liked your post`,
  comment: (name) => `${name} replied to your post`,
  reply: (name) => `${name} replied to your comment`,
  follow: (name) => `${name} started following you`,
  repost: (name) => `${name} reposted your post`,
  mention: (name) => `${name} mentioned you`,
  kuwait_brief: () => 'Kuwait Brief is ready',
  system: (_, msg) => msg,
};

export default function NotificationsScreen({ navigation }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { notifications, unreadCount, isLoading } = useSelector((s) => s.notifications);

  useEffect(() => {
    dispatch(fetchNotifications());
  }, []);

  const handleMarkAllRead = () => {
    dispatch(markAsRead([]));
  };

  const handleNotificationPress = (notification) => {
    // Mark as read
    if (!notification.read) {
      dispatch(markAsRead([notification._id]));
    }

    // Navigate to relevant content
    if (notification.post) {
      navigation.navigate('PostDetail', { postId: notification.post._id || notification.post });
    } else if (notification.type === 'follow' && notification.fromUser) {
      navigation.navigate('ProfileDetail', { username: notification.fromUser.username });
    }
  };

  const renderNotification = ({ item }) => {
    const iconConfig = NOTIFICATION_ICONS[item.type] || NOTIFICATION_ICONS.system;
    const getName = () => item.fromUser?.name || 'Someone';
    const getMessage = () => {
      const fn = NOTIFICATION_MESSAGES[item.type];
      return fn ? fn(getName(), item.message) : item.message;
    };

    return (
      <TouchableOpacity
        style={[styles.notifItem, !item.read && styles.unreadNotif]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={[styles.iconCircle, { backgroundColor: iconConfig.color + '20' }]}>
          <Ionicons name={iconConfig.icon} size={18} color={iconConfig.color} />
        </View>
        <View style={styles.notifContent}>
          <Text style={styles.notifMessage}>{getMessage()}</Text>
          {item.post?.content && (
            <Text style={styles.notifPostPreview} numberOfLines={1}>"{item.post.content}"</Text>
          )}
          <Text style={styles.notifTime}>
            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          </Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderNotification}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySubtitle}>When people interact with your posts, you'll see it here.</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          refreshing={isLoading}
          onRefresh={() => dispatch(fetchNotifications())}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.white, padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  markAllBtn: {},
  markAllText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  notifItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  unreadNotif: { backgroundColor: '#FFF5F5' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  notifContent: { flex: 1 },
  notifMessage: { fontSize: 14, color: COLORS.text, lineHeight: 18 },
  notifPostPreview: { fontSize: 13, color: COLORS.textMuted, marginTop: 2, fontStyle: 'italic' },
  notifTime: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginLeft: 8 },
  emptyState: { flex: 1, alignItems: 'center', padding: 40, paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: COLORS.textLight, textAlign: 'center' },
});
