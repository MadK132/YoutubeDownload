import type { DownloadHandle, VideoMetadata } from '../../types';
import { assertContentUrl, isVideoHeader } from '../providers/policy';

export function startDownload(metadata: VideoMetadata, _id: string, progress: (received: number, total: number) => void): DownloadHandle {
  const controller = new AbortController();
  const result = (async () => {
    if (metadata.audio) throw new Error('Сборка видео и звука работает в приложении на iPhone.');
    assertContentUrl(metadata.url);
    const response = await fetch(metadata.url, { headers: metadata.headers, signal: controller.signal });
    if (!response.ok || !response.body) throw new Error('Не удалось получить файл. Проверьте подключение и доступность источника.');
    const total = Number(response.headers.get('content-length')) || 0;
    const reader = response.body.getReader();
    const chunks: ArrayBuffer[] = [];
    let received = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      chunks.push(chunk.value.slice().buffer as ArrayBuffer);
      received += chunk.value.byteLength; progress(received, total);
    }
    if (controller.signal.aborted) throw new Error('Загрузка отменена.');
    const blob = new Blob(chunks, { type: metadata.format === 'mov' ? 'video/quicktime' : 'video/mp4' });
    if (!isVideoHeader(new Uint8Array(await blob.slice(0, 32).arrayBuffer()))) throw new Error('Сервер вернул не видео. Файл не сохранён.');
    const uri = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = uri; anchor.download = metadata.title.toLowerCase().endsWith(`.${metadata.format}`) ? metadata.title : `${metadata.title}.${metadata.format}`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    return { uri, size: received };
  })();
  return { result, cancel: async () => controller.abort() };
}
export async function deleteVideo(uri: string): Promise<void> { if (uri.startsWith('blob:')) URL.revokeObjectURL(uri); }
export async function cleanPartialDownloads(): Promise<void> {}
