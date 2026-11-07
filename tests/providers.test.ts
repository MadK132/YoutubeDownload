import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertContentUrl, historyUrl, isAdvertising, isVideoHeader, isYouTube, parseSource, videoFormat } from '../src/services/providers/policy';
import { inspectSource } from '../src/services/providers/inspect';

test('known ad domains and their subdomains are blocked without network requests', async () => {
  const request: typeof fetch = async () => { assert.fail('An advertising URL must not reach fetch'); };
  for (const url of ['https://doubleclick.net/movie.mp4', 'https://cdn.doubleclick.net/movie.mp4', 'https://example.com/ads/clip.mp4', 'https://example.com/%61ds/clip.mp4', 'https://example.com/preroll.mp4', 'https://example.com/movie.mp4?role=ad']) {
    await assert.rejects(inspectSource(url, undefined, request), /реклам/i);
  }
});

test('ordinary words containing ad and similar domain suffixes do not block content', () => {
  for (const url of ['https://example.com/downloads/road.mp4', 'https://example.com/adventure.mp4', 'https://doubleclick.net.example.com/film.mp4', 'https://notdoubleclick.net/film.mp4', 'https://example.com/clip.mp4?title=adventure']) {
    assert.equal(isAdvertising(new URL(url)), false, url);
  }
});

test('direct-file provider directs VK pages away from a blind HEAD request', async () => {
  const request: typeof fetch = async () => { assert.fail('Known unsupported video pages must not reach fetch'); };
  for (const url of ['https://vkvideo.ru/video-56169357_456267154', 'https://m.vk.com/video123_456?ref=test', 'https://vk.ru/clip-123_456']) {
    await assert.rejects(inspectSource(url, undefined, request), /страница VK Видео/);
  }
  assert.equal(assertContentUrl('https://vkvideo.ru/my-video.mp4').pathname, '/my-video.mp4');
  assert.equal(assertContentUrl('https://vkvideo.ru.example.com/video-123_456').hostname, 'vkvideo.ru.example.com');
});

test('unsafe schemes, embedded credentials and malformed addresses are rejected', () => {
  for (const url of ['file:///a.mp4', 'javascript:alert(1)', 'http://example.com/a.mp4', 'https://user:secret@example.com/a.mp4', 'example.com/a.mp4']) {
    assert.throws(() => parseSource(url));
  }
});

test('YouTube uses exact host boundaries', () => {
  for (const host of ['youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com']) {
    assert.equal(isYouTube(new URL(`https://${host}/watch`)), true);
    assert.throws(() => assertContentUrl(`https://${host}/watch`), /YouTube/);
  }
  assert.equal(isYouTube(new URL('https://youtube.com.example.org/movie.mp4')), false);
});

test('HTML, playlists and executables are not accepted based on .mp4 filename alone', () => {
  for (const mime of ['text/html', 'application/json', 'application/vnd.apple.mpegurl', 'application/x-msdownload']) {
    assert.throws(() => videoFormat(mime, '/movie.mp4'));
  }
  assert.equal(videoFormat('video/mp4; charset=binary', '/stream'), 'mp4');
  assert.equal(videoFormat('video/quicktime', '/stream'), 'mov');
  assert.equal(videoFormat('application/octet-stream', '/movie.MP4'), 'mp4');
  assert.throws(() => videoFormat(null, '/stream'));
});

test('temporary authentication parameters and fragments are not retained in history', () => {
  assert.equal(historyUrl('https://example.com/movie.mp4?token=secret&signature=hidden#password'), 'https://example.com/movie.mp4');
});

function mockResponse(url: string, headers: Record<string, string> = {}, status = 200): typeof fetch {
  return async (_input, options) => {
    assert.equal(options?.method, 'HEAD', 'Metadata inspection must never download a response body');
    const response = new Response(null, { status, headers });
    Object.defineProperty(response, 'url', { value: url });
    return response;
  };
}

test('redirect to known advertisement is rejected before enqueue', async () => {
  await assert.rejects(inspectSource('https://example.com/movie.mp4', undefined, mockResponse('https://cdn.doubleclick.net/preroll.mp4', { 'content-type': 'video/mp4' })), /реклам/i);
});

test('redirect to insecure URL or YouTube is rejected', async () => {
  for (const final of ['http://example.com/movie.mp4', 'https://youtube.com/watch?v=123']) {
    await assert.rejects(inspectSource('https://example.com/movie.mp4', undefined, mockResponse(final, { 'content-type': 'video/mp4' })));
  }
});

test('explicit advertising metadata excludes otherwise ordinary MP4', async () => {
  await assert.rejects(inspectSource('https://example.com/clip.mp4', undefined, mockResponse('https://example.com/clip.mp4', { 'content-type': 'video/mp4', 'x-content-role': 'advertisement' })), /реклам/i);
});

test('real metadata reports only Original, size and format actually returned', async () => {
  const video = await inspectSource('https://example.com/movie.mp4', undefined, mockResponse('https://cdn.example.com/road.MOV?token=secret', { 'content-type': 'video/quicktime', 'content-length': '2000000' }));
  assert.equal(video.title, 'road.MOV');
  assert.equal(video.format, 'mov');
  assert.equal(video.size, 2000000);
  assert.equal(video.quality, 'Original');
  assert.equal(video.adCheck, 'no-known-signals');
});

test('missing or invalid length is shown as unknown, not a fabricated zero-size video', async () => {
  for (const length of ['', '-1', 'invalid']) {
    const video = await inspectSource('https://example.com/a.mp4', undefined, mockResponse('https://example.com/a.mp4', { 'content-type': 'video/mp4', 'content-length': length }));
    assert.equal(video.size, undefined);
  }
});

test('unavailable HEAD does not trigger an unbounded GET download', async () => {
  await assert.rejects(inspectSource('https://example.com/a.mp4', undefined, mockResponse('https://example.com/a.mp4', {}, 405)), /HEAD/);
});

test('network failures do not leak signed URLs or native error details into history', async () => {
  const request: typeof fetch = async () => { throw new Error('https://example.com/a.mp4?secret=123'); };
  await assert.rejects(inspectSource('https://example.com/a.mp4?secret=123', undefined, request), error => error instanceof Error && !error.message.includes('secret'));
});

test('abort signal reaches inspection transport', async () => {
  const controller = new AbortController();
  controller.abort();
  const request: typeof fetch = async (_input, options) => {
    assert.equal(options?.signal?.aborted, true);
    throw new Error('aborted');
  };
  await assert.rejects(inspectSource('https://example.com/a.mp4', controller.signal, request), /отменена/);
});

test('container inspection rejects HTML/XML even when server claims video MIME', () => {
  assert.equal(isVideoHeader(new TextEncoder().encode('<!DOCTYPE html><html>')), false);
  assert.equal(isVideoHeader(new TextEncoder().encode('<?xml version="1.0"?>')), false);
  assert.equal(isVideoHeader(new TextEncoder().encode('\x00\x00\x00\x18ftypisom')), true);
  assert.equal(isVideoHeader(new TextEncoder().encode('\x00\x00\x00\x18moov0000')), true);
  assert.equal(isVideoHeader(new Uint8Array([1, 2, 3])), false);
});
