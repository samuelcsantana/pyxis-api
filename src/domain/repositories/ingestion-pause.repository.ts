export interface IngestionPauseRepository {
  pausedUntil(projectId: string): Promise<Date | null>;
}

export const INGESTION_PAUSE_REPOSITORY = Symbol('IngestionPauseRepository');
