import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usersAPI, topicsAPI, spacesAPI } from '../../services/api';
import UserCard from '../../components/profile/UserCard';
import { COLORS } from '../../constants';

const TABS = ['users', 'topics', 'spaces'];

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
    } catch (e) { /* silent */ } finally {
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
    >
      <View style={[styles.resultIcon, { backgroundColor: item.color + '20' }]}>
        <Text style={[styles.resultIconText, { color: item.color }]}>#</Text>
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName}>{item.name}</Text>
        <Text style={styles.resultMeta}>{item.followersCount?.toLocaleString()} followers</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  const renderSpace = ({ item }) => (
    <TouchableOpacity
      style={styles.resultRow}
      onPress={() => navigation.navigate('SpaceDetail', { slug: item.slug, space: item })}
    >
      <View style={[styles.resultIcon, { backgroundColor: (item.color || COLORS.secondary) + '20' }]}>
        <Ionicons name="people" size={18} color={item.color || COLORS.secondary} />
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName}>{item.name}</Text>
        <Text style={styles.resultMeta}>{item.type} · {item.membersCount?.toLocaleString()} members</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  const renderItem = (item) => {
    if (activeTab === 'users') return renderUser(item);
    if (activeTab === 'topics') return renderTopic(item);
    return renderSpace(item);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search Kuwait Now..."
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setHasSearched(false); }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {hasSearched && results[tab]?.length > 0 && (
                <Text style={styles.tabCount}> ({results[tab].length})</Text>
              )}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : !hasSearched ? (
        <View style={styles.prompt}>
          <Text style={styles.promptText}>Search for people, topics, or spaces</Text>
        </View>
      ) : activeResults.length === 0 ? (
        <View style={styles.noResults}>
          <Text style={styles.noResultsIcon}>🔍</Text>
          <Text style={styles.noResultsText}>No {activeTab} found for "{query}"</Text>
        </View>
      ) : (
        <FlatList
          data={activeResults}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFA', borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text },
  cancelBtn: { marginLeft: 10 },
  cancelBtnText: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  tabsRow: { flexDirection: 'row', backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: '500', color: COLORS.textLight },
  activeTabText: { color: COLORS.primary, fontWeight: '700' },
  tabCount: { fontSize: 12, color: COLORS.textMuted },
  prompt: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  promptText: { fontSize: 15, color: COLORS.textMuted, textAlign: 'center' },
  noResults: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  noResultsIcon: { fontSize: 48, marginBottom: 16 },
  noResultsText: { fontSize: 16, color: COLORS.textMuted, textAlign: 'center' },
  resultRow: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  resultIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  resultIconText: { fontSize: 20, fontWeight: '700' },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  resultMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
});
