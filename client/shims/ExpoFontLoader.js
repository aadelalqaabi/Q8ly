import { requireNativeModule } from 'expo-modules-core';

const nativeModule = requireNativeModule('ExpoFontLoader');

// Expo Go's native ExpoFontLoader may not expose getLoadedFonts on all SDK versions.
// Provide a safe fallback so @expo/vector-icons doesn't crash.
if (typeof nativeModule.getLoadedFonts !== 'function') {
  nativeModule.getLoadedFonts = () => [];
}

export default nativeModule;
