/**
 * Brutalist primitives — reusable building blocks for the KUWAI app.
 * Black and white as the canvas, Kuwait blue (#0033A0) used sparingly as accent.
 * - Typographic, tracked-letterspaced labels (English only — Arabic preserves ligatures)
 * - Hairline rules and 2pt hard rules as section dividers
 * - No rounded chips. No gradients. Massive headlines.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

export const ACCENT = '#0033A0';
export const TEXT = '#000000';
export const MUTED = '#6C6C70';
export const SEPARATOR = '#E5E5EA';
export const FILL = '#F2F2F7';
export const BG = '#FFFFFF';

export function isAr(i18n) {
  return i18n?.language === 'ar';
}

// Helper: uppercase only when not Arabic (Arabic has no caps + breaks ligatures)
export function shout(text, ar) {
  if (!text) return '';
  return ar ? String(text) : String(text).toUpperCase();
}

// Letter-spacing helper — never apply to Arabic
export const ls = (n, ar) => (ar ? 0 : n);

// ── Top nav row: back link + optional right-side links ──────────────────────
export function BrutNav({ onBack, right, leftLabel }) {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const ar = isAr(i18n);
  return (
    <View style={[styles.navRow, { paddingTop: insets.top + 14, flexDirection: ar ? 'row-reverse' : 'row' }]}>
      <TouchableOpacity onPress={onBack} hitSlop={hitSlop}>
        <Text style={styles.navLink}>
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
  return (
    <TouchableOpacity onPress={onPress} hitSlop={hitSlop}>
      <Text style={[styles.navLink, accent && { color: ACCENT }, { letterSpacing: ls(1.5, ar) }]}>
        {shout(label, ar)}
      </Text>
    </TouchableOpacity>
  );
}

// ── Hero: massive headline + tracked-letterspace caps subline ───────────────
export function BrutHero({ title, label, size = 56 }) {
  const { i18n } = useTranslation();
  const ar = isAr(i18n);
  return (
    <View style={{ paddingHorizontal: 4, paddingTop: 8 }}>
      <Text
        style={[
          styles.hero,
          { fontSize: size, lineHeight: ar ? size * 1.18 : size, letterSpacing: ls(-2, ar), textAlign: ar ? 'right' : 'left' },
        ]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {shout(title, ar)}
      </Text>
      {label ? (
        <Text style={[styles.heroLabel, { letterSpacing: ls(2, ar), textAlign: ar ? 'right' : 'left' }]}>
          {shout(label, ar)}
        </Text>
      ) : null}
    </View>
  );
}

// ── Section caption: tracked-letterspace caps, sits above content ───────────
export function BrutSection({ title }) {
  const { i18n } = useTranslation();
  const ar = isAr(i18n);
  return (
    <Text style={[styles.section, { letterSpacing: ls(2, ar), textAlign: ar ? 'right' : 'left' }]}>
      {shout(title, ar)}
    </Text>
  );
}

// ── Row: tracked label, optional value, → arrow ─────────────────────────────
export function BrutRow({ label, value, onPress, danger, accent, disabled }) {
  const { i18n } = useTranslation();
  const ar = isAr(i18n);
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
        danger && { color: '#D32F2F' },
        accent && { color: ACCENT },
        { letterSpacing: ls(1.5, ar) },
      ]}>
        {shout(label, ar)}
      </Text>
      <View style={{ flex: 1 }} />
      {value != null && (
        <Text style={[styles.rowValue, { letterSpacing: ls(0.5, ar) }]}>{value}</Text>
      )}
      {onPress && (
        <Text style={[styles.rowArrow, ar ? { marginEnd: 0, marginStart: 10 } : { marginStart: 10 }]}>
          {ar ? '←' : '→'}
        </Text>
      )}
    </Wrap>
  );
}

// ── Hard 2pt rule (use to divide major sections) ────────────────────────────
export function BrutRule({ thickness = 2, color = TEXT, mt = 24, mb = 0 }) {
  return <View style={{ height: thickness, backgroundColor: color, marginTop: mt, marginBottom: mb }} />;
}

// ── Hairline divider (between rows in a list) ───────────────────────────────
export function BrutHair({ inset = 0 }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: SEPARATOR, marginStart: inset }} />;
}

// ── Action: bare typographic CTA (KEY → ) ───────────────────────────────────
export function BrutAction({ label, onPress, accent, disabled }) {
  const { i18n } = useTranslation();
  const ar = isAr(i18n);
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.6} style={{ alignSelf: ar ? 'flex-end' : 'flex-start', paddingVertical: 6 }}>
      <Text style={[
        styles.action,
        accent && { color: ACCENT },
        disabled && { opacity: 0.35 },
        { letterSpacing: ls(2, ar) },
      ]}>
        {ar ? `← ${label}` : `${shout(label, false)} →`}
      </Text>
    </TouchableOpacity>
  );
}

// ── Brutalist input: caps label above, hairline-bottom field ────────────────
export function BrutInput({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize, maxLength, multiline, accent, ...rest }) {
  const { i18n } = useTranslation();
  const ar = isAr(i18n);
  return (
    <View style={{ marginBottom: 24 }}>
      {label && (
        <Text style={[styles.inputLabel, { letterSpacing: ls(2, ar), textAlign: ar ? 'right' : 'left' }]}>
          {shout(label, ar)}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          { textAlign: ar ? 'right' : 'left', borderBottomColor: accent ? ACCENT : TEXT },
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

// ── Solid black brick CTA — used at most once per screen ────────────────────
export function BrutBrick({ label, onPress, disabled, loading, accent }) {
  const { i18n } = useTranslation();
  const ar = isAr(i18n);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[styles.brick, { backgroundColor: accent ? ACCENT : TEXT, opacity: (disabled || loading) ? 0.35 : 1 }]}
    >
      <Text style={[styles.brickText, { letterSpacing: ls(2, ar) }]}>
        {loading ? '...' : shout(label, ar)}
      </Text>
    </TouchableOpacity>
  );
}

const hitSlop = { top: 12, bottom: 12, left: 12, right: 12 };

const styles = StyleSheet.create({
  navRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: BG,
  },
  navLink: { fontSize: 11, fontWeight: '900', color: TEXT },

  hero: { fontSize: 56, fontWeight: '900', color: TEXT },
  heroLabel: {
    fontSize: 11, fontWeight: '800', color: MUTED, marginTop: 6,
  },
  section: {
    fontSize: 11, fontWeight: '800', color: MUTED,
    paddingTop: 22, paddingBottom: 10,
  },

  row: {
    minHeight: 56, alignItems: 'center', paddingHorizontal: 4,
  },
  rowLabel: { fontSize: 14, fontWeight: '800', color: TEXT },
  rowValue: { fontSize: 13, fontWeight: '600', color: MUTED },
  rowArrow: { fontSize: 14, color: TEXT, fontWeight: '900' },

  action: { fontSize: 13, fontWeight: '900', color: TEXT },

  inputLabel: { fontSize: 11, fontWeight: '800', color: MUTED, marginBottom: 8 },
  input: {
    fontSize: 16, fontWeight: '600', color: TEXT,
    paddingVertical: 10, paddingHorizontal: 0,
    borderBottomWidth: 2, borderBottomColor: TEXT,
  },

  brick: {
    paddingVertical: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  brickText: { fontSize: 14, fontWeight: '900', color: BG },
});

export default {
  BrutNav, BrutNavLink, BrutHero, BrutSection, BrutRow, BrutRule, BrutHair, BrutAction, BrutInput, BrutBrick,
  ACCENT, TEXT, MUTED, SEPARATOR, FILL, BG,
};
