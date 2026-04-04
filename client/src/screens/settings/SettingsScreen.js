import { useContext, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { changeAppLanguage } from '../../i18n';
import { AppRestartContext } from '../../context/AppRestartContext';
import { useTheme } from '../../context/ThemeContext';
import { logout } from '../../store/slices/authSlice';
import BottomMenu from '../../components/ui/BottomMenu';
import { suggestionsAPI, usersAPI } from '../../services/api';
import { useSelector } from 'react-redux';

const THEME_OPTIONS = [
  { key: 'auto',  icon: 'phone-portrait-outline', labelKey: 'settings.themeAuto'  },
  { key: 'light', icon: 'sunny-outline',           labelKey: 'settings.themeLight' },
  { key: 'dark',  icon: 'moon-outline',            labelKey: 'settings.themeDark'  },
];

function SectionLabel({ label, colors, isRTL }) {
  return <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8, letterSpacing: 0.2, textAlign: isRTL ? 'right' : 'left' }}>{label}</Text>;
}

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const isRTL = lang === 'ar';
  const restartApp = useContext(AppRestartContext);
  const { colors, scheme, setScheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isRTL), [colors, isRTL]);
  const { user: currentUser } = useSelector((s) => s.auth);
  const isFounder = currentUser?.phone === '+96599440289'
    || currentUser?.isFounder
    || /^\+965000000(0[1-9]|[1-4][0-9]|50)$/.test(currentUser?.phone || '');

  const [logoutMenuVisible, setLogoutMenuVisible] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const defaultNotifSettings = currentUser?.notificationSettings || {
    pins: true, reactions: true, follows: true,
  };
  const allOn = Object.values(defaultNotifSettings).every(Boolean);
  const [notifSettings, setNotifSettings] = useState(defaultNotifSettings);
  const [notifAllOn, setNotifAllOn] = useState(allOn);

  const handleNotifToggle = async (key, value) => {
    const next = { ...notifSettings, [key]: value };
    setNotifSettings(next);
    try {
      await usersAPI.updateNotificationSettings({ [key]: value });
    } catch {
      setNotifSettings(notifSettings); // revert on error
    }
  };

  const handleNotifAllToggle = async (value) => {
    setNotifAllOn(value);
    const next = { pins: value, reactions: value, follows: value };
    setNotifSettings(next);
    try {
      await usersAPI.updateNotificationSettings(next);
    } catch {
      setNotifAllOn(!value);
      setNotifSettings(notifSettings);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('settings.deleteAccountTitle'),
      t('settings.deleteAccountMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.deleteAccountConfirm'),
          style: 'destructive',
          onPress: async () => {
            setDeleteLoading(true);
            try {
              await usersAPI.deleteAccount();
              await dispatch(logout());
              navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
            } catch (e) {
              setDeleteLoading(false);
              Alert.alert(t('common.error'), e.message || t('common.somethingWrong'));
            }
          },
        },
      ]
    );
  };
  const [suggestVisible, setSuggestVisible] = useState(false);
  const [suggestText, setSuggestText] = useState('');
  const [suggestCategory, setSuggestCategory] = useState('feature');
  const [suggestLoading, setSuggestLoading] = useState(false);

  const SUGGEST_CATEGORIES = [
    { key: 'feature', label: t('suggest.catFeature') },
    { key: 'bug',     label: t('suggest.catBug') },
    { key: 'design',  label: t('suggest.catDesign') },
    { key: 'content', label: t('suggest.catContent') },
    { key: 'other',   label: t('suggest.catOther') },
  ];

  const handleSuggestSubmit = async () => {
    if (!suggestText.trim()) return;
    setSuggestLoading(true);
    try {
      await suggestionsAPI.submit(suggestText.trim(), suggestCategory);
      setSuggestVisible(false);
      setSuggestText('');
      setSuggestCategory('feature');
      Alert.alert(t('suggest.doneTitle'), t('suggest.doneMsg'));
    } catch (e) {
      Alert.alert(t('common.error'), e.message || t('suggest.errorMsg'));
    } finally {
      setSuggestLoading(false);
    }
  };

  const logoutOptions = [
    {
      label: t('profile.exit'),
      destructive: true,
      onPress: async () => {
        await dispatch(logout());
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      },
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* Appearance section */}
        <SectionLabel label={t('settings.appearance')} colors={colors} isRTL={isRTL} />
        <View style={styles.card}>

          {/* Language */}
          <View style={styles.langCard}>
            <View style={styles.rowHeader}>
              <Ionicons name="language-outline" size={22} color={colors.textMuted} />
              <Text style={styles.rowHeaderLabel}>{t('settings.language')}</Text>
            </View>
            <View style={styles.segmentRow}>
              {['ar', 'en'].map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.segmentPill, lang === l && styles.segmentPillActive]}
                  onPress={() => changeAppLanguage(l, i18n, restartApp)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.segmentPillText, lang === l && styles.segmentPillTextActive]}>
                    {l === 'ar' ? t('settings.arabic') : t('settings.english')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Theme */}
          <View style={styles.langCard}>
            <View style={styles.rowHeader}>
              <Ionicons name="contrast-outline" size={22} color={colors.textMuted} />
              <Text style={styles.rowHeaderLabel}>{t('settings.theme')}</Text>
            </View>
            <View style={styles.segmentRow}>
              {THEME_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.segmentPill, styles.segmentPillThird, scheme === opt.key && styles.segmentPillActive]}
                  onPress={() => setScheme(opt.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={opt.icon}
                    size={16}
                    color={scheme === opt.key ? colors.white : colors.textMuted}
                  />
                  <Text style={[styles.segmentPillText, scheme === opt.key && styles.segmentPillTextActive]}>
                    {t(opt.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

        </View>

        {/* Feedback section */}
        <SectionLabel label={t('suggest.support')} colors={colors} isRTL={isRTL} />
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => setSuggestVisible(true)} activeOpacity={0.7}>
            <View style={[styles.rowIcon, { backgroundColor: '#EEF2FA' }]}>
              <Ionicons name="bulb-outline" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{t('suggest.title')}</Text>
              <Text style={styles.rowSub}>{t('suggest.sub')}</Text>
            </View>
            <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Notifications section */}
        <SectionLabel label={t('settings.notifications')} colors={colors} isRTL={isRTL} />
        <View style={styles.card}>
          {/* Master toggle */}
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: '#EEF2FA' }]}>
              <Ionicons name="notifications-outline" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{t('settings.notifAll')}</Text>
              <Text style={styles.rowSub}>{t('settings.notifAllSub')}</Text>
            </View>
            <Switch
              value={notifAllOn}
              onValueChange={handleNotifAllToggle}
              trackColor={{ false: colors.separator, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>

          {[
            { key: 'pins',      icon: 'pin-outline',         labelKey: 'notifPins',      subKey: 'notifPinsSub' },
            { key: 'reactions', icon: 'heart-outline',       labelKey: 'notifReactions', subKey: 'notifReactionsSub' },
            { key: 'follows',   icon: 'person-add-outline',  labelKey: 'notifFollows',   subKey: 'notifFollowsSub' },
          ].map(({ key, icon, labelKey, subKey }, i, arr) => (
            <View key={key}>
              <View style={styles.divider} />
              <View style={[styles.row, !notifAllOn && { opacity: 0.4 }]}>
                <View style={[styles.rowIcon, { backgroundColor: colors.fill }]}>
                  <Ionicons name={icon} size={22} color={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{t(`settings.${labelKey}`)}</Text>
                  <Text style={styles.rowSub}>{t(`settings.${subKey}`)}</Text>
                </View>
                <Switch
                  value={notifSettings[key] && notifAllOn}
                  onValueChange={(v) => handleNotifToggle(key, v)}
                  disabled={!notifAllOn}
                  trackColor={{ false: colors.separator, true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          ))}
        </View>

        {/* Developer — founder & dummy accounts only */}
        {isFounder && (
          <>
            <SectionLabel label="Developer" colors={colors} isRTL={isRTL} />
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => navigation.navigate('DeveloperAccounts')}
                activeOpacity={0.7}
              >
                <View style={[styles.rowIcon, { backgroundColor: '#1c1c1e' }]}>
                  <Ionicons name="people" size={20} color="#CBA052" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Dummy Accounts</Text>
                  <Text style={styles.rowSub}>Switch between test accounts</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Account section */}
        <SectionLabel label={t('settings.account')} colors={colors} isRTL={isRTL} />
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => setLogoutMenuVisible(true)} activeOpacity={0.6}>
            <View style={styles.rowIconDestructive}>
              <Ionicons name="log-out-outline" size={22} color={colors.error} />
            </View>
            <Text style={styles.rowLabelDestructive}>{t('settings.signOut')}</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={handleDeleteAccount} activeOpacity={0.6} disabled={deleteLoading}>
            <View style={[styles.rowIconDestructive, { backgroundColor: '#FFF2F2' }]}>
              {deleteLoading
                ? <ActivityIndicator size="small" color={colors.error} />
                : <Ionicons name="trash-outline" size={22} color={colors.error} />
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabelDestructive}>{t('settings.deleteAccount')}</Text>
              <Text style={[styles.rowSub, { color: colors.error, opacity: 0.7 }]}>{t('settings.deleteAccountSub')}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Suggest Feature Modal */}
      <Modal
        visible={suggestVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSuggestVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: colors.white }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={[styles.modalHeader, { paddingTop: 16 }]}>
            <TouchableOpacity onPress={() => setSuggestVisible(false)}>
              <Text style={{ fontSize: 17, color: colors.accent }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text, flex: 1, textAlign: 'center' }}>
              {t('suggest.modalTitle')}
            </Text>
            <TouchableOpacity
              onPress={handleSuggestSubmit}
              disabled={!suggestText.trim() || suggestLoading}
              style={[styles.sendBtn, (!suggestText.trim() || suggestLoading) && { opacity: 0.4 }]}
            >
              {suggestLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>{t('suggest.send')}</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            {/* Category picker */}
            <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textMuted, marginBottom: 10 }}>
                {t('suggest.type')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SUGGEST_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    onPress={() => setSuggestCategory(cat.key)}
                    style={[
                      styles.catChip,
                      suggestCategory === cat.key && { backgroundColor: '#EEF2FA', borderColor: colors.accent },
                    ]}
                  >
                    <Text style={[
                      styles.catChipLabel,
                      suggestCategory === cat.key && { color: colors.accent, fontWeight: '600' },
                    ]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Text input */}
            <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textMuted, marginBottom: 10 }}>
                {t('suggest.yourSuggestion')}
              </Text>
              <TextInput
                style={[styles.suggestInput, { color: colors.text, backgroundColor: colors.fill }]}
                placeholder={t('suggest.placeholder')}
                placeholderTextColor={colors.textMuted}
                value={suggestText}
                onChangeText={setSuggestText}
                multiline
                maxLength={1000}
                autoFocus
                textAlignVertical="top"
              />
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 6, textAlign: 'right' }}>
                {suggestText.length}/1000
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <BottomMenu
        visible={logoutMenuVisible}
        onClose={() => setLogoutMenuVisible(false)}
        title={t('profile.signOutMsg')}
        options={logoutOptions}
      />
    </View>
  );
}

