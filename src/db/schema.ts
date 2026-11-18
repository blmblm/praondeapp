import { relations } from 'drizzle-orm';
import {
  customType,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

// Usuários autenticados via Firebase Auth (Google Sign-In)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').default('user').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Categorias de eventos
export const categorias = pgTable('categorias', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull().unique(),
  descricao: text('descricao'),
  ativa: integer('ativa').default(1).notNull(),
  tabela_nome: text('tabela_nome'),
  criado_em: text('criado_em'),
});

// Estados brasileiros (27 UFs)
export const estado = pgTable('estado', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull().unique(),
  estado: text('estado').notNull(),
  regiao: text('regiao'),
  ativa: integer('ativa').default(1).notNull(),
  criado_em: text('criado_em'),
});

// Cidades vinculadas aos estados
export const cidades = pgTable('cidades', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull().unique(),
  estado_id: integer('estado_id').references(() => estado.id, { onDelete: 'cascade' }),
  ativa: integer('ativa').default(1).notNull(),
  criado_em: text('criado_em'),
});

// Supervisores administrativos
export const supervisor = pgTable('supervisor', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull().unique(),
  senha: text('senha'),
  criado_em: text('criado_em'),
});

// Anunciantes e organizadores
export const anunciantes = pgTable('anunciantes', {
  id: text('id').primaryKey(),
  nome: text('nome'),
  email: text('email').notNull().unique(),
  telefone: text('telefone'),
  cpf: text('cpf'),
  cidade: text('cidade'),
  estado: text('estado'),
  verificado: integer('verificado').default(0).notNull(),
  criado_em: text('criado_em'),
});

// Tabela principal unificada de eventos (substitui SQLite + sync Firestore)
export const eventos = pgTable(
  'eventos',
  {
    id: text('id').primaryKey(),
    anunciante_id: text('anunciante_id'),
    categoria_id: integer('categoria_id'),
    categoria: text('categoria').notNull(),
    titulo: text('titulo').notNull(),
    descricao: text('descricao'),
    data_evento: text('data_evento').notNull(),
    horario: text('horario').notNull(),
    horario_fim: text('horario_fim'),
    local_nome: text('local_nome').notNull(),
    endereco: text('endereco'),
    cidade: text('cidade').notNull(),
    estado: text('estado').notNull(),
    estado_id: integer('estado_id'),
    cidade_id: integer('cidade_id'),
    latitude: varchar('latitude', { length: 50 }),
    longitude: varchar('longitude', { length: 50 }),
    liberado: varchar('liberado', { length: 1 }).default('N').notNull(),
    is_gratuito: integer('is_gratuito').default(0).notNull(),
    preco: doublePrecision('preco').default(0),
    detalhes_preco: text('detalhes_preco'),
    imagem_url: text('imagem_url'),
    video_url: text('video_url'),
    url: text('url'),
    organizador: text('organizador'),
    contato: text('contato'),
    tags: text('tags').default('[]'),
    destaque: integer('destaque').default(0).notNull(),
    status: text('status').default('em_analise'),
    criado_em: text('criado_em'),
    updated_at: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_pg_eventos_cat_data_cid').on(table.categoria, table.data_evento, table.cidade),
    index('idx_pg_eventos_liberado_data').on(table.liberado, table.data_evento),
    index('idx_pg_eventos_cidade').on(table.cidade),
    index('idx_pg_eventos_estado').on(table.estado),
    index('idx_pg_eventos_categoria').on(table.categoria),
  ]
);

// Eventos importados em quarentena (Sympla / Ticket360)
export const eventosImportados = pgTable('eventos_importados', {
  id: text('id').primaryKey(),
  origem: text('origem').default('sympla'),
  url_origem: text('url_origem'),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  categoria: text('categoria'),
  categoria_id: integer('categoria_id'),
  data_evento: text('data_evento').notNull(),
  horario: text('horario').notNull(),
  horario_fim: text('horario_fim'),
  local_nome: text('local_nome'),
  endereco: text('endereco'),
  cidade: text('cidade'),
  estado: text('estado'),
  estado_id: integer('estado_id'),
  cidade_id: integer('cidade_id'),
  latitude: varchar('latitude', { length: 50 }),
  longitude: varchar('longitude', { length: 50 }),
  imagem_url: text('imagem_url'),
  video_url: text('video_url'),
  url: text('url'),
  anunciante_id: text('anunciante_id'),
  organizador: text('organizador'),
  preco: doublePrecision('preco'),
  is_gratuito: integer('is_gratuito').default(0),
  detalhes_preco: text('detalhes_preco'),
  link_ingressos: text('link_ingressos'),
  status: text('status').default('quarentena'),
  criado_em: text('criado_em'),
});

