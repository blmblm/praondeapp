// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = path.join(process.cwd(), 'praondeeu.db');

export interface SqlColumn {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

export interface SqlTableInfo {
  name: string;
  sql: string;
  columns: SqlColumn[];
  rowCount: number;
}

let dbInstance: any = null;

export function getDatabase(): any {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    initDatabase(dbInstance);
  }
  return dbInstance;
}

function initDatabase(db: any) {
  // Enable WAL mode for better concurrency and foreign keys
  try {
    db.exec('PRAGMA foreign_keys = ON;');
  } catch (e) {
    console.warn('Pragma warning:', e);
  }

  // 1. Tabela de Categorias
  db.exec(`
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT UNIQUE NOT NULL,
      descricao TEXT,
      ativa INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tabela de Estado
  db.exec(`
    CREATE TABLE IF NOT EXISTS estado (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT UNIQUE NOT NULL,
      estado TEXT NOT NULL,
      regiao TEXT,
      ativa INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE VIEW IF NOT EXISTS cidades AS SELECT * FROM estado;
    CREATE VIEW IF NOT EXISTS estados AS SELECT * FROM estado;
  `);

  // Tabela de Supervisor
  db.exec(`
    CREATE TABLE IF NOT EXISTS supervisor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT UNIQUE NOT NULL,
      senha TEXT,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Observação: O auto-seed da tabela cidades foi desativado a pedido do usuário
  // para permitir que a tabela permaneça vazia ou personalizada manualmente.
  /*
  try {
    const cidCount = db.prepare('SELECT COUNT(*) as count FROM cidades;').get() as { count: number };
    ...
  } catch (e) {}
  */

  // Seed categorias padrão se ainda não existirem
  try {
    const catCount = db.prepare('SELECT COUNT(*) as count FROM categorias;').get() as { count: number };
    if (!catCount || catCount.count === 0) {
      const insertCat = db.prepare(`
        INSERT OR IGNORE INTO categorias (nome, descricao, ativa)
        VALUES (?, ?, 1);
      `);
      const defaultCategories = [
        ['Samba e Pagode', 'Rodas de samba raiz, feijoadas e pagode 90'],
        ['Baile Nostalgia', 'Flashback anos 70, 80 e 90, disco e charme'],
        ['Baile Terceira Idade', 'Bailes da saudade, boleros e dança de salão'],
        ['Forró', 'Forró universitário, xote e baião'],
        ['Forró Pé de Serra', 'Sanfona de oito baixos, triângulo e arrasta-pé no chão batido'],
        ['Festas', 'Festas, comemorações e confraternizações'],
      ];
      for (const [name, desc] of defaultCategories) {
        insertCat.run(name, desc);
      }
      try {
        db.prepare("DELETE FROM categorias WHERE LOWER(TRIM(nome)) = 'categoria';").run();
      } catch {}
    }

    // Garantir que as categorias essenciais estejam presentes na tabela categorias e tenham suas tabelas criadas
    const ensureEssentialCategories = [
      { nome: 'Festas', descricao: 'Festas, comemorações e confraternizações' },
      { nome: 'Bailes', descricao: 'Dançar a dois, ritmos variados e salão' },
      { nome: 'Teatro', descricao: 'Peças, comédias, musicais e apresentações artísticas' },
      { nome: 'Show', descricao: 'Shows ao vivo, grandes espetáculos e concertos' },
      { nome: 'Baile Terceira Idade', descricao: 'Bailes da saudade, boleros e dança de salão' }
    ];

    for (const cat of ensureEssentialCategories) {
      try {
        const exists = db.prepare("SELECT id FROM categorias WHERE LOWER(TRIM(nome)) = LOWER(TRIM(?));").get(cat.nome) as { id: number } | undefined;
        if (!exists) {
          const res = db.prepare(`
            INSERT INTO categorias (nome, descricao, ativa)
            VALUES (?, ?, 1);
          `).run(cat.nome, cat.descricao);
          const newCatId = Number(res.lastInsertRowid);
          ensureCategoryTable(db, cat.nome, newCatId);
        }
      } catch (e) {
        console.warn(`Erro ao garantir categoria ${cat.nome}:`, e);
      }
    }
  } catch (e) {
    console.warn('Erro ao inserir categorias iniciais:', e);
  }

  // Observação: O auto-seed da tabela estado foi desativado a pedido do usuário
  // para permitir que a tabela permaneça vazia ou personalizada manualmente.
  /*
  try {
    const estCount = db.prepare('SELECT COUNT(*) as count FROM estado;').get() as { count: number };
    if (!estCount || estCount.count === 0) {
      const insertEst = db.prepare(`
        INSERT OR IGNORE INTO estado (nome, estado, regiao, ativa)
        VALUES (?, ?, ?, 1);
      `);
      const defaultEstados = [
        ['Acre', 'AC', 'Norte'],
        ['Alagoas', 'AL', 'Nordeste'],
        ['Amapá', 'AP', 'Norte'],
        ['Amazonas', 'AM', 'Norte'],
        ['Bahia', 'BA', 'Nordeste'],
        ['Ceará', 'CE', 'Nordeste'],
        ['Distrito Federal', 'DF', 'Centro-Oeste'],
        ['Espírito Santo', 'ES', 'Sudeste'],
        ['Goiás', 'GO', 'Centro-Oeste'],
        ['Maranhão', 'MA', 'Nordeste'],
        ['Mato Grosso', 'MT', 'Centro-Oeste'],
        ['Mato Grosso do Sul', 'MS', 'Centro-Oeste'],
        ['Minas Gerais', 'MG', 'Sudeste'],
        ['Pará', 'PA', 'Norte'],
        ['Paraíba', 'PB', 'Nordeste'],
        ['Paraná', 'PR', 'Sul'],
        ['Pernambuco', 'PE', 'Nordeste'],
        ['Piauí', 'PI', 'Nordeste'],
        ['Rio de Janeiro', 'RJ', 'Sudeste'],
        ['Rio Grande do Norte', 'RN', 'Nordeste'],
        ['Rio Grande do Sul', 'RS', 'Sul'],
        ['Rondônia', 'RO', 'Norte'],
        ['Roraima', 'RR', 'Norte'],
        ['Santa Catarina', 'SC', 'Sul'],
        ['São Paulo', 'SP', 'Sudeste'],
        ['Sergipe', 'SE', 'Nordeste'],
        ['Tocantins', 'TO', 'Norte'],
      ];
      for (const [nome, uf, regiao] of defaultEstados) {
        insertEst.run(nome, uf, regiao);
      }
    }
  } catch (e) {
    console.warn('Erro ao inserir estados iniciais:', e);
  }
  */

  // View e gatilhos para a tabela 'estados' (compatibilidade total com 'estados' e 'estado')
  try {
    db.exec(`
      CREATE VIEW IF NOT EXISTS estados AS SELECT id, nome, estado, regiao, ativa, criado_em FROM estado;

      CREATE TRIGGER IF NOT EXISTS trg_insert_estados INSTEAD OF INSERT ON estados
      BEGIN
        INSERT INTO estado (nome, estado, regiao, ativa) VALUES (NEW.nome, NEW.estado, NEW.regiao, coalesce(NEW.ativa, 1));
      END;

      CREATE TRIGGER IF NOT EXISTS trg_delete_estados INSTEAD OF DELETE ON estados
      BEGIN
        DELETE FROM estado WHERE id = OLD.id;
      END;

      CREATE TRIGGER IF NOT EXISTS trg_update_estados INSTEAD OF UPDATE ON estados
      BEGIN
        UPDATE estado SET nome = NEW.nome, estado = NEW.estado, regiao = NEW.regiao, ativa = NEW.ativa WHERE id = OLD.id;
      END;
    `);
  } catch (e) {
    console.warn('Erro ao criar view estados:', e);
  }

  // 2. Tabela de Anunciantes
  db.exec(`
    CREATE TABLE IF NOT EXISTS anunciantes (
      id TEXT PRIMARY KEY,
      nome TEXT,
      email TEXT UNIQUE NOT NULL,
      telefone TEXT,
      cidade TEXT,
      estado TEXT,
      verificado INTEGER DEFAULT 0,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. Tabela de Favoritos
  db.exec(`
    CREATE TABLE IF NOT EXISTS favoritos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evento_id TEXT NOT NULL,
      usuario_id TEXT NOT NULL DEFAULT 'default_user',
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(evento_id, usuario_id)
    );
  `);

  // 4. Tabela de Palavras Ignoradas (Filtro Blacklist para Sympla)
  db.exec(`
    CREATE TABLE IF NOT EXISTS palavras_ignoradas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      palavra TEXT UNIQUE NOT NULL,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migração para eventos_importados: garantir coluna estado_id, categoria_id e video_url
  try {
    const impCols = db.prepare("PRAGMA table_info(eventos_importados);").all() as { name: string }[];
    const impColNames = new Set(impCols.map(c => c.name));
    if (!impColNames.has('estado_id')) {
      db.exec("ALTER TABLE eventos_importados ADD COLUMN estado_id INTEGER REFERENCES estado(id) ON DELETE SET NULL;");
    }
    if (!impColNames.has('categoria_id')) {
      db.exec("ALTER TABLE eventos_importados ADD COLUMN categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL;");
    }
    if (!impColNames.has('video_url')) {
      db.exec("ALTER TABLE eventos_importados ADD COLUMN video_url TEXT;");
    }
    if (!impColNames.has('url')) {
      db.exec("ALTER TABLE eventos_importados ADD COLUMN url TEXT;");
    }
  } catch (e) {
    console.warn('Erro ao verificar colunas de eventos_importados:', e);
  }

  // 4. Tabela de Patrocinadores (Vitrine R$ 100)
  db.exec(`
    CREATE TABLE IF NOT EXISTS patrocinadores (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      categoria TEXT NOT NULL,
      descricao TEXT,
      telefone TEXT NOT NULL,
      endereco TEXT NOT NULL,
      cidade TEXT NOT NULL,
      estado TEXT NOT NULL,
      badge TEXT,
      latitude REAL,
      longitude REAL,
      imagem_url TEXT,
      valor_mensal REAL DEFAULT 100.0,
      ativo INTEGER DEFAULT 0,
      liberado TEXT DEFAULT 'pendente',
      status_pagamento TEXT DEFAULT 'pendente',
      protocolo TEXT,
      data_pagamento TEXT,
      data_liberacao TEXT,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: assegurar colunas liberado, protocolo, etc em bancos existentes
  try {
    const spCols = db.prepare("PRAGMA table_info(patrocinadores);").all() as { name: string }[];
    const spColNames = new Set(spCols.map(c => c.name));
    if (!spColNames.has('liberado')) {
      db.exec("ALTER TABLE patrocinadores ADD COLUMN liberado TEXT DEFAULT 'pendente';");
    }
    if (!spColNames.has('protocolo')) {
      db.exec("ALTER TABLE patrocinadores ADD COLUMN protocolo TEXT;");
    }
    if (!spColNames.has('data_pagamento')) {
      db.exec("ALTER TABLE patrocinadores ADD COLUMN data_pagamento TEXT;");
    }
    if (!spColNames.has('data_liberacao')) {
      db.exec("ALTER TABLE patrocinadores ADD COLUMN data_liberacao TEXT;");
    }
  } catch (e) {
    console.warn('Erro ao verificar colunas de patrocinadores:', e);
  }

  // 5. Tabela de Pagamentos Pix (Mercado Pago)
  db.exec(`
    CREATE TABLE IF NOT EXISTS pagamentos_pix (
      id TEXT PRIMARY KEY,
      patrocinador_id TEXT,
      mercado_pago_id TEXT,
      status TEXT DEFAULT 'pending',
      valor REAL DEFAULT 100.0,
      qr_code TEXT,
      qr_code_base64 TEXT,
      ticket_url TEXT,
      telefone_notificado TEXT,
      mensagem_enviada INTEGER DEFAULT 0,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
      pago_em TEXT,
      FOREIGN KEY (patrocinador_id) REFERENCES patrocinadores(id) ON DELETE CASCADE
    );
  `);

  // 6. Tabela de Eventos Importados da Sympla (Quarentena & Curadoria)
  db.exec(`
    CREATE TABLE IF NOT EXISTS eventos_importados (
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
      latitude VARCHAR(50),
      longitude VARCHAR(50),
      imagem_url TEXT,
      video_url TEXT,
      organizador TEXT,
      preco REAL,
      is_gratuito INTEGER DEFAULT 0,
      detalhes_preco TEXT,
      link_ingressos TEXT,
      status TEXT DEFAULT 'quarentena',
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Criar e garantir a tabela física 'eventos' e suas tabelas de categorias correspondentes
  createEventosTable(db);
  ensureAllCategoryTables(db);

  seedInitialData(db);
}

function seedInitialData(db: any) {
  try {
    const advCount = db.prepare('SELECT COUNT(*) as count FROM anunciantes;').get() as { count: number };
    if (advCount && advCount.count > 0) {
      return; // Already seeded
    }
  } catch {}

  console.log('Populando banco SQLite praondeeu.db com dados iniciais...');

  // Anunciante inicial
  const insertAdv = db.prepare(`
    INSERT OR IGNORE INTO anunciantes (id, nome, email, telefone, cidade, estado, verificado, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
  `);

  insertAdv.run(
    'adv-demo-1',
    'Amigos do Samba & Tradição',
    'contato@sambaraiz.com.br',
    '(11) 98765-4321',
    'São Paulo',
    'SP',
    1,
    new Date().toISOString()
  );

  insertAdv.run(
    'adv-demo-2',
    'Coletivo Raízes Nordestinas',
    'contato@forrodepedeserra.com.br',
    '(81) 99123-4567',
    'Recife',
    'PE',
    1,
    new Date().toISOString()
  );

  // Observação: O auto-seed dos eventos de demonstração foi desativado a pedido do usuário
  // para permitir que a tabela de eventos permaneça limpa ou receba apenas eventos reais cadastrados.
  /*
  const insertEvt = db.prepare(`
    INSERT OR IGNORE INTO eventos (
      id, anunciante_id, titulo, descricao, categoria, data_evento, horario, horario_fim,
      local_nome, endereco, cidade, estado, liberado, is_gratuito, preco, detalhes_preco,
      imagem_url, organizador, contato, tags, destaque, status, criado_em
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'S', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  const initialSeedEvents = [
    {
      id: 'evt-1',
      anunciante_id: 'adv-demo-1',
      title: 'Roda de Samba e Feijoada da Velha Guarda',
      description: 'A tradicional roda de samba com músicos de renome cantando os maiores clássicos do samba raiz, pagode 90 e partido alto. Feijoada completa servida a partir do meio-dia com chopp artesanal e ambiente coberto.',
      category: 'Samba e Pagode',
      date: '2026-09-19',
      time: '12:00',
      endTime: '20:00',
      locationName: 'Clube dos Compositores - Quadra Central',
      address: 'Rua do Samba, 240 - Bixiga',
      city: 'São Paulo',
      state: 'SP',
      isFree: 0,
      price: 45,
      priceDetails: 'R$ 45,00 com feijoada inclusa (bebidas à parte)',
      imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1000&auto=format&fit=crop',
      organizer: 'Amigos do Samba & Tradição',
      contact: '(11) 98765-4321',
      tags: JSON.stringify(['Samba Raiz', 'Pagode 90', 'Feijoada', 'Música ao Vivo']),
      featured: 1,
      status: 'ativo',
      createdAt: '2026-09-01T10:00:00Z',
    },
    {
      id: 'evt-2',
      anunciante_id: 'adv-demo-2',
      title: 'Festival Forró Pé de Serra no Candeeiro',
      description: 'Autêntico forró com sanfona de oito baixos, triângulo e zabumba até o amanhecer! Presença de trios tradicionais do Nordeste, comidas típicas e muito arrasta-pé no chão batido.',
      category: 'Forró Pé de Serra',
      date: '2026-09-25',
      time: '21:00',
      endTime: '04:30',
      locationName: 'Casa do Sertão Cultural',
      address: 'Av. das Rendeiras, 810 - Centro Cultural',
      city: 'Recife',
      state: 'PE',
      isFree: 0,
      price: 35,
      priceDetails: 'R$ 35,00 antecipado / R$ 50,00 na portaria',
      imageUrl: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?q=80&w=1000&auto=format&fit=crop',
      organizer: 'Coletivo Raízes Nordestinas',
      contact: 'contato@forrodepedeserra.com.br',
      tags: JSON.stringify(['Sanfona', 'Arrasta-pé', 'Zabumba', 'Xote', 'Baião']),
      featured: 1,
      status: 'ativo',
      createdAt: '2026-09-02T12:00:00Z',
    },
    {
      id: 'evt-3',
      anunciante_id: null,
      title: 'Noite Nostalgia: Flashback Anos 70, 80 e 90',
      description: 'A pista vai ferver com os maiores sucessos da Disco Music, Pop Retrô, Eurodance, Charme e Rock clássico com os lendários DJs originais da época, globo espelhado e iluminação de época.',
      category: 'Baile Nostalgia',
      date: '2026-09-26',
      time: '22:00',
      endTime: '05:00',
      locationName: 'Clube Atlético Juventus - Salão Nobre',
      address: 'Rua Comendador Roberto Ugolini, 20 - Mooca',
      city: 'São Paulo',
      state: 'SP',
      isFree: 0,
      price: 40,
      priceDetails: 'R$ 40,00 pista / Camarote R$ 80,00',
      imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1000&auto=format&fit=crop',
      organizer: 'Produções Retrô & Flash Hits',
      contact: '(11) 97123-9988',
      tags: JSON.stringify(['Flashback', 'Anos 80', 'Disco', 'Charme', 'DJs']),
      featured: 1,
      status: 'ativo',
      createdAt: '2026-09-03T14:00:00Z',
    },
    {
      id: 'evt-4',
      anunciante_id: null,
      title: 'Tarde Dourada: Baile da Saudade da 3ª Idade',
      description: 'Um encontro acolhedor com música ao vivo (boleros, serestas, valsa e samba de gafieira) com pista de dança espaçosa, professores de dança de salão para conduzir a pista e café colonial da tarde incluso.',
      category: 'Baile Terceira Idade',
      date: '2026-09-27',
      time: '14:00',
      endTime: '19:00',
      locationName: 'Centro de Convivência Primavera',
      address: 'Alameda das Rosas, 310 - Jardim América',
      city: 'Campinas',
      state: 'SP',
      isFree: 0,
      price: 25,
      priceDetails: 'R$ 25,00 (acompanha mesa de café da tarde com bolos e frutas)',
      imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1000&auto=format&fit=crop',
      organizer: 'Associação Vida Ativa & Melhor Idade',
      contact: '(19) 3254-9800',
      tags: JSON.stringify(['Bolero', 'Dança de Salão', 'Café Colonial', 'Melhor Idade']),
      featured: 0,
      status: 'ativo',
      createdAt: '2026-09-04T09:00:00Z',
    },
    {
      id: 'evt-5',
      anunciante_id: null,
      title: 'Circuito Forró Universitário & Raiz',
      description: 'Grandes nomes do forró contemporâneo e tradicional se unem em 2 palcos temáticos. Workshops gratuitos de dança às 19h para iniciantes e casais.',
      category: 'Forró',
      date: '2026-10-02',
      time: '19:00',
      endTime: '03:00',
      locationName: 'Espaço Arena Cultural',
      address: 'Rua das Palmeiras, 1500 - Vila Madalena',
      city: 'São Paulo',
      state: 'SP',
      isFree: 0,
      price: 30,
      priceDetails: 'R$ 30,00 antecipado com 1 drink de boas-vindas',
      imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1000&auto=format&fit=crop',
      organizer: 'Forró da Garoa Produções',
      contact: 'contato@forrodagaroa.com',
      tags: JSON.stringify(['Forró Universitário', 'Aulas de Dança', 'Dois Palcos']),
      featured: 0,
      status: 'ativo',
      createdAt: '2026-09-05T16:00:00Z',
    },
    {
      id: 'evt-6',
      anunciante_id: null,
      title: 'Show Especial Voz e Violão: Clássicos da MPB e Samba',
      description: 'Apresentação intimista com intérpretes consagrados revisitando Tom Jobim, Cartola, Chico Buarque, Elis Regina e Paulinho da Viola em arranjos acústicos.',
      category: 'Shows',
      date: '2026-10-10',
      time: '20:30',
      endTime: '23:30',
      locationName: 'Teatro Musical Santa Cecília',
      address: 'Praça da Matriz, 45 - Centro Histórico',
      city: 'Belo Horizonte',
      state: 'MG',
      isFree: false,
      price: 60,
      priceDetails: 'R$ 60,00 inteira / R$ 30,00 meia-entrada',
      imageUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=1000&auto=format&fit=crop',
      organizer: 'Minas Acústica Entretenimento',
      contact: '(31) 98877-6655',
      tags: JSON.stringify(['MPB', 'Voz e Violão', 'Teatro', 'Acústico']),
      featured: 1,
      status: 'ativo',
      createdAt: '2026-09-06T11:00:00Z',
    }
  ];

  for (const item of initialSeedEvents) {
    insertEvt.run(
      item.id,
      item.anunciante_id,
      item.title,
      item.description,
      item.category,
      item.date,
      item.time,
      item.endTime,
      item.locationName,
      item.address,
      item.city,
      item.state,
      item.isFree ? 1 : 0,
      item.price || 0,
      item.priceDetails || '',
      item.imageUrl,
      item.organizer,
      item.contact,
      item.tags,
      item.featured ? 1 : 0,
      item.status,
      item.createdAt
    );
  }
  */
}

export function executeSqlQuery(sql: string, params: any[] = []) {
  const db = getDatabase();
  let trimmed = sql.trim();

  // 0. Normaliza aspas curvas (smart quotes comuns ao copiar/colar de chats ou celulares)
  trimmed = trimmed.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  // 1. Tratamento e normalização inteligente de sintaxe (especialmente comandos DELETE / TRUNCATE)
  // a) "TRUNCATE TABLE table" ou "TRUNCATE table" -> "DELETE FROM table" (SQLite não tem TRUNCATE nativo)
  trimmed = trimmed.replace(/\bTRUNCATE\s+(?:TABLE\s+)?([a-zA-Z0-9_]+)\b/gi, 'DELETE FROM $1');

  // b) "DELETE * FROM table" -> "DELETE FROM table" (erro comum de sintaxe)
  trimmed = trimmed.replace(/\bDELETE\s+\*\s+FROM\b/gi, 'DELETE FROM');

  // c) "DELETE table WHERE" (sem o FROM) -> "DELETE FROM table WHERE"
  trimmed = trimmed.replace(/\bDELETE\s+(?!FROM\b)([a-zA-Z0-9_]+)\b/gi, 'DELETE FROM $1');

  // e) Auto-correção de IDs alfanuméricos com hífens sem aspas (ex: WHERE id = user-1789409044377 ou evt-sympla-...)
  trimmed = trimmed.replace(
    /\b(id\s*=\s*)([a-zA-Z][a-zA-Z0-9_\-\.]+)(?=\s*(?:;|$|\)|AND|OR))/gi,
    "$1'$2'"
  );

  // f) Auto-correção de aspas duplas em valores de texto após =, !=, <>, LIKE, IN
  trimmed = trimmed.replace(
    /(=|!=|<>|LIKE)\s*"([^"]+)"/gi,
    "$1 '$2'"
  );

  // g) Se a query for DELETE na view unificada v_eventos_completos, sincroniza com as tabelas de categorias e favoritos
  if (/\bDELETE\s+FROM\s+v_eventos_completos\b/i.test(trimmed)) {
    try {
      const idMatch = trimmed.match(/id\s*=\s*['"]?([a-zA-Z0-9_\-\.]+)['"]?/i);
      if (idMatch && idMatch[1]) {
        try { db.prepare('DELETE FROM favoritos WHERE evento_id = ?;').run(idMatch[1]); } catch {}
        const deleted = deleteEventFromCategoryTables(db, idMatch[1]);
        return { type: 'delete', changes: Math.max(1, deleted) };
      } else {
        try { db.prepare('DELETE FROM favoritos;').run(); } catch {}
        const deleted = deleteEventsFromCategoryTables(db);
        return { type: 'delete', changes: deleted };
      }
    } catch (eDel) {
      console.warn('Erro ao processar DELETE de v_eventos_completos:', eDel);
    }
  }

  const isSelect = /^\s*(SELECT|PRAGMA|EXPLAIN)\b/i.test(trimmed);

  if (isSelect) {
    try {
      const stmt = db.prepare(trimmed);
      const rows = stmt.all(...params);
      return {
        type: 'select',
        rowCount: rows.length,
        rows,
      };
    } catch (err: any) {
      if (err.message && (err.message.includes('should this be a string literal in single-quotes') || err.message.includes('no such column'))) {
        // Tenta auto-corrigir aspas duplas para simples se for um literal de string
        const fixedSql = trimmed.replace(/"([^"]+)"/g, "'$1'");
        try {
          const stmt = db.prepare(fixedSql);
          const rows = stmt.all(...params);
          return {
            type: 'select',
            rowCount: rows.length,
            rows,
            autoFixedQuotes: true,
          };
        } catch {
          throw err;
        }
      }
      throw err;
    }
  } else {
    // Check if it has multiple statements separated by semicolons (e.g., DDL script or batch DELETE/UPDATE)
    const statements = trimmed
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (statements.length > 1) {
      let runSql = trimmed;
      try {
        db.exec(runSql);
      } catch (err: any) {
        if (err.message && (err.message.includes('should this be a string literal in single-quotes') || err.message.includes('no such column'))) {
          runSql = runSql.replace(/"([^"]+)"/g, "'$1'");
          db.exec(runSql);
        } else {
          throw err;
        }
      }
      const changesRow = db.prepare('SELECT changes() as c;').get() as any;
      return {
        type: 'exec',
        message: `${statements.length} comandos SQL executados com sucesso.`,
        changes: changesRow?.c || 0,
      };
    }

    try {
      // Se for exclusão de evento específico por ID, limpa favoritos desse evento primeiro
      if (/\bDELETE\s+FROM\s+eventos\s+WHERE\b/i.test(trimmed)) {
        const idMatch = trimmed.match(/id\s*=\s*'([^']+)'/i);
        if (idMatch && idMatch[1]) {
          try {
            db.prepare('DELETE FROM favoritos WHERE evento_id = ?;').run(idMatch[1]);
          } catch {
            // ignore
          }
        }
      }

      const cleanStmt = trimmed.replace(/;+$/, '').trim();
      const stmt = db.prepare(cleanStmt);
      const result = stmt.run(...params);
      return {
        type: 'mutate',
        message: 'Comando SQL executado com sucesso.',
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid,
      };
    } catch (err: any) {
      if (err.message && (err.message.includes('should this be a string literal in single-quotes') || err.message.includes('no such column'))) {
        let fixedSql = trimmed.replace(/"([^"]+)"/g, "'$1'");
        fixedSql = fixedSql.replace(
          /\b([a-zA-Z_]+)\s*=\s*([a-zA-Z][a-zA-Z0-9_\-\.]+)(?=\s*(?:;|$|\)|AND|OR))/gi,
          "$1 = '$2'"
        );
        try {
          const cleanFixed = fixedSql.replace(/;+$/, '').trim();
          const stmt = db.prepare(cleanFixed);
          const result = stmt.run(...params);
          return {
            type: 'mutate',
            message: 'Comando SQL executado com sucesso (valores ajustados automaticamente).',
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid,
          };
        } catch {
          throw err;
        }
      }
      throw err;
    }
  }
}

