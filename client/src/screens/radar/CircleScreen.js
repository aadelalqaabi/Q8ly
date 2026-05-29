import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions, Animated,
  Modal, PixelRatio, Alert, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { hachiAPI, uploadAPI } from '../../services/api';
import { getSocket, joinHachiRoom, leaveHachiRoom, sendHachiMessage, sendHachiQuestion, sendHachiDecide, sendHachiDecideVote, deleteHachiMessage, sendHachiReport } from '../../services/socket';
import { Ionicons } from '@expo/vector-icons';
import { useBrutColors, isAr } from '../../components/Brut';
import { PollCard, PollComposer } from '../../components/Poll';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

let Location = null;
try { Location = require('expo-location'); } catch {}

const SW = Dimensions.get('window').width;
const SH = Dimensions.get('window').height;
const CARD_IMAGE_HEIGHT = SW * 0.72;

function cdnUrl(url, px) {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  const w = PixelRatio.getPixelSizeForLayoutSize(px);
  return url.replace('/upload/', `/upload/w_${w},f_webp,q_auto:good/`);
}

function timeAgo(date, ar) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return ar ? 'الآن' : 'now';
  if (diff < 3600) return ar ? `${Math.floor(diff / 60)}د` : `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return ar ? `${Math.floor(diff / 3600)}س` : `${Math.floor(diff / 3600)}h`;
  return ar ? `${Math.floor(diff / 86400)}ي` : `${Math.floor(diff / 86400)}d`;
}

// ── Comment row ───────────────────────────────────────────────────────────────
function CommentRow({ msg, currentUserId, ar, onLikeToggle }) {
  const { TEXT, MUTED, ACCENT, FILL, SEPARATOR } = useBrutColors();
  const liked = (msg.likes || []).some(
    (l) => (typeof l === 'string' ? l : l?.toString()) === currentUserId?.toString()
  );
  const likeCount = (msg.likes || []).length;
  const isAnonPost = !msg.user?.name && !msg.user?.username;
  const displayName = isAnonPost ? (ar ? 'شخص هنا' : 'Someone here') : msg.user.name;
  const displayPic = !isAnonPost && msg.user?.profilePic;

  return (
    <View style={[cmtStyles.row, { borderTopColor: SEPARATOR }]}>
      <View style={[cmtStyles.dot, { backgroundColor: isAnonPost ? ACCENT + '18' : FILL }]}>
        {displayPic
          ? <Image source={{ uri: displayPic }} style={{ width: 24, height: 24, borderRadius: 12 }} />
          : isAnonPost
            ? <Text style={{ fontSize: 10 }}>👤</Text>
            : <Text style={{ fontSize: 10, fontWeight: '700', color: ACCENT }}>{displayName?.[0]?.toUpperCase()}</Text>
        }
      </View>
      <View style={{ flex: 1 }}>
        <View style={[cmtStyles.header, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
          <Text style={[cmtStyles.author, { color: MUTED }]}>{displayName}</Text>
          <Text style={[cmtStyles.ts, { color: MUTED }]}>{timeAgo(msg.createdAt, ar)}</Text>
        </View>
        {!!msg.text && (
          <Text style={[cmtStyles.text, { color: TEXT, textAlign: ar ? 'right' : 'left' }]}>
            {msg.text}
          </Text>
        )}
        {!!msg.image && (
          <View style={[cmtStyles.imgWrap, { backgroundColor: FILL }]}>
            <Image source={{ uri: cdnUrl(msg.image, 160) }} style={cmtStyles.img} resizeMode="cover" />
          </View>
        )}
      </View>
      <TouchableOpacity style={cmtStyles.likeBtn} onPress={() => onLikeToggle(msg._id)} activeOpacity={0.7}>
        <Ionicons name={liked ? 'heart' : 'heart-outline'} size={14} color={liked ? '#FF3B30' : MUTED} />
        {likeCount > 0 && <Text style={[cmtStyles.likeCount, { color: liked ? '#FF3B30' : MUTED }]}>{likeCount}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const cmtStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth },
  dot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  header: { alignItems: 'center', gap: 6, marginBottom: 2 },
  author: { fontSize: 12, fontWeight: '500' },
  ts: { fontSize: 11 },
  text: { fontSize: 14, lineHeight: 19 },
  imgWrap: { marginTop: 6, borderRadius: 8, overflow: 'hidden', alignSelf: 'flex-start' },
  img: { width: 120, height: 120 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingTop: 2 },
  likeCount: { fontSize: 11, fontWeight: '500' },
});

// ── Question card ─────────────────────────────────────────────────────────────
function QuestionCard({ msg, answers, currentUserId, ar, onLikeToggle, onAnswer }) {
  const { TEXT, MUTED, ACCENT, BG, FILL, SEPARATOR } = useBrutColors();
  const [expanded, setExpanded] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const answerCount = answers.length;

  const handleSubmitAnswer = () => {
    if (!answerText.trim()) return;
    onAnswer(msg._id, answerText.trim());
    setAnswerText('');
  };

  return (
    <View style={[qStyles.card, { backgroundColor: BG, borderBottomColor: SEPARATOR }]}>
      <View style={[qStyles.questionBubble, { backgroundColor: ACCENT + '12', borderColor: ACCENT + '30' }]}>
        <Text style={qStyles.qIcon}>❓</Text>
        <Text style={[qStyles.questionText, { color: TEXT, textAlign: ar ? 'right' : 'left' }]}>
          {msg.text}
        </Text>
      </View>

      <Text style={[qStyles.meta, { color: MUTED, textAlign: ar ? 'right' : 'left' }]}>
        {timeAgo(msg.createdAt, ar)} · {msg.user?.name || msg.user?.username || (ar ? 'شخص هنا' : 'Someone here')}
      </Text>

      <TouchableOpacity
        style={[qStyles.seeBtn, { borderColor: SEPARATOR }]}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={[qStyles.seeBtnText, { color: ACCENT }]}>
          {expanded
            ? (ar ? 'إخفاء الإجابات' : 'Hide answers')
            : answerCount > 0
              ? (ar ? `عرض ${answerCount} إجابة` : `See ${answerCount} answer${answerCount !== 1 ? 's' : ''}`)
              : (ar ? 'لا إجابات · أجب الآن' : 'No answers · Answer now')
          }
        </Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={ACCENT} />
      </TouchableOpacity>

      {expanded && (
        <View style={[qStyles.answersSection, { borderTopColor: FILL }]}>
          {answers.map((a) => (
            <CommentRow
              key={String(a._id)}
              msg={a}
              currentUserId={currentUserId}
              ar={ar}
              onLikeToggle={onLikeToggle}
            />
          ))}
          <View style={[qStyles.answerInput, { backgroundColor: FILL, borderTopColor: SEPARATOR }]}>
            <TextInput
              style={[qStyles.answerField, { color: TEXT, textAlign: ar ? 'right' : 'left' }]}
              value={answerText}
              onChangeText={setAnswerText}
              placeholder={ar ? 'أجب…' : 'Answer…'}
              placeholderTextColor={MUTED}
              maxLength={300}
              returnKeyType="send"
              onSubmitEditing={handleSubmitAnswer}
            />
            <TouchableOpacity
              onPress={handleSubmitAnswer}
              disabled={!answerText.trim()}
              style={[qStyles.answerSend, { backgroundColor: answerText.trim() ? ACCENT : SEPARATOR }]}
              activeOpacity={0.75}
            >
              <Ionicons name={ar ? 'arrow-back' : 'arrow-forward'} size={14} color={answerText.trim() ? '#fff' : MUTED} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const qStyles = StyleSheet.create({
  card: { borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 },
  questionBubble: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  qIcon: { fontSize: 20, lineHeight: 26 },
  questionText: { flex: 1, fontSize: 16, fontWeight: '600', lineHeight: 23 },
  meta: { fontSize: 12, marginBottom: 10 },
  seeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  seeBtnText: { fontSize: 13, fontWeight: '600' },
  answersSection: { borderTopWidth: 2, marginTop: 2 },
  answerInput: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  answerField: { flex: 1, fontSize: 14, paddingVertical: 4 },
  answerSend: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
});

// ── Post card ─────────────────────────────────────────────────────────────────
function PostCard({ msg, comments, currentUserId, ar, onImagePress, onLikeToggle, onReply, onDelete, onReport }) {
  const { TEXT, MUTED, ACCENT, BG, FILL, SEPARATOR } = useBrutColors();
  const [showComments, setShowComments] = useState(false);
  const liked = (msg.likes || []).some(
    (l) => (typeof l === 'string' ? l : l?.toString()) === currentUserId?.toString()
  );
  const likeCount = (msg.likes || []).length;
  const hasImage = !!msg.image;
  const hasText = !!msg.text;
  const ts = timeAgo(msg.createdAt, ar);
  const isAnonPost = !msg.user?.name && !msg.user?.username;
  const displayName = isAnonPost ? (ar ? 'شخص هنا' : 'Someone here') : msg.user.name;
  const displayPic = !isAnonPost && msg.user?.profilePic;
  const isOwn = msg.user?._id?.toString() === currentUserId?.toString();

  const handleMore = () => {
    if (isOwn) {
      Alert.alert(
        ar ? 'حذف المنشور؟' : 'Delete post?',
        ar ? 'سيُحذف هذا المنشور نهائياً' : 'This will be permanently removed.',
        [
          { text: ar ? 'حذف' : 'Delete', style: 'destructive', onPress: () => onDelete(msg._id) },
          { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      Alert.alert(
        ar ? 'الإبلاغ عن المنشور' : 'Report post',
        ar ? 'هل تريد الإبلاغ عن هذا المنشور؟' : 'Report this post as inappropriate?',
        [
          { text: ar ? 'محتوى مسيء' : 'Offensive',  onPress: () => onReport(msg._id, 'offensive') },
          { text: ar ? 'بريد مزعج' : 'Spam',         onPress: () => onReport(msg._id, 'spam') },
          { text: ar ? 'محتوى آخر' : 'Other',        onPress: () => onReport(msg._id, 'other') },
          { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  return (
    <View style={[cardStyles.card, { backgroundColor: BG, borderBottomColor: SEPARATOR }]}>
      <View style={[cardStyles.meta, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
        <View style={[cardStyles.anonDot, { backgroundColor: isAnonPost ? ACCENT + '22' : FILL }]}>
          {displayPic
            ? <Image source={{ uri: displayPic }} style={{ width: 30, height: 30, borderRadius: 15 }} />
            : isAnonPost
              ? <Text style={cardStyles.anonIcon}>👤</Text>
              : <Text style={[cardStyles.anonIcon, { fontWeight: '700', color: ACCENT }]}>{displayName?.[0]?.toUpperCase()}</Text>
          }
        </View>
        <Text style={[cardStyles.author, { color: TEXT }]}>{displayName}</Text>
        {!hasImage && <Text style={[cardStyles.ts, { color: MUTED }]}>{ts}</Text>}
        <TouchableOpacity onPress={handleMore} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="ellipsis-horizontal" size={16} color={MUTED} />
        </TouchableOpacity>
      </View>

      {hasImage && (
        <TouchableOpacity activeOpacity={0.92} onPress={() => onImagePress(msg.image)}>
          <Image source={{ uri: cdnUrl(msg.image, SW) }} style={{ width: SW, height: CARD_IMAGE_HEIGHT }} resizeMode="cover" />
          <View style={cardStyles.imgTs}>
            <Text style={cardStyles.imgTsText}>{ts}</Text>
          </View>
        </TouchableOpacity>
      )}

      {hasText && (
        <Text style={[cardStyles.text, { color: TEXT, textAlign: ar ? 'right' : 'left' }]}>{msg.text}</Text>
      )}

      <View style={[cardStyles.actions, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity
          style={cardStyles.actionBtn}
          onPress={() => { setShowComments((v) => !v); onReply(msg); }}
          activeOpacity={0.7}
        >
          <Ionicons name={showComments ? 'chatbubble' : 'chatbubble-outline'} size={16} color={showComments ? ACCENT : MUTED} />
          {comments.length > 0 && <Text style={[cardStyles.actionLabel, { color: showComments ? ACCENT : MUTED }]}>{comments.length}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={cardStyles.actionBtn} onPress={() => onLikeToggle(msg._id)} activeOpacity={0.7}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? '#FF3B30' : MUTED} />
          {likeCount > 0 && <Text style={[cardStyles.actionLabel, { color: liked ? '#FF3B30' : MUTED }]}>{likeCount}</Text>}
        </TouchableOpacity>
      </View>

      {showComments && comments.length > 0 && (
        <View style={[cardStyles.commentSection, { borderTopColor: FILL }]}>
          {comments.map((c) => (
            <CommentRow key={String(c._id)} msg={c} currentUserId={currentUserId} ar={ar} onLikeToggle={onLikeToggle} />
          ))}
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: { borderBottomWidth: StyleSheet.hairlineWidth },
  meta: { alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  anonDot: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  anonIcon: { fontSize: 13 },
  author: { flex: 1, fontSize: 14, fontWeight: '600' },
  ts: { fontSize: 12 },
  imgTs: { position: 'absolute', bottom: 8, left: 10, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  imgTsText: { color: '#fff', fontSize: 10, fontWeight: '500' },
  text: { fontSize: 16, lineHeight: 23, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 4 },
  actions: { paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', gap: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionLabel: { fontSize: 13, fontWeight: '500' },
  commentSection: { borderTopWidth: 2 },
});

// ── Stamp modal ───────────────────────────────────────────────────────────────
function StampModal({ visible, stampUrl, venueName, onClose, ar }) {
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 180 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.6);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[stampStyles.backdrop, { opacity: opacityAnim }]}>
        <Animated.View style={[stampStyles.card, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={stampStyles.congrats}>{ar ? '🎉 جمعت الطابع!' : '🎉 Stamp Collected!'}</Text>
          <Text style={stampStyles.venue}>{venueName}</Text>
          {stampUrl && <Image source={{ uri: stampUrl }} style={stampStyles.stamp} resizeMode="contain" />}
          <TouchableOpacity style={stampStyles.btn} onPress={onClose} activeOpacity={0.8}>
            <Text style={stampStyles.btnText}>{ar ? 'رائع!' : 'Nice!'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const stampStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
  card: { width: 300, backgroundColor: '#fff', borderRadius: 28, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 32, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  congrats: { fontSize: 20, fontWeight: '800', color: '#000', marginBottom: 4, textAlign: 'center' },
  venue: { fontSize: 14, color: '#6C6C70', marginBottom: 20, textAlign: 'center' },
  stamp: { width: 220, height: 220, marginBottom: 24 },
  btn: { backgroundColor: '#0033A0', borderRadius: 22, paddingHorizontal: 48, paddingVertical: 14 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

// ── Photo reel item (full-screen TikTok style) ────────────────────────────────
function ReelItem({ msg, currentUserId, ar, onLikeToggle, height }) {
  const liked = (msg.likes || []).some(
    (l) => (typeof l === 'string' ? l : l?.toString()) === currentUserId?.toString()
  );
  const likeCount = (msg.likes || []).length;
  const isAnonPost = !msg.user?.name && !msg.user?.username;
  const displayName = isAnonPost ? (ar ? 'شخص هنا' : 'Someone here') : (msg.user?.name || msg.user?.username || '?');

  const lastTap = useRef(null);
  const heartAnim = useRef(new Animated.Value(0)).current;

  const handleTap = () => {
    const now = Date.now();
    if (lastTap.current && now - lastTap.current < 300) {
      lastTap.current = null;
      if (!liked) onLikeToggle(msg._id);
      // burst animation
      heartAnim.setValue(0);
      Animated.sequence([
        Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 180 }),
        Animated.delay(400),
        Animated.timing(heartAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      lastTap.current = now;
    }
  };

  return (
    <TouchableOpacity activeOpacity={1} onPress={handleTap} style={{ width: SW, height, backgroundColor: '#000' }}>
      <Image source={{ uri: cdnUrl(msg.image, SW) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={reelStyles.bottomGradient}
        pointerEvents="none"
      />
      {/* Double-tap heart burst */}
      <Animated.View style={[reelStyles.heartBurst, {
        opacity: heartAnim,
        transform: [{ scale: heartAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.3] }) }],
      }]} pointerEvents="none">
        <Ionicons name="heart" size={90} color="#FF3B30" />
      </Animated.View>

      <View style={[reelStyles.info, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
        <View style={{ flex: 1 }}>
          <Text style={reelStyles.name}>{displayName}</Text>
          {!!msg.text && <Text style={reelStyles.caption} numberOfLines={2}>{msg.text}</Text>}
          <Text style={reelStyles.ts}>{timeAgo(msg.createdAt, ar)}</Text>
        </View>
        <TouchableOpacity style={reelStyles.likeBtn} onPress={() => onLikeToggle(msg._id)} activeOpacity={0.7}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={28} color={liked ? '#FF3B30' : '#fff'} />
          {likeCount > 0 && <Text style={reelStyles.likeCount}>{likeCount}</Text>}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const reelStyles = StyleSheet.create({
  bottomGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 180 },
  heartBurst: { position: 'absolute', top: '40%', left: '50%', marginLeft: -45, marginTop: -45 },
  info: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 32, alignItems: 'flex-end', gap: 16 },
  name: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  caption: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18 },
  ts: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4 },
  likeBtn: { alignItems: 'center', gap: 4, marginBottom: 40 },
  likeCount: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

// ── Decide card ───────────────────────────────────────────────────────────────
const DECIDE_SHAPES = ['▲', '◆', '●', '■'];

// Card: marginHorizontal 14 (×2=28) + padding 14 (×2=28) + gap 8 → 2 tiles per row
const TILE_SIZE = (SW - 28 - 28 - 8) / 2;

function DecideCard({ msg, currentUserId, ar, onVote, onDelete, navigation }) {
  const { TEXT, MUTED, ACCENT, BG, FILL, SEPARATOR } = useBrutColors();
  const opts = msg.decideOptions || [];
  const totalVotes = opts.reduce((s, o) => s + (o.votes?.length || 0), 0);
  const myVoteOpt = opts.find((o) => (o.votes || []).some(
    (v) => (typeof v === 'string' ? v : v?.toString()) === currentUserId?.toString()
  ));
  const isAnon = !msg.user?.name && !msg.user?.username;
  const name = isAnon ? (ar ? 'شخص هنا' : 'Someone here') : (msg.user?.name || msg.user?.username);
  const isOwn = msg.user?._id?.toString() === currentUserId?.toString() || msg.user?.toString() === currentUserId?.toString();

  const handleTilePress = (opt) => {
    const alreadyVoted = (opt.votes || []).some(
      (v) => (typeof v === 'string' ? v : v?.toString()) === currentUserId?.toString()
    );
    // Tapping own vote removes it; tapping another switches vote
    onVote(msg._id, opt._id, alreadyVoted ? 'remove' : 'set');
  };

  const confirmDelete = () => {
    Alert.alert(
      ar ? 'حذف القرار؟' : 'Delete decide?',
      ar ? 'سيُحذف هذا القرار نهائياً' : 'This will be permanently removed.',
      [
        { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: ar ? 'حذف' : 'Delete', style: 'destructive', onPress: () => onDelete(msg._id) },
      ]
    );
  };

  return (
    <View style={[dcStyles.card, { backgroundColor: BG, borderColor: SEPARATOR }]}>
      <View style={dcStyles.header}>
        <View style={[dcStyles.avatar, { backgroundColor: FILL }]}>
          {!isAnon && msg.user?.profilePic
            ? <Image source={{ uri: msg.user.profilePic }} style={dcStyles.avatarImg} />
            : <Ionicons name="person" size={14} color={MUTED} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[dcStyles.name, { color: TEXT }]}>{name}</Text>
          <Text style={[dcStyles.time, { color: MUTED }]}>{timeAgo(msg.createdAt, ar)}</Text>
        </View>
        <Text style={[dcStyles.tag, { color: '#fff', backgroundColor: '#E21B3C' }]}>{ar ? 'قرر' : 'Decide'}</Text>
        {isOwn && (
          <TouchableOpacity onPress={confirmDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginLeft: 8 }}>
            <Ionicons name="trash-outline" size={16} color={MUTED} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={[dcStyles.question, { color: TEXT }]}>{msg.decideQuestion}</Text>

      {[0, 1].map((row) => {
        const rowOpts = opts.filter((_, i) => i % 2 === row);
        if (!rowOpts.length) return null;
        return (
          <View key={row} style={[dcStyles.row, row === 0 ? { marginBottom: 8 } : {}]}>
            {rowOpts.map((opt) => {
              const voted = (opt.votes || []).some((v) => (typeof v === 'string' ? v : v?.toString()) === currentUserId?.toString());
              const pct = totalVotes > 0 ? Math.round((opt.votes?.length || 0) / totalVotes * 100) : 0;
              const dimmed = myVoteOpt && !voted;
              return (
                <TouchableOpacity
                  key={String(opt._id)}
                  style={[dcStyles.tile, { opacity: dimmed ? 0.45 : 1, borderColor: voted ? ACCENT : SEPARATOR, borderWidth: voted ? 2 : StyleSheet.hairlineWidth, backgroundColor: FILL }]}
                  onPress={() => handleTilePress(opt)}
                  activeOpacity={0.85}
                >
                  {!!opt.imageUrl && <Image source={{ uri: opt.imageUrl }} style={dcStyles.tileImage} resizeMode="cover" />}
                  {myVoteOpt && (
                    <View style={[dcStyles.tileOverlay, { backgroundColor: voted ? ACCENT + 'BB' : 'rgba(0,0,0,0.32)' }]}>
                      <Text style={dcStyles.tilePct}>{pct}%</Text>
                      {voted && <Ionicons name="checkmark-circle" size={16} color="#fff" />}
                    </View>
                  )}
                  {!!opt.imageUrl && (
                    <TouchableOpacity
                      style={[dcStyles.viewBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                      onPress={() => navigation.navigate('MediaViewer', { media: [{ uri: opt.imageUrl, type: 'image' }], initialIndex: 0 })}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={dcStyles.viewBtnText}>{ar ? 'عرض' : 'View'}</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })}

      <Text style={[dcStyles.totalVotes, { color: MUTED }]}>
        {totalVotes} {ar ? 'صوت' : totalVotes === 1 ? 'vote' : 'votes'}
        {myVoteOpt
          ? <Text> · {ar ? 'اضغط لتغيير صوتك' : 'tap to change vote'}</Text>
          : <Text> · {ar ? 'اضغط للتصويت' : 'tap to vote'}</Text>}
      </Text>
    </View>
  );
}

const dcStyles = StyleSheet.create({
  card: { marginHorizontal: 14, marginVertical: 6, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 32, height: 32, borderRadius: 16 },
  name: { fontSize: 13, fontWeight: '600' },
  time: { fontSize: 11 },
  tag: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  question: { fontSize: 16, fontWeight: '700', marginBottom: 14, lineHeight: 22 },
  row: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, height: TILE_SIZE * 0.85, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  tileImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  tileOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tilePct: { fontSize: 22, fontWeight: '900', color: '#fff' },
  viewBtn: { position: 'absolute', bottom: 8, right: 8, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  viewBtnText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  totalVotes: { fontSize: 12, marginTop: 10 },
});

// ── Decide composer modal ─────────────────────────────────────────────────────
const DCMP_TILE_SIZE = (SW - 40 - 8) / 2;

function DecideComposer({ visible, onClose, onSubmit, ar }) {
  const { TEXT, MUTED, ACCENT, BG, FILL, SEPARATOR } = useBrutColors();
  const [question, setQuestion] = useState('');
  // each slot: null | { uri: string, cloudUrl: string | null }
  const [slots, setSlots] = useState([null, null, null, null]);

  const reset = () => { setQuestion(''); setSlots([null, null, null, null]); };

  const pickImage = async (idx) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(ar ? 'لا يوجد إذن' : 'Permission denied', ar ? 'يرجى السماح بالوصول إلى الصور' : 'Allow photo library access in Settings.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const { uri, mimeType } = result.assets[0];

      // Show local preview immediately
      setSlots((prev) => prev.map((s, i) => i === idx ? { uri, cloudUrl: null, uploading: true } : s));

      // Upload in background
      const formData = new FormData();
      formData.append('images', { uri, type: mimeType || 'image/jpeg', name: `decide_${idx}.jpg` });
      const res = await uploadAPI.images(formData);
      const cloudUrl = res.urls?.[0] || res.url || null;

      setSlots((prev) => prev.map((s, i) => i === idx ? { uri, cloudUrl, uploading: false } : s));
    } catch (err) {
      Alert.alert(ar ? 'خطأ' : 'Upload failed', err.message || '');
      setSlots((prev) => prev.map((s, i) => i === idx ? null : s));
    }
  };

  const removeSlot = (idx) => setSlots((prev) => prev.map((s, i) => i === idx ? null : s));

  const filledSlots = slots.filter(Boolean);
  const allUploaded = filledSlots.every((s) => s.cloudUrl);
  const anyUploading = filledSlots.some((s) => s.uploading);
  const canSubmit = question.trim().length > 0 && filledSlots.length >= 2 && allUploaded && !anyUploading;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const opts = filledSlots.map((s) => ({ text: '', imageUrl: s.cloudUrl }));
    onSubmit(question.trim(), opts);
    reset();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => { reset(); onClose(); }} />
        <View style={[dcmpStyles.sheet, { backgroundColor: BG, borderTopColor: SEPARATOR }]}>
          <Text style={[dcmpStyles.title, { color: TEXT }]}>{ar ? 'قرر عني' : 'Decide for me'}</Text>
          <Text style={[dcmpStyles.sub, { color: MUTED }]}>
            {ar ? 'اختر صورتين أو أكثر وأضف سؤالك' : 'Pick 2–4 images and add your question'}
          </Text>

          <View style={{ marginBottom: 16 }}>
          {[[0, 1], [2, 3]].map((pair, ri) => (
            <View key={ri} style={[dcmpStyles.tileRow, ri === 0 ? { marginBottom: 8 } : {}]}>
              {pair.map((idx) => {
                const slot = slots[idx];
                const shape = DECIDE_SHAPES[idx];
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[dcmpStyles.tile, { backgroundColor: FILL, borderColor: slot ? ACCENT : SEPARATOR }]}
                    onPress={() => !slot?.uploading && pickImage(idx)}
                    activeOpacity={0.8}
                  >
                    {slot
                      ? <>
                          <Image source={{ uri: slot.uri }} style={dcmpStyles.tileImg} resizeMode="cover" />
                          {slot.uploading && (
                            <View style={[dcmpStyles.tileImg, { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }]}>
                              <ActivityIndicator color="#fff" />
                            </View>
                          )}
                          {!slot.uploading && (
                            <TouchableOpacity
                              style={dcmpStyles.tileRemove}
                              onPress={() => removeSlot(idx)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="close-circle" size={22} color="#fff" />
                            </TouchableOpacity>
                          )}
                        </>
                      : <View style={dcmpStyles.tilePlaceholder}>
                          <Text style={[dcmpStyles.tileShapeIcon, { color: MUTED }]}>{shape}</Text>
                          <Ionicons name="add-circle-outline" size={24} color={MUTED} />
                        </View>
                    }
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          </View>

          <View style={[dcmpStyles.inputWrap, { backgroundColor: FILL }]}>
            <TextInput
              style={[dcmpStyles.questionInput, { color: TEXT, textAlign: ar ? 'right' : 'left' }]}
              value={question}
              onChangeText={setQuestion}
              placeholder={ar ? 'ماذا تريد أن تقرر؟' : 'What do you need help deciding?'}
              placeholderTextColor={MUTED}
              maxLength={200}
            />
          </View>

          <TouchableOpacity
            style={[dcmpStyles.submitBtn, { backgroundColor: canSubmit ? ACCENT : FILL }]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            {anyUploading
              ? <ActivityIndicator color="#fff" />
              : <Text style={[dcmpStyles.submitText, { color: canSubmit ? '#fff' : MUTED }]}>{ar ? 'أرسل' : 'Post'}</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const dcmpStyles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, borderTopWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  sub: { fontSize: 13, marginBottom: 16 },
  tileRow: { flexDirection: 'row', gap: 8, marginBottom: 0 },
  tile: { flex: 1, height: DCMP_TILE_SIZE, borderRadius: 12, overflow: 'hidden', borderWidth: 1.5 },
  tileImg: { width: '100%', height: '100%' },
  tilePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  tileShapeIcon: { fontSize: 20 },
  tileRemove: { position: 'absolute', top: 6, right: 6 },
  inputWrap: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  questionInput: { fontSize: 16, lineHeight: 22 },
  submitBtn: { borderRadius: 22, paddingVertical: 14, alignItems: 'center' },
  submitText: { fontSize: 16, fontWeight: '700' },
});

// ── Question composer modal ───────────────────────────────────────────────────
function QuestionComposer({ visible, onClose, onSubmit, ar }) {
  const { TEXT, MUTED, ACCENT, BG, FILL, SEPARATOR } = useBrutColors();
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[qcStyles.sheet, { backgroundColor: BG, borderTopColor: SEPARATOR }]}>
          <Text style={[qcStyles.title, { color: TEXT }]}>{ar ? 'اطرح سؤالاً' : 'Ask the circle'}</Text>
          <View style={[qcStyles.inputWrap, { backgroundColor: FILL }]}>
            <TextInput
              style={[qcStyles.input, { color: TEXT, textAlign: ar ? 'right' : 'left' }]}
              value={text}
              onChangeText={setText}
              placeholder={ar ? 'ما سؤالك؟' : "What's your question?"}
              placeholderTextColor={MUTED}
              multiline
              maxLength={200}
              autoFocus
            />
          </View>
          <TouchableOpacity
            style={[qcStyles.btn, { backgroundColor: text.trim() ? ACCENT : FILL }]}
            onPress={handleSubmit}
            disabled={!text.trim()}
            activeOpacity={0.8}
          >
            <Text style={[qcStyles.btnText, { color: text.trim() ? '#fff' : MUTED }]}>
              {ar ? 'أرسل' : 'Ask'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const qcStyles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, borderTopWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  sub: { fontSize: 13, marginBottom: 16 },
  inputWrap: { borderRadius: 16, padding: 14, marginBottom: 16, minHeight: 80 },
  input: { fontSize: 16, lineHeight: 22 },
  btn: { borderRadius: 22, paddingVertical: 14, alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: '700' },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CircleScreen({ route, navigation }) {
  const { circleId } = route.params;
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const ar = isAr(i18n);
  const { TEXT, MUTED, ACCENT, BG, FILL, SEPARATOR } = useBrutColors();
  const { user: currentUser } = useSelector((s) => s.auth);

  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [polls, setPolls] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [showQuestionComposer, setShowQuestionComposer] = useState(false);
  const [showDecideComposer, setShowDecideComposer] = useState(false);
  const [userLoc, setUserLoc] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [stampToast, setStampToast] = useState(null);
  const [activeTab, setActiveTab] = useState('feed');
  const [refreshing, setRefreshing] = useState(false);
  const [scrolledDown, setScrolledDown] = useState(false);
  const [reelScrolledDown, setReelScrolledDown] = useState(false);

  const watchRef = useRef(null);
  const flatRef = useRef(null);
  const reelRef = useRef(null);
  const exitedRef = useRef(false);
  const expectedVoteRef = useRef({});
  const slideAnim = useRef(new Animated.Value(60)).current;

  const { topLevel, repliesMap } = useMemo(() => {
    const replies = {};
    const top = [];
    for (const m of messages) {
      const parentId = m.replyTo?.messageId ? String(m.replyTo.messageId) : null;
      if (parentId) {
        if (!replies[parentId]) replies[parentId] = [];
        replies[parentId].push(m);
      } else {
        top.push(m);
      }
    }
    return { topLevel: top, repliesMap: replies };
  }, [messages]);

  const photoMessages = useMemo(() => topLevel.filter((m) => !!m.image), [topLevel]);

  // Height for one reel page: full screen minus safe areas and header
  const HEADER_H = insets.top + 10 + 12 + 20 + 22 + 38; // approx header height
  const reelHeight = SH - HEADER_H - insets.bottom;

  const prevTopCount = useRef(0);
  useEffect(() => {
    if (topLevel.length > prevTopCount.current) {
      flatRef.current?.scrollToEnd?.({ animated: true });
    }
    prevTopCount.current = topLevel.length;
  }, [topLevel.length]);

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
  }, [slideAnim]);

  const loadRoom = useCallback(async (loc) => {
    try {
      const hasLoc = loc && loc.lat != null && loc.lng != null;
      const res = await hachiAPI.getRoom(circleId, hasLoc ? loc : null);
      if (!res.inside) {
        if (!exitedRef.current) { exitedRef.current = true; navigation.replace('Main'); }
        return;
      }
      setRoom(res.room);
      setMessages(res.room.messages || []);
      if (hasLoc) {
        hachiAPI.recordVisit(circleId, loc.lat, loc.lng, loc.speed || 0)
          .then(async (r) => {
            if (r?.firstVisit && r?.stampUrl) {
              const optimized = cdnUrl(r.stampUrl, 220);
              try { await Image.prefetch(optimized); } catch {}
              setStampToast({ stampUrl: optimized, venueName: r.venueName || '' });
            }
          })
          .catch(() => {});
      }
      try {
        const pollRes = await hachiAPI.listPolls(circleId, loc?.lat, loc?.lng);
        setPolls(pollRes.polls || []);
      } catch {}
    } catch (e) {
      if (e.status === 403 && !exitedRef.current) { exitedRef.current = true; navigation.replace('Main'); }
    } finally { setLoading(false); }
  }, [circleId, navigation]);

  useEffect(() => {
    let cancelled = false;
    let loadedOnce = false;
    const safeLoad = (loc) => {
      if (loadedOnce || cancelled) return;
      loadedOnce = true;
      loadRoom(loc);
    };
    if (!Location) { safeLoad(null); return () => { cancelled = true; }; }
    const fallback = setTimeout(() => safeLoad(null), 4000);
    (async () => {
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, speed: pos.coords.speed };
        setUserLoc(loc);
        clearTimeout(fallback);
        safeLoad(loc);
        watchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 25, timeInterval: 10000 },
          async (p) => {
            const next = { lat: p.coords.latitude, lng: p.coords.longitude, speed: p.coords.speed };
            setUserLoc(next);
            try {
              const result = await hachiAPI.checkLocation(circleId, next.lat, next.lng, next.speed || 0);
              if (result.status === 'locked' && !exitedRef.current) { exitedRef.current = true; navigation.replace('Main'); }
            } catch {}
          }
        );
      } catch {
        clearTimeout(fallback);
        safeLoad(null);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(fallback);
      if (watchRef.current) watchRef.current.remove();
    };
  }, [circleId, navigation, loadRoom]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    joinHachiRoom(circleId);
    const onMsg = ({ roomId, message }) => {
      if (roomId !== circleId) return;
      setMessages((m) => [...m, { ...message, likes: message.likes || [] }]);
    };
    const onPollCreated = ({ poll }) => setPolls((p) => [poll, ...p.filter((x) => x._id !== poll._id)]);
    const onPollUpdate = ({ poll }) => setPolls((p) => p.map((x) => {
      if (x._id !== poll._id) return x;
      const mineMap = new Map((x.options || []).map((o) => [o._id, !!o.mine]));
      return { ...poll, options: poll.options.map((o) => ({ ...o, mine: mineMap.get(o._id) || false })) };
    }));
    const onPollRemoved = ({ pollId }) => setPolls((p) => p.filter((x) => x._id !== pollId));
    const onMsgDeleted = ({ roomId, messageId }) => {
      if (roomId !== circleId) return;
      setMessages((prev) => prev.filter((m) => String(m._id) !== String(messageId)));
    };
    const onDecideVoted = ({ roomId, messageId, voteCounts }) => {
      if (roomId !== circleId) return;
      setMessages((prev) => prev.map((m) => {
        if (String(m._id) !== String(messageId) || m.type !== 'decide') return m;
        const updatedOpts = (m.decideOptions || []).map((o) => {
          const vc = voteCounts.find((v) => String(v.optionId) === String(o._id));
          if (!vc) return o;
          const base = (o.votes || []).filter((v) => (typeof v === 'string' ? v : v.toString()) !== currentUser?._id?.toString());
          return { ...o, votes: vc.voted ? [...base, currentUser._id] : base };
        });
        return { ...m, decideOptions: updatedOpts };
      }));
    };
    socket.on('hachiMessage', onMsg);
    socket.on('flashPollCreated', onPollCreated);
    socket.on('flashPollUpdate', onPollUpdate);
    socket.on('flashPollRemoved', onPollRemoved);
    socket.on('hachiMessageDeleted', onMsgDeleted);
    socket.on('hachiDecideVoted', onDecideVoted);
    return () => {
      socket.off('hachiMessage', onMsg);
      socket.off('flashPollCreated', onPollCreated);
      socket.off('flashPollUpdate', onPollUpdate);
      socket.off('flashPollRemoved', onPollRemoved);
      socket.off('hachiMessageDeleted', onMsgDeleted);
      socket.off('hachiDecideVoted', onDecideVoted);
      leaveHachiRoom(circleId);
    };
  }, [circleId]);

  useEffect(() => {
    if (polls.length === 0) return;
    const id = setInterval(() => {
      setPolls((prev) => prev.filter((p) => new Date(p.expiresAt).getTime() > Date.now()));
    }, 5000);
    return () => clearInterval(id);
  }, [polls.length]);

  const handleLikeToggle = useCallback(async (msgId) => {
    setMessages((prev) => prev.map((m) => {
      if (String(m._id) !== String(msgId)) return m;
      const uid = currentUser?._id?.toString();
      const likes = m.likes || [];
      const already = likes.some((l) => (typeof l === 'string' ? l : l?.toString()) === uid);
      return { ...m, likes: already ? likes.filter((l) => (typeof l === 'string' ? l : l?.toString()) !== uid) : [...likes, uid] };
    }));
    try { await hachiAPI.likeMessage(circleId, msgId); } catch {}
  }, [circleId, currentUser]);

  const handleReply = useCallback((msg) => {
    setReplyTo({
      messageId: msg._id,
      text: msg.text || (ar ? '📷 صورة' : '📷 Photo'),
      userName: ar ? 'شخص هنا' : 'Someone here',
    });
  }, [ar]);

  const handleDelete = useCallback((msgId) => {
    setMessages((prev) => prev.filter((m) => String(m._id) !== String(msgId)));
    deleteHachiMessage(circleId, msgId);
  }, [circleId]);

  const handleReport = useCallback((msgId, reason) => {
    sendHachiReport(circleId, msgId, reason);
    Alert.alert(
      ar ? 'تم الإبلاغ' : 'Reported',
      ar ? 'شكراً، سنراجع هذا المحتوى.' : 'Thanks, we will review this post.',
      [{ text: ar ? 'حسناً' : 'OK' }]
    );
  }, [circleId, ar]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await hachiAPI.getRoom(circleId, userLoc);
      if (res.room) setMessages(res.room.messages || []);
      const pollRes = await hachiAPI.listPolls(circleId, userLoc?.lat, userLoc?.lng);
      setPolls(pollRes.polls || []);
    } catch {} finally { setRefreshing(false); }
  }, [circleId, userLoc]);

  const handleAnswer = useCallback((questionId, answerText) => {
    const sock = getSocket();
    if (!sock?.connected) return;
    const locParam = userLoc ? { lat: userLoc.lat, lng: userLoc.lng, speed: userLoc.speed } : null;
    sendHachiMessage(
      circleId,
      answerText,
      { messageId: questionId, text: '', userName: ar ? 'شخص هنا' : 'Someone here' },
      locParam,
      true
    );
  }, [circleId, userLoc, ar]);

  const handleSend = () => {
    if (!text.trim()) return;
    const sock = getSocket();
    if (!sock?.connected) { sock?.connect?.(); return; }
    const locParam = userLoc ? { lat: userLoc.lat, lng: userLoc.lng, speed: userLoc.speed } : null;
    sendHachiMessage(circleId, text.trim(), replyTo || null, locParam, false);
    setText('');
    setReplyTo(null);
  };

  const handleAskQuestion = (questionText) => {
    sendHachiQuestion(circleId, questionText, true);
    setShowQuestionComposer(false);
  };

  const handleDecideSubmit = (question, options) => {
    sendHachiDecide(circleId, question, options, false);
    setShowDecideComposer(false);
  };

  const handleDecideVote = useCallback((messageId, optionId, action = 'set') => {
    sendHachiDecideVote(circleId, messageId, optionId, action);
  }, [circleId]);

  const handleVote = (pollId, optionId) => {
    expectedVoteRef.current[pollId] = optionId;
    setPolls((prev) => prev.map((p) => {
      if (p._id !== pollId) return p;
      const opts = p.options.map((o) => ({ ...o, mine: false, count: o.mine ? Math.max(0, (o.count || 0) - 1) : (o.count || 0) }));
      const target = opts.find((o) => o._id === optionId);
      if (target) { target.mine = true; target.count = (target.count || 0) + 1; }
      return { ...p, options: opts, totalVotes: opts.reduce((s, o) => s + (o.count || 0), 0) };
    }));
    hachiAPI.votePoll(pollId, optionId, userLoc?.lat, userLoc?.lng)
      .then((res) => { if (expectedVoteRef.current[pollId] !== optionId) return; setPolls((p) => p.map((x) => (x._id === pollId ? res.poll : x))); })
      .catch(() => {});
  };

  const handleDeletePoll = (pollId) => {
    setPolls((prev) => prev.filter((p) => p._id !== pollId));
    hachiAPI.deletePoll(pollId).catch(() => {});
  };

  const handleCreatePoll = ({ question, options, durationMinutes }) => {
    hachiAPI.createPoll(circleId, question, options, userLoc?.lat, userLoc?.lng, durationMinutes).catch(() => {});
  };

  if (loading || !room) {
    return (
      <View style={[styles.container, { backgroundColor: BG, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  const activeHere = (room.hereNow || []).filter((p) => new Date(p.expiresAt) > new Date()).length;

  const listHeader = polls.length > 0 ? (
    <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
      {polls.map((poll) => (
        <PollCard key={poll._id} poll={poll} onVote={handleVote} onDelete={handleDeletePoll} currentUserId={currentUser?._id} ar={ar} />
      ))}
    </View>
  ) : null;

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: BG, borderBottomColor: SEPARATOR }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.headerSide}
        >
          <Text style={[styles.backBtn, { color: TEXT }]}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.roomTitle, { color: TEXT }]} numberOfLines={1}>{room.title}</Text>
          {activeHere > 0 && (
            <View style={[styles.herePill, { backgroundColor: ACCENT }]}>
              <Text style={styles.hereText}>{activeHere} {t('radar.hereNow')}</Text>
            </View>
          )}
          {/* Tab switcher */}
          <View style={[styles.tabRow, { borderTopColor: SEPARATOR }]}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'feed' && { borderBottomColor: ACCENT, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab('feed')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, { color: activeTab === 'feed' ? ACCENT : MUTED }]}>
                {ar ? 'المنشورات' : 'Feed'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'photos' && { borderBottomColor: ACCENT, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab('photos')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, { color: activeTab === 'photos' ? ACCENT : MUTED }]}>
                {photoMessages.length > 0
                  ? (ar ? `صور (${photoMessages.length})` : `Photos (${photoMessages.length})`)
                  : (ar ? 'صور' : 'Photos')
                }
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerSide} />
      </View>

      {/* Feed tab */}
      {activeTab === 'feed' && (
        <Animated.View style={[{ flex: 1 }, { transform: [{ translateY: slideAnim }] }]}>
          <FlatList
            ref={flatRef}
            data={topLevel}
            keyExtractor={(m) => String(m._id)}
            ListHeaderComponent={listHeader}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ACCENT} />
            }
            onScroll={(e) => setScrolledDown(e.nativeEvent.contentOffset.y > 200)}
            scrollEventThrottle={16}
            renderItem={({ item }) => {
              if (item.type === 'question') {
                return (
                  <QuestionCard
                    msg={item}
                    answers={repliesMap[String(item._id)] || []}
                    currentUserId={currentUser?._id}
                    ar={ar}
                    onLikeToggle={handleLikeToggle}
                    onAnswer={handleAnswer}
                  />
                );
              }
              if (item.type === 'decide') {
                return (
                  <DecideCard
                    msg={item}
                    currentUserId={currentUser?._id}
                    ar={ar}
                    onVote={handleDecideVote}
                    onDelete={handleDelete}
                    navigation={navigation}
                  />
                );
              }
              return (
                <PostCard
                  msg={item}
                  comments={repliesMap[String(item._id)] || []}
                  currentUserId={currentUser?._id}
                  ar={ar}
                  onImagePress={(uri) => navigation.navigate('MediaViewer', { media: [{ uri, type: 'image' }], initialIndex: 0 })}
                  onLikeToggle={handleLikeToggle}
                  onReply={handleReply}
                  onDelete={handleDelete}
                  onReport={handleReport}
                />
              );
            }}
            contentContainerStyle={{ paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
          />
        </Animated.View>
      )}

      {/* Photos reel tab */}
      {activeTab === 'photos' && (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {photoMessages.length === 0 ? (
            <View style={styles.emptyReel}>
              <Text style={styles.emptyReelIcon}>📷</Text>
              <Text style={[styles.emptyReelText, { color: '#888' }]}>
                {ar ? 'لا توجد صور بعد' : 'No photos yet'}
              </Text>
            </View>
          ) : (
            <FlatList
              ref={reelRef}
              data={photoMessages}
              keyExtractor={(m) => String(m._id)}
              pagingEnabled
              showsVerticalScrollIndicator={false}
              snapToInterval={reelHeight}
              decelerationRate="fast"
              getItemLayout={(_, index) => ({ length: reelHeight, offset: reelHeight * index, index })}
              onScroll={(e) => setReelScrolledDown(e.nativeEvent.contentOffset.y > reelHeight * 0.5)}
              scrollEventThrottle={16}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" />
              }
              renderItem={({ item }) => (
                <ReelItem
                  msg={item}
                  currentUserId={currentUser?._id}
                  ar={ar}
                  onLikeToggle={handleLikeToggle}
                  height={reelHeight}
                />
              )}
            />
          )}
        </View>
      )}

      {/* Composer — feed tab only */}
      {activeTab === 'feed' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
          {replyTo && (
            <View style={[styles.replyBanner, { backgroundColor: FILL, borderTopColor: SEPARATOR }]}>
              <Ionicons name="chatbubble-outline" size={13} color={ACCENT} />
              <Text style={[styles.replyBannerText, { color: MUTED }]} numberOfLines={1}>{replyTo.text}</Text>
              <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={16} color={MUTED} />
              </TouchableOpacity>
            </View>
          )}
          <View style={[styles.composerWrap, { backgroundColor: BG, borderTopColor: SEPARATOR, paddingBottom: insets.bottom + 10 }]}>
            <View style={[styles.inputRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
              <View style={[styles.inputCard, { backgroundColor: FILL, borderColor: replyTo ? ACCENT : 'transparent' }]}>
                <TextInput
                  style={[styles.input, { color: TEXT, textAlign: ar ? 'right' : 'left' }]}
                  value={text}
                  onChangeText={setText}
                  placeholder={replyTo ? (ar ? 'اكتب تعليقاً…' : 'Write a comment…') : t('radar.composerPlaceholder')}
                  placeholderTextColor={MUTED}
                  multiline
                  maxLength={500}
                />
              </View>
              <TouchableOpacity
                onPress={handleSend}
                disabled={!text.trim()}
                style={[styles.sendBtn, { backgroundColor: text.trim() ? ACCENT : FILL }]}
                activeOpacity={0.75}
              >
                <Ionicons name={ar ? 'arrow-back' : 'arrow-forward'} size={18} color={text.trim() ? '#fff' : MUTED} />
              </TouchableOpacity>
            </View>

            <View style={[styles.actionsRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: FILL, borderColor: SEPARATOR }]}
                onPress={() => navigation.navigate('LiveCamera', { circleId })}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-outline" size={18} color={TEXT} />
                <Text style={[styles.actionChipText, { color: TEXT }]}>{ar ? 'لايف' : 'Live'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: FILL, borderColor: SEPARATOR }]}
                onPress={() => setShowCreatePoll(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="bar-chart-outline" size={18} color={TEXT} />
                <Text style={[styles.actionChipText, { color: TEXT }]}>{ar ? 'تصويت' : 'Poll'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: FILL, borderColor: SEPARATOR }]}
                onPress={() => setShowQuestionComposer(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="help-circle-outline" size={18} color={TEXT} />
                <Text style={[styles.actionChipText, { color: TEXT }]}>{ar ? 'سؤال' : 'Ask'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: FILL, borderColor: SEPARATOR }]}
                onPress={() => setShowDecideComposer(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="git-compare-outline" size={18} color={TEXT} />
                <Text style={[styles.actionChipText, { color: TEXT }]}>{ar ? 'قرر' : 'Decide'}</Text>
              </TouchableOpacity>

            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      <PollComposer visible={showCreatePoll} onClose={() => setShowCreatePoll(false)} onSubmit={handleCreatePoll} />
      <DecideComposer
        visible={showDecideComposer}
        onClose={() => setShowDecideComposer(false)}
        onSubmit={handleDecideSubmit}
        ar={ar}
      />

      <QuestionComposer
        visible={showQuestionComposer}
        onClose={() => setShowQuestionComposer(false)}
        onSubmit={handleAskQuestion}
        ar={ar}
      />

      <StampModal
        visible={!!stampToast}
        stampUrl={stampToast?.stampUrl}
        venueName={stampToast?.venueName}
        onClose={() => setStampToast(null)}
        ar={ar}
      />

      {/* Scroll-to-top — rendered last so it sits above everything */}
      {activeTab === 'feed' && scrolledDown && (
        <TouchableOpacity
          style={[styles.scrollTopBtn, { backgroundColor: ACCENT, bottom: insets.bottom + 80, zIndex: 99 }]}
          onPress={() => flatRef.current?.scrollToOffset({ offset: 0, animated: true })}
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-up" size={20} color="#fff" />
        </TouchableOpacity>
      )}
      {activeTab === 'photos' && reelScrolledDown && (
        <TouchableOpacity
          style={[styles.scrollTopBtn, { backgroundColor: 'rgba(255,255,255,0.2)', bottom: insets.bottom + 24, zIndex: 99 }]}
          onPress={() => reelRef.current?.scrollToIndex({ index: 0, animated: true })}
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-up" size={20} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingBottom: 0, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  backBtn: { fontSize: 26, fontWeight: '400', lineHeight: 30, marginTop: 2 },
  headerSide: { width: 36 },
  headerCenter: { flex: 1, alignItems: 'center', gap: 4 },
  roomTitle: { fontSize: 16, fontWeight: '600' },
  herePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  hereText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  tabRow: { flexDirection: 'row', width: '100%', marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabText: { fontSize: 13, fontWeight: '600' },
  scrollTopBtn: { position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  emptyReel: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyReelIcon: { fontSize: 48 },
  emptyReelText: { fontSize: 15, fontWeight: '500' },
  replyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  replyBannerText: { flex: 1, fontSize: 13 },
  composerWrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingTop: 12 },
  inputRow: { alignItems: 'flex-end', gap: 10, marginBottom: 10 },
  inputCard: { flex: 1, borderRadius: 22, borderWidth: 1.5, paddingHorizontal: 16, minHeight: 44, maxHeight: 120, justifyContent: 'center' },
  input: { fontSize: 15, fontWeight: '400', paddingVertical: 10 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  actionsRow: { gap: 8, marginBottom: 4, alignItems: 'center', flexWrap: 'nowrap' },
  actionChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  actionChipText: { fontSize: 13, fontWeight: '500' },
});
