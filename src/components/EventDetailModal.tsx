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
  ImageIcon
} from 'lucide-react';
import { EventItem } from '../types';
import { useUserLocation } from '../context/LocationContext';
import { parseVideoUrl, isVideoFormatUrl } from '../lib/videoUtils';
import { VideoPlayer } from './VideoPlayer';

interface EventDetailModalProps {
  event: EventItem | null;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  onClose,
  onDelete,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  
  const effectiveVideoUrl = event
    ? (
        event.video_url ||
        event.video_utl ||
        event.videoUrl ||
        (event.url && isVideoFormatUrl(event.url) ? event.url : '') ||
        (event.Url && isVideoFormatUrl(event.Url) ? event.Url : '') ||
        (event.mediaType === 'video' ? (event.url || event.Url || event.videoUrl || event.video_url || event.video_utl) : '')
      )
    : '';
  const hasVideo = Boolean(effectiveVideoUrl);

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

  const { coords, getDistanceKmTo } = useUserLocation();

  if (!event) return null;

  const parsedVideo = effectiveVideoUrl ? parseVideoUrl(effectiveVideoUrl) : null;

  const distKm = getDistanceKmTo(event.latitude, event.longitude);

  const formattedDate = new Date(event.date + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const fullAddress = `${event.locationName}, ${event.address} - ${event.city}/${event.state}`;
  const googleMapsUrl = event.latitude && event.longitude
    ? (coords
        ? `https://www.google.com/maps/dir/?api=1&origin=${coords.latitude},${coords.longitude}&destination=${event.latitude},${event.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`)
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

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
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 px-3 py-1.5 rounded-full bg-slate-950/85 hover:bg-rose-500/30 text-slate-100 hover:text-rose-200 flex items-center gap-1.5 backdrop-blur-md border border-slate-700/80 hover:border-rose-500/50 transition-all text-xs font-bold shadow-lg cursor-pointer"
          aria-label="Fechar e sair dos detalhes"
          title="Fechar e sair dos detalhes do evento"
        >
          <X className="w-4 h-4 text-rose-400" />
          <span>Sair</span>
        </button>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto flex-1">
          {/* Vertical Poster Header Showcase */}
          <div className="relative py-6 sm:py-8 px-4 flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 border-b border-slate-800 overflow-hidden">
            {/* Ambient Blur Backdrop */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <img
                src={event.imageUrl}
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
                      src={event.imageUrl}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover filter blur-xl opacity-30 scale-110 pointer-events-none"
                    />
                    <img
                      src={event.imageUrl}
                      alt={event.title}
                      className="relative z-10 w-full h-full object-contain bg-transparent"
                      referrerPolicy="no-referrer"
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
                        : (event.price ? `R$ ${event.price.toFixed(2).replace('.', ',')}` : (event.priceDetails || 'Consulte valores'))}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2.5 text-[11px] text-slate-400">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Cartaz oficial do evento no formato vertical</span>
                  <button
                    type="button"
                    onClick={() => setIsZoomed(true)}
                    className="text-amber-400 hover:text-amber-300 font-semibold underline ml-1 cursor-pointer"
                  >
                    Ampliar
                  </button>
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
                  {event.latitude && event.longitude && (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-[11px] font-mono text-emerald-400">
                        📍 {event.latitude}, {event.longitude}
                      </span>
                      {distKm !== null && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          <Navigation className="w-3 h-3 text-emerald-400" />
                          {distKm < 1 ? 'Menos de 1 km de você' : `Aprox. ${distKm} km da sua localização`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">Ingressos & Valores</div>
                  <div className="text-sm font-semibold text-white">
                    {event.isFree
                      ? 'Gratuito'
                      : (event.price ? `R$ ${event.price.toFixed(2).replace('.', ',')}` : (event.priceDetails || 'Consulte valores'))}
                  </div>
                  {event.priceDetails && event.price && (
                    <div className="text-xs text-slate-400 mt-0.5">{event.priceDetails}</div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">Organização</div>
                  <div className="text-sm font-semibold text-white">{event.organizer}</div>
                  {event.contact && (
                    <div className="text-xs text-indigo-400 mt-0.5">{event.contact}</div>
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
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 min-w-[160px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
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
                src={event.imageUrl}
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
