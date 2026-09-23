import type {
  ProviderCapabilityContract,
  ProviderCapabilityKey,
} from '../domain/provider-capability';

export interface NormalizedProviderCapability {
  capabilityKey: ProviderCapabilityKey;
  contractVersion: string;
  contract: ProviderCapabilityContract;
}

export function normalizeBulkFollowsCapability(
  rawPayload: unknown,
  externalId: string,
): NormalizedProviderCapability | null {
  if (!isRecord(rawPayload) || !/^[0-9]+$/.test(externalId)) return null;

  const type = typeof rawPayload.type === 'string'
    ? rawPayload.type.trim().toLowerCase()
    : '';
  if (type !== 'default') return null;

  const min = strictPositiveInteger(rawPayload.min);
  const max = strictPositiveInteger(rawPayload.max);
  if (min === null || max === null || max < min) return null;
  if (rawPayload.service !== undefined && String(rawPayload.service) !== externalId)
    return null;

  return {
    capabilityKey: 'STANDARD',
    contractVersion: 'bulkfollows-default-v1',
    contract: {
      requiredFields: ['target', 'quantity'],
      optionalFields: [],
      quantityMode: 'required',
      targetKind: 'link',
      min,
      max,
      supportedOperations: ['create', 'status'],
      sourceProviderType: typeof rawPayload.type === 'string' ? rawPayload.type : undefined,
      validationStatus: 'supported',
    },
  };
}

export { normalizeSmmgenCapability } from './smmgen-capability-normalizer';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function strictPositiveInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0)
    return value;
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}