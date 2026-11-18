import { asc, desc, eq, ilike, or, and, ne, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  anunciantes,
  categorias,
  cidades,
  estado,
  favoritos,
  palavrasIgnoradas,
  supervisor,
} from './schema.ts';

// ==================== CATEGORIAS ====================

export async function getCategoriesList() {
  try {
    const rows = await db
      .select()
      .from(categorias)
      .where(ne(sql`LOWER(TRIM(${categorias.nome}))`, 'categoria'))
      .orderBy(asc(categorias.id));

    return rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      descricao: r.descricao || '',
      ativa: Boolean(r.ativa),
      criadoEm: r.criado_em,
    }));
  } catch (error) {
    console.error('Database query failed in getCategoriesList:', error);
    throw new Error('Falha ao consultar categorias no banco de dados.', { cause: error });
  }
}

export async function resolveCategoryRecord(
  categoryName?: string | null,
  categoryId?: number | null,
  autoCreate = false
): Promise<{ id: number | null; nome: string }> {
  try {
    if (categoryId) {
      const foundById = await db
        .select()
        .from(categorias)
        .where(eq(categorias.id, categoryId))
        .limit(1);
      if (foundById[0]) {
        return {
          id: foundById[0].id,
          nome: categoryName?.trim() || foundById[0].nome,
        };
      }
    }

    const cleanName = (categoryName || '').trim();
    if (!cleanName) return { id: null, nome: 'Shows' };

    const allCats = await db.select().from(categorias);
    const exact = allCats.find((c) => c.nome.toLowerCase().trim() === cleanName.toLowerCase());
    if (exact) return { id: exact.id, nome: exact.nome };

    const normalize = (txt: string) =>
      (txt || '').toLowerCase().replace(/\s+e\s+/g, ' ').replace(/[^a-z0-9]/g, '').trim();
    const target = normalize(cleanName);
    const normalizedMatch = allCats.find((c) => normalize(c.nome) === target);
    if (normalizedMatch) return { id: normalizedMatch.id, nome: normalizedMatch.nome };

    if (autoCreate) {
      const tabelaNome = `eventos_${cleanName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')}`;
      const inserted = await db
        .insert(categorias)
        .values({
          nome: cleanName,
          ativa: 1,
          tabela_nome: tabelaNome,
          criado_em: new Date().toISOString(),
        })
        .onConflictDoNothing()
        .returning();
      if (inserted[0]) {
        return { id: inserted[0].id, nome: inserted[0].nome };
      }
      const recheck = await db
        .select()
        .from(categorias)
        .where(ilike(categorias.nome, cleanName))
        .limit(1);
      if (recheck[0]) return { id: recheck[0].id, nome: recheck[0].nome };
    }

    return { id: null, nome: cleanName };
  } catch (error) {
    console.error('Database query failed in resolveCategoryRecord:', error);
    throw new Error('Falha ao resolver categoria no banco de dados.', { cause: error });
  }
}

export async function createCategoryRecord(nome: string, descricao?: string) {
  try {
    const cleanNome = nome.trim();
    const tabelaNome = `eventos_${cleanNome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')}`;

    const [created] = await db
      .insert(categorias)
      .values({
        nome: cleanNome,
        descricao: (descricao || '').trim(),
        ativa: 1,
        tabela_nome: tabelaNome,
        criado_em: new Date().toISOString(),
      })
      .returning();

    return {
      id: created.id,
      nome: created.nome,
      descricao: created.descricao || '',
      tabela_nome: created.tabela_nome || tabelaNome,
      ativa: Boolean(created.ativa),
      criadoEm: created.criado_em || new Date().toISOString(),
    };
  } catch (error: any) {
    if (error?.code === '23505') {
      throw new Error('UNIQUE_CATEGORY', { cause: error });
    }
    console.error('Database query failed in createCategoryRecord:', error);
    throw new Error('Falha ao cadastrar categoria no banco de dados.', { cause: error });
  }
}

