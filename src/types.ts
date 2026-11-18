export type EventCategory =
  | 'Categoria'
  | 'Shows'
  | 'Sertanejo'
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

export const DEFAULT_CIDADES: CidadeItem[] = [
  { id: 14, nome: 'Bauru', estado: 'SP' },
  { id: 2, nome: 'Campinas', estado: 'SP' },
  { id: 16, nome: 'Carapicuíba', estado: 'SP' },
  { id: 18, nome: 'Diadema', estado: 'SP' },
  { id: 20, nome: 'Franca', estado: 'SP' },
  { id: 3, nome: 'Guarulhos', estado: 'SP' },
  { id: 19, nome: 'Itaquaquecetuba', estado: 'SP' },
  { id: 12, nome: 'Jundiaí', estado: 'SP' },
  { id: 17, nome: 'Mauá', estado: 'SP' },
  { id: 11, nome: 'Mogi das Cruzes', estado: 'SP' },
  { id: 7, nome: 'Osasco', estado: 'SP' },
  { id: 13, nome: 'Piracicaba', estado: 'SP' },
  { id: 21, nome: 'Praia Grande', estado: 'SP' },
  { id: 8, nome: 'Ribeirão Preto', estado: 'SP' },
  { id: 5, nome: 'Santo André', estado: 'SP' },
  { id: 10, nome: 'Santos', estado: 'SP' },
  { id: 9, nome: 'Sorocaba', estado: 'SP' },
  { id: 4, nome: 'São Bernardo do Campo', estado: 'SP' },
  { id: 15, nome: 'São José do Rio Preto', estado: 'SP' },
  { id: 6, nome: 'São José dos Campos', estado: 'SP' },
  { id: 1, nome: 'São Paulo', estado: 'SP' },
];

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
  estado_id?: number;
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
  cpf?: string;
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
  contact?: string;
  status: 'quarentena' | 'aprovado' | 'descartado';
  createdAt?: string;
}

export type ActiveScreen = 'home' | 'events' | 'register' | 'advertiser_auth' | 'sponsor_register';
