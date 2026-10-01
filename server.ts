import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  getDatabase,
  executeSqlQuery,
  getDatabaseSchema,
  syncEventsRelations,
  getCategoryTableName,
  ensureCategoryTable,
  ensureAllCategoryTables,
  saveEventToCategoryTable,
  saveUserEvent,
  deleteEventFromCategoryTables,
  deleteEventsFromCategoryTables,
  createEventosTable,
  dropEventosTable,
  rebuildUnifiedEventsView,
  updateEventUrlInAllTables,
} from './server/database.js';
import { createMercadoPagoPixPayment, checkMercadoPagoPaymentStatus } from './server/mercadopago.js';
import { parseSymplaEventUrl } from './server/symplaParser.js';
import { discoverAllRhythmsBatch, searchSymplaLiveEvents, fetchAllSymplaLiveEvents, RhythmBatchItem, normalizeStateToUF } from './server/symplaDiscover.js';
import cron from 'node-cron';

const app = express();
const PORT = 3000;

// Configura limite amplo para suportar uploads de imagens (base64) e cadastros completos
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize SQLite database
const db = getDatabase();

// ==================== REST API ROUTES ====================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: 'SQLite 3 (nativo)',
    file: 'praondeeu.db',
    time: new Date().toISOString(),
  });
});

// Coordenadas padrão de apoio para cidades brasileiras (fallback seguro)
const BRAZIL_CITY_COORDINATES: Record<string, { latitude: string; longitude: string }> = {
  'santo andre': { latitude: '-23.6575', longitude: '-46.5312' },
  'sao paulo': { latitude: '-23.5505', longitude: '-46.6333' },
  'sao bernardo do campo': { latitude: '-23.6944', longitude: '-46.5654' },
  'sao caetano do sul': { latitude: '-23.6229', longitude: '-46.5547' },
  'diadema': { latitude: '-23.6865', longitude: '-46.6234' },
  'maua': { latitude: '-23.6687', longitude: '-46.4614' },
  'ribeirao pires': { latitude: '-23.7142', longitude: '-46.4137' },
  'rio de janeiro': { latitude: '-22.9068', longitude: '-43.1729' },
  'belo horizonte': { latitude: '-19.9167', longitude: '-43.9345' },
  'curitiba': { latitude: '-25.4284', longitude: '-49.2733' },
  'porto alegre': { latitude: '-30.0346', longitude: '-51.2177' },
  'salvador': { latitude: '-12.9777', longitude: '-38.5016' },
  'recife': { latitude: '-8.0476', longitude: '-34.8770' },
  'fortaleza': { latitude: '-3.7172', longitude: '-38.5433' },
  'brasilia': { latitude: '-15.7975', longitude: '-47.8919' },
  'campinas': { latitude: '-22.9099', longitude: '-47.0626' },
  'santos': { latitude: '-23.9608', longitude: '-46.3336' },
  'sorocaba': { latitude: '-23.5015', longitude: '-47.4526' },
  'sao jose dos campos': { latitude: '-23.2237', longitude: '-45.9009' },
  'ribeirao preto': { latitude: '-21.1704', longitude: '-47.8103' },
  'osasco': { latitude: '-23.5329', longitude: '-46.7919' },
  'guarulhos': { latitude: '-23.4542', longitude: '-46.5333' },
  'barueri': { latitude: '-23.5111', longitude: '-46.8764' },
  'cotia': { latitude: '-23.6036', longitude: '-46.9189' },
  'mogi das cruzes': { latitude: '-23.5208', longitude: '-46.1854' },
};

function normalizeCityKey(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// 1. Listar Eventos do SQLite com Alta Performance e Tabelas Dedicadas por Categoria
app.get('/api/events', (req, res) => {
  try {
    const { category, city, estado, state, search, status } = req.query;
    let sql = '';
    const params: any[] = [];

    const hasCategoryFilter = Boolean(category && category !== 'Todos' && category !== 'Todas' && category !== 'Categorias');
    const catClean = hasCategoryFilter ? String(category).trim() : null;
    let categoryTableName: string | null = null;

    if (catClean) {
      const candidateTable = getCategoryTableName(catClean);
      try {
        const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?;").get(candidateTable);
        if (tableExists) {
          categoryTableName = candidateTable;
        } else {
          const resEnsure = ensureCategoryTable(db, catClean);
          categoryTableName = resEnsure.tableName;
        }
      } catch {
        const resEnsure = ensureCategoryTable(db, catClean);
        categoryTableName = resEnsure.tableName;
      }
    }

    if (categoryTableName) {
      // Consulta com índice dedicada diretamente na tabela da categoria selecionada
      sql = `
        SELECT 
          e.*,
          COALESCE(c.nome, e.categoria) AS categoria_oficial_nome,
          c.descricao AS categoria_descricao,
          c.ativa AS categoria_ativa,
          a.nome AS anunciante_nome,
          a.email AS anunciante_email,
          a.telefone AS anunciante_telefone,
          a.verificado AS anunciante_verificado,
          est.nome AS estado_nome_completo,
          est.regiao AS estado_regiao
        FROM ${categoryTableName} e
        LEFT JOIN categorias c ON (
          e.categoria_id = c.id 
          OR LOWER(TRIM(e.categoria)) = LOWER(TRIM(c.nome))
          OR (LOWER(TRIM(e.categoria)) IN ('show', 'shows') AND LOWER(TRIM(c.nome)) IN ('show', 'shows'))
        )
        LEFT JOIN anunciantes a ON e.anunciante_id = a.id
        LEFT JOIN estado est ON (
          e.estado_id = est.id 
          OR UPPER(TRIM(e.estado)) = UPPER(TRIM(est.estado))
          OR UPPER(TRIM(e.estado)) = UPPER(TRIM(est.nome))
          OR UPPER(TRIM(e.cidade)) = UPPER(TRIM(est.nome))
        )
        WHERE 1=1
      `;
    } else {
      // Consulta padrão diretamente na tabela física 'eventos' unificada
      sql = `
        SELECT 
          e.*,
          COALESCE(c.nome, e.categoria) AS categoria_oficial_nome,
          c.descricao AS categoria_descricao,
          c.ativa AS categoria_ativa,
          a.nome AS anunciante_nome,
          a.email AS anunciante_email,
          a.telefone AS anunciante_telefone,
          a.verificado AS anunciante_verificado,
          est.nome AS estado_nome_completo,
          est.regiao AS estado_regiao
        FROM eventos e
        LEFT JOIN categorias c ON (
          e.categoria_id = c.id 
          OR LOWER(TRIM(e.categoria)) = LOWER(TRIM(c.nome))
        )
        LEFT JOIN anunciantes a ON e.anunciante_id = a.id
        LEFT JOIN estado est ON (
          e.estado_id = est.id 
          OR UPPER(TRIM(e.estado)) = UPPER(TRIM(est.estado))
          OR UPPER(TRIM(e.estado)) = UPPER(TRIM(est.nome))
          OR UPPER(TRIM(e.cidade)) = UPPER(TRIM(est.nome))
        )
        WHERE 1=1
      `;
    }
    if (city && city !== 'Todas' && city !== 'Cidades') {
      sql += ' AND e.cidade = ?';
      params.push(String(city));
    }
    // Estado evento igual estado informado
    const estadoParam = estado || state;
    if (estadoParam && estadoParam !== 'Todos' && estadoParam !== 'Todas') {
      let rawVal = String(estadoParam).trim();
      let ufVal = rawVal;
      let nomeVal = '';

      if (/^\d+$/.test(rawVal)) {
        try {
          const estRow = db.prepare('SELECT id, nome, estado FROM estado WHERE id = ?').get(rawVal) as any;
          if (estRow) {
            ufVal = estRow.estado || '';
            nomeVal = estRow.nome || '';
          }
        } catch (e) {
          // ignore
        }
      } else {
        try {
          const estRow = db.prepare('SELECT id, nome, estado FROM estado WHERE UPPER(estado) = ? OR UPPER(nome) = ? LIMIT 1').get(rawVal.toUpperCase(), rawVal.toUpperCase()) as any;
          if (estRow) {
            ufVal = estRow.estado || '';
            nomeVal = estRow.nome || '';
          } else {
            const mappedUf = normalizeStateToUF(rawVal);
            if (mappedUf && mappedUf !== rawVal) {
              nomeVal = rawVal;
              ufVal = mappedUf;
            }
          }
        } catch (e) {
          // ignore
        }
      }

      if (ufVal && nomeVal) {
        sql += ' AND (UPPER(TRIM(e.estado)) = ? OR UPPER(TRIM(e.estado)) = ? OR UPPER(TRIM(est.nome)) = ?)';
        params.push(ufVal.toUpperCase(), nomeVal.toUpperCase(), nomeVal.toUpperCase());
      } else if (ufVal) {
        sql += ' AND (UPPER(TRIM(e.estado)) = ? OR UPPER(TRIM(est.nome)) = ?)';
        params.push(ufVal.toUpperCase(), ufVal.toUpperCase());
      } else if (nomeVal) {
        sql += ' AND (UPPER(TRIM(e.estado)) = ? OR UPPER(TRIM(est.nome)) = ?)';
        params.push(nomeVal.toUpperCase(), nomeVal.toUpperCase());
      }
    }
    if (search) {
      sql += ' AND (e.titulo LIKE ? OR e.descricao LIKE ? OR e.local_nome LIKE ? OR e.categoria LIKE ? OR e.organizador LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }
    if (status) {
      sql += ' AND e.status = ?';
      params.push(status);
    }
    if (req.query.liberado) {
      sql += ' AND UPPER(e.liberado) = ?';
      params.push(String(req.query.liberado).toUpperCase());
    }
    // Filtrar somente eventos com imagem ou com vídeo/url caso solicitado
    if (req.query.has_image === 'true' || req.query.com_imagem === 'true') {
      sql += ` AND (
        (e.imagem_url IS NOT NULL AND (e.imagem_url LIKE 'http://%' OR e.imagem_url LIKE 'https://%' OR e.imagem_url LIKE 'data:image/%'))
        OR (e.video_url IS NOT NULL AND TRIM(e.video_url) != '' AND e.video_url != '[video_local_sqlite]')
        OR (e.url IS NOT NULL AND TRIM(e.url) != '' AND e.url != '[video_local_sqlite]')
      )`;
    }
    // Data evento igual ou maior data informada
    if (req.query.data_min || req.query.date) {
      sql += ' AND e.data_evento >= ?';
      params.push(req.query.data_min || req.query.date);
    } else if (req.query.data_atual === 'true' || req.query.somente_futuros === 'true') {
      const today = new Date().toISOString().split('T')[0];
      sql += ' AND e.data_evento >= ?';
      params.push(today);
    }

    // No índice será categoria, estado, data do evento
    // Nas consultas por data, prioriza data_evento ASC para trazer os eventos imediatamente posteriores ou iguais à data
    const orderBy = req.query.order_by;
    if (orderBy === 'criado_em' || orderBy === 'recentes') {
      sql += ' ORDER BY e.criado_em DESC, e.id DESC';
    } else if (orderBy === 'data' || req.query.date || req.query.data_min || req.query.data_atual === 'true') {
      sql += ' ORDER BY e.data_evento ASC, e.horario ASC, e.id ASC';
    } else if (orderBy === 'id') {
      sql += ' ORDER BY e.id ASC, e.categoria ASC, e.estado ASC, e.data_evento ASC';
    } else {
      sql += ' ORDER BY e.data_evento ASC, e.horario ASC, e.id ASC';
    }

    // Coordenadas do solicitante para cálculo de proximidade geográfica (Haversine)
    const rawUserLat = req.query.user_lat ?? req.query.lat;
    const rawUserLng = req.query.user_lng ?? req.query.lng;
    const userLat = rawUserLat !== undefined && rawUserLat !== '' ? parseFloat(String(rawUserLat)) : undefined;
    const userLng = rawUserLng !== undefined && rawUserLng !== '' ? parseFloat(String(rawUserLng)) : undefined;
    const hasValidUserCoords = userLat !== undefined && userLng !== undefined && !isNaN(userLat) && !isNaN(userLng);
    const isProximityRequested = (req.query.mais_proximos === 'true' || req.query.order_by === 'proximidade') && hasValidUserCoords;

    // Nas consultas, limitar para mostrar 20 eventos após ou igual a data solicitada (ou conforme limite informado)
    const hasDateQuery = Boolean(req.query.date || req.query.data_min || req.query.data_atual === 'true' || req.query.somente_futuros === 'true');
    const rawLimit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const limitCount = rawLimit !== undefined && !isNaN(rawLimit) ? rawLimit : (hasDateQuery || isProximityRequested ? 20 : undefined);

    if (limitCount && limitCount > 0) {
      // Quando ordenado por proximidade do solicitante, busca margem mais ampla para ordenar antes de cortar em 20
      const sqlLimit = isProximityRequested ? 300 : limitCount * 3;
      sql += ` LIMIT ${sqlLimit}`;
    }

    let rows = db.prepare(sql).all(...params) as any[];

    // Fallback: se buscou em tabela de categoria específica e não retornou registros, mas havia termo de busca (search), tenta na tabela geral eventos
    if (rows.length === 0 && categoryTableName && search) {
      try {
        const fallbackSql = sql.replace(new RegExp(`FROM\\s+${categoryTableName}\\s+e`, 'i'), 'FROM eventos e');
        const fallbackRows = db.prepare(fallbackSql).all(...params) as any[];
        if (fallbackRows.length > 0) {
          rows = fallbackRows;
        }
      } catch (fbErr) {
        console.warn('Erro no fallback de busca em eventos:', fbErr);
      }
    }

    // Função para calcular distância Haversine em km entre duas coordenadas
    const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371; // Raio da Terra em km
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
    };

    // Map database snake_case / columns to EventItem format com dados relacionais integrados e distância
    const events = rows.map((r) => {
      let latVal = r.latitude;
      let lngVal = r.longitude;

      // Fallback para coordenadas da cidade se o evento não tiver coordenadas gravadas
      if ((!latVal || !lngVal) && r.cidade) {
        const normCity = normalizeCityKey(r.cidade);
        const cityCoord = BRAZIL_CITY_COORDINATES[normCity];
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

      let rawVideoUrl = String(r.video_url || r.video_utl || r.Video_url || r.videoUrl || '').trim();
      let rawUrl = String(r.url || r.Url || '').trim();

      if (rawVideoUrl === '[video_local_sqlite]') rawVideoUrl = '';
      if (rawUrl === '[video_local_sqlite]') rawUrl = '';

      // Se ainda não tem o vídeo real, tenta recuperar da tabela autônoma eventos
      if (!rawVideoUrl && (!rawUrl || !rawUrl.startsWith('data:video/'))) {
        try {
          const evFallback = db.prepare('SELECT video_url, url FROM eventos WHERE id = ? LIMIT 1;').get(r.id) as any;
          if (evFallback) {
            const fbVid = String(evFallback.video_url || '').trim();
            const fbUrl = String(evFallback.url || '').trim();
            if (fbVid && fbVid !== '[video_local_sqlite]') rawVideoUrl = fbVid;
            else if (fbUrl && fbUrl !== '[video_local_sqlite]' && (fbUrl.startsWith('data:video/') || fbUrl.includes('.mp4'))) rawVideoUrl = fbUrl;
          }
        } catch {}
      }

      const isUrlVideo = Boolean(
        rawUrl && (
          rawUrl.startsWith('data:video/') ||
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
          rawUrl.includes('vimeo.com')
        )
      );
      const isRawVideoUrlVideo = Boolean(rawVideoUrl);
      const resolvedVideoUrl = rawVideoUrl || (isUrlVideo ? rawUrl : undefined);
      const isVideo = Boolean(resolvedVideoUrl || isUrlVideo || isRawVideoUrlVideo);

      return {
        id: r.id,
        title: r.titulo,
        description: r.descricao || '',
        category: r.categoria,
        categoryId: r.categoria_id ?? undefined,
        categoryOfficialName: r.categoria_oficial_nome || r.categoria,
        categoryDescription: r.categoria_descricao || undefined,
        advertiserId: r.anunciante_id || undefined,
        advertiserName: r.anunciante_nome || undefined,
        advertiserEmail: r.anunciante_email || undefined,
        advertiserPhone: r.anunciante_telefone || undefined,
        advertiserVerified: Boolean(r.anunciante_verificado),
        estadoId: r.estado_id ?? undefined,
        estadoNomeCompleto: r.estado_nome_completo || undefined,
        regiao: r.estado_regiao || undefined,
        date: r.data_evento,
        time: r.horario,
        endDate: r.data_evento,
        endTime: r.horario_fim || undefined,
        locationName: r.local_nome,
        address: r.endereco,
        city: r.cidade,
        state: r.estado,
        stateName: r.estado_nome_completo || r.estado,
        latitude: latVal || undefined,
        longitude: lngVal || undefined,
        distanceKm,
        liberado: r.liberado !== null && r.liberado !== undefined ? r.liberado : '',
        isFree: Boolean(r.is_gratuito),
        price: r.preco ?? undefined,
        priceDetails: r.detalhes_preco || undefined,
        imageUrl: r.imagem_url || '',
        mediaType: isVideo ? 'video' : 'image',
        videoUrl: resolvedVideoUrl || (isVideo ? rawUrl : undefined),
        video_url: resolvedVideoUrl || (isVideo ? rawUrl : undefined),
        video_utl: resolvedVideoUrl || (isVideo ? rawUrl : undefined),
        url: rawUrl || resolvedVideoUrl || r.imagem_url || undefined,
        Url: rawUrl || resolvedVideoUrl || r.imagem_url || undefined,
        organizer: r.organizador,
        contact: r.contato || undefined,
        tags: r.tags ? JSON.parse(r.tags) : [],
        featured: Boolean(r.destaque),
        status: r.status || 'em_analise',
        createdAt: r.criado_em,
      };
    });

    const isValidImageUrl = (url?: string | null): boolean => {
      if (!url || typeof url !== 'string') return false;
      const t = url.trim();
      return t.startsWith('http://') || t.startsWith('https://') || t.startsWith('data:image/');
    };

    // Deduplicação para não trazer eventos repetidos na tela de consulta
    const seenEventKeys = new Set<string>();
    const uniqueEvents: typeof events = [];
    for (const ev of events) {
      if (!ev) continue;
      if ((req.query.has_image === 'true' || req.query.com_imagem === 'true') && !isValidImageUrl(ev.imageUrl) && !ev.videoUrl && !ev.url) {
        continue;
      }
      const idKey = (ev.id || '').trim().toLowerCase();
      const normTitle = (ev.title || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/gi, '')
        .replace(/\s+/g, ' ');
      const dateKey = (ev.date || '').split('T')[0].trim();
      const normCity = (ev.city || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      const semanticKey = `${normTitle}__${dateKey}__${normCity}`;
      const titleDateKey = `${normTitle}__${dateKey}`;

      if (idKey && seenEventKeys.has(`id:${idKey}`)) {
        continue;
      }
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

    // Ordenação: Estado (UF), Categoria, Data do evento, e depois Proximidade geográfica (distância)
    if (isProximityRequested) {
      uniqueEvents.sort((a, b) => {
        // 1. Estado (UF) - Ordem alfabética (SP, RJ, etc.)
        const stateA = a.state || '';
        const stateB = b.state || '';
        const cmpState = stateA.localeCompare(stateB, 'pt-BR');
        if (cmpState !== 0) return cmpState;

        // 2. Categoria - Ordem alfabética
        const catA = a.category || '';
        const catB = b.category || '';
        const cmpCat = catA.localeCompare(catB, 'pt-BR');
        if (cmpCat !== 0) return cmpCat;

        // 3. Data do evento - Cronológica (mais próximos na data)
        const dateA = a.date || '';
        const dateB = b.date || '';
        const cmpDate = dateA.localeCompare(dateB);
        if (cmpDate !== 0) return cmpDate;

        // 4. Proximidade geográfica (distância)
        const distA = typeof a.distanceKm === 'number' ? a.distanceKm : 999999;
        const distB = typeof b.distanceKm === 'number' ? b.distanceKm : 999999;
        if (distA !== distB) {
          return distA - distB;
        }

        // 5. Horário
        return (a.time || '').localeCompare(b.time || '');
      });
    }

    // Limita estritamente a 20 registros conforme solicitado
    const finalEvents = (limitCount && limitCount > 0)
      ? uniqueEvents.slice(0, limitCount)
      : uniqueEvents.slice(0, 20);

    res.json(finalEvents);
  } catch (error: any) {
    console.error('Erro ao listar eventos:', error);
    res.status(500).json({ error: error.message || 'Erro ao consultar eventos' });
  }
});

// Helper: Obter coordenadas geográficas (latitude e longitude) a partir do endereço do evento
async function fetchGeocodeCoordinates(
  address?: string, 
  city?: string, 
  state?: string, 
  locationName?: string
): Promise<{ latitude: string; longitude: string; displayName?: string } | null> {
  const cleanAddress = (address || '').trim();
  const cleanCity = (city || '').trim();
  const cleanState = (state || '').trim();
  const cleanLocation = (locationName || '').trim();

  if (!cleanAddress && !cleanCity && !cleanLocation) return null;

  // Montar consultas em ordem de especificidade para o endereço
  const queries = [
    cleanAddress && cleanCity && cleanState ? `${cleanAddress}, ${cleanCity}, ${cleanState}, Brasil` : '',
    cleanAddress && cleanCity ? `${cleanAddress}, ${cleanCity}, Brasil` : '',
    cleanAddress.includes('-') && cleanCity ? `${cleanAddress.split('-')[0].trim()}, ${cleanCity}, Brasil` : '',
    cleanLocation && cleanCity ? `${cleanLocation}, ${cleanCity}, Brasil` : '',
    cleanAddress ? `${cleanAddress}, Brasil` : '',
    cleanCity && cleanState ? `${cleanCity}, ${cleanState}, Brasil` : '',
    cleanCity ? `${cleanCity}, Brasil` : '',
  ].filter(Boolean);

  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
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
        };
      }
    } catch (err) {
      console.warn('Falha na tentativa de geocodificação para query:', q, err);
    }
  }

  // Fallback baseado na cidade se a rua exata não retornou
  if (cleanCity) {
    const cityKey = normalizeCityKey(cleanCity);
    const fallback = BRAZIL_CITY_COORDINATES[cityKey];
    if (fallback) {
      return {
        latitude: fallback.latitude,
        longitude: fallback.longitude,
        displayName: `${cleanCity} - ${cleanState || 'Brasil'} (Centro da cidade)`,
      };
    }
  }

  return null;
}

