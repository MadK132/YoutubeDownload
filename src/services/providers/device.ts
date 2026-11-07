import { inspectYouTube } from './youtube';
import { inspectVK } from './vk';
import type { PlatformVideo } from './platform';
import type { DeviceSource } from './deviceTypes';

export async function inspectOnDevice(source: PlatformVideo, signal?: AbortSignal): Promise<DeviceSource> {
  try { return source.provider === 'youtube' ? await inspectYouTube(source, signal) : await inspectVK(source, signal); }
  catch (error) {
    if (signal?.aborted) throw new Error('Проверка отменена.');
    if (error instanceof Error && /VK|YouTube|ролик|плеер|поток|IPA|Expo Go|DRM|качеств/i.test(error.message)) throw error;
    throw new Error('Не удалось получить видео на устройстве. Проверьте подключение и доступность ролика.');
  }
}
