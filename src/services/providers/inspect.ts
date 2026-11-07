import type { VideoMetadata } from '../../types';
import { assertContentUrl, SourceError, videoFormat } from './policy';

export async function inspectSource(value: string, signal?: AbortSignal, request: typeof fetch = fetch): Promise<VideoMetadata> {
  const source = assertContentUrl(value);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 20000);
  try {
    const response = await request(source.href, { method: 'HEAD', signal: controller.signal });
    if (!response.ok) throw new SourceError(response.status === 405
      ? 'Сервер не поддерживает проверку HEAD. Этот источник пока не поддерживается.'
      : `Сервер отклонил проверку видео (HTTP ${response.status}).`);
    const final = assertContentUrl(response.url || source.href);
    const role = response.headers.get('x-content-role')?.toLowerCase();
    if (role && ['ad', 'advertisement', 'preroll', 'midroll', 'postroll'].includes(role)) {
      throw new SourceError('Источник обозначил файл как рекламу. Ролик пропущен.');
    }
    const format = videoFormat(response.headers.get('content-type'), final.pathname);
    const length = Number(response.headers.get('content-length'));
    let title = final.pathname.split('/').pop() || `Видео.${format}`;
    try { title = decodeURIComponent(title); } catch { /* Keep the original filename. */ }
    return {
      url: final.href, title: title.replace(/[\u0000-\u001f]/g, '').slice(0, 160), format,
      size: Number.isSafeInteger(length) && length > 0 ? length : undefined,
      quality: 'Original', adCheck: 'no-known-signals',
    };
  } catch (error) {
    if (error instanceof SourceError) throw error;
    if (signal?.aborted) throw new SourceError('Проверка отменена.');
    throw new SourceError('Не удалось проверить ссылку. Проверьте подключение и доступность файла.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
