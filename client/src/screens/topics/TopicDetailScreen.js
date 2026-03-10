import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { topicsAPI } from '../../services/api';
import { toggleFollowTopic } from '../../store/slices/topicsSlice';
import PostCard from '../../components/post/PostCard';
import { COLORS } from '../../constants';

export default function TopicDetailScreen({ navigation, route }) {
  const { slug, topic: initialTopic } = route.params;
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { followedTopics } = useSelector((s) => s.topics);

  const [topic, setTopic] = useState(initialTopic);
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortMode, setSortMode] = useState('top');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const isFollowing = followedTopics.includes(topic?._id);

  const loadPosts = useCallback(async (p = 1, sort = sortMode) => {
    if (p === 1) setIsLoading(true); else setLoadingMore(true);
    try {
      const res = await topicsAPI.getPosts(slug, { page: p, sort, limit: 20 });
      if (p === 1) {
        setPosts(res.posts);
        setTopic(res.topic);
      } else {
        setPosts((prev) => [...prev, ...res.posts]);
      }
      setHasMore(p < res.pagination.pages);
      setPage(p);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setLoadingMore(false);
    }
  }, [slug, sortMode]);

  useEffect(() => { loadPosts(1); }, [slug, sortMode]);
  useEffect(() => { navigation.setOptions({ headerShown: false }); }, []);

  const formatCount = (n) => {
    if (!n) return '0';
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const renderHeader = () => (
    <View>
      {/* Banner */}
      <View style={[styles.banner, { backgroundColor: topic?.color || COLORS.primary }]}>
        {/* Back button */}
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 12 }]}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Banner content */}
        <View style={[styles.bannerContent, { paddingTop: insets.top + 52 }]}>
          <Text style={styles.bannerTitle}>{topic?.name}</Text>
          {topic?.nameAr && (
            <Text style={styles.bannerTitleAr}>{topic.nameAr}</Text>
          )}
          <Text style={styles.bannerMeta}>
            {formatCount(topic?.followersCount)} followers · {formatCount(topic?.postsCount)} posts
          </Text>
        </View>

        {/* Follow button — absolute bottom-right */}
        <TouchableOpacity
          style={[styles.followBannerBtn, isFollowing && styles.followingBannerBtn]}
          onPress={() => dispatch(toggleFollowTopic(topic._id))}
        >
          <Text style={[styles.followBannerBtnText, isFollowing && styles.followingBannerBtnTextActive]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sort tabs */}
      <View style={styles.sortRow}>
        {['top', 'latest'].map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.sortTab, sortMode === s && styles.activeSortTab]}
            onPress={() => setSortMode(s)}
          >
            <Text style={[styles.sortTabText, sortMode === s && styles.activeSortTabText]}>
              {s === 'top' ? 'Top' : 'Latest'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {isLoading && posts.length === 0 ? (
        <View>
          {renderHeader()}
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <PostCard post={item} navigation={navigation} />}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={loadingMore
            ? <ActivityIndicator size="small" color={COLORS.primary} style={{ padding: 20 }} />
            : <View style={{ height: 20 }} />
          }
          onEndReached={() => { if (!loadingMore && hasMore) loadPosts(page + 1); }}
          onEndReachedThreshold={0.3}
          refreshing={isLoading && posts.length > 0}
          onRefresh={() => loadPosts(1)}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },

  banner: {
    height: 200,
    position: 'relative',
    paddingHorizontal: 20,
  },

  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  bannerContent: {
    paddingBottom: 20,
  },

  bannerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
  },
  bannerTitleAr: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  bannerMeta: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },

  followBannerBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  followingBannerBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  followBannerBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.accent,
  },
  followingBannerBtnTextActive: {
    color: '#fff',
  },

  sortRow: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.separator,
  },
  sortTab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  activeSortTab: {
    backgroundColor: COLORS.fill,
  },
  sortTabText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  activeSortTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },

  loader: { marginTop: 40 },
});
