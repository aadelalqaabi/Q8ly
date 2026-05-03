import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { hachiAPI } from '../../services/api';
import { getSocket, joinHachiRoom, leaveHachiRoom, sendHachiMessage } from '../../services/socket';
import {
  BrutNav, BrutNavLink, BrutHero, BrutRule, BG, TEXT, MUTED, ACCENT, SEPARATOR, isAr, ls, shout,
} from '../../components/Brut';
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

// ── Flash poll card ───────────────────────────────────────────────────────
function PollCard({ poll, onVote, currentUserId, ar }) {
  const totalVotes = poll.options.reduce((sum, o) => sum + (o.voters?.length || 0), 0);
  const userVote = poll.options.find((o) => (o.voters || []).some((v) => v === currentUserId || v?._id === currentUserId));
  const expiresIn = Math.max(0, Math.floor((new Date(poll.expiresAt) - Date.now()) / 60000));

  return (
    <View style={pollStyles.card}>
      <View style={[pollStyles.header, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
        <Text style={[pollStyles.tag, { letterSpacing: ls(2, ar) }]}>● POLL</Text>
        <View style={{ flex: 1 }} />
        <Text style={pollStyles.timer}>{expiresIn}m</Text>
      </View>
      <Text style={[pollStyles.question, { textAlign: ar ? 'right' : 'left' }]}>{poll.question}</Text>
      {poll.options.map((opt) => {
        const votes = opt.voters?.length || 0;
        const pct = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
        const isMine = userVote?._id === opt._id;
        return (
          <TouchableOpacity key={opt._id} style={pollStyles.option} onPress={() => onVote(opt._id)} activeOpacity={0.7}>
            <View style={[pollStyles.fill, { width: `${pct}%`, backgroundColor: isMine ? ACCENT : '#EEF2FA' }]} />
            <Text style={[pollStyles.optionText, isMine && { color: '#fff' }, { textAlign: ar ? 'right' : 'left' }]}>
              {opt.text}
            </Text>
            <Text style={[pollStyles.optionPct, isMine && { color: '#fff' }]}>{Math.round(pct)}%</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const pollStyles = StyleSheet.create({
  card: {
    marginVertical: 10, padding: 14,
    borderWidth: 2, borderColor: TEXT,
  },
  header: { alignItems: 'center', marginBottom: 10 },
  tag: { fontSize: 10, fontWeight: '900', color: ACCENT },
  timer: { fontSize: 11, fontWeight: '800', color: MUTED, fontVariant: ['tabular-nums'] },
  question: { fontSize: 16, fontWeight: '900', color: TEXT, marginBottom: 12 },
  option: {
    height: 44, marginBottom: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: TEXT,
    overflow: 'hidden', justifyContent: 'center',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  optionText: { color: TEXT, fontSize: 14, fontWeight: '700', marginStart: 14, marginEnd: 50 },
  optionPct: { position: 'absolute', right: 14, color: TEXT, fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },
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
        try {
          const pollRes = await hachiAPI.listPolls(circleId, loc.lat, loc.lng);
          setPolls(pollRes.polls || []);
        } catch {}
      }
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

    // Founder: skip GPS entirely, load instantly. Server allows them in.
    if (isFounder) {
      safeLoad(null);
      return () => { cancelled = true; };
    }

    if (!Location) {
      safeLoad(null);
      return () => { cancelled = true; };
    }

    // Race the location lookup against a 4s fallback so cold GPS doesn't block entry
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

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    joinHachiRoom(circleId);
    const onMsg = ({ roomId, message }) => {
      if (roomId !== circleId) return;
      setMessages((m) => [...m, message]);
      setRecentActivity((a) => Math.min(a + 1, 30));
    };
    const onPoll = ({ poll }) => setPolls((p) => [poll, ...p.filter((x) => x._id !== poll._id)]);
    const onPollUpdate = ({ poll }) => setPolls((p) => p.map((x) => (x._id === poll._id ? poll : x)));
    socket.on('hachiMessage', onMsg);
    socket.on('flashPollCreated', onPoll);
    socket.on('flashPollUpdate', onPollUpdate);
    return () => {
      socket.off('hachiMessage', onMsg);
      socket.off('flashPollCreated', onPoll);
      socket.off('flashPollUpdate', onPollUpdate);
      leaveHachiRoom(circleId);
    };
  }, [circleId]);

  useEffect(() => {
    const id = setInterval(() => setRecentActivity((a) => Math.max(0, a - 1)), 5000);
    return () => clearInterval(id);
  }, []);

  const handleSend = () => {
    if (!text.trim()) return;
    const locParam = userLoc ? { lat: userLoc.lat, lng: userLoc.lng, speed: userLoc.speed } : null;
    sendHachiMessage(circleId, text.trim(), null, locParam);
    setText('');
  };

  const handleVote = async (pollId, optionId) => {
    try {
      const res = await hachiAPI.votePoll(pollId, optionId, userLoc?.lat, userLoc?.lng);
      setPolls((p) => p.map((x) => (x._id === pollId ? res.poll : x)));
    } catch {}
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
          <View style={styles.hereBlock}>
            <View style={styles.hereDot} />
          </View>
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
                <PollCard key={poll._id} poll={poll} onVote={(optId) => handleVote(poll._id, optId)} currentUserId={currentUser?._id} ar={ar} />
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

      {/* Create Poll modal */}
      <CreatePollModal
        visible={showCreatePoll}
        onClose={() => setShowCreatePoll(false)}
        onCreated={(poll) => { setPolls((p) => [poll, ...p]); setShowCreatePoll(false); }}
        circleId={circleId}
        userLoc={userLoc}
      />
    </KeyboardAvoidingView>
  );
}

function CreatePollModal({ visible, onClose, onCreated, circleId, userLoc }) {
  const { t, i18n } = useTranslation();
  const ar = isAr(i18n);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!visible) { setQuestion(''); setOptions(['', '']); }
  }, [visible]);

  const submit = async () => {
    const filled = options.filter((o) => o.trim());
    if (!question.trim() || filled.length < 2 || !userLoc) return;
    setCreating(true);
    try {
      const res = await hachiAPI.createPoll(circleId, question.trim(), filled, userLoc.lat, userLoc.lng);
      onCreated(res.poll);
    } catch {} finally { setCreating(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <BrutNav
          onBack={onClose}
          leftLabel={t('common.cancel')}
          right={
            <TouchableOpacity onPress={submit} disabled={creating || !question.trim()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={[
                styles.sendLabel,
                (creating || !question.trim()) && { opacity: 0.35 },
                { letterSpacing: ls(2, ar) },
              ]}>
                {creating ? '...' : shout(t('radar.post'), ar)}
              </Text>
            </TouchableOpacity>
          }
        />
        <View style={{ paddingHorizontal: 24 }}>
          <BrutHero title={t('radar.flashPoll')} label={ar ? '١٥ دقيقة' : '15 MINUTES'} size={42} />
          <BrutRule mt={20} mb={24} />
          <Text style={[styles.modalLabel, { letterSpacing: ls(2, ar), textAlign: ar ? 'right' : 'left' }]}>
            {shout(t('radar.question'), ar)}
          </Text>
          <TextInput
            style={[styles.modalInput, { textAlign: ar ? 'right' : 'left' }]}
            value={question}
            onChangeText={setQuestion}
            placeholder={t('radar.questionPlaceholder')}
            placeholderTextColor={MUTED}
            maxLength={100}
          />
          <View style={{ height: 18 }} />
          <Text style={[styles.modalLabel, { letterSpacing: ls(2, ar), textAlign: ar ? 'right' : 'left' }]}>
            {shout(t('radar.options'), ar)}
          </Text>
          {options.map((opt, i) => (
            <TextInput
              key={i}
              style={[styles.modalInput, { textAlign: ar ? 'right' : 'left' }]}
              value={opt}
              onChangeText={(v) => { const next = [...options]; next[i] = v; setOptions(next); }}
              placeholder={`Option ${i + 1}`}
              placeholderTextColor={MUTED}
              maxLength={60}
            />
          ))}
          {options.length < 4 && (
            <TouchableOpacity onPress={() => setOptions([...options, ''])} style={{ alignSelf: ar ? 'flex-end' : 'flex-start', paddingVertical: 8 }}>
              <Text style={[styles.addOption, { letterSpacing: ls(2, ar) }]}>+ {ar ? 'خيار' : 'OPTION'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  hero: { paddingHorizontal: 20, paddingTop: 8 },
  heroRow: { alignItems: 'center', marginTop: 14, gap: 10 },
  hereBlock: {},
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

  modalLabel: { fontSize: 11, fontWeight: '800', color: MUTED, marginBottom: 6 },
  modalInput: {
    fontSize: 18, fontWeight: '700', color: TEXT,
    paddingVertical: 10, marginBottom: 8,
    borderBottomWidth: 2, borderBottomColor: TEXT,
  },
  addOption: { fontSize: 12, fontWeight: '900', color: ACCENT },
});
