import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { CompleteSignUpUseCase } from '../../../usecases/accounts/complete-sign-up.usecase';
import { ReadSignUpStatusUseCase } from '../../../usecases/accounts/read-sign-up-status.usecase';
import { RequestSignUpCodeUseCase } from '../../../usecases/accounts/request-sign-up-code.usecase';
import { clientOf } from '../auth/auth.controller';
import { DashboardOriginGuard } from '../auth/auth.guards';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { ClientAddressThrottlerGuard } from '../rate-limit/client-address-throttler.guard';
import { AUTH_THROTTLER, skipThrottlersExcept } from '../rate-limit/rate-limits';
import { SchemaPipe } from '../schema-pipe';
import {
  type SignedUpBody,
  signedUpSchema,
  type SignUpBody,
  type SignUpCodeBody,
  signUpCodeSchema,
  signUpSchema,
  type SignUpStatusBody,
  signUpStatusSchema,
} from './accounts.schemas';

@ApiTags('sign-up')
@Controller('v1/auth/sign-up')
@SkipThrottle(skipThrottlersExcept(AUTH_THROTTLER))
export class SignUpController {
  constructor(
    private readonly requestSignUpCode: RequestSignUpCodeUseCase,
    private readonly completeSignUp: CompleteSignUpUseCase,
    private readonly readSignUpStatus: ReadSignUpStatusUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Whether sign-up is open, the version of the terms a new owner accepts, and whether the ' +
      'free plan takes new owners',
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: signUpStatusSchema })
  async status(): Promise<SignUpStatusBody> {
    const status = await this.readSignUpStatus.execute();
    return {
      open: status.open,
      terms_version: status.termsVersion,
      terms_url: status.termsUrl,
      free_plan: status.freePlan,
    };
  }

  @Post('code')
  @UseGuards(DashboardOriginGuard, ClientAddressThrottlerGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Email a code to create an account',
    description:
      'Answers 202 whoever the email is. A code is created and emailed within the limits per ' +
      'email and per day; 404 while sign-up is closed.',
  })
  @ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Accepted.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, standardSchema: errorResponseSchema })
  async code(
    @Body({ schema: signUpCodeSchema, pipes: [new SchemaPipe(signUpCodeSchema)] })
    body: SignUpCodeBody,
  ): Promise<void> {
    await this.requestSignUpCode.execute(body.email, body.locale);
  }

  @Post('verify')
  @UseGuards(DashboardOriginGuard, ClientAddressThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange a sign-up code for a session and an account',
    description:
      'Records the acceptance of the terms version given, which must be the current one (409 ' +
      'otherwise). An owner who already has a live account gets that account back. While the ' +
      'free plan is open and has a place, the account starts on it; when it is full, the account ' +
      'waits for its subscription or for a place.',
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: signedUpSchema })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.CONFLICT, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, standardSchema: errorResponseSchema })
  async verify(
    @Body({ schema: signUpSchema, pipes: [new SchemaPipe(signUpSchema)] })
    body: SignUpBody,
    @Req() request: FastifyRequest,
  ): Promise<SignedUpBody> {
    const signedUp = await this.completeSignUp.execute({
      email: body.email,
      code: body.code,
      termsVersion: body.terms_version,
      client: clientOf(request),
    });
    return {
      email: signedUp.email,
      session_token: signedUp.sessionToken,
      account_id: signedUp.accountId,
      account_status: signedUp.accountStatus,
    };
  }
}
