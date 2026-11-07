import type { SourceProvider, VideoMetadata } from '../../types';
import { assertContentUrl } from './policy';
import { startDownload } from '../download/transport';
import { inspectSource } from './inspect';

export const directProvider: SourceProvider = {
  id: 'direct',
  validateUrl(value) { try { assertContentUrl(value); return true; } catch { return false; } },
  getMetadata: inspectSource,
  getAvailableFormats(_metadata: VideoMetadata) { return ['Original']; },
  download: startDownload,
};
