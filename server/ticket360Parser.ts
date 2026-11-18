// server/ticket360Parser.ts
// Extrator especializado de dados de eventos da Ticket360 (ticket360.com.br)

export interface ParsedTicket360Event {
  origem: 'ticket360';
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

export function inferTicket360Category(title: string, desc: string): string {
  const text = `${title} ${desc}`.toLowerCase();

  if (
    text.includes('samba') ||
    text.includes('pagode') ||
    text.includes('feijoada') ||
    text.includes('cavaquinho') ||
    text.includes('partido alto') ||
    text.includes('fundo de quintal') ||
    text.includes('jorge arag') ||
    text.includes('péricles') ||
    text.includes('pericles') ||
    text.includes('turma do pagode') ||
    text.includes('ferrugem') ||
    text.includes('thiaguinho') ||
    text.includes('dilsinho') ||
    text.includes('sorriso maroto') ||
    text.includes('chininha') ||
    text.includes('mr. dan') ||
    text.includes('batuke')
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
    text.includes('anos 2000') ||
    text.includes('disco dance') ||
    text.includes('charme') ||
    text.includes('rod hanna')
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
    text.includes('triângulo') ||
    text.includes('zabumba') ||
    text.includes('sanfona') ||
    text.includes('luiz gonzaga') ||
    text.includes('rastapé') ||
    text.includes('rastape')
  ) {
    return 'Forró Pé de Serra';
  }

  if (
    text.includes('forró') ||
    text.includes('forro') ||
    text.includes('piseiro') ||
    text.includes('brasas do forro') ||
    text.includes('calcinha preta') ||
    text.includes('mastruz')
  ) {
    return 'Forró';
  }

  if (
    text.includes('baile') ||
    text.includes('balada') ||
    text.includes('noite de gala') ||
    text.includes('festa') ||
    text.includes('sunset') ||
    text.includes('sunset party')
  ) {
    return 'Bailes';
  }

  return 'Shows';
}

const MONTH_NAMES_PT: Record<string, string> = {
  janeiro: '01',
  jan: '01',
  fevereiro: '02',
  fev: '02',
  março: '03',
  marco: '03',
  mar: '03',
  abril: '04',
  abr: '04',
  maio: '05',
  mai: '05',
  junho: '06',
  jun: '06',
  julho: '07',
  jul: '07',
  agosto: '08',
  ago: '08',
  setembro: '09',
  set: '09',
  outubro: '10',
  out: '10',
  novembro: '11',
  nov: '11',
  dezembro: '12',
  dez: '12',
};

export function parseDateStringPT(rawDate: string): { date: string; time?: string } {
  const currentYear = new Date().getFullYear();
  if (!rawDate) {
    return { date: new Date().toISOString().split('T')[0] };
  }

  // Se já for ISO: 2026-10-16 ou 2026-10-16T22:00:00
  if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
    const parts = rawDate.split('T');
    let time: string | undefined;
    if (parts[1]) {
      const timeMatch = parts[1].match(/^(\d{2}:\d{2})/);
      if (timeMatch) time = timeMatch[1];
    }
    return { date: parts[0], time };
  }

  // Tenta formato "11 Outubro" ou "11 out 2026"
  const clean = rawDate.toLowerCase().replace(/[^\w\sáéíóúãõç]/gi, ' ').trim();
  const tokens = clean.split(/\s+/);
  
  let day = '';
  let month = '';
  let year = String(currentYear);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^\d{1,2}$/.test(t) && !day) {
      day = t.padStart(2, '0');
    } else if (MONTH_NAMES_PT[t]) {
      month = MONTH_NAMES_PT[t];
    } else if (/^20\d{2}$/.test(t)) {
      year = t;
    }
  }

  if (day && month) {
    return { date: `${year}-${month}-${day}` };
  }

  return { date: new Date().toISOString().split('T')[0] };
}

