import { PUBLIC_KEY_PATTERN, SECRET_KEY_PATTERN } from '../../domain/keys/project-keys';
import { captureOutput, inMemoryCliContext } from '../../test-utils/cli-test-context';
import { CliUsageError } from '../cli-args';
import { accountCloseCommand } from './account-close.command';
import { accountCreateCommand } from './account-create.command';
import { accountHoldCommand } from './account-hold.command';
import { accountReleaseCommand } from './account-release.command';
import { accountLinkCommand } from './account-link.command';
import { accountResumeCommand } from './account-resume.command';
import { accountShowCommand } from './account-show.command';
import { accountSuspendCommand } from './account-suspend.command';
import { adminGrantCommand } from './admin-grant.command';
import { adminRevokeCommand } from './admin-revoke.command';
import { keyCreateCommand } from './key-create.command';
import { keyRevokeCommand } from './key-revoke.command';
import { projectCreateCommand } from './project-create.command';
import { projectDeleteCommand } from './project-delete.command';
import { projectUpdateCommand } from './project-update.command';
import { usageReportCommand } from './usage-report.command';

const PROJECT_ID = '9f1c2b3a-1d2e-4f5a-8b6c-7d8e9f0a1b2c';
const ACCOUNT_ID = 'acc00000-0000-4000-a000-000000000001';
const OWNER_ID = 'ad000000-0000-4000-a000-000000000001';

describe('usage:report', () => {
  it('reads an optional month', () => {
    expect(usageReportCommand.parse(['--month', '2026-09'])).toEqual({ month: '2026-09' });
    expect(usageReportCommand.parse([])).toEqual({});
  });

  it('prints the month, a header and one tab-separated line per project', async () => {
    const context = inMemoryCliContext();
    context.usage.usage = [
      { projectId: PROJECT_ID, name: 'My Shop', events: 1200, visits: 340 },
      { projectId: '0e1f2a3b-4c5d-4e6f-8a7b-9c0d1e2f3a4b', name: 'Blog', events: 0, visits: 0 },
    ];
    const output = captureOutput();

    await usageReportCommand.execute(context, {}, output);

    expect(output.out).toEqual([
      'month=2026-10',
      'project_id\tevents\tvisits\tname',
      `${PROJECT_ID}\t1200\t340\tMy Shop`,
      '0e1f2a3b-4c5d-4e6f-8a7b-9c0d1e2f3a4b\t0\t0\tBlog',
    ]);
  });
});

async function createdProject() {
  const context = inMemoryCliContext();
  const created = await context.createProject.execute({
    name: 'Shop',
    allowedOrigins: ['https://shop.example.com'],
  });
  return { context, ...created };
}

