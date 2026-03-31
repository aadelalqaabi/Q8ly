import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { switchToAccount } from '../../store/slices/authSlice';
import { authAPI } from '../../services/api';

const STORAGE_KEY = '@kuwai_dev_accounts';

const DUMMY_PHONES = Array.from({ length: 20 }, (_, i) =>
  `+965000000${String(i + 1).padStart(2, '0')}`
);

// Direct AsyncStorage helpers — no shared util, no dependency issues
async function readSessions() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

async function writeSessions(map) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export default function DeveloperAccountsScreen({ navigation }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { colors: C } = useTheme();
  const { user: activeUser } = useSelector((s) => s.auth);

  // sessions: { phone: { token, user } }
  const [sessions, setSessions] = useState({});
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statuses, setStatuses] = useState({}); // phone → 'ok' | 'fail' | 'loading'

  const load = useCallback(async () => {
    const map = await readSessions();
    setSessions(map);
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateAll = async () => {
    setGenerating(true);
    setProgress(0);
    setStatuses({});

    const map = {};  // always start fresh — guarantees latest names/photos

    for (let i = 0; i < DUMMY_PHONES.length; i++) {
      const phone = DUMMY_PHONES[i];
      setStatuses((s) => ({ ...s, [phone]: 'loading' }));
      let res = null;
      try {
        // Try the fast single-call endpoint first
        res = await authAPI.dummyAuth(phone);
      } catch (e1) {
        // Fallback: old two-step OTP flow (works before server deploys new endpoint)
        try {
          await authAPI.sendOtp(phone);
          res = await authAPI.verifyOtp(phone, '123456');
        } catch (e2) {
          setStatuses((s) => ({ ...s, [phone]: `fail: ${e2?.message || e1?.message || 'error'}` }));
        }
      }
      if (res?.token && res?.user) {
        map[phone] = { token: res.token, user: res.user };
        await writeSessions(map);
        setStatuses((s) => ({ ...s, [phone]: 'ok' }));
      } else if (res !== null) {
        setStatuses((s) => ({ ...s, [phone]: 'fail: bad response' }));
      }
      setProgress(i + 1);
      setSessions({ ...map });
    }

    setSessions(map);
    setGenerating(false);
  };

  const handleSwitch = async (phone) => {
    const session = sessions[phone];
    if (!session) return;
    try {
      // Inject phone into user object — verifyOtp may not have returned it (old sessions)
      const userWithPhone = { ...session.user, phone };
      await dispatch(switchToAccount({ token: session.token, user: userWithPhone }));
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Failed to switch account');
    }
  };

  const totalSessions = Object.keys(sessions).length;
  const missing = DUMMY_PHONES.length - totalSessions;

  const renderItem = ({ item: phone, index }) => {
    const session = sessions[phone];
    const status = statuses[phone];
    const isActive = session?.user?.phone === activeUser?.phone;
    const initial = (session?.user?.name || session?.user?.username || '?').charAt(0).toUpperCase();

    return (
      <TouchableOpacity
        style={[styles.row, isActive && { backgroundColor: '#EEF2FA' }]}
        onPress={() => handleSwitch(phone)}
        disabled={!session}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        {session?.user?.profilePic ? (
          <Image source={{ uri: session.user.profilePic }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: session ? C.accent : C.fill, justifyContent: 'center', alignItems: 'center' }]}>
            {session
              ? <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{initial}</Text>
              : <Text style={{ color: C.textMuted, fontSize: 12 }}>{index + 1}</Text>
            }
          </View>
        )}

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, !session && { color: C.textMuted }]} numberOfLines={1}>
            {session?.user?.name || session?.user?.username || `Account ${index + 1}`}
          </Text>
          <Text style={styles.phone}>{phone}</Text>
        </View>

        {/* Status */}
        {status === 'loading' ? (
          <ActivityIndicator size="small" color={C.accent} />
        ) : isActive ? (
          <Ionicons name="checkmark-circle" size={22} color={C.accent} />
        ) : session ? (
          <Ionicons name="swap-horizontal" size={18} color={C.textMuted} />
        ) : typeof status === 'string' && status.startsWith('fail:') ? (
          <Text style={[styles.noSession, { color: '#FF3B30', maxWidth: 120 }]} numberOfLines={2}>
            {status.replace('fail: ', '')}
          </Text>
        ) : (
          <Text style={styles.noSession}>No session</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: C.white }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: C.separator }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={22} color={C.accent} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: C.text }]}>Developer Accounts</Text>
        <View style={styles.back} />
      </View>

      {/* Stats + Generate button */}
      <View style={[styles.banner, { backgroundColor: '#0033A0' }]}>
        <View>
          <Text style={styles.bannerNum}>{totalSessions}<Text style={styles.bannerOf}>/20</Text></Text>
          <Text style={styles.bannerLabel}>Sessions ready</Text>
        </View>

        {generating ? (
          <View style={styles.genProgress}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.genProgressText}>{progress}/20</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.genBtn, missing === 0 && { backgroundColor: 'rgba(255,255,255,0.15)' }]}
            onPress={generateAll}
            activeOpacity={0.8}
          >
            <Ionicons name={missing === 0 ? 'refresh' : 'flash'} size={16} color="#0033A0" />
            <Text style={styles.genBtnText}>
              {missing === 0 ? 'Refresh All' : `Generate ${missing} Missing`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Progress bar */}
      {generating && (
        <View style={[styles.progressTrack, { backgroundColor: C.separator }]}>
          <View style={[styles.progressFill, { width: `${(progress / 50) * 100}%`, backgroundColor: C.accent }]} />
        </View>
      )}

      {/* List */}
      <FlatList
        data={DUMMY_PHONES}
        keyExtractor={(p) => p}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: C.separator }]} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  title: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center', letterSpacing: -0.3 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  bannerNum: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  bannerOf: { fontSize: 18, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },
  bannerLabel: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  genBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  genBtnText: { fontSize: 14, fontWeight: '700', color: '#0033A0' },
  genProgress: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  genProgressText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  progressTrack: { height: 3 },
  progressFill: { height: 3 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  name: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  phone: { fontSize: 12, color: '#6C6C70', marginTop: 2 },
  noSession: { fontSize: 11, color: '#AEAEB2' },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 70 },
});
