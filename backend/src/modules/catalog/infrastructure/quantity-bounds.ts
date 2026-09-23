export interface QuantityBounds {
  min: number;
  max: number;
}

export function readQuantityBounds(
  rawPayload: unknown,
  externalId: string,
): QuantityBounds | null {
  if (
    !rawPayload ||
    typeof rawPayload !== 'object' ||
    Array.isArray(rawPayload)
  )
    return null;

  const record = rawPayload as Record<string, unknown>;
  const type =
    typeof record['type'] === 'string'
      ? record['type'].trim().toLowerCase()
      : '';
  const min = strictInteger(record['min']);
  const max = strictInteger(record['max']);

  if (
    type !== 'default' ||
    !/^\d+$/.test(externalId) ||
    !rawServiceMatches(record['service'], externalId) ||
    min === null ||
    max === null ||
    min < 1 ||
    max < min
  ) {
    return null;
  }

  return { min, max };
}

function strictInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function rawServiceMatches(value: unknown, externalId: string): boolean {
  if (value === undefined) return true;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
    return String(value) === externalId;
  return (
    typeof value === 'string' &&
    /^\d+$/.test(value.trim()) &&
    value.trim() === externalId
  );
}
