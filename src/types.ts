export type EventCategory =
  | 'Categoria'
  | 'Shows'
  | 'Samba e Pagode'
  | 'Baile e Nostalgia'
  | 'Baile Nostalgia'
  | 'Baile Terceira Idade'
  | 'Forró'
  | 'Forró Pé de Serra'
  | (string & {});

export interface CategoryItem {
  id: number;
  nome: string;
  descricao?: string;
  ativa: boolean;
  criadoEm?: string;
}

export interface CidadeItem {
  id: number;
  nome: string;
  estado: string;
  regiao?: string;
  ativa?: boolean;
  criadoEm?: string;
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  categoryId?: number;
  categoryOfficialName?: string;
  categoryDescription?: string;
  advertiserId?: number | string;
  advertiserName?: string;
  advertiserEmail?: string;
  advertiserPhone?: string;
  advertiserVerified?: boolean;
  estadoId?: number;
  estadoNomeCompleto?: string;
  regiao?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  endDate?: string;
  endTime?: string;
  locationName: string;
  address: string;
  city: string;
  state: string;
  latitude?: string;
  longitude?: string;
  liberado?: string; // 'S' ou 'N'
  isFree: boolean;
  price?: number;
  priceDetails?: string;
  imageUrl: string;
  mediaType?: 'image' | 'video';
  videoUrl?: string;
  video_url?: string;
  video_utl?: string;
  url?: string;
  Url?: string;
  organizer: string;
  contact?: string;
  tags: string[];
  featured?: boolean;
  createdAt: string;
  isQuarantine?: boolean;
  status?: string;
  distanceKm?: number;
}

export interface Advertiser {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  city?: string;
  state?: string;
  createdAt: string;
  verified: boolean;
}

export interface Supervisor {
  id: string;
  dbId?: number;
  name: string;
  senha?: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
  role: 'geral' | 'regional' | 'financeiro';
  status: 'ativo' | 'inativo';
  createdAt: string;
}

export interface CityItem {
  id: string;
  name: string;
  state: string;
  region?: string;
  active: boolean;
}

export type EstadoItem = CidadeItem;

export interface ImportedEventItem {
  id: string;
  origem?: string;
  urlOrigem?: string;
  title: string;
  description: string;
  category: string;
  categoryId?: number;
  date: string;
  time: string;
  endTime?: string;
  locationName: string;
  address: string;
  city: string;
  state: string;
  latitude?: string;
  longitude?: string;
  imageUrl: string;
  organizer: string;
  price?: number;
  isGratuito?: boolean;
  ticketUrl?: string;
  videoUrl?: string;
  url?: string;
  status: 'quarentena' | 'aprovado' | 'descartado';
  createdAt?: string;
}

export type ActiveScreen = 'home' | 'events' | 'register' | 'advertiser_auth' | 'sponsor_register';
