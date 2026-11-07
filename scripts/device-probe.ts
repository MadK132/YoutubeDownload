import { runInNewContext } from 'node:vm';
import { Innertube, Platform } from 'youtubei.js';
import { Log } from 'youtubei.js';
import { inspectYouTubeCore } from '../src/services/providers/youtubeCore';
import { inspectVK, extractJsonObject, safariAgent } from '../src/services/providers/vk';
import { platformVideo } from '../src/services/providers/platform';

async function main() {
  void Innertube; // Load Node's platform shim only in this development diagnostic.
  if (process.argv.includes('--native-headers')) Platform.shim.server = false;
  const source = platformVideo(process.argv[2] || '');
  if (!source) throw new Error('Provide a YouTube or VK video URL.');
  if (process.argv.includes('--yt-status')) {
    Log.setLevel(Log.Level.NONE);
    const tube = await Innertube.create({ generate_session_locally: true, retrieve_player: false });
    for (const client of ['ANDROID_VR', 'TV', 'IOS', 'WEB'] as const) {
      try {
        const info = await tube.getBasicInfo(source.id, { client });
        console.log(JSON.stringify({ client, id: info.basic_info.id, status: info.playability_status?.status, reason: info.playability_status?.reason, formats: info.streaming_data?.formats?.length, adaptive: info.streaming_data?.adaptive_formats?.length }));
      } catch (error) { console.log(client, error instanceof Error ? error.message : 'failed'); }
    }
    return;
  }
  if (process.argv.includes('--vk-fields')) {
    const raw = await (await fetch('https://vk.com/al_video.php', { method: 'POST', headers: { 'User-Agent': safariAgent, 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded', Referer: 'https://vk.com/al_video.php' }, body: new URLSearchParams({ act: 'show', video: source.id, al: '1' }).toString() })).text();
    const parsed = JSON.parse(raw.replace(/^<!--/, ''));
    const payload = parsed.payload?.[1]?.at(-1)?.player;
    if (!payload) { console.log(JSON.stringify(parsed.payload?.[1]?.map((item: unknown) => ({ type: typeof item, keys: item && typeof item === 'object' ? Object.keys(item) : undefined })), null, 2)); return; }
    const data = (payload.params as Record<string, unknown>[])[0]!;
    console.log(JSON.stringify({ keys: Object.keys(data), oid: data.oid, vid: data.vid, id: data.id }, null, 2));
    return;
  }
  const resolved = source.provider === 'youtube'
    ? await inspectYouTubeCore(source, async script => runInNewContext(script, { URL, URLSearchParams, TextEncoder, TextDecoder, atob, btoa }, { timeout: 15000 }) as Record<string, string>)
    : await inspectVK(source);
  console.log(JSON.stringify(resolved.info, null, 2));
  const metadata = await resolved.materialize(resolved.info.heights[0]!);
  for (const [role, part] of [['video', metadata], ['audio', metadata.audio]] as const) {
    if (!part) continue;
    const full = process.argv.includes('--download-small') && (resolved.info.duration || Infinity) <= 60;
    const response = await fetch(part.url, { headers: { ...part.headers, ...(full ? {} : { Range: 'bytes=0-31' }) }, signal: AbortSignal.timeout(30000) });
    if (!full && response.status !== 206 && Number(response.headers.get('content-length')) > 1024) {
      await response.body?.cancel();
      throw new Error('The server ignored the small diagnostic range; no full download requested.');
    }
    const header = new Uint8Array(await response.arrayBuffer());
    console.log(JSON.stringify({ role, status: response.status, mime: response.headers.get('content-type'), bytes: header.length, atom: String.fromCharCode(...header.slice(4, 8)) }));
    if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
  }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
