import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { hachiAPI } from '../../services/api';
import { getSocket, joinHachiRoom, leaveHachiRoom, sendHachiMessage } from '../../services/socket';
import {
  BrutNav, BrutNavLink, BrutHero, BrutRule, BG, TEXT, MUTED, ACCENT, SEPARATOR, isAr, ls, shout,
} from '../../components/Brut';
import { PollCard, PollComposer } from '../../components/Poll';
let Location = null;
try { Location = require('expo-location'); } catch {}

// ── Frequency wave (chat-speed visualizer) ────────────────────────────────
function FrequencyWave({ activity }) {
  const bars = 7;
  const animValues = useRef(Array.from({ length: bars }, () => new Animated.Value(0.3))).current;
  useEffect(() => {
    const speed = Math.max(300, 1500 - activity * 100);
    const animations = animValues.map((v, i) =>
      Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: Math.random() * 0.7 + 0.3, duration: speed + i * 80, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(v, { toValue: Math.random() * 0.4 + 0.2, duration: speed + i * 80, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]))
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [activity]);
  return (
    <View style={waveStyles.row}>
      {animValues.map((v, i) => (
        <Animated.View
          key={i}
          style={[waveStyles.bar, {
            height: v.interpolate({ inputRange: [0, 1], outputRange: [3, 14] }),
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
          }]}
        />
      ))}
    </View>
  );
}
const waveStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 16 },
  bar: { width: 3, backgroundColor: ACCENT },
});

// ── Message row ───────────────────────────────────────────────────────────
function MessageRow({ msg, isMine, ar }) {
  return (
    <View style={[msgStyles.wrap, { alignItems: isMine ? (ar ? 'flex-start' : 'flex-end') : (ar ? 'flex-end' : 'flex-start') }]}>
      {!isMine && <Text style={[msgStyles.author, { letterSpacing: ls(1.5, ar) }]}>{shout(msg.user?.name || '', ar)}</Text>}
      <View style={[msgStyles.bubble, isMine ? msgStyles.bubbleMine : msgStyles.bubbleOther]}>
        {msg.text && <Text style={[msgStyles.text, isMine && { color: '#fff' }]}>{msg.text}</Text>}
      </View>
    </View>
  );
}
const msgStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 4, paddingVertical: 5 },
  author: { fontSize: 10, fontWeight: '800', color: MUTED, marginBottom: 4 },
  bubble: { maxWidth: '78%', padding: 12 },
  bubbleMine: { backgroundColor: TEXT },
  bubbleOther: { backgroundColor: '#F2F2F7', borderWidth: StyleSheet.hairlineWidth, borderColor: SEPARATOR },
  text: { color: TEXT, fontSize: 15, lineHeight: 20, fontWeight: '500' },
});

export default function CircleScreen({ route, navigation }) {
  const { circleId } = route.params;
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const ar = isAr(i18n);
  const { user: currentUser } = useSelector((s) => s.auth);
  const isFounder = currentUser?.phone === '+96599440289' || currentUser?.isFounder === true;

  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [polls, setPolls] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [recentActivity, setRecentActivity] = useState(0);
  const [userLoc, setUserLoc] = useState(null);

  const watchRef = useRef(null);
  const flatRef = useRef(null);
  const exitedRef = useRef(false);
  // Tracks the most recent vote per poll so stale HTTP responses don't revert state
  const expectedVoteRef = useRef({});

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
      setRecentActivity((a) => Math.min(a + 1, 30));
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

  // Activity decay
  useEffect(() => {
    const id = setInterval(() => setRecentActivity((a) => Math.max(0, a - 1)), 5000);
    return () => clearInterval(id);
  }, []);

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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BrutNav
        onBack={() => navigation.goBack()}
        right={<BrutNavLink onPress={() => setShowCreatePoll(true)} label={t('radar.flashPoll')} accent />}
      />

      {/* Hero: venue name + presence + frequency wave */}
      <View style={styles.hero}>
        <BrutHero title={room.title} label={`${activeHere} ${ar ? t('radar.hereNow') : shout(t('radar.hereNow'), false)}`} size={42} />
        <View style={[styles.heroRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
          <View style={styles.hereDot} />
          <FrequencyWave activity={recentActivity} />
        </View>
        <BrutRule mt={18} mb={0} />
      </View>

      {/* Messages + polls */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(m) => String(m._id)}
        renderItem={({ item }) => (
          <MessageRow msg={item} isMine={item.user?._id === currentUser?._id} ar={ar} />
        )}
        ListHeaderComponent={
          polls.length > 0 ? (
            <View>
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
          ) : null
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12 }}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Composer */}
      <View style={[styles.composer, { paddingBottom: insets.bottom + 12, flexDirection: ar ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity style={styles.cameraBtn} onPress={() => navigation.navigate('LiveCamera', { circleId })} activeOpacity={0.7}>
          <Text style={styles.cameraGlyph}>◉</Text>
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { textAlign: ar ? 'right' : 'left' }]}
          value={text}
          onChangeText={setText}
          placeholder={t('radar.composerPlaceholder')}
          placeholderTextColor={MUTED}
          multiline
          maxLength={500}
        />
        <TouchableOpacity onPress={handleSend} disabled={!text.trim()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={[styles.sendLabel, !text.trim() && { opacity: 0.35 }, { letterSpacing: ls(2, ar) }]}>
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
  container: { flex: 1, backgroundColor: BG },

  hero: { paddingHorizontal: 20, paddingTop: 8 },
  heroRow: { alignItems: 'center', marginTop: 14, gap: 10 },
  hereDot: { width: 8, height: 8, backgroundColor: ACCENT, borderRadius: 4 },

  composer: {
    alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 10, gap: 12,
    borderTopWidth: 2, borderTopColor: TEXT,
  },
  cameraBtn: {
    width: 44, height: 44,
    borderWidth: 2, borderColor: TEXT,
    justifyContent: 'center', alignItems: 'center',
  },
  cameraGlyph: { fontSize: 24, fontWeight: '900', color: TEXT },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120,
    paddingHorizontal: 0, paddingVertical: 10,
    fontSize: 16, color: TEXT, fontWeight: '600',
    borderBottomWidth: 2, borderBottomColor: TEXT,
  },
  sendLabel: { fontSize: 13, fontWeight: '900', color: ACCENT, paddingBottom: 12 },
});
