import React, { useState, useEffect, useMemo } from 'react';
import { 
  PlusCircle, 
  ArrowLeft, 
  Calendar, 
  Clock, 
  MapPin, 
  DollarSign, 
  User, 
  Sparkles, 
  Image as ImageIcon, 
  Tag, 
  CheckCircle2, 
  Eye, 
  Compass,
  AlertCircle,
  Upload,
  Trash2,
  Link,
  Navigation,
  Loader2,
  Globe,
  ExternalLink
} from 'lucide-react';
import { EventItem, EventCategory, ActiveScreen, Advertiser, CategoryItem } from '../types';
import { useUserLocation } from '../context/LocationContext';

interface EventRegisterProps {
  onAddEvent: (event: EventItem) => Promise<EventItem> | void;
  onNavigate: (screen: ActiveScreen) => void;
  onSelectEvent: (event: EventItem) => void;
  currentAdvertiser: Advertiser | null;
  onChangeAdvertiser: () => void;
  categories?: string[];
  categoryItems?: CategoryItem[];
}

const DEFAULT_CATEGORIES: { id: number; nome: string }[] = [
  { id: 1, nome: 'Shows' },
  { id: 2, nome: 'Samba e Pagode' },
  { id: 3, nome: 'Baile Nostalgia' },
  { id: 4, nome: 'Baile Terceira Idade' },
  { id: 5, nome: 'Forró' },
  { id: 6, nome: 'Forró Pé de Serra' },
];

