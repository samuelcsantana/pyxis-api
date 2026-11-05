import type { FastifyRequest } from 'fastify';
import type { AdminUser } from '../../../domain/entities/admin-user.entity';
import type { Project } from '../../../domain/entities/project.entity';
import type { Goal } from '../../../domain/goals/goal';
import type { GoalsSummaryReport } from '../../../domain/queries/goals-summary';
import type { RequestedRange } from '../../../usecases/queries/scoped-periods';
import type {
  CreateGoalCommand,
  CreateGoalUseCase,
} from '../../../usecases/goals/create-goal.usecase';
import type {
  DeleteGoalCommand,
  DeleteGoalUseCase,
} from '../../../usecases/goals/delete-goal.usecase';
import type { GetGoalsSummaryUseCase } from '../../../usecases/queries/get-goals-summary.usecase';
import type {
  UpdateGoalCommand,
  UpdateGoalUseCase,
} from '../../../usecases/goals/update-goal.usecase';
import { GoalSettingsController } from './goal-settings.controller';
import { GoalsController } from './goals.controller';
import {
  goalChangesSchema,
  goalListSchema,
  goalSchema,
  goalsSummarySchema,
  newGoalSchema,
} from './goals.schemas';

const PROJECT: Project = {
  id: '6f1d3c2a-8b4e-4f7a-9c1d-2e3f4a5b6c7d',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: 'signup_completed',
  currency: 'BRL',
  cityEnabled: false,
  visitorsEnabled: false,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};
const ADMIN: AdminUser = {
  id: '3e0b4f5a-6c7d-4e8f-9a0b-1c2d3e4f5a6b',
  email: 'ana@example.com',
  emailLanguage: 'en',
  suspendedAt: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};
const SIGNUP: Goal = {
  id: '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  projectId: PROJECT.id,
  name: 'Signed up',
  target: { type: 'event', name: 'signup_completed' },
  position: 1,
  createdAt: new Date('2026-11-04T12:00:00.000Z'),
};
const THANKS: Goal = {
  ...SIGNUP,
  id: '8b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d5e',
  name: 'Thanks page',
  target: { type: 'page', path: '/thanks/*' },
  position: 2,
};
const SIGNUP_BODY = {
  id: SIGNUP.id,
  name: 'Signed up',
  type: 'event',
  event: 'signup_completed',
  path: null,
  position: 1,
  created_at: '2026-11-04T12:00:00.000Z',
};
const THANKS_BODY = {
  ...SIGNUP_BODY,
  id: THANKS.id,
  name: 'Thanks page',
  type: 'page',
  event: null,
  path: '/thanks/*',
  position: 2,
};

function request(): FastifyRequest {
  return { project: PROJECT, goals: [SIGNUP, THANKS], admin: ADMIN } as unknown as FastifyRequest;
}

describe('GoalsController', () => {
  function readController(report: GoalsSummaryReport) {
    const asked: (readonly [Project, readonly Goal[], RequestedRange])[] = [];
    const useCase = {
      execute: (project: Project, goals: readonly Goal[], requested: RequestedRange) => {
        asked.push([project, goals, requested]);
        return Promise.resolve(report);
      },
    };
    return {
      controller: new GoalsController(useCase as unknown as GetGoalsSummaryUseCase),
      asked,
    };
  }

  it('lists the goals the guard read, in the contract shape', () => {
    const { controller } = readController({ visits: 0, goals: [] });

    const body = controller.list(request());

    expect(goalListSchema.parse(body)).toEqual({ goals: [SIGNUP_BODY, THANKS_BODY] });
  });

  it('summarizes every goal over the range and the filters, the reached goal resolved', async () => {
    const { controller, asked } = readController({
      visits: 20,
      goals: [
        { goal: SIGNUP, conversions: 6, convertingVisits: 4, conversionRate: 0.2 },
        { goal: THANKS, conversions: 0, convertingVisits: 0, conversionRate: 0 },
      ],
    });

    const body = await controller.summary(request(), {
      from: '2026-11-01',
      to: '2026-11-04',
      reached_goal: THANKS.id,
    });

    expect(goalsSummarySchema.parse(body)).toEqual({
      visits: 20,
      goals: [
        { ...SIGNUP_BODY, conversions: 6, converting_visits: 4, conversion_rate: 0.2 },
        { ...THANKS_BODY, conversions: 0, converting_visits: 0, conversion_rate: 0 },
      ],
    });
    expect(asked[0]?.[2].filters?.reachedGoal).toEqual(THANKS.target);
  });
});

