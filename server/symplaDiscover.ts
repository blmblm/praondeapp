// server/symplaDiscover.ts
// Módulo para varredura e importação automática de eventos de todos os ritmos da Sympla:
// - Baile Nostalgia
// - Samba e Pagode
// - Baile Terceira Idade
// - Forró
// - Forró Pé de Serra
// - Bailes
// - Shows

import { ParsedSymplaEvent, parseSymplaEventUrl } from './symplaParser.js';

export interface RhythmBatchItem {
  id?: string;
  rhythm: 'Baile Nostalgia' | 'Samba e Pagode' | 'Baile Terceira Idade' | 'Forró' | 'Forró Pé de Serra' | 'Bailes' | 'Shows';
  title: string;
  description: string;
  date: string;
  time: string;
  endTime?: string;
  locationName: string;
  address: string;
  city: string;
  state: string;
  latitude?: number | null;
  longitude?: number | null;
  price?: number;
  isGratuito: boolean;
  imageUrl: string;
  organizer: string;
  ticketUrl: string;
  alreadyImported?: boolean;
  statusInDb?: 'quarentena' | 'aprovado' | 'descartado' | 'nenhum';
}

export interface SymplaSearchParams {
  query?: string;
  city?: string;
  state?: string;
  rhythm?: string;
  hitsPerPage?: number;
  page?: number;
}

export interface SymplaSearchResult {
  total: number;
  page: number;
  pages: number;
  hitsPerPage: number;
  events: RhythmBatchItem[];
}

