import { BulkFollowsOrderClient } from '../../../src/modules/orders/infrastructure/bulkfollows-order.client';
import type { BulkFollowsOrderTransport } from '../../../src/modules/orders/infrastructure/bulkfollows-order.client';

describe('BulkFollowsOrderClient', () => {
  const original = { ...process.env };
  beforeEach(() => {
    process.env.BULKFOLLOWS_API_URL = 'https://provider.invalid/api';
    process.env.BULKFOLLOWS_API_KEY = 'secret-value';
  });
  afterAll(() => {
    process.env = original;
  });
  afterEach(() => {
    delete process.env.BULKFOLLOWS_REQUEST_TIMEOUT_MS;
  });

  it('sends one sanitized form request and parses accepted order', async () => {
    const calls: { body: string }[] = [];
    const fake: BulkFollowsOrderTransport = (_url, init) => {
      calls.push({ body: init.body });
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"order":"123"}'),
      });
    };
    const result = await new BulkFollowsOrderClient(fake).submit(
      '123',
      'https://example.test',
      1000,
    );
    expect(result).toEqual({ kind: 'accepted', orderId: '123' });
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toContain('action=add');
    expect(calls[0].body).toContain('service=123');
  });

  it('distinguishes rejection and sanitizes ambiguous failures', async () => {
    const rejected: BulkFollowsOrderTransport = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"error":"private provider detail"}'),
      });
    expect(
      await new BulkFollowsOrderClient(rejected).submit(
        '123',
        'https://example.test',
        1,
      ),
    ).toEqual({ kind: 'rejected' });
    const malformed: BulkFollowsOrderTransport = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('not-json'),
      });
    expect(
      await new BulkFollowsOrderClient(malformed).submit(
        '123',
        'https://example.test',
        1,
      ),
    ).toEqual({ kind: 'unknown' });
  });

  it('returns unknown after exactly one transport failure without exposing the key', async () => {
    const fake: BulkFollowsOrderTransport = (_url, init) => {
      expect(init.body).toContain('secret-value');
      return Promise.reject(new Error(init.body));
    };
    expect(
      await new BulkFollowsOrderClient(fake).submit(
        '123',
        'https://example.test',
        1,
      ),
    ).toEqual({ kind: 'unknown' });
  });

  it('times out while reading the body and leaves no timer handle', async () => {
    process.env.BULKFOLLOWS_REQUEST_TIMEOUT_MS = '10';
    const fake: BulkFollowsOrderTransport = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => new Promise<string>(() => {}),
      });
    await expect(
      new BulkFollowsOrderClient(fake).submit('123', 'https://example.test', 1),
    ).resolves.toEqual({ kind: 'unknown' });
  });

  it('rejects invalid configuration before a request can be constructed', () => {
    process.env.BULKFOLLOWS_API_URL = 'not-a-url';
    expect(new BulkFollowsOrderClient().isReady()).toBe(false);
  });

  it('does not wait for or read a non-success response body', async () => {
    const text = jest.fn(() => new Promise<string>(() => {}));
    const fake: BulkFollowsOrderTransport = () =>
      Promise.resolve({ ok: false, status: 503, text });

    await expect(
      new BulkFollowsOrderClient(fake).submit('123', 'https://example.test', 1),
    ).resolves.toEqual({ kind: 'unknown' });
    expect(text).not.toHaveBeenCalled();
  });
});
