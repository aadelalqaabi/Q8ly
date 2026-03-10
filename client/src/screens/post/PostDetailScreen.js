import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { postsAPI } from '../../services/api';
import PostCard from '../../components/post/PostCard';
import CommentItem from '../../components/post/CommentItem';
import { useTheme } from '../../context/ThemeContext';
import { joinPostRoom, leavePostRoom, getSocket } from '../../services/socket';

export default function PostDetailScreen({ navigation, route }) {
  const { postId } = route.params;
  const { user } = useSelector((s) => s.auth);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadPost = useCallback(async () => {
    try {
      const res = await postsAPI.getPost(postId);
      setPost(res.post);
    } catch (e) { console.error(e); }
  }, [postId]);

  const loadComments = useCallback(async (p = 1) => {
    if (p > 1) setLoadingMore(true);
    try {
      const res = await postsAPI.getComments(postId, { page: p, sort: 'latest', limit: 20 });
      if (p === 1) setComments(res.comments);
      else setComments((prev) => [...prev, ...res.comments]);
      setHasMore(p < Math.ceil(res.pagination.total / 20));
      setPage(p);
    } catch (e) { console.error(e); }
    finally { setLoadingMore(false); }
  }, [postId]);

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
      Alert.alert(t('common.error'), e.message);
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
    } catch { /* silent */ }
  };

  const renderHeader = () => (
    <View>
      {post && <PostCard post={post} navigation={navigation} isDetailView />}
      <View style={styles.repliesHeader}>
        <Text style={styles.repliesLabel}>
          {t('post.replies', { count: post?.commentsCount || 0 })}
        </Text>
      </View>
    </View>
  );

  const renderEmpty = () => (
    !isLoading && !loadingMore ? (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{t('post.beFirstToComment')}</Text>
      </View>
    ) : null
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {isLoading ? (
        <ActivityIndicator size="large" color={COLORS.accent} style={styles.loader} />
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <CommentItem
              comment={item}
              onLike={handleLikeComment}
              onReply={(c) => setReplyTo({ id: c._id, name: c.userId?.name })}
              navigation={navigation}
            />
          )}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator size="small" color={COLORS.accent} style={{ padding: 20 }} />
              : <View style={{ height: 20 }} />
          }
          ListEmptyComponent={renderEmpty}
          onEndReached={() => { if (!loadingMore && hasMore) loadComments(page + 1); }}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Comment input */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
        {replyTo && (
          <View style={styles.replyRow}>
            <Text style={styles.replyText} numberOfLines={1}>
              {t('post.replyingTo', { username: replyTo.name })}
            </Text>
            <TouchableOpacity
              onPress={() => setReplyTo(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={15} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={commentText}
            onChangeText={setCommentText}
            placeholder={t('post.commentPlaceholder')}
            placeholderTextColor={COLORS.textPlaceholder}
            multiline
            maxLength={300}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!commentText.trim() || isSubmitting) && styles.sendBtnOff]}
            onPress={handleSubmitComment}
            disabled={!commentText.trim() || isSubmitting}
          >
            {isSubmitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="arrow-up" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.white,
  },
  loader: {
    flex: 1,
    marginTop: 80,
  },

  repliesHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  repliesLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
  },

  empty: {
    paddingTop: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: C.textMuted,
  },

  inputBar: {
    backgroundColor: C.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.separator,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    gap: 6,
  },
  replyText: {
    flex: 1,
    fontSize: 13,
    color: C.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
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
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnOff: {
    opacity: 0.35,
  },
});
