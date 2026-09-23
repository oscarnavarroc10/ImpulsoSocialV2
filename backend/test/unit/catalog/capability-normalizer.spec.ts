import { normalizeBulkFollowsCapability } from '../../../src/modules/catalog/infrastructure/capability-normalizer';

describe('normalizeBulkFollowsCapability', () => {
  it('maps structured BulkFollows Default metadata to STANDARD', () => {
    expect(
      normalizeBulkFollowsCapability(
        { service: 42, type: 'Default', min: '100', max: 10000 },
        '42',
      ),
    ).toEqual(
      expect.objectContaining({
        capabilityKey: 'STANDARD',
        contractVersion: 'bulkfollows-default-v1',
        contract: expect.objectContaining({ min: 100, max: 10000 }),
      }),
    );
  });

  it.each([
    { type: 'Custom Comments', min: 1, max: 10 },
    { type: 'Unknown', min: 1, max: 10 },
    { type: 'Default', min: 0, max: 10 },
    { type: 'Default', min: 10, max: 1 },
  ])('fails closed for unsupported or malformed metadata: %j', (payload) => {
    expect(normalizeBulkFollowsCapability(payload, '42')).toBeNull();
  });

  it('does not infer capability from titles or descriptions', () => {
    expect(
      normalizeBulkFollowsCapability(
        { name: 'Custom Comments service', description: 'Default', type: 'mystery' },
        '42',
      ),
    ).toBeNull();
  });
});