describe('project:create', () => {
  it('parses the name, the repeated origins and the optional settings', () => {
    expect(
      projectCreateCommand.parse([
        '--name',
        'Shop',
        '--origin',
        'https://shop.example.com',
        '--origin',
        'http://localhost:5173',
        '--timezone',
        'America/Sao_Paulo',
        '--conversion-event',
        'signup_completed',
      ]),
    ).toEqual({
      name: 'Shop',
      origins: ['https://shop.example.com', 'http://localhost:5173'],
      timezone: 'America/Sao_Paulo',
      conversionEvent: 'signup_completed',
    });
  });

  it('leaves the optional settings out when they are not given', () => {
    expect(
      projectCreateCommand.parse(['--name', 'Shop', '--origin', 'https://shop.example.com']),
    ).toEqual({
      name: 'Shop',
      origins: ['https://shop.example.com'],
    });
  });

  it('requires a name', () => {
    expect(() => projectCreateCommand.parse(['--origin', 'https://shop.example.com'])).toThrow(
      CliUsageError,
    );
  });

  it('prints the project id and the public key as key=value lines', async () => {
    const context = inMemoryCliContext();
    const output = captureOutput();

    await projectCreateCommand.execute(
      context,
      {
        name: 'Shop',
        origins: ['https://shop.example.com'],
        timezone: 'UTC',
        conversionEvent: 'signup_completed',
      },
      output,
    );

    expect(output.out).toEqual([
      expect.stringMatching(/^project_id=[0-9a-f-]{36}$/),
      expect.stringMatching(/^public_key_id=[0-9a-f-]{36}$/),
      expect.stringMatching(/^public_key=pyxis_pk_[A-Za-z0-9]{32}$/),
    ]);
    expect(output.err).toEqual([expect.stringContaining('Sentry DSN')]);
  });

  it('parses the account a project goes in, refusing an id that is not a UUID', () => {
    expect(
      projectCreateCommand.parse([
        '--name',
        'Shop',
        '--origin',
        'https://shop.example.com',
        '--account',
        ACCOUNT_ID.toUpperCase(),
      ]),
    ).toEqual({ name: 'Shop', origins: ['https://shop.example.com'], accountId: ACCOUNT_ID });
    expect(() =>
      projectCreateCommand.parse([
        '--name',
        'Shop',
        '--origin',
        'https://shop.example.com',
        '--account',
        'shop',
      ]),
    ).toThrow(CliUsageError);
  });

  it('creates the project in the account it names, for its owner to read', async () => {
    const context = inMemoryCliContext();
    context.store.addAccount(ACCOUNT_ID, OWNER_ID);

    await projectCreateCommand.execute(
      context,
      { name: 'Shop', origins: ['https://shop.example.com'], accountId: ACCOUNT_ID },
      captureOutput(),
    );

    expect(context.store.grantedToOwners).toEqual([
      { adminUserId: OWNER_ID, projectId: expect.any(String) as string },
    ]);
  });

  it('creates a project with only the required settings', async () => {
    const context = inMemoryCliContext();

    await projectCreateCommand.execute(
      context,
      { name: 'Blog', origins: ['https://blog.example.com'] },
      captureOutput(),
    );

    expect(context.store.storedKeys).toHaveLength(1);
  });
});

describe('account:create', () => {
  it('parses the owner e-mail and refuses one that is not an address', () => {
    expect(accountCreateCommand.parse(['--owner-email', 'friend@example.com'])).toEqual({
      ownerEmail: 'friend@example.com',
    });
    expect(() => accountCreateCommand.parse(['--owner-email', 'friend'])).toThrow(CliUsageError);
  });

  it('prints the new free account and its owner as key=value lines', async () => {
    const context = inMemoryCliContext();
    const output = captureOutput();

    await accountCreateCommand.execute(context, { ownerEmail: 'friend@example.com' }, output);

    const owner = await context.admins.findByEmail('friend@example.com');
    expect(output.out).toEqual([
      `account_id=${context.accounts.stored[0]?.id ?? ''}`,
      `owner_admin_id=${owner?.id ?? ''}`,
      'status=comped',
    ]);
    expect(output.err).toEqual([expect.stringContaining('project:create --account')]);
  });
});

describe('account:show', () => {
  it('parses the account id', () => {
    expect(accountShowCommand.parse(['--account', ACCOUNT_ID])).toEqual({ accountId: ACCOUNT_ID });
  });

  async function accountWithAProject() {
    const context = inMemoryCliContext();
    const owner = await context.admins.findOrCreateByEmail('owner@example.com');
    const account = await context.accounts.create({ ownerAdminId: owner.id, status: 'active' });
    context.accounts.add(account, {
      projects: [
        {
          id: PROJECT_ID,
          name: 'My Shop',
          allowedOrigins: ['https://shop.example.com'],
          timezone: 'UTC',
          conversionEvent: null,
          createdAt: new Date('2026-10-14T10:00:00.000Z'),
        },
      ],
      people: 2,
    });
    return { context, account };
  }

  it('prints the account, its use of the plan and one line per project', async () => {
    const { context, account } = await accountWithAProject();
    const output = captureOutput();

    await accountShowCommand.execute(context, { accountId: account.id }, output);

    expect(output.out).toEqual([
      `account_id=${account.id}`,
      'status=active',
      'owner_email=owner@example.com',
      'projects=1/3',
      'people=2/3',
      'events_2026-10=not measured yet/100000',
      'ingestion_paused_until=',
      'suspended_at=',
      'suspension_reason=',
      'deletion_held_at=',
      'deletion_hold_reason=',
      `project=${PROJECT_ID}\tMy Shop`,
    ]);
  });

  it('prints the events measured this month, when, and the pause they caused', async () => {
    const { context, account } = await accountWithAProject();
    const measuredAt = new Date('2026-10-06T03:00:00.000Z');
    const pausedUntil = new Date('2026-11-01T00:00:00.000Z');
    await context.accountUsage.record(
      '2026-10',
      [{ accountId: account.id, events: 151_000, ingestionPausedUntil: pausedUntil }],
      measuredAt,
    );
    context.accounts.add({ ...account, ingestionPausedUntil: pausedUntil });
    const output = captureOutput();

    await accountShowCommand.execute(context, { accountId: account.id }, output);

    expect(output.out).toEqual([
      `account_id=${account.id}`,
      'status=active',
      'owner_email=owner@example.com',
      'projects=0/3',
      'people=0/3',
      'events_2026-10=151000/100000',
      'measured_at=2026-10-06T03:00:00.000Z',
      'ingestion_paused_until=2026-11-01T00:00:00.000Z',
      'suspended_at=',
      'suspension_reason=',
      'deletion_held_at=',
      'deletion_hold_reason=',
    ]);
  });
});