// Favoritos dos usuários
export const favoritos = pgTable(
  'favoritos',
  {
    id: serial('id').primaryKey(),
    evento_id: text('evento_id').notNull(),
    usuario_id: text('usuario_id').notNull().default('default_user'),
    criado_em: text('criado_em'),
  },
  (table) => [
    uniqueIndex('idx_pg_favoritos_evt_usr').on(table.evento_id, table.usuario_id),
  ]
);

// Palavras ignoradas (blacklist de importação)
export const palavrasIgnoradas = pgTable('palavras_ignoradas', {
  id: serial('id').primaryKey(),
  palavra: text('palavra').notNull().unique(),
  criado_em: text('criado_em'),
});

// Patrocinadores (Vitrine)
export const patrocinadores = pgTable('patrocinadores', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  categoria: text('categoria').notNull(),
  descricao: text('descricao'),
  telefone: text('telefone').notNull(),
  endereco: text('endereco').notNull(),
  cidade: text('cidade').notNull(),
  estado: text('estado').notNull(),
  badge: text('badge'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  imagem_url: text('imagem_url'),
  valor_mensal: doublePrecision('valor_mensal').default(100.0),
  ativo: integer('ativo').default(0),
  liberado: text('liberado').default('pendente'),
  status_pagamento: text('status_pagamento').default('pendente'),
  protocolo: text('protocolo'),
  data_pagamento: text('data_pagamento'),
  data_liberacao: text('data_liberacao'),
  criado_em: text('criado_em'),
});

// Pagamentos Pix
export const pagamentosPix = pgTable('pagamentos_pix', {
  id: text('id').primaryKey(),
  patrocinador_id: text('patrocinador_id').references(() => patrocinadores.id, { onDelete: 'cascade' }),
  mercado_pago_id: text('mercado_pago_id'),
  status: text('status').default('pending'),
  valor: doublePrecision('valor').default(100.0),
  qr_code: text('qr_code'),
  qr_code_base64: text('qr_code_base64'),
  ticket_url: text('ticket_url'),
  telefone_notificado: text('telefone_notificado'),
  mensagem_enviada: integer('mensagem_enviada').default(0),
  criado_em: text('criado_em'),
  pago_em: text('pago_em'),
});

// Configurações de Pix da plataforma
export const configuracoesPix = pgTable('configuracoes_pix', {
  id: text('id').primaryKey(),
  chave_pix: text('chave_pix').notNull(),
  tipo_chave: text('tipo_chave').default('email'),
  nome_beneficiario: text('nome_beneficiario').default('PRA ONDE EU VOU'),
  cidade_beneficiario: text('cidade_beneficiario').default('PRAIA GRANDE'),
  mercado_pago_token: text('mercado_pago_token').default(''),
  atualizado_em: text('atualizado_em'),
});

// Estatísticas mensais de consultas por estado
export const estatisticasConsultas = pgTable(
  'estatisticas_consultas',
  {
    id: serial('id').primaryKey(),
    ano: integer('ano').notNull(),
    mes: integer('mes').notNull(),
    estado: text('estado').notNull(),
    total_consultas: integer('total_consultas').default(1).notNull(),
  },
  (table) => [
    uniqueIndex('idx_pg_estatisticas_ano_mes_est').on(table.ano, table.mes, table.estado),
  ]
);

// Histórico de limpezas automáticas
export const historicoLimpezas = pgTable('historico_limpezas', {
  id: serial('id').primaryKey(),
  executado_em: text('executado_em'),
  tipo: text('tipo'),
  data_corte: text('data_corte'),
  total_excluidos: integer('total_excluidos').default(0),
  tabelas_processadas: text('tabelas_processadas'),
  reorganizado: integer('reorganizado').default(0),
  duracao_ms: integer('duracao_ms').default(0),
});

// Registro de IDs deletados (evita re-importação automática)
export const registroEventosDeletados = pgTable('registro_eventos_deletados', {
  id: text('id').primaryKey(),
  deletado_em: text('deletado_em'),
});

// Metadados internos de sincronização
export const syncMetadata = pgTable('sync_metadata', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// Arquivos de mídia binários persistentes (vídeos MP4/WEBM/MOV) no Cloud SQL
export const mediaFiles = pgTable('media_files', {
  filename: text('filename').primaryKey(),
  mimeType: text('mime_type').notNull().default('video/mp4'),
  sizeBytes: integer('size_bytes').notNull().default(0),
  data: bytea('data').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relações Drizzle
export const estadoRelations = relations(estado, ({ many }) => ({
  cidades: many(cidades),
}));

export const cidadesRelations = relations(cidades, ({ one }) => ({
  estadoRef: one(estado, {
    fields: [cidades.estado_id],
    references: [estado.id],
  }),
}));

export const patrocinadoresRelations = relations(patrocinadores, ({ many }) => ({
  pagamentos: many(pagamentosPix),
}));

export const pagamentosPixRelations = relations(pagamentosPix, ({ one }) => ({
  patrocinador: one(patrocinadores, {
    fields: [pagamentosPix.patrocinador_id],
    references: [patrocinadores.id],
  }),
}));
