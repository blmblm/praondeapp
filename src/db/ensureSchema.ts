import { pool } from './index.ts';

let schemaPromise: Promise<void> | null = null;

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
          return;
        }

        for (const stmt of SCHEMA_STATEMENTS) {
          await client.query(stmt);
        }
        console.log('[Pra onde eu vou] Schema PostgreSQL criado/inicializado com sucesso.');
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
