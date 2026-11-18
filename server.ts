import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import { execSync } from 'child_process';
import cron from 'node-cron';
import { GoogleGenAI, Type } from '@google/genai';

import { securityFirewall, createRateLimiter } from './server/security/firewall.ts';
import {
  sanitizePromptInput,
  detectPromptInjection,
  getGeocodeCacheKey,
  getCachedGeocode,
  setCachedGeocode,
  canCallGemini,
  recordGeminiApiFailure,
  withGeminiTimeout,
} from './server/security/geminiProtection.ts';
import { createMercadoPagoPixPayment, checkMercadoPagoPaymentStatus } from './server/mercadopago.ts';
import { parseSymplaEventUrl } from './server/symplaParser.ts';
import {
  discoverAllRhythmsBatch,
  searchSymplaLiveEvents,
  fetchAllSymplaLiveEvents,
} from './server/symplaDiscover.ts';
import { parseTicket360EventUrl } from './server/ticket360Parser.ts';
import {
  searchTicket360LiveEvents,
  discoverAllTicket360RhythmsBatch,
  fetchAllTicket360LiveEvents,
  hasValidTicket360Image,
} from './server/ticket360Discover.ts';

import { type AuthRequest, optionalAuth, requireAuth } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import {
  BRAZIL_CITY_COORDINATES,
  isCleanImage,
  isCleanVideo,
  normalizeCityKey,
} from './src/db/mediaHelpers.ts';
import {
  addFavoriteRecord,
  addIgnoredWordRecord,
  containsIgnoredWords,
  createCategoryRecord,
  createCidadeRecord,
  createSupervisorRecord,
  deleteAllCidadesRecords,
  deleteCategoryRecord,
  deleteCidadeRecord,
  deleteIgnoredWordRecord,
  deleteSupervisorRecord,
  findAdvertiserByEmail,
  getAdvertisersList,
  getCategoriesList,
  getCidadesList,
  getFavoritesList,
  getIgnoredWordsList,
  getSupervisorsList,
  removeFavoriteRecord,
  resolveCategoryRecord,
  syncIgnoredWordsBatch,
  updateSupervisorRecord,
  upsertAdvertiserRecord,
  verifySupervisorByPassword,
} from './src/db/catalogRepo.ts';
import {
  approveEventRecordPg,
  deleteAllEventsPg,
  deleteEventByIdPg,
  deleteEventsBatchPg,
  getDeletedEventIdsPg,
  getEventoImageRowPg,
  getEventoPosterByIdPg,
  getRawEventosPg,
  liberateAllEventsPg,
  listEventsPg,
  setEventLiberadoNPg,
  syncEventsRelationsPg,
  updateEventCategoryPg,
  updateEventUrlPg,
  upsertEventPg,
} from './src/db/eventsRepo.ts';
import {
  batchDeleteImportedPg,
  batchImportedCategoryPg,
  checkDuplicateEventStatusPg,
  clearImportedEventsPg,
  countQuarantinePg,
  deleteImportedEventPg,
  getPendingQuarantineIdsPg,
  insertSingleUserQuarantinePg,
  listImportedEventsPg,
  patchImportedCategoryPg,
  updateImportedEventPg,
  upsertImportedEventsPg,
} from './src/db/quarantineRepo.ts';
import {
  clearEstatisticasPg,
  getEstatisticasPg,
  getPixConfigPg,
  getPixPaymentWithSponsor,
  insertPixPaymentRecord,
  listSponsorsPg,
  markPixNotificationSentPg,
  markPixPaymentApprovedPg,
  registrarConsultaPg,
  savePixConfigPg,
  updateSponsorLiberationPg,
  upsertSponsorForPix,
} from './src/db/sponsorsPixRepo.ts';
import {
  executePostgresSqlQuery,
  getCleanupStatusPg,
  getPostgresSchemaInfo,
  runPostgresCleanup,
} from './src/db/adminSqlRepo.ts';
import {
  getMediaFilePg,
  getVideoMimeType,
  normalizeMediaFilename,
  saveMediaFilePg,
} from './src/db/mediaRepo.ts';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(securityFirewall);

const geocodeRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 25,
  routeName: 'geocode',
  message: 'Muitas consultas de endereço. Aguarde alguns segundos.',
});

const pixCreateRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 12,
  routeName: 'pix-create',
  message: 'Muitas tentativas de criação de Pix. Por favor, aguarde alguns instantes.',
});

const adminRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 40,
  routeName: 'admin',
  message: 'Limite de requisições administrativas excedido.',
});

// ==================== UPLOADS & MEDIA ROUTES ====================

let UPLOADS_DIR = path.join(process.cwd(), 'uploads');
try {
  const testVideos = path.join(UPLOADS_DIR, 'videos');
  if (!fs.existsSync(testVideos)) {
    fs.mkdirSync(testVideos, { recursive: true });
  }
  const writeProbe = path.join(UPLOADS_DIR, '.upload_write_test');
  fs.writeFileSync(writeProbe, 'ok');
  fs.unlinkSync(writeProbe);
} catch {
  UPLOADS_DIR = path.join('/tmp', 'uploads');
  try {
    fs.mkdirSync(path.join(UPLOADS_DIR, 'videos'), { recursive: true });
  } catch {}
}

const UPLOADS_VIDEOS_DIR = path.join(UPLOADS_DIR, 'videos');
const UPLOADS_IMAGES_DIR = path.join(UPLOADS_DIR, 'images');
try {
  fs.mkdirSync(UPLOADS_IMAGES_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_VIDEOS_DIR, { recursive: true });
} catch {}

app.get(['/uploads/images/:filename', '/api/uploads/images/:filename', '/api/image/:filename'], async (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'public, max-age=86400');

  let filename = (req.params.filename || '').split('?')[0];
  const directPath = path.join(UPLOADS_IMAGES_DIR, filename);
  if (fs.existsSync(directPath)) return res.sendFile(directPath);

  const pubPath = path.join(process.cwd(), 'public', 'uploads', 'images', filename);
  if (fs.existsSync(pubPath)) return res.sendFile(pubPath);

  const baseName = filename.replace(/\.[a-zA-Z0-9]+$/, '');
  for (const ext of ['.jpg', '.jpeg', '.png', '.webp', '.avif']) {
    const alt1 = path.join(UPLOADS_IMAGES_DIR, `${baseName}${ext}`);
    if (fs.existsSync(alt1)) return res.sendFile(alt1);
    const alt2 = path.join(process.cwd(), 'public', 'uploads', 'images', `${baseName}${ext}`);
    if (fs.existsSync(alt2)) return res.sendFile(alt2);
  }

  try {
    const row = await getEventoImageRowPg([baseName, filename]);
    const base64Candidate =
      row?.imagem_url?.startsWith('data:image/')
        ? row.imagem_url
        : row?.url?.startsWith('data:image/')
          ? row.url
          : null;

    if (base64Candidate) {
      const match = base64Candidate.match(/^data:image\/([a-zA-Z0-9\-\+\.]+);base64,(.+)$/);
      if (match?.[2]) {
        const rawMime = match[1].toLowerCase();
        const mime = rawMime.includes('png') ? 'image/png' : rawMime.includes('webp') ? 'image/webp' : 'image/jpeg';
        const buf = Buffer.from(match[2], 'base64');
        try {
          fs.mkdirSync(UPLOADS_IMAGES_DIR, { recursive: true });
          fs.writeFileSync(directPath, buf);
        } catch {}
        res.setHeader('Content-Type', mime);
        return res.send(buf);
      }
    }
  } catch (err) {
    console.warn('[Image Route] Erro na auto-recuperação:', err);
  }

  next();
});

app.get(['/api/image-base64/:filename', '/api/image-data/:filename'], async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const filename = path.basename((req.params.filename || '').split('?')[0]);
  const baseName = filename.replace(/\.[a-zA-Z0-9]+$/, '');

  for (const ext of ['', '.jpg', '.jpeg', '.png', '.webp', '.avif']) {
    const currentName = ext ? `${baseName}${ext}` : filename;
    const candidates = [
      path.join(UPLOADS_IMAGES_DIR, currentName),
      path.join(process.cwd(), 'public', 'uploads', 'images', currentName),
      path.join(process.cwd(), 'uploads', 'images', currentName),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        const fileBuf = fs.readFileSync(cand);
        const resolvedExt = path.extname(cand).toLowerCase().replace('.', '') || 'jpeg';
        const mime = resolvedExt === 'png' ? 'image/png' : resolvedExt === 'webp' ? 'image/webp' : 'image/jpeg';
        return res.json({
          success: true,
          base64: `data:${mime};base64,${fileBuf.toString('base64')}`,
          mime,
        });
      }
    }
  }

  try {
    const evRow = await getEventoImageRowPg([baseName, filename]);
    const dbUrl = (evRow?.imagem_url || evRow?.url || '').trim();
    if (dbUrl.startsWith('data:image/')) {
      return res.json({
        success: true,
        base64: dbUrl,
        mime: dbUrl.includes('image/png') ? 'image/png' : dbUrl.includes('image/svg') ? 'image/svg+xml' : 'image/jpeg',
      });
    }
  } catch {}

  return res.status(404).json({ success: false, error: 'Imagem não encontrada' });
});

app.get('/api/event-poster/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).end();

    const cacheHeader = req.query.v ? 'public, max-age=86400' : 'public, max-age=600';
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', cacheHeader);

    const evRow = await getEventoPosterByIdPg(id);
    const candidates = [evRow?.imagem_url, evRow?.url];

    for (const raw of candidates) {
      if (!raw || typeof raw !== 'string') continue;
      const trimmed = raw.trim();
      if (trimmed.startsWith('data:image/')) {
        const match = trimmed.match(/^data:(image\/[a-zA-Z0-9\+\-\.]+);base64,(.+)$/s);
        if (match && match[2]) {
          const mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
          const buf = Buffer.from(match[2], 'base64');
          if (buf.length > 0) {
            res.setHeader('Content-Type', mime);
            res.setHeader('Content-Length', buf.length);
            return res.status(200).end(buf);
          }
        }
      }
    }

    const baseId = path.basename(id);
    const diskNames: string[] = [];
    for (const raw of candidates) {
      if (raw && (raw.startsWith('/uploads/images/') || raw.startsWith('./uploads/images/'))) {
        diskNames.push(path.basename(raw.split('?')[0]));
      }
    }
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg']) {
      diskNames.push(`${baseId}.${ext}`);
    }

    for (const name of diskNames) {
      const diskPaths = [
        path.join(UPLOADS_IMAGES_DIR, name),
        path.join(process.cwd(), 'public', 'uploads', 'images', name),
        path.join(process.cwd(), 'uploads', 'images', name),
        path.join('/tmp', 'uploads', 'images', name),
      ];
      for (const cand of diskPaths) {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile() && fs.statSync(cand).size > 0) {
          const ext = path.extname(cand).toLowerCase().replace('.', '') || 'jpeg';
          const mime =
            ext === 'png'
              ? 'image/png'
              : ext === 'webp'
                ? 'image/webp'
                : ext === 'gif'
                  ? 'image/gif'
                  : ext === 'svg'
                    ? 'image/svg+xml'
                    : ext === 'avif'
                      ? 'image/avif'
                      : 'image/jpeg';
          res.setHeader('Content-Type', mime);
          return res.sendFile(cand);
        }
      }
    }

    for (const raw of candidates) {
      if (!raw || typeof raw !== 'string') continue;
      const trimmed = raw.trim();
      if (
        (trimmed.startsWith('https://') || trimmed.startsWith('http://')) &&
        !trimmed.includes('images.unsplash.com/photo-1514525253161-7a46d19cd819') &&
        !isCleanVideo(trimmed)
      ) {
        return res.redirect(302, trimmed);
      }
    }

    return res.status(404).end();
  } catch {
    return res.status(404).end();
  }
});

function extractPosterFromVideoDisk(videoDiskPath: string, posterBaseName: string): string {
  try {
    const cleanBase = posterBaseName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const posterPath = path.join(UPLOADS_IMAGES_DIR, `${cleanBase}-poster.jpg`);
    for (const ts of ['00:00:02', '00:00:05', '00:00:01', '00:00:00']) {
      try {
        execSync(`ffmpeg -ss ${ts} -i "${videoDiskPath}" -vframes 1 -q:v 2 "${posterPath}" -y`, {
          timeout: 8000,
          stdio: 'ignore',
        });
        if (fs.existsSync(posterPath) && fs.statSync(posterPath).size > 500) {
          const posterBuf = fs.readFileSync(posterPath);
          try {
            fs.unlinkSync(posterPath);
          } catch {}
          return `data:image/jpeg;base64,${posterBuf.toString('base64')}`;
        }
      } catch {}
    }
  } catch {}
  return '';
}

