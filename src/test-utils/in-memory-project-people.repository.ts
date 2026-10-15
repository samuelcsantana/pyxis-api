import type {
  AccountPeopleSlot,
  PersonAddition,
  ProjectPeopleRepository,
  ProjectPerson,
} from '../domain/repositories/project-people.repository';

const ADDED_AT = new Date('2026-11-01T00:00:00.000Z');

interface Access extends ProjectPerson {
  readonly projectId: string;
}

export class InMemoryProjectPeopleRepository implements ProjectPeopleRepository {
  private access: readonly Access[] = [];
  private readonly adminIds = new Map<string, string>();
  private readonly projectAccounts = new Map<string, string>();

  placeProject(projectId: string, accountId: string): void {
    this.projectAccounts.set(projectId, accountId);
  }

  addPerson(projectId: string, email: string, adminUserId = this.adminIdOf(email)): ProjectPerson {
    this.adminIds.set(email, adminUserId);
    const person: Access = { projectId, adminUserId, email, addedAt: ADDED_AT };
    this.access = [...this.access, person];
    return { adminUserId, email, addedAt: ADDED_AT };
  }

  peopleOf(projectId: string): Promise<readonly ProjectPerson[]> {
    return Promise.resolve(
      this.access
        .filter((entry) => entry.projectId === projectId)
        .map(({ adminUserId, email, addedAt }) => ({ adminUserId, email, addedAt })),
    );
  }

  addToAccountProject(
    email: string,
    projectId: string,
    slot: AccountPeopleSlot,
  ): Promise<PersonAddition> {
    const present = this.access.find(
      (entry) => entry.projectId === projectId && entry.email === email,
    );
    if (present !== undefined) {
      return Promise.resolve({ outcome: 'already_there', person: present });
    }
    const people = new Set(
      this.access
        .filter((entry) => this.projectAccounts.get(entry.projectId) === slot.accountId)
        .map((entry) => entry.email),
    );
    if (!people.has(email) && people.size >= slot.maxPeople) {
      return Promise.resolve({ outcome: 'people_limit_reached' });
    }
    return Promise.resolve({ outcome: 'added', person: this.addPerson(projectId, email) });
  }

  remove(projectId: string, adminUserId: string): Promise<boolean> {
    const before = this.access.length;
    this.access = this.access.filter(
      (entry) => !(entry.projectId === projectId && entry.adminUserId === adminUserId),
    );
    return Promise.resolve(this.access.length < before);
  }

  private adminIdOf(email: string): string {
    return (
      this.adminIds.get(email) ??
      `ad000000-0000-4000-a000-${String(this.adminIds.size + 1).padStart(12, '0')}`
    );
  }
}
