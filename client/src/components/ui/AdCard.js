import React, { useEffect, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { adsAPI } from '../../services/api';

export default function AdCard({ ad }) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  useEffect(() => {
    // Fire impression once when card mounts
    adsAPI.impression(ad._id).catch(() => {});
  }, [ad._id]);

  const handleCta = () => {
    adsAPI.click(ad._id).catch(() => {});
    Linking.openURL(ad.ctaUrl).catch(() => {});
  };

  return (
    <View style={styles.card}>
      {/* Ad label row */}
      <View style={styles.header}>
        <View style={styles.sponsorRow}>
          {ad.sponsorLogo ? (
            <Image source={{ uri: ad.sponsorLogo }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoPlaceholder]}>
              <Text style={styles.logoLetter}>{ad.sponsor?.[0]?.toUpperCase() || 'A'}</Text>
            </View>
          )}
          <View>
            <Text style={styles.sponsorName}>{ad.sponsor}</Text>
            <Text style={styles.adLabel}>إعلان مموّل</Text>
          </View>
        </View>
      </View>

      {/* Creative image */}
      {ad.imageUrl ? (
        <Image source={{ uri: ad.imageUrl }} style={styles.image} resizeMode="cover" />
      ) : null}

      {/* Text content */}
      <View style={styles.body}>
        <Text style={styles.title}>{ad.title}</Text>
        {ad.body ? <Text style={styles.bodyText}>{ad.body}</Text> : null}
      </View>

      {/* CTA button */}
      {ad.ctaText ? (
        <TouchableOpacity style={styles.cta} onPress={handleCta} activeOpacity={0.85}>
          <Text style={styles.ctaText}>{ad.ctaText}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Bottom separator */}
      <View style={styles.separator} />
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  card: {
    backgroundColor: C.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  sponsorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  logoPlaceholder: {
    backgroundColor: C.fill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textMuted,
  },
  sponsorName: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
  },
  adLabel: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 1,
  },
  image: {
    width: '100%',
    height: 200,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
    lineHeight: 21,
  },
  bodyText: {
    fontSize: 14,
    color: C.textMuted,
    lineHeight: 20,
  },
  cta: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 12,
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.separator,
  },
});
