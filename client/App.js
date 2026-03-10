import 'react-native-url-polyfill/auto';
import './src/i18n'; // registers i18next before anything else
import { useState, useEffect, useCallback } from 'react';
import { I18nManager } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import FlashMessage from 'react-native-flash-message';

import store from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import { initLanguage } from './src/i18n';
import { AppRestartContext } from './src/context/AppRestartContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

// Allow RTL — direction is set by initLanguage() before first render
I18nManager.allowRTL(true);

// Inner component so useTheme() works inside ThemeProvider
function AppInner({ navKey }) {
  const { isDark, colors } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />
      <AppNavigator key={navKey} />
      <FlashMessage position="top" />
    </>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [navKey, setNavKey] = useState(0);

  useEffect(() => {
    initLanguage().then(() => setIsReady(true));
  }, []);

  const restartApp = useCallback(() => {
    setNavKey((k) => k + 1);
  }, []);

  if (!isReady) return null;

  return (
    <ThemeProvider>
      <AppRestartContext.Provider value={restartApp}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <Provider store={store}>
              <PaperProvider>
                <AppInner navKey={navKey} />
              </PaperProvider>
            </Provider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </AppRestartContext.Provider>
    </ThemeProvider>
  );
}
