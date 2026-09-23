import {
  SmmgenClient,
  SmmgenHttpTransport,
} from '../../../src/modules/catalog/infrastructure/smmgen.client';

describe('SmmgenClient', () => {
  afterEach(() => {
    delete process.env.SMMGEN_API_URL;
    delete process.env.SMMGEN_API_KEY;
  });

  it('fails closed without configuration and does not call transport', async () => {
    const transport = jest.fn() as unknown as SmmgenHttpTransport;
    await expect(new SmmgenClient(transport).fetchServices()).rejects.toThrow(
      'SMMGEN provider is unavailable',
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it('maps only sanitized structured fields from a recorded response', async () => {
    process.env.SMMGEN_API_URL = 'https://fixture.invalid/provider';
    process.env.SMMGEN_API_KEY = 'fixture-only';
    const transport: SmmgenHttpTransport = (url, init) => {
      void url;
      void init;
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify([
              {
                id: 'fixture-1',
                name: 'Fixture',
                type: 'Default',
                min: 1,
                max: 10,
                rate: 'private',
              },
            ]),
          ),
      });
    };
    await expect(new SmmgenClient(transport).fetchServices()).resolves.toEqual([
      {
        providerOrigin: 'smmgen',
        externalId: 'fixture-1',
        title: 'Fixture',
        rawPayload: { type: 'Default', id: 'fixture-1', min: 1, max: 10 },
      },
    ]);
  });
});
