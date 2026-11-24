import React from 'react';
import { Loader2, Music } from 'lucide-react';

interface InitialLoadingScreenProps {
  progress: number;
  statusText?: string;
}

export const InitialLoadingScreen: React.FC<InitialLoadingScreenProps> = ({
  progress,
  statusText = 'Carregando os eventos...',
}) => {
  const clamped = Math.max(8, Math.min(100, Math.round(progress)));

  return (
    <div
      id="app-react-initial-loader"
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#0b0d17] via-slate-950 to-[#0b0d17] text-slate-100 px-6 text-center select-none"
    >
      {/* Ícone do Aplicativo */}
      <div className="mb-6">
        <div className="w-20 h-20 rounded-[22px] overflow-hidden border-2 border-amber-500/70 shadow-[0_12px_30px_-5px_rgba(245,158,11,0.35),0_0_20px_rgba(245,158,11,0.2)] bg-slate-900 flex items-center justify-center">
          <img
            src="/app-icon.jpg"
            alt="Pra onde eu vou"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
            className="w-full h-full object-cover"
          />
          <Music className="w-8 h-8 text-amber-400 hidden" aria-hidden="true" />
        </div>
      </div>

      {/* Título e Slogan */}
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1.5">
        Pra onde eu <span className="text-amber-400">vou</span>?
      </h1>
      <p className="text-sm font-medium text-amber-200/90 max-w-xs leading-relaxed mb-7">
        A vida é feita de momentos que aquecem o coração
      </p>

      {/* Indicador de Carregamento + Barra de Progresso */}
      <div className="w-full max-w-[280px] flex flex-col items-center gap-3">
        <div className="flex items-center justify-center gap-2.5 text-amber-400 text-sm sm:text-base font-bold">
          <Loader2 className="w-5 h-5 animate-spin shrink-0" aria-hidden="true" />
          <span>{statusText}</span>
        </div>

        {/* Barra de Progresso Suave */}
        <div className="w-full h-2.5 rounded-full bg-slate-800/90 border border-slate-700/80 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 transition-transform duration-300 ease-out origin-left"
            style={{ transform: `scaleX(${clamped / 100})` }}
          />
        </div>

        <div className="w-full flex items-center justify-between text-xs text-slate-400 tabular-nums">
          <span>Preparando a tela inicial</span>
          <span className="font-bold text-amber-300">{clamped}%</span>
        </div>
      </div>
    </div>
  );
};
