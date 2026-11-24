import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronRight, MapPin, Music, Play } from 'lucide-react';
import { EventItem } from '../types';
import { useUserLocation } from '../context/LocationContext';
import { isVideoFormatUrl, parseVideoUrl } from '../lib/videoUtils';

interface HomeUpcomingEventsFeedProps {
  onSelectEvent: (event: EventItem) => void;
  onExploreAll: () => void;
  preloadedEvents?: EventItem[];
  isPreloaded?: boolean;
}

const getTodayIsoSp = (): string => {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  } catch {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
};

const getTomorrowIsoSp = (todayIso: string): string => {
  const parts = todayIso.split('-').map(Number);
  if (parts.length !== 3) return '';
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatFriendlyDate = (isoDate: string, todayIso: string, tomorrowIso: string): string => {
  if (!isoDate) return '';
  const clean = isoDate.split('T')[0];
  if (clean === todayIso) return 'Hoje';
  if (clean === tomorrowIso) return 'Amanhã';
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3) return clean;
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const wd = weekdays[dt.getUTCDay()] || '';
  const dd = String(parts[2]).padStart(2, '0');
  const mm = String(parts[1]).padStart(2, '0');
  return `${wd}, ${dd}/${mm}`;
};

const isValidImageUrl = (url?: string | null): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
  if (trimmed.includes('images.unsplash.com')) return false;
  if (trimmed.startsWith('/api/video-thumbnail') || trimmed.startsWith('/api/event-poster/')) {
    return true;
  }
  if (
    trimmed.startsWith('data:video/') ||
    trimmed.startsWith('/uploads/videos/') ||
    trimmed.startsWith('./uploads/videos/') ||
    /\.(mp4|webm|mov|m4v|ogg|mkv)($|\?|#)/i.test(trimmed) ||
    isVideoFormatUrl(trimmed)
  ) {
    return false;
  }
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('/assets/') ||
    trimmed.startsWith('./uploads/') ||
    trimmed.startsWith('./assets/') ||
    /\.(jpe?g|png|webp|gif|svg|avif|bmp|jfif|heic|heif|tiff?|ico)($|\?|#)/i.test(trimmed)
  );
};

const getEventVideoUrl = (event: any): string => {
  if (!event) return '';
  const vid = String(event.video_url || event.video_utl || event.videoUrl || '').trim();
  if (vid && vid !== 'null' && vid !== 'undefined' && vid !== '[video_local_sqlite]') {
    if (isVideoFormatUrl(vid) || vid.startsWith('/uploads/videos/') || vid.startsWith('data:video/')) {
      return vid;
    }
  }
  const rawUrl = String(event.url || event.Url || '').trim();
  if (rawUrl && rawUrl !== 'null' && rawUrl !== 'undefined' && rawUrl !== '[video_local_sqlite]') {
    if (isVideoFormatUrl(rawUrl) || rawUrl.startsWith('data:video/') || rawUrl.startsWith('/uploads/videos/')) {
      return rawUrl;
    }
  }
  return '';
};

const getEventPosterUrl = (event: any): string => {
  if (!event) return '';
  const candidates = [event.url, event.Url, event.imageUrl, event.imagem_url];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().startsWith('data:image/')) {
      return c.trim();
    }
  }
  if (isValidImageUrl(event.imageUrl)) return String(event.imageUrl).trim();
  if (isValidImageUrl(event.imagem_url)) return String(event.imagem_url).trim();
  if (isValidImageUrl(event.url)) return String(event.url).trim();
  if (isValidImageUrl(event.Url)) return String(event.Url).trim();

  const vUrl = getEventVideoUrl(event);
  if (vUrl) {
    const parsed = parseVideoUrl(vUrl);
    if (parsed?.thumbnailUrl) return parsed.thumbnailUrl;
    if (event.id && (vUrl.startsWith('/uploads/videos/') || vUrl.startsWith('data:video/'))) {
      return `/uploads/images/${event.id}.jpg`;
    }
    if ((vUrl.startsWith('http://') || vUrl.startsWith('https://')) && !parsed?.isDirectVideo) {
      return `/api/video-thumbnail?url=${encodeURIComponent(vUrl)}`;
    }
  }
  return '';
};

