import type { ProviderCapabilityKey } from '../../catalog/domain/provider-capability';

export interface ResolvedProviderOffering {
  offeringId: string;
  providerServiceId: string;
  providerOrigin: string;
  providerServiceExternalId: string;
  capability: ProviderCapabilityKey;
  contractVersion: string;
}

export interface ProviderNeutralOrderRequest {
  offering: ResolvedProviderOffering;
  target: string;
  quantity?: number;
  comments?: string[];
  idempotencyContext: string;
}

export interface ProviderAcceptedResult {
  kind: 'accepted';
  externalOrderId: string;
}

export interface ProviderRejectedResult {
  kind: 'rejected';
  message: string;
}

export interface ProviderUncertainResult {
  kind: 'uncertain';
  message: string;
}

export type ProviderCreateOrderResult =
  | ProviderAcceptedResult
  | ProviderRejectedResult
  | ProviderUncertainResult;

export interface ProviderOrderAdapter {
  createOrder(request: ProviderNeutralOrderRequest): Promise<ProviderCreateOrderResult>;
  getStatus(providerOrderId: string): Promise<ProviderStatusResult>;
}

export type ProviderStatusResult =
  | { kind: 'ok'; externalStatus: string; startCount: number; remains: number }
  | { kind: 'unavailable' };

export const PROVIDER_ORDER_ADAPTER = Symbol('PROVIDER_ORDER_ADAPTER');