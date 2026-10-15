export interface ProjectPerson {
  readonly adminUserId: string;
  readonly email: string;
  readonly addedAt: Date;
}

export interface AccountPeopleSlot {
  readonly accountId: string;
  readonly maxPeople: number;
}

export type PersonAddition =
  | { readonly outcome: 'added'; readonly person: ProjectPerson }
  | { readonly outcome: 'already_there'; readonly person: ProjectPerson }
  | { readonly outcome: 'people_limit_reached' };

export interface ProjectPeopleRepository {
  peopleOf(projectId: string): Promise<readonly ProjectPerson[]>;
  addToAccountProject(
    email: string,
    projectId: string,
    slot: AccountPeopleSlot,
  ): Promise<PersonAddition>;
  remove(projectId: string, adminUserId: string): Promise<boolean>;
}

export const PROJECT_PEOPLE_REPOSITORY = Symbol('ProjectPeopleRepository');
