import React, { useEffect, useState } from 'react';
import {
  X,
  Share,
  CheckCircle2,
  MoreVertical,
} from 'lucide-react';
import appIconUrl from '../assets/images/app_icon_1788820561686.jpg';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isIOS: boolean;
  isAndroid: boolean;
  isInstalled: boolean;
  hasNativePrompt: boolean;
  initialShowTip?: boolean;
  onPromptInstall: () => Promise<'accepted' | 'dismissed' | 'manual'>;
  onDismissPermanent?: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  isIOS,
  isInstalled,
  hasNativePrompt,
  initialShowTip = false,
  onPromptInstall,
  onDismissPermanent,
}) => {
  const [showSimpleTip, setShowSimpleTip] = useState(initialShowTip);

  useEffect(() => {
    if (isOpen) {
      setShowSimpleTip(Boolean(initialShowTip));
    }
  }, [isOpen, initialShowTip]);

  if (!isOpen) return null;

  const handleConfirmYes = async () => {
    if (hasNativePrompt) {
      const outcome = await onPromptInstall();
      if (outcome === 'accepted') {
        onClose();
        return;
      }
      if (outcome === 'dismissed') {
        onClose();
        return;
      }
    }
    setShowSimpleTip(true);
  };

  const handleConfirmNo = () => {
    onDismissPermanent?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/40 rounded-3xl p-5 shadow-2xl text-slate-100 animate-in slide-in-from-bottom-6 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4 pr-8">
          <div className="w-12 h-12 rounded-2xl overflow-hidden ring-2 ring-amber-500/50 shadow-md bg-slate-950 p-0.5 shrink-0">
            <img
              src={appIconUrl}
              alt="Ícone Pra onde eu vou"
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <div>
            <h2 className="text-base font-black text-white leading-tight">
              Quer gravar o ícone no celular?
            </h2>
            <p className="text-xs text-amber-300/90 font-medium mt-0.5">
              Para abrir direto com 1 toque na sua tela
            </p>
          </div>
        </div>

        {isInstalled ? (
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="font-bold">O ícone já está gravado no seu celular!</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        ) : showSimpleTip ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                {isIOS ? <Share className="w-5 h-5" /> : <MoreVertical className="w-5 h-5" />}
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-snug">
                {isIOS ? (
                  <>
                    Toque no botão <strong className="text-amber-300">Compartilhar</strong> embaixo e depois em{' '}
                    <strong className="text-amber-300">"Adicionar à Tela de Início"</strong>.
                  </>
                ) : (
                  <>
                    Toque nos <strong className="text-amber-300">3 pontinhos (⋮)</strong> lá em cima e escolha{' '}
                    <strong className="text-amber-300">"Adicionar à tela inicial"</strong>.
                  </>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition-colors cursor-pointer"
            >
              Entendi
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              id="btn-pwa-modal-yes"
              type="button"
              onClick={handleConfirmYes}
              className="py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/25 transition-all active:scale-95 cursor-pointer"
            >
              Sim
            </button>
            <button
              id="btn-pwa-modal-no"
              type="button"
              onClick={handleConfirmNo}
              className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 transition-all active:scale-95 cursor-pointer"
            >
              Não
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
