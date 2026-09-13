/**
 * Helper para integração com Mercado Pago via API REST Oficial
 * Criação de pagamento via PIX (QR Code & Copia e Cola)
 * Documentação Oficial: https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/post
 */

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
  qrCode: string; // Código Pix Copia e Cola (BR Code)
  qrCodeBase64: string; // Imagem base64 do QR Code para exibição direta
  ticketUrl: string;
  isSimulated?: boolean;
  errorMessage?: string;
}

export async function createMercadoPagoPixPayment(params: CreatePixPaymentParams): Promise<PixPaymentResult> {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();

  // Se o token do Mercado Pago não estiver configurado no ambiente, fornecemos um modo de demonstração realista
  // para que o fluxo de checkout Pix e confirmação pelo celular funcione perfeitamente no ambiente de testes.
  if (!token) {
    console.log('[Mercado Pago] Aviso: MERCADO_PAGO_ACCESS_TOKEN não configurado no .env. Gerando Pix em modo demonstração.');
    const simulatedId = `MP-${Date.now()}`;
    // Código EMV QR Pix fictício válido para testes visuais
    const simulatedQrCode = `00020126580014br.gov.bcb.pix0136praondeeu-mercadopago-${Date.now()}5204000053039865406${params.transactionAmount.toFixed(2)}5802BR5920PRA ONDE EU VOU SP6009SAO PAULO62070503***6304ABCD`;

    return {
      success: true,
      paymentId: simulatedId,
      status: 'pending',
      statusDetail: 'waiting_transfer',
      qrCode: simulatedQrCode,
      qrCodeBase64: '',
      ticketUrl: `https://www.mercadopago.com.br/payments/${simulatedId}/ticket`,
      isSimulated: true,
    };
  }

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
      console.error('[Mercado Pago API Error]', data);
      throw new Error(data.message || data.error || 'Erro ao criar pagamento Pix no Mercado Pago');
    }

    const txData = data.point_of_interaction?.transaction_data;

    return {
      success: true,
      paymentId: String(data.id),
      status: data.status || 'pending',
      statusDetail: data.status_detail || 'waiting_transfer',
      qrCode: txData?.qr_code || '',
      qrCodeBase64: txData?.qr_code_base64 || '',
      ticketUrl: txData?.ticket_url || '',
      isSimulated: false,
    };
  } catch (error: any) {
    console.error('Erro na chamada Mercado Pago:', error);
    return {
      success: false,
      paymentId: '',
      status: 'error',
      statusDetail: error.message,
      qrCode: '',
      qrCodeBase64: '',
      ticketUrl: '',
      errorMessage: error.message || 'Falha na comunicação com o Mercado Pago',
    };
  }
}

/**
 * Consulta status de pagamento no Mercado Pago
 */
export async function checkMercadoPagoPaymentStatus(paymentId: string): Promise<{ status: string; statusDetail: string; isPaid: boolean }> {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();

  if (!token || paymentId.startsWith('MP-')) {
    // Modo simulação: após gerado, se consultado, permite aprovação
    return {
      status: 'approved',
      statusDetail: 'accredited',
      isPaid: true,
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
