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
  Trash2
} from 'lucide-react';
import { EventItem } from '../types';

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

  if (!event) return null;

  const formattedDate = new Date(event.date + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const fullAddress = `${event.locationName}, ${event.address} - ${event.city}/${event.state}`;
  const googleMapsUrl = event.latitude && event.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

  const handleShare = async () => {
    const textToShare = `${event.title} no "Pra onde eu vou" - ${event.date} às ${event.time} em ${event.city}!\n${window.location.href}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: textToShare,
          url: window.location.href,
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
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-slate-950/70 hover:bg-slate-950 text-white flex items-center justify-center backdrop-blur-md border border-slate-700/60 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto flex-1">
          {/* Cover Image Header */}
          <div className="relative h-64 sm:h-72 w-full bg-slate-950">
            <img
              src={event.imageUrl}
              alt={event.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />

            <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2">
              <span className="inline-block px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-500 text-slate-950 shadow-md">
                {event.category}
              </span>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-lg text-xs font-bold shadow-md ${
                  event.isFree
                    ? 'bg-emerald-500/90 text-slate-950'
                    : 'bg-slate-950/90 text-amber-300 border border-amber-500/30'
                }`}>
                  {event.isFree ? 'Entrada Franca' : `R$ ${event.price?.toFixed(2).replace('.', ',')}`}
                </span>
              </div>
            </div>
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
                    <div className="text-[11px] font-mono text-emerald-400 mt-0.5 truncate">
                      📍 {event.latitude}, {event.longitude}
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
                    {event.isFree ? 'Gratuito' : `R$ ${event.price?.toFixed(2).replace('.', ',')}`}
                  </div>
                  {event.priceDetails && (
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
                {event.description}
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
    </div>
  );
};
