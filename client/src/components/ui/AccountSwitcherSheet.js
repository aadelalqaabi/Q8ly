import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, Animated, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Image, ScrollView,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { switchToAccount } from '../../store/slices/authSlice';
import { loadAccounts, upsertCurrentAccount } from '../../utils/accountsStore';

export { upsertCurrentAccount };

const FOUNDER_PHONE = '+96599440289';

export default function AccountSwitcherSheet({ visible, onClose }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { colors: C, isDark } = useTheme();
  const { user: activeUser, token: activeToken } = useSelector((s) => s.auth);
  const translateY = useRef(new Animated.Value(600)).current;
  const [accounts, setAccounts] = useState([]);

  // Load accounts list
  const refreshAccounts = async () => {
    try {
      if (activeToken && activeUser) {
        await upsertCurrentAccount(activeToken, activeUser);
      }
      const list = await loadAccounts();
      setAccounts(list);
    } catch (_) {}
  };

  // Animate open/close
  useEffect(() => {
    if (visible) {
      refreshAccounts();
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: 600,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwitch = async (account) => {
    if (account.user?.phone === activeUser?.phone) {
      onClose();
      return;
    }
    onClose();
    try {
      await dispatch(switchToAccount({ token: account.token, user: account.user }));
    } catch (_) {}
  };

  const styles = makeStyles(C, isDark, insets);

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Switch Account</Text>

        <ScrollView
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {accounts.map((acc) => {
            const isActive = acc.user?.phone === activeUser?.phone;
            const initial = (acc.user?.name || acc.user?.username || '?').charAt(0).toUpperCase();
            return (
              <TouchableOpacity
                key={acc.user?.phone || Math.random()}
                style={[styles.row, isActive && styles.rowActive]}
                onPress={() => handleSwitch(acc)}
                activeOpacity={0.7}
              >
                {acc.user?.profilePic ? (
                  <Image source={{ uri: acc.user.profilePic }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarInitial}>{initial}</Text>
                  </View>
                )}
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>
                    {acc.user?.name || acc.user?.username || 'Unknown'}
                  </Text>
                </View>
                {isActive && (
                  <Ionicons name="checkmark-circle" size={22} color={C.accent} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>



        <View style={{ height: insets.bottom + 8 }} />
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (C, isDark, insets) =>
  StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: {
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      backgroundColor: C.white,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
      paddingTop: 12,
    },
    handle: {
      width: 36, height: 4,
      backgroundColor: C.separator,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 17, fontWeight: '700',
      color: C.text,
      paddingHorizontal: 20, marginBottom: 12,
    },
    list: { maxHeight: 380 },
    row: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 20, paddingVertical: 12, gap: 14,
    },
    rowActive: { backgroundColor: isDark ? 'rgba(0,51,160,0.12)' : '#EEF2FA' },
    avatar: { width: 46, height: 46, borderRadius: 23 },
    avatarPlaceholder: { backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center' },
    avatarInitial: { fontSize: 18, fontWeight: '700', color: '#fff' },
    info: { flex: 1 },
    name: { fontSize: 15, fontWeight: '600', color: C.text },
    handle2: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  });
