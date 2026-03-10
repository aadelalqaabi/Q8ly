import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { getDateLocale } from '../../i18n';
import { useTheme } from '../../context/ThemeContext';

const PALETTE = ['#0033A0', '#007A3D', '#FF6B35', '#2196F3', '#9C27B0', '#00BCD4', '#FF9800'];
function avatarBg(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export default function CommentItem({ comment, onLike, onReply, navigation }) {
  const { t } = useTranslation();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const author = comment.userId;
  const timeAgo = comment.createdAt
    ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: false, locale: getDateLocale() })
    : '';

  const toProfile = () => {
    if (author?.username) navigation.navigate('ProfileDetail', { username: author.username });
  };

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

        <Text style={styles.content}>{comment.content}</Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onLike(comment._id)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons
              name={comment.isLiked ? 'heart' : 'heart-outline'}
              size={13}
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
        </View>
      </View>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
    gap: 10,
  },
  avatarWrap: { width: 34, flexShrink: 0 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 13, fontWeight: '700', color: '#fff' },
  body: { flex: 1 },
  authorLine: { lineHeight: 19, marginBottom: 3 },
  authorName: { fontSize: 14, fontWeight: '600', color: C.text },
  authorMeta: { fontSize: 13, fontWeight: '400', color: C.textMuted },
  content: { fontSize: 14, color: C.text, lineHeight: 20, marginBottom: 6, writingDirection: 'auto' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionCount: { fontSize: 12, color: C.textMuted },
  replyText: { fontSize: 12, fontWeight: '500', color: C.textMuted },
});
