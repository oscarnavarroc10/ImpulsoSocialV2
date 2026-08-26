import {
  BulkFollowsClient,
  BulkFollowsHttpTransport,
} from '../../../../backend/src/modules/catalog/infrastructure/bulkfollows.client';

const TEST_API_URL = 'https://bulkfollows.example.test/api/v2';
const TEST_API_KEY = 'test-fixture-key-do-not-use';

type FakeResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

function fakeResponse(body: string, status = 200, ok = true): FakeResponse {
  return { ok, status, text: () => Promise.resolve(body) };
}

function validEntry(overrides: Record<string, unknown> = {}) {
  return {
    service: 1,
    name: 'Followers',
    type: 'Default',
    category: 'Instagram',
    rate: '0.90',
    min: '50',
    max: '10000',
    refill: true,
    cancel: true,
    ...overrides,
  };
}

describe('BulkFollowsClient (contract)', () => {
  const originalUrl = process.env.BULKFOLLOWS_API_URL;
  const originalKey = process.env.BULKFOLLOWS_API_KEY;
  const originalTimeout = process.env.BULKFOLLOWS_REQUEST_TIMEOUT_MS;

  beforeEach(() => {
    process.env.BULKFOLLOWS_API_URL = TEST_API_URL;
    process.env.BULKFOLLOWS_API_KEY = TEST_API_KEY;
    delete process.env.BULKFOLLOWS_REQUEST_TIMEOUT_MS;
  });

  afterEach(() => {
    process.env.BULKFOLLOWS_API_URL = originalUrl;
    process.env.BULKFOLLOWS_API_KEY = originalKey;
    process.env.BULKFOLLOWS_REQUEST_TIMEOUT_MS = originalTimeout;
    jest.restoreAllMocks();
  });

  function buildClient(transport: BulkFollowsHttpTransport) {
    return new BulkFollowsClient(transport);
  }

  describe('request shape', () => {
    it('sends a single POST request to the configured URL', async () => {
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(fakeResponse('[]'));
      const client = buildClient(transport);

      await client.fetchServices();

      expect(transport).toHaveBeenCalledTimes(1);
      const [url, init] = transport.mock.calls[0];
      expect(url).toBe(TEST_API_URL);
      expect(init.method).toBe('POST');
    });

    it('encodes the body as application/x-www-form-urlencoded', async () => {
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(fakeResponse('[]'));
      const client = buildClient(transport);

      await client.fetchServices();

      const [, init] = transport.mock.calls[0];
      expect(init.headers['Content-Type']).toBe(
        'application/x-www-form-urlencoded',
      );
    });

    it('sends the API key and action=services fields only', async () => {
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(fakeResponse('[]'));
      const client = buildClient(transport);

      await client.fetchServices();

      const [, init] = transport.mock.calls[0];
      const params = new URLSearchParams(init.body);
      expect(params.get('key')).toBe(TEST_API_KEY);
      expect(params.get('action')).toBe('services');
      expect(Array.from(params.keys()).sort()).toEqual(['action', 'key']);
    });

    it('never places credentials in the request URL', async () => {
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(fakeResponse('[]'));
      const client = buildClient(transport);

      await client.fetchServices();

      const [url] = transport.mock.calls[0];
      expect(url).not.toContain(TEST_API_KEY);
      expect(url).not.toContain('?');
    });
  });

  describe('successful responses', () => {
    it('maps a single service entry', async () => {
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(fakeResponse(JSON.stringify([validEntry()])));
      const client = buildClient(transport);

      const result = await client.fetchServices();

      expect(result).toHaveLength(1);
      expect(result[0].externalId).toBe('1');
      expect(result[0].title).toBe('Followers');
      expect(result[0].rawPayload).toMatchObject(validEntry());
    });

    it('maps multiple service entries', async () => {
      const entries = [
        validEntry({ service: 1, name: 'Followers' }),
        validEntry({ service: 2, name: 'Likes' }),
      ];
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(fakeResponse(JSON.stringify(entries)));
      const client = buildClient(transport);

      const result = await client.fetchServices();

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.externalId)).toEqual(['1', '2']);
    });

    it('returns an empty list for an empty provider array', async () => {
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(fakeResponse('[]'));
      const client = buildClient(transport);

      const result = await client.fetchServices();

      expect(result).toEqual([]);
    });

    it('preserves the numeric service id as a string externalId', async () => {
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(
          fakeResponse(JSON.stringify([validEntry({ service: 42 })])),
        );
      const client = buildClient(transport);

      const result = await client.fetchServices();

      expect(result[0].externalId).toBe('42');
    });

    it('preserves numeric-string rate/min/max fields in rawPayload', async () => {
      const entry = validEntry({ rate: '1.25', min: '100', max: '5000' });
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(fakeResponse(JSON.stringify([entry])));
      const client = buildClient(transport);

      const result = await client.fetchServices();

      const raw = result[0].rawPayload as {
        rate: string;
        min: string;
        max: string;
      };
      expect(raw.rate).toBe('1.25');
      expect(raw.min).toBe('100');
      expect(raw.max).toBe('5000');
    });

    it('preserves refill=true', async () => {
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(
          fakeResponse(JSON.stringify([validEntry({ refill: true })])),
        );
      const client = buildClient(transport);

      const result = await client.fetchServices();

      expect((result[0].rawPayload as { refill: boolean }).refill).toBe(true);
    });

    it('preserves refill=false', async () => {
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(
          fakeResponse(JSON.stringify([validEntry({ refill: false })])),
        );
      const client = buildClient(transport);

      const result = await client.fetchServices();

      expect((result[0].rawPayload as { refill: boolean }).refill).toBe(false);
    });

    it('preserves cancel=true', async () => {
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(
          fakeResponse(JSON.stringify([validEntry({ cancel: true })])),
        );
      const client = buildClient(transport);

      const result = await client.fetchServices();

      expect((result[0].rawPayload as { cancel: boolean }).cancel).toBe(true);
    });

    it('preserves cancel=false', async () => {
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(
          fakeResponse(JSON.stringify([validEntry({ cancel: false })])),
        );
      const client = buildClient(transport);

      const result = await client.fetchServices();

      expect((result[0].rawPayload as { cancel: boolean }).cancel).toBe(false);
    });
  });

  describe('failure handling', () => {
    it('rejects invalid JSON', async () => {
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(fakeResponse('not-json'));
      const client = buildClient(transport);

      await expect(client.fetchServices()).rejects.toThrow(/not valid JSON/i);
    });

    it('rejects on transport failure', async () => {
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockRejectedValue(new Error('network down'));
      const client = buildClient(transport);

      await expect(client.fetchServices()).rejects.toThrow(/transport error/i);
    });

    it('rejects on HTTP failure', async () => {
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(fakeResponse('Unauthorized', 401, false));
      const client = buildClient(transport);

      await expect(client.fetchServices()).rejects.toThrow(/HTTP status 401/);
    });

    it('rejects a provider error object response', async () => {
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(
          fakeResponse(JSON.stringify({ error: 'Invalid API key' })),
        );
      const client = buildClient(transport);

      await expect(client.fetchServices()).rejects.toThrow(/not a JSON array/i);
    });

    it('rejects an object instead of an array', async () => {
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(fakeResponse(JSON.stringify({ service: 1 })));
      const client = buildClient(transport);

      await expect(client.fetchServices()).rejects.toThrow(/not a JSON array/i);
    });

    it('rejects a null response', async () => {
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(fakeResponse('null'));
      const client = buildClient(transport);

      await expect(client.fetchServices()).rejects.toThrow(/not a JSON array/i);
    });

    it('rejects a malformed entry (invalid rate)', async () => {
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(
          fakeResponse(JSON.stringify([validEntry({ rate: 'free' })])),
        );
      const client = buildClient(transport);

      await expect(client.fetchServices()).rejects.toThrow(/"rate"/);
    });

    it('rejects an entry missing required fields', async () => {
      const incomplete = { service: 1, name: 'Followers' };
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(fakeResponse(JSON.stringify([incomplete])));
      const client = buildClient(transport);

      await expect(client.fetchServices()).rejects.toThrow();
    });

    it('fails clearly when BULKFOLLOWS_API_URL is missing', async () => {
      delete process.env.BULKFOLLOWS_API_URL;
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(fakeResponse('[]'));
      const client = buildClient(transport);

      await expect(client.fetchServices()).rejects.toThrow(
        /BULKFOLLOWS_API_URL/,
      );
      expect(transport).not.toHaveBeenCalled();
    });

    it('fails clearly when BULKFOLLOWS_API_KEY is missing', async () => {
      delete process.env.BULKFOLLOWS_API_KEY;
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(fakeResponse('[]'));
      const client = buildClient(transport);

      await expect(client.fetchServices()).rejects.toThrow(
        /BULKFOLLOWS_API_KEY/,
      );
      expect(transport).not.toHaveBeenCalled();
    });
  });

  describe('security', () => {
    it('never exposes the API key in a transport failure error', async () => {
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockRejectedValue(new Error('network down'));
      const client = buildClient(transport);

      await expect(client.fetchServices()).rejects.not.toThrow(
        new RegExp(TEST_API_KEY),
      );
    });

    it('never exposes the API key in an HTTP failure error', async () => {
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(fakeResponse('Unauthorized', 401, false));
      const client = buildClient(transport);

      let caught: unknown;
      try {
        await client.fetchServices();
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).not.toContain(TEST_API_KEY);
    });

    it('performs zero live network calls (only the injected fake transport is invoked)', async () => {
      const globalFetchSpy = jest.spyOn(global, 'fetch');
      const transport = jest
        .fn<
          ReturnType<BulkFollowsHttpTransport>,
          Parameters<BulkFollowsHttpTransport>
        >()
        .mockResolvedValue(fakeResponse(JSON.stringify([validEntry()])));
      const client = buildClient(transport);

      await client.fetchServices();

      expect(globalFetchSpy).not.toHaveBeenCalled();
      expect(transport).toHaveBeenCalledTimes(1);
    });
  });

  describe('request timeout', () => {
    it('succeeds when the response resolves before the timeout elapses', async () => {
      process.env.BULKFOLLOWS_REQUEST_TIMEOUT_MS = '200';
      const transport: BulkFollowsHttpTransport = (_url, init) =>
        new Promise((resolve, reject) => {
          const handle = setTimeout(
            () => resolve(fakeResponse(JSON.stringify([validEntry()]))),
            10,
          );
          init.signal?.addEventListener('abort', () => {
            clearTimeout(handle);
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        });
      const client = buildClient(transport);

      const result = await client.fetchServices();

      expect(result).toHaveLength(1);
    });

    it('aborts and produces a sanitized error when the request exceeds the timeout', async () => {
      process.env.BULKFOLLOWS_REQUEST_TIMEOUT_MS = '20';
      const transport: BulkFollowsHttpTransport = (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        });
      const client = buildClient(transport);

      await expect(client.fetchServices()).rejects.toThrow(/timed out/i);
    });

    it('keeps the timeout active while the response body is being read', async () => {
      process.env.BULKFOLLOWS_REQUEST_TIMEOUT_MS = '20';
      const transport: BulkFollowsHttpTransport = (_url, init) =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            new Promise((_resolve, reject) => {
              init.signal?.addEventListener('abort', () => {
                reject(
                  Object.assign(new Error('body aborted'), {
                    name: 'AbortError',
                  }),
                );
              });
            }),
        });
      const client = buildClient(transport);

      await expect(client.fetchServices()).rejects.toThrow(/timed out/i);
    });

    it('never leaks the API key or request body in a timeout error', async () => {
      process.env.BULKFOLLOWS_REQUEST_TIMEOUT_MS = '20';
      const transport: BulkFollowsHttpTransport = (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        });
      const client = buildClient(transport);

      let caught: unknown;
      try {
        await client.fetchServices();
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).not.toContain(TEST_API_KEY);
      expect((caught as Error).message).not.toContain('action=services');
    });

    it('falls back to the default timeout when the environment value is invalid', async () => {
      process.env.BULKFOLLOWS_REQUEST_TIMEOUT_MS = 'not-a-number';
      const transport: BulkFollowsHttpTransport = () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve(fakeResponse(JSON.stringify([validEntry()]))),
            30,
          );
        });
      const client = buildClient(transport);

      const result = await client.fetchServices();

      expect(result).toHaveLength(1);
    });
  });
});