function sendVideoBufferWithRange(
  req: express.Request,
  res: express.Response,
  buf: Buffer,
  mimeType: string
) {
  const total = buf.length;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', mimeType || 'video/mp4');

  const rangeHeader = req.headers.range;
  if (rangeHeader && /^bytes=/i.test(rangeHeader)) {
    const rangeSpec = rangeHeader.replace(/^bytes=/i, '').split(',')[0].trim();
    const parts = rangeSpec.split('-');
    let start: number;
    let end: number;

    if (parts[0] === '') {
      // Suffix range: bytes=-500
      const suffixLen = parseInt(parts[1] || '0', 10);
      if (isNaN(suffixLen) || suffixLen <= 0) {
        res.setHeader('Content-Range', `bytes */${total}`);
        return res.status(416).end();
      }
      start = Math.max(0, total - suffixLen);
      end = total - 1;
    } else {
      start = parseInt(parts[0], 10);
      end = parts[1] ? parseInt(parts[1], 10) : total - 1;
    }

    if (isNaN(start) || isNaN(end) || start < 0 || start >= total || start > end) {
      res.setHeader('Content-Range', `bytes */${total}`);
      return res.status(416).end();
    }

    end = Math.min(end, total - 1);
    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    res.setHeader('Content-Length', chunkSize);
    if (req.method === 'HEAD') {
      return res.end();
    }
    return res.end(buf.subarray(start, end + 1));
  }

  res.setHeader('Content-Length', total);
  if (req.method === 'HEAD') {
    return res.status(200).end();
  }
  return res.status(200).end(buf);
}

app.get(['/uploads/videos/:filename', '/api/uploads/videos/:filename', '/api/video/:filename'], async (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'public, max-age=86400');

  const cleanName = normalizeMediaFilename(req.params.filename || '');
  if (!cleanName) return next();

  const diskCandidates = [
    path.join(UPLOADS_VIDEOS_DIR, cleanName),
    path.join(process.cwd(), 'uploads', 'videos', cleanName),
    path.join(process.cwd(), 'public', 'uploads', 'videos', cleanName),
    path.join('/tmp', 'uploads', 'videos', cleanName),
  ];

  for (const cand of diskCandidates) {
    try {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile() && fs.statSync(cand).size > 0) {
        res.setHeader('Content-Type', getVideoMimeType(cleanName));
        res.setHeader('Accept-Ranges', 'bytes');
        return res.sendFile(cand);
      }
    } catch {}
  }

  try {
    const dbMedia = await getMediaFilePg(cleanName);
    if (dbMedia && dbMedia.data.length > 0) {
      try {
        fs.mkdirSync(UPLOADS_VIDEOS_DIR, { recursive: true });
        fs.writeFileSync(path.join(UPLOADS_VIDEOS_DIR, cleanName), dbMedia.data);
      } catch {}
      return sendVideoBufferWithRange(req, res, dbMedia.data, dbMedia.mimeType);
    }
  } catch (err) {
    console.warn('[Video Route] Erro ao recuperar vídeo do Cloud SQL:', err);
  }

  return next();
});

app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(UPLOADS_DIR)
);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
app.use('/uploads', express.static(path.join('/tmp', 'uploads')));
app.use('/uploads', (_req, res) => {
  res.status(404).json({ error: 'Arquivo de mídia não encontrado neste servidor' });
});
app.use(express.static(path.join(process.cwd(), 'public')));

app.post('/api/upload/video', async (req, res) => {
  try {
    const { data, eventId } = req.body;
    if (!data || typeof data !== 'string') {
      return res.status(400).json({ error: 'Nenhum dado de vídeo recebido' });
    }
    const cleanData = data.trim();
    if (!cleanData.startsWith('data:video/')) {
      return res.json({ success: true, videoUrl: cleanData });
    }
    const id = String(eventId || `vid-${Date.now()}`).replace(/[^a-zA-Z0-9_\-]/g, '_');
    const matches = cleanData.match(/^data:video\/([a-zA-Z0-9\-\+]+);base64,(.+)$/);
    const rawSubtype = (matches?.[1] || 'mp4').toLowerCase();
    const ext = rawSubtype.includes('webm')
      ? 'webm'
      : rawSubtype.includes('quicktime') || rawSubtype.includes('mov')
        ? 'mov'
        : rawSubtype.includes('ogg')
          ? 'ogg'
          : 'mp4';
    const base64Data = matches?.[2] || cleanData.split(',')[1];
    if (!base64Data) {
      return res.status(400).json({ error: 'Conteúdo Base64 de vídeo inválido' });
    }
    const fileName = `${id}.${ext}`;
    const vidBuf = Buffer.from(base64Data, 'base64');
    if (vidBuf.length > 85 * 1024 * 1024) {
      return res.status(413).json({ error: 'O vídeo ultrapassa o limite máximo de 80MB.' });
    }

    const mimeType = getVideoMimeType(fileName, `video/${rawSubtype}`);
    await saveMediaFilePg(fileName, vidBuf, mimeType);

    const filePath = path.join(UPLOADS_VIDEOS_DIR, fileName);
    try {
      fs.mkdirSync(UPLOADS_VIDEOS_DIR, { recursive: true });
      fs.writeFileSync(filePath, vidBuf);
    } catch {}

    const imageUrl = fs.existsSync(filePath) ? extractPosterFromVideoDisk(filePath, id) : '';
    const videoUrl = `/uploads/videos/${fileName}`;
    res.json({ success: true, videoUrl, imageUrl });
  } catch (err: any) {
    console.error('Erro no upload de vídeo:', err);
    res.status(500).json({ error: err.message || 'Erro ao processar arquivo de vídeo' });
  }
});

app.post('/api/upload/video-stream', (req, res) => {
  try {
    const rawFilename = (req.headers['x-filename'] as string) || `vid-${Date.now()}.mp4`;
    const sanitized = normalizeMediaFilename(rawFilename) || `vid-${Date.now()}.mp4`;
    const hasKnownExt = /\.(mp4|webm|mov|m4v|3gp|ogg)$/i.test(sanitized);
    const finalFilename = hasKnownExt ? sanitized : `${sanitized}.mp4`;
    const mimeType = getVideoMimeType(finalFilename, req.headers['content-type'] as string);

    fs.mkdirSync(UPLOADS_VIDEOS_DIR, { recursive: true });
    const targetPath = path.join(UPLOADS_VIDEOS_DIR, finalFilename);
    const writeStream = fs.createWriteStream(targetPath);

    req.pipe(writeStream);

    writeStream.on('finish', async () => {
      try {
        const stat = fs.statSync(targetPath);
        if (stat.size <= 0) {
          return res.status(400).json({ error: 'Arquivo de vídeo vazio recebido.' });
        }
        if (stat.size > 85 * 1024 * 1024) {
          try {
            fs.unlinkSync(targetPath);
          } catch {}
          return res.status(413).json({ error: 'O vídeo ultrapassa o limite máximo de 80MB.' });
        }

        const vidBuf = fs.readFileSync(targetPath);
        await saveMediaFilePg(finalFilename, vidBuf, mimeType);

        const baseName = finalFilename.replace(/\.[^.]+$/, '');
        const imageUrl = extractPosterFromVideoDisk(targetPath, baseName);
        const videoUrl = `/uploads/videos/${finalFilename}`;

        return res.json({ success: true, videoUrl, imageUrl, sizeBytes: stat.size });
      } catch (err: any) {
        console.error('Erro ao persistir vídeo no Cloud SQL (video-stream):', err);
        return res.status(500).json({ error: err.message || 'Erro ao persistir vídeo no banco de dados' });
      }
    });

    writeStream.on('error', (err) => {
      return res.status(500).json({ error: err.message || 'Erro ao gravar arquivo de vídeo no servidor' });
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Falha no upload' });
  }
});

app.post('/api/upload/video-chunk', express.raw({ type: '*/*', limit: '15mb' }), async (req, res) => {
  try {
    const rawUploadId = String(req.headers['x-upload-id'] || '').replace(/[^a-zA-Z0-9_\-]/g, '');
    const chunkIndex = parseInt(String(req.headers['x-chunk-index'] ?? '-1'), 10);
    const totalChunks = parseInt(String(req.headers['x-total-chunks'] ?? '0'), 10);
    const rawFilename = String(req.headers['x-filename'] || `vid-${Date.now()}.mp4`);
    const providedMime = String(req.headers['x-mime-type'] || 'video/mp4');

    if (!rawUploadId || isNaN(chunkIndex) || isNaN(totalChunks) || totalChunks < 1 || totalChunks > 64 || chunkIndex < 0 || chunkIndex >= totalChunks) {
      return res.status(400).json({ error: 'Metadados de chunk inválidos' });
    }

    const chunkBuf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    if (!chunkBuf || chunkBuf.length === 0) {
      return res.status(400).json({ error: 'Bloco de vídeo vazio' });
    }

    const sanitized = normalizeMediaFilename(rawFilename) || `vid-${Date.now()}.mp4`;
    const hasKnownExt = /\.(mp4|webm|mov|m4v|3gp|ogg)$/i.test(sanitized);
    const finalFilename = hasKnownExt ? sanitized : `${sanitized}.mp4`;
    const mimeType = getVideoMimeType(finalFilename, providedMime);

    const chunksRoot = path.join(UPLOADS_VIDEOS_DIR, '.chunks');
    const uploadDir = path.join(chunksRoot, rawUploadId);
    fs.mkdirSync(uploadDir, { recursive: true });

    // Limpeza oportunista de sessões temporárias expiradas (> 1 hora)
    try {
      const nowMs = Date.now();
      for (const entry of fs.readdirSync(chunksRoot)) {
        if (entry === rawUploadId) continue;
        const entryPath = path.join(chunksRoot, entry);
        const st = fs.statSync(entryPath);
        if (st.isDirectory() && nowMs - st.mtimeMs > 60 * 60 * 1000) {
          fs.rmSync(entryPath, { recursive: true, force: true });
        }
      }
    } catch {}

    const chunkFilePath = path.join(uploadDir, `chunk-${String(chunkIndex).padStart(5, '0')}.part`);
    fs.writeFileSync(chunkFilePath, chunkBuf);

    // Verifica se todos os blocos 0..totalChunks-1 já foram recebidos
    let allPresent = true;
    for (let i = 0; i < totalChunks; i++) {
      const expected = path.join(uploadDir, `chunk-${String(i).padStart(5, '0')}.part`);
      if (!fs.existsSync(expected)) {
        allPresent = false;
        break;
      }
    }

    if (!allPresent) {
      return res.json({ success: true, completed: false, chunkIndex, totalChunks });
    }

    const parts: Buffer[] = [];
    let totalBytes = 0;
    for (let i = 0; i < totalChunks; i++) {
      const partBuf = fs.readFileSync(path.join(uploadDir, `chunk-${String(i).padStart(5, '0')}.part`));
      totalBytes += partBuf.length;
      if (totalBytes > 85 * 1024 * 1024) {
        fs.rmSync(uploadDir, { recursive: true, force: true });
        return res.status(413).json({ error: 'O vídeo ultrapassa o limite máximo de 80MB.' });
      }
      parts.push(partBuf);
    }

    const fullBuffer = Buffer.concat(parts);
    try {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    } catch {}

    await saveMediaFilePg(finalFilename, fullBuffer, mimeType);

    const targetPath = path.join(UPLOADS_VIDEOS_DIR, finalFilename);
    try {
      fs.mkdirSync(UPLOADS_VIDEOS_DIR, { recursive: true });
      fs.writeFileSync(targetPath, fullBuffer);
    } catch {}

    const baseName = finalFilename.replace(/\.[^.]+$/, '');
    const imageUrl = fs.existsSync(targetPath) ? extractPosterFromVideoDisk(targetPath, baseName) : '';
    const videoUrl = `/uploads/videos/${finalFilename}`;

    return res.json({
      success: true,
      completed: true,
      videoUrl,
      imageUrl,
      sizeBytes: fullBuffer.length,
    });
  } catch (err: any) {
    console.error('Erro no upload em partes (video-chunk):', err);
    return res.status(500).json({ error: err.message || 'Erro ao montar vídeo no servidor' });
  }
});

// Cache em memória para miniaturas de links externos de vídeo (evita múltiplas buscas na rede social)
const videoThumbnailCache = new Map<string, { buf: Buffer; contentType: string; expiresAt: number }>();

function isBlockedPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.startsWith('10.') ||
    h.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h.endsWith('.local') ||
    h.endsWith('.internal')
  );
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 6000): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function cleanExtractedUrl(raw: string): string {
  return raw
    .replace(/\\\//g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/\\$/, '')
    .trim();
}

const FB_NAV_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
};

