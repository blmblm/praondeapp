import path from 'path';
import { eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { eventos, eventosImportados, mediaFiles } from './schema.ts';

export function normalizeMediaFilename(urlOrName?: string | null): string {
  if (!urlOrName || typeof urlOrName !== 'string') return '';
  const withoutQuery = urlOrName.trim().split('?')[0].split('#')[0];
  if (!withoutQuery) return '';
  const bn = path.basename(withoutQuery);
  if (!bn || bn === '.' || bn === '..') return '';
  return bn.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
}

export function getVideoMimeType(filename: string, providedMime?: string): string {
  const cleanProvided = (providedMime || '').split(';')[0].trim().toLowerCase();
  if (cleanProvided.startsWith('video/') && cleanProvided !== 'video/mp4') {
    return cleanProvided;
  }
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.webm':
      return 'video/webm';
    case '.mov':
      return 'video/quicktime';
    case '.m4v':
      return 'video/x-m4v';
    case '.ogg':
    case '.ogv':
      return 'video/ogg';
    case '.3gp':
      return 'video/3gpp';
    default:
      return 'video/mp4';
  }
}

export async function saveMediaFilePg(
  filename: string,
  data: Buffer,
  mimeType?: string
): Promise<string> {
  const cleanName = normalizeMediaFilename(filename);
  if (!cleanName) {
    throw new Error('Nome de arquivo inválido para armazenamento de mídia.');
  }
  const resolvedMime = getVideoMimeType(cleanName, mimeType);
  try {
    await db
      .insert(mediaFiles)
      .values({
        filename: cleanName,
        mimeType: resolvedMime,
        sizeBytes: data.length,
        data,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: mediaFiles.filename,
        set: {
          mimeType: resolvedMime,
          sizeBytes: data.length,
          data,
          createdAt: new Date(),
        },
      });
    return cleanName;
  } catch (error) {
    console.error('Database query failed in saveMediaFilePg:', error);
    throw new Error('Falha ao gravar arquivo de vídeo no Cloud SQL.', { cause: error });
  }
}

export async function getMediaFilePg(filename: string): Promise<{
  filename: string;
  mimeType: string;
  sizeBytes: number;
  data: Buffer;
} | null> {
  const cleanName = normalizeMediaFilename(filename);
  if (!cleanName) return null;
  try {
    const rows = await db
      .select({
        filename: mediaFiles.filename,
        mimeType: mediaFiles.mimeType,
        sizeBytes: mediaFiles.sizeBytes,
        data: mediaFiles.data,
      })
      .from(mediaFiles)
      .where(eq(mediaFiles.filename, cleanName))
      .limit(1);

    const row = rows[0];
    if (!row || !row.data) return null;
    const buf = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
    return {
      filename: row.filename,
      mimeType: row.mimeType || getVideoMimeType(row.filename),
      sizeBytes: row.sizeBytes || buf.length,
      data: buf,
    };
  } catch (error) {
    console.error('Database query failed in getMediaFilePg:', error);
    throw new Error('Falha ao buscar arquivo de vídeo no Cloud SQL.', { cause: error });
  }
}

export async function listMediaFilenamesPg(): Promise<Set<string>> {
  try {
    const rows = await db
      .select({ filename: mediaFiles.filename })
      .from(mediaFiles);
    return new Set(rows.map((r) => r.filename));
  } catch (error) {
    console.warn('Database query failed in listMediaFilenamesPg:', error);
    return new Set();
  }
}

export async function deleteMediaFilesIfUnusedPg(
  urls: Array<string | null | undefined>
): Promise<number> {
  try {
    const candidateNames = Array.from(
      new Set(
        urls
          .filter((u): u is string => Boolean(u && typeof u === 'string'))
          .filter((u) => u.includes('/uploads/videos/') || u.includes('/api/video/'))
          .map((u) => normalizeMediaFilename(u))
          .filter(Boolean)
      )
    );

    if (candidateNames.length === 0) return 0;

    const toDelete: string[] = [];
    for (const fn of candidateNames) {
      const stillInEventos = await db
        .select({ id: eventos.id })
        .from(eventos)
        .where(or(ilike(eventos.video_url, `%${fn}%`), ilike(eventos.url, `%${fn}%`)))
        .limit(1);
      if (stillInEventos.length > 0) continue;

      const stillInQuarantine = await db
        .select({ id: eventosImportados.id })
        .from(eventosImportados)
        .where(or(ilike(eventosImportados.video_url, `%${fn}%`), ilike(eventosImportados.url, `%${fn}%`)))
        .limit(1);
      if (stillInQuarantine.length > 0) continue;

      toDelete.push(fn);
    }

    if (toDelete.length === 0) return 0;
    const deleted = await db
      .delete(mediaFiles)
      .where(inArray(mediaFiles.filename, toDelete))
      .returning({ filename: mediaFiles.filename });
    return deleted.length;
  } catch (error) {
    console.warn('Aviso ao limpar media_files não utilizados:', error);
    return 0;
  }
}

export async function cleanupOrphanedMediaFilesPg(): Promise<number> {
  try {
    const allMedia = await db.select({ filename: mediaFiles.filename }).from(mediaFiles);
    if (allMedia.length === 0) return 0;

    const evtUrls = await db
      .select({ video_url: eventos.video_url, url: eventos.url })
      .from(eventos)
      .where(sql`${eventos.video_url} IS NOT NULL OR ${eventos.url} IS NOT NULL`);

    const impUrls = await db
      .select({ video_url: eventosImportados.video_url, url: eventosImportados.url })
      .from(eventosImportados)
      .where(sql`${eventosImportados.video_url} IS NOT NULL OR ${eventosImportados.url} IS NOT NULL`);

    const activeRefs = new Set<string>();
    for (const r of [...evtUrls, ...impUrls]) {
      for (const candidate of [r.video_url, r.url]) {
        if (candidate && (candidate.includes('/uploads/videos/') || candidate.includes('/api/video/'))) {
          const fn = normalizeMediaFilename(candidate);
          if (fn) activeRefs.add(fn);
        }
      }
    }

    const orphanFilenames = allMedia
      .map((m) => m.filename)
      .filter((fn) => !activeRefs.has(fn));

    if (orphanFilenames.length === 0) return 0;
    const deleted = await db
      .delete(mediaFiles)
      .where(inArray(mediaFiles.filename, orphanFilenames))
      .returning({ filename: mediaFiles.filename });
    return deleted.length;
  } catch (error) {
    console.warn('Aviso em cleanupOrphanedMediaFilesPg:', error);
    return 0;
  }
}
