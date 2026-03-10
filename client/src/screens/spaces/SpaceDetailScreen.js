import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacesAPI } from '../../services/api';
import { toggleJoinSpace } from '../../store/slices/spacesSlice';
import PostCard from '../../components/post/PostCard';
import { COLORS } from '../../constants';

export default function SpaceDetailScreen({ navigation, route }) {
  const { slug, space: initialSpace } = route.params;
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { joinedSpaces } = useSelector((s) => s.spaces);

  const [space, setSpace] = useState(initialSpace);
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const isJoined = joinedSpaces.includes(space?._id);

  const loadPosts = useCallback(async (p = 1) => {
    if (p === 1) setIsLoading(true); else setLoadingMore(true);
    try {
      const [spaceRes, feedRes] = await Promise.all([
        p === 1 ? spacesAPI.getBySlug(slug) : Promise.resolve({ space }),
        spacesAPI.getFeed(slug, { page: p, limit: 20 }),
      ]);
      if (p === 1) {
        setSpace(spaceRes.space);
        setPosts(feedRes.posts);
      } else {
        setPosts((prev) => [...prev, ...feedRes.posts]);
      }
      setHasMore(p < feedRes.pagination.pages);
      setPage(p);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setLoadingMore(false);
    }
  }, [slug]);

  useEffect(() => {
    loadPosts(1);
    navigation.setOptions({ headerShown: false });
  }, []);

  const formatCount = (n) => {
    if (!n) return '0';
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const renderHeader = () => (
    <View>
      {/* Banner */}
      <View style={[styles.banner, { backgroundColor: space?.color || COLORS.primary }]}>
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
          <Text style={styles.bannerTitle}>{space?.name}</Text>
          {space?.nameAr && (
            <Text style={styles.bannerTitleAr}>{space.nameAr}</Text>
          )}
          <Text style={styles.bannerMeta}>
            {formatCount(space?.membersCount)} members · {space?.type}
          </Text>
        </View>

        {/* Join button — absolute bottom-right */}
        <TouchableOpacity
          style={[styles.joinBannerBtn, isJoined && styles.joinedBannerBtn]}
          onPress={() => dispatch(toggleJoinSpace(space._id))}
        >
          <Text style={[styles.joinBannerBtnText, isJoined && styles.joinedBannerBtnTextActive]}>
            {isJoined ? 'Joined' : 'Join'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Rules */}
      {space?.rules?.length > 0 && (
        <View style={styles.rulesCard}>
          <View style={styles.rulesHeader}>
            <Text style={styles.rulesTitle}>Rules</Text>
          </View>
          {space.rules.map((rule, i) => (
            <View key={i} style={styles.ruleRow}>
              <View style={styles.ruleNum}>
                <Text style={styles.ruleNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.ruleText}>{rule.title}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Posts header */}
      <View style={styles.postsHeader}>
        <Text style={styles.postsHeaderTitle}>Posts</Text>
        <TouchableOpacity
          style={styles.postHereBtn}
          onPress={() => navigation.navigate('CreatePost', { spaceId: space._id, spaceName: space.name })}
        >
          <Ionicons name="pencil" size={14} color={COLORS.white} />
          <Text style={styles.postHereBtnText}>Post here</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {isLoading && posts.length === 0 ? (
        <View>
          {renderHeader()}
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <PostCard post={item} navigation={navigation} />}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={loadingMore
            ? <ActivityIndicator style={{ padding: 20 }} size="small" color={COLORS.primary} />
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

  joinBannerBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  joinedBannerBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  joinBannerBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.accent,
  },
  joinedBannerBtnTextActive: {
    color: '#fff',
  },

  rulesCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  rulesHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rulesTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.separator,
  },
  ruleNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.fill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ruleNumText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 10,
    lineHeight: 20,
  },

  postsHeader: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  postsHeaderTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  postHereBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postHereBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.white,
  },
});
