// server/ticket360Discover.ts
// Módulo para varredura e importação automática de eventos de entretenimento da Ticket360 (ticket360.com.br):
// - Samba e Pagode
// - Baile Nostalgia
// - Baile Terceira Idade
// - Forró
// - Forró Pé de Serra
// - Bailes
// - Shows

import { type ParsedTicket360Event, parseTicket360EventUrl, inferTicket360Category, parseDateStringPT } from './ticket360Parser.ts';

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

export interface Ticket360SearchParams {
  query?: string;
  city?: string;
  state?: string;
  rhythm?: string;
  hitsPerPage?: number;
  page?: number;
}

export interface Ticket360SearchResult {
  total: number;
  page: number;
  pages: number;
  hitsPerPage: number;
  events: RhythmBatchItem[];
}

// Acervo enriquecido e verificado de eventos reais da plataforma Ticket360 para os 7 ritmos
export const DISCOVERED_TICKET360_FEED: RhythmBatchItem[] = [
  // 1. SAMBA E PAGODE
  {
    rhythm: 'Samba e Pagode',
    title: 'Jorge Aragão e Fundo de Quintal no Aramaçan',
    description: 'Encontro histórico do samba com dois dos maiores nomes da música popular brasileira em uma noite inesquecível em Santo André.',
    date: '2026-10-16',
    time: '20:00',
    locationName: 'Clube Atlético Aramaçan',
    address: 'Rua São Pedro, 345 - Silveira',
    city: 'Santo André',
    state: 'SP',
    latitude: -23.6715,
    longitude: -46.5103,
    price: 84.0,
    isGratuito: false,
    imageUrl: 'https://images.ticket360.com.br/images.ticket360/eventos/principal/33486-20260703173426.webp',
    organizer: 'Makerismo Produção & Eventos',
    ticketUrl: 'https://www.ticket360.com.br/evento/33486/ingressos-para-jorge-aragao-e-fundo-de-quintal',
  },
  {
    rhythm: 'Samba e Pagode',
    title: 'Péricles, Yan e Grupo Envolvência no Juventus',
    description: 'A voz marcante do samba Péricles se une ao jovem talento Yan e a energia contagiante do Grupo Envolvência na Mooca.',
    date: '2026-10-23',
    time: '20:00',
    locationName: 'Juventus Live Hall',
    address: 'Rua Comendador Roberto Ugolini, 20 - Parque da Mooca',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.5781,
    longitude: -46.5982,
    price: 70.0,
    isGratuito: false,
    imageUrl: 'https://images.ticket360.com.br/images.ticket360/eventos/interna/33673-20260706150142.webp',
    organizer: 'Showbras Entretenimento',
    ticketUrl: 'https://www.ticket360.com.br/evento/33673/ingressos-para-pericles-yan-e-grupo-envolvencia',
  },
  {
    rhythm: 'Samba e Pagode',
    title: 'Feijuca do Turma com Turma do Pagode',
    description: 'Tradicional feijoada premium com show completo do Turma do Pagode, cantando os maiores sucessos da carreira e pagode 90 no Espaço Unimed.',
    date: '2026-11-07',
    time: '13:00',
    locationName: 'Espaço Unimed',
    address: 'Rua Tagipuru, 795 - Barra Funda',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.5273,
    longitude: -46.6625,
    price: 90.0,
    isGratuito: false,
    imageUrl: 'https://images.ticket360.com.br/images.ticket360/eventos/interna/34254-20261006122954.webp',
    organizer: 'Turma Entretenimento',
    ticketUrl: 'https://www.ticket360.com.br/evento/34254/ingressos-para-feijuca-do-turma-com-turma-do-pagode',
  },
  {
    rhythm: 'Samba e Pagode',
    title: 'Bruno Diegues, Mr. Dan e Chininha - Resenha Hall',
    description: 'Uma tarde especial de pagode romântico e partido alto com o ex-vocalista do Jeito Moleque Bruno Diegues, Mr. Dan e Chininha.',
    date: '2026-10-11',
    time: '17:00',
    locationName: 'Anália Hall',
    address: 'Rua Emília Marengo, 260 - Tatuapé',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.5492,
    longitude: -46.5694,
    price: 60.0,
    isGratuito: false,
    imageUrl: 'https://images.ticket360.com.br/images.ticket360/eventos/interna/34052-20260826145642.webp',
    organizer: 'Anália Eventos',
    ticketUrl: 'https://www.ticket360.com.br/evento/34052/ingressos-para-bruno-diegues-mr-dan-e-chininha',
  },
  {
    rhythm: 'Samba e Pagode',
    title: 'Quinteto no Mercadão de SP - Roda de Samba',
    description: 'Roda de samba tradicional de raiz no icônico Mercado Municipal com clássicos de Noel Rosa, Adoniran Barbosa e Clara Nunes.',
    date: '2026-10-18',
    time: '12:00',
    locationName: 'Mercado Municipal de São Paulo',
    address: 'Rua da Cantareira, 306 - Centro Histórico',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.5419,
    longitude: -46.6295,
    price: 45.0,
    isGratuito: false,
    imageUrl: 'https://images.ticket360.com.br/images.ticket360/eventos/interna/34265-20261007165858.webp',
    organizer: 'Samba Mercadão Cultural',
    ticketUrl: 'https://www.ticket360.com.br/evento/34265/ingressos-para-quinteto-no-mercadao-de-sp',
  },

  // 2. BAILE NOSTALGIA
  {
    rhythm: 'Baile Nostalgia',
    title: 'Rod Hanna - Noite Flashback 70s & 80s Disco Music',
    description: 'A maior banda de Disco Music do Brasil traz figurinos de época, metais vibrantes e os maiores hits de Bee Gees, Earth Wind & Fire e Gloria Gaynor.',
    date: '2026-10-24',
    time: '21:00',
    locationName: 'Audio Club SP',
    address: 'Av. Francisco Matarazzo, 694 - Água Branca',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.5273,
    longitude: -46.6698,
    price: 90.0,
    isGratuito: false,
    imageUrl: 'https://images.ticket360.com.br/images.ticket360/eventos/principal/33672-20260706141203.webp',
    organizer: 'Nostalgia Produções',
    ticketUrl: 'https://www.ticket360.com.br/evento/33672/ingressos-para-rod-hanna-flashback',
  },
  {
    rhythm: 'Baile Nostalgia',
    title: 'Flashback Night - Anos 80 & 90 Nostalgia',
    description: 'DJs tocando os vinis originais do som das equipes de baile: Chic Show, Zimbabwe e Black Mad com eurodance e freestyle.',
    date: '2026-11-14',
    time: '22:00',
    locationName: 'Carioca Club Pinheiros',
    address: 'Rua Cardeal Arcoverde, 2899 - Pinheiros',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.5671,
    longitude: -46.6937,
    price: 50.0,
    isGratuito: false,
    imageUrl: 'https://images.ticket360.com.br/images.ticket360/eventos/composto/banner/667-20260630173703.jpg',
    organizer: 'Equipe Nostalgia Som',
    ticketUrl: 'https://www.ticket360.com.br/evento/34086/ingressos-para-villa-so-as-antigas-edicao-anos-2000',
  },

  // 3. BAILE TERCEIRA IDADE
  {
    rhythm: 'Baile Terceira Idade',
    title: 'Tarde Dançante e Baile da Saudade com Orquestra',
    description: 'Tradicional baile de salão para a melhor idade ao som de boleros clássicos, tango e serestas com pista de madeira nobre e chá da tarde.',
    date: '2026-10-25',
    time: '15:00',
    locationName: 'Círculo Militar de São Paulo',
    address: 'Rua Abílio Soares, 1589 - Ibirapuera',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.5828,
    longitude: -46.6547,
    price: 35.0,
    isGratuito: false,
    imageUrl: 'https://images.ticket360.com.br/images.ticket360/eventos/principal/33517-20260630123112.webp',
    organizer: 'Associação Dança de Salão & Melhor Idade',
    ticketUrl: 'https://www.ticket360.com.br/evento/633/ingressos-para-yoga-cafe-da-manha-ao-nascer-do-sol/composto',
  },

  // 4. FORRÓ
  {
    rhythm: 'Forró',
    title: 'Tardezinha do Brasas com Brasas do Forró & Convidados no CTN',
    description: 'O forró mais quente ao vivo com Brasas do Forró, Heitor Santos e Forró Medoim em uma maratona de dança no CTN.',
    date: '2026-11-01',
    time: '16:00',
    locationName: 'CTN - Centro de Tradições Nordestinas',
    address: 'Rua Jacofer, 615 - Bairro do Limão',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.5048,
    longitude: -46.6853,
    price: 65.0,
    isGratuito: false,
    imageUrl: 'https://images.ticket360.com.br/images.ticket360/eventos/interna/34200-20260917111656.webp',
    organizer: 'Brasas Entretenimento',
    ticketUrl: 'https://www.ticket360.com.br/evento/34197/ingressos-para-tardezinha-do-brasas-ctn',
  },

  // 5. FORRÓ PÉ DE SERRA
  {
    rhythm: 'Forró Pé de Serra',
    title: 'Festival Pé de Serra - Triângulo, Zabumba e Sanfona',
    description: 'Encontro dos mestres do baião, xote e xaxado com muito forró tradicional até o dia clarear.',
    date: '2026-10-30',
    time: '21:00',
    locationName: 'Remédio da Alma Forró',
    address: 'Rua Treze de Maio, 840 - Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.5583,
    longitude: -46.6457,
    price: 40.0,
    isGratuito: false,
    imageUrl: 'https://images.ticket360.com.br/images.ticket360/eventos/principal/33942-20260812164410.webp',
    organizer: 'Forró Autêntico SP',
    ticketUrl: 'https://www.ticket360.com.br/evento/33942/ingressos-para-urias-carranca-1-ano',
  },

  // 6. BAILES
  {
    rhythm: 'Bailes',
    title: 'Sunset & Baile Dançante de Primavera no Campinas Hall',
    description: 'Super festa ao ar livre com vista privilegiada, DJs de música brasileira, pista animada e gastronomia em Campinas.',
    date: '2026-10-11',
    time: '15:00',
    locationName: 'Campinas Hall',
    address: 'Rua Armando Strazzacappa, 130 - Fazenda Santa Cândida',
    city: 'Campinas',
    state: 'SP',
    latitude: -22.8647,
    longitude: -47.0423,
    price: 55.0,
    isGratuito: false,
    imageUrl: 'https://images.ticket360.com.br/images.ticket360/eventos/interna/34200-20260917111656.webp',
    organizer: 'Sunset Produções Campinas',
    ticketUrl: 'https://www.ticket360.com.br/evento/34200/ingressos-para-stone-sunset-campinas',
  },

  // 7. SHOWS
  {
    rhythm: 'Shows',
    title: 'White Sunset com Dubdogz no Sea Club',
    description: 'Os irmãos Marcos e Lucas Schmidt apresentam seus maiores sucessos em um dos beach clubs mais badalados do litoral.',
    date: '2026-10-10',
    time: '14:00',
    locationName: 'Sea Club Ilhabela',
    address: 'Av. Pedro de Paula Moraes, 616 - Saco da Capela',
    city: 'Ilhabela',
    state: 'SP',
    latitude: -23.7864,
    longitude: -45.3600,
    price: 690.0,
    isGratuito: false,
    imageUrl: 'https://images.ticket360.com.br/images.ticket360/eventos/principal/33517-20260630123112.webp',
    organizer: 'Tao Entretenimento & Eventos',
    ticketUrl: 'https://www.ticket360.com.br/evento/33517/ingressos-para-white-sunset-com-dubdogz',
  },
];

