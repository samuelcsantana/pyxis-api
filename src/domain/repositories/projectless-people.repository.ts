export interface ProjectlessPeopleRepository {
  clearReturned(): Promise<number>;
  markProjectless(at: Date): Promise<number>;
  deleteProjectlessSince(before: Date): Promise<number>;
}
