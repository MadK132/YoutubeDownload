import * as FS from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { isVideoHeader, SourceError, videoFormat } from '../providers/policy';

export async function shareVideo(uri: string): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error('Системное меню экспорта недоступно.');
  await Sharing.shareAsync(uri, { mimeType: uri.endsWith('.mov') ? 'video/quicktime' : 'video/mp4', UTI: uri.endsWith('.mov') ? 'com.apple.quicktime-movie' : 'public.mpeg-4' });
}
export async function saveToPhotos(uri: string): Promise<void> {
  const permission = await MediaLibrary.requestPermissionsAsync(true, ['video']);
  if (!permission.granted) throw new Error('Доступ к «Фото» не предоставлен. Его можно разрешить в настройках iPhone.');
  await MediaLibrary.saveToLibraryAsync(uri);
}
export async function importVideo(id: string): Promise<{ uri: string; size: number; title: string; format: 'mp4' | 'mov' } | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: ['video/mp4', 'video/quicktime'], copyToCacheDirectory: true });
  if (picked.canceled || !picked.assets[0]) return null;
  const file = picked.assets[0];
  let destination: string | undefined;
  try {
    const format = videoFormat(file.mimeType || null, file.name);
    const header = await FS.readAsStringAsync(file.uri, { encoding: FS.EncodingType.Base64, position: 0, length: 32 });
    if (!isVideoHeader(Uint8Array.from(atob(header), character => character.charCodeAt(0)))) throw new SourceError('Выбранный файл не является видео MP4/MOV.');
    if (!FS.documentDirectory) throw new Error('Хранилище недоступно.');
    const folder = `${FS.documentDirectory}videos/`;
    await FS.makeDirectoryAsync(folder, { intermediates: true });
    destination = `${folder}${id}.${format}`;
    await FS.copyAsync({ from: file.uri, to: destination });
    const info = await FS.getInfoAsync(destination);
    if (!info.exists || info.isDirectory) throw new Error('Не удалось импортировать файл.');
    return { uri: destination, size: info.size, title: file.name, format };
  } catch (error) {
    if (destination) await FS.deleteAsync(destination, { idempotent: true }).catch(() => {});
    throw error;
  } finally {
    if (FS.cacheDirectory && file.uri.startsWith(FS.cacheDirectory)) await FS.deleteAsync(file.uri, { idempotent: true }).catch(() => {});
  }
}
