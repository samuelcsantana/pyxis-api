import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, max, sql } from 'drizzle-orm';
import type { Goal, GoalChanges, GoalDraft, GoalTarget } from '../../domain/goals/goal';
import type { GoalCreation, GoalRepository } from '../../domain/repositories/goal.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { aggregateRow, insertedRow } from '../database/inserted-row';
import { goals } from '../database/schema/goals';
import { projects } from '../database/schema/projects';

type DrizzleTransaction = Parameters<Parameters<DrizzleDatabase['transaction']>[0]>[0];

const FIRST_POSITION = 1;

const goalFields = {
  id: goals.id,
  projectId: goals.projectId,
  name: goals.name,
  kind: goals.kind,
  matches: sql<string>`coalesce(${goals.eventName}, ${goals.pathPattern})`,
  position: goals.position,
  createdAt: goals.createdAt,
};

interface GoalFields {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly kind: string;
  readonly matches: string;
  readonly position: number;
  readonly createdAt: Date;
}

export function toGoal(row: GoalFields): Goal {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    target:
      row.kind === 'page'
        ? { type: 'page', path: row.matches }
        : { type: 'event', name: row.matches },
    position: row.position,
    createdAt: row.createdAt,
  };
}

function targetColumns(target: GoalTarget) {
  return target.type === 'event'
    ? { kind: 'event', eventName: target.name, pathPattern: null }
    : { kind: 'page', eventName: null, pathPattern: target.path };
}

function goalColumns(changes: GoalChanges): Partial<typeof goals.$inferInsert> {
  return {
    ...(changes.name === undefined ? {} : { name: changes.name }),
    ...(changes.target === undefined ? {} : targetColumns(changes.target)),
  };
}

export async function mirrorFirstGoal(
  transaction: DrizzleTransaction,
  projectId: string,
): Promise<void> {
  await transaction
    .update(projects)
    .set({
      conversionEvent: sql`(SELECT ${goals.eventName} FROM ${goals}
        WHERE ${goals.projectId} = ${projectId}
        ORDER BY ${goals.position} LIMIT 1)`,
    })
    .where(eq(projects.id, projectId));
}

function nameAfterEvent(first: GoalFields, eventName: string): string {
  return first.kind === 'event' && first.name === first.matches ? eventName : first.name;
}

export async function setFirstGoalFromConversionEvent(
  transaction: DrizzleTransaction,
  projectId: string,
  eventName: string | null,
): Promise<void> {
  const [first] = await transaction
    .select(goalFields)
    .from(goals)
    .where(eq(goals.projectId, projectId))
    .orderBy(asc(goals.position))
    .limit(1)
    .for('update');
  if (eventName === null) {
    if (first !== undefined) {
      await transaction.delete(goals).where(eq(goals.id, first.id));
    }
  } else if (first === undefined) {
    await transaction.insert(goals).values({
      projectId,
      name: eventName,
      ...targetColumns({ type: 'event', name: eventName }),
      position: FIRST_POSITION,
    });
  } else {
    await transaction
      .update(goals)
      .set({
        name: nameAfterEvent(first, eventName),
        ...targetColumns({ type: 'event', name: eventName }),
      })
      .where(eq(goals.id, first.id));
  }
  await mirrorFirstGoal(transaction, projectId);
}

@Injectable()
export class DrizzleGoalRepository implements GoalRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async listByProject(projectId: string): Promise<readonly Goal[]> {
    const rows = await this.db
      .select(goalFields)
      .from(goals)
      .where(eq(goals.projectId, projectId))
      .orderBy(asc(goals.position));
    return rows.map(toGoal);
  }

  create(projectId: string, draft: GoalDraft, limit: number): Promise<GoalCreation> {
    return this.db.transaction(async (transaction) => {
      await transaction
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
        .for('update');
      const held = aggregateRow(
        await transaction
          .select({ total: count(), last: max(goals.position) })
          .from(goals)
          .where(eq(goals.projectId, projectId)),
      );
      if (held.total >= limit) {
        return { outcome: 'limit_reached' };
      }
      const row = insertedRow(
        await transaction
          .insert(goals)
          .values({
            projectId,
            name: draft.name,
            ...targetColumns(draft.target),
            position: (held.last ?? 0) + FIRST_POSITION,
          })
          .returning(goalFields),
      );
      await mirrorFirstGoal(transaction, projectId);
      return { outcome: 'created', goal: toGoal(row) };
    });
  }

  update(projectId: string, goalId: string, changes: GoalChanges): Promise<Goal | null> {
    return this.db.transaction(async (transaction) => {
      const ofProject = and(eq(goals.id, goalId), eq(goals.projectId, projectId));
      const values = goalColumns(changes);
      const [row] =
        Object.keys(values).length === 0
          ? await transaction.select(goalFields).from(goals).where(ofProject)
          : await transaction.update(goals).set(values).where(ofProject).returning(goalFields);
      if (row === undefined) {
        return null;
      }
      await mirrorFirstGoal(transaction, projectId);
      return toGoal(row);
    });
  }

  delete(projectId: string, goalId: string): Promise<boolean> {
    return this.db.transaction(async (transaction) => {
      const deleted = await transaction
        .delete(goals)
        .where(and(eq(goals.id, goalId), eq(goals.projectId, projectId)))
        .returning({ id: goals.id });
      if (deleted.length === 0) {
        return false;
      }
      await mirrorFirstGoal(transaction, projectId);
      return true;
    });
  }
}
