export interface ExpiredSessionCutoffs {
  readonly createdBefore: Date;
  readonly lastUsedBefore: Date;
}

export interface RetentionRepository {
  projectIds(): Promise<readonly string[]>;
  deleteEventsBefore(projectId: string, cutoff: Date, limit: number): Promise<number>;
  deleteExpiredSessions(cutoffs: ExpiredSessionCutoffs): Promise<number>;
  deleteExpiredSignInCodes(now: Date): Promise<number>;
}
