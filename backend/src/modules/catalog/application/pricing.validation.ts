import { BadRequestException } from '@nestjs/common';

const ISO_4217_CURRENCY_PATTERN = /^[A-Z]{3}$/;

export interface MonetaryValue {
  amount: number;
  currency: string;
}

export interface OptionalMonetaryInput {
  amount?: number | null;
  currency?: string | null;
}

export function validateMinorUnitAmount(
  amount: number,
  fieldName = 'amount',
): number {
  if (!Number.isInteger(amount)) {
    throw new BadRequestException(
      `${fieldName} must be an integer in minor units`,
    );
  }

  if (amount < 0) {
    throw new BadRequestException(`${fieldName} must be non-negative`);
  }

  return amount;
}

export function validateIsoCurrency(
  currency: string,
  fieldName = 'currency',
): string {
  const normalized = currency.trim().toUpperCase();
  if (!ISO_4217_CURRENCY_PATTERN.test(normalized)) {
    throw new BadRequestException(
      `${fieldName} must be a valid ISO 4217 currency code`,
    );
  }

  return normalized;
}

export function validateOptionalMonetary(
  input: OptionalMonetaryInput,
  fieldPrefix = 'sellingPrice',
): MonetaryValue | null {
  const hasAmount = input.amount !== undefined;
  const hasCurrency = input.currency !== undefined;

  if (!hasAmount && !hasCurrency) {
    return null;
  }

  if ((input.amount === null && input.currency !== null) ||
      (input.currency === null && input.amount !== null)) {
    throw new BadRequestException(
      `${fieldPrefix} amount and currency must both be null to clear`,
    );
  }

  if (input.amount === null && input.currency === null) {
    return null;
  }

  if (input.amount == null || input.currency == null) {
    throw new BadRequestException(
      `${fieldPrefix} amount and currency must be provided together`,
    );
  }

  return {
    amount: validateMinorUnitAmount(input.amount, `${fieldPrefix}Amount`),
    currency: validateIsoCurrency(input.currency, `${fieldPrefix}Currency`),
  };
}

export function assertCurrencyConsistency(
  leftCurrency: string,
  rightCurrency: string,
  message = 'Currencies must match',
) {
  const left = validateIsoCurrency(leftCurrency, 'leftCurrency');
  const right = validateIsoCurrency(rightCurrency, 'rightCurrency');

  if (left !== right) {
    throw new BadRequestException(message);
  }
}