import { Logger } from '@nestjs/common';
import type { AccountStatus } from '../../domain/accounts/account-status';
import {
  AccountSuspendedError,
  PlanRequiredError,
  SubscriptionRequiredError,
} from '../../domain/errors/account.errors';
import { InvalidAnnotationError } from '../../domain/errors/annotation.errors';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccountRepository } from '../../test-utils/in-memory-account.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import {
  annotationIdOf,
  InMemoryAnnotationRepository,
} from '../../test-utils/in-memory-annotation.repository';
import { InMemoryProjectRepository } from '../../test-utils/in-memory-project.repository';
import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import { CreateProjectUseCase } from '../projects/create-project.usecase';
import { CreateAnnotationByKeyUseCase } from './create-annotation-by-key.usecase';

const OWNER_ID = 'ad000000-0000-4000-a000-000000000001';
const NOW = new Date('2026-11-05T02:00:00.000Z');
const RELEASE = { day: '2026-11-04', text: ' Released   v2.4.0 ' };

async function setup(status: AccountStatus | null = 'active') {
  const store = new InMemoryProjectRepository();
  const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
  const random = new SequenceRandomSource(Array.from({ length: 62 }, (_, index) => index));
  const account =
    status === null ? null : await accounts.create({ ownerAdminId: OWNER_ID, status });
  if (account !== null) {
    store.addAccount(account.id, OWNER_ID);
  }
  const { projectId } = await new CreateProjectUseCase(store, random, accounts).execute({
    name: 'Shop',
    allowedOrigins: ['https://shop.example.com'],
    timezone: 'America/Sao_Paulo',
    ...(account === null ? {} : { accountId: account.id }),
  });
  const annotations = new InMemoryAnnotationRepository();
  return {
    projectId,
    account,
    accounts,
    annotations,
    create: new CreateAnnotationByKeyUseCase(store, accounts, annotations, new FixedClock(NOW)),
  };
}

describe('CreateAnnotationByKeyUseCase', () => {
  let logs: unknown[];

  beforeEach(() => {
    logs = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['trialing', 'active', 'past_due', 'ending', 'comped'] as const)(
    'writes a note on the key’s project for an account in %s, logged without its text',
    async (status) => {
      const { create, projectId } = await setup(status);

      const annotation = await create.execute(projectId, RELEASE);

      expect(annotation).toEqual({
        id: annotationIdOf(1),
        projectId,
        day: '2026-11-04',
        text: 'Released v2.4.0',
        createdAt: NOW,
        updatedAt: NOW,
      });
      expect(logs).toContainEqual({
        message: 'annotation.created',
        projectId,
        annotationId: annotationIdOf(1),
      });
    },
  );

  it('refuses the free plan with plan_required, naming the feature, and stores nothing', async () => {
    const { create, annotations, projectId } = await setup('free');

    const refusal = create.execute(projectId, RELEASE);

    await expect(refusal).rejects.toBeInstanceOf(PlanRequiredError);
    await expect(refusal).rejects.toMatchObject({ feature: 'annotations_by_token' });
    expect(annotations.stored).toEqual([]);
  });

  it('refuses an account without access, and a suspended one, before the plan', async () => {
    const ended = await setup('ended');
    const suspended = await setup('active');
    if (suspended.account === null) {
      throw new Error('The account was not created.');
    }
    await suspended.accounts.suspend(suspended.account.id, 'abuse', NOW);

    await expect(ended.create.execute(ended.projectId, RELEASE)).rejects.toBeInstanceOf(
      SubscriptionRequiredError,
    );
    await expect(suspended.create.execute(suspended.projectId, RELEASE)).rejects.toBeInstanceOf(
      AccountSuspendedError,
    );
  });

  it('writes on the operator’s own project, which has no account', async () => {
    const { create, projectId } = await setup(null);

    await expect(create.execute(projectId, RELEASE)).resolves.toMatchObject({ projectId });
  });

  it('applies the dashboard’s rules: a day still to come in the project time zone', async () => {
    const { create, projectId } = await setup();

    await expect(
      create.execute(projectId, { day: '2026-11-05', text: 'Tomorrow in São Paulo' }),
    ).rejects.toMatchObject({ code: 'invalid_annotation', field: 'day' });
  });

  it('refuses an empty note before looking the project up', async () => {
    const { create } = await setup();

    await expect(
      create.execute('unknown', { day: '2026-11-04', text: ' ' }),
    ).rejects.toBeInstanceOf(InvalidAnnotationError);
  });

  it('answers project_not_found for a key whose project is gone', async () => {
    const { create } = await setup();

    await expect(
      create.execute('00000000-0000-4000-8000-0000000000ff', RELEASE),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});
