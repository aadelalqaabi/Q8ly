import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { hachiAPI } from '../../services/api';
import { getSocket, joinHachiRoom, leaveHachiRoom, sendHachiMessage } from '../../services/socket';
import {
  BrutNav, BrutNavLink, BrutHero, BrutRule, useBrutColors, isAr, ls, shout,
} from '../../components/Brut';
import { PollCard, PollComposer } from '../../components/Poll';
let Location = null;
try { Location = require('expo-location'); } catch {}

// FrequencyWave removed — replaced by VenueArt line illustration

// ── Message row ───────────────────────────────────────────────────────────
const SW = Dimensions.get('window').width;
const IMG_SIZE = Math.min(260, SW * 0.62);

function MessageRow({ msg, isMine, ar, onImagePress }) {
  const { TEXT, MUTED, ACCENT, SEPARATOR, FILL, BG } = useBrutColors();
  const hasImage = !!msg.image;
  const hasText = !!msg.text;
  return (
    <View style={[msgStyles.wrap, { alignItems: isMine ? (ar ? 'flex-start' : 'flex-end') : (ar ? 'flex-end' : 'flex-start') }]}>
      {!isMine && <Text style={[msgStyles.author, { color: MUTED, letterSpacing: ls(1.5, ar) }]}>{shout(msg.user?.name || '', ar)}</Text>}
      {hasImage && (
        <View style={[msgStyles.imageWrap, { borderColor: TEXT }]}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => onImagePress?.(msg.image)}>
            <Image source={{ uri: msg.image }} style={{ width: IMG_SIZE, height: IMG_SIZE }} resizeMode="cover" />
          </TouchableOpacity>
          {msg.isLive && (
            <View style={[msgStyles.liveTag, { backgroundColor: TEXT, [ar ? 'right' : 'left']: 8 }]}>
              <View style={msgStyles.liveDot} />
              <Text style={msgStyles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
      )}
      {hasText && (
        <View style={[msgStyles.bubble, isMine ? { backgroundColor: ACCENT } : { backgroundColor: FILL, borderWidth: StyleSheet.hairlineWidth, borderColor: SEPARATOR }, hasImage && { marginTop: 4 }]}>
          <Text style={[msgStyles.text, { color: isMine ? BG : TEXT }, { textAlign: ar ? 'right' : 'left' }]}>
            {msg.text}
          </Text>
        </View>
      )}
    </View>
  );
}
const msgStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 4, paddingVertical: 5 },
  author: { fontSize: 10, fontWeight: '800', marginBottom: 4 },
  bubble: { maxWidth: '78%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 },
  text: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  imageWrap: { borderWidth: 2, position: 'relative' },
  liveTag: { position: 'absolute', top: 8, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30' },
  liveText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
});

export default function CircleScreen({ route, navigation }) {
  const { circleId } = route.params;
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const ar = isAr(i18n);
  const { TEXT, MUTED, ACCENT, BG } = useBrutColors();
  const { user: currentUser } = useSelector((s) => s.auth);
  const isFounder = currentUser?.phone === '+96599440289' || currentUser?.isFounder === true;

  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [polls, setPolls] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [userLoc, setUserLoc] = useState(null);

  const watchRef = useRef(null);
  const flatRef = useRef(null);
  const exitedRef = useRef(false);
  const expectedVoteRef = useRef({});
  const slideAnim = useRef(new Animated.Value(80)).current;

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
        hachiAPI.recordVisit(circleId, loc.lat, loc.lng, loc.speed || 0).catch(() => {});
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

    if (isFounder) { safeLoad(null); return () => { cancelled = true; }; }
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
  }, [circleId, navigation, loadRoom, isFounder]);

  // Sockets
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    joinHachiRoom(circleId);
    const onMsg = ({ roomId, message }) => {
      if (roomId !== circleId) return;
      setMessages((m) => [...m, message]);
    };
    const onPollCreated = ({ poll }) => setPolls((p) => [poll, ...p.filter((x) => x._id !== poll._id)]);
    // Public socket updates have no `mine` — preserve our local mine flags by option ID
    const onPollUpdate = ({ poll }) => setPolls((p) => p.map((x) => {
      if (x._id !== poll._id) return x;
      const mineMap = new Map((x.options || []).map((o) => [o._id, !!o.mine]));
      const merged = poll.options.map((o) => ({ ...o, mine: mineMap.get(o._id) || false }));
      return { ...poll, options: merged };
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

  // Auto-expire polls locally so the timer hits 0 even without a server tick
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
    if (!sock || !sock.connected) {
      // Try once to reconnect, then warn the user instead of silently dropping
      sock?.connect?.();
      console.warn('[circle] socket not connected, message dropped:', text);
      return;
    }
    const locParam = userLoc ? { lat: userLoc.lat, lng: userLoc.lng, speed: userLoc.speed } : null;
    sendHachiMessage(circleId, text.trim(), null, locParam);
    setText('');
  };

  // Vote — optimistic + race-safe
  const handleVote = (pollId, optionId) => {
    expectedVoteRef.current[pollId] = optionId;
    setPolls((prev) => prev.map((p) => {
      if (p._id !== pollId) return p;
      const optsCleared = p.options.map((o) => ({ ...o, mine: false, count: o.mine ? Math.max(0, (o.count || 0) - 1) : (o.count || 0) }));
      const target = optsCleared.find((o) => o._id === optionId);
      if (target) { target.mine = true; target.count = (target.count || 0) + 1; }
      const totalVotes = optsCleared.reduce((s, o) => s + (o.count || 0), 0);
      return { ...p, options: optsCleared, totalVotes };
    }));
    hachiAPI.votePoll(pollId, optionId, userLoc?.lat, userLoc?.lng)
      .then((res) => {
        // Discard stale responses — only the latest vote's response wins
        if (expectedVoteRef.current[pollId] !== optionId) return;
        setPolls((p) => p.map((x) => (x._id === pollId ? res.poll : x)));
      })
      .catch(() => { /* keep optimistic */ });
  };

  // Delete
  const handleDeletePoll = (pollId) => {
    setPolls((prev) => prev.filter((p) => p._id !== pollId));
    hachiAPI.deletePoll(pollId).catch(() => {});
  };

  // Create — fire-and-forget
  const handleCreatePoll = ({ question, options, durationMinutes }) => {
    hachiAPI.createPoll(circleId, question, options, userLoc?.lat, userLoc?.lng, durationMinutes)
      .catch((e) => { console.warn('[poll] create failed:', e?.message); });
  };

  if (loading || !room) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  const activeHere = (room.hereNow || []).filter((p) => new Date(p.expiresAt) > new Date()).length;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: BG }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BrutNav
        onBack={() => navigation.goBack()}
        right={<BrutNavLink onPress={() => setShowCreatePoll(true)} label={t('radar.flashPoll')} accent />}
      />

      <Animated.View style={[{ flex: 1 }, { transform: [{ translateY: slideAnim }] }]}>
        {/* Hero: venue name + presence */}
        <View style={styles.hero}>
          <BrutHero title={room.title} label={`${activeHere} ${ar ? t('radar.hereNow') : shout(t('radar.hereNow'), false)}`} size={42} />
          <BrutRule mt={18} mb={0} />
        </View>

        {/* Polls — fixed above the message list */}
        {polls.length > 0 && (
          <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
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

        {/* Messages — inverted so newest appear at the bottom, pushing up naturally */}
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
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12 }}
        />
      </Animated.View>

      {/* Composer */}
      <View style={[styles.composer, { backgroundColor: BG, borderTopColor: TEXT, paddingBottom: insets.bottom + 12, flexDirection: ar ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity style={[styles.cameraBtn, { borderColor: TEXT }]} onPress={() => navigation.navigate('LiveCamera', { circleId })} activeOpacity={0.7}>
          <Text style={[styles.cameraGlyph, { color: TEXT }]}>◉</Text>
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { color: TEXT, backgroundColor: BG, borderBottomColor: TEXT, textAlign: ar ? 'right' : 'left' }]}
          value={text}
          onChangeText={setText}
          placeholder={t('radar.composerPlaceholder')}
          placeholderTextColor={MUTED}
          multiline
          maxLength={500}
        />
        <TouchableOpacity onPress={handleSend} disabled={!text.trim()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={[styles.sendLabel, { color: ACCENT }, !text.trim() && { opacity: 0.35 }, { letterSpacing: ls(2, ar) }]}>
            {ar ? '←' : `${shout(t('radar.post'), false)} →`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Poll composer modal */}
      <PollComposer
        visible={showCreatePoll}
        onClose={() => setShowCreatePoll(false)}
        onSubmit={handleCreatePoll}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { paddingHorizontal: 20, paddingTop: 8 },
  composer: { alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 10, gap: 12, borderTopWidth: 2 },
  cameraBtn: { width: 44, height: 44, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  cameraGlyph: { fontSize: 24, fontWeight: '900' },
  input: { flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 0, paddingVertical: 10, fontSize: 16, fontWeight: '600', borderBottomWidth: 2 },
  sendLabel: { fontSize: 13, fontWeight: '900', paddingBottom: 12 },
});
