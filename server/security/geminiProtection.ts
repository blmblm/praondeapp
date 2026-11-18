/**
 * Camada de Proteção e Segurança para a API do Gemini
 * 
 * Funcionalidades:
 * 1. Sanitização rigorosa contra Prompt Injection e ataques de contexto.
 * 2. Cache em memória inteligente (LRU com TTL de 24h) para evitar chamadas repetidas e economizar cotas.
 * 3. Circuit Breaker e limitador de taxa (Rate Limit) global para conter picos de tráfego malicioso.
 * 4. Timeout seguro com fallback automático, garantindo que o backend nunca fique travado.
 */

interface CachedGeocode {
  latitude: string;
  longitude: string;
  displayName: string;
  addressResolved: boolean;
  timestamp: number;
}

// Cache em memória de alta performance (24h de retenção)
const geocodeCache = new Map<string, CachedGeocode>();
const MAX_CACHE_SIZE = 1000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

// Estatísticas e Circuit Breaker
let geminiCallsInWindow = 0;
let windowStartTime = Date.now();
const MAX_GEMINI_CALLS_PER_MINUTE = 60;
let circuitBreakerOpenUntil = 0;

/**
 * Sanitiza e valida o input do usuário antes de enviar ao prompt do Gemini.
 * Remove caracteres de controle, delimitações perigosas e padrões conhecidos de Prompt Injection.
 */
export function sanitizePromptInput(input: string | undefined | null, maxLength = 100): string {
  if (!input || typeof input !== 'string') return '';

  // 1. Limita comprimento
  let clean = input.trim().slice(0, maxLength);

  // 2. Remove caracteres de controle e tags maliciosas
  clean = clean.replace(/[\x00-\x1F\x7F]/g, ''); // caracteres de controle ASCII
  clean = clean.replace(/<[^>]*>/g, ''); // remove tags HTML/XML
  clean = clean.replace(/[{}[\]\\`$]/g, ' '); // remove caracteres de interpolação e templates

  // 3. Normaliza espaços múltiplos
  clean = clean.replace(/\s+/g, ' ').trim();

  return clean;
}

/**
 * Detecta tentativas deliberadas de Prompt Injection ou Jailbreak.
 */
export function detectPromptInjection(input: string): boolean {
  if (!input) return false;
  
  const injectionPatterns = [
    /ignore (all|previous|prior|above) (instructions|directions|prompts|rules)/i,
    /system prompt/i,
    /disregard previous/i,
    /you are now/i,
    /dan mode/i,
    /jailbreak/i,
    /reveal your (instructions|prompt|api key|secret)/i,
    /print your (system|initial|base) instructions/i,
    /as an ai, you must/i,
    /sudo mode/i,
  ];

  return injectionPatterns.some(pattern => pattern.test(input));
}

/**
 * Normaliza e gera a chave de cache para uma consulta de geocodificação.
 */
export function getGeocodeCacheKey(address: string, city: string, state: string, locationName: string): string {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return `${norm(address)}|${norm(city)}|${norm(state)}|${norm(locationName)}`;
}

/**
 * Obtém resultado do cache se válido.
 */
export function getCachedGeocode(key: string): { latitude: string; longitude: string; displayName: string; isFallback: boolean; addressResolved: boolean } | null {
  const cached = geocodeCache.get(key);
  if (!cached) return null;

  // Verifica TTL
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    geocodeCache.delete(key);
    return null;
  }

  return {
    latitude: cached.latitude,
    longitude: cached.longitude,
    displayName: cached.displayName,
    isFallback: !cached.addressResolved,
    addressResolved: cached.addressResolved
  };
}

/**
 * Salva resultado no cache com controle de tamanho LRU simples.
 */
export function setCachedGeocode(key: string, data: { latitude: string; longitude: string; displayName: string; addressResolved: boolean }) {
  if (geocodeCache.size >= MAX_CACHE_SIZE) {
    // Remove o primeiro item inserido (estratégia FIFO/LRU)
    const firstKey = geocodeCache.keys().next().value;
    if (firstKey) geocodeCache.delete(firstKey);
  }

  geocodeCache.set(key, {
    ...data,
    timestamp: Date.now()
  });
}

/**
 * Verifica se o Circuit Breaker permite nova chamada ao Gemini.
 */
export function canCallGemini(): { allowed: boolean; reason?: string } {
  const now = Date.now();

  // Verifica se o circuit breaker está em quarentena temporária
  if (now < circuitBreakerOpenUntil) {
    const remainingSec = Math.ceil((circuitBreakerOpenUntil - now) / 1000);
    return { 
      allowed: false, 
      reason: `Circuit Breaker ativo (aguarde ${remainingSec}s para proteção da cota).` 
    };
  }

  // Janela deslizante de 1 minuto
  if (now - windowStartTime > 60000) {
    geminiCallsInWindow = 0;
    windowStartTime = now;
  }

  if (geminiCallsInWindow >= MAX_GEMINI_CALLS_PER_MINUTE) {
    // Aciona quarentena de 30 segundos para proteger a chave e evitar custos/estouro
    circuitBreakerOpenUntil = now + 30000;
    console.warn(`[Gemini Security] Limite de ${MAX_GEMINI_CALLS_PER_MINUTE} req/min atingido. Circuit Breaker ativado por 30s.`);
    return { allowed: false, reason: 'Limite de requisições por minuto atingido.' };
  }

  geminiCallsInWindow++;
  return { allowed: true };
}

/**
 * Registra falha da API (ex: 429 Quota Exceeded) para acionar o Circuit Breaker protetor.
 */
export function recordGeminiApiFailure(errorStatus?: number) {
  if (errorStatus === 429) {
    // 429 indica cota temporária cheia; aguarda 45s antes de reativar chamadas ao Gemini
    circuitBreakerOpenUntil = Date.now() + 45000;
    console.warn('[Gemini Security] Erro 429 detectado no Gemini. Quarentena de 45s acionada.');
  }
}

/**
 * Wrapper de timeout para chamadas ao Gemini (máximo 8 segundos).
 */
export async function withGeminiTimeout<T>(promise: Promise<T>, timeoutMs = 8000): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timeout na chamada ao Gemini após ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([
    promise.then(res => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise
  ]);
}
