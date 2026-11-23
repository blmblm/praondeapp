import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  X, 
  Database, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  ExternalLink, 
  Search, 
  Layers, 
  Lock,
  KeyRound,
  Key,
  Eye,
  EyeOff,
  LogOut,
  FolderPlus,
  ArrowLeft,
  RotateCcw,
  Check,
  Plus,
  Sparkles,
  Users,
  UserCheck,
  MapPin,
  Building2,
  Mail,
  Phone,
  Edit2,
  LayoutGrid,
  Clock,
  Filter,
  ImageIcon,
  Upload,
  SlidersHorizontal,
  BadgeAlert,
  Send,
  RefreshCw,
  Ban,
  Download,
  CheckCheck,
  AlertTriangle,
  ShieldAlert,
  Tag,
  QrCode,
  Play,
  BarChart3,
  TrendingUp,
  LineChart,
  Award,
  Activity,
  Ticket,
  CalendarCheck,
  Wrench,
  Globe,
  Copy,
  FileCode
} from 'lucide-react';
import { EventItem, Advertiser, Supervisor, CityItem, CategoryItem, ImportedEventItem } from '../types';
import { SponsorItem } from '../data/sponsors';
import { EventLiberationModal } from './EventLiberationModal';
import { SymplaImporterView } from './SymplaImporterView';
import { Ticket360ImporterView } from './Ticket360ImporterView';
import {
  saveEstadoToFirestore,
  deleteEstadoFromFirestore,
  deleteAllEstadosFromFirestore,
  saveCategoriaToFirestore,
  deleteCategoriaFromFirestore,
  saveEventToFirestore,
  savePalavraIgnoradaToFirestore,
  deletePalavraIgnoradaFromFirestore,
} from '../lib/firestoreSync';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: EventItem[];
  advertisers?: Advertiser[];
  categories: string[];
  categoryItems?: CategoryItem[];
  onAddCategory: (category: string) => void;
  onDeleteCategory: (category: string) => void;
  onDeleteEvent: (id: string) => void;
  onToggleLiberado?: (id: string, currentLiberado: string) => void;
  onSetLiberado?: (id: string, liberado: 'S' | 'N', updatedUrl?: string, urlType?: 'video' | 'image' | 'link', newCategory?: string) => Promise<void> | void;
  onSelectEvent: (event: EventItem) => void;
  onOpenSqlConsole: () => void;
  isMasterAdminState?: boolean;
  onMasterAuthChange?: (isMaster: boolean) => void;
  sponsors?: SponsorItem[];
  onUpdateSponsors?: (sponsors: SponsorItem[]) => void;
  onEventsUpdated?: () => void;
  onEventApproved?: (event: EventItem) => void;
}

const ADMIN_PIN_KEY = 'praonde_admin_pin';
const SUPERVISORS_STORAGE_KEY = 'praonde_supervisors_v1';
const CITIES_STORAGE_KEY = 'praonde_cities_v1';
const INITIAL_PIN = '0612';

const NOME_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Central managing views
type AdminPageView = 
  | 'menu' 
  | 'passwords' 
  | 'categories' 
  | 'supervisors' 
  | 'cities' 
  | 'sponsors'
  | 'liberar_patrocinadores'
  | 'liberar_eventos'
  | 'importar_sympla'
  | 'filtro_sympla'
  | 'importar_ticket360'
  | 'estatisticas'
  | 'rotina_limpeza'
  | 'dominio_pwa';

const INITIAL_CITIES: CityItem[] = [
  { id: 'city-1', name: 'São Paulo', state: 'SP', region: 'Sudeste', active: true },
  { id: 'city-2', name: 'Campinas', state: 'SP', region: 'Sudeste', active: true },
  { id: 'city-3', name: 'Santos', state: 'SP', region: 'Sudeste', active: true },
  { id: 'city-4', name: 'Rio de Janeiro', state: 'RJ', region: 'Sudeste', active: true },
  { id: 'city-5', name: 'Belo Horizonte', state: 'MG', region: 'Sudeste', active: true },
  { id: 'city-6', name: 'Recife', state: 'PE', region: 'Nordeste', active: true },
  { id: 'city-7', name: 'Salvador', state: 'BA', region: 'Nordeste', active: true },
  { id: 'city-8', name: 'Fortaleza', state: 'CE', region: 'Nordeste', active: true },
  { id: 'city-9', name: 'Curitiba', state: 'PR', region: 'Sul', active: true },
  { id: 'city-10', name: 'Porto Alegre', state: 'RS', region: 'Sul', active: true },
  { id: 'city-11', name: 'Brasília', state: 'DF', region: 'Centro-Oeste', active: true },
  { id: 'city-12', name: 'Goiânia', state: 'GO', region: 'Centro-Oeste', active: true }
];

