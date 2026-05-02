import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDistanceToNow } from 'date-fns';
import { getDateLocale } from '../../i18n';
import { fetchNotifications, markAsRead } from '../../store/slices/notificationsSlice';
import {
  BrutNav, BrutHero, BrutRule, BrutHair, BG, TEXT, MUTED, ACCENT, isAr, ls, shout,
} from '../../components/Brut';

const ALLOWED_TYPES = ['pin', 'message_reaction', 'follow'];

export default function NotificationsScreen({ navigation }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const ar = isAr(i18n);
  const { notifications, isLoading } = useSelector((s) => s.notifications);
  const filtered = notifications.filter((n) => ALLOWED_TYPES.includes(n.type));

  useEffect(() => {
    dispatch(fetchNotifications()).then(() => dispatch(markAsRead([])));
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
      <>
        <TouchableOpacity
          onPress={() => handlePress(item)}
          activeOpacity={0.6}
          style={[styles.row, { flexDirection: ar ? 'row-reverse' : 'row' }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.message, !item.read && { fontWeight: '900' }, { textAlign: ar ? 'right' : 'left' }]}>
              {getMessage(item)}
            </Text>
            <Text style={[styles.time, { letterSpacing: ls(1.5, ar), textAlign: ar ? 'right' : 'left' }]}>
              {shout(time, ar)}
            </Text>
          </View>
          {!item.read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
        <BrutHair />
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <BrutNav onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 20 }}>
        <BrutHero title={t('notif.title')} label={ar ? 'جديد' : 'INCOMING'} />
        <BrutRule mt={26} mb={0} />
      </View>
      {isLoading ? (
        <ActivityIndicator size="large" color={ACCENT} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40, paddingTop: 6 }}
          refreshing={isLoading}
          onRefresh={() => dispatch(fetchNotifications())}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ paddingTop: 80, alignItems: ar ? 'flex-end' : 'flex-start' }}>
              <Text style={[styles.emptyTitle, { textAlign: ar ? 'right' : 'left' }]}>{t('notif.noNotifs')}</Text>
              <Text style={[styles.emptySub, { letterSpacing: ls(1.5, ar), textAlign: ar ? 'right' : 'left' }]}>
                {shout(t('notif.noNotifsSub'), ar)}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 18, alignItems: 'center', gap: 12 },
  message: { fontSize: 15, fontWeight: '600', color: TEXT, lineHeight: 22 },
  time: { fontSize: 10, fontWeight: '800', color: MUTED, marginTop: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },
  emptyTitle: { fontSize: 36, fontWeight: '900', color: TEXT, lineHeight: 42 },
  emptySub: { fontSize: 11, fontWeight: '800', color: MUTED, marginTop: 8 },
});
