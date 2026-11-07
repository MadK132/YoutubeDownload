import type { DeviceSource } from './deviceTypes';
import { assertPlatformIdentity, type PlatformVideo } from './platform';
import { assertContentUrl } from './policy';

export const safariAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';

export async function responseText(response: Response): Promise<string> {
  const data = await response.arrayBuffer();
  if (!response.headers.get('content-type')?.toLowerCase().includes('windows-1251')) return new TextDecoder().decode(data);
  // Hermes' TextDecoder may support UTF-8 only. Decode this page without a server.
  const cp1251 = 'ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—\u0098™љ›њќћџ\u00a0ЎўЈ¤Ґ¦§Ё©Є«¬\u00ad®Ї°±Ііґµ¶·ё№є»јЅѕїАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя';
  return Array.from(new Uint8Array(data), byte => byte < 128 ? String.fromCharCode(byte) : cp1251[byte - 128]).join('');
}

export function extractJsonObject(html: string, marker: RegExp): Record<string, unknown> {
  const matched = marker.exec(html);
  if (!matched) throw new Error('VK не предоставил сведения плеера. Запустите ролик в плеере и повторите.');
  const start = html.indexOf('{', matched.index + matched[0].length);
  let depth = 0; let quoted = false; let escaped = false;
  for (let index = start; index >= 0 && index < html.length; index++) {
    const character = html[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === '{') depth++;
    else if (character === '}' && --depth === 0) return JSON.parse(html.slice(start, index + 1)) as Record<string, unknown>;
  }
  throw new Error('VK вернул неполные сведения плеера.');
}

export function vkSourceFromPlayer(source: PlatformVideo, player: Record<string, unknown>): DeviceSource {
  const params = Array.isArray(player.params) ? player.params[0] as Record<string, unknown> | undefined : undefined;
  if (source.provider !== 'vk' || !params) throw new Error('Не удалось прочитать основной ролик VK.');
  assertPlatformIdentity(source, `${params.oid}_${params.vid}`, { ad: params.is_ad === true || params.is_ad === 1 || params.is_advertisement === true, live: Number(params.live) === 2, drm: !!(params.drm || params.drm_license_url) });
  const formats: { height: number; url: string }[] = [];
  for (const [key, value] of Object.entries(params)) {
    const height = Number(/^(?:url|cache)(\d+)$/.exec(key)?.[1]);
    if (!Number.isSafeInteger(height) || height < 1 || height > 1080 || typeof value !== 'string') continue;
    const url = value.startsWith('//') ? `https:${value}` : value;
    try { assertContentUrl(url); formats.push({ height, url }); } catch { /* Exclude insecure URLs and explicit advertisements. */ }
  }
  if (!formats.length) throw new Error('VK не предоставил прямых MP4 для этого ролика. Попробуйте другое публичное видео.');
  const entities: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
  const title = String(params.md_title || params.title || 'VK Видео').replace(/&(#\d+|#x[\da-f]+|amp|quot|apos|lt|gt);/gi, (entity, key: string) => {
    if (!key.startsWith('#')) return entities[key.toLowerCase()] || entity;
    const code = key[1]?.toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  }).slice(0, 160);
  return {
    info: { source, title, duration: Number(params.duration) || undefined, heights: [...new Set(formats.map(format => format.height))].sort((a, b) => a - b) },
    async materialize(height, signal) {
      if (signal?.aborted) throw new Error('Проверка отменена.');
      const format = formats.find(format => format.height === height);
      if (!format) throw new Error('Выбранное качество недоступно.');
      return { url: format.url, sourceUrl: source.url, title, format: 'mp4', quality: `${height}p`, providerId: 'device', adCheck: 'source-video-id', headers: { Referer: source.url, 'User-Agent': safariAgent } };
    },
  };
}

export async function inspectVK(source: PlatformVideo, signal?: AbortSignal, request: typeof fetch = fetch): Promise<DeviceSource> {
  const requestSignal = AbortSignal.any(signal ? [signal, AbortSignal.timeout(30000)] : [AbortSignal.timeout(30000)]);
  const endpoint = 'https://vk.com/al_video.php';
  const api = await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': safariAgent, Referer: endpoint }, body: new URLSearchParams({ act: 'show', video: source.id, al: '1' }).toString(), signal: requestSignal });
  if (api.ok) {
    const text = await responseText(api);
    try {
      const parsed = JSON.parse(text.replace(/^<!--/, '')) as { payload?: [number | string, unknown[]] };
      const payload = parsed.payload?.[1];
      const options = payload?.at(-1) as { player?: Record<string, unknown> } | undefined;
      if (options?.player) return vkSourceFromPlayer(source, options.player);
    } catch (error) {
      if (error instanceof Error && /другой ролик|реклам|DRM|эфиры/.test(error.message)) throw error;
    }
  }
  const response = await request(source.embedUrl, { headers: { 'User-Agent': safariAgent, Referer: source.url }, signal: requestSignal });
  if (!response.ok) throw new Error(`VK не передал сведения о видео (HTTP ${response.status}).`);
  const html = await responseText(response);
  if (html.length > 8_000_000) throw new Error('VK вернул слишком большой ответ.');
  const player = extractJsonObject(html, /\b(?:var\s+)?playerParams\s*=/);
  return vkSourceFromPlayer(source, player);
}
