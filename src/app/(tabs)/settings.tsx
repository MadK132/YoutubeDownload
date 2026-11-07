import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Card, Icon, Label, Notice, Screen, styles } from '../../components/ui';
import { useTheme } from '../../constants/theme';
import { pocketMedia } from '../../../modules/pocket-media';

export default function Settings() {
  const { colors, mode, setMode } = useTheme();
  const [error, setError] = useState('');
  return <Screen title="Настройки" subtitle="Меньше настроек. Больше удобства.">
    <Card><View style={styles.row}><Icon name="moon" color={colors.accent} /><View style={{ flex: 1 }}><Label style={{ fontWeight: '600' }}>Тёмная тема</Label><Label muted style={{ fontSize: 12 }}>Комфортный просмотр в любое время</Label></View><Switch accessibilityLabel="Тёмная тема" value={mode === 'dark'} trackColor={{ true: colors.accent, false: colors.border }} thumbColor={mode === 'dark' ? '#183527' : '#FFFFFF'} onValueChange={value => void setMode(value ? 'dark' : 'light').catch(() => setError('Не удалось сохранить тему.'))} /></View></Card>
    {!!error && <Notice error>{error}</Notice>}
    <Card><View style={styles.row}><Icon name="filter" color={colors.accent} /><Label style={{ fontSize: 17, fontWeight: '600' }}>Проверка рекламы</Label></View><Label muted>Всегда включена. Известные рекламные домены, явные рекламные пути и метки источника блокируются до добавления в очередь.</Label><Notice>По прямой ссылке без метаданных нельзя достоверно отличить любой рекламный ролик. Рекламу внутри самого видео приложение не вырезает.</Notice></Card>
    <Card><View style={styles.row}><Icon name="shield" color={colors.accent} /><Label style={{ fontSize: 17, fontWeight: '600' }}>Ваши данные — у вас</Label></View><Label muted>Видео и история хранятся на устройстве. Временные параметры ссылок не записываются в историю. Без аналитики, аккаунтов и облачного сервера.</Label><Notice>Перенаправления проверяются по конечному адресу при анализе. Системный загрузчик может следовать новым перенаправлениям; полная фильтрация рекламы на каждом переходе не гарантируется.</Notice></Card>
    <Card><Label style={{ fontWeight: '600' }}>Автономная загрузка</Label><Label muted>{pocketMedia ? 'Модуль обработки установлен. Видео и звук собираются на этом iPhone, компьютер и внешний сервис не нужны.' : 'Для YouTube и сборки раздельных дорожек установите обновлённый IPA. Expo Go и веб-превью не содержат модуль обработки видео.'}</Label></Card>
    <Card><Label style={{ fontWeight: '600' }}>О загрузках</Label><Label muted>Поддерживаются прямые MP4/MOV и доступные публичные ролики YouTube/VK. Загрузка идёт напрямую на устройство, основной ролик определяется по ID ссылки.</Label><Label muted>Качество — до 1080p из доступных вариантов. Закрытые видео, DRM и вход через аккаунт не поддерживаются.</Label><Notice>Держите приложение открытым во время загрузки и сборки. Работа в фоне ограничена iOS.</Notice></Card>
    <View style={{ alignItems: 'center', gap: 4, paddingVertical: 12 }}><Label style={{ fontWeight: '600' }}>Pocket Video</Label><Label muted style={{ fontSize: 12 }}>Версия 1.0.0 · Сделано для личной коллекции</Label></View>
  </Screen>;
}
