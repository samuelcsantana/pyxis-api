import { z } from 'zod';
import { EVENT_NAME_PATTERN, MAX_PATH_LENGTH } from '../../../domain/events/event-limits';
import {
  GOAL_KINDS,
  type Goal,
  type GoalDraft,
  type GoalTarget,
  MAX_GOAL_NAME_LENGTH,
  MAX_GOALS,
} from '../../../domain/goals/goal';
import type { GoalsSummaryReport } from '../../../domain/queries/goals-summary';

const goalNameSchema = z
  .string()
  .min(1)
  .max(MAX_GOAL_NAME_LENGTH)
  .describe('What the goal is called');
const goalEventSchema = z
  .string()
  .regex(EVENT_NAME_PATTERN)
  .describe('Reached when the visit sends this named event');
const goalPathSchema = z
  .string()
  .startsWith('/')
  .max(MAX_PATH_LENGTH)
  .describe('Reached when the visit views a page this path matches; a star matches any characters');

interface TargetFields {
  readonly event?: string | undefined;
  readonly path?: string | undefined;
}

function hasOneTargetAtMost(body: TargetFields): boolean {
  return body.event === undefined || body.path === undefined;
}

export const newGoalSchema = z
  .union([
    z.strictObject({ name: goalNameSchema, event: goalEventSchema }),
    z.strictObject({ name: goalNameSchema, path: goalPathSchema }),
  ])
  .transform((body): GoalDraft => ({
    name: body.name,
    target:
      'event' in body ? { type: 'event', name: body.event } : { type: 'page', path: body.path },
  }))
  .meta({
    id: 'NewGoal',
    description: `A goal to add to the project, up to ${String(MAX_GOALS)}: a name and either an event or a page path.`,
  });

export const goalChangesSchema = z
  .strictObject({
    name: goalNameSchema.optional(),
    event: goalEventSchema.optional(),
    path: goalPathSchema.optional(),
  })
  .refine(hasOneTargetAtMost, { message: 'give either event or path, not both', path: ['path'] })
  .refine((body) => Object.keys(body).length > 0, { message: 'give something to change' })
  .meta({
    id: 'GoalChanges',
    description:
      'The name, or what reaches the goal (an event or a page path, which replaces the other).',
  });

const goalShape = {
  id: z.uuid(),
  name: z.string(),
  type: z.enum(GOAL_KINDS),
  event: z.string().nullable().describe('The named event that reaches the goal; null for a page'),
  path: z.string().nullable().describe('The page path that reaches the goal; null for an event'),
  position: z
    .int()
    .describe('The order of the goal; the lowest is the default goal of the reports'),
  created_at: z.iso.datetime(),
};

export const goalSchema = z
  .strictObject(goalShape)
  .meta({ id: 'Goal', description: 'A goal of the project.' });

export const goalListSchema = z.strictObject({ goals: z.array(goalSchema) }).meta({
  id: 'GoalList',
  description:
    'The goals of the project in their order. The first is the one the reports count as ' +
    'conversions when they are not told which; it starts as the former conversion event.',
});

export const goalsSummarySchema = z
  .strictObject({
    visits: z.int(),
    goals: z.array(
      z.strictObject({
        ...goalShape,
        conversions: z.int().describe('The events or page views that reached the goal'),
        converting_visits: z.int().describe('The visits that reached the goal at least once'),
        conversion_rate: z
          .number()
          .nullable()
          .describe('converting_visits divided by visits, from 0 to 1; null without visits'),
        revenue: z
          .number()
          .nullable()
          .describe(
            'The sum of the revenue property on the events of the goal, in the project ' +
              'currency; null for a page goal',
          ),
      }),
    ),
  })
  .meta({
    id: 'GoalsSummary',
    description:
      'Each goal of the project, in order, with its conversions in the range and filters, and ' +
      'the visits of the range and filters it is measured against.',
  });

export type NewGoalBody = z.output<typeof newGoalSchema>;
export type GoalChangesBody = z.infer<typeof goalChangesSchema>;
export type GoalBody = z.infer<typeof goalSchema>;
export type GoalListBody = z.infer<typeof goalListSchema>;
export type GoalsSummaryBody = z.infer<typeof goalsSummarySchema>;

export function goalTargetOf(body: TargetFields): GoalTarget | undefined {
  if (body.event !== undefined) {
    return { type: 'event', name: body.event };
  }
  return body.path === undefined ? undefined : { type: 'page', path: body.path };
}

export function goalBody(goal: Goal): GoalBody {
  return {
    id: goal.id,
    name: goal.name,
    type: goal.target.type,
    event: goal.target.type === 'event' ? goal.target.name : null,
    path: goal.target.type === 'page' ? goal.target.path : null,
    position: goal.position,
    created_at: goal.createdAt.toISOString(),
  };
}

export function goalsSummaryBody(report: GoalsSummaryReport): GoalsSummaryBody {
  return {
    visits: report.visits,
    goals: report.goals.map((summary) => ({
      ...goalBody(summary.goal),
      conversions: summary.conversions,
      converting_visits: summary.convertingVisits,
      conversion_rate: summary.conversionRate,
      revenue: summary.revenue,
    })),
  };
}
