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

  // Tabela de Supervisor
  db.exec(`
    CREATE TABLE IF NOT EXISTS supervisor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT UNIQUE NOT NULL,
      senha TEXT,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed categorias padrão se ainda não existirem
  try {
    const catCount = db.prepare('SELECT COUNT(*) as count FROM categorias;').get() as { count: number };
    if (!catCount || catCount.count === 0) {
      const insertCat = db.prepare(`
        INSERT OR IGNORE INTO categorias (nome, descricao, ativa)
        VALUES (?, ?, 1);
      `);
      const defaultCategories = [
        ['Shows', 'Apresentações musicais e concertos ao vivo'],
        ['Samba e Pagode', 'Rodas de samba raiz, feijoadas e pagode 90'],
        ['Baile Nostalgia', 'Flashback anos 70, 80 e 90, disco e charme'],
        ['Baile Terceira Idade', 'Bailes da saudade, boleros e dança de salão'],
        ['Forró', 'Forró universitário, xote e baião'],
        ['Forró Pé de Serra', 'Sanfona de oito baixos, triângulo e arrasta-pé no chão batido'],
      ];
      for (const [name, desc] of defaultCategories) {
        insertCat.run(name, desc);
      }
    }
  } catch (e) {
    console.warn('Erro ao inserir categorias iniciais:', e);
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

  // 3. Tabela de Eventos
  db.exec(`
    CREATE TABLE IF NOT EXISTS eventos (
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
      latitude VARCHAR(50),
      longitude VARCHAR(50),
      liberado VARCHAR(1) DEFAULT 'S',
      is_gratuito INTEGER DEFAULT 0,
      preco REAL,
      detalhes_preco TEXT,
      imagem_url TEXT,
      organizador TEXT NOT NULL,
      contato TEXT,
      tags TEXT DEFAULT '[]',
      destaque INTEGER DEFAULT 0,
      status TEXT DEFAULT 'em_analise',
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (anunciante_id) REFERENCES anunciantes(id) ON DELETE SET NULL,
      FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
    );
  `);

  // Migration: ensure columns latitude, longitude, liberado, categoria_id exist on existing databases
  try {
    const cols = db.prepare("PRAGMA table_info(eventos);").all() as { name: string }[];
    const colNames = new Set(cols.map(c => c.name));
    if (!colNames.has('categoria_id')) {
      db.exec("ALTER TABLE eventos ADD COLUMN categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL;");
    }
    if (!colNames.has('latitude')) {
      db.exec("ALTER TABLE eventos ADD COLUMN latitude VARCHAR(50);");
    }
    if (!colNames.has('longitude')) {
      db.exec("ALTER TABLE eventos ADD COLUMN longitude VARCHAR(50);");
    }
    if (!colNames.has('liberado')) {
      db.exec("ALTER TABLE eventos ADD COLUMN liberado VARCHAR(1) DEFAULT 'S';");
    }

    // Auto-preencher categoria_id para eventos existentes com base no nome da categoria
    db.exec(`
      UPDATE eventos 
      SET categoria_id = (SELECT c.id FROM categorias c WHERE c.nome = eventos.categoria COLLATE NOCASE LIMIT 1)
      WHERE categoria_id IS NULL;
    `);
  } catch (e) {
    console.warn('Erro ao verificar colunas de eventos:', e);
  }

  // 3. Tabela de Favoritos
  db.exec(`
    CREATE TABLE IF NOT EXISTS favoritos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evento_id TEXT NOT NULL,
      usuario_id TEXT NOT NULL DEFAULT 'default_user',
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(evento_id, usuario_id),
      FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
    );
  `);

  seedInitialData(db);
}

function seedInitialData(db: any) {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM eventos;').get() as { count: number };
  if (countRow && countRow.count > 0) {
    return; // Already seeded
  }

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

  // Eventos iniciais
  const insertEvt = db.prepare(`
    INSERT OR IGNORE INTO eventos (
      id, anunciante_id, titulo, descricao, categoria, data_evento, horario, horario_fim,
      local_nome, endereco, cidade, estado, is_gratuito, preco, detalhes_preco,
      imagem_url, organizador, contato, tags, destaque, status, criado_em
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
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

  console.log(`Sucesso: ${initialSeedEvents.length} eventos inseridos no banco SQLite.`);
}

export function executeSqlQuery(sql: string, params: any[] = []) {
  const db = getDatabase();
  const trimmed = sql.trim();
  const isSelect = trimmed.toUpperCase().startsWith('SELECT') || trimmed.toUpperCase().startsWith('PRAGMA') || trimmed.toUpperCase().startsWith('EXPLAIN');

  if (isSelect) {
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params);
    return {
      type: 'select',
      rowCount: rows.length,
      rows,
    };
  } else {
    // Check if it has multiple statements separated by semicolons (e.g., DDL script)
    if (trimmed.includes(';') && (trimmed.toUpperCase().includes('CREATE TABLE') || trimmed.toUpperCase().includes('DROP TABLE'))) {
      db.exec(sql);
      return {
        type: 'exec',
        message: 'Comando SQL executado com sucesso.',
        changes: 0,
      };
    }

    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return {
      type: 'mutate',
      message: 'Comando SQL executado com sucesso.',
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid,
    };
  }
}

export function getDatabaseSchema(): SqlTableInfo[] {
  const db = getDatabase();
  const tables = db.prepare(`
    SELECT name, sql 
    FROM sqlite_master 
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%';
  `).all() as { name: string; sql: string }[];

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