function extractFacebookVideoId(urlOrHtml: string): string | null {
  const m =
    urlOrHtml.match(/\/reel\/(\d{8,})/i) ||
    urlOrHtml.match(/\/videos\/(?:[^/\s"']+\/)?(\d{8,})/i) ||
    urlOrHtml.match(/[?&]v=(\d{8,})/i);
  return m?.[1] || null;
}

async function fetchFacebookWatchPageHtml(videoUrl: string): Promise<string | null> {
  let vidId = extractFacebookVideoId(videoUrl);
  if (!vidId) {
    try {
      const r = await fetchWithTimeout(videoUrl, { headers: FB_NAV_HEADERS, redirect: 'follow' }, 7000);
      if (r.ok) {
        const html = await r.text();
        if (html.includes('browser_native_hd_url') || html.includes('browser_native_sd_url')) {
          return html;
        }
        vidId = extractFacebookVideoId(r.url) || extractFacebookVideoId(html);
      }
    } catch {}
  }
  if (!vidId) return null;
  try {
    const r = await fetchWithTimeout(
      `https://www.facebook.com/watch/?v=${vidId}`,
      { headers: FB_NAV_HEADERS, redirect: 'follow' },
      8000
    );
    if (r.ok) {
      return await r.text();
    }
  } catch {}
  return null;
}

async function resolveVideoThumbnailImageUrl(videoUrl: string): Promise<string | null> {
  const browserHeaders = {
    'User-Agent': FB_NAV_HEADERS['User-Agent'],
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  };

  // 1. YouTube
  const ytMatch = videoUrl.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/i
  );
  if (ytMatch?.[1]) {
    return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  }

  // 2. Vimeo oEmbed
  if (/vimeo\.com/i.test(videoUrl)) {
    try {
      const r = await fetchWithTimeout(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoUrl)}`);
      if (r.ok) {
        const j: any = await r.json();
        if (j?.thumbnail_url) return String(j.thumbnail_url);
      }
    } catch {}
  }

  // 3. TikTok oEmbed
  if (/tiktok\.com/i.test(videoUrl)) {
    try {
      const r = await fetchWithTimeout(`https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`);
      if (r.ok) {
        const j: any = await r.json();
        if (j?.thumbnail_url) return String(j.thumbnail_url);
      }
    } catch {}
  }

  // 4. Facebook (plugin video.php -> fallback post.php -> fallback watch/?v=ID)
  if (/facebook\.com|fb\.watch|fb\.com/i.test(videoUrl)) {
    const candidates = [
      `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(videoUrl)}&show_text=0&width=500`,
      `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(videoUrl)}&show_text=true&width=500`,
    ];
    for (const pluginUrl of candidates) {
      try {
        const r = await fetchWithTimeout(pluginUrl, { headers: browserHeaders }, 7000);
        if (!r.ok) continue;
        const html = await r.text();
        const matches = html.match(/https?:\\?\/\\?\/[^"'\s<>]+?(?:\.jpg|\.jpeg|\.png|\.webp)[^"'\s<>]*/gi) || [];
        const cleaned = matches
          .map(cleanExtractedUrl)
          .filter(
            (u) =>
              (u.includes('fbcdn.net') || u.includes('scontent')) &&
              !u.includes('s40x40') &&
              !u.includes('s60x60') &&
              !u.includes('p50x50') &&
              !u.includes('static.xx') &&
              !u.includes('emoji')
          );
        const videoPoster = cleaned.find((u) => u.includes('t15.5256-10')) || cleaned[0];
        if (videoPoster) return videoPoster;
      } catch {}
    }

    const watchHtml = await fetchFacebookWatchPageHtml(videoUrl);
    if (watchHtml) {
      const prefThumb = watchHtml.match(/"preferred_thumbnail":\{[^}]*"image":\{"uri":"([^"]+)"/);
      if (prefThumb?.[1]) {
        return cleanExtractedUrl(prefThumb[1]);
      }
      const ogWatch =
        watchHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        watchHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (ogWatch?.[1]) {
        return cleanExtractedUrl(ogWatch[1]);
      }
    }
  }

  // 5. Instagram embed
  const instaMatch = videoUrl.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/i);
  if (instaMatch?.[1]) {
    try {
      const r = await fetchWithTimeout(
        `https://www.instagram.com/p/${instaMatch[1]}/embed/captioned/`,
        { headers: browserHeaders },
        7000
      );
      if (r.ok) {
        const html = await r.text();
        const matches = html.match(/https?:\\?\/\\?\/[^"'\s<>]+?(?:\.jpg|\.jpeg|\.png|\.webp)[^"'\s<>]*/gi) || [];
        const cleaned = matches
          .map(cleanExtractedUrl)
          .filter(
            (u) =>
              (u.includes('cdninstagram.com') || u.includes('fbcdn.net')) &&
              !u.includes('s150x150') &&
              !u.includes('44x44') &&
              !u.includes('static')
          );
        if (cleaned[0]) return cleaned[0];
      }
    } catch {}
  }

  // 6. Generic og:image / twitter:image fallback
  try {
    const r = await fetchWithTimeout(videoUrl, { headers: browserHeaders }, 6000);
    if (r.ok) {
      const html = await r.text();
      const ogMatch =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
        html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
      if (ogMatch?.[1]) {
        return cleanExtractedUrl(ogMatch[1]);
      }
    }
  } catch {}

  return null;
}

app.get('/api/video-thumbnail', async (req, res) => {
  try {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl) return res.status(400).end();

    let parsedInput: URL;
    try {
      parsedInput = new URL(rawUrl);
    } catch {
      return res.status(400).end();
    }

    if ((parsedInput.protocol !== 'https:' && parsedInput.protocol !== 'http:') || isBlockedPrivateHostname(parsedInput.hostname)) {
      return res.status(400).end();
    }

    const cached = videoThumbnailCache.get(rawUrl);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=1800');
      return res.send(cached.buf);
    }

    const imageUrl = await resolveVideoThumbnailImageUrl(rawUrl);
    if (!imageUrl) {
      return res.status(404).end();
    }

    let parsedImgUrl: URL;
    try {
      parsedImgUrl = new URL(imageUrl);
    } catch {
      return res.status(404).end();
    }
    if ((parsedImgUrl.protocol !== 'https:' && parsedImgUrl.protocol !== 'http:') || isBlockedPrivateHostname(parsedImgUrl.hostname)) {
      return res.status(404).end();
    }

    const imgResp = await fetchWithTimeout(
      imageUrl,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      },
      7000
    );

    if (!imgResp.ok) {
      return res.status(404).end();
    }

    const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return res.status(404).end();
    }

    const buf = Buffer.from(await imgResp.arrayBuffer());
    if (buf.length === 0 || buf.length > 5 * 1024 * 1024) {
      return res.status(404).end();
    }

    if (videoThumbnailCache.size >= 100) {
      const oldestKey = videoThumbnailCache.keys().next().value;
      if (oldestKey) videoThumbnailCache.delete(oldestKey);
    }
    videoThumbnailCache.set(rawUrl, {
      buf,
      contentType,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=1800');
    return res.send(buf);
  } catch {
    return res.status(404).end();
  }
});

// Cache em memória de URLs progressivas MP4 extraídas de links públicos de redes sociais
const socialVideoStreamCache = new Map<string, { mp4Url: string; expiresAt: number }>();

async function resolveSocialVideoStreamUrl(videoUrl: string): Promise<string | null> {
  const browserHeaders = {
    'User-Agent': FB_NAV_HEADERS['User-Agent'],
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  };

  // Facebook Reel / Video / Watch: tenta plugin oficial primeiro, depois fallback via watch/?v=ID (contorna bloqueio de embed de música/terceiros)
  if (/facebook\.com|fb\.watch|fb\.com/i.test(videoUrl)) {
    try {
      const pluginUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(videoUrl)}&show_text=0&width=500`;
      const r = await fetchWithTimeout(pluginUrl, { headers: browserHeaders }, 7000);
      if (r.ok) {
        const html = await r.text();
        const matches = html.match(/https?:\\?\/\\?\/video[^"'\s<>]+?\.mp4[^"'\s<>]*/gi) || [];
        const cleaned = matches
          .map((s) => cleanExtractedUrl(s).replace(/\\u0025/g, '%').split('\\u003C')[0])
          .filter((u) => u.includes('fbcdn.net'));
        // Prioriza stream progressivo completo (áudio + vídeo juntos), evitando faixas dash só de vídeo
        const progressive =
          cleaned.find((u) => u.includes('sve_hd')) ||
          cleaned.find((u) => u.includes('sve_sd')) ||
          cleaned.find((u) => u.includes('xpv_progressive') && !u.includes('dash'));
        if (progressive) return progressive;
      }
    } catch {}

    const watchHtml = await fetchFacebookWatchPageHtml(videoUrl);
    if (watchHtml) {
      const nativeMatch =
        watchHtml.match(/"browser_native_hd_url":"([^"]+)"/) ||
        watchHtml.match(/"browser_native_sd_url":"([^"]+)"/) ||
        watchHtml.match(/"playable_url_quality_hd":"([^"]+)"/) ||
        watchHtml.match(/"playable_url":"([^"]+)"/);
      if (nativeMatch?.[1]) {
        return cleanExtractedUrl(nativeMatch[1]).replace(/\\u0025/g, '%');
      }
    }
  }

  // Instagram Reel / Post embed
  const instaMatch = videoUrl.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/i);
  if (instaMatch?.[1]) {
    try {
      const r = await fetchWithTimeout(
        `https://www.instagram.com/p/${instaMatch[1]}/embed/captioned/`,
        { headers: browserHeaders },
        7000
      );
      if (r.ok) {
        const html = await r.text();
        const matches = html.match(/https?:\\?\/\\?\/[^"'\s<>]+?\.mp4[^"'\s<>]*/gi) || [];
        const cleaned = matches
          .map((s) => cleanExtractedUrl(s).replace(/\\u0025/g, '%').split('\\u003C')[0])
          .filter((u) => u.includes('cdninstagram.com') || u.includes('fbcdn.net'));
        if (cleaned[0]) return cleaned[0];
      }
    } catch {}
  }

  return null;
}

app.get('/api/video-stream-proxy', async (req, res) => {
  try {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl) return res.status(400).end();

    let parsedInput: URL;
    try {
      parsedInput = new URL(rawUrl);
    } catch {
      return res.status(400).end();
    }
    if ((parsedInput.protocol !== 'https:' && parsedInput.protocol !== 'http:') || isBlockedPrivateHostname(parsedInput.hostname)) {
      return res.status(400).end();
    }

    let mp4Url: string | null = null;
    const cached = socialVideoStreamCache.get(rawUrl);
    if (cached && cached.expiresAt > Date.now()) {
      mp4Url = cached.mp4Url;
    } else {
      mp4Url = await resolveSocialVideoStreamUrl(rawUrl);
      if (mp4Url) {
        if (socialVideoStreamCache.size >= 100) {
          const oldest = socialVideoStreamCache.keys().next().value;
          if (oldest) socialVideoStreamCache.delete(oldest);
        }
        socialVideoStreamCache.set(rawUrl, {
          mp4Url,
          expiresAt: Date.now() + 25 * 60 * 1000,
        });
      }
    }

    if (!mp4Url) {
      return res.status(404).end();
    }

    let parsedMp4Url: URL;
    try {
      parsedMp4Url = new URL(mp4Url);
    } catch {
      return res.status(404).end();
    }
    if ((parsedMp4Url.protocol !== 'https:' && parsedMp4Url.protocol !== 'http:') || isBlockedPrivateHostname(parsedMp4Url.hostname)) {
      return res.status(404).end();
    }

    const upstreamHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    };
    if (typeof req.headers.range === 'string' && req.headers.range.trim()) {
      upstreamHeaders.Range = req.headers.range.trim();
    }

    const upstreamResp = await fetchWithTimeout(mp4Url, { headers: upstreamHeaders }, 15000);
    if (!upstreamResp.ok && upstreamResp.status !== 206) {
      socialVideoStreamCache.delete(rawUrl);
      return res.status(404).end();
    }

    res.status(upstreamResp.status);
    const contentType = upstreamResp.headers.get('content-type') || 'video/mp4';
    res.setHeader('Content-Type', contentType);
    const contentLength = upstreamResp.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    const contentRange = upstreamResp.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);
    res.setHeader('Accept-Ranges', upstreamResp.headers.get('accept-ranges') || 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=1200');

    if (!upstreamResp.body) {
      return res.end();
    }
    Readable.fromWeb(upstreamResp.body as any).pipe(res);
  } catch {
    return res.status(404).end();
  }
});

