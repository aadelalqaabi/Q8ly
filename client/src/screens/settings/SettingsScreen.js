import { useContext, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Modal, Alert, KeyboardAvoidingView,
  Platform, Share, TouchableOpacity, TextInput,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { changeAppLanguage } from '../../i18n';
import { AppRestartContext } from '../../context/AppRestartContext';
import { useTheme } from '../../context/ThemeContext';
import { logout, getMe } from '../../store/slices/authSlice';
import { suggestionsAPI, usersAPI } from '../../services/api';
import {
  BrutNav, BrutHero, BrutSection, BrutRow, BrutRule, BrutHair, BrutBrick, BrutInput,
  ACCENT, TEXT, MUTED, SEPARATOR, BG, isAr, ls, shout,
} from '../../components/Brut';

const THEME_KEYS = ['auto', 'light', 'dark'];

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { t, i18n } = useTranslation();
  const ar = isAr(i18n);
  const restartApp = useContext(AppRestartContext);
  const { scheme, setScheme } = useTheme();
  const { user: currentUser } = useSelector((s) => s.auth);
  const isFounder = currentUser?.phone === '+96599440289'
    || currentUser?.isFounder
    || /^\+965000000(0[1-9]|[1-4][0-9]|50)$/.test(currentUser?.phone || '');

  useEffect(() => { dispatch(getMe()); }, []);

  const [suggestVisible, setSuggestVisible] = useState(false);
  const [suggestText, setSuggestText] = useState('');
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleShareInvite = async (code) => {
    try {
      await Share.share({
        message: ar
          ? `انضم لكواي بكود الدعوة: ${code}\n\nhttps://kuwai.app`
          : `Join KUWAI with my invite code: ${code}\n\nhttps://kuwai.app`,
      });
    } catch {}
  };

  const handleSuggest = async () => {
    if (!suggestText.trim()) return;
    setSuggestLoading(true);
    try {
      await suggestionsAPI.submit(suggestText.trim(), 'feature');
      setSuggestText('');
      setSuggestVisible(false);
      Alert.alert(t('suggest.doneTitle'), t('suggest.doneMsg'));
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally { setSuggestLoading(false); }
  };

  const handleLogout = () => {
    Alert.alert(t('settings.title'), t('profile.exit') + '?', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.exit'),
        style: 'destructive',
        onPress: async () => {
          await dispatch(logout());
          navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(t('settings.deleteAccountTitle'), t('settings.deleteAccountMsg'), [
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
            Alert.alert(t('common.error'), e.message);
          }
        },
      },
    ]);
  };

  const themeLabel = (key) => {
    if (key === 'auto') return t('settings.themeAuto');
    if (key === 'light') return t('settings.themeLight');
    return t('settings.themeDark');
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <BrutNav onBack={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
      >
        <BrutHero title={t('settings.title')} label={ar ? 'الإعدادات' : 'CONTROL'} />
        <BrutRule mt={26} />

        {/* INVITES */}
        {currentUser?.inviteCodes?.length > 0 && (
          <>
            <BrutSection title={t('settings.invites')} />
            {currentUser.inviteCodes.map((invite, idx) => {
              const used = !!invite.used;
              return (
                <View key={invite.code}>
                  <View style={[styles.inviteRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[
                        styles.inviteCode,
                        used && { color: MUTED, textDecorationLine: 'line-through' },
                        { textAlign: ar ? 'right' : 'left' },
                      ]}>
                        {invite.code}
                      </Text>
                      <Text style={[styles.inviteStatus, { letterSpacing: ls(1.5, ar), textAlign: ar ? 'right' : 'left' }]}>
                        {used
                          ? shout(t('settings.inviteUsed'), ar)
                          : shout(t('settings.inviteAvailable'), ar)}
                      </Text>
                    </View>
                    {!used && (
                      <TouchableOpacity onPress={() => handleShareInvite(invite.code)}>
                        <Text style={[styles.shareLink, { letterSpacing: ls(2, ar) }]}>
                          {ar ? `← ${t('common.share')}` : `${shout(t('common.share'), false)} →`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {idx < currentUser.inviteCodes.length - 1 && <BrutHair />}
                </View>
              );
            })}
          </>
        )}

        {/* LANGUAGE */}
        <BrutSection title={t('settings.language')} />
        <BrutRow
          label="العربية"
          value={i18n.language === 'ar' ? '✓' : null}
          onPress={() => changeAppLanguage('ar', i18n, restartApp)}
          accent={i18n.language === 'ar'}
        />
        <BrutHair />
        <BrutRow
          label="English"
          value={i18n.language === 'en' ? '✓' : null}
          onPress={() => changeAppLanguage('en', i18n, restartApp)}
          accent={i18n.language === 'en'}
        />

        {/* APPEARANCE */}
        <BrutSection title={t('settings.appearance')} />
        {THEME_KEYS.map((key, idx) => (
          <View key={key}>
            <BrutRow
              label={themeLabel(key)}
              value={scheme === key ? '✓' : null}
              onPress={() => setScheme(key)}
              accent={scheme === key}
            />
            {idx < THEME_KEYS.length - 1 && <BrutHair />}
          </View>
        ))}

        {/* FEEDBACK */}
        <BrutSection title={t('settings.feedback') || 'Feedback'} />
        <BrutRow label={t('suggest.title')} onPress={() => setSuggestVisible(true)} />

        {/* DEVELOPER */}
        {isFounder && (
          <>
            <BrutSection title="Developer" />
            <BrutRow label="Dev Accounts" onPress={() => navigation.navigate('DeveloperAccounts')} />
          </>
        )}

        <BrutRule mt={36} mb={6} />

        {/* ACCOUNT */}
        <BrutSection title={t('settings.account') || 'Account'} />
        <BrutRow label={t('profile.exit')} onPress={handleLogout} danger />
        <BrutHair />
        <BrutRow
          label={t('settings.deleteAccount')}
          onPress={handleDelete}
          danger
          disabled={deleteLoading}
        />

        <View style={{ height: 40 }} />
        <Text style={[styles.version, { textAlign: ar ? 'right' : 'left' }]}>KUWAI · v1.1.3</Text>
      </ScrollView>

      {/* Suggest modal */}
      <Modal visible={suggestVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSuggestVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: BG }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <BrutNav
            onBack={() => setSuggestVisible(false)}
            leftLabel={t('common.cancel')}
            right={
              <TouchableOpacity onPress={handleSuggest} disabled={!suggestText.trim() || suggestLoading} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={[
                  styles.sendLink,
                  (!suggestText.trim() || suggestLoading) && { opacity: 0.35 },
                  { letterSpacing: ls(2, ar) },
                ]}>
                  {suggestLoading ? '...' : shout(t('suggest.send'), ar)}
                </Text>
              </TouchableOpacity>
            }
          />
          <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
            <BrutHero title={t('suggest.title')} label={ar ? 'اقتراحك' : 'YOUR IDEA'} size={42} />
            <BrutRule mt={22} />
            <BrutInput
              label={t('suggest.placeholder')}
              value={suggestText}
              onChangeText={setSuggestText}
              placeholder={ar ? '...' : '...'}
              multiline
              maxLength={500}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  inviteRow: {
    minHeight: 64, alignItems: 'center',
    paddingHorizontal: 4,
  },
  inviteCode: {
    fontSize: 22, fontWeight: '900', color: TEXT,
    fontVariant: ['tabular-nums'],
  },
  inviteStatus: {
    fontSize: 10, fontWeight: '800', color: MUTED, marginTop: 4,
  },
  shareLink: {
    fontSize: 12, fontWeight: '900', color: ACCENT,
  },
  sendLink: { fontSize: 12, fontWeight: '900', color: ACCENT },
  version: {
    fontSize: 10, fontWeight: '800', color: MUTED,
    letterSpacing: 1.5, marginTop: 24,
  },
});
