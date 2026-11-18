import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  Calendar,
  MapPin, 
  ArrowLeft, 
  Heart, 
  DollarSign,
  Sparkles,
  ChevronRight,
  ChevronDown,
  X,
  AlertCircle,
  Navigation,
  RefreshCw,
  Music,
  Play,
  Video
} from 'lucide-react';
import { EventItem, EventCategory, ActiveScreen, EstadoItem } from '../types';
import { useUserLocation } from '../context/LocationContext';
import { VideoPlayer } from './VideoPlayer';
import { isVideoFormatUrl, parseVideoUrl } from '../lib/videoUtils';

interface EventCatalogProps {
  events: EventItem[];
  onNavigate: (screen: ActiveScreen) => void;
  onSelectEvent: (event: EventItem) => void;
  initialQuery?: string;
  initialCategory?: string;
  initialEstado?: string;
  initialDate?: string;
  initialSortByProximity?: boolean;
  onDeleteEvent: (id: string) => void;
  estadosList?: EstadoItem[];
  onRefreshEvents?: () => void;
  categoriesList?: string[];
}

const BASE_CATEGORIES = [
  'Show',
  'Samba e Pagode',
  'Baile Nostalgia',
  'Baile Terceira Idade',
  'Forró',
  'Forró Pé de Serra',
  'Bailes',
  'Festas',
  'Teatro',
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
  initialCategory,
  initialEstado,
  initialDate,
  initialSortByProximity,
  onDeleteEvent,
  estadosList: propEstadosList,
  onRefreshEvents,
  categoriesList: propCategoriesList,
}) => {
  const { coords, requestLocation, getDistanceKmTo } = useUserLocation();
  const initialQueryAppliedRef = useRef<string | null>(null);
  const todayStr = useMemo(() => getTodayDateString(), []);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'Show');
  const [estadosList, setEstadosList] = useState<EstadoItem[]>(() => propEstadosList || []);
  const [isLoadingEstados, setIsLoadingEstados] = useState(false);
  const [selectedEstado, setSelectedEstado] = useState<string>(initialEstado || 'Todos');
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || todayStr);
  const [sortByProximity, setSortByProximity] = useState<boolean>(initialSortByProximity !== undefined ? initialSortByProximity : true);
  const [dateError, setDateError] = useState<string>('');
  const [selectionNotice, setSelectionNotice] = useState<string>('');
  const [isSearchingDb, setIsSearchingDb] = useState<boolean>(false);
  const [dbEvents, setDbEvents] = useState<EventItem[] | null>(null);
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [filterOnlyVideos, setFilterOnlyVideos] = useState<boolean>(false);
  const [cardMediaMode, setCardMediaMode] = useState<Record<string, 'video' | 'poster'>>({});

  // Carrega categorias cadastradas na tabela SQLite
  useEffect(() => {
    const fetchCategoriesFromDb = async () => {
      try {
        let res = await fetch('/api/categories');
        if (!res.ok) {
          res = await fetch('/api/categorias');
        }
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const names = data
              .map((c: any) => (typeof c === 'string' ? c : c.nome))
              .filter((n: string) => n && n !== 'Categoria');
            setDbCategories(names);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar categorias no catálogo:', err);
      }
    };
    fetchCategoriesFromDb();
  }, []);

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

  // Trazer os registros ao consultar eventos com data >= hoje por padrão
  const [hasExecutedSelection, setHasExecutedSelection] = useState<boolean>(true);

  // Filtros aplicados pelo botão "Consultar Eventos"
  const [appliedFilters, setAppliedFilters] = useState<{
    category: string;
    estado: string;
    date: string;
    query: string;
    sortByProximity: boolean;
  }>(() => ({
    category: initialCategory || 'Show',
    estado: initialEstado || 'Todos',
    date: initialDate || todayStr,
    query: initialQuery,
    sortByProximity: initialSortByProximity !== undefined ? initialSortByProximity : true,
  }));

  // Dynamic category options from default list, DB categories, props, and any events registered
  const categoryOptions = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    const addCat = (catName: string) => {
      if (!catName) return;
      const clean = catName.trim();
      const lower = clean.toLowerCase();
      if (!lower || lower === 'todas' || lower === 'categoria') return;

      // Padroniza 'shows' -> 'Show'
      const display = lower === 'shows' ? 'Show' : clean;
      const normKey = display.toLowerCase().replace(/\s+e\s+/g, ' ');

      if (!seen.has(normKey)) {
        seen.add(normKey);
        list.push(display);
      }
    };

    // 1. Categorias base
    BASE_CATEGORIES.forEach(addCat);

    // 2. Categorias passadas via props
    (propCategoriesList || []).forEach(addCat);

    // 3. Categorias vindas do banco SQLite
    dbCategories.forEach(addCat);

    // 4. Categorias presentes nos eventos
    events.forEach((e) => {
      if (e.category) {
        addCat(e.category);
      }
    });

    return list;
  }, [events, propCategoriesList, dbCategories]);

  // Atualiza se o usuário vier de busca inicial ou clique direto no ritmo
  useEffect(() => {
    if (initialQuery && initialQueryAppliedRef.current !== initialQuery) {
      initialQueryAppliedRef.current = initialQuery;
      const normalizedInitial = initialQuery.toLowerCase().replace(/\s+e\s+/g, ' ').trim();

      // Tratamento para ritmos e categorias (ex: 'Shows' -> 'Show')
      const matchingCategory = categoryOptions.find((c) => {
        const norm = c.toLowerCase().replace(/\s+e\s+/g, ' ').trim();
        if (norm === normalizedInitial) return true;
        if ((normalizedInitial === 'shows' || normalizedInitial === 'show') && (norm === 'show' || norm === 'shows')) return true;
        return false;
      });

      const chosenCategory = matchingCategory || categoryOptions[0] || 'Show';
      setSelectedCategory(chosenCategory);

      if (matchingCategory) {
        setSearchQuery('');
        setSelectedEstado('Todos');
        setHasExecutedSelection(true);
        setAppliedFilters({
          category: chosenCategory,
          estado: 'Todos',
          date: todayStr,
          query: '',
          sortByProximity: sortByProximity,
        });
        setSelectionNotice(`Ritmo "${chosenCategory}" selecionado. Exibindo eventos disponíveis.`);
        handleSelectEvents({
          category: chosenCategory,
          estado: 'Todos',
          date: todayStr,
          query: '',
        });
      } else {
        setSearchQuery(initialQuery);
        setAppliedFilters({
          category: chosenCategory,
          estado: 'Todos',
          date: todayStr,
          query: initialQuery,
          sortByProximity: sortByProximity,
        });
        setHasExecutedSelection(true);
        setSelectionNotice(`Exibindo eventos para a busca "${initialQuery}".`);
        handleSelectEvents({
          category: chosenCategory,
          estado: 'Todos',
          date: todayStr,
          query: initialQuery,
        });
      }
    }
  }, [initialQuery, categoryOptions, todayStr, sortByProximity]);

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

  // Helper para obter a URL de vídeo de forma extremamente robusta e unificada (idêntica ao modal de detalhes)
  const getEventVideoUrl = (event: EventItem | any): string => {
    if (!event) return '';
    
    // 1. Prioriza campos dedicados de vídeo cadastrados no SQLite/Firestore
    const vid = (event.video_url || event.video_utl || event.videoUrl || '').trim();
    if (vid && vid !== '[video_local_sqlite]') {
      return vid;
    }
    
    // 2. Analisa o campo genérico de URL/Url apenas se for de formato de vídeo válido
    const rawUrl = (event.url || event.Url || '').trim();
    if (rawUrl && rawUrl !== '[video_local_sqlite]') {
      if (isVideoFormatUrl(rawUrl) || rawUrl.startsWith('data:video/')) {
        return rawUrl;
      }
    }
    
    // 3. Se for do tipo de mídia vídeo, aceita o url genérico como fallback se ele não for uma imagem estática
    if (event.mediaType === 'video' || event.media_type === 'video') {
      if (rawUrl && rawUrl !== '[video_local_sqlite]' && !isValidEventImage(rawUrl)) {
        return rawUrl;
      }
    }
    
    return '';
  };

  // Helper estrito: valida se o evento possui mídia válida (imagem válida OU vídeo cadastrado)
  const hasValidEventMedia = (event: EventItem | any): boolean => {
    if (!event) return false;
    const vid = getEventVideoUrl(event);
    if (vid) return true;
    return isValidEventImage(event.imageUrl) && !failedImageIds.has(event.id);
  };

  // Helper estrito: valida se uma URL de imagem é formalmente válida (http/https/data)
  const isValidEventImage = (url?: string | null): boolean => {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed) return false;
    return (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:image/')
    );
  };

  // Rastreador de imagens com falha de carregamento no navegador para não exibir telas pretas
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());

  // Eventos selecionados por categoria, estado e data do evento >= data informada com campo liberado = "S"
  // No índice será: categoria, estado, data do evento
  // DEDUPLICAÇÃO ESTRITA: nunca exibir eventos repetidos na tela de consulta
  const filteredEvents = useMemo(() => {
    if (!hasExecutedSelection) {
      return [];
    }

    const rawList = dbEvents !== null 
      ? dbEvents.filter((event) => {
          if (!hasValidEventMedia(event)) return false;
          if (filterOnlyVideos && !getEventVideoUrl(event)) return false;
          return true;
        }) 
      : events.filter((event) => {
      // 0. REGRA OBRIGATÓRIA: Somente eventos COM mídia válida (imagem funcional OU vídeo cadastrado)
      if (!hasValidEventMedia(event)) {
        return false;
      }

      // Filtro opcional: apenas com vídeo
      if (filterOnlyVideos && !getEventVideoUrl(event)) {
        return false;
      }

      // 1. REGRA CRÍTICA: Somente eventos com o campo liberado = "S"
      const isLiberado = (event.liberado || '').trim().toUpperCase() === 'S';
      if (!isLiberado) {
        return false;
      }

      // 2. Data evento igual ou maior data informada
      const targetDate = appliedFilters.date || todayStr;
      if (targetDate) {
        const eventEnd = event.endDate || event.date;
        const cleanEventDate = (eventEnd || '').split('T')[0].trim();
        const cleanFilterDate = targetDate.split('T')[0].trim();
        if (cleanEventDate && cleanFilterDate && cleanEventDate < cleanFilterDate) {
          return false;
        }
      }

      // 3. Seleção categoria evento igual categoria informada
      if (appliedFilters.category) {
        const selNorm = appliedFilters.category.toLowerCase().replace(/\s+e\s+/g, ' ').trim();
        const evtNorm = (event.category || '').toLowerCase().replace(/\s+e\s+/g, ' ').trim();
        const isShowMatch = (selNorm === 'show' || selNorm === 'shows') && (evtNorm === 'show' || evtNorm === 'shows');
        const isBaileMatch = (selNorm === 'bailes' && (evtNorm.includes('baile') || evtNorm.includes('melhor idade') || evtNorm.includes('terceira idade')));
        
        if (
          appliedFilters.category.trim().toLowerCase() !== (event.category || '').trim().toLowerCase() &&
          selNorm !== evtNorm &&
          !isShowMatch &&
          !isBaileMatch
        ) {
          return false;
        }
      }

      // 4. Estado evento igual estado informado
      if (appliedFilters.estado !== 'Todos') {
        const selectedRecord = estadosList.find(
          (item) =>
            String(item.id) === appliedFilters.estado ||
            item.estado.toUpperCase() === appliedFilters.estado.toUpperCase() ||
            item.nome.toLowerCase() === appliedFilters.estado.toLowerCase()
        );
        const targetUf = selectedRecord ? (selectedRecord.estado || '').trim().toUpperCase() : appliedFilters.estado.trim().toUpperCase();
        const targetNome = selectedRecord ? (selectedRecord.nome || '').trim().toUpperCase() : appliedFilters.estado.trim().toUpperCase();
        const evtState = (event.state || '').trim().toUpperCase();

        if (evtState !== targetUf && evtState !== targetNome) {
          return false;
        }
      }

      // 5. Query de busca textual
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
    });

    // DEDUPLICAÇÃO ESTRITA: nunca trazer eventos repetidos na tela de consulta
    const seenEventKeys = new Set<string>();
    const uniqueEvents: EventItem[] = [];

    for (const item of rawList) {
      if (!item) continue;
      // REGRA OBRIGATÓRIA: Somente eventos com mídia válida (imagem válida OU vídeo cadastrado)
      if (!hasValidEventMedia(item)) continue;
      const idKey = (item.id || '').trim().toLowerCase();
      const normTitle = (item.title || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/gi, '')
        .replace(/\s+/g, ' ');
      const dateKey = (item.date || '').split('T')[0].trim();
      const normCity = (item.city || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      const semanticKey = `${normTitle}__${dateKey}__${normCity}`;
      const titleDateKey = `${normTitle}__${dateKey}`;

      if (idKey && seenEventKeys.has(`id:${idKey}`)) {
        continue;
      }
      if (normTitle && dateKey && (seenEventKeys.has(`sem:${semanticKey}`) || seenEventKeys.has(`td:${titleDateKey}`))) {
        continue;
      }

      if (idKey) seenEventKeys.add(`id:${idKey}`);
      if (normTitle && dateKey) {
        seenEventKeys.add(`sem:${semanticKey}`);
        seenEventKeys.add(`td:${titleDateKey}`);
      }
      uniqueEvents.push(item);
    }

    const sorted = uniqueEvents.sort((a, b) => {
      // 1. Estado (UF) - Ordem alfabética
      const stateA = a.state || '';
      const stateB = b.state || '';
      const cmpState = stateA.localeCompare(stateB, 'pt-BR');
      if (cmpState !== 0) return cmpState;

      // 2. Categoria - Ordem alfabética
      const catA = a.category || '';
      const catB = b.category || '';
      const cmpCat = catA.localeCompare(catB, 'pt-BR');
      if (cmpCat !== 0) return cmpCat;

      // 3. Data do evento - Cronológica
      const dateA = a.date || '';
      const dateB = b.date || '';
      const cmpDate = dateA.localeCompare(dateB);
      if (cmpDate !== 0) return cmpDate;

      // 4. Proximidade do solicitante (se ativo)
      if (appliedFilters.sortByProximity) {
        const distA = typeof a.distanceKm === 'number' ? a.distanceKm : (coords ? (getDistanceKmTo(a.latitude, a.longitude) ?? 999999) : 999999);
        const distB = typeof b.distanceKm === 'number' ? b.distanceKm : (coords ? (getDistanceKmTo(b.latitude, b.longitude) ?? 999999) : 999999);
        if (distA !== distB) return distA - distB;
      }

      // 5. Horário (como critério de desempate secundário)
      const cmpTime = (a.time || '').localeCompare(b.time || '');
      if (cmpTime !== 0) return cmpTime;

      return (a.id || '').localeCompare(b.id || '');
    });

    // Limitar para mostrar até 20 eventos após ou igual a data solicitada
    return sorted.slice(0, 20);
  }, [events, dbEvents, appliedFilters, estadosList, hasExecutedSelection, todayStr, coords, getDistanceKmTo, filterOnlyVideos]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSelectedDate(val);
    if (val && val < todayStr) {
      setDateError(`Aviso: a data mínima para exibição é hoje (${formatDateBr(todayStr)}).`);
    } else {
      setDateError('');
      handleSelectEvents({ date: val });
    }
  };

  const handleDateBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      setSelectedDate(todayStr);
      setDateError('');
      handleSelectEvents({ date: todayStr });
      return;
    }
    if (val < todayStr) {
      setDateError(`Data ajustada para a data de hoje (${formatDateBr(todayStr)}).`);
      setSelectedDate(todayStr);
      handleSelectEvents({ date: todayStr });
    }
  };

  // Executa a busca dos registros na tabela de eventos do banco SQLite filtrando por categoria, estado e data do evento >= data informada
  const handleSelectEvents = async (overrideFilters?: {
    category?: string;
    estado?: string;
    date?: string;
    query?: string;
    sortByProximity?: boolean;
  }) => {
    const catToUse = overrideFilters?.category !== undefined ? overrideFilters.category : selectedCategory;
    const estToUse = overrideFilters?.estado !== undefined ? overrideFilters.estado : selectedEstado;
    const dateToUse = overrideFilters?.date !== undefined ? overrideFilters.date : selectedDate;
    const queryToUse = overrideFilters?.query !== undefined ? overrideFilters.query : searchQuery;
    const proximityToUse = overrideFilters?.sortByProximity !== undefined ? overrideFilters.sortByProximity : sortByProximity;

    let effectiveDate = dateToUse || todayStr;
    if (dateToUse && dateToUse < todayStr) {
      effectiveDate = todayStr;
      setSelectedDate(todayStr);
      setDateError(`A data informada era anterior a hoje. Ajustada para hoje (${formatDateBr(todayStr)}).`);
    } else {
      setDateError('');
    }

    setAppliedFilters({
      category: catToUse,
      estado: estToUse,
      date: effectiveDate,
      query: queryToUse,
      sortByProximity: proximityToUse,
    });

    setIsSearchingDb(true);
    setSelectionNotice(
      proximityToUse 
        ? 'Buscando registros ordenados por Estado, Categoria, Data e Proximidade...' 
        : 'Buscando registros na Tabela de Eventos...'
    );

    try {
      const params = new URLSearchParams();
      if (catToUse) {
        params.set('category', catToUse);
      }
      if (estToUse && estToUse !== 'Todos') {
        params.set('estado', estToUse);
      }
      if (effectiveDate) {
        params.set('date', effectiveDate);
      }
      params.set('liberado', 'S');
      params.set('com_imagem', 'true');
      params.set('has_image', 'true');
      params.set('limit', '20'); // Limitar para 20 eventos após ou igual a data solicitada

      if (proximityToUse) {
        params.set('mais_proximos', 'true');
        params.set('order_by', 'proximidade');
        if (coords) {
          params.set('user_lat', String(coords.latitude));
          params.set('user_lng', String(coords.longitude));
        } else {
          try {
            const saved = localStorage.getItem('praonde_last_user_coords');
            if (saved) {
              const parsed = JSON.parse(saved);
              if (parsed?.latitude && parsed?.longitude) {
                params.set('user_lat', String(parsed.latitude));
                params.set('user_lng', String(parsed.longitude));
              }
            }
          } catch {
            // ignore
          }
        }
      }

      if (queryToUse.trim()) {
        params.set('search', queryToUse.trim());
      }

      const res = await fetch(`/api/events?${params.toString()}`);
      if (res.ok) {
        const data: EventItem[] = await res.json();
        if (Array.isArray(data)) {
          const seen = new Set<string>();
          const dedupedData = data.filter((ev) => {
            if (!ev) return false;
            // REGRA OBRIGATÓRIA: Somente eventos com mídia válida (imagem funcional OU vídeo cadastrado)
            if (!hasValidEventMedia(ev)) return false;
            const normTitle = (ev.title || '').trim().toLowerCase();
            const dateKey = (ev.date || '').split('T')[0].trim();
            const normCity = (ev.city || '').trim().toLowerCase();
            const k = `${normTitle}__${dateKey}__${normCity}`;
            if (seen.has(k) || (ev.id && seen.has(ev.id))) return false;
            if (ev.id) seen.add(ev.id);
            if (normTitle && dateKey) seen.add(k);
            return true;
          });

          // Preenche distância no cliente se não retornou do servidor
          dedupedData.forEach((ev) => {
            if (ev.distanceKm === undefined && coords) {
              const d = getDistanceKmTo(ev.latitude, ev.longitude);
              if (d !== null) ev.distanceKm = d;
            }
          });

          dedupedData.sort((a, b) => {
            // 1. Estado (UF) - Ordem alfabética
            const stateA = a.state || '';
            const stateB = b.state || '';
            const cmpState = stateA.localeCompare(stateB, 'pt-BR');
            if (cmpState !== 0) return cmpState;

            // 2. Categoria - Ordem alfabética
            const catA = a.category || '';
            const catB = b.category || '';
            const cmpCat = catA.localeCompare(catB, 'pt-BR');
            if (cmpCat !== 0) return cmpCat;

            // 3. Data do evento - Cronológica
            const dateA = a.date || '';
            const dateB = b.date || '';
            const cmpDate = dateA.localeCompare(dateB);
            if (cmpDate !== 0) return cmpDate;

            // 4. Proximidade geográfica (distância) - Os mais próximos primeiro
            if (proximityToUse) {
              const distA = typeof a.distanceKm === 'number' ? a.distanceKm : 999999;
              const distB = typeof b.distanceKm === 'number' ? b.distanceKm : 999999;
              if (distA !== distB) return distA - distB;
            }

            // 5. Horário
            const cmpTime = (a.time || '').localeCompare(b.time || '');
            if (cmpTime !== 0) return cmpTime;

            return (a.id || '').localeCompare(b.id || '');
          });

          const limitedData = dedupedData.slice(0, 20);
          setDbEvents(limitedData);
          setHasExecutedSelection(true);
          const count = limitedData.length;
          setSelectionNotice(
            proximityToUse
              ? `Consulta realizada! Exibindo ${count} evento${count !== 1 ? 's' : ''} classificados por Estado, Categoria, Data e Proximidade (limite de 20) a partir de ${formatDateBr(effectiveDate)}.`
              : `Consulta realizada! Exibindo ${count} evento${count !== 1 ? 's' : ''} (limite de 20) a partir de ${formatDateBr(effectiveDate)}.`
          );
          if (onRefreshEvents) {
            onRefreshEvents();
          }
          return;
        }
      }
      throw new Error('Falha ao consultar a tabela de eventos no servidor');
    } catch (err) {
      console.warn('Erro ao consultar /api/events no backend SQLite:', err);
      // Fallback local se a API apresentar instabilidade
      setDbEvents(null);
      setHasExecutedSelection(true);
      setSelectionNotice('Consulta realizada na base de eventos.');
    } finally {
      setIsSearchingDb(false);
      setTimeout(() => {
        setSelectionNotice('');
      }, 5000);
    }
  };

  // Trazer automaticamente todos os registros no carregamento
  useEffect(() => {
    handleSelectEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearFilters = () => {
    const defaultCat = categoryOptions[0] || 'Show';
    setSearchQuery('');
    setSelectedCategory(defaultCat);
    setSelectedEstado('Todos');
    setSelectedDate(todayStr);
    setSortByProximity(true);
    setDateError('');
    setSelectionNotice('');
    setHasExecutedSelection(true);
    setDbEvents(null);
    setAppliedFilters({
      category: defaultCat,
      estado: 'Todos',
      date: todayStr,
      query: '',
      sortByProximity: true,
    });
    handleSelectEvents({
      category: defaultCat,
      estado: 'Todos',
      date: todayStr,
      query: '',
      sortByProximity: true,
    });
  };

  // Verifica se há alteração pendente nos campos para o usuário clicar em "Consultar Eventos"
  const isPendingSelection =
    !hasExecutedSelection ||
    selectedCategory !== appliedFilters.category ||
    selectedEstado !== appliedFilters.estado ||
    selectedDate !== appliedFilters.date ||
    sortByProximity !== appliedFilters.sortByProximity ||
    searchQuery.trim() !== appliedFilters.query.trim();

  const defaultCat = categoryOptions[0] || 'Show';
  const hasActiveFilters =
    hasExecutedSelection ||
    searchQuery.trim() !== '' ||
    selectedCategory !== defaultCat ||
    selectedEstado !== 'Todos' ||
    (selectedDate !== '' && selectedDate !== todayStr) ||
    !sortByProximity ||
    appliedFilters.query.trim() !== '' ||
    appliedFilters.category !== defaultCat ||
    appliedFilters.estado !== 'Todos' ||
    (appliedFilters.date !== '' && appliedFilters.date !== todayStr);

  const handleExitAndClear = () => {
    const defaultCat = categoryOptions[0] || 'Show';
    setSearchQuery('');
    setSelectedCategory(defaultCat);
    setSelectedEstado('Todos');
    setSelectedDate(todayStr);
    setSortByProximity(true);
    setDateError('');
    setSelectionNotice('');
    setHasExecutedSelection(true);
    setDbEvents(null);
    setAppliedFilters({
      category: defaultCat,
      estado: 'Todos',
      date: todayStr,
      query: '',
      sortByProximity: true,
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
            {filteredEvents.length} disponíveis (limite de 20)
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
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Category Combo (Dropdown) */}
          <div className="flex-1 min-w-[140px]">
            <div className="relative">
              <select
                id="select-catalog-category"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSearchQuery('');
                  handleSelectEvents({ category: e.target.value, query: '' });
                }}
                className="w-full py-3 pl-3.5 pr-9 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/60 appearance-none cursor-pointer"
              >
                {categoryOptions.length === 0 ? (
                  <option value="" disabled>Carregando categorias...</option>
                ) : (
                  categoryOptions.map((cat) => (
                    <option key={cat} value={cat} className="bg-slate-900 text-white">
                      {cat}
                    </option>
                  ))
                )}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Dropdown Estado - Traz os dados da tabela Estado */}
          <div className="flex-1 min-w-[140px]">
            <div className="relative">
              <select
                id="select-catalog-state"
                value={selectedEstado}
                onChange={(e) => {
                  setSelectedEstado(e.target.value);
                  handleSelectEvents({ estado: e.target.value });
                }}
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
          <div className="flex-1 min-w-[210px] lg:max-w-[250px]">
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
                title="Data dos eventos a partir de (exibe até 20 eventos após ou igual à data informada)"
                className="w-full bg-transparent text-sm text-slate-200 focus:outline-none cursor-pointer [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Parâmetro de Proximidade: A partir dos mais próximos do solicitante */}
          <div className="w-full lg:w-auto">
            <button
              id="btn-catalog-proximity-param"
              type="button"
              onClick={() => {
                const nextVal = !sortByProximity;
                setSortByProximity(nextVal);
                if (nextVal && !coords) {
                  requestLocation();
                }
                handleSelectEvents({ sortByProximity: nextVal });
              }}
              title="Mais Próximos: Classifica por Estado, Categoria, Data do evento e Proximidade do solicitante (limite de 20 registros)"
              className={`w-full lg:w-auto px-3.5 h-[46px] rounded-xl text-xs sm:text-sm font-semibold border transition-all flex items-center justify-between lg:justify-center gap-2 cursor-pointer select-none active:scale-95 whitespace-nowrap ${
                sortByProximity
                  ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 shadow-sm shadow-amber-500/10 ring-1 ring-amber-500/30 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Navigation className={`w-4 h-4 shrink-0 transition-transform ${sortByProximity ? 'text-amber-400 rotate-45' : 'text-slate-500'}`} />
                <span>Mais próximos</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${sortByProximity ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                {sortByProximity ? 'Ativo' : 'Desat.'}
              </span>
            </button>
          </div>

          {/* Filtro rápido: Com Vídeo */}
          <div className="flex-none">
            <button
              id="btn-catalog-filter-video"
              type="button"
              onClick={() => setFilterOnlyVideos((prev) => !prev)}
              title="Exibir na consulta somente eventos com vídeo"
              className={`w-full lg:w-auto px-3.5 h-[46px] rounded-xl text-xs sm:text-sm font-semibold border transition-all flex items-center justify-between lg:justify-center gap-2 cursor-pointer select-none active:scale-95 whitespace-nowrap ${
                filterOnlyVideos
                  ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 shadow-sm shadow-amber-500/10 ring-1 ring-amber-500/30'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Play className={`w-3.5 h-3.5 ${filterOnlyVideos ? 'fill-amber-400 text-amber-400' : 'fill-slate-500 text-slate-500'}`} />
                <span>Com Vídeo</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${filterOnlyVideos ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                {filterOnlyVideos ? 'Ativo' : 'Todos'}
              </span>
            </button>
          </div>

          {/* Selection button after date field and proximity parameter */}
          <div className="w-full lg:w-auto">
            <button
              id="btn-catalog-select-events"
              type="button"
              onClick={() => handleSelectEvents()}
              disabled={isSearchingDb}
              title="Consultar eventos (limite de 20 eventos após ou igual à data solicitada a partir dos mais próximos)"
              className={`w-full lg:w-auto px-6 py-3 rounded-xl text-slate-950 text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer active:scale-95 disabled:opacity-70 ${
                isPendingSelection
                  ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 shadow-amber-500/40 ring-2 ring-amber-400/70'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-amber-500/20 hover:shadow-amber-500/35'
              }`}
            >
              {isSearchingDb ? (
                <>
                  <RefreshCw className="w-4 h-4 text-slate-950 animate-spin" />
                  <span>Consultando Tabela de Eventos...</span>
                </>
              ) : (
                <>
                  <Filter className="w-4 h-4 text-slate-950" />
                  <span>Consultar Eventos</span>
                </>
              )}
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
                {appliedFilters.category && (
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
                {appliedFilters.sortByProximity && (
                  <span className="ml-1 text-emerald-400 font-semibold">
                    • ordenados por Estado, Categoria, Data e Proximidade (limite 20)
                  </span>
                )}
              </span>
            ) : (
              <span className="text-slate-400 italic">
                Aguardando clique no botão <strong className="text-amber-400 font-semibold not-italic">"Consultar Eventos"</strong>
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
      {!hasExecutedSelection ? null : filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          {filteredEvents.map((event) => {
            const isFav = favoriteIds.includes(event.id);
            const vidUrl = getEventVideoUrl(event);
            const hasVideo = Boolean(vidUrl);
            const currentMode = cardMediaMode[event.id] || (hasVideo ? 'video' : 'poster');
            const parsedVideo = hasVideo ? parseVideoUrl(vidUrl) : null;
            const isDirectVideo = Boolean(parsedVideo?.isDirectVideo || vidUrl.startsWith('data:video/') || /\.(mp4|webm|ogg|mov|m4v)($|\?)/i.test(vidUrl));

            return (
              <div
                key={event.id}
                onClick={() => onSelectEvent(event)}
                className="group relative bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl overflow-hidden shadow-lg transition-all duration-200 flex flex-col justify-between cursor-pointer"
              >
                {/* Cartaz ou Vídeo no Padrão Vertical (3:4) */}
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-950 flex items-center justify-center">
                  {/* Quando for vídeo, traz o vídeo diretamente no lugar da tela padrão (imagem) */}
                  {hasVideo ? (
                    <div 
                      className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isDirectVideo ? (
                        <video
                          key={vidUrl}
                          src={vidUrl}
                          controls
                          autoPlay
                          muted
                          loop
                          playsInline
                          preload="auto"
                          className="relative z-10 w-full h-full object-cover"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Seu navegador não suporta reprodução de vídeo.
                        </video>
                      ) : (
                        <div className="w-full h-full relative z-10 flex flex-col justify-center overflow-hidden">
                          <VideoPlayer
                            videoUrl={vidUrl}
                            title={event.title}
                            autoPlay={true}
                            className="w-full h-full border-0 rounded-none shadow-none"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Visualização do Cartaz com Imagem */
                    <>
                      {/* Blur ambiente de fundo */}
                      {isValidEventImage(event.imageUrl) && (
                        <img
                          src={event.imageUrl}
                          alt=""
                          aria-hidden="true"
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 w-full h-full object-cover filter blur-xl opacity-30 scale-110 pointer-events-none"
                        />
                      )}
                      {/* Imagem do cartaz no formato vertical */}
                      <img
                        src={event.imageUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80'}
                        alt={event.title}
                        className="relative z-10 w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                        onError={() => {
                          if (!hasVideo) {
                            setFailedImageIds((prev) => {
                              const next = new Set(prev);
                              next.add(event.id);
                              return next;
                            });
                          }
                        }}
                      />
                      <div className="absolute inset-0 z-20 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent pointer-events-none" />
                    </>
                  )}

                  {/* Badge de Data no topo esquerdo */}
                  <div className="absolute top-2 left-2 z-30 flex items-center gap-1.5 pointer-events-none">
                    <div className="bg-slate-950/90 backdrop-blur-sm rounded-xl p-1 px-2 text-center border border-slate-700/60 shadow-lg">
                      <span className="block text-[10px] font-bold uppercase text-amber-400">
                        {new Date(event.date + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                      </span>
                      <span className="block text-base font-extrabold text-white leading-none">
                        {new Date(event.date + 'T12:00:00').getDate()}
                      </span>
                    </div>
                    {hasVideo && (
                      <span className="inline-flex items-center gap-1 bg-amber-500 text-slate-950 font-extrabold text-[10px] px-2 py-1 rounded-lg shadow-md backdrop-blur-sm animate-pulse">
                        <Play className="w-2.5 h-2.5 fill-slate-950" />
                        Vídeo
                      </span>
                    )}
                  </div>

                  {/* Favorite Button */}
                  <button
                    onClick={(e) => toggleFavorite(e, event.id)}
                    className={`absolute top-2.5 right-2.5 z-30 p-2 rounded-full backdrop-blur-md transition-transform active:scale-90 ${
                      isFav
                        ? 'bg-rose-500 text-white shadow-md'
                        : 'bg-slate-950/70 hover:bg-slate-950 text-slate-300 border border-slate-700/60'
                    }`}
                    title={isFav ? 'Remover dos salvos' : 'Salvar evento'}
                  >
                    <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                  </button>

                  {/* Category Pill */}
                  <div className="absolute bottom-2 left-3 z-30 pointer-events-none">
                    <span className="inline-block text-[11px] font-semibold text-amber-300 bg-slate-950/90 px-2.5 py-0.5 rounded-md backdrop-blur-sm border border-amber-500/20 shadow">
                      {event.category}
                    </span>
                  </div>

                  {/* Price Pill */}
                  <div className="absolute bottom-2 right-3 z-30 pointer-events-none">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm shadow-sm ${
                      event.isFree
                        ? 'bg-emerald-500 text-slate-950 font-extrabold'
                        : 'bg-slate-950/90 text-amber-300 border border-amber-500/30'
                    }`}>
                      {event.isFree
                        ? 'Gratuito'
                        : (event.price 
                            ? `R$ ${event.price.toFixed(2).replace('.', ',')}` 
                            : (event.priceDetails?.includes('sympla') || event.contact?.includes('sympla')
                                ? 'Ingressos Sympla'
                                : (event.priceDetails?.replace(/https?:\/\/[^\s]+/gi, '').trim() || 'Consulte')))}
                    </span>
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-medium text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
                        {event.category}
                      </span>
                      {typeof event.distanceKm === 'number' && (
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Navigation className="w-2.5 h-2.5 text-amber-400 rotate-45" />
                          <span>{event.distanceKm < 1 ? `${Math.round(event.distanceKm * 1000)} m` : `${event.distanceKm.toFixed(1).replace('.', ',')} km`}</span>
                        </span>
                      )}
                      {hasVideo && (
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Video className="w-2.5 h-2.5 text-amber-400" />
                          <span>Com Vídeo</span>
                        </span>
                      )}
                    </div>
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
                      const distKm = typeof event.distanceKm === 'number' 
                        ? event.distanceKm 
                        : getDistanceKmTo(event.latitude, event.longitude);
                      if (distKm === null || distKm === undefined) return null;
                      return (
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                          <Navigation className="w-3 h-3 text-emerald-400 flex-shrink-0 rotate-45" />
                          <span>{distKm < 1 ? 'A menos de 1 km de você' : `Aprox. ${distKm.toFixed(1).replace('.', ',')} km de você`}</span>
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
