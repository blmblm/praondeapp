import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Lock, Eye, EyeOff, AlertCircle, X, Sparkles, CheckCircle2 } from 'lucide-react';

export interface MasterPasswordModalProps {
  isOpen: boolean;
  eventTitle?: string;
  onSuccess: () => void;
  onClose: () => void;
}

const INITIAL_PIN = '0612';
const ADMIN_PIN_KEY = 'praonde_admin_pin';

export const MasterPasswordModal: React.FC<MasterPasswordModalProps> = ({
  isOpen,
  eventTitle,
  onSuccess,
  onClose,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setErrorMessage('');
      setShowPassword(false);
      setIsVerifying(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = password.trim();

    if (!cleaned) {
      setErrorMessage('Por favor, informe a senha master.');
      inputRef.current?.focus();
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');

    try {
      // 1. Verifica contra senha armazenada localmente ou PIN padrão 0612
      let storedPin = INITIAL_PIN;
      try {
        storedPin = localStorage.getItem(ADMIN_PIN_KEY) || INITIAL_PIN;
      } catch {}

      if (cleaned === INITIAL_PIN || cleaned === storedPin) {
        onSuccess();
        onClose();
        return;
      }

      // 2. Valida contra o backend administrativo (exclusivo para role 'master')
      const res = await fetch('/api/admin/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: cleaned }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.valid && data.role === 'master') {
          onSuccess();
          onClose();
          return;
        }
        if (data.valid && data.role !== 'master') {
          setErrorMessage('Acesso negado: apenas a Senha Master permite editar cartazes.');
          setPassword('');
          inputRef.current?.focus();
          return;
        }
      }

      setErrorMessage('Senha master incorreta. Acesso restrito ao administrador.');
      setPassword('');
      inputRef.current?.focus();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao validar senha master.');
      inputRef.current?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/30 rounded-2xl shadow-2xl p-6 overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow de fundo */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Botão fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Ícone e Cabeçalho */}
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-3 shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Acesso Restrito — Senha Master
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            A edição e substituição de cartazes é protegida e não pode ser alterada por usuários finais.
          </p>
        </div>

        {/* Contexto do Evento */}
        {eventTitle && (
          <div className="mb-4 p-3 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[11px] uppercase tracking-wider text-amber-400/90 font-semibold block">
                Evento selecionado
              </span>
              <p className="text-xs font-medium text-slate-200 truncate">
                {eventTitle}
              </p>
            </div>
          </div>
        )}

        {/* Formulário de Senha */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Digite a Senha Master para liberar
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4 text-amber-400" />
              </div>
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="Informe a senha de administrador..."
                autoComplete="off"
                disabled={isVerifying}
                className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-800/80 border border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-white text-sm placeholder-slate-500 transition-all outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Mensagem de Erro */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isVerifying}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isVerifying}
              className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              {isVerifying ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Validando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-slate-950" />
                  <span>Liberar Edição</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
