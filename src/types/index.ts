export type DownloadStatus = 'Pending' | 'Downloading' | 'Completed' | 'Failed' | 'Cancelled';
export type VideoFormat = 'mp4' | 'mov';
export type ThemeMode = 'dark' | 'light';
export type Quality = 'Original' | `${number}p`;

export interface VideoMetadata {
  url: string;
  title: string;
  format: VideoFormat;
  size?: number;
  quality: Quality;
  adCheck: 'no-known-signals' | 'source-video-id';
  providerId?: 'device';
  sourceUrl?: string;
  headers?: Record<string, string>;
  thumbnail?: string;
  duration?: number;
  audio?: { url: string; size?: number; headers?: Record<string, string> };
}

export interface DownloadItem {
  id: string;
  sourceUrl: string;
  title: string;
  format: VideoFormat;
  quality: Quality;
  status: DownloadStatus;
  createdAt: number;
  received: number;
  total: number;
  speed: number;
  localUri?: string;
  error?: string;
}

export interface SourceProvider {
  id: string;
  validateUrl(value: string): boolean;
  getMetadata(value: string, signal?: AbortSignal): Promise<VideoMetadata>;
  getAvailableFormats(metadata: VideoMetadata): readonly ['Original'];
  download(metadata: VideoMetadata, id: string, progress: (received: number, total: number) => void): DownloadHandle;
}

export interface DownloadHandle {
  result: Promise<{ uri: string; size: number }>;
  cancel(): Promise<void>;
}
