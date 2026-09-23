import { canonicalizeDynamicOrderInput } from '../../../src/modules/orders/application/canonical-order-input';

describe('canonical dynamic order input', () => {
  it('uses a versioned stable representation without inventing comment semantics', () => {
    expect(canonicalizeDynamicOrderInput({
      version: 1,
      capability: 'CUSTOM_COMMENTS',
      target: ' https://example.test ',
      comments: [' first ', 'second'],
    })).toEqual({
      version: 1,
      capability: 'CUSTOM_COMMENTS',
      target: 'https://example.test',
      comments: [' first ', 'second'],
    });
  });
});