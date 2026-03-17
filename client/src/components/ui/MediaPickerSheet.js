import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
  Image, Animated, Dimensions, ActivityIndicator,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';

const { width: SCREEN_W } = Dimensions.get('window');
const COL = 3;
const GAP = 2;
const THUMB_SIZE = (SCREEN_W - GAP * (COL - 1)) / COL;

const FILTER_KEYS = ['all', 'photo', 'video'];

function fmtDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MediaPickerSheet({ visible, onClose, onSelect, maxItems = 4 }) {
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const FILTERS = [
    { key: 'all',   label: t('media.all') },
    { key: 'photo', label: t('media.photos') },
    { key: 'video', label: t('media.videos') },
  ];
  const styles = useMemo(() => makeStyles(COLORS, isRTL), [COLORS, isRTL]);

  const [permission, setPermission] = useState(null);
  const [assets, setAssets] = useState([]);
  const [uriCache, setUriCache] = useState({}); // assetId → localUri
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [endCursor, setEndCursor] = useState(null);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  // Animate in/out
  useEffect(() => {
    if (visible) {
      setSelected([]);
      setFilter('all');
      setUriCache({});
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 12 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      requestPermission();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const requestPermission = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    setPermission(status);
  };

  const loadAssets = useCallback(async (activeFilter, after = undefined) => {
    setLoading(true);
    const mediaType =
      activeFilter === 'photo' ? [MediaLibrary.MediaType.photo]
      : activeFilter === 'video' ? [MediaLibrary.MediaType.video]
      : [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video];
    try {
      const res = await MediaLibrary.getAssetsAsync({
        first: 60,
        after,
        mediaType,
        sortBy: MediaLibrary.SortBy.creationTime,
      });
      if (!after) setAssets(res.assets);
      else setAssets((prev) => [...prev, ...res.assets]);
      setHasNextPage(res.hasNextPage);
      setEndCursor(res.endCursor);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  // Resolve ph:// → file:// localUri for each loaded asset so Image can render them
  useEffect(() => {
    if (assets.length === 0) return;
    const unresolved = assets.filter((a) => !uriCache[a.id]);
    if (unresolved.length === 0) return;
    Promise.all(
      unresolved.map(async (a) => {
        try {
          const info = await MediaLibrary.getAssetInfoAsync(a, { shouldDownloadFromNetwork: false });
          return [a.id, info.localUri || a.uri];
        } catch {
          return [a.id, a.uri];
        }
      })
    ).then((entries) => {
      setUriCache((prev) => {
        const next = { ...prev };
        entries.forEach(([id, uri]) => { next[id] = uri; });
        return next;
      });
    });
  }, [assets]);

  // Reload when permission granted or filter changes
  useEffect(() => {
    if ((permission === 'granted' || permission === 'limited') && visible) {
      setAssets([]);
      setEndCursor(null);
      loadAssets(filter);
    }
  }, [filter, permission, visible]);

  const toggleSelect = (asset) => {
    setSelected((prev) => {
      const idx = prev.findIndex((a) => a.id === asset.id);
      if (idx >= 0) return prev.filter((a) => a.id !== asset.id);
      if (prev.length >= maxItems) return prev;
      return [...prev, asset];
    });
  };

  const confirm = async () => {
    setLoading(true);
    try {
      const full = await Promise.all(
        selected.map(async (a) => {
          const info = await MediaLibrary.getAssetInfoAsync(a);
          return {
            uri: info.localUri || info.uri,
            type: a.mediaType === 'video' ? 'video' : 'image',
            width: a.width,
            height: a.height,
            duration: a.duration || 0,
          };
        })
      );
      onSelect(full);
      onClose();
    } catch { /* silent */ }
    setLoading(false);
  };

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [800, 0],
  });

  const renderItem = ({ item }) => {
    const selIdx = selected.findIndex((a) => a.id === item.id);
    const isSelected = selIdx >= 0;
    const isMaxed = !isSelected && selected.length >= maxItems;
    const thumbUri = uriCache[item.id] || null;

    return (
      <TouchableOpacity
        style={styles.thumb}
        onPress={() => !isMaxed && toggleSelect(item)}
        activeOpacity={0.75}
      >
        {thumbUri
          ? <Image source={{ uri: thumbUri }} style={styles.thumbImg} />
          : <View style={[styles.thumbImg, { backgroundColor: COLORS.fill }]} />
        }

        {item.mediaType === 'video' && (
          <View style={styles.vidBadge}>
            <Ionicons name="play-circle" size={11} color="#fff" />
            <Text style={styles.vidDur}>{fmtDuration(item.duration)}</Text>
          </View>
        )}

        {isMaxed && <View style={styles.dimOverlay} />}

        {isSelected && (
          <>
            <View style={styles.tintOverlay} />
            <View style={styles.numBadge}>
              <Text style={styles.numText}>{selIdx + 1}</Text>
            </View>
          </>
        )}
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 8, transform: [{ translateY }] },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.cancelText}>{t('media.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('media.title')}</Text>
          <TouchableOpacity
            onPress={confirm}
            disabled={selected.length === 0 || loading}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {loading
              ? <ActivityIndicator size="small" color={COLORS.accent} />
              : <Text style={[styles.addText, selected.length === 0 && styles.addTextOff]}>
                  {selected.length > 0 ? `${t('media.add')} (${selected.length})` : t('media.add')}
                </Text>
            }
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, filter === f.key && styles.chipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Permission denied */}
        {permission !== 'granted' && permission !== 'limited' ? (
          <View style={styles.permView}>
            <Ionicons name="images-outline" size={44} color={COLORS.textMuted} />
            <Text style={styles.permMsg}>{t('media.permMsg')}</Text>
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnText}>{t('media.allowAccess')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Grid */
          <FlatList
            data={assets}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            numColumns={COL}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={null}
            columnWrapperStyle={{ gap: GAP }}
            contentContainerStyle={{ gap: GAP }}
            onEndReached={() => {
              if (hasNextPage && !loading) loadAssets(filter, endCursor);
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loading
                ? <ActivityIndicator size="small" color={COLORS.accent} style={{ padding: 16 }} />
                : null
            }
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyView}>
                  <Text style={styles.emptyText}>{t('media.noMedia')}</Text>
                </View>
              ) : null
            }
          />
        )}
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (C, isRTL) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: '88%',
    backgroundColor: C.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: C.separator,
    alignSelf: 'center',
    marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
  },
  cancelText: { fontSize: 16, color: C.accent, minWidth: 64 },
  title: { flex: 1, fontSize: 16, fontWeight: '600', color: C.text, textAlign: 'center' },
  addText: { fontSize: 16, fontWeight: '600', color: C.accent, textAlign: isRTL ? 'left' : 'right', minWidth: 64 },
  addTextOff: { opacity: 0.3 },

  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 16, backgroundColor: C.fill,
  },
  chipActive: { backgroundColor: C.accent },
  chipText: { fontSize: 13, fontWeight: '500', color: C.textMuted },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  thumb: {
    width: THUMB_SIZE, height: THUMB_SIZE,
  },
  thumbImg: { width: '100%', height: '100%' },

  vidBadge: {
    position: 'absolute', bottom: 5, start: 5,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2,
  },
  vidDur: { fontSize: 10, color: '#fff', fontWeight: '500' },

  tintOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,51,160,0.22)',
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  numBadge: {
    position: 'absolute', top: 6, right: 6,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.accent,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  numText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  permView: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 14, paddingHorizontal: 36,
  },
  permMsg: { fontSize: 15, color: C.textMuted, textAlign: 'center', lineHeight: 22 },
  permBtn: {
    backgroundColor: C.accent, borderRadius: 22,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  permBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  emptyView: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: C.textMuted },
});
