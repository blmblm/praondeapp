/**
 * Utilitários para formatação e validação (consistência) de CPF
 * Regra oficial da Receita Federal do Brasil (11 dígitos, cálculo dos 2 dígitos verificadores).
 */

export function cleanCPF(value: string | undefined | null): string {
  if (!value) return '';
  return value.replace(/\D/g, '').slice(0, 11);
}

export function formatCPF(value: string | undefined | null): string {
  const digits = cleanCPF(value);
  if (!digits) return '';

  if (digits.length <= 3) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export interface CPFValidationResult {
  isValid: boolean;
  message?: string;
  formatted?: string;
}

/**
 * Consiste o CPF de acordo com o algoritmo oficial da Receita Federal
 * - Rejeita valores vazios ou incompletos (campo obrigatório)
 * - Rejeita CPFs com todos os dígitos repetidos (ex: 111.111.111-11, 000.000.000-00)
 * - Calcula e valida o 1º dígito verificador (DV1)
 * - Calcula e valida o 2º dígito verificador (DV2)
 */
export function validateCPF(value: string | undefined | null): CPFValidationResult {
  const digits = cleanCPF(value);

  if (!digits || digits.length === 0) {
    return {
      isValid: false,
      message: 'O campo CPF é obrigatório.',
    };
  }

  if (digits.length < 11) {
    return {
      isValid: false,
      message: `CPF incompleto (${digits.length}/11 dígitos informados).`,
      formatted: formatCPF(digits),
    };
  }

  // Rejeita padrões conhecidos com todos os dígitos idênticos
  const allSame = /^(\d)\1{10}$/.test(digits);
  if (allSame) {
    return {
      isValid: false,
      message: 'CPF inválido: sequência de números iguais não é permitida.',
      formatted: formatCPF(digits),
    };
  }

  // 1º Dígito Verificador (DV1)
  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let rest1 = (sum1 * 10) % 11;
  if (rest1 === 10 || rest1 === 11) {
    rest1 = 0;
  }
  if (rest1 !== parseInt(digits.charAt(9), 10)) {
    return {
      isValid: false,
      message: 'CPF inválido: dígito verificador incorreto. Verifique os números digitados.',
      formatted: formatCPF(digits),
    };
  }

  // 2º Dígito Verificador (DV2)
  let sum2 = 0;
  for (let i = 0; i < 10; i++) {
    sum2 += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  let rest2 = (sum2 * 10) % 11;
  if (rest2 === 10 || rest2 === 11) {
    rest2 = 0;
  }
  if (rest2 !== parseInt(digits.charAt(10), 10)) {
    return {
      isValid: false,
      message: 'CPF inválido: segundo dígito verificador incorreto.',
      formatted: formatCPF(digits),
    };
  }

  return {
    isValid: true,
    formatted: formatCPF(digits),
  };
}
