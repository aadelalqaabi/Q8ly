import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Share,
  Platform,
  Pressable,
} from "react-native";
import ViewShot from "react-native-view-shot";
import { useTranslation } from "react-i18next";

const BLUE = "#0033A0";
const GOLD = "#CBA052";
const CARD_W  = 300;
const CARD_H  = Math.round(CARD_W * (16 / 9)); // 533

const TOP_BAR_H = 6;
const BLUE_H    = CARD_H - TOP_BAR_H;

const BADGE_LABELS_EN = {
  government: "OFFICIAL",
  media:      "MEDIA",
  business:   "BUSINESS",
  influencer: "INFLUENCER",
  founder:    "FOUNDER",
};
const BADGE_LABELS_AR = {
  government: "رسمي",
  media:      "إعلام",
  business:   "أعمال",
  influencer: "مؤثر",
  founder:    "مؤسس",
};

const PALETTE = ["#1a3f8f","#0a5c2e","#7a2a10","#1a3a8f","#4a0a8a","#0a4a6b","#7a4a0a"];
function avatarBg(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export default function ShareProfileCard({ visible, onClose, profile }) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const shotRef  = useRef();
  const [sharing, setSharing] = useState(false);

  const profileUrl  = `https://kuwai.app/profile/${profile?.username}`;
  const badge       = profile?.verifiedBadge && profile.verifiedBadge !== "none"
    ? profile.verifiedBadge
    : null;
  const BADGE_LABELS = isArabic ? BADGE_LABELS_AR : BADGE_LABELS_EN;

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await shotRef.current.capture();
      await Share.share(
        Platform.OS === "ios"
          ? { url: uri }
          : { message: profileUrl, title: profile?.name }
      );
    } catch { /* silent */ }
    finally { setSharing(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>

        <ViewShot ref={shotRef} options={{ format: "png", quality: 1, pixelRatio: 1080 / CARD_W }}>
          <View style={s.card}>

            {/* ═════════════════════════════════
                1 · GOLD TOP BAR — brand anchor
            ═════════════════════════════════ */}
            <View style={s.topBar} />

            {/* ═════════════════════════════════
                2 · BLUE SECTION
            ═════════════════════════════════ */}
            <View style={s.blueSection}>

              {/* Background: diagonal gold hatch lines fill dead space */}
              {[0,1,2,3,4,5].map(i => (
                <View key={i} style={[s.hatch, { top: -30 + i * 68 }]} />
              ))}

              {/* Background: dual-tone KUWAI watermark — echoes the real logo */}
              <View style={s.wmWrap}>
                <Text style={s.wmTop}>KUWAI</Text>
                <Text style={s.wmBot}>KUWAI</Text>
              </View>

              {/* Background: large decorative ring (blueprint feel) */}
              <View style={s.ring} />

              {/* ── HEADER — mirrors the logo: dark word + white word ── */}
              <View style={s.header}>
                <View style={s.logoStack}>
                  <Text style={s.logoDark}>KUWAI</Text>
                  <Text style={s.logoWhite}>KUWAI</Text>
                </View>
                <View style={s.goldRule} />
                <Text style={s.tagline}>
                  {isArabic
                    ? "أول منصة تواصل اجتماعي كويتية"
                    : "KUWAIT'S FIRST SOCIAL APP"}
                </Text>
              </View>

              {/* ── PROFILE — fills the remaining blue space ── */}
              <View style={s.profileSection}>

                {/* Avatar: translucent white outer ring → solid gold ring */}
                <View style={s.avatarOuter}>
                  <View style={s.avatarGold}>
                    {profile?.profilePic ? (
                      <Image source={{ uri: profile.profilePic }} style={s.avatar} />
                    ) : (
                      <View style={[s.avatar, { backgroundColor: avatarBg(profile?.name) }]}>
                        <Text style={s.avatarInitial}>
                          {profile?.name?.[0]?.toUpperCase() || "?"}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <Text style={s.name} numberOfLines={2}>{profile?.name}</Text>

                {!!badge && (
                  <View style={s.badgePill}>
                    {badge === "founder" && <Text style={s.badgeStar}>★ </Text>}
                    <Text style={s.badgeLabel}>
                      {BADGE_LABELS[badge]}
                    </Text>
                    {badge === "founder" && <Text style={s.badgeStar}> ★</Text>}
                  </View>
                )}

              </View>
            </View>

            {/* URL at bottom of blue section */}
            <View style={s.urlRow}>
              <View style={s.urlDot} />
              <Text style={s.urlText} numberOfLines={1}>
                kuwai.app/profile/{profile?.username}
              </Text>
              <View style={s.urlDot} />
            </View>

          </View>
        </ViewShot>

        {/* ── Sheet buttons ── */}
        <TouchableOpacity
          style={[s.shareBtn, sharing && { opacity: 0.6 }]}
          onPress={handleShare}
          activeOpacity={0.85}
          disabled={sharing}
        >
          {sharing
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.shareBtnText}>{t("common.shareCard")}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={s.cancelBtn}>
          <Text style={s.cancelText}>{t("common.cancel")}</Text>
        </TouchableOpacity>

      </View>
    </Modal>
  );
}

const s = StyleSheet.create({

  // ── Modal chrome ─────────────────────────────────────────────────
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 44,
    alignItems: "center",
    gap: 14,
  },

  // ── Card shell ────────────────────────────────────────────────────
  card: {
    width: CARD_W,
    height: CARD_H,
  },

  // ── 1. Gold top bar ───────────────────────────────────────────────
  topBar: {
    width: CARD_W,
    height: TOP_BAR_H,
    backgroundColor: GOLD,
  },

  // ── 2. Blue section ───────────────────────────────────────────────
  blueSection: {
    width: CARD_W,
    height: BLUE_H,
    backgroundColor: BLUE,
    overflow: "hidden",
    justifyContent: "space-between",
  },

  // Diagonal hatch lines — fills negative space with subtle gold texture
  hatch: {
    position: "absolute",
    left: -80,
    right: -80,
    height: StyleSheet.hairlineWidth,
    backgroundColor: GOLD,
    opacity: 0.09,
    transform: [{ rotate: "-18deg" }],
  },

  // Giant dual-tone KUWAI echoing the actual app logo
  wmWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  wmTop: {
    fontSize: 82,
    fontWeight: "900",
    color: "#000",
    opacity: 0.12,
    lineHeight: 82,
  },
  wmBot: {
    fontSize: 82,
    fontWeight: "900",
    color: "#fff",
    opacity: 0.06,
    lineHeight: 82,
    marginTop: -10,
  },

  // Blueprint decorative ring
  ring: {
    position: "absolute",
    width: 380,
    height: 380,
    borderRadius: 190,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    top: -120,
    right: -110,
  },

  // Header — replicates the brand logo mark
  header: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 12,
    gap: 7,
    zIndex: 1,
  },
  logoStack: {
    alignItems: "center",
  },
  logoDark: {
    fontSize: 24,
    fontWeight: "900",
    color: "rgba(0,12,80,0.35)",
    lineHeight: 26,
  },
  logoWhite: {
    fontSize: 24,
    fontWeight: "900",
    color: "#fff",
    lineHeight: 26,
    marginTop: -7,  // overlap creates the split-text brand mark
  },
  goldRule: {
    width: 52,
    height: 2.5,
    backgroundColor: GOLD,
    borderRadius: 2,
  },
  tagline: {
    fontSize: 8,
    fontWeight: "800",
    color: GOLD,
    textTransform: "uppercase",
    opacity: 0.9,
  },

  // Profile section
  profileSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },

  // Avatar — white translucent outer ring + solid gold ring
  avatarOuter: {
    padding: 5,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 100,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  avatarGold: {
    padding: 3,
    borderWidth: 3,
    borderColor: GOLD,
    borderRadius: 100,
  },
  avatar: {
    width: 102,
    height: 102,
    borderRadius: 51,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: "800",
    color: "#fff",
  },

  name: {
    fontSize: 26,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    lineHeight: 31,
    marginBottom: 10,
  },

  // Badge: filled GOLD with dark text — pops hard on blue
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GOLD,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 10,
  },
  badgeStar: {
    color: "#2a1800",
    fontSize: 10,
  },
  badgeLabel: {
    color: "#2a1800",
    fontSize: 11,
    fontWeight: "800",
  },

  username: {
    fontSize: 13,
    color: "rgba(255,255,255,0.42)",
    fontWeight: "500",
  },

  urlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingBottom: 20,
  },
  urlDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: GOLD,
    opacity: 0.5,
  },
  urlText: {
    fontSize: 9,
    color: "rgba(255,255,255,0.45)",
  },

  // ── Sheet buttons ─────────────────────────────────────────────────
  shareBtn: {
    width: "100%",
    backgroundColor: BLUE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  shareBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  cancelBtn: { paddingVertical: 4 },
  cancelText: { fontSize: 16, color: "#6C6C70" },
});
