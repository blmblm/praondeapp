import type { PoolClient } from 'pg';
import { pool } from './index.ts';
import { SP_MUNICIPIOS } from '../data/spCities.ts';
import { BRAZIL_CITY_COORDINATES, normalizeCityKey } from './mediaHelpers.ts';

let schemaPromise: Promise<void> | null = null;
const SP_CITIES_SEED_KEY = 'sp_cities_ibge_645_seeded_v1';
const GEO_INDEX_MIGRATION_KEY = 'eventos_geo_partial_indexes_v1';

function normalizeCityName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export async function ensureSpCitiesSeeded(client: PoolClient): Promise<number> {
  try {
    const metaRes = await client.query<{ value: string }>(
      `SELECT value FROM sync_metadata WHERE key = $1 LIMIT 1`,
      [SP_CITIES_SEED_KEY]
    );
    const countRes = await client.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM cidades`
    );
    const currentTotal = parseInt(countRes.rows[0]?.total || '0', 10);

    if (metaRes.rows[0]?.value === 'done' && currentTotal >= 50) {
      return 0;
    }

    // Garante que o registro do estado SP exista na tabela estado
    let spEstadoId: number | null = null;
    const spEstRes = await client.query<{ id: number }>(
      `SELECT id FROM estado WHERE UPPER(TRIM(estado)) = 'SP' ORDER BY id ASC LIMIT 1`
    );
    if (spEstRes.rows[0]?.id) {
      spEstadoId = spEstRes.rows[0].id;
    } else {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('estado', 'id'), COALESCE((SELECT MAX(id) FROM estado), 0) + 1, false)`
      );
      const insertedEst = await client.query<{ id: number }>(
        `INSERT INTO estado (nome, estado, regiao, ativa, criado_em)
         VALUES ('São Paulo', 'SP', 'Sudeste', 1, $1)
         ON CONFLICT (nome) DO NOTHING
         RETURNING id`,
        [new Date().toISOString()]
      );
      if (insertedEst.rows[0]?.id) {
        spEstadoId = insertedEst.rows[0].id;
      } else {
        const fallbackEst = await client.query<{ id: number }>(
          `SELECT id FROM estado WHERE UPPER(TRIM(estado)) = 'SP' OR LOWER(TRIM(nome)) = 'são paulo' LIMIT 1`
        );
        spEstadoId = fallbackEst.rows[0]?.id ?? null;
      }
    }

    if (!spEstadoId) {
      console.warn('[Pra onde eu vou] Não foi possível localizar ou criar o estado SP para popular cidades.');
      return 0;
    }

    const existingRows = await client.query<{ nome: string }>(`SELECT nome FROM cidades`);
    const existingSet = new Set(existingRows.rows.map((r) => normalizeCityName(r.nome || '')));

    const missingCities = SP_MUNICIPIOS.filter((cityName) => !existingSet.has(normalizeCityName(cityName)));

    let insertedCount = 0;
    if (missingCities.length > 0) {
      // Sincroniza a sequência SERIAL antes de inserir para evitar conflitos após restore de backup
      await client.query(
        `SELECT setval(pg_get_serial_sequence('cidades', 'id'), COALESCE((SELECT MAX(id) FROM cidades), 0) + 1, false)`
      );
      const nowIso = new Date().toISOString();
      const insertRes = await client.query(
        `INSERT INTO cidades (nome, estado_id, ativa, criado_em)
         SELECT t.nome, $1, 1, $2
         FROM unnest($3::text[]) AS t(nome)
         ON CONFLICT (nome) DO NOTHING`,
        [spEstadoId, nowIso, missingCities]
      );
      insertedCount = insertRes.rowCount || 0;
      console.log(
        `[Pra onde eu vou] Tabela de cidades/estado atualizada com ${insertedCount} municípios de São Paulo (total SP IBGE: ${SP_MUNICIPIOS.length}).`
      );
    }

    await client.query(
      `INSERT INTO sync_metadata (key, value) VALUES ($1, 'done')
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [SP_CITIES_SEED_KEY]
    );

    return insertedCount;
  } catch (err) {
    console.error('[Pra onde eu vou] Aviso ao popular municípios de SP:', err);
    return 0;
  }
}

export async function ensureEventsGeoAndIndexes(client: PoolClient): Promise<void> {
  try {
    // 1. Verifica se lat_num e lng_num já existem; cria se necessário (ex.: Neon / DB próprio)
    const colsRes = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'eventos'
         AND column_name IN ('lat_num', 'lng_num');`
    );
    const existingCols = new Set(colsRes.rows.map((r) => r.column_name));

    if (!existingCols.has('lat_num') || !existingCols.has('lng_num')) {
      try {
        if (!existingCols.has('lat_num')) {
          await client.query(`ALTER TABLE eventos ADD COLUMN IF NOT EXISTS lat_num DOUBLE PRECISION;`);
        }
        if (!existingCols.has('lng_num')) {
          await client.query(`ALTER TABLE eventos ADD COLUMN IF NOT EXISTS lng_num DOUBLE PRECISION;`);
        }
      } catch (ddlErr: any) {
        if (ddlErr?.code === '42501') {
          console.warn('[Pra onde eu vou] Sem permissão DDL para adicionar lat_num/lng_num; aguardando schema push.');
          return;
        }
        throw ddlErr;
      }
    }

    // 2. Cria índices parciais compostos voltados para eventos liberados (liberado = 'S') se ainda não existirem
    const existingIdxRes = await client.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'eventos';`
    );
    const existingIdx = new Set(existingIdxRes.rows.map((r) => r.indexname));
    const indexDefs: Array<{ name: string; sql: string }> = [
      {
        name: 'idx_pg_eventos_pub_catid_data_geo',
        sql: `CREATE INDEX IF NOT EXISTS idx_pg_eventos_pub_catid_data_geo
              ON eventos (categoria_id, data_evento, lat_num, lng_num)
              WHERE liberado = 'S';`,
      },
      {
        name: 'idx_pg_eventos_pub_data_geo',
        sql: `CREATE INDEX IF NOT EXISTS idx_pg_eventos_pub_data_geo
              ON eventos (data_evento, lat_num, lng_num)
              WHERE liberado = 'S';`,
      },
      {
        name: 'idx_pg_eventos_pub_geo_data',
        sql: `CREATE INDEX IF NOT EXISTS idx_pg_eventos_pub_geo_data
              ON eventos (lat_num, lng_num, data_evento)
              WHERE liberado = 'S' AND lat_num IS NOT NULL AND lng_num IS NOT NULL;`,
      },
      {
        name: 'idx_pg_eventos_pub_catnorm_data',
        sql: `CREATE INDEX IF NOT EXISTS idx_pg_eventos_pub_catnorm_data
              ON eventos (LOWER(TRIM(categoria)), data_evento)
              WHERE liberado = 'S';`,
      },
    ];
    for (const idx of indexDefs) {
      if (existingIdx.has(idx.name)) continue;
      try {
        await client.query(idx.sql);
      } catch (idxErr: any) {
        if (idxErr?.code !== '42501') {
          console.warn(`[Pra onde eu vou] Aviso ao criar índice ${idx.name}:`, idxErr?.message);
        }
      }
    }

    const metaRes = await client.query<{ value: string }>(
      `SELECT value FROM sync_metadata WHERE key = $1 LIMIT 1`,
      [GEO_INDEX_MIGRATION_KEY]
    );
    if (metaRes.rows[0]?.value === 'done') {
      return;
    }

    // 3. Padroniza liberado em maiúsculo sem espaços para garantir uso do índice parcial
    await client.query(
      `UPDATE eventos
       SET liberado = UPPER(TRIM(liberado))
       WHERE liberado IS NOT NULL AND liberado <> UPPER(TRIM(liberado));`
    );

    // 4. Preenche categoria_id ausente usando correspondência exata com a tabela categorias
    await client.query(
      `UPDATE eventos e
       SET categoria_id = c.id
       FROM categorias c
       WHERE e.categoria_id IS NULL
         AND LOWER(TRIM(e.categoria)) = LOWER(TRIM(c.nome));`
    );

    // 5. Converte latitude/longitude textuais válidas para lat_num/lng_num
    await client.query(
      `UPDATE eventos
       SET lat_num = CAST(REPLACE(TRIM(latitude), ',', '.') AS DOUBLE PRECISION),
           lng_num = CAST(REPLACE(TRIM(longitude), ',', '.') AS DOUBLE PRECISION)
       WHERE (lat_num IS NULL OR lng_num IS NULL)
         AND latitude IS NOT NULL AND longitude IS NOT NULL
         AND TRIM(latitude) ~ '^-?[0-9]+([.,][0-9]+)?$'
         AND TRIM(longitude) ~ '^-?[0-9]+([.,][0-9]+)?$'
         AND CAST(REPLACE(TRIM(latitude), ',', '.') AS DOUBLE PRECISION) BETWEEN -90 AND 90
         AND CAST(REPLACE(TRIM(longitude), ',', '.') AS DOUBLE PRECISION) BETWEEN -180 AND 180;`
    );

    // 6. Para eventos ainda sem lat_num/lng_num, preenche com a coordenada da cidade conhecida
    const missingCoordsRes = await client.query<{ id: string; cidade: string | null }>(
      `SELECT id, cidade FROM eventos WHERE lat_num IS NULL OR lng_num IS NULL`
    );
    for (const row of missingCoordsRes.rows) {
      if (!row.cidade) continue;
      const fallback = BRAZIL_CITY_COORDINATES[normalizeCityKey(row.cidade)];
      if (!fallback) continue;
      const latVal = parseFloat(fallback.latitude);
      const lngVal = parseFloat(fallback.longitude);
      if (Number.isFinite(latVal) && Number.isFinite(lngVal)) {
        await client.query(
          `UPDATE eventos
           SET lat_num = $1,
               lng_num = $2,
               latitude = COALESCE(NULLIF(TRIM(latitude), ''), $3),
               longitude = COALESCE(NULLIF(TRIM(longitude), ''), $4)
           WHERE id = $5`,
          [latVal, lngVal, fallback.latitude, fallback.longitude, row.id]
        );
      }
    }

    try {
      await client.query(`ANALYZE eventos;`);
    } catch {
      // ANALYZE pode exigir owner em alguns ambientes
    }

    await client.query(
      `INSERT INTO sync_metadata (key, value) VALUES ($1, 'done')
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [GEO_INDEX_MIGRATION_KEY]
    );

    console.log('[Pra onde eu vou] Índices parciais geográficos e colunas lat_num/lng_num configurados na tabela eventos.');
  } catch (err) {
    console.error('[Pra onde eu vou] Aviso ao configurar índices geográficos de eventos:', err);
  }
}

