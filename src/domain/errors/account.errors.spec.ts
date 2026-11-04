import {
  AccountNotFoundError,
  AccountSuspendedError,
  DeletionOnHoldError,
  PlanRequiredError,
  ProjectLimitReachedError,
} from './account.errors';
import { DomainError } from './domain.error';

describe('account errors', () => {
  it.each([
    [new AccountNotFoundError(), 'account_not_found'],
    [new ProjectLimitReachedError(3), 'project_limit_reached'],
    [new AccountSuspendedError(), 'account_suspended'],
    [new DeletionOnHoldError(), 'deletion_on_hold'],
    [new PlanRequiredError('slack_alerts'), 'plan_required'],
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

  it('keeps the origin a refused batch came from, and none for the dashboard', () => {
    expect(new AccountSuspendedError('https://shop.example.com').allowedOrigin).toBe(
      'https://shop.example.com',
    );
    expect(new AccountSuspendedError().allowedOrigin).toBeNull();
  });
});

describe('PlanRequiredError', () => {
  it('names the feature the account needs the Pro plan for', () => {
    const error = new PlanRequiredError('public_share_link');

    expect(error.feature).toBe('public_share_link');
    expect(error.message).toContain('public_share_link');
    expect(error.message).toContain('Pro plan');
  });
});
