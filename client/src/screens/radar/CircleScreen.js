import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { hachiAPI, uploadAPI } from '../../services/api';
import { getSocket, joinHachiRoom, leaveHachiRoom, sendHachiMessage } from '../../services/socket';
let Location = null;
try { Location = require('expo-location'); } catch {}

// ── Frequency wave (vibe visualizer) ──────────────────────────────────────────
function FrequencyWave({ activity }) {
  const bars = 7;
  const animValues = useRef(Array.from({ length: bars }, () => new Animated.Value(0.3))).current;

  useEffect(() => {
    const speed = Math.max(300, 1500 - activity * 100);
    const animations = animValues.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: Math.random() * 0.7 + 0.3, duration: speed + i * 80, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(v, { toValue: Math.random() * 0.4 + 0.2, duration: speed + i * 80, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [activity]);

  return (
    <View style={waveStyles.row}>
      {animValues.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            waveStyles.bar,
            {
              height: v.interpolate({ inputRange: [0, 1], outputRange: [3, 14] }),
              opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
            },
          ]}
        />
      ))}
    </View>
  );
}

const waveStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 16 },
  bar: { width: 3, borderRadius: 2, backgroundColor: '#4D80FF' },
});

// ── Flash Poll card ───────────────────────────────────────────────────────────
function PollCard({ poll, onVote, currentUserId }) {
  const totalVotes = poll.options.reduce((sum, o) => sum + (o.voters?.length || 0), 0);
  const userVote = poll.options.find((o) => (o.voters || []).some((v) => v === currentUserId || v?._id === currentUserId));
  const expiresIn = Math.max(0, Math.floor((new Date(poll.expiresAt) - Date.now()) / 60000));

  return (
    <View style={pollStyles.card}>
      <View style={pollStyles.header}>
        <Ionicons name="flash" size={14} color="#FFB800" />
        <Text style={pollStyles.timer}>{expiresIn}m</Text>
      </View>
      <Text style={pollStyles.question}>{poll.question}</Text>
      {poll.options.map((opt) => {
        const votes = opt.voters?.length || 0;
        const pct = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
        const isMine = userVote?._id === opt._id;
        return (
          <TouchableOpacity
            key={opt._id}
            style={[pollStyles.option, isMine && pollStyles.optionMine]}
            onPress={() => onVote(opt._id)}
            activeOpacity={0.7}
          >
            <View style={[pollStyles.fill, { width: `${pct}%`, backgroundColor: isMine ? '#4D80FF' : 'rgba(77,128,255,0.18)' }]} />
            <Text style={[pollStyles.optionText, isMine && { color: '#fff' }]}>{opt.text}</Text>
            <Text style={[pollStyles.optionPct, isMine && { color: '#fff' }]}>{Math.round(pct)}%</Text>
          </TouchableOpacity>
        );
      })}
      <Text style={pollStyles.totalVotes}>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</Text>
    </View>
  );
}

const pollStyles = StyleSheet.create({
  card: {
    marginHorizontal: 12, marginVertical: 8,
    backgroundColor: 'rgba(20,28,50,0.7)',
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(77,128,255,0.3)',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  timer: { fontSize: 12, fontWeight: '700', color: '#FFB800' },
  question: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12 },
  option: {
    height: 44, borderRadius: 10, marginBottom: 7,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden', justifyContent: 'center',
  },
  optionMine: { borderColor: '#4D80FF' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 10 },
  optionText: { color: '#fff', fontSize: 14, fontWeight: '600', marginStart: 14 },
  optionPct: { position: 'absolute', right: 14, color: '#fff', fontSize: 13, fontWeight: '700' },
  totalVotes: { fontSize: 11, color: '#6c7a99', marginTop: 4, textAlign: 'center' },
});

// ── Message row ───────────────────────────────────────────────────────────────
function MessageRow({ msg, isMine }) {
  return (
    <View style={[msgStyles.wrap, isMine && { alignItems: 'flex-end' }]}>
      {!isMine && <Text style={msgStyles.author}>{msg.user?.name}</Text>}
      <View style={[msgStyles.bubble, isMine ? msgStyles.bubbleMine : msgStyles.bubbleOther]}>
        {msg.image && (
          <View style={msgStyles.imageWrap}>
            <Text style={{ fontSize: 10, color: '#FFB800', marginBottom: 4, fontWeight: '700' }}>● LIVE</Text>
            {/* eslint-disable-next-line react-native/no-inline-styles */}
            <View style={{ width: 200, height: 200, borderRadius: 12, backgroundColor: '#0a0e1a' }} />
          </View>
        )}
        {msg.text && <Text style={msgStyles.text}>{msg.text}</Text>}
      </View>
    </View>
  );
}

const msgStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingVertical: 4 },
  author: { fontSize: 11, color: '#6c7a99', marginBottom: 3, marginStart: 12 },
  bubble: { maxWidth: '75%', padding: 10, borderRadius: 16 },
  bubbleMine: { backgroundColor: '#4D80FF', borderBottomEndRadius: 4 },
  bubbleOther: { backgroundColor: 'rgba(255,255,255,0.06)', borderBottomStartRadius: 4 },
  text: { color: '#fff', fontSize: 15, lineHeight: 20 },
  imageWrap: { marginBottom: 6 },
});

// ── Main CircleScreen ─────────────────────────────────────────────────────────
export default function CircleScreen({ route, navigation }) {
  const { circleId } = route.params;
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user: currentUser } = useSelector((s) => s.auth);

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

  // Fetch room with current location
  const loadRoom = useCallback(async (loc) => {
    try {
      const res = await hachiAPI.getRoom(circleId, loc);
      if (!res.inside) {
        // User not inside — kick back to radar
        if (!exitedRef.current) {
          exitedRef.current = true;
          navigation.replace('MainTabs');
        }
        return;
      }
      setRoom(res.room);
      setMessages(res.room.messages || []);
      // Load polls
      try {
        const pollRes = await hachiAPI.listPolls(circleId, loc.lat, loc.lng);
        setPolls(pollRes.polls || []);
      } catch {}
    } catch (e) {
      // 403 = outside or other err
      if (e.status === 403 && !exitedRef.current) {
        exitedRef.current = true;
        navigation.replace('MainTabs');
      }
    } finally { setLoading(false); }
  }, [circleId, navigation]);

  // Location watch + geofence enforcement
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!Location) return;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (cancelled) return;
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, speed: pos.coords.speed };
        setUserLoc(loc);
        loadRoom(loc);
        watchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 15, timeInterval: 6000 },
          async (p) => {
            const next = { lat: p.coords.latitude, lng: p.coords.longitude, speed: p.coords.speed };
            setUserLoc(next);
            // Periodically re-verify geofence
            try {
              const result = await hachiAPI.checkLocation(circleId, next.lat, next.lng, next.speed || 0);
              if (result.status !== 'here' && !exitedRef.current) {
                exitedRef.current = true;
                navigation.replace('MainTabs');
              }
            } catch {}
          }
        );
      } catch {}
    })();
    return () => {
      cancelled = true;
      if (watchRef.current) watchRef.current.remove();
    };
  }, [circleId, navigation, loadRoom]);

  // Socket hookup
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

  // Activity decay (frequency wave)
  useEffect(() => {
    const t = setInterval(() => setRecentActivity((a) => Math.max(0, a - 1)), 5000);
    return () => clearInterval(t);
  }, []);

  const handleSend = () => {
    if (!text.trim() || !userLoc) return;
    sendHachiMessage(circleId, text.trim(), null, { lat: userLoc.lat, lng: userLoc.lng, speed: userLoc.speed });
    setText('');
  };

  const handleLiveCamera = () => {
    navigation.navigate('LiveCamera', { circleId });
  };

  const handleVote = async (pollId, optionId) => {
    try {
      const res = await hachiAPI.votePoll(pollId, optionId, userLoc.lat, userLoc.lng);
      setPolls((p) => p.map((x) => (x._id === pollId ? res.poll : x)));
    } catch {}
  };

  if (loading || !room) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#4D80FF" />
      </View>
    );
  }

  const activeHere = (room.hereNow || []).filter((p) => new Date(p.expiresAt) > new Date()).length;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title} numberOfLines={1}>{room.title}</Text>
          <View style={styles.subRow}>
            <View style={styles.hereDot} />
            <Text style={styles.subText}>{activeHere} {t('radar.hereNow')}</Text>
            <View style={{ width: 8 }} />
            <FrequencyWave activity={recentActivity} />
          </View>
        </View>
        <TouchableOpacity onPress={() => setShowCreatePoll(true)} style={styles.headerBtn}>
          <Ionicons name="flash-outline" size={22} color="#FFB800" />
        </TouchableOpacity>
      </View>

      {/* Messages + polls */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(m) => String(m._id)}
        renderItem={({ item }) => (
          <MessageRow msg={item} isMine={item.user?._id === currentUser?._id} />
        )}
        ListHeaderComponent={
          polls.length > 0 ? (
            <View>
              {polls.map((poll) => (
                <PollCard key={poll._id} poll={poll} onVote={(optId) => handleVote(poll._id, optId)} currentUserId={currentUser?._id} />
              ))}
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 12 }}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Composer */}
      <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={styles.cameraBtn} onPress={handleLiveCamera} activeOpacity={0.7}>
          <Ionicons name="camera" size={22} color="#fff" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={t('radar.composerPlaceholder')}
          placeholderTextColor="#6c7a99"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && { opacity: 0.4 }]}
          onPress={handleSend}
          disabled={!text.trim()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-up" size={20} color="#fff" />
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

// ── Create Poll modal ─────────────────────────────────────────────────────────
function CreatePollModal({ visible, onClose, onCreated, circleId, userLoc }) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [creating, setCreating] = useState(false);

  const reset = () => { setQuestion(''); setOptions(['', '']); };
  useEffect(() => { if (!visible) reset(); }, [visible]);

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
      <View style={pollModalStyles.container}>
        <View style={pollModalStyles.header}>
          <TouchableOpacity onPress={onClose}><Text style={pollModalStyles.cancel}>Cancel</Text></TouchableOpacity>
          <Text style={pollModalStyles.title}>{t('radar.flashPoll')}</Text>
          <TouchableOpacity onPress={submit} disabled={creating || !question.trim()}>
            <Text style={[pollModalStyles.post, (creating || !question.trim()) && { opacity: 0.4 }]}>{t('radar.post')}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ padding: 20 }}>
          <Text style={pollModalStyles.label}>{t('radar.question')}</Text>
          <TextInput
            style={pollModalStyles.input}
            value={question}
            onChangeText={setQuestion}
            placeholder={t('radar.questionPlaceholder')}
            placeholderTextColor="#6c7a99"
            maxLength={100}
          />
          <Text style={[pollModalStyles.label, { marginTop: 20 }]}>{t('radar.options')}</Text>
          {options.map((opt, i) => (
            <TextInput
              key={i}
              style={pollModalStyles.input}
              value={opt}
              onChangeText={(v) => { const next = [...options]; next[i] = v; setOptions(next); }}
              placeholder={`Option ${i + 1}`}
              placeholderTextColor="#6c7a99"
              maxLength={60}
            />
          ))}
          {options.length < 4 && (
            <TouchableOpacity onPress={() => setOptions([...options, ''])}>
              <Text style={pollModalStyles.addOpt}>+ Add option</Text>
            </TouchableOpacity>
          )}
          <Text style={pollModalStyles.hint}>{t('radar.flashPollHint')}</Text>
        </View>
      </View>
    </Modal>
  );
}

const pollModalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  cancel: { fontSize: 16, color: '#6c7a99' },
  title: { fontSize: 17, fontWeight: '700', color: '#fff' },
  post: { fontSize: 16, color: '#4D80FF', fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '700', color: '#6c7a99', marginBottom: 8, textTransform: 'uppercase' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#fff', marginBottom: 8,
  },
  addOpt: { color: '#4D80FF', fontSize: 14, fontWeight: '600', paddingVertical: 10 },
  hint: { fontSize: 12, color: '#6c7a99', marginTop: 16, textAlign: 'center' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: '#fff' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  hereDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4D80FF' },
  subText: { fontSize: 12, fontWeight: '600', color: '#6c7a99' },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 8, paddingTop: 8, gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  cameraBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  input: {
    flex: 1, minHeight: 38, maxHeight: 120,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 19, paddingHorizontal: 14, paddingVertical: 9,
    color: '#fff', fontSize: 15,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#4D80FF',
    justifyContent: 'center', alignItems: 'center',
  },
});
