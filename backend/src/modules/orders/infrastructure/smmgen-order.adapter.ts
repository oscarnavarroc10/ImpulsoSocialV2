import { Injectable, Logger, Optional } from '@nestjs/common';
import type {
  ProviderCreateOrderResult,
  ProviderNeutralOrderRequest,
  ProviderOrderAdapter,
  ProviderStatusResult,
} from '../application/provider-order-adapter';

export type SmmgenOrderTransport = (
  url: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

const defaultTransport: SmmgenOrderTransport = (url, init) => fetch(url, init);

@Injectable()
export class SmmgenOrderAdapter implements ProviderOrderAdapter {
  readonly providerOrigin = 'smmgen';
  private readonly logger = new Logger(SmmgenOrderAdapter.name);

  constructor(
    @Optional()
    private readonly transport: SmmgenOrderTransport = defaultTransport,
  ) {}

  isReady(): boolean {
    return this.configuration() !== null;
  }

  async createOrder(
    request: ProviderNeutralOrderRequest,
  ): Promise<ProviderCreateOrderResult> {
    if (
      request.offering.capability !== 'STANDARD' ||
      request.quantity === undefined
    )
      return { kind: 'rejected', message: 'Unsupported provider capability' };
    const configuration = this.configuration();
    if (!configuration)
      return { kind: 'uncertain', message: 'Provider unavailable' };
    const response = await this.request(configuration, {
      action: 'add',
      service: request.offering.providerServiceExternalId,
      link: request.target,
      quantity: request.quantity,
    });
    if (!response)
      return { kind: 'uncertain', message: 'Provider result unavailable' };
    const id = this.externalId(response.order);
    if (id) return { kind: 'accepted', externalOrderId: id };
    if (typeof response.error === 'string' && response.error.trim())
      return { kind: 'rejected', message: 'Provider rejected the order' };
    return { kind: 'uncertain', message: 'Provider result unavailable' };
  }

  async getStatus(providerOrderId: string): Promise<ProviderStatusResult> {
    const configuration = this.configuration();
    if (!configuration || !providerOrderId.trim())
      return { kind: 'unavailable' };
    const response = await this.request(configuration, {
      action: 'status',
      order: providerOrderId,
    });
    if (!response || typeof response.status !== 'string')
      return { kind: 'unavailable' };
    const startCount = this.integer(response.start_count);
    const remains = this.integer(response.remains);
    if (startCount === null || remains === null || !response.status.trim())
      return { kind: 'unavailable' };
    return {
      kind: 'ok',
      externalStatus: response.status.trim(),
      startCount,
      remains,
    };
  }

  private async request(
    configuration: { url: string; key: string },
    payload: Record<string, string | number>,
  ): Promise<Record<string, unknown> | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      const response = await this.transport(configuration.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${configuration.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const parsed: unknown = JSON.parse(await response.text());
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch (error: unknown) {
      void error;
      this.logger.warn('SMMGEN order operation unavailable');
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private configuration(): { url: string; key: string } | null {
    const url = process.env.SMMGEN_API_URL?.trim();
    const key = process.env.SMMGEN_API_KEY?.trim();
    if (!url || !key) return null;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:'
        ? { url: parsed.toString(), key }
        : null;
    } catch {
      return null;
    }
  }

  private externalId(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isSafeInteger(value))
      return String(value);
    return null;
  }

  private integer(value: unknown): number | null {
    if (typeof value === 'number')
      return Number.isSafeInteger(value) && value >= 0 ? value : null;
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) ? parsed : null;
    }
    return null;
  }

  private timeoutMs(): number {
    const value = Number(process.env.SMMGEN_REQUEST_TIMEOUT_MS);
    return Number.isFinite(value) && value > 0 ? value : 10_000;
  }
}
