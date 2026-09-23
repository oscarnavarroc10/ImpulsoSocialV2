import {
  hasDeterministicHistoricalBinding,
  legacyOrderHistoryFixture,
} from '../../../test/fixtures/legacy-order-history';

describe('historical provider binding', () => {
  it('keeps legacy provider order IDs nullable for new linkage', () => {
    expect(hasDeterministicHistoricalBinding(legacyOrderHistoryFixture.ordenProveedor)).toBe(false);
    expect(legacyOrderHistoryFixture.ordenProveedor.idExterno).toBe('provider-order-987');
    expect(legacyOrderHistoryFixture.ordenProveedor.providerServiceId).toBeNull();
  });

  it('requires independent offering and provider linkage', () => {
    expect(hasDeterministicHistoricalBinding({
      ...legacyOrderHistoryFixture.ordenProveedor,
      offeringId: 'offering-1',
      providerServiceId: 'provider-service-1',
      capabilityKeySnapshot: 'STANDARD',
      capabilityContractVersionSnapshot: 'bulkfollows-default-v1',
    })).toBe(true);
  });
});
