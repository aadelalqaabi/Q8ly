import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usersAPI, topicsAPI, spacesAPI } from '../../services/api';
import UserCard from '../../components/profile/UserCard';
import { COLORS, SHADOWS } from '../../constants';

const TABS = ['users', 'topics', 'spaces'];
const TAB_LABELS = { users: 'People', topics: 'Topics', spaces: 'Spaces' };

export default function SearchScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [results, setResults] = useState({ users: [], topics: [], spaces: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const performSearch = useCallback(async (q) => {
    if (q.trim().length < 2) return;
    setIsLoading(true);
    setHasSearched(true);
    try {
      const [usersRes, topicsRes, spacesRes] = await Promise.allSettled([
        usersAPI.searchUsers(q),
        topicsAPI.search(q),
        spacesAPI.search(q),
      ]);
      setResults({
        users: usersRes.status === 'fulfilled' ? usersRes.value.users : [],
        topics: topicsRes.status === 'fulfilled' ? topicsRes.value.topics : [],
        spaces: spacesRes.status === 'fulfilled' ? spacesRes.value.spaces : [],
      });
    } catch { /* silent */ } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSearch = () => performSearch(query);
  const activeResults = results[activeTab] || [];

  const renderUser = ({ item }) => <UserCard user={item} navigation={navigation} />;

  const renderTopic = ({ item }) => (
    <TouchableOpacity
      style={styles.resultRow}
      onPress={() => navigation.navigate('TopicDetail', { slug: item.slug, topic: item })}
      activeOpacity={0.7}
    >
      <View style={[styles.resultIconCircle, { backgroundColor: item.color || COLORS.primary }]}>
        <Text style={styles.resultIconHash}>#</Text>
      </View>
      <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.resultCount}>{item.followersCount?.toLocaleString()}</Text>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  const renderSpace = ({ item }) => (
    <TouchableOpacity
      style={styles.resultRow}
      onPress={() => navigation.navigate('SpaceDetail', { slug: item.slug, space: item })}
      activeOpacity={0.7}
    >
      <View style={[styles.resultIconCircle, { backgroundColor: item.color || COLORS.primary }]}>
        <Ionicons name="people" size={20} color="#FFF" />
      </View>
      <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.resultCount}>{item.membersCount?.toLocaleString()}</Text>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  const renderItem = (item) => {
    if (activeTab === 'users') return renderUser(item);
    if (activeTab === 'topics') return renderTopic(item);
    return renderSpace(item);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search Kuwait Now..."
            placeholderTextColor={COLORS.textMuted}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => { setQuery(''); setHasSearched(false); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Tab pills */}
      <View style={styles.tabsContainer}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {TAB_LABELS[tab]}
              {hasSearched && results[tab]?.length > 0 ? ` (${results[tab].length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 60 }} />
      ) : !hasSearched ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="search-outline" size={28} color={COLORS.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Search Kuwait Now</Text>
          <Text style={styles.emptySubtitle}>Find people, topics, and spaces</Text>
        </View>
      ) : activeResults.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="search-outline" size={28} color={COLORS.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No results</Text>
          <Text style={styles.emptySubtitle}>
            No {TAB_LABELS[activeTab].toLowerCase()} found for "{query}"
          </Text>
        </View>
      ) : (
        <FlatList
          data={activeResults}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          style={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.sheet,
  },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.fill,
    borderRadius: 12,
    height: 40,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
  },
  cancelBtn: {
    marginLeft: 12,
  },
  cancelBtnText: {
    fontSize: 16,
    color: COLORS.accent,
    fontWeight: '500',
  },
  tabsContainer: {
    backgroundColor: COLORS.fill,
    margin: 12,
    borderRadius: 20,
    padding: 3,
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    height: 34,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: COLORS.white,
    ...SHADOWS.card,
  },
  tabText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  activeTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  list: {
    backgroundColor: COLORS.sheet,
  },
  resultRow: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginBottom: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resultIconHash: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  resultCount: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginRight: 6,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.fill,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