// Endpoint dedicado de geocodificação para consulta em tempo real no formulário
app.get('/api/geocode', async (req, res) => {
  try {
    const address = String(req.query.address || '');
    const city = String(req.query.city || '');
    const state = String(req.query.state || '');
    const locationName = String(req.query.locationName || '');

    const coords = await fetchGeocodeCoordinates(address, city, state, locationName);
    if (!coords) {
      return res.status(404).json({ error: 'Endereço não localizado para geocodificação' });
    }
    res.json(coords);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao consultar geolocalização' });
  }
});

// Consulta direta e autônoma à tabela 'eventos' (100% desvinculada de outras tabelas)
app.get('/api/eventos', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM eventos ORDER BY criado_em DESC;').all();
    res.json({
      success: true,
      total: rows.length,
      eventos: rows
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Inserir ou Atualizar Evento no SQLite (INSERT / UPDATE eventos) com geocodificação automática
app.post('/api/events', async (req, res) => {
  try {
    const body = req.body;
    const id = body.id || `evt-${Date.now()}`;
    const createdAt = body.createdAt || new Date().toISOString();
    const tagsString = JSON.stringify(body.tags || []);

    let latitude = body.latitude ? String(body.latitude) : null;
    let longitude = body.longitude ? String(body.longitude) : null;

    // As coordenadas do evento são baseadas no endereço do evento.
    // Se o cliente não enviou latitude/longitude, tenta resolver.
    if ((!latitude || !longitude) && (body.address || body.city || body.locationName)) {
      try {
        const geocoded = await fetchGeocodeCoordinates(body.address, body.city, body.state, body.locationName);
        if (geocoded) {
          latitude = geocoded.latitude;
          longitude = geocoded.longitude;
          console.log(`[Geocoding] Endereço "${body.address || body.locationName}, ${body.city}" geocodificado com sucesso: Lat ${latitude}, Lon ${longitude}`);
        }
      } catch (geoErr) {
        console.warn('[Geocoding] Não foi possível geolocalizar automaticamente pelo endereço:', geoErr);
      }
    }

    // Resolver categoria_id se informado ou buscar pelo nome da categoria
    let categoriaId: number | null = body.categoryId ? Number(body.categoryId) : null;
    if (categoriaId) {
      try {
        const catCheck = db.prepare('SELECT id, nome FROM categorias WHERE id = ? LIMIT 1;').get(categoriaId) as any;
        if (catCheck) {
          categoriaId = catCheck.id;
          if (!body.category) {
            body.category = catCheck.nome;
          }
        } else {
          categoriaId = null;
        }
      } catch (err) {
        console.warn('Erro ao checar categoria_id:', err);
      }
    }

    if (!categoriaId && body.category) {
      try {
        // 1. Busca exata (case-insensitive)
        let catRow = db.prepare('SELECT id, nome FROM categorias WHERE nome = ? COLLATE NOCASE LIMIT 1;').get(body.category) as any;
        
        // 2. Busca normalizada (ex: "Baile e Nostalgia" vs "Baile Nostalgia")
        if (!catRow) {
          const allCats = db.prepare('SELECT id, nome FROM categorias;').all() as any[];
          const normalize = (txt: string) => (txt || '').toLowerCase().replace(/\s+e\s+/g, ' ').replace(/[^a-z0-9]/g, '').trim();
          const target = normalize(body.category);
          catRow = allCats.find((c) => normalize(c.nome) === target);
        }

        if (catRow) {
          categoriaId = catRow.id;
          body.category = catRow.nome;
        } else {
          // Se não existir, insere automaticamente na tabela de categorias
          const insertCat = db.prepare('INSERT OR IGNORE INTO categorias (nome, ativa) VALUES (?, 1);');
          const resCat = insertCat.run(body.category);
          if (resCat.lastInsertRowid) {
            categoriaId = Number(resCat.lastInsertRowid);
          } else {
            const recheck = db.prepare('SELECT id FROM categorias WHERE nome = ? COLLATE NOCASE LIMIT 1;').get(body.category) as any;
            if (recheck) categoriaId = recheck.id;
          }
        }
      } catch (err) {
        console.warn('Erro ao associar categoria_id:', err);
      }
    }

    // 1. Salva de forma prioritária e direta na tabela autônoma e desvinculada 'eventos'
    saveUserEvent(db, {
      id,
      advertiserId: body.advertiserId || body.anunciante_id || null,
      categoria_id: categoriaId,
      category: body.category || 'Geral',
      title: body.title,
      description: body.description || '',
      date: body.date,
      time: body.time,
      endTime: body.endTime || null,
      locationName: body.locationName,
      address: body.address,
      city: body.city,
      state: body.state,
      latitude,
      longitude,
      liberado: body.liberado !== undefined && body.liberado !== null && body.liberado !== '' ? body.liberado : 'N',
      isFree: body.isFree ? 1 : 0,
      price: body.price || 0,
      priceDetails: body.priceDetails || '',
      imageUrl: body.imageUrl || '',
      videoUrl: body.videoUrl || body.video_url || null,
      url: body.url || body.videoUrl || body.video_url || null,
      mediaType: body.mediaType || (body.videoUrl || body.video_url ? 'video' : 'image'),
      organizer: body.organizer,
      contact: body.contact || '',
      tags: tagsString,
      destaque: body.featured ? 1 : 0,
      status: body.status || 'em_analise',
      createdAt
    });
    console.log(`[Database] Evento ${id} salvo com sucesso na tabela eventos!`);

    // 2. Sincronização secundária com a tabela dedicada da categoria (em try/catch isolado para nunca impedir o salvamento em eventos)
    try {
      saveEventToCategoryTable(db, {
        id,
        advertiserId: body.advertiserId || body.anunciante_id || null,
        categoria_id: categoriaId,
        category: body.category || 'Geral',
        title: body.title,
        description: body.description || '',
        date: body.date,
        time: body.time,
        endTime: body.endTime || null,
        locationName: body.locationName,
        address: body.address,
        city: body.city,
        state: body.state,
        latitude,
        longitude,
        liberado: body.liberado !== undefined && body.liberado !== null && body.liberado !== '' ? body.liberado : 'N',
        isFree: body.isFree ? 1 : 0,
        price: body.price || 0,
        priceDetails: body.priceDetails || '',
        imageUrl: body.imageUrl || '',
        videoUrl: body.videoUrl || body.video_url || null,
        url: body.url || body.videoUrl || body.video_url || null,
        mediaType: body.mediaType || (body.videoUrl || body.video_url ? 'video' : 'image'),
        organizer: body.organizer,
        contact: body.contact || '',
        tags: tagsString,
        featured: body.featured ? 1 : 0,
        status: body.status || 'em_analise',
        createdAt
      });
    } catch (errCat) {
      console.warn('[Database] Aviso ao sincronizar com tabela dedicada de categoria:', errCat);
    }

    // Apaga registro da tabela quarentena (eventos_importados) imediatamente após a inclusão na tabela eventos
    try {
      db.prepare(`
        DELETE FROM eventos_importados 
        WHERE id = ? 
           OR id = ?
           OR (link_ingressos = ? AND link_ingressos != '') 
           OR (url_origem = ? AND url_origem != '') 
           OR (titulo = ? COLLATE NOCASE AND titulo != '');
      `).run(id, (body as any).quarantineId || id, body.contact || '', body.contact || '', body.title || '');
    } catch (cleanQuarErr) {
      console.warn('Erro ao limpar quarentena após inclusão na tabela eventos:', cleanQuarErr);
    }

    const savedEvent = {
      ...body,
      id,
      categoryId: categoriaId ?? undefined,
      latitude,
      longitude,
      liberado: body.liberado !== undefined && body.liberado !== null && body.liberado !== '' ? body.liberado : 'N',
      createdAt,
      status: body.status || 'em_analise',
    };

    res.status(201).json(savedEvent);
  } catch (error: any) {
    console.error('Erro ao cadastrar/atualizar evento no SQLite:', error);
    res.status(500).json({ error: error.message || 'Erro ao inserir no banco SQLite' });
  }
});

// Alias em português para compatibilidade total (/api/eventos -> /api/events)
app.post('/api/eventos', (req, res, next) => {
  req.url = '/api/events';
  (app as any)._router.handle(req, res, next);
});

app.get('/api/eventos', (req, res, next) => {
  req.url = '/api/events' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
  (app as any)._router.handle(req, res, next);
});

// Endpoint para liberar todos os eventos no SQLite (liberado = 'S')
app.post('/api/events/liberar-todos', (req, res) => {
  try {
    const { category } = req.body || {};
    let totalUpdated = 0;
    if (category && category !== 'Todas') {
      try {
        const { tableName } = ensureCategoryTable(db, category);
        const updRes = db.prepare(`UPDATE ${tableName} SET liberado = 'S', status = 'aprovado';`).run();
        totalUpdated += updRes.changes;
        db.prepare("UPDATE eventos SET liberado = 'S', status = 'aprovado' WHERE LOWER(TRIM(categoria)) = LOWER(TRIM(?));").run(category);
      } catch {}
    } else {
      const catTables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name LIKE 'eventos_%' AND name != 'eventos_importados';
      `).all() as { name: string }[];
      for (const t of catTables) {
        try {
          const updRes = db.prepare(`UPDATE ${t.name} SET liberado = 'S', status = 'aprovado';`).run();
          totalUpdated += updRes.changes;
        } catch {}
      }
      try {
        db.prepare("UPDATE eventos SET liberado = 'S', status = 'aprovado';").run();
      } catch {}
    }

    // Transfere e libera todos os eventos que estão na Quarentena (eventos_importados)
    // para a tabela da respectiva categoria com liberado = 'S', e exclui definitivamente da quarentena
    let promotedFromQuarantine = 0;
    try {
      let quarSql = "SELECT * FROM eventos_importados WHERE 1=1";
      const quarParams: any[] = [];
      if (category && category !== 'Todas') {
        quarSql += " AND (categoria = ? OR categoria_id IN (SELECT id FROM categorias WHERE nome = ?))";
        quarParams.push(category, category);
      }
      const quarantineItems = db.prepare(quarSql).all(...quarParams) as any[];

      for (const item of quarantineItems) {
        let latitude = item.latitude;
        let longitude = item.longitude;
        if (!latitude || !longitude) {
          if (item.cidade) {
            const cityKey = normalizeCityKey(item.cidade);
            const fallback = BRAZIL_CITY_COORDINATES[cityKey];
            if (fallback) {
              latitude = fallback.latitude;
              longitude = fallback.longitude;
            }
          }
        }

        let categoriaId = item.categoria_id;
        if (!categoriaId && item.categoria) {
          try {
            const cat = db.prepare('SELECT id, nome FROM categorias WHERE nome = ? COLLATE NOCASE LIMIT 1;').get(item.categoria) as any;
            if (cat) categoriaId = cat.id;
          } catch {}
        }

        let officialId = `evt-sympla-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        try {
          const existing = db.prepare('SELECT id FROM v_eventos_completos WHERE LOWER(TRIM(titulo)) = LOWER(TRIM(?)) AND data_evento = ? LIMIT 1;').get(item.titulo, item.data_evento) as any;
          if (existing && existing.id) {
            officialId = existing.id;
          }
        } catch {}

        saveEventToCategoryTable(db, {
          id: officialId,
          advertiserId: null,
          categoryId: categoriaId || null,
          category: item.categoria || 'Show',
          title: item.titulo,
          description: item.descricao || '',
          date: item.data_evento,
          time: item.horario,
          endTime: item.horario_fim || null,
          locationName: item.local_nome,
          address: item.endereco,
          city: item.cidade,
          state: item.estado,
          latitude: latitude || null,
          longitude: longitude || null,
          liberado: 'S',
          isFree: item.is_gratuito === 1,
          price: item.preco || 0,
          priceDetails: item.detalhes_preco || '',
          imageUrl: item.imagem_url || '',
          videoUrl: item.video_url || null,
          url: item.url || item.video_url || null,
          organizer: item.organizador || 'Produção',
          contact: item.link_ingressos || '',
          tags: JSON.stringify(['Sympla', item.categoria || 'Show']),
          featured: 0,
          status: 'aprovado',
          createdAt: new Date().toISOString()
        });

        db.prepare('DELETE FROM eventos_importados WHERE id = ?;').run(item.id);
        promotedFromQuarantine++;
      }

      // APAGAR TODOS OS REGISTROS DA QUARENTENA CONFORME SOLICITADO
      db.prepare('DELETE FROM eventos_importados;').run();
    } catch (cleanErr) {
      console.warn('Erro ao limpar quarentena no liberar-todos:', cleanErr);
    } finally {
      // Garantia absoluta de esvaziamento total da tabela eventos_importados
      try {
        db.prepare('DELETE FROM eventos_importados;').run();
      } catch (errFinally) {
        console.error('Falha ao limpar quarentena no finally:', errFinally);
      }
    }

    return res.json({
      success: true,
      updatedCount: totalUpdated,
      promotedFromQuarantine,
      message: `${totalUpdated} evento(s) liberado(s) com sucesso nas tabelas de categorias e quarentena esvaziada.`
    });
  } catch (err: any) {
    console.error('Erro ao liberar todos os eventos:', err);
    return res.status(500).json({ error: err.message || 'Erro ao liberar todos os eventos' });
  }
});

// Atualizar Evento existente diretamente pelo ID (PUT /api/events/:id)
app.put('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    // Se for atualização de status de liberação e/ou URL
    if (body.liberado !== undefined && !body.title) {
      const targetUrl = body.url || body.videoUrl;
      const isVideo = body.urlType === 'video' || (targetUrl && (targetUrl.startsWith('data:video/') || targetUrl.includes('youtube') || targetUrl.includes('youtu.be') || targetUrl.includes('facebook') || targetUrl.includes('fb.') || targetUrl.includes('.mp4') || targetUrl.includes('.webm') || targetUrl.includes('vimeo')));

      // Na tela liberar evento, gravar o campo URL no arquivo de lançamento quando for vídeo (ou imagem)
      if (targetUrl) {
        try {
          updateEventUrlInAllTables(db, id, targetUrl, isVideo ? 'video' : body.urlType);
        } catch (uErr) {
          console.warn('Erro ao atualizar URL no PUT liberado:', uErr);
        }
      } else {
        // Se a URL não veio explícita no body, busca da tabela eventos ou tabelas de categorias e sincroniza
        try {
          const row = db.prepare(`
            SELECT video_url, url, imagem_url FROM eventos WHERE id = ?
            UNION ALL
            SELECT video_url, url, imagem_url FROM v_eventos_completos WHERE id = ?
            LIMIT 1;
          `).get(id, id) as any;
          if (row && (row.video_url || row.url)) {
            const vid = row.video_url || row.url;
            const isVidRow = vid && (vid.startsWith('data:video/') || vid.includes('youtube') || vid.includes('youtu.be') || vid.includes('facebook') || vid.includes('fb.') || vid.includes('.mp4') || vid.includes('.webm') || vid.includes('vimeo'));
            if (isVidRow) {
              updateEventUrlInAllTables(db, id, vid, 'video');
            }
          }
        } catch {}
      }

      let updated = false;
      const catTables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name LIKE 'eventos_%' AND name != 'eventos_importados';
      `).all() as { name: string }[];
      for (const t of catTables) {
        const info = db.prepare(`UPDATE ${t.name} SET liberado = ? WHERE id = ?;`).run(body.liberado, id);
        if (info.changes > 0) {
          updated = true;
          break;
        }
      }
      try {
        db.prepare('UPDATE eventos SET liberado = ?, status = ? WHERE id = ?;').run(
          body.liberado,
          body.liberado === 'S' ? 'aprovado' : (body.status || 'em_analise'),
          id
        );
      } catch {}

      if (!updated) {
        // Se o evento ainda não estava em nenhuma tabela de categoria, tenta copiar da tabela eventos
        try {
          const evtRow = db.prepare('SELECT * FROM eventos WHERE id = ? LIMIT 1;').get(id) as any;
          if (evtRow) {
            saveEventToCategoryTable(db, {
              ...evtRow,
              liberado: body.liberado,
              videoUrl: evtRow.video_url,
              url: evtRow.url || evtRow.video_url,
            });
            updated = true;
          }
        } catch {}
      }

      if (!updated) {
        // Se ainda assim não encontrou, verifica se está na quarentena para importar com todos os dados
        const quarItem = db.prepare('SELECT * FROM eventos_importados WHERE id = ?').get(id) as any;
        if (quarItem) {
          saveEventToCategoryTable(db, {
            id: quarItem.id,
            category: quarItem.categoria || 'Shows',
            categoryId: quarItem.categoria_id || null,
            title: quarItem.titulo || `Evento ${id}`,
            description: quarItem.descricao || '',
            date: quarItem.data_evento || '2026-09-20',
            time: quarItem.horario || '20:00',
            endTime: quarItem.horario_fim || null,
            locationName: quarItem.local_nome || 'Local a definir',
            address: quarItem.endereco || '',
            city: quarItem.cidade || 'São Paulo',
            state: quarItem.estado || 'SP',
            latitude: quarItem.latitude || null,
            longitude: quarItem.longitude || null,
            liberado: body.liberado,
            isFree: quarItem.is_gratuito || 0,
            price: quarItem.preco || 0,
            priceDetails: quarItem.detalhes_preco || '',
            imageUrl: body.imageUrl || quarItem.imagem_url || '',
            videoUrl: body.videoUrl || quarItem.video_url || null,
            url: body.url || quarItem.url || quarItem.video_url || quarItem.imagem_url || null,
            organizer: quarItem.organizador || '',
            contact: quarItem.link_ingressos || '',
            tags: ['Sympla', quarItem.categoria || 'Shows'],
            featured: 0,
            status: 'aprovado'
          });
        }
      }

      // Se liberado = 'S', apaga da quarentena para não ficar pendente
      if (body.liberado === 'S') {
        try {
          const evtRow = db.prepare('SELECT titulo, contato FROM v_eventos_completos WHERE id = ? LIMIT 1;').get(id) as any;
          if (evtRow) {
            db.prepare(`
              DELETE FROM eventos_importados 
              WHERE id = ? 
                 OR (link_ingressos = ? AND link_ingressos != '') 
                 OR (url_origem = ? AND url_origem != '') 
                 OR (titulo = ? COLLATE NOCASE AND titulo != '');
            `).run(id, evtRow.contato || '', evtRow.contato || '', evtRow.titulo || '');
          } else {
            db.prepare('DELETE FROM eventos_importados WHERE id = ?;').run(id);
          }
        } catch (quarErr) {
          console.warn('Erro ao remover da quarentena no PUT /api/events/:id:', quarErr);
        }
      }

      return res.json({
        success: true,
        id,
        liberado: body.liberado,
      });
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

    let categoriaId: number | null = body.categoryId ? Number(body.categoryId) : null;
    if (categoriaId) {
      const check = db.prepare('SELECT id, nome FROM categorias WHERE id = ? LIMIT 1;').get(categoriaId) as any;
      if (check && !body.category) body.category = check.nome;
      if (!check) categoriaId = null;
    }

    if (!categoriaId && body.category) {
      try {
        let catRow = db.prepare('SELECT id, nome FROM categorias WHERE nome = ? COLLATE NOCASE LIMIT 1;').get(body.category) as any;
        if (!catRow) {
          const allCats = db.prepare('SELECT id, nome FROM categorias;').all() as any[];
          const normalize = (txt: string) => (txt || '').toLowerCase().replace(/\s+e\s+/g, ' ').replace(/[^a-z0-9]/g, '').trim();
          catRow = allCats.find((c) => normalize(c.nome) === normalize(body.category));
        }
        if (catRow) {
          categoriaId = catRow.id;
          body.category = catRow.nome;
        }
      } catch (err) {
        console.warn('Erro ao associar categoria_id no PUT:', err);
      }
    }

    const { tableName: activeCatTable } = saveEventToCategoryTable(db, {
      id,
      advertiserId: body.advertiserId || null,
      categoryId: categoriaId,
      category: body.category || 'Shows',
      title: body.title,
      description: body.description || '',
      date: body.date,
      time: body.time,
      endTime: body.endTime || null,
      locationName: body.locationName,
      address: body.address,
      city: body.city,
      state: body.state,
      latitude,
      longitude,
      liberado: body.liberado || 'S',
      isFree: body.isFree ? 1 : 0,
      price: body.price || 0,
      priceDetails: body.priceDetails || '',
      imageUrl: body.imageUrl || '',
      videoUrl: body.videoUrl || body.video_url || null,
      url: body.url || body.videoUrl || body.imageUrl || null,
      organizer: body.organizer,
      contact: body.contact || '',
      tags: body.tags || [],
      featured: body.featured ? 1 : 0,
      status: body.status || 'aprovado'
    });

    // Se o evento mudou de categoria, remove de outras tabelas para não duplicar
    try {
      const otherTables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name LIKE 'eventos_%' AND name != 'eventos_importados' AND name != ?;
      `).all(activeCatTable) as { name: string }[];
      for (const ot of otherTables) {
        db.prepare(`DELETE FROM ${ot.name} WHERE id = ?;`).run(id);
      }
    } catch {}

    // Se liberado = 'S', apaga da quarentena para garantir que não permaneça listado
    if ((body.liberado || 'S') === 'S') {
      try {
        db.prepare(`
          DELETE FROM eventos_importados 
          WHERE id = ? 
             OR (link_ingressos = ? AND link_ingressos != '') 
             OR (url_origem = ? AND url_origem != '') 
             OR (LOWER(TRIM(titulo)) = LOWER(TRIM(?)) AND titulo != '');
        `).run(id, body.contact || '', body.contact || '', body.title || '');
      } catch (cleanQuarErr) {
        console.warn('Erro ao limpar quarentena no PUT /api/events/:id:', cleanQuarErr);
      }
    }

    try {
      saveUserEvent(db, {
        id,
        anunciante_id: body.advertiserId || null,
        categoria_id: categoriaId,
        categoria: body.category,
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
        imagem_url: body.imageUrl || '',
        video_url: body.videoUrl || body.video_url || null,
        url: body.url || body.videoUrl || body.imageUrl || null,
        organizador: body.organizer,
        contato: body.contact || '',
        tags: typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags || []),
        destaque: body.featured ? 1 : 0,
        status: body.status || 'aprovado',
        criado_em: body.createdAt || new Date().toISOString()
      });
    } catch {}

    res.json({
      success: true,
      id,
      latitude,
      longitude,
      liberado: body.liberado || 'S',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar apenas a Categoria de um Evento (conferência na tela de análise/liberação)
app.patch('/api/events/:id/category', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, categoryId } = req.body;
    if (!category || typeof category !== 'string') {
      return res.status(400).json({ error: 'Categoria não informada' });
    }

    const cleanCat = category.trim();

    // 1. Verifica se o evento está na quarentena
    const quarItem = db.prepare('SELECT * FROM eventos_importados WHERE id = ?;').get(id) as any;
    if (quarItem) {
      let targetCatId = categoryId ? Number(categoryId) : null;
      if (!targetCatId) {
        const catRow = db.prepare('SELECT id, nome FROM categorias WHERE nome = ? COLLATE NOCASE LIMIT 1;').get(cleanCat) as any;
        if (catRow) targetCatId = catRow.id;
      }
      db.prepare('UPDATE eventos_importados SET categoria = ?, categoria_id = ? WHERE id = ?;').run(cleanCat, targetCatId, id);
      return res.json({ success: true, id, category: cleanCat, isQuarantine: true });
    }

    // 2. Se está nas tabelas oficiais de categoria
    const existing = db.prepare('SELECT * FROM v_eventos_completos WHERE id = ? LIMIT 1;').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }

    let targetCatId = categoryId ? Number(categoryId) : existing.categoria_id;
    if (!targetCatId) {
      const catRow = db.prepare('SELECT id, nome FROM categorias WHERE nome = ? COLLATE NOCASE LIMIT 1;').get(cleanCat) as any;
      if (catRow) targetCatId = catRow.id;
    }

    const { tableName: activeCatTable } = saveEventToCategoryTable(db, {
      id: existing.id,
      anunciante_id: existing.anunciante_id || null,
      categoria_id: targetCatId || null,
      categoria: cleanCat,
      titulo: existing.titulo,
      descricao: existing.descricao || '',
      data_evento: existing.data_evento,
      horario: existing.horario,
      horario_fim: existing.horario_fim || null,
      local_nome: existing.local_nome,
      endereco: existing.endereco,
      cidade: existing.cidade,
      estado: existing.estado,
      latitude: existing.latitude,
      longitude: existing.longitude,
      liberado: existing.liberado || 'S',
      is_gratuito: existing.is_gratuito === 1,
      preco: existing.preco || 0,
      detalhes_preco: existing.detalhes_preco || '',
      imagem_url: existing.imagem_url || '',
      video_url: existing.video_url || null,
      url: existing.url || existing.video_url || null,
      organizador: existing.organizador || '',
      contato: existing.contato || '',
      tags: existing.tags || [],
      destaque: existing.destaque === 1,
      status: existing.status || 'aprovado'
    });

    // Remove das outras tabelas de categoria para evitar duplicidades
    try {
      const otherTables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name LIKE 'eventos_%' AND name != 'eventos_importados' AND name != ?;
      `).all(activeCatTable) as { name: string }[];
      for (const ot of otherTables) {
        db.prepare(`DELETE FROM ${ot.name} WHERE id = ?;`).run(id);
      }
    } catch (cleanErr) {
      console.warn('Erro ao limpar tabelas antigas após mudança de categoria:', cleanErr);
    }

    // Sincroniza atualização no Firestore
    try {
      const { db: fDb } = await import('./src/lib/firebase.js');
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(fDb, 'eventos', id), { category: cleanCat, categoria: cleanCat });
    } catch {}

    res.json({
      success: true,
      id,
      category: cleanCat,
      tableName: activeCatTable
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar o campo URL de um Evento (conferência na tela de análise/liberação nas tabelas correspondentes)
app.patch('/api/events/:id/url', async (req, res) => {
  try {
    const { id } = req.params;
    const { url, urlType, videoUrl, imageUrl } = req.body;
    const targetUrl = url !== undefined && url !== null ? url : (videoUrl || imageUrl);
    if (targetUrl === undefined || targetUrl === null) {
      return res.status(400).json({ error: 'Campo URL não informado' });
    }

    const result = updateEventUrlInAllTables(db, id, String(targetUrl).trim(), urlType);

    // Sincroniza atualização no Firestore se disponível
    try {
      const { db: fDb } = await import('./src/lib/firebase.js');
      const { doc, updateDoc } = await import('firebase/firestore');
      const firestoreUpdate: any = { url: result.url };
      if (result.videoUrl) {
        firestoreUpdate.videoUrl = result.videoUrl;
        firestoreUpdate.mediaType = 'video';
      }
      if (result.imageUrl) {
        firestoreUpdate.imageUrl = result.imageUrl;
      }
      await updateDoc(doc(fDb, 'eventos', id), firestoreUpdate);
    } catch {}

    res.json({
      success: true,
      ...result,
      message: `Campo URL atualizado com sucesso nas tabelas correspondentes: ${result.updatedTables.join(', ')}`
    });
  } catch (error: any) {
    console.error('Erro ao atualizar campo URL:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Excluir Evento (unitário ou todos)
app.delete('/api/events', (req, res) => {
  try {
    const delFav = db.prepare('DELETE FROM favoritos;').run();
    const deletedCount = deleteEventsFromCategoryTables(db);
    res.json({ success: true, changes: deletedCount, favoritesDeleted: delFav.changes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/events/batch-delete', (req, res) => {
  try {
    const { ids, scope, category } = req.body;
    let deletedCount = 0;

    if (Array.isArray(ids) && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      try {
        db.prepare(`DELETE FROM favoritos WHERE evento_id IN (${placeholders});`).run(...ids);
      } catch {}
      deletedCount = deleteEventsFromCategoryTables(db, { ids });
    } else if (scope === 'pending') {
      deletedCount = deleteEventsFromCategoryTables(db, { category, pendingOnly: true });
    } else if (scope === 'all') {
      try {
        db.prepare('DELETE FROM favoritos;').run();
      } catch {}
      deletedCount = deleteEventsFromCategoryTables(db);
    }

    res.json({ success: true, count: deletedCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/events/:id', (req, res) => {
  try {
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM favoritos WHERE evento_id = ?;').run(id);
    } catch {}
    const deletedCount = deleteEventFromCategoryTables(db, id);
    res.json({ success: true, changes: deletedCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sincronização em Lote de Eventos (Firestore/Client -> SQLite)
app.post('/api/events/sync-batch', (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    let totalSynced = 0;
    for (const item of events) {
      if (!item || !item.id) continue;

      let incomingVid = item.videoUrl || item.video_url || null;
      let incomingUrl = item.url || item.videoUrl || item.video_url || null;

      if (incomingVid === '[video_local_sqlite]') incomingVid = null;
      if (incomingUrl === '[video_local_sqlite]') incomingUrl = null;

      // Se o vídeo não veio ou veio nulo, preserva o que já existe no SQLite
      if (!incomingVid || !incomingUrl) {
        try {
          const rowEx = db.prepare('SELECT video_url, url FROM eventos WHERE id = ? LIMIT 1;').get(item.id) as any;
          if (rowEx) {
            const exVid = (rowEx.video_url && rowEx.video_url !== '[video_local_sqlite]') ? rowEx.video_url : null;
            const exUrl = (rowEx.url && rowEx.url !== '[video_local_sqlite]') ? rowEx.url : null;
            if (!incomingVid && exVid) incomingVid = exVid;
            if (!incomingUrl && (exUrl || exVid)) incomingUrl = exUrl || exVid;
          }
        } catch {}
      }

      const eventPayload = {
        id: item.id,
        advertiserId: item.advertiserId || null,
        categoryId: item.categoryId || null,
        category: item.category || 'Shows',
        title: item.title || 'Evento',
        description: item.description || '',
        date: item.date || '2026-09-20',
        time: item.time || '20:00',
        endTime: item.endTime || null,
        locationName: item.locationName || 'Local',
        address: item.address || '',
        city: item.city || 'São Paulo',
        state: item.state || 'SP',
        latitude: item.latitude ? String(item.latitude) : null,
        longitude: item.longitude ? String(item.longitude) : null,
        liberado: item.liberado || 'S',
        isFree: item.isFree ? 1 : 0,
        price: item.price || 0,
        priceDetails: item.priceDetails || '',
        imageUrl: item.imageUrl || '',
        videoUrl: incomingVid,
        url: incomingUrl || incomingVid,
        mediaType: item.mediaType || (incomingVid ? 'video' : 'image'),
        organizer: item.organizer || '',
        contact: item.contact || '',
        tags: item.tags || [],
        featured: item.featured ? 1 : 0,
        status: item.status || 'aprovado',
        createdAt: item.createdAt || new Date().toISOString()
      };

      saveEventToCategoryTable(db, eventPayload);
      try {
        saveUserEvent(db, eventPayload);
      } catch {}
      totalSynced++;
    }

    // Apaga da quarentena eventos que foram sincronizados e incluídos nas tabelas de categorias
    try {
      db.prepare(`
        DELETE FROM eventos_importados 
        WHERE titulo IN (SELECT titulo FROM v_eventos_completos)
           OR (link_ingressos IN (SELECT contato FROM v_eventos_completos WHERE contato != '') AND link_ingressos != '')
           OR (url_origem IN (SELECT contato FROM v_eventos_completos WHERE contato != '') AND url_origem != '');
      `).run();
    } catch (cleanSyncErr) {
      console.warn('Erro ao limpar quarentena no sync-batch:', cleanSyncErr);
    }

    res.json({ success: true, count: totalSynced });
  } catch (error: any) {
    console.error('Erro ao sincronizar eventos em lote:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ROTAS DE IMPORTAÇÃO SYMPLA & QUARENTENA ====================

// 1. Parser da URL da Sympla (extrai dados em tempo real)
app.post('/api/sympla/parse', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL do evento é obrigatória' });
    }
    const parsed = await parseSymplaEventUrl(url);
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Erro ao processar página da Sympla:', error);
    res.status(500).json({ error: error.message || 'Falha ao buscar dados do evento' });
  }
});

// 2. Listar Eventos Importados na Quarentena
app.get('/api/imported-events', (req, res) => {
  try {
    // Purga automaticamente da quarentena eventos que já foram aprovados ou incluídos na tabela oficial de eventos
    try {
      db.prepare(`
        DELETE FROM eventos_importados 
        WHERE status = 'aprovado'
           OR id IN (SELECT id FROM v_eventos_completos)
           OR LOWER(TRIM(titulo)) IN (SELECT LOWER(TRIM(titulo)) FROM v_eventos_completos WHERE titulo != '')
           OR (link_ingressos IN (SELECT contato FROM v_eventos_completos WHERE contato != '') AND link_ingressos != '')
           OR (url_origem IN (SELECT contato FROM v_eventos_completos WHERE contato != '') AND url_origem != '');
      `).run();
    } catch (cleanErr) {
      console.warn('Aviso na limpeza automática de quarentena:', cleanErr);
    }

    const status = req.query.status ? String(req.query.status) : 'quarentena';
    let sql = 'SELECT * FROM eventos_importados WHERE 1=1';
    const params: any[] = [];
    if (status !== 'todos') {
      sql += ' AND status = ?';
      params.push(status);
    }
    // Garante que nenhum evento já presente na lista unificada de eventos seja retornado na quarentena
    sql += `
      AND id NOT IN (SELECT id FROM v_eventos_completos)
      AND LOWER(TRIM(titulo)) NOT IN (SELECT LOWER(TRIM(titulo)) FROM v_eventos_completos WHERE titulo != '')
      ORDER BY criado_em DESC
    `;
    const rows = db.prepare(sql).all(...params) as any[];

    const items = rows.map((r) => ({
      id: r.id,
      origem: r.origem,
      urlOrigem: r.url_origem,
      title: r.titulo,
      description: r.descricao || '',
      category: r.categoria,
      categoryId: r.categoria_id,
      date: r.data_evento,
      time: r.horario,
      endTime: r.horario_fim || undefined,
      locationName: r.local_nome,
      address: r.endereco,
      city: r.cidade,
      state: r.estado,
      latitude: r.latitude || undefined,
      longitude: r.longitude || undefined,
      imageUrl: r.imagem_url,
      videoUrl: r.video_url || (r.url && (r.url.includes('youtube') || r.url.includes('fb.') || r.url.includes('.mp4') || r.url.startsWith('data:video/')) ? r.url : undefined),
      url: r.url || r.video_url || r.imagem_url || r.url_origem || undefined,
      price: r.preco,
      isGratuito: r.is_gratuito === 1,
      ticketUrl: r.link_ingressos,
      status: r.status,
      createdAt: r.criado_em,
    }));
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Salvar Evento na Quarentena (Unitário ou em lote com verificação anti-duplicidade)
app.post('/api/imported-events', (req, res) => {
  try {
    const body = req.body;
    const list = Array.isArray(body) ? body : [body];
    const insertStmt = db.prepare(`
      INSERT INTO eventos_importados (
        id, origem, url_origem, titulo, descricao, categoria, categoria_id,
        data_evento, horario, horario_fim, local_nome, endereco, cidade, estado,
        latitude, longitude, imagem_url, organizador, preco, is_gratuito,
        detalhes_preco, link_ingressos, status, criado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        titulo = excluded.titulo,
        descricao = excluded.descricao,
        categoria = excluded.categoria,
        data_evento = excluded.data_evento,
        horario = excluded.horario,
        horario_fim = excluded.horario_fim,
        local_nome = excluded.local_nome,
        endereco = excluded.endereco,
        cidade = excluded.cidade,
        estado = excluded.estado,
        imagem_url = excluded.imagem_url,
        link_ingressos = excluded.link_ingressos;
    `);

    let count = 0;
    let skippedCount = 0;
    const createdItems: any[] = [];
    for (const item of list) {
      const ticketUrl = item.ticketUrl || item.linkIngressos || item.urlOrigem || '';
      const title = item.title || item.titulo || '';

      // Verifica se já existe em eventos_importados ou no app oficial
      const existingImported = db.prepare(
        "SELECT id, status FROM eventos_importados WHERE ((link_ingressos = ? AND link_ingressos != '') OR (url_origem = ? AND url_origem != '') OR (titulo = ? COLLATE NOCASE AND titulo != '')) LIMIT 1;"
      ).get(ticketUrl, ticketUrl, title) as any;

      const existingOfficial = db.prepare(
        "SELECT id FROM v_eventos_completos WHERE ((contato = ? AND contato != '') OR (titulo = ? COLLATE NOCASE AND titulo != '')) LIMIT 1;"
      ).get(ticketUrl, title) as any;

      if (existingImported || existingOfficial) {
        skippedCount++;
        continue;
      }

      const id = item.id || `imp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      insertStmt.run(
        id,
        item.origem || 'sympla',
        item.urlOrigem || item.ticketUrl || '',
        item.title || item.titulo || 'Evento Sympla',
        item.description || item.descricao || '',
        item.category || item.categoria || 'Shows',
        item.categoryId || null,
        item.date || item.dataEvento || new Date().toISOString().split('T')[0],
        item.time || item.horario || '20:00',
        item.endTime || item.horarioFim || null,
        item.locationName || item.localNome || 'Local a Confirmar',
        item.address || item.endereco || 'Endereço a Confirmar',
        item.city || item.cidade || 'São Paulo',
        item.state || item.estado || 'SP',
        item.latitude || null,
        item.longitude || null,
        item.imageUrl || item.imagemUrl || '',
        item.organizer || item.organizador || 'Produção',
        item.price !== undefined && item.price !== null ? Number(item.price) : 0,
        item.isGratuito ? 1 : 0,
        item.priceDetails || '',
        item.ticketUrl || item.linkIngressos || item.urlOrigem || '',
        'quarentena',
        new Date().toISOString()
      );
      count++;
      createdItems.push({ id, ...item, status: 'quarentena' });
    }

    res.status(201).json({
      success: true,
      count,
      skippedCount,
      items: createdItems,
      message: count > 0 
        ? `${count} evento(s) adicionado(s) à Quarentena.`
        : 'Este evento já havia sido importado ou já existe no sistema!'
    });
  } catch (error: any) {
    console.error('Erro ao inserir na quarentena:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Atualizar Evento na Quarentena (Edição pré-aprovação)
app.put('/api/imported-events/:id', (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const stmt = db.prepare(`
      UPDATE eventos_importados SET
        titulo = COALESCE(?, titulo),
        descricao = COALESCE(?, descricao),
        categoria = COALESCE(?, categoria),
        data_evento = COALESCE(?, data_evento),
        horario = COALESCE(?, horario),
        horario_fim = COALESCE(?, horario_fim),
        local_nome = COALESCE(?, local_nome),
        endereco = COALESCE(?, endereco),
        cidade = COALESCE(?, cidade),
        estado = COALESCE(?, estado),
        imagem_url = COALESCE(?, imagem_url),
        organizador = COALESCE(?, organizador),
        preco = COALESCE(?, preco),
        is_gratuito = COALESCE(?, is_gratuito),
        link_ingressos = COALESCE(?, link_ingressos)
      WHERE id = ?;
    `);
    stmt.run(
      body.title,
      body.description,
      body.category,
      body.date,
      body.time,
      body.endTime,
      body.locationName,
      body.address,
      body.city,
      body.state,
      body.imageUrl,
      body.organizer,
      body.price !== undefined ? Number(body.price) : null,
      body.isGratuito !== undefined ? (body.isGratuito ? 1 : 0) : null,
      body.ticketUrl,
      id
    );
    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});



// 4b. Apagar TODOS os Registros da Quarentena
app.post('/api/imported-events/clear', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM eventos_importados;').run();
    res.json({ success: true, count: result.changes, message: 'Todos os registros da quarentena foram apagados com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao apagar todos os registros da quarentena:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/imported-events', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM eventos_importados;').run();
    res.json({ success: true, count: result.changes, message: 'Todos os registros da quarentena foram apagados com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao apagar todos os registros da quarentena:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Excluir / Descartar Evento da Quarentena
// Suporta descarte (soft delete: status = 'descartado') ou exclusão definitiva (hard delete: permanent=true)
app.delete('/api/imported-events/:id', (req, res) => {
  try {
    const { id } = req.params;
    const permanent = req.query.permanent === 'true';

    if (permanent) {
      const result = db.prepare('DELETE FROM eventos_importados WHERE id = ?;').run(id);
      res.json({ success: true, id, changes: result.changes, permanent: true });
    } else {
      const result = db.prepare("UPDATE eventos_importados SET status = 'descartado' WHERE id = ?;").run(id);
      res.json({ success: true, id, changes: result.changes, permanent: false });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Aprovar Evento Importado e Carregar no App Oficial (Move para a tabela 'eventos')
app.post('/api/imported-events/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const item = db.prepare('SELECT * FROM eventos_importados WHERE id = ?;').get(id) as any;
    if (!item) {
      return res.status(404).json({ error: 'Evento importado não encontrado na quarentena' });
    }

    // Se uma nova categoria foi enviada no corpo da requisição (conferência de categoria na tela de análise)
    if (req.body && req.body.category && typeof req.body.category === 'string') {
      item.categoria = req.body.category.trim();
      item.categoria_id = req.body.categoryId ? Number(req.body.categoryId) : null;
      try {
        db.prepare('UPDATE eventos_importados SET categoria = ?, categoria_id = ? WHERE id = ?;').run(item.categoria, item.categoria_id, id);
      } catch {}
    }

    // Geocodifica latitude e longitude pelo endereço se não existir
    let latitude = item.latitude;
    let longitude = item.longitude;
    if (!latitude || !longitude) {
      try {
        const geo = await fetchGeocodeCoordinates(item.endereco, item.cidade, item.estado, item.local_nome);
        if (geo) {
          latitude = geo.latitude;
          longitude = geo.longitude;
        }
      } catch (gErr) {
        console.warn('Erro ao geocodificar no approve:', gErr);
      }
    }

    // Resolve categoria_id
    let categoriaId = item.categoria_id;
    if (!categoriaId && item.categoria) {
      try {
        const cat = db.prepare('SELECT id, nome FROM categorias WHERE nome = ? COLLATE NOCASE LIMIT 1;').get(item.categoria) as any;
        if (cat) categoriaId = cat.id;
      } catch (cErr) {
        console.warn('Erro ao associar categoria no approve:', cErr);
      }
    }

    // ID no app oficial: se já existir evento com mesmo título e data, reutiliza o ID para atualizar em vez de duplicar
    let officialId = `evt-sympla-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    try {
      const existing = db.prepare('SELECT id FROM v_eventos_completos WHERE LOWER(TRIM(titulo)) = LOWER(TRIM(?)) AND data_evento = ? LIMIT 1;').get(item.titulo, item.data_evento) as any;
      if (existing && existing.id) {
        officialId = existing.id;
      }
    } catch {}

    // Salva o evento diretamente na tabela da respectiva categoria
    saveEventToCategoryTable(db, {
      id: officialId,
      advertiserId: null,
      categoryId: categoriaId || null,
      category: item.categoria || 'Shows',
      title: item.titulo,
      description: item.descricao || '',
      date: item.data_evento,
      time: item.horario,
      endTime: item.horario_fim || null,
      locationName: item.local_nome,
      address: item.endereco,
      city: item.cidade,
      state: item.estado,
      latitude: latitude || null,
      longitude: longitude || null,
      liberado: 'S',
      isFree: item.is_gratuito === 1,
      price: item.preco || 0,
      priceDetails: item.detalhes_preco || (item.link_ingressos ? `Ingressos Sympla: ${item.link_ingressos}` : ''),
      imageUrl: item.imagem_url || '',
      videoUrl: item.video_url || null,
      url: item.url || item.video_url || item.imagem_url || item.link_ingressos || null,
      organizer: item.organizador || 'Produção',
      contact: item.link_ingressos || '',
      tags: JSON.stringify(['Sympla', item.categoria || 'Shows']),
      featured: 0,
      status: 'aprovado',
      createdAt: new Date().toISOString()
    });

    try {
      saveUserEvent(db, {
        id: officialId,
        anunciante_id: null,
        categoria_id: categoriaId || null,
        categoria: item.categoria || 'Shows',
        titulo: item.titulo,
        descricao: item.descricao || '',
        data_evento: item.data_evento,
        horario: item.horario,
        horario_fim: item.horario_fim || null,
        local_nome: item.local_nome,
        endereco: item.endereco,
        cidade: item.cidade,
        estado: item.estado,
        latitude: latitude || null,
        longitude: longitude || null,
        liberado: 'S',
        is_gratuito: item.is_gratuito === 1,
        preco: item.preco || 0,
        detalhes_preco: item.detalhes_preco || (item.link_ingressos ? `Ingressos Sympla: ${item.link_ingressos}` : ''),
        imagem_url: item.imagem_url || '',
        video_url: item.video_url || null,
        url: item.url || item.video_url || item.imagem_url || item.link_ingressos || null,
        organizador: item.organizador || 'Produção',
        contato: item.link_ingressos || '',
        tags: JSON.stringify(['Sympla', item.categoria || 'Shows']),
        destaque: 0,
        status: 'aprovado',
        criado_em: new Date().toISOString()
      });
    } catch {}

    // Remove definitivamente o evento aprovado da quarentena
    db.prepare('DELETE FROM eventos_importados WHERE id = ?;').run(id);
    if (item.titulo || item.link_ingressos || item.url_origem) {
      db.prepare(`
        DELETE FROM eventos_importados 
        WHERE (link_ingressos = ? AND link_ingressos != '') 
           OR (url_origem = ? AND url_origem != '') 
           OR (titulo = ? COLLATE NOCASE AND titulo != '');
      `).run(item.link_ingressos || '', item.url_origem || '', item.titulo || '');
    }

    const approvedEvent = {
      id: officialId,
      title: item.titulo,
      description: item.descricao,
      category: item.categoria,
      categoryId: categoriaId,
      date: item.data_evento,
      time: item.horario,
      endDate: item.data_evento,
      endTime: item.horario_fim,
      locationName: item.local_nome,
      address: item.endereco,
      city: item.cidade,
      state: item.estado,
      latitude: latitude || undefined,
      longitude: longitude || undefined,
      imageUrl: item.imagem_url,
      videoUrl: item.video_url || undefined,
      url: item.url || item.video_url || item.imagem_url || item.link_ingressos || undefined,
      mediaType: item.video_url ? 'video' : 'image',
      organizer: item.organizador,
      contact: item.link_ingressos,
      price: item.preco,
      priceDetails: item.link_ingressos ? `Ingressos: ${item.link_ingressos}` : '',
      tags: ['Sympla', item.categoria || 'Shows'],
      liberado: 'S' as const,
      isFree: item.is_gratuito === 1,
      createdAt: new Date().toISOString(),
    };

    res.json({ success: true, officialId, event: approvedEvent });
  } catch (error: any) {
    console.error('Erro ao aprovar evento importado:', error);
    res.status(500).json({ error: error.message });
  }
});

// 7. Aprovar TODOS os Eventos da Quarentena em Lote
app.post('/api/imported-events/approve-all', async (req, res) => {
  try {
    const pending = db.prepare("SELECT * FROM eventos_importados WHERE status = 'quarentena';").all() as any[];
    if (pending.length === 0) {
      // Garante que a quarentena esteja totalmente limpa
      try {
        db.prepare("DELETE FROM eventos_importados WHERE status = 'aprovado';").run();
      } catch {}
      return res.json({ success: true, count: 0, events: [] });
    }

    const approvedEvents: any[] = [];
    for (const item of pending) {
      let latitude = item.latitude;
      let longitude = item.longitude;
      if (!latitude || !longitude) {
        if (item.cidade) {
          const cityKey = normalizeCityKey(item.cidade);
          const fallback = BRAZIL_CITY_COORDINATES[cityKey];
          if (fallback) {
            latitude = fallback.latitude;
            longitude = fallback.longitude;
          }
        }
      }

      let categoriaId = item.categoria_id;
      if (!categoriaId && item.categoria) {
        try {
          const cat = db.prepare('SELECT id, nome FROM categorias WHERE nome = ? COLLATE NOCASE LIMIT 1;').get(item.categoria) as any;
          if (cat) categoriaId = cat.id;
        } catch {}
      }

      let officialId = `evt-sympla-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      try {
        const existing = db.prepare('SELECT id FROM v_eventos_completos WHERE LOWER(TRIM(titulo)) = LOWER(TRIM(?)) AND data_evento = ? LIMIT 1;').get(item.titulo, item.data_evento) as any;
        if (existing && existing.id) {
          officialId = existing.id;
        }
      } catch {}

      try {
        saveEventToCategoryTable(db, {
          id: officialId,
          advertiserId: null,
          categoryId: categoriaId || null,
          category: item.categoria || 'Show',
          title: item.titulo,
          description: item.descricao || '',
          date: item.data_evento,
          time: item.horario,
          endTime: item.horario_fim || null,
          locationName: item.local_nome,
          address: item.endereco,
          city: item.cidade,
          state: item.estado,
          latitude: latitude || null,
          longitude: longitude || null,
          liberado: 'S',
          isFree: item.is_gratuito === 1,
          price: item.preco || 0,
          priceDetails: item.detalhes_preco || '',
          imageUrl: item.imagem_url || '',
          videoUrl: item.video_url || null,
          organizer: item.organizador || 'Produção',
          contact: item.link_ingressos || '',
          tags: JSON.stringify(['Sympla', item.categoria || 'Show']),
          featured: 0,
          status: 'aprovado',
          createdAt: new Date().toISOString()
        });

        approvedEvents.push({
          id: officialId,
          title: item.titulo,
          description: item.descricao,
          category: item.categoria || 'Categoria',
          categoryId: categoriaId,
          date: item.data_evento,
          time: item.horario,
          locationName: item.local_nome,
          address: item.endereco,
          city: item.cidade,
          state: item.estado,
          latitude: latitude || undefined,
          longitude: longitude || undefined,
          imageUrl: item.imagem_url,
          videoUrl: item.video_url || undefined,
          organizer: item.organizador,
          contact: item.link_ingressos,
          price: item.preco,
          priceDetails: item.link_ingressos ? `Ingressos: ${item.link_ingressos}` : '',
          tags: ['Sympla', item.categoria || 'Categoria'],
          liberado: 'S' as const,
          isFree: item.is_gratuito === 1,
          createdAt: new Date().toISOString(),
        });
      } catch (insertErr) {
        console.warn('Erro ao salvar evento na tabela de categoria no approve-all:', insertErr);
      }

      // Remove definitivamente da quarentena ao aprovar
      try {
        db.prepare('DELETE FROM eventos_importados WHERE id = ?;').run(item.id);
      } catch {}
    }

    // Exclusão definitiva garantida de todos os itens da quarentena
    try {
      db.prepare("DELETE FROM eventos_importados WHERE status = 'quarentena' OR status = 'aprovado';").run();
      db.prepare(`
        DELETE FROM eventos_importados 
        WHERE id IN (SELECT id FROM v_eventos_completos)
           OR LOWER(TRIM(titulo)) IN (SELECT LOWER(TRIM(titulo)) FROM v_eventos_completos WHERE titulo != '');
      `).run();
    } catch (cleanQuarErr) {
      console.warn('Aviso ao finalizar limpeza de quarentena no approve-all:', cleanQuarErr);
    }

    res.json({ success: true, count: approvedEvents.length, events: approvedEvents });
  } catch (error: any) {
    console.error('Erro ao aprovar todos os importados:', error);
    res.status(500).json({ error: error.message });
  }
});

// Função auxiliar para verificar se um evento contém alguma palavra ignorada no título ou descrição
function containsIgnoredWords(title: string, description: string): boolean {
  try {
    const rows = db.prepare("SELECT palavra FROM palavras_ignoradas;").all() as { palavra: string }[];
    if (!rows || rows.length === 0) return false;

    const fullText = `${title || ''} ${description || ''}`.toLowerCase();
    
    for (const r of rows) {
      const word = (r.palavra || '').trim().toLowerCase();
      if (word && fullText.includes(word)) {
        return true;
      }
    }
  } catch (err) {
    console.warn('Erro ao verificar palavras ignoradas:', err);
  }
  return false;
}

// 7b. Robô de Busca ao Vivo Sympla (Algolia Direct Query)
app.get('/api/sympla/search', async (req, res) => {
  try {
    const { q, query, city, state, rhythm, limit, page } = req.query;
    const searchTerm = String(q || query || '').trim();
    const hitsPerPage = limit ? parseInt(String(limit), 10) : 20;
    const pageNum = page ? parseInt(String(page), 10) : 0;

    const result = await searchSymplaLiveEvents({
      query: searchTerm,
      city: city ? String(city) : undefined,
      state: state ? String(state) : undefined,
      rhythm: rhythm ? String(rhythm) : undefined,
      hitsPerPage,
      page: pageNum,
    });

    // Anota cada evento com o status no banco (se já foi importado, se está na quarentena, etc.)
    const checkImportedStmt = db.prepare(
      "SELECT id, status FROM eventos_importados WHERE ((link_ingressos = ? AND link_ingressos != '') OR (url_origem = ? AND url_origem != '') OR (titulo = ? COLLATE NOCASE AND titulo != '')) LIMIT 1;"
    );
    const checkOfficialStmt = db.prepare(
      "SELECT id FROM v_eventos_completos WHERE ((contato = ? AND contato != '') OR (titulo = ? COLLATE NOCASE AND titulo != '')) LIMIT 1;"
    );

    // Filtra os resultados de acordo com a lista de palavras ignoradas antes de processar
    const filteredRawEvents = result.events.filter(ev => !containsIgnoredWords(ev.title, ev.description || ''));

    const annotatedEvents = filteredRawEvents.map((ev) => {
      const imp = checkImportedStmt.get(ev.ticketUrl, ev.ticketUrl, ev.title) as any;
      const off = checkOfficialStmt.get(ev.ticketUrl, ev.title) as any;

      let statusInDb: 'quarentena' | 'aprovado' | 'descartado' | 'nenhum' = 'nenhum';
      let alreadyImported = false;

      if (off) {
        statusInDb = 'aprovado';
        alreadyImported = true;
      } else if (imp) {
        statusInDb = imp.status as any;
        alreadyImported = true;
      }

      return {
        ...ev,
        alreadyImported,
        statusInDb,
      };
    });

    res.json({
      success: true,
      total: result.total,
      page: result.page,
      pages: result.pages,
      hitsPerPage: result.hitsPerPage,
      events: annotatedEvents,
    });
  } catch (error: any) {
    console.error('Erro na rota /api/sympla/search:', error);
    res.status(500).json({ error: error.message || 'Erro ao buscar eventos na Sympla' });
  }
});

// 7c. Importar Lote de Eventos Selecionados da Busca ao Vivo da Sympla
app.post('/api/sympla/import-live-batch', async (req, res) => {
  try {
    const { events, defaultCategory } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Nenhum evento fornecido para importação.' });
    }

    const insertStmt = db.prepare(`
      INSERT INTO eventos_importados (
        id, origem, url_origem, titulo, descricao, categoria, categoria_id,
        data_evento, horario, horario_fim, local_nome, endereco, cidade, estado,
        latitude, longitude, imagem_url, organizador, preco, is_gratuito,
        detalhes_preco, link_ingressos, status, criado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        titulo = excluded.titulo,
        descricao = excluded.descricao,
        categoria = excluded.categoria,
        data_evento = excluded.data_evento,
        horario = excluded.horario,
        horario_fim = excluded.horario_fim,
        local_nome = excluded.local_nome,
        endereco = excluded.endereco,
        cidade = excluded.cidade,
        estado = excluded.estado,
        imagem_url = excluded.imagem_url,
        link_ingressos = excluded.link_ingressos;
    `);

    let addedCount = 0;
    let skippedCount = 0;
    const insertedItems: any[] = [];

    for (const item of events) {
      // Filtra por palavras ignoradas cadastradas no banco
      if (containsIgnoredWords(item.title, item.description || '')) {
        skippedCount++;
        continue;
      }

      const chosenCategory = defaultCategory || item.rhythm || item.category || 'Shows';
      let catId: number | null = null;
      try {
        const cat = db.prepare('SELECT id FROM categorias WHERE nome = ? COLLATE NOCASE LIMIT 1;').get(chosenCategory) as any;
        if (cat) catId = cat.id;
      } catch {}

      // Verifica duplicidade
      const existingImported = db.prepare(
        "SELECT id, status FROM eventos_importados WHERE ((link_ingressos = ? AND link_ingressos != '') OR (url_origem = ? AND url_origem != '') OR (titulo = ? COLLATE NOCASE AND titulo != '')) LIMIT 1;"
      ).get(item.ticketUrl, item.ticketUrl, item.title) as any;

      const existingOfficial = db.prepare(
        "SELECT id FROM v_eventos_completos WHERE ((contato = ? AND contato != '') OR (titulo = ? COLLATE NOCASE AND titulo != '')) LIMIT 1;"
      ).get(item.ticketUrl, item.title) as any;

      if (existingImported || existingOfficial) {
        skippedCount++;
        continue;
      }

      const id = `imp-sympla-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      insertStmt.run(
        id,
        'sympla',
        item.ticketUrl,
        item.title,
        item.description || '',
        chosenCategory,
        catId,
        item.date,
        item.time || '20:00',
        item.endTime || null,
        item.locationName || 'Local a confirmar',
        item.address || '',
        item.city || 'São Paulo',
        item.state || 'SP',
        item.latitude || null,
        item.longitude || null,
        item.imageUrl,
        item.organizer || '',
        item.price || 0,
        item.isGratuito ? 1 : 0,
        item.isGratuito ? 'Gratuito' : (item.price ? `R$ ${item.price.toFixed(2)}` : 'Consulte'),
        item.ticketUrl,
        'quarentena',
        new Date().toISOString()
      );

      addedCount++;
      insertedItems.push({ id, ...item, category: chosenCategory, status: 'quarentena' });
    }

    const totalQuarantine = db.prepare("SELECT COUNT(*) as count FROM eventos_importados WHERE status = 'quarentena';").get() as any;

    res.json({
      success: true,
      addedCount,
      skippedCount,
      totalQuarantine: totalQuarantine ? totalQuarantine.count : 0,
      items: insertedItems,
      message: addedCount > 0
        ? `${addedCount} eventos foram importados para a Quarentena com sucesso!`
        : `Nenhum evento novo importado. Todos os ${skippedCount} eventos selecionados já constam no banco ou quarentena.`,
    });
  } catch (error: any) {
    console.error('Erro ao importar lote ao vivo da Sympla:', error);
    res.status(500).json({ error: error.message || 'Erro ao importar lote da Sympla' });
  }
});

// 7b. Importar TODOS os Eventos Encontrados em uma Busca da Sympla (Sem limite de 20 por página)
app.post('/api/sympla/import-all-query', async (req, res) => {
  try {
    const { query, city, state, rhythm, defaultCategory, maxEvents = 600 } = req.body;

    console.log(`[Sympla] Iniciando varredura completa: termo="${query || ''}", cidade="${city || ''}", estado="${state || ''}"`);
    const searchResult = await fetchAllSymplaLiveEvents({
      query,
      city,
      state,
      rhythm,
      maxEvents: Number(maxEvents) || 600,
    });

    const events = searchResult.events;
    let addedCount = 0;
    let skippedCount = 0;
    const insertedItems: any[] = [];

    const insertStmt = db.prepare(`
      INSERT INTO eventos_importados (
        id, origem, url_origem, titulo, descricao, categoria, categoria_id,
        data_evento, horario, horario_fim, local_nome, endereco, cidade, estado,
        estado_id, latitude, longitude, imagem_url, organizador, preco, is_gratuito,
        detalhes_preco, link_ingressos, status, criado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        titulo = excluded.titulo,
        descricao = excluded.descricao,
        categoria = excluded.categoria,
        categoria_id = excluded.categoria_id,
        data_evento = excluded.data_evento,
        horario = excluded.horario,
        horario_fim = excluded.horario_fim,
        local_nome = excluded.local_nome,
        endereco = excluded.endereco,
        cidade = excluded.cidade,
        estado = excluded.estado,
        estado_id = excluded.estado_id,
        imagem_url = excluded.imagem_url,
        link_ingressos = excluded.link_ingressos;
    `);

    for (const item of events) {
      // Filtra por palavras ignoradas cadastradas no banco
      if (containsIgnoredWords(item.title, item.description || '')) {
        skippedCount++;
        continue;
      }

      const finalCategory = defaultCategory || item.rhythm || 'Shows';
      
      // Resolve categoria_id
      let catId: number | null = null;
      try {
        const cat = db.prepare('SELECT id FROM categorias WHERE LOWER(TRIM(nome)) = LOWER(TRIM(?)) LIMIT 1;').get(finalCategory) as any;
        if (cat) catId = cat.id;
      } catch {}

      // Resolve estado_id
      let estId: number | null = null;
      try {
        const est = db.prepare(`
          SELECT id FROM estado 
          WHERE UPPER(TRIM(estado)) = UPPER(TRIM(?)) OR UPPER(TRIM(nome)) = UPPER(TRIM(?)) OR UPPER(TRIM(nome)) = UPPER(TRIM(?))
          LIMIT 1;
        `).get(item.state || '', item.state || '', item.city || '') as any;
        if (est) estId = est.id;
      } catch {}

      // 1. Verifica duplicidade em eventos_importados
      const existingImported = db.prepare(
        "SELECT id, status FROM eventos_importados WHERE ((link_ingressos = ? AND link_ingressos != '') OR (url_origem = ? AND url_origem != '') OR (titulo = ? COLLATE NOCASE AND titulo != '')) LIMIT 1;"
      ).get(item.ticketUrl, item.ticketUrl, item.title) as any;

      // 2. Verifica duplicidade no catálogo oficial do app (v_eventos_completos)
      const existingOfficial = db.prepare(
        "SELECT id FROM v_eventos_completos WHERE ((contato = ? AND contato != '') OR (titulo = ? COLLATE NOCASE AND titulo != '')) LIMIT 1;"
      ).get(item.ticketUrl, item.title) as any;

      if (existingImported || existingOfficial) {
        skippedCount++;
        continue;
      }

      const generatedId = `sympla-live-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const now = new Date().toISOString();

      try {
        insertStmt.run(
          generatedId,
          'sympla_live',
          item.ticketUrl || '',
          item.title,
          item.description || '',
          finalCategory,
          catId,
          item.date,
          item.time || '20:00',
          item.endTime || null,
          item.locationName || 'Local a confirmar',
          item.address || '',
          item.city || 'São Paulo',
          item.state || 'SP',
          estId,
          item.latitude || null,
          item.longitude || null,
          item.imageUrl || '',
          item.organizer || 'Organizador Sympla',
          item.price ?? null,
          item.isGratuito ? 1 : 0,
          item.isGratuito ? 'Entrada Franca' : 'Conforme lote Sympla',
          item.ticketUrl || '',
          'quarentena',
          now
        );
        addedCount++;
        insertedItems.push({ id: generatedId, title: item.title, category: finalCategory });
      } catch (insertErr) {
        console.warn('Erro ao inserir item na quarentena:', insertErr);
        skippedCount++;
      }
    }

    const totalQuarantine = db.prepare("SELECT COUNT(*) as count FROM eventos_importados WHERE status = 'quarentena';").get() as any;

    res.json({
      success: true,
      totalFound: searchResult.total,
      totalProcessed: events.length,
      addedCount,
      skippedCount,
      totalQuarantine: totalQuarantine ? totalQuarantine.count : 0,
      items: insertedItems,
      message: addedCount > 0
        ? `Sucesso! Todos os ${addedCount} novos eventos encontrados foram importados para a Quarentena!`
        : `Nenhum novo evento pendente. Todos os ${skippedCount} eventos encontrados nesta busca já constavam no banco ou na quarentena.`,
    });
  } catch (error: any) {
    console.error('Erro ao importar todos os eventos da busca Sympla:', error);
    res.status(500).json({ error: error.message || 'Erro ao importar todos os eventos da busca' });
  }
});

// 7c. Sincronizar e Integrar Relacionamento de Dados entre Eventos e Outras Tabelas
app.post('/api/database/sync-relations', (req, res) => {
  try {
    const stats = syncEventsRelations();
    res.json({
      success: true,
      ...stats,
      message: 'Integração relacional executada com sucesso! Todas as tabelas de Eventos, Categorias, Estados e Anunciantes foram sincronizadas.',
    });
  } catch (error: any) {
    console.error('Erro ao sincronizar relações do banco:', error);
    res.status(500).json({ error: error.message || 'Erro ao sincronizar relações do banco' });
  }
});

// 8. Trazer Todos os Ritmos de Uma Vez da Sympla para a Quarentena
app.post('/api/sympla/discover-all', async (req, res) => {
  try {
    const { state, city } = req.body || {};
    const discovered = await discoverAllRhythmsBatch({ state, city });
    const insertStmt = db.prepare(`
      INSERT INTO eventos_importados (
        id, origem, url_origem, titulo, descricao, categoria, categoria_id,
        data_evento, horario, horario_fim, local_nome, endereco, cidade, estado,
        estado_id, latitude, longitude, imagem_url, organizador, preco, is_gratuito,
        detalhes_preco, link_ingressos, status, criado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        titulo = excluded.titulo,
        descricao = excluded.descricao,
        categoria = excluded.categoria,
        categoria_id = excluded.categoria_id,
        data_evento = excluded.data_evento,
        horario = excluded.horario,
        horario_fim = excluded.horario_fim,
        local_nome = excluded.local_nome,
        endereco = excluded.endereco,
        cidade = excluded.cidade,
        estado = excluded.estado,
        estado_id = excluded.estado_id,
        imagem_url = excluded.imagem_url,
        link_ingressos = excluded.link_ingressos;
    `);

    let addedCount = 0;
    let skippedCount = 0;
    const insertedItems: any[] = [];

    for (const item of discovered) {
      // Filtra por palavras ignoradas cadastradas no banco
      if (containsIgnoredWords(item.title, item.description || '')) {
        skippedCount++;
        continue;
      }

      // Resolve categoria_id
      let catId: number | null = null;
      try {
        const cat = db.prepare('SELECT id FROM categorias WHERE nome = ? COLLATE NOCASE LIMIT 1;').get(item.rhythm) as any;
        if (cat) catId = cat.id;
      } catch {}

      // Resolve estado_id
      let estId: number | null = null;
      try {
        const est = db.prepare(`
          SELECT id FROM estado 
          WHERE UPPER(TRIM(estado)) = UPPER(TRIM(?)) OR UPPER(TRIM(nome)) = UPPER(TRIM(?))
          LIMIT 1;
        `).get(item.state || '', item.state || '') as any;
        if (est) estId = est.id;
      } catch {}

      // 1. Verifica se já existe em eventos_importados (quarentena, já aprovado no app ou descartado)
      const existingImported = db.prepare(
        "SELECT id, status FROM eventos_importados WHERE ((link_ingressos = ? AND link_ingressos != '') OR (url_origem = ? AND url_origem != '') OR (titulo = ? COLLATE NOCASE AND titulo != '')) LIMIT 1;"
      ).get(item.ticketUrl, item.ticketUrl, item.title) as any;

      // 2. Verifica se já existe cadastrado no catálogo oficial do app
      const existingOfficial = db.prepare(
        "SELECT id FROM v_eventos_completos WHERE ((contato = ? AND contato != '') OR (titulo = ? COLLATE NOCASE AND titulo != '')) LIMIT 1;"
      ).get(item.ticketUrl, item.title) as any;

      if (existingImported || existingOfficial) {
        skippedCount++;
        continue;
      }

      const id = `imp-ritmo-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      insertStmt.run(
        id,
        'sympla',
        item.ticketUrl,
        item.title,
        item.description,
        item.rhythm,
        catId,
        item.date,
        item.time,
        item.endTime || null,
        item.locationName,
        item.address,
        item.city,
        item.state,
        estId,
        item.latitude !== undefined && item.latitude !== null ? String(item.latitude) : null,
        item.longitude !== undefined && item.longitude !== null ? String(item.longitude) : null,
        item.imageUrl,
        item.organizer,
        item.price ?? null,
        item.isGratuito ? 1 : 0,
        item.isGratuito ? 'Gratuito' : (item.price ? `R$ ${item.price.toFixed(2)}` : 'Consulte'),
        item.ticketUrl,
        'quarentena',
        new Date().toISOString()
      );
      addedCount++;
      insertedItems.push({ id, ...item, category: item.rhythm, status: 'quarentena' });
    }

    const totalQuarantine = db.prepare("SELECT COUNT(*) as count FROM eventos_importados WHERE status = 'quarentena';").get() as any;

    res.json({
      success: true,
      addedCount,
      skippedCount,
      totalQuarantine: totalQuarantine ? totalQuarantine.count : 0,
      items: insertedItems,
      message: addedCount > 0
        ? `${addedCount} novos eventos foram adicionados à Quarentena (${skippedCount} eventos já cadastrados foram ignorados para evitar duplicidade).`
        : `Nenhum evento novo encontrado. Todos os ${skippedCount} eventos já estavam cadastrados no aplicativo, na quarentena ou haviam sido descartados.`,
    });
  } catch (error: any) {
    console.error('Erro ao descobrir todos os ritmos:', error);
    res.status(500).json({ error: error.message || 'Erro ao importar todos os ritmos' });
  }
});

// 9. Atualizar Categoria de um Item da Quarentena Rapidamente
app.patch('/api/imported-events/:id/category', (req, res) => {
  try {
    const { id } = req.params;
    const { category } = req.body;
    if (!category) {
      return res.status(400).json({ error: 'Categoria é obrigatória' });
    }

    let catId: number | null = null;
    try {
      const cat = db.prepare('SELECT id FROM categorias WHERE nome = ? COLLATE NOCASE LIMIT 1;').get(category) as any;
      if (cat) catId = cat.id;
    } catch {}

    db.prepare(`
      UPDATE eventos_importados 
      SET categoria = ?, categoria_id = ?
      WHERE id = ?;
    `).run(category, catId, id);

    res.json({ success: true, id, category, categoryId: catId });
  } catch (error: any) {
    console.error('Erro ao atualizar categoria do evento importado:', error);
    res.status(500).json({ error: error.message });
  }
});

// 10. Atualizar Categoria em Lote para Vários Itens Selecionados
app.post('/api/imported-events/batch-category', (req, res) => {
  try {
    const { ids, category } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !category) {
      return res.status(400).json({ error: 'IDs e Categoria são obrigatórios' });
    }

    let catId: number | null = null;
    try {
      const cat = db.prepare('SELECT id FROM categorias WHERE nome = ? COLLATE NOCASE LIMIT 1;').get(category) as any;
      if (cat) catId = cat.id;
    } catch {}

    const placeholders = ids.map(() => '?').join(',');
    const stmt = db.prepare(`
      UPDATE eventos_importados 
      SET categoria = ?, categoria_id = ?
      WHERE id IN (${placeholders});
    `);

    const result = stmt.run(category, catId, ...ids);

    res.json({
      success: true,
      updatedCount: result.changes,
      category,
      categoryId: catId,
    });
  } catch (error: any) {
    console.error('Erro ao atualizar categorias em lote:', error);
    res.status(500).json({ error: error.message });
  }
});

// 11. Aprovar Apenas os Itens Selecionados em Lote
app.post('/api/imported-events/batch-approve', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs não informados' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const items = db.prepare(`SELECT * FROM eventos_importados WHERE id IN (${placeholders});`).all(...ids) as any[];

    const approvedEvents: any[] = [];
    for (const item of items) {
      let latitude = item.latitude;
      let longitude = item.longitude;
      if (!latitude || !longitude) {
        if (item.cidade) {
          const cityKey = normalizeCityKey(item.cidade);
          const fallback = BRAZIL_CITY_COORDINATES[cityKey];
          if (fallback) {
            latitude = fallback.latitude;
            longitude = fallback.longitude;
          }
        }
      }

      let categoriaId = item.categoria_id;
      if (!categoriaId && item.categoria) {
        try {
          const cat = db.prepare('SELECT id, nome FROM categorias WHERE nome = ? COLLATE NOCASE LIMIT 1;').get(item.categoria) as any;
          if (cat) categoriaId = cat.id;
        } catch {}
      }

      let officialId = `evt-sympla-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      try {
        const existing = db.prepare('SELECT id FROM v_eventos_completos WHERE LOWER(TRIM(titulo)) = LOWER(TRIM(?)) AND data_evento = ? LIMIT 1;').get(item.titulo, item.data_evento) as any;
        if (existing && existing.id) {
          officialId = existing.id;
        }
      } catch {}

      try {
        saveEventToCategoryTable(db, {
          id: officialId,
          advertiserId: null,
          categoryId: categoriaId || null,
          category: item.categoria || 'Show',
          title: item.titulo,
          description: item.descricao || '',
          date: item.data_evento,
          time: item.horario,
          endTime: item.horario_fim || null,
          locationName: item.local_nome,
          address: item.endereco,
          city: item.cidade,
          state: item.estado,
          latitude: latitude || null,
          longitude: longitude || null,
          liberado: 'S',
          isFree: item.is_gratuito === 1,
          price: item.preco || 0,
          priceDetails: item.detalhes_preco || '',
          imageUrl: item.imagem_url || '',
          videoUrl: item.video_url || null,
          organizer: item.organizador || 'Produção',
          contact: item.link_ingressos || '',
          tags: JSON.stringify(['Sympla', item.categoria || 'Show']),
          featured: 0,
          status: 'aprovado',
          createdAt: new Date().toISOString()
        });

        approvedEvents.push({
          id: officialId,
          title: item.titulo,
          description: item.descricao,
          category: item.categoria || 'Categoria',
          categoryId: categoriaId,
          date: item.data_evento,
          time: item.horario,
          locationName: item.local_nome,
          address: item.endereco,
          city: item.cidade,
          state: item.estado,
          latitude: latitude || undefined,
          longitude: longitude || undefined,
          imageUrl: item.imagem_url,
          videoUrl: item.video_url || undefined,
          organizer: item.organizador,
          contact: item.link_ingressos,
          price: item.preco,
          priceDetails: item.link_ingressos ? `Ingressos: ${item.link_ingressos}` : '',
          tags: ['Sympla', item.categoria || 'Categoria'],
          liberado: 'S' as const,
          isFree: item.is_gratuito === 1,
          createdAt: new Date().toISOString(),
        });
      } catch (insertErr) {
        console.warn('Erro ao inserir evento no batch-approve:', insertErr);
      }

      // Remove definitivamente da quarentena ao aprovar
      try {
        db.prepare('DELETE FROM eventos_importados WHERE id = ?;').run(item.id);
      } catch {}
    }

    // Apaga definitivamente todos os registros selecionados da tabela quarentena (eventos_importados)
    try {
      db.prepare(`DELETE FROM eventos_importados WHERE id IN (${placeholders});`).run(...ids);
      for (const item of items) {
        if (item.titulo || item.link_ingressos || item.url_origem) {
          db.prepare(`
            DELETE FROM eventos_importados 
            WHERE (link_ingressos = ? AND link_ingressos != '') 
               OR (url_origem = ? AND url_origem != '') 
               OR (titulo = ? COLLATE NOCASE AND titulo != '');
          `).run(item.link_ingressos || '', item.url_origem || '', item.titulo || '');
        }
      }
    } catch (delBatchErr) {
      console.warn('Aviso ao apagar selecionados da quarentena:', delBatchErr);
    }

    res.json({ success: true, count: approvedEvents.length, events: approvedEvents });
  } catch (error: any) {
    console.error('Erro ao aprovar lote de selecionados:', error);
    res.status(500).json({ error: error.message });
  }
});

// 12. Descartar Selecionados em Lote (suporta descarte com status = 'descartado' ou exclusão permanente)
app.post('/api/imported-events/batch-delete', (req, res) => {
  try {
    const { ids, permanent } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs não informados' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const sql = permanent === true
      ? `DELETE FROM eventos_importados WHERE id IN (${placeholders});`
      : `UPDATE eventos_importados SET status = 'descartado' WHERE id IN (${placeholders});`;

    const result = db.prepare(sql).run(...ids);

    res.json({ success: true, count: result.changes, permanent: Boolean(permanent) });
  } catch (error: any) {
    console.error('Erro ao descartar selecionados:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Anunciantes (Cadastro e Consulta)
app.get('/api/advertisers', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM anunciantes ORDER BY criado_em DESC;').all() as any[];
    const advertisers = rows.map((r) => ({
      id: r.id,
      name: r.nome,
      email: r.email,
      phone: r.telefone,
      city: r.cidade,
      state: r.estado,
      verified: Boolean(r.verificado),
      createdAt: r.criado_em,
    }));
    res.json(advertisers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Checar anunciante por e-mail
app.all(['/api/advertisers/check', '/api/anunciantes/check'], (req, res) => {
  try {
    const email = (req.body?.email || req.query?.email || '').toString().trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'E-mail não informado' });
    }
    const row = db.prepare(`
      SELECT * FROM anunciantes 
      WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))
      LIMIT 1;
    `).get(email) as any;

    if (row) {
      return res.json({
        exists: true,
        advertiser: {
          id: row.id,
          name: row.nome,
          email: row.email,
          phone: row.telefone,
          city: row.cidade,
          state: row.estado,
          verified: Boolean(row.verificado),
          createdAt: row.criado_em,
        },
      });
    }

    return res.json({
      exists: false,
      advertiser: null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Armazenamento em memória de códigos de confirmação de anunciantes
const advertiserVerificationCodes = new Map<string, { code: string; expiresAt: number; phone: string; name: string }>();
// E-mails que tiveram seus códigos confirmados com sucesso para permitir o cadastro
const confirmedEmailsForRegistration = new Set<string>();

// Gerar e enviar código de confirmação
app.post(['/api/advertisers/send-code', '/api/anunciantes/send-code'], (req, res) => {
  try {
    const { email, phone, name } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'E-mail é obrigatório para envio do código.' });
    }
    const cleanEmail = email.toString().trim().toLowerCase();
    const cleanPhone = (phone || '').toString().trim();
    const cleanName = (name || '').toString().trim() || 'Anunciante';
    
    // Gera código numérico aleatório de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutos de validade

    advertiserVerificationCodes.set(cleanEmail, {
      code,
      expiresAt,
      phone: cleanPhone,
      name: cleanName,
    });

    const confirmationMessage = `[Pra Onde Eu Vou]: Olá ${cleanName}! Seu código de confirmação de anunciante é: ${code}. Digite este código no aplicativo para confirmar seu cadastro. Válido por 15 minutos.`;

    console.info(`\n========================================`);
    console.info(`[MENSAGEM DE CONFIRMAÇÃO DE ANUNCIANTE]`);
    console.info(`Para: ${cleanName} (${cleanEmail} | ${cleanPhone})`);
    console.info(`Código Gerado: ${code}`);
    console.info(`Mensagem: "${confirmationMessage}"`);
    console.info(`========================================\n`);

    res.json({
      success: true,
      message: 'Mensagem de confirmação enviada com sucesso.',
      code,
      phone: cleanPhone,
      email: cleanEmail,
      confirmationMessage,
      expiresInMinutes: 15,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Verificar código digitado
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
      return res.status(400).json({ valid: false, error: 'Código não encontrado ou expirado. Clique em reenviar código.' });
    }

    if (Date.now() > record.expiresAt) {
      advertiserVerificationCodes.delete(cleanEmail);
      return res.status(400).json({ valid: false, error: 'Código expirado. Por favor, solicite um novo código.' });
    }

    if (record.code !== cleanCode) {
      return res.status(400).json({ valid: false, error: 'Código incorreto. Digite o código de 6 dígitos enviado para você.' });
    }

    // Código validado com sucesso!
    advertiserVerificationCodes.delete(cleanEmail);
    confirmedEmailsForRegistration.add(cleanEmail);

    res.json({
      valid: true,
      message: 'Código confirmado com sucesso!',
      email: cleanEmail,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post(['/api/advertisers', '/api/anunciantes'], (req, res) => {
  try {
    const { id, name, email, phone, city, state, verified } = req.body;
    const cleanEmail = (email || '').toString().trim().toLowerCase();

    // REGRA DE SEGURANÇA: Somente cadastrar o anunciante após a confirmação do código enviado
    if (!confirmedEmailsForRegistration.has(cleanEmail) && !verified) {
      return res.status(403).json({
        error: 'Somente é permitido cadastrar o anunciante após a confirmação do código enviado.'
      });
    }

    const advId = id || `adv-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO anunciantes (id, nome, email, telefone, cidade, estado, verificado, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `);
    const createdAt = new Date().toISOString();
    stmt.run(advId, name || '', cleanEmail, phone || '', city || '', state || '', 1, createdAt);
    
    // Remove do conjunto temporário de confirmação após efetivação do cadastro
    confirmedEmailsForRegistration.delete(cleanEmail);

    res.status(201).json({ id: advId, name, email: cleanEmail, phone, city, state, verified: true, createdAt });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Favoritos
app.get('/api/favorites', (req, res) => {
  try {
    const rows = db.prepare('SELECT evento_id FROM favoritos WHERE usuario_id = ?;').all('default_user') as any[];
    const ids = rows.map((r) => r.evento_id);
    res.json(ids);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/favorites', (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) {
      return res.status(400).json({ error: 'eventId é obrigatório' });
    }
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO favoritos (evento_id, usuario_id) VALUES (?, ?);
    `);
    stmt.run(eventId, 'default_user');
    res.json({ success: true, eventId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/favorites/:eventId', (req, res) => {
  try {
    const { eventId } = req.params;
    const stmt = db.prepare('DELETE FROM favoritos WHERE evento_id = ? AND usuario_id = ?;');
    stmt.run(eventId, 'default_user');
    res.json({ success: true, eventId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Categorias (CRUD no SQLite)
app.get(['/api/categories', '/api/categorias'], (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM categorias WHERE LOWER(TRIM(nome)) != 'categoria' ORDER BY id ASC;").all() as any[];
    const categories = rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      descricao: r.descricao || '',
      ativa: Boolean(r.ativa),
      criadoEm: r.criado_em,
    }));
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/categories', (req, res) => {
  try {
    const { nome, descricao } = req.body;
    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
    }
    const stmt = db.prepare(`
      INSERT INTO categorias (nome, descricao, ativa)
      VALUES (?, ?, 1);
    `);
    const result = stmt.run(nome.trim(), (descricao || '').trim());
    const newId = Number(result.lastInsertRowid);

    // Cria e inicializa a tabela dedicada para esta categoria
    const { tableName } = ensureCategoryTable(db, nome.trim(), newId);

    const newCategory = {
      id: newId,
      nome: nome.trim(),
      descricao: (descricao || '').trim(),
      tabela_nome: tableName,
      ativa: true,
      criadoEm: new Date().toISOString(),
    };
    res.status(201).json(newCategory);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Categoria já existe' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para inspecionar e sincronizar todas as tabelas dedicadas por categoria
app.get('/api/categories/tables', (req, res) => {
  try {
    const result = ensureAllCategoryTables(db);
    const tablesInfo = (result.tables || []).map((t) => {
      const cnt = (db.prepare(`SELECT COUNT(*) as c FROM ${t};`).get() as any)?.c || 0;
      return { table: t, count: cnt };
    });
    res.json({ success: true, totalTables: result.totalTables, tables: tablesInfo });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/categories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM categorias WHERE id = ?;');
    const result = stmt.run(id);
    res.json({ success: true, changes: result.changes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6a. Palavras Ignoradas (CRUD no SQLite) para Filtro Sympla
app.get('/api/ignored-words', (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM palavras_ignoradas ORDER BY palavra ASC;").all() as any[];
    const words = rows.map((r) => ({
      id: r.id,
      palavra: r.palavra,
      criadoEm: r.criado_em,
    }));
    res.json(words);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ignored-words', (req, res) => {
  try {
    const { palavra } = req.body;
    if (!palavra || !palavra.trim()) {
      return res.status(400).json({ error: 'Palavra é obrigatória' });
    }
    const stmt = db.prepare(`
      INSERT INTO palavras_ignoradas (palavra)
      VALUES (?);
    `);
    const result = stmt.run(palavra.trim().toLowerCase());
    const newId = Number(result.lastInsertRowid);
    res.status(201).json({ id: newId, palavra: palavra.trim().toLowerCase() });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Palavra já cadastrada como ignorada' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/ignored-words/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM palavras_ignoradas WHERE id = ?;');
    const result = stmt.run(id);
    res.json({ success: true, changes: result.changes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6b. Estado (Tabela estado do SQLite)
const getEstadoHandler = (req: any, res: any) => {
  try {
    const { estado, search } = req.query;
    let sql = 'SELECT id, nome, estado, regiao, ativa, criado_em FROM estado WHERE ativa = 1';
    const params: any[] = [];

    if (estado && estado !== 'Todos' && estado !== 'Todas') {
      sql += ' AND estado = ?';
      params.push(String(estado).toUpperCase());
    }

    if (search) {
      sql += ' AND (nome LIKE ? OR regiao LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term);
    }

    sql += ' ORDER BY nome COLLATE NOCASE ASC;';

    const rows = db.prepare(sql).all(...params) as any[];
    const items = rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      estado: r.estado,
      regiao: r.regiao || '',
      ativa: Boolean(r.ativa),
      criadoEm: r.criado_em,
    }));
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const postEstadoHandler = (req: any, res: any) => {
  try {
    const { nome, estado, regiao } = req.body;
    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }
    const cleanNome = nome.trim();
    const cleanEstado = (estado || 'SP').trim().toUpperCase();
    const cleanRegiao = (regiao || '').trim();

    const stmt = db.prepare(`
      INSERT INTO estado (nome, estado, regiao, ativa)
      VALUES (?, ?, ?, 1);
    `);
    const result = stmt.run(cleanNome, cleanEstado, cleanRegiao);
    const newItem = {
      id: Number(result.lastInsertRowid),
      nome: cleanNome,
      estado: cleanEstado,
      regiao: cleanRegiao,
      ativa: true,
      criadoEm: new Date().toISOString(),
    };
    res.status(201).json(newItem);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Registro já existe na tabela de estado' });
    }
    res.status(500).json({ error: error.message });
  }
};

const deleteAllEstadoHandler = (req: any, res: any) => {
  try {
    const stmt = db.prepare('DELETE FROM estado;');
    const result = stmt.run();
    try {
      db.prepare("DELETE FROM sqlite_sequence WHERE name = 'estado';").run();
    } catch {}
    res.json({ success: true, changes: result.changes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const deleteSingleEstadoHandler = (req: any, res: any) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM estado WHERE id = ?;');
    const result = stmt.run(id);
    res.json({ success: true, changes: result.changes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Rotas da tabela estado
app.get('/api/estado', getEstadoHandler);
app.post('/api/estado', postEstadoHandler);
app.delete('/api/estado', deleteAllEstadoHandler);
app.delete('/api/estado/:id', deleteSingleEstadoHandler);

// Compatibilidade de rotas (estados / cidades)
app.get('/api/estados', getEstadoHandler);
app.post('/api/estados', postEstadoHandler);
app.delete('/api/estados', deleteAllEstadoHandler);
app.delete('/api/estados/:id', deleteSingleEstadoHandler);

app.get('/api/cidades', getEstadoHandler);
app.post('/api/cidades', postEstadoHandler);
app.delete('/api/cidades', deleteAllEstadoHandler);
app.delete('/api/cidades/:id', deleteSingleEstadoHandler);

// 7. Supervisors (CRUD na tabela supervisor do SQLite)
app.get('/api/supervisors', (req, res) => {
  try {
    const rows = db.prepare('SELECT id, nome, senha, criado_em FROM supervisor ORDER BY id ASC;').all() as any[];
    const supervisors = rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      senha: r.senha || '',
      criadoEm: r.criado_em,
    }));
    res.json(supervisors);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/supervisors', (req, res) => {
  try {
    const { nome, senha } = req.body;
    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: 'Nome do supervisor é obrigatório' });
    }
    const stmt = db.prepare(`
      INSERT INTO supervisor (nome, senha)
      VALUES (?, ?);
    `);
    const result = stmt.run(nome.trim(), senha ? String(senha).trim() : null);
    const newSup = {
      id: Number(result.lastInsertRowid),
      nome: nome.trim(),
      senha: senha ? String(senha).trim() : '',
      criadoEm: new Date().toISOString(),
    };
    res.status(201).json(newSup);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Supervisor já cadastrado com este nome' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/supervisors/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { nome, senha } = req.body;
    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: 'Nome do supervisor é obrigatório' });
    }
    const stmt = db.prepare(`
      UPDATE supervisor SET nome = ?, senha = ? WHERE id = ?;
    `);
    const result = stmt.run(nome.trim(), senha ? String(senha).trim() : null, id);
    res.json({ success: true, changes: result.changes, id: Number(id), nome: nome.trim() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/supervisors/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM supervisor WHERE id = ?;');
    const result = stmt.run(id);
    res.json({ success: true, changes: result.changes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== MERCADO PAGO PIX ENDPOINTS ====================

// Criar cobrança Pix R$ 100 para o Patrocinador
app.post('/api/sponsors/pix/create', async (req, res) => {
  try {
    const { sponsorId, name, phone, address, city, state, category, description, badge, imageUrl } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Nome e Telefone são obrigatórios para gerar o Pix.' });
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    const cleanId = sponsorId || `sp-${Date.now()}`;
    const valor = 100.0;
    const protocolo = `PROT-${Date.now().toString().slice(-6)}`;

    // 1. Salva ou atualiza o patrocinador no banco SQLite (com ativo = 0 e liberado = 'pendente')
    try {
      const upsertSp = db.prepare(`
        INSERT INTO patrocinadores (
          id, nome, categoria, descricao, telefone, endereco, cidade, estado, badge, imagem_url, valor_mensal, ativo, liberado, status_pagamento, protocolo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pendente', 'pendente', ?)
        ON CONFLICT(id) DO UPDATE SET
          nome = excluded.nome,
          categoria = excluded.categoria,
          descricao = excluded.descricao,
          telefone = excluded.telefone,
          endereco = excluded.endereco,
          cidade = excluded.cidade,
          estado = excluded.estado,
          badge = excluded.badge,
          imagem_url = excluded.imagem_url,
          protocolo = excluded.protocolo;
      `);
      upsertSp.run(
        cleanId,
        name.trim(),
        category || 'Comércio Local',
        description || '',
        cleanPhone,
        address || '',
        city || '',
        state || 'SP',
        badge || '',
        imageUrl || '',
        protocolo
      );
    } catch (dbErr) {
      console.warn('Aviso ao salvar patrocinador no SQLite:', dbErr);
    }

    // 2. Cria pagamento Pix via Mercado Pago
    const pixRes = await createMercadoPagoPixPayment({
      transactionAmount: valor,
      description: `Patrocínio Vitrine (R$ 100/mês) - ${name.trim()}`,
      payerEmail: `anunciante.${cleanPhone}@praondeeuvou.com.br`,
      payerName: name.trim(),
      payerPhone: cleanPhone,
      externalReference: cleanId,
    });

    if (!pixRes.success) {
      return res.status(500).json({ error: pixRes.errorMessage || 'Falha ao gerar o código Pix no Mercado Pago.' });
    }

    // 3. Registra na tabela pagamentos_pix
    try {
      const insertPix = db.prepare(`
        INSERT INTO pagamentos_pix (
          id, patrocinador_id, mercado_pago_id, status, valor, qr_code, qr_code_base64, ticket_url, telefone_notificado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      `);
      insertPix.run(
        `pix-${Date.now()}`,
        cleanId,
        pixRes.paymentId,
        pixRes.status,
        valor,
        pixRes.qrCode,
        pixRes.qrCodeBase64,
        pixRes.ticketUrl,
        cleanPhone
      );
    } catch (e) {
      console.warn('Aviso ao registrar pagamento no SQLite:', e);
    }

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
    });
  } catch (error: any) {
    console.error('Erro na rota /api/sponsors/pix/create:', error);
    res.status(500).json({ error: error.message || 'Erro interno ao processar Pix' });
  }
});

// Verificar status do pagamento Pix e atualizar status de pagamento
app.get('/api/sponsors/pix/status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const check = await checkMercadoPagoPaymentStatus(paymentId);

    if (check.isPaid) {
      // Atualiza o pagamento para 'pago', MAS MANTÉM liberado = 'pendente' e ativo = 0 para revisão humana de segurança
      try {
        db.prepare(`
          UPDATE patrocinadores 
          SET status_pagamento = 'pago', data_pagamento = CURRENT_TIMESTAMP 
          WHERE id IN (SELECT patrocinador_id FROM pagamentos_pix WHERE mercado_pago_id = ?);
        `).run(paymentId);

        db.prepare(`
          UPDATE pagamentos_pix 
          SET status = 'approved', pago_em = CURRENT_TIMESTAMP 
          WHERE mercado_pago_id = ?;
        `).run(paymentId);
      } catch (e) {
        console.warn('Erro ao atualizar status pago:', e);
      }
    }

    // Obter dados do patrocinador relacionado
    let sponsorInfo: any = null;
    try {
      sponsorInfo = db.prepare(`
        SELECT p.* FROM patrocinadores p
        JOIN pagamentos_pix px ON px.patrocinador_id = p.id
        WHERE px.mercado_pago_id = ?
        LIMIT 1;
      `).get(paymentId);
    } catch {}

    res.json({
      paymentId,
      status: check.status,
      statusDetail: check.statusDetail,
      isPaid: check.isPaid,
      sponsor: sponsorInfo,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao checar status Pix' });
  }
});

// Enviar mensagem de aguardo de liberação em até 48h para o celular do anunciante
app.post('/api/sponsors/notify-confirmation', (req, res) => {
  try {
    const { phone, sponsorName, protocol } = req.body;
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const protText = protocol ? `\n📋 *Protocolo:* ${protocol}` : '';

    const message = `✅ *Olá, ${sponsorName}! Recebemos seu Pix de R$ 100,00 com sucesso!*\n\n🔒 *Por motivos de segurança*, o seu anúncio passará pela nossa análise cadastral e será liberado na vitrine do app *Pra onde eu vou* em até *48 horas*.\n${protText}\n\nAssim que nossa equipe concluir a verificação, você receberá o aviso de ativação. Obrigado pela confiança! 🚀`;

    // Marca no banco que a notificação foi emitida
    try {
      db.prepare(`
        UPDATE pagamentos_pix 
        SET mensagem_enviada = 1 
        WHERE telefone_notificado = ?;
      `).run(cleanPhone);
    } catch {}

    const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;

    res.json({
      success: true,
      phone: cleanPhone,
      message,
      whatsappUrl,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== LIBERAÇÃO DE PATROCINADORES (CENTRAL DE GERENCIAMENTO) ====================

// Listar todos os patrocinadores para a Central de Gerenciamento (com filtro de liberado/pendente)
app.get('/api/admin/sponsors', (req, res) => {
  try {
    const { status, liberado } = req.query;
    let sql = 'SELECT * FROM patrocinadores WHERE 1=1';
    const params: any[] = [];

    if (liberado && liberado !== 'all') {
      sql += ' AND liberado = ?';
      params.push(String(liberado));
    }

    if (status && status !== 'all') {
      sql += ' AND status_pagamento = ?';
      params.push(String(status));
    }

    sql += ' ORDER BY criado_em DESC;';

    const rows = db.prepare(sql).all(...params) as any[];

    res.json(rows.map(r => ({
      id: r.id,
      name: r.nome,
      category: r.categoria,
      description: r.descricao,
      phone: r.telefone,
      address: r.endereco,
      city: r.cidade,
      state: r.estado,
      badge: r.badge,
      latitude: r.latitude,
      longitude: r.longitude,
      imageUrl: r.imagem_url,
      monthlyFee: r.valor_mensal,
      active: Boolean(r.ativo),
      liberado: r.liberado || 'pendente',
      statusPagamento: r.status_pagamento || 'pendente',
      protocolo: r.protocolo,
      dataPagamento: r.data_pagamento,
      dataLiberacao: r.data_liberacao,
      createdAt: r.criado_em,
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Liberar (aprovar) ou Rejeitar Patrocinador na Central de Gerenciamento
app.post('/api/admin/sponsors/:id/liberacao', (req, res) => {
  try {
    const { id } = req.params;
    const { action, motivo } = req.body; // action: 'aprovar' | 'rejeitar' | 'pausar'

    let novoLiberado = 'pendente';
    let novoAtivo = 0;

    if (action === 'aprovar') {
      novoLiberado = 'S';
      novoAtivo = 1;
    } else if (action === 'rejeitar') {
      novoLiberado = 'N';
      novoAtivo = 0;
    } else if (action === 'pausar') {
      novoLiberado = 'pendente';
      novoAtivo = 0;
    }

    const stmt = db.prepare(`
      UPDATE patrocinadores 
      SET liberado = ?, ativo = ?, data_liberacao = CURRENT_TIMESTAMP
      WHERE id = ?;
    `);
    const result = stmt.run(novoLiberado, novoAtivo, id);

    // Buscar patrocinador atualizado
    const updated = db.prepare('SELECT * FROM patrocinadores WHERE id = ?;').get(id) as any;

    // Gerar mensagem de WhatsApp para envio manual ou automático
    let whatsappNotifyUrl = '';
    if (updated && updated.telefone) {
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
      changes: result.changes,
      id,
      liberado: novoLiberado,
      active: novoAtivo === 1,
      whatsappNotifyUrl,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Verificação de Senha Administrativa (Padrão 0612 ou senha na tabela supervisor)
app.post('/api/admin/verify-password', (req, res) => {
  try {
    const { password } = req.body;
    const clean = String(password || '').trim();
    if (!clean) {
      return res.status(400).json({ valid: false, message: 'Senha é obrigatória' });
    }

    // A. Senha padrão default: 0612
    if (clean === '0612') {
      return res.json({
        valid: true,
        user: 'Administrador Master',
        role: 'master',
      });
    }

    // B. Senha cadastrada na tabela supervisor
    const supervisor = db.prepare('SELECT id, nome, senha FROM supervisor WHERE senha = ?;').get(clean) as any;
    if (supervisor) {
      return res.json({
        valid: true,
        user: supervisor.nome,
        supervisorId: supervisor.id,
        role: 'supervisor',
      });
    }

    return res.status(401).json({
      valid: false,
      message: 'Senha incorreta. Digite a senha padrão (0612) ou a senha cadastrada na tabela supervisor.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SQL CONSOLE / EXPLORER ROUTES ====================

// Obter schema completo das tabelas existentes no SQLite
app.get('/api/sql/schema', (req, res) => {
  try {
    const schema = getDatabaseSchema();
    res.json({
      databaseName: 'praondeeu.db',
      engine: 'SQLite 3 (Node.js Native)',
      tables: schema,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Executar comando SQL arbitrário
app.post('/api/sql/query', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Comando SQL não informado' });
    }

    // Se for DELETE ou TRUNCATE em tabelas de eventos, detecta os IDs antes de executar
    let eventIdsToDelete: string[] = [];
    const isEventDelete = /\b(DELETE\s+FROM|TRUNCATE\s+(?:TABLE\s+)?)\s*(eventos[a-zA-Z0-9_]*|v_eventos_completos)\b/i.test(query);

    if (isEventDelete) {
      try {
        const tableMatch = query.match(/\b(?:DELETE\s+FROM|TRUNCATE\s+(?:TABLE\s+)?)\s*([a-zA-Z0-9_]+)/i);
        const tblName = tableMatch ? tableMatch[1] : '';
        if (tblName) {
          const whereMatch = query.match(/\bWHERE\s+([^;]+)/i);
          const whereClause = whereMatch ? `WHERE ${whereMatch[1].trim()}` : '';

          let selectSql = '';
          if (tblName.toLowerCase() === 'eventos' || tblName.toLowerCase() === 'v_eventos_completos') {
            selectSql = `SELECT id FROM v_eventos_completos ${whereClause};`;
          } else {
            selectSql = `SELECT id FROM ${tblName} ${whereClause};`;
          }
          const rows = db.prepare(selectSql).all() as { id: string }[];
          eventIdsToDelete = rows.map(r => String(r.id)).filter(Boolean);
        }
      } catch (errCapture) {
        console.warn('[SQL Console] Aviso ao capturar IDs para sincronizar com Firestore:', errCapture);
      }
    }

    const startTime = performance.now();
    const result = executeSqlQuery(query);
    const durationMs = (performance.now() - startTime).toFixed(2);

    // Se o comando excluiu eventos, remove-os do Firestore para que o listener em tempo real não os recrie
    if (eventIdsToDelete.length > 0) {
      try {
        const { db: fDb } = await import('./src/lib/firebase.js');
        const { doc, writeBatch } = await import('firebase/firestore');
        for (let i = 0; i < eventIdsToDelete.length; i += 450) {
          const chunk = eventIdsToDelete.slice(i, i + 450);
          const batch = writeBatch(fDb);
          for (const eid of chunk) {
            batch.delete(doc(fDb, 'eventos', eid));
          }
          await batch.commit();
        }
        console.log(`[Firestore] ${eventIdsToDelete.length} evento(s) excluído(s) em sincronia com o SQLite.`);
      } catch (fErr) {
        console.warn('[Firestore] Erro ao sincronizar exclusão com Firestore:', fErr);
      }

      // Remove também da tabela favoritos do SQLite
      try {
        const placeholders = eventIdsToDelete.map(() => '?').join(',');
        db.prepare(`DELETE FROM favoritos WHERE evento_id IN (${placeholders});`).run(...eventIdsToDelete);
      } catch {}
    }

    res.json({
      ...result,
      deletedEventIds: eventIdsToDelete,
      durationMs: `${durationMs}ms`,
    });
  } catch (error: any) {
    res.status(400).json({
      error: error.message || 'Erro de sintaxe ou execução no SQLite',
    });
  }
});

// Rota administrativa para acionar manualmente a limpeza e reorganização de tabelas
app.post('/api/admin/cleanup-database', async (req, res) => {
  try {
    const result = await runDailyDatabaseCleanup();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Função robusta de limpeza diária de eventos anteriores ao dia de hoje e reorganização de tabelas
async function runDailyDatabaseCleanup(): Promise<{ success: boolean; deletedCount: number; reorganized: boolean; expiredIds: string[]; dateStr: string }> {
  try {
    // 1. Obtém a data de hoje no fuso horário de São Paulo (America/Sao_Paulo)
    const now = new Date();
    const spString = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const spDate = new Date(spString);
    const year = spDate.getFullYear();
    const month = String(spDate.getMonth() + 1).padStart(2, '0');
    const day = String(spDate.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;

    console.log(`[Cron Cleanup] Iniciando processo automático de limpeza diária para eventos anteriores a ${todayString}...`);

    // 2. Coleta todos os IDs de eventos expirados para sincronizar a remoção com o Firestore
    let expiredEventIds: string[] = [];
    try {
      const rows = db.prepare('SELECT id FROM eventos WHERE data_evento < ?;').all(todayString) as { id: string }[];
      expiredEventIds = rows.map((r: any) => String(r.id)).filter(Boolean);
    } catch (eGet) {
      console.warn('[Cron Cleanup] Erro ao listar IDs da tabela mestre:', eGet);
      // Tenta na view unificada se a tabela mestre apresentar falhas
      try {
        const rowsView = db.prepare('SELECT id FROM v_eventos_completos WHERE data_evento < ?;').all(todayString) as { id: string }[];
        expiredEventIds = rowsView.map((r: any) => String(r.id)).filter(Boolean);
      } catch {}
    }

    let totalDeleted = 0;

    // Tabelas solicitadas explicitamente pelo usuário para limpeza
    const explicitTables = [
      'eventos_baile_nostalgia',
      'eventos_baile_terceira_idade',
      'eventos_bailes',
      'eventos_festas',
      'eventos_forro',
      'eventos_forro_pe_de_serra',
      'eventos_samba_e_pagode',
      'eventos_show',
      'eventos',
      'eventos_importados'
    ];

    console.log('[Cron Cleanup] Executando limpeza explícita nas tabelas configuradas...');

    for (const tName of explicitTables) {
      try {
        const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?;").get(tName);
        if (tableCheck) {
          const res = db.prepare(`DELETE FROM ${tName} WHERE data_evento < ?;`).run(todayString);
          totalDeleted += res.changes;
          if (res.changes > 0) {
            console.log(`[Cron Cleanup] Tabela "${tName}": ${res.changes} registro(s) expirado(s) removido(s).`);
          }
        }
      } catch (errTable) {
        console.warn(`[Cron Cleanup] Erro ao limpar tabela específica ${tName}:`, errTable);
      }
    }

    // 5. Deleta de todas as tabelas dedicadas de categorias adicionais (caso existam)
    try {
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name LIKE 'eventos_%' AND name != 'eventos_importados';
      `).all() as { name: string }[];

      for (const t of tables) {
        if (explicitTables.includes(t.name)) continue; // Já limpa acima
        try {
          const resCat = db.prepare(`DELETE FROM ${t.name} WHERE data_evento < ?;`).run(todayString);
          totalDeleted += resCat.changes;
          if (resCat.changes > 0) {
            console.log(`[Cron Cleanup] Tabela adicional "${t.name}": ${resCat.changes} registro(s) expirado(s) removido(s).`);
          }
        } catch (eCat) {
          console.warn(`[Cron Cleanup] Erro ao limpar tabela dedicada ${t.name}:`, eCat);
        }
      }
    } catch (eList) {
      console.warn('[Cron Cleanup] Erro ao listar tabelas para limpeza:', eList);
    }

    // 6. Remove referências dos favoritos
    if (expiredEventIds.length > 0) {
      try {
        const placeholders = expiredEventIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM favoritos WHERE evento_id IN (${placeholders});`).run(...expiredEventIds);
      } catch (eFav) {
        console.warn('[Cron Cleanup] Erro ao limpar tabela favoritos:', eFav);
      }
    }

    // 7. Sincroniza em lotes com o Firestore (removendo os registros deletados)
    if (expiredEventIds.length > 0) {
      try {
        const { db: fDb } = await import('./src/lib/firebase.js');
        const { doc, writeBatch } = await import('firebase/firestore');
        for (let i = 0; i < expiredEventIds.length; i += 450) {
          const chunk = expiredEventIds.slice(i, i + 450);
          const batch = writeBatch(fDb);
          for (const eid of chunk) {
            batch.delete(doc(fDb, 'eventos', eid));
          }
          await batch.commit();
        }
        console.log(`[Cron Cleanup] ${expiredEventIds.length} evento(s) removido(s) do Firestore em tempo real.`);
      } catch (fErr) {
        console.warn('[Cron Cleanup] Erro ao sincronizar com Firestore:', fErr);
      }
    }

    // 8. Reorganização das tabelas e compactação física do arquivo .db (VACUUM)
    console.log('[Cron Cleanup] Executando VACUUM para reorganizar e desfragmentar as tabelas no SQLite...');
    try {
      db.exec('VACUUM;');
      console.log('[Cron Cleanup] Reorganização (VACUUM) concluída com sucesso!');
    } catch (eVac) {
      console.error('[Cron Cleanup] Erro ao reorganizar tabelas com VACUUM:', eVac);
    }

    // 9. Reconstrói a view unificada para garantir consistência
    try {
      rebuildUnifiedEventsView(db);
    } catch {}

    console.log(`[Cron Cleanup] Processo diário concluído! Total de alterações: ${totalDeleted} registros limpos. Banco de dados reorganizado.`);

    return {
      success: true,
      deletedCount: totalDeleted,
      reorganized: true,
      expiredIds: expiredEventIds,
      dateStr: todayString,
    };
  } catch (error: any) {
    console.error('[Cron Cleanup] Erro fatal no processo de limpeza automática:', error);
    return {
      success: false,
      deletedCount: 0,
      reorganized: false,
      expiredIds: [],
      dateStr: new Date().toISOString(),
    };
  }
}

// Endpoint explícito para recriar e sincronizar a tabela física 'eventos'
app.post('/api/admin/create-eventos-table', (req, res) => {
  try {
    const result = createEventosTable(db);
    res.json({
      success: true,
      message: 'Tabela eventos criada e sincronizada com sucesso!',
      rowCount: result.rowCount,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== VITE MIDDLEWARE & SERVER START ====================

async function startServer() {
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    (typeof __filename !== 'undefined' && __filename.includes('dist')) ||
    (process.argv[1] && process.argv[1].includes('dist')) ||
    !fs.existsSync(path.join(process.cwd(), 'src', 'main.tsx'));

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Pra onde eu vou] Servidor SQLite + Express rodando na porta ${PORT}`);
    
    // Agenda a limpeza e reorganização automática diária para as 06h00 da manhã (fuso de São Paulo)
    cron.schedule('0 6 * * *', () => {
      runDailyDatabaseCleanup().catch((err) => {
        console.error('[Cron schedule] Erro ao executar limpeza diária:', err);
      });
    }, {
      timezone: 'America/Sao_Paulo'
    });
    console.log('[Cron] Limpeza automática diária agendada com sucesso para as 06:00 (America/Sao_Paulo)!');

    // Sincronização inicial automática em segundo plano
    syncFirestoreEventsOnStartup().catch((err) => {
      console.warn('[Startup] Sincronização em segundo plano:', err);
    });
  });
}

async function syncFirestoreEventsOnStartup() {
  try {
    const row = db.prepare('SELECT COUNT(*) as c FROM v_eventos_completos;').get() as any;
    if (row && row.c > 0) {
      console.log(`[Startup] Banco SQLite já possui ${row.c} eventos.`);
      return;
    }
    console.log('[Startup] Sincronizando eventos do Firestore para as tabelas de categorias...');
    const { db: firestoreDb } = await import('./src/lib/firebase.js');
    const { collection, getDocs } = await import('firebase/firestore');
    const snap = await getDocs(collection(firestoreDb, 'eventos'));
    if (snap.empty) {
      console.log('[Startup] Nenhum evento no Firestore para sincronizar.');
      return;
    }

    let count = 0;
    for (const d of snap.docs) {
      const data = d.data();
      saveEventToCategoryTable(db, {
        id: d.id,
        advertiserId: data.advertiserId || null,
        categoryId: data.categoryId || null,
        category: data.category || 'Categoria',
        title: data.title || 'Evento',
        description: data.description || '',
        date: data.date || '2026-09-20',
        time: data.time || '20:00',
        endTime: data.endTime || null,
        locationName: data.locationName || 'Local',
        address: data.address || '',
        city: data.city || 'São Paulo',
        state: data.state || 'SP',
        latitude: data.latitude ? String(data.latitude) : null,
        longitude: data.longitude ? String(data.longitude) : null,
        liberado: data.liberado || 'S',
        isFree: data.isFree ? 1 : 0,
        price: data.price || 0,
        priceDetails: data.priceDetails || '',
        imageUrl: data.imageUrl || '',
        videoUrl: data.videoUrl || null,
        url: data.url || data.videoUrl || null,
        mediaType: data.mediaType || (data.videoUrl ? 'video' : 'image'),
        organizer: data.organizer || '',
        contact: data.contact || '',
        tags: data.tags || [],
        featured: data.featured ? 1 : 0,
        status: 'aprovado',
        createdAt: data.createdAt || new Date().toISOString()
      });
      count++;
    }
    console.log(`[Startup] ${count} eventos sincronizados com sucesso do Firestore para as tabelas de categorias!`);
  } catch (err) {
    console.warn('[Startup] Erro ao sincronizar eventos do Firestore:', err);
  }
}

startServer();
