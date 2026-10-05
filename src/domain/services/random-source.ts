export interface RandomSource {
  bytes(length: number): Uint8Array;
}
