import React, { useRef, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Share, Platform, Pressable,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';

const BADGE_COLORS = {
  government: '#1A3A6B',
  media:      '#92500A',
  business:   '#0D5C2E',
  influencer: '#4A1A8A',
  founder:    '#1A3A6B',
};
const BADGE_LABELS = {
  government: 'OFFICIAL',
  media:      'MEDIA',
  business:   'BUSINESS',
  influencer: 'INFLUENCER',
  founder:    'FOUNDER',
};

const PALETTE = ['#1A3A6B', '#0D5C2E', '#8B3A1A', '#1A4A8B', '#4A1A8A', '#0A5A6B', '#8B5A0A'];
function avatarBg(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// Card width in points — ViewShot pixelRatio scales this to 1080px
const CARD_W = 300;
const CARD_H = CARD_W * (16 / 9); // 533pt → 1920px at pixelRatio 3.6

export default function ShareProfileCard({ visible, onClose, profile }) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const shotRef = useRef();
  const [sharing, setSharing] = useState(false);

  const profileUrl = `https://kuwai.app/profile/${profile?.username}`;
  const badge = profile?.verifiedBadge && profile.verifiedBadge !== 'none' ? profile.verifiedBadge : null;
  const isFounder = badge === 'founder';
  const tagline = isArabic ? 'أنا على كواي' : "I'm on KUWAI";

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await shotRef.current.capture();
      await Share.share(
        Platform.OS === 'ios'
          ? { url: uri }
          : { message: profileUrl, title: profile?.name }
      );
    } catch { /* silent */ } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Card — captured by ViewShot at 1080×1920 */}
        <ViewShot
          ref={shotRef}
          options={{ format: 'png', quality: 1, pixelRatio: 1080 / CARD_W }}
          style={styles.shotWrapper}
        >
          <View style={[styles.card, { width: CARD_W, height: CARD_H }]}>
            {/* Tagline top */}
            <Text style={styles.tagline}>{tagline}</Text>

            {/* Avatar */}
            <View style={styles.avatarWrap}>
              {profile?.profilePic ? (
                <Image source={{ uri: profile.profilePic }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: avatarBg(profile?.name) }]}>
                  <Text style={styles.avatarInitial}>
                    {profile?.name?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
            </View>

            {/* Name */}
            <Text style={styles.name}>{profile?.name}</Text>

            {/* Badge */}
            {!!badge && (
              <View style={[styles.badge, { backgroundColor: BADGE_COLORS[badge] }]}>
                {isFounder && <Text style={styles.badgeStar}>★</Text>}
                <Text style={styles.badgeText}>{BADGE_LABELS[badge]}</Text>
              </View>
            )}

            {/* Spacer */}
            <View style={{ flex: 1 }} />

            {/* QR code on white pill */}
            <View style={styles.qrWrap}>
              <QRCode
                value={profileUrl}
                size={90}
                color="#0033A0"
                backgroundColor="#fff"
              />
            </View>

            {/* Wordmark */}
            <Text style={styles.wordmark}>KUWAI</Text>
          </View>
        </ViewShot>

        {/* Share button */}
        <TouchableOpacity
          style={[styles.shareBtn, sharing && { opacity: 0.6 }]}
          onPress={handleShare}
          activeOpacity={0.85}
          disabled={sharing}
        >
          {sharing
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.shareBtnText}>{t('common.share', 'Share')}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.cancelText}>{t('common.cancel', 'Cancel')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 14,
  },
  shotWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: '#0033A0',
    borderRadius: 20,
    alignItems: 'center',
    paddingTop: 44,
    paddingBottom: 36,
    paddingHorizontal: 24,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 28,
  },
  avatarWrap: {
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 38,
    fontWeight: '700',
    color: '#fff',
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 10,
  },
  badgeStar: {
    color: '#FFD700',
    fontSize: 9,
    lineHeight: 11,
  },
  badgeText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  qrWrap: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 6,
  },
  shareBtn: {
    width: '100%',
    backgroundColor: '#0033A0',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  shareBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 4,
  },
  cancelText: {
    fontSize: 16,
    color: '#6C6C70',
  },
});
