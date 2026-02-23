import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Image, ActivityIndicator, Alert, FlatList,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { createPost } from '../../store/slices/postsSlice';
import { topicsAPI, uploadAPI } from '../../services/api';
import { COLORS, TOPIC_CATEGORIES } from '../../constants';

export default function CreatePostScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { createPostLoading, createPostError } = useSelector((s) => s.posts);

  const preselectedSpace = route.params?.spaceId;
  const preselectedSpaceName = route.params?.spaceName;

  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [topics, setTopics] = useState([]);
  const [showTopicPicker, setShowTopicPicker] = useState(false);
  const [visibility, setVisibility] = useState('public');
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  // Poll state
  const [isPoll, setIsPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);

  useEffect(() => {
    topicsAPI.getAll({ limit: 20 }).then((res) => setTopics(res.topics || []));
  }, []);

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library access to attach images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 4,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      setImages(result.assets.slice(0, 4));
    }
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleTopic = (topicId) => {
    setSelectedTopics((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId].slice(0, 3)
    );
  };

  const handleSubmit = async () => {
    if (!content.trim() && images.length === 0 && !isPoll) {
      Alert.alert('Empty post', 'Please add some content, images, or a poll.');
      return;
    }

    if (isPoll && pollOptions.filter((o) => o.trim()).length < 2) {
      Alert.alert('Poll error', 'Please add at least 2 poll options.');
      return;
    }

    try {
      let imageUrls = [];

      // Upload images first if any
      if (images.length > 0) {
        setIsUploadingImages(true);
        const formData = new FormData();
        images.forEach((img, i) => {
          formData.append('images', {
            uri: img.uri,
            type: 'image/jpeg',
            name: `image_${i}.jpg`,
          });
        });
        const uploadRes = await uploadAPI.images(formData);
        imageUrls = uploadRes.urls;
        setIsUploadingImages(false);
      }

      const postData = {
        content: content.trim(),
        type: isPoll ? 'poll' : images.length > 0 ? 'photo' : 'text',
        images: imageUrls,
        topicTags: selectedTopics,
        spaceTags: preselectedSpace ? [preselectedSpace] : [],
        visibility,
        ...(isPoll && {
          poll: {
            question: content.trim(),
            options: pollOptions.filter((o) => o.trim()).map((text) => ({ text })),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        }),
      };

      await dispatch(createPost(postData)).unwrap();
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to create post');
    }
  };

  const charCount = content.length;
  const isNearLimit = charCount > 400;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Post</Text>
        <TouchableOpacity
          style={[styles.postBtn, (createPostLoading || isUploadingImages) && styles.postBtnDisabled]}
          onPress={handleSubmit}
          disabled={createPostLoading || isUploadingImages}
        >
          {(createPostLoading || isUploadingImages)
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.postBtnText}>Post</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        {/* Author row */}
        <View style={styles.authorRow}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{user?.name?.[0] || '?'}</Text>
          </View>
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{user?.name}</Text>
            {preselectedSpaceName && (
              <Text style={styles.postingIn}>Posting in {preselectedSpaceName}</Text>
            )}
          </View>
        </View>

        {/* Text input */}
        <TextInput
          style={styles.textInput}
          value={content}
          onChangeText={setContent}
          placeholder="What's happening in Kuwait?"
          multiline
          maxLength={500}
          textAlignVertical="top"
          autoFocus
        />

        {/* Char count */}
        <Text style={[styles.charCount, isNearLimit && styles.charCountWarning]}>
          {500 - charCount}
        </Text>

        {/* Poll options */}
        {isPoll && (
          <View style={styles.pollSection}>
            <Text style={styles.pollTitle}>Poll Options</Text>
            {pollOptions.map((opt, i) => (
              <TextInput
                key={i}
                style={styles.pollInput}
                value={opt}
                onChangeText={(v) => {
                  const newOpts = [...pollOptions];
                  newOpts[i] = v;
                  setPollOptions(newOpts);
                }}
                placeholder={`Option ${i + 1}`}
                maxLength={80}
              />
            ))}
            {pollOptions.length < 4 && (
              <TouchableOpacity onPress={() => setPollOptions((p) => [...p, ''])} style={styles.addOptionBtn}>
                <Ionicons name="add" size={16} color={COLORS.primary} />
                <Text style={styles.addOptionText}>Add option</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Image preview */}
        {images.length > 0 && (
          <View style={styles.imagesRow}>
            {images.map((img, i) => (
              <View key={i} style={styles.imageThumb}>
                <Image source={{ uri: img.uri }} style={styles.thumbImage} />
                <TouchableOpacity style={styles.removeImage} onPress={() => removeImage(i)}>
                  <Ionicons name="close-circle" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Topic selector */}
        {showTopicPicker && (
          <View style={styles.topicPicker}>
            <Text style={styles.topicPickerTitle}>Select Topics (max 3)</Text>
            <View style={styles.topicChips}>
              {topics.map((topic) => (
                <TouchableOpacity
                  key={topic._id}
                  style={[styles.topicChip, { borderColor: topic.color }, selectedTopics.includes(topic._id) && { backgroundColor: topic.color }]}
                  onPress={() => toggleTopic(topic._id)}
                >
                  <Text style={[styles.topicChipText, { color: selectedTopics.includes(topic._id) ? '#fff' : topic.color }]}>
                    {topic.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Selected topics display */}
        {selectedTopics.length > 0 && (
          <View style={styles.selectedTopics}>
            {topics.filter((t) => selectedTopics.includes(t._id)).map((t) => (
              <View key={t._id} style={[styles.selectedTopicTag, { backgroundColor: t.color + '20' }]}>
                <Text style={[styles.selectedTopicTagText, { color: t.color }]}>#{t.slug}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarBtn} onPress={pickImages} disabled={isPoll || images.length >= 4}>
          <Ionicons name="image-outline" size={24} color={isPoll ? COLORS.border : COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={() => { setIsPoll(!isPoll); setImages([]); }}>
          <Ionicons name="bar-chart-outline" size={24} color={isPoll ? COLORS.primary : COLORS.textLight} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={() => setShowTopicPicker(!showTopicPicker)}>
          <Ionicons name="pricetag-outline" size={24} color={selectedTopics.length > 0 ? COLORS.primary : COLORS.textLight} />
          {selectedTopics.length > 0 && (
            <View style={styles.topicBadge}><Text style={styles.topicBadgeText}>{selectedTopics.length}</Text></View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.visibilityBtn}
          onPress={() => setVisibility(visibility === 'public' ? 'followers' : 'public')}
        >
          <Ionicons name={visibility === 'public' ? 'earth' : 'people'} size={16} color={COLORS.textLight} />
          <Text style={styles.visibilityText}>{visibility === 'public' ? 'Public' : 'Followers'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  cancelBtn: { padding: 4 },
  cancelBtnText: { fontSize: 16, color: COLORS.textLight },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  postBtn: { backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  postBtnDisabled: { opacity: 0.6 },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  body: { flex: 1, padding: 16 },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarInitial: { fontSize: 20, fontWeight: '700', color: '#fff' },
  authorInfo: {},
  authorName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  postingIn: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  textInput: { fontSize: 17, color: COLORS.text, lineHeight: 24, minHeight: 120 },
  charCount: { textAlign: 'right', fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  charCountWarning: { color: COLORS.error },
  pollSection: { marginTop: 16, padding: 12, backgroundColor: '#FAFAFA', borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  pollTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  pollInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, fontSize: 15, marginBottom: 8, backgroundColor: COLORS.white },
  addOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  addOptionText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  imagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  imageThumb: { width: 90, height: 90, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  thumbImage: { width: '100%', height: '100%' },
  removeImage: { position: 'absolute', top: 4, right: 4 },
  topicPicker: { marginTop: 12, padding: 12, backgroundColor: '#FAFAFA', borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  topicPickerTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  topicChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicChip: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 },
  topicChipText: { fontSize: 13, fontWeight: '600' },
  selectedTopics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  selectedTopicTag: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  selectedTopicTagText: { fontSize: 13, fontWeight: '600' },
  toolbar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.white },
  toolbarBtn: { padding: 8, position: 'relative', marginRight: 4 },
  topicBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: COLORS.primary, borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  topicBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  visibilityBtn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  visibilityText: { fontSize: 13, color: COLORS.textLight },
});
