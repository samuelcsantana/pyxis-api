import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { CreateGoalUseCase } from '../../../usecases/goals/create-goal.usecase';
import { DeleteGoalUseCase } from '../../../usecases/goals/delete-goal.usecase';
import { UpdateGoalUseCase } from '../../../usecases/goals/update-goal.usecase';
import { adminOf, DashboardOriginGuard, SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import {
  ApiAccountSuspended,
  SUSPENDED_OR_FOREIGN_ORIGIN_DESCRIPTION,
} from '../errors/account-suspended.response';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { idSchema } from '../projects/projects.schemas';
import { skipThrottlersExcept } from '../rate-limit/rate-limits';
import { SchemaPipe } from '../schema-pipe';
import {
  type GoalBody,
  goalBody,
  type GoalChangesBody,
  goalChangesSchema,
  goalSchema,
  goalTargetOf,
  type NewGoalBody,
  newGoalSchema,
} from './goals.schemas';

@ApiTags('goals')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
@ApiResponse({
  status: HttpStatus.NOT_FOUND,
  description:
    'The project is not one the admin owns, or the goal is not one of its goals; the answer is ' +
    'the same.',
  standardSchema: errorResponseSchema,
})
@ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
@ApiAccountSuspended(SUSPENDED_OR_FOREIGN_ORIGIN_DESCRIPTION)
@ApiParam({ name: 'projectId', schema: { type: 'string', format: 'uuid' } })
@Controller('v1/projects/:projectId/goals')
@SkipThrottle(skipThrottlersExcept())
@UseGuards(DashboardOriginGuard, SessionGuard)
export class GoalSettingsController {
  constructor(
    private readonly createGoal: CreateGoalUseCase,
    private readonly updateGoal: UpdateGoalUseCase,
    private readonly deleteGoal: DeleteGoalUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a goal to a project the admin owns',
    description: 'At most ten goals; the new one goes last.',
  })
  @ApiResponse({ status: HttpStatus.CREATED, standardSchema: goalSchema })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'The project already has ten goals (goal_limit_reached), or the account has no running ' +
      'subscription.',
    standardSchema: errorResponseSchema,
  })
  async create(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
    @Body({ schema: newGoalSchema, pipes: [new SchemaPipe(newGoalSchema)] }) body: NewGoalBody,
  ): Promise<GoalBody> {
    return goalBody(
      await this.createGoal.execute({ adminUserId: adminOf(request).id, projectId, ...body }),
    );
  }

  @Patch(':goalId')
  @ApiOperation({ summary: 'Rename a goal, or change what reaches it' })
  @ApiParam({ name: 'goalId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: goalSchema })
  async update(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
    @Param('goalId', new SchemaPipe(idSchema)) goalId: string,
    @Body({ schema: goalChangesSchema, pipes: [new SchemaPipe(goalChangesSchema)] })
    body: GoalChangesBody,
  ): Promise<GoalBody> {
    const target = goalTargetOf(body);
    return goalBody(
      await this.updateGoal.execute({
        adminUserId: adminOf(request).id,
        projectId,
        goalId,
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(target === undefined ? {} : { target }),
      }),
    );
  }

  @Delete(':goalId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a goal',
    description: 'Its events stay; the next goal in order becomes the default of the reports.',
  })
  @ApiParam({ name: 'goalId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Deleted.' })
  async remove(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
    @Param('goalId', new SchemaPipe(idSchema)) goalId: string,
  ): Promise<void> {
    await this.deleteGoal.execute({ adminUserId: adminOf(request).id, projectId, goalId });
  }
}