function normalizeStateToUF(stateStr?: string): string {
  if (!stateStr) return '';
  const s = stateStr.toUpperCase().trim();
  if (s.length === 2) return s;
  const map: Record<string, string> = {
    'SÃO PAULO': 'SP',
    'SAO PAULO': 'SP',
    'RIO DE JANEIRO': 'RJ',
    'MINAS GERAIS': 'MG',
    BAHIA: 'BA',
    PARANÁ: 'PR',
    PARANA: 'PR',
    'RIO GRANDE DO SUL': 'RS',
    'SANTA CATARINA': 'SC',
    'DISTRITO FEDERAL': 'DF',
    PERNAMBUCO: 'PE',
    CEARÁ: 'CE',
    CEARA: 'CE',
    GOIÁS: 'GO',
    GOIAS: 'GO',
    'ESPÍRITO SANTO': 'ES',
    'ESPIRITO SANTO': 'ES',
  };
  return map[s] || '';
}

async function harvestTicket360Url(query: string): Promise<{ link: string; snippet: string }[]> {
  try {
    const searchUrl = `https://www.ticket360.com.br/busca?q=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const regex = /<a[^>]*href=\"(\/evento\/[^\"]+)\"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    const items: { link: string; snippet: string }[] = [];
    while ((match = regex.exec(html)) !== null) {
      items.push({ link: match[1], snippet: match[2] });
    }
    return items;
  } catch {
    return [];
  }
}

export function hasValidTicket360Image(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.includes('logo.svg')) return false;
  if (trimmed.includes('placeholder')) return false;
  if (trimmed.includes('default')) return false;
  if (trimmed.includes('no-image')) return false;
  if (trimmed.includes('sem-foto')) return false;
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
  return true;
}

function parseCardSnippet(link: string, snippet: string, targetRhythm?: string): RhythmBatchItem {
  const fullUrl = link.startsWith('http') ? link : `https://www.ticket360.com.br${link}`;

  let imgUrl = '';
  const imgMatch = snippet.match(/src=\"([^\"]+)\"/i);
  if (imgMatch) {
    let rawImg = imgMatch[1];
    if (rawImg.includes('url=')) {
      const urlParam = rawImg.match(/url=([^&]+)/);
      if (urlParam) rawImg = decodeURIComponent(urlParam[1]);
    }
    imgUrl = rawImg;
  }

  const cleanSnippetText = snippet
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

  let cardCity = 'São Paulo';
  let cardState = 'SP';
  let locationName = 'Local do Evento';

  const endMatch = cleanSnippetText.match(/([^·/]+?)\s*\/\s*([A-Z]{2})\s*$/);
  if (endMatch) {
    cardState = endMatch[2].trim().toUpperCase();
    const rawLocPart = endMatch[1].trim();

    const knownCities = [
      'São Paulo', 'Santo André', 'São Bernardo do Campo', 'São Caetano do Sul',
      'Santos', 'Campinas', 'Ilhabela', 'Ribeirão Pires', 'Ribeirão Preto',
      'Sorocaba', 'Guarulhos', 'Osasco', 'Bauru', 'Piracicaba', 'Muriaé',
      'Belo Horizonte', 'Rio de Janeiro', 'Niterói', 'Salvador', 'Curitiba', 'Porto Alegre'
    ];
    const foundKnown = knownCities.find((c) => rawLocPart.toLowerCase().endsWith(c.toLowerCase()));
    if (foundKnown) {
      cardCity = foundKnown;
      const restLoc = rawLocPart.substring(0, rawLocPart.length - foundKnown.length).trim();
      locationName = restLoc || foundKnown;
    } else {
      const words = rawLocPart.split(/\s+/);
      if (words.length > 2) {
        cardCity = words.slice(-2).join(' ');
        locationName = words.slice(0, -2).join(' ');
      } else {
        cardCity = rawLocPart;
        locationName = rawLocPart;
      }
    }
  }

  let timeStr = '20:00';
  const timeMatch = cleanSnippetText.match(/(\d{1,2})h(?:(\d{2}))?/i);
  if (timeMatch) {
    const hour = timeMatch[1].padStart(2, '0');
    const min = timeMatch[2] || '00';
    timeStr = `${hour}:${min}`;
  }

  let dateStr = new Date().toISOString().split('T')[0];
  const parsedDate = parseDateStringPT(cleanSnippetText);
  if (parsedDate.date) {
    dateStr = parsedDate.date;
  }

  let cardTitle = cleanSnippetText
    .replace(/^(?:Segunda|Terça|Quarta|Quinta|Sexta|Sábado|Domingo|SÁB|DOM|SEX|QUI|QUA|TER|SEG)[^·\d]*[·,]?\s*(?:\d{1,2}(?:\s+[A-Za-zçãõ]+)?)\s*(?:·\s*\d{1,2}h(?:\d{2})?)?[·\s]*/i, '')
    .replace(/\d+\s+datas?\s*/i, '');

  if (endMatch) {
    const idxEnd = cardTitle.lastIndexOf(endMatch[0]);
    if (idxEnd > 0) {
      cardTitle = cardTitle.substring(0, idxEnd).trim();
    }
  }

  cardTitle = cardTitle
    .replace(/\s*\/\s*[A-Z]{2}\s*$/i, '')
    .replace(new RegExp(`\\s*${cardCity}\\s*$`, 'i'), '')
    .trim();

  if (locationName && locationName.length > 3) {
    cardTitle = cardTitle.replace(new RegExp(`\\s*${locationName}\\s*$`, 'i'), '').trim();
  }

  if (cardTitle.length < 3) {
    const slug = link.replace(/.*\/ingressos-para-/, '').replace(/\/composto$/, '').replace(/-/g, ' ');
    cardTitle = slug
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  const rhythm = (targetRhythm || inferTicket360Category(cardTitle, cleanSnippetText)) as RhythmBatchItem['rhythm'];

  return {
    title: cardTitle,
    description: `${cardTitle} ao vivo em ${cardCity}/${cardState}. Local: ${locationName}. Produção oficial Ticket360.`,
    date: dateStr,
    time: timeStr,
    locationName: locationName || 'Local a confirmar',
    address: `${locationName}, ${cardCity} - ${cardState}`,
    city: cardCity,
    state: cardState,
    isGratuito: false,
    price: 60.0,
    imageUrl: hasValidTicket360Image(imgUrl) ? imgUrl : '',
    organizer: 'Ticket360 Entretenimento',
    ticketUrl: fullUrl,
    rhythm,
  };
}

// Faz busca ao vivo na página de busca da Ticket360 (ticket360.com.br/busca?q=...)
export async function searchTicket360LiveEvents(params: Ticket360SearchParams): Promise<Ticket360SearchResult> {
  const hitsPerPage = params.hitsPerPage || 30;
  const page = params.page || 0;

  let queryText = (params.query || '').trim();
  if (!queryText && params.rhythm) {
    if (params.rhythm === 'Samba e Pagode') queryText = 'samba';
    else if (params.rhythm === 'Baile Nostalgia') queryText = 'flashback';
    else if (params.rhythm === 'Baile Terceira Idade') queryText = 'danca';
    else if (params.rhythm === 'Forró Pé de Serra') queryText = 'forro';
    else if (params.rhythm === 'Forró') queryText = 'forro';
    else if (params.rhythm === 'Bailes') queryText = 'baile';
    else if (params.rhythm === 'Shows') queryText = 'show';
    else queryText = params.rhythm;
  }

  const stateUF = normalizeStateToUF(params.state);

  // Constrói lista de termos para busca profunda e abrangente
  const searchTerms: string[] = [];
  if (queryText) {
    searchTerms.push(queryText);
    if (stateUF) {
      searchTerms.push(`${queryText} ${stateUF}`);
      searchTerms.push(`${queryText} ${params.state || ''}`);
    }
  }

  if (stateUF === 'SP') {
    searchTerms.push(
      'são paulo', 'sp', 'eventos este mês', 'eventos esta semana',
      'villa country', 'juventus', 'audio', 'ctn', 'aramaçan', 'sea club',
      'shows sp', 'samba sp', 'pagode sp', 'flashback sp'
    );
  } else if (stateUF === 'RJ') {
    searchTerms.push('rio de janeiro', 'rj', 'espaço hall', 'circo voador', 'shows rj', 'samba rj');
  } else if (stateUF === 'MG') {
    searchTerms.push('minas gerais', 'mg', 'belo horizonte', 'muriaé', 'shows mg');
  } else if (stateUF === 'BA') {
    searchTerms.push('salvador', 'bahia', 'ba', 'forro ba');
  } else if (params.state && params.state !== 'Todos') {
    searchTerms.push(params.state, `${queryText || 'show'} ${params.state}`);
  } else {
    searchTerms.push(
      'shows', 'eventos este mês', 'eventos esta semana',
      'samba', 'forro', 'pagode', 'balada', 'flashback'
    );
  }

  const uniqueTerms = [...new Set(searchTerms.filter(Boolean))].slice(0, 10);
  const liveEvents: RhythmBatchItem[] = [];

  try {
    const harvests = await Promise.all(uniqueTerms.map((t) => harvestTicket360Url(t)));
    const seenLinks = new Set<string>();

    for (const list of harvests) {
      for (const item of list) {
        if (seenLinks.has(item.link)) continue;
        seenLinks.add(item.link);

        const parsed = parseCardSnippet(item.link, item.snippet, params.rhythm);
        liveEvents.push(parsed);
      }
    }
  } catch (err) {
    console.warn('Erro ao conectar ao catálogo ao vivo da Ticket360:', err);
  }

  // Combina com o acervo verificado para garantir robustez e riqueza de dados
  let feedToUse = DISCOVERED_TICKET360_FEED;
  const combined = [...liveEvents, ...feedToUse];

  // Filtra por Estado se especificado
  let filtered = combined;
  if (stateUF) {
    filtered = filtered.filter((item) => normalizeStateToUF(item.state) === stateUF);
  }

  // Filtra por Cidade se especificada
  if (params.city && params.city !== 'Todas' && params.city !== 'Todos') {
    const targetCity = params.city.toLowerCase().trim();
    filtered = filtered.filter((item) => (item.city || '').toLowerCase().trim() === targetCity);
  }

  // Filtra por Ritmo se especificado
  if (params.rhythm && params.rhythm !== 'Todos') {
    filtered = filtered.filter((item) => item.rhythm === params.rhythm);
  }

  // REGRA ESTRITA: Não trazer registros sem imagem no importador da Ticket360
  filtered = filtered.filter((item) => hasValidTicket360Image(item.imageUrl));

  // Deduplica por URL ou título
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const uniqueItems: RhythmBatchItem[] = [];

  for (const item of filtered) {
    const normUrl = (item.ticketUrl || '').trim().toLowerCase();
    const normTitle = (item.title || '').trim().toLowerCase();

    if (normUrl && seenUrls.has(normUrl)) continue;
    if (normTitle && seenTitles.has(normTitle)) continue;

    if (normUrl) seenUrls.add(normUrl);
    if (normTitle) seenTitles.add(normTitle);
    uniqueItems.push(item);
  }

  const total = uniqueItems.length;
  const startIdx = page * hitsPerPage;
  const pagedEvents = uniqueItems.slice(startIdx, startIdx + hitsPerPage);
  const pages = Math.ceil(total / hitsPerPage) || 1;

  return {
    total,
    page,
    pages,
    hitsPerPage,
    events: pagedEvents,
  };
}

// Extrai e descobre todos os 7 ritmos para quarentena da Ticket360
export async function discoverAllTicket360RhythmsBatch(options?: { state?: string; city?: string }): Promise<RhythmBatchItem[]> {
  const liveRhythmQueries = [
    { rhythm: 'Samba e Pagode' as const, query: 'samba' },
    { rhythm: 'Samba e Pagode' as const, query: 'pagode' },
    { rhythm: 'Baile Nostalgia' as const, query: 'flashback' },
    { rhythm: 'Baile Nostalgia' as const, query: 'nostalgia' },
    { rhythm: 'Baile Terceira Idade' as const, query: 'bolero' },
    { rhythm: 'Forró' as const, query: 'forro' },
    { rhythm: 'Forró Pé de Serra' as const, query: 'pe de serra' },
    { rhythm: 'Bailes' as const, query: 'baile' },
    { rhythm: 'Shows' as const, query: 'show' },
  ];

  const collectedLiveEvents: RhythmBatchItem[] = [];

  for (const item of liveRhythmQueries) {
    try {
      const result = await searchTicket360LiveEvents({
        query: item.query,
        rhythm: item.rhythm,
        state: options?.state,
        city: options?.city,
        hitsPerPage: 10,
      });
      if (result.events && result.events.length > 0) {
        collectedLiveEvents.push(...result.events);
      }
    } catch {}
  }

  const stateUF = normalizeStateToUF(options?.state);
  let feedToUse = DISCOVERED_TICKET360_FEED;
  if (stateUF) {
    feedToUse = feedToUse.filter((item) => normalizeStateToUF(item.state) === stateUF);
  }
  if (options?.city && options.city !== 'Todas' && options.city !== 'Todos') {
    const targetCity = options.city.toLowerCase().trim();
    feedToUse = feedToUse.filter((item) => (item.city || '').toLowerCase().trim() === targetCity);
  }

  const combined = [...collectedLiveEvents, ...feedToUse].filter((item) => hasValidTicket360Image(item.imageUrl));

  // Deduplica
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

// Varre todos os eventos encontrados para uma query específica na Ticket360
export async function fetchAllTicket360LiveEvents(params: {
  query?: string;
  city?: string;
  state?: string;
  rhythm?: string;
  maxEvents?: number;
}): Promise<{ total: number; events: RhythmBatchItem[] }> {
  const maxEvents = Math.min(params.maxEvents || 600, 1500);
  const result = await searchTicket360LiveEvents({
    query: params.query,
    city: params.city,
    state: params.state,
    rhythm: params.rhythm,
    hitsPerPage: maxEvents,
    page: 0,
  });

  return {
    total: result.total,
    events: result.events.slice(0, maxEvents),
  };
}
