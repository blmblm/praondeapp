import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export const BRAZIL_CITY_COORDINATES: Record<string, { latitude: string; longitude: string }> = {
  'santo andre': { latitude: '-23.6575', longitude: '-46.5312' },
  'sao paulo': { latitude: '-23.5505', longitude: '-46.6333' },
  'sao bernardo do campo': { latitude: '-23.6944', longitude: '-46.5654' },
  'sao caetano do sul': { latitude: '-23.6229', longitude: '-46.5547' },
  'diadema': { latitude: '-23.6865', longitude: '-46.6234' },
  'maua': { latitude: '-23.6687', longitude: '-46.4614' },
  'ribeirao pires': { latitude: '-23.7142', longitude: '-46.4137' },
  'rio de janeiro': { latitude: '-22.9068', longitude: '-43.1729' },
  'belo horizonte': { latitude: '-19.9167', longitude: '-43.9345' },
  'curitiba': { latitude: '-25.4284', longitude: '-49.2733' },
  'porto alegre': { latitude: '-30.0346', longitude: '-51.2177' },
  'salvador': { latitude: '-12.9777', longitude: '-38.5016' },
  'recife': { latitude: '-8.0476', longitude: '-34.8770' },
  'fortaleza': { latitude: '-3.7172', longitude: '-38.5433' },
  'brasilia': { latitude: '-15.7975', longitude: '-47.8919' },
  'campinas': { latitude: '-22.9099', longitude: '-47.0626' },
  'santos': { latitude: '-23.9608', longitude: '-46.3336' },
  'sorocaba': { latitude: '-23.5015', longitude: '-47.4526' },
  'sao jose dos campos': { latitude: '-23.2237', longitude: '-45.9009' },
  'ribeirao preto': { latitude: '-21.1704', longitude: '-47.8103' },
  'osasco': { latitude: '-23.5329', longitude: '-46.7919' },
  'guarulhos': { latitude: '-23.4542', longitude: '-46.5333' },
  'barueri': { latitude: '-23.5111', longitude: '-46.8764' },
  'cotia': { latitude: '-23.6036', longitude: '-46.9189' },
  'mogi das cruzes': { latitude: '-23.5208', longitude: '-46.1854' },
  'praia grande': { latitude: '-24.0058', longitude: '-46.4029' },
  'sao vicente': { latitude: '-23.9631', longitude: '-46.3919' },
  'guaruja': { latitude: '-23.9931', longitude: '-46.2564' },
  'cubatao': { latitude: '-23.8950', longitude: '-46.4253' },
  'bertioga': { latitude: '-23.8544', longitude: '-46.1383' },
  'mongagua': { latitude: '-24.0931', longitude: '-46.6208' },
  'itanhaem': { latitude: '-24.1831', longitude: '-46.7889' },
  'peruibe': { latitude: '-24.3200', longitude: '-46.9983' },
  'bauru': { latitude: '-22.3147', longitude: '-49.0606' },
  'carapicuiba': { latitude: '-23.5222', longitude: '-46.8356' },
  'franca': { latitude: '-20.5386', longitude: '-47.4008' },
  'itaquaquecetuba': { latitude: '-23.4861', longitude: '-46.3483' },
  'jundiai': { latitude: '-23.1857', longitude: '-46.8978' },
  'piracicaba': { latitude: '-22.7338', longitude: '-47.6476' },
  'sao jose do rio preto': { latitude: '-20.8114', longitude: '-49.3758' },
  'ubatuba': { latitude: '-23.4338', longitude: '-45.0838' },
  'limeira': { latitude: '-22.5644', longitude: '-47.4017' },
  'mairipora': { latitude: '-23.3186', longitude: '-46.5867' },
  'ourinhos': { latitude: '-22.9789', longitude: '-49.8706' },
  'pindamonhangaba': { latitude: '-22.9242', longitude: '-45.4614' },
};

export function normalizeCityKey(str: string): string {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function isCleanImage(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === '[video_local_sqlite]') return false;
  if (trimmed.includes('images.unsplash.com/photo-1514525253161-7a46d19cd819')) return false;
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/uploads/images/') ||
    trimmed.startsWith('/assets/') ||
    trimmed.startsWith('./uploads/images/')
  );
}

export function isCleanVideo(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === '[video_local_sqlite]') return false;
  return (
    trimmed.startsWith('data:video/') ||
    trimmed.startsWith('data:application/octet-stream') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/uploads/videos/') ||
    trimmed.startsWith('./uploads/videos/') ||
    trimmed.startsWith('/api/video/') ||
    /\.(mp4|webm|ogg|mov|m4v)($|\?|#)/i.test(trimmed) ||
    trimmed.includes('youtube.com') ||
    trimmed.includes('youtu.be') ||
    trimmed.includes('facebook.com') ||
    trimmed.includes('fb.watch') ||
    trimmed.includes('fb.') ||
    trimmed.includes('instagram.com') ||
    trimmed.includes('tiktok.com') ||
    trimmed.includes('vimeo.com')
  );
}

export function autoExtractPosterFromVideo(id: string, videoUrl: string | null | undefined): string {
  if (!videoUrl) return '';
  const trimmed = String(videoUrl).trim();

  if (trimmed.includes('youtu.be') || trimmed.includes('youtube.com')) {
    const ytMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|live\/))([\w-]{11})/i);
    if (ytMatch && ytMatch[1]) {
      return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    }
  }

  if (trimmed.startsWith('/uploads/videos/') || trimmed.startsWith('./uploads/videos/')) {
    const bn = path.basename(trimmed);
    const candidates = [
      path.join(process.cwd(), 'uploads', 'videos', bn),
      path.join(process.cwd(), 'public', 'uploads', 'videos', bn),
      path.join('/tmp', 'uploads', 'videos', bn),
    ];
    const videoDiskPath = candidates.find((p) => fs.existsSync(p));
    if (videoDiskPath) {
      try {
        const posterName = `${id}.jpg`;
        const posterDir = path.join(process.cwd(), 'uploads', 'images');
        if (!fs.existsSync(posterDir)) fs.mkdirSync(posterDir, { recursive: true });
        const posterPath = path.join(posterDir, posterName);
        execSync(`ffmpeg -ss 00:00:01 -i "${videoDiskPath}" -vframes 1 -q:v 2 "${posterPath}" -y`, {
          timeout: 8000,
          stdio: 'ignore',
        });
        if (fs.existsSync(posterPath) && fs.statSync(posterPath).size > 500) {
          const buf = fs.readFileSync(posterPath);
          return `data:image/jpeg;base64,${buf.toString('base64')}`;
        }
      } catch {
        // Ignore ffmpeg errors cleanly
      }
    }
  }
  return '';
}
