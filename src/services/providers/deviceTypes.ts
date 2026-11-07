import type { VideoMetadata } from '../../types';
import type { PlatformInfo } from './platform';

export interface MediaPart { url: string; size?: number; headers?: Record<string, string> }
export interface DeviceSource {
  info: PlatformInfo;
  materialize(height: number, signal?: AbortSignal): Promise<VideoMetadata>;
}
