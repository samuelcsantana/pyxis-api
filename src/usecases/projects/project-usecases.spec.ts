import {
  InvalidProjectSettingsError,
  ProjectKeyNotFoundError,
  ProjectNotFoundError,
} from '../../domain/errors/project.errors';
import {
  hashSecretKey,
  PUBLIC_KEY_PATTERN,
  SECRET_KEY_PATTERN,
} from '../../domain/keys/project-keys';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryProjectRepository } from '../../test-utils/in-memory-project.repository';
import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import { CreateProjectKeyUseCase } from './create-project-key.usecase';
import { CreateProjectUseCase } from './create-project.usecase';
import { RevokeProjectKeyUseCase } from './revoke-project-key.usecase';
import { UpdateProjectUseCase } from './update-project.usecase';

const NOW = new Date('2026-10-06T14:00:00.000Z');
const MISSING_ID = 'ffffffff-ffff-4fff-bfff-ffffffffffff';

function setup() {
  const store = new InMemoryProjectRepository();
  const random = new SequenceRandomSource(Array.from({ length: 62 }, (_, index) => index));
  return {
    store,
    createProject: new CreateProjectUseCase(store, random),
    createKey: new CreateProjectKeyUseCase(store, store, random),
    revokeKey: new RevokeProjectKeyUseCase(store, new FixedClock(NOW)),
    updateProject: new UpdateProjectUseCase(store),
  };
}

describe('CreateProjectUseCase', () => {
  it('creates the project with its first public key, which resolves the project at once', async () => {
    const { store, createProject } = setup();

    const created = await createProject.execute({
      name: ' Shop ',
      allowedOrigins: ['https://shop.example.com'],
      timezone: 'America/Sao_Paulo',
      conversionEvent: 'signup_completed',
    });

    expect(created.publicKey).toMatch(PUBLIC_KEY_PATTERN);
    expect(await store.findByPublicKey(created.publicKey)).toMatchObject({
      id: created.projectId,
      name: 'Shop',
      allowedOrigins: ['https://shop.example.com'],
      timezone: 'America/Sao_Paulo',
      conversionEvent: 'signup_completed',
    });
    expect(store.storedKeys).toEqual([
      expect.objectContaining({
        id: created.publicKeyId,
        kind: 'public',
        publicKey: created.publicKey,
      }),
    ]);
  });

  it('defaults to UTC and no conversion event', async () => {
    const { store, createProject } = setup();

    const created = await createProject.execute({
      name: 'Blog',
      allowedOrigins: ['https://blog.example.com'],
    });

    expect(await store.findById(created.projectId)).toMatchObject({
      timezone: 'UTC',
      conversionEvent: null,
    });
  });

  it.each([
    ['a blank name', { name: ' ', allowedOrigins: ['https://shop.example.com'] }],
    ['no origin', { name: 'Shop', allowedOrigins: [] }],
    ['an origin with a path', { name: 'Shop', allowedOrigins: ['https://shop.example.com/app'] }],
    [
      'an unknown time zone',
      { name: 'Shop', allowedOrigins: ['https://shop.example.com'], timezone: 'Mars/Olympus' },
    ],
    [
      'an invalid conversion event',
      { name: 'Shop', allowedOrigins: ['https://shop.example.com'], conversionEvent: 'Signup' },
    ],
  ])('refuses %s and stores nothing', async (_, command) => {
    const { store, createProject } = setup();

    await expect(createProject.execute(command)).rejects.toBeInstanceOf(
      InvalidProjectSettingsError,
    );
    expect(store.storedKeys).toEqual([]);
  });
});

