// server/symplaParser.ts
// Extrator especializado de dados de eventos da Sympla, Shotgun, Ingresse, Bilheto, Eventim e Ticketeiras

export interface ParsedSymplaEvent {
  origem?: string;
  urlOrigem: string;
  titulo: string;
  descricao: string;
  categoriaSugerida: string;
  dataEvento: string; // YYYY-MM-DD
  horario: string; // HH:MM
  horarioFim?: string; // HH:MM
  localNome: string;
  endereco: string;
  cidade: string;
  estado: string; // UF
  latitude?: string;
  longitude?: string;
  imagemUrl: string;
  organizador: string;
  preco?: number;
  isGratuito: boolean;
  linkIngressos: string;
}

export function detectTicketPlatform(url: string): { key: string; label: string } {
  const u = (url || '').toLowerCase();
  if (u.includes('shotgun.live') || u.includes('shotgun')) {
    return { key: 'shotgun', label: 'Shotgun' };
  }
  if (u.includes('ingresse.com') || u.includes('ingresse')) {
    return { key: 'ingresse', label: 'Ingresse' };
  }
  if (u.includes('bilheto.com') || u.includes('bilheto')) {
    return { key: 'bilheto', label: 'Bilheto' };
  }
  if (u.includes('eventim.com') || u.includes('eventim')) {
    return { key: 'eventim', label: 'Eventim' };
  }
  if (u.includes('clubedoingresso.com') || u.includes('clubedoingresso')) {
    return { key: 'clubedoingresso', label: 'Clube do Ingresso' };
  }
  if (u.includes('ticket360.com') || u.includes('ticket360')) {
    return { key: 'ticket360', label: 'Ticket360' };
  }
  if (u.includes('sympla.com') || u.includes('bileto.sympla')) {
    return { key: 'sympla', label: 'Sympla' };
  }
  return { key: 'web', label: 'Web / Ingresso' };
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferCategory(title: string, desc: string): string {
  const text = `${title} ${desc}`.toLowerCase();

  if (
    text.includes('samba') ||
    text.includes('pagode') ||
    text.includes('feijoada') ||
    text.includes('cavaquinho') ||
    text.includes('partido alto')
  ) {
    return 'Samba e Pagode';
  }

  if (
    text.includes('baile nostalgia') ||
    text.includes('flashback') ||
    text.includes('flash back') ||
    text.includes('anos 70') ||
    text.includes('anos 80') ||
    text.includes('anos 90') ||
    text.includes('disco dance') ||
    text.includes('charme')
  ) {
    return 'Baile Nostalgia';
  }

  if (
    text.includes('terceira idade') ||
    text.includes('melhor idade') ||
    text.includes('dança de salão') ||
    text.includes('danca de salao') ||
    text.includes('bolero') ||
    text.includes('baile da saudade')
  ) {
    return 'Baile Terceira Idade';
  }

  if (
    text.includes('pé de serra') ||
    text.includes('pe de serra') ||
    text.includes('arrasta-pé') ||
    text.includes('arrasta pe') ||
    text.includes('sanfona de 8')
  ) {
    return 'Forró Pé de Serra';
  }

  if (
    text.includes('forró') ||
    text.includes('forro') ||
    text.includes('xote') ||
    text.includes('baião') ||
    text.includes('baiao') ||
    text.includes('piseiro') ||
    text.includes('arrasta pé')
  ) {
    return 'Forró';
  }

  if (
    text.includes('baile') ||
    text.includes('bailão') ||
    text.includes('bailao') ||
    text.includes('festa dançante')
  ) {
    return 'Bailes';
  }

  return 'Shows';
}

function parseBrazilianDate(dateStr: string): { date: string; time: string } {
  // Ex: "2026-10-25T20:00:00-03:00" ou "2026-10-25 20:00"
  if (!dateStr) {
    const today = new Date().toISOString().split('T')[0];
    return { date: today, time: '20:00' };
  }

  try {
    if (dateStr.includes('T') || dateStr.includes('-')) {
      const parts = dateStr.split('T');
      const datePart = parts[0].trim();
      let timePart = '20:00';
      if (parts[1]) {
        const tMatch = parts[1].match(/^(\d{2}:\d{2})/);
        if (tMatch) timePart = tMatch[1];
      }
      return { date: datePart, time: timePart };
    }
  } catch {
    // fallback
  }

  const today = new Date().toISOString().split('T')[0];
  return { date: today, time: '20:00' };
}

function normalizeUf(ufOrState: string): string {
  if (!ufOrState) return 'SP';
  const clean = ufOrState.trim().toUpperCase();
  if (clean.length === 2) return clean;

  const statesMap: Record<string, string> = {
    'SÃO PAULO': 'SP',
    'SAO PAULO': 'SP',
    'RIO DE JANEIRO': 'RJ',
    'MINAS GERAIS': 'MG',
    'BAHIA': 'BA',
    'PARANÁ': 'PR',
    'PARANA': 'PR',
    'RIO GRANDE DO SUL': 'RS',
    'SANTA CATARINA': 'SC',
    'PERNAMBUCO': 'PE',
    'CEARÁ': 'CE',
    'CEARA': 'CE',
    'DISTRITO FEDERAL': 'DF',
    'GOIÁS': 'GO',
    'GOIAS': 'GO',
    'ESPÍRITO SANTO': 'ES',
    'ESPIRITO SANTO': 'ES',
  };

  return statesMap[clean] || 'SP';
}

export async function parseSymplaEventUrl(rawUrl: string): Promise<ParsedSymplaEvent> {
  let url = rawUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Não foi possível acessar a página do evento (${response.status} ${response.statusText})`);
  }

  const html = await response.text();

  // 1. Procurar por JSON-LD schema.org/Event
  let jsonLdEvent: any = null;
  const jsonLdRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const content = match[1].trim();
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        const found = parsed.find((p) => p['@type'] === 'Event' || p['@type']?.includes('Event'));
        if (found) {
          jsonLdEvent = found;
          break;
        }
      } else if (parsed['@type'] === 'Event' || parsed['@type']?.includes('Event')) {
        jsonLdEvent = parsed;
        break;
      } else if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
        const found = parsed['@graph'].find((p: any) => p['@type'] === 'Event' || p['@type']?.includes('Event'));
        if (found) {
          jsonLdEvent = found;
          break;
        }
      }
    } catch {
      // continua buscando nos outros scripts ld+json
    }
  }

  // 2. Extrair OpenGraph & Meta Tags como suporte
  const getMeta = (prop: string): string => {
    const r1 = new RegExp(`<meta\\s+property=["']${prop}["']\\s+content=["'](.*?)["']`, 'i');
    const r2 = new RegExp(`<meta\\s+content=["'](.*?)["']\\s+property=["']${prop}["']`, 'i');
    const r3 = new RegExp(`<meta\\s+name=["']${prop}["']\\s+content=["'](.*?)["']`, 'i');
    const r4 = new RegExp(`<meta\\s+content=["'](.*?)["']\\s+name=["']${prop}["']`, 'i');
    const m = html.match(r1) || html.match(r2) || html.match(r3) || html.match(r4);
    return m ? m[1].trim() : '';
  };

  const getTag = (tag: string): string => {
    const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const m = html.match(r);
    return m ? stripHtml(m[1]) : '';
  };

  const ogTitle = getMeta('og:title');
  const ogImage = getMeta('og:image');
  const ogDesc = getMeta('og:description');
  const pageTitle = getTag('title');

  const platform = detectTicketPlatform(url);

  // Determinar Título
  let titulo = '';
  if (jsonLdEvent?.name) {
    titulo = stripHtml(jsonLdEvent.name);
  } else if (ogTitle) {
    titulo = stripHtml(ogTitle.replace(/[-|]\s*(Sympla|Shotgun|Ingresse|Bilheto|Eventim|Ticket360).*$/i, ''));
  } else if (pageTitle) {
    titulo = stripHtml(pageTitle.replace(/[-|]\s*(Sympla|Shotgun|Ingresse|Bilheto|Eventim|Ticket360).*$/i, ''));
  }

  // Determinar Descrição
  let descricao = '';
  if (jsonLdEvent?.description) {
    descricao = stripHtml(jsonLdEvent.description);
  } else if (ogDesc) {
    descricao = stripHtml(ogDesc);
  }

  // Determinar Imagem
  let imagemUrl = '';
  if (jsonLdEvent?.image) {
    if (typeof jsonLdEvent.image === 'string') {
      imagemUrl = jsonLdEvent.image;
    } else if (Array.isArray(jsonLdEvent.image) && jsonLdEvent.image[0]) {
      imagemUrl = typeof jsonLdEvent.image[0] === 'string' ? jsonLdEvent.image[0] : jsonLdEvent.image[0].url || '';
    } else if (jsonLdEvent.image.url) {
      imagemUrl = jsonLdEvent.image.url;
    }
  }
  if (!imagemUrl && ogImage) {
    imagemUrl = ogImage;
  }
  if (!imagemUrl) {
    imagemUrl = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1000&q=80';
  }

  // Determinar Data e Horário
  let dataEvento = '';
  let horario = '20:00';
  let horarioFim: string | undefined = undefined;

  if (jsonLdEvent?.startDate) {
    const s = parseBrazilianDate(jsonLdEvent.startDate);
    dataEvento = s.date;
    horario = s.time;
  }

  if (jsonLdEvent?.endDate) {
    const e = parseBrazilianDate(jsonLdEvent.endDate);
    horarioFim = e.time;
  }

  if (!dataEvento) {
    // Tenta encontrar padrão YYYY-MM-DD ou DD/MM/AAAA no texto
    const dateMatch = html.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (dateMatch) {
      dataEvento = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    } else {
      dataEvento = new Date().toISOString().split('T')[0];
    }
  }

  // Determinar Local, Endereço, Cidade e Estado
  let localNome = 'Local a Definir';
  let endereco = 'Endereço a Confirmar';
  let cidade = 'São Paulo';
  let estado = 'SP';
  let latitude: string | undefined = undefined;
  let longitude: string | undefined = undefined;

  if (jsonLdEvent?.location) {
    const loc = jsonLdEvent.location;
    if (loc.name) localNome = stripHtml(loc.name);

    if (loc.address) {
      if (typeof loc.address === 'string') {
        endereco = stripHtml(loc.address);
      } else {
        if (loc.address.streetAddress) endereco = stripHtml(loc.address.streetAddress);
        if (loc.address.addressLocality) cidade = stripHtml(loc.address.addressLocality);
        if (loc.address.addressRegion) estado = normalizeUf(loc.address.addressRegion);
      }
    }

    if (loc.geo) {
      if (loc.geo.latitude) latitude = String(loc.geo.latitude);
      if (loc.geo.longitude) longitude = String(loc.geo.longitude);
    }
  }

  // Fallback para cidade/local se ainda for genérico
  if (cidade === 'São Paulo' && endereco === 'Endereço a Confirmar') {
    // Tentar capturar menções comuns no texto
    const locMatch = html.match(/class=["'][^"']*location[^"']*["'][^>]*>([\s\S]*?)<\//i);
    if (locMatch) {
      const rawLoc = stripHtml(locMatch[1]);
      if (rawLoc.length > 5) localNome = rawLoc;
    }
  }

  // Determinar Organizador
  let organizador = 'Produção do Evento';
  if (jsonLdEvent?.organizer?.name) {
    organizador = stripHtml(jsonLdEvent.organizer.name);
  } else if (jsonLdEvent?.organizer && typeof jsonLdEvent.organizer === 'string') {
    organizador = stripHtml(jsonLdEvent.organizer);
  }

  // Determinar Preço e Ingresso
  let preco: number | undefined = undefined;
  let isGratuito = false;

  if (jsonLdEvent?.offers) {
    const off = Array.isArray(jsonLdEvent.offers) ? jsonLdEvent.offers[0] : jsonLdEvent.offers;
    if (off) {
      if (off.price !== undefined && off.price !== null) {
        const p = parseFloat(off.price);
        if (!isNaN(p)) {
          preco = p;
          if (p === 0) isGratuito = true;
        }
      }
    }
  }

  if (descricao.toLowerCase().includes('gratuito') || titulo.toLowerCase().includes('gratuito') || preco === 0) {
    isGratuito = true;
    preco = 0;
  }

  const categoriaSugerida = inferCategory(titulo, descricao);

  return {
    origem: platform.key,
    urlOrigem: url,
    titulo: titulo || `Evento ${platform.label}`,
    descricao: descricao || `Evento importado da plataforma ${platform.label}.`,
    categoriaSugerida,
    dataEvento,
    horario,
    horarioFim,
    localNome,
    endereco,
    cidade,
    estado,
    latitude,
    longitude,
    imagemUrl,
    organizador,
    preco,
    isGratuito,
    linkIngressos: url,
  };
}
