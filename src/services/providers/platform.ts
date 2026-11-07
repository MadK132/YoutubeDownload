import { isAdvertising, isYouTube, parseSource, SourceError } from './policy';

export interface PlatformVideo { provider: 'youtube' | 'vk'; id: string; url: string; embedUrl: string }

export function platformVideo(value: string): PlatformVideo | null {
  const url = parseSource(value);
  if (isAdvertising(url)) throw new SourceError('Это рекламная ссылка. Откройте основное видео.');
  if (isYouTube(url)) {
    const id = url.hostname === 'youtu.be' ? url.pathname.slice(1).split('/')[0]
      : url.searchParams.get('v') || /^\/(?:shorts|embed|live)\/([^/]+)/.exec(url.pathname)?.[1];
    if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) throw new SourceError('Откройте отдельное видео YouTube и скопируйте его ссылку.');
    return { provider: 'youtube', id, url: `https://www.youtube.com/watch?v=${id}`, embedUrl: `https://www.youtube.com/embed/${id}?playsinline=1&rel=0` };
  }
  const vk = ['vkvideo.ru', 'vk.com', 'vk.ru'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  if (vk) {
    const match = /^\/(?:video|clip)(-?\d+)_(\d+)(?:\/|$)/.exec(url.pathname);
    if (!match) throw new SourceError('Откройте отдельное видео VK и скопируйте ссылку вида vkvideo.ru/video-123_456.');
    const id = `${match[1]}_${match[2]}`;
    return { provider: 'vk', id, url: `https://vkvideo.ru/video${id}`, embedUrl: `https://vkvideo.ru/video_ext.php?oid=${match[1]}&id=${match[2]}&hd=2` };
  }
  return null;
}

export interface PlatformInfo {
  source: PlatformVideo;
  title: string;
  thumbnail?: string;
  duration?: number;
  heights: number[];
}

export function assertPlatformIdentity(source: PlatformVideo, id: string, flags: { ad?: boolean; live?: boolean; drm?: boolean } = {}): void {
  if (flags.ad) throw new SourceError('Источник обозначил ролик как рекламу. Файл не будет скачиваться.');
  if (id !== source.id) throw new SourceError('Источник вернул другой ролик. Загрузка остановлена, чтобы не сохранить рекламу или рекомендацию.');
  if (flags.live) throw new SourceError('Прямые эфиры пока не поддерживаются.');
  if (flags.drm) throw new SourceError('Видео защищено DRM и не поддерживается.');
}
