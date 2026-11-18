import { desc, eq, ilike, and, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  configuracoesPix,
  estatisticasConsultas,
  pagamentosPix,
  patrocinadores,
} from './schema.ts';

export interface PixConfigData {
  chavePix: string;
  tipoChave: 'email' | 'telefone' | 'cpf' | 'cnpj' | 'aleatoria';
  nomeBeneficiario: string;
  cidadeBeneficiario: string;
  mercadoPagoToken: string;
}

const DEFAULT_PIX_CONFIG: PixConfigData = {
  chavePix: 'praondeeu@gmail.com',
  tipoChave: 'email',
  nomeBeneficiario: 'PRA ONDE EU VOU',
  cidadeBeneficiario: 'PRAIA GRANDE',
  mercadoPagoToken: '',
};

export async function getPixConfigPg(): Promise<PixConfigData> {
  try {
    const rows = await db
      .select()
      .from(configuracoesPix)
      .where(eq(configuracoesPix.id, 'default'))
      .limit(1);

    const row = rows[0];
    if (row) {
      return {
        chavePix: row.chave_pix || DEFAULT_PIX_CONFIG.chavePix,
        tipoChave: (row.tipo_chave as any) || 'email',
        nomeBeneficiario: row.nome_beneficiario || DEFAULT_PIX_CONFIG.nomeBeneficiario,
        cidadeBeneficiario: row.cidade_beneficiario || DEFAULT_PIX_CONFIG.cidadeBeneficiario,
        mercadoPagoToken: row.mercado_pago_token || '',
      };
    }

    await db
      .insert(configuracoesPix)
      .values({
        id: 'default',
        chave_pix: DEFAULT_PIX_CONFIG.chavePix,
        tipo_chave: DEFAULT_PIX_CONFIG.tipoChave,
        nome_beneficiario: DEFAULT_PIX_CONFIG.nomeBeneficiario,
        cidade_beneficiario: DEFAULT_PIX_CONFIG.cidadeBeneficiario,
        mercado_pago_token: '',
        atualizado_em: new Date().toISOString(),
      })
      .onConflictDoNothing();

    return DEFAULT_PIX_CONFIG;
  } catch (error) {
    console.error('Database query failed in getPixConfigPg:', error);
    return DEFAULT_PIX_CONFIG;
  }
}

export async function savePixConfigPg(config: {
  chavePix: string;
  tipoChave?: string;
  nomeBeneficiario?: string;
  cidadeBeneficiario?: string;
  mercadoPagoToken?: string;
}): Promise<PixConfigData> {
  try {
    const current = await getPixConfigPg();
    const updated: PixConfigData = {
      chavePix: (config.chavePix || current.chavePix).trim(),
      tipoChave: ((config.tipoChave || current.tipoChave).trim() as any) || 'email',
      nomeBeneficiario: (config.nomeBeneficiario || current.nomeBeneficiario)
        .trim()
        .toUpperCase()
        .slice(0, 25),
      cidadeBeneficiario: (config.cidadeBeneficiario || current.cidadeBeneficiario)
        .trim()
        .toUpperCase()
        .slice(0, 15),
      mercadoPagoToken:
        config.mercadoPagoToken !== undefined
          ? config.mercadoPagoToken.trim()
          : current.mercadoPagoToken,
    };

    await db
      .insert(configuracoesPix)
      .values({
        id: 'default',
        chave_pix: updated.chavePix,
        tipo_chave: updated.tipoChave,
        nome_beneficiario: updated.nomeBeneficiario,
        cidade_beneficiario: updated.cidadeBeneficiario,
        mercado_pago_token: updated.mercadoPagoToken,
        atualizado_em: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: configuracoesPix.id,
        set: {
          chave_pix: updated.chavePix,
          tipo_chave: updated.tipoChave,
          nome_beneficiario: updated.nomeBeneficiario,
          cidade_beneficiario: updated.cidadeBeneficiario,
          mercado_pago_token: updated.mercadoPagoToken,
          atualizado_em: new Date().toISOString(),
        },
      });

    return updated;
  } catch (error) {
    console.error('Database query failed in savePixConfigPg:', error);
    throw new Error('Falha ao salvar configurações de Pix.', { cause: error });
  }
}

export async function upsertSponsorForPix(data: {
  id: string;
  nome: string;
  categoria: string;
  descricao: string;
  telefone: string;
  endereco: string;
  cidade: string;
  estado: string;
  badge: string;
  imagem_url: string;
  valor_mensal: number;
  protocolo: string;
}) {
  try {
    await db
      .insert(patrocinadores)
      .values({
        id: data.id,
        nome: data.nome,
        categoria: data.categoria,
        descricao: data.descricao,
        telefone: data.telefone,
        endereco: data.endereco,
        cidade: data.cidade,
        estado: data.estado,
        badge: data.badge,
        imagem_url: data.imagem_url,
        valor_mensal: data.valor_mensal,
        ativo: 0,
        liberado: 'pendente',
        status_pagamento: 'pendente',
        protocolo: data.protocolo,
        criado_em: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: patrocinadores.id,
        set: {
          nome: data.nome,
          categoria: data.categoria,
          descricao: data.descricao,
          telefone: data.telefone,
          endereco: data.endereco,
          cidade: data.cidade,
          estado: data.estado,
          badge: data.badge,
          imagem_url: data.imagem_url,
          valor_mensal: data.valor_mensal,
          protocolo: data.protocolo,
        },
      });
  } catch (error) {
    console.error('Database query failed in upsertSponsorForPix:', error);
    throw new Error('Falha ao registrar patrocinador.', { cause: error });
  }
}

