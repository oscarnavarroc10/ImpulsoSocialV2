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

  it('sends one sanitized status form request and parses numeric/string counters', async () => {
    const calls: { body: string }[] = [];
    const fake: BulkFollowsOrderTransport = (_url, init) => {
      calls.push({ body: init.body });
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            '{"charge":"0.27819","start_count":"3572","status":"Partial","remains":157,"currency":"USD"}',
          ),
      });
    };
    const result = await new BulkFollowsOrderClient(fake).status('provider-1');
    expect(result).toEqual({
      kind: 'ok',
      externalStatus: 'Partial',
      startCount: 3572,
      remains: 157,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toContain('action=status');
    expect(calls[0].body).toContain('order=provider-1');
    expect(calls[0].body).toContain('secret-value');
    expect(result).not.toHaveProperty('charge');
    expect(result).not.toHaveProperty('currency');
  });

  it('sanitizes an explicit provider error and any unknown/malformed status shape', async () => {
    const explicitError: BulkFollowsOrderTransport = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"error":"private provider detail"}'),
      });
    expect(
      await new BulkFollowsOrderClient(explicitError).status('provider-1'),
    ).toEqual({ kind: 'unavailable' });

    const missingCounters: BulkFollowsOrderTransport = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"status":"Completed"}'),
      });
    expect(
      await new BulkFollowsOrderClient(missingCounters).status('provider-1'),
    ).toEqual({ kind: 'unavailable' });

    const negativeCounters: BulkFollowsOrderTransport = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            '{"status":"Completed","start_count":-1,"remains":"0"}',
          ),
      });
    expect(
      await new BulkFollowsOrderClient(negativeCounters).status('provider-1'),
    ).toEqual({ kind: 'unavailable' });

    const malformed: BulkFollowsOrderTransport = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('not-json'),
      });
    expect(
      await new BulkFollowsOrderClient(malformed).status('provider-1'),
    ).toEqual({ kind: 'unavailable' });
  });

  it('returns unavailable after exactly one status transport failure without exposing the key', async () => {
    const attempts: string[] = [];
    const fake: BulkFollowsOrderTransport = (_url, init) => {
      attempts.push(init.body);
      return Promise.reject(new Error(init.body));
    };
    expect(await new BulkFollowsOrderClient(fake).status('provider-1')).toEqual(
      { kind: 'unavailable' },
    );
    expect(attempts).toHaveLength(1);
  });

  it('times out the status request while reading the body', async () => {
    process.env.BULKFOLLOWS_REQUEST_TIMEOUT_MS = '10';
    const fake: BulkFollowsOrderTransport = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => new Promise<string>(() => {}),
      });
    await expect(
      new BulkFollowsOrderClient(fake).status('provider-1'),
    ).resolves.toEqual({ kind: 'unavailable' });
  });

  it('does not wait for or read a non-success status response body', async () => {
    const text = jest.fn(() => new Promise<string>(() => {}));
    const fake: BulkFollowsOrderTransport = () =>
      Promise.resolve({ ok: false, status: 500, text });

    await expect(
      new BulkFollowsOrderClient(fake).status('provider-1'),
    ).resolves.toEqual({ kind: 'unavailable' });
    expect(text).not.toHaveBeenCalled();
  });
});
