import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Animated, Dimensions, TouchableWithoutFeedback,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { exitGuestMode } from '../store/slices/authSlice';
import { useTheme } from './ThemeContext';

const GuestGateContext = createContext(null);

export function GuestGateProvider({ children, navigationRef }) {
  const { colors: COLORS } = useTheme();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { isGuest } = useSelector((s) => s.auth);
  const [visible, setVisible] = useState(false);
  const translateY = useRef(new Animated.Value(300)).current;

  const show = useCallback(() => {
    setVisible(true);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [translateY]);

  const hide = useCallback(() => {
    Animated.timing(translateY, {
      toValue: 400,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  }, [translateY]);

  // guestGate(fn) — if guest, show modal and return true; else run fn and return false
  const guestGate = useCallback((fn) => {
    if (isGuest) {
      show();
      return true;
    }
    fn?.();
    return false;
  }, [isGuest, show]);

  const handleSignUp = () => {
    hide();
    dispatch(exitGuestMode());
    // NavigationContainer will switch to AuthStack automatically
  };

  const styles = makeStyles(COLORS);

  return (
    <GuestGateContext.Provider value={{ guestGate, isGuest }}>
      {children}
      <Modal
        transparent
        visible={visible}
        animationType="none"
        onRequestClose={hide}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={hide}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: COLORS.tintBg || '#EEF2FA' }]}>
            <Ionicons name="person-add-outline" size={28} color={COLORS.accent} />
          </View>

          <Text style={[styles.title, { color: COLORS.text }]}>{t('guest.title')}</Text>
          <Text style={[styles.subtitle, { color: COLORS.textMuted }]}>
            {t('guest.subtitle')}
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: COLORS.accent }]}
            onPress={handleSignUp}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>{t('guest.join')}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={hide} activeOpacity={0.6} style={styles.notNow}>
            <Text style={[styles.notNowText, { color: COLORS.textMuted }]}>{t('guest.browseAsGuest')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </GuestGateContext.Provider>
  );
}

export function useGuestGate() {
  return useContext(GuestGateContext);
}

const makeStyles = (C) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C?.white || '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C?.separator || '#E5E5EA',
    marginBottom: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
  },
  primaryBtn: {
    width: '100%',
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  notNow: {
    paddingVertical: 8,
  },
  notNowText: {
    fontSize: 15,
  },
});
