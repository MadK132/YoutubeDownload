import type { DownloadItem, ThemeMode } from '../types';
export async function loadDownloads(): Promise<DownloadItem[]> { return []; }
export async function saveDownload(_item: DownloadItem): Promise<void> {}
export async function removeDownload(_id: string): Promise<void> {}
export async function loadTheme(): Promise<ThemeMode> { return localStorage.getItem('theme') === 'light' ? 'light' : 'dark'; }
export async function saveTheme(theme: ThemeMode): Promise<void> { localStorage.setItem('theme', theme); }
