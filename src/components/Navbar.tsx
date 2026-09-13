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
  X
} from 'lucide-react';
import { ActiveScreen, Advertiser } from '../types';
import appIconUrl from '../assets/images/app_icon_1788820561686.jpg';

interface NavbarProps {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  eventCount: number;
  currentAdvertiser?: Advertiser | null;
  onOpenAdvertiserAuth?: () => void;
  onOpenSqlConsole?: () => void;
  onOpenAdmin?: () => void;
  isMasterAdmin?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  currentScreen, 
  onNavigate, 
  eventCount,
  currentAdvertiser,
  onOpenAdvertiserAuth,
  onOpenSqlConsole,
  onOpenAdmin,
  isMasterAdmin = false,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMobileNav = (screen: ActiveScreen) => {
    onNavigate(screen);
    setIsMobileMenuOpen(false);
  };

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
              <span className="hidden sm:inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Guia
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Descubra e compartilhe eventos
            </p>
          </div>
        </button>

        {/* Desktop Navigation Actions (md and up) */}
        <nav className="hidden md:flex items-center gap-1.5 lg:gap-2">
          <button
            id="nav-home-btn"
            onClick={() => onNavigate('home')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              currentScreen === 'home'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
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

          {onOpenAdmin && currentScreen !== 'home' && (
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

          {currentScreen !== 'home' && (
            <button
              id="nav-register-btn"
              onClick={() => onNavigate('register')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                currentScreen === 'register' || currentScreen === 'advertiser_auth'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:from-amber-400 hover:to-orange-400 shadow-sm'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-slate-950" />
              <span>Cadastrar Evento</span>
            </button>
          )}
        </nav>

        {/* Mobile Right Bar (md:hidden) */}
        <div className="flex md:hidden items-center gap-2">
          {currentScreen !== 'home' ? (
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-rose-500/20 text-slate-200 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 font-bold text-xs shadow-sm cursor-pointer transition-colors"
              title="Sair desta tela e voltar ao início"
            >
              <X className="w-4 h-4 text-rose-400" />
              <span>Sair</span>
            </button>
          ) : (
            <button
              onClick={() => onNavigate('register')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-xs shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Cadastrar</span>
            </button>
          )}

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
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-colors ${
              currentScreen === 'home'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Home className="w-4 h-4 text-amber-400" />
              <span>Início</span>
            </div>
            {currentScreen === 'home' && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            )}
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
                ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <PlusCircle className="w-4 h-4 text-amber-400" />
              <span>Cadastrar Novo Evento</span>
            </div>
          </button>

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

          {/* Opção Fechar / Sair do Aplicativo */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onNavigate('home');
                try {
                  if (window.history.length > 1) {
                    window.history.back();
                  } else {
                    window.close();
                  }
                } catch {}
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-300 hover:bg-rose-500/15 border border-rose-500/20 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <X className="w-4 h-4 text-rose-400" />
                <span>Fechar / Sair da Tela</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-rose-400/80">Sair</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

