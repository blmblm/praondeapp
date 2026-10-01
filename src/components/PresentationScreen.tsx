import React from 'react';
import { 
  PlusCircle, 
  ShieldCheck,
  PartyPopper,
  Music,
  Heart
} from 'lucide-react';
import { EventItem, ActiveScreen } from '../types';
import appIconUrl from '../assets/images/app_icon_1788820561686.jpg';
import { SponsorsShowcase } from './SponsorsShowcase';
import { SponsorItem } from '../data/sponsors';

interface PresentationScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
  events: EventItem[];
  onSelectEvent: (event: EventItem) => void;
  onSearchRedirect: (term: string) => void;
  onOpenAdmin?: () => void;
  sponsors?: SponsorItem[];
  categories?: string[];
  cidadesList?: any[];
  onDiscoverySearch?: (filters: { category: string; estado: string; date: string; sortByProximity: boolean }) => void;
}

// Ordem exata solicitada pelo usuário:
// 1. Baile Nostalgia, 2. Samba e Pagode, 3. Baile Terceira Idade, 4. Forró, 5. Forró Pé de Serra, 6. Bailes, 7. Shows, 8. Festas
const POPULAR_VIBES = [
  { 
    label: 'Baile Nostalgia', 
    categoryMatch: 'Baile Nostalgia', 
    icon: '🕺', 
    color: 'from-purple-500/25 via-pink-500/20 to-purple-600/30 text-purple-200 border-purple-400/50 hover:border-purple-300 shadow-purple-500/15' 
  },
  { 
    label: 'Samba e Pagode', 
    categoryMatch: 'Samba e Pagode', 
    icon: '🥁', 
    color: 'from-amber-500/25 via-orange-500/20 to-amber-600/30 text-amber-200 border-amber-400/50 hover:border-amber-300 shadow-amber-500/15' 
  },
  { 
    label: 'Baile Melhor Idade', 
    categoryMatch: 'Baile Terceira Idade', 
    icon: '💃', 
    color: 'from-emerald-500/25 via-teal-500/20 to-emerald-600/30 text-emerald-200 border-emerald-400/50 hover:border-emerald-300 shadow-emerald-500/15' 
  },
  { 
    label: 'Forró', 
    categoryMatch: 'Forró', 
    icon: '🪗', 
    color: 'from-orange-500/25 via-amber-500/20 to-orange-600/30 text-orange-200 border-orange-400/50 hover:border-orange-300 shadow-orange-500/15' 
  },
  { 
    label: 'Forró Pé de Serra', 
    categoryMatch: 'Forró Pé de Serra', 
    icon: '🌵', 
    color: 'from-yellow-500/25 via-orange-500/20 to-yellow-600/30 text-yellow-200 border-yellow-400/50 hover:border-yellow-300 shadow-yellow-500/15' 
  },
  { 
    label: 'Bailes', 
    categoryMatch: 'Bailes', 
    icon: '🎶', 
    color: 'from-indigo-500/25 via-purple-500/20 to-indigo-600/30 text-indigo-200 border-indigo-400/50 hover:border-indigo-300 shadow-indigo-500/15' 
  },
  { 
    label: 'Shows', 
    categoryMatch: 'Shows', 
    icon: '🎸', 
    color: 'from-rose-500/25 via-red-500/20 to-rose-600/30 text-rose-200 border-rose-400/50 hover:border-rose-300 shadow-rose-500/15' 
  },
  { 
    label: 'Festas', 
    categoryMatch: 'Festas', 
    icon: '🎉', 
    color: 'from-pink-500/25 via-rose-500/20 to-pink-600/30 text-pink-200 border-pink-400/50 hover:border-pink-300 shadow-pink-500/15' 
  },
  { 
    label: 'Teatro', 
    categoryMatch: 'Teatro', 
    icon: '🎭', 
    color: 'from-cyan-500/25 via-blue-500/20 to-cyan-600/30 text-cyan-200 border-cyan-400/50 hover:border-cyan-300 shadow-cyan-500/15' 
  },
];

