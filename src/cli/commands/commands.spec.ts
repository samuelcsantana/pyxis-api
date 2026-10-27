import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sha256Hex } from '../../domain/auth/hashing';
import { PUBLIC_KEY_PATTERN, SECRET_KEY_PATTERN } from '../../domain/keys/project-keys';
import { captureOutput, inMemoryCliContext } from '../../test-utils/cli-test-context';
import { CliUsageError } from '../cli-args';
import { accountCloseCommand } from './account-close.command';
import { accountCreateCommand } from './account-create.command';
import { accountExemptQuotaCommand } from './account-exempt-quota.command';
import { AccountNotFoundError } from '../../domain/errors/account.errors';
import { accountLimitsCommand } from './account-limits.command';
import { accountHoldCommand } from './account-hold.command';
import { accountReleaseCommand } from './account-release.command';
import { accountLinkCommand } from './account-link.command';
import { accountResumeCommand } from './account-resume.command';
import { accountShowCommand } from './account-show.command';
import { accountSuspendCommand } from './account-suspend.command';
import { adminGrantCommand } from './admin-grant.command';
import { adminResumeCommand } from './admin-resume.command';
import { adminRevokeCommand } from './admin-revoke.command';
import { adminSuspendCommand } from './admin-suspend.command';
import { connectionRevokeCommand } from './connection-revoke.command';
import { keyCreateCommand } from './key-create.command';
import { noticeCreateCommand } from './notice-create.command';
import { keyRevokeCommand } from './key-revoke.command';
import { projectCreateCommand } from './project-create.command';
import { projectDemoTrafficCommand } from './project-demo-traffic.command';
import { projectDeleteCommand } from './project-delete.command';
import { projectHoldCommand } from './project-hold.command';
import { projectReleaseCommand } from './project-release.command';
import { projectResumeCommand } from './project-resume.command';
import { projectSuspendCommand } from './project-suspend.command';
import { projectUpdateCommand } from './project-update.command';
import { reviewerCloseCommand } from './reviewer-close.command';
import { reviewerOpenCommand } from './reviewer-open.command';
import { tokenRevokeCommand } from './token-revoke.command';
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
    const account = await context.accounts.create({ ownerAdminId: OWNER_ID, status: 'active' });
    expect(account.id).toBe(ACCOUNT_ID);

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

  it('prints the new comped account and its owner as key=value lines', async () => {
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
    expect(output.err).toEqual([expect.stringContaining("paid plan's limits")]);
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
      'quota_pause_exempt_until=',
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
      'quota_pause_exempt_until=',
      'suspended_at=',
      'suspension_reason=',
      'deletion_held_at=',
      'deletion_hold_reason=',
    ]);
  });
});

describe('account:exempt-quota', () => {
  it('parses an account and either a day or --clear, refusing both, neither or a bad day', () => {
    expect(
      accountExemptQuotaCommand.parse(['--account', ACCOUNT_ID, '--until', '2027-01-15']),
    ).toEqual({ accountId: ACCOUNT_ID, until: new Date('2027-01-15T00:00:00.000Z') });
    expect(accountExemptQuotaCommand.parse(['--account', ACCOUNT_ID, '--clear'])).toEqual({
      accountId: ACCOUNT_ID,
      until: null,
    });
    for (const argv of [
      ['--account', ACCOUNT_ID],
      ['--account', ACCOUNT_ID, '--until', '2027-01-15', '--clear'],
      ['--account', ACCOUNT_ID, '--until', '15/01/2027'],
      ['--account', ACCOUNT_ID, '--until', '2027-02-30'],
      ['--account', ACCOUNT_ID, '--until', '2027-13-01'],
    ]) {
      expect(() => accountExemptQuotaCommand.parse(argv)).toThrow(CliUsageError);
    }
  });

  it('exempts the account until that day, lifting a pause, and ends the exemption', async () => {
    const context = inMemoryCliContext();
    const owner = await context.admins.findOrCreateByEmail('owner@example.com');
    const account = await context.accounts.create({ ownerAdminId: owner.id, status: 'active' });
    context.accounts.add({
      ...account,
      ingestionPausedUntil: new Date('2026-11-01T00:00:00.000Z'),
    });
    const exempted = captureOutput();

    await accountExemptQuotaCommand.execute(
      context,
      { accountId: account.id, until: new Date('2027-01-15T00:00:00.000Z') },
      exempted,
    );

    expect(exempted.out).toEqual([
      `account_id=${account.id}`,
      'quota_pause_exempt_until=2027-01-15T00:00:00.000Z',
    ]);
    expect((await context.accounts.findById(account.id))?.ingestionPausedUntil).toBeNull();
    expect(exempted.err).toEqual([expect.stringContaining('Within a minute')]);
    const shown = captureOutput();
    await accountShowCommand.execute(context, { accountId: account.id }, shown);
    expect(shown.out).toContain('quota_pause_exempt_until=2027-01-15T00:00:00.000Z');

    const cleared = captureOutput();
    await accountExemptQuotaCommand.execute(
      context,
      { accountId: account.id, until: null },
      cleared,
    );

    expect(cleared.out).toEqual([`account_id=${account.id}`, 'quota_pause_exempt_until=']);
    expect(cleared.err).toEqual([expect.stringContaining('next daily measurement')]);
  });
});

