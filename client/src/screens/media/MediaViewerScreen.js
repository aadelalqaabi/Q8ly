import React, { useState, useRef, useCallback } from 'react';
import {
  View, StyleSheet, FlatList,
  TouchableOpacity, Text, Dimensions, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
  NativeViewGestureHandler,
} from 'react-native-gesture-handler';

const { width: SW, height: SH } = Dimensions.get('window');
const MAX_SCALE = 5;

// ── Zoomable image ─────────────────────────────────────────────────────────────
function ZoomableImage({ uri, onZoomChange, isZoomedShared, dismissGestureRef, flatListRef }) {
  const [imgH, setImgH] = useState(SW * 0.75);

  const scale      = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX     = useSharedValue(0);
  const savedY     = useSharedValue(0);

  const notifyZoom = useCallback((val) => onZoomChange?.(val), [onZoomChange]);

  const resetZoom = () => {
    'worklet';
    scale.value      = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedX.value     = 0;
    savedY.value     = 0;
    isZoomedShared.value = false;
    runOnJS(notifyZoom)(false);
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(MAX_SCALE, savedScale.value * e.scale));
    })
    .onEnd((e) => {
      const next = Math.max(1, Math.min(MAX_SCALE, savedScale.value * e.scale));
      savedScale.value = next;
      scale.value = next;
      if (next <= 1.05) {
        resetZoom();
      } else {
        isZoomedShared.value = true;
        runOnJS(notifyZoom)(true);
      }
    });

  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .simultaneousWithExternalGesture(dismissGestureRef, flatListRef)
    .onUpdate((e) => {
      if (!isZoomedShared.value) return;
      translateX.value = savedX.value + e.translationX;
      translateY.value = savedY.value + e.translationY;
    })
    .onEnd((e) => {
      if (!isZoomedShared.value) return;
      savedX.value += e.translationX;
      savedY.value += e.translationY;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (isZoomedShared.value) {
        resetZoom();
      } else {
        scale.value      = withSpring(2.5);
        savedScale.value = 2.5;
        isZoomedShared.value = true;
        runOnJS(notifyZoom)(true);
      }
    });

  const composed = Gesture.Simultaneous(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
  );

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const onLoad = (e) => {
    const { width, height } = e.nativeEvent.source;
    if (width && height) {
      setImgH(Math.min(SH * 0.88, SW / (width / height)));
    }
  };

  return (
    <GestureDetector gesture={composed}>
      <Animated.Image
        source={{ uri }}
        style={[{ width: SW, height: imgH }, animStyle]}
        resizeMode="contain"
        onLoad={onLoad}
      />
    </GestureDetector>
  );
}

// ── Video page ─────────────────────────────────────────────────────────────────
function VideoPage({ uri }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.play();
  });

  return (
    <View style={styles.page}>
      <VideoView
        player={player}
        style={{ width: SW, height: SH }}
        contentFit="contain"
        nativeControls
      />
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function MediaViewerScreen({ navigation, route }) {
  const { media = [], initialIndex = 0 } = route.params;
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const listRef = useRef(null);
  const flatListGestureRef = useRef(null);

  // Shared value for zoom state — readable from UI-thread worklets
  const isZoomedShared = useSharedValue(false);

  const handleZoomChange = useCallback((zoomed) => {
    isZoomedShared.value = zoomed;
    setIsZoomed(zoomed);
  }, [isZoomedShared]);

  // Swipe-to-dismiss
  const dismissGestureRef = useRef(null);
  const dismissY = useSharedValue(0);

  const bgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      dismissY.value,
      [-SH / 2, 0, SH / 2],
      [0, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const sliderStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dismissY.value }],
  }));

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  const dismissGesture = Gesture.Pan()
    .withRef(dismissGestureRef)
    .activeOffsetY([-10, 10])
    .failOffsetX([-30, 30])
    .onUpdate((e) => {
      if (isZoomedShared.value) return;
      dismissY.value = e.translationY;
    })
    .onEnd((e) => {
      if (isZoomedShared.value) {
        dismissY.value = withSpring(0);
        return;
      }
      if (Math.abs(e.translationY) > 100 || Math.abs(e.velocityY) > 600) {
        runOnJS(goBack)();
      } else {
        dismissY.value = withSpring(0);
      }
    });

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) setCurrentIndex(viewableItems[0].index ?? 0);
  }, []);

  const renderItem = ({ item }) => {
    if (item.type === 'video') return <VideoPage uri={item.uri} />;
    return (
      <View style={styles.page}>
        <ZoomableImage
          uri={item.uri}
          onZoomChange={handleZoomChange}
          isZoomedShared={isZoomedShared}
          dismissGestureRef={dismissGestureRef}
          flatListRef={flatListGestureRef}
        />
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
      <Animated.View style={[StyleSheet.absoluteFill, styles.bgOverlay, bgStyle]} />

      <GestureDetector gesture={dismissGesture}>
        <Animated.View style={[styles.slider, sliderStyle]}>
          <NativeViewGestureHandler ref={flatListGestureRef}>
            <FlatList
              ref={listRef}
              data={media}
              keyExtractor={(_, i) => String(i)}
              renderItem={renderItem}
              horizontal
              pagingEnabled
              scrollEnabled={!isZoomed}
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={initialIndex}
              getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
              viewabilityConfig={viewabilityConfig.current}
              onViewableItemsChanged={onViewableItemsChanged}
            />
          </NativeViewGestureHandler>
        </Animated.View>
      </GestureDetector>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>

        {media.length > 1 && (
          <Text style={styles.counter}>{currentIndex + 1} / {media.length}</Text>
        )}

        <View style={{ width: 44 }} />
      </View>

      {/* Dot indicators */}
      {media.length > 1 && (
        <View style={[styles.dots, { paddingBottom: insets.bottom + 20 }]}>
          {media.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
          ))}
        </View>
      )}

      {/* Zoom hint */}
      {isZoomed && (
        <View style={[styles.hintBar, { bottom: insets.bottom + 16 }]}>
          <Text style={styles.hintText}>Double-tap to zoom out</Text>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bgOverlay: { backgroundColor: 'rgba(0,0,0,0.88)' },
  slider: { flex: 1 },

  page: {
    width: SW, height: SH,
    justifyContent: 'center',
    alignItems: 'center',
  },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingBottom: 14,
  },
  closeBtn: {
    width: 40, height: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  counter: {
    flex: 1, textAlign: 'center',
    fontSize: 15, fontWeight: '600', color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  dots: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: { backgroundColor: '#fff', width: 20 },

  hintBar: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 12, color: 'rgba(255,255,255,0.5)',
  },
});
