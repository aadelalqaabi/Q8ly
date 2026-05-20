import React, { useEffect, useMemo, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useDispatch, useSelector } from 'react-redux';
import { View, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { restoreSession, claimDailyBonus } from '../store/slices/authSlice';
import { upsertCurrentAccount } from '../utils/accountsStore';
import { GuestGateProvider } from '../context/GuestGateContext';
import { addNotificationRealtime } from '../store/slices/notificationsSlice';
// import { addRealtimeMessage, updateConversationAccepted } from '../store/slices/dmSlice'; // DMs disabled
import { getSocket } from '../services/socket';
import { useTheme } from '../context/ThemeContext';
import { registerForPushNotifications } from '../services/notificationService';
import * as Notifications from 'expo-notifications';

import OnboardingScreen, { ONBOARDING_KEY } from '../screens/onboarding/OnboardingScreen';
import LanguageSelectScreen from '../screens/auth/LanguageSelectScreen';
import PhoneScreen from '../screens/auth/PhoneScreen';
import OtpScreen from '../screens/auth/OtpScreen';
import NameScreen from '../screens/auth/NameScreen';
import TermsScreen from '../screens/auth/TermsScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import PostDetailScreen from '../screens/post/PostDetailScreen';
import HachiRoomScreen from '../screens/hachi/HachiRoomScreen';
import RadarScreen from '../screens/radar/RadarScreen';
import CircleScreen from '../screens/radar/CircleScreen';
import LiveCameraScreen from '../screens/radar/LiveCameraScreen';
import RequestLocationScreen from '../screens/radar/RequestLocationScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import MediaViewerScreen from '../screens/media/MediaViewerScreen';

const Stack = createNativeStackNavigator();

function MainTabs() {
  const { user, token } = useSelector((s) => s.auth);
  // Save current account into multi-account store whenever auth changes
  useEffect(() => {
    if (token && user) upsertCurrentAccount(token, user).catch(() => {});
  }, [token, user]);
  // No tab bar — Radar is the single root screen.
  return <RadarScreen />;
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Phone" component={PhoneScreen} />
      <Stack.Screen name="OtpVerify" component={OtpScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}

function AppStack() {
  const { colors: COLORS } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.background },
        headerTintColor: COLORS.accent,
        headerTitleStyle: { fontWeight: '600', fontSize: 17, color: COLORS.text },
        headerShadowVisible: false,
        headerBackTitleVisible: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: '' }} />
      <Stack.Screen name="ProfileDetail" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="HachiRoom" component={HachiRoomScreen} options={{ title: '', headerShadowVisible: false }} />
      <Stack.Screen name="Circle" component={CircleScreen} options={{ headerShown: false }} />
      <Stack.Screen name="LiveCamera" component={LiveCameraScreen} options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="RequestLocation" component={RequestLocationScreen} options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Terms" component={TermsScreen} options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen
        name="MediaViewer"
        component={MediaViewerScreen}
        options={{ headerShown: false, presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
      />
    </Stack.Navigator>
  );
}

const linking = {
  prefixes: ['kuwai://', 'https://kuwai.app'],
  config: {
    screens: {
      PostDetail: 'post/:postId',
      HachiRoom: 'circle/:roomId',
      ProfileDetail: 'profile/:username',
    },
  },
};

const LANG_KEY = '@kn_lang_explicit';

export default function AppNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, isSessionRestored, needsName, isGuest } = useSelector((s) => s.auth);
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [langChosen, setLangChosen] = useState(null); // null = still checking
  const [onboardingDone, setOnboardingDone] = useState(null);

  useEffect(() => {
    dispatch(restoreSession());
    AsyncStorage.getItem(LANG_KEY)
      .then((val) => { setLangChosen(val === 'ar' || val === 'en'); })
      .catch(() => { setLangChosen(false); });
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((val) => { setOnboardingDone(val === 'true'); })
      .catch(() => { setOnboardingDone(false); });
  }, []);

  // Claim daily login bonus silently whenever the user is authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    dispatch(claimDailyBonus());
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = getSocket();
    if (!socket) return;
    socket.on('notification', (n) => dispatch(addNotificationRealtime(n)));
    // socket.on('dmMessage', ...) — DMs disabled
    // socket.on('dmRequestAccepted', ...) — DMs disabled
    return () => {
      socket.off('notification');
      socket.off('dmMessage');
      socket.off('dmRequestAccepted');
    };
  }, [isAuthenticated]);

  // Register for Expo push notifications once authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    registerForPushNotifications();
  }, [isAuthenticated]);

  // Handle tapping a push notification while app is background/killed
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      // Navigation to Notifications screen could be added here if needed
    });
    return () => sub.remove();
  }, []);

  if (!isSessionRestored || langChosen === null || onboardingDone === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  // Language not yet chosen → show language picker before anything else
  if (!langChosen) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="LanguageSelect" component={LanguageSelectScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  let content;
  if (!isAuthenticated) content = <AuthStack />;
  else if (isAuthenticated && needsName) content = (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="NameSetup" component={NameScreen} />
    </Stack.Navigator>
  );
  else content = <AppStack />;

  return (
    <NavigationContainer linking={linking}>
      <GuestGateProvider>
        {content}
        {isAuthenticated && !needsName && !onboardingDone && (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={() => setOnboardingDone(true)}
          >
            <OnboardingScreen onDone={() => setOnboardingDone(true)} />
          </Modal>
        )}
      </GuestGateProvider>
    </NavigationContainer>
  );
}

const makeStyles = (C) => StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.white },
});
