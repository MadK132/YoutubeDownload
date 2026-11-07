export const pocketMedia = null;
export function requirePocketMedia(): never {
  throw new Error('Эта функция работает в установленном приложении на iPhone. Веб-браузер ограничивает доступ к потокам YouTube/VK.');
}
