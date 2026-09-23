import type { ProviderCapabilityKey } from '../../catalog/domain/provider-capability';

export interface CanonicalDynamicOrderInput {
  version: 1;
  capability: ProviderCapabilityKey;
  target: string;
  quantity?: number;
  comments?: string[];
}

export function canonicalizeDynamicOrderInput(
  input: CanonicalDynamicOrderInput,
): CanonicalDynamicOrderInput {
  return {
    version: 1,
    capability: input.capability,
    target: input.target.trim(),
    ...(input.quantity === undefined ? {} : { quantity: input.quantity }),
    ...(input.comments === undefined ? {} : { comments: [...input.comments] }),
  };
}