export function getDatabaseSchema(): SqlTableInfo[] {
  const db = getDatabase();
  const tables = db.prepare(`
    SELECT name, sql 
    FROM sqlite_master 
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%';
  `).all() as { name: string; sql: string }[];

  const orderPriority: Record<string, number> = {
    'eventos': 1,
    'categorias': 2,
    'estado': 3,
    'anunciantes': 4,
    'supervisor': 5,
    'patrocinadores': 6,
    'pagamentos_pix': 7,
    'eventos_importados': 8,
    'favoritos': 9,
  };

  tables.sort((a, b) => {
    const pA = orderPriority[a.name] ?? 50;
    const pB = orderPriority[b.name] ?? 50;
    if (pA !== pB) return pA - pB;
    return a.name.localeCompare(b.name);
  });

  return tables.map((t) => {
    const columns = db.prepare(`PRAGMA table_info(${t.name});`).all() as SqlColumn[];
    const countResult = db.prepare(`SELECT COUNT(*) as count FROM ${t.name};`).get() as { count: number };
    return {
      name: t.name,
      sql: t.sql,
      columns,
      rowCount: countResult ? countResult.count : 0,
    };
  });
}

// Função de reconciliação das outras tabelas (a tabela eventos permanece 100% autônoma e desvinculada)
export function syncEventsRelations(): {
  totalEvents: number;
  syncedCategories: number;
  syncedEstados: number;
  syncedAdvertisers: number;
  importedSynced: number;
  newCategoriesCreated: number;
} {
  const db = getDatabase();

  // A tabela 'eventos' é 100% autônoma e desvinculada das outras tabelas.
  // Sincroniza apenas a tabela quarentena (eventos_importados) com categorias e estado
  const impUpdate = db.prepare(`
    UPDATE eventos_importados
    SET 
      categoria_id = (
        SELECT c.id FROM categorias c 
        WHERE LOWER(TRIM(c.nome)) = LOWER(TRIM(eventos_importados.categoria))
           OR (LOWER(TRIM(c.nome)) IN ('show', 'shows') AND LOWER(TRIM(eventos_importados.categoria)) IN ('show', 'shows'))
        LIMIT 1
      ),
      estado_id = (
        SELECT est.id FROM estado est 
        WHERE UPPER(TRIM(est.estado)) = UPPER(TRIM(eventos_importados.estado)) 
           OR UPPER(TRIM(est.nome)) = UPPER(TRIM(eventos_importados.estado))
           OR UPPER(TRIM(est.nome)) = UPPER(TRIM(eventos_importados.cidade))
        LIMIT 1
      )
    WHERE categoria_id IS NULL OR estado_id IS NULL;
  `).run();

  const totalEvents = (db.prepare('SELECT COUNT(*) as c FROM eventos;').get() as any)?.c || 0;

  // Garante que todas as tabelas dedicadas por categoria existam
  ensureAllCategoryTables(db);

  return {
    totalEvents,
    syncedCategories: 0,
    syncedEstados: 0,
    syncedAdvertisers: 0,
    importedSynced: impUpdate.changes,
    newCategoriesCreated: 0,
  };
}

