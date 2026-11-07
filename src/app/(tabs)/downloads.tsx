import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Empty, Icon, Label, Notice, Screen, styles } from '../../components/ui';
import { useTheme } from '../../constants/theme';
import { cancelDownload, removeItem, retryDownload, useDownloads } from '../../services/download/manager';
import { bytes, statusLabels } from '../../utils/format';

export default function Downloads() {
  const { colors } = useTheme();
  const { items, error: storageError } = useDownloads();
  const [error, setError] = useState('');
  const activeCount = items.filter(item => ['Pending', 'Downloading'].includes(item.status)).length;
  async function action(callback: () => void | Promise<void>) {
    setError('');
    try { await callback(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось выполнить действие.'); }
  }
  return <Screen title="Загрузки" subtitle={activeCount ? `В работе: ${activeCount}. Всё под контролем.` : 'Очередь и история ваших загрузок.'}>
    {!!(error || storageError) && <Notice error>{error || storageError}</Notice>}
    {!items.length && <Empty icon="download-cloud" title="Здесь появятся загрузки" detail="Добавьте ссылку на главном экране, проверьте видео и нажмите «Скачать»." />}
    {items.map(item => {
      const running = item.status === 'Downloading';
      const pending = item.status === 'Pending';
      const failed = item.status === 'Failed';
      const progress = item.total > 0 ? Math.min(1, item.received / item.total) : 0;
      return <Card key={item.id}>
        <View style={styles.row}><View style={{ backgroundColor: colors.raised, padding: 14, borderRadius: 17 }}><Icon name={item.status === 'Completed' ? 'check' : failed ? 'alert-triangle' : 'download'} color={failed ? colors.danger : colors.accent} /></View><View style={{ flex: 1 }}><Label style={{ fontWeight: '600' }}>{item.title}</Label><Label muted style={{ fontSize: 12 }}>{item.format.toUpperCase()} · {item.quality} · {new Date(item.createdAt).toLocaleDateString('ru-RU')}</Label></View></View>
        <View style={[styles.row, { justifyContent: 'space-between' }]}><Label style={{ fontSize: 13, color: failed ? colors.danger : colors.accent }}>{statusLabels[item.status]}</Label><Label muted style={{ fontSize: 12 }}>{running && item.total > 0 ? `${Math.floor(progress * 100)}% · ` : ''}{bytes(item.received)}{item.total > 0 ? ` / ${bytes(item.total)}` : ''}</Label></View>
        {(running || pending) && <><View accessibilityRole="progressbar" accessibilityValue={item.total > 0 ? { min: 0, max: 100, now: Math.floor(progress * 100) } : undefined} style={{ height: 5, borderRadius: 4, backgroundColor: colors.raised, overflow: 'hidden' }}><View style={{ height: 5, width: `${progress * 100}%`, backgroundColor: colors.accent }} /></View><Label muted style={{ fontSize: 12 }}>{pending ? 'Ожидает своей очереди' : item.speed > 0 ? `${bytes(item.speed)}/с` : 'Подключение к серверу…'}{running && item.total === 0 ? ' · Размер неизвестен' : ''}</Label></>}
        {!!item.error && <Notice error>{item.error}</Notice>}
        {running || pending ? <Button title="Отменить" icon="x" secondary onPress={() => void action(() => cancelDownload(item.id))} /> : item.status !== 'Completed' ? <View style={styles.row}><View style={{ flex: 1 }}><Button title="Повторить" icon="rotate-cw" secondary onPress={() => void action(() => retryDownload(item.id))} /></View><Button title="Убрать" icon="x" secondary onPress={() => void action(() => removeItem(item.id))} /></View> : <Label muted style={{ fontSize: 12 }}>Видео доступно в библиотеке</Label>}
      </Card>;
    })}
    {!!items.length && <Notice>Оставьте приложение открытым во время загрузки. iOS может приостановить её в фоне.</Notice>}
  </Screen>;
}
