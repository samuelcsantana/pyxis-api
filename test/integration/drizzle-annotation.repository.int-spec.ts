import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAnnotationRepository } from '../../src/infra/repositories/drizzle-annotation.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'a3f1c2d4-5b6e-4f70-8192-a3b4c5d6e7f8';
const BLOG_ID = 'b4e2d3c5-6c7f-4081-9203-b4c5d6e7f809';
const MISSING_ID = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
const WRITTEN_AT = new Date('2026-11-05T12:00:00.000Z');
const LATER = new Date('2026-11-05T13:00:00.000Z');

describe('annotations against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let annotations: DrizzleAnnotationRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    annotations = new DrizzleAnnotationRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`INSERT INTO projects (id, name) VALUES (${SHOP_ID}, 'Shop'), (${BLOG_ID}, 'Blog')`;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  async function written(projectId: string, day: string, text: string, at = WRITTEN_AT) {
    const created = await annotations.create(projectId, { day, text }, at, 10);
    if (created.outcome !== 'created') {
      throw new Error('The annotation was not created.');
    }
    return created.annotation;
  }

  it('stores a note with its day and times, and answers it', async () => {
    const annotation = await written(SHOP_ID, '2026-11-04', 'Launched 🚀 the new pricing');

    expect(annotation).toEqual({
      id: expect.any(String) as string,
      projectId: SHOP_ID,
      day: '2026-11-04',
      text: 'Launched 🚀 the new pricing',
      createdAt: WRITTEN_AT,
      updatedAt: WRITTEN_AT,
    });
  });

  it('holds 140 characters, even when each takes two code units', async () => {
    const annotation = await written(SHOP_ID, '2026-11-04', '🚀'.repeat(140));

    expect(Array.from(annotation.text)).toHaveLength(140);
  });

  it('lists the notes of a range of one project, by day then in writing order', async () => {
    await written(SHOP_ID, '2026-11-04', 'Second', LATER);
    await written(SHOP_ID, '2026-11-04', 'First');
    await written(SHOP_ID, '2026-11-01', 'On the first day');
    await written(SHOP_ID, '2026-10-31', 'Before the range');
    await written(SHOP_ID, '2026-11-05', 'After the range');
    await written(BLOG_ID, '2026-11-02', 'Another project');

    const listed = await annotations.listInRange(SHOP_ID, { from: '2026-11-01', to: '2026-11-04' });

    expect(listed.map(({ text }) => text)).toEqual(['On the first day', 'First', 'Second']);
  });

  it('stops at the limit of each project, counting only its own notes', async () => {
    await annotations.create(SHOP_ID, { day: '2026-11-04', text: 'One' }, WRITTEN_AT, 1);

    await expect(
      annotations.create(SHOP_ID, { day: '2026-11-04', text: 'Two' }, WRITTEN_AT, 1),
    ).resolves.toEqual({ outcome: 'limit_reached' });
    await expect(
      annotations.create(BLOG_ID, { day: '2026-11-04', text: 'Two' }, WRITTEN_AT, 1),
    ).resolves.toMatchObject({ outcome: 'created' });
  });

  it('changes a note of its project only, and stamps the change', async () => {
    const annotation = await written(SHOP_ID, '2026-11-04', 'Launch');

    await expect(
      annotations.update(BLOG_ID, annotation.id, { text: 'Hijacked' }, LATER),
    ).resolves.toBeNull();
    await expect(
      annotations.update(SHOP_ID, annotation.id, { day: '2026-11-03' }, LATER),
    ).resolves.toEqual({ ...annotation, day: '2026-11-03', updatedAt: LATER });
  });

  it('deletes a note of its project only', async () => {
    const annotation = await written(SHOP_ID, '2026-11-04', 'Launch');

    await expect(annotations.delete(BLOG_ID, annotation.id)).resolves.toBe(false);
    await expect(annotations.delete(SHOP_ID, MISSING_ID)).resolves.toBe(false);
    await expect(annotations.delete(SHOP_ID, annotation.id)).resolves.toBe(true);
    await expect(
      annotations.listInRange(SHOP_ID, { from: '2026-11-04', to: '2026-11-04' }),
    ).resolves.toEqual([]);
  });

  it('goes with its project', async () => {
    await written(SHOP_ID, '2026-11-04', 'Launch');

    await owner`DELETE FROM projects WHERE id = ${SHOP_ID}`;

    expect(await owner`SELECT 1 FROM annotations`).toHaveLength(0);
  });
});
