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
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

const defaultTransport: BulkFollowsHttpTransport = (url, init) =>
  fetch(url, init);

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Reads the configurable BulkFollows request timeout from the environment,
 * defensively falling back to a safe default if unset, non-numeric, or
 * out of range.
 */
function readRequestTimeoutMs(): number {
  const raw = process.env.BULKFOLLOWS_REQUEST_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  return parsed;
}

/**
 * Stable `providerOrigin` identifier for the BulkFollows provider, used by
 * `ProviderServiceRepository` idempotency lookups/upserts. This project
 * supports a single provider integration; if additional providers are added
 * in the future, each should define its own equivalent constant.
 */
export const BULKFOLLOWS_PROVIDER_ORIGIN = 'bulkfollows';

interface BulkFollowsRawEntry {
  service: number;
  name: string;
  type: string;
  category: string;
  rate: string | number;
  min: string | number;
  max: string | number;
  refill: boolean;
  cancel: boolean;
}

const NUMERIC_STRING_PATTERN = /^\d+(\.\d+)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function assertNumericValue(
  value: unknown,
  field: string,
  index: number,
): asserts value is string | number {
  const isValidString =
    typeof value === 'string' && NUMERIC_STRING_PATTERN.test(value);

  const isValidNumber =
    typeof value === 'number' && Number.isFinite(value) && value >= 0;

  if (!isValidString && !isValidNumber) {
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
  assertNumericValue(entry.rate, 'rate', index);
  assertNumericValue(entry.min, 'min', index);
  assertNumericValue(entry.max, 'max', index);
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
    title: entry.name,
    rawPayload: entry,
  };
}

/**
 * Concrete `ProviderCatalogClient` implementation for the BulkFollows
 * provider. Only implements the behavior explicitly confirmed by the
 * provider's documented `action=services` contract: a single POST request
 * with an `application/x-www-form-urlencoded` body containing `key` and
 * `action=services`, and a JSON array response. A single attempt is made
 * per call (no automatic retry); requests are bounded by a configurable
 * `AbortController`-based timeout (`BULKFOLLOWS_REQUEST_TIMEOUT_MS`).
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

    const timeoutMs = readRequestTimeoutMs();
    const abortController = new AbortController();
    const startedAt = Date.now();
    const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);

    let response: { ok: boolean; status: number; text: () => Promise<string> };
    try {
      response = await this.transport(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: abortController.signal,
      });
    } catch (error: unknown) {
      clearTimeout(timeoutHandle);
      // Never include request init (which contains the API key) or the raw
      // error/body in logs or thrown errors — only sanitized, minimal info.
      if (abortController.signal.aborted) {
        this.throwTimeout(startedAt);
      }
      void error;
      const elapsedMs = Date.now() - startedAt;
      this.logger.error(
        `BulkFollows request failed due to a transport error after ${elapsedMs}ms`,
      );
      throw new Error('BulkFollows request failed due to a transport error');
    }

    if (abortController.signal.aborted) {
      clearTimeout(timeoutHandle);
      this.throwTimeout(startedAt);
    }

    if (!response.ok) {
      clearTimeout(timeoutHandle);
      throw new Error(
        `BulkFollows request failed with HTTP status ${response.status}`,
      );
    }

    let rawText: string;
    try {
      rawText = await response.text();
    } catch (error: unknown) {
      if (abortController.signal.aborted) {
        this.throwTimeout(startedAt);
      }
      void error;
      throw new Error('Failed to read the BulkFollows response body');
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (abortController.signal.aborted) {
      this.throwTimeout(startedAt);
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

  private throwTimeout(startedAt: number): never {
    const elapsedMs = Date.now() - startedAt;
    this.logger.error(`BulkFollows request timed out after ${elapsedMs}ms`);
    throw new Error(`BulkFollows request timed out after ${elapsedMs}ms`);
  }
}
