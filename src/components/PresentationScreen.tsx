import React, { useState } from 'react';
import { 
  Compass, 
  PlusCircle, 
  Calendar, 
  MapPin, 
  Sparkles, 
  TrendingUp, 
  Search, 
  Tag, 
  ArrowRight,
  CheckCircle2,
  Users,
  ShieldCheck
} from 'lucide-react';
import { EventItem, ActiveScreen } from '../types';
import appIconUrl from '../assets/images/app_icon_1788820561686.jpg';

interface PresentationScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
  events: EventItem[];
  onSelectEvent: (event: EventItem) => void;
  onSearchRedirect: (term: string) => void;
  onOpenAdmin?: () => void;
}

export const PresentationScreen: React.FC<PresentationScreenProps> = ({
  onNavigate,
  events,
  onSelectEvent,
  onSearchRedirect,
  onOpenAdmin,
}) => {
  const [quickQuery, setQuickQuery] = useState('');

  const featuredEvents = events.filter((e) => e.featured).slice(0, 3);
  const totalCities = new Set(events.map((e) => e.city)).size;

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickQuery.trim()) {
      onSearchRedirect(quickQuery.trim());
    } else {
      onNavigate('events');
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-between overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-amber-600/15 via-orange-500/10 to-indigo-600/15 blur-3xl -z-10 pointer-events-none rounded-full" />

      {/* Top Bar on Initial Screen */}
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 flex items-center justify-between z-10">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm">
          <Sparkles className="w-3 h-3" />
          Guia de Eventos & Atrações
        </span>

        {onOpenAdmin && (
          <button
            id="btn-home-admin-top"
            onClick={onOpenAdmin}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-amber-400 border border-slate-800 hover:border-amber-400/50 text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Administração</span>
          </button>
        )}
      </div>

      {/* Main Hero Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-12 sm:pb-16 w-full text-center flex-1 flex flex-col items-center justify-center">
        {/* App Icon Presentation Card */}
        <div className="relative mb-5 sm:mb-6 group">
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-500 rounded-3xl blur-md opacity-40 group-hover:opacity-75 transition duration-500" />
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-3xl overflow-hidden ring-2 ring-amber-400/40 bg-slate-900 shadow-2xl p-1">
            <img
              src={appIconUrl}
              alt="Ícone do app Pra onde eu vou"
              className="w-full h-full object-cover rounded-2xl shadow-inner transform group-hover:scale-105 transition-transform duration-300"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 p-1.5 rounded-full shadow-lg border-2 border-slate-950">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>

        {/* Brand Title */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-3 sm:mb-4">
          Pra onde eu <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-amber-200">vou</span>?
        </h1>

        {/* Subtitle / Tagline */}
        <p className="max-w-2xl text-sm sm:text-lg text-slate-300 font-normal leading-relaxed mb-6 sm:mb-8 px-2">
          O seu ponto de encontro para descobrir o que está rolando na cidade.
          Encontre os melhores shows, festivais, gastronomia e eventos culturais ou cadastre a sua própria atração para o público.
        </p>

        {/* Primary Action Buttons */}
        <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8 sm:mb-10 px-2">
          <button
            id="btn-hero-consultar-eventos"
            onClick={() => onNavigate('events')}
            className="group flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm sm:text-base shadow-lg shadow-amber-500/20 hover:shadow-amber-500/35 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer min-h-[48px]"
          >
            <Compass className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" />
            <span>Consultar Eventos</span>
          </button>

          <button
            id="btn-hero-cadastrar-evento"
            onClick={() => onNavigate('register')}
            className="group flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-bold text-sm sm:text-base border border-slate-700/80 hover:border-amber-400/50 shadow-md transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer min-h-[48px]"
          >
            <PlusCircle className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform duration-200" />
            <span>Cadastrar Evento</span>
          </button>

          {onOpenAdmin && (
            <button
              id="btn-hero-administracao"
              onClick={onOpenAdmin}
              className="group flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-sm sm:text-base border border-slate-700/80 hover:border-amber-400/50 shadow-md transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer min-h-[48px]"
            >
              <ShieldCheck className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform duration-200" />
              <span>Administração</span>
            </button>
          )}
        </div>

        {/* Quick Search Shortcut Bar */}
        <form
          onSubmit={handleQuickSearch}
          className="w-full max-w-xl relative flex items-center mb-12"
        >
          <div className="absolute left-4 text-slate-400 pointer-events-none">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="input-quick-search-home"
            type="text"
            value={quickQuery}
            onChange={(e) => setQuickQuery(e.target.value)}
            placeholder="Pesquisar por show, festival, cidade (ex: São Paulo, MPB)..."
            className="w-full pl-11 pr-28 py-3.5 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/80 shadow-inner"
          />
          <button
            type="submit"
            className="absolute right-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg transition-colors"
          >
            Buscar
          </button>
        </form>

        {/* Highlights / Badges Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-3xl mb-14 text-left">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{events.length}</div>
              <div className="text-xs text-slate-400">Eventos cadastrados</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{totalCities} cidades</div>
              <div className="text-xs text-slate-400">Com programação ativa</div>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">100% Grátis</div>
              <div className="text-xs text-slate-400">Para consultar e publicar</div>
            </div>
          </div>
        </div>

        {/* Featured Events Carousel / Preview Section */}
        {featuredEvents.length > 0 && (
          <div className="w-full max-w-5xl text-left pt-6 border-t border-slate-800/60">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                <h2 className="text-xl font-bold text-white">Eventos em Destaque</h2>
              </div>
              <button
                onClick={() => onNavigate('events')}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 group"
              >
                <span>Ver todos os {events.length} eventos</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {featuredEvents.map((event) => (
                <div
                  key={event.id}
                  onClick={() => onSelectEvent(event)}
                  className="group cursor-pointer bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl overflow-hidden shadow-md transition-all duration-200 flex flex-col justify-between"
                >
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src={event.imageUrl}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                    <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-sm text-[11px] font-semibold text-amber-300 px-2.5 py-1 rounded-md border border-amber-500/30">
                      {event.category}
                    </div>
                    <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-xs text-slate-200">
                      <span className="flex items-center gap-1 font-medium bg-slate-950/80 px-2 py-0.5 rounded backdrop-blur-sm">
                        <Calendar className="w-3 h-3 text-amber-400" />
                        {new Date(event.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                        })} • {event.time}
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold backdrop-blur-sm ${
                        event.isFree ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-950/80 text-amber-400'
                      }`}>
                        {event.isFree ? 'Gratuito' : `R$ ${event.price?.toFixed(2).replace('.', ',')}`}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-white text-base group-hover:text-amber-400 transition-colors line-clamp-1 mb-1">
                        {event.title}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                        {event.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span className="truncate">{event.locationName} • {event.city}/{event.state}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-6 px-4 text-center text-xs text-slate-500 bg-slate-950/60">
        <p>
          <span className="font-semibold text-slate-400">Pra onde eu vou</span> © 2026 • Seu guia inteligente de eventos e programação cultural.
        </p>
      </footer>
    </div>
  );
};
