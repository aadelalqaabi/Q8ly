import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { fetchConversation, sendDmMessage, addRealtimeMessage, clearActiveConversation } from '../../store/slices/dmSlice';
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
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { user } = useSelector((s) => s.auth);
  const { activeConversation, loading, sending } = useSelector((s) => s.dm);
  const [text, setText] = useState('');
  const flatListRef = useRef(null);

  const messages = activeConversation?.conversation?.messages || [];
  const other = activeConversation?.other;

  useEffect(() => {
    dispatch(fetchConversation(userId));
    return () => { dispatch(clearActiveConversation()); };
  }, [userId]);

  // Real-time DM via socket
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (data) => {
      if (data.conversationId === activeConversation?.conversation?._id) {
        dispatch(addRealtimeMessage(data));
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    };
    socket.on('dmMessage', handler);
    return () => socket.off('dmMessage', handler);
  }, [activeConversation?.conversation?._id]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setText('');
    await dispatch(sendDmMessage({ userId, text: trimmed }));
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const renderMessage = ({ item, index }) => {
    const isMe = item.sender?._id?.toString() === user?._id?.toString() || item.sender?.toString() === user?._id?.toString();
    const showTime = index === 0 || (index > 0 && new Date(item.createdAt) - new Date(messages[index - 1]?.createdAt) > 5 * 60 * 1000);

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
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerUser}>
          {other?.profilePic ? (
            <Image source={{ uri: other.profilePic }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, { backgroundColor: avatarBg(other?.name || otherName) }]}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{(other?.name || otherName)?.[0]?.toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.headerName}>{other?.name || otherName}</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

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
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Say hi 👋</Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={[styles.input, { backgroundColor: COLORS.fill, color: COLORS.text }]}
          value={text}
          onChangeText={setText}
          placeholder="Message..."
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

const makeStyles = (C) => StyleSheet.create({
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
  timeLabel: { textAlign: 'center', fontSize: 11, color: C.textMuted, marginVertical: 8 },
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
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
});
