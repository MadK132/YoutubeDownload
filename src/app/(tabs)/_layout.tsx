import { Tabs } from 'expo-router';
import { Icon, type IconName } from '../../components/ui';
import { useTheme } from '../../constants/theme';
import { useDownloads } from '../../services/download/manager';
import type { ColorValue } from 'react-native';

export default function TabLayout() {
  const { colors } = useTheme();
  const { items } = useDownloads();
  const count = items.filter(item => item.status === 'Pending' || item.status === 'Downloading').length;
  const icon = (name: IconName) => ({ color }: { color: ColorValue }) => <Icon name={name} color={typeof color === 'string' ? color : colors.muted} size={21} />;
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border, paddingTop: 8 }, tabBarLabelStyle: { fontSize: 10, fontWeight: '600' }, sceneStyle: { backgroundColor: colors.background } }}>
    <Tabs.Screen name="index" options={{ title: 'Главная', tabBarIcon: icon('grid') }} />
    <Tabs.Screen name="downloads" options={{ title: 'Загрузки', tabBarIcon: icon('download'), tabBarBadge: count || undefined, tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.accentText } }} />
    <Tabs.Screen name="library" options={{ title: 'Библиотека', tabBarIcon: icon('film') }} />
    <Tabs.Screen name="settings" options={{ title: 'Настройки', tabBarIcon: icon('sliders') }} />
  </Tabs>;
}
