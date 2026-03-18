import React, { useRef, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Share, Platform, Pressable,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';

const BLUE = '#0033A0';

const BADGE_LABELS = {
  government: 'OFFICIAL',
  media: 'MEDIA',
  business: 'BUSINESS',
  influencer: 'INFLUENCER',
  founder: 'FOUNDER',
};

const PALETTE = ['#1a3f8f', '#0a5c2e', '#7a2a10', '#1a3a8f', '#4a0a8a', '#0a4a6b', '#7a4a0a'];
function avatarBg(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

const CARD_W = 300;
const CARD_H = CARD_W * (16 / 9); // 9:16 → 533pt at 300pt wide

export default function ShareProfileCard({ visible, onClose, profile }) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const shotRef = useRef();
  const [sharing, setSharing] = useState(false);

  const profileUrl = `https://kuwai.app/profile/${profile?.username}`;
  const badge = profile?.verifiedBadge && profile.verifiedBadge !== 'none'
    ? profile.verifiedBadge : null;
  const isFounder = badge === 'founder';
  const tagline = isArabic ? 'أنا على كواي' : "I'M ON KUWAI";

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
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>

        <ViewShot
          ref={shotRef}
          options={{ format: 'png', quality: 1, pixelRatio: 1080 / CARD_W }}
        >
          <View style={{ width: CARD_W, height: CARD_H, overflow: 'hidden' }}>

            {/* ── TOP SECTION — blue ── */}
            <View style={s.top}>
              {/* Giant faded KUWAI watermark */}
              <Text style={s.watermark}>KUWAI</Text>

              {/* Decorative circles */}
              <View style={s.circle1} />
              <View style={s.circle2} />

              {/* Avatar */}
              <View style={s.avatarWrap}>
                {profile?.profilePic ? (
                  <Image source={{ uri: profile.profilePic }} style={s.avatar} />
                ) : (
                  <View style={[s.avatar, { backgroundColor: avatarBg(profile?.name) }]}>
                    <Text style={s.avatarInitial}>
                      {profile?.name?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Name */}
              <Text style={s.name} numberOfLines={2}>{profile?.name}</Text>

              {/* Badge */}
              {!!badge && (
                <View style={s.badgeRow}>
                  {isFounder && <Text style={s.star}>★</Text>}
                  <Text style={s.badgeText}>{BADGE_LABELS[badge]}</Text>
                </View>
              )}

              {/* Tagline */}
              <Text style={s.tagline}>{tagline}</Text>
            </View>

            {/* ── BOTTOM SECTION — white ── */}
            <View style={s.bottom}>
              {/* Blue accent line */}
              <View style={s.accentLine} />

              <View style={s.bottomInner}>
                {/* QR */}
                <QRCode
                  value={profileUrl}
                  size={72}
                  color={BLUE}
                  backgroundColor="#fff"
                />

                {/* Right side text */}
                <View style={s.bottomText}>
                  <Text style={s.bottomWordmark}>KUWAI</Text>
                  <Text style={s.bottomUrl} numberOfLines={1}>
                    kuwai.app/profile/{profile?.username}
                  </Text>
                  <Text style={s.bottomSub}>Find me on the app</Text>
                </View>
              </View>
            </View>

          </View>
        </ViewShot>

        {/* Share button */}
        <TouchableOpacity
          style={[s.shareBtn, sharing && { opacity: 0.6 }]}
          onPress={handleShare}
          activeOpacity={0.85}
          disabled={sharing}
        >
          {sharing
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.shareBtnText}>Share Card</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={s.cancelBtn}>
          <Text style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 16,
  },

  // ── Card top (blue) ──
  top: {
    width: CARD_W,
    height: CARD_W * (16 / 9) * 0.68, // 68% of card height
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 24,
  },
  watermark: {
    position: 'absolute',
    fontSize: 88,
    fontWeight: '900',
    color: '#fff',
    opacity: 0.05,
    letterSpacing: 12,
    top: 16,
    left: -8,
  },
  circle1: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    top: -60,
    right: -60,
  },
  circle2: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    bottom: -40,
    left: -30,
  },
  avatarWrap: {
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 44, fontWeight: '800', color: '#fff' },
  name: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: 33,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 16,
  },
  star: { color: '#FFD700', fontSize: 11 },
  badgeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },

  // ── Card bottom (white) ──
  bottom: {
    width: CARD_W,
    flex: 1,
    backgroundColor: '#fff',
  },
  accentLine: {
    width: '100%',
    height: 3,
    backgroundColor: BLUE,
  },
  bottomInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 16,
  },
  bottomText: { flex: 1 },
  bottomWordmark: {
    fontSize: 18,
    fontWeight: '900',
    color: BLUE,
    letterSpacing: 4,
    marginBottom: 4,
  },
  bottomUrl: {
    fontSize: 9,
    color: '#6C6C70',
    letterSpacing: 0.2,
    marginBottom: 3,
  },
  bottomSub: {
    fontSize: 9,
    color: '#aaa',
    letterSpacing: 0.3,
  },

  // ── Sheet buttons ──
  shareBtn: {
    width: '100%',
    backgroundColor: BLUE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  shareBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cancelBtn: { paddingVertical: 4 },
  cancelText: { fontSize: 16, color: '#6C6C70' },
});
