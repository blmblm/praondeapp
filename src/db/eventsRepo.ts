import fs from 'fs';
import path from 'path';
import { asc, desc, eq, ilike, inArray, or, sql, and } from 'drizzle-orm';
import { db } from './index.ts';
import {
  anunciantes,
  categorias,
  estado,
  eventos,
  eventosImportados,
  favoritos,
  registroEventosDeletados,
} from './schema.ts';
import {
  getEstadoIdByText,
  resolveCategoryRecord,
  resolveEstadoOrCidade,
} from './catalogRepo.ts';
import {
  autoExtractPosterFromVideo,
  BRAZIL_CITY_COORDINATES,
  isCleanImage,
  isCleanVideo,
  normalizeCityKey,
} from './mediaHelpers.ts';
import {
  deleteMediaFilesIfUnusedPg,
  listMediaFilenamesPg,
  normalizeMediaFilename,
} from './mediaRepo.ts';

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function checkLocalVideoFileExists(p: string, mediaFileSet?: Set<string>): boolean {
  if (!p) return false;
  const bn = normalizeMediaFilename(p);
  if (bn && mediaFileSet?.has(bn)) {
    return true;
  }
  const diskBn = path.basename(p.split('?')[0]);
  return (
    fs.existsSync(path.join(process.cwd(), p)) ||
    fs.existsSync(path.join(process.cwd(), 'public', p)) ||
    fs.existsSync(path.join(process.cwd(), 'uploads', 'videos', diskBn)) ||
    fs.existsSync(path.join(process.cwd(), 'public', 'uploads', 'videos', diskBn)) ||
    fs.existsSync(path.join('/tmp', 'uploads', 'videos', diskBn))
  );
}

function hasRealImageFile(img?: string | null): boolean {
  if (!img || typeof img !== 'string') return false;
  const t = img.trim();
  if (!t || t === 'null' || t === 'undefined' || t.includes('images.unsplash.com/photo-1514525253161-7a46d19cd819')) {
    return false;
  }
  if (
    t === '__DATA_IMAGE__' ||
    t.startsWith('/api/event-poster/') ||
    t.startsWith('data:image/') ||
    t.startsWith('http://') ||
    t.startsWith('https://')
  ) {
    return true;
  }
  if (t.startsWith('/uploads/images/') || t.startsWith('uploads/images/') || t.startsWith('/assets/')) {
    const fn = path.basename(t.split('?')[0]);
    return (
      fs.existsSync(path.join(process.cwd(), 'uploads', 'images', fn)) ||
      fs.existsSync(path.join(process.cwd(), 'public', 'uploads', 'images', fn)) ||
      fs.existsSync(path.join('/tmp', 'uploads', 'images', fn)) ||
      fs.existsSync(path.join(process.cwd(), t.split('?')[0]))
    );
  }
  return false;
}

function isValidImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const t = url.trim();
  return (
    t === '__DATA_IMAGE__' ||
    t.startsWith('/api/event-poster/') ||
    t.startsWith('http://') ||
    t.startsWith('https://') ||
    t.startsWith('data:image/') ||
    t.startsWith('/uploads/') ||
    t.startsWith('/assets/') ||
    t.startsWith('./uploads/') ||
    t.startsWith('./assets/') ||
    /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(t)
  );
}

export async function getRawEventosPg() {
  try {
    return await db.select().from(eventos).orderBy(desc(eventos.criado_em));
  } catch (error) {
    console.error('Database query failed in getRawEventosPg:', error);
    throw new Error('Falha ao listar tabela de eventos.', { cause: error });
  }
}

export async function getEventoPosterByIdPg(id: string) {
  try {
    const rows = await db
      .select({ id: eventos.id, imagem_url: eventos.imagem_url, url: eventos.url })
      .from(eventos)
      .where(eq(eventos.id, id))
      .limit(1);
    if (rows[0]) return rows[0];
    const impRows = await db
      .select({ id: eventosImportados.id, imagem_url: eventosImportados.imagem_url, url: eventosImportados.url })
      .from(eventosImportados)
      .where(eq(eventosImportados.id, id))
      .limit(1);
    return impRows[0] || null;
  } catch {
    return null;
  }
}

