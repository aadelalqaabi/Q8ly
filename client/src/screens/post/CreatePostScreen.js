import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Image, ActivityIndicator, Alert,
  Keyboard, Animated, Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { createPost } from '../../store/slices/postsSlice';
import { uploadAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import MediaPickerSheet from '../../components/ui/MediaPickerSheet';
import { getPermissionStatus, registerForPushNotifications } from '../../services/notificationService';

function VideoPreview({ uri }) {
  const player = useVideoPlayer({ uri }, (p) => { p.pause(); });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

const PALETTE = ['#0033A0', '#007A3D', '#FF6B35', '#2196F3', '#9C27B0'];
function avatarBg(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export default function CreatePostScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const insets = useSafeAreaInsets();
  const { user } = useSelector((s) => s.auth);
  const { createPostLoading } = useSelector((s) => s.posts);
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS, isRTL), [COLORS, isRTL]);

  const [content, setContent] = useState('');
  // media: [{ uri, type: 'image'|'video', width, height, duration }]
  const [media, setMedia] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Poll state
  const [isPollMode, setIsPollMode] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollDuration, setPollDuration] = useState('1'); // days

  const toolbarBottom = useRef(new Animated.Value(insets.bottom)).current;

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => {
      Animated.timing(toolbarBottom, {
        toValue: e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });
    const hide = Keyboard.addListener('keyboardWillHide', (e) => {
      Animated.timing(toolbarBottom, {
        toValue: insets.bottom,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, [insets.bottom]);

  const charRemaining = 500 - content.length;
  const pollValid = pollQuestion.trim().length > 0 && pollOptions.filter(o => o.trim()).length >= 2;
  const canPost = isPollMode ? pollValid : (content.trim().length > 0 || media.length > 0);
  const isBusy = createPostLoading || isUploading;

  const togglePoll = () => {
    setIsPollMode(p => {
      if (!p) setMedia([]); // clear media when entering poll mode
      return !p;
    });
  };

  const updatePollOption = (index, text) => {
    setPollOptions(prev => prev.map((o, i) => i === index ? text : o));
  };

  const addPollOption = () => {
    if (pollOptions.length < 4) setPollOptions(prev => [...prev, '']);
  };

  const removePollOption = (index) => {
    if (pollOptions.length <= 2) return;
    setPollOptions(prev => prev.filter((_, i) => i !== index));
  };

  const handleMediaSelect = (items) => {
    setMedia(items.slice(0, 4));
  };

  const removeMedia = (index) => {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const takeFromCamera = async () => {
    if (media.length >= 4) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('post.permRequired'), t('post.photoPermission'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All, // photo + video
      quality: 0.85,
      videoMaxDuration: 60,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      const isVideo = asset.type === 'video';
      // If already have a video or trying to add video when images exist, replace
      const newItem = {
        uri: asset.uri,
        type: isVideo ? 'video' : 'image',
        width: asset.width || 0,
        height: asset.height || 0,
        duration: asset.duration || 0,
      };
      if (isVideo) {
        // Only one video at a time; replace everything with just this video
        setMedia([newItem]);
      } else {
        // Add photo (up to 4, can't mix with video)
        setMedia((prev) => {
          const noVideos = prev.filter((m) => m.type === 'image');
          return [...noVideos, newItem].slice(0, 4);
        });
      }
    }
  };

  const pickFromFiles = async () => {
    if (media.length >= 4) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'video/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const newItems = result.assets.map((asset) => {
        const isVideo = asset.mimeType?.startsWith('video/');
        return {
          uri: asset.uri,
          type: isVideo ? 'video' : 'image',
          width: 0,
          height: 0,
          duration: 0,
        };
      });

      const hasVideo = newItems.some((m) => m.type === 'video');
      if (hasVideo) {
        // Video: use only first video, replace all existing media
        const vid = newItems.find((m) => m.type === 'video');
        setMedia([vid]);
      } else {
        // Photos: append, capped at 4, drop any existing video
        setMedia((prev) => {
          const existing = prev.filter((m) => m.type === 'image');
          return [...existing, ...newItems].slice(0, 4);
        });
      }
    } catch { /* silent — user cancelled */ }
  };

  const promptNotificationsIfNeeded = async () => {
    const status = await getPermissionStatus();
    if (status !== 'granted') {
      Alert.alert(
        t('post.notifLoopTitle'),
        t('post.notifLoopMsg'),
        [
          { text: t('post.notifNotNow'), style: 'cancel' },
          { text: t('post.notifEnable'), onPress: () => registerForPushNotifications() },
        ]
      );
    }
  };

  const handleSubmit = async () => {
    if (!canPost || isBusy) return;
    try {
      if (isPollMode) {
        const options = pollOptions.filter(o => o.trim()).map(o => ({ text: o.trim() }));
        const expiresAt = new Date(Date.now() + parseInt(pollDuration) * 24 * 60 * 60 * 1000);
        await dispatch(createPost({
          content: content.trim(),
          type: 'poll',
          poll: { question: pollQuestion.trim(), options, expiresAt },
        })).unwrap();
        navigation.goBack();
        promptNotificationsIfNeeded();
        return;
      }

      let imageUrls = [];
      let videoUrl = null;
      let videoThumbnail = null;

      const images = media.filter((m) => m.type === 'image');
      const videos = media.filter((m) => m.type === 'video');

      if (images.length > 0) {
        setIsUploading(true);
        setUploadProgress(t('post.uploadingPhotos'));
        const formData = new FormData();
        images.forEach((img, i) => {
          formData.append('images', { uri: img.uri, type: 'image/jpeg', name: `img_${i}.jpg` });
        });
        const res = await uploadAPI.images(formData);
        imageUrls = res.urls;
      }

      let videoWidth = 0;
      let videoHeight = 0;

      if (videos.length > 0) {
        setIsUploading(true);
        setUploadProgress(t('post.uploadingVideo'));
        const vid = videos[0];
        const formData = new FormData();
        formData.append('video', { uri: vid.uri, type: 'video/mp4', name: 'video.mp4' });
        const res = await uploadAPI.video(formData);
        videoUrl = res.url;
        videoThumbnail = res.thumbnail;
        // Prefer server-returned dimensions; fall back to local asset dimensions
        videoWidth = res.width || vid.width || 0;
        videoHeight = res.height || vid.height || 0;
      }

      setUploadProgress(t('post.publishing'));
      const type = videos.length > 0 ? 'video' : images.length > 0 ? 'photo' : 'text';
      await dispatch(createPost({
        content: content.trim(),
        type,
        images: imageUrls,
        video: videoUrl,
        videoThumbnail,
        videoWidth,
        videoHeight,
      })).unwrap();
      navigation.goBack();
      promptNotificationsIfNeeded();
    } catch (e) {
      setIsUploading(false);
      setUploadProgress('');
      Alert.alert(t('common.error'), e.message || t('post.postError'));
    }
  };

  // Separate images and videos for previewing
  const imageItems = media.filter((m) => m.type === 'image');
  const videoItem  = media.find((m) => m.type === 'video');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.cancel}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[styles.postBtn, (!canPost || isBusy) && styles.postBtnOff]}
          onPress={handleSubmit}
          disabled={!canPost || isBusy}
        >
          {isBusy
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.postBtnText}>{t('post.publish')}</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Upload status */}
      {isUploading && uploadProgress ? (
        <View style={styles.uploadBar}>
          <ActivityIndicator size="small" color={COLORS.accent} style={{ marginEnd: 8 }} />
          <Text style={styles.uploadText}>{uploadProgress}</Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 72 }}
      >
        {/* Compose row */}
        <View style={styles.composeRow}>
          {user?.profilePic ? (
            <Image source={{ uri: user.profilePic }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: avatarBg(user?.name) }]}>
              <Text style={styles.avatarInitial}>{user?.name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
          )}
          <TextInput
            style={styles.textInput}
            value={content}
            onChangeText={setContent}
            placeholder={t('post.placeholder')}
            placeholderTextColor={COLORS.textPlaceholder}
            multiline
            maxLength={500}
            autoFocus
            textAlignVertical="top"
          />
        </View>

        {/* Image previews */}
        {imageItems.length > 0 && (
          <View style={styles.previewGrid}>
            {imageItems.map((img, i) => (
              <View key={i} style={styles.previewItem}>
                <Image source={{ uri: img.uri }} style={styles.previewImg} />
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeMedia(media.indexOf(img))}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <View style={styles.removeBadge}>
                    <Ionicons name="close" size={12} color="#fff" />
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Video preview */}
        {videoItem && (
          <View style={[
            styles.videoPreview,
            { aspectRatio: (videoItem.width && videoItem.height) ? videoItem.width / videoItem.height : 16 / 9 },
          ]}>
            <VideoPreview uri={videoItem.uri} />
            <TouchableOpacity
              style={styles.removeVideoBtn}
              onPress={() => removeMedia(media.indexOf(videoItem))}
            >
              <View style={styles.removeBadge}>
                <Ionicons name="close" size={13} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Poll builder */}
        {isPollMode && (
          <View style={styles.pollBuilder}>
            {/* Question */}
            <TextInput
              style={styles.pollQuestion}
              value={pollQuestion}
              onChangeText={setPollQuestion}
              placeholder={t('post.pollQuestion')}
              placeholderTextColor={COLORS.textPlaceholder}
              maxLength={120}
              returnKeyType="next"
            />

            {/* Options */}
            {pollOptions.map((opt, i) => (
              <View key={i} style={styles.pollOptionRow}>
                <TextInput
                  style={styles.pollOptionInput}
                  value={opt}
                  onChangeText={(t) => updatePollOption(i, t)}
                  placeholder={i >= 2 ? t('post.pollChoiceOptional', { n: i + 1 }) : t('post.pollChoice', { n: i + 1 })}
                  placeholderTextColor={COLORS.textPlaceholder}
                  maxLength={60}
                  returnKeyType="next"
                />
                {pollOptions.length > 2 && (
                  <TouchableOpacity onPress={() => removePollOption(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {/* Add option */}
            {pollOptions.length < 4 && (
              <TouchableOpacity style={styles.addOptionBtn} onPress={addPollOption}>
                <Ionicons name="add" size={16} color={COLORS.accent} />
                <Text style={styles.addOptionText}>{t('post.addChoice')}</Text>
              </TouchableOpacity>
            )}

            {/* Duration */}
            <View style={styles.durationRow}>
              <Text style={styles.durationLabel}>{t('post.duration')}</Text>
              <View style={styles.durationChips}>
                {[['1', t('post.durationDay')], ['3', t('post.durationDays', { n: 3 })], ['7', t('post.durationDays', { n: 7 })]].map(([val, label]) => (
                  <TouchableOpacity
                    key={val}
                    style={[styles.durationChip, pollDuration === val && styles.durationChipActive]}
                    onPress={() => setPollDuration(val)}
                  >
                    <Text style={[styles.durationChipText, pollDuration === val && styles.durationChipTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Toolbar */}
      <Animated.View style={[styles.toolbar, { bottom: toolbarBottom }]}>
        {/* Gallery button */}
        <TouchableOpacity
          onPress={() => setPickerVisible(true)}
          style={styles.toolBtn}
          disabled={isPollMode || media.length >= 4}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons
            name="image-outline"
            size={24}
            color={isPollMode || media.length >= 4 ? COLORS.textMuted : COLORS.accent}
          />
        </TouchableOpacity>

        {/* Camera button */}
        <TouchableOpacity
          onPress={takeFromCamera}
          style={styles.toolBtn}
          disabled={isPollMode || media.length >= 4}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons
            name="camera-outline"
            size={24}
            color={isPollMode || media.length >= 4 ? COLORS.textMuted : COLORS.accent}
          />
        </TouchableOpacity>

        {/* Files app button */}
        <TouchableOpacity
          onPress={pickFromFiles}
          style={styles.toolBtn}
          disabled={isPollMode || media.length >= 4}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons
            name="folder-outline"
            size={24}
            color={isPollMode || media.length >= 4 ? COLORS.textMuted : COLORS.accent}
          />
        </TouchableOpacity>

        {/* Poll toggle */}
        <TouchableOpacity
          onPress={togglePoll}
          style={[styles.toolBtn, isPollMode && styles.toolBtnActive]}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons
            name="bar-chart-outline"
            size={22}
            color={isPollMode ? '#fff' : COLORS.accent}
          />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {/* Char counter */}
        <Text style={[styles.charCount, charRemaining <= 50 && styles.charCountWarn]}>
          {charRemaining}
        </Text>
      </Animated.View>

      {/* Custom media picker */}
      <MediaPickerSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handleMediaSelect}
        maxItems={4}
      />
    </View>
  );
}

const makeStyles = (C, isRTL) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.white },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
  },
  cancel: { fontSize: 17, color: C.accent },
  postBtn: {
    backgroundColor: C.accent, borderRadius: 20,
    paddingHorizontal: 16, height: 34,
    justifyContent: 'center', alignItems: 'center', minWidth: 60,
  },
  postBtnOff: { opacity: 0.4 },
  postBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  uploadBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: C.fill,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
  },
  uploadText: { fontSize: 13, color: C.textMuted },

  body: { flex: 1 },
  composeRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, gap: 10,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  avatarInitial: { fontSize: 14, fontWeight: '700', color: '#fff' },
  textInput: {
    flex: 1, fontSize: 17, color: C.text, lineHeight: 24,
    minHeight: 100, paddingTop: 0,
    textAlign: isRTL ? 'right' : 'left',
  },

  previewGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 6, paddingHorizontal: 16, paddingTop: 12,
  },
  previewItem: { position: 'relative' },
  previewImg: { width: 90, height: 90, borderRadius: 10 },
  removeBtn: { position: 'absolute', top: -6, end: -6 },
  removeBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },

  videoPreview: {
    marginHorizontal: 16, marginTop: 12,
    borderRadius: 12, overflow: 'hidden',
    width: '100%',
  },
  removeVideoBtn: { position: 'absolute', top: 8, end: 8 },

  toolbar: {
    position: 'absolute',
    left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.separator,
    backgroundColor: C.white,
  },
  toolBtn: {
    width: 40, height: 40, justifyContent: 'center', alignItems: 'center',
  },
  toolBtnActive: {
    backgroundColor: C.accent,
    borderRadius: 10,
  },
  charCount: { fontSize: 13, color: C.textMuted },
  charCountWarn: { color: C.error, fontWeight: '600' },

  // Poll builder
  pollBuilder: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: C.fill,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  pollQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.separator,
  },
  pollOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pollOptionInput: {
    flex: 1,
    fontSize: 15,
    color: C.text,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.separator,
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  addOptionText: { fontSize: 14, color: C.accent, fontWeight: '500' },

  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 10,
  },
  durationLabel: { fontSize: 13, color: C.textMuted, fontWeight: '500' },
  durationChips: { flexDirection: 'row', gap: 6 },
  durationChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.separator,
    backgroundColor: C.white,
  },
  durationChipActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  durationChipText: { fontSize: 12, color: C.textMuted, fontWeight: '500' },
  durationChipTextActive: { color: '#fff' },
});