/**
 * Retorna o nome da tabela dedicada em SQLite para uma categoria específica.
 * Exemplo: 'Samba e Pagode' -> 'eventos_samba_e_pagode'
 *          'Show' -> 'eventos_show'
 */
export function getCategoryTableName(categoryName: string): string {
  let clean = (categoryName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (clean === 'shows') clean = 'show';
  clean = clean
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `eventos_${clean || 'geral'}`;
}

/**
 * Cria e configura a tabela dedicada para o registro de uma categoria com base
 * rigorosamente nos campos da tabela Eventos, incluindo índices de alta performance
 * e triggers de sincronização bidirecional em tempo real com a tabela mestre 'eventos'.
 */
export function ensureCategoryTable(
  db: any,
  categoryName: string,
  categoryId?: number
): { tableName: string; rowCount: number } {
  if (!categoryName || !categoryName.trim()) {
    return { tableName: 'eventos', rowCount: 0 };
  }
  const cleanName = categoryName.trim();
  const tableName = getCategoryTableName(cleanName);

  // 1. Cria a tabela dedicada com base estrita nos campos da tabela Eventos
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
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
      endereco TEXT NOT NULL,
      cidade TEXT NOT NULL,
      estado TEXT NOT NULL,
      estado_id INTEGER,
      latitude VARCHAR(50),
      longitude VARCHAR(50),
      liberado VARCHAR(1) DEFAULT 'N',
      is_gratuito INTEGER DEFAULT 0,
      preco REAL,
      detalhes_preco TEXT,
      imagem_url TEXT,
      video_url TEXT,
      url TEXT,
      organizador TEXT NOT NULL,
      contato TEXT,
      tags TEXT DEFAULT '[]',
      destaque INTEGER DEFAULT 0,
      status TEXT DEFAULT 'em_analise',
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (anunciante_id) REFERENCES anunciantes(id) ON DELETE SET NULL,
      FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL,
      FOREIGN KEY (estado_id) REFERENCES estado(id) ON DELETE SET NULL
    );

    -- Índices específicos para consultas ultra-rápidas na tabela da categoria
    CREATE INDEX IF NOT EXISTS idx_${tableName}_cat_est_data ON ${tableName} (categoria, estado, data_evento);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_cat_est_data_lib ON ${tableName} (categoria, estado, data_evento, liberado);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_data_liberado ON ${tableName} (data_evento, liberado);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_estado_data ON ${tableName} (estado, data_evento);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_cidade ON ${tableName} (cidade);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_liberado ON ${tableName} (liberado);
  `);

  // Migração suave para garantir que video_url exista
  try {
    const cCols = db.prepare(`PRAGMA table_info(${tableName});`).all() as { name: string }[];
    const cColNames = new Set(cCols.map((c: any) => c.name));
    if (!cColNames.has('video_url')) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN video_url TEXT;`);
    }
    if (!cColNames.has('url')) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN url TEXT;`);
    }
  } catch {}

  // 2. Atualiza a referência de tabela_nome no registro da categoria
  try {
    if (categoryId) {
      db.prepare(`UPDATE categorias SET tabela_nome = ? WHERE id = ?;`).run(tableName, categoryId);
    } else {
      db.prepare(`UPDATE categorias SET tabela_nome = ? WHERE LOWER(TRIM(nome)) = LOWER(TRIM(?));`).run(tableName, cleanName);
    }
  } catch {}

  // 3. Limpa quaisquer triggers obsoletos que dependiam da antiga tabela mestre
  try {
    db.exec(`
      DROP TRIGGER IF EXISTS trg_evt_ins_${tableName};
      DROP TRIGGER IF EXISTS trg_evt_upd_${tableName};
      DROP TRIGGER IF EXISTS trg_evt_del_old_${tableName};
      DROP TRIGGER IF EXISTS trg_evt_del_${tableName};
      DROP TRIGGER IF EXISTS trg_${tableName}_upd_master;
      DROP TRIGGER IF EXISTS trg_${tableName}_del_master;
    `);
  } catch (eTrg) {}

  const countRow = db.prepare(`SELECT COUNT(*) as c FROM ${tableName};`).get() as { c: number };
  return { tableName, rowCount: countRow?.c || 0 };
}

/**
 * Reconstrói a View unificada v_eventos_completos combinando todas as tabelas
 * de categorias existentes via UNION ALL. Isso permite consultas agregadas
 * sem a necessidade da tabela física 'eventos'.
 */
export function rebuildUnifiedEventsView(db: any) {
  try {
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name LIKE 'eventos_%' AND name != 'eventos_importados'
      ORDER BY name;
    `).all() as { name: string }[];

    if (tables.length === 0) {
      return;
    }

    const selectStatements = tables.map(t => `
      SELECT 
        e.id,
        e.anunciante_id,
        e.categoria_id,
        e.categoria,
        e.titulo,
        e.descricao,
        e.data_evento,
        e.horario,
        e.horario_fim,
        e.local_nome,
        e.endereco,
        e.cidade,
        e.estado,
        e.estado_id,
        e.latitude,
        e.longitude,
        e.liberado,
        e.is_gratuito,
        e.preco,
        e.detalhes_preco,
        e.imagem_url,
        e.video_url,
        e.url,
        e.organizador,
        e.contato,
        e.tags,
        e.destaque,
        e.status,
        e.criado_em,
        COALESCE(c.nome, e.categoria) AS categoria_oficial_nome,
        c.descricao AS categoria_descricao,
        c.ativa AS categoria_ativa,
        a.nome AS anunciante_nome,
        a.email AS anunciante_email,
        a.telefone AS anunciante_telefone,
        a.verificado AS anunciante_verificado,
        est.nome AS estado_nome_completo,
        est.regiao AS estado_regiao
      FROM ${t.name} e
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
    `);

    db.exec(`
      DROP VIEW IF EXISTS v_eventos_completos;
      CREATE VIEW v_eventos_completos AS
      ${selectStatements.join('\nUNION ALL\n')};
    `);
    console.log(`[Database] View v_eventos_completos reconstruída com sucesso sobre ${tables.length} tabelas de categorias.`);
  } catch (err) {
    console.warn('[Database] Erro ao reconstruir view v_eventos_completos:', err);
  }
}

