import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  Calendar,
  MapPin, 
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
  Video,
  Edit3
} from 'lucide-react';
import { EventItem, EventCategory, ActiveScreen, EstadoItem } from '../types';
import { useUserLocation, calculateDistanceKm, normalizeCityKey } from '../context/LocationContext';
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
  onEditEvent?: (event: EventItem) => void;
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
  'Sertanejo',
];

const getTodayDateString = (): string => {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  } catch {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
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
  onEditEvent,
  estadosList: propEstadosList,
  onRefreshEvents,
  categoriesList: propCategoriesList,
}) => {
  const { 
    coords, 
    requestLocation, 
    refreshLocation,
    getDistanceKmTo, 
    userOriginCity, 
    setUserOriginCity, 
    userCoords, 
    isUsingRealGps,
    userLocationLabel 
  } = useUserLocation();
  const initialQueryAppliedRef = useRef<string | null>(null);
  const todayStr = useMemo(() => getTodayDateString(), []);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'Todas');
  const [estadosList, setEstadosList] = useState<EstadoItem[]>(() => propEstadosList || []);
  const [isLoadingEstados, setIsLoadingEstados] = useState(false);
  const [selectedEstado, setSelectedEstado] = useState<string>(initialEstado || 'Todos');
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || todayStr);
  const [sortByProximity, setSortByProximity] = useState<boolean>(initialSortByProximity !== undefined ? initialSortByProximity : true);
  const [dateError, setDateError] = useState<string>('');
  const [selectionNotice, setSelectionNotice] = useState<string>('');
  const [isSearchingDb, setIsSearchingDb] = useState<boolean>(false);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState<boolean>(false);
  const [dbEvents, setDbEvents] = useState<EventItem[] | null>(null);
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [filterOnlyVideos, setFilterOnlyVideos] = useState<boolean>(false);
  const [cardMediaMode, setCardMediaMode] = useState<Record<string, 'video' | 'poster'>>({});
  const [playingDirectVideoIds, setPlayingDirectVideoIds] = useState<Set<string>>(() => new Set());
  const [visibleLimit, setVisibleLimit] = useState<number>(200);

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
  const [cityError, setCityError] = useState<boolean>(false);

  // Registrar consulta no Desempenho & Métricas
  const hasRegisteredInitialEntryRef = useRef<boolean>(false);
  const lastRecordedQueryTimeRef = useRef<number>(0);

  const registrarConsultaMetricas = (catName?: string, estadoName?: string) => {
    const now = Date.now();
    // Previne duplo disparo em cliques repetidos em menos de 800ms
    if (now - lastRecordedQueryTimeRef.current < 800) {
      return;
    }
    lastRecordedQueryTimeRef.current = now;

    const cat = catName || selectedCategory || initialCategory || 'Consulta Geral';
    const est = (estadoName || selectedEstado || initialEstado || 'SP').trim();
    const finalEstado = (!est || est === 'Todos' || est === 'Todas') ? 'SP' : est;

    fetch('/api/consultas/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        categoria: cat,
        estado: finalEstado
      }),
    }).then((res) => {
      if (res.ok) {
        console.log(`[Métricas] Consulta registrada com sucesso no painel: ${cat} (${finalEstado})`);
      }
    }).catch((err) => {
      console.warn('Erro ao registrar consulta em métricas:', err);
    });
  };

  // Filtros aplicados pelo botão "Consultar Eventos"
  const [appliedFilters, setAppliedFilters] = useState<{
    category: string;
    estado: string;
    date: string;
    query: string;
    sortByProximity: boolean;
    onlyVideos: boolean;
  }>(() => ({
    category: initialCategory || 'Todas',
    estado: initialEstado || 'Todos',
    date: initialDate || todayStr,
    query: initialQuery,
    sortByProximity: initialSortByProximity !== undefined ? initialSortByProximity : true,
    onlyVideos: false,
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
        setCityError(false);
        setAppliedFilters({
          category: chosenCategory,
          estado: 'Todos',
          date: todayStr,
          query: '',
          sortByProximity: sortByProximity,
          onlyVideos: filterOnlyVideos,
        });
        setSelectionNotice(`Ritmo "${chosenCategory}" selecionado. Exibindo eventos a partir dos mais próximos.`);
        setTimeout(() => {
          handleSelectEvents({ category: chosenCategory, estado: 'Todos', date: todayStr, query: '' });
        }, 50);
      } else {
        setSearchQuery(initialQuery);
        setSelectedEstado('Todos');
        setHasExecutedSelection(true);
        setCityError(false);
        setAppliedFilters({
          category: chosenCategory,
          estado: 'Todos',
          date: todayStr,
          query: initialQuery,
          sortByProximity: sortByProximity,
          onlyVideos: filterOnlyVideos,
        });
        setSelectionNotice(`Filtro de busca "${initialQuery}" configurado.`);
        setTimeout(() => {
          handleSelectEvents({ category: chosenCategory, estado: 'Todos', date: todayStr, query: initialQuery });
        }, 50);
      }
    }
  }, [initialQuery, categoryOptions, todayStr, sortByProximity, estadosList, userOriginCity]);

  // Ao entrar na consulta sem busca prévia, carrega automaticamente do servidor respeitando os filtros iniciais
  const initialAutoLoadDoneRef = useRef<boolean>(false);
  useEffect(() => {
    // Registra a entrada na consulta no Desempenho & Métricas
    if (!hasRegisteredInitialEntryRef.current) {
      hasRegisteredInitialEntryRef.current = true;
      registrarConsultaMetricas(initialCategory || selectedCategory, initialEstado || selectedEstado);
    }

    if (!initialAutoLoadDoneRef.current) {
      initialAutoLoadDoneRef.current = true;
      if (!initialQuery) {
        const cat = initialCategory || selectedCategory || 'Todas';
        const est = initialEstado || selectedEstado || 'Todos';
        const dt = initialDate || selectedDate || todayStr;
        const prox = initialSortByProximity !== undefined ? initialSortByProximity : sortByProximity;
        setHasExecutedSelection(true);
        setAppliedFilters({
          category: cat,
          estado: est,
          date: dt,
          query: '',
          sortByProximity: prox,
          onlyVideos: false,
        });
        setTimeout(() => {
          handleSelectEvents({ category: cat, estado: est, date: dt, query: '', sortByProximity: prox, onlyVideos: false });
        }, 20);
      }
    }
  }, [initialQuery, todayStr, selectedCategory, initialCategory, initialEstado, initialDate, initialSortByProximity, categoryOptions]);

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

  // REGRA DO USUÁRIO: na tela de consulta se video_url for diferente de NULL trazer o video_url, se video_url for igual a NULL trazer a imagem_url
  const getEventVideoUrl = (event: EventItem | any): string => {
    if (!event) return '';
    
    // 1. Prioriza campos dedicados de vídeo cadastrados no SQLite/Firestore
    const vid = (event.video_url || event.video_utl || event.videoUrl || '').trim();
    if (vid && vid !== 'null' && vid !== 'undefined' && vid !== '[video_local_sqlite]') {
      if (isVideoFormatUrl(vid) || vid.startsWith('/uploads/videos/') || vid.startsWith('data:video/')) {
        return vid;
      }
    }
    
    // 2. Analisa o campo genérico de URL/Url apenas se for de formato de vídeo válido
    const rawUrl = (event.url || event.Url || '').trim();
    if (rawUrl && rawUrl !== 'null' && rawUrl !== 'undefined' && rawUrl !== '[video_local_sqlite]') {
      if (isVideoFormatUrl(rawUrl) || rawUrl.startsWith('data:video/') || rawUrl.startsWith('/uploads/videos/')) {
        return rawUrl;
      }
    }
    
    // 3. Se for do tipo de mídia vídeo, aceita o url genérico como fallback apenas se NÃO for uma imagem estática
    if (event.mediaType === 'video' || event.media_type === 'video') {
      if (rawUrl && rawUrl !== 'null' && rawUrl !== 'undefined' && rawUrl !== '[video_local_sqlite]' && !isValidEventImage(rawUrl)) {
        return rawUrl;
      }
    }
    
    return '';
  };

  // Helper estrito: valida se o evento possui mídia válida (não oculta o evento da lista se uma imagem externa falhar no navegador)
  const hasValidEventMedia = (event: EventItem | any): boolean => {
    if (!event) return false;
    const vid = getEventVideoUrl(event);
    if (vid && !failedVideoIds.has(event.id)) return true;
    const poster = getEventPosterUrl(event);
    if (!poster || !isValidEventImage(poster)) return false;
    if (poster.includes('images.unsplash.com')) return false;
    return true;
  };

  // Helper estrito: valida se uma URL de imagem é formalmente válida em qualquer formato (PNG, JPEG, JPG, WebP, GIF, AVIF, BMP, SVG, TIFF, etc.)
  const isValidEventImage = (url?: string | null): boolean => {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;

    if (trimmed.startsWith('/api/video-thumbnail') || trimmed.startsWith('/api/event-poster/')) {
      return true;
    }

    // Se for URL ou arquivo de vídeo, NUNCA é imagem
    if (
      trimmed.startsWith('data:video/') ||
      trimmed.startsWith('/uploads/videos/') ||
      trimmed.startsWith('./uploads/videos/') ||
      /\.(mp4|webm|mov|m4v|ogg|mkv)($|\?|#)/i.test(trimmed) ||
      isVideoFormatUrl(trimmed)
    ) {
      return false;
    }

    return (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:image/') ||
      trimmed.startsWith('/uploads/') ||
      trimmed.startsWith('/assets/') ||
      trimmed.startsWith('./uploads/') ||
      trimmed.startsWith('./assets/') ||
      /\.(jpe?g|png|webp|gif|svg|avif|bmp|jfif|heic|heif|tiff?|ico)($|\?|#)/i.test(trimmed)
    );
  };

  // Helper robusto: obtém o melhor cartaz publicado do evento sem risco de exibir imagem padrão por engano
  const getEventPosterUrl = (event: EventItem | any): string => {
    if (!event) return '';
    
    // 1. PRIORIDADE MÁXIMA ABSOLUTA: Se houver Data URI Base64 (em url, imageUrl ou imagem_url), usa DIRETAMENTE!
    // Base64 é 100% autossuficiente e funciona em qualquer dispositivo sem requisição de rede ou risco de 404
    const candidates = [event.url, event.Url, event.imageUrl, (event as any).imagem_url];
    for (const c of candidates) {
      if (typeof c === 'string') {
        const trimmed = c.trim();
        if (trimmed.startsWith('data:image/')) {
          return trimmed;
        }
      }
    }

    const isRealPoster = (u?: string | null): boolean => {
      if (!u || typeof u !== 'string') return false;
      const t = u.trim();
      return Boolean(t && t !== 'null' && t !== 'undefined' && !t.includes('images.unsplash.com/photo-1514525253161-7a46d19cd819') && !isVideoFormatUrl(t) && !t.startsWith('/uploads/videos/'));
    };

    if (isRealPoster(event.imageUrl)) return event.imageUrl.trim();
    if (isRealPoster((event as any).imagem_url)) return (event as any).imagem_url.trim();

    const rawUrl = (event.url || event.Url || '').trim();
    if (isRealPoster(rawUrl)) {
      return rawUrl;
    }

    // Auto-recupera thumbnail de vídeo (YouTube hqdefault, links de redes sociais ou poster local)
    const vUrl = (event.videoUrl || (event as any).video_url || '').trim();
    if (vUrl) {
      const parsed = parseVideoUrl(vUrl);
      if (parsed?.thumbnailUrl) {
        return parsed.thumbnailUrl;
      }
      if (event.id && (vUrl.startsWith('/uploads/videos/') || vUrl.startsWith('data:video/'))) {
        return `/uploads/images/${event.id}.jpg`;
      }
      if ((vUrl.startsWith('http://') || vUrl.startsWith('https://')) && !parsed?.isDirectVideo) {
        return `/api/video-thumbnail?url=${encodeURIComponent(vUrl)}`;
      }
    }

    return '';
  };

  // Rastreador de imagens com falha de carregamento no navegador para não exibir telas pretas
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  // Rastreador de vídeos com falha de carregamento no navegador para não exibir telas pretas
  const [failedVideoIds, setFailedVideoIds] = useState<Set<string>>(new Set());
  // Rastreador de links sociais cujo stream direto via proxy falhou (faz fallback para iframe)
  const [failedProxyVideoIds, setFailedProxyVideoIds] = useState<Set<string>>(new Set());

  // Eventos selecionados por categoria, estado e data do evento >= data informada com campo liberado = "S"
  // No índice será: categoria, estado, data do evento
  // DEDUPLICAÇÃO ESTRITA: nunca exibir eventos repetidos na tela de consulta
  const filteredEvents = useMemo(() => {
    // Quando há resposta oficial do servidor (/api/events), usa exatamente a lista retornada pelo servidor
    // para garantir que celular e computador exibam rigorosamente os mesmos registros.
    if (dbEvents !== null) {
      const serverList = dbEvents.filter((event) => {
        if (!event) return false;
        if (appliedFilters.onlyVideos && !getEventVideoUrl(event)) return false;
        return true;
      });
      return serverList.slice(0, visibleLimit);
    }

    const rawList = events.filter((event) => {
      // 0. REGRA OBRIGATÓRIA: Somente eventos COM mídia válida (imagem funcional OU vídeo cadastrado)
      if (!hasValidEventMedia(event)) {
        return false;
      }

      // Filtro opcional: apenas com vídeo (aplicado ao clicar em Consultar)
      if (appliedFilters.onlyVideos && !getEventVideoUrl(event)) {
        return false;
      }

      // 1. REGRA CRÍTICA: Somente eventos com o campo liberado = "S"
      const isLiberado = (event.liberado || '').trim().toUpperCase() === 'S';
      if (!isLiberado) {
        return false;
      }

      // 2. Data evento igual ou maior data informada (não restringe se o usuário digitou uma busca textual por termo/nome)
      if (!appliedFilters.query.trim()) {
        const targetDate = appliedFilters.date || todayStr;
        if (targetDate) {
          const eventEnd = event.endDate || event.date;
          const cleanEventDate = (eventEnd || '').split('T')[0].trim();
          const cleanFilterDate = targetDate.split('T')[0].trim();
          if (cleanEventDate && cleanFilterDate && cleanEventDate < cleanFilterDate) {
            return false;
          }
        }
      }

      // 3. Seleção categoria evento igual categoria informada
      if (appliedFilters.category && appliedFilters.category !== 'Todas' && appliedFilters.category !== 'Todos') {
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

      // 4. Cidade e Estado do evento igual ao selecionado
      if (appliedFilters.estado !== 'Todos') {
        const selectedRecord = estadosList.find(
          (item) =>
            String(item.id) === appliedFilters.estado ||
            item.estado.toUpperCase() === appliedFilters.estado.toUpperCase() ||
            (item.nome && item.nome.toLowerCase() === appliedFilters.estado.toLowerCase())
        );
        const targetCity = selectedRecord ? (selectedRecord.nome || '').trim().toLowerCase() : appliedFilters.estado.trim().toLowerCase();
        const targetUf = selectedRecord ? (selectedRecord.estado || '').trim().toUpperCase() : appliedFilters.estado.trim().toUpperCase();
        const evtCity = (event.city || '').trim().toLowerCase();
        const evtState = (event.state || '').trim().toUpperCase();

        if (targetCity && targetCity !== 'todos' && targetCity !== 'todas') {
          const matchCity = evtCity === targetCity || evtCity.includes(targetCity) || targetCity.includes(evtCity);
          if (!matchCity) {
            return false;
          }
        } else if (targetUf && targetUf !== 'TODOS' && targetUf !== 'TODAS') {
          if (evtState !== targetUf) {
            return false;
          }
        }
      }

      // 5. Query de busca textual (insensível a maiúsculas, minúsculas e acentos)
      if (appliedFilters.query.trim()) {
        const rawQ = appliedFilters.query.toLowerCase().trim();
        const normQ = rawQ.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const singularQ = normQ.endsWith('s') && normQ.length > 3 ? normQ.slice(0, -1) : normQ;

        const checkMatch = (val?: string | null): boolean => {
          if (!val) return false;
          const lower = val.toLowerCase();
          const norm = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return lower.includes(rawQ) || norm.includes(normQ) || norm.includes(singularQ);
        };

        const matchTitle = checkMatch(event.title);
        const matchDesc = checkMatch(event.description);
        const matchCat = checkMatch(event.category);
        const matchCity = checkMatch(event.city);
        const matchState = checkMatch(event.state);
        const matchLocation = checkMatch(event.locationName);
        const matchTag = event.tags?.some((t) => checkMatch(t));
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
      // 1. Categoria (ordem alfabética por categoria/ritmo quando múltiplos ritmos exibidos)
      const catA = a.category || '';
      const catB = b.category || '';
      const cmpCat = catA.localeCompare(catB, 'pt-BR');
      if (cmpCat !== 0) return cmpCat;

      // 2. Data do evento - Cronológica a partir da data solicitada
      const dateA = a.date || '';
      const dateB = b.date || '';
      const cmpDate = dateA.localeCompare(dateB);
      if (cmpDate !== 0) return cmpDate;

      // 3. Se ordenação por proximidade geográfica estiver ativa, ordena por distância antes de cidade
      if (appliedFilters.sortByProximity) {
        const liveDistA = getDistanceKmTo(a.latitude, a.longitude, a.city);
        const distA = liveDistA !== null ? liveDistA : (typeof a.distanceKm === 'number' ? a.distanceKm : 999999);
        const liveDistB = getDistanceKmTo(b.latitude, b.longitude, b.city);
        const distB = liveDistB !== null ? liveDistB : (typeof b.distanceKm === 'number' ? b.distanceKm : 999999);
        if (distA !== distB) return distA - distB;
      }

      // 3. Cidade (ordem alfabética dos municípios do Estado de São Paulo)
      const cityA = a.city || '';
      const cityB = b.city || '';
      const cmpCity = cityA.localeCompare(cityB, 'pt-BR');
      if (cmpCity !== 0) return cmpCity;

      // 4. Locais mais próximos (distância como critério refinado se proximidade não for o critério primário)
      if (!appliedFilters.sortByProximity) {
        const liveDistA = getDistanceKmTo(a.latitude, a.longitude, a.city);
        const distA = liveDistA !== null ? liveDistA : (typeof a.distanceKm === 'number' ? a.distanceKm : 999999);
        const liveDistB = getDistanceKmTo(b.latitude, b.longitude, b.city);
        const distB = liveDistB !== null ? liveDistB : (typeof b.distanceKm === 'number' ? b.distanceKm : 999999);
        if (distA !== distB) return distA - distB;
      }

      // 5. Horário
      const cmpTime = (a.time || '').localeCompare(b.time || '');
      if (cmpTime !== 0) return cmpTime;

      return (a.id || '').localeCompare(b.id || '');
    });

    // 5. Limite de exibição conforme paginação/carregamento (a partir de 20 registros)
    return sorted.slice(0, visibleLimit);
  }, [events, dbEvents, appliedFilters, estadosList, hasExecutedSelection, todayStr, coords, userCoords, userOriginCity, getDistanceKmTo, filterOnlyVideos, visibleLimit]);



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

  // Executa a busca dos registros na tabela de eventos do banco SQLite filtrando por categoria, estado e data do evento >= data informada
  const handleSelectEvents = async (overrideFilters?: {
    category?: string;
    estado?: string;
    date?: string;
    query?: string;
    sortByProximity?: boolean;
    onlyVideos?: boolean;
    limit?: number;
  }) => {
    // Mantém os eventos anteriores visíveis enquanto busca para nunca deixar a tela em branco/preta

    const catToUse = overrideFilters?.category !== undefined ? overrideFilters.category : selectedCategory;
    let estToUse = overrideFilters?.estado !== undefined ? overrideFilters.estado : selectedEstado;
    const dateToUse = overrideFilters?.date !== undefined ? overrideFilters.date : selectedDate;
    const queryToUse = overrideFilters?.query !== undefined ? overrideFilters.query : searchQuery;
    const proximityToUse = overrideFilters?.sortByProximity !== undefined ? overrideFilters.sortByProximity : sortByProximity;
    const onlyVideosToUse = overrideFilters?.onlyVideos !== undefined ? overrideFilters.onlyVideos : filterOnlyVideos;
    const limitToUse = overrideFilters?.limit !== undefined ? overrideFilters.limit : (overrideFilters?.category !== undefined || overrideFilters?.query !== undefined ? 200 : visibleLimit);
    if (overrideFilters?.category !== undefined || overrideFilters?.query !== undefined) {
      setVisibleLimit(200);
    }

    // Cidade: se for "Todos" ou não informada, consulta em todas as cidades com ordenação por proximidade
    setCityError(false);

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
      onlyVideos: onlyVideosToUse,
    });

    setIsSearchingDb(true);
    setSelectionNotice(
      proximityToUse 
        ? `Buscando eventos mais próximos de você (${userLocationLabel || userOriginCity})...` 
        : 'Buscando eventos na Tabela de Eventos...'
    );

    try {
      const params = new URLSearchParams();
      if (catToUse && catToUse !== 'Todas' && catToUse !== 'Todos') {
        params.set('category', catToUse);
      }
      if (estToUse && estToUse !== 'Todos') {
        params.set('estado', estToUse);
      }
      if (effectiveDate && !queryToUse.trim()) {
        params.set('date', effectiveDate);
      }
      params.set('liberado', 'S');
      params.set('limit', String(limitToUse)); // Limitar conforme quantidade solicitada

      if (proximityToUse) {
        params.set('mais_proximos', 'true');
        params.set('order_by', 'proximidade');
      }

      // Sempre envia as coordenadas ativas do usuário para cálculo exato de distância
      const activeCoords = userCoords;
      if (activeCoords && typeof activeCoords.latitude === 'number' && typeof activeCoords.longitude === 'number') {
        params.set('user_lat', String(activeCoords.latitude));
        params.set('user_lng', String(activeCoords.longitude));
      }

      if (queryToUse.trim()) {
        params.set('search', queryToUse.trim());
      }

      const res = await fetch(`/api/events?${params.toString()}`, { cache: 'no-store' });
      if (res.ok) {
        let data: EventItem[] = await res.json();
        let fallbackToAllCitiesNotice = false;

        // Se uma busca específica (por texto ou por cidade) retornou 0 eventos, busca automaticamente com filtros mais amplos
        // para exibir os eventos e NUNCA deixar a tela preta/vazia
        if (Array.isArray(data) && data.length === 0) {
          try {
            const fallbackParams = new URLSearchParams(params);
            let neededFallback = false;
            if (queryToUse.trim() && catToUse && catToUse !== 'Todas' && catToUse !== 'Todos') {
              fallbackParams.delete('category');
              neededFallback = true;
            }
            if (estToUse !== 'Todos') {
              fallbackParams.delete('estado');
              neededFallback = true;
            }
            if (neededFallback) {
              fallbackParams.set('consulta', 'false');
              fallbackParams.delete('consulta_token');
              const fbRes = await fetch(`/api/events?${fallbackParams.toString()}`, { cache: 'no-store' });
              if (fbRes.ok) {
                const fbData = await fbRes.json();
                if (Array.isArray(fbData) && fbData.length > 0) {
                  data = fbData;
                  fallbackToAllCitiesNotice = true;
                }
              }
            }
          } catch {}
        }

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

          // Preenche distância no cliente sempre em tempo real para sincronização precisa
          dedupedData.forEach((ev) => {
            const liveD = getDistanceKmTo(ev.latitude, ev.longitude, ev.city);
            if (liveD !== null) {
              ev.distanceKm = liveD;
            }
          });

          dedupedData.sort((a, b) => {
            // 1. Categoria (ordem alfabética se houver categorias distintas)
            const catA = a.category || '';
            const catB = b.category || '';
            const cmpCat = catA.localeCompare(catB, 'pt-BR');
            if (cmpCat !== 0) return cmpCat;

            // 2. Data do evento - Cronológica a partir da data solicitada
            const dateA = a.date || '';
            const dateB = b.date || '';
            const cmpDate = dateA.localeCompare(dateB);
            if (cmpDate !== 0) return cmpDate;

            // 3. Proximidade (se ativada, ordena por distância antes da cidade)
            if (proximityToUse) {
              const liveDistA = getDistanceKmTo(a.latitude, a.longitude, a.city);
              const distA = liveDistA !== null ? liveDistA : (typeof a.distanceKm === 'number' ? a.distanceKm : 999999);
              const liveDistB = getDistanceKmTo(b.latitude, b.longitude, b.city);
              const distB = liveDistB !== null ? liveDistB : (typeof b.distanceKm === 'number' ? b.distanceKm : 999999);
              if (distA !== distB) return distA - distB;
            }

            // 3. Cidade (ordem alfabética dos municípios de SP)
            const cityA = a.city || '';
            const cityB = b.city || '';
            const cmpCity = cityA.localeCompare(cityB, 'pt-BR');
            if (cmpCity !== 0) return cmpCity;

            // 4. Locais mais próximos (desempate refinado por distância)
            if (!proximityToUse) {
              const liveDistA = getDistanceKmTo(a.latitude, a.longitude, a.city);
              const distA = liveDistA !== null ? liveDistA : (typeof a.distanceKm === 'number' ? a.distanceKm : 999999);
              const liveDistB = getDistanceKmTo(b.latitude, b.longitude, b.city);
              const distB = liveDistB !== null ? liveDistB : (typeof b.distanceKm === 'number' ? b.distanceKm : 999999);
              if (distA !== distB) return distA - distB;
            }

            // 5. Horário
            const cmpTime = (a.time || '').localeCompare(b.time || '');
            if (cmpTime !== 0) return cmpTime;

            return (a.id || '').localeCompare(b.id || '');
          });

          // Mantém todos os registros retornados pelo servidor dentro do limite da consulta
          const limitedData = dedupedData.slice(0, limitToUse || 200);
          setDbEvents(limitedData);
          setHasExecutedSelection(true);
          const count = limitedData.length;

          setSelectionNotice(
            fallbackToAllCitiesNotice
              ? `Nenhum evento em ${estadosList.find((e) => String(e.id) === estToUse)?.nome || 'na cidade informada'}. Exibindo ${count} evento${count !== 1 ? 's' : ''} mais próximos da sua localização (${userOriginCity})!`
              : `Consulta realizada! Exibindo os ${count} eventos mais próximos de você (${userLocationLabel || userOriginCity}) a partir de ${formatDateBr(effectiveDate)}.`
          );

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

  const clearFilters = () => {
    const defaultCat = 'Todas';
    setSearchQuery('');
    setSelectedCategory(defaultCat);
    setSelectedEstado('Todos');
    setSelectedDate(todayStr);
    setSortByProximity(true);
    setFilterOnlyVideos(false);
    setDateError('');
    setCityError(false);
    setSelectionNotice('Filtros limpos. Exibindo todos os eventos.');
    setHasExecutedSelection(true);
    setAppliedFilters({
      category: defaultCat,
      estado: 'Todos',
      date: todayStr,
      query: '',
      sortByProximity: true,
      onlyVideos: false,
    });
    handleSelectEvents({ category: defaultCat, estado: 'Todos', date: todayStr, query: '', onlyVideos: false });
  };

  // Ativa o botão "Consultar" SOMENTE quando houver alteração na Categoria, Data inicial ou Com Vídeo
  const isConsultaButtonActive =
    selectedCategory !== appliedFilters.category ||
    selectedDate !== appliedFilters.date ||
    filterOnlyVideos !== appliedFilters.onlyVideos;

  const defaultCat = categoryOptions[0] || 'Show';
  const hasActiveFilters =
    hasExecutedSelection ||
    searchQuery.trim() !== '' ||
    selectedCategory !== defaultCat ||
    selectedEstado !== 'Todos' ||
    (selectedDate !== '' && selectedDate !== todayStr) ||
    !sortByProximity ||
    filterOnlyVideos ||
    appliedFilters.query.trim() !== '' ||
    appliedFilters.category !== defaultCat ||
    appliedFilters.estado !== 'Todos' ||
    (appliedFilters.date !== '' && appliedFilters.date !== todayStr) ||
    appliedFilters.onlyVideos;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-2 pb-4 sm:pt-3 sm:pb-6 w-full">
      {/* Filter Toolbar (compacta para exibir os eventos logo de cara) */}
      <div className="pt-1 pb-2 space-y-2.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          <div className="grid grid-cols-2 lg:flex items-center gap-2 flex-1">
            {/* 1. Índice Categoria (Dropdown) */}
            <div className="lg:w-[220px]">
              <div className="relative">
                <select
                  id="select-catalog-category"
                  value={selectedCategory}
                  onChange={(e) => {
                    const newCat = e.target.value;
                    setSelectedCategory(newCat);
                    setSearchQuery('');
                  }}
                  className="w-full h-10 pl-3 pr-8 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/60 appearance-none cursor-pointer"
                  title="Categoria"
                >
                  <option value="Todas" className="bg-slate-900 text-amber-400 font-bold">
                    Todas as Categorias
                  </option>
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat} className="bg-slate-900 text-white">
                      {cat}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* 2. Índice Data do Evento */}
            <div className="lg:w-[235px]">
              <div className="relative flex items-center bg-slate-900 border border-slate-800 rounded-xl px-2.5 h-10 focus-within:ring-2 focus-within:ring-amber-500/50 focus-within:border-amber-500/60 transition-all">
                <span className="text-[11px] sm:text-xs font-semibold text-slate-400 whitespace-nowrap mr-1.5 select-none">
                  De:
                </span>
                <input
                  id="input-catalog-date"
                  type="date"
                  min={todayStr}
                  value={selectedDate}
                  onChange={handleDateChange}
                  onBlur={handleDateBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isConsultaButtonActive) handleSelectEvents();
                  }}
                  title="Data a partir de"
                  className="w-full min-w-0 bg-transparent text-xs sm:text-sm text-slate-200 focus:outline-none cursor-pointer [color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          {/* Ações rápidas compactas em linha única */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
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
              title="Ordenar pelos eventos mais próximos"
              className={`px-3 h-10 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none active:scale-95 whitespace-nowrap ${
                sortByProximity
                  ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Navigation className={`w-3.5 h-3.5 shrink-0 ${sortByProximity ? 'text-amber-400 rotate-45' : 'text-slate-500'}`} />
              <span>Mais Próximos</span>
            </button>

            <button
              id="btn-catalog-filter-video"
              type="button"
              onClick={() => setFilterOnlyVideos((prev) => !prev)}
              title="Exibir na consulta somente eventos com vídeo"
              className={`px-3 h-10 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none active:scale-95 whitespace-nowrap ${
                filterOnlyVideos
                  ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Play className={`w-3.5 h-3.5 ${filterOnlyVideos ? 'fill-amber-400 text-amber-400' : 'fill-slate-500 text-slate-500'}`} />
              <span>Com Vídeo</span>
            </button>

            <button
              id="btn-catalog-select-events"
              type="button"
              onClick={() => {
                if (isConsultaButtonActive) {
                  handleSelectEvents();
                }
              }}
              disabled={isSearchingDb || !isConsultaButtonActive}
              title={
                isConsultaButtonActive
                  ? 'Aplicar filtros selecionados'
                  : 'Altere a categoria, a data inicial ou Com Vídeo para consultar'
              }
              className={`flex-1 sm:flex-none px-4 h-10 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                isConsultaButtonActive && !isSearchingDb
                  ? 'text-slate-950 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-md shadow-amber-500/20 cursor-pointer active:scale-95'
                  : 'text-slate-500 bg-slate-800/80 border border-slate-700/70 cursor-not-allowed opacity-70'
              }`}
            >
              {isSearchingDb ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  <span className="text-slate-300">Buscando...</span>
                </>
              ) : (
                <>
                  <Filter className={`w-3.5 h-3.5 ${isConsultaButtonActive ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span>Consultar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Espaçamento reservado no lugar da barra de categorias rápidas */}
        <div className="h-1" aria-hidden="true" />

        {/* Mensagem de erro de consistência de data se houver */}
        {dateError && (
          <div
            id="msg-catalog-date-error"
            className="px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{dateError}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-xs">
          <p
            id="msg-advertiser-responsibility"
            className="font-medium text-amber-400/90 italic"
          >
            As divulgações são de responsabilidade do Anunciante
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-amber-400 hover:underline flex items-center gap-1 font-medium cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar filtros</span>
            </button>
          )}
        </div>
      </div>

      {/* Events Grid or Empty State */}
      {filteredEvents.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {filteredEvents.map((event, index) => {
            const isFav = favoriteIds.includes(event.id);
            // REGRA DO USUÁRIO: na tela de consulta se video_url for diferente de NULL trazer o video_url para a tela de consulta, se video_url for igual a NULL trazer a imagem_url para a tela de consulta
            const vidUrl = getEventVideoUrl(event);
            const isVideoFailed = failedVideoIds.has(event.id);
            const hasVideo = Boolean(vidUrl && vidUrl !== 'null' && vidUrl.trim() !== '' && !isVideoFailed);
            const parsedVideo = hasVideo ? parseVideoUrl(vidUrl) : null;
            const isDirectVideo = Boolean(parsedVideo?.isDirectVideo || vidUrl.startsWith('data:video/') || /\.(mp4|webm|ogg|mov|m4v)($|\?)/i.test(vidUrl));
            const posterUrl = getEventPosterUrl(event);
            const hasPoster = isValidEventImage(posterUrl) && !failedImageIds.has(event.id);

            // Determina se exibe vídeo ou cartaz no card:
            // - Se o usuário alternou o modo no card, respeita a escolha (cardMediaMode)
            // - Se for vídeo direto (.mp4), exibe o player nativo com o cartaz oficial de poster
            // - Se for link externo de rede social (Facebook/Instagram/YouTube) e houver cartaz oficial,
            //   exibe o cartaz oficial com botão de play para evitar bloqueios de iframe do Facebook e garantir visual perfeito
            const activeMediaMode: 'video' | 'poster' = cardMediaMode[event.id] || (
              (!hasVideo || isVideoFailed || hasPoster || !isDirectVideo) ? 'poster' : 'video'
            );

            return (
              <div
                key={event.id}
                onClick={() => onSelectEvent(event)}
                className="group relative bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl overflow-hidden shadow-lg transition-all duration-200 flex flex-col justify-between cursor-pointer"
              >
                {/* Cartaz ou Vídeo no Padrão Vertical (3:4) */}
                <div className="relative aspect-[3/4] w-full min-h-[260px] overflow-hidden bg-slate-950 flex items-center justify-center">
                  {/* Botão para voltar ao Cartaz/Capa quando estiver exibindo o vídeo */}
                  {hasVideo && (hasPoster || !isDirectVideo) && activeMediaMode === 'video' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCardMediaMode((prev) => ({
                          ...prev,
                          [event.id]: 'poster',
                        }));
                      }}
                      className="absolute top-2.5 right-12 z-40 inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-950/85 hover:bg-slate-900 text-amber-300 hover:text-white border border-amber-500/40 text-[10px] font-bold shadow-xl backdrop-blur-md transition-all active:scale-95 cursor-pointer"
                      title={hasPoster ? 'Ver Cartaz Oficial' : 'Voltar para Capa'}
                    >
                      <span className="text-xs">{hasPoster ? '🖼️' : '↩️'}</span>
                      <span>{hasPoster ? 'Cartaz' : 'Voltar'}</span>
                    </button>
                  )}

                  {/* Renderização de Vídeo ou Imagem */}
                  {hasVideo && activeMediaMode === 'video' ? (
                    <div 
                      className="absolute inset-0 w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Blur ambiente de fundo com o cartaz oficial caso exista */}
                      {hasPoster && (
                        <img
                          src={posterUrl}
                          alt=""
                          aria-hidden="true"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 w-full h-full object-cover filter blur-xl opacity-35 scale-110 pointer-events-none"
                        />
                      )}

                      {(() => {
                        const canUseProxyStream =
                          !isDirectVideo &&
                          (parsedVideo?.type === 'facebook' || parsedVideo?.type === 'instagram') &&
                          !failedProxyVideoIds.has(event.id);
                        const playableSrc = isDirectVideo
                          ? vidUrl
                          : canUseProxyStream
                            ? `/api/video-stream-proxy?url=${encodeURIComponent(vidUrl)}`
                            : '';

                        if (playableSrc) {
                          return (
                            <video
                              id={`catalog-video-${event.id}`}
                              key={playableSrc}
                              src={playableSrc}
                              poster={hasPoster ? posterUrl : undefined}
                              controls
                              autoPlay={playingDirectVideoIds.has(event.id) || canUseProxyStream}
                              muted={false}
                              loop
                              playsInline
                              preload="metadata"
                              className="relative z-10 w-full h-full object-contain"
                              onClick={(e) => e.stopPropagation()}
                              onLoadedData={(e) => {
                                const el = e.currentTarget;
                                if ((playingDirectVideoIds.has(event.id) || canUseProxyStream) && el.paused) {
                                  el.muted = false;
                                  el.volume = 1;
                                  el.play().catch(() => {
                                    el.muted = true;
                                    el.play().catch(() => {});
                                  });
                                }
                              }}
                              onPlay={() => {
                                setPlayingDirectVideoIds((prev) => {
                                  if (prev.has(event.id)) return prev;
                                  const next = new Set(prev);
                                  next.add(event.id);
                                  return next;
                                });
                              }}
                              onPause={() => {
                                setPlayingDirectVideoIds((prev) => {
                                  if (!prev.has(event.id)) return prev;
                                  const next = new Set(prev);
                                  next.delete(event.id);
                                  return next;
                                });
                              }}
                              onError={() => {
                                if (canUseProxyStream) {
                                  setFailedProxyVideoIds((prev) => new Set(prev).add(event.id));
                                } else {
                                  setFailedVideoIds((prev) => new Set(prev).add(event.id));
                                }
                              }}
                            >
                              Seu navegador não suporta reprodução de vídeo.
                            </video>
                          );
                        }

                        return (
                          <div className="w-full h-full relative z-10 flex flex-col justify-center overflow-hidden">
                            <VideoPlayer
                              videoUrl={vidUrl}
                              title={event.title}
                              autoPlay={true}
                              poster={hasPoster ? posterUrl : undefined}
                              compact={true}
                              className="w-full h-full border-0 rounded-none shadow-none"
                            />
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    /* Visualização do Cartaz Oficial com Imagem */
                    <div className="absolute inset-0 w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden">
                      {/* Blur ambiente de fundo */}
                      {hasPoster && (
                        <img
                          src={posterUrl}
                          alt=""
                          aria-hidden="true"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 w-full h-full object-cover filter blur-xl opacity-30 scale-110 pointer-events-none"
                        />
                      )}
                      {/* Imagem do cartaz no formato vertical */}
                      {hasPoster ? (
                        <img
                          key={posterUrl}
                          src={posterUrl}
                          alt={event.title}
                          referrerPolicy="no-referrer"
                          loading={index < 4 ? 'eager' : 'lazy'}
                          decoding="async"
                          className="relative z-10 w-full h-full object-contain bg-transparent group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            const target = e.currentTarget;
                            // 1. Tenta recuperar base64 inline diretamente do evento se existir
                            const candidates = [event.url, event.Url, event.imageUrl, (event as any).imagem_url];
                            for (const c of candidates) {
                              if (typeof c === 'string' && c.trim().startsWith('data:image/') && target.src !== c.trim()) {
                                target.src = c.trim();
                                return;
                              }
                            }

                            const currentSrc = target.src || '';
                            if (currentSrc.includes('/api/video-thumbnail') || currentSrc.includes('/api/event-poster/')) {
                              setFailedImageIds((prev) => new Set(prev).add(event.id));
                              return;
                            }
                            if (!target.dataset.apiTried && (currentSrc.includes('/uploads/images/') || (!currentSrc.startsWith('data:') && (event.id || currentSrc.includes('user-'))))) {
                              target.dataset.apiTried = '1';
                              const fname = currentSrc.includes('/uploads/images/')
                                ? currentSrc.split('/uploads/images/')[1].split('?')[0]
                                : `${event.id}.jpg`;
                              fetch(`/api/image-base64/${fname}`)
                                .then((r) => r.json())
                                .then((res) => {
                                  if (res?.success && res.base64) {
                                    target.src = res.base64;
                                  } else {
                                    setFailedImageIds((prev) => new Set(prev).add(event.id));
                                  }
                                })
                                .catch(() => {
                                  setFailedImageIds((prev) => new Set(prev).add(event.id));
                                });
                              return;
                            }
                            if (!target.dataset.altExtTried && currentSrc.includes('.jpg')) {
                              target.dataset.altExtTried = '1';
                              target.src = currentSrc.replace('.jpg', '.jpeg');
                              return;
                            }
                            if (!target.dataset.altExtTried && currentSrc.includes('.jpeg')) {
                              target.dataset.altExtTried = '1';
                              target.src = currentSrc.replace('.jpeg', '.jpg');
                              return;
                            }
                            setFailedImageIds((prev) => new Set(prev).add(event.id));
                          }}
                        />
                      ) : (
                        <div className={`relative z-10 flex flex-col items-center p-6 text-center text-slate-400 h-full w-full ${hasVideo ? 'justify-start pt-16' : 'justify-center'}`}>
                          {!hasVideo && <span className="text-4xl mb-3">🎵</span>}
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">{event.category}</span>
                          <p className="text-sm font-bold text-white line-clamp-2 mt-1">{event.title}</p>
                          <p className="text-xs text-slate-400 mt-1">{event.city} • {event.date ? event.date.split('-').reverse().join('/') : ''}</p>
                        </div>
                      )}

                      {/* Botão centralizado em destaque para assistir ao vídeo */}
                      {hasVideo && (
                        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none bg-slate-950/10">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlayingDirectVideoIds((prev) => {
                                const next = new Set(prev);
                                next.add(event.id);
                                return next;
                              });
                              setCardMediaMode((prev) => ({ ...prev, [event.id]: 'video' }));
                            }}
                            className="pointer-events-auto group/play flex flex-col items-center gap-1 p-1 rounded-2xl cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95 focus:outline-none"
                            aria-label={`Assistir vídeo de ${event.title}`}
                            title="Clique para assistir ao vídeo"
                          >
                            <span className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[0_0_16px_rgba(245,158,11,0.65)] ring-2 ring-slate-950/80 border border-amber-200 transition-all">
                              <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-950/90 text-amber-300 border border-amber-400/80 text-[10px] font-black uppercase tracking-wider shadow-lg backdrop-blur-md">
                              <Video className="w-2.5 h-2.5 text-amber-400" />
                              <span>Vídeo</span>
                            </span>
                          </button>
                        </div>
                      )}

                      <div className="absolute inset-0 z-20 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent pointer-events-none" />
                    </div>
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
                  {!event.isFree && (
                    <div className="absolute bottom-2 right-3 z-30 pointer-events-none">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm shadow-sm bg-slate-950/90 text-amber-300 border border-amber-500/30">
                        {event.price 
                          ? `A partir de R$ ${event.price.toFixed(2).replace('.', ',')}` 
                          : (event.priceDetails?.includes('sympla') || event.contact?.includes('sympla')
                              ? 'Ingressos Sympla'
                              : (event.priceDetails?.replace(/https?:\/\/[^\s]+/gi, '').trim() || 'Consulte'))}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content Section */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-medium text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
                        {event.category}
                      </span>
                      {(() => {
                        const liveDist = getDistanceKmTo(event.latitude, event.longitude, event.city);
                        const effectiveDist = liveDist !== null ? liveDist : event.distanceKm;
                        if (typeof effectiveDist !== 'number') return null;
                        return (
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Navigation className="w-2.5 h-2.5 text-amber-400 rotate-45" />
                            <span>{effectiveDist < 1 ? `${Math.round(effectiveDist * 1000)} m` : `${effectiveDist.toFixed(1).replace('.', ',')} km`}</span>
                          </span>
                        );
                      })()}
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
                      const liveDist = getDistanceKmTo(event.latitude, event.longitude, event.city);
                      const distKm = liveDist !== null ? liveDist : event.distanceKm;
                      if (distKm === null || distKm === undefined) return null;
                      const refText = isUsingRealGps ? 'de você (GPS)' : `de você (${userOriginCity})`;
                      return (
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                          <Navigation className="w-3 h-3 text-emerald-400 flex-shrink-0 rotate-45" />
                          <span>{distKm < 1 ? `A menos de 1 km ${refText}` : `Aprox. ${distKm.toFixed(1).replace('.', ',')} km ${refText}`}</span>
                        </div>
                      );
                    })()}

                    {/* View Details button & Edit button */}
                    <div className="pt-2 flex items-center justify-between text-xs text-amber-400 font-bold group-hover:text-amber-300">
                      <span>Ver detalhes</span>
                      {onEditEvent && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditEvent(event);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/25 hover:bg-amber-400 text-amber-300 hover:text-slate-950 border border-amber-500/50 text-xs font-black flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
                          title="Clique para editar este evento ou trocar a foto do cartaz"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar Cartaz</span>
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredEvents.length >= visibleLimit && (
          <div className="flex justify-center mt-8 mb-4">
            <button
              id="btn-carregar-mais-eventos"
              type="button"
              disabled={isSearchingDb}
              onClick={() => {
                const next = visibleLimit + 100;
                setVisibleLimit(next);
                handleSelectEvents({ limit: next });
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSearchingDb ? 'animate-spin' : ''}`} />
              <span>{isSearchingDb ? 'Carregando eventos...' : 'Carregar Mais Eventos'}</span>
            </button>
          </div>
        )}
      </>
    ) : isSearchingDb || (dbEvents === null && events.length === 0) ? (
        /* Loading State */
        <div className="text-center py-16 px-4 bg-slate-900/40 rounded-2xl border border-slate-800/80 mt-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
            <RefreshCw className="w-7 h-7 animate-spin" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">
            Carregando eventos{appliedFilters.category && appliedFilters.category !== 'Todas' ? ` de ${appliedFilters.category}` : ''}...
          </h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Buscando os eventos mais próximos de você ({userLocationLabel || userOriginCity}).
          </p>
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
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            >
              Ver Todos os Eventos
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
