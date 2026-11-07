import { Innertube, Platform, Log } from 'youtubei.js/agnostic';
import type { DeviceSource } from './deviceTypes';
import { assertPlatformIdentity, type PlatformVideo } from './platform';
import { assertContentUrl } from './policy';

type Evaluator = (script: string) => Promise<Record<string, string>>;
type Info = Awaited<ReturnType<Innertube['getBasicInfo']>>;
type Format = NonNullable<Info['streaming_data']>['formats'][number];
function safeFormat(format: Format) {
  return !format.drm_families?.length && !format.fair_play_key_uri && !format.drm_track_type && !format.is_type_otf;
}

export async function inspectYouTubeCore(source: PlatformVideo, evaluate: Evaluator, request: typeof fetch = fetch, signal?: AbortSignal): Promise<DeviceSource> {
  if (source.provider !== 'youtube') throw new Error('Нужна ссылка на YouTube.');
  Log.setLevel(Log.Level.NONE);
  Platform.shim.eval = data => evaluate(data.output);
  const boundedFetch: typeof fetch = (input, options) => {
    const signals = [AbortSignal.timeout(30000)];
    if (signal) signals.push(signal);
    if (options?.signal) signals.push(options.signal);
    return request(input, { ...options, signal: AbortSignal.any(signals) });
  };
  const tube = await Innertube.create({ generate_session_locally: true, retrieve_player: true, fetch: boundedFetch, lang: 'ru', location: 'US' });
  const details = await tube.getBasicInfo(source.id, { client: 'IOS' });
  if (details.playability_status?.status !== 'OK') throw new Error('YouTube не разрешил воспроизведение этого ролика без входа.');
  assertPlatformIdentity(source, details.basic_info.id || '', { live: details.basic_info.is_live });
  if (details.basic_info.is_live || details.basic_info.is_private) throw new Error('Прямые эфиры и закрытые видео пока не поддерживаются.');
  const formats = [...(details.streaming_data?.formats || []), ...(details.streaming_data?.adaptive_formats || [])].filter(safeFormat);
  const video = formats.filter(format => format.has_video && format.mime_type.includes('video/mp4') && format.mime_type.includes('avc1') && format.height && format.height <= 1080 && (format.url || format.signature_cipher || format.cipher));
  const audio = formats.filter(format => format.has_audio && !format.has_video && format.mime_type.includes('audio/mp4') && !format.is_drc).sort((a, b) => b.bitrate - a.bitrate)[0];
  const usable = video.filter(format => format.has_audio || audio);
  if (!usable.length) throw new Error('YouTube не предоставил доступных MP4-дорожек. Попробуйте открыть и запустить ролик в плеере.');
  const heights = [...new Set(usable.map(format => format.height!))].sort((a, b) => a - b);
  return {
    info: { source, title: details.basic_info.title || 'Видео YouTube', duration: details.basic_info.duration, thumbnail: details.basic_info.thumbnail?.[0]?.url, heights },
    async materialize(height, materializeSignal) {
      if (materializeSignal?.aborted) throw new Error('Подготовка отменена.');
      const selected = usable.filter(format => format.height === height).sort((a, b) => Number(b.has_audio) - Number(a.has_audio) || b.bitrate - a.bitrate)[0];
      if (!selected) throw new Error('Выбранное качество больше недоступно.');
      const url = await selected.decipher(tube.session.player);
      assertContentUrl(url);
      const audioUrl = selected.has_audio ? undefined : await audio!.decipher(tube.session.player);
      if (audioUrl) assertContentUrl(audioUrl);
      if (materializeSignal?.aborted) throw new Error('Подготовка отменена.');
      return { url, sourceUrl: source.url, providerId: 'device', title: details.basic_info.title || 'Видео YouTube', format: 'mp4', quality: `${height}p`, size: selected.content_length, adCheck: 'source-video-id', audio: audioUrl ? { url: audioUrl, size: audio?.content_length } : undefined };
    },
  };
}
