import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
  Image, Modal, Alert, Keyboard, Share,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import {
  fetchRoom,
  addOptimisticMessage, addMessageRealtime, updateMemberCount, updateReactions,
  updateMessageReaction, clearActiveRoom,
  removeUserMessages, updatePinnedMessages, deleteMessage,
} from '../../store/slices/hachiSlice';
import {
  getSocket, joinHachiRoom, leaveHachiRoom, sendHachiMessage,
  sendHachiMessageReaction, sendHachiKick, sendHachiPin,
  sendHachiImage, sendHachiVideo,
} from '../../services/socket';
import { getDateLocale } from '../../i18n';
import { hachiAPI, uploadAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

const PALETTE = ['#0033A0', '#007A3D', '#FF6B35', '#2196F3', '#9C27B0', '#00BCD4', '#FF9800'];
function avatarBg(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

const QUICK_EMOJIS = ['❤️', '😂', '🔥', '👍', '😮', '💀'];

// ── Reaction pills below a message ────────────────────────────────────────────
function ReactionPills({ reactions, currentUserId, onPress }) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  if (!reactions?.length) return null;
  return (
    <View style={styles.pillsRow}>
      {reactions.map((r) => {
        const reacted = r.users?.includes(currentUserId?.toString());
        return (
          <TouchableOpacity
            key={r.emoji}
            style={[styles.pill, reacted && styles.pillActive]}
            onPress={() => onPress(r.emoji)}
            activeOpacity={0.7}
          >
            <Text style={styles.pillEmoji}>{r.emoji}</Text>
            <Text style={[styles.pillCount, reacted && styles.pillCountActive]}>{r.count}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Single message row ─────────────────────────────────────────────────────────
function MessageRow({ message, isMine, onLongPress, currentUserId, onReact, onUserPress }) {
  const { t } = useTranslation();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { user, text, image, video, videoThumbnail, reactions, createdAt } = message;

  const timeStr = createdAt
    ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const hasMedia = !!(image || video);
  const isMediaOnly = hasMedia && !text;

  const avatarEl = user?.profilePic ? (
    <Image source={{ uri: user.profilePic }} style={styles.msgAvatar} />
  ) : (
    <View style={[styles.msgAvatar, { backgroundColor: avatarBg(user?.name) }]}>
      <Text style={styles.msgAvatarText}>{user?.name?.[0]?.toUpperCase() || '?'}</Text>
    </View>
  );

  return (
    <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
      {!isMine && (
        <TouchableOpacity onPress={() => onUserPress(user)} activeOpacity={0.7}>
          {avatarEl}
        </TouchableOpacity>
      )}
      <View style={[styles.msgCol, isMine && styles.msgColMine]}>
        <TouchableOpacity
          onLongPress={() => onLongPress(message)}
          delayLongPress={300}
          activeOpacity={0.9}
        >
          <View style={[
            styles.msgBubble,
            isMine && styles.msgBubbleMine,
            isMediaOnly && styles.msgBubbleMedia,
          ]}>
            {!isMine && (
              <TouchableOpacity onPress={() => onUserPress(user)} activeOpacity={0.7}>
                <Text style={styles.msgAuthor}>{user?.name || t('hachi.someoneDefault')}</Text>
              </TouchableOpacity>
            )}
            {image && (
              <Image source={{ uri: image }} style={styles.msgImage} resizeMode="cover" />
            )}
            {video && (
              <TouchableOpacity activeOpacity={0.9}>
                <Image source={{ uri: videoThumbnail || video }} style={styles.msgImage} resizeMode="cover" />
                <View style={styles.playOverlay}>
                  <View style={styles.playBtn}>
                    <Ionicons name="play" size={22} color="#fff" />
                  </View>
                </View>
              </TouchableOpacity>
            )}
            {!!text && <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{text}</Text>}
            <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>{timeStr}</Text>
          </View>
        </TouchableOpacity>
        <ReactionPills
          reactions={reactions}
          currentUserId={currentUserId}
          onPress={(emoji) => onReact(message._id, emoji)}
        />
      </View>
    </View>
  );
}

export default function HachiRoomScreen({ navigation, route }) {
  const { roomId } = route.params;
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { activeRoom, roomLoading } = useSelector((s) => s.hachi);
  const { user: currentUser } = useSelector((s) => s.auth);
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS, isRTL), [COLORS, isRTL]);
  const flatRef = useRef(null);
  const [text, setText] = useState('');
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isCreator = (activeRoom?.creator?._id || activeRoom?.creator)?.toString() === currentUser?._id?.toString();

  // Must be before any conditional returns (hooks rule)
  const pinnedMessages = useMemo(() => {
    if (!activeRoom?.pinnedMessages?.length) return [];
    return activeRoom.pinnedMessages
      .map((pid) => activeRoom.messages?.find((m) => m._id?.toString() === pid?.toString()))
      .filter(Boolean);
  }, [activeRoom?.pinnedMessages, activeRoom?.messages]);

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchRoom(roomId));
    joinHachiRoom(roomId);

    const socket = getSocket();
    if (!socket) return;

    const onMessage = (data) => {
      if (data.roomId === roomId) dispatch(addMessageRealtime(data));
    };
    const onCount = (data) => {
      if (data.roomId === roomId) dispatch(updateMemberCount(data));
    };
    const onReaction = (data) => {
      if (data.roomId === roomId) dispatch(updateReactions(data));
    };
    const onMsgReaction = (data) => {
      if (data.roomId === roomId) dispatch(updateMessageReaction(data));
    };
    const onKicked = (data) => {
      if (data.roomId === roomId) setIsViewOnly(true);
    };
    const onMessagesRemoved = (data) => {
      if (data.roomId === roomId) {
        dispatch(removeUserMessages({ userId: data.userId, pinnedMessages: data.pinnedMessages }));
      }
    };
    const onPinUpdate = (data) => {
      if (data.roomId === roomId) dispatch(updatePinnedMessages(data));
    };
    const onMsgDeleted = (data) => {
      if (data.roomId === roomId) dispatch(deleteMessage(data));
    };

    // Re-join room after socket reconnect so broadcasts keep arriving
    const onReconnect = () => joinHachiRoom(roomId);

    socket.on('hachiMessage', onMessage);
    socket.on('hachiMemberCount', onCount);
    socket.on('hachiReactionUpdate', onReaction);
    socket.on('hachiMessageReaction', onMsgReaction);
    socket.on('hachiKicked', onKicked);
    socket.on('hachiMessagesRemoved', onMessagesRemoved);
    socket.on('hachiPinUpdate', onPinUpdate);
    socket.on('hachiMessageDeleted', onMsgDeleted);
    socket.on('connect', onReconnect);

    return () => {
      socket.off('hachiMessage', onMessage);
      socket.off('hachiMemberCount', onCount);
      socket.off('hachiReactionUpdate', onReaction);
      socket.off('hachiMessageReaction', onMsgReaction);
      socket.off('hachiKicked', onKicked);
      socket.off('hachiMessagesRemoved', onMessagesRemoved);
      socket.off('hachiPinUpdate', onPinUpdate);
      socket.off('hachiMessageDeleted', onMsgDeleted);
      socket.off('connect', onReconnect);
    };
  }, [roomId]);

  useEffect(() => {
    return () => {
      leaveHachiRoom(roomId);
      dispatch(clearActiveRoom());
    };
  }, [roomId]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => {
      setKeyboardVisible(true);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 150);
    });
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (activeRoom?.messages?.length) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 300);
    }
  }, [activeRoom?.messages?.length]);

  const handleShare = async () => {
    const url = `https://kuwai.app/circle/${roomId}`;
    try {
      await Share.share(Platform.OS === 'ios' ? { url } : { message: url });
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (!activeRoom) return;
    navigation.setOptions({
      title: activeRoom.title,
      headerRight: () => (
        <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-redo-outline" size={22} color={COLORS.accent} />
        </TouchableOpacity>
      ),
      headerLeft: undefined,
    });
  }, [activeRoom]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Optimistic update — show message immediately without waiting for server broadcast
    dispatch(addOptimisticMessage({
      roomId,
      message: {
        _id: `optimistic_${Date.now()}`,
        text: trimmed,
        createdAt: new Date().toISOString(),
        reactions: [],
        user: {
          _id: currentUser?._id,
          name: currentUser?.name,
          username: currentUser?.username,
          profilePic: currentUser?.profilePic,
        },
      },
    }));

    sendHachiMessage(roomId, trimmed);
    setText('');
  }, [text, roomId, currentUser, dispatch]);

  const handleReact = useCallback((messageId, emoji) => {
    sendHachiMessageReaction(roomId, messageId?.toString(), emoji);
  }, [roomId]);

  const handleLongPress = useCallback((message) => {
    setSelectedMsg(message);
  }, []);

  const handleUserPress = useCallback((user) => {
    if (!user?.username) return;
    navigation.navigate('ProfileDetail', { username: user.username });
  }, [navigation]);

  const handleDeleteOwnMessage = useCallback((message) => {
    setSelectedMsg(null);
    const socket = getSocket();
    if (socket) socket.emit('hachiDeleteMessage', { roomId, messageId: message._id?.toString() });
  }, [roomId]);

  const handlePickMedia = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.8,
        allowsEditing: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setUploading(true);

      const formData = new FormData();
      const isVideo = asset.type === 'video';
      const ext = asset.uri.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');

      // Use asset.mimeType if available (expo-image-picker provides it).
      // Fallback: map common extensions to correct MIME types so the server's
      // fileFilter doesn't reject HEIC images or QuickTime .MOV videos.
      let mimeType = asset.mimeType;
      if (!mimeType) {
        if (isVideo) {
          mimeType = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
        } else {
          mimeType = (ext === 'heic' || ext === 'heif') ? 'image/jpeg' : `image/${ext}`;
        }
      }
      // iOS QuickTime videos come through as video/quicktime regardless of extension
      if (isVideo && mimeType === 'video/mov') mimeType = 'video/quicktime';

      formData.append(isVideo ? 'video' : 'images', {
        uri: asset.uri,
        name: `circle_media_${Date.now()}.${isVideo ? (ext === 'mov' ? 'mov' : 'mp4') : 'jpg'}`,
        type: mimeType,
      });

      if (isVideo) {
        const res = await uploadAPI.video(formData);
        sendHachiVideo(roomId, res.url, res.thumbnail);
      } else {
        const res = await uploadAPI.images(formData);
        const url = res.urls?.[0] || res.url;
        sendHachiImage(roomId, url);
      }
    } catch (e) {
      Alert.alert(t('common.error'), e.message || t('common.somethingWrong'));
    } finally {
      setUploading(false);
    }
  }, [roomId, t]);

  const handleKick = useCallback((userId, userName) => {
    setSelectedMsg(null);
    Alert.alert(
      t('hachi.kickTitle'),
      t('hachi.kickMsg', { name: userName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('hachi.kickOnly'),
          onPress: () => sendHachiKick(roomId, userId, false),
        },
        {
          text: t('hachi.kickAndDelete'),
          style: 'destructive',
          onPress: () => sendHachiKick(roomId, userId, true),
        },
      ]
    );
  }, [roomId]);

  const handlePin = useCallback((message) => {
    setSelectedMsg(null);
    sendHachiPin(roomId, message._id);
  }, [roomId]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (roomLoading && !activeRoom) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  // ── Blocked / not found ────────────────────────────────────────────────────
  if (!roomLoading && !activeRoom) {
    return (
      <View style={styles.center}>
        <View style={styles.summaryCard}>
          <Ionicons name="ban-outline" size={32} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
          <Text style={styles.summaryTitle}>{t('hachi.noAccess')}</Text>
          <Text style={styles.waitingSubtitle}>{t('hachi.noAccessMsg')}</Text>
          <TouchableOpacity
            style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.fill, borderRadius: 20 }}
            onPress={() => navigation.goBack()}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text }}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const messages = activeRoom?.messages || [];
  const selectedMsgUserId = (selectedMsg?.user?._id || selectedMsg?.user)?.toString();
  const myId = currentUser?._id?.toString();
  const selectedMsgIsMine = selectedMsg && selectedMsgUserId === myId;
  const selectedMsgIsOther = selectedMsg && selectedMsgUserId !== myId;

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
      >
        {/* Circle identity bar */}
        {activeRoom && (
          <View style={styles.infoBar}>
            <View style={styles.infoCatPill}>
              <Ionicons
                name={{
                  general: 'chatbubbles-outline', food: 'restaurant-outline', coffee: 'cafe-outline',
                  cars: 'car-outline', girls: 'sparkles-outline', sports: 'trophy-outline',
                  tech: 'hardware-chip-outline', finance: 'trending-up-outline', travel: 'airplane-outline',
                  entertainment: 'film-outline', gaming: 'game-controller-outline', realestate: 'home-outline',
                }[activeRoom.category] || 'chatbubbles-outline'}
                size={13}
                color={COLORS.accent}
              />
              <Text style={styles.infoCatLabel}>{activeRoom.category || 'general'}</Text>
            </View>
            <View style={styles.infoSep} />
            <Ionicons name="person" size={12} color={COLORS.accent} />
            <Text style={styles.infoMemberCount}>{activeRoom.memberCount || 1} {t('hachi.inChat')}</Text>
            {!activeRoom.isPublic && (
              <>
                <View style={styles.infoSep} />
                <Ionicons name="lock-closed" size={12} color={COLORS.textMuted} />
              </>
            )}
          </View>
        )}

        {/* Pinned messages banner */}
        {pinnedMessages.length > 0 && (
          <View style={styles.pinnedBanner}>
            <View style={styles.pinnedHeader}>
              <Ionicons name="pin" size={12} color={COLORS.accent} />
              <Text style={styles.pinnedLabel}>{t('hachi.pinned')}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pinnedScroll}
            >
              {pinnedMessages.map((msg) => (
                <View key={msg._id?.toString()} style={styles.pinnedBubble}>
                  <Text style={styles.pinnedAuthor} numberOfLines={1}>{msg.user?.name || ''}</Text>
                  <Text style={styles.pinnedText} numberOfLines={2}>{msg.text}</Text>
                  {isCreator && (
                    <TouchableOpacity
                      style={styles.pinnedUnpin}
                      onPress={() => sendHachiPin(roomId, msg._id)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close-circle" size={15} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(item) => item._id?.toString() || Math.random().toString()}
          renderItem={({ item }) => (
            <MessageRow
              message={item}
              isMine={(item.user?._id || item.user)?.toString() === currentUser?._id?.toString()}
              currentUserId={currentUser?._id}
              onLongPress={handleLongPress}
              onReact={handleReact}
              onUserPress={handleUserPress}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Text style={styles.emptyEmoji}>✍️</Text>
              <Text style={styles.emptyTitle}>{t('hachi.beFirst')}</Text>
            </View>
          }
          contentContainerStyle={{ padding: 12, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        />

        {/* Input bar / view-only notice */}
        {isViewOnly ? (
          <View style={[styles.viewOnlyBar, { paddingBottom: keyboardVisible ? 8 : insets.bottom + 8 }]}>
            <Ionicons name="eye-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.viewOnlyText}>{t('hachi.removedReadOnly')}</Text>
          </View>
        ) : (
          <View style={[styles.inputBar, { paddingBottom: keyboardVisible ? 16 : insets.bottom + 10 }]}>
            <TouchableOpacity
              onPress={handlePickMedia}
              disabled={uploading}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.mediaBtn}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
              ) : (
                <Ionicons name="image-outline" size={24} color={COLORS.accent} />
              )}
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder={t('hachi.messagePlaceholder')}
              placeholderTextColor={COLORS.textMuted}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={500}
              returnKeyType="send"
              blurOnSubmit={false}
            />
            {text.trim().length > 0 && (
              <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
                <Ionicons name="arrow-up" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Message action sheet (emoji + kick) */}
      <Modal
        visible={!!selectedMsg}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMsg(null)}
      >
        <TouchableOpacity
          style={styles.actionOverlay}
          activeOpacity={1}
          onPress={() => setSelectedMsg(null)}
        >
          <View style={styles.actionSheet}>
            {/* Emoji quick-react row */}
            <View style={styles.emojiRow}>
              {QUICK_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiBtn}
                  onPress={() => {
                    handleReact(selectedMsg._id, emoji);
                    setSelectedMsg(null);
                  }}
                >
                  <Text style={styles.emojiPickerEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Message actions */}
            <View style={styles.modActions}>
              {/* Delete own message */}
              {selectedMsgIsMine && (
                <TouchableOpacity
                  style={styles.modRow}
                  onPress={() => handleDeleteOwnMessage(selectedMsg)}
                >
                  <Ionicons name="trash-outline" size={17} color="#FF3B30" />
                  <Text style={styles.kickText}>{t('common.delete')}</Text>
                </TouchableOpacity>
              )}

              {/* Creator: Pin / Unpin */}
              {isCreator && selectedMsg?.text && (() => {
                const isPinned = activeRoom?.pinnedMessages?.some(
                  (p) => p?.toString() === selectedMsg._id?.toString()
                );
                return (
                  <TouchableOpacity
                    style={styles.modRow}
                    onPress={() => handlePin(selectedMsg)}
                  >
                    <Ionicons name="pin-outline" size={17} color={COLORS.accent} />
                    <Text style={[styles.modText, { color: COLORS.accent }]}>
                      {isPinned ? t('hachi.unpinMessage') : t('hachi.pinMessage')}
                    </Text>
                  </TouchableOpacity>
                );
              })()}

              {/* Creator: Kick (other users only) */}
              {isCreator && selectedMsgIsOther && (
                <TouchableOpacity
                  style={styles.modRow}
                  onPress={() => handleKick(
                    selectedMsg.user?._id || selectedMsg.user,
                    selectedMsg.user?.name || t('hachi.someoneDefault')
                  )}
                >
                  <Ionicons name="person-remove-outline" size={17} color="#FF3B30" />
                  <Text style={styles.kickText}>{t('hachi.kickTitle')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

    </>
  );
}

const makeStyles = (C, isRTL) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.white },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  // Summary / closed
  summaryCard: {
    width: '100%',
    backgroundColor: C.fill,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  summaryTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 8 },
  waitingSubtitle: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
  summaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    width: '100%',
    justifyContent: 'center',
    gap: 32,
  },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: 28, fontWeight: '700', color: C.accent },
  statLabel: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: C.separator },
  summaryExcerpt: {
    fontSize: 14, color: C.textMuted, fontStyle: 'italic',
    textAlign: 'center', lineHeight: 20, marginTop: 4,
  },

  // Archive banner (top of read-only history)
  archiveBanner: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  archiveBannerIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.fill,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  archiveBannerTitle: { fontSize: 16, fontWeight: '700', color: C.textMuted, marginBottom: 8 },
  archiveStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  archiveStatItem: { fontSize: 13, color: C.textMuted },
  archiveStatNum: { fontWeight: '700', color: C.text },
  archiveSep: { fontSize: 13, color: C.textMuted },
  archiveReadOnly: {
    fontSize: 12,
    color: C.textMuted,
    backgroundColor: C.fill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },

  // Circle identity bar
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
    backgroundColor: C.accent + '06',
  },
  infoCatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.accent + '12',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  infoCatLabel: {
    fontSize: 11, fontWeight: '700', color: C.accent,
    textTransform: 'uppercase', letterSpacing: 0.3,
  },
  infoSep: {
    width: 1, height: 12,
    backgroundColor: C.separator,
  },
  infoMemberCount: { fontSize: 13, fontWeight: '700', color: C.accent },

  // Join request badge
  joinReqBadge: {
    marginStart: 'auto',
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  joinReqText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Messages
  emptyMessages: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 },
  emptyEmoji: { fontSize: 40, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.textMuted },

  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 3,
    paddingHorizontal: 4,
    gap: 7,
  },
  msgRowMine: { flexDirection: 'row-reverse' },
  msgCol: { maxWidth: '80%', alignItems: 'flex-start' },
  msgColMine: { alignItems: 'flex-end' },
  msgAvatar: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  msgAvatarText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  msgBubble: {
    backgroundColor: C.fill,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 6,
  },
  msgBubbleMine: {
    backgroundColor: C.accent,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  msgBubbleMedia: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 6,
    overflow: 'hidden',
  },
  msgAuthor: { fontSize: 12, fontWeight: '700', color: C.accent, marginBottom: 2 },
  msgImage: { width: 240, height: 180, borderRadius: 14, marginBottom: 2 },
  playOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 2,
    justifyContent: 'center', alignItems: 'center',
    borderRadius: 14,
  },
  playBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', paddingLeft: 3,
  },
  msgText: { fontSize: 16, color: C.text, lineHeight: 22, writingDirection: 'auto' },
  msgTextMine: { color: '#fff' },
  msgTime: {
    fontSize: 10, color: C.textMuted + 'AA', marginTop: 3,
    alignSelf: 'flex-end',
  },
  msgTimeMine: { color: 'rgba(255,255,255,0.55)' },

  // Reaction pills
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 3,
    marginHorizontal: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: C.fill,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pillActive: {
    backgroundColor: C.accent + '12',
    borderColor: C.accent + '30',
  },
  pillEmoji: { fontSize: 13 },
  pillCount: { fontSize: 11, fontWeight: '700', color: C.textMuted },
  pillCountActive: { color: C.accent },

  // Input
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.separator,
    backgroundColor: C.white,
    gap: 6,
  },
  mediaBtn: {
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    marginBottom: 2,
  },
  input: {
    flex: 1,
    backgroundColor: C.fill,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 9,
    fontSize: 16,
    color: C.text,
    maxHeight: 100,
    textAlign: isRTL ? 'right' : 'left',
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.accent,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    marginBottom: 2,
  },
  viewOnlyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.separator,
    backgroundColor: C.fill,
  },
  viewOnlyText: { fontSize: 13, color: C.textMuted },

  // Message action sheet (emoji picker + kick)
  actionOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  emojiBtn: {
    width: 50, height: 50,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: C.fill,
    borderRadius: 25,
  },
  emojiPickerEmoji: { fontSize: 26 },
  modActions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.separator,
    marginTop: 6,
    paddingTop: 6,
    gap: 0,
  },
  modRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  modText: { fontSize: 15, fontWeight: '600' },
  kickText: { fontSize: 15, fontWeight: '600', color: '#FF3B30' },

  // Pinned messages banner
  pinnedBanner: {
    backgroundColor: C.accent + '0A',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.accent + '25',
    paddingTop: 8,
    paddingBottom: 10,
  },
  pinnedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  pinnedLabel: { fontSize: 11, fontWeight: '800', color: C.accent, letterSpacing: 0.5, textTransform: 'uppercase' },
  pinnedScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  pinnedBubble: {
    width: 180,
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.accent + '22',
    paddingHorizontal: 10,
    paddingVertical: 8,
    paddingEnd: 28,
    position: 'relative',
  },
  pinnedAuthor: { fontSize: 11, fontWeight: '700', color: C.accent, marginBottom: 3 },
  pinnedText: { fontSize: 13, color: C.text, lineHeight: 18 },
  pinnedUnpin: {
    position: 'absolute',
    top: 6,
    end: 6,
  },

  // Join requests modal
  reqModal: {
    flex: 1,
    backgroundColor: C.white,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  reqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  reqTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  reqEmpty: { fontSize: 15, color: C.textMuted, textAlign: 'center', marginTop: 60 },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  reqAvatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  reqAvatarText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  reqInfo: { flex: 1 },
  reqName: { fontSize: 15, fontWeight: '600', color: C.text },
  reqUsername: { fontSize: 13, color: C.textMuted },
  reqApprove: {
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  reqApproveText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  reqReject: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.fill,
    justifyContent: 'center', alignItems: 'center',
  },
});
