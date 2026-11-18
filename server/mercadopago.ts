/**
 * Helper para integração com Mercado Pago via API REST Oficial
 * E Gerador Oficial de PIX padrão Banco Central do Brasil (BR Code / EMV)
 * Compatível com todos os bancos brasileiros (Bradesco, Nubank, Itaú, Banco do Brasil, Santander, etc.)
 */
import { buildBacenPixPayload, generatePixQRCodeDataUrl, sanitizePixKey } from './pixHelper.ts';
import { getPixConfigPg } from '../src/db/sponsorsPixRepo.ts';

export interface CreatePixPaymentParams {
  transactionAmount: number;
  description: string;
  payerEmail: string;
  payerName: string;
  payerPhone: string;
  externalReference: string;
  notificationUrl?: string;
}

export interface PixPaymentResult {
  success: boolean;
  paymentId: string;
  status: string;
  statusDetail: string;
  qrCode: string; // Código Pix Copia e Cola (BR Code válido com CRC16 BACEN)
  qrCodeBase64: string; // Imagem PNG base64 do QR Code para leitura pela câmera do celular
  ticketUrl: string;
  isSimulated?: boolean;
  errorMessage?: string;
  chavePix: string;
  tipoChave: string;
  nomeBeneficiario: string;
  cidadeBeneficiario: string;
}

export async function createMercadoPagoPixPayment(params: CreatePixPaymentParams): Promise<PixPaymentResult> {
  const pixConfig = await getPixConfigPg();
  const token = (pixConfig.mercadoPagoToken || process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim();

  // Função auxiliar para gerar Pix oficial do Banco Central (BACEN BR Code)
  const generateOfficialBacenPix = async (simulated = false): Promise<PixPaymentResult> => {
    const safeTxId = (params.externalReference || `PROT${Date.now()}`).replace(/[^a-zA-Z0-9]/g, '').slice(-15);
    
    const bacenPayload = buildBacenPixPayload({
      chavePix: sanitizePixKey(pixConfig.chavePix, pixConfig.tipoChave),
      nomeBeneficiario: pixConfig.nomeBeneficiario,
      cidadeBeneficiario: pixConfig.cidadeBeneficiario,
      valor: params.transactionAmount,
      txId: safeTxId,
      descricao: 'PATROCINIO PRA ONDE EU VOU',
    });

    const qrBase64 = await generatePixQRCodeDataUrl(bacenPayload);
    const paymentId = `PIX-${Date.now()}`;

    return {
      success: true,
      paymentId,
      status: 'pending',
      statusDetail: 'waiting_transfer',
      qrCode: bacenPayload,
      qrCodeBase64: qrBase64,
      ticketUrl: '',
      isSimulated: simulated,
      chavePix: pixConfig.chavePix,
      tipoChave: pixConfig.tipoChave,
      nomeBeneficiario: pixConfig.nomeBeneficiario,
      cidadeBeneficiario: pixConfig.cidadeBeneficiario,
    };
  };

  // Se o token do Mercado Pago não estiver configurado, geramos imediatamente o Pix oficial BACEN
  // com a chave Pix cadastrada (ex: praondeeu@gmail.com), QR Code real e CRC16 válido
  if (!token) {
    console.log(`[PIX Oficial] Gerando Pix Padrão BACEN com a Chave: ${pixConfig.chavePix}`);
    return await generateOfficialBacenPix(false);
  }

  // Se houver token do Mercado Pago, tenta gerar via API oficial do Mercado Pago
  try {
    const payload = {
      transaction_amount: Number(params.transactionAmount.toFixed(2)),
      description: params.description || 'Patrocínio no App Pra Onde Eu Vou (R$ 100/mês)',
      payment_method_id: 'pix',
      external_reference: params.externalReference,
      notification_url: params.notificationUrl || undefined,
      payer: {
        email: params.payerEmail || 'anunciante@praondeeuvou.com.br',
        first_name: params.payerName || 'Anunciante Parceiro',
        identification: {
          type: 'CPF',
          number: '11111111111',
        },
      },
    };

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Idempotency-Key': `pix-${params.externalReference}-${Date.now()}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.warn('[Mercado Pago API Warning] Falha na API Mercado Pago, usando fallback BACEN seguro:', data);
      return await generateOfficialBacenPix(false);
    }

    const txData = data.point_of_interaction?.transaction_data;
    const rawQrCode = txData?.qr_code || '';
    let qrCodeBase64 = txData?.qr_code_base64 || '';

    // Se o Mercado Pago retornar apenas o código texto mas não o base64 da imagem, geramos a imagem real
    if (rawQrCode && !qrCodeBase64) {
      qrCodeBase64 = await generatePixQRCodeDataUrl(rawQrCode);
    }

    return {
      success: true,
      paymentId: String(data.id),
      status: data.status || 'pending',
      statusDetail: data.status_detail || 'waiting_transfer',
      qrCode: rawQrCode,
      qrCodeBase64,
      ticketUrl: txData?.ticket_url || '',
      isSimulated: false,
      chavePix: pixConfig.chavePix,
      tipoChave: pixConfig.tipoChave,
      nomeBeneficiario: pixConfig.nomeBeneficiario,
      cidadeBeneficiario: pixConfig.cidadeBeneficiario,
    };
  } catch (error: any) {
    console.error('Erro na chamada Mercado Pago, aplicando gerador BACEN seguro:', error);
    return await generateOfficialBacenPix(false);
  }
}

/**
 * Consulta status de pagamento no Mercado Pago
 */
export async function checkMercadoPagoPaymentStatus(paymentId: string): Promise<{ status: string; statusDetail: string; isPaid: boolean }> {
  const pixConfig = await getPixConfigPg();
  const token = (pixConfig.mercadoPagoToken || process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim();

  if (!token || paymentId.startsWith('PIX-') || paymentId.startsWith('MP-')) {
    // Pix manual ou direto via chave BACEN:
    return {
      status: 'pending',
      statusDetail: 'waiting_transfer',
      isPaid: false,
    };
  }

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    const status = data.status || 'pending';
    return {
      status,
      statusDetail: data.status_detail || '',
      isPaid: status === 'approved',
    };
  } catch (err: any) {
    console.error('Erro ao consultar Mercado Pago:', err);
    return {
      status: 'pending',
      statusDetail: err.message,
      isPaid: false,
    };
  }
}