describe('account:limits', () => {
  it('parses the limits it is given or a reset, refusing both, neither or a bad number', () => {
    expect(
      accountLimitsCommand.parse(['--account', ACCOUNT_ID, '--projects', '10', '--people', '8']),
    ).toEqual({ accountId: ACCOUNT_ID, changes: { projectsLimit: 10, peopleLimit: 8 } });
    expect(accountLimitsCommand.parse(['--account', ACCOUNT_ID, '--events', '1000000'])).toEqual({
      accountId: ACCOUNT_ID,
      changes: { eventsPerMonthLimit: 1_000_000 },
    });
    expect(accountLimitsCommand.parse(['--account', ACCOUNT_ID, '--reset'])).toEqual({
      accountId: ACCOUNT_ID,
      changes: { eventsPerMonthLimit: null, projectsLimit: null, peopleLimit: null },
    });
    for (const argv of [
      ['--account', ACCOUNT_ID],
      ['--account', ACCOUNT_ID, '--projects', '10', '--reset'],
      ['--account', ACCOUNT_ID, '--projects', '0'],
      ['--account', ACCOUNT_ID, '--people', '2.5'],
      ['--account', ACCOUNT_ID, '--events', '-1'],
      ['--account', ACCOUNT_ID, '--projects', '101'],
      ['--account', ACCOUNT_ID, '--events', '100000001'],
    ]) {
      expect(() => accountLimitsCommand.parse(argv)).toThrow(CliUsageError);
    }
  });

  it('gives an account larger limits and shows them, with nothing over', async () => {
    const context = inMemoryCliContext();
    const owner = await context.admins.findOrCreateByEmail('owner@example.com');
    const account = await context.accounts.create({ ownerAdminId: owner.id, status: 'active' });
    const output = captureOutput();

    await accountLimitsCommand.execute(
      context,
      { accountId: account.id, changes: { eventsPerMonthLimit: 1_000_000, projectsLimit: 10 } },
      output,
    );

    expect(output.out).toEqual([
      `account_id=${account.id}`,
      'events_per_month=1000000',
      'projects=0/10',
      'people=0/3',
    ]);
    expect(output.err).toEqual([expect.stringContaining('from now on')]);
  });

  it('says what is over a lowered limit, deleting nothing', async () => {
    const context = inMemoryCliContext();
    const owner = await context.admins.findOrCreateByEmail('owner@example.com');
    const account = await context.accounts.create({ ownerAdminId: owner.id, status: 'active' });
    const project = {
      name: 'Site',
      allowedOrigins: ['https://site.example.com'],
      timezone: 'UTC',
      conversionEvent: null,
      createdAt: new Date('2026-10-14T10:00:00.000Z'),
    };
    context.accounts.add(account, {
      projects: [
        { ...project, id: 'b0000000-0000-4000-8000-000000000001' },
        { ...project, id: 'b0000000-0000-4000-8000-000000000002' },
      ],
      people: 3,
    });
    await context.accountUsage.record(
      '2026-10',
      [{ accountId: account.id, events: 900, ingestionPausedUntil: null }],
      new Date('2026-10-06T03:00:00.000Z'),
    );
    const output = captureOutput();

    await accountLimitsCommand.execute(
      context,
      {
        accountId: account.id,
        changes: { eventsPerMonthLimit: 500, projectsLimit: 1, peopleLimit: 2 },
      },
      output,
    );

    expect(output.out).toEqual([
      `account_id=${account.id}`,
      'events_per_month=500',
      'projects=2/1',
      'people=3/2',
      'over_events=900/500',
      'over_projects=2/1',
      'over_people=3/2',
    ]);
    expect(output.err).toEqual([expect.stringContaining('Nothing is deleted')]);
    expect(await context.accounts.projectsOf(account.id)).toHaveLength(2);
  });

  it('refuses an account that does not exist', async () => {
    await expect(
      accountLimitsCommand.execute(
        inMemoryCliContext(),
        { accountId: ACCOUNT_ID, changes: { projectsLimit: 5 } },
        captureOutput(),
      ),
    ).rejects.toThrow(AccountNotFoundError);
  });
});

