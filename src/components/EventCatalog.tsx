import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Calendar,
  MapPin, 
  ArrowLeft, 
  Heart, 
  SlidersHorizontal,
  DollarSign,
  Sparkles,
  ChevronRight,
  ChevronDown,
  X,
  AlertCircle,
  Navigation,
  CheckCircle2
} from 'lucide-react';
import { EventItem, EventCategory, ActiveScreen, EstadoItem } from '../types';
import { useUserLocation } from '../context/LocationContext';

interface EventCatalogProps {
  events: EventItem[];
  onNavigate: (screen: ActiveScreen) => void;
  onSelectEvent: (event: EventItem) => void;
  initialQuery?: string;
  onDeleteEvent: (id: string) => void;
  estadosList?: EstadoItem[];
}

const BASE_CATEGORIES = [
  'Todas',
  'Shows',
  'Samba e Pagode',
  'Baile e Nostalgia',
  'Baile Terceira Idade',
  'Forró',
  'Forró Pé de Serra',
];

const getTodayDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateBr = (isoDate: string): string => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export const EventCatalog: React.FC<EventCatalogProps> = ({
  events,
  onNavigate,
  onSelectEvent,
  initialQuery = '',
  onDeleteEvent,
  estadosList: propEstadosList,
}) => {
  const { coords, getDistanceKmTo } = useUserLocation();
  const todayStr = useMemo(() => getTodayDateString(), []);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [estadosList, setEstadosList] = useState<EstadoItem[]>(() => propEstadosList || []);
  const [isLoadingEstados, setIsLoadingEstados] = useState(false);
  const [selectedEstado, setSelectedEstado] = useState<string>('Todos');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [dateError, setDateError] = useState<string>('');
  const [selectionNotice, setSelectionNotice] = useState<string>('');

  // Sincroniza se estadosList vier via props
  useEffect(() => {
    if (propEstadosList && propEstadosList.length > 0) {
      setEstadosList(propEstadosList);
    }
  }, [propEstadosList]);

  // Carrega os dados diretamente da tabela estados do banco de dados SQLite
  useEffect(() => {
    const fetchEstadosFromDb = async () => {
      setIsLoadingEstados(true);
      try {
        let res = await fetch('/api/estados');
        if (!res.ok) {
          res = await fetch('/api/estado');
        }
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setEstadosList(data);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar dados da tabela estados no catálogo:', err);
      } finally {
        setIsLoadingEstados(false);
      }
    };
    fetchEstadosFromDb();
  }, []);

  // Lista ordenada de estados da tabela estados
  const sortedEstados = useMemo(() => {
    return [...estadosList].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
  }, [estadosList]);

  // Controle para não trazer nenhum evento antes de clicar no botão "Selecionar Eventos"
  const [hasExecutedSelection, setHasExecutedSelection] = useState<boolean>(false);

  // Filtros aplicados pelo botão "Selecionar Eventos"
  const [appliedFilters, setAppliedFilters] = useState<{
    category: string;
    estado: string;
    date: string;
    query: string;
  }>({
    category: 'Todas',
    estado: 'Todos',
    date: todayStr,
    query: initialQuery,
  });

  // Dynamic category options from default list and any events registered
  const categoryOptions = useMemo(() => {
    const list = [...BASE_CATEGORIES];
    events.forEach((e) => {
      if (e.category) {
        const exists = list.some(
          (c) =>
            c.toLowerCase().replace(/\s+e\s+/g, ' ') ===
            e.category.toLowerCase().replace(/\s+e\s+/g, ' ')
        );
        if (!exists) {
          list.push(e.category);
        }
      }
    });
    return list;
  }, [events]);

  // Atualiza se o usuário vier de busca inicial ou clique direto no ritmo
  useEffect(() => {
    if (initialQuery) {
      const normalizedInitial = initialQuery.toLowerCase().replace(/\s+e\s+/g, ' ').trim();

      // Tratamento para ritmos e categorias (ex: 'Bailes' -> 'Baile Nostalgia')
      const matchingCategory = categoryOptions.find((c) => {
        const norm = c.toLowerCase().replace(/\s+e\s+/g, ' ').trim();
        if (norm === normalizedInitial) return true;
        if (normalizedInitial === 'bailes' && norm.includes('baile')) return true;
        return false;
      });

      if (matchingCategory && matchingCategory !== 'Todas') {
        setSelectedCategory(matchingCategory);
        setSearchQuery('');
        setAppliedFilters({
          category: matchingCategory,
          estado: 'Todos',
          date: todayStr,
          query: '',
        });
        setHasExecutedSelection(true);
        setSelectionNotice(`Exibindo eventos da categoria "${matchingCategory}".`);
      } else {
        setSearchQuery(initialQuery);
        setAppliedFilters({
          category: 'Todas',
          estado: 'Todos',
          date: todayStr,
          query: initialQuery,
        });
        setHasExecutedSelection(true);
        setSelectionNotice(`Exibindo eventos para a busca "${initialQuery}".`);
      }
    }
  }, [initialQuery, categoryOptions, todayStr]);

  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('praonde_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavoriteIds((prev) => {
      const updated = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem('praonde_favorites', JSON.stringify(updated));
      } catch (err) {
        // ignore
      }
      return updated;
    });
  };

  // Eventos selecionados por categorias, estado (dados da tabela Estado), a partir da data informada e campo liberado = "S"
  // Regra: Não trazer nenhum evento antes de clicar no botão "Selecionar Eventos" (exceto se vier de redirecionamento de busca/ritmo)
  const filteredEvents = useMemo(() => {
    if (!hasExecutedSelection) {
      return [];
    }

    return events
      .filter((event) => {
        // 1. REGRA CRÍTICA: Somente eventos com o campo liberado = "S"
        const isLiberado = (event.liberado || '').trim().toUpperCase() === 'S';
        if (!isLiberado) {
          return false;
        }

        // 2. A partir da data informada (normalização de YYYY-MM-DD para evitar conflitos de hora/fuso)
        if (appliedFilters.date) {
          const eventEnd = event.endDate || event.date;
          const cleanEventDate = (eventEnd || '').split('T')[0].trim();
          const cleanFilterDate = appliedFilters.date.split('T')[0].trim();
          if (cleanEventDate && cleanFilterDate && cleanEventDate < cleanFilterDate) {
            return false;
          }
        }

        // 3. Seleção por Categorias
        if (appliedFilters.category !== 'Todas') {
          const selNorm = appliedFilters.category.toLowerCase().replace(/\s+e\s+/g, ' ').trim();
          const evtNorm = (event.category || '').toLowerCase().replace(/\s+e\s+/g, ' ').trim();
          if (appliedFilters.category !== event.category && selNorm !== evtNorm) {
            return false;
          }
        }

        // 4. Seleção por Estado (dados trazidos da tabela Estado)
        if (appliedFilters.estado !== 'Todos') {
          const selectedRecord = estadosList.find(
            (item) =>
              String(item.id) === appliedFilters.estado ||
              item.estado.toUpperCase() === appliedFilters.estado.toUpperCase() ||
              item.nome.toLowerCase() === appliedFilters.estado.toLowerCase()
          );
          if (selectedRecord) {
            const selNome = selectedRecord.nome.toLowerCase().trim();
            const selUf = (selectedRecord.estado || '').toLowerCase().trim();
            const evtCity = (event.city || '').toLowerCase().trim();
            const evtState = (event.state || '').toLowerCase().trim();

            const matchesCity = evtCity && (evtCity === selNome || evtCity.includes(selNome) || selNome.includes(evtCity));
            const matchesState = evtState && (evtState === selUf || evtState === selNome);

            if (!matchesCity && !matchesState) {
              return false;
            }
          } else {
            const normFilter = appliedFilters.estado.toLowerCase().trim();
            const evtState = (event.state || '').toLowerCase().trim();
            const evtCity = (event.city || '').toLowerCase().trim();
            if (evtState !== normFilter && evtCity !== normFilter && !evtCity.includes(normFilter)) {
              return false;
            }
          }
        }

        // 5. Query de busca textual (se preenchida, com suporte a singular/plural e categoria)
        if (appliedFilters.query.trim()) {
          const q = appliedFilters.query.toLowerCase().trim();
          const singularQ = q.endsWith('s') && q.length > 3 ? q.slice(0, -1) : q;
          const matchTitle = event.title.toLowerCase().includes(q) || event.title.toLowerCase().includes(singularQ);
          const matchDesc = event.description.toLowerCase().includes(q) || event.description.toLowerCase().includes(singularQ);
          const matchCat = (event.category || '').toLowerCase().includes(q) || (event.category || '').toLowerCase().includes(singularQ);
          const matchCity = event.city?.toLowerCase().includes(q);
          const matchState = event.state?.toLowerCase().includes(q);
          const matchLocation = event.locationName.toLowerCase().includes(q);
          const matchTag = event.tags?.some((t) => t.toLowerCase().includes(q) || t.toLowerCase().includes(singularQ));
          if (!matchTitle && !matchDesc && !matchCat && !matchCity && !matchState && !matchLocation && !matchTag) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events, appliedFilters, estadosList, hasExecutedSelection]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSelectedDate(val);
    if (val && val < todayStr) {
      setDateError(`Aviso: a data mínima para exibição é hoje (${formatDateBr(todayStr)}).`);
    } else {
      setDateError('');
    }
  };

  const handleDateBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      setSelectedDate(todayStr);
      setDateError('');
      return;
    }
    if (val < todayStr) {
      setDateError(`Data ajustada para a data de hoje (${formatDateBr(todayStr)}).`);
      setSelectedDate(todayStr);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('Todas');
    setSelectedEstado('Todos');
    setSelectedDate(todayStr);
    setDateError('');
    setSelectionNotice('');
    setHasExecutedSelection(false);
    setAppliedFilters({
      category: 'Todas',
      estado: 'Todos',
      date: todayStr,
      query: '',
    });
  };

  // Executa a seleção de eventos por categorias, estado, a partir da data informada e liberado = "S"
  const handleSelectEvents = () => {
    let effectiveDate = selectedDate || todayStr;
    if (selectedDate && selectedDate < todayStr) {
      effectiveDate = todayStr;
      setSelectedDate(todayStr);
      setDateError(`A data informada era anterior a hoje. Ajustada para hoje (${formatDateBr(todayStr)}).`);
    } else {
      setDateError('');
    }

    setAppliedFilters({
      category: selectedCategory,
      estado: selectedEstado,
      date: effectiveDate,
      query: searchQuery,
    });
    setHasExecutedSelection(true);

    setSelectionNotice('Eventos consultados com sucesso!');
    setTimeout(() => {
      setSelectionNotice('');
    }, 4000);
  };

  // Verifica se há alteração pendente nos campos para o usuário clicar em "Selecionar Eventos"
  const isPendingSelection =
    !hasExecutedSelection ||
    selectedCategory !== appliedFilters.category ||
    selectedEstado !== appliedFilters.estado ||
    selectedDate !== appliedFilters.date ||
    searchQuery.trim() !== appliedFilters.query.trim();

  const hasActiveFilters =
    hasExecutedSelection ||
    searchQuery.trim() !== '' ||
    selectedCategory !== 'Todas' ||
    selectedEstado !== 'Todos' ||
    (selectedDate !== '' && selectedDate !== todayStr) ||
    appliedFilters.query.trim() !== '' ||
    appliedFilters.category !== 'Todas' ||
    appliedFilters.estado !== 'Todos' ||
    (appliedFilters.date !== '' && appliedFilters.date !== todayStr);

  const handleExitAndClear = () => {
    setSearchQuery('');
    setSelectedCategory('Todas');
    setSelectedEstado('Todos');
    setSelectedDate(todayStr);
    setDateError('');
    setSelectionNotice('');
    setHasExecutedSelection(false);
    setAppliedFilters({
      category: 'Todas',
      estado: 'Todos',
      date: todayStr,
      query: '',
    });
    onNavigate('home');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          <button
            id="btn-catalog-sair"
            onClick={handleExitAndClear}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-rose-500/20 text-slate-200 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 text-xs font-bold transition-colors cursor-pointer shadow-sm"
            title="Sair desta tela e limpar toda a visualização"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Sair</span>
          </button>
          <button
            id="btn-catalog-back-home"
            onClick={handleExitAndClear}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Início</span>
          </button>
          <div className="h-4 w-px bg-slate-800 hidden sm:block" />
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">
            Consultar Eventos
          </h1>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {filteredEvents.length} disponíveis
          </span>
          {coords && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Navigation className="w-3 h-3 text-emerald-400" />
              <span>GPS: {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="pt-6 pb-4 space-y-4">
        {/* Main Select Combos & Action Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Category Combo (Dropdown) */}
          <div className="flex-1">
            <div className="relative">
              <select
                id="select-catalog-category"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSearchQuery('');
                }}
                className="w-full py-3 pl-3.5 pr-9 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/60 appearance-none cursor-pointer"
              >
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat} className="bg-slate-900 text-white">
                    {cat === 'Todas' ? 'Categorias' : cat}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Dropdown Estado - Traz os dados da tabela Estado */}
          <div className="flex-1">
            <div className="relative">
              <select
                id="select-catalog-state"
                value={selectedEstado}
                onChange={(e) => setSelectedEstado(e.target.value)}
                className="w-full py-3 pl-3.5 pr-9 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/60 appearance-none cursor-pointer"
              >
                <option value="Todos" className="bg-slate-900 text-white">
                  Estado
                </option>
                {isLoadingEstados && estadosList.length === 0 && (
                  <option value="" disabled className="bg-slate-900 text-slate-400">
                    Carregando tabela estados...
                  </option>
                )}
                {!isLoadingEstados && estadosList.length === 0 && (
                  <option value="" disabled className="bg-slate-900 text-slate-400">
                    Nenhum registro na tabela estados
                  </option>
                )}
                {sortedEstados.map((item) => (
                  <option key={item.id} value={item.estado} className="bg-slate-900 text-white">
                    📍 {item.nome} - {item.estado}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Campo de Data (após Estado) com texto A partir de: */}
          <div className="flex-1 sm:max-w-[270px]">
            <div className="relative flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3.5 h-[46px] focus-within:ring-2 focus-within:ring-amber-500/50 focus-within:border-amber-500/60 transition-all">
              <span className="text-xs font-semibold text-slate-400 whitespace-nowrap mr-2 select-none">
                A partir de:
              </span>
              <input
                id="input-catalog-date"
                type="date"
                min={todayStr}
                value={selectedDate}
                onChange={handleDateChange}
                onBlur={handleDateBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSelectEvents();
                }}
                title="Data dos eventos a partir de (igual ou posterior à data de hoje)"
                className="w-full bg-transparent text-sm text-slate-200 focus:outline-none cursor-pointer [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Selection button after date field */}
          <div className="w-full sm:w-auto">
            <button
              id="btn-catalog-select-events"
              type="button"
              onClick={handleSelectEvents}
              title="Selecionar eventos por categorias, estado, a partir da data informada e campo liberado = 'S'"
              className={`w-full sm:w-auto px-6 py-3 rounded-xl text-slate-950 text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer active:scale-95 ${
                isPendingSelection
                  ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 shadow-amber-500/40 ring-2 ring-amber-400/70'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-amber-500/20 hover:shadow-amber-500/35'
              }`}
            >
              <Filter className="w-4 h-4 text-slate-950" />
              <span>Selecionar Eventos</span>
            </button>
          </div>
        </div>

        {/* Mensagem de erro de consistência de data se houver */}
        {dateError && (
          <div
            id="msg-catalog-date-error"
            className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{dateError}</span>
          </div>
        )}

        {/* Feedback visual de seleção aplicada */}
        {selectionNotice && (
          <div
            id="msg-catalog-selection-notice"
            className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
            <span>{selectionNotice}</span>
          </div>
        )}

        {/* Mensagem após o botão Selecionar Eventos */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <p
            id="msg-advertiser-responsibility"
            className="text-xs sm:text-sm font-medium text-amber-400/90 italic flex items-center gap-1.5"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>As divulgações são de responsabilidade do Anunciante</span>
          </p>

          {/* Filter Summary */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {hasExecutedSelection ? (
              <span>
                Exibindo <strong className="text-white">{filteredEvents.length}</strong> evento(s) liberado(s)
                {appliedFilters.date && (
                  <span className="ml-1 text-amber-400 font-medium">
                    • a partir de {formatDateBr(appliedFilters.date)}
                  </span>
                )}
                {appliedFilters.category !== 'Todas' && (
                  <span className="ml-1 text-slate-300">
                    • {appliedFilters.category}
                  </span>
                )}
                {appliedFilters.estado !== 'Todos' && (
                  <span className="ml-1 text-slate-300">
                    • {(() => {
                      const found = estadosList.find(
                        (item) =>
                          String(item.id) === appliedFilters.estado ||
                          item.estado.toUpperCase() === appliedFilters.estado.toUpperCase() ||
                          item.nome.toLowerCase() === appliedFilters.estado.toLowerCase()
                      );
                      return found ? `${found.nome} - ${found.estado}` : appliedFilters.estado;
                    })()}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-slate-400 italic">
                Aguardando clique no botão <strong className="text-amber-400 font-semibold not-italic">"Selecionar Eventos"</strong>
              </span>
            )}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-amber-400 hover:underline flex items-center gap-1 ml-2 font-medium cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpar filtros</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Events Grid or Initial / Empty State */}
      {!hasExecutedSelection ? (
        <div className="text-center py-16 px-4 bg-slate-900/40 rounded-2xl border border-slate-800/80 mt-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <SlidersHorizontal className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Consulta de Eventos</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
            Selecione as opções desejadas de <strong>Categorias</strong>, <strong>Estado</strong> e <strong>Data</strong> nos campos acima e clique no botão{' '}
            <strong className="text-amber-400">"Selecionar Eventos"</strong> para carregar os eventos.
          </p>
          <div className="flex items-center justify-center">
            <button
              id="btn-trigger-select-events"
              type="button"
              onClick={handleSelectEvents}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Selecionar Eventos Agora</span>
            </button>
          </div>
        </div>
      ) : filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          {filteredEvents.map((event) => {
            const isFav = favoriteIds.includes(event.id);

            return (
              <div
                key={event.id}
                onClick={() => onSelectEvent(event)}
                className="group relative bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl overflow-hidden shadow-lg transition-all duration-200 flex flex-col justify-between cursor-pointer"
              >
                {/* Cartaz no Padrão Vertical (3:4) */}
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-950 flex items-center justify-center">
                  {/* Blur ambiente de fundo */}
                  <img
                    src={event.imageUrl}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover filter blur-xl opacity-30 scale-110 pointer-events-none"
                  />
                  {/* Imagem do cartaz no formato vertical */}
                  <img
                    src={event.imageUrl}
                    alt={event.title}
                    className="relative z-10 w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 z-20 bg-gradient-to-t from-slate-900 via-transparent to-transparent pointer-events-none" />

                  {/* Badge de Data no topo esquerdo */}
                  <div className="absolute top-3 left-3 z-30 bg-slate-950/90 backdrop-blur-sm rounded-xl p-1 px-2.5 text-center border border-slate-700/60 shadow-lg">
                    <span className="block text-[10px] font-bold uppercase text-amber-400">
                      {new Date(event.date + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                    </span>
                    <span className="block text-base font-extrabold text-white leading-none">
                      {new Date(event.date + 'T12:00:00').getDate()}
                    </span>
                  </div>

                  {/* Favorite Button */}
                  <button
                    onClick={(e) => toggleFavorite(e, event.id)}
                    className={`absolute top-3 right-3 z-30 p-2 rounded-full backdrop-blur-md transition-transform active:scale-90 ${
                      isFav
                        ? 'bg-rose-500 text-white shadow-md'
                        : 'bg-slate-950/70 hover:bg-slate-950 text-slate-300 border border-slate-700/60'
                    }`}
                    title={isFav ? 'Remover dos salvos' : 'Salvar evento'}
                  >
                    <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                  </button>

                  {/* Category Pill */}
                  <div className="absolute bottom-2 left-3 z-30">
                    <span className="inline-block text-[11px] font-semibold text-amber-300 bg-slate-950/90 px-2.5 py-0.5 rounded-md backdrop-blur-sm border border-amber-500/20 shadow">
                      {event.category}
                    </span>
                  </div>

                  {/* Price Pill */}
                  <div className="absolute bottom-2 right-3 z-30">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm shadow-sm ${
                      event.isFree
                        ? 'bg-emerald-500 text-slate-950 font-extrabold'
                        : 'bg-slate-950/90 text-amber-300 border border-amber-500/30'
                    }`}>
                      {event.isFree
                        ? 'Gratuito'
                        : (event.price ? `R$ ${event.price.toFixed(2).replace('.', ',')}` : (event.priceDetails || 'Consulte'))}
                    </span>
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base sm:text-lg group-hover:text-amber-400 transition-colors line-clamp-1 mb-1.5">
                      {event.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                      {event.description?.trim() || 'Consulte os detalhes do evento para mais informações.'}
                    </p>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span>{new Date(event.date + 'T12:00:00').toLocaleDateString('pt-BR')} • {event.time}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span className="truncate" title={`${event.locationName} (${event.city} - ${event.state})`}>
                        {event.locationName} ({event.city} - {(() => {
                          const est = estadosList.find(
                            (e) =>
                              (e.estado && e.estado.toUpperCase() === (event.state || '').toUpperCase()) ||
                              (e.nome && e.nome.toLowerCase() === (event.state || '').toLowerCase()) ||
                              String(e.id) === (event.state || '')
                          );
                          return est ? est.estado : (event.state || '');
                        })()})
                      </span>
                    </div>

                    {/* Distância calculada em tempo real com base na latitude e longitude exatas */}
                    {(() => {
                      const distKm = getDistanceKmTo(event.latitude, event.longitude);
                      if (distKm === null) return null;
                      return (
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                          <Navigation className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                          <span>{distKm < 1 ? 'A menos de 1 km de você' : `Aprox. ${distKm} km de você`}</span>
                        </div>
                      );
                    })()}

                    {/* View Details button */}
                    <div className="pt-2 flex items-center justify-between text-xs text-amber-400 font-bold group-hover:text-amber-300">
                      <span>Ver detalhes completos</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-16 px-4 bg-slate-900/40 rounded-2xl border border-slate-800/80 mt-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Nenhum evento encontrado</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
            Não encontramos eventos com os filtros selecionados. Experimente ajustar os termos de busca ou limpar os filtros.
          </p>
          <div className="flex items-center justify-center">
            <button
              onClick={clearFilters}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
