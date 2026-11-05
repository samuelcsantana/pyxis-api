import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { CreateShareLinkUseCase } from '../../../usecases/share-links/create-share-link.usecase';
import { ListShareLinksUseCase } from '../../../usecases/share-links/list-share-links.usecase';
import { RevokeShareLinkUseCase } from '../../../usecases/share-links/revoke-share-link.usecase';
import { SetShareLinkPasswordUseCase } from '../../../usecases/share-links/set-share-link-password.usecase';
import { adminOf, DashboardOriginGuard, SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { idSchema } from '../projects/projects.schemas';
import { SchemaPipe } from '../schema-pipe';
import {
  type CreatedShareLinkBody,
  createdShareLinkSchema,
  type CreateShareLinkBody,
  createShareLinkSchema,
  type ShareLinkBody,
  shareLinkBody,
  type ShareLinkPasswordBody,
  shareLinkPasswordSchema,
  shareLinkSchema,
  type ShareLinksBody,
  shareLinksSchema,
} from './share-links.schemas';

@ApiTags('share links')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
@ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
@ApiResponse({
  status: HttpStatus.NOT_FOUND,
  description:
    'The project is not one the admin owns (project_not_found), or the link is not one of its ' +
    'links (share_link_not_found).',
  standardSchema: errorResponseSchema,
})
@ApiParam({ name: 'projectId', schema: { type: 'string', format: 'uuid' } })
@Controller('v1/projects/:projectId/share-links')
export class ShareLinksController {
  constructor(
    private readonly createShareLink: CreateShareLinkUseCase,
    private readonly listShareLinks: ListShareLinksUseCase,
    private readonly revokeShareLink: RevokeShareLinkUseCase,
    private readonly setShareLinkPassword: SetShareLinkPasswordUseCase,
  ) {}

  @Get()
  @UseGuards(SessionGuard)
  @ApiOperation({
    summary: 'The share links of a project the admin owns',
    description: 'Listed on any plan, so an account that left Pro can still revoke them.',
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: shareLinksSchema })
  async list(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
  ): Promise<ShareLinksBody> {
    const links = await this.listShareLinks.execute({
      adminUserId: adminOf(request).id,
      projectId,
    });
    return { links: links.map(shareLinkBody) };
  }

  @Post()
  @UseGuards(DashboardOriginGuard, SessionGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a public read-only link to the aggregate reports of the project',
    description:
      'Pro only. The token is answered this once; a project keeps at most ten links. The link ' +
      'opens the overview, acquisition, devices, features and funnel figures, never a visit or ' +
      'a person.',
  })
  @ApiResponse({ status: HttpStatus.CREATED, standardSchema: createdShareLinkSchema })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'The request did not come from the dashboard, the account is suspended ' +
      '(account_suspended), or its plan does not include share links (plan_required).',
    standardSchema: errorResponseSchema,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'The project already has ten links (share_link_limit_reached), or the account has no ' +
      'running subscription (subscription_required).',
    standardSchema: errorResponseSchema,
  })
  async create(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
    @Body({ schema: createShareLinkSchema, pipes: [new SchemaPipe(createShareLinkSchema)] })
    body: CreateShareLinkBody,
  ): Promise<CreatedShareLinkBody> {
    const created = await this.createShareLink.execute({
      adminUserId: adminOf(request).id,
      projectId,
      name: body.name,
      expiresAt: body.expires_at === null ? null : new Date(body.expires_at),
      password: body.password,
    });
    return { ...shareLinkBody(created.link), token: created.token };
  }

  @Patch(':linkId')
  @UseGuards(DashboardOriginGuard, SessionGuard)
  @ApiOperation({
    summary: 'Set, change or remove the password of a share link',
    description:
      'Pro only, like creating a link. The password is stored only as a scrypt hash, and every ' +
      'unlock of the link stops working at once.',
  })
  @ApiParam({ name: 'linkId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: shareLinkSchema })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'The request did not come from the dashboard, the account is suspended ' +
      '(account_suspended), or its plan does not include share links (plan_required).',
    standardSchema: errorResponseSchema,
  })
  async changePassword(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
    @Param('linkId', new SchemaPipe(idSchema)) linkId: string,
    @Body({ schema: shareLinkPasswordSchema, pipes: [new SchemaPipe(shareLinkPasswordSchema)] })
    body: ShareLinkPasswordBody,
  ): Promise<ShareLinkBody> {
    return shareLinkBody(
      await this.setShareLinkPassword.execute({
        adminUserId: adminOf(request).id,
        projectId,
        linkId,
        password: body.password,
      }),
    );
  }

  @Delete(':linkId')
  @UseGuards(DashboardOriginGuard, SessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke a share link, at once',
    description: 'Revoked on any plan; the token never opens again.',
  })
  @ApiParam({ name: 'linkId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'The link no longer opens.' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'The request did not come from the dashboard.',
    standardSchema: errorResponseSchema,
  })
  async revoke(
    @Req() request: FastifyRequest,
    @Param('projectId', new SchemaPipe(idSchema)) projectId: string,
    @Param('linkId', new SchemaPipe(idSchema)) linkId: string,
  ): Promise<void> {
    await this.revokeShareLink.execute({ adminUserId: adminOf(request).id, projectId, linkId });
  }
}
