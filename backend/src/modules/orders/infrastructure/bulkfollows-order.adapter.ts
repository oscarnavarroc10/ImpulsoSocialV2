import { Injectable } from '@nestjs/common';
import type {
  ProviderCreateOrderResult,
  ProviderNeutralOrderRequest,
  ProviderOrderAdapter,
  ProviderStatusResult,
} from '../application/provider-order-adapter';
import { BulkFollowsOrderClient } from './bulkfollows-order.client';

@Injectable()
export class BulkFollowsOrderAdapter implements ProviderOrderAdapter {
  readonly providerOrigin = 'bulkfollows';

  constructor(private readonly client: BulkFollowsOrderClient) {}

  isReady(): boolean {
    return this.client.isReady();
  }

  async createOrder(
    request: ProviderNeutralOrderRequest,
  ): Promise<ProviderCreateOrderResult> {
    if (
      request.offering.capability !== 'STANDARD' ||
      request.quantity === undefined
    ) {
      return { kind: 'rejected', message: 'Unsupported provider capability' };
    }

    const result = await this.client.submit(
      request.offering.providerServiceExternalId,
      request.target,
      request.quantity,
    );
    if (result.kind === 'accepted')
      return { kind: 'accepted', externalOrderId: result.orderId };
    if (result.kind === 'rejected')
      return { kind: 'rejected', message: 'Provider rejected the order' };
    return { kind: 'uncertain', message: 'Provider result is unknown' };
  }

  async getStatus(providerOrderId: string): Promise<ProviderStatusResult> {
    return this.client.status(providerOrderId);
  }
}
