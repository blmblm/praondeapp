import React, { useState } from 'react';
import { 
  Compass, 
  PlusCircle, 
  Home, 
  Sparkles, 
  User, 
  ShieldCheck, 
  Database,
  SlidersHorizontal,
  Menu,
  X,
  MapPin,
  ChevronDown,
  Check,
  Smartphone,
  LogIn,
  LogOut
} from 'lucide-react';
import { ActiveScreen, Advertiser } from '../types';
import appIconUrl from '../assets/images/app_icon_1788820561686.jpg';
import { useUserLocation } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  onExitAndClear?: () => void;
  eventCount: number;
  currentAdvertiser?: Advertiser | null;
  onOpenAdvertiserAuth?: () => void;
  onOpenSqlConsole?: () => void;
  onOpenAdmin?: () => void;
  isMasterAdmin?: boolean;
  onOpenInstall?: () => void;
  onPromptInstall?: () => Promise<'accepted' | 'dismissed' | 'manual'>;
  hasNativePrompt?: boolean;
  isAppInstalled?: boolean;
  isHomeMenuOpen?: boolean;
  onToggleHomeMenu?: () => void;
  onCloseHomeMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  currentScreen, 
  onNavigate, 
  onExitAndClear,
  eventCount,
  currentAdvertiser,
  onOpenAdvertiserAuth,
  onOpenSqlConsole,
  onOpenAdmin,
  isMasterAdmin = false,
  onOpenInstall,
  onPromptInstall,
  hasNativePrompt = false,
  isAppInstalled = false,
  isHomeMenuOpen = false,
  onCloseHomeMenu,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCityMenuOpen, setIsCityMenuOpen] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const { userOriginCity, setUserOriginCity, refreshLocation } = useUserLocation();
  const { user, signInWithGoogle, signOutUser } = useAuth();

  const handleGoogleLogin = async () => {
    try {
      setAuthBusy(true);
      await signInWithGoogle();
    } catch {
      // Usuário cancelou ou popup bloqueado
    } finally {
      setAuthBusy(false);
    }
  };

  const handleMobileNav = (screen: ActiveScreen) => {
    onNavigate(screen);
    setIsMobileMenuOpen(false);
    onCloseHomeMenu?.();
  };

  const handleInstallClick = async () => {
    if (hasNativePrompt && onPromptInstall) {
      await onPromptInstall();
    } else if (onOpenInstall) {
      onOpenInstall();
    }
  };

  if (currentScreen === 'home') {
    if (!isHomeMenuOpen) {
      return null;
    }

    return (
      <div
        className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={() => onCloseHomeMenu?.()}
      >
        <div
          className="max-w-sm w-[calc(100%-1.5rem)] mx-3 sm:mx-auto mt-16 border border-slate-800 bg-slate-950/98 rounded-2xl px-4 pt-3 pb-4 space-y-2 shadow-2xl max-h-[82vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Menu do Aplicativo
            </span>
            <button
              type="button"
              onClick={() => onCloseHomeMenu?.()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Fechar menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Seletor rápido de Cidade / GPS */}
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                Sua Cidade: <strong className="text-amber-300">{userOriginCity || 'Praia Grande'}</strong>
              </span>
              <button
                type="button"
                onClick={async () => {
                  await refreshLocation();
                }}
                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 cursor-pointer"
              >
                🛰️ GPS
              </button>
            </div>
            <select
              value={userOriginCity || 'Praia Grande'}
              onChange={(e) => setUserOriginCity(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              {['Praia Grande', 'São Paulo', 'Santos', 'Santo André', 'Campinas', 'São Bernardo do Campo', 'São José dos Campos', 'Osasco', 'Guarulhos', 'Ribeirão Preto', 'Sorocaba'].map((cName) => (
                <option key={`home-city-${cName}`} value={cName}>
                  {cName}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => handleMobileNav('home')}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 text-white cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Home className="w-4 h-4 text-amber-400" />
              <span>Início</span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          </button>

          <button
            onClick={() => handleMobileNav('events')}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-white transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Compass className="w-4 h-4 text-amber-400" />
              <span>Consultar Eventos</span>
            </div>
            {eventCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                {eventCount}
              </span>
            )}
          </button>

          <button
            onClick={() => handleMobileNav('register')}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-white transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <PlusCircle className="w-4 h-4 text-amber-400" />
              <span>Divulgar Evento</span>
            </div>
          </button>

          {onOpenInstall && !isAppInstalled && (
            <button
              id="nav-home-install-pwa-btn"
              onClick={() => {
                onCloseHomeMenu?.();
                handleInstallClick();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Smartphone className="w-4 h-4 text-amber-400" />
                <span>Gravar Ícone no Celular</span>
              </div>
            </button>
          )}

          {onOpenAdmin && (
            <button
              id="nav-home-admin-btn"
              onClick={() => {
                onCloseHomeMenu?.();
                onOpenAdmin();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Central de Gerenciamento</span>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                Admin
              </span>
            </button>
          )}

          {currentAdvertiser && onOpenAdvertiserAuth && (
            <button
              onClick={() => {
                onCloseHomeMenu?.();
                onOpenAdvertiserAuth();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-900 border border-amber-500/20 text-xs text-slate-300 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-amber-400 font-semibold truncate max-w-[180px]">
                  {currentAdvertiser.name || currentAdvertiser.email}
                </span>
              </div>
              <span className="text-slate-400 hover:text-white text-[11px] underline">
                Gerenciar
              </span>
            </button>
          )}

          <div className="pt-2 border-t border-slate-800/80">
            {user ? (
              <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Usuário'}
                      className="w-7 h-7 rounded-full object-cover border border-amber-400/50 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {user.displayName || 'Usuário Google'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    signOutUser();
                    onCloseHomeMenu?.();
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-300 hover:bg-rose-500/15 border border-rose-500/30 shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={authBusy}
                onClick={async () => {
                  await handleGoogleLogin();
                  onCloseHomeMenu?.();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <LogIn className="w-4 h-4 text-amber-400" />
                  <span>{authBusy ? 'Entrando...' : 'Entrar com Google'}</span>
                </div>
                <span className="text-[10px] text-amber-400 font-bold">Google</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <button
          id="nav-brand-btn"
          onClick={() => {
            onNavigate('home');
            setIsMobileMenuOpen(false);
          }}
          className="flex items-center gap-2.5 sm:gap-3 text-left group focus:outline-none"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden ring-1 ring-amber-500/30 group-hover:ring-amber-400 transition-all shadow-md shadow-amber-500/10 flex-shrink-0">
            <img
              src={appIconUrl}
              alt="Pra onde eu vou"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base sm:text-lg tracking-tight text-white group-hover:text-amber-400 transition-colors whitespace-nowrap">
                Pra onde eu vou
              </span>
              <span className="hidden sm:inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                São Paulo (SP)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Guia oficial de eventos no Estado de São Paulo
            </p>
          </div>
        </button>

        {/* Desktop Navigation Actions (md and up) */}
        <nav className="hidden md:flex items-center gap-1.5 lg:gap-2">
          {/* Seletor de Onde Você Está (Referência de Proximidade e Cálculo de Distâncias) */}
          <div className="relative">
            <button
              id="nav-city-btn"
              type="button"
              onClick={() => setIsCityMenuOpen(!isCityMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-400 text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer shadow-sm group"
              title="Sua localização atual para calcular distâncias até os eventos"
            >
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
              <span className="max-w-[120px] truncate">{userOriginCity || 'Praia Grande'}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 transition-transform duration-200 ${isCityMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isCityMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-64 bg-slate-900/98 backdrop-blur-xl border border-amber-500/40 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    Você está em:
                  </span>
                  <span className="text-[10px] text-amber-400 font-medium">Distâncias</span>
                </div>
                
                <p className="text-[11px] text-slate-400 mb-2 leading-tight">
                  Selecione sua cidade para calcular a distância exata até os eventos:
                </p>

                <div className="space-y-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {['Praia Grande', 'São Paulo', 'Santos', 'Santo André', 'Campinas', 'São Bernardo do Campo', 'São José dos Campos', 'Osasco', 'Guarulhos', 'Ribeirão Preto', 'Sorocaba'].map((cName) => {
                    const isSelected = (userOriginCity || '').toLowerCase() === cName.toLowerCase();
                    return (
                      <button
                        key={`nav-city-${cName}`}
                        type="button"
                        onClick={() => {
                          setUserOriginCity(cName);
                          setIsCityMenuOpen(false);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <span>{cName}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 mt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsCityMenuOpen(false);
                      await refreshLocation();
                    }}
                    className="w-full py-1.5 px-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>🛰️ Atualizar via GPS do Celular</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            id="nav-home-btn"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all text-slate-400 hover:text-white hover:bg-slate-900"
          >
            <Home className="w-4 h-4" />
            <span>Início</span>
          </button>

          <button
            id="nav-events-btn"
            onClick={() => onNavigate('events')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all relative ${
              currentScreen === 'events'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Compass className="w-4 h-4 text-amber-400" />
            <span>Consultar Eventos</span>
            {eventCount > 0 && (
              <span className="ml-0.5 text-[11px] font-bold px-1.5 py-0.2 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                {eventCount}
              </span>
            )}
          </button>

          <button
            id="nav-divulgar-evento-btn"
            onClick={() => onNavigate('register')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              currentScreen === 'register' || currentScreen === 'advertiser_auth'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-amber-400 hover:text-amber-300 hover:bg-slate-900 border border-amber-500/30'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Divulgar Evento</span>
          </button>

          {onOpenInstall && !isAppInstalled && (
            <button
              id="nav-install-pwa-btn"
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-amber-300 hover:text-white bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/40 transition-all cursor-pointer shadow-sm group"
              title="Gravar ícone do aplicativo na tela inicial do celular"
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              <span>Gravar Ícone</span>
            </button>
          )}

          {currentAdvertiser && onOpenAdvertiserAuth && (
            <button
              onClick={onOpenAdvertiserAuth}
              title="Anunciante conectado - Clique para trocar ou gerenciar"
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-amber-500/30 text-xs text-slate-300 hover:text-white hover:border-amber-400 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="max-w-[130px] truncate font-medium text-amber-400">
                {currentAdvertiser.name || currentAdvertiser.email.split('@')[0]}
              </span>
            </button>
          )}

          {onOpenAdmin && (
            <button
              id="nav-admin-btn"
              onClick={onOpenAdmin}
              title="Central de Gerenciamento"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-amber-300 hover:bg-slate-900 border border-slate-800 transition-all cursor-pointer shadow-sm"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Central de Gerenciamento</span>
            </button>
          )}

          {user ? (
            <div className="flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-xl bg-slate-900 border border-slate-700/80">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Usuário'}
                  className="w-6 h-6 rounded-full object-cover border border-amber-400/50"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User className="w-4 h-4 text-amber-400" />
              )}
              <span className="max-w-[95px] truncate text-xs font-medium text-slate-200">
                {user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'Conta'}
              </span>
              <button
                type="button"
                onClick={signOutUser}
                title="Sair da conta Google"
                className="p-1 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              id="nav-google-signin-btn"
              type="button"
              disabled={authBusy}
              onClick={handleGoogleLogin}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/60 transition-all cursor-pointer disabled:opacity-50"
              title="Entrar com sua conta Google"
            >
              <LogIn className="w-3.5 h-3.5 text-amber-400" />
              <span>{authBusy ? 'Entrando...' : 'Entrar'}</span>
            </button>
          )}

          <button
            id="nav-exit-clear-btn"
            onClick={onExitAndClear || (() => onNavigate('home'))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-rose-500/20 text-slate-200 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 font-bold text-xs shadow-sm cursor-pointer transition-colors"
            title="Sair desta tela e limpar o aplicativo"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Sair</span>
          </button>
        </nav>

        {/* Mobile Right Bar (md:hidden) */}
        <div className="flex md:hidden items-center gap-2">
          {/* Botão de Cidade no Mobile */}
          <button
            type="button"
            onClick={() => setIsCityMenuOpen(!isCityMenuOpen)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-amber-300 font-bold shadow-sm"
            title="Sua localização atual para cálculo de distância"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="max-w-[80px] truncate">{userOriginCity || 'Praia Grande'}</span>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isCityMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          <button
            id="mobile-nav-exit-clear-btn"
            onClick={onExitAndClear || (() => onNavigate('home'))}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-rose-500/20 text-slate-200 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 font-bold text-xs shadow-sm cursor-pointer transition-colors"
            title="Sair desta tela e limpar o aplicativo"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Sair</span>
          </button>

          <button
            id="btn-mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
            aria-label="Abrir menu de navegação"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5 text-amber-400" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown (md:hidden) */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800/80 bg-slate-950/95 px-4 pt-3 pb-5 space-y-2 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-2 duration-200">
          <button
            onClick={() => handleMobileNav('home')}
            className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-colors text-slate-300 hover:bg-slate-900 hover:text-white"
          >
            <div className="flex items-center gap-3">
              <Home className="w-4 h-4 text-amber-400" />
              <span>Início</span>
            </div>
          </button>

          <button
            onClick={() => handleMobileNav('events')}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-colors ${
              currentScreen === 'events'
                ? 'bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Compass className="w-4 h-4 text-amber-400" />
              <span>Consultar Eventos</span>
            </div>
            {eventCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                {eventCount}
              </span>
            )}
          </button>

          <button
            onClick={() => handleMobileNav('register')}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-colors ${
              currentScreen === 'register' || currentScreen === 'advertiser_auth'
                ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <PlusCircle className="w-4 h-4 text-amber-400" />
              <span>Divulgar Evento</span>
            </div>
          </button>

          {onOpenInstall && !isAppInstalled && (
            <button
              id="nav-mobile-install-pwa-btn"
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleInstallClick();
              }}
              className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 transition-colors shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Smartphone className="w-4 h-4 text-amber-400" />
                <span>Gravar Ícone no Celular</span>
              </div>
            </button>
          )}

          {onOpenAdmin && (
            <button
              id="nav-mobile-admin-btn"
              onClick={() => {
                onOpenAdmin();
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Central de Gerenciamento</span>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                Admin
              </span>
            </button>
          )}

          {currentAdvertiser && onOpenAdvertiserAuth && (
            <div className="pt-2 mt-2 border-t border-slate-800/80">
              <button
                onClick={() => {
                  onOpenAdvertiserAuth();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900 border border-amber-500/20 text-xs text-slate-300"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-amber-400 font-semibold truncate max-w-[180px]">
                    {currentAdvertiser.name || currentAdvertiser.email}
                  </span>
                </div>
                <span className="text-slate-400 hover:text-white text-[11px] underline">
                  Gerenciar
                </span>
              </button>
            </div>
          )}

          {/* Conta Google (Mobile) */}
          <div className="pt-2 border-t border-slate-800/80">
            {user ? (
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Usuário'}
                      className="w-7 h-7 rounded-full object-cover border border-amber-400/50 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {user.displayName || 'Usuário Google'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    signOutUser();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-300 hover:bg-rose-500/15 border border-rose-500/30 shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={authBusy}
                onClick={async () => {
                  await handleGoogleLogin();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <LogIn className="w-4 h-4 text-amber-400" />
                  <span>{authBusy ? 'Entrando...' : 'Entrar com Google'}</span>
                </div>
                <span className="text-[10px] text-amber-400 font-bold">Google</span>
              </button>
            )}
          </div>

          {/* Opção Fechar / Sair do Aplicativo */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                if (onExitAndClear) {
                  onExitAndClear();
                } else {
                  onNavigate('home');
                }
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-300 hover:bg-rose-500/15 border border-rose-500/20 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <X className="w-4 h-4 text-rose-400" />
                <span>Sair e Limpar Tela</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-rose-400/80">Sair</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