export async function getEventoImageRowPg(keys: string[]) {
  try {
    const [baseName, filename] = keys;
    const rows = await db
      .select({ id: eventos.id, imagem_url: eventos.imagem_url, url: eventos.url })
      .from(eventos)
      .where(
        or(
          eq(eventos.id, baseName),
          eq(eventos.id, filename),
          ilike(eventos.imagem_url, `%${filename}%`),
          ilike(eventos.url, `%${filename}%`)
        )
      )
      .limit(1);
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function listEventsPg(queryParams: Record<string, any>) {
  try {
    const {
      category,
      city,
      estado: estadoQ,
      state,
      search,
      status,
      liberado,
      admin,
      include_base64,
      has_image,
      com_imagem,
      data_min,
      date,
      data_atual,
      somente_futuros,
      order_by,
      user_lat,
      lat,
      user_lng,
      lng,
      mais_proximos,
      limit,
    } = queryParams;

    const isAdmin = admin === 'true';
    const includeBase64 = isAdmin || include_base64 === 'true';
    const requireMedia = !isAdmin || has_image === 'true' || com_imagem === 'true';

    const hasCategoryFilter = Boolean(
      category && category !== 'Todos' && category !== 'Todas' && category !== 'Categorias'
    );
    const catClean = hasCategoryFilter ? String(category).trim().toLowerCase() : null;

    const normalizeText = (s?: string | null) =>
      (s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const minDate =
      (data_min || date) && !search
        ? String(data_min || date)
        : data_atual === 'true' || somente_futuros === 'true'
          ? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
          : null;

    const whereConditions: any[] = [];
    if (status) {
      whereConditions.push(eq(eventos.status, String(status)));
    }
    if (liberado) {
      whereConditions.push(sql`UPPER(TRIM(${eventos.liberado})) = ${String(liberado).trim().toUpperCase()}`);
    }
    if (minDate) {
      whereConditions.push(sql`COALESCE(${eventos.data_evento}, '') >= ${minDate}`);
    }
    if (city && city !== 'Todas' && city !== 'Cidades') {
      whereConditions.push(sql`TRIM(${eventos.cidade}) = ${String(city).trim()}`);
    }
    if (catClean) {
      const targetCat = normalizeText(catClean);
      const pgNormCat = sql`translate(LOWER(TRIM(${eventos.categoria})), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')`;
      if (targetCat === 'bailes' || targetCat === 'baile') {
        whereConditions.push(sql`${pgNormCat} IN ('baile', 'bailes')`);
      } else if (targetCat === 'show' || targetCat === 'shows') {
        whereConditions.push(sql`${pgNormCat} IN ('show', 'shows')`);
      } else {
        whereConditions.push(sql`${pgNormCat} = ${targetCat}`);
      }
    }

    const baseQuery = includeBase64
      ? db
          .select({
            evt: eventos,
            catNome: categorias.nome,
            catDesc: categorias.descricao,
            catAtiva: categorias.ativa,
            advNome: anunciantes.nome,
            advEmail: anunciantes.email,
            advTel: anunciantes.telefone,
            advVerif: anunciantes.verificado,
            estNome: estado.nome,
            estUf: estado.estado,
            estRegiao: estado.regiao,
          })
          .from(eventos)
          .leftJoin(categorias, eq(eventos.categoria_id, categorias.id))
          .leftJoin(anunciantes, eq(eventos.anunciante_id, anunciantes.id))
          .leftJoin(estado, eq(eventos.estado_id, estado.id))
      : db
          .select({
            evt: {
              id: eventos.id,
              anunciante_id: eventos.anunciante_id,
              categoria_id: eventos.categoria_id,
              categoria: eventos.categoria,
              titulo: eventos.titulo,
              descricao: sql<string | null>`CASE WHEN ${eventos.descricao} LIKE 'data:image/%' OR ${eventos.descricao} LIKE 'data:video/%' THEN '' ELSE ${eventos.descricao} END`,
              data_evento: eventos.data_evento,
              horario: eventos.horario,
              horario_fim: eventos.horario_fim,
              local_nome: eventos.local_nome,
              endereco: eventos.endereco,
              cidade: eventos.cidade,
              estado: eventos.estado,
              estado_id: eventos.estado_id,
              cidade_id: eventos.cidade_id,
              latitude: eventos.latitude,
              longitude: eventos.longitude,
              liberado: eventos.liberado,
              is_gratuito: eventos.is_gratuito,
              preco: eventos.preco,
              detalhes_preco: sql<string | null>`CASE WHEN ${eventos.detalhes_preco} LIKE '%data:image/%' OR ${eventos.detalhes_preco} LIKE '%data:video/%' THEN '' ELSE ${eventos.detalhes_preco} END`,
              imagem_url: sql<string | null>`CASE WHEN ${eventos.imagem_url} LIKE 'data:image/%' THEN '__DATA_IMAGE__' ELSE ${eventos.imagem_url} END`,
              video_url: eventos.video_url,
              url: sql<string | null>`CASE WHEN ${eventos.url} LIKE 'data:image/%' THEN '__DATA_IMAGE__' ELSE ${eventos.url} END`,
              organizador: eventos.organizador,
              contato: sql<string | null>`CASE WHEN ${eventos.contato} LIKE 'data:image/%' OR ${eventos.contato} LIKE 'data:video/%' THEN '' ELSE ${eventos.contato} END`,
              tags: eventos.tags,
              destaque: eventos.destaque,
              status: eventos.status,
              criado_em: eventos.criado_em,
              updated_at: eventos.updated_at,
            },
            catNome: categorias.nome,
            catDesc: categorias.descricao,
            catAtiva: categorias.ativa,
            advNome: anunciantes.nome,
            advEmail: anunciantes.email,
            advTel: anunciantes.telefone,
            advVerif: anunciantes.verificado,
            estNome: estado.nome,
            estUf: estado.estado,
            estRegiao: estado.regiao,
          })
          .from(eventos)
          .leftJoin(categorias, eq(eventos.categoria_id, categorias.id))
          .leftJoin(anunciantes, eq(eventos.anunciante_id, anunciantes.id))
          .leftJoin(estado, eq(eventos.estado_id, estado.id));

    const allRows =
      whereConditions.length > 0 ? await baseQuery.where(and(...whereConditions)) : await baseQuery;

    const mediaFileSet = await listMediaFilenamesPg();

    let estadoFilter: { ufVal: string; nomeVal: string; isNumericId: boolean; rawId: number } | null = null;
    const estadoParam = estadoQ || state;
    if (estadoParam && estadoParam !== 'Todos' && estadoParam !== 'Todas') {
      const resolved = await resolveEstadoOrCidade(String(estadoParam));
      estadoFilter = {
        ...resolved,
        rawId: resolved.isNumericId ? parseInt(String(estadoParam), 10) : 0,
      };
    }

    const searchVariants = search
      ? Array.from(
          new Set([
            String(search).trim().toLowerCase(),
            String(search)
              .trim()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase(),
          ])
        ).filter(Boolean)
      : [];

    const filteredRows = allRows.filter(({ evt, estNome }) => {
      if (catClean) {
        const evtCat = normalizeText(evt.categoria);
        const targetCat = normalizeText(catClean);
        if (targetCat === 'bailes' || targetCat === 'baile') {
          if (evtCat !== 'baile' && evtCat !== 'bailes') {
            return false;
          }
        } else if (
          evtCat !== targetCat &&
          !(
            (evtCat === 'show' || evtCat === 'shows') &&
            (targetCat === 'show' || targetCat === 'shows')
          )
        ) {
          return false;
        }
      }

      if (city && city !== 'Todas' && city !== 'Cidades') {
        if ((evt.cidade || '').trim() !== String(city).trim()) return false;
      }

      if (estadoFilter) {
        const { ufVal, nomeVal, isNumericId, rawId } = estadoFilter;
        const evtEst = (evt.estado || '').trim().toLowerCase();
        const evtCid = (evt.cidade || '').trim().toLowerCase();
        const joinEstNome = (estNome || '').trim().toLowerCase();
        const ufLow = ufVal.toLowerCase();
        const nomLow = nomeVal.toLowerCase();

        if (isNumericId) {
          const matchNum = evt.estado_id === rawId || evt.cidade_id === rawId;
          const matchUfNome = ufLow && nomLow && evtEst === ufLow && (evtCid === nomLow || joinEstNome === nomLow);
          const matchUf = ufLow && !nomLow && (evtEst === ufLow || joinEstNome === ufLow);
          if (!matchNum && !matchUfNome && !matchUf) return false;
        } else if (ufLow && nomLow) {
          if (!(evtEst === ufLow && (evtCid === nomLow || joinEstNome === nomLow))) return false;
        } else if (ufLow) {
          if (evtEst !== ufLow && joinEstNome !== ufLow) return false;
        } else if (nomLow) {
          if (evtCid !== nomLow && joinEstNome !== nomLow) return false;
        }
      }

      if (searchVariants.length > 0) {
        const haystack = normalizeText(
          `${evt.titulo} ${evt.descricao} ${evt.local_nome} ${evt.endereco} ${evt.cidade} ${evt.categoria} ${evt.organizador}`
        );
        if (!searchVariants.some((v) => haystack.includes(v))) return false;
      }

      if (status && evt.status !== status) return false;
      if (liberado && (evt.liberado || '').toUpperCase() !== String(liberado).toUpperCase()) {
        return false;
      }

      if (requireMedia) {
        const img = (evt.imagem_url || '').trim();
        const vid = (evt.video_url || '').trim();
        const urlVal = (evt.url || '').trim();
        const okImg =
          img &&
          img !== 'null' &&
          img !== 'undefined' &&
          (img === '__DATA_IMAGE__' ||
            img.startsWith('/api/event-poster/') ||
            img.startsWith('http://') ||
            img.startsWith('https://') ||
            img.startsWith('data:image/') ||
            img.startsWith('/uploads/') ||
            img.startsWith('./uploads/') ||
            img.startsWith('/assets/'));
        const okVid = vid && vid !== '[video_local_sqlite]';
        const okUrl =
          urlVal &&
          urlVal !== '[video_local_sqlite]' &&
          (urlVal === '__DATA_IMAGE__' || !/^http/i.test(urlVal));
        if (!okImg && !okVid && !okUrl) return false;
      }

      if (minDate && (evt.data_evento || '') < minDate) {
        return false;
      }

      return true;
    });

    const rawUserLat = user_lat ?? lat;
    const rawUserLng = user_lng ?? lng;
    const userLat = rawUserLat !== undefined && rawUserLat !== '' ? parseFloat(String(rawUserLat)) : undefined;
    const userLng = rawUserLng !== undefined && rawUserLng !== '' ? parseFloat(String(rawUserLng)) : undefined;
    const hasValidUserCoords =
      userLat !== undefined && userLng !== undefined && !isNaN(userLat) && !isNaN(userLng);
    const isProximityRequested =
      (mais_proximos === 'true' || order_by === 'proximidade') && hasValidUserCoords;

    const mapped = filteredRows.map(({ evt, catNome, catDesc, advNome, advEmail, advTel, advVerif, estNome, estRegiao }) => {
      let latVal = evt.latitude;
      let lngVal = evt.longitude;
      if ((!latVal || !lngVal) && evt.cidade) {
        const cityCoord = BRAZIL_CITY_COORDINATES[normalizeCityKey(evt.cidade)];
        if (cityCoord) {
          latVal = cityCoord.latitude;
          lngVal = cityCoord.longitude;
        }
      }

      let distanceKm: number | undefined = undefined;
      if (hasValidUserCoords && latVal && lngVal) {
        const evLat = parseFloat(String(latVal));
        const evLng = parseFloat(String(lngVal));
        if (!isNaN(evLat) && !isNaN(evLng)) {
          distanceKm = calculateDistanceKm(userLat!, userLng!, evLat, evLng);
        }
      }

      let rawVideoUrl = String(evt.video_url || '').trim();
      let rawUrl = String(evt.url || '').trim();
      if (rawVideoUrl === '[video_local_sqlite]') rawVideoUrl = '';
      if (rawUrl === '[video_local_sqlite]') rawUrl = '';

      if (rawVideoUrl && (rawVideoUrl.startsWith('/uploads/') || rawVideoUrl.startsWith('/assets/') || rawVideoUrl.startsWith('/api/video/'))) {
        if (!checkLocalVideoFileExists(rawVideoUrl, mediaFileSet)) rawVideoUrl = '';
      }
      if (rawUrl && (rawUrl.startsWith('/uploads/') || rawUrl.startsWith('/assets/') || rawUrl.startsWith('/api/video/'))) {
        if (!checkLocalVideoFileExists(rawUrl, mediaFileSet)) rawUrl = '';
      }

      const isUrlVideo = Boolean(
        rawUrl &&
          (rawUrl.startsWith('data:video/') ||
            rawUrl.startsWith('data:application/octet-stream') ||
            rawUrl.startsWith('blob:') ||
            /\.(mp4|webm|ogg|mov|m4v)($|\?|#)/i.test(rawUrl) ||
            /video\/mp4/i.test(rawUrl) ||
            rawUrl.includes('youtube.com') ||
            rawUrl.includes('youtu.be') ||
            rawUrl.includes('facebook.com') ||
            rawUrl.includes('fb.watch') ||
            rawUrl.includes('fb.') ||
            rawUrl.includes('instagram.com') ||
            rawUrl.includes('tiktok.com') ||
            rawUrl.includes('vimeo.com'))
      );

      const resolvedVideoUrl = rawVideoUrl || (isUrlVideo ? rawUrl : undefined);
      const finalVideoUrl =
        resolvedVideoUrl && resolvedVideoUrl !== 'null' && resolvedVideoUrl !== '[video_local_sqlite]'
          ? resolvedVideoUrl
          : null;

      const rawImgUrl = String(evt.imagem_url || '').trim();
      const hasInlineDataImage = rawImgUrl === '__DATA_IMAGE__' || rawUrl === '__DATA_IMAGE__';
      let finalImageUrl =
        rawImgUrl && rawImgUrl !== 'null' && rawImgUrl !== 'undefined' && rawImgUrl !== '__DATA_IMAGE__'
          ? rawImgUrl
          : '';

      if (
        !hasInlineDataImage &&
        (!finalImageUrl || finalImageUrl.includes('images.unsplash.com/photo-1514525253161-7a46d19cd819'))
      ) {
        for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg']) {
          const candidatePath = `/uploads/images/${evt.id}.${ext}`;
          if (
            fs.existsSync(path.join(process.cwd(), candidatePath)) ||
            fs.existsSync(path.join(process.cwd(), 'public', candidatePath))
          ) {
            finalImageUrl = candidatePath;
            break;
          }
        }
      }

      if (!includeBase64) {
        const isLocalHostedImage =
          hasInlineDataImage ||
          (finalImageUrl &&
            (finalImageUrl.startsWith('data:image/') ||
              finalImageUrl.startsWith('/uploads/') ||
              finalImageUrl.startsWith('./uploads/')));
        if (isLocalHostedImage) {
          const ver = evt.updated_at ? new Date(evt.updated_at).getTime() : '';
          finalImageUrl = `/api/event-poster/${encodeURIComponent(evt.id)}${ver ? `?v=${ver}` : ''}`;
        }
      } else if (finalImageUrl && (finalImageUrl.startsWith('/uploads/') || finalImageUrl.startsWith('./uploads/'))) {
        try {
          const filename = path.basename(finalImageUrl.split('?')[0]);
          const candidates = [
            path.join(process.cwd(), 'public', 'uploads', 'images', filename),
            path.join(process.cwd(), 'uploads', 'images', filename),
            path.join('/tmp', 'uploads', 'images', filename),
          ];
          for (const cand of candidates) {
            if (fs.existsSync(cand)) {
              const fileBuf = fs.readFileSync(cand);
              const ext = path.extname(cand).toLowerCase().replace('.', '') || 'jpeg';
              const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
              finalImageUrl = `data:${mime};base64,${fileBuf.toString('base64')}`;
              break;
            }
          }
        } catch {
          // keep original path
        }
      }

      return {
        id: evt.id,
        title: evt.titulo,
        description: evt.descricao || '',
        category: evt.categoria,
        categoryId: evt.categoria_id ?? undefined,
        categoryOfficialName: catNome || evt.categoria,
        categoryDescription: catDesc || undefined,
        advertiserId: evt.anunciante_id || undefined,
        advertiserName: advNome || undefined,
        advertiserEmail: advEmail || undefined,
        advertiserPhone: advTel || undefined,
        advertiserVerified: Boolean(advVerif),
        estadoId: evt.estado_id ?? undefined,
        estadoNomeCompleto: estNome || undefined,
        regiao: estRegiao || undefined,
        date: evt.data_evento,
        time: evt.horario,
        endDate: evt.data_evento,
        endTime: evt.horario_fim || undefined,
        locationName: evt.local_nome,
        address: evt.endereco || '',
        city: evt.cidade,
        state: evt.estado,
        stateName: estNome || evt.estado,
        latitude: latVal || undefined,
        longitude: lngVal || undefined,
        distanceKm,
        liberado: evt.liberado || 'N',
        isFree: Boolean(evt.is_gratuito),
        price: evt.preco ?? undefined,
        priceDetails: evt.detalhes_preco || undefined,
        imageUrl: finalImageUrl,
        imagem_url: finalImageUrl || null,
        mediaType: finalVideoUrl ? ('video' as const) : ('image' as const),
        videoUrl: finalVideoUrl,
        video_url: finalVideoUrl,
        video_utl: finalVideoUrl,
        url: finalVideoUrl || finalImageUrl || undefined,
        Url: finalVideoUrl || finalImageUrl || undefined,
        organizer: evt.organizador || '',
        contact: evt.contato && !evt.contato.startsWith('data:') ? evt.contato : undefined,
        tags: (() => {
          if (!evt.tags) return [];
          const trimmed = evt.tags.trim();
          if (!trimmed) return [];
          try {
            const parsed = JSON.parse(trimmed);
            return Array.isArray(parsed) ? parsed : [String(parsed)];
          } catch {
            return trimmed.includes(',')
              ? trimmed.split(',').map((s: string) => s.trim()).filter(Boolean)
              : [trimmed];
          }
        })(),
        featured: Boolean(evt.destaque),
        status: evt.status || 'em_analise',
        createdAt: evt.criado_em || '',
      };
    });

    const seenEventKeys = new Set<string>();
    const uniqueEvents: typeof mapped = [];

    for (const ev of mapped) {
      if (!isAdmin) {
        const hasImg = hasRealImageFile(ev.imageUrl) || hasRealImageFile(ev.imagem_url);
        const hasVid = Boolean(ev.videoUrl && ev.videoUrl !== '[video_local_sqlite]');
        if (!hasImg && !hasVid) continue;
      } else if ((has_image === 'true' || com_imagem === 'true') && !isValidImageUrl(ev.imageUrl) && !ev.videoUrl && !ev.url) {
        continue;
      }

      const idKey = (ev.id || '').trim().toLowerCase();
      const normTitle = normalizeText(ev.title).replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ');
      const dateKey = (ev.date || '').split('T')[0].trim();
      const normCity = normalizeText(ev.city);
      const semanticKey = `${normTitle}__${dateKey}__${normCity}`;
      const titleDateKey = `${normTitle}__${dateKey}`;

      if (idKey && seenEventKeys.has(`id:${idKey}`)) continue;
      if (normTitle && dateKey && (seenEventKeys.has(`sem:${semanticKey}`) || seenEventKeys.has(`td:${titleDateKey}`))) {
        continue;
      }

      if (idKey) seenEventKeys.add(`id:${idKey}`);
      if (normTitle && dateKey) {
        seenEventKeys.add(`sem:${semanticKey}`);
        seenEventKeys.add(`td:${titleDateKey}`);
      }
      uniqueEvents.push(ev);
    }

    const isAdminOrRecents = order_by === 'criado_em' || order_by === 'recentes' || isAdmin;
    if (isAdminOrRecents) {
      uniqueEvents.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA && timeB && timeA !== timeB) return timeB - timeA;
        const numA = parseInt((a.id || '').replace(/\D/g, ''), 10) || 0;
        const numB = parseInt((b.id || '').replace(/\D/g, ''), 10) || 0;
        return numB - numA;
      });
    } else {
      uniqueEvents.sort((a, b) => {
        if (!hasCategoryFilter) {
          const cmpCat = (a.category || '').localeCompare(b.category || '', 'pt-BR');
          if (cmpCat !== 0) return cmpCat;
        }
        const cmpDate = (a.date || '').localeCompare(b.date || '');
        if (cmpDate !== 0) return cmpDate;
        if (isProximityRequested || hasValidUserCoords) {
          const distA = typeof a.distanceKm === 'number' ? a.distanceKm : 999999;
          const distB = typeof b.distanceKm === 'number' ? b.distanceKm : 999999;
          if (distA !== distB) return distA - distB;
        }
        const cmpCity = (a.city || '').localeCompare(b.city || '', 'pt-BR');
        if (cmpCity !== 0) return cmpCity;
        const cmpTime = (a.time || '').localeCompare(b.time || '');
        if (cmpTime !== 0) return cmpTime;
        return (a.id || '').localeCompare(b.id || '');
      });
    }

    const hasDateQuery = Boolean(date || data_min || data_atual === 'true' || somente_futuros === 'true');
    const rawLimit = limit ? parseInt(String(limit), 10) : undefined;
    const limitCount = rawLimit !== undefined && !isNaN(rawLimit) ? rawLimit : hasDateQuery || isProximityRequested ? 20 : undefined;
    const finalLimit = isAdmin && !limit ? undefined : limitCount && limitCount > 0 ? limitCount : 20;

    return finalLimit ? uniqueEvents.slice(0, finalLimit) : uniqueEvents;
  } catch (error) {
    console.error('Database query failed in listEventsPg:', error);
    throw new Error('Falha ao consultar eventos no banco de dados.', { cause: error });
  }
}

