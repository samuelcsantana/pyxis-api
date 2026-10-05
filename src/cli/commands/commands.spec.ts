import { PUBLIC_KEY_PATTERN, SECRET_KEY_PATTERN } from '../../domain/keys/project-keys';
import { captureOutput, inMemoryCliContext } from '../../test-utils/cli-test-context';
import { CliUsageError } from '../cli-args';
import { keyCreateCommand } from './key-create.command';
import { keyRevokeCommand } from './key-revoke.command';
import { projectCreateCommand } from './project-create.command';
import { projectUpdateCommand } from './project-update.command';

const PROJECT_ID = '9f1c2b3a-1d2e-4f5a-8b6c-7d8e9f0a1b2c';

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

describe('project:update', () => {
  it('parses each setting it can change', () => {
    expect(
      projectUpdateCommand.parse([
        '--project',
        PROJECT_ID,
        '--origin',
        'https://shop.example.com',
        '--timezone',
        'UTC',
        '--conversion-event',
        'plan_selected',
      ]),
    ).toEqual({
      projectId: PROJECT_ID,
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
        origins: ['https://shop.example.com', 'http://localhost:5173'],
        timezone: 'Europe/Lisbon',
        conversionEvent: 'plan_selected',
      },
      output,
    );

    expect(output.out).toEqual([
      `project_id=${projectId}`,
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