export async function parseTicket360EventUrl(rawUrl: string): Promise<ParsedTicket360Event> {
  let url = rawUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Não foi possível acessar a página da Ticket360 (${response.status} ${response.statusText})`);
  }

  const html = await response.text();

  // 1. Procurar por JSON-LD schema.org/Event ou MusicEvent
  let jsonLdEvent: any = null;
  const jsonLdRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const content = match[1].trim();
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        const found = parsed.find(
          (p) => p['@type'] === 'Event' || p['@type'] === 'MusicEvent' || p['@type']?.includes('Event')
        );
        if (found) {
          jsonLdEvent = found;
          break;
        }
      } else if (parsed['@type'] === 'Event' || parsed['@type'] === 'MusicEvent' || parsed['@type']?.includes('Event')) {
        jsonLdEvent = parsed;
        break;
      }
    } catch {}
  }

  // 2. Extrair Meta Tags
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

  // Determinar Título
  let titulo = '';
  if (jsonLdEvent?.name) {
    titulo = stripHtml(jsonLdEvent.name);
  } else if (ogTitle) {
    titulo = stripHtml(ogTitle.replace(/[-|—·]\s*(Ingressos|Ticket360).*$/i, ''));
  } else if (pageTitle) {
    titulo = stripHtml(pageTitle.replace(/[-|—·]\s*(Ingressos|Ticket360).*$/i, ''));
  }

  // Determinar Descrição
  let descricao = '';
  if (jsonLdEvent?.description) {
    descricao = stripHtml(jsonLdEvent.description);
  } else if (ogDesc) {
    descricao = stripHtml(ogDesc);
  }

  // Determinar Data e Horário
  let dataEvento = new Date().toISOString().split('T')[0];
  let horario = '20:00';
  let horarioFim: string | undefined = undefined;

  if (jsonLdEvent?.startDate) {
    const parsedStart = parseDateStringPT(String(jsonLdEvent.startDate));
    dataEvento = parsedStart.date;
    if (parsedStart.time) {
      horario = parsedStart.time;
    }
  }

  // Buscar horário de abertura / início no HTML
  const timeRegex = /(?:abertura|in[ií]cio|hor[aá]rio)[^<]{0,40}?(\d{1,2}[:h]\d{2})/i;
  const timeMatch = html.match(timeRegex);
  if (timeMatch) {
    let t = timeMatch[1].replace('h', ':');
    if (t.length === 4) t = '0' + t;
    horario = t;
  }

  // Determinar Local, Endereço, Cidade, Estado
  let localNome = 'Local a confirmar';
  let endereco = '';
  let cidade = 'São Paulo';
  let estado = 'SP';
  let latitude: string | undefined;
  let longitude: string | undefined;

  if (jsonLdEvent?.location) {
    const loc = jsonLdEvent.location;
    if (loc.name) localNome = stripHtml(loc.name);
    if (loc.address) {
      if (typeof loc.address === 'string') {
        endereco = stripHtml(loc.address);
      } else {
        const addr = loc.address;
        const street = addr.streetAddress || '';
        const number = addr.addressLocality || '';
        endereco = street ? `${street}` : '';
        if (addr.addressLocality) cidade = stripHtml(addr.addressLocality);
        if (addr.addressRegion) estado = stripHtml(addr.addressRegion).toUpperCase().substring(0, 2);
      }
    }
    if (loc.geo) {
      if (loc.geo.latitude) latitude = String(loc.geo.latitude);
      if (loc.geo.longitude) longitude = String(loc.geo.longitude);
    }
  }

  // Imagem
  let imagemUrl = '';
  if (jsonLdEvent?.image) {
    if (Array.isArray(jsonLdEvent.image)) {
      imagemUrl = jsonLdEvent.image[0] || '';
    } else if (typeof jsonLdEvent.image === 'string') {
      imagemUrl = jsonLdEvent.image;
    }
  }
  if (!imagemUrl && ogImage) {
    imagemUrl = ogImage;
  }
  if (imagemUrl.includes('/_next/image?url=')) {
    const m = imagemUrl.match(/url=([^&]+)/);
    if (m) imagemUrl = decodeURIComponent(m[1]);
  }

  // Preço e Ingressos
  let preco = 0;
  let isGratuito = false;

  if (jsonLdEvent?.offers) {
    const offers = jsonLdEvent.offers;
    if (typeof offers.lowPrice === 'number') {
      preco = offers.lowPrice;
    } else if (typeof offers.price === 'number') {
      preco = offers.price;
    } else if (typeof offers.lowPrice === 'string') {
      preco = parseFloat(offers.lowPrice) || 0;
    }
  }

  if (preco === 0) {
    // Procura por preço no texto ogDesc ou html
    const priceMatch = (ogDesc + ' ' + html).match(/R\$\s*([\d.,]+)/i);
    if (priceMatch) {
      const valStr = priceMatch[1].replace('.', '').replace(',', '.');
      const parsedVal = parseFloat(valStr);
      if (!isNaN(parsedVal) && parsedVal > 0) {
        preco = parsedVal;
      }
    }
  }

  if ((ogDesc + ' ' + titulo).toLowerCase().includes('gratuito') || (ogDesc + ' ' + titulo).toLowerCase().includes('entrada franca')) {
    isGratuito = true;
    preco = 0;
  }

  // Organizador
  let organizador = 'Ticket360 Entretenimento';
  if (jsonLdEvent?.organizer?.name) {
    organizador = stripHtml(jsonLdEvent.organizer.name);
  } else if (jsonLdEvent?.performer) {
    if (Array.isArray(jsonLdEvent.performer) && jsonLdEvent.performer[0]?.name) {
      organizador = stripHtml(jsonLdEvent.performer[0].name);
    } else if (jsonLdEvent.performer.name) {
      organizador = stripHtml(jsonLdEvent.performer.name);
    }
  }

  // Categoria sugerida
  const categoriaSugerida = inferTicket360Category(titulo, descricao);

  return {
    origem: 'ticket360',
    urlOrigem: url,
    titulo: titulo || 'Evento Ticket360',
    descricao: descricao || '',
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