// ==================== HEALTH & LOCAWEB ====================

app.get(['/health', '/_health', '/api/health'], (_req, res) => {
  res.json({
    status: 'ok',
    database: 'Cloud SQL PostgreSQL (Drizzle ORM)',
    uptime: process.uptime(),
    time: new Date().toISOString(),
  });
});

app.get('/api/locaweb/download', (_req, res) => {
  const filePath = path.join(process.cwd(), 'public', 'site-locaweb', 'index.html');
  if (fs.existsSync(filePath)) res.download(filePath, 'index.html');
  else res.status(404).send('Arquivo não encontrado');
});

app.get('/api/locaweb/download-direct', (_req, res) => {
  const filePath = path.join(process.cwd(), 'public', 'site-locaweb', 'index-redirecionamento-direto.html');
  if (fs.existsSync(filePath)) res.download(filePath, 'index.html');
  else res.status(404).send('Arquivo não encontrado');
});

// ==================== AUTH (FIREBASE + CLOUD SQL) ====================

app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    const dbUser = await getOrCreateUser(
      req.user.uid,
      req.user.email || '',
      req.user.name || null
    );
    res.json({
      success: true,
      user: {
        id: dbUser.id,
        uid: dbUser.uid,
        email: dbUser.email,
        displayName: dbUser.displayName,
        role: dbUser.role,
      },
    });
  } catch (error: any) {
    console.error('Erro em /api/auth/me:', error);
    res.status(500).json({ error: error.message || 'Falha ao carregar perfil do usuário' });
  }
});

// ==================== MÉTRICAS DE CONSULTAS ====================

app.all('/api/consultas/registrar', async (req, res) => {
  try {
    const nowEst = new Date();
    const yearEst = nowEst.getFullYear();
    const monthEst = nowEst.getMonth() + 1;
    const rawEstado = String(req.body?.estado || req.query?.estado || 'SP').trim().toUpperCase();
    const estadoFiltro = !rawEstado || rawEstado === 'TODOS' || rawEstado === 'TODAS' ? 'SP' : rawEstado;

    const totalAtual = await registrarConsultaPg(yearEst, monthEst, estadoFiltro);
    res.json({
      success: true,
      message: 'Consulta registrada com sucesso',
      total_consultas: totalAtual,
      ano: yearEst,
      mes: monthEst,
      estado: estadoFiltro,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== GEOCODING ====================

async function fetchGeocodeCoordinatesWithGemini(
  address?: string,
  city?: string,
  state?: string,
  locationName?: string
): Promise<{
  latitude: string;
  longitude: string;
  displayName?: string;
  isFallback?: boolean;
  addressResolved?: boolean;
} | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  const cleanAddress = sanitizePromptInput(address, 120);
  const cleanCity = sanitizePromptInput(city, 60);
  const cleanState = sanitizePromptInput(state, 40);
  const cleanLocation = sanitizePromptInput(locationName, 80);

  if (
    detectPromptInjection(address || '') ||
    detectPromptInjection(locationName || '') ||
    detectPromptInjection(city || '')
  ) {
    return null;
  }

  const cacheKey = getGeocodeCacheKey(cleanAddress, cleanCity, cleanState, cleanLocation);
  const cachedResult = getCachedGeocode(cacheKey);
  if (cachedResult) return cachedResult;

  const check = canCallGemini();
  if (!check.allowed) return null;

  try {
    const prompt = `You are a precise geolocation service for Brazilian addresses.
Inputs:
- Street Address & Number: ${cleanAddress || 'Not provided'}
- City: ${cleanCity || 'Not provided'}
- State: ${cleanState || 'Not provided'}
- Location/Establishment Name: ${cleanLocation || 'Not provided'}

Return JSON:
{
  "latitude": "string",
  "longitude": "string",
  "displayName": "string",
  "addressResolved": boolean
}`;

    const geminiCall = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        maxOutputTokens: 250,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            latitude: { type: Type.STRING },
            longitude: { type: Type.STRING },
            displayName: { type: Type.STRING },
            addressResolved: { type: Type.BOOLEAN },
          },
          required: ['latitude', 'longitude', 'displayName', 'addressResolved'],
        },
      },
    });

    const response = await withGeminiTimeout(geminiCall, 8000);
    const text = response.text?.trim() || '';
    if (text) {
      const data = JSON.parse(text);
      if (data.latitude && data.longitude) {
        const resolvedData = {
          latitude: String(data.latitude),
          longitude: String(data.longitude),
          displayName: String(data.displayName || `${cleanAddress}, ${cleanCity}`),
          addressResolved: Boolean(data.addressResolved),
        };
        setCachedGeocode(cacheKey, resolvedData);
        return {
          ...resolvedData,
          isFallback: !resolvedData.addressResolved,
        };
      }
    }
  } catch (err: any) {
    recordGeminiApiFailure(err.status || err.statusCode);
  }
  return null;
}