describe('GoalSettingsController', () => {
  function writeController() {
    const created: CreateGoalCommand[] = [];
    const updated: UpdateGoalCommand[] = [];
    const deleted: DeleteGoalCommand[] = [];
    const createGoal = {
      execute: (command: CreateGoalCommand) => {
        created.push(command);
        return Promise.resolve({ ...SIGNUP, name: command.name, target: command.target });
      },
    };
    const updateGoal = {
      execute: (command: UpdateGoalCommand) => {
        updated.push(command);
        return Promise.resolve(THANKS);
      },
    };
    const deleteGoal = {
      execute: (command: DeleteGoalCommand) => {
        deleted.push(command);
        return Promise.resolve();
      },
    };
    return {
      controller: new GoalSettingsController(
        createGoal as unknown as CreateGoalUseCase,
        updateGoal as unknown as UpdateGoalUseCase,
        deleteGoal as unknown as DeleteGoalUseCase,
      ),
      created,
      updated,
      deleted,
    };
  }

  it.each([
    [{ name: 'Signed up', event: 'signup_completed' }, SIGNUP.target],
    [{ name: 'Thanks page', path: '/thanks/*' }, THANKS.target],
  ])('creates a goal from %j for the signed-in admin', async (input, target) => {
    const { controller, created } = writeController();

    const body = await controller.create(request(), PROJECT.id, newGoalSchema.parse(input));

    expect(goalSchema.parse(body)).toMatchObject({ name: input.name, type: target.type });
    expect(created).toEqual([
      { adminUserId: ADMIN.id, projectId: PROJECT.id, name: input.name, target },
    ]);
  });

  it.each([
    ['a rename', { name: 'Paid' }, { name: 'Paid' }],
    ['a new event', { event: 'purchase' }, { target: { type: 'event', name: 'purchase' } }],
    ['a new page', { path: '/paid' }, { target: { type: 'page', path: '/paid' } }],
  ])('passes on %s and nothing else', async (_case, input, change) => {
    const { controller, updated } = writeController();

    const body = await controller.update(
      request(),
      PROJECT.id,
      THANKS.id,
      goalChangesSchema.parse(input),
    );

    expect(goalSchema.parse(body)).toEqual(THANKS_BODY);
    expect(updated).toEqual([
      { adminUserId: ADMIN.id, projectId: PROJECT.id, goalId: THANKS.id, ...change },
    ]);
  });

  it('deletes a goal for the signed-in admin', async () => {
    const { controller, deleted } = writeController();

    await controller.remove(request(), PROJECT.id, SIGNUP.id);

    expect(deleted).toEqual([{ adminUserId: ADMIN.id, projectId: PROJECT.id, goalId: SIGNUP.id }]);
  });
});

describe('goal bodies', () => {
  it.each([
    ['no event and no path', { name: 'Signed up' }],
    ['both an event and a path', { name: 'Signed up', event: 'signup', path: '/x' }],
    ['an empty name', { name: '', event: 'signup' }],
    ['a field it does not know', { name: 'Signed up', event: 'signup', kind: 'event' }],
  ])('refuses a new goal with %s', (_case, input) => {
    expect(newGoalSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    ['nothing to change', {}],
    ['both an event and a path', { event: 'signup', path: '/x' }],
    ['a page path without its slash', { path: 'thanks' }],
  ])('refuses changes with %s', (_case, input) => {
    expect(goalChangesSchema.safeParse(input).success).toBe(false);
  });
});
