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
import type { FastifyRequest } from 'fastify';
import type { AccessToken } from '../../../domain/entities/access-token.entity';
import { CreateAccessTokenUseCase } from '../../../usecases/auth/create-access-token.usecase';
import { ListAccessTokensUseCase } from '../../../usecases/auth/list-access-tokens.usecase';
import { RevokeAccessTokenUseCase } from '../../../usecases/auth/revoke-access-token.usecase';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { SchemaPipe } from '../schema-pipe';
import {
  accessTokenIdSchema,
  type AccessTokensBody,
  accessTokensSchema,
  type CreateAccessTokenBody,
  createAccessTokenSchema,
  type CreatedAccessTokenBody,
  createdAccessTokenSchema,
} from './access-tokens.schemas';
import { adminOf, DashboardOriginGuard, SessionGuard } from './auth.guards';
import { SESSION_COOKIE_NAME } from './session-cookie';

function listedToken(token: AccessToken): AccessTokensBody['tokens'][number] {
  return {
    id: token.id,
    name: token.name,
    created_at: token.createdAt.toISOString(),
    last_used_at: token.lastUsedAt === null ? null : token.lastUsedAt.toISOString(),
    expires_at: token.expiresAt.toISOString(),
  };
}

@ApiTags('dashboard sign-in')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@Controller('v1/me/tokens')
export class AccessTokensController {
  constructor(
    private readonly createAccessToken: CreateAccessTokenUseCase,
    private readonly listAccessTokens: ListAccessTokensUseCase,
    private readonly revokeAccessToken: RevokeAccessTokenUseCase,
  ) {}

  @Get()
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: 'The live read-only access tokens of the signed-in admin' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: accessTokensSchema })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
  async list(@Req() request: FastifyRequest): Promise<AccessTokensBody> {
    const tokens = await this.listAccessTokens.execute(adminOf(request));
    return { tokens: tokens.map(listedToken) };
  }

  @Post()
  @UseGuards(DashboardOriginGuard, SessionGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a read-only access token for an agent or a script',
    description:
      'Only a dashboard session creates tokens, never a token. The token is answered this once; ' +
      'an admin keeps at most ten live tokens.',
  })
  @ApiResponse({ status: HttpStatus.CREATED, standardSchema: createdAccessTokenSchema })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: errorResponseSchema })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'The admin already has ten live tokens.',
    standardSchema: errorResponseSchema,
  })
  async create(
    @Body({ schema: createAccessTokenSchema, pipes: [new SchemaPipe(createAccessTokenSchema)] })
    body: CreateAccessTokenBody,
    @Req() request: FastifyRequest,
  ): Promise<CreatedAccessTokenBody> {
    const created = await this.createAccessToken.execute(adminOf(request), {
      name: body.name,
      lifetimeDays: body.expires_in_days,
    });
    return {
      id: created.token.id,
      name: created.token.name,
      created_at: created.token.createdAt.toISOString(),
      expires_at: created.token.expiresAt.toISOString(),
      token: created.secret,
    };
  }

  @Delete(':tokenId')
  @UseGuards(DashboardOriginGuard, SessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke one access token of the signed-in admin, at once' })
  @ApiParam({ name: 'tokenId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'The token no longer works.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: errorResponseSchema })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No live token of this admin has this id; the answer never says more.',
    standardSchema: errorResponseSchema,
  })
  async revoke(
    @Req() request: FastifyRequest,
    @Param('tokenId', new SchemaPipe(accessTokenIdSchema)) tokenId: string,
  ): Promise<void> {
    await this.revokeAccessToken.execute(adminOf(request), tokenId);
  }
}
