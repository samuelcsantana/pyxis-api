export interface Project {
  readonly id: string;
  readonly name: string;
  readonly allowedOrigins: readonly string[];
  readonly timezone: string;
  readonly conversionEvent: string | null;
  readonly createdAt: Date;
}