export async function deleteCategoryRecord(id: number) {
  try {
    const deleted = await db.delete(categorias).where(eq(categorias.id, id)).returning();
    return deleted.length;
  } catch (error) {
    console.error('Database query failed in deleteCategoryRecord:', error);
    throw new Error('Falha ao excluir categoria no banco de dados.', { cause: error });
  }
}

// ==================== ESTADO / CIDADES ====================

export async function resolveEstadoOrCidade(rawVal: string): Promise<{ ufVal: string; nomeVal: string; isNumericId: boolean }> {
  try {
    const clean = rawVal.trim();
    const isNumericId = /^\d+$/.test(clean);
    if (isNumericId) {
      const idNum = parseInt(clean, 10);
      const est = await db.select().from(estado).where(eq(estado.id, idNum)).limit(1);
      if (est[0]) {
        return { ufVal: est[0].estado || '', nomeVal: est[0].nome || '', isNumericId: true };
      }
      const cid = await db
        .select({
          id: cidades.id,
          nome: cidades.nome,
          estadoUf: estado.estado,
        })
        .from(cidades)
        .leftJoin(estado, eq(cidades.estado_id, estado.id))
        .where(eq(cidades.id, idNum))
        .limit(1);
      if (cid[0]) {
        return { ufVal: cid[0].estadoUf || '', nomeVal: cid[0].nome || '', isNumericId: true };
      }
      return { ufVal: clean, nomeVal: '', isNumericId: true };
    }

    const est = await db
      .select()
      .from(estado)
      .where(or(ilike(estado.estado, clean), ilike(estado.nome, clean)))
      .limit(1);
    if (est[0]) {
      return { ufVal: est[0].estado || '', nomeVal: est[0].nome || '', isNumericId: false };
    }

    const cid = await db
      .select({
        id: cidades.id,
        nome: cidades.nome,
        estadoUf: estado.estado,
      })
      .from(cidades)
      .leftJoin(estado, eq(cidades.estado_id, estado.id))
      .where(ilike(cidades.nome, clean))
      .limit(1);
    if (cid[0]) {
      return { ufVal: cid[0].estadoUf || '', nomeVal: cid[0].nome || '', isNumericId: false };
    }

    return { ufVal: clean, nomeVal: '', isNumericId: false };
  } catch (error) {
    console.error('Database query failed in resolveEstadoOrCidade:', error);
    return { ufVal: rawVal.trim(), nomeVal: '', isNumericId: /^\d+$/.test(rawVal.trim()) };
  }
}

export async function getEstadoIdByText(stateText?: string | null, cityText?: string | null): Promise<number | null> {
  try {
    const s = (stateText || '').trim();
    const c = (cityText || '').trim();
    if (!s && !c) return null;
    const rows = await db
      .select({ id: estado.id })
      .from(estado)
      .where(
        or(
          s ? ilike(estado.estado, s) : sql`false`,
          s ? ilike(estado.nome, s) : sql`false`,
          c ? ilike(estado.nome, c) : sql`false`
        )
      )
      .limit(1);
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function getCidadesList(estadoFilter?: string, search?: string) {
  try {
    const rows = await db
      .select({
        id: cidades.id,
        nome: cidades.nome,
        estado: estado.estado,
        regiao: estado.regiao,
        ativa: cidades.ativa,
        criado_em: cidades.criado_em,
      })
      .from(cidades)
      .leftJoin(estado, eq(cidades.estado_id, estado.id))
      .where(
        and(
          eq(cidades.ativa, 1),
          estadoFilter && estadoFilter !== 'Todos' && estadoFilter !== 'Todas'
            ? ilike(estado.estado, estadoFilter)
            : sql`UPPER(COALESCE(${estado.estado}, 'SP')) = 'SP'`,
          search
            ? or(ilike(cidades.nome, `%${search}%`), ilike(estado.regiao, `%${search}%`))
            : undefined
        )
      )
      .orderBy(asc(cidades.nome));

    return rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      estado: r.estado || 'SP',
      regiao: r.regiao || '',
      ativa: Boolean(r.ativa),
      criadoEm: r.criado_em,
    }));
  } catch (error) {
    console.error('Database query failed in getCidadesList:', error);
    throw new Error('Falha ao consultar cidades no banco de dados.', { cause: error });
  }
}

