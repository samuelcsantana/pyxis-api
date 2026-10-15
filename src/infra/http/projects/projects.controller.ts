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
import type { Project } from '../../../domain/entities/project.entity';
import { CreateOwnedProjectKeyUseCase } from '../../../usecases/projects/create-owned-project-key.usecase';
import { CreateOwnedProjectUseCase } from '../../../usecases/projects/create-owned-project.usecase';
import { DeleteOwnedProjectUseCase } from '../../../usecases/projects/delete-owned-project.usecase';
import { RevokeOwnedProjectKeyUseCase } from '../../../usecases/projects/revoke-owned-project-key.usecase';
import { UpdateOwnedProjectUseCase } from '../../../usecases/projects/update-owned-project.usecase';
import { adminOf, DashboardOriginGuard, SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import {
  ACCESS_TOKENS_THROTTLER,
  AUTH_THROTTLER,
  INGEST_THROTTLER,
  SUBJECTS_THROTTLER,
} from '../rate-limit/rate-limits';
import { SchemaPipe } from '../schema-pipe';
import {
  type CreatedKeyBody,
  createdKeySchema,
  type CreatedProjectBody,
  createdProjectSchema,
  type DeletedProjectBody,
  deletedProjectSchema,
  idSchema,
  type ManagedProjectBody,
  managedProjectSchema,
  type NewKeyBody,
  newKeySchema,
  type NewProjectBody,
  newProjectSchema,
  type ProjectChangesBody,
  projectChangesSchema,
  type ProjectDeletionBody,
  projectDeletionSchema,
} from './projects.schemas';
import {
  ApiAccountSuspended,
  SUSPENDED_OR_FOREIGN_ORIGIN_DESCRIPTION,
} from '../errors/account-suspended.response';

export function managedProjectBody(project: Project): ManagedProjectBody {
  return {
    id: project.id,
    name: project.name,
    allowed_origins: [...project.allowedOrigins],
    timezone: project.timezone,
    conversion_event: project.conversionEvent,
    created_at: project.createdAt.toISOString(),
  };
}

@ApiTags('projects')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
@ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: errorResponseSchema })
@ApiResponse({
  status: HttpStatus.NOT_FOUND,
  description: 'Nothing with this id belongs to an account the admin owns; the answer is the same.',
  standardSchema: errorResponseSchema,
})
@ApiResponse({
  status: HttpStatus.CONFLICT,
  description: 'The account has no running subscription, or the change breaks a limit.',
  standardSchema: errorResponseSchema,
})
@Controller('v1')
@SkipThrottle({
  [INGEST_THROTTLER]: true,
  [AUTH_THROTTLER]: true,
  [SUBJECTS_THROTTLER]: true,
  [ACCESS_TOKENS_THROTTLER]: true,
})
@UseGuards(DashboardOriginGuard, SessionGuard)
export class ProjectsController {
  constructor(
    private readonly createOwnedProject: CreateOwnedProjectUseCase,
    private readonly updateOwnedProject: UpdateOwnedProjectUseCase,
    private readonly deleteOwnedProject: DeleteOwnedProjectUseCase,
    private readonly createOwnedKey: CreateOwnedProjectKeyUseCase,
    private readonly revokeOwnedKey: RevokeOwnedProjectKeyUseCase,
  ) {}

  @Post('accounts/:accountId/projects')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a project in an account the admin owns',
    description: 'Up to the plan’s three projects; the account needs a running subscription.',
  })
  @ApiParam({ name: 'accountId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.CREATED, standardSchema: createdProjectSchema })
  @ApiAccountSuspended(SUSPENDED_OR_FOREIGN_ORIGIN_DESCRIPTION)
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
  async create(
    @Req() request: FastifyRequest,
    @Param('accountId', new SchemaPipe(idSchema)) accountId: string,
    @Body({ schema: newProjectSchema, pipes: [new SchemaPipe(newProjectSchema)] })
    body: NewProjectBody,
  ): Promise<CreatedProjectBody> {
    const created = await this.createOwnedProject.execute({
      adminUserId: adminOf(request).id,
      accountId,
      name: body.name,
      allowedOrigins: body.allowed_origins,
      ...(body.timezone === undefined ? {} : { timezone: body.timezone }),
      ...(body.conversion_event === undefined ? {} : { conversionEvent: body.conversion_event }),
    });
    return {
      project_id: created.projectId,
      public_key: { id: created.publicKeyId, key: created.publicKey },
    };
  }

  @Patch('projects/:projectId')
  @ApiOperation({ summary: 'Change the settings of a project the admin owns' })
  @ApiParam({ name: 'projectId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: managedProjectSchema })
  @ApiAccountSuspended(SUSPENDED_OR_FOREIGN_ORIGIN_DESCRIPTION)
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
  async update(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
    @Body({ schema: projectChangesSchema, pipes: [new SchemaPipe(projectChangesSchema)] })
    body: ProjectChangesBody,
  ): Promise<ManagedProjectBody> {
    const project = await this.updateOwnedProject.execute({
      adminUserId: adminOf(request).id,
      projectId,
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.allowed_origins === undefined ? {} : { allowedOrigins: body.allowed_origins }),
      ...(body.timezone === undefined ? {} : { timezone: body.timezone }),
      ...(body.conversion_event === undefined ? {} : { conversionEvent: body.conversion_event }),
    });
    return managedProjectBody(project);
  }

  @Post('projects/:projectId/delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a project the admin owns, with its events and keys',
    description: 'The name typed again must match; allowed whatever the subscription.',
  })
  @ApiParam({ name: 'projectId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: deletedProjectSchema })
  async remove(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
    @Body({ schema: projectDeletionSchema, pipes: [new SchemaPipe(projectDeletionSchema)] })
    body: ProjectDeletionBody,
  ): Promise<DeletedProjectBody> {
    const deleted = await this.deleteOwnedProject.execute({
      adminUserId: adminOf(request).id,
      projectId,
      confirmName: body.confirm_name,
    });
    return {
      project_id: deleted.project.id,
      deleted_events: deleted.deletedEvents,
      deleted_keys: deleted.deletedKeys,
    };
  }

  @Post('projects/:projectId/keys')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a public or secret key for a project the admin owns',
    description: 'At most five live keys of each kind; a secret key is shown only here.',
  })
  @ApiParam({ name: 'projectId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.CREATED, standardSchema: createdKeySchema })
  @ApiAccountSuspended(SUSPENDED_OR_FOREIGN_ORIGIN_DESCRIPTION)
  async createKey(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
    @Body({ schema: newKeySchema, pipes: [new SchemaPipe(newKeySchema)] })
    body: NewKeyBody,
  ): Promise<CreatedKeyBody> {
    const created = await this.createOwnedKey.execute({
      adminUserId: adminOf(request).id,
      projectId,
      kind: body.kind,
    });
    return { id: created.keyId, kind: created.kind, key: created.key };
  }

  @Delete('projects/:projectId/keys/:keyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke a key of a project the admin owns',
    description: 'The last live public key is kept (409), so the site keeps sending events.',
  })
  @ApiParam({ name: 'projectId', schema: { type: 'string', format: 'uuid' } })
  @ApiParam({ name: 'keyId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Revoked.' })
  async revokeKey(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
    @Param('keyId', new SchemaPipe(idSchema)) keyId: string,
  ): Promise<void> {
    await this.revokeOwnedKey.execute({ adminUserId: adminOf(request).id, projectId, keyId });
  }
}
