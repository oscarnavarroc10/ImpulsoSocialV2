import { Injectable, Logger, Optional } from '@nestjs/common';
import type {
  ProviderCatalogClient,
  ProviderServicePayload,
} from './provider-catalog-client';

/**
 * Minimal HTTP transport contract used by BulkFollowsClient. Defaults to the
 * platform's global `fetch` implementation. Tests inject a fake transport so
 * no automated test ever performs a live network call.
 */
export type BulkFollowsHttpTransport = (
  url: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

const defaultTransport: BulkFollowsHttpTransport = (url, init) =>
  fetch(url, init);

/**
 * Stable `providerOrigin` identifier for the BulkFollows provider, used by
 * `ProviderServiceRepository` idempotency lookups/upserts. This project
 * supports a single provider integration; if additional providers are added
 * in the future, each should define its own equivalent constant.
 */
export const BULKFOLLOWS_PROVIDER_ORIGIN = 'bulkfollows';

interface BulkFollowsRawEntry {
  service: unknown;
  name: unknown;
  type: unknown;
  category: unknown;
  rate: unknown;
  min: unknown;
  max: unknown;
  refill: unknown;
  cancel: unknown;
}

const NUMERIC_STRING_PATTERN = /^\d+(\.\d+)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function assertNumericString(
  value: unknown,
  field: string,
  index: number,
): asserts value is string {
  if (typeof value !== 'string' || !NUMERIC_STRING_PATTERN.test(value)) {
    throw new Error(
      `BulkFollows service entry at index ${index} has an invalid "${field}" value`,
    );
  }
}

/**
 * Validates and narrows a single raw BulkFollows catalog entry.
 * Throws a descriptive error for any missing or malformed field instead of
 * silently coercing malformed data into defaults.
 */
function parseRawEntry(entry: unknown, index: number): BulkFollowsRawEntry {
  if (!isRecord(entry)) {
    throw new Error(
      `BulkFollows service entry at index ${index} is not an object`,
    );
  }

  if (typeof entry.service !== 'number' || !Number.isFinite(entry.service)) {
    throw new Error(
      `BulkFollows service entry at index ${index} has an invalid "service" value`,
    );
  }
  if (typeof entry.name !== 'string' || entry.name.length === 0) {
    throw new Error(
      `BulkFollows service entry at index ${index} has an invalid "name" value`,
    );
  }
  if (typeof entry.type !== 'string' || entry.type.length === 0) {
    throw new Error(
      `BulkFollows service entry at index ${index} has an invalid "type" value`,
    );
  }
  if (typeof entry.category !== 'string' || entry.category.length === 0) {
    throw new Error(
      `BulkFollows service entry at index ${index} has an invalid "category" value`,
    );
  }
  assertNumericString(entry.rate, 'rate', index);
  assertNumericString(entry.min, 'min', index);
  assertNumericString(entry.max, 'max', index);
  if (typeof entry.refill !== 'boolean') {
    throw new Error(
      `BulkFollows service entry at index ${index} has an invalid "refill" value`,
    );
  }
  if (typeof entry.cancel !== 'boolean') {
    throw new Error(
      `BulkFollows service entry at index ${index} has an invalid "cancel" value`,
    );
  }

  return {
    service: entry.service,
    name: entry.name,
    type: entry.type,
    category: entry.category,
    rate: entry.rate,
    min: entry.min,
    max: entry.max,
    refill: entry.refill,
    cancel: entry.cancel,
  };
}

function mapToProviderServicePayload(
  entry: BulkFollowsRawEntry,
): ProviderServicePayload {
  return {
    externalId: String(entry.service),
    title: entry.name as string,
    rawPayload: entry,
  };
}

/**
 * Concrete `ProviderCatalogClient` implementation for the BulkFollows
 * provider. Only implements the behavior explicitly confirmed by the
 * provider's documented `action=services` contract: a single POST request
 * with an `application/x-www-form-urlencoded` body containing `key` and
 * `action=services`, and a JSON array response. No retry, pagination, or
 * timeout behavior is implemented because the provider contract does not
 * document any.
 */
@Injectable()
export class BulkFollowsClient implements ProviderCatalogClient {
  private readonly logger = new Logger(BulkFollowsClient.name);

  constructor(
    @Optional()
    private readonly transport: BulkFollowsHttpTransport = defaultTransport,
  ) {}

  async fetchServices(): Promise<ProviderServicePayload[]> {
    const apiUrl = process.env.BULKFOLLOWS_API_URL;
    const apiKey = process.env.BULKFOLLOWS_API_KEY;

    if (!apiUrl) {
      throw new Error('BULKFOLLOWS_API_URL is not configured');
    }
    if (!apiKey) {
      throw new Error('BULKFOLLOWS_API_KEY is not configured');
    }

    const body = new URLSearchParams();
    body.set('key', apiKey);
    body.set('action', 'services');

    let response: { ok: boolean; status: number; text: () => Promise<string> };
    try {
      response = await this.transport(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch {
      // Never include request init (which contains the API key) in the error.
      this.logger.error('BulkFollows request failed due to a transport error');
      throw new Error('BulkFollows request failed due to a transport error');
    }

    if (!response.ok) {
      throw new Error(
        `BulkFollows request failed with HTTP status ${response.status}`,
      );
    }

    let rawText: string;
    try {
      rawText = await response.text();
    } catch {
      throw new Error('Failed to read the BulkFollows response body');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error('BulkFollows response was not valid JSON');
    }

    if (!Array.isArray(parsed)) {
      throw new Error('BulkFollows response was not a JSON array');
    }

    return parsed.map((entry: unknown, index: number) =>
      mapToProviderServicePayload(parseRawEntry(entry, index)),
    );
  }
}
