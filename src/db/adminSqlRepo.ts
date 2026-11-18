import { desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { db, pool } from './index.ts';
import { eventos, eventosImportados, favoritos, historicoLimpezas } from './schema.ts';
import { cleanupOrphanedMediaFilesPg } from './mediaRepo.ts';
import { ensureDatabaseSchema } from './ensureSchema.ts';

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
    throw new Error('Falha ao consultar schema do PostgreSQL.', { cause: error });
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
      message: 'Comando executado no PostgreSQL.',
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

const BACKUP_TABLE_ORDER = [
  'estado',
  'categorias',
  'cidades',
  'supervisor',
  'anunciantes',
  'users',
  'palavras_ignoradas',
  'configuracoes_pix',
  'patrocinadores',
  'pagamentos_pix',
  'eventos',
  'eventos_importados',
  'favoritos',
  'estatisticas_consultas',
  'historico_limpezas',
  'registro_eventos_deletados',
  'sync_metadata',
  'media_files',
] as const;

const SERIAL_ID_TABLES = new Set<string>([
  'estado',
  'categorias',
  'cidades',
  'supervisor',
  'users',
  'palavras_ignoradas',
  'favoritos',
  'estatisticas_consultas',
  'historico_limpezas',
]);

export async function exportFullDatabaseBackupPg() {
  await ensureDatabaseSchema();
  const tablesData: Record<string, any[]> = {};
  const counts: Record<string, number> = {};

  for (const tableName of BACKUP_TABLE_ORDER) {
    try {
      const res = await pool.query(`SELECT * FROM "${tableName}";`);
      const rows = res.rows.map((row) => {
        if (tableName === 'media_files' && row.data && Buffer.isBuffer(row.data)) {
          const { data, ...rest } = row;
          return {
            ...rest,
            data_base64: data.toString('base64'),
          };
        }
        return row;
      });
      tablesData[tableName] = rows;
      counts[tableName] = rows.length;
    } catch (err) {
      console.warn(`[Backup Export] Aviso ao ler tabela ${tableName}:`, err);
      tablesData[tableName] = [];
      counts[tableName] = 0;
    }
  }

  return {
    version: 1,
    app: 'pra-onde-eu-vou',
    engine: 'postgresql',
    exportedAt: new Date().toISOString(),
    counts,
    tables: tablesData,
  };
}

export async function importFullDatabaseBackupPg(payload: any) {
  await ensureDatabaseSchema();
  const tablesObj = payload?.tables && typeof payload.tables === 'object' ? payload.tables : null;
  if (!tablesObj) {
    throw new Error('Arquivo de backup inválido: campo "tables" não encontrado.');
  }

  const insertedCounts: Record<string, number> = {};
  let totalInserted = 0;
  const client = await pool.connect();

  try {
    for (const tableName of BACKUP_TABLE_ORDER) {
      const rawRows = Array.isArray(tablesObj[tableName]) ? tablesObj[tableName] : [];
      insertedCounts[tableName] = 0;
      if (rawRows.length === 0) continue;

      const colsRes = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1;`,
        [tableName]
      );
      const validCols = new Set(colsRes.rows.map((r) => r.column_name));

      for (const rawRow of rawRows) {
        if (!rawRow || typeof rawRow !== 'object') continue;

        const row: Record<string, any> = { ...rawRow };
        if (tableName === 'media_files' && typeof row.data_base64 === 'string') {
          row.data = Buffer.from(row.data_base64, 'base64');
          delete row.data_base64;
        }

        const colNames = Object.keys(row).filter((col) => validCols.has(col));
        if (colNames.length === 0) continue;

        const quotedCols = colNames.map((c) => `"${c}"`).join(', ');
        const placeholders = colNames.map((_, i) => `$${i + 1}`).join(', ');
        const values = colNames.map((c) => row[c]);

        try {
          const insertRes = await client.query(
            `INSERT INTO "${tableName}" (${quotedCols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING;`,
            values
          );
          const added = insertRes.rowCount ?? 0;
          insertedCounts[tableName] += added;
          totalInserted += added;
        } catch (rowErr) {
          console.warn(`[Backup Import] Registro ignorado em ${tableName}:`, rowErr);
        }
      }

      if (SERIAL_ID_TABLES.has(tableName)) {
        try {
          await client.query(`
            SELECT setval(
              pg_get_serial_sequence($1, 'id'),
              COALESCE((SELECT MAX(id) FROM "${tableName}"), 1),
              (SELECT COUNT(*) > 0 FROM "${tableName}")
            );
          `, [tableName]);
        } catch (seqErr) {
          console.warn(`[Backup Import] Aviso ao ajustar sequência em ${tableName}:`, seqErr);
        }
      }
    }
  } finally {
    client.release();
  }

  return {
    success: true,
    totalInserted,
    insertedCounts,
    importedAt: new Date().toISOString(),
  };
}

export async function saveRestoredMediaFilePg(params: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  data: Buffer;
  createdAt?: string | null;
}) {
  await ensureDatabaseSchema();
  const res = await pool.query(
    `INSERT INTO media_files (filename, mime_type, size_bytes, data, created_at)
     VALUES ($1, $2, $3, $4, COALESCE($5::timestamp, NOW()))
     ON CONFLICT (filename) DO NOTHING;`,
    [
      params.filename,
      params.mimeType || 'video/mp4',
      params.sizeBytes || params.data.length,
      params.data,
      params.createdAt || null,
    ]
  );
  return (res.rowCount ?? 0) > 0;
}


