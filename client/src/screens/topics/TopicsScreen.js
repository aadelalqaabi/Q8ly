import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, SectionList,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchTrendingTopics, fetchAllTopics, toggleFollowTopic } from '../../store/slices/topicsSlice';
import TopicChip from '../../components/topic/TopicChip';
import { COLORS, TOPIC_CATEGORIES } from '../../constants';

export default function TopicsScreen({ navigation }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { trendingTopics, allTopics, followedTopics, isLoading } = useSelector((s) => s.topics);
  const [search, setSearch] = useState('');

  useEffect(() => {
    dispatch(fetchTrendingTopics());
    dispatch(fetchAllTopics());
  }, []);

  const filteredTopics = search.trim()
    ? allTopics.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.nameAr && t.nameAr.includes(search))
      )
    : allTopics;

  const sections = search.trim()
    ? [{ title: 'Search Results', data: filteredTopics }]
    : [
        { title: '🔥 Trending Now', data: trendingTopics.slice(0, 10) },
        ...TOPIC_CATEGORIES.map((cat) => ({
          title: `${cat.icon ? '' : ''} ${cat.label}`,
          data: allTopics.filter((t) => t.category === cat.key),
        })).filter((s) => s.data.length > 0),
      ];

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  const renderTopic = ({ item }) => {
    const isFollowing = followedTopics.includes(item._id);
    return (
      <TouchableOpacity
        style={styles.topicRow}
        onPress={() => navigation.navigate('TopicDetail', { slug: item.slug, topic: item })}
      >
        <View style={[styles.topicIcon, { backgroundColor: item.color + '20' }]}>
          <Text style={[styles.topicIconText, { color: item.color }]}>
            {item.nameAr ? item.nameAr[0] : item.name[0]}
          </Text>
        </View>
        <View style={styles.topicInfo}>
          <Text style={styles.topicName}>{item.name}</Text>
          {item.nameAr && <Text style={styles.topicNameAr}>{item.nameAr}</Text>}
          <Text style={styles.topicFollowers}>
            {item.followersCount?.toLocaleString()} followers · {item.postsCount?.toLocaleString()} posts
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followingBtn]}
          onPress={() => dispatch(toggleFollowTopic(item._id))}
        >
          <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Topics</Text>
        <Text style={styles.headerSubtitle}>What Kuwait Is Talking About</Text>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search topics..."
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading && allTopics.length === 0 ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item._id}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderTopic}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.white, padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  headerSubtitle: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', margin: 12,
    backgroundColor: COLORS.white, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: COLORS.text },
  loader: { marginTop: 40 },
  sectionHeader: { backgroundColor: COLORS.background, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  topicRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  topicIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  topicIconText: { fontSize: 20, fontWeight: '700' },
  topicInfo: { flex: 1 },
  topicName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  topicNameAr: { fontSize: 13, color: COLORS.textLight, textAlign: 'right' },
  topicFollowers: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  followBtn: {
    borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  followingBtn: { backgroundColor: COLORS.primary },
  followBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  followingBtnText: { color: '#fff' },
});
