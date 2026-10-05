import type { RandomSource } from '../domain/services/random-source';

export class SequenceRandomSource implements RandomSource {
  private position = 0;

  constructor(private readonly sequence: readonly number[]) {
    if (sequence.length === 0) {
      throw new Error('SequenceRandomSource needs at least one byte');
    }
  }

  bytes(length: number): Uint8Array {
    const end = this.position + length;
    const repeats = Math.ceil(end / this.sequence.length);
    const repeated = Array.from({ length: repeats }, () => this.sequence).flat();
    const bytes = Uint8Array.from(repeated.slice(this.position, end));
    this.position = end;
    return bytes;
  }
}
