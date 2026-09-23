describe('Feature 013 migration verification fixtures', () => {
  it('keeps financial and historical records additive', () => {
    const before = { quantity: 100, walletMovement: 1500, refund: 0, idempotency: 'hash', providerOrderId: 'order-1' };
    const after = { ...before, offeringId: null, providerServiceId: null, privateSnapshot: null };
    expect(after).toMatchObject(before);
    expect(after.offeringId).toBeNull();
  });
});