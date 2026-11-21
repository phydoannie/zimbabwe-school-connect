import Dexie, { type Table } from 'dexie';
import { supabase } from '@/integrations/supabase/client';
import type { School } from './school-context';

class LogoDatabase extends Dexie {
  declare logos: Table<{ key: string; data: string }, string>;
  constructor() { super('schoolsys-logos-v1'); this.version(1).stores({ logos: 'key' }); }
}
let database: LogoDatabase | undefined;
const db = () => database ??= new LogoDatabase();

export async function imageToPng(blob: Blob): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 512 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This device cannot prepare the logo');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}

export async function loadSchoolLogo(school: School, userId: string): Promise<string | null> {
  if (!school.logo_url) return null;
  const key = `${userId}:${school.id}:${school.logo_url}`;
  const cached = await db().logos.get(key);
  if (cached) return cached.data;
  if (!navigator.onLine) return null;
  let blob: Blob;
  if (school.logo_url.startsWith('school-logos/')) {
    const result = await supabase.storage.from('school-logos').download(school.logo_url.slice('school-logos/'.length));
    if (result.error) throw result.error;
    blob = result.data;
  } else {
    const response = await fetch(school.logo_url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('School logo could not be loaded');
    blob = await response.blob();
  }
  const data = await imageToPng(blob);
  await db().logos.put({ key, data });
  return data;
}

export async function uploadSchoolLogo(school: School, userId: string, file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPG or WebP image');
  if (file.size > 2 * 1024 * 1024) throw new Error('Choose a logo smaller than 2 MB');
  const data = await imageToPng(file);
  const blob = await (await fetch(data)).blob();
  const path = `${school.id}/${crypto.randomUUID()}.png`;
  const uploaded = await supabase.storage.from('school-logos').upload(path, blob, { contentType: 'image/png', upsert: false });
  if (uploaded.error) throw uploaded.error;
  const logo_url = `school-logos/${path}`;
  const saved = await supabase.from('schools').update({ logo_url }).eq('id', school.id).select('id');
  if (saved.error) throw saved.error;
  if (!saved.data?.length) throw new Error('School logo could not be saved');
  await db().logos.put({ key: `${userId}:${school.id}:${logo_url}`, data });
  return data;
}