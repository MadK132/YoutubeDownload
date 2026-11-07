import * as SQLite from 'expo-sqlite';
import type { DownloadItem, ThemeMode } from '../types';

let database: Promise<SQLite.SQLiteDatabase> | undefined;
async function db() {
  database ??= (async () => {
    const connection = await SQLite.openDatabaseAsync('pocket-video.db');
    await connection.execAsync(`PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS downloads (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    return connection;
  })();
  return database;
}
export async function loadDownloads(): Promise<DownloadItem[]> {
  const rows = await (await db()).getAllAsync<{ data: string }>('SELECT data FROM downloads');
  return rows.map(row => JSON.parse(row.data) as DownloadItem).sort((a, b) => b.createdAt - a.createdAt);
}
export async function saveDownload(item: DownloadItem): Promise<void> {
  await (await db()).runAsync('INSERT OR REPLACE INTO downloads (id, data) VALUES (?, ?)', item.id, JSON.stringify(item));
}
export async function removeDownload(id: string): Promise<void> {
  await (await db()).runAsync('DELETE FROM downloads WHERE id = ?', id);
}
export async function loadTheme(): Promise<ThemeMode> {
  const row = await (await db()).getFirstAsync<{ value: string }>("SELECT value FROM preferences WHERE key = 'theme'");
  return row?.value === 'light' ? 'light' : 'dark';
}
export async function saveTheme(theme: ThemeMode): Promise<void> {
  await (await db()).runAsync("INSERT OR REPLACE INTO preferences (key, value) VALUES ('theme', ?)", theme);
}
