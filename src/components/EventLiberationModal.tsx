import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  ZoomIn, 
  Calendar, 
  Clock, 
  MapPin, 
  DollarSign, 
  User, 
  Check, 
  ShieldCheck, 
  ImageIcon, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { EventItem } from '../types';

interface EventLiberationModalProps {
  isOpen: boolean;
  event: EventItem | null;
  onClose: () => void;
  onSaveLiberation: (id: string, liberado: 'S' | 'N') => Promise<void> | void;
  onNextEvent?: () => void;
  onPrevEvent?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  currentIndex?: number;
  totalPending?: number;
}

export const EventLiberationModal: React.FC<EventLiberationModalProps> = ({
  isOpen,
  event,
  onClose,
  onSaveLiberation,
  onNextEvent,
  onPrevEvent,
  hasPrev = false,
  hasNext = false,
  currentIndex = 0,
  totalPending = 1,
}) => {
  // O estado do campo: 'S' (Liberado) ou 'N' (Não Liberado / Pendente)
  const [selectedLiberado, setSelectedLiberado] = useState<'S' | 'N'>('S');
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (event) {
      // Pré-seleciona 'S' para que o botão Confirmar Liberação já esteja pronto para salvar com 'S'
      setSelectedLiberado('S');
      setSaveFeedback(null);
      setIsZoomed(false);
      setImgError(false);
    }
  }, [event]);

  if (!isOpen || !event) return null;

  const handleConfirmLiberation = async (statusOverride?: 'S' | 'N') => {
    const statusToSave = statusOverride || selectedLiberado;
    setIsSaving(true);
    setSaveFeedback(null);
    try {
      await onSaveLiberation(event.id, statusToSave);
      setSelectedLiberado(statusToSave);
      setSaveFeedback({
        type: 'success',
        msg: statusToSave === 'S' 
          ? 'Evento liberado com sucesso! O campo liberado do cadastro foi atualizado com "S".'
          : 'Status salvo: O campo liberado do cadastro foi atualizado com "N" (Não Liberado).',
      });
      setTimeout(() => {
        // Se houver próximo evento pendente e foi liberado com "S", avança automaticamente
        if (statusToSave === 'S' && hasNext && onNextEvent) {
          onNextEvent();
        } else if (!hasNext && statusToSave === 'S') {
          onClose();
        }
      }, 900);
    } catch (err) {
      setSaveFeedback({
        type: 'error',
        msg: 'Erro ao atualizar campo liberado no cadastro. Tente novamente.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const currentStatusLabel = !event.liberado || event.liberado === '' 
    ? 'Em Branco ("") - Aguardando Análise' 
    : event.liberado === 'N' 
      ? 'Não Liberado ("N")' 
      : 'Liberado ("S")';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Main Modal Card */}
      <div 
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white truncate">
                  Análise de Publicação & Imagem do Evento
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  ID: {event.id}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                  !event.liberado || event.liberado === ''
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : event.liberado === 'N'
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                }`}>
                  {currentStatusLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Analise os detalhes e o material gráfico antes de autorizar a exibição pública
              </p>
            </div>
          </div>

          {/* Controls: Pagination and Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            {totalPending > 1 && (
              <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700 text-xs text-slate-300">
                <button
                  type="button"
                  onClick={onPrevEvent}
                  disabled={!hasPrev}
                  className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Evento Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-[11px] px-1 font-semibold">
                  {currentIndex + 1} de {totalPending}
                </span>
                <button
                  type="button"
                  onClick={onNextEvent}
                  disabled={!hasNext}
                  className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Próximo Evento"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-slate-700"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Top Feedback Banner */}
          {saveFeedback && (
            <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
              saveFeedback.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}>
              {saveFeedback.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="font-medium">{saveFeedback.msg}</span>
            </div>
          )}

          {/* Grid Layout: Left = Image Preview (Analysis) / Right = Info & Decision */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* LEFT COLUMN: Visualização da Imagem para Análise */}
            <div className="lg:col-span-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  Visualização da Imagem (Cartaz / Flyer)
                </span>
                <button
                  type="button"
                  onClick={() => setIsZoomed(!isZoomed)}
                  className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer font-medium"
                >
                  <ZoomIn className="w-3 h-3" />
                  <span>{isZoomed ? 'Modo Normal' : 'Zoom de Análise'}</span>
                </button>
              </div>

              {/* Image Card Container */}
              <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 flex flex-col items-center justify-center min-h-[260px] max-h-[460px] group shadow-inner">
                {imgError ? (
                  <div className="p-8 text-center space-y-2">
                    <ImageIcon className="w-12 h-12 text-slate-600 mx-auto" />
                    <p className="text-xs text-rose-400 font-semibold">Não foi possível carregar a imagem</p>
                    <p className="text-[11px] text-slate-500 max-w-xs break-all">{event.imageUrl}</p>
                  </div>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                    <img
                      src={event.imageUrl}
                      alt={event.title}
                      referrerPolicy="no-referrer"
                      onError={() => setImgError(true)}
                      className={`object-contain w-full transition-transform duration-300 ${
                        isZoomed ? 'scale-125 cursor-zoom-out' : 'max-h-[380px] cursor-zoom-in'
                      }`}
                      onClick={() => setIsZoomed(!isZoomed)}
                    />
                    
                    {/* Floating pill with Category */}
                    <div className="absolute top-2.5 left-2.5 pointer-events-none">
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-950/85 text-amber-300 border border-amber-500/30 backdrop-blur-sm shadow-md">
                        {event.category}
                      </span>
                    </div>

                    {/* Open original link button */}
                    <a
                      href={event.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-700/80 text-[10px] font-medium flex items-center gap-1 backdrop-blur-sm transition-colors"
                      title="Abrir imagem original em nova guia"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Ver Original</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Image Inspection Checklist */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5 text-xs mb-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Critérios de Análise do Cartaz:
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <span className="text-slate-400">• Legibilidade de data e local</span>
                  <span className="text-slate-400">• Resolução e nitidez gráfica</span>
                  <span className="text-slate-400">• Ausência de conteúdo impróprio</span>
                  <span className="text-slate-400">• Conformidade com a categoria</span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Event Details & Liberation Field */}
            <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
              {/* Event Metadata Card */}
              <div className="space-y-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                    Título do Evento
                  </span>
                  <h4 className="text-base font-bold text-white leading-snug">
                    {event.title}
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800/80">
                  <div className="flex items-start gap-1.5 text-slate-300">
                    <Calendar className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-500 block">Data:</span>
                      <span className="font-mono font-medium">{event.date}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-1.5 text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-500 block">Horário:</span>
                      <span className="font-mono font-medium">{event.time} {event.endTime ? `às ${event.endTime}` : ''}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-1.5 text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-500 block">Cidade / Local:</span>
                      <span className="font-medium text-white">{event.city} - {event.state}</span>
                      <span className="text-[10px] text-slate-400 block truncate max-w-[170px]">{event.locationName}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-1.5 text-slate-300">
                    <DollarSign className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-500 block">Ingresso:</span>
                      <span className="font-medium text-emerald-400">
                        {event.isFree ? 'Entrada Franca' : event.price ? `R$ ${event.price.toFixed(2)}` : 'A consultar'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-xs pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-slate-300 mb-1">
                    <User className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="text-[10px] text-slate-500">Organizador / Anunciante:</span>
                    <span className="font-medium text-white">{event.organizer || 'Não informado'}</span>
                    {event.contact && (
                      <span className="text-[10px] text-slate-400 font-mono">({event.contact})</span>
                    )}
                  </div>
                </div>

                {event.description && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-0.5">
                      Descrição da Atração:
                    </span>
                    <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                      {event.description}
                    </p>
                  </div>
                )}
              </div>

              {/* =========================================================================
                  CAMPO DE LIBERAÇÃO DA PUBLICAÇÃO (SOLICITADO)
                  "e um campo se a publicação sera liberada ou não"
                  ========================================================================= */}
              <div className="p-4 rounded-xl bg-slate-950 border-2 border-amber-500/40 space-y-3.5 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      <span>Decisão: A publicação será liberada?</span>
                      <span className="text-amber-400">*</span>
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Defina se este evento será aprovado para visualização no aplicativo:
                    </p>
                  </div>
                </div>

                {/* Opções de Seleção Visual e Clara: 'S' ou 'N' */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* OPÇÃO 1: SIM (LIBERADO = 'S') */}
                  <button
                    type="button"
                    onClick={() => setSelectedLiberado('S')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                      selectedLiberado === 'S'
                        ? 'bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/10'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-bold flex items-center gap-1.5 ${
                        selectedLiberado === 'S' ? 'text-emerald-300' : 'text-slate-300'
                      }`}>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>SIM, Liberar</span>
                      </span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                        selectedLiberado === 'S' ? 'bg-emerald-500/30 text-emerald-200' : 'bg-slate-800 text-slate-400'
                      }`}>
                        liberar = "S"
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Aprova a publicação. O evento será exibido no catálogo público.
                    </p>
                  </button>

                  {/* OPÇÃO 2: NÃO (LIBERADO = 'N') */}
                  <button
                    type="button"
                    onClick={() => setSelectedLiberado('N')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                      selectedLiberado === 'N'
                        ? 'bg-rose-500/20 border-rose-500 ring-2 ring-rose-500/40 shadow-lg shadow-rose-500/10'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-bold flex items-center gap-1.5 ${
                        selectedLiberado === 'N' ? 'text-rose-300' : 'text-slate-300'
                      }`}>
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                        <span>NÃO Liberar</span>
                      </span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                        selectedLiberado === 'N' ? 'bg-rose-500/30 text-rose-200' : 'bg-slate-800 text-slate-400'
                      }`}>
                        liberar = "N"
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Bloqueia ou mantém pendente. O evento não aparecerá para o público.
                    </p>
                  </button>
                </div>

                {/* Botões de Ação */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer text-center"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={() => handleConfirmLiberation('N')}
                    disabled={isSaving}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Salvar status como Não Liberado (liberado = 'N')"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Não Liberar ("N")</span>
                  </button>

                  <button
                    type="button"
                    id="btn-confirmar-liberacao"
                    onClick={() => handleConfirmLiberation('S')}
                    disabled={isSaving}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25 ring-2 ring-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Atualiza o campo liberado do cadastro do evento com 'S' e publica o evento"
                  >
                    {isSaving && selectedLiberado === 'S' ? (
                      <span>Atualizando cadastro para "S"...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-slate-950" />
                        <span>Confirmar Liberação (liberado = "S")</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
