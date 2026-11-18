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
import { EventItem, EventCategory, ActiveScreen, Advertiser, CategoryItem, CidadeItem, DEFAULT_CIDADES } from '../types';
import { parseVideoUrl, isVideoFormatUrl } from '../lib/videoUtils';
import { uploadVideoFileToServer } from '../lib/videoUpload';
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
  const [cidadesList, setCidadesList] = useState<CidadeItem[]>(() => 
    propCidadesList && propCidadesList.length > 0 ? propCidadesList : DEFAULT_CIDADES
  );
  const [isLoadingCidades, setIsLoadingCidades] = useState(false);
  const [selectedCidadeId, setSelectedCidadeId] = useState<number | ''>('');
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('');
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
  const [isReadingVideo, setIsReadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number>(0);
  const [videoUploadStatus, setVideoUploadStatus] = useState<string>('');
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
    }
  }, [propCidadesList]);

  // Carrega cidades/estados diretamente da tabela estado do SQLite
  useEffect(() => {
    const fetchCidades = async () => {
      setIsLoadingCidades(true);
      try {
        let res = await fetch('/api/cidades');
        if (!res.ok) {
          res = await fetch('/api/estado');
        }
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setCidadesList(data);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar registros de cidades:', err);
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
    customState = state
  ): Promise<{ latitude: string; longitude: string } | null> => {
    const targetAddr = (customAddr || '').trim();
    const targetCity = (customCity || '').trim();

    if (!targetAddr && !targetCity) {
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
      });

      const response = await fetch(`/api/geocode?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.latitude && data.longitude) {
          const latStr = String(data.latitude);
          const lonStr = String(data.longitude);
          setLatitude(latStr);
          setLongitude(lonStr);

          if (data.addressResolved === false) {
            setGeocodeInfo(`⚠️ Endereço aproximado: Não localizamos o número exato no mapa (preenchido com centro/bairro). Se necessário, digite ou cole as coordenadas corretas nos campos abaixo.`);
          } else {
            const detail = data.displayName ? ` (${data.displayName.split(',').slice(0, 3).join(',')})` : '';
            setGeocodeInfo(`Coordenadas do endereço confirmadas: Lat ${Number(latStr).toFixed(4)}, Lon ${Number(lonStr).toFixed(4)}${detail}`);
          }
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

  // Efeito automático: Sempre que o endereço, cidade ou estado do evento forem alterados,
  // atualiza automaticamente as coordenadas com base no endereço do evento
  useEffect(() => {
    const cleanAddr = address.trim();
    const cleanCity = city.trim();

    if (!cleanAddr && !cleanCity) {
      setLatitude('');
      setLongitude('');
      setGeocodeInfo(null);
      return;
    }

    // Debounce de 700ms para aguardar término da digitação
    const timer = setTimeout(() => {
      fetchCoordinates(cleanAddr, cleanCity, state);
    }, 700);

    return () => clearTimeout(timer);
  }, [address, city, state]);

  const handleFileSelect = (file: File) => {
    const isImage =
      (file.type && file.type.startsWith('image/')) ||
      /\.(jpe?g|png|webp|gif|avif|bmp|svg|jfif|heic|heif|tiff?|ico)$/i.test(file.name || '');

    if (!isImage) {
      setErrorMessage('Por favor, envie um arquivo de imagem válido (PNG, JPEG, JPG, WEBP, GIF, AVIF, BMP, etc.).');
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
          // Preenchimento de segurança para transparência (PNG/WebP/SVG com fundo alfa)
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          // CONVERSÃO AUTOMÁTICA UNIVERSAL: converte qualquer formato de imagem para JPEG otimizado
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
          setImageUrl(compressedBase64);
        } else {
          if (typeof readerEvent.target?.result === 'string') {
            setImageUrl(readerEvent.target.result);
          }
        }
      };
      img.onerror = () => {
        // Fallback robusto se o navegador não renderizar diretamente via Image()
        if (typeof readerEvent.target?.result === 'string') {
          setImageUrl(readerEvent.target.result);
        }
      };
      img.src = readerEvent.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleVideoFileSelect = async (file: File) => {
    const fName = (file.name || '').toLowerCase();
    const isVideo =
      file.type.startsWith('video/') ||
      file.type === 'application/mp4' ||
      file.type === 'application/octet-stream' ||
      fName.endsWith('.mp4') ||
      fName.endsWith('.webm') ||
      fName.endsWith('.mov') ||
      fName.endsWith('.m4v') ||
      fName.endsWith('.3gp') ||
      fName.includes('whatsapp');

    if (!isVideo) {
      setErrorMessage('Formato não permitido. Na mídia de divulgação em vídeo, aceitamos arquivos de vídeo (MP4, WEBM, MOV, M4V).');
      return;
    }
    // Suporte a arquivos de até 80MB
    if (file.size > 80 * 1024 * 1024) {
      setErrorMessage('O arquivo de vídeo ultrapassa 80MB. Por favor, envie um arquivo menor.');
      return;
    }
    setErrorMessage(null);
    setIsReadingVideo(true);
    setVideoUploadProgress(0);
    setVideoUploadStatus('Iniciando envio do vídeo...');

    try {
      const result = await uploadVideoFileToServer(file, (pct, msg) => {
        setVideoUploadProgress(pct);
        if (msg) setVideoUploadStatus(msg);
      });
      setVideoUrl(result.videoUrl);
      if (result.imageUrl && !imageUrl) {
        setImageUrl(result.imageUrl);
      }
      setIsReadingVideo(false);
      setVideoUploadStatus('');
    } catch (uploadErr: any) {
      console.error('Erro no envio de vídeo:', uploadErr);
      setIsReadingVideo(false);
      setVideoUploadProgress(0);
      setVideoUploadStatus('');
      setErrorMessage(
        uploadErr?.message ||
          'Erro ao enviar o arquivo de vídeo para o servidor. Verifique sua conexão e tente novamente.'
      );
    }
  };

  const handleVideoUrlChange = (url: string) => {
    let clean = url.trim();
    if (clean) {
      if (/^(www\.|youtube\.com|youtu\.be|facebook\.com|fb\.watch|instagram\.com|tiktok\.com|vimeo\.com|drive\.google\.com)/i.test(clean)) {
        clean = `https://${clean}`;
      }
      const isMp4 = clean.toLowerCase().split('?')[0].endsWith('.mp4') || clean.startsWith('data:video/') || clean.startsWith('/uploads/') || clean.startsWith('/assets/');
      const isRecognized = clean.includes('youtube.com') || clean.includes('youtu.be') || clean.includes('facebook.com') || clean.includes('fb.watch') || clean.includes('instagram.com') || clean.includes('tiktok.com') || clean.includes('vimeo.com') || clean.includes('drive.google.com') || isMp4 || isVideoFormatUrl(clean);
      if (!isRecognized && !clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('/')) {
        setErrorMessage('Informe uma URL de vídeo válida (.mp4, YouTube, Facebook, Instagram, Google Drive ou Vimeo).');
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
    if (!locationName.trim()) {
      setErrorMessage('Por favor, informe o local do evento.');
      return;
    }
    if (!selectedCidadeId || !city.trim()) {
      setErrorMessage('Por favor, selecione a Cidade do evento.');
      return;
    }
    if (!organizer.trim()) {
      setErrorMessage('Por favor, informe o nome do organizador ou produtora.');
      return;
    }
    if (selectedMediaType === 'video') {
      if (!videoUrl.trim()) {
        setErrorMessage('Por favor, informe o link do vídeo (Facebook, YouTube, Instagram, Google Drive, Vimeo) ou anexe um arquivo MP4.');
        return;
      }
      if (!isVideoFormatUrl(videoUrl)) {
        setErrorMessage('Informe uma URL de vídeo válida (Facebook, YouTube, Instagram, Google Drive, Vimeo) ou envie um arquivo MP4.');
        return;
      }
    } else {
      if (!imageUrl.trim()) {
        setErrorMessage('Por favor, anexe o cartaz oficial do evento (formato vertical) ou digite a URL da imagem da internet.');
        return;
      }
    }

    setIsSubmitting(true);

    // Atualização baseada no endereço do evento: garante coordenadas calculadas a partir do endereço
    let finalLat = latitude.trim();
    let finalLon = longitude.trim();

    if (!finalLat || !finalLon) {
      const detected = await fetchCoordinates(address, city, state);
      if (detected) {
        finalLat = detected.latitude;
        finalLon = detected.longitude;
      }
    }

    if (!finalLat || !finalLon) {
      setIsSubmitting(false);
      setErrorMessage("Erro no endereço: Não foi possível obter as coordenadas de geolocalização (latitude/longitude) para este endereço. Por favor, verifique se o Endereço e Cidade do evento estão corretos para que possamos localizá-lo com precisão no mapa.");
      return;
    }

    const currentCat = availableCategories.find((c) => c.id === selectedCategoryId);
    const resolvedCatName = (currentCat ? currentCat.nome : category) as EventCategory;
    const resolvedCatId = currentCat ? currentCat.id : selectedCategoryId;

    const eventUniqueId = `user-${Date.now()}`;
    let finalVideoUrlToSubmit = videoUrl.trim() || undefined;

    // Se o vídeo for grande (> ~400KB em arquivo), envia fisicamente ao servidor antes de publicar;
    // vídeos pequenos (<= 560KB em Base64) seguem direto em Base64 para persistir no SQLite e atravessar o Firestore.
    if (selectedMediaType === 'video' && finalVideoUrlToSubmit && finalVideoUrlToSubmit.startsWith('data:video/') && finalVideoUrlToSubmit.length > 560000) {
      try {
        const upRes = await fetch('/api/upload/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: finalVideoUrlToSubmit, eventId: eventUniqueId }),
        });
        if (upRes.ok) {
          const upJson = await upRes.json();
          if (upJson.videoUrl) {
            finalVideoUrlToSubmit = upJson.videoUrl;
          }
        }
      } catch (upErr) {
        console.warn('Erro ao pré-salvar vídeo em disco:', upErr);
      }
    }

    const newEvent: EventItem = {
      id: eventUniqueId,
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
      imageUrl: imageUrl.trim() || '',
      mediaType: selectedMediaType,
      videoUrl: finalVideoUrlToSubmit,
      url: finalVideoUrlToSubmit || imageUrl.trim() || undefined,
      organizer: organizer.trim(),
      contact: contact.trim() || undefined,
      tags: [resolvedCatName],
      featured: false,
      estadoId: selectedCidadeId ? Number(selectedCidadeId) : undefined,
      estado_id: selectedCidadeId ? Number(selectedCidadeId) : undefined,
      createdAt: new Date().toISOString(),
    };

    try {
      setToastNotice('Evento cadastrado com sucesso! Já disponível para consulta.');
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
                  {submittedEvent.isFree ? 'Gratuito' : (submittedEvent.price ? `A partir de R$ ${submittedEvent.price.toFixed(2).replace('.', ',')}` : (submittedEvent.priceDetails || 'Consulte'))}
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
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
            Estado de São Paulo (SP)
          </span>
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
              <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap mt-0.5">
                <span>Logado como: <span className="text-slate-300 font-medium">{currentAdvertiser.email}</span></span>
                {currentAdvertiser.phone && (
                  <span>• Tel/WhatsApp: <span className="text-slate-300 font-mono">{currentAdvertiser.phone}</span></span>
                )}
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

      {/* Banner de Plataforma Exclusiva Estado de São Paulo */}
      <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
        <span className="text-2xl shrink-0">📍</span>
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-amber-300">
            Plataforma Exclusiva para o Estado de São Paulo (SP)
          </h4>
          <p className="text-xs text-slate-300 mt-0.5">
            Cadastre eventos, shows, bailes e apresentações que acontecem nos municípios do Estado de São Paulo.
          </p>
        </div>
      </div>

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
                placeholder="Ex: Espaço Unimed, Audio Club, Tokio Marine Hall, Clube Juventus..."
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
                  if (address.trim() || city.trim()) {
                    fetchCoordinates(address, city, state);
                  }
                }}
                placeholder="Ex: Av. Francisco Matarazzo, 694 - Água Branca"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Cidade do Evento (Estado de São Paulo) *</span>
                  <span className="text-[10px] text-amber-400 font-normal">
                    {cidadesList.length} cidades em SP
                  </span>
                </label>

                {/* Quick chips para selecionar com 1 toque */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {['Praia Grande', 'Santos', 'São Paulo', 'Santo André'].map((qName) => {
                    const found = cidadesList.find((c) => c.nome.toLowerCase() === qName.toLowerCase());
                    const isSelected = found && selectedCidadeId === found.id;
                    return (
                      <button
                        key={`event-quick-${qName}`}
                        type="button"
                        onClick={() => {
                          if (found) {
                            setSelectedCidadeId(found.id);
                            setCity(found.nome);
                            setState(found.estado);
                            fetchCoordinates(address, found.nome, found.estado);
                          }
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {qName}
                      </button>
                    );
                  })}
                </div>

                <div className="relative">
                  <select
                    id="select-register-city"
                    value={selectedCidadeId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setSelectedCidadeId('');
                        setCity('');
                        setState('');
                        return;
                      }
                      const id = Number(val);
                      setSelectedCidadeId(id);
                      const found = cidadesList.find((c) => c.id === id);
                      if (found) {
                        setCity(found.nome);
                        setState(found.estado);
                        fetchCoordinates(address, found.nome, found.estado);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer appearance-none pr-9"
                  >
                    <option value="" className="bg-slate-900 text-slate-400">
                      Selecione a Cidade do Evento...
                    </option>
                    {cidadesList.map((cid) => (
                      <option key={cid.id} value={cid.id} className="bg-slate-900 text-white">
                        {cid.nome} - {cid.estado}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
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
                  onClick={() => fetchCoordinates(address, city, state)}
                  disabled={isGeocoding || (!address.trim() && !city.trim())}
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

              {/* Status Banner com Formulário de Edição Manual */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Latitude (Auto-gerada ou digite manualmente)
                  </label>
                  <input
                    type="text"
                    value={latitude}
                    onChange={(e) => {
                      setLatitude(e.target.value);
                      setGeocodeInfo('Coordenadas editadas manualmente pelo usuário.');
                    }}
                    placeholder="Ex: -23.5356"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Longitude (Auto-gerada ou digite manualmente)
                  </label>
                  <input
                    type="text"
                    value={longitude}
                    onChange={(e) => {
                      setLongitude(e.target.value);
                      setGeocodeInfo('Coordenadas editadas manualmente pelo usuário.');
                    }}
                    placeholder="Ex: -46.6269"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              {latitude && longitude && (
                <div className="mt-3 flex items-center justify-end">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:underline"
                  >
                    <span>Conferir Endereço no Mapa</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {geocodeInfo ? (
                <p className="text-xs text-amber-300/90 mt-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline shrink-0" />
                  <span>{geocodeInfo}</span>
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 leading-relaxed mt-2">
                  📍 O sistema calcula a <strong>latitude</strong> e <strong>longitude</strong> automaticamente com base no seu <strong>endereço</strong>. Se preferir, você pode digitar ou colar as coordenadas de sua preferência nos campos acima.
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
                    accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.avif,.bmp,.svg,.jfif,.heic,.heif,.tiff"
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
                    type="text"
                    value={imageUrl.startsWith('data:') ? '' : imageUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      setImageUrl(val);
                      const clean = val.trim();
                      const lower = clean.toLowerCase();
                      if (lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('facebook.com') || lower.includes('fb.watch') || lower.includes('instagram.com') || lower.includes('drive.google.com') || lower.includes('vimeo.com') || lower.endsWith('.mp4') || lower.includes('.mp4?') || lower.startsWith('/uploads/') || lower.startsWith('/assets/') || lower.startsWith('data:video/')) {
                        setSelectedMediaType('video');
                        setVideoUrl(clean);
                        const parsed = parseVideoUrl(clean);
                        if (parsed?.thumbnailUrl) {
                          setImageUrl(parsed.thumbnailUrl);
                        }
                      }
                    }}
                    placeholder="https://exemplo.com/cartaz-evento.jpg (PNG, JPG, WebP, GIF, etc.)"
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
                    <span className="font-bold text-amber-300">Vídeo de Divulgação (MP4, WEBM, MOV ou Redes Sociais):</span>
                    <p className="text-slate-300 mt-1">
                      Envie o arquivo do seu vídeo (gravado no celular ou reels) ou informe o link do YouTube, Facebook ou Instagram.
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
                    accept="video/*,.mp4,.mov,.webm,.m4v"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleVideoFileSelect(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  {isReadingVideo ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-6 px-4 max-w-md mx-auto">
                      <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm font-bold text-amber-300">
                        Enviando e salvando vídeo{videoUploadProgress > 0 ? ` (${videoUploadProgress}%)` : '...'}
                      </span>
                      <progress
                        value={videoUploadProgress}
                        max={100}
                        className="w-full h-2.5 rounded-full overflow-hidden bg-slate-800 [&::-webkit-progress-bar]:bg-slate-800 [&::-webkit-progress-value]:bg-amber-500 [&::-webkit-progress-value]:transition-all [&::-webkit-progress-value]:duration-300 [&::-moz-progress-bar]:bg-amber-500"
                      />
                      <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3.5 py-2.5 text-center space-y-1">
                        <p className="text-xs font-bold text-amber-200">
                          {videoUploadStatus || 'Aguarde o término do carregamento...'}
                        </p>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Não feche nem atualize esta página. Nos últimos passos (80%–99%), o sistema está gravando o vídeo com segurança no servidor e pode levar alguns segundos.
                        </p>
                      </div>
                    </div>
                  ) : videoUrl ? (
                    <div className="flex flex-col items-center justify-center gap-4 p-2">
                      <div className="relative w-full max-w-md rounded-2xl overflow-hidden border-2 border-amber-500/50 shadow-2xl bg-black flex-shrink-0 ring-1 ring-amber-500/30">
                        <VideoPlayer
                          videoUrl={videoUrl}
                          title={title || 'Pré-visualização do Vídeo'}
                          autoPlay={false}
                          className="w-full aspect-video"
                        />
                        <div className="absolute top-2 left-2 z-20 pointer-events-none">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-950/90 text-amber-400 border border-amber-500/30 shadow backdrop-blur-sm">
                            Vídeo Carregado
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-2 text-center">
                        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 justify-center">
                          <CheckCircle2 className="w-4 h-4" />
                          Vídeo anexado com sucesso
                        </span>
                        <p className="text-[11px] text-slate-400">
                          Este vídeo será exibido diretamente nos detalhes do evento e nas consultas.
                        </p>
                        <div className="flex gap-2 pt-1">
                          <label
                            htmlFor="input-file-event-video"
                            className="cursor-pointer px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors inline-block"
                          >
                            Trocar vídeo
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
                        Clique para selecionar o arquivo de vídeo ou arraste aqui
                      </span>
                      <span className="text-xs text-amber-300/90 font-medium">
                        Formatos aceitos: MP4, WEBM, MOV (gravados no celular ou reels)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Até 50MB
                      </span>
                    </label>
                  )}
                </div>

                {/* Opção alternativa: Link de vídeo ou URL direta */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Link className="w-3.5 h-3.5" />
                    <span>Ou informe o link do vídeo (Facebook, YouTube, Instagram, Google Drive, Vimeo ou MP4):</span>
                  </label>
                  <input
                    id="input-url-event-video"
                    type="text"
                    value={videoUrl.startsWith('data:video/') ? '' : videoUrl}
                    onChange={(e) => handleVideoUrlChange(e.target.value)}
                    placeholder="Cole o link do Facebook, YouTube, Instagram, Google Drive..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    * Aceitamos links de vídeos do Facebook, YouTube, Instagram, Google Drive, Vimeo ou arquivos diretos .mp4
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
