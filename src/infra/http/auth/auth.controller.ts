import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { EnvConfig } from '../../../config/env.schema';
import { DescribeAdminUseCase } from '../../../usecases/auth/describe-admin.usecase';
import { RequestSignInCodeUseCase } from '../../../usecases/auth/request-sign-in-code.usecase';
import { SignOutUseCase } from '../../../usecases/auth/sign-out.usecase';
import { VerifySignInCodeUseCase } from '../../../usecases/auth/verify-sign-in-code.usecase';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { ClientAddressThrottlerGuard } from '../rate-limit/client-address-throttler.guard';
import { INGEST_THROTTLER, SUBJECTS_THROTTLER } from '../rate-limit/rate-limits';
import { singleHeader } from '../request-headers';
import { SchemaPipe } from '../schema-pipe';
import { adminOf, DashboardOriginGuard, SessionGuard } from './auth.guards';
import {
  type MeBody,
  meSchema,
  type RequestCodeBody,
  requestCodeSchema,
  type SignedInBody,
  signedInSchema,
  type VerifyCodeBody,
  verifyCodeSchema,
} from './auth.schemas';
import {
  clearedSessionCookie,
  readSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookie,
} from './session-cookie';

@ApiTags('dashboard sign-in')
@Controller('v1/auth')
@SkipThrottle({ [INGEST_THROTTLER]: true, [SUBJECTS_THROTTLER]: true })
export class AuthController {
  constructor(
    private readonly requestSignInCode: RequestSignInCodeUseCase,
    private readonly verifySignInCode: VerifySignInCodeUseCase,
    private readonly signOut: SignOutUseCase,
    @Inject(ConfigService) private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  @Post('request-code')
  @UseGuards(DashboardOriginGuard, ClientAddressThrottlerGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Email a sign-in code',
    description:
      'Always answers 202: a code is created and emailed only when the email belongs to an admin.',
  })
  @ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Accepted, whoever the email is.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, standardSchema: errorResponseSchema })
  async requestCode(
    @Body({ schema: requestCodeSchema, pipes: [new SchemaPipe(requestCodeSchema)] })
    body: RequestCodeBody,
  ): Promise<void> {
    await this.requestSignInCode.execute(body.email);
  }

  @Post('verify-code')
  @UseGuards(DashboardOriginGuard, ClientAddressThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a sign-in code for a session cookie' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Signed in; the session cookie is set.',
    standardSchema: signedInSchema,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, standardSchema: errorResponseSchema })
  async verifyCode(
    @Body({ schema: verifyCodeSchema, pipes: [new SchemaPipe(verifyCodeSchema)] })
    body: VerifyCodeBody,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<SignedInBody> {
    const signedIn = await this.verifySignInCode.execute(body.email, body.code);
    void reply.header('set-cookie', sessionCookie(signedIn.sessionToken, this.cookieDomain()));
    return { email: signedIn.email };
  }

  @Post('logout')
  @UseGuards(DashboardOriginGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the session and clear its cookie' })
  @ApiCookieAuth(SESSION_COOKIE_NAME)
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Signed out.' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: errorResponseSchema })
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.signOut.execute(readSessionToken(singleHeader(request, 'cookie')));
    void reply.header('set-cookie', clearedSessionCookie(this.cookieDomain()));
  }

  private cookieDomain(): string | undefined {
    return this.config.get('SESSION_COOKIE_DOMAIN', { infer: true });
  }
}

function isoOrNull(at: Date | null): string | null {
  return at === null ? null : at.toISOString();
}

@ApiTags('dashboard sign-in')
@Controller('v1/me')
export class MeController {
  constructor(private readonly describeAdmin: DescribeAdminUseCase) {}

  @Get()
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: 'The signed-in admin and their projects' })
  @ApiCookieAuth(SESSION_COOKIE_NAME)
  @ApiResponse({ status: HttpStatus.OK, standardSchema: meSchema })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
  async me(@Req() request: FastifyRequest): Promise<MeBody> {
    const description = await this.describeAdmin.execute(adminOf(request));
    return {
      email: description.email,
      projects: description.projects.map((project) => ({
        id: project.id,
        name: project.name,
        timezone: project.timezone,
        conversion_event: project.conversionEvent,
        first_event_at: isoOrNull(project.firstEventAt),
        last_event_at: isoOrNull(project.lastEventAt),
      })),
    };
  }
}