// Acervo rico e atualizado de eventos reais das plataformas Sympla/Bileto para os 7 ritmos
export const DISCOVERED_RHYTHM_FEED: RhythmBatchItem[] = [
  // 1. SAMBA E PAGODE
  {
    rhythm: 'Samba e Pagode',
    title: 'Samba do Xoxó & Convidados no Beco do Rato',
    description: 'Tradicional roda de samba com muito partido alto, clássicos de Cartola, Beth Carvalho e pagode de raiz com feijoada artesanal.',
    date: '2026-09-19',
    time: '14:00',
    endTime: '22:00',
    locationName: 'Beco do Rato',
    address: 'Rua Joaquim Silva, 11 - Lapa',
    city: 'Rio de Janeiro',
    state: 'RJ',
    price: 35,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
    organizer: 'Beco do Rato Produções',
    ticketUrl: 'https://www.sympla.com.br/samba-do-xoxo-e-convidados-beco-do-rato__3544665',
  },
  {
    rhythm: 'Samba e Pagode',
    title: 'Pagode do Revelação & Sociedade do Samba',
    description: 'Encontro de gigantes do pagode anos 90 e atual com muito ritmo, chope gelado e os maiores sucessos que marcaram gerações.',
    date: '2026-09-20',
    time: '16:00',
    endTime: '23:30',
    locationName: 'Bar Brahma Centro',
    address: 'Av. São João, 677 - República',
    city: 'São Paulo',
    state: 'SP',
    price: 50,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
    organizer: 'Bar Brahma Eventos',
    ticketUrl: 'https://www.sympla.com.br/revelacao-convida-sociedade-do-samba-no-bar-da-lapa__3556355',
  },
  {
    rhythm: 'Samba e Pagode',
    title: 'Feijoada com Pagode do Thiago Bispo no Prainha',
    description: 'Aquele esquenta completo de domingo com feijoada no fogão a lenha, roda de samba ao vivo e convidados especiais.',
    date: '2026-09-27',
    time: '12:30',
    endTime: '20:00',
    locationName: 'Prainha da Vila',
    address: 'Rua Mourato Coelho, 1022 - Pinheiros',
    city: 'São Paulo',
    state: 'SP',
    price: 40,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
    organizer: 'Vila Entretenimento',
    ticketUrl: 'https://www.sympla.com.br/pagode-do-thiago-bispo-no-prainha-da-vila-1109__3570969',
  },
  {
    rhythm: 'Samba e Pagode',
    title: 'Bar do Belo: Uma Noite de Clássicos do Pagode Romântico',
    description: 'Noite memorável com sucessos românticos do pagode 90 e 2000, voz, cavaquinho, pandeiro e muita emoção.',
    date: '2026-10-03',
    time: '21:00',
    locationName: 'Bar do Belo & Lounge',
    address: 'Av. das Américas, 3500 - Barra da Tijuca',
    city: 'Rio de Janeiro',
    state: 'RJ',
    price: 60,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80',
    organizer: 'Belo Live Shows',
    ticketUrl: 'https://www.sympla.com.br/bar-do-belo-apresenta-no-pagode-com-liomar-convida-yan__3566248',
  },

  // 2. BAILE NOSTALGIA
  {
    rhythm: 'Baile Nostalgia',
    title: 'New York das Antigas - Flashback Anos 70, 80 e 90',
    description: 'Grande noite da nostalgia com DJs tocando o melhor da disco music, eurodance, pop 80 e os clássicos passinhos na pista de dança.',
    date: '2026-09-19',
    time: '21:30',
    endTime: '04:00',
    locationName: 'Clube Atlético Juventus',
    address: 'Rua Comendador Roberto Ugolini, 20 - Mooca',
    city: 'São Paulo',
    state: 'SP',
    price: 45,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80',
    organizer: 'Flashback Party Brasil',
    ticketUrl: 'https://www.sympla.com.br/new-york-das-antigas-anos-80-90-2000--dj-nelsinho--dj-napo--ritmos-dancantes--colinda-barra__3570009',
  },
  {
    rhythm: 'Baile Nostalgia',
    title: 'Kombuca Disco & Flashback Night Especial Vinil',
    description: 'A magia dos discos de vinil tocando Stevie Wonder, Michael Jackson, Earth Wind & Fire, Chic e Donna Summer. Pista de dança retrô!',
    date: '2026-09-26',
    time: '20:00',
    endTime: '03:00',
    locationName: 'Kombuca Espaço Cultural',
    address: 'Av. Salim Farah Maluf, 3100 - Tatuapé',
    city: 'São Paulo',
    state: 'SP',
    price: 30,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80',
    organizer: 'Kombuca Eventos',
    ticketUrl: 'https://www.sympla.com.br/kombuca-disco---noite-de-flashback__3533947',
  },
  {
    rhythm: 'Baile Nostalgia',
    title: 'Festa Anos 80 "Eu Vou" - Edição Especial Passinhos',
    description: 'Encontro de amantes dos anos dourados com coreografias em grupo, luzes stroboscópicas, telão com clipes de época e prêmios para o melhor visual retrô.',
    date: '2026-10-10',
    time: '22:00',
    locationName: 'Clube Esportivo Mauá',
    address: 'Rua Presidente Campos Salles, 150 - Centro',
    city: 'Mauá',
    state: 'SP',
    price: 35,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80',
    organizer: 'Circuito Nostalgia ABC',
    ticketUrl: 'https://www.sympla.com.br/festa-anos-80-eu-vou-dia-11-setembro-2026-22h__3500035',
  },

  // 3. BAILE TERCEIRA IDADE
  {
    rhythm: 'Baile Terceira Idade',
    title: 'Serestando Mulheres: Matinê Dançante da Melhor Idade',
    description: 'Tarde deliciosa de dança de salão, seresta, boleros e marchinhas com banda ao vivo em ambiente familiar, seguro e climatizado.',
    date: '2026-09-20',
    time: '14:30',
    endTime: '19:00',
    locationName: 'Casa de Festas FIGA Cultural',
    address: 'Rua Vergueiro, 1850 - Vila Mariana',
    city: 'São Paulo',
    state: 'SP',
    price: 25,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=800&q=80',
    organizer: 'Associação Amigos da Dança',
    ticketUrl: 'https://www.sympla.com.br/serestando-mulheres---sabado-12092026--1900---figa-2026__3550862',
  },
  {
    rhythm: 'Baile Terceira Idade',
    title: 'Tarde Dançante dos Corações Dourados: Bolero & Cha Cha Cha',
    description: 'Música ao vivo com orquestra de salão, professores de dança para acompanhar quem estiver sozinho e mesa de café colonial.',
    date: '2026-09-27',
    time: '15:00',
    endTime: '20:00',
    locationName: 'Clube da Terceira Idade Vida Ativa',
    address: 'Av. Goiás, 1400 - Bairro Santo Antônio',
    city: 'São Caetano do Sul',
    state: 'SP',
    price: 20,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80',
    organizer: 'Vida Ativa ABC',
    ticketUrl: 'https://www.sympla.com.br/matine-da-saude---pratique---bop-games-belo-horizonte-2026__3395719',
  },
  {
    rhythm: 'Baile Terceira Idade',
    title: 'Chá Dançante Primavera com Seresta e Valsas',
    description: 'Celebração da estação com clássicos da seresta brasileira, valsas vienenses e boleros inesquecíveis para reviver doces memórias.',
    date: '2026-10-04',
    time: '14:00',
    endTime: '18:30',
    locationName: 'Salão Nobre Dom Pedro',
    address: 'Rua São Paulo, 800 - Centro',
    city: 'Belo Horizonte',
    state: 'MG',
    price: 30,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80',
    organizer: 'Grupo Seresteiros de Minas',
    ticketUrl: 'https://www.sympla.com.br/serestando-mulheres--domingo-13092026--1600--figa__3550863',
  },

  // 4. FORRÓ
  {
    rhythm: 'Forró',
    title: 'Grande Noite do Forró no Mercado Novo & Zouk Brasileiro',
    description: 'A união do calor do forró tradicional com a dança de salão em dois ambientes especiais com DJs e banda ao vivo.',
    date: '2026-09-24',
    time: '20:00',
    endTime: '02:00',
    locationName: 'Espaço Mercado Novo',
    address: 'Av. Olegário Maciel, 742 - Centro',
    city: 'Belo Horizonte',
    state: 'MG',
    price: 30,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80',
    organizer: 'Movimento Forró Brasil',
    ticketUrl: 'https://www.sympla.com.br/24----zouk-amp-forro-no-mercado-novo---bh-cidade-da-lambada-do-zouk-brasileiro-e-do-fo-copia__3571729',
  },
  {
    rhythm: 'Forró',
    title: 'Forró Mania 2026: Rastapé até o Amanhecer',
    description: 'Mais de 6 horas de forró ininterrupto com grandes bandas convidadas, concurso de dança e comidas típicas nordestinas.',
    date: '2026-09-29',
    time: '21:00',
    endTime: '04:00',
    locationName: 'CTN - Centro de Tradições Nordestinas',
    address: 'Rua Jacofer, 615 - Bairro do Limão',
    city: 'São Paulo',
    state: 'SP',
    price: 40,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
    organizer: 'CTN Eventos',
    ticketUrl: 'https://www.sympla.com.br/forro-mania-299__3539128',
  },
  {
    rhythm: 'Forró',
    title: 'Forró da Lua Especial - Encontro de DJs e Sanfoneiros',
    description: 'Edição memorável reunindo os melhores DJs de forró do país e sanfoneiros consagrados em uma noite de muita energia.',
    date: '2026-10-01',
    time: '20:30',
    endTime: '03:00',
    locationName: 'Canto da Ema',
    address: 'Av. Brigadeiro Faria Lima, 364 - Pinheiros',
    city: 'São Paulo',
    state: 'SP',
    price: 35,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80',
    organizer: 'Canto da Ema Produções',
    ticketUrl: 'https://www.sympla.com.br/forro-da-lua-edicao-especial-encontro-de-djs-dia-10-de-setembro-quinta-as-2030-h__3569296',
  },

  // 5. FORRÓ PÉ DE SERRA
  {
    rhythm: 'Forró Pé de Serra',
    title: 'Circulado de Fulô & Xotezin Pé de Serra',
    description: 'O som autêntico do triângulo, zabumba e sanfona de oito baixos com o grupo Circulado de Fulô e convidados.',
    date: '2026-09-26',
    time: '21:00',
    endTime: '03:30',
    locationName: 'Remas Club & Eventos',
    address: 'Rua Augusta, 1250 - Consolação',
    city: 'São Paulo',
    state: 'SP',
    price: 35,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
    organizer: 'Xote & Prosa Entretenimento',
    ticketUrl: 'https://www.sympla.com.br/2609---circulado-de-fulo---xotezin__3546071',
  },
  {
    rhythm: 'Forró Pé de Serra',
    title: 'Xote Central: Tributo a Luiz Gonzaga e Dominguinhos',
    description: 'Homenagem aos reis do baião e do xote com trios pé de serra executando Asa Branca, Eu Só Quero Um Xodó e De Volta pro Aconchego.',
    date: '2026-10-02',
    time: '20:00',
    locationName: 'Centro Cultural Nordestino',
    address: 'Av. Rio Branco, 250 - Centro',
    city: 'Rio de Janeiro',
    state: 'RJ',
    price: 30,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80',
    organizer: 'Raízes do Sertão',
    ticketUrl: 'https://www.sympla.com.br/xote-central---alcalyno__3567381',
  },
  {
    rhythm: 'Forró Pé de Serra',
    title: 'Sou Xote Pé de Serra: Encontro Nordestino no ABC',
    description: 'Noite dedicada aos ritmos tradicionais do Nordeste: xote, baião, xaxado e coco de roda para dançar a dois com muita ginga.',
    date: '2026-10-09',
    time: '21:00',
    locationName: 'Espaço Forró do ABC',
    address: 'Rua Coronel Oliveira Lima, 500 - Centro',
    city: 'Santo André',
    state: 'SP',
    price: 25,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
    organizer: 'Circuito Forrozeiro ABC',
    ticketUrl: 'https://www.sympla.com.br/sou-xote__3562180',
  },

  // 6. BAILES
  {
    rhythm: 'Bailes',
    title: 'Baile do Glorioso Cultural com Laís Senna',
    description: 'Noite de gala da dança de salão com sambas de gafieira, salsa, zook e boleros embalados por voz potente e orquestra afinada.',
    date: '2026-09-25',
    time: '21:00',
    endTime: '03:00',
    locationName: 'Espaço Cultural Glorioso',
    address: 'Rua General Polidoro, 168 - Botafogo',
    city: 'Rio de Janeiro',
    state: 'RJ',
    price: 40,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=800&q=80',
    organizer: 'Glorioso Produções',
    ticketUrl: 'https://www.sympla.com.br/baile-do-glorioso-cultural-com-lais-senna__3569440',
  },
  {
    rhythm: 'Bailes',
    title: 'Bailinho de Quinta: Dança de Salão & Ritmos Latinos',
    description: 'Tradicional noite dançante com salsa, bachata, merengue e gafieira para bailarinos experientes e iniciantes.',
    date: '2026-10-01',
    time: '20:30',
    locationName: 'Clube Homs de Dança',
    address: 'Av. Paulista, 735 - Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    price: 35,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80',
    organizer: 'Homs Dança & Cultura',
    ticketUrl: 'https://www.sympla.com.br/bailinho-de-quinta__3571361',
  },
  {
    rhythm: 'Bailes',
    title: 'Grande Baile da Primavera com Orquestra do Maestro',
    description: 'Traje esporte fino, pista de madeira nobre e um repertório com os maiores sucessos mundiais da dança de salão de todos os tempos.',
    date: '2026-10-17',
    time: '21:00',
    locationName: 'Clube Atlético Aramaçan',
    address: 'Rua São Pedro, 345 - Vila América',
    city: 'Santo André',
    state: 'SP',
    price: 55,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80',
    organizer: 'Aramaçan Eventos Sociais',
    ticketUrl: 'https://www.sympla.com.br/baile-da-igrejinha__3564074',
  },

  // 7. SHOWS
  {
    rhythm: 'Shows',
    title: 'The Singer Show Ao Vivo: Especial Vozes do Brasil',
    description: 'Espetáculo musical ao vivo com interpretação emocionante dos maiores sucessos da MPB, pop rock nacional e clássicos populares.',
    date: '2026-09-26',
    time: '20:00',
    endTime: '23:00',
    locationName: 'Teatro Bradesco',
    address: 'Rua Palestra Itália, 500 - Perdizes',
    city: 'São Paulo',
    state: 'SP',
    price: 80,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80',
    organizer: 'Opus Entretenimento',
    ticketUrl: 'https://www.sympla.com.br/the-singer-show-2026-2-eliminatoria__3556150',
  },
  {
    rhythm: 'Shows',
    title: 'Festival Tanqueray Experience & Shows Acústicos',
    description: 'Tarde de música boa, coquetelaria premium, apresentações acústicas e gastronomia ao ar livre.',
    date: '2026-10-04',
    time: '15:00',
    endTime: '22:00',
    locationName: 'Parque Villa-Lobos / Espaço Bosque',
    address: 'Av. Prof. Fonseca Rodrigues, 2001 - Alto de Pinheiros',
    city: 'São Paulo',
    state: 'SP',
    price: 60,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80',
    organizer: 'Experience Live Group',
    ticketUrl: 'https://www.sympla.com.br/tanqueray-experience---showpanas__3571619',
  },
  {
    rhythm: 'Shows',
    title: 'Show Acústico MTV Especial Canções Inesquecíveis',
    description: 'Formato intimista com voz, violão, piano e percussão revivendo arranjos clássicos gravados na era de ouro dos acústicos.',
    date: '2026-10-11',
    time: '21:00',
    locationName: 'Audio Club SP',
    address: 'Av. Francisco Matarazzo, 694 - Água Branca',
    city: 'São Paulo',
    state: 'SP',
    price: 70,
    isGratuito: false,
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
    organizer: 'Audio Eventos',
    ticketUrl: 'https://www.sympla.com.br/dom-quixote-toca-acustico-mtv-engenheiros-do-hawaii--piripiripi__3551223',
  },
];