/**
 * Cria a tabela física 'eventos' de forma 100% autônoma e desvinculada das outras tabelas
 * (sem chaves estrangeiras, sem triggers e sem cópia automática das tabelas de categorias).
 * É mantida separada e dedicada exclusivamente para quando os usuários divulgarem os eventos.
 */
export function createEventosTable(db: any): { created: boolean; rowCount: number } {
  try {
    // 1. Criação física da tabela eventos totalmente independente (sem FOREIGN KEYs vinculadas)
    db.exec(`
      CREATE TABLE IF NOT EXISTS eventos (
        id TEXT PRIMARY KEY,
        anunciante_id TEXT,
        categoria_id INTEGER,
        categoria TEXT,
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
        latitude VARCHAR(50),
        longitude VARCHAR(50),
        liberado VARCHAR(1) DEFAULT 'N',
        is_gratuito INTEGER DEFAULT 0,
        preco REAL DEFAULT 0,
        detalhes_preco TEXT,
        imagem_url TEXT,
        video_url TEXT,
        url TEXT,
        organizador TEXT,
        contato TEXT,
        tags TEXT DEFAULT '[]',
        destaque INTEGER DEFAULT 0,
        status TEXT DEFAULT 'em_analise',
        criado_em TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_eventos_categoria ON eventos (categoria);
      CREATE INDEX IF NOT EXISTS idx_eventos_categoria_id ON eventos (categoria_id);
      CREATE INDEX IF NOT EXISTS idx_eventos_data_evento ON eventos (data_evento);
      CREATE INDEX IF NOT EXISTS idx_eventos_cidade ON eventos (cidade);
      CREATE INDEX IF NOT EXISTS idx_eventos_estado ON eventos (estado);
      CREATE INDEX IF NOT EXISTS idx_eventos_liberado ON eventos (liberado);
      CREATE INDEX IF NOT EXISTS idx_eventos_criado_em ON eventos (criado_em);

      -- View e triggers para a tabela 'evento' (singular) sincronizada com 'eventos'
      CREATE VIEW IF NOT EXISTS evento AS SELECT * FROM eventos;

      CREATE TRIGGER IF NOT EXISTS trg_evento_insert INSTEAD OF INSERT ON evento
      BEGIN
        INSERT INTO eventos (
          id, anunciante_id, categoria_id, categoria, titulo, descricao, data_evento,
          horario, horario_fim, local_nome, endereco, cidade, estado, estado_id, latitude, longitude,
          liberado, is_gratuito, preco, detalhes_preco, imagem_url, video_url, url, organizador, contato,
          tags, destaque, status, criado_em
        ) VALUES (
          NEW.id, NEW.anunciante_id, NEW.categoria_id, NEW.categoria, NEW.titulo, NEW.descricao, NEW.data_evento,
          NEW.horario, NEW.horario_fim, NEW.local_nome, NEW.endereco, NEW.cidade, NEW.estado, NEW.estado_id, NEW.latitude, NEW.longitude,
          NEW.liberado, NEW.is_gratuito, NEW.preco, NEW.detalhes_preco, NEW.imagem_url, NEW.video_url, NEW.url, NEW.organizador, NEW.contato,
          NEW.tags, NEW.destaque, NEW.status, NEW.criado_em
        );
      END;

      CREATE TRIGGER IF NOT EXISTS trg_evento_delete INSTEAD OF DELETE ON evento
      BEGIN
        DELETE FROM eventos WHERE id = OLD.id;
      END;
    `);

    try {
      const evCols = db.prepare("PRAGMA table_info(eventos);").all() as { name: string }[];
      const evColNames = new Set(evCols.map((c: any) => c.name));
      if (!evColNames.has('video_url')) {
        db.exec("ALTER TABLE eventos ADD COLUMN video_url TEXT;");
      }
      if (!evColNames.has('url')) {
        db.exec("ALTER TABLE eventos ADD COLUMN url TEXT;");
      }
    } catch {}

    const countRow = db.prepare('SELECT COUNT(*) as c FROM eventos;').get() as { c: number };
    console.log(`[Database] Tabela "eventos" independente pronta! Total de registros: ${countRow?.c || 0}`);
    return { created: true, rowCount: countRow?.c || 0 };
  } catch (err) {
    console.error('[Database] Erro ao criar tabela eventos independente:', err);
    return { created: false, rowCount: 0 };
  }
}

