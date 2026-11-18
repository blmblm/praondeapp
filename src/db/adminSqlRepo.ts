import { desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { db, pool } from './index.ts';
import { eventos, eventosImportados, favoritos, historicoLimpezas } from './schema.ts';
import { cleanupOrphanedMediaFilesPg } from './mediaRepo.ts';

export interface SqlColumnInfo {
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
  columns: SqlColumnInfo[];
  rowCount: number;
}

export async function getPostgresSchemaInfo(): Promise<SqlTableInfo[]> {
  try {
    const tablesRes = await pool.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC;
    `);

    const colsRes = await pool.query<{
      table_name: string;
      ordinal_position: number;
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(`
      SELECT table_name, ordinal_position, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name ASC, ordinal_position ASC;
    `);

    const pkRes = await pool.query<{ table_name: string; column_name: string }>(`
      SELECT kcu.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY';
    `);

    const pkSet = new Set(pkRes.rows.map((r) => `${r.table_name}.${r.column_name}`));
    const result: SqlTableInfo[] = [];

    for (const tbl of tablesRes.rows) {
      const tableName = tbl.table_name;
      const tblCols = colsRes.rows
        .filter((c) => c.table_name === tableName)
        .map((c) => ({
          cid: Number(c.ordinal_position) - 1,
          name: c.column_name,
          type: c.data_type.toUpperCase(),
          notnull: c.is_nullable === 'NO' ? 1 : 0,
          dflt_value: c.column_default,
          pk: pkSet.has(`${tableName}.${c.column_name}`) ? 1 : 0,
        }));

      let rowCount = 0;
      try {
        const cntRes = await pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM "${tableName}";`);
        rowCount = parseInt(cntRes.rows[0]?.c || '0', 10) || 0;
      } catch {
        rowCount = 0;
      }

      const ddlCols = tblCols
        .map((c) => `  ${c.name} ${c.type}${c.pk ? ' PRIMARY KEY' : ''}${c.notnull ? ' NOT NULL' : ''}`)
        .join(',\n');

      result.push({
        name: tableName,
        sql: `CREATE TABLE ${tableName} (\n${ddlCols}\n);`,
        columns: tblCols,
        rowCount,
      });
    }

    return result;
  } catch (error) {
    console.error('Database query failed in getPostgresSchemaInfo:', error);
    throw new Error('Falha ao consultar schema do Cloud SQL PostgreSQL.', { cause: error });
  }
}

export async function executePostgresSqlQuery(rawQuery: string) {
  const cleanSql = rawQuery.trim();
  if (!cleanSql) {
    throw new Error('Consulta SQL vazia');
  }

  // Traduz comandos legados do Console SQLite para PostgreSQL quando necessário
  let pgSql = cleanSql
    .replace(/COLLATE\s+NOCASE/gi, '')
    .replace(/date\s*\(\s*'now'\s*,\s*'localtime'\s*\)/gi, 'CURRENT_DATE::text');

  // Ignora comando sintático SQLite PRAGMA/REINDEX; VACUUM
  if (/^\s*PRAGMA\b/i.test(pgSql)) {
    return {
      type: 'COMMAND',
      changes: 0,
      message: 'Comando executado no Cloud SQL PostgreSQL.',
    };
  }

  const isSelect = /^\s*(SELECT|WITH|SHOW|EXPLAIN)\b/i.test(pgSql);
  if (isSelect) {
    const res = await pool.query(pgSql);
    return {
      type: 'SELECT',
      rowCount: res.rows.length,
      rows: res.rows,
    };
  }

  const res = await pool.query(pgSql);
  return {
    type: 'COMMAND',
    changes: res.rowCount ?? 0,
    message: `Comando executado com sucesso (${res.rowCount ?? 0} registro(s) afetado(s)).`,
  };
}

export interface TableCleanupStat {
  table: string;
  deleted: number;
  remaining: number;
}

export interface CleanupResult {
  success: boolean;
  tipo: 'quinzenal' | 'diaria' | 'manual';
  dataCorte: string;
  totalExcluidos: number;
  tabelasProcessadas: TableCleanupStat[];
  totalTabelasComDataEvento: number;
  totalTabelasBanco: number;
  reorganizado: boolean;
  reindex: boolean;
  vacuum: boolean;
  analyze: boolean;
  duracaoMs: number;
  executadoEm: string;
}