export async function upsertEventPg(data: {
  id: string;
  anunciante_id?: string | null;
  categoria_id?: number | null;
  categoria: string;
  titulo: string;
  descricao?: string;
  data_evento: string;
  horario: string;
  horario_fim?: string | null;
  local_nome: string;
  endereco?: string;
  cidade: string;
  estado: string;
  estado_id?: number | null;
  cidade_id?: number | null;
  latitude?: string | null;
  longitude?: string | null;
  liberado?: string;
  is_gratuito?: number;
  preco?: number;
  detalhes_preco?: string;
  imagem_url?: string | null;
  video_url?: string | null;
  url?: string | null;
  organizador?: string;
  contato?: string;
  tags?: string;
  destaque?: number;
  status?: string;
  criado_em?: string;
}) {
  try {
    const estId = data.estado_id ?? (await getEstadoIdByText(data.estado, data.cidade));

    let finalImg = data.imagem_url ?? null;
    if (finalImg && (finalImg.startsWith('/api/event-poster/') || finalImg === '__DATA_IMAGE__')) {
      finalImg = null;
    }
    if (!finalImg || !finalImg.startsWith('data:image/')) {
      const existing = await db
        .select({ imagem_url: eventos.imagem_url, url: eventos.url })
        .from(eventos)
        .where(eq(eventos.id, data.id))
        .limit(1);
      if (existing[0]?.imagem_url?.startsWith('data:image/')) {
        finalImg = existing[0].imagem_url;
      } else if (existing[0]?.url?.startsWith('data:image/')) {
        finalImg = existing[0].url;
      } else if (!finalImg && existing[0]?.imagem_url) {
        finalImg = existing[0].imagem_url;
      }
    }
    const safeUrl =
      data.url && !data.url.startsWith('/api/event-poster/') && data.url !== '__DATA_IMAGE__'
        ? data.url
        : finalImg || null;

    await db
      .insert(eventos)
      .values({
        id: data.id,
        anunciante_id: data.anunciante_id || null,
        categoria_id: data.categoria_id || null,
        categoria: data.categoria || 'Shows',
        titulo: data.titulo || 'Evento',
        descricao: data.descricao || '',
        data_evento: data.data_evento,
        horario: data.horario || '19:00',
        horario_fim: data.horario_fim || null,
        local_nome: data.local_nome || 'Local a definir',
        endereco: data.endereco || '',
        cidade: data.cidade || 'São Paulo',
        estado: data.estado || 'SP',
        estado_id: estId,
        cidade_id: data.cidade_id || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        liberado: (data.liberado || 'N').slice(0, 1).toUpperCase(),
        is_gratuito: data.is_gratuito ?? 0,
        preco: data.preco ?? 0,
        detalhes_preco: data.detalhes_preco || '',
        imagem_url: finalImg,
        video_url: data.video_url || null,
        url: safeUrl,
        organizador: data.organizador || '',
        contato: data.contato || '',
        tags: data.tags || '[]',
        destaque: data.destaque ?? 0,
        status: data.status || 'em_analise',
        criado_em: data.criado_em || new Date().toISOString(),
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: eventos.id,
        set: {
          anunciante_id: data.anunciante_id || null,
          categoria_id: data.categoria_id || null,
          categoria: data.categoria || 'Shows',
          titulo: data.titulo || 'Evento',
          descricao: data.descricao || '',
          data_evento: data.data_evento,
          horario: data.horario || '19:00',
          horario_fim: data.horario_fim || null,
          local_nome: data.local_nome || 'Local a definir',
          endereco: data.endereco || '',
          cidade: data.cidade || 'São Paulo',
          estado: data.estado || 'SP',
          estado_id: estId,
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          liberado: (data.liberado || 'N').slice(0, 1).toUpperCase(),
          is_gratuito: data.is_gratuito ?? 0,
          preco: data.preco ?? 0,
          detalhes_preco: data.detalhes_preco || '',
          imagem_url: finalImg,
          video_url: data.video_url || null,
          url: safeUrl,
          organizador: data.organizador || '',
          contato: data.contato || '',
          tags: data.tags || '[]',
          destaque: data.destaque ?? 0,
          status: data.status || 'em_analise',
          updated_at: new Date(),
        },
      });
  } catch (error) {
    console.error('Database query failed in upsertEventPg:', error);
    throw new Error('Falha ao salvar evento no banco de dados.', { cause: error });
  }
}

