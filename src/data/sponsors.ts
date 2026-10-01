export interface SponsorItem {
  id: string;
  name: string;
  category: string; // Ex: Gastronomia, Bebidas / Adega, Barbearia / Salão, Estacionamento, Moda, Conveniência
  targetCategory?: 'Bailes' | 'Samba' | 'Forró' | 'Shows' | 'Geral'; // Categoria de anúncio solicitada: Bailes, Samba, Forró, Shows
  description: string;
  badge?: string; // Ex: 'Top Recomendado', 'Desconto no Esquenta', 'Perto do Baile'
  phone: string; // WhatsApp comercial
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  instagram?: string;
  monthlyFee: number; // R$ 100,00
  active: boolean;
  liberado?: 'S' | 'N' | 'pendente'; // 'S' = Liberado, 'N' = Rejeitado, 'pendente' = Em Análise (até 48h)
  statusPagamento?: 'pendente' | 'pago'; // Status no Mercado Pago
  protocolo?: string; // Protocolo para acompanhamento
  dataPagamento?: string;
  dataLiberacao?: string;
  featuredOrder?: number;
  createdAt: string;
}

export const INITIAL_SPONSORS: SponsorItem[] = [
  {
    id: 'sp-1',
    name: 'Adega & Distribuidora São Jorge',
    category: 'Adega & Bebidas',
    targetCategory: 'Shows',
    description: 'Bebidas geladas, combos e gelo para o seu esquenta antes do show ou baile. Entrega rápida na região.',
    badge: 'Desconto no Esquenta',
    phone: '11987654321',
    address: 'Av. Dom Pedro II, 1420 - Bairro Jardim',
    city: 'Santo André',
    state: 'SP',
    latitude: -23.6492,
    longitude: -46.5361,
    imageUrl: 'https://images.unsplash.com/photo-1527061011665-3652c757a4d4?auto=format&fit=crop&w=600&q=80',
    instagram: '@adegasaojorge',
    monthlyFee: 100,
    active: true,
    featuredOrder: 1,
    createdAt: '2026-09-01',
  },
  {
    id: 'sp-2',
    name: 'Bar & Espetaria O Ponto Carioca',
    category: 'Bar & Petiscaria',
    targetCategory: 'Samba',
    description: 'Chope trincando, porções caprichadas e esquenta para a roda de samba e pagode com desconto.',
    badge: 'Ponto do Samba',
    phone: '11976543210',
    address: 'Rua das Figueiras, 850 - Bairro Jardim',
    city: 'Santo André',
    state: 'SP',
    latitude: -23.6521,
    longitude: -46.5385,
    imageUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=600&q=80',
    instagram: '@pontocariocabar',
    monthlyFee: 100,
    active: true,
    featuredOrder: 2,
    createdAt: '2026-09-02',
  },
  {
    id: 'sp-forro-1',
    name: 'Casa Nordestina & Espaço Sertanejo',
    category: 'Restaurante & Casa de Forró',
    targetCategory: 'Forró',
    description: 'Carne de sol, baião de dois e aquele esquenta especial para dançar forró pé de serra a noite toda.',
    badge: 'Tradição Nordestina',
    phone: '11988223344',
    address: 'Av. Senador Vergueiro, 2200 - Rudge Ramos',
    city: 'São Bernardo do Campo',
    state: 'SP',
    latitude: -23.6710,
    longitude: -46.5580,
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
    instagram: '@casanordestinasp',
    monthlyFee: 100,
    active: true,
    featuredOrder: 3,
    createdAt: '2026-09-02',
  },
  {
    id: 'sp-3',
    name: 'Pizzaria & Forneria Bella Itália',
    category: 'Pizzaria & Lanches',
    targetCategory: 'Bailes',
    description: 'O melhor pós-baile da cidade! Aberto até às 03h nas sextas e sábados com entrega e salão.',
    badge: 'Aberto até Tarde',
    phone: '11998877665',
    address: 'Rua Marechal Deodoro, 1200 - Centro',
    city: 'São Bernardo do Campo',
    state: 'SP',
    latitude: -23.6938,
    longitude: -46.5653,
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
    instagram: '@bellaitaliapizza',
    monthlyFee: 100,
    active: true,
    featuredOrder: 4,
    createdAt: '2026-09-03',
  },
  {
    id: 'sp-4',
    name: 'Estacionamento & Lava Rápido Central Park',
    category: 'Estacionamento Seguro',
    targetCategory: 'Shows',
    description: 'Deixe seu carro com segurança coberta enquanto curte o show ou baile. Vagas com seguro total.',
    badge: 'Segurança Total',
    phone: '11988771122',
    address: 'Rua Senador Fláquer, 410 - Centro',
    city: 'Santo André',
    state: 'SP',
    latitude: -23.6575,
    longitude: -46.5312,
    imageUrl: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=600&q=80',
    monthlyFee: 100,
    active: true,
    featuredOrder: 5,
    createdAt: '2026-09-04',
  },
  {
    id: 'sp-5',
    name: 'Studio D’Elas Salão & Barbearia VIP',
    category: 'Beleza & Estilo',
    targetCategory: 'Bailes',
    description: 'Penteados, escova, barba alinhada e maquiagem para você chegar impecável no baile ou show.',
    badge: 'Visual para o Baile',
    phone: '11971234567',
    address: 'Av. Portugal, 915 - Centro',
    city: 'Santo André',
    state: 'SP',
    latitude: -23.6601,
    longitude: -46.5334,
    imageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80',
    instagram: '@studiodelasvip',
    monthlyFee: 100,
    active: true,
    featuredOrder: 6,
    createdAt: '2026-09-05',
  },
  {
    id: 'sp-6',
    name: 'Hamburgueria Artesanal Na Chapa',
    category: 'Lanches & Burgers',
    targetCategory: 'Shows',
    description: 'Burgers artesanais suculentos e batata frita crocante para repor as energias depois de dançar muito.',
    badge: 'Sabor Imbatível',
    phone: '11982345678',
    address: 'Av. Kennedy, 700 - Parque São Diogo',
    city: 'São Bernardo do Campo',
    state: 'SP',
    latitude: -23.6885,
    longitude: -46.5512,
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
    instagram: '@nachapaburgers',
    monthlyFee: 100,
    active: true,
    featuredOrder: 7,
    createdAt: '2026-09-06',
  }
];

// Cálculo de distância por coordenadas (Haversine Formula em KM)
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c) * 10) / 10;
}
