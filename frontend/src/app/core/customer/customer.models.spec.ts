import { describe, expect, it } from 'vitest';
import { isPaginatedResponse } from './customer.models';

describe('customer contract models', () => {
  it('accepts the shared paginated API shape', () => {
    expect(
      isPaginatedResponse({
        items: [{ id: 'service-1' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    ).toBe(true);
  });

  it('rejects incomplete pagination metadata', () => {
    expect(
      isPaginatedResponse({ items: [], pagination: { page: 1, limit: 20, total: 0 } }),
    ).toBe(false);
  });
});