export async function approveEventRecordPg(
  id: string,
  overrides?: {
    category?: string;
    categoryId?: number | null;
    videoUrl?: string | null;
    url?: string | null;
    imageUrl?: string | null;
    urlType?: string | null;
  },
  geocodeFn?: (addr?: string, city?: string, state?: string, loc?: string) => Promise<{ latitude: string; longitude: string } | null>
) {
  try {
    let item: any = null;
    const qRows = await db.select().from(eventosImportados).where(eq(eventosImportados.id, id)).limit(1);
    if (qRows[0]) item = qRows[0];
    if (!item) {
      const eRows = await db.select().from(eventos).where(eq(eventos.id, id)).limit(1);
      if (eRows[0]) item = eRows[0];
    }
    if (!item) return null;

    const catResolved = await resolveCategoryRecord(
      overrides?.category || item.categoria || 'Shows',
      overrides?.categoryId !== undefined ? overrides.categoryId : item.categoria_id,
      true
    );

    let latitude = item.latitude;
    let longitude = item.longitude;
    if ((!latitude || !longitude) && geocodeFn && (item.endereco || item.cidade || item.local_nome)) {
      try {
        const geo = await geocodeFn(item.endereco, item.cidade, item.estado, item.local_nome);
        if (geo) {
          latitude = geo.latitude;
          longitude = geo.longitude;
        }
      } catch {
        // Fallback later
      }
    }

    const candidateVideos = [
      overrides?.videoUrl,
      overrides?.urlType === 'video' ? overrides?.url : null,
      overrides?.url && isCleanVideo(overrides.url) ? overrides.url : null,
      item.video_url,
      item.url && isCleanVideo(item.url) ? item.url : null,
    ];
    const finalVideoUrl = candidateVideos.find((v) => isCleanVideo(v)) || null;

    let finalImageUrl = isCleanImage(overrides?.imageUrl)
      ? overrides!.imageUrl!.trim()
      : isCleanImage(item.imagem_url)
        ? item.imagem_url.trim()
        : '';

    if (!finalImageUrl && finalVideoUrl) {
      finalImageUrl = autoExtractPosterFromVideo(id, finalVideoUrl);
    }

    const finalUrl =
      finalVideoUrl ||
      (overrides?.url && !overrides.url.startsWith('data:image/')
        ? overrides.url
        : item.url || finalImageUrl || null);

    const rawContactVal = item.link_ingressos || item.contato || '';
    const cleanContactVal = rawContactVal.startsWith('data:image/') ? '' : rawContactVal;

    await upsertEventPg({
      id,
      anunciante_id: item.anunciante_id || null,
      categoria_id: catResolved.id,
      categoria: catResolved.nome,
      titulo: item.titulo || 'Evento',
      descricao: item.descricao || '',
      data_evento: item.data_evento,
      horario: item.horario || '19:00',
      horario_fim: item.horario_fim || null,
      local_nome: item.local_nome || '',
      endereco: item.endereco || '',
      cidade: item.cidade || '',
      estado: item.estado || 'SP',
      latitude: latitude || null,
      longitude: longitude || null,
      liberado: 'S',
      is_gratuito: item.is_gratuito === 1 ? 1 : 0,
      preco: item.preco ?? 0,
      detalhes_preco: item.detalhes_preco || (item.link_ingressos && !item.link_ingressos.startsWith('data:image/') ? `Ingressos: ${item.link_ingressos}` : ''),
      imagem_url: finalImageUrl,
      video_url: finalVideoUrl,
      url: finalUrl,
      organizador: item.organizador || '',
      contato: cleanContactVal,
      tags: JSON.stringify(['Aprovado', catResolved.nome]),
      destaque: item.destaque ?? 0,
      status: 'aprovado',
      criado_em: item.criado_em || new Date().toISOString(),
    });

    await db.delete(eventosImportados).where(eq(eventosImportados.id, id));

    return {
      id,
      title: item.titulo,
      description: item.descricao || '',
      category: catResolved.nome,
      categoryId: catResolved.id ?? undefined,
      date: item.data_evento,
      time: item.horario,
      endDate: item.data_evento,
      endTime: item.horario_fim || undefined,
      locationName: item.local_nome,
      address: item.endereco,
      city: item.cidade,
      state: item.estado,
      latitude: latitude || undefined,
      longitude: longitude || undefined,
      imageUrl: finalImageUrl,
      videoUrl: finalVideoUrl || undefined,
      url: finalUrl || undefined,
      mediaType: finalVideoUrl ? ('video' as const) : ('image' as const),
      organizer: item.organizador,
      contact: cleanContactVal,
      price: item.preco,
      priceDetails: item.detalhes_preco || '',
      tags: [catResolved.nome],
      liberado: 'S' as const,
      isFree: item.is_gratuito === 1,
      status: 'aprovado',
      createdAt: item.criado_em || new Date().toISOString(),
    };
  } catch (error) {
    console.error('Database query failed in approveEventRecordPg:', error);
    throw new Error('Falha ao aprovar e liberar evento.', { cause: error });
  }
}

