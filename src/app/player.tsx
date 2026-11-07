import { useLocalSearchParams, router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { useEventListener } from 'expo';
import { View } from 'react-native';
import { Button, Label, Notice, Screen } from '../components/ui';
import { useDownloads } from '../services/download/manager';

function Player({ uri }: { uri: string }) {
  const [error, setError] = useState('');
  const player = useVideoPlayer(uri, instance => { instance.play(); });
  useEventListener(player, 'statusChange', event => { if (event.status === 'error') setError('Не удалось воспроизвести видео. Кодек может не поддерживаться устройством. Попробуйте экспортировать файл.'); });
  return <View style={{ gap: 16 }}>{!!error && <Notice error>{error}</Notice>}<VideoView player={player} nativeControls style={{ width: '100%', height: 300, backgroundColor: '#000000', borderRadius: 18 }} allowsPictureInPicture /></View>;
}
export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items } = useDownloads();
  const item = items.find(video => video.id === id && video.status === 'Completed');
  return <Screen title="Просмотр" subtitle="Видео из вашей библиотеки."><Button title="Закрыть" secondary icon="x" onPress={() => router.back()} />{item?.localUri ? <><Label style={{ fontWeight: '600' }}>{item.title}</Label><Player uri={item.localUri} /></> : <Notice error>Видео не найдено в библиотеке.</Notice>}</Screen>;
}