describe('notice:create', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'pyxis-notice-'));
    writeFileSync(path.join(directory, 'en.txt'), 'Prices change\n\nFrom December.\n');
    writeFileSync(path.join(directory, 'pt-BR.txt'), 'Os preços mudam\n\nA partir de dezembro.\n');
    writeFileSync(path.join(directory, 'es.txt'), 'Los precios cambian\n\nDesde diciembre.\n');
    writeFileSync(path.join(directory, 'de.txt'), 'Die Preise ändern sich\n\nAb Dezember.\n');
    writeFileSync(path.join(directory, 'fr.txt'), 'Les prix changent\n\nÀ partir de décembre.\n');
    writeFileSync(path.join(directory, 'it.txt'), 'I prezzi cambiano\n\nDa dicembre.\n');
    writeFileSync(path.join(directory, 'nl.txt'), 'De prijzen veranderen\n\nVanaf december.\n');
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('reads the seven languages from the folder, with the flags', () => {
    expect(
      noticeCreateCommand.parse([
        '--campaign',
        'prices-2026-12',
        '--dir',
        directory,
        '--include-ended',
        '--dry-run',
      ]),
    ).toEqual({
      campaign: 'prices-2026-12',
      content: {
        en: { subject: 'Prices change', paragraphs: ['From December.'] },
        'pt-BR': { subject: 'Os preços mudam', paragraphs: ['A partir de dezembro.'] },
        es: { subject: 'Los precios cambian', paragraphs: ['Desde diciembre.'] },
        de: { subject: 'Die Preise ändern sich', paragraphs: ['Ab Dezember.'] },
        fr: { subject: 'Les prix changent', paragraphs: ['À partir de décembre.'] },
        it: { subject: 'I prezzi cambiano', paragraphs: ['Da dicembre.'] },
        nl: { subject: 'De prijzen veranderen', paragraphs: ['Vanaf december.'] },
      },
      includeEnded: true,
      dryRun: true,
    });
  });

  it('refuses a bad campaign name and a folder without one of the languages', () => {
    expect(() => noticeCreateCommand.parse(['--campaign', 'Prices!', '--dir', directory])).toThrow(
      CliUsageError,
    );
    rmSync(path.join(directory, 'nl.txt'));
    expect(() => noticeCreateCommand.parse(['--campaign', 'prices', '--dir', directory])).toThrow(
      /nl\.txt/,
    );
  });

  it('prints the count per language of a dry run, then stores the notice', async () => {
    const context = inMemoryCliContext();
    context.notices.addRecipient({
      accountId: 'acc-1',
      status: 'active',
      ownerEmail: 'ana@example.com',
      ownerLanguage: 'pt-BR',
    });
    const args = noticeCreateCommand.parse(['--campaign', 'prices', '--dir', directory]);
    const dry = captureOutput();
    const stored = captureOutput();

    await noticeCreateCommand.execute(context, { ...args, dryRun: true }, dry);
    await noticeCreateCommand.execute(context, args, stored);

    expect(dry.out).toEqual([
      'campaign=prices',
      'dry_run=true',
      'recipients=1',
      'recipients_en=0',
      'recipients_pt-BR=1',
      'recipients_es=0',
      'recipients_de=0',
      'recipients_fr=0',
      'recipients_it=0',
      'recipients_nl=0',
    ]);
    expect(dry.err).toEqual([expect.stringContaining('without --dry-run')]);
    expect(stored.out).toContain('dry_run=false');
    expect(stored.err).toEqual([expect.stringContaining('account-notices')]);
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

describe('project:suspend and project:resume', () => {
  it('parse the project and a trimmed reason, refusing none or one too long', () => {
    expect(
      projectSuspendCommand.parse(['--project', PROJECT_ID, '--reason', '  Forged traffic  ']),
    ).toEqual({ projectId: PROJECT_ID, reason: 'Forged traffic' });
    expect(() => projectSuspendCommand.parse(['--project', PROJECT_ID])).toThrow(CliUsageError);
    expect(() =>
      projectSuspendCommand.parse(['--project', PROJECT_ID, '--reason', 'x'.repeat(501)]),
    ).toThrow(CliUsageError);
    expect(projectResumeCommand.parse(['--project', PROJECT_ID])).toEqual({
      projectId: PROJECT_ID,
    });
  });

  it('suspend the reception of a project and lift it, saying it takes up to a minute', async () => {
    const context = inMemoryCliContext();
    context.projectSuspensions.add(PROJECT_ID, 'My Shop');
    const suspended = captureOutput();

    await projectSuspendCommand.execute(
      context,
      { projectId: PROJECT_ID, reason: 'Forged traffic' },
      suspended,
    );

    expect(suspended.out).toEqual([
      `project_id=${PROJECT_ID}`,
      'name=My Shop',
      'ingestion_suspended_at=2026-10-06T14:00:00.000Z',
      'ingestion_suspension_reason=Forged traffic',
    ]);
    expect(suspended.err).toEqual([expect.stringContaining('Within a minute')]);

    const resumed = captureOutput();
    await projectResumeCommand.execute(context, { projectId: PROJECT_ID }, resumed);

    expect(resumed.out).toEqual([
      `project_id=${PROJECT_ID}`,
      'name=My Shop',
      'ingestion_suspended_at=',
    ]);
    expect(resumed.err).toEqual([expect.stringContaining('Within a minute')]);
  });
});

describe('project:hold and project:release', () => {
  it('parse the project and a trimmed reason, refusing none or one too long', () => {
    expect(
      projectHoldCommand.parse(['--project', PROJECT_ID, '--reason', '  Court order  ']),
    ).toEqual({ projectId: PROJECT_ID, reason: 'Court order' });
    expect(() => projectHoldCommand.parse(['--project', PROJECT_ID])).toThrow(CliUsageError);
    expect(() =>
      projectHoldCommand.parse(['--project', PROJECT_ID, '--reason', 'x'.repeat(501)]),
    ).toThrow(CliUsageError);
    expect(projectReleaseCommand.parse(['--project', PROJECT_ID])).toEqual({
      projectId: PROJECT_ID,
    });
  });

  it('hold the deletion of a project and release it, saying what that keeps', async () => {
    const context = inMemoryCliContext();
    context.projectHolds.add(PROJECT_ID, 'My Shop');
    const held = captureOutput();

    await projectHoldCommand.execute(
      context,
      { projectId: PROJECT_ID, reason: 'Court order' },
      held,
    );

    expect(held.out).toEqual([
      `project_id=${PROJECT_ID}`,
      'name=My Shop',
      'deletion_held_at=2026-10-06T14:00:00.000Z',
      'deletion_hold_reason=Court order',
    ]);
    expect(held.err).toEqual([expect.stringContaining('project:release')]);

    const released = captureOutput();
    await projectReleaseCommand.execute(context, { projectId: PROJECT_ID }, released);

    expect(released.out).toEqual([`project_id=${PROJECT_ID}`, 'name=My Shop', 'deletion_held_at=']);
    expect(released.err).toEqual([expect.stringContaining('next daily job')]);
  });
});

describe('admin:suspend, admin:resume, token:revoke and connection:revoke', () => {
  it('parse an e-mail address or a token id, refusing anything else', () => {
    expect(adminSuspendCommand.parse(['--email', 'ana@example.com'])).toEqual({
      email: 'ana@example.com',
    });
    expect(adminResumeCommand.parse(['--email', 'ana@example.com'])).toEqual({
      email: 'ana@example.com',
    });
    expect(() => adminSuspendCommand.parse(['--email', 'ana'])).toThrow(CliUsageError);
    expect(tokenRevokeCommand.parse(['--token', ACCOUNT_ID])).toEqual({ tokenId: ACCOUNT_ID });
    expect(() => tokenRevokeCommand.parse(['--token', 'pyxis_at_x'])).toThrow(CliUsageError);
    expect(connectionRevokeCommand.parse(['--connection', ACCOUNT_ID])).toEqual({
      connectionId: ACCOUNT_ID,
    });
    expect(() => connectionRevokeCommand.parse(['--connection', 'claude'])).toThrow(CliUsageError);
  });

  it('suspend a person, ending their sessions, tokens and connections, and lift it', async () => {
    const context = inMemoryCliContext();
    const ana = await context.admins.findOrCreateByEmail('ana@example.com');
    await context.sessions.create({
      adminUserId: ana.id,
      tokenHash: 'a'.repeat(64),
      createdAt: new Date('2026-10-06T10:00:00.000Z'),
    });
    await context.connections.create(
      { adminUserId: ana.id, clientId: 'claude', createdAt: new Date('2026-10-06T10:00:00.000Z') },
      [],
    );
    const suspended = captureOutput();

    await adminSuspendCommand.execute(context, { email: 'ana@example.com' }, suspended);

    expect(suspended.out).toEqual([
      `admin_user_id=${ana.id}`,
      'email=ana@example.com',
      'suspended_at=2026-10-06T14:00:00.000Z',
      'sessions_ended=1',
      'tokens_revoked=0',
      'connections_revoked=1',
    ]);
    expect(suspended.err).toEqual([expect.stringContaining('admin:resume')]);

    const resumed = captureOutput();
    await adminResumeCommand.execute(context, { email: 'ana@example.com' }, resumed);

    expect(resumed.out).toEqual([
      `admin_user_id=${ana.id}`,
      'email=ana@example.com',
      'suspended_at=',
    ]);
    expect(resumed.err).toEqual([expect.stringContaining('stay ended')]);
  });

  it("revokes anyone's token by the id the dashboard shows", async () => {
    const context = inMemoryCliContext();
    const token = await context.tokens.create({
      adminUserId: OWNER_ID,
      name: 'Published by mistake',
      tokenHash: 'b'.repeat(64),
      createdAt: new Date('2026-10-06T10:00:00.000Z'),
      expiresAt: new Date('2026-11-05T10:00:00.000Z'),
    });
    const output = captureOutput();

    await tokenRevokeCommand.execute(context, { tokenId: token.id }, output);

    expect(output.out).toEqual([`token_id=${token.id}`, 'revoked=true']);
    expect(context.tokens.stored[0]?.revokedAt).not.toBeNull();
  });

  it("revokes anyone's connection by the id the dashboard shows", async () => {
    const context = inMemoryCliContext();
    const connection = await context.connections.create(
      {
        adminUserId: OWNER_ID,
        clientId: 'claude',
        createdAt: new Date('2026-10-06T10:00:00.000Z'),
      },
      [],
    );
    const output = captureOutput();

    await connectionRevokeCommand.execute(context, { connectionId: connection.id }, output);

    expect(output.out).toEqual([`connection_id=${connection.id}`, 'revoked=true']);
    expect(output.err).toEqual([expect.stringContaining('connect it again')]);
    expect(context.connections.connections[0]?.revokedAt).not.toBeNull();
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

describe('reviewer:open and reviewer:close', () => {
  it('parse an e-mail address and an optional number of days, a year by default', () => {
    expect(reviewerOpenCommand.parse(['--email', 'reviewer@example.com'])).toEqual({
      email: 'reviewer@example.com',
      days: 365,
    });
    expect(reviewerOpenCommand.parse(['--email', 'reviewer@example.com', '--days', '30'])).toEqual({
      email: 'reviewer@example.com',
      days: 30,
    });
    for (const days of ['0', '366', '7.5', 'month']) {
      expect(() =>
        reviewerOpenCommand.parse(['--email', 'reviewer@example.com', '--days', days]),
      ).toThrow(CliUsageError);
    }
    expect(() => reviewerOpenCommand.parse(['--days', '30'])).toThrow(CliUsageError);
    expect(reviewerCloseCommand.parse(['--email', 'reviewer@example.com'])).toEqual({
      email: 'reviewer@example.com',
    });
    expect(() => reviewerCloseCommand.parse(['--email', 'reviewer'])).toThrow(CliUsageError);
  });

  it('print the code once, keeping only its hash, then close it', async () => {
    const context = inMemoryCliContext();
    const reviewer = await context.admins.findOrCreateByEmail('reviewer@example.com');
    const opened = captureOutput();

    await reviewerOpenCommand.execute(context, { email: 'reviewer@example.com', days: 30 }, opened);

    const code = opened.out.find((line) => line.startsWith('code='))?.slice('code='.length) ?? '';
    expect(code).toMatch(/^\d{6}$/);
    expect(opened.out).toEqual([
      `admin_user_id=${reviewer.id}`,
      'email=reviewer@example.com',
      `code=${code}`,
      'expires_at=2026-11-05T14:00:00.000Z',
    ]);
    expect(opened.err).toEqual([expect.stringContaining('20 wrong codes close it')]);
    expect(context.reviewerCodes.stored.get(reviewer.id)?.codeHash).toBe(sha256Hex(code));

    const closed = captureOutput();
    await reviewerCloseCommand.execute(context, { email: 'reviewer@example.com' }, closed);
    const again = captureOutput();
    await reviewerCloseCommand.execute(context, { email: 'reviewer@example.com' }, again);

    expect(closed.out).toEqual([`admin_user_id=${reviewer.id}`, 'closed=true']);
    expect(closed.err).toEqual([expect.stringContaining('e-mailed sign-in codes again')]);
    expect(again.out).toEqual([`admin_user_id=${reviewer.id}`, 'closed=false']);
    expect(again.err).toEqual(['This admin had no reviewer code open.']);
  });
});

describe('project:demo-traffic', () => {
  it('parses the project and an optional --off, refusing an id that is not a UUID', () => {
    expect(projectDemoTrafficCommand.parse(['--project', PROJECT_ID])).toEqual({
      projectId: PROJECT_ID,
      demoTraffic: true,
    });
    expect(projectDemoTrafficCommand.parse(['--project', PROJECT_ID, '--off'])).toEqual({
      projectId: PROJECT_ID,
      demoTraffic: false,
    });
    expect(() => projectDemoTrafficCommand.parse(['--project', 'demo'])).toThrow(CliUsageError);
  });

  it('marks a project of the operator, says when the visits come, and unmarks it', async () => {
    const context = inMemoryCliContext();
    context.demoTraffic.add({ projectId: PROJECT_ID, projectName: 'Demo store', accountId: null });
    const marked = captureOutput();
    const unmarked = captureOutput();

    await projectDemoTrafficCommand.execute(
      context,
      { projectId: PROJECT_ID, demoTraffic: true },
      marked,
    );
    await projectDemoTrafficCommand.execute(
      context,
      { projectId: PROJECT_ID, demoTraffic: false },
      unmarked,
    );

    expect(marked.out).toEqual([
      `project_id=${PROJECT_ID}`,
      'name=Demo store',
      'demo_traffic=true',
    ]);
    expect(marked.err).toEqual([expect.stringContaining('the 90 days before today')]);
    expect(unmarked.out).toEqual([
      `project_id=${PROJECT_ID}`,
      'name=Demo store',
      'demo_traffic=false',
    ]);
    expect(unmarked.err).toEqual([expect.stringContaining('adds nothing more')]);
  });
});