export async function liberateAllEventsPg(category?: string) {
  try {
    let totalUpdated = 0;
    if (category && category !== 'Todas') {
      const updated = await db
        .update(eventos)
        .set({ liberado: 'S', status: 'aprovado', updated_at: new Date() })
        .where(sql`LOWER(TRIM(${eventos.categoria})) = LOWER(TRIM(${category}))`)
        .returning({ id: eventos.id });
      totalUpdated = updated.length;
    } else {
      const updated = await db
        .update(eventos)
        .set({ liberado: 'S', status: 'aprovado', updated_at: new Date() })
        .returning({ id: eventos.id });
      totalUpdated = updated.length;
    }

    const quarRows =
      category && category !== 'Todas'
        ? await db
            .select()
            .from(eventosImportados)
            .where(sql`LOWER(TRIM(${eventosImportados.categoria})) = LOWER(TRIM(${category}))`)
        : await db.select().from(eventosImportados);

    let promotedFromQuarantine = 0;
    for (const item of quarRows) {
      await approveEventRecordPg(item.id);
      promotedFromQuarantine++;
    }

    await db.delete(eventosImportados);

    return { totalUpdated, promotedFromQuarantine };
  } catch (error) {
    console.error('Database query failed in liberateAllEventsPg:', error);
    throw new Error('Falha ao liberar todos os eventos.', { cause: error });
  }
}

