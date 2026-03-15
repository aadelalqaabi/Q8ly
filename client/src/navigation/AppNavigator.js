import React, { useEffect, useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useDispatch, useSelector } from 'react-redux';
import { View, Text, ActivityIndicator, StyleSheet, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { restoreSession } from '../store/slices/authSlice';
import { GuestGateProvider, useGuestGate } from '../context/GuestGateContext';
import { addNotificationRealtime } from '../store/slices/notificationsSlice';
import { addRealtimeMessage, updateConversationAccepted } from '../store/slices/dmSlice';
import { getSocket } from '../services/socket';
import { useTheme } from '../context/ThemeContext';
import { registerForPushNotifications } from '../services/notificationService';
import * as Notifications from 'expo-notifications';

import PhoneScreen from '../screens/auth/PhoneScreen';
import OtpScreen from '../screens/auth/OtpScreen';
import NameScreen from '../screens/auth/NameScreen';
import TermsScreen from '../screens/auth/TermsScreen';
import HomeScreen from '../screens/home/HomeScreen';
import DiscoverScreen from '../screens/discover/DiscoverScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import PostDetailScreen from '../screens/post/PostDetailScreen';
import CreatePostScreen from '../screens/post/CreatePostScreen';
import HachiScreen from '../screens/hachi/HachiScreen';
import HachiRoomScreen from '../screens/hachi/HachiRoomScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import MediaViewerScreen from '../screens/media/MediaViewerScreen';
import DMListScreen from '../screens/dm/DMListScreen';
import DMConversationScreen from '../screens/dm/DMConversationScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const dmUnreadCount = useSelector((s) => s.dm?.dmUnreadCount || 0);
  const { user, isGuest } = useSelector((s) => s.auth);
  const { guestGate } = useGuestGate();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.separator,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 49 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'flame' : 'flame-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Hachi"
        component={HachiScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DMList"
        component={DMListScreen}
        listeners={{
          tabPress: (e) => {
            if (isGuest) {
              e.preventDefault();
              guestGate(null);
            }
          },
        }}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={{ position: 'relative' }}>
              <Ionicons name={focused ? 'mail' : 'mail-outline'} size={24} color={color} />
              {dmUnreadCount > 0 && (
                <View style={{
                  position: 'absolute', top: -4, right: -6,
                  minWidth: 16, height: 16, borderRadius: 8,
                  backgroundColor: '#FF3B30',
                  justifyContent: 'center', alignItems: 'center',
                  paddingHorizontal: 3,
                }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', lineHeight: 12 }}>
                    {dmUnreadCount > 99 ? '99+' : dmUnreadCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        listeners={{
          tabPress: (e) => {
            if (isGuest) {
              e.preventDefault();
              guestGate(null);
            }
          },
        }}
        options={{
          tabBarIcon: ({ focused }) => (
            user?.profilePic ? (
              <Image
                source={{ uri: user.profilePic }}
                style={{ width: 28, height: 28, borderRadius: 14, borderWidth: focused ? 2 : 0, borderColor: COLORS.accent }}
              />
            ) : (
              <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={28} color={focused ? COLORS.accent : COLORS.textMuted} />
            )
          ),
        }}
      />
    </Tab.Navigator>
  );
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
        headerStyle: { backgroundColor: COLORS.white },
        headerTintColor: COLORS.accent,
        headerTitleStyle: { fontWeight: '600', fontSize: 17, color: COLORS.text },
        headerShadowVisible: false,
        headerBackTitleVisible: false,
        contentStyle: { backgroundColor: COLORS.white },
      }}
    >
      <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: '' }} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="ProfileDetail" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="HachiRoom" component={HachiRoomScreen} options={{ title: '', headerShadowVisible: false }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Discover" component={DiscoverScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Terms" component={TermsScreen} options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="DMConversation" component={DMConversationScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="MediaViewer"
        component={MediaViewerScreen}
        options={{ headerShown: false, presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
      />
    </Stack.Navigator>
  );
}

const linking = {
  prefixes: ['kuwai://'],
  config: {
    screens: {
      PostDetail: 'post/:postId',
      HachiRoom: 'circle/:roomId',
    },
  },
};

export default function AppNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, isSessionRestored, needsName, isGuest } = useSelector((s) => s.auth);
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  useEffect(() => { dispatch(restoreSession()); }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = getSocket();
    if (!socket) return;
    socket.on('notification', (n) => dispatch(addNotificationRealtime(n)));
    socket.on('dmMessage', (data) => dispatch(addRealtimeMessage(data)));
    socket.on('dmRequestAccepted', (data) => dispatch(updateConversationAccepted(data.conversationId)));
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

  if (!isSessionRestored) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  let content;
  if (!isAuthenticated && !isGuest) content = <AuthStack />;
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
      </GuestGateProvider>
    </NavigationContainer>
  );
}

const makeStyles = (C) => StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.white },
});
