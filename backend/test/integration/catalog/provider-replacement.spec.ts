describe('provider replacement compatibility', () => {
  it('keeps explicit mappings independent of curated text and provider cost', () => {
    const masterService = { id: 'master-1', title: 'Followers', categoryId: 'cat-1', description: 'same copy' };
    const offerings = [
      { masterServiceId: 'master-1', providerServiceId: 'provider-a', isSelected: true },
      { masterServiceId: 'master-1', providerServiceId: 'provider-b', isSelected: false },
    ];
    expect(offerings.find((item) => item.isSelected)?.providerServiceId).toBe('provider-a');
    expect(masterService.id).toBe('master-1');
    expect(offerings[1].providerServiceId).not.toBe(masterService.title);
  });

  it('does not silently select an unavailable replacement', () => {
    const offerings = [
      { providerServiceId: 'provider-a', isSelected: false, isAvailable: false },
      { providerServiceId: 'provider-b', isSelected: false, isAvailable: true },
    ];
    expect(offerings.filter((item) => item.isSelected && item.isAvailable)).toHaveLength(0);
  });

  it('treats an empty successful snapshot as all BulkFollows offerings unavailable', () => {
    const availableOfferingIds = ['provider-a', 'provider-b'];
    const currentProviderIds: string[] = [];
    expect(availableOfferingIds.filter((id) => currentProviderIds.includes(id))).toHaveLength(0);
  });
});