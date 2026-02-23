import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { postsAPI } from '../../services/api';
import PostCard from '../../components/post/PostCard';
import CommentItem from '../../components/post/CommentItem';
import { COLORS } from '../../constants';
import { joinPostRoom, leavePostRoom, getSocket } from '../../services/socket';

export default function PostDetailScreen({ navigation, route }) {
  const { postId } = route.params;
  const { user } = useSelector((s) => s.auth);

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortMode, setSortMode] = useState('top');
  const [replyTo, setReplyTo] = useState(null); // { id, username }
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadPost = useCallback(async () => {
    try {
      const res = await postsAPI.getPost(postId);
      setPost(res.post);
    } catch (e) {
      console.error(e);
    }
  }, [postId]);

  const loadComments = useCallback(async (p = 1) => {
    if (p > 1) setLoadingMore(true);
    try {
      const res = await postsAPI.getComments(postId, { page: p, sort: sortMode, limit: 20 });
      if (p === 1) setComments(res.comments);
      else setComments((prev) => [...prev, ...res.comments]);
      setHasMore(p < Math.ceil(res.pagination.total / 20));
      setPage(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  }, [postId, sortMode]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([loadPost(), loadComments(1)]);
      setIsLoading(false);
    };
    init();

    joinPostRoom(postId);
    const socket = getSocket();
    if (socket) {
      socket.on('newComment', ({ comment, postId: pid }) => {
        if (pid === postId) {
          setComments((prev) => [comment, ...prev]);
          setPost((p) => p ? { ...p, commentsCount: p.commentsCount + 1 } : p);
        }
      });
    }

    return () => {
      leavePostRoom(postId);
      if (socket) socket.off('newComment');
    };
  }, [postId]);

  useEffect(() => {
    if (post) loadComments(1);
  }, [sortMode]);

  const handleSubmitComment = async () => {
    if (!commentText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await postsAPI.addComment(postId, {
        content: commentText.trim(),
        parentId: replyTo?.id || null,
      });
      setCommentText('');
      setReplyTo(null);
      setComments((prev) => [res.comment, ...prev]);
      setPost((p) => p ? { ...p, commentsCount: p.commentsCount + 1 } : p);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId) => {
    try {
      const res = await postsAPI.likeComment(postId, commentId);
      setComments((prev) =>
        prev.map((c) => c._id === commentId
          ? { ...c, isLiked: res.liked, likesCount: res.likesCount }
          : c
        )
      );
    } catch (e) { /* silent */ }
  };

  const renderHeader = () => (
    <View>
      {post && <PostCard post={post} navigation={navigation} isDetailView />}
      {/* Sort bar */}
      <View style={styles.sortBar}>
        <Text style={styles.commentsCount}>{post?.commentsCount || 0} Replies</Text>
        <View style={styles.sortBtns}>
          {['top', 'latest'].map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.sortBtn, sortMode === s && styles.activeSortBtn]}
              onPress={() => setSortMode(s)}
            >
              <Text style={[styles.sortBtnText, sortMode === s && styles.activeSortBtnText]}>
                {s === 'top' ? 'Top' : 'Latest'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {isLoading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <CommentItem
              comment={item}
              onLike={handleLikeComment}
              onReply={(c) => setReplyTo({ id: c._id, username: c.userId?.username })}
              navigation={navigation}
            />
          )}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={COLORS.primary} style={{ padding: 16 }} /> : null}
          ListEmptyComponent={
            !loadingMore && (
              <View style={styles.noComments}>
                <Text style={styles.noCommentsText}>No replies yet. Be first! 💬</Text>
              </View>
            )
          }
          onEndReached={() => { if (!loadingMore && hasMore) loadComments(page + 1); }}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Comment input */}
      <View style={styles.inputContainer}>
        {replyTo && (
          <View style={styles.replyIndicator}>
            <Text style={styles.replyText}>Replying to @{replyTo.username}</Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Ionicons name="close" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.commentInput}
            value={commentText}
            onChangeText={setCommentText}
            placeholder={replyTo ? `Reply to @${replyTo.username}...` : 'Add a reply...'}
            multiline
            maxLength={300}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!commentText.trim() || isSubmitting) && styles.sendBtnDisabled]}
            onPress={handleSubmitComment}
            disabled={!commentText.trim() || isSubmitting}
          >
            {isSubmitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loader: { flex: 1, justifyContent: 'center' },
  sortBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.white, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  commentsCount: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  sortBtns: { flexDirection: 'row', gap: 8 },
  sortBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  activeSortBtn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sortBtnText: { fontSize: 13, color: COLORS.textLight, fontWeight: '500' },
  activeSortBtnText: { color: '#fff' },
  noComments: { padding: 40, alignItems: 'center' },
  noCommentsText: { fontSize: 15, color: COLORS.textMuted },
  inputContainer: { backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border },
  replyIndicator: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  replyText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 10 },
  commentInput: { flex: 1, maxHeight: 100, backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: COLORS.text },
  sendBtn: { backgroundColor: COLORS.primary, borderRadius: 22, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
});