/**
 * Exclui em definitivo a tabela física eventos e todos os seus triggers e índices.
 */
export function dropEventosTable(db: any) {
  try {
    // 1. Garante que todos os eventos estejam salvos em suas tabelas de categoria antes do drop
    ensureAllCategoryTables(db);

    // 2. Remove triggers obsoletos vinculados à tabela eventos
    db.exec(`
      DROP TRIGGER IF EXISTS trg_eventos_sync_relations_insert;
      DROP TRIGGER IF EXISTS trg_eventos_sync_relations_update;
      DROP TRIGGER IF EXISTS trg_v_eventos_completos_delete;
      DROP TRIGGER IF EXISTS trg_v_eventos_completos_update;
      DROP TABLE IF EXISTS eventos;
    `);

    // 3. Reconstrói a view unificada
    rebuildUnifiedEventsView(db);
    console.log('[Database] Tabela "eventos" excluída com sucesso! Todos os eventos residem exclusivamente nas tabelas de categorias.');
  } catch (err) {
    console.warn('[Database] Erro ao excluir tabela eventos:', err);
  }
}

/**
 * Deleta um evento pelo seu ID exclusivamente nas tabelas de categoria (sem tocar na tabela autônoma eventos).
 */
export function deleteEventFromCategoryTables(db: any, id: string): number {
  let totalDeleted = 0;
  try {
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name LIKE 'eventos_%' AND name != 'eventos_importados';
    `).all() as { name: string }[];
    for (const t of tables) {
      const res = db.prepare(`DELETE FROM ${t.name} WHERE id = ?;`).run(id);
      totalDeleted += res.changes;
    }
  } catch (err) {
    console.warn('Erro ao deletar evento das tabelas de categoria:', err);
  }
  return totalDeleted;
}

/**
 * Deleta eventos em lote ou por categoria/status de liberação exclusivamente nas tabelas dedicadas de categorias (sem tocar na tabela autônoma eventos).
 */
export function deleteEventsFromCategoryTables(
  db: any,
  options?: { ids?: string[]; category?: string; pendingOnly?: boolean }
): number {
  let totalDeleted = 0;
  try {
    const { ids, category, pendingOnly } = options || {};

    let tablesToClean: string[] = [];
    if (category && category !== 'Todas') {
      const { tableName } = ensureCategoryTable(db, category);
      tablesToClean = [tableName];
    } else {
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name LIKE 'eventos_%' AND name != 'eventos_importados';
      `).all() as { name: string }[];
      tablesToClean = tables.map(t => t.name);
    }

    for (const t of tablesToClean) {
      if (Array.isArray(ids) && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        const res = db.prepare(`DELETE FROM ${t} WHERE id IN (${placeholders});`).run(...ids);
        totalDeleted += res.changes;
      } else if (pendingOnly) {
        const res = db.prepare(`DELETE FROM ${t} WHERE liberado != 'S' OR liberado IS NULL OR liberado = '';`).run();
        totalDeleted += res.changes;
      } else {
        const res = db.prepare(`DELETE FROM ${t};`).run();
        totalDeleted += res.changes;
      }
    }
  } catch (err) {
    console.warn('Erro ao excluir eventos das tabelas dedicadas:', err);
  }
  return totalDeleted;
}

