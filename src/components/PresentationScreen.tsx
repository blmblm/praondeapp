import React, { useState } from 'react';
import { 
  ShieldCheck,
  Heart,
  MapPin,
  Menu,
  X,
  Smartphone
} from 'lucide-react';
import { EventItem, ActiveScreen } from '../types';
import { HomeUpcomingEventsFeed } from './HomeUpcomingEventsFeed';
import { useUserLocation } from '../context/LocationContext';

// Backup integral da tela inicial original guardado em PresentationScreen.original.tsx
const SHOW_HOME_UPCOMING_EVENTS = true;

interface PresentationScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
  events: EventItem[];
  onSelectEvent: (event: EventItem) => void;
  onSearchRedirect: (term: string) => void;
  onOpenAdmin?: () => void;
  categories?: string[];
  cidadesList?: any[];
  onDiscoverySearch?: (filters: { category: string; estado: string; date: string; sortByProximity: boolean }) => void;
  onOpenInstall?: (skipQuestion?: boolean) => void;
  onPromptInstall?: () => Promise<'accepted' | 'dismissed' | 'manual'>;
  hasNativePrompt?: boolean;
  isAppInstalled?: boolean;
  isHomeMenuOpen?: boolean;
  onToggleHomeMenu?: () => void;
  homeFeedEvents?: EventItem[];
  isHomeFeedLoaded?: boolean;
}

const POPULAR_VIBES = [
  { 
    label: 'Baile Nostalgia', 
    categoryMatch: 'Baile Nostalgia', 
    icon: '🕺', 
    color: 'from-pink-600 via-pink-700 to-pink-800 hover:from-pink-500 hover:to-pink-600 border-pink-400/80 shadow-[0_0_15px_rgba(236,72,153,0.6)] hover:shadow-[0_0_25px_rgba(236,72,153,0.9)]' 
  },
  { 
    label: 'Samba e Pagode', 
    categoryMatch: 'Samba e Pagode', 
    icon: '🥁', 
    color: 'from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 border-orange-400/80 shadow-[0_0_15px_rgba(249,115,22,0.6)] hover:shadow-[0_0_25px_rgba(249,115,22,0.9)]' 
  },
  { 
    label: 'Baile Melhor Idade', 
    categoryMatch: 'Baile Terceira Idade', 
    icon: '💃', 
    color: 'from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 border-emerald-400/80 shadow-[0_0_15px_rgba(16,185,129,0.6)] hover:shadow-[0_0_25px_rgba(16,185,129,0.9)]' 
  },
  { 
    label: 'Forró', 
    categoryMatch: 'Forró', 
    icon: '🎟️', 
    color: 'from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 border-red-400/80 shadow-[0_0_15px_rgba(239,68,68,0.6)] hover:shadow-[0_0_25px_rgba(239,68,68,0.9)]' 
  },
  { 
    label: 'Forró Pé de Serra', 
    categoryMatch: 'Forró Pé de Serra', 
    icon: '🌵', 
    color: 'from-green-600 via-emerald-600 to-green-700 hover:from-green-500 hover:to-green-600 border-green-400/80 shadow-[0_0_15px_rgba(34,197,94,0.6)] hover:shadow-[0_0_25px_rgba(34,197,94,0.9)]' 
  },
  { 
    label: 'Bailes', 
    categoryMatch: 'Bailes', 
    icon: '🎶', 
    color: 'from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 border-blue-400/80 shadow-[0_0_15px_rgba(59,130,246,0.6)] hover:shadow-[0_0_25px_rgba(59,130,246,0.9)]' 
  },
  { 
    label: 'Shows', 
    categoryMatch: 'Shows', 
    icon: '🎸', 
    color: 'from-pink-600 via-fuchsia-600 to-pink-700 hover:from-pink-500 hover:to-fuchsia-500 border-pink-400/80 shadow-[0_0_15px_rgba(219,39,119,0.6)] hover:shadow-[0_0_25px_rgba(219,39,119,0.9)]' 
  },
  { 
    label: 'Festas', 
    categoryMatch: 'Festas', 
    icon: '🎉', 
    color: 'from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 border-purple-400/80 shadow-[0_0_15px_rgba(139,92,246,0.6)] hover:shadow-[0_0_25px_rgba(139,92,246,0.9)]' 
  },
  { 
    label: 'Teatro', 
    categoryMatch: 'Teatro', 
    icon: '🎭', 
    color: 'from-cyan-500 via-teal-500 to-cyan-600 hover:from-cyan-400 hover:to-teal-500 border-cyan-400/80 shadow-[0_0_15px_rgba(6,182,212,0.6)] hover:shadow-[0_0_25px_rgba(6,182,212,0.9)]' 
  },
  { 
    label: 'Sertanejo', 
    categoryMatch: 'Sertanejo', 
    icon: '🤠', 
    color: 'from-amber-600 via-amber-700 to-amber-800 hover:from-amber-500 hover:to-amber-600 border-amber-400/80 shadow-[0_0_15px_rgba(217,119,6,0.6)] hover:shadow-[0_0_25px_rgba(217,119,6,0.9)]' 
  },
];

