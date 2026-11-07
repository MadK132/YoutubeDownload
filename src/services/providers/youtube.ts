import { Platform } from 'youtubei.js/react-native';
import * as Crypto from 'expo-crypto';
import { requirePocketMedia } from '../../../modules/pocket-media';
import { inspectYouTubeCore } from './youtubeCore';
import type { PlatformVideo } from './platform';

export async function inspectYouTube(source: PlatformVideo, signal?: AbortSignal) {
  const media = requirePocketMedia();
  Platform.shim.uuidv4 = Crypto.randomUUID;
  Platform.shim.sha1Hash = value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, value);
  try { return await inspectYouTubeCore(source, script => media.evaluate(script), fetch, signal); }
  catch (error) {
    if (signal?.aborted) throw new Error('Проверка отменена.');
    if (error instanceof Error && /YouTube|ролик|дорож|качеств|эфир/i.test(error.message)) throw error;
    throw new Error('Не удалось получить потоки YouTube на устройстве. Проверьте доступность ролика и попробуйте ещё раз.');
  }
}
