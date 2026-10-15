export interface ExportReady {
  readonly projectId: string;
  readonly exportId: string;
  readonly projectName: string;
  readonly eventCount: number;
  readonly availableUntil: Date;
}
