import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Empty, Icon, Label, Notice, Screen, styles } from '../../components/ui';
import { useTheme } from '../../constants/theme';
import { importFromDevice, removeItem, useDownloads } from '../../services/download/manager';
import { saveToPhotos, shareVideo } from '../../services/storage/media';
import { bytes } from '../../utils/format';

export default function Library() {
  const { colors } = useTheme();
  const { items, ready } = useDownloads();
  const videos = items.filter(item => item.status === 'Completed' && item.localUri);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function action(callback: () => Promise<void>, success = '') {
    setError(''); setMessage(''); setBusy(true);
    try { await callback(); setMessage(success); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось выполнить действие.'); }
    finally { setBusy(false); }
  }
  function confirmRemove(id: string) {
    Alert.alert('Удалить видео?', 'Файл и запись о загрузке будут удалены из приложения. Копия в «Фото» останется.', [{ text: 'Оставить', style: 'cancel' }, { text: 'Удалить', style: 'destructive', onPress: () => void action(() => removeItem(id)) }]);
  }
  return <Screen title="Библиотека" subtitle="Ваша коллекция. Доступна без интернета.">
    <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View><Label muted style={{ fontSize: 12 }}>НА УСТРОЙСТВЕ</Label><Label style={{ fontSize: 27, fontWeight: '700', lineHeight: 36 }}>{videos.length} видео</Label><Label muted style={{ fontSize: 12 }}>{bytes(videos.reduce((sum, video) => sum + video.total, 0))}</Label></View><Icon name="hard-drive" size={36} color={colors.accent} /></Card>
    <Button title="Импортировать из «Файлов»" icon="plus" secondary disabled={busy || !ready || Platform.OS === 'web'} onPress={() => void action(importFromDevice)} />
    {!!error && <Notice error>{error}</Notice>}{!!message && <Notice>{message}</Notice>}
    {!videos.length && <Empty icon="film" title="Ваша первая коллекция" detail="Скачайте видео по прямой ссылке или импортируйте MP4/MOV из приложения «Файлы»." />}
    {videos.map(video => <Card key={video.id}>
      <View style={{ height: 118, borderRadius: 17, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' }}><Icon name="film" size={40} color={colors.accent} /><Label muted style={{ fontSize: 11, marginTop: 7 }}>{video.format.toUpperCase()} · {video.quality}</Label></View>
      <View><Label style={{ fontWeight: '600', fontSize: 17 }}>{video.title}</Label><Label muted style={{ fontSize: 12 }}>{bytes(video.total)} · {new Date(video.createdAt).toLocaleDateString('ru-RU')}</Label></View>
      <Button title="Смотреть" icon="play" onPress={() => router.push({ pathname: '/player', params: { id: video.id } })} />
      <View style={styles.row}><View style={{ flex: 1 }}><Button title="Поделиться" icon="share" disabled={busy} secondary onPress={() => void action(() => shareVideo(video.localUri!))} /></View><View style={{ flex: 1 }}><Button title="В «Фото»" icon="image" disabled={busy} secondary onPress={() => void action(() => saveToPhotos(video.localUri!), 'Видео сохранено в «Фото».')} /></View></View>
      <Button title="Удалить видео" icon="trash-2" disabled={busy} danger onPress={() => confirmRemove(video.id)} />
    </Card>)}
  </Screen>;
}
