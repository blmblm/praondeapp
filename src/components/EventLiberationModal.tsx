import React, { useState, useEffect, useRef } from 'react';
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
  Sparkles,
  CheckCheck,
  Tag,
  Save,
  RefreshCw,
  Edit3,
  Trash2,
  Layers,
  Search,
  Info,
  ChevronDown,
  ChevronUp,
  Table,
  Play,
  Video,
  Film,
  Link as LinkIcon,
  Upload,
  Copy,
  Globe,
  FileVideo
} from 'lucide-react';
import { EventItem, CategoryItem } from '../types';
import { uploadVideoFileToServer } from '../lib/videoUpload';
import { VideoPlayer } from './VideoPlayer';

interface EventLiberationModalProps {
  isOpen: boolean;
  event: EventItem | null;
  categories?: string[];
  categoryItems?: CategoryItem[];
  onClose: () => void;
  onSaveLiberation: (id: string, liberado: 'S' | 'N', newCategory?: string, updatedUrl?: string, urlType?: 'video' | 'image' | 'link') => Promise<void> | void;
  onUpdateCategory?: (id: string, newCategory: string, newCategoryId?: number) => Promise<boolean | void> | boolean | void;
  onUpdateUrl?: (id: string, newUrl: string, urlType: 'video' | 'image' | 'link') => Promise<boolean | void> | boolean | void;
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
  categories = [],
  categoryItems = [],
  onClose,
  onSaveLiberation,
  onUpdateCategory,
  onUpdateUrl,
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
  const [mediaTab, setMediaTab] = useState<'image' | 'video'>('image');

  // Determina se uma URL possui formato característico de vídeo
  const isVideoFormatUrl = (u?: string | null): boolean => {
    if (!u) return false;
    const t = u.trim().toLowerCase();
    // Se for imagem, NUNCA é vídeo
    if (
      t.startsWith('data:image/') ||
      t.startsWith('/uploads/images/') ||
      t.startsWith('./uploads/images/') ||
      t.startsWith('/assets/images/') ||
      /\.(jpe?g|png|webp|gif|svg|avif|bmp|jfif|heic|heif|tiff?|ico)($|\?|#)/i.test(t)
    ) {
      return false;
    }
    return (
      t.startsWith('data:video/') ||
      t.startsWith('data:application/octet-stream') ||
      t.startsWith('blob:') ||
      t.startsWith('/uploads/videos/') ||
      t.startsWith('./uploads/videos/') ||
      t.includes('youtube.com') ||
      t.includes('youtu.be') ||
      t.includes('facebook.com') ||
      t.includes('fb.watch') ||
      t.includes('fb.') ||
      t.includes('fbcdn.net') ||
      t.includes('instagram.com') ||
      t.includes('tiktok.com') ||
      t.includes('vimeo.com') ||
      t.includes('drive.google.com') ||
      /\.(mp4|webm|ogg|mov|m4v|mkv|3gp)($|\?|#)/i.test(t) ||
      /video\/mp4/i.test(t)
    );
  };

  // Estados para Campo URL (Vídeo / Imagem / Link) nas tabelas correspondentes
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [urlType, setUrlType] = useState<'video' | 'image' | 'link'>('video');
  const [isUrlActive, setIsUrlActive] = useState(false);
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [urlSaveNotice, setUrlSaveNotice] = useState<string | null>(null);
  const [urlErrorNotice, setUrlErrorNotice] = useState<string | null>(null);
  const [updatedTablesList, setUpdatedTablesList] = useState<string[]>([]);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number>(0);
  const [videoUploadStatus, setVideoUploadStatus] = useState<string>('');
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const urlSectionRef = useRef<HTMLDivElement | null>(null);

  // URL ativa para exibição do vídeo (prioriza o que foi carregado/editado no campo de URL, ou event.videoUrl, ou event.url)
  const activeVideoUrl = React.useMemo(() => {
    if (urlType === 'video' && currentUrl.trim()) {
      return currentUrl.trim();
    }
    if (currentUrl.trim() && isVideoFormatUrl(currentUrl)) {
      return currentUrl.trim();
    }
    if (event?.videoUrl && event.videoUrl.trim()) {
      return event.videoUrl.trim();
    }
    if (event?.url && isVideoFormatUrl(event.url)) {
      return event.url.trim();
    }
    return '';
  }, [urlType, currentUrl, event?.videoUrl, event?.url]);

  const hasVideo = Boolean(activeVideoUrl);

  // URL ativa para imagem/cartaz
  const activeImageUrl = React.useMemo(() => {
    if (urlType === 'image' && currentUrl.trim()) {
      return currentUrl.trim();
    }
    if (event?.imageUrl && event.imageUrl.trim()) {
      return event.imageUrl.trim();
    }
    if (event?.url && !isVideoFormatUrl(event.url)) {
      return event.url.trim();
    }
    return event?.imageUrl || '';
  }, [urlType, currentUrl, event?.imageUrl, event?.url]);

  useEffect(() => {
    // Se o evento possui vídeo cadastrado ou ativo, abre diretamente na aba de Vídeo para conferência imediata
    if (hasVideo) {
      setMediaTab('video');
    } else {
      setMediaTab('image');
    }
  }, [event?.id, hasVideo]);

  // Estados para Conferência e Alteração de Categoria solicitados pelo usuário
  const [selectedCategory, setSelectedCategory] = useState<string>('Shows');
  const [isCategoryActive, setIsCategoryActive] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [categorySaveNotice, setCategorySaveNotice] = useState<string | null>(null);

  // Estados para itens da tabela de categorias (do SQLite / Firestore / API)
  const [tableCategories, setTableCategories] = useState<CategoryItem[]>(categoryItems || []);
  const [showCategoryTableModal, setShowCategoryTableModal] = useState(false);
  const [showCategoryTableInline, setShowCategoryTableInline] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  const categorySelectRef = useRef<HTMLSelectElement | null>(null);
  const categorySectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!event) return;
    const initialUrl = event.videoUrl || (event.url && !event.url.startsWith('data:image/') ? event.url : '') || event.imageUrl || '';
    setCurrentUrl(initialUrl);

    const isVid = Boolean(
      event.videoUrl ||
      event.mediaType === 'video' ||
      initialUrl.includes('youtube') ||
      initialUrl.includes('youtu.be') ||
      initialUrl.includes('facebook') ||
      initialUrl.includes('fb.watch') ||
      initialUrl.includes('.mp4') ||
      initialUrl.startsWith('data:video/')
    );
    const isImg = !isVid && Boolean(
      event.imageUrl ||
      (event as any).imagem_url ||
      initialUrl.startsWith('data:image/') ||
      initialUrl.startsWith('/uploads/images/') ||
      /\.(jpe?g|png|webp|gif|svg|avif|bmp|jfif|heic|heif|tiff?|ico)($|\?|#)/i.test(initialUrl) ||
      initialUrl.includes('.jpg') ||
      initialUrl.includes('.jpeg') ||
      initialUrl.includes('.png') ||
      initialUrl.includes('.webp') ||
      initialUrl.includes('.gif') ||
      initialUrl.includes('.avif') ||
      initialUrl.includes('.bmp') ||
      initialUrl.includes('.svg')
    );

    setUrlType(isVid ? 'video' : isImg ? 'image' : 'link');
    setIsUrlActive(false);
    setUrlSaveNotice(null);
    setUrlErrorNotice(null);
    setUpdatedTablesList([]);
  }, [event?.id, event?.videoUrl, event?.url, event?.imageUrl, event?.mediaType]);