const INITIAL_SUPERVISORS: Supervisor[] = [
  {
    id: 'sup-1',
    name: 'Carlos Alberto Silva',
    senha: '123456',
    email: 'carlos.supervisor@praonde.com',
    phone: '(11) 99887-1122',
    city: 'São Paulo',
    state: 'SP',
    role: 'geral',
    status: 'ativo',
    createdAt: '2026-09-01'
  },
  {
    id: 'sup-2',
    name: 'Mariana Fernandes Costa',
    senha: '654321',
    email: 'mariana.costa@praonde.com',
    phone: '(81) 98765-4321',
    city: 'Recife',
    state: 'PE',
    role: 'regional',
    status: 'ativo',
    createdAt: '2026-09-02'
  }
];

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  events,
  advertisers = [],
  categories,
  categoryItems = [],
  onAddCategory,
  onDeleteCategory,
  onDeleteEvent,
  onToggleLiberado,
  onSetLiberado,
  onSelectEvent,
  onOpenSqlConsole,
  isMasterAdminState = false,
  onMasterAuthChange,
  sponsors = [],
  onUpdateSponsors,
  onEventsUpdated,
  onEventApproved,
}) => {
  // State for Sympla Quarantine
  const [quarantineEvents, setQuarantineEvents] = useState<ImportedEventItem[]>([]);
  const [quarantineCount, setQuarantineCount] = useState<number>(0);
  const [isLoadingQuarantine, setIsLoadingQuarantine] = useState<boolean>(false);

  // Itens da Tabela de Categorias sincronizados com o banco SQLite / Firestore
  const [localCategoryItems, setLocalCategoryItems] = useState<CategoryItem[]>(categoryItems);

  useEffect(() => {
    if (categoryItems && categoryItems.length > 0) {
      setLocalCategoryItems(categoryItems);
    }
  }, [categoryItems]);

  const fetchDbCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setLocalCategoryItems(data);
        }
      }
    } catch (err) {
      console.warn('Erro ao sincronizar tabela de categorias no AdminModal:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDbCategories();
    }
  }, [isOpen]);

  const fetchQuarantineCount = async () => {
    try {
      setIsLoadingQuarantine(true);
      const res = await fetch('/api/imported-events?status=quarentena');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setQuarantineEvents(data);
          setQuarantineCount(data.length);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar registros da quarentena:', err);
    } finally {
      setIsLoadingQuarantine(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchQuarantineCount();
    }
  }, [isOpen]);

  // State for "Patrocinadores"
  const [localSponsors, setLocalSponsors] = useState<SponsorItem[]>(sponsors);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorCategory, setSponsorCategory] = useState('Adega & Bebidas');
  const [sponsorDesc, setSponsorDesc] = useState('');
  const [sponsorBadge, setSponsorBadge] = useState('');
  const [sponsorPhone, setSponsorPhone] = useState('');
  const [sponsorAddress, setSponsorAddress] = useState('');
  const [sponsorCity, setSponsorCity] = useState('Santo André');
  const [sponsorState, setSponsorState] = useState('SP');
  const [sponsorImage, setSponsorImage] = useState('');
  const [sponsorFeedback, setSponsorFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    setLocalSponsors(sponsors);
  }, [sponsors]);
  // Auth state - tela de senha ao clicar em administração (senha default: 0612 ou senha de supervisor)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (isMasterAdminState) return true;
    try {
      return sessionStorage.getItem('praonde_master_0612') === 'true';
    } catch {
      return false;
    }
  });
  const [isMasterAdmin, setIsMasterAdmin] = useState<boolean>(() => {
    if (isMasterAdminState) return true;
    try {
      return sessionStorage.getItem('praonde_master_0612') === 'true';
    } catch {
      return false;
    }
  });
  const [authenticatedUser, setAuthenticatedUser] = useState<string>(() => {
    if (isMasterAdminState) return 'Administrador Master';
    try {
      if (sessionStorage.getItem('praonde_master_0612') === 'true') return 'Administrador Master';
    } catch {}
    return '';
  });
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copiedPwaCode, setCopiedPwaCode] = useState<boolean>(false);
  const [copiedDirectCode, setCopiedDirectCode] = useState<boolean>(false);

  useEffect(() => {
    if (isMasterAdminState) {
      setIsAuthenticated(true);
      setIsMasterAdmin(true);
      setAuthenticatedUser('Administrador Master');
    }
  }, [isMasterAdminState]);

  // Master Prompt para opções restritas exclusivamente à senha "0612" (Categorias, Supervisores, Cidades)
  const [masterPromptTarget, setMasterPromptTarget] = useState<AdminPageView | null>(null);
  const [masterPromptPin, setMasterPromptPin] = useState<string>('');
  const [masterPromptError, setMasterPromptError] = useState<string>('');
  const [showMasterPromptPin, setShowMasterPromptPin] = useState<boolean>(false);

  // Page view
  const [currentView, setCurrentView] = useState<AdminPageView>('menu');

  // State for "Cadastrar Senhas"
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [showNewPin, setShowNewPin] = useState<boolean>(false);
  const [pinFeedback, setPinFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // State for "Cadastrar Categorias"
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [categoryFeedback, setCategoryFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // State for managing ignored words (blacklist filter) (Request: Sympla Blacklist words)
  const [ignoredWords, setIgnoredWords] = useState<{ id: number; palavra: string; criadoEm?: string }[]>([]);
  const [newIgnoredWord, setNewIgnoredWord] = useState<string>('');
  const [ignoredWordFeedback, setIgnoredWordFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [isLoadingIgnoredWords, setIsLoadingIgnoredWords] = useState<boolean>(false);

  // State for Rotina Quinzenal & Limpeza do Banco
  const [cleanupStatus, setCleanupStatus] = useState<any>(null);
  const [isLoadingCleanupStatus, setIsLoadingCleanupStatus] = useState<boolean>(false);
  const [isRunningCleanup, setIsRunningCleanup] = useState<boolean>(false);
  const [cleanupNotice, setCleanupNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fetchCleanupStatus = async () => {
    try {
      setIsLoadingCleanupStatus(true);
      const res = await fetch('/api/admin/cleanup-status');
      if (res.ok) {
        const data = await res.json();
        setCleanupStatus(data);
      }
    } catch (err) {
      console.warn('Erro ao carregar status de limpeza:', err);
    } finally {
      setIsLoadingCleanupStatus(false);
    }
  };

  const handleRunCleanupNow = async (scope: 'quinzenal' | 'diaria' = 'quinzenal') => {
    try {
      setIsRunningCleanup(true);
      setCleanupNotice(null);
      const res = await fetch('/api/admin/cleanup-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: scope })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCleanupNotice({
          type: 'success',
          msg: `Rotina ${scope === 'quinzenal' ? 'Quinzenal' : 'Diária'} executada com sucesso! ${data.totalExcluidos} registro(s) expirado(s) removido(s) em ${data.totalTabelasComDataEvento} tabelas monitoradas. Banco reorganizado com sucesso (REINDEX & VACUUM concluídos em ${data.duracaoMs}ms).`
        });
        await fetchCleanupStatus();
        if (onEventsUpdated) {
          onEventsUpdated();
        }
      } else {
        setCleanupNotice({
          type: 'error',
          msg: data.error || 'Falha ao executar rotina de limpeza.'
        });
      }
    } catch (err: any) {
      setCleanupNotice({
        type: 'error',
        msg: err.message || 'Erro de conexão ao executar rotina.'
      });
    } finally {
      setIsRunningCleanup(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentView === 'rotina_limpeza') {
      fetchCleanupStatus();
    }
  }, [isOpen, currentView]);

  const fetchIgnoredWords = async () => {
    try {
      setIsLoadingIgnoredWords(true);
      const res = await fetch('/api/ignored-words');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setIgnoredWords(data);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar palavras ignoradas:', err);
    } finally {
      setIsLoadingIgnoredWords(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentView === 'filtro_sympla') {
      fetchIgnoredWords();
    }
  }, [isOpen, currentView]);

  const handleAddIgnoredWord = async (e: React.FormEvent) => {
    e.preventDefault();
    setIgnoredWordFeedback(null);
    const word = newIgnoredWord.trim().toLowerCase();
    if (!word) {
      setIgnoredWordFeedback({ type: 'error', msg: 'Digite uma palavra.' });
      return;
    }

    try {
      const res = await fetch('/api/ignored-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ palavra: word }),
      });
      if (res.ok) {
        const addedWord = await res.json().catch(() => ({}));
        if (addedWord && addedWord.id) {
          savePalavraIgnoradaToFirestore({ id: addedWord.id, palavra: addedWord.palavra }).catch(() => {});
        }
        setIgnoredWordFeedback({ type: 'success', msg: `Palavra "${word}" adicionada ao filtro!` });
        setNewIgnoredWord('');
        fetchIgnoredWords();
      } else {
        const errJson = await res.json();
        setIgnoredWordFeedback({ type: 'error', msg: errJson.error || 'Erro ao adicionar.' });
      }
    } catch (err) {
      setIgnoredWordFeedback({ type: 'error', msg: 'Erro ao conectar ao servidor.' });
    }
  };

  const handleDeleteIgnoredWord = async (id: number, word: string) => {
    if (!window.confirm(`Deseja remover a palavra "${word}" do filtro?`)) return;
    try {
      const res = await fetch(`/api/ignored-words/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        deletePalavraIgnoradaFromFirestore(id).catch(() => {});
        setIgnoredWordFeedback({ type: 'success', msg: `Palavra "${word}" removida com sucesso!` });
        fetchIgnoredWords();
      }
    } catch (err) {
      setIgnoredWordFeedback({ type: 'error', msg: 'Erro ao conectar ao servidor.' });
    }
  };

  // State for "Cadastrar Supervisor" e Atualização
  const [supervisors, setSupervisors] = useState<Supervisor[]>(() => {
    try {
      const saved = localStorage.getItem(SUPERVISORS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_SUPERVISORS;
  });
  const [editingSupervisorId, setEditingSupervisorId] = useState<string | null>(null);
  const [supName, setSupName] = useState('');
  const [supPassword, setSupPassword] = useState('');
  const [showSupPassword, setShowSupPassword] = useState(false);
  const [supEmail, setSupEmail] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supCity, setSupCity] = useState('');
  const [supState, setSupState] = useState('SP');
  const [supRole, setSupRole] = useState<'geral' | 'regional' | 'financeiro'>('geral');
  const [supFeedback, setSupFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [supSearchQuery, setSupSearchQuery] = useState('');

  // State for "Cadastrar Cidades"
  const [cities, setCities] = useState<CityItem[]>(() => {
    try {
      const saved = localStorage.getItem(CITIES_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_CITIES;
  });
  const [newCityName, setNewCityName] = useState('');
  const [newCityState, setNewCityState] = useState('SP');
  const [newCityRegion, setNewCityRegion] = useState('Sudeste');
  const [cityFeedback, setCityFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [citySearchQuery, setCitySearchQuery] = useState('');

  // State for "Liberar Eventos" - por padrão exibe todos os registros (incluindo quarentena e catálogo)
  const [localEvents, setLocalEvents] = useState<EventItem[]>(() => events || []);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [eventFilterStatus, setEventFilterStatus] = useState<'pending' | 'quarentena' | 'approved' | 'all'>('pending');
  const [selectedCategoryForLiberation, setSelectedCategoryForLiberation] = useState<string>('Todas');
  const [selectedEventForAnalysis, setSelectedEventForAnalysis] = useState<EventItem | null>(null);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);
  const [confirmDeleteScope, setConfirmDeleteScope] = useState<'pending' | 'filtered' | 'all' | null>(null);

  // Sincroniza localEvents sempre que a prop events for atualizada preservando registros já carregados
  useEffect(() => {
    if (Array.isArray(events) && events.length > 0) {
      setLocalEvents((prev) => {
        if (prev.length === 0) return events;
        const map = new Map<string, EventItem>();
        prev.forEach((e) => map.set(e.id, e));
        events.forEach((e) => {
          const ex = map.get(e.id);
          map.set(e.id, ex ? { ...ex, ...e } : e);
        });
        return Array.from(map.values());
      });
    }
  }, [events]);

  // Busca lista fresca e autoritativa de eventos diretamente da API SQLite
  const fetchEventsFromApi = async () => {
    setIsLoadingEvents(true);
    try {
      const res = await fetch('/api/events?order_by=criado_em&admin=true&limit=5000');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setLocalEvents(data);
        }
      }
    } catch (err) {
      console.warn('Erro ao atualizar eventos na moderação:', err);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  // Carrega eventos do banco sempre que o modal for aberto ou ao entrar na tela de liberar eventos
  useEffect(() => {
    if (isOpen) {
      fetchEventsFromApi();
    }
  }, [isOpen]);

  useEffect(() => {
    if (currentView === 'liberar_eventos') {
      fetchEventsFromApi();
      fetchQuarantineCount();
    }
  }, [currentView]);

  // State for "Liberar Patrocinadores" (Revisão e Moderação de Anúncios)
  const [dbSponsors, setDbSponsors] = useState<SponsorItem[]>([]);
  const [loadingDbSponsors, setLoadingDbSponsors] = useState(false);
  const [sponsorLiberationFilter, setSponsorLiberationFilter] = useState<'pendente' | 'S' | 'N' | 'all'>('pendente');
  const [sponsorSearch, setSponsorSearch] = useState('');
  const [sponsorLiberationFeedback, setSponsorLiberationFeedback] = useState<{ type: 'success' | 'error'; msg: string; whatsappUrl?: string } | null>(null);
  const [actionInProgressSponsorId, setActionInProgressSponsorId] = useState<string | null>(null);

  // Carregar patrocinadores do banco de dados para a Central de Gerenciamento
  const fetchDbSponsors = async () => {
    setLoadingDbSponsors(true);
    try {
      const res = await fetch('/api/admin/sponsors');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDbSponsors(data);
          // Atualiza também a lista local caso sincronizada
          setLocalSponsors((prev) => {
            const map = new Map<string, SponsorItem>();
            prev.forEach((s) => map.set(s.id, s));
            data.forEach((s: SponsorItem) => map.set(s.id, s));
            return Array.from(map.values());
          });
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar patrocinadores do banco:', e);
    } finally {
      setLoadingDbSponsors(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPixConfig();
    }
  }, [isOpen]);

  // Configurações do Pix da Plataforma (Chave Oficial, Beneficiário, Mercado Pago)
  const [showPixConfigModal, setShowPixConfigModal] = useState(false);
  const [pixConfigForm, setPixConfigForm] = useState({
    chavePix: 'praondeeu@gmail.com',
    tipoChave: 'email',
    nomeBeneficiario: 'PRA ONDE EU VOU',
    cidadeBeneficiario: 'PRAIA GRANDE',
    mercadoPagoToken: '',
  });
  const [loadingPixConfig, setLoadingPixConfig] = useState(false);
  const [savingPixConfig, setSavingPixConfig] = useState(false);
  const [pixConfigFeedback, setPixConfigFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fetchPixConfig = async () => {
    setLoadingPixConfig(true);
    try {
      const res = await fetch('/api/admin/pix-config');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPixConfigForm({
            chavePix: data.chavePix || 'praondeeu@gmail.com',
            tipoChave: data.tipoChave || 'email',
            nomeBeneficiario: data.nomeBeneficiario || 'PRA ONDE EU VOU',
            cidadeBeneficiario: data.cidadeBeneficiario || 'PRAIA GRANDE',
            mercadoPagoToken: data.mercadoPagoToken || '',
          });
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar configurações de Pix:', e);
    } finally {
      setLoadingPixConfig(false);
    }
  };

  const handleSavePixConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPixConfig(true);
    setPixConfigFeedback(null);
    try {
      const res = await fetch('/api/admin/pix-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pixConfigForm),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPixConfigFeedback({ type: 'success', msg: 'Configurações de Pix salvas com sucesso! O novo QR Code e dados oficiais já estão ativos no cadastro de comércio.' });
      } else {
        setPixConfigFeedback({ type: 'error', msg: data.error || 'Erro ao salvar configurações de Pix.' });
      }
    } catch (err: any) {
      setPixConfigFeedback({ type: 'error', msg: err.message || 'Erro de comunicação.' });
    } finally {
      setSavingPixConfig(false);
    }
  };

  // Carregar estatísticas do banco de dados para a Central de Gerenciamento
  const [statsData, setStatsData] = useState<{ id: number; ano: number; mes: number; estado: string; total_consultas: number }[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);
  const [statsYearFilter, setStatsYearFilter] = useState<string>('2026');
  const [statsStateFilter, setStatsStateFilter] = useState<string>('Todos');

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const res = await fetch('/api/admin/estatisticas');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setStatsData(json.data);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar estatísticas:', e);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleResetStats = async () => {
    if (!window.confirm('Deseja realmente zerar todas as estatísticas de consultas? O contador começará do zero com as novas buscas dos usuários.')) return;
    setIsLoadingStats(true);
    try {
      const res = await fetch('/api/admin/estatisticas', { method: 'DELETE' });
      if (res.ok) {
        setStatsData([]);
        await fetchStats();
      }
    } catch (e) {
      console.warn('Erro ao zerar estatísticas:', e);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    if (currentView === 'estatisticas') {
      fetchStats();
    }
  }, [currentView]);

  // Sincronizar supervisores do SQLite ao abrir
  useEffect(() => {
    if (!isOpen) return;
    const fetchSupervisorsFromDb = async () => {
      try {
        const res = await fetch('/api/supervisors');
        if (res.ok) {
          const dbSups = await res.json();
          if (Array.isArray(dbSups) && dbSups.length > 0) {
            setSupervisors((prev) => {
              const map = new Map<string, Supervisor>();
              prev.forEach((s) => map.set(s.name.toLowerCase(), s));
              dbSups.forEach((d: any) => {
                const key = d.nome.toLowerCase();
                const existing = map.get(key);
                if (existing) {
                  map.set(key, { ...existing, dbId: d.id, senha: d.senha || existing.senha });
                } else {
                  map.set(key, {
                    id: `sup-db-${d.id}`,
                    dbId: d.id,
                    name: d.nome,
                    senha: d.senha || undefined,
                    email: `${d.nome.toLowerCase().replace(/\s+/g, '.')}@praonde.com`,
                    role: 'geral',
                    status: 'ativo',
                    createdAt: d.criadoEm ? d.criadoEm.split('T')[0] : '2026-09-10',
                  });
                }
              });
              return Array.from(map.values());
            });
          }
        }
      } catch (err) {
        console.warn('Erro ao sincronizar supervisores do SQLite:', err);
      }
    };

    const fetchCidadesFromDb = async () => {
      try {
        const res = await fetch('/api/estado');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setCities(data.map((c: any) => ({
              id: String(c.id),
              name: c.nome,
              state: c.estado,
              region: c.regiao || '',
              active: c.ativa !== false,
            })));
          }
        }
      } catch (err) {
        console.warn('Erro ao sincronizar da tabela estado:', err);
      }
    };

    fetchSupervisorsFromDb();
    fetchCidadesFromDb();
  }, [isOpen]);

  // Save supervisors to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SUPERVISORS_STORAGE_KEY, JSON.stringify(supervisors));
    } catch (e) {
      console.error(e);
    }
  }, [supervisors]);

  // Save cities to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CITIES_STORAGE_KEY, JSON.stringify(cities));
    } catch (e) {
      console.error(e);
    }
  }, [cities]);

  // Helper to read stored pin
  const getStoredPin = (): string => {
    try {
      return localStorage.getItem(ADMIN_PIN_KEY) || INITIAL_PIN;
    } catch {
      return INITIAL_PIN;
    }
  };

  // Reset state on open/close
  useEffect(() => {
    if (!isOpen) {
      setIsAuthenticated(false);
      setIsMasterAdmin(false);
      setAuthenticatedUser('');
      setIsVerifying(false);
      setPasswordInput('');
      setShowPassword(false);
      setErrorMessage('');
      setCurrentView('menu');
      setMasterPromptTarget(null);
      setMasterPromptPin('');
      setMasterPromptError('');
      setShowMasterPromptPin(false);
      setNewPin('');
      setConfirmPin('');
      setPinFeedback(null);
      setNewCategoryName('');
      setCategoryFeedback(null);
      setSupFeedback(null);
      setEditingSupervisorId(null);
      setSupName('');
      setSupPassword('');
      setShowSupPassword(false);
      setCityFeedback(null);
      setSelectedCategoryForLiberation('Todas');
      setEventFilterStatus('pending');
      setConfirmDeleteScope(null);
    }
  }, [isOpen]);

  // Listener para sincronização automática quando a quarentena for alterada ou esvaziada
  useEffect(() => {
    const onQuarantineSync = () => {
      fetchQuarantineCount();
      if (onEventsUpdated) {
        onEventsUpdated();
      }
    };
    window.addEventListener('praonde:quarantine-cleared', onQuarantineSync);
    window.addEventListener('praonde:quarantine-updated', onQuarantineSync);
    return () => {
      window.removeEventListener('praonde:quarantine-cleared', onQuarantineSync);
      window.removeEventListener('praonde:quarantine-updated', onQuarantineSync);
    };
  }, [onEventsUpdated]);

  // Categorias disponíveis para o Grid de Liberar Eventos (EXCLUSIVAMENTE as cadastradas na tabela de categorias, com fallback se vazio)
  const allCategoriesForLiberation = useMemo(() => {
    const list: { id?: number; name: string; descricao?: string }[] = [];
    const added = new Set<string>();

    // Exclusivamente itens da tabela de categorias (SQLite / Firestore)
    localCategoryItems.forEach((ci) => {
      const trimmed = (ci.nome || '').trim();
      if (trimmed && trimmed.toLowerCase() !== 'categoria' && ci.ativa !== false && !added.has(trimmed.toLowerCase())) {
        added.add(trimmed.toLowerCase());
        list.push({ id: ci.id, name: trimmed, descricao: (ci.descricao || '').trim() });
      }
    });

    // Se estiver vazia (sem dados de banco ainda), aplica o fallback para alinhar com a tela de cadastro
    if (list.length === 0) {
      const fallbacks = [
        'Shows',
        'Samba e Pagode',
        'Baile Nostalgia',
        'Baile Terceira Idade',
        'Forró',
        'Forró Pé de Serra',
        'Festas'
      ];
      fallbacks.forEach((name, index) => {
        list.push({ id: 100 + index, name, descricao: `Categoria ${name}` });
      });
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [localCategoryItems]);

  // Handle password submission (Validação da Senha Master "0612" ou senha cadastrada na tabela supervisor)
  const handlePasswordSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const stored = getStoredPin();
    const cleaned = passwordInput.trim();

    if (!cleaned) {
      setErrorMessage('Por favor, informe a senha de acesso.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');

    // 1. Senha Master Padrão (0612) ou personalizada
    if (cleaned === stored || cleaned === INITIAL_PIN) {
      setAuthenticatedUser('Administrador Master');
      setIsAuthenticated(true);
      setIsMasterAdmin(true);
      try {
        sessionStorage.setItem('praonde_master_0612', 'true');
      } catch {}
      onMasterAuthChange?.(true);
      setCurrentView('menu');
      setErrorMessage('');
      setPasswordInput('');
      setIsVerifying(false);
      return;
    }

    // 2. Senha de supervisor cadastrada localmente/em memória
    const matchedSupervisor = supervisors.find(
      (s) => s.senha && s.senha.trim() === cleaned && s.status !== 'inativo'
    );
    if (matchedSupervisor) {
      setAuthenticatedUser(`Supervisor: ${matchedSupervisor.name}`);
      setIsAuthenticated(true);
      setIsMasterAdmin(false);
      try {
        sessionStorage.removeItem('praonde_master_0612');
      } catch {}
      onMasterAuthChange?.(false);
      setCurrentView('menu');
      setErrorMessage('');
      setPasswordInput('');
      setIsVerifying(false);
      return;
    }

    // 3. Senha cadastrada na tabela supervisor do banco de dados SQLite
    try {
      const res = await fetch('/api/admin/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: cleaned }),
      });
      if (res.ok) {
        const data = await res.json();
        setAuthenticatedUser(data.user ? `Supervisor: ${data.user}` : 'Supervisor');
        setIsAuthenticated(true);
        setIsMasterAdmin(false);
        try {
          sessionStorage.removeItem('praonde_master_0612');
        } catch {}
        onMasterAuthChange?.(false);
        setCurrentView('menu');
        setErrorMessage('');
        setPasswordInput('');
        setIsVerifying(false);
        return;
      }
    } catch (err) {
      console.warn('Erro ao consultar verificação de senha no servidor:', err);
    }

    setIsVerifying(false);
    setErrorMessage('Senha incorreta. Verifique a senha e tente novamente.');
  };

  // Validação das opções restritas à senha "0612" (Categorias, Supervisores, Cidades)
  const handleOpenOption = (view: AdminPageView) => {
    if (view === 'liberar_eventos') {
      setCurrentView('liberar_eventos');
      if (onEventsUpdated) {
        onEventsUpdated();
      }
      return;
    }

    // "Cadastrar Categoria", "Cadastrar Supervisor", "Cadastrar Cidades", "Alterar Senha"
    if (!isMasterAdmin) {
      setMasterPromptTarget(view);
      setMasterPromptPin('');
      setMasterPromptError('');
      setShowMasterPromptPin(false);
      return;
    }

    setCurrentView(view);
  };

  // Verificação no prompt modal quando supervisor tenta acessar opção restrita
  const handleVerifyMasterPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    const stored = getStoredPin();
    const cleaned = masterPromptPin.trim();

    if (cleaned === INITIAL_PIN || cleaned === stored) {
      setIsMasterAdmin(true);
      setAuthenticatedUser('Administrador Master');
      try {
        sessionStorage.setItem('praonde_master_0612', 'true');
      } catch {}
      onMasterAuthChange?.(true);
      if (masterPromptTarget) {
        setCurrentView(masterPromptTarget);
      }
      setMasterPromptTarget(null);
      setMasterPromptPin('');
      setMasterPromptError('');
    } else {
      setMasterPromptError('Senha incorreta. Acesso não autorizado.');
    }
  };

  // Handle Registering New Password
  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPinFeedback(null);

    const cleanNew = newPin.trim();
    const cleanConfirm = confirmPin.trim();

    if (!cleanNew) {
      setPinFeedback({ type: 'error', msg: 'Digite a nova senha de até 6 dígitos.' });
      return;
    }

    if (cleanNew.length > 6) {
      setPinFeedback({ type: 'error', msg: 'A senha não pode ultrapassar 6 dígitos.' });
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setPinFeedback({ type: 'error', msg: 'A confirmação de senha não confere.' });
      return;
    }

    try {
      localStorage.setItem(ADMIN_PIN_KEY, cleanNew);
      setPinFeedback({ type: 'success', msg: `Senha cadastrada com sucesso! Nova senha: "${cleanNew}"` });
      setNewPin('');
      setConfirmPin('');
    } catch {
      setPinFeedback({ type: 'error', msg: 'Não foi possível salvar a senha no armazenamento.' });
    }
  };

  const handleResetDefaultPin = () => {
    if (window.confirm('Deseja realmente restaurar a senha inicial padrão?')) {
      try {
        localStorage.setItem(ADMIN_PIN_KEY, INITIAL_PIN);
        setPinFeedback({ type: 'success', msg: 'Senha restaurada para o padrão inicial com sucesso!' });
      } catch {
        setPinFeedback({ type: 'error', msg: 'Erro ao restaurar a senha.' });
      }
    }
  };

  // Handle Registering New Category
  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryFeedback(null);

    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setCategoryFeedback({ type: 'error', msg: 'Informe o nome da categoria.' });
      return;
    }

    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setCategoryFeedback({ type: 'error', msg: 'Esta categoria já está cadastrada.' });
      return;
    }

    onAddCategory(trimmed);
    setCategoryFeedback({ type: 'success', msg: `Categoria "${trimmed}" cadastrada com sucesso!` });
    setNewCategoryName('');
  };

  // Handle Cadastrar ou Atualizar Supervisor
  const handleCreateSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupFeedback(null);

    if (!supName.trim()) {
      setSupFeedback({ type: 'error', msg: 'Informe o nome completo do supervisor.' });
      return;
    }
    if (!supEmail.trim() || !supEmail.includes('@')) {
      setSupFeedback({ type: 'error', msg: 'Informe um e-mail válido para o supervisor.' });
      return;
    }

    // Se estiver em modo de ATUALIZAÇÃO:
    if (editingSupervisorId) {
      const target = supervisors.find((s) => s.id === editingSupervisorId);
      if (target?.dbId) {
        try {
          await fetch(`/api/supervisors/${target.dbId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nome: supName.trim(),
              senha: supPassword.trim() || null,
            }),
          });
        } catch (err) {
          console.warn('Erro ao atualizar supervisor no SQLite:', err);
        }
      }

      setSupervisors((prev) =>
        prev.map((s) =>
          s.id === editingSupervisorId
            ? {
                ...s,
                name: supName.trim(),
                senha: supPassword.trim() || undefined,
                email: supEmail.trim(),
                phone: supPhone.trim() || undefined,
                city: supCity.trim() || undefined,
                state: supState,
                role: supRole,
              }
            : s
        )
      );

      setSupFeedback({
        type: 'success',
        msg: `Supervisor(a) "${supName}" atualizado(a) com sucesso!`,
      });
      setEditingSupervisorId(null);
      setSupName('');
      setSupPassword('');
      setSupEmail('');
      setSupPhone('');
      setSupCity('');
      return;
    }

    // Modo de CADASTRO NOVO:
    if (supervisors.some((s) => s.email.toLowerCase() === supEmail.trim().toLowerCase())) {
      setSupFeedback({ type: 'error', msg: 'Já existe um supervisor cadastrado com este e-mail.' });
      return;
    }

    let sqliteId: number | undefined;
    try {
      const res = await fetch('/api/supervisors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: supName.trim(),
          senha: supPassword.trim() || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        sqliteId = created.id;
      }
    } catch (err) {
      console.warn('Erro ao salvar supervisor no SQLite:', err);
    }

    const newSupervisor: Supervisor = {
      id: `sup-${Date.now()}`,
      dbId: sqliteId,
      name: supName.trim(),
      senha: supPassword.trim() || undefined,
      email: supEmail.trim(),
      phone: supPhone.trim() || undefined,
      city: supCity.trim() || undefined,
      state: supState,
      role: supRole,
      status: 'ativo',
      createdAt: new Date().toISOString().split('T')[0],
    };

    setSupervisors((prev) => [newSupervisor, ...prev]);
    setSupFeedback({
      type: 'success',
      msg: `Supervisor(a) "${supName}" cadastrado(a) com sucesso! Senha configurada para login. ${sqliteId ? `(ID no banco: ${sqliteId})` : ''}`,
    });
    setSupName('');
    setSupPassword('');
    setSupEmail('');
    setSupPhone('');
    setSupCity('');
  };

  const handleStartEditSupervisor = (sup: Supervisor) => {
    setEditingSupervisorId(sup.id);
    setSupName(sup.name);
    setSupPassword(sup.senha || '');
    setSupEmail(sup.email);
    setSupPhone(sup.phone || '');
    setSupCity(sup.city || '');
    setSupState(sup.state || 'SP');
    setSupRole(sup.role);
    setSupFeedback(null);
  };

  const handleCancelEditSupervisor = () => {
    setEditingSupervisorId(null);
    setSupName('');
    setSupPassword('');
    setSupEmail('');
    setSupPhone('');
    setSupCity('');
    setSupFeedback(null);
  };

  const handleDeleteSupervisor = async (id: string) => {
    const target = supervisors.find((s) => s.id === id);
    if (!target) return;
    if (window.confirm(`Deseja remover o(a) supervisor(a) "${target.name}"?`)) {
      setSupervisors((prev) => prev.filter((s) => s.id !== id));
      if (target.dbId) {
        try {
          await fetch(`/api/supervisors/${target.dbId}`, { method: 'DELETE' });
        } catch (err) {
          console.warn('Erro ao deletar supervisor do SQLite:', err);
        }
      }
    }
  };

  const handleToggleSupervisorStatus = (id: string) => {
    setSupervisors((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: s.status === 'ativo' ? 'inativo' : 'ativo' } : s))
    );
  };

  // Handle Cadastrar Cidades
  const handleCreateCity = async (e: React.FormEvent) => {
    e.preventDefault();
    setCityFeedback(null);

    const trimmed = newCityName.trim();
    if (!trimmed) {
      setCityFeedback({ type: 'error', msg: 'Informe o nome da cidade.' });
      return;
    }

    const exists = cities.some(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase() && c.state.toUpperCase() === newCityState.toUpperCase()
    );

    if (exists) {
      setCityFeedback({ type: 'error', msg: `A cidade "${trimmed} - ${newCityState}" já está cadastrada.` });
      return;
    }

    try {
      const res = await fetch('/api/estado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: trimmed,
          estado: newCityState,
          regiao: newCityRegion,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newCity: CityItem = {
          id: String(data.id),
          name: data.nome,
          state: data.estado,
          region: data.regiao || newCityRegion,
          active: true,
        };
        setCities((prev) => [newCity, ...prev]);
        setCityFeedback({ type: 'success', msg: `Registro "${trimmed} - ${newCityState}" cadastrado na tabela de estado com sucesso!` });
        setNewCityName('');

        // Sincroniza no Firestore
        try {
          await saveEstadoToFirestore({
            id: typeof data.id === 'number' ? data.id : parseInt(String(data.id), 10) || 1,
            nome: data.nome,
            estado: data.estado,
            regiao: data.regiao || newCityRegion,
            ativa: true,
            criadoEm: data.criado_em || new Date().toISOString(),
          });
        } catch (fErr) {
          console.warn('[Firestore] Erro ao sincronizar estado:', fErr);
        }

        return;
      }
    } catch (err) {
      console.warn('Erro ao salvar na tabela estado:', err);
    }

    const newCity: CityItem = {
      id: `city-${Date.now()}`,
      name: trimmed,
      state: newCityState,
      region: newCityRegion,
      active: true,
    };

    setCities((prev) => [newCity, ...prev]);
    setCityFeedback({ type: 'success', msg: `Registro "${trimmed} - ${newCityState}" cadastrado com sucesso!` });
    setNewCityName('');

    try {
      await saveEstadoToFirestore({
        id: Date.now(),
        nome: newCity.name,
        estado: newCity.state,
        regiao: newCity.region,
        ativa: true,
        criadoEm: new Date().toISOString(),
      });
    } catch (fErr) {
      console.warn('[Firestore] Erro ao sincronizar estado:', fErr);
    }
  };

  const handleDeleteCity = async (id: string) => {
    const target = cities.find((c) => c.id === id);
    if (!target) return;
    if (window.confirm(`Deseja remover "${target.name} - ${target.state}" da tabela estado?`)) {
      try {
        await deleteEstadoFromFirestore(id);
      } catch (fErr) {
        console.warn('[Firestore] Erro ao deletar estado:', fErr);
      }

      try {
        await fetch(`/api/estado/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Erro ao remover da tabela estado:', err);
      }
      setCities((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const handleDeleteAllCities = async () => {
    if (cities.length === 0) return;
    if (window.confirm(`Atenção: Tem certeza que deseja excluir TODOS os ${cities.length} registros da tabela estado? Esta ação não pode ser desfeita.`)) {
      try {
        await deleteAllEstadosFromFirestore();
      } catch (fErr) {
        console.warn('[Firestore] Erro ao excluir todos do Firestore:', fErr);
      }

      try {
        await fetch('/api/estado', { method: 'DELETE' });
      } catch (err) {
        console.warn('Erro ao remover todos da tabela estado:', err);
      }
      setCities([]);
      setCityFeedback({ type: 'success', msg: 'Todos os registros foram excluídos da tabela estado com sucesso!' });
    }
  };

  const handleToggleCityActive = (id: string) => {
    setCities((prev) =>
      prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c))
    );
  };

  // Categorias disponíveis para o Grid de Liberar Eventos já calculadas no topo

  // Eventos mapeados da quarentena para a fila de liberação
  const mappedQuarantineItems = useMemo<EventItem[]>(() => {
    return quarantineEvents.map((imp) => ({
      id: imp.id,
      title: imp.title,
      description: imp.description || '',
      category: (imp.category || 'Shows') as any,
      categoryId: imp.categoryId,
      date: imp.date,
      time: imp.time || '20:00',
      endDate: imp.date,
      endTime: imp.endTime,
      locationName: imp.locationName || 'Local a confirmar',
      address: imp.address || '',
      city: imp.city || 'São Paulo',
      state: imp.state || 'SP',
      latitude: imp.latitude ? String(imp.latitude) : undefined,
      longitude: imp.longitude ? String(imp.longitude) : undefined,
      liberado: '', // Em quarentena = pendente de liberação
      isFree: !!imp.isGratuito,
      price: imp.price || 0,
      priceDetails: imp.ticketUrl ? (imp.origem === 'ticket360' ? 'Ingressos Ticket360' : (imp.origem === 'anunciante' ? 'Divulgação de Anunciante' : 'Ingressos Sympla')) : '',
      imageUrl: imp.imageUrl || '',
      videoUrl: imp.videoUrl || undefined,
      mediaType: imp.videoUrl ? 'video' : 'image',
      organizer: imp.organizer || (imp.origem === 'ticket360' ? 'Ticket360 Entretenimento' : (imp.origem === 'anunciante' ? 'Anunciante / Usuário' : 'Produção')),
      contact: imp.ticketUrl || imp.contact || '',
      tags: ['Quarentena', imp.origem === 'ticket360' ? 'Ticket360' : (imp.origem === 'anunciante' ? 'Divulgação / Usuário' : 'Sympla'), imp.category || 'Shows'],
      isQuarantine: true,
      status: 'quarentena',
      createdAt: imp.createdAt || new Date().toISOString(),
    }));
  }, [quarantineEvents]);

  // Contagens desduplicadas para Liberar Eventos
  const allPendingItems = useMemo(() => {
    const seen = new Map<string, EventItem>();
    for (const q of mappedQuarantineItems) {
      seen.set(q.id, q);
    }
    for (const e of localEvents) {
      if (e.liberado !== 'S') {
        if (!seen.has(e.id)) {
          seen.set(e.id, e);
        } else {
          const prev = seen.get(e.id)!;
          if (!prev.videoUrl && e.videoUrl) {
            seen.set(e.id, { ...prev, videoUrl: e.videoUrl, mediaType: 'video' });
          }
        }
      }
    }
    return Array.from(seen.values());
  }, [mappedQuarantineItems, localEvents]);

  const totalQuarantine = quarantineEvents.length;
  const totalPending = allPendingItems.length;
  const totalApproved = localEvents.filter((e) => e.liberado === 'S').length;

  // Filtered events for "Liberar Eventos"
  const filteredEventsForLiberation = useMemo(() => {
    let source: EventItem[] = [];

    if (eventFilterStatus === 'quarentena') {
      const seenMap = new Map<string, EventItem>();
      for (const item of mappedQuarantineItems) {
        seenMap.set(item.id, item);
      }
      for (const item of localEvents) {
        if (item.status === 'quarentena' || (item.liberado !== 'S' && item.status !== 'rejeitado')) {
          if (!seenMap.has(item.id)) {
            seenMap.set(item.id, item);
          } else {
            const prev = seenMap.get(item.id)!;
            if (!prev.videoUrl && item.videoUrl) {
              seenMap.set(item.id, { ...prev, videoUrl: item.videoUrl, mediaType: 'video' });
            }
          }
        }
      }
      source = Array.from(seenMap.values());
    } else if (eventFilterStatus === 'approved') {
      source = localEvents.filter((e) => e.liberado === 'S');
    } else if (eventFilterStatus === 'pending') {
      source = [...allPendingItems];
    } else {
      // 'all'
      const seenMap = new Map<string, EventItem>();
      for (const item of [...localEvents, ...mappedQuarantineItems]) {
        if (!seenMap.has(item.id)) {
          seenMap.set(item.id, item);
        }
      }
      source = Array.from(seenMap.values());
    }

    if (selectedCategoryForLiberation !== 'Todas') {
      const selNorm = selectedCategoryForLiberation.toLowerCase().trim();
      source = source.filter((evt) => (evt.category || '').toLowerCase().trim() === selNorm);
    }

    // Ordenar de forma prioritária para que os eventos mais recentemente cadastrados fiquem no topo absoluto da lista
    source.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA && timeB && timeA !== timeB) return timeB - timeA;
      const numA = parseInt((a.id || '').replace(/\D/g, ''), 10) || 0;
      const numB = parseInt((b.id || '').replace(/\D/g, ''), 10) || 0;
      return numB - numA;
    });

    return source;
  }, [eventFilterStatus, mappedQuarantineItems, localEvents, selectedCategoryForLiberation]);

  const handleSaveLiberation = async (
    id: string,
    nextLiberado: 'S' | 'N',
    newCategory?: string,
    updatedUrl?: string,
    urlType?: 'video' | 'image' | 'link'
  ) => {
    const isQuarantine = quarantineEvents.some((q) => q.id === id) || (selectedEventForAnalysis?.id === id && !!selectedEventForAnalysis?.isQuarantine);

    if (nextLiberado === 'N') {
      // Ao clicar em "Cancelar / Cancelar Evento":
      // Tanto para eventos da quarentena quanto para eventos do catálogo pendentes:
      // Exclui o evento para que não continue aparecendo na lista de liberação!
      const targetEvent = quarantineEvents.find((q) => q.id === id) || localEvents.find((e) => e.id === id);
      const targetTitle = targetEvent?.title || selectedEventForAnalysis?.title || 'Evento';

      // 1. Atualização otimista imediata na UI
      setLocalEvents((prev) => prev.filter((e) => e.id !== id));
      setQuarantineEvents((prev) => prev.filter((q) => q.id !== id));
      setQuarantineCount((prev) => Math.max(0, prev - 1));
      if (selectedEventForAnalysis?.id === id) {
        setSelectedEventForAnalysis(null);
      }

      // 2. Notificação visual de feedback
      setLiberationNotice(`Evento "${targetTitle}" cancelado e excluído com sucesso.`);
      setTimeout(() => setLiberationNotice(''), 4000);

      // 3. Exclui permanentemente no backend e Firestore
      if (isQuarantine) {
        try {
          await fetch(`/api/imported-events/${id}?permanent=true`, { method: 'DELETE' });
        } catch (err) {
          console.error('Erro ao excluir item da quarentena:', err);
        }
      } else {
        if (onDeleteEvent) {
          onDeleteEvent(id);
        } else {
          try {
            await fetch(`/api/events/${id}`, { method: 'DELETE' });
          } catch (delErr) {
            console.error('Erro ao excluir evento do SQLite:', delErr);
          }
        }
      }

      // 4. Sincroniza e recarrega dados frescos
      await fetchEventsFromApi();
      if (onEventsUpdated) {
        await onEventsUpdated();
      }
      return;
    }

    // Se nextLiberado === 'S' (Liberar evento)
    // Atualização otimista: atualiza o status liberado do evento específico preservando os outros
    setLocalEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, liberado: 'S', status: 'aprovado', ...(newCategory ? { category: newCategory } : {}) } : e))
    );
    if (isQuarantine) {
      setQuarantineEvents((prev) => prev.filter((q) => q.id !== id));
    }

    // Se uma nova categoria foi alterada na análise, aplica a atualização
    if (newCategory) {
      await handleUpdateCategoryInAnalysis(id, newCategory);
    }

    // Se uma URL ou cartaz foi atualizado na tela de liberação, salva nas tabelas correspondentes e no Firestore
    if (updatedUrl && updatedUrl.trim()) {
      await handleUpdateUrlInAnalysis(id, updatedUrl.trim(), urlType || (updatedUrl.startsWith('data:image/') ? 'image' : 'video'));
    }

    if (isQuarantine) {
      try {
        const isVid = urlType === 'video' || (updatedUrl && (
          updatedUrl.startsWith('data:video/') ||
          updatedUrl.startsWith('/uploads/videos/') ||
          updatedUrl.includes('youtube') ||
          updatedUrl.includes('youtu.be') ||
          updatedUrl.includes('facebook') ||
          updatedUrl.includes('fb.') ||
          updatedUrl.includes('instagram') ||
          updatedUrl.includes('tiktok') ||
          updatedUrl.includes('vimeo') ||
          updatedUrl.includes('.mp4') ||
          updatedUrl.includes('.webm')
        ));

        const res = await fetch(`/api/imported-events/${id}/approve`, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            category: newCategory,
            url: updatedUrl,
            videoUrl: isVid ? updatedUrl : undefined,
            imageUrl: (!isVid && updatedUrl) ? updatedUrl : undefined,
            urlType: isVid ? 'video' : urlType,
          })
        });
        const json = await res.json();
        if (json.success && json.event) {
          saveEventToFirestore(json.event).catch(() => {});
          if (onEventApproved) onEventApproved(json.event);
          setQuarantineEvents((prev) => prev.filter((q) => q.id !== id));
          setQuarantineCount((prev) => Math.max(0, prev - 1));
          setLiberationNotice(`Evento "${json.event.title}" aprovado e liberado com sucesso no aplicativo!`);
          setTimeout(() => setLiberationNotice(''), 4000);
          if (onEventsUpdated) await onEventsUpdated();
        }
      } catch (err) {
        console.error('Erro ao aprovar evento da quarentena:', err);
      }
    } else {
      if (onSetLiberado) {
        await onSetLiberado(id, 'S', updatedUrl, urlType, newCategory);
      } else if (onToggleLiberado) {
        const currentEvt = events.find((e) => e.id === id);
        const current = currentEvt?.liberado || '';
        if (current !== 'S') {
          onToggleLiberado(id, current);
        }
      }
      const targetTitle = localEvents.find((e) => e.id === id)?.title || 'Evento';
      setLiberationNotice(`Evento "${targetTitle}" liberado com sucesso no aplicativo!`);
      setTimeout(() => setLiberationNotice(''), 4000);
    }
    // Atualiza o item atualmente selecionado em análise se ainda for o mesmo
    setSelectedEventForAnalysis((prev) => (prev && prev.id === id ? { ...prev, liberado: 'S', status: 'aprovado', ...(newCategory ? { category: newCategory } : {}) } : prev));
    
    // Recarrega os eventos do banco de dados para garantir que a lista/grid seja atualizada instantaneamente sem o registro liberado/alterado
    await fetchEventsFromApi();
    if (onEventsUpdated) {
      await onEventsUpdated();
    }
  };

  const handleUpdateCategoryInAnalysis = async (id: string, newCategory: string, newCategoryId?: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/events/${id}/category`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory, categoryId: newCategoryId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSelectedEventForAnalysis((prev) => (prev && prev.id === id ? { ...prev, category: newCategory } : prev));
        setQuarantineEvents((prev) => prev.map((q) => (q.id === id ? { ...q, category: newCategory, categoria: newCategory } : q)));
        
        // Atualiza otimistamente o estado da lista local para refletir na tela imediatamente
        setLocalEvents((prev) =>
          prev.map((e) => (e.id === id ? { ...e, category: newCategory } : e))
        );

        const evt = events.find((e) => e.id === id);
        if (evt) {
          saveEventToFirestore({ ...evt, category: newCategory }).catch(() => {});
        }

        // Recarrega e força o refresh da listagem principal
        await fetchEventsFromApi();

        if (onEventsUpdated) {
          await onEventsUpdated();
        }
        setLiberationNotice(`Categoria alterada para "${newCategory}" com sucesso!`);
        setTimeout(() => setLiberationNotice(''), 3500);
        return true;
      }
    } catch (err) {
      console.error('Erro ao atualizar categoria na análise:', err);
    }
    return false;
  };

  const handleUpdateUrlInAnalysis = async (id: string, newUrl: string, urlType: 'video' | 'image' | 'link' = 'video'): Promise<boolean> => {
    try {
      const res = await fetch(`/api/events/${id}/url`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl, urlType }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const isVid = urlType === 'video' || (newUrl && (newUrl.includes('youtube') || newUrl.includes('fb.') || newUrl.includes('.mp4') || newUrl.startsWith('data:video/')));
        const isImg = urlType === 'image' || (newUrl && (newUrl.startsWith('data:image/') || newUrl.startsWith('/uploads/images/') || /\.(jpe?g|png|webp|gif|svg|avif|bmp|jfif|heic|heif|tiff?|ico)($|\?|#)/i.test(newUrl)));

        setSelectedEventForAnalysis((prev) => {
          if (!prev || prev.id !== id) return prev;
          return {
            ...prev,
            url: newUrl,
            ...(isVid ? { videoUrl: newUrl, mediaType: 'video' as const } : {}),
            ...(isImg ? { imageUrl: newUrl, mediaType: 'image' as const } : {}),
          };
        });

        if (onEventsUpdated) {
          onEventsUpdated();
        }

        setQuarantineEvents((prev) =>
          prev.map((q) => {
            if (q.id !== id) return q;
            return {
              ...q,
              url: newUrl,
              ...(isVid ? { videoUrl: newUrl } : {}),
              ...(isImg ? { imageUrl: newUrl } : {}),
            };
          })
        );

        const evt = events.find((e) => e.id === id);
        if (evt) {
          saveEventToFirestore({
            ...evt,
            url: newUrl,
            ...(isVid ? { videoUrl: newUrl, mediaType: 'video' as const } : {}),
            ...(isImg ? { imageUrl: newUrl, mediaType: 'image' as const } : {}),
          }).catch(() => {});
        }

        if (onEventsUpdated) {
          await onEventsUpdated();
        }

        setLiberationNotice(`Campo URL atualizado com sucesso nas tabelas correspondentes!`);
        setTimeout(() => setLiberationNotice(''), 3500);
        return true;
      }
    } catch (err) {
      console.error('Erro ao atualizar URL na análise:', err);
    }
    return false;
  };

  const currentIndexInAnalysis = selectedEventForAnalysis 
    ? filteredEventsForLiberation.findIndex((e) => e.id === selectedEventForAnalysis.id)
    : -1;
  const hasPrevAnalysis = currentIndexInAnalysis > 0;
  const hasNextAnalysis = currentIndexInAnalysis >= 0 && currentIndexInAnalysis < filteredEventsForLiberation.length - 1;

  const handleNextAnalysis = () => {
    if (hasNextAnalysis) {
      setSelectedEventForAnalysis(filteredEventsForLiberation[currentIndexInAnalysis + 1]);
    }
  };

  const handlePrevAnalysis = () => {
    if (hasPrevAnalysis) {
      setSelectedEventForAnalysis(filteredEventsForLiberation[currentIndexInAnalysis - 1]);
    }
  };

  const [isLiberatingAll, setIsLiberatingAll] = useState(false);
  const [liberationNotice, setLiberationNotice] = useState('');

  const handleLiberateAllEvents = async (onlyCurrentCategory: boolean = false) => {
    const targetCategory = (onlyCurrentCategory && selectedCategoryForLiberation !== 'Todas') 
      ? selectedCategoryForLiberation 
      : undefined;

    const pendingCount = targetCategory
      ? (
          events.filter((e) => (e.category || '').toLowerCase().trim() === targetCategory.toLowerCase().trim() && e.liberado !== 'S').length +
          quarantineEvents.filter((q) => (q.category || '').toLowerCase().trim() === targetCategory.toLowerCase().trim()).length
        )
      : totalPending;

    const totalCount = targetCategory
      ? (
          events.filter((e) => (e.category || '').toLowerCase().trim() === targetCategory.toLowerCase().trim()).length +
          quarantineEvents.filter((q) => (q.category || '').toLowerCase().trim() === targetCategory.toLowerCase().trim()).length
        )
      : events.length + totalQuarantine;

    const label = targetCategory
      ? `todos os ${totalCount} eventos da categoria "${targetCategory}" (${pendingCount} pendente${pendingCount !== 1 ? 's' : ''})`
      : `TODOS os ${totalCount} eventos (${pendingCount} pendente${pendingCount !== 1 ? 's' : ''} entre Quarentena e Catálogo)`;

    if (isLiberatingAll) return;

    setIsLiberatingAll(true);
    setLiberationNotice(`Liberando ${label}...`);

    try {
      // 1. Aprova eventos da Quarentena
      if (targetCategory) {
        const qEventsOfCategory = quarantineEvents.filter(
          (q) => (q.category || '').toLowerCase().trim() === targetCategory.toLowerCase().trim()
        );
        if (qEventsOfCategory.length > 0) {
          const qIds = qEventsOfCategory.map((q) => q.id);
          const resQ = await fetch('/api/imported-events/batch-approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: qIds }),
          });
          const jsonQ = await resQ.json();
          if (jsonQ.success && Array.isArray(jsonQ.events)) {
            jsonQ.events.forEach((evt: EventItem) => {
              saveEventToFirestore(evt).catch(() => {});
              if (onEventApproved) onEventApproved(evt);
            });
          }
          setQuarantineEvents((prev) => prev.filter((q) => !qIds.includes(q.id)));
          setQuarantineCount((prev) => Math.max(0, prev - qIds.length));
        }
      } else {
        // Aprova TODOS os eventos da Quarentena
        if (quarantineEvents.length > 0) {
          const resQ = await fetch('/api/imported-events/approve-all', { method: 'POST' });
          const jsonQ = await resQ.json();
          if (jsonQ.success && Array.isArray(jsonQ.events)) {
            jsonQ.events.forEach((evt: EventItem) => {
              saveEventToFirestore(evt).catch(() => {});
              if (onEventApproved) onEventApproved(evt);
            });
          }
          setQuarantineEvents([]);
          setQuarantineCount(0);
        }
      }

      // 2. Atualiza no SQLite os eventos do catálogo oficial através da API dedicada
      const res = await fetch('/api/events/liberar-todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: targetCategory }),
      });

      if (!res.ok) {
        throw new Error('Falha ao atualizar status no servidor');
      }

      // 3. Atualiza os eventos em memória local e no Firestore
      const targetEvts = targetCategory
        ? events.filter((e) => (e.category || '').toLowerCase().trim() === targetCategory.toLowerCase().trim())
        : events;

      for (const evt of targetEvts) {
        if (evt.liberado !== 'S') {
          if (onSetLiberado) {
            await onSetLiberado(evt.id, 'S');
          } else if (onToggleLiberado) {
            onToggleLiberado(evt.id, evt.liberado || 'N');
          }
        }
      }

      // 4. Atualiza o evento atualmente em análise se houver
      if (selectedEventForAnalysis) {
        setSelectedEventForAnalysis((prev) => prev ? { ...prev, liberado: 'S' } : null);
      }

      // 5. Dispara recarregamento global
      if (onEventsUpdated) {
        await onEventsUpdated();
      }

      window.dispatchEvent(new CustomEvent('praonde:quarantine-cleared'));
      await fetchQuarantineCount();

      setLiberationNotice(`Todos os ${totalCount} eventos foram liberados com sucesso (liberado = "S") e sincronizados no app!`);
    } catch (err: any) {
      console.error('Erro ao liberar todos os eventos:', err);
      // Fallback local
      const targetEvts = targetCategory
        ? events.filter((e) => (e.category || '').toLowerCase().trim() === targetCategory.toLowerCase().trim())
        : events;
      targetEvts.forEach((evt) => {
        if (onSetLiberado) onSetLiberado(evt.id, 'S');
      });
      window.dispatchEvent(new CustomEvent('praonde:quarantine-cleared'));
      await fetchQuarantineCount().catch(() => {});
      setLiberationNotice('Eventos liberados com sucesso!');
    } finally {
      setIsLiberatingAll(false);
      setTimeout(() => {
        setLiberationNotice('');
      }, 5000);
    }
  };

  const handleLiberateAllPending = () => handleLiberateAllEvents(false);

  // Exclusão em lote de eventos (Pendentes, Filtrados ou Todos)
  const handleDeleteEventsBatch = async (scope: 'pending' | 'filtered' | 'all') => {
    if (isDeletingBatch) return;

    let itemsToDelete: EventItem[] = [];
    const currentList = localEvents.length > 0 ? localEvents : events;
    if (scope === 'pending') {
      const pendingCatalog = currentList.filter((e) => e.liberado !== 'S');
      itemsToDelete = [...mappedQuarantineItems, ...pendingCatalog];
    } else if (scope === 'filtered') {
      itemsToDelete = filteredEventsForLiberation;
    } else if (scope === 'all') {
      itemsToDelete = [...mappedQuarantineItems, ...currentList];
    }

    if (itemsToDelete.length === 0) {
      setLiberationNotice('Nenhum evento encontrado para excluir neste filtro.');
      setConfirmDeleteScope(null);
      setTimeout(() => setLiberationNotice(''), 4000);
      return;
    }

    setIsDeletingBatch(true);
    setLiberationNotice(`Excluindo ${itemsToDelete.length} evento(s)...`);

    try {
      const quarantineItems = itemsToDelete.filter((e) => e.isQuarantine);
      const catalogItems = itemsToDelete.filter((e) => !e.isQuarantine);

      // 1. Exclui itens da quarentena
      if (quarantineItems.length > 0) {
        if (scope === 'pending' || scope === 'all' || quarantineItems.length === quarantineEvents.length) {
          await fetch('/api/imported-events/clear', { method: 'POST' }).catch(() => {});
          setQuarantineEvents([]);
          setQuarantineCount(0);
        } else {
          const qIds = quarantineItems.map((q) => q.id);
          await fetch('/api/imported-events/batch-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: qIds }),
          }).catch(() => {});
          setQuarantineEvents((prev) => prev.filter((q) => !qIds.includes(q.id)));
          setQuarantineCount((prev) => Math.max(0, prev - qIds.length));
        }
        window.dispatchEvent(new CustomEvent('praonde:quarantine-cleared'));
      }

      // 2. Exclui itens do catálogo
      if (catalogItems.length > 0) {
        const cIds = catalogItems.map((c) => c.id);
        await fetch('/api/events/batch-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: cIds }),
        });

        for (const item of catalogItems) {
          onDeleteEvent(item.id);
        }
      }

      // 3. Atualizar eventos se callback disponível
      if (onEventsUpdated) {
        await onEventsUpdated();
      }

      // 4. Fechar modal de análise se o evento aberto foi excluído
      if (selectedEventForAnalysis && itemsToDelete.some((e) => e.id === selectedEventForAnalysis.id)) {
        setSelectedEventForAnalysis(null);
      }

      setLiberationNotice(`${itemsToDelete.length} evento(s) excluído(s) com sucesso da fila e do banco de dados!`);
    } catch (err: any) {
      console.error('Erro ao excluir eventos em lote:', err);
      setLiberationNotice('Ocorreu um erro ao excluir os eventos.');
    } finally {
      setIsDeletingBatch(false);
      setConfirmDeleteScope(null);
      setTimeout(() => setLiberationNotice(''), 5000);
    }
  };

  // Filtered supervisors
  const filteredSupervisors = supervisors.filter((s) => {
    if (!supSearchQuery.trim()) return true;
    const q = supSearchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.city || '').toLowerCase().includes(q) ||
      s.state?.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q)
    );
  });

  // Filtered cities
  const filteredCities = cities.filter((c) => {
    if (!citySearchQuery.trim()) return true;
    const q = citySearchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.state.toLowerCase().includes(q) ||
      (c.region || '').toLowerCase().includes(q)
    );
  });

  // Modal fechado: retorno seguro após TODOS os hooks terem sido executados
  if (!isOpen) return null;

  // ==========================================
  // TELA DE AUTENTICAÇÃO INICIAL (0612)
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
        <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-3 shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Central de Gerenciamento</h2>
            <p className="text-xs text-slate-400">
              Digite a senha de Administrador Master ou Supervisor
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-password-input" className="block text-xs font-semibold text-slate-300 mb-2">
                Senha de Acesso
              </label>
              <div className="relative">
                <input
                  id="admin-password-input"
                  type={showPassword ? 'text' : 'password'}
                  maxLength={12}
                  autoFocus
                  disabled={isVerifying}
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="••••••"
                  className="w-full text-center text-xl tracking-[0.25em] font-mono py-3.5 px-12 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 transition-colors cursor-pointer"
                  title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Indicadores de digitação */}
              <div className="flex items-center justify-center gap-1.5 mt-3">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <span
                    key={index}
                    className={`w-2 h-2 rounded-full transition-all duration-150 ${
                      index < passwordInput.length
                        ? 'bg-amber-400 scale-110 shadow-sm shadow-amber-400/50'
                        : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 text-xs text-rose-400 mt-3 bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 rounded-xl animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="btn-admin-submit-login"
                type="submit"
                disabled={isVerifying}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <KeyRound className="w-4 h-4" />
                <span>{isVerifying ? 'Verificando...' : 'Acessar'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================================
  // TELA AUTENTICADA: CADASTRO E ATUALIZAÇÃO
  // 1. Cadastrar Categoria
  // 2. Cadastrar Supervisor
  // 3. Cadastrar Cidades
  // 4. Liberar Eventos
  // =========================================================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-5xl max-h-[94vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-lg font-bold text-white truncate">
                  Central de Gerenciamento
                </h2>
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${
                  isMasterAdmin
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                }`}>
                  {authenticatedUser || (isMasterAdmin ? 'Administrador Master' : 'Supervisor')}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate hidden xs:block sm:block">
                Painel administrativo de liberação de eventos, cadastros e banco de dados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setIsAuthenticated(false);
                setIsMasterAdmin(false);
                setAuthenticatedUser('');
                setMasterPromptTarget(null);
                try {
                  sessionStorage.removeItem('praonde_master_0612');
                } catch {}
                onMasterAuthChange?.(false);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              title="Bloquear / Trocar de usuário"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>

            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-rose-500/20 text-slate-200 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 text-xs font-bold transition-colors cursor-pointer shrink-0"
              title="Sair e fechar painel"
            >
              <X className="w-4 h-4 text-rose-400" />
              <span>Sair</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900/60">
          
          {/* =========================================================================
              VIEW: MENU PRINCIPAL COM OS 4 BOTÕES SOLICITADOS:
              1. "Liberar Eventos"
              2. "Cadastrar Categoria" (Exclusivo Senha 0612)
              3. "Cadastrar Supervisor" (Exclusivo Senha 0612)
              4. "Cadastrar Cidades" (Exclusivo Senha 0612)
              ========================================================================= */}
          {currentView === 'menu' && (
            <div className="max-w-4xl mx-auto py-2 sm:py-4 space-y-6">
              <div className="text-center space-y-1">
                <h3 className="text-xl sm:text-2xl font-bold text-white">Central de Gerenciamento</h3>
                <p className="text-xs sm:text-sm text-slate-400">
                  Selecione uma das opções abaixo para gerenciar a plataforma:
                </p>
              </div>

              {/* OS BOTÕES PRINCIPAIS DA CENTRAL DE GERENCIAMENTO:
                  1. "Liberar Eventos"
                  2. "Cadastrar Categoria"
                  3. "Cadastrar Supervisor"
                  4. "Cadastrar Cidades"
                  5. "Console Banco SQL" (Exclusivo senha 0612)
              */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-2">
                
                {/* BOTÃO 1: LIBERAR EVENTOS */}
                <button
                  id="btn-admin-liberar-eventos"
                  onClick={() => {
                    fetchQuarantineCount();
                    if (onEventsUpdated) {
                      onEventsUpdated();
                    }
                    setCurrentView('liberar_eventos');
                  }}
                  className="group relative flex flex-col items-center text-center p-5 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-950 border border-slate-700/80 hover:border-emerald-500/60 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-200 cursor-pointer"
                >
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 group-hover:bg-emerald-500/25 transition-all mb-3 shadow-inner">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors mb-1.5">
                    Liberar Eventos
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed flex-1">
                    Aprove ou pause eventos ({totalPending} pendentes para análise, {totalApproved} liberados).
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                    <span>Acessar</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </button>

                {/* BOTÃO NOVO: IMPORTAR SYMPLA (QUARENTENA & CURADORIA) */}
                <button
                  id="btn-admin-importar-sympla"
                  onClick={() => {
                    fetchQuarantineCount();
                    setCurrentView('importar_sympla');
                  }}
                  className="group relative flex flex-col items-center text-center p-5 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-950 border border-amber-500/50 hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/15 transition-all duration-200 cursor-pointer"
                >
                  <div className="relative w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 group-hover:scale-105 group-hover:bg-amber-500/25 transition-all mb-3 shadow-inner">
                    <Download className="w-7 h-7" />
                    {quarantineCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black animate-pulse shadow-md">
                        {quarantineCount}
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors mb-1.5">
                    Importar Sympla
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed flex-1">
                    Buscar eventos por link, curadoria na quarentena e liberação no app ({quarantineCount} na quarentena).
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-2 flex-wrap w-full">
                    <div className="inline-flex items-center gap-1 text-xs font-bold text-amber-400">
                      <span>Acessar Importador</span>
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                    {quarantineCount > 0 && (
                      <button
                        type="button"
                        id="btn-admin-limpar-quarentena-rapido"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await fetch('/api/imported-events/clear', { method: 'POST' });
                            setQuarantineCount(0);
                            window.dispatchEvent(new CustomEvent('praonde:quarantine-cleared'));
                            setLiberationNotice('Quarentena esvaziada com sucesso!');
                          } catch (err) {
                            console.error('Erro ao limpar quarentena:', err);
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                        title="Esvaziar todos os registros da quarentena agora"
                      >
                        <Trash2 className="w-3 h-3 text-rose-400" />
                        <span>Limpar Quarentena</span>
                      </button>
                    )}
                  </div>
                </button>

                {/* BOTÃO NOVO: IMPORTAR TICKET360 (QUARENTENA & CURADORIA) */}
                <button
                  id="btn-admin-importar-ticket360"
                  onClick={() => {
                    fetchQuarantineCount();
                    setCurrentView('importar_ticket360');
                  }}
                  className="group relative flex flex-col items-center text-center p-5 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-950 border border-cyan-500/50 hover:border-cyan-400 hover:shadow-xl hover:shadow-cyan-500/15 transition-all duration-200 cursor-pointer"
                >
                  <div className="relative w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 group-hover:scale-105 group-hover:bg-cyan-500/25 transition-all mb-3 shadow-inner">
                    <Ticket className="w-7 h-7" />
                    {quarantineCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 px-2 py-0.5 rounded-full bg-cyan-500 text-slate-950 text-[10px] font-black animate-pulse shadow-md">
                        {quarantineCount}
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors mb-1.5">
                    Importar Ticket360
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed flex-1">
                    Buscar eventos Ticket360 por link, curadoria na quarentena e liberação no app ({quarantineCount} na quarentena).
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-2 flex-wrap w-full">
                    <div className="inline-flex items-center gap-1 text-xs font-bold text-cyan-400">
                      <span>Acessar Ticket360</span>
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  </div>
                </button>

                {/* BOTÃO 2: CADASTRAR CATEGORIA */}
                <button
                  id="btn-admin-cadastrar-categoria"
                  onClick={() => handleOpenOption('categories')}
                  className="group relative flex flex-col items-center text-center p-5 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-950 border border-slate-700/80 hover:border-indigo-500/60 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-200 cursor-pointer"
                >
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 group-hover:bg-indigo-500/25 transition-all mb-3 shadow-inner">
                    <Layers className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors mb-1.5">
                    Cadastrar Categoria
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed flex-1">
                    Crie novas categorias e gerencie as {categories.length} existentes no catálogo.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-indigo-400">
                    <span>Acessar</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </button>

                {/* BOTÃO 3: CADASTRAR SUPERVISOR */}
                <button
                  id="btn-admin-cadastrar-supervisor"
                  onClick={() => handleOpenOption('supervisors')}
                  className="group relative flex flex-col items-center text-center p-5 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-950 border border-slate-700/80 hover:border-sky-500/60 hover:shadow-xl hover:shadow-sky-500/10 transition-all duration-200 cursor-pointer"
                >
                  <div className="w-14 h-14 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:scale-105 group-hover:bg-sky-500/25 transition-all mb-3 shadow-inner">
                    <UserCheck className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-white group-hover:text-sky-300 transition-colors mb-1.5">
                    Cadastrar Supervisor
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed flex-1">
                    Cadastre responsáveis regionais e gerais ({supervisors.length} ativos).
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-sky-400">
                    <span>Acessar</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </button>

                {/* BOTÃO 4: CADASTRAR CIDADES */}
                <button
                  id="btn-admin-cadastrar-cidades"
                  onClick={() => handleOpenOption('cities')}
                  className="group relative flex flex-col items-center text-center p-5 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-950 border border-slate-700/80 hover:border-amber-500/60 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-200 cursor-pointer"
                >
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 group-hover:bg-amber-500/25 transition-all mb-3 shadow-inner">
                    <Building2 className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors mb-1.5">
                    Cadastrar Cidades
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed flex-1">
                    Adicione e organize municípios disponíveis ({cities.length} cidades).
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-amber-400">
                    <span>Acessar</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </button>

                {/* BOTÃO NOVO: FILTRO SYMPLA (BLACKLIST) */}
                <button
                  id="btn-admin-filtro-sympla"
                  onClick={() => handleOpenOption('filtro_sympla')}
                  className="group relative flex flex-col items-center text-center p-5 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-950 border border-slate-700/80 hover:border-rose-500/60 hover:shadow-xl hover:shadow-rose-500/10 transition-all duration-200 cursor-pointer"
                >
                  <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 group-hover:scale-105 group-hover:bg-rose-500/25 transition-all mb-3 shadow-inner">
                    <Ban className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-white group-hover:text-rose-300 transition-colors mb-1.5">
                    Filtro de Importação
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed flex-1">
                    Defina palavras-chave ignoradas (como palestras, cursos, etc.) para bloquear no robô da Sympla.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-rose-400">
                    <span>Configurar Filtros</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </button>

                {/* BOTÃO NOVO: DESEMPENHO E ESTATÍSTICAS */}
                <button
                  id="btn-admin-estatisticas"
                  onClick={() => setCurrentView('estatisticas')}
                  className="group relative flex flex-col items-center text-center p-5 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-950 border border-slate-700/80 hover:border-violet-500/60 hover:shadow-xl hover:shadow-violet-500/10 transition-all duration-200 cursor-pointer animate-in fade-in"
                >
                  <div className="w-14 h-14 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 group-hover:scale-105 group-hover:bg-violet-500/25 transition-all mb-3 shadow-inner">
                    <BarChart3 className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-white group-hover:text-violet-300 transition-colors mb-1.5">
                    Desempenho & Métricas
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed flex-1">
                    Monitore o total de consultas por ano, estado e mês para acompanhar o crescimento e alcance do aplicativo.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-violet-400">
                    <span>Ver Painel</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </button>

                {/* BOTÃO: ROTINA QUINZENAL & LIMPEZA DO BANCO */}
                <button
                  id="btn-admin-rotina-limpeza"
                  onClick={() => setCurrentView('rotina_limpeza')}
                  className="group relative flex flex-col items-center text-center p-5 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-950 border border-emerald-500/50 hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-500/15 transition-all duration-200 cursor-pointer animate-in fade-in"
                >
                  <div className="relative w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 group-hover:bg-emerald-500/25 transition-all mb-3 shadow-inner">
                    <CalendarCheck className="w-7 h-7" />
                    <span className="absolute -top-1.5 -right-1.5 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black shadow-md">
                      Dias 1 & 15
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors mb-1.5">
                    Rotina Quinzenal & Limpeza
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed flex-1">
                    Exclusão automática de eventos anteriores a hoje para TODAS as tabelas e reorganização geral do banco (VACUUM & REINDEX).
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                    <span>Ver Rotina & Executar</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </button>

                {/* BOTÃO NOVO: DOMÍNIO PRÓPRIO & LOCAWEB PWA */}
                <button
                  id="btn-admin-dominio-pwa"
                  onClick={() => setCurrentView('dominio_pwa')}
                  className="group relative flex flex-col items-center text-center p-5 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-950 border border-indigo-500/50 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-500/15 transition-all duration-200 cursor-pointer animate-in fade-in"
                >
                  <div className="relative w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 group-hover:bg-indigo-500/25 transition-all mb-3 shadow-inner">
                    <Globe className="w-7 h-7" />
                    <span className="absolute -top-1.5 -right-1.5 px-2 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-black shadow-md">
                      Locaweb
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors mb-1.5">
                    Domínio & Locaweb PWA
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed flex-1">
                    Baixar o arquivo index.html pronto para colocar na Locaweb (praondeeuvou.ia.br) como PWA em tela cheia.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-indigo-400">
                    <span>Ver Arquivos & Baixar</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </button>

                {/* BOTÃO 6: CONSOLE BANCO SQL (Aparece SOMENTE na senha "0612") */}
                {isMasterAdmin && (
                  <button
                    id="btn-admin-cadastrar-banco-sql"
                    onClick={() => {
                      onClose();
                      onOpenSqlConsole();
                    }}
                    className="group relative flex flex-col items-center text-center p-5 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-950 border border-amber-500/50 hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/15 transition-all duration-200 cursor-pointer animate-in fade-in"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 group-hover:bg-amber-500/25 transition-all mb-3 shadow-inner">
                      <Database className="w-7 h-7" />
                    </div>
                    <h4 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors mb-1.5">
                      Console Banco SQL
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed flex-1">
                      Consultas SQL nativas, tabelas, logs e manutenção do banco de dados praondeeu.db.
                    </p>
                    <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-amber-400">
                      <span>Acessar Console</span>
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  </button>
                )}

              </div>

              {/* Barra inferior de ferramentas e configuração de senha */}
              <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleOpenOption('passwords')}
                    className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 hover:underline cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Alterar Senha do Administrador</span>
                  </button>
                  <span>•</span>
                  <span>Banco de Dados: <code className="text-slate-300 font-mono">praondeeu.db</code></span>
                </div>

                {/* Console Banco SQL: Exclusivo Senha 0612 */}
                {isMasterAdmin && (
                  <button
                    id="btn-admin-sql-console"
                    onClick={() => {
                      onClose();
                      onOpenSqlConsole();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 border border-amber-500/40 flex items-center gap-1.5 transition-colors cursor-pointer text-xs font-semibold shadow-sm"
                    title="Console Banco SQL (Acesso Master)"
                  >
                    <Database className="w-3.5 h-3.5 text-amber-400" />
                    <span>Console Banco SQL</span>
                  </button>
                )}
              </div>

              {/* Modal de Desbloqueio com Senha "0612" */}
              {masterPromptTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
                  <div className="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-amber-400">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                          <Lock className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">Acesso Restrito</h4>
                          <p className="text-[11px] text-slate-400">Exclusivo Administrador Master</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMasterPromptTarget(null);
                          setMasterPromptPin('');
                          setMasterPromptError('');
                        }}
                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Fechar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-slate-300 leading-relaxed">
                      A opção <strong className="text-amber-300 font-semibold">{
                        masterPromptTarget === 'categories' ? 'Cadastrar Categoria' :
                        masterPromptTarget === 'supervisors' ? 'Cadastrar Supervisor' :
                        masterPromptTarget === 'cities' ? 'Cadastrar Cidades' : 'Alterar Senha'
                      }</strong> requer autorização do Administrador Geral. Digite a senha para continuar:
                    </div>

                    <form onSubmit={handleVerifyMasterPrompt} className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                          Informe a senha de acesso:
                        </label>
                        <div className="relative">
                          <input
                            type={showMasterPromptPin ? 'text' : 'password'}
                            autoFocus
                            value={masterPromptPin}
                            onChange={(e) => {
                              setMasterPromptPin(e.target.value);
                              setMasterPromptError('');
                            }}
                            placeholder="Digite a senha"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-amber-500 focus:outline-hidden font-mono tracking-widest text-center"
                          />
                          <button
                            type="button"
                            onClick={() => setShowMasterPromptPin(!showMasterPromptPin)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          >
                            {showMasterPromptPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {masterPromptError && (
                        <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{masterPromptError}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setMasterPromptTarget(null);
                            setMasterPromptPin('');
                            setMasterPromptError('');
                          }}
                          className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                        >
                          Confirmar
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              VIEW: ESTATÍSTICAS E DESEMPENHO (BI DASHBOARD)
              ========================================================================= */}
          {currentView === 'estatisticas' && (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <BarChart3 className="w-5 h-5 text-violet-400 shrink-0" />
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">Desempenho & Estatísticas de Consultas</h3>
                </div>
                <button
                  onClick={() => setCurrentView('menu')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar</span>
                </button>
              </div>

              {/* Filtros e Controles */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center gap-4 justify-between">
                <div className="text-left font-sans">
                  <h4 className="text-sm font-bold text-white">Filtros de Desempenho</h4>
                  <p className="text-xs text-slate-400">Filtre os dados para refinar os insights de captação comercial:</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto font-sans">
                  <div className="flex-1 sm:flex-initial">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ano</label>
                    <select
                      value={statsYearFilter}
                      onChange={(e) => setStatsYearFilter(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-bold focus:border-violet-500 focus:outline-none"
                    >
                      <option value="Todos">Todos os Anos</option>
                      {Array.from(new Set([new Date().getFullYear().toString(), '2026', ...statsData.map(s => String(s.ano))])).sort((a, b) => Number(b) - Number(a)).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 sm:flex-initial">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Estado</label>
                    <select
                      value={statsStateFilter}
                      onChange={(e) => setStatsStateFilter(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-bold focus:border-violet-500 focus:outline-none"
                    >
                      <option value="Todos">Todos os Estados</option>
                      <option value="SP">SP (São Paulo - Oficial)</option>
                      {Array.from(new Set(statsData.map(s => s.estado.toUpperCase()))).filter(e => e !== 'SP').map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">&nbsp;</label>
                      <button
                        onClick={fetchStats}
                        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-slate-950 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                        title="Atualizar métricas de consultas"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStats ? 'animate-spin' : ''}`} />
                        <span>Atualizar</span>
                      </button>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">&nbsp;</label>
                      <button
                        type="button"
                        onClick={handleResetStats}
                        className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                        title="Zerar métricas de consultas para iniciar a contagem a partir de 0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Zerar</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {isLoadingStats ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-3 font-sans">
                  <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
                  <p className="text-sm font-semibold">Carregando métricas e relatórios...</p>
                </div>
              ) : (
                (() => {
                  // Filtra os dados de acordo com os filtros selecionados
                  const filteredStats = statsData.filter((item) => {
                    const matchYear = statsYearFilter === 'Todos' || String(item.ano) === statsYearFilter;
                    const matchState = statsStateFilter === 'Todos' || item.estado.toUpperCase() === statsStateFilter.toUpperCase();
                    return matchYear && matchState;
                  });

                  // Cálculos de KPI
                  const totalConsultas = filteredStats.reduce((sum, item) => sum + item.total_consultas, 0);
                  
                  // Encontrar melhor mês
                  const monthTotals = Array(12).fill(0);
                  filteredStats.forEach((item) => {
                    if (item.mes >= 1 && item.mes <= 12) {
                      monthTotals[item.mes - 1] += item.total_consultas;
                    }
                  });
                  const maxMonthVal = Math.max(...monthTotals, 0);
                  const maxMonthIdx = monthTotals.indexOf(maxMonthVal);
                  const melhorMesNome = maxMonthVal > 0 ? NOME_MESES[maxMonthIdx] : 'N/A';

                  // Encontrar líder por estado
                  const stateTotals: { [key: string]: number } = {};
                  filteredStats.forEach((item) => {
                    stateTotals[item.estado] = (stateTotals[item.estado] || 0) + item.total_consultas;
                  });
                  let liderEstado = 'Nacional';
                  let maxStateVal = 0;
                  Object.entries(stateTotals).forEach(([st, val]) => {
                    if (val > maxStateVal) {
                      maxStateVal = val;
                      liderEstado = st;
                    }
                  });

                  return (
                    <div className="space-y-6 font-sans">
                      {/* Grid de KPIs / Mini Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* CARD 1: TOTAL DE CONSULTAS */}
                        <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                            <Activity className="w-6 h-6" />
                          </div>
                          <div className="text-left min-w-0">
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Pessoas que Acessaram</span>
                            <span className="block text-2xl font-black text-white leading-none mt-1">
                              {totalConsultas.toLocaleString('pt-BR')}
                            </span>
                            <span className="block text-[10px] text-emerald-400 mt-1 font-bold">✓ Dados 100% Auditados</span>
                          </div>
                        </div>

                        {/* CARD 2: MELHOR MÊS */}
                        <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <Calendar className="w-6 h-6" />
                          </div>
                          <div className="text-left min-w-0">
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Melhor Mês</span>
                            <span className="block text-base font-black text-white leading-none mt-1.5 truncate">
                              {melhorMesNome} {statsYearFilter !== 'Todos' ? statsYearFilter : ''}
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-1">
                              {maxMonthVal > 0 ? `${maxMonthVal.toLocaleString('pt-BR')} buscas` : 'Sem registros'}
                            </span>
                          </div>
                        </div>

                        {/* CARD 3: LÍDER DE BUSCAS */}
                        <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                            <Award className="w-6 h-6" />
                          </div>
                          <div className="text-left min-w-0">
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado Líder</span>
                            <span className="block text-2xl font-black text-white leading-none mt-1">
                              {liderEstado}
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-1">
                              {maxStateVal > 0 ? `${maxStateVal.toLocaleString('pt-BR')} buscas` : 'Sem registros'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Gráfico de Barras Vertical para o Histórico de Consultas (CSS Puro) */}
                      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                        <div className="flex items-center justify-between gap-3 mb-6">
                          <div className="text-left">
                            <h4 className="text-sm font-bold text-white">Evolução Mensal de Consultas</h4>
                            <p className="text-xs text-slate-400">Volume total de cliques e pesquisas no catálogo de eventos:</p>
                          </div>
                          <div className="px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[10px] font-black text-violet-400 uppercase tracking-widest">
                            {statsStateFilter === 'Todos' ? 'Nacional' : `Estado: ${statsStateFilter}`}
                          </div>
                        </div>

                        {/* As colunas do gráfico */}
                        {maxMonthVal === 0 ? (
                          <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-xs gap-2 p-6 text-center">
                            <Activity className="w-8 h-8 text-violet-400/40" />
                            <p className="font-semibold text-slate-300">Nenhuma consulta registrada até o momento.</p>
                            <p className="text-slate-500 max-w-md">O aplicativo está pronto para publicação. O volume de buscas será contabilizado automaticamente em tempo real conforme os usuários pesquisarem eventos.</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="h-48 flex items-end gap-2 sm:gap-4 border-b border-slate-800 pb-2 px-2">
                              {monthTotals.map((val, idx) => {
                                const pct = maxMonthVal > 0 ? (val / maxMonthVal) * 100 : 0;
                                return (
                                  <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                                    {/* Tooltip com valor */}
                                    <div className="absolute -top-7 scale-0 group-hover:scale-100 transition-all bg-slate-950 text-[10px] font-bold text-white px-2 py-0.5 rounded border border-slate-800 pointer-events-none z-10 whitespace-nowrap shadow-md">
                                      {val.toLocaleString('pt-BR')} buscas
                                    </div>
                                    {/* Barra com degradê violeta */}
                                    <div
                                      style={{ height: `${Math.max(pct, val > 0 ? 4 : 0)}%` }}
                                      className={`w-full rounded-t-lg bg-gradient-to-t ${val > 0 ? 'from-violet-800 via-violet-600 to-fuchsia-500 hover:from-violet-500 hover:to-fuchsia-400' : 'from-slate-850 to-slate-800'} border-t border-violet-400/40 transition-all duration-500 cursor-pointer shadow-lg`}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                            {/* Nomes dos Meses */}
                            <div className="grid grid-cols-12 gap-1 text-[9px] font-bold text-slate-400 text-center uppercase tracking-widest px-1">
                              {NOME_MESES.map((mes) => (
                                <span key={mes} className="truncate" title={mes}>
                                  {mes.substring(0, 3)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Tabela de Relatório Detalhado de Consultas */}
                      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                        <div className="text-left mb-4">
                          <h4 className="text-sm font-bold text-white">Detalhamento dos Dados de Desempenho</h4>
                          <p className="text-xs text-slate-400">Tabela de auditoria física de buscas por localidade e período:</p>
                        </div>

                        {filteredStats.length === 0 ? (
                          <div className="py-8 text-center text-slate-500 text-xs">
                            Nenhuma consulta registrada para os filtros selecionados.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                  <th className="py-3 px-4">Ano</th>
                                  <th className="py-3 px-4">Mês</th>
                                  <th className="py-3 px-4">Estado (UF)</th>
                                  <th className="py-3 px-4 text-right">Total de Consultas</th>
                                  <th className="py-3 px-4 text-right">Participação (%)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredStats.map((item, idx) => {
                                  const pctShare = totalConsultas > 0 ? (item.total_consultas / totalConsultas) * 100 : 0;
                                  return (
                                    <tr key={item.id || idx} className="border-b border-slate-800/60 hover:bg-slate-950/40 text-slate-300 font-medium">
                                      <td className="py-3 px-4 text-white font-bold">{item.ano}</td>
                                      <td className="py-3 px-4">{NOME_MESES[item.mes - 1] || item.mes}</td>
                                      <td className="py-3 px-4">
                                        <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-bold text-[10px]">
                                          {item.estado}
                                        </span>
                                      </td>
                                      <td className="py-3 px-4 text-right text-white font-bold">{item.total_consultas.toLocaleString('pt-BR')}</td>
                                      <td className="py-3 px-4 text-right text-violet-400 font-bold">{pctShare.toFixed(1)}%</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* =========================================================================
              VIEW 1: CADASTRAR CATEGORIA
              ========================================================================= */}
          {currentView === 'categories' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <Layers className="w-5 h-5 text-indigo-400 shrink-0" />
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">Cadastrar Categoria</h3>
                </div>
                <button
                  id="btn-category-back"
                  onClick={() => setCurrentView('menu')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
                  title="Voltar ao Menu"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Voltar</span>
                </button>
              </div>

              {/* Formulário para Cadastrar Categoria */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">Adicionar Nova Categoria</h4>
                  <p className="text-xs text-slate-400">
                    A categoria cadastrada fica disponível imediatamente nos filtros e no cadastro de eventos.
                  </p>
                </div>

                <form onSubmit={handleCreateCategory} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Ex: Eletrônica & DJ, Teatro, Rock Clássico..."
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Cadastrar Categoria</span>
                  </button>
                </form>

                {categoryFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                      categoryFeedback.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}
                  >
                    {categoryFeedback.type === 'success' ? (
                      <Check className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span>{categoryFeedback.msg}</span>
                  </div>
                )}
              </div>

              {/* Lista de Categorias Ativas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-white">
                    Categorias Cadastradas ({categories.length})
                  </span>
                  <span>Clique na lixeira para excluir</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {categories.map((cat) => {
                    const eventCount = events.filter((e) => e.category === cat).length;
                    const catObj = categoryItems.find((c) => c.nome.toLowerCase() === cat.toLowerCase());
                    return (
                      <div
                        key={cat}
                        className="bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex items-center justify-between gap-2 transition-all"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {catObj?.id && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                ID {catObj.id}
                              </span>
                            )}
                            <span className="font-bold text-white text-xs truncate">{cat}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {eventCount} {eventCount === 1 ? 'evento vinculado' : 'eventos vinculados'}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (window.confirm(`Deseja remover a categoria "${cat}"?`)) {
                              onDeleteCategory(cat);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title={`Excluir categoria ${cat}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW 2: CADASTRAR SUPERVISOR
              ========================================================================= */}
          {currentView === 'supervisors' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCheck className="w-5 h-5 text-sky-400 shrink-0" />
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">Cadastrar & Atualizar Supervisor</h3>
                </div>
                <button
                  id="btn-supervisors-back"
                  onClick={() => setCurrentView('menu')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
                  title="Voltar ao Menu"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />
                  <span>Voltar</span>
                </button>
              </div>

              {/* Formulário de Cadastro e Atualização de Supervisor */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                      <span>{editingSupervisorId ? 'Atualizar Supervisor' : 'Novo Supervisor'}</span>
                      {editingSupervisorId && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Modo Edição
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {editingSupervisorId 
                        ? 'Atualize o nome, email, telefone ou redefina a senha de acesso deste supervisor.' 
                        : 'Cadastre os dados e a senha de acesso do supervisor para conferência e validação.'}
                    </p>
                  </div>
                  {editingSupervisorId && (
                    <button
                      type="button"
                      onClick={handleCancelEditSupervisor}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                    >
                      Cancelar Edição
                    </button>
                  )}
                </div>

                <form onSubmit={handleCreateSupervisor} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Nome Completo *</label>
                      <input
                        type="text"
                        value={supName}
                        onChange={(e) => setSupName(e.target.value)}
                        placeholder="Ex: Carlos Alberto da Silva"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        {editingSupervisorId ? 'Nova Senha de Acesso (ou mantenha atual)' : 'Senha de Acesso (para entrar na administração)'}
                      </label>
                      <div className="relative">
                        <input
                          type={showSupPassword ? 'text' : 'password'}
                          value={supPassword}
                          onChange={(e) => setSupPassword(e.target.value)}
                          placeholder={editingSupervisorId ? 'Digite para alterar a senha' : 'Ex: 123456'}
                          className="w-full pl-3 pr-9 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSupPassword(!showSupPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          {showSupPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail de Contato *</label>
                      <input
                        type="email"
                        value={supEmail}
                        onChange={(e) => setSupEmail(e.target.value)}
                        placeholder="Ex: supervisor@praonde.com"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Telefone / WhatsApp</label>
                      <input
                        type="text"
                        value={supPhone}
                        onChange={(e) => setSupPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Cidade de Atuação</label>
                      <input
                        type="text"
                        value={supCity}
                        onChange={(e) => setSupCity(e.target.value)}
                        placeholder="Ex: São Paulo"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Nível / Função</label>
                      <select
                        value={supRole}
                        onChange={(e) => setSupRole(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="geral">Supervisor Geral</option>
                        <option value="regional">Supervisor Regional</option>
                        <option value="financeiro">Conferência / Financeiro</option>
                      </select>
                    </div>
                  </div>

                  {supFeedback && (
                    <div
                      className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                        supFeedback.type === 'success'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}
                    >
                      {supFeedback.type === 'success' ? (
                        <Check className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      )}
                      <span>{supFeedback.msg}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    {editingSupervisorId && (
                      <button
                        type="button"
                        onClick={handleCancelEditSupervisor}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="submit"
                      className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all cursor-pointer ${
                        editingSupervisorId
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/20'
                          : 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/20'
                      }`}
                    >
                      {editingSupervisorId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      <span>{editingSupervisorId ? 'Salvar Atualização' : 'Cadastrar Supervisor'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Lista de Supervisores */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <span className="font-semibold text-white text-xs">
                    Supervisores Cadastrados ({supervisors.length})
                  </span>

                  <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={supSearchQuery}
                      onChange={(e) => setSupSearchQuery(e.target.value)}
                      placeholder="Buscar supervisor..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {filteredSupervisors.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800">
                      Nenhum supervisor encontrado.
                    </div>
                  ) : (
                    filteredSupervisors.map((sup) => (
                      <div
                        key={sup.id}
                        className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 flex-shrink-0">
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {sup.dbId && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                  ID {sup.dbId}
                                </span>
                              )}
                              <span className="font-bold text-white text-xs truncate">{sup.name}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                {sup.role === 'geral' ? 'Geral' : sup.role === 'regional' ? 'Regional' : 'Financeiro'}
                              </span>
                              {sup.senha && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                  <Key className="w-2.5 h-2.5" />
                                  <span>Senha</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                              <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-500" />{sup.email}</span>
                              {sup.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-500" />{sup.phone}</span>}
                              {sup.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-500" />{sup.city} - {sup.state}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={() => handleStartEditSupervisor(sup)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition-colors cursor-pointer"
                            title="Editar dados e senha do supervisor"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleSupervisorStatus(sup.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                              sup.status === 'ativo'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {sup.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </button>

                          <button
                            onClick={() => handleDeleteSupervisor(sup.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Remover supervisor"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW 3: CADASTRAR CIDADES
              ========================================================================= */}
          {currentView === 'cities' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="w-5 h-5 text-amber-400 shrink-0" />
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">Cidades do Estado de São Paulo (SP)</h3>
                </div>
                <button
                  id="btn-cities-back"
                  onClick={() => setCurrentView('menu')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
                  title="Voltar ao Menu"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
                  <span>Voltar</span>
                </button>
              </div>

              {/* Formulário para Cadastrar Cidade */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">Adicionar Nova Cidade Paulista</h4>
                  <p className="text-xs text-slate-400">
                    Cadastre novos municípios do Estado de São Paulo para organização dos eventos no catálogo e no mapa.
                  </p>
                </div>

                <form onSubmit={handleCreateCity} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Nome da Cidade *</label>
                      <input
                        type="text"
                        value={newCityName}
                        onChange={(e) => setNewCityName(e.target.value)}
                        placeholder="Ex: Ribeirão Preto"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Estado (UF) *</label>
                      <select
                        value={newCityState}
                        onChange={(e) => setNewCityState(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-amber-300 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="SP">SP - São Paulo (Exclusivo)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Região de SP</label>
                      <select
                        value={newCityRegion}
                        onChange={(e) => setNewCityRegion(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="Capital">Capital (São Paulo)</option>
                        <option value="Grande São Paulo">Grande São Paulo / ABC</option>
                        <option value="Baixada Santista">Baixada Santista / Litoral</option>
                        <option value="Campinas e Região">Campinas e Região</option>
                        <option value="Interior Paulista">Interior Paulista</option>
                        <option value="Vale do Paraíba">Vale do Paraíba</option>
                      </select>
                    </div>
                  </div>

                  {cityFeedback && (
                    <div
                      className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                        cityFeedback.type === 'success'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}
                    >
                      {cityFeedback.type === 'success' ? (
                        <Check className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      )}
                      <span>{cityFeedback.msg}</span>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Cadastrar Cidade</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Lista de Cidades */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-xs">
                      Cidades Cadastradas ({cities.length})
                    </span>
                    {cities.length > 0 && (
                      <button
                        type="button"
                        onClick={handleDeleteAllCities}
                        className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline font-medium cursor-pointer ml-1"
                        title="Excluir todas as cidades da tabela"
                      >
                        Excluir Todas
                      </button>
                    )}
                  </div>

                  <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={citySearchQuery}
                      onChange={(e) => setCitySearchQuery(e.target.value)}
                      placeholder="Buscar cidade..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {cities.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/40 border border-slate-800/80 rounded-xl text-slate-400 text-xs">
                    Nenhum registro cadastrado na tabela de estado no momento. Utilize o formulário acima para cadastrar novas cidades/estados.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {filteredCities.map((c) => {
                      const eventCount = events.filter((e) => e.city.toLowerCase() === c.name.toLowerCase()).length;
                      return (
                        <div
                          key={c.id}
                          className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex items-center justify-between gap-2 transition-all"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-xs truncate">{c.name}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                                {c.state}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {c.region || 'Brasil'} • {eventCount} {eventCount === 1 ? 'evento' : 'eventos'}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleCityActive(c.id)}
                              className={`p-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                                c.active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-500 hover:bg-slate-800'
                              }`}
                              title={c.active ? 'Cidade ativa' : 'Cidade inativa'}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteCity(c.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title={`Excluir cidade ${c.name}`}
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
            </div>
          )}

          {/* =========================================================================
              VIEW 4: LIBERAR EVENTOS
              ========================================================================= */}
          {currentView === 'liberar_eventos' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-white truncate">Liberar Eventos</h3>
                    <p className="text-xs text-slate-400 hidden sm:block">
                      Fila de análise e moderação • Clique em qualquer item do grid para visualizar a imagem e definir se a publicação será liberada
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {/* Botão para Liberar Todos os Eventos (somente se houver pendentes) */}
                  {totalPending > 0 && (
                    <button
                      id="btn-liberar-todos-eventos"
                      onClick={() => handleLiberateAllEvents(false)}
                      disabled={isLiberatingAll || isDeletingBatch}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                      title="Liberar todos os eventos da quarentena e catálogo oficial (define campo liberado = 'S')"
                    >
                      {isLiberatingAll ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Liberando Todos...</span>
                        </>
                      ) : (
                        <>
                          <CheckCheck className="w-4 h-4 text-emerald-200" />
                          <span>Liberar Todos os Eventos ({totalPending} pendentes)</span>
                        </>
                      )}
                    </button>
                  )}



                  {/* Botão Limpar Todos os Eventos */}
                  {(events.length > 0 || totalQuarantine > 0) && (
                    <button
                      id="btn-limpar-todos-eventos"
                      type="button"
                      onClick={() => setConfirmDeleteScope('all')}
                      disabled={isLiberatingAll || isDeletingBatch}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                      title="Excluir todos os registros de eventos do banco de dados (limpeza total)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Limpar Todos ({events.length + totalQuarantine})</span>
                    </button>
                  )}

                  {selectedCategoryForLiberation !== 'Todas' && (
                    <button
                      id="btn-liberar-categoria-atual"
                      onClick={() => handleLiberateAllEvents(true)}
                      disabled={isLiberatingAll || isDeletingBatch}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                      title={`Liberar todos os eventos da categoria "${selectedCategoryForLiberation}"`}
                    >
                      <Check className="w-3.5 h-3.5 text-slate-950" />
                      <span>Liberar Cat. "{selectedCategoryForLiberation}"</span>
                    </button>
                  )}

                  <button
                    id="btn-recarregar-firestore"
                    type="button"
                    onClick={async () => {
                      setIsLoadingEvents(true);
                      try {
                        const res = await fetch('/api/admin/sync-from-firestore', { method: 'POST' });
                        const data = await res.json();
                        setLiberationNotice(`Banco recarregado com sucesso! ${data.count || data.totalInDb} eventos ativos.`);
                        setTimeout(() => setLiberationNotice(''), 4500);
                        await fetchEventsFromApi();
                        if (onEventsUpdated) onEventsUpdated();
                      } catch {
                        setLiberationNotice('Erro ao sincronizar eventos do Firestore.');
                        setTimeout(() => setLiberationNotice(''), 3500);
                      } finally {
                        setIsLoadingEvents(false);
                      }
                    }}
                    disabled={isLoadingEvents}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 text-xs font-semibold border border-amber-500/40 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm disabled:opacity-50"
                    title="Recarrega todos os 198 eventos salvos no Firestore diretamente para o banco SQLite"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEvents ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
                    <span>Recarregar do Firestore</span>
                  </button>

                  <button
                    id="btn-atualizar-lista-eventos"
                    type="button"
                    onClick={fetchEventsFromApi}
                    disabled={isLoadingEvents}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm disabled:opacity-50"
                    title="Recarregar e atualizar todos os eventos do banco de dados SQLite"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEvents ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
                    <span>Atualizar Lista</span>
                  </button>

                  <button
                    id="btn-liberar-back"
                    onClick={() => setCurrentView('menu')}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
                    title="Voltar ao Menu"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Voltar</span>
                  </button>
                </div>
              </div>

              {/* Confirmação de Exclusão em Lote */}
              {confirmDeleteScope && (
                <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                    <div>
                      <p className="font-bold text-white text-sm">
                        {confirmDeleteScope === 'pending'
                          ? `Excluir todos os ${totalPending} eventos pendentes?`
                          : confirmDeleteScope === 'filtered'
                          ? `Excluir os ${filteredEventsForLiberation.length} eventos filtrados desta tabela?`
                          : `ATENÇÃO: Deseja EXCLUIR TODOS os ${events.length} eventos do banco de dados?`}
                      </p>
                      <p className="text-[11px] text-rose-300/80">
                        {confirmDeleteScope === 'pending'
                          ? 'Os eventos não liberados serão removidos definitivamente do catálogo e do banco de dados.'
                          : 'Esta ação não poderá ser desfeita e removerá os eventos de forma permanente.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteScope(null)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteEventsBatch(confirmDeleteScope)}
                      disabled={isDeletingBatch}
                      className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/30 cursor-pointer disabled:opacity-50"
                    >
                      {isDeletingBatch ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      <span>Confirmar Exclusão</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Mensagem de Feedback de Liberação */}
              {liberationNotice && (
                <div
                  id="msg-liberation-feedback"
                  className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{liberationNotice}</span>
                </div>
              )}

              {/* Status Counters & Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-400 mr-1">Filtro:</span>
                  
                  <button
                    onClick={() => setEventFilterStatus('pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      eventFilterStatus === 'pending'
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 ring-2 ring-amber-500/40'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Pendentes ({totalPending})</span>
                  </button>

                  <button
                    onClick={() => setEventFilterStatus('quarentena')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      eventFilterStatus === 'quarentena'
                        ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-500/40 font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span>Quarentena ({totalQuarantine})</span>
                  </button>

                  <button
                    onClick={() => setEventFilterStatus('approved')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      eventFilterStatus === 'approved'
                        ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-500/40'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Já Liberados (S) ({totalApproved})</span>
                  </button>

                  <button
                    onClick={() => setEventFilterStatus('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      eventFilterStatus === 'all'
                        ? 'bg-slate-700 text-white ring-2 ring-slate-600'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    Todos ({events.length + totalQuarantine})
                  </button>
                </div>

                {selectedCategoryForLiberation !== 'Todas' && (
                  <button
                    onClick={() => setSelectedCategoryForLiberation('Todas')}
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1.5 cursor-pointer font-medium"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Limpar Filtro ({selectedCategoryForLiberation})</span>
                  </button>
                )}
              </div>

              {/* Grid da Tabela de Categorias */}
              <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <LayoutGrid className="w-4 h-4 text-amber-400" />
                    <span>Grid de Categorias</span>
                    <span className="text-slate-400 font-normal hidden sm:inline">
                      (Clique para filtrar os eventos pendentes por categoria)
                    </span>
                  </div>
                  {selectedCategoryForLiberation !== 'Todas' && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                      Ativa: {selectedCategoryForLiberation}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {/* Card "Todas as Categorias" */}
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryForLiberation('Todas')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      selectedCategoryForLiberation === 'Todas'
                        ? 'bg-amber-500/15 border-amber-500 text-white shadow-md shadow-amber-500/10 ring-2 ring-amber-500/40'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-bold font-mono text-amber-400/90 uppercase">TODAS</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-semibold">
                        {totalPending} pend.
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white truncate">Todas as Categorias</div>
                    <div className="text-[10px] text-slate-400 mt-1">{totalPending} pendentes</div>
                  </button>

                  {/* Cards de cada Categoria */}
                  {allCategoriesForLiberation.map((cat) => {
                    const isSelected = selectedCategoryForLiberation.toLowerCase().trim() === cat.name.toLowerCase().trim();
                    const currentEventList = localEvents.length > 0 ? localEvents : events;
                    const catEvents = currentEventList.filter((e) => (e.category || '').toLowerCase().trim() === cat.name.toLowerCase().trim());
                    const catQuarantine = quarantineEvents.filter((q) => (q.category || '').toLowerCase().trim() === cat.name.toLowerCase().trim());
                    const pendingCount = catEvents.filter((e) => e.liberado !== 'S').length + catQuarantine.length;

                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => setSelectedCategoryForLiberation(isSelected ? 'Todas' : cat.name)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/40'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                        }`}
                        title={cat.name}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <Tag className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                          {pendingCount > 0 ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30" title={`${pendingCount} pendente(s)`}>
                              {pendingCount} pend.
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                              0 pend.
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-bold text-white truncate" title={cat.name}>
                          {cat.name}
                        </div>

                        <div className="text-[10px] text-slate-500 mt-1 truncate">
                          {pendingCount} para liberar
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tabela de Eventos */}
              {filteredEventsForLiberation.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-xl border border-slate-800 bg-slate-950/40 text-slate-400 text-xs space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="font-medium text-slate-200">
                    {selectedCategoryForLiberation !== 'Todas'
                      ? `Nenhum evento encontrado na categoria "${selectedCategoryForLiberation}" com o status selecionado.`
                      : 'Nenhum evento encontrado para o status selecionado.'}
                  </div>
                  {eventFilterStatus === 'pending' && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[11px] text-slate-400">
                        Não há eventos pendentes de liberação no catálogo. Todos os eventos estão liberados!
                      </p>
                      <button
                        type="button"
                        onClick={() => setEventFilterStatus('approved')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow cursor-pointer"
                      >
                        <span>Ver Tabela de Eventos Liberados</span>
                      </button>
                    </div>
                  )}
                  {selectedCategoryForLiberation !== 'Todas' && (
                    <button
                      onClick={() => setSelectedCategoryForLiberation('Todas')}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Exibir Todas as Categorias
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                  <div className="px-3 py-2 bg-slate-900/70 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5 font-medium text-slate-300">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Dica: <strong>Clique em qualquer linha</strong> ou no botão <strong>Analisar & Liberar</strong> para inspecionar a imagem do evento e definir a liberação.</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {filteredEventsForLiberation.length} {filteredEventsForLiberation.length === 1 ? 'evento' : 'eventos'}
                      </span>
                      {filteredEventsForLiberation.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteScope('filtered')}
                          disabled={isDeletingBatch}
                          className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-semibold flex items-center gap-1 border border-rose-500/30 cursor-pointer transition-colors"
                          title="Excluir todos os eventos desta listagem atual"
                        >
                          <Trash2 className="w-3 h-3 text-rose-400" />
                          <span>Excluir estes</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-3">Imagem & Evento</th>
                        <th className="py-3 px-3">Categoria (Trazer Grid)</th>
                        <th className="py-3 px-3">Cidade/Local</th>
                        <th className="py-3 px-3">Data/Hora</th>
                        <th className="py-3 px-3 text-center">Liberar no App</th>
                        <th className="py-3 px-3 text-right">Análise & Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {filteredEventsForLiberation.map((evt) => {
                        const isApproved = evt.liberado === 'S';
                        const isRejected = evt.liberado === 'N';
                        const isBlank = !evt.liberado || evt.liberado === '';

                        return (
                          <tr 
                            key={evt.id} 
                            onClick={() => setSelectedEventForAnalysis(evt)}
                            className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                            title="Clique para analisar imagem e definir liberação"
                          >
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0 border border-slate-700 group-hover:border-amber-400/50 transition-colors">
                                  <img
                                    src={evt.imageUrl}
                                    alt={evt.title}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                  {evt.videoUrl && (
                                    <div className="absolute bottom-0 right-0 p-0.5 rounded-tl bg-slate-950/90 text-amber-400">
                                      <Play className="w-2.5 h-2.5 fill-amber-400" />
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                    <Eye className="w-4 h-4" />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-white max-w-[200px] truncate group-hover:text-amber-300 transition-colors">
                                      {evt.title}
                                    </span>
                                    {evt.videoUrl && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 shrink-0 flex items-center gap-1">
                                        <Play className="w-2 h-2 fill-purple-300" /> Vídeo
                                      </span>
                                    )}
                                    {evt.tags?.includes('Ticket360') && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shrink-0 flex items-center gap-1">
                                        <Ticket className="w-2.5 h-2.5" /> Ticket360
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400 truncate max-w-[200px] flex items-center gap-2 mt-0.5">
                                    <span className="truncate">{evt.organizer || 'Sem organizador'}</span>
                                    {evt.isQuarantine && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSaveLiberation(evt.id, 'N');
                                        }}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white border border-rose-500/40 transition-colors cursor-pointer shrink-0"
                                        title="Cancelar e excluir este registro da lista de quarentena"
                                      >
                                        <Trash2 className="w-2.5 h-2.5 text-rose-400" />
                                        <span>Cancelar (Excluir)</span>
                                      </button>
                                    )}
                                  </div>

                                  {/* Mobile-friendly action buttons placed directly below the title (Request 4 & 2) */}
                                  <div className="flex flex-col gap-1.5 mt-2.5">
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSaveLiberation(evt.id, 'S');
                                        }}
                                        title="Liberar Evento: atualiza o campo liberado com 'S' e publica no aplicativo"
                                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                                          isApproved
                                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                                            : 'bg-slate-900/80 text-slate-400 hover:text-emerald-400 border-slate-800 hover:border-emerald-500/30'
                                        }`}
                                      >
                                        <Check className="w-3.5 h-3.5 shrink-0" />
                                        <span>Liberar</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSaveLiberation(evt.id, 'N');
                                        }}
                                        title="Cancelar e excluir este evento da lista de liberação"
                                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                                          isRejected
                                            ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                                            : 'bg-slate-900/90 text-slate-400 hover:text-rose-400 border-slate-800 hover:border-rose-500/30'
                                        }`}
                                      >
                                        <X className="w-3.5 h-3.5 shrink-0" />
                                        <span>Cancelar</span>
                                      </button>
                                    </div>

                                    {/* Select de Categoria (Dropbox) abaixo de Liberar e Cancelar */}
                                    <div 
                                      className="relative inline-flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-[10px] font-bold text-amber-300 shadow-sm hover:bg-slate-800 transition-colors w-fit min-w-[130px]"
                                      onClick={(e) => e.stopPropagation()} // Impede abrir o modal de análise ao clicar na área do select
                                    >
                                      <Tag className="w-3 h-3 text-amber-400 shrink-0" />
                                      <select
                                        value={evt.category || ''}
                                        onChange={async (e) => {
                                          const newCat = e.target.value;
                                          if (!newCat || newCat === evt.category) return;
                                          const catObj = allCategoriesForLiberation.find((c) => c.name.toLowerCase() === newCat.toLowerCase());
                                          const success = await handleUpdateCategoryInAnalysis(evt.id, newCat, catObj?.id);
                                          if (success) {
                                            // Atualiza localmente no estado
                                            setLocalEvents((prev) =>
                                              prev.map((item) => item.id === evt.id ? { ...item, category: newCat } : item)
                                            );
                                            await fetchEventsFromApi();
                                          }
                                        }}
                                        className="bg-transparent text-amber-300 font-bold focus:outline-none cursor-pointer w-full text-left py-0.5 text-[10px] pr-1"
                                      >
                                        <option value="" disabled className="bg-slate-900 text-slate-400">
                                          Categoria...
                                        </option>
                                        {allCategoriesForLiberation.map((cat) => (
                                          <option key={cat.name} value={cat.name} className="bg-slate-900 text-white text-[11px]">
                                            {cat.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-xs bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700 min-w-[70px] text-center truncate" title={evt.category}>
                                  {evt.category}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEventForAnalysis(evt);
                                  }}
                                  className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-1 cursor-pointer shadow-sm shrink-0"
                                  title="Grid de Categorias: clique para abrir e escolher a categoria do evento"
                                >
                                  <LayoutGrid className="w-3.5 h-3.5 text-indigo-400" />
                                  <span>Grid</span>
                                </button>
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <div className="text-white font-medium">{evt.city}</div>
                              <div className="text-[10px] text-slate-400 max-w-[150px] truncate">{evt.locationName}</div>
                            </td>

                            <td className="py-3 px-3">
                              <div className="text-white font-mono">{evt.date}</div>
                              <div className="text-[10px] text-slate-400">{evt.time}</div>
                            </td>

                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveLiberation(evt.id, 'S');
                                  }}
                                  title="Liberar Evento: atualiza o campo liberado com 'S' e publica no aplicativo"
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                                    isApproved
                                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/20 active:scale-95'
                                      : 'bg-slate-900/80 text-slate-400 hover:text-emerald-400 border-slate-800 hover:border-emerald-500/40'
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5 shrink-0" />
                                  <span>Liberar Evento</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveLiberation(evt.id, 'N');
                                  }}
                                  title="Cancelar/Recusar Evento: cancela e exclui o evento da lista de liberação"
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                                    isRejected
                                      ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-500/20 active:scale-95'
                                      : 'bg-slate-900/80 text-slate-400 hover:text-rose-400 border-slate-800 hover:border-rose-500/40'
                                  }`}
                                >
                                  <X className="w-3.5 h-3.5 shrink-0" />
                                  <span>Cancelar Evento</span>
                                </button>
                              </div>
                            </td>

                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEventForAnalysis(evt);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                                  title="Analisar Imagem e Definir Liberação"
                                >
                                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Analisar</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (evt.isQuarantine) {
                                      try {
                                        await fetch(`/api/imported-events/${evt.id}`, { method: 'DELETE' });
                                        setQuarantineEvents((prev) => prev.filter((q) => q.id !== evt.id));
                                        setQuarantineCount((prev) => Math.max(0, prev - 1));
                                        setLiberationNotice(`Evento da quarentena "${evt.title}" excluído.`);
                                        setTimeout(() => setLiberationNotice(''), 3500);
                                        await fetchEventsFromApi();
                                        if (onEventsUpdated) onEventsUpdated();
                                      } catch (err) {
                                        console.error('Erro ao excluir item da quarentena:', err);
                                      }
                                    } else {
                                      // Filtro otimista instantâneo na UI
                                      setLocalEvents((prev) => prev.filter((e) => e.id !== evt.id));
                                      onDeleteEvent(evt.id);
                                      setLiberationNotice(`Evento "${evt.title}" excluído.`);
                                      setTimeout(() => setLiberationNotice(''), 3500);
                                      // Sincroniza logo em seguida
                                      setTimeout(async () => {
                                        await fetchEventsFromApi();
                                        if (onEventsUpdated) onEventsUpdated();
                                      }, 300);
                                    }
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Excluir este Evento"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              VIEW: SENHAS (CONFIGURAÇÃO)
              ========================================================================= */}
          {currentView === 'passwords' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <KeyRound className="w-5 h-5 text-amber-400 shrink-0" />
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">Alterar Senha do Administrador</h3>
                </div>
                <button
                  id="btn-passwords-back"
                  onClick={() => setCurrentView('menu')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
                  title="Voltar ao Menu"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
                  <span>Voltar</span>
                </button>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">Cadastrar Nova Senha</h4>
                  <p className="text-xs text-slate-400">
                    Defina a senha de até 6 dígitos solicitada ao clicar no botão "Administração".
                  </p>
                </div>

                <form onSubmit={handleSavePassword} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Nova Senha (até 6 dígitos) *
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPin ? 'text' : 'password'}
                          maxLength={6}
                          inputMode="numeric"
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value.slice(0, 6))}
                          placeholder="Nova senha (até 6 dígitos)"
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono tracking-widest text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPin(!showNewPin)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                        >
                          {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        {newPin.length}/6 dígitos preenchidos
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Confirmar Nova Senha *
                      </label>
                      <input
                        type={showNewPin ? 'text' : 'password'}
                        maxLength={6}
                        inputMode="numeric"
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.slice(0, 6))}
                        placeholder="Repita a nova senha"
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono tracking-widest text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {pinFeedback && (
                    <div
                      className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                        pinFeedback.type === 'success'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}
                    >
                      {pinFeedback.type === 'success' ? (
                        <Check className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      )}
                      <span>{pinFeedback.msg}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleResetDefaultPin}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restaurar Senha Padrão</span>
                    </button>

                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Salvar Senha</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW: PATROCINADORES LOCAIS (R$ 100,00/MÊS)
              ========================================================================= */}
          {currentView === 'sponsors' && (
            <div className="max-w-4xl mx-auto py-2 space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setCurrentView('menu')}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>⭐ Patrocinadores em Destaque (Vitrine R$ 100,00)</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Cadastre os parceiros locais que aparecem na vitrine dos 5 mais próximos.
                    </p>
                  </div>
                </div>
              </div>

              {/* Formulário de Novo Patrocinador */}
              <div className="bg-slate-950/70 border border-amber-500/30 rounded-2xl p-5 shadow-lg">
                <h4 className="text-sm font-bold text-amber-300 mb-3 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>Cadastrar Novo Patrocinador</span>
                </h4>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!sponsorName.trim() || !sponsorPhone.trim() || !sponsorAddress.trim()) {
                      setSponsorFeedback({ type: 'error', msg: 'Preencha o nome do comércio, WhatsApp e endereço.' });
                      return;
                    }

                    const newSp: SponsorItem = {
                      id: `sp-${Date.now()}`,
                      name: sponsorName.trim(),
                      category: sponsorCategory,
                      description: sponsorDesc.trim() || 'Comércio parceiro recomendado na sua região.',
                      badge: sponsorBadge.trim() || undefined,
                      phone: sponsorPhone.replace(/\D/g, ''),
                      address: sponsorAddress.trim(),
                      city: sponsorCity.trim(),
                      state: sponsorState.trim(),
                      latitude: -23.6575 + (Math.random() - 0.5) * 0.05, // Coordenadas aproximadas
                      longitude: -46.5312 + (Math.random() - 0.5) * 0.05,
                      imageUrl: sponsorImage.trim() || 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=600&q=80',
                      monthlyFee: 100,
                      active: true,
                      createdAt: new Date().toISOString().split('T')[0],
                    };

                    const updated = [newSp, ...localSponsors];
                    setLocalSponsors(updated);
                    onUpdateSponsors?.(updated);
                    try {
                      localStorage.setItem('praonde_sponsors_v1', JSON.stringify(updated));
                    } catch {}

                    setSponsorFeedback({ type: 'success', msg: `Patrocinador "${newSp.name}" cadastrado com sucesso!` });
                    setSponsorName('');
                    setSponsorPhone('');
                    setSponsorAddress('');
                    setSponsorDesc('');
                    setSponsorBadge('');
                    setSponsorImage('');
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Nome do Comércio / Estabelecimento *
                      </label>
                      <input
                        type="text"
                        value={sponsorName}
                        onChange={(e) => setSponsorName(e.target.value)}
                        placeholder="Ex: Adega do Baile, Bar do Samba, Lava Rápido VIP..."
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Segmento / Categoria
                      </label>
                      <select
                        value={sponsorCategory}
                        onChange={(e) => setSponsorCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="Adega & Bebidas">Adega & Bebidas</option>
                        <option value="Bar & Petiscaria">Bar & Petiscaria</option>
                        <option value="Pizzaria & Lanches">Pizzaria & Lanches</option>
                        <option value="Estacionamento Seguro">Estacionamento Seguro</option>
                        <option value="Beleza & Estilo">Beleza & Estilo</option>
                        <option value="Moda & Roupas de Festa">Moda & Roupas de Festa</option>
                        <option value="Hotel & Hospedagem">Hotel & Hospedagem</option>
                        <option value="Outros">Outros Serviços</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        WhatsApp Comercial (DDD + Número) *
                      </label>
                      <input
                        type="text"
                        value={sponsorPhone}
                        onChange={(e) => setSponsorPhone(e.target.value)}
                        placeholder="11999887766"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Cidade do Estabelecimento *
                      </label>
                      <select
                        value={sponsorCity}
                        onChange={(e) => setSponsorCity(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                        required
                      >
                        <option value="">Selecione uma Cidade...</option>
                        {cities.map((c) => (
                          <option key={c.id} value={c.name} className="bg-slate-900 text-white">
                            {c.name} ({c.state})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Selo Promocional (Opcional)
                      </label>
                      <input
                        type="text"
                        value={sponsorBadge}
                        onChange={(e) => setSponsorBadge(e.target.value)}
                        placeholder="Ex: Desconto no Esquenta, Top 1"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Endereço Completo (Para cálculo de proximidade) *
                      </label>
                      <input
                        type="text"
                        value={sponsorAddress}
                        onChange={(e) => setSponsorAddress(e.target.value)}
                        placeholder="Av. Dom Pedro II, 1420 - Bairro Jardim"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Foto / Fachada (Escolher do Celular ou Link)
                      </label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="sponsor-file-input"
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold text-xs rounded-xl cursor-pointer transition-all shadow-md active:scale-95 shrink-0"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Buscar no Celular</span>
                          </label>
                          <input
                            id="sponsor-file-input"
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (!file.type.startsWith('image/')) {
                                  setSponsorFeedback({ type: 'error', msg: 'Por favor, selecione um arquivo de imagem válido (JPG, PNG, WEBP).' });
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onload = (uploadEvt) => {
                                  if (typeof uploadEvt.target?.result === 'string') {
                                    setSponsorImage(uploadEvt.target.result);
                                    setSponsorFeedback({ type: 'success', msg: 'Foto do celular carregada com sucesso!' });
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden"
                          />
                          <input
                            type="text"
                            value={sponsorImage}
                            onChange={(e) => setSponsorImage(e.target.value)}
                            placeholder="Ou cole o link da foto..."
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 min-w-0"
                          />
                        </div>

                        {/* Preview da foto se selecionada ou linkada */}
                        {sponsorImage && (
                          <div className="flex items-center gap-2.5 p-2 bg-slate-900/90 border border-amber-500/30 rounded-xl">
                            <img
                              src={sponsorImage}
                              alt="Pré-visualização da fachada"
                              className="w-12 h-12 object-cover rounded-lg border border-slate-700 shrink-0 bg-slate-800"
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-[11px] text-amber-300 font-semibold block truncate">
                                Imagem carregada pronta para salvar
                              </span>
                              <button
                                type="button"
                                onClick={() => setSponsorImage('')}
                                className="text-[10px] text-red-400 hover:text-red-300 underline font-medium mt-0.5"
                              >
                                Remover imagem
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Breve Descrição / Chamada Promocional
                    </label>
                    <textarea
                      rows={2}
                      value={sponsorDesc}
                      onChange={(e) => setSponsorDesc(e.target.value)}
                      placeholder="Cerveja trincando, combos e porções para curtir o melhor esquenta antes do baile."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                    />
                  </div>

                  {sponsorFeedback && (
                    <div
                      className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                        sponsorFeedback.type === 'success'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}
                    >
                      {sponsorFeedback.type === 'success' ? (
                        <Check className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      )}
                      <span>{sponsorFeedback.msg}</span>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Salvar Patrocinador (R$ 100/mês)</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Lista dos Patrocinadores Cadastrados */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Patrocinadores Ativos no App ({localSponsors.length})
                </h4>

                <div className="space-y-3">
                  {localSponsors.map((sp) => (
                    <div
                      key={sp.id}
                      className="flex items-center justify-between gap-3 p-3.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={sp.imageUrl}
                          alt={sp.name}
                          className="w-12 h-12 rounded-lg object-cover bg-slate-800 border border-slate-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs font-bold text-white truncate">{sp.name}</h5>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                              {sp.category}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                              R$ {sp.monthlyFee},00
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {sp.address} • {sp.city}/{sp.state} • WhatsApp: {sp.phone}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            const updated = localSponsors.filter((s) => s.id !== sp.id);
                            setLocalSponsors(updated);
                            onUpdateSponsors?.(updated);
                            try {
                              localStorage.setItem('praonde_sponsors_v1', JSON.stringify(updated));
                            } catch {}
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Remover patrocinador"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW: LIBERAR PATROCINADORES (MODERAÇÃO E ANÁLISE DE SEGURANÇA EM ATÉ 48 HORAS)
              ========================================================================= */}
          {currentView === 'liberar_patrocinadores' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              {/* Header com botões e filtros */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCurrentView('menu')}
                    className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Voltar ao Menu"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <span>Liberação de Patrocinadores Locais</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-extrabold">
                        R$ 100/mês
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Controle de segurança: Anúncios pagos via Pix passam por análise e liberação em até 48h antes de aparecer no app.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowPixConfigModal(!showPixConfigModal);
                      if (!showPixConfigModal) fetchPixConfig();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Configurar Chave Pix</span>
                  </button>

                  <button
                    onClick={fetchDbSponsors}
                    disabled={loadingDbSponsors}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingDbSponsors ? 'animate-spin' : ''}`} />
                    <span>Atualizar Lista</span>
                  </button>
                </div>
              </div>

              {/* Painel de Configuração de Chave Pix da Plataforma */}
              {showPixConfigModal && (
                <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl p-5 shadow-2xl animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                        <QrCode className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Configurações Oficiais de Pix (Recebimento de Patrocínios)</h4>
                        <p className="text-xs text-slate-400">
                          Estes dados são usados para gerar o QR Code oficial escaneável e o código Pix Copia e Cola para os comerciantes.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowPixConfigModal(false)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {pixConfigFeedback && (
                    <div className={`p-3 rounded-xl text-xs mb-4 flex items-center gap-2 ${
                      pixConfigFeedback.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                    }`}>
                      {pixConfigFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                      <span>{pixConfigFeedback.msg}</span>
                    </div>
                  )}

                  <form onSubmit={handleSavePixConfig} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Chave Pix do Recebedor (Obrigatório):
                      </label>
                      <input
                        type="text"
                        required
                        value={pixConfigForm.chavePix}
                        onChange={(e) => setPixConfigForm({ ...pixConfigForm, chavePix: e.target.value })}
                        placeholder="ex: praondeeu@gmail.com ou celular ou CPF"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Chave atual padrão: <strong>praondeeu@gmail.com</strong>
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Tipo da Chave Pix:
                      </label>
                      <select
                        value={pixConfigForm.tipoChave}
                        onChange={(e) => setPixConfigForm({ ...pixConfigForm, tipoChave: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="email">E-mail</option>
                        <option value="telefone">Telefone (com DDD)</option>
                        <option value="cpf">CPF (apenas números)</option>
                        <option value="cnpj">CNPJ (apenas números)</option>
                        <option value="aleatoria">Chave Aleatória (EVP)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Nome do Beneficiário / Titular (Máx 25 letras):
                      </label>
                      <input
                        type="text"
                        value={pixConfigForm.nomeBeneficiario}
                        onChange={(e) => setPixConfigForm({ ...pixConfigForm, nomeBeneficiario: e.target.value.toUpperCase() })}
                        placeholder="PRA ONDE EU VOU"
                        maxLength={25}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Cidade do Beneficiário (Máx 15 letras):
                      </label>
                      <input
                        type="text"
                        value={pixConfigForm.cidadeBeneficiario}
                        onChange={(e) => setPixConfigForm({ ...pixConfigForm, cidadeBeneficiario: e.target.value.toUpperCase() })}
                        placeholder="PRAIA GRANDE"
                        maxLength={15}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Token de Acesso do Mercado Pago (Opcional para conciliação automática):
                      </label>
                      <input
                        type="password"
                        value={pixConfigForm.mercadoPagoToken}
                        onChange={(e) => setPixConfigForm({ ...pixConfigForm, mercadoPagoToken: e.target.value })}
                        placeholder="APP_USR-..."
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-500 block mt-1">
                        Deixe em branco para usar o gerador oficial BACEN direto para a sua Chave Pix.
                      </span>
                    </div>

                    <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setShowPixConfigModal(false)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>

                      <button
                        type="submit"
                        disabled={savingPixConfig}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-black transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        {savingPixConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Salvar Configurações de Pix</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Feedback de Ação */}
              {sponsorLiberationFeedback && (
                <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  sponsorLiberationFeedback.type === 'success' 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  <div className="flex items-center gap-2 text-xs">
                    {sponsorLiberationFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    )}
                    <span>{sponsorLiberationFeedback.msg}</span>
                  </div>

                  {sponsorLiberationFeedback.whatsappUrl && (
                    <a
                      href={sponsorLiberationFeedback.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Avisar Anunciante no WhatsApp</span>
                    </a>
                  )}
                </div>
              )}

              {/* Filtros e Busca */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                {/* Tabs de status */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setSponsorLiberationFilter('pendente')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      sponsorLiberationFilter === 'pendente'
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Aguardando Liberação</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/40 text-current font-black">
                      {dbSponsors.filter((s) => s.liberado === 'pendente').length}
                    </span>
                  </button>

                  <button
                    onClick={() => setSponsorLiberationFilter('S')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      sponsorLiberationFilter === 'S'
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Liberados / Ativos</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/40 text-current font-black">
                      {dbSponsors.filter((s) => s.liberado === 'S' && s.active).length}
                    </span>
                  </button>

                  <button
                    onClick={() => setSponsorLiberationFilter('N')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      sponsorLiberationFilter === 'N'
                        ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Rejeitados / Pausados</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/40 text-current font-black">
                      {dbSponsors.filter((s) => s.liberado === 'N').length}
                    </span>
                  </button>

                  <button
                    onClick={() => setSponsorLiberationFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      sponsorLiberationFilter === 'all'
                        ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Todos ({dbSponsors.length})
                  </button>
                </div>

                {/* Input de busca */}
                <div className="relative min-w-[240px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={sponsorSearch}
                    onChange={(e) => setSponsorSearch(e.target.value)}
                    placeholder="Buscar por nome, cidade, protocolo..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Lista dos Patrocinadores para Moderação */}
              <div className="space-y-3">
                {(() => {
                  const filtered = dbSponsors.filter((s) => {
                    // Filtro de status
                    if (sponsorLiberationFilter !== 'all') {
                      if (sponsorLiberationFilter === 'pendente' && s.liberado !== 'pendente') return false;
                      if (sponsorLiberationFilter === 'S' && s.liberado !== 'S') return false;
                      if (sponsorLiberationFilter === 'N' && s.liberado !== 'N') return false;
                    }

                    // Filtro de busca
                    if (sponsorSearch.trim()) {
                      const q = sponsorSearch.toLowerCase();
                      const matchName = s.name.toLowerCase().includes(q);
                      const matchCity = s.city.toLowerCase().includes(q);
                      const matchProt = s.protocolo ? s.protocolo.toLowerCase().includes(q) : false;
                      const matchPhone = s.phone ? s.phone.includes(q) : false;
                      return matchName || matchCity || matchProt || matchPhone;
                    }

                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-12 text-center bg-slate-950/60 rounded-3xl border border-slate-800">
                        <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <h4 className="text-sm font-bold text-white mb-1">
                          Nenhum patrocinador encontrado neste filtro
                        </h4>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                          {sponsorLiberationFilter === 'pendente'
                            ? 'Excelente! No momento não há nenhum anúncio pendente de aprovação em 48 horas.'
                            : 'Altere o filtro acima ou pesquise por outros termos.'}
                        </p>
                      </div>
                    );
                  }

                  return filtered.map((sp) => {
                    const isProcessing = actionInProgressSponsorId === sp.id;
                    const isPending = sp.liberado === 'pendente';
                    const isApproved = sp.liberado === 'S' && sp.active;
                    const isPaid = sp.statusPagamento === 'pago';

                    return (
                      <div
                        key={sp.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                          isPending
                            ? 'bg-slate-900/90 border-amber-500/50 hover:border-amber-400 shadow-lg shadow-amber-500/5'
                            : isApproved
                            ? 'bg-slate-950 border-slate-800 hover:border-emerald-500/40'
                            : 'bg-slate-950/60 border-slate-800/80 opacity-75'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          {/* Info do Comércio */}
                          <div className="flex items-start gap-4 min-w-0 flex-1">
                            <img
                              src={sp.imageUrl}
                              alt={sp.name}
                              className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover bg-slate-800 border border-slate-700 shrink-0"
                            />

                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm sm:text-base font-bold text-white">
                                  {sp.name}
                                </h4>

                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-semibold border border-amber-500/30">
                                  {sp.category}
                                </span>

                                {/* Status de Pagamento */}
                                {isPaid ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/40 flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Pix Pago (R$ 100,00)
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                                    Pagamento Pendente
                                  </span>
                                )}

                                {/* Status de Moderação */}
                                {isPending && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/25 text-amber-300 font-black border border-amber-400/60 flex items-center gap-1 animate-pulse">
                                    <Clock className="w-3 h-3" /> Análise até 48h
                                  </span>
                                )}
                                {isApproved && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 font-black border border-emerald-400/60 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Ativo na Vitrine
                                  </span>
                                )}
                                {sp.liberado === 'N' && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40">
                                    Rejeitado / Inativo
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-slate-300 line-clamp-2">
                                {sp.description || 'Sem descrição informada.'}
                              </p>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 pt-1">
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-amber-400" />
                                  {sp.address} • {sp.city}/{sp.state}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-emerald-400" />
                                  WhatsApp: <strong>{sp.phone}</strong>
                                </span>
                                {sp.protocolo && (
                                  <span className="font-mono text-slate-400">
                                    Protocolo: <strong className="text-amber-300">{sp.protocolo}</strong>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Botões de Ação de Liberação */}
                          <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                            {/* Botão APROVAR E LIBERAR */}
                            {sp.liberado !== 'S' && (
                              <button
                                onClick={async () => {
                                  setActionInProgressSponsorId(sp.id);
                                  setSponsorLiberationFeedback(null);
                                  try {
                                    const res = await fetch(`/api/admin/sponsors/${sp.id}/liberacao`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ action: 'aprovar' }),
                                    });
                                    const data = await res.json();
                                    if (data.success) {
                                      setSponsorLiberationFeedback({
                                        type: 'success',
                                        msg: `Anúncio de "${sp.name}" foi APROVADO e LIBERADO com sucesso! Já está visível na vitrine por proximidade.`,
                                        whatsappUrl: data.whatsappNotifyUrl,
                                      });
                                      await fetchDbSponsors();
                                    }
                                  } catch (err: any) {
                                    setSponsorLiberationFeedback({
                                      type: 'error',
                                      msg: err.message || 'Erro ao aprovar patrocinador.',
                                    });
                                  } finally {
                                    setActionInProgressSponsorId(null);
                                  }
                                }}
                                disabled={isProcessing}
                                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                              >
                                {isProcessing ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                <span>Liberar Anúncio</span>
                              </button>
                            )}

                            {/* Botão REJEITAR OU PAUSAR */}
                            {sp.liberado === 'S' ? (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Deseja pausar a veiculação do anúncio "${sp.name}" na vitrine?`)) return;
                                  setActionInProgressSponsorId(sp.id);
                                  try {
                                    await fetch(`/api/admin/sponsors/${sp.id}/liberacao`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ action: 'pausar' }),
                                    });
                                    await fetchDbSponsors();
                                  } finally {
                                    setActionInProgressSponsorId(null);
                                  }
                                }}
                                disabled={isProcessing}
                                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
                              >
                                Pausar
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  const motivo = prompt('Informe o motivo da recusa cadastral (opcional):', 'Ajuste de dados ou foto');
                                  setActionInProgressSponsorId(sp.id);
                                  try {
                                    const res = await fetch(`/api/admin/sponsors/${sp.id}/liberacao`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ action: 'rejeitar', motivo }),
                                    });
                                    const data = await res.json();
                                    if (data.success) {
                                      setSponsorLiberationFeedback({
                                        type: 'success',
                                        msg: `Anúncio de "${sp.name}" marcado como rejeitado.`,
                                        whatsappUrl: data.whatsappNotifyUrl,
                                      });
                                      await fetchDbSponsors();
                                    }
                                  } finally {
                                    setActionInProgressSponsorId(null);
                                  }
                                }}
                                disabled={isProcessing}
                                className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-slate-700 hover:border-rose-500/40 transition-colors cursor-pointer"
                              >
                                Rejeitar
                              </button>
                            )}

                            {/* Botão de contato direto pelo WhatsApp */}
                            {sp.phone && (
                              <a
                                href={`https://wa.me/55${sp.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                  `Olá, ${sp.name}! Somos da equipe de moderação do aplicativo Pra onde eu vou.`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2.5 rounded-xl bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 border border-slate-700 transition-colors cursor-pointer"
                                title="Conversar com o anunciante no WhatsApp"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* VIEW: IMPORTAR SYMPLA (QUARENTENA & CURADORIA) */}
          {currentView === 'importar_sympla' && (
            <SymplaImporterView
              categories={categories}
              cities={cities}
              onBackToMenu={() => {
                fetchQuarantineCount();
                setCurrentView('menu');
              }}
              onNavigateToLiberarEventos={async (countAdded?: number) => {
                await fetchQuarantineCount();
                await fetchEventsFromApi();
                setSelectedCategoryForLiberation('Todas');
                setEventFilterStatus('pending');
                setCurrentView('liberar_eventos');
                if (typeof countAdded === 'number') {
                  if (countAdded > 0) {
                    setLiberationNotice(`${countAdded} novos eventos da Sympla adicionados à fila de liberação!`);
                  } else {
                    setLiberationNotice('Eventos da Sympla carregados na fila de liberação! Revise, altere a categoria ou libere abaixo.');
                  }
                  setTimeout(() => setLiberationNotice(''), 6000);
                }
              }}
              onEventApproved={(newEvent) => {
                fetchQuarantineCount();
                if (newEvent && onEventApproved) {
                  onEventApproved(newEvent);
                }
                if (onEventsUpdated) onEventsUpdated();
              }}
            />
          )}

          {/* VIEW: IMPORTAR TICKET360 (QUARENTENA & CURADORIA) */}
          {currentView === 'importar_ticket360' && (
            <Ticket360ImporterView
              categories={categories}
              cities={cities}
              onBackToMenu={() => {
                fetchQuarantineCount();
                setCurrentView('menu');
              }}
              onNavigateToLiberarEventos={async (countAdded?: number) => {
                await fetchQuarantineCount();
                await fetchEventsFromApi();
                setSelectedCategoryForLiberation('Todas');
                setEventFilterStatus('pending');
                setCurrentView('liberar_eventos');
                if (typeof countAdded === 'number') {
                  if (countAdded > 0) {
                    setLiberationNotice(`${countAdded} novos eventos da Ticket360 adicionados à fila de liberação!`);
                  } else {
                    setLiberationNotice('Eventos da Ticket360 carregados na fila de liberação! Revise, altere a categoria ou libere abaixo.');
                  }
                  setTimeout(() => setLiberationNotice(''), 6000);
                }
              }}
              onEventApproved={(newEvent) => {
                fetchQuarantineCount();
                if (newEvent && onEventApproved) {
                  onEventApproved(newEvent);
                }
                if (onEventsUpdated) onEventsUpdated();
              }}
            />
          )}

          {/* VIEW: FILTRO SYMPLA (PALAVRAS IGNORADAS) */}
          {currentView === 'filtro_sympla' && (
            <div className="max-w-4xl mx-auto py-2 sm:py-4 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentView('menu')}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Ban className="w-5 h-5 text-rose-500" />
                      <span>Filtro de Importação Sympla</span>
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 pl-8">
                    Evite trazer cursos, workshops, palestras e reuniões adicionando termos que serão bloqueados ao buscar ou importar eventos da Sympla.
                  </p>
                </div>
              </div>

              {/* Form de Adicionar Palavra */}
              <form onSubmit={handleAddIgnoredWord} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <h4 className="text-sm font-bold text-slate-300">Bloquear Nova Palavra ou Expressão</h4>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Ex: curso, palestra, workshop, mentoria, conferência, webinar..."
                      value={newIgnoredWord}
                      onChange={(e) => setNewIgnoredWord(e.target.value)}
                      className="w-full py-2.5 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-600/10 active:scale-95 shrink-0"
                  >
                    <Plus className="w-4 h-4 text-white" />
                    <span>Bloquear Termo</span>
                  </button>
                </div>

                {ignoredWordFeedback && (
                  <div className={`p-2.5 rounded-lg text-xs font-semibold ${
                    ignoredWordFeedback.type === 'success' 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {ignoredWordFeedback.msg}
                  </div>
                )}
              </form>

              {/* Lista de Palavras Cadastradas */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-300 flex items-center justify-between">
                  <span>Termos Bloqueados ({ignoredWords.length})</span>
                  {isLoadingIgnoredWords && <span className="text-xs text-rose-400 animate-pulse">Atualizando...</span>}
                </h4>

                {ignoredWords.length === 0 ? (
                  <div className="text-center py-8 rounded-2xl border border-dashed border-slate-800 bg-slate-900/20">
                    <Ban className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">Nenhum termo bloqueado no momento.</p>
                    <p className="text-[10px] text-slate-500 mt-1">Insira palavras acima para filtrar descrições e títulos indesejados da Sympla.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {ignoredWords.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-rose-500/30 transition-all group"
                      >
                        <span className="font-bold text-rose-300 text-xs truncate max-w-[150px]" title={item.palavra}>
                          {item.palavra}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteIgnoredWord(item.id, item.palavra)}
                          className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Remover filtro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW: ROTINA QUINZENAL & LIMPEZA DO BANCO */}
          {currentView === 'rotina_limpeza' && (
            <div className="max-w-4xl mx-auto py-2 sm:py-4 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentView('menu')}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <CalendarCheck className="w-6 h-6 text-emerald-400" />
                      <span>Rotina Quinzenal & Reorganização de Tabelas</span>
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 pl-8">
                    Exclusão automática de registros com <code className="text-emerald-300 font-mono">data_evento</code> anterior à data atual e reorganização completa (<code className="text-amber-300 font-mono">REINDEX</code> + <code className="text-amber-300 font-mono">VACUUM</code>).
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 pl-8 sm:pl-0">
                  <button
                    onClick={fetchCleanupStatus}
                    disabled={isLoadingCleanupStatus}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    title="Atualizar dados"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCleanupStatus ? 'animate-spin' : ''}`} />
                    <span>Atualizar</span>
                  </button>
                </div>
              </div>

              {/* Banner Informativo Respondendo à Dúvida do Usuário */}
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 flex items-start gap-3 shadow-lg">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">
                      Automação Total: Você NÃO precisa solicitar tabela por tabela!
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      O robô do sistema inspeciona dinamicamente <strong>todas as tabelas</strong> do banco de dados SQLite (<code className="text-emerald-300 font-mono">praondeeu.db</code>). Qualquer tabela com a coluna <code className="text-emerald-300 font-mono">data_evento</code> é processada automaticamente, sem necessidade de pedir uma a uma.
                    </p>
                  </div>
                </div>

                {/* Destaque: Horário 06h00 da manhã & Proteção eventos_categoria */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/30 flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-0.5">
                      <span className="font-bold text-blue-300">Horário Estratégico: 06h00 da Manhã</span>
                      <p className="text-slate-400 leading-relaxed">
                        Programado para rodar rigorosamente às <strong>06:00 da manhã</strong>, horário de menor fluxo com quase nenhum usuário acessando a plataforma.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-0.5">
                      <span className="font-bold text-amber-300">Tabela Protegida: eventos_categoria</span>
                      <p className="text-slate-400 leading-relaxed">
                        A tabela <code className="text-amber-200 font-mono">eventos_categoria</code> foi <strong>retirada da rotina de exclusão</strong> e fica 100% preservada.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cards de Agendamento Ativo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Rotina Quinzenal */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-emerald-500/30 relative overflow-hidden space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                      Agendamento Ativo
                    </span>
                    <span className="text-[11px] font-mono font-bold text-emerald-400">⏰ 06:00 da manhã (Fuso SP)</span>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-1.5">
                      <span>Rotina Quinzenal</span>
                      <span className="text-xs text-emerald-400 font-medium">(Todo Dia 1 e Dia 15)</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Processa todo dia 15 e todo dia 1 do mês às 06h00 da manhã. Exclui eventos passados das tabelas ativas e roda compactação e reindexação total.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300 flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Próxima execução: Dia 1 ou 15 às 06:00</span>
                  </div>
                </div>

                {/* Rotina Diária */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 relative overflow-hidden space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-wider">
                      Reforço Diário Ativo
                    </span>
                    <span className="text-[11px] font-mono font-bold text-slate-300">⏰ 06:00 da manhã (Fuso SP)</span>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-1.5">
                      <span>Rotina Diária</span>
                      <span className="text-xs text-slate-400 font-medium">(Todos os dias)</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Manutenção preventiva todos os dias às 06h00 para manter o catálogo sempre limpo e sem datas ultrapassadas.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300 flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-slate-400" />
                    <span>Garantia de eventos sempre vigentes</span>
                  </div>
                </div>
              </div>

              {/* Botões de Ação Imediata (Manual) */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-amber-400" />
                      <span>Execução Manual Imediata</span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Dispare a rotina agora mesmo para testar ou realizar manutenção sob demanda.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={isRunningCleanup}
                      onClick={() => handleRunCleanupNow('quinzenal')}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
                    >
                      {isRunningCleanup ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Processando todas as tabelas...</span>
                        </>
                      ) : (
                        <>
                          <CalendarCheck className="w-4 h-4" />
                          <span>Executar Rotina Quinzenal Agora</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={isRunningCleanup}
                      onClick={() => handleRunCleanupNow('diaria')}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <span>Executar Diária</span>
                    </button>
                  </div>
                </div>

                {cleanupNotice && (
                  <div
                    className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                      cleanupNotice.type === 'success'
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {cleanupNotice.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span>{cleanupNotice.msg}</span>
                  </div>
                )}
              </div>

              {/* Lista Dinâmica de Tabelas Gerenciadas no SQLite */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Database className="w-4 h-4 text-emerald-400" />
                      <span>Tabelas do Banco de Dados ({cleanupStatus?.monitoredTables?.filter((t: any) => t.hasDataEvento).length || '...'})</span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Tabelas com coluna <code className="text-emerald-300 font-mono">data_evento</code> processadas dinamicamente. A tabela <code className="text-amber-300 font-mono">eventos_categoria</code> está protegida.
                    </p>
                  </div>
                </div>

                {isLoadingCleanupStatus && !cleanupStatus ? (
                  <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Identificando tabelas do banco de dados...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1 max-h-64 overflow-y-auto pr-1">
                    {(cleanupStatus?.monitoredTables || [])
                      .filter((t: any) => t.hasDataEvento)
                      .map((t: any) => {
                        const isProtected = t.name === 'eventos_categoria' || t.isProtected;
                        return (
                          <div
                            key={t.name}
                            className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                              isProtected
                                ? 'bg-amber-950/20 border-amber-500/40 shadow-sm'
                                : 'bg-slate-950/70 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isProtected ? 'bg-amber-400 ring-2 ring-amber-400/30' : 'bg-emerald-400'
                                }`}
                              />
                              <div className="truncate">
                                <span className={`font-mono truncate block ${isProtected ? 'text-amber-200 font-bold' : 'text-white'}`} title={t.name}>
                                  {t.name}
                                </span>
                                {isProtected && (
                                  <span className="text-[10px] text-amber-400 font-semibold block">
                                    🛡️ Protegida da exclusão
                                  </span>
                                )}
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 ${
                                isProtected
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {t.count} reg.
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Histórico das Últimas Execuções */}
              {cleanupStatus?.history && cleanupStatus.history.length > 0 && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Histórico Recente de Execuções</span>
                  </h4>
                  <div className="divide-y divide-slate-800 max-h-56 overflow-y-auto pr-1 text-xs">
                    {cleanupStatus.history.map((h: any) => (
                      <div key={h.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                h.tipo === 'quinzenal'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : h.tipo === 'diaria'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {h.tipo}
                            </span>
                            <span className="text-white font-medium">
                              Data de corte: <code className="text-emerald-300 font-mono">{h.data_corte}</code>
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Executado em: {new Date(h.executado_em).toLocaleString('pt-BR')} • Duração: {h.duracao_ms}ms
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-emerald-400 font-bold">
                            {h.total_excluidos} excluídos
                          </span>
                          {h.reorganizado === 1 && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-bold text-slate-300 border border-slate-700">
                              REINDEX + VACUUM OK
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              VIEW: DOMÍNIO PRÓPRIO & LOCAWEB PWA (praondeeuvou.ia.br)
              ========================================================================= */}
          {currentView === 'dominio_pwa' && (
            <div className="max-w-4xl mx-auto py-2 sm:py-4 space-y-6 animate-in fade-in">
              {/* Cabeçalho */}
              <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                      <span>Publicação do Domínio & PWA na Locaweb</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Configure o domínio <strong className="text-indigo-300">praondeeuvou.ia.br</strong> para abrir o seu aplicativo como um site PWA completo.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentView('menu')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
              </div>

              {/* Informações de Integração */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">
                    Seu Domínio Registrado
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-white font-mono">praondeeuvou.ia.br</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                      Locaweb
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 pt-1">
                    O domínio onde os usuários vão entrar.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                    Link do Aplicativo na Nuvem (Google Cloud)
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-300 truncate mr-2" title="https://ais-pre-qs2o4mzsw3wxjtqbewcb3i-856757906261.us-east1.run.app">
                      ais-pre-qs2o4mzsw3wxjtqbewcb3i-...
                    </span>
                    <a
                      href="https://ais-pre-qs2o4mzsw3wxjtqbewcb3i-856757906261.us-east1.run.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1 transition-colors shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir</span>
                    </a>
                  </div>
                  <p className="text-xs text-slate-400 pt-1">
                    Servidor com banco SQLite e sincronização ativa.
                  </p>
                </div>
              </div>

              {/* Opções de Arquivo para a Locaweb */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-400" />
                  <span>Escolha como colocar na Locaweb</span>
                </h4>

                {/* OPÇÃO 1: TELA COM DOMÍNIO */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold mb-2">
                        <span>Opção 1</span>
                      </div>
                      <h5 className="text-base font-bold text-white">Tela Integrada (Mantém praondeeuvou.ia.br no PC/Android)</h5>
                      <p className="text-xs text-slate-300 mt-1 max-w-xl">
                        Mantém o endereço do seu domínio em navegadores compatíveis e redireciona automaticamente no iPhone, Safari e Instagram para evitar erro de bloqueio de cookie.
                      </p>
                    </div>

                    <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
                      <a
                        href="/api/locaweb/download"
                        download="index.html"
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>Baixar index.html</span>
                      </a>

                      <a
                        href="/site-locaweb/index.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Testar Prévia</span>
                      </a>
                    </div>
                  </div>

                  {/* Botão de Copiar Código */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Prefere colar o código direto no editor da Locaweb?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        fetch('/site-locaweb/index.html')
                          .then((r) => r.text())
                          .then((code) => {
                            navigator.clipboard.writeText(code);
                            setCopiedPwaCode(true);
                            setTimeout(() => setCopiedPwaCode(false), 3000);
                          });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedPwaCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300 font-bold">Código Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Código do Arquivo</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* OPÇÃO 2: REDIRECIONAMENTO DIRETO (RECOMENDADO) */}
                <div className="p-5 rounded-2xl bg-gradient-to-b from-indigo-950/30 to-slate-900 border-2 border-indigo-500/40 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold mb-2">
                        <span>⭐ Opção 2 (Recomendada — evita bloqueio de cookie e ativa ícone PWA)</span>
                      </div>
                      <h5 className="text-base font-bold text-white">Redirecionamento Direto para o Aplicativo</h5>
                      <p className="text-xs text-slate-300 mt-1 max-w-xl">
                        Abre o aplicativo direto sem iframe (evitando o erro de security cookie no iPhone/Instagram) e permite gravar o ícone PWA no celular em 1 toque.
                      </p>
                    </div>

                    <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
                      <a
                        href="/api/locaweb/download-direct"
                        download="index.html"
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>Baixar index.html (Direto)</span>
                      </a>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Código simples com Meta Refresh + JavaScript.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        fetch('/site-locaweb/index-redirecionamento-direto.html')
                          .then((r) => r.text())
                          .then((code) => {
                            navigator.clipboard.writeText(code);
                            setCopiedDirectCode(true);
                            setTimeout(() => setCopiedDirectCode(false), 3000);
                          });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedDirectCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300 font-bold">Código Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Código</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Passo a Passo Mastigado na Locaweb */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Passo a Passo: Como colocar o arquivo na Locaweb</span>
                </h4>

                <div className="space-y-3">
                  <div className="flex gap-3 text-xs text-slate-300">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center justify-center font-bold shrink-0">
                      1
                    </span>
                    <div>
                      <strong className="text-white">Baixe o arquivo:</strong> Clique no botão azul acima <em>"Baixar index.html (PWA)"</em>. Ele vai salvar um arquivo chamado <code className="text-indigo-300 font-mono">index.html</code> no seu computador.
                    </div>
                  </div>

                  <div className="flex gap-3 text-xs text-slate-300">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center justify-center font-bold shrink-0">
                      2
                    </span>
                    <div>
                      <strong className="text-white">Acesse sua Hospedagem na Locaweb:</strong> Entre na Central do Cliente da Locaweb com seu login e senha, clique em <strong>Hospedagem de Sites</strong> e escolha o site do domínio <strong>praondeeuvou.ia.br</strong>.
                    </div>
                  </div>

                  <div className="flex gap-3 text-xs text-slate-300">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center justify-center font-bold shrink-0">
                      3
                    </span>
                    <div>
                      <strong className="text-white">Abra o Gerenciador de Arquivos:</strong> No painel da hospedagem, clique em <strong>Gerenciador de Arquivos</strong> (ou acesse por FTP). Entre na pasta principal do site, que geralmente se chama <code className="text-amber-300 font-mono">public_html</code> (ou <code className="text-amber-300 font-mono">web</code>).
                    </div>
                  </div>

                  <div className="flex gap-3 text-xs text-slate-300">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center justify-center font-bold shrink-0">
                      4
                    </span>
                    <div>
                      <strong className="text-white">Envie o arquivo:</strong> Clique em <strong>Enviar Arquivo (Upload)</strong> e selecione o <code className="text-indigo-300 font-mono">index.html</code>. Se já existir um arquivo de boas-vindas padrão da Locaweb, pode substituir por este.
                    </div>
                  </div>

                  <div className="flex gap-3 text-xs text-slate-300">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center font-bold shrink-0">
                      ✓
                    </span>
                    <div>
                      <strong className="text-emerald-300">Tudo pronto!</strong> Agora abra seu navegador (ou no celular) e digite <strong className="text-white">praondeeuvou.ia.br</strong>. Seu aplicativo vai carregar direto!
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div />
          <div className="flex items-center gap-2">
            {currentView !== 'menu' && (
              <button
                onClick={() => setCurrentView('menu')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Menu Principal
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>

      {/* Modal de Análise e Liberação de Imagem do Evento */}
      <EventLiberationModal
        isOpen={!!selectedEventForAnalysis}
        event={selectedEventForAnalysis}
        categories={categories}
        categoryItems={localCategoryItems}
        onClose={() => setSelectedEventForAnalysis(null)}
        onSaveLiberation={handleSaveLiberation}
        onUpdateCategory={handleUpdateCategoryInAnalysis}
        onUpdateUrl={handleUpdateUrlInAnalysis}
        onNextEvent={handleNextAnalysis}
        onPrevEvent={handlePrevAnalysis}
        hasPrev={hasPrevAnalysis}
        hasNext={hasNextAnalysis}
        currentIndex={currentIndexInAnalysis}
        totalPending={filteredEventsForLiberation.length}
      />
    </div>
  );
};
