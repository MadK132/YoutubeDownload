import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { loadTheme, saveTheme } from '../database/storage';
import type { ThemeMode } from '../types';

const dark = { background: '#0B1013', surface: '#141C20', raised: '#1C282E', border: '#27363C', text: '#F4F8F7', muted: '#92A5AD', accent: '#B2F5CE', accentText: '#10281E', danger: '#FF9A91', warning: '#EFC888' };
const light: typeof dark = { background: '#F3F6F4', surface: '#FFFFFF', raised: '#E9EFEC', border: '#D8E2DC', text: '#15251D', muted: '#596E63', accent: '#16794B', accentText: '#FFFFFF', danger: '#AF342B', warning: '#885E14' };
type ThemeContext = { mode: ThemeMode; colors: typeof dark; setMode: (mode: ThemeMode) => Promise<void> };
const Theme = createContext<ThemeContext>({ mode: 'dark', colors: dark, setMode: async () => {} });
export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<ThemeMode>('dark');
  useEffect(() => { void loadTheme().then(setMode).catch(() => {}); }, []);
  return <Theme.Provider value={{ mode, colors: mode === 'dark' ? dark : light, setMode: async next => { await saveTheme(next); setMode(next); } }}>{children}</Theme.Provider>;
}
export const useTheme = () => useContext(Theme);