/**
 * Salva um evento exclusivamente na tabela dedicada da sua categoria.
 */
export function saveEventToCategoryTable(db: any, eventData: any): { tableName: string; id: string } {
  const categoryName = (eventData.categoria || eventData.category || 'Show').trim();
  const categoryId = eventData.categoria_id || eventData.categoryId || null;
  const { tableName } = ensureCategoryTable(db, categoryName, categoryId);

  // Insere ou atualiza diretamente na tabela da categoria
  const stmtCat = db.prepare(`
    INSERT INTO ${tableName} (
      id, anunciante_id, categoria_id, categoria, titulo, descricao, data_evento,
      horario, horario_fim, local_nome, endereco, cidade, estado, estado_id, latitude, longitude,
      liberado, is_gratuito, preco, detalhes_preco, imagem_url, video_url, url, organizador, contato,
      tags, destaque, status, criado_em
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      liberado = excluded.liberado,
      is_gratuito = excluded.is_gratuito,
      preco = excluded.preco,
      detalhes_preco = excluded.detalhes_preco,
      imagem_url = CASE 
        WHEN excluded.imagem_url IS NOT NULL AND excluded.imagem_url != '' THEN excluded.imagem_url 
        ELSE imagem_url 
      END,
      video_url = CASE 
        WHEN excluded.video_url IS NOT NULL AND excluded.video_url != '' AND excluded.video_url != '[video_local_sqlite]' THEN excluded.video_url 
        ELSE video_url 
      END,
      url = CASE 
        WHEN excluded.url IS NOT NULL AND excluded.url != '' AND excluded.url != '[video_local_sqlite]' THEN excluded.url 
        ELSE url 
      END,
      organizador = excluded.organizador,
      contato = excluded.contato,
      tags = excluded.tags,
      destaque = excluded.destaque,
      status = excluded.status;
  `);

  const tagsStr = typeof eventData.tags === 'string' ? eventData.tags : JSON.stringify(eventData.tags || []);
  const estadoId = eventData.estado_id || eventData.estadoId || null;

  const rawImg = String(eventData.imagem_url || eventData.imageUrl || '').trim();
  const cleanImg = (rawImg.startsWith('http://') || rawImg.startsWith('https://') || rawImg.startsWith('data:image/')) ? rawImg : '';
  const rawVid = String(eventData.video_url || eventData.videoUrl || eventData.video_utl || eventData.Video_url || '').trim();
  const rawUrl = String(eventData.url || eventData.Url || '').trim();

  const isVideo = Boolean(
    rawVid ||
    eventData.mediaType === 'video' ||
    (rawUrl && (
      rawUrl.startsWith('data:video/') ||
      rawUrl.includes('youtube.com') ||
      rawUrl.includes('youtu.be') ||
      rawUrl.includes('facebook.com') ||
      rawUrl.includes('fb.watch') ||
      rawUrl.includes('fb.') ||
      rawUrl.includes('.mp4') ||
      rawUrl.includes('.webm') ||
      rawUrl.includes('vimeo.com')
    ))
  );

  const videoUrl = isVideo ? (rawVid || rawUrl) : null;
  // Quando for vídeo, grava a URL do vídeo no campo URL e no campo Video_url!
  // Quando não for vídeo, grava a URL do evento ou a imagem cadastrada (NUNCA imagem default)
  const mainUrl = isVideo ? (rawVid || rawUrl) : (rawUrl || cleanImg || null);

  const params = [
    eventData.id,
    eventData.anunciante_id || eventData.advertiserId || null,
    categoryId,
    categoryName,
    eventData.titulo || eventData.title,
    eventData.descricao || eventData.description || '',
    eventData.data_evento || eventData.date,
    eventData.horario || eventData.time,
    eventData.horario_fim || eventData.endTime || null,
    eventData.local_nome || eventData.locationName || '',
    eventData.endereco || eventData.address || '',
    eventData.cidade || eventData.city || '',
    eventData.estado || eventData.state || '',
    estadoId,
    eventData.latitude ? String(eventData.latitude) : null,
    eventData.longitude ? String(eventData.longitude) : null,
    eventData.liberado !== undefined && eventData.liberado !== null && eventData.liberado !== '' ? eventData.liberado : 'N',
    eventData.is_gratuito || eventData.isFree ? 1 : 0,
    eventData.preco ?? eventData.price ?? 0,
    eventData.detalhes_preco || eventData.priceDetails || '',
    cleanImg,
    videoUrl,
    mainUrl,
    eventData.organizador || eventData.organizer || '',
    eventData.contato || eventData.contact || '',
    tagsStr,
    eventData.destaque ? 1 : 0,
    eventData.status || 'em_analise',
    eventData.criado_em || eventData.createdAt || new Date().toISOString()
  ];

  stmtCat.run(...params);
  return { tableName, id: eventData.id };
}

