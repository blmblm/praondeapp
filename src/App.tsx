import React, { useState, useEffect } from 'react';
import { EventItem, EventCategory, ActiveScreen, Advertiser, CategoryItem, CidadeItem } from './types';
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
import { EventLiberationModal } from './components/EventLiberationModal';
import { MasterPasswordModal } from './components/MasterPasswordModal';
import { PWAInstallModal } from './components/PWAInstallModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { InitialLoadingScreen } from './components/InitialLoadingScreen';
import { usePWAInstall } from './hooks/usePWAInstall';
import {
  saveEventToFirestore,
  deleteEventFromFirestore,
  updateEventLiberadoInFirestore,
  saveCategoriaToFirestore,
  deleteCategoriaFromFirestore,
  saveAdvertiserToFirestore,
} from './lib/firestoreSync';

try {
  localStorage.removeItem('praonde_events_data_v11');
  localStorage.removeItem('praonde_events_data_v10');
  localStorage.removeItem('praonde_events_data_v9');
} catch {}
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
  'Festas',
  'Bailes',
  'Teatro',
  'Sertanejo',
];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ActiveScreen>('home');

  // PWA Install Hook
  const {
    isInstallable,
    hasNativePrompt,
    isInstalled,
    isIOS,
    isAndroid,
    isModalOpen,
    showTipOnOpen,
    openInstallModal,
    closeInstallModal,
    promptInstall,
  } = usePWAInstall();

  // Categories State & Persistence
  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(CATEGORIES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Garante que novas categorias essenciais (Sertanejo, Teatro, Bailes) sejam inseridas mesmo com cache de sessões antigas
          const merged = Array.from(new Set([...parsed, ...INITIAL_CATEGORIES]));
          return merged;
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
          // Filtra possíveis anunciantes mock legados
          return parsed.filter((a) => a.email !== 'praondeeu@gmail.com' && a.email !== 'amigosdosamba@email.com');
        }
      }
    } catch (e) {
      console.error('Error loading advertisers from storage', e);
    }
    return [];
  });

  const [currentAdvertiser, setCurrentAdvertiser] = useState<Advertiser | null>(null);

  // Events State (fonte oficial: servidor /api/events, sem cache localStorage truncado)
  const [events, setEvents] = useState<EventItem[]>([]);
  const [homeFeedEvents, setHomeFeedEvents] = useState<EventItem[]>([]);
  const [isInitialAppLoading, setIsInitialAppLoading] = useState<boolean>(true);
  const [initialLoadProgress, setInitialLoadProgress] = useState<number>(18);
  const [initialLoadStatus, setInitialLoadStatus] = useState<string>('Carregando os eventos...');

  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [isMasterPasswordModalOpen, setIsMasterPasswordModalOpen] = useState<boolean>(false);
  const [pendingEditEvent, setPendingEditEvent] = useState<EventItem | null>(null);
  const [catalogInitialQuery, setCatalogInitialQuery] = useState<string>('');
  const [catalogInitialCategory, setCatalogInitialCategory] = useState<string>('');
  const [catalogInitialEstado, setCatalogInitialEstado] = useState<string>('');
  const [catalogInitialDate, setCatalogInitialDate] = useState<string>('');
  const [catalogInitialSortByProximity, setCatalogInitialSortByProximity] = useState<boolean>(true);
  const [isSqlConsoleOpen, setIsSqlConsoleOpen] = useState<boolean>(false);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [isHomeMenuOpen, setIsHomeMenuOpen] = useState<boolean>(false);

  const [isMasterAdmin, setIsMasterAdmin] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('praonde_master_0612') === 'true';
    } catch {
      return false;
    }
  });

  const hasRealMedia = (e: any): boolean => {
    if (!e) return false;
    const img = String(e.imageUrl || e.imagem_url || '').trim();
    const vid = String(e.videoUrl || e.video_url || '').trim();
    const url = String(e.url || '').trim();

    if (img.includes('images.unsplash.com') || url.includes('images.unsplash.com')) return false;

    const hasImg = Boolean(
      img.startsWith('data:image/') ||
      img.startsWith('/api/event-poster/') ||
      img.startsWith('http://') ||
      img.startsWith('https://') ||
      img.startsWith('/uploads/images/') ||
      img.startsWith('/assets/') ||
      img.startsWith('./uploads/images/')
    );

    const hasVid = Boolean(
      vid.startsWith('data:video/') ||
      vid.startsWith('http://') ||
      vid.startsWith('https://') ||
      vid.startsWith('/uploads/videos/') ||
      url.startsWith('data:video/') ||
      url.includes('.mp4') ||
      url.includes('facebook') ||
      url.includes('youtube') ||
      url.includes('instagram') ||
      url.includes('tiktok')
    );

    return hasImg || hasVid;
  };

  // Sync with backend PostgreSQL database apenas sob demanda (Admin / edições)
  const loadEventsFromApi = async (options?: { admin?: boolean }) => {
    try {
      const url = options?.admin ? '/api/events?admin=true&limit=5000' : '/api/events?limit=5000';
      const [res, delRes] = await Promise.all([
        fetch(url, { cache: 'no-store' }),
        fetch('/api/events/deleted-ids', { cache: 'no-store' }).catch(() => null),
      ]);

      let delSet = new Set<string>();
      if (delRes && delRes.ok) {
        try {
          const delData = await delRes.json();
          if (Array.isArray(delData?.deletedIds)) {
            delSet = new Set(delData.deletedIds);
          }
        } catch {}
      }

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const cleaned = data.filter((e) => !delSet.has(e.id) && (options?.admin || hasRealMedia(e)));
          setEvents(cleaned);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar eventos do servidor:', e);
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

  const loadAdvertisersFromApi = async () => {
    try {
      const res = await fetch('/api/advertisers');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAdvertisers(data);
          try {
            localStorage.setItem(ADVERTISERS_STORAGE_KEY, JSON.stringify(data));
          } catch {}
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar anunciantes da API:', e);
    }
  };

  const loadHomeFeedEvents = async (): Promise<EventItem[]> => {
    try {
      const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const buildParams = (withDate: boolean) => {
        const params = new URLSearchParams();
        params.set('liberado', 'S');
        params.set('limit', '18');
        params.set('mais_proximos', 'true');
        params.set('order_by', 'proximidade');
        if (withDate && todayIso) {
          params.set('date', todayIso);
        }
        return params;
      };

      let data: EventItem[] = [];
      const res = await fetch(`/api/events?${buildParams(true).toString()}`, { cache: 'no-store' });
      if (res.ok) {
        const parsed = await res.json();
        if (Array.isArray(parsed)) data = parsed;
      }

      if (data.length === 0) {
        const fbRes = await fetch(`/api/events?${buildParams(false).toString()}`, { cache: 'no-store' });
        if (fbRes.ok) {
          const parsed = await fbRes.json();
          if (Array.isArray(parsed)) data = parsed;
        }
      }

      const seen = new Set<string>();
      const cleaned = data.filter((ev) => {
        if (!ev || !hasRealMedia(ev)) return false;
        const idKey = (ev.id || '').trim().toLowerCase();
        const titleKey = (ev.title || '').trim().toLowerCase();
        const dateKey = (ev.date || '').split('T')[0].trim();
        const cityKey = (ev.city || '').trim().toLowerCase();
        const semKey = `${titleKey}__${dateKey}__${cityKey}`;
        if (idKey && seen.has(`id:${idKey}`)) return false;
        if (titleKey && dateKey && seen.has(`sem:${semKey}`)) return false;
        if (idKey) seen.add(`id:${idKey}`);
        if (titleKey && dateKey) seen.add(`sem:${semKey}`);
        return true;
      });

      setHomeFeedEvents(cleaned);
      return cleaned;
    } catch (e) {
      console.warn('Erro ao pré-carregar eventos da tela inicial:', e);
      return [];
    }
  };

  useEffect(() => {
    let isMounted = true;
    let finished = false;

    // Limpa caches antigos de eventos (v1 a v9) para evitar ressurreição de dados de abas antigas
    try {
      localStorage.removeItem('praonde_events_data_v9');
      localStorage.removeItem('praonde_events_data_v8');
      localStorage.removeItem('praonde_events_data_v7');
      localStorage.removeItem('praonde_events_data_v6');
      localStorage.removeItem('praonde_events_data_v5');
      localStorage.removeItem('praonde_events_data_v4');
      localStorage.removeItem('praonde_events_data_v3');
      localStorage.removeItem('praonde_events_data_v2');
      localStorage.removeItem('praonde_events_data_v1');
    } catch {}

    const finishLoading = () => {
      if (finished || !isMounted) return;
      finished = true;
      setInitialLoadProgress(100);
      setInitialLoadStatus('Tudo pronto!');
      setTimeout(() => {
        if (isMounted) setIsInitialAppLoading(false);
      }, 180);
    };

    // Anima suavemente a barra enquanto aguarda a rede móvel (4G)
    const progressTimer = setInterval(() => {
      if (!isMounted || finished) return;
      setInitialLoadProgress((prev) => (prev < 78 ? prev + 6 : prev));
    }, 320);

    // Segurança: nunca travar na tela de carregamento mesmo se a conexão cair
    const safetyTimer = setTimeout(() => {
      finishLoading();
    }, 7000);

    const bootstrapApp = async () => {
      setInitialLoadProgress(28);
      setInitialLoadStatus('Conectando aos eventos...');

      const [, , loadedEvents] = await Promise.all([
        loadCategoriesFromApi().catch(() => {}),
        loadCidadesFromApi().catch(() => {}),
        loadHomeFeedEvents(),
      ]);

      if (!isMounted || finished) return;
      setInitialLoadProgress(85);
      setInitialLoadStatus('Preparando os cartazes...');

      // Pré-carrega os 3 primeiros cartazes (espera no máximo 900ms para não atrasar)
      const firstPosters = (loadedEvents || [])
        .map((ev) => String(ev.imageUrl || (ev as any).imagem_url || ev.url || '').trim())
        .filter((u) => u && (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/api/') || u.startsWith('/uploads/')))
        .slice(0, 3);

      if (firstPosters.length > 0) {
        await Promise.race([
          Promise.allSettled(
            firstPosters.map(
              (src) =>
                new Promise<void>((resolve) => {
                  const img = new Image();
                  img.onload = () => resolve();
                  img.onerror = () => resolve();
                  img.src = src;
                })
            )
          ),
          new Promise<void>((resolve) => setTimeout(resolve, 900)),
        ]);
      }

      finishLoading();
    };

    bootstrapApp();

    const handleQuarantineCleared = () => {
      if (isAdminOpen) {
        loadEventsFromApi({ admin: true });
      }
      loadHomeFeedEvents();
    };
    window.addEventListener('praonde:quarantine-cleared', handleQuarantineCleared);

    return () => {
      isMounted = false;
      clearInterval(progressTimer);
      clearTimeout(safetyTimer);
      window.removeEventListener('praonde:quarantine-cleared', handleQuarantineCleared);
    };
  }, []);

  // Carrega todos os eventos e anunciantes somente quando a central administrativa ou o cadastro de anunciante é aberto
  useEffect(() => {
    if (isAdminOpen) {
      loadEventsFromApi({ admin: true });
      loadAdvertisersFromApi();
    }
  }, [isAdminOpen]);

  useEffect(() => {
    if (currentScreen === 'advertiser_auth' || currentScreen === 'register') {
      loadAdvertisersFromApi();
    }
  }, [currentScreen]);

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

    // 1. Gravar de forma prioritária no SQLite na tabela independente 'eventos'
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
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.error('Erro na resposta ao gravar evento no SQLite:', res.status, errJson);
        throw new Error(errJson.error || `Erro HTTP ${res.status} ao cadastrar na tabela eventos.`);
      }
    } catch (e: any) {
      console.error('Erro ao gravar evento no SQLite:', e);
      throw e;
    }

    // 2. Salvar no Firestore para sincronização global imediata (PC + Celular)
    try {
      await saveEventToFirestore(finalEvent);
    } catch (fireErr) {
      console.warn('[Firestore] Erro ao sincronizar evento no Firestore:', fireErr);
    }

    setEvents((prev) => [finalEvent, ...prev.filter((e) => e.id !== finalEvent.id && e.id !== newEvent.id)]);
    loadEventsFromApi();
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
    const nextStatus = nextLiberado === 'S' ? 'aprovado' : 'em_analise';
    setEvents((prev) =>
      prev.map((evt) => (evt.id === id ? { ...evt, liberado: nextLiberado, status: nextStatus } : evt))
    );

    // Sincronizar no Firestore em background (não bloqueia a interface)
    updateEventLiberadoInFirestore(id, nextLiberado).catch((fireErr) => {
      console.warn('[Firestore] Erro ao atualizar liberado no Firestore:', fireErr);
    });

    // Sincronizar na API Cloud SQL
    try {
      const putRes = await fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liberado: nextLiberado, status: nextStatus }),
      });
      if (putRes.ok && nextLiberado === 'S') {
        const putJson = await putRes.json().catch(() => null);
        if (putJson?.event) {
          saveEventToFirestore(putJson.event).catch((fireErr) => {
            console.warn('[Firestore] Erro ao sincronizar evento liberado no Firestore:', fireErr);
          });
        }
      }
    } catch (e) {
      console.warn('Erro ao atualizar status liberado no SQLite:', e);
    }
  };

  const handleSetLiberado = async (
    id: string,
    nextLiberado: 'S' | 'N',
    updatedUrl?: string,
    urlType?: 'video' | 'image' | 'link'
  ) => {
    const isVid = urlType === 'video' || (updatedUrl && (
      updatedUrl.startsWith('data:video/') ||
      updatedUrl.startsWith('/uploads/videos/') ||
      updatedUrl.startsWith('./uploads/videos/') ||
      updatedUrl.includes('youtube') ||
      updatedUrl.includes('youtu.be') ||
      updatedUrl.includes('fb.') ||
      updatedUrl.includes('facebook.com') ||
      updatedUrl.includes('.mp4') ||
      updatedUrl.includes('.webm') ||
      updatedUrl.includes('.mov')
    ));
    const nextStatus = nextLiberado === 'S' ? 'aprovado' : 'em_analise';

    // 1. Atualização de estado imediata na interface
    setEvents((prev) =>
      prev.map((evt) => (evt.id === id ? {
        ...evt,
        liberado: nextLiberado,
        status: nextStatus,
        ...(updatedUrl ? { url: updatedUrl } : {}),
        ...(isVid ? { videoUrl: updatedUrl, mediaType: 'video' as const } : {}),
      } : evt))
    );

    // 2. Sincronizar no Firestore em background
    updateEventLiberadoInFirestore(id, nextLiberado).catch((fireErr) => {
      console.warn('[Firestore] Erro ao atualizar liberado no Firestore:', fireErr);
    });

    // 3. Sincronizar na API Cloud SQL (grava no arquivo de lançamento quando for vídeo)
    try {
      const putRes = await fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          liberado: nextLiberado,
          status: nextStatus,
          url: updatedUrl,
          urlType,
          videoUrl: isVid ? updatedUrl : undefined,
        }),
      });
      if (putRes.ok && nextLiberado === 'S') {
        const putJson = await putRes.json().catch(() => null);
        if (putJson?.event) {
          saveEventToFirestore(putJson.event).catch((fireErr) => {
            console.warn('[Firestore] Erro ao sincronizar evento liberado no Firestore:', fireErr);
          });
        }
      }
    } catch (e) {
      console.warn('Erro ao atualizar status liberado no SQLite:', e);
    }
    loadEventsFromApi();
  };

  // Inclusão instantânea de evento liberado da quarentena na tabela de eventos
  const handleEventApproved = (newEvent: EventItem) => {
    // 1. Atualização instantânea imediata no estado da interface
    setEvents((prev) => {
      const filtered = prev.filter(
        (e) => e.id !== newEvent.id && (e.title.toLowerCase().trim() !== newEvent.title.toLowerCase().trim() || e.city !== newEvent.city)
      );
      return [newEvent, ...filtered];
    });

    // 2. Persistência imediata
    saveEventToFirestore(newEvent).catch(() => {});
    if (newEvent?.category) {
      setCatalogInitialCategory(newEvent.category);
    }
    if (newEvent?.date) {
      setCatalogInitialDate(newEvent.date);
    }
    // 2. Sincronização imediata com o Cloud SQL
    loadEventsFromApi();
  };

  // Solicitação de Edição de Cartaz protegida por Senha Master
  const handleRequestEditEvent = (evt: EventItem) => {
    setPendingEditEvent(evt);
    setIsMasterPasswordModalOpen(true);
  };

  const handleMasterPasswordSuccess = () => {
    if (pendingEditEvent) {
      if (selectedEvent?.id === pendingEditEvent.id) {
        setSelectedEvent(null);
      }
      setEditingEvent(pendingEditEvent);
      setPendingEditEvent(null);
    }
    setIsMasterPasswordModalOpen(false);
  };

  const handleMasterPasswordClose = () => {
    setIsMasterPasswordModalOpen(false);
    setPendingEditEvent(null);
  };

  const handleSearchRedirect = (term: string) => {
    setCatalogInitialQuery(term);
    setCurrentScreen('events');
  };

  // Limpar a tela por completo e voltar à home inicial limpa
  const handleExitAndClearScreen = () => {
    setSelectedEvent(null);
    setCatalogInitialQuery('');
    setCurrentAdvertiser(null);
    setIsSqlConsoleOpen(false);
    setIsAdminOpen(false);
    setIsHomeMenuOpen(false);
    setCurrentScreen('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (screen: ActiveScreen) => {
    setIsHomeMenuOpen(false);
    setCatalogInitialQuery('');
    if (screen === 'events') {
      setCatalogInitialCategory('');
      setCatalogInitialEstado('');
      setCatalogInitialDate('');
      setCatalogInitialSortByProximity(true);
    }

    // Ao clicar em Divulgar Evento, direciona SEMPRE para a tela de verificação de e-mail (se existe ou não)
    if (screen === 'register' || screen === 'advertiser_auth') {
      setCurrentAdvertiser(null);
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
    loadAdvertisersFromApi();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isInitialAppLoading) {
    return (
      <InitialLoadingScreen
        progress={initialLoadProgress}
        statusText={initialLoadStatus}
      />
    );
  }

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
        onOpenInstall={openInstallModal}
        onPromptInstall={promptInstall}
        hasNativePrompt={hasNativePrompt}
        isAppInstalled={isInstalled}
        isHomeMenuOpen={isHomeMenuOpen}
        onToggleHomeMenu={() => setIsHomeMenuOpen((prev) => !prev)}
        onCloseHomeMenu={() => setIsHomeMenuOpen(false)}
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
            categories={categories}
            cidadesList={cidadesList}
            onOpenInstall={openInstallModal}
            onPromptInstall={promptInstall}
            hasNativePrompt={hasNativePrompt}
            isAppInstalled={isInstalled}
            isHomeMenuOpen={isHomeMenuOpen}
            onToggleHomeMenu={() => setIsHomeMenuOpen((prev) => !prev)}
            homeFeedEvents={homeFeedEvents}
            isHomeFeedLoaded={!isInitialAppLoading}
            onDiscoverySearch={({ category, estado, date, sortByProximity }) => {
              setCatalogInitialCategory(category);
              setCatalogInitialEstado(estado);
              setCatalogInitialDate(date);
              setCatalogInitialSortByProximity(sortByProximity);
              setCatalogInitialQuery('');
              setCurrentScreen('events');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {currentScreen === 'events' && (
          <EventCatalog
            events={events}
            onNavigate={handleNavigate}
            onSelectEvent={setSelectedEvent}
            initialQuery={catalogInitialQuery}
            initialCategory={catalogInitialCategory}
            initialEstado={catalogInitialEstado}
            initialDate={catalogInitialDate}
            initialSortByProximity={catalogInitialSortByProximity}
            onDeleteEvent={handleDeleteEvent}
            onEditEvent={handleRequestEditEvent}
            estadosList={cidadesList}
            onRefreshEvents={loadEventsFromApi}
            categoriesList={categories}
          />
        )}

        {(currentScreen === 'advertiser_auth' || (currentScreen === 'register' && !currentAdvertiser)) && (
          <AdvertiserAuth
            onSuccess={handleAdvertiserAuthSuccess}
            onNavigate={handleNavigate}
            registeredAdvertisers={advertisers}
            currentAdvertiser={currentAdvertiser}
            onRegisterAdvertiser={(newAdv) => {
              setAdvertisers((prev) => [newAdv, ...prev.filter((a) => a.id !== newAdv.id)]);
              saveAdvertiserToFirestore(newAdv).catch(() => {});
              loadAdvertisersFromApi();
            }}
          />
        )}

        {currentScreen === 'register' && currentAdvertiser && (
          <EventRegister
            onAddEvent={handleAddEvent}
            onNavigate={handleNavigate}
            onSelectEvent={(evt) => {
              setSelectedEvent(evt);
              if (evt?.category) {
                setCatalogInitialCategory(evt.category);
              }
              if (evt?.date) {
                setCatalogInitialDate(evt.date);
              }
              handleNavigate('events');
            }}
            currentAdvertiser={currentAdvertiser}
            onChangeAdvertiser={handleChangeAdvertiser}
            categoryItems={categoryItems}
            cidadesList={cidadesList}
          />
        )}
      </main>

      {/* Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={isMasterAdmin ? handleDeleteEvent : undefined}
          onEdit={(evt) => handleRequestEditEvent(evt)}
        />
      )}

      {/* Modal de Senha Master para Editar / Trocar Cartaz */}
      <MasterPasswordModal
        isOpen={isMasterPasswordModalOpen}
        eventTitle={pendingEditEvent?.title}
        onSuccess={handleMasterPasswordSuccess}
        onClose={handleMasterPasswordClose}
      />

      {/* Modal de Análise e Edição Direta do Evento */}
      {editingEvent && (
        <EventLiberationModal
          isOpen={Boolean(editingEvent)}
          event={editingEvent}
          categories={categories}
          categoryItems={categoryItems}
          onClose={() => setEditingEvent(null)}
          onSaveLiberation={async (id, liberado, newCategory, updatedUrl, urlType) => {
            if (liberado === 'N') {
              await handleDeleteEvent(id);
              setEditingEvent(null);
              return;
            }
            await handleSetLiberado(id, 'S', updatedUrl, urlType);
            if (newCategory) {
              try {
                await fetch(`/api/events/${id}/category`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ category: newCategory }),
                });
              } catch (catErr) {
                console.warn('Erro ao atualizar categoria na edição direta:', catErr);
              }
            }
            if (updatedUrl && updatedUrl.trim()) {
              try {
                await fetch(`/api/events/${id}/url`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url: updatedUrl.trim(), mediaType: urlType || (updatedUrl.startsWith('data:image/') ? 'image' : 'video') }),
                });
              } catch (urlErr) {
                console.warn('Erro ao atualizar URL/imagem na edição direta:', urlErr);
              }
            }
            loadEventsFromApi();
            setEditingEvent(null);
          }}
          onUpdateCategory={async (id, newCategory, newCatId) => {
            try {
              const res = await fetch(`/api/events/${id}/category`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: newCategory, categoryId: newCatId }),
              });
              loadEventsFromApi();
              return res.ok;
            } catch {
              return false;
            }
          }}
          onUpdateUrl={async (id, newUrl, urlType) => {
            try {
              const res = await fetch(`/api/events/${id}/url`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: newUrl, mediaType: urlType }),
              });
              loadEventsFromApi();
              return res.ok;
            } catch {
              return false;
            }
          }}
        />
      )}

      {/* SQL Database Console Modal */}
      <SqlConsoleModal
        isOpen={isSqlConsoleOpen}
        onClose={() => setIsSqlConsoleOpen(false)}
        onEventModified={(deletedIds?: string[]) => {
          if (Array.isArray(deletedIds) && deletedIds.length > 0) {
            setEvents((prev) => prev.filter((e) => !deletedIds.includes(e.id)));
          }
          loadEventsFromApi();
        }}
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
        onEventsUpdated={loadEventsFromApi}
        onEventApproved={handleEventApproved}
      />

      {/* PWA Install Modal */}
      <PWAInstallModal
        isOpen={isModalOpen}
        onClose={closeInstallModal}
        isIOS={isIOS}
        isAndroid={isAndroid}
        isInstalled={isInstalled}
        hasNativePrompt={hasNativePrompt}
        initialShowTip={showTipOnOpen}
        onPromptInstall={promptInstall}
      />

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />
    </div>
  );
}
