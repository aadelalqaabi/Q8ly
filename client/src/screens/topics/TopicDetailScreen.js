import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { topicsAPI } from '../../services/api';
import { toggleFollowTopic } from '../../store/slices/topicsSlice';
import PostCard from '../../components/post/PostCard';
import { COLORS } from '../../constants';

export default function TopicDetailScreen({ navigation, route }) {
  const { slug, topic: initialTopic } = route.params;
  const dispatch = useDispatch();
  const { followedTopics } = useSelector((s) => s.topics);

  const [topic, setTopic] = useState(initialTopic);
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortMode, setSortMode] = useState('top'); // 'top' | 'latest'
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

  useEffect(() => {
    loadPosts(1);
  }, [slug, sortMode]);

  useEffect(() => {
    navigation.setOptions({ title: topic?.name || 'Topic' });
  }, [topic]);

  const handleSortChange = (sort) => {
    setSortMode(sort);
  };

  const renderHeader = () => (
    <View>
      {/* Topic banner */}
      <View style={[styles.banner, { backgroundColor: topic?.color || COLORS.primary }]}>
        <Text style={styles.bannerTitle}>{topic?.nameAr || topic?.name}</Text>
        <Text style={styles.bannerSubtitle}>{topic?.name}</Text>
        <Text style={styles.bannerStats}>
          {topic?.followersCount?.toLocaleString()} followers · {topic?.postsCount?.toLocaleString()} posts
        </Text>
        <TouchableOpacity
          style={[styles.followBannerBtn, isFollowing && styles.followingBannerBtn]}
          onPress={() => dispatch(toggleFollowTopic(topic._id))}
        >
          <Text style={[styles.followBannerBtnText, isFollowing && styles.followingBannerBtnText]}>
            {isFollowing ? '✓ Following' : '+ Follow'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sort tabs */}
      <View style={styles.sortRow}>
        {['top', 'latest'].map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.sortTab, sortMode === s && styles.activeSortTab]}
            onPress={() => handleSortChange(s)}
          >
            <Text style={[styles.sortTabText, sortMode === s && styles.activeSortTabText]}>
              {s === 'top' ? '🔥 Top' : '🕐 Latest'}
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
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={COLORS.primary} style={{ padding: 16 }} /> : null}
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
  container: { flex: 1, backgroundColor: COLORS.background },
  banner: { padding: 20, paddingTop: 24 },
  bannerTitle: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'right' },
  bannerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  bannerStats: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 6 },
  followBannerBtn: {
    marginTop: 12, alignSelf: 'flex-start',
    borderWidth: 1.5, borderColor: '#fff', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  followingBannerBtn: { backgroundColor: 'rgba(255,255,255,0.2)' },
  followBannerBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  followingBannerBtnText: { color: '#fff' },
  sortRow: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  sortTab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeSortTab: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  sortTabText: { fontSize: 14, fontWeight: '500', color: COLORS.textLight },
  activeSortTabText: { color: COLORS.primary, fontWeight: '700' },
  loader: { marginTop: 40 },
});