const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    uid TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW()
  );`,
  `CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    descricao TEXT,
    ativa INTEGER NOT NULL DEFAULT 1,
    tabela_nome TEXT,
    criado_em TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS estado (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    estado TEXT NOT NULL,
    regiao TEXT,
    ativa INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS cidades (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    estado_id INTEGER REFERENCES estado(id) ON DELETE CASCADE,
    ativa INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS supervisor (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    senha TEXT,
    criado_em TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS anunciantes (
    id TEXT PRIMARY KEY,
    nome TEXT,
    email TEXT NOT NULL UNIQUE,
    telefone TEXT,
    cpf TEXT,
    cidade TEXT,
    estado TEXT,
    verificado INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS eventos (
    id TEXT PRIMARY KEY,
    anunciante_id TEXT,
    categoria_id INTEGER,
    categoria TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    data_evento TEXT NOT NULL,
    horario TEXT NOT NULL,
    horario_fim TEXT,
    local_nome TEXT NOT NULL,
    endereco TEXT,
    cidade TEXT NOT NULL,
    estado TEXT NOT NULL,
    estado_id INTEGER,
    cidade_id INTEGER,
    latitude VARCHAR(50),
    longitude VARCHAR(50),
    lat_num DOUBLE PRECISION,
    lng_num DOUBLE PRECISION,
    liberado VARCHAR(1) NOT NULL DEFAULT 'N',
    is_gratuito INTEGER NOT NULL DEFAULT 0,
    preco DOUBLE PRECISION DEFAULT 0,
    detalhes_preco TEXT,
    imagem_url TEXT,
    video_url TEXT,
    url TEXT,
    organizador TEXT,
    contato TEXT,
    tags TEXT DEFAULT '[]',
    destaque INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'em_analise',
    criado_em TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_pg_eventos_cat_data_cid ON eventos (categoria, data_evento, cidade);`,
  `CREATE INDEX IF NOT EXISTS idx_pg_eventos_liberado_data ON eventos (liberado, data_evento);`,
  `CREATE INDEX IF NOT EXISTS idx_pg_eventos_cidade ON eventos (cidade);`,
  `CREATE INDEX IF NOT EXISTS idx_pg_eventos_estado ON eventos (estado);`,
  `CREATE INDEX IF NOT EXISTS idx_pg_eventos_categoria ON eventos (categoria);`,
  `CREATE TABLE IF NOT EXISTS eventos_importados (
    id TEXT PRIMARY KEY,
    origem TEXT DEFAULT 'sympla',
    url_origem TEXT,
    titulo TEXT NOT NULL,
    descricao TEXT,
    categoria TEXT,
    categoria_id INTEGER,
    data_evento TEXT NOT NULL,
    horario TEXT NOT NULL,
    horario_fim TEXT,
    local_nome TEXT,
    endereco TEXT,
    cidade TEXT,
    estado TEXT,
    estado_id INTEGER,
    cidade_id INTEGER,
    latitude VARCHAR(50),
    longitude VARCHAR(50),
    imagem_url TEXT,
    video_url TEXT,
    url TEXT,
    anunciante_id TEXT,
    organizador TEXT,
    preco DOUBLE PRECISION,
    is_gratuito INTEGER DEFAULT 0,
    detalhes_preco TEXT,
    link_ingressos TEXT,
    status TEXT DEFAULT 'quarentena',
    criado_em TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS favoritos (
    id SERIAL PRIMARY KEY,
    evento_id TEXT NOT NULL,
    usuario_id TEXT NOT NULL DEFAULT 'default_user',
    criado_em TEXT
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_pg_favoritos_evt_usr ON favoritos (evento_id, usuario_id);`,
  `CREATE TABLE IF NOT EXISTS palavras_ignoradas (
    id SERIAL PRIMARY KEY,
    palavra TEXT NOT NULL UNIQUE,
    criado_em TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS patrocinadores (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    categoria TEXT NOT NULL,
    descricao TEXT,
    telefone TEXT NOT NULL,
    endereco TEXT NOT NULL,
    cidade TEXT NOT NULL,
    estado TEXT NOT NULL,
    badge TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    imagem_url TEXT,
    valor_mensal DOUBLE PRECISION DEFAULT 100.0,
    ativo INTEGER DEFAULT 0,
    liberado TEXT DEFAULT 'pendente',
    status_pagamento TEXT DEFAULT 'pendente',
    protocolo TEXT,
    data_pagamento TEXT,
    data_liberacao TEXT,
    criado_em TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS pagamentos_pix (
    id TEXT PRIMARY KEY,
    patrocinador_id TEXT REFERENCES patrocinadores(id) ON DELETE CASCADE,
    mercado_pago_id TEXT,
    status TEXT DEFAULT 'pending',
    valor DOUBLE PRECISION DEFAULT 100.0,
    qr_code TEXT,
    qr_code_base64 TEXT,
    ticket_url TEXT,
    telefone_notificado TEXT,
    mensagem_enviada INTEGER DEFAULT 0,
    criado_em TEXT,
    pago_em TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS configuracoes_pix (
    id TEXT PRIMARY KEY,
    chave_pix TEXT NOT NULL,
    tipo_chave TEXT DEFAULT 'email',
    nome_beneficiario TEXT DEFAULT 'PRA ONDE EU VOU',
    cidade_beneficiario TEXT DEFAULT 'PRAIA GRANDE',
    mercado_pago_token TEXT DEFAULT '',
    atualizado_em TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS estatisticas_consultas (
    id SERIAL PRIMARY KEY,
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    estado TEXT NOT NULL,
    total_consultas INTEGER NOT NULL DEFAULT 1
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_pg_estatisticas_ano_mes_est ON estatisticas_consultas (ano, mes, estado);`,
  `CREATE TABLE IF NOT EXISTS historico_limpezas (
    id SERIAL PRIMARY KEY,
    executado_em TEXT,
    tipo TEXT,
    data_corte TEXT,
    total_excluidos INTEGER DEFAULT 0,
    tabelas_processadas TEXT,
    reorganizado INTEGER DEFAULT 0,
    duracao_ms INTEGER DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS registro_eventos_deletados (
    id TEXT PRIMARY KEY,
    deletado_em TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS sync_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS media_files (
    filename TEXT PRIMARY KEY,
    mime_type TEXT NOT NULL DEFAULT 'video/mp4',
    size_bytes INTEGER NOT NULL DEFAULT 0,
    data BYTEA NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );`,
];

export async function ensureDatabaseSchema(force = false): Promise<void> {
  if (!schemaPromise || force) {
    schemaPromise = (async () => {
      const client = await pool.connect();
      try {
        const existingRes = await client.query<{ table_name: string }>(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';`
        );
        const existingTables = new Set(existingRes.rows.map((r) => r.table_name));
        const requiredTables = [
          'users',
          'categorias',
          'estado',
          'cidades',
          'supervisor',
          'anunciantes',
          'eventos',
          'eventos_importados',
          'favoritos',
          'palavras_ignoradas',
          'patrocinadores',
          'pagamentos_pix',
          'configuracoes_pix',
          'estatisticas_consultas',
          'historico_limpezas',
          'registro_eventos_deletados',
          'sync_metadata',
          'media_files',
        ];
        const missingTables = requiredTables.filter((t) => !existingTables.has(t));
        if (missingTables.length === 0) {
          console.log('[Pra onde eu vou] Schema PostgreSQL completo verificado (18 tabelas ativas).');
        } else {
          for (const stmt of SCHEMA_STATEMENTS) {
            await client.query(stmt);
          }
          console.log('[Pra onde eu vou] Schema PostgreSQL criado/inicializado com sucesso.');
        }

        await ensureSpCitiesSeeded(client);
        await ensureEventsGeoAndIndexes(client);
      } catch (err) {
        schemaPromise = null;
        console.error('[Pra onde eu vou] Erro ao inicializar schema PostgreSQL:', err);
        throw err;
      } finally {
        client.release();
      }
    })();
  }
  return schemaPromise;
}
