import React, { useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchFeed } from '../../store/slices/postsSlice';
import PostCard from '../../components/post/PostCard';
import NowBar from '../../components/home/NowBar';
import KuwaitBriefCard from '../../components/home/KuwaitBriefCard';
import { COLORS } from '../../constants';

const TABS = ['for_you', 'following'];
const TAB_LABELS = { for_you: 'For You', following: 'Following' };

export default function HomeScreen({ navigation }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = React.useState('for_you');

  const { forYouPosts, followingPosts, isLoading, isLoadingMore, forYouHasMore, followingHasMore, forYouPage, followingPage } = useSelector((s) => s.posts);
  const { nowBarItems, kuwaitBrief } = useSelector((s) => s.ui);

  const posts = activeTab === 'for_you' ? forYouPosts : followingPosts;
  const hasMore = activeTab === 'for_you' ? forYouHasMore : followingHasMore;
  const page = activeTab === 'for_you' ? forYouPage : followingPage;

  const loadFeed = useCallback((p = 1) => {
    dispatch(fetchFeed({ tab: activeTab, page: p }));
  }, [activeTab, dispatch]);

  useEffect(() => {
    loadFeed(1);
  }, [activeTab]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      loadFeed(page + 1);
    }
  };

  const renderHeader = () => (
    <View>
      {/* Now Bar */}
      {nowBarItems.length > 0 && <NowBar items={nowBarItems} navigation={navigation} />}
      {/* Kuwait Brief */}
      {kuwaitBrief && <KuwaitBriefCard brief={kuwaitBrief} navigation={navigation} />}
    </View>
  );

  const renderPost = ({ item }) => (
    <PostCard post={item} navigation={navigation} />
  );

  const renderFooter = () => {
    if (!isLoadingMore) return <View style={{ height: 20 }} />;
    return (
      <View style={styles.loadMoreIndicator}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📰</Text>
        <Text style={styles.emptyTitle}>
          {activeTab === 'following' ? 'Follow people to see their posts' : 'Nothing here yet'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {activeTab === 'following'
            ? 'Visit Discover to find interesting accounts'
            : 'Be the first to post something!'}
        </Text>
        <TouchableOpacity
          style={styles.discoverBtn}
          onPress={() => navigation.navigate('Discover')}
        >
          <Text style={styles.discoverBtnText}>Discover People</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLogo}>🇰🇼 Kuwait Now</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate('Search')} style={styles.headerBtn}>
            <Ionicons name="search" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.headerBtn}>
            <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Feed Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {TAB_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Feed */}
      {isLoading && posts.length === 0 ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item._id}
          renderItem={renderPost}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={isLoading && posts.length > 0}
              onRefresh={() => loadFeed(1)}
              tintColor={COLORS.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        />
      )}

      {/* FAB: Create Post */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 80 }]}
        onPress={() => navigation.navigate('CreatePost')}
      >
        <Ionicons name="pencil" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerLogo: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: { padding: 6 },
  tabsRow: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText: { fontSize: 15, fontWeight: '500', color: COLORS.textLight },
  activeTabText: { color: COLORS.primary, fontWeight: '700' },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadMoreIndicator: { padding: 16, alignItems: 'center' },
  emptyState: { flex: 1, alignItems: 'center', padding: 40, paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', marginBottom: 24 },
  discoverBtn: { backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
  discoverBtnText: { color: '#fff', fontWeight: '700' },
  fab: {
    position: 'absolute', right: 20,
    backgroundColor: COLORS.primary, borderRadius: 28,
    width: 56, height: 56,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
  },
});
