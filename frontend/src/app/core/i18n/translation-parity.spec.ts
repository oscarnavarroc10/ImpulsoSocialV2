import { describe, expect, it } from 'vitest';
import en from '../../../../public/i18n/en.json';
import esMx from '../../../../public/i18n/es-MX.json';

type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

function shape(value: JsonValue): unknown {
  if (value === null || typeof value !== 'object') return typeof value;
  if (Array.isArray(value)) return value.map((item) => shape(item));

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, shape(child)]),
  );
}

function stringLeaves(value: JsonValue): string[] {
  if (typeof value === 'string') return [value];
  if (value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap((item) => stringLeaves(item));
  return Object.values(value).flatMap((child) => stringLeaves(child));
}

function isJsonObject(value: JsonValue): value is { readonly [key: string]: JsonValue } {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readPath(value: JsonValue, path: string): JsonValue | undefined {
  return path.split('.').reduce<JsonValue | undefined>((current, segment) => {
    if (current === undefined || !isJsonObject(current)) return undefined;
    return current[segment];
  }, value);
}

const dynamicTranslationPaths = [
  'home.trust.pricing',
  'home.trust.process',
  'home.trust.support',
  'home.categoryBenefits.followers',
  'home.categoryBenefits.likes',
  'home.categoryBenefits.views',
  'home.categoryBenefits.reposts',
  'home.steps.explore.title',
  'home.steps.configure.title',
  'home.steps.track.title',
  'home.benefits.catalog.title',
  'home.benefits.pricing.title',
  'home.benefits.experience.title',
  'about.values.clarity.title',
  'about.values.honesty.title',
  'about.values.flexibility.title',
  'faq.items.explore.question',
  'faq.items.networks.question',
  'faq.items.results.question',
  'faq.items.purchase.question',
  'faq.items.payments.question',
  'faq.items.customization.question',
  'payments.descriptions.paypal',
  'payments.descriptions.mercadoPago',
  'payments.descriptions.card',
  'payments.descriptions.transfer',
  'payments.descriptions.crypto',
  'auth.promoBenefits.catalog',
  'auth.promoBenefits.pricing',
  'auth.promoBenefits.control',
  'auth.errors.validation',
  'auth.errors.unauthorized',
  'auth.errors.conflict',
  'auth.errors.network',
  'auth.errors.server',
  'auth.errors.unknown',
  'auth.errors.busy',
  'account.future.orders.title',
  'account.future.wallet.title',
  'account.future.tracking.title',
] as const;

describe('translation resources', () => {
  it('keeps es-MX and en structurally identical', () => {
    expect(shape(en)).toEqual(shape(esMx));
  });

  it('does not ship blank translation leaves', () => {
    expect(stringLeaves(en).every((value) => value.trim().length > 0)).toBe(true);
    expect(stringLeaves(esMx).every((value) => value.trim().length > 0)).toBe(true);
  });

  it('resolves every translation key assembled by the templates', () => {
    for (const path of dynamicTranslationPaths) {
      expect(readPath(esMx, path), `Missing es-MX key: ${path}`).toBeTypeOf('string');
      expect(readPath(en, path), `Missing en key: ${path}`).toBeTypeOf('string');
    }
  });
});