const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1000&auto=format&fit=crop';

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export const EventRegister: React.FC<EventRegisterProps> = ({
  onAddEvent,
  onNavigate,
  onSelectEvent,
  currentAdvertiser,
  onChangeAdvertiser,
  categories,
  categoryItems,
}) => {
  const { coords } = useUserLocation();
  const availableCategories = useMemo(() => {
    if (categoryItems && categoryItems.length > 0) {
      return categoryItems.map(c => ({ id: c.id, nome: c.nome }));
    }
    return DEFAULT_CATEGORIES;
  }, [categoryItems]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(() => availableCategories[0]?.id || 1);
  const [category, setCategory] = useState<EventCategory>(() => (availableCategories[0]?.nome as EventCategory) || 'Shows');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('19:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [locationName, setLocationName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('SP');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeInfo, setGeocodeInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState<string>('');
  const [priceDetails, setPriceDetails] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [organizer, setOrganizer] = useState(
    currentAdvertiser?.name || (currentAdvertiser?.email ? currentAdvertiser.email.split('@')[0] : '')
  );
  const [contact, setContact] = useState(
    currentAdvertiser?.phone || currentAdvertiser?.email || ''
  );

  // Função para buscar coordenadas geográficas pelo endereço e cidade
  const fetchCoordinates = async (
    customAddr = address,
    customCity = city,
    customState = state
  ): Promise<{ latitude: string; longitude: string } | null> => {
    const targetAddr = (customAddr || '').trim() || locationName.trim();
    const targetCity = (customCity || '').trim();

    if (!targetAddr && !targetCity) {
      return null;
    }

    setIsGeocoding(true);
    setGeocodeInfo(null);

    try {
      const params = new URLSearchParams({
        address: targetAddr,
        city: targetCity,
        state: customState,
      });

      const response = await fetch(`/api/geocode?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.latitude && data.longitude) {
          setLatitude(String(data.latitude));
          setLongitude(String(data.longitude));
          setGeocodeInfo(`Geolocalização identificada: Lat ${Number(data.latitude).toFixed(4)}, Lon ${Number(data.longitude).toFixed(4)}`);
          return { latitude: String(data.latitude), longitude: String(data.longitude) };
        }
      } else {
        setGeocodeInfo('Não foi possível obter coordenadas exatas; o sistema tentará uma aproximação no momento de salvar.');
      }
    } catch (err) {
      console.warn('Erro ao consultar serviço de geolocalização:', err);
    } finally {
      setIsGeocoding(false);
    }

    return null;
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor, envie um arquivo de imagem válido (JPG, PNG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setImageUrl(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Update fields if currentAdvertiser changes
  useEffect(() => {
    if (currentAdvertiser) {
      if (!organizer) {
        setOrganizer(currentAdvertiser.name || currentAdvertiser.email.split('@')[0]);
      }
      if (!contact) {
        setContact(currentAdvertiser.phone || currentAdvertiser.email);
      }
    }
  }, [currentAdvertiser]);

  // Status
  const [submittedEvent, setSubmittedEvent] = useState<EventItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!title.trim()) {
      setErrorMessage('Por favor, informe o título do evento.');
      return;
    }
    if (!date) {
      setErrorMessage('Por favor, selecione a data de realização do evento.');
      return;
    }
    if (!locationName.trim() || !city.trim()) {
      setErrorMessage('Por favor, informe o local e a cidade do evento.');
      return;
    }
    if (!organizer.trim()) {
      setErrorMessage('Por favor, informe o nome do organizador ou produtora.');
      return;
    }

    setIsSubmitting(true);

    // Atualização baseada no campo endereco: se ainda não temos latitude e longitude, buscamos agora
    let finalLat = latitude.trim();
    let finalLon = longitude.trim();

    if (!finalLat || !finalLon) {
      const detected = await fetchCoordinates(address, city, state);
      if (detected) {
        finalLat = detected.latitude;
        finalLon = detected.longitude;
      }
    }

    const currentCat = availableCategories.find((c) => c.id === selectedCategoryId);
    const resolvedCatName = (currentCat ? currentCat.nome : category) as EventCategory;
    const resolvedCatId = currentCat ? currentCat.id : selectedCategoryId;

    const newEvent: EventItem = {
      id: `user-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      category: resolvedCatName,
      categoryId: resolvedCatId,
      date,
      time: time || '19:00',
      endDate: endDate || undefined,
      endTime: endTime || undefined,
      locationName: locationName.trim(),
      address: address.trim() || locationName.trim(),
      city: city.trim(),
      state,
      latitude: finalLat || undefined,
      longitude: finalLon || undefined,
      liberado: 'S',
      isFree,
      price: !isFree && price && !isNaN(parseFloat(price)) ? parseFloat(price) : undefined,
      priceDetails: priceDetails.trim() || (!isFree ? (price ? `R$ ${price}` : 'Consulte valores') : 'Entrada Franca'),
      imageUrl: imageUrl.trim() || DEFAULT_FALLBACK_IMAGE,
      organizer: organizer.trim(),
      contact: contact.trim() || undefined,
      tags: [resolvedCatName],
      featured: false,
      createdAt: new Date().toISOString(),
    };

    try {
      const savedResult = await onAddEvent(newEvent);
      if (savedResult && savedResult.id) {
        setSubmittedEvent(savedResult);
      } else {
        setSubmittedEvent(newEvent);
      }
    } catch (saveError) {
      console.error('Erro ao submeter evento:', saveError);
      setSubmittedEvent(newEvent);
    } finally {
      setIsSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleResetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('Shows');
    setDate('');
    setTime('19:00');
    setEndDate('');
    setEndTime('');
    setLocationName('');
    setAddress('');
    setCity('');
    setState('SP');
    setLatitude('');
    setLongitude('');
    setGeocodeInfo(null);
    setIsFree(true);
    setPrice('');
    setPriceDetails('');
    setImageUrl('');
    setOrganizer('');
    setContact('');
    setSubmittedEvent(null);
  };

  // Success Confirmation View
  if (submittedEvent) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        {/* Status Icon */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <Clock className="w-10 h-10" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-md border-2 border-slate-950">
            <CheckCircle2 className="w-4 h-4 text-slate-950" />
          </div>
        </div>

        {/* Highlighted Message Requested by User */}
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-sm font-bold mb-4 shadow-sm">
          <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>Enviado para análise e liberação até 2 dias úteis.</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
          Evento Enviado com Sucesso!
        </h2>
        <p className="text-slate-300 text-sm sm:text-base max-w-lg mx-auto mb-8">
          O evento <strong className="text-amber-400">"{submittedEvent.title}"</strong> foi enviado para análise e liberação em até 2 dias úteis.
        </p>

        {/* Card preview */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-left mb-8 max-w-md mx-auto shadow-md">
          <div className="flex items-center gap-3">
            <img
              src={submittedEvent.imageUrl}
              alt={submittedEvent.title}
              className="w-16 h-16 rounded-xl object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-[11px] font-semibold text-amber-400">{submittedEvent.category}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Em análise (até 2 dias úteis)
                </span>
              </div>
              <h4 className="font-bold text-white text-sm truncate">{submittedEvent.title}</h4>
              <p className="text-xs text-slate-400">
                {new Date(submittedEvent.date + 'T12:00:00').toLocaleDateString('pt-BR')} • {submittedEvent.city}/{submittedEvent.state}
              </p>
            </div>
          </div>

          {/* Coordenadas Atualizadas e Salvas */}
          {submittedEvent.latitude && submittedEvent.longitude && (
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <Navigation className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  Coordenadas: Lat {submittedEvent.latitude}, Lon {submittedEvent.longitude}
                </span>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${submittedEvent.latitude},${submittedEvent.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-amber-200 transition-colors"
              >
                <span>Ver no Mapa</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Action options */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => {
              onSelectEvent(submittedEvent);
              onNavigate('events');
            }}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Compass className="w-4 h-4" />
            <span>Ver Evento na Consulta</span>
          </button>

          <button
            onClick={handleResetForm}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-700 transition-colors flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-4 h-4 text-amber-400" />
            <span>Cadastrar Outro Evento</span>
          </button>

          <button
            onClick={() => onNavigate('home')}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white font-semibold text-sm transition-colors"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800 mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Início</span>
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">
            Cadastrar Novo Evento
          </h1>
        </div>

        <button
          onClick={() => onNavigate('events')}
          className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
        >
          <span>Ir para Consulta</span>
          <Compass className="w-4 h-4" />
        </button>
      </div>

      {/* Connected Advertiser Information Banner */}
      {currentAdvertiser && (
        <div className="mb-6 p-4 rounded-2xl bg-slate-900/90 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-white">
                  {currentAdvertiser.name || 'Anunciante'}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" /> Anunciante Verificado
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Logado como: <span className="text-slate-300 font-medium">{currentAdvertiser.email}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onChangeAdvertiser}
            className="text-xs font-semibold text-slate-300 hover:text-white px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors self-start sm:self-auto"
          >
            Trocar Anunciante
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Two Column Grid: Form & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
          {/* Section: Basic info */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Informações Principais
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Título do Evento *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Noite de MPB no Coreto, Festival da Pizza, Hackathon..."
                required
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Categoria do Evento *
              </label>
              <select
                id="select-register-category"
                value={selectedCategoryId}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSelectedCategoryId(id);
                  const found = availableCategories.find((c) => c.id === id);
                  if (found) {
                    setCategory(found.nome as EventCategory);
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer"
              >
                {availableCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Descrição do Evento <span className="text-slate-500 font-normal">(Opcional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Explique o que vai rolar, atrações especiais, público alvo e detalhes importantes (opcional)..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          {/* Section: Date & Time */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Data e Horário
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Data de Início *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Horário de Início *
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Data de Término (Opcional)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Horário de Término (Opcional)
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
            </div>
          </div>

          {/* Section: Location */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Localização
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nome do Local / Estabelecimento *
              </label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Ex: Parque Ibirapuera, Circo Voador, Galeria de Arte..."
                required
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Endereço / Logradouro
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Av. Paulista, 1000 - Bela Vista"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Cidade *
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: São Paulo"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  UF *
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  {BRAZILIAN_STATES.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Geolocation Feedback & Auto-detection */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">
                    Geolocalização Automática (Lat / Long)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {coords && (
                    <button
                      type="button"
                      onClick={() => {
                        setLatitude(String(coords.latitude.toFixed(6)));
                        setLongitude(String(coords.longitude.toFixed(6)));
                        setGeocodeInfo(`Coordenadas físicas exatas obtidas pelo GPS: Lat ${coords.latitude.toFixed(6)}, Lon ${coords.longitude.toFixed(6)}`);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer w-fit"
                      title="Preencher com a localização física exata do seu aparelho agora"
                    >
                      <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Usar Meu GPS Atual</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => fetchCoordinates(address, city, state)}
                    disabled={isGeocoding || (!address.trim() && !city.trim())}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer w-fit"
                  >
                    {isGeocoding ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        <span>Buscando coordenadas...</span>
                      </>
                    ) : (
                      <>
                        <Globe className="w-3.5 h-3.5 text-amber-400" />
                        <span>{latitude && longitude ? 'Recalcular Coordenadas' : 'Testar Coordenadas do Endereço'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Status Banner */}
              {latitude && longitude ? (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>
                      <strong>Coordenadas prontas:</strong> Lat <code className="text-white font-mono bg-emerald-950/60 px-1 py-0.5 rounded">{latitude}</code>, Long <code className="text-white font-mono bg-emerald-950/60 px-1 py-0.5 rounded">{longitude}</code>
                    </span>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:underline"
                  >
                    <span>Ver no Mapa</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  💡 Ao clicar em <strong>"Publicar Evento"</strong>, o sistema consulta e atualiza automaticamente as coordenadas de <strong>latitude</strong> e <strong>longitude</strong> da tabela com base no endereço digitado.
                </p>
              )}

              {geocodeInfo && !latitude && (
                <p className="text-xs text-amber-400/90 mt-1.5">{geocodeInfo}</p>
              )}
            </div>
          </div>

          {/* Section: Pricing & Tickets */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Ingressos & Valores
            </h3>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="pricingType"
                  checked={isFree}
                  onChange={() => setIsFree(true)}
                  className="text-amber-500 focus:ring-amber-500"
                />
                <span className="text-sm font-medium text-white">Evento Gratuito (Entrada Franca)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="pricingType"
                  checked={!isFree}
                  onChange={() => setIsFree(false)}
                  className="text-amber-500 focus:ring-amber-500"
                />
                <span className="text-sm font-medium text-white">Evento Pago</span>
              </label>
            </div>

            {!isFree && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Valor a partir de (R$) <span className="text-slate-500 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Ex: 50.00 (ou em branco)"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Detalhes do Ingresso (Opcional)
                  </label>
                  <input
                    type="text"
                    value={priceDetails}
                    onChange={(e) => setPriceDetails(e.target.value)}
                    placeholder="Ex: 1º Lote com consumação, meia-entrada..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section: Image & Presets */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Imagem de Capa
            </h3>

            {/* File Upload Box (Drag and Drop + Click) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Envie uma foto do seu dispositivo ou informe a URL:
              </label>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
                className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                  isDragging
                    ? 'border-amber-400 bg-amber-500/10'
                    : 'border-slate-700/80 hover:border-slate-600 bg-slate-950/60'
                }`}
              >
                <input
                  id="input-file-event-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                {imageUrl ? (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <div className="relative w-36 h-24 rounded-xl overflow-hidden border border-slate-700 shadow-md">
                      <img
                        src={imageUrl}
                        alt="Imagem selecionada"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex flex-col sm:items-start gap-2 text-center sm:text-left">
                      <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 justify-center sm:justify-start">
                        <CheckCircle2 className="w-4 h-4" />
                        Imagem anexada com sucesso
                      </span>
                      <div className="flex gap-2">
                        <label
                          htmlFor="input-file-event-image"
                          className="cursor-pointer px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors inline-block"
                        >
                          Trocar foto
                        </label>
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
                          className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor="input-file-event-image"
                    className="cursor-pointer flex flex-col items-center justify-center gap-2"
                  >
                    <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-amber-400">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-semibold text-white">
                      Clique para selecionar uma foto ou arraste aqui
                    </span>
                    <span className="text-xs text-slate-400">
                      Formatos suportados: JPG, PNG, WEBP (recomendado proporção 16:9)
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* URL input alternative */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5" />
                <span>Ou digite a URL da imagem da internet:</span>
              </label>
              <input
                id="input-url-event-image"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://exemplo.com/cartaz-evento.jpg"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          {/* Section: Organizer */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <User className="w-4 h-4" />
              Organizador do Evento
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Organizador / Produtora *
                </label>
                <input
                  type="text"
                  value={organizer}
                  onChange={(e) => setOrganizer(e.target.value)}
                  placeholder="Ex: Coletivo Cultural, Produtora X..."
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Contato / Link / Instagram (Opcional)
                </label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Ex: @seuevento ou contato@email.com"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              id="btn-submit-event"
              type="submit"
              disabled={isSubmitting || isGeocoding}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-base shadow-lg shadow-amber-500/20 hover:shadow-amber-500/35 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
            >
              {isSubmitting || isGeocoding ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Geolocalizando endereço e publicando evento...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-5 h-5" />
                  <span>Publicar Evento no "Pra onde eu vou"</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Live Preview Card */}
        <div className="lg:col-span-5 sticky top-24 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <Eye className="w-4 h-4 text-amber-400" />
            <span>Pré-visualização do Card</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="relative h-48 w-full bg-slate-950">
              <img
                src={imageUrl || DEFAULT_FALLBACK_IMAGE}
                alt="Preview"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />

              <div className="absolute top-3 left-3 bg-slate-950/90 rounded-xl p-1 px-2.5 text-center border border-slate-700/60">
                <span className="block text-[10px] font-bold uppercase text-amber-400">
                  {date ? new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' }) : 'MÊS'}
                </span>
                <span className="block text-base font-extrabold text-white">
                  {date ? new Date(date + 'T12:00:00').getDate() : '--'}
                </span>
              </div>

              <div className="absolute bottom-2 left-3">
                <span className="text-[11px] font-semibold text-amber-300 bg-slate-950/80 px-2 py-0.5 rounded border border-amber-500/20">
                  {category}
                </span>
              </div>

              <div className="absolute bottom-2 right-3">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded shadow-sm ${
                  isFree
                    ? 'bg-emerald-500 text-slate-950 font-extrabold'
                    : 'bg-slate-950/90 text-amber-300 border border-amber-500/30'
                }`}>
                  {isFree ? 'Gratuito' : (price ? `R$ ${parseFloat(price).toFixed(2).replace('.', ',')}` : (priceDetails || 'Consulte'))}
                </span>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <h4 className="font-bold text-white text-base truncate">
                  {title || 'Título do seu evento incrível'}
                </h4>
                <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                  {description || 'Sua descrição aparecerá aqui para convidar as pessoas...'}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-1.5 text-xs text-slate-400">
                <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>{date ? new Date(date + 'T12:00:00').toLocaleDateString('pt-BR') : 'Data a definir'} • {time || '19:00'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span className="truncate">{locationName || 'Local a definir'} ({city || 'Cidade'} - {state})</span>
                </div>
              </div>

              {organizer && (
                <div className="pt-1 text-[11px] text-slate-400">
                  Organizado por: <strong className="text-slate-300">{organizer}</strong>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 leading-relaxed">
            💡 <strong>Dica:</strong> Seu evento é salvo no navegador e fica imediatamente visível na consulta de eventos com opções de localização, compartilhamento e adição na agenda!
          </div>
        </div>
      </div>
    </div>
  );
};
