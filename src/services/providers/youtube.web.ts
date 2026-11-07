import type { PlatformVideo } from './platform';
import type { DeviceSource } from './deviceTypes';
export async function inspectYouTube(_source: PlatformVideo, _signal?: AbortSignal): Promise<DeviceSource> {
  throw new Error('Скачивание YouTube без сервера выполняется в установленном приложении на iPhone. Браузер блокирует чтение потоков стороннего плеера.');
}
