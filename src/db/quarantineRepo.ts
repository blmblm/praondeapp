import { desc, eq, ilike, inArray, or, sql, and } from 'drizzle-orm';
import { db } from './index.ts';
import { eventos, eventosImportados } from './schema.ts';
import { containsIgnoredWords, getEstadoIdByText, resolveCategoryRecord } from './catalogRepo.ts';
import { isCleanVideo } from './mediaHelpers.ts';
import { deleteMediaFilesIfUnusedPg } from './mediaRepo.ts';

export async function countQuarantinePg(): Promise<number> {
  try {
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(eventosImportados)
      .where(eq(eventosImportados.status, 'quarentena'));
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

export async function listImportedEventsPg(status = 'quarentena', origem?: string) {
  try {
    // Purga registros já liberados no catálogo oficial
    const approvedEvts = await db
      .select({
        id: eventos.id,
        titulo: eventos.titulo,
        data_evento: eventos.data_evento,
        contato: eventos.contato,
      })
      .from(eventos)
      .where(eq(eventos.liberado, 'S'));

    const approvedIds = new Set(approvedEvts.map((e) => e.id));
    const approvedTitleDates = new Set(
      approvedEvts
        .filter((e) => e.titulo)
        .map((e) => `${e.titulo.trim().toLowerCase()}__${e.data_evento}`)
    );
    const approvedContacts = new Set(approvedEvts.map((e) => e.contato).filter(Boolean) as string[]);

    const conditions = [];
    if (status !== 'todos') conditions.push(eq(eventosImportados.status, status));
    if (origem && origem !== 'todos') conditions.push(eq(eventosImportados.origem, origem));

    const rows = await db
      .select()
      .from(eventosImportados)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(eventosImportados.criado_em));

    const toPurgeIds: string[] = [];
    const activeRows = [];

    for (const r of rows) {
      const key = `${(r.titulo || '').trim().toLowerCase()}__${r.data_evento}`;
      const isAlreadyApproved =
        r.status === 'aprovado' ||
        approvedIds.has(r.id) ||
        approvedTitleDates.has(key) ||
        (r.link_ingressos && approvedContacts.has(r.link_ingressos)) ||
        (r.url_origem && approvedContacts.has(r.url_origem));

      if (isAlreadyApproved) {
        toPurgeIds.push(r.id);
      } else {
        activeRows.push(r);
      }
    }

    if (toPurgeIds.length > 0) {
      await db.delete(eventosImportados).where(inArray(eventosImportados.id, toPurgeIds));
    }

    return activeRows.map((r) => ({
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
      videoUrl:
        r.video_url && isCleanVideo(r.video_url)
          ? r.video_url
          : r.url && isCleanVideo(r.url)
            ? r.url
            : undefined,
      url: r.url || r.video_url || r.imagem_url || r.url_origem || undefined,
      price: r.preco,
      isGratuito: r.is_gratuito === 1,
      ticketUrl: r.link_ingressos,
      status: r.status,
      createdAt: r.criado_em,
    }));
  } catch (error) {
    console.error('Database query failed in listImportedEventsPg:', error);
    throw new Error('Falha ao listar eventos da quarentena.', { cause: error });
  }
}

export async function checkDuplicateEventStatusPg(ticketUrl: string, title: string): Promise<{
  statusInDb: 'quarentena' | 'aprovado' | 'descartado' | 'nenhum';
  alreadyImported: boolean;
}> {
  try {
    const cleanUrl = (ticketUrl || '').trim();
    const cleanTitle = (title || '').trim();

    const offRows = await db
      .select({ id: eventos.id })
      .from(eventos)
      .where(
        or(
          cleanUrl ? eq(eventos.contato, cleanUrl) : sql`false`,
          cleanTitle ? ilike(eventos.titulo, cleanTitle) : sql`false`
        )
      )
      .limit(1);

    if (offRows[0]) {
      return { statusInDb: 'aprovado', alreadyImported: true };
    }

    const impRows = await db
      .select({ id: eventosImportados.id, status: eventosImportados.status })
      .from(eventosImportados)
      .where(
        or(
          cleanUrl ? eq(eventosImportados.link_ingressos, cleanUrl) : sql`false`,
          cleanUrl ? eq(eventosImportados.url_origem, cleanUrl) : sql`false`,
          cleanTitle ? ilike(eventosImportados.titulo, cleanTitle) : sql`false`
        )
      )
      .limit(1);

    if (impRows[0]) {
      return {
        statusInDb: (impRows[0].status as any) || 'quarentena',
        alreadyImported: true,
      };
    }

    return { statusInDb: 'nenhum', alreadyImported: false };
  } catch {
    return { statusInDb: 'nenhum', alreadyImported: false };
  }
}

export async function upsertImportedEventsPg(
  list: any[],
  options?: { origemOverride?: string; idPrefix?: string; defaultCategory?: string }
) {
  try {
    let addedCount = 0;
    let skippedCount = 0;
    const insertedItems: any[] = [];

    for (const item of list) {
      const title = item.title || item.titulo || '';
      const descText = item.description || item.descricao || '';
      const ticketUrl = item.ticketUrl || item.linkIngressos || item.urlOrigem || '';

      if (await containsIgnoredWords(title, descText)) {
        skippedCount++;
        continue;
      }

      const dup = await checkDuplicateEventStatusPg(ticketUrl, title);
      if (dup.alreadyImported) {
        skippedCount++;
        continue;
      }

      const chosenCat =
        options?.defaultCategory || item.rhythm || item.category || item.categoria || 'Shows';
      const resolvedCat = await resolveCategoryRecord(chosenCat, item.categoryId, false);
      const estId = await getEstadoIdByText(item.state || item.estado, item.city || item.cidade);

      const prefix = options?.idPrefix || 'imp';
      const id = item.id || `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const now = new Date().toISOString();

      await db
        .insert(eventosImportados)
        .values({
          id,
          origem: options?.origemOverride || item.origem || 'sympla',
          url_origem: item.urlOrigem || ticketUrl || '',
          titulo: title || 'Evento Importado',
          descricao: descText,
          categoria: resolvedCat.nome,
          categoria_id: resolvedCat.id,
          data_evento: item.date || item.dataEvento || now.split('T')[0],
          horario: item.time || item.horario || '20:00',
          horario_fim: item.endTime || item.horarioFim || null,
          local_nome: item.locationName || item.localNome || 'Local a Confirmar',
          endereco: item.address || item.endereco || '',
          cidade: item.city || item.cidade || 'São Paulo',
          estado: item.state || item.estado || 'SP',
          estado_id: estId,
          latitude: item.latitude !== undefined && item.latitude !== null ? String(item.latitude) : null,
          longitude: item.longitude !== undefined && item.longitude !== null ? String(item.longitude) : null,
          imagem_url: item.imageUrl || item.imagemUrl || '',
          organizador: item.organizer || item.organizador || 'Produção',
          preco: item.price !== undefined && item.price !== null ? Number(item.price) : 0,
          is_gratuito: item.isGratuito ? 1 : 0,
          detalhes_preco:
            item.priceDetails ||
            (item.isGratuito ? 'Gratuito' : item.price ? `R$ ${Number(item.price).toFixed(2)}` : 'Consulte'),
          link_ingressos: ticketUrl,
          status: 'quarentena',
          criado_em: now,
        })
        .onConflictDoUpdate({
          target: eventosImportados.id,
          set: {
            titulo: title || 'Evento Importado',
            descricao: descText,
            categoria: resolvedCat.nome,
            categoria_id: resolvedCat.id,
            data_evento: item.date || item.dataEvento || now.split('T')[0],
            horario: item.time || item.horario || '20:00',
            horario_fim: item.endTime || item.horarioFim || null,
            local_nome: item.locationName || item.localNome || 'Local a Confirmar',
            endereco: item.address || item.endereco || '',
            cidade: item.city || item.cidade || 'São Paulo',
            estado: item.state || item.estado || 'SP',
            imagem_url: item.imageUrl || item.imagemUrl || '',
            link_ingressos: ticketUrl,
          },
        });

      addedCount++;
      insertedItems.push({
        id,
        ...item,
        category: resolvedCat.nome,
        status: 'quarentena',
      });
    }

    const totalQuarantine = await countQuarantinePg();
    return { addedCount, skippedCount, insertedItems, totalQuarantine };
  } catch (error) {
    console.error('Database query failed in upsertImportedEventsPg:', error);
    throw new Error('Falha ao salvar eventos na quarentena.', { cause: error });
  }
}

export async function insertSingleUserQuarantinePg(data: {
  id: string;
  origem: string;
  url_origem: string;
  titulo: string;
  descricao: string;
  categoria: string;
  categoria_id: number | null;
  data_evento: string;
  horario: string;
  horario_fim: string | null;
  local_nome: string;
  endereco: string;
  cidade: string;
  estado: string;
  latitude: string | null;
  longitude: string | null;
  imagem_url: string;
  organizador: string;
  preco: number;
  is_gratuito: number;
  detalhes_preco: string;
  link_ingressos: string;
  status: string;
  criado_em: string;
  video_url: string | null;
  url: string | null;
  anunciante_id: string | null;
}) {
  try {
    await db.insert(eventosImportados).values(data).onConflictDoNothing();
  } catch (err) {
    console.warn('Aviso ao inserir em eventos_importados:', err);
  }
}

export async function updateImportedEventPg(id: string, body: any) {
  try {
    const patch: Record<string, any> = {};
    if (body.title !== undefined) patch.titulo = body.title;
    if (body.description !== undefined) patch.descricao = body.description;
    if (body.category !== undefined) patch.categoria = body.category;
    if (body.date !== undefined) patch.data_evento = body.date;
    if (body.time !== undefined) patch.horario = body.time;
    if (body.endTime !== undefined) patch.horario_fim = body.endTime;
    if (body.locationName !== undefined) patch.local_nome = body.locationName;
    if (body.address !== undefined) patch.endereco = body.address;
    if (body.city !== undefined) patch.cidade = body.city;
    if (body.state !== undefined) patch.estado = body.state;
    if (body.imageUrl !== undefined) patch.imagem_url = body.imageUrl;
    if (body.organizer !== undefined) patch.organizador = body.organizer;
    if (body.price !== undefined) patch.preco = Number(body.price);
    if (body.isGratuito !== undefined) patch.is_gratuito = body.isGratuito ? 1 : 0;
    if (body.ticketUrl !== undefined) patch.link_ingressos = body.ticketUrl;

    if (Object.keys(patch).length > 0) {
      await db.update(eventosImportados).set(patch).where(eq(eventosImportados.id, id));
    }
  } catch (error) {
    console.error('Database query failed in updateImportedEventPg:', error);
    throw new Error('Falha ao atualizar evento na quarentena.', { cause: error });
  }
}

export async function clearImportedEventsPg() {
  try {
    const deleted = await db
      .delete(eventosImportados)
      .returning({ id: eventosImportados.id, video_url: eventosImportados.video_url, url: eventosImportados.url });
    await deleteMediaFilesIfUnusedPg(deleted.flatMap((r) => [r.video_url, r.url]));
    return deleted.length;
  } catch (error) {
    console.error('Database query failed in clearImportedEventsPg:', error);
    throw new Error('Falha ao limpar quarentena.', { cause: error });
  }
}

export async function deleteImportedEventPg(id: string, permanent: boolean) {
  try {
    if (permanent) {
      const deleted = await db
        .delete(eventosImportados)
        .where(eq(eventosImportados.id, id))
        .returning({ id: eventosImportados.id, video_url: eventosImportados.video_url, url: eventosImportados.url });
      await deleteMediaFilesIfUnusedPg(deleted.flatMap((r) => [r.video_url, r.url]));
      return deleted.length;
    }
    const updated = await db
      .update(eventosImportados)
      .set({ status: 'descartado' })
      .where(eq(eventosImportados.id, id))
      .returning({ id: eventosImportados.id });
    return updated.length;
  } catch (error) {
    console.error('Database query failed in deleteImportedEventPg:', error);
    throw new Error('Falha ao remover evento da quarentena.', { cause: error });
  }
}

export async function getPendingQuarantineIdsPg(): Promise<string[]> {
  try {
    const rows = await db
      .select({ id: eventosImportados.id })
      .from(eventosImportados)
      .where(eq(eventosImportados.status, 'quarentena'));
    return rows.map((r) => r.id);
  } catch (error) {
    console.error('Database query failed in getPendingQuarantineIdsPg:', error);
    return [];
  }
}

export async function patchImportedCategoryPg(id: string, category: string) {
  try {
    const resolved = await resolveCategoryRecord(category, null, false);
    await db
      .update(eventosImportados)
      .set({ categoria: resolved.nome, categoria_id: resolved.id })
      .where(eq(eventosImportados.id, id));
    return resolved;
  } catch (error) {
    console.error('Database query failed in patchImportedCategoryPg:', error);
    throw new Error('Falha ao alterar categoria na quarentena.', { cause: error });
  }
}

export async function batchImportedCategoryPg(ids: string[], category: string) {
  try {
    const resolved = await resolveCategoryRecord(category, null, false);
    const updated = await db
      .update(eventosImportados)
      .set({ categoria: resolved.nome, categoria_id: resolved.id })
      .where(inArray(eventosImportados.id, ids))
      .returning({ id: eventosImportados.id });
    return { updatedCount: updated.length, categoryId: resolved.id, category: resolved.nome };
  } catch (error) {
    console.error('Database query failed in batchImportedCategoryPg:', error);
    throw new Error('Falha ao atualizar categorias em lote na quarentena.', { cause: error });
  }
}

export async function batchDeleteImportedPg(ids: string[], permanent: boolean) {
  try {
    if (permanent) {
      const deleted = await db
        .delete(eventosImportados)
        .where(inArray(eventosImportados.id, ids))
        .returning({ id: eventosImportados.id, video_url: eventosImportados.video_url, url: eventosImportados.url });
      await deleteMediaFilesIfUnusedPg(deleted.flatMap((r) => [r.video_url, r.url]));
      return deleted.length;
    }
    const updated = await db
      .update(eventosImportados)
      .set({ status: 'descartado' })
      .where(inArray(eventosImportados.id, ids))
      .returning({ id: eventosImportados.id });
    return updated.length;
  } catch (error) {
    console.error('Database query failed in batchDeleteImportedPg:', error);
    throw new Error('Falha ao descartar eventos em lote.', { cause: error });
  }
}
