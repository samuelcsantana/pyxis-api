export interface Weighted<Item> {
  readonly item: Item;
  readonly weight: number;
}

export interface SeededRandom {
  next(): number;
  integer(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<Item>(items: readonly Item[]): Item;
  weighted<Item>(items: readonly Weighted<Item>[]): Item;
  uuid(): string;
}

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const MULBERRY_INCREMENT = 0x6d2b79f5;
const UINT32_RANGE = 2 ** 32;
const UUID_BYTES = 16;
const BYTE_RANGE = 256;
const VERSION_BYTE = 6;
const VARIANT_BYTE = 8;
const LOW_NIBBLE = 0x0f;
const VERSION_FOUR = 0x40;
const LOW_SIX_BITS = 0x3f;
const VARIANT_TEN = 0x80;
const UUID_GROUP_ENDS = [8, 12, 16, 20] as const;

function hashSeed(seed: string): number {
  let hash = FNV_OFFSET;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), FNV_PRIME) >>> 0;
  }
  return hash;
}

function hex(byte: number): string {
  return byte.toString(16).padStart(2, '0');
}

function groupedUuid(digits: string): string {
  const [first, second, third, fourth] = UUID_GROUP_ENDS;
  return [
    digits.slice(0, first),
    digits.slice(first, second),
    digits.slice(second, third),
    digits.slice(third, fourth),
    digits.slice(fourth),
  ].join('-');
}

export function seededRandom(seed: string): SeededRandom {
  let state = hashSeed(seed);

  const next = (): number => {
    state = (state + MULBERRY_INCREMENT) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;
  };

  const integer = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));

  const pick = <Item>(items: readonly Item[]): Item => {
    const item = items[integer(0, items.length - 1)];
    if (item === undefined) {
      throw new Error('Nothing to pick from.');
    }
    return item;
  };

  const weighted = <Item>(items: readonly Weighted<Item>[]): Item => {
    const total = items.reduce((sum, entry) => sum + entry.weight, 0);
    let remaining = next() * total;
    for (const entry of items) {
      remaining -= entry.weight;
      if (remaining < 0) {
        return entry.item;
      }
    }
    return pick(items).item;
  };

  const uuid = (): string => {
    const bytes = Array.from({ length: UUID_BYTES }, () => Math.floor(next() * BYTE_RANGE));
    const withVersion = bytes.map((byte, index) => {
      if (index === VERSION_BYTE) {
        return (byte & LOW_NIBBLE) | VERSION_FOUR;
      }
      return index === VARIANT_BYTE ? (byte & LOW_SIX_BITS) | VARIANT_TEN : byte;
    });
    return groupedUuid(withVersion.map(hex).join(''));
  };

  return {
    next,
    integer,
    chance: (probability) => next() < probability,
    pick,
    weighted,
    uuid,
  };
}
