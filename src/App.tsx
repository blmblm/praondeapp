import React, { useState, useEffect } from 'react';
import { EventItem, EventCategory, ActiveScreen, Advertiser, CategoryItem, CidadeItem } from './types';
import { INITIAL_EVENTS } from './data/initialEvents';
import { INITIAL_ADVERTISERS } from './data/initialAdvertisers';
import { INITIAL_SPONSORS, SponsorItem } from './data/sponsors';
import { Navbar } from './components/Navbar';
import { PresentationScreen } from './components/PresentationScreen';
import { EventCatalog } from './components/EventCatalog';
import { EventRegister } from './components/EventRegister';
import { EventDetailModal } from './components/EventDetailModal';
import { AdvertiserAuth } from './components/AdvertiserAuth';
import { SqlConsoleModal } from './components/SqlConsoleModal';
import { AdminModal } from './components/AdminModal';
import { SponsorRegistrationScreen } from './components/SponsorRegistrationScreen';
import {
  subscribeToEvents,
  saveEventToFirestore,
  deleteEventFromFirestore,
  updateEventLiberadoInFirestore,
  subscribeToEstados,
  saveEstadoToFirestore,
  deleteEstadoFromFirestore,
  subscribeToCategorias,
  saveCategoriaToFirestore,
  deleteCategoriaFromFirestore,
} from './lib/firestoreSync';
import { testFirestoreConnection } from './lib/firebase';

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
  const [cidadesList, setCidadesList] = useState<CidadeItem[]>([]);
  
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
  const [sponsors, setSponsors] = useState<SponsorItem[]>(() => {
    try {
      const saved = localStorage.getItem('praonde_sponsors_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_SPONSORS;
  });

  const [isMasterAdmin, setIsMasterAdmin] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('praonde_master_0612') === 'true';
    } catch {
      return false;
    }
  });

  // Sync with backend SQLite database e espelha no Firestore
  const loadEventsFromApi = async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setEvents((prev) => (prev.length === 0 ? data : prev));
          // Sincroniza cada evento da base com o Firestore para garantir disponibilidade imediata no celular
          data.forEach((evt: EventItem) => {
            saveEventToFirestore(evt).catch(() => {});
          });
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          } catch {
            // ignore
          }
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

  const loadCidadesFromApi = async () => {
    try {
      let res = await fetch('/api/estados');
      if (!res.ok) {
        res = await fetch('/api/estado');
      }
      if (res.ok) {
        const data: CidadeItem[] = await res.json();
        if (Array.isArray(data)) {
          setCidadesList(data);
        }
      }
    } catch (e) {
      console.warn('Usando dados da tabela estados locais:', e);
    }
  };

  const loadSponsorsFromApi = async () => {
    try {
      const res = await fetch('/api/admin/sponsors');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setSponsors((prev) => {
            const map = new Map<string, SponsorItem>();
            prev.forEach((s) => map.set(s.id, s));
            data.forEach((s: SponsorItem) => map.set(s.id, s));
            return Array.from(map.values());
          });
        }
      }
    } catch (e) {
      console.warn('Usando patrocinadores locais:', e);
    }
  };

  useEffect(() => {
    testFirestoreConnection();

    // 1. Ouvir eventos do Firestore em tempo real (compartilhado entre PC e Celular)
    const unsubEvents = subscribeToEvents((firestoreEvents) => {
      if (Array.isArray(firestoreEvents) && firestoreEvents.length > 0) {
        setEvents(firestoreEvents);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(firestoreEvents));
        } catch {
          // ignore
        }
      }
    });

    // 2. Ouvir estados/cidades do Firestore em tempo real
    const unsubEstados = subscribeToEstados((firestoreEstados) => {
      if (Array.isArray(firestoreEstados) && firestoreEstados.length > 0) {
        setCidadesList(firestoreEstados);
      }
    });

    // 3. Ouvir categorias do Firestore em tempo real
    const unsubCategorias = subscribeToCategorias((firestoreCategorias) => {
      if (Array.isArray(firestoreCategorias) && firestoreCategorias.length > 0) {
        setCategoryItems(firestoreCategorias);
        setCategories(firestoreCategorias.map((c) => c.nome));
      }
    });

    // Carga inicial das APIs REST locais como fallback complementar
    loadEventsFromApi();
    loadCategoriesFromApi();
    loadCidadesFromApi();
    loadSponsorsFromApi();

    return () => {
      unsubEvents();
      unsubEstados();
      unsubCategorias();
    };
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

        try {
          await saveCategoriaToFirestore(created);
        } catch (fErr) {
          console.warn('[Firestore] Erro ao salvar categoria:', fErr);
        }
        return;
      }
    } catch (err) {
      console.warn('Erro ao salvar categoria no SQLite:', err);
    }

    try {
      await saveCategoriaToFirestore({
        id: Date.now(),
        nome: trimmed,
        descricao: '',
        ativa: true,
        criadoEm: new Date().toISOString(),
      });
    } catch (fErr) {
      console.warn('[Firestore] Erro ao salvar categoria:', fErr);
    }
  };

  const handleDeleteCategory = async (categoryName: string) => {
    setCategories((prev) => prev.filter((c) => c !== categoryName));

    const item = categoryItems.find((c) => c.nome.toLowerCase() === categoryName.toLowerCase());
    if (item) {
      setCategoryItems((prev) => prev.filter((c) => c.id !== item.id));

      try {
        await deleteCategoriaFromFirestore(item.id);
      } catch (fErr) {
        console.warn('[Firestore] Erro ao deletar categoria no Firestore:', fErr);
      }

      try {
        await fetch(`/api/categories/${item.id}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Erro ao deletar categoria no SQLite:', err);
      }
    }
  };

  const handleAddEvent = async (newEvent: EventItem): Promise<EventItem> => {
    let finalEvent = newEvent;

    // 1. Tentar salvar no servidor local para geocodificação
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
        finalEvent = savedData;
      }
    } catch (e) {
      console.error('Erro ao gravar evento no SQLite:', e);
    }

    // 2. Salvar no Firestore para sincronização global imediata (PC + Celular)
    try {
      await saveEventToFirestore(finalEvent);
    } catch (fireErr) {
      console.warn('[Firestore] Erro ao sincronizar evento no Firestore:', fireErr);
    }

    setEvents((prev) => [finalEvent, ...prev.filter((e) => e.id !== finalEvent.id && e.id !== newEvent.id)]);
    return finalEvent;
  };

  const handleDeleteEvent = async (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    if (selectedEvent?.id === id) {
      setSelectedEvent(null);
    }

    // Deletar do Firestore
    try {
      await deleteEventFromFirestore(id);
    } catch (fireErr) {
      console.warn('[Firestore] Erro ao deletar evento do Firestore:', fireErr);
    }

    // Deletar da API local
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

    // Sincronizar no Firestore
    try {
      await updateEventLiberadoInFirestore(id, nextLiberado);
    } catch (fireErr) {
      console.warn('[Firestore] Erro ao atualizar liberado no Firestore:', fireErr);
    }

    // Sincronizar na API local
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

    // Sincronizar no Firestore
    try {
      await updateEventLiberadoInFirestore(id, nextLiberado);
    } catch (fireErr) {
      console.warn('[Firestore] Erro ao atualizar liberado no Firestore:', fireErr);
    }

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

  // Limpar a tela por completo e voltar à home inicial limpa
  const handleExitAndClearScreen = () => {
    setSelectedEvent(null);
    setCatalogInitialQuery('');
    setIsSqlConsoleOpen(false);
    setIsAdminOpen(false);
    setCurrentScreen('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (screen: ActiveScreen) => {
    setCatalogInitialQuery('');

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
        onExitAndClear={handleExitAndClearScreen}
        eventCount={events.length}
        currentAdvertiser={currentAdvertiser}
        onOpenAdvertiserAuth={handleChangeAdvertiser}
        isMasterAdmin={isMasterAdmin}
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
            sponsors={sponsors}
          />
        )}

        {currentScreen === 'events' && (
          <EventCatalog
            events={events}
            onNavigate={handleNavigate}
            onSelectEvent={setSelectedEvent}
            initialQuery={catalogInitialQuery}
            onDeleteEvent={handleDeleteEvent}
            estadosList={cidadesList}
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
            categoryItems={categoryItems}
            cidadesList={cidadesList}
          />
        )}

        {currentScreen === 'sponsor_register' && (
          <SponsorRegistrationScreen
            onBack={() => handleNavigate('home')}
            onSponsorCreated={(newSponsor) => {
              const updated = [newSponsor, ...sponsors];
              setSponsors(updated);
              try {
                localStorage.setItem('praonde_sponsors_v1', JSON.stringify(updated));
              } catch {}
            }}
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
        isMasterAdminState={isMasterAdmin}
        onMasterAuthChange={(isMaster) => setIsMasterAdmin(isMaster)}
        onOpenSqlConsole={() => setIsSqlConsoleOpen(true)}
        sponsors={sponsors}
        onUpdateSponsors={(newSponsors) => {
          setSponsors(newSponsors);
          try {
            localStorage.setItem('praonde_sponsors_v1', JSON.stringify(newSponsors));
          } catch {}
        }}
      />
    </div>
  );
}
