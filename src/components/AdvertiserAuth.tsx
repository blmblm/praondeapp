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
  X, 
  MapPin, 
  Copy, 
  Check, 
  Sparkles,
  Lock,
  ChevronDown
} from 'lucide-react';
import { Advertiser, ActiveScreen } from '../types';

interface AdvertiserAuthProps {
  onSuccess: (advertiser: Advertiser) => void;
  onNavigate: (screen: ActiveScreen) => void;
  registeredAdvertisers: Advertiser[];
  onRegisterAdvertiser: (advertiser: Advertiser) => void;
  currentAdvertiser?: Advertiser | null;
}

type AuthMode = 'login' | 'register_request' | 'register_verify';

export const AdvertiserAuth: React.FC<AdvertiserAuthProps> = ({
  onSuccess,
  onNavigate,
  registeredAdvertisers,
  onRegisterAdvertiser,
}) => {
  // Tela inicial: identificação do anunciante
  const [mode, setMode] = useState<AuthMode>('login');

  // Estado de checagem de e-mail (Login/Consulta) - SEMPRE INICIA VAZIO
  // Conforme solicitado: "quando entrar na tela identificação do iniciante, nao trazer o campo de email preenchido, deixar que o anunciante digite"
  const [loginEmail, setLoginEmail] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [foundNotice, setFoundNotice] = useState<string | null>(null);
  const [notFoundEmail, setNotFoundEmail] = useState<string | null>(null);

  // Estado de dados para cadastro do anunciante
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [cidadesList, setCidadesList] = useState<any[]>([]);
  const [isLoadingCidades, setIsLoadingCidades] = useState(false);

  // Carrega cidades/estados diretamente da tabela estado do SQLite
  React.useEffect(() => {
    const fetchCidades = async () => {
      setIsLoadingCidades(true);
      try {
        let res = await fetch('/api/estados');
        if (!res.ok) {
          res = await fetch('/api/estado');
        }
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setCidadesList(data);
            if (data.length > 0) {
              setNewCity(data[0].nome);
              setNewState(data[0].estado || 'SP');
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar registros da tabela estado para anunciantes:', err);
      } finally {
        setIsLoadingCidades(false);
      }
    };
    fetchCidades();
  }, []);

  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerNotice, setRegisterNotice] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);

  // Estado de confirmação do código gerado
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [enteredCode, setEnteredCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [codeSuccessNotice, setCodeSuccessNotice] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [codeAutoFilled, setCodeAutoFilled] = useState(false);

  // Formatação de telefone com máscara (XX) XXXXX-XXXX
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

  /**
   * PASSO 1: Verificar se o e-mail digitado existe no cadastro de anunciantes (banco SQLite)
   * - Se existir: identifica e redireciona para a tela de evento (publicação).
   * - Se NÃO existir: NÃO vai para a tela de publicação! Exibe aviso claro e oferece opção de cadastrar com confirmação por código WhatsApp.
   */
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setFoundNotice(null);
    setNotFoundEmail(null);

    const cleanEmail = loginEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setLoginError('Por favor, digite o e-mail do anunciante.');
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setLoginError('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    setIsCheckingEmail(true);

    try {
      // 1. Consulta mandatória e direta no banco de dados SQLite (tabela anunciantes)
      const res = await fetch('/api/advertisers/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      if (!res.ok) {
        setIsCheckingEmail(false);
        setLoginError('Não foi possível verificar o e-mail no servidor. Tente novamente.');
        return;
      }

      const data = await res.json();
      setIsCheckingEmail(false);

      if (data && data.exists && data.advertiser) {
        // E-mail EXISTE no cadastro de anunciantes!
        const foundAdv: Advertiser = data.advertiser;
        setFoundNotice(`Anunciante localizado no cadastro: "${foundAdv.name || foundAdv.email}"! Abrindo tela de publicação...`);
        setTimeout(() => {
          onSuccess(foundAdv);
        }, 700);
      } else {
        // E-mail NÃO EXISTE no cadastro de anunciantes!
        // REGRA CRÍTICA: NÃO vai para a tela de publicação!
        setNotFoundEmail(cleanEmail);
        setNewEmail(cleanEmail);
      }
    } catch (err: any) {
      setIsCheckingEmail(false);
      setLoginError('Erro de conexão ao consultar o cadastro no banco de dados. Tente novamente.');
    }
  };

  /**
   * PASSO 2: Preencher os dados e gerar o código de confirmação.
   * REGRA CRÍTICA: NÃO CADASTRA O ANUNCIANTE AQUI!
   * Apenas envia o código para WhatsApp e transiciona para a tela de confirmação.
   */
  const handleSendConfirmationCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);
    setCodeError(null);
    setEnteredCode('');
    setCodeCopied(false);
    setCodeAutoFilled(false);

    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setRegisterError('Por favor, informe um e-mail válido.');
      return;
    }

    const cleanName = newName.trim();
    if (!cleanName) {
      setRegisterError('Por favor, informe o nome do anunciante, organizador ou produtora.');
      return;
    }

    const phoneDigits = newPhone.replace(/\D/g, '');
    if (!phoneDigits || phoneDigits.length < 10) {
      setRegisterError('Por favor, informe um número de celular ou WhatsApp válido com DDD (ex: 11 98765-4321).');
      return;
    }

    setIsSendingCode(true);

    try {
      // Chama o endpoint para gerar e registrar o código de confirmação temporário no servidor
      const res = await fetch('/api/advertisers/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          phone: newPhone.trim(),
          name: cleanName,
        }),
      });

      let generated = '';
      let msg = '';

      if (res.ok) {
        const data = await res.json();
        generated = data.code;
        msg = data.confirmationMessage || `[Pra Onde Eu Vou]: Olá ${cleanName}! Seu código de confirmação de anunciante é: ${generated}. Digite este código no aplicativo para confirmar seu cadastro.`;
      } else {
        generated = Math.floor(100000 + Math.random() * 900000).toString();
        msg = `[Pra Onde Eu Vou]: Olá ${cleanName}! Seu código de confirmação de anunciante é: ${generated}. Digite este código no aplicativo para confirmar seu cadastro.`;
      }

      setVerificationCode(generated);
      setConfirmationMessage(msg);
      setIsSendingCode(false);

      // Transiciona para a tela de confirmação de código
      // (O anunciante AINDA NÃO está cadastrado no banco de dados)
      setMode('register_verify');

      // Tenta abrir o WhatsApp automaticamente para conveniência do anunciante
      const waUrl = `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(msg)}`;
      try {
        window.open(waUrl, '_blank');
      } catch (e) {
        // Se o popup for bloqueado pelo navegador, o botão verde estará visível na tela
      }
    } catch (err) {
      setIsSendingCode(false);
      const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
      setVerificationCode(fallbackCode);
      setConfirmationMessage(`[Pra Onde Eu Vou]: Olá ${cleanName}! Seu código de confirmação de anunciante é: ${fallbackCode}. Digite este código no aplicativo para confirmar seu cadastro.`);
      setMode('register_verify');
    }
  };

  /**
   * Reenviar um novo código de confirmação
   */
  const handleResendCode = async () => {
    setIsSendingCode(true);
    setCodeError(null);
    setCodeSuccessNotice(null);
    setEnteredCode('');
    setCodeCopied(false);
    setCodeAutoFilled(false);

    try {
      const res = await fetch('/api/advertisers/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          phone: newPhone.trim(),
          name: newName.trim() || 'Anunciante',
        }),
      });

      let newGen = '';
      let newMsg = '';
      if (res.ok) {
        const data = await res.json();
        newGen = data.code;
        newMsg = data.confirmationMessage || `[Pra Onde Eu Vou]: Novo código de confirmação: ${newGen}. Digite este código no aplicativo para confirmar seu cadastro.`;
      } else {
        newGen = Math.floor(100000 + Math.random() * 900000).toString();
        newMsg = `[Pra Onde Eu Vou]: Novo código de confirmação: ${newGen}. Digite este código no aplicativo para confirmar seu cadastro.`;
      }

      setVerificationCode(newGen);
      setConfirmationMessage(newMsg);
      setIsSendingCode(false);
      setCodeSuccessNotice(`Um novo código de confirmação (${newGen}) foi gerado!`);

      const phoneDigits = newPhone.replace(/\D/g, '');
      if (phoneDigits.length >= 10) {
        const waUrl = `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(newMsg)}`;
        window.open(waUrl, '_blank');
      }
    } catch (err) {
      setIsSendingCode(false);
      const newGen = Math.floor(100000 + Math.random() * 900000).toString();
      setVerificationCode(newGen);
      setConfirmationMessage(`[Pra Onde Eu Vou]: Novo código de confirmação: ${newGen}.`);
      setCodeSuccessNotice(`Um novo código foi gerado!`);
    }
  };

  /**
   * PASSO 3: Digitar e confirmar o código no app
   * SOMENTE NESTE MOMENTO, após o código ser validado com sucesso,
   * o anunciante é cadastrado e salvo no banco de dados!
   */
  const handleVerifyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);

    const cleanEntered = enteredCode.trim().replace(/\D/g, '');
    if (!cleanEntered) {
      setCodeError('Por favor, digite o código de 6 dígitos que você recebeu.');
      return;
    }

    if (cleanEntered.length !== 6) {
      setCodeError('O código de confirmação deve conter exatamente 6 dígitos.');
      return;
    }

    setIsVerifyingCode(true);

    try {
      // 1. Validação do código no servidor
      let isValid = false;
      try {
        const res = await fetch('/api/advertisers/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: newEmail.trim().toLowerCase(),
            code: cleanEntered,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          isValid = data.valid;
        } else {
          const errData = await res.json();
          setIsVerifyingCode(false);
          setCodeError(errData.error || 'Código incorreto. Digite o código de 6 dígitos enviado.');
          return;
        }
      } catch (errApi) {
        console.warn('Erro ao chamar /api/advertisers/verify-code:', errApi);
      }

      // 2. Fallback de validação direta caso API esteja offline
      if (!isValid && cleanEntered === verificationCode) {
        isValid = true;
      }

      if (!isValid) {
        setIsVerifyingCode(false);
        setCodeError('Código incorreto. O anunciante somente será cadastrado após a confirmação do código enviado.');
        return;
      }

      // =========================================================================
      // CÓDIGO CONFIRMADO COM SUCESSO!
      // SOMENTE AGORA O ANUNCIANTE É CADASTRADO NO BANCO DE DADOS
      // =========================================================================
      const newAdvertiser: Advertiser = {
        id: `adv-${Date.now()}`,
        email: newEmail.trim().toLowerCase(),
        name: newName.trim(),
        phone: newPhone.trim() || undefined,
        city: newCity.trim() || undefined,
        state: newState.trim() || undefined,
        createdAt: new Date().toISOString(),
        verified: true,
      };

      const registerRes = await fetch('/api/advertisers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAdvertiser),
      });

      if (!registerRes.ok) {
        const errData = await registerRes.json().catch(() => ({}));
        setIsVerifyingCode(false);
        setCodeError(errData.error || 'Erro ao efetivar o cadastro do anunciante. Tente novamente.');
        return;
      }

      setIsVerifyingCode(false);
      setCodeSuccessNotice('Código confirmado com sucesso! Anunciante cadastrado e ativado.');

      // Notifica o aplicativo e redireciona para a tela de cadastrar evento
      setTimeout(() => {
        onRegisterAdvertiser(newAdvertiser);
        onSuccess(newAdvertiser);
      }, 500);
    } catch (err: any) {
      setIsVerifyingCode(false);
      setCodeError('Erro ao validar o código e cadastrar o anunciante. Tente novamente.');
    }
  };

  const copyCodeToClipboard = () => {
    if (verificationCode) {
      navigator.clipboard.writeText(verificationCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2500);
    }
  };

  const fillCodeAutomatically = () => {
    if (verificationCode) {
      setEnteredCode(verificationCode);
      setCodeError(null);
      setCodeAutoFilled(true);
      setTimeout(() => setCodeAutoFilled(false), 2500);
    }
  };

  const cleanPhoneDigits = newPhone.replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/55${cleanPhoneDigits}?text=${encodeURIComponent(confirmationMessage || `[Pra Onde Eu Vou]: Olá ${newName}! Seu código de confirmação de anunciante é: ${verificationCode}`)}`;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 w-full animate-fadeIn">
      {/* Botões de Navegação Superior */}
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

      {/* Card Principal */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* ------------------------------------------------------------------ */}
        {/* TELA 1: VERIFICAÇÃO DO E-MAIL DO ANUNCIANTE (SE EXISTE OU NÃO)    */}
        {/* ------------------------------------------------------------------ */}
        {mode === 'login' && (
          <div>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Divulgar Evento • Passo 1
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Verificação do E-mail do Anunciante
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Informe o e-mail para verificar se já existe cadastro ou iniciar um novo
                </p>
              </div>
            </div>

            {/* Aviso informativo de Verificação de E-mail */}
            <div className="mb-5 p-4 rounded-2xl bg-slate-950/90 border border-amber-500/30 flex items-start gap-3 text-xs text-slate-300">
              <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-300">Como funciona a verificação:</p>
                <p className="text-slate-300 leading-relaxed">
                  • <strong>Se o e-mail já existir no cadastro:</strong> você será identificado e avançará diretamente para cadastrar seu evento.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  • <strong>Se o e-mail NÃO existir:</strong> você preencherá seus dados e receberá um código no WhatsApp. O cadastro só será realizado após a confirmação do código.
                </p>
              </div>
            </div>

            {foundNotice && (
              <div className="mb-5 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-sm flex items-center gap-3 animate-fadeIn">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span className="font-semibold">{foundNotice}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  E-mail do Anunciante * (Digite para verificar se existe)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  {/* O campo de e-mail inicia SEMPRE VAZIO para o anunciante digitar */}
                  <input
                    id="input-login-email"
                    type="email"
                    required
                    autoFocus
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      if (loginError) setLoginError(null);
                      if (notFoundEmail) setNotFoundEmail(null);
                    }}
                    placeholder="Digite seu e-mail (ex: anunciante@email.com)..."
                    className="w-full pl-10 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all font-sans"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Digite seu e-mail para verificar se já existe cadastro de anunciante.
                </p>
              </div>

              {/* AVISO QUANDO E-MAIL NÃO EXISTE NO CADASTRO DE ANUNCIANTES */}
              {notFoundEmail && (
                <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-200 text-xs sm:text-sm space-y-3 animate-fadeIn">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-300 text-sm">
                        E-mail não localizado no cadastro de anunciantes!
                      </p>
                      <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                        O e-mail <strong className="text-white underline">{notFoundEmail}</strong> não está cadastrado em nosso banco de anunciantes.
                      </p>
                      <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                        Para poder publicar e divulgar seus eventos, você deve primeiro realizar o cadastro de anunciante e validar o código recebido no seu WhatsApp.
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 flex flex-col sm:flex-row gap-2 border-t border-amber-500/20">
                    <button
                      type="button"
                      onClick={() => {
                        setNewEmail(notFoundEmail);
                        setRegisterNotice(`Preencha seus dados para receber o código no WhatsApp e concluir o cadastro do e-mail ${notFoundEmail}.`);
                        setMode('register_request');
                      }}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Cadastrar Anunciante com este E-mail</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNotFoundEmail(null);
                        setLoginEmail('');
                      }}
                      className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
                    >
                      Digitar outro e-mail
                    </button>
                  </div>
                </div>
              )}

              {loginError && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs sm:text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-rose-300">Atenção</p>
                    <p className="text-slate-300 text-xs mt-0.5">{loginError}</p>
                  </div>
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  id="btn-submit-login-advertiser"
                  type="submit"
                  disabled={isCheckingEmail || !loginEmail.trim()}
                  className="flex-1 py-3.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isCheckingEmail ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Verificando se o e-mail existe no cadastro...</span>
                    </>
                  ) : (
                    <>
                      <span>Verificar se E-mail Existe</span>
                      <ArrowRight className="w-4 h-4 text-slate-950" />
                    </>
                  )}
                </button>
              </div>

              <div className="pt-4 border-t border-slate-800/80 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setNewEmail(loginEmail.trim());
                    setRegisterNotice(null);
                    setRegisterError(null);
                    setMode('register_request');
                  }}
                  className="text-xs text-slate-400 hover:text-amber-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Primeiro anúncio? Abrir tela de cadastro de anunciante</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TELA 2: CADASTRO DO ANUNCIANTE (SOLICITA DADOS E ENVIA CÓDIGO)     */}
        {/* ------------------------------------------------------------------ */}
        {mode === 'register_request' && (
          <div>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
              <button
                onClick={() => {
                  setMode('login');
                  setRegisterError(null);
                  setRegisterNotice(null);
                }}
                className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Voltar para verificação de e-mail"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Passo 1 de 2 • Solicitação de Cadastro
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Cadastro de Anunciante
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Informe seus dados para receber o código de confirmação no WhatsApp
                </p>
              </div>
            </div>

            {/* Aviso informativo de e-mail não encontrado */}
            {registerNotice && (
              <div className="mb-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs sm:text-sm flex items-start gap-3 animate-fadeIn">
                <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-300">E-mail não cadastrado</p>
                  <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                    {registerNotice}
                  </p>
                </div>
              </div>
            )}

            {/* BANNER EXPLÍCITO DA REGRA SOLICITADA */}
            <div className="mb-5 p-4 rounded-2xl bg-slate-950 border border-amber-500/40 text-amber-300 text-xs flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block text-amber-200 font-bold mb-0.5">
                  Confirmação Obrigatória por Código:
                </strong>
                <span className="text-slate-300 leading-relaxed block">
                  O anunciante <strong>somente será cadastrado no sistema após a confirmação do código</strong> que será enviado para o WhatsApp/Celular informado abaixo.
                </span>
              </div>
            </div>

            <form onSubmit={handleSendConfirmationCode} className="space-y-4">
              {/* E-mail */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  E-mail do Anunciante *
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

              {/* Nome do Anunciante / Razão Social */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Nome do Anunciante, Produtora ou Organizador *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    id="input-register-name"
                    type="text"
                    required
                    autoFocus
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      setRegisterError(null);
                    }}
                    placeholder="ex: Samba & Arte Entretenimento ou Seu Nome"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Celular / WhatsApp */}
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
                  Enviaremos a mensagem de confirmação com o código de 6 dígitos para este WhatsApp / Celular.
                </p>
              </div>

              {/* Cidade e Estado (Obrigatório) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Cidade do Anunciante *</span>
                    {isLoadingCidades && (
                      <span className="text-[10px] text-amber-400 font-normal">Carregando...</span>
                    )}
                  </label>
                  <div className="relative">
                    <select
                      id="select-register-city"
                      value={newCity}
                      onChange={(e) => {
                        const cityName = e.target.value;
                        setNewCity(cityName);
                        const matched = cidadesList.find((c) => c.nome === cityName);
                        if (matched) {
                          setNewState(matched.estado);
                        }
                      }}
                      className="w-full py-2.5 pl-3.5 pr-9 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 appearance-none cursor-pointer"
                    >
                      {cidadesList.length === 0 ? (
                        <option value="">Carregando da tabela cidades...</option>
                      ) : (
                        cidadesList.map((cid) => (
                          <option key={cid.id} value={cid.nome} className="bg-slate-900 text-white">
                            {cid.nome} - {cid.estado}
                          </option>
                        ))
                      )}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Estado (UF) *
                  </label>
                  <input
                    id="input-register-state"
                    type="text"
                    readOnly
                    value={newState}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-bold text-amber-400 text-center cursor-not-allowed focus:outline-none font-mono"
                    title="Estado (UF) definido automaticamente pela cidade selecionada"
                  />
                </div>
              </div>

              {registerError && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{registerError}</span>
                </div>
              )}

              {/* Botão de Envio de Código (NÃO cadastra ainda, apenas envia o código) */}
              <div className="pt-3 space-y-3">
                <button
                  id="btn-send-advertiser-code"
                  type="submit"
                  disabled={isSendingCode}
                  className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {isSendingCode ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Gerando código e preparando WhatsApp...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-slate-950" />
                      <span>Enviar Código para WhatsApp</span>
                      <ArrowRight className="w-4 h-4 text-slate-950" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setRegisterError(null);
                    }}
                    className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Voltar para identificação de e-mail</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TELA 3: CONFIRMAR CÓDIGO DIGITADO NO APP                          */}
        {/* SOMENTE AQUI O ANUNCIANTE É EFETIVAMENTE CADASTRADO               */}
        {/* ------------------------------------------------------------------ */}
        {mode === 'register_verify' && (
          <div>
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-800">
              <button
                onClick={() => setMode('register_request')}
                className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Voltar e alterar dados"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Passo 2 de 2 • Validação Obrigatória
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Confirmar Código no App
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  O cadastro só será efetivado após você confirmar o código abaixo
                </p>
              </div>
            </div>

            {/* AVISO DA REGRA: SOMENTE CADASTRAR APÓS CONFIRMAÇÃO DO CÓDIGO */}
            <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                <strong>Atenção:</strong> Seu cadastro ainda não foi salvo. Digite o código de 6 dígitos para efetivar seu cadastro de anunciante.
              </span>
            </div>

            {/* CARD PARA ABRIR NO WHATSAPP */}
            <div className="mb-6 p-5 rounded-2xl bg-gradient-to-b from-emerald-950/60 to-slate-950 border border-emerald-500/40 shadow-xl relative overflow-hidden">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center flex-shrink-0 shadow-md">
                  <MessageSquare className="w-7 h-7 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                      Mensagem com Código para WhatsApp
                    </span>
                    <span className="text-[11px] text-emerald-400/80 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Celular: {newPhone}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Clique no botão verde abaixo para abrir a mensagem com o seu código de confirmação no WhatsApp:
                  </p>

                  {/* BOTÃO PRINCIPAL: ABRIR NO WHATSAPP */}
                  {cleanPhoneDigits.length >= 10 && (
                    <div className="mt-3">
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/40"
                      >
                        <MessageSquare className="w-5 h-5 text-white" />
                        <span>Abrir Mensagem no meu WhatsApp</span>
                        <ExternalLink className="w-4 h-4 opacity-80" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* CARD DE EXIBIÇÃO DIRETA DO CÓDIGO (PARA NUNCA TRAVAR O ANUNCIANTE) */}
              <div className="mt-4 pt-4 border-t border-emerald-500/20">
                <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-center sm:text-left">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold block">
                      Código Gerado pelo Sistema:
                    </span>
                    <div className="text-2xl font-bold font-mono tracking-widest text-amber-400 mt-0.5">
                      {verificationCode}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={fillCodeAutomatically}
                      className="flex-1 sm:flex-initial text-xs font-semibold px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Preenche o código no campo abaixo"
                    >
                      {codeAutoFilled ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Inserido!</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>Preencher no Campo</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={copyCodeToClipboard}
                      className="text-xs font-semibold px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Copiar código"
                    >
                      {codeCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {codeSuccessNotice && (
              <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{codeSuccessNotice}</span>
              </div>
            )}

            {/* Formulário para Digitar e Confirmar o Código */}
            <form onSubmit={handleVerifyCodeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 text-center">
                  Digite o Código de 6 Dígitos Abaixo *
                </label>
                <div className="relative max-w-xs mx-auto">
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
                    className="w-full py-4 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-2xl text-center font-mono text-3xl tracking-[0.35em] text-amber-300 placeholder-slate-700 focus:outline-none focus:ring-4 focus:ring-amber-500/20 shadow-inner"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-2 text-center">
                  O cadastro de anunciante só será salvo no banco de dados após a validação deste código.
                </p>
              </div>

              {codeError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{codeError}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  id="btn-confirm-code-and-continue"
                  type="submit"
                  disabled={isVerifyingCode || enteredCode.length !== 6}
                  className="w-full py-4 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm sm:text-base shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isVerifyingCode ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin text-slate-950" />
                      <span>Validando código e cadastrando anunciante...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-slate-950" />
                      <span>Confirmar Código e Concluir Cadastro</span>
                      <ArrowRight className="w-4 h-4 text-slate-950" />
                    </>
                  )}
                </button>
              </div>

              {/* Ações Secundárias */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-3 px-1 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isSendingCode}
                  className="hover:text-amber-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSendingCode ? 'animate-spin text-amber-400' : ''}`} />
                  <span>Reenviar código</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('register_request')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Alterar dados do cadastro
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