export async function setEventLiberadoNPg(id: string, status = 'em_analise') {
  try {
    await db
      .update(eventos)
      .set({ liberado: 'N', status, updated_at: new Date() })
      .where(eq(eventos.id, id));
  } catch (error) {
    console.error('Database query failed in setEventLiberadoNPg:', error);
    throw new Error('Falha ao pausar evento.', { cause: error });
  }
}

export async function updateEventCategoryPg(id: string, cleanCat: string, categoryId?: number) {
  try {
    const resolved = await resolveCategoryRecord(cleanCat, categoryId, false);
    const quarRows = await db
      .select()
      .from(eventosImportados)
      .where(eq(eventosImportados.id, id))
      .limit(1);

    if (quarRows[0]) {
      await db
        .update(eventosImportados)
        .set({ categoria: resolved.nome, categoria_id: resolved.id })
        .where(eq(eventosImportados.id, id));
      await db
        .update(eventos)
        .set({ categoria: resolved.nome, categoria_id: resolved.id, updated_at: new Date() })
        .where(eq(eventos.id, id));
      return { found: true, isQuarantine: true, category: resolved.nome };
    }

    const updated = await db
      .update(eventos)
      .set({ categoria: resolved.nome, categoria_id: resolved.id, updated_at: new Date() })
      .where(eq(eventos.id, id))
      .returning({ id: eventos.id });

    return {
      found: updated.length > 0,
      isQuarantine: false,
      category: resolved.nome,
    };
  } catch (error) {
    console.error('Database query failed in updateEventCategoryPg:', error);
    throw new Error('Falha ao atualizar categoria do evento.', { cause: error });
  }
}

