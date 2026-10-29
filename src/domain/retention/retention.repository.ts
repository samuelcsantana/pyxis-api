export interface ExpiredSessionCutoffs {
  readonly createdBefore: Date;
  readonly lastUsedBefore: Date;
}

export interface SpentConnectionTokenCutoffs {
  readonly expiredBefore: Date;
  readonly rotatedBefore: Date;
}

export interface RetentionRepository {
  projectIdsNotHeld(): Promise<readonly string[]>;
  deleteEventsBefore(projectId: string, cutoff: Date, limit: number): Promise<number>;
  projectIdsWithCitiesToErase(): Promise<readonly string[]>;
  eraseCities(projectId: string, limit: number): Promise<number>;
  deleteExpiredSessions(cutoffs: ExpiredSessionCutoffs): Promise<number>;
  deleteExpiredSignInCodes(now: Date): Promise<number>;
  deleteTrialCardsStartedBefore(cutoff: Date): Promise<number>;
  deleteEndedConnections(idleCutoff: Date): Promise<number>;
  deleteSpentConnectionTokens(cutoffs: SpentConnectionTokenCutoffs): Promise<number>;
  deleteFinishedAuthorizationRequests(expiredBefore: Date): Promise<number>;
}