export async function createCidadeRecord(nome: string, estadoUf = 'SP', regiao = 'Sudeste') {
  try {
    const cleanNome = nome.trim();
    const cleanEstado = estadoUf.trim().toUpperCase();
    const cleanRegiao = regiao.trim();

    let estRows = await db
      .select()
      .from(estado)
      .where(ilike(estado.estado, cleanEstado))
      .limit(1);

    let estId: number;
    if (!estRows[0]) {
      const [newEst] = await db
        .insert(estado)
        .values({
          nome: `${cleanNome} State`,
          estado: cleanEstado,
          regiao: cleanRegiao,
          ativa: 1,
          criado_em: new Date().toISOString(),
        })
        .returning();
      estId = newEst.id;
    } else {
      estId = estRows[0].id;
    }

    const [created] = await db
      .insert(cidades)
      .values({
        nome: cleanNome,
        estado_id: estId,
        ativa: 1,
        criado_em: new Date().toISOString(),
      })
      .returning();

    return {
      id: created.id,
      nome: cleanNome,
      estado: cleanEstado,
      regiao: cleanRegiao,
      ativa: true,
      criadoEm: created.criado_em || new Date().toISOString(),
    };
  } catch (error: any) {
    if (error?.code === '23505') {
      throw new Error('UNIQUE_CITY', { cause: error });
    }
    console.error('Database query failed in createCidadeRecord:', error);
    throw new Error('Falha ao cadastrar cidade no banco de dados.', { cause: error });
  }
}

export async function deleteAllCidadesRecords() {
  try {
    const deleted = await db.delete(cidades).returning();
    return deleted.length;
  } catch (error) {
    console.error('Database query failed in deleteAllCidadesRecords:', error);
    throw new Error('Falha ao excluir cidades no banco de dados.', { cause: error });
  }
}

export async function deleteCidadeRecord(id: number) {
  try {
    const deleted = await db.delete(cidades).where(eq(cidades.id, id)).returning();
    return deleted.length;
  } catch (error) {
    console.error('Database query failed in deleteCidadeRecord:', error);
    throw new Error('Falha ao excluir cidade no banco de dados.', { cause: error });
  }
}

// ==================== PALAVRAS IGNORADAS ====================

export async function getIgnoredWordsList() {
  try {
    const rows = await db.select().from(palavrasIgnoradas).orderBy(asc(palavrasIgnoradas.palavra));
    return rows.map((r) => ({
      id: r.id,
      palavra: r.palavra,
      criadoEm: r.criado_em,
    }));
  } catch (error) {
    console.error('Database query failed in getIgnoredWordsList:', error);
    throw new Error('Falha ao consultar palavras ignoradas.', { cause: error });
  }
}

export async function addIgnoredWordRecord(palavra: string) {
  try {
    const clean = palavra.trim().toLowerCase();
    const [created] = await db
      .insert(palavrasIgnoradas)
      .values({
        palavra: clean,
        criado_em: new Date().toISOString(),
      })
      .returning();
    return { id: created.id, palavra: created.palavra };
  } catch (error: any) {
    if (error?.code === '23505') {
      throw new Error('UNIQUE_WORD', { cause: error });
    }
    console.error('Database query failed in addIgnoredWordRecord:', error);
    throw new Error('Falha ao cadastrar palavra ignorada.', { cause: error });
  }
}

export async function deleteIgnoredWordRecord(id: number) {
  try {
    const deleted = await db.delete(palavrasIgnoradas).where(eq(palavrasIgnoradas.id, id)).returning();
    return deleted.length;
  } catch (error) {
    console.error('Database query failed in deleteIgnoredWordRecord:', error);
    throw new Error('Falha ao excluir palavra ignorada.', { cause: error });
  }
}

