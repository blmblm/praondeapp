import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { getDatabase, executeSqlQuery, getDatabaseSchema } from './server/database.js';

const app = express();
const PORT = 3000;

app.use(express.json());

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

// 1. Listar Eventos do SQLite
app.get('/api/events', (req, res) => {
  try {
    const { category, city, search, status } = req.query;
    let sql = 'SELECT * FROM eventos WHERE 1=1';
    const params: any[] = [];

    if (category && category !== 'Todos') {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (city && city !== 'Todas') {
      sql += ' AND city = ?';
      params.push(city);
    }
    if (search) {
      sql += ' AND (titulo LIKE ? OR descricao LIKE ? OR local_nome LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (req.query.liberado) {
      sql += ' AND liberado = ?';
      params.push(req.query.liberado);
    }

    sql += ' ORDER BY data_evento ASC, horario ASC';

    const rows = db.prepare(sql).all(...params) as any[];

    // Map database snake_case / columns to EventItem format
    const events = rows.map((r) => ({
      id: r.id,
      title: r.titulo,
      description: r.descricao || '',
      category: r.categoria,
      categoryId: r.categoria_id ?? undefined,
      date: r.data_evento,
      time: r.horario,
      endDate: r.data_evento,
      endTime: r.horario_fim || undefined,
      locationName: r.local_nome,
      address: r.endereco,
      city: r.cidade,
      state: r.estado,
      latitude: r.latitude || undefined,
      longitude: r.longitude || undefined,
      liberado: r.liberado || 'S',
      isFree: Boolean(r.is_gratuito),
      price: r.preco ?? undefined,
      priceDetails: r.detalhes_preco || undefined,
      imageUrl: r.imagem_url || '',
      organizer: r.organizador,
      contact: r.contato || undefined,
      tags: r.tags ? JSON.parse(r.tags) : [],
      featured: Boolean(r.destaque),
      status: r.status || 'em_analise',
      createdAt: r.criado_em,
    }));

    res.json(events);
  } catch (error: any) {
    console.error('Erro ao listar eventos:', error);
    res.status(500).json({ error: error.message || 'Erro ao consultar eventos' });
  }
});

// Helper: Obter coordenadas geográficas (latitude e longitude) a partir do endereço
async function fetchGeocodeCoordinates(address?: string, city?: string, state?: string): Promise<{ latitude: string; longitude: string; displayName?: string } | null> {
  const cleanAddress = (address || '').trim();
  const cleanCity = (city || '').trim();
  const cleanState = (state || '').trim();

  if (!cleanAddress && !cleanCity) return null;

  const queries = [
    cleanAddress && cleanCity && cleanState ? `${cleanAddress}, ${cleanCity}, ${cleanState}, Brasil` : '',
    cleanAddress && cleanCity ? `${cleanAddress}, ${cleanCity}, Brasil` : '',
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

  return null;
}

// Endpoint dedicado de geocodificação para consulta em tempo real no formulário
app.get('/api/geocode', async (req, res) => {
  try {
    const address = String(req.query.address || '');
    const city = String(req.query.city || '');
    const state = String(req.query.state || '');

    const coords = await fetchGeocodeCoordinates(address, city, state);
    if (!coords) {
      return res.status(404).json({ error: 'Endereço não localizado para geocodificação' });
    }
    res.json(coords);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao consultar geolocalização' });
  }
});

// 2. Inserir ou Atualizar Evento no SQLite (INSERT / UPDATE eventos) com geocodificação automática
app.post('/api/events', async (req, res) => {
  try {
    const body = req.body;
    const id = body.id || `evt-${Date.now()}`;
    const createdAt = body.createdAt || new Date().toISOString();
    const tagsString = JSON.stringify(body.tags || []);

    let latitude = body.latitude || null;
    let longitude = body.longitude || null;

    // Se latitude e longitude não foram enviadas ou precisam de geocodificação baseada no endereço
    if (!latitude || !longitude) {
      try {
        const geocoded = await fetchGeocodeCoordinates(body.address, body.city, body.state);
        if (geocoded) {
          latitude = geocoded.latitude;
          longitude = geocoded.longitude;
          console.log(`[Geocoding] Endereço "${body.address}" geocodificado para: Lat ${latitude}, Lon ${longitude}`);
        }
      } catch (geoErr) {
        console.warn('[Geocoding] Não foi possível geolocalizar automaticamente:', geoErr);
      }
    }

    // Resolver categoria_id se informado ou buscar pelo nome da categoria
    let categoriaId: number | null = body.categoryId ? Number(body.categoryId) : null;
    if (!categoriaId && body.category) {
      try {
        const catRow = db.prepare('SELECT id FROM categorias WHERE nome = ? COLLATE NOCASE LIMIT 1;').get(body.category) as any;
        if (catRow) {
          categoriaId = catRow.id;
        } else {
          // Se não existir, insere automaticamente na tabela de categorias
          const insertCat = db.prepare('INSERT OR IGNORE INTO categorias (nome, ativa) VALUES (?, 1);');
          const resCat = insertCat.run(body.category);
          categoriaId = Number(resCat.lastInsertRowid);
        }
      } catch (err) {
        console.warn('Erro ao associar categoria_id:', err);
      }
    }

    const stmt = db.prepare(`
      INSERT INTO eventos (
        id, anunciante_id, categoria_id, categoria, titulo, descricao, data_evento, horario, horario_fim,
        local_nome, endereco, cidade, estado, latitude, longitude, liberado, is_gratuito, preco, detalhes_preco,
        imagem_url, organizador, contato, tags, destaque, status, criado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        anunciante_id = COALESCE(excluded.anunciante_id, eventos.anunciante_id),
        categoria_id = excluded.categoria_id,
        categoria = excluded.categoria,
        titulo = excluded.titulo,
        descricao = excluded.descricao,
        data_evento = excluded.data_evento,
        horario = excluded.horario,
        horario_fim = excluded.horario_fim,
        local_nome = excluded.local_nome,
        endereco = excluded.endereco,
        cidade = excluded.cidade,
        estado = excluded.estado,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        liberado = excluded.liberado,
        is_gratuito = excluded.is_gratuito,
        preco = excluded.preco,
        detalhes_preco = excluded.detalhes_preco,
        imagem_url = excluded.imagem_url,
        organizador = excluded.organizador,
        contato = excluded.contato,
        tags = excluded.tags,
        destaque = excluded.destaque,
        status = excluded.status;
    `);

    stmt.run(
      id,
      body.advertiserId || null,
      categoriaId,
      body.category,
      body.title,
      body.description || '',
      body.date,
      body.time,
      body.endTime || null,
      body.locationName,
      body.address,
      body.city,
      body.state,
      latitude,
      longitude,
      body.liberado || 'S',
      body.isFree ? 1 : 0,
      body.price || 0,
      body.priceDetails || '',
      body.imageUrl || '',
      body.organizer,
      body.contact || '',
      tagsString,
      body.featured ? 1 : 0,
      body.status || 'em_analise',
      createdAt
    );

    const savedEvent = {
      ...body,
      id,
      categoryId: categoriaId ?? undefined,
      latitude,
      longitude,
      liberado: body.liberado || 'S',
      createdAt,
      status: body.status || 'em_analise',
    };

    res.status(201).json(savedEvent);
  } catch (error: any) {
    console.error('Erro ao cadastrar/atualizar evento no SQLite:', error);
    res.status(500).json({ error: error.message || 'Erro ao inserir no banco SQLite' });
  }
});

// Atualizar Evento existente diretamente pelo ID (PUT /api/events/:id)
app.put('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    // Se for atualização exclusiva de status de liberação
    if (body.liberado !== undefined && !body.title) {
      const stmt = db.prepare('UPDATE eventos SET liberado = ? WHERE id = ?;');
      stmt.run(body.liberado, id);
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

    const stmt = db.prepare(`
      UPDATE eventos SET
        titulo = ?,
        descricao = ?,
        categoria = ?,
        data_evento = ?,
        horario = ?,
        horario_fim = ?,
        local_nome = ?,
        endereco = ?,
        cidade = ?,
        estado = ?,
        latitude = ?,
        longitude = ?,
        liberado = ?,
        is_gratuito = ?,
        preco = ?,
        detalhes_preco = ?,
        imagem_url = ?,
        organizador = ?,
        contato = ?
      WHERE id = ?;
    `);

    stmt.run(
      body.title,
      body.description || '',
      body.category,
      body.date,
      body.time,
      body.endTime || null,
      body.locationName,
      body.address,
      body.city,
      body.state,
      latitude,
      longitude,
      body.liberado || 'S',
      body.isFree ? 1 : 0,
      body.price || 0,
      body.priceDetails || '',
      body.imageUrl || '',
      body.organizer,
      body.contact || '',
      id
    );

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

// 3. Excluir Evento
app.delete('/api/events/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM eventos WHERE id = ?;');
    const result = stmt.run(id);
    res.json({ success: true, changes: result.changes });
  } catch (error: any) {
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

app.post('/api/advertisers', (req, res) => {
  try {
    const { id, name, email, phone, city, state, verified } = req.body;
    const advId = id || `adv-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO anunciantes (id, nome, email, telefone, cidade, estado, verificado, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `);
    const createdAt = new Date().toISOString();
    stmt.run(advId, name || '', email, phone || '', city || '', state || '', verified ? 1 : 0, createdAt);
    res.status(201).json({ id: advId, name, email, phone, city, state, verified: Boolean(verified), createdAt });
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
app.get('/api/categories', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM categorias ORDER BY id ASC;').all() as any[];
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
    const newCategory = {
      id: Number(result.lastInsertRowid),
      nome: nome.trim(),
      descricao: (descricao || '').trim(),
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

// 7. Supervisors (CRUD na tabela supervisor do SQLite)
app.get('/api/supervisors', (req, res) => {
  try {
    const rows = db.prepare('SELECT id, nome, criado_em FROM supervisor ORDER BY id ASC;').all() as any[];
    const supervisors = rows.map((r) => ({
      id: r.id,
      nome: r.nome,
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
app.post('/api/sql/query', (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Comando SQL não informado' });
    }

    const startTime = performance.now();
    const result = executeSqlQuery(query);
    const durationMs = (performance.now() - startTime).toFixed(2);

    res.json({
      ...result,
      durationMs: `${durationMs}ms`,
    });
  } catch (error: any) {
    res.status(400).json({
      error: error.message || 'Erro de sintaxe ou execução no SQLite',
    });
  }
});

// ==================== VITE MIDDLEWARE & SERVER START ====================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
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
  });
}

startServer();