export async function insertPixPaymentRecord(data: {
  id: string;
  patrocinador_id: string;
  mercado_pago_id: string;
  status: string;
  valor: number;
  qr_code: string;
  qr_code_base64: string;
  ticket_url: string;
  telefone_notificado: string;
}) {
  try {
    await db.insert(pagamentosPix).values({
      ...data,
      mensagem_enviada: 0,
      criado_em: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database query failed in insertPixPaymentRecord:', error);
    throw new Error('Falha ao registrar pagamento Pix.', { cause: error });
  }
}

export async function markPixPaymentApprovedPg(paymentId: string) {
  try {
    const now = new Date().toISOString();
    const pixRows = await db
      .select({ patrocinador_id: pagamentosPix.patrocinador_id })
      .from(pagamentosPix)
      .where(eq(pagamentosPix.mercado_pago_id, paymentId));

    await db
      .update(pagamentosPix)
      .set({ status: 'approved', pago_em: now })
      .where(eq(pagamentosPix.mercado_pago_id, paymentId));

    for (const px of pixRows) {
      if (px.patrocinador_id) {
        await db
          .update(patrocinadores)
          .set({ status_pagamento: 'pago', data_pagamento: now })
          .where(eq(patrocinadores.id, px.patrocinador_id));
      }
    }
  } catch (error) {
    console.error('Database query failed in markPixPaymentApprovedPg:', error);
    throw new Error('Falha ao aprovar pagamento Pix.', { cause: error });
  }
}

export async function getPixPaymentWithSponsor(paymentId: string) {
  try {
    const pixRows = await db
      .select()
      .from(pagamentosPix)
      .where(eq(pagamentosPix.mercado_pago_id, paymentId))
      .limit(1);
    const pix = pixRows[0] || null;
    let sponsor: any = null;
    if (pix?.patrocinador_id) {
      const spRows = await db
        .select()
        .from(patrocinadores)
        .where(eq(patrocinadores.id, pix.patrocinador_id))
        .limit(1);
      sponsor = spRows[0] || null;
    }
    return { pix, sponsor };
  } catch (error) {
    console.error('Database query failed in getPixPaymentWithSponsor:', error);
    return { pix: null, sponsor: null };
  }
}

export async function markPixNotificationSentPg(cleanPhone: string) {
  try {
    await db
      .update(pagamentosPix)
      .set({ mensagem_enviada: 1 })
      .where(eq(pagamentosPix.telefone_notificado, cleanPhone));
  } catch {
    // Non-critical
  }
}

export async function listSponsorsPg(filters: { status?: string; liberado?: string }) {
  try {
    const conditions = [];
    if (filters.liberado && filters.liberado !== 'all') {
      conditions.push(eq(patrocinadores.liberado, filters.liberado));
    }
    if (filters.status && filters.status !== 'all') {
      conditions.push(eq(patrocinadores.status_pagamento, filters.status));
    }

    const rows = await db
      .select()
      .from(patrocinadores)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(patrocinadores.criado_em));

    return rows.map((r) => ({
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
    }));
  } catch (error) {
    console.error('Database query failed in listSponsorsPg:', error);
    throw new Error('Falha ao consultar patrocinadores no banco de dados.', { cause: error });
  }
}

export async function updateSponsorLiberationPg(id: string, action: string) {
  try {
    let novoLiberado = 'pendente';
    let novoAtivo = 0;

    if (action === 'aprovar') {
      novoLiberado = 'S';
      novoAtivo = 1;
    } else if (action === 'rejeitar') {
      novoLiberado = 'N';
      novoAtivo = 0;
    }

    const updated = await db
      .update(patrocinadores)
      .set({
        liberado: novoLiberado,
        ativo: novoAtivo,
        data_liberacao: new Date().toISOString(),
      })
      .where(eq(patrocinadores.id, id))
      .returning();

    return {
      changes: updated.length,
      novoLiberado,
      novoAtivo,
      updated: updated[0] || null,
    };
  } catch (error) {
    console.error('Database query failed in updateSponsorLiberationPg:', error);
    throw new Error('Falha ao atualizar status do patrocinador.', { cause: error });
  }
}

// ==================== ESTATÍSTICAS DE CONSULTAS ====================

export async function registrarConsultaPg(ano: number, mes: number, estadoUf: string): Promise<number> {
  try {
    const [row] = await db
      .insert(estatisticasConsultas)
      .values({
        ano,
        mes,
        estado: estadoUf,
        total_consultas: 1,
      })
      .onConflictDoUpdate({
        target: [estatisticasConsultas.ano, estatisticasConsultas.mes, estatisticasConsultas.estado],
        set: {
          total_consultas: sql`${estatisticasConsultas.total_consultas} + 1`,
        },
      })
      .returning({ total_consultas: estatisticasConsultas.total_consultas });

    return row?.total_consultas ?? 1;
  } catch (error) {
    console.error('Database query failed in registrarConsultaPg:', error);
    throw new Error('Falha ao registrar estatística de consulta.', { cause: error });
  }
}

export async function getEstatisticasPg() {
  try {
    return await db
      .select()
      .from(estatisticasConsultas)
      .orderBy(
        desc(estatisticasConsultas.ano),
        desc(estatisticasConsultas.mes),
        desc(estatisticasConsultas.total_consultas)
      );
  } catch (error) {
    console.error('Database query failed in getEstatisticasPg:', error);
    throw new Error('Falha ao consultar estatísticas.', { cause: error });
  }
}

export async function clearEstatisticasPg() {
  try {
    const deleted = await db.delete(estatisticasConsultas).returning();
    return deleted.length;
  } catch (error) {
    console.error('Database query failed in clearEstatisticasPg:', error);
    throw new Error('Falha ao zerar estatísticas.', { cause: error });
  }
}