async function fetchGeocodeCoordinates(
  address?: string,
  city?: string,
  state?: string,
  locationName?: string
): Promise<{
  latitude: string;
  longitude: string;
  displayName?: string;
  isFallback?: boolean;
  addressResolved?: boolean;
} | null> {
  let cleanAddress = (address || '').trim().replace(/,(\d)/g, ', $1');
  let cleanCity = (city || '')
    .trim()
    .replace(/\s+km\s*\d+/i, '')
    .replace(/\s+bairro\s+\w+/i, '')
    .replace(/\s+-\s+.*$/, '');
  const cleanState = (state || '').trim();
  const cleanLocation = (locationName || '').trim();

  if (cleanCity) {
    const cityIdx = cleanAddress.toLowerCase().lastIndexOf(cleanCity.toLowerCase());
    if (cityIdx !== -1 && cityIdx >= cleanAddress.length - cleanCity.length - 15) {
      cleanAddress = cleanAddress.substring(0, cityIdx).trim();
    }
  }
  cleanAddress = cleanAddress.replace(/[,-\s/\\|]+$/, '').trim();

  if (!cleanAddress && !cleanCity && !cleanLocation) return null;

  const queries = [
    { q: cleanAddress && cleanCity && cleanState ? `${cleanAddress}, ${cleanCity}, ${cleanState}, Brasil` : '', isAddress: true },
    { q: cleanAddress && cleanCity ? `${cleanAddress}, ${cleanCity}, Brasil` : '', isAddress: true },
    { q: cleanAddress.includes('-') && cleanCity ? `${cleanAddress.split('-')[0].trim()}, ${cleanCity}, Brasil` : '', isAddress: true },
    { q: cleanLocation && cleanCity ? `${cleanLocation}, ${cleanCity}, Brasil` : '', isAddress: false },
    { q: cleanAddress ? `${cleanAddress}, Brasil` : '', isAddress: true },
    { q: cleanCity && cleanState ? `${cleanCity}, ${cleanState}, Brasil` : '', isAddress: false },
    { q: cleanCity ? `${cleanCity}, Brasil` : '', isAddress: false },
  ].filter((item) => item.q);

  for (const item of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(item.q)}&limit=1`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'PraOndeEuVouApp/1.0 (geocoding-service)' },
      });
      if (!response.ok) continue;
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
        return {
          latitude: String(data[0].lat),
          longitude: String(data[0].lon),
          displayName: data[0].display_name,
          isFallback: !item.isAddress,
          addressResolved: item.isAddress,
        };
      }
    } catch {}
  }

  const geminiCoords = await fetchGeocodeCoordinatesWithGemini(cleanAddress, cleanCity, cleanState, cleanLocation);
  if (geminiCoords) return geminiCoords;

  if (cleanCity) {
    const fallback = BRAZIL_CITY_COORDINATES[normalizeCityKey(cleanCity)];
    if (fallback) {
      return {
        latitude: fallback.latitude,
        longitude: fallback.longitude,
        displayName: `${cleanCity} - ${cleanState || 'Brasil'} (Centro da cidade)`,
        isFallback: true,
        addressResolved: false,
      };
    }
  }

  return null;
}

app.get('/api/geocode', geocodeRateLimiter, async (req, res) => {
  try {
    const coords = await fetchGeocodeCoordinates(
      String(req.query.address || ''),
      String(req.query.city || ''),
      String(req.query.state || ''),
      String(req.query.locationName || '')
    );
    if (!coords) {
      return res.status(404).json({ error: 'Endereço não localizado para geocodificação' });
    }
    res.json(coords);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao consultar geolocalização' });
  }
});

// ==================== EVENTOS (CLOUD SQL POSTGRESQL) ====================

app.get('/api/events', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    const events = await listEventsPg(req.query as Record<string, any>);
    res.json(events);
  } catch (error: any) {
    console.error('Erro ao listar eventos:', error);
    res.status(500).json({ error: error.message || 'Erro ao consultar eventos' });
  }
});

app.get('/api/eventos', async (_req, res) => {
  try {
    const rows = await getRawEventosPg();
    res.json({ success: true, total: rows.length, eventos: rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post(['/api/events', '/api/eventos'], async (req, res) => {
  try {
    const body = req.body;
    const id = body.id || `evt-${Date.now()}`;
    const createdAt = body.createdAt || new Date().toISOString();
    const tagsString = JSON.stringify(body.tags || []);

    let latitude = body.latitude ? String(body.latitude) : null;
    let longitude = body.longitude ? String(body.longitude) : null;

    if ((!latitude || !longitude) && (body.address || body.city || body.locationName)) {
      try {
        const geocoded = await fetchGeocodeCoordinates(body.address, body.city, body.state, body.locationName);
        if (geocoded) {
          latitude = geocoded.latitude;
          longitude = geocoded.longitude;
        }
      } catch {}
    }

    const catResolved = await resolveCategoryRecord(
      body.category || 'Shows',
      body.categoryId ? Number(body.categoryId) : null,
      true
    );

    let finalVideoUrl = body.videoUrl || body.video_url || null;
    let finalUrl = body.url || null;
    let savedVideoDiskPath: string | null = null;

    if (finalVideoUrl && finalVideoUrl.startsWith('data:video/')) {
      try {
        const matches = finalVideoUrl.match(/^data:video\/([a-zA-Z0-9\-\+]+);base64,(.+)$/);
        const rawSubtype = (matches?.[1] || 'mp4').toLowerCase();
        const ext = rawSubtype.includes('webm')
          ? 'webm'
          : rawSubtype.includes('quicktime') || rawSubtype.includes('mov')
            ? 'mov'
            : rawSubtype.includes('ogg')
              ? 'ogg'
              : 'mp4';
        const base64Data = matches?.[2] || finalVideoUrl.split(',')[1];
        if (base64Data) {
          const fileName = `${id}.${ext}`;
          const vidBuf = Buffer.from(base64Data, 'base64');
          await saveMediaFilePg(fileName, vidBuf, getVideoMimeType(fileName, `video/${rawSubtype}`));
          const filePath = path.join(UPLOADS_VIDEOS_DIR, fileName);
          try {
            fs.mkdirSync(UPLOADS_VIDEOS_DIR, { recursive: true });
            fs.writeFileSync(filePath, vidBuf);
            savedVideoDiskPath = filePath;
          } catch {}
          finalVideoUrl = `/uploads/videos/${fileName}`;
          if (finalUrl?.startsWith('data:video/')) finalUrl = finalVideoUrl;
        }
      } catch (vidErr) {
        console.warn('Aviso ao persistir data:video/ no Cloud SQL:', vidErr);
      }
    }

    let finalImageUrl = body.imageUrl || body.image || body.imagem_url || body.imagem || '';
    const rawIncomingBase64 =
      typeof finalImageUrl === 'string' && finalImageUrl.startsWith('data:image/')
        ? finalImageUrl
        : typeof finalUrl === 'string' && finalUrl.startsWith('data:image/')
          ? finalUrl
          : '';

    if (finalImageUrl && finalImageUrl.startsWith('data:image/')) {
      try {
        const matches = finalImageUrl.match(/^data:image\/([a-zA-Z0-9\-\+\.]+);base64,(.+)$/);
        const rawFormat = matches?.[1]?.toLowerCase() || 'jpg';
        const ext = rawFormat.includes('png')
          ? 'png'
          : rawFormat.includes('webp')
            ? 'webp'
            : rawFormat.includes('gif')
              ? 'gif'
              : rawFormat.includes('svg')
                ? 'svg'
                : rawFormat.includes('avif')
                  ? 'avif'
                  : 'jpg';
        const base64Data = matches?.[2] || finalImageUrl.split(',')[1];
        if (base64Data) {
          const fileName = `${id}.${ext}`;
          const buf = Buffer.from(base64Data, 'base64');
          try {
            fs.mkdirSync(UPLOADS_IMAGES_DIR, { recursive: true });
            fs.writeFileSync(path.join(UPLOADS_IMAGES_DIR, fileName), buf);
          } catch {}
          finalImageUrl = rawIncomingBase64 || `data:image/${ext};base64,${base64Data}`;
        }
      } catch {}
    }

    if (!finalImageUrl && !rawIncomingBase64 && finalVideoUrl) {
      if (finalVideoUrl.includes('youtu.be') || finalVideoUrl.includes('youtube.com')) {
        const ytMatch = finalVideoUrl.match(
          /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|live\/))([\w-]{11})/i
        );
        if (ytMatch?.[1]) {
          finalImageUrl = `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
        }
      } else if (savedVideoDiskPath || finalVideoUrl.startsWith('/uploads/videos/')) {
        try {
          const videoDiskPath = savedVideoDiskPath || path.join(UPLOADS_VIDEOS_DIR, path.basename(finalVideoUrl));
          const posterPath = path.join(UPLOADS_IMAGES_DIR, `${id}.jpg`);
          execSync(`ffmpeg -ss 00:00:01 -i "${videoDiskPath}" -vframes 1 -q:v 2 "${posterPath}" -y`, {
            timeout: 8000,
            stdio: 'ignore',
          });
          if (fs.existsSync(posterPath) && fs.statSync(posterPath).size > 500) {
            finalImageUrl = `data:image/jpeg;base64,${fs.readFileSync(posterPath).toString('base64')}`;
          }
        } catch {}
      }
    }

    if (!finalUrl && finalImageUrl) {
      finalUrl = rawIncomingBase64 || finalImageUrl;
    }

    const eventTitle = body.title || body.titulo || 'Evento';
    const eventDesc = body.description || body.descricao || '';
    const eventDate = body.date || body.data_evento || new Date().toISOString().split('T')[0];
    const eventTime = body.time || body.horario || '19:00';
    const eventEndTime = body.endTime || body.horario_fim || null;
    const eventLocation = body.locationName || body.local_nome || 'Local a definir';
    const eventAddress = body.address || body.endereco || '';
    const eventCity = body.city || body.cidade || 'São Paulo';
    const eventState = body.state || body.estado || 'SP';
    const eventOrganizer = body.organizer || body.organizador || '';
    const rawContact = body.contact || body.contato || '';
    const eventContact = rawContact.startsWith('data:image/') ? '' : rawContact;
    const eventPrice =
      body.price !== undefined && body.price !== null && !isNaN(Number(body.price)) ? Number(body.price) : 0;
    const eventIsFree = body.isFree ? 1 : 0;
    const rawPriceDetails = body.priceDetails || body.detalhes_preco || '';
    const eventPriceDetails = rawPriceDetails.includes('data:image/')
      ? eventIsFree
        ? 'Entrada Franca'
        : 'Consulte valores'
      : rawPriceDetails || (eventIsFree ? 'Entrada Franca' : '');
    const eventAdvertiserId = body.advertiserId || body.anunciante_id || null;
    const cleanLiberado =
      body.liberado !== undefined && body.liberado !== null && String(body.liberado).trim() !== ''
        ? String(body.liberado).trim().toUpperCase()
        : 'N';
    const cleanStatus = cleanLiberado === 'S' ? 'aprovado' : body.status || 'em_analise';
    const cleanTicketLink = finalUrl && !finalUrl.startsWith('data:image/') ? finalUrl : finalImageUrl || '';

    if (cleanLiberado !== 'S') {
      await insertSingleUserQuarantinePg({
        id,
        origem: 'anunciante',
        url_origem: cleanTicketLink,
        titulo: eventTitle,
        descricao: eventDesc,
        categoria: catResolved.nome,
        categoria_id: catResolved.id,
        data_evento: eventDate,
        horario: eventTime,
        horario_fim: eventEndTime,
        local_nome: eventLocation,
        endereco: eventAddress,
        cidade: eventCity,
        estado: eventState,
        latitude: latitude || null,
        longitude: longitude || null,
        imagem_url: finalImageUrl || '',
        organizador: eventOrganizer,
        preco: eventPrice,
        is_gratuito: eventIsFree,
        detalhes_preco: eventPriceDetails,
        link_ingressos: cleanTicketLink,
        status: 'quarentena',
        criado_em: createdAt,
        video_url: finalVideoUrl || null,
        url: cleanTicketLink || null,
        anunciante_id: eventAdvertiserId,
      });
    }

    await upsertEventPg({
      id,
      anunciante_id: eventAdvertiserId,
      categoria_id: catResolved.id,
      categoria: catResolved.nome,
      titulo: eventTitle,
      descricao: eventDesc,
      data_evento: eventDate,
      horario: eventTime,
      horario_fim: eventEndTime,
      local_nome: eventLocation,
      endereco: eventAddress,
      cidade: eventCity,
      estado: eventState,
      latitude,
      longitude,
      liberado: cleanLiberado,
      is_gratuito: eventIsFree,
      preco: eventPrice,
      detalhes_preco: eventPriceDetails,
      imagem_url: rawIncomingBase64 || finalImageUrl || null,
      video_url: finalVideoUrl || null,
      url:
        finalVideoUrl ||
        rawIncomingBase64 ||
        finalImageUrl ||
        (finalUrl && !finalUrl.startsWith('data:image/') ? finalUrl : null) ||
        null,
      organizador: eventOrganizer,
      contato: eventContact,
      tags: tagsString,
      destaque: body.featured ? 1 : 0,
      status: cleanStatus,
      criado_em: createdAt,
    });

    res.status(201).json({
      ...body,
      id,
      categoryId: catResolved.id,
      category: catResolved.nome,
      title: eventTitle,
      description: eventDesc,
      date: eventDate,
      time: eventTime,
      endTime: eventEndTime,
      locationName: eventLocation,
      address: eventAddress,
      city: eventCity,
      state: eventState,
      latitude,
      longitude,
      liberado: cleanLiberado,
      status: cleanStatus,
      videoUrl: finalVideoUrl || null,
      imageUrl: rawIncomingBase64 || finalImageUrl || '',
      url:
        finalVideoUrl ||
        rawIncomingBase64 ||
        finalImageUrl ||
        (finalUrl && !finalUrl.startsWith('data:image/') ? finalUrl : null) ||
        null,
      advertiserId: eventAdvertiserId,
      createdAt,
      price: eventPrice,
      isFree: eventIsFree === 1,
      priceDetails: eventPriceDetails,
      organizer: eventOrganizer,
      contact: eventContact,
      mediaType: finalVideoUrl || body.mediaType === 'video' ? 'video' : 'image',
    });
  } catch (error: any) {
    console.error('Erro ao cadastrar/atualizar evento:', error);
    res.status(500).json({ error: error.message || 'Erro ao gravar evento' });
  }
});