const makeStyles = (C, isRTL) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
    backgroundColor: C.white,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: C.text, textAlign: 'center' },

  card: {
    backgroundColor: C.white,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginHorizontal: 16 },

  langCard: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },

  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  rowHeaderLabel: { fontSize: 15, fontWeight: '600', color: C.text },

  segmentRow: {
    flexDirection: 'row',
    backgroundColor: C.fill,
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  segmentPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  segmentPillThird: { flex: 1 },
  segmentPillActive: {
    backgroundColor: C.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentPillText: { fontSize: 13, fontWeight: '500', color: C.textMuted },
  segmentPillTextActive: { color: '#fff', fontWeight: '600' },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: 15, color: C.text, fontWeight: '500', textAlign: isRTL ? 'right' : 'left' },
  rowSub: { fontSize: 12, color: C.textMuted, marginTop: 1, textAlign: isRTL ? 'right' : 'left' },
  rowIconDestructive: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#EEF2FA', justifyContent: 'center', alignItems: 'center',
  },
  rowLabelDestructive: { flex: 1, fontSize: 15, color: C.error, textAlign: isRTL ? 'right' : 'left' },

  // Suggestion modal
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator,
  },
  sendBtn: {
    backgroundColor: C.accent, borderRadius: 20,
    paddingHorizontal: 16, height: 34,
    justifyContent: 'center', alignItems: 'center',
  },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: C.fill, borderWidth: 1.5, borderColor: 'transparent',
  },
  catChipLabel: { fontSize: 13, fontWeight: '500', color: C.textMuted },
  suggestInput: {
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, minHeight: 140,
  },
});