describe('account:suspend and account:resume', () => {
  it('parse the account and a trimmed reason, refusing none or one too long', () => {
    expect(
      accountSuspendCommand.parse(['--account', ACCOUNT_ID, '--reason', '  Forged traffic  ']),
    ).toEqual({ accountId: ACCOUNT_ID, reason: 'Forged traffic' });
    expect(() => accountSuspendCommand.parse(['--account', ACCOUNT_ID])).toThrow(CliUsageError);
    expect(() =>
      accountSuspendCommand.parse(['--account', ACCOUNT_ID, '--reason', 'x'.repeat(501)]),
    ).toThrow(CliUsageError);
    expect(accountResumeCommand.parse(['--account', ACCOUNT_ID])).toEqual({
      accountId: ACCOUNT_ID,
    });
  });

  it('suspend an account and lift it, printing its state and what to do next', async () => {
    const context = inMemoryCliContext();
    const owner = await context.admins.findOrCreateByEmail('owner@example.com');
    const account = await context.accounts.create({ ownerAdminId: owner.id, status: 'active' });
    const suspended = captureOutput();

    await accountSuspendCommand.execute(
      context,
      { accountId: account.id, reason: 'Forged traffic' },
      suspended,
    );

    expect(suspended.out).toEqual([
      `account_id=${account.id}`,
      'status=active',
      'suspended_at=2026-10-06T14:00:00.000Z',
      'suspension_reason=Forged traffic',
    ]);
    expect(suspended.err).toEqual([expect.stringContaining('account:resume')]);
    const shown = captureOutput();
    await accountShowCommand.execute(context, { accountId: account.id }, shown);
    expect(shown.out).toEqual(
      expect.arrayContaining([
        'suspended_at=2026-10-06T14:00:00.000Z',
        'suspension_reason=Forged traffic',
      ]),
    );

    const resumed = captureOutput();
    await accountResumeCommand.execute(context, { accountId: account.id }, resumed);

    expect(resumed.out).toEqual([`account_id=${account.id}`, 'status=active', 'suspended_at=']);
    expect(resumed.err).toEqual([expect.stringContaining('stay revoked')]);
  });
});

describe('account:hold and account:release', () => {
  it('parse the account and a trimmed reason, refusing none or one too long', () => {
    expect(
      accountHoldCommand.parse(['--account', ACCOUNT_ID, '--reason', ' Court order 123 ']),
    ).toEqual({ accountId: ACCOUNT_ID, reason: 'Court order 123' });
    expect(() => accountHoldCommand.parse(['--account', ACCOUNT_ID])).toThrow(CliUsageError);
    expect(() =>
      accountHoldCommand.parse(['--account', ACCOUNT_ID, '--reason', 'x'.repeat(501)]),
    ).toThrow(CliUsageError);
    expect(accountReleaseCommand.parse(['--account', ACCOUNT_ID])).toEqual({
      accountId: ACCOUNT_ID,
    });
  });

  it('hold the deletion and release it, printing the state and what follows', async () => {
    const context = inMemoryCliContext();
    const owner = await context.admins.findOrCreateByEmail('owner@example.com');
    const account = await context.accounts.create({ ownerAdminId: owner.id, status: 'ended' });
    const held = captureOutput();

    await accountHoldCommand.execute(
      context,
      { accountId: account.id, reason: 'Court order 123' },
      held,
    );

    expect(held.out).toEqual([
      `account_id=${account.id}`,
      'status=ended',
      'deletion_held_at=2026-10-06T14:00:00.000Z',
      'deletion_hold_reason=Court order 123',
    ]);
    expect(held.err).toEqual([expect.stringContaining('account:release')]);
    const shown = captureOutput();
    await accountShowCommand.execute(context, { accountId: account.id }, shown);
    expect(shown.out).toEqual(
      expect.arrayContaining([
        'deletion_held_at=2026-10-06T14:00:00.000Z',
        'deletion_hold_reason=Court order 123',
      ]),
    );

    const released = captureOutput();
    await accountReleaseCommand.execute(context, { accountId: account.id }, released);

    expect(released.out).toEqual([`account_id=${account.id}`, 'status=ended', 'deletion_held_at=']);
    expect(released.err).toEqual([expect.stringContaining('next daily job')]);
  });
});

