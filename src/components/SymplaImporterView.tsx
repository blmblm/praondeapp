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

export const BRAZILIAN_STATES = [
  { uf: 'Todos', name: 'Todos os Estados (Brasil Todo)' },
  { uf: 'SP', name: 'SP - São Paulo' },
  { uf: 'RJ', name: 'RJ - Rio de Janeiro' },
  { uf: 'MG', name: 'MG - Minas Gerais' },
  { uf: 'BA', name: 'BA - Bahia' },
  { uf: 'PR', name: 'PR - Paraná' },
  { uf: 'RS', name: 'RS - Rio Grande do Sul' },
  { uf: 'SC', name: 'SC - Santa Catarina' },
  { uf: 'DF', name: 'DF - Distrito Federal' },
  { uf: 'PE', name: 'PE - Pernambuco' },
  { uf: 'CE', name: 'CE - Ceará' },
  { uf: 'GO', name: 'GO - Goiás' },
  { uf: 'ES', name: 'ES - Espírito Santo' },
  { uf: 'PA', name: 'PA - Pará' },
  { uf: 'AM', name: 'AM - Amazonas' },
  { uf: 'MT', name: 'MT - Mato Grosso' },
  { uf: 'MS', name: 'MS - Mato Grosso do Sul' },
  { uf: 'MA', name: 'MA - Maranhão' },
  { uf: 'RN', name: 'RN - Rio Grande do Norte' },
  { uf: 'PB', name: 'PB - Paraíba' },
  { uf: 'AL', name: 'AL - Alagoas' },
  { uf: 'SE', name: 'SE - Sergipe' },
  { uf: 'PI', name: 'PI - Piauí' },
  { uf: 'RO', name: 'RO - Rondônia' },
  { uf: 'TO', name: 'TO - Tocantins' },
  { uf: 'AC', name: 'AC - Acre' },
  { uf: 'AP', name: 'AP - Amapá' },
  { uf: 'RR', name: 'RR - Roraima' },
];

export const TOP_CITIES_BY_STATE: Record<string, string[]> = {
  SP: ['São Paulo', 'Campinas', 'Santos', 'Santo André', 'São Bernardo do Campo', 'São Caetano do Sul', 'Guarulhos', 'Osasco', 'Ribeirão Preto', 'Sorocaba', 'São José dos Campos', 'Bauru', 'Piracicaba'],
  RJ: ['Rio de Janeiro', 'Niterói', 'Petrópolis', 'Cabo Frio', 'Duque de Caxias', 'Nova Iguaçu', 'Volta Redonda', 'Macaé', 'Campos dos Goytacazes', 'Búzios', 'Angra dos Reis'],
  MG: ['Belo Horizonte', 'Uberlândia', 'Juiz de Fora', 'Contagem', 'Betim', 'Montes Claros', 'Ouro Preto', 'Tiradentes', 'Poços de Caldas', 'Divinópolis', 'Governador Valadares'],
  BA: ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Ilhéus', 'Porto Seguro', 'Itabuna', 'Lauro de Freitas', 'Camaçari', 'Barreiras', 'Juazeiro'],
  PR: ['Curitiba', 'Londrina', 'Maringá', 'Cascavel', 'Ponta Grossa', 'Foz do Iguaçu', 'São José dos Pinhais'],
  RS: ['Porto Alegre', 'Caxias do Sul', 'Canoas', 'Pelotas', 'Santa Maria', 'Gravataí', 'Gramado', 'Bento Gonçalves', 'Passo Fundo'],
  SC: ['Florianópolis', 'Joinville', 'Blumenau', 'Balneário Camboriú', 'Itajaí', 'Chapecó', 'Criciúma'],
  DF: ['Brasília', 'Taguatinga', 'Ceilândia', 'Águas Claras', 'Guará'],
  PE: ['Recife', 'Olinda', 'Jaboatão dos Guararapes', 'Caruaru', 'Petrolina', 'Paulista'],
  CE: ['Fortaleza', 'Caucaia', 'Juazeiro do Norte', 'Sobral', 'Maracanaú'],
  GO: ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde', 'Caldas Novas', 'Pirenópolis'],
  ES: ['Vitória', 'Vila Velha', 'Serra', 'Cariacica', 'Guarapari', 'Cachoeiro de Itapemirim'],
  PA: ['Belém', 'Ananindeua', 'Santarém', 'Marabá'],
  AM: ['Manaus', 'Parintins', 'Itacoatiara'],
  MT: ['Cuiabá', 'Várzea Grande', 'Rondonópolis', 'Sinop'],
  MS: ['Campo Grande', 'Dourados', 'Três Lagoas', 'Bonito'],
  MA: ['São Luís', 'Imperatriz', 'Caxias'],
  RN: ['Natal', 'Mossoró', 'Parnamirim'],
  PB: ['João Pessoa', 'Campina Grande', 'Santa Rita'],
  AL: ['Maceió', 'Arapiraca', 'Rio Largo'],
  SE: ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto'],
  PI: ['Teresina', 'Parnaíba', 'Picos'],
  RO: ['Porto Velho', 'Ji-Paraná', 'Ariquemes'],
  TO: ['Palmas', 'Araguaína', 'Gurupi'],
  AC: ['Rio Branco', 'Cruzeiro do Sul'],
  AP: ['Macapá', 'Santana'],
  RR: ['Boa Vista', 'Rorainópolis'],
};

interface SymplaImporterViewProps {
  categories: string[];
  cities: { id: string; name: string; state: string }[];
  onBackToMenu: () => void;
  onEventApproved?: (event: EventItem) => void;
}

