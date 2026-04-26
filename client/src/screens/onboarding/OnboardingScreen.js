import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Animated,
  Platform,
  Alert,
  I18nManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import * as Haptics from 'expo-haptics';

let Location = null;
try { Location = require('expo-location'); } catch {}

const { width, height } = Dimensions.get('window');
const ONBOARDING_KEY = '@kn_onboarding_done';
const BLUE = '#0033A0';
const GOLD = '#CBA052';

export default function OnboardingScreen({ onDone }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const align = isRTL ? 'right' : 'left';
  const selfAlign = isRTL ? 'flex-end' : 'flex-start';
  const { user } = useSelector((s) => s.auth);
  const flatListRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const pointsAnim = useRef(new Animated.Value(0)).current;
  const [pointsAnimated, setPointsAnimated] = useState(false);

  const points = user?.hachiPoints ?? 0;

  const goNext = useCallback(() => {
    if (currentIndex < 2) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  }, [currentIndex]);

  const handleLocationRequest = useCallback(async () => {
    if (!Location) {
      goNext();
      return;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('onboarding.locationDeniedTitle'),
          t('onboarding.locationDeniedMsg'),
        );
      }
    } catch {}
    goNext();
  }, [goNext, t]);

  const handleFinish = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone?.();
  }, [onDone]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const idx = viewableItems[0].index;
      setCurrentIndex(idx);
      if (idx === 2 && !pointsAnimated) {
        setPointsAnimated(true);
        Animated.spring(pointsAnim, {
          toValue: 1,
          damping: 12,
          stiffness: 150,
          useNativeDriver: true,
        }).start();
      }
    }
  }).current;

  const pages = [
    // Page 1: Circles
    {
      key: 'circles',
      icon: 'chatbubbles',
      render: () => (
        <View style={styles.page}>
          <View style={[styles.iconCircle, { alignSelf: selfAlign }]}>
            <Ionicons name="chatbubbles" size={48} color="#FFFFFF" />
          </View>
          <Text style={[styles.title, { textAlign: align }]}>{t('onboarding.circlesTitle')}</Text>
          <View style={[styles.goldLine, { alignSelf: selfAlign }]} />
          <Text style={[styles.body, { textAlign: align }]}>{t('onboarding.circlesBody')}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={[styles.btn, { marginBottom: insets.bottom + 40 }]} onPress={goNext} activeOpacity={0.8}>
            <Text style={styles.btnText}>{t('onboarding.next')}</Text>
          </TouchableOpacity>
        </View>
      ),
    },
    // Page 2: Location circles
    {
      key: 'location',
      icon: 'location',
      render: () => (
        <View style={styles.page}>
          <View style={[styles.iconCircle, { alignSelf: selfAlign }]}>
            <Ionicons name="location" size={48} color="#FFFFFF" />
          </View>
          <Text style={[styles.title, { textAlign: align }]}>{t('onboarding.locationTitle')}</Text>
          <View style={[styles.goldLine, { alignSelf: selfAlign }]} />
          <Text style={[styles.body, { textAlign: align }]}>{t('onboarding.locationBody')}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={[styles.btn, { marginBottom: insets.bottom + 40 }]} onPress={handleLocationRequest} activeOpacity={0.8}>
            <Ionicons name="navigate" size={20} color={BLUE} style={{ marginRight: 8 }} />
            <Text style={styles.btnText}>{t('onboarding.enableLocation')}</Text>
          </TouchableOpacity>
        </View>
      ),
    },
    // Page 3: Points
    {
      key: 'points',
      icon: 'star',
      render: () => {
        const scale = pointsAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
        const opacity = pointsAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.5, 1] });
        return (
          <View style={styles.page}>
            <View style={[styles.iconCircle, { alignSelf: selfAlign }]}>
              <Ionicons name="star" size={48} color="#FFFFFF" />
            </View>
            <Text style={[styles.title, { textAlign: align }]}>{t('onboarding.pointsTitle')}</Text>
            <View style={[styles.goldLine, { alignSelf: selfAlign }]} />
            <Text style={[styles.body, { textAlign: align }]}>{t('onboarding.pointsBody')}</Text>
            <Animated.View style={[styles.pointsBadge, { transform: [{ scale }], opacity }]}>
              <Ionicons name="star" size={28} color={GOLD} />
              <Text style={styles.pointsNumber}>{points}</Text>
              <Text style={styles.pointsLabel}>{t('onboarding.pointsLabel')}</Text>
            </Animated.View>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={[styles.btn, { marginBottom: insets.bottom + 40 }]} onPress={handleFinish} activeOpacity={0.8}>
              <Text style={styles.btnText}>{t('onboarding.start')}</Text>
            </TouchableOpacity>
          </View>
        );
      },
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Skip */}
      <TouchableOpacity
        style={[styles.skip, { top: insets.top + 12, [isRTL ? 'left' : 'right']: 20 }]}
        onPress={handleFinish}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={pages}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <View style={{ width }}>{item.render()}</View>
        )}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
      />

      {/* Dots */}
      <View style={[styles.dots, { bottom: insets.bottom + 16 }]}>
        {pages.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 24, 8], extrapolate: 'clamp' });
          const dotOpacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
          return (
            <Animated.View
              key={i}
              style={[styles.dot, { width: dotWidth, opacity: dotOpacity }]}
            />
          );
        })}
      </View>
    </View>
  );
}

export { ONBOARDING_KEY };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BLUE,
  },
  skip: {
    position: 'absolute',
    zIndex: 10,
  },
  skipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '500',
  },
  page: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    marginBottom: 10,
  },
  goldLine: {
    width: 36,
    height: 3,
    backgroundColor: GOLD,
    borderRadius: 2,
    marginBottom: 18,
  },
  body: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 28,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
    width: '100%',
  },
  btnText: {
    color: BLUE,
    fontSize: 18,
    fontWeight: '700',
  },
  pointsBadge: {
    alignItems: 'center',
    marginTop: 28,
  },
  pointsNumber: {
    color: '#FFFFFF',
    fontSize: 56,
    fontWeight: '900',
    marginTop: 4,
  },
  pointsLabel: {
    color: GOLD,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  dots: {
    position: 'absolute',
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
});
