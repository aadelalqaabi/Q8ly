/**
 * Clean Social design system — KUWAI app.
 * Warm off-white canvas, rounded cards, Kuwait blue (#0033A0) accent.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

// Static light-mode defaults — kept for backward compat in module-level StyleSheet.create calls.
// Inside components always prefer useBrutColors() so colors respond to theme.
export const ACCENT    = '#0033A0';
export const TEXT      = '#1A1A1A';
export const MUTED     = '#8A857E';
export const SEPARATOR = '#E8E4DE';
export const FILL      = '#F0EDE8';
export const BG        = '#FAF8F5';

/** Returns live theme-aware color primitives. Use inside any function component. */
export function useBrutColors() {
  const { colors, isDark } = useTheme();
  return {
    ACCENT:    colors.accent,
    TEXT:      colors.text,
    MUTED:     colors.textMuted,
    SEPARATOR: colors.separator,
    FILL:      colors.fill,
    BG:        colors.background,
    CARD:      colors.card,
    isDark,
  };
}

export function isAr(i18n) {
  return i18n?.language === 'ar';
}

export function shout(text, ar) {
  if (!text) return '';
  return ar ? String(text) : String(text).toUpperCase();
}

export const ls = (n, ar) => (ar ? 0 : n * 0.5);

// ── Top nav row ──────────────────────────────────────────────────────────────
export function BrutNav({ onBack, right, leftLabel }) {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const ar = isAr(i18n);
  const { TEXT, BG, SEPARATOR } = useBrutColors();
  return (
    <View style={[styles.navRow, {
      paddingTop: insets.top + 14,
      flexDirection: ar ? 'row-reverse' : 'row',
      backgroundColor: BG,
      borderBottomColor: SEPARATOR,
    }]}>
      <TouchableOpacity onPress={onBack} hitSlop={hitSlop}>
        <Text style={[styles.navLink, { color: TEXT }]}>
          {ar
            ? `${leftLabel || t('common.back')} ›`
            : `‹ ${leftLabel || t('common.back')}`}
        </Text>
      </TouchableOpacity>
      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 18 }}>
        {right}
      </View>
    </View>
  );
}

