import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type postgres from 'postgres';
import { PUBLIC_KEY_PREFIX } from '../../src/domain/keys/project-keys';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleGoalRepository } from '../../src/infra/repositories/drizzle-goal.repository';
import { DrizzleProjectSettingsRepository } from '../../src/infra/repositories/drizzle-project-settings.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const MISSING_ID = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
const SIGNUP = { type: 'event', name: 'signup_completed' } as const;
const PURCHASE = { type: 'event', name: 'purchase' } as const;
const THANKS = { type: 'page', path: '/thanks/*' } as const;
const SHOP = {
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: null,
};
const STATEMENT_BREAKPOINT = '--> statement-breakpoint';
const GOALS_MIGRATION = join(__dirname, '..', '..', 'drizzle', '0043_project-goals.sql');

function publicKey(letter: string): string {
  return `${PUBLIC_KEY_PREFIX}${letter.repeat(32)}`;
}

function copyOfTheConversionEvents(): string {
  const statements = readFileSync(GOALS_MIGRATION, 'utf8').split(STATEMENT_BREAKPOINT);
  const copy = statements.at(-1);
  if (copy === undefined) {
    throw new Error('The goals migration has no statement.');
  }
  return copy;
}

describe('goals against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let goals: DrizzleGoalRepository;
  let settings: DrizzleProjectSettingsRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    goals = new DrizzleGoalRepository(db);
    settings = new DrizzleProjectSettingsRepository(db);
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  async function newProject(letter = 'A', conversionEvent: string | null = null) {
    const { project } = await settings.createWithPublicKey(
      { ...SHOP, name: `Shop ${letter}`, conversionEvent },
      publicKey(letter),
    );
    return project.id;
  }

  async function mirroredEvent(projectId: string): Promise<string | null> {
    const [row] = await owner<{ conversion_event: string | null }[]>`
      SELECT conversion_event FROM projects WHERE id = ${projectId}`;
    return row?.conversion_event ?? null;
  }

  describe('the goal repository', () => {
    it('adds goals after the last one and mirrors the first into the old column', async () => {
      const projectId = await newProject();

      const first = await goals.create(projectId, { name: 'Signed up', target: SIGNUP }, 10);
      const second = await goals.create(projectId, { name: 'Thanks', target: THANKS }, 10);

      expect(first).toEqual({
        outcome: 'created',
        goal: {
          id: expect.any(String) as string,
          projectId,
          name: 'Signed up',
          target: SIGNUP,
          position: 1,
          createdAt: expect.any(Date) as Date,
        },
      });
      expect(second).toMatchObject({ goal: { target: THANKS, position: 2 } });
      expect(await mirroredEvent(projectId)).toBe('signup_completed');
    });

    it('mirrors nothing when the first goal is a page', async () => {
      const projectId = await newProject();

      await goals.create(projectId, { name: 'Thanks', target: THANKS }, 10);

      expect(await mirroredEvent(projectId)).toBeNull();
    });

    it('stops at the limit', async () => {
      const projectId = await newProject();
      await goals.create(projectId, { name: 'Signed up', target: SIGNUP }, 1);

      expect(await goals.create(projectId, { name: 'Thanks', target: THANKS }, 1)).toEqual({
        outcome: 'limit_reached',
      });
      expect(await goals.listByProject(projectId)).toHaveLength(1);
    });

    it('lists the goals of one project in their order', async () => {
      const shop = await newProject('A');
      const blog = await newProject('B');
      await goals.create(shop, { name: 'Signed up', target: SIGNUP }, 10);
      await goals.create(blog, { name: 'Blog goal', target: PURCHASE }, 10);
      await goals.create(shop, { name: 'Thanks', target: THANKS }, 10);

      expect((await goals.listByProject(shop)).map(({ name }) => name)).toEqual([
        'Signed up',
        'Thanks',
      ]);
    });

    it('renames a goal, changes its target and mirrors the change', async () => {
      const projectId = await newProject();
      const created = await goals.create(projectId, { name: 'Signed up', target: SIGNUP }, 10);
      const goalId = created.outcome === 'created' ? created.goal.id : MISSING_ID;

      expect(await goals.update(projectId, goalId, { name: 'Joined' })).toMatchObject({
        name: 'Joined',
        target: SIGNUP,
      });
      expect(await goals.update(projectId, goalId, { target: THANKS })).toMatchObject({
        name: 'Joined',
        target: THANKS,
      });
      expect(await mirroredEvent(projectId)).toBeNull();
      expect(await goals.update(projectId, goalId, { target: PURCHASE })).toMatchObject({
        target: PURCHASE,
      });
      expect(await mirroredEvent(projectId)).toBe('purchase');
      expect(await goals.update(projectId, goalId, {})).toMatchObject({ name: 'Joined' });
    });

    it('answers null for a goal it does not have, or one of another project', async () => {
      const shop = await newProject('A');
      const blog = await newProject('B');
      const created = await goals.create(blog, { name: 'Blog goal', target: PURCHASE }, 10);
      const blogGoalId = created.outcome === 'created' ? created.goal.id : MISSING_ID;

      expect(await goals.update(shop, MISSING_ID, { name: 'X' })).toBeNull();
      expect(await goals.update(shop, blogGoalId, {})).toBeNull();
      expect(await goals.delete(shop, blogGoalId)).toBe(false);
      expect(await goals.listByProject(blog)).toHaveLength(1);
    });

    it('deletes a goal and mirrors the next one', async () => {
      const projectId = await newProject();
      const created = await goals.create(projectId, { name: 'Signed up', target: SIGNUP }, 10);
      await goals.create(projectId, { name: 'Bought', target: PURCHASE }, 10);
      const firstId = created.outcome === 'created' ? created.goal.id : MISSING_ID;

      expect(await goals.delete(projectId, firstId)).toBe(true);
      expect((await goals.listByProject(projectId)).map(({ name }) => name)).toEqual(['Bought']);
      expect(await mirroredEvent(projectId)).toBe('purchase');
    });

    it('goes away with its project', async () => {
      const projectId = await newProject();
      await goals.create(projectId, { name: 'Signed up', target: SIGNUP }, 10);

      await settings.deleteWithEverything(projectId);

      expect(await owner`SELECT id FROM goals`).toHaveLength(0);
    });

    it('refuses a row whose kind does not match its target', async () => {
      const projectId = await newProject();

      await expect(owner`
        INSERT INTO goals (project_id, name, kind, path_pattern, position)
        VALUES (${projectId}, 'Broken', 'event', '/x', 1)`).rejects.toThrow(/goals_target_check/);
    });
  });

  describe('the former conversion event, through the project settings', () => {
    it('becomes goal 1 when a project is created with it, and no goal without it', async () => {
      const withEvent = await newProject('A', 'signup_completed');
      const without = await newProject('B', null);

      expect(await goals.listByProject(withEvent)).toMatchObject([
        { name: 'signup_completed', target: SIGNUP, position: 1 },
      ]);
      expect(await goals.listByProject(without)).toEqual([]);
    });

    it('becomes goal 1 for a project created in an account too', async () => {
      const [account] = await owner<{ id: string }[]>`
        INSERT INTO admin_users (email) VALUES ('ana@example.com') RETURNING id`;
      const [created] = await owner<{ id: string }[]>`
        INSERT INTO accounts (owner_admin_id, status) VALUES (${account?.id ?? ''}, 'active')
        RETURNING id`;
      const outcome = await settings.createWithPublicKeyInAccount(
        { ...SHOP, conversionEvent: 'purchase' },
        publicKey('C'),
        { accountId: created?.id ?? '', maxProjects: 1 },
      );
      const projectId = outcome.outcome === 'created' ? outcome.created.project.id : MISSING_ID;

      expect(await goals.listByProject(projectId)).toMatchObject([{ target: PURCHASE }]);
    });

    it('changes goal 1 and renames it while it carries the name of its event', async () => {
      const projectId = await newProject('A', 'signup_completed');

      const project = await settings.update(projectId, { conversionEvent: 'purchase' });

      expect(project?.conversionEvent).toBe('purchase');
      expect(await goals.listByProject(projectId)).toMatchObject([
        { name: 'purchase', target: PURCHASE, position: 1 },
      ]);
    });

    it('keeps a name the owner gave goal 1, and turns a page goal into the event', async () => {
      const named = await newProject('A', 'signup_completed');
      const [first] = await goals.listByProject(named);
      await goals.update(named, first?.id ?? MISSING_ID, { name: 'Joined' });
      const page = await newProject('B');
      await goals.create(page, { name: 'thanks', target: THANKS }, 10);

      await settings.update(named, { conversionEvent: 'purchase' });
      await settings.update(page, { conversionEvent: 'thanks' });

      expect(await goals.listByProject(named)).toMatchObject([
        { name: 'Joined', target: PURCHASE },
      ]);
      expect(await goals.listByProject(page)).toMatchObject([
        { name: 'thanks', target: { type: 'event', name: 'thanks' } },
      ]);
    });

    it('creates goal 1 when there was none, and clearing it deletes goal 1 only', async () => {
      const projectId = await newProject();

      await settings.update(projectId, { conversionEvent: 'signup_completed', name: 'Store' });
      await goals.create(projectId, { name: 'Bought', target: PURCHASE }, 10);
      const cleared = await settings.update(projectId, { conversionEvent: null });

      expect(cleared).toMatchObject({ name: 'Store', conversionEvent: 'purchase' });
      expect((await goals.listByProject(projectId)).map(({ name }) => name)).toEqual(['Bought']);
    });

    it('clears nothing on a project without goals', async () => {
      const projectId = await newProject();

      expect(await settings.update(projectId, { conversionEvent: null })).toMatchObject({
        conversionEvent: null,
      });
    });

    it('answers null for an unknown project', async () => {
      expect(await settings.update(MISSING_ID, { conversionEvent: 'purchase' })).toBeNull();
    });
  });

  describe('the migration that created the goals', () => {
    it('copies each conversion event to goal 1 once, and leaves the rest alone', async () => {
      const withEvent = await newProject('A');
      const without = await newProject('B');
      const alreadyHasGoals = await newProject('C');
      await goals.create(alreadyHasGoals, { name: 'Thanks', target: THANKS }, 10);
      await owner`UPDATE projects SET conversion_event = 'signup_completed'
        WHERE id IN (${withEvent}, ${alreadyHasGoals})`;

      await owner.unsafe(copyOfTheConversionEvents());
      await owner.unsafe(copyOfTheConversionEvents());

      expect(await goals.listByProject(withEvent)).toMatchObject([
        { name: 'signup_completed', target: SIGNUP, position: 1 },
      ]);
      expect(await goals.listByProject(without)).toEqual([]);
      expect(await goals.listByProject(alreadyHasGoals)).toMatchObject([
        { name: 'Thanks', target: THANKS },
      ]);
    });
  });
});