export async function updateEventUrlPg(
  id: string,
  targetUrl: string,
  urlType?: string,
  imageUrl?: string | null
) {
  try {
    const cleanTarget = targetUrl.trim();
    const isPosterRef = cleanTarget.startsWith('/api/event-poster/') || cleanTarget === '__DATA_IMAGE__';
    const isVid = urlType === 'video' || isCleanVideo(cleanTarget);
    const isImg = !isPosterRef && (urlType === 'image' || isCleanImage(cleanTarget));

    const patch: Record<string, any> = {
      updated_at: new Date(),
    };
    if (!isPosterRef) {
      patch.url = cleanTarget;
    }
    if (isVid) patch.video_url = cleanTarget;
    if (imageUrl && !imageUrl.startsWith('/api/event-poster/') && imageUrl !== '__DATA_IMAGE__' && isCleanImage(imageUrl)) {
      patch.imagem_url = imageUrl;
    } else if (isImg && !isVid) {
      patch.imagem_url = cleanTarget;
    }

    const updatedEvents = await db.update(eventos).set(patch).where(eq(eventos.id, id)).returning();
    const impPatch: Record<string, any> = {};
    if (!isPosterRef) impPatch.url = cleanTarget;
    if (isVid) impPatch.video_url = cleanTarget;
    if (patch.imagem_url) impPatch.imagem_url = patch.imagem_url;
    const updatedImp =
      Object.keys(impPatch).length > 0
        ? await db.update(eventosImportados).set(impPatch).where(eq(eventosImportados.id, id)).returning()
        : [];

    const updatedTables: string[] = [];
    if (updatedEvents.length > 0) updatedTables.push('eventos');
    if (updatedImp.length > 0) updatedTables.push('eventos_importados');

    return {
      id,
      url: targetUrl,
      videoUrl: isVid ? targetUrl : null,
      imageUrl: patch.imagem_url || null,
      updatedTables,
    };
  } catch (error) {
    console.error('Database query failed in updateEventUrlPg:', error);
    throw new Error('Falha ao atualizar URL/mídia do evento.', { cause: error });
  }
}

