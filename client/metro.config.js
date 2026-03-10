const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Force axios to use its browser build instead of the Node.js build,
// which requires unavailable Node built-ins (crypto, http, url) in RN.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'axios') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/axios/dist/browser/axios.cjs'),
      type: 'sourceFile',
    };
  }
  // Patch ExpoFontLoader to add a getLoadedFonts fallback for Expo Go builds
  // that ship a native module without this method.
  if (moduleName.endsWith('expo-font/build/ExpoFontLoader')) {
    return {
      filePath: path.resolve(__dirname, 'shims/ExpoFontLoader.js'),
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
