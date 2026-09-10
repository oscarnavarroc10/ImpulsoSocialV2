import { Injectable, Logger, Optional } from '@nestjs/common';

export type BulkFollowsOrderTransport = (
  url: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

export type BulkFollowsOrderResult =
  | { kind: 'accepted'; orderId: string }
  | { kind: 'rejected' }
  | { kind: 'unknown' };

export type BulkFollowsStatusResult =
  | {
      kind: 'ok';
      externalStatus: string;
      startCount: number;
      remains: number;
    }
  | { kind: 'unavailable' };

const transport: BulkFollowsOrderTransport = (url, init) => fetch(url, init);
const timeout = (): number => {
  const value = Number(process.env.BULKFOLLOWS_REQUEST_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : 10_000;
};

@Injectable()
export class BulkFollowsOrderClient {
  private readonly logger = new Logger(BulkFollowsOrderClient.name);
  constructor(
    @Optional() private readonly http: BulkFollowsOrderTransport = transport,
  ) {}

  isReady(): boolean {
    return this.configuration() !== null;
  }

  async submit(
    service: string,
    link: string,
    quantity: number,
  ): Promise<BulkFollowsOrderResult> {
    const configuration = this.configuration();
    if (!configuration) return { kind: 'unknown' };
    const { url, key } = configuration;
    const body = new URLSearchParams({
      key,
      action: 'add',
      service,
      link,
      quantity: String(quantity),
    }).toString();
    const controller = new AbortController();
    let rejectDeadline!: (reason?: unknown) => void;
    const deadline = new Promise<never>((_, reject) => {
      rejectDeadline = reject;
    });
    const handle = setTimeout(() => {
      controller.abort();
      rejectDeadline(new Error('timeout'));
    }, timeout());
    try {
      const response = await Promise.race([
        this.http(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: controller.signal,
        }),
        deadline,
      ]);
      if (!response.ok) return { kind: 'unknown' };
      const responseBody = await Promise.race([response.text(), deadline]);
      const parsed: unknown = JSON.parse(responseBody);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        return { kind: 'unknown' };
      const record = parsed as Record<string, unknown>;
      if (typeof record.order === 'string' && record.order.trim())
        return { kind: 'accepted', orderId: record.order.trim() };
      if (typeof record.order === 'number' && Number.isFinite(record.order))
        return { kind: 'accepted', orderId: String(record.order) };
      if (typeof record.error === 'string' && record.error.trim())
        return { kind: 'rejected' };
      return { kind: 'unknown' };
    } catch (error: unknown) {
      void error;
      if (controller.signal.aborted)
        this.logger.warn('BulkFollows order request timed out');
      return { kind: 'unknown' };
    } finally {
      clearTimeout(handle);
    }
  }

  async status(providerOrderId: string): Promise<BulkFollowsStatusResult> {
    const configuration = this.configuration();
    if (!configuration) return { kind: 'unavailable' };
    const { url, key } = configuration;
    const body = new URLSearchParams({
      key,
      action: 'status',
      order: providerOrderId,
    }).toString();
    const controller = new AbortController();
    let rejectDeadline!: (reason?: unknown) => void;
    const deadline = new Promise<never>((_, reject) => {
      rejectDeadline = reject;
    });
    const handle = setTimeout(() => {
      controller.abort();
      rejectDeadline(new Error('timeout'));
    }, timeout());
    try {
      const response = await Promise.race([
        this.http(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: controller.signal,
        }),
        deadline,
      ]);
      if (!response.ok) return { kind: 'unavailable' };
      const responseBody = await Promise.race([response.text(), deadline]);
      const parsed: unknown = JSON.parse(responseBody);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        return { kind: 'unavailable' };
      const record = parsed as Record<string, unknown>;
      if (typeof record.error === 'string' && record.error.trim())
        return { kind: 'unavailable' };
      const externalStatus =
        typeof record.status === 'string' ? record.status.trim() : '';
      const startCount = this.strictNonNegativeInteger(record.start_count);
      const remains = this.strictNonNegativeInteger(record.remains);
      if (!externalStatus || startCount === null || remains === null)
        return { kind: 'unavailable' };
      return { kind: 'ok', externalStatus, startCount, remains };
    } catch (error: unknown) {
      void error;
      if (controller.signal.aborted)
        this.logger.warn('BulkFollows status request timed out');
      return { kind: 'unavailable' };
    } finally {
      clearTimeout(handle);
    }
  }

  private strictNonNegativeInteger(value: unknown): number | null {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
      return value;
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) ? parsed : null;
    }
    return null;
  }

  private configuration(): { url: string; key: string } | null {
    const url = process.env.BULKFOLLOWS_API_URL?.trim();
    const key = process.env.BULKFOLLOWS_API_KEY;
    if (!url || !key?.trim()) return null;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
        return null;
      return { url: parsed.toString(), key };
    } catch {
      return null;
    }
  }
}