export async function deleteAllEventsPg() {
  try {
    const favDeleted = await db.delete(favoritos).returning();
    const evtDeleted = await db
      .delete(eventos)
      .returning({ id: eventos.id, video_url: eventos.video_url, url: eventos.url });
    for (const row of evtDeleted) {
      await db
        .insert(registroEventosDeletados)
        .values({ id: row.id, deletado_em: new Date().toISOString() })
        .onConflictDoNothing();
    }
    await deleteMediaFilesIfUnusedPg(evtDeleted.flatMap((r) => [r.video_url, r.url]));
    return { changes: evtDeleted.length, favoritesDeleted: favDeleted.length };
  } catch (error) {
    console.error('Database query failed in deleteAllEventsPg:', error);
    throw new Error('Falha ao excluir todos os eventos.', { cause: error });
  }
}

export async function deleteEventsBatchPg(options: {
  ids?: string[];
  scope?: string;
  category?: string;
}) {
  try {
    const { ids, scope, category } = options;
    let deletedIds: string[] = [];
    const candidateMediaUrls: Array<string | null | undefined> = [];

    if (Array.isArray(ids) && ids.length > 0) {
      await db.delete(favoritos).where(inArray(favoritos.evento_id, ids));
      const delEvts = await db
        .delete(eventos)
        .where(inArray(eventos.id, ids))
        .returning({ id: eventos.id, video_url: eventos.video_url, url: eventos.url });
      const delImp = await db
        .delete(eventosImportados)
        .where(inArray(eventosImportados.id, ids))
        .returning({ id: eventosImportados.id, video_url: eventosImportados.video_url, url: eventosImportados.url });
      deletedIds = Array.from(new Set([...ids, ...delEvts.map((r) => r.id), ...delImp.map((r) => r.id)]));
      candidateMediaUrls.push(
        ...delEvts.flatMap((r) => [r.video_url, r.url]),
        ...delImp.flatMap((r) => [r.video_url, r.url])
      );
    } else if (scope === 'pending') {
      const cond = category
        ? and(eq(eventos.liberado, 'N'), sql`LOWER(TRIM(${eventos.categoria})) = LOWER(TRIM(${category}))`)
        : eq(eventos.liberado, 'N');
      const delEvts = await db
        .delete(eventos)
        .where(cond)
        .returning({ id: eventos.id, video_url: eventos.video_url, url: eventos.url });
      deletedIds = delEvts.map((r) => r.id);
      candidateMediaUrls.push(...delEvts.flatMap((r) => [r.video_url, r.url]));
      if (deletedIds.length > 0) {
        await db.delete(favoritos).where(inArray(favoritos.evento_id, deletedIds));
      }
    } else if (scope === 'all') {
      await db.delete(favoritos);
      const delEvts = await db
        .delete(eventos)
        .returning({ id: eventos.id, video_url: eventos.video_url, url: eventos.url });
      deletedIds = delEvts.map((r) => r.id);
      candidateMediaUrls.push(...delEvts.flatMap((r) => [r.video_url, r.url]));
    }

    for (const delId of deletedIds) {
      await db
        .insert(registroEventosDeletados)
        .values({ id: delId, deletado_em: new Date().toISOString() })
        .onConflictDoNothing();
    }

    await deleteMediaFilesIfUnusedPg(candidateMediaUrls);

    return deletedIds.length;
  } catch (error) {
    console.error('Database query failed in deleteEventsBatchPg:', error);
    throw new Error('Falha ao excluir eventos em lote.', { cause: error });
  }
}

export async function deleteEventByIdPg(id: string) {
  try {
    await db.delete(favoritos).where(eq(favoritos.evento_id, id));
    const delEvt = await db
      .delete(eventos)
      .where(eq(eventos.id, id))
      .returning({ id: eventos.id, video_url: eventos.video_url, url: eventos.url });
    const delImp = await db
      .delete(eventosImportados)
      .where(eq(eventosImportados.id, id))
      .returning({ id: eventosImportados.id, video_url: eventosImportados.video_url, url: eventosImportados.url });

    await db
      .insert(registroEventosDeletados)
      .values({ id, deletado_em: new Date().toISOString() })
      .onConflictDoNothing();

    await deleteMediaFilesIfUnusedPg([
      ...delEvt.flatMap((r) => [r.video_url, r.url]),
      ...delImp.flatMap((r) => [r.video_url, r.url]),
    ]);

    return delEvt.length + delImp.length;
  } catch (error) {
    console.error('Database query failed in deleteEventByIdPg:', error);
    throw new Error('Falha ao excluir evento.', { cause: error });
  }
}

export async function getDeletedEventIdsPg(): Promise<string[]> {
  try {
    const rows = await db.select({ id: registroEventosDeletados.id }).from(registroEventosDeletados);
    return rows.map((r) => r.id);
  } catch {
    return [];
  }
}

export async function syncEventsRelationsPg() {
  try {
    const allCats = await db.select().from(categorias);
    const allEstados = await db.select().from(estado);
    const allEvts = await db.select().from(eventos);
    let updated = 0;

    for (const ev of allEvts) {
      let patch: Record<string, any> | null = null;
      if (!ev.categoria_id && ev.categoria) {
        const cMatch = allCats.find(
          (c) => c.nome.toLowerCase().trim() === ev.categoria.toLowerCase().trim()
        );
        if (cMatch) {
          patch = { ...(patch || {}), categoria_id: cMatch.id };
        }
      }
      if (!ev.estado_id && (ev.estado || ev.cidade)) {
        const eMatch = allEstados.find(
          (est) =>
            est.estado.toUpperCase() === (ev.estado || '').toUpperCase().trim() ||
            est.nome.toLowerCase() === (ev.estado || '').toLowerCase().trim()
        );
        if (eMatch) {
          patch = { ...(patch || {}), estado_id: eMatch.id };
        }
      }
      if (patch) {
        await db.update(eventos).set(patch).where(eq(eventos.id, ev.id));
        updated++;
      }
    }

    return {
      totalEventos: allEvts.length,
      eventosAtualizados: updated,
    };
  } catch (error) {
    console.error('Database query failed in syncEventsRelationsPg:', error);
    throw new Error('Falha ao sincronizar relacionamentos dos eventos.', { cause: error });
  }
}
