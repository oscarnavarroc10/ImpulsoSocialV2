import type { NormalizedProviderCapability } from './capability-normalizer';

const SAFE_INTEGER_PATTERN = /^\d+$/;

export function normalizeSmmgenCapability(
  rawPayload: unknown,
  externalId: string,
): NormalizedProviderCapability | null {
  if (!isRecord(rawPayload) || !/^[A-Za-z0-9._:-]+$/.test(externalId))
    return null;

  const type = rawPayload.type;
  if (type !== 'Default' && type !== 'Custom Comments') return null;

  if (type === 'Custom Comments') {
    return {
      capabilityKey: 'CUSTOM_COMMENTS',
      contractVersion: 'smmgen-custom-comments-v1',
      contract: {
        requiredFields: ['target', 'comments'],
        optionalFields: [],
        quantityMode: 'derived',
        targetKind: 'link',
        supportedOperations: [],
        sourceProviderType: type,
        validationStatus: 'unsupported',
      },
    };
  }

  const min = positiveInteger(rawPayload.min);
  const max = positiveInteger(rawPayload.max);
  if (min === null || max === null || max < min) return null;
  if (rawPayload.service !== undefined) {
    if (
      typeof rawPayload.service !== 'string' &&
      typeof rawPayload.service !== 'number'
    )
      return null;
    if (String(rawPayload.service) !== externalId) return null;
  }

  return {
    capabilityKey: 'STANDARD',
    contractVersion: 'smmgen-default-v1',
    contract: {
      requiredFields: ['target', 'quantity'],
      optionalFields: [],
      quantityMode: 'required',
      targetKind: 'link',
      min,
      max,
      supportedOperations: ['create', 'status'],
      sourceProviderType: type,
      validationStatus: 'supported',
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown): number | null {
  if (typeof value === 'number')
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== 'string' || !SAFE_INTEGER_PATTERN.test(value))
    return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
