const adHosts = ['doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'imasdk.googleapis.com', 'adnxs.com', 'adsrvr.org'];
const adSegments = new Set(['ad', 'ads', 'advert', 'adverts', 'advertisement', 'advertisements', 'preroll', 'pre-roll', 'midroll', 'mid-roll', 'postroll', 'post-roll', 'adcreative']);

export class SourceError extends Error {}

export function parseSource(value: string): URL {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new SourceError('Введите полную ссылку на видео, начиная с https://.'); }
  if (url.protocol !== 'https:') throw new SourceError('Поддерживаются только безопасные ссылки HTTPS.');
  if (url.username || url.password) throw new SourceError('Ссылки с логином и паролем не поддерживаются.');
  return url;
}

export function isYouTube(url: URL): boolean {
  return ['youtube.com', 'youtu.be', 'youtube-nocookie.com'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

export function isAdvertising(url: URL): boolean {
  if (adHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) return true;
  let path = url.pathname.toLowerCase();
  try { path = decodeURIComponent(path); } catch { /* Keep the encoded path. */ }
  if (path.split('/').some(segment => adSegments.has(segment.replace(/\.(mp4|mov)$/, '')))) return true;
  for (const key of ['type', 'content_type', 'media_type', 'role']) {
    const value = url.searchParams.get(key)?.toLowerCase();
    if (value && ['ad', 'ads', 'advertisement', 'preroll', 'midroll', 'postroll'].includes(value)) return true;
  }
  return false;
}

export function assertContentUrl(value: string): URL {
  const url = parseSource(value);
  if (isYouTube(url)) throw new SourceError('Откройте это видео в YouTube. Загрузка с YouTube не поддерживается.');
  if (isAdvertising(url)) throw new SourceError('Обнаружена рекламная ссылка. Рекламный ролик пропущен; вставьте ссылку на основное видео.');
  const vkHost = ['vkvideo.ru', 'vk.com', 'vk.ru'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  if (vkHost && /^\/(?:video|clip)-?\d+_\d+(?:\/|$)/i.test(url.pathname)) {
    throw new SourceError('Это страница VK Видео, а не прямой файл MP4/MOV. Загрузка по ссылкам на страницы VK пока не поддерживается. Вставьте прямую ссылку на видеофайл.');
  }
  return url;
}

export function historyUrl(value: string): string {
  const url = parseSource(value);
  // Queries and fragments can contain temporary signatures or access tokens.
  return `${url.origin}${url.pathname}`;
}

export function videoFormat(mime: string | null, pathname: string): 'mp4' | 'mov' {
  const contentType = mime?.split(';')[0]?.trim().toLowerCase();
  if (contentType === 'video/mp4') return 'mp4';
  if (contentType === 'video/quicktime') return 'mov';
  if (contentType && !['application/octet-stream', 'binary/octet-stream'].includes(contentType)) {
    throw new SourceError('Ссылка возвращает не MP4/MOV. Нужна прямая ссылка на видео, а не страница сайта или плейлист.');
  }
  const extension = /\.(mp4|mov)$/i.exec(pathname)?.[1]?.toLowerCase();
  if (extension === 'mp4' || extension === 'mov') return extension;
  throw new SourceError('Не удалось подтвердить формат. Поддерживаются прямые MP4 и MOV.');
}

export function isVideoHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const box = String.fromCharCode(...bytes.slice(4, 8));
  // ISO-BMFF and classic QuickTime container atoms, not HTML/XML/JSON responses.
  return ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip'].includes(box);
}