export async function syncIgnoredWordsBatch(words: { id?: number; palavra: string }[]) {
  try {
    await db.delete(palavrasIgnoradas);
    let count = 0;
    for (const w of words) {
      if (!w?.palavra) continue;
      await db
        .insert(palavrasIgnoradas)
        .values({
          palavra: w.palavra.trim().toLowerCase(),
          criado_em: new Date().toISOString(),
        })
        .onConflictDoNothing();
      count++;
    }
    return count;
  } catch (error) {
    console.error('Database query failed in syncIgnoredWordsBatch:', error);
    throw new Error('Falha ao sincronizar palavras ignoradas.', { cause: error });
  }
}

export async function containsIgnoredWords(title: string, description: string): Promise<boolean> {
  try {
    const rows = await db.select({ palavra: palavrasIgnoradas.palavra }).from(palavrasIgnoradas);
    if (!rows.length) return false;
    const fullText = `${title || ''} ${description || ''}`.toLowerCase();
    return rows.some((r) => {
      const w = (r.palavra || '').trim().toLowerCase();
      return Boolean(w && fullText.includes(w));
    });
  } catch {
    return false;
  }
}

// ==================== ANUNCIANTES ====================

export async function getAdvertisersList() {
  try {
    const rows = await db.select().from(anunciantes).orderBy(desc(anunciantes.criado_em));
    return rows.map((r) => ({
      id: r.id,
      name: r.nome,
      email: r.email,
      phone: r.telefone,
      cpf: r.cpf || undefined,
      city: r.cidade,
      state: r.estado,
      verified: Boolean(r.verificado),
      createdAt: r.criado_em,
    }));
  } catch (error) {
    console.error('Database query failed in getAdvertisersList:', error);
    throw new Error('Falha ao consultar anunciantes no banco de dados.', { cause: error });
  }
}

export async function findAdvertiserByEmail(email: string) {
  try {
    const clean = email.trim().toLowerCase();
    const rows = await db
      .select()
      .from(anunciantes)
      .where(ilike(anunciantes.email, clean))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      name: row.nome,
      email: row.email,
      phone: row.telefone,
      cpf: row.cpf || undefined,
      city: row.cidade,
      state: row.estado,
      verified: Boolean(row.verificado),
      createdAt: row.criado_em,
    };
  } catch (error) {
    console.error('Database query failed in findAdvertiserByEmail:', error);
    throw new Error('Falha ao verificar anunciante no banco de dados.', { cause: error });
  }
}

export async function upsertAdvertiserRecord(data: {
  id?: string;
  name?: string;
  email: string;
  phone?: string;
  cpf?: string;
  city?: string;
  state?: string;
  verified?: boolean;
  createdAt?: string;
}) {
  try {
    const cleanEmail = data.email.trim().toLowerCase();
    const advId = data.id || `adv-${Date.now()}`;
    const createdAt = data.createdAt || new Date().toISOString();

    await db
      .insert(anunciantes)
      .values({
        id: advId,
        nome: data.name || '',
        email: cleanEmail,
        telefone: data.phone || '',
        cpf: data.cpf || '',
        cidade: data.city || '',
        estado: data.state || '',
        verificado: data.verified !== undefined ? (data.verified ? 1 : 0) : 1,
        criado_em: createdAt,
      })
      .onConflictDoUpdate({
        target: anunciantes.email,
        set: {
          nome: data.name || '',
          telefone: data.phone || '',
          cpf: data.cpf || '',
          cidade: data.city || '',
          estado: data.state || '',
          verificado: data.verified !== undefined ? (data.verified ? 1 : 0) : 1,
        },
      });

    return {
      id: advId,
      name: data.name || '',
      email: cleanEmail,
      phone: data.phone || '',
      cpf: data.cpf || undefined,
      city: data.city || '',
      state: data.state || '',
      verified: true,
      createdAt,
    };
  } catch (error) {
    console.error('Database query failed in upsertAdvertiserRecord:', error);
    throw new Error('Falha ao salvar anunciante no banco de dados.', { cause: error });
  }
}

