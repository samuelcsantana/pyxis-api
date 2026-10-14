import { AccountNotFoundError, ProjectLimitReachedError } from './account.errors';
import { DomainError } from './domain.error';

describe('account errors', () => {
  it.each([
    [new AccountNotFoundError(), 'account_not_found'],
    [new ProjectLimitReachedError(3), 'project_limit_reached'],
  ])('%s carries a stable machine code', (error, code) => {
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe(code);
    expect(error.message).not.toBe('');
  });

  it('names the limit that was reached', () => {
    const error = new ProjectLimitReachedError(3);

    expect(error.limit).toBe(3);
    expect(error.message).toContain('3 projects');
  });
});
