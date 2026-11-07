import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, Pressable, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Button, Card, Icon, Label, Notice, Screen, styles } from '../../components/ui';
import { useTheme } from '../../constants/theme';
import { directProvider } from '../../services/providers/direct';
import { platformVideo, type PlatformVideo } from '../../services/providers/platform';
import { inspectOnDevice } from '../../services/providers/device';
import type { DeviceSource } from '../../services/providers/deviceTypes';
import PlatformPlayer from '../../components/PlatformPlayer';
import { enqueue, useDownloads } from '../../services/download/manager';
import { bytes } from '../../utils/format';
import type { VideoMetadata } from '../../types';

export default function Home() {
  const { colors, mode } = useTheme();
  const { ready, error: storageError } = useDownloads();
  const [url, setUrl] = useState('');
  const [clipboard, setClipboard] = useState('');
  const [metadata, setMetadata] = useState<VideoMetadata>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [platform, setPlatform] = useState<PlatformVideo | null>(null);
  const [resolved, setResolved] = useState<DeviceSource>();
  const info = resolved?.info;
  const [height, setHeight] = useState(1080);
  const [playback, setPlayback] = useState<'unknown' | 'playing' | 'paused' | 'ad'>('unknown');
  const [preparing, setPreparing] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const revision = useRef(0);
  useEffect(() => {
    async function detect() {
      if (Platform.OS === 'web') return;
      try { if (await Clipboard.hasStringAsync()) { const value = (await Clipboard.getStringAsync()).trim(); if (/^https:\/\//i.test(value)) setClipboard(value); } } catch { /* Clipboard access is optional. */ }
    }
    void detect();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void detect(); });
    return () => { subscription.remove(); pending.current?.abort(); };
  }, []);
  function change(value: string) {
    revision.current++; pending.current?.abort(); setBusy(false);
    setUrl(value); setMetadata(undefined); setError(''); setPlatform(null); setResolved(undefined); setPreparing(false); setPlayback('unknown');
  }
  async function paste() {
    try { change((await Clipboard.getStringAsync()).trim()); } catch { setError('Не удалось прочитать буфер. Вставьте ссылку вручную.'); }
  }
  async function analyze() {
    pending.current?.abort();
    const version = ++revision.current;
    const controller = new AbortController(); pending.current = controller;
    setError(''); setMetadata(undefined); setPlatform(null); setResolved(undefined); setBusy(true);
    try {
      const target = platformVideo(url);
      if (target) {
        setPlatform(target);
        const result = await inspectOnDevice(target, controller.signal);
        if (version === revision.current) { setResolved(result); setHeight(result.info.heights.at(-1) || 1080); }
        return;
      }
      const result = await directProvider.getMetadata(url, controller.signal);
      if (version === revision.current) setMetadata(result);
    } catch (cause) { if (version === revision.current) setError(cause instanceof Error ? cause.message : 'Не удалось проверить ссылку.'); }
    finally { if (version === revision.current) setBusy(false); }
  }
  async function downloadPlatform() {
    if (!platform || !resolved) return;
    const version = ++revision.current;
    const controller = new AbortController(); pending.current = controller;
    setError(''); setPreparing(true);
    try {
      const video = await resolved.materialize(height, controller.signal);
      if (controller.signal.aborted) throw new Error('Подготовка отменена.');
      if (version === revision.current) { enqueue(video); router.push('/downloads'); }
    } catch (cause) { if (version === revision.current) setError(cause instanceof Error ? cause.message : 'Не удалось подготовить видео.'); }
    finally { if (version === revision.current) setPreparing(false); }
  }
  return <Screen title="Сохранить момент." subtitle="Ваши видео. Всегда под рукой." action={<View style={{ padding: 13, backgroundColor: colors.surface, borderRadius: 18 }}><Icon name="arrow-down-left" color={colors.accent} size={25} /></View>}>
    <LinearGradient colors={mode === 'dark' ? ['#253E35', '#172C29', '#162126'] : ['#DBF3E5', '#E8F2EE', '#E5EDEB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 26, padding: 24, gap: 20 }}>
      <View style={styles.row}><View style={{ flex: 1 }}><Label style={{ color: mode === 'dark' ? '#B2F5CE' : colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>МАЛЕНЬКИЙ АРХИВ. БОЛЬШЕ СВОБОДЫ.</Label></View><Icon name="arrow-down-circle" size={36} color={colors.accent} /></View>
      <Label style={{ fontSize: 25, lineHeight: 32, fontWeight: '600', maxWidth: 290 }}>Любимые видео —{ '\n' }в вашей коллекции.</Label>
      <View style={styles.row}><Icon name="hard-drive" size={15} color={colors.muted} /><Label muted style={{ fontSize: 12 }}>YouTube · VK Видео · MP4 / MOV</Label></View>
    </LinearGradient>
    {Platform.OS === 'web' && <Notice>Для автономного скачивания YouTube/VK установите приложение на iPhone. Веб-плеер доступен для просмотра; прямые MP4/MOV можно сохранить через браузер.</Notice>}
    <Card>
      <View style={styles.row}><Icon name="link" color={colors.accent} size={18} /><Label style={{ fontSize: 17, fontWeight: '600' }}>Ссылка на видео</Label></View>
      <TextInput accessibilityLabel="Ссылка на видео" value={url} onChangeText={change} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="Ссылка YouTube, VK Видео или MP4/MOV" placeholderTextColor={colors.muted} multiline style={{ backgroundColor: colors.background, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, minHeight: 82, fontSize: 14, textAlignVertical: 'top' }} />
      <View style={styles.row}><View style={{ flex: 1 }}><Button title="Вставить" icon="clipboard" onPress={() => void paste()} secondary disabled={preparing} /></View><View style={{ flex: 1.35 }}><Button title="Открыть видео" icon="play" onPress={() => void analyze()} disabled={!url.trim() || preparing} loading={busy} /></View></View>
      {!!clipboard && !url && <Pressable accessibilityRole="button" onPress={() => { change(clipboard); setClipboard(''); }}><Label style={{ fontSize: 13, color: colors.accent }}>Найдена ссылка в буфере — вставить ↗</Label></Pressable>}
      <Notice>Откройте ролик и запустите плеер. Видео скачивается на iPhone; раздельные видео и звук собираются на самом устройстве.</Notice>
    </Card>
    {!!(error || storageError) && <Notice error>{error || storageError}</Notice>}
    {platform && <Card>
      <Label style={{ fontWeight: '700', fontSize: 18 }}>{info?.title || (platform.provider === 'youtube' ? 'Видео YouTube' : 'VK Видео')}</Label>
      <PlatformPlayer video={platform} onStateChange={setPlayback} />
      <Notice>{playback === 'ad' ? 'В плеере распознана реклама. Дождитесь основного ролика: рекламный поток не будет скачиваться.' : 'Плеер может показать рекламу. В файл загружается ролик по исходному ID, а не текущий рекламный поток плеера. Вшитая реклама не вырезается.'}</Notice>
      {info && <><Label muted style={{ fontSize: 12 }}>{info.duration ? `${Math.floor(info.duration / 60)}:${String(Math.floor(info.duration % 60)).padStart(2, '0')} · ` : ''}MP4 · {platform.provider === 'youtube' ? 'YouTube' : 'VK Видео'}</Label><View style={[styles.row, { flexWrap: 'wrap' }]}>{info.heights.map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Качество ${value}p`} accessibilityState={{ selected: height === value }} disabled={preparing} onPress={() => setHeight(value)} style={{ borderRadius: 10, padding: 10, backgroundColor: height === value ? colors.accent : colors.raised }}><Label style={{ color: height === value ? colors.accentText : colors.text }}>{value}p</Label></Pressable>)}</View></>}
      {preparing ? <><Label>Подготовка дорожек на устройстве…</Label><Button title="Отменить подготовку" secondary icon="x" onPress={() => pending.current?.abort()} /></> : info ? <Button title={playback === 'ad' ? 'Дождитесь окончания рекламы' : 'Скачать основное видео'} icon="download" disabled={!ready || playback === 'ad'} onPress={() => void downloadPlatform()} /> : <Button title="Обновить сведения о видео" icon="search" disabled={busy} onPress={() => void analyze()} />}
      <Button title="Открыть на сайте" secondary icon="external-link" onPress={() => void Linking.openURL(platform.url).catch(() => setError('Не удалось открыть сайт.'))} />
    </Card>}
    {metadata && <Card>
      <View style={styles.row}><View style={{ padding: 16, backgroundColor: colors.raised, borderRadius: 17 }}><Icon name="film" size={28} color={colors.accent} /></View><View style={{ flex: 1 }}><Label style={{ fontWeight: '700' }}>{metadata.title}</Label><Label muted style={{ fontSize: 12 }}>{metadata.format.toUpperCase()} · {metadata.size ? bytes(metadata.size) : 'Размер неизвестен'}</Label></View></View>
      <View style={[styles.row, { justifyContent: 'space-between' }]}><Label muted>Качество</Label><View style={{ backgroundColor: colors.raised, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 10 }}><Label style={{ color: colors.accent, fontSize: 13 }}>✓ Original</Label></View></View>
      <Notice>Известных признаков рекламы не найдено. Для прямого файла без метаданных отсутствие рекламы не гарантируется. Разрешение и длительность источник не сообщил.</Notice>
      <Button title="Скачать видео" icon="download" disabled={!ready} onPress={() => { try { enqueue(metadata); setMetadata(undefined); router.push('/downloads'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось добавить видео.'); } }} />
    </Card>}
    <View style={{ gap: 16, paddingHorizontal: 4 }}><Label style={{ fontWeight: '600' }}>Только нужное видео</Label><View style={styles.row}><Icon name="filter" color={colors.accent} /><Label muted style={{ flex: 1, fontSize: 13 }}>Распознанные рекламные ссылки исключаются до добавления в очередь.</Label></View><View style={styles.row}><Icon name="lock" color={colors.accent} /><Label muted style={{ flex: 1, fontSize: 13 }}>История хранится на устройстве. Без облака и регистрации.</Label></View></View>
  </Screen>;
}
