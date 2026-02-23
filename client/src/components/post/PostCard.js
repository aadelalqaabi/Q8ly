import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Alert, Share, ActionSheetIOS, Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { toggleLike, deletePost } from '../../store/slices/postsSlice';
import { postsAPI } from '../../services/api';
import { COLORS, VERIFIED_BADGE_LABELS, REPORT_REASONS } from '../../constants';

export default function PostCard({ post, navigation, isDetailView = false }) {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const [liked, setLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [reposted, setReposted] = useState(false);

  const author = post.userId;
  const badge = author?.verifiedBadge && VERIFIED_BADGE_LABELS[author.verifiedBadge];
  const isOwnPost = user?._id === author?._id;

  const timeAgo = post.createdAt
    ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })
    : '';

  const handleLike = async () => {
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount((c) => newLiked ? c + 1 : Math.max(0, c - 1));
    try {
      const res = await dispatch(toggleLike(post._id)).unwrap();
    } catch (e) {
      // Revert
      setLiked(!newLiked);
      setLikesCount((c) => !newLiked ? c + 1 : Math.max(0, c - 1));
    }
  };

  const handleRepost = async () => {
    try {
      await postsAPI.repost(post._id);
      setReposted(true);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${post.content}\n\nShared from Kuwait Now`,
        title: 'Kuwait Now',
      });
    } catch (e) { /* silent */ }
  };

  const handleMoreOptions = () => {
    const options = isOwnPost
      ? ['Delete Post', 'Cancel']
      : ['Report Post', 'Cancel'];
    const destructiveIndex = 0;
    const cancelIndex = options.length - 1;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: destructiveIndex, cancelButtonIndex: cancelIndex },
        (i) => {
          if (i === 0) {
            if (isOwnPost) handleDelete();
            else showReportDialog();
          }
        }
      );
    } else {
      if (isOwnPost) {
        Alert.alert('Delete Post', 'Are you sure?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: handleDelete },
        ]);
      } else {
        showReportDialog();
      }
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Post', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => dispatch(deletePost(post._id)),
      },
    ]);
  };

  const showReportDialog = () => {
    Alert.alert('Report Post', 'Why are you reporting this post?',
      REPORT_REASONS.slice(0, 4).map((r) => ({
        text: r.label,
        onPress: () => postsAPI.reportPost(post._id, { reason: r.value })
          .then(() => Alert.alert('Reported', 'Thank you. Our team will review it.'))
          .catch((e) => Alert.alert('Error', e.message)),
      })).concat([{ text: 'Cancel', style: 'cancel' }])
    );
  };

  const navigateToPost = () => {
    if (!isDetailView) {
      navigation.navigate('PostDetail', { postId: post._id });
    }
  };

  const navigateToProfile = () => {
    if (author?.username) {
      navigation.navigate('ProfileDetail', { username: author.username });
    }
  };

  // Handle repost display
  const isRepost = post.type === 'repost';
  const displayPost = isRepost && post.originalPost ? post.originalPost : post;

  return (
    <TouchableOpacity
      style={[styles.card, isDetailView && styles.detailCard]}
      onPress={navigateToPost}
      activeOpacity={isDetailView ? 1 : 0.95}
    >
      {/* Repost indicator */}
      {isRepost && (
        <View style={styles.repostBanner}>
          <Ionicons name="repeat" size={13} color={COLORS.textMuted} />
          <Text style={styles.repostBannerText}>{author?.name} reposted</Text>
        </View>
      )}

      {/* Author row */}
      <View style={styles.authorRow}>
        <TouchableOpacity style={styles.avatarWrapper} onPress={navigateToProfile}>
          {author?.profilePic
            ? <Image source={{ uri: author.profilePic }} style={styles.avatar} />
            : <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>{author?.name?.[0] || '?'}</Text>
              </View>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.authorMeta} onPress={navigateToProfile}>
          <View style={styles.authorNameRow}>
            <Text style={styles.authorName}>{author?.name}</Text>
            {badge && (
              <Text style={[styles.badgeIcon, { color: badge.color }]}>{badge.icon}</Text>
            )}
          </View>
          <Text style={styles.authorUsername}>@{author?.username} · {timeAgo}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.moreBtn} onPress={handleMoreOptions}>
          <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Community note */}
      {post.hasCommunityNote && post.communityNote && (
        <View style={styles.communityNote}>
          <Ionicons name="information-circle" size={14} color={COLORS.warning} />
          <Text style={styles.communityNoteText}>{post.communityNote.content}</Text>
        </View>
      )}

      {/* Content */}
      {post.content ? (
        <Text style={[styles.content, isDetailView && styles.contentDetail]}>
          {post.content}
        </Text>
      ) : null}

      {/* Images */}
      {post.images && post.images.length > 0 && (
        <View style={styles.imagesContainer}>
          {post.images.slice(0, 4).map((img, i) => (
            <Image
              key={i}
              source={{ uri: img }}
              style={[styles.postImage, post.images.length > 1 && styles.multiImage]}
              resizeMode="cover"
            />
          ))}
        </View>
      )}

      {/* Poll */}
      {post.type === 'poll' && post.poll && (
        <View style={styles.pollContainer}>
          {post.poll.options.map((opt, i) => {
            const pct = post.poll.totalVotes > 0
              ? Math.round((opt.votesCount / post.poll.totalVotes) * 100) : 0;
            return (
              <View key={i} style={styles.pollOption}>
                <View style={[styles.pollBar, { width: `${pct}%`, backgroundColor: COLORS.primary + '30' }]} />
                <Text style={styles.pollOptionText}>{opt.text}</Text>
                <Text style={styles.pollPct}>{pct}%</Text>
              </View>
            );
          })}
          <Text style={styles.pollVotes}>{post.poll.totalVotes} votes</Text>
        </View>
      )}

      {/* Topic tags */}
      {post.topicTags && post.topicTags.length > 0 && (
        <View style={styles.topicTags}>
          {post.topicTags.map((topic) => (
            <TouchableOpacity
              key={topic._id}
              onPress={() => navigation.navigate('TopicDetail', { slug: topic.slug, topic })}
            >
              <Text style={[styles.topicTag, { color: topic.color || COLORS.primary }]}>
                #{topic.slug}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {/* Reply */}
        <TouchableOpacity style={styles.actionBtn} onPress={navigateToPost}>
          <Ionicons name="chatbubble-outline" size={18} color={COLORS.textMuted} />
          <Text style={styles.actionCount}>{post.commentsCount || 0}</Text>
        </TouchableOpacity>

        {/* Repost */}
        <TouchableOpacity style={styles.actionBtn} onPress={handleRepost}>
          <Ionicons name="repeat" size={18} color={reposted ? COLORS.secondary : COLORS.textMuted} />
          <Text style={[styles.actionCount, reposted && { color: COLORS.secondary }]}>
            {post.repostsCount || 0}
          </Text>
        </TouchableOpacity>

        {/* Like */}
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? COLORS.primary : COLORS.textMuted} />
          <Text style={[styles.actionCount, liked && { color: COLORS.primary }]}>{likesCount}</Text>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.white, marginBottom: 8, padding: 16 },
  detailCard: { marginBottom: 0, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  repostBanner: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 4 },
  repostBannerText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  authorRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  avatarWrapper: { marginRight: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarPlaceholder: { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: '700', color: '#fff' },
  authorMeta: { flex: 1 },
  authorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  authorName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  badgeIcon: { fontSize: 13 },
  authorUsername: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  moreBtn: { padding: 4 },
  communityNote: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFF9E6', borderRadius: 8, padding: 10, marginBottom: 10, gap: 6, borderLeftWidth: 3, borderLeftColor: COLORS.warning },
  communityNoteText: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 18 },
  content: { fontSize: 16, color: COLORS.text, lineHeight: 22, marginBottom: 10 },
  contentDetail: { fontSize: 17, lineHeight: 24 },
  imagesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 10, borderRadius: 10, overflow: 'hidden' },
  postImage: { width: '100%', height: 220, borderRadius: 10 },
  multiImage: { width: '48%', height: 140 },
  pollContainer: { backgroundColor: '#FAFAFA', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  pollOption: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, position: 'relative', backgroundColor: '#F0F0F0', borderRadius: 8, overflow: 'hidden', minHeight: 36 },
  pollBar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 8 },
  pollOptionText: { flex: 1, fontSize: 14, color: COLORS.text, padding: 8, zIndex: 1 },
  pollPct: { fontSize: 13, fontWeight: '700', color: COLORS.text, padding: 8, zIndex: 1 },
  pollVotes: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  topicTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  topicTag: { fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, gap: 24 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
});
