import React, { useState, useEffect, useRef } from 'react';
import { Database, Play, Code, Table, RefreshCw, X, Check, AlertTriangle, Layers, Info, Trash2, Download, Upload } from 'lucide-react';

interface SqlColumn {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface SqlTableInfo {
  name: string;
  sql: string;
  columns: SqlColumn[];
  rowCount: number;
}

interface SqlConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventModified?: (deletedIds?: string[]) => void;
}

export const SqlConsoleModal: React.FC<SqlConsoleModalProps> = ({ isOpen, onClose, onEventModified }) => {
  const [activeTab, setActiveTab] = useState<'console' | 'schema'>('console');
  const [query, setQuery] = useState<string>('SELECT id, titulo, categoria, cidade, preco, status FROM eventos;');
  const [loading, setLoading] = useState<boolean>(false);
  const [execResult, setExecResult] = useState<{
    type?: string;
    rowCount?: number;
    rows?: any[];
    changes?: number;
    durationMs?: string;
    message?: string;
    error?: string;
  } | null>(null);

  const [schemaInfo, setSchemaInfo] = useState<{
    databaseName: string;
    engine: string;
    tables: SqlTableInfo[];
  } | null>(null);
  const [loadingSchema, setLoadingSchema] = useState<boolean>(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState<'export' | 'import' | null>(null);
  const [backupStatus, setBackupStatus] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const backupFileRef = useRef<HTMLInputElement | null>(null);

  const QUICK_QUERIES = [
    {
      label: '⏳ Quarentena (eventos_importados)',
      sql: "SELECT id, titulo, categoria, cidade, estado, status, criado_em FROM eventos_importados WHERE status = 'quarentena' ORDER BY criado_em DESC;",
    },
    {
      label: '🔍 Verificar Total na Quarentena',
      sql: "SELECT COUNT(*) as total_quarentena FROM eventos_importados WHERE status = 'quarentena';",
    },
    {
      label: '🗑️ Descartados da Quarentena',
      sql: "SELECT id, titulo, categoria, cidade, estado, status FROM eventos_importados WHERE status = 'descartado';",
    },
    {
      label: '📍 Tabela de Estado (estado)',
      sql: 'SELECT id, nome, estado, regiao, ativa, criado_em FROM estado ORDER BY nome ASC;',
    },
    {
      label: '🎭 Todos os Eventos (eventos)',
      sql: 'SELECT id, titulo, categoria, cidade, latitude, longitude, liberado, status FROM eventos ORDER BY data_evento ASC;',
    },
    {
      label: '🏷️ Tabela de Categorias (categorias)',
      sql: 'SELECT id, nome, descricao, ativa FROM categorias ORDER BY nome ASC;',
    },
    {
      label: '🏢 Tabela de Anunciantes (anunciantes)',
      sql: 'SELECT id, nome, email, telefone, cidade, estado, verificado FROM anunciantes;',
    },
    {
      label: '👑 Tabela de Supervisor (supervisor)',
      sql: 'SELECT id, nome, criado_em FROM supervisor;',
    },
    {
      label: '⭐ Tabela de Patrocinadores (patrocinadores)',
      sql: 'SELECT id, nome, categoria, cidade, estado, status_pagamento, liberado FROM patrocinadores;',
    },
    {
      label: '✅ Eventos Liberados (liberado = S)',
      sql: "SELECT id, titulo, cidade, latitude, longitude, liberado FROM eventos WHERE liberado = 'S';",
    },
    {
      label: '📊 Eventos Agrupados por Categoria',
      sql: 'SELECT categoria, COUNT(*) as total_eventos FROM eventos GROUP BY categoria ORDER BY total_eventos DESC;',
    },
    {
      label: '❤️ Tabela de Favoritos (favoritos)',
      sql: 'SELECT f.id, f.evento_id, e.titulo, f.criado_em FROM favoritos f LEFT JOIN eventos e ON f.evento_id = e.id;',
    },
    {
      label: '❌ Excluir Evento por ID',
      sql: "DELETE FROM eventos WHERE id = 'user-1789409044377';",
    },
    {
      label: '🧹 Limpar Eventos da Quarentena Descartados',
      sql: "DELETE FROM eventos_importados WHERE status = 'descartado';",
    },
    {
      label: '📅 Histórico de Limpezas & Reorganizações',
      sql: 'SELECT id, executado_em, tipo, data_corte, total_excluidos, reorganizado, duracao_ms FROM historico_limpezas ORDER BY id DESC LIMIT 10;',
    },
    {
      label: '🔍 Eventos Anteriores à Data de Hoje (Expirados)',
      sql: 'SELECT id, titulo, data_evento, cidade FROM eventos WHERE data_evento < CURRENT_DATE::text ORDER BY data_evento ASC LIMIT 30;',
    },
    {
      label: '⚡ Analisar Estatísticas do Banco (ANALYZE)',
      sql: 'ANALYZE;',
    },
  ];

  const fetchSchema = async () => {
    try {
      setLoadingSchema(true);
      setSchemaError(null);
      const res = await fetch('/api/sql/schema');
      if (res.ok) {
        const data = await res.json();
        setSchemaInfo(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        setSchemaError(errData.error || `Erro ao carregar tabelas do banco (HTTP ${res.status}).`);
      }
    } catch (e: any) {
      console.error('Erro ao carregar schema do banco:', e);
      setSchemaError(e?.message || 'Falha de conexão com o servidor ao ler o banco de dados.');
    } finally {
      setLoadingSchema(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSchema();
    }
  }, [isOpen]);

  const handleExecute = async (queryToRun?: string) => {
    const targetQuery = queryToRun || query;
    if (!targetQuery.trim()) return;

    setLoading(true);
    setExecResult(null);

    try {
      const res = await fetch('/api/sql/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: targetQuery }),
      });

      const data = await res.json();
      if (!res.ok) {
        setExecResult({ error: data.error || 'Erro ao executar comando SQL.' });
      } else {
        setExecResult(data);
        fetchSchema();
        if (onEventModified) {
          onEventModified(data.deletedEventIds);
        }
      }
    } catch (e: any) {
      setExecResult({ error: e.message || 'Falha de conexão com o banco de dados.' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      setBackupBusy('export');
      setBackupStatus(null);
      const res = await fetch('/api/admin/export-backup');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao gerar backup.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pra-onde-eu-vou-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBackupStatus({ type: 'ok', text: 'Backup baixado com sucesso! Guarde este arquivo para restaurar no outro banco.' });
    } catch (err: any) {
      setBackupStatus({ type: 'err', text: err.message || 'Falha ao exportar backup.' });
    } finally {
      setBackupBusy(null);
    }
  };

  const handleImportBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setBackupBusy('import');
      setBackupStatus({ type: 'info', text: `Lendo arquivo ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)...` });

      const text = await file.text();
      const parsed = JSON.parse(text);
      const tablesObj = parsed?.tables && typeof parsed.tables === 'object' ? parsed.tables : null;
      if (!tablesObj) {
        throw new Error('Arquivo de backup inválido: campo "tables" não encontrado.');
      }

      const TABLE_ORDER = [
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
      ];

      let totalInserted = 0;
      const MAX_BATCH_BYTES = 1_500_000;

      for (const tableName of TABLE_ORDER) {
        const rows = Array.isArray(tablesObj[tableName]) ? tablesObj[tableName] : [];
        if (rows.length === 0) continue;

        let batch: any[] = [];
        let batchBytes = 0;
        let processed = 0;

        const flushBatch = async () => {
          if (batch.length === 0) return;
          setBackupStatus({
            type: 'info',
            text: `Importando tabela "${tableName}" (${processed}/${rows.length})...`,
          });
          const res = await fetch('/api/admin/import-backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tables: { [tableName]: batch } }),
          });
          const rawBody = await res.text();
          let data: any = {};
          try {
            data = JSON.parse(rawBody);
          } catch {
            throw new Error(`Erro no servidor ao importar "${tableName}" (HTTP ${res.status}).`);
          }
          if (!res.ok || !data.success) {
            throw new Error(data.error || `Falha ao importar tabela "${tableName}" (HTTP ${res.status}).`);
          }
          totalInserted += Number(data.totalInserted || 0);
          batch = [];
          batchBytes = 0;
        };

        for (const row of rows) {
          const rowSize = JSON.stringify(row).length;
          if (batch.length > 0 && batchBytes + rowSize > MAX_BATCH_BYTES) {
            await flushBatch();
          }
          batch.push(row);
          batchBytes += rowSize;
          processed += 1;
        }
        await flushBatch();
      }

      // Envia vídeos da tabela media_files em blocos pequenos (~1.5 MB por requisição) para respeitar o limite do Cloud Run
      const mediaRows = Array.isArray(tablesObj.media_files) ? tablesObj.media_files : [];
      const CHUNK_CHARS = 2_000_000; // múltiplo exato de 4 para Base64
      for (let mIdx = 0; mIdx < mediaRows.length; mIdx++) {
        const mRow = mediaRows[mIdx];
        if (!mRow || !mRow.filename || typeof mRow.data_base64 !== 'string') continue;

        const b64: string = mRow.data_base64;
        const totalChunks = Math.max(1, Math.ceil(b64.length / CHUNK_CHARS));
        const uploadId = `${Date.now()}_${mIdx}_${Math.random().toString(36).slice(2, 8)}`;

        for (let c = 0; c < totalChunks; c++) {
          const start = c * CHUNK_CHARS;
          const chunkBase64 = b64.slice(start, start + CHUNK_CHARS);
          const pct = Math.round(((c + 1) / totalChunks) * 100);
          setBackupStatus({
            type: 'info',
            text: `Importando vídeo ${mIdx + 1} de ${mediaRows.length} (${pct}%)...`,
          });

          const res = await fetch('/api/admin/import-media-chunk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uploadId,
              filename: mRow.filename,
              mimeType: mRow.mime_type || 'video/mp4',
              sizeBytes: mRow.size_bytes || 0,
              createdAt: mRow.created_at || null,
              chunkIndex: c,
              isLast: c === totalChunks - 1,
              chunkBase64,
            }),
          });
          const rawBody = await res.text();
          let data: any = {};
          try {
            data = JSON.parse(rawBody);
          } catch {
            throw new Error(`Erro no servidor ao importar vídeo ${mIdx + 1} (HTTP ${res.status}).`);
          }
          if (!res.ok || !data.success) {
            throw new Error(data.error || `Falha ao importar vídeo ${mIdx + 1}.`);
          }
          if (data.done && data.inserted) {
            totalInserted += 1;
          }
        }
      }

      setBackupStatus({
        type: 'ok',
        text: `Backup restaurado com sucesso! ${totalInserted} registro(s) novo(s) importado(s) no banco de dados.`,
      });
      await fetchSchema();
      if (onEventModified) onEventModified();
    } catch (err: any) {
      setBackupStatus({ type: 'err', text: err.message || 'Arquivo inválido ou erro ao importar backup.' });
    } finally {
      setBackupBusy(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">Central de Gerenciamento - Console SQL</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  PostgreSQL (Conectado)
                </span>
                <span className="hidden sm:inline-block text-xs text-amber-400/90 font-medium">
                  (Acesso Master)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Execute comandos SQL reais e gerencie a persistência relacional do aplicativo
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-rose-500/20 text-slate-200 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 text-xs font-bold transition-colors cursor-pointer shrink-0"
            title="Sair e fechar console"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Sair</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-slate-800 bg-slate-950/40 text-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('console')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'console'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Code className="w-4 h-4" />
              <span>Console SQL</span>
            </button>

            <button
              onClick={() => setActiveTab('schema')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'schema'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Tabelas & Schema ({schemaInfo?.tables?.length || 3})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <button
              onClick={fetchSchema}
              disabled={loadingSchema}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSchema ? 'animate-spin' : ''}`} />
              <span>Atualizar Status</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'console' ? (
            <>
              {/* Backup & Migration Bar */}
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    Backup &amp; Migração de Dados (Neon ↔ Cloud SQL)
                  </p>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Exporte todos os eventos, categorias, cidades, anunciantes e mídias em um arquivo <code>.json</code> e importe no novo banco com 1 clique.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    ref={backupFileRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handleImportBackupFile}
                    className="hidden"
                  />
                  <button
                    onClick={handleExportBackup}
                    disabled={backupBusy !== null}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{backupBusy === 'export' ? 'Gerando...' : 'Exportar Backup'}</span>
                  </button>
                  <button
                    onClick={() => backupFileRef.current?.click()}
                    disabled={backupBusy !== null}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{backupBusy === 'import' ? 'Importando...' : 'Restaurar Backup'}</span>
                  </button>
                </div>
              </div>

              {backupStatus && (
                <div
                  className={`px-4 py-2.5 rounded-xl text-xs font-medium border ${
                    backupStatus.type === 'ok'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                      : backupStatus.type === 'info'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                  }`}
                >
                  {backupStatus.text}
                </div>
              )}

              {schemaError && (
                <div className="px-4 py-2.5 rounded-xl text-xs font-medium border bg-rose-500/15 border-rose-500/40 text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Erro ao conectar no banco de dados: {schemaError}</span>
                </div>
              )}

              {/* Quick Table Access Bar */}
              {schemaInfo?.tables && schemaInfo.tables.length > 0 && (
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Table className="w-3.5 h-3.5 text-amber-400" />
                      Tabelas do Banco (Clique para abrir):
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {schemaInfo.tables.length} tabelas encontradas
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {schemaInfo.tables.map((tbl) => {
                      const isEstado = tbl.name === 'estado' || tbl.name === 'estados' || tbl.name === 'cidades';
                      const q = `SELECT * FROM ${tbl.name};`;
                      return (
                        <button
                          key={tbl.name}
                          onClick={() => {
                            setQuery(q);
                            handleExecute(q);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-2 border transition-all cursor-pointer ${
                            isEstado
                              ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 hover:bg-amber-500/30'
                              : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-750 hover:border-slate-600'
                          }`}
                        >
                          <span className="font-bold">{tbl.name}</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                            isEstado ? 'bg-amber-500/30 text-amber-200' : 'bg-slate-700 text-slate-300'
                          }`}>
                            {tbl.rowCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick Query Presets */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Atalhos de Queries Rápidas:
                </label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_QUERIES.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setQuery(item.sql);
                        handleExecute(item.sql);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/80 hover:border-amber-500/40 hover:text-amber-300 transition-all flex items-center gap-1.5"
                    >
                      <Play className="w-3 h-3 text-amber-400" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* SQL Input Area */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Code className="w-4 h-4 text-amber-400" />
                    Digite seu comando SQL (SELECT, INSERT, UPDATE, etc.):
                  </label>
                  <span className="text-xs text-slate-500 font-mono">PostgreSQL (Cloud SQL)</span>
                </div>

                <div className="relative">
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    rows={4}
                    placeholder="Ex: SELECT * FROM eventos WHERE categoria = 'Samba e Pagode';"
                    className="w-full font-mono text-sm bg-slate-950 border border-slate-700 rounded-xl p-4 text-amber-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 shadow-inner"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-3 gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Info className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>
                      Dica: para valores de texto em <code>WHERE</code>, use sempre <strong>aspas simples</strong> (ex: <code>WHERE id = 'meu-id'</code>). Comandos <code>DELETE</code> e <code>UPDATE</code> alteram diretamente o banco <strong>Cloud SQL</strong>.
                    </span>
                  </div>

                  <button
                    onClick={() => handleExecute()}
                    disabled={loading || !query.trim()}
                    className="shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <Play className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    <span>{loading ? 'Executando...' : 'Executar Query SQL'}</span>
                  </button>
                </div>
              </div>

              {/* Execution Result Area */}
              {execResult && (
                <div className="mt-4 border border-slate-800 rounded-xl bg-slate-950/60 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-850 border-b border-slate-800 text-xs">
                    <div className="flex items-center gap-2">
                      <Table className="w-4 h-4 text-amber-400" />
                      <span className="font-semibold text-white">Resultado da Execução</span>
                      {execResult.durationMs && (
                        <span className="text-slate-400 font-mono">({execResult.durationMs})</span>
                      )}
                    </div>

                    <div>
                      {execResult.error ? (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Erro na execução
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          {execResult.type === 'select'
                            ? `${execResult.rowCount} registro(s) retornado(s)`
                            : `Sucesso (${execResult.changes ?? 0} linha(s) afetada(s))`}
                        </span>
                      )}
                    </div>
                  </div>

                  {execResult.error ? (
                    <div className="p-4 bg-rose-500/10 text-rose-300 text-xs font-mono border-l-4 border-rose-500 whitespace-pre-wrap">
                      {execResult.error}
                    </div>
                  ) : execResult.type === 'select' && execResult.rows && execResult.rows.length > 0 ? (
                    <div className="overflow-x-auto max-h-80">
                      <table className="w-full text-left text-xs font-mono border-collapse">
                        <thead>
                          <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 uppercase tracking-wider">
                            <th className="px-3 py-2 text-slate-500">#</th>
                            {Object.keys(execResult.rows[0]).map((col) => (
                              <th key={col} className="px-3 py-2 font-semibold text-amber-300 border-r border-slate-800/60">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850 text-slate-300">
                          {execResult.rows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-850/50 transition-colors">
                              <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                              {Object.keys(row).map((col) => (
                                <td key={col} className="px-3 py-2 border-r border-slate-850/60 max-w-xs truncate" title={String(row[col])}>
                                  {row[col] === null ? (
                                    <span className="text-slate-600 italic">NULL</span>
                                  ) : typeof row[col] === 'boolean' ? (
                                    <span className={row[col] ? 'text-emerald-400' : 'text-slate-500'}>
                                      {String(row[col])}
                                    </span>
                                  ) : (
                                    String(row[col])
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-sm text-slate-400">
                      {execResult.message || 'Comando executado com sucesso. Nenhum registro para exibir.'}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Schema Tab */
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">
                    Estrutura do Banco Cloud SQL ({schemaInfo?.databaseName || 'PostgreSQL'})
                  </h4>
                  <p className="text-xs text-slate-400">
                    Todas as tabelas foram criadas com suporte a chaves primárias, estrangeiras e constraints relacionais.
                  </p>
                </div>
                <div className="text-right font-mono text-xs text-amber-400">
                  {schemaInfo?.tables?.length || 0} Tabelas Criadas
                </div>
              </div>

              {schemaInfo?.tables?.map((table) => (
                <div key={table.name} className="border border-slate-800 rounded-xl bg-slate-950/40 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Table className="w-4 h-4 text-amber-400" />
                      <h5 className="font-bold text-white text-sm tracking-wide font-mono">
                        {table.name}
                      </h5>
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-700">
                        {table.rowCount} linha(s)
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setQuery(`SELECT * FROM ${table.name} LIMIT 10;`);
                        setActiveTab('console');
                        handleExecute(`SELECT * FROM ${table.name} LIMIT 10;`);
                      }}
                      className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      <span>Ver Dados</span>
                    </button>
                  </div>

                  {/* Columns Table */}
                  <div className="p-4 overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-800 pb-1">
                          <th className="pb-2">Coluna</th>
                          <th className="pb-2">Tipo</th>
                          <th className="pb-2">Chave Primária</th>
                          <th className="pb-2">Obrigatório</th>
                          <th className="pb-2">Padrão</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850 text-slate-300">
                        {table.columns.map((col) => (
                          <tr key={col.name} className="hover:bg-slate-900/40">
                            <td className="py-2 font-semibold text-white flex items-center gap-1.5">
                              {col.pk === 1 && <span className="text-[10px] px-1 bg-amber-500/20 text-amber-400 rounded">PK</span>}
                              {col.name}
                            </td>
                            <td className="py-2 text-amber-300/80">{col.type}</td>
                            <td className="py-2">{col.pk === 1 ? 'Sim' : '-'}</td>
                            <td className="py-2">{col.notnull === 1 ? 'NOT NULL' : 'Opcional'}</td>
                            <td className="py-2 text-slate-500">{col.dflt_value ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* DDL SQL */}
                    <div className="mt-3 pt-3 border-t border-slate-850">
                      <span className="text-[11px] font-bold text-slate-500 block mb-1">SQL DDL de Criação:</span>
                      <pre className="text-[11px] text-slate-400 bg-slate-900 p-2.5 rounded-lg overflow-x-auto border border-slate-800">
                        {table.sql}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-900/90 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>PostgreSQL (Cloud SQL conectado via backend Node.js)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            Fechar Console
          </button>
        </div>
      </div>
    </div>
  );
};