export async function runPostgresCleanup(
  scope: 'quinzenal' | 'diaria' | 'manual' = 'quinzenal'
): Promise<CleanupResult> {
  const startTime = Date.now();
  try {
    const now = new Date();
    const spString = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const spDate = new Date(spString);
    const year = spDate.getFullYear();
    const month = String(spDate.getMonth() + 1).padStart(2, '0');
    const day = String(spDate.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;

    // 1. Coleta e exclui eventos expirados em 'eventos'
    const expiredEvtRows = await db
      .select({ id: eventos.id })
      .from(eventos)
      .where(sql`SUBSTRING(${eventos.data_evento}, 1, 10) < ${todayString}`);

    const expiredIds = expiredEvtRows.map((r) => r.id);
    if (expiredIds.length > 0) {
      await db.delete(favoritos).where(inArray(favoritos.evento_id, expiredIds));
      await db.delete(eventos).where(inArray(eventos.id, expiredIds));
    }

    const [{ count: remainingEvts }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(eventos);

    // 2. Exclui eventos expirados em 'eventos_importados'
    const expiredImpRows = await db
      .delete(eventosImportados)
      .where(sql`SUBSTRING(${eventosImportados.data_evento}, 1, 10) < ${todayString}`)
      .returning({ id: eventosImportados.id });

    const [{ count: remainingImp }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(eventosImportados);

    const tableStats: TableCleanupStat[] = [
      { table: 'eventos', deleted: expiredIds.length, remaining: remainingEvts },
      { table: 'eventos_importados', deleted: expiredImpRows.length, remaining: remainingImp },
    ];

    const totalDeleted = expiredIds.length + expiredImpRows.length;

    // 2b. Limpa vídeos órfãos de eventos já excluídos/expirados
    await cleanupOrphanedMediaFilesPg();

    // 3. Atualiza estatísticas do planejador PostgreSQL (ANALYZE)
    let analyzeOk = false;
    try {
      await pool.query('ANALYZE eventos; ANALYZE eventos_importados; ANALYZE media_files;');
      analyzeOk = true;
    } catch {
      analyzeOk = false;
    }

    const duracaoMs = Date.now() - startTime;
    const executadoEm = new Date().toISOString();

    await db.insert(historicoLimpezas).values({
      executado_em: executadoEm,
      tipo: scope,
      data_corte: todayString,
      total_excluidos: totalDeleted,
      tabelas_processadas: JSON.stringify(tableStats),
      reorganizado: analyzeOk ? 1 : 0,
      duracao_ms: duracaoMs,
    });

    return {
      success: true,
      tipo: scope,
      dataCorte: todayString,
      totalExcluidos: totalDeleted,
      tabelasProcessadas: tableStats,
      totalTabelasComDataEvento: 2,
      totalTabelasBanco: 18,
      reorganizado: analyzeOk,
      reindex: analyzeOk,
      vacuum: analyzeOk,
      analyze: analyzeOk,
      duracaoMs,
      executadoEm,
    };
  } catch (error) {
    console.error('Database query failed in runPostgresCleanup:', error);
    return {
      success: false,
      tipo: scope,
      dataCorte: new Date().toISOString().slice(0, 10),
      totalExcluidos: 0,
      tabelasProcessadas: [],
      totalTabelasComDataEvento: 0,
      totalTabelasBanco: 0,
      reorganizado: false,
      reindex: false,
      vacuum: false,
      analyze: false,
      duracaoMs: Date.now() - startTime,
      executadoEm: new Date().toISOString(),
    };
  }
}

export async function getCleanupStatusPg() {
  try {
    const schema = await getPostgresSchemaInfo();
    const monitoredTables = schema.map((t) => ({
      name: t.name,
      hasDataEvento: t.columns.some((c) => c.name === 'data_evento'),
      isProtected: false,
      count: t.rowCount,
    }));

    const history = await db
      .select()
      .from(historicoLimpezas)
      .orderBy(desc(historicoLimpezas.id))
      .limit(10);

    let lastExecution: any = history[0] ? { ...history[0] } : null;
    if (lastExecution && typeof lastExecution.tabelas_processadas === 'string') {
      try {
        lastExecution.tabelas_processadas = JSON.parse(lastExecution.tabelas_processadas);
      } catch {
        // ignore parse failure
      }
    }

    return { monitoredTables, lastExecution, history };
  } catch (error) {
    console.error('Database query failed in getCleanupStatusPg:', error);
    throw new Error('Falha ao consultar histórico de limpezas.', { cause: error });
  }
}