describe('account:close', () => {
  it('parses the account, the reason and a refund mode, refusing an unknown one', () => {
    expect(
      accountCloseCommand.parse([
        '--account',
        ACCOUNT_ID,
        '--reason',
        ' Repeated forged traffic ',
        '--refund',
        'prorata',
      ]),
    ).toEqual({ accountId: ACCOUNT_ID, reason: 'Repeated forged traffic', refund: 'prorata' });
    expect(() =>
      accountCloseCommand.parse(['--account', ACCOUNT_ID, '--reason', 'x', '--refund', 'half']),
    ).toThrow(CliUsageError);
    expect(() => accountCloseCommand.parse(['--account', ACCOUNT_ID, '--reason', 'x'])).toThrow(
      CliUsageError,
    );
  });

  async function subscribedAccount() {
    const context = inMemoryCliContext();
    const account = await context.accounts.create({ ownerAdminId: OWNER_ID, status: 'active' });
    context.closure.subscribe(account.id, 'sub_1');
    context.billing.latestInvoice = {
      invoiceId: 'in_1',
      amountPaid: 3900,
      periodStart: new Date('2026-10-01T00:00:00.000Z'),
      periodEnd: new Date('2026-10-31T00:00:00.000Z'),
    };
    return { context, account };
  }

  it('closes the account, cancels and refunds, printing what happened', async () => {
    const { context, account } = await subscribedAccount();
    const output = captureOutput();

    await accountCloseCommand.execute(
      context,
      { accountId: account.id, reason: 'Repeated forged traffic', refund: 'full' },
      output,
    );

    expect(output.out).toEqual([
      `account_id=${account.id}`,
      'status=ended',
      'access_ended_at=2026-10-06T14:00:00.000Z',
      'deletion_on=2026-11-05T14:00:00.000Z',
      'subscription_cancelled=true',
      'refund=full',
      'refunded_amount=3900',
      'reason=Repeated forged traffic',
    ]);
    expect(output.err).toEqual([expect.stringContaining('next daily job')]);
  });

  it('tells the operator to refund by hand when the refund failed', async () => {
    const { context, account } = await subscribedAccount();
    context.billing.refundFailure = new Error('refunds.create failed');
    const output = captureOutput();

    await accountCloseCommand.execute(
      context,
      { accountId: account.id, reason: 'Fraud', refund: 'full' },
      output,
    );

    expect(output.out).toContain('refunded_amount=0');
    expect(output.err).toEqual([expect.stringContaining('refund it by hand in Stripe')]);
  });
});

describe('account:link', () => {
  it('parses the account and a Stripe subscription id, refusing anything else', () => {
    expect(
      accountLinkCommand.parse(['--account', ACCOUNT_ID, '--subscription', 'sub_abc123']),
    ).toEqual({ accountId: ACCOUNT_ID, subscriptionId: 'sub_abc123' });
    expect(() =>
      accountLinkCommand.parse(['--account', ACCOUNT_ID, '--subscription', 'cus_abc123']),
    ).toThrow(CliUsageError);
  });

  it('prints the account state the subscription leaves', async () => {
    const context = inMemoryCliContext();
    context.accountBilling.add({
      accountId: ACCOUNT_ID,
      status: 'comped',
      accessEndsAt: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    });
    context.billing.addSubscription({
      subscriptionId: 'sub_abc123',
      customerId: 'cus_abc123',
      accountId: null,
      status: 'trialing',
      interval: null,
      trialEndsAt: new Date('2026-10-28T00:00:00.000Z'),
      currentPeriodEndsAt: null,
      cancelAtPeriodEnd: false,
      cardFingerprint: null,
    });
    const output = captureOutput();

    await accountLinkCommand.execute(
      context,
      { accountId: ACCOUNT_ID, subscriptionId: 'sub_abc123' },
      output,
    );

    expect(output.out).toEqual([
      'status=trialing',
      'stripe_customer_id=cus_abc123',
      'billing_interval=',
      'trial_ends_at=2026-10-28T00:00:00.000Z',
      'current_period_ends_at=',
    ]);
    expect(output.err).toEqual([expect.stringContaining('Linked')]);
  });
});

