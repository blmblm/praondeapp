/**
 * Firewall de Aplicação & Proteção contra Acessos Maliciosos
 * 
 * Proteções:
 * 1. Bloqueio instantâneo de sondagens e scanners maliciosos (.env, .git, wp-admin, phpmyadmin, etc.)
 * 2. Bloqueio de User-Agents maliciosos (sqlmap, nikto, acunetix, masscan, dirbuster, gobuster)
 * 3. Proteção contra Prototype Pollution
 * 4. Rate Limiting inteligente por IP (com limites específicos por criticidade de rota)
 * 5. Cabeçalhos de segurança HTTP rígidos
 * 6. Lista temporária de quarentena de IPs abusivos
 */

import type { Request, Response, NextFunction } from 'express';

// Quarentena temporária de IPs identificados como maliciosos (30 minutos)
const bannedIps = new Map<string, number>();
const BAN_DURATION_MS = 30 * 60 * 1000;

// Rate limiting em memória por IP e rota
interface RequestLog {
  count: number;
  firstRequest: number;
}
const ipRateLimits = new Map<string, RequestLog>();

// Padrões de caminhos comuns buscados por bots e scanners maliciosos
const MALICIOUS_PATH_PATTERNS = [
  /\/\.env/i,
  /\/\.git/i,
  /\/\.aws/i,
  /\/\.ssh/i,
  /\/wp-admin/i,
  /\/wp-login/i,
  /\/wp-content/i,
  /\/wp-includes/i,
  /\/xmlrpc\.php/i,
  /\/phpmyadmin/i,
  /\/pma/i,
  /\/adminer/i,
  /\/eval-stdin/i,
  /\/actuator/i,
  /\/solr/i,
  /\/\.ds_store/i,
  /\/backup/i,
  /\/dump\.sql/i,
  /\/database\.sqlite/i,
  /\/server\.ts$/i,
  /\/boaform/i,
  /\/cgi-bin/i,
  /\/etc\/passwd/i,
  /\.php$/i,
];

// User-agents de ferramentas de scanning e ataque conhecidas
const MALICIOUS_USER_AGENTS = [
  /sqlmap/i,
  /nikto/i,
  /acunetix/i,
  /masscan/i,
  /dirbuster/i,
  /gobuster/i,
  /nmap/i,
  /zgrab/i,
  /havij/i,
  /w3af/i,
];

/**
 * Obtém o IP real do cliente, considerando proxies reversos do Cloud Run e Express
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.socket.remoteAddress || req.ip || '127.0.0.1';
}

/**
 * Middleware central de segurança e firewall
 */
export function securityFirewall(req: Request, res: Response, next: NextFunction) {
  const clientIp = getClientIp(req);
  const path = req.path;
  const userAgent = String(req.headers['user-agent'] || '');
  const now = Date.now();

  // 1. Oculta cabeçalho do Express
  res.removeHeader('X-Powered-By');

  // 2. Aplica cabeçalhos defensivos essenciais
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  if (path.startsWith('/uploads/') || path.startsWith('/assets/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  } else {
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  }

  // 3. Verifica se o IP está em quarentena de segurança
  const bannedUntil = bannedIps.get(clientIp);
  if (bannedUntil && now < bannedUntil) {
    const remaining = Math.ceil((bannedUntil - now) / 1000);
    return res.status(403).json({
      error: 'Acesso bloqueado por segurança.',
      message: `Este endereço IP foi temporariamente bloqueado após detecção de atividades maliciosas. Tente novamente em ${remaining} segundos.`
    });
  } else if (bannedUntil && now >= bannedUntil) {
    bannedIps.delete(clientIp);
  }

  // 4. Bloqueia scanners de vulnerabilidades e caminhos maliciosos (exceto rotas administrativas da própria aplicação)
  if (!path.startsWith('/api/admin/')) {
    for (const pattern of MALICIOUS_PATH_PATTERNS) {
      if (pattern.test(path)) {
        if (clientIp !== '127.0.0.1' && clientIp !== '::1' && clientIp !== 'localhost') {
          bannedIps.set(clientIp, now + BAN_DURATION_MS);
        }
        console.warn(`[Segurança - Firewall] Scanner malicioso bloqueado: IP ${clientIp} tentou acessar ${path} (User-Agent: ${userAgent})`);
        return res.status(403).json({ error: 'Acesso negado por violação de segurança.' });
      }
    }
  }

  // 5. Bloqueia User-Agents de ferramentas de ataque
  for (const pattern of MALICIOUS_USER_AGENTS) {
    if (pattern.test(userAgent)) {
      if (clientIp !== '127.0.0.1' && clientIp !== '::1' && clientIp !== 'localhost') {
        bannedIps.set(clientIp, now + BAN_DURATION_MS);
      }
      console.warn(`[Segurança - Firewall] Ferramenta maliciosa bloqueada: IP ${clientIp} com User-Agent ${userAgent}`);
      return res.status(403).json({ error: 'Acesso proibido para agentes automatizados maliciosos.' });
    }
  }

  // 6. Proteção contra Prototype Pollution no corpo da requisição
  if (req.body && typeof req.body === 'object') {
    if (hasPrototypePollution(req.body)) {
      console.warn(`[Segurança - Firewall] Tentativa de Prototype Pollution detectada do IP ${clientIp}`);
      return res.status(400).json({ error: 'Requisição inválida (payload rejeitado por segurança).' });
    }
  }

  next();
}

/**
 * Detector recursivo de Prototype Pollution
 */
function hasPrototypePollution(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  
  if (Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
      Object.prototype.hasOwnProperty.call(obj, 'constructor') ||
      Object.prototype.hasOwnProperty.call(obj, 'prototype')) {
    return true;
  }

  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return true;
    }
    const val = obj[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (hasPrototypePollution(val)) return true;
    }
  }

  return false;
}

/**
 * Cria um middleware de Rate Limit específico por categoria de rota
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  routeName: string;
  message?: string;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = getClientIp(req);
    const key = `${options.routeName}:${clientIp}`;
    const now = Date.now();

    const record = ipRateLimits.get(key);

    if (!record || now - record.firstRequest > options.windowMs) {
      ipRateLimits.set(key, { count: 1, firstRequest: now });
      return next();
    }

    record.count++;

    if (record.count > options.maxRequests) {
      const waitSeconds = Math.ceil((record.firstRequest + options.windowMs - now) / 1000);
      res.setHeader('Retry-After', waitSeconds);
      return res.status(429).json({
        error: 'Muitas requisições.',
        message: options.message || `Limite excedido para esta operação. Aguarde ${waitSeconds} segundos antes de tentar novamente.`
      });
    }

    next();
  };
}

// Limpador periódico de memória a cada 10 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of ipRateLimits.entries()) {
    if (now - record.firstRequest > 300000) {
      ipRateLimits.delete(key);
    }
  }
  for (const [ip, until] of bannedIps.entries()) {
    if (now >= until) {
      bannedIps.delete(ip);
    }
  }
}, 10 * 60 * 1000);
