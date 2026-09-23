import { normalizeSmmgenCapability } from '../../../src/modules/catalog/infrastructure/smmgen-capability-normalizer';

describe('normalizeSmmgenCapability', () => {
  it('maps only a verified Default contract to Standard', () => {
    expect(
      normalizeSmmgenCapability(
        { type: 'Default', min: 10, max: 1000 },
        'fixture-1',
      ),
    ).toMatchObject({
      capabilityKey: 'STANDARD',
      contractVersion: 'smmgen-default-v1',
    });
  });

  it('records Custom Comments as unsupported metadata', () => {
    expect(
      normalizeSmmgenCapability({ type: 'Custom Comments' }, 'fixture-2'),
    ).toMatchObject({
      capabilityKey: 'CUSTOM_COMMENTS',
      contract: { validationStatus: 'unsupported' },
    });
  });

  it.each([
    { type: 'Default', min: 0, max: 10 },
    { type: 'Default', min: 10, max: 9 },
    { type: 'Future Action', min: 1, max: 10 },
    { type: 'default', min: 1, max: 10, name: 'looks like Standard' },
    { type: 'Default', min: 1.5, max: 10 },
    { type: 'Default', min: Number.MAX_SAFE_INTEGER + 1, max: 10 },
    { type: 'Default', min: '10', max: '100', service: 'other-service' },
    { min: 10, max: 100 },
  ])('fails closed for %p', (payload) => {
    expect(normalizeSmmgenCapability(payload, 'fixture-3')).toBeNull();
  });

  it('does not infer capability from title or quantity-like fields', () => {
    expect(
      normalizeSmmgenCapability(
        {
          type: 'Default',
          min: 10,
          max: 100,
          title: 'Custom Comments',
          maxQuantity: 1,
        },
        'fixture-similarity',
      ),
    ).toMatchObject({ capabilityKey: 'STANDARD' });
  });

  it.each([
    { type: 'Custom Comments', min: 1, max: 10 },
    { type: 'Custom Comments', comments: 10 },
    { type: 'Custom Comments', comments: ['a', '', 'a'] },
    { type: 'Custom Comments', quantity: 10, min: 1, max: 10 },
  ])('keeps unresolved Custom Comments metadata unsupported: %p', (payload) => {
    expect(
      normalizeSmmgenCapability(payload, 'fixture-comments'),
    ).toMatchObject({
      capabilityKey: 'CUSTOM_COMMENTS',
      contract: { validationStatus: 'unsupported' },
    });
  });
});
