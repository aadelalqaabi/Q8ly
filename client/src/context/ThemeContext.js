import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIGHT_COLORS, DARK_COLORS } from '../constants';

const THEME_KEY = '@kn_theme'; // 'light' | 'dark' | 'auto'

export const ThemeContext = createContext({
  colors: LIGHT_COLORS,
  isDark: false,
  scheme: 'auto',
  setScheme: () => {},
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [scheme, setSchemeState] = useState('auto');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((v) => { if (v === 'light' || v === 'dark' || v === 'auto') setSchemeState(v); })
      .catch(() => {});
  }, []);

  const setScheme = useCallback(async (newScheme) => {
    setSchemeState(newScheme);
    await AsyncStorage.setItem(THEME_KEY, newScheme).catch(() => {});
  }, []);

  const isDark =
    scheme === 'dark' ||
    (scheme === 'auto' && systemScheme === 'dark');

  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <ThemeContext.Provider value={{ colors, isDark, scheme, setScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
