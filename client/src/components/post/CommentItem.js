import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { getDateLocale } from '../../i18n';
import { useTheme } from '../../context/ThemeContext';
import LinkedText from '../ui/LinkedText';

const PALETTE = ['#0033A0', '#007A3D', '#FF6B35', '#2196F3', '#9C27B0', '#00BCD4', '#FF9800'];
function avatarBg(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function ReplyRow({ comment, onLike, onDelete, onReport, navigation, currentUserId }) {
  const { colors: COLORS } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const author = comment.userId;
  const isOwn = author?._id === currentUserId || author === currentUserId;
  const timeAgo = comment.createdAt
    ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: false, locale: getDateLocale() })
    : '';

  const showMenu = () => {
    if (isOwn) {
      Alert.alert('', t('comment.deleteComment'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => onDelete(comment._id) },
      ]);
    } else {
      Alert.alert('', t('comment.reportComment'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.report'), style: 'destructive', onPress: () => onReport(comment._id) },
      ]);
    }
  };

  return (
    <View style={styles.replyRow}>
      <TouchableOpacity
        onPress={() => author?.username && navigation.navigate('ProfileDetail', { username: author.username })}
        activeOpacity={0.7}
      >
        {author?.profilePic ? (
          <Image source={{ uri: author.profilePic }} style={styles.replyAvatar} />
        ) : (
          <View style={[styles.replyAvatar, { backgroundColor: avatarBg(author?.name) }]}>
            <Text style={styles.replyAvatarInitial}>{author?.name?.[0]?.toUpperCase() || '?'}</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.replyBody}>
        <Text style={styles.replyAuthorLine}>
          <Text style={styles.replyAuthorName}>{author?.name}</Text>
          <Text style={styles.replyMeta}>{'  '}{timeAgo}</Text>
        </Text>
        <LinkedText style={styles.replyContent} linkColor={COLORS.accent}>{comment.content}</LinkedText>
        <View style={styles.replyActions}>
          <TouchableOpacity
            style={styles.replyLikeBtn}
            onPress={() => onLike(comment._id)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons
              name={comment.isLiked ? 'heart' : 'heart-outline'}
              size={13}
              color={comment.isLiked ? COLORS.accent : COLORS.textMuted}
            />
            {comment.likesCount > 0 && (
              <Text style={[styles.replyLikeCount, comment.isLiked && { color: COLORS.accent }]}>
                {comment.likesCount}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={showMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="ellipsis-horizontal" size={14} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function CommentItem({ comment, onLike, onReply, onLoadReplies, onDelete, onReport, navigation, currentUserId }) {
  const { t } = useTranslation();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const author = comment.userId;
  const isOwn = author?._id === currentUserId || author === currentUserId;
  const timeAgo = comment.createdAt
    ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: false, locale: getDateLocale() })
    : '';

  const toProfile = () => {
    if (author?.username) navigation.navigate('ProfileDetail', { username: author.username });
  };

  const showMenu = () => {
    if (isOwn) {
      Alert.alert('', t('comment.deleteComment'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => onDelete(comment._id) },
      ]);
    } else {
      Alert.alert('', t('comment.reportComment'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.report'), style: 'destructive', onPress: () => onReport(comment._id) },
      ]);
    }
  };

  const hasReplies = (comment.repliesCount || 0) > 0;
  const repliesLoaded = Array.isArray(comment.replies);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toProfile} activeOpacity={0.7} style={styles.avatarWrap}>
        {author?.profilePic ? (
          <Image source={{ uri: author.profilePic }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: avatarBg(author?.name) }]}>
            <Text style={styles.avatarInitial}>{author?.name?.[0]?.toUpperCase() || '?'}</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.body}>
        <TouchableOpacity onPress={toProfile} activeOpacity={0.7}>
          <Text style={styles.authorLine}>
            <Text style={styles.authorName}>{author?.name}</Text>
            <Text style={styles.authorMeta}>{'  '}{timeAgo}</Text>
          </Text>
        </TouchableOpacity>

        <LinkedText style={styles.content} linkColor={COLORS.accent}>{comment.content}</LinkedText>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onLike(comment._id)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons
              name={comment.isLiked ? 'heart' : 'heart-outline'}
              size={15}
              color={comment.isLiked ? COLORS.accent : COLORS.textMuted}
            />
            {comment.likesCount > 0 && (
              <Text style={[styles.actionCount, comment.isLiked && { color: COLORS.accent }]}>
                {comment.likesCount}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onReply(comment)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.replyText}>{t('comment.reply')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={showMenu}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Replies section */}
        {hasReplies && !repliesLoaded && (
          <TouchableOpacity
            style={styles.viewRepliesBtn}
            onPress={() => onLoadReplies(comment._id)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <View style={styles.viewRepliesLine} />
            <Text style={styles.viewRepliesText}>
              {t('comment.viewReplies', { count: comment.repliesCount })}
            </Text>
          </TouchableOpacity>
        )}

        {repliesLoaded && (
          <View style={styles.repliesWrap}>
            {comment.repliesLoading ? (
              <ActivityIndicator size="small" color={COLORS.accent} style={{ marginTop: 8 }} />
            ) : (
              comment.replies.map((r) => (
                <ReplyRow
                  key={r._id}
                  comment={r}
                  onLike={onLike}
                  onDelete={onDelete}
                  onReport={onReport}
                  navigation={navigation}
                  currentUserId={currentUserId}
                />
              ))
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
    gap: 12,
  },
  avatarWrap: { width: 40, flexShrink: 0 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 16, fontWeight: '700', color: '#fff' },
  body: { flex: 1, paddingBottom: 10 },
  authorLine: { lineHeight: 21, marginBottom: 3 },
  authorName: { fontSize: 15, fontWeight: '600', color: C.text },
  authorMeta: { fontSize: 14, fontWeight: '400', color: C.textMuted },
  content: { fontSize: 15, color: C.text, lineHeight: 22, marginBottom: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionCount: { fontSize: 13, color: C.textMuted },
  replyText: { fontSize: 13, fontWeight: '500', color: C.textMuted },

  viewRepliesBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  viewRepliesLine: { width: 24, height: 1, backgroundColor: C.separator },
  viewRepliesText: { fontSize: 13, fontWeight: '600', color: C.textMuted },

  repliesWrap: { marginTop: 10, gap: 12 },

  // Reply rows (nested)
  replyRow: { flexDirection: 'row', gap: 10 },
  replyAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  replyAvatarInitial: { fontSize: 12, fontWeight: '700', color: '#fff' },
  replyBody: { flex: 1 },
  replyAuthorLine: { lineHeight: 19, marginBottom: 2 },
  replyAuthorName: { fontSize: 13, fontWeight: '600', color: C.text },
  replyMeta: { fontSize: 12, color: C.textMuted },
  replyContent: { fontSize: 14, color: C.text, lineHeight: 20, marginBottom: 4 },
  replyActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  replyLikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  replyLikeCount: { fontSize: 12, color: C.textMuted },
});
