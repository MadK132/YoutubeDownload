import { test } from 'node:test';
import assert from 'node:assert/strict';
import { platformVideo, assertPlatformIdentity } from '../src/services/providers/platform';

test('YouTube canonical ID is preserved across watch, short, live and share links', () => {
  for (const value of ['https://youtu.be/BaW_jenozKc?si=tracking', 'https://m.youtube.com/watch?v=BaW_jenozKc&list=ignored', 'https://www.youtube.com/shorts/BaW_jenozKc', 'https://youtube.com/live/BaW_jenozKc']) {
    assert.equal(platformVideo(value)?.url, 'https://www.youtube.com/watch?v=BaW_jenozKc');
  }
  assert.throws(() => platformVideo('https://youtube.com/playlist?list=123'));
  assert.equal(platformVideo('https://youtube.com.evil.test/watch?v=BaW_jenozKc'), null);
});

test('VK owner and video ID remain bound to the chosen page', () => {
  const source = platformVideo('https://vkvideo.ru/video-56169357_456267154?ref=tracking');
  assert.equal(source?.id, '-56169357_456267154');
  assert.equal(source?.url, 'https://vkvideo.ru/video-56169357_456267154');
  assert.equal(source?.embedUrl, 'https://vkvideo.ru/video_ext.php?oid=-56169357&id=456267154&hd=2');
  assert.throws(() => platformVideo('https://vk.com/videos'));
  assert.throws(() => platformVideo('https://vkvideo.ru/video-1_2?role=ad'), /реклам/);
});

test('extractor cannot substitute ad or recommendation with a different video ID', () => {
  const source = platformVideo('https://youtu.be/BaW_jenozKc')!;
  assert.throws(() => assertPlatformIdentity(source, 'advertising'), /другой ролик/);
  assert.throws(() => assertPlatformIdentity(source, source.id, { live: true }), /эфиры/);
  assert.throws(() => assertPlatformIdentity(source, source.id, { ad: true }), /реклам/);
  assert.throws(() => assertPlatformIdentity(source, source.id, { drm: true }), /DRM/);
});
