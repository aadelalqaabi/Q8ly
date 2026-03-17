import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Share, Dimensions, Alert, Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { getDateLocale } from '../../i18n';
import { toggleLike, deletePost, updateBookmark } from '../../store/slices/postsSlice';
import { postsAPI } from '../../services/api';
import { REPORT_REASONS } from '../../constants';
import { useTheme } from '../../context/ThemeContext';

const BADGE_COLORS = {
  government: '#0033A0',
  media:      '#D97706',
  business:   '#16A34A',
  influencer: '#7C3AED',
  founder:    '#0033A0',
};
const BADGE_KEYS = {
  government: 'badge.official',
  media:      'badge.media',
  business:   'badge.business',
  influencer: 'badge.influencer',
  founder:    'badge.founder',
};

function VerifiedBadge({ badge }) {
  const { t } = useTranslation();
  if (!badge || badge === 'none') return null;
  const color = BADGE_COLORS[badge];
  const key = BADGE_KEYS[badge];
  if (!color || !key) return null;
  const isFounder = badge === 'founder';
  return (
    <View style={{
      backgroundColor: color,
      borderRadius: 4,
      paddingHorizontal: isFounder ? 6 : 5,
      paddingVertical: 2,
      marginStart: 5,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: isFounder ? 3 : 0,
    }}>
      {isFounder && <Text style={{ color: '#FFD700', fontSize: 8, lineHeight: 10 }}>★</Text>}
      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>
        {t(key).toUpperCase()}
      </Text>
    </View>
  );
}
import BottomMenu from '../ui/BottomMenu';

const SW = Dimensions.get('window').width;
// Content column width = screen - 16 (left pad) - 44 (avatar) - 12 (gap) - 16 (right pad)
const CONTENT_W = SW - 88;

const PALETTE = ['#0033A0', '#007A3D', '#FF6B35', '#2196F3', '#9C27B0', '#00BCD4', '#FF9800'];
function avatarBg(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// ── SmartImage — full-width, correct aspect ratio, tappable ──────────────────
function SmartImage({ uri, onPress }) {
  // Default to 16:9 until Image.getSize resolves
  const [aspectRatio, setAspectRatio] = useState(16 / 9);

  useEffect(() => {
    if (!uri) return;
    Image.getSize(
      uri,
      (w, h) => {
        if (w && h) {
          // Clamp: max 2.5:1 (ultra-wide) to 0.5:1 (tall portrait)
          setAspectRatio(Math.max(0.5, Math.min(2.5, w / h)));
        }
      },
      () => {} // ignore errors — keep default ratio
    );
  }, [uri]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.92}>
      <Image
        source={{ uri }}
        style={{ width: '100%', aspectRatio, borderRadius: 10 }}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );
}

// ── VideoThumb — static thumbnail with play overlay, tappable ─────────────────
function VideoThumb({ video, videoThumbnail, videoWidth, videoHeight, onPress, COLORS }) {
  // Clamp: min 1 (square) → max 1.9 (wide) — keeps thumbnails compact in the feed
  const clamp = (r) => Math.max(1, Math.min(1.9, r));
  const initRatio = (videoWidth && videoHeight) ? clamp(videoWidth / videoHeight) : 16 / 9;
  const [aspectRatio, setAspectRatio] = useState(initRatio);

  useEffect(() => {
    if (!videoThumbnail || (videoWidth && videoHeight)) return;
    Image.getSize(
      videoThumbnail,
      (w, h) => { if (w && h) setAspectRatio(clamp(w / h)); },
      () => {}
    );
  }, [videoThumbnail]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={{ borderRadius: 10, overflow: 'hidden' }}>
      {videoThumbnail ? (
        <Image
          source={{ uri: videoThumbnail }}
          style={{ width: '100%', aspectRatio }}
          resizeMode="cover"
        />
      ) : (
        <View style={{ width: '100%', aspectRatio, backgroundColor: '#111' }} />
      )}
      {/* Play overlay */}
      <View style={videoThumbStyles.overlay}>
        <View style={videoThumbStyles.playBtn}>
          <Ionicons name="play" size={28} color="#fff" />
        </View>
      </View>
      {/* Video badge */}
      <View style={videoThumbStyles.badge}>
        <Ionicons name="videocam" size={11} color="#fff" />
        <Text style={videoThumbStyles.badgeText}>Video</Text>
      </View>
    </TouchableOpacity>
  );
}

const videoThumbStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  playBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
    paddingLeft: 4,
  },
  badge: {
    position: 'absolute', bottom: 8, start: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  badgeText: { fontSize: 11, color: '#fff', fontWeight: '500' },
});

// ── Multi-image grid ──────────────────────────────────────────────────────────
function ImageGrid({ images, onPressImage }) {
  const count = Math.min(images.length, 4);

  if (count === 1) {
    return (
      <View style={{ marginBottom: 10 }}>
        <SmartImage uri={images[0]} onPress={() => onPressImage(0)} />
      </View>
    );
  }

  if (count === 2) {
    return (
      <View style={{ flexDirection: 'row', gap: 2, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
        {images.slice(0, 2).map((img, i) => (
          <TouchableOpacity key={i} onPress={() => onPressImage(i)} activeOpacity={0.9} style={{ flex: 1 }}>
            <Image source={{ uri: img }} style={{ width: '100%', aspectRatio: 3 / 4 }} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (count === 3) {
    return (
      <View style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
        <TouchableOpacity onPress={() => onPressImage(0)} activeOpacity={0.9}>
          <Image source={{ uri: images[0] }} style={{ width: '100%', height: 160 }} resizeMode="cover" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
          {images.slice(1, 3).map((img, i) => (
            <TouchableOpacity key={i} onPress={() => onPressImage(i + 1)} activeOpacity={0.9} style={{ flex: 1 }}>
              <Image source={{ uri: img }} style={{ width: '100%', height: 110 }} resizeMode="cover" />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // 4 images: 2×2 grid
  return (
    <View style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 10, gap: 2 }}>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {images.slice(0, 2).map((img, i) => (
          <TouchableOpacity key={i} onPress={() => onPressImage(i)} activeOpacity={0.9} style={{ flex: 1 }}>
            <Image source={{ uri: img }} style={{ width: '100%', height: 130 }} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {images.slice(2, 4).map((img, i) => (
          <TouchableOpacity key={i} onPress={() => onPressImage(i + 2)} activeOpacity={0.9} style={{ flex: 1 }}>
            <Image source={{ uri: img }} style={{ width: '100%', height: 130 }} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── PollView ──────────────────────────────────────────────────────────────────
function PollView({ post }) {
  const { user } = useSelector((s) => s.auth);
  const { colors: COLORS } = useTheme();
  const { t } = useTranslation();

  const userIdStr = user?._id?.toString();
  const myVoteIndex = post.poll?.options?.findIndex(
    (opt) => opt.votes?.some((v) => v?.toString() === userIdStr)
  ) ?? -1;

  const [localVote, setLocalVote] = useState(myVoteIndex);
  const [localTotal, setLocalTotal] = useState(post.poll?.totalVotes || 0);
  const [localCounts, setLocalCounts] = useState(
    post.poll?.options?.map((o) => o.votesCount || 0) ?? []
  );
  const [voting, setVoting] = useState(false);

  const isExpired = post.poll?.expiresAt && new Date(post.poll.expiresAt) < new Date();
  const showResults = localVote !== -1 || isExpired;

  const getPercentage = (i) => {
    if (localTotal === 0) return 0;
    return Math.round((localCounts[i] / localTotal) * 100);
  };

  const handleVote = async (index) => {
    if (isExpired || voting) return;
    setVoting(true);
    const prevVote = localVote;
    const prevCounts = [...localCounts];
    const prevTotal = localTotal;

    // Optimistic update
    const isSameOption = localVote === index;
    if (isSameOption) {
      // Unvote
      setLocalVote(-1);
      setLocalCounts((prev) => prev.map((c, i) => i === index ? Math.max(0, c - 1) : c));
      setLocalTotal((t) => Math.max(0, t - 1));
    } else {
      // Vote or change vote
      setLocalVote(index);
      setLocalCounts((prev) => prev.map((c, i) => {
        if (i === index) return c + 1;
        if (i === prevVote) return Math.max(0, c - 1);
        return c;
      }));
      setLocalTotal((t) => prevVote === -1 ? t + 1 : t); // only +1 if was not voted before
    }

    try {
      const res = await postsAPI.votePoll(post._id, index);
      setLocalCounts(res.results.map((r) => r.votesCount ?? 0));
      setLocalTotal(res.totalVotes);
      setLocalVote(res.action === 'unvoted' ? -1 : index);
    } catch {
      setLocalVote(prevVote);
      setLocalCounts(prevCounts);
      setLocalTotal(prevTotal);
    } finally {
      setVoting(false);
    }
  };

  if (!post.poll?.options?.length) return null;

  return (
    <View style={[pollStyles.card, { borderColor: COLORS.separator, backgroundColor: COLORS.fill }]}>
      {/* Question */}
      <View style={pollStyles.questionRow}>
        <Ionicons name="bar-chart-outline" size={13} color={COLORS.textMuted} />
        <Text style={[pollStyles.question, { color: COLORS.text }]}>{post.poll.question}</Text>
      </View>

      {/* Options */}
      {post.poll.options.map((opt, i) => {
        const pct = getPercentage(i);
        const isMyVote = localVote === i;

        if (showResults) {
          return (
            <TouchableOpacity
              key={i}
              style={[pollStyles.resultRow, { backgroundColor: COLORS.white }]}
              onPress={() => !isExpired && handleVote(i)}
              activeOpacity={isExpired ? 1 : 0.75}
              disabled={voting}
            >
              {/* Fill bar */}
              <View
                style={[
                  pollStyles.resultFill,
                  { width: `${pct}%`, backgroundColor: isMyVote ? COLORS.accent + '25' : COLORS.separator },
                ]}
              />
              <View style={pollStyles.resultContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
                  {isMyVote
                    ? <Ionicons name="checkmark-circle" size={14} color={COLORS.accent} />
                    : <View style={[pollStyles.dot, { borderColor: COLORS.separator }]} />
                  }
                  <Text style={[pollStyles.optText, { color: COLORS.text, flex: 1 }]} numberOfLines={2}>
                    {opt.text}
                  </Text>
                </View>
                <Text style={[pollStyles.pctText, { color: isMyVote ? COLORS.accent : COLORS.textMuted }]}>
                  {pct}%
                </Text>
              </View>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={i}
            style={[pollStyles.optBtn, { borderColor: COLORS.separator, backgroundColor: COLORS.white }]}
            onPress={() => handleVote(i)}
            activeOpacity={0.7}
            disabled={voting}
          >
            <View style={[pollStyles.dot, { borderColor: COLORS.accent }]} />
            <Text style={[pollStyles.optText, { color: COLORS.text }]}>{opt.text}</Text>
          </TouchableOpacity>
        );
      })}

      {/* Footer */}
      <Text style={[pollStyles.meta, { color: COLORS.textMuted }]}>
        {t('post.votes', { count: localTotal })}
        {isExpired ? ` · ${t('post.pollEnded')}` : ''}
      </Text>
    </View>
  );
}

const pollStyles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 6,
  },
  questionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  question: { fontSize: 14, fontWeight: '600', lineHeight: 20, flex: 1 },
  optBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 1.5,
    flexShrink: 0,
  },
  optText: { fontSize: 14, fontWeight: '500', flex: 1 },
  resultRow: {
    borderRadius: 10,
    height: 40,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  resultFill: {
    position: 'absolute',
    start: 0, top: 0, bottom: 0,
    borderRadius: 10,
  },
  resultContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  pctText: { fontSize: 12, fontWeight: '700', flexShrink: 0 },
  meta: { fontSize: 11, marginTop: 2 },
});

// ── PostCard ──────────────────────────────────────────────────────────────────
export default function PostCard({ post, navigation, isDetailView = false }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { user } = useSelector((s) => s.auth);
  const { colors: COLORS } = useTheme();
  const [liked, setLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [bookmarked, setBookmarked] = useState(post.isBookmarked || false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteMenuVisible, setDeleteMenuVisible] = useState(false);
  const [reportMenuVisible, setReportMenuVisible] = useState(false);

  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const author = post.userId;
  const isOwnPost = user?._id === author?._id;
  const timestamp = post.createdAt
    ? format(new Date(post.createdAt), 'MMM d · h:mm a', { locale: getDateLocale() })
    : '';

  const handleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikesCount((c) => next ? c + 1 : Math.max(0, c - 1));
    try {
      await dispatch(toggleLike(post._id)).unwrap();
    } catch {
      setLiked(!next);
      setLikesCount((c) => !next ? c + 1 : Math.max(0, c - 1));
    }
  };

  const handleShare = async () => {
    const url = `kuwai://post/${post._id}`;
    try {
      await Share.share(Platform.OS === 'ios' ? { url } : { message: url });
    } catch { /* silent */ }
  };

  const handleBookmark = async () => {
    const next = !bookmarked;
    setBookmarked(next);
    dispatch(updateBookmark({ postId: post._id, bookmarked: next }));
    try {
      const res = await postsAPI.toggleBookmark(post._id, next);
      const confirmed = res?.bookmarked ?? next;
      if (confirmed !== next) {
        setBookmarked(confirmed);
        dispatch(updateBookmark({ postId: post._id, bookmarked: confirmed }));
      }
    } catch {
      setBookmarked(!next);
      dispatch(updateBookmark({ postId: post._id, bookmarked: !next }));
    }
  };

  // Open media viewer at a specific index
  const openViewer = (mediaArray, index = 0) => {
    navigation.navigate('MediaViewer', { media: mediaArray, initialIndex: index });
  };

  const openImages = (startIndex) => {
    const mediaArr = (isRepost ? (originalPost?.images || []) : (post.images || [])).map((uri) => ({ uri, type: 'image' }));
    openViewer(mediaArr, startIndex);
  };

  const openVideo = () => {
    const videoUri = isRepost ? originalPost?.video : post.video;
    openViewer([{ uri: videoUri, type: 'video' }], 0);
  };

  const mainMenuOptions = isOwnPost
    ? [{ label: t('common.delete'), destructive: true, onPress: () => setDeleteMenuVisible(true) }]
    : [{ label: t('post.reportPostOption'), onPress: () => setReportMenuVisible(true) }];

  const deleteMenuOptions = [
    { label: t('common.delete'), destructive: true, onPress: () => dispatch(deletePost(post._id)) },
  ];

  const handleReport = async (reason) => {
    try {
      await postsAPI.reportPost(post._id, { reason });
      Alert.alert(t('post.reportDone'), t('post.reportThanks'));
    } catch {
      Alert.alert(t('common.error'), t('post.reportError'));
    }
  };

  const reportMenuOptions = REPORT_REASONS.map((r) => ({
    label: r.label,
    onPress: () => handleReport(r.value),
  }));

  const toPost = () => { if (!isDetailView) navigation.navigate('PostDetail', { postId: post._id }); };
  const toProfile = () => {
    const un = displayAuthor?.username || author?.username;
    if (un) navigation.navigate('ProfileDetail', { username: un });
  };

  // For repost: resolve the actual content source
  const isRepost = post.type === 'repost' && post.originalPost;
  const repostAuthor = post.userId; // person who reposted
  const originalPost = isRepost ? post.originalPost : null;
  const displayAuthor = isRepost && originalPost?.userId ? originalPost.userId : post.userId;
  // Show original post's content/media; reposter's comment (post.content) goes above if present
  const displayContent = isRepost ? (originalPost?.content || '') : (post.content || '');
  const displayImages = isRepost ? (originalPost?.images || []) : (post.images || []);
  const displayVideo = isRepost ? (originalPost?.video || null) : (post.video || null);
  const displayVideoThumb = isRepost ? (originalPost?.videoThumbnail || null) : (post.videoThumbnail || null);
  const displayVideoWidth = isRepost ? (originalPost?.videoWidth || 0) : (post.videoWidth || 0);
  const displayVideoHeight = isRepost ? (originalPost?.videoHeight || 0) : (post.videoHeight || 0);

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={toPost}
        activeOpacity={isDetailView ? 1 : 0.97}
      >
        {/* Repost banner */}
        {isRepost && (
          <View style={styles.repostBanner}>
            <Ionicons name="repeat" size={13} color={COLORS.textMuted} />
            <Text style={styles.repostBannerText}>
              {repostAuthor?.name || repostAuthor?.username} reposted
            </Text>
          </View>
        )}
        <View style={styles.row}>
          {/* Avatar */}
          <TouchableOpacity onPress={toProfile} activeOpacity={0.7} style={styles.avatarWrap}>
            {displayAuthor?.profilePic ? (
              <Image source={{ uri: displayAuthor.profilePic }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: avatarBg(displayAuthor?.name) }]}>
                <Text style={styles.avatarInitial}>{displayAuthor?.name?.[0]?.toUpperCase() || '?'}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Content column */}
          <View style={styles.content}>
            {/* Header row */}
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={toProfile} style={styles.authorBlock} activeOpacity={0.7}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
                  <Text style={styles.authorName} numberOfLines={1}>
                    {displayAuthor?.name}
                  </Text>
                  <VerifiedBadge badge={displayAuthor?.verifiedBadge} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMenuVisible(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.moreBtn}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Reposter's comment (if any) shown above original content */}
            {isRepost && !!post.content && (
              <Text style={[styles.body, { color: COLORS.textMuted, fontSize: 14 }]} numberOfLines={3}>
                {post.content}
              </Text>
            )}

            {/* Text body */}
            {!!displayContent && (
              <Text style={styles.body} numberOfLines={isDetailView ? undefined : 5}>
                {displayContent}
              </Text>
            )}

            {/* Poll */}
            {post.type === 'poll' && post.poll && (
              <PollView post={post} />
            )}

            {/* Images */}
            {displayImages.length > 0 && (
              <ImageGrid images={displayImages} onPressImage={openImages} />
            )}

            {/* Video */}
            {!!displayVideo && (
              <View style={{ marginBottom: 10 }}>
                <VideoThumb
                  video={displayVideo}
                  videoThumbnail={displayVideoThumb}
                  videoWidth={displayVideoWidth}
                  videoHeight={displayVideoHeight}
                  onPress={openVideo}
                  COLORS={COLORS}
                />
              </View>
            )}

            {/* Actions + timestamp */}
            <View style={styles.actionsRow}>
            <View style={styles.actions}>
              {/* Comments */}
              <TouchableOpacity style={styles.action} onPress={toPost} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}>
                <Ionicons name="chatbubble-outline" size={20} color={COLORS.textMuted} />
                {(post.commentsCount || 0) > 0 && (
                  <Text style={styles.actionCount}>{post.commentsCount}</Text>
                )}
              </TouchableOpacity>

              {/* Like */}
              <TouchableOpacity
                style={styles.action}
                onPress={isOwnPost ? undefined : handleLike}
                disabled={isOwnPost}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
              >
                <Ionicons
                  name={liked ? 'heart' : 'heart-outline'}
                  size={20}
                  color={liked ? COLORS.accent : COLORS.textMuted}
                  style={isOwnPost ? { opacity: 0.3 } : undefined}
                />
                {likesCount > 0 && (
                  <Text style={[styles.actionCount, liked && styles.actionCountLiked]}>
                    {likesCount}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Bookmark */}
              <TouchableOpacity style={styles.action} onPress={handleBookmark} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                <Ionicons
                  name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={bookmarked ? COLORS.accent : COLORS.textMuted}
                />
              </TouchableOpacity>

              {/* Share — disabled */}
            </View>
            {!!timestamp && <Text style={styles.timestamp}>{timestamp}</Text>}
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <BottomMenu visible={menuVisible} onClose={() => setMenuVisible(false)} options={mainMenuOptions} />
      <BottomMenu visible={deleteMenuVisible} onClose={() => setDeleteMenuVisible(false)} title={t('post.deletePostMsg')} options={deleteMenuOptions} />
      <BottomMenu visible={reportMenuVisible} onClose={() => setReportMenuVisible(false)} title={t('post.reportWhy')} options={reportMenuOptions} />
    </>
  );
}

const makeStyles = (C) => StyleSheet.create({
  container: {
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
    paddingTop: 14,
    paddingHorizontal: 16,
  },
  repostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingBottom: 6,
    paddingStart: 62,
  },
  repostBannerText: { fontSize: 14, color: C.textMuted, fontWeight: '500' },
  row: { flexDirection: 'row', gap: 12 },
  avatarWrap: { width: 48, flexShrink: 0 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '700', color: '#fff' },
  content: { flex: 1, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 3 },
  authorBlock: { flex: 1 },
  authorName: { fontSize: 16, fontWeight: '700', color: C.text, lineHeight: 21 },
  moreBtn: { width: 32, height: 24, justifyContent: 'center', alignItems: 'flex-end', marginTop: -2 },
  body: { fontSize: 17, color: C.text, lineHeight: 25, marginBottom: 10 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 },
  actions: { flexDirection: 'row', gap: 24 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38 },
  actionCount: { fontSize: 15, color: C.textMuted },
  actionCountLiked: { color: C.accent },
  timestamp: { fontSize: 13, color: C.textMuted, paddingBottom: 4 },
});
