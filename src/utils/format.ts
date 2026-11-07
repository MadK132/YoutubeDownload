export function bytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  const index = Math.min(3, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** index).toFixed(index > 0 ? 1 : 0)} ${units[index]}`;
}
export const statusLabels = {
  Pending: 'В очереди', Downloading: 'Загружается', Completed: 'Готово', Failed: 'Ошибка', Cancelled: 'Отменено',
} as const;
