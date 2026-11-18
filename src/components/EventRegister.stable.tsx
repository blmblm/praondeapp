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
  ExternalLink,
  X,
  Video,
  Play,
  Film,
  Search,
  Music,
  PartyPopper,
  Theater,
  Disc,
  Mic,
  Flame,
  Smile,
  Trophy,
  Utensils,
  LayoutGrid,
  ChevronDown
} from 'lucide-react';
import { EventItem, EventCategory, ActiveScreen, Advertiser, CategoryItem, CidadeItem } from '../types';
import { parseVideoUrl } from '../lib/videoUtils';
import { VideoPlayer } from './VideoPlayer';

interface EventRegisterProps {
  onAddEvent: (event: EventItem) => Promise<EventItem> | void;
  onNavigate: (screen: ActiveScreen) => void;
  onSelectEvent: (event: EventItem) => void;
  currentAdvertiser: Advertiser | null;
  onChangeAdvertiser: () => void;
  categories?: string[];
  categoryItems?: CategoryItem[];
  cidadesList?: CidadeItem[];
}

const DEFAULT_CATEGORIES: { id: number; nome: string }[] = [
  { id: 1, nome: 'Categoria' },
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

const getCategoryIcon = (name: string): React.ComponentType<{ className?: string }> => {
  const norm = (name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (norm.includes('samba') || norm.includes('pagode')) return Music;
  if (norm.includes('forro')) return Flame;
  if (norm.includes('baile') || norm.includes('festa')) return PartyPopper;
  if (norm.includes('nostalgia') || norm.includes('flashback') || norm.includes('disco')) return Disc;
  if (norm.includes('show')) return Mic;
  if (norm.includes('teatro') || norm.includes('espetaculo')) return Theater;
  if (norm.includes('gastronomia') || norm.includes('comida') || norm.includes('feijoada')) return Utensils;
  if (norm.includes('esporte') || norm.includes('corrida') || norm.includes('futebol')) return Trophy;
  if (norm.includes('infantil') || norm.includes('crianca')) return Smile;
  return Tag;
};

export const EventRegister: React.FC<EventRegisterProps> = ({
  onAddEvent,
  onNavigate,
  onSelectEvent,
  currentAdvertiser,
  onChangeAdvertiser,
  categories,
  categoryItems,
  cidadesList: propCidadesList,
}) => {
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>(() => categoryItems || []);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Sincroniza se categoryItems vier via props
  useEffect(() => {
    if (categoryItems && categoryItems.length > 0) {
      setCategoriesList(categoryItems);
    }
  }, [categoryItems]);

  // Busca todos os itens da tabela categorias diretamente da API para garantir dados completos no grid
  useEffect(() => {
    let isMounted = true;
    const fetchAllCategories = async () => {
      try {
        setIsLoadingCategories(true);
        const res = await fetch('/api/categories');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data) && data.length > 0) {
            setCategoriesList(data);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar itens da tabela categoria:', err);
      } finally {
        if (isMounted) setIsLoadingCategories(false);
      }
    };
    fetchAllCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  const availableCategories = useMemo(() => {
    let raw = categoriesList && categoriesList.length > 0
      ? categoriesList
      : categoryItems && categoryItems.length > 0
      ? categoryItems
      : DEFAULT_CATEGORIES;

    // Filtra opções vazias ou 'Todas'/'Categoria' para exibir categorias reais
    const valid = raw.filter(c => {
      const lower = (c.nome || '').trim().toLowerCase();
      return lower && lower !== 'todas' && lower !== 'categoria';
    });

    const source = valid.length > 0 ? valid : raw;
    return source.map(c => ({ id: c.id, nome: c.nome, descricao: (c as any).descricao }));
  }, [categoriesList, categoryItems]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(() => availableCategories[0]?.id || 2);
  const [category, setCategory] = useState<EventCategory>(() => (availableCategories[0]?.nome as EventCategory) || 'Samba e Pagode');

  // Garante que selectedCategoryId é válido dentro das categorias disponíveis
  useEffect(() => {
    if (availableCategories.length > 0) {
      const exists = availableCategories.some(c => c.id === selectedCategoryId);
      if (!exists) {
        setSelectedCategoryId(availableCategories[0].id);
        setCategory(availableCategories[0].nome as EventCategory);
      }
    }
  }, [availableCategories, selectedCategoryId]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('19:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [locationName, setLocationName] = useState('');
  const [address, setAddress] = useState('');
  const [cidadesList, setCidadesList] = useState<CidadeItem[]>(() => propCidadesList || []);
  const [isLoadingCidades, setIsLoadingCidades] = useState(false);
  const [selectedCidadeId, setSelectedCidadeId] = useState<number | ''>(() => propCidadesList?.[0]?.id || '');
  const [city, setCity] = useState<string>(() => propCidadesList?.[0]?.nome || '');
  const [state, setState] = useState<string>(() => propCidadesList?.[0]?.estado || 'SP');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeInfo, setGeocodeInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState<string>('');
  const [priceDetails, setPriceDetails] = useState('');
  const [selectedMediaType, setSelectedMediaType] = useState<'image' | 'video'>('image');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isVideoDragging, setIsVideoDragging] = useState(false);
  const [organizer, setOrganizer] = useState(
    currentAdvertiser?.name || (currentAdvertiser?.email ? currentAdvertiser.email.split('@')[0] : '')
  );
  const [contact, setContact] = useState(
    currentAdvertiser?.phone || currentAdvertiser?.email || ''
  );

  // Sincroniza se cidadesList vier via props
  useEffect(() => {
    if (propCidadesList && propCidadesList.length > 0) {
      setCidadesList(propCidadesList);
      const found = propCidadesList.find((c) => c.nome.toLowerCase() === city.toLowerCase()) || propCidadesList[0];
      if (found) {
        setSelectedCidadeId(found.id);
        setCity(found.nome);
        setState(found.estado);
      }
    }
  }, [propCidadesList]);

  // Carrega cidades/estados diretamente da tabela estado do SQLite
  useEffect(() => {
    const fetchCidades = async () => {
      setIsLoadingCidades(true);
      try {
        const res = await fetch('/api/estado');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setCidadesList(data);
            if (data.length > 0) {
              const matched = data.find((c: CidadeItem) => c.nome.toLowerCase() === city.toLowerCase()) || data[0];
              if (matched) {
                setSelectedCidadeId(matched.id);
                setCity(matched.nome);
                setState(matched.estado);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar registros da tabela estado:', err);
      } finally {
        setIsLoadingCidades(false);
      }
    };
    fetchCidades();
  }, []);

  // Função para buscar coordenadas geográficas baseadas no endereço do evento
  const fetchCoordinates = async (
    customAddr = address,
    customCity = city,
    customState = state,
    customLocName = locationName
  ): Promise<{ latitude: string; longitude: string } | null> => {
    const targetAddr = (customAddr || '').trim();
    const targetCity = (customCity || '').trim();
    const targetLocName = (customLocName || '').trim();

    if (!targetAddr && !targetCity && !targetLocName) {
      setLatitude('');
      setLongitude('');
      setGeocodeInfo(null);
      return null;
    }

    setIsGeocoding(true);
    setGeocodeInfo(null);

    try {
      const params = new URLSearchParams({
        address: targetAddr,
        city: targetCity,
        state: customState,
        locationName: targetLocName,
      });

      const response = await fetch(`/api/geocode?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.latitude && data.longitude) {
          // REGRA CRÍTICA: Se o endereço de rua foi digitado mas não foi localizado com precisão
          // (retornou apenas o fallback do centro da cidade), limpamos e consideramos inválido
          if (targetAddr && data.addressResolved === false) {
            setLatitude('');
            setLongitude('');
            setGeocodeInfo(null);
            return null;
          }

          const latStr = String(data.latitude);
          const lonStr = String(data.longitude);
          setLatitude(latStr);
          setLongitude(lonStr);
          const detail = data.displayName ? ` (${data.displayName.split(',').slice(0, 3).join(',')})` : '';
          setGeocodeInfo(`Coordenadas do endereço confirmadas: Lat ${Number(latStr).toFixed(4)}, Lon ${Number(lonStr).toFixed(4)}${detail}`);
          return { latitude: latStr, longitude: lonStr };
        } else {
          setLatitude('');
          setLongitude('');
          setGeocodeInfo(null);
        }
      } else {
        setLatitude('');
        setLongitude('');
        setGeocodeInfo(null);
      }
    } catch (err) {
      console.warn('Erro ao consultar serviço de geolocalização do endereço:', err);
      setLatitude('');
      setLongitude('');
      setGeocodeInfo(null);
    } finally {
      setIsGeocoding(false);
    }

    return null;
  };

  // Efeito automático: Sempre que o endereço, cidade, estado ou local do evento forem alterados,
  // atualiza automaticamente as coordenadas com base no endereço do evento
  useEffect(() => {
    const cleanAddr = address.trim();
    const cleanCity = city.trim();
    const cleanLoc = locationName.trim();

    if (!cleanAddr && !cleanCity && !cleanLoc) {
      setLatitude('');
      setLongitude('');
      setGeocodeInfo(null);
      return;
    }

    // Debounce de 700ms para aguardar término da digitação
    const timer = setTimeout(() => {
      fetchCoordinates(cleanAddr, cleanCity, state, cleanLoc);
    }, 700);

    return () => clearTimeout(timer);
  }, [address, city, state, locationName]);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor, envie um arquivo de imagem válido (JPG, PNG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        // Redimensiona mantendo a proporção (largura máxima ou altura máxima de 800px)
        const maxDimension = 800;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Exporta como JPEG com qualidade comprimida de 0.7 para ficar super leve (geralmente < 100KB)
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setImageUrl(compressedBase64);
        } else {
          if (typeof readerEvent.target?.result === 'string') {
            setImageUrl(readerEvent.target.result);
          }
        }
      };
      img.src = readerEvent.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleVideoFileSelect = (file: File) => {
    const isMp4 = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
    if (!isMp4) {
      setErrorMessage('Formato não permitido. Na mídia de divulgação em vídeo, aceitamos exclusivamente arquivos no formato MP4 (.mp4).');
      return;
    }
    // Suporte a arquivos de até 50MB
    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage('O arquivo de vídeo ultrapassa 50MB. Por favor, envie um arquivo MP4 menor.');
      return;
    }
    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setVideoUrl(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVideoUrlChange = (url: string) => {
    const clean = url.trim();
    if (clean) {
      const isMp4 = clean.toLowerCase().split('?')[0].endsWith('.mp4') || clean.startsWith('data:video/mp4');
      if (!isMp4) {
        setErrorMessage('Apenas vídeos no formato MP4 (.mp4) são permitidos. A URL deve terminar com .mp4');
      } else {
        setErrorMessage(null);
      }
    } else {
      setErrorMessage(null);
    }
    setVideoUrl(clean);
    const parsed = parseVideoUrl(clean);
    if (parsed?.thumbnailUrl && (!imageUrl || imageUrl === DEFAULT_FALLBACK_IMAGE)) {
      setImageUrl(parsed.thumbnailUrl);
    }
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

  // Rola a página para o topo de forma suave sempre que uma mensagem de erro for exibida
  useEffect(() => {
    if (errorMessage) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [errorMessage]);

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
    if (selectedMediaType === 'video') {
      if (!videoUrl.trim()) {
        setErrorMessage('Por favor, anexe o arquivo de vídeo no formato MP4 (.mp4) do seu evento.');
        return;
      }
      const isMp4 = videoUrl.startsWith('data:video/mp4') || videoUrl.startsWith('data:video/') || videoUrl.toLowerCase().split('?')[0].endsWith('.mp4');
      if (!isMp4) {
        setErrorMessage('Apenas arquivos de vídeo no formato MP4 (.mp4) são permitidos na mídia de divulgação.');
        return;
      }
    }

    setIsSubmitting(true);

    // Atualização baseada no endereço do evento: garante coordenadas calculadas a partir do endereço
    let finalLat = latitude.trim();
    let finalLon = longitude.trim();

    if (!finalLat || !finalLon) {
      const detected = await fetchCoordinates(address, city, state, locationName);
      if (detected) {
        finalLat = detected.latitude;
        finalLon = detected.longitude;
      }
    }

    if (!finalLat || !finalLon) {
      setIsSubmitting(false);
      setErrorMessage("Erro no endereço: Não foi possível obter as coordenadas de geolocalização (latitude/longitude) para este endereço. Por favor, verifique se o Nome do Local, Endereço e Cidade do evento estão corretos para que possamos localizá-lo com precisão no mapa.");
      return;
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
      liberado: 'N',
      status: 'em_analise',
      isFree,
      price: !isFree && price && !isNaN(parseFloat(price)) ? parseFloat(price) : undefined,
      priceDetails: priceDetails.trim() || (!isFree ? (price ? `R$ ${price}` : 'Consulte valores') : 'Entrada Franca'),
      imageUrl: imageUrl.trim() || (parseVideoUrl(videoUrl)?.thumbnailUrl) || DEFAULT_FALLBACK_IMAGE,
      mediaType: selectedMediaType,
      videoUrl: videoUrl.trim() || undefined,
      url: videoUrl.trim() || imageUrl.trim() || undefined,
      organizer: organizer.trim(),
      contact: contact.trim() || undefined,
      tags: [resolvedCatName],
      featured: false,
      createdAt: new Date().toISOString(),
    };

    try {
      setToastNotice('Registro enviado para análise, prazo 48 horas para liberação');
      const savedResult = await onAddEvent(newEvent);
      if (savedResult && savedResult.id) {
        setSubmittedEvent(savedResult);
      } else {
        setSubmittedEvent(newEvent);
      }
    } catch (saveError: any) {
      console.error('Erro ao submeter evento:', saveError);
      setErrorMessage(saveError?.message || 'Erro ao publicar o evento na tabela de eventos. Por favor, tente novamente.');
      return;
    } finally {
      setIsSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleResetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('Categoria');
    setDate('');
    setTime('19:00');
    setEndDate('');
    setEndTime('');
    setLocationName('');
    setAddress('');
    const defaultCid = cidadesList[0];
    setSelectedCidadeId(defaultCid?.id || 1);
    setCity(defaultCid?.nome || '');
    setState(defaultCid?.estado || 'SP');
    setLatitude('');
    setLongitude('');
    setGeocodeInfo(null);
    setIsFree(true);
    setPrice('');
    setPriceDetails('');
    setSelectedMediaType('image');
    setImageUrl('');
    setVideoUrl('');
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
        <div className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-300 text-base sm:text-lg font-bold mb-4 shadow-lg shadow-amber-500/10">
          <Clock className="w-5 h-5 text-amber-400 animate-pulse flex-shrink-0" />
          <span>Registro enviado para análise, prazo 48 horas para liberação</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
          Evento Cadastrado na Tabela de Eventos!
        </h2>
        <p className="text-slate-300 text-sm sm:text-base max-w-lg mx-auto mb-8">
          O evento <strong className="text-amber-400">"{submittedEvent.title}"</strong> foi gravado no cadastro de eventos e está com o status <strong className="text-amber-300">registro enviado para análise, prazo 48 horas para liberação</strong>.
        </p>

        {/* Card preview do evento recém-publicado */}
        <div className="max-w-md mx-auto mb-8 text-left">
          <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">
            <Eye className="w-4 h-4 text-amber-400" />
            <span>Pré-visualização do Card Publicado</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Visualizador do Cartaz no Formato Vertical */}
            <div className="relative aspect-[3/4] w-full bg-slate-950 overflow-hidden flex items-center justify-center">
              {/* Blur de fundo ambiente */}
              <img
                src={submittedEvent.imageUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover filter blur-2xl opacity-35 scale-110 pointer-events-none"
              />
              <img
                src={submittedEvent.imageUrl}
                alt={submittedEvent.title}
                className="relative z-10 w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 z-20 bg-gradient-to-t from-slate-900 via-transparent to-transparent pointer-events-none" />

              <div className="absolute top-3 left-3 z-30 bg-slate-950/90 backdrop-blur-sm rounded-xl p-1 px-2.5 text-center border border-slate-700/60 shadow-lg">
                <span className="block text-[10px] font-bold uppercase text-amber-400">
                  {new Date(submittedEvent.date + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                </span>
                <span className="block text-base font-extrabold text-white">
                  {new Date(submittedEvent.date + 'T12:00:00').getDate()}
                </span>
              </div>

              <div className="absolute top-3 right-3 z-30">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 backdrop-blur-sm shadow">
                  Em análise
                </span>
              </div>

              <div className="absolute bottom-2 left-3 z-30">
                <span className="text-[11px] font-semibold text-amber-300 bg-slate-950/90 px-2 py-0.5 rounded border border-amber-500/30 backdrop-blur-sm shadow">
                  {submittedEvent.category}
                </span>
              </div>

              <div className="absolute bottom-2 right-3 z-30">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded shadow-sm ${
                  submittedEvent.isFree
                    ? 'bg-emerald-500 text-slate-950 font-extrabold'
                    : 'bg-slate-950/90 text-amber-300 border border-amber-500/30 backdrop-blur-sm'
                }`}>
                  {submittedEvent.isFree ? 'Gratuito' : (submittedEvent.price ? `R$ ${submittedEvent.price.toFixed(2).replace('.', ',')}` : (submittedEvent.priceDetails || 'Consulte'))}
                </span>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <h4 className="font-bold text-white text-base truncate">
                  {submittedEvent.title}
                </h4>
                {submittedEvent.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                    {submittedEvent.description}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-1.5 text-xs text-slate-400">
                <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>{new Date(submittedEvent.date + 'T12:00:00').toLocaleDateString('pt-BR')} • {submittedEvent.time || '19:00'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span className="truncate">{submittedEvent.locationName} ({submittedEvent.city} - {submittedEvent.state})</span>
                </div>
              </div>

              {submittedEvent.organizer && (
                <div className="pt-1 text-[11px] text-slate-400">
                  Organizado por: <strong className="text-slate-300">{submittedEvent.organizer}</strong>
                </div>
              )}

              {/* Coordenadas Atualizadas e Salvas */}
              {submittedEvent.latitude && submittedEvent.longitude && (
                <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                    <span>
                      Lat: {submittedEvent.latitude}, Lon: {submittedEvent.longitude}
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
          </div>
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
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          <button
            onClick={() => {
              handleResetForm();
              onNavigate('home');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-rose-500/20 text-slate-200 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 text-xs font-bold transition-colors cursor-pointer shadow-sm"
            title="Sair e limpar formulário"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Sair</span>
          </button>
          <button
            onClick={() => {
              handleResetForm();
              onNavigate('home');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Início</span>
          </button>
          <div className="h-4 w-px bg-slate-800 hidden sm:block" />
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

      {toastNotice && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-300 text-sm font-semibold flex items-center justify-between gap-3 shadow-lg shadow-amber-500/10">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-amber-400 animate-pulse flex-shrink-0" />
            <span>{toastNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastNotice(null)}
            className="text-amber-400 hover:text-white p-1 rounded-lg hover:bg-amber-500/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Formulário de Cadastro Centralizado (Sem pré-visualização ao entrar na tela) */}
      <div className="max-w-3xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
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

            {/* Categoria do Evento - Campo de seleção idêntico à tela de Consulta Eventos */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Categoria do Evento *
              </label>
              <div className="relative">
                <select
                  id="select-event-category"
                  value={category}
                  onChange={(e) => {
                    const chosen = e.target.value;
                    const matched = availableCategories.find((c) => c.nome === chosen);
                    if (matched) {
                      setSelectedCategoryId(matched.id);
                      setCategory(matched.nome as EventCategory);
                    } else {
                      setCategory(chosen as EventCategory);
                    }
                  }}
                  className="w-full py-3 pl-3.5 pr-9 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/60 appearance-none cursor-pointer"
                >
                  {isLoadingCategories ? (
                    <option value="" disabled className="bg-slate-900 text-white">Carregando categorias...</option>
                  ) : availableCategories.length === 0 ? (
                    <option value="" disabled className="bg-slate-900 text-white">Nenhuma categoria cadastrada</option>
                  ) : (
                    availableCategories.map((cat) => (
                      <option key={cat.id || cat.nome} value={cat.nome} className="bg-slate-900 text-white">
                        {cat.nome}
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
                onBlur={() => {
                  if (locationName.trim() || address.trim() || city.trim()) {
                    fetchCoordinates(address, city, state, locationName);
                  }
                }}
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
                onBlur={() => {
                  if (address.trim() || city.trim() || locationName.trim()) {
                    fetchCoordinates(address, city, state, locationName);
                  }
                }}
                placeholder="Ex: Av. Paulista, 1000 - Bela Vista"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Estado do Evento *</span>
                  <span className="text-[10px] text-amber-400 font-normal">
                    {isLoadingCidades ? 'Carregando registros...' : `${cidadesList.length} cadastradas na tabela estado`}
                  </span>
                </label>
                <select
                  id="select-register-city"
                  value={selectedCidadeId}
                  disabled={isLoadingCidades && cidadesList.length === 0}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedCidadeId(id);
                    const found = cidadesList.find((c) => c.id === id);
                    if (found) {
                      setCity(found.nome);
                      setState(found.estado);
                      fetchCoordinates(address, found.nome, found.estado, locationName);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer disabled:opacity-50"
                >
                  {isLoadingCidades && cidadesList.length === 0 && (
                    <option value="">Carregando da tabela estado...</option>
                  )}
                  {!isLoadingCidades && cidadesList.length === 0 && (
                    <option value="">Nenhum registro cadastrado na tabela estado</option>
                  )}
                  {cidadesList.map((cid) => (
                    <option key={cid.id} value={cid.id}>
                      {cid.nome} - {cid.estado}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  UF *
                </label>
                <input
                  id="select-register-state"
                  type="text"
                  readOnly
                  value={state}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-bold text-amber-400 text-center cursor-not-allowed focus:outline-none"
                  title="Estado (UF) definido automaticamente pela cidade cadastrada na tabela estado"
                />
              </div>
            </div>

            {/* Geolocation strictly based on event address */}
            <div className="pt-2.5 border-t border-slate-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-200">
                    Coordenadas Baseadas no Endereço do Evento
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => fetchCoordinates(address, city, state, locationName)}
                  disabled={isGeocoding || (!address.trim() && !city.trim() && !locationName.trim())}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer w-fit"
                  title="Consultar coordenadas com base no endereço digitado"
                >
                  {isGeocoding ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      <span>Buscando pelo endereço...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-3.5 h-3.5 text-amber-400" />
                      <span>{latitude && longitude ? 'Recalcular pelo Endereço' : 'Calcular Coordenadas do Endereço'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Status Banner */}
              {latitude && longitude ? (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>
                      <strong>Coordenadas do endereço do evento:</strong> Lat <code className="text-white font-mono bg-emerald-950/60 px-1 py-0.5 rounded">{latitude}</code>, Long <code className="text-white font-mono bg-emerald-950/60 px-1 py-0.5 rounded">{longitude}</code>
                    </span>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:underline"
                  >
                    <span>Conferir Endereço no Mapa</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  📍 O sistema calcula a <strong>latitude</strong> e <strong>longitude</strong> automaticamente com base no <strong>endereço</strong>, <strong>local</strong> e <strong>cidade</strong> do evento informados acima.
                </p>
              )}

              {geocodeInfo && (
                <p className="text-xs text-amber-300/90 mt-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline shrink-0" />
                  <span>{geocodeInfo}</span>
                </p>
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

          {/* Section: Image or Video Media */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <Film className="w-4 h-4" />
                Mídia de Divulgação (Imagem ou Vídeo)
              </h3>
              <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md">
                Escolha o formato ideal
              </span>
            </div>

            {/* Segmented Selector: Imagem vs Vídeo */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setSelectedMediaType('image');
                  setVideoUrl('');
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  selectedMediaType === 'image'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>Cartaz / Flyer Vertical</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedMediaType('video');
                  setImageUrl('');
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  selectedMediaType === 'video'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>Vídeo de Divulgação (MP4)</span>
              </button>
            </div>

            {/* ABA 1: IMAGEM / CARTAZ VERTICAL */}
            {selectedMediaType === 'image' && (
              <div className="space-y-4 animate-fadeIn">
                <p className="text-xs text-slate-300">
                  Envie o cartaz do seu evento no formato vertical ou informe a URL direta de uma imagem na internet:
                </p>

                {/* File Upload Box (Drag and Drop + Click) */}
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

                  {imageUrl && !videoUrl ? (
                    <div className="flex flex-col sm:row items-center justify-center gap-6 p-2">
                      {/* Visualizador Vertical do Cartaz */}
                      <div className="relative w-40 sm:w-48 aspect-[3/4] rounded-2xl overflow-hidden border-2 border-amber-500/50 shadow-2xl bg-slate-950 flex-shrink-0 ring-1 ring-amber-500/30 group">
                        <img
                          src={imageUrl}
                          alt="Cartaz vertical selecionado"
                          className="w-full h-full object-cover sm:object-contain bg-slate-950"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-2 left-2 pointer-events-none">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-950/90 text-emerald-400 border border-emerald-500/30 shadow backdrop-blur-sm">
                            Cartaz Vertical
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col sm:items-start gap-2.5 text-center sm:text-left">
                        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 justify-center sm:justify-start">
                          <CheckCircle2 className="w-4 h-4" />
                          Cartaz anexado com sucesso
                        </span>
                        <p className="text-xs text-slate-300 font-medium">
                          Visualização vertical ativa (ideal para cartazes e folders)
                        </p>
                        <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                          Este cartaz será apresentado verticalmente na página inicial, na busca de eventos e no modal de detalhes completos.
                        </p>
                        <div className="flex gap-2 pt-1">
                          <label
                            htmlFor="input-file-event-image"
                            className="cursor-pointer px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors inline-block"
                          >
                            Trocar foto
                          </label>
                          <button
                            type="button"
                            onClick={() => setImageUrl('')}
                            className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
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
                      className="cursor-pointer flex flex-col items-center justify-center gap-2.5 py-4"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-amber-400 shadow-md">
                        <Upload className="w-7 h-7" />
                      </div>
                      <span className="text-sm font-semibold text-white">
                        Clique para selecionar o cartaz ou arraste o arquivo aqui
                      </span>
                      <span className="text-xs text-amber-300/80 font-medium">
                        Recomendado formato vertical (proporção 3:4 ou 4:5 — padrão cartaz/flyer)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Formatos suportados: JPG, PNG, WEBP
                      </span>
                    </label>
                  )}
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
            )}

            {/* ABA 2: VÍDEO DE DIVULGAÇÃO (APENAS MP4) */}
            {selectedMediaType === 'video' && (
              <div className="space-y-4 animate-fadeIn">
                {/* Dica exclusiva para formato MP4 */}
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2.5">
                  <Video className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-300">Vídeo de Divulgação (Apenas MP4):</span>
                    <p className="text-slate-300 mt-1">
                      Para garantir máxima compatibilidade e reprodução automática, a mídia em vídeo aceita <strong>exclusivamente arquivos no formato MP4 (.mp4)</strong>.
                    </p>
                  </div>
                </div>

                {/* Caixa de Upload do Arquivo MP4 (Drag and Drop + Clique) */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsVideoDragging(true);
                  }}
                  onDragLeave={() => setIsVideoDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsVideoDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleVideoFileSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                    isVideoDragging
                      ? 'border-amber-400 bg-amber-500/10'
                      : 'border-slate-700/80 hover:border-slate-600 bg-slate-950/60'
                  }`}
                >
                  <input
                    id="input-file-event-video"
                    type="file"
                    accept="video/mp4,.mp4"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleVideoFileSelect(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  {videoUrl ? (
                    <div className="flex flex-col items-center justify-center gap-4 p-2">
                      <div className="relative w-full max-w-md aspect-video rounded-2xl overflow-hidden border-2 border-amber-500/50 shadow-2xl bg-black flex-shrink-0 ring-1 ring-amber-500/30">
                        <video
                          key={videoUrl}
                          src={videoUrl}
                          poster={imageUrl || undefined}
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-contain bg-black"
                        >
                          Seu navegador não suporta reprodução de vídeo MP4.
                        </video>
                        <div className="absolute top-2 left-2 pointer-events-none">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-950/90 text-amber-400 border border-amber-500/30 shadow backdrop-blur-sm">
                            Vídeo MP4 Carregado
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-2 text-center">
                        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 justify-center">
                          <CheckCircle2 className="w-4 h-4" />
                          Vídeo MP4 anexado com sucesso
                        </span>
                        <p className="text-[11px] text-slate-400">
                          Este vídeo será exibido diretamente nos detalhes do evento e nas consultas.
                        </p>
                        <div className="flex gap-2 pt-1">
                          <label
                            htmlFor="input-file-event-video"
                            className="cursor-pointer px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors inline-block"
                          >
                            Trocar vídeo MP4
                          </label>
                          <button
                            type="button"
                            onClick={() => setVideoUrl('')}
                            className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remover vídeo
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <label
                      htmlFor="input-file-event-video"
                      className="cursor-pointer flex flex-col items-center justify-center gap-2.5 py-5"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-amber-400 shadow-md">
                        <Video className="w-7 h-7" />
                      </div>
                      <span className="text-sm font-semibold text-white">
                        Clique para selecionar o arquivo MP4 ou arraste aqui
                      </span>
                      <span className="text-xs text-amber-300/90 font-medium">
                        Formato aceito: Exclusivamente arquivo de vídeo MP4 (.mp4)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Até 50MB (ideal para vídeos gravados no celular ou reels exportados em .mp4)
                      </span>
                    </label>
                  )}
                </div>

                {/* Opção alternativa: URL direta para arquivo .mp4 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Link className="w-3.5 h-3.5" />
                    <span>Ou informe a URL direta de um arquivo .mp4 da internet:</span>
                  </label>
                  <input
                    id="input-url-event-video"
                    type="url"
                    value={videoUrl.startsWith('data:video/') ? '' : videoUrl}
                    onChange={(e) => handleVideoUrlChange(e.target.value)}
                    placeholder="https://exemplo.com/meu-video.mp4"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    * A URL deve apontar diretamente para um arquivo de vídeo .mp4
                  </p>
                </div>
              </div>
            )}
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
                  <span>Publicar Evento</span>
                </>
              )}
            </button>
            <p className="text-center text-xs text-amber-300/90 mt-3 flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Registro enviado para análise, prazo 48 horas para liberação</span>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
