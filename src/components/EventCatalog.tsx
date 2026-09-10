import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Calendar,
  MapPin, 
  ArrowLeft, 
  Heart, 
  SlidersHorizontal,
  DollarSign,
  Sparkles,
  ChevronRight,
  ChevronDown,
  X
} from 'lucide-react';
import { EventItem, EventCategory, ActiveScreen } from '../types';

interface EventCatalogProps {
  events: EventItem[];
  onNavigate: (screen: ActiveScreen) => void;
  onSelectEvent: (event: EventItem) => void;
  initialQuery?: string;
  onDeleteEvent: (id: string) => void;
}

const BASE_CATEGORIES = [
  'Todas',
  'Shows',
  'Samba e Pagode',
  'Baile e Nostalgia',
  'Baile Terceira Idade',
  'Forró',
  'Forró Pé de Serra',
];

export const EventCatalog: React.FC<EventCatalogProps> = ({
  events,
  onNavigate,
  onSelectEvent,
  initialQuery = '',
  onDeleteEvent,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [selectedCity, setSelectedCity] = useState<string>('Todas');
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('praonde_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavoriteIds((prev) => {
      const updated = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem('praonde_favorites', JSON.stringify(updated));
      } catch (err) {
        // ignore
      }
      return updated;
    });
  };

  // Dynamic category options from default list and any events registered
  const categoryOptions = useMemo(() => {
    const list = [...BASE_CATEGORIES];
    events.forEach((e) => {
      if (e.category) {
        const exists = list.some(
          (c) =>
            c.toLowerCase().replace(/\s+e\s+/g, ' ') ===
            e.category.toLowerCase().replace(/\s+e\s+/g, ' ')
        );
        if (!exists) {
          list.push(e.category);
        }
      }
    });
    return list;
  }, [events]);

  // Extract unique cities
  const cities = useMemo(() => {
    const set = new Set(events.map((e) => e.city));
    return ['Todas', ...Array.from(set).sort()];
  }, [events]);

  // Filtered & Sorted events
  const filteredEvents = useMemo(() => {
    return events
      .filter((event) => {
        // Query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = event.title.toLowerCase().includes(q);
          const matchDesc = event.description.toLowerCase().includes(q);
          const matchCity = event.city.toLowerCase().includes(q);
          const matchLocation = event.locationName.toLowerCase().includes(q);
          const matchTag = event.tags?.some((t) => t.toLowerCase().includes(q));
          if (!matchTitle && !matchDesc && !matchCity && !matchLocation && !matchTag) {
            return false;
          }
        }

        // Category filter (handles both 'Baile Nostalgia' and 'Baile e Nostalgia', and any custom categories)
        if (selectedCategory !== 'Todas') {
          const selNorm = selectedCategory.toLowerCase().replace(/\s+e\s+/g, ' ').trim();
          const evtNorm = (event.category || '').toLowerCase().replace(/\s+e\s+/g, ' ').trim();
          if (selectedCategory !== event.category && selNorm !== evtNorm) {
            return false;
          }
        }

        // City filter
        if (selectedCity !== 'Todas' && event.city !== selectedCity) {
          return false;
        }

        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events, searchQuery, selectedCategory, selectedCity]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('Todas');
    setSelectedCity('Todas');
  };

  const handleSelectEvents = () => {
    // Ponto de integração preparado para os dados/critérios de seleção
    console.log('Efetuar seleção dos eventos:', {
      searchQuery,
      selectedCategory,
      selectedCity,
    });
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCategory !== 'Todas' ||
    selectedCity !== 'Todas';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            id="btn-catalog-back-home"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Início</span>
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">
            Consultar Eventos
          </h1>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {filteredEvents.length} disponíveis
          </span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="pt-6 pb-4 space-y-4">
        {/* Main Search Bar & Select Combos */}
        <div className="flex flex-col md:flex-row items-stretch gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="input-catalog-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome do evento, cidade, local ou estilo..."
              className="w-full pl-10 pr-10 py-3 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/60 transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Combo (Dropdown) */}
          <div className="w-full md:w-64">
            <div className="relative">
              <select
                id="select-catalog-category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full py-3 pl-3.5 pr-9 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/60 appearance-none cursor-pointer"
              >
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat} className="bg-slate-900 text-white">
                    {cat === 'Todas' ? 'Categorias' : cat}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* City select */}
          <div className="w-full md:w-56">
            <div className="relative">
              <select
                id="select-catalog-city"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full py-3 pl-3.5 pr-9 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/60 appearance-none cursor-pointer"
              >
                {cities.map((city) => (
                  <option key={city} value={city} className="bg-slate-900 text-white">
                    {city === 'Todas' ? 'Cidades' : `📍 ${city}`}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Selection button after city field */}
          <div className="w-full md:w-auto">
            <button
              id="btn-catalog-select-events"
              type="button"
              onClick={handleSelectEvents}
              className="w-full md:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-sm font-bold shadow-md shadow-amber-500/20 hover:shadow-amber-500/35 transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer active:scale-95"
            >
              <Filter className="w-4 h-4 text-slate-950" />
              <span>Selecionar Eventos</span>
            </button>
          </div>
        </div>

        {/* Filter Summary */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <div className="flex items-center gap-2">
            <span>
              Exibindo <strong className="text-white">{filteredEvents.length}</strong> de {events.length} eventos
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-amber-400 hover:underline flex items-center gap-1 ml-2 font-medium"
              >
                <X className="w-3 h-3" />
                Limpar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Events Grid */}
      {filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          {filteredEvents.map((event) => {
            const isFav = favoriteIds.includes(event.id);

            return (
              <div
                key={event.id}
                onClick={() => onSelectEvent(event)}
                className="group relative bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl overflow-hidden shadow-lg transition-all duration-200 flex flex-col justify-between cursor-pointer"
              >
                {/* Thumbnail Header */}
                <div className="relative h-48 w-full overflow-hidden bg-slate-950">
                  <img
                    src={event.imageUrl}
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />

                  {/* Favorite Button */}
                  <button
                    onClick={(e) => toggleFavorite(e, event.id)}
                    className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-transform active:scale-90 ${
                      isFav
                        ? 'bg-rose-500 text-white shadow-md'
                        : 'bg-slate-950/70 hover:bg-slate-950 text-slate-300 border border-slate-700/60'
                    }`}
                    title={isFav ? 'Remover dos salvos' : 'Salvar evento'}
                  >
                    <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                  </button>

                  {/* Category Pill */}
                  <div className="absolute bottom-2 left-3">
                    <span className="inline-block text-[11px] font-semibold text-amber-300 bg-slate-950/80 px-2.5 py-0.5 rounded-md backdrop-blur-sm border border-amber-500/20">
                      {event.category}
                    </span>
                  </div>

                  {/* Price Pill */}
                  <div className="absolute bottom-2 right-3">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm shadow-sm ${
                      event.isFree
                        ? 'bg-emerald-500 text-slate-950 font-extrabold'
                        : 'bg-slate-950/90 text-amber-300 border border-amber-500/30'
                    }`}>
                      {event.isFree ? 'Gratuito' : `R$ ${event.price?.toFixed(2).replace('.', ',')}`}
                    </span>
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base sm:text-lg group-hover:text-amber-400 transition-colors line-clamp-1 mb-1.5">
                      {event.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                      {event.description}
                    </p>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span>{new Date(event.date + 'T12:00:00').toLocaleDateString('pt-BR')} • {event.time}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span className="truncate">{event.locationName} ({event.city} - {event.state})</span>
                    </div>

                    {/* View Details button */}
                    <div className="pt-2 flex items-center justify-between text-xs text-amber-400 font-bold group-hover:text-amber-300">
                      <span>Ver detalhes completos</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-16 px-4 bg-slate-900/40 rounded-2xl border border-slate-800/80 mt-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Nenhum evento encontrado</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
            Não encontramos eventos com os filtros selecionados. Experimente ajustar os termos de busca ou limpar os filtros.
          </p>
          <div className="flex items-center justify-center">
            <button
              onClick={clearFilters}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