/**
 * Salva um evento na tabela autônoma 'eventos' quando os usuários divulgarem os eventos.
 * Esta tabela é desvinculada das outras tabelas.
 */
export function saveUserEvent(db: any, eventData: any): { id: string } {
  createEventosTable(db);

  const stmtEvt = db.prepare(`
    INSERT INTO eventos (
      id, anunciante_id, categoria_id, categoria, titulo, descricao, data_evento,
      horario, horario_fim, local_nome, endereco, cidade, estado, estado_id, latitude, longitude,
      liberado, is_gratuito, preco, detalhes_preco, imagem_url, video_url, url, organizador, contato,
      tags, destaque, status, criado_em
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      anunciante_id = excluded.anunciante_id,
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
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      liberado = excluded.liberado,
      is_gratuito = excluded.is_gratuito,
      preco = excluded.preco,
      detalhes_preco = excluded.detalhes_preco,
      imagem_url = CASE 
        WHEN excluded.imagem_url IS NOT NULL AND excluded.imagem_url != '' THEN excluded.imagem_url 
        ELSE imagem_url 
      END,
      video_url = CASE 
        WHEN excluded.video_url IS NOT NULL AND excluded.video_url != '' AND excluded.video_url != '[video_local_sqlite]' THEN excluded.video_url 
        ELSE video_url 
      END,
      url = CASE 
        WHEN excluded.url IS NOT NULL AND excluded.url != '' AND excluded.url != '[video_local_sqlite]' THEN excluded.url 
        ELSE url 
      END,
      organizador = excluded.organizador,
      contato = excluded.contato,
      tags = excluded.tags,
      destaque = excluded.destaque,
      status = excluded.status;
  `);

  const id = String(eventData.id || `evt-${Date.now()}`);
  const title = String(eventData.titulo || eventData.title || 'Evento sem título').trim();
  const date = String(eventData.data_evento || eventData.date || new Date().toISOString().split('T')[0]).trim();
  const time = String(eventData.horario || eventData.time || '19:00').trim();
  const location = String(eventData.local_nome || eventData.locationName || 'Local a definir').trim();
  const city = String(eventData.cidade || eventData.city || 'São Paulo').trim();
  const state = String(eventData.estado || eventData.state || 'SP').trim();
  const liberado = eventData.liberado !== undefined && eventData.liberado !== null && String(eventData.liberado).trim() !== '' ? String(eventData.liberado).trim() : 'N';
  const status = eventData.status || (liberado === 'S' ? 'aprovado' : 'em_analise');

  const tagsStr = typeof eventData.tags === 'string' ? eventData.tags : JSON.stringify(eventData.tags || []);
  const estadoId = eventData.estado_id || eventData.estadoId || null;
  const categoryId = eventData.categoria_id || eventData.categoryId || null;
  const categoryName = (eventData.categoria || eventData.category || 'Geral').trim();

  const rawImg = String(eventData.imagem_url || eventData.imageUrl || '').trim();
  const cleanImg = (rawImg.startsWith('http://') || rawImg.startsWith('https://') || rawImg.startsWith('data:image/')) ? rawImg : '';
  const rawVid = String(eventData.video_url || eventData.videoUrl || eventData.video_utl || eventData.Video_url || '').trim();
  const rawUrl = String(eventData.url || eventData.Url || '').trim();

  const isVideo = Boolean(
    rawVid ||
    eventData.mediaType === 'video' ||
    (rawUrl && (
      rawUrl.startsWith('data:video/') ||
      rawUrl.includes('youtube.com') ||
      rawUrl.includes('youtu.be') ||
      rawUrl.includes('facebook.com') ||
      rawUrl.includes('fb.watch') ||
      rawUrl.includes('fb.') ||
      rawUrl.includes('.mp4') ||
      rawUrl.includes('.webm') ||
      rawUrl.includes('vimeo.com')
    ))
  );

  const finalVideoUrl = isVideo ? (rawVid || rawUrl) : null;
  const mainUrl = isVideo ? (rawVid || rawUrl) : (rawUrl || cleanImg || null);

  stmtEvt.run(
    id,
    eventData.anunciante_id || eventData.advertiserId || null,
    categoryId,
    categoryName,
    title,
    eventData.descricao || eventData.description || '',
    date,
    time,
    eventData.horario_fim || eventData.endTime || null,
    location,
    eventData.endereco || eventData.address || '',
    city,
    state,
    estadoId,
    eventData.latitude ? String(eventData.latitude) : null,
    eventData.longitude ? String(eventData.longitude) : null,
    liberado,
    eventData.is_gratuito || eventData.isFree ? 1 : 0,
    eventData.preco ?? eventData.price ?? 0,
    eventData.detalhes_preco || eventData.priceDetails || '',
    cleanImg,
    finalVideoUrl,
    mainUrl,
    eventData.organizador || eventData.organizer || '',
    eventData.contato || eventData.contact || '',
    tagsStr,
    eventData.destaque || eventData.featured ? 1 : 0,
    status,
    eventData.criado_em || eventData.createdAt || new Date().toISOString()
  );

  return { id };
}

