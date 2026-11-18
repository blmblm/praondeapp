import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  MapPin, 
  DollarSign, 
  User, 
  Mail, 
  Share2, 
  Check, 
  ExternalLink,
  Tag,
  Copy,
  CalendarPlus,
  Trash2,
  Navigation,
  ZoomIn,
  Sparkles,
  Video,
  Play,
  ImageIcon,
  Ticket,
  Edit3
} from 'lucide-react';
import { EventItem } from '../types';
import { useUserLocation } from '../context/LocationContext';
import { parseVideoUrl, isVideoFormatUrl, isImageFileUrl } from '../lib/videoUtils';
import { VideoPlayer } from './VideoPlayer';

interface EventDetailModalProps {
  event: EventItem | null;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (event: EventItem) => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  onClose,
  onDelete,
  onEdit,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  
  const effectiveVideoUrl = event
    ? (
        (!isImageFileUrl(event.video_url) && isVideoFormatUrl(event.video_url) ? event.video_url : '') ||
        (!isImageFileUrl(event.video_utl) && isVideoFormatUrl(event.video_utl) ? event.video_utl : '') ||
        (!isImageFileUrl(event.videoUrl) && isVideoFormatUrl(event.videoUrl) ? event.videoUrl : '') ||
        (!isImageFileUrl(event.url) && isVideoFormatUrl(event.url) ? event.url : '') ||
        (!isImageFileUrl(event.Url) && isVideoFormatUrl(event.Url) ? event.Url : '') ||
        (event.mediaType === 'video' && !isImageFileUrl(event.url) ? (event.url || event.Url || event.videoUrl || event.video_url || event.video_utl) : '')
      )
    : '';
  const hasVideo = Boolean(effectiveVideoUrl);

  const posterUrl = React.useMemo(() => {
    if (!event) return '';
    
    // 1. PRIORIDADE MÁXIMA ABSOLUTA: Se houver Data URI Base64 (em url, imageUrl ou imagem_url), usa DIRETAMENTE!
    const candidates = [event.url, event.Url, event.imageUrl, (event as any).imagem_url];
    for (const c of candidates) {
      if (typeof c === 'string') {
        const trimmed = c.trim();
        if (trimmed.startsWith('data:image/')) {
          return trimmed;
        }
      }
    }

    const isRealPoster = (u?: string | null): boolean => {
      if (!u || typeof u !== 'string') return false;
      const t = u.trim();
      return Boolean(t && t !== 'null' && t !== 'undefined' && !t.includes('images.unsplash.com/photo-1514525253161-7a46d19cd819'));
    };

    if (isRealPoster(event.imageUrl)) return event.imageUrl.trim();
    if (isRealPoster((event as any).imagem_url)) return (event as any).imagem_url.trim();
    const rawUrl = (event.url || event.Url || '').trim();
    if (isRealPoster(rawUrl) && !isVideoFormatUrl(rawUrl)) return rawUrl;
    if (effectiveVideoUrl) {
      const parsedVid = parseVideoUrl(effectiveVideoUrl);
      if (parsedVid?.thumbnailUrl) return parsedVid.thumbnailUrl;
      if ((effectiveVideoUrl.startsWith('http://') || effectiveVideoUrl.startsWith('https://')) && !parsedVid?.isDirectVideo) {
        return `/api/video-thumbnail?url=${encodeURIComponent(effectiveVideoUrl)}`;
      }
    }
    return '';
  }, [event, effectiveVideoUrl]);

  const [activeMediaView, setActiveMediaView] = useState<'poster' | 'video'>(() => {
    return hasVideo ? 'video' : 'poster';
  });

  React.useEffect(() => {
    if (hasVideo) {
      setActiveMediaView('video');
    } else {
      setActiveMediaView('poster');
    }
  }, [event?.id, hasVideo]);

  const { coords, getDistanceKmTo, userOriginCity, userCoords, isUsingRealGps } = useUserLocation();

  if (!event) return null;

  const parsedVideo = effectiveVideoUrl ? parseVideoUrl(effectiveVideoUrl) : null;

  const distKm = getDistanceKmTo(event.latitude, event.longitude, event.city);

