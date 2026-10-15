import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { resolveEmailLanguage } from '../../../domain/auth/email-language';
import { AddProjectPersonUseCase } from '../../../usecases/people/add-project-person.usecase';
import {
  ListProjectPeopleUseCase,
  type PersonOfProject,
} from '../../../usecases/people/list-project-people.usecase';
import { RemoveProjectPersonUseCase } from '../../../usecases/people/remove-project-person.usecase';
import { adminOf, DashboardOriginGuard, SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { ProjectAccessGuard, projectOf } from '../queries/project-access.guard';
import {
  ACCESS_TOKENS_THROTTLER,
  AUTH_THROTTLER,
  INGEST_THROTTLER,
  SUBJECTS_THROTTLER,
} from '../rate-limit/rate-limits';
import { SchemaPipe } from '../schema-pipe';
import {
  type AddedPersonBody,
  addedPersonSchema,
  type NewPersonBody,
  newPersonSchema,
  type PersonBody,
  type ProjectPeopleBody,
  projectPeopleSchema,
} from './people.schemas';
import { idSchema } from './projects.schemas';
import {
  ApiAccountSuspended,
  SUSPENDED_OR_FOREIGN_ORIGIN_DESCRIPTION,
} from '../errors/account-suspended.response';

export function personBody(person: PersonOfProject): PersonBody {
  return {
    admin_user_id: person.adminUserId,
    email: person.email,
    role: person.role,
    added_at: person.addedAt.toISOString(),
  };
}

@ApiTags('projects')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiParam({ name: 'projectId', schema: { type: 'string', format: 'uuid' } })
@ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
@ApiResponse({
  status: HttpStatus.NOT_FOUND,
  description: 'The project does not exist or the admin may not reach it; the answer is the same.',
  standardSchema: errorResponseSchema,
})
@Controller('v1/projects/:projectId/people')
@SkipThrottle({
  [INGEST_THROTTLER]: true,
  [AUTH_THROTTLER]: true,
  [SUBJECTS_THROTTLER]: true,
  [ACCESS_TOKENS_THROTTLER]: true,
})
export class PeopleController {
  constructor(
    private readonly listPeople: ListProjectPeopleUseCase,
    private readonly addPerson: AddProjectPersonUseCase,
    private readonly removePerson: RemoveProjectPersonUseCase,
  ) {}

  @Get()
  @UseGuards(SessionGuard, ProjectAccessGuard)
  @ApiOperation({ summary: 'The people who read the project, for anyone who reads it' })
  @ApiAccountSuspended()
  @ApiResponse({ status: HttpStatus.OK, standardSchema: projectPeopleSchema })
  async people(@Req() request: FastifyRequest): Promise<ProjectPeopleBody> {
    const people = await this.listPeople.execute(projectOf(request).id);
    return { people: people.map(personBody) };
  }

  @Post()
  @UseGuards(DashboardOriginGuard, SessionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add someone to a project the admin owns, and e-mail them an invitation',
    description:
      'Up to the plan’s three people in the account, the owner included; the account needs a ' +
      'running subscription.',
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: addedPersonSchema })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
  @ApiAccountSuspended(SUSPENDED_OR_FOREIGN_ORIGIN_DESCRIPTION)
  @ApiResponse({ status: HttpStatus.CONFLICT, standardSchema: errorResponseSchema })
  async add(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
    @Body({ schema: newPersonSchema, pipes: [new SchemaPipe(newPersonSchema)] })
    body: NewPersonBody,
  ): Promise<AddedPersonBody> {
    const admin = adminOf(request);
    const added = await this.addPerson.execute({
      adminUserId: admin.id,
      inviterEmail: admin.email,
      projectId,
      email: body.email,
      language: resolveEmailLanguage(body.locale),
    });
    return { person: personBody(added.person), added: added.added };
  }

  @Delete(':adminUserId')
  @UseGuards(DashboardOriginGuard, SessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Take someone off a project the admin owns',
    description: 'The owner of the account always keeps their access (409).',
  })
  @ApiParam({ name: 'adminUserId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Removed.' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.CONFLICT, standardSchema: errorResponseSchema })
  async remove(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
    @Param('adminUserId', new SchemaPipe(idSchema)) personId: string,
  ): Promise<void> {
    await this.removePerson.execute({ adminUserId: adminOf(request).id, projectId, personId });
  }
}
