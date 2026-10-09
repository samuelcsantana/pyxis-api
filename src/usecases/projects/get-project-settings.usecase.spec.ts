import type { Project } from '../../domain/entities/project.entity';
import type { ProjectKey } from '../../domain/entities/project-key.entity';
import { InMemoryProjectRepository } from '../../test-utils/in-memory-project.repository';
import { StubProjectActivityQuery } from '../../test-utils/stub-project-activity.query';
import { GetProjectSettingsUseCase } from './get-project-settings.usecase';

const SHOP: Project = {
  id: '11111111-0000-4000-8000-000000000001',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com', 'https://www.shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: 'signup_completed',
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};
const BLOG: Project = { ...SHOP, id: '11111111-0000-4000-8000-000000000002', name: 'Blog' };
const CREATED_AT = new Date('2026-09-02T00:00:00.000Z');
const SECRET_HASH = 'a'.repeat(64);

interface KeyFields {
  readonly projectId?: string;
  readonly revokedAt?: Date;
}

function keyBase(id: string, fields: KeyFields) {
  return {
    id,
    projectId: fields.projectId ?? SHOP.id,
    createdAt: CREATED_AT,
    revokedAt: fields.revokedAt ?? null,
  };
}

function publicKey(id: string, fields: KeyFields = {}): ProjectKey {
  return { ...keyBase(id, fields), kind: 'public', publicKey: `pyxis_pk_${id}` };
}

function secretKey(id: string): ProjectKey {
  return { ...keyBase(id, {}), kind: 'secret', secretHash: SECRET_HASH };
}

function setup() {
  const store = new InMemoryProjectRepository();
  const activity = new StubProjectActivityQuery();
  return { store, activity, useCase: new GetProjectSettingsUseCase(store, activity) };
}

describe('GetProjectSettingsUseCase', () => {
  it('describes the project with its live keys, its activity and how long events are kept', async () => {
    const { store, activity, useCase } = setup();
    store.add(
      SHOP,
      publicKey('public-1'),
      secretKey('secret-1'),
      publicKey('public-old', { revokedAt: CREATED_AT }),
    );
    store.add(BLOG, publicKey('public-blog', { projectId: BLOG.id }));
    const firstEventAt = new Date('2026-10-01T12:00:00.000Z');
    const lastEventAt = new Date('2026-10-05T09:30:00.000Z');
    activity.activity.set(SHOP.id, { firstEventAt, lastEventAt });

    const settings = await useCase.execute(SHOP);

    expect(activity.asked).toEqual([[SHOP.id]]);
    expect(settings).toEqual({
      ...SHOP,
      firstEventAt,
      lastEventAt,
      publicKeys: [{ id: 'public-1', publicKey: 'pyxis_pk_public-1', createdAt: CREATED_AT }],
      secretKeys: [{ id: 'secret-1', createdAt: CREATED_AT }],
      eventRetentionMonths: 13,
    });
    expect(JSON.stringify(settings)).not.toContain(SECRET_HASH);
  });

  it('tells a project that never received an event apart, with no key left', async () => {
    const { store, useCase } = setup();
    store.add(BLOG);

    const settings = await useCase.execute(BLOG);

    expect(settings).toMatchObject({
      firstEventAt: null,
      lastEventAt: null,
      publicKeys: [],
      secretKeys: [],
    });
  });
});
