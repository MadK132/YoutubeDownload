import type { PlatformVideo } from './platform';
import type { DeviceSource } from './deviceTypes';
export async function inspectOnDevice(_source: PlatformVideo, _signal?: AbortSignal): Promise<DeviceSource> {
  throw new Error('Автономная загрузка YouTube/VK работает в установленном приложении на iPhone. В веб-превью доступен плеер; браузер не разрешает читать его потоки.');
}
