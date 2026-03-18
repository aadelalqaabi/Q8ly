import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
  Image, Modal, Alert, Keyboard, Share,
} from 'react-native';
import BottomMenu from '../../components/ui/BottomMenu';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import {
  fetchRoom, closeRoom,
  addMessageRealtime, updateMemberCount, updateReactions,
  updateMessageReaction, addJoinRequest, removeJoinRequest,
  setWaitingApproval, removeRoomRealtime, clearActiveRoom,
  removeUserMessages, updatePinnedMessages,
} from '../../store/slices/hachiSlice';
import {
  getSocket, joinHachiRoom, leaveHachiRoom, sendHachiMessage,
  sendHachiMessageReaction, sendHachiKick, sendHachiPin, approveHachiJoin, rejectHachiJoin,
} from '../../services/socket';
import { getDateLocale } from '../../i18n';
import { hachiAPI } from '../../services/api';
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
function MessageRow({ message, isMine, onLongPress, currentUserId, onReact }) {
  const { t } = useTranslation();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { user, text, reactions, createdAt } = message;
  const timeAgo = createdAt
    ? formatDistanceToNow(new Date(createdAt), { addSuffix: true, locale: getDateLocale() })
    : '';

  return (
    <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
      {!isMine && (
        user?.profilePic ? (
          <Image source={{ uri: user.profilePic }} style={styles.msgAvatar} />
        ) : (
          <View style={[styles.msgAvatar, { backgroundColor: avatarBg(user?.name) }]}>
            <Text style={styles.msgAvatarText}>{user?.name?.[0]?.toUpperCase() || '?'}</Text>
          </View>
        )
      )}
      <View style={[styles.msgCol, isMine && styles.msgColMine]}>
        <TouchableOpacity
          onLongPress={() => onLongPress(message)}
          delayLongPress={350}
          activeOpacity={0.85}
        >
          <View style={[styles.msgBubble, isMine && styles.msgBubbleMine]}>
            {!isMine && (
              <Text style={styles.msgAuthor}>{user?.name || t('hachi.someoneDefault')}</Text>
            )}
            <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{text}</Text>
            <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>{timeAgo}</Text>
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
  const { activeRoom, roomLoading, joinRequests, waitingApproval } = useSelector((s) => s.hachi);
  const { user: currentUser } = useSelector((s) => s.auth);
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS, isRTL), [COLORS, isRTL]);
  const flatRef = useRef(null);
  const [text, setText] = useState('');
  const [endMenuVisible, setEndMenuVisible] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState(null); // message long-pressed
  const [showRequests, setShowRequests] = useState(false); // join requests modal
  const [isViewOnly, setIsViewOnly] = useState(false); // removed/blocked — can view but not send
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const isCreator = activeRoom?.creator?._id === currentUser?._id
    || activeRoom?.creator === currentUser?._id;

  const minsLeft = activeRoom?.expiresAt
    ? differenceInMinutes(new Date(activeRoom.expiresAt), new Date())
    : null;

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
    const onClosed = (data) => {
      if (data.roomId === roomId) dispatch(removeRoomRealtime({ roomId }));
    };
    const onReaction = (data) => {
      if (data.roomId === roomId) dispatch(updateReactions(data));
    };
    const onMsgReaction = (data) => {
      if (data.roomId === roomId) dispatch(updateMessageReaction(data));
    };
    const onKicked = (data) => {
      if (data.roomId === roomId) {
        setIsViewOnly(true);
      }
    };
    const onMessagesRemoved = (data) => {
      if (data.roomId === roomId) {
        dispatch(removeUserMessages({ userId: data.userId, pinnedMessages: data.pinnedMessages }));
      }
    };
    const onPinUpdate = (data) => {
      if (data.roomId === roomId) dispatch(updatePinnedMessages(data));
    };
    const onJoinRequest = (data) => {
      if (data.roomId === roomId) dispatch(addJoinRequest(data));
    };
    const onJoinApproved = (data) => {
      if (data.roomId === roomId) {
        dispatch(setWaitingApproval(false));
        dispatch(fetchRoom(roomId));
        joinHachiRoom(roomId);
      }
    };
    const onJoinRejected = (data) => {
      if (data.roomId === roomId) {
        Alert.alert('', t('hachi.joinRejected'), [
          { text: t('common.ok'), onPress: () => navigation.goBack() },
        ]);
      }
    };
    const onWaiting = (data) => {
      if (data.roomId === roomId) dispatch(setWaitingApproval(true));
    };
    const onError = (data) => {
      // If this is a block/removal error, switch to view-only mode instead of navigating away
      if (data.message?.includes('إزالتك') || data.message?.includes('إزالة')) {
        setIsViewOnly(true);
      } else {
        Alert.alert('', data.message || t('common.error'));
      }
    };

    socket.on('hachiMessage', onMessage);
    socket.on('hachiMemberCount', onCount);
    socket.on('hachiRoomClosed', onClosed);
    socket.on('hachiReactionUpdate', onReaction);
    socket.on('hachiMessageReaction', onMsgReaction);
    socket.on('hachiKicked', onKicked);
    socket.on('hachiMessagesRemoved', onMessagesRemoved);
    socket.on('hachiPinUpdate', onPinUpdate);
    socket.on('hachiJoinRequest', onJoinRequest);
    socket.on('hachiJoinApproved', onJoinApproved);
    socket.on('hachiJoinRejected', onJoinRejected);
    socket.on('hachiWaitingApproval', onWaiting);
    socket.on('hachiError', onError);

    return () => {
      socket.off('hachiMessage', onMessage);
      socket.off('hachiMemberCount', onCount);
      socket.off('hachiRoomClosed', onClosed);
      socket.off('hachiReactionUpdate', onReaction);
      socket.off('hachiMessageReaction', onMsgReaction);
      socket.off('hachiKicked', onKicked);
      socket.off('hachiMessagesRemoved', onMessagesRemoved);
      socket.off('hachiPinUpdate', onPinUpdate);
      socket.off('hachiJoinRequest', onJoinRequest);
      socket.off('hachiJoinApproved', onJoinApproved);
      socket.off('hachiJoinRejected', onJoinRejected);
      socket.off('hachiWaitingApproval', onWaiting);
      socket.off('hachiError', onError);
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

  const handleLeave = useCallback(() => {
    Alert.alert(
      t('profile.leaveCircle'),
      t('profile.leaveCircleMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.leaveCircle'),
          style: 'destructive',
          onPress: async () => {
            try {
              await hachiAPI.leaveRoom(roomId);
              navigation.goBack();
            } catch (e) {
              Alert.alert(t('common.error'), e.message || t('common.somethingWrong'));
            }
          },
        },
      ]
    );
  }, [roomId, navigation, t]);

  useEffect(() => {
    if (!activeRoom) return;
    navigation.setOptions({
      title: activeRoom.title,
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {!isCreator && activeRoom.isActive && (
            <TouchableOpacity onPress={handleLeave} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginEnd: 4 }}>
              <Text style={{ fontSize: 15, color: COLORS.error }}>{t('profile.leaveCircle')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-redo-outline" size={22} color={COLORS.accent} />
          </TouchableOpacity>
        </View>
      ),
      headerLeft: isCreator && activeRoom.isActive ? () => (
        <TouchableOpacity onPress={() => setEndMenuVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginStart: 4 }}>
          <Text style={{ fontSize: 15, color: COLORS.error }}>{t('hachi.endHachi')}</Text>
        </TouchableOpacity>
      ) : undefined,
    });
  }, [activeRoom, isCreator, handleLeave]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendHachiMessage(roomId, trimmed);
    setText('');
  }, [text, roomId]);

  const handleReact = useCallback((messageId, emoji) => {
    sendHachiMessageReaction(roomId, messageId?.toString(), emoji);
  }, [roomId]);

  const handleLongPress = useCallback((message) => {
    setSelectedMsg(message);
  }, []);

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

  const endMenuOptions = [
    {
      label: t('hachi.endHachi'),
      destructive: true,
      onPress: async () => {
        await dispatch(closeRoom(roomId));
        navigation.goBack();
      },
    },
  ];

  // ── Loading ────────────────────────────────────────────────────────────────
  if (roomLoading && !activeRoom) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  // ── Blocked / not found ────────────────────────────────────────────────────
  if (!roomLoading && !activeRoom && !waitingApproval) {
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

  // ── Waiting for approval ────────────────────────────────────────────────────
  if (waitingApproval) {
    return (
      <View style={styles.center}>
        <View style={styles.summaryCard}>
          <ActivityIndicator size="large" color={COLORS.accent} style={{ marginBottom: 16 }} />
          <Text style={styles.summaryTitle}>{t('hachi.waitingApproval')}</Text>
          <Text style={styles.waitingSubtitle}>{t('hachi.waitingApprovalMsg')}</Text>
        </View>
      </View>
    );
  }

  // ── Closed room: summary banner + read-only message history ────────────────
  if (activeRoom && !activeRoom.isActive) {
    const s = activeRoom.summary;
    const archivedMessages = activeRoom?.messages || [];
    return (
      <FlatList
        data={archivedMessages}
        keyExtractor={(item) => item._id?.toString() || Math.random().toString()}
        renderItem={({ item }) => (
          <MessageRow
            message={item}
            isMine={item.user?._id === currentUser?._id || item.user === currentUser?._id}
            currentUserId={currentUser?._id}
            onLongPress={() => {}}
            onReact={() => {}}
          />
        )}
        ListHeaderComponent={() => (
          <View style={styles.archiveBanner}>
            <View style={styles.archiveBannerIcon}>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.textMuted} />
            </View>
            <Text style={styles.archiveBannerTitle}>{t('hachi.ended')}</Text>
            {s && (s.messageCount > 0 || s.participantCount > 0) ? (
              <View style={styles.archiveStats}>
                <Text style={styles.archiveStatItem}>
                  <Text style={styles.archiveStatNum}>{s.messageCount}</Text>
                  {'  '}{t('hachi.summaryMessages')}
                </Text>
                <Text style={styles.archiveSep}>·</Text>
                <Text style={styles.archiveStatItem}>
                  <Text style={styles.archiveStatNum}>{s.participantCount}</Text>
                  {'  '}{t('hachi.summaryPeople')}
                </Text>
              </View>
            ) : null}
            {archivedMessages.length > 0 && (
              <Text style={styles.archiveReadOnly}>{t('hachi.readOnly')}</Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyMessages}>
            <Text style={styles.emptyText}>{t('hachi.noMessages')}</Text>
          </View>
        }
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  const messages = activeRoom?.messages || [];
  const selectedMsgIsOther = selectedMsg && selectedMsg.user?._id !== currentUser?._id && selectedMsg.user !== currentUser?._id;

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
      >
        {/* Room info bar */}
        {activeRoom && (
          <View style={styles.infoBar}>
            <Ionicons name="person-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.infoText}>{activeRoom.memberCount || 1} {t('hachi.inChat')}</Text>
            {!activeRoom.isPublic && (
              <>
                <Text style={styles.infoDot}>·</Text>
                <Ionicons name="lock-closed" size={12} color={COLORS.textMuted} />
                <Text style={styles.infoText}>{t('hachi.private')}</Text>
              </>
            )}
            {minsLeft !== null && minsLeft > 0 && (
              <>
                <Text style={styles.infoDot}>·</Text>
                <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
                <Text style={styles.infoText}>
                  {minsLeft < 60
                    ? t('hachi.minutesLeft', { n: minsLeft })
                    : t('hachi.hoursLeft', { n: Math.floor(minsLeft / 60) })}
                </Text>
              </>
            )}

            {/* Join requests badge (creator only) */}
            {isCreator && joinRequests.length > 0 && (
              <TouchableOpacity style={styles.joinReqBadge} onPress={() => setShowRequests(true)}>
                <Text style={styles.joinReqText}>{t('hachi.joinReqCount', { count: joinRequests.length })}</Text>
              </TouchableOpacity>
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
              isMine={item.user?._id === currentUser?._id || item.user === currentUser?._id}
              currentUserId={currentUser?._id}
              onLongPress={handleLongPress}
              onReact={handleReact}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Text style={styles.emptyText}>{t('hachi.beFirst')}</Text>
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

      {/* End Hachi confirm */}
      <BottomMenu
        visible={endMenuVisible}
        onClose={() => setEndMenuVisible(false)}
        title={t('hachi.endMsg')}
        options={endMenuOptions}
      />

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

            {/* Creator-only actions */}
            {isCreator && (
              <View style={styles.modActions}>
                {/* Pin / Unpin */}
                {selectedMsg?.text && (() => {
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

                {/* Kick (other users only) */}
                {selectedMsgIsOther && (
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
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Join requests modal (creator) */}
      <Modal
        visible={showRequests}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRequests(false)}
      >
        <View style={styles.reqModal}>
          <View style={styles.reqHeader}>
            <Text style={styles.reqTitle}>{t('hachi.joinReqTitle')}</Text>
            <TouchableOpacity onPress={() => setShowRequests(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          {joinRequests.length === 0 ? (
            <Text style={styles.reqEmpty}>{t('hachi.noJoinRequests')}</Text>
          ) : (
            joinRequests.map((req) => (
              <View key={req.user._id} style={styles.reqRow}>
                <View style={[styles.reqAvatar, { backgroundColor: avatarBg(req.user.name) }]}>
                  <Text style={styles.reqAvatarText}>{req.user.name?.[0]?.toUpperCase() || '?'}</Text>
                </View>
                <View style={styles.reqInfo}>
                  <Text style={styles.reqName}>{req.user.name}</Text>
                  <Text style={styles.reqUsername}>@{req.user.username}</Text>
                </View>
                <TouchableOpacity
                  style={styles.reqApprove}
                  onPress={() => {
                    approveHachiJoin(roomId, req.user._id);
                    dispatch(removeJoinRequest({ userId: req.user._id }));
                  }}
                >
                  <Text style={styles.reqApproveText}>{t('dm.accept')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.reqReject}
                  onPress={() => {
                    rejectHachiJoin(roomId, req.user._id);
                    dispatch(removeJoinRequest({ userId: req.user._id }));
                  }}
                >
                  <Ionicons name="close" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
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

  // Info bar
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
    backgroundColor: C.fill,
  },
  infoText: { fontSize: 13, color: C.textMuted },
  infoDot: { fontSize: 13, color: C.textMuted, marginHorizontal: 2 },

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
  emptyMessages: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: C.textMuted },

  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
    gap: 8,
  },
  msgRowMine: { flexDirection: 'row-reverse' },
  msgCol: { maxWidth: '78%', alignItems: 'flex-start' },
  msgColMine: { alignItems: 'flex-end' },
  msgAvatar: {
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  msgAvatarText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  msgBubble: {
    backgroundColor: C.fill,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  msgBubbleMine: {
    backgroundColor: C.accent,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  msgAuthor: { fontSize: 12, fontWeight: '600', color: C.textMuted, marginBottom: 2 },
  msgText: { fontSize: 15, color: C.text, lineHeight: 20, writingDirection: 'auto' },
  msgTextMine: { color: '#fff' },
  msgTime: { fontSize: 11, color: C.textMuted, marginTop: 3 },
  msgTimeMine: { color: 'rgba(255,255,255,0.7)' },

  // Reaction pills
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
    marginHorizontal: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: C.fill,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.separator,
  },
  pillActive: {
    backgroundColor: '#EEF2FA',
    borderColor: C.accent,
  },
  pillEmoji: { fontSize: 13 },
  pillCount: { fontSize: 12, fontWeight: '600', color: C.textMuted },
  pillCountActive: { color: C.accent },

  // Input
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.separator,
    backgroundColor: C.white,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: C.fill,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: C.text,
    maxHeight: 100,
    textAlign: isRTL ? 'right' : 'left',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.accent,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
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
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  emojiBtn: {
    width: 48, height: 48,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: C.fill,
    borderRadius: 24,
  },
  emojiPickerEmoji: { fontSize: 24 },
  modActions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.separator,
    marginTop: 8,
    paddingTop: 8,
    gap: 0,
  },
  modRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  modText: { fontSize: 15, fontWeight: '500' },
  kickText: { fontSize: 15, fontWeight: '500', color: '#FF3B30' },

  // Pinned messages banner
  pinnedBanner: {
    backgroundColor: C.accent + '0D',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.accent + '33',
    paddingTop: 8,
    paddingBottom: 10,
  },
  pinnedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  pinnedLabel: { fontSize: 11, fontWeight: '700', color: C.accent, letterSpacing: 0.3 },
  pinnedScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  pinnedBubble: {
    width: 180,
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.accent + '33',
    paddingHorizontal: 10,
    paddingVertical: 8,
    paddingEnd: 28, // room for unpin button
    position: 'relative',
  },
  pinnedAuthor: { fontSize: 11, fontWeight: '700', color: C.accent, marginBottom: 2 },
  pinnedText: { fontSize: 13, color: C.text, lineHeight: 17 },
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
