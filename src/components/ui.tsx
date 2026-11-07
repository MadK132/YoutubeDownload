import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps, PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../constants/theme';

export type IconName = ComponentProps<typeof Feather>['name'];
export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const { colors } = useTheme();
  return <Feather name={name} size={size} color={color || colors.text} />;
}
export function Label({ children, muted = false, style }: PropsWithChildren<{ muted?: boolean; style?: TextStyle }>) {
  const { colors } = useTheme();
  return <Text style={[{ color: muted ? colors.muted : colors.text, fontSize: 15, lineHeight: 23 }, style]}>{children}</Text>;
}
export function Screen({ children, title, subtitle, action }: PropsWithChildren<{ title: string; subtitle: string; action?: React.ReactNode }>) {
  const { colors } = useTheme();
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.screen}>
      <View style={styles.header}><View style={{ flex: 1, gap: 6 }}><Label muted style={styles.eyebrow}>POCKET VIDEO</Label><Label style={styles.title}>{title}</Label><Label muted>{subtitle}</Label></View>{action}</View>
      {children}
    </ScrollView>
  </SafeAreaView>;
}
export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}
export function Button({ title, onPress, icon, secondary = false, disabled = false, loading = false, danger = false }: { title: string; onPress: () => void; icon?: IconName; secondary?: boolean; disabled?: boolean; loading?: boolean; danger?: boolean }) {
  const { colors } = useTheme();
  const foreground = danger ? colors.danger : secondary ? colors.text : colors.accentText;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: disabled || loading }} disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: secondary || danger ? colors.raised : colors.accent, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}>
    {loading ? <ActivityIndicator color={foreground} /> : icon ? <Icon name={icon} color={foreground} size={18} /> : null}
    <Text style={{ color: foreground, fontSize: 15, fontWeight: '700' }}>{title}</Text>
  </Pressable>;
}
export function Notice({ children, error = false }: PropsWithChildren<{ error?: boolean }>) {
  const { colors } = useTheme();
  return <View accessibilityRole={error ? 'alert' : undefined} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}><Icon name={error ? 'alert-circle' : 'info'} size={17} color={error ? colors.danger : colors.muted} /><Label style={{ flex: 1, fontSize: 13, lineHeight: 20, color: error ? colors.danger : colors.muted }}>{children}</Label></View>;
}
export function Empty({ icon, title, detail }: { icon: IconName; title: string; detail: string }) {
  const { colors } = useTheme();
  return <Card style={{ alignItems: 'center', paddingVertical: 42, gap: 14 }}><View style={{ padding: 20, borderRadius: 28, backgroundColor: colors.raised }}><Icon name={icon} size={30} color={colors.accent} /></View><Label style={{ fontSize: 20, fontWeight: '700', textAlign: 'center' }}>{title}</Label><Label muted style={{ textAlign: 'center', maxWidth: 280 }}>{detail}</Label></Card>;
}
export const styles = StyleSheet.create({
  screen: { padding: 24, paddingBottom: 40, gap: 22, width: '100%', maxWidth: 680, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, paddingBottom: 8 },
  eyebrow: { fontSize: 10, letterSpacing: 3, fontWeight: '700' },
  title: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: -1.2 },
  card: { borderRadius: 24, borderWidth: 1, padding: 20, gap: 16 },
  button: { minHeight: 49, borderRadius: 15, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