export function BrutNavLink({ onPress, label, accent }) {
  const { i18n } = useTranslation();
  const ar = isAr(i18n);
  const { TEXT, ACCENT } = useBrutColors();
  return (
    <TouchableOpacity onPress={onPress} hitSlop={hitSlop}>
      <Text style={[styles.navLink, { color: accent ? ACCENT : TEXT }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────
export function BrutHero({ title, label, size = 44 }) {
  const { i18n } = useTranslation();
  const ar = isAr(i18n);
  const { TEXT, MUTED } = useBrutColors();
  return (
    <View style={{ paddingHorizontal: 4, paddingTop: 8 }}>
      <Text
        style={[styles.hero, { fontSize: size, lineHeight: ar ? size * 1.18 : size * 1.1, letterSpacing: ar ? 0 : -0.3, textAlign: ar ? 'right' : 'left', color: TEXT }]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {title}
      </Text>
      {label ? (
        <Text style={[styles.heroLabel, { textAlign: ar ? 'right' : 'left', color: MUTED }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

// ── Section caption ──────────────────────────────────────────────────────────
export function BrutSection({ title }) {
  const { i18n } = useTranslation();
  const ar = isAr(i18n);
  const { MUTED } = useBrutColors();
  return (
    <Text style={[styles.section, { textAlign: ar ? 'right' : 'left', color: MUTED }]}>
      {title}
    </Text>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────
export function BrutRow({ label, value, onPress, danger, accent, disabled }) {
  const { i18n } = useTranslation();
  const ar = isAr(i18n);
  const { TEXT, MUTED, ACCENT } = useBrutColors();
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={disabled}
      style={[styles.row, { flexDirection: ar ? 'row-reverse' : 'row', opacity: disabled ? 0.4 : 1 }]}
    >
      <Text style={[styles.rowLabel, { color: danger ? '#D32F2F' : accent ? ACCENT : TEXT }]}>
        {label}
      </Text>
      <View style={{ flex: 1 }} />
      {value != null && (
        <Text style={[styles.rowValue, { color: MUTED }]}>{value}</Text>
      )}
      {onPress && (
        <Text style={[styles.rowArrow, { color: MUTED }, ar ? { marginEnd: 0, marginStart: 10 } : { marginStart: 10 }]}>
          {ar ? '‹' : '›'}
        </Text>
      )}
    </Wrap>
  );
}

// ── Divider — hairline ────────────────────────────────────────────────────────
export function BrutRule({ thickness = StyleSheet.hairlineWidth, color, mt = 24, mb = 0 }) {
  const { SEPARATOR } = useBrutColors();
  return <View style={{ height: thickness, backgroundColor: color ?? SEPARATOR, marginTop: mt, marginBottom: mb }} />;
}

// ── Hairline divider ─────────────────────────────────────────────────────────
export function BrutHair({ inset = 0 }) {
  const { SEPARATOR } = useBrutColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: SEPARATOR, marginStart: inset }} />;
}

// ── Action CTA ───────────────────────────────────────────────────────────────
export function BrutAction({ label, onPress, accent, disabled }) {
  const { i18n } = useTranslation();
  const ar = isAr(i18n);
  const { ACCENT } = useBrutColors();
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.6} style={{ alignSelf: ar ? 'flex-end' : 'flex-start', paddingVertical: 6 }}>
      <Text style={[styles.action, { color: ACCENT }, disabled && { opacity: 0.35 }]}>
        {ar ? `‹ ${label}` : `${label} ›`}
      </Text>
    </TouchableOpacity>
  );
}

// ── Input — filled rounded rect ───────────────────────────────────────────────
export function BrutInput({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize, maxLength, multiline, accent, ...rest }) {
  const { i18n } = useTranslation();
  const ar = isAr(i18n);
  const { TEXT, MUTED, ACCENT, FILL, SEPARATOR } = useBrutColors();
  return (
    <View style={{ marginBottom: 16 }}>
      {label && (
        <Text style={[styles.inputLabel, { color: MUTED, textAlign: ar ? 'right' : 'left' }]}>
          {label}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          { color: TEXT, backgroundColor: FILL, borderColor: accent ? ACCENT : SEPARATOR, textAlign: ar ? 'right' : 'left' },
          multiline && { minHeight: 90, paddingTop: 14 },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={MUTED}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        multiline={multiline}
        {...rest}
      />
    </View>
  );
}

// ── Primary button ────────────────────────────────────────────────────────────
export function BrutBrick({ label, onPress, disabled, loading, accent }) {
  const { i18n } = useTranslation();
  const ar = isAr(i18n);
  const { TEXT, BG, ACCENT } = useBrutColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[styles.brick, { backgroundColor: accent ? ACCENT : TEXT, opacity: (disabled || loading) ? 0.4 : 1 }]}
    >
      <Text style={[styles.brickText, { color: BG }]}>
        {loading ? '...' : label}
      </Text>
    </TouchableOpacity>
  );
}

const hitSlop = { top: 12, bottom: 12, left: 12, right: 12 };

// Layout-only styles — no color values (colors applied inline via useBrutColors)
const styles = StyleSheet.create({
  navRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navLink: { fontSize: 15, fontWeight: '600' },

  hero: { fontSize: 44, fontWeight: '700' },
  heroLabel: { fontSize: 13, fontWeight: '400', marginTop: 4, letterSpacing: 0.1 },
  section: { fontSize: 12, fontWeight: '600', paddingTop: 24, paddingBottom: 8, letterSpacing: 0.2 },

  row: { minHeight: 52, alignItems: 'center', paddingHorizontal: 4 },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowValue: { fontSize: 14, fontWeight: '400' },
  rowArrow: { fontSize: 18, fontWeight: '300' },

  action: { fontSize: 15, fontWeight: '600' },

  inputLabel: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: {
    fontSize: 16, fontWeight: '400',
    paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },

  brick: {
    paddingVertical: 17, alignItems: 'center', justifyContent: 'center',
    borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  brickText: { fontSize: 16, fontWeight: '600' },
});

export default {
  BrutNav, BrutNavLink, BrutHero, BrutSection, BrutRow, BrutRule, BrutHair, BrutAction, BrutInput, BrutBrick,
  ACCENT, TEXT, MUTED, SEPARATOR, FILL, BG, useBrutColors,
};
