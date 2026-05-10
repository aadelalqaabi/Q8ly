import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions, Animated, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { hachiAPI } from '../../services/api';
import { getSocket, joinHachiRoom, leaveHachiRoom, sendHachiMessage } from '../../services/socket';
import { Ionicons } from '@expo/vector-icons';
import { useBrutColors, isAr } from '../../components/Brut';
import { PollCard, PollComposer } from '../../components/Poll';
let Location = null;
try { Location = require('expo-location'); } catch {}

const SW = Dimensions.get('window').width;
const IMG_SIZE = Math.min(240, SW * 0.58);

// ── Message row ───────────────────────────────────────────────────────────────
function MessageRow({ msg, isMine, ar, onImagePress }) {
  const { TEXT, MUTED, ACCENT, SEPARATOR, CARD } = useBrutColors();
  const hasImage = !!msg.image;
  const hasText = !!msg.text;
  const isAnon = !!msg.anonymous;
  const displayName = isAnon ? (ar ? 'مجهول' : 'Anonymous') : (msg.user?.name || '');

  return (
    <View style={[
      msgStyles.wrap,
      { alignItems: isMine ? (ar ? 'flex-start' : 'flex-end') : (ar ? 'flex-end' : 'flex-start') },
    ]}>
      {!isMine && (
        <Text style={[msgStyles.author, { color: isAnon ? MUTED : MUTED, textAlign: ar ? 'right' : 'left', fontStyle: isAnon ? 'italic' : 'normal' }]}>
          {isAnon ? '👤 ' + displayName : displayName}
        </Text>
      )}

      {hasImage && (
        <View style={msgStyles.imageWrap}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => onImagePress?.(msg.image)}>
            <Image source={{ uri: msg.image }} style={{ width: IMG_SIZE, height: IMG_SIZE, borderRadius: 14 }} resizeMode="cover" />
          </TouchableOpacity>
          {msg.isLive && (
            <View style={[msgStyles.liveTag, { [ar ? 'right' : 'left']: 8 }]}>
              <View style={msgStyles.liveDot} />
              <Text style={msgStyles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
      )}

      {hasText && (
        <View style={[
          msgStyles.bubble,
          isMine
            ? { backgroundColor: ACCENT }
            : { backgroundColor: CARD, borderWidth: 1, borderColor: SEPARATOR },
          hasImage && { marginTop: 6 },
        ]}>
          <Text style={[msgStyles.text, { color: isMine ? '#fff' : TEXT, textAlign: ar ? 'right' : 'left' }]}>
            {msg.text}
          </Text>
        </View>
      )}
    </View>
  );
}

const msgStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 3 },
  author: { fontSize: 12, fontWeight: '500', marginBottom: 3, marginHorizontal: 4 },
  bubble: { maxWidth: '78%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20 },
  text: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  imageWrap: { position: 'relative' },
  liveTag: {
    position: 'absolute', top: 8, flexDirection: 'row', alignItems: 'center',
    gap: 5, paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30' },
  liveText: { color: '#fff', fontSize: 10, fontWeight: '600' },
});

// ── Stamp celebration modal ───────────────────────────────────────────────────
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
          {stampUrl && (
            <Image source={{ uri: stampUrl }} style={stampStyles.stamp} resizeMode="contain" />
          )}
          <TouchableOpacity style={stampStyles.btn} onPress={onClose} activeOpacity={0.8}>
            <Text style={stampStyles.btnText}>{ar ? 'رائع!' : 'Nice!'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const stampStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center',
  },
  card: {
    width: 300, backgroundColor: '#fff', borderRadius: 28,
    alignItems: 'center', paddingHorizontal: 24, paddingVertical: 32,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
  },
  congrats: { fontSize: 20, fontWeight: '800', color: '#000', marginBottom: 4, textAlign: 'center' },
  venue: { fontSize: 14, color: '#6C6C70', marginBottom: 20, textAlign: 'center' },
  stamp: { width: 220, height: 220, marginBottom: 24 },
  btn: {
    backgroundColor: '#0033A0', borderRadius: 22,
    paddingHorizontal: 48, paddingVertical: 14,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
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
  const [userLoc, setUserLoc] = useState(null);
  const [isAnon, setIsAnon] = useState(false);
  const [stampToast, setStampToast] = useState(null); // { stampUrl, venueName }

  const watchRef = useRef(null);
  const flatRef = useRef(null);
  const exitedRef = useRef(false);
  const expectedVoteRef = useRef({});
  const slideAnim = useRef(new Animated.Value(60)).current;

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
          .then((r) => { if (r?.firstVisit && r?.stampUrl) setStampToast({ stampUrl: r.stampUrl, venueName: r.venueName || '' }); })
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
              if (result.status !== 'here' && !exitedRef.current) { exitedRef.current = true; navigation.replace('Main'); }
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
    const onMsg = ({ roomId, message }) => { if (roomId !== circleId) return; setMessages((m) => [...m, message]); };
    const onPollCreated = ({ poll }) => setPolls((p) => [poll, ...p.filter((x) => x._id !== poll._id)]);
    const onPollUpdate = ({ poll }) => setPolls((p) => p.map((x) => {
      if (x._id !== poll._id) return x;
      const mineMap = new Map((x.options || []).map((o) => [o._id, !!o.mine]));
      return { ...poll, options: poll.options.map((o) => ({ ...o, mine: mineMap.get(o._id) || false })) };
    }));
    const onPollRemoved = ({ pollId }) => setPolls((p) => p.filter((x) => x._id !== pollId));
    socket.on('hachiMessage', onMsg);
    socket.on('flashPollCreated', onPollCreated);
    socket.on('flashPollUpdate', onPollUpdate);
    socket.on('flashPollRemoved', onPollRemoved);
    return () => {
      socket.off('hachiMessage', onMsg);
      socket.off('flashPollCreated', onPollCreated);
      socket.off('flashPollUpdate', onPollUpdate);
      socket.off('flashPollRemoved', onPollRemoved);
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

  const handleSend = () => {
    if (!text.trim()) return;
    const sock = getSocket();
    if (!sock?.connected) { sock?.connect?.(); return; }
    const locParam = userLoc ? { lat: userLoc.lat, lng: userLoc.lng, speed: userLoc.speed } : null;
    sendHachiMessage(circleId, text.trim(), null, locParam, isAnon);
    setText('');
  };

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

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: BG }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: BG, borderBottomColor: SEPARATOR, flexDirection: ar ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerSide}>
          <Text style={[styles.backBtn, { color: TEXT }]}>{ar ? '›' : '‹'}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.roomTitle, { color: TEXT }]} numberOfLines={1}>{room.title}</Text>
          {activeHere > 0 && (
            <View style={[styles.herePill, { backgroundColor: ACCENT }]}>
              <Text style={styles.hereText}>{activeHere} {t('radar.hereNow')}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerSide} />
      </View>

      <Animated.View style={[{ flex: 1 }, { transform: [{ translateY: slideAnim }] }]}>
        {/* Polls */}
        {polls.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
            {polls.map((poll) => (
              <PollCard
                key={poll._id}
                poll={poll}
                onVote={handleVote}
                onDelete={handleDeletePoll}
                currentUserId={currentUser?._id}
                ar={ar}
              />
            ))}
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={flatRef}
          data={[...messages].reverse()}
          inverted
          keyExtractor={(m) => String(m._id)}
          renderItem={({ item }) => (
            <MessageRow
              msg={item}
              isMine={item.user?._id === currentUser?._id}
              ar={ar}
              onImagePress={(uri) => navigation.navigate('MediaViewer', { media: [{ uri, type: 'image' }], initialIndex: 0 })}
            />
          )}
          contentContainerStyle={{ paddingVertical: 12 }}
          showsVerticalScrollIndicator={false}
        />
      </Animated.View>

      {/* Composer */}
      <View style={[styles.composerWrap, { backgroundColor: BG, borderTopColor: SEPARATOR, paddingBottom: insets.bottom + 8 }]}>
        <View style={[styles.composerRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity
            style={[styles.cameraBtn, { backgroundColor: FILL }]}
            onPress={() => navigation.navigate('LiveCamera', { circleId })}
            activeOpacity={0.7}
          >
            <Text style={[styles.cameraGlyph, { color: MUTED }]}>◉</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cameraBtn, { backgroundColor: FILL }]}
            onPress={() => setShowCreatePoll(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="bar-chart-outline" size={20} color={ACCENT} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cameraBtn, { backgroundColor: isAnon ? ACCENT : FILL }]}
            onPress={() => setIsAnon((v) => !v)}
            activeOpacity={0.7}
          >
            <Ionicons name="glasses-outline" size={20} color={isAnon ? '#fff' : MUTED} />
          </TouchableOpacity>

          <View style={[styles.inputCard, { backgroundColor: FILL, borderColor: isAnon ? ACCENT : SEPARATOR, flexDirection: ar ? 'row-reverse' : 'row' }]}>
            <TextInput
              style={[styles.input, { color: TEXT, textAlign: ar ? 'right' : 'left' }]}
              value={text}
              onChangeText={setText}
              placeholder={t('radar.composerPlaceholder')}
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
            <Text style={[styles.sendIcon, { color: text.trim() ? '#fff' : MUTED }]}>
              {ar ? '‹' : '›'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <PollComposer
        visible={showCreatePoll}
        onClose={() => setShowCreatePoll(false)}
        onSubmit={handleCreatePoll}
      />

      <StampModal
        visible={!!stampToast}
        stampUrl={stampToast?.stampUrl}
        venueName={stampToast?.venueName}
        onClose={() => setStampToast(null)}
        ar={ar}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backBtn: { fontSize: 26, fontWeight: '400', lineHeight: 30 },
  headerSide: { width: 36 },
  headerCenter: { flex: 1, alignItems: 'center', gap: 4 },
  roomTitle: { fontSize: 16, fontWeight: '600' },
  herePill: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 20,
  },
  hereText: { color: '#fff', fontSize: 11, fontWeight: '500' },

  composerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12, paddingTop: 10,
  },
  composerRow: { alignItems: 'flex-end', gap: 8 },
  cameraBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  cameraGlyph: { fontSize: 20 },
  inputCard: {
    flex: 1, borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 14, minHeight: 40, maxHeight: 110,
    justifyContent: 'center',
  },
  input: { fontSize: 15, fontWeight: '400', paddingVertical: 10 },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  sendIcon: { fontSize: 20, fontWeight: '500' },
});
