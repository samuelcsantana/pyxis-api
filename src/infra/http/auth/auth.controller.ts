import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { DescribeAdminUseCase } from '../../../usecases/auth/describe-admin.usecase';
import { RequestSignInCodeUseCase } from '../../../usecases/auth/request-sign-in-code.usecase';
import { SignOutEverywhereUseCase } from '../../../usecases/auth/sign-out-everywhere.usecase';
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
import { readSessionToken, SESSION_COOKIE_NAME } from './session-cookie';

@ApiTags('dashboard sign-in')
@Controller('v1/auth')
@SkipThrottle({ [INGEST_THROTTLER]: true, [SUBJECTS_THROTTLER]: true })
export class AuthController {
  constructor(
    private readonly requestSignInCode: RequestSignInCodeUseCase,
    private readonly verifySignInCode: VerifySignInCodeUseCase,
    private readonly signOut: SignOutUseCase,
    private readonly signOutEverywhere: SignOutEverywhereUseCase,
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
    await this.requestSignInCode.execute(body.email, body.locale);
  }

  @Post('verify-code')
  @UseGuards(DashboardOriginGuard, ClientAddressThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a sign-in code for a session token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Signed in; the body carries the session token for the dashboard to keep in a cookie of its ' +
      'own host and send back as the pyxis_session cookie.',
    standardSchema: signedInSchema,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, standardSchema: errorResponseSchema })
  async verifyCode(
    @Body({ schema: verifyCodeSchema, pipes: [new SchemaPipe(verifyCodeSchema)] })
    body: VerifyCodeBody,
  ): Promise<SignedInBody> {
    const signedIn = await this.verifySignInCode.execute(body.email, body.code);
    return { email: signedIn.email, session_token: signedIn.sessionToken };
  }

  @Post('logout')
  @UseGuards(DashboardOriginGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the session of the pyxis_session cookie' })
  @ApiCookieAuth(SESSION_COOKIE_NAME)
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Signed out.' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: errorResponseSchema })
  async logout(@Req() request: FastifyRequest): Promise<void> {
    await this.signOut.execute(readSessionToken(singleHeader(request, 'cookie')));
  }

  @Post('logout-all')
  @UseGuards(DashboardOriginGuard, SessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke every session of the signed-in admin, this one included',
    description: 'Signs the admin out of every device at once. Needs a live session.',
  })
  @ApiCookieAuth(SESSION_COOKIE_NAME)
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Signed out everywhere.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: errorResponseSchema })
  async logoutAll(@Req() request: FastifyRequest): Promise<void> {
    await this.signOutEverywhere.execute(adminOf(request));
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
