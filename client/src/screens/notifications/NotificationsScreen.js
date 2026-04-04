import React, { useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDistanceToNow } from 'date-fns';
import { getDateLocale } from '../../i18n';
import { fetchNotifications, markAsRead } from '../../store/slices/notificationsSlice';
import { useTheme } from '../../context/ThemeContext';

export default function NotificationsScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS, isRTL), [COLORS, isRTL]);
  const { notifications, unreadCount, isLoading } = useSelector((s) => s.notifications);

  const TYPE_CONFIG = {
    pin:              { icon: 'pin',        color: '#FF9500' },
    message_reaction: { icon: 'heart',      color: '#FF3B30' },
    follow:           { icon: 'person-add', color: COLORS.accent },
  };

  // Only show circles-relevant notification types
  const filteredNotifications = useMemo(
    () => notifications.filter((n) => TYPE_CONFIG[n.type]),
    [notifications]
  );

  useEffect(() => { dispatch(fetchNotifications()); }, []);

  const getMessage = (item) => {
    const name = item.fromUser?.name || t('notif.someone');
    const key = `notif.${item.type}`;
    if (t(key) !== key) return t(key, { name });
    return item.message || name;
  };

  const handlePress = (n) => {
    if (!n.read) dispatch(markAsRead([n._id]));
    if (n.type === 'pin' || n.type === 'message_reaction') {
      const circleId = n.circle?._id || n.circle;
      if (circleId) navigation.navigate('HachiRoom', { roomId: circleId });
    } else if (n.type === 'follow' && n.fromUser) {
      navigation.navigate('ProfileDetail', { username: n.fromUser.username });
    }
  };

  const renderItem = ({ item }) => {
    const cfg = TYPE_CONFIG[item.type];
    if (!cfg) return null;

    const timeAgo = item.createdAt
      ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: getDateLocale() })
      : '';

    const hasAvatar = item.fromUser?.profilePic;

    return (
      <TouchableOpacity style={[styles.row, !item.read && styles.rowUnread]} onPress={() => handlePress(item)} activeOpacity={0.7}>
        {/* Avatar or icon */}
        {hasAvatar ? (
          <View style={styles.avatarWrap}>
            <Image source={{ uri: item.fromUser.profilePic }} style={styles.avatar} />
            <View style={[styles.typeBadge, { backgroundColor: cfg.color }]}>
              <Ionicons name={cfg.icon} size={10} color="#fff" />
            </View>
          </View>
        ) : (
          <View style={[styles.iconCircle, { backgroundColor: cfg.color }]}>
            <Ionicons name={cfg.icon} size={20} color="#fff" />
          </View>
        )}

        <View style={styles.textBlock}>
          <Text style={[styles.message, !item.read && styles.messageUnread]}>
            {getMessage(item)}
          </Text>
          {/* For pin notifications, show the circle name */}
          {item.type === 'pin' && item.message && (
            <Text style={styles.preview} numberOfLines={1}>in "{item.message}"</Text>
          )}
          {/* For reactions, show the emoji */}
          {item.type === 'message_reaction' && item.message && (
            <Text style={styles.emoji}>{item.message}</Text>
          )}
          <Text style={styles.time}>{timeAgo}</Text>
        </View>
        {!item.read && <View style={styles.dot} />}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="notifications-outline" size={28} color={COLORS.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>{t('notif.noNotifs')}</Text>
      <Text style={styles.emptySub}>{t('notif.noNotifsSub')}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={26} color={COLORS.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('notif.title')}</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={() => dispatch(markAsRead([]))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.markAll}>{t('notif.markAll')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={COLORS.accent} style={styles.loader} />
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, flexGrow: 1 }}
          refreshing={isLoading}
          onRefresh={() => dispatch(fetchNotifications())}
        />
      )}
    </View>
  );
}

const makeStyles = (C, isRTL) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.white },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  title: { flex: 1, fontSize: 24, fontWeight: '700', color: C.text, textAlign: isRTL ? 'right' : 'left' },
  markAll: { fontSize: 13, color: C.accent, fontWeight: '500' },
  loader: { marginTop: 60 },
  row: {
    flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator, gap: 12,
  },
  rowUnread: { backgroundColor: C.accent + '06' },
  avatarWrap: { width: 42, height: 42, flexShrink: 0 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  typeBadge: {
    position: 'absolute', bottom: -2, end: -2,
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: C.white,
  },
  iconCircle: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  textBlock: { flex: 1 },
  message: { fontSize: 15, color: C.text, lineHeight: 21, textAlign: isRTL ? 'right' : 'left' },
  messageUnread: { fontWeight: '600' },
  preview: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  emoji: { fontSize: 20, marginTop: 2 },
  time: { fontSize: 12, color: C.textMuted, marginTop: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent, flexShrink: 0 },
  empty: { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: C.fill,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: C.text, marginBottom: 6 },
  emptySub: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
});
