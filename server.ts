import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { getDatabase, executeSqlQuery, getDatabaseSchema } from './server/database.js';
import { createMercadoPagoPixPayment, checkMercadoPagoPaymentStatus } from './server/mercadopago.js';

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

    if (category && category !== 'Todos' && category !== 'Todas' && category !== 'Categorias') {
      sql += ' AND (categoria = ? OR CAST(categoria_id AS TEXT) = ?)';
      params.push(String(category), String(category));
    }
    if (city && city !== 'Todas' && city !== 'Cidades') {
      sql += ' AND cidade = ?';
      params.push(String(city));
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
      sql += ' AND UPPER(liberado) = ?';
      params.push(String(req.query.liberado).toUpperCase());
    }
    if (req.query.data_min || req.query.date) {
      sql += ' AND data_evento >= ?';
      params.push(req.query.data_min || req.query.date);
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
      liberado: r.liberado !== null && r.liberado !== undefined ? r.liberado : '',
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

    const stmt = db.prepare(`
      UPDATE eventos SET
        categoria_id = ?,
        categoria = ?,
        titulo = ?,
        descricao = ?,
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
  });
}

startServer();
