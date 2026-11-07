import { requireOptionalNativeModule } from 'expo-modules-core';

interface PocketMedia {
  evaluate(script: string): Promise<Record<string, string>>;
  merge(video: string, audio: string, output: string, operation: string): Promise<string>;
  cancel(operation: string): void;
}
export const pocketMedia = requireOptionalNativeModule<PocketMedia>('PocketMedia');
export function requirePocketMedia(): PocketMedia {
  if (!pocketMedia) throw new Error('Для этой загрузки нужна сборка приложения с модулем PocketMedia. Установите обновлённый IPA: Expo Go не включает ваш нативный модуль. После установки компьютер не нужен.');
  return pocketMedia;
}