export const SymplaImporterView: React.FC<SymplaImporterViewProps> = ({
  categories,
  cities,
  onBackToMenu,
  onEventApproved,
}) => {
  // Input de URL individual
  const [symplaUrl, setSymplaUrl] = useState('');
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

  // Robô de Busca ao Vivo Sympla (Centenas de registros em tempo real)
  const [liveSearchQuery, setLiveSearchQuery] = useState('samba');
  const [batchRhythmState, setBatchRhythmState] = useState('Todos');
  const [liveSearchCity, setLiveSearchCity] = useState('Todas');
  const [liveSearchState, setLiveSearchState] = useState('Todos');
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
  const [isSyncingRelations, setIsSyncingRelations] = useState(false);
  const [syncResultStats, setSyncResultStats] = useState<any>(null);
  const [hasSearchedOnce, setHasSearchedOnce] = useState(false);

  // Definição visual dos 7 ritmos solicitados
  const TARGET_RHYTHMS = [
    { name: 'Baile Nostalgia', icon: '💃', badge: 'Flashback 70/80/90' },
    { name: 'Samba e Pagode', icon: '🥁', badge: 'Rodas & Pagode 90' },
    { name: 'Baile Terceira Idade', icon: '👵', badge: 'Dança de Salão & Bolero' },
    { name: 'Forró', icon: '🪗', badge: 'Rastapé & Universitário' },
    { name: 'Forró Pé de Serra', icon: '🌵', badge: 'Triângulo, Zabumba & Sanfona' },
    { name: 'Bailes', icon: '🕺', badge: 'Bailes Tradicionais' },
    { name: 'Shows', icon: '🎸', badge: 'Shows Ao Vivo' },
  ];

  // Edição de item existente na quarentena
  const [editingItem, setEditingItem] = useState<ImportedEventItem | null>(null);

  // Armazena em memória IDs e Títulos liberados/excluídos para garantir imunidade absoluta a recarregamentos
  const excludedQuarantineIdsRef = useRef<Set<string>>(new Set());
  const excludedTitlesRef = useRef<Set<string>>(new Set());

  // Carregar eventos da quarentena ao iniciar (permite modo silencioso para não desmontar a tabela)
  const fetchQuarantine = async (silent: boolean = false) => {
    if (!silent) {
      setIsLoadingQuarantine(true);
    }
    try {
      const res = await fetch('/api/imported-events?status=quarentena');
      if (res.ok) {
        const data: ImportedEventItem[] = await res.json();
        // Filtra estritamente itens que foram liberados ou excluídos nesta sessão
        const filtered = data.filter((item) => {
          if (excludedQuarantineIdsRef.current.has(item.id)) return false;
          if (item.title && excludedTitlesRef.current.has(item.title.toLowerCase().trim())) return false;
          return true;
        });
        setQuarantineEvents(filtered);
      }
    } catch (err) {
      console.warn('Erro ao carregar quarentena:', err);
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

  // Buscar dados da URL na Sympla
  const handleParseUrl = async (urlToParse?: string) => {
    const targetUrl = (urlToParse || symplaUrl).trim();
    if (!targetUrl) {
      setParseError('Por favor, informe o link do evento da Sympla.');
      return;
    }

    setIsLoadingUrl(true);
    setParseError(null);

    try {
      const res = await fetch('/api/sympla/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Não foi possível extrair dados da página informada');
      }

      const p = json.data;

      // Monta prévia de evento
      setPreviewEvent({
        id: `imp-${Date.now()}`,
        origem: 'sympla',
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
        status: 'quarentena',
      });

      showToast('Dados do evento da Sympla extraídos com sucesso! Revise e escolha salvar na quarentena ou liberar no app.');
    } catch (err: any) {
      setParseError(err.message || 'Erro ao conectar à página da Sympla. Verifique a URL.');
    } finally {
      setIsLoadingUrl(false);
    }
  };

  // Processar URLs em Lote
  const handleBatchImport = async () => {
    const urls = batchUrls
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 5);

    if (urls.length === 0) {
      setParseError('Cole pelo menos um link da Sympla válido por linha.');
      return;
    }

    setIsLoadingUrl(true);
    setParseError(null);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < urls.length; i++) {
      setBatchProgress(`Processando evento ${i + 1} de ${urls.length}...`);
      try {
        const res = await fetch('/api/sympla/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urls[i] }),
        });
        const json = await res.json();
        if (res.ok && json.success) {
          const p = json.data;
          await fetch('/api/imported-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: `imp-${Date.now()}-${i}`,
              origem: 'sympla',
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
  };

  // Salvar prévia na Quarentena (tabela independente eventos_importados)
  const handleSaveToQuarantine = async () => {
    if (!previewEvent || !previewEvent.title) return;

    try {
      const res = await fetch('/api/imported-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(previewEvent),
      });

      const data = await res.json();
      if (res.ok) {
        setPreviewEvent(null);
        setSymplaUrl('');
        await fetchQuarantine();
        if (data.count === 0 && data.skippedCount > 0) {
          showToast('ℹ️ Este evento já foi importado anteriormente (já está na Quarentena ou já ativo no App). Duplicação evitada!', 'info');
        } else {
          showToast('Evento salvo na Quarentena com sucesso! Ele não aparece para o público até ser liberado.');
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
      // 1. Salva na quarentena primeiro
      const resSave = await fetch('/api/imported-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(previewEvent),
      });

      if (!resSave.ok) throw new Error('Erro ao registrar evento importado');
      const saveData = await resSave.json();
      const realId = saveData.items?.[0]?.id || previewEvent.id;

      // 2. Aprova e carrega no app oficial usando o ID real
      const resApprove = await fetch(`/api/imported-events/${realId}/approve`, {
        method: 'POST',
      });

      const json = await resApprove.json();
      if (resApprove.ok && json.success) {
        // Sincroniza no Firestore para garantir visualização imediata
        if (json.event) {
          saveEventToFirestore(json.event).catch(() => {});
          if (onEventApproved) onEventApproved(json.event);
        }

        setPreviewEvent(null);
        setSymplaUrl('');
        setQuarantineEvents((prev) => prev.filter((it) => it.id !== realId && it.title !== previewEvent.title));
        await fetchQuarantine();
        showToast('Evento liberado com sucesso no App! Ele já está disponível no catálogo de eventos.');
      } else {
        throw new Error(json.error || 'Erro ao aprovar evento');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao liberar evento no app', 'error');
    }
  };

  // Confirmar liberação de item da quarentena e incluir na tabela de eventos
  const handleApproveQuarantineItem = async (item: ImportedEventItem) => {
    // 1. Marca imediatamente nos sets de exclusão para blindar contra qualquer recarga
    excludedQuarantineIdsRef.current.add(item.id);
    if (item.title) excludedTitlesRef.current.add(item.title.toLowerCase().trim());

    // 2. Remoção imediata da lista na tela (tabela quarentena sem o registro no mesmo instante)
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
        // Atualiza a quarentena em background de forma silenciosa (sem desmontar a tabela)
        await fetchQuarantine(true);
        showToast(`Evento "${item.title}" liberado no aplicativo e apagado da quarentena!`);
      } else {
        throw new Error(json.error || 'Erro ao aprovar evento');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao aprovar evento', 'error');
    }
  };

  // Descartar item da quarentena (com atualização instantânea na UI)
  const handleDiscardQuarantineItem = async (id: string, title: string) => {
    excludedQuarantineIdsRef.current.add(id);
    if (title) excludedTitlesRef.current.add(title.toLowerCase().trim());

    // Atualização instantânea na interface
    setQuarantineEvents((prev) => prev.filter((it) => it.id !== id && (!title || it.title.toLowerCase().trim() !== title.toLowerCase().trim())));
    setSelectedItemIds((prev) => prev.filter((selectedId) => selectedId !== id));

    try {
      const res = await fetch(`/api/imported-events/${id}?permanent=true`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast(`Evento "${title}" removido com sucesso.`);
        await fetchQuarantine(true);
      } else {
        showToast('Não foi possível remover o item da quarentena.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir evento', 'error');
    }
  };

  // Confirmar liberação de todos da quarentena de uma só vez
  const handleApproveAll = async () => {
    if (quarantineEvents.length === 0) return;

    const allEvents = [...quarantineEvents];
    allEvents.forEach((it) => {
      excludedQuarantineIdsRef.current.add(it.id);
      if (it.title) excludedTitlesRef.current.add(it.title.toLowerCase().trim());
    });

    // Remoção imediata da UI
    setQuarantineEvents([]);
    setSelectedItemIds([]);

    try {
      const res = await fetch('/api/imported-events/approve-all', {
        method: 'POST',
      });
      const json = await res.json();

      // Apaga todos os registros restantes da quarentena
      await fetch('/api/imported-events/clear', { method: 'POST' }).catch(() => {});
      window.dispatchEvent(new CustomEvent('praonde:quarantine-cleared'));

      if (res.ok && json.success) {
        if (Array.isArray(json.events)) {
          json.events.forEach((evt: EventItem) => {
            saveEventToFirestore(evt).catch(() => {});
            if (onEventApproved) onEventApproved(evt);
          });
        }
        await fetchQuarantine(true);
        showToast(`${json.count || allEvents.length} eventos foram liberados no aplicativo e todos os registros da quarentena foram apagados!`);
      } else {
        throw new Error(json.error || 'Erro ao aprovar todos os eventos');
      }
    } catch (err: any) {
      await fetch('/api/imported-events/clear', { method: 'POST' }).catch(() => {});
      window.dispatchEvent(new CustomEvent('praonde:quarantine-cleared'));
      showToast(err.message || 'Erro ao aprovar eventos em lote', 'error');
      await fetchQuarantine(true);
    }
  };

  // Esvaziar / Limpar todos os registros da quarentena sem aprovar
  const handleClearAllQuarantine = async () => {
    if (quarantineEvents.length === 0) {
      showToast('A quarentena já está vazia.', 'info');
      return;
    }

    setQuarantineEvents([]);
    setSelectedItemIds([]);

    try {
      const res = await fetch('/api/imported-events/clear', { method: 'POST' });
      const json = await res.json();
      window.dispatchEvent(new CustomEvent('praonde:quarantine-cleared'));
      window.dispatchEvent(new CustomEvent('praonde:quarantine-updated'));
      showToast('Todos os registros da quarentena foram apagados com sucesso!');
      await fetchQuarantine(true);
    } catch (err: any) {
      showToast(err.message || 'Erro ao limpar quarentena', 'error');
      await fetchQuarantine(true);
    }
  };

  // Salvar edição do item na quarentena
  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      const res = await fetch(`/api/imported-events/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingItem),
      });
      if (res.ok) {
        setEditingItem(null);
        await fetchQuarantine(true);
        showToast('Detalhes do evento atualizados na quarentena!');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar dados', 'error');
    }
  };

  // Salvar edição e incluir diretamente na tabela de eventos apagando da quarentena
  const handleSaveAndApproveEdit = async () => {
    if (!editingItem) return;
    const itemToApprove = { ...editingItem };
    setEditingItem(null);

    excludedQuarantineIdsRef.current.add(itemToApprove.id);
    if (itemToApprove.title) excludedTitlesRef.current.add(itemToApprove.title.toLowerCase().trim());

    setQuarantineEvents((prev) => prev.filter((it) => it.id !== itemToApprove.id));
    setSelectedItemIds((prev) => prev.filter((selectedId) => selectedId !== itemToApprove.id));

    try {
      // 1. Atualiza dados na quarentena
      await fetch(`/api/imported-events/${itemToApprove.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemToApprove),
      });

      // 2. Aprova e inclui na tabela de eventos (que apaga definitivamente da quarentena)
      const res = await fetch(`/api/imported-events/${itemToApprove.id}/approve`, {
        method: 'POST',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        if (json.event) {
          saveEventToFirestore(json.event).catch(() => {});
          if (onEventApproved) onEventApproved(json.event);
        }
        await fetchQuarantine(true);
        showToast(`Evento "${itemToApprove.title}" liberado no aplicativo e apagado da quarentena!`);
      } else {
        throw new Error(json.error || 'Erro ao incluir evento na tabela de eventos');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao incluir evento na tabela', 'error');
    }
  };

  // 1. Trazer todos os 7 ritmos de uma só vez da Sympla (filtrado por estado se informado)
  const handleDiscoverAllRhythms = async () => {
    setIsDiscoveringAll(true);
    try {
      const res = await fetch('/api/sympla/discover-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: batchRhythmState !== 'Todos' ? batchRhythmState : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchQuarantine();
        const stateLabel = batchRhythmState !== 'Todos' ? ` em ${batchRhythmState}` : '';
        if (data.addedCount > 0) {
          showToast(
            `🎉 ${data.addedCount} novos eventos${stateLabel} foram adicionados à Quarentena! (${data.skippedCount || 0} já existentes foram ignorados para evitar duplicidade).`
          );
        } else {
          showToast(
            `ℹ️ Nenhum evento novo a importar${stateLabel}: todos os ${data.skippedCount || 0} eventos já foram importados, aprovados no app ou descartados anteriormente.`
          );
        }
      } else {
        throw new Error(data.error || 'Erro ao carregar ritmos');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao trazer todos os ritmos', 'error');
    } finally {
      setIsDiscoveringAll(false);
    }
  };

  // 2. Alteração rápida de categoria direto no card
  const handleQuickChangeCategory = async (id: string, newCategory: string) => {
    // Atualização otimista imediata na interface
    setQuarantineEvents((prev) =>
      prev.map((it) => (it.id === id ? { ...it, category: newCategory } : it))
    );

    try {
      const res = await fetch(`/api/imported-events/${id}/category`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory }),
      });
      if (res.ok) {
        showToast(`Categoria alterada para "${newCategory}" com sucesso!`);
      } else {
        await fetchQuarantine();
        throw new Error('Falha ao atualizar categoria');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao mudar categoria', 'error');
    }
  };

  // 3. Alterar categoria de múltiplos itens selecionados
  const handleBatchChangeCategory = async () => {
    if (selectedItemIds.length === 0) {
      showToast('Selecione ao menos um evento para alterar a categoria', 'error');
      return;
    }

    setIsProcessingBatch(true);
    try {
      const res = await fetch('/api/imported-events/batch-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedItemIds, category: batchTargetCategory }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchQuarantine();
        showToast(`Categoria "${batchTargetCategory}" aplicada a ${selectedItemIds.length} eventos!`);
        setSelectedItemIds([]);
      } else {
        throw new Error(data.error || 'Erro ao atualizar em lote');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar categoria dos itens selecionados', 'error');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  // 4. Confirmar liberação dos selecionados no App e apagar da quarentena
  const handleBatchApprove = async () => {
    if (selectedItemIds.length === 0) return;

    const idsToApprove = [...selectedItemIds];
    const itemsToApprove = quarantineEvents.filter((it) => idsToApprove.includes(it.id));
    
    idsToApprove.forEach((id) => excludedQuarantineIdsRef.current.add(id));
    itemsToApprove.forEach((it) => {
      if (it.title) excludedTitlesRef.current.add(it.title.toLowerCase().trim());
    });

    // Remoção imediata na interface da quarentena
    setQuarantineEvents((prev) => prev.filter((it) => !idsToApprove.includes(it.id)));
    setSelectedItemIds([]);

    setIsProcessingBatch(true);
    try {
      const res = await fetch('/api/imported-events/batch-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToApprove }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (Array.isArray(data.events)) {
          data.events.forEach((evt: EventItem) => {
            saveEventToFirestore(evt).catch(() => {});
            if (onEventApproved) onEventApproved(evt);
          });
        }
        await fetchQuarantine(true);
        showToast(`${data.count || idsToApprove.length} eventos selecionados foram liberados no aplicativo e apagados da quarentena!`);
      } else {
        throw new Error(data.error || 'Erro ao incluir selecionados');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao incluir selecionados', 'error');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  // 5. Descartar selecionados da quarentena
  const handleBatchDelete = async () => {
    if (selectedItemIds.length === 0) return;

    const idsToRemove = [...selectedItemIds];
    const itemsToRemove = quarantineEvents.filter((it) => idsToRemove.includes(it.id));

    idsToRemove.forEach((id) => excludedQuarantineIdsRef.current.add(id));
    itemsToRemove.forEach((it) => {
      if (it.title) excludedTitlesRef.current.add(it.title.toLowerCase().trim());
    });

    // Atualização imediata na UI
    setQuarantineEvents((prev) => prev.filter((it) => !idsToRemove.includes(it.id)));
    setSelectedItemIds([]);
    setIsProcessingBatch(true);

    try {
      const res = await fetch('/api/imported-events/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToRemove, permanent: true }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchQuarantine(true);
        showToast(`${idsToRemove.length} eventos foram removidos da quarentena.`);
      } else {
        throw new Error(data.error || 'Erro ao descartar selecionados');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir selecionados', 'error');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  // Selecionar ou desmarcar todos os itens visíveis no filtro atual
  const handleToggleSelectAll = () => {
    const allFilteredIds = filteredQuarantine.map((item) => item.id);
    const areAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedItemIds.includes(id));

    if (areAllSelected) {
      setSelectedItemIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedItemIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  // Selecionar ou desmarcar 1 item específico
  const handleToggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Contagem de eventos por ritmo para as badges de filtro
  const rhythmCounts = React.useMemo(() => {
    const counts: Record<string, number> = { Todos: quarantineEvents.length };
    TARGET_RHYTHMS.forEach((r) => {
      counts[r.name] = quarantineEvents.filter((e) => e.category === r.name).length;
    });
    return counts;
  }, [quarantineEvents]);

  const filteredQuarantine = quarantineEvents.filter((item) => {
    if (selectedRhythmFilter !== 'Todos' && item.category !== selectedRhythmFilter) {
      return false;
    }
    if (!quarantineSearch.trim()) return true;
    const q = quarantineSearch.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.city.toLowerCase().includes(q) ||
      item.locationName.toLowerCase().includes(q)
    );
  });

  // Executar busca ao vivo na Sympla com suporte explícito a estado informado e cidade
  const handleLiveSearch = async (
    pageNum = 0,
    append = false,
    queryOverride?: string,
    stateOverride?: string,
    cityOverride?: string
  ) => {
    if (append) {
      setIsLoadingMoreSearch(true);
    } else {
      setIsSearchingLive(true);
    }
    setHasSearchedOnce(true);

    const activeQuery = queryOverride !== undefined ? queryOverride : liveSearchQuery;
    const activeState = stateOverride !== undefined ? stateOverride : liveSearchState;
    const activeCity = cityOverride !== undefined ? cityOverride : liveSearchCity;

    try {
      const params = new URLSearchParams();
      if (activeQuery.trim()) params.append('q', activeQuery.trim());
      if (activeCity && activeCity !== 'Todas' && activeCity !== 'Todos') {
        params.append('city', activeCity);
      }
      if (activeState && activeState !== 'Todos' && activeState !== 'Todas') {
        params.append('state', activeState);
      }
      params.append('limit', String(liveSearchLimit));
      params.append('page', String(pageNum));

      const res = await fetch(`/api/sympla/search?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        if (append) {
          setLiveSearchResults((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            const newOnes = (data.events || []).filter((e: any) => !existingIds.has(e.id));
            return [...prev, ...newOnes];
          });
        } else {
          setLiveSearchResults(data.events || []);
          const newIds = (data.events || [])
            .filter((ev: any) => !ev.alreadyImported)
            .map((ev: any) => ev.id);
          setSelectedSearchIds(newIds);
        }
        setLiveSearchTotal(data.total);
        setLiveSearchPages(data.pages);
        setLiveSearchPage(pageNum);
      } else {
        showToast(data.error || 'Erro ao consultar catálogo da Sympla.', 'error');
      }
    } catch (err: any) {
      showToast('Falha na conexão com o robô de busca da Sympla.', 'error');
    } finally {
      setIsSearchingLive(false);
      setIsLoadingMoreSearch(false);
    }
  };

  // Alternar seleção de item da busca
  const handleToggleSelectSearchItem = (id: string) => {
    setSelectedSearchIds((prev) =>
      prev.includes(id) ? prev.filter((it) => it !== id) : [...prev, id]
    );
  };

  // Selecionar todos os novos ou todos os itens da busca
  const handleSelectAllSearchResults = (onlyNew = true) => {
    if (onlyNew) {
      const newIds = liveSearchResults.filter((ev) => !ev.alreadyImported).map((ev) => ev.id);
      setSelectedSearchIds(newIds);
    } else {
      setSelectedSearchIds(liveSearchResults.map((ev) => ev.id));
    }
  };

  const handleClearSearchSelection = () => {
    setSelectedSearchIds([]);
  };

  // Importar os selecionados da busca para a quarentena
  const handleImportSelectedSearchResults = async () => {
    if (selectedSearchIds.length === 0) {
      showToast('Selecione pelo menos um evento da busca para importar.', 'info');
      return;
    }

    const itemsToImport = liveSearchResults.filter((ev) =>
      selectedSearchIds.includes(ev.id)
    );

    setIsImportingSearchBatch(true);
    try {
      const res = await fetch('/api/sympla/import-live-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: itemsToImport,
          defaultCategory: searchTargetCategory !== 'auto' ? searchTargetCategory : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message, 'success');
        await fetchQuarantine();

        // Marca localmente como quarentena
        const importedIdSet = new Set(selectedSearchIds);
        setLiveSearchResults((prev) =>
          prev.map((it) =>
            importedIdSet.has(it.id)
              ? { ...it, alreadyImported: true, statusInDb: 'quarentena' }
              : it
          )
        );
        setSelectedSearchIds([]);
      } else {
        throw new Error(data.error || 'Erro ao importar lote');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao importar eventos', 'error');
    } finally {
      setIsImportingSearchBatch(false);
    }
  };

  // Importar TODOS os eventos encontrados na busca ao vivo da Sympla (sem limite de 20 por página)
  const handleImportAllFoundEvents = async () => {
    const totalToFetch = liveSearchTotal || liveSearchResults.length;
    if (!totalToFetch || totalToFetch === 0) {
      showToast('Nenhum evento encontrado para importar.', 'info');
      return;
    }

    setIsImportingAllQuery(true);
    try {
      const res = await fetch('/api/sympla/import-all-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: liveSearchQuery.trim() || undefined,
          city: liveSearchCity && liveSearchCity !== 'Todas' && liveSearchCity !== 'Todos' ? liveSearchCity : undefined,
          state: liveSearchState && liveSearchState !== 'Todas' && liveSearchState !== 'Todos' ? liveSearchState : undefined,
          defaultCategory: searchTargetCategory !== 'auto' ? searchTargetCategory : undefined,
          maxEvents: Math.min(Math.max(totalToFetch, 100), 1000),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message, 'success');
        await fetchQuarantine();
        window.dispatchEvent(new CustomEvent('praonde:quarantine-updated'));
        // Atualiza a busca ao vivo na tela
        handleLiveSearch(0, false);
      } else {
        // Fallback: se a varredura completa externa da Sympla tiver erro, importa os itens já exibidos na busca
        if (liveSearchResults.length > 0) {
          const batchRes = await fetch('/api/sympla/import-live-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              events: liveSearchResults,
              defaultCategory: searchTargetCategory !== 'auto' ? searchTargetCategory : undefined,
            }),
          });
          const batchData = await batchRes.json();
          if (batchRes.ok && batchData.success) {
            showToast(batchData.message, 'success');
            await fetchQuarantine();
            window.dispatchEvent(new CustomEvent('praonde:quarantine-updated'));
            handleLiveSearch(0, false);
            return;
          }
        }
        throw new Error(data.error || 'Erro ao importar todos os eventos da busca');
      }
    } catch (err: any) {
      // Se der erro ou timeout, tenta importar o lote que já está exibido na tela
      if (liveSearchResults.length > 0) {
        try {
          const batchRes = await fetch('/api/sympla/import-live-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              events: liveSearchResults,
              defaultCategory: searchTargetCategory !== 'auto' ? searchTargetCategory : undefined,
            }),
          });
          const batchData = await batchRes.json();
          if (batchRes.ok && batchData.success) {
            showToast(batchData.message, 'success');
            await fetchQuarantine();
            window.dispatchEvent(new CustomEvent('praonde:quarantine-updated'));
            handleLiveSearch(0, false);
            return;
          }
        } catch {}
      }
      showToast(err.message || 'Erro ao importar todos os eventos', 'error');
    } finally {
      setIsImportingAllQuery(false);
    }
  };

  // Executar Sincronização e Integração Relacional entre Tabelas (Eventos ↔ Categorias, Estados, Anunciantes)
  const handleSyncDatabaseRelations = async () => {
    setIsSyncingRelations(true);
    try {
      const res = await fetch('/api/database/sync-relations', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncResultStats(data);
        showToast(data.message, 'success');
      } else {
        throw new Error(data.error || 'Falha ao sincronizar relações');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao sincronizar tabelas', 'error');
    } finally {
      setIsSyncingRelations(false);
    }
  };

  // Atalho rápido de busca por pílula (preserva o estado e cidade informados)
  const handleQuickSearchPill = (query: string, targetCat?: string) => {
    setLiveSearchQuery(query);
    if (targetCat) setSearchTargetCategory(targetCat);
    handleLiveSearch(0, false, query, liveSearchState, liveSearchCity);
  };

  // Selecionar estado de busca rapidamente e disparar pesquisa imediata
  const handleQuickSelectState = (stateUf: string) => {
    setLiveSearchState(stateUf);
    setLiveSearchCity('Todas');
    handleLiveSearch(0, false, liveSearchQuery, stateUf, 'Todas');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header com Navegação e Explicação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={onBackToMenu}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              ← Voltar ao Menu
            </button>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-black border border-amber-500/40 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Quarentena Independente
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>📥 Importador & Curadoria Sympla</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
            Importe dados de eventos diretamente da Sympla para a tabela de <strong className="text-amber-300">Quarentena</strong>.
            Você analisa, ajusta as informações e só libera no app quando quiser. Totalmente independente do banco da Sympla!
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleSyncDatabaseRelations}
            disabled={isSyncingRelations}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 hover:border-sky-500/60 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Sincronizar e integrar chaves relacionais entre eventos, categorias, estados e anunciantes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingRelations ? 'animate-spin text-sky-400' : ''}`} />
            <span>{isSyncingRelations ? 'Integrando Tabelas...' : 'Integrar Tabelas SQLite'}</span>
          </button>
          
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('secao-quarentena');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Rolar para a tabela da quarentena abaixo"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Ver Quarentena ({quarantineEvents.length}) ↓</span>
          </button>

          <div className="px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-center">
            <span className="text-[10px] text-slate-400 block font-semibold leading-tight">Na Quarentena</span>
            <span className="text-base font-black text-amber-400 leading-none">{quarantineEvents.length}</span>
          </div>

          <button
            onClick={fetchQuarantine}
            disabled={isLoadingQuarantine}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title="Recarregar dados da quarentena"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingQuarantine ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          {/* BOTÃO LIMPAR QUARENTENA EM DESTAQUE NO TOPO */}
          <button
            id="btn-topo-limpar-quarentena"
            onClick={handleClearAllQuarantine}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white border border-rose-500 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-900/30"
            title="Apagar e esvaziar todos os registros que estão na quarentena imediatamente"
          >
            <Trash2 className="w-4 h-4" />
            <span>Limpar Quarentena</span>
          </button>
        </div>
      </div>

      {/* Alerta de Feedback Global */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-semibold animate-in slide-in-from-top-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : statusMessage.type === 'info'
              ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          ) : statusMessage.type === 'info' ? (
            <ShieldCheck className="w-5 h-5 shrink-0 text-sky-400" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Painel de Resultados da Integração Relacional */}
      {syncResultStats && (
        <div className="p-4 rounded-xl border border-sky-500/40 bg-sky-950/30 text-sky-200 animate-in slide-in-from-top-2 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-sky-400" />
              <span className="font-bold text-sm text-white">Integração Relacional das Tabelas Concluída</span>
            </div>
            <button
              onClick={() => setSyncResultStats(null)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-md bg-slate-800 cursor-pointer"
            >
              ✕ Fechar
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-xs">
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-slate-400 block text-[11px]">Eventos no Banco</span>
              <span className="text-base font-black text-white">{syncResultStats.totalEvents}</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-slate-400 block text-[11px]">Categorias Ligadas</span>
              <span className="text-base font-black text-amber-400">{syncResultStats.syncedCategories}</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-slate-400 block text-[11px]">Estados Ligados</span>
              <span className="text-base font-black text-emerald-400">{syncResultStats.syncedEstados}</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-slate-400 block text-[11px]">Anunciantes Ligados</span>
              <span className="text-base font-black text-sky-400">{syncResultStats.syncedAdvertisers}</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-slate-400 block text-[11px]">Quarentena Integrada</span>
              <span className="text-base font-black text-purple-400">{syncResultStats.importedSynced}</span>
            </div>
          </div>
        </div>
      )}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 rounded-2xl p-5 sm:p-6 border border-amber-500/50 shadow-2xl shadow-amber-950/20 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black border border-amber-500/40">
              <Sparkles className="w-3.5 h-3.5" /> Robô de Varredura Sympla em Tempo Real
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <span>Catálogo Completo da Sympla (Centenas de Eventos)</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Consulte diretamente os eventos ao vivo da Sympla em tempo real. Digite qualquer ritmo musical, selecione a cidade ou estado, e importe dezenas ou centenas de eventos para a Quarentena com 1 clique.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
            <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-semibold text-slate-200">Algolia Live Engine Ativo</span>
            </div>
          </div>
        </div>

        {/* Formulário de Busca */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            {/* Termo de Busca */}
            <div className="sm:col-span-12 md:col-span-4 relative">
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Termo, Ritmo Musical ou Artista:
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={liveSearchQuery}
                  onChange={(e) => setLiveSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleLiveSearch(0, false);
                  }}
                  placeholder="Ex: samba, pagode, forró, flashback, baile, bolero..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Estado / UF Informado */}
            <div className="sm:col-span-6 md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-400 mb-1 flex items-center justify-between">
                <span>Estado Informado (UF):</span>
                {liveSearchState !== 'Todos' && (
                  <span className="text-[10px] text-amber-400 font-extrabold uppercase">Ativo</span>
                )}
              </label>
              <select
                value={liveSearchState}
                onChange={(e) => {
                  const newState = e.target.value;
                  setLiveSearchState(newState);
                  setLiveSearchCity('Todas');
                }}
                className={`w-full px-3 py-2.5 rounded-xl bg-slate-950 border text-sm focus:outline-none focus:border-amber-500 cursor-pointer font-medium ${
                  liveSearchState !== 'Todos'
                    ? 'border-amber-500 text-amber-300 font-bold'
                    : 'border-slate-700 text-white'
                }`}
              >
                {BRAZILIAN_STATES.map((st) => (
                  <option key={st.uf} value={st.uf}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Cidade */}
            <div className="sm:col-span-6 md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Cidade (Opcional):
              </label>
              <select
                value={liveSearchCity}
                onChange={(e) => setLiveSearchCity(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="Todas">
                  {liveSearchState === 'Todos'
                    ? 'Todas as Cidades (Brasil)'
                    : `Todas as Cidades de ${liveSearchState}`}
                </option>
                {liveSearchState !== 'Todos' && TOP_CITIES_BY_STATE[liveSearchState] ? (
                  TOP_CITIES_BY_STATE[liveSearchState].map((ct) => (
                    <option key={ct} value={ct}>
                      {ct} ({liveSearchState})
                    </option>
                  ))
                ) : (
                  <>
                    <option value="São Paulo">São Paulo (SP)</option>
                    <option value="Rio de Janeiro">Rio de Janeiro (RJ)</option>
                    <option value="Belo Horizonte">Belo Horizonte (MG)</option>
                    <option value="Campinas">Campinas (SP)</option>
                    <option value="Salvador">Salvador (BA)</option>
                    <option value="Curitiba">Curitiba (PR)</option>
                    <option value="Porto Alegre">Porto Alegre (RS)</option>
                    <option value="Brasília">Brasília (DF)</option>
                    <option value="Recife">Recife (PE)</option>
                    <option value="Fortaleza">Fortaleza (CE)</option>
                    <option value="Goiânia">Goiânia (GO)</option>
                    <option value="Florianópolis">Florianópolis (SC)</option>
                  </>
                )}
              </select>
            </div>

            {/* Botão de Busca informando explicitamente o Estado */}
            <div className="sm:col-span-12 md:col-span-2 flex items-end">
              <button
                id="btn-sympla-live-search"
                onClick={() => handleLiveSearch(0, false)}
                disabled={isSearchingLive}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                title={`Buscar eventos da Sympla ${liveSearchState !== 'Todos' ? `no estado ${liveSearchState}` : 'em todo o Brasil'}`}
              >
                {isSearchingLive ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950 shrink-0" />
                    <span className="truncate">Varrendo...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 text-slate-950 shrink-0" />
                    <div className="flex flex-col text-left leading-tight truncate">
                      <span className="text-[12px] font-black truncate">
                        {liveSearchState === 'Todos' ? 'Buscar Brasil' : `Buscar em ${liveSearchState}`}
                      </span>
                      <span className="text-[9px] font-bold text-slate-900/80 truncate">
                        {liveSearchCity !== 'Todas'
                          ? liveSearchCity
                          : liveSearchState === 'Todos'
                          ? 'Todo o país'
                          : 'Todo estado'}
                      </span>
                    </div>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Atalhos Rápidos por Estado Informado */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/60">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
              Filtrar por Estado:
            </span>
            {[
              { uf: 'Todos', label: '🇧🇷 Brasil Todo' },
              { uf: 'SP', label: 'SP' },
              { uf: 'RJ', label: 'RJ' },
              { uf: 'MG', label: 'MG' },
              { uf: 'BA', label: 'BA' },
              { uf: 'PR', label: 'PR' },
              { uf: 'RS', label: 'RS' },
              { uf: 'DF', label: 'DF' },
              { uf: 'SC', label: 'SC' },
              { uf: 'PE', label: 'PE' },
              { uf: 'CE', label: 'CE' },
              { uf: 'GO', label: 'GO' },
              { uf: 'ES', label: 'ES' },
            ].map((st) => {
              const isActive = liveSearchState === st.uf;
              return (
                <button
                  key={st.uf}
                  type="button"
                  onClick={() => handleQuickSelectState(st.uf)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                      : 'bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300'
                  }`}
                  title={`Filtrar busca por ${st.label}`}
                >
                  <span>{st.label}</span>
                </button>
              );
            })}
          </div>

          {/* Atalhos Rápidos por Ritmo (respeitando o estado selecionado) */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-400 mr-1">
              Atalhos de Ritmo {liveSearchState !== 'Todos' ? `(em ${liveSearchState})` : ''}:
            </span>
            <button
              type="button"
              onClick={() => handleQuickSearchPill('samba pagode', 'Samba e Pagode')}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-medium transition cursor-pointer"
            >
              🥁 Samba & Pagode
            </button>
            <button
              type="button"
              onClick={() => handleQuickSearchPill('flashback anos 80 nostalgia', 'Baile Nostalgia')}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-medium transition cursor-pointer"
            >
              💃 Flashback Nostalgia
            </button>
            <button
              type="button"
              onClick={() => handleQuickSearchPill('forro pe de serra', 'Forró Pé de Serra')}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-medium transition cursor-pointer"
            >
              🌵 Forró Pé de Serra
            </button>
            <button
              type="button"
              onClick={() => handleQuickSearchPill('danca de salao baile', 'Bailes')}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-medium transition cursor-pointer"
            >
              🕺 Bailes & Salão
            </button>
            <button
              type="button"
              onClick={() => handleQuickSearchPill('terceira idade melhor idade', 'Baile Terceira Idade')}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-medium transition cursor-pointer"
            >
              👵 Terceira Idade
            </button>
            <button
              type="button"
              onClick={() => handleQuickSearchPill('shows musicais ao vivo', 'Shows')}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-medium transition cursor-pointer"
            >
              🎸 Shows Ao Vivo
            </button>
          </div>
        </div>

        {/* ÁREA DE RESULTADOS DA BUSCA AO VIVO */}
        {hasSearchedOnce && (
          <div className="pt-4 border-t border-slate-800 space-y-4">
            {/* Barra de Ações e Contagem */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-amber-300">
                    {liveSearchTotal !== null ? liveSearchTotal.toLocaleString('pt-BR') : liveSearchResults.length} eventos encontrados
                  </span>
                  <span className="text-xs text-slate-400">
                    ({liveSearchResults.length} exibidos nesta visualização)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <button
                    type="button"
                    onClick={() => handleSelectAllSearchResults(true)}
                    className="hover:text-amber-300 underline font-semibold cursor-pointer"
                  >
                    Selecionar Inéditos ({liveSearchResults.filter((e) => !e.alreadyImported).length})
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => handleSelectAllSearchResults(false)}
                    className="hover:text-amber-300 underline font-semibold cursor-pointer"
                  >
                    Selecionar Todos ({liveSearchResults.length})
                  </button>
                  {selectedSearchIds.length > 0 && (
                    <>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={handleClearSearchSelection}
                        className="hover:text-rose-400 underline font-semibold cursor-pointer"
                      >
                        Desmarcar Todos
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Botão de Importação dos Selecionados */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-bold whitespace-nowrap">Categoria destino:</span>
                  <select
                    value={searchTargetCategory}
                    onChange={(e) => setSearchTargetCategory(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="auto">Detectar Automático</option>
                    {TARGET_RHYTHMS.map((r) => (
                      <option key={r.name} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Botão de Importar TODOS os encontrados na busca da Sympla */}
                {((liveSearchTotal !== null && liveSearchTotal > 0) || liveSearchResults.length > 0) && (
                  <button
                    id="btn-sympla-importar-todos-quarentena"
                    type="button"
                    onClick={handleImportAllFoundEvents}
                    disabled={isImportingAllQuery || isImportingSearchBatch}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 disabled:opacity-40 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/25 transition-all cursor-pointer whitespace-nowrap"
                    title={`Importar todos os ${(liveSearchTotal || liveSearchResults.length)} eventos encontrados na Sympla de uma só vez para a Quarentena`}
                  >
                    {isImportingAllQuery ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                        <span>Importando Todos ({(liveSearchTotal || liveSearchResults.length)})...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                        <span>
                          Importar TODOS os {(liveSearchTotal || liveSearchResults.length)} para Quarentena{liveSearchState !== 'Todos' ? ` (${liveSearchState})` : ''}
                        </span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleImportSelectedSearchResults}
                  disabled={isImportingSearchBatch || isImportingAllQuery || selectedSearchIds.length === 0}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer whitespace-nowrap"
                >
                  {isImportingSearchBatch ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                      <span>Importando para Quarentena...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 text-slate-950" />
                      <span>
                        Importar {selectedSearchIds.length} Selecionado{selectedSearchIds.length !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Lista dos Eventos Encontrados */}
            {liveSearchResults.length === 0 && !isSearchingLive ? (
              <div className="text-center py-8 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 text-xs">
                Nenhum evento encontrado para este filtro na Sympla. Tente buscar por outros termos como &quot;samba&quot;, &quot;forro&quot; ou selecione &quot;Todos os Estados&quot;.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[560px] overflow-y-auto pr-1">
                {liveSearchResults.map((event) => {
                  const isSelected = selectedSearchIds.includes(event.id);
                  const isAlreadyInDb = event.alreadyImported;

                  return (
                    <div
                      key={event.id}
                      onClick={() => handleToggleSelectSearchItem(event.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex gap-3 ${
                        isSelected
                          ? 'bg-amber-950/20 border-amber-500/60 shadow-md shadow-amber-950/20'
                          : isAlreadyInDb
                          ? 'bg-slate-950/60 border-slate-800/80 opacity-75 hover:opacity-100'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Checkbox de Seleção */}
                      <div className="pt-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelectSearchItem(event.id);
                          }}
                          className="text-slate-400 hover:text-amber-400"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-amber-400" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-600" />
                          )}
                        </button>
                      </div>

                      {/* Imagem do Evento */}
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-slate-900 shrink-0 relative border border-slate-800">
                        <img
                          src={event.imageUrl}
                          alt={event.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>

                      {/* Dados do Evento */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {event.rhythm || 'Shows'}
                          </span>

                          <span className="ml-auto text-[11px] font-black text-amber-400">
                            {event.isGratuito ? 'Gratuito' : event.price ? `R$ ${event.price.toFixed(2)}` : 'Consulte'}
                          </span>
                        </div>

                        <h5 className="font-bold text-white text-xs sm:text-sm line-clamp-1 leading-snug" title={event.title}>
                          {event.title}
                        </h5>

                        <div className="text-[11px] text-slate-400 space-y-0.5">
                          <div className="flex items-center gap-1.5 line-clamp-1">
                            <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>{event.date} às {event.time}</span>
                          </div>

                          <div className="flex items-center gap-1.5 line-clamp-1">
                            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>
                              {event.locationName} • {event.city}/{event.state}
                            </span>
                          </div>
                        </div>

                        <div className="pt-1 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 truncate max-w-[150px]">
                            {event.organizer || 'Sympla Eventos'}
                          </span>
                          <a
                            href={event.ticketUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
                          >
                            <span>Ver na Sympla</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Paginação / Carregar Mais */}
            {liveSearchPages > 1 && (
              <div className="flex items-center justify-center pt-2">
                <button
                  type="button"
                  onClick={() => handleLiveSearch(liveSearchPage + 1, true)}
                  disabled={isLoadingMoreSearch || liveSearchPage + 1 >= liveSearchPages}
                  className="px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {isLoadingMoreSearch ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Carregando Mais Eventos...</span>
                    </>
                  ) : liveSearchPage + 1 < liveSearchPages ? (
                    <>
                      <RefreshCw className="w-4 h-4 text-amber-400" />
                      <span>Carregar Mais 20 Eventos da Sympla (Página {liveSearchPage + 2} de {liveSearchPages})</span>
                    </>
                  ) : (
                    <span>Todos os eventos da Sympla foram carregados</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SEÇÃO DESTAQUE: IMPORTAÇÃO MULTI-RITMO DE UMA SÓ VEZ */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 rounded-2xl p-5 sm:p-6 border border-amber-500/40 shadow-xl shadow-amber-950/20 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black border border-amber-500/40">
              <Sparkles className="w-3.5 h-3.5" /> Trazer Tudo de Uma Vez
            </div>
            <h4 className="text-lg sm:text-xl font-black text-white">
              Importação Rápida dos 7 Ritmos para a Quarentena
            </h4>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Carregue eventos da Sympla de todos os ritmos de uma só vez: <strong className="text-amber-300">Baile Nostalgia</strong>, <strong className="text-amber-300">Samba e Pagode</strong>, <strong className="text-amber-300">Baile Terceira Idade</strong>, <strong className="text-amber-300">Forró</strong>, <strong className="text-amber-300">Forró Pé de Serra</strong>, <strong className="text-amber-300">Bailes</strong> e <strong className="text-amber-300">Shows</strong>.
              Depois, você seleciona o item na tabela e define ou altera a categoria antes de liberar no app!
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Filtro Anti-Duplicidade Ativo: eventos já trazidos, aprovados ou descartados são ignorados automaticamente para vir apenas eventos inéditos.</span>
            </div>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
            <div className="flex flex-col">
              <label className="text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-amber-400" />
                <span>Estado Alvo:</span>
              </label>
              <select
                value={batchRhythmState}
                onChange={(e) => setBatchRhythmState(e.target.value)}
                className={`px-3 py-3 rounded-xl bg-slate-950 border text-xs font-bold focus:outline-none focus:border-amber-400 cursor-pointer ${
                  batchRhythmState !== 'Todos'
                    ? 'border-amber-500 text-amber-300'
                    : 'border-slate-700 text-slate-200'
                }`}
              >
                {BRAZILIAN_STATES.map((st) => (
                  <option key={st.uf} value={st.uf}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleDiscoverAllRhythms}
              disabled={isDiscoveringAll}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer whitespace-nowrap"
            >
              {isDiscoveringAll ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-slate-950" />
                  <span>Buscando e Carregando Ritmos...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>
                    {batchRhythmState === 'Todos'
                      ? 'Trazer Todos os 7 Ritmos Agora'
                      : `Trazer 7 Ritmos de ${batchRhythmState} Agora`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Visualização dos 7 Ritmos com Contadores */}
        <div className="pt-3 border-t border-slate-800/80">
          <span className="text-[11px] font-bold text-slate-400 block mb-2">
            Ritmos incluídos na importação rápida:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            {TARGET_RHYTHMS.map((r) => (
              <div
                key={r.name}
                className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-base">{r.icon}</span>
                  <span className="text-xs font-bold text-white truncate" title={r.name}>
                    {r.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="truncate text-slate-500">{r.badge}</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                    {rhythmCounts[r.name] || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SEÇÃO 1: EXTRATOR DA SYMPLA POR URL */}
      <div className="bg-slate-900/90 rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-bold text-white flex items-center gap-2">
            <Link2 className="w-5 h-5 text-amber-400" />
            <span>1. Puxar Dados da Sympla pelo Link</span>
          </h4>
          <button
            onClick={() => setIsBatchMode(!isBatchMode)}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer"
          >
            {isBatchMode ? 'Modo URL Única' : 'Modo em Lote (Vários Links)'}
          </button>
        </div>

        {/* Banner Didático de Como Funciona */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-1.5">
          <p className="font-bold text-amber-300 flex items-center gap-1.5">
            <span>💡 Como funciona a importação:</span>
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
            <li>
              Cada link inserido aqui corresponde a <strong>1 evento específico</strong> da Sympla/Bileto.
            </li>
            <li>
              Ao clicar em <strong>&quot;Buscar Dados&quot;</strong>, o sistema lê os dados daquele show/baile (título, data, local, fotos e ingressos).
            </li>
            <li>
              O campo de <strong>Categoria (Samba e Pagode, Bailes, Forró, Shows)</strong> serve para você <strong>definir em qual ritmo aquele evento entrará no seu aplicativo</strong>.
            </li>
            <li>
              Para trazer <strong>múltiplos eventos de uma vez</strong>, clique em <button type="button" onClick={() => setIsBatchMode(true)} className="text-indigo-400 underline font-semibold cursor-pointer">&quot;Modo em Lote (Vários Links)&quot;</button> e cole uma lista de links!
            </li>
          </ul>
        </div>

        {!isBatchMode ? (
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Cole o link do evento da Sympla (ex: https://www.sympla.com.br/evento/...):
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <input
                  type="url"
                  value={symplaUrl}
                  onChange={(e) => setSymplaUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleParseUrl();
                  }}
                  placeholder="https://www.sympla.com.br/evento/..."
                  className="w-full pl-4 pr-10 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
                />
                {symplaUrl && (
                  <button
                    onClick={() => setSymplaUrl('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => handleParseUrl()}
                disabled={isLoadingUrl || !symplaUrl.trim()}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer whitespace-nowrap"
              >
                {isLoadingUrl ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Buscando Dados...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Buscar Dados do Evento</span>
                  </>
                )}
              </button>
            </div>
            {/* Atalhos rápidos para testar */}
            <div className="flex flex-wrap items-center gap-2 mt-2.5 text-xs text-slate-400">
              <span className="text-slate-500">Exemplos rápidos para teste:</span>
              <button
                type="button"
                onClick={() => {
                  const url = 'https://www.sympla.com.br/evento/feijoada-com-samba-e-pagode-raiz-sp/2456789';
                  setSymplaUrl(url);
                  handleParseUrl(url);
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                🥁 Samba & Pagode SP
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = 'https://www.sympla.com.br/evento/baile-nostalgia-flashback-night/2456790';
                  setSymplaUrl(url);
                  handleParseUrl(url);
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                🕺 Baile Nostalgia
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = 'https://www.sympla.com.br/evento/grande-forro-pe-de-serra-tradicional/2456791';
                  setSymplaUrl(url);
                  handleParseUrl(url);
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                🪗 Forró Pé de Serra
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Cole uma URL da Sympla por linha para importação em lote:
            </label>
            <textarea
              rows={4}
              value={batchUrls}
              onChange={(e) => setBatchUrls(e.target.value)}
              placeholder={`https://www.sympla.com.br/evento/evento-1\nhttps://www.sympla.com.br/evento/evento-2\nhttps://www.sympla.com.br/evento/evento-3`}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-amber-500"
            />
            {batchProgress && (
              <p className="text-xs text-amber-400 font-semibold animate-pulse">{batchProgress}</p>
            )}
            <button
              onClick={handleBatchImport}
              disabled={isLoadingUrl || !batchUrls.trim()}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow"
            >
              {isLoadingUrl ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>Importar Todos na Quarentena</span>
            </button>
          </div>
        )}

        {parseError && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}
      </div>

      {/* CARD DE PRÉVIA DO EVENTO EXTRAÍDO */}
      {previewEvent && (
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl p-5 sm:p-6 border-2 border-amber-500/50 shadow-2xl space-y-5 animate-in slide-in-from-top-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-black border border-emerald-500/40 inline-flex items-center gap-1 mb-1">
                <Sparkles className="w-3.5 h-3.5" /> Dados Identificados na Sympla
              </span>
              <h4 className="text-lg font-black text-white">Revisão Rápida dos Dados</h4>
            </div>
            <button
              onClick={() => setPreviewEvent(null)}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 self-start sm:self-auto"
            >
              <X className="w-4 h-4" /> Cancelar Prévia
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Banner e Visual */}
            <div className="space-y-3">
              <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner">
                {previewEvent.imageUrl ? (
                  <img
                    src={previewEvent.imageUrl}
                    alt={previewEvent.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                    Sem Imagem de Capa
                  </div>
                )}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur-md text-[10px] font-black text-amber-300 border border-amber-500/30">
                  {previewEvent.category}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">URL da Imagem de Capa</label>
                <input
                  type="text"
                  value={previewEvent.imageUrl || ''}
                  onChange={(e) => setPreviewEvent({ ...previewEvent, imageUrl: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                />
              </div>

              {previewEvent.urlOrigem && (
                <a
                  href={previewEvent.urlOrigem}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-amber-400 hover:underline font-bold"
                >
                  <span>Abrir página original na Sympla</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {/* Campos de Edição dos Dados Extraídos */}
            <div className="md:col-span-2 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Título do Evento *</label>
                <input
                  type="text"
                  value={previewEvent.title || ''}
                  onChange={(e) => setPreviewEvent({ ...previewEvent, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Categoria no App *</label>
                  <select
                    value={previewEvent.category || 'Categoria'}
                    onChange={(e) => setPreviewEvent({ ...previewEvent, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Data do Evento *</label>
                  <input
                    type="date"
                    value={previewEvent.date || ''}
                    onChange={(e) => setPreviewEvent({ ...previewEvent, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Horário de Início *</label>
                  <input
                    type="time"
                    value={previewEvent.time || '20:00'}
                    onChange={(e) => setPreviewEvent({ ...previewEvent, time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">Nome do Local *</label>
                  <input
                    type="text"
                    value={previewEvent.locationName || ''}
                    onChange={(e) => setPreviewEvent({ ...previewEvent, locationName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Organizador</label>
                  <input
                    type="text"
                    value={previewEvent.organizer || ''}
                    onChange={(e) => setPreviewEvent({ ...previewEvent, organizer: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Endereço Completo</label>
                  <input
                    type="text"
                    value={previewEvent.address || ''}
                    onChange={(e) => setPreviewEvent({ ...previewEvent, address: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Cidade</label>
                  <input
                    type="text"
                    value={previewEvent.city || 'São Paulo'}
                    onChange={(e) => setPreviewEvent({ ...previewEvent, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Estado (UF)</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={previewEvent.state || 'SP'}
                    onChange={(e) => setPreviewEvent({ ...previewEvent, state: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold uppercase focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Link de Ingressos (Sympla)</label>
                <input
                  type="text"
                  value={previewEvent.ticketUrl || ''}
                  onChange={(e) => setPreviewEvent({ ...previewEvent, ticketUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Botões de Ação para a Prévia */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleSaveToQuarantine}
                  className="w-full sm:flex-1 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>📥 Salvar na Quarentena (Revisar Depois)</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAndApproveNow}
                  className="w-full sm:flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>🚀 Salvar e Liberar no App Imediatamente</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEÇÃO 2: TABELA / CARDS DA QUARENTENA */}
      <div id="secao-quarentena" className="bg-slate-900/90 rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-xl space-y-4 scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h4 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <span>Tabela de Quarentena de Eventos Importados</span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                {quarantineEvents.length} no banco
              </span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Estes eventos estão armazenados no seu banco independente e não aparecem aos usuários até você clicar em <strong>&quot;Liberar no App&quot;</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {filteredQuarantine.length > 0 && (
              <button
                onClick={handleToggleSelectAll}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {filteredQuarantine.every((it) => selectedItemIds.includes(it.id))
                    ? 'Desmarcar Todos'
                    : `Selecionar Filtrados (${filteredQuarantine.length})`}
                </span>
              </button>
            )}

            {quarantineEvents.length > 0 && (
              <button
                id="btn-quarentena-liberar-todos"
                onClick={handleApproveAll}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md transition-all cursor-pointer shrink-0"
                title="Confirmar liberação de todos os eventos no app e excluir da quarentena"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Liberar Todos os Eventos ({quarantineEvents.length})</span>
              </button>
            )}

            <button
              id="btn-quarentena-limpar-todos"
              onClick={handleClearAllQuarantine}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer shrink-0 ${
                quarantineEvents.length > 0
                  ? 'bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border-rose-500/40 hover:border-rose-500 shadow-md'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title="Apagar e esvaziar todos os registros da quarentena imediatamente sem publicar no app"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Limpar Quarentena</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros por Ritmo */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold flex items-center gap-1.5 text-slate-300">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <span>Filtrar por Ritmo na Quarentena:</span>
            </span>
            {selectedRhythmFilter !== 'Todos' && (
              <button
                onClick={() => setSelectedRhythmFilter('Todos')}
                className="text-amber-400 hover:underline text-[11px] font-semibold cursor-pointer"
              >
                Mostrar todos os ritmos
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setSelectedRhythmFilter('Todos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                selectedRhythmFilter === 'Todos'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span>Todos os Ritmos</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  selectedRhythmFilter === 'Todos' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {quarantineEvents.length}
              </span>
            </button>

            {TARGET_RHYTHMS.map((r) => {
              const count = rhythmCounts[r.name] || 0;
              const isSelected = selectedRhythmFilter === r.name;
              return (
                <button
                  key={r.name}
                  onClick={() => setSelectedRhythmFilter(r.name)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <span>{r.icon}</span>
                  <span>{r.name}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* BARRA DE AÇÕES EM LOTE PARA ITENS SELECIONADOS */}
        {selectedItemIds.length > 0 && (
          <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/10 border-2 border-amber-500/50 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                <CheckSquare className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <span className="text-sm font-black text-white block">
                  {selectedItemIds.length} {selectedItemIds.length === 1 ? 'evento selecionado' : 'eventos selecionados'}
                </span>
                <span className="text-[11px] text-amber-300">
                  Defina a categoria ou libere todos no app de uma vez só:
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Dropdown de Categoria em Lote */}
              <div className="flex items-center gap-1.5 bg-slate-950/90 border border-slate-700 rounded-xl px-2.5 py-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <select
                  value={batchTargetCategory}
                  onChange={(e) => setBatchTargetCategory(e.target.value)}
                  className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
                >
                  {TARGET_RHYTHMS.map((r) => (
                    <option key={r.name} value={r.name} className="bg-slate-900 text-white">
                      {r.icon} {r.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBatchChangeCategory}
                  disabled={isProcessingBatch}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-colors cursor-pointer"
                >
                  Aplicar aos Selecionados
                </button>
              </div>

              {/* Liberar Selecionados */}
              <button
                onClick={handleBatchApprove}
                disabled={isProcessingBatch}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow transition-colors cursor-pointer"
                title="Confirmar liberação dos registros selecionados: inclui na tabela de eventos e apaga da quarentena"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar Liberação ({selectedItemIds.length})</span>
              </button>

              {/* Descartar Selecionados */}
              <button
                onClick={handleBatchDelete}
                disabled={isProcessingBatch}
                className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors cursor-pointer"
                title="Descartar selecionados da quarentena"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Desmarcar */}
              <button
                onClick={() => setSelectedItemIds([])}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition-colors cursor-pointer"
                title="Limpar seleção"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Barra de Busca na Quarentena */}
        {quarantineEvents.length > 0 && (
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={quarantineSearch}
              onChange={(e) => setQuarantineSearch(e.target.value)}
              placeholder="Filtrar por nome, ritmo, cidade ou local na quarentena..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
        )}

        {/* Lista de Itens na Quarentena */}
        {isLoadingQuarantine ? (
          <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
            <span>Carregando eventos em quarentena...</span>
          </div>
        ) : filteredQuarantine.length === 0 ? (
          <div className="py-12 text-center rounded-xl bg-slate-950/50 border border-dashed border-slate-800">
            <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-300">
              {quarantineEvents.length === 0
                ? 'Nenhum evento aguardando na Quarentena'
                : `Nenhum evento encontrado para o filtro "${selectedRhythmFilter}"`}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {quarantineEvents.length === 0
                ? 'Clique no botão acima "Trazer Todos os 7 Ritmos Agora" para preencher a quarentena automaticamente!'
                : 'Tente escolher outro ritmo ou limpar a busca de texto.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredQuarantine.map((item) => {
              const isSelected = selectedItemIds.includes(item.id);

              return (
                <div
                  key={item.id}
                  className={`group relative bg-gradient-to-b from-slate-950 to-slate-900 border rounded-2xl p-4 shadow-lg transition-all duration-200 flex flex-col justify-between ${
                    isSelected
                      ? 'border-amber-500 ring-2 ring-amber-500/20'
                      : 'border-slate-800 hover:border-amber-500/50'
                  }`}
                >
                  <div>
                    {/* Linha Superior: Checkbox de Seleção & Tag de Status */}
                    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => handleToggleSelectItem(item.id)}
                        className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer select-none"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                        )}
                        <span className={isSelected ? 'text-amber-300' : 'text-slate-400'}>
                          {isSelected ? 'Selecionado' : 'Selecionar item'}
                        </span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                          {item.city}/{item.state}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-3 mb-2">
                      {/* Imagem Miniatura */}
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-800">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=200&q=80';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600 text-[10px]">
                            Sem Foto
                          </div>
                        )}
                      </div>

                      {/* Informações Principais */}
                      <div className="flex-1 min-w-0">
                        <h5
                          className="text-sm font-bold text-white truncate group-hover:text-amber-300 transition-colors"
                          title={item.title}
                        >
                          {item.title}
                        </h5>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-amber-400" />
                            {item.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            {item.time}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5" title={item.locationName}>
                          <MapPin className="w-3 h-3 inline mr-1 text-slate-500" />
                          {item.locationName}
                        </p>
                      </div>
                    </div>

                    {/* SELETOR DIRETO DE CATEGORIA NO PRÓPRIO CARD (SEM PRECISAR DE MODAL) */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 my-2">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <label className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5 text-amber-400" />
                          <span>Colocar Categoria / Ritmo:</span>
                        </label>
                        <span className="text-[10px] text-slate-500">Altera na hora</span>
                      </div>
                      <select
                        value={item.category}
                        onChange={(e) => handleQuickChangeCategory(item.id, e.target.value)}
                        className="w-full bg-slate-900 text-white font-bold text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 cursor-pointer hover:border-amber-500/50 transition-colors"
                      >
                        {TARGET_RHYTHMS.map((r) => (
                          <option key={r.name} value={r.name}>
                            {r.icon} {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {item.ticketUrl && (
                      <div className="mb-2 pt-1 border-t border-slate-900 flex items-center justify-between text-[11px]">
                        <a
                          href={item.ticketUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-400 hover:underline flex items-center gap-1 font-semibold truncate max-w-[240px]"
                        >
                          <Ticket className="w-3 h-3 shrink-0" />
                          <span>Ver Ingressos Sympla</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                        <span className="text-slate-500 font-mono text-[10px]">ID: {item.id}</span>
                      </div>
                    )}
                  </div>

                  {/* Ações: Confirmar Liberação / Editar / Descartar */}
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
                    <button
                      onClick={() => handleApproveQuarantineItem(item)}
                      className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow transition-colors cursor-pointer"
                      title="Confirmar liberação deste evento: inclui na tabela de eventos e apaga definitivamente da quarentena"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirmar Liberação</span>
                    </button>

                    <button
                      onClick={() => setEditingItem(item)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                      title="Editar todos os detalhes do evento"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDiscardQuarantineItem(item.id, item.title)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/40 transition-colors cursor-pointer"
                      title="Descartar da quarentena"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DE EDIÇÃO PRÉ-APROVAÇÃO */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>Editar Evento da Quarentena</span>
              </h4>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Título do Evento</label>
                <input
                  type="text"
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Categoria</label>
                  <select
                    value={editingItem.category}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Data</label>
                  <input
                    type="date"
                    value={editingItem.date}
                    onChange={(e) => setEditingItem({ ...editingItem, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Horário</label>
                  <input
                    type="time"
                    value={editingItem.time}
                    onChange={(e) => setEditingItem({ ...editingItem, time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Cidade</label>
                  <input
                    type="text"
                    value={editingItem.city}
                    onChange={(e) => setEditingItem({ ...editingItem, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nome do Local</label>
                <input
                  type="text"
                  value={editingItem.locationName}
                  onChange={(e) => setEditingItem({ ...editingItem, locationName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Endereço</label>
                <input
                  type="text"
                  value={editingItem.address}
                  onChange={(e) => setEditingItem({ ...editingItem, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
                title="Salvar alterações e manter na quarentena"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar na Quarentena</span>
              </button>
              <button
                onClick={handleSaveAndApproveEdit}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
                title="Salvar alterações, confirmar liberação na tabela de eventos e apagar da quarentena"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Salvar e Confirmar Liberação</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
