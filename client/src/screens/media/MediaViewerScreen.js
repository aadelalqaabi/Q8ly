import React, { useState, useRef, useCallback } from 'react';
import {
  View, StyleSheet, FlatList, Image, Animated,
  TouchableOpacity, Text, Dimensions, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  PanGestureHandler,
  TapGestureHandler,
  State,
} from 'react-native-gesture-handler';

const { width: SW, height: SH } = Dimensions.get('window');
const MAX_SCALE = 5;

// ── Zoomable image ─────────────────────────────────────────────────────────────
function ZoomableImage({ uri, onZoomChange }) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [imgH, setImgH] = useState(SW * 0.75);

  // Scale — multiply base (committed) × live pinch delta
  const baseScale  = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const scale      = useRef(Animated.multiply(baseScale, pinchScale)).current;
  const lastScale  = useRef(1);

  // Translation — offset holds committed value; value holds live delta
  const panX    = useRef(new Animated.Value(0)).current;
  const panY    = useRef(new Animated.Value(0)).current;
  const lastPanX = useRef(0);
  const lastPanY = useRef(0);

  const pinchRef    = useRef(null);
  const panRef      = useRef(null);
  const doubleTapRef = useRef(null);

  const resetZoom = () => {
    lastScale.current = 1;
    baseScale.setValue(1);
    pinchScale.setValue(1);
    lastPanX.current = 0;
    lastPanY.current = 0;
    panX.setOffset(0);
    panY.setOffset(0);
    panX.setValue(0);
    panY.setValue(0);
    setIsZoomed(false);
    onZoomChange?.(false);
  };

  // ── Pinch ──────────────────────────────────────────────────────────────────
  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true }
  );

  const onPinchStateChange = ({ nativeEvent: ev }) => {
    if (ev.state !== State.END && ev.state !== State.CANCELLED) return;
    const next = Math.max(1, Math.min(MAX_SCALE, lastScale.current * ev.scale));
    lastScale.current = next;
    baseScale.setValue(next);
    pinchScale.setValue(1);

    if (next <= 1.05) {
      resetZoom();
    } else {
      setIsZoomed(true);
      onZoomChange?.(true);
    }
  };

  // ── Pan (only when zoomed) ─────────────────────────────────────────────────
  const onPanEvent = Animated.event(
    [{ nativeEvent: { translationX: panX, translationY: panY } }],
    { useNativeDriver: true }
  );

  const onPanStateChange = ({ nativeEvent: ev }) => {
    if (ev.state !== State.END && ev.state !== State.CANCELLED) return;
    lastPanX.current += ev.translationX;
    lastPanY.current += ev.translationY;
    panX.setOffset(lastPanX.current);
    panX.setValue(0);
    panY.setOffset(lastPanY.current);
    panY.setValue(0);
  };

  // ── Double-tap ─────────────────────────────────────────────────────────────
  const onDoubleTap = ({ nativeEvent: ev }) => {
    if (ev.state !== State.ACTIVE) return;
    if (lastScale.current > 1.05) {
      resetZoom();
    } else {
      lastScale.current = 2.5;
      Animated.spring(baseScale, {
        toValue: 2.5, useNativeDriver: true, damping: 15, stiffness: 180,
      }).start();
      setIsZoomed(true);
      onZoomChange?.(true);
    }
  };

  const onLoad = (e) => {
    const { width, height } = e.nativeEvent.source;
    if (width && height) {
      setImgH(Math.min(SH * 0.88, SW / (width / height)));
    }
  };

  // Gesture handlers wrap only the image — not the full page.
  // Touches on the black area above/below the image bubble up to the parent TouchableOpacity.
  return (
    <TapGestureHandler
      ref={doubleTapRef}
      numberOfTaps={2}
      onHandlerStateChange={onDoubleTap}
    >
      <Animated.View>
        <PanGestureHandler
          ref={panRef}
          simultaneousHandlers={[pinchRef]}
          enabled={isZoomed}
          onGestureEvent={onPanEvent}
          onHandlerStateChange={onPanStateChange}
          minPointers={1}
          maxPointers={1}
        >
          <Animated.View>
            <PinchGestureHandler
              ref={pinchRef}
              simultaneousHandlers={[panRef]}
              onGestureEvent={onPinchEvent}
              onHandlerStateChange={onPinchStateChange}
            >
              <Animated.Image
                source={{ uri }}
                style={{
                  width: SW,
                  height: imgH,
                  transform: [{ translateX: panX }, { translateY: panY }, { scale }],
                }}
                resizeMode="contain"
                onLoad={onLoad}
              />
            </PinchGestureHandler>
          </Animated.View>
        </PanGestureHandler>
      </Animated.View>
    </TapGestureHandler>
  );
}

// ── Video page ─────────────────────────────────────────────────────────────────
function VideoPage({ uri }) {
  const videoRef = useRef(null);
  const [videoSize, setVideoSize] = useState({ width: SW, height: SW * 0.5625 });

  const onReadyForDisplay = ({ naturalSize }) => {
    if (!naturalSize?.width || !naturalSize?.height) return;
    const ratio = naturalSize.width / naturalSize.height;
    // Fit within screen without stretching
    if (ratio >= SW / SH) {
      setVideoSize({ width: SW, height: SW / ratio });
    } else {
      setVideoSize({ width: SH * ratio, height: SH });
    }
  };

  return (
    <View style={styles.page}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={{ width: videoSize.width, height: videoSize.height }}
        resizeMode={ResizeMode.CONTAIN}
        useNativeControls
        shouldPlay
        isLooping={true}
        onReadyForDisplay={onReadyForDisplay}
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
  const isZoomedRef = useRef(false);
  const listRef = useRef(null);

  const handleZoomChange = useCallback((zoomed) => {
    isZoomedRef.current = zoomed;
    setIsZoomed(zoomed);
  }, []);

  // Swipe-to-dismiss
  const translateY = useRef(new Animated.Value(0)).current;
  const bgOpacity = translateY.interpolate({
    inputRange: [-SH / 2, 0, SH / 2],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  const dismissPanRef = useRef(null);

  const onDismissPanEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onDismissPanState = ({ nativeEvent: ev }) => {
    if (ev.state !== State.END && ev.state !== State.CANCELLED) return;
    if (isZoomedRef.current) return; // zoomed — ignore dismiss gesture
    const { translationY, velocityY } = ev;
    if (Math.abs(translationY) > 100 || Math.abs(velocityY) > 600) {
      navigation.goBack();
    } else {
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true, damping: 20, stiffness: 260,
      }).start();
    }
  };

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) setCurrentIndex(viewableItems[0].index ?? 0);
  }, []);

  const renderItem = ({ item }) => {
    if (item.type === 'video') return <VideoPage uri={item.uri} />;
    return (
      <View style={styles.page}>
        <ZoomableImage uri={item.uri} onZoomChange={handleZoomChange} />
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
      <Animated.View style={[styles.container, { opacity: bgOpacity }]} />

      <PanGestureHandler
        ref={dismissPanRef}
        onGestureEvent={onDismissPanEvent}
        onHandlerStateChange={onDismissPanState}
        activeOffsetY={[-10, 10]}
        failOffsetX={[-20, 20]}
      >
        <Animated.View style={[styles.slider, { transform: [{ translateY }] }]}>
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
        </Animated.View>
      </PanGestureHandler>

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
          <Text style={styles.hintText}>اضغط مرتين للرجوع</Text>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
  },
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
