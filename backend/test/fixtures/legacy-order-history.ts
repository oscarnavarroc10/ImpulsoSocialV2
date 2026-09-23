export const legacyOrderHistoryFixture = {
  ordenProveedor: {
    ordenId: 'order-legacy',
    proveedor: 'bulkfollows',
    idExterno: 'provider-order-987',
    offeringId: null,
    providerServiceId: null,
    capabilityKeySnapshot: null,
    capabilityContractVersionSnapshot: null,
  },
};

export function hasDeterministicHistoricalBinding(
  record: typeof legacyOrderHistoryFixture.ordenProveedor,
): boolean {
  return Boolean(
    record.offeringId &&
      record.providerServiceId &&
      record.capabilityKeySnapshot &&
      record.capabilityContractVersionSnapshot,
  );
}