/**
 * Itera sobre todas as categorias da tabela 'categorias' e cria/garante a tabela dedicada
 * de cada uma no banco de dados SQLite e reconstrói a view unificada.
 */
export function ensureAllCategoryTables(db: any): { totalTables: number; tables: string[] } {
  const createdTables: string[] = [];
  try {
    // 1. Garante que a coluna tabela_nome exista na tabela categorias
    const catCols = db.prepare("PRAGMA table_info(categorias);").all() as { name: string }[];
    const catColNames = new Set(catCols.map(c => c.name));
    if (!catColNames.has('tabela_nome')) {
      db.exec("ALTER TABLE categorias ADD COLUMN tabela_nome TEXT;");
    }

    // 2. Busca todas as categorias existentes
    const allCats = db.prepare(`SELECT id, nome FROM categorias;`).all() as { id: number; nome: string }[];
    for (const cat of allCats) {
      const res = ensureCategoryTable(db, cat.nome, cat.id);
      createdTables.push(res.tableName);
    }

    // 3. Reconstrói a view agregada v_eventos_completos
    rebuildUnifiedEventsView(db);
  } catch (err) {
    console.warn('[CategoryTables] Erro ao sincronizar tabelas dedicadas de categorias:', err);
  }

  return {
    totalTables: createdTables.length,
    tables: createdTables,
  };
}

/**
 * Atualiza o campo URL (e correspondentes video_url / imagem_url)
 * em todas as tabelas correspondentes (eventos, categoria dedicada e eventos_importados).
 */
export function updateEventUrlInAllTables(
  db: any,
  id: string,
  rawUrl: string,
  urlType?: 'video' | 'image' | 'link'
): { success: boolean; id: string; url: string; videoUrl: string | null; imageUrl: string | null; updatedTables: string[] } {
  const cleanUrl = (rawUrl || '').trim();
  const isVideo = urlType === 'video' || (
    cleanUrl.startsWith('data:video/') ||
    cleanUrl.includes('youtube.com') ||
    cleanUrl.includes('youtu.be') ||
    cleanUrl.includes('facebook.com') ||
    cleanUrl.includes('fb.watch') ||
    cleanUrl.includes('.mp4') ||
    cleanUrl.includes('.webm') ||
    cleanUrl.includes('vimeo.com')
  );
  const isImage = urlType === 'image' || (
    cleanUrl.startsWith('data:image/') ||
    cleanUrl.includes('.jpg') ||
    cleanUrl.includes('.jpeg') ||
    cleanUrl.includes('.png') ||
    cleanUrl.includes('.webp') ||
    cleanUrl.includes('.gif')
  );

  const videoUrl = isVideo ? cleanUrl : null;
  const imageUrl = isImage ? cleanUrl : null;
  const updatedTables: string[] = [];

  // 1. Atualizar na tabela autônoma 'eventos'
  try {
    createEventosTable(db);
    let sqlEvt = "UPDATE eventos SET url = ?";
    const paramsEvt: any[] = [cleanUrl];
    if (videoUrl) {
      sqlEvt += ", video_url = ?";
      paramsEvt.push(videoUrl);
    }
    if (imageUrl) {
      sqlEvt += ", imagem_url = ?";
      paramsEvt.push(imageUrl);
    }
    sqlEvt += " WHERE id = ?;";
    paramsEvt.push(id);

    const resEvt = db.prepare(sqlEvt).run(...paramsEvt);
    if (resEvt.changes > 0) {
      updatedTables.push('eventos');
    }
  } catch (errEvt) {
    console.warn('[Database] Erro ao atualizar URL em eventos:', errEvt);
  }

  // 2. Atualizar em todas as tabelas dedicadas de categorias
  try {
    const catTables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name LIKE 'eventos_%' AND name != 'eventos_importados';
    `).all() as { name: string }[];

    for (const t of catTables) {
      try {
        const cCols = db.prepare(`PRAGMA table_info(${t.name});`).all() as { name: string }[];
        const names = new Set(cCols.map((c: any) => c.name));
        if (!names.has('url')) {
          db.exec(`ALTER TABLE ${t.name} ADD COLUMN url TEXT;`);
        }
        if (!names.has('video_url')) {
          db.exec(`ALTER TABLE ${t.name} ADD COLUMN video_url TEXT;`);
        }

        let sqlCat = `UPDATE ${t.name} SET url = ?`;
        const paramsCat: any[] = [cleanUrl];
        if (videoUrl) {
          sqlCat += ", video_url = ?";
          paramsCat.push(videoUrl);
        }
        if (imageUrl) {
          sqlCat += ", imagem_url = ?";
          paramsCat.push(imageUrl);
        }
        sqlCat += " WHERE id = ?;";
        paramsCat.push(id);

        const resCat = db.prepare(sqlCat).run(...paramsCat);
        if (resCat.changes > 0) {
          updatedTables.push(t.name);
        }
      } catch (errCat) {
        console.warn(`[Database] Erro ao atualizar URL na tabela ${t.name}:`, errCat);
      }
    }
  } catch (errCats) {
    console.warn('[Database] Erro ao buscar tabelas de categorias:', errCats);
  }

  // 3. Atualizar na tabela de eventos importados (quarentena)
  try {
    const impCols = db.prepare("PRAGMA table_info(eventos_importados);").all() as { name: string }[];
    const impNames = new Set(impCols.map((c: any) => c.name));
    if (!impNames.has('url')) {
      db.exec("ALTER TABLE eventos_importados ADD COLUMN url TEXT;");
    }

    let sqlImp = "UPDATE eventos_importados SET url = ?";
    const paramsImp: any[] = [cleanUrl];
    if (videoUrl) {
      sqlImp += ", video_url = ?";
      paramsImp.push(videoUrl);
    }
    if (imageUrl) {
      sqlImp += ", imagem_url = ?";
      paramsImp.push(imageUrl);
    }
    if (urlType === 'link' || (!isVideo && !isImage)) {
      sqlImp += ", url_origem = COALESCE(url_origem, ?), link_ingressos = COALESCE(link_ingressos, ?)";
      paramsImp.push(cleanUrl, cleanUrl);
    }
    sqlImp += " WHERE id = ?;";
    paramsImp.push(id);

    const resImp = db.prepare(sqlImp).run(...paramsImp);
    if (resImp.changes > 0) {
      updatedTables.push('eventos_importados');
    }
  } catch (errImp) {
    console.warn('[Database] Erro ao atualizar URL em eventos_importados:', errImp);
  }

  // Reconstrói a view para que qualquer consulta veja a URL atualizada
  try {
    rebuildUnifiedEventsView(db);
  } catch {}

  return {
    success: true,
    id,
    url: cleanUrl,
    videoUrl,
    imageUrl,
    updatedTables,
  };
}

