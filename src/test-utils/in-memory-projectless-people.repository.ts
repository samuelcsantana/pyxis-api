import type { ProjectlessPeopleRepository } from '../domain/repositories/projectless-people.repository';

export interface SweptPerson {
  readonly adminUserId: string;
  readonly hasAccess: boolean;
  readonly ownsAccount: boolean;
  readonly projectlessSince: Date | null;
}

export class InMemoryProjectlessPeopleRepository implements ProjectlessPeopleRepository {
  private readonly people = new Map<string, SweptPerson>();

  add(person: Partial<SweptPerson> & Pick<SweptPerson, 'adminUserId'>): void {
    this.people.set(person.adminUserId, {
      hasAccess: false,
      ownsAccount: false,
      projectlessSince: null,
      ...person,
    });
  }

  person(adminUserId: string): SweptPerson | undefined {
    return this.people.get(adminUserId);
  }

  clearReturned(): Promise<number> {
    const returned = [...this.people.values()].filter(
      (person) => person.projectlessSince !== null && !this.isProjectless(person),
    );
    for (const person of returned) {
      this.people.set(person.adminUserId, { ...person, projectlessSince: null });
    }
    return Promise.resolve(returned.length);
  }

  markProjectless(at: Date): Promise<number> {
    const due = [...this.people.values()].filter(
      (person) => person.projectlessSince === null && this.isProjectless(person),
    );
    for (const person of due) {
      this.people.set(person.adminUserId, { ...person, projectlessSince: at });
    }
    return Promise.resolve(due.length);
  }

  deleteProjectlessSince(before: Date): Promise<number> {
    const due = [...this.people.values()].filter(
      (person) =>
        person.projectlessSince !== null &&
        person.projectlessSince <= before &&
        this.isProjectless(person),
    );
    for (const person of due) {
      this.people.delete(person.adminUserId);
    }
    return Promise.resolve(due.length);
  }

  private isProjectless(person: SweptPerson): boolean {
    return !person.hasAccess && !person.ownsAccount;
  }
}