describe('project:update', () => {
  it('parses each setting it can change', () => {
    expect(
      projectUpdateCommand.parse([
        '--project',
        PROJECT_ID,
        '--name',
        'Store',
        '--origin',
        'https://shop.example.com',
        '--timezone',
        'UTC',
        '--conversion-event',
        'plan_selected',
      ]),
    ).toEqual({
      projectId: PROJECT_ID,
      name: 'Store',
      origins: ['https://shop.example.com'],
      timezone: 'UTC',
      conversionEvent: 'plan_selected',
    });
  });

  it('reads --clear-conversion-event as clearing it', () => {
    expect(
      projectUpdateCommand.parse(['--project', PROJECT_ID, '--clear-conversion-event']),
    ).toEqual({
      projectId: PROJECT_ID,
      conversionEvent: null,
    });
  });

  it.each([
    ['nothing to change', ['--project', PROJECT_ID]],
    [
      'both conversion flags',
      ['--project', PROJECT_ID, '--conversion-event', 'x', '--clear-conversion-event'],
    ],
    ['a project id that is not a UUID', ['--project', 'shop', '--timezone', 'UTC']],
  ])('refuses %s', (_, argv) => {
    expect(() => projectUpdateCommand.parse(argv)).toThrow(CliUsageError);
  });

  it('prints the settings after the change', async () => {
    const { context, projectId } = await createdProject();
    const output = captureOutput();

    await projectUpdateCommand.execute(
      context,
      {
        projectId,
        name: 'Store',
        origins: ['https://shop.example.com', 'http://localhost:5173'],
        timezone: 'Europe/Lisbon',
        conversionEvent: 'plan_selected',
      },
      output,
    );

    expect(output.out).toEqual([
      `project_id=${projectId}`,
      'name=Store',
      'allowed_origins=https://shop.example.com,http://localhost:5173',
      'timezone=Europe/Lisbon',
      'conversion_event=plan_selected',
    ]);
  });

  it('changes only the time zone when that is all it is given', async () => {
    const { context, projectId } = await createdProject();
    const output = captureOutput();

    await projectUpdateCommand.execute(context, { projectId, timezone: 'UTC' }, output);

    expect(output.out).toContain('allowed_origins=https://shop.example.com');
  });

  it('prints an empty conversion event once it is cleared', async () => {
    const { context, projectId } = await createdProject();
    const output = captureOutput();

    await projectUpdateCommand.execute(context, { projectId, conversionEvent: null }, output);

    expect(output.out).toContain('conversion_event=');
  });
});

describe('project:delete', () => {
  it('reads the project id and the name that confirms it', () => {
    expect(
      projectDeleteCommand.parse(['--project', PROJECT_ID, '--confirm-name', 'My Shop']),
    ).toEqual({ projectId: PROJECT_ID, confirmName: 'My Shop' });
  });

  it.each([
    [['--confirm-name', 'Shop']],
    [['--project', PROJECT_ID]],
    [['--project', PROJECT_ID, '--confirm-name', ' ']],
  ])('refuses %j without both the project and its name', (argv) => {
    expect(() => projectDeleteCommand.parse(argv)).toThrow(CliUsageError);
  });

  it('prints the project and how many events and keys went with it', async () => {
    const { context, projectId } = await createdProject();
    context.store.recordEvents(projectId, 7);
    const output = captureOutput();

    await projectDeleteCommand.execute(context, { projectId, confirmName: 'Shop' }, output);

    expect(output.out).toEqual([
      `project_id=${projectId}`,
      'name=Shop',
      'deleted_events=7',
      'deleted_keys=1',
    ]);
    expect(await context.store.findById(projectId)).toBeNull();
  });
});

