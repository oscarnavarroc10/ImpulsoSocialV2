import type { ProviderCapabilityContract } from '../../src/modules/catalog/domain/provider-capability';

export const standardCapabilityContract: ProviderCapabilityContract = {
  requiredFields: ['target', 'quantity'],
  optionalFields: [],
  quantityMode: 'required',
  targetKind: 'link',
  min: 100,
  max: 10000,
  supportedOperations: ['create', 'status'],
  sourceProviderType: 'Default',
  validationStatus: 'supported',
};

export function providerOfferingFixture(
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    id: 'offering-1',
    masterServiceId: 'master-1',
    providerServiceId: 'provider-service-1',
    capabilityKey: 'STANDARD' as const,
    contractVersion: 'v1',
    contract: standardCapabilityContract,
    isEnabled: true,
    isAvailable: true,
    isSelected: false,
    ...overrides,
  };
}