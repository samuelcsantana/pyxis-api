export interface RandomSource {
  bytes(length: number): Uint8Array;
}

export const RANDOM_SOURCE = Symbol('RandomSource');
