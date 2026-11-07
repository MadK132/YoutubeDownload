import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ThemeProvider, useTheme } from '../constants/theme';
import { initializeDownloads } from '../services/download/manager';

function Navigation() {
  const { colors, mode } = useTheme();
  useEffect(() => { void initializeDownloads(); }, []);
  return <><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}><Stack.Screen name="(tabs)" /><Stack.Screen name="player" options={{ presentation: 'modal' }} /></Stack></>;
}
export default function RootLayout() { return <ThemeProvider><Navigation /></ThemeProvider>; }
