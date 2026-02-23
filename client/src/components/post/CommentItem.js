import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { COLORS, VERIFIED_BADGE_LABELS } from '../../constants';

export default function CommentItem({ comment, onLike, onReply, navigation, depth = 0 }) {
  const author = comment.userId;
  const badge = author?.verifiedBadge && VERIFIED_BADGE_LABELS[author.verifiedBadge];
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });

  return (
    <View style={[styles.container, depth > 0 && styles.indented]}>
      <TouchableOpacity onPress={() => author?.username && navigation.navigate('ProfileDetail', { username: author.username })}>
        {author?.profilePic
          ? <Image source={{ uri: author.profilePic }} style={styles.avatar} />
          : <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{author?.name?.[0] || '?'}</Text>
            </View>
        }
      </TouchableOpacity>

      <View style={styles.body}>
        <View style={styles.bubble}>
          <View style={styles.nameRow}>
            <Text style={styles.authorName}>{author?.name}</Text>
            {badge && <Text style={[styles.badgeIcon, { color: badge.color }]}>{badge.icon}</Text>}
            <Text style={styles.username}>@{author?.username}</Text>
          </View>
          <Text style={styles.content}>{comment.content}</Text>
        </View>

        <View style={styles.actions}>
          <Text style={styles.timeAgo}>{timeAgo}</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onLike(comment._id)}>
            <Ionicons
              name={comment.isLiked ? 'heart' : 'heart-outline'}
              size={14}
              color={comment.isLiked ? COLORS.primary : COLORS.textMuted}
            />
            {comment.likesCount > 0 && (
              <Text style={[styles.actionCount, comment.isLiked && { color: COLORS.primary }]}>
                {comment.likesCount}
              </Text>
            )}
          </TouchableOpacity>
          {depth < 2 && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => onReply(comment)}>
              <Text style={styles.replyBtn}>Reply</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', padding: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  indented: { paddingLeft: 52, backgroundColor: '#FAFAFA' },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  avatarPlaceholder: { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 15, fontWeight: '700', color: '#fff' },
  body: { flex: 1 },
  bubble: { backgroundColor: '#F5F5F5', borderRadius: 12, padding: 10, marginBottom: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  authorName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  badgeIcon: { fontSize: 11 },
  username: { fontSize: 12, color: COLORS.textMuted },
  content: { fontSize: 14, color: COLORS.text, lineHeight: 19 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeAgo: { fontSize: 11, color: COLORS.textMuted },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  actionCount: { fontSize: 12, color: COLORS.textMuted },
  replyBtn: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
});
