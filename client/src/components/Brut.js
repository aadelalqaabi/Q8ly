/**
 * Brutalist primitives — reusable building blocks for the KUWAI app.
 * Black and white as the canvas, Kuwait blue (#0033A0) used sparingly as accent.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

// Static light-mode defaults — kept for backward compat in module-level StyleSheet.create calls.
// Inside components always prefer useBrutColors() so colors respond to theme.
export const ACCENT    = '#0033A0';
export const TEXT      = '#000000';
export const MUTED     = '#6C6C70';
export const SEPARATOR = '#E5E5EA';
export const FILL      = '#F2F2F7';
export const BG        = '#FFFFFF';

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

export const ls = (n, ar) => (ar ? 0 : n);

// ── Top nav row ──────────────────────────────────────────────────────────────
export function BrutNav({ onBack, right, leftLabel }) {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const ar = isAr(i18n);
  const { TEXT, BG } = useBrutColors();
  return (
    <View style={[styles.navRow, { paddingTop: insets.top + 14, flexDirection: ar ? 'row-reverse' : 'row', backgroundColor: BG }]}>
      <TouchableOpacity onPress={onBack} hitSlop={hitSlop}>
        <Text style={[styles.navLink, { color: TEXT }]}>
          {ar
            ? `${leftLabel || t('common.back')} →`
            : `← ${shout(leftLabel || t('common.back'), false)}`}
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
      <Text style={[styles.navLink, { color: accent ? ACCENT : TEXT, letterSpacing: ls(1.5, ar) }]}>
        {shout(label, ar)}
      </Text>
    </TouchableOpacity>
  );
}

// ── Hero: massive headline + tracked-letterspace caps subline ────────────────
export function BrutHero({ title, label, size = 56 }) {
  const { i18n } = useTranslation();
  const ar = isAr(i18n);
  const { TEXT, MUTED } = useBrutColors();
  return (
    <View style={{ paddingHorizontal: 4, paddingTop: 8 }}>
      <Text
        style={[styles.hero, { fontSize: size, lineHeight: ar ? size * 1.18 : size, letterSpacing: ls(-2, ar), textAlign: ar ? 'right' : 'left', color: TEXT }]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {shout(title, ar)}
      </Text>
      {label ? (
        <Text style={[styles.heroLabel, { letterSpacing: ls(2, ar), textAlign: ar ? 'right' : 'left', color: MUTED }]}>
          {shout(label, ar)}
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
    <Text style={[styles.section, { letterSpacing: ls(2, ar), textAlign: ar ? 'right' : 'left', color: MUTED }]}>
      {shout(title, ar)}
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
      <Text style={[
        styles.rowLabel,
        { color: danger ? '#D32F2F' : accent ? ACCENT : TEXT },
        { letterSpacing: ls(1.5, ar) },
      ]}>
        {shout(label, ar)}
      </Text>
      <View style={{ flex: 1 }} />
      {value != null && (
        <Text style={[styles.rowValue, { color: MUTED, letterSpacing: ls(0.5, ar) }]}>{value}</Text>
      )}
      {onPress && (
        <Text style={[styles.rowArrow, { color: TEXT }, ar ? { marginEnd: 0, marginStart: 10 } : { marginStart: 10 }]}>
          {ar ? '←' : '→'}
        </Text>
      )}
    </Wrap>
  );
}

// ── Hard rule ────────────────────────────────────────────────────────────────
export function BrutRule({ thickness = 2, color, mt = 24, mb = 0 }) {
  const { TEXT } = useBrutColors();
  return <View style={{ height: thickness, backgroundColor: color ?? TEXT, marginTop: mt, marginBottom: mb }} />;
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
  const { TEXT, ACCENT } = useBrutColors();
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.6} style={{ alignSelf: ar ? 'flex-end' : 'flex-start', paddingVertical: 6 }}>
      <Text style={[styles.action, { color: accent ? ACCENT : TEXT }, disabled && { opacity: 0.35 }, { letterSpacing: ls(2, ar) }]}>
        {ar ? `← ${label}` : `${shout(label, false)} →`}
      </Text>
    </TouchableOpacity>
  );
}

// ── Input ────────────────────────────────────────────────────────────────────
export function BrutInput({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize, maxLength, multiline, accent, ...rest }) {
  const { i18n } = useTranslation();
  const ar = isAr(i18n);
  const { TEXT, MUTED, ACCENT } = useBrutColors();
  return (
    <View style={{ marginBottom: 24 }}>
      {label && (
        <Text style={[styles.inputLabel, { color: MUTED, letterSpacing: ls(2, ar), textAlign: ar ? 'right' : 'left' }]}>
          {shout(label, ar)}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          { color: TEXT, borderBottomColor: accent ? ACCENT : TEXT, textAlign: ar ? 'right' : 'left' },
          multiline && { minHeight: 80 },
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

// ── Brick CTA ────────────────────────────────────────────────────────────────
export function BrutBrick({ label, onPress, disabled, loading, accent }) {
  const { i18n } = useTranslation();
  const ar = isAr(i18n);
  const { TEXT, BG, ACCENT } = useBrutColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[styles.brick, { backgroundColor: accent ? ACCENT : TEXT, opacity: (disabled || loading) ? 0.35 : 1 }]}
    >
      <Text style={[styles.brickText, { color: BG, letterSpacing: ls(2, ar) }]}>
        {loading ? '...' : shout(label, ar)}
      </Text>
    </TouchableOpacity>
  );
}

const hitSlop = { top: 12, bottom: 12, left: 12, right: 12 };

// Layout-only styles — no color values here (colors applied inline via useBrutColors)
const styles = StyleSheet.create({
  navRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  navLink: { fontSize: 11, fontWeight: '900' },

  hero: { fontSize: 56, fontWeight: '900' },
  heroLabel: { fontSize: 11, fontWeight: '800', marginTop: 6 },
  section: { fontSize: 11, fontWeight: '800', paddingTop: 22, paddingBottom: 10 },

  row: { minHeight: 56, alignItems: 'center', paddingHorizontal: 4 },
  rowLabel: { fontSize: 14, fontWeight: '800' },
  rowValue: { fontSize: 13, fontWeight: '600' },
  rowArrow: { fontSize: 14, fontWeight: '900' },

  action: { fontSize: 13, fontWeight: '900' },

  inputLabel: { fontSize: 11, fontWeight: '800', marginBottom: 8 },
  input: {
    fontSize: 16, fontWeight: '600',
    paddingVertical: 10, paddingHorizontal: 0,
    borderBottomWidth: 2,
  },

  brick: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  brickText: { fontSize: 14, fontWeight: '900' },
});

export default {
  BrutNav, BrutNavLink, BrutHero, BrutSection, BrutRow, BrutRule, BrutHair, BrutAction, BrutInput, BrutBrick,
  ACCENT, TEXT, MUTED, SEPARATOR, FILL, BG, useBrutColors,
};
