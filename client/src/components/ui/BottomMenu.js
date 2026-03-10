import React, { useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
  Animated, Modal, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';

/**
 * BottomMenu — custom bottom sheet, replaces ActionSheetIOS / Alert menus.
 *
 * Props:
 *   visible      {boolean}
 *   onClose      {function}
 *   title        {string?}
 *   options      {Array<{ label, onPress, destructive?, icon? }>}
 */
export default function BottomMenu({ visible, onClose, title, options = [] }) {
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 22, stiffness: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleOption = (opt) => {
    onClose();
    // Small delay so the sheet closes before action fires
    setTimeout(() => opt.onPress?.(), 160);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 8, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Handle */}
        <View style={styles.handle} />

        {/* Title */}
        {!!title && <Text style={styles.title}>{title}</Text>}

        {/* Options */}
        {options.map((opt, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={styles.divider} />}
            <TouchableOpacity
              style={styles.option}
              onPress={() => handleOption(opt)}
              activeOpacity={0.6}
            >
              <Text style={[styles.optionLabel, opt.destructive && styles.optionDestructive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}

        {/* Separator before Cancel */}
        <View style={[styles.divider, styles.cancelDivider]} />

        {/* Cancel */}
        <TouchableOpacity style={styles.option} onPress={onClose} activeOpacity={0.6}>
          <Text style={styles.cancelLabel}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (C) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 0,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D1D6',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '500',
    color: C.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.separator,
    marginHorizontal: 0,
  },
  cancelDivider: {
    marginTop: 8,
  },
  option: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    minHeight: 54,
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: '400',
    color: C.text,
    textAlign: 'center',
  },
  optionDestructive: {
    color: C.error,
    fontWeight: '500',
  },
  cancelLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: C.text,
    textAlign: 'center',
  },
});
