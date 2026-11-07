import * as FS from 'expo-file-system/legacy';
import type { DownloadHandle, VideoMetadata } from '../../types';
import { assertContentUrl, isVideoHeader, SourceError, videoFormat } from '../providers/policy';
import { requirePocketMedia } from '../../../modules/pocket-media';

const directory = () => {
  if (!FS.documentDirectory) throw new Error('Хранилище приложения недоступно.');
  return `${FS.documentDirectory}videos/`;
};

export function startDownload(metadata: VideoMetadata, id: string, progress: (received: number, total: number) => void, audioOnly = false): DownloadHandle {
  if (metadata.audio) return downloadWithAudio(metadata, id, progress);
  let cancelled = false;
  let task: FS.DownloadResumable | undefined;
  const partial = `${directory()}${id}.part`;
  const final = `${directory()}${id}.${metadata.format}`;
  const result = (async () => {
    assertContentUrl(metadata.url);
    await FS.makeDirectoryAsync(directory(), { intermediates: true });
    if (cancelled) throw new Error('Cancelled');
    task = FS.createDownloadResumable(metadata.url, partial, { sessionType: FS.FileSystemSessionType.FOREGROUND, headers: metadata.headers }, event => {
      if (!cancelled) progress(event.totalBytesWritten, Math.max(0, event.totalBytesExpectedToWrite));
    });
    try {
      const response = await task.downloadAsync();
      if (cancelled) throw new Error('Cancelled');
      if (!response || response.status < 200 || response.status >= 300) throw new SourceError('Сервер не передал видео. Попробуйте получить новую ссылку.');
      const headers = new Headers(response.headers);
      const role = headers.get('x-content-role')?.toLowerCase();
      if (role && ['ad', 'advertisement', 'preroll', 'midroll', 'postroll'].includes(role)) throw new SourceError('Ответ загрузки обозначен как реклама. Файл не сохранён.');
      const mime = headers.get('content-type')?.split(';')[0]?.toLowerCase();
      if (audioOnly) {
        if (mime !== 'audio/mp4' && mime !== 'application/octet-stream') throw new SourceError('Источник вернул неподдерживаемую аудиодорожку.');
      } else {
        const actualFormat = videoFormat(mime || null, new URL(metadata.url).pathname);
        if (actualFormat !== metadata.format) throw new SourceError('Формат изменился после проверки. Проверьте ссылку заново.');
      }
      const info = await FS.getInfoAsync(partial);
      if (!info.exists || info.isDirectory || info.size < 12) throw new SourceError('Сервер вернул пустой или повреждённый файл.');
      const header = await FS.readAsStringAsync(partial, { encoding: FS.EncodingType.Base64, position: 0, length: 32 });
      const bytes = Uint8Array.from(atob(header), character => character.charCodeAt(0));
      if (!isVideoHeader(bytes)) throw new SourceError('Сервер вернул не видео MP4/MOV. Файл не сохранён.');
      if (cancelled) throw new Error('Cancelled');
      await FS.moveAsync({ from: partial, to: final });
      if (cancelled) { await FS.deleteAsync(final, { idempotent: true }); throw new Error('Cancelled'); }
      return { uri: final, size: info.size };
    } catch (error) {
      if (error instanceof SourceError || cancelled) throw error;
      throw new SourceError('Не удалось загрузить видео. Проверьте подключение, свободное место и срок действия ссылки.');
    } finally {
      await FS.deleteAsync(partial, { idempotent: true }).catch(() => {});
    }
  })();
  return { result, async cancel() {
    cancelled = true;
    await task?.cancelAsync();
  } };
}

function downloadWithAudio(metadata: VideoMetadata, id: string, progress: (received: number, total: number) => void): DownloadHandle {
  let current: DownloadHandle | undefined;
  let cancelled = false;
  let merging = false;
  const videoPath = `${directory()}${id}-video.mp4`;
  const audioPath = `${directory()}${id}-audio.mp4`;
  const outputPath = `${directory()}${id}.mp4`;
  const result = (async () => {
    const native = requirePocketMedia();
    try {
      const audio = metadata.audio!;
      assertContentUrl(audio.url);
      current = startDownload({ ...metadata, audio: undefined }, `${id}-video`, (received, total) => progress(received, total && audio.size ? total + audio.size : 0));
      const picture = await current.result;
      if (cancelled) throw new SourceError('Загрузка отменена.');
      current = startDownload({ ...metadata, url: audio.url, audio: undefined, headers: audio.headers, size: audio.size }, `${id}-audio`, (received, total) => progress(picture.size + received, total ? picture.size + total : 0), true);
      const sound = await current.result;
      if (cancelled) throw new SourceError('Загрузка отменена.');
      merging = true;
      await native.merge(picture.uri, sound.uri, outputPath, id);
      if (cancelled) throw new SourceError('Загрузка отменена.');
      const file = await FS.getInfoAsync(outputPath);
      if (!file.exists || file.isDirectory || file.size < 12) throw new SourceError('Не удалось собрать MP4 на устройстве.');
      progress(file.size, file.size);
      return { uri: outputPath, size: file.size };
    } catch (error) {
      await FS.deleteAsync(outputPath, { idempotent: true }).catch(() => {});
      if (error instanceof SourceError) throw error;
      throw new SourceError('Не удалось собрать видео со звуком на iPhone. Откройте ролик заново или выберите другое качество.');
    } finally {
      await Promise.all([videoPath, audioPath].map(path => FS.deleteAsync(path, { idempotent: true }).catch(() => {})));
    }
  })();
  return { result, async cancel() {
    cancelled = true;
    if (merging) requirePocketMedia().cancel(id);
    else await current?.cancel();
  } };
}

export async function deleteVideo(uri: string): Promise<void> {
  if (!uri.startsWith(directory()) || uri.slice(directory().length).includes('/')) throw new Error('Недопустимый путь к видео.');
  await FS.deleteAsync(uri, { idempotent: true });
}

export async function cleanPartialDownloads(): Promise<void> {
  await FS.makeDirectoryAsync(directory(), { intermediates: true });
  const files = await FS.readDirectoryAsync(directory());
  await Promise.all(files.filter(file => file.endsWith('.part') || /^\d+-[a-z0-9]+-(?:video|audio)\.mp4$/.test(file)).map(file => FS.deleteAsync(`${directory()}${file}`, { idempotent: true })));
}
