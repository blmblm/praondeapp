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
  Filter
} from 'lucide-react';
import { EventItem, Advertiser, Supervisor, CityItem, CategoryItem } from '../types';

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
  onSelectEvent: (event: EventItem) => void;
  onOpenSqlConsole: () => void;
}

const ADMIN_PIN_KEY = 'praonde_admin_pin';
const SUPERVISORS_STORAGE_KEY = 'praonde_supervisors_v1';
const CITIES_STORAGE_KEY = 'praonde_cities_v1';
const INITIAL_PIN = '0612';

// As 4 views principais solicitadas pelo usuário + menu e senhas
type AdminPageView = 
  | 'menu' 
  | 'passwords' 
  | 'categories' 
  | 'supervisors' 
  | 'cities' 
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
  onSelectEvent,
  onOpenSqlConsole,
}) => {
  // Auth state - direct access to management screen
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

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

  // State for "Cadastrar Supervisor"
  const [supervisors, setSupervisors] = useState<Supervisor[]>(() => {
    try {
      const saved = localStorage.getItem(SUPERVISORS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_SUPERVISORS;
  });
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

  // State for "Liberar Eventos"
  const [eventFilterStatus, setEventFilterStatus] = useState<'all' | 'pending' | 'approved'>('all');
  const [selectedCategoryForLiberation, setSelectedCategoryForLiberation] = useState<string>('Todas');

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
      setIsAuthenticated(true);
      setPasswordInput('');
      setShowPassword(false);
      setErrorMessage('');
      setCurrentView('menu');
      setNewPin('');
      setConfirmPin('');
      setPinFeedback(null);
      setNewCategoryName('');
      setCategoryFeedback(null);
      setSupFeedback(null);
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

  // Handle password submission
  const handlePasswordSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const stored = getStoredPin();
    const cleaned = passwordInput.trim();

    if (!cleaned) {
      setErrorMessage('Por favor, informe a senha de acesso.');
      return;
    }

    if (cleaned === stored || cleaned === INITIAL_PIN) {
      setIsAuthenticated(true);
      setCurrentView('menu');
      setErrorMessage('');
      setPasswordInput('');
    } else {
      setErrorMessage('Senha incorreta. A senha inicial padrão é 0612.');
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
    if (window.confirm('Deseja realmente restaurar a senha inicial para "0612"?')) {
      try {
        localStorage.setItem(ADMIN_PIN_KEY, INITIAL_PIN);
        setPinFeedback({ type: 'success', msg: 'Senha restaurada para o padrão inicial "0612" com sucesso!' });
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

  // Handle Cadastrar Supervisor
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
      msg: `Supervisor(a) "${supName}" cadastrado(a) com sucesso no banco de dados! ${sqliteId ? `(ID ${sqliteId})` : ''}`,
    });
    setSupName('');
    setSupPassword('');
    setSupEmail('');
    setSupPhone('');
    setSupCity('');
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

  // Counts for Event Liberation
  const totalApproved = events.filter((e) => e.liberado === 'S' || !e.liberado).length;
  const totalPending = events.filter((e) => e.liberado === 'N').length;

  // Filtered events for "Liberar Eventos"
  const filteredEventsForLiberation = events.filter((evt) => {
    const isLiberado = evt.liberado === 'S' || !evt.liberado;
    if (eventFilterStatus === 'pending' && isLiberado) return false;
    if (eventFilterStatus === 'approved' && !isLiberado) return false;

    if (selectedCategoryForLiberation !== 'Todas') {
      const selNorm = selectedCategoryForLiberation.toLowerCase().trim();
      const evtCatNorm = (evt.category || '').toLowerCase().trim();
      if (selNorm !== evtCatNorm) return false;
    }

    return true;
  });

  const handleLiberateAllPending = () => {
    if (!onToggleLiberado) return;
    const pendingEvents = filteredEventsForLiberation.filter((e) => e.liberado === 'N');
    if (pendingEvents.length === 0) return;

    const label = selectedCategoryForLiberation !== 'Todas'
      ? `todos os ${pendingEvents.length} eventos pendentes da categoria "${selectedCategoryForLiberation}"`
      : `todos os ${pendingEvents.length} eventos pendentes`;

    if (window.confirm(`Deseja liberar ${label} agora?`)) {
      pendingEvents.forEach((evt) => {
        onToggleLiberado(evt.id, 'N');
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
            <h2 className="text-xl font-bold text-white mb-1">Acesso Administrativo</h2>
            <p className="text-xs text-slate-400">
              Digite a senha de acesso (até 6 dígitos)
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
                  maxLength={6}
                  inputMode="numeric"
                  autoFocus
                  value={passwordInput}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 6);
                    setPasswordInput(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="••••"
                  className="w-full text-center text-2xl tracking-[0.4em] font-mono py-3.5 px-12 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 transition-colors"
                  title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Indicadores de até 6 dígitos */}
              <div className="flex items-center justify-center gap-2 mt-3">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <span
                    key={index}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-150 ${
                      index < passwordInput.length
                        ? 'bg-amber-400 scale-110 shadow-sm shadow-amber-400/50'
                        : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 text-xs text-rose-400 mt-3 bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 rounded-xl">
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
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <KeyRound className="w-4 h-4" />
                <span>Entrar</span>
              </button>
            </div>

            <div className="text-center pt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                <span>Senha inicial de acesso:</span>
                <strong className="font-mono text-amber-200">0612</strong>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================================
  // TELA AUTENTICADA: MENU COM OS 4 BOTÕES SOLICITADOS:
  // 1. Cadastrar Categoria
  // 2. Cadastrar Supervisor
  // 3. Cadastrar Cidades
  // 4. Liberar Eventos
  // =========================================================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-5xl max-h-[94vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">Painel Administrativo</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Autenticado
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Gerenciamento de categorias, supervisores, cidades e eventos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentView !== 'menu' && (
              <button
                onClick={() => setCurrentView('menu')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar ao Menu</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
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
              2. "Cadastrar Categoria"
              3. "Cadastrar Supervisor"
              4. "Cadastrar Cidades"
              ========================================================================= */}
          {currentView === 'menu' && (
            <div className="max-w-4xl mx-auto py-2 sm:py-4 space-y-6">
              <div className="text-center space-y-1">
                <h3 className="text-xl sm:text-2xl font-bold text-white">Central de Gerenciamento</h3>
                <p className="text-xs sm:text-sm text-slate-400">
                  Selecione uma das opções abaixo para gerenciar a plataforma:
                </p>
              </div>

              {/* OS 4 BOTÕES SOLICITADOS:
                  1. "Liberar Eventos"
                  2. "Cadastrar Categoria"
                  3. "Cadastrar Supervisor"
                  4. "Cadastrar Cidades"
              */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                
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
                    Aprove ou pause eventos ({totalApproved} liberados, {totalPending} pendentes).
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                    <span>Acessar</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </button>

                {/* BOTÃO 2: CADASTRAR CATEGORIA */}
                <button
                  id="btn-admin-cadastrar-categoria"
                  onClick={() => setCurrentView('categories')}
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
                  onClick={() => setCurrentView('supervisors')}
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
                  onClick={() => setCurrentView('cities')}
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

              </div>

              {/* Barra inferior de ferramentas e configuração de senha */}
              <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCurrentView('passwords')}
                    className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 hover:underline cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Alterar Senha do Administrador</span>
                  </button>
                  <span>•</span>
                  <span>Banco de Dados: <code className="text-slate-300 font-mono">praondeeu.db</code></span>
                </div>

                <button
                  onClick={() => {
                    onClose();
                    onOpenSqlConsole();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5 text-amber-400" />
                  <span>Abrir Console SQL</span>
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW 1: CADASTRAR CATEGORIA
              ========================================================================= */}
          {currentView === 'categories' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white">Cadastrar Categoria</h3>
                </div>
                <button
                  onClick={() => setCurrentView('menu')}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
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
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-sky-400" />
                  <h3 className="text-base font-bold text-white">Cadastrar Supervisor</h3>
                </div>
                <button
                  onClick={() => setCurrentView('menu')}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar</span>
                </button>
              </div>

              {/* Formulário de Cadastro de Supervisor */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">Novo Supervisor</h4>
                  <p className="text-xs text-slate-400">
                    Cadastre os dados do supervisor regional ou geral responsável pela gestão e conferência dos eventos.
                  </p>
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
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Senha de Acesso (opcional)</label>
                      <div className="relative">
                        <input
                          type={showSupPassword ? 'text' : 'password'}
                          value={supPassword}
                          onChange={(e) => setSupPassword(e.target.value)}
                          placeholder="Ex: 123456"
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

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md shadow-sky-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Cadastrar Supervisor</span>
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
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold text-white">Cadastrar Cidades</h3>
                </div>
                <button
                  onClick={() => setCurrentView('menu')}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
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
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="text-base font-bold text-white">Liberar Eventos</h3>
                    <p className="text-xs text-slate-400">
                      Alterne o status de liberação de cada evento para definir sua exibição no aplicativo
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {totalPending > 0 && onToggleLiberado && (
                    <button
                      onClick={handleLiberateAllPending}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Liberar Todos os Pendentes ({totalPending})</span>
                    </button>
                  )}

                  <button
                    onClick={() => setCurrentView('menu')}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Voltar ao Menu
                  </button>
                </div>
              </div>

              {/* Status Counters & Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400 mr-1">Status:</span>
                  <button
                    onClick={() => setEventFilterStatus('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      eventFilterStatus === 'all'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    Todos ({events.length})
                  </button>

                  <button
                    onClick={() => setEventFilterStatus('pending')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      eventFilterStatus === 'pending'
                        ? 'bg-rose-500 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Pendentes ({totalPending})</span>
                  </button>

                  <button
                    onClick={() => setEventFilterStatus('approved')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      eventFilterStatus === 'approved'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Liberados ({totalApproved})</span>
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
                      (Clique em uma categoria para filtrar a lista de eventos abaixo)
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
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                        {events.length}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white truncate">Todas as Categorias</div>
                    <div className="text-[10px] text-slate-400 mt-1">Todos os eventos</div>
                  </button>

                  {/* Cards de cada Categoria */}
                  {allCategoriesForLiberation.map((cat) => {
                    const isSelected = selectedCategoryForLiberation.toLowerCase().trim() === cat.name.toLowerCase().trim();
                    const count = events.filter((e) => (e.category || '').toLowerCase().trim() === cat.name.toLowerCase().trim()).length;
                    const pendingCount = events.filter((e) => (e.category || '').toLowerCase().trim() === cat.name.toLowerCase().trim() && e.liberado === 'N').length;

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
                              {count}
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-bold text-white truncate" title={cat.name}>
                          {cat.name}
                        </div>

                        <div className="text-[10px] text-slate-400 mt-1 truncate">
                          {count} {count === 1 ? 'evento' : 'eventos'}
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
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-3">Evento</th>
                        <th className="py-3 px-3">Categoria</th>
                        <th className="py-3 px-3">Cidade/Local</th>
                        <th className="py-3 px-3">Data/Hora</th>
                        <th className="py-3 px-3 text-center">Status / Ação de Liberação</th>
                        <th className="py-3 px-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {filteredEventsForLiberation.map((evt) => {
                        const isLiberado = evt.liberado === 'S' || !evt.liberado;
                        return (
                          <tr key={evt.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={evt.imageUrl}
                                  alt={evt.title}
                                  className="w-10 h-10 rounded-lg object-cover bg-slate-800 flex-shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                                <div>
                                  <div className="font-bold text-white max-w-[200px] truncate">
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
                              {onToggleLiberado ? (
                                <button
                                  onClick={() => onToggleLiberado(evt.id, evt.liberado || 'S')}
                                  title="Clique para alternar o status de liberação"
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm ${
                                    isLiberado
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                                  }`}
                                >
                                  {isLiberado ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>Liberado</span>
                                    </>
                                  ) : (
                                    <>
                                      <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                                      <span>Liberar Evento</span>
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                                  isLiberado
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                }`}>
                                  {isLiberado ? 'Liberado' : 'Pendente'}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => {
                                    onSelectEvent(evt);
                                    onClose();
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="Visualizar Detalhes"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
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
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold text-white">Alterar Senha do Administrador</h3>
                </div>
                <button
                  onClick={() => setCurrentView('menu')}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
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
                          placeholder="Ex: 0612"
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
                        placeholder="Repita a senha"
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
                      <span>Restaurar para 0612</span>
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

        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div>
            Painel Administrativo • Senha Inicial: <strong className="text-amber-300 font-mono">0612</strong>
          </div>
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
    </div>
  );
};