const isDirectPlayableVideo = (url: string): boolean => {
  if (!url) return false;
  return (
    url.startsWith('/uploads/videos/') ||
    url.startsWith('data:video/') ||
    /\.(mp4|webm|mov|m4v|ogg)($|\?|#)/i.test(url)
  );
};

export const HomeUpcomingEventsFeed: React.FC<HomeUpcomingEventsFeedProps> = ({
  onSelectEvent,
  onExploreAll,
  preloadedEvents,
  isPreloaded = false,
}) => {
  const { userCoords, getDistanceKmTo } = useUserLocation();
  const [events, setEvents] = useState<EventItem[]>(() => (isPreloaded && Array.isArray(preloadedEvents) ? preloadedEvents : []));
  const [isLoading, setIsLoading] = useState<boolean>(() => !isPreloaded);
  const [visibleCount, setVisibleCount] = useState<number>(6);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const todayIso = useMemo(() => getTodayIsoSp(), []);
  const tomorrowIso = useMemo(() => getTomorrowIsoSp(todayIso), [todayIso]);

  useEffect(() => {
    if (isPreloaded && Array.isArray(preloadedEvents)) {
      setEvents(preloadedEvents);
      setIsLoading(false);
    }
  }, [isPreloaded, preloadedEvents]);

  useEffect(() => {
    if (isPreloaded) return;
    let cancelled = false;

    const loadUpcomingEvents = async () => {
      setIsLoading(true);
      try {
        const buildParams = (withDate: boolean) => {
          const params = new URLSearchParams();
          params.set('liberado', 'S');
          params.set('limit', '24');
          params.set('mais_proximos', 'true');
          params.set('order_by', 'proximidade');
          if (withDate && todayIso) {
            params.set('date', todayIso);
          }
          if (
            userCoords &&
            typeof userCoords.latitude === 'number' &&
            typeof userCoords.longitude === 'number'
          ) {
            params.set('user_lat', String(userCoords.latitude));
            params.set('user_lng', String(userCoords.longitude));
          }
          return params;
        };

        let data: EventItem[] = [];
        const res = await fetch(`/api/events?${buildParams(true).toString()}`, { cache: 'no-store' });
        if (res.ok) {
          const parsed = await res.json();
          if (Array.isArray(parsed)) data = parsed;
        }

        // Fallback leve caso ainda não existam eventos com data >= hoje cadastrados
        if (data.length === 0) {
          const fbRes = await fetch(`/api/events?${buildParams(false).toString()}`, { cache: 'no-store' });
          if (fbRes.ok) {
            const parsed = await fbRes.json();
            if (Array.isArray(parsed)) data = parsed;
          }
        }

        if (cancelled) return;

        // Deduplicação estrita e validação de mídia real
        const seen = new Set<string>();
        const cleaned = data.filter((ev) => {
          if (!ev) return false;
          const poster = getEventPosterUrl(ev);
          const video = getEventVideoUrl(ev);
          if (!poster && !video) return false;

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

        setEvents(cleaned);
      } catch (err) {
        console.warn('Erro ao carregar próximos eventos na tela inicial:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadUpcomingEvents();
    return () => {
      cancelled = true;
    };
  }, [isPreloaded, todayIso, userCoords?.latitude, userCoords?.longitude]);

  // Ordena por data mais próxima primeiro (hoje e fim de semana no topo), depois proximidade
  const orderedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const dateA = (a.date || '').split('T')[0];
      const dateB = (b.date || '').split('T')[0];
      if (dateA && dateB && dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }

      const liveDistA = getDistanceKmTo(a.latitude, a.longitude, a.city);
      const distA = liveDistA !== null ? liveDistA : typeof a.distanceKm === 'number' ? a.distanceKm : 999999;
      const liveDistB = getDistanceKmTo(b.latitude, b.longitude, b.city);
      const distB = liveDistB !== null ? liveDistB : typeof b.distanceKm === 'number' ? b.distanceKm : 999999;
      if (distA !== distB) return distA - distB;

      return (a.time || '').localeCompare(b.time || '');
    });
  }, [events, getDistanceKmTo]);

  const displayedEvents = orderedEvents.slice(0, visibleCount);
  const hasMoreToReveal = visibleCount < orderedEvents.length;

  return (
    <section
      id="home-upcoming-events"
      aria-label="Eventos em destaque"
      className="w-full mt-2 sm:mt-3 mb-5 text-left"
    >
      {/* Estado de carregamento suave */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-slate-900/80 border border-slate-800/90 overflow-hidden animate-pulse"
            >
              <div className="h-56 sm:h-52 bg-slate-800/70" />
              <div className="p-4 space-y-2.5">
                <div className="h-3.5 w-2/3 bg-slate-800 rounded" />
                <div className="h-5 w-5/6 bg-slate-800 rounded" />
                <div className="h-3.5 w-1/2 bg-slate-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : displayedEvents.length === 0 ? (
        <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6 text-center">
          <p className="text-sm text-slate-300 mb-3">
            Escolha um ritmo acima ou abra a agenda completa para ver todos os eventos.
          </p>
          <button
            type="button"
            onClick={onExploreAll}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
          >
            <span>Abrir agenda completa</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          {/* Grade de cartazes: 1 coluna generosa no celular (estilo feed) e 2-3 colunas no desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {displayedEvents.map((event) => {
              const posterUrl = getEventPosterUrl(event);
              const videoUrl = getEventVideoUrl(event);
              const imageFailed = Boolean(failedImages[event.id]);
              const showDirectVideo = Boolean(videoUrl && isDirectPlayableVideo(videoUrl) && (!posterUrl || imageFailed));
              const showPosterImage = Boolean(posterUrl && !imageFailed && !showDirectVideo);
              const friendlyDate = formatFriendlyDate(event.date, todayIso, tomorrowIso);
              const liveDist = getDistanceKmTo(event.latitude, event.longitude, event.city);
              const distanceKm = liveDist !== null ? liveDist : typeof event.distanceKm === 'number' ? event.distanceKm : null;

              const priceLabel = event.isFree
                ? 'Entrada gratuita'
                : typeof event.price === 'number' && event.price > 0
                  ? `R$ ${event.price.toFixed(2).replace('.', ',')}`
                  : 'Toque para abrir';

              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onSelectEvent(event)}
                  className="group flex flex-col text-left rounded-2xl bg-slate-900/90 border border-slate-800/90 hover:border-amber-400/60 overflow-hidden shadow-lg transition-all duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
                >
                  {/* Cartaz / Vídeo */}
                  <div className="relative w-full h-60 sm:h-52 bg-slate-950 overflow-hidden">
                    {showPosterImage ? (
                      <img
                        src={posterUrl}
                        alt={event.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [event.id]: true }))
                        }
                        className="w-full h-full object-cover object-top transition-transform duration-200 group-hover:scale-[1.03]"
                      />
                    ) : showDirectVideo ? (
                      <video
                        src={videoUrl}
                        muted
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-4 text-center">
                        <Music className="w-9 h-9 text-amber-400/80" />
                        <span className="text-sm font-semibold text-slate-200 line-clamp-2">
                          {event.title}
                        </span>
                      </div>
                    )}

                    {/* Scrim escuro medido para contraste */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/15 to-transparent pointer-events-none" />

                    {/* Indicador funcional de vídeo quando o evento tem vídeo */}
                    {videoUrl && (
                      <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-slate-950/80 border border-white/25 flex items-center justify-center text-amber-300 shadow-md">
                        <Play className="w-4 h-4 fill-amber-300 ml-0.5" />
                      </div>
                    )}
                  </div>

                  {/* Informações limpas (sem excesso de etiquetas/pílulas) */}
                  <div className="flex-1 flex flex-col p-4">
                    <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-xs font-semibold text-amber-300 tabular-nums mb-1.5">
                      <span>{event.category || 'Evento'}</span>
                      {friendlyDate && (
                        <>
                          <span aria-hidden="true" className="text-slate-500">·</span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                            {friendlyDate}
                          </span>
                        </>
                      )}
                      {event.time && (
                        <>
                          <span aria-hidden="true" className="text-slate-500">·</span>
                          <span>{event.time}</span>
                        </>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-white leading-snug line-clamp-2 mb-2 group-hover:text-amber-200 transition-colors">
                      {event.title}
                    </h3>

                    <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-300 mb-3 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {[event.locationName, event.city ? `${event.city}${event.state ? ` - ${event.state}` : ''}` : '']
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      {distanceKm !== null && distanceKm < 500 && (
                        <span className="shrink-0 text-slate-400 tabular-nums">
                          · {distanceKm.toFixed(1).replace('.', ',')} km
                        </span>
                      )}
                    </div>

                    <div className="mt-auto pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-300 tabular-nums truncate">
                        {priceLabel}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-amber-400 whitespace-nowrap shrink-0">
                        <span>Ver detalhes</span>
                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Botões grandes e ergonômicos abaixo do feed */}
          <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 px-1">
            {hasMoreToReveal && (
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + 6)}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/60 text-white font-bold text-sm transition-colors cursor-pointer active:scale-[0.98]"
              >
                <span>Mostrar mais eventos</span>
                <ChevronDown className="w-4 h-4 text-amber-400" />
              </button>
            )}
            <button
              type="button"
              onClick={onExploreAll}
              className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer active:scale-[0.98]"
            >
              <span>Buscar por cidade, data ou ritmo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </section>
  );
};