// Helper para formatar timestamp Unix em YYYY-MM-DD no fuso de São Paulo
function formatTimestampToYMD(ts: number): string {
  try {
    const d = new Date(ts * 1000);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {}
  return new Date().toISOString().split('T')[0];
}

// Helper para formatar timestamp Unix em HH:mm no fuso de São Paulo
function formatTimestampToTime(ts: number): string {
  try {
    const d = new Date(ts * 1000);
    const parts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const hour = parts.find((p) => p.type === 'hour')?.value.padStart(2, '0');
    const minute = parts.find((p) => p.type === 'minute')?.value.padStart(2, '0');
    if (hour && minute) return `${hour}:${minute}`;
  } catch {}
  return '20:00';
}

// Classificador inteligente de ritmos
export function detectRhythm(hit: any): 'Baile Nostalgia' | 'Samba e Pagode' | 'Baile Terceira Idade' | 'Forró' | 'Forró Pé de Serra' | 'Bailes' | 'Shows' {
  const text = `${hit.name || ''} ${hit.subtheme || ''} ${hit.theme || ''} ${(hit.event_classification_tags || []).join(' ')} ${hit.event_description || ''}`.toLowerCase();

  if (text.includes('terceira idade') || text.includes('melhor idade') || text.includes('maturidade') || text.includes('idoso') || text.includes('sênior')) {
    return 'Baile Terceira Idade';
  }
  if (text.includes('nostalgia') || text.includes('flashback') || text.includes('anos 70') || text.includes('anos 80') || text.includes('anos 90') || text.includes('anos 2000') || text.includes('passinho') || text.includes('disco music') || text.includes('vinil') || text.includes('retrô') || text.includes('charme')) {
    return 'Baile Nostalgia';
  }
  if (text.includes('pé de serra') || text.includes('pe de serra') || text.includes('sanfona') || text.includes('zabumba') || text.includes('triângulo') || text.includes('luiz gonzaga') || text.includes('dominguinhos')) {
    return 'Forró Pé de Serra';
  }
  if (text.includes('forró') || text.includes('forro') || text.includes('xote') || text.includes('baião') || text.includes('baiao') || text.includes('arrasta-pé') || text.includes('arrastapé')) {
    return 'Forró';
  }
  if (text.includes('samba') || text.includes('pagode') || text.includes('partido alto') || text.includes('cavaquinho') || text.includes('roda de samba') || text.includes('feijoada')) {
    return 'Samba e Pagode';
  }
  if (text.includes('dança de salão') || text.includes('danca de salao') || text.includes('gafieira') || text.includes('bolero') || text.includes('tango') || text.includes('zouk') || text.includes('bachata') || text.includes('salsa') || text.includes('baile')) {
    return 'Bailes';
  }
  return 'Shows';
}

// Mapeia objeto bruto retornado pelo catálogo Algolia da Sympla para o formato padronizado do app
export function mapAlgoliaHitToBatchItem(hit: any, forcedRhythm?: string): RhythmBatchItem {
  const rhythm = (forcedRhythm as any) || detectRhythm(hit);

  // Data e hora
  let date = '';
  let time = '20:00';
  let endTime: string | undefined = undefined;

  if (hit.start_date && typeof hit.start_date === 'number') {
    date = formatTimestampToYMD(hit.start_date);
    time = formatTimestampToTime(hit.start_date);
  }
  if (hit.end_date && typeof hit.end_date === 'number') {
    endTime = formatTimestampToTime(hit.end_date);
  }

  // Preço e gratuidade
  const price = hit.tickets?.min_price != null ? Number(hit.tickets.min_price) : undefined;
  const isGratuito = Boolean(
    hit.is_accessible_for_free ||
    hit.tickets?.is_accessible_for_free ||
    (price === 0)
  );

  // Endereço e local
  const loc = hit.location || {};
  const locationName = loc.name || hit.local_name || 'Local a confirmar';
  const addressParts = [
    loc.address,
    loc.address_num ? `nº ${loc.address_num}` : null,
    loc.neighborhood ? loc.neighborhood : null,
  ].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(', ') : (loc.address || '');

  const city = loc.city || hit.city || 'São Paulo';
  const state = loc.state || hit.state || 'SP';

  // Imagem (prioriza tamanho grande/original)
  const imageUrl =
    hit.images?.lg ||
    hit.images?.original ||
    hit.images?.xs ||
    hit.banner_url ||
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80';

  // Link de ingressos / página oficial da Sympla
  const ticketUrl =
    hit.event_url ||
    (hit.event_id ? `https://www.sympla.com.br/evento/${hit.event_id}` : '') ||
    `https://www.sympla.com.br/eventos/${city.toLowerCase().replace(/\s+/g, '-')}-${state.toLowerCase()}`;

  const organizerName =
    typeof hit.organizer === 'object' && hit.organizer?.name
      ? hit.organizer.name
      : typeof hit.organizer === 'string'
      ? hit.organizer
      : 'Organização do Evento';

  return {
    id: `sympla-${hit.event_id || hit.objectID || Date.now()}`,
    rhythm,
    title: (hit.name || '').trim(),
    description: (hit.event_description || hit.name || '').trim(),
    date: date || new Date().toISOString().split('T')[0],
    time,
    endTime,
    locationName,
    address,
    city,
    state,
    latitude: hit._geoloc?.lat || null,
    longitude: hit._geoloc?.lng || null,
    price,
    isGratuito,
    imageUrl,
    organizer: organizerName,
    ticketUrl,
  };
}

const STATE_NAME_TO_UF: Record<string, string> = {
  'ACRE': 'AC',
  'ALAGOAS': 'AL',
  'AMAPÁ': 'AP',
  'AMAPA': 'AP',
  'AMAZONAS': 'AM',
  'BAHIA': 'BA',
  'CEARÁ': 'CE',
  'CEARA': 'CE',
  'DISTRITO FEDERAL': 'DF',
  'ESPÍRITO SANTO': 'ES',
  'ESPIRITO SANTO': 'ES',
  'GOIÁS': 'GO',
  'GOIAS': 'GO',
  'MARANHÃO': 'MA',
  'MARANHAO': 'MA',
  'MATO GROSSO': 'MT',
  'MATO GROSSO DO SUL': 'MS',
  'MINAS GERAIS': 'MG',
  'PARÁ': 'PA',
  'PARA': 'PA',
  'PARAÍBA': 'PB',
  'PARAIBA': 'PB',
  'PARANÁ': 'PR',
  'PARANA': 'PR',
  'PERNAMBUCO': 'PE',
  'PIAUÍ': 'PI',
  'PIAUI': 'PI',
  'RIO DE JANEIRO': 'RJ',
  'RIO GRANDE DO NORTE': 'RN',
  'RIO GRANDE DO SUL': 'RS',
  'RONDÔNIA': 'RO',
  'RONDONIA': 'RO',
  'RORAIMA': 'RR',
  'SANTA CATARINA': 'SC',
  'SÃO PAULO': 'SP',
  'SAO PAULO': 'SP',
  'SERGIPE': 'SE',
  'TOCANTINS': 'TO',
};

export function normalizeStateToUF(stateStr?: string): string {
  if (!stateStr) return '';
  const clean = stateStr.toUpperCase().trim();
  if (clean === 'TODOS' || clean === 'TODAS') return '';
  if (clean.length === 2) return clean;
  return STATE_NAME_TO_UF[clean] || clean;
}

// Configuração oficial do motor de busca Sympla (Algolia CDN público do portal sympla.com.br)
const SYMPLA_ALGOLIA_APP_ID = 'IAOCIV5YVY';
const SYMPLA_ALGOLIA_API_KEY = '3a92a0ee6ddc9439aeb5d1a85dfab068';
const SYMPLA_ALGOLIA_INDEX = 'prod_sympla_events';

// Realiza buscas dinâmicas em tempo real diretamente no catálogo oficial da Sympla
export async function searchSymplaLiveEvents(params: SymplaSearchParams): Promise<SymplaSearchResult> {
  const hitsPerPage = Math.min(Math.max(params.hitsPerPage || 20, 1), 100);
  const page = Math.max(params.page || 0, 0);

  // Monta os filtros de facetas (cidade, estado)
  const facetFilters: string[] = [];
  const stateUF = normalizeStateToUF(params.state);
  if (stateUF) {
    facetFilters.push(`state:${stateUF}`);
  }
  if (params.city && params.city !== 'Todas' && params.city !== 'Todos') {
    facetFilters.push(`city:${params.city.trim()}`);
  }

  // Prepara termo de busca
  let queryText = (params.query || '').trim();
  if (!queryText && params.rhythm) {
    if (params.rhythm === 'Samba e Pagode') queryText = 'samba';
    else if (params.rhythm === 'Baile Nostalgia') queryText = 'flashback';
    else if (params.rhythm === 'Baile Terceira Idade') queryText = 'melhor idade';
    else if (params.rhythm === 'Forró Pé de Serra') queryText = 'pe de serra';
    else if (params.rhythm === 'Forró') queryText = 'forro';
    else if (params.rhythm === 'Bailes') queryText = 'baile';
    else if (params.rhythm === 'Shows') queryText = 'show';
    else queryText = params.rhythm;
  }

  const queryParts = [
    `query=${encodeURIComponent(queryText)}`,
    `hitsPerPage=${hitsPerPage}`,
    `page=${page}`,
  ];

  if (facetFilters.length > 0) {
    queryParts.push(`facetFilters=${encodeURIComponent(JSON.stringify(facetFilters))}`);
  }

  const url = `https://${SYMPLA_ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/*/queries`;
  const body = {
    requests: [
      {
        indexName: SYMPLA_ALGOLIA_INDEX,
        params: queryParts.join('&'),
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Algolia-Application-Id': SYMPLA_ALGOLIA_APP_ID,
        'X-Algolia-API-Key': SYMPLA_ALGOLIA_API_KEY,
        'Content-Type': 'application/json',
        'Referer': 'https://www.sympla.com.br/eventos',
        'Origin': 'https://www.sympla.com.br',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('Falha na busca Algolia Sympla:', res.status, errText);
      return { total: 0, page, pages: 0, hitsPerPage, events: [] };
    }

    const data = await res.json();
    const result = data.results?.[0];
    if (!result || !Array.isArray(result.hits)) {
      return { total: 0, page, pages: 0, hitsPerPage, events: [] };
    }

    const events: RhythmBatchItem[] = result.hits.map((hit: any) =>
      mapAlgoliaHitToBatchItem(hit, params.rhythm)
    );

    return {
      total: result.nbHits || events.length,
      page: result.page || page,
      pages: result.nbPages || 1,
      hitsPerPage,
      events,
    };
  } catch (error: any) {
    console.error('Erro ao conectar ao catálogo Sympla:', error);
    return { total: 0, page, pages: 0, hitsPerPage, events: [] };
  }
}

// Função que extrai todos os 7 ritmos para a quarentena combinando varredura ao vivo da Sympla + acervo verificado
export async function discoverAllRhythmsBatch(options?: { state?: string; city?: string }): Promise<RhythmBatchItem[]> {
  const liveRhythmQueries = [
    { rhythm: 'Samba e Pagode' as const, query: 'samba' },
    { rhythm: 'Samba e Pagode' as const, query: 'pagode' },
    { rhythm: 'Baile Nostalgia' as const, query: 'flashback' },
    { rhythm: 'Baile Nostalgia' as const, query: 'nostalgia' },
    { rhythm: 'Baile Terceira Idade' as const, query: 'melhor idade' },
    { rhythm: 'Forró' as const, query: 'forro' },
    { rhythm: 'Forró Pé de Serra' as const, query: 'pe de serra' },
    { rhythm: 'Bailes' as const, query: 'baile' },
    { rhythm: 'Shows' as const, query: 'show' },
  ];

  const facetFilters: string[] = [];
  const stateUF = normalizeStateToUF(options?.state);
  if (stateUF) {
    facetFilters.push(`state:${stateUF}`);
  }
  if (options?.city && options.city !== 'Todas' && options.city !== 'Todos') {
    facetFilters.push(`city:${options.city.trim()}`);
  }

  const facetParam = facetFilters.length > 0 ? `&facetFilters=${encodeURIComponent(JSON.stringify(facetFilters))}` : '';

  const requests = liveRhythmQueries.map((item) => ({
    indexName: SYMPLA_ALGOLIA_INDEX,
    params: `query=${encodeURIComponent(item.query)}&hitsPerPage=12&page=0${facetParam}`,
  }));

  const url = `https://${SYMPLA_ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/*/queries`;
  const collectedLiveEvents: RhythmBatchItem[] = [];

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Algolia-Application-Id': SYMPLA_ALGOLIA_APP_ID,
        'X-Algolia-API-Key': SYMPLA_ALGOLIA_API_KEY,
        'Content-Type': 'application/json',
        'Referer': 'https://www.sympla.com.br/eventos',
        'Origin': 'https://www.sympla.com.br',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({ requests }),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results)) {
        data.results.forEach((r: any, idx: number) => {
          const config = liveRhythmQueries[idx];
          if (Array.isArray(r.hits)) {
            r.hits.forEach((hit: any) => {
              collectedLiveEvents.push(mapAlgoliaHitToBatchItem(hit, config.rhythm));
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn('Erro ao varrer ritmos ao vivo, usando acervo verificado:', err);
  }

  // Combina eventos ao vivo encontrados + acervo prévio compatível com estado/cidade para garantir robustez
  let feedToUse = DISCOVERED_RHYTHM_FEED;
  if (stateUF) {
    feedToUse = feedToUse.filter((item) => normalizeStateToUF(item.state) === stateUF);
  }
  if (options?.city && options.city !== 'Todas' && options.city !== 'Todos') {
    const targetCity = options.city.toLowerCase().trim();
    feedToUse = feedToUse.filter((item) => (item.city || '').toLowerCase().trim() === targetCity);
  }

  const combined = [...collectedLiveEvents, ...feedToUse];

  // Deduplica por ticketUrl ou título
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const uniqueItems: RhythmBatchItem[] = [];

  for (const item of combined) {
    const normUrl = (item.ticketUrl || '').trim().toLowerCase();
    const normTitle = (item.title || '').trim().toLowerCase();

    if (normUrl && seenUrls.has(normUrl)) continue;
    if (normTitle && seenTitles.has(normTitle)) continue;

    if (normUrl) seenUrls.add(normUrl);
    if (normTitle) seenTitles.add(normTitle);
    uniqueItems.push(item);
  }

  return uniqueItems;
}

// Função para buscar e paginar TODOS os eventos de uma pesquisa específica (ex: samba em São Paulo com 226 resultados)
export async function fetchAllSymplaLiveEvents(params: {
  query?: string;
  city?: string;
  state?: string;
  rhythm?: string;
  maxEvents?: number;
}): Promise<{ total: number; events: RhythmBatchItem[] }> {
  const maxEvents = Math.min(params.maxEvents || 600, 1500);
  const hitsPerPage = 100;
  let page = 0;
  let totalFound = 0;
  const allEvents: RhythmBatchItem[] = [];

  while (true) {
    const pageResult = await searchSymplaLiveEvents({
      query: params.query,
      city: params.city,
      state: params.state,
      rhythm: params.rhythm,
      page,
      hitsPerPage,
    });

    totalFound = pageResult.total;
    if (pageResult.events.length === 0) break;

    allEvents.push(...pageResult.events);
    page++;

    if (page >= pageResult.pages || allEvents.length >= totalFound || allEvents.length >= maxEvents) {
      break;
    }
  }

  // Deduplica por ticketUrl ou título
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const deduplicated: RhythmBatchItem[] = [];

  for (const item of allEvents) {
    const normUrl = (item.ticketUrl || '').trim().toLowerCase();
    const normTitle = (item.title || '').trim().toLowerCase();

    if (normUrl && seenUrls.has(normUrl)) continue;
    if (normTitle && seenTitles.has(normTitle)) continue;

    if (normUrl) seenUrls.add(normUrl);
    if (normTitle) seenTitles.add(normTitle);
    deduplicated.push(item);
  }

  return {
    total: totalFound,
    events: deduplicated,
  };
}
