import React, { useState, useEffect } from 'react';
import { EventItem, EventCategory, ActiveScreen, Advertiser, CategoryItem } from './types';
import { INITIAL_EVENTS } from './data/initialEvents';
import { INITIAL_ADVERTISERS } from './data/initialAdvertisers';
import { Navbar } from './components/Navbar';
import { PresentationScreen } from './components/PresentationScreen';
import { EventCatalog } from './components/EventCatalog';
import { EventRegister } from './components/EventRegister';
import { EventDetailModal } from './components/EventDetailModal';
import { AdvertiserAuth } from './components/AdvertiserAuth';
import { SqlConsoleModal } from './components/SqlConsoleModal';
import { AdminModal } from './components/AdminModal';

const STORAGE_KEY = 'praonde_events_data_v2';
const ADVERTISERS_STORAGE_KEY = 'praonde_advertisers_v1';
const CURRENT_ADVERTISER_KEY = 'praonde_current_advertiser_v1';
const CATEGORIES_STORAGE_KEY = 'praonde_categories_v1';

const INITIAL_CATEGORIES: string[] = [
  'Shows',
  'Samba e Pagode',
  'Baile Nostalgia',
  'Baile Terceira Idade',
  'Forró',
  'Forró Pé de Serra',
];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ActiveScreen>('home');

  // Categories State & Persistence
  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(CATEGORIES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading categories from storage', e);
    }
    return INITIAL_CATEGORIES;
  });

  const [categoryItems, setCategoryItems] = useState<CategoryItem[]>([]);
  
  // Advertisers State & Persistence
  const [advertisers, setAdvertisers] = useState<Advertiser[]>(() => {
    try {
      const saved = localStorage.getItem(ADVERTISERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading advertisers from storage', e);
    }
    return INITIAL_ADVERTISERS;
  });

  const [currentAdvertiser, setCurrentAdvertiser] = useState<Advertiser | null>(() => {
    try {
      const saved = localStorage.getItem(CURRENT_ADVERTISER_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading current advertiser from storage', e);
    }
    return null;
  });

  // Events State & Persistence
  const [events, setEvents] = useState<EventItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading events from storage', e);
    }
    return INITIAL_EVENTS;
  });

  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [catalogInitialQuery, setCatalogInitialQuery] = useState<string>('');
  const [isSqlConsoleOpen, setIsSqlConsoleOpen] = useState<boolean>(false);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);

  // Sync with backend SQLite database
  const loadEventsFromApi = async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setEvents(data);
        }
      }
    } catch (e) {
      console.warn('Usando armazenamento local de eventos:', e);
    }
  };

  const loadCategoriesFromApi = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data: CategoryItem[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCategoryItems(data);
          const names = data.map((c) => c.nome);
          setCategories(names);
        }
      }
    } catch (e) {
      console.warn('Usando categorias locais:', e);
    }
  };

  useEffect(() => {
    loadEventsFromApi();
    loadCategoriesFromApi();
  }, []);

  // Persist events whenever modified
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch (e) {
      console.error('Error saving events to storage', e);
    }
  }, [events]);

  // Persist advertisers list
  useEffect(() => {
    try {
      localStorage.setItem(ADVERTISERS_STORAGE_KEY, JSON.stringify(advertisers));
    } catch (e) {
      console.error('Error saving advertisers to storage', e);
    }
  }, [advertisers]);

  // Persist categories list
  useEffect(() => {
    try {
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    } catch (e) {
      console.error('Error saving categories to storage', e);
    }
  }, [categories]);

  const handleAddCategory = async (categoryName: string) => {
    const trimmed = categoryName.trim();
    if (!trimmed) return;

    if (!categories.includes(trimmed)) {
      setCategories((prev) => [...prev, trimmed]);
    }

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: trimmed }),
      });
      if (res.ok) {
        const created: CategoryItem = await res.json();
        setCategoryItems((prev) => [...prev.filter((c) => c.id !== created.id), created]);
      }
    } catch (err) {
      console.warn('Erro ao salvar categoria no SQLite:', err);
    }
  };

  const handleDeleteCategory = async (categoryName: string) => {
    setCategories((prev) => prev.filter((c) => c !== categoryName));

    const item = categoryItems.find((c) => c.nome.toLowerCase() === categoryName.toLowerCase());
    if (item) {
      setCategoryItems((prev) => prev.filter((c) => c.id !== item.id));
      try {
        await fetch(`/api/categories/${item.id}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Erro ao deletar categoria no SQLite:', err);
      }
    }
  };

  const handleAddEvent = async (newEvent: EventItem): Promise<EventItem> => {
    // Save directly to SQLite database and get geocoded coordinates
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newEvent,
          advertiserId: currentAdvertiser?.id,
        }),
      });

      if (res.ok) {
        const savedData: EventItem = await res.json();
        setEvents((prev) => [savedData, ...prev.filter((e) => e.id !== savedData.id && e.id !== newEvent.id)]);
        return savedData;
      }
    } catch (e) {
      console.error('Erro ao gravar evento no SQLite:', e);
    }

    setEvents((prev) => [newEvent, ...prev.filter((e) => e.id !== newEvent.id)]);
    return newEvent;
  };

  const handleDeleteEvent = async (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    if (selectedEvent?.id === id) {
      setSelectedEvent(null);
    }

    try {
      await fetch(`/api/events/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Erro ao excluir evento do SQLite:', e);
    }
  };

  const handleToggleLiberado = async (id: string, currentLiberado: string) => {
    const nextLiberado = currentLiberado === 'S' ? 'N' : 'S';
    setEvents((prev) =>
      prev.map((evt) => (evt.id === id ? { ...evt, liberado: nextLiberado } : evt))
    );

    try {
      await fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liberado: nextLiberado }),
      });
    } catch (e) {
      console.warn('Erro ao atualizar status liberado no SQLite:', e);
    }
  };

  const handleSetLiberado = async (id: string, nextLiberado: 'S' | 'N') => {
    setEvents((prev) =>
      prev.map((evt) => (evt.id === id ? { ...evt, liberado: nextLiberado } : evt))
    );

    try {
      await fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liberado: nextLiberado }),
      });
    } catch (e) {
      console.warn('Erro ao atualizar status liberado no SQLite:', e);
    }
  };

  const handleSearchRedirect = (term: string) => {
    setCatalogInitialQuery(term);
    setCurrentScreen('events');
  };

  const handleNavigate = (screen: ActiveScreen) => {
    if (screen !== 'events') {
      setCatalogInitialQuery('');
    }

    // Before registering an event, check if advertiser is identified
    if (screen === 'register' && !currentAdvertiser) {
      setCurrentScreen('advertiser_auth');
    } else {
      setCurrentScreen(screen);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChangeAdvertiser = () => {
    setCurrentAdvertiser(null);
    setCurrentScreen('advertiser_auth');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdvertiserAuthSuccess = (advertiser: Advertiser) => {
    setCurrentAdvertiser(advertiser);
    setCurrentScreen('register');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Navbar */}
      <Navbar
        currentScreen={currentScreen}
        onNavigate={handleNavigate}
        eventCount={events.length}
        currentAdvertiser={currentAdvertiser}
        onOpenAdvertiserAuth={handleChangeAdvertiser}
        onOpenSqlConsole={() => setIsSqlConsoleOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
      />

      {/* Main Content Router */}
      <main className="flex-1 flex flex-col">
        {currentScreen === 'home' && (
          <PresentationScreen
            onNavigate={handleNavigate}
            events={events}
            onSelectEvent={setSelectedEvent}
            onSearchRedirect={handleSearchRedirect}
            onOpenAdmin={() => setIsAdminOpen(true)}
          />
        )}

        {currentScreen === 'events' && (
          <EventCatalog
            events={events}
            onNavigate={handleNavigate}
            onSelectEvent={setSelectedEvent}
            initialQuery={catalogInitialQuery}
            onDeleteEvent={handleDeleteEvent}
          />
        )}

        {currentScreen === 'advertiser_auth' && (
          <AdvertiserAuth
            onSuccess={handleAdvertiserAuthSuccess}
            onNavigate={handleNavigate}
            registeredAdvertisers={advertisers}
            onRegisterAdvertiser={(newAdv) => {
              setAdvertisers((prev) => [newAdv, ...prev]);
            }}
          />
        )}

        {currentScreen === 'register' && (
          <EventRegister
            onAddEvent={handleAddEvent}
            onNavigate={handleNavigate}
            onSelectEvent={(evt) => {
              setSelectedEvent(evt);
              handleNavigate('events');
            }}
            currentAdvertiser={currentAdvertiser}
            onChangeAdvertiser={handleChangeAdvertiser}
          />
        )}
      </main>

      {/* Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={handleDeleteEvent}
        />
      )}

      {/* SQL Database Console Modal */}
      <SqlConsoleModal
        isOpen={isSqlConsoleOpen}
        onClose={() => setIsSqlConsoleOpen(false)}
        onEventModified={loadEventsFromApi}
      />

      {/* Admin Panel Modal */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        events={events}
        advertisers={advertisers}
        categories={categories}
        categoryItems={categoryItems}
        onAddCategory={handleAddCategory}
        onDeleteCategory={handleDeleteCategory}
        onDeleteEvent={handleDeleteEvent}
        onToggleLiberado={handleToggleLiberado}
        onSetLiberado={handleSetLiberado}
        onSelectEvent={setSelectedEvent}
        onOpenSqlConsole={() => setIsSqlConsoleOpen(true)}
      />
    </div>
  );
}