app.post('/api/events/liberar-todos', async (req, res) => {
  try {
    const { category } = req.body || {};
    const { totalUpdated, promotedFromQuarantine } = await liberateAllEventsPg(category);
    res.json({
      success: true,
      updatedCount: totalUpdated,
      promotedFromQuarantine,
      message: `${totalUpdated} evento(s) liberado(s) com sucesso no Cloud SQL e quarentena esvaziada.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao liberar todos os eventos' });
  }
});

app.put('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    if (body.liberado === 'S' && !body.title) {
      const approvedEvent = await approveEventRecordPg(
        id,
        {
          category: body.category,
          categoryId: body.categoryId ? Number(body.categoryId) : undefined,
          videoUrl: body.videoUrl,
          url: body.url,
          imageUrl: body.imageUrl,
          urlType: body.urlType,
        },
        fetchGeocodeCoordinates
      );
      return res.json({ success: true, id, liberado: 'S', event: approvedEvent });
    }

    if (body.liberado === 'N' && !body.title) {
      await setEventLiberadoNPg(id, body.status || 'em_analise');
      return res.json({ success: true, id, liberado: 'N' });
    }

    let latitude = body.latitude || null;
    let longitude = body.longitude || null;
    if (!latitude || !longitude) {
      const geocoded = await fetchGeocodeCoordinates(body.address, body.city, body.state);
      if (geocoded) {
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
      }
    }

    const catResolved = await resolveCategoryRecord(
      body.category || 'Shows',
      body.categoryId ? Number(body.categoryId) : null,
      true
    );

    await upsertEventPg({
      id,
      anunciante_id: body.advertiserId || null,
      categoria_id: catResolved.id,
      categoria: catResolved.nome,
      titulo: body.title,
      descricao: body.description || '',
      data_evento: body.date,
      horario: body.time,
      horario_fim: body.endTime || null,
      local_nome: body.locationName,
      endereco: body.address,
      cidade: body.city,
      estado: body.state,
      latitude,
      longitude,
      liberado: body.liberado || 'S',
      is_gratuito: body.isFree ? 1 : 0,
      preco: body.price || 0,
      detalhes_preco: body.priceDetails || '',
      imagem_url: body.imageUrl || null,
      video_url: body.videoUrl || body.video_url || null,
      url: body.url || body.videoUrl || body.imageUrl || null,
      organizador: body.organizer,
      contato: body.contact || '',
      tags: typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags || []),
      destaque: body.featured ? 1 : 0,
      status: body.status || 'aprovado',
      criado_em: body.createdAt || new Date().toISOString(),
    });

    if ((body.liberado || 'S') === 'S') {
      await deleteImportedEventPg(id, true).catch(() => {});
    }

    res.json({ success: true, id, latitude, longitude, liberado: body.liberado || 'S' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/events/:id/category', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, categoryId } = req.body;
    if (!category || typeof category !== 'string') {
      return res.status(400).json({ error: 'Categoria não informada' });
    }
    const result = await updateEventCategoryPg(id, category.trim(), categoryId ? Number(categoryId) : undefined);
    if (!result.found) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }
    res.json({
      success: true,
      id,
      category: result.category,
      isQuarantine: result.isQuarantine,
      tableName: 'eventos',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/events/:id/url', async (req, res) => {
  try {
    const { id } = req.params;
    const { url, urlType, videoUrl, imageUrl } = req.body;
    const targetUrl = url !== undefined && url !== null ? url : videoUrl || imageUrl;
    if (targetUrl === undefined || targetUrl === null) {
      return res.status(400).json({ error: 'Campo URL não informado' });
    }
    const result = await updateEventUrlPg(
      id,
      String(targetUrl).trim(),
      urlType,
      imageUrl ? String(imageUrl).trim() : null
    );
    res.json({
      success: true,
      ...result,
      message: `Campo URL atualizado com sucesso em: ${result.updatedTables.join(', ')}`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/events', async (_req, res) => {
  try {
    const result = await deleteAllEventsPg();
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/events/batch-delete', async (req, res) => {
  try {
    const { ids, scope, category } = req.body;
    const count = await deleteEventsBatchPg({ ids, scope, category });
    res.json({ success: true, count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    const changes = await deleteEventByIdPg(req.params.id);
    res.json({ success: true, changes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/events/sync-batch', async (req, res) => {
  try {
    const { events: items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ success: true, count: 0 });
    }
    const deletedSet = new Set(await getDeletedEventIdsPg());
    let totalSynced = 0;
    for (const item of items) {
      if (!item?.id || deletedSet.has(item.id)) continue;
      const cat = await resolveCategoryRecord(item.category || 'Shows', item.categoryId, false);
      await upsertEventPg({
        id: item.id,
        anunciante_id: item.advertiserId || null,
        categoria_id: cat.id,
        categoria: cat.nome,
        titulo: item.title || 'Evento',
        descricao: item.description || '',
        data_evento: item.date || '2026-09-20',
        horario: item.time || '20:00',
        horario_fim: item.endTime || null,
        local_nome: item.locationName || 'Local',
        endereco: item.address || '',
        cidade: item.city || 'São Paulo',
        estado: item.state || 'SP',
        latitude: item.latitude ? String(item.latitude) : null,
        longitude: item.longitude ? String(item.longitude) : null,
        liberado: String(item.liberado || 'N').toUpperCase(),
        is_gratuito: item.isFree ? 1 : 0,
        preco: item.price || 0,
        detalhes_preco: item.priceDetails || '',
        imagem_url: item.imageUrl || null,
        video_url: item.videoUrl || null,
        url: item.url || item.videoUrl || item.imageUrl || null,
        organizador: item.organizer || '',
        contato: item.contact || '',
        tags: JSON.stringify(item.tags || []),
        destaque: item.featured ? 1 : 0,
        status: item.status || (item.liberado === 'S' ? 'aprovado' : 'em_analise'),
        criado_em: item.createdAt || new Date().toISOString(),
      });
      totalSynced++;
    }
    res.json({ success: true, count: totalSynced });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/events/deleted-ids', async (_req, res) => {
  const deletedIds = await getDeletedEventIdsPg();
  res.json({ deletedIds });
});

app.post('/api/ignored-words/sync-batch', async (req, res) => {
  try {
    const { words } = req.body;
    if (!Array.isArray(words)) {
      return res.status(400).json({ error: 'Array "words" é obrigatório' });
    }
    const count = await syncIgnoredWordsBatch(words);
    res.json({ success: true, count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/advertisers/sync-batch', async (req, res) => {
  try {
    const { advertisers: list } = req.body;
    if (!Array.isArray(list)) {
      return res.status(400).json({ error: 'Array "advertisers" é obrigatório' });
    }
    for (const adv of list) {
      if (!adv?.email) continue;
      await upsertAdvertiserRecord({
        id: adv.id,
        name: adv.name,
        email: adv.email,
        phone: adv.phone,
        cpf: adv.cpf,
        city: adv.city,
        state: adv.state,
        verified: Boolean(adv.verified),
        createdAt: adv.createdAt,
      });
    }
    res.json({ success: true, count: list.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== QUARENTENA & IMPORTADORES (SYMPLA / TICKET360) ====================

app.post('/api/sympla/parse', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL do evento é obrigatória' });
    }
    const parsed = await parseSymplaEventUrl(url);
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Falha ao buscar dados do evento' });
  }
});

app.get('/api/imported-events', async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : 'quarentena';
    const origem = req.query.origem ? String(req.query.origem) : undefined;
    const items = await listImportedEventsPg(status, origem);
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/imported-events', async (req, res) => {
  try {
    const list = Array.isArray(req.body) ? req.body : [req.body];
    const result = await upsertImportedEventsPg(list, { idPrefix: 'imp' });
    res.status(201).json({
      success: true,
      count: result.addedCount,
      skippedCount: result.skippedCount,
      items: result.insertedItems,
      message:
        result.addedCount > 0
          ? `${result.addedCount} evento(s) adicionado(s) à Quarentena.`
          : 'Este evento já havia sido importado ou já existe no sistema!',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/imported-events/:id', async (req, res) => {
  try {
    await updateImportedEventPg(req.params.id, req.body);
    res.json({ success: true, id: req.params.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/imported-events/clear', async (_req, res) => {
  try {
    const count = await clearImportedEventsPg();
    res.json({ success: true, count, message: 'Todos os registros da quarentena foram apagados com sucesso.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/imported-events', async (_req, res) => {
  try {
    const count = await clearImportedEventsPg();
    res.json({ success: true, count, message: 'Todos os registros da quarentena foram apagados com sucesso.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/imported-events/:id', async (req, res) => {
  try {
    const permanent = req.query.permanent === 'true';
    const changes = await deleteImportedEventPg(req.params.id, permanent);
    res.json({ success: true, id: req.params.id, changes, permanent });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/imported-events/:id/approve', async (req, res) => {
  try {
    const body = req.body || {};
    const approvedEvent = await approveEventRecordPg(
      req.params.id,
      {
        category: body.category,
        categoryId: body.categoryId ? Number(body.categoryId) : undefined,
        videoUrl: body.videoUrl,
        url: body.url,
        imageUrl: body.imageUrl,
        urlType: body.urlType,
      },
      fetchGeocodeCoordinates
    );
    if (!approvedEvent) {
      return res.status(404).json({ error: 'Evento não encontrado para aprovação' });
    }
    res.json({ success: true, officialId: approvedEvent.id, event: approvedEvent });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/imported-events/approve-all', async (_req, res) => {
  try {
    const pendingIds = await getPendingQuarantineIdsPg();
    const approvedEvents: any[] = [];
    for (const id of pendingIds) {
      const appEvt = await approveEventRecordPg(id, undefined, fetchGeocodeCoordinates);
      if (appEvt) approvedEvents.push(appEvt);
    }
    res.json({ success: true, count: approvedEvents.length, events: approvedEvents });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sympla/search', async (req, res) => {
  try {
    const { q, query, city, state, rhythm, limit, page } = req.query;
    const result = await searchSymplaLiveEvents({
      query: String(q || query || '').trim(),
      city: city ? String(city) : undefined,
      state: state ? String(state) : undefined,
      rhythm: rhythm ? String(rhythm) : undefined,
      hitsPerPage: limit ? parseInt(String(limit), 10) : 20,
      page: page ? parseInt(String(page), 10) : 0,
    });

    const annotatedEvents = [];
    for (const ev of result.events) {
      if (await containsIgnoredWords(ev.title, ev.description || '')) continue;
      const dup = await checkDuplicateEventStatusPg(ev.ticketUrl || '', ev.title);
      annotatedEvents.push({ ...ev, ...dup });
    }

    res.json({
      success: true,
      total: result.total,
      page: result.page,
      pages: result.pages,
      hitsPerPage: result.hitsPerPage,
      events: annotatedEvents,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao buscar eventos na Sympla' });
  }
});

app.post('/api/sympla/import-live-batch', async (req, res) => {
  try {
    const { events: items, defaultCategory } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Nenhum evento fornecido para importação.' });
    }
    const resUpsert = await upsertImportedEventsPg(items, {
      origemOverride: 'sympla',
      idPrefix: 'imp-sympla',
      defaultCategory,
    });
    res.json({
      success: true,
      addedCount: resUpsert.addedCount,
      skippedCount: resUpsert.skippedCount,
      totalQuarantine: resUpsert.totalQuarantine,
      items: resUpsert.insertedItems,
      message:
        resUpsert.addedCount > 0
          ? `${resUpsert.addedCount} eventos foram importados para a Quarentena com sucesso!`
          : `Nenhum evento novo importado. Todos os ${resUpsert.skippedCount} eventos selecionados já constam no banco ou quarentena.`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao importar lote da Sympla' });
  }
});

app.post('/api/sympla/import-all-query', async (req, res) => {
  try {
    const { query, city, state, rhythm, defaultCategory, maxEvents = 600 } = req.body;
    const searchResult = await fetchAllSymplaLiveEvents({
      query,
      city,
      state,
      rhythm,
      maxEvents: Number(maxEvents) || 600,
    });
    const resUpsert = await upsertImportedEventsPg(searchResult.events, {
      origemOverride: 'sympla_live',
      idPrefix: 'sympla-live',
      defaultCategory,
    });
    res.json({
      success: true,
      totalFound: searchResult.total,
      totalProcessed: searchResult.events.length,
      addedCount: resUpsert.addedCount,
      skippedCount: resUpsert.skippedCount,
      totalQuarantine: resUpsert.totalQuarantine,
      items: resUpsert.insertedItems,
      message:
        resUpsert.addedCount > 0
          ? `Sucesso! Todos os ${resUpsert.addedCount} novos eventos encontrados foram importados para a Quarentena!`
          : `Nenhum novo evento pendente. Todos os ${resUpsert.skippedCount} eventos encontrados já constavam no banco ou na quarentena.`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao importar todos os eventos da busca' });
  }
});

app.post('/api/database/sync-relations', async (_req, res) => {
  try {
    const stats = await syncEventsRelationsPg();
    res.json({
      success: true,
      ...stats,
      message: 'Integração relacional executada com sucesso no Cloud SQL PostgreSQL!',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao sincronizar relações do banco' });
  }
});

app.post('/api/sympla/discover-all', async (req, res) => {
  try {
    const { state, city } = req.body || {};
    const discovered = await discoverAllRhythmsBatch({ state, city });
    const resUpsert = await upsertImportedEventsPg(discovered, {
      origemOverride: 'sympla',
      idPrefix: 'imp-ritmo',
    });
    res.json({
      success: true,
      addedCount: resUpsert.addedCount,
      skippedCount: resUpsert.skippedCount,
      totalQuarantine: resUpsert.totalQuarantine,
      items: resUpsert.insertedItems,
      message:
        resUpsert.addedCount > 0
          ? `${resUpsert.addedCount} novos eventos foram adicionados à Quarentena (${resUpsert.skippedCount} já existentes ignorados).`
          : `Nenhum evento novo encontrado. Todos os ${resUpsert.skippedCount} eventos já estavam cadastrados.`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao importar todos os ritmos' });
  }
});

app.post('/api/ticket360/parse', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL do evento da Ticket360 é obrigatória' });
    }
    const parsed = await parseTicket360EventUrl(url);
    if (!hasValidTicket360Image(parsed.imagemUrl)) {
      return res.status(400).json({ error: 'Evento sem imagem válida no Ticket360.' });
    }
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Falha ao buscar dados do evento na Ticket360' });
  }
});

app.get('/api/ticket360/search', async (req, res) => {
  try {
    const { q, query, city, state, rhythm, limit, page } = req.query;
    const result = await searchTicket360LiveEvents({
      query: String(q || query || '').trim(),
      city: city ? String(city) : undefined,
      state: state ? String(state) : undefined,
      rhythm: rhythm ? String(rhythm) : undefined,
      hitsPerPage: limit ? parseInt(String(limit), 10) : 20,
      page: page ? parseInt(String(page), 10) : 0,
    });

    const annotatedEvents = [];
    for (const ev of result.events) {
      if (!hasValidTicket360Image(ev.imageUrl)) continue;
      if (await containsIgnoredWords(ev.title, ev.description || '')) continue;
      const dup = await checkDuplicateEventStatusPg(ev.ticketUrl || '', ev.title);
      annotatedEvents.push({ ...ev, ...dup });
    }

    res.json({
      success: true,
      total: result.total,
      page: result.page,
      pages: result.pages,
      hitsPerPage: result.hitsPerPage,
      events: annotatedEvents,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao buscar eventos na Ticket360' });
  }
});

app.post('/api/ticket360/import-live-batch', async (req, res) => {
  try {
    const { events: items, defaultCategory } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Nenhum evento fornecido para importação.' });
    }
    const validItems = items.filter((it) => hasValidTicket360Image(it.imageUrl));
    const resUpsert = await upsertImportedEventsPg(validItems, {
      origemOverride: 'ticket360',
      idPrefix: 'imp-t360',
      defaultCategory,
    });
    res.json({
      success: true,
      addedCount: resUpsert.addedCount,
      skippedCount: resUpsert.skippedCount + (items.length - validItems.length),
      totalQuarantine: resUpsert.totalQuarantine,
      items: resUpsert.insertedItems,
      message:
        resUpsert.addedCount > 0
          ? `${resUpsert.addedCount} eventos da Ticket360 importados para a Quarentena!`
          : 'Nenhum evento novo importado.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao importar lote da Ticket360' });
  }
});

app.post('/api/ticket360/import-all-query', async (req, res) => {
  try {
    const { query, city, state, rhythm, defaultCategory, maxEvents = 600 } = req.body;
    const searchResult = await fetchAllTicket360LiveEvents({
      query,
      city,
      state,
      rhythm,
      maxEvents: Number(maxEvents) || 600,
    });
    const validItems = searchResult.events.filter((it) => hasValidTicket360Image(it.imageUrl));
    const resUpsert = await upsertImportedEventsPg(validItems, {
      origemOverride: 'ticket360',
      idPrefix: 't360-live',
      defaultCategory,
    });
    res.json({
      success: true,
      addedCount: resUpsert.addedCount,
      skippedCount: resUpsert.skippedCount,
      totalQuarantine: resUpsert.totalQuarantine,
      items: resUpsert.insertedItems,
      message:
        resUpsert.addedCount > 0
          ? `${resUpsert.addedCount} novos eventos da Ticket360 adicionados à Quarentena!`
          : 'Nenhum evento novo adicionado.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao importar todos da busca Ticket360' });
  }
});

app.post('/api/ticket360/discover-all', async (req, res) => {
  try {
    const { state, city } = req.body || {};
    const discovered = await discoverAllTicket360RhythmsBatch({ state, city });
    const validItems = discovered.filter((it) => hasValidTicket360Image(it.imageUrl));
    const resUpsert = await upsertImportedEventsPg(validItems, {
      origemOverride: 'ticket360',
      idPrefix: 'imp-t360-ritmo',
    });
    res.json({
      success: true,
      addedCount: resUpsert.addedCount,
      skippedCount: resUpsert.skippedCount,
      totalQuarantine: resUpsert.totalQuarantine,
      items: resUpsert.insertedItems,
      message:
        resUpsert.addedCount > 0
          ? `${resUpsert.addedCount} novos eventos da Ticket360 adicionados à Quarentena.`
          : 'Nenhum evento novo encontrado.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao importar eventos Ticket360' });
  }
});

app.patch('/api/imported-events/:id/category', async (req, res) => {
  try {
    const { category } = req.body;
    if (!category) return res.status(400).json({ error: 'Categoria é obrigatória' });
    const resolved = await patchImportedCategoryPg(req.params.id, category);
    res.json({ success: true, id: req.params.id, category: resolved.nome, categoryId: resolved.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/imported-events/batch-category', async (req, res) => {
  try {
    const { ids, category } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !category) {
      return res.status(400).json({ error: 'IDs e Categoria são obrigatórios' });
    }
    const result = await batchImportedCategoryPg(ids, category);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/imported-events/batch-approve', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs não informados' });
    }
    const approvedEvents: any[] = [];
    for (const id of ids) {
      const appEvt = await approveEventRecordPg(id, undefined, fetchGeocodeCoordinates);
      if (appEvt) approvedEvents.push(appEvt);
    }
    res.json({ success: true, count: approvedEvents.length, events: approvedEvents });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/imported-events/batch-delete', async (req, res) => {
  try {
    const { ids, permanent } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs não informados' });
    }
    const count = await batchDeleteImportedPg(ids, permanent === true);
    res.json({ success: true, count, permanent: Boolean(permanent) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ANUNCIANTES ====================

function validateCpfBackend(value: any): boolean {
  if (!value) return false;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  let sum1 = 0;
  for (let i = 0; i < 9; i++) sum1 += parseInt(digits.charAt(i), 10) * (10 - i);
  let rest1 = (sum1 * 10) % 11;
  if (rest1 >= 10) rest1 = 0;
  if (rest1 !== parseInt(digits.charAt(9), 10)) return false;
  let sum2 = 0;
  for (let i = 0; i < 10; i++) sum2 += parseInt(digits.charAt(i), 10) * (11 - i);
  let rest2 = (sum2 * 10) % 11;
  if (rest2 >= 10) rest2 = 0;
  return rest2 === parseInt(digits.charAt(10), 10);
}

function formatCpfBackend(value: any): string {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '').slice(0, 11);
  if (digits.length !== 11) return String(value);
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

app.get('/api/advertisers', async (_req, res) => {
  try {
    res.json(await getAdvertisersList());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.all(['/api/advertisers/check', '/api/anunciantes/check'], async (req, res) => {
  try {
    const email = (req.body?.email || req.query?.email || '').toString().trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'E-mail não informado' });
    const adv = await findAdvertiserByEmail(email);
    res.json({ exists: Boolean(adv), advertiser: adv });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const advertiserVerificationCodes = new Map<
  string,
  { code: string; expiresAt: number; phone: string; name: string; cpf?: string }
>();
const confirmedEmailsForRegistration = new Set<string>();

app.post(['/api/advertisers/send-code', '/api/anunciantes/send-code'], (req, res) => {
  try {
    const { email, phone, name, cpf } = req.body;
    if (!email) return res.status(400).json({ error: 'E-mail é obrigatório para envio do código.' });
    const cleanEmail = email.toString().trim().toLowerCase();
    const cleanPhone = (phone || '').toString().trim();
    const cleanName = (name || '').toString().trim() || 'Anunciante';
    const cleanCpf = (cpf || '').toString().trim();

    if (cleanCpf && !validateCpfBackend(cleanCpf)) {
      return res.status(400).json({ error: 'CPF informado é inválido.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    advertiserVerificationCodes.set(cleanEmail, {
      code,
      expiresAt: Date.now() + 15 * 60 * 1000,
      phone: cleanPhone,
      name: cleanName,
      cpf: cleanCpf ? formatCpfBackend(cleanCpf) : undefined,
    });

    const confirmationMessage = `[Pra Onde Eu Vou]: Olá ${cleanName}! Seu código de confirmação de anunciante é: ${code}. Digite este código no aplicativo para confirmar seu cadastro. Válido por 15 minutos.`;
    res.json({
      success: true,
      message: 'Mensagem de confirmação enviada com sucesso.',
      code,
      phone: cleanPhone,
      email: cleanEmail,
      cpf: cleanCpf ? formatCpfBackend(cleanCpf) : undefined,
      confirmationMessage,
      expiresInMinutes: 15,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post(['/api/advertisers/verify-code', '/api/anunciantes/verify-code'], (req, res) => {
  try {
    const { email, code } = req.body;
    const cleanEmail = (email || '').toString().trim().toLowerCase();
    const cleanCode = (code || '').toString().trim().replace(/\D/g, '');
    if (!cleanEmail || !cleanCode) {
      return res.status(400).json({ valid: false, error: 'E-mail e código são obrigatórios.' });
    }
    const record = advertiserVerificationCodes.get(cleanEmail);
    if (!record) {
      return res.status(400).json({ valid: false, error: 'Código não encontrado ou expirado.' });
    }
    if (Date.now() > record.expiresAt) {
      advertiserVerificationCodes.delete(cleanEmail);
      return res.status(400).json({ valid: false, error: 'Código expirado.' });
    }
    if (record.code !== cleanCode) {
      return res.status(400).json({ valid: false, error: 'Código incorreto.' });
    }
    advertiserVerificationCodes.delete(cleanEmail);
    confirmedEmailsForRegistration.add(cleanEmail);
    res.json({ valid: true, message: 'Código confirmado com sucesso!', email: cleanEmail });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post(['/api/advertisers', '/api/anunciantes'], async (req, res) => {
  try {
    const { id, name, email, phone, cpf, city, state, verified } = req.body;
    const cleanEmail = (email || '').toString().trim().toLowerCase();
    if (!confirmedEmailsForRegistration.has(cleanEmail) && !verified) {
      return res.status(403).json({
        error: 'Somente é permitido cadastrar o anunciante após a confirmação do código enviado.',
      });
    }
    const rawCpf = (cpf || '').toString().trim();
    let formattedCpf = '';
    if (rawCpf) {
      if (!validateCpfBackend(rawCpf)) {
        return res.status(400).json({ error: 'CPF inválido.' });
      }
      formattedCpf = formatCpfBackend(rawCpf);
    }

    const created = await upsertAdvertiserRecord({
      id,
      name,
      email: cleanEmail,
      phone,
      cpf: formattedCpf,
      city,
      state,
      verified: true,
    });
    confirmedEmailsForRegistration.delete(cleanEmail);
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== FAVORITOS ====================

app.get('/api/favorites', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid || 'default_user';
    res.json(await getFavoritesList(uid));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/favorites', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId é obrigatório' });
    const uid = req.user?.uid || 'default_user';
    await addFavoriteRecord(eventId, uid);
    res.json({ success: true, eventId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/favorites/:eventId', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid || 'default_user';
    await removeFavoriteRecord(req.params.eventId, uid);
    res.json({ success: true, eventId: req.params.eventId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CATEGORIAS, PALAVRAS IGNORADAS, CIDADES, SUPERVISOR ====================

app.get(['/api/categories', '/api/categorias'], async (_req, res) => {
  try {
    res.json(await getCategoriesList());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const { nome, descricao } = req.body;
    if (!nome?.trim()) return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
    const created = await createCategoryRecord(nome, descricao);
    res.status(201).json(created);
  } catch (error: any) {
    if (error.message === 'UNIQUE_CATEGORY') {
      return res.status(409).json({ error: 'Categoria já existe' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/categories/tables', async (_req, res) => {
  try {
    const cats = await getCategoriesList();
    res.json({
      success: true,
      totalTables: 1,
      tables: [{ table: 'eventos', count: cats.length }],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const changes = await deleteCategoryRecord(Number(req.params.id));
    res.json({ success: true, changes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ignored-words', async (_req, res) => {
  try {
    res.json(await getIgnoredWordsList());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ignored-words', async (req, res) => {
  try {
    const { palavra } = req.body;
    if (!palavra?.trim()) return res.status(400).json({ error: 'Palavra é obrigatória' });
    const created = await addIgnoredWordRecord(palavra);
    res.status(201).json(created);
  } catch (error: any) {
    if (error.message === 'UNIQUE_WORD') {
      return res.status(409).json({ error: 'Palavra já cadastrada como ignorada' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/ignored-words/:id', async (req, res) => {
  try {
    const changes = await deleteIgnoredWordRecord(Number(req.params.id));
    res.json({ success: true, changes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const getEstadoHandler = async (req: any, res: any) => {
  try {
    const items = await getCidadesList(
      req.query.estado ? String(req.query.estado) : undefined,
      req.query.search ? String(req.query.search) : undefined
    );
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const postEstadoHandler = async (req: any, res: any) => {
  try {
    const { nome, estado: est, regiao } = req.body;
    if (!nome?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
    const created = await createCidadeRecord(nome, est || 'SP', regiao || 'Sudeste');
    res.status(201).json(created);
  } catch (error: any) {
    if (error.message === 'UNIQUE_CITY') {
      return res.status(409).json({ error: 'Cidade já existe no cadastro de cidades' });
    }
    res.status(500).json({ error: error.message });
  }
};

const deleteAllEstadoHandler = async (_req: any, res: any) => {
  try {
    const changes = await deleteAllCidadesRecords();
    res.json({ success: true, changes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const deleteSingleEstadoHandler = async (req: any, res: any) => {
  try {
    const changes = await deleteCidadeRecord(Number(req.params.id));
    res.json({ success: true, changes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

app.get(['/api/estado', '/api/estados', '/api/cidades'], getEstadoHandler);
app.post(['/api/estado', '/api/estados', '/api/cidades'], postEstadoHandler);
app.delete(['/api/estado', '/api/estados', '/api/cidades'], deleteAllEstadoHandler);
app.delete(['/api/estado/:id', '/api/estados/:id', '/api/cidades/:id'], deleteSingleEstadoHandler);

app.get('/api/supervisors', async (_req, res) => {
  try {
    res.json(await getSupervisorsList());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/supervisors', async (req, res) => {
  try {
    const { nome, senha } = req.body;
    if (!nome?.trim() || !senha?.trim()) {
      return res.status(400).json({ error: 'Nome e senha são obrigatórios' });
    }
    const created = await createSupervisorRecord(nome, senha);
    res.status(201).json(created);
  } catch (error: any) {
    if (error.message === 'UNIQUE_SUPERVISOR') {
      return res.status(409).json({ error: 'Já existe um supervisor cadastrado com este nome.' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/supervisors/:id', async (req, res) => {
  try {
    const { nome, senha } = req.body;
    const changes = await updateSupervisorRecord(Number(req.params.id), nome, senha);
    res.json({ success: true, changes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/supervisors/:id', async (req, res) => {
  try {
    const changes = await deleteSupervisorRecord(Number(req.params.id));
    res.json({ success: true, changes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== MERCADO PAGO PIX & PATROCINADORES ====================

app.all(['/api/webhook/mercadopago', '/api/mercadopago/webhook'], async (req, res) => {
  try {
    const paymentId = req.body?.data?.id || req.query['data.id'] || req.query.id || req.body?.id;
    if (paymentId) {
      const check = await checkMercadoPagoPaymentStatus(String(paymentId));
      if (check.isPaid) {
        await markPixPaymentApprovedPg(String(paymentId)).catch(() => {});
      }
    }
    res.status(200).json({ received: true });
  } catch (err: any) {
    res.status(200).json({ received: true, error: err.message });
  }
});

app.post('/api/sponsors/pix/create', pixCreateRateLimiter, async (req, res) => {
  try {
    const { sponsorId, name, phone, address, city, state, category, description, badge, imageUrl } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Nome e Telefone são obrigatórios para gerar o Pix.' });
    }
    const cleanPhone = String(phone).replace(/\D/g, '');
    const cleanId = sponsorId || `sp-${Date.now()}`;
    const valor = 100.0;
    const protocolo = `PROT-${Date.now().toString().slice(-6)}`;

    await upsertSponsorForPix({
      id: cleanId,
      nome: name.trim(),
      categoria: category || 'Comércio Local',
      descricao: description || '',
      telefone: cleanPhone,
      endereco: address || '',
      cidade: city || '',
      estado: state || 'SP',
      badge: badge || '',
      imagem_url: imageUrl || '',
      valor_mensal: valor,
      protocolo,
    });

    const host = req.get('host');
    const webhookUrl = `${req.protocol}://${host}/api/webhook/mercadopago`;

    const pixRes = await createMercadoPagoPixPayment({
      transactionAmount: valor,
      description: `Patrocínio Vitrine (R$ 100/mês) - ${name.trim()}`,
      payerEmail: `anunciante.${cleanPhone}@praondeeuvou.com.br`,
      payerName: name.trim(),
      payerPhone: cleanPhone,
      externalReference: cleanId,
      notificationUrl: webhookUrl,
    });

    if (!pixRes.success) {
      return res.status(500).json({ error: pixRes.errorMessage || 'Falha ao gerar o código Pix.' });
    }

    await insertPixPaymentRecord({
      id: `pix-${Date.now()}`,
      patrocinador_id: cleanId,
      mercado_pago_id: pixRes.paymentId,
      status: pixRes.status,
      valor,
      qr_code: pixRes.qrCode,
      qr_code_base64: pixRes.qrCodeBase64,
      ticket_url: pixRes.ticketUrl,
      telefone_notificado: cleanPhone,
    });

    res.json({
      success: true,
      sponsorId: cleanId,
      paymentId: pixRes.paymentId,
      status: pixRes.status,
      valor,
      qrCode: pixRes.qrCode,
      qrCodeBase64: pixRes.qrCodeBase64,
      ticketUrl: pixRes.ticketUrl,
      isSimulated: pixRes.isSimulated,
      advertiserPhone: cleanPhone,
      advertiserName: name.trim(),
      chavePix: pixRes.chavePix,
      tipoChave: pixRes.tipoChave,
      nomeBeneficiario: pixRes.nomeBeneficiario,
      cidadeBeneficiario: pixRes.cidadeBeneficiario,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro interno ao processar Pix' });
  }
});

app.get('/api/pix/platform-key', async (_req, res) => {
  try {
    const cfg = await getPixConfigPg();
    res.json({
      success: true,
      chavePix: cfg.chavePix,
      tipoChave: cfg.tipoChave,
      nomeBeneficiario: cfg.nomeBeneficiario,
      cidadeBeneficiario: cfg.cidadeBeneficiario,
      hasMercadoPago: !!cfg.mercadoPagoToken,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/pix-config', adminRateLimiter, async (_req, res) => {
  try {
    const cfg = await getPixConfigPg();
    res.json({ success: true, ...cfg });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/pix-config', adminRateLimiter, async (req, res) => {
  try {
    const { chavePix, tipoChave, nomeBeneficiario, cidadeBeneficiario, mercadoPagoToken } = req.body;
    if (!chavePix?.trim()) {
      return res.status(400).json({ error: 'A Chave Pix é obrigatória.' });
    }
    const updated = await savePixConfigPg({
      chavePix,
      tipoChave,
      nomeBeneficiario,
      cidadeBeneficiario,
      mercadoPagoToken,
    });
    res.json({ success: true, message: 'Configurações de Pix salvas com sucesso!', config: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sponsors/pix/status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { pix: localPix, sponsor: localSponsor } = await getPixPaymentWithSponsor(paymentId);

    if (localPix && (localPix.status === 'approved' || localPix.status === 'pago')) {
      return res.json({
        paymentId,
        status: 'approved',
        statusDetail: 'accredited',
        isPaid: true,
        sponsor: localSponsor,
      });
    }

    const check = await checkMercadoPagoPaymentStatus(paymentId);
    if (check.isPaid) {
      await markPixPaymentApprovedPg(paymentId).catch(() => {});
    }

    const { sponsor } = await getPixPaymentWithSponsor(paymentId);
    res.json({
      paymentId,
      status: check.status,
      statusDetail: check.statusDetail,
      isPaid: check.isPaid,
      sponsor,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao checar status Pix' });
  }
});

app.post('/api/sponsors/notify-confirmation', async (req, res) => {
  try {
    const { phone, sponsorName, protocol } = req.body;
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const protText = protocol ? `\n📋 *Protocolo:* ${protocol}` : '';
    const message = `✅ *Olá, ${sponsorName}! Recebemos seu Pix de R$ 100,00 com sucesso!*\n\n🔒 *Por motivos de segurança*, o seu anúncio passará pela nossa análise cadastral e será liberado na vitrine do app *Pra onde eu vou* em até *48 horas*.\n${protText}\n\nAssim que nossa equipe concluir a verificação, você receberá o aviso de ativação. Obrigado pela confiança! 🚀`;

    await markPixNotificationSentPg(cleanPhone);
    const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
    res.json({ success: true, phone: cleanPhone, message, whatsappUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/sponsors', async (req, res) => {
  try {
    const items = await listSponsorsPg({
      status: req.query.status ? String(req.query.status) : undefined,
      liberado: req.query.liberado ? String(req.query.liberado) : undefined,
    });
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/sponsors/:id/liberacao', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, motivo } = req.body;
    const { changes, novoLiberado, novoAtivo, updated } = await updateSponsorLiberationPg(id, action);

    let whatsappNotifyUrl = '';
    if (updated?.telefone) {
      const cleanPhone = String(updated.telefone).replace(/\D/g, '');
      let msg = '';
      if (novoLiberado === 'S') {
        msg = `🌟 *Ótima notícia, ${updated.nome}!* O seu anúncio foi APROVADO e LIBERADO na vitrine do *Pra onde eu vou*! Já está visível para os clientes mais próximos da sua região. Boas vendas e muito sucesso! 🚀`;
      } else if (novoLiberado === 'N') {
        msg = `Olá, ${updated.nome}. Informamos que o seu anúncio no *Pra onde eu vou* necessita de ajustes cadastrais (${motivo || 'dados cadastrais'}). Entre em contato com nosso suporte para regularização.`;
      }
      whatsappNotifyUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`;
    }

    res.json({
      success: true,
      changes,
      id,
      liberado: novoLiberado,
      active: novoAtivo === 1,
      whatsappNotifyUrl,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ESTATÍSTICAS & ADMIN AUTH ====================

app.get('/api/admin/estatisticas', async (_req, res) => {
  try {
    const data = await getEstatisticasPg();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/estatisticas', async (_req, res) => {
  try {
    const changes = await clearEstatisticasPg();
    res.json({ success: true, message: 'Estatísticas zeradas com sucesso', changes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/verify-password', async (req, res) => {
  try {
    const clean = String(req.body?.password || '').trim();
    if (!clean) {
      return res.status(400).json({ valid: false, message: 'Senha é obrigatória' });
    }
    if (clean === '0612') {
      return res.json({ valid: true, user: 'Administrador Master', role: 'master' });
    }
    const sup = await verifySupervisorByPassword(clean);
    if (sup) {
      return res.json({ valid: true, user: sup.nome, supervisorId: sup.id, role: 'supervisor' });
    }
    return res.status(401).json({
      valid: false,
      message: 'Senha incorreta. Digite a senha padrão (0612) ou a senha cadastrada na tabela supervisor.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SQL CONSOLE & LIMPEZA (CLOUD SQL POSTGRESQL) ====================

app.get('/api/sql/schema', async (_req, res) => {
  try {
    const tables = await getPostgresSchemaInfo();
    res.json({
      databaseName: process.env.SQL_DB_NAME || 'Cloud SQL PostgreSQL',
      engine: 'Cloud SQL PostgreSQL (Drizzle ORM)',
      tables,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sql/query', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Comando SQL não informado' });
    }
    const startTime = performance.now();
    const result = await executePostgresSqlQuery(query);
    const durationMs = (performance.now() - startTime).toFixed(2);
    res.json({ ...result, durationMs: `${durationMs}ms` });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Erro de sintaxe ou execução no PostgreSQL' });
  }
});

app.post('/api/admin/cleanup-database', async (req, res) => {
  try {
    const scope =
      req.body?.type === 'diaria' || req.body?.type === 'manual' ? req.body.type : 'quinzenal';
    const result = await runPostgresCleanup(scope);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/cleanup-status', async (_req, res) => {
  try {
    const { monitoredTables, lastExecution, history } = await getCleanupStatusPg();
    const spString = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    res.json({
      success: true,
      currentServerTimeSP: spString,
      executionHour: '06:00 da manhã',
      executionReason:
        'Horário selecionado de menor ou quase nenhum fluxo de usuários para garantir execução silenciosa, segura e sem concorrência.',
      protectedTables: [],
      activeSchedules: {
        quinzenal: {
          cron: '0 6 1,15 * *',
          time: '06:00 da manhã',
          description: 'Todo dia 15 e todo dia 1 de cada mês às 06:00 (America/Sao_Paulo)',
          action: 'Exclusão de registros expirados e atualização de índices no Cloud SQL PostgreSQL',
        },
        diaria: {
          cron: '0 6 * * *',
          time: '06:00 da manhã',
          description: 'Todos os dias às 06:00 (America/Sao_Paulo)',
          action: 'Exclusão diária de eventos anteriores à data de hoje no Cloud SQL PostgreSQL',
        },
      },
      monitoredTables,
      lastExecution,
      history,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/create-eventos-table', async (_req, res) => {
  try {
    const rows = await getRawEventosPg();
    res.json({
      success: true,
      message: 'Tabela eventos ativa e sincronizada no Cloud SQL PostgreSQL!',
      rowCount: rows.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.all(['/api/admin/sync-from-firestore', '/api/events/reload-from-firestore'], async (_req, res) => {
  try {
    const rows = await getRawEventosPg();
    res.json({
      success: true,
      count: rows.length,
      totalInDb: rows.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== VITE MIDDLEWARE & SERVER START ====================

async function startServer() {
  const runningCompiledDist =
    (typeof __filename !== 'undefined' && __filename.includes(`${path.sep}dist${path.sep}`)) ||
    (process.argv[1] && process.argv[1].includes(`${path.sep}dist${path.sep}`));
  const hasSourceEntry = fs.existsSync(path.join(process.cwd(), 'src', 'main.tsx'));
  const distPath = path.join(process.cwd(), 'dist');
  const hasDistBuild = fs.existsSync(path.join(distPath, 'index.html'));

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    runningCompiledDist ||
    !hasSourceEntry;

  let servedWithVite = false;
  if (!isProduction || (!hasDistBuild && hasSourceEntry)) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      servedWithVite = true;
    } catch (viteErr) {
      console.error('[Pra onde eu vou] Falha ao iniciar Vite middleware:', viteErr);
      servedWithVite = false;
    }
  }

  if (!servedWithVite) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        return res.status(404).json({ error: 'Recurso não encontrado' });
      }
      if (!fs.existsSync(path.join(distPath, 'index.html'))) {
        return res.status(503).send('Aplicação compilando. Atualize a página em instantes.');
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Pra onde eu vou] Servidor Cloud SQL PostgreSQL + Express rodando na porta ${PORT}`);

    cron.schedule(
      '0 6 1,15 * *',
      () => {
        runPostgresCleanup('quinzenal').catch((err) =>
          console.error('[Cron Quinzenal] Erro:', err)
        );
      },
      { timezone: 'America/Sao_Paulo' }
    );

    cron.schedule(
      '0 6 * * *',
      () => {
        runPostgresCleanup('diaria').catch((err) => console.error('[Cron Diário] Erro:', err));
      },
      { timezone: 'America/Sao_Paulo' }
    );
  });
}

startServer();
