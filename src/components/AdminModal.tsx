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
  Ban
} from 'lucide-react';
import { EventItem, Advertiser, Supervisor, CityItem, CategoryItem } from '../types';
import { SponsorItem } from '../data/sponsors';
import { EventLiberationModal } from './EventLiberationModal';

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
  onSetLiberado?: (id: string, liberado: 'S' | 'N') => Promise<void> | void;
  onSelectEvent: (event: EventItem) => void;
  onOpenSqlConsole: () => void;
  isMasterAdminState?: boolean;
  onMasterAuthChange?: (isMaster: boolean) => void;
  sponsors?: SponsorItem[];
  onUpdateSponsors?: (sponsors: SponsorItem[]) => void;
}

const ADMIN_PIN_KEY = 'praonde_admin_pin';
const SUPERVISORS_STORAGE_KEY = 'praonde_supervisors_v1';
const CITIES_STORAGE_KEY = 'praonde_cities_v1';
const INITIAL_PIN = '0612';

// As views principais da central de gerenciamento
type AdminPageView = 
  | 'menu' 
  | 'passwords' 
  | 'categories' 
  | 'supervisors' 
  | 'cities' 
  | 'sponsors'
  | 'liberar_patrocinadores'
  | 'liberar_eventos';

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
}) => {
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

  // State for "Liberar Eventos" - por padrão exibe somente registros se o campo liberado estiver em branco
  const [eventFilterStatus, setEventFilterStatus] = useState<'blank' | 'rejected' | 'approved' | 'all'>('blank');
  const [selectedCategoryForLiberation, setSelectedCategoryForLiberation] = useState<string>('Todas');
  const [selectedEventForAnalysis, setSelectedEventForAnalysis] = useState<EventItem | null>(null);

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
      fetchDbSponsors();
    }
  }, [isOpen]);

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
    fetchSupervisorsFromDb();
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
      setEventFilterStatus('all');
    }
  }, [isOpen]);

  // Categorias disponíveis para o Grid de Liberar Eventos
  const allCategoriesForLiberation = useMemo(() => {
    const list: { id?: number; name: string }[] = [];
    const added = new Set<string>();

    categoryItems.forEach((ci) => {
      const trimmed = (ci.nome || '').trim();
      if (trimmed && !added.has(trimmed.toLowerCase())) {
        added.add(trimmed.toLowerCase());
        list.push({ id: ci.id, name: trimmed });
      }
    });

    categories.forEach((cat) => {
      const trimmed = (cat || '').trim();
      if (trimmed && !added.has(trimmed.toLowerCase())) {
        added.add(trimmed.toLowerCase());
        list.push({ name: trimmed });
      }
    });

    events.forEach((evt) => {
      const trimmed = (evt.category || '').trim();
      if (trimmed && !added.has(trimmed.toLowerCase())) {
        added.add(trimmed.toLowerCase());
        list.push({ name: trimmed });
      }
    });

    return list;
  }, [categories, categoryItems, events]);

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
  const handleCreateCity = (e: React.FormEvent) => {
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

    const newCity: CityItem = {
      id: `city-${Date.now()}`,
      name: trimmed,
      state: newCityState,
      region: newCityRegion,
      active: true,
    };

    setCities((prev) => [newCity, ...prev]);
    setCityFeedback({ type: 'success', msg: `Cidade "${trimmed} - ${newCityState}" cadastrada com sucesso!` });
    setNewCityName('');
  };

  const handleDeleteCity = (id: string) => {
    const target = cities.find((c) => c.id === id);
    if (!target) return;
    if (window.confirm(`Deseja remover a cidade "${target.name} - ${target.state}"?`)) {
      setCities((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const handleToggleCityActive = (id: string) => {
    setCities((prev) =>
      prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c))
    );
  };

  // Categorias disponíveis para o Grid de Liberar Eventos já calculadas no topo

  // Counts for Event Liberation - pendentes são os eventos com campo liberar igual a "" ou "N"
  const totalPending = events.filter((e) => !e.liberado || e.liberado === '' || e.liberado === 'N').length;
  const totalApproved = events.filter((e) => e.liberado === 'S').length;

  // Filtered events for "Liberar Eventos"
  // Por padrão (eventFilterStatus === 'pending') traz apenas os eventos com o campo liberar igual "" ou "N"
  const filteredEventsForLiberation = events.filter((evt) => {
    const isPending = !evt.liberado || evt.liberado === '' || evt.liberado === 'N';
    const isApproved = evt.liberado === 'S';

    if (eventFilterStatus === 'pending' && !isPending) return false;
    if (eventFilterStatus === 'approved' && !isApproved) return false;

    if (selectedCategoryForLiberation !== 'Todas') {
      const selNorm = selectedCategoryForLiberation.toLowerCase().trim();
      const evtCatNorm = (evt.category || '').toLowerCase().trim();
      if (selNorm !== evtCatNorm) return false;
    }

    return true;
  });

  const handleSaveLiberation = async (id: string, nextLiberado: 'S' | 'N') => {
    if (onSetLiberado) {
      await onSetLiberado(id, nextLiberado);
    } else if (onToggleLiberado) {
      const currentEvt = events.find((e) => e.id === id);
      const current = currentEvt?.liberado || '';
      if (current !== nextLiberado) {
        onToggleLiberado(id, current);
      }
    }
    // Atualiza o item atualmente selecionado em análise se ainda for o mesmo
    setSelectedEventForAnalysis((prev) => (prev && prev.id === id ? { ...prev, liberado: nextLiberado } : prev));
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

  const handleLiberateAllPending = () => {
    if (!onSetLiberado && !onToggleLiberado) return;
    const pendingEvents = filteredEventsForLiberation.filter((e) => !e.liberado || e.liberado === '' || e.liberado === 'N');
    if (pendingEvents.length === 0) return;

    const label = selectedCategoryForLiberation !== 'Todas'
      ? `todos os ${pendingEvents.length} eventos pendentes da categoria "${selectedCategoryForLiberation}"`
      : `todos os ${pendingEvents.length} eventos pendentes`;

    if (window.confirm(`Deseja liberar ${label} agora?`)) {
      pendingEvents.forEach((evt) => {
        if (onSetLiberado) {
          onSetLiberado(evt.id, 'S');
        } else if (onToggleLiberado) {
          onToggleLiberado(evt.id, evt.liberado || 'N');
        }
      });
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
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="Fechar painel"
            >
              <X className="w-5 h-5" />
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
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${isMasterAdmin ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-4'} gap-4 pt-2`}>
                
                {/* BOTÃO 1: LIBERAR EVENTOS */}
                <button
                  id="btn-admin-liberar-eventos"
                  onClick={() => setCurrentView('liberar_eventos')}
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

                {/* BOTÃO 5: CADASTRAR PATROCINADORES (NOVIDADE MONETIZAÇÃO) */}
                <button
                  id="btn-admin-cadastrar-patrocinadores"
                  onClick={() => setCurrentView('sponsors')}
                  className="group relative flex flex-col items-center text-center p-5 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-950 border border-slate-700/80 hover:border-amber-500/60 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-200 cursor-pointer"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 group-hover:scale-105 transition-all mb-3 shadow-inner">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors mb-1.5">
                    Patrocinadores Locais
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed flex-1">
                    Cadastre novos parceiros e gerencie comércios da vitrine (R$ 100/mês).
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-amber-400">
                    <span>Acessar ({localSponsors.length})</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </button>

                {/* BOTÃO NOVO: LIBERAR PATROCINADORES (REVISÃO DE SEGURANÇA ATÉ 48 HORAS) */}
                <button
                  id="btn-admin-liberar-patrocinadores"
                  onClick={() => {
                    fetchDbSponsors();
                    setCurrentView('liberar_patrocinadores');
                  }}
                  className="group relative flex flex-col items-center text-center p-5 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-950 border border-amber-500/50 hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/15 transition-all duration-200 cursor-pointer"
                >
                  <div className="relative w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 group-hover:scale-105 group-hover:bg-amber-500/25 transition-all mb-3 shadow-inner">
                    <ShieldCheck className="w-7 h-7" />
                    {dbSponsors.filter((s) => s.liberado === 'pendente' || (s.statusPagamento === 'pago' && !s.active)).length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black animate-pulse shadow-md">
                        {dbSponsors.filter((s) => s.liberado === 'pendente' || (s.statusPagamento === 'pago' && !s.active)).length}
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors mb-1.5">
                    Liberar Patrocinadores
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed flex-1">
                    Análise e liberação de segurança em até 48h ({dbSponsors.filter((s) => s.liberado === 'pendente').length} aguardando análise).
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-amber-400">
                    <span>Liberar Anúncios</span>
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
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">Cadastrar Cidades</h3>
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
                  <h4 className="text-sm font-bold text-white mb-1">Adicionar Nova Cidade</h4>
                  <p className="text-xs text-slate-400">
                    Cadastre novos municípios para organização geográfica dos eventos no catálogo e no mapa.
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
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        {['SP', 'RJ', 'MG', 'ES', 'PR', 'SC', 'RS', 'BA', 'PE', 'CE', 'MA', 'GO', 'DF', 'AM', 'PA'].map((uf) => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Região</label>
                      <select
                        value={newCityRegion}
                        onChange={(e) => setNewCityRegion(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="Sudeste">Sudeste</option>
                        <option value="Nordeste">Nordeste</option>
                        <option value="Sul">Sul</option>
                        <option value="Centro-Oeste">Centro-Oeste</option>
                        <option value="Norte">Norte</option>
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
                  <span className="font-semibold text-white text-xs">
                    Cidades Cadastradas ({cities.length})
                  </span>

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
                  {totalPending > 0 && (onSetLiberado || onToggleLiberado) && (
                    <button
                      onClick={handleLiberateAllPending}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Liberar Pendentes ({totalPending})</span>
                    </button>
                  )}

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
                    <span>Pendentes (liberar = "" ou "N") ({totalPending})</span>
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
                    Todos ({events.length})
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
                    const catEvents = events.filter((e) => (e.category || '').toLowerCase().trim() === cat.name.toLowerCase().trim());
                    const pendingCount = catEvents.filter((e) => !e.liberado || e.liberado === '' || e.liberado === 'N').length;

                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => setSelectedCategoryForLiberation(isSelected ? 'Todas' : cat.name)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/40'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          {cat.id ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              ID {cat.id}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">CAT</span>
                          )}

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

                        <div className="text-[10px] text-slate-400 mt-1 truncate">
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
                    <p className="text-[11px] text-slate-500">
                      Não há eventos com campo liberar igual a "" ou "N". Todos os eventos estão liberados!
                    </p>
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
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {filteredEventsForLiberation.length} {filteredEventsForLiberation.length === 1 ? 'evento' : 'eventos'}
                    </span>
                  </div>

                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-3">Imagem & Evento</th>
                        <th className="py-3 px-3">Categoria</th>
                        <th className="py-3 px-3">Cidade/Local</th>
                        <th className="py-3 px-3">Data/Hora</th>
                        <th className="py-3 px-3 text-center">Status Liberar</th>
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
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                    <Eye className="w-4 h-4" />
                                  </div>
                                </div>
                                <div>
                                  <div className="font-bold text-white max-w-[200px] truncate group-hover:text-amber-300 transition-colors">
                                    {evt.title}
                                  </div>
                                  <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                                    {evt.organizer || 'Sem organizador'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-amber-300 border border-slate-700">
                                {evt.category}
                              </span>
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
                              {isApproved ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveLiberation(evt.id, 'N');
                                  }}
                                  title="Clique para desativar liberação deste evento"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Liberado ("S")</span>
                                </button>
                              ) : isRejected ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveLiberation(evt.id, 'S');
                                  }}
                                  title="Clique para confirmar liberação (atualiza o campo liberado com 'S')"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40 transition-colors cursor-pointer"
                                >
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Não Liberado ("N")</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveLiberation(evt.id, 'S');
                                  }}
                                  title="Clique para confirmar liberação (atualiza o campo liberado com 'S')"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40 transition-colors cursor-pointer"
                                >
                                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Pendente ("")</span>
                                </button>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {!isApproved && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSaveLiberation(evt.id, 'S');
                                    }}
                                    className="px-2 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                                    title="Confirmar Liberação rápida: atualiza campo liberado com 'S'"
                                  >
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="hidden sm:inline">Liberar ("S")</span>
                                  </button>
                                )}

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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`Deseja excluir o evento "${evt.title}"?`)) {
                                      onDeleteEvent(evt.id);
                                    }
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Excluir Evento"
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
                        Cidade
                      </label>
                      <input
                        type="text"
                        value={sponsorCity}
                        onChange={(e) => setSponsorCity(e.target.value)}
                        placeholder="Santo André"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
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
                    onClick={fetchDbSponsors}
                    disabled={loadingDbSponsors}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingDbSponsors ? 'animate-spin' : ''}`} />
                    <span>Atualizar Lista</span>
                  </button>
                </div>
              </div>

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
        onClose={() => setSelectedEventForAnalysis(null)}
        onSaveLiberation={handleSaveLiberation}
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