export const PresentationScreen: React.FC<PresentationScreenProps> = (props) => {
  const {
    onNavigate,
    onSearchRedirect,
    onOpenAdmin,
    sponsors = [],
  } = props;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-between overflow-hidden">
      {/* Ambient warm festive lights glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-amber-500/20 via-orange-500/15 to-rose-500/20 blur-[90px] -z-10 pointer-events-none rounded-full" />
      <div className="absolute top-1/3 left-10 w-[300px] h-[300px] bg-amber-600/10 blur-[80px] -z-10 pointer-events-none rounded-full" />
      <div className="absolute top-1/4 right-10 w-[300px] h-[300px] bg-rose-600/10 blur-[80px] -z-10 pointer-events-none rounded-full" />

      {/* Main Hero Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-0 sm:pt-1 pb-6 sm:pb-8 w-full text-center flex-1 flex flex-col items-center justify-start">
        {/* App Icon Presentation Card (reduzido em 30%) */}
        <div className="relative mb-2 group">
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 rounded-2xl blur-md opacity-60 group-hover:opacity-90 transition duration-500 animate-pulse" />
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden ring-2 ring-amber-400/60 bg-slate-900 shadow-xl p-0.5">
            <img
              src={appIconUrl}
              alt="Ícone do app Pra onde eu vou"
              className="w-full h-full object-cover rounded-xl shadow-inner transform group-hover:scale-105 transition-transform duration-300"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-slate-950 p-1 rounded-full shadow-lg border-2 border-slate-950">
            <PartyPopper className="w-3 h-3 text-slate-950" />
          </div>
        </div>

        {/* Brand Title */}
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-1">
          Pra onde eu <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400">vou</span>?
        </h1>

        {/* Cheerful Tagline */}
        <p className="max-w-2xl text-sm sm:text-lg text-amber-200 font-semibold leading-relaxed mb-3 sm:mb-4 px-3 tracking-wide">
          A vida e feita de momentos que aquecem o coração
        </p>

        {/* Quick Vibe Selector: direct mood pills */}
        <div className="w-full max-w-4xl mb-4 sm:mb-5 px-2">
          <p className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-300 mb-2 sm:mb-2.5 flex items-center justify-center gap-2">
            <Music className="w-4 h-4 text-amber-400" />
            <span>QUAL É O SEU RITMO HOJE? ESCOLHA E VEJA OS EVENTOS:</span>
          </p>
          {/* Destaques Principais: Baile Nostalgia e Samba e Pagode lado a lado */}
          <div className="flex flex-row items-center justify-center gap-2 sm:gap-3 mb-2 w-full max-w-lg mx-auto">
            {POPULAR_VIBES.slice(0, 2).map((vibe) => (
              <button
                key={vibe.label}
                onClick={() => onSearchRedirect(vibe.categoryMatch || vibe.label)}
                className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-gradient-to-r ${vibe.color} border shadow-md transition-all transform hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md whitespace-nowrap min-w-0`}
              >
                <span className="text-base sm:text-lg shrink-0">{vibe.icon}</span>
                <span className="truncate">{vibe.label}</span>
              </button>
            ))}
          </div>

          {/* Demais Ritmos */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            {POPULAR_VIBES.slice(2).map((vibe) => (
              <button
                key={vibe.label}
                onClick={() => onSearchRedirect(vibe.categoryMatch || vibe.label)}
                className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-gradient-to-r ${vibe.color} border shadow-md transition-all transform hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md`}
              >
                <span className="text-base sm:text-lg">{vibe.icon}</span>
                <span>{vibe.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="w-full max-w-xs mb-4 sm:mb-5 px-2">
          <button
            id="btn-hero-cadastrar-evento"
            onClick={() => onNavigate('register')}
            className="group w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 hover:from-amber-300 hover:via-orange-400 hover:to-rose-400 text-slate-950 font-extrabold text-sm sm:text-base shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer min-h-[48px]"
          >
            <PlusCircle className="w-5 h-5 text-slate-950 group-hover:scale-110 transition-transform duration-200" />
            <span>Divulgar Evento</span>
          </button>
        </div>

        {/* Vitrine de 5 Patrocinadores Recomendados por Proximidade */}
        <div className="w-full">
          <SponsorsShowcase 
            sponsors={sponsors} 
            onOpenRegisterSponsor={() => onNavigate('sponsor_register')}
          />
        </div>

        {/* Central de Gerenciamento (Administrative discrete button before footer) */}
        {onOpenAdmin && (
          <div className="mt-8 mb-1 w-full flex justify-center">
            <button
              id="btn-hero-administracao"
              onClick={onOpenAdmin}
              className="group flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/40 hover:bg-slate-900/80 text-slate-400 hover:text-amber-400 text-[11px] font-extrabold border border-slate-800/60 hover:border-amber-500/30 transition-all cursor-pointer shadow-sm backdrop-blur-md"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500/70 group-hover:scale-110 transition-transform duration-200" />
              <span>Central de Gerenciamento</span>
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-6 px-4 text-center text-xs text-slate-400 bg-slate-950/70">
        <p className="flex items-center justify-center gap-1.5 flex-wrap">
          <span className="font-bold text-amber-400">Pra onde eu vou</span>
          <span>© 2026 • Feito com carinho para levar alegria, encontros e momentos inesquecíveis a você.</span>
          <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline" />
        </p>
      </footer>
    </div>
  );
};
