import QRCode from 'qrcode';

/**
 * Módulo Oficial de Geração e Validação de PIX (Padrão Banco Central do Brasil - BR Code / EMV)
 * Compatível com todos os bancos brasileiros (Bradesco, Itaú, Nubank, Banco do Brasil, Santander, Caixa, Inter, etc.)
 */

export interface PixConfig {
  chavePix: string;
  tipoChave: 'email' | 'telefone' | 'cpf' | 'cnpj' | 'aleatoria';
  nomeBeneficiario: string;
  cidadeBeneficiario: string;
  mercadoPagoToken?: string;
}

export interface GeneratePixOptions {
  chavePix: string;
  nomeBeneficiario: string;
  cidadeBeneficiario: string;
  valor: number;
  txId?: string;
  descricao?: string;
}

export interface GeneratedPixResult {
  qrCode: string; // Código Pix Copia e Cola completo no padrão BACEN
  qrCodeBase64: string; // Imagem PNG em formato data:image/png;base64,...
  chavePix: string;
  nomeBeneficiario: string;
  cidadeBeneficiario: string;
  valor: number;
  txId: string;
}

/**
 * Remove acentos e caracteres não ASCII para conformidade estrita com o padrão EMV/BACEN
 */
export function sanitizeTextForPix(text: string, maxLength: number): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove marcas diacríticas
    .replace(/[^a-zA-Z0-9 ]/g, ' ') // caracteres especiais viram espaço
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, maxLength);
}

/**
 * Sanitiza a Chave Pix dependendo do tipo
 */
export function sanitizePixKey(key: string, tipo?: string): string {
  const clean = (key || '').trim();
  if (!tipo) {
    if (clean.includes('@')) return clean.toLowerCase();
    const digits = clean.replace(/\D/g, '');
    if (digits.length === 11 && !clean.startsWith('+')) return digits;
    if (digits.length === 14) return digits;
    return clean;
  }

  switch (tipo.toLowerCase()) {
    case 'email':
      return clean.toLowerCase();
    case 'cpf':
      return clean.replace(/\D/g, '').slice(0, 11);
    case 'cnpj':
      return clean.replace(/\D/g, '').slice(0, 14);
    case 'telefone': {
      let tel = clean.replace(/\D/g, '');
      if (tel.length <= 11 && !tel.startsWith('55')) {
        tel = '55' + tel;
      }
      return '+' + tel;
    }
    case 'aleatoria':
    default:
      return clean;
  }
}

/**
 * Formata campo EMV TLV (Tag, Length com 2 dígitos, Valor)
 */
export function formatEMV(id: string, value: string): string {
  const len = Buffer.byteLength(value, 'utf8').toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

/**
 * Calcula o checksum CRC16-CCITT (Polinômio 0x1021, Init 0xFFFF)
 * Exigido rigorosamente pelo Banco Central do Brasil em códigos BR Code (Pix).
 * Bancos como o Bradesco rejeitam qualquer código cujo CRC16 seja inválido.
 */
export function computePixCrc16(payload: string): string {
  let crc = 0xFFFF;
  const polynomial = 0x1021;

  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) << 8);
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Constrói o código Pix Copia e Cola (BR Code) 100% aderente ao padrão Banco Central
 */
export function buildBacenPixPayload(options: GeneratePixOptions): string {
  const { chavePix, valor, txId, descricao } = options;

  // 00 - Payload Format Indicator (Fixo: 01)
  const f00 = formatEMV('00', '01');

  // 01 - Point of Initiation Method: 12 (Dinâmico / com valor por transação) ou 11 (Estático)
  // BACEN: '12' para QR estático com valor específico de cobrança
  const f01 = formatEMV('01', '12');

  // 26 - Merchant Account Information (Pix)
  const m00 = formatEMV('00', 'br.gov.bcb.pix');
  const cleanKey = chavePix.trim();
  const m01 = formatEMV('01', cleanKey);
  const m02 = descricao ? formatEMV('02', sanitizeTextForPix(descricao, 25)) : '';
  const f26 = formatEMV('26', m00 + m01 + m02);

  // 52 - Merchant Category Code (0000 para ISO 18245 padrão)
  const f52 = formatEMV('52', '0000');

  // 53 - Transaction Currency (986 para BRL)
  const f53 = formatEMV('53', '986');

  // 54 - Transaction Amount (Formato 100.00 com 2 casas decimais)
  const f54 = formatEMV('54', valor.toFixed(2));

  // 58 - Country Code (BR)
  const f58 = formatEMV('58', 'BR');

  // 59 - Merchant Name (Máx 25 caracteres, sem acentos)
  const safeName = sanitizeTextForPix(options.nomeBeneficiario || 'PRA ONDE EU VOU', 25) || 'PRA ONDE EU VOU';
  const f59 = formatEMV('59', safeName);

  // 60 - Merchant City (Máx 15 caracteres, sem acentos)
  const safeCity = sanitizeTextForPix(options.cidadeBeneficiario || 'PRAIA GRANDE', 15) || 'PRAIA GRANDE';
  const f60 = formatEMV('60', safeCity);

  // 62 - Additional Data Field Template (txid)
  // BACEN: txid de até 25 caracteres alfanuméricos sem caracteres especiais, ou '***'
  const safeTxId = (txId || '***').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || '***';
  const add05 = formatEMV('05', safeTxId);
  const f62 = formatEMV('62', add05);

  // Concatenação de todos os campos antes do CRC
  const rawPayload = `${f00}${f01}${f26}${f52}${f53}${f54}${f58}${f59}${f60}${f62}6304`;

  // 63 - CRC16 calculado sobre todo o rawPayload
  const crc = computePixCrc16(rawPayload);

  return `${rawPayload}${crc}`;
}

/**
 * Gera imagem QR Code em alta definição no formato Data URL (base64 PNG)
 * para leitura imediata pela câmera de celulares e apps bancários
 */
export async function generatePixQRCodeDataUrl(pixPayload: string): Promise<string> {
  return await QRCode.toDataURL(pixPayload, {
    width: 420,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
}
