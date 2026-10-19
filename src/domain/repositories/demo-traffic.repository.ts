export interface DemoTrafficProject {
  readonly projectId: string;
  readonly projectName: string;
  readonly accountId: string | null;
  readonly demoTraffic: boolean;
}

export interface DemoTrafficTarget {
  readonly projectId: string;
  readonly timezone: string;
  readonly lastEventAt: Date | null;
}

export interface DemoTrafficRepository {
  projectOf(projectId: string): Promise<DemoTrafficProject | null>;
  mark(projectId: string, demoTraffic: boolean): Promise<DemoTrafficProject | null>;
  targets(): Promise<readonly DemoTrafficTarget[]>;
}

export const DEMO_TRAFFIC_REPOSITORY = Symbol('DemoTrafficRepository');
