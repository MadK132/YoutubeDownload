import { useSyncExternalStore } from 'react';
import type { DownloadHandle, DownloadItem, VideoMetadata } from '../../types';
import { loadDownloads, removeDownload, saveDownload } from '../../database/storage';
import { directProvider } from '../providers/direct';
import { historyUrl } from '../providers/policy';
import { cleanPartialDownloads, deleteVideo } from './transport';
import { importVideo } from '../storage/media';

type State = { items: DownloadItem[]; ready: boolean; error?: string };
let state: State = { items: [], ready: false };
const listeners = new Set<() => void>();
const sources = new Map<string, VideoMetadata>();
let active: { id: string; handle?: DownloadHandle } | undefined;
let initialized: Promise<void> | undefined;
let persistence = Promise.resolve();
const emit = (next: State) => { state = next; listeners.forEach(listener => listener()); };
const persist = (item: DownloadItem) => {
  persistence = persistence.then(() => saveDownload(item)).catch(() => {
    emit({ ...state, error: 'Не удалось сохранить историю. Проверьте свободное место.' });
  });
};
function update(id: string, patch: Partial<DownloadItem>, save = true) {
  const existing = state.items.find(item => item.id === id);
  if (!existing) return;
  const item = { ...existing, ...patch };
  emit({ ...state, items: state.items.map(row => row.id === id ? item : row) });
  if (save) persist(item);
}

export function initializeDownloads(): Promise<void> {
  initialized ??= (async () => {
    try {
      await cleanPartialDownloads();
      const items = await loadDownloads();
      for (const item of items) {
        if (item.status === 'Downloading' || item.status === 'Pending') {
          item.status = 'Failed'; item.speed = 0;
          item.error = 'Загрузка прервана при закрытии приложения. Вставьте исходную ссылку ещё раз.';
          await saveDownload(item);
        }
      }
      emit({ items, ready: true });
    } catch {
      emit({ items: [], ready: false, error: 'Не удалось открыть хранилище. Перезапустите приложение.' });
    }
  })();
  return initialized;
}

export function useDownloads() {
  return useSyncExternalStore(callback => { listeners.add(callback); return () => { listeners.delete(callback); }; }, () => state, () => state);
}

export function enqueue(metadata: VideoMetadata): void {
  if (!state.ready) throw new Error('Хранилище ещё не готово.');
  if (state.items.some(item => ['Pending', 'Downloading'].includes(item.status) && sources.get(item.id)?.url === metadata.url)) {
    throw new Error('Это видео уже находится в очереди.');
  }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const item: DownloadItem = {
    id, sourceUrl: historyUrl(metadata.sourceUrl || metadata.url), title: metadata.title, format: metadata.format,
    quality: metadata.quality, status: 'Pending', createdAt: Date.now(), received: 0, total: metadata.size || 0, speed: 0,
  };
  sources.set(id, metadata);
  emit({ ...state, items: [item, ...state.items] });
  persist(item);
  void pump();
}

async function pump() {
  if (active) return;
  const item = [...state.items].reverse().find(row => row.status === 'Pending');
  if (!item) return;
  const source = sources.get(item.id);
  if (!source) { update(item.id, { status: 'Failed', error: 'Вставьте исходную ссылку заново.' }); void pump(); return; }
  active = { id: item.id };
  update(item.id, { status: 'Downloading', error: undefined });
  let lastAt = Date.now();
  let lastBytes = 0;
  try {
    // Recheck delayed queue entries: temporary links and redirects may have changed.
    const checked = source.providerId === 'device' ? source : await directProvider.getMetadata(source.url);
    if (state.items.find(row => row.id === item.id)?.status === 'Cancelled') return;
    const handle = directProvider.download(checked, item.id, (received, total) => {
      const now = Date.now();
      if (now - lastAt < 250) return;
      const speed = Math.max(0, (received - lastBytes) * 1000 / (now - lastAt));
      lastAt = now; lastBytes = received;
      update(item.id, { received, total, speed }, false);
    });
    active.handle = handle;
    const result = await handle.result;
    if (state.items.find(row => row.id === item.id)?.status === 'Cancelled') { await deleteVideo(result.uri); return; }
    update(item.id, { status: 'Completed', localUri: result.uri, received: result.size, total: result.size, speed: 0 });
    sources.delete(item.id);
  } catch (error) {
    if (state.items.find(row => row.id === item.id)?.status !== 'Cancelled') {
      update(item.id, { status: 'Failed', speed: 0, error: error instanceof Error ? error.message : 'Загрузка не удалась.' });
    }
  } finally { active = undefined; void pump(); }
}

export async function cancelDownload(id: string): Promise<void> {
  const item = state.items.find(row => row.id === id);
  if (!item || !['Pending', 'Downloading'].includes(item.status)) return;
  update(id, { status: 'Cancelled', speed: 0, error: undefined });
  if (active?.id === id) await active.handle?.cancel();
}

export function retryDownload(id: string): void {
  const item = state.items.find(row => row.id === id);
  if (!item || !['Failed', 'Cancelled'].includes(item.status)) return;
  if (active?.id === id) throw new Error('Отмена ещё выполняется. Повторите через несколько секунд.');
  if (!sources.has(id)) throw new Error('Вставьте исходную ссылку на главном экране. Временные токены не сохраняются в истории.');
  update(id, { status: 'Pending', received: 0, speed: 0, error: undefined });
  void pump();
}

export async function removeItem(id: string): Promise<void> {
  const item = state.items.find(row => row.id === id);
  if (!item || ['Pending', 'Downloading'].includes(item.status)) return;
  if (active?.id === id) throw new Error('Дождитесь завершения отмены перед удалением записи.');
  if (item.localUri) await deleteVideo(item.localUri);
  await persistence;
  await removeDownload(id);
  sources.delete(id);
  emit({ ...state, items: state.items.filter(row => row.id !== id) });
}

export async function importFromDevice(): Promise<void> {
  if (!state.ready) throw new Error('Хранилище ещё не готово.');
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const result = await importVideo(id);
  if (!result) return;
  const item: DownloadItem = {
    id, sourceUrl: '', title: result.title, format: result.format, quality: 'Original',
    status: 'Completed', createdAt: Date.now(), received: result.size, total: result.size, speed: 0, localUri: result.uri,
  };
  try { await saveDownload(item); } catch (error) { await deleteVideo(result.uri); throw error; }
  emit({ ...state, items: [item, ...state.items] });
}
