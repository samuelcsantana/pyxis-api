import { randomBytes } from 'node:crypto';
import type { RandomSource } from '../../domain/services/random-source';

export class CryptoRandomSource implements RandomSource {
  bytes(length: number): Uint8Array {
    return new Uint8Array(randomBytes(length));
  }
}
