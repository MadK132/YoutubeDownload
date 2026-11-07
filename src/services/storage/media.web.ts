const unsupported = () => new Error('Эта функция доступна в приложении на iPhone.');
export async function shareVideo(_uri: string): Promise<void> { throw unsupported(); }
export async function saveToPhotos(_uri: string): Promise<void> { throw unsupported(); }
export async function importVideo(_id: string): Promise<{ uri: string; size: number; title: string; format: 'mp4' | 'mov' } | null> { throw unsupported(); }