  const formattedDate = new Date(event.date + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const fullAddress = `${event.locationName}, ${event.address} - ${event.city}/${event.state}`;
  const originCoord = coords || userCoords;
  const googleMapsUrl = event.latitude && event.longitude
    ? (originCoord
        ? `https://www.google.com/maps/dir/?api=1&origin=${originCoord.latitude},${originCoord.longitude}&destination=${event.latitude},${event.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`)
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

  // Extrai URL oficial de ingressos (Sympla, Bileto ou outra plataforma externa)
  const ticketUrl = React.useMemo(() => {
    if (!event) return null;

    const clean = (u: string) => u.trim().replace(/[.,;:)\]]+$/, '');

    const candidates: (string | undefined | null)[] = [
      event.contact,
      event.priceDetails,
      event.url,
      event.Url,
      event.description,
    ];

    for (const field of candidates) {
      if (!field || typeof field !== 'string') continue;

      const trimmed = field.trim();
      // Checa se o campo é uma URL direta
      if (/^https?:\/\//i.test(trimmed)) {
        const isMediaFile = /\.(jpg|jpeg|png|gif|webp|svg|mp4|mov)$/i.test(trimmed);
        if (!isMediaFile || trimmed.includes('sympla') || trimmed.includes('ticket')) {
          return clean(trimmed);
        }
      }

      // Busca URLs de ingressos ou Sympla dentro do texto
      const urlMatches = field.match(/https?:\/\/[^\s"'<>)]+/gi);
      if (urlMatches) {
        const ticketMatch = urlMatches.find(u => /sympla|bileto|ticket|ingresso|eventbrite|ingresse|bilheteria/i.test(u));
        if (ticketMatch) {
          return clean(ticketMatch);
        }
        const validUrl = urlMatches.find(u => !/\.(jpg|jpeg|png|gif|webp|svg|mp4|mov)$/i.test(u));
        if (validUrl) {
          return clean(validUrl);
        }
      }
    }

    return null;
  }, [event]);

  const isSympla = Boolean(
    ticketUrl && (ticketUrl.includes('sympla.com.br') || ticketUrl.includes('bileto.sympla'))
  );

  const isTicket360 = Boolean(
    ticketUrl && ticketUrl.includes('ticket360.com.br')
  );

  const cleanPriceDetails = React.useMemo(() => {
    if (!event?.priceDetails) return '';
    return event.priceDetails
      .replace(/https?:\/\/[^\s]+/gi, '')
      .replace(/Ingressos:\s*/gi, '')
      .replace(/Ingressos Sympla:\s*/gi, '')
      .replace(/Ingressos Ticket360:\s*/gi, '')
      .trim();
  }, [event?.priceDetails]);

  const handleShare = async () => {
    // Força o uso da URL de produção pública e limpa do app para evitar links do console do Google AI Studio ou links de desenvolvimento
    let cleanShareUrl = 'https://ais-pre-qs2o4mzsw3wxjtqbewcb3i-856757906261.us-east1.run.app';
    
    const currentUrl = window.location.href;
    // Se o usuário já estiver navegando pelo domínio limpo de produção e sem frames do AI Studio, pode utilizar a URL atual
    if (currentUrl.includes('ais-pre-') && !currentUrl.includes('ai.studio') && !currentUrl.includes('aistudio')) {
      cleanShareUrl = currentUrl;
    }

    const textToShare = `${event.title} no "Pra onde eu vou" - ${event.date} às ${event.time} em ${event.city}!\n${cleanShareUrl}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: textToShare,
          url: cleanShareUrl,
        });
        return;
      } catch (err) {
        // Fallback to clipboard
      }
    }
    await navigator.clipboard.writeText(textToShare);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyAddress = async () => {
    await navigator.clipboard.writeText(fullAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2500);
  };

  // Google Calendar link generator
  const getGoogleCalendarUrl = () => {
    const cleanDate = event.date.replace(/-/g, '');
    const cleanTime = event.time.replace(':', '');
    const startIso = `${cleanDate}T${cleanTime}00`;
    const endIso = event.endDate && event.endTime 
      ? `${event.endDate.replace(/-/g, '')}T${event.endTime.replace(':', '')}00`
      : `${cleanDate}T235900`;

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      event.title
    )}&dates=${startIso}/${endIso}&details=${encodeURIComponent(
      event.description
    )}&location=${encodeURIComponent(fullAddress)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      {/* Click backdrop to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col z-10">
        {/* Top Header Buttons (Visible immediately without scrolling) */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(event)}
              className="pointer-events-auto px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black flex items-center gap-2 shadow-2xl border-2 border-amber-300 transition-all text-xs cursor-pointer active:scale-95 animate-pulse"
              title="Clique para editar este evento ou trocar a foto do cartaz"
            >
              <Edit3 className="w-4 h-4 text-slate-950" />
              <span>EDITAR / TROCAR CARTAZ</span>
            </button>
          ) : <div />}

          {/* Close button */}
          <button
            onClick={onClose}
            className="pointer-events-auto px-3.5 py-1.5 rounded-full bg-slate-950/85 hover:bg-rose-500/30 text-slate-100 hover:text-rose-200 flex items-center gap-1.5 backdrop-blur-md border border-slate-700/80 hover:border-rose-500/50 transition-all text-xs font-bold shadow-lg cursor-pointer"
            aria-label="Fechar e sair dos detalhes"
            title="Fechar e sair dos detalhes do evento"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Sair</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto flex-1">
          {/* Vertical Poster Header Showcase */}
          <div className="relative py-6 sm:py-8 px-4 flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 border-b border-slate-800 overflow-hidden">
            {/* Ambient Blur Backdrop */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <img
                src={posterUrl}
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover filter blur-3xl opacity-25 scale-125"
              />
              <div className="absolute inset-0 bg-slate-950/60" />
            </div>

            {/* Selector between Poster and Video if video is available */}
            {hasVideo && (
              <div className="relative z-20 flex items-center justify-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setActiveMediaView('poster')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeMediaView === 'poster'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Cartaz Oficial</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMediaView('video')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeMediaView === 'video'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                  }`}
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Assistir ao Vídeo</span>
                </button>
              </div>
            )}

            {/* Video Player Display */}
            {hasVideo && activeMediaView === 'video' ? (
              <div className="relative z-10 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-fadeIn">
                <VideoPlayer
                  videoUrl={effectiveVideoUrl}
                  title={`Vídeo de ${event.title}`}
                  autoPlay={false}
                  poster={posterUrl}
                />
              </div>
            ) : (
              /* Poster in Vertical Format (3:4 or 4:5) */
              <div className="relative z-10 flex flex-col items-center">
                <div 
                  onClick={() => setIsZoomed(true)}
                  className="relative group cursor-pointer transition-transform duration-200 hover:scale-[1.02]"
                  title="Clique para ampliar o cartaz no formato vertical"
                >
                  <div className="w-56 sm:w-64 md:w-72 aspect-[3/4] sm:aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-700/80 bg-slate-950 relative ring-1 ring-white/10 flex items-center justify-center">
                    <img
                      src={posterUrl}
                      alt=""
                      aria-hidden="true"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover filter blur-xl opacity-30 scale-110 pointer-events-none"
                    />
                    <img
                      key={posterUrl}
                      src={posterUrl}
                      alt={event.title}
                      referrerPolicy="no-referrer"
                      loading="eager"
                      decoding="async"
                      className="relative z-10 w-full h-full object-contain bg-transparent"
                      onError={(e) => {
                        const target = e.currentTarget;
                        // 1. Tenta recuperar base64 inline diretamente do evento se existir
                        const candidates = [event.url, event.Url, event.imageUrl, (event as any).imagem_url];
                        for (const c of candidates) {
                          if (typeof c === 'string' && c.trim().startsWith('data:image/') && target.src !== c.trim()) {
                            target.src = c.trim();
                            return;
                          }
                        }

                        const src = target.src || '';
                        if (!target.dataset.apiTried && (src.includes('/uploads/images/') || (!src.startsWith('data:') && (event.id || src.includes('user-'))))) {
                          target.dataset.apiTried = '1';
                          const fname = src.includes('/uploads/images/')
                            ? src.split('/uploads/images/')[1].split('?')[0]
                            : `${event.id}.jpg`;
                          fetch(`/api/image-base64/${fname}`)
                            .then((r) => r.json())
                            .then((res) => {
                              if (res?.success && res.base64) {
                                target.src = res.base64;
                              }
                            })
                            .catch(() => {});
                          return;
                        }
                        if (!target.dataset.altExtTried && src.includes('.jpg')) {
                          target.dataset.altExtTried = '1';
                          target.src = src.replace('.jpg', '.jpeg');
                          return;
                        } else if (!target.dataset.altExtTried && src.includes('.jpeg')) {
                          target.dataset.altExtTried = '1';
                          target.src = src.replace('.jpeg', '.jpg');
                          return;
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 text-amber-300 text-xs font-semibold border border-amber-500/40 shadow-lg">
                        <ZoomIn className="w-3.5 h-3.5" />
                        Ampliar Cartaz Vertical
                      </span>
                    </div>
                  </div>

                  {/* Floating Badges */}
                  <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 pointer-events-none">
                    <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-500 text-slate-950 shadow-md">
                      {event.category}
                    </span>
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-950/85 text-emerald-400 border border-emerald-500/30 backdrop-blur-sm shadow">
                      Formato Vertical
                    </span>
                  </div>

                  <div className="absolute bottom-2.5 right-2.5 pointer-events-none">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold shadow-md ${
                      event.isFree
                        ? 'bg-emerald-500/95 text-slate-950'
                        : 'bg-slate-950/90 text-amber-300 border border-amber-500/30'
                    }`}>
                      {event.isFree
                        ? 'Entrada Franca'
                        : (event.price ? `A partir de R$ ${event.price.toFixed(2).replace('.', ',')}` : (event.priceDetails || 'Consulte valores'))}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-800/80 w-full max-w-sm">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Cartaz oficial vertical</span>
                    <button
                      type="button"
                      onClick={() => setIsZoomed(true)}
                      className="text-amber-400 hover:text-amber-300 font-semibold underline ml-1 cursor-pointer"
                    >
                      Ampliar
                    </button>
                  </div>
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(event)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-md active:scale-95"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-950" />
                      <span>Trocar Foto / Cartaz</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Title & Quick Actions */}
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 leading-tight">
                {event.title}
              </h2>
              <p className="text-sm text-amber-400 capitalize flex items-center gap-2 font-medium">
                <Calendar className="w-4 h-4" />
                {formattedDate} • às {event.time}
                {event.endTime && ` até ${event.endTime}`}
              </p>
            </div>

            {/* Quick Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-400">Local do Evento</div>
                  <div className="text-sm font-semibold text-white truncate">{event.locationName}</div>
                  <div className="text-xs text-slate-400 truncate">{event.address}</div>
                  <div className="text-xs font-medium text-slate-300">{event.city} - {event.state}</div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {event.latitude && event.longitude && (
                      <span className="text-[11px] font-mono text-emerald-400">
                        📍 {event.latitude}, {event.longitude}
                      </span>
                    )}
                    {distKm !== null && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        <Navigation className="w-3 h-3 text-emerald-400" />
                        {distKm < 1 
                          ? `Menos de 1 km ${isUsingRealGps ? 'de você (GPS)' : `de você (${userOriginCity})`}` 
                          : `Aprox. ${distKm.toFixed(1).replace('.', ',')} km ${isUsingRealGps ? 'da sua localização (GPS)' : `da sua localização (${userOriginCity})`}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-400">Ingressos & Valores</div>
                  <div className="text-sm font-semibold text-white">
                    {event.isFree
                      ? 'Gratuito / Entrada Franca'
                      : (event.price 
                          ? `Preço a partir de R$ ${event.price.toFixed(2).replace('.', ',')}` 
                          : (isSympla ? 'Vendas no Sympla' : isTicket360 ? 'Vendas na Ticket360' : (cleanPriceDetails || 'Consulte valores')))}
                  </div>
                  {cleanPriceDetails && event.price && (
                    <div className="text-xs text-slate-400 mt-0.5">{cleanPriceDetails}</div>
                  )}
                  {!event.isFree && (
                    <div className="text-[10px] text-amber-400/80 leading-tight mt-1 max-w-[260px]">
                      * Valores sujeitos a alteração de lote. Confirme na página oficial de compra.
                    </div>
                  )}

                  {/* Link / Botão Oficial de Ingressos (Sympla / Ticket360 / Bilheteria) */}
                  {ticketUrl && (
                    <div className="mt-2.5">
                      <a
                        href={ticketUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 border border-emerald-400/30 transition-all transform active:scale-95 group cursor-pointer"
                        title={isSympla ? "Abrir página oficial do evento e compra de ingressos na Sympla" : isTicket360 ? "Abrir página oficial do evento e compra de ingressos na Ticket360" : "Abrir página oficial de ingressos"}
                      >
                        <Ticket className="w-4 h-4 text-emerald-200 group-hover:rotate-12 transition-transform" />
                        <span>{isSympla ? 'Comprar Ingressos no Sympla' : isTicket360 ? 'Comprar Ingressos na Ticket360' : 'Comprar Ingressos'}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-emerald-200" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-400">Organização</div>
                  <div className="text-sm font-semibold text-white">{event.organizer}</div>
                  {event.contact && (
                    (event.contact.startsWith('http://') || event.contact.startsWith('https://')) ? (
                      <a
                        href={event.contact}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 underline mt-1 font-medium group"
                      >
                        <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        <span className="truncate max-w-[240px]">
                          {event.contact.includes('sympla') ? 'Página do Evento no Sympla' : event.contact}
                        </span>
                      </a>
                    ) : (
                      <div className="text-xs text-indigo-400 mt-0.5">{event.contact}</div>
                    )
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">Horário</div>
                  <div className="text-sm font-semibold text-white">
                    Início às {event.time}
                    {event.endTime && ` (término previsto: ${event.endTime})`}
                  </div>
                  {event.endDate && event.endDate !== event.date && (
                    <div className="text-xs text-slate-400">Até {event.endDate}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">
                Sobre este evento
              </h3>
              <p className="text-slate-200 text-sm sm:text-base leading-relaxed whitespace-pre-line bg-slate-950/30 p-4 rounded-xl border border-slate-800/60">
                {event.description?.trim() || 'Sem descrição adicional informada pelo anunciante.'}
              </p>
            </div>

            {/* Tags */}
            {event.tags && event.tags.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                  Tags do evento
                </h3>
                <div className="flex flex-wrap gap-2">
                  {event.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700/60"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              {ticketUrl && (
                <a
                  href={ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-[170px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold border border-emerald-400/40 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer group transform active:scale-95"
                  title={isSympla ? "Abrir página de ingressos na Sympla em uma nova aba" : isTicket360 ? "Abrir página de ingressos na Ticket360 em uma nova aba" : "Abrir página oficial de ingressos em uma nova aba"}
                >
                  <Ticket className="w-4 h-4 text-emerald-200 group-hover:rotate-12 transition-transform" />
                  <span>{isSympla ? 'Comprar no Sympla' : isTicket360 ? 'Comprar na Ticket360' : 'Comprar Ingressos'}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-200" />
                </a>
              )}

              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 min-w-[150px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
              >
                <MapPin className="w-4 h-4 text-amber-400" />
                <span>Abrir no Maps</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>

              <a
                href={getGoogleCalendarUrl()}
                target="_blank"
                rel="noreferrer"
                className="flex-1 min-w-[160px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
              >
                <CalendarPlus className="w-4 h-4 text-indigo-400" />
                <span>Salvar na Agenda</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>

              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-md"
              >
                {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                <span>{copied ? 'Link Copiado!' : 'Compartilhar'}</span>
              </button>

              <button
                onClick={handleCopyAddress}
                title="Copiar Endereço"
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                {copiedAddress ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>

              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(event)}
                  title="Editar Evento / Trocar Imagem do Cartaz"
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/25 to-amber-600/25 hover:from-amber-500/35 hover:to-amber-600/35 text-amber-300 border border-amber-500/50 text-xs font-bold transition-all cursor-pointer shadow-md shadow-amber-950/30 active:scale-95 ml-auto"
                >
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  <span>Editar / Trocar Cartaz</span>
                </button>
              )}

              {onDelete && (
                <button
                  onClick={() => {
                    if (confirm(`Tem certeza que deseja remover o evento "${event.title}"?`)) {
                      onDelete(event.id);
                      onClose();
                    }
                  }}
                  title="Remover Evento"
                  className="p-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 transition-colors ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox / Zoom do Cartaz Vertical */}
      {isZoomed && (
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md animate-fadeIn"
          onClick={() => setIsZoomed(false)}
        >
          <div className="relative max-w-md w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsZoomed(false)}
              className="absolute -top-11 right-0 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-white hover:text-rose-400 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Fechar</span>
            </button>
            <div className="w-full max-h-[85vh] aspect-[3/4] sm:aspect-[4/5] rounded-2xl overflow-hidden border-2 border-amber-500/50 shadow-2xl bg-slate-950 flex items-center justify-center">
              <img
                src={posterUrl}
                alt={event.title}
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="text-xs text-slate-300 font-medium mt-3 text-center">
              {event.title} • {event.category}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