export const PresentationScreen: React.FC<PresentationScreenProps> = (props) => {
  const {
    onNavigate,
    onSearchRedirect,
    onOpenAdmin,
    onOpenInstall,
    onPromptInstall,
    hasNativePrompt = false,
    isAppInstalled = false,
    isHomeMenuOpen = false,
    onToggleHomeMenu,
  } = props;

  // Carrega localização atual do GPS
  const { coords, status, requestLocation, userLocationLabel } = useUserLocation();
  const [dismissedIconPrompt, setDismissedIconPrompt] = useState<boolean>(false);

  React.useEffect(() => {
    try {
      localStorage.removeItem('praonde_pwa_dismissed_v1');
    } catch {}
  }, []);

  const handleVibeClick = (vibeMatchOrLabel: string) => {
    if (props.onDiscoverySearch) {
      props.onDiscoverySearch({
        category: vibeMatchOrLabel,
        estado: 'Todos',
        date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
        sortByProximity: true,
      });
    } else {
      onSearchRedirect(vibeMatchOrLabel);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950">
      {/* Luzes neon flutuantes no fundo para ambientação de balada/vida noturna */}
      <div className="absolute top-[-5%] left-[10%] w-[450px] h-[450px] bg-purple-600/15 blur-[110px] -z-10 pointer-events-none rounded-full" />
      <div className="absolute top-[20%] right-[5%] w-[400px] h-[400px] bg-blue-600/10 blur-[100px] -z-10 pointer-events-none rounded-full" />
      <div className="absolute top-[50%] left-[-5%] w-[350px] h-[350px] bg-pink-600/10 blur-[90px] -z-10 pointer-events-none rounded-full" />

      {/* Container Principal */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 sm:pt-3 pb-3 w-full text-center flex-1 flex flex-col items-center justify-start z-10">
        
        {/* Top Header Row (3 Risquinhos Menu, Title, Pin Icon) */}
        <div className="w-full max-w-2xl flex items-center justify-between gap-3 mb-2 sm:mb-3 mt-0">
          {/* Menu 3 risquinhos no lugar do ícone */}
          <button
            id="btn-home-menu-toggle"
            type="button"
            onClick={() => onToggleHomeMenu?.()}
            aria-label="Abrir menu de navegação"
            title="Menu de navegação"
            className="relative shrink-0 w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/90 hover:border-amber-400/60 text-slate-200 hover:text-amber-300 shadow-lg cursor-pointer transition-all active:scale-95"
          >
            {isHomeMenuOpen ? (
              <X className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
            ) : (
              <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </button>

          {/* Cursive Glowing Main Title */}
          <div className="flex-1 text-center px-1">
            <h1 className="text-2xl sm:text-4xl font-black italic tracking-wide text-white drop-shadow-[0_0_10px_rgba(168,85,247,0.85)] font-serif">
              Pra onde eu vou
            </h1>
            <div className="mt-0.5 flex items-center justify-center">
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-full shadow-sm">
                📍 Guia Exclusivo do Estado de São Paulo (SP)
              </span>
            </div>
          </div>

          {/* Neon Location Pin Right */}
          <button
            type="button"
            onClick={requestLocation}
            title={userLocationLabel ? `Sua Localização: ${userLocationLabel} (Clique para atualizar)` : 'Clique para obter sua localização'}
            className="relative shrink-0 p-2.5 sm:p-3 bg-slate-900/60 rounded-full border border-orange-500/50 shadow-[0_0_12px_rgba(249,115,22,0.45)] cursor-pointer hover:border-orange-400 active:scale-95 transition-all"
          >
            <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)] fill-orange-400/20" />
          </button>
        </div>

        {/* Cursive/Handwritten Warm Tagline */}
        <div className="max-w-xl mx-auto mb-2 sm:mb-3">
          <p className="text-sm sm:text-base font-bold text-white tracking-wide leading-relaxed">
            A vida é feita de momentos que aquecem o{' '}
            <span className="text-yellow-300 font-extrabold italic drop-shadow-[0_0_8px_rgba(253,224,71,0.9)] underline decoration-yellow-300 decoration-2">
              coração
            </span>{' '}
            💛
          </p>
        </div>

        {/* "QUAL É O SEU RITMO HOJE?" Yellow Glowing Capsule Section */}
        <div className="w-full max-w-2xl mb-2 sm:mb-3">
          <div className="inline-block bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black px-4 py-1.5 rounded-full border border-yellow-200 shadow-[0_0_10px_rgba(250,204,21,0.65)] tracking-widest text-[10px] sm:text-xs uppercase mb-1">
            QUAL É O SEU RITMO HOJE?
          </div>
          <p className="text-[9px] sm:text-[10px] font-black tracking-widest text-amber-300 uppercase">
            ESCOLHA E VEJA OS EVENTOS:
          </p>
        </div>

        {/* Buttons Grid Layout mimicking the uploaded mockup precisely */}
        <div className="w-full max-w-xl mb-2.5 sm:mb-3 px-2 flex flex-col gap-2">
          
          {/* Row 1: Baile Nostalgia & Samba e Pagode */}
          <div className="grid grid-cols-2 gap-3 w-full">
            {[POPULAR_VIBES[0], POPULAR_VIBES[1]].map((vibe) => (
              <button
                key={vibe.label}
                onClick={() => handleVibeClick(vibe.categoryMatch || vibe.label)}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-full text-xs sm:text-sm font-black uppercase text-white bg-gradient-to-r ${vibe.color} border transition-all transform hover:scale-105 active:scale-95 cursor-pointer`}
              >
                <span className="text-lg sm:text-xl shrink-0">{vibe.icon}</span>
                <span className="truncate tracking-wide">{vibe.label}</span>
              </button>
            ))}
          </div>

          {/* Row 2: Baile Melhor Idade & Forró */}
          <div className="grid grid-cols-2 gap-3 w-full">
            {[POPULAR_VIBES[2], POPULAR_VIBES[3]].map((vibe) => (
              <button
                key={vibe.label}
                onClick={() => handleVibeClick(vibe.categoryMatch || vibe.label)}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-full text-xs sm:text-sm font-black uppercase text-white bg-gradient-to-r ${vibe.color} border transition-all transform hover:scale-105 active:scale-95 cursor-pointer`}
              >
                <span className="text-lg sm:text-xl shrink-0">{vibe.icon}</span>
                <span className="truncate tracking-wide">{vibe.label}</span>
              </button>
            ))}
          </div>

          {/* Row 3: Forró Pé de Serra, Bailes & Shows */}
          <div className="flex justify-center w-full">
            <div className="grid grid-cols-3 gap-2 w-[92%] sm:w-[88%]">
              {[POPULAR_VIBES[4], POPULAR_VIBES[5], POPULAR_VIBES[6]].map((vibe) => (
                <button
                  key={vibe.label}
                  onClick={() => handleVibeClick(vibe.categoryMatch || vibe.label)}
                  className={`flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 py-3 rounded-full text-[10px] sm:text-xs font-black uppercase text-white bg-gradient-to-r ${vibe.color} border transition-all transform hover:scale-105 active:scale-95 cursor-pointer`}
                >
                  <span className="text-base sm:text-lg shrink-0">{vibe.icon}</span>
                  <span className="truncate tracking-wide">{vibe.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Row 4: Festas, Teatro & Sertanejo */}
          <div className="flex justify-center w-full">
            <div className="grid grid-cols-3 gap-2 w-[92%] sm:w-[88%]">
              {[POPULAR_VIBES[7], POPULAR_VIBES[8], POPULAR_VIBES[9]].map((vibe) => (
                <button
                  key={vibe.label}
                  onClick={() => handleVibeClick(vibe.categoryMatch || vibe.label)}
                  className={`flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 py-3 rounded-full text-[10px] sm:text-xs font-black uppercase text-white bg-gradient-to-r ${vibe.color} border transition-all transform hover:scale-105 active:scale-95 cursor-pointer`}
                >
                  <span className="text-base sm:text-lg shrink-0">{vibe.icon}</span>
                  <span className="truncate tracking-wide">{vibe.label}</span>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* "Divulgar Evento" Large Gold Glowing Button */}
        <div className="w-full max-w-xl mb-2.5 sm:mb-3 px-2">
          <button
            id="btn-hero-cadastrar-evento"
            onClick={() => onNavigate('register')}
            className="w-full flex items-center justify-between px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-300 text-slate-950 font-black text-xs sm:text-base shadow-[0_0_15px_rgba(250,204,21,0.65)] hover:shadow-[0_0_25px_rgba(250,204,21,0.95)] border border-yellow-200 hover:border-white transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer select-none"
          >
            <span className="text-base sm:text-lg shrink-0">➕</span>
            <span className="uppercase tracking-wider font-extrabold flex-1 text-center text-xs sm:text-sm">Divulgar Evento</span>
            <span className="text-base sm:text-lg shrink-0 animate-bounce">👆</span>
          </button>
        </div>

        {/* Opção 1: Cartazes dos eventos exibidos diretamente abaixo de Divulgar Evento */}
        {SHOW_HOME_UPCOMING_EVENTS && (
          <HomeUpcomingEventsFeed
            onSelectEvent={props.onSelectEvent}
            onExploreAll={() => handleVibeClick('Todas')}
            preloadedEvents={props.homeFeedEvents}
            isPreloaded={props.isHomeFeedLoaded}
          />
        )}

        {/* Pergunta direta e simples: Quer gravar o ícone no celular? Sim ou Não */}
        {!isAppInstalled && !dismissedIconPrompt && (onOpenInstall || onPromptInstall) && (
          <div className="w-full max-w-xl mb-2.5 sm:mb-3 px-2">
            <div className="flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl bg-slate-900/90 border border-amber-500/45 shadow-md shadow-amber-500/10">
              <div className="flex items-center gap-2 text-left min-w-0">
                <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-slate-100 leading-tight">
                  Quer gravar o ícone no celular?
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  id="btn-hero-install-pwa-yes"
                  type="button"
                  onClick={async () => {
                    if (hasNativePrompt && onPromptInstall) {
                      const outcome = await onPromptInstall();
                      if (outcome === 'manual') {
                        onOpenInstall?.(true);
                      }
                    } else {
                      onOpenInstall?.(true);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all active:scale-95 cursor-pointer"
                >
                  Sim
                </button>
                <button
                  id="btn-hero-install-pwa-no"
                  type="button"
                  onClick={() => setDismissedIconPrompt(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-all active:scale-95 cursor-pointer"
                >
                  Não
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Central de Gerenciamento (Administrative discrete button) */}
        {onOpenAdmin && (
          <div className="mt-6 mb-2 w-full flex justify-center">
            <button
              id="btn-hero-administracao"
              onClick={onOpenAdmin}
              className="group flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-900/40 hover:bg-slate-900/80 text-slate-400 hover:text-amber-400 text-[11px] font-black uppercase border border-slate-800 hover:border-amber-500/30 transition-all cursor-pointer shadow-sm backdrop-blur-md"
            >
              <ShieldCheck className="w-4 h-4 text-amber-500/70 group-hover:scale-110 transition-transform duration-200" />
              <span>Central de Gerenciamento</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Footer with GPS Capsule & Right-side slogan matching mockup perfectly */}
      <div className="relative border-t border-slate-900 bg-slate-950/90 py-6 px-4">
        
        {/* Background silhouette of crowd */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-purple-950/15 to-transparent pointer-events-none opacity-40 select-none z-0" />

        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
          
          {/* Bottom Left Green Glowing GPS Capsule */}
          <button 
            onClick={requestLocation}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/40 bg-emerald-950/80 hover:bg-emerald-900/85 text-emerald-400 font-extrabold text-xs shadow-[0_0_15px_rgba(16,185,129,0.35)] select-none cursor-pointer transition-all hover:scale-105 active:scale-95 text-left"
            title={status === 'granted' && coords ? `Lat: ${coords.latitude.toFixed(4)}, Lng: ${coords.longitude.toFixed(4)}. Clique para atualizar.` : 'Clique para ativar seu GPS e ver a distância real exata dos eventos.'}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>📍 🚀 GPS: {status === 'granted' && coords ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` : 'Ativar GPS Real ⚡'}</span>
          </button>

          {/* Bottom Right Handwritten Yellow Slogan */}
          <div className="text-center md:text-right select-none">
            <span className="text-yellow-300 font-extrabold italic text-sm sm:text-base drop-shadow-[0_0_8px_rgba(253,224,71,0.5)] font-serif tracking-wider">
              Saia, divirta-se, conheça gente nova! ❤️
            </span>
          </div>
          
        </div>

        {/* Footer Credit Line */}
        <div className="max-w-5xl mx-auto mt-6 pt-4 border-t border-slate-900 text-center text-[10px] text-slate-500 relative z-10">
          <p className="flex items-center justify-center gap-1.5 flex-wrap">
            <span className="font-bold text-amber-500">Pra onde eu vou</span>
            <span>© 2026 • Feito com carinho para levar alegria, encontros e momentos inesquecíveis a você.</span>
            <Heart className="w-3 h-3 text-rose-500 fill-rose-500 inline" />
          </p>
        </div>
      </div>
    </div>
  );
};
