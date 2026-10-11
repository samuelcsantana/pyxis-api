import type { SiteIconType } from '../projects/site-icon';

export interface ProjectSite {
  readonly projectId: string;
  readonly origin: string;
}

export interface ProjectIcon {
  readonly projectId: string;
  readonly contentType: SiteIconType;
  readonly bytes: Uint8Array;
  readonly version: string;
  readonly sourceUrl: string;
  readonly fetchedAt: Date;
}

export interface ProjectIconRepository {
  sites(): Promise<readonly ProjectSite[]>;
  find(projectId: string): Promise<ProjectIcon | null>;
  save(icon: ProjectIcon): Promise<void>;
  remove(projectId: string): Promise<void>;
  versionsOf(projectIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}

export const PROJECT_ICON_REPOSITORY = Symbol('ProjectIconRepository');
