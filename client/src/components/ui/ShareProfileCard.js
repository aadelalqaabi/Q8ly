import React, { useRef, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Share, Platform, Pressable,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../../context/ThemeContext';

const BADGE_COLORS = {
  government: '#0033A0',
  media:      '#D97706',
  business:   '#16A34A',
  influencer: '#7C3AED',
  founder:    '#0033A0',
};
const BADGE_LABELS = {
  government: 'OFFICIAL',
  media:      'MEDIA',
  business:   'BUSINESS',
  influencer: 'INFLUENCER',
  founder:    'FOUNDER',
};

const PALETTE = ['#0033A0', '#007A3D', '#FF6B35', '#2196F3', '#9C27B0', '#00BCD4', '#FF9800'];
function avatarBg(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export default function ShareProfileCard({ visible, onClose, profile }) {
  const { colors: COLORS } = useTheme();
  const shotRef = useRef();
  const [sharing, setSharing] = useState(false);

  const profileUrl = `https://kuwai.app/profile/${profile?.username}`;
  const badge = profile?.verifiedBadge !== 'none' ? profile?.verifiedBadge : null;
  const isFounder = badge === 'founder';

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
      <View style={[styles.sheet, { backgroundColor: COLORS.white }]}>
        {/* Card — captured by ViewShot */}
        <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }} style={styles.shotWrapper}>
          <View style={styles.card}>
            {/* Top accent bar */}
            <View style={styles.accentBar} />

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

            {/* Name + username */}
            <Text style={styles.name}>{profile?.name}</Text>
            <Text style={styles.username}>@{profile?.username}</Text>

            {/* Badge */}
            {!!badge && (
              <View style={[styles.badge, { backgroundColor: BADGE_COLORS[badge] }]}>
                {isFounder && (
                  <Text style={styles.badgeStar}>★</Text>
                )}
                <Text style={styles.badgeText}>{BADGE_LABELS[badge]}</Text>
              </View>
            )}

            {/* Divider */}
            <View style={styles.divider} />

            {/* QR code */}
            <QRCode
              value={profileUrl}
              size={110}
              color="#000"
              backgroundColor="#fff"
            />

            <Text style={styles.profileUrl}>kuwai.app/profile/{profile?.username}</Text>

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
            : <Text style={styles.shareBtnText}>Share</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={[styles.cancelText, { color: COLORS.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 36,
    alignItems: 'center',
    gap: 12,
  },
  shotWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  card: {
    width: 300,
    backgroundColor: '#fff',
    borderRadius: 20,
    alignItems: 'center',
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  accentBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#0033A0',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginBottom: 28,
  },
  avatarWrap: {
    marginBottom: 14,
    shadowColor: '#0033A0',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#0033A0',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#000',
    letterSpacing: -0.3,
  },
  username: {
    fontSize: 14,
    color: '#6C6C70',
    marginTop: 2,
    marginBottom: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  badgeStar: {
    color: '#FFD700',
    fontSize: 9,
    lineHeight: 11,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 20,
  },
  profileUrl: {
    fontSize: 11,
    color: '#6C6C70',
    marginTop: 10,
    letterSpacing: 0.2,
  },
  wordmark: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0033A0',
    letterSpacing: 4,
    marginTop: 18,
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
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 16,
  },
});
