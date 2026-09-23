import { Injectable, Logger, Optional } from '@nestjs/common';
import type {
  ProviderCatalogClient,
  ProviderCatalogSnapshot,
  ProviderServicePayload,
} from './provider-catalog-client';

export type SmmgenHttpTransport = (
  url: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

const defaultTransport: SmmgenHttpTransport = (url, init) => fetch(url, init);
const SMMGEN_PROVIDER_ORIGIN = 'smmgen';

@Injectable()
export class SmmgenClient implements ProviderCatalogClient {
  readonly providerOrigin = SMMGEN_PROVIDER_ORIGIN;
  private readonly logger = new Logger(SmmgenClient.name);

  constructor(
    @Optional()
    private readonly transport: SmmgenHttpTransport = defaultTransport,
  ) {}

  async fetchServices(): Promise<ProviderServicePayload[]> {
    const snapshot = await this.fetchServicesSnapshot();
    return snapshot.services;
  }

  async fetchServicesSnapshot(): Promise<ProviderCatalogSnapshot> {
    const url = process.env.SMMGEN_API_URL?.trim();
    const key = process.env.SMMGEN_API_KEY;
    if (!url || !key?.trim()) throw new Error('SMMGEN provider is unavailable');
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'https:')
        throw new Error('invalid configuration');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs());
      try {
        const response = await this.transport(parsedUrl.toString(), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'services' }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('provider request failed');
        const parsed: unknown = JSON.parse(await response.text());
        if (!Array.isArray(parsed))
          throw new Error('provider response invalid');
        return {
          complete: true,
          services: parsed.map((entry) => this.mapService(entry)),
        };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error: unknown) {
      void error;
      this.logger.warn('SMMGEN provider request unavailable');
      throw new Error('SMMGEN provider is unavailable');
    }
  }

  private mapService(entry: unknown): ProviderServicePayload {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      throw new Error('provider response invalid');
    const record = entry as Record<string, unknown>;
    const externalId =
      typeof record.id === 'string' || typeof record.id === 'number'
        ? String(record.id)
        : '';
    if (
      !/^[A-Za-z0-9._:-]+$/.test(externalId) ||
      typeof record.type !== 'string'
    )
      throw new Error('provider response invalid');
    const rawPayload: Record<string, string | number> = {
      type: record.type,
      id: externalId,
    };
    if (typeof record.min === 'number' || typeof record.min === 'string')
      rawPayload.min = record.min;
    if (typeof record.max === 'number' || typeof record.max === 'string')
      rawPayload.max = record.max;
    return {
      providerOrigin: SMMGEN_PROVIDER_ORIGIN,
      externalId,
      title: typeof record.name === 'string' ? record.name : undefined,
      rawPayload,
    };
  }

  private timeoutMs(): number {
    const value = Number(process.env.SMMGEN_REQUEST_TIMEOUT_MS);
    return Number.isFinite(value) && value > 0 ? value : 10_000;
  }
}

export { SMMGEN_PROVIDER_ORIGIN };
