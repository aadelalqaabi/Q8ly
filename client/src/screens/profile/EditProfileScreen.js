import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { updateProfile } from '../../store/slices/authSlice';
import { uploadAPI } from '../../services/api';
import { COLORS, DISTRICTS } from '../../constants';

export default function EditProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);

  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [district, setDistrict] = useState(user?.district || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    setIsLoading(true);
    try {
      await dispatch(updateProfile({ name: name.trim(), bio: bio.trim(), district })).unwrap();
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={isLoading}>
          {isLoading
            ? <ActivityIndicator size="small" color={COLORS.primary} />
            : <Text style={styles.saveText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body}>
        <View style={styles.field}>
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            maxLength={50}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people about yourself..."
            multiline
            maxLength={160}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{bio.length}/160</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Governorate</Text>
          <View style={styles.districtOptions}>
            <TouchableOpacity
              style={[styles.districtOption, district === '' && styles.activeDistrict]}
              onPress={() => setDistrict('')}
            >
              <Text style={[styles.districtOptionText, district === '' && styles.activeDistrictText]}>Not specified</Text>
            </TouchableOpacity>
            {DISTRICTS.map((d) => (
              <TouchableOpacity
                key={d.value}
                style={[styles.districtOption, district === d.value && styles.activeDistrict]}
                onPress={() => setDistrict(d.value)}
              >
                <Text style={[styles.districtOptionText, district === d.value && styles.activeDistrictText]}>
                  {d.labelAr}
                </Text>
                <Text style={[styles.districtOptionSubText, district === d.value && styles.activeDistrictText]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  cancelText: { fontSize: 16, color: COLORS.textLight },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  saveText: { fontSize: 16, color: COLORS.primary, fontWeight: '700' },
  body: { padding: 16 },
  field: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 16, color: COLORS.text, backgroundColor: '#FAFAFA' },
  bioInput: { minHeight: 80 },
  charCount: { textAlign: 'right', fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  districtOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  districtOption: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  activeDistrict: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  districtOptionText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  districtOptionSubText: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  activeDistrictText: { color: '#fff' },
});
