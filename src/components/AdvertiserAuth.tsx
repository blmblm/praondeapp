import React, { useState } from 'react';
import { 
  UserCheck, 
  UserPlus, 
  Mail, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  KeyRound, 
  Building2, 
  Phone, 
  Send, 
  RefreshCw, 
  Info, 
  Smartphone, 
  MessageSquare, 
  ExternalLink, 
  Search,
  X
} from 'lucide-react';
import { Advertiser, ActiveScreen } from '../types';

interface AdvertiserAuthProps {
  onSuccess: (advertiser: Advertiser) => void;
  onNavigate: (screen: ActiveScreen) => void;
  registeredAdvertisers: Advertiser[];
  onRegisterAdvertiser: (advertiser: Advertiser) => void;
}

type AuthMode = 'ask' | 'login' | 'register_request' | 'register_verify';

export const AdvertiserAuth: React.FC<AdvertiserAuthProps> = ({
  onSuccess,
  onNavigate,
  registeredAdvertisers,
  onRegisterAdvertiser,
}) => {
  const [mode, setMode] = useState<AuthMode>('ask');

  // Existing user login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [checkedNotFoundEmail, setCheckedNotFoundEmail] = useState<string | null>(null);

  // New user registration state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Verification Code State
  const [verificationCode, setVerificationCode] = useState('');
  const [enteredCode, setEnteredCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeResentNotice, setCodeResentNotice] = useState(false);

  // Helper to format Brazilian phone number
  const handlePhoneChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 0) {
      if (digits.length <= 2) {
        formatted = `(${digits}`;
      } else if (digits.length <= 6) {
        formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      } else if (digits.length <= 10) {
        formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
      } else {
        formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
      }
    }
    setNewPhone(formatted);
    setRegisterError(null);
  };

  // Helper to generate 6-digit code
  const generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Handle Login for Existing Advertisers (Check if email is registered)
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setCheckedNotFoundEmail(null);

    const cleanEmail = loginEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setLoginError('Por favor, digite seu e-mail cadastrado.');
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setLoginError('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    setIsCheckingEmail(true);

    // Simulate database lookup / check against registered advertisers
    setTimeout(() => {
      const found = registeredAdvertisers.find(
        (adv) => adv.email.toLowerCase() === cleanEmail
      );

      setIsCheckingEmail(false);

      if (found) {
        onSuccess(found);
      } else {
        setCheckedNotFoundEmail(cleanEmail);
        setLoginError(
          `O e-mail "${cleanEmail}" não foi encontrado no cadastro de anunciantes.`
        );
      }
    }, 450);
  };

  // Handle Sending Verification Code to User's Phone
  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);
    setCodeError(null);
    setCodeResentNotice(false);

    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setRegisterError('Por favor, informe um e-mail válido.');
      return;
    }

    const phoneDigits = newPhone.replace(/\D/g, '');
    if (!phoneDigits || phoneDigits.length < 10) {
      setRegisterError('Por favor, informe um número de celular válido com DDD (ex: 11 98765-4321) para envio do código.');
      return;
    }

    // Check if email is already registered
    const alreadyExists = registeredAdvertisers.some(
      (adv) => adv.email.toLowerCase() === cleanEmail
    );

    if (alreadyExists) {
      setRegisterError(
        'Este e-mail já está cadastrado no sistema. Clique em "Já tenho cadastro" para entrar.'
      );
      return;
    }

    setIsSendingCode(true);

    // Generate code and dispatch to mobile phone
    setTimeout(() => {
      const generated = generateCode();
      setVerificationCode(generated);
      setIsSendingCode(false);
      setMode('register_verify');
      setEnteredCode('');

      // Send to console for development tracking
      console.info(`%c[SMS/WhatsApp Celular] Código enviado para ${newPhone}: ${generated}`, 'color: #f59e0b; font-weight: bold;');
    }, 600);
  };

  // Handle Resending Code to the Phone
  const handleResendCode = () => {
    setIsSendingCode(true);
    setCodeError(null);
    setCodeResentNotice(false);

    setTimeout(() => {
      const generated = generateCode();
      setVerificationCode(generated);
      setIsSendingCode(false);
      setCodeResentNotice(true);
      setEnteredCode('');

      // Send to console for development tracking
      console.info(`%c[SMS/WhatsApp Celular Reenvio] Novo código enviado para ${newPhone}: ${generated}`, 'color: #10b981; font-weight: bold;');
    }, 500);
  };

  // Handle Code Verification and Comparison with Sent Code
  const handleVerifyCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);

    const cleanEntered = enteredCode.trim().replace(/\D/g, '');

    if (!cleanEntered) {
      setCodeError('Por favor, digite o código de 6 dígitos recebido no seu celular.');
      return;
    }

    if (cleanEntered.length !== 6) {
      setCodeError('O código deve conter exatamente 6 dígitos.');
      return;
    }

    // Strict comparison between entered code and code sent to mobile
    if (cleanEntered !== verificationCode) {
      setCodeError('Código incorreto. O código digitado não confere com o código enviado para o seu celular. Verifique as mensagens no seu aparelho e tente novamente.');
      return;
    }

    // Verification successful! Register and log in the advertiser
    const newAdvertiser: Advertiser = {
      id: `adv-${Date.now()}`,
      email: newEmail.trim().toLowerCase(),
      name: newName.trim() || newEmail.split('@')[0],
      phone: newPhone.trim() || undefined,
      createdAt: new Date().toISOString(),
      verified: true,
    };

    onRegisterAdvertiser(newAdvertiser);
    onSuccess(newAdvertiser);
  };

  const cleanPhoneDigits = newPhone.replace(/\D/g, '');

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 w-full animate-fadeIn">
      {/* Back / Exit buttons */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-rose-500/20 text-slate-200 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 text-xs font-bold transition-colors cursor-pointer shadow-sm"
          title="Sair desta tela e voltar ao início"
        >
          <X className="w-4 h-4 text-rose-400" />
          <span>Sair</span>
        </button>
        <button
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Voltar para o Início</span>
        </button>
      </div>

      {/* Main Container Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm relative overflow-hidden">
        {/* Subtle accent glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* -------------------------------------------------- */}
        {/* STEP 1: INITIAL QUESTION ("Já tem cadastro?") */}
        {/* -------------------------------------------------- */}
        {mode === 'ask' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-5 shadow-lg shadow-amber-500/10">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <span className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-2 block">
              Área do Anunciante
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
              Você já tem cadastro como anunciante?
            </h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed mb-8">
              Para cadastrar e divulgar um novo evento no <span className="font-semibold text-white">Pra onde eu vou</span>, confirme se você já possui cadastro ou crie sua conta de anunciante em poucos segundos.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
              {/* Option: Sim, já tenho cadastro */}
              <button
                id="btn-opt-ja-tem-cadastro"
                onClick={() => {
                  setMode('login');
                  setLoginEmail('');
                  setLoginError(null);
                  setCheckedNotFoundEmail(null);
                }}
                className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-400/60 transition-all text-center transform hover:-translate-y-0.5 active:translate-y-0 shadow-md"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <UserCheck className="w-6 h-6" />
                </div>
                <span className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                  Sim, já tenho cadastro
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  Entrar com meu e-mail
                </span>
              </button>

              {/* Option: Não, quero me cadastrar */}
              <button
                id="btn-opt-nao-tem-cadastro"
                onClick={() => {
                  setMode('register_request');
                  setRegisterError(null);
                }}
                className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-b from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 border border-amber-500/30 hover:border-amber-400 transition-all text-center transform hover:-translate-y-0.5 active:translate-y-0 shadow-md"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-md">
                  <UserPlus className="w-6 h-6" />
                </div>
                <span className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                  Não, quero me cadastrar
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  Cadastro com código enviado ao celular
                </span>
              </button>
            </div>
          </div>
        )}

        {/* -------------------------------------------------- */}
        {/* STEP 2A: EXISTING ADVERTISER LOGIN (CHECK EMAIL) */}
        {/* -------------------------------------------------- */}
        {mode === 'login' && (
          <div>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
              <button
                onClick={() => {
                  setMode('ask');
                  setLoginError(null);
                  setCheckedNotFoundEmail(null);
                }}
                className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-white">Entrar com meu e-mail</h2>
                <p className="text-xs text-slate-400">
                  Digite seu e-mail para checar se já possui cadastro de anunciante ativo
                </p>
              </div>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Digite seu e-mail cadastrado *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="input-login-email"
                    type="email"
                    required
                    autoFocus
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      if (loginError) setLoginError(null);
                      if (checkedNotFoundEmail) setCheckedNotFoundEmail(null);
                    }}
                    placeholder="exemplo@seuemail.com.br"
                    className="w-full pl-10 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  O sistema verificará se o e-mail informado já está registrado como anunciante.
                </p>
              </div>

              {loginError && (
                <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs sm:text-sm space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-rose-300">E-mail não encontrado</p>
                      <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                        {loginError}
                      </p>
                    </div>
                  </div>

                  {checkedNotFoundEmail && (
                    <div className="pt-2 border-t border-rose-500/20 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNewEmail(checkedNotFoundEmail);
                          setMode('register_request');
                          setLoginError(null);
                          setCheckedNotFoundEmail(null);
                        }}
                        className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Cadastrar este e-mail agora</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLoginEmail('');
                          setLoginError(null);
                          setCheckedNotFoundEmail(null);
                        }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-medium transition-colors"
                      >
                        Digitar outro e-mail
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  id="btn-submit-login-advertiser"
                  type="submit"
                  disabled={isCheckingEmail || !loginEmail.trim()}
                  className="flex-1 py-3.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCheckingEmail ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Checando e-mail no cadastro...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 text-slate-950" />
                      <span>Checar e-mail e Entrar</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('register_request');
                    setRegisterError(null);
                    setLoginError(null);
                    setCheckedNotFoundEmail(null);
                  }}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold transition-colors flex items-center justify-center"
                >
                  Não tenho cadastro
                </button>
              </div>
            </form>
          </div>
        )}

        {/* -------------------------------------------------- */}
        {/* STEP 2B: NEW ADVERTISER REGISTRATION (Email & Phone) */}
        {/* -------------------------------------------------- */}
        {mode === 'register_request' && (
          <div>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
              <button
                onClick={() => setMode('ask')}
                className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-white">Cadastrar Novo Anunciante</h2>
                <p className="text-xs text-slate-400">
                  Informe seus dados para receber o código de confirmação no seu celular
                </p>
              </div>
            </div>

            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Seu E-mail *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="input-register-email"
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => {
                      setNewEmail(e.target.value);
                      setRegisterError(null);
                    }}
                    placeholder="seuemail@exemplo.com.br"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Celular / WhatsApp (com DDD) *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    id="input-register-phone"
                    type="tel"
                    required
                    value={newPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="(11) 98765-4321"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enviaremos uma mensagem com o código de 6 dígitos diretamente para este número de celular.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Nome do Anunciante ou Produtora <span className="text-slate-500 normal-case">(opcional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    id="input-register-name"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="ex: Samba & Arte Entretenimento"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                  />
                </div>
              </div>

              {registerError && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{registerError}</span>
                </div>
              )}

              <div className="pt-3">
                <button
                  id="btn-send-verification-code"
                  type="submit"
                  disabled={isSendingCode}
                  className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isSendingCode ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Enviando código para o celular...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-slate-950" />
                      <span>Enviar Código para o Celular</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setLoginEmail('');
                    setLoginError(null);
                    setCheckedNotFoundEmail(null);
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 font-medium underline"
                >
                  Já tenho cadastro? Entrar com meu e-mail
                </button>
              </div>
            </form>
          </div>
        )}

        {/* -------------------------------------------------- */}
        {/* STEP 2C: VERIFY CODE RECEIVED ON THE USER'S PHONE */}
        {/* -------------------------------------------------- */}
        {mode === 'register_verify' && (
          <div>
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-800">
              <button
                onClick={() => setMode('register_request')}
                className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Alterar número de celular ou e-mail"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-white">Confirmar Código</h2>
                <p className="text-xs text-slate-400">
                  Digite o código que você recebeu no seu aparelho celular
                </p>
              </div>
            </div>

            {/* Notification that the message was sent to the user's phone */}
            <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-slate-950/90 border border-emerald-500/40 shadow-lg relative overflow-hidden">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                      Mensagem com código enviada para o seu celular
                    </span>
                    <span className="text-[11px] text-slate-400">Agora</span>
                  </div>
                  <p className="text-sm font-semibold text-white mt-1.5">
                    Número: <span className="text-amber-400 font-mono text-base">{newPhone}</span>
                  </p>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    A mensagem contendo o código de confirmação de 6 dígitos foi enviada para o seu aparelho celular. Consulte as mensagens do seu celular e informe o código no campo abaixo para validar o cadastro.
                  </p>

                  {/* Direct WhatsApp trigger button if the user wants to view it on their WhatsApp */}
                  {cleanPhoneDigits.length >= 10 && (
                    <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2">
                      <a
                        href={`https://api.whatsapp.com/send?phone=55${cleanPhoneDigits}&text=${encodeURIComponent(`Seu código de confirmação de anunciante no Pra Onde Eu Vou é: ${verificationCode}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white transition-colors"
                        title="Receber / Abrir no WhatsApp do seu celular"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Abrir mensagem no WhatsApp do meu celular</span>
                        <ExternalLink className="w-3 h-3 opacity-80" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {codeResentNotice && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Um novo código foi enviado para o celular {newPhone}!</span>
              </div>
            )}

            {/* Code Entry Form */}
            <form onSubmit={handleVerifyCodeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Digite o Código de 6 Dígitos Recebido no Celular *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    id="input-verification-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                    required
                    value={enteredCode}
                    onChange={(e) => {
                      setEnteredCode(e.target.value.replace(/\D/g, ''));
                      setCodeError(null);
                    }}
                    placeholder="000000"
                    className="w-full pl-10 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl text-center font-mono text-2xl tracking-[0.35em] text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 text-center">
                  O código informado será comparado rigorosamente com o código enviado para o seu aparelho.
                </p>
              </div>

              {codeError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{codeError}</span>
                </div>
              )}

              <button
                id="btn-confirm-code-and-continue"
                type="submit"
                className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-slate-950" />
                <span>Confirmar Código e Cadastrar Evento</span>
              </button>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 px-1">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isSendingCode}
                  className="hover:text-amber-400 transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSendingCode ? 'animate-spin text-amber-400' : ''}`} />
                  <span>Reenviar código para meu celular</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('register_request')}
                  className="hover:text-white transition-colors"
                >
                  Alterar celular ou e-mail
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
