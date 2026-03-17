import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator, Keyboard,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { fetchConversation, sendDmMessage, clearActiveConversation } from '../../store/slices/dmSlice';
import { getSocket } from '../../services/socket';
import { useTheme } from '../../context/ThemeContext';

const PALETTE = ['#0033A0', '#007A3D', '#FF6B35', '#2196F3', '#9C27B0', '#00BCD4', '#FF9800'];
function avatarBg(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export default function DMConversationScreen({ navigation, route }) {
  const { userId, username, name: otherName } = route.params;
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS, isRTL), [COLORS, isRTL]);
  const { user } = useSelector((s) => s.auth);
  const { activeConversation, loading, sending } = useSelector((s) => s.dm);
  const [text, setText] = useState('');
  const [otherTyping, setOtherTyping] = useState(false);
  const [lastSeenMsgId, setLastSeenMsgId] = useState(null);
  const flatListRef = useRef(null);
  const conversationIdRef = useRef(null);
  const userIdRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messagesRef = useRef([]);

  const messages = activeConversation?.conversation?.messages || [];
  const other = activeConversation?.other;
  const conversation = activeConversation?.conversation;

  // Keep refs up-to-date to avoid stale closures in socket handlers
  conversationIdRef.current = conversation?._id ?? null;
  userIdRef.current = user?._id ?? null;
  messagesRef.current = messages;

  // Am I the one who initiated this pending request?
  const isPendingInitiator = useMemo(() => {
    if (!conversation || conversation.status !== 'pending') return false;
    const initiatorId = conversation.initiator?._id?.toString() || conversation.initiator?.toString();
    return initiatorId === user?._id?.toString();
  }, [conversation, user]);

  // Initialize lastSeenMsgId from DB: find the last sent message that is already read
  useEffect(() => {
    if (!messages.length) return;
    let lastReadId = null;
    messages.forEach((m) => {
      const isMe = m.sender?._id?.toString() === user?._id?.toString() || m.sender?.toString() === user?._id?.toString();
      if (isMe && m.isRead) lastReadId = m._id;
    });
    if (lastReadId) setLastSeenMsgId(lastReadId);
  }, [activeConversation]);

  useEffect(() => {
    dispatch(fetchConversation(userId));
    return () => { dispatch(clearActiveConversation()); };
  }, [userId]);

  // Mark conversation as seen on the server when it loads
  useEffect(() => {
    if (!conversation?._id) return;
    const socket = getSocket();
    if (socket) socket.emit('dmMarkSeen', { conversationId: conversation._id });
  }, [conversation?._id]);

  // Real-time DM via socket
  // NOTE: addRealtimeMessage is dispatched globally by AppNavigator — don't dispatch it here too
  // Handlers use refs so they always read the latest conversationId without stale closures
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onMessage = (data) => {
      if (!conversationIdRef.current || data.conversationId?.toString() !== conversationIdRef.current?.toString()) return;
      const senderId = data.message?.sender?._id?.toString() || data.message?.sender?.toString();
      if (senderId !== userIdRef.current) {
        socket.emit('dmMarkSeen', { conversationId: data.conversationId });
      }
    };

    const onSeen = (data) => {
      if (!conversationIdRef.current || data.conversationId?.toString() !== conversationIdRef.current?.toString()) return;
      // Find the last message I sent and mark that specific one as seen
      const myMsgs = messagesRef.current.filter((m) => {
        return m.sender?._id?.toString() === userIdRef.current || m.sender?.toString() === userIdRef.current;
      });
      const lastMine = myMsgs[myMsgs.length - 1];
      if (lastMine?._id) setLastSeenMsgId(lastMine._id);
    };

    socket.on('dmMessage', onMessage);
    socket.on('dmSeen', onSeen);
    return () => {
      socket.off('dmMessage', onMessage);
      socket.off('dmSeen', onSeen);
    };
  }, []); // empty deps — registered once, always reads latest via refs

  // Typing indicator — registered on focus, cleaned up on blur
  useFocusEffect(
    useCallback(() => {
      const socket = getSocket();
      if (!socket) return;
      const onTyping = (data) => {
        setOtherTyping(!!data.isTyping);
      };
      socket.on('dmTyping', onTyping);
      return () => {
        socket.off('dmTyping', onTyping);
        setOtherTyping(false);
      };
    }, [])
  );

  // Clear typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      getSocket()?.emit('dmTyping', { otherUserId: userId, isTyping: false });
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length]);

  // Scroll to bottom when typing indicator appears so bubbles aren't hidden
  useEffect(() => {
    if (otherTyping) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [otherTyping]);

  // Scroll to bottom when keyboard opens so latest messages stay visible
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100),
    );
    return () => show.remove();
  }, []);

  const emitTyping = (isTyping) => {
    const socket = getSocket();
    if (!socket) { console.warn('[dmTyping] no socket'); return; }
    console.log('[dmTyping emit]', { otherUserId: userId, isTyping });
    socket.emit('dmTyping', { otherUserId: userId, isTyping });
  };

  const handleTextChange = (val) => {
    setText(val);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (val.length > 0) {
      emitTyping(true);
      typingTimeoutRef.current = setTimeout(() => emitTyping(false), 3000);
    } else {
      emitTyping(false);
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setText('');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    emitTyping(false);
    setLastSeenMsgId(null);
    await dispatch(sendDmMessage({ userId, text: trimmed }));
    if (!conversation || conversation.status === 'pending') {
      await dispatch(fetchConversation(userId));
    }
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const renderMessage = ({ item, index }) => {
    const isMe = item.sender?._id?.toString() === user?._id?.toString() || item.sender?.toString() === user?._id?.toString();
    const showTime = index === 0 || (index > 0 && new Date(item.createdAt) - new Date(messages[index - 1]?.createdAt) > 5 * 60 * 1000);
    const showSeen = isMe && item._id && item._id.toString() === lastSeenMsgId?.toString();

    return (
      <View>
        {showTime && (
          <Text style={styles.timeLabel}>
            {item.createdAt ? format(new Date(item.createdAt), 'h:mm a') : ''}
          </Text>
        )}
        <View style={[styles.bubbleRow, isMe && styles.bubbleRowMe]}>
          {!isMe && (
            other?.profilePic ? (
              <Image source={{ uri: other.profilePic }} style={styles.bubbleAvatar} />
            ) : (
              <View style={[styles.bubbleAvatar, { backgroundColor: avatarBg(other?.name) }]}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{other?.name?.[0]?.toUpperCase()}</Text>
              </View>
            )
          )}
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
            <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.text}</Text>
          </View>
        </View>
        {showSeen && (
          <Text style={styles.seenLabel}>{t('dm.seen')}</Text>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={24} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerUser}
          onPress={() => navigation.navigate('ProfileDetail', { userId, username })}
          activeOpacity={0.7}
        >
          {other?.profilePic ? (
            <Image source={{ uri: other.profilePic }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, { backgroundColor: avatarBg(other?.name || otherName) }]}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{(other?.name || otherName)?.[0]?.toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.headerName}>{other?.name || otherName}</Text>
        </TouchableOpacity>
        <View style={{ width: 32 }} />
      </View>

      {/* Pending request banner */}
      {isPendingInitiator && (
        <View style={styles.pendingBanner}>
          <Ionicons name="time-outline" size={14} color="#666" />
          <Text style={styles.pendingText}>{t('dm.pendingRequest')}</Text>
        </View>
      )}

      {/* Messages */}
      {loading && messages.length === 0 ? (
        <ActivityIndicator style={{ flex: 1 }} color={COLORS.accent} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, i) => item._id || String(i)}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 16, gap: 4, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('dm.sayHi')}</Text>
            </View>
          }
        />
      )}

      {/* Typing indicator */}
      {otherTyping && (
        <View style={styles.typingRow}>
          <View style={styles.typingBubble}>
            <View style={styles.typingDots}>
              <View style={styles.dot} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
            <Text style={styles.typingText}>
              {t('dm.isTyping', { name: other?.name || otherName })}
            </Text>
          </View>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={[styles.input, { backgroundColor: COLORS.fill, color: COLORS.text }]}
          value={text}
          onChangeText={handleTextChange}
          placeholder={t('dm.messagePlaceholder')}
          placeholderTextColor={COLORS.textMuted}
          multiline
          maxLength={1000}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: text.trim() ? COLORS.accent : COLORS.fill }]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-up" size={18} color={text.trim() ? '#fff' : COLORS.textMuted} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (C, isRTL) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  headerUser: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  headerName: { fontSize: 16, fontWeight: '600', color: C.text },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F2F2F7',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  pendingText: { fontSize: 13, color: '#666', flex: 1 },
  timeLabel: { textAlign: 'center', fontSize: 11, color: C.textMuted, marginVertical: 8 },
  seenLabel: { fontSize: 11, color: C.textMuted, textAlign: 'right', marginEnd: 4, marginTop: 2 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginVertical: 2 },
  bubbleRowMe: { flexDirection: 'row-reverse' },
  bubbleAvatar: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  bubble: {
    maxWidth: '72%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  bubbleMe: { backgroundColor: C.accent, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: C.fill, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: C.text, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: C.textMuted },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.separator,
    backgroundColor: C.white,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    maxHeight: 120,
    textAlign: isRTL ? 'right' : 'left',
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  typingRow: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
  },
  typingDots: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  typingText: { fontSize: 12, color: C.textMuted, writingDirection: 'auto' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.textMuted },
});