describe('key:create', () => {
  it('parses the project and the kind', () => {
    expect(keyCreateCommand.parse(['--project', PROJECT_ID, '--kind', 'secret'])).toEqual({
      projectId: PROJECT_ID,
      kind: 'secret',
    });
  });

  it('refuses a kind it does not know', () => {
    expect(() => keyCreateCommand.parse(['--project', PROJECT_ID, '--kind', 'admin'])).toThrow(
      '--kind must be public or secret.',
    );
  });

  it('prints a secret key alone on stdout, so it can be piped, and the note on stderr', async () => {
    const { context, projectId } = await createdProject();
    const output = captureOutput();

    await keyCreateCommand.execute(context, { projectId, kind: 'secret' }, output);

    expect(output.out).toHaveLength(1);
    expect(output.out[0]).toMatch(SECRET_KEY_PATTERN);
    expect(output.err).toEqual([expect.stringContaining('shown only now')]);
  });

  it('prints a new public key the same way', async () => {
    const { context, projectId } = await createdProject();
    const output = captureOutput();

    await keyCreateCommand.execute(context, { projectId, kind: 'public' }, output);

    expect(output.out[0]).toMatch(PUBLIC_KEY_PATTERN);
    expect(output.err).toEqual([expect.stringMatching(/^Public key .* created\.$/)]);
  });
});

describe('key:revoke', () => {
  it('parses the key id', () => {
    expect(keyRevokeCommand.parse(['--key-id', PROJECT_ID])).toEqual({ keyId: PROJECT_ID });
  });

  it('revokes the key and warns about the cache of running instances', async () => {
    const { context, publicKeyId, publicKey } = await createdProject();
    const output = captureOutput();

    await keyRevokeCommand.execute(context, { keyId: publicKeyId }, output);

    expect(output.out).toEqual([`revoked_key_id=${publicKeyId}`]);
    expect(output.err).toEqual([expect.stringContaining('60 seconds')]);
    expect(await context.store.findByPublicKey(publicKey)).toBeNull();
  });
});

describe('admin:revoke', () => {
  it('parses the email and the project id', () => {
    expect(
      adminRevokeCommand.parse(['--email', 'ana@example.com', '--project', PROJECT_ID]),
    ).toEqual({ email: 'ana@example.com', projectId: PROJECT_ID });
  });

  it('refuses a project id that is not one', () => {
    expect(() =>
      adminRevokeCommand.parse(['--email', 'ana@example.com', '--project', 'x']),
    ).toThrow(CliUsageError);
  });

  it('takes the person off the project and prints their id', async () => {
    const { context, projectId } = await createdProject();
    const admin = await context.admins.findOrCreateByEmail('ana@example.com');
    context.people.addPerson(projectId, 'ana@example.com', admin.id);
    const output = captureOutput();

    await adminRevokeCommand.execute(context, { email: 'ana@example.com', projectId }, output);

    expect(output.out).toEqual([`admin_user_id=${admin.id}`, `project_id=${projectId}`]);
    expect(output.err).toEqual([expect.stringContaining('ana@example.com no longer reads')]);
    expect(await context.people.peopleOf(projectId)).toEqual([]);
  });
});

describe('admin:grant', () => {
  it('parses the email and the project id', () => {
    expect(
      adminGrantCommand.parse(['--email', 'ana@example.com', '--project', PROJECT_ID]),
    ).toEqual({ email: 'ana@example.com', projectId: PROJECT_ID });
  });

  it('refuses an email that is not one', () => {
    expect(() => adminGrantCommand.parse(['--email', 'ana', '--project', PROJECT_ID])).toThrow(
      CliUsageError,
    );
  });

  it('grants the project and prints the admin id', async () => {
    const { context, projectId } = await createdProject();
    const output = captureOutput();

    await adminGrantCommand.execute(context, { email: 'Ana@Example.com', projectId }, output);

    const admin = await context.admins.findByEmail('ana@example.com');
    expect(output.out).toEqual([`admin_user_id=${String(admin?.id)}`, `project_id=${projectId}`]);
    expect(output.err).toEqual([expect.stringContaining('ana@example.com can now ask')]);
  });
});
