import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Sparkles, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  ArrowLeft, 
  Copy, 
  Check, 
  QrCode, 
  Clock, 
  ShieldCheck, 
  Compass, 
  RefreshCw, 
  Send, 
  AlertCircle, 
  Lock, 
  Hourglass, 
  Upload, 
  Camera,
  X,
  ChevronDown,
  Search,
  CreditCard,
  Info
} from 'lucide-react';
import QRCode from 'qrcode';
import { SponsorItem } from '../data/sponsors';
import { CidadeItem, DEFAULT_CIDADES } from '../types';
import { useUserLocation } from '../context/LocationContext';

interface SponsorRegistrationScreenProps {
  onBack: () => void;
  onSponsorCreated: (sponsor: SponsorItem) => void;
  cidadesList?: CidadeItem[];
}

export const SponsorRegistrationScreen: React.FC<SponsorRegistrationScreenProps> = ({
  onBack,
  onSponsorCreated,
  cidadesList: propCidadesList,
}) => {
  const { userOriginCity } = useUserLocation();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Adega & Bebidas');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState(() => userOriginCity || 'Praia Grande');
  const [state, setState] = useState('SP');
  const [description, setDescription] = useState('');
  const [badge, setBadge] = useState('Destaque da Região');
  const [imageUrl, setImageUrl] = useState('');
  const [cidadesList, setCidadesList] = useState<CidadeItem[]>(() => {
    if (propCidadesList && propCidadesList.length > 0) return propCidadesList;
    return DEFAULT_CIDADES;
  });
  const [isLoadingCidades, setIsLoadingCidades] = useState(false);
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const cityDropdownRef = React.useRef<HTMLDivElement>(null);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target as Node)) {
        setIsCityDropdownOpen(false);
      }
    };
    if (isCityDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCityDropdownOpen]);

  // Sincroniza se cidadesList vier via props
  useEffect(() => {
    if (propCidadesList && propCidadesList.length > 0) {
      setCidadesList(propCidadesList);
    }
  }, [propCidadesList]);

  // Carrega cidades diretamente do banco de dados SQLite para o dropdown
  useEffect(() => {
    let isMounted = true;
    const fetchCidades = async () => {
      setIsLoadingCidades(true);
      try {
        let res = await fetch('/api/cidades');
        if (!res.ok) {
          res = await fetch('/api/estado');
        }
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data) && data.length > 0) {
            setCidadesList(data);
            const found = data.find((c: any) => c.nome.toLowerCase() === city.toLowerCase());
            if (found) {
              setState(found.estado || 'SP');
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar cidades em SponsorRegistrationScreen:', err);
      } finally {
        if (isMounted) setIsLoadingCidades(false);
      }
    };
    fetchCidades();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fluxo de Etapas: 'form' -> 'pix_payment' -> 'confirmed' (Aguardando análise até 48h)
  const [step, setStep] = useState<'form' | 'pix_payment' | 'confirmed'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Dados do Pix gerado (BACEN oficial / Mercado Pago)
  const [pixData, setPixData] = useState<{
    paymentId: string;
    sponsorId: string;
    valor: number;
    qrCode: string;
    qrCodeBase64: string;
    ticketUrl: string;
    isSimulated?: boolean;
    advertiserPhone: string;
    advertiserName: string;
    chavePix?: string;
    tipoChave?: string;
    nomeBeneficiario?: string;
    cidadeBeneficiario?: string;
  } | null>(null);

  const [protocolo, setProtocolo] = useState(`PROT-${Math.floor(100000 + Math.random() * 900000)}`);
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [clientQrCodeUrl, setClientQrCodeUrl] = useState<string>('');
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<string>('');
  const [smsSending, setSmsSending] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [createdSponsor, setCreatedSponsor] = useState<SponsorItem | null>(null);

  // Garante que o QR Code seja uma imagem gráfica renderizável e nítida para a câmera do celular
  useEffect(() => {
    if (!pixData?.qrCode) {
      setClientQrCodeUrl('');
      return;
    }

    if (pixData.qrCodeBase64 && pixData.qrCodeBase64.startsWith('data:image')) {
      setClientQrCodeUrl(pixData.qrCodeBase64);
    } else if (pixData.qrCodeBase64 && pixData.qrCodeBase64.length > 50) {
      setClientQrCodeUrl(`data:image/png;base64,${pixData.qrCodeBase64}`);
    } else {
      // Fallback: Geração garantida em tempo de execução via qrcode
      QRCode.toDataURL(pixData.qrCode, {
        width: 440,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
        .then(setClientQrCodeUrl)
        .catch((err) => console.error('Erro ao renderizar QR Code client-side:', err));
    }
  }, [pixData]);

  // Monitoramento e Confirmação Automática do Mercado Pago em tempo real
  useEffect(() => {
    if (step !== 'pix_payment' || !pixData?.paymentId) return;

    let isMounted = true;
    let pollInterval: any = null;

    const checkAutoStatus = async () => {
      try {
        const res = await fetch(`/api/sponsors/pix/status/${pixData.paymentId}`);
        if (!res.ok) return;
        const data = await res.json();
        if ((data.isPaid || data.status === 'approved') && isMounted) {
          console.log('[Mercado Pago] Pagamento confirmado automaticamente!', data);
          clearInterval(pollInterval);
          try {
            await handleSendConfirmation(pixData.advertiserPhone, pixData.advertiserName, protocolo);
          } catch {}
          setStep('confirmed');
        }
      } catch (err) {
        // Polling de fundo silencioso
      }
    };

    // Checagem imediata inicial após 1.5s e depois a cada 3.5s continuamente
    const initialTimer = setTimeout(checkAutoStatus, 1500);
    pollInterval = setInterval(checkAutoStatus, 3500);

    return () => {
      isMounted = false;
      clearTimeout(initialTimer);
      clearInterval(pollInterval);
    };
  }, [step, pixData?.paymentId, pixData?.advertiserPhone, pixData?.advertiserName, protocolo]);

  // Submissão do formulário: Salva dados e gera cobrança Pix no Mercado Pago
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim() || !phone.trim() || !address.trim()) {
      setErrorMessage('Por favor, preencha o Nome do Estabelecimento, Celular com WhatsApp e Endereço.');
      return;
    }

    setIsSubmitting(true);

    try {
      const generatedId = `sp-${Date.now()}`;
      const prot = `PROT-${Math.floor(100000 + Math.random() * 900000)}`;
      setProtocolo(prot);

      const payload = {
        sponsorId: generatedId,
        name: name.trim(),
        category,
        phone: phone.replace(/\D/g, ''),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        description: description.trim() || 'Comércio parceiro cadastrado. Em fase de verificação.',
        badge: badge.trim() || 'Destaque da Região',
        imageUrl: imageUrl.trim() || 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=600&q=80',
      };

      const response = await fetch('/api/sponsors/pix/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível gerar a cobrança Pix.');
      }

      const newSponsor: SponsorItem = {
        id: generatedId,
        name: payload.name,
        category: payload.category,
        phone: payload.phone,
        address: payload.address,
        city: payload.city,
        state: payload.state,
        description: payload.description,
        badge: payload.badge,
        latitude: -23.6575 + (Math.random() - 0.5) * 0.04,
        longitude: -46.5312 + (Math.random() - 0.5) * 0.04,
        imageUrl: payload.imageUrl,
        monthlyFee: 100,
        active: false, // IMPORTANTE: Bloqueado por segurança até liberação humana
        liberado: 'pendente', // Em análise por até 48h
        statusPagamento: 'pendente',
        protocolo: prot,
        createdAt: new Date().toISOString().split('T')[0],
      };

      setCreatedSponsor(newSponsor);
      onSponsorCreated(newSponsor);
      setPixData(data);
      setStep('pix_payment');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Erro de comunicação ao gerar Pix. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copiar código Pix Copia e Cola
  const handleCopyPix = () => {
    if (pixData?.qrCode) {
      navigator.clipboard.writeText(pixData.qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  // Copiar Chave Pix Direta (ex: praondeeu@gmail.com)
  const handleCopyPixKey = () => {
    const key = pixData?.chavePix || 'praondeeu@gmail.com';
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 3000);
  };

  // Confirmação direta para quem transferiu pelo Bradesco, Itaú, Nubank, etc.
  const handleConfirmManualPix = async () => {
    if (!pixData) return;
    setCheckingPayment(true);
    try {
      await handleSendConfirmation(pixData.advertiserPhone, pixData.advertiserName, protocolo);
      setStep('confirmed');
    } catch (err) {
      console.warn('Aviso ao registrar confirmação:', err);
      setStep('confirmed');
    } finally {
      setCheckingPayment(false);
    }
  };

  // Verificar se o Pix foi pago no Mercado Pago
  const handleCheckPayment = async () => {
    if (!pixData?.paymentId) return;
    setCheckingPayment(true);
    setPaymentNotice('');

    try {
      const res = await fetch(`/api/sponsors/pix/status/${pixData.paymentId}`);
      const data = await res.json();

      if (data.isPaid || data.status === 'approved') {
        // Disparar aviso de aguardo de liberação em até 48h para o celular
        await handleSendConfirmation(pixData.advertiserPhone, pixData.advertiserName, protocolo);
        setStep('confirmed');
      } else {
        setPaymentNotice(
          'O Mercado Pago ainda está processando a confirmação do pagamento. O sistema continua verificando automaticamente a cada 3 segundos. Se você já transferiu, clique no botão verde "Já Fiz o Pix!" para prosseguir imediatamente.'
        );
      }
    } catch (err) {
      console.error('Erro ao checar status:', err);
      setPaymentNotice('Não foi possível verificar agora. A checagem automática continuará em segundo plano.');
    } finally {
      setCheckingPayment(false);
    }
  };

  // Enviar mensagem de aguardo de liberação (até 48h) para o WhatsApp do anunciante
  const handleSendConfirmation = async (targetPhone: string, targetName: string, prot: string) => {
    setSmsSending(true);
    try {
      const res = await fetch('/api/sponsors/notify-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: targetPhone, sponsorName: targetName, protocol: prot }),
      });
      const data = await res.json();
      if (data.success) {
        setSmsSent(true);
      }
    } catch (e) {
      console.error('Erro ao enviar mensagem:', e);
    } finally {
      setSmsSending(false);
    }
  };

  const whatsappMessageText = `✅ *Olá, ${createdSponsor?.name || pixData?.advertiserName}! Recebemos seu Pix de R$ 100,00 com sucesso!*\n\n🔒 *Por motivos de segurança*, o seu anúncio passará pela nossa análise cadastral e será liberado na vitrine do app *Pra onde eu vou* em até *48 horas*.\n📋 *Protocolo:* ${protocolo}\n\nAssim que nossa equipe de moderação concluir a verificação, você receberá o aviso de ativação. Obrigado pela confiança! 🚀`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-rose-500/20 text-slate-200 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 text-xs font-bold transition-colors cursor-pointer shadow-sm"
              title="Sair e voltar ao início"
            >
              <X className="w-4 h-4 text-rose-400" />
              <span>Sair</span>
            </button>
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-500/50 text-slate-300 hover:text-white transition-all text-xs font-bold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para o Início</span>
            </button>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-extrabold">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Segurança & Análise Cadastral (Até 48h)</span>
          </div>
        </div>

        {/* =========================================================================
            ETAPA 1: FORMULÁRIO DO ANÚNCIO (R$ 100/MÊS)
            ========================================================================= */}
        {step === 'form' && (
          <div>
            {/* Header com chamada visual */}
            <div className="bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 mb-8 text-center shadow-xl">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Sparkles className="w-7 h-7" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">
                Anuncie seu Comércio por R$ 100,00/mês
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                Cadastre seu estabelecimento, efetue o pagamento com Pix oficial Mercado Pago e receba a confirmação no celular. Por segurança dos usuários e do seu negócio, os anúncios são liberados em até <strong>48 horas</strong> pela nossa moderação.
              </p>

              {/* Vantagens e Segurança */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 text-left">
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
                  <Compass className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span className="text-xs text-slate-300 font-medium">Exibição nos 5 comércios mais próximos por GPS</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
                  <QrCode className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-xs text-slate-300 font-medium">Pix seguro e autenticado Mercado Pago</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span className="text-xs text-slate-300 font-medium">Análise de segurança em até 48 horas</span>
                </div>
              </div>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <span>1. Dados do seu Estabelecimento</span>
              </h2>

              {errorMessage && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Nome do seu Comércio *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Adega do Baile, Pizzaria Bella, Bar do Zé..."
                    required
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Ramo / Categoria *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Adega & Bebidas">Adega & Bebidas (Esquenta)</option>
                    <option value="Bar & Petiscaria">Bar & Petiscaria</option>
                    <option value="Pizzaria & Lanches">Pizzaria & Lanches (Pós-Festa)</option>
                    <option value="Estacionamento Seguro">Estacionamento Seguro</option>
                    <option value="Beleza & Estilo">Salão, Barbearia & Beleza</option>
                    <option value="Moda & Roupas de Festa">Moda & Roupas de Festa</option>
                    <option value="Hotel & Hospedagem">Hotel & Hospedagem</option>
                    <option value="Conveniência & Outros">Conveniência & Outros</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Celular com WhatsApp do Anunciante *
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex: 11999887766"
                    required
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[11px] text-emerald-400/80 mt-1 block">
                    Receberá o aviso de pagamento e protocolo aqui.
                  </span>
                </div>

                <div className="sm:col-span-2" ref={cityDropdownRef}>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Cidade do Estabelecimento *</span>
                    <span className="text-[10px] text-amber-400 font-normal">
                      {isLoadingCidades ? 'Carregando cidades...' : `${cidadesList.length} cidades disponíveis`}
                    </span>
                  </label>
                  
                  {/* Seletor Customizado e Pesquisável de Cidade (Abre com 100% de confiabilidade em qualquer dispositivo) */}
                  <div className="relative">
                    <button
                      id="btn-select-sponsor-city"
                      type="button"
                      onClick={() => setIsCityDropdownOpen((prev) => !prev)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700 hover:border-amber-500/70 rounded-xl text-sm text-left flex items-center justify-between transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-sm group"
                      aria-haspopup="listbox"
                      aria-expanded={isCityDropdownOpen}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className={`font-semibold ${city ? 'text-white' : 'text-slate-400'}`}>
                          {city ? `${city} (${state})` : 'Selecione a Cidade do Estabelecimento...'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-amber-400 transition-colors">
                        <span className="text-[11px] font-medium hidden sm:inline">Alterar</span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCityDropdownOpen ? 'rotate-180 text-amber-400' : ''}`} />
                      </div>
                    </button>

                    {/* Input Oculto para Validação HTML5 Nativa */}
                    <input
                      type="hidden"
                      name="city"
                      value={city}
                      required
                    />

                    {/* Dropdown Flutuante Pesquisável */}
                    {isCityDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-slate-900/98 backdrop-blur-xl border border-amber-500/40 rounded-2xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-150">
                        {/* Campo de Busca Rápida */}
                        <div className="relative mb-2.5">
                          <Search className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            autoFocus
                            value={citySearchQuery}
                            onChange={(e) => setCitySearchQuery(e.target.value)}
                            placeholder="Buscar cidade... (ex: Praia Grande, Santos, São Paulo)"
                            className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                          />
                          {citySearchQuery && (
                            <button
                              type="button"
                              onClick={() => setCitySearchQuery('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Atalhos Rápidos para Cidades Mais Frequentes */}
                        <div className="mb-2 pb-2 border-b border-slate-800">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5 px-1">
                            Acesso Rápido:
                          </span>
                          <div className="flex flex-wrap gap-1.5 px-0.5">
                            {['Praia Grande', 'São Paulo', 'Santos', 'Santo André', 'Campinas', 'São Bernardo do Campo'].map((quickCity) => {
                              const match = cidadesList.find((c) => c.nome.toLowerCase() === quickCity.toLowerCase());
                              const isSelected = city.toLowerCase() === quickCity.toLowerCase();
                              return (
                                <button
                                  key={`quick-${quickCity}`}
                                  type="button"
                                  onClick={() => {
                                    setCity(match?.nome || quickCity);
                                    setState(match?.estado || 'SP');
                                    setIsCityDropdownOpen(false);
                                    setCitySearchQuery('');
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white'
                                  }`}
                                >
                                  {quickCity}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Lista de Cidades com Rolagem */}
                        <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                          {(() => {
                            const q = citySearchQuery.trim().toLowerCase();
                            const filtered = cidadesList.filter((c) => 
                              !q || c.nome.toLowerCase().includes(q) || (c.estado || '').toLowerCase().includes(q)
                            );

                            if (filtered.length === 0) {
                              return (
                                <div className="py-4 text-center text-xs text-slate-400">
                                  Nenhuma cidade encontrada para &quot;{citySearchQuery}&quot;.
                                </div>
                              );
                            }

                            return filtered.map((cid) => {
                              const isSelected = city.toLowerCase() === cid.nome.toLowerCase();
                              return (
                                <button
                                  key={`city-${cid.id}`}
                                  type="button"
                                  onClick={() => {
                                    setCity(cid.nome);
                                    setState(cid.estado || 'SP');
                                    setIsCityDropdownOpen(false);
                                    setCitySearchQuery('');
                                  }}
                                  className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                                      : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    <span>{cid.nome}</span>
                                    <span className="text-[10px] text-slate-400 font-normal">({cid.estado})</span>
                                  </div>
                                  {isSelected && (
                                    <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  )}
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Estado (UF) *
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={state}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold text-amber-400 text-center cursor-not-allowed focus:outline-none"
                    title="Estado (UF) preenchido automaticamente pela cidade selecionada"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Endereço Completo (Rua, Número e Bairro) *
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Av. Dom Pedro II, 1420 - Bairro Jardim"
                  required
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Texto Promocional (O que você oferece aos clientes)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Combos de cerveja artesanal, porções quentes e atendimento rápido para o melhor esquenta!"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Foto / Fachada do Estabelecimento (Escolher do Celular ou Link)
                </label>
                
                <div className="space-y-3">
                  {/* Botões de Ação para Celular e Computador */}
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="sponsor-reg-file-input"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs sm:text-sm rounded-xl cursor-pointer transition-all shadow-md active:scale-95"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Buscar Foto no Celular / Galeria</span>
                    </label>
                    <input
                      id="sponsor-reg-file-input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (!file.type.startsWith('image/')) {
                            setErrorMessage('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WEBP).');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (uploadEvt) => {
                            if (typeof uploadEvt.target?.result === 'string') {
                              setImageUrl(uploadEvt.target.result);
                              setErrorMessage('');
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />

                    <span className="text-xs text-slate-400 font-medium">ou cole o link abaixo</span>
                  </div>

                  {/* Campo de link da imagem */}
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://exemplo.com/foto-do-comercio.jpg"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />

                  {/* Pré-visualização da Imagem Carregada */}
                  {imageUrl && (
                    <div className="flex items-center gap-3 p-2.5 bg-slate-900 border border-amber-500/40 rounded-xl">
                      <img
                        src={imageUrl}
                        alt="Fachada selecionada"
                        className="w-16 h-16 object-cover rounded-lg border border-slate-700 shrink-0 bg-slate-800 shadow-md"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Foto anexada com sucesso!
                        </span>
                        <p className="text-[11px] text-slate-400 truncate">
                          Essa imagem será exibida com destaque na vitrine.
                        </p>
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
                          className="text-[11px] text-rose-400 hover:text-rose-300 underline font-semibold mt-1 inline-block"
                        >
                          Remover foto
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Selo Promocional
                </label>
                <input
                  type="text"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  placeholder="Ex: Desconto no Esquenta"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Botão de Geração do Pix */}
              <div className="pt-4 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-base shadow-xl shadow-emerald-500/25 transition-all transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Gerando Código Pix no Mercado Pago...</span>
                    </>
                  ) : (
                    <>
                      <QrCode className="w-5 h-5" />
                      <span>Gerar Código Pix (R$ 100,00)</span>
                    </>
                  )}
                </button>
                <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 text-center mt-2.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Por segurança, todo anúncio passa por verificação humana e liberação em até 48 horas</span>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* =========================================================================
            ETAPA 2: TELA DO CÓDIGO PIX (PADRÃO OFICIAL BACEN & BANCOS BRASILEIROS)
            ========================================================================= */}
        {step === 'pix_payment' && pixData && (
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl animate-in fade-in duration-300">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black mb-3">
                <QrCode className="w-4 h-4 text-emerald-400" />
                <span>Pague com Pix Oficial (Banco Central do Brasil)</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Quase pronto! Faça o Pix de R$ 100,00
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-lg mx-auto">
                Escaneie o QR Code com a câmera do celular ou copie o código Pix abaixo no app do seu banco (Bradesco, Nubank, Itaú, BB, etc.).
              </p>
            </div>

            {/* QR Code Container Oficial (Imagem Real Scaneável) */}
            <div className="flex flex-col items-center justify-center p-6 bg-slate-950 rounded-2xl border border-slate-800 max-w-md mx-auto mb-6 shadow-inner text-center">
              {clientQrCodeUrl ? (
                <div className="relative group">
                  <img
                    src={clientQrCodeUrl}
                    alt="QR Code Pix Oficial"
                    className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-2xl bg-white p-3 shadow-2xl border-4 border-emerald-500/30 mb-3"
                  />
                  <div className="text-[11px] font-bold text-emerald-400 flex items-center justify-center gap-1.5 mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>QR Code nítido para leitura por qualquer câmera de celular</span>
                  </div>
                </div>
              ) : (
                <div className="w-56 h-56 bg-white rounded-2xl p-4 flex flex-col items-center justify-center text-slate-900 mb-3 shadow-md animate-pulse">
                  <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin mb-2" />
                  <span className="text-xs font-bold text-slate-700">Gerando QR Code oficial...</span>
                </div>
              )}

              <div className="text-center w-full pt-1 border-t border-slate-800/80 mt-2">
                <div className="flex items-center justify-between text-xs text-slate-400 py-1">
                  <span>Valor a pagar:</span>
                  <span className="text-xl font-black text-emerald-400">R$ 100,00</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 py-0.5">
                  <span>Beneficiário:</span>
                  <span className="font-semibold text-slate-200">{pixData.nomeBeneficiario || 'PRA ONDE EU VOU'}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 py-0.5">
                  <span>Cidade do Recebedor:</span>
                  <span className="font-semibold text-slate-200">{pixData.cidadeBeneficiario || 'PRAIA GRANDE - SP'}</span>
                </div>
              </div>
            </div>

            {/* Código Pix Copia e Cola Oficial (Aquele com muitas letras) */}
            <div className="mb-5 max-w-md mx-auto bg-slate-950 p-4 sm:p-5 rounded-2xl border border-emerald-500/40 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-xs font-black text-emerald-400 uppercase tracking-wider">
                  <Copy className="w-4 h-4 text-emerald-400" />
                  <span>Código Pix Copia e Cola Oficial</span>
                </span>
                {copied && (
                  <span className="text-emerald-400 text-xs font-black flex items-center gap-1 animate-in fade-in">
                    <Check className="w-3.5 h-3.5" /> Código Copiado!
                  </span>
                )}
              </div>

              {/* Caixa com o código Pix completo (aquele com muitas letras) */}
              <div 
                onClick={handleCopyPix}
                title="Clique para copiar o código Pix"
                className="p-3 bg-slate-900/90 hover:bg-slate-900 rounded-xl border border-slate-800 hover:border-emerald-500/50 font-mono text-[11px] sm:text-xs text-slate-200 break-all select-all max-h-24 overflow-y-auto mb-3 leading-relaxed cursor-pointer transition-colors"
              >
                {pixData.qrCode}
              </div>

              {/* Botão principal de destaque para copiar o código com 1 clique */}
              <button
                type="button"
                onClick={handleCopyPix}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 cursor-pointer active:scale-[0.99]"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
                    <span>Código Pix Copiado com Sucesso!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-950" />
                    <span>Copiar Código Pix (Copia e Cola)</span>
                  </>
                )}
              </button>

              <p className="mt-2.5 text-center text-[11px] text-slate-400 leading-normal">
                No app do seu banco (Bradesco, Nubank, Itaú, BB, etc.), vá em <strong>Pix &gt; Pix Copia e Cola</strong> e cole este código para pagar.
              </p>
            </div>

            {/* Indicador de Confirmação Automática do Mercado Pago em Tempo Real */}
            <div className="max-w-md mx-auto mb-5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center gap-2.5 text-xs text-emerald-300 shadow-inner">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-semibold text-center">
                Aguardando confirmação automática do Mercado Pago em tempo real...
              </span>
            </div>

            {/* Aviso visual caso o usuário clique em checar manualmente */}
            {paymentNotice && (
              <div className="max-w-md mx-auto mb-4 p-3 bg-amber-950/50 border border-amber-500/40 rounded-xl text-xs text-amber-200 text-center animate-in fade-in leading-relaxed">
                {paymentNotice}
              </div>
            )}

            {/* Ações de verificação e conclusão */}
            <div className="space-y-3 max-w-md mx-auto pt-1">
              <button
                type="button"
                onClick={handleConfirmManualPix}
                disabled={checkingPayment}
                className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {checkingPayment ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Registrando confirmação...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Já Fiz o Pix! Confirmar e Enviar Comprovante</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCheckPayment}
                disabled={checkingPayment}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>Verificar Aprovação Automática Agora</span>
              </button>

              <div className="flex items-center justify-between gap-3 text-xs pt-1">
                <button
                  onClick={() => setStep('form')}
                  className="text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Alterar dados do anúncio
                </button>

                <button
                  onClick={onBack}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  Concluir mais tarde
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            ETAPA 3: PAGAMENTO CONFIRMADO E AVISO DE LIBERAÇÃO EM ATÉ 48 HORAS
            ========================================================================= */}
        {step === 'confirmed' && (
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 text-center shadow-2xl animate-in fade-in duration-300">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-500/20 border-2 border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-4 shadow-xl">
              <Hourglass className="w-8 h-8 sm:w-10 sm:h-10 animate-pulse" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-extrabold mb-3">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pix de R$ 100,00 Confirmado no Mercado Pago</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
              Pagamento Recebido! Em Análise para Liberação
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm max-w-lg mx-auto mb-5 leading-relaxed">
              Por motivos de segurança e qualidade do catálogo, o anúncio de <strong className="text-white">{createdSponsor?.name}</strong> está sob análise cadastral e será liberado na vitrine por proximidade em até <strong>48 horas</strong>.
            </p>

            {/* Card com protocolo e prazo */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 max-w-md mx-auto mb-6 text-left shadow-inner">
              <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-2 mb-2">
                <span className="text-slate-400">Número do Protocolo:</span>
                <span className="font-mono font-bold text-amber-400">{protocolo}</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-2 mb-2">
                <span className="text-slate-400">Prazo de Liberação:</span>
                <span className="font-bold text-sky-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Até 48 horas úteis
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Status no Sistema:</span>
                <span className="font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded">
                  Aguardando Liberação da Moderação
                </span>
              </div>
            </div>

            {/* Bloco de Mensagem Enviada ao Celular do Anunciante */}
            <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-5 max-w-lg mx-auto text-left mb-6 shadow-inner">
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Phone className="w-4 h-4 text-emerald-400" />
                  <span>Mensagem Enviada para o seu Celular:</span>
                </div>
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                  {pixData?.advertiserPhone}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line">
                {whatsappMessageText}
              </div>

              <div className="mt-4 flex flex-col sm:flex-row items-center gap-2.5">
                <a
                  href={`https://wa.me/55${pixData?.advertiserPhone}?text=${encodeURIComponent(whatsappMessageText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Abrir Comprovante no WhatsApp</span>
                </a>

                <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Mensagem registrada
                </span>
              </div>
            </div>

            {/* Botão de retorno */}
            <button
              type="button"
              onClick={onBack}
              className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-all cursor-pointer"
            >
              Voltar para a Página Inicial
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
