import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { spacesAPI } from '../../services/api';
import { toggleJoinSpace } from '../../store/slices/spacesSlice';
import PostCard from '../../components/post/PostCard';
import { COLORS } from '../../constants';
import { Ionicons } from '@expo/vector-icons';

export default function SpaceDetailScreen({ navigation, route }) {
  const { slug, space: initialSpace } = route.params;
  const dispatch = useDispatch();
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
    navigation.setOptions({ title: space?.name || 'Space' });
  }, []);

  const renderHeader = () => (
    <View>
      <View style={[styles.banner, { backgroundColor: space?.color || COLORS.secondary }]}>
        <Text style={styles.bannerTitle}>{space?.name}</Text>
        {space?.nameAr && <Text style={styles.bannerAr}>{space.nameAr}</Text>}
        <Text style={styles.bannerStats}>{space?.membersCount?.toLocaleString()} members · {space?.type}</Text>
        {space?.description ? <Text style={styles.bannerDesc}>{space.description}</Text> : null}
        <TouchableOpacity
          style={[styles.joinBtn, isJoined && styles.joinedBtn]}
          onPress={() => dispatch(toggleJoinSpace(space._id))}
        >
          <Text style={styles.joinBtnText}>{isJoined ? '✓ Joined' : '+ Join Space'}</Text>
        </TouchableOpacity>
      </View>
      {/* Rules if any */}
      {space?.rules?.length > 0 && (
        <View style={styles.rulesContainer}>
          <Text style={styles.rulesTitle}>Space Rules</Text>
          {space.rules.map((rule, i) => (
            <Text key={i} style={styles.ruleItem}>
              {i + 1}. {rule.title}
            </Text>
          ))}
        </View>
      )}
      <View style={styles.postsHeaderRow}>
        <Text style={styles.postsHeaderTitle}>Posts</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('CreatePost', { spaceId: space._id, spaceName: space.name })}
          style={styles.postInSpaceBtn}
        >
          <Ionicons name="pencil" size={14} color={COLORS.secondary} style={{ marginRight: 4 }} />
          <Text style={styles.postInSpaceBtnText}>Post here</Text>
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
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 16 }} size="small" color={COLORS.primary} /> : null}
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
  banner: { padding: 20 },
  bannerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  bannerAr: { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginTop: 2, textAlign: 'right' },
  bannerStats: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 6 },
  bannerDesc: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 8, lineHeight: 20 },
  joinBtn: { marginTop: 12, alignSelf: 'flex-start', borderWidth: 1.5, borderColor: '#fff', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  joinedBtn: { backgroundColor: 'rgba(255,255,255,0.2)' },
  joinBtnText: { color: '#fff', fontWeight: '700' },
  rulesContainer: { backgroundColor: COLORS.white, margin: 12, borderRadius: 10, padding: 14 },
  rulesTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  ruleItem: { fontSize: 13, color: COLORS.textLight, marginBottom: 4, lineHeight: 18 },
  postsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  postsHeaderTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  postInSpaceBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.secondary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  postInSpaceBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.secondary },
});
