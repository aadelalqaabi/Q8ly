import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, SectionList,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchTrendingTopics, fetchAllTopics, toggleFollowTopic } from '../../store/slices/topicsSlice';
import { COLORS, SHADOWS, TOPIC_CATEGORIES } from '../../constants';

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
    ? [{ title: 'Results', data: filteredTopics }]
    : [
        { title: 'Trending Now', data: trendingTopics.slice(0, 10) },
        ...TOPIC_CATEGORIES.map((cat) => ({
          title: cat.label,
          data: allTopics.filter((t) => t.category === cat.key),
        })).filter((s) => s.data.length > 0),
      ];

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  const renderSection = ({ section }) => {
    return (
      <View style={styles.sectionCard}>
        {section.data.map((item, index) => {
          const isFollowing = followedTopics.includes(item._id);
          const isFirst = index === 0;
          const isLast = index === section.data.length - 1;
          return (
            <TouchableOpacity
              key={item._id}
              style={[
                styles.topicRow,
                isFirst && styles.topicRowFirst,
                isLast && styles.topicRowLast,
                !isFirst && styles.topicRowSeparator,
              ]}
              onPress={() => navigation.navigate('TopicDetail', { slug: item.slug, topic: item })}
              activeOpacity={0.7}
            >
              <View style={[styles.topicIcon, { backgroundColor: item.color || COLORS.primary }]}>
                <Text style={styles.topicIconText}>
                  {item.nameAr ? item.nameAr[0] : item.name[0]}
                </Text>
              </View>
              <View style={styles.topicInfo}>
                <Text style={styles.topicName}>{item.name}</Text>
                <Text style={styles.topicMeta}>
                  {item.nameAr ? `${item.nameAr} · ` : ''}
                  {item.followersCount?.toLocaleString()} followers
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.followBtn, isFollowing && styles.followingBtn]}
                onPress={() => dispatch(toggleFollowTopic(item._id))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // We use renderItem to return null and renderSectionHeader + a custom section renderer
  // Instead, use renderItem normally but wrap sections in a card via renderSectionHeader + sticky off
  const renderTopic = ({ item, index, section }) => {
    const isFollowing = followedTopics.includes(item._id);
    const isFirst = index === 0;
    const isLast = index === section.data.length - 1;

    return (
      <TouchableOpacity
        style={[
          styles.topicRow,
          isFirst && styles.topicRowFirst,
          isLast && styles.topicRowLast,
          !isFirst && styles.topicRowSeparator,
        ]}
        onPress={() => navigation.navigate('TopicDetail', { slug: item.slug, topic: item })}
        activeOpacity={0.7}
      >
        <View style={[styles.topicIcon, { backgroundColor: item.color || COLORS.primary }]}>
          <Text style={styles.topicIconText}>
            {item.nameAr ? item.nameAr[0] : item.name[0]}
          </Text>
        </View>
        <View style={styles.topicInfo}>
          <Text style={styles.topicName}>{item.name}</Text>
          <Text style={styles.topicMeta}>
            {item.nameAr ? `${item.nameAr} · ` : ''}
            {item.followersCount?.toLocaleString()} followers
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followingBtn]}
          onPress={() => dispatch(toggleFollowTopic(item._id))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Topics</Text>
        <Text style={styles.headerSub}>What Kuwait is talking about</Text>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search topics..."
            placeholderTextColor={COLORS.textMuted}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
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
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          style={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.sheet },

  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSub: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  searchBar: {
    marginHorizontal: -4,
    marginTop: 12,
    marginBottom: 0,
    backgroundColor: COLORS.fill,
    borderRadius: 12,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },

  list: { backgroundColor: COLORS.sheet },

  loader: { marginTop: 60 },

  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },

  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  topicRowFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  topicRowLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  topicRowSeparator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.separator,
  },

  topicIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topicIconText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },

  topicInfo: {
    flex: 1,
    marginLeft: 12,
  },
  topicName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  topicMeta: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 1,
  },

  followBtn: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: COLORS.accent,
  },
  followingBtn: {
    backgroundColor: COLORS.fill,
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.white,
  },
  followingBtnText: {
    color: COLORS.textSecondary,
  },
});
