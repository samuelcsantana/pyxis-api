import type { DatabaseSizeProbe } from '../domain/monitoring/database-size';

export class FixedDatabaseSizeProbe implements DatabaseSizeProbe {
  constructor(private readonly bytes: number) {}

  currentBytes(): Promise<number> {
    return Promise.resolve(this.bytes);
  }
}
