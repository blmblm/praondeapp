export type EventCategory =
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

export interface EventItem {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  categoryId?: number;
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
  organizer: string;
  contact?: string;
  tags: string[];
  featured?: boolean;
  createdAt: string;
}

export interface Advertiser {
  id: string;
  email: string;
  name?: string;
  phone?: string;
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

export type ActiveScreen = 'home' | 'events' | 'register' | 'advertiser_auth';
