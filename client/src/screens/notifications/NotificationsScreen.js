import React, { useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDistanceToNow } from 'date-fns';
import { getDateLocale } from '../../i18n';
import { fetchNotifications, markAsRead } from '../../store/slices/notificationsSlice';
import { useTheme } from '../../context/ThemeContext';

const ALLOWED_TYPES = ['pin', 'message_reaction', 'follow'];

export default function NotificationsScreen({ navigation }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS, isRTL), [COLORS, isRTL]);
  const { notifications, isLoading } = useSelector((s) => s.notifications);
  const filtered = notifications.filter((n) => ALLOWED_TYPES.includes(n.type));

  useEffect(() => {
    dispatch(fetchNotifications()).then((action) => {
      const ids = (action.payload || []).filter((n) => !n.read).map((n) => n._id);
      if (ids.length > 0) dispatch(markAsRead(ids));
    });
  }, []);

  const handlePress = (n) => {
    if (!n.read) dispatch(markAsRead([n._id]));
    if (n.type === 'pin' || n.type === 'message_reaction') {
      const circleId = n.circle?._id || n.circle;
      if (circleId) navigation.navigate('Circle', { circleId });
    } else if (n.type === 'follow' && n.fromUser) {
      navigation.navigate('Profile', { username: n.fromUser.username });
    }
  };

  const getMessage = (n) => {
    const name = n.fromUser?.name || t('notif.someone');
    const key = `notif.${n.type}`;
    if (t(key) !== key) return t(key, { name });
    return n.message || name;
  };

  const renderItem = ({ item }) => {
    const time = item.createdAt
      ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: getDateLocale() })
      : '';
    return (
      <TouchableOpacity
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
        style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
      >
        <View style={[styles.dot, { backgroundColor: item.read ? 'transparent' : COLORS.accent }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.message, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }, !item.read && { fontWeight: '700' }]}>
            {getMessage(item)}
          </Text>
          <Text style={[styles.time, { color: COLORS.textMuted, textAlign: isRTL ? 'right' : 'left' }]}>
            {time}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Nav */}
      <View style={[styles.navRow, { flexDirection: isRTL ? 'row-reverse' : 'row', borderBottomColor: COLORS.separator }]}>
        <TouchableOpacity onPress={() => navigation.canGoBack() && navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={[styles.navLink, { color: COLORS.text }]}>
            {isRTL ? `${t('common.back')} ›` : `‹ ${t('common.back')}`}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: COLORS.text }]}>{t('notif.title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      {isLoading && filtered.length === 0 ? (
        <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          refreshing={isLoading}
          onRefresh={() => dispatch(fetchNotifications())}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: COLORS.separator }]} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: COLORS.text }]}>{t('notif.noNotifs')}</Text>
              <Text style={[styles.emptySub, { color: COLORS.textMuted, textAlign: 'center' }]}>
                {t('notif.noNotifsSub')}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const makeStyles = (C, isRTL) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  navRow: {
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navLink: { fontSize: 15, fontWeight: '600', width: 60 },
  navTitle: { fontSize: 17, fontWeight: '700' },
  separator: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  row: {
    paddingHorizontal: 16, paddingVertical: 16,
    alignItems: 'flex-start', gap: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0 },
  message: { fontSize: 15, fontWeight: '500', lineHeight: 22 },
  time: { fontSize: 12, fontWeight: '400', marginTop: 3 },
  empty: { paddingTop: 80, paddingHorizontal: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 14, lineHeight: 20 },
});