  // Carrega as categorias diretamente da tabela SQLite / API ao abrir o modal
  const fetchTableCategories = async () => {
    try {
      setIsLoadingCategories(true);
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setTableCategories(data);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar itens da tabela de categorias:', err);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTableCategories();
    }
  }, [isOpen]);

  useEffect(() => {
    if (categoryItems && categoryItems.length > 0) {
      setTableCategories(categoryItems);
    }
  }, [categoryItems]);

  // Lista consolidada de categorias disponíveis EXCLUSIVAMENTE a partir da tabela categorias (SQLite/Firestore, com fallback se vazio)
  const availableCategoryList = React.useMemo<CategoryItem[]>(() => {
    const map = new Map<string, CategoryItem>();

    // Apenas os itens oficiais da tabela de categorias (ativa !== false)
    tableCategories.forEach((ci) => {
      const name = (ci.nome || (ci as any).name || '').trim();
      if (name && name.toLowerCase() !== 'categoria' && ci.ativa !== false) {
        map.set(name.toLowerCase(), {
          id: ci.id,
          nome: name,
          descricao: (ci.descricao || '').trim(),
          ativa: true,
          criadoEm: ci.criadoEm,
        });
      }
    });

    // Se estiver vazia (sem dados de banco ainda), aplica o fallback para alinhar com a tela de cadastro
    if (map.size === 0) {
      const fallbacks = [
        'Shows',
        'Samba e Pagode',
        'Baile Nostalgia',
        'Baile Terceira Idade',
        'Forró',
        'Forró Pé de Serra',
        'Festas'
      ];
      fallbacks.forEach((name, index) => {
        map.set(name.toLowerCase(), {
          id: 100 + index,
          nome: name,
          descricao: `Categoria ${name}`,
          ativa: true
        });
      });
    }

    // Ordena alfabeticamente pelo nome da categoria (itens que não constam na tabela foram excluídos)
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [tableCategories]);

  // Verifica se a categoria atual do evento existe na tabela oficial de categorias
  const isEventCatInTable = React.useMemo(() => {
    if (!event?.category) return false;
    const norm = event.category.trim().toLowerCase();
    return availableCategoryList.some((c) => c.nome.toLowerCase().trim() === norm);
  }, [event?.category, availableCategoryList]);

  // Lista consolidada de nomes de categorias
  const availableCategories = React.useMemo(() => {
    return availableCategoryList.map((c) => c.nome);
  }, [availableCategoryList]);

  // Objeto da categoria selecionada atualmente
  const currentSelectedCatObj = React.useMemo(() => {
    const sel = (selectedCategory || '').trim().toLowerCase();
    return availableCategoryList.find((c) => c.nome.toLowerCase() === sel);
  }, [selectedCategory, availableCategoryList]);

  // Lista de categorias filtradas para pesquisa na tabela (apenas nome e descrição, sem ID)
  const filteredCategoryItems = React.useMemo(() => {
    if (!categorySearchQuery.trim()) return availableCategoryList;
    const q = categorySearchQuery.toLowerCase().trim();
    return availableCategoryList.filter((c) => {
      const matchName = c.nome.toLowerCase().includes(q);
      const matchDesc = (c.descricao || '').toLowerCase().includes(q);
      return matchName || matchDesc;
    });
  }, [availableCategoryList, categorySearchQuery]);

  useEffect(() => {
    if (event) {
      // Pré-seleciona 'S' para que o botão Confirmar Liberação já esteja pronto para salvar com 'S'
      setSelectedLiberado('S');
      setSelectedCategory(event.category || 'Shows');
      setIsSaving(false);
      setSaveFeedback(null);
      setIsZoomed(false);
      setImgError(false);
      setIsCategoryActive(false);
      setIsSavingCategory(false);
      setCategorySaveNotice(null);
      setShowCategoryTableModal(false);
      setShowCategoryTableInline(false);
      setCategorySearchQuery('');
    }
  }, [event]);

  if (!isOpen || !event) return null;

  // Ao clicar na imagem da análise, ativa o campo de categoria para conferência e alteração
  const handleImageAnalysisClick = () => {
    setIsZoomed((prev) => !prev);
    setIsCategoryActive(true);
    setCategorySaveNotice(null);
    categorySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => {
      categorySelectRef.current?.focus();
    }, 150);
  };

  // Selecionar categoria a partir da tabela e salvar no banco de dados imediatamente
  const handleSelectCategoryFromTable = async (cat: CategoryItem) => {
    setSelectedCategory(cat.nome);
    setIsCategoryActive(true);
    setShowCategoryTableModal(false);
    setCategorySaveNotice(`Salvando categoria "${cat.nome}"...`);

    if (!event) return;
    setIsSavingCategory(true);
    try {
      let success = false;
      if (onUpdateCategory) {
        const res = await onUpdateCategory(event.id, cat.nome, cat.id);
        success = res !== false;
      } else {
        const res = await fetch(`/api/events/${event.id}/category`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: cat.nome, categoryId: cat.id }),
        });
        const json = await res.json();
        success = res.ok && json.success;
      }

      if (success) {
        event.category = cat.nome;
        setCategorySaveNotice(`Categoria alterada para "${cat.nome}" com sucesso!`);
        setTimeout(() => setCategorySaveNotice(null), 4000);
      } else {
        setCategorySaveNotice('Não foi possível salvar a alteração da categoria.');
      }
    } catch (err) {
      console.error('Erro ao salvar categoria:', err);
      setCategorySaveNotice('Erro ao alterar a categoria.');
    } finally {
      setIsSavingCategory(false);
    }
  };

  // Salvar alteração avulsa de categoria
  const handleSaveCategoryOnly = async () => {
    if (!event || !selectedCategory || selectedCategory === event.category) return;
    setIsSavingCategory(true);
    setCategorySaveNotice(null);

    const catObj = availableCategoryList.find((c) => c.nome.toLowerCase() === selectedCategory.toLowerCase());

    try {
      let success = false;
      if (onUpdateCategory) {
        const res = await onUpdateCategory(event.id, selectedCategory, catObj?.id);
        success = res !== false;
      } else {
        const res = await fetch(`/api/events/${event.id}/category`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: selectedCategory, categoryId: catObj?.id }),
        });
        const json = await res.json();
        success = res.ok && json.success;
      }

      if (success) {
        setCategorySaveNotice(`Categoria "${selectedCategory}" salva com sucesso no banco de dados!`);
        setTimeout(() => setCategorySaveNotice(null), 4000);
      } else {
        setCategorySaveNotice('Não foi possível salvar a alteração da categoria.');
      }
    } catch (err) {
      console.error('Erro ao salvar categoria:', err);
      setCategorySaveNotice('Erro ao salvar alteração da categoria.');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleSaveUrlOnly = async () => {
    if (!event) return;
    const clean = currentUrl.trim();
    setIsSavingUrl(true);
    setUrlSaveNotice(null);
    setUrlErrorNotice(null);

    try {
      let targetTables: string[] = ['eventos'];
      if (event.category) {
        targetTables.push(`eventos_${event.category.toLowerCase().replace(/[^a-z0-9]/g, '_')}`);
      }
      if (event.isQuarantine) {
        targetTables.push('eventos_importados');
      }

      if (onUpdateUrl) {
        await onUpdateUrl(event.id, clean, urlType);
      } else {
        const res = await fetch(`/api/events/${event.id}/url`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            url: clean, 
            urlType, 
            imageUrl: urlType === 'image' || clean.startsWith('data:image/') ? clean : undefined 
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Erro ao atualizar campo URL');
        }
        if (data.updatedTables && data.updatedTables.length > 0) {
          targetTables = data.updatedTables;
        }
      }

      setUpdatedTablesList(targetTables);

      // Atualiza o objeto event localmente para refletir no player/imagem de imediato
      const isVid = urlType === 'video' || isVideoFormatUrl(clean);
      if (isVid) {
        event.videoUrl = clean;
        event.url = clean;
        event.mediaType = 'video';
        setMediaTab('video');
      } else if (urlType === 'image') {
        event.imageUrl = clean;
        event.mediaType = 'image';
        setMediaTab('image');
      }
      event.url = clean;

      setUrlSaveNotice(`Campo URL atualizado com sucesso nas tabelas correspondentes (${targetTables.join(', ')})!`);
      setTimeout(() => setUrlSaveNotice(null), 4500);
    } catch (err: any) {
      console.error('Erro ao atualizar URL:', err);
      setUrlErrorNotice(err.message || 'Falha ao atualizar campo URL nas tabelas correspondentes.');
    } finally {
      setIsSavingUrl(false);
    }
  };

  const handleVideoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      setUrlErrorNotice('Por favor selecione um arquivo de vídeo válido (.mp4, .mov, etc.)');
      return;
    }

    if (file.size > 80 * 1024 * 1024) {
      setUrlErrorNotice('O vídeo ultrapassa 80MB. Por favor envie um vídeo menor.');
      return;
    }

    setIsUploadingVideo(true);
    setVideoUploadProgress(0);
    setVideoUploadStatus('Iniciando envio do vídeo...');
    setUrlErrorNotice(null);

    try {
      const data = await uploadVideoFileToServer(file, (pct, msg) => {
        setVideoUploadProgress(pct);
        if (msg) setVideoUploadStatus(msg);
      });
      setCurrentUrl(data.videoUrl);
      if (data.imageUrl && event) {
        event.imageUrl = data.imageUrl;
      }
      setUrlType('video');
      setIsUrlActive(true);
      setMediaTab('video');
      setIsUploadingVideo(false);
      setVideoUploadStatus('');
      setUrlSaveNotice(`Arquivo "${file.name}" salvo de forma permanente! Clique em "Atualizar URL nas Tabelas" para vincular ao evento.`);
    } catch (err: any) {
      setIsUploadingVideo(false);
      setVideoUploadProgress(0);
      setVideoUploadStatus('');
      setUrlErrorNotice(err?.message || 'Erro ao enviar arquivo de vídeo para o servidor.');
    }
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUrlErrorNotice('Por favor selecione um arquivo de imagem válido (PNG, JPG, JPEG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64Img = reader.result as string;
      setCurrentUrl(base64Img);
      setUrlType('image');
      setIsUrlActive(true);
      setMediaTab('image');
      if (event) {
        event.imageUrl = base64Img;
        event.url = base64Img;
        event.mediaType = 'image';
      }
      setUrlSaveNotice(`Cartaz "${file.name}" selecionado! Clique no botão "Atualizar URL nas Tabelas" para salvar de forma permanente.`);
    };
    reader.onerror = () => {
      setUrlErrorNotice('Erro ao ler o arquivo de imagem.');
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmLiberation = async (statusOverride?: 'S' | 'N') => {
    const statusToSave = statusOverride || selectedLiberado;
    setIsSaving(true);
    setSaveFeedback(null);
    setSelectedLiberado(statusToSave);

    try {
      // 1. Se a categoria foi modificada pelo moderador e ainda não salva, salva agora junto com a liberação
      const categoryToPass = selectedCategory !== event.category ? selectedCategory : undefined;
      const catObj = availableCategoryList.find((c) => c.nome.toLowerCase() === selectedCategory.toLowerCase());
      if (categoryToPass && onUpdateCategory) {
        await onUpdateCategory(event.id, categoryToPass, catObj?.id);
      }

      // 2. Na tela liberar evento: gravar o campo URL no arquivo de lançamento quando for vídeo
      const cleanUrl = currentUrl.trim();
      const isVideo = urlType === 'video' || isVideoFormatUrl(cleanUrl) || isVideoFormatUrl(event.videoUrl) || isVideoFormatUrl(event.url) || event.mediaType === 'video';
      const effectiveVideoUrl = (cleanUrl && isVideoFormatUrl(cleanUrl) ? cleanUrl : '') || (event.videoUrl ? event.videoUrl.trim() : '') || (event.url && isVideoFormatUrl(event.url) ? event.url.trim() : '') || cleanUrl;

      if (isVideo && effectiveVideoUrl) {
        try {
          const effectiveImg = activeImageUrl || event.imageUrl || '';
          if (onUpdateUrl) {
            await onUpdateUrl(event.id, effectiveVideoUrl, 'video');
          } else {
            await fetch(`/api/events/${event.id}/url`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: effectiveVideoUrl,
                urlType: 'video',
                imageUrl: effectiveImg || undefined
              }),
            });
          }
          event.videoUrl = effectiveVideoUrl;
          event.url = effectiveVideoUrl;
          event.mediaType = 'video';
          if (effectiveImg) {
            event.imageUrl = effectiveImg;
          }
        } catch (uErr) {
          console.warn('Erro ao gravar campo URL de vídeo na liberação:', uErr);
        }
      } else if (
        cleanUrl !== '' &&
        !cleanUrl.startsWith('/api/event-poster/') &&
        cleanUrl !== (event.url || event.imageUrl || '')
      ) {
        try {
          if (onUpdateUrl) {
            await onUpdateUrl(event.id, cleanUrl, urlType);
          } else {
            await fetch(`/api/events/${event.id}/url`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: cleanUrl, urlType }),
            });
          }
          if (urlType === 'image') {
            event.imageUrl = cleanUrl;
            event.mediaType = 'image';
          }
          event.url = cleanUrl;
        } catch (uErr) {
          console.warn('Erro ao atualizar URL no handleConfirmLiberation:', uErr);
        }
      }

      const safeCleanUrl = cleanUrl;
      const finalUrlToSave = isVideo ? (effectiveVideoUrl || safeCleanUrl) : safeCleanUrl;
      const finalUrlType = isVideo ? 'video' : urlType;

      // 3. Timeout de segurança de 2.5s para impedir que qualquer lentidão externa trave o botão
      const savePromise = Promise.resolve(onSaveLiberation(event.id, statusToSave, selectedCategory, finalUrlToSave, finalUrlType));
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2500));
      await Promise.race([savePromise, timeoutPromise]);

      setSaveFeedback({
        type: 'success',
        msg: statusToSave === 'S' 
          ? `Evento liberado com sucesso! Categoria: "${selectedCategory}". O campo liberado foi atualizado com "S".`
          : 'Evento cancelado e excluído com sucesso da lista de liberação.',
      });

      setTimeout(() => {
        setIsSaving(false);
        // Se houver próximo evento pendente, avança automaticamente; senão fecha o modal
        if (hasNext && onNextEvent) {
          onNextEvent();
        } else {
          onClose();
        }
      }, 700);
    } catch (err) {
      console.warn('Erro ao salvar liberação:', err);
      setSaveFeedback({
        type: 'error',
        msg: 'Erro ao atualizar campo liberado no cadastro. Tente novamente.',
      });
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
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Main Modal Card */}
      <div 
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 max-h-[94vh]"
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
                {event.isQuarantine && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Quarentena Sympla
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Clique na imagem para ampliar e conferir a categoria correspondente ao cartaz
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

          {/* Grid Layout: Left = Image Preview & Category Conference / Right = Info & Decision */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* LEFT COLUMN: Visualização da Imagem para Análise e Campo de Categoria */}
            <div className="lg:col-span-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  {event.videoUrl ? (
                    <>
                      <Play className="w-3.5 h-3.5 text-purple-400" />
                      Mídia do Evento (Vídeo / Cartaz)
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                      Cartaz do Evento (Clique para Analisar)
                    </>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleImageAnalysisClick}
                    className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer font-medium px-2 py-1 rounded-lg bg-slate-900 border border-slate-700"
                    title="Clique para ampliar a imagem e trazer a conferência de categoria"
                  >
                    <ZoomIn className="w-3 h-3" />
                    <span>{isZoomed ? 'Modo Normal' : 'Zoom'}</span>
                  </button>

                  <button
                    type="button"
                    id="btn-grid-cancelar-imagem"
                    onClick={onClose}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                    title="Fechar análise do evento"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Fechar</span>
                  </button>
                </div>
              </div>

              {/* Selector between Image and Video if video is available */}
              {hasVideo && (
                <div className="flex items-center gap-2 mb-2 bg-slate-950 p-1 rounded-xl border border-purple-500/40 shadow-md">
                  <button
                    type="button"
                    onClick={() => setMediaTab('video')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      mediaTab === 'video'
                        ? 'bg-purple-600 text-white shadow-md ring-1 ring-purple-400'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Vídeo de Divulgação (MP4/Link)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMediaTab('image')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      mediaTab === 'image'
                        ? 'bg-amber-500 text-slate-950 shadow-md ring-1 ring-amber-400'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Cartaz / Imagem</span>
                  </button>
                </div>
              )}

              {/* Video Player or Image Card Container */}
              {hasVideo && mediaTab === 'video' ? (
                <div className="w-full">
                  <VideoPlayer key={activeVideoUrl} videoUrl={activeVideoUrl} title={event.title} />
                </div>
              ) : (
                /* Image Card Container */
                <div 
                  className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 flex flex-col items-center justify-center min-h-[260px] max-h-[460px] group shadow-inner cursor-pointer"
                  onClick={handleImageAnalysisClick}
                  title="Clique na imagem para ampliar e conferir a categoria"
                >
                  {imgError ? (
                    <div className="p-8 text-center space-y-2">
                      <ImageIcon className="w-12 h-12 text-slate-600 mx-auto" />
                      <p className="text-xs text-rose-400 font-semibold">Não foi possível carregar a imagem</p>
                      <p className="text-[11px] text-slate-500 max-w-xs break-all">{activeImageUrl || event.imageUrl}</p>
                    </div>
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                      <img
                        key={activeImageUrl || event.imageUrl}
                        src={activeImageUrl || event.imageUrl}
                        alt={event.title}
                        referrerPolicy="no-referrer"
                        onError={() => setImgError(true)}
                        className={`object-contain w-full transition-transform duration-300 ${
                          isZoomed ? 'scale-125 cursor-zoom-out' : 'max-h-[380px] cursor-zoom-in'
                        }`}
                      />
                      
                      {/* Floating pill with Category (clicável para abrir a tabela de categorias e conferência) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCategoryActive(true);
                          setShowCategoryTableModal(true);
                          categorySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }}
                        className="absolute top-2.5 left-2.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-950/90 text-amber-300 border border-amber-500/40 backdrop-blur-md shadow-md flex items-center gap-2 hover:bg-amber-500/20 hover:border-amber-400 transition-all cursor-pointer group/pill z-10 max-w-[85%]"
                        title="Clique para conferir a categoria com os itens da tabela de categoria"
                      >
                        <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate font-bold">{selectedCategory || event.category || 'Sem Categoria'}</span>
                        <span className="text-[9px] bg-amber-400/20 text-amber-200 border border-amber-400/40 px-1.5 py-0.5 rounded font-semibold group-hover/pill:bg-amber-400 group-hover/pill:text-slate-950 transition-colors flex items-center gap-1 shrink-0 ml-1">
                          <Layers className="w-2.5 h-2.5" />
                          Conferir
                        </span>
                      </button>

                      {/* Hint overlay on hover */}
                      <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-slate-950/80 text-[10px] text-slate-300 border border-slate-700 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <Layers className="w-3 h-3 text-indigo-400" />
                        <span>Clique para abrir itens da tabela de categorias</span>
                      </div>

                      {/* Botão de Excluir da Quarentena na Imagem */}
                      {event.isQuarantine && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmLiberation('N');
                          }}
                          className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-rose-950/90 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-500/50 text-[10px] font-bold flex items-center gap-1.5 backdrop-blur-md shadow-md transition-all cursor-pointer z-10 active:scale-95"
                          title="Não Liberar e excluir este evento da lista de quarentena"
                        >
                          <Trash2 className="w-3 h-3 text-rose-400" />
                          <span>Excluir da Quarentena</span>
                        </button>
                      )}

                      {/* Open original link button */}
                      <a
                        href={event.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-700/80 text-[10px] font-medium flex items-center gap-1 backdrop-blur-sm transition-colors z-10"
                        title="Abrir imagem original em nova guia"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Ver Original</span>
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* PAINEL DE CONFERÊNCIA E ALTERAÇÃO DE CATEGORIA COM ITENS DA TABELA */}
              <div
                ref={categorySectionRef}
                className={`p-3.5 rounded-xl border transition-all duration-300 space-y-3 ${
                  isCategoryActive
                    ? 'bg-amber-950/20 border-amber-400/80 ring-2 ring-amber-400/30 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950/70 border-slate-800'
                }`}
              >
                {/* Header do Painel */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <Tag className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                        <span>Conferência de Categoria</span>
                        {selectedCategory !== event.category && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold animate-pulse">
                            Alterada
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Consulte e selecione os itens da tabela oficial de categorias
                      </p>
                    </div>
                  </div>

                  {/* Botão de Abrir Modal com Tabela de Categorias Completa */}
                  <button
                    type="button"
                    id="btn-conferencia-tabela-categorias"
                    onClick={() => setShowCategoryTableModal(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 hover:text-white border border-indigo-500/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                    title="Exibir tabela completa de categorias cadastradas para conferência"
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Itens da Tabela ({availableCategoryList.length})</span>
                  </button>
                </div>

                {/* Alerta caso a categoria original do evento não faça parte da tabela */}
                {!isEventCatInTable && event.category && (
                  <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Aviso:</span> O evento veio com a categoria &ldquo;{event.category}&rdquo;, que não faz parte da tabela de categorias. Selecione uma categoria válida abaixo.
                    </div>
                  </div>
                )}

                {/* Seleção Principal com Detalhes da Tabela */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <select
                      id="select-categoria-conferencia"
                      ref={categorySelectRef}
                      value={selectedCategory}
                      onChange={(e) => {
                        setSelectedCategory(e.target.value);
                        setIsCategoryActive(true);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 hover:border-amber-400/60 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
                    >
                      {!isEventCatInTable && event.category && (
                        <option value={event.category} className="bg-slate-900 text-rose-300 py-1" disabled>
                          ⚠️ {event.category} (Não cadastrada na tabela — selecione uma válida)
                        </option>
                      )}
                      {availableCategoryList.map((cat) => (
                        <option key={cat.nome} value={cat.nome} className="bg-slate-900 text-white py-1">
                          {cat.nome} {cat.nome.toLowerCase() === (event.category || '').toLowerCase() ? '(Atual)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn-salvar-categoria-conferencia"
                      onClick={handleSaveCategoryOnly}
                      disabled={isSavingCategory || selectedCategory === event.category}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                        selectedCategory !== event.category
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 active:scale-95'
                          : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      }`}
                      title="Salvar alteração da categoria no banco de dados agora"
                    >
                      {isSavingCategory ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Salvando...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Salvar Categoria</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowCategoryTableInline((prev) => !prev)}
                      className={`p-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center ${
                        showCategoryTableInline
                          ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50'
                          : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                      }`}
                      title={showCategoryTableInline ? "Ocultar tabela de categorias" : "Ver tabela de categorias nesta tela"}
                    >
                      <Table className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Atalhos rápidos extraídos da tabela de categorias (apenas o título das categorias) */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-medium">Itens cadastrados na tabela de categorias:</span>
                    <button
                      type="button"
                      onClick={() => setShowCategoryTableInline((prev) => !prev)}
                      className="text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer font-semibold"
                    >
                      <span>{showCategoryTableInline ? 'Ocultar Grade' : 'Ver Grade da Tabela'}</span>
                      {showCategoryTableInline ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap max-h-28 overflow-y-auto pr-1">
                    {availableCategoryList.map((cat) => {
                      const isSelected = selectedCategory.toLowerCase().trim() === cat.nome.toLowerCase().trim();
                      return (
                        <button
                          key={`pill-cat-${cat.nome}`}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat.nome);
                            setIsCategoryActive(true);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold shadow-sm ring-1 ring-amber-400/50'
                              : 'bg-slate-900/80 text-slate-300 border-slate-700/80 hover:border-slate-500 hover:text-white'
                          }`}
                          title={cat.descricao ? `${cat.nome}: ${cat.descricao}` : cat.nome}
                        >
                          <span className="font-semibold">{cat.nome}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grade / Tabela Inline de Categorias */}
                {showCategoryTableInline && (
                  <div className="p-2.5 rounded-xl bg-slate-900/95 border border-indigo-500/30 space-y-2 mt-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <Table className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Tabela de Categorias ({availableCategoryList.length} itens)</span>
                      </div>
                      <div className="relative w-44 sm:w-56">
                        <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={categorySearchQuery}
                          onChange={(e) => setCategorySearchQuery(e.target.value)}
                          placeholder="Buscar categoria ou descrição..."
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-2 py-1 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-800">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-950/80 sticky top-0 border-b border-slate-800 text-[10px] text-slate-400 font-semibold uppercase">
                          <tr>
                            <th className="py-1.5 px-2.5 w-44">Categoria</th>
                            <th className="py-1.5 px-2.5">Descrição</th>
                            <th className="py-1.5 px-2.5 w-20 text-center">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-[11px]">
                          {filteredCategoryItems.map((cat) => {
                            const isSelected = selectedCategory.toLowerCase().trim() === cat.nome.toLowerCase().trim();
                            return (
                              <tr
                                key={`inline-row-${cat.nome}`}
                                onClick={() => handleSelectCategoryFromTable(cat)}
                                className={`cursor-pointer transition-colors ${
                                  isSelected ? 'bg-amber-500/15' : 'hover:bg-slate-800/60'
                                }`}
                              >
                                <td className="py-1.5 px-2.5 font-bold text-white">
                                  {cat.nome}
                                </td>
                                <td className="py-1.5 px-2.5 text-slate-300 text-[11px]">
                                  {cat.descricao || <span className="text-slate-500 italic">Sem descrição</span>}
                                </td>
                                <td className="py-1.5 px-2.5 text-center">
                                  {isSelected ? (
                                    <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-bold">
                                      Ativa
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-[10px] font-semibold border border-slate-700 transition-colors">
                                      Aplicar
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {categorySaveNotice && (
                  <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium flex items-center gap-1.5 animate-fadeIn">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{categorySaveNotice}</span>
                  </div>
                )}
              </div>

              {/* PAINEL DE CONFERÊNCIA E ATUALIZAÇÃO DO CAMPO URL NAS TABELAS CORRESPONDENTES */}
              <div
                ref={urlSectionRef}
                className={`p-3.5 rounded-xl border transition-all duration-300 space-y-3 ${
                  isUrlActive
                    ? 'bg-blue-950/25 border-blue-400/80 ring-2 ring-blue-400/30 shadow-lg shadow-blue-500/10'
                    : 'bg-slate-950/70 border-slate-800'
                }`}
              >
                {/* Header do Painel */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      <LinkIcon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-300">
                        <span>Campo URL do Evento</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold font-mono">
                          url / video_url / imagem_url
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Atualiza o campo URL simultaneamente nas tabelas correspondentes ({event.isQuarantine ? 'eventos, categoria e quarentena' : 'eventos e tabela da categoria'})
                      </p>
                    </div>
                  </div>

                  {/* Badges de Tipo */}
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setUrlType('video');
                        setIsUrlActive(true);
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        urlType === 'video'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Film className="w-2.5 h-2.5" />
                      <span>Vídeo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUrlType('image');
                        setIsUrlActive(true);
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        urlType === 'image'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <ImageIcon className="w-2.5 h-2.5" />
                      <span>Imagem</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUrlType('link');
                        setIsUrlActive(true);
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        urlType === 'link'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Globe className="w-2.5 h-2.5" />
                      <span>Link</span>
                    </button>
                  </div>
                </div>

                {/* Input de URL e Botão Salvar */}
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row items-stretch gap-2">
                    <div className="relative flex-1">
                      <input
                        ref={urlInputRef}
                        type="text"
                        value={currentUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCurrentUrl(val);
                          setIsUrlActive(true);
                          if (isVideoFormatUrl(val)) {
                            setUrlType('video');
                          } else if (
                            val.startsWith('data:image/') ||
                            val.startsWith('/uploads/images/') ||
                            /\.(jpe?g|png|webp|gif|svg|avif|bmp|jfif|heic|heif|tiff?|ico)($|\?|#)/i.test(val) ||
                            val.includes('.jpg') ||
                            val.includes('.jpeg') ||
                            val.includes('.png') ||
                            val.includes('.webp')
                          ) {
                            setUrlType('image');
                          }
                        }}
                        placeholder={
                          urlType === 'video' 
                            ? 'https://... (MP4, YouTube, Facebook, Reels)' 
                            : urlType === 'image'
                              ? 'https://... (URL da imagem JPG, PNG, WebP)'
                              : 'https://... (Link de ingressos ou origem)'
                        }
                        className="w-full bg-slate-900 border border-slate-700 hover:border-blue-400/60 focus:border-blue-400 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                      {currentUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentUrl('');
                            setIsUrlActive(true);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                          title="Limpar campo URL"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        id="btn-atualizar-url-tabelas"
                        onClick={handleSaveUrlOnly}
                        disabled={isSavingUrl || !currentUrl.trim()}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                          currentUrl.trim()
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 active:scale-95'
                            : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        }`}
                        title="Atualizar o campo URL agora nas tabelas correspondentes do banco de dados"
                      >
                        {isSavingUrl ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Gravando...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            <span>Atualizar URL nas Tabelas</span>
                          </>
                        )}
                      </button>

                      {/* Botão de Enviar Cartaz / Imagem Direto do Celular ou PC */}
                      <button
                        type="button"
                        onClick={() => imageFileInputRef.current?.click()}
                        className="px-2.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Selecionar foto ou cartaz do evento no seu dispositivo (PNG, JPG, WebP)"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="hidden sm:inline">Carregar Cartaz</span>
                      </button>
                      <input
                        ref={imageFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileSelect}
                        className="hidden"
                      />

                      {/* Botão de Enviar MP4 Direto */}
                      <button
                        type="button"
                        onClick={() => videoFileInputRef.current?.click()}
                        disabled={isUploadingVideo}
                        className="px-2.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/40 text-purple-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Selecionar arquivo de vídeo MP4 do seu dispositivo"
                      >
                        <FileVideo className="w-3.5 h-3.5 text-purple-400" />
                        <span className="hidden sm:inline">
                          {isUploadingVideo
                            ? `Enviando${videoUploadProgress > 0 ? ` ${videoUploadProgress}%` : '...'}`
                            : 'Enviar MP4'}
                        </span>
                      </button>
                      <input
                        ref={videoFileInputRef}
                        type="file"
                        accept="video/mp4,video/*"
                        onChange={handleVideoFileSelect}
                        className="hidden"
                      />

                      {/* Abrir Link em nova aba se for http */}
                      {currentUrl.startsWith('http') && (
                        <a
                          href={currentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="Abrir URL em nova guia"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  {isUploadingVideo && (
                    <div className="mt-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                        <span>{videoUploadStatus || 'Enviando vídeo para o servidor...'}</span>
                        <span>{videoUploadProgress}%</span>
                      </div>
                      <progress
                        value={videoUploadProgress}
                        max={100}
                        className="w-full h-2 rounded-full overflow-hidden bg-slate-800 [&::-webkit-progress-bar]:bg-slate-800 [&::-webkit-progress-value]:bg-amber-500 [&::-webkit-progress-value]:transition-all [&::-webkit-progress-value]:duration-300 [&::-moz-progress-bar]:bg-amber-500"
                      />
                      <p className="text-[11px] text-slate-300">
                        Aguarde o término do carregamento (em 80%–99% o servidor está finalizando e gravando o vídeo com segurança). Não feche esta janela.
                      </p>
                    </div>
                  )}

                  {/* Feedback Messages */}
                  {urlSaveNotice && (
                    <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium flex items-center gap-1.5 animate-fadeIn">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{urlSaveNotice}</span>
                    </div>
                  )}

                  {urlErrorNotice && (
                    <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-medium flex items-center gap-1.5 animate-fadeIn">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{urlErrorNotice}</span>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                    <Info className="w-3 h-3 text-blue-400 shrink-0" />
                    <span>
                      Tabelas sincronizadas: <code className="text-slate-300 font-mono font-semibold">eventos</code>, <code className="text-slate-300 font-mono font-semibold">eventos_{event.category ? event.category.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'categoria'}</code> {event.isQuarantine ? 'e ' : ''}
                      {event.isQuarantine && <code className="text-amber-300 font-mono font-semibold">eventos_importados</code>}
                    </span>
                  </div>
                </div>
              </div>

              {/* Critérios de Análise */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5 text-xs mb-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Critérios de Análise do Cartaz:
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <span className="text-slate-400">• Legibilidade de data e local</span>
                  <span className="text-slate-400">• Resolução e nitidez gráfica</span>
                  <span className="text-slate-400">• Ausência de conteúdo impróprio</span>
                  <span className="text-slate-400">• Conferência da Categoria</span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Event Details & Liberation Field */}
            <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
              {/* Top Quick Actions Bar for Event Column */}
              <div className="flex items-center justify-between bg-slate-950/80 px-3.5 py-2.5 rounded-xl border border-slate-800 shadow-sm">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ações Rápidas no Grid</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="btn-grid-cancelar-excluir"
                    onClick={onClose}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                    title="Fechar análise do evento"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Fechar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmLiberation('S')}
                    disabled={isSaving}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                    title="Aprovar evento e liberar no aplicativo ('S')"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Liberar ("S")</span>
                  </button>
                </div>
              </div>

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

                {/* Botões de Ação Direta Mobile-friendly abaixo do Título (Request 4 e 2) */}
                <div className="pt-1 pb-1 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleConfirmLiberation('S')}
                      disabled={isSaving}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-500/10 active:scale-95 disabled:opacity-50"
                      title="Aprovar e Liberar Evento no Aplicativo"
                    >
                      {isSaving && selectedLiberado === 'S' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-slate-950" />
                      )}
                      <span>Liberar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleConfirmLiberation('N')}
                      disabled={isSaving}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-rose-600/10 active:scale-95 disabled:opacity-50"
                      title={event.isQuarantine ? "Cancelar e Excluir Evento da Quarentena" : "Cancelar e Desativar Evento"}
                    >
                      {isSaving && selectedLiberado === 'N' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-white" />
                      )}
                      <span>Cancelar</span>
                    </button>
                  </div>

                  {/* Dropbox de Categoria abaixo de Liberar e Cancelar */}
                  <div 
                    className="relative w-full py-2 px-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-400 flex items-center justify-center gap-2 border border-slate-700 shadow-sm cursor-pointer transition-colors"
                  >
                    <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="shrink-0 text-slate-400 font-semibold text-xs">Categoria:</span>
                    <select
                      value={selectedCategory}
                      onChange={async (e) => {
                        const newCat = e.target.value;
                        if (!newCat || newCat === selectedCategory) return;
                        setSelectedCategory(newCat);
                        setIsCategoryActive(true);
                        const catObj = availableCategoryList.find((c) => c.nome.toLowerCase() === newCat.toLowerCase());
                        
                        try {
                          setIsSavingCategory(true);
                          setCategorySaveNotice(null);
                          let success = false;
                          if (onUpdateCategory) {
                            const res = await onUpdateCategory(event.id, newCat, catObj?.id);
                            success = res !== false;
                          } else {
                            const res = await fetch(`/api/events/${event.id}/category`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ category: newCat, categoryId: catObj?.id }),
                            });
                            const json = await res.json();
                            success = res.ok && json.success;
                          }

                          if (success) {
                            setCategorySaveNotice(`Categoria alterada para "${newCat}" com sucesso!`);
                            setTimeout(() => setCategorySaveNotice(null), 4000);
                          }
                        } catch (err) {
                          console.error('Erro ao salvar categoria:', err);
                        } finally {
                          setIsSavingCategory(false);
                        }
                      }}
                      className="bg-transparent text-amber-400 font-bold focus:outline-none cursor-pointer w-full text-center pr-3"
                    >
                      {availableCategories.map((catName) => (
                        <option key={catName} value={catName} className="bg-slate-900 text-white text-xs text-left">
                          {catName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-1.5 px-3 rounded-xl text-xs font-semibold bg-slate-900/60 hover:bg-slate-800 text-slate-400 flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-800"
                    title="Fechar Análise"
                  >
                    <span>Fechar / Voltar</span>
                  </button>
                </div>

                {/* Linha de Categoria Conferida */}
                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-[10px] text-slate-500">Categoria Conferida:</span>
                    <span className="font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 text-xs">
                      {selectedCategory}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCategoryActive(true);
                      categorySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      setTimeout(() => categorySelectRef.current?.focus(), 150);
                    }}
                    className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer font-medium hover:underline"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Alterar Categoria</span>
                  </button>
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

                {/* Linha do Campo URL */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-slate-300 min-w-0">
                    <LinkIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="text-[10px] text-slate-500 shrink-0">Campo URL:</span>
                    <span className="font-mono text-blue-300 text-[11px] truncate max-w-[220px]" title={currentUrl || 'Não informada'}>
                      {currentUrl ? (currentUrl.startsWith('data:') ? 'Arquivo Local (Base64)' : currentUrl) : 'Não informada'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUrlActive(true);
                      urlSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      setTimeout(() => urlInputRef.current?.focus(), 150);
                    }}
                    className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer font-medium hover:underline shrink-0 ml-2"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Editar URL</span>
                  </button>
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

              {/* Seção de Decisão e Liberação do Cadastro */}
              <div className="space-y-3 bg-slate-950/90 p-4 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Status de Liberação para Publicação
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Campo no BD: <code className="text-amber-300 font-bold">liberado</code>
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-400 mb-3">
                    Ao confirmar a liberação, o sistema grava <span className="font-bold text-emerald-400">"S"</span> no campo liberado e salva a categoria selecionada abaixo.
                  </p>
                </div>

                {/* Seletor de Categoria Proeminente e de Fácil Acesso */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-850 shadow-inner">
                  <label className="block text-xs font-bold text-amber-300 mb-1.5 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Selecione a Categoria de Lançamento:</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedCategory}
                      onChange={async (e) => {
                        const newCat = e.target.value;
                        if (!newCat) return;
                        setSelectedCategory(newCat);
                        setIsCategoryActive(true);
                        const catObj = availableCategoryList.find((c) => c.nome.toLowerCase() === newCat.toLowerCase());
                        
                        try {
                          setIsSavingCategory(true);
                          setCategorySaveNotice(null);
                          let success = false;
                          if (onUpdateCategory) {
                            const res = await onUpdateCategory(event.id, newCat, catObj?.id);
                            success = res !== false;
                          } else {
                            const res = await fetch(`/api/events/${event.id}/category`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ category: newCat, categoryId: catObj?.id }),
                            });
                            const json = await res.json();
                            success = res.ok && json.success;
                          }
                          if (success) {
                            setCategorySaveNotice(`Categoria alterada para "${newCat}" com sucesso!`);
                            setTimeout(() => setCategorySaveNotice(null), 3500);
                          }
                        } catch (err) {
                          console.error('Erro ao salvar categoria:', err);
                        } finally {
                          setIsSavingCategory(false);
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-750 hover:border-amber-400 focus:border-amber-400 rounded-xl px-3 py-2.5 text-xs text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
                    >
                      {!isEventCatInTable && event.category && (
                        <option value={event.category} className="bg-slate-900 text-rose-300 py-1" disabled>
                          ⚠️ {event.category} (Não cadastrada na tabela — selecione uma válida)
                        </option>
                      )}
                      {availableCategoryList.map((cat) => (
                        <option key={cat.nome} value={cat.nome} className="bg-slate-900 text-white font-semibold py-1.5">
                          {cat.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  {categorySaveNotice && (
                    <p className="text-[11px] text-emerald-400 font-bold mt-1.5 flex items-center gap-1 animate-fadeIn">
                      <Check className="w-3.5 h-3.5" /> {categorySaveNotice}
                    </p>
                  )}
                </div>

                {/* Seleção do Valor do Campo 'liberado' */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedLiberado('S')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      selectedLiberado === 'S'
                        ? 'bg-emerald-500/15 border-emerald-500 text-white ring-2 ring-emerald-500/30 shadow-md shadow-emerald-500/10'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Liberar ("S")
                      </span>
                      {selectedLiberado === 'S' && (
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 leading-tight">
                      liberado = 'S' (Aprovado e visível na busca pública)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedLiberado('N')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      selectedLiberado === 'N'
                        ? 'bg-rose-500/15 border-rose-500 text-white ring-2 ring-rose-500/30 shadow-md shadow-rose-500/10'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                        {event.isQuarantine ? <Trash2 className="w-4 h-4 text-rose-400" /> : <AlertCircle className="w-4 h-4" />}
                        Não Liberar {event.isQuarantine ? '(Excluir)' : '("N")'}
                      </span>
                      {selectedLiberado === 'N' && (
                        <div className="w-2 h-2 rounded-full bg-rose-400" />
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 leading-tight">
                      {event.isQuarantine 
                        ? 'Exclui definitivamente o registro da lista de quarentena'
                        : "liberado = 'N' (Rejeitado ou em ajuste)"}
                    </span>
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row items-stretch gap-2">
                  <button
                    type="button"
                    id="btn-cancelar-modal"
                    onClick={onClose}
                    disabled={isSaving}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5 disabled:opacity-50"
                    title="Fechar sem salvar"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Fechar / Voltar</span>
                  </button>

                  <button
                    type="button"
                    id="btn-nao-liberar"
                    onClick={() => handleConfirmLiberation('N')}
                    disabled={isSaving}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Cancelar e excluir este evento da lista de liberação"
                  >
                    <X className="w-3.5 h-3.5 text-rose-400" />
                    <span>Cancelar Evento</span>
                  </button>

                  <button
                    type="button"
                    id="btn-confirmar-liberacao"
                    onClick={() => handleConfirmLiberation('S')}
                    disabled={isSaving}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25 ring-2 ring-emerald-500/40"
                    title="Atualiza o campo liberado do cadastro do evento com 'S' e publica o evento com a categoria conferida"
                  >
                    {isSaving ? (
                      <span>Atualizando cadastro para "S"...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-slate-950" />
                        <span>Liberar Evento (liberado = "S")</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL / OVERLAY: TABELA DE CATEGORIAS COMPLETA PARA CONFERÊNCIA */}
        {showCategoryTableModal && (
          <div
            id="modal-tabela-categorias-overlay"
            className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setShowCategoryTableModal(false)}
          >
            <div
              className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do Modal de Tabela */}
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Tabela de Categorias do Sistema</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                        {availableCategoryList.length} itens
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Conferência de categoria para o evento: <span className="text-amber-300 font-semibold truncate max-w-xs inline-block align-bottom">{event.title}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCategoryTableModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Fechar Tabela"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Barra de Pesquisa e Filtro */}
              <div className="p-3.5 bg-slate-950/40 border-b border-slate-800 flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={categorySearchQuery}
                    onChange={(e) => setCategorySearchQuery(e.target.value)}
                    placeholder="Filtrar por categoria ou descrição..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    autoFocus
                  />
                  {categorySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCategorySearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isLoadingCategories && (
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                )}
              </div>

              {/* Tabela de Itens */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {filteredCategoryItems.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Nenhuma categoria encontrada para o filtro "{categorySearchQuery}".
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-950/90 border-b border-slate-800 text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3.5 w-60">Categoria</th>
                          <th className="py-2.5 px-3.5">Descrição</th>
                          <th className="py-2.5 px-3.5 w-28 text-center">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 text-xs">
                        {filteredCategoryItems.map((cat) => {
                          const isSelected = selectedCategory.toLowerCase().trim() === cat.nome.toLowerCase().trim();
                          const isEventCat = (event.category || '').toLowerCase().trim() === cat.nome.toLowerCase().trim();

                          return (
                            <tr
                              key={`table-modal-${cat.nome}`}
                              onClick={() => handleSelectCategoryFromTable(cat)}
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-amber-500/15 border-l-4 border-l-amber-400'
                                  : 'hover:bg-slate-800/70'
                              }`}
                            >
                              <td className="py-3 px-3.5 font-bold text-white">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{cat.nome}</span>
                                  {isEventCat && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-normal">
                                      Cartaz
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3.5 text-slate-300 text-[11px] leading-relaxed">
                                {cat.descricao ? (
                                  <span>{cat.descricao}</span>
                                ) : (
                                  <span className="text-slate-500 italic">Sem descrição</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {isSelected ? (
                                  <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1 shadow-sm">
                                    <Check className="w-3.5 h-3.5" />
                                    Selecionada
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectCategoryFromTable(cat);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white font-semibold text-xs border border-indigo-500/40 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    Selecionar
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer do Modal */}
              <div className="p-3.5 sm:p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  Dica: Clique em qualquer linha para aplicar a categoria na conferência do evento.
                </span>

                <button
                  type="button"
                  onClick={() => setShowCategoryTableModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer border border-slate-700"
                >
                  Concluir / Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
