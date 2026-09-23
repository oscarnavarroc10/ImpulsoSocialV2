import type { Prisma } from '@prisma/client';

export type ProviderCapabilityKey = 'STANDARD' | 'CUSTOM_COMMENTS';

export type CapabilityField = 'target' | 'quantity' | 'comments';

export type QuantityMode = 'required' | 'optional' | 'derived' | 'forbidden';

export interface ProviderCapabilityContract {
  requiredFields: CapabilityField[];
  optionalFields: CapabilityField[];
  quantityMode: QuantityMode;
  targetKind: 'link';
  min?: number;
  max?: number;
  supportedOperations: Array<'create' | 'status' | 'refill' | 'cancel' | 'balance'>;
  sourceProviderType?: string;
  validationStatus: 'supported' | 'unsupported';
}

export interface ProviderOfferingContract {
  capabilityKey: ProviderCapabilityKey;
  contractVersion: string;
  contract: ProviderCapabilityContract;
}

export type ProviderCapabilityJson = Prisma.InputJsonValue;

export function isSupportedCapabilityKey(value: string): value is ProviderCapabilityKey {
  return value === 'STANDARD' || value === 'CUSTOM_COMMENTS';
}