describe('CreateProjectKeyUseCase', () => {
  async function withProject() {
    const context = setup();
    const { projectId } = await context.createProject.execute({
      name: 'Shop',
      allowedOrigins: ['https://shop.example.com'],
    });
    return { ...context, projectId };
  }

  it('returns a secret key once and stores only its hash', async () => {
    const { store, createKey, projectId } = await withProject();

    const created = await createKey.execute({ projectId, kind: 'secret' });

    expect(created.kind).toBe('secret');
    expect(created.key).toMatch(SECRET_KEY_PATTERN);
    const stored = store.storedKeys.find((key) => key.id === created.keyId);
    expect(stored).toMatchObject({ kind: 'secret', secretHash: hashSecretKey(created.key) });
    expect(JSON.stringify(store.storedKeys)).not.toContain(created.key);
  });

  it('adds another public key, for a rotation', async () => {
    const { store, createKey, projectId } = await withProject();

    const created = await createKey.execute({ projectId, kind: 'public' });

    expect(created.key).toMatch(PUBLIC_KEY_PATTERN);
    expect((await store.findByPublicKey(created.key))?.id).toBe(projectId);
  });

  it('refuses a project that does not exist', async () => {
    const { createKey } = setup();

    await expect(
      createKey.execute({ projectId: MISSING_ID, kind: 'secret' }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});

describe('RevokeProjectKeyUseCase', () => {
  it('revokes a live key now, after which it resolves nothing', async () => {
    const { store, createProject, revokeKey } = setup();
    const created = await createProject.execute({
      name: 'Shop',
      allowedOrigins: ['https://shop.example.com'],
    });

    await revokeKey.execute(created.publicKeyId);

    expect(await store.findByPublicKey(created.publicKey)).toBeNull();
    expect(store.storedKeys[0]?.revokedAt).toEqual(NOW);
  });

  it('refuses a key that does not exist or is already revoked', async () => {
    const { createProject, revokeKey } = setup();
    const created = await createProject.execute({
      name: 'Shop',
      allowedOrigins: ['https://shop.example.com'],
    });
    await revokeKey.execute(created.publicKeyId);

    await expect(revokeKey.execute(created.publicKeyId)).rejects.toBeInstanceOf(
      ProjectKeyNotFoundError,
    );
    await expect(revokeKey.execute(MISSING_ID)).rejects.toBeInstanceOf(ProjectKeyNotFoundError);
  });
});

describe('UpdateProjectUseCase', () => {
  async function withProject() {
    const context = setup();
    const { projectId } = await context.createProject.execute({
      name: 'Shop',
      allowedOrigins: ['https://shop.example.com'],
      conversionEvent: 'signup_completed',
    });
    return { ...context, projectId };
  }

  it('replaces the origins and the time zone it is given and keeps the rest', async () => {
    const { updateProject, projectId } = await withProject();

    const updated = await updateProject.execute({
      projectId,
      allowedOrigins: ['https://shop.example.com', 'http://localhost:5173'],
      timezone: 'Europe/Lisbon',
    });

    expect(updated).toMatchObject({
      allowedOrigins: ['https://shop.example.com', 'http://localhost:5173'],
      timezone: 'Europe/Lisbon',
      conversionEvent: 'signup_completed',
    });
  });

  it('sets and clears the conversion event', async () => {
    const { updateProject, projectId } = await withProject();

    expect(
      (await updateProject.execute({ projectId, conversionEvent: 'plan_selected' }))
        .conversionEvent,
    ).toBe('plan_selected');
    expect(
      (await updateProject.execute({ projectId, conversionEvent: null })).conversionEvent,
    ).toBeNull();
  });

  it('refuses an invalid change before writing anything', async () => {
    const { store, updateProject, projectId } = await withProject();

    await expect(
      updateProject.execute({ projectId, timezone: 'Mars/Olympus' }),
    ).rejects.toBeInstanceOf(InvalidProjectSettingsError);
    expect((await store.findById(projectId))?.timezone).toBe('UTC');
  });

  it('refuses a project that does not exist', async () => {
    const { updateProject } = setup();

    await expect(
      updateProject.execute({ projectId: MISSING_ID, timezone: 'UTC' }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});
