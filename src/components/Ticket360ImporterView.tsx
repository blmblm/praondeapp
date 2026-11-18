import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  ExternalLink,
  CheckCircle2,
  Trash2,
  Edit3,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Search,
  Calendar,
  Clock,
  MapPin,
  Layers,
  Link2,
  ShieldCheck,
  Save,
  X,
  PlusCircle,
  ArrowRight,
  Ticket,
  CheckSquare,
  Square,
  Music,
  Tag,
  SlidersHorizontal,
  ChevronDown,
  Filter
} from 'lucide-react';
import { ImportedEventItem, EventItem } from '../types';
import { saveEventToFirestore } from '../lib/firestoreSync';
import { BRAZILIAN_STATES, TOP_CITIES_BY_STATE } from './SymplaImporterView';

interface Ticket360ImporterViewProps {
  categories: string[];
  cities: { id: string; name: string; state: string }[];
  onBackToMenu: () => void;
  onEventApproved?: (event: EventItem) => void;
  onNavigateToLiberarEventos?: (countAdded?: number) => void;
}

export const Ticket360ImporterView: React.FC<Ticket360ImporterViewProps> = ({
  categories,
  cities,
  onBackToMenu,
  onEventApproved,
  onNavigateToLiberarEventos,
}) => {
  // Input de URL individual
  const [ticket360Url, setTicket360Url] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Modo lote
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchUrls, setBatchUrls] = useState('');
  const [batchProgress, setBatchProgress] = useState<string | null>(null);

  // Evento pré-visualizado recém-extraído
  const [previewEvent, setPreviewEvent] = useState<Partial<ImportedEventItem> | null>(null);

  // Lista de eventos na Quarentena
  const [quarantineEvents, setQuarantineEvents] = useState<ImportedEventItem[]>([]);
  const [isLoadingQuarantine, setIsLoadingQuarantine] = useState(false);
  const [quarantineSearch, setQuarantineSearch] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Descoberta e importação automática de todos os 7 ritmos
  const [isDiscoveringAll, setIsDiscoveringAll] = useState(false);

  // Filtro de ritmo na quarentena
  const [selectedRhythmFilter, setSelectedRhythmFilter] = useState<string>('Todos');

  // Seleção múltipla para ações em lote
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [batchTargetCategory, setBatchTargetCategory] = useState<string>('Samba e Pagode');
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // Robô de Busca ao Vivo Ticket360
  const [liveSearchQuery, setLiveSearchQuery] = useState('');
  const [batchRhythmState, setBatchRhythmState] = useState('SP');
  const [liveSearchCity, setLiveSearchCity] = useState('Todas');
  const [liveSearchState, setLiveSearchState] = useState('SP');
  const [liveSearchLimit, setLiveSearchLimit] = useState<number>(20);
  const [liveSearchPage, setLiveSearchPage] = useState<number>(0);
  const [liveSearchResults, setLiveSearchResults] = useState<any[]>([]);
  const [liveSearchTotal, setLiveSearchTotal] = useState<number | null>(null);
  const [liveSearchPages, setLiveSearchPages] = useState<number>(0);
  const [isSearchingLive, setIsSearchingLive] = useState(false);
  const [isLoadingMoreSearch, setIsLoadingMoreSearch] = useState(false);
  const [selectedSearchIds, setSelectedSearchIds] = useState<string[]>([]);
  const [searchTargetCategory, setSearchTargetCategory] = useState<string>('auto');
  const [isImportingSearchBatch, setIsImportingSearchBatch] = useState(false);
  const [isImportingAllQuery, setIsImportingAllQuery] = useState(false);
  const [hasSearchedOnce, setHasSearchedOnce] = useState(false);

  // Definição visual dos 7 ritmos
  const TARGET_RHYTHMS = [
    { name: 'Samba e Pagode', icon: '🥁', badge: 'Rodas & Pagode 90' },
    { name: 'Baile Nostalgia', icon: '💃', badge: 'Flashback 70/80/90' },
    { name: 'Baile Terceira Idade', icon: '👵', badge: 'Dança de Salão & Bolero' },
    { name: 'Forró', icon: '🪗', badge: 'Rastapé & Universitário' },
    { name: 'Forró Pé de Serra', icon: '🌵', badge: 'Triângulo, Zabumba & Sanfona' },
    { name: 'Bailes', icon: '🕺', badge: 'Bailes & Sunset' },
    { name: 'Shows', icon: '🎸', badge: 'Shows Ao Vivo' },
  ];

  // Edição de item existente na quarentena
  const [editingItem, setEditingItem] = useState<ImportedEventItem | null>(null);

  // Armazena em memória IDs e Títulos liberados/excluídos para garantir imunidade a recarregamentos
  const excludedQuarantineIdsRef = useRef<Set<string>>(new Set());
  const excludedTitlesRef = useRef<Set<string>>(new Set());

  // Carregar eventos da quarentena ao iniciar
  const fetchQuarantine = async (silent: boolean = false) => {
    if (!silent) {
      setIsLoadingQuarantine(true);
    }
    try {
      const res = await fetch('/api/imported-events?status=quarentena&origem=ticket360');
      if (res.ok) {
        const data: ImportedEventItem[] = await res.json();
        const filtered = data.filter((item) => {
          if (excludedQuarantineIdsRef.current.has(item.id)) return false;
          if (item.title && excludedTitlesRef.current.has(item.title.toLowerCase().trim())) return false;
          return true;
        });
        setQuarantineEvents(filtered);
      }
    } catch (err) {
      console.warn('Erro ao carregar quarentena da Ticket360:', err);
    } finally {
      if (!silent) {
        setIsLoadingQuarantine(false);
      }
    }
  };

  useEffect(() => {
    fetchQuarantine();
    const onQuarantineCleared = () => {
      setQuarantineEvents([]);
      setSelectedItemIds([]);
      fetchQuarantine(true);
    };
    window.addEventListener('praonde:quarantine-cleared', onQuarantineCleared);
    return () => window.removeEventListener('praonde:quarantine-cleared', onQuarantineCleared);
  }, []);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4500);
  };

  // Buscar dados da URL na Ticket360
  const handleParseUrl = async (urlToParse?: string) => {
    const targetUrl = (urlToParse || ticket360Url).trim();
    if (!targetUrl) {
      setParseError('Por favor, informe o link do evento da Ticket360.');
      return;
    }

    setIsLoadingUrl(true);
    setParseError(null);

    try {
      const res = await fetch('/api/ticket360/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível extrair os dados da página');
      }

      const p = data.data;
      if (!p.imagemUrl || !p.imagemUrl.trim() || p.imagemUrl.includes('logo.svg') || p.imagemUrl.includes('placeholder')) {
        throw new Error('Este evento não possui imagem válida na Ticket360. Não é permitido importar registros sem imagem.');
      }

      setPreviewEvent({
        id: `imp-t360-${Date.now()}`,
        origem: 'ticket360',
        urlOrigem: p.urlOrigem,
        title: p.titulo,
        description: p.descricao,
        category: p.categoriaSugerida || 'Shows',
        date: p.dataEvento,
        time: p.horario || '20:00',
        endTime: p.horarioFim,
        locationName: p.localNome,
        address: p.endereco,
        city: p.cidade,
        state: p.estado,
        latitude: p.latitude ? String(p.latitude) : undefined,
        longitude: p.longitude ? String(p.longitude) : undefined,
        imageUrl: p.imagemUrl,
        organizer: p.organizador,
        price: p.preco,
        isGratuito: p.isGratuito,
        ticketUrl: p.linkIngressos,
        status: 'quarentena',
      });

      showToast('Dados do evento extraídos com sucesso da Ticket360! Revise abaixo e envie para a quarentena.');
    } catch (err: any) {
      setParseError(err.message || 'Erro ao processar página da Ticket360');
    } finally {
      setIsLoadingUrl(false);
    }
  };

  // Processar Lote de URLs da Ticket360
  const handleProcessBatchUrls = async () => {
    const urls = batchUrls
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http://') || u.startsWith('https://'));

    if (urls.length === 0) {
      setParseError('Cole ao menos um link válido da Ticket360 (um por linha).');
      return;
    }

    setIsLoadingUrl(true);
    setBatchProgress(`Processando 1 de ${urls.length}...`);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < urls.length; i++) {
      setBatchProgress(`Processando ${i + 1} de ${urls.length}...`);
      try {
        const res = await fetch('/api/ticket360/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urls[i] }),
        });
        const json = await res.json();
        if (res.ok && json.success) {
          const p = json.data;
          if (!p.imagemUrl || !p.imagemUrl.trim() || p.imagemUrl.includes('logo.svg') || p.imagemUrl.includes('placeholder')) {
            failCount++;
            continue;
          }
          await fetch('/api/imported-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: `imp-t360-${Date.now()}-${i}`,
              origem: 'ticket360',
              urlOrigem: p.urlOrigem,
              title: p.titulo,
              description: p.descricao,
              category: p.categoriaSugerida || 'Shows',
              date: p.dataEvento,
              time: p.horario || '20:00',
              endTime: p.horarioFim,
              locationName: p.localNome,
              address: p.endereco,
              city: p.cidade,
              state: p.estado,
              latitude: p.latitude,
              longitude: p.longitude,
              imageUrl: p.imagemUrl,
              organizer: p.organizador,
              price: p.preco,
              isGratuito: p.isGratuito,
              ticketUrl: p.linkIngressos,
            }),
          });
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setIsLoadingUrl(false);
    setBatchProgress(null);
    setBatchUrls('');
    setIsBatchMode(false);
    await fetchQuarantine();
    showToast(`Importação concluída! ${successCount} adicionados à Quarentena${failCount > 0 ? `, ${failCount} falharam` : ''}.`);
    if (onNavigateToLiberarEventos && successCount > 0) {
      setTimeout(() => onNavigateToLiberarEventos(successCount), 450);
    }
  };

  // Salvar prévia na Quarentena
  const handleSaveToQuarantine = async () => {
    if (!previewEvent || !previewEvent.title) return;

    if (!previewEvent.imageUrl || !previewEvent.imageUrl.trim() || previewEvent.imageUrl.includes('logo.svg') || previewEvent.imageUrl.includes('placeholder')) {
      showToast('Este evento não possui imagem válida. Apenas eventos com imagem podem ser salvos na Quarentena.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/imported-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...previewEvent, origem: 'ticket360' }),
      });

      const data = await res.json();
      if (res.ok) {
        setPreviewEvent(null);
        setTicket360Url('');
        await fetchQuarantine();
        if (data.count === 0 && data.skippedCount > 0) {
          showToast('ℹ️ Este evento já foi importado anteriormente (já está na Quarentena ou já ativo no App).', 'info');
        } else {
          showToast('Evento Ticket360 salvo na Quarentena com sucesso!');
        }
        if (onNavigateToLiberarEventos) {
          setTimeout(() => onNavigateToLiberarEventos(data.count ?? 1), 450);
        }
      } else {
        throw new Error(data.error || 'Falha ao salvar evento na quarentena');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar na quarentena', 'error');
    }
  };

  // Salvar prévia e liberar imediatamente no App Oficial
  const handleSaveAndApproveNow = async () => {
    if (!previewEvent || !previewEvent.title) return;

    try {
      const resSave = await fetch('/api/imported-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...previewEvent, origem: 'ticket360' }),
      });

      if (!resSave.ok) throw new Error('Erro ao registrar evento importado');
      const saveData = await resSave.json();
      const realId = saveData.items?.[0]?.id || previewEvent.id;

      const resApprove = await fetch(`/api/imported-events/${realId}/approve`, {
        method: 'POST',
      });

      const json = await resApprove.json();
      if (resApprove.ok && json.success) {
        if (json.event) {
          saveEventToFirestore(json.event).catch(() => {});
          if (onEventApproved) onEventApproved(json.event);
        }

        setPreviewEvent(null);
        setTicket360Url('');
        setQuarantineEvents((prev) => prev.filter((it) => it.id !== realId && it.title !== previewEvent.title));
        await fetchQuarantine();
        showToast('Evento Ticket360 liberado com sucesso no App! Ele já está disponível no catálogo de eventos.');
      } else {
        throw new Error(json.error || 'Erro ao aprovar evento');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao liberar evento no app', 'error');
    }
  };

  // Confirmar liberação de item da quarentena
  const handleApproveQuarantineItem = async (item: ImportedEventItem) => {
    excludedQuarantineIdsRef.current.add(item.id);
    if (item.title) excludedTitlesRef.current.add(item.title.toLowerCase().trim());

    setQuarantineEvents((prev) => prev.filter((it) => it.id !== item.id && (!item.title || it.title.toLowerCase().trim() !== item.title.toLowerCase().trim())));
    setSelectedItemIds((prev) => prev.filter((selectedId) => selectedId !== item.id));

    try {
      const res = await fetch(`/api/imported-events/${item.id}/approve`, {
        method: 'POST',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        if (json.event) {
          saveEventToFirestore(json.event).catch(() => {});
          if (onEventApproved) onEventApproved(json.event);
        }
        await fetchQuarantine(true);
        showToast(`Evento "${item.title}" liberado no aplicativo e retirado da quarentena!`);
      } else {
        throw new Error(json.error || 'Erro ao aprovar evento');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao aprovar evento', 'error');
    }
  };

  // Excluir item da quarentena
  const handleDeleteQuarantineItem = async (id: string, title?: string) => {
    excludedQuarantineIdsRef.current.add(id);
    if (title) excludedTitlesRef.current.add(title.toLowerCase().trim());

    setQuarantineEvents((prev) => prev.filter((it) => it.id !== id && (!title || it.title.toLowerCase().trim() !== title.toLowerCase().trim())));
    setSelectedItemIds((prev) => prev.filter((selectedId) => selectedId !== id));

    try {
      await fetch(`/api/imported-events/${id}`, { method: 'DELETE' });
      await fetchQuarantine(true);
      showToast('Evento excluído da quarentena.');
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir evento', 'error');
    }
  };

  // Atualizar item editado na quarentena
  const handleSaveEditingItem = async () => {
    if (!editingItem) return;
    try {
      const res = await fetch(`/api/imported-events/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingItem),
      });
      if (res.ok) {
        setQuarantineEvents((prev) => prev.map((it) => (it.id === editingItem.id ? editingItem : it)));
        setEditingItem(null);
        showToast('Evento atualizado com sucesso na quarentena!');
      } else {
        throw new Error('Falha ao salvar edições');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao editar evento', 'error');
    }
  };

  // Descoberta Automática de Eventos nos 7 Ritmos Ticket360
  const handleDiscoverAllRhythms = async () => {
    setIsDiscoveringAll(true);
    try {
      const res = await fetch('/api/ticket360/discover-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: batchRhythmState !== 'Todos' ? batchRhythmState : undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        await fetchQuarantine(true);
        showToast(json.message || `${json.addedCount} novos eventos da Ticket360 foram adicionados à Quarentena!`);
        if (onNavigateToLiberarEventos) {
          setTimeout(() => onNavigateToLiberarEventos(json.addedCount), 450);
        }
      } else {
        throw new Error(json.error || 'Erro na varredura da Ticket360');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao conectar à Ticket360', 'error');
    } finally {
      setIsDiscoveringAll(false);
    }
  };

  // Robô de Busca ao Vivo Ticket360: busca todos os eventos na Ticket360,
  // grava diretamente na Quarentena e navega direto para a tela de Liberar Eventos
  const handleLiveSearch = async (isNewQuery: boolean = true) => {
    setIsSearchingLive(true);
    try {
      const res = await fetch('/api/ticket360/import-all-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: liveSearchQuery.trim() || undefined,
          state: liveSearchState && liveSearchState !== 'Todos' ? liveSearchState : undefined,
          city: liveSearchCity && liveSearchCity !== 'Todas' && liveSearchCity !== 'Todos' ? liveSearchCity : undefined,
          defaultCategory: searchTargetCategory !== 'auto' ? searchTargetCategory : undefined,
          maxEvents: 600,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        await fetchQuarantine(true);
        const count = json.addedCount ?? 0;
        const msg = count > 0
          ? `${count} eventos da Ticket360 jogados na Quarentena com sucesso! Entrando na tela de Liberar Eventos...`
          : `Eventos da Ticket360 prontos na Quarentena. Entrando na tela de Liberar Eventos...`;
        showToast(msg);

        if (onNavigateToLiberarEventos) {
          setTimeout(() => {
            onNavigateToLiberarEventos(count);
          }, 450);
        }
      } else {
        throw new Error(json.error || 'Erro ao consultar e importar eventos da Ticket360');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao conectar à Ticket360', 'error');
    } finally {
      setIsSearchingLive(false);
      setIsLoadingMoreSearch(false);
    }
  };

  // Importar Lote Selecionado da Busca ao Vivo da Ticket360
  const handleImportSearchBatch = async () => {
    const selectedEvents = liveSearchResults.filter((ev) =>
      selectedSearchIds.includes(ev.ticketUrl || ev.title)
    );

    if (selectedEvents.length === 0) {
      showToast('Selecione ao menos um evento da lista para importar.', 'info');
      return;
    }

    setIsImportingSearchBatch(true);
    try {
      const res = await fetch('/api/ticket360/import-live-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: selectedEvents,
          defaultCategory: searchTargetCategory !== 'auto' ? searchTargetCategory : undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        await fetchQuarantine();
        setSelectedSearchIds([]);
        showToast(json.message || `${json.addedCount} eventos importados para a Quarentena da Ticket360!`);
        if (onNavigateToLiberarEventos) {
          setTimeout(() => onNavigateToLiberarEventos(json.addedCount), 450);
        }
      } else {
        throw new Error(json.error || 'Erro ao importar lote');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao importar eventos', 'error');
    } finally {
      setIsImportingSearchBatch(false);
    }
  };

  // Importar TODOS os Resultados da Busca Ticket360
  const handleImportAllQuery = async () => {
    setIsImportingAllQuery(true);
    try {
      const res = await fetch('/api/ticket360/import-all-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: liveSearchQuery.trim() || undefined,
          state: liveSearchState !== 'Todos' ? liveSearchState : undefined,
          city: liveSearchCity !== 'Todas' && liveSearchCity !== 'Todos' ? liveSearchCity : undefined,
          defaultCategory: searchTargetCategory !== 'auto' ? searchTargetCategory : undefined,
          maxEvents: 600,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        await fetchQuarantine(true);
        showToast(json.message || `${json.addedCount} eventos da Ticket360 adicionados à Quarentena!`);
        if (onNavigateToLiberarEventos) {
          setTimeout(() => onNavigateToLiberarEventos(json.addedCount), 450);
        }
      } else {
        throw new Error(json.error || 'Erro ao importar todos da busca');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao importar todos os eventos', 'error');
    } finally {
      setIsImportingAllQuery(false);
    }
  };

  // Toggle seleção de resultado de busca
  const toggleSearchSelection = (id: string) => {
    setSelectedSearchIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Selecionar todos os resultados da busca
  const toggleSelectAllSearch = () => {
    const selectable = liveSearchResults.filter((ev) => ev.statusInDb !== 'aprovado');
    if (selectedSearchIds.length >= selectable.length) {
      setSelectedSearchIds([]);
    } else {
      setSelectedSearchIds(selectable.map((ev) => ev.ticketUrl || ev.title));
    }
  };

  // Ações em lote na quarentena
  const handleBatchApprove = async () => {
    if (selectedItemIds.length === 0) return;
    setIsProcessingBatch(true);
    try {
      const res = await fetch('/api/imported-events/batch-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedItemIds,
          category: batchTargetCategory,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setQuarantineEvents((prev) => prev.filter((it) => !selectedItemIds.includes(it.id)));
        setSelectedItemIds([]);
        await fetchQuarantine();
        showToast(`${json.approvedCount} eventos aprovados e adicionados ao catálogo com sucesso!`);
      } else {
        throw new Error(json.error || 'Erro ao aprovar em lote');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro na aprovação em lote', 'error');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedItemIds.length === 0) return;
    setIsProcessingBatch(true);
    try {
      const res = await fetch('/api/imported-events/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedItemIds }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setQuarantineEvents((prev) => prev.filter((it) => !selectedItemIds.includes(it.id)));
        setSelectedItemIds([]);
        await fetchQuarantine();
        showToast(`${json.deletedCount} eventos excluídos da Quarentena.`);
      } else {
        throw new Error(json.error || 'Erro ao excluir em lote');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro na exclusão em lote', 'error');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const handleClearEntireQuarantine = async () => {
    if (!window.confirm('Tem certeza de que deseja apagar TODOS os eventos da Quarentena da Ticket360?')) return;
    setIsLoadingQuarantine(true);
    try {
      await fetch('/api/imported-events/clear', { method: 'POST' });
      setQuarantineEvents([]);
      setSelectedItemIds([]);
      window.dispatchEvent(new CustomEvent('praonde:quarantine-cleared'));
      showToast('Quarentena esvaziada com sucesso!');
    } catch (err: any) {
      showToast(err.message || 'Erro ao esvaziar quarentena', 'error');
    } finally {
      setIsLoadingQuarantine(false);
    }
  };

  // Filtros aplicados na lista de quarentena
  const filteredQuarantineEvents = quarantineEvents.filter((item) => {
    if (selectedRhythmFilter !== 'Todos' && item.category !== selectedRhythmFilter) {
      return false;
    }
    if (!quarantineSearch.trim()) return true;
    const term = quarantineSearch.toLowerCase();
    return (
      item.title.toLowerCase().includes(term) ||
      (item.city && item.city.toLowerCase().includes(term)) ||
      (item.locationName && item.locationName.toLowerCase().includes(term)) ||
      (item.category && item.category.toLowerCase().includes(term))
    );
  });

  return (
    <div className="max-w-6xl mx-auto py-2 sm:py-4 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Toast de notificação */}
      {statusMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl text-sm font-semibold border backdrop-blur-md transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40 shadow-emerald-950/50'
              : statusMessage.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-500/40 shadow-rose-950/50'
              : 'bg-cyan-950/90 text-cyan-200 border-cyan-500/40 shadow-cyan-950/50'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          ) : statusMessage.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          ) : (
            <Sparkles className="w-5 h-5 text-cyan-400 flex-shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* HEADER DE NAVEGAÇÃO */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToMenu}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700"
            >
              ← Central de Gerenciamento
            </button>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Ticket className="w-4 h-4" />
              </span>
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                Importador Ticket360
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase tracking-wider">
                  Módulo Oficial
                </span>
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            Puxe eventos ao vivo da Ticket360 por link ou robô de busca de entretenimento e envie para a quarentena com curadoria antes de liberar no catálogo.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {onNavigateToLiberarEventos && (
            <button
              type="button"
              onClick={() => onNavigateToLiberarEventos()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-950/30 cursor-pointer transition-all active:scale-95"
              title="Abrir tela oficial de Liberar Eventos"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-950" />
              <span>Ir para Liberar Eventos</span>
              <span className="px-1.5 py-0.5 rounded-full bg-slate-950 text-amber-300 text-[10px] font-black">
                {quarantineEvents.length}
              </span>
            </button>
          )}

          <div className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">Na Quarentena:</span>
            <span className="font-extrabold text-white text-sm">{quarantineEvents.length}</span>
          </div>
          <button
            onClick={() => fetchQuarantine()}
            disabled={isLoadingQuarantine}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
            title="Atualizar Quarentena"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingQuarantine ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* SEÇÃO 1: EXTRATOR DA TICKET360 POR URL */}
      <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-black">
              1
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Puxar Dados da Ticket360 pelo Link</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Instantâneo
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Cole o link direto do evento na Ticket360. Extração de título, data, horário, local, endereço, preço e imagem.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsBatchMode(!isBatchMode);
              setParseError(null);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              isBatchMode
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-extrabold shadow-lg shadow-cyan-500/20'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isBatchMode ? 'Voltar para URL Única' : 'Importar em Lote (Vários Links)'}</span>
          </button>
        </div>

        {!isBatchMode ? (
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-300">
              Cole o link do evento da Ticket360 (ex: https://www.ticket360.com.br/evento/...):
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Link2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  value={ticket360Url}
                  onChange={(e) => setTicket360Url(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleParseUrl();
                  }}
                  placeholder="https://www.ticket360.com.br/evento/33486/ingressos-para-jorge-aragao-e-fundo-de-quintal"
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 text-white text-sm outline-none transition-all placeholder:text-slate-600 font-mono text-xs"
                />
                {ticket360Url && (
                  <button
                    onClick={() => setTicket360Url('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleParseUrl()}
                disabled={isLoadingUrl || !ticket360Url.trim()}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {isLoadingUrl ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Extraindo Dados...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Puxar Dados</span>
                  </>
                )}
              </button>
            </div>

            {/* Sugestões de teste rápido */}
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400 pt-1">
              <span className="text-slate-500">Exemplos rápidos da Ticket360:</span>
              <button
                type="button"
                onClick={() => {
                  const url = 'https://www.ticket360.com.br/evento/33486/ingressos-para-jorge-aragao-e-fundo-de-quintal';
                  setTicket360Url(url);
                  handleParseUrl(url);
                }}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors cursor-pointer"
              >
                Jorge Aragão & Fundo de Quintal
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = 'https://www.ticket360.com.br/evento/33673/ingressos-para-pericles-yan-e-grupo-envolvencia';
                  setTicket360Url(url);
                  handleParseUrl(url);
                }}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors cursor-pointer"
              >
                Péricles & Envolvência
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = 'https://www.ticket360.com.br/evento/33672/ingressos-para-rod-hanna-flashback';
                  setTicket360Url(url);
                  handleParseUrl(url);
                }}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors cursor-pointer"
              >
                Rod Hanna Flashback
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-300">
              Cole uma URL da Ticket360 por linha para importação em lote:
            </label>
            <textarea
              rows={4}
              value={batchUrls}
              onChange={(e) => setBatchUrls(e.target.value)}
              placeholder={`https://www.ticket360.com.br/evento/33486/ingressos-para-jorge-aragao-e-fundo-de-quintal\nhttps://www.ticket360.com.br/evento/33673/ingressos-para-pericles-yan-e-grupo-envolvencia\nhttps://www.ticket360.com.br/evento/33672/ingressos-para-rod-hanna-flashback`}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 text-white font-mono text-xs outline-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {batchProgress || `${batchUrls.split('\n').filter((u) => u.trim().startsWith('http')).length} links identificados`}
              </span>
              <button
                type="button"
                onClick={handleProcessBatchUrls}
                disabled={isLoadingUrl || !batchUrls.trim()}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoadingUrl ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Importar Links para Quarentena</span>
              </button>
            </div>
          </div>
        )}

        {parseError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {/* PRÉVIA DO EVENTO EXTRAÍDO */}
        {previewEvent && (
          <div className="mt-6 border-t border-slate-800 pt-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Dados Identificados na Ticket360
              </span>
              <button
                type="button"
                onClick={() => setPreviewEvent(null)}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Cancelar Prévia
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-950/80 p-5 rounded-2xl border border-cyan-500/30">
              {/* Imagem do evento */}
              <div className="space-y-2">
                <div className="relative aspect-[16/9] md:aspect-[4/3] rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
                  {previewEvent.imageUrl ? (
                    <img
                      src={previewEvent.imageUrl}
                      alt={previewEvent.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Ticket className="w-12 h-12 text-slate-700" />
                  )}
                  {previewEvent.isGratuito ? (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950 font-bold text-[10px] uppercase">
                      Gratuito
                    </span>
                  ) : (
                    previewEvent.price !== undefined &&
                    previewEvent.price > 0 && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-cyan-500 text-slate-950 font-bold text-[10px]">
                        A partir de R$ {previewEvent.price.toFixed(2)}
                      </span>
                    )
                  )}
                </div>

                {previewEvent.urlOrigem && (
                  <a
                    href={previewEvent.urlOrigem}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 truncate"
                  >
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    <span>Abrir página oficial na Ticket360</span>
                  </a>
                )}
              </div>

              {/* Campos editáveis do evento */}
              <div className="md:col-span-2 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Título do Evento</label>
                  <input
                    type="text"
                    value={previewEvent.title || ''}
                    onChange={(e) => setPreviewEvent({ ...previewEvent, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm font-bold focus:border-cyan-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Data</label>
                    <input
                      type="date"
                      value={previewEvent.date || ''}
                      onChange={(e) => setPreviewEvent({ ...previewEvent, date: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Horário</label>
                    <input
                      type="time"
                      value={previewEvent.time || ''}
                      onChange={(e) => setPreviewEvent({ ...previewEvent, time: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Cidade</label>
                    <input
                      type="text"
                      value={previewEvent.city || ''}
                      onChange={(e) => setPreviewEvent({ ...previewEvent, city: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Estado (UF)</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={previewEvent.state || ''}
                      onChange={(e) => setPreviewEvent({ ...previewEvent, state: e.target.value.toUpperCase() })}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold text-center outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Local / Espaço</label>
                    <input
                      type="text"
                      value={previewEvent.locationName || ''}
                      onChange={(e) => setPreviewEvent({ ...previewEvent, locationName: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Categoria Sugerida</label>
                    <select
                      value={previewEvent.category || 'Shows'}
                      onChange={(e) => setPreviewEvent({ ...previewEvent, category: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-bold text-xs outline-none cursor-pointer"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Link de Ingressos (Ticket360)</label>
                  <input
                    type="text"
                    value={previewEvent.ticketUrl || ''}
                    onChange={(e) => setPreviewEvent({ ...previewEvent, ticketUrl: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs font-mono outline-none"
                  />
                </div>

                {/* Botões de Ação da Prévia */}
                <div className="flex items-center gap-3 pt-3 flex-wrap">
                  <button
                    type="button"
                    onClick={handleSaveToQuarantine}
                    className="flex-1 min-w-[200px] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
                  >
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <span>Enviar para Quarentena</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAndApproveNow}
                    className="flex-1 min-w-[200px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                    <span>Liberar no App Agora</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* SEÇÃO 2: ROBÔ DE BUSCA AO VIVO TICKET360 (CENTENAS DE REGISTROS) */}
      <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-black">
              2
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Robô de Busca ao Vivo Ticket360</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Tempo Real
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Varredura direta no acervo e catálogo da Ticket360. Filtre por gênero, estado, cidade e importe com 1 clique para a quarentena.
              </p>
            </div>
          </div>

          {/* Descoberta automática dos 7 ritmos */}
          <button
            type="button"
            onClick={handleDiscoverAllRhythms}
            disabled={isDiscoveringAll}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-cyan-950/50 cursor-pointer disabled:opacity-50"
          >
            {isDiscoveringAll ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Varrendo Todos os 7 Ritmos...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Puxar Todos os 7 Ritmos para Quarentena</span>
              </>
            )}
          </button>
        </div>

        {/* 7 BOTÕES RÁPIDOS DE RITMOS */}
        <div className="mb-5">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Music className="w-3.5 h-3.5 text-cyan-400" />
            <span>Filtro Rápido por Ritmo:</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {TARGET_RHYTHMS.map((r) => (
              <button
                key={r.name}
                type="button"
                onClick={() => {
                  setLiveSearchQuery(r.name.toLowerCase());
                  setTimeout(() => handleLiveSearch(true), 50);
                }}
                className="p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-left transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="text-lg mb-1">{r.icon}</div>
                <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors leading-tight">
                  {r.name}
                </div>
                <div className="text-[9px] text-slate-500 group-hover:text-slate-400 truncate mt-0.5">
                  {r.badge}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* BARRA DE FILTROS E BUSCA */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-5 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={liveSearchQuery}
              onChange={(e) => setLiveSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLiveSearch(true);
              }}
              placeholder="Buscar artista, banda ou ritmo (ou deixe em branco para ver todos do estado)..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-cyan-500"
            />
          </div>

          <div className="sm:col-span-2">
            <select
              value={liveSearchState}
              onChange={(e) => {
                setLiveSearchState(e.target.value);
                setLiveSearchCity('Todas');
              }}
              className="w-full px-2.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs outline-none cursor-pointer"
            >
              {BRAZILIAN_STATES.map((st) => (
                <option key={st.uf} value={st.uf}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={liveSearchCity}
              onChange={(e) => setLiveSearchCity(e.target.value)}
              className="w-full px-2.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs outline-none cursor-pointer"
            >
              <option value="Todas">Todas as Cidades de SP</option>
              {TOP_CITIES_BY_STATE['SP']?.map((c) => (
                <option key={c} value={c}>
                  {c} (SP)
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={() => handleLiveSearch(true)}
              disabled={isSearchingLive}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md shadow-cyan-950/40"
            >
              {isSearchingLive ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>{isSearchingLive ? 'Buscando...' : 'Pesquisar'}</span>
            </button>
          </div>
        </div>

        {isSearchingLive && (
          <div className="mb-5 p-4 rounded-xl bg-cyan-950/70 border border-cyan-500/50 text-cyan-200 text-xs flex items-center gap-3 animate-in fade-in duration-200 shadow-lg shadow-cyan-950/50">
            <RefreshCw className="w-5 h-5 animate-spin text-cyan-400 shrink-0" />
            <div>
              <p className="font-bold text-white text-sm">Buscando eventos da Ticket360 e salvando na Quarentena...</p>
              <p className="text-[11px] text-cyan-300/80">Os registros estão sendo gravados no banco de dados e você entrará diretamente na tela de Liberar Eventos.</p>
            </div>
          </div>
        )}

        {/* BARRA DE AÇÃO EM LOTE DOS RESULTADOS */}
        {liveSearchResults.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleSelectAllSearch}
                className="text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                {selectedSearchIds.length > 0 &&
                selectedSearchIds.length >= liveSearchResults.filter((e) => e.statusInDb !== 'aprovado').length ? (
                  <CheckSquare className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
                <span>
                  Selecionar Todos ({selectedSearchIds.length} de {liveSearchResults.length})
                </span>
              </button>
              {liveSearchTotal !== null && (
                <span className="text-xs text-slate-500">
                  Total na Ticket360: <strong className="text-cyan-400">{liveSearchTotal}</strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={searchTargetCategory}
                onChange={(e) => setSearchTargetCategory(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 font-bold text-xs outline-none"
              >
                <option value="auto">Categoria Automática</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleImportSearchBatch}
                disabled={isImportingSearchBatch || selectedSearchIds.length === 0}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                {isImportingSearchBatch ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>Importar Selecionados ({selectedSearchIds.length})</span>
              </button>

              <button
                type="button"
                onClick={handleImportAllQuery}
                disabled={isImportingAllQuery}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                title="Puxar todos os resultados da busca de uma só vez"
              >
                {isImportingAllQuery ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
                <span>Importar Todos da Busca</span>
              </button>
            </div>
          </div>
        )}

        {/* LISTA / GRID DE RESULTADOS AO VIVO */}
        {isSearchingLive ? (
          <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
            <span>Consultando catálogo ao vivo da Ticket360...</span>
          </div>
        ) : liveSearchResults.length > 0 ? (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveSearchResults.map((event, idx) => {
              const isSelected = selectedSearchIds.includes(event.ticketUrl || event.title);
              const isApproved = event.statusInDb === 'aprovado';
              const isQuarantine = event.statusInDb === 'quarentena';

              return (
                <div
                  key={`${event.ticketUrl}-${idx}`}
                  onClick={() => !isApproved && toggleSearchSelection(event.ticketUrl || event.title)}
                  className={`relative p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-500/80 shadow-lg shadow-cyan-950/50'
                      : 'bg-slate-950/60 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
                  } ${isApproved ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <div>
                    {/* Imagem + Badge de Status */}
                    <div className="relative aspect-[16/9] rounded-lg overflow-hidden bg-slate-900 border border-slate-800 mb-2.5">
                      {event.imageUrl ? (
                        <img
                          src={event.imageUrl}
                          alt={event.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Ticket className="w-8 h-8 text-slate-700" />
                        </div>
                      )}

                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-sm text-cyan-300 font-bold text-[10px] border border-cyan-500/30">
                          {event.rhythm || 'Shows'}
                        </span>
                      </div>

                      {/* Checkbox de seleção */}
                      <div className="absolute top-2 right-2">
                        {isApproved ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950 font-black text-[9px] uppercase">
                            No App
                          </span>
                        ) : isQuarantine ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-[9px] uppercase">
                            Na Quarentena
                          </span>
                        ) : (
                          <div className="p-1 rounded-md bg-slate-950/80 border border-slate-700">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-cyan-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-white line-clamp-2 leading-snug mb-1">
                      {event.title}
                    </h4>

                    <div className="space-y-1 text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-cyan-400" />
                        <span>{event.date} · {event.time}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                        <span className="truncate">{event.locationName} ({event.city}/{event.state})</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="font-extrabold text-white text-xs">
                      {event.isGratuito ? 'Gratuito' : `R$ ${Number(event.price || 0).toFixed(2)}`}
                    </span>
                    <a
                      href={event.ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      <span>Ver na Ticket360</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paginação / Carregar Mais */}
          {liveSearchPages > 1 && (
            <div className="flex items-center justify-center pt-3">
              <button
                type="button"
                onClick={() => handleLiveSearch(false)}
                disabled={isLoadingMoreSearch || liveSearchPage + 1 >= liveSearchPages}
                className="px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/40 text-xs font-bold text-slate-200 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {isLoadingMoreSearch ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Carregando Mais Eventos da Ticket360...</span>
                  </>
                ) : liveSearchPage + 1 < liveSearchPages ? (
                  <>
                    <RefreshCw className="w-4 h-4 text-cyan-400" />
                    <span>Carregar Mais Eventos da Ticket360 (Página {liveSearchPage + 2} de {liveSearchPages})</span>
                  </>
                ) : (
                  <span>Todos os eventos encontrados foram carregados ({liveSearchResults.length})</span>
                )}
              </button>
            </div>
          )}
          </>
        ) : hasSearchedOnce ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            Nenhum evento encontrado na Ticket360 com os filtros atuais. Tente buscar por outro ritmo ou cidade.
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
            <Ticket className="w-8 h-8 text-slate-700" />
            <span>Clique em um ritmo acima ou digite um termo para buscar eventos da Ticket360 em tempo real.</span>
          </div>
        )}
      </section>

      {/* SEÇÃO 3: CENTRAL DA QUARENTENA TICKET360 (CURADORIA & LIBERAÇÃO) */}
      <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-black">
              3
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Quarentena da Ticket360</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {quarantineEvents.length} registros
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Eventos guardados de forma segura. Edite campos, aprove em lote ou libere individualmente no aplicativo.
              </p>
            </div>
          </div>

          {quarantineEvents.length > 0 && (
            <button
              type="button"
              onClick={handleClearEntireQuarantine}
              className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Limpar Quarentena</span>
            </button>
          )}
        </div>

        {/* FILTROS DA QUARENTENA */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={quarantineSearch}
              onChange={(e) => setQuarantineSearch(e.target.value)}
              placeholder="Filtrar por título, local, cidade..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-500"
            />
          </div>

          <div className="sm:w-56">
            <select
              value={selectedRhythmFilter}
              onChange={(e) => setSelectedRhythmFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-cyan-300 font-bold text-xs outline-none cursor-pointer"
            >
              <option value="Todos">Todos os Ritmos</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* AÇÕES EM LOTE NA QUARENTENA */}
        {selectedItemIds.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-cyan-950/50 border border-cyan-500/40 flex items-center justify-between flex-wrap gap-3 animate-in fade-in">
            <span className="text-xs font-bold text-cyan-200">
              {selectedItemIds.length} eventos selecionados na quarentena:
            </span>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={batchTargetCategory}
                onChange={(e) => setBatchTargetCategory(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 font-bold text-xs outline-none"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleBatchApprove}
                disabled={isProcessingBatch}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                {isProcessingBatch ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Aprovar Selecionados</span>
              </button>

              <button
                type="button"
                onClick={handleBatchDelete}
                disabled={isProcessingBatch}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Selecionados</span>
              </button>
            </div>
          </div>
        )}

        {/* TABELA / LISTA DA QUARENTENA */}
        {filteredQuarantineEvents.length > 0 ? (
          <div className="space-y-3">
            {filteredQuarantineEvents.map((item) => {
              const isSelected = selectedItemIds.includes(item.id);

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-500/70'
                      : 'bg-slate-950/60 hover:bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setSelectedItemIds((prev) =>
                          prev.includes(item.id) ? prev.filter((i) => i !== item.id) : [...prev, item.id]
                        );
                      }}
                      className="w-4 h-4 rounded text-cyan-600 focus:ring-0 cursor-pointer"
                    />

                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-16 h-12 rounded-lg object-cover bg-slate-900 border border-slate-800 flex-shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-16 h-12 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0">
                        <Ticket className="w-5 h-5 text-slate-700" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                          {item.category || 'Shows'}
                        </span>
                        <span className="text-xs text-slate-400">
                          {item.date} · {item.time}
                        </span>
                        <span className="text-xs text-slate-400">
                          {item.city}/{item.state}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                      <p className="text-xs text-slate-400 truncate">{item.locationName} · {item.address}</p>
                    </div>
                  </div>

                  {/* Ações por item */}
                  <div className="flex items-center gap-2 flex-wrap flex-shrink-0 w-full sm:w-auto justify-end">
                    {item.ticketUrl && (
                      <a
                        href={item.ticketUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
                        title="Ver na Ticket360"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => setEditingItem(item)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteQuarantineItem(item.id, item.title)}
                      className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 cursor-pointer"
                      title="Excluir da quarentena"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApproveQuarantineItem(item)}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                      <span>Liberar no App</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-slate-700" />
            <span>Nenhum evento na Quarentena da Ticket360 no momento.</span>
          </div>
        )}
      </section>

      {/* MODAL DE EDIÇÃO DE ITEM NA QUARENTENA */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-cyan-400" />
                <span>Editar Evento da Quarentena</span>
              </h4>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Título</label>
                <input
                  type="text"
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Data</label>
                  <input
                    type="date"
                    value={editingItem.date}
                    onChange={(e) => setEditingItem({ ...editingItem, date: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Horário</label>
                  <input
                    type="time"
                    value={editingItem.time}
                    onChange={(e) => setEditingItem({ ...editingItem, time: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Cidade</label>
                  <input
                    type="text"
                    value={editingItem.city || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, city: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Estado (UF)</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={editingItem.state || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, state: e.target.value.toUpperCase() })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-center font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Local / Espaço</label>
                <input
                  type="text"
                  value={editingItem.locationName || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, locationName: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Categoria</label>
                <select
                  value={editingItem.category || 'Shows'}
                  onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-cyan-300 font-bold cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Preço (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingItem.price || 0}
                  onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditingItem}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Alterações</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
