import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJsonObject, inspectVK, responseText, vkSourceFromPlayer } from '../src/services/providers/vk';
import { platformVideo } from '../src/services/providers/platform';

const source = platformVideo('https://vkvideo.ru/video-123_456')!;
const params = { oid: -123, vid: 456, md_title: 'Видео &#9658; пример', duration: 300, url360: 'https://cdn.example.com/a.mp4', url720: 'https://cdn.example.com/b.mp4', url2160: 'https://cdn.example.com/c.mp4', urlAd: 'https://doubleclick.net/ad.mp4' };

test('VK parses nested JSON and braces inside strings without eval', () => {
  const value = { params: [{ ...params, description: 'quoted " { nested }' }], ads: { url: 'https://doubleclick.net/ad.mp4' } };
  assert.deepEqual(extractJsonObject(`prefix var playerParams = ${JSON.stringify(value)}; other()`, /playerParams\s*=/), value);
  assert.throws(() => extractJsonObject('var playerParams = {', /playerParams\s*=/));
});

test('VK exposes main-content MP4 qualities and ignores separate ad configuration', async () => {
  const resolved = vkSourceFromPlayer(source, { params: [params], ads: { url: 'https://doubleclick.net/ad.mp4' } });
  assert.deepEqual(resolved.info.heights, [360, 720]);
  assert.equal(resolved.info.title, 'Видео ► пример');
  const file = await resolved.materialize(720);
  assert.equal(file.url, params.url720);
  assert.equal(file.sourceUrl, source.url);
  assert.equal(file.providerId, 'device');
  assert.equal(file.audio, undefined);
  await assert.rejects(resolved.materialize(1080));
});

test('VK does not accept mismatched video ID, ad, live or protected content', () => {
  for (const patch of [{ vid: 999 }, { is_ad: 1 }, { live: 2 }, { drm: true }]) {
    assert.throws(() => vkSourceFromPlayer(source, { params: [{ ...params, ...patch }] }));
  }
  assert.throws(() => vkSourceFromPlayer(source, { params: [{ oid: -123, vid: 456, url360: 'https://doubleclick.net/ad.mp4' }] }));
});

test('VK obtains streams directly using its public player response, without a companion', async () => {
  let calls = 0;
  const request: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://vk.com/al_video.php');
    assert.equal(init?.method, 'POST');
    assert.match(String(init?.body), /video=-123_456/);
    return Response.json({ payload: [0, ['title', '<html/>', { player: { params: [params] } }]] });
  };
  assert.deepEqual((await inspectVK(source, undefined, request)).info.heights, [360, 720]);
  assert.equal(calls, 1);
});

test('VK Windows-1251 Cyrillic is decoded without relying on Hermes encoding support', async () => {
  const response = new Response(Uint8Array.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2, 0x20, 0xa8, 0xb8]), { headers: { 'Content-Type': 'text/html; charset=windows-1251' } });
  assert.equal(await responseText(response), 'Привет Ёё');
});