// ==================== FAVORITOS ====================

export async function getFavoritesList(usuarioId = 'default_user') {
  try {
    const rows = await db
      .select({ evento_id: favoritos.evento_id })
      .from(favoritos)
      .where(eq(favoritos.usuario_id, usuarioId));
    return rows.map((r) => r.evento_id);
  } catch (error) {
    console.error('Database query failed in getFavoritesList:', error);
    throw new Error('Falha ao consultar favoritos no banco de dados.', { cause: error });
  }
}

export async function addFavoriteRecord(eventId: string, usuarioId = 'default_user') {
  try {
    await db
      .insert(favoritos)
      .values({
        evento_id: eventId,
        usuario_id: usuarioId,
        criado_em: new Date().toISOString(),
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error('Database query failed in addFavoriteRecord:', error);
    throw new Error('Falha ao salvar favorito no banco de dados.', { cause: error });
  }
}

export async function removeFavoriteRecord(eventId: string, usuarioId = 'default_user') {
  try {
    await db
      .delete(favoritos)
      .where(and(eq(favoritos.evento_id, eventId), eq(favoritos.usuario_id, usuarioId)));
  } catch (error) {
    console.error('Database query failed in removeFavoriteRecord:', error);
    throw new Error('Falha ao remover favorito no banco de dados.', { cause: error });
  }
}

// ==================== SUPERVISOR ====================

export async function getSupervisorsList() {
  try {
    const rows = await db
      .select({
        id: supervisor.id,
        nome: supervisor.nome,
        criado_em: supervisor.criado_em,
      })
      .from(supervisor)
      .orderBy(asc(supervisor.nome));
    return rows;
  } catch (error) {
    console.error('Database query failed in getSupervisorsList:', error);
    throw new Error('Falha ao consultar supervisores no banco de dados.', { cause: error });
  }
}

export async function createSupervisorRecord(nome: string, senha: string) {
  try {
    const [created] = await db
      .insert(supervisor)
      .values({
        nome: nome.trim(),
        senha: senha.trim(),
        criado_em: new Date().toISOString(),
      })
      .returning();
    return { id: created.id, nome: created.nome, criado_em: created.criado_em };
  } catch (error: any) {
    if (error?.code === '23505') {
      throw new Error('UNIQUE_SUPERVISOR', { cause: error });
    }
    console.error('Database query failed in createSupervisorRecord:', error);
    throw new Error('Falha ao cadastrar supervisor.', { cause: error });
  }
}

export async function updateSupervisorRecord(id: number, nome?: string, senha?: string) {
  try {
    const patch: Record<string, any> = {};
    if (nome && nome.trim()) patch.nome = nome.trim();
    if (senha && senha.trim()) patch.senha = senha.trim();
    if (Object.keys(patch).length === 0) return 0;
    const updated = await db.update(supervisor).set(patch).where(eq(supervisor.id, id)).returning();
    return updated.length;
  } catch (error) {
    console.error('Database query failed in updateSupervisorRecord:', error);
    throw new Error('Falha ao atualizar supervisor.', { cause: error });
  }
}

export async function deleteSupervisorRecord(id: number) {
  try {
    const deleted = await db.delete(supervisor).where(eq(supervisor.id, id)).returning();
    return deleted.length;
  } catch (error) {
    console.error('Database query failed in deleteSupervisorRecord:', error);
    throw new Error('Falha ao excluir supervisor.', { cause: error });
  }
}

export async function verifySupervisorByPassword(password: string) {
  try {
    const rows = await db
      .select({ id: supervisor.id, nome: supervisor.nome, senha: supervisor.senha })
      .from(supervisor)
      .where(eq(supervisor.senha, password.trim()))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in verifySupervisorByPassword:', error);
    throw new Error('Falha ao verificar senha administrativa.', { cause: error });
  